// POST /api/v1/payments/topup (user) — 202 accepted
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { topupSchema } from '@/modules/payments/validators'
import * as paymentsService from '@/modules/payments/service'
import { Errors } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function POST(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const idempotencyKey = req.headers.get('idempotency-key')
    if (!idempotencyKey) throw Errors.badRequest('Idempotency-Key header is required')
    const body = await validateBody(req, topupSchema)
    const payment = await paymentsService.topup(ctx.user.id, body, idempotencyKey)
    return ok(payment, 202)
  })
}
