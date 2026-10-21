import { spawn } from 'node:child_process'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const base = process.env.FORKOFF_TEST_URL ?? 'http://127.0.0.1:5175'
const profile = await mkdtemp(path.join(tmpdir(), 'forkoff-results-chrome-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9237', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let ws
let sequence = 0
const pending = new Map()
const errors = []
const requests = []
const passed = []
const pass = name => { passed.push(name); console.log(`PASS ${name}`) }
async function poll(fn, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const value = await fn(); if (value) return value } catch {}
    await delay(100)
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
async function check(expression, label) { assert.ok(await evaluate(expression), label); pass(label) }
async function navigate(url, selector = 'main h1') {
  await cdp('Page.navigate', { url: `${base}${url}` })
  await poll(() => evaluate(`document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(selector)})`), url)
  await evaluate('document.fonts.ready.then(() => true)')
  await delay(150)
}
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(80) }
async function enter(shift = false) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', modifiers: shift ? 8 : 0, windowsVirtualKeyCode: 13, text: '\r' })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', modifiers: shift ? 8 : 0, windowsVirtualKeyCode: 13 })
  await delay(60)
}
async function viewport(width, height = 1024) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 769 })
  await delay(100)
}
async function screenshot(name) {
  const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const target = path.join(tmpdir(), `forkoff-results-${name}.png`)
  await writeFile(target, Buffer.from(result.data, 'base64'))
  console.log(`SCREENSHOT ${target}`)
}

async function route(url) {
  await evaluate(`history.pushState({}, '', ${JSON.stringify(url)}); dispatchEvent(new PopStateEvent('popstate'))`)
  await delay(100)
}
async function vote(decisions) {
  for (const decision of decisions) await click('.voting-choice--' + decision)
}

