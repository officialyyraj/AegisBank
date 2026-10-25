// src/lib/guard.ts — small wrapper to enforce auth + rate-limit on protected
// routes (requirements : requireAuth on all except /auth/register, /auth/login,
// /auth/refresh, /health). Mirrors Express middleware in a Next.js context.
import { NextRequest } from 'next/server'
import { requireAuthFromRequest, requireRole } from '@/lib/auth'
import { rateLimit, clientIp, errResponse, ok, handleOptions, corsHeaders } from '@/lib/http'
import { ensureBooted } from '@/modules/eventbus/boot'

export interface AuthedContext {
  user: { id: string; email: string; role: 'customer' | 'admin' }
  req: NextRequest
  fingerprint: string
}

/** Run a handler with auth + rate limit. Returns 401/429 on failure. */
export async function withUser(
  req: NextRequest,
  fn: (ctx: AuthedContext) => Promise<Response>,
): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return handleOptions(req) || ok(null, 204)
    ensureBooted()
    rateLimit(clientIp(req))
    const user = await requireAuthFromRequest(req)
    const fingerprint = req.headers.get('x-device-fingerprint') || ''
    return await fn({ user, req, fingerprint })
  } catch (e) {
    return errResponse(e)
  }
}

/** Run a handler requiring admin role. */
export async function withAdmin(
  req: NextRequest,
  fn: (ctx: AuthedContext) => Promise<Response>,
): Promise<Response> {
  return withUser(req, async (ctx) => {
    requireRole(ctx.user.role, 'admin')
    return fn(ctx)
  })
}

/** Re-export for route files that also need OPTIONS + CORS. */
export { handleOptions, ok, corsHeaders }
