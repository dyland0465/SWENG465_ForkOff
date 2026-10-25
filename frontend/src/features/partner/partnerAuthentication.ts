/** Metadata returned only after server-side session verification. Never store credentials/tokens here. */
export interface PartnerSession {
  partnerId: string
  role: 'partner'
  restaurantIds: readonly string[]
  expiresAt: string
}

export interface PartnerCredentials {
  email: string
  password: string
}

/**
 * Future Express adapter: use secure server-validated cookies, support cancellation,
 * and treat expiration/401 as signed out. Restaurant IDs are UI metadata only;
 * the server must authorize role and ownership on EVERY private analytics request.
 */
export interface PartnerAuthenticationService {
  signIn(credentials: PartnerCredentials, signal: AbortSignal): Promise<PartnerSession>
  verifySession(signal: AbortSignal): Promise<PartnerSession | null>
  signOut(signal: AbortSignal): Promise<void>
}

export const authenticationUnavailableMessage = 'Live partner authentication is not connected yet. You have not been signed in. Please try again when partner accounts are available.'

export class PartnerAuthenticationUnavailableError extends Error {
  constructor() { super(authenticationUnavailableMessage) }
}

/** No network request, credential comparison, persistence, or fabricated session. */
export const partnerAuthentication: PartnerAuthenticationService = {
  async signIn() {
    throw new PartnerAuthenticationUnavailableError()
  },
  async verifySession() {
    return null
  },
  async signOut() {},
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
