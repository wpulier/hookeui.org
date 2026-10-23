// Browser checks for the home page.
// Run: BASE=http://127.0.0.1:8000 PLAYWRIGHT=... CHROME=... node tools/check_home.mjs [check ...]
//
// Add a check: write `async function name(browser)` that returns on pass and
// throws an Error with the reason on fail, then register it in CHECKS.
const { chromium } = await import(process.env.PLAYWRIGHT);
const BASE = process.env.BASE || 'http://127.0.0.1:8000';

// Opens a page, records pageerror events in page.errors, runs fn, always closes it.
async function withPage(browser, size, fn, options = {}) {
  const page = await browser.newPage({ viewport: size, ...options });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

async function storyRenders(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/story.html`);
    await page.waitForTimeout(3000);
    if (page.errors.length) throw new Error(`page errors: ${page.errors.join('; ')}`);
    const h1 = (await page.locator('h1').first().innerText()).trim();
    if (h1 !== 'Hooke') throw new Error(`h1 is "${h1}", expected "Hooke"`);
    if ((await page.locator('.sky canvas').count()) === 0) throw new Error('no .sky canvas');
  });
}

const IDS = ['ask', 'researchers', 'workspace', 'capabilities'];

async function homeChapters(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(500);
    const ids = await page.$$eval('section.chapter', (els) => els.map((e) => e.id));
    if (ids.join() !== IDS.join()) throw new Error(`chapters are [${ids}], expected [${IDS}]`);
    const hs = await page.$$eval('section.chapter', (els) => els.map((e) => e.getBoundingClientRect().height));
    hs.forEach((h, i) => {
      if (Math.abs(h - 900) > 2) throw new Error(`${IDS[i]} is ${h}px tall, expected 900`);
    });
    const nav = await page.$$eval('header.top nav a', (as) => as.map((a) => `${a.textContent.trim()} → ${a.getAttribute('href')}`));
    const want = ['Story → story.html', 'Catalog → #models', 'Download → download.html'];
    if (nav.join('|') !== want.join('|')) throw new Error(`nav is [${nav.join('|')}]`);
    for (const id of ['models', 'install']) {
      if ((await page.locator(`#${id}`).count()) !== 1) throw new Error(`no #${id}`);
    }
    if (page.errors.length) throw new Error(`page errors: ${page.errors.join('; ')}`);
  });
}

async function phoneLayout(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(500);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) throw new Error(`page is ${w}px wide at 390`);
    for (const id of IDS) {
      const r = await page.evaluate((i) => {
        const c = document.getElementById(i);
        return [c.querySelector('.words').getBoundingClientRect().bottom, c.querySelector('canvas.art').getBoundingClientRect().top];
      }, id);
      if (r[0] > r[1] + 0.5) throw new Error(`${id}: words end at ${r[0]} but the canvas starts at ${r[1]}`);
    }
  });
}

async function oldAnchors(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/#see`);
    await page.waitForTimeout(800);
    if (!page.url().endsWith('story.html#see')) throw new Error(`#see went to ${page.url()}`);
  });
  for (const id of ['open', 'models']) {
    await withPage(browser, { width: 1440, height: 900 }, async (page) => {
      await page.goto(`${BASE}/#${id}`);
      await page.waitForTimeout(1200);
      const r = await page.evaluate((i) => { const b = document.getElementById(i).getBoundingClientRect(); return [b.top, b.bottom, innerHeight]; }, id);
      if (!(r[0] < r[2] && r[1] > 0)) throw new Error(`#${id} is not in view (top ${r[0]}, bottom ${r[1]})`);
    });
  }
}

async function corkPlate(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    await page.evaluate(() => document.getElementById('open').scrollIntoView());
    await page.waitForTimeout(3000);
    const h2 = (await page.locator('#open h2').innerText()).trim();
    if (!h2.startsWith('In 1665, Robert Hooke')) throw new Error(`h2 is "${h2}"`);
    // The plate draws only the cells inside its disc (site.js), so 941 of the 1,523, as on story.html.
    const n = await page.locator('#open .plate-ink path').count();
    if (n !== 941) throw new Error(`plate has ${n} paths, expected 941 (the cells inside the disc)`);
    const read = page.locator('#open .plate-read');
    const before = (await read.innerText()).trim();
    if (before !== '1,523 cells. Point at one.') throw new Error(`plate-read starts "${before}"`);
    const b = await page.locator('#open .plate-disc').boundingBox();
    await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2 - 20);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
    await page.waitForTimeout(500);
    const after = (await read.innerText()).trim();
    if (after === before) throw new Error('pointing at the plate did not change .plate-read');
    if (!(await page.locator('header.top').evaluate((e) => e.classList.contains('on-sky')))) throw new Error('header lost on-sky');
  });
}

// Chapters whose art code exists. A later task adds its chapter's id here.
const ART = ['ask', 'researchers'];
const frames = (page, id = 'researchers') => page.$eval(`#${id} canvas.art`, (c) => Number(c.dataset.frames || 0));
const toView = (page, id) => page.evaluate((i) => document.getElementById(i).scrollIntoView(), id);

async function animatesOnlyOnScreen(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    await toView(page, 'researchers');
    await page.waitForTimeout(1000);
    const f1 = await frames(page);
    if (!(f1 > 0)) throw new Error(`no frames drawn on screen (${f1})`);
    await toView(page, 'capabilities');
    await page.waitForTimeout(300);
    const f2 = await frames(page);
    await page.waitForTimeout(1000);
    const f3 = await frames(page);
    if (f3 !== f2) throw new Error(`kept drawing off screen: ${f2} -> ${f3}`);
    if (page.errors.length) throw new Error(`page errors: ${page.errors.join('; ')}`);
  });
}

