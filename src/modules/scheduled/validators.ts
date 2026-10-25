// src/modules/scheduled/validators.ts
import { z } from 'zod'

export const createScheduledSchema = z.object({
  source_account_id: z.string().min(1),
  destination_account_id: z.string().min(1),
  amount: z.number().positive(),
  frequency: z.enum(['once', 'weekly', 'monthly']),
  start_at: z.string().datetime(),
  note: z.string().max(200).optional().nullable(),
}).strict().refine((v) => v.source_account_id !== v.destination_account_id, {
  message: 'source and destination must differ',
})

export const updateScheduledSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'failed']).optional(),
  note: z.string().max(200).nullable().optional(),
}).strict()

export type CreateScheduledInput = z.infer<typeof createScheduledSchema>
export type UpdateScheduledInput = z.infer<typeof updateScheduledSchema>
