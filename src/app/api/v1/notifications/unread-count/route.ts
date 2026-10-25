// GET /api/v1/notifications/unread-count (user) — { count } for the header bell.
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as notifService from '@/modules/notifications/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const count = await notifService.unreadCount(ctx.user.id)
    return ok({ count }, 200)
  })
}
