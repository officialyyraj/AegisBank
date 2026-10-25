// src/modules/accounts/validators.ts
import { z } from 'zod'

export const createAccountSchema = z.object({
  account_type: z.enum(['savings', 'current']).default('savings'),
}).strict().or(z.object({}).strict())

export const statementQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
