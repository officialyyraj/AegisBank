// src/lib/frontend/api.ts — typed fetch wrapper for the AegisBank API.
// requirements : attaches Authorization header, handles 401 by clearing session.
export interface ApiError {
  error: string
  message: string
  details?: unknown
}

export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message)
  }
}

const BASE = '/api/v1'

function token() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('aegis_access') || null
}

function idempotencyKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('aegis_access', access)
  window.localStorage.setItem('aegis_refresh', refresh)
}

export function clearTokens() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem('aegis_access')
  window.localStorage.removeItem('aegis_refresh')
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('aegis_refresh') || null
}

export async function getKycFile(id: string): Promise<Blob> {
  const tok = token()
  const res = await fetch(`${BASE}/kyc/documents/${id}/file`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })
  if (!res.ok) throw new ApiRequestError(res.status, 'FILE_UNAVAILABLE', 'The document could not be opened')
  return res.blob()
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  }
  const tok = token()
  if (tok) headers['Authorization'] = `Bearer ${tok}`
  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  const text = await res.text()
  const body = text ? safeParse(text) : null
  if (!res.ok) {
    const err = body as ApiError | null
    // 401 → try refresh once, else clear session
    if (res.status === 401) {
      const refreshed = await tryRefresh()
      if (refreshed) return request<T>(path, opts)
      clearTokens()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('aegis-unauthorized'))
    }
    throw new ApiRequestError(res.status, err?.error || 'UNKNOWN', err?.message || 'Request failed', err?.details)
  }
  return body as T
}

function safeParse(t: string): unknown {
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

let refreshing = false
async function tryRefresh(): Promise<boolean> {
  if (refreshing) return false
  const refresh = getRefreshToken()
  if (!refresh) return false
  refreshing = true
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return false
    const body = await res.json()
    if (body?.access_token) {
      window.localStorage.setItem('aegis_access', body.access_token)
      // Design note: save the rotated refresh token
      if (body?.refresh_token) {
        window.localStorage.setItem('aegis_refresh', body.refresh_token)
      }
      return true
    }
    return false
  } catch {
    return false
  } finally {
    refreshing = false
  }
}

