// src/components/banking/Dashboard.tsx — account list + virtual card + recent activity.
'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Landmark, Plus, Wallet, TrendingUp, TrendingDown, RefreshCw, ArrowRightLeft, Smartphone, FileText, Activity, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { api, Account } from '@/lib/frontend/api'
import { useAuth } from '@/lib/frontend/store'
import { useBalancePrivacy } from '@/lib/frontend/useBalancePrivacy'
import { SectionCard, LoadingState, ErrorBanner, EmptyState, inr, maskedInr, maskAccount, CardSkeleton } from './primitives'
import { RecentActivity, ActivityFilter } from './RecentActivity'
import { VirtualCard } from './VirtualCard'
import { BalanceTrend } from './BalanceTrend'
import { SpendingDonut } from './SpendingDonut'
import { CategoryDonut } from './CategoryDonut'
import { SmartInsights } from './SmartInsights'
import { MonthlySpendingChart } from './MonthlySpendingChart'
import { BreakdownModal, BreakdownFilter } from './BreakdownModal'
import { useIsMobile } from '@/hooks/use-mobile'

// Wrapper that shows 4 months on mobile, 6 on desktop (round 12 mobile layout pass).
function MonthlySpendingChartMobile({ accountId }: { accountId: string }) {
  const isMobile = useIsMobile()
  return <MonthlySpendingChart accountId={accountId} months={isMobile ? 4 : 6} />
}

