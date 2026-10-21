/**
 * useAuth.ts
 *
 * A small hook that any component can call to get login info:
 *
 *   const { user, signIn, signOut } = useAuth()
 *
 * `user` is null when nobody is logged in. If a component calls this outside
 * <AuthProvider>, it throws a clear error instead of failing silently.
 */
import { useContext } from 'react'
import { AuthContext } from './authContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}