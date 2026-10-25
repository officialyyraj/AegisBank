// GET /api/v1/transactions/recent?limit=10&category=Groceries&recipient_account_id=...&direction=debit (user)
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as txnService from '@/modules/transactions/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const url = new URL(req.url)
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? parseInt(limitRaw, 10) : 10
    const category = url.searchParams.get('category') || undefined
    const recipientAccountId = url.searchParams.get('recipient_account_id') || undefined
    const directionRaw = url.searchParams.get('direction')
    const direction = directionRaw === 'debit' || directionRaw === 'credit' ? directionRaw : undefined
    const list = await txnService.recentActivity(
      ctx.user.id,
      Number.isNaN(limit) ? 10 : limit,
      { category, recipientAccountId, direction },
    )
    return ok(list, 200)
  })
}
