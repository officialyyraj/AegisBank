// GET /api/v1/accounts/lookup?account_number=AEG... (user) — recipient lookup for inter-user transfer.
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { Errors } from '@/lib/errors'
import * as accountsService from '@/modules/accounts/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const url = new URL(req.url)
    const accountNumber = url.searchParams.get('account_number')
    if (!accountNumber) throw Errors.badRequest('account_number is required')
    const result = await accountsService.lookupAccount(ctx.user.id, accountNumber)
    return ok(result, 200)
  })
}
