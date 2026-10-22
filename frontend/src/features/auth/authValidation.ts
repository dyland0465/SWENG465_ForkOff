/**
 * authValidation.ts
 *
 * Validation rules for the login and sign-up form fields. Each function takes
 * the field's current value and returns an error message to show under the
 * field, or undefined when the value is fine.
 *
 * They follow the same pattern as validateCode/validateDisplayName in
 * components/lobby/lobbyForm.ts, so they plug straight into useLobbyForm.
 *
 *  - validateIdentifier: login "Username or email" field (just required)
 *  - validatePassword: login password (just required)
 *  - validateUsername: sign-up username (3–30 characters)
 *  - validateEmail: sign-up email (basic format check)
 *  - validateNewPassword: sign-up password (at least 8 characters)
 */
export function validateIdentifier(value: string) {
  if (!value.trim()) return 'Enter your username or email.'
}

export function validateUsername(value: string) {
  const name = value.trim()
  if (!name) return 'Choose a username.'
  if (name.length < 3) return 'Use at least 3 characters.'
  if (name.length > 30) return 'Keep your username to 30 characters or fewer.'
}

export function validateEmail(value: string) {
  if (!value.trim()) return 'Enter your email address.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email, like you@example.com.'
}

export function validatePassword(value: string) {
  if (!value) return 'Enter your password.'
}

export function validateNewPassword(value: string) {
  if (!value) return 'Choose a password.'
  if (value.length < 8) return 'Use at least 8 characters.'
}