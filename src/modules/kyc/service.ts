// KYC upload and review service. Files are stored outside the public web root.
import { kycRepository } from './repository'
import { publishEventStandalone } from '@/modules/eventbus/outbox'
import { Errors } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { isAbsolute, join, resolve } from 'path'
import { db } from '@/lib/db'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB (requirements

function typeFromSignature(bytes: Buffer): { ext: string; mime: string } | null {
  if (bytes.subarray(0, 4).toString() === '%PDF') return { ext: 'pdf', mime: 'application/pdf' }
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { ext: 'jpg', mime: 'image/jpeg' }
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' }
  return null
}

/** POST /kyc/documents — multipart upload. */
export async function uploadDocument(
  userId: string,
  file: { name: string; type: string; size: number; bytes: ArrayBuffer },
  docType: string,
) {
  if (file.size > MAX_BYTES) {
    throw Errors.badRequest('File too large (max 5MB)')
  }
  const bytes = Buffer.from(file.bytes)
  const detected = typeFromSignature(bytes)
  if (!detected) throw Errors.badRequest('Unsupported file type (PDF, JPEG, or PNG only)')
  const uploadDir = process.env.KYC_UPLOAD_DIR || './storage/kyc'
  const storageRoot = isAbsolute(uploadDir) ? uploadDir : resolve(process.cwd(), uploadDir)
  const ext = detected.ext
  const s3Key = `users/${userId}/${randomUUID()}.${ext}`
  const localPath = join(storageRoot, s3Key)
  await mkdir(join(storageRoot, `users/${userId}`), { recursive: true })
  await writeFile(localPath, bytes)
  logger.info('kyc.upload', { userId, docType, s3Key, bytes: file.size })

  const doc = await kycRepository.create({ userId, docType, s3Key, status: 'pending' })
  return { document_id: doc.id, status: doc.status }
}

/** GET /kyc/status — return the user's current kyc_status. */
export async function getStatus(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { kycStatus: true } })
  if (!user) throw Errors.unauthorized()
  return { kyc_status: user.kycStatus }
}

/** POST /kyc/documents/:id/review (admin) — approve/reject. */
export async function reviewDocument(id: string, decision: 'approved' | 'rejected') {
  const doc = await kycRepository.findById(id)
  if (!doc) return null
  const updated = await kycRepository.updateStatus(id, { status: decision, reviewedAt: new Date() })
  if (decision === 'approved') {
    await kycRepository.setUserKycStatus(doc.userId, 'approved')
  }
  await publishEventStandalone('kyc.status_changed', {
    document_id: doc.id,
    user_id: doc.userId,
    status: decision,
  })
  logger.info('kyc.reviewed', { documentId: doc.id, decision })
  return { status: updated.status }
}

/** GET /admin/kyc-documents?status=pending (admin) — review queue. */
export async function listKycDocumentsForAdmin(status?: string) {
  const docs = await kycRepository.listForAdmin(status)
  return docs.map((d) => ({
    id: d.id,
    user_id: d.userId,
    user_email: d.user.email,
    user_name: d.user.fullName,
    doc_type: d.docType,
    s3_key: d.s3Key,
    status: d.status,
    submitted_at: d.submittedAt.toISOString(),
    reviewed_at: d.reviewedAt?.toISOString() || null,
  }))
}
