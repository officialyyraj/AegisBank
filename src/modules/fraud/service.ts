// src/modules/fraud/service.ts — async fraud evaluation (requirements.
//
// Subscribes (via the event bus) to `transaction.created` and `payment.completed`.
// On each event: runs the 3 rules, and for any finding creates a fraud_flags
// row + publishes `fraud.flagged`. Fraud is NON-BLOCKING: the originating
// transaction has already completed by the time the event is processed, and a
// rule error is logged but never throws out of the handler (requirements  failure
// behaviour; requirements  failure case).
import { fraudRepository } from './repository'
import { checkVelocity, checkAmountThreshold, checkNewDevice } from './rules'
import { publishEventStandalone } from '@/modules/eventbus/outbox'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

export interface TransactionCreatedPayload {
  transaction_id: string
  source_account_id: string
  destination_account_id: string
  user_id: string
  amount: string
  fingerprint: string
  created_at: string
}

export interface PaymentCompletedPayload {
  payment_id: string
  account_id: string
  user_id: string
  amount: string
  provider_ref: string
}

/** Event handler for `transaction.created`. */
export async function onTransactionCreated(payload: unknown): Promise<void> {
  const p = payload as TransactionCreatedPayload
  const userId = p.user_id
  const amount = new Prisma.Decimal(p.amount)
  const findings: { severity: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string }[] = []

  // Run all three rules. Each is wrapped so one failure doesn't abort others.
  const runners: Promise<{ severity: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string } | null>[] = [
    safe(() => checkVelocity(userId)),
    safe(() => checkAmountThreshold(userId, amount)),
    safe(() => checkNewDevice(userId, p.fingerprint)),
  ]
  const results = await Promise.all(runners)
  for (const r of results) if (r) findings.push(r)

  if (findings.length === 0) {
    logger.debug('fraud.evaluated.clean', { transactionId: p.transaction_id, userId })
    return
  }

  // Pick the highest severity as the primary flag, but persist ALL findings.
  for (const f of findings) {
    const flag = await fraudRepository.create({
      transactionId: p.transaction_id,
      severity: f.severity,
      reason: f.reason,
    })
    await publishEventStandalone('fraud.flagged', {
      fraud_flag_id: flag.id,
      transaction_id: p.transaction_id,
      user_id: userId,
      severity: f.severity,
      reason: f.reason,
    })
    logger.warn('fraud.flagged', { flagId: flag.id, severity: f.severity, transactionId: p.transaction_id })
  }
}

/** Event handler for `payment.completed`. */
export async function onPaymentCompleted(payload: unknown): Promise<void> {
  const p = payload as PaymentCompletedPayload
  const userId = p.user_id
  const amount = new Prisma.Decimal(p.amount)
  // Reuse the large-amount rule for payments as well (requirements  lists rules
  // generically; applying the amount threshold to top-ups is the most practical
  // interpretation).
  const amountFinding = await safe(() => checkAmountThreshold(userId, amount))
  if (!amountFinding) {
    logger.debug('fraud.evaluated.clean.payment', { paymentId: p.payment_id, userId })
    return
  }
  const flag = await fraudRepository.create({
    paymentId: p.payment_id,
    severity: amountFinding.severity,
    reason: amountFinding.reason,
  })
  await publishEventStandalone('fraud.flagged', {
    fraud_flag_id: flag.id,
    payment_id: p.payment_id,
    user_id: userId,
    severity: amountFinding.severity,
    reason: amountFinding.reason,
  })
  logger.warn('fraud.flagged.payment', { flagId: flag.id, severity: amountFinding.severity, paymentId: p.payment_id })
}

/** Admin: list fraud flags (optionally filtered by reviewed_status). */
export async function listFraudFlags(status?: string) {
  const list = await fraudRepository.list(status)
  return list.map((f) => ({
    id: f.id,
    transaction_id: f.transactionId,
    payment_id: f.paymentId,
    severity: f.severity,
    reason: f.reason,
    reviewed_status: f.reviewedStatus,
    created_at: f.createdAt.toISOString(),
  }))
}

/** Admin: review a fraud flag. */
export async function reviewFraudFlag(id: string, decision: 'reviewed' | 'dismissed') {
  const existing = await fraudRepository.findById(id)
  if (!existing) return null
  const updated = await fraudRepository.updateReview(id, decision)
  await publishEventStandalone('fraud.reviewed', { fraud_flag_id: id, decision })
  return {
    id: updated.id,
    transaction_id: updated.transactionId,
    payment_id: updated.paymentId,
    severity: updated.severity,
    reason: updated.reason,
    reviewed_status: updated.reviewedStatus,
    created_at: updated.createdAt.toISOString(),
  }
}

// helper: never let a rule throw abort the handler
async function safe<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    logger.error('fraud.rule.threw', { err: String(e) })
    return null
  }
}

