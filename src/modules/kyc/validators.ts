// src/modules/kyc/validators.ts
import { z } from 'zod'

export const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
}).strict()

export type ReviewInput = z.infer<typeof reviewSchema>
