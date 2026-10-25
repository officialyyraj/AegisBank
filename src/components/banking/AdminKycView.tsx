// src/components/banking/AdminKycView.tsx — admin KYC document review queue.
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Check, Ban, Filter, Clock, ShieldCheck, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, KycDocumentItem } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, EmptyState, timeAgo } from './primitives'

const statusStyle: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-500/30',
  approved: 'bg-primary/10 text-primary border-primary/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
}

export function AdminKycView() {
  const [docs, setDocs] = useState<KycDocumentItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')
  const [acting, setActing] = useState<string | null>(null)

  const load = async () => {
    setError(null); setDocs(null)
    try { setDocs(await api.listKycDocuments(filter === 'all' ? undefined : filter)) }
    catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void load() }, [filter])

  async function act(id: string, decision: 'approved' | 'rejected') {
    setActing(id)
    try { await api.reviewKycDocument(id, decision); await load() }
    catch (e) { setError((e as Error).message) }
    finally { setActing(null) }
  }

  async function viewDocument(id: string) {
    try {
      const blob = await api.getKycFile(id)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) { setError((e as Error).message) }
  }

  const counts = docs?.reduce((m, d) => { m[d.status] = (m[d.status] || 0) + 1; return m }, {} as Record<string, number>) || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="size-5 text-primary" /> KYC review queue</h2>
          <p className="text-sm text-muted-foreground">Approve or reject submitted identity documents.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-9 text-xs"><Filter className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon={<Clock className="size-4" />} label="Pending" value={counts.pending || 0} tone="amber" />
        <StatCard icon={<ShieldCheck className="size-4" />} label="Approved" value={counts.approved || 0} tone="primary" />
        <StatCard icon={<Ban className="size-4" />} label="Rejected" value={counts.rejected || 0} tone="destructive" />
        <StatCard icon={<FileText className="size-4" />} label="Total" value={docs?.length || 0} tone="muted" />
      </div>

      <SectionCard title="Documents" description="Newest first">
        {error ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : docs === null ? (
          <LoadingState label="Loading documents…" />
        ) : docs.length === 0 ? (
          <EmptyState title="No documents in this view" hint="New uploads will appear here for review." />
        ) : (
          <ul className="space-y-2 max-h-[34rem] overflow-y-auto scroll-thin pr-1">
            {docs.map((d, i) => (
              <motion.li
                key={d.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.25) }}
                className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${statusStyle[d.status] || 'bg-muted'}`}>
                    <FileText className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{d.user_name}</span>
                      <Badge variant="outline" className={`text-[10px] capitalize ${statusStyle[d.status] || ''}`}>{d.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.user_email} · {d.doc_type}</p>
                    <p className="text-[10px] text-muted-foreground/70">Submitted {timeAgo(d.submitted_at)}</p>
                  </div>
                </div>
                {d.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void viewDocument(d.id)}>
                      <Eye className="size-3.5" /> View
                    </Button>
                    <Button size="sm" variant="default" disabled={acting === d.id} onClick={() => act(d.id, 'approved')}>
                      <Check className="size-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={acting === d.id} onClick={() => act(d.id, 'rejected')}>
                      <Ban className="size-3.5" /> Reject
                    </Button>
                  </div>
                )}
                {d.status !== 'pending' && (
                  <Button size="sm" variant="outline" onClick={() => void viewDocument(d.id)}><Eye className="size-3.5" /> View</Button>
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'primary' | 'amber' | 'destructive' | 'muted' }) {
  const c = {
    primary: 'text-primary bg-primary/10',
    amber: 'text-amber-600 dark:text-amber-500 bg-amber-500/10',
    destructive: 'text-destructive bg-destructive/10',
    muted: 'text-muted-foreground bg-muted',
  }[tone]
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={`rounded-md p-1.5 ${c}`}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
