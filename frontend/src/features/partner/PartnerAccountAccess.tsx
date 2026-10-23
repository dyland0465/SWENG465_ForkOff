import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/FormField'
import { useLobbyForm } from '../../components/lobby/useLobbyForm'
import { partnerSignInValidators } from './partnerAuthentication'
import { usePartnerSignIn } from './usePartnerSignIn'

/** Primary integration boundary: form -> account request state -> backend adapter. */
export function PartnerAccountAccess() {
  const form = useLobbyForm({ email: '', password: '' }, partnerSignInValidators)
  const [showPassword, setShowPassword] = useState(false)
  const { account, signIn } = usePartnerSignIn()
  const pending = account.status === 'signing-in'

  return (
    <section className="partner-access__account" aria-labelledby="partner-account-title" aria-describedby="partner-account-description">
      <div className="partner-access__account-heading">
        <p className="text-label-default">Your restaurant, in focus</p>
        <h2 id="partner-account-title" className="text-heading-h2">Partner sign in</h2>
        <p id="partner-account-description">Access your restaurant’s discovery, voting, and promotion insights with your partner account.</p>
      </div>
      <p id="partner-auth-notice" className="partner-access__notice">Partner sign-in is coming soon. Live authentication is not connected, so this form cannot sign you in.</p>
      <form noValidate aria-label="Partner sign in" aria-describedby="partner-auth-notice" aria-busy={pending} onSubmit={async event => {
        event.preventDefault()
        if (pending || !form.validate(event.currentTarget)) return
        const credentials = { email: form.values.email.trim(), password: form.values.password }
        // Credentials remain only in this mounted form/request, never browser storage.
        setShowPassword(false)
        await signIn(credentials)
      }}>
        <TextInput id="partner-email" name="email" label="Email address" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={pending} value={form.values.email} error={form.errors.email} onChange={event => form.setValue('email', event.target.value)} onBlur={() => form.onBlur('email')} />
        <div className="partner-access__password">
          <TextInput id="partner-password" name="password" label="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required disabled={pending} value={form.values.password} error={form.errors.password} onChange={event => form.setValue('password', event.target.value)} onBlur={() => form.onBlur('password')} />
          <Button className="partner-access__password-toggle" variant="secondary" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="partner-password" aria-pressed={showPassword} disabled={pending} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</Button>
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign In'}</Button>
        <div className="partner-access__feedback" role="status" aria-atomic="true">
          {pending && <p>Checking partner sign-in availability…</p>}
          {account.status === 'error' && <p className="partner-access__error">{account.message}</p>}
          {account.status === 'verified' && <p>Your session was verified by the authentication service. Private analytics are not connected yet.</p>}
        </div>
      </form>
    </section>
  )
}
