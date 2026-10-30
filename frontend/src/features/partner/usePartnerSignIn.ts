/**
 * usePartnerSignIn.ts
 *
 * Holds the partner page's account state and runs the sign-in / create-account
 * requests:
 *  - On page load it checks whether a partner is already logged in, so a refresh
 *    keeps showing their status instead of the form.
 *  - signIn() and register() call partnerAuthentication.ts, show "working" while
 *    the request runs, and either store the partner session or an error message.
 *  - After success it also tells the app-wide AuthProvider (useAuth), so the
 *    header switches to "Hi, {name} / Log out" like a normal login.
 *  - If the user logs out from the header, the page goes back to the form.
 *  - Leaving the page cancels any request still running.
 */
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { PartnerAuthenticationError, partnerAuthentication } from './partnerAuthentication'
import type { PartnerCredentials, PartnerRegistration, PartnerSession } from './partnerAuthentication'

type AccountState =
  | { status: 'signed-out' }
  | { status: 'signing-in' }
  | { status: 'error'; message: string }
  | { status: 'verified'; session: PartnerSession }

export function usePartnerSignIn() {
  const [account, setAccount] = useState<AccountState>({ status: 'signed-out' })
  const request = useRef<AbortController | null>(null)
  const auth = useAuth()

  // Restore an existing partner login on page load; cancel requests on leave.
  useEffect(() => {
    const controller = new AbortController()
    partnerAuthentication.verifySession(controller.signal).then(session => {
      if (session && !controller.signal.aborted && !request.current) setAccount({ status: 'verified', session })
    })
    return () => { controller.abort(); request.current?.abort() }
  }, [])

  // Logged out (or switched account) from the header → show the form again.
  // Derived during render: the partner status only counts while the app-wide
  // logged-in user is that same partner.
  const stale = account.status === 'verified' && !auth.loading && auth.user?.id !== account.session.partnerId
  const visibleAccount: AccountState = stale ? { status: 'signed-out' } : account

  async function run(action: (signal: AbortSignal) => Promise<PartnerSession>, fallback: string) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setAccount({ status: 'signing-in' })
    try {
      const session = await action(controller.signal)
      if (controller.signal.aborted) return
      auth.signIn({ id: session.partnerId, username: session.username, email: session.email })
      setAccount({ status: 'verified', session })
    } catch (error) {
      if (!controller.signal.aborted) setAccount({ status: 'error', message: error instanceof PartnerAuthenticationError ? error.message : fallback })
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  return {
    account: visibleAccount,
    // Called through the partnerAuthentication object (not destructured) so tests can swap it.
    signIn: (credentials: PartnerCredentials) => run(signal => partnerAuthentication.signIn(credentials, signal), 'Unable to sign in. Please try again.'),
    register: (details: PartnerRegistration) => run(signal => partnerAuthentication.register(details, signal), 'Unable to create your account. Please try again.'),
    clearError: () => setAccount(current => current.status === 'error' ? { status: 'signed-out' } : current),
  }
}