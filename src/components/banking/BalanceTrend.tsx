// src/components/banking/BalanceTrend.tsx — Recharts AreaChart of the account's balance history.
'use client'
import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api, BalancePoint } from '@/lib/frontend/api'
import { inr } from './primitives'

const STROKE = '#0d9488' // emerald-600
const STROKE_DOWN = '#dc2626' // red-600

interface TooltipProps { active?: boolean; payload?: Array<{ payload: BalancePoint }>; }

function BalanceTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]!.payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{p.date}</div>
      <div className="font-mono font-semibold tabular-nums">{inr(p.balance)}</div>
    </div>
  )
}

export function BalanceTrend({ accountId, days = 30 }: { accountId: string; days?: number }) {
  const [points, setPoints] = useState<BalancePoint[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setPoints(null)
      try {
        const p = await api.balanceHistory(accountId, days)
        if (!cancelled) setPoints(p)
      } catch {
        if (!cancelled) setPoints([])
      }
    })()
    return () => { cancelled = true }
  }, [accountId, days])

  if (points === null) {
    return <div className="h-20 w-full animate-pulse rounded-lg bg-muted/50" />
  }
  if (points.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No balance history yet.</p>
  }

  const vals = points.map((p) => p.balance)
  const first = vals[0] ?? 0
  const last = vals[vals.length - 1] ?? 0
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const changePct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0
  const up = changePct >= 0
  const color = up ? STROKE : STROKE_DOWN

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-semibold tabular-nums">{inr(last)}</span>
          <span className={`text-xs font-medium ${up ? 'text-primary' : 'text-destructive'}`}>
            {up ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}%
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">last {days}d · range {inr(lo)}–{inr(hi)}</span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="balGradRecharts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis domain={[lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1]} hide />
          <Tooltip content={<BalanceTooltip />} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={color}
            strokeWidth={2}
            fill="url(#balGradRecharts)"
            isAnimationActive={true}
            animationDuration={400}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 1 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
