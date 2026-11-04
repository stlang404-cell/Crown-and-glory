/**
 * v1.0 visual-identity screenshots and 390 px layout audit (package U).
 *   node scripts/serve.mjs --dir dist --port 4456 &  node e2e/visual-shots.mjs http://127.0.0.1:4456/ docs/screenshots/v1.0 after
 * Founds a federation on a fresh profile, plays one round (forfeits), opens a match, then captures every main screen at
 * 1366 px (desktop) and 390 px (phone, full page) and fails on horizontal overflow, an error boundary, or a page that
 * cannot be scrolled to its last element (the bottom of <main> must be reachable above the tab bar).
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4456/';
const OUT = (process.argv[3] ?? 'docs/screenshots/v1.0').replace(/\/?$/, '/');
const TAG = process.argv[4] ?? 'after';
const THEME = process.argv[5] ?? '';
mkdirSync(OUT, { recursive: true });
const PROFILE = `/tmp/visual-shots-profile-${TAG}`;
rmSync(PROFILE, { recursive: true, force: true });

const SCREENS = [
  ['dashboard', '#/dashboard'], ['play', '#/play'], ['federation', '#/world'], ['standings', '#/standings'], ['tournaments', '#/tournaments'],
  ['competitors', '#/competitors'], ['profile', '#/profile'], ['ranks', '#/ranks'], ['hall', '#/hall'], ['vault', '#/vault'], ['heraldry', '#/heraldry'],
  ['exchange', '#/exchange'], ['finance', '#/finance'], ['library', '#/library'], ['replays', '#/replays'], ['exhibition', '#/exhibition'],
  ['academy', '#/academy'], ['grimoire', '#/grimoire'], ['settings', '#/settings'],
].filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').includes(n));
let failed = 0;
const log = (m) => console.log(m);

const ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
await page.goto(url);
await page.waitForFunction(() => window.__crown);
if (THEME) await page.evaluate(t => { localStorage.setItem('crown.display.v1', JSON.stringify({ theme: t, board: 'theme', motion: 'reduce', pieceSpeed: 'off' })); }, THEME);
else await page.evaluate(() => { localStorage.setItem('crown.display.v1', JSON.stringify({ theme: 'obsidian', board: 'theme', motion: 'reduce', pieceSpeed: 'off' })); });
await page.goto(url + '#/world'); await page.reload();
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 90000 });
await page.evaluate(async () => { const f = window.__crown.fed; for (const x of f.playerFixtures()) await f.forfeit(x.id); await f.advanceRound(); });
for (let i = 0; i < 3; i++) await page.locator('[data-testid="ceremony-continue"]').click({ timeout: 1500 }).catch(() => {});

async function shoot(p, tag, full) {
  for (const [name, hash] of SCREENS) {
    await p.goto(url + hash);
    await p.waitForTimeout(1300);
    for (let i = 0; i < 2; i++) await p.locator('[data-testid="ceremony-continue"]').click({ timeout: 300 }).catch(() => {});
    const r = await p.evaluate(async () => {
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const boundary = !!document.querySelector('[data-testid="screen-error"]');
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 150));
      const main = document.querySelector('main');
      const tab = document.querySelector('nav.tabbar');
      const tabTop = tab && getComputedStyle(tab).display !== 'none' ? tab.getBoundingClientRect().top : window.innerHeight;
      const kids = main ? [...main.querySelectorAll(':scope > *')].filter(e => e.getBoundingClientRect().height > 0) : [];
      const last = kids.length ? Math.max(...kids.map(e => e.getBoundingClientRect().bottom)) : 0;
      // the end of the page content must sit above the tab bar once scrolled to the bottom
      const reach = main ? Math.ceil(last - tabTop) : 0;
      // clipped text: elements whose content is wider than their box with overflow hidden and no ellipsis
      const clipped = [...document.querySelectorAll('main *')].filter(e => {
        const s = getComputedStyle(e);
        return e.scrollWidth > e.clientWidth + 2 && s.overflowX === 'hidden' && s.textOverflow !== 'ellipsis' && e.clientWidth > 1 && e.children.length === 0;
      }).slice(0, 5).map(e => (e.className || e.tagName) + ':' + (e.textContent ?? '').slice(0, 30));
      window.scrollTo(0, 0);
      return { overflow, boundary, reach, clipped };
    });
    const ok = r.overflow <= 0 && !r.boundary && r.reach <= 1;
    if (!ok) failed++;
    log(`${ok ? 'ok  ' : 'FAIL'} ${tag} ${name}: overflow ${r.overflow}, bottom reach ${r.reach}${r.clipped.length ? ', clipped ' + r.clipped.join(' | ') : ''}`);
    // JPEG viewport captures keep the evidence light: the top of every screen, and on the phone also its scrolled end
    await p.screenshot({ path: `${OUT}${TAG}-${tag}-${name}.jpg`, type: 'jpeg', quality: 78 });
    if (full) {
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForTimeout(250);
      await p.screenshot({ path: `${OUT}${TAG}-${tag}-${name}-end.jpg`, type: 'jpeg', quality: 78 });
    }
  }
}
await shoot(page, 'desktop', false);
// a running match (Play → first opponent)
async function match(p, tag) {
  await p.goto(url + '#/play'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Mira Vell/ }).click().catch(() => {});
  await p.getByRole('button', { name: /Start match/i }).click().catch(() => {});
  await p.waitForSelector('[data-testid="match"]', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (o > 0) failed++;
  log(`${o > 0 ? 'FAIL' : 'ok  '} ${tag} match: overflow ${o}`);
  await p.screenshot({ path: `${OUT}${TAG}-${tag}-match.jpg`, type: 'jpeg', quality: 78 });
}
await match(page, 'desktop');
await ctx.close();

const ctx2 = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p2 = ctx2.pages()[0] ?? await ctx2.newPage();
p2.on('pageerror', e => errors.push(String(e).slice(0, 200)));
await p2.goto(url); await p2.waitForFunction(() => window.__crown);
await shoot(p2, 'phone', true);
await match(p2, 'phone');
await ctx2.close();
if (errors.length) { failed++; log('page errors: ' + errors.join(' | ')); }
log(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
