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

// On a phone the art fills each chapter and the words sit over its top, so the glow runs up under them (no hard edge).
async function phoneLayout(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(500);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) throw new Error(`page is ${w}px wide at 390`);
    for (const id of IDS) {
      const r = await page.evaluate((i) => {
        const c = document.getElementById(i), sec = c.getBoundingClientRect(), cv = c.querySelector('canvas.art').getBoundingClientRect(), wd = c.querySelector('.words').getBoundingClientRect();
        return { top: cv.top - sec.top, h: cv.height, sh: sec.height, words: wd.top - sec.top };
      }, id);
      if (Math.abs(r.top) > 1 || Math.abs(r.h - r.sh) > 2) throw new Error(`${id}: the art doesn't fill the chapter (top ${r.top}, ${r.h} of ${r.sh}px)`);
      if (r.words > 1) throw new Error(`${id}: the words start ${r.words}px down`);
    }
  }, { hasTouch: true, isMobile: true });
}

// The finale: the line, both buttons, four steps, at a laptop and on a phone.
async function finale(browser) {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await withPage(browser, { width: w, height: h }, async (page) => {
      await page.goto(`${BASE}/`);
      const t = (await page.locator('#install h2').innerText()).trim();
      if (t !== 'Come and look.') throw new Error(`finale says "${t}"`);
      const steps = await page.locator('#install .finale-steps li').count();
      if (steps !== 4) throw new Error(`${steps} steps`);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w) throw new Error(`page is ${sw}px wide at ${w}`);
      if ((await page.locator('#install a.button').count()) !== 2) throw new Error('the finale lacks its two buttons');
    });
  }
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

// Every chapter draws in WebGL, and every one falls back to its still.
const ART = ['ask', 'researchers', 'workspace', 'capabilities'];
const frames = (page, id = 'researchers') => page.$eval(`#${id} canvas.art`, (c) => Number(c.dataset.frames || 0));
const toView = (page, id) => page.evaluate((i) => window.scrollTo(0, document.getElementById(i).offsetTop), id);
const { readFileSync } = await import('node:fs');
const ENTRIES = JSON.parse(readFileSync(new URL('../home/entries.json', import.meta.url), 'utf8'));
const names = (ids) => ids.map((i) => ENTRIES.entries[i].name);
const noErrors = (page) => { if (page.errors.length) throw new Error(`page errors: ${page.errors.join('; ')}`); };

async function homeCopy(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    const hs = await page.$$eval('section.chapter :is(h1, h2)', (els) => els.map((e) => e.textContent.trim()));
    const want = ['Parallel researchers for scientific data.', 'Run a whole lab in parallel.', "Every model's answer, on the same specimen.", 'The open-source models science runs on, one click away.'];
    if (hs.join('|') !== want.join('|')) throw new Error(`headings are [${hs.join(' | ')}]`);
    const eb = (await page.locator('#ask .eyebrow').innerText()).trim();
    if (eb.toLowerCase() !== 'hooke · open source') throw new Error(`eyebrow is "${eb}"`);
  });
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/`);
    if (!(await page.locator('header.top nav a[href="story.html"]').isVisible())) throw new Error('no visible Story link at 390px');
  });
}

async function animatesOnlyOnScreen(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    for (const id of ART) {
      await toView(page, id);
      await page.waitForTimeout(1200);
      const f1 = await frames(page, id);
      if (!(f1 > 0)) throw new Error(`${id}: no frames drawn on screen (${f1})`);
      await page.evaluate(() => window.scrollTo(0, document.getElementById('install').offsetTop));
      await page.waitForTimeout(300);
      const f2 = await frames(page, id);
      await page.waitForTimeout(1000);
      const f3 = await frames(page, id);
      if (f3 !== f2) throw new Error(`${id} kept drawing off screen: ${f2} -> ${f3}`);
    }
    noErrors(page);
  });
}

async function reducedMotion(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    for (const id of ART) {
      await toView(page, id);
      await page.waitForTimeout(1500);
      const f = await frames(page, id);
      if (f < 1 || f > 3) throw new Error(`${id}: reduced motion drew ${f} frames, expected 1 to 3`);
    }
    const words = await page.$eval('#capabilities .words h2', (e) => getComputedStyle(e).opacity);
    if (words !== '1') throw new Error(`with reduced motion the words are at opacity ${words}`);
    noErrors(page);
  }, { reducedMotion: 'reduce' });
}

async function tapPersists(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/`);
    await toView(page, 'researchers');
    await page.waitForTimeout(800);
    const b = await page.locator('#researchers canvas.art').boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(300);
    const p = await page.$eval('#researchers canvas.art', (c) => c.dataset.pointer);
    if (!p) throw new Error('the tapped point was cleared within 300 ms');
    await page.evaluate(() => window.scrollTo(0, document.getElementById('install').offsetTop));
    await page.waitForTimeout(600);
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
    if (r.length !== 4) throw new Error(`${r.length} canvases, expected 4`);
    for (const c of r) {
      if (c.ta !== 'pan-y') throw new Error(`${c.id}: touch-action is ${c.ta}`);
      if (c.tm || c.wh) throw new Error(`${c.id}: touchmove prevented=${c.tm}, wheel prevented=${c.wh}`);
    }
    noErrors(page);
  }, { hasTouch: true, isMobile: true });
}

