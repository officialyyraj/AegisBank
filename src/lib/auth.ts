// Authentication helpers for access and refresh tokens.
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { Errors, ApiError } from '@/lib/errors'
import { logger } from '@/lib/logger'

function requiredSecret(name: string): string {
  const value = process.env[name]
  if (process.env.NODE_ENV !== 'test' && (!value || value.length < 32)) {
    throw new Error(`${name} must be set and at least 32 characters long`)
  }
  return value || 'test-secret-only'
}
const ACCESS_SECRET = requiredSecret('JWT_ACCESS_SECRET')
const REFRESH_SECRET = requiredSecret('JWT_REFRESH_SECRET')
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || 900)
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL || 604800)

export interface JwtUser {
  sub: string // user id
  email: string
  role: 'customer' | 'admin'
  type: 'access' | 'refresh'
  jti?: string
  exp?: number
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signAccessToken(user: { id: string; email: string; role: string }): { token: string; expiresIn: number } {
  const payload: JwtUser = { sub: user.id, email: user.email, role: user.role as 'customer' | 'admin', type: 'access' }
  const token = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL, algorithm: 'HS256' })
  return { token, expiresIn: ACCESS_TTL }
}

export function signRefreshToken(user: { id: string; email: string; role: string }): string {
  const jti = randomBytes(16).toString('hex')
  const payload: JwtUser = { sub: user.id, email: user.email, role: user.role as 'customer' | 'admin', type: 'refresh', jti }
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL, algorithm: 'HS256' })
}

export function verifyAccessToken(token: string): JwtUser {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as JwtUser
    if (decoded.type !== 'access') throw Errors.unauthorized('Wrong token type')
    return decoded
  } catch {
    throw Errors.unauthorized('Invalid or expired access token')
  }
}

export function verifyRefreshToken(token: string): JwtUser {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as JwtUser
    if (decoded.type !== 'refresh') throw Errors.unauthorized('Wrong token type')
    return decoded
  } catch {
    throw Errors.unauthorized('Invalid or expired refresh token')
  }
}

/**
 * Resolve the authenticated user from an Authorization: Bearer header.
 * Throws ApiError(401) if missing/invalid. Returns { id, email, role }.
 */
export async function requireAuthFromRequest(req: Request): Promise<{ id: string; email: string; role: 'customer' | 'admin' }> {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) throw Errors.unauthorized('Missing bearer token')
  const decoded = verifyAccessToken(match[1])
  // Confirm the user still exists (token revocation by user deletion)
  const user = await db.user.findUnique({ where: { id: decoded.sub }, select: { id: true, email: true, role: true } })
  if (!user) throw Errors.unauthorized('User no longer exists')
  return { id: user.id, email: user.email, role: user.role as 'customer' | 'admin' }
}

/** Require the caller to be an admin. Must be called after requireAuthFromRequest. */
export function requireRole(role: 'customer' | 'admin', required: 'admin') {
  if (required === 'admin' && role !== 'admin') throw Errors.forbidden('Admin role required')
}

/** Read & resolve device fingerprint from request headers (requirements  R3). */
export function deviceFingerprintFromRequest(req: Request): string {
  const ua = req.headers.get('user-agent') || 'unknown-ua'
  const al = req.headers.get('accept-language') || 'unknown-al'
  // ip prefix: use x-forwarded-for first hop, else x-real-ip, else 'local'
  const xff = process.env.TRUST_PROXY === 'true' ? req.headers.get('x-forwarded-for') : null
  const xri = req.headers.get('x-real-ip')
  const ip = (xff ? xff.split(',')[0]!.trim() : xri) || 'local'
  // hash so we don't store raw UA/PII
  // simple non-crypto hash is fine for a fingerprint key
  const raw = `${ua}|${al}|${ip}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0
  return `fp_${(h >>> 0).toString(16)}`
}

export { ACCESS_TTL, REFRESH_TTL, logger }
