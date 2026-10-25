// src/modules/payees/validators.ts
import { z } from 'zod'

export const createPayeeSchema = z.object({
  target_account_id: z.string().min(1),
  nickname: z.string().min(1).max(60).optional().nullable(),
}).strict()

export const updatePayeeSchema = z.object({
  nickname: z.string().min(1).max(60).nullable(),
}).strict()

export type CreatePayeeInput = z.infer<typeof createPayeeSchema>
export type UpdatePayeeInput = z.infer<typeof updatePayeeSchema>
