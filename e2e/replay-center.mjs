/**
 * v0.10 Match Center journey (evaluation bar, Live Match Center, Replay & Analysis Center, Replay Library), real UI
 * in Chromium against a production build:
 *   live in-play match → evaluation bar shows the published evaluation (never the price), trades → finish and settle
 *   → replay: recorded prices, your trades, holdings, value and settlement synchronised to the replay ply → flip,
 *   play/pause → sandbox never changes the recorded game → own casual game: Game Review with the bar, turning
 *   points, sandbox (record unchanged), saved line, lessons → a rated game in progress shows no bar and no evaluation
 *   → Replay Library filters and favourites (persisted across a reload) → 390 px phone: Board · Analysis · Trade with
 *   the context strip always visible, page scrolling, no horizontal overflow. Screenshots in docs/screenshots/v0.10/.
 *   npm run build && node scripts/serve.mjs --dir dist --port 4410 &  node e2e/replay-center.mjs http://127.0.0.1:4410/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4410/';
const SHOTS = new URL('../docs/screenshots/v0.10/', import.meta.url).pathname;
const OUT = new URL('../docs/evidence/v0.10-replay-center/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/replay-center-profile', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });
const log = []; let failed = 0; const results = {};
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); writeFileSync(OUT + 'journey-log.txt', log.join('\n') + '\n'); };
const check = (id, ok, m) => { results[id] = !!ok; step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; writeFileSync(OUT + 'journey-results.json', JSON.stringify(results, null, 1)); };
const errors = [];
async function open(viewport = { width: 1440, height: 1000 }, mobile = false) {
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + String(e).slice(0, 300)); });
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); step('console.error: ' + m.text().slice(0, 300)); } });
  await page.goto(url); await page.waitForSelector('.app'); await page.waitForFunction(() => window.__crown);
  return { ctx, page };
}
const waitUntil = async (page, fn, arg, timeout = 600000) => { const end = Date.now() + timeout; for (;;) { if (await page.evaluate(fn, arg).catch(() => false)) return true; if (Date.now() > end) return false; await page.waitForTimeout(700); } };
// the bar's text, computed independently from a recorded score (White's side; one decimal; mate in moves)
const fmtEval = s => { if (!s) return '–'; const w = s.pov === 'white' ? s : s.kind === 'cp' ? { ...s, value: -s.value } : s.kind === 'mate' ? { ...s, plies: -s.plies } : { ...s, outcome: s.outcome === 'win' ? 'loss' : s.outcome === 'loss' ? 'win' : 'draw' };
  if (w.kind === 'cp') { const v = Math.round(w.value / 10) / 10; return v === 0 ? '0.0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`; }
  if (w.kind === 'mate') return `${w.plies > 0 ? '' : '−'}M${Math.max(1, Math.ceil(Math.abs(w.plies) / 2))}`;
  return w.outcome === 'win' ? '1-0' : w.outcome === 'loss' ? '0-1' : '½-½'; };
const barInfo = page => page.evaluate(() => { const b = document.querySelector('[data-testid="eval-bar"]'); return b && { value: b.getAttribute('data-value'), white: +b.getAttribute('data-white'), orientation: b.getAttribute('data-orientation'), cls: b.className, label: b.getAttribute('aria-label'), text: b.getAttribute('aria-valuetext') }; });
const usd = x => `$${x.toFixed(3)}`;

let { ctx, page } = await open();
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
const fx = await page.evaluate(() => { const f = window.__crown.fed; const x = f.featuredFixtures().find(y => y.result === null && f.marketFor(y.id)?.status === 'open'); return x && { id: x.id, market: f.marketFor(x.id).id, white: f.name(x.white), black: f.name(x.black) }; });
step(`setup: federation founded; featured match ${fx?.white} – ${fx?.black} (${fx?.id})`);
if (!fx) throw new Error('no featured match with an open market');

// 1. live: the bar shows the published evaluation of the shown move, labelled as such
await page.goto(url + '#/watch/' + encodeURIComponent(fx.id));
await page.waitForSelector('[data-testid="arena"]');
const bar0 = await barInfo(page);
await page.locator('[data-testid="start-inplay"]').click();
await page.waitForSelector('[data-testid="inplay"]');
const stepMove = async () => { const n = await page.evaluate(id => window.__crown.fed.liveGame(id).moves.length, fx.id); await page.locator('[data-testid="next-move"]').click(); await waitUntil(page, ([id, k]) => window.__crown.fed.liveGame(id).moves.length > k, [fx.id, n], 120000); await page.waitForTimeout(300); };
await stepMove(); await stepMove();
const pub = await page.evaluate(id => { const lg = window.__crown.fed.liveGame(id); const m = window.__crown.fed.marketFor(id); return { score: lg.moves[lg.moves.length - 1].score, plies: lg.moves.length, prices: m.history[m.history.length - 1].prices }; }, fx.id);
const bar1 = await barInfo(page);
const sandboxLive = await page.locator('[data-testid="sandbox-start"]').count();
check(1, bar0 === null || bar0.value === '–' ? bar1 && bar1.value === fmtEval(pub.score) && /published engine evaluation/.test(bar1.label) && !pub.prices.some(p => Math.abs(p - bar1.white) < 1e-9) && sandboxLive === 0 : false,
  `Live in-play match: the evaluation bar shows the published evaluation of move ${pub.plies} (${bar1?.value}, "${bar1?.label}"), White's expected score ${bar1?.white} — not a market price (${pub.prices.map(p => p.toFixed(3)).join('/')}); no sandbox while the market trades`);
await page.screenshot({ path: SHOTS + '01-live-match-center-desktop.png' });

// 2. trades through the ticket and the Exit button, at known plies
await page.getByLabel('Shares').fill('10');
await page.locator('[data-testid="confirm-trade"]').click();
await page.waitForSelector('text=Bought 10');
const tradePly1 = await page.evaluate(id => window.__crown.fed.liveGame(id).moves.length, fx.id);
await stepMove(); await stepMove();
const exitBtn = page.locator('[data-testid="arena-exit"] button').first();
const hadExit = await exitBtn.count();
await exitBtn.click();
await waitUntil(page, mid => { const p = window.__crown.fed.state.positions.get(`${mid}|player:cash`); return p && p.shares.every(x => x === 0); }, fx.market, 30000);
const tradePly2 = await page.evaluate(id => window.__crown.fed.liveGame(id).moves.length, fx.id);
await stepMove();
await page.getByLabel('Shares').fill('6');
await page.getByRole('group', { name: 'Outcome' }).getByRole('button', { name: 'Draw' }).click();
await page.locator('[data-testid="confirm-trade"]').click();
await page.waitForSelector('text=Bought 6');
const tradePly3 = await page.evaluate(id => window.__crown.fed.liveGame(id).moves.length, fx.id);
const posLive = await page.evaluate(mid => window.__crown.fed.state.positions.get(`${mid}|player:cash`).shares, fx.market);
check(2, hadExit === 1 && posLive.join('/') === '0/6/0', `Bought 10 at move ${tradePly1}, exited the position with the Exit button at move ${tradePly2}, bought 6 Draw at move ${tradePly3}; holdings ${posLive.join('/')}`);

// 3. finish and settle
await page.getByRole('button', { name: '1 s', exact: true }).click();
await page.locator('[data-testid="auto-run"]').click();
const finished = await waitUntil(page, id => window.__crown.fed.liveGame(id)?.status === 'done', fx.id, 1800000);
const fin = await page.evaluate(async ([id, mid]) => { const f = window.__crown.fed; const m = f.state.markets.get(mid); const p = f.state.positions.get(`${mid}|player:cash`); const wg = await f.worldGame(`wg:${id}`); const lg = f.liveGame(id);
  return { status: m.status, result: m.result, received: p.received, spent: p.spent, plies: wg.moves.length, wgJson: JSON.stringify(wg), lgJson: JSON.stringify(lg), points: lg.points.map(x => ({ ply: x.ply, prices: x.prices })), res: wg.result }; }, [fx.id, fx.market]);
check(3, finished && ['settled', 'cancelled'].includes(fin.status), `Match finished after ${fin.plies} plies (${fin.res}); market ${fin.status}; ${fin.points.length} recorded price points; your position spent ${(fin.spent / 1e6).toFixed(2)} / received ${(fin.received / 1e6).toFixed(2)}`);

// 4. replay: recorded prices and your portfolio synchronised to the ply
await page.goto(url + '#/watch/' + encodeURIComponent(fx.id));
await page.reload();
await page.waitForSelector('[data-testid="arena-history"]', { timeout: 30000 });
const clickPly = async k => { await page.locator(`[data-testid="arena-moves"] .mc-mv[data-ply="${k}"]`).click(); await page.waitForTimeout(150); };
const sync = [];
for (const k of [tradePly1, tradePly2, tradePly3, Math.min(fin.plies - 1, tradePly3 + 3)]) {
  await clickPly(k);
  const ui = await page.evaluate(() => ({ ply: document.querySelector('[data-testid="arena-history"]')?.getAttribute('data-ply'), prices: [0, 1, 2].map(i => document.querySelector(`[data-testid="hist-price-${i}"]`)?.textContent), holdings: document.querySelector('[data-testid="hist-holdings"]')?.textContent?.replace(/\s/g, ''), strip: [0, 1, 2].map(i => document.querySelector(`[data-testid="strip-price-${i}"] .mono`)?.textContent) }));
  const rec = [...fin.points].reverse().find(p => p.ply <= k);
  const exp = k < tradePly1 ? '0/0/0' : k < tradePly2 ? null : k < tradePly3 ? '0/0/0' : '0/6/0';
  sync.push({ k, ok: ui.ply === String(rec.ply) && ui.prices.join() === rec.prices.map(usd).join() && ui.strip.join() === rec.prices.map(usd).join() && (exp === null || ui.holdings === exp), ui, rec: rec.prices.map(usd) });
}
step('sync detail: ' + JSON.stringify(sync));
check(4, sync.every(x => x.ok), `Replay at moves ${sync.map(x => x.k).join(', ')}: the market panel and the context strip show exactly the recorded prices of the latest published point at or before that move, and your holdings at that point (${sync.map(x => x.ui.holdings).join(' → ')})`);
await page.screenshot({ path: SHOTS + '02-replay-recorded-market-desktop.png' });
await page.getByRole('button', { name: 'Latest move' }).click();
await page.waitForSelector('[data-testid="final-result"]', { timeout: 30000 });
const endUi = await page.evaluate(() => ({ settle: document.querySelector('[data-testid="hist-settlement"]')?.textContent, realised: document.querySelector('[data-testid="hist-realised"]')?.textContent, pnl: document.querySelector('[data-testid="hist-pnl"]')?.textContent }));
const expReal = fin.received - fin.spent;
const fmtSigned = v => `${v > 0 ? '+' : ''}${v < 0 ? '-' : ''}$${(Math.abs(v) / 1e6).toFixed(2)}`;
check(5, !!endUi.settle && endUi.realised === fmtSigned(expReal) && endUi.pnl === fmtSigned(expReal), `At the last move the recorded settlement shows: "${endUi.settle}"; realised ${endUi.realised} = received − spent ${fmtSigned(expReal)}; P&L ${endUi.pnl}`);

// 5. flip and play/pause
await clickPly(4);
const bf = await barInfo(page);
await page.getByRole('button', { name: 'Flip Board' }).first().click();
const bb = await barInfo(page);
await page.getByRole('button', { name: 'Flip Board' }).first().click();
check(6, bf.orientation === 'white' && /white-bottom/.test(bf.cls) && bb.orientation === 'black' && /white-top/.test(bb.cls) && bf.value === bb.value, `Flip: the bar turns with the board (${bf.cls} → ${bb.cls}), same value ${bb.value}`);
await page.getByRole('button', { name: 'Fast', exact: true }).click();
await page.locator('[data-testid="replay-pause"]').click();
await page.waitForTimeout(1600);
await page.locator('[data-testid="replay-pause"]').click();
const plyAfter = await page.locator('[data-testid="arena-ply"]').textContent();
check(7, +plyAfter.split('/')[0] >= 6, `Replay play/pause advanced the recorded game from move 4 to ${plyAfter}`);

// 6. sandbox after settlement: alternative moves never change the record
await clickPly(6);
await page.locator('[data-testid="sandbox-start"]').click();
const playSandboxMove = async () => {
  const sqs = await page.$$eval('[data-testid="arena"] [data-square]', els => els.map(e => e.getAttribute('data-square')));
  for (const s of sqs) { await page.click(`[data-testid="arena"] [data-square="${s}"]`); const hs = await page.$$eval('[data-testid="arena"] [data-square]', els => els.filter(e => e.querySelector('.dot, .ring')).map(e => e.getAttribute('data-square'))); if (hs.length) { await page.click(`[data-testid="arena"] [data-square="${hs[0]}"]`); return true; } }
  return false;
};
const m1 = await playSandboxMove();
await page.waitForFunction(() => /Engine \(depth|No legal moves/.test(document.querySelector('[data-testid="sandbox-eval"]')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
const sbEval = await page.locator('[data-testid="sandbox-eval"]').textContent();
await page.locator('[data-testid="sandbox-engine"]').click().catch(() => {});
await page.waitForTimeout(400);
const sbLine = await page.locator('[data-testid="sandbox-line"]').textContent();
await page.screenshot({ path: SHOTS + '03-replay-sandbox-desktop.png' });
await page.locator('[data-testid="sandbox-save"]').click();
await page.locator('[data-testid="sandbox-exit"]').click();
const after = await page.evaluate(async id => { const f = window.__crown.fed; return { wg: JSON.stringify(await f.worldGame(`wg:${id}`)), lg: JSON.stringify(f.liveGame(id)), saved: (await window.__crown.db.getAll('bookmarks')).filter(b => b.kind === 'position' && b.gameId === `wg:${id}`).length }; }, fx.id);
check(8, m1 && /Engine/.test(sbEval) && after.wg === fin.wgJson && after.lg === fin.lgJson && after.saved === 1, `Sandbox from move 6 (board move made: ${m1}): played "${sbLine.trim()}", engine help "${sbEval.trim().slice(0, 60)}"; position saved as a bookmark; the recorded game and its live record are byte-for-byte unchanged`);

// 7. post-game analysis switches the bar to Match Analysis (only after settlement) and adds grades
const analysed = await page.waitForSelector('[data-testid="arena-grade-summary"]', { timeout: 1800000 }).then(() => true).catch(() => false);
await clickPly(5);
const bpa = await barInfo(page);
const rep = await page.evaluate(async id => { const rs = await window.__crown.db.reportsForGame(`wg:${id}`); const r = rs.find(x => x.status === 'complete'); return r && r.plies[4].evalAfter; }, fx.id);
check(9, analysed && bpa.value === fmtEval(rep) && /Match Analysis/.test(bpa.label), `After settlement the Match Analysis report exists and the bar at move 5 shows its evaluation (${bpa.value}, "${bpa.label}")`);
await page.locator('[data-testid="favourite"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '04-replay-analysis-desktop.png', fullPage: true });

// 8. own casual game: Game Review with the bar, turning points, sandbox, saved line, lessons
async function playAndResign(myMoves, mode) {
  await page.goto(url + '#/play');
  await page.getByRole('button', { name: /Mira Vell/ }).click();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: mode, exact: true }).click();
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
    // rated game: no bar and no evaluation at any point while playing
    if (mode === 'Rated') ratedSeen.push(await page.evaluate(() => ({ bar: document.querySelectorAll('.mc-evalbar, [role="meter"]').length, evalText: /Eval\s|expected score|[+−]\d\.\d\b/.test(document.querySelector('[data-testid="match"]')?.innerText ?? '') })));
  }
  if (await page.getAttribute('[data-testid="match"]', 'data-turn') !== 'over') {
    await page.getByRole('button', { name: /Resign/ }).first().click();
    await page.getByRole('button', { name: 'Yes, Resign' }).click();
  }
  await page.waitForSelector('.result-overlay', { timeout: 20000 });
}
const ratedSeen = [];
await playAndResign(8, 'Casual');
await page.getByRole('button', { name: /View Analysis/i }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="analysis-status"]')?.textContent === 'complete', null, { timeout: 300000 });
const gid = await page.evaluate(() => decodeURIComponent(location.hash.split('/')[2]));
const gameBefore = await page.evaluate(async id => JSON.stringify(await window.__crown.db.getGame(id)), gid);
await page.locator('main .mc-mv[data-ply="3"]').click();
const ab = await barInfo(page);
const rp3 = await page.evaluate(async id => { const rs = (await window.__crown.db.reportsForGame(id)).filter(r => r.status === 'complete'); const g = await window.__crown.db.getGame(id); return { s: rs[rs.length - 1].plies[2].evalAfter, human: g.humanColor }; }, gid);
const turnsN = await page.locator('[data-testid="turning-point"]').count();
const lessons = await page.locator('[data-testid="lesson-links"] .mc-lesson').count();
check(10, ab && ab.value === fmtEval(rp3.s) && ab.orientation === rp3.human && lessons > 0, `Game Review: the bar at move 3 shows the report's evaluation ${ab?.value} = ${fmtEval(rp3.s)} (${ab?.label}), oriented to your colour (${ab?.orientation}); ${turnsN} turning point(s) listed; ${lessons} Grimoire lesson link(s)`);
await page.locator('[data-testid="sandbox-start"]').click();
const am1 = await (async () => { const sqs = await page.$$eval('main [data-square]', els => els.map(e => e.getAttribute('data-square'))); for (const s of sqs) { await page.click(`main [data-square="${s}"]`); const hs = await page.$$eval('main [data-square]', els => els.filter(e => e.querySelector('.dot, .ring')).map(e => e.getAttribute('data-square'))); if (hs.length) { await page.click(`main [data-square="${hs[0]}"]`); return true; } } return false; })();
await page.waitForFunction(() => /Engine \(depth|No legal moves/.test(document.querySelector('[data-testid="sandbox-eval"]')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
const sandboxBar = await barInfo(page);
await page.locator('[data-testid="sandbox-save"]').click();
await page.screenshot({ path: SHOTS + '05-game-review-sandbox-desktop.png' });
await page.locator('[data-testid="sandbox-exit"]').click();
await page.reload();
await page.waitForSelector('[data-testid="saved-lines"]', { timeout: 20000 });
const gameAfter = await page.evaluate(async id => JSON.stringify(await window.__crown.db.getGame(id)), gid);
check(11, am1 && sandboxBar && /sandbox/.test(sandboxBar.label) && gameBefore === gameAfter, `Game Review sandbox: an alternative move was played with engine help (bar "${sandboxBar?.label}" ${sandboxBar?.value}); the saved game record is unchanged after saving the line and reloading; the saved line is listed`);
await page.locator('[data-testid="favourite"]').click();

// 9. rated game in progress: no bar, no evaluation
await playAndResign(3, 'Rated');
check(12, ratedSeen.length > 0 && ratedSeen.every(x => x.bar === 0 && !x.evalText), `Rated game in progress: no evaluation bar and no evaluation text on the match screen after each of ${ratedSeen.length} moves`);

// 10. Replay Library filters and favourites
await page.goto(url + '#/replays');
await page.waitForSelector('[data-testid="replay-row"]', { timeout: 30000 });
const lib = {};
for (const f of ['all', 'personal', 'federation', 'finals', 'rivalries', 'upsets', 'swings', 'market', 'favourites']) {
  await page.locator(`[data-testid="replay-filter-${f}"]`).click();
  await page.waitForTimeout(150);
  lib[f] = await page.$$eval('[data-testid="replay-row"]', els => els.map(e => ({ id: e.getAttribute('data-id'), kind: e.getAttribute('data-kind'), tags: e.innerText })));
}
const wgCount = await page.evaluate(async () => (await window.__crown.fed.worldGames()).length);
const doneGames = await page.evaluate(async () => (await window.__crown.db.allGames()).filter(g => g.status === "finalized").length);
const libOk = lib.personal.length === doneGames && lib.personal.every(r => r.kind === 'personal') && lib.federation.length === Math.min(30, wgCount) && lib.federation.every(r => r.kind === 'federation')
  && lib.finals.every(r => /Final/.test(r.tags)) && lib.upsets.every(r => /Upset/.test(r.tags)) && lib.swings.every(r => /Swing/.test(r.tags)) && lib.market.every(r => /Price move/.test(r.tags)) && lib.rivalries.every(r => /Rivalry/.test(r.tags))
  && lib.favourites.map(r => r.id).sort().join() === [gid, `wg:${fx.id}`].sort().join();
step('library counts: ' + JSON.stringify(Object.fromEntries(Object.entries(lib).map(([k, v]) => [k, v.length]))));
await page.locator('[data-testid="replay-filter-all"]').click();
await page.screenshot({ path: SHOTS + '06-replay-library-desktop.png' });
await page.reload();
await page.waitForSelector('[data-testid="replay-row"]');
await page.locator('[data-testid="replay-filter-favourites"]').click();
await page.waitForTimeout(200);
const favAfter = await page.$$eval('[data-testid="replay-row"]', els => els.map(e => e.getAttribute('data-id')).sort().join());
check(13, libOk && favAfter === [gid, `wg:${fx.id}`].sort().join(), `Replay Library: ${lib.personal.length} personal and ${lib.federation.length} Federation replays (of ${wgCount} recorded); every filtered row carries its tag (finals ${lib.finals.length}, rivalries ${lib.rivalries.length}, upsets ${lib.upsets.length}, swings ${lib.swings.length}, market ${lib.market.length}); favourites (${favAfter}) persist after a reload`);
await page.locator('[data-testid="replay-row"]').filter({ hasText: fx.white }).first().locator('.replay-open').click();
await page.waitForSelector('[data-testid="arena"]');
check(14, (await page.evaluate(() => location.hash)).startsWith('#/watch/'), 'Opening a Federation replay from the library goes to the Arena replay');
await ctx.close();

// 11. phone 390 px: Board · Analysis · Trade, context strip always visible, page scrolls, no overflow
({ ctx, page } = await open({ width: 390, height: 844 }, true));
await page.goto(url + '#/watch/' + encodeURIComponent(fx.id));
await page.waitForSelector('[data-testid="arena-context"]');
await page.locator('[data-testid="arena-moves"] .mc-mv[data-ply="12"]').evaluate(e => e.click());
const ph = [];
for (const t of ['Board', 'Analysis', 'Trade']) {
  await page.getByRole('tab', { name: t }).click(); await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  ph.push(await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, board: document.querySelector('.board')?.checkVisibility() ? document.querySelector('.board').getBoundingClientRect().width : 0,
    a: !!document.querySelector('[data-testid="arena-analysis"]')?.checkVisibility(), m: !!document.querySelector('[data-testid="arena-market"]')?.checkVisibility(), p: !!document.querySelector('[data-testid="arena-portfolio"]')?.checkVisibility(), ctx: !!document.querySelector('[data-testid="arena-context"]')?.checkVisibility(), bar: !!document.querySelector('[data-testid="eval-bar"]')?.checkVisibility() })));
  await page.screenshot({ path: SHOTS + `0${7 + ph.length - 1}-phone-${t.toLowerCase()}.png` });
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(250);
  const sc = await page.evaluate(() => ({ y: scrollY, top: document.querySelector('[data-testid="arena-context"]').getBoundingClientRect().top, max: document.documentElement.scrollHeight - innerHeight }));
  ph[ph.length - 1].scroll = sc;
  if (t === 'Analysis') await page.screenshot({ path: SHOTS + '10-phone-analysis-scrolled.png' });
}
step('phone: ' + JSON.stringify(ph));
check(15, ph.every(x => x.overflow <= 0 && x.ctx && (x.scroll.max < 50 || (x.scroll.y > 0 && x.scroll.top >= -1 && x.scroll.top < 80))) && ph[0].board >= 330 && ph[0].bar && !ph[0].a && !ph[0].m && ph[1].a && !ph[1].m && ph[1].board === 0 && ph[2].m && ph[2].p && !ph[2].a,
  `Phone 390 px: Board tab shows the ${Math.round(ph[0].board)} px board with the bar; Analysis and Trade tabs switch panels; the context strip (names, score, clocks, prices) stays visible while the page scrolls (scrollY ${ph.map(x => x.scroll.y).join('/')}); no horizontal overflow`);
await page.goto(url + '#/replays');
await page.waitForSelector('[data-testid="replay-row"]');
const lo = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
await page.screenshot({ path: SHOTS + '11-phone-replay-library.png' });
await page.goto(url + `#/analysis/${encodeURIComponent(gid)}/3`);
await page.waitForSelector('[data-testid="eval-bar"]', { timeout: 20000 });
const ao = await page.evaluate(() => ({ o: document.documentElement.scrollWidth - innerWidth, board: document.querySelector('.board').getBoundingClientRect().width }));
await page.screenshot({ path: SHOTS + '12-phone-game-review.png' });
check(16, lo <= 0 && ao.o <= 0 && ao.board >= 300, `Phone: Replay Library and Game Review (board ${Math.round(ao.board)} px with the bar) have no horizontal overflow`);
await ctx.close();
check(17, errors.length === 0, `No page or console errors (${errors.length})`);
step(failed ? `${failed} check(s) FAILED` : `REPLAY CENTER JOURNEY: ${Object.values(results).filter(Boolean).length}/${Object.keys(results).length} checks passed`);
process.exit(failed ? 1 : 0);
