// GET /api/v1/notifications (user) — list the caller's notifications. ?unread=true
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as notifService from '@/modules/notifications/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const url = new URL(req.url)
    const unreadOnly = url.searchParams.get('unread') === 'true'
    const list = await notifService.listNotifications(ctx.user.id, unreadOnly)
    return ok(list, 200)
  })
}
