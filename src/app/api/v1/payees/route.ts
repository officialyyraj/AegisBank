// GET /api/v1/payees (user) | POST /api/v1/payees (user)
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { createPayeeSchema } from '@/modules/payees/validators'
import * as payeeService from '@/modules/payees/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const list = await payeeService.listPayees(ctx.user.id)
    return ok(list, 200)
  })
}

export async function POST(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const body = await validateBody(req, createPayeeSchema)
    const r = await payeeService.createPayee(ctx.user.id, body.target_account_id, body.nickname ?? null)
    return ok(r, 201)
  })
}
