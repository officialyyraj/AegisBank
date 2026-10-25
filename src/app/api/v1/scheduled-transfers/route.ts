// GET /api/v1/scheduled-transfers (user) | POST /api/v1/scheduled-transfers (user)
import { NextRequest } from 'next/server'
import { withUser, handleOptions, ok } from '@/lib/guard'
import { validateBody } from '@/lib/http'
import { createScheduledSchema } from '@/modules/scheduled/validators'
import * as scheduledService from '@/modules/scheduled/service'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req) || ok(null, 204)
}

export async function GET(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const list = await scheduledService.listScheduled(ctx.user.id)
    return ok(list, 200)
  })
}

export async function POST(req: NextRequest) {
  return withUser(req, async (ctx) => {
    const body = await validateBody(req, createScheduledSchema)
    const r = await scheduledService.createScheduled(ctx.user.id, {
      source_account_id: body.source_account_id,
      destination_account_id: body.destination_account_id,
      amount: body.amount,
      frequency: body.frequency,
      start_at: body.start_at,
      note: body.note ?? null,
    })
    return ok(r, 201)
  })
}
