import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { getDemoPartnerReport, partnerReportCsv, reportingPeriods } from '../src/features/partner/demoPartnerAnalytics.ts'

// Installed Chrome + Node 24; start Vite on port 5175. No added dependencies.
const base = process.env.FORKOFF_TEST_URL ?? 'http://127.0.0.1:5175'
const artifacts = await mkdtemp(path.join(tmpdir(), 'forkoff-partner-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9255', `--user-data-dir=${path.join(artifacts, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let ws, sequence = 0, passed = 0
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
async function key(key, code, windowsVirtualKeyCode) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(key === 'Enter' ? { text: '\r' } : {}) })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode })
  await delay(60)
}
async function activate(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await key('Enter', 'Enter', 13)
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
  }
  await cdp('Page.enable')
  await cdp('Runtime.enable')
  await cdp('Network.enable')
  await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: artifacts })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false })
  await navigate('/partners/harbor')
  await check("document.querySelectorAll('header').length === 1 && !document.querySelector('.app-header') && document.querySelector('h1').textContent === 'Partner analytics'", 'Partner uses its own Figma header on the established route')
  await check("document.querySelector('.partner-demo-notice').textContent.includes('Demonstration data') && document.querySelector('.partner-demo-notice').textContent.includes('no authenticated partner access')", 'Synthetic data and public access are labeled visibly')
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
  await cdp('Page.reload')
  await poll(() => evaluate("document.readyState === 'complete' && !!document.querySelector('.partner-chart__group')"), 'Partner reload')
  await check("document.querySelector('#partner-reporting-period').value === '30-days'", 'Refresh resets local reporting controls to the sample default')

  const screens = ['/', '/lobbies/create', '/lobbies/join', '/lobbies/partner-regression', '/lobbies/partner-regression/discovery', '/lobbies/partner-regression/voting', '/lobbies/partner-regression/restaurants/ramen', '/lobbies/partner-regression/chat', '/lobbies/partner-regression/results']
  for (const url of screens) { await navigate(url); await check("!!document.querySelector('.app-header') && !document.querySelector('.partner-header') && document.querySelector('main h1').textContent.length > 0", `Consumer screen ${url} retains its existing header and renders`) }
  assert.deepEqual(errors, [], 'No browser runtime exceptions')
  assert.ok(requests.every(url => !/^https?:/.test(url) || url.startsWith(base)), 'No external API or service requests')
  console.log(`COMPLETE ${passed} Partner browser checks passed. Artifacts: ${artifacts}`)
} finally {
  if (ws?.readyState === 1) { await cdp('Browser.close').catch(() => {}); ws.close() }
  chrome.kill()
}
