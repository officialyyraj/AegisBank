// POST /api/v1/accounts (user, KYC approved) | GET /api/v1/accounts (user)
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { createAccountSchema } from '@/modules/accounts/validators'
import * as accountsService from '@/modules/accounts/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function POST(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const body = await validateBody(req, createAccountSchema)
    const accountType = (body as { account_type?: string })?.account_type ?? 'savings'
    const account = await accountsService.createAccount(ctx.user.id, accountType)
    return ok(account, 201)
  })
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const list = await accountsService.listAccounts(ctx.user.id)
    return ok(list, 200)
  })
}
