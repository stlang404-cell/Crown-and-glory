/**
 * v1.1 Grand Classical journey (docs/CAREER_RATING.md §7, docs/SAVE_FORMAT.md "Pause on exit"), through the real UI
 * of a production build, at 375 px, 390 px and desktop:
 *   presets and plain-language explanation → default Classical 60+60 → custom and casual-only controls → remembered
 *   selection after reload → rated game (60+60 / 90+60 / 240+120) → h:mm:ss clocks without clipping → moves →
 *   backgrounding (visibilitychange + pagehide): clock unchanged while away, paused and saved → resume → context
 *   closed and reopened: the clock continues from the saved time → second tab is read-only → offline reload mid-game →
 *   resign → exactly one rating event, in the career pool (Long Classical).
 *
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4480 &  node e2e/grand-classical.mjs http://127.0.0.1:4480/
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

const url = process.argv[2] ?? 'http://127.0.0.1:4480/';
const ART = new URL('./artifacts/grand-classical/', import.meta.url).pathname;
const OUT = new URL('../docs/evidence/', import.meta.url).pathname;
rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true }); mkdirSync(OUT, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const robot = new Searcher(16);
const wait = ms => new Promise(r => setTimeout(r, ms));

async function open(profile, viewport) {
  const ctx = await chromium.launchPersistentContext(profile, { viewport, deviceScaleFactor: 2 });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', e => step('pageerror ' + e));
  return { ctx, page };
}
const turn = page => page.getAttribute('[data-testid="match"]', 'data-turn');
async function humanMove(page) {
  await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 60000 });
  const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
  const mv = moveToCcn(robot.search(Position.fromFen(fen), { limits: { nodes: 4000 } }).bestMove);
  await page.click(`[data-square="${mv.slice(0, 2)}"]`);
  await page.click(`[data-square="${mv.slice(2, 4)}"]`);
  if (mv.length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[mv[4]] }).click();
  await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 30000 });
}
const humanClock = page => page.locator('[data-testid="human-clock"]').textContent().then(t => t.replace(/[^\d:.]/g, ''));
const record = page => page.evaluate(async () => { const g = (await window.__crown.db.unfinishedGames())[0]; return g && { id: g.id, status: g.status, clocks: g.clocks, pauses: g.pauses.map(p => p.reason), moves: g.moves.length, tc: g.timeControl, pool: g.pool, rated: g.rated, human: g.humanColor }; });
const toMs = t => { const p = t.split(':').map(Number); return p.length === 3 ? ((p[0] * 60 + p[1]) * 60 + p[2]) * 1000 : (p[0] * 60 + p[1]) * 1000; };
const hide = (page, kind) => page.evaluate(k => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  if (k === 'pagehide') window.dispatchEvent(new Event('pagehide'));
}, kind);
const show = page => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
});
async function layout(page, label) {
  const r = await page.evaluate(() => {
    const clocks = [...document.querySelectorAll('.clock')].map(c => ({ t: c.textContent, clip: c.scrollWidth > c.clientWidth + 1, right: c.getBoundingClientRect().right }));
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, width: window.innerWidth, clocks };
  });
  const ok = !r.overflow && r.clocks.every(c => !c.clip && c.right <= r.width + 0.5);
  check(`layout ${label}`, ok, `${r.width} px: no horizontal overflow ${!r.overflow}; clocks ${r.clocks.map(c => `"${c.t}"${c.clip ? ' CLIPPED' : ''}`).join(', ')}`);
}

const RUNS = [
  { name: '375', viewport: { width: 375, height: 812 }, preset: 'eternal240', label: 'Eternal Crown 240+120', base: '4:00:00' },
  { name: '390', viewport: { width: 390, height: 844 }, preset: 'grand90', label: 'Grand Classical 90+60', base: '1:30:00' },
  { name: 'desktop', viewport: { width: 1366, height: 900 }, preset: 'classical60', label: 'Classical 60+60', base: '1:00:00' },
];

for (const run of RUNS) {
  const profile = ART + `profile-${run.name}`;
  let { ctx, page } = await open(profile, run.viewport);
  await page.goto(url + '#/play');
  await page.waitForSelector('[data-testid="tc-picker"]');
  await page.waitForTimeout(500);
  const def = await page.evaluate(() => ({ sel: document.querySelector('[data-testid="tc-selected"]')?.textContent, rated: document.querySelector('[data-testid="tc-rated"]')?.textContent, explain: document.querySelector('[data-testid="tc-explain"]')?.textContent }));
  check(`${run.name}-1`, def.sel === 'Classical 60+60' && def.rated === 'Rated · Long Classical' && def.explain === '60 minutes per player, plus 60 seconds after every completed move.', `Default control: ${def.sel} · ${def.rated} · "${def.explain}"`);
  // every preset, with its explanation
  const seen = [];
  for (const id of ['xrapid30', 'classical60', 'grand90', 'crownmaster120', 'marathon180', 'eternal240']) {
    await page.locator(`[data-testid="tc-${id}"]`).click();
    seen.push(`${await page.locator('[data-testid="tc-selected"]').textContent()} (${await page.locator('[data-testid="tc-rated"]').textContent()})`);
  }
  check(`${run.name}-2`, seen.length === 6 && seen.every(s => s.includes('Rated · Long Classical')), `Presets: ${seen.join('; ')}`);
  // custom: 45+0 is casual, 45+30 rated; shorter controls casual only (Rated disabled)
  await page.locator('[data-testid="tc-custom"]').click();
  await page.locator('[data-testid="tc-custom-base"]').fill('45');
  await page.locator('[data-testid="tc-custom-inc"]').fill('0');
  const c0 = await page.locator('[data-testid="tc-rated"]').textContent();
  await page.locator('[data-testid="tc-custom-inc"]').fill('30');
  const c30 = await page.locator('[data-testid="tc-rated"]').textContent();
  await page.getByRole('button', { name: 'Rapid 5+3' }).click();
  const rapidRated = await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Rated', exact: true }).isDisabled();
  check(`${run.name}-3`, c0 === 'Casual only' && c30 === 'Rated · Long Classical' && rapidRated, `Custom 45+0 "${c0}", Custom 45+30 "${c30}"; Rapid 5+3 is casual only (Rated disabled: ${rapidRated})`);
  if (run.name === '390') await page.screenshot({ path: ART + 'picker-390.png', fullPage: false });
  // remembered after reload
  await page.locator(`[data-testid="tc-${run.preset}"]`).click();
  await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector('[data-testid="tc-picker"]'); await page.waitForTimeout(800);
  const remembered = await page.locator('[data-testid="tc-selected"]').textContent();
  check(`${run.name}-4`, remembered === run.label, `Remembered after reload: ${remembered}`);
  await layout(page, `${run.name} Play`);

  // ---- rated game
  await page.getByRole('button', { name: /Mira Vell/ }).click();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Rated', exact: true }).click();
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await page.getByRole('button', { name: /Start match/i }).click();
  await page.waitForSelector('[data-testid="match"]');
  const r0 = await record(page);
  const t0 = await humanClock(page);
  check(`${run.name}-5`, r0.rated && r0.pool === 'classical-long' && r0.tc.label === run.label && toMs(run.base) - toMs(t0) <= 5000 && (await page.locator('[data-testid="match-tc"]').textContent()) === run.label,
    `Rated game at ${r0.tc.label} in pool ${r0.pool}; clock shows ${t0}; strip "${await page.locator('[data-testid="tc-strip"]').textContent()}"`);
  await humanMove(page); await humanMove(page);
  await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 60000 });
  await layout(page, `${run.name} match`);
  await page.screenshot({ path: ART + `match-${run.name}.png` });

  // ---- backgrounding: hidden + pagehide → paused, saved; clock unchanged while away
  await page.waitForTimeout(1500);
  await hide(page, 'pagehide');
  await page.waitForTimeout(300);
  const away0 = await humanClock(page), rec0 = await record(page);
  await page.waitForTimeout(4000);
  const away1 = await humanClock(page), rec1 = await record(page);
  const stateTxt = await page.locator('[data-testid="clock-state"]').textContent();
  check(`${run.name}-6`, (await turn(page)) === 'paused' && away0 === away1 && rec0.status === 'paused' && JSON.stringify(rec0.clocks) === JSON.stringify(rec1.clocks) && rec1.pauses.includes('visibility'),
    `Hidden for 4 s: clock ${away0} → ${away1}, saved ${JSON.stringify(rec1.clocks)} (status ${rec1.status}, pauses ${rec1.pauses.join(',')}), status "${stateTxt}"`);
  await show(page);
  await page.waitForTimeout(2200);
  const back = await humanClock(page);
  const resumedTxt = await page.locator('[data-testid="clock-state"]').textContent();
  check(`${run.name}-7`, (await turn(page)) === 'human' && toMs(back) < toMs(away1) && toMs(away1) - toMs(back) <= 4000 && /Resumed/.test(resumedTxt), `Visible again: resumes from ${away1} → ${back} after ~2 s ("${resumedTxt}")`);

  // ---- close and reopen the browser context (pagehide first, as the page lifecycle does)
  await page.waitForTimeout(1200);
  await hide(page, 'pagehide');
  await page.waitForTimeout(400);
  const saved = await record(page);
  await ctx.close();
  await wait(5000);
  ({ ctx, page } = await open(profile, run.viewport));
  await page.goto(url + '#/play');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.waitForSelector('[data-testid="match"]');
  await page.waitForTimeout(400);
  const reopened = await record(page);
  const shown = await humanClock(page);
  const savedHuman = saved.human === 'white' ? saved.clocks.whiteMs : saved.clocks.blackMs;
  check(`${run.name}-8`, Math.abs(toMs(shown) - savedHuman) <= 2000 && reopened.moves === saved.moves,
    `Reopened after 5 s closed: saved ${Math.round(savedHuman / 1000)} s, shown ${shown} (no time charged while away); ${reopened.moves} moves kept`);

  if (run.name === 'desktop') {
    // second tab: read-only, no clock, no moves
    const p2 = await ctx.newPage();
    await p2.goto(url + '#/match/' + encodeURIComponent(reopened.id));
    await p2.waitForSelector('[data-testid="match"]');
    await p2.waitForTimeout(1500);
    const ro = await p2.locator('[data-testid="match-read-only"]').count();
    const c1 = await p2.locator('[data-testid="human-clock"]').textContent(); await p2.waitForTimeout(1500);
    const c2 = await p2.locator('[data-testid="human-clock"]').textContent();
    check('desktop-9', ro === 1 && c1 === c2, `Second tab is read-only (notice ${ro}); its clock does not run (${c1} → ${c2})`);
    await p2.close();
    // offline reload mid-game (service worker serves the shell; the clock continues from the saved time)
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); await page.waitForSelector('[data-testid="match"]');
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
    await humanMove(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 60000 });
    const beforeOff = await record(page);
    await ctx.setOffline(true);
    await page.reload(); await page.waitForSelector('[data-testid="match"]', { timeout: 30000 });
    await page.waitForTimeout(600);
    const off = await record(page);
    const offShown = await humanClock(page);
    const bh = beforeOff.human === 'white' ? beforeOff.clocks.whiteMs : beforeOff.clocks.blackMs;
    check('desktop-10', off.moves === beforeOff.moves && toMs(offShown) <= bh && bh - toMs(offShown) <= 8000, `Offline reload mid-game: ${off.moves} moves kept, clock ${Math.round(bh / 1000)} s saved → ${offShown} shown (charged at most up to the last heartbeat)`);
    await humanMove(page);
    await ctx.setOffline(false);
  }

  // ---- finish: resign → one rating event in the career pool
  await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 60000 });
  await page.getByRole('button', { name: /Resign/ }).first().click();
  await page.getByRole('button', { name: 'Yes, Resign' }).click();
  await page.waitForSelector('.result-overlay', { timeout: 20000 });
  const poolTxt = await page.locator('[data-testid="rating-pool"]').textContent();
  const ev = await page.evaluate(async () => {
    const s = window.__crown;
    const all = await s.db.ratingEvents();
    const g = (await s.db.allGames()).find(x => x.status === 'finalized');
    const again = await s.finalize({ ...g, status: 'terminal' }).catch(e => String(e));
    return { n: all.length, pools: [...new Set(all.map(e => e.pool))], after: (await s.db.ratingEvents()).length, career: await s.db.careerRating(), rapid: await s.db.ratingState('rapid'), again: !!again };
  });
  check(`${run.name}-11`, ev.n === 1 && ev.after === 1 && ev.pools.join() === 'classical-long' && ev.career.games === 1 && ev.rapid.games === 0 && /Long Classical/.test(poolTxt),
    `Resigned: ${ev.n} rating event (pools ${ev.pools.join()}), duplicate finalization → ${ev.after}; career Elo ${Math.max(0, Math.round(ev.career.rating))} ±${Math.round(ev.career.rd)}; Rapid untouched (${ev.rapid.games} games); overlay "${poolTxt}"`);
  await page.screenshot({ path: ART + `result-${run.name}.png` });
  await ctx.close();
}

writeFileSync(OUT + 'grand-classical-log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'All grand-classical checks passed');
process.exit(failed ? 1 : 0);
