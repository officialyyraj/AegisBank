import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { Errors } from '@/lib/errors'

export type IdempotencyClaim =
  | { kind: 'claimed'; id: string }
  | { kind: 'replay'; body: any; status: number }

export function hashRequest(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

export async function claimIdempotency(
  userId: string,
  operation: string,
  key: string,
  requestHash: string,
): Promise<IdempotencyClaim> {
  if (!key || key.length > 200) throw Errors.badRequest('Idempotency-Key must be between 1 and 200 characters')
  try {
    const row = await db.idempotencyKey.create({ data: { userId, operation, key, requestHash } })
    return { kind: 'claimed', id: row.id }
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    const existing = await db.idempotencyKey.findUnique({ where: { userId_operation_key: { userId, operation, key } } })
    if (!existing) throw error
    if (existing.requestHash !== requestHash) throw Errors.badRequest('Idempotency-Key was reused with a different request')
    if (existing.status === 'completed' && existing.responseJson && existing.responseStatus) {
      return { kind: 'replay', body: JSON.parse(existing.responseJson), status: existing.responseStatus }
    }
    throw Errors.conflict('A request with this Idempotency-Key is already processing')
  }
}

export async function completeIdempotency(
  tx: Prisma.TransactionClient,
  id: string,
  body: unknown,
  status: number,
) {
  await tx.idempotencyKey.update({
    where: { id },
    data: { status: 'completed', responseJson: JSON.stringify(body), responseStatus: status },
  })
}

export async function releaseIdempotency(id: string) {
  await db.idempotencyKey.delete({ where: { id } }).catch(() => undefined)
}
