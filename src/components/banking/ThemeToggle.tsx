// src/components/banking/ThemeToggle.tsx — light/dark mode toggle (persisted).
'use client'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const KEY = 'aegis-theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let t: 'light' | 'dark' = 'light'
      try {
        const stored = window.localStorage.getItem(KEY)
        if (stored === 'dark' || stored === 'light') t = stored
        else if (window.matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark'
      } catch { /* ignore */ }
      if (!cancelled) { setTheme(t); setMounted(true) }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try { window.localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  }, [theme, mounted])

  if (!mounted) return <div className="size-8" />

  return (
    <button
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