// ---- Typed API surface (requirements ----
export const api = {
  // auth
  register: (email: string, password: string, full_name: string) =>
    request<{ user_id: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, full_name }) }),
  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string; expires_in: number }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  refresh: (refresh_token: string) =>
    request<{ access_token: string; expires_in: number }>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token }) }),
  logoutEverywhere: () => request<{ revoked: boolean }>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<{ requested: boolean }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, new_password: string) =>
    request<{ reset: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),

  // kyc
  kycStatus: () => request<{ kyc_status: string }>('/kyc/status'),
  kycUpload: (file: File, doc_type: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('doc_type', doc_type)
    return request<{ document_id: string; status: string }>('/kyc/documents', { method: 'POST', body: form, headers: {} })
  },

  // accounts
  listAccounts: () => request<Account[]>('/accounts'),
  getAccount: (id: string) => request<Account>(`/accounts/${id}`),
  getStatement: (id: string, opts?: { from?: string; to?: string; direction?: 'debit' | 'credit'; search?: string }) => {
    const q = new URLSearchParams()
    if (opts?.from) q.set('from', opts.from)
    if (opts?.to) q.set('to', opts.to)
    if (opts?.direction) q.set('direction', opts.direction)
    if (opts?.search) q.set('search', opts.search)
    const qs = q.toString()
    return request<Transaction[]>(`/accounts/${id}/statement${qs ? `?${qs}` : ''}`)
  },
  getStatementPage: (id: string, opts: { from?: string; to?: string; direction?: 'debit' | 'credit'; search?: string; cursor?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (opts.from) q.set('from', opts.from)
    if (opts.to) q.set('to', opts.to)
    if (opts.direction) q.set('direction', opts.direction)
    if (opts.search) q.set('search', opts.search)
    if (opts.cursor) q.set('cursor', opts.cursor)
    if (opts.limit) q.set('limit', String(opts.limit))
    return request<{ items: Transaction[]; next_cursor: string | null }>(`/accounts/${id}/statement?${q.toString()}`)
  },
  balanceHistory: (id: string, days = 30) =>
    request<BalancePoint[]>(`/accounts/${id}/balance-history?days=${days}`),
  spendingBreakdown: (id: string, days = 30) =>
    request<SpendingBreakdown>(`/accounts/${id}/spending?days=${days}`),
  spendingByCategory: (id: string, days = 30) =>
    request<SpendingBreakdown>(`/accounts/${id}/spending-by-category?days=${days}`),
  monthlySpending: (id: string, months = 6) =>
    request<MonthlySpending[]>(`/accounts/${id}/monthly-spending?months=${months}`),
  statementCsvUrl: (id: string) => `/api/v1/accounts/${id}/statement.csv`,
  createAccount: (account_type: string) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify({ account_type }) }),
  lookupAccount: (account_number: string) =>
    request<{ account_id: string; account_type: string; holder: string }>(`/accounts/lookup?account_number=${encodeURIComponent(account_number)}`),
  lookupByEmail: (email: string) =>
    request<{ account_id: string; account_type: string; account_number: string; holder: string }>(`/accounts/lookup-email?email=${encodeURIComponent(email)}`),

  // payees (saved contacts)
  listPayees: () => request<Payee[]>('/payees'),
  createPayee: (target_account_id: string, nickname?: string | null) =>
    request<{ id: string; target_account_id: string }>('/payees', { method: 'POST', body: JSON.stringify({ target_account_id, nickname: nickname ?? null }) }),
  updatePayee: (id: string, nickname: string | null) =>
    request<{ id: string; nickname: string | null }>(`/payees/${id}`, { method: 'PATCH', body: JSON.stringify({ nickname }) }),
  deletePayee: (id: string) =>
    request<{ deleted: boolean }>(`/payees/${id}`, { method: 'DELETE' }),

  // scheduled transfers
  listScheduled: () => request<ScheduledTransfer[]>('/scheduled-transfers'),
  createScheduled: (body: { source_account_id: string; destination_account_id: string; amount: number; frequency: 'once' | 'weekly' | 'monthly'; start_at: string; note?: string | null }) =>
    request<ScheduledTransfer>('/scheduled-transfers', { method: 'POST', body: JSON.stringify(body) }),
  updateScheduled: (id: string, body: { status?: 'active' | 'paused' | 'completed' | 'failed'; note?: string | null }) =>
    request<ScheduledTransfer>(`/scheduled-transfers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteScheduled: (id: string) =>
    request<{ deleted: boolean }>(`/scheduled-transfers/${id}`, { method: 'DELETE' }),

  // transactions
  transfer: (source_account_id: string, destination_account_id: string, amount: number, category?: string, note?: string) =>
    request<Transaction>('/transactions', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify({ source_account_id, destination_account_id, amount, category: category || null, note: note || null }) }),
  getTransaction: (id: string) => request<Transaction>(`/transactions/${id}`),
  recentActivity: (limit = 10, filters?: { category?: string; recipient_account_id?: string; direction?: 'debit' | 'credit' }) => {
    const q = new URLSearchParams()
    q.set('limit', String(limit))
    if (filters?.category) q.set('category', filters.category)
    if (filters?.recipient_account_id) q.set('recipient_account_id', filters.recipient_account_id)
    if (filters?.direction) q.set('direction', filters.direction)
    return request<RecentActivityItem[]>(`/transactions/recent?${q.toString()}`)
  },
  statementPdfUrl: (id: string) => `/api/v1/accounts/${id}/statement.pdf`,

  // payments
  topup: (account_id: string, amount: number) =>
    request<Payment>('/payments/topup', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify({ account_id, amount }) }),
  getPayment: (id: string) => request<Payment>(`/payments/${id}`),

  // admin fraud
  listFraudFlags: (status?: string) =>
    request<FraudFlag[]>(`/admin/fraud-flags${status ? `?status=${status}` : ''}`),
  reviewFraudFlag: (id: string, decision: 'reviewed' | 'dismissed') =>
    request<FraudFlag>(`/admin/fraud-flags/${id}/review`, { method: 'POST', body: JSON.stringify({ decision }) }),

  // admin kyc
  listKycDocuments: (status?: string) =>
    request<KycDocumentItem[]>(`/admin/kyc-documents${status ? `?status=${status}` : ''}`),
  getKycFile,
  reviewKycDocument: (id: string, decision: 'approved' | 'rejected') =>
    request<{ status: string }>(`/kyc/documents/${id}/review`, { method: 'POST', body: JSON.stringify({ decision }) }),

  // admin accounts (freeze/close)
  listAllAccountsAdmin: () => request<AdminAccount[]>('/admin/accounts'),
  setAccountStatusAdmin: (id: string, status: 'active' | 'frozen' | 'closed') =>
    request<Account>(`/admin/accounts/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  // notifications
  listNotifications: (unreadOnly = false) =>
    request<NotificationItem[]>(`/notifications${unreadOnly ? '?unread=true' : ''}`),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request<{ updated: number }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request<{ updated: number }>('/notifications/read-all', { method: 'POST' }),

  // system
  health: () => request<{ status: string; db?: string; events?: { pending: number; processed: number; failed: number } }>('/health'),
  selftest: () => request<{ total: number; passed: number; failed: number; results: { name: string; pass: boolean; detail?: string }[] }>('/selftest'),
}

