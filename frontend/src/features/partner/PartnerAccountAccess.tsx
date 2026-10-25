/**
 * PartnerAccountAccess.tsx
 *
 * The partner account box on the Partner access page (/partners).
 *
 *  - "Sign in" / "Create account" tabs, styled like the regular login screen.
 *  - Sign in: email + password (with Show/Hide). Uses the normal login; only
 *    accounts with role "partner" are accepted.
 *  - Create account: name, email, password, restaurant name and address. Creates
 *    a partner account that starts as "pending" until an admin approves it.
 *  - Once signed in, the form is replaced by the account's status:
 *    pending (waiting for approval), approved, or rejected.
 *
 * Request and session logic lives in usePartnerSignIn.ts; this file is the UI.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/FormField'
import { useLobbyForm } from '../../components/lobby/useLobbyForm'
import { useAuth } from '../auth/useAuth'
import { partnerRegisterValidators, partnerSignInValidators } from './partnerAuthentication'
import type { PartnerSession } from './partnerAuthentication'
import { usePartnerSignIn } from './usePartnerSignIn'

type Mode = 'sign-in' | 'register'
const tabs: { mode: Mode; label: string }[] = [
  { mode: 'sign-in', label: 'Sign in' },
  { mode: 'register', label: 'Create account' },
]

export function PartnerAccountAccess() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [showPassword, setShowPassword] = useState(false)
  const signInForm = useLobbyForm({ email: '', password: '' }, partnerSignInValidators)
  const registerForm = useLobbyForm({ username: '', email: '', password: '', restaurantName: '', restaurantAddress: '' }, partnerRegisterValidators)
  const { account, signIn, register, clearError } = usePartnerSignIn()
  const pending = account.status === 'signing-in'

  function switchMode(next: Mode) {
    if (pending) return
    setMode(next); setShowPassword(false); clearError()
  }

  async function submitSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !signInForm.validate(event.currentTarget)) return
    // Credentials stay only in this form and request, never in browser storage.
    setShowPassword(false)
    await signIn({ email: signInForm.values.email.trim(), password: signInForm.values.password })
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !registerForm.validate(event.currentTarget)) return
    setShowPassword(false)
    const v = registerForm.values
    await register({ username: v.username.trim(), email: v.email.trim(), password: v.password, restaurantName: v.restaurantName.trim(), restaurantAddress: v.restaurantAddress.trim() })
  }

  return (
    <section className="partner-access__account" aria-labelledby="partner-account-title" aria-describedby="partner-account-description">
      <div className="partner-access__account-heading">
        <p className="text-label-default">Your restaurant, in focus</p>
        <h2 id="partner-account-title" className="text-heading-h2">{account.status === 'verified' ? 'Partner account' : mode === 'sign-in' ? 'Partner sign in' : 'Become a partner'}</h2>
        <p id="partner-account-description">Access your restaurant’s discovery, voting, and promotion insights with your partner account.</p>
      </div>

      {account.status === 'verified' ? <PartnerStatus session={account.session} /> : <>
        {/* Sign in / Create account tabs (same pattern as the regular login screen) */}
        <div className="partner-access__tabs" role="tablist" aria-label="Partner account options">
          {tabs.map(tab => (
            <button
              key={tab.mode}
              id={`partner-tab-${tab.mode}`}
              type="button"
              role="tab"
              aria-selected={mode === tab.mode}
              aria-controls={`partner-panel-${tab.mode}`}
              tabIndex={mode === tab.mode ? 0 : -1}
              disabled={pending}
              className={`partner-access__tab${mode === tab.mode ? ' is-active' : ''}`}
              onClick={() => switchMode(tab.mode)}
              onKeyDown={event => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  const next = tab.mode === 'sign-in' ? 'register' : 'sign-in'
                  switchMode(next)
                  document.getElementById(`partner-tab-${next}`)?.focus()
                }
              }}
            >{tab.label}</button>
          ))}
        </div>

        <p id="partner-auth-notice" className="partner-access__notice">
          {mode === 'sign-in'
            ? 'Use the email and password from your partner account.'
            : 'New partner accounts are reviewed before restaurant insights are unlocked.'}
        </p>

        {mode === 'sign-in' ? (
          <form id="partner-panel-sign-in" role="tabpanel" aria-labelledby="partner-tab-sign-in" noValidate aria-describedby="partner-auth-notice" aria-busy={pending} onSubmit={submitSignIn}>
            <TextInput id="partner-email" name="email" label="Email address" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={pending} value={signInForm.values.email} error={signInForm.errors.email} onChange={event => signInForm.setValue('email', event.target.value)} onBlur={() => signInForm.onBlur('email')} />
            <PasswordField id="partner-password" autoComplete="current-password" value={signInForm.values.password} error={signInForm.errors.password} disabled={pending} show={showPassword} onToggle={() => setShowPassword(value => !value)} onChange={value => signInForm.setValue('password', value)} onBlur={() => signInForm.onBlur('password')} />
            <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign In'}</Button>
            <Feedback pending={pending} pendingText="Signing you in…" error={account.status === 'error' ? account.message : undefined} />
          </form>
        ) : (
          <form id="partner-panel-register" role="tabpanel" aria-labelledby="partner-tab-register" noValidate aria-describedby="partner-auth-notice" aria-busy={pending} onSubmit={submitRegister}>
            <TextInput id="partner-username" name="username" label="Your name" autoComplete="name" required disabled={pending} value={registerForm.values.username} error={registerForm.errors.username} onChange={event => registerForm.setValue('username', event.target.value)} onBlur={() => registerForm.onBlur('username')} />
            <TextInput id="partner-register-email" name="email" label="Email address" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={pending} value={registerForm.values.email} error={registerForm.errors.email} onChange={event => registerForm.setValue('email', event.target.value)} onBlur={() => registerForm.onBlur('email')} />
            <PasswordField id="partner-register-password" autoComplete="new-password" hint="At least 8 characters." value={registerForm.values.password} error={registerForm.errors.password} disabled={pending} show={showPassword} onToggle={() => setShowPassword(value => !value)} onChange={value => registerForm.setValue('password', value)} onBlur={() => registerForm.onBlur('password')} />
            <TextInput id="partner-restaurant-name" name="restaurantName" label="Restaurant name" autoComplete="organization" required disabled={pending} value={registerForm.values.restaurantName} error={registerForm.errors.restaurantName} onChange={event => registerForm.setValue('restaurantName', event.target.value)} onBlur={() => registerForm.onBlur('restaurantName')} />
            <TextInput id="partner-restaurant-address" name="restaurantAddress" label="Restaurant address" autoComplete="street-address" required disabled={pending} value={registerForm.values.restaurantAddress} error={registerForm.errors.restaurantAddress} onChange={event => registerForm.setValue('restaurantAddress', event.target.value)} onBlur={() => registerForm.onBlur('restaurantAddress')} />
            <Button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create partner account'}</Button>
            <Feedback pending={pending} pendingText="Creating your partner account…" error={account.status === 'error' ? account.message : undefined} />
          </form>
        )}
      </>}
    </section>
  )
}

