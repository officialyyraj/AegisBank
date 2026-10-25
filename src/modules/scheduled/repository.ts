// src/modules/scheduled/repository.ts
import { db } from '@/lib/db'

export const scheduledRepository = {
  listByOwner: (ownerUserId: string) =>
    db.scheduledTransfer.findMany({
      where: { ownerUserId },
      orderBy: { nextRunAt: 'asc' },
      include: {
        sourceAccount: { select: { id: true, accountNumber: true, accountType: true } },
        destAccount: { select: { id: true, accountNumber: true, accountType: true, user: { select: { fullName: true } } } },
      },
    }),

  findById: (id: string) =>
    db.scheduledTransfer.findUnique({ where: { id } }),

  create: (data: {
    ownerUserId: string
    sourceAccountId: string
    destinationAccountId: string
    amount: number
    frequency: string
    nextRunAt: Date
    note?: string | null
  }) =>
    db.scheduledTransfer.create({ data: { ...data, note: data.note ?? null } }),

  update: (id: string, data: { status?: string; nextRunAt?: Date; lastRunAt?: Date; note?: string | null }) =>
    db.scheduledTransfer.update({ where: { id }, data }),

  delete: (id: string) => db.scheduledTransfer.delete({ where: { id } }),

  // Worker: find all active schedules due now or earlier.
  findDue: () =>
    db.scheduledTransfer.findMany({
      where: { status: 'active', nextRunAt: { lte: new Date() } },
      take: 20,
      orderBy: { nextRunAt: 'asc' },
    }),
}