async function stillsShow(page, which) {
  for (const id of which) {
    await toView(page, id);
    await page.waitForTimeout(600);
    const r = await page.evaluate((i) => {
      const c = document.getElementById(i), st = c.querySelector('.still');
      return { cls: c.classList.contains('no-art'), shown: getComputedStyle(st).display !== 'none' && st.getBoundingClientRect().height > 0 };
    }, id);
    if (!r.cls) throw new Error(`${id}: no no-art class`);
    if (!r.shown) throw new Error(`${id}: the still is not visible`);
  }
}
async function dataFailure(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.route('**/media/sky.json', (r) => r.abort());
    await page.goto(`${BASE}/`);
    await stillsShow(page, ART);
    noErrors(page);
  });
}
async function noWebGL(browser) {
  const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis', '--disable-gpu'] });
  try {
    await withPage(b, { width: 390, height: 844 }, async (page) => { await page.goto(`${BASE}/`); await page.waitForTimeout(800); await stillsShow(page, ART); noErrors(page); });
  } finally { await b.close(); }
}

async function firstCycles(browser) {
  const Qs = ENTRIES.first.questions;
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(3200);
    const read = () => page.evaluate(() => [document.querySelector('#ask-q .t').textContent.trim(), document.getElementById('ask').dataset.plan]);
    const [q0, p0] = await read();
    if (q0 !== Qs[0].q) throw new Error(`question is "${q0}", expected "${Qs[0].q}"`);
    if (p0 !== Object.keys(Qs[0].use).join(',')) throw new Error(`data-plan is "${p0}"`);
    const b = await page.locator('#ask-q').boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(2500);
    const [q1, p1] = await read();
    if (q1 !== Qs[1].q) throw new Error(`after tapping the question it is "${q1}", expected "${Qs[1].q}"`);
    if (p1 !== Object.keys(Qs[1].use).join(',')) throw new Error(`after tapping, data-plan is "${p1}"`);
    noErrors(page);
  });
}