async function reducedMotion(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    await toView(page, 'researchers');
    await page.waitForTimeout(2000);
    const f = await frames(page);
    if (f < 1 || f > 2) throw new Error(`reduced motion drew ${f} frames, expected 1 or 2`);
    // Moving the pointer across the far edge (outside the pull radius) redraws but must not move the swarm.
    const snap = () => page.$eval('#researchers canvas.art', (c) => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data));
    const b = await page.locator('#researchers canvas.art').boundingBox();
    const mv = (i) => page.mouse.move(b.x + b.width * 0.5 + (i % 2) * 40, b.y + b.height * 0.5);
    for (let i = 0; i < 20; i++) await mv(i); // let the fade settle first
    const a = await snap();
    for (let i = 0; i < 20; i++) await mv(i);
    const z = await snap();
    let max = 0;
    for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - z[i]));
    if (max > 8) throw new Error(`20 pointer moves changed the still by up to ${max}: the swarm moved`);
    if (page.errors.length) throw new Error(`page errors: ${page.errors.join('; ')}`);
  }, { reducedMotion: 'reduce' });
}

async function tapPersists(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/`);
    await toView(page, 'researchers');
    await page.waitForTimeout(500);
    const b = await page.locator('#researchers canvas.art').boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(300);
    const p = await page.$eval('#researchers canvas.art', (c) => c.dataset.pointer);
    if (!p) throw new Error('the tapped point was cleared within 300 ms');
    await toView(page, 'capabilities');
    await page.waitForTimeout(500);
    const q = await page.$eval('#researchers canvas.art', (c) => c.dataset.pointer);
    if (q) throw new Error(`the tapped point stayed (${q}) after the section left the screen`);
  }, { hasTouch: true, isMobile: true });
}

async function touchScroll(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(500);
    const r = await page.$$eval('canvas.art', (cs) => cs.map((c) => {
      const t = new Touch({ identifier: 1, target: c, clientX: 100, clientY: 400 });
      const tm = new TouchEvent('touchmove', { cancelable: true, bubbles: true, touches: [t], targetTouches: [t], changedTouches: [t] });
      const wh = new WheelEvent('wheel', { cancelable: true, bubbles: true, deltaY: 50 });
      c.dispatchEvent(tm); c.dispatchEvent(wh);
      return { id: c.parentElement.id, ta: getComputedStyle(c).touchAction, tm: tm.defaultPrevented, wh: wh.defaultPrevented };
    }));
    if (!r.length) throw new Error('no canvas.art');
    for (const c of r) {
      if (c.ta !== 'pan-y') throw new Error(`${c.id}: touch-action is ${c.ta}`);
      if (c.tm || c.wh) throw new Error(`${c.id}: touchmove prevented=${c.tm}, wheel prevented=${c.wh}`);
    }
    if (page.errors.length) throw new Error(`page errors: ${page.errors.join('; ')}`);
  }, { hasTouch: true, isMobile: true });
}

async function dataFailure(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.route('**/media/sky.json', (r) => r.abort());
    await page.goto(`${BASE}/`);
    for (const id of ART) {
      await toView(page, id);
      await page.waitForTimeout(800);
      const r = await page.evaluate((i) => {
        const c = document.getElementById(i), st = c.querySelector('.still');
        return { cls: c.classList.contains('no-art'), shown: getComputedStyle(st).display !== 'none' && st.getBoundingClientRect().height > 0 };
      }, id);
      if (!r.cls) throw new Error(`${id}: no no-art class after sky.json failed`);
      if (!r.shown) throw new Error(`${id}: the still is not visible`);
    }
    if (page.errors.length) throw new Error(`page errors: ${page.errors.join('; ')}`);
  });
}

async function askCycles(browser) {
  const { readFileSync } = await import('node:fs');
  const { ask } = JSON.parse(readFileSync(new URL('../home/entries.json', import.meta.url), 'utf8'));
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(2500);
    const read = () => page.evaluate(() => [document.getElementById('ask-q').textContent.trim(), document.getElementById('ask').dataset.plan]);
    const [q0, p0] = await read();
    if (q0 !== ask[0].q) throw new Error(`#ask-q is "${q0}", expected "${ask[0].q}"`);
    const want0 = ask[0].plan.map((x) => x[0]).join(',');
    if (p0 !== want0) throw new Error(`data-plan is "${p0}", expected "${want0}"`);
    const b = await page.locator('#ask canvas.art').boundingBox();
    await page.mouse.click(b.x + b.width * 0.7, b.y + b.height * 0.2);
    await page.waitForTimeout(2500);
    const [q1, p1] = await read();
    const want1 = ask[1].plan.map((x) => x[0]).join(',');
    if (q1 !== ask[1].q) throw new Error(`after a click #ask-q is "${q1}", expected "${ask[1].q}"`);
    if (p1 !== want1) throw new Error(`after a click data-plan is "${p1}", expected "${want1}"`);
    if (page.errors.length) throw new Error(`page errors: ${page.errors.join('; ')}`);
  });
}

const CHECKS = { storyRenders, homeChapters, phoneLayout, oldAnchors, corkPlate, animatesOnlyOnScreen, reducedMotion, tapPersists, touchScroll, dataFailure, askCycles };

const names = process.argv.slice(2);
const unknown = names.filter((n) => !CHECKS[n]);
if (unknown.length) {
  console.error(`unknown check: ${unknown.join(', ')} (have: ${Object.keys(CHECKS).join(', ')})`);
  process.exit(2);
}
const browser = await chromium.launch({ executablePath: process.env.CHROME });
let failed = 0;
for (const name of names.length ? names : Object.keys(CHECKS)) {
  try {
    await CHECKS[name](browser);
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
