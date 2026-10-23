import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

// Installed Chrome + Node 24, no browser library. Start Vite on port 5175 first.
const base = process.env.FORKOFF_TEST_URL ?? 'http://127.0.0.1:5175'
const profile = await mkdtemp(path.join(tmpdir(), 'forkoff-preferences-chrome-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9251', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let ws, sequence = 0, passed = 0
const pending = new Map(), errors = [], requests = []
async function poll(fn, label) {
  for (let i = 0; i < 100; i++) { if (await fn()) return; await delay(80) }
  throw new Error('Timed out: ' + label)
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
async function check(expression, label) {
  const result = await evaluate(expression)
  assert.ok(result, result ? label : label + '\n' + await evaluate('document.querySelector("main").innerText.slice(0, 1800)'))
  passed++; console.log('PASS ' + label)
}
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(60) }
async function key(key, modifiers = 0) {
  const windowsVirtualKeyCode = key === 'Tab' ? 9 : 13
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode, modifiers, ...(key === 'Enter' ? { text: '\r' } : {}) })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode, modifiers })
  await delay(30)
}
async function keyboardClick(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`); await key('Enter') }
async function navigate(route) {
  await cdp('Page.navigate', { url: base + route })
  await poll(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('main h1') && location.pathname === ${JSON.stringify(route)}`), route)
  await evaluate('document.fonts.ready.then(() => true)')
}
async function clientRoute(route) {
  await evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent('popstate'))`)
  await delay(80)
}
async function field(name, value) {
  await evaluate(`(() => {
    const el = document.querySelector('form [name=' + ${JSON.stringify(name)} + ']')
    const prototype = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })()`)
  await delay(20)
}
async function chip(group, text) {
  await evaluate(`(() => {
    const group = [...document.querySelectorAll('form fieldset')].find(el => el.querySelector('legend').textContent === ${JSON.stringify(group)})
    ;[...group.querySelectorAll('button')].find(el => el.textContent === ${JSON.stringify(text)}).click()
  })()`)
  await delay(20)
}
async function editorValues() {
  return evaluate(`Object.fromEntries([...document.querySelectorAll('form input, form select')].map(el => [el.name, el.value]))`)
}
async function assertLayout(label) {
  const issues = await evaluate(`(() => {
    const issues = []
    if (document.documentElement.scrollWidth > innerWidth) issues.push('page overflow')
    for (const el of document.querySelectorAll('main button, main a, main input, main select')) {
      if (!el.getClientRects().length) continue
      const r = el.getBoundingClientRect()
      if (r.left < -1 || r.right > innerWidth + 1) issues.push('outside viewport: ' + (el.name || el.textContent))
      if (!el.matches('[type=checkbox]') && (r.width < 44 || r.height < 44)) issues.push('small target: ' + (el.name || el.textContent))
      // Photo buttons deliberately crop sample imagery; check text-only controls here.
      if (!el.matches('input,select') && !el.querySelector('img') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) issues.push('clipped text: ' + el.textContent)
    }
    return issues
  })()`)
  assert.deepEqual(issues, [], label)
  passed++; console.log('PASS ' + label)
}

try {
  let targets
  await poll(async () => {
    try { targets = await (await fetch('http://127.0.0.1:9251/json/list')).json(); return targets.length > 0 } catch { return false }
  }, 'Chrome DevTools')
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const request = pending.get(message.id); pending.delete(message.id)
      if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
    else if (message.method === 'Network.requestWillBeSent') requests.push(message.params)
  }
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable')
  const lobby = '/lobbies/' + encodeURIComponent('crew /?&東京')
  await navigate(lobby)
  await keyboardClick('.lobby-round-filters__controls button:first-child')
  await check("document.activeElement.name === 'location'", 'Keyboard opens Lobby editor at first field')
  await field('location', ' ')
  await keyboardClick('form button[type=submit]')
  await check("document.activeElement.name === 'location' && document.activeElement.getAttribute('aria-invalid') === 'true' && !!document.activeElement.getAttribute('aria-describedby')", 'Invalid Apply keeps draft and focuses described location error')
  await field('location', '  Pittsburgh, PA  ')
  await field('date', '2026-12-04'); await field('time', '08:05')
  await field('distance', '10'); await field('rating', '4.5'); await field('availability', 'openNow')
  await chip('Price', '$'); await chip('Price', '$$$'); await chip('Dining needs', 'Serves alcohol')
  await keyboardClick('form button[type=submit]')
  await check("document.activeElement.textContent === 'Edit filters' && document.querySelector('.lobby-round-filters__summary').textContent.includes('Dec 4, 2026') && document.querySelector('.lobby-round-filters__summary').textContent.includes('8:05 AM')", 'Lobby Apply formats date/time and restores editor trigger focus')
  await click('.lobby-page__navigation button:first-child')
  await check(`location.pathname === ${JSON.stringify(lobby + '/discovery')} && document.activeElement.id === 'main-content'`, 'Lobby to Discovery retains encoded ID and route focus')
  await check("document.querySelector('.discovery-page__filters').textContent.includes('Pittsburgh, PA') && document.querySelector('.discovery-page__filters').textContent.includes('$ / $$ / $$$') && document.querySelector('.discovery-page__filters').textContent.includes('Serves alcohol') && document.querySelector('.discovery-page__filters').textContent.includes('Open now') && document.querySelector('h1').textContent === 'Preview your demo places'", 'Discovery receives every Lobby selection and makes no new match claim')
  await keyboardClick('.discovery-page__controls button:first-child')
  assert.deepEqual(await editorValues(), { location: 'Pittsburgh, PA', date: '2026-12-04', time: '08:05', distance: '10', rating: '4.5', availability: 'openNow' })
  await field('location', 'Cleveland, OH'); await field('time', '20:15'); await field('distance', 'any'); await field('availability', 'atDiningTime')
  await chip('Price', '$$'); await chip('Cuisine', 'Mexican')
  await keyboardClick('form button[type=submit]')
  await check("document.activeElement.textContent === 'Edit filters'", 'Discovery Apply restores keyboard focus')
  await click('.discovery-options__actions a')
  await check("document.querySelector('.voting-card__match').textContent.includes('Cleveland, OH') && document.querySelector('.voting-card__match').textContent.includes('8:15 PM') && document.querySelector('.voting-card__match').textContent.includes('Any distance') && document.querySelector('.voting-card__match').textContent.includes('$ / $$$') && document.querySelector('.voting-card__match').textContent.includes('Open at dining time') && !document.querySelector('.voting-card__match').textContent.includes('Why it matches')", 'Voting displays Discovery preferences without fabricated eligibility')
  await click('.voting-choice--yes')
  await evaluate('history.back()'); await delay(100)
  await check("!!document.querySelector('.discovery-page') && document.querySelector('.discovery-page__filters').textContent.includes('Cleveland, OH')", 'Browser Back keeps latest Discovery settings')
  await evaluate('history.back()'); await delay(100)
  await check("!!document.querySelector('.lobby-page') && document.querySelector('.lobby-round-filters__summary').textContent.includes('Cleveland, OH') && document.querySelector('.lobby-filter-chips').textContent.includes('Mexican')", 'Browser Back to Lobby keeps Discovery edits')
  await evaluate('history.forward()'); await delay(100)
  await evaluate('history.forward()'); await delay(100)
  await check("document.querySelector('progress').value === 1 && document.querySelector('.voting-card__match').textContent.includes('$ / $$$')", 'Browser Forward keeps preferences and voting progress')
  await click('.voting-demo-note a')
  await keyboardClick('.discovery-page__controls button:first-child')
  await field('location', 'Unsaved draft')
  await keyboardClick('.discovery-filter-editor__actions button:last-child')
  await check("document.querySelector('.discovery-page__filters').textContent.includes('Cleveland, OH') && !document.querySelector('.discovery-page__filters').textContent.includes('Unsaved draft')", 'Cancel discards only unsaved filter draft')
  await keyboardClick('.discovery-page__controls button:first-child')
  await field('date', ''); await field('time', ''); await field('rating', 'any'); await field('availability', 'any')
  await keyboardClick('form button[type=submit]')
  for (const text of ['Italian + Ramen + Mexican', '$ / $$$', 'Mocktails', 'Serves alcohol']) {
    await evaluate(`[...document.querySelectorAll('.discovery-page__filters button')].find(el => el.textContent === ${JSON.stringify(text)}).click()`)
    await delay(30)
  }
  await click('.discovery-options__actions a')
  await check("document.querySelector('progress').value === 1 && ['Any date', 'Any time', 'Any availability', 'Any cuisine', 'Any price', 'No dining requirements'].every(text => document.querySelector('.voting-card__match').textContent.includes(text))", 'Unrestricted date/time/availability, empty cuisines/prices/needs preserve votes')
  await clientRoute('/lobbies/another-crew/discovery')
  await check("document.querySelector('.discovery-page__filters').textContent.includes('Erie, PA') && !document.querySelector('.discovery-page__filters').textContent.includes('Cleveland, OH')", 'New lobby ID has independent defaults')
  await click('.discovery-page__controls button:first-child'); await field('location', 'Buffalo, NY'); await click('form button[type=submit]')
  await clientRoute(lobby + '/discovery')
  await check("document.querySelector('.discovery-page__filters').textContent.includes('Cleveland, OH')", 'Returning to encoded lobby restores its own preferences')
  await click('.discovery-page__controls button:last-child')
  await click('.discovery-demo-note a')
  await click('.lobby-round-filters__controls button:first-child')
  const defaults = { location: 'Erie, PA', date: '', time: '19:30', distance: '5', rating: '4.0', availability: 'atDiningTime' }
  assert.deepEqual(await editorValues(), defaults)
  await check("[...document.querySelectorAll('form fieldset')].find(el => el.querySelector('legend').textContent === 'Price').querySelector('[aria-pressed=true]').textContent === '$$'", 'Discovery Reset restores full common defaults in Lobby')
  await field('location', 'Changed again'); await click('form button[type=submit]')
  await click('.lobby-round-filters__controls button:last-child')
  await click('.lobby-page__navigation button:first-child')
  await click('.discovery-page__controls button:first-child')
  assert.deepEqual(await editorValues(), defaults)
  await click('.discovery-filter-editor__actions button:last-child')
  await click('.discovery-options__actions a')
  await check("document.querySelector('progress').value === 1 && document.querySelector('.voting-card__match').textContent.includes('Erie, PA')", 'Lobby Reset propagates to Discovery/Voting and preserves existing vote')
  await click('.voting-undo')
  await check("document.querySelector('progress').value === 0", 'Undo still removes vote after filter edits and resets')
  await click('.voting-choice--no'); await click('.voting-choice--skip'); await click('.voting-choice--veto')
  await check("[...document.querySelectorAll('.voting-complete dd')].map(el => el.textContent).join(',') === '0,1,1' && document.querySelector('[aria-label=\"Current restaurant preferences\"]').textContent.includes('Erie, PA')", 'Completion preserves no/skip/veto behavior and current preferences')
  await click('.voting-results-link')
  await check("document.querySelector('.results-summary').textContent.includes('3 of 3 processed')", 'Results still receives completed local decisions')
  await clientRoute(lobby + '/voting'); await click('.voting-complete__actions .ui-button')
  await check("document.querySelector('progress').value === 0 && document.querySelector('.voting-card__match').textContent.includes('Erie, PA')", 'Voting Restart clears votes while keeping preferences')
  await clientRoute('/lobbies/another-crew/discovery')
  await check("document.querySelector('.discovery-page__filters').textContent.includes('Buffalo, NY')", 'Reset in one lobby never resets another lobby')

  // Exercise maximum location length on the shared editor and summaries at each width.
  const longLocation = 'A'.repeat(120)
  for (const width of [320, 375, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 769 })
    await clientRoute(lobby)
    await click('.lobby-round-filters__controls button:first-child')
    await field('location', longLocation); await click('form button[type=submit]')
    await assertLayout(width + 'px Lobby shared preferences layout')
    await click('.lobby-page__navigation button:first-child')
    await assertLayout(width + 'px Discovery long location/chips layout')
    await keyboardClick('.discovery-page__controls button:first-child')
    await assertLayout(width + 'px shared Discovery editor layout')
    await key('Tab')
    await check("document.activeElement.name === 'date' && document.activeElement.matches(':focus-visible')", width + 'px editor follows keyboard field order with visible focus')
    await keyboardClick('.discovery-filter-editor__actions button:last-child')
    await check("document.activeElement.textContent === 'Edit filters'", width + 'px Cancel restores focus')
    await click('.discovery-options__actions a')
    await assertLayout(width + 'px Voting preference summary layout')
  }
  await navigate(lobby + '/discovery')
  await check("document.querySelector('.discovery-page__filters').textContent.includes('Erie, PA')", 'Refresh clears only memory-backed demo preferences')
  assert.deepEqual(errors, [], 'No browser runtime exceptions')
  assert.ok(requests.every(request => !['Fetch', 'XHR'].includes(request.type) || !/lobbies|restaurants|voting|api\//.test(new URL(request.request.url).pathname)), 'No backend requests')
  console.log(`COMPLETE ${passed} shared preference browser checks passed`)
} finally {
  if (ws?.readyState === 1) { await cdp('Browser.close').catch(() => {}); ws.close() }
  chrome.kill()
}
