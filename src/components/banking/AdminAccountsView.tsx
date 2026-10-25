// src/components/banking/AdminAccountsView.tsx — admin account freeze/close management.
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Landmark, Wallet, Snowflake, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, AdminAccount } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, EmptyState, inr, maskAccount } from './primitives'
import { ConfirmModal } from './ConfirmModal'

const statusStyle: Record<string, string> = {
  active: 'bg-primary/10 text-primary border-primary/30',
  frozen: 'bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/30',
  closed: 'bg-destructive/10 text-destructive border-destructive/30',
}

export function AdminAccountsView() {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ account: AdminAccount; action: 'frozen' | 'closed' } | null>(null)

  const load = async () => {
    setError(null); setAccounts(null)
    try { setAccounts(await api.listAllAccountsAdmin()) } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void load() }, [])

  async function doAction(id: string, status: 'active' | 'frozen' | 'closed') {
    setActing(id)
    try { await api.setAccountStatusAdmin(id, status); await load() }
    catch (e) { setError((e as Error).message) }
    finally { setActing(null) }
  }

  const counts = accounts?.reduce((m, a) => { m[a.status] = (m[a.status] || 0) + 1; return m }, {} as Record<string, number>) || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Landmark className="size-5 text-primary" /> Account management</h2>
          <p className="text-sm text-muted-foreground">Freeze or close accounts. Frozen accounts block outgoing transfers (debit guard rejects non-active).</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="size-3.5" /></Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={<CheckCircle2 className="size-4" />} label="Active" value={counts.active || 0} tone="primary" />
        <StatCard icon={<Snowflake className="size-4" />} label="Frozen" value={counts.frozen || 0} tone="amber" />
        <StatCard icon={<XCircle className="size-4" />} label="Closed" value={counts.closed || 0} tone="destructive" />
        <StatCard icon={<Landmark className="size-4" />} label="Total" value={accounts?.length || 0} tone="muted" />
      </div>

      <SectionCard title="All accounts" description="Across all users">
        {error ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : accounts === null ? (
          <LoadingState label="Loading accounts…" />
        ) : accounts.length === 0 ? (
          <EmptyState title="No accounts" />
        ) : (
          <ul className="space-y-2 max-h-[34rem] overflow-y-auto scroll-thin pr-1">
            {accounts.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.25) }}
                className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`rounded-lg p-2 ${statusStyle[a.status] || 'bg-muted'}`}>
                    {a.account_type === 'savings' ? <Wallet className="size-4" /> : <Landmark className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{a.owner_name}</span>
                      <Badge variant="outline" className={`text-[10px] capitalize ${statusStyle[a.status] || ''}`}>{a.status}</Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">{a.account_type}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">{maskAccount(a.account_number)} · {inr(a.balance)}</p>
                    <p className="text-[10px] text-muted-foreground/70">{a.owner_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {a.status === 'active' && (
                    <>
                      <Button size="sm" variant="outline" disabled={acting === a.id} onClick={() => setConfirm({ account: a, action: 'frozen' })}>
                        <Snowflake className="size-3.5" /> Freeze
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={acting === a.id} onClick={() => setConfirm({ account: a, action: 'closed' })}>
                        <XCircle className="size-3.5" /> Close
                      </Button>
                    </>
                  )}
                  {a.status === 'frozen' && (
                    <Button size="sm" variant="default" disabled={acting === a.id} onClick={() => doAction(a.id, 'active')}>
                      <CheckCircle2 className="size-3.5" /> Reactivate
                    </Button>
                  )}
                  {a.status === 'closed' && (
                    <span className="text-xs text-muted-foreground">Closed (immutable)</span>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ConfirmModal
        open={!!confirm}
        tone="warning"
        title={confirm?.action === 'frozen' ? 'Freeze account?' : 'Close account?'}
        description={!confirm ? '' : confirm.action === 'frozen'
          ? `${confirm.account.owner_name}'s account will be frozen. They won't be able to make outgoing transfers until reactivated.`
          : `${confirm.account.owner_name}'s account will be permanently closed.`}
        confirmLabel={confirm?.action === 'frozen' ? 'Freeze' : 'Close'}
        onConfirm={() => { if (confirm) { const { account, action } = confirm; setConfirm(null); void doAction(account.id, action) } }}
        onCancel={() => setConfirm(null)}
      >
        {confirm && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Holder</span><span>{confirm.account.owner_name}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Account</span><span className="font-mono text-xs">{maskAccount(confirm.account.account_number)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Balance</span><span className="font-mono">{inr(confirm.account.balance)}</span></div>
          </div>
        )}
      </ConfirmModal>
    </div>
  )
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'primary' | 'amber' | 'destructive' | 'muted' }) {
  const c = {
    primary: 'text-primary bg-primary/10',
    amber: 'text-amber-600 dark:text-amber-500 bg-amber-500/10',
    destructive: 'text-destructive bg-destructive/10',
    muted: 'text-muted-foreground bg-muted',
  }[tone]
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={`rounded-md p-1.5 ${c}`}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

void AlertTriangle
