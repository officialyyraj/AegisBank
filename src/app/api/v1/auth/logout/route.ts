import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as authService from '@/modules/auth/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function POST(req: NextRequest) {
  return withUser(req, async (ctx) => ok(await authService.revokeAllRefreshTokens(ctx.user.id)))
}
