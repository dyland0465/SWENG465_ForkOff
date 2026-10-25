/**
 * LoginPage.tsx
 *
 * The page shown at /login. It connects the LoginScreen UI to the backend
 * and the auth state:
 *  - When the form is submitted, it calls login() or register() from
 *    authApi.ts, then signIn() to store the returned user.
 *  - After success it sends the user back to the page they were on before
 *    clicking "Log in" (passed in as `from` by the header tab), or home.
 *  - If someone who is already logged in visits /login, they get redirected
 *    straight away.
 *
 * Errors thrown by login()/register() are caught and displayed by LoginScreen.
 *
 * This follows the same split as HomePage/HomeScreen: the page handles
 * navigation and data, the screen component handles the UI.
 */
import { Navigate, useLocation, useNavigate } from 'react-router'
import { LoginScreen } from '../components/login/LoginScreen'
import type { LoginMode } from '../components/login/LoginScreen'
import { login, register } from '../features/auth/authApi'
import { useAuth } from '../features/auth/useAuth'
import { paths } from '../routes/paths'

type LoginLocationState = { from?: string; mode?: LoginMode } | null

export function LoginPage() {
  const navigate = useNavigate()
  const { user, loading, signIn } = useAuth()
  const state = useLocation().state as LoginLocationState
    const redirectTo = state?.from ?? paths.home
  const destinationFor = (account: { role?: string }) => !state?.from && account.role === 'admin' ? paths.admin : redirectTo

  if (loading) return <main id="main-content"><p role="status">Checking session…</p></main>
  if (user) return <Navigate to={destinationFor(user)} replace />

  return (
    <LoginScreen
      initialMode={state?.mode}
      onLogin={async (identifier, password) => {
        const loggedIn = await login(identifier, password)
        signIn(loggedIn)
        navigate(destinationFor(loggedIn), { replace: true })
      }}
      onRegister={async (username, email, password) => {
        signIn(await register(username, email, password))
        navigate(redirectTo, { replace: true })
      }}
    />
  )
}