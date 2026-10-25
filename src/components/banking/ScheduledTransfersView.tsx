// src/components/banking/ScheduledTransfersView.tsx — recurring/scheduled transfers.
'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarClock, Plus, Trash2, Play, Pause, Check, RefreshCw, Repeat, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { api, Account, ScheduledTransfer } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, EmptyState, inr, timeAgo } from './primitives'

const freqLabel = { once: 'One-time', weekly: 'Weekly', monthly: 'Monthly' } as const
const statusStyle: Record<string, string> = {
  active: 'bg-primary/10 text-primary border-primary/30',
  paused: 'bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/30',
  completed: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/10 text-destructive border-destructive/30',
}

export function ScheduledTransfersView() {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [list, setList] = useState<ScheduledTransfer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [src, setSrc] = useState('')
  const [dst, setDst] = useState('')
  const [amount, setAmount] = useState('')
  const [freq, setFreq] = useState<'once' | 'weekly' | 'monthly'>('weekly')
  const [startDate, setStartDate] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [acting, setActing] = useState<string | null>(null)

  const load = async () => {
    setError(null); setList(null)
    try {
      const [a, s] = await Promise.all([api.listAccounts(), api.listScheduled()])
      setAccounts(a); setList(s)
    } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!src || !dst || !amount || !startDate || src === dst) return
    setBusy(true); setError(null)
    try {
      // start_at must be an ISO datetime with timezone (zod .datetime())
      const iso = new Date(startDate).toISOString()
      await api.createScheduled({
        source_account_id: src,
        destination_account_id: dst,
        amount: parseFloat(amount),
        frequency: freq,
        start_at: iso,
        note: note || null,
      })
      setShowAdd(false); setSrc(''); setDst(''); setAmount(''); setFreq('weekly'); setStartDate(''); setNote('')
      await load()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  async function togglePause(s: ScheduledTransfer) {
    setActing(s.id)
    try {
      await api.updateScheduled(s.id, { status: s.status === 'active' ? 'paused' : 'active' })
      await load()
    } catch (e) { setError((e as Error).message) }
    finally { setActing(null) }
  }

  async function remove(id: string) {
    setActing(id)
    try { await api.deleteScheduled(id); await load() }
    catch (e) { setError((e as Error).message) }
    finally { setActing(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="size-5 text-primary" /> Scheduled transfers</h2>
          <p className="text-sm text-muted-foreground">Automate recurring payments — a background worker executes due transfers every 60s.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="size-3.5" /></Button>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="size-3.5" /> New schedule
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="New scheduled transfer" description="The first run executes at the start date; recurring schedules repeat weekly/monthly.">
              <form onSubmit={create} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">From (your account)</Label>
                    <Select value={src} onValueChange={setSrc}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {(accounts || []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.account_number.slice(-4)} · {inr(a.balance)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">To (your other account)</Label>
                    <Select value={dst} onValueChange={setDst}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {(accounts || []).filter((a) => a.id !== src).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.account_number.slice(-4)} · {inr(a.balance)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Amount (INR)</Label>
                    <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Frequency</Label>
                    <Select value={freq} onValueChange={(v) => setFreq(v as 'once' | 'weekly' | 'monthly')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">One-time</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Start date</Label>
                    <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Note (optional)</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. monthly rent" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy || !src || !dst || !amount || !startDate || src === dst}>
                    {busy ? 'Creating…' : 'Create schedule'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                </div>
              </form>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionCard title="Your schedules" description={list ? `${list.length} schedule${list.length === 1 ? '' : 's'}` : 'Loading…'}>
        {error ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : list === null ? (
          <LoadingState label="Loading schedules…" />
        ) : list.length === 0 ? (
          <EmptyState title="No scheduled transfers" hint="Create one to automate a recurring payment." />
        ) : (
          <ul className="divide-y">
            {list.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${s.frequency === 'once' ? 'bg-muted' : 'bg-primary/10 text-primary'}`}>
                    {s.frequency === 'once' ? <Check className="size-4" /> : <Repeat className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{inr(s.amount)}</span>
                      <Badge variant="outline" className={`text-[10px] capitalize ${statusStyle[s.status] || ''}`}>{s.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">{freqLabel[s.frequency]}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {s.source_account_number} → {s.destination_account_number}{s.destination_holder ? ` (${s.destination_holder})` : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {s.status === 'active' ? `Next: ${new Date(s.next_run_at).toLocaleString('en-IN')}` : ''}
                      {s.last_run_at ? ` · Last: ${timeAgo(s.last_run_at)}` : ''}
                      {s.note ? ` · ${s.note}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {s.status !== 'completed' && s.status !== 'failed' && (
                    <Button variant="ghost" size="icon" className="size-7" disabled={acting === s.id} onClick={() => togglePause(s)} title={s.status === 'active' ? 'Pause' : 'Resume'}>
                      {s.status === 'active' ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" disabled={acting === s.id} onClick={() => remove(s.id)} title="Delete">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

void Clock
