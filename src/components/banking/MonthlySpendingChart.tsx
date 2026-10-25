// src/components/banking/MonthlySpendingChart.tsx — Recharts stacked BarChart, month-over-month.
'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api, MonthlySpending } from '@/lib/frontend/api'
import { LoadingState, ErrorBanner, EmptyState, inr } from './primitives'

const PALETTE = ['#0d9488', '#14b8a6', '#22c55e', '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#6b7280']

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-IN', { month: 'short' })
}

interface TooltipProps { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: string }

function MonthlyTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + p.value, 0)
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold">{label}</div>
      <div className="font-mono font-bold tabular-nums">{inr(total)}</div>
      <div className="mt-1 space-y-0.5">
        {payload.filter((p) => p.value > 0).map((p) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="font-mono tabular-nums">{inr(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MonthlySpendingChart({ accountId, months = 6 }: { accountId: string; months?: number }) {
  const [data, setData] = useState<MonthlySpending[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setData(null); setError(null)
      try {
        const r = await api.monthlySpending(accountId, months)
        if (!cancelled) setData(r)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
    })()
    return () => { cancelled = true }
  }, [accountId, months])

  if (error) return <ErrorBanner message={error} />
  if (!data) return <LoadingState label="Loading monthly data…" />
  if (data.every((m) => m.total === 0)) {
    return <EmptyState title="No spending history yet" hint="Make transfers across multiple months to see trends." />
  }

  // Collect all unique categories across all months for stacked bars
  const allCategories = [...new Set(data.flatMap((m) => m.categories.map((c) => c.category)))]

  // Transform data: each month becomes a flat object with category→amount
  const chartData = data.map((m) => {
    const row: Record<string, number | string> = { month: monthLabel(m.month) }
    for (const cat of allCategories) {
      const found = m.categories.find((c) => c.category === cat)
      row[cat] = found ? found.amount : 0
    }
    return row
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
          <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<MonthlyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          {allCategories.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="a"
              fill={PALETTE[i % PALETTE.length]}
              isAnimationActive={true}
              animationDuration={400}
              animationBegin={i * 50}
              radius={i === allCategories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2">
        {allCategories.slice(0, 8).map((cat, i) => (
          <div key={cat} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="text-[10px] text-muted-foreground">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
