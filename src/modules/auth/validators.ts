// src/modules/auth/validators.ts — Zod schemas for auth request bodies.
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  full_name: z.string().min(1).max(200),
}).strict()

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).strict()

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
}).strict()

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
}).strict()

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8).max(128),
}).strict()

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
