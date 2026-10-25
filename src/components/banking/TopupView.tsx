// Add-money account funding flow.
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Smartphone, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { api, Account, Payment } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, inr, maskAccount } from './primitives'

export function TopupView() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acctId, setAcctId] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Payment | null>(null)

  useEffect(() => {
    api.listAccounts().then(setAccounts).catch((e) => setError((e as Error).message))
  }, [])

  const canSubmit = acctId && parseFloat(amount) > 0 && !busy

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const p = await api.topup(acctId, parseFloat(amount))
      setResult(p)
      if (p.status === 'completed') {
        toast({ title: 'Money added', description: `${inr(p.amount)} credited to your account.` })
      } else {
        toast({ title: 'Add money failed', description: 'We could not add money right now. Please try again.', variant: 'destructive' })
      }
      setAmount('')
      const fresh = await api.listAccounts()
      setAccounts(fresh)
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      toast({ title: 'Add money failed', description: msg, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  if (accounts === null && !error) return <SectionCard title="Add money"><LoadingState label="Loading accounts…" /></SectionCard>

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <SectionCard title="Add money" description="Add money securely to one of your AegisBank accounts.">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Credit to account</Label>
            <Select value={acctId} onValueChange={setAcctId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {(accounts || []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {maskAccount(a.account_number)} · {inr(a.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amt" className="text-xs font-medium text-muted-foreground">Amount (INR)</Label>
            <div className="relative">
              <Input id="amt" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-9" />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Zap className="size-4" /></span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[500, 1000, 5000, 10000].map((q) => (
                <button key={q} type="button" onClick={() => setAmount(String(q))} className="rounded-md border bg-background px-2 py-1 text-xs hover:border-primary/40 hover:bg-accent">
                  +{inr(q)}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {busy ? <><Loader2 className="size-4 animate-spin" /> Processing…</> : <><Smartphone className="size-4" /> Add money</>}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Payment status" description="Your latest add-money request">
        {result ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
            <div className={`flex items-center gap-2 ${result.status === 'completed' ? 'text-primary' : 'text-destructive'}`}>
              {result.status === 'completed' ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
              <span className="text-sm font-medium capitalize">{result.status}</span>
            </div>
            <div className="flex items-center justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{inr(result.amount)}</span>
            </div>
            <div className="flex items-center justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">Provider ref</span>
              <span className="font-mono text-xs">{result.provider_ref}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">Time</span>
              <span>{new Date(result.created_at).toLocaleString('en-IN')}</span>
            </div>
          </motion.div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No payment yet.</p>
        )}
      </SectionCard>
    </div>
  )
}
