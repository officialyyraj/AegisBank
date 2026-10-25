// src/components/banking/BreakdownModal.tsx — shows filtered transactions when a donut segment is clicked.
'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowUpRight, ArrowDownLeft, Smartphone, FilterX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, RecentActivityItem } from '@/lib/frontend/api'
import { LoadingState, EmptyState, inr, timeAgo } from './primitives'

export interface BreakdownFilter {
  label: string
  category?: string
  recipient_account_id?: string
  direction?: 'debit' | 'credit'
}

export function BreakdownModal({ filter, onClose }: { filter: BreakdownFilter | null; onClose: () => void }) {
  const [items, setItems] = useState<RecentActivityItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!filter) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await api.recentActivity(50, {
          category: filter.category,
          recipient_account_id: filter.recipient_account_id,
          direction: filter.direction,
        })
        if (!cancelled) { setItems(r); setError(null) }
      } catch (e) { if (!cancelled) { setError((e as Error).message); setItems(null) } }
    })()
    return () => { cancelled = true }
  }, [filter])

  const totalAmount = items ? items.reduce((s, i) => s + Number(i.amount), 0) : 0

  return (
    <AnimatePresence>
      {filter && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent" aria-label="Close">
              <X className="size-4" />
            </button>
            <div className="mb-4 flex items-center gap-2">
              <FilterX className="size-5 text-primary" />
              <div>
                <h3 className="text-base font-semibold">{filter.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {items ? `${items.length} transactions · ${inr(totalAmount)} total` : 'Loading…'}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto scroll-thin flex-1">
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : items === null ? (
                <LoadingState label="Loading transactions…" />
              ) : items.length === 0 ? (
                <EmptyState title="No transactions match" hint="This filter has no matching transactions." />
              ) : (
                <ul className="space-y-1">
                  {items.map((t, i) => {
                    const debit = t.direction === 'debit'
                    const isTopup = t.kind === 'topup'
                    const icon = isTopup ? <Smartphone className="size-4" /> : (debit ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />)
                    return (
                      <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${debit && !isTopup ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                            {icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium">{isTopup ? 'Add money' : debit ? 'Sent' : 'Received'}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {timeAgo(t.created_at)}
                              {t.counterparty_account_number ? ` · ${t.counterparty_account_number}` : ''}
                              {t.category && <Badge variant="outline" className="ml-1 text-[9px]">{t.category}</Badge>}
                            </p>
                          </div>
                        </div>
                        <span className={`font-mono text-xs font-semibold tabular-nums ${debit && !isTopup ? 'text-destructive' : 'text-primary'}`}>
                          {debit && !isTopup ? '-' : '+'}{inr(t.amount)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
