// src/components/banking/primitives.tsx — shared UI helpers.
'use client'
import { ReactNode } from 'react'
import { Loader2, AlertTriangle, Inbox } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className || ''}`} />
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
      <Spinner className="size-5" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs">{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="text-xs font-medium underline underline-offset-2">
            Retry
          </button>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
      <div className="rounded-full bg-muted p-3">
        <Inbox className="size-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs">{hint}</p>}
    </div>
  )
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function inr(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (Number.isNaN(n)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n)
}

/** Format an amount but with the value masked — for the "hide balance" privacy toggle. */
export function maskedInr(): string {
  return '₹ • • • • •'
}

export function maskAccount(num: string): string {
  if (!num || num.length < 4) return num
  return num.slice(0, 3) + '••••' + num.slice(-3)
}

export function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
