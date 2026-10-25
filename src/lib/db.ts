import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    transactionOptions: { maxWait: 10000, timeout: 30000, isolationLevel: 'Serializable' },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
