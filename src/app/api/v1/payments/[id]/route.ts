// GET /api/v1/payments/:id (owner)
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as paymentsService from '@/modules/payments/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const payment = await paymentsService.getPayment(ctx.user.id, id)
    return ok(payment, 200)
  })
}
