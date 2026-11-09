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
import { useEffect, useId, useState } from 'react'
import type { ComponentProps, FormEvent, ReactNode } from 'react'
import { Link, generatePath } from 'react-router'
import { paths } from '../../routes/paths'
import { Button } from '../../components/ui/Button'
import { SelectField, TextInput } from '../../components/ui/FormField'
import { useLobbyForm } from '../../components/lobby/useLobbyForm'
import { useAuth } from '../auth/useAuth'
import { partnerRegisterValidators, partnerSignInValidators } from './partnerAuthentication'
import type { PartnerSession } from './partnerAuthentication'
import { usePartnerSignIn } from './usePartnerSignIn'
import { applicantRoleOptions, businessTypeOptions, partnerCuisineOptions, partnerPriceOptions, serviceOptions, stateOptions } from './partnerOptions'
import type { ServiceOption } from './partnerOptions'

type Mode = 'sign-in' | 'register'
const tabs: { mode: Mode; label: string }[] = [
  { mode: 'sign-in', label: 'Sign in' },
  { mode: 'register', label: 'Create account' },
]

export function PartnerAccountAccess() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [showPassword, setShowPassword] = useState(false)
  const signInForm = useLobbyForm({ email: '', password: '' }, partnerSignInValidators)
  const registerForm = useLobbyForm({
    username: '', applicantRole: '', email: '', password: '',
    restaurantName: '', restaurantAddress: '', city: '', state: '', postalCode: '', restaurantPhone: '', website: '',
    businessType: '', cuisine: '', priceLevel: '', notes: '',
  }, partnerRegisterValidators)
  // Checkboxes aren't plain text fields, so they keep their own state.
  const [services, setServices] = useState<readonly ServiceOption[]>([])
  const [agreed, setAgreed] = useState(false)
  const [checkboxErrorsShown, setCheckboxErrorsShown] = useState(false)
  const servicesError = checkboxErrorsShown && services.length === 0 ? 'Choose at least one.' : undefined
  const agreedError = checkboxErrorsShown && !agreed ? 'Confirm you can represent this restaurant.' : undefined  
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
    if (pending) return
    const form = event.currentTarget
    setCheckboxErrorsShown(true)
    // Text fields first (validate focuses the first bad one), then the checkboxes.
    if (!registerForm.validate(form)) return
    if (services.length === 0 || !agreed) {
      const field = form.elements.namedItem(services.length === 0 ? 'serviceOptions' : 'agreedToTerms')
      const target = field instanceof RadioNodeList ? field[0] : field
      if (target instanceof HTMLElement) target.focus()
      return
    }
    setShowPassword(false)
    const v = registerForm.values
    await register({
      username: v.username.trim(), email: v.email.trim(), password: v.password, applicantRole: v.applicantRole,
      restaurantName: v.restaurantName.trim(), restaurantAddress: v.restaurantAddress.trim(), city: v.city.trim(), state: v.state,
      postalCode: v.postalCode.trim(), restaurantPhone: v.restaurantPhone.trim(),
      ...(v.website.trim() ? { website: v.website.trim() } : {}),
      businessType: v.businessType, cuisine: v.cuisine, priceLevel: v.priceLevel, serviceOptions: services,
      ...(v.notes.trim() ? { notes: v.notes.trim() } : {}),
      agreedToTerms: agreed,
    })
  }

  type RegisterKey = keyof typeof registerForm.values
  const field = (key: RegisterKey) => ({
    name: key, disabled: pending, value: registerForm.values[key], error: registerForm.errors[key],
    onBlur: () => registerForm.onBlur(key),
  })
  const onText = (key: RegisterKey) => (event: { target: { value: string } }) => registerForm.setValue(key, event.target.value)
  const toggleService = (option: ServiceOption) =>
    setServices(current => current.includes(option) ? current.filter(value => value !== option) : serviceOptions.filter(value => value === option || current.includes(value)))
  

  return (
    <section className="partner-access__account" aria-labelledby="partner-account-title" aria-describedby="partner-account-description">
      <div className="partner-access__account-heading">
        <p className="text-label-default">Your restaurant, in focus</p>
        <h2 id="partner-account-title" className="text-heading-h2">{account.status === 'verified' ? 'Partner account' : mode === 'sign-in' ? 'Partner sign in' : 'Become a partner'}</h2>
        <p id="partner-account-description">Access your restaurant’s discovery, voting, and engagement insights with your partner account.</p>
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
            <FormSection title="About you">
              <TextInput id="partner-username" label="Your name" autoComplete="name" required {...field('username')} onChange={onText('username')} />
              <SelectField id="partner-applicant-role" label="Your role at the restaurant" required {...field('applicantRole')} onChange={onText('applicantRole')}>
                <option value="">Choose…</option>
                {applicantRoleOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </SelectField>
              <TextInput id="partner-register-email" label="Email address" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required hint="Use an email we can reach you at about this restaurant." {...field('email')} onChange={onText('email')} />
              <PasswordField id="partner-register-password" autoComplete="new-password" hint="At least 8 characters." value={registerForm.values.password} error={registerForm.errors.password} disabled={pending} show={showPassword} onToggle={() => setShowPassword(value => !value)} onChange={value => registerForm.setValue('password', value)} onBlur={() => registerForm.onBlur('password')} />
            </FormSection>

            <FormSection title="Your restaurant" description="We use these to find your restaurant and confirm it’s yours.">
              <TextInput id="partner-restaurant-name" label="Restaurant name" autoComplete="organization" required {...field('restaurantName')} onChange={onText('restaurantName')} />
              <TextInput id="partner-restaurant-address" label="Street address" autoComplete="address-line1" required {...field('restaurantAddress')} onChange={onText('restaurantAddress')} />
              <div className="partner-access__row">
                <TextInput id="partner-city" label="City" autoComplete="address-level2" required {...field('city')} onChange={onText('city')} />
                <SelectField id="partner-state" label="State" autoComplete="address-level1" required {...field('state')} onChange={onText('state')}>
                  <option value="">—</option>
                  {stateOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </SelectField>
                <TextInput id="partner-postal-code" label="ZIP code" autoComplete="postal-code" inputMode="numeric" required {...field('postalCode')} onChange={onText('postalCode')} />
              </div>
              <TextInput id="partner-restaurant-phone" label="Restaurant phone" type="tel" autoComplete="tel" required hint="The public number customers call. We may call to verify." {...field('restaurantPhone')} onChange={onText('restaurantPhone')} />
              <TextInput id="partner-website" label="Website (optional)" type="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="https://" {...field('website')} onChange={onText('website')} />
            </FormSection>

            <FormSection title="What you serve" description="Groups filter by these when they pick where to eat.">
              <SelectField id="partner-business-type" label="Business type" required {...field('businessType')} onChange={onText('businessType')}>
                <option value="">Choose…</option>
                {businessTypeOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </SelectField>
              <div className="partner-access__row partner-access__row--two">
                <SelectField id="partner-cuisine" label="Cuisine" required {...field('cuisine')} onChange={onText('cuisine')}>
                  <option value="">Choose…</option>
                  {partnerCuisineOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </SelectField>
                <SelectField id="partner-price" label="Price level" required {...field('priceLevel')} onChange={onText('priceLevel')}>
                  <option value="">Choose…</option>
                  {partnerPriceOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </SelectField>
              </div>
              <fieldset className="partner-access__choices" aria-describedby={servicesError ? 'partner-services-error' : undefined} aria-invalid={!!servicesError}>
                <legend className="text-label-default">How customers can order</legend>
                {serviceOptions.map(option => (
                  <label key={option} className="partner-access__check">
                    <input type="checkbox" name="serviceOptions" value={option} disabled={pending} checked={services.includes(option)} onChange={() => toggleService(option)} />
                    {option}
                  </label>
                ))}
                {servicesError && <p id="partner-services-error" className="ui-field__error">{servicesError}</p>}
              </fieldset>
            </FormSection>

            <TextArea id="partner-notes" label="Anything else we should know? (optional)" rows={3} maxLength={500} hint="For example, if you have more than one location." {...field('notes')} onChange={onText('notes')} />

            <div>
              <label className="partner-access__check partner-access__agree">
                <input type="checkbox" name="agreedToTerms" disabled={pending} checked={agreed} aria-invalid={!!agreedError} aria-describedby={agreedError ? 'partner-agree-error' : undefined} onChange={event => setAgreed(event.target.checked)} />
                I own or manage this restaurant and I’m authorized to represent it on Fork Off.
              </label>
              {agreedError && <p id="partner-agree-error" className="ui-field__error">{agreedError}</p>}
            </div>

            <Button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create partner account'}</Button>
            <Feedback pending={pending} pendingText="Creating your partner account…" error={account.status === 'error' ? account.message : undefined} />
          </form>
        )}
      </>}
    </section>
  )
}
// A titled group of fields in the create-account form.
function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="partner-access__section">
      <legend className="text-label-default partner-access__section-title">{title}</legend>
      {description && <p className="partner-access__section-description">{description}</p>}
      {children}
    </fieldset>
  )
}

