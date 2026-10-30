import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { getDemoPartnerReport, partnerReportCsv, reportingPeriods } from '../src/features/partner/demoPartnerAnalytics.ts'

// Installed Chrome + Node 24; server/build matrix: docs/partner-authentication.md.
let base = process.env.FORKOFF_TEST_URL ?? 'http://127.0.0.1:5175'
const disabledBase = process.env.FORKOFF_DISABLED_TEST_URL ?? 'http://127.0.0.1:5187'
const productionBase = process.env.FORKOFF_PRODUCTION_TEST_URL ?? 'http://127.0.0.1:5188'
const stagingBase = process.env.FORKOFF_STAGING_TEST_URL ?? 'http://127.0.0.1:5189'
const productionDefaultBase = process.env.FORKOFF_PRODUCTION_DEFAULT_TEST_URL ?? 'http://127.0.0.1:5190'
const stagingDisabledBase = process.env.FORKOFF_STAGING_DISABLED_TEST_URL ?? 'http://127.0.0.1:5191'
const demoBuildsOnly = process.argv.includes('--demo-builds-only')
const artifacts = await mkdtemp(path.join(tmpdir(), 'forkoff-partner-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9255', `--user-data-dir=${path.join(artifacts, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let ws, sequence = 0, passed = 0, loads = 0
const pending = new Map(), errors = [], requests = []
async function poll(fn, label) {
  for (let i = 0; i < 100; i++) { if (await fn()) return; await delay(80) }
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
async function check(expression, label) { assert.ok(await evaluate(expression), label); passed++; console.log(`PASS ${label}`) }
async function navigate(url) {
  await cdp('Page.navigate', { url: `${base}${url}` })
  await poll(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('main h1') && location.pathname === ${JSON.stringify(url)}`), url)
  await evaluate('document.fonts.ready.then(() => true)')
}
async function reload(selector) {
  const previousLoads = loads
  await cdp('Page.reload')
  await poll(() => loads > previousLoads, 'Reload completed')
  await poll(() => evaluate(`document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(selector)})`), 'Reload rendered')
}
async function key(key, code, windowsVirtualKeyCode) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(key === 'Enter' ? { text: '\r' } : {}) })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode })
  await delay(60)
}
async function activate(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await key('Enter', 'Enter', 13)
}
async function input(selector, value) {
  await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
}
async function guardedVisit() {
  await cdp('Page.navigate', { url: `${base}/partners/harbor` })
  await poll(() => evaluate("location.pathname === '/partners' && !!document.querySelector('.partner-access')"), 'Guard redirects to Partner Access')
}
async function selectPeriod(id) {
  await evaluate(`(() => { const select = document.querySelector('#partner-reporting-period'); select.value = ${JSON.stringify(id)}; select.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await delay(80)
}
async function screenshot(name) {
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(path.join(artifacts, name), Buffer.from(shot.data, 'base64'))
}

try {
  let targets
  await poll(async () => { try { targets = await (await fetch('http://127.0.0.1:9255/json/list')).json(); return targets.length > 0 } catch { return false } }, 'Chrome')
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result) }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
    else if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url)
    else if (message.method === 'Page.loadEventFired') loads++
  }
  await cdp('Page.enable')
  await cdp('Runtime.enable')
  await cdp('Network.enable')
  await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: artifacts })

  if (!demoBuildsOnly) {
  await navigate('/partners')
  await evaluate('sessionStorage.clear(); localStorage.clear()')
  await guardedVisit()
  await check("!document.querySelector('.partner-page') && document.querySelector('h1').textContent === 'Partner access'", 'Direct dashboard entry without preview state redirects to Access')
  await evaluate('window.storageBeforeSignIn = JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } })')
  await activate('form button[type=submit]')
  await check("document.activeElement.id === 'partner-email' && document.querySelector('#partner-email-error').textContent === 'Enter your email address.' && document.querySelector('#partner-password-error').textContent === 'Enter your password.'", 'Empty submission validates both required fields and focuses email')
  await check("document.querySelector('label[for=partner-email]') && document.querySelector('#partner-email').getAttribute('aria-describedby').includes('partner-email-error') && document.querySelector('#partner-password').getAttribute('aria-invalid') === 'true'", 'Field errors are associated with accessible labels and invalid states')
  await input('#partner-email', 'invalid@')
  await input('#partner-password', 'test-only-input')
  await activate('form button[type=submit]')
  await check("document.activeElement.id === 'partner-email' && document.querySelector('#partner-email-error').textContent === 'Enter a valid email address.'", 'Malformed email is rejected')
  await input('#partner-email', 'partner@example.test')
  await input('#partner-password', '')
  await activate('form button[type=submit]')
  await check("document.activeElement.id === 'partner-password' && !document.querySelector('#partner-email-error')", 'Valid email with missing password focuses password')
  await input('#partner-password', 'test-only-input')
  await activate('.partner-access__password-toggle')
  await check("document.querySelector('#partner-password').type === 'text' && document.querySelector('.partner-access__password-toggle').getAttribute('aria-pressed') === 'true' && document.querySelector('.partner-access__password-toggle').getAttribute('aria-label') === 'Hide password'", 'Keyboard Show reveals password and updates accessible state')
  await activate('.partner-access__password-toggle')
  await check("document.querySelector('#partner-password').type === 'password' && document.querySelector('#partner-password').value === 'test-only-input'", 'Keyboard Hide masks the unchanged password')
  await activate('form button[type=submit]')
  await check("location.pathname === '/partners' && document.querySelector('.partner-access__feedback').textContent.includes('Unable to sign in') && JSON.stringify({ session: { ...sessionStorage }, local: { ...localStorage } }) === window.storageBeforeSignIn", 'Valid submission without a reachable backend reports failure and creates no session or storage')  
  await guardedVisit()
  await check("location.pathname === '/partners'", 'Submitting valid fields never unlocks analytics')

  // Exercise the integration states with a deferred failing adapter, never a successful fake session.
  await evaluate(`(async () => {
    window.authModule = await import('/src/features/partner/partnerAuthentication.ts');
    window.originalSignIn = window.authModule.partnerAuthentication.signIn;
    window.signInCalls = 0;
    window.authModule.partnerAuthentication.signIn = (_credentials, signal) => {
      window.signInCalls++; window.signInSignal = signal;
      return new Promise((_resolve, reject) => { window.rejectSignIn = reject });
    };
  })()`)
  await input('#partner-email', 'partner@example.test')
  await input('#partner-password', 'test-only-input')
  await activate('form button[type=submit]')
  await check("document.querySelector('form').getAttribute('aria-busy') === 'true' && [...document.querySelectorAll('form input, form button')].every(el => el.disabled) && document.querySelector('form button[type=submit]').textContent === 'Signing in…'", 'Pending request exposes busy state and disables all form controls')
  await evaluate("document.querySelector('form').requestSubmit()")
  await check('window.signInCalls === 1', 'Repeated submission cannot create duplicate pending requests')
  await evaluate("window.rejectSignIn(new Error('Test service unavailable'))")
  await poll(() => evaluate("document.querySelector('[role=status]').textContent.includes('Unable to sign in')"), 'Service failure')
  await check("!document.querySelector('form button[type=submit]').disabled && document.querySelector('form').getAttribute('aria-busy') === 'false' && location.pathname === '/partners'", 'Service failure restores the form without granting access')
  await activate('form button[type=submit]')
  await activate('.partner-access > a')
  await check('window.signInSignal.aborted', 'Leaving Access cancels an outstanding authentication request')
  await evaluate("window.rejectSignIn(new Error('Canceled test request')); window.authModule.partnerAuthentication.signIn = window.originalSignIn")

  for (const width of [1440, 375]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await navigate('/')
    for (let i = 0; i < 6; i++) await key('Tab', 'Tab', 9)
    await check("document.activeElement.textContent === 'For Restaurants' && document.activeElement.getAttribute('href') === '/partners' && getComputedStyle(document.activeElement).outlineStyle === 'solid'", `${width}px Home partner link is reachable with Tab and has visible focus`)
    await key('Enter', 'Enter', 13)
    await poll(() => evaluate("location.pathname === '/partners' && document.activeElement.id === 'main-content'"), 'Partner Access')
    await check("document.querySelector('h1').textContent === 'Partner access' && !!document.querySelector('.app-header') && !document.querySelector('.partner-header')", `${width}px Home opens Partner Access in the shared layout`)
    await check("document.querySelector('#partner-demo-description').textContent.includes('synthetic sample data only') && document.querySelector('#partner-demo-description').textContent.includes('does not sign you in') && document.querySelectorAll('form input').length === 2", `${width}px Partner Access separates sign-in from the labeled demo preview`)
    await key('Tab', 'Tab', 9)
    await check("document.activeElement.id === 'partner-tab-sign-in' && document.activeElement.getAttribute('aria-selected') === 'true'", `${width}px Tab from route focus reaches the selected Sign in tab`)
    await key('Tab', 'Tab', 9)
    await check("document.activeElement.id === 'partner-email' && getComputedStyle(document.activeElement).outlineStyle === 'solid'", `${width}px Tab from the tabs reaches email with visible keyboard focus`)
    await key('Tab', 'Tab', 9)
    await check("document.activeElement.id === 'partner-password'", `${width}px Tab reaches password`)
    await key('Tab', 'Tab', 9)
    await check("document.activeElement.classList.contains('partner-access__password-toggle')", `${width}px Tab reaches password visibility control`)
    await key('Tab', 'Tab', 9)
    await check("document.activeElement.type === 'submit'", `${width}px Tab reaches Sign In`)
    await key('Tab', 'Tab', 9)
    await check("document.activeElement.textContent.trim() === 'Preview Demo Dashboard' && getComputedStyle(document.activeElement).outlineStyle === 'solid'", `${width}px Tab reaches the distinct demo action`)
    await key('Enter', 'Enter', 13)
    await poll(() => evaluate("location.pathname === '/partners/harbor' && !!document.querySelector('.partner-demo-notice')"), 'Demo dashboard')
    await check("document.activeElement.id === 'main-content' && document.querySelector('.partner-demo-notice').textContent.includes('All figures are synthetic.')", `${width}px Demo action opens the existing synthetic dashboard with route focus`)
    await check("sessionStorage.getItem('forkoff.partner-demo-preview.v1') === 'active' && Object.keys(sessionStorage).every(key => ['forkoff.partner-demo-preview.v1', 'react-router-scroll-positions'].includes(key)) && localStorage.length === 0", `${width}px Preview stores only a tab-scoped demo marker alongside router scroll positions`)
    await evaluate('history.back()')
    await poll(() => evaluate("location.pathname === '/partners' && document.activeElement.id === 'main-content'"), 'Back to Access')
    await evaluate('history.back()')
    await poll(() => evaluate("location.pathname === '/' && document.activeElement.id === 'main-content'"), 'Back to Home')
    await evaluate('history.forward()')
    await poll(() => evaluate("location.pathname === '/partners' && document.activeElement.id === 'main-content'"), 'Forward to Access')
    await evaluate('history.forward()')
    await poll(() => evaluate("location.pathname === '/partners/harbor' && document.activeElement.id === 'main-content'"), 'Forward to Dashboard')
    await check("!!document.querySelector('.partner-header') && !document.querySelector('.app-header')", `${width}px Back/Forward preserves all three destinations and dashboard layout`)
    await activate('.partner-header__brand')
    await check("location.pathname === '/' && !!document.querySelector('.home-hero')", `${width}px Dashboard brand returns Home`)
    await activate('.app-header__nav a:last-child')
    await activate('.partner-access > a')
    await check("location.pathname === '/' && document.activeElement.id === 'main-content'", `${width}px Access Back to Home returns to the consumer Home screen`)
    await activate('.app-header__nav a:last-child')
    await activate('.app-header__nav a:first-child')
    await check("location.pathname === '/'", `${width}px Shared header Home link also returns Home from Access`)
    await navigate('/partners')
    await reload('.partner-access')
    await check("location.pathname === '/partners' && !!document.querySelector('.app-header') && document.querySelectorAll('main, h1').length === 2", `${width}px Direct access and refresh preserve a single main landmark and heading`)
    await activate('.skip-link')
    await check("document.activeElement.id === 'main-content'", `${width}px Access skip link focuses main content`)
  }

  for (const width of [320, 375, 600, 768, 800, 960, 1024, 1280, 1440, 1920]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1024, deviceScaleFactor: 1, mobile: false })
    await navigate('/')
    await check(`document.documentElement.scrollWidth <= ${width} && [...document.querySelectorAll('.app-header__brand, .app-header__nav a, .app-header__nav button')].every(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= ${width} && r.height >= 44 })`, `${width}px Home header and added partner link fit with accessible targets`)
    await activate('.app-header__nav a:last-child')
    await check(`document.documentElement.scrollWidth <= ${width} && [...document.querySelectorAll('.partner-access .ui-button, .partner-access input, .partner-access > a')].every(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= ${width} && r.height >= 44 })`, `${width}px Partner Access fits with accessible fields and action targets`)
    if ([320, 375, 800, 1440].includes(width)) await screenshot(`partner-access-${width}.png`)
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: false })
  await evaluate("document.documentElement.style.fontSize = '200%'")
  await check("document.documentElement.scrollWidth <= 375 && document.querySelector('.partner-access .ui-button').getBoundingClientRect().right <= 375", 'Partner Access supports enlarged text without horizontal overflow')
  await evaluate("document.documentElement.style.fontSize = ''")

  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false })
  await navigate('/partners/harbor')
  await check("document.querySelectorAll('header').length === 1 && !document.querySelector('.app-header') && document.querySelector('h1').textContent === 'Partner analytics'", 'Partner uses its own Figma header on the established route')
  await check("document.querySelector('.partner-demo-notice').textContent.includes('Demonstration data') && document.querySelector('.partner-demo-notice').textContent.includes('no authenticated partner access')", 'Synthetic data and unauthenticated preview are labeled visibly')
  await check("[...document.querySelectorAll('.partner-metric__value')].map(el => el.textContent).join('|') === '12,480|712|126|10.1%'", 'Initial metrics agree with the sample vote chart')
  await check("document.querySelectorAll('.partner-chart__group').length === 4 && document.querySelector('.partner-promotions').textContent.includes('15.1% CTR')", 'Default chart and promotion rates match the 30-day report')
  await screenshot('partner-1440-initial.png')
  await activate('.partner-data-table summary')
  await check("document.querySelector('details[open] table tfoot').textContent === 'Total7123261171155' && document.querySelectorAll('table th[scope=col]').length === 5", 'Keyboard opens an accessible equivalent table with consistent totals')
  await activate('.partner-data-table summary')
  await activate('.partner-header nav a:nth-child(2)')
  await check("document.activeElement.id === 'partner-promotions-title'", 'Promotions navigation focuses the engagement section')
  await activate('[aria-controls=partner-support]')
  await check("document.activeElement.id === 'partner-support-title' && document.querySelector('[aria-controls=partner-support]').getAttribute('aria-expanded') === 'true'", 'Support opens local guidance with keyboard focus')
  await activate('.partner-support button')
  await check("!document.querySelector('#partner-support') && document.activeElement.getAttribute('aria-controls') === 'partner-support'", 'Closing support restores focus')
  await activate('.partner-header nav a:first-child')
  await check("document.activeElement.id === 'main-content'", 'Overview navigation focuses the dashboard')

  for (const period of reportingPeriods.slice(0, 2)) {
    await selectPeriod(period.id)
    const report = getDemoPartnerReport(period)
    await check(`document.querySelectorAll('.partner-chart__group').length === ${report.buckets.length} && document.querySelectorAll('.partner-metric__value')[1].textContent === '${report.totals.yes}'`, `${period.id} synchronizes metrics and chart`)
    await check(`document.querySelector('[role=status]').textContent.includes('${period.start === '2026-08-10' ? 'Aug 10' : 'Sep 2'}')`, `${period.id} announces the displayed reporting period`)
    await activate('.partner-export')
    const filename = `fork-off-demo-harbor-${period.start}-to-${period.end}.csv`
    await poll(async () => (await readdir(artifacts)).includes(filename), 'CSV download')
    assert.equal((await readFile(path.join(artifacts, filename), 'utf8')).replace(/^\uFEFF/, ''), partnerReportCsv(report))
    passed++; console.log(`PASS ${period.id} actual CSV download matches only displayed demo data`)
  }
  // Native keyboard selection also drives React and keeps focus on the select.
  await evaluate("document.querySelector('#partner-reporting-period').focus()")
  await key('ArrowUp', 'ArrowUp', 38)
  await check("document.querySelector('#partner-reporting-period').value === '30-days' && document.activeElement.id === 'partner-reporting-period'", 'Native keyboard period control updates without moving focus')
  await selectPeriod('empty')
  await check("document.querySelector('.partner-export').disabled && document.querySelectorAll('.partner-chart__bar').length === 0 && [...document.querySelectorAll('.partner-metric__value')].every(el => el.textContent === '—') && !!document.querySelector('.partner-promotions .partner-empty')", 'Empty reporting period has no invented metrics, chart, promotions, or CSV')
  await selectPeriod('30-days')

  for (const width of [320, 375, 600, 768, 1024, 1280, 1440, 1920]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1024, deviceScaleFactor: 1, mobile: false })
    for (const period of ['30-days', '7-days']) {
      await selectPeriod(period)
      await evaluate('window.scrollTo(0, 0)')
      await check(`document.documentElement.scrollWidth <= ${width} && [...document.querySelectorAll('.partner-chart__group, .partner-metric, .partner-controls')].every(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= ${width} })`, `${width}px ${period} layout fits without horizontal overflow`)
      await check("[...document.querySelectorAll('.partner-header a:not(.skip-link), .partner-header button, .partner-controls button, .partner-controls select, .partner-data-table summary')].every(el => el.getBoundingClientRect().height >= 44)", `${width}px ${period} controls retain accessible targets`)
      if ([320, 768, 1440, 1920].includes(width)) await screenshot(`partner-${width}-${period}.png`)
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 800, deviceScaleFactor: 1, mobile: false })
  await activate('.partner-data-table summary')
  await check("document.documentElement.scrollWidth <= 320 && document.querySelector('table').getBoundingClientRect().right <= 320", 'Expanded data table fits 320px')
  await screenshot('partner-320-table.png')
  await navigate('/partners/unknown')
  await check("document.querySelector('.partner-export').disabled && !document.querySelector('.partner-chart__group') && document.querySelector('.partner-demo-notice a').getAttribute('href') === '/partners/harbor'", 'Unknown restaurant IDs show empty data with an explicit demo link')
  await activate('.partner-demo-notice a')
  await check("location.pathname === '/partners/harbor' && document.activeElement.id === 'main-content' && !document.querySelector('.partner-export').disabled", 'Client-side demo navigation restores the correct scope and route focus')
  await activate('.partner-header__brand')
  await check("location.pathname === '/' && !!document.querySelector('.app-header') && !document.querySelector('.partner-header')", 'Partner brand returns Home with its consumer header')
  await evaluate('history.back()')
  await poll(() => evaluate("location.pathname === '/partners/harbor'"), 'Back to Partner')
  await check("document.activeElement.id === 'main-content' && !!document.querySelector('.partner-header')", 'Browser Back restores Partner with route focus')
  await reload('.partner-chart__group')
  await check("document.querySelector('#partner-reporting-period').value === '30-days'", 'Refresh resets local reporting controls to the sample default')
  await check("sessionStorage.getItem('forkoff.partner-demo-preview.v1') === 'active' && !!document.querySelector('.partner-demo-notice')", 'Refresh preserves demo preview without creating authentication')
  await activate('.partner-header nav button:last-child')
  await check("location.pathname === '/partners' && !sessionStorage.getItem('forkoff.partner-demo-preview.v1') && document.activeElement.id === 'main-content'", 'Exit demo clears preview and returns to Access with route focus')
  await evaluate('history.back()')
  await delay(200)
  await check("location.pathname !== '/partners/harbor' && !document.querySelector('.partner-page')", 'Back cannot restore an exited preview')
  await evaluate('history.forward()')
  await delay(200)
  await check("!document.querySelector('.partner-page')", 'Forward cannot restore an exited preview')
  await guardedVisit()
  await check("!document.querySelector('.partner-page')", 'Direct access remains guarded after exit')

  // Storage restrictions fail closed on refresh while in-memory demo navigation still works.
  await evaluate("window.storageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage'); Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError') } }); true")
  await activate('.partner-access__demo button')
  await check("location.pathname === '/partners/harbor' && !!document.querySelector('.partner-page')", 'Preview navigation works in memory when sessionStorage is blocked')
  await activate('.partner-header nav button:last-child')
  await check("location.pathname === '/partners'", 'Exit clears in-memory access when storage is blocked')
  await evaluate("Object.defineProperty(window, 'sessionStorage', window.storageDescriptor); true")
  }

  const developmentBase = base
  for (const [url, label] of [
    [disabledBase, 'Development without opt-in'],
    [productionBase, 'Production built with opt-in true'],
    [productionDefaultBase, 'Production built with defaults'],
    [stagingDisabledBase, 'Staging built without opt-in'],
  ]) {
    base = url
    await navigate('/partners')
    await check("!!document.querySelector('form') && !document.querySelector('.partner-access__demo') && !document.body.textContent.includes('Preview Demo Dashboard')", `${label} keeps sign-in but has no demo entry`)
    await evaluate("sessionStorage.setItem('forkoff.partner-demo-preview.v1', 'active')")
    await guardedVisit()
    await check("!document.querySelector('.partner-page')", `${label} ignores even a manually seeded preview marker`)
    await reload('.partner-access')
    await check("location.pathname === '/partners' && !document.querySelector('.partner-access__demo')", `${label} remains disabled on refresh`)
  }

  // Exercise the shipped optimized staging bundle; source-module imports are dev-only.
  base = stagingBase
  const stagingRequestStart = requests.length
  await navigate('/partners')
  await evaluate('sessionStorage.clear(); localStorage.clear()')
  await guardedVisit()
  await check("!!document.querySelector('form') && !!document.querySelector('.partner-access__demo') && !document.querySelector('.partner-page')", 'Optimized staging requires entry from Access before opening the dashboard')
  await input('#partner-email', 'partner@example.test')
  await input('#partner-password', 'test-only-input')
  await activate('form button[type=submit]')
  await check("location.pathname === '/partners' && document.querySelector('.partner-access__feedback').textContent.includes('You have not been signed in') && !sessionStorage.getItem('forkoff.partner-demo-preview.v1') && localStorage.length === 0", 'Optimized staging sign-in remains unavailable and cannot start demo mode')
  await guardedVisit()
  await evaluate("window.storageBeforePreview = { ...sessionStorage }; true")
  await activate('.partner-access__demo button')
  const stagingReport = getDemoPartnerReport(reportingPeriods[0])
  await check(`location.pathname === '/partners/harbor' && document.querySelector('.partner-demo-notice').textContent.includes('All figures are synthetic.') && document.querySelectorAll('.partner-metric__value')[1].textContent === '${stagingReport.totals.yes}'`, 'Explicit staging demo entry opens only the synthetic Harbor report')
  await check("sessionStorage.getItem('forkoff.partner-demo-preview.v1') === 'active' && Object.keys(sessionStorage).every(key => ['forkoff.partner-demo-preview.v1', 'react-router-scroll-positions'].includes(key) || sessionStorage.getItem(key) === window.storageBeforePreview[key]) && localStorage.length === 0", 'Optimized staging adds only demo and router state, never credentials or authentication')
  const stagingDownloads = path.join(artifacts, 'staging')
  await mkdir(stagingDownloads)
  await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: stagingDownloads })
  await activate('.partner-export')
  const stagingCsv = `fork-off-demo-harbor-${stagingReport.period.start}-to-${stagingReport.period.end}.csv`
  await poll(async () => (await readdir(stagingDownloads)).includes(stagingCsv), 'Optimized staging CSV download')
  assert.equal((await readFile(path.join(stagingDownloads, stagingCsv), 'utf8')).replace(/^\uFEFF/, ''), partnerReportCsv(stagingReport))
  passed++; console.log('PASS Optimized staging exports only the displayed synthetic report')
  await navigate('/partners/unknown')
  await check("document.querySelector('.partner-export').disabled && !document.querySelector('.partner-chart__group') && document.querySelector('.partner-demo-notice a').getAttribute('href') === '/partners/harbor'", 'Optimized staging unknown restaurant IDs expose no records or invented analytics')
  await activate('.partner-demo-notice a')
  await reload('.partner-page')
  await check("location.pathname === '/partners/harbor' && !!document.querySelector('.partner-demo-notice')", 'Optimized staging refresh retains the tab-scoped preview')
  await activate('.partner-header nav button:last-child')
  await check("location.pathname === '/partners' && !sessionStorage.getItem('forkoff.partner-demo-preview.v1')", 'Optimized staging exit clears demo state and returns to Access')
  await evaluate('history.back()')
  await delay(200)
  await check("!document.querySelector('.partner-page')", 'Optimized staging history cannot restore an exited demo')
  await guardedVisit()
  await check("!document.querySelector('.partner-page')", 'Optimized staging direct entry remains guarded after exit')
  await evaluate("window.storageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage'); Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError') } }); true")
  await activate('.partner-access__demo button')
  await check("location.pathname === '/partners/harbor' && !!document.querySelector('.partner-page')", 'Optimized staging supports explicit demo entry with blocked storage')
  await activate('.partner-header nav button:last-child')
  await check("location.pathname === '/partners'", 'Optimized staging exit clears in-memory demo state with blocked storage')
  await activate('.partner-access__demo button')
  await reload('.partner-access')
  await check("location.pathname === '/partners' && !document.querySelector('.partner-page')", 'Optimized staging refresh without a stored marker requires explicit entry again')
  assert.ok(requests.slice(stagingRequestStart).every(url => !/^https?:/.test(url) || (new URL(url).origin === new URL(stagingBase).origin && (!new URL(url).pathname.startsWith('/api') || new URL(url).pathname === '/api/auth/session'))), 'Optimized staging makes no partner API or external requests; only the existing consumer session check is allowed')
  passed++; console.log('PASS Optimized staging makes no partner API or external requests')
  base = developmentBase

  const screens = ['/', '/lobbies/create', '/lobbies/join', '/lobbies/partner-regression', '/lobbies/partner-regression/discovery', '/lobbies/partner-regression/voting', '/lobbies/partner-regression/restaurants/ramen', '/lobbies/partner-regression/chat', '/lobbies/partner-regression/results']
  if (!demoBuildsOnly) {
    for (const url of screens) { await navigate(url); await check("!!document.querySelector('.app-header') && !document.querySelector('.partner-header') && document.querySelector('main h1').textContent.length > 0", `Consumer screen ${url} retains its existing header and renders`) }
  }
  assert.deepEqual(errors, [], 'No browser runtime exceptions')
  assert.ok(requests.every(url => !/^https?:/.test(url) || [base, disabledBase, productionBase, stagingBase, productionDefaultBase, stagingDisabledBase].some(origin => new URL(url).origin === new URL(origin).origin)), 'No external API or service requests')
  console.log(`COMPLETE ${passed} Partner browser checks passed. Artifacts: ${artifacts}`)
} finally {
  if (ws?.readyState === 1) { await cdp('Browser.close').catch(() => {}); ws.close() }
  chrome.kill()
}
