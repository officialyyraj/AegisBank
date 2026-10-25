// src/modules/eventbus/registerHandlers.ts — wire event consumers once at boot.
// requirements : fraud subscribes to transaction.created + payment.completed;
// notifications subscribes to transaction.created, fraud.flagged, kyc.status_changed.
import { registerHandler } from './outbox'
import { onTransactionCreated, onPaymentCompleted } from '@/modules/fraud/service'
import {
  onTransactionCreated as notifOnTx,
  onFraudFlagged as notifOnFraud,
  onKycStatusChanged as notifOnKyc,
  onLowBalance as notifOnLowBalance,
} from '@/modules/notifications/service'
import { logger } from '@/lib/logger'

let wired = false

export function registerAllHandlers(): void {
  if (wired) return
  wired = true
  // Fraud consumers
  registerHandler('transaction.created', onTransactionCreated)
  registerHandler('payment.completed', onPaymentCompleted)
  // Notification consumers
  registerHandler('transaction.created', notifOnTx)
  registerHandler('fraud.flagged', notifOnFraud)
  registerHandler('kyc.status_changed', notifOnKyc)
  registerHandler('low.balance', notifOnLowBalance)
  logger.info('eventbus.handlers.wired')
}
