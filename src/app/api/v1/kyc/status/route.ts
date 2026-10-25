// GET /api/v1/kyc/status (user) — { kyc_status }
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import * as kycService from '@/modules/kyc/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const status = await kycService.getStatus(ctx.user.id)
    return ok(status, 200)
  })
}
