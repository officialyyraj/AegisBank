// GET /api/v1/accounts/lookup-email?email=... (user) — recipient lookup by email.
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { Errors } from '@/lib/errors'
import * as payeeService from '@/modules/payees/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const url = new URL(req.url)
    const email = url.searchParams.get('email')
    if (!email) throw Errors.badRequest('email is required')
    const result = await payeeService.lookupByEmail(ctx.user.id, email)
    return ok(result, 200)
  })
}
