// src/lib/http.ts — thin helpers over Next.js Route Handlers: zod validation,
// error envelope, in-memory rate limiter (requirements : 100 req/min/IP), CORS,
// security headers (Design note).
import { NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'
import { ApiError, Errors, toErrorResponse } from '@/lib/errors'
import { logger } from '@/lib/logger'

// Design note: standard security headers on every API response (requirements : CSP).
// Note: in the sandbox (HTTP dev) these are advisory; in production the ALB
// enforces HTTPS + these headers are served over TLS.
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'self'",
} as const

export const JSON_HEADERS = { 'Content-Type': 'application/json', ...SECURITY_HEADERS } as const

export function ok<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: JSON_HEADERS })
}

export function errResponse(err: unknown) {
  const { status, body } = toErrorResponse(err)
  if (status >= 500) logger.error('Unhandled error', { err: String(err) })
  return NextResponse.json(body, { status, headers: JSON_HEADERS })
}

/** Validate a JSON request body against a Zod schema; throw ApiError(400) on failure. */
export async function validateBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw Errors.badRequest('Invalid JSON body')
  }
  try {
    return schema.parse(raw)
  } catch (e) {
    if (e instanceof ZodError) {
      throw new ApiError('VALIDATION_ERROR', 'Request validation failed', 400, e.issues)
    }
    throw e
  }
}

/** In-memory per-IP rate limiter (requirements : 100 req/min/IP at gateway).
 *  Production note: replace with ElastiCache/ALB-level limit; in-process is
 *  sufficient for single-task demo. */
const buckets = new Map<string, { count: number; windowStart: number }>()
const authBuckets = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 60_000
const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE || 100)
const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE || 10)

export function rateLimit(ip: string): void {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || now - b.windowStart > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now })
    return
  }
  b.count++
  if (b.count > LIMIT) {
    throw Errors.rateLimited()
  }
}

/** Stricter rate limit for auth endpoints (register/login/forgot-password).
 *  Design note: 10/min/IP to slow credential stuffing + enumeration. Uses a
 *  separate bucket so the global limit doesn't mask auth-specific abuse. */
export function authRateLimit(key: string): void {
  const now = Date.now()
  const b = authBuckets.get(key)
  if (!b || now - b.windowStart > WINDOW_MS) {
    authBuckets.set(key, { count: 1, windowStart: now })
    return
  }
  b.count++
  if (b.count > AUTH_LIMIT) {
    throw Errors.rateLimited()
  }
}

/** Extract a client IP (best-effort) for rate limiting & device fingerprint. */
export function clientIp(req: Request): string {
  const xff = process.env.TRUST_PROXY === 'true' ? req.headers.get('x-forwarded-for') : null
  if (xff) return xff.split(',')[0]!.trim()
  return process.env.TRUST_PROXY === 'true' ? (req.headers.get('x-real-ip') || 'local') : 'local'
}

/** Same-origin by default; cross-origin access requires an explicit allowlist. */
export function corsHeaders(req: Request): Record<string, string> {
  const configured = (process.env.CORS_ORIGIN || '').split(',').map((v) => v.trim()).filter(Boolean)
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Vary': 'Origin',
  }
  if (origin && configured.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function handleOptions(req: Request) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
  }
  return null
}
