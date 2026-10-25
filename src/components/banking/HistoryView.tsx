// src/components/banking/HistoryView.tsx — account statement with search + filter + cursor pagination.
'use client'
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, Download, Search, Filter, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, Account, Transaction } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, EmptyState, inr, maskAccount, timeAgo } from './primitives'

type Direction = 'all' | 'debit' | 'credit'
const PAGE_SIZE = 20

export function HistoryView({ accountId, goBack }: { accountId: string; goBack: () => void }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [txns, setTxns] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<Direction>('all')
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Fetch first page (resets on accountId/search/direction change)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setError(null); setTxns([])
      try {
        const [a, page] = await Promise.all([
          api.getAccount(accountId),
          api.getStatementPage(accountId, {
            direction: direction === 'all' ? undefined : direction,
            search: search || undefined,
            limit: PAGE_SIZE,
          }),
        ])
        if (!cancelled) {
          setAccount(a)
          setTxns(page.items)
          setNextCursor(page.next_cursor)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [accountId, search, direction])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await api.getStatementPage(accountId, {
        direction: direction === 'all' ? undefined : direction,
        search: search || undefined,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      })
      setTxns((prev) => [...prev, ...page.items])
      setNextCursor(page.next_cursor)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, loadingMore, accountId, direction, search])

  function downloadPdf(id: string) {
    const tok = window.localStorage.getItem('aegis_access')
    const url = api.statementPdfUrl(id)
    ;(async () => {
      try {
        const res = await fetch(url, tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const objUrl = URL.createObjectURL(blob)
        window.open(objUrl, '_blank')
        setTimeout(() => URL.revokeObjectURL(objUrl), 60000)
      } catch (e) { setError((e as Error).message) }
    })()
  }

  function downloadCsv(id: string) {
    ;(async () => {
      try {
        const tok = window.localStorage.getItem('aegis_access')
        const url = api.statementCsvUrl(id) + (direction !== 'all' || search ? '?' + new URLSearchParams({
          ...(direction !== 'all' ? { direction } : {}),
          ...(search ? { search } : {}),
        }).toString() : '')
        const res = await fetch(url, tok ? { headers: { Authorization: `Bearer ${tok}` } } : undefined)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const u = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = u
        a.download = `statement_${account?.account_number || id}_${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(u)
      } catch (e) { setError((e as Error).message) }
    })()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Account statement</h2>
          {account && (
            <p className="text-sm text-muted-foreground">
              {maskAccount(account.account_number)} · <span className="capitalize">{account.account_type}</span> · {inr(account.balance)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {account && (
            <>
              <Button variant="outline" size="sm" onClick={() => downloadPdf(account.id)} disabled={txns.length === 0 && !loading}>
                <FileText className="size-3.5" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadCsv(account.id)} disabled={txns.length === 0 && !loading}>
                <Download className="size-3.5" /> CSV
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={goBack}>← Back</Button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by transaction ID…"
            className="pl-9"
          />
        </div>
        <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
          <SelectTrigger className="w-full sm:w-40"><Filter className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All movements</SelectItem>
            <SelectItem value="debit">Sent only</SelectItem>
            <SelectItem value="credit">Received only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <SectionCard title="Transactions" description={loading ? 'Loading…' : `${txns.length} shown${nextCursor ? ' (more available)' : ''}`}>
        {error ? (
          <ErrorBanner message={error} />
        ) : loading ? (
          <LoadingState label="Loading transactions…" />
        ) : txns.length === 0 ? (
          <EmptyState title="No matching transactions" hint={search || direction !== 'all' ? 'Try adjusting your filters.' : 'Make a transfer or add money to see activity here.'} />
        ) : (
          <>
            <ul className="space-y-2 max-h-[28rem] overflow-y-auto scroll-thin pr-1">
              {txns.map((t, i) => {
                const outgoing = t.source_account_id === accountId
                return (
                  <motion.li
                    key={t.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${outgoing ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                        {outgoing ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{outgoing ? 'Sent' : 'Received'}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(t.created_at)} · <span className="font-mono">{t.id.slice(-8)}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${outgoing ? 'text-destructive' : 'text-primary'}`}>
                        {outgoing ? '-' : '+'}{inr(t.amount)}
                      </p>
                      <Badge variant="outline" className="text-[10px] capitalize">{t.status}</Badge>
                    </div>
                  </motion.li>
                )
              })}
            </ul>
            {nextCursor && (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <><Loader2 className="size-3.5 animate-spin" /> Loading…</> : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  )
}
