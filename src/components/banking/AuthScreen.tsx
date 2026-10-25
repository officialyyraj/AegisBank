// Sign-in, registration, and password recovery.
'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Sparkles, Lock, Mail, User as UserIcon, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/frontend/store'
import { ForgotPasswordView } from './ForgotPasswordView'

export function AuthScreen() {
  const { login, register, loading, error, clearError } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showForgot, setShowForgot] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPw, setShowPw] = useState(false)

  function fillDemo(kind: 'alice' | 'bob' | 'admin') {
    const creds = {
      alice: ['alice@aegisbank.demo', 'Alice@12345'],
      bob: ['bob@aegisbank.demo', 'Bob@12345'],
      admin: ['admin@aegisbank.demo', 'Admin@12345'],
    }[kind]
    setEmail(creds[0])
    setPassword(creds[1])
    setMode('login')
    clearError()
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'login') await login(email, password)
    else await register(email, password, fullName)
  }

  if (showForgot) {
    return (
      <div className="aegis-hero flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <ForgotPasswordView goBack={() => setShowForgot(false)} />
      </div>
    )
  }

  return (
    <div className="aegis-hero flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl"
      >
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          {/* Brand / hero copy */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" /> Simple, secure digital banking
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                AegisBank
              </h1>
              <p className="max-w-md text-balance text-muted-foreground">
                Manage your money with confidence, wherever you are.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                ['Fast', 'Move money between your accounts in seconds'],
                ['Insightful', 'See where your money goes with clear spending insights'],
                ['Protected', 'Strong security helps keep your account safe'],
              ].map(([k, v]) => (
                <li key={k} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-4 text-primary" />
                  <span><span className="font-medium text-foreground">{k}.</span> {v}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Auth card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-2xl border bg-card/80 p-6 shadow-xl backdrop-blur-sm"
          >
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-6">
                <form onSubmit={onSubmit} className="space-y-4">
                  <Field label="Email" icon={<Mail className="size-4" />}>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                  </Field>
                  <Field label="Password" icon={<Lock className="size-4" />} trailing={
                    <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground" aria-label={showPw ? 'Hide password' : 'Show password'}>
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }>
                    <Input type={showPw ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className="pr-10" />
                  </Field>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Signing in…' : 'Sign in'} {!loading && <ArrowRight className="size-4" />}
                  </Button>
                  <div className="text-center">
                    <button type="button" onClick={() => setShowForgot(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary">
                      <KeyRound className="size-3" /> Forgot password?
                    </button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="register" className="mt-6">
                <form onSubmit={onSubmit} className="space-y-4">
                  <Field label="Full name" icon={<UserIcon className="size-4" />}>
                    <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                  </Field>
                  <Field label="Email" icon={<Mail className="size-4" />}>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                  </Field>
                  <Field label="Password" icon={<Lock className="size-4" />} trailing={
                    <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground" aria-label={showPw ? 'Hide password' : 'Show password'}>
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }>
                    <Input type={showPw ? 'text' : 'password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" autoComplete="new-password" className="pr-10" />
                  </Field>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Creating account…' : 'Create account'} {!loading && <ArrowRight className="size-4" />}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Try a sample account:</p>
              <div className="grid grid-cols-2 gap-2">
                <DemoChip onClick={() => fillDemo('alice')} role="Sample customer" name="Personal account" />
                <DemoChip onClick={() => fillDemo('admin')} role="Administrator" name="Admin account" />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

function Field({ label, icon, trailing, children }: { label: string; icon?: React.ReactNode; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
        <div className="[&_input]:pl-9 [&_input]:pr-3 [&_input.pr-10]:pr-10">{children}</div>
        {trailing}
      </div>
    </div>
  )
}

function DemoChip({ onClick, role, name }: { onClick: () => void; role: string; name: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border bg-background px-2 py-1.5 text-left transition hover:border-primary/40 hover:bg-accent"
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{role}</div>
      <div className="text-xs font-medium">{name}</div>
    </button>
  )
}
