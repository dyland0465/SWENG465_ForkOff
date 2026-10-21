import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

// Run against Vite with node tests/lobby.browser.mjs. Uses installed Chrome, no dependencies.
const base = process.env.FORKOFF_TEST_URL ?? 'http://127.0.0.1:5175'
const profile = await mkdtemp(path.join(tmpdir(), 'forkoff-lobby-chrome-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9249', `--user-data-dir=${profile}`, 'about:blank',
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
function pass(label) { passed++; console.log(`PASS ${label}`) }
async function check(expression, label) { assert.ok(await evaluate(expression), label); pass(label) }
async function navigate(url) {
  await cdp('Page.navigate', { url: `${base}${url}` })
  await poll(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('main h1') && location.pathname === ${JSON.stringify(url)}`), url)
  await evaluate('document.fonts.ready.then(() => true)')
}
async function viewport(width) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 769 })
}
async function key(key, modifiers = 0) {
  const windowsVirtualKeyCode = key === 'Tab' ? 9 : 13
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode, modifiers, ...(key === 'Enter' ? { text: '\r' } : {}) })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode, modifiers })
}
async function activate(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await key('Enter')
  await delay(30)
}
async function screenshot(name) {
  await evaluate('document.activeElement.blur(); window.scrollTo(0, 0)')
  const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const target = path.join(tmpdir(), `forkoff-lobby-${name}.png`)
  await writeFile(target, Buffer.from(result.data, 'base64'))
  console.log(`SCREENSHOT ${target}`)
}

async function layout(label) {
  // Check the controls themselves and their ancestors: hiding page overflow cannot pass this check.
  const issues = await evaluate(`(() => {
    const issues = []
    if (document.documentElement.scrollWidth > innerWidth) issues.push('Horizontal page overflow')
    const controls = [...document.querySelectorAll('header a, header button, main button, main a, main input, main select')]
      .filter(el => el.getClientRects().length && !el.matches('.skip-link'))
    for (const el of controls) {
      const r = el.getBoundingClientRect(), name = el.textContent.trim() || el.name || el.id
      if (r.left < -1 || r.right > innerWidth + 1) issues.push(name + ': outside viewport')
      if (r.width < 44 || r.height < 44) issues.push(name + ': target under 44px')
      if (!el.matches('input,select') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) issues.push(name + ': text overflow')
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const p = parent.getBoundingClientRect(), style = getComputedStyle(parent)
        if ((innerWidth < 1001 || ['clip', 'hidden', 'auto', 'scroll'].includes(style.overflowX)) && (r.left < p.left - 1 || r.right > p.right + 1)) issues.push(name + ': outside ' + parent.className)
        if (['clip', 'hidden', 'auto', 'scroll'].includes(style.overflowY) && (r.top < p.top - 1 || r.bottom > p.bottom + 1)) issues.push(name + ': vertically clipped')
      }
    }
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d')
    for (const select of document.querySelectorAll('main select')) {
      const style = getComputedStyle(select)
      context.font = style.font
      const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      for (const option of select.options) if (context.measureText(option.textContent).width > available + 1) issues.push(select.name + ': ' + option.textContent + ' needs ' + context.measureText(option.textContent).width + 'px; available ' + available + 'px')
    }
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i].getBoundingClientRect(), b = controls[j].getBoundingClientRect()
      if (Math.min(a.right,b.right) - Math.max(a.left,b.left) > 1 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 1) issues.push('Overlapping controls')
    }
    for (const el of document.querySelectorAll('.lobby-member, .lobby-chat-preview__message, .lobby-code, .lobby-round-filters__matches, .lobby-page__host-controls')) {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) issues.push(el.className + ': overflowing content')
    }
    return issues
  })()`)
  assert.deepEqual(issues, [], label)
  pass(label)
}

async function tabOrder(label, mobile) {
  await evaluate(`(() => {
    window.lobbyTabStops = [...document.querySelectorAll('header a,header button,main a,main button,main input,main select')]
      .filter(el => !el.disabled && el.getClientRects().length)
    document.querySelector('.skip-link').focus()
  })()`)
  const count = await evaluate('window.lobbyTabStops.length')
  for (let i = 1; i < count; i++) {
    await key('Tab')
    // Native time inputs have several internal keyboard stops on the same DOM element.
    for (let segment = 0; segment < 5 && await evaluate(`document.activeElement === window.lobbyTabStops[${i-1}]`); segment++) await key('Tab')
    assert.ok(await evaluate(`document.activeElement === window.lobbyTabStops[${i}] && document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineStyle === 'solid'`), `${label} Tab ${i}: DOM order and visible focus`)
    assert.ok(await evaluate(`(() => {
      const el = document.activeElement, r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2)
      return r.left >= 6 && r.right <= innerWidth - 6 && r.top >= -1 && r.bottom <= innerHeight + 1 && (hit === el || el.contains(hit))
    })()`), `${label} Tab ${i}: visible and unobscured: ${await evaluate('JSON.stringify({name: document.activeElement.textContent,rect: document.activeElement.getBoundingClientRect().toJSON(), viewport:[innerWidth,innerHeight]})')}`)
  }
  pass(label + ' Tab reaches every control with visible focus and no obstruction')
  for (let i = count - 2; i >= 0; i--) {
    await key('Tab', 8)
    for (let segment = 0; segment < 5 && await evaluate(`document.activeElement === window.lobbyTabStops[${i+1}]`); segment++) await key('Tab', 8)
    assert.ok(await evaluate(`document.activeElement === window.lobbyTabStops[${i}] && (document.activeElement.matches(':focus-visible') || document.activeElement.matches('input[type=time]:focus-within')) && getComputedStyle(document.activeElement).outlineStyle === 'solid'`), `${label} Shift+Tab ${i}: DOM order and visible focus`)
  }
  pass(label + ' Shift+Tab reverses the sequence')
  if (mobile) await check(`window.lobbyTabStops.slice(1).every((el,i,all) => !i || el.getBoundingClientRect().top >= all[i-1].getBoundingClientRect().top - 1)`, `${label} visual reading order matches DOM`)
  else await check(`(() => {
    const people = document.querySelector('.lobby-page__people').getBoundingClientRect()
    const settings = document.querySelector('.lobby-page__settings').getBoundingClientRect()
    return people.right <= settings.left && people.top === settings.top
  })()`, `${label} desktop reads down left column then right column`)
}

try {
  let targets
  await poll(async () => {
    try { targets = await (await fetch('http://127.0.0.1:9249/json/list')).json(); return targets.length > 0 } catch { return false }
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

  for (const width of [320, 375, 768, 1440]) {
    for (const textSize of width < 769 ? [100, 200] : [100]) {
      const label = width + 'px / ' + textSize + '% text'
      await viewport(width)
      await navigate('/lobbies/accessibility')
      await evaluate('document.documentElement.style.fontSize = ' + JSON.stringify(textSize + '%'))
      await layout(label + ' default layout')
      await tabOrder(label, width < 1001)
      await screenshot(width + '-text' + textSize)
      // Exercise both feedback states without relying on OS clipboard availability.
      for (const state of ['success', 'error']) {
        await evaluate(`Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: () => ${state === 'success' ? 'Promise.resolve()' : 'Promise.reject(new Error("Clipboard unavailable"))'} })`)
        await activate('.lobby-code button')
        await poll(() => evaluate(`document.querySelector('.lobby-code__feedback').textContent.includes(${JSON.stringify(state === 'success' ? 'copied' : 'unavailable')})`), 'Clipboard feedback')
        await layout(label + ' clipboard ' + state)
      }
      await activate('.lobby-round-filters__controls button:first-child')
      await layout(label + ' filter editor')
      await tabOrder(label + ' editor', width < 1001)
      if (width === 375 && textSize === 200) await screenshot('375-text200-editor')
      await activate('.lobby-filter-editor .lobby-actions button:last-child')
      await check("document.activeElement === document.querySelector('.lobby-round-filters__controls button:first-child')", label + ' Cancel retains existing focus restoration')
      await evaluate(`(() => {
        const select = document.querySelector('.lobby-demo-note select')
        select.value = 'member'; select.dispatchEvent(new Event('change', {bubbles:true}))
      })()`)
      await layout(label + ' member role')
      await check("document.querySelector('.lobby-page__navigation button:first-child').disabled && !document.querySelector('.lobby-page__navigation button:last-child').disabled", label + ' member controls stay available as intended')
    }
  }
  await viewport(1440)
  await navigate('/lobbies/accessibility')
  await check(`(() => {
    const people = document.querySelector('.lobby-page__people').getBoundingClientRect(), settings = document.querySelector('.lobby-page__settings').getBoundingClientRect(), code = document.querySelector('.lobby-code').getBoundingClientRect()
    const canvas = document.querySelector('.home-screen').clientWidth, available = canvas - 240
    return Math.abs(people.x - 80) < 1 && Math.abs(people.width - available * 560/1200) < 1 && Math.abs(settings.x - (160 + people.width)) < 1 && Math.abs(settings.width - available * 640/1200) < 1 && Math.abs(code.x - (canvas - 510)) < 1 && Math.abs(code.width - 430) < 1
  })()`, '1440px Figma columns and invitation panel geometry preserved')
  for (const width of [375, 1440]) {
    await viewport(width)
    await navigate('/')
    await check("getComputedStyle(document.querySelector('.home-screen')).overflowX === 'clip' && !document.querySelector('.lobby-page-screen') && document.querySelector('.home-hero__illustration').getBoundingClientRect().width > innerWidth", width + 'px Home illustration cropping preserved')
    await screenshot('home-' + width)
  }
  assert.deepEqual(errors, [], 'No browser runtime exceptions')
  console.log(`COMPLETE ${passed} Lobby accessibility checks passed`)
} finally {
  if (ws?.readyState === 1) { await cdp('Browser.close').catch(() => {}); ws.close() }
  chrome.kill()
}
