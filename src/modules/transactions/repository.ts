// src/modules/transactions/repository.ts
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const transactionsRepository = {
  create: (
    tx: Prisma.TransactionClient,
    data: { sourceAccountId: string; destinationAccountId: string; amount: Prisma.Decimal; status: string; sagaState: string; category?: string | null; note?: string | null },
  ) =>
    tx.transaction.create({
      data: {
        sourceAccountId: data.sourceAccountId,
        destinationAccountId: data.destinationAccountId,
        amount: data.amount,
        status: data.status,
        sagaState: data.sagaState,
        category: data.category ?? null,
        note: data.note ?? null,
      },
    }),

  findById: (id: string) => db.transaction.findUnique({ where: { id } }),
}
