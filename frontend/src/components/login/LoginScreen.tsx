/**
 * LoginScreen.tsx
 *
 * The visual part of the login page (no routing or API calls in here —
 * LoginPage.tsx passes those in as onLogin/onRegister).
 *
 * What it shows:
 *  - A "Log in / Create account" tab switcher. Clicking a tab (or using the
 *    left/right arrow keys) swaps which form is shown.
 *  - Log in form: username-or-email + password.
 *  - Create account form: username + email + password.
 *  - A status line for errors like "Invalid username/email or password."
 *  - A "Continue as a guest" link, since joining a lobby doesn't need an account.
 *
 * It reuses the app's existing pieces — TextInput, Button, TextAction,
 * ForkEmblem and the useLobbyForm hook — so it looks and behaves like the
 * Join Lobby page. Fields are checked when you leave them and again on submit.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/FormField'
import { TextAction } from '../ui/TextAction'
import { ForkEmblem } from '../lobby/ForkEmblem'
import { useLobbyForm } from '../lobby/useLobbyForm'
import {
  validateEmail,
  validateIdentifier,
  validateNewPassword,
  validatePassword,
  validateUsername,
} from '../../features/auth/authValidation'
import { paths } from '../../routes/paths'
import '../../pages/LobbyForms.css'
import './LoginScreen.css'

export type LoginMode = 'login' | 'register'

type LoginScreenProps = {
  initialMode?: LoginMode
  onLogin: (identifier: string, password: string) => Promise<void>
  onRegister: (username: string, email: string, password: string) => Promise<void>
}

const tabs: { mode: LoginMode; label: string }[] = [
  { mode: 'login', label: 'Log in' },
  { mode: 'register', label: 'Create account' },
]

export function LoginScreen({ initialMode = 'login', onLogin, onRegister }: LoginScreenProps) {
  const [mode, setMode] = useState<LoginMode>(initialMode)
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // One form-state hook per tab, each with its own validation rules.
  const loginForm = useLobbyForm(
    { identifier: '', password: '' },
    { identifier: validateIdentifier, password: validatePassword },
  )
  const registerForm = useLobbyForm(
    { username: '', email: '', password: '' },
    { username: validateUsername, email: validateEmail, password: validateNewPassword },
  )

  function switchMode(next: LoginMode) {
    setMode(next)
    setStatus('')
  }

  // Runs the login/register call, showing progress and any error message.
  async function run(action: () => Promise<void>) {
    setIsSubmitting(true)
    setStatus(mode === 'login' ? 'Logging in…' : 'Creating your account…')
    try {
      await action()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!loginForm.validate(event.currentTarget)) return setStatus('Check the highlighted fields before continuing.')
    const { identifier, password } = loginForm.values
    run(() => onLogin(identifier.trim(), password))
  }

  function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!registerForm.validate(event.currentTarget)) return setStatus('Check the highlighted fields before continuing.')
    const { username, email, password } = registerForm.values
    run(() => onRegister(username.trim(), email.trim(), password))
  }

  return (
    <main id="main-content" className="lobby-form-page login-page" tabIndex={-1}>
      <h1 className="text-heading-h1">{mode === 'login' ? 'Welcome back' : 'Join Fork Off'}</h1>
      <p className="lobby-form-page__intro text-body-large">
        {mode === 'login'
          ? 'Log in to host lobbies and keep track of your dinner crews.'
          : 'Create an account to host lobbies. Joining a lobby never requires one.'}
      </p>

      <div className="login-card lobby-panel">
        <div className="login-card__emblem"><ForkEmblem /></div>

        {/* Tab switcher between the two forms (accessible tablist pattern) */}
        <div className="login-tabs" role="tablist" aria-label="Account options">
          {tabs.map(tab => (
            <button
              key={tab.mode}
              id={`login-tab-${tab.mode}`}
              type="button"
              role="tab"
              aria-selected={mode === tab.mode}
              aria-controls={`login-panel-${tab.mode}`}
              tabIndex={mode === tab.mode ? 0 : -1}
              className={`login-tabs__tab${mode === tab.mode ? ' is-active' : ''}`}
              onClick={() => switchMode(tab.mode)}
              onKeyDown={event => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  const next = tab.mode === 'login' ? 'register' : 'login'
                  switchMode(next)
                  document.getElementById(`login-tab-${next}`)?.focus()
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === 'login' ? (
          <form id="login-panel-login" role="tabpanel" aria-labelledby="login-tab-login" className="login-card__form" noValidate onSubmit={submitLogin}>
            <TextInput label="Username or email" name="identifier" autoComplete="username" required value={loginForm.values.identifier} error={loginForm.errors.identifier} onChange={event => loginForm.setValue('identifier', event.target.value)} onBlur={() => loginForm.onBlur('identifier')} />
            <TextInput label="Password" name="password" type="password" autoComplete="current-password" required value={loginForm.values.password} error={loginForm.errors.password} onChange={event => loginForm.setValue('password', event.target.value)} onBlur={() => loginForm.onBlur('password')} />
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Logging in…' : 'Log in'}</Button>
          </form>
        ) : (
          <form id="login-panel-register" role="tabpanel" aria-labelledby="login-tab-register" className="login-card__form" noValidate onSubmit={submitRegister}>
            <TextInput label="Username" name="username" autoComplete="username" required value={registerForm.values.username} error={registerForm.errors.username} onChange={event => registerForm.setValue('username', event.target.value)} onBlur={() => registerForm.onBlur('username')} />
            <TextInput label="Email" name="email" type="email" autoComplete="email" required value={registerForm.values.email} error={registerForm.errors.email} onChange={event => registerForm.setValue('email', event.target.value)} onBlur={() => registerForm.onBlur('email')} />
            <TextInput label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." required value={registerForm.values.password} error={registerForm.errors.password} onChange={event => registerForm.setValue('password', event.target.value)} onBlur={() => registerForm.onBlur('password')} />
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</Button>
          </form>
        )}

        <p className="lobby-form-status login-card__status" role="status">{status}</p>
        <p className="login-card__guest">
          Just joining a friend’s lobby? <TextAction to={paths.joinLobby}>Continue as a guest</TextAction>
        </p>
        {/* Partner link: sends restaurant owners to the separate Partner access
            page (/partners), since partner accounts sign in there, not here. */}
        <p className="login-card__partner">
          Own a restaurant? <TextAction to={paths.partnerAccess}>Partner sign in</TextAction>
        </p>
      </div>
      <TextAction className="lobby-form-page__back" to={paths.home}>Back to home</TextAction>
    </main>
  )
}