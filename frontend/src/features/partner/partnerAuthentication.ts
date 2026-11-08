/**
 * partnerAuthentication.ts
 *
 * Talks to the backend for partner accounts. Partners use the SAME login system
 * as regular users (session cookie, users collection); what makes them a partner
 * is role: "partner" on their account.
 *
 *  - signIn(email, password): POST /api/auth/login, then GET /api/auth/session to
 *    confirm the cookie was saved and read the account's role. If the account is
 *    not a partner, it is logged straight back out and an error is shown.
 *  - register(details): POST /api/partners/register. Creates the account as a
 *    partner with status "pending" and logs them in.
 *  - verifySession(): GET /api/auth/session. Returns the partner session if a
 *    partner is already logged in (e.g. after a page refresh), otherwise null.
 *  - signOut(): POST /api/auth/logout.
 *
 * Nothing is stored in the browser except the httpOnly cookie the server sets.
 * restaurantIds here are for display only; the server must check the role and
 * restaurant ownership on every private analytics request.
 */
import type { ServiceOption } from './partnerOptions'
export type PartnerStatus = 'pending' | 'approved' | 'rejected'

export interface PartnerSession {
  partnerId: string
  username: string
  email: string
  role: 'partner'
  status: PartnerStatus
  restaurantIds: readonly string[]
}

export interface PartnerCredentials {
  email: string
  password: string
}

export interface PartnerRegistration {
  username: string
  email: string
  password: string
  restaurantName: string
  restaurantAddress: string
    city: string
  state: string
  postalCode: string
  restaurantPhone: string
  website?: string
  cuisine: string
  priceLevel: string
  businessType: string
  serviceOptions: readonly ServiceOption[]
  applicantRole: string
  notes?: string
  agreedToTerms: boolean
}

export interface PartnerAuthenticationService {
  signIn(credentials: PartnerCredentials, signal: AbortSignal): Promise<PartnerSession>
  register(details: PartnerRegistration, signal: AbortSignal): Promise<PartnerSession>
  verifySession(signal: AbortSignal): Promise<PartnerSession | null>
  signOut(signal: AbortSignal): Promise<void>
}

/** An error whose message came from the server and is safe to show the user. */
export class PartnerAuthenticationError extends Error {}

export const notPartnerMessage = 'That account is not a partner account. Use the regular Log in page, or create a partner account.'

type SessionUser = { id?: string; username?: string; email?: string; role?: string; partnerStatus?: string | null; restaurantIds?: string[] } | null

// Turn the /api/auth/session user into a PartnerSession, or null if not a partner.
function toPartnerSession(user: SessionUser): PartnerSession | null {
  if (!user?.id || user.role !== 'partner') return null
  const status: PartnerStatus = user.partnerStatus === 'approved' || user.partnerStatus === 'rejected' ? user.partnerStatus : 'pending'
  return { partnerId: user.id, username: user.username ?? '', email: user.email ?? '', role: 'partner', status, restaurantIds: user.restaurantIds ?? [] }
}

async function readSession(signal: AbortSignal): Promise<SessionUser> {
  const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', signal })
  if (!response.ok) throw new Error('Could not verify your session.')
  const body = await response.json() as { user?: SessionUser }
  return body.user ?? null
}

// POST JSON; on failure throw the server's message (e.g. "Invalid username/email or password.").
async function post(url: string, body: object, signal: AbortSignal) {
  const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { message?: string }
    if (result.message && response.status < 500) throw new PartnerAuthenticationError(result.message)
    throw new Error(`Request failed (${response.status}).`)
  }
}

// After login/register, the cookie must actually be saved; confirm it before showing a signed-in state.
async function confirmPartner(signal: AbortSignal): Promise<PartnerSession> {
  const user = await readSession(signal)
  if (!user) throw new PartnerAuthenticationError('Your login session could not be saved. Allow cookies for this site and try again.')
  const partner = toPartnerSession(user)
  if (!partner) {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
    throw new PartnerAuthenticationError(notPartnerMessage)
  }
  return partner
}

export const partnerAuthentication: PartnerAuthenticationService = {
  async signIn(credentials, signal) {
    await post('/api/auth/login', { username: credentials.email, password: credentials.password }, signal)
    return confirmPartner(signal)
  },
  async register(details, signal) {
    await post('/api/partners/register', details, signal)
    return confirmPartner(signal)
  },
  async verifySession(signal) {
    try { return toPartnerSession(await readSession(signal)) } catch { return null }
  },
  async signOut(signal) {
    await post('/api/auth/logout', {}, signal)
  },
}

export const partnerSignInValidators = {
  email: (value: string) => !value.trim()
    ? 'Enter your email address.'
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
      ? 'Enter a valid email address.'
      : undefined,
  // Do not invent password rules that could reject existing backend credentials.
  password: (value: string) => !value ? 'Enter your password.' : undefined,
}

/** Create-account rules. These match what POST /api/partners/register accepts. */
export const partnerRegisterValidators = {
  username: (value: string) => !value.trim()
    ? 'Enter your name.'
    : value.trim().length < 3 ? 'Use at least 3 characters.'
      : value.trim().length > 30 ? 'Keep your name to 30 characters or fewer.' : undefined,
  email: partnerSignInValidators.email,
  password: (value: string) => !value ? 'Choose a password.' : value.length < 8 ? 'Use at least 8 characters.' : undefined,
  restaurantName: (value: string) => !value.trim()
    ? 'Enter your restaurant’s name.'
    : value.trim().length > 120 ? 'Keep the name to 120 characters or fewer.' : undefined,
    restaurantAddress: (value: string) => !value.trim()
    ? 'Enter your restaurant’s street address.'
    : value.trim().length > 200 ? 'Keep the address to 200 characters or fewer.' : undefined,
  city: (value: string) => !value.trim()
    ? 'Enter the city.'
    : value.trim().length > 80 ? 'Keep the city to 80 characters or fewer.' : undefined,
  state: (value: string) => !/^[A-Z]{2}$/.test(value) ? 'Choose a state.' : undefined,
  postalCode: (value: string) => !value.trim()
    ? 'Enter the ZIP code.'
    : !/^\d{5}(-\d{4})?$/.test(value.trim()) ? 'Enter a 5-digit ZIP code, like 16801.' : undefined,
  restaurantPhone: (value: string) => !value.trim()
    ? 'Enter the restaurant’s phone number.'
    : !/^\+?[\d\s().-]+$/.test(value.trim()) || value.replace(/\D/g, '').length < 10 || value.trim().length > 30
      ? 'Enter a phone number with area code, like (814) 555-0100.' : undefined,
  website: (value: string) => {
    if (!value.trim()) return undefined
    try {
      const url = new URL(value.trim())
      if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.') && value.trim().length <= 300) return undefined
    } catch { /* falls through to the message */ }
    return 'Enter the full website address, starting with https://'
  },
  cuisine: (value: string) => !value ? 'Choose the cuisine that fits best.' : undefined,
  priceLevel: (value: string) => !value ? 'Choose a price level.' : undefined,
  businessType: (value: string) => !value ? 'Choose a business type.' : undefined,
  applicantRole: (value: string) => !value ? 'Choose your role.' : undefined,
  notes: (value: string) => value.trim().length > 500 ? 'Keep this to 500 characters or fewer.' : undefined,
}
