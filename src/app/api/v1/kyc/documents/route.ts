// POST /api/v1/kyc/documents (user) — multipart file + doc_type
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { Errors } from '@/lib/errors'
import * as kycService from '@/modules/kyc/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function POST(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const form = await req.formData()
    const file = form.get('file')
    const docType = form.get('doc_type')
    if (!(file instanceof File)) throw Errors.badRequest('file is required (multipart)')
    if (typeof docType !== 'string' || !docType) throw Errors.badRequest('doc_type is required')
    const bytes = await file.arrayBuffer()
    const result = await kycService.uploadDocument(ctx.user.id, { name: file.name, type: file.type, size: file.size, bytes }, docType)
    return ok(result, 201)
  })
}
