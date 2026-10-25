// src/components/banking/AdminFraudView.tsx — admin fraud flag review.
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, Check, Ban, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, FraudFlag } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, EmptyState, timeAgo } from './primitives'

const severityStyle: Record<string, string> = {
  HIGH: 'bg-destructive/10 text-destructive border-destructive/30',
  MEDIUM: 'bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/30',
  LOW: 'bg-primary/10 text-primary border-primary/30',
}

export function AdminFraudView() {
  const [flags, setFlags] = useState<FraudFlag[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('open')
  const [acting, setActing] = useState<string | null>(null)

  const load = async () => {
    setError(null); setFlags(null)
    try {
      setFlags(await api.listFraudFlags(filter === 'all' ? undefined : filter))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => { void load() }, [filter])

  async function act(id: string, decision: 'reviewed' | 'dismissed') {
    setActing(id)
    try {
      await api.reviewFraudFlag(id, decision)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setActing(null)
    }
  }

  const counts = flags?.reduce((m, f) => { m[f.severity] = (m[f.severity] || 0) + 1; return m }, {} as Record<string, number>) || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Fraud review queue</h2>
          <p className="text-sm text-muted-foreground">Deterministic rule flags: velocity, large-amount, new-device.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-9 text-xs"><Filter className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {['HIGH', 'MEDIUM', 'LOW'].map((s) => (
          <div key={s} className={`rounded-xl border p-3 ${severityStyle[s]}`}>
            <p className="text-xs font-medium uppercase">{s}</p>
            <p className="text-2xl font-semibold">{counts[s] || 0}</p>
          </div>
        ))}
        <div className="rounded-xl border bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold">{flags?.length || 0}</p>
        </div>
      </div>

      <SectionCard title="Flags" description="Review or dismiss each flag">
        {error ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : flags === null ? (
          <LoadingState label="Loading flags…" />
        ) : flags.length === 0 ? (
          <EmptyState title="No flags in this view" hint="Trigger velocity by making 4 quick transfers." />
        ) : (
          <ul className="space-y-2 max-h-[32rem] overflow-y-auto scroll-thin pr-1">
            {flags.map((f, i) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.25) }}
                className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-2 ${severityStyle[f.severity]}`}>
                    <ShieldAlert className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${severityStyle[f.severity]}`}>{f.severity}</Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">{f.reviewed_status}</Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(f.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium">{f.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.transaction_id ? `txn ${f.transaction_id.slice(-10)}` : f.payment_id ? `pay ${f.payment_id.slice(-10)}` : '—'}
                    </p>
                  </div>
                </div>
                {f.reviewed_status === 'open' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" disabled={acting === f.id} onClick={() => act(f.id, 'reviewed')}>
                      <Check className="size-3.5" /> Review
                    </Button>
                    <Button size="sm" variant="outline" disabled={acting === f.id} onClick={() => act(f.id, 'dismissed')}>
                      <Ban className="size-3.5" /> Dismiss
                    </Button>
                  </div>
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
