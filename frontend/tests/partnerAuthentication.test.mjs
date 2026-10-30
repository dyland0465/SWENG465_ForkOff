/**
 * partnerAuthentication.test.mjs
 *
 * Tests the partner sign-in / create-account service with a fake fetch (no server):
 *  - signing in as a partner returns their session and status
 *  - signing in with a regular (non-partner) account is rejected and logged out
 *  - the server's error message is shown for wrong passwords
 *  - create account posts the details and returns a pending partner
 *  - verifySession returns null when nobody (or a non-partner) is logged in
 *  - form validation rules for both forms
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { notPartnerMessage, partnerAuthentication, PartnerAuthenticationError, partnerRegisterValidators, partnerSignInValidators } from '../src/features/partner/partnerAuthentication.ts'

const signal = new AbortController().signal
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const partner = { id: 'p1', username: 'Harbor Owner', email: 'owner@harbor.test', role: 'partner', partnerStatus: 'pending', restaurantIds: [] }

// Replace fetch with a fake that answers by URL and records every call.
function fakeFetch(routes) {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : undefined })
    const route = routes[url]
    if (!route) throw new Error(`Unexpected request ${url}`)
    return typeof route === 'function' ? route() : route
  }
  return calls
}
const realFetch = globalThis.fetch
test.afterEach(() => { globalThis.fetch = realFetch })

test('partner sign in returns the partner session', async () => {
  const calls = fakeFetch({ '/api/auth/login': () => json({ user: partner }), '/api/auth/session': () => json({ user: { ...partner, partnerStatus: 'approved', restaurantIds: ['r1'] } }) })
  const session = await partnerAuthentication.signIn({ email: 'owner@harbor.test', password: 'longenough' }, signal)
  assert.deepEqual(session, { partnerId: 'p1', username: 'Harbor Owner', email: 'owner@harbor.test', role: 'partner', status: 'approved', restaurantIds: ['r1'] })
  assert.deepEqual(calls[0].body, { username: 'owner@harbor.test', password: 'longenough' })
})

test('a regular account cannot sign in as a partner and is logged back out', async () => {
  const calls = fakeFetch({ '/api/auth/login': () => json({ user: {} }), '/api/auth/session': () => json({ user: { ...partner, role: 'user' } }), '/api/auth/logout': () => json({}) })
  await assert.rejects(partnerAuthentication.signIn({ email: 'a@b.test', password: 'x' }, signal), error => error instanceof PartnerAuthenticationError && error.message === notPartnerMessage)
  assert.ok(calls.some(call => call.url === '/api/auth/logout' && call.method === 'POST'))
})

test('wrong password shows the server message; server crashes do not leak details', async () => {
  fakeFetch({ '/api/auth/login': () => json({ message: 'Invalid username/email or password.' }, 401) })
  await assert.rejects(partnerAuthentication.signIn({ email: 'a@b.test', password: 'x' }, signal), { message: 'Invalid username/email or password.' })
  fakeFetch({ '/api/auth/login': () => json({ message: 'stack trace' }, 500) })
  await assert.rejects(partnerAuthentication.signIn({ email: 'a@b.test', password: 'x' }, signal), error => !(error instanceof PartnerAuthenticationError))
})

test('create account posts the details and returns a pending partner', async () => {
  const details = { username: 'Harbor Owner', email: 'owner@harbor.test', password: 'longenough', restaurantName: 'Harbor & Hearth', restaurantAddress: '1 Pier St' }
  const calls = fakeFetch({ '/api/partners/register': () => json({ user: partner }, 201), '/api/auth/session': () => json({ user: partner }) })
  const session = await partnerAuthentication.register(details, signal)
  assert.equal(session.status, 'pending')
  assert.deepEqual(calls[0].body, details)
  fakeFetch({ '/api/partners/register': () => json({ message: 'A user with that email already exists.' }, 409) })
  await assert.rejects(partnerAuthentication.register(details, signal), { message: 'A user with that email already exists.' })
})

test('verifySession is null for no login, a regular user, or a network failure', async () => {
  fakeFetch({ '/api/auth/session': () => json({ user: null }) })
  assert.equal(await partnerAuthentication.verifySession(signal), null)
  fakeFetch({ '/api/auth/session': () => json({ user: { ...partner, role: 'user' } }) })
  assert.equal(await partnerAuthentication.verifySession(signal), null)
  fakeFetch({ '/api/auth/session': () => { throw new TypeError('offline') } })
  assert.equal(await partnerAuthentication.verifySession(signal), null)
})

test('sign-in validates required values and email without inventing password policy', () => {
  for (const email of ['', '   ', 'name', 'name@', '@example.test', 'name@example', 'name @example.test']) assert.ok(partnerSignInValidators.email(email), email)
  for (const email of ['partner@example.test', '  partner+team@example.test  ']) assert.equal(partnerSignInValidators.email(email), undefined)
  assert.ok(partnerSignInValidators.password(''))
  for (const password of ['x', '  existing password  ']) assert.equal(partnerSignInValidators.password(password), undefined)
})

test('create-account validation matches the backend rules', () => {
  assert.ok(partnerRegisterValidators.username('ab'))
  assert.equal(partnerRegisterValidators.username('Harbor Owner'), undefined)
  assert.ok(partnerRegisterValidators.password('short'))
  assert.equal(partnerRegisterValidators.password('longenough'), undefined)
  assert.ok(partnerRegisterValidators.restaurantName('  '))
  assert.ok(partnerRegisterValidators.restaurantAddress(''))
  assert.equal(partnerRegisterValidators.restaurantAddress('1 Pier St'), undefined)
})