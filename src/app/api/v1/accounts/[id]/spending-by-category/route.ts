// GET /api/v1/accounts/:id/spending-by-category?days=30 (owner) — spending by merchant category.
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
  const daysRaw = url.searchParams.get('days')
  const days = daysRaw ? parseInt(daysRaw, 10) : 30
  return withUser(req, async (ctx) => {
    const breakdown = await accountsService.getSpendingByCategory(ctx.user.id, id, Number.isNaN(days) ? 30 : days)
    return ok(breakdown, 200)
  })
}
