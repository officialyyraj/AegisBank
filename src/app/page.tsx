'use client'
import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, ArrowRightLeft, Smartphone, FileText,
  ShieldAlert, LogOut, Menu, X, Landmark, Bell, Users, CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/frontend/store'
import { AuthScreen } from '@/components/banking/AuthScreen'
import { Dashboard } from '@/components/banking/Dashboard'
import { TransferView } from '@/components/banking/TransferView'
import { TopupView } from '@/components/banking/TopupView'
import { KycView } from '@/components/banking/KycView'
import { HistoryView } from '@/components/banking/HistoryView'
import { AdminFraudView } from '@/components/banking/AdminFraudView'
import { AdminKycView } from '@/components/banking/AdminKycView'
import { AdminAccountsView } from '@/components/banking/AdminAccountsView'
import { PayeesView } from '@/components/banking/PayeesView'
import { ScheduledTransfersView } from '@/components/banking/ScheduledTransfersView'
import { NotificationsView } from '@/components/banking/NotificationsView'
import { NotificationsBell } from '@/components/banking/NotificationsBell'
import { ThemeToggle } from '@/components/banking/ThemeToggle'
import { Footer } from '@/components/banking/Footer'

type View = 'dashboard' | 'transfer' | 'topup' | 'kyc' | 'payees' | 'scheduled' | 'admin-fraud' | 'admin-kyc' | 'admin-accounts' | 'notifications' | `history:${string}`

export default function Home() {
  const { user, hydrate, logout } = useAuth()
  const [view, setView] = useState<View>('dashboard')
  const [navOpen, setNavOpen] = useState(false)
  const [ready, setReady] = useState(false)
  // Payee-prefill: when the user clicks "Send" on a saved payee, we navigate
  // to the transfer view with the recipient pre-selected (inter-user mode).
  const [transferPrefill, setTransferPrefill] = useState<{ accountId: string; label: string } | null>(null)

  useEffect(() => {
    hydrate()
    // defer to a microtask so we don't call setState synchronously in the effect
    Promise.resolve().then(() => setReady(true))
    const onUnauthorized = () => { setView('dashboard') }
    window.addEventListener('aegis-unauthorized', onUnauthorized)
    return () => window.removeEventListener('aegis-unauthorized', onUnauthorized)
  }, [hydrate])

  const goTo = useCallback((v: string) => {
    setView(v as View)
    setNavOpen(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Navigate to transfer with a pre-selected payee recipient.
  const goToTransferWithPayee = useCallback((accountId?: string, label?: string) => {
    if (accountId && label) setTransferPrefill({ accountId, label })
    else setTransferPrefill(null)
    setView('transfer')
    setNavOpen(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (!ready) return null
  if (!user) return <AuthScreen />

  const items: { id: View; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-4" /> },
    { id: 'transfer', label: 'Transfer', icon: <ArrowRightLeft className="size-4" /> },
    { id: 'topup', label: 'Add money', icon: <Smartphone className="size-4" /> },
    { id: 'kyc', label: 'KYC', icon: <FileText className="size-4" /> },
    { id: 'payees', label: 'Payees', icon: <Users className="size-4" /> },
    { id: 'scheduled', label: 'Scheduled', icon: <CalendarClock className="size-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="size-4" /> },
    { id: 'admin-fraud', label: 'Fraud review', icon: <ShieldAlert className="size-4" />, adminOnly: true },
    { id: 'admin-kyc', label: 'KYC review', icon: <FileText className="size-4" />, adminOnly: true },
    { id: 'admin-accounts', label: 'Accounts', icon: <Landmark className="size-4" />, adminOnly: true },
  ]
  const visibleItems = items.filter((i) => !i.adminOnly || user.role === 'admin')

  const activeView = view.startsWith('history:') ? 'history' : view
  const activeAccountId = view.startsWith('history:') ? view.slice('history:'.length) : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5 text-primary-foreground">
              <Landmark className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">AegisBank</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Digital Banking</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleItems.map((i) => (
              <NavButton key={i.id} active={activeView === i.id} onClick={() => goTo(i.id)} icon={i.icon} label={i.label} />
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationsBell onOpenAll={() => goTo('notifications')} />
            <div className="hidden sm:flex flex-col items-end leading-tight pr-1">
              <span className="text-xs font-medium">{user.email}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{user.role}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Sign out"><LogOut className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setNavOpen((v) => !v)}>
              {navOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile nav — horizontal scroll for many items */}
        <AnimatePresence>
          {navOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t"
            >
              <div className="flex gap-1 overflow-x-auto scroll-thin px-3 py-2">
                {visibleItems.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => goTo(i.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      activeView === i.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {i.icon}
                    {i.label}
                  </button>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {activeView === 'dashboard' && <Dashboard goTo={goTo} />}
            {activeView === 'transfer' && <TransferView prefill={transferPrefill} onConsumedPrefill={() => setTransferPrefill(null)} />}
            {activeView === 'topup' && <TopupView />}
            {activeView === 'kyc' && <KycView />}
            {activeView === 'payees' && <PayeesView goToTransfer={goToTransferWithPayee} />}
            {activeView === 'scheduled' && <ScheduledTransfersView />}
            {activeView === 'notifications' && <NotificationsView />}
            {activeView === 'admin-fraud' && (user.role === 'admin' ? <AdminFraudView /> : <NoAccess />)}
            {activeView === 'admin-kyc' && (user.role === 'admin' ? <AdminKycView /> : <NoAccess />)}
            {activeView === 'admin-accounts' && (user.role === 'admin' ? <AdminAccountsView /> : <NoAccess />)}
            {activeView === 'history' && activeAccountId && (
              <HistoryView accountId={activeAccountId} goBack={() => goTo('dashboard')} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  )
}

function NavButton({ active, onClick, icon, label, full }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; full?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      } ${full ? 'justify-start' : ''}`}
    >
      {icon}
      {label}
    </button>
  )
}

function NoAccess() {
  return (
    <div className="rounded-xl border bg-muted/30 p-8 text-center">
      <ShieldAlert className="mx-auto mb-2 size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Admin access required</p>
      <p className="text-xs text-muted-foreground">Sign in with an administrator account to view this page.</p>
    </div>
  )
}
