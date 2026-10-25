import { useEffect, useRef, useState } from 'react'
import { authenticationUnavailableMessage, PartnerAuthenticationUnavailableError, partnerAuthentication } from './partnerAuthentication'
import type { PartnerCredentials, PartnerSession } from './partnerAuthentication'

type AccountState =
  | { status: 'signed-out' }
  | { status: 'signing-in' }
  | { status: 'error'; message: string }
  | { status: 'verified'; session: PartnerSession }

/** Request/session state stays separate from form fields and demo-preview state. */
export function usePartnerSignIn() {
  const [account, setAccount] = useState<AccountState>({ status: 'signed-out' })
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  async function signIn(credentials: PartnerCredentials) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setAccount({ status: 'signing-in' })
    try {
      const session = await partnerAuthentication.signIn(credentials, controller.signal)
      if (!controller.signal.aborted) setAccount({ status: 'verified', session })
    } catch (error) {
      if (!controller.signal.aborted) setAccount({ status: 'error', message: error instanceof PartnerAuthenticationUnavailableError ? authenticationUnavailableMessage : 'Unable to sign in. Please try again.' })
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  return { account, signIn }
}
