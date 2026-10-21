/**
 * authApi.ts
 *
 * The functions that talk to the backend for logging in and signing up.
 *  - login(identifier, password) → POST /api/auth/login
 *    The backend accepts either a username or an email as the identifier.
 *  - register(username, email, password) → POST /api/users
 *    The backend hashes the password with argon2 before saving it.
 *
 * Both return the user object on success. On failure they throw an Error
 * carrying the backend's message (e.g. "Invalid username/email or password."),
 * which the login screen shows to the user.
 *
 * Requests go to /api/..., which Vite proxies to the backend on port 3000
 * (see vite.config.ts).
 */
import type { AuthUser } from './authContext'

type AuthResponse = { message?: string; user?: AuthUser }

// Shared helper: send JSON, read the JSON reply, and turn errors into exceptions.
async function post(url: string, body: Record<string, string>): Promise<AuthUser> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as AuthResponse
  if (!response.ok) throw new Error(result.message || 'Something went wrong. Please try again.')
  if (!result.user) throw new Error('The server did not return a user.')
  return result.user
}

export function login(identifier: string, password: string) {
  return post('/api/auth/login', { username: identifier, password })
}

export function register(username: string, email: string, password: string) {
  return post('/api/users', { username, email, password })
}