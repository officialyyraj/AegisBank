// src/modules/fraud/validators.ts
import { z } from 'zod'

export const reviewSchema = z.object({
  decision: z.enum(['reviewed', 'dismissed']),
}).strict()

export type ReviewInput = z.infer<typeof reviewSchema>
