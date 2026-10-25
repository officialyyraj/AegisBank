// src/modules/auth/service.ts — register/login/refresh business logic (requirements.
import { authRepository } from './repository'
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ACCESS_TTL,
} from '@/lib/auth'
import { Errors } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

const MAX_FAILED_LOGINS = 5
const LOCKOUT_MS = 15 * 60 * 1000

/** Register a new customer. Admins are seeded/created via direct DB (requirements step 12). */
export async function register(input: { email: string; password: string; full_name: string }) {
  const existing = await authRepository.findByEmail(input.email)
  if (existing) throw Errors.conflict('Email already registered')
  const passwordHash = await hashPassword(input.password)
  try {
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      fullName: input.full_name,
      role: 'customer',
      kycStatus: 'pending',
    })
    logger.info('auth.register.success', { userId: user.id })
    return { user_id: user.id }
  } catch (e) {
    // race: created between our check & insert
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw Errors.conflict('Email already registered')
    }
    throw e
  }
}

/** Verify credentials and issue access + refresh tokens. */
export async function login(input: { email: string; password: string }) {
  const user = await authRepository.findByEmail(input.email)
  if (!user) {
    throw Errors.unauthorized('Invalid credentials')
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw Errors.unauthorized('Too many failed attempts. Try again later.')
  }
  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts >= MAX_FAILED_LOGINS ? 0 : attempts,
        lockedUntil: attempts >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    })
    throw Errors.unauthorized('Invalid credentials')
  }
  await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } })
  const { token: access_token, expiresIn } = signAccessToken({ id: user.id, email: user.email, role: user.role })
  const refresh_token = signRefreshToken({ id: user.id, email: user.email, role: user.role })
  const refresh = verifyRefreshToken(refresh_token)
  await db.refreshToken.create({ data: { userId: user.id, jti: refresh.jti!, expiresAt: new Date((refresh.exp || 0) * 1000) } })
  logger.info('auth.login.success', { userId: user.id, role: user.role })
  return { access_token, refresh_token, expires_in: expiresIn }
}

/**
 * Verify a refresh token and issue a fresh access token + a NEW refresh token
 * (rotation). The old refresh token's JTI is consumed in the database so it
 * cannot be reused after a restart or across multiple application instances.
 */
export async function refresh(refresh_token: string) {
  const decoded = verifyRefreshToken(refresh_token)
  if (!decoded.jti) throw Errors.unauthorized('Invalid refresh token')
  const consumed = await db.refreshToken.updateMany({
    where: { jti: decoded.jti, userId: decoded.sub, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  })
  if (consumed.count !== 1) throw Errors.unauthorized('Refresh token already used or revoked')
  const user = await authRepository.findById(decoded.sub)
  if (!user) throw Errors.unauthorized('User no longer exists')
  const { token: access_token, expiresIn } = signAccessToken({ id: user.id, email: user.email, role: user.role })
  const new_refresh_token = signRefreshToken({ id: user.id, email: user.email, role: user.role })
  const newRefresh = verifyRefreshToken(new_refresh_token)
  await db.refreshToken.create({ data: { userId: user.id, jti: newRefresh.jti!, expiresAt: new Date((newRefresh.exp || 0) * 1000) } })
  logger.info('auth.refresh.rotated', { userId: user.id })
  return { access_token, refresh_token: new_refresh_token, expires_in: expiresIn }
}

/** Resolve full user record for a request (used by protected routes). */
export async function resolveUser(id: string) {
  const user = await authRepository.findById(id)
  if (!user) throw Errors.unauthorized()
  return user
}

// ---- Forgot / reset password ----
const RESET_TTL_MS = 15 * 60 * 1000 // 15 minutes

async function sha256(s: string): Promise<string> {
  const { createHash } = await import('crypto')
  return createHash('sha256').update(s).digest('hex')
}

/**
 * POST /auth/forgot-password — request a password reset. Always returns 200
 * The token is never returned in the response. During local development it is
 * logged to the server console so the flow can be completed without email.
 */
export async function forgotPassword(email: string) {
  const user = await authRepository.findByEmail(email)
  if (!user) {
    logger.info('auth.forgot.no-user', { email: '(redacted)' })
    return { requested: true }
  }
  // Generate a random token (32 bytes hex). Store only its hash.
  const { randomBytes } = await import('crypto')
  const token = randomBytes(32).toString('hex')
  const tokenHash = await sha256(token)
  await db.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  })
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[password-reset] token for ${user.email}: ${token}`)
  }
  logger.info('auth.forgot.issued', { userId: user.id })
  return { requested: true }
}

/** Revoke every refresh token issued to the user. */
export async function revokeAllRefreshTokens(userId: string) {
  await db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
  return { revoked: true }
}

/**
 * POST /auth/reset-password — verify the reset token + set a new password.
 * Token must be valid, unexpired, unconsumed. Single-use (consumedAt set).
 */
export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = await sha256(token)
  const reset = await db.passwordReset.findUnique({ where: { tokenHash } })
  if (!reset) throw Errors.badRequest('Invalid or unknown reset token')
  if (reset.consumedAt) throw Errors.badRequest('Reset token already used')
  if (reset.expiresAt.getTime() < Date.now()) throw Errors.badRequest('Reset token expired')
  const user = await authRepository.findById(reset.userId)
  if (!user) throw Errors.badRequest('User no longer exists')
  const passwordHash = await hashPassword(newPassword)
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.passwordReset.update({ where: { id: reset.id }, data: { consumedAt: new Date() } }),
  ])
  logger.info('auth.reset.success', { userId: user.id })
  return { reset: true }
}

export { ACCESS_TTL }
