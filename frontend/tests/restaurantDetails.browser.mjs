import { spawn } from 'node:child_process'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const base = process.env.FORKOFF_TEST_URL ?? 'http://127.0.0.1:5175'
const profile = await mkdtemp(path.join(tmpdir(), 'forkoff-details-chrome-'))
const chrome = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9233', `--user-data-dir=${profile}`, 'about:blank',
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
  const target = path.join(tmpdir(), `forkoff-details-${name}.png`)
  await writeFile(target, Buffer.from(result.data, 'base64'))
  console.log(`SCREENSHOT ${target}`)
}

try {
  const targets = await poll(async () => (await fetch('http://127.0.0.1:9233/json/list')).json(), 'Chrome DevTools')
  ws = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
  ws.onmessage = event => {
    const m=JSON.parse(event.data)
    if(m.id){
      const p=pending.get(m.id)
      pending.delete(m.id)
      if(m.error) p.reject(new Error(JSON.stringify(m.error)))
      else p.resolve(m.result)
    }
    else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)
    else if(m.method==='Network.requestWillBeSent')requests.push({type:m.params.type,url:m.params.request.url})
  }
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable')

  await viewport(1440)
  await navigate('/lobbies/details-crew/restaurants/ramen', '.restaurant-details__visit')
  await check("document.querySelector('h1').textContent==='North Pier Ramen' && document.querySelector('.restaurant-details__meta').textContent.includes('Japanese · $$ · 4.8 · 1.4 miles away')", 'Direct navigation resolves shared restaurant identity and metadata')
  const expected = {'.restaurant-details__photo':[80,276,560,360],'.restaurant-details__visit':[680,276,680,360],'.restaurant-details__map':[80,676,880,210],'.restaurant-details__return':[1000,676,360,210]}
  for (const [selector, rect] of Object.entries(expected)) {
    const actual = await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()')
    assert.deepEqual(actual,rect,selector); pass('Exact Figma desktop geometry: '+selector)
  }
  await check("[...document.querySelectorAll('main img,.app-header__brand img')].every(i=>i.complete && i.naturalWidth>0 && !i.src.includes('figma.com')) && getComputedStyle(document.querySelector('.restaurant-details__photo')).objectFit==='cover'", 'All local original assets load with cover photo cropping')
  await check("(()=>{const r=document.querySelector('.restaurant-details__map-location img').getBoundingClientRect();const p=document.querySelector('.restaurant-details__map').getBoundingClientRect();return r.width===28 && r.height===28 && r.x-p.x===470 && r.y-p.y===86})()", 'Original map marker preserves native 28px size and design position')
  await check("document.querySelector('.restaurant-details__address').textContent==='42 State Street, Erie, PA 16501' && document.querySelector('.restaurant-details__daily-hours').textContent.includes('Sample daily hours') && document.querySelector('.restaurant-details__visit h2').textContent.includes('Sample information') && document.querySelector('.restaurant-details__map-label').textContent.includes('not a real location')", 'Address, hours, map and ratings visibly labeled as demonstration data')
  await screenshot('desktop')
  await click('.restaurant-details__about summary')
  await check("document.querySelector('.restaurant-details__about').open && document.querySelector('.restaurant-details__about').textContent.includes('Mocktails')", 'About disclosure reveals shared description and features')
  for (let i=0;i<4;i++) {
    await click('.restaurant-details__actions button:nth-child('+(i+1)+')')
    await check("document.querySelector('[role=status]').textContent.includes('not connected')", 'Restaurant action '+i+' explains unavailable service')
  }
  await evaluate("document.querySelector('.restaurant-details__actions button').focus()")
  await enter()
  await check("document.querySelector('[role=status]').textContent.includes('Menu not connected') && getComputedStyle(document.activeElement).outlineStyle==='solid'", 'Keyboard activates menu feedback with visible focus')
  await evaluate("document.querySelector('.restaurant-details__return a').focus()")
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8})
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  await check("document.activeElement.matches('.restaurant-details__return a') && getComputedStyle(document.activeElement).outlineColor==='rgb(255, 255, 255)'", 'Return link has high contrast focus on dark card')
  await click('.restaurant-details__return a')
  await check("location.pathname==='/lobbies/details-crew/voting' && document.querySelector('progress').value===0", 'Direct details link returns to correct lobby with fresh demo session')

  await click('.voting-choice--yes')
  await click('.voting-card__details')
  await check("location.pathname==='/lobbies/details-crew/restaurants/harbor' && document.querySelector('h1').textContent==='Harbor & Hearth' && document.querySelector('.restaurant-details__photo').src.includes('harbor-and-hearth') && document.querySelector('.restaurant-details__address').textContent.includes('unavailable')", 'Voting selects Harbor with its shared image and no borrowed address')
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'y',code:'KeyY'})
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'y',code:'KeyY'})
  await evaluate('history.back()'); await delay(120)
  await check("document.querySelector('progress').value===1 && document.querySelector('.voting-status').textContent.includes('YES recorded')", 'Browser Back preserves vote and progress')
  await evaluate('history.forward()'); await delay(120)
  await check("document.querySelector('h1').textContent==='Harbor & Hearth'", 'Browser Forward restores matching restaurant details')
  await click('.restaurant-details__return a')
  await check("document.querySelector('progress').value===1 && document.querySelector('#voting-restaurant-heading').textContent==='Harbor & Hearth'", 'Return to voting preserves current restaurant and progress')
  await evaluate("history.pushState({},'', '/lobbies/details-crew/restaurants/unknown');dispatchEvent(new PopStateEvent('popstate'))"); await delay(100)
  await check("document.querySelector('h1').textContent==='Restaurant not found'", 'Unknown ID during active voting is recoverable')
  await click('.route-placeholder a')
  await check("document.querySelector('progress').value===1 && document.querySelector('.voting-status').textContent.includes('YES recorded')", 'Unknown-ID recovery preserves existing vote and progress')
  await click('.voting-choice--no')
  await click('.voting-card__details')
  await check("document.querySelector('h1').textContent==='Copper Bowl Kitchen' && document.querySelector('.restaurant-details__photo').src.includes('copper-bowl-kitchen') && document.querySelector('.restaurant-details__weekly-hours').textContent.includes('unavailable')", 'Voting resolves third restaurant without inventing hours')
  await click('.restaurant-details__return a')
  await click('.voting-choice--veto')
  await check("[...document.querySelectorAll('.voting-complete dd')].map(n=>n.textContent).join(',')==='1,1,1'", 'Yes, No and Veto selections survive details round trips')
  await click('.voting-undo'); await click('.voting-choice--skip')
  await check("document.querySelector('.voting-complete p').textContent.includes('2 votes and 1 skipped')", 'Undo and Skip remain correct after round trips')
  await click('.voting-complete__actions .ui-button')
  await check("document.querySelector('progress').value===0", 'Restart remains correct after round trips')

  for (const [url,title] of [['/lobbies/details-crew/restaurants/unknown','Restaurant not found'],['/lobbies/details-crew/restaurants','Choose a restaurant'],['/lobbies/details-crew/restaurants/%3ArestaurantId','Restaurant not found'],['/lobbies/%3AlobbyId/restaurants/ramen','Lobby ID unavailable'],['/lobbies/%20/restaurants/ramen','Lobby ID unavailable']]) {
    await navigate(url)
    assert.equal(await evaluate("document.querySelector('h1').textContent"),title)
    pass('Graceful invalid or missing ID: '+url)
  }
  const special = 'crew & dinner/🍜'
  await navigate('/lobbies/'+encodeURIComponent(special)+'/voting','.voting-card')
  await click('.voting-choice--yes'); await click('.voting-card__details')
  await check('document.querySelector(".restaurant-details__demo-note span").textContent==='+JSON.stringify(special), 'Details retains full encoded lobby identity')
  await click('.restaurant-details__return a')
  await check('decodeURIComponent(location.pathname.slice(9,-7))==='+JSON.stringify(special)+' && document.querySelector("progress").value===1', 'Return link preserves encoded lobby identity and its session')
  await navigate('/lobbies/layout/restaurants/ramen','.restaurant-details__visit')
  for (const width of [320,375,600,768,900,1024,1200,1440,1920]) {
    await viewport(width,width<769?844:1024)
    await check("document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('.restaurant-details__photo,.restaurant-details__visit,.restaurant-details__map,.restaurant-details__return,.restaurant-details__actions button')].every(n=>{const r=n.getBoundingClientRect();return r.x>=0 && r.right<=innerWidth+1})", 'No overflow or clipped details at '+width+'px')
    await check("[...document.querySelectorAll('.restaurant-details__actions button,.restaurant-details__return a')].every(n=>{const r=n.getBoundingClientRect();return r.width>=44 && r.height>=44})", 'Accessible details targets at '+width+'px')
    if ([375,768,1440].includes(width)) await screenshot(String(width))
  }
  await viewport(375,844)
  await click('.restaurant-details__return a')
  await click('.voting-choice--yes'); await click('.voting-card__details'); await click('.restaurant-details__return a')
  await check("document.querySelector('progress').value===1", 'Mobile Voting and Details round trip preserves choice')
  assert.deepEqual(errors,[],'Browser runtime exceptions')
  pass('No browser runtime exceptions')
  assert.ok(requests.every(r=>!['Fetch','XHR'].includes(r.type)||!/lobbies|restaurants|voting|api\//.test(new URL(r.url).pathname)))
  pass('No backend or external service requests')
  console.log('COMPLETE '+passed.length+' Restaurant Details browser checks passed')
} finally {
  if(ws?.readyState===1){await cdp('Browser.close').catch(()=>{});ws.close()}
  chrome.kill()
}
