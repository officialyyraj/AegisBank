// src/components/banking/ForgotPasswordView.tsx — request + reset password flow.
'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiRequestError } from '@/lib/frontend/api'
import { SectionCard } from './primitives'

export function ForgotPasswordView({ goBack }: { goBack: () => void }) {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('token') ? 'reset' : 'request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : '')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function requestReset(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await api.forgotPassword(email)
      setStep('reset')
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await api.resetPassword(token, newPassword)
      setStep('done')
    } catch (e) {
      const msg = e instanceof ApiRequestError ? `${e.code}: ${e.message}` : (e as Error).message
      setError(msg)
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <button onClick={goBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </button>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <SectionCard title="Reset password" description="Secure, single-use token · expires in 15 minutes">
          {step === 'request' && (
            <form onSubmit={requestReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Sending…' : 'Send reset link'} {!busy && <KeyRound className="size-4" />}
              </Button>
              <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
                If that email exists, we&apos;ve sent reset instructions.
              </p>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={doReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Reset token</Label>
                <Input required value={token} onChange={(e) => setToken(e.target.value)} placeholder="paste token" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">New password (min 8)</Label>
                <Input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Resetting…' : 'Reset password'}
              </Button>
            </form>
          )}

          {step === 'done' && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="rounded-full bg-primary/10 p-3 text-primary"><CheckCircle2 className="size-7" /></div>
              <p className="text-sm font-medium">Password reset successfully</p>
              <p className="text-xs text-muted-foreground">You can now sign in with your new password.</p>
              <Button onClick={goBack} className="mt-2">Back to sign in</Button>
            </motion.div>
          )}
        </SectionCard>
      </motion.div>
    </div>
  )
}

void AlertCircle
