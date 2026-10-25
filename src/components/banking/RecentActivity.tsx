// src/components/banking/RecentActivity.tsx — cross-account recent activity feed (filterable).
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, Smartphone, Send, FilterX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, RecentActivityItem } from '@/lib/frontend/api'
import { LoadingState, ErrorBanner, EmptyState, inr, timeAgo } from './primitives'

export interface ActivityFilter {
  category?: string
  recipient_account_id?: string
  direction?: 'debit' | 'credit'
}

export function RecentActivity({ limit = 8, compact = false, filter, onClearFilter }: { limit?: number; compact?: boolean; filter?: ActivityFilter | null; onClearFilter?: () => void }) {
  const [items, setItems] = useState<RecentActivityItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null); setItems(null)
      try {
        const r = await api.recentActivity(limit, filter || undefined)
        if (!cancelled) setItems(r)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
    })()
    return () => { cancelled = true }
  }, [limit, filter])

  const retry = () => {
    ;(async () => {
      setError(null); setItems(null)
      try { setItems(await api.recentActivity(limit, filter || undefined)) } catch (e) { setError((e as Error).message) }
    })()
  }

  if (error) return <ErrorBanner message={error} onRetry={retry} />
  if (items === null) return <LoadingState label="Loading activity…" />
  if (items.length === 0) {
    return (
      <div>
        {filter && onClearFilter && (
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="secondary" className="text-[10px]">Filtered</Badge>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearFilter}><FilterX className="size-3" /> Clear</Button>
          </div>
        )}
        <EmptyState title={filter ? "No transactions match this filter" : "No recent activity"} hint={filter ? "Try a different category or clear the filter." : "Your latest transfers will appear here."} />
      </div>
    )
  }

  return (
    <div>
      {filter && onClearFilter && (
        <div className="mb-3 flex items-center justify-between">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <FilterX className="size-3" />
            {filter.category ? `Category: ${filter.category}` : filter.recipient_account_id ? 'Filtered by recipient' : filter.direction ? `Direction: ${filter.direction}` : 'Filtered'}
          </Badge>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearFilter}>Clear</Button>
        </div>
      )}
      <ul className="space-y-1">
        {items.map((t, i) => {
          const debit = t.direction === 'debit'
          const isTopup = t.kind === 'topup'
          const icon = isTopup ? <Smartphone className="size-4" /> : (debit ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />)
          const label = isTopup ? 'Add money' : (debit ? 'Sent' : 'Received')
          const sub = isTopup
            ? (t.provider_ref ? `via ${t.provider_ref.slice(0, 16)}…` : 'Add money')
            : (t.counterparty_account_number ? `${t.counterparty_account_number}` : 'internal')
          return (
            <motion.li
              key={t.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.3) }}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition hover:bg-accent/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${debit && !isTopup ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  {!compact && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {sub} · {timeAgo(t.created_at)}
                      {t.category && <Badge variant="outline" className="ml-1 text-[9px]">{t.category}</Badge>}
                    </p>
                  )}
                  {compact && <p className="text-[10px] text-muted-foreground">{timeAgo(t.created_at)}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className={`font-mono text-sm font-semibold tabular-nums ${debit && !isTopup ? 'text-destructive' : 'text-primary'}`}>
                  {debit && !isTopup ? '-' : '+'}{inr(t.amount)}
                </p>
                {!compact && <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70">{t.kind}</span>}
              </div>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}

void Send
