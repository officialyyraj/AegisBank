// GET /api/v1/accounts/:id (owner) | GET /api/v1/accounts/:id/statement?from=&to=
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { Errors } from '@/lib/errors'
import * as accountsService from '@/modules/accounts/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const url = new URL(req.url)
  if (url.pathname.endsWith('/statement')) {
    // handled by the statement sub-route; fallthrough shouldn't happen
    throw Errors.notFound()
  }
  return withUser(req, async (ctx) => {
    const account = await accountsService.getAccount(ctx.user.id, id)
    return ok(account, 200)
  })
}
