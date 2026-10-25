// src/components/banking/NotificationsView.tsx — full-page notifications inbox.
'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, CheckCheck, Mail, ShieldAlert, FileText, Send, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, NotificationItem } from '@/lib/frontend/api'
import { SectionCard, LoadingState, ErrorBanner, EmptyState, timeAgo } from './primitives'

export function NotificationsView() {
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)

  const load = async () => {
    setError(null); setItems(null)
    try { setItems(await api.listNotifications()) } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void load() }, [])

  async function markAll() {
    setMarking(true)
    try { await api.markAllNotificationsRead(); await load() } finally { setMarking(false) }
  }
  async function markOne(id: string) {
    try { await api.markNotificationRead(id); await load() } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="size-5 text-primary" /> Notifications</h2>
          <p className="text-sm text-muted-foreground">All system alerts — transfers, fraud flags, KYC, payments.</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAll} disabled={marking || items === null}>
          <CheckCheck className="size-3.5" /> Mark all read
        </Button>
      </div>

      <SectionCard title="Inbox" description="Newest first">
        {error ? (
          <ErrorBanner message={error} onRetry={load} />
        ) : items === null ? (
          <LoadingState label="Loading notifications…" />
        ) : items.length === 0 ? (
          <EmptyState title="No notifications" hint="Make a transfer or add money to generate activity." />
        ) : (
          <ul className="divide-y max-h-[34rem] overflow-y-auto scroll-thin pr-1">
            {items.map((n, i) => (
              <motion.li
                key={n.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.25) }}
                onClick={() => !n.is_read && markOne(n.id)}
                className={`flex cursor-pointer items-start gap-3 py-3 transition hover:bg-accent/40 ${n.is_read ? 'opacity-70' : 'bg-primary/5'} -mx-2 px-2 rounded-md`}
              >
                <div className={`mt-0.5 rounded-lg p-2 ${eventStyle(n.event_type)}`}>
                  {iconFor(n.event_type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{labelFor(n.event_type)}</span>
                    {!n.is_read && <span className="size-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground/70">
                    <span>{timeAgo(n.created_at)}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 uppercase">{n.channel}</span>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

function iconFor(eventType: string) {
  if (eventType.includes('fraud')) return <ShieldAlert className="size-3.5" />
  if (eventType.includes('kyc')) return <FileText className="size-3.5" />
  if (eventType.includes('payment')) return <Send className="size-3.5" />
  if (eventType.includes('transaction')) return <Send className="size-3.5" />
  return <Mail className="size-3.5" />
}
function eventStyle(eventType: string): string {
  if (eventType.includes('fraud')) return 'bg-destructive/10 text-destructive'
  if (eventType.includes('kyc')) return 'bg-amber-500/10 text-amber-600'
  if (eventType.includes('payment')) return 'bg-primary/10 text-primary'
  if (eventType.includes('transaction')) return 'bg-primary/10 text-primary'
  return 'bg-muted text-muted-foreground'
}
function labelFor(eventType: string): string {
  return eventType.split(/[._]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// silence unused
void Inbox