// Multi-line text field, styled like TextInput.
function TextArea({ label, error, hint, id: providedId, ...props }: { label: string; error?: string; hint?: string } & ComponentProps<'textarea'>) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="ui-field">
      <label className="text-label-default" htmlFor={id}>{label}</label>
      <textarea {...props} id={id} className="ui-field__control partner-access__textarea" aria-invalid={!!error} aria-describedby={description} />
      {hint && <p id={`${id}-hint`} className="ui-field__hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="ui-field__error">{error}</p>}
    </div>
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
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (session.status !== 'approved') return
    const controller = new AbortController()
    fetch('/api/partners/restaurants', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() })
      .then(data => setRestaurants(data.restaurants))
      .catch(() => { if (!controller.signal.aborted) setError('Could not load your restaurants. Refresh to try again.') })
    return () => controller.abort()
  }, [session.status, session.partnerId])
  const message = session.status === 'approved'
    ? 'Your partner account is approved. Choose a restaurant to view its insights.'
    : session.status === 'rejected'
      ? 'We couldn’t verify this partner account. Contact the Fork Off team if you think this is a mistake.'
      : 'Thanks for signing up! Your partner account is waiting for approval. We’ll unlock your restaurant’s insights once we’ve verified you own it.'

  return (
    <div className={`partner-access__status partner-access__status--${session.status}`} role="status" aria-atomic="true">
      <p className="text-label-default">Signed in as {session.username}</p>
      <p>{message}</p>
      {session.status === 'approved' && <ul>{restaurants.map(restaurant => <li key={restaurant.id}><Link to={generatePath(paths.partnerRestaurant, { restaurantId: restaurant.id })}>{restaurant.name}</Link></li>)}</ul>}
      <Button variant="secondary" onClick={() => signOut().catch(() => setError('Could not sign out. Please try again.'))}>Sign out</Button>
      {error && <p className="partner-access__error">{error}</p>}
    </div>
  )
}
