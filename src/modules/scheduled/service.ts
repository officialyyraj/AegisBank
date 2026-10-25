// src/modules/scheduled/service.ts — scheduled/recurring transfers (Design note).
import { scheduledRepository } from './repository'
import { accountsRepository } from '@/modules/accounts/repository'
import { transfer as doTransfer } from '@/modules/transactions/service'
import { Errors } from '@/lib/errors'
import { logger, maskAccountNumber } from '@/lib/logger'
import { Prisma } from '@prisma/client'

function nextRunAfter(now: Date, frequency: string): Date | null {
  const d = new Date(now)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else return null // 'once' → no next run
  return d
}

/** POST /scheduled-transfers — create a new scheduled transfer. */
export async function createScheduled(
  ownerUserId: string,
  input: {
    source_account_id: string
    destination_account_id: string
    amount: number
    frequency: 'once' | 'weekly' | 'monthly'
    start_at: string
    note?: string | null
  },
) {
  const source = await accountsRepository.findById(input.source_account_id)
  if (!source) throw Errors.notFound('Source account not found')
  if (source.userId !== ownerUserId) throw Errors.forbidden('Not the source account owner')
  const dest = await accountsRepository.findById(input.destination_account_id)
  if (!dest) throw Errors.notFound('Destination account not found')
  if (input.source_account_id === input.destination_account_id) throw Errors.badRequest('Source and destination must differ')

  const startAt = new Date(input.start_at)
  if (isNaN(startAt.getTime())) throw Errors.badRequest('Invalid start_at datetime')

  const created = await scheduledRepository.create({
    ownerUserId,
    sourceAccountId: input.source_account_id,
    destinationAccountId: input.destination_account_id,
    amount: input.amount,
    frequency: input.frequency,
    nextRunAt: startAt,
    note: input.note ?? null,
  })
  logger.info('scheduled.created', { id: created.id, freq: input.frequency, from: maskAccountNumber(source.accountNumber) })
  return serialize(created, source, dest)
}

/** GET /scheduled-transfers — list the caller's scheduled transfers. */
export async function listScheduled(ownerUserId: string) {
  const list = await scheduledRepository.listByOwner(ownerUserId)
  return list.map((s) => serialize(s, s.sourceAccount, s.destAccount))
}

/** PATCH /scheduled-transfers/:id — update status (pause/resume) or note. */
export async function updateScheduled(ownerUserId: string, id: string, input: { status?: 'active' | 'paused' | 'completed' | 'failed'; note?: string | null }) {
  const existing = await scheduledRepository.findById(id)
  if (!existing) throw Errors.notFound('Scheduled transfer not found')
  if (existing.ownerUserId !== ownerUserId) throw Errors.forbidden('Not the owner')
  const updated = await scheduledRepository.update(id, {
    ...(input.status ? { status: input.status } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  })
  const source = await accountsRepository.findById(updated.sourceAccountId)
  const dest = await accountsRepository.findById(updated.destinationAccountId)
  return serialize(updated, source!, dest!)
}

/** DELETE /scheduled-transfers/:id — cancel a scheduled transfer. */
export async function deleteScheduled(ownerUserId: string, id: string) {
  const existing = await scheduledRepository.findById(id)
  if (!existing) throw Errors.notFound('Scheduled transfer not found')
  if (existing.ownerUserId !== ownerUserId) throw Errors.forbidden('Not the owner')
  await scheduledRepository.delete(id)
  logger.info('scheduled.deleted', { id })
  return { deleted: true }
}

/**
 * Worker tick: execute all due scheduled transfers. Called every 60s by the
 * background poller (started in eventbus/boot.ts). For each due row:
 *   1. Attempt the transfer via the existing saga (handles insufficient funds).
 *   2. On success: set lastRunAt; advance nextRunAt (or mark 'completed' if 'once').
 *   3. On failure (insufficient funds): mark 'failed' + log; user can re-schedule.
 */
export async function runDueScheduledTransfers(): Promise<number> {
  const due = await scheduledRepository.findDue()
  let executed = 0
  for (const s of due) {
    try {
      await doTransfer(s.ownerUserId, {
        source_account_id: s.sourceAccountId,
        destination_account_id: s.destinationAccountId,
        amount: Number(s.amount),
      }, `fp_scheduled_${s.id}`)
      const next = nextRunAfter(new Date(), s.frequency)
      await scheduledRepository.update(s.id, {
        lastRunAt: new Date(),
        nextRunAt: next ?? s.nextRunAt, // if 'once', next stays (status→completed below)
        status: next ? 'active' : 'completed',
      })
      executed++
      logger.info('scheduled.executed', { id: s.id, freq: s.frequency, next: next?.toISOString() || 'completed' })
    } catch (e) {
      // Insufficient funds or other error → mark failed (don't auto-retry; user re-schedules)
      await scheduledRepository.update(s.id, { status: 'failed' })
      logger.warn('scheduled.failed', { id: s.id, err: String(e) })
    }
  }
  if (executed > 0) logger.info('scheduled.tick.done', { executed, due: due.length })
  return executed
}

function serialize(
  s: { id: string; ownerUserId: string; sourceAccountId: string; destinationAccountId: string; amount: Prisma.Decimal; frequency: string; nextRunAt: Date; lastRunAt: Date | null; status: string; note: string | null; createdAt: Date },
  source: { id: string; accountNumber: string; accountType: string },
  dest: { id: string; accountNumber: string; accountType: string; user?: { fullName: string } },
) {
  return {
    id: s.id,
    source_account_id: s.sourceAccountId,
    source_account_number: maskAccountNumber(source.accountNumber),
    destination_account_id: s.destinationAccountId,
    destination_account_number: maskAccountNumber(dest.accountNumber),
    destination_holder: dest.user?.fullName || null,
    amount: s.amount.toString(),
    frequency: s.frequency,
    next_run_at: s.nextRunAt.toISOString(),
    last_run_at: s.lastRunAt?.toISOString() || null,
    status: s.status,
    note: s.note,
    created_at: s.createdAt.toISOString(),
  }
}
