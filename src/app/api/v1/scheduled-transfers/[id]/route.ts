// PATCH /api/v1/scheduled-transfers/:id (user, owner) | DELETE /api/v1/scheduled-transfers/:id
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { Errors } from '@/lib/errors'
import { updateScheduledSchema } from '@/modules/scheduled/validators'
import * as scheduledService from '@/modules/scheduled/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const body = await validateBody(req, updateScheduledSchema)
    const r = await scheduledService.updateScheduled(ctx.user.id, id, body)
    return ok(r, 200)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const r = await scheduledService.deleteScheduled(ctx.user.id, id)
    if (!r.deleted) throw Errors.notFound()
    return ok(r, 200)
  })
}
