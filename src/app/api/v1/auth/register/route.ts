// POST /api/v1/auth/register — public. { email, password, full_name } -> { user_id } 201/400/409
import { NextRequest } from 'next/server'
import { validateBody, ok, errResponse, rateLimit, authRateLimit, clientIp, handleOptions, corsHeaders } from '@/lib/http'
import { registerSchema } from '@/modules/auth/validators'
import * as authService from '@/modules/auth/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function POST(req: NextRequest) {
  try {
    const body = await validateBody(req, registerSchema)
    authRateLimit(`${clientIp(req)}:${body.email.toLowerCase()}`)
    const result = await authService.register(body)
    return ok(result, 201)
  } catch (e) {
    return errResponse(e)
  }
}

// Apply CORS to all responses via headers wrapper
export function GET() { return ok({ alive: true }) }
