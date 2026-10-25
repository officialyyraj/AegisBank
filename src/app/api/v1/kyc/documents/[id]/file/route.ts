import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { isAbsolute, join, relative } from 'path'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { Errors } from '@/lib/errors'
import { kycRepository } from '@/modules/kyc/repository'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const doc = await kycRepository.findById(id)
    if (!doc) throw Errors.notFound('KYC document not found')
    if (doc.userId !== ctx.user.id && ctx.user.role !== 'admin') throw Errors.forbidden('You cannot access this document')

    const root = isAbsolute(process.env.KYC_UPLOAD_DIR || '')
      ? (process.env.KYC_UPLOAD_DIR as string)
      : join(process.cwd(), process.env.KYC_UPLOAD_DIR || './storage/kyc')
    const path = join(root, doc.s3Key)
    const rel = relative(root, path)
    if (rel.startsWith('..') || isAbsolute(rel)) throw Errors.notFound('KYC document not found')

    let data: Buffer
    try {
      data = await readFile(path)
    } catch {
      throw Errors.notFound('KYC document file not found')
    }
    const contentType = doc.s3Key.endsWith('.pdf') ? 'application/pdf' : doc.s3Key.endsWith('.jpg') ? 'image/jpeg' : 'image/png'
    return new NextResponse(data as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${doc.id}.${contentType === 'application/pdf' ? 'pdf' : contentType === 'image/jpeg' ? 'jpg' : 'png'}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
}
