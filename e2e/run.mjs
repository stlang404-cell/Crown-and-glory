/**
 * M1 final acceptance journey (research doc 16 + directive §18), driven through the real UI:
 *  launch → start a rated 6×6 match → play a complete legal game against the local engine →
 *  result → rating updated exactly once → game saved → postgame analysis → inspect moves and engine
 *  alternatives → rating-history entry → close the browser → reopen → everything recovered.
 *
 * The "human" side is a scripted robot that chooses moves with the Crown engine in Node (so the test
 * finishes); it clicks squares exactly like a player. Usage:
 *   npm run build && node scripts/serve.mjs --port 4173 &  node e2e/run.mjs http://127.0.0.1:4173/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { register } from 'tsx/esm/api';
register();
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { Position } = await import('../src/rules/position.ts');
const { moveToCcn } = await import('../src/rules/notation.ts');
const { Searcher } = await import('../src/engine/search.ts');

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const OUT = new URL('../docs/evidence/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/profile', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });
const log = [];
const step = (m) => { const line = `[${new Date().toISOString()}] ${m}`; log.push(line); console.log(line); };
const fail = (m) => { step('FAIL: ' + m); writeFileSync(OUT + 'e2e-log.txt', log.join('\n') + '\n'); process.exit(1); };

async function open(viewport = { width: 1366, height: 900 }) {
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', e => step('pageerror: ' + e));
  page.on('console', m => { if (m.type() === 'error') step('console.error: ' + m.text()); });
  await page.goto(url + '#/play');
  return { ctx, page };
}

// ---------- session 1: play ----------
let { ctx, page } = await open();
step('Launched Crown & Calculation');
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('button', { name: 'Rapid 5+3' }).click();
const rated = page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Rated', exact: true });
const expectRated = true;
if (await rated.isDisabled()) fail('Rated mode unavailable (calibration missing)');
await rated.click();
const lockedVisible = async () => (await page.locator('[data-testid="assist-locked"]').count()) > 0;
await page.getByRole('button', { name: 'White', exact: true }).click();
await page.screenshot({ path: OUT + '01-setup.png' });
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
step('Rated match started vs Mira Vell (L1), rapid 5+3, human = White');
if (!(await lockedVisible())) fail('Assistant not locked in a rated game');
if (await page.locator('[data-testid="assist-panel"]').count()) fail('Assistant panel present in a rated game');
step('Rated-game integrity: assistant locked, no assistance controls rendered');
const startRec = await page.evaluate(async () => { const g = (await window.__crown.db.unfinishedGames())[0]; return { rated: g.rated, pool: g.pool, mode: g.mode }; });
step('Game state at start: ' + JSON.stringify(startRec));
if (!startRec.rated || startRec.pool !== 'rapid') fail('Game did not start as an eligible rated rapid game');

const robot = new Searcher(18);
let plies = 0;
for (let guard = 0; guard < 400; guard++) {
  const turn = await page.getAttribute('[data-testid="match"]', 'data-turn');
  if (turn === 'over') break;
  if (turn !== 'human') { await page.waitForTimeout(150); continue; }
  const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
  const pos = Position.fromFen(fen);
  const r = robot.search(pos, { limits: { nodes: 20000 } });
  const mv = moveToCcn(r.bestMove);
  await page.click(`[data-square="${mv.slice(0, 2)}"]`);
  await page.click(`[data-square="${mv.slice(2, 4)}"]`);
  if (mv.length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[mv[4]] }).click();
  await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 30000 }).catch(() => {});
  plies += 2;
  if (plies === 20) await page.screenshot({ path: OUT + '02-midgame.png' });
}
await page.waitForSelector('.result-overlay', { timeout: 30000 }).catch(() => fail('No result overlay'));
const title = await page.textContent('.result-title');
const delta = await page.textContent('[data-testid="rating-delta"]').catch(() => null);
step(`Game over: ${title}; rating delta ${delta}`);
await page.screenshot({ path: OUT + '03-result.png' });

const dbState = await page.evaluate(async () => {
  const s = window.__crown;
  const games = await s.db.allGames();
  const events = await s.db.ratingEvents();
  return { games: games.map(g => ({ id: g.id, status: g.status, result: g.result, termination: g.termination, moves: g.moves.length, rated: g.rated })), events: events.map(e => ({ id: e.id, delta: e.delta, after: e.after.rating })) };
});
step('DB after game: ' + JSON.stringify(dbState));
if (dbState.games.length !== 1 || dbState.games[0].status !== 'finalized') fail('Game not finalized');
if (dbState.events.length !== 1) fail(`Expected exactly one rating event, found ${dbState.events.length}`);
const gameId = dbState.games[0].id;
// duplicate finalization attempts (retry) must not create another rating event
const dup = await page.evaluate(async (id) => {
  const s = window.__crown;
  const g = await s.db.getGame(id);
  const again = await s.finalize({ ...g, status: 'terminal' });
  const evs = await s.db.ratingEvents();
  return { again: again.event?.id ?? null, events: evs.length, rapidGames: (await s.db.ratingState('rapid')).games, blitz: await s.db.ratingState('blitz') };
}, gameId);
step('Duplicate finalization: ' + JSON.stringify({ events: dup.events, rapidGames: dup.rapidGames, blitzGames: dup.blitz.games, blitzRating: dup.blitz.rating }));
if (dup.events !== 1 || dup.rapidGames !== 1) fail('Duplicate finalization changed the rating ledger');
// v0.11: a fresh profile is a new career, so every pool starts at 0 (docs/CAREER_RATING.md)
if (dup.blitz.games !== 0 || dup.blitz.rating !== 0) fail('Blitz pool was affected by a rapid game');

await page.getByRole('button', { name: 'View analysis' }).click();
await page.waitForSelector('[data-testid="analysis-status"]');
await page.waitForFunction(() => document.querySelector('[data-testid="analysis-status"]')?.textContent === 'complete', null, { timeout: 300000 }).catch(() => fail('Analysis did not complete'));
step('Postgame analysis complete');
await page.click('[data-ply="5"]');
await page.waitForSelector('[data-testid="move-panel"]');
const grade = await page.textContent('[data-testid="move-grade"]');
const ind = await page.textContent('[data-testid="ply-indicator"]');
const cands = await page.locator('[data-testid="candidate"]').count();
step(`Ply 5 selected: ${ind}; grade "${grade}"; ${cands} engine candidates`);
if (!ind.includes('ply 5/')) fail('Ply selection mismatch');
if (cands < 1) fail('No engine alternatives shown');
await page.screenshot({ path: OUT + '04-analysis.png', fullPage: true });
await page.locator('[data-testid="candidate"]').first().click();
await page.waitForSelector('text=Return to main line');
await page.screenshot({ path: OUT + '05-variation.png' });
await page.getByRole('button', { name: 'Return to main line' }).click();
const acc = await page.textContent('[data-testid="accuracy"]');
step(`Variation explored and returned; accuracy shown: ${acc}`);

await page.getByRole('button', { name: 'Career' }).first().click();
await page.waitForSelector('[data-testid="rating-event"]');
const ratingShown = await page.textContent('[data-testid="current-rating"]');
step(`Career shows rating ${ratingShown} and ${await page.locator('[data-testid="rating-event"]').count()} rating event(s)`);
await page.screenshot({ path: OUT + '06-career.png' });
await ctx.close();
step('Browser closed');

// ---------- session 2: reopen ----------
({ ctx, page } = await open());
step('Reopened Crown & Calculation with the same profile');
await page.getByRole('button', { name: 'Games' }).first().click();
await page.waitForSelector('[data-testid="library-row"]');
const rows = await page.locator('[data-testid="library-row"]').count();
const rowText = await page.locator('[data-testid="library-row"]').first().innerText();
step(`Library after restart: ${rows} game(s): ${rowText.replace(/\s+/g, ' ')}`);
await page.screenshot({ path: OUT + '07-library-after-restart.png' });
await page.locator('[data-testid="library-row"]').first().click();
await page.waitForFunction(() => document.querySelector('[data-testid="analysis-status"]')?.textContent === 'complete', null, { timeout: 30000 }).catch(() => fail('Report not recovered after restart'));
await page.click('[data-ply="3"]');
const grade3 = await page.textContent('[data-testid="move-grade"]');
step(`Recovered report; ply 3 grade "${grade3}"`);
const after = await page.evaluate(async () => {
  const s = window.__crown;
  return { games: (await s.db.allGames()).length, events: (await s.db.ratingEvents()).length, reports: (await s.db.allReports()).length, rapid: (await s.db.ratingState('rapid')).rating };
});
step('DB after restart: ' + JSON.stringify(after));
if (after.games !== 1 || after.events !== 1 || after.reports < 1) fail('State not fully recovered');
if (Math.abs(after.rapid - dbState.events[0].after) > 1e-9) fail('Rating changed across restart');
await page.screenshot({ path: OUT + '08-analysis-after-restart.png' });

// assisted casual game stays unrated
await page.locator('nav.rail').getByRole('button', { name: 'Play', exact: true }).click();
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('button', { name: 'Blitz 3+2' }).click();
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Casual', exact: true }).click();
await page.getByRole('button', { name: 'White', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="assist-panel"]');
await page.getByRole('button', { name: 'Hint' }).click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Threat check' }).click();
await page.screenshot({ path: OUT + '12-assisted-casual.png' });
await page.getByRole('button', { name: 'Resign' }).click();
await page.getByRole('button', { name: 'Yes, resign' }).click();
await page.waitForSelector('.result-overlay');
const assisted = await page.evaluate(async () => {
  const s = window.__crown;
  const gs = (await s.db.allGames()).filter(g => g.timeControl.id === 'blitz');
  return { n: gs.length, rated: gs[0]?.rated, assistance: gs[0]?.assistance.length, events: (await s.db.ratingEvents()).length, blitz: (await s.db.ratingState('blitz')).games };
});
step('Assisted casual blitz game: ' + JSON.stringify(assisted));
if (assisted.rated !== false || assisted.assistance < 2 || assisted.events !== 1 || assisted.blitz !== 0) fail('Assisted game affected ratings');

// mobile layout checks
await ctx.close();
({ ctx, page } = await open({ width: 390, height: 844 }));
await page.goto(url + '#/analysis/' + encodeURIComponent(gameId) + '/4');
await page.waitForSelector('[data-testid="move-panel"]');
await page.screenshot({ path: OUT + '09-mobile-analysis.png' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
step(`Mobile 390px analysis: horizontal overflow = ${overflow}`);
if (overflow) fail('Horizontal scrolling at phone width');
await page.goto(url + '#/library');
await page.waitForSelector('[data-testid="library-row"]');
await page.screenshot({ path: OUT + '10-mobile-library.png' });
await ctx.close();
step('PASS: rated-game acceptance journey completed (Gate G)');
writeFileSync(OUT + 'e2e-log.txt', log.join('\n') + '\n');
