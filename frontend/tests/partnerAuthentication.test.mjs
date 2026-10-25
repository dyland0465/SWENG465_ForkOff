import test from 'node:test'
import assert from 'node:assert/strict'
import { partnerAuthentication, partnerSignInValidators, PartnerAuthenticationUnavailableError } from '../src/features/partner/partnerAuthentication.ts'

test('placeholder never authenticates credentials and verifies no session', async () => {
  const signal = new AbortController().signal
  for (const credentials of [{ email: '', password: '' }, { email: 'partner@example.test', password: 'arbitrary-test-input' }]) {
    await assert.rejects(partnerAuthentication.signIn(credentials, signal), PartnerAuthenticationUnavailableError)
    assert.equal(await partnerAuthentication.verifySession(signal), null)
  }
  await partnerAuthentication.signOut(signal)
  assert.equal(await partnerAuthentication.verifySession(signal), null)
})

test('sign-in validates required values and email without inventing password policy', () => {
  for (const email of ['', '   ', 'name', 'name@', '@example.test', 'name@example', 'name @example.test']) assert.ok(partnerSignInValidators.email(email), email)
  for (const email of ['partner@example.test', '  partner+team@example.test  ']) assert.equal(partnerSignInValidators.email(email), undefined)
  assert.ok(partnerSignInValidators.password(''))
  for (const password of ['x', '  existing password  ']) assert.equal(partnerSignInValidators.password(password), undefined)
})
