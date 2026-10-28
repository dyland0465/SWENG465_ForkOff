import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

// Run against Vite with node tests/navigation.browser.mjs. No browser dependency.
const base = process.env.FORKOFF_TEST_URL ?? 'http://127.0.0.1:5175'
const profile = await mkdtemp(path.join(tmpdir(), 'forkoff-navigation-chrome-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9248', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let ws
let sequence = 0
let passed = 0
const pending = new Map()
const errors = []

async function poll(fn, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await fn()) return
    await delay(80)
  }
  throw new Error(`Timed out: ${label}`)
}
function cdp(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function check(expression, label) {
  assert.ok(await evaluate(expression), label)
  passed++
  console.log(`PASS ${label}`)
}
async function navigate(url) {
  await cdp('Page.navigate', { url: `${base}${url}` })
  await poll(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('main h1') && location.pathname === ${JSON.stringify(url)}`), url)
  await evaluate('document.fonts.ready.then(() => true)')
  await delay(100)
}
async function key(key, code, windowsVirtualKeyCode, text) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(text ? { text } : {}) })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode })
  await delay(80)
}
async function activate(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus({preventScroll: true})`)
  await key('Enter', 'Enter', 13, '\r')
}
async function scroll(y) {
  await evaluate(`window.scrollTo(0, ${y})`)
  await delay(80)
  const actual = await evaluate('scrollY')
  assert.ok(actual > 0, 'Source screen must actually be scrolled')
  return actual
}
async function atRoute(url, y, label) {
  await poll(() => evaluate(`location.pathname === ${JSON.stringify(url)} && Math.abs(scrollY - ${y}) < 2`), label)
  await delay(80)
  await check(`Math.abs(scrollY - ${y}) < 2 && document.activeElement.id === 'main-content'`, label)
}
async function history(direction, url, y, label) {
  await evaluate(`window.history.${direction}()`)
  await atRoute(url, y, label)
}

try {
  let targets
  await poll(async () => {
    try { targets = await (await fetch('http://127.0.0.1:9248/json/list')).json(); return targets.length > 0 } catch { return false }
  }, 'Chrome DevTools')
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) request.reject(new Error(JSON.stringify(message.error)))
      else request.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  }
  await cdp('Page.enable')
  await cdp('Runtime.enable')

  for (const width of [1440, 375]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 600, deviceScaleFactor: 1, mobile: width < 769 })
    const lobby = `/lobbies/navigation-${width}`
    const discovery = `${lobby}/discovery`
    const voting = `${lobby}/voting`
    await navigate(lobby)

    const edit = '.lobby-round-filters__controls button:first-child'
    await activate(edit)
    await check("document.activeElement.name === 'location'", `${width}px Lobby editor focuses its first field`)
    await evaluate(`(() => {
      const input = document.querySelector('.lobby-filter-editor [name=location]')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '')
      input.dispatchEvent(new Event('input', {bubbles: true}))
    })()`)
    await activate('.lobby-filter-editor button[type=submit]')
    await check("document.activeElement.name === 'location' && document.activeElement.getAttribute('aria-invalid') === 'true'", `${width}px Invalid Apply retains validation focus`)
    await activate('.lobby-filter-editor .lobby-actions button:last-child')
    await check(`document.activeElement === document.querySelector('${edit}') && getComputedStyle(document.activeElement).outlineStyle === 'solid' && !document.querySelector('.lobby-filter-editor')`, `${width}px Cancel restores visible keyboard focus to Edit filters`)
    await activate(edit)
    await evaluate(`(() => {
      const input = document.querySelector('.lobby-filter-editor [name=location]')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Pittsburgh, PA')
      input.dispatchEvent(new Event('input', {bubbles: true}))
    })()`)
    await activate('.lobby-filter-editor button[type=submit]')
    await check(`document.activeElement === document.querySelector('${edit}') && getComputedStyle(document.activeElement).outlineStyle === 'solid' && document.querySelector('.lobby-round-filters__summary').textContent.includes('Pittsburgh, PA')`, `${width}px Apply updates filters and restores visible keyboard focus`)

    const lobbyY = await scroll(300)
    await activate('.lobby-page__navigation button:first-child')
    await atRoute(discovery, 0, `${width}px Lobby to Discovery starts at top with main focused`)
    await check("getComputedStyle(document.activeElement).outlineStyle === 'none'", `${width}px Route focus does not outline the main content`)
    await key('Tab', 'Tab', 9)
    await check("document.querySelector('main').contains(document.activeElement) && document.activeElement.tagName === 'BUTTON'", `${width}px Tab continues into destination controls`)
    const discoveryY = await scroll(250)
    await activate('.discovery-options__actions a')
    await atRoute(voting, 0, `${width}px Discovery to Voting starts at top with main focused`)
    const votingY = await scroll(180)
    await history('back', discovery, discoveryY, `${width}px Back restores Discovery offset without focus scrolling`)
    await history('back', lobby, lobbyY, `${width}px Back restores Lobby offset`)
    await history('forward', discovery, discoveryY, `${width}px Forward restores Discovery offset`)
    await history('forward', voting, votingY, `${width}px Forward restores Voting offset`)

    for (let i = 0; i < 3; i++) await activate('.voting-choice--yes')
    await check("document.activeElement.id === 'voting-complete-heading'", `${width}px Voting keeps its existing completion focus`)
    await activate('.voting-results-link')
    await atRoute(`${lobby}/results`, 0, `${width}px Results opens at top with main focused`)
    const resultsY = await scroll(160)
    await evaluate(`window.scrollCalls = []; window.originalScrollTo = window.scrollTo; window.scrollTo = (...args) => { window.scrollCalls.push(args); window.originalScrollTo(...args) }`)
    await activate('.results-row:first-child .results-row__choose')
    await check(`location.search === '?selection=ramen' && scrollY === ${resultsY} && window.scrollCalls.length === 0 && document.activeElement === document.querySelector('.results-row:first-child .results-row__choose')`, `${width}px Results selection preserves scroll and focused button with zero scroll calls`)
    const selectionY = await scroll(220)
    await evaluate('window.scrollCalls = []')
    await activate('.results-row:nth-child(2) .results-row__choose')
    await check(`location.search === '?selection=harbor' && scrollY === ${selectionY} && window.scrollCalls.length === 0 && document.activeElement === document.querySelector('.results-row:nth-child(2) .results-row__choose')`, `${width}px Changing Results selection also preserves scroll and focus`)
    const secondSelectionY = await scroll(280)
    await evaluate('history.back()')
    await poll(() => evaluate(`location.search === '?selection=ramen' && scrollY === ${selectionY}`), 'Back to first selection')
    await check(`scrollY === ${selectionY} && document.activeElement === document.querySelector('.results-row:nth-child(2) .results-row__choose')`, `${width}px Query-only Back restores entry offset without stealing focus`)
    await evaluate('history.forward()')
    await poll(() => evaluate(`location.search === '?selection=harbor' && scrollY === ${secondSelectionY}`), 'Forward to second selection')
    await check(`scrollY === ${secondSelectionY}`, `${width}px Query-only Forward restores its own offset`)
    await evaluate('window.scrollTo = window.originalScrollTo')

    // A fresh visit to an earlier pathname gets its own position, rather than
    // borrowing that pathname's previous entry (the browser history key matters).
    await activate('.results-lobby')
    await atRoute(lobby, 0, `${width}px Fresh visit to Lobby starts at top`)
    await activate('.lobby-page__navigation button:first-child')
    await atRoute(discovery, 0, `${width}px Fresh visit to Discovery starts at top`)
  }

  await navigate('/')
  await check("document.activeElement === document.body && document.querySelector('.home-hero__heading').textContent.includes('Your group is hungry.')", 'Initial Home keeps native focus and existing content')
  await activate('.home-hero__actions button:first-child')
  await atRoute('/lobbies/create', 0, 'Home Create action focuses destination')
  await activate('.app-header__brand')
  await atRoute('/', 0, 'Header brand returns Home at top with main focused')
  await activate('.home-hero__actions button:nth-child(2)')
  await atRoute('/lobbies/join', 0, 'Home Join action focuses destination')
  await activate('.app-header__nav a')
  await atRoute('/', 0, 'Header Home navigation focuses destination')
  await activate('.app-header__nav button:last-of-type')
  await atRoute('/lobbies/join', 0, 'Header Enter lobby code focuses destination')
  await activate('.app-header__nav button:first-of-type')
  await check("document.querySelector('dialog[open]').contains(document.activeElement)", 'Existing dialog focuses modal content')
  await key('Escape', 'Escape', 27)
  await check("!document.querySelector('dialog[open]') && document.activeElement.textContent === 'How it works'", 'Existing dialog restores trigger focus on Escape')
  await activate('.skip-link')
  await check("document.activeElement.id === 'main-content' && location.hash === '#main-content'", 'Existing skip link focuses main content')
  assert.deepEqual(errors, [], 'No browser runtime exceptions')
  console.log(`COMPLETE ${passed} navigation and focus browser checks passed`)
} finally {
  if (ws?.readyState === 1) { await cdp('Browser.close').catch(() => {}); ws.close() }
  chrome.kill()
}
