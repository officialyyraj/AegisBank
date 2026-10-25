// GET /api/v1/accounts/:id/statement.pdf (owner) — printable HTML optimized for
// "Save as PDF" via the browser's print dialog. Design note: rather than adding a
// heavy PDF library dependency, we return a self-contained HTML page with
// print-optimized CSS. The user clicks "Download PDF" in the UI which opens
// this in a new tab + triggers window.print(). Chrome/Firefox/Safari all
// support "Save as PDF" in the print dialog.
import { NextRequest, NextResponse } from 'next/server'
import { Errors } from '@/lib/errors'
import * as accountsService from '@/modules/accounts/service'
import { accountsRepository } from '@/modules/accounts/repository'
import { requireAuthFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function inr(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (Number.isNaN(num)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(num)
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  let userId: string
  try {
    const user = await requireAuthFromRequest(req)
    userId = user.id
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const account = await accountsRepository.findById(id)
  if (!account) throw Errors.notFound('Account not found')
  if (account.userId !== userId) throw Errors.forbidden('Not the account owner')

  const rows = await accountsService.getStatementRows(userId, id)
  const masked = account.accountNumber.slice(0, 3) + '••••' + account.accountNumber.slice(-3)
  const now = new Date().toLocaleString('en-IN')

  const rowsHtml = rows.map((r) => {
    const outgoing = r.source_account_id === id
    const sign = outgoing ? '-' : '+'
    const color = outgoing ? '#dc2626' : '#059669'
    const counterparty = outgoing ? r.destination_account_id.slice(-8) : r.source_account_id.slice(-8)
    return `<tr>
      <td>${new Date(r.created_at).toLocaleDateString('en-IN')}</td>
      <td><span class="dir ${outgoing ? 'debit' : 'credit'}">${outgoing ? 'DEBIT' : 'CREDIT'}</span></td>
      <td class="amount" style="color:${color}">${sign}${inr(r.amount)}</td>
      <td>${r.status}</td>
      <td class="mono">${counterparty}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AegisBank Statement — ${masked}</title>
<style>
  * { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { margin: 0; padding: 32px; color: #1a2e1a; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 24px; font-weight: 700; color: #059669; }
  .brand-sub { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .meta { text-align: right; font-size: 12px; color: #666; }
  .meta strong { color: #1a2e1a; }
  .account-info { background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .account-info h2 { margin: 0 0 4px; font-size: 16px; }
  .account-info p { margin: 0; font-size: 12px; color: #666; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 8px; border-bottom: 2px solid #ddd; color: #666; font-weight: 600; text-transform: uppercase; font-size: 10px; }
  td { padding: 8px; border-bottom: 1px solid #eee; }
  .dir { font-weight: 600; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
  .dir.debit { background: #fef2f2; color: #dc2626; }
  .dir.credit { background: #f0fdf4; color: #059669; }
  .amount { font-family: 'SF Mono', monospace; font-weight: 600; }
  .mono { font-family: 'SF Mono', monospace; font-size: 11px; color: #666; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: center; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">AegisBank</div>
      <div class="brand-sub">Digital Banking · Account Statement</div>
    </div>
    <div class="meta">
      Generated: <strong>${now}</strong><br>
      Account: <strong>${masked}</strong><br>
      Type: <strong>${account.accountType}</strong><br>
      Balance: <strong>${inr(account.balance.toString())}</strong>
    </div>
  </div>
  <div class="account-info">
    <h2>Statement for ${masked}</h2>
    <p>${rows.length} transactions · ${account.accountType} account · status: ${account.status}</p>
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th><th>Counterparty</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">
    AegisBank · Cloud-Native Digital Banking Platform · This statement was generated electronically and is valid without signature.
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