export function Dashboard({ goTo }: { goTo: (v: string) => void }) {
  const { user } = useAuth()
  const { hidden, toggle: toggleHidden } = useBalancePrivacy()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState('savings')
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter | null>(null)
  const [breakdownFilter, setBreakdownFilter] = useState<BreakdownFilter | null>(null)

  const load = async () => {
    setError(null); setAccounts(null)
    try {
      const list = await api.listAccounts()
      setAccounts(list)
      if (!selectedCard && list.length) setSelectedCard(list[0]!.id)
    } catch (e) { setError((e as Error).message) }
  }

  useEffect(() => { void load() }, [])

  const total = accounts?.reduce((s, a) => s + parseFloat(a.balance), 0) ?? 0
  const primary = accounts?.find((a) => a.id === selectedCard) || accounts?.[0] || null

  // Quick actions
  const quickActions = [
    { label: 'Transfer', icon: <ArrowRightLeft className="size-4" />, view: 'transfer' },
    { label: 'Add money', icon: <Smartphone className="size-4" />, view: 'topup' },
    { label: 'KYC', icon: <FileText className="size-4" />, view: 'kyc' },
  ]

  async function create() {
    setCreating(true)
    try {
      const a = await api.createAccount(newType)
      await load()
      setSelectedCard(a.id)
    } catch (e) { setError((e as Error).message) }
    finally { setCreating(false) }
  }

  return (
    <div className="space-y-6">
      {/* Hero row: virtual card + balance summary */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:items-stretch">
        {/* Virtual card */}
        <div className="flex flex-col gap-3">
          {primary ? (
            <VirtualCard account={primary} userName={user?.email?.split('@')[0] || 'Holder'} hideBalance={hidden} />
          ) : (
            <div className="aspect-[1.6/1] w-full rounded-2xl border bg-muted/40" />
          )}
          {accounts && accounts.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedCard(a.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${a.id === selectedCard ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                >
                  {maskAccount(a.account_number)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Balance + quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-5"
        >
          <div className="card-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total balance</p>
              <button
                onClick={toggleHidden}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                title={hidden ? 'Show balance' : 'Hide balance'}
              >
                {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {hidden ? 'Hidden' : 'Visible'}
              </button>
            </div>
            <p className="font-mono text-4xl font-semibold tracking-tight tabular-nums">{hidden ? maskedInr() : inr(total)}</p>
            <p className="text-xs text-muted-foreground">{accounts?.length ?? 0} account(s) · {user?.email}</p>
          </div>

          <div className="relative mt-5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Quick actions</p>
            <div className="grid grid-cols-3 gap-2">
              {quickActions.map((q) => (
                <button
                  key={q.label}
                  onClick={() => goTo(q.view)}
                  className="group flex flex-col items-center gap-1.5 rounded-xl border bg-background/60 p-3 transition hover:border-primary/40 hover:bg-accent"
                >
                  <span className="rounded-lg bg-primary/10 p-2 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    {q.icon}
                  </span>
                  <span className="text-xs font-medium">{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {primary && (
            <div className="relative mt-5 border-t pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Balance trend · {primary.account_type}</p>
                <span className="text-[10px] text-muted-foreground/70">30 days</span>
              </div>
              {hidden ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Balance hidden — toggle eye to view trend.</p>
              ) : (
                <BalanceTrend accountId={primary.id} days={30} />
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* KPI row — inflow/outflow + accounts + tier (replaces redundant net-worth) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={<Wallet className="size-4" />} label="Accounts" value={String(accounts?.length ?? 0)} hint="savings + current" />
        <KpiCard icon={<TrendingDown className="size-4" />} label="Available" value={inr(total)} hint="across all accounts" accent="primary" />
        <KpiCard icon={<TrendingUp className="size-4" />} label="Total balance" value={inr(total)} hint="across all accounts" />
      </div>

      {/* Smart insights widget (Design note) */}
      {primary && !hidden && (
        <SmartInsights accountId={primary.id} days={30} />
      )}

      {/* Spending breakdown donuts — by counterparty + by category (Design note/#A20) */}
      {primary && !hidden && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Spending by recipient" description="Click a segment to see transactions">
            <SpendingDonut accountId={primary.id} days={30} onSegmentClick={(item) => {
              setActivityFilter({ direction: 'debit' })
              setBreakdownFilter({ label: `Spending to ${item.category}`, direction: 'debit' })
            }} />
          </SectionCard>
          <SectionCard title="Spending by category" description="Click a category to see transactions">
            <CategoryDonut accountId={primary.id} days={30} onSegmentClick={(item) => {
              const cat = item.category === 'Uncategorized' ? '__none' : item.category
              setActivityFilter({ category: cat })
              setBreakdownFilter({ label: `Spending on ${item.category}`, category: cat })
            }} />
          </SectionCard>
        </div>
      )}

      {/* Month-over-month spending chart (Design note) */}
      {primary && !hidden && (
        <SectionCard title="Monthly spending" description="Stacked by category — hover for details">
          <MonthlySpendingChartMobile accountId={primary.id} />
        </SectionCard>
      )}

      {/* Two-column: Recent Activity + Accounts */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <SectionCard
          title="Recent activity"
          description={activityFilter ? "Filtered — click Clear to reset" : "Latest transfers across all your accounts"}
          action={<Button variant="link" size="sm" className="h-6 px-2 text-xs" onClick={() => primary && goTo(`history:${primary.id}`)}>View all</Button>}
        >
          {error ? <ErrorBanner message={error} onRetry={load} /> : accounts === null ? <LoadingState label="Loading activity…" /> : <RecentActivity limit={8} filter={activityFilter} onClearFilter={() => setActivityFilter(null)} />}
        </SectionCard>

        <SectionCard
          title="Your accounts"
          description="Open & manage accounts"
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="size-3.5" /></Button>
              <div className="hidden sm:flex items-center gap-2">
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={create} disabled={creating || newType === ''}>
                  <Plus className="size-3.5" /> {creating ? 'Creating…' : 'New account'}
                </Button>
              </div>
            </div>
          }
        >
          {error ? (
            <ErrorBanner message={error} onRetry={load} />
          ) : accounts === null ? (
            <CardSkeleton rows={2} />
          ) : accounts.length === 0 ? (
            <EmptyState title="No accounts yet" hint="Create your first account to get started." />
          ) : (
            <ul className="divide-y">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      {a.account_type === 'savings' ? <Wallet className="size-4" /> : <Landmark className="size-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{maskAccount(a.account_number)}</span>
                        <Badge variant="secondary" className="text-[10px] uppercase">{a.account_type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Opened {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-base font-semibold tabular-nums">{inr(a.balance)}</div>
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{a.status}</Badge>
                      <Button variant="link" size="sm" className="h-6 px-2 text-xs" onClick={() => goTo(`history:${a.id}`)}>
                        Statement
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Mobile create-account bar */}
      <div className="flex items-center gap-2 sm:hidden">
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="savings">Savings</SelectItem>
            <SelectItem value="current">Current</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={create} disabled={creating || newType === ''} className="flex-1">
          <Plus className="size-3.5" /> {creating ? 'Creating…' : 'New account'}
        </Button>
      </div>

      {/* Breakdown modal (Design note) — opens when a donut segment is clicked */}
      <BreakdownModal filter={breakdownFilter} onClose={() => setBreakdownFilter(null)} />
    </div>
  )
}

function KpiCard({ icon, label, value, hint, accent }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: 'primary' }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={`rounded-md p-1.5 ${accent === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`mt-2 font-mono text-xl font-semibold tabular-nums ${accent === 'primary' ? 'text-primary' : ''}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

void Activity
