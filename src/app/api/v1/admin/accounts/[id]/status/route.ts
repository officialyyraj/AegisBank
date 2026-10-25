// POST /api/v1/admin/accounts/:id/status (admin) — freeze/close/reactivate.
import { NextRequest } from 'next/server'
import { withAdmin, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { Errors } from '@/lib/errors'
import { z } from 'zod'
import * as accountsService from '@/modules/accounts/service'

export const dynamic = 'force-dynamic'

const statusSchema = z.object({ status: z.enum(['active', 'frozen', 'closed']) }).strict()

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withAdmin(req, async () => {
    const body = await validateBody(req, statusSchema)
    const r = await accountsService.setAccountStatusAdmin(id, body.status)
    if (!r) throw Errors.notFound()
    return ok(r, 200)
  })
}
