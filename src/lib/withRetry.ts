// src/lib/withRetry.ts — retry wrapper for transient Prisma/SQLite errors.
//
// SQLite (and the Prisma driver) can throw SQLITE_BUSY / socket-timeout under
// concurrent writes — e.g. the outbox poller + a transfer request competing
// for the single writer. This wraps any async function and retries with
// exponential backoff on transient errors. Design note.
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

const TRANSIENT_CODES = new Set([
  'P2024', // TimedOut fetching a connection from the pool
  'P2028', // Transaction API error (e.g. closed)
  'P2034', // Transaction write conflict
])
const TRANSIENT_SQLITE = ['SQLITE_BUSY', 'Socket timeout', 'database is locked', 'Transaction already closed']

function isTransient(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && TRANSIENT_CODES.has(err.code)) return true
  const msg = err instanceof Error ? err.message : String(err)
  return TRANSIENT_SQLITE.some((s) => msg.includes(s))
}

/**
 * Run `fn` with retry-on-transient-error. `fn` is typically `() => db.$transaction(...)`.
 * Retries up to `maxRetries` times with exponential backoff (50ms, 100ms, 200ms…).
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: { maxRetries?: number; baseDelayMs?: number; op?: string } = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3
  const baseDelayMs = opts.baseDelayMs ?? 50
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === maxRetries || !isTransient(err)) throw err
      const delay = baseDelayMs * Math.pow(2, attempt)
      logger.warn('retry.transient', { attempt: attempt + 1, maxRetries, delay, op: opts.op, err: String(err).slice(0, 120) })
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
