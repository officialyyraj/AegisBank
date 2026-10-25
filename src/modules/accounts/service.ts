// src/modules/accounts/service.ts — create/list/get/statement (requirements.
import { accountsRepository } from './repository'
import { db } from '@/lib/db'
import { Errors } from '@/lib/errors'
import { logger, maskAccountNumber } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'

function generateAccountNumber(): string {
  // AEG + 10-digit zero-padded random. Unique enforced at DB layer.
  const n = randomBytes(5).readUIntBE(0, 5) % 10_000_000_000
  return 'AEG' + String(n).padStart(10, '0')
}

async function uniqueAccountNumber(tx: Prisma.TransactionClient): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const num = generateAccountNumber()
    const exists = await tx.account.findUnique({ where: { accountNumber: num }, select: { id: true } })
    if (!exists) return num
  }
  // extremely unlikely fallback
  return 'AEG' + Date.now().toString().slice(-10)
}

/** POST /accounts — KYC must be approved (requirements : block if kyc_status != approved → 403). */
export async function createAccount(userId: string, accountType: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { kycStatus: true } })
  if (!user) throw Errors.unauthorized()
  if (user.kycStatus !== 'approved') {
    throw Errors.forbidden('KYC not approved — cannot create account')
  }
  const account = await db.$transaction(async (tx) => {
    const accountNumber = await uniqueAccountNumber(tx)
    return accountsRepository.create(tx, { userId, accountNumber, accountType })
  }, { maxWait: 10000, timeout: 30000 })
  logger.info('account.created', { userId, accountId: account.id, number: maskAccountNumber(account.accountNumber) })
  return serializeAccount(account)
}

/** GET /accounts — list caller's accounts. */
export async function listAccounts(userId: string) {
  const list = await accountsRepository.findByUser(userId)
  return list.map(serializeAccount)
}

/** GET /accounts/:id — owner only (403 if not owner). */
export async function getAccount(userId: string, accountId: string) {
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')
  return serializeAccount(account)
}

/** GET /accounts/:id/statement?from=&to=&direction=&search= — owner only. Unpaginated (full set). */
export async function getStatement(userId: string, accountId: string, from?: Date, to?: Date, direction?: 'debit' | 'credit', search?: string) {
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')
  const txns = await accountsRepository.statement(accountId, from, to, direction, search)
  return txns.map(serializeTransaction)
}

/**
 * GET /accounts/:id/statement?cursor=&limit= — cursor-based pagination (Design note).
 * `cursor` is a transaction ID; we resolve its createdAt and fetch items created
 * BEFORE that timestamp. Returns `{items, next_cursor}` where `next_cursor` is
 * the last item's ID (or null if no more pages). Limit default 20, max 100.
 * CSV + PDF export remain UNPAGINATED (full filtered set).
 */
export async function getStatementPaginated(
  userId: string,
  accountId: string,
  opts: { from?: Date; to?: Date; direction?: 'debit' | 'credit'; search?: string; cursor?: string; limit?: number },
) {
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')

  const limit = Math.max(1, Math.min(100, opts.limit ?? 20))
  let cursorDate: Date | undefined
  if (opts.cursor) {
    const cursorTxn = await db.transaction.findUnique({ where: { id: opts.cursor }, select: { createdAt: true } })
    if (!cursorTxn) throw Errors.badRequest('Invalid cursor')
    cursorDate = cursorTxn.createdAt
  }

  // Fetch limit+1 to determine if there's a next page
  const txns = await accountsRepository.statement(accountId, opts.from, opts.to, opts.direction, opts.search, cursorDate, limit + 1)
  const hasNext = txns.length > limit
  const page = txns.slice(0, limit)
  const items = page.map(serializeTransaction)
  const next_cursor = hasNext && items.length > 0 ? items[items.length - 1]!.id : null

  return { items, next_cursor }
}

