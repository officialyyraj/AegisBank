// POST /api/v1/auth/login — public. { email, password } -> { access_token, refresh_token, expires_in } 200/401
import { NextRequest } from 'next/server'
import { validateBody, ok, errResponse, rateLimit, authRateLimit, clientIp } from '@/lib/http'
import { loginSchema } from '@/modules/auth/validators'
import * as authService from '@/modules/auth/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await validateBody(req, loginSchema)
    authRateLimit(`${clientIp(req)}:${body.email.toLowerCase()}`)
    const result = await authService.login(body)
    return ok(result, 200)
  } catch (e) {
    return errResponse(e)
  }
}
