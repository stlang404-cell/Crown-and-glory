/**
 * v0.8 Analysis regression journey (the "clicking Analysis shows nothing" defect), driven like a player:
 *  fresh career → Analysis in the navigation → empty state → unknown game link → "Game not found";
 *  play and resign a game → View Analysis → board + engine analysis completes on screen → grades, eval graph,
 *  best-move candidates and a variation → replay autoplay → picker lists it as Analysed;
 *  second game with its analysis cancelled → picker offers "Analyse Game" → it runs and completes;
 *  reload → the report is still there. Fails on any page error or error-boundary screen.
 *   node scripts/serve.mjs --dir dist --port 4393 &  node e2e/analysis-journey.mjs http://127.0.0.1:4393/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4393/';
const SHOTS = new URL('../docs/screenshots/v0.8.0/', import.meta.url).pathname;
const ART = new URL('./artifacts/analysis-journey/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); mkdirSync(ART, { recursive: true });
const PROFILE = ART + 'profile'; rmSync(PROFILE, { recursive: true, force: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const finish = async ctx => { await ctx?.close().catch(() => {}); writeFileSync(ART + 'log.txt', log.join('\n') + '\n'); step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED'); process.exit(failed ? 1 : 0); };

let ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
let page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
const watch = p => { p.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + String(e).slice(0, 300)); }); };
watch(page);
await page.goto(url);
const boundary = async () => page.locator('[data-testid="screen-error"]').count();
const navAnalysis = () => page.locator('nav.rail').getByRole('button', { name: 'Analysis', exact: true }).click();

// 1. fresh career: Analysis opens a useful empty state
await navAnalysis();
await page.waitForSelector('[data-testid="analysis-picker"]', { timeout: 10000 }).catch(() => {});
check(1, (await page.locator('[data-testid="analysis-empty"]').count()) === 1 && await page.evaluate(() => location.hash) === '#/analysis',
  'Analysis in the navigation opens the game picker with a "No finished games yet" state on a fresh career');
await page.screenshot({ path: SHOTS + 'analysis-01-empty.png' });

// 2. unknown game id
await page.goto(url + '#/analysis/no-such-game');
await page.waitForSelector('[data-testid="analysis-missing"]', { timeout: 10000 }).catch(() => {});
check(2, (await page.locator('[data-testid="analysis-missing"]').count()) === 1, 'An unknown game link shows "Game not found" instead of loading forever');

async function playAndResign(myMoves) {
  await page.goto(url + '#/play');
  await page.getByRole('button', { name: /Mira Vell/ }).click();
  await page.getByRole('button', { name: 'Casual', exact: true }).click();
  await page.getByRole('button', { name: /Start match/i }).click();
  await page.waitForSelector('[data-testid="match"]');
  for (let i = 0; i < myMoves; i++) {
    await page.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')), null, { timeout: 30000 });
    if (await page.getAttribute('[data-testid="match"]', 'data-turn') === 'over') break;
    const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
    const sqs = await page.$$eval('[data-testid="match"] [data-square]', els => els.map(e => e.getAttribute('data-square')));
    let moved = false;
    for (const s of [...sqs.slice((i * 5) % sqs.length), ...sqs.slice(0, (i * 5) % sqs.length)]) {
      await page.click(`[data-square="${s}"]`);
      const hs = await page.$$eval('[data-square]', els => els.filter(e => e.querySelector('.dot, .ring')).map(e => e.getAttribute('data-square')));
      if (hs.length) { await page.click(`[data-square="${hs[hs.length - 1]}"]`); moved = true; break; }
    }
    if (!moved) break;
    const promo = page.getByRole('button', { name: /Promote to queen/ });
    if (await promo.isVisible().catch(() => false)) await promo.click();
    await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 15000 }).catch(() => {});
  }
  if (await page.getAttribute('[data-testid="match"]', 'data-turn') !== 'over') {
    await page.getByRole('button', { name: /Resign/ }).first().click();
    await page.getByRole('button', { name: 'Yes, Resign' }).click();
  }
  await page.waitForSelector('.result-overlay', { timeout: 20000 });
}

// 3. play, resign, View Analysis
await playAndResign(8);
await page.getByRole('button', { name: /View Analysis/i }).click();
await page.waitForSelector('[data-testid="report-status"]', { timeout: 15000 }).catch(() => {});
const squares = await page.locator('main [data-square]').count();
check(3, squares === 36 && (await boundary()) === 0, `View Analysis opens the review with a ${squares}-square board`);
await page.screenshot({ path: SHOTS + 'analysis-02-running.png' });
const done = await page.waitForFunction(() => document.querySelector('[data-testid="analysis-status"]')?.textContent === 'complete', null, { timeout: 300000 }).then(() => true).catch(() => false);
check(4, done, 'The engine worker analysed the game and the report shows "complete" on screen');

// 4. grades, graph, candidates, variation
const graded = await page.locator('main .mc-mv .grade-icon:not(.grade-none)').count();
const graph = await page.locator('main svg.graph').count();
await page.locator('main .mc-mv[data-ply="3"]').click();
const grade = await page.locator('[data-testid="move-grade"]').textContent().catch(() => '');
const cands = await page.locator('[data-testid="candidate"]').count();
const ind1 = await page.locator('[data-testid="ply-indicator"]').textContent();
check(5, graded > 0 && graph === 1 && /\S/.test(grade) && grade !== 'Ungraded' && cands > 0 && /ply 3\//.test(ind1),
  `Move grades in the move list (${graded}), evaluation graph (${graph}), move 3 graded "${grade}" with ${cands} engine candidates; list and board in sync (${ind1})`);
await page.screenshot({ path: SHOTS + 'analysis-03-graded-game.png', fullPage: true });
await page.locator('[data-testid="candidate"]').first().click();
const ind2 = await page.locator('[data-testid="ply-indicator"]').textContent();
await page.getByRole('button', { name: 'Return to Main Line' }).click();
const ind3 = await page.locator('[data-testid="ply-indicator"]').textContent();
check(6, /variation/.test(ind2) && /ply 3\//.test(ind3), `Exploring a best line enters a variation (${ind2}) and returns to the main line (${ind3})`);

// 5. replay autoplay + keyboard navigation
await page.locator('main .mc-mv[data-ply="1"]').click();
await page.getByRole('button', { name: 'Fast' }).click().catch(() => {});
await page.locator('[data-testid="replay-play"]').click();
await page.waitForTimeout(1600);
const ind4 = await page.locator('[data-testid="ply-indicator"]').textContent();
await page.locator('[data-testid="replay-play"]').click();
const p4 = +(/ply (\d+)/.exec(ind4)?.[1] ?? 0);
await page.keyboard.press('Home');
const ind5 = await page.locator('[data-testid="ply-indicator"]').textContent();
check(7, p4 >= 3 && /ply 0\//.test(ind5), `Replay autoplay advanced to ${ind4}; Home returns to ${ind5}`);

// 6. picker lists it as analysed
await navAnalysis();
await page.waitForSelector('[data-testid="analysis-pick-row"]', { timeout: 10000 }).catch(() => {});
const st1 = await page.locator('[data-testid="analysis-pick-status"]').first().textContent().catch(() => '');
check(8, /Analysed/.test(st1), `The Analysis picker lists the game as "${st1}"`);

// 7. a game whose analysis was cancelled → Analyse Game from the picker
await playAndResign(5);
await page.getByRole('button', { name: /View Analysis/i }).click();
const cancel = page.locator('[data-testid="report-status"]').getByRole('button', { name: 'Cancel' });
await cancel.click({ timeout: 20000 }).catch(() => step('analysis finished before it could be cancelled'));
await page.waitForTimeout(800);
await navAnalysis();
await page.waitForSelector('[data-testid="analysis-pick-row"]');
const rowCount = await page.locator('[data-testid="analysis-pick-row"]').count();
const st2 = await page.locator('[data-testid="analysis-pick-status"]').first().textContent();
await page.screenshot({ path: SHOTS + 'analysis-04-picker.png' });
const analyse = page.locator('[data-testid="analysis-pick-row"]').first().getByRole('button', { name: 'Analyse Game' });
const offered = await analyse.count();
if (offered) await analyse.click();
const done2 = offered ? await page.waitForFunction(() => document.querySelector('[data-testid="analysis-status"]')?.textContent === 'complete', null, { timeout: 300000 }).then(() => true).catch(() => false) : false;
check(9, rowCount === 2 && /cancel|Not analysed/i.test(st2) && offered === 1 && done2,
  `Picker lists ${rowCount} games; the cancelled one shows "${st2}" with an Analyse Game action, which ran to "complete"`);

// 8. persistence across reload
const gid = await page.evaluate(() => decodeURIComponent(location.hash.split('/')[2]));
await page.reload();
await page.waitForSelector('[data-testid="analysis-status"]', { timeout: 20000 }).catch(() => {});
const st3 = await page.locator('[data-testid="analysis-status"]').textContent().catch(() => '');
check(10, st3 === 'complete', `After reload, game ${gid} still shows its report (${st3})`);

// 9. phone layout
await ctx.close();
ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
page = ctx.pages()[0] ?? await ctx.newPage(); watch(page);
await page.goto(url + `#/analysis/${encodeURIComponent(gid)}`);
await page.waitForSelector('[data-testid="analysis-status"]', { timeout: 20000 }).catch(() => {});
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.screenshot({ path: SHOTS + 'analysis-05-phone.png' });
check(11, overflow <= 0 && (await page.locator('main [data-square]').count()) === 36, `Phone (390 px): board shown, horizontal overflow ${overflow}px`);
check(12, errors.length === 0, `No page errors during the journey (${errors.length})`);
await finish(ctx);
