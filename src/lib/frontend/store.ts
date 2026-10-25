// src/lib/frontend/store.ts — Zustand auth store (requirements : React Context
// alternative; Zustand is already in the stack). Holds the decoded user;
// the raw JWT lives in localStorage (handled by api.ts).
import { create } from 'zustand'
import { api, setTokens, clearTokens } from './api'

export interface SessionUser {
  id: string
  email: string
  role: 'customer' | 'admin'
}

interface AuthState {
  user: SessionUser | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, fullName: string) => Promise<boolean>
  logout: () => void
  hydrate: () => void
  clearError: () => void
}

function decodeUser(access: string): SessionUser | null {
  try {
    const payload = JSON.parse(atob(access.split('.')[1]!))
    return { id: payload.sub, email: payload.email, role: payload.role }
  } catch {
    return null
  }
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const r = await api.login(email, password)
      setTokens(r.access_token, r.refresh_token)
      const user = decodeUser(r.access_token)
      set({ user, loading: false })
      return true
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      return false
    }
  },
  register: async (email, password, fullName) => {
    set({ loading: true, error: null })
    try {
      await api.register(email, password, fullName)
      // auto-login after register
      const r = await api.login(email, password)
      setTokens(r.access_token, r.refresh_token)
      const user = decodeUser(r.access_token)
      set({ user, loading: false })
      return true
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
      return false
    }
  },
  logout: () => {
    void api.logoutEverywhere().catch(() => undefined)
    clearTokens()
    set({ user: null, error: null })
  },
  hydrate: () => {
    if (typeof window === 'undefined') return
    const access = window.localStorage.getItem('aegis_access')
    if (access) {
      const user = decodeUser(access)
      if (user) set({ user })
    }
  },
  clearError: () => set({ error: null }),
}))
