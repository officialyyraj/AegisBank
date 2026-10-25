// src/components/banking/TransferView.tsx — internal + inter-user fund transfer (Saga).
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Send, CheckCircle2, Search, UserSearch, Wallet, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { api, Account, Transaction } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, inr, maskAccount } from './primitives'
import { ConfirmModal } from './ConfirmModal'

type Mode = 'own' | 'other'

export function TransferView({ prefill, onConsumedPrefill }: { prefill?: { accountId: string; label: string } | null; onConsumedPrefill?: () => void }) {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('own')
  const [src, setSrc] = useState('')
  const [dst, setDst] = useState('') // for "own" mode
  const [recipientNumber, setRecipientNumber] = useState('') // for "other" mode
  const [lookup, setLookup] = useState<{ account_id: string; account_type: string; holder: string } | null>(null)
  const [looking, setLooking] = useState(false)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Transaction | null>(null)
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    api.listAccounts().then(setAccounts).catch((e) => setError((e as Error).message))
  }, [])

  // Consume a payee prefill: switch to "other" mode + pre-set the lookup.
  useEffect(() => {
    if (!prefill) return
    setMode('other')
    setLookup({ account_id: prefill.accountId, account_type: 'savings', holder: prefill.label })
    setRecipientNumber('•••• (saved payee)')
    onConsumedPrefill?.()
  }, [prefill, onConsumedPrefill])

  const srcAcc = accounts?.find((a) => a.id === src)
  const canSendOwn = src && dst && src !== dst && parseFloat(amount) > 0 && !busy
  const canSendOther = src && lookup && parseFloat(amount) > 0 && !busy

  async function doLookup() {
    setLooking(true); setError(null); setLookup(null)
    try {
      const r = await api.lookupAccount(recipientNumber)
      setLookup(r)
    } catch (e) {
      setError((e as Error).message)
    } finally { setLooking(false) }
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const LARGE_AMOUNT_THRESHOLD = Number(process.env.NEXT_PUBLIC_LARGE_AMOUNT_THRESHOLD_INR || 10000) // ₹10,000 default — env-configurable (Design note)

  async function doTransfer() {
    const destId = mode === 'own' ? dst : lookup?.account_id
    if (!src || !destId || parseFloat(amount) <= 0 || busy) return
    setBusy(true); setError(null); setResult(null)
    try {
      const txn = await api.transfer(src, destId, parseFloat(amount), category || undefined, note || undefined)
      setResult(txn)
      toast({ title: 'Transfer completed', description: `${inr(amount)} sent successfully.` })
      setAmount('')
      setRecipientNumber('')
      setLookup(null)
      setCategory('')
      setNote('')
      const fresh = await api.listAccounts()
      setAccounts(fresh)
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      toast({ title: 'Transfer failed', description: msg, variant: 'destructive' })
    }
    finally { setBusy(false) }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const destId = mode === 'own' ? dst : lookup?.account_id
    if (!src || !destId || parseFloat(amount) <= 0 || busy) return
    // Large-amount confirmation gate (Design note).
    if (parseFloat(amount) >= LARGE_AMOUNT_THRESHOLD) {
      setConfirmOpen(true)
      return
    }
    await doTransfer()
  }

  async function confirmAndTransfer() {
    setConfirmOpen(false)
    await doTransfer()
  }

  if (accounts === null && !error) return <SectionCard title="Transfer funds"><LoadingState label="Loading accounts…" /></SectionCard>

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <SectionCard title="Transfer funds" description="Move money between your accounts or send to another AegisBank customer.">
        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {accounts && accounts.length < 2 && mode === 'own' && (
          <p className="text-sm text-muted-foreground py-6 text-center">You need at least two accounts to transfer between your own. Switch to “To another user” or create another account.</p>
        )}

        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setError(null); setLookup(null); setRecipientNumber('') }}>
          <TabsList className="grid w-full grid-cols-2 mb-5">
            <TabsTrigger value="own" className="gap-1.5"><Wallet className="size-3.5" /> My accounts</TabsTrigger>
            <TabsTrigger value="other" className="gap-1.5"><UserSearch className="size-3.5" /> To another user</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={submit} className="space-y-5">
          {/* Source — always own account */}
          <AccountSelect label="From (your account)" accounts={accounts || []} value={src} onChange={setSrc} />

          {/* Destination — depends on mode */}
          {mode === 'own' ? (
            <AccountSelect label="To (your account)" accounts={(accounts || []).filter((a) => a.id !== src)} value={dst} onChange={setDst} />
          ) : (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Recipient account number</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    value={recipientNumber}
                    onChange={(e) => { setRecipientNumber(e.target.value); setLookup(null) }}
                    placeholder="AEG0000000000"
                    className="font-mono pl-9"
                  />
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <Button type="button" variant="outline" onClick={doLookup} disabled={!recipientNumber || looking}>
                  {looking ? 'Looking…' : 'Look up'}
                </Button>
              </div>
              {lookup && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between rounded-lg border bg-primary/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserSearch className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lookup.holder}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{lookup.account_type} account · {maskAccount(recipientNumber)}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Verified</Badge>
                </motion.div>
              )}
              {!lookup && recipientNumber && !looking && (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <AlertCircle className="size-3" /> Look up the recipient to confirm before sending.
                </p>
              )}
            </div>
          )}

          {/* Visual flow */}
          <div className="flex items-center justify-center gap-3 py-1">
            <AccountChip acc={srcAcc} fallback="Select source" />
            <ArrowRight className="size-4 text-muted-foreground" />
            {mode === 'own' ? (
              <AccountChip acc={accounts?.find((a) => a.id === dst)} fallback="Select destination" />
            ) : (
              <RecipientChip holder={lookup?.holder} number={recipientNumber} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amt" className="text-xs font-medium text-muted-foreground">Amount (INR)</Label>
            <Input id="amt" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            {srcAcc && amount && (
              <p className="text-xs text-muted-foreground">
                New balance after transfer: <span className="font-medium text-foreground">{inr(parseFloat(srcAcc.balance) - parseFloat(amount || '0'))}</span>
              </p>
            )}
          </div>

          {/* Category + note (Design note) — optional, for spending analytics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Category (optional)</Label>
              <Select value={category} onValueChange={(v) => setCategory(v === '__none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Uncategorized</SelectItem>
                  <SelectItem value="Rent">Rent</SelectItem>
                  <SelectItem value="Groceries">Groceries</SelectItem>
                  <SelectItem value="Dining">Dining</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Loan">Loan</SelectItem>
                  <SelectItem value="Savings">Savings</SelectItem>
                  <SelectItem value="Entertainment">Entertainment</SelectItem>
                  <SelectItem value="Refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. monthly rent" />
            </div>
          </div>

          <Button
            type="submit"
            disabled={mode === 'own' ? !canSendOwn : !canSendOther}
            className="w-full"
          >
            {busy ? 'Transferring…' : 'Send money'} {!busy && <Send className="size-4" />}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Receipt" description="Last transfer result">
        {result ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-medium">Transfer completed</span>
            </div>
            <Row k="Transaction ID" v={<span className="font-mono text-xs">{result.id}</span>} />
            <Row k="Amount" v={<span className="font-semibold">{inr(result.amount)}</span>} />
            <Row k="Status" v={<span>{result.status === 'completed' ? 'Completed' : result.status === 'pending' ? 'Processing' : 'Failed'}</span>} />
            <Row k="Time" v={new Date(result.created_at).toLocaleString('en-IN')} />
          </motion.div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No transfer yet.</p>
        )}
      </SectionCard>

      {/* Large-amount confirmation modal (Design note) */}
      <ConfirmModal
        open={confirmOpen}
        tone="warning"
        title="Confirm large transfer"
        description={`You're about to transfer ${inr(amount)}. Please confirm this is intentional.`}
        confirmLabel="Confirm & send"
        onConfirm={confirmAndTransfer}
        onCancel={() => setConfirmOpen(false)}
      >
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{inr(amount)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-muted-foreground">From</span><span className="font-mono text-xs">{srcAcc ? maskAccount(srcAcc.account_number) : '—'}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-muted-foreground">To</span><span className="font-mono text-xs">{mode === 'own' ? (accounts?.find((a) => a.id === dst) ? maskAccount(accounts!.find((a) => a.id === dst)!.account_number) : '—') : (lookup?.holder || '—')}</span></div>
        </div>
      </ConfirmModal>
    </div>
  )
}

function AccountSelect({ label, accounts, value, onChange }: { label: string; accounts: Account[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {maskAccount(a.account_number)} · {inr(a.balance)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function AccountChip({ acc, fallback }: { acc?: Account; fallback: string }) {
  if (!acc) return <span className="text-xs text-muted-foreground">{fallback}</span>
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
      <div className="font-mono text-xs">{maskAccount(acc.account_number)}</div>
      <div className="text-[10px] text-muted-foreground">{inr(acc.balance)}</div>
    </div>
  )
}

function RecipientChip({ holder, number }: { holder?: string; number: string }) {
  if (!holder) {
    return <span className="text-xs text-muted-foreground">{number ? 'Look up recipient' : 'Enter account no.'}</span>
  }
  return (
    <div className="rounded-lg border bg-primary/5 px-3 py-2 text-center">
      <div className="text-xs font-medium">{holder}</div>
      <div className="font-mono text-[10px] text-muted-foreground">{maskAccount(number)}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  )
}
