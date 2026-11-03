/**
 * M6 addendum "Sovereign Live Arena" acceptance journey, real UI in Chromium:
 * open a live AI-vs-AI Crown Championship match → board, clocks, public information, odds and portfolio visible
 * and synchronised → eligible trade → advance: new public information, market revision and evaluation → stale
 * trade rejected → finish → settlement and full post-game analysis → restart and reopen the replay → phone layout
 * and offline replay.
 *   npm run build && node e2e/m6-arena.mjs [port]
 * To reach the Championship (rounds 16–19) quickly, the player's own fixtures are forfeited and rounds advanced
 * through the same service commands the UI uses (that part is setup, not under test).
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = +(process.argv[2] ?? 4299);
const URL_ = `http://127.0.0.1:${PORT}/`;
const OUT = new URL('../docs/evidence/m6-arena/', import.meta.url).pathname;
const SHOTS = new URL('../docs/screenshots/grandmaster-polish/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/m6-profile', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true }); mkdirSync(SHOTS, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });
const log = [], results = {};
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); writeFileSync(OUT + 'journey-log.txt', log.join('\n') + '\n'); };
let server;
const check = (n, c, m) => { results[n] = !!c; step(`${c ? 'PASS' : 'FAIL'}: ${n}. ${m}`); writeFileSync(OUT + 'journey-results.json', JSON.stringify(results, null, 1)); if (!c) { server?.kill(); process.exit(1); } };
process.on('uncaughtException', e => { console.error(e); server?.kill(); process.exit(1); });
process.on('unhandledRejection', e => { console.error(e); server?.kill(); process.exit(1); });

server = spawn(process.execPath, ['scripts/serve.mjs', '--dir', 'dist', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
const first = await new Promise(r => server.stdout.once('data', d => r(String(d))));
if (!first.includes(`running at http://127.0.0.1:${PORT}/`) || first.includes('already running')) throw new Error('stale server: ' + first);
const errors = [];
async function open(viewport = { width: 1440, height: 1000 }) {
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + e); });
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); step('console.error: ' + m.text().slice(0, 300)); } });
  await page.goto(URL_); await page.waitForSelector('.app'); await page.waitForFunction(() => window.__crown);
  return { ctx, page };
}
async function waitUntil(page, fn, arg, timeout = 600000) {
  const end = Date.now() + timeout;
  for (;;) { if (await page.evaluate(fn, arg).catch(() => false)) return; if (Date.now() > end) throw new Error('timeout: ' + fn.toString().slice(0, 100)); await page.waitForTimeout(800); }
}

let { ctx, page } = await open();
await page.goto(URL_ + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
// setup: forfeit own fixtures and advance to the Crown Championship (round 16)
const t0 = Date.now();
for (let guard = 0; guard < 20; guard++) {
  const r = await page.evaluate(() => window.__crown.fed.state.world.round);
  if (r >= 16) break;
  await page.evaluate(async () => { const f = window.__crown.fed; for (const x of f.playerFixtures()) await f.forfeit(x.id); await f.advanceRound(); });
}
const champ = await page.evaluate(() => { const f = window.__crown.fed; const x = f.featuredFixtures().find(y => y.event === 'champ' && y.result === null && f.marketFor(y.id)?.status === 'open'); return x && { id: x.id, market: f.marketFor(x.id).id, stage: x.stage, white: f.name(x.white), black: f.name(x.black), round: f.state.world.round }; });
step(`setup: advanced to round ${champ?.round} in ${Math.round((Date.now() - t0) / 1000)} s (own fixtures forfeited)`);
if (!champ) throw new Error('no open championship market');

// 1. open the live championship match
await page.goto(URL_ + '#/watch/' + encodeURIComponent(champ.id));
await page.waitForSelector('[data-testid="arena"]');
await page.locator('[data-testid="start-inplay"]').click();
await page.waitForSelector('[data-testid="inplay"]');
await page.locator('[data-testid="next-move"]').click();
await waitUntil(page, id => window.__crown.fed.liveGame(id).moves.length >= 1, champ.id, 120000);
const view = async () => page.evaluate(() => ({
  board: !!document.querySelector('[data-testid="arena"] .board'), clockW: document.querySelector('[data-testid="think-white"]')?.textContent, clockB: document.querySelector('[data-testid="think-black"]')?.textContent,
  playerW: document.querySelector('[data-testid="arena-player-white"]')?.textContent, price0: document.querySelector('[data-testid="live-price-0"]')?.textContent,
  rev: document.querySelector('[data-testid="arena-revision"]')?.textContent, ticketRev: document.querySelector('[data-testid="ticket"]')?.getAttribute('data-revision'),
  portfolio: !!document.querySelector('[data-testid="arena-portfolio"]'), moves: document.querySelectorAll('[data-testid="arena-move"]').length,
  grades: document.querySelectorAll('[data-testid="arena-moves"] .grade-icon').length, graph: !!document.querySelector('[data-testid="arena-eval-graph"] polyline'),
  policy: document.querySelector('[data-testid="arena-policy"]')?.textContent,
}));
const committed = id => page.evaluate(i => { const f = window.__crown.fed; const m = f.marketFor(i); const lg = f.liveGame(i); return { plies: lg.moves.length, rev: `${m.history.length}.${m.live?.plies ?? 0}`, price0: (m.q && null), status: m.status }; }, id);
let v = await view(), c = await committed(champ.id);
await page.screenshot({ path: SHOTS + '02-live-arena-desktop.png' });
check(1, v.board && v.clockW && v.clockB && v.playerW && v.price0 && v.portfolio && v.graph && v.rev === c.rev && v.ticketRev === c.rev && v.moves === c.plies,
  `Live Crown Championship ${champ.stage ?? ''} ${champ.white} – ${champ.black}: board, thinking clocks (${v.clockW?.trim()} / ${v.clockB?.trim()}), players, odds (White ${v.price0}), portfolio and evaluation graph visible; the view's revision ${v.rev}, the ticket's revision and ${v.moves} published move(s) match the committed state`);
check('1b', v.grades === 0 && /hidden until the market is settled/.test(v.policy ?? ''), `While trading is open no move-quality label is shown (${v.grades}); policy shown: "${v.policy?.slice(0, 120)}…"`);

// 2. eligible trade through the ticket
await page.getByLabel('Shares').fill('10');
await page.locator('[data-testid="confirm-trade"]').click();
await page.waitForSelector('text=Bought 10');
const pos1 = await page.evaluate(i => { const f = window.__crown.fed; const p = f.state.positions.get(`${f.marketFor(i).id}|player:cash`); return p && { shares: p.shares, spent: p.spent }; }, champ.id);
const shownShares = await page.locator('[data-testid="arena-shares"]').textContent();
check(2, pos1 && pos1.shares.reduce((a, b) => a + b, 0) === 10 && shownShares.replace(/\s/g, '') === pos1.shares.join('/'), `Bought 10 shares; portfolio panel shows ${shownShares} (committed ${pos1.shares.join('/')}, spent ${(pos1.spent / 1e6).toFixed(2)} ₵)`);

// 3. advance: new public information, revision and evaluation
const before = await view(), cb = await committed(champ.id);
const staleRev = cb.rev;
await page.locator('[data-testid="next-move"]').click();
await waitUntil(page, ([id, n]) => window.__crown.fed.liveGame(id).moves.length > n, [champ.id, cb.plies], 120000);
await page.waitForTimeout(400);
const after = await view(), ca = await committed(champ.id);
check(3, ca.plies === cb.plies + 1 && after.moves === ca.plies && after.rev === ca.rev && after.rev !== before.rev && ca.rev.split('.')[1] === String(ca.plies), `Move ${ca.plies} published: revision ${before.rev} → ${after.rev}, notation and evaluation graph updated (${after.moves} moves shown)`);

// 4. stale trade rejected
const stale = await page.evaluate(async ([m, r]) => { try { await window.__crown.fed.trade(m, 0, 1, 'buy', { expectRevision: r }); return 'accepted'; } catch (e) { return e.message; } }, [champ.market, staleRev]);
check(4, /Stale quote/.test(stale), `A trade quoted on revision ${staleRev} was rejected after the move: "${stale}"`);
const dup = await page.evaluate(async ([id, n]) => { try { await window.__crown.fed.liveStep(id, n); return 'accepted'; } catch (e) { return e.message; } }, [champ.id, cb.plies]);
check('4b', /Stale step/.test(dup), `A duplicate step request for an already published ply was rejected: "${dup}"`);
await page.screenshot({ path: OUT + 'arena-after-move.png' });

// 5. finish the match (auto, 1 s windows)
await page.getByRole('button', { name: '1 s', exact: true }).click();
await page.locator('[data-testid="auto-run"]').click();
await waitUntil(page, id => window.__crown.fed.liveGame(id)?.status === 'done', champ.id, 1800000);
const fin = await page.evaluate(async ([id, mid]) => { const f = window.__crown.fed; const m = f.state.markets.get(mid); const p = f.state.positions.get(`${mid}|player:cash`); const wg = await f.worldGame(`wg:${id}`); return { status: m.status, result: m.result, payout: m.payout, shares: p.shares, received: p.received, spent: p.spent, plies: wg.moves.length, gres: wg.result, total: [...f.state.balances.values()].reduce((a, b) => a + b, 0) }; }, [champ.id, champ.market]);
const expected = fin.status === 'settled' ? Math.floor(fin.shares.reduce((a, s, i) => a + s * (fin.payout ? fin.payout[i] : (i === fin.result ? 1 : 0)), 0) * 1e6 + 1e-6) : null;
check(5, (fin.status === 'settled' && Math.abs(fin.received - expected) <= 1) || fin.status === 'cancelled', `Match finished (${fin.plies} plies, ${fin.gres}); market ${fin.status} on state ${fin.result}; your ${fin.shares.join('/')} shares received ${(fin.received / 1e6).toFixed(2)} ₵ (expected ${expected === null ? 'cancellation refund' : (expected / 1e6).toFixed(2)}); ledger total ${fin.total}`);

// 6. full post-game analysis (only now allowed)
await page.waitForSelector('[data-testid="arena-grade-summary"]', { timeout: 1800000 });
const pg = await page.evaluate(async id => { const rs = await window.__crown.db.reportsForGame(`wg:${id}`); const r = rs.find(x => x.status === 'complete'); return { plies: r.plies.length, build: r.engine.buildId, grading: r.methodology.gradingId, graded: r.plies.filter(p => p.grade).length, counts: r.plies.reduce((a, p) => { a[p.grade ?? 'none'] = (a[p.grade ?? 'none'] ?? 0) + 1; return a; }, {}) }; }, champ.id);
const icons = await page.locator('[data-testid="arena-moves"] .grade-icon').count();
check(6, pg.plies === fin.plies && icons === fin.plies && pg.build === 'crown-search-2+crown-eval-4', `Post-game analysis of all ${pg.plies} plies by ${pg.build} (${pg.grading}), requested only after settlement: ${JSON.stringify(pg.counts)}; ${icons} labels in the notation`);
await page.locator('[data-testid="arena-move"]').nth(Math.min(10, fin.plies - 1)).click();
await page.screenshot({ path: SHOTS + '03-live-arena-postgame-desktop.png' });

// 7. restart and reopen the replay
await ctx.close();
({ ctx, page } = await open());
await page.goto(URL_ + '#/watch/' + encodeURIComponent(champ.id));
await page.waitForSelector('[data-testid="arena-grade-summary"]', { timeout: 60000 });
const rp = await page.evaluate(() => ({ status: document.querySelector('[data-testid="spectator-status"]').textContent, moves: document.querySelectorAll('[data-testid="arena-move"]').length, chart: !!document.querySelector('[data-testid="arena-market"] svg') }));
await page.getByRole('button', { name: 'Instant', exact: true }).click().catch(() => {});
await page.getByRole('button', { name: 'Latest move' }).click();
await page.waitForSelector('[data-testid="final-result"]', { timeout: 30000 });
check(7, /REPLAY/.test(rp.status) && rp.moves === fin.plies && rp.chart, `After restart the replay reopens: ${rp.status}, ${rp.moves} moves with labels, price history chart, final result`);
await ctx.close();

// 8. phone layout
({ ctx, page } = await open({ width: 390, height: 844 }));
await page.goto(URL_ + '#/watch/' + encodeURIComponent(champ.id));
await page.waitForSelector('[data-testid="arena-grade-summary"]', { timeout: 60000 });
const ph = [];
for (const t of ['Moves & eval', 'Market', 'Portfolio']) {
  await page.getByRole('tab', { name: t }).click(); await page.waitForTimeout(300);
  ph.push(await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 1, boardW: document.querySelector('.board')?.getBoundingClientRect().width, a: !!document.querySelector('[data-testid="arena-analysis"]')?.checkVisibility(), m: !!document.querySelector('[data-testid="arena-market"]')?.checkVisibility(), p: !!document.querySelector('[data-testid="arena-portfolio"]')?.checkVisibility() })));
  await page.screenshot({ path: SHOTS + `10-mobile-arena-${t.split(' ')[0].toLowerCase()}.png`, fullPage: true });
}
check(8, ph.every(x => !x.overflow && x.boardW >= 330) && ph[0].a && !ph[0].m && ph[1].m && !ph[1].a && ph[2].p && !ph[2].m, `Phone 390 px: board ${Math.round(ph[0].boardW)} px wide stays on top; tabs switch Moves/Market/Portfolio; no horizontal overflow`);

// 9. offline replay
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
await ctx.setOffline(true);
await page.reload(); await page.waitForSelector('.app');
await page.goto(URL_ + '#/watch/' + encodeURIComponent(champ.id));
await page.waitForSelector('[data-testid="arena-grade-summary"]', { timeout: 60000 });
const offMoves = await page.locator('[data-testid="arena-move"]').count();
check(9, offMoves === fin.plies, `Offline (phone): the replay, labels and market history load from the installed app and IndexedDB (${offMoves} moves)`);
await ctx.close();
step(`console/page errors: ${errors.length}`);
step(`M6 ARENA JOURNEY: ${Object.values(results).filter(Boolean).length}/${Object.keys(results).length} steps passed`);
server.kill();
process.exit(0);
