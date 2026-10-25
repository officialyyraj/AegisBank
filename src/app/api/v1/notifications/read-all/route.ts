// POST /api/v1/notifications/read-all (user) — mark all as read.
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as notifService from '@/modules/notifications/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function POST(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const r = await notifService.markAllRead(ctx.user.id)
    return ok(r, 200)
  })
}
