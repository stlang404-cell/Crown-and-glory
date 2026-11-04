/**
 * Navigation audit (v0.8): clicks every main navigation entry like a player — desktop rail and phone tab bar —
 * on a fresh career and on a populated one (a finished, analysed game and a founded federation), and fails on any
 * page error, error-boundary screen, empty main area or horizontal overflow. Screenshots each destination.
 *   node scripts/serve.mjs --dir dist --port 4397 &  node e2e/nav-audit.mjs http://127.0.0.1:4397/ [outdir]
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4397/';
const OUT = (process.argv[3] ?? new URL('./artifacts/nav-audit/', import.meta.url).pathname).replace(/\/?$/, '/');
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const NAV = ['Play', 'Federation', 'Exchange', 'Finance', 'Games', 'Analysis', 'Academy', 'Career', 'Rivals', 'Hall of Fame', 'Lab', 'Settings'];
const TABS = ['Play', 'Federation', 'Exchange', 'Finance', 'Career', 'Settings'];

async function audit(page, label, entries, navSel, errors) {
  const bad = [];
  for (const name of entries) {
    const before = errors.length;
    await page.locator(navSel).getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({
      text: (document.querySelector('main')?.innerText ?? '').trim().length,
      boundary: !!document.querySelector('[data-testid="screen-error"]'),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      h1: document.querySelector('main h1')?.textContent ?? '',
    }));
    const ok = r.text > 40 && !r.boundary && errors.length === before && r.overflow <= 0;
    if (!ok) bad.push(`${name} (text ${r.text}, boundary ${r.boundary}, errors ${errors.slice(before).join(' | ').slice(0, 200)}, overflow ${r.overflow})`);
    step(`  ${label} · ${name}: ${ok ? 'ok' : 'BROKEN'} — h1 "${r.h1}", ${r.text} chars`);
    await page.screenshot({ path: `${OUT}${label}-${name.replace(/\W+/g, '-').toLowerCase()}.png` });
  }
  return bad;
}

const ctx = await chromium.launchPersistentContext(OUT + 'profile', { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => { errors.push(String(e).slice(0, 300)); step('pageerror: ' + String(e).slice(0, 300)); });
page.on('console', m => { if (m.type() === 'error') { errors.push(m.text().slice(0, 300)); step('console.error: ' + m.text().slice(0, 300)); } });
await page.goto(url);
await page.waitForFunction(() => window.__crown);

const fresh = await audit(page, 'fresh', NAV, 'nav.rail', errors);
check(1, fresh.length === 0, `Fresh career: every navigation entry opens a working screen${fresh.length ? ': ' + fresh.join('; ') : ''}`);

// populate: one finished game (analysed) + founded federation
await page.locator('nav.rail').getByRole('button', { name: 'Play', exact: true }).click();
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('button', { name: 'Rated', exact: true }).click().catch(() => {});
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
for (let i = 0; i < 4; i++) {
  await page.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')), null, { timeout: 30000 });
  if (await page.getAttribute('[data-testid="match"]', 'data-turn') === 'over') break;
  const sqs = await page.$$eval('[data-testid="match"] [data-square]', els => els.map(e => e.getAttribute('data-square')));
  for (const s of sqs) {
    await page.click(`[data-square="${s}"]`);
    const hs = await page.$$eval('[data-square]', els => els.filter(e => e.querySelector('.dot, .ring')).map(e => e.getAttribute('data-square')));
    if (hs.length) { await page.click(`[data-square="${hs[0]}"]`); break; }
  }
  await page.waitForTimeout(300);
}
if (await page.getAttribute('[data-testid="match"]', 'data-turn') !== 'over') { await page.getByRole('button', { name: /Resign/ }).first().click(); await page.getByRole('button', { name: 'Yes, Resign' }).click(); }
await page.waitForSelector('.result-overlay', { timeout: 20000 });
await page.waitForFunction(async () => (await window.__crown.db.allReports()).some(r => r.status === 'complete'), null, { timeout: 300000 }).catch(() => step('analysis did not complete in time'));
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
await page.evaluate(async () => { const f = window.__crown.fed; for (const x of f.playerFixtures()) await f.forfeit(x.id); await f.advanceRound(); });
await page.locator('[data-testid="ceremony-continue"]').click({ timeout: 2000 }).catch(() => {});

const pop = await audit(page, 'populated', NAV, 'nav.rail', errors);
check(2, pop.length === 0, `Populated career: every navigation entry opens a working screen${pop.length ? ': ' + pop.join('; ') : ''}`);
await page.reload(); await page.waitForTimeout(1500);
const rel = await page.evaluate(() => ({ text: (document.querySelector('main')?.innerText ?? '').trim().length, boundary: !!document.querySelector('[data-testid="screen-error"]') }));
check(3, rel.text > 40 && !rel.boundary, `Reloading on the last screen keeps it working (${rel.text} chars)`);
await ctx.close();

const ctx2 = await chromium.launchPersistentContext(OUT + 'profile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page2 = ctx2.pages()[0] ?? await ctx2.newPage();
const errors2 = [];
page2.on('pageerror', e => { errors2.push(String(e).slice(0, 300)); step('pageerror (phone): ' + String(e).slice(0, 300)); });
await page2.goto(url); await page2.waitForFunction(() => window.__crown);
const phone = await audit(page2, 'phone', TABS, 'nav.tabbar', errors2);
check(4, phone.length === 0, `Phone tab bar: every tab opens a working screen without overflow${phone.length ? ': ' + phone.join('; ') : ''}`);
await ctx2.close();
check(5, errors.length + errors2.length === 0, `No page or console errors (${errors.length + errors2.length})`);
writeFileSync(OUT + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
