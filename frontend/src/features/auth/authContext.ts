/**
 * Defines the shape of the login data the whole app shares:
 *  - AuthUser: the user object the backend returns after login or sign-up
 *    (id, username, email).
 *  - AuthContextValue: what components get from useAuth() — the current user
 *    (or null when logged out), plus signIn() and signOut() functions.
 *  - AuthContext: the React context that holds this value. AuthProvider fills
 *    it in; useAuth() reads it.
 *
 * This lives in its own file (separate from AuthProvider.tsx) so the provider
 * file only exports a component, which keeps Vite's hot reload working.
 */
import { createContext } from 'react'

export type AuthUser = {
  id: string
  username: string
  email: string
}

export type AuthContextValue = {
  user: AuthUser | null
  signIn: (user: AuthUser) => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)