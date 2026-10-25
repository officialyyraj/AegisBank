// GET /api/v1/selftest — runs the acceptance-criteria suite (Design note).
// Public (no auth) so it can be exercised without a token; intended for dev/QA.
import { NextResponse } from 'next/server'
import { runSelfTests } from '@/lib/selftest'
import { ensureBooted } from '@/modules/eventbus/boot'
import { stopPoller, startPoller } from '@/modules/eventbus/outbox'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Not found' }, { status: 404 })
  }
  ensureBooted()
  // Pause the background outbox poller + scheduled-transfer worker during the
  // test run so they don't compete with the test's DB writes for SQLite's
  // single writer (round-7 lesson: concurrent writes caused socket timeouts
  // + "Transaction already closed" errors that hung the suite).
  stopPoller()
  try {
    const report = await runSelfTests()
    const status = report.failed === 0 ? 200 : 500
    return NextResponse.json(report, { status, headers: { 'Content-Type': 'application/json' } })
  } finally {
    startPoller()
  }
}
