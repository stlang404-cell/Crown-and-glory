/**
 * v0.10 Grand federation journey (docs/FEDERATION_SCALE.md §0.5): founds a federation through the UI with the
 * default size (10,240 on this device), advances a round, then opens the Population analytics and Discover
 * Competitors screens on desktop and at 390 px: no overflow, no errors; times the search box and paging.
 *   node scripts/serve.mjs --dir dist --port 4398 & node e2e/population.mjs http://127.0.0.1:4398/
 */
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] ?? 'http://127.0.0.1:4398/';
let failed = 0;
const check = (id, ok, m) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const profile = mkdtempSync(join(tmpdir(), 'crown-pop-'));
const ctx = await chromium.launchPersistentContext(profile, { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(url + '#/world');
await page.waitForFunction(() => window.__crown);
const sizeLabel = await page.getByLabel('Federation Size').evaluate(s => s.options[s.selectedIndex].textContent);
check(1, /10,240 competitors, 80 regions/.test(sizeLabel ?? ''), `Founding screen offers the Grand size by default: "${sizeLabel}"`);
let t = Date.now();
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForFunction(() => window.__crown.fed.ready, null, { timeout: 120000 });
const foundMs = Date.now() - t;
const n = await page.evaluate(() => window.__crown.fed.state.competitors.size);
check(2, n >= 10240, `Founded through the UI in ${foundMs} ms: ${n.toLocaleString('en')} competitors on record`);
const adv = await page.evaluate(async () => {
  const f = window.__crown.fed;
  for (const x of f.playerFixtures()) await f.forfeit(x.id);
  const featured = f.featuredFixtures().filter(x => x.result === null).length, before = f.state.world.round;
  // the featured engine games (up to three, played in full by the engine before a round closes, as in v0.9) are
  // timed separately from the world simulation and commit
  const t0 = performance.now();
  for (const x of f.featuredFixtures().filter(y => y.result === null)) await f.playFeatured(x.id, 'background');
  const t1 = performance.now(); await f.advanceRound(); const t2 = performance.now();
  return { featured, featuredMs: Math.round(t1 - t0), worldMs: Math.round(t2 - t1), advanced: f.state.world.round === before + 1 };
});
check(3, adv.advanced, `Round advanced in the real app: ${adv.featured} featured engine game(s) ${adv.featuredMs} ms, then the world simulation and commit ${adv.worldMs} ms`);
const screenOk = async label => page.evaluate(lbl => ({ lbl, text: (document.querySelector('main')?.innerText ?? '').length, overflow: document.documentElement.scrollWidth - window.innerWidth, boundary: !!document.querySelector('[data-testid="screen-error"]') }), label);
for (const [w, h] of [[1366, 900], [390, 844]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url + '#/population'); await page.waitForSelector('[data-testid="rating-bands"]');
  const pop = await screenOk('population');
  const bands = await page.locator('[data-testid="rating-bands"] tbody tr').count();
  check(`4-${w}`, pop.overflow <= 0 && !pop.boundary && bands === 10, `Population analytics at ${w} px: ${bands} rating bands, overflow ${pop.overflow}`);
  await page.goto(url + '#/competitors'); await page.waitForSelector('[data-testid="competitor-row"]');
  const rows = await page.locator('[data-testid="competitor-row"]').count();
  const disc = await screenOk('competitors');
  check(`5-${w}`, rows === 100 && disc.overflow <= 0 && !disc.boundary, `Discover Competitors at ${w} px: ${rows} rows on a page, overflow ${disc.overflow}`);
}
await page.setViewportSize({ width: 1366, height: 900 });
// search: time from typing to the table showing only matching rows
const q = await page.evaluate(() => [...window.__crown.fed.state.competitors.values()].find(c => c.status === 'active').name.slice(0, 3));
t = Date.now();
await page.getByLabel('Search Competitors').fill(q);
await page.waitForFunction(s => [...document.querySelectorAll('[data-testid="competitor-row"]')].every(r => r.textContent.toLowerCase().includes(s.toLowerCase())), q);
const searchMs = Date.now() - t;
check(6, searchMs < 1000, `Name search "${q}" across ${n.toLocaleString('en')} competitors rendered in ${searchMs} ms (includes Playwright round trips)`);
await page.getByLabel('Search Competitors').fill('');
await page.getByRole('button', { name: 'Next →' }).click();
const first = await page.locator('[data-testid="competitor-row"] td').first().textContent();
check(7, first === '101', `Next page starts at rank ${first}`);
check(8, errors.length === 0, `No page or console errors (${errors.length})${errors.length ? ': ' + errors.join(' | ') : ''}`);
await ctx.close();
rmSync(profile, { recursive: true, force: true });
console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