const LABELS = { ask: '#ask .lbl', workspace: '#workspace .ws-lbl', capabilities: '#capabilities .cap-lbl' };
const labelBoxes = (page, id) => page.evaluate(([sel, i]) => {
  const bx = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  return { labels: [...document.querySelectorAll(sel)].filter((e) => getComputedStyle(e).opacity !== '0' && e.offsetWidth).map((e) => ({ id: e.dataset.id || e.textContent.trim().slice(0, 20), ...bx(e) })),
    words: bx(document.querySelector(`#${i} .words`)), bar: bx(document.querySelector('header.top')), w: innerWidth };
}, [LABELS[id], id]);
function checkApart({ labels, words, bar, w }, where) {
  const hit = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
  for (let i = 0; i < labels.length; i++) {
    const a = labels[i];
    if (a.l < 0 || a.r > w) throw new Error(`${where}: ${a.id} runs off the screen (${Math.round(a.l)}..${Math.round(a.r)})`);
    if (hit(a, words)) throw new Error(`${where}: ${a.id} touches the words`);
    if (hit(a, bar)) throw new Error(`${where}: ${a.id} touches the top bar`);
    for (let j = i + 1; j < labels.length; j++) if (hit(a, labels[j])) throw new Error(`${where}: ${a.id} touches ${labels[j].id}`);
  }
}
const SIZES = [[1440, 900], [1280, 720], [1024, 700], [844, 390], [740, 360], [390, 844], [360, 740]];
async function labelsApart(browser) {
  for (const [w, h] of SIZES) {
    await withPage(browser, { width: w, height: h }, async (page) => {
      await page.goto(`${BASE}/`);
      for (const id of Object.keys(LABELS)) {
        await toView(page, id);
        for (let k = 0; k < 3; k++) { await page.waitForTimeout(id === 'ask' && k === 0 ? 5500 : 1500); checkApart(await labelBoxes(page, id), `${id} at ${w}x${h}`); }
      }
    }, w < 900 ? { hasTouch: true, isMobile: true } : {});
  }
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`); await page.waitForTimeout(6000);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(2500);
    checkApart(await labelBoxes(page, 'ask'), 'ask 1440 then 390');
    await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(2500);
    checkApart(await labelBoxes(page, 'ask'), 'ask 390 then 1440');
  });
}
async function specimenSize(browser) {
  for (const [w, h, k] of [[1440, 900, 0.28], [390, 844, 0.55]]) {
    await withPage(browser, { width: w, height: h }, async (page) => {
      await page.goto(`${BASE}/`);
      await page.waitForTimeout(2000);
      const d = Number(await page.$eval('#ask', (e) => e.dataset.disc || 0));
      if (d < k * w) throw new Error(`${w}x${h}: the specimen is ${d}px wide, under ${Math.round(k * w)}px`);
    });
  }
}

// Chapter 3: pointing at a cell lights it through every layer and names each layer's model, nothing more.
async function workspaceThreadCheck(page) {
  await toView(page, 'workspace');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.hookeHome && window.hookeHome.workspace);
  for (let k = 0; k < 20; k++) {
    const [x, y] = await page.evaluate(() => window.hookeHome.workspace.cellAt(700));
    await page.mouse.move(x, y, { steps: 4 });
    await page.waitForTimeout(250);
    const [x2, y2] = await page.evaluate(() => window.hookeHome.workspace.cellAt(700));
    if (Math.hypot(x2 - x, y2 - y) < 0.5) break;
  }
  const pick = page.locator('#ws-pick');
  if (!(await pick.isVisible())) throw new Error('#ws-pick is not visible after pointing at a cell');
  const t = (await pick.innerText()).replace(/\s+/g, ' ').trim();
  const want = `One cell, through every lens ${ENTRIES.lenses.map((l) => (l.id ? ENTRIES.entries[l.id].name : l.name)).join(' · ')}`;
  if (t !== want) throw new Error(`readout is "${t}", expected "${want}"`);
  noErrors(page);
}
async function workspaceThread(browser) { await withPage(browser, { width: 1440, height: 900 }, async (page) => { await page.goto(`${BASE}/`); await workspaceThreadCheck(page); }); }
async function workspaceThreadStill(browser) { await withPage(browser, { width: 1440, height: 900 }, async (page) => { await page.goto(`${BASE}/`); await workspaceThreadCheck(page); }, { reducedMotion: 'reduce' }); }

// Chapter 4: switches, asking about a spot, the lens, and state that survives a resize.
const capStatus = (page) => page.$eval('#cap-status', (e) => e.textContent.trim());
async function capModel(page, id) { return page.evaluate((i) => window.hookeHome.capabilities.models().find((m) => m.id === i), id); }
async function capReady(page) { await toView(page, 'capabilities'); await page.waitForTimeout(1500); await page.waitForFunction(() => window.hookeHome && window.hookeHome.capabilities); }
async function capToggle(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`); await capReady(page);
    const s0 = await capStatus(page);
    if (s0 !== '16 of 16 models on · 12 on your Mac, 4 in the cloud') throw new Error(`status is "${s0}"`);
    let m = await capModel(page, 'gemini-3.8-flash'); await page.mouse.click(m.x, m.y); await page.waitForTimeout(400);
    const s1 = await capStatus(page);
    if (s1 !== '15 of 16 models on · 12 on your Mac, 3 in the cloud') throw new Error(`after one click status is "${s1}"`);
    m = await capModel(page, 'gemini-3.8-flash'); await page.mouse.click(m.x, m.y); await page.waitForTimeout(400);
    const s2 = await capStatus(page);
    if (s2 !== s0) throw new Error(`after two clicks status is "${s2}"`);
    noErrors(page);
  });
}
async function capAsk(browser) {
  const known = new Set(Object.values(ENTRIES.entries).map((e) => e.name));
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`); await capReady(page);
    const sp = await page.evaluate(() => window.hookeHome.capabilities.specimen());
    await page.mouse.click(sp.x, sp.y); await page.waitForTimeout(2200);
    await page.mouse.move(sp.x + 3, sp.y + 3, { steps: 3 }); await page.waitForTimeout(400);
    const lines = (await page.locator('#cap-lens').innerText()).split('\n').map((x) => x.trim()).filter(Boolean);
    if (lines.length < 3) throw new Error(`the lens names ${lines.length} models: ${lines.join(', ')}`);
    for (const l of lines) if (!known.has(l)) throw new Error(`the lens says "${l}", not a model name`);
    noErrors(page);
  });
}
async function resizeKeepsState(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`); await capReady(page);
    const m = await capModel(page, 'gemini-3.8-flash'); await page.mouse.click(m.x, m.y); await page.waitForTimeout(400);
    for (const [w, h] of [[1100, 800], [390, 844], [1440, 900]]) { await page.setViewportSize({ width: w, height: h }); await capReady(page); }
    const s = await capStatus(page);
    if (s !== '15 of 16 models on · 12 on your Mac, 3 in the cloud') throw new Error(`after resizing status is "${s}"`);
    const box = await page.locator('#capabilities canvas.art').boundingBox();
    const ms = await page.evaluate(() => window.hookeHome.capabilities.models());
    for (const q of ms) if (q.x < box.x || q.x > box.x + box.width || q.y < box.y || q.y > box.y + box.height) throw new Error(`${q.id} is outside the canvas after resizing`);
    noErrors(page);
  });
}

