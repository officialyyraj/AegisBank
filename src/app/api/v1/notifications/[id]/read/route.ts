// POST /api/v1/notifications/:id/read (user, owner) — mark one as read.
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as notifService from '@/modules/notifications/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const r = await notifService.markRead(ctx.user.id, id)
    return ok(r, 200)
  })
}
