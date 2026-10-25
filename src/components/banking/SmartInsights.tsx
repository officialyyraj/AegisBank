// src/components/banking/SmartInsights.tsx — flags unusual spending patterns + savings tips.
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, TrendingDown, AlertTriangle, Sparkles } from 'lucide-react'
import { api, SpendingBreakdown, BalancePoint } from '@/lib/frontend/api'
import { inr } from './primitives'

interface Insight {
  icon: React.ReactNode
  tone: 'info' | 'warn' | 'positive'
  title: string
  detail: string
}

export function SmartInsights({ accountId, days = 30 }: { accountId: string; days?: number }) {
  const [insights, setInsights] = useState<Insight[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setInsights(null)
      try {
        const [spending, history] = await Promise.all([
          api.spendingByCategory(accountId, days),
          api.balanceHistory(accountId, days),
        ])
        const out: Insight[] = []

        // 1. Top spending category
        if (spending.items.length > 0 && spending.total > 0) {
          const top = spending.items[0]!
          const pct = ((top.amount / spending.total) * 100).toFixed(0)
          if (Number(pct) > 50) {
            out.push({
              icon: <AlertTriangle className="size-4" />,
              tone: 'warn',
              title: `${top.category} dominates your spending`,
              detail: `${top.category} accounts for ${pct}% (${inr(top.amount)}) of your ${days}-day spend. Consider reviewing for savings opportunities.`,
            })
          } else {
            out.push({
              icon: <TrendingDown className="size-4" />,
              tone: 'info',
              title: `Top category: ${top.category}`,
              detail: `You spent ${inr(top.amount)} on ${top.category} (${pct}% of total ${inr(spending.total)}) in the last ${days} days.`,
            })
          }
        }

        // 2. Balance trend
        if (history.length >= 2) {
          const first = history[0]!.balance
          const last = history[history.length - 1]!.balance
          const change = last - first
          if (change < 0) {
            out.push({
              icon: <TrendingDown className="size-4" />,
              tone: 'warn',
              title: 'Balance declining',
              detail: `Your balance dropped by ${inr(Math.abs(change))} over ${days} days (from ${inr(first)} to ${inr(last)}).`,
            })
          } else if (change > 0) {
            out.push({
              icon: <Sparkles className="size-4" />,
              tone: 'positive',
              title: 'Balance growing',
              detail: `Your balance increased by ${inr(change)} over ${days} days. Great work saving!`,
            })
          }
        }

        // 3. Low balance warning
        if (history.length > 0) {
          const last = history[history.length - 1]!.balance
          if (last < 1000) {
            out.push({
              icon: <AlertTriangle className="size-4" />,
              tone: 'warn',
              title: 'Low balance alert',
              detail: `Your current balance is ${inr(last)} — below the ₹1,000 threshold. Consider topping up.`,
            })
          }
        }

        // 4. Savings tip (always show one if there's spending data)
        if (spending.items.length > 0) {
          const dining = spending.items.find((i) => i.category === 'Dining')
          if (dining && dining.amount > 1000) {
            out.push({
              icon: <Lightbulb className="size-4" />,
              tone: 'info',
              title: 'Savings tip: Dining',
              detail: `You spent ${inr(dining.amount)} on dining. Cooking 2 meals at home could save ~${inr(dining.amount * 0.3)}/month.`,
            })
          }
        }

        if (!cancelled) setInsights(out.length > 0 ? out : [{
          icon: <Lightbulb className="size-4" />,
          tone: 'info',
          title: 'Start spending to see insights',
          detail: 'Make a few transfers with categories to unlock personalized spending insights.',
        }])
      } catch {
        if (!cancelled) setInsights([])
      }
    })()
    return () => { cancelled = true }
  }, [accountId, days])

  if (!insights) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lightbulb className="size-4" />
          <span className="text-xs font-medium">Loading insights…</span>
        </div>
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Lightbulb className="size-4" /></span>
        <div>
          <p className="text-sm font-semibold">Smart insights</p>
          <p className="text-[10px] text-muted-foreground">Automated spending analysis — last {days} days</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {insights.map((ins, i) => {
          const toneClass = {
            info: 'border-border bg-muted/30',
            warn: 'border-amber-500/30 bg-amber-500/5',
            positive: 'border-primary/30 bg-primary/5',
          }[ins.tone]
          const iconClass = {
            info: 'text-muted-foreground',
            warn: 'text-amber-600 dark:text-amber-500',
            positive: 'text-primary',
          }[ins.tone]
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.2) }}
              className={`rounded-lg border p-3 ${toneClass}`}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 ${iconClass}`}>{ins.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{ins.title}</p>
                  <p className="text-[11px] text-muted-foreground">{ins.detail}</p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
