// src/modules/kyc/repository.ts
import { db } from '@/lib/db'

export const kycRepository = {
  create: (data: { userId: string; docType: string; s3Key: string; status: string }) =>
    db.kycDocument.create({ data: { userId: data.userId, docType: data.docType, s3Key: data.s3Key, status: data.status } }),

  findById: (id: string) => db.kycDocument.findUnique({ where: { id } }),

  findByUser: (userId: string) =>
    db.kycDocument.findMany({ where: { userId }, orderBy: { submittedAt: 'desc' } }),

  // Admin review queue: all docs, optionally filtered by status, with the
  // submitting user's name + email for context.
  listForAdmin: (status?: string) =>
    db.kycDocument.findMany({
      where: status ? { status } : undefined,
      orderBy: { submittedAt: 'desc' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    }),

  updateStatus: (id: string, data: { status: string; reviewedAt: Date }) =>
    db.kycDocument.update({ where: { id }, data }),

  setUserKycStatus: (userId: string, status: string) =>
    db.user.update({ where: { id: userId }, data: { kycStatus: status } }),
}
