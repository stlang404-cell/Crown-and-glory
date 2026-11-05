/**
 * v0.9 Random Federation Quick Match, through the real UI: found the Federation → Play → Random Match (default
 * Anyone + Rated) → opponent card → Reroll and Cancel create nothing → Start Rated → resign → exactly one rating event
 * with the opponent's public rating → reload keeps exactly one → Casual quick match changes no rating → phone layout.
 *   node scripts/serve.mjs --dir dist --port 4402 &  node e2e/quick-match.mjs http://127.0.0.1:4402/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4402/';
const SHOTS = new URL('../docs/screenshots/v0.9.0/', import.meta.url).pathname;
const ART = new URL('./artifacts/quick-match/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
let ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
let page = ctx.pages()[0] ?? await ctx.newPage();
const errors = []; const watch = p => p.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); }); watch(page);
await page.goto(url); await page.waitForFunction(() => window.__crown);
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
await page.goto(url + '#/play');
await page.waitForSelector('[data-testid="quick-match"]');
const defaults = await page.evaluate(() => ({
  pool: [...document.querySelectorAll('[aria-label="Opponent pool"] button')].find(b => b.getAttribute('aria-pressed') === 'true')?.textContent,
  mode: document.querySelector('[data-testid="qm-mode"]')?.textContent,
  suggested: !!document.querySelector('[data-testid="qm-suggested"]'),
}));
// v0.11: a fresh profile is a new career at 0 · provisional, so the default pool is the beginner bands (0–799), labelled
check(1, defaults.pool === 'Beginner Bands' && defaults.suggested && defaults.mode === 'Rated', `Defaults: pool "${defaults.pool}" (suggested label ${defaults.suggested}), type "${defaults.mode}"`);
const beginnersOnly = await page.evaluate(() => [...window.__crown.fed.state.competitors.values()].filter(c => c.status === 'active' && c.rating < 800).length);
step(`Beginner-band pool: ${beginnersOnly} active competitors rated under 800`);
const games0 = await page.evaluate(async () => (await window.__crown.db.allGames()).length);
await page.locator('[data-testid="qm-draw"]').click();
await page.waitForSelector('[data-testid="qm-card"]');
const n1 = await page.locator('[data-testid="qm-name"]').textContent();
const r1 = await page.locator('[data-testid="qm-rating"]').textContent();
await page.screenshot({ path: SHOTS + 'quick-match-reveal.png' });
const truth = await page.evaluate(name => { const c = [...window.__crown.fed.state.competitors.values()].find(x => x.name === name); return c && { id: c.id, rating: Math.round(c.rating), rd: Math.round(c.rd), status: c.status }; }, n1);
check(2, !!truth && r1.startsWith(String(truth.rating)) && truth.status === 'active' && truth.rating < 800, `Card shows a real active beginner-band competitor: ${n1} ${r1} (roster: ${JSON.stringify(truth)})`);
const names = new Set([n1]);
for (let i = 0; i < 5; i++) { await page.locator('[data-testid="qm-reroll"]').click(); names.add(await page.locator('[data-testid="qm-name"]').textContent()); }
await page.locator('[data-testid="qm-cancel"]').click();
const games1 = await page.evaluate(async () => (await window.__crown.db.allGames()).length);
check(3, names.size >= 4 && games1 === games0, `5 rerolls gave ${names.size} different opponents; rerolls and Cancel created no game (${games0} → ${games1})`);
// rated quick match
await page.locator('[data-testid="qm-draw"]').click();
const oppName = await page.locator('[data-testid="qm-name"]').textContent();
const before = await page.evaluate(async () => { const p = await window.__crown.db.ratingState('rapid'); return { rating: p.rating, games: p.games }; });
await page.locator('[data-testid="qm-start"]').click();
await page.waitForSelector('[data-testid="match"]');
const rec = await page.evaluate(async () => { const g = (await window.__crown.db.unfinishedGames())[0]; return { mode: g.mode, ctx: g.context.kind, opp: g.humanColor === 'white' ? g.black : g.white }; });
check(4, rec.mode === 'rated' && rec.ctx === 'quick-match' && rec.opp.name === oppName && rec.opp.rating !== null && rec.opp.engine?.profile, `Rated game created vs ${rec.opp.name} (snapshot rating ${Math.round(rec.opp.rating)}, own calibrated profile ${rec.opp.engine?.profileId})`);
await page.getByRole('button', { name: /Resign/ }).first().click();
await page.getByRole('button', { name: 'Yes, Resign' }).click();
await page.waitForSelector('.result-overlay', { timeout: 20000 });
const ev = await page.evaluate(async () => { const evs = await window.__crown.db.ratingEvents('rapid'); const p = await window.__crown.db.ratingState('rapid'); return { n: evs.length, last: evs.at(-1) && { opp: evs.at(-1).opponent?.name ?? evs.at(-1).opponentName, delta: evs.at(-1).delta }, rating: p.rating, games: p.games }; });
await page.reload(); await page.waitForTimeout(2000);
const ev2 = await page.evaluate(async () => (await window.__crown.db.ratingEvents('rapid')).length);
check(5, ev.n === 1 && ev.games === before.games + 1 && ev.rating < before.rating && ev2 === 1, `One rating event (${before.rating.toFixed(0)} → ${ev.rating.toFixed(0)}, games ${before.games} → ${ev.games}); still ${ev2} after reload`);
// casual quick match
await page.goto(url + '#/play');
await page.getByRole('group', { name: 'Match type' }).getByRole('button', { name: 'Casual' }).click();
await page.locator('[data-testid="qm-draw"]').click();
await page.locator('[data-testid="qm-start"]').click();
await page.waitForSelector('[data-testid="match"]');
await page.getByRole('button', { name: /Resign/ }).first().click();
await page.getByRole('button', { name: 'Yes, Resign' }).click();
await page.waitForSelector('.result-overlay', { timeout: 20000 });
const ev3 = await page.evaluate(async () => { const p = await window.__crown.db.ratingState('rapid'); return { n: (await window.__crown.db.ratingEvents('rapid')).length, rating: p.rating }; });
check(6, ev3.n === 1 && Math.abs(ev3.rating - ev.rating) < 1e-9, `Casual quick match: rating unchanged (${ev3.rating.toFixed(1)}), still ${ev3.n} rating event`);
// filters
await page.goto(url + '#/play');
await page.getByRole('group', { name: 'Opponent pool' }).getByRole('button', { name: 'Elite and Sovereign' }).click();
await page.locator('[data-testid="qm-draw"]').click();
const elite = await page.locator('[data-testid="qm-rating"]').textContent().catch(() => '');
check(7, +elite.split(' ')[0].replace(/,/g, '') >= 2400, `Elite filter drew a ${elite} competitor`);
await ctx.close();
ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page = ctx.pages()[0] ?? await ctx.newPage(); watch(page);
await page.goto(url + '#/play'); await page.waitForSelector('[data-testid="quick-match"]');
await page.locator('[data-testid="qm-draw"]').click(); await page.waitForSelector('[data-testid="qm-card"]');
const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
await page.locator('[data-testid="quick-match"]').screenshot({ path: SHOTS + 'quick-match-phone.png' });
check(8, ov <= 0, `Phone: card shown, horizontal overflow ${ov}px`);
check(9, errors.length === 0, `No page errors (${errors.length})`);
await ctx.close();
writeFileSync(ART + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
