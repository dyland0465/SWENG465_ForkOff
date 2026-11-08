import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

// Real React/UI in installed Chrome; HTTP fixtures exercise existing API contracts.
// Run Vite, then: node tests/groups.browser.mjs (override FORKOFF_TEST_URL as needed).
// No live MongoDB, account, mail delivery, or Socket.IO server is exercised here.
const base = process.env.FORKOFF_TEST_URL ?? 'http://127.0.0.1:5186'
const port = Number(process.env.FORKOFF_GROUPS_CDP_PORT ?? 9257)
const profile = await mkdtemp(path.join(tmpdir(), 'forkoff-groups-chrome-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const owner = { id: '507f1f77bcf86cd799439011', username: 'Alex', email: 'alex@example.test', role: 'user' }
const groupId = '507f1f77bcf86cd799439014'
const emptyId = '507f1f77bcf86cd799439015'
const lobbyId = '507f1f77bcf86cd799439016'
const invitationId = '507f1f77bcf86cd799439017'
const groupFixture = () => ({ _id: groupId, name: 'Friday dinner crew', members: [
  { userId: '507f1f77bcf86cd799439012', displayName: 'Sam Rivera' },
  { userId: '507f1f77bcf86cd799439013', displayName: 'Taylor Lee' },
] })
const inviteFixture = () => ({ id: invitationId, lobbyId, lobbyName: 'Dinner with Sam', lobbyCode: 'ABC123' })
const restaurant = {id:'fixture_place',name:'Fixture Kitchen',address:'123 State Street',category:'restaurant',googleMapsUri:null,photoUrl:null,photoAuthors:[]}
const state = { user: null, groups: [groupFixture()], invitations: [inviteFixture()], groupsError: false,
  invitationsError: false, deleteError: false, joinError: false, declineError: false, inviteError: false,
  groupsDelay: 0, invitationsDelay: 0, mutationDelay: 0, isHost: true, status: 'waiting', created: 0,
  favorites:[], collections:[], messages:[], round:null, location:'Erie, PA' }
const requests = []
const errors = []
const fixtureErrors = []
const pending = new Map()
let ws, sequence = 0, passed = 0, socketSequence = 0
const socketPolls = new Set()

function snapshot() {
  return { id: lobbyId, name: 'Friday dinner lobby', lobbyCode: 'ABC123', status: state.status,
    revision: 1, roundId: null, hostMemberId: 'host', selfMemberId: state.isHost ? 'host' : 'friend', isHost: state.isHost,
    members: [
      { memberId: 'host', type: state.user ? 'user' : 'guest', ...(state.user ? { userId: owner.id } : {}), displayName: state.user ? owner.username : 'Guest host', joinOrder: 0, online: true },
      { memberId: 'friend', type: 'user', userId: '507f1f77bcf86cd799439012', displayName: 'Sam Rivera', joinOrder: 1, online: true },
      { memberId: 'guest', type: 'guest', displayName: 'Guest friend', joinOrder: 2, online: true },
    ], filters: { location: state.location, dinnerAt: '2030-11-08T00:00:00.000Z', maxDistance: 5,
      minimumRating: 4, categories: [], priceLevels: [], diningNeeds: [], openNow: false } }
}
async function poll(fn, label) {
  for (let attempt = 0; attempt < 150; attempt++) { if (await fn()) return; await delay(60) }
  throw new Error(`Timed out: ${label}`)
}
function cdp(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
function pass(label) { passed++; console.log(`PASS ${label}`) }
async function check(expression, label) { assert.ok(await evaluate(expression), label); pass(label) }
async function textIncludes(text) { return evaluate(`document.querySelector('main')?.textContent.includes(${JSON.stringify(text)})`) }
async function waitText(text) { await poll(() => textIncludes(text), text) }
async function navigate(url) {
  await cdp('Page.navigate', { url: `${base}${url}` })
  const pathname = new URL(url, base).pathname
  await poll(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('main') && location.pathname === ${JSON.stringify(pathname)}`), url)
  await evaluate('document.fonts.ready.then(() => true)')
}
async function key(key, modifiers = 0) {
  const code = key === 'Tab' ? 9 : key === 'Escape' ? 27 : 13
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, modifiers, ...(key === 'Enter' ? { text: '\r' } : {}) })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code, modifiers })
}
async function activate(selector) {
  assert.ok(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), `Missing control ${selector}`)
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await key('Enter')
}
async function button(label, scope = 'main') {
  let selector
  await poll(async () => { selector = await evaluate(`(() => {
    const matches = [...document.querySelectorAll(${JSON.stringify(scope + ' button')})].filter(el => el.textContent.trim().toLowerCase() === ${JSON.stringify(label.toLowerCase())})
    const el = matches.find(el => !el.disabled && el.getClientRects().length)
    if (!el) return null
    el.dataset.groupsTestTarget = 'active'; return '[data-groups-test-target="active"]'
  })()`); return Boolean(selector) }, `Enabled ${label} button in ${scope}`)
  await activate(selector)
  await evaluate(`document.querySelector('[data-groups-test-target]')?.removeAttribute('data-groups-test-target')`)
}
async function fill(selector, value) {
  await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) throw Error('Missing field ' + ${JSON.stringify(selector)})
    Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true}))
  })()`)
}
async function viewport(width) { await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 769 }) }
async function layout(label) {
  const issues = await evaluate(`(() => {
    const issues = [], controls = [...document.querySelectorAll('header a,header button,main a,main button,main input,main select,dialog[open] button')].filter(el => el.getClientRects().length && !el.matches('.skip-link'))
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('Horizontal document overflow')
    for (const el of controls) {
      const r = el.getBoundingClientRect(), name = el.textContent.trim() || el.getAttribute('aria-label') || el.name || el.id || el.className
      if (r.left < -1 || r.right > innerWidth + 1) issues.push(name + ': outside viewport')
      if (r.width < 43 || r.height < 43) issues.push(name + ': target under 44px')
      // Existing restaurant thumbnails contain an absolute tooltip; measure all
      // new group controls strictly while leaving that overlay out of text sizing.
      if (el.textContent.trim() && !el.matches('input,select,.lobby-restaurant-preview__thumbnail') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) issues.push(name + ': text clipped')
    }
    for (const el of document.querySelectorAll('main h1,main h2,main h3,main li')) {
      // Existing results-ranking headings are outside the Saved Groups change.
      if (el.matches('.results-ranking h2')) continue
      if (el.scrollWidth > el.clientWidth + 1) issues.push(el.tagName + ': text overflow')
    }
    return issues
  })()`)
  assert.deepEqual(issues, [], label); pass(label)
}
async function screenshot(name) {
  await evaluate('document.activeElement.blur(); window.scrollTo(0,0)')
  const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const target = path.join(tmpdir(), `forkoff-groups-${name}.png`)
  await writeFile(target, Buffer.from(result.data, 'base64')); console.log(`SCREENSHOT ${target}`)
}
async function respond(requestId, data, status = 200, contentType = 'application/json') {
  await cdp('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{name: 'Content-Type', value: contentType}],
    body: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)).toString('base64') }).catch(error => {
      // Navigating away aborts delayed fixture requests; CDP then invalidates their IDs.
      if (!error.message.includes('Invalid InterceptionId')) throw error
    })
}
async function intercept({ requestId, request }) {
  const url = new URL(request.url), route = url.pathname, method = request.method
  if (route.startsWith('/socket.io')) {
    if (method === 'POST') return respond(requestId, 'ok', 200, 'text/plain')
    if (!url.searchParams.has('sid')) return respond(requestId, `0${JSON.stringify({sid: String(++socketSequence), upgrades: [], pingInterval: 10000000, pingTimeout: 10000000})}`, 200, 'text/plain')
    const sid = url.searchParams.get('sid')
    if (!socketPolls.has(sid)) { socketPolls.add(sid); return respond(requestId, '40{"sid":"groups-test"}', 200, 'text/plain') }
    return // Deliberately hold long-poll; no live socket server is required.
  }
  const body = request.postData ? JSON.parse(request.postData) : undefined
  requests.push({ route, method, body })
  if (route === '/api/auth/session') return respond(requestId, { user: state.user, identityType: state.user ? 'user' : 'guest' })
  if (route === '/api/auth/login' || route === '/api/users') { state.user = owner; return respond(requestId, {user: owner}, route === '/api/users' ? 201 : 200) }
  if (route === '/api/auth/logout') { state.user = null; return respond(requestId, {ok:true}) }
  if (route === '/api/saved/groups' && method === 'GET') {
    if (state.groupsDelay) await delay(state.groupsDelay)
    return respond(requestId, state.groupsError ? {message:'Groups temporarily unavailable.'} : {groups: state.groups}, state.groupsError ? 503 : 200)
  }
  if (route === '/api/saved/invitations' && method === 'GET') {
    if (state.invitationsDelay) await delay(state.invitationsDelay)
    return respond(requestId, state.invitationsError ? {message:'Invitations temporarily unavailable.'} : {invitations: state.invitations}, state.invitationsError ? 503 : 200)
  }
  if (route === '/api/saved/groups' && method === 'POST') {
    if (state.mutationDelay) await delay(state.mutationDelay)
    const group = { ...groupFixture(), _id: '507f1f77bcf86cd799439019', name: body.name, members: groupFixture().members.slice(0,1) }
    state.groups.push(group); return respond(requestId, {group, excludedGuests: 1}, 201)
  }
  if (/^\/api\/saved\/groups\/[^/]+$/.test(route) && method === 'DELETE') {
    if (state.mutationDelay) await delay(state.mutationDelay)
    if (state.deleteError) return respond(requestId, {message:'Could not delete group. Please retry.'}, 503)
    state.groups = state.groups.filter(g => g._id !== route.split('/').at(-1)); state.invitations = []
    return respond(requestId, {ok:true})
  }
  if (/^\/api\/saved\/groups\/[^/]+\/invitations$/.test(route) && method === 'POST') {
    if (state.inviteError) return respond(requestId, {message:'Invitations could not be sent.'}, 503)
    return respond(requestId, {invited: 2})
  }
  if (/^\/api\/saved\/invitations\/[^/]+$/.test(route) && method === 'DELETE') {
    if (state.declineError) return respond(requestId, {message:'Could not decline invitation.'}, 503)
    state.invitations = state.invitations.filter(i => i.id !== route.split('/').at(-1)); return respond(requestId, {ok:true})
  }
  if (route === '/api/saved/collections') return respond(requestId, {collections: state.collections})
  if (route === '/api/saved/favorites') return respond(requestId, {placeIds: state.favorites})
  if (route.startsWith('/api/places/')) return respond(requestId, {place:{displayName:{text:restaurant.name}}})
  if (route === '/api/restaurants/search') return respond(requestId, {restaurants:[{placeId:restaurant.id,name:restaurant.name,address:restaurant.address,googleMapsUri:null}],total:1,pageSize:10})
  if (/\/api\/saved\/collections\/[^/]+\/share$/.test(route)) return respond(requestId, {token:'a'.repeat(64)})
  if (route === '/api/lobbies' && method === 'POST') { state.created++; return respond(requestId, {lobby: snapshot()}, 201) }
  if (/^\/api\/lobbies\/[^/]+\/join$/.test(route)) {
    if (state.joinError) return respond(requestId, {message:'Lobby is no longer accepting members.'}, 409)
    state.invitations = []; return respond(requestId, {lobby: snapshot()})
  }
  if (/^\/api\/lobbies\/[^/]+$/.test(route) && method === 'GET') return respond(requestId, snapshot())
  if (/^\/api\/lobbies\/[^/]+$/.test(route) && method === 'PATCH') { state.location = body.filters.location; return respond(requestId, {lobby:snapshot()}) }
  if (route.endsWith('/messages')) {
    if (method === 'POST') { const message = {id:'fixture-message',memberId:'host',senderName:'Alex',text:body.text,createdAt:new Date().toISOString(),requestId:body.requestId}; state.messages.push(message); return respond(requestId, {message}, 201) }
    return respond(requestId, {messages:state.messages, nextCursor:null})
  }
  if (route.endsWith('/restaurants')) return respond(requestId, {lobbyId,attribution:'Google Maps',count:1,restaurants:[restaurant], warnings:[]})
  if (route.endsWith('/round')) {
    if (method === 'POST') state.round = {id:'fixture-round',restaurants:[restaurant],decisions:{},canVote:true,completed:0,totalMembers:3,complete:false,results:null}
    return respond(requestId, {round:state.round}, method === 'POST' ? 201 : 200)
  }
  if (route.endsWith('/round/vote') && method === 'PUT') {
    state.round = {...state.round,decisions:{[restaurant.id]:body.decision},complete:true,completed:3,results:[{restaurant,yes:3,no:0,veto:0,skip:0}]}
    return respond(requestId, {round:state.round})
  }
  fixtureErrors.push(`${method} ${route}`); return respond(requestId, {message:`Unexpected fixture request: ${method} ${route}`}, 404)
}

