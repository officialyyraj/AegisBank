// POST /api/v1/auth/reset-password — public. { token, new_password } -> { reset: true }
import { NextRequest } from 'next/server'
import { validateBody, ok, errResponse, rateLimit, authRateLimit, clientIp } from '@/lib/http'
import { resetPasswordSchema } from '@/modules/auth/validators'
import * as authService from '@/modules/auth/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    authRateLimit(clientIp(req))
    const body = await validateBody(req, resetPasswordSchema)
    const result = await authService.resetPassword(body.token, body.new_password)
    return ok(result, 200)
  } catch (e) {
    return errResponse(e)
  }
}