export interface Account {
  id: string
  user_id: string
  account_number: string
  account_type: string
  balance: string
  status: string
  created_at: string
}
export interface Transaction {
  id: string
  source_account_id: string
  destination_account_id: string
  amount: string
  status: string
  saga_state?: string
  created_at: string
}
export interface Payment {
  id: string
  account_id: string
  amount: string
  direction: string
  provider_ref: string | null
  status: string
  created_at: string
}
export interface FraudFlag {
  id: string
  transaction_id: string | null
  payment_id: string | null
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  reason: string
  reviewed_status: string
  created_at: string
}
export interface RecentActivityItem {
  id: string
  kind: 'transfer' | 'topup'
  direction: 'debit' | 'credit'
  amount: string
  account_id: string
  counterparty_account_number: string | null
  provider_ref: string | null
  status: string
  category: string | null
  note: string | null
  created_at: string
}
export interface NotificationItem {
  id: string
  channel: string
  event_type: string
  status: string
  message: string | null
  is_read: boolean
  created_at: string
}
export interface BalancePoint {
  date: string
  balance: number
}
export interface SpendingItem {
  category: string
  amount: number
  count: number
}
export interface SpendingBreakdown {
  days: number
  total: number
  items: SpendingItem[]
}
export interface MonthlySpending {
  month: string
  total: number
  categories: Array<{ category: string; amount: number }>
}
export interface KycDocumentItem {
  id: string
  user_id: string
  user_email: string
  user_name: string
  doc_type: string
  s3_key: string
  status: string
  submitted_at: string
  reviewed_at: string | null
}
export interface Payee {
  id: string
  target_account_id: string
  nickname: string | null
  account_number: string
  account_type: string
  holder_name: string
  created_at: string
}
export interface ScheduledTransfer {
  id: string
  source_account_id: string
  source_account_number: string
  destination_account_id: string
  destination_account_number: string
  destination_holder: string | null
  amount: string
  frequency: 'once' | 'weekly' | 'monthly'
  next_run_at: string
  last_run_at: string | null
  status: 'active' | 'paused' | 'completed' | 'failed'
  note: string | null
  created_at: string
}
export interface AdminAccount extends Account {
  owner_email: string
  owner_name: string
}