// Password input with the Show/Hide button (shared by both forms).
function PasswordField({ id, autoComplete, hint, value, error, disabled, show, onToggle, onChange, onBlur }: {
  id: string; autoComplete: string; hint?: string; value: string; error?: string; disabled: boolean; show: boolean
  onToggle: () => void; onChange: (value: string) => void; onBlur: () => void
}) {
  return (
    <div className="partner-access__password">
      <TextInput id={id} name="password" label="Password" type={show ? 'text' : 'password'} autoComplete={autoComplete} hint={hint} required disabled={disabled} value={value} error={error} onChange={event => onChange(event.target.value)} onBlur={onBlur} />
      <Button className="partner-access__password-toggle" variant="secondary" aria-label={show ? 'Hide password' : 'Show password'} aria-controls={id} aria-pressed={show} disabled={disabled} onClick={onToggle}>{show ? 'Hide' : 'Show'}</Button>
    </div>
  )
}

function Feedback({ pending, pendingText, error }: { pending: boolean; pendingText: string; error?: string }) {
  return (
    <div className="partner-access__feedback" role="status" aria-atomic="true">
      {pending && <p>{pendingText}</p>}
      {error && <p className="partner-access__error">{error}</p>}
    </div>
  )
}

// What a signed-in partner sees instead of the form, based on their approval status.
function PartnerStatus({ session }: { session: PartnerSession }) {
  const { signOut } = useAuth()
  const [error, setError] = useState('')
  const message = session.status === 'approved'
    ? 'Your partner account is approved. Restaurant insights will appear here once analytics are connected.'
    : session.status === 'rejected'
      ? 'We couldn’t verify this partner account. Contact the Fork Off team if you think this is a mistake.'
      : 'Thanks for signing up! Your partner account is waiting for approval. We’ll unlock your restaurant’s insights once we’ve verified you own it.'

  return (
    <div className={`partner-access__status partner-access__status--${session.status}`} role="status" aria-atomic="true">
      <p className="text-label-default">Signed in as {session.username}</p>
      <p>{message}</p>
      <Button variant="secondary" onClick={() => signOut().catch(() => setError('Could not sign out. Please try again.'))}>Sign out</Button>
      {error && <p className="partner-access__error">{error}</p>}
    </div>
  )
}