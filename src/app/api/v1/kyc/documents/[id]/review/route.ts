// POST /api/v1/kyc/documents/:id/review (admin) — { decision } -> { status }
import { NextRequest } from 'next/server'
import { withAdmin, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { Errors } from '@/lib/errors'
import { reviewSchema } from '@/modules/kyc/validators'
import * as kycService from '@/modules/kyc/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withAdmin(req, async () => {
    const body = await validateBody(req, reviewSchema)
    const result = await kycService.reviewDocument(id, body.decision)
    if (!result) throw Errors.notFound('KYC document not found')
    return ok(result, 200)
  })
}
