// GET /api/v1/transactions/:id (owner party)
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as txnService from '@/modules/transactions/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const txn = await txnService.getTransaction(ctx.user.id, id)
    return ok(txn, 200)
  })
}