try {
  const targets = await poll(async () => (await fetch('http://127.0.0.1:9237/json/list')).json(), 'Chrome DevTools')
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  ws.onmessage = event => {
    const m = JSON.parse(event.data)
    if (m.id) {
      const p = pending.get(m.id); pending.delete(m.id)
      if (m.error) p.reject(new Error(JSON.stringify(m.error)))
      else p.resolve(m.result)
    } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails)
    else if (m.method === 'Network.requestWillBeSent') requests.push({ type: m.params.type, url: m.params.request.url })
  }
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable')
  await viewport(1440)
  await navigate('/lobbies/results-crew/results')
  await check("document.querySelector('h1').textContent === 'Your voting results' && document.querySelector('.results-resume').textContent.includes('Start voting') && document.querySelectorAll('.results-list li').length === 3 && document.querySelectorAll('.results-row__choose').length === 0", 'Direct Results access shows empty local session and exactly three sample restaurants')
  await click('.results-resume')
  await vote(['yes'])
  await route('/lobbies/results-crew/results')
  await check("document.querySelector('.results-summary').textContent.includes('1 of 3 processed') && document.querySelectorAll('.results-row__choose').length === 1 && document.querySelectorAll('.results-row__decision--pending').length === 2 && !location.search", 'Incomplete results preserve votes and never choose automatically')
  await click('.results-resume')
  await vote(['no', 'veto'])
  await check("document.querySelector('.voting-results-link').getAttribute('href') === '/lobbies/results-crew/results'", 'Voting completion exposes Results link with dynamic lobby ID')
  await click('.voting-results-link')
  await check("[...document.querySelectorAll('.results-counts dd')].map(n=>n.textContent).join(',') === '1,1,1,0' && document.querySelectorAll('.results-row__choose').length === 1 && document.querySelector('.results-row__decision--veto').textContent.includes('Veto')", 'Yes, No and Veto remain distinct and only Yes can be chosen')
  await click('.results-row__choose')
  await check("location.search === '?selection=ramen' && document.querySelector('.results-choice__eyebrow').textContent === 'DEMO FINAL CHOICE' && document.querySelector('.results-choice__note').textContent.includes('not a real group match')", 'Explicit final selection is labeled a demo, never a group winner')
  const expected = { '.results-ranking':[80,270,760], '.results-choice':[900,270,460], '.results-choice__photo':[900,270,460] }
  for (const [selector, rect] of Object.entries(expected)) {
    assert.deepEqual(await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return [r.x,r.y,r.width]})()`), rect)
    pass('Figma desktop geometry: ' + selector)
  }
  await check("document.querySelector('.results-choice__photo').getBoundingClientRect().height === 220 && [...document.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0&&!i.src.includes('figma.com')) && getComputedStyle(document.querySelector('.results-choice__photo')).objectFit==='cover'", 'Every image loads locally with original Figma 460 by 220 photo crop')
  await screenshot('desktop')
  await click('.results-choice__details')
  await check("location.pathname === '/lobbies/results-crew/restaurants/ramen' && document.querySelector('.restaurant-details__return a').textContent === 'Return to results'", 'Results opens correct Restaurant Details with explicit return destination')
  await evaluate('history.back()'); await delay(100)
  await check("location.search==='?selection=ramen' && document.querySelectorAll('.results-row--selected').length===1", 'Browser Back restores Results and selected restaurant')
  await evaluate('history.forward()'); await delay(100)
  await check("document.querySelector('h1').textContent==='North Pier Ramen'", 'Browser Forward restores matching details')
  await click('.restaurant-details__return a')
  await check("location.search==='?selection=ramen' && [...document.querySelectorAll('.results-counts dd')].map(n=>n.textContent).join(',')==='1,1,1,0'", 'Details return preserves all choices and demo selection')
  await click('.results-row:nth-child(2) h3 a')
  await check("document.querySelector('h1').textContent==='Harbor & Hearth'", 'Ranked list resolves its own restaurant ID')
  await click('.restaurant-details__return a')
  await click('.results-choice__actions button')
  await check("document.querySelector('.results-status').textContent.includes('Directions are not connected')", 'Directions explains unavailable verified service')
  await evaluate("Object.defineProperty(navigator, 'share', {configurable:true,value:undefined}); Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async text=>{window.sharedDemoText=text}}})")
  await click('.results-choice__actions button:nth-child(2)')
  await check("window.sharedDemoText.includes('North Pier Ramen') && window.sharedDemoText.includes('not a group match') && !window.sharedDemoText.includes('results-crew') && document.querySelector('.results-status').textContent.includes('copied')", 'Share clipboard fallback labels demo and omits lobby ID and private votes')
  await evaluate("Object.defineProperty(navigator, 'share', {configurable:true,value:async data=>{window.sharedDemoText=data.text}})")
  await click('.results-choice__actions button:nth-child(2)')
  await check("document.querySelector('.results-status').textContent==='Demo selection shared.' && window.sharedDemoText.includes('not a group match')", 'Native sharing receives explicit demonstration text')
  await evaluate("Object.defineProperty(navigator, 'share', {configurable:true,value:async ()=>{throw new DOMException('Cancelled','AbortError')}})")
  await click('.results-choice__actions button:nth-child(2)')
  await check("document.querySelector('.results-status').textContent.includes('Sharing did not complete') && document.querySelector('#results-choice-heading').textContent==='North Pier Ramen'", 'Cancelled sharing preserves demo selection with accessible feedback')
  await evaluate("document.querySelector('.results-choice__actions button:nth-child(3)').focus()")
  await enter()
  await check("document.activeElement.id==='results-ranking-heading' && getComputedStyle(document.activeElement).outlineStyle==='solid'", 'Keyboard Full results action focuses ranking with visible outline')
  for (const width of [320,375,600,768,900,1024,1200,1440,1920]) {
    await viewport(width, width < 769 ? 844 : 1024)
    await check("document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('.results-row,.results-choice,.results-choice__actions button,.results-row__choose')].every(n=>{const r=n.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1})", 'Results stay readable without overflow at '+width+'px')
    await check("[...document.querySelectorAll('main button,main a')].every(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44})", 'Results targets are at least 44px at '+width+'px')
    if ([375,768].includes(width)) await screenshot(String(width))
  }
  await viewport(1440)
  await click('.results-lobby')
  await check("location.pathname==='/lobbies/results-crew'", 'Return to Lobby preserves lobby ID')
  await evaluate('history.back()'); await delay(100)
  await check("document.querySelector('.results-choice__eyebrow').textContent==='DEMO FINAL CHOICE'", 'Back from Lobby preserves results')
  await click('.results-restart')
  await check("location.pathname==='/lobbies/results-crew/voting'&&document.querySelector('progress').value===0", 'Restart Voting intentionally clears session and returns to voting')
  await evaluate('history.back()'); await delay(100)
  await check("document.querySelectorAll('.results-row__choose').length===0&&document.querySelector('.results-counts dd').textContent==='0'", 'Back after restart cannot resurrect old votes or stale selection')
  await click('.results-resume'); await vote(['skip','skip','skip']); await click('.voting-results-link')
  await check("document.querySelector('.results-choice__empty').textContent.includes('All restaurants were skipped') && [...document.querySelectorAll('.results-counts dd')].map(n=>n.textContent).join(',')==='0,0,0,3'", 'All-skipped session records no votes or eligible restaurant')
  await click('.results-restart'); await vote(['no','veto','no']); await click('.voting-results-link')
  await check("document.querySelector('#results-choice-heading').textContent==='No restaurants accepted'&&document.querySelectorAll('.results-row__choose').length===0", 'All-rejected session has no fabricated final choice')
  await click('.results-restart'); await vote(['yes','yes','skip']); await click('.voting-results-link')
  await check("[...document.querySelectorAll('.results-row--yes .results-row__rank')].every(n=>n.textContent==='1') && document.querySelectorAll('.results-row__choose').length===2", 'Multiple Yes choices share rank without invented preference')
  await click('.results-row:first-child .results-row__choose')
  await click('.results-row:nth-child(2) .results-row__choose')
  await check("document.querySelector('#results-choice-heading').textContent==='Harbor & Hearth'", 'Choosing another eligible restaurant updates final-choice panel')
  await evaluate('history.back()'); await delay(100)
  await check("document.querySelector('#results-choice-heading').textContent==='North Pier Ramen' && document.querySelector('.results-status').textContent.includes('North Pier Ramen selected')", 'Browser Back restores earlier explicit demo selection and its announcement')
  await evaluate('history.forward()'); await delay(100)
  await check("document.querySelector('#results-choice-heading').textContent==='Harbor & Hearth'", 'Browser Forward restores subsequent demo selection')
  await route('/lobbies/other-results-crew/results?selection=ramen')
  await check("document.querySelectorAll('.results-row__choose').length===0 && !document.querySelector('.results-choice__photo')", 'A different lobby has an independent empty session and rejects URL-injected selection')
  const special = 'crew & dinner/🍜'
  await navigate('/lobbies/'+encodeURIComponent(special)+'/voting', '.voting-card')
  await vote(['yes','skip','veto']); await click('.voting-results-link'); await click('.results-row__choose'); await click('.results-choice__details'); await click('.restaurant-details__return a')
  await check('document.querySelector(".results-footer span").textContent==='+JSON.stringify(special)+' && document.querySelectorAll(".results-row--selected").length===1', 'Encoded lobby ID, restaurant and selection survive Voting/Results/Details round trip')
  for (const width of [320,768,1920]) { await viewport(width); await click('.results-restart'); await route('/lobbies/'+encodeURIComponent(special)+'/results'); await check('document.documentElement.scrollWidth<=innerWidth', 'Empty Results responsive at '+width+'px') }
  await navigate('/lobbies/results-crew/results?selection=ramen')
  await check("document.querySelectorAll('.results-row__choose').length===0", 'Refresh/direct URL clears in-memory session and invalidates selection')
  await navigate('/lobbies/%3AlobbyId/results')
  await check("document.querySelector('h1').textContent==='Lobby ID unavailable'", 'Invalid lobby ID has recoverable Results fallback')
  assert.deepEqual(errors, [], 'Browser runtime exceptions'); pass('No browser runtime exceptions')
  assert.ok(requests.every(r=>!['Fetch','XHR'].includes(r.type)||!/lobbies|restaurants|voting|api\//.test(new URL(r.url).pathname))); pass('No backend requests')
  console.log('COMPLETE '+passed.length+' Results browser checks passed')
} finally {
  if (ws?.readyState===1) { await cdp('Browser.close').catch(()=>{}); ws.close() }
  chrome.kill()
}


