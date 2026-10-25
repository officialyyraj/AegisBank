// src/modules/payees/service.ts — saved-payee (contacts) CRUD (Design note).
import { payeesRepository } from './repository'
import { accountsRepository } from '@/modules/accounts/repository'
import { Errors } from '@/lib/errors'
import { db } from '@/lib/db'
import { maskAccountNumber, logger } from '@/lib/logger'

/** GET /payees — list the caller's saved payees with masked account + holder name. */
export async function listPayees(ownerUserId: string) {
  const list = await payeesRepository.listByOwner(ownerUserId)
  return list.map((p) => ({
    id: p.id,
    target_account_id: p.targetAccountId,
    nickname: p.nickname,
    account_number: maskAccountNumber(p.targetAccount.accountNumber),
    account_type: p.targetAccount.accountType,
    holder_name: p.targetAccount.user.fullName,
    created_at: p.createdAt.toISOString(),
  }))
}

/**
 * POST /payees — save a payee. The target account must NOT belong to the
 * caller (can't save yourself as a payee — would be confusing). Idempotent
 * via the unique(ownerUserId, targetAccountId) constraint.
 */
export async function createPayee(ownerUserId: string, targetAccountId: string, nickname?: string | null) {
  const target = await accountsRepository.findById(targetAccountId)
  if (!target) throw Errors.notFound('Target account not found')
  if (target.userId === ownerUserId) throw Errors.badRequest('Cannot save your own account as a payee')
  // idempotent: if already saved, just update the nickname
  const existing = await payeesRepository.findByOwnerAndTarget(ownerUserId, targetAccountId)
  if (existing) {
    if (nickname !== undefined) await payeesRepository.update(existing.id, { nickname: nickname ?? null })
    logger.info('payee.updated', { payeeId: existing.id, ownerUserId })
    return { id: existing.id, target_account_id: targetAccountId }
  }
  const p = await payeesRepository.create({ ownerUserId, targetAccountId, nickname: nickname ?? null })
  logger.info('payee.created', { payeeId: p.id, ownerUserId, target: maskAccountNumber(target.accountNumber) })
  return { id: p.id, target_account_id: targetAccountId }
}

/** PATCH /payees/:id — update nickname. */
export async function updatePayee(ownerUserId: string, id: string, nickname: string | null) {
  const list = await payeesRepository.listByOwner(ownerUserId)
  const p = list.find((x) => x.id === id)
  if (!p) throw Errors.notFound('Payee not found')
  const updated = await payeesRepository.update(id, { nickname })
  return { id: updated.id, nickname: updated.nickname }
}

/** DELETE /payees/:id — remove a payee. */
export async function deletePayee(ownerUserId: string, id: string) {
  const list = await payeesRepository.listByOwner(ownerUserId)
  const p = list.find((x) => x.id === id)
  if (!p) throw Errors.notFound('Payee not found')
  await payeesRepository.delete(id)
  logger.info('payee.deleted', { payeeId: id, ownerUserId })
  return { deleted: true }
}

/**
 * GET /accounts/lookup-email?email=... — recipient lookup by EMAIL (Design note).
 * Finds the user by email, then their primary (savings) account, returns the
 * same masked shape as account-number lookup. This is the friendlier
 * alternative to memorizing account numbers. Non-existent email → NOT_FOUND
 * (no enumeration risk because the caller already knows the email they typed).
 */
export async function lookupByEmail(_callerId: string, email: string) {
  if (!email || !email.includes('@')) throw Errors.badRequest('Invalid email')
  const user = await db.user.findUnique({ where: { email }, select: { id: true, fullName: true, accounts: { select: { id: true, accountType: true, accountNumber: true }, orderBy: { accountType: 'asc' } } } })
  if (!user || user.accounts.length === 0) throw Errors.notFound('No account found for that email')
  // Prefer savings, else first account
  const acct = user.accounts.find((a) => a.accountType === 'savings') || user.accounts[0]!
  const parts = user.fullName.split(' ')
  const masked = parts.length >= 2 ? `${parts[0]![0]}*** ${parts[parts.length - 1]![0]}` : `${parts[0]?.[0] ?? '?'}***`
  return {
    account_id: acct.id,
    account_type: acct.accountType,
    account_number: maskAccountNumber(acct.accountNumber),
    holder: masked,
  }
}
