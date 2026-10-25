// src/modules/notifications/service.ts — event consumer + mock SES sender.
//
// Subscribes to: transaction.created, fraud.flagged, kyc.status_changed
// (requirements. For each event: send(userId, eventType, channel='email') →
// mock SES SendEmailCommand (sandbox = console.log + notifications row). SES
// failure is logged + retried once; never throws out of the handler (requirements.
import { notificationsRepository } from './repository'
import { logger } from '@/lib/logger'

export async function send(
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const message = renderMessage(eventType, payload)
  let status = 'sent'
  try {
    await mockSesSendEmail(userId, eventType, message)
  } catch (e) {
    logger.warn('notification.ses.retry', { userId, eventType, err: String(e) })
    try {
      await mockSesSendEmail(userId, eventType, message)
    } catch (e2) {
      logger.error('notification.ses.failed', { userId, eventType, err: String(e2) })
      status = 'failed'
    }
  }
  await notificationsRepository.create({ userId, channel: 'email', eventType, status, message })
  logger.info('notification.sent', { userId, eventType, status })
}

function renderMessage(eventType: string, p: Record<string, unknown>): string {
  switch (eventType) {
    case 'transaction.created':
      return `A transfer of ${p.amount} was completed. Transaction ID: ${p.transaction_id}`
    case 'payment.completed':
      return `A top-up of ${p.amount} was credited to your account. Payment ref: ${p.provider_ref}`
    case 'payment.failed':
      return `A top-up of ${p.amount} failed after retries. Payment ref: ${p.provider_ref}`
    case 'fraud.flagged':
      return `A fraud flag (${p.severity}) was raised on your activity: ${p.reason}`
    case 'fraud.reviewed':
      return `Your fraud flag was reviewed — decision: ${p.decision}`
    case 'kyc.status_changed':
      return `Your KYC document status is now: ${p.status}`
    case 'low.balance':
      return `Low balance alert: account ${p.account_number} dropped to ${p.balance} (below ₹${p.threshold}). Consider topping up.`
    default:
      return `Event: ${eventType}`
  }
}

/** Mock SES SendEmailCommand. In production this calls the AWS SDK SES client;
 *  in the sandbox it logs to stdout (requirements: no AI; requirements : SES
 *  sandbox mode). The real CDK stack provisions SES for production. */
async function mockSesSendEmail(_userId: string, eventType: string, message: string): Promise<void> {
  const from = process.env.SES_FROM_EMAIL || 'no-reply@example.com'
  console.log(`[SES] from=${from} event=${eventType} :: ${message}`)
}

/** Event-handler registrations (called at app boot from src/lib/registerHandlers). */
export async function onTransactionCreated(payload: unknown): Promise<void> {
  const p = payload as { user_id?: string }
  if (!p?.user_id) return
  await send(p.user_id, 'transaction.created', p as Record<string, unknown>)
}

export async function onFraudFlagged(payload: unknown): Promise<void> {
  const p = payload as { user_id?: string }
  if (!p?.user_id) return
  await send(p.user_id, 'fraud.flagged', p as Record<string, unknown>)
}

export async function onKycStatusChanged(payload: unknown): Promise<void> {
  const p = payload as { user_id?: string }
  if (!p?.user_id) return
  await send(p.user_id, 'kyc.status_changed', p as Record<string, unknown>)
}

/** Event handler for `low.balance` (Design note). */
export async function onLowBalance(payload: unknown): Promise<void> {
  const p = payload as { user_id?: string }
  if (!p?.user_id) return
  await send(p.user_id, 'low.balance', p as Record<string, unknown>)
}

export async function listNotifications(userId: string, unreadOnly = false) {
  const list = await notificationsRepository.findByUser(userId, 50, unreadOnly)
  return list.map((n) => ({
    id: n.id,
    channel: n.channel,
    event_type: n.eventType,
    status: n.status,
    message: n.message,
    is_read: n.isRead,
    created_at: n.createdAt.toISOString(),
  }))
}

export async function unreadCount(userId: string): Promise<number> {
  return notificationsRepository.unreadCount(userId)
}

export async function markRead(userId: string, id: string): Promise<{ updated: number }> {
  const r = await notificationsRepository.markRead(userId, id)
  return { updated: r.count }
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const r = await notificationsRepository.markAllRead(userId)
  return { updated: r.count }
}