/**
 * POST /admin/accounts/:id/status (admin) — freeze or close an account.
 * Design note. Frozen accounts block new outgoing transfers (the debit guard
 * `WHERE status='active'` rejects them). Closed accounts are frozen + their
 * balance is not zeroed (demo: real banking would require a withdrawal first).
 */
export async function setAccountStatusAdmin(accountId: string, status: 'active' | 'frozen' | 'closed') {
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  const updated = await db.account.update({ where: { id: accountId }, data: { status } })
  logger.info('account.status.changed', { accountId, status, by: 'admin' })
  return serializeAccount(updated)
}

/** GET /admin/accounts (admin) — list all accounts across all users (for the admin view). */
export async function listAllAccountsAdmin() {
  const list = await db.account.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, fullName: true } } },
  })
  return list.map((a) => ({
    ...serializeAccount(a),
    owner_email: a.user.email,
    owner_name: a.user.fullName,
  }))
}

/** Raw statement rows (with source/dest IDs) for CSV export. Owner only. */
export async function getStatementRows(userId: string, accountId: string, from?: Date, to?: Date, direction?: 'debit' | 'credit', search?: string) {
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')
  const txns = await accountsRepository.statement(accountId, from, to, direction, search)
  return txns.map((t) => ({
    id: t.id,
    source_account_id: t.sourceAccountId,
    destination_account_id: t.destinationAccountId,
    amount: t.amount.toString(),
    status: t.status,
    created_at: t.createdAt.toISOString(),
  }))
}

/**
 * GET /accounts/lookup?account_number=AEG... — look up an account by its
 * account number for the inter-user transfer flow (Design note). Returns a
 * MINIMAL shape (account_id + masked holder name) so the caller can confirm
 * the recipient before transferring. Never reveals the full holder name or
 * email — only a masked greeting like "A*** S" to prevent enumeration.
 */
export async function lookupAccount(_userId: string, accountNumber: string) {
  if (!accountNumber || accountNumber.length < 3) throw Errors.badRequest('Invalid account number')
  const account = await db.account.findUnique({
    where: { accountNumber },
    select: { id: true, accountType: true, userId: true, user: { select: { fullName: true } } },
  })
  if (!account) throw Errors.notFound('Account not found')
  // Mask the holder name: first initial + last initial, e.g. "Alice Sharma" → "A*** S"
  const parts = account.user.fullName.split(' ')
  const masked = parts.length >= 2
    ? `${parts[0]![0]}*** ${parts[parts.length - 1]![0]}`
    : `${parts[0]?.[0] ?? '?'}***`
  return {
    account_id: account.id,
    account_type: account.accountType,
    holder: masked,
  }
}

export function serializeAccount(a: {
  id: string
  userId: string
  accountNumber: string
  accountType: string
  balance: Prisma.Decimal
  status: string
  createdAt: Date
}) {
  return {
    id: a.id,
    user_id: a.userId,
    account_number: a.accountNumber,
    account_type: a.accountType,
    balance: a.balance.toString(),
    status: a.status,
    created_at: a.createdAt.toISOString(),
  }
}

function serializeTransaction(t: {
  id: string
  sourceAccountId: string
  destinationAccountId: string
  amount: Prisma.Decimal
  status: string
  sagaState: string
  createdAt: Date
}) {
  return {
    id: t.id,
    source_account_id: t.sourceAccountId,
    destination_account_id: t.destinationAccountId,
    amount: t.amount.toString(),
    status: t.status,
    saga_state: t.sagaState,
    created_at: t.createdAt.toISOString(),
  }
}

/**
 * GET /accounts/:id/spending-by-category?days=30 — spending breakdown by
 * merchant category (Design note). Aggregates outgoing transfers grouped by the
 * optional `category` field (null → "Uncategorized"). Returns top categories
 * with totals + counts, sorted by amount desc.
 */
