// src/modules/accounts/repository.ts
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const accountsRepository = {
  create: (tx: Prisma.TransactionClient, data: { userId: string; accountNumber: string; accountType: string }) =>
    tx.account.create({ data: { userId: data.userId, accountNumber: data.accountNumber, accountType: data.accountType, balance: 0, status: 'active' } }),

  findById: (id: string) => db.account.findUnique({ where: { id } }),

  findByUser: (userId: string) =>
    db.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),

  // Atomic, conditional balance update — emulates SELECT...FOR UPDATE under
  // SQLite (serializable single-writer). Returns the updated row only if the
  // guard passes; otherwise null. requirements  +  (no double-spend).
  debit: (tx: Prisma.TransactionClient, accountId: string, amount: Prisma.Decimal) =>
    tx.account.updateMany({
      where: { id: accountId, status: 'active', balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    }),

  credit: (tx: Prisma.TransactionClient, accountId: string, amount: Prisma.Decimal) =>
    tx.account.updateMany({
      where: { id: accountId, status: 'active' },
      data: { balance: { increment: amount } },
    }),

  // For statements: transactions where the account is source OR destination.
  // Supports optional date-range + direction + search (transaction id substring) + cursor pagination.
  statement: (accountId: string, from?: Date, to?: Date, direction?: 'debit' | 'credit', search?: string, cursorDate?: Date, limit?: number) =>
    db.transaction.findMany({
      where: {
        AND: [
          ...(direction === 'debit' ? [{ sourceAccountId: accountId }] : []),
          ...(direction === 'credit' ? [{ destinationAccountId: accountId }] : []),
          ...(direction === undefined ? [{ OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }] }] : []),
          ...(from ? [{ createdAt: { gte: from } }] : []),
          ...(to ? [{ createdAt: { lte: to } }] : []),
          ...(search ? [{ id: { contains: search } }] : []),
          ...(cursorDate ? [{ createdAt: { lt: cursorDate } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
}
