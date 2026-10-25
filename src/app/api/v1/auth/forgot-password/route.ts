// POST /api/v1/auth/forgot-password — public. { email } -> { requested: true, reset_token? }
import { NextRequest } from 'next/server'
import { validateBody, ok, errResponse, rateLimit, authRateLimit, clientIp } from '@/lib/http'
import { forgotPasswordSchema } from '@/modules/auth/validators'
import * as authService from '@/modules/auth/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await validateBody(req, forgotPasswordSchema)
    authRateLimit(`${clientIp(req)}:${body.email.toLowerCase()}`)
    const result = await authService.forgotPassword(body.email)
    return ok(result, 200)
  } catch (e) {
    return errResponse(e)
  }
}
