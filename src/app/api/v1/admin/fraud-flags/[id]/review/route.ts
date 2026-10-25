// POST /api/v1/admin/fraud-flags/:id/review (admin) — { decision } -> { fraud_flag }
import { NextRequest } from 'next/server'
import { withAdmin, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { Errors } from '@/lib/errors'
import { reviewSchema } from '@/modules/fraud/validators'
import * as fraudService from '@/modules/fraud/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withAdmin(req, async () => {
    const body = await validateBody(req, reviewSchema)
    const flag = await fraudService.reviewFraudFlag(id, body.decision)
    if (!flag) throw Errors.notFound('Fraud flag not found')
    return ok(flag, 200)
  })
}
