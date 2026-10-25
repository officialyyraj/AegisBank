// GET /api/v1/admin/accounts (admin) — list all accounts across all users.
import { NextRequest } from 'next/server'
import { withAdmin, handleOptions, ok } from '@/lib/guard'
import * as accountsService from '@/modules/accounts/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withAdmin(req, async () => {
    const list = await accountsService.listAllAccountsAdmin()
    return ok(list, 200)
  })
}
