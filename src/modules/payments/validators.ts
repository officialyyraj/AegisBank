// src/modules/payments/validators.ts
import { z } from 'zod'

const MAX_TRANSFER = Number(process.env.MAX_TRANSFER_AMOUNT_INR || 1000000) // ₹10 lakh default (Design note)

export const topupSchema = z.object({
  account_id: z.string().min(1),
  amount: z.number().positive().max(MAX_TRANSFER, `Amount exceeds maximum (₹${MAX_TRANSFER})`),
}).strict()

export type TopupInput = z.infer<typeof topupSchema>