// The first screen's words show without any script help, on a phone and wide, and even with no IntersectionObserver.
async function wordsVisible(browser) {
  for (const [w, h, noIO] of [[390, 844, false], [1440, 900, false], [390, 844, true]]) {
    await withPage(browser, { width: w, height: h }, async (page) => {
      if (noIO) await page.addInitScript(() => { delete window.IntersectionObserver; });
      await page.goto(`${BASE}/`);
      await page.waitForTimeout(1800);
      const o = await page.$$eval('#ask .words > *', (els) => els.filter((e) => e.offsetParent).map((e) => getComputedStyle(e).opacity));
      if (!o.length || o.some((x) => x !== '1')) throw new Error(`${w}x${h}${noIO ? ' (no IntersectionObserver)' : ''}: first-screen words at opacity [${o}]`);
      const short = await page.$eval('#ask .words p .short', (e) => getComputedStyle(e).display);
      if ((w < 761) !== (short !== 'none')) throw new Error(`${w}px: the short line is ${short}`);
    });
  }
}

// On a phone, Download becomes "Send to my Mac" and shares the download page's link.
async function sendToMac(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.addInitScript(() => { navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(800);
    const btn = page.locator('#ask a.button.primary');
    const label = (await btn.innerText()).trim();
    if (label !== 'Send to my Mac') throw new Error(`the phone's button says "${label}"`);
    await btn.click();
    await page.waitForTimeout(300);
    const shared = await page.evaluate(() => window.__shared);
    if (!shared || !/download\.html$/.test(shared.url)) throw new Error(`shared ${JSON.stringify(shared)}`);
    if (!page.url().replace(/#.*/, '').endsWith('/')) throw new Error(`the page navigated to ${page.url()}`);
  }, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true });
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`);
    const label = (await page.locator('#ask a.button.primary').innerText()).trim();
    if (label !== 'Download for Mac') throw new Error(`on a Mac the button says "${label}"`);
  });
}

// Chapter 4 carries "Meet your staff": pointing at a model shows who made it, from the catalog's credit.
async function capMakers(browser) {
  await withPage(browser, { width: 1440, height: 900 }, async (page) => {
    await page.goto(`${BASE}/`); await capReady(page);
    const eb = (await page.locator('#capabilities .eyebrow').innerText()).trim();
    if (eb.toLowerCase() !== 'meet your staff') throw new Error(`chapter 4 eyebrow is "${eb}"`);
    if ((await page.locator('section.dusk').count()) !== 0) throw new Error('the old Meet your staff section is still on the page');
    const m = await capModel(page, 'cellpose-sam');
    await page.mouse.move(m.x, m.y, { steps: 3 }); await page.waitForTimeout(400);
    const t = (await page.locator('#capabilities .cap-lbl[data-id="cellpose-sam"] small').innerText()).trim();
    if (t !== ENTRIES.entries['cellpose-sam'].by) throw new Error(`pointing at Cellpose-SAM shows "${t}"`);
    noErrors(page);
  });
}

async function webgl1Only(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : g.call(this, t, ...a); }; });
    await page.goto(`${BASE}/`); await page.waitForTimeout(1000); await stillsShow(page, ART); noErrors(page);
  });
}
async function noRoundRect(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.addInitScript(() => { delete CanvasRenderingContext2D.prototype.roundRect; });
    await page.goto(`${BASE}/`); await page.waitForTimeout(2500);
    if (!(await frames(page, 'ask') > 0)) throw new Error('the first screen drew nothing without roundRect');
    noErrors(page);
  });
}
async function reducedMotionTaps(browser) {
  const Qs = ENTRIES.first.questions;
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/`); await page.waitForTimeout(1500);
    const b = await page.locator('#ask-q').boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(500);
    const q = await page.$eval('#ask-q .t', (e) => e.textContent.trim());
    if (q !== Qs[1].q) throw new Error(`with reduced motion, tapping the question left "${q}"`);
    const on = await page.$$eval('#ask .lbl.on', (els) => els.length);
    if (on < 3) throw new Error(`with reduced motion, only ${on} models stay lit after the tap`);
    await toView(page, 'capabilities'); await page.waitForTimeout(1200);
    const sp = await page.evaluate(() => window.hookeHome.capabilities.specimen());
    await page.touchscreen.tap(sp.x, sp.y); await page.waitForTimeout(600);
    const lens = (await page.locator('#cap-lens').innerText()).trim();
    if (!lens || /nothing here yet/.test(lens)) throw new Error(`with reduced motion, a tap on the specimen shows "${lens}"`);
    noErrors(page);
  }, { reducedMotion: 'reduce', hasTouch: true, isMobile: true });
}
async function scrollIsNotATap(browser) {
  await withPage(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto(`${BASE}/`);
    await toView(page, 'workspace'); await page.waitForTimeout(1200);
    const cdp = await page.context().newCDPSession(page);
    const t = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
    await t('touchStart', 640); for (let y = 620; y >= 380; y -= 20) await t('touchMove', y); await t('touchEnd');
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({ p: document.querySelector('#workspace canvas.art').dataset.pointer, pick: getComputedStyle(document.getElementById('ws-pick')).display }));
    if (r.p) throw new Error(`a scroll left a pointer at ${r.p}`);
    if (r.pick !== 'none') throw new Error('a scroll opened the workspace readout');
  }, { hasTouch: true, isMobile: true });
}

const CHECKS = { storyRenders, homeChapters, homeCopy, phoneLayout, oldAnchors, corkPlate, animatesOnlyOnScreen, reducedMotion, tapPersists, touchScroll, dataFailure, noWebGL, firstCycles, labelsApart, specimenSize, workspaceThread, workspaceThreadStill, capToggle, capAsk, resizeKeepsState, wordsVisible, sendToMac, capMakers, webgl1Only, noRoundRect, reducedMotionTaps, scrollIsNotATap, finale };

const picked = process.argv.slice(2);
const unknown = picked.filter((n) => !CHECKS[n]);
if (unknown.length) {
  console.error(`unknown check: ${unknown.join(', ')} (have: ${Object.keys(CHECKS).join(', ')})`);
  process.exit(2);
}
const browser = await chromium.launch({ executablePath: process.env.CHROME });
let failed = 0;
for (const name of picked.length ? picked : Object.keys(CHECKS)) {
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
