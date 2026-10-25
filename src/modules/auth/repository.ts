// src/modules/auth/repository.ts — Prisma queries for the auth module.
import { db } from '@/lib/db'

export const authRepository = {
  findByEmail: (email: string) =>
    db.user.findUnique({ where: { email } }),

  findById: (id: string) =>
    db.user.findUnique({ where: { id: id }, select: { id: true, email: true, role: true, kycStatus: true, fullName: true } }),

  createUser: (data: { email: string; passwordHash: string; fullName: string; role?: string; kycStatus?: string }) =>
    db.user.create({ data: { email: data.email, passwordHash: data.passwordHash, fullName: data.fullName, role: data.role ?? 'customer', kycStatus: data.kycStatus ?? 'pending' } }),
}
