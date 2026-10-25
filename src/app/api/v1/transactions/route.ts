// POST /api/v1/transactions (user) | GET not supported here
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { transferSchema } from '@/modules/transactions/validators'
import * as txnService from '@/modules/transactions/service'
import { deviceFingerprintFromRequest } from '@/lib/auth'
import { Errors } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function POST(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const idempotencyKey = req.headers.get('idempotency-key')
    if (!idempotencyKey) throw Errors.badRequest('Idempotency-Key header is required')
    const body = await validateBody(req, transferSchema)
    const fingerprint = ctx.fingerprint || deviceFingerprintFromRequest(req)
    const txn = await txnService.transfer(ctx.user.id, body, fingerprint, idempotencyKey)
    return ok(txn, 201)
  })
}
