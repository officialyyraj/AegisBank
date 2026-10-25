// src/lib/frontend/useBalancePrivacy.ts — hide/show balance toggle (persisted).
'use client'
import { useCallback, useEffect, useState } from 'react'

const KEY = 'aegis_hide_balance'

export function useBalancePrivacy() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const v = window.localStorage.getItem(KEY)
        if (!cancelled) setHidden(v === '1')
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  const toggle = useCallback(() => {
    setHidden((v) => {
      const next = !v
      try { window.localStorage.setItem(KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  return { hidden, toggle }
}
