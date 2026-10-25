// src/modules/fraud/repository.ts
import { db } from '@/lib/db'

export const fraudRepository = {
  create: (data: { transactionId?: string | null; paymentId?: string | null; severity: string; reason: string }) =>
    db.fraudFlag.create({ data: { transactionId: data.transactionId ?? null, paymentId: data.paymentId ?? null, severity: data.severity, reason: data.reason } }),

  list: (status?: string) =>
    db.fraudFlag.findMany({
      where: status ? { reviewedStatus: status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { transaction: true, payment: true },
    }),

  findById: (id: string) =>
    db.fraudFlag.findUnique({ where: { id }, include: { transaction: true, payment: true } }),

  updateReview: (id: string, decision: string) =>
    db.fraudFlag.update({ where: { id }, data: { reviewedStatus: decision } }),
}
