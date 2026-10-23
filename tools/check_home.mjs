// Browser checks for the home page.
// Run: BASE=http://127.0.0.1:8000 PLAYWRIGHT=... CHROME=... node tools/check_home.mjs [check ...]
//
// Add a check: write `async function name(browser)` that returns on pass and
// throws an Error with the reason on fail, then register it in CHECKS.
const { chromium } = await import(process.env.PLAYWRIGHT);
const BASE = process.env.BASE || 'http://127.0.0.1:8000';

// Opens a page, records pageerror events in page.errors, runs fn, always closes it.
async function withPage(browser, size, fn) {
  const page = await browser.newPage({ viewport: size });
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

const CHECKS = { storyRenders };

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
