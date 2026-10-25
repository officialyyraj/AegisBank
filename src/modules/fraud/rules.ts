// src/modules/fraud/rules.ts — the 3 deterministic fraud rules (requirements.
// Each rule returns a severity+reason if triggered, or null.
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

export interface FraudFinding {
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  reason: string
}

const VELOCITY_WINDOW_MIN = 5
const VELOCITY_THRESHOLD = 4 // >=4 txns (incl current) in 5min → flag (requirements
const LARGE_AMOUNT_MULTIPLIER = 5 // amount > 30-day avg × 5 → HIGH (requirements

/**
 * R2 — Velocity: more than 3 transactions from this user's accounts within
 * 5 minutes (requirements / requirements. Counts completed transactions in the
 * window INCLUDING the one currently being evaluated (the event is published
 * only after the row is committed). Deduplicates: one flag per burst — if an
 * open velocity flag already exists for this user within the window, no new
 * flag is created (keeps the admin queue clean; matches the acceptance
 * criterion's "a fraud_flags row is created" intent rather than spamming one
 * per transaction).
 */
export async function checkVelocity(userId: string): Promise<FraudFinding | null> {
  const since = new Date(Date.now() - VELOCITY_WINDOW_MIN * 60 * 1000)
  const accounts = await db.account.findMany({ where: { userId }, select: { id: true } })
  if (accounts.length === 0) return null
  const accountIds = accounts.map((a) => a.id)
  const count = await db.transaction.count({
    where: {
      status: 'completed',
      createdAt: { gte: since },
      sourceAccountId: { in: accountIds },
    },
  })
  if (count < VELOCITY_THRESHOLD) return null
  // Dedup: skip if an open velocity flag for this user already exists in the
  // window (one flag per burst). We fetch+filter in JS because the relation
  // filter through transaction→account was unreliable under SQLite.
  const recent = await db.fraudFlag.findMany({
    where: { reason: { contains: 'velocity:' }, reviewedStatus: 'open', createdAt: { gte: since } },
    include: { transaction: { select: { sourceAccountId: true } } },
  })
  const mine = recent.some((f) => f.transaction && accountIds.includes(f.transaction.sourceAccountId))
  if (mine) return null
  return { severity: 'MEDIUM', reason: `velocity: ${count} transfers in ${VELOCITY_WINDOW_MIN} min` }
}

/**
 * R1 — Large amount: amount > user's 30-day average transfer amount × 5
 * (requirements. Skipped when there is no 30-day history (can't compute a
 * baseline — documented as an open issue).
 */
export async function checkAmountThreshold(userId: string, amount: Prisma.Decimal): Promise<FraudFinding | null> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const accounts = await db.account.findMany({ where: { userId }, select: { id: true } })
  if (accounts.length === 0) return null
  const accountIds = accounts.map((a) => a.id)
  const agg = await db.transaction.aggregate({
    where: { sourceAccountId: { in: accountIds }, createdAt: { gte: since } },
    _avg: { amount: true },
    _count: true,
  })
  if (!agg._avg.amount || agg._count === 0) return null // no baseline
  const avg = new Prisma.Decimal(agg._avg.amount.toFixed(2))
  const threshold = avg.mul(LARGE_AMOUNT_MULTIPLIER)
  if (amount.gt(threshold)) {
    return {
      severity: 'HIGH',
      reason: `large-amount: ${amount.toString()} > 30d-avg ${avg.toString()} × ${LARGE_AMOUNT_MULTIPLIER}`,
    }
  }
  return null
}

/**
 * R3 — New device: fingerprint not seen before for this user (requirements.
 * Records the fingerprint on first sight (idempotent). Returns a finding when
 * the fingerprint is genuinely new.
 */
export async function checkNewDevice(userId: string, fingerprint: string): Promise<FraudFinding | null> {
  if (!fingerprint) return null
  const existing = await db.deviceFingerprint.findUnique({
    where: { userId_fingerprint: { userId, fingerprint } },
  })
  if (existing) return null
  // record it (idempotent — race-safe via unique constraint)
  try {
    await db.deviceFingerprint.create({ data: { userId, fingerprint } })
  } catch (e) {
    logger.debug('fraud.fingerprint.race', { userId, err: String(e) })
  }
  return { severity: 'LOW', reason: `new-device: fingerprint ${fingerprint} first seen` }
}
