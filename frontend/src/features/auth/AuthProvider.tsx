import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import type { AuthUser } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const generation = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    const version = generation.current
    try { localStorage.removeItem('forkoff:user') } catch { /* Storage is optional. */ }
    fetch('/api/auth/session', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not restore session.')
      const result = await response.json()
      if (generation.current === version) setUser(result.user)
    }).catch(() => {}).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [])
  const signIn = useCallback((nextUser: AuthUser) => {
    generation.current++; setUser(nextUser); setLoading(false)
  }, [])
  const signOut = useCallback(async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' })
    if (!response.ok) throw new Error('Could not log out. Please try again.')
    generation.current++; setUser(null); setLoading(false)
  }, [])
  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
