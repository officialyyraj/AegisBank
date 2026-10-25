// src/lib/logger.ts — structured JSON logs (requirements : no secrets/PII in logs).
// In production these flow to CloudWatch Logs (requirements).

type Level = 'info' | 'warn' | 'error' | 'debug'

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function emit(level: Level, message: string, meta: Record<string, unknown> = {}) {
  const threshold = LEVELS[(process.env.NODE_ENV === 'production' ? 'info' : 'debug') as Level] ?? 20
  if (LEVELS[level] < threshold) return
  const line = JSON.stringify({
    level,
    message,
    ts: new Date().toISOString(),
    ...meta,
  })
  console[level === 'debug' ? 'log' : level](line)
}

export const logger = {
  info: (m: string, meta?: Record<string, unknown>) => emit('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => emit('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => emit('error', m, meta),
  debug: (m: string, meta?: Record<string, unknown>) => emit('debug', m, meta),
}

/** Mask an account number for logs: ****1234 */
export function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return '****'
  return '****' + acc.slice(-4)
}
