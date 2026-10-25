// src/components/banking/VirtualCard.tsx — stylised debit card visual for the dashboard.
'use client'
import { motion } from 'framer-motion'
import { Landmark, Wifi, ShieldCheck } from 'lucide-react'
import { Account } from '@/lib/frontend/api'
import { inr, maskedInr } from './primitives'

export function VirtualCard({ account, userName, hideBalance = false }: { account: Account; userName: string; hideBalance?: boolean }) {
  const displayNumber = hideBalance
    ? '•••• •••• •••• ••••'
    : account.account_number.replace(/(.{4})/g, '$1 ').trim()
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ rotateY: 2, scale: 1.01 }}
      transition={{ duration: 0.4 }}
      className="relative aspect-[1.6/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-4 text-primary-foreground shadow-lg"
    >
      {/* Decorative shapes */}
      <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/10 blur-xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-6 size-32 rounded-full bg-black/10 blur-xl" />
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%)' }} />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-80">AegisBank</p>
            <p className="text-xs font-medium opacity-90">{account.account_type} account</p>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="size-4 rotate-90 opacity-80" />
            <Landmark className="size-5" />
          </div>
        </div>

        <div>
          <p className="font-mono text-base tracking-[0.18em] sm:text-lg">{displayNumber}</p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-wider opacity-70">Available balance</p>
            <p className="font-mono text-xl font-semibold tabular-nums">{hideBalance ? maskedInr() : inr(account.balance)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider opacity-70">Card holder</p>
            <p className="text-xs font-medium uppercase tracking-wide truncate max-w-[140px]">{userName}</p>
            <div className="mt-1 flex items-center gap-1 text-[9px] opacity-80">
              <ShieldCheck className="size-3" /> Secure
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
