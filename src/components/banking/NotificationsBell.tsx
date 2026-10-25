// src/components/banking/NotificationsBell.tsx — header bell with unread badge + dropdown.
'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCheck, Inbox, Mail } from 'lucide-react'
import { api, NotificationItem } from '@/lib/frontend/api'
import { timeAgo } from './primitives'

export function NotificationsBell({ onOpenAll }: { onOpenAll: () => void }) {
  const [count, setCount] = useState<number | null>(null)
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  async function loadCount() {
    try { setCount((await api.unreadCount()).count) } catch { /* ignore */ }
  }
  async function loadItems() {
    try { setItems(await api.listNotifications()) } catch { /* ignore */ }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try { if (!cancelled) setCount((await api.unreadCount()).count) } catch { /* ignore */ }
    })()
    const id = setInterval(() => { void loadCount() }, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const [items, c] = await Promise.all([api.listNotifications(), api.unreadCount()])
        if (!cancelled) { setItems(items); setCount(c.count) }
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [open])

  // close on outside click
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function markAll() {
    try { await api.markAllNotificationsRead(); await loadItems(); await loadCount() } catch { /* ignore */ }
  }

  async function markOne(id: string) {
    try { await api.markNotificationRead(id); await loadItems(); await loadCount() } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {count !== null && count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-popover shadow-xl"
          >
            <div className="flex items-center justify-between border-b px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                {count !== null && <p className="text-[10px] text-muted-foreground">{count} unread</p>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={markAll} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-accent" title="Mark all read">
                  <CheckCheck className="size-3.5" /> Mark all
                </button>
                <button onClick={() => { setOpen(false); onOpenAll() }} className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-accent">
                  View all
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto scroll-thin">
              {items === null ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading…</div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                  <div className="rounded-full bg-muted p-3"><Inbox className="size-4" /></div>
                  <p className="text-xs">No notifications yet</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {items.slice(0, 8).map((n) => (
                    <li
                      key={n.id}
                      onClick={() => !n.is_read && markOne(n.id)}
                      className={`cursor-pointer px-3 py-2.5 transition hover:bg-accent/60 ${n.is_read ? '' : 'bg-primary/5'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 rounded-md p-1.5 ${eventStyle(n.event_type)}`}>
                          {iconFor(n.event_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium capitalize">{labelFor(n.event_type)}</p>
                          <p className="line-clamp-2 text-[11px] text-muted-foreground">{n.message}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground/70">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.is_read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function iconFor(eventType: string) {
  return <Mail className="size-3" />
}
function eventStyle(eventType: string): string {
  if (eventType.includes('fraud')) return 'bg-destructive/10 text-destructive'
  if (eventType.includes('kyc')) return 'bg-amber-500/10 text-amber-600'
  if (eventType.includes('payment')) return 'bg-primary/10 text-primary'
  return 'bg-muted text-muted-foreground'
}
function labelFor(eventType: string): string {
  return eventType.split(/[._]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
