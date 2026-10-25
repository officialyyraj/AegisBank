// src/modules/payments/service.ts — mock top-up (requirements.
//
// Flow:
//   1. Insert payments row status='pending' (own tx).
//   2. Call mockPaymentGatewayCharge(amount) with up to 3 attempts (95% each).
//   3. On success: credit the account + update payments status='completed' +
//      publish payment.completed — all in ONE tx (atomic ledger + outbox).
//   4. On failure (3 attempts): update payments status='failed' + publish
//      payment.failed.
//
// POST returns 202 (accepted, processing) with the final payment object.
import { paymentsRepository } from './repository'
import { accountsRepository } from '@/modules/accounts/repository'
import { mockPaymentGatewayCharge, MAX_ATTEMPTS } from './mockGateway'
import { publishEvent } from '@/modules/eventbus/outbox'
import { Errors } from '@/lib/errors'
import { logger, maskAccountNumber } from '@/lib/logger'
import { db } from '@/lib/db'
import { withRetry } from '@/lib/withRetry'
import { Prisma } from '@prisma/client'
import { claimIdempotency, hashRequest, releaseIdempotency } from '@/lib/idempotency'
import { randomUUID } from 'crypto'

/** POST /payments/topup — top up an account via the mock external rail. */
export async function topup(userId: string, input: { account_id: string; amount: number }, idempotencyKey: string = randomUUID()) {
  const claim = await claimIdempotency(userId, 'topup', idempotencyKey, hashRequest(input))
  if (claim.kind === 'replay') return claim.body
  try {
    return await topupOnce(userId, input, claim.id)
  } catch (error) {
    await releaseIdempotency(claim.id)
    throw error
  }
}

async function topupOnce(userId: string, input: { account_id: string; amount: number }, idempotencyId: string) {
  const account = await accountsRepository.findById(input.account_id)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')

  const amount = new Prisma.Decimal(input.amount.toFixed(2))

  // 1. insert pending payment row (its own tx so the row exists even if the
  //    gateway is slow / fails — caller can poll GET /payments/:id).
  const payment = await withRetry(() => db.$transaction(async (tx) =>
    paymentsRepository.create(tx, { accountId: account.id, amount, direction: 'credit', status: 'pending' }),
  { maxWait: 10000, timeout: 30000 }), { op: 'topup.pending' })
  logger.info('payment.created', { paymentId: payment.id, account: maskAccountNumber(account.accountNumber), amount: amount.toString() })

  // 2. charge mock gateway (retries inside)
  const result = await mockPaymentGatewayCharge(input.amount)

  if (result.ok) {
    // 3. success: credit account + mark completed + publish — atomic
    const updated = await withRetry(() => db.$transaction(async (tx) => {
      await accountsRepository.credit(tx, account.id, amount)
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'completed', providerRef: result.providerRef },
      })
      await publishEvent(tx, 'payment.completed', {
        payment_id: payment.id,
        account_id: account.id,
        user_id: userId,
        amount: amount.toString(),
        provider_ref: result.providerRef,
      })
      const updatedPayment = await tx.payment.findUnique({ where: { id: payment.id } })
      const response = serializePayment(updatedPayment ?? payment, 'completed')
      await tx.idempotencyKey.update({ where: { id: idempotencyId }, data: { status: 'completed', responseJson: JSON.stringify(response), responseStatus: 202 } })
      return response
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 }), { op: 'topup.success' })
    logger.info('payment.completed', { paymentId: payment.id, attempts: result.attempts })
    return updated
  }

  // 4. failure after retries: mark failed + publish
  const failed = await withRetry(() => db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', providerRef: result.providerRef },
    })
    await publishEvent(tx, 'payment.failed', {
      payment_id: payment.id,
      account_id: account.id,
      user_id: userId,
      amount: amount.toString(),
      provider_ref: result.providerRef,
      attempts: result.attempts,
    })
    const failedPayment = await tx.payment.findUnique({ where: { id: payment.id } })
    const response = serializePayment(failedPayment ?? payment, 'failed')
    await tx.idempotencyKey.update({ where: { id: idempotencyId }, data: { status: 'completed', responseJson: JSON.stringify(response), responseStatus: 202 } })
    return response
  }, { maxWait: 10000, timeout: 30000 }), { op: 'topup.failed' })
  logger.warn('payment.failed', { paymentId: payment.id, attempts: result.attempts })
  return failed
}

/** GET /payments/:id — owner only. */
export async function getPayment(userId: string, paymentId: string) {
  const payment = await paymentsRepository.findById(paymentId)
  if (!payment) throw Errors.notFound('Payment not found')
  const account = await accountsRepository.findById(payment.accountId)
  if (!account || account.userId !== userId) throw Errors.forbidden('Not the account owner')
  return serializePayment(payment, payment.status)
}

function serializePayment(p: {
  id: string
  accountId: string
  amount: Prisma.Decimal
  direction: string
  providerRef: string | null
  status: string
  createdAt: Date
}, status: string) {
  return {
    id: p.id,
    account_id: p.accountId,
    amount: p.amount.toString(),
    direction: p.direction,
    provider_ref: p.providerRef,
    status,
    created_at: p.createdAt.toISOString(),
  }
}

export { MAX_ATTEMPTS }
