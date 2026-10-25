// PATCH /api/v1/payees/:id (user, owner) | DELETE /api/v1/payees/:id (user, owner)
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { Errors } from '@/lib/errors'
import { updatePayeeSchema } from '@/modules/payees/validators'
import * as payeeService from '@/modules/payees/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const body = await validateBody(req, updatePayeeSchema)
    const r = await payeeService.updatePayee(ctx.user.id, id, body.nickname)
    return ok(r, 200)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const r = await payeeService.deletePayee(ctx.user.id, id)
    if (!r.deleted) throw Errors.notFound('Payee not found')
    return ok(r, 200)
  })
}
