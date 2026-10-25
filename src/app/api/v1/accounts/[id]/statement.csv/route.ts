// GET /api/v1/accounts/:id/statement.csv?from=&to= (owner) — CSV export of the statement.
import { NextRequest, NextResponse } from 'next/server'
import { withUser, handleOptions, ok, corsHeaders } from '@/lib/guard'
import { Errors } from '@/lib/errors'
import * as accountsService from '@/modules/accounts/service'
import { accountsRepository } from '@/modules/accounts/repository'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function OPTIONS(_req: NextRequest) {
  return handleOptions(_req) || ok(null, 204)
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  return withUser(req, async (ctx) => {
    const account = await accountsRepository.findById(id)
    if (!account) throw Errors.notFound('Account not found')
    if (account.userId !== ctx.user.id) throw Errors.forbidden('Not the account owner')

    const url = new URL(req.url)
    const fromRaw = url.searchParams.get('from')
    const toRaw = url.searchParams.get('to')
    let from: Date | undefined
    let to: Date | undefined
    try {
      if (fromRaw) from = new Date(fromRaw)
      if (toRaw) to = new Date(toRaw)
    } catch {
      throw Errors.badRequest('Invalid date range')
    }

    const txns = await accountsService.getStatementRows(ctx.user.id, id, from, to)
    const header = ['Date', 'Transaction ID', 'Direction', 'Amount', 'Status', 'Counterparty Account']
    const rows = txns.map((t) => {
      const outgoing = t.source_account_id === id
      return [
        new Date(t.created_at).toISOString(),
        t.id,
        outgoing ? 'debit' : 'credit',
        t.amount,
        t.status,
        outgoing ? t.destination_account_id : t.source_account_id,
      ].map((c) => csvEscape(String(c))).join(',')
    })
    const csv = [header.join(','), ...rows].join('\n')
    const filename = `statement_${account.accountNumber}_${new Date().toISOString().slice(0, 10)}.csv`
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        ...corsHeaders(req),
      },
    })
  })
}
