// src/modules/payees/repository.ts
import { db } from '@/lib/db'

export const payeesRepository = {
  listByOwner: (ownerUserId: string) =>
    db.payee.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        targetAccount: { select: { id: true, accountNumber: true, accountType: true, user: { select: { fullName: true } } } },
      },
    }),

  findByOwnerAndTarget: (ownerUserId: string, targetAccountId: string) =>
    db.payee.findUnique({ where: { ownerUserId_targetAccountId: { ownerUserId, targetAccountId } } }),

  create: (data: { ownerUserId: string; targetAccountId: string; nickname?: string | null }) =>
    db.payee.create({ data: { ownerUserId: data.ownerUserId, targetAccountId: data.targetAccountId, nickname: data.nickname ?? null } }),

  update: (id: string, data: { nickname?: string | null }) =>
    db.payee.update({ where: { id }, data }),

  delete: (id: string) => db.payee.delete({ where: { id } }),
}
