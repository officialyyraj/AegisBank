// src/modules/eventbus/outbox.ts — Postgres-outbox event bus (requirements.
//
// publishEvent() inserts a row into `event_outbox` WITHIN the same DB
// transaction as the domain write that triggered it (critical for atomicity:
// the event is never lost even if the process crashes between commit and
// dispatch). The transaction handle is passed in by the calling service.
//
// pollAndDispatch() runs on a 2s interval (in-process worker — no separate
// service needed at demo scale, per requirements. It selects status='pending'
// rows in creation order, dispatches each to its registered handlers, marks
// 'processed' on success or increments attempts / marks 'failed' after 5.
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/withRetry'
import type { Prisma } from '@prisma/client'

export type EventHandler = (payload: unknown, eventId: string) => Promise<void>

const handlers = new Map<string, EventHandler[]>()
const MAX_ATTEMPTS = 5
const POLL_INTERVAL_MS = 2000
const BATCH_SIZE = 50

let pollerHandle: ReturnType<typeof setInterval> | null = null
let pollInFlight = false

/** Publish (enqueue) an event inside an existing Prisma transaction. */
export async function publishEvent(
  tx: Prisma.TransactionClient,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const created = await tx.eventOutbox.create({
    data: { eventType, payload: JSON.stringify(payload) },
    select: { id: true },
  })
  logger.debug('event.published', { eventType, eventId: created.id })
  return created.id
}

/** Publish outside an explicit tx (own short transaction). */
export async function publishEventStandalone(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<string> {
  return db.$transaction(async (tx) => publishEvent(tx, eventType, payload))
}

/** Register a consumer for an event type. Multiple consumers per type allowed. */
export function registerHandler(eventType: string, handler: EventHandler): void {
  const list = handlers.get(eventType) || []
  list.push(handler)
  handlers.set(eventType, list)
  logger.info('event.handler.registered', { eventType, count: list.length })
}

/** Process one outbox row: dispatch to all registered handlers (fail if any throws). */
async function dispatchOne(row: { id: string; eventType: string; payload: string; attempts: number }): Promise<boolean> {
  const list = handlers.get(row.eventType)
  if (!list || list.length === 0) {
    // No handler → mark processed so it doesn't retry forever (still logged for replay).
    logger.debug('event.no-handler', { eventType: row.eventType, id: row.id })
    return true
  }
  let payload: unknown
  try {
    payload = JSON.parse(row.payload)
  } catch {
    logger.error('event.bad-payload', { id: row.id, eventType: row.eventType })
    return false
  }
  for (const h of list) {
    try {
      await h(payload, row.id)
    } catch (e) {
      logger.error('event.handler.threw', { eventType: row.eventType, id: row.id, err: String(e) })
      return false
    }
  }
  return true
}

/** Poll pending rows and dispatch. Safe to call repeatedly. */
export async function pollAndDispatch(): Promise<number> {
  if (pollInFlight) return 0
  pollInFlight = true
  let processed = 0
  try {
    const pending = await db.eventOutbox.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    })
    for (const row of pending) {
      const ok = await dispatchOne({
        id: row.id,
        eventType: row.eventType,
        payload: row.payload,
        attempts: row.attempts,
      })
      if (ok) {
        await withRetry(() => db.eventOutbox.update({
          where: { id: row.id },
          data: { status: 'processed', processedAt: new Date() },
        }), { op: 'outbox.markProcessed' })
        processed++
      } else {
        const attempts = row.attempts + 1
        if (attempts >= MAX_ATTEMPTS) {
          await withRetry(() => db.eventOutbox.update({
            where: { id: row.id },
            data: { status: 'failed', attempts },
          }), { op: 'outbox.markFailed' })
          logger.warn('event.failed.exhausted', { id: row.id, eventType: row.eventType, attempts })
        } else {
          await withRetry(() => db.eventOutbox.update({
            where: { id: row.id },
            data: { attempts },
          }), { op: 'outbox.incrementAttempts' })
          // simple linear backoff: leave pending; next poll retries
        }
      }
    }
  } catch (e) {
    logger.error('event.poller.error', { err: String(e) })
  } finally {
    pollInFlight = false
  }
  if (processed > 0) logger.debug('event.poller.processed', { count: processed })
  return processed
}

/** Start the in-process poller (idempotent). Called once at app boot. */
export function startPoller(): void {
  if (pollerHandle) return
  pollerHandle = setInterval(() => {
    void pollAndDispatch()
  }, POLL_INTERVAL_MS)
  if (typeof pollerHandle.unref === 'function') pollerHandle.unref()
  logger.info('event.poller.started', { intervalMs: POLL_INTERVAL_MS })
}

export function stopPoller(): void {
  if (pollerHandle) {
    clearInterval(pollerHandle)
    pollerHandle = null
    logger.info('event.poller.stopped')
  }
}

/** Outbox stats for admin/observability. */
export async function outboxStats(): Promise<{ pending: number; processed: number; failed: number }> {
  const [pending, processed, failed] = await Promise.all([
    db.eventOutbox.count({ where: { status: 'pending' } }),
    db.eventOutbox.count({ where: { status: 'processed' } }),
    db.eventOutbox.count({ where: { status: 'failed' } }),
  ])
  return { pending, processed, failed }
}
