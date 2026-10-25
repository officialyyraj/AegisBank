// src/components/banking/PayeesView.tsx — saved-payee (contacts) management.
'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Plus, Trash2, Search, Mail, UserCheck, Edit3, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { api, Payee, ApiRequestError } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, EmptyState, timeAgo } from './primitives'

export function PayeesView({ goToTransfer }: { goToTransfer: (payeeAccountId?: string, payeeNickname?: string) => void }) {
  const [payees, setPayees] = useState<Payee[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookup, setLookup] = useState<{ account_id: string; holder: string; account_number: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNick, setEditNick] = useState('')

  const load = async () => {
    setError(null); setPayees(null)
    try { setPayees(await api.listPayees()) } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void load() }, [])

  async function doLookup() {
    setLooking(true); setError(null); setLookup(null)
    try {
      const r = await api.lookupByEmail(email)
      setLookup({ account_id: r.account_id, holder: r.holder, account_number: r.account_number })
    } catch (e) {
      setError(e instanceof ApiRequestError ? `${e.code}: ${e.message}` : (e as Error).message)
    } finally { setLooking(false) }
  }

  async function savePayee() {
    if (!lookup) return
    setSaving(true); setError(null)
    try {
      await api.createPayee(lookup.account_id, nickname || null)
      setShowAdd(false); setEmail(''); setNickname(''); setLookup(null)
      await load()
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function removePayee(id: string) {
    try { await api.deletePayee(id); await load() }
    catch (e) { setError((e as Error).message) }
  }

  async function saveEdit(id: string) {
    try { await api.updatePayee(id, editNick || null); setEditingId(null); await load() }
    catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5 text-primary" /> Payees</h2>
          <p className="text-sm text-muted-foreground">Saved contacts for quick transfers — look up by email, no need to memorize account numbers.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="size-3.5" /> Add payee
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <SectionCard title="Add a payee" description="Look up by their registered email">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Recipient email</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setLookup(null) }} placeholder="recipient@example.com" className="pl-9" />
                    </div>
                    <Button type="button" variant="outline" onClick={doLookup} disabled={!email || looking}>
                      {looking ? 'Searching…' : <><Search className="size-3.5" /> Look up</>}
                    </Button>
                  </div>
                </div>

                {lookup && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between rounded-lg border bg-primary/5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><UserCheck className="size-4" /></div>
                      <div>
                        <p className="text-sm font-medium">{lookup.holder}</p>
                        <p className="text-[11px] text-muted-foreground">{lookup.account_number}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Verified</Badge>
                  </motion.div>
                )}

                {lookup && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Nickname (optional)</Label>
                    <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Bob rent" />
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-2">
                  <Button onClick={savePayee} disabled={!lookup || saving}>
                    {saving ? 'Saving…' : 'Save payee'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowAdd(false); setEmail(''); setNickname(''); setLookup(null); setError(null) }}>Cancel</Button>
                </div>
              </div>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionCard title="Your saved payees" description={`${payees?.length || 0} contact${payees?.length === 1 ? '' : 's'}`}>
        {error && !showAdd ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : payees === null ? (
          <LoadingState label="Loading payees…" />
        ) : payees.length === 0 ? (
          <EmptyState title="No saved payees" hint="Click “Add payee” to save a contact for quick transfers." />
        ) : (
          <ul className="divide-y">
            {payees.map((p, i) => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {p.holder_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-1">
                        <Input value={editNick} onChange={(e) => setEditNick(e.target.value)} placeholder={p.holder_name} className="h-7 w-32 text-xs" autoFocus />
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => saveEdit(p.id)}><Check className="size-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => setEditingId(null)}><X className="size-3.5" /></Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium">{p.nickname || p.holder_name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.account_number} · added {timeAgo(p.created_at)}</p>
                      </>
                    )}
                  </div>
                </div>
                {editingId !== p.id && (
                  <div className="flex items-center gap-1">
                    <Button variant="link" size="sm" className="h-7 px-2 text-xs" onClick={() => goToTransfer(p.target_account_id, p.nickname || p.holder_name)}>
                      Send
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditingId(p.id); setEditNick(p.nickname || '') }} title="Edit nickname">
                      <Edit3 className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => removePayee(p.id)} title="Remove">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