export async function getSpendingByCategory(userId: string, accountId: string, days = 30) {
  const capped = Math.max(1, Math.min(90, days))
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')
  const since = new Date(Date.now() - capped * 24 * 60 * 60 * 1000)
  const rows = await db.transaction.findMany({
    where: { sourceAccountId: accountId, status: 'completed', createdAt: { gte: since } },
    select: { amount: true, category: true },
  })
  const byCat = new Map<string, { amount: number; count: number }>()
  for (const r of rows) {
    const cat = r.category || 'Uncategorized'
    const existing = byCat.get(cat) || { amount: 0, count: 0 }
    existing.amount += Number(r.amount)
    existing.count++
    byCat.set(cat, existing)
  }
  const items = [...byCat.entries()]
    .map(([category, v]) => ({ category, amount: Number(v.amount.toFixed(2)), count: v.count }))
    .sort((a, b) => b.amount - a.amount)
  const total = items.reduce((s, i) => s + i.amount, 0)
  return { days: capped, total: Number(total.toFixed(2)), items }
}

/**
 * GET /accounts/:id/monthly-spending?months=6 (owner) — per-month spending
 * totals for the last N months, broken down by category, for a bar chart
 * (Design note). Returns an array of `{ month: '2026-09', total: number,
 * categories: [{category, amount}] }` oldest-first. Useful for
 * month-over-month comparison.
 */
