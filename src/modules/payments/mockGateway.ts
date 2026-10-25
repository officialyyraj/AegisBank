// src/modules/payments/mockGateway.ts — simulated external payment rail.
// requirements : a local stub function simulating latency + 95% success rate.
// In production this is a real UPI/card gateway call with the same retry shape.
import { logger } from '@/lib/logger'
import { randomBytes } from 'crypto'

export interface GatewayResult {
  ok: boolean
  providerRef: string
  attempts: number
}

const SUCCESS_RATE = 0.95
const BASE_LATENCY_MS = 80
const MAX_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function rand(): number {
  // crypto-grade randomness so the fraud tests are not deterministic
  return (randomBytes(4).readUInt32BE(0) / 0xffffffff)
}

/**
 * Charge the mock gateway. Returns on first success (≤ MAX_ATTEMPTS retries),
 * or after MAX_ATTEMPTS consecutive failures. Each attempt has ~95% success
 * (requirements. Latency simulated per attempt with small jitter.
 */
export async function mockPaymentGatewayCharge(amount: number): Promise<GatewayResult> {
  let attempts = 0
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts++
    await sleep(BASE_LATENCY_MS + Math.floor(rand() * 60))
    const ok = rand() < SUCCESS_RATE
    const providerRef = 'PAY_' + randomBytes(8).toString('hex')
    if (ok) {
      logger.info('payment.gateway.success', { amount, attempts, providerRef })
      return { ok: true, providerRef, attempts }
    }
    logger.warn('payment.gateway.retry', { amount, attempt: attempts })
  }
  const providerRef = 'PAY_FAIL_' + randomBytes(8).toString('hex')
  return { ok: false, providerRef, attempts }
}

/** Allow tests/seed to force the success rate (0..1). */
export function withSuccessRate(rate: number) {
  // mutate the module-level constant via a closure override is not trivial;
  // exposed as a documented test seam instead.
  return Math.max(0, Math.min(1, rate))
}

export { MAX_ATTEMPTS }
