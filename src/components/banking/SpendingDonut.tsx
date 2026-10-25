// src/components/banking/SpendingDonut.tsx — Recharts PieChart of spending by counterparty.
'use client'
import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api, SpendingBreakdown } from '@/lib/frontend/api'
import { LoadingState, ErrorBanner, EmptyState, inr } from './primitives'

const PALETTE = ['#0d9488', '#14b8a6', '#22c55e', '#06b6d4', '#84cc16', '#6b7280']

interface DonutEntry { name: string; value: number; count: number; idx: number }
interface TooltipProps { active?: boolean; payload?: Array<{ payload: DonutEntry }>; }

function DonutTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]!.payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{p.name}</div>
      <div className="font-mono font-semibold tabular-nums">{inr(p.value)}</div>
      <div className="text-[10px] text-muted-foreground">{p.count} txn{p.count > 1 ? 's' : ''}</div>
    </div>
  )
}

export function SpendingDonut({ accountId, days = 30, onSegmentClick }: { accountId: string; days?: number; onSegmentClick?: (item: { category: string; amount: number; count: number }) => void }) {
  const [data, setData] = useState<SpendingBreakdown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setData(null); setError(null)
      try {
        const r = await api.spendingBreakdown(accountId, days)
        if (!cancelled) setData(r)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
    })()
    return () => { cancelled = true }
  }, [accountId, days])

  if (error) return <ErrorBanner message={error} />
  if (!data) return <LoadingState label="Loading spending…" />
  if (data.items.length === 0 || data.total === 0) {
    return <EmptyState title="No spending in this period" hint="Outgoing transfers will appear here." />
  }

  const chartData: DonutEntry[] = data.items.map((item, i) => ({
    name: item.category, value: item.amount, count: item.count, idx: i,
  }))
  const hovered = hoverIdx !== null ? data.items[hoverIdx] : null
  const centerLabel = hovered ? hovered.category : 'Total'
  const centerValue = hovered ? hovered.amount : data.total

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0 mx-auto" style={{ width: 144, height: 144 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={62}
              paddingAngle={1}
              isAnimationActive={true}
              animationDuration={400}
              onMouseEnter={(_, idx) => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
              onClick={(_, idx) => onSegmentClick?.(data.items[idx]!)}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={`cell-${entry.name}-${i}`}
                  fill={PALETTE[i % PALETTE.length]}
                  fillOpacity={hoverIdx === null || hoverIdx === entry.idx ? 1 : 0.3}
                  style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="max-w-[80px] truncate text-[9px] font-medium text-muted-foreground">
            {centerLabel}
          </span>
          <span className="font-mono text-xs font-bold tabular-nums">{inr(centerValue)}</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {data.items.map((item, i) => (
          <li
            key={item.category}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            onClick={() => onSegmentClick?.(item)}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition ${hoverIdx === i ? 'bg-accent' : ''} ${onSegmentClick ? 'cursor-pointer hover:bg-accent' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate font-medium">{item.category}</span>
              <span className="text-[10px] text-muted-foreground">{item.count} txn{item.count > 1 ? 's' : ''}</span>
            </div>
            <span className="font-mono text-xs tabular-nums">{inr(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
