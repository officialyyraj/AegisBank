// src/modules/payments/repository.ts
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const paymentsRepository = {
  create: (tx: Prisma.TransactionClient, data: { accountId: string; amount: Prisma.Decimal; direction: string; providerRef?: string; status: string }) =>
    tx.payment.create({ data: { accountId: data.accountId, amount: data.amount, direction: data.direction, providerRef: data.providerRef ?? null, status: data.status } }),

  update: (id: string, data: { status: string; providerRef?: string }) =>
    db.payment.update({ where: { id }, data }),

  findById: (id: string) => db.payment.findUnique({ where: { id } }),
}