try {
  let targets
  await poll(async () => { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); return targets.length > 0 } catch { return false } }, 'Chrome DevTools')
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve,reject) => { ws.onopen = resolve; ws.onerror = reject })
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (message.error) request?.reject(new Error(JSON.stringify(message.error))); else request?.resolve(message.result) }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
    else if (message.method === 'Fetch.requestPaused') void intercept(message.params).catch(error => fixtureErrors.push(error.message))
  }
  await cdp('Page.enable'); await cdp('Runtime.enable')
  await cdp('Fetch.enable', {patterns:[{urlPattern:'*/api/*'}, {urlPattern:'*/socket.io/*'}]})

  await viewport(1024); await navigate('/groups'); await waitText('Same crew.')
  await check(`document.querySelector('header a[href="/groups"]')?.getAttribute('aria-current') === 'page'`, 'Guest sees active Groups navigation without login redirect')
  await check(`document.querySelector('main').textContent.includes('account') && !!document.querySelector('main a[href="/lobbies/create"]') && !!document.querySelector('main a[href="/lobbies/join"]')`, 'Public Groups explains value and offers guest lobby paths')
  assert.equal(requests.filter(r => r.route.startsWith('/api/saved')).length, 0, 'Guest page does not call protected saved APIs'); pass('Guest explanation avoids protected saved APIs')
  for (const width of [320,375,768,1024,1920]) {
    await viewport(width); await layout(`${width}px public Groups and header fit viewport`)
  }
  await screenshot('public-1920')
  await viewport(375); await screenshot('public-375')
  await activate('main a[href="/login"]'); await poll(() => evaluate(`location.pathname === '/login' && !!document.querySelector('#login-tab-register[aria-selected="true"]')`), 'Groups registration tab')
  await check(`history.state.usr.from === '/groups'`, 'Create Account preserves Groups destination')
  await fill('input[name=username]', 'Alex'); await fill('input[name=email]', owner.email); await fill('input[name=password]', 'GroupsTest123!')
  await activate('#login-panel-register button[type=submit]'); await poll(() => evaluate(`location.pathname === '/groups' && document.querySelector('main h1')?.textContent === 'Your Groups'`), 'Registration returns to Groups')
  pass('Existing account registration returns to Groups after confirmed session')

  state.user = null; await navigate('/groups'); await waitText('Same crew.')
  await evaluate(`(() => { const a = [...document.querySelectorAll('main a[href="/login"]')].find(el => /log in/i.test(el.textContent)); a.dataset.groupsTestTarget = 'login' })()`)
  await activate('[data-groups-test-target=login]'); await poll(() => evaluate(`!!document.querySelector('#login-tab-login[aria-selected="true"]')`), 'Groups login tab')
  await fill('input[name=identifier]', 'Alex'); await fill('input[name=password]', 'GroupsTest123!'); await activate('#login-panel-login button[type=submit]')
  await poll(() => evaluate(`location.pathname === '/groups' && document.querySelector('main h1')?.textContent === 'Your Groups'`), 'Login returns to Groups'); pass('Existing login returns to Groups after confirmed session')

  state.user = null; await navigate('/lobbies/create'); await poll(() => evaluate(`!!document.querySelector('input[name=displayName]')`), 'Guest create form')
  await fill('input[name=displayName]', 'Dinner guest'); await activate('button[type=submit]')
  await poll(() => evaluate(`location.pathname === ${JSON.stringify('/lobbies/' + lobbyId)}`), 'Guest lobby creation')
  assert.ok(requests.some(r => r.route === '/api/lobbies' && r.method === 'POST' && r.body.displayName === 'Dinner guest')); pass('Guest creates lobby without authentication')
  await navigate('/lobbies/join'); await poll(() => evaluate(`!!document.querySelector('input[name=code]')`), 'Guest join form')
  await fill('input[name=displayName]', 'Joining guest'); await fill('input[name=code]', 'ABC123'); await activate('button[type=submit]')
  await poll(() => evaluate(`location.pathname === ${JSON.stringify('/lobbies/' + lobbyId)}`), 'Guest lobby join')
  assert.ok(requests.some(r => r.route === '/api/lobbies/ABC123/join' && r.body.displayName === 'Joining guest')); pass('Guest joins lobby without authentication')
  await waitText('Friday dinner lobby')
  await check(`!document.querySelector('main input[maxlength="80"]')`, 'Guests never receive host-only saved-group controls')
  await check(`document.querySelector('.guest-groups-reminder')?.textContent.includes('guest membership') && !document.querySelector('.guest-groups-reminder a[href="/login"]')`, 'Active guest tip explains identity limitation and opens information before authentication')
  await navigate('/'); await waitText('Same crew every weekend?')
  await check(`!!document.querySelector('.home-hero__actions button') && document.querySelector('.home-hero__illustration').getBoundingClientRect().width > innerWidth`, 'Home tip preserves main lobby actions and illustration crop')
  await screenshot('home-375')
  for (const width of [1024,1920]) { await viewport(width); await navigate('/'); await waitText('Same crew every weekend?'); await screenshot(`home-${width}`) }
  await viewport(375)
  await activate('button[aria-label="Dismiss saved groups tips for this session"]')
  await navigate('/lobbies/create'); await poll(() => evaluate(`!!document.querySelector('input[name=displayName]')`), 'Guest create after tip dismissal')
  await check(`!document.querySelector('.guest-groups-reminder') && sessionStorage.getItem('forkoff:groups-reminder-dismissed') === 'true'`, 'Tip dismissal persists across routes in browsing session')
  await evaluate(`sessionStorage.removeItem('forkoff:groups-reminder-dismissed')`)

  state.user = owner; state.invitations = [inviteFixture()]; state.groupsDelay = 500; state.invitationsDelay = 500
  await navigate('/groups'); await check(`!!document.querySelector('main [role="status"]')`, 'Groups exposes loading feedback')
  await waitText('Friday dinner crew'); state.groupsDelay = 0; state.invitationsDelay = 0
  await check(`document.querySelector('main').textContent.includes('Sam Rivera') && document.querySelector('main').textContent.includes('Taylor Lee')`, 'Group cards show stored member names')
  await check(`!document.querySelector('.guest-groups-reminder')`, 'Authenticated Groups has no signup reminder')
  await check(`!!document.querySelector(${JSON.stringify('a[href="/lobbies/create?group=' + groupId + '"]')}) && !!document.querySelector(${JSON.stringify('a[href="/groups/' + groupId + '"]')})`, 'Cards offer real group reuse and details routes')
  await waitText('Dinner with Sam'); await check(`document.querySelector('main').textContent.includes('Dinner with Sam') && document.querySelector('main').textContent.includes('ABC123')`, 'Pending invitation identifies real lobby and code')
  await check(`document.querySelector('#saved-groups-heading .groups-count')?.textContent === '1' && document.querySelector('#group-invitations .groups-count')?.textContent === '1' && document.querySelector('.group-card__count')?.textContent.includes('2 saved members')`, 'Group, member, and pending invitation counts reflect API snapshots')
  await viewport(1920); await screenshot('overview-standard-1920'); await viewport(375); await screenshot('overview-standard-375')

  state.groupsError = true; await navigate('/groups'); await waitText('Groups temporarily unavailable.')
  await check(`document.querySelector('main').textContent.includes('Dinner with Sam')`, 'Group API failure does not hide invitations')
  state.groupsError = false; await button('Retry loading groups'); await waitText('Friday dinner crew'); pass('Group load retry recovers')
  state.invitationsError = true; await navigate('/groups'); await waitText('Invitations temporarily unavailable.')
  await check(`document.querySelector('main').textContent.includes('Friday dinner crew')`, 'Invitation API failure does not hide saved groups')
  state.invitationsError = false; await button('Retry loading invitations'); await waitText('Dinner with Sam'); pass('Invitation load retry recovers')

  state.joinError = true; await button('Join Lobby'); await waitText('Lobby is no longer accepting members.')
  await check(`location.pathname === '/groups' && document.querySelector('main').textContent.includes('Dinner with Sam')`, 'Failed invitation join preserves invitation and stays in Groups')
  state.joinError = false; await button('Join Lobby'); await poll(() => evaluate(`location.pathname === ${JSON.stringify('/lobbies/' + lobbyId)}`), 'Invitation join navigation')
  assert.ok(requests.some(r => r.route === `/api/lobbies/${lobbyId}/join` && r.method === 'POST' && Object.keys(r.body).length === 0)); pass('Invitation uses real authenticated join contract before navigation')
  state.invitations = [inviteFixture()]; await navigate('/groups'); await waitText('Dinner with Sam')
  state.declineError = true; await button('Decline'); await waitText('Could not decline invitation.')
  await check(`document.querySelector('main').textContent.includes('Dinner with Sam')`, 'Failed decline leaves invitation available')
  state.declineError = false; await button('Decline'); await poll(() => evaluate(`![...document.querySelectorAll('main button')].some(el => el.textContent.trim() === 'Decline')`), 'Decline confirmed')
  assert.ok(requests.some(r => r.route === `/api/saved/invitations/${invitationId}` && r.method === 'DELETE')); pass('Confirmed decline removes pending invitation and updates count')
  await poll(() => evaluate(`document.querySelector('#group-invitations .groups-count')?.textContent === '0'`), 'Confirmed zero invitation count'); pass('Pending invitation count becomes zero only after confirmed decline')
  await check(`document.activeElement.id === 'group-invitations'`, 'Decline restores focus to stable Invitations heading')

  await navigate('/groups/not-an-id'); await waitText('unavailable'); await check(`!document.querySelector('main a[href*="?group="]')`, 'Invalid group ID has graceful unavailable state and no start action')
  await navigate('/groups/507f1f77bcf86cd799439099'); await waitText('unavailable'); pass('Unowned/deleted group is not exposed from owner-scoped list')
  await navigate(`/groups/${groupId}`); await waitText('Friday dinner crew')
  await check(`document.querySelector('main h1')?.textContent === 'Friday dinner crew' && document.querySelector('main').textContent.includes('Sam Rivera')`, 'Details loads correct owned group and stored members')
  await screenshot('details-standard-375')
  await button('Delete Group'); await poll(() => evaluate(`!!document.querySelector('dialog[open]')`), 'Delete dialog')
  await check(`document.querySelector('dialog[open]').contains(document.activeElement) && /cancel/i.test(document.activeElement.textContent)`, 'Deletion confirmation starts keyboard focus on Cancel')
  await check(`document.querySelector('dialog[open]').textContent.includes('invitation')`, 'Deletion confirmation explains associated invitations')
  // Native dialogs may send Tab to browser chrome (document.body in headless Chrome),
  // but background application controls must remain inert throughout the cycle.
  for (let i = 0; i < 4; i++) { await key('Tab'); await check(`document.activeElement === document.body || document.querySelector('dialog[open]').contains(document.activeElement)`, `Deletion dialog keeps background controls inert on Tab ${i + 1}`) }
  const deleteCalls = requests.filter(r => r.method === 'DELETE' && r.route.includes('/groups/')).length
  await key('Escape'); await poll(() => evaluate(`!document.querySelector('dialog')`), 'Escape dismisses and unmounts deletion')
  assert.equal(requests.filter(r => r.method === 'DELETE' && r.route.includes('/groups/')).length, deleteCalls); pass('Escape cancels deletion without API call')
  await check(`/delete group/i.test(document.activeElement.textContent)`, 'Deletion cancellation restores trigger focus')
  await button('Delete Group'); await poll(() => evaluate(`!!document.querySelector('dialog[open]')`), 'Reopen deletion before group navigation')
  await evaluate(`history.pushState({}, '', '/groups/507f1f77bcf86cd799439099'); dispatchEvent(new PopStateEvent('popstate'))`)
  await waitText('unavailable'); await check(`!document.querySelector('dialog')`, 'Changing group ID closes old deletion confirmation instead of rebinding it')
  await navigate(`/groups/${groupId}`); await waitText('Friday dinner crew')
  await button('Delete Group'); state.deleteError = true; await button('Delete Group', 'dialog[open]'); await waitText('Could not delete group. Please retry.')
  assert.ok(state.groups.some(g => g._id === groupId)); pass('Delete error preserves group and exposes backend failure')
  state.deleteError = false
  if (!await evaluate(`!!document.querySelector('dialog[open]')`)) await button('Delete Group')
  await button('Delete Group', 'dialog[open]'); await poll(() => evaluate(`location.pathname === '/groups'`), 'Delete success returns overview')
  assert.ok(!state.groups.some(g => g._id === groupId)); pass('Confirmed delete removes group and returns overview')
  await waitText('Create a Lobby'); await check(`!!document.querySelector('main a[href="/lobbies/create"]')`, 'No-groups empty state offers lobby creation')

  state.groups = [groupFixture(), {_id: emptyId, name:'Just me for now', members:[]}]
  await navigate(`/groups/${emptyId}`); await waitText('Just me for now'); await check(`document.querySelector('main').textContent.toLowerCase().includes('no other')`, 'Empty snapshot explains no other saved members')
  await navigate(`/lobbies/create?group=${groupId}`); await waitText('Friday dinner crew')
  await check(`!!document.querySelector('input[name=location]') && !!document.querySelector('input[name=dateTime]') && !!document.querySelector('select[name=distance]')`, 'Group reuse preserves normal location/time/filter form')
  state.inviteError = true; const createdBefore = state.created; await activate('button[type=submit]')
  await poll(() => evaluate(`location.pathname === ${JSON.stringify('/lobbies/' + lobbyId)}`), 'Partial creation success')
  await waitText('Lobby created'); await waitText('invitations')
  assert.equal(state.created, createdBefore + 1); pass('Invitation failure keeps successfully created lobby')
  state.inviteError = false
  await waitText('Save')
  await button('Invite to this lobby'); await poll(() => evaluate(`document.querySelector('main').textContent.toLowerCase().includes('invitation') && document.querySelector('main').textContent.includes('2')`), 'Retry sends invitations')
  assert.equal(state.created, createdBefore + 1); pass('Invitation retry uses current lobby without creating another')
  const inviteRequest = requests.filter(r => r.route === `/api/saved/groups/${groupId}/invitations`).at(-1)
  assert.equal(inviteRequest.body.lobbyId, lobbyId); pass('Invitation retry uses owner group and current lobby IDs')

  const groupNameSelector = 'main input[maxlength="80"]'
  await fill(groupNameSelector, 'Our saved dinner crew'); state.mutationDelay = 400
  const savesBefore = requests.filter(r => r.route === '/api/saved/groups' && r.method === 'POST').length
  await button('Save This Group')
  await evaluate(`document.querySelector('main input[maxlength="80"]').form.requestSubmit()`)
  await check(`!!document.querySelector('main button:disabled')`, 'Group save disables pending submit')
  await waitText('guest'); await poll(() => evaluate(`!!document.querySelector('main a[href="/groups/507f1f77bcf86cd799439019"]')`), 'Newly saved group link')
  assert.equal(requests.filter(r => r.route === '/api/saved/groups' && r.method === 'POST').length, savesBefore + 1); pass('Save group sends one mutation and links confirmed saved group')
  await check(`document.querySelector('main').textContent.toLowerCase().includes('guest') && document.querySelector('main').textContent.includes('1')`, 'Save feedback includes excluded guest count')
  state.mutationDelay = 0; state.isHost = false; await navigate(`/lobbies/${lobbyId}`); await waitText('Friday dinner lobby')
  await check(`!document.querySelector(${JSON.stringify(groupNameSelector)})`, 'Signed-in non-host cannot save another host’s group')
  state.isHost = true

  await navigate(`/lobbies/create?group=507f1f77bcf86cd799439099`); await waitText('unavailable')
  const beforeUnavailable = state.created
  await activate('button[type=submit]'); await delay(60)
  assert.equal(state.created, beforeUnavailable); pass('Unavailable selected group prevents misleading invitation promise')
  await button('Continue without a saved group'); await poll(() => evaluate(`!location.search.includes('group=')`), 'Detach unavailable group'); pass('Unavailable group can be removed while continuing normal lobby setup')
  await navigate(`/lobbies/create?group=${emptyId}`); await waitText('Just me for now')
  await check(`document.querySelector('main').textContent.toLowerCase().includes('no other')`, 'Reuse of empty saved snapshot explains no invitees')
  const invitationsBeforeEmpty = requests.filter(r => r.route.endsWith('/invitations') && r.method === 'POST').length
  await activate('button[type=submit]'); await poll(() => evaluate(`location.pathname === ${JSON.stringify('/lobbies/' + lobbyId)}`), 'Empty-group lobby creation')
  assert.equal(requests.filter(r => r.route.endsWith('/invitations') && r.method === 'POST').length, invitationsBeforeEmpty); pass('Empty group creates ordinary lobby without sending nonexistent invitations')

  // Exercise current lobby settings/chat/discovery/voting UI alongside the group feature.
  await waitText('Friday dinner lobby'); await button('Edit lobby settings & filters'); await poll(() => evaluate(`!!document.querySelector('.lobby-filter-editor')`), 'Lobby settings editor')
  await fill('.lobby-filter-editor input[name=location]', 'Pittsburgh, PA'); await button('Save settings')
  await poll(() => evaluate(`document.querySelector('.lobby-round-filters__summary')?.textContent.includes('Pittsburgh, PA')`), 'Lobby settings saved')
  assert.ok(requests.some(r => r.route === `/api/lobbies/${lobbyId}` && r.method === 'PATCH' && r.body.filters.location === 'Pittsburgh, PA')); pass('Lobby settings still update through existing host API')
  await fill('#lobby-message', 'Dinner plans still work.'); await button('Send'); await waitText('Dinner plans still work.')
  assert.ok(requests.some(r => r.route.endsWith('/messages') && r.method === 'POST' && typeof r.body.requestId === 'string' && r.body.requestId.length > 0)); pass('Lobby chat sends request ID and renders confirmed message')
  state.user = null; await navigate(`/lobbies/${lobbyId}/discovery`); await waitText(restaurant.name)
  await check(`document.querySelector('main h1')?.textContent === 'Explore restaurants' && !document.querySelector('.guest-groups-reminder')`, 'Discovery still renders restaurant API data without signup interruption')
  await activate(`main a[href="/lobbies/${lobbyId}/voting"]`); await waitText('No round started'); await button('Start voting'); await waitText(restaurant.name)
  await check(`!!document.querySelector('.voting-choice--yes') && !document.querySelector('.guest-groups-reminder')`, 'Voting retains existing controls without signup interruption')
  await navigate(`/lobbies/${lobbyId}/results`); await waitText('Waiting for the group')
  await check(`!document.querySelector('.guest-groups-reminder')`, 'Incomplete results do not show completed-session signup reminder')
  await navigate(`/lobbies/${lobbyId}/voting`); await waitText(restaurant.name); await button('YES')
  await poll(() => evaluate(`location.pathname === ${JSON.stringify('/lobbies/' + lobbyId + '/results')}`), 'Completed vote enters results'); await waitText(restaurant.name)
  assert.ok(requests.some(r => r.route.endsWith('/round/vote') && r.method === 'PUT' && r.body.roundId === 'fixture-round' && r.body.restaurantId === restaurant.id && r.body.decision === 'yes')); pass('Voting submits existing decision contract and renders server results')
  await check(`document.querySelector('.guest-groups-reminder--results')?.textContent.includes('Same crew next time?')`, 'Completed guest results show compact Saved Groups reminder')

  state.user = owner; state.groupsError = true; state.invitationsError = true; state.favorites = [restaurant.id]
  state.collections = [{_id:emptyId,name:'Favorite dinner spots',placeIds:[restaurant.id]}]
  const protectedRequestsBefore = requests.filter(r => ['/api/saved/groups','/api/saved/invitations'].includes(r.route)).length
  await navigate('/saved'); await waitText(restaurant.name)
  await check(`document.querySelector('main h1')?.textContent === 'Your saved restaurants' && !!document.querySelector('main a[href="/groups"]')`, 'Saved favorites remain available with a clear Groups link')
  await activate('.saved-page__tabs button:nth-child(2)'); await waitText('Favorite dinner spots')
  await check(`!!document.querySelector('main a[href="/lobbies/create?collection=${emptyId}"]')`, 'Existing collections retain collection-based lobby creation')
  await button('Create share link'); await poll(() => evaluate(`!!document.querySelector('input[readonly]')`), 'Collection share link')
  await check(`document.querySelector('input[readonly]').value.includes('/saved/import/')`, 'Collection sharing still creates confirmed import link')
  assert.equal(requests.filter(r => ['/api/saved/groups','/api/saved/invitations'].includes(r.route)).length, protectedRequestsBefore); pass('Saved restaurants and collections no longer depend on Groups or invitations API success')
  state.groupsError = false; state.invitationsError = false

  for (const width of [320,375,768,1024,1920]) {
    await viewport(width); state.user = owner; await navigate(`/lobbies/create?group=${groupId}`); await waitText('Friday dinner crew')
    await layout(`${width}px selected group in normal Create Lobby`)
    if (width === 375) await screenshot('create-selected-375')
    if (width === 320) { await evaluate(`document.documentElement.style.fontSize = '200%'`); await layout('320px selected group Create Lobby at 200% text') }
    await navigate(`/lobbies/${lobbyId}`); await waitText('Save your crew'); await layout(`${width}px authenticated host group controls in Lobby`)
    if (width === 375) await screenshot('lobby-host-375')
    if (width === 320) { await evaluate(`document.documentElement.style.fontSize = '200%'`); await layout('320px host group controls at 200% text') }
    state.user = null; await navigate(`/lobbies/${lobbyId}/results`); await waitText('Same crew next time?'); await layout(`${width}px completed Results with guest reminder`)
    if (width === 375) await screenshot('results-guest-375')
    if (width === 320) {
      await evaluate(`document.documentElement.style.fontSize = '200%'`)
      await screenshot('results-320-text200')
      await layout('320px Results reminder at 200% text')
    }
  }
  await viewport(320); await navigate('/lobbies/create'); await waitText('Make next time easier.'); await layout('320px guest Create Lobby reminder')
  await evaluate(`document.documentElement.style.fontSize = '200%'`); await layout('320px guest Create Lobby reminder at 200% text')
  await navigate(`/lobbies/${lobbyId}`); await waitText('Make the next round easier.'); await layout('320px guest Lobby reminder')
  await evaluate(`document.documentElement.style.fontSize = '200%'`); await layout('320px guest Lobby reminder at 200% text')
  state.user = owner

  // Large real-data-shaped snapshots, many cards, long words, and text zoom.
  state.groups = Array.from({length:8}, (_,i) => ({...groupFixture(), _id: i ? `507f1f77bcf86cd7994390${20+i}` : groupId,
    name: i ? `Weekend dinner ${i}` : 'A'.repeat(80), members: Array.from({length:100}, (_,j) => ({userId:j.toString(16).padStart(24,'0'),displayName: j ? `Dinner friend ${j}` : 'Member'.repeat(6)}))}))
  for (const width of [320,375,768,1024,1920]) {
    await viewport(width); await navigate('/groups'); await waitText('A'.repeat(80)); await layout(`${width}px many Groups with long names and 100 saved members`)
    if (width === 1920) await screenshot('overview-1920')
    await navigate(`/groups/${groupId}`); await waitText('A'.repeat(80)); await layout(`${width}px details with 100 saved members`)
    if (width === 375) await screenshot('details-375')
  }
  await viewport(320); await navigate('/groups'); await waitText('A'.repeat(80)); await evaluate(`document.documentElement.style.fontSize = '200%'`); await layout('320px Groups at 200% text zoom')
  await navigate(`/groups/${groupId}`); await waitText('A'.repeat(80)); await evaluate(`document.documentElement.style.fontSize = '200%'`); await layout('320px Details at 200% text zoom')
  await evaluate(`document.documentElement.style.fontSize = ''`)
  await viewport(1024); await navigate('/groups'); await waitText('A'.repeat(80))
  await activate('main a[href="/groups/' + groupId + '"]'); await poll(() => evaluate(`location.pathname === ${JSON.stringify('/groups/' + groupId)}`), 'Keyboard View Group navigation')
  await key('Tab'); await check(`document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineStyle === 'solid'`, 'Keyboard navigation keeps visible focus on Groups controls')

  assert.deepEqual(fixtureErrors, [], 'No unexpected API contracts or interception errors')
  assert.deepEqual(errors, [], 'No browser runtime exceptions')
  console.log(`COMPLETE ${passed} Saved Groups browser checks passed (HTTP fixtures; no live backend)`)
} finally {
  if (ws?.readyState === 1) { await cdp('Browser.close').catch(() => {}); ws.close() }
  chrome.kill()
}