export async function getMonthlySpending(userId: string, accountId: string, months = 6) {
  const capped = Math.max(1, Math.min(12, months))
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')

  const since = new Date()
  since.setMonth(since.getMonth() - (capped - 1))
  since.setDate(1)
  since.setHours(0, 0, 0, 0)

  const txns = await db.transaction.findMany({
    where: { sourceAccountId: accountId, status: 'completed', createdAt: { gte: since } },
    select: { amount: true, category: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by month + category.
  const byMonth = new Map<string, Map<string, number>>()
  for (const t of txns) {
    const monthKey = t.createdAt.toISOString().slice(0, 7) // YYYY-MM
    const cat = t.category || 'Uncategorized'
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, new Map())
    const catMap = byMonth.get(monthKey)!
    catMap.set(cat, (catMap.get(cat) || 0) + Number(t.amount))
  }

  // Build the result array with all months in range (even empty ones).
  const result: Array<{ month: string; total: number; categories: Array<{ category: string; amount: number }> }> = []
  const now = new Date()
  for (let i = capped - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = d.toISOString().slice(0, 7)
    const catMap = byMonth.get(monthKey) || new Map<string, number>()
    const categories = [...catMap.entries()]
      .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
    const total = categories.reduce((s, c) => s + c.amount, 0)
    result.push({ month: monthKey, total: Number(total.toFixed(2)), categories })
  }
  return result
}

/**
 * GET /accounts/:id/spending?days=30 — spending breakdown by counterparty for
 * the dashboard donut chart (Design note). Returns the top N counterparties the
 * caller has sent money to in the window, with total debited + transaction
 * count, plus an "Others" bucket. Sorted by amount desc.
 */
export async function getSpendingBreakdown(userId: string, accountId: string, days = 30) {
  const capped = Math.max(1, Math.min(90, days))
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')

  const since = new Date(Date.now() - capped * 24 * 60 * 60 * 1000)
  // Outgoing transfers from this account, grouped by destination account owner.
  const txns = await db.transaction.findMany({
    where: { sourceAccountId: accountId, status: 'completed', createdAt: { gte: since } },
    select: { destinationAccountId: true, amount: true },
  })
  // Resolve destination account → owner name (full_name) for labeling.
  const destIds = [...new Set(txns.map((t) => t.destinationAccountId))]
  const destAccounts = await db.account.findMany({ where: { id: { in: destIds } }, select: { id: true, userId: true } })
  const owners = await db.user.findMany({ where: { id: { in: destAccounts.map((a) => a.userId) } }, select: { id: true, fullName: true } })
  const ownerNameByUserId = new Map(owners.map((o) => [o.id, o.fullName]))
  const destOwnerByAccId = new Map(destAccounts.map((a) => [a.id, ownerNameByUserId.get(a.userId) || 'Unknown']))

  // Aggregate by counterparty name.
  const byCategory = new Map<string, { amount: number; count: number }>()
  for (const t of txns) {
    const cat = destOwnerByAccId.get(t.destinationAccountId) || 'Unknown'
    const existing = byCategory.get(cat) || { amount: 0, count: 0 }
    existing.amount += Number(t.amount)
    existing.count++
    byCategory.set(cat, existing)
  }

  const items = [...byCategory.entries()]
    .map(([category, v]) => ({ category, amount: Number(v.amount.toFixed(2)), count: v.count }))
    .sort((a, b) => b.amount - a.amount)

  // Top 5 + "Others" bucket.
  const TOP_N = 5
  const top = items.slice(0, TOP_N)
  const rest = items.slice(TOP_N)
  const othersAmount = rest.reduce((s, i) => s + i.amount, 0)
  const othersCount = rest.reduce((s, i) => s + i.count, 0)
  if (othersAmount > 0) top.push({ category: 'Others', amount: Number(othersAmount.toFixed(2)), count: othersCount })

  const total = items.reduce((s, i) => s + i.amount, 0)
  return { days: capped, total: Number(total.toFixed(2)), items: top }
}

/**
 * GET /accounts/:id/balance-history?days=30 — derived balance trend for the
 * dashboard sparkline (Design note). Walks the account's completed transactions
 * backwards from the current balance, emitting a per-day closing balance for
 * the last `days` days (default 30, max 90). Includes top-up (payment) credits
 * so the trend reflects all balance movements. Points are oldest-first.
 */
export async function getBalanceHistory(userId: string, accountId: string, days = 30) {
  const capped = Math.max(1, Math.min(90, days))
  const account = await accountsRepository.findById(accountId)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')

  const since = new Date(Date.now() - capped * 24 * 60 * 60 * 1000)
  // Fetch completed transactions where this account is source or dest, plus
  // completed payments crediting this account, oldest-first.
  const [txns, payments] = await Promise.all([
    db.transaction.findMany({
      where: { status: 'completed', createdAt: { gte: since }, OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }] },
      orderBy: { createdAt: 'asc' },
      select: { amount: true, sourceAccountId: true, destinationAccountId: true, createdAt: true },
    }),
    db.payment.findMany({
      where: { status: 'completed', accountId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { amount: true, createdAt: true },
    }),
  ])

  // Build a sorted list of { ts, delta } where delta is +amount for credits,
  // -amount for debits (relative to THIS account).
  const moves: { ts: number; delta: number }[] = []
  for (const t of txns) {
    const debit = t.sourceAccountId === accountId
    moves.push({ ts: t.createdAt.getTime(), delta: debit ? -Number(t.amount) : Number(t.amount) })
  }
  for (const p of payments) {
    moves.push({ ts: p.createdAt.getTime(), delta: Number(p.amount) }) // top-ups always credit
  }
  moves.sort((a, b) => a.ts - b.ts)

  // Walk backwards from current balance to derive the balance BEFORE each move,
  // then bucket into per-day closing balances.
  const current = Number(account.balance)
  // Compute the balance at the start of the window (current - sum of all deltas).
  const sumDeltas = moves.reduce((s, m) => s + m.delta, 0)
  let running = current - sumDeltas

  // Build per-day buckets.
  const buckets: { date: string; balance: number }[] = []
  const dayMs = 24 * 60 * 60 * 1000
  const startOfDay = (ts: number) => {
    const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime()
  }
  let moveIdx = 0
  for (let d = 0; d < capped; d++) {
    const dayStart = startOfDay(Date.now() - (capped - 1 - d) * dayMs)
    const dayEnd = dayStart + dayMs
    // apply all moves that fall within this day
    while (moveIdx < moves.length && moves[moveIdx]!.ts >= dayStart && moves[moveIdx]!.ts < dayEnd) {
      running += moves[moveIdx]!.delta
      moveIdx++
    }
    buckets.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      balance: Number(running.toFixed(2)),
    })
  }
  return buckets
}
