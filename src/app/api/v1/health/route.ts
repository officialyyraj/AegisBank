// GET /api/v1/health — public. { status: "ok" }
import { ok } from '@/lib/http'
import { db } from '@/lib/db'
import { outboxStats } from '@/modules/eventbus/outbox'

export const dynamic = 'force-dynamic'

export async function GET() {
  // requirements: ALB health check hits this. Fail the DB probe so ECS
  // restarts an unhealthy task (requirements.
  try {
    await db.user.count({ take: 1 })
    const events = await outboxStats()
    return ok({ status: 'ok', db: 'ok', events })
  } catch {
    return ok({ status: 'degraded' }, 503)
  }
}
