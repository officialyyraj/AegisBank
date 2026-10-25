// GET /api/v1/admin/kyc-documents?status=pending (admin) — KYC review queue.
import { NextRequest } from 'next/server'
import { withAdmin, handleOptions, ok } from '@/lib/guard'
import * as kycService from '@/modules/kyc/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withAdmin(req, async () => {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || undefined
    const list = await kycService.listKycDocumentsForAdmin(status)
    return ok(list, 200)
  })
}
