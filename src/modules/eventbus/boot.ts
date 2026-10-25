// src/modules/eventbus/boot.ts — idempotent lazy boot for the event bus + workers.
// Normally started by src/instrumentation.ts at server boot; this is a
// safety net so handlers are registered + pollers started even if the
// instrumentation hook is skipped (e.g. edge warm-up path).
import { registerAllHandlers } from './registerHandlers'
import { startPoller } from './outbox'
import { logger } from '@/lib/logger'

let booted = false
let scheduledHandle: ReturnType<typeof setInterval> | null = null

export function ensureBooted(): void {
  if (booted) return
  try {
    registerAllHandlers()
    startPoller()
    startScheduledTransferWorker()
    booted = true
  } catch {
    // ignore — instrumentation will retry
  }
}

/** Start the scheduled-transfer worker (every 60s). Design note. */
function startScheduledTransferWorker(): void {
  if (scheduledHandle) return
  // dynamic import to avoid a circular dependency at module-load time
  import('@/modules/scheduled/service').then(({ runDueScheduledTransfers }) => {
    if (scheduledHandle) return
    scheduledHandle = setInterval(() => {
      runDueScheduledTransfers().catch((e) => logger.error('scheduled.worker.error', { err: String(e) }))
    }, 60_000)
    if (typeof scheduledHandle.unref === 'function') scheduledHandle.unref()
    logger.info('scheduled.worker.started', { intervalMs: 60_000 })
  }).catch(() => { /* ignore — will retry on next boot */ })
}
