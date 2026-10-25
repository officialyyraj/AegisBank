// GET /api/v1/accounts/:id/statement?from=&to=&direction=&search=&cursor=&limit= (owner)
// Cursor pagination: if `cursor` or `limit` is present, returns {items, next_cursor}.
// Without cursor/limit: returns the full array (backward compat for CSV/PDF export paths).
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
  const fromRaw = url.searchParams.get('from')
  const toRaw = url.searchParams.get('to')
  const directionRaw = url.searchParams.get('direction')
  const search = url.searchParams.get('search') || undefined
  const cursor = url.searchParams.get('cursor') || undefined
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined
  let from: Date | undefined
  let to: Date | undefined
  try {
    if (fromRaw) from = new Date(fromRaw)
    if (toRaw) to = new Date(toRaw)
  } catch {
    throw Errors.badRequest('Invalid date range')
  }
  if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
    throw Errors.badRequest('Invalid date range')
  }
  const direction = directionRaw === 'debit' || directionRaw === 'credit' ? directionRaw : undefined
  return withUser(req, async (ctx) => {
    // If cursor or limit is present, use the paginated path (Design note).
    // Otherwise return the full array (backward compat — CSV/PDF export).
    if (cursor || limit !== undefined) {
      const result = await accountsService.getStatementPaginated(ctx.user.id, id, {
        from, to, direction, search, cursor, limit: Number.isNaN(limit as number) ? undefined : limit,
      })
      return ok(result, 200)
    }
    const stmt = await accountsService.getStatement(ctx.user.id, id, from, to, direction, search)
    return ok(stmt, 200)
  })
}
