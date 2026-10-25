// GET /api/v1/accounts/:id/monthly-spending?months=6 (owner) — per-month spending totals.
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as accountsService from '@/modules/accounts/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const url = new URL(req.url)
  const monthsRaw = url.searchParams.get('months')
  const months = monthsRaw ? parseInt(monthsRaw, 10) : 6
  return withUser(req, async (ctx) => {
    const data = await accountsService.getMonthlySpending(ctx.user.id, id, Number.isNaN(months) ? 6 : months)
    return ok(data, 200)
  })
}
