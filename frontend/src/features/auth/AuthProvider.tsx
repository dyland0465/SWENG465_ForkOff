/**
 * AuthProvider.tsx
 *
 * Wraps the whole app (see App.tsx) and keeps track of who is logged in.
 *  - On first load it reads any saved user from localStorage, so refreshing
 *    the page doesn't log you out.
 *  - signIn(user) saves the user in React state and localStorage.
 *  - signOut() clears both.
 *
 * Every component inside the provider can get the user with useAuth().
 *
 * Note: the backend doesn't issue a token or session yet, so this is only
 * client-side state. It's fine for showing the username in the UI, but it
 * doesn't secure any API routes.
 */
import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import type { AuthUser } from './authContext'

const STORAGE_KEY = 'forkoff:user'

// Read the saved user, if any. try/catch because localStorage can be blocked
// (private browsing) or contain bad data.
function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as AuthUser : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)

  const signIn = useCallback((nextUser: AuthUser) => {
    setUser(nextUser)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser)) } catch { /* in-memory only */ }
  }, [])

  const signOut = useCallback(() => {
    setUser(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* nothing stored */ }
  }, [])

  // useMemo so components only re-render when the user actually changes.
  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}