// POST /api/v1/auth/refresh — public (refresh token). { refresh_token } -> { access_token } 200/401
import { NextRequest } from 'next/server'
import { validateBody, ok, errResponse, rateLimit, clientIp } from '@/lib/http'
import { refreshSchema } from '@/modules/auth/validators'
import * as authService from '@/modules/auth/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    rateLimit(clientIp(req))
    const body = await validateBody(req, refreshSchema)
    const result = await authService.refresh(body.refresh_token)
    return ok(result, 200)
  } catch (e) {
    return errResponse(e)
  }
}
