// src/modules/transactions/validators.ts
import { z } from 'zod'

const MAX_TRANSFER = Number(process.env.MAX_TRANSFER_AMOUNT_INR || 1000000) // ₹10 lakh default (Design note)

export const transferSchema = z.object({
  source_account_id: z.string().min(1),
  destination_account_id: z.string().min(1),
  amount: z.number().positive().max(MAX_TRANSFER, `Amount exceeds maximum (₹${MAX_TRANSFER})`),
  // Design note: optional merchant category + note for spending analytics.
  category: z.string().min(1).max(40).optional().nullable(),
  note: z.string().max(120).optional().nullable(),
}).strict().refine((v) => v.source_account_id !== v.destination_account_id, {
  message: 'source and destination must differ',
})

export type TransferInput = z.infer<typeof transferSchema>
