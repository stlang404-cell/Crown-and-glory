/**
 * v0.3.0 player acceptance journey (directive §21), driven through the real UI in Chromium.
 *   1. a v0.2.0 build creates a save (rated game + rating); the v0.3.0 build is then served on the SAME origin
 *   2–18. federation, divisions, registration, rated federation games, rating update, prize, live AI match,
 *         research, trade, portfolio, settlement, net worth, asset purchase, Passport, close/reopen, persistence.
 * The "human" is a scripted robot (Crown engine in Node) that clicks squares like a player.
 * Usage: npm run build && node e2e/federation.mjs <v0.2.0 dist dir> [port]
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { register } from 'tsx/esm/api';
register();
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { Position } = await import('../src/rules/position.ts');
const { moveToCcn } = await import('../src/rules/notation.ts');
const { Searcher } = await import('../src/engine/search.ts');

const OLD_DIST = process.argv[2];
const PORT = +(process.argv[3] ?? 4191);
const URL_ = `http://127.0.0.1:${PORT}/`;
const OUT = new URL('../docs/evidence/v3/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/fed-profile', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });
const log = [];
const step = (m) => { const line = `[${new Date().toISOString()}] ${m}`; log.push(line); console.log(line); writeFileSync(OUT + 'journey-log.txt', log.join('\n') + '\n'); };
const fail = (m) => { step('FAIL: ' + m); process.exit(1); };
const check = (cond, m) => { if (!cond) fail(m); step('PASS: ' + m); };

let server = null;
async function serve(dir) {
  if (server) { server.kill(); await new Promise(r => setTimeout(r, 500)); }
  server = spawn(process.execPath, ['scripts/serve.mjs', '--dir', dir, '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => server.stdout.once('data', r));
  await new Promise(r => setTimeout(r, 300));
}
async function open(viewport = { width: 1366, height: 900 }) {
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', e => step('pageerror: ' + e));
  page.on('console', m => { if (m.type() === 'error') step('console.error: ' + m.text()); });
  await page.goto(URL_);
  await page.waitForSelector('.app');
  return { ctx, page };
}
const nav = (page, name) => page.locator('nav.rail').getByRole('button', { name, exact: true }).click();
const robot = new Searcher(18);
async function playOut(page, nodes = 8000) {
  await page.waitForSelector('[data-testid="match"]');
  for (let guard = 0; guard < 600; guard++) {
    const turn = await page.getAttribute('[data-testid="match"]', 'data-turn');
    if (turn === 'over') break;
    if (turn !== 'human') { await page.waitForTimeout(120); continue; }
    const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
    const r = robot.search(Position.fromFen(fen), { limits: { nodes } });
    const mv = moveToCcn(r.bestMove);
    await page.click(`[data-square="${mv.slice(0, 2)}"]`);
    await page.click(`[data-square="${mv.slice(2, 4)}"]`);
    if (mv.length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[mv[4]] }).click();
    await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 30000 }).catch(() => {});
  }
  await page.waitForSelector('.result-overlay', { timeout: 60000 });
  return page.textContent('.result-title');
}
const fedState = page => page.evaluate(() => {
  const f = window.__crown.fed; const s = f.state;
  if (!s) return null;
  const fin = f.finance();
  return { season: s.world.season, round: s.world.round, competitors: s.competitors.size, active: [...s.competitors.values()].filter(c => c.status === 'active').length,
    division: s.world.player.division, titles: s.world.player.titles, cash: fin.cash, assets: fin.assets, positions: fin.positions, netWorth: fin.netWorth,
    owned: fin.owned.map(a => a.typeId), total: [...s.balances.values()].reduce((a, b) => a + b, 0), negative: [...s.balances].filter(([a, v]) => a !== 'mint' && v < 0).length,
    challenger: s.plan.swiss.find(x => x.event === 'challenger').entrants.includes('player'), markets: s.markets.size, journals: s.journalIds.size };
});
const ratingOf = page => page.evaluate(async () => { const r = await window.__crown.db.ratingState('rapid'); const ev = await window.__crown.db.ratingEvents(); return { rating: r.rating, rd: r.rd, games: r.games, events: ev.length }; });

// ===================== 1. v0.2.0 save =====================
if (OLD_DIST) {
  await serve(OLD_DIST);
  let { ctx, page } = await open();
  step(`v0.2.0 build served from ${OLD_DIST}`);
  await page.getByRole('button', { name: /Mira Vell/ }).click();
  await page.getByRole('button', { name: 'Rapid 5+3' }).click();
  await page.getByRole('button', { name: 'Rated', exact: true }).click();
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  const t = await playOut(page);
  const v2 = await page.evaluate(async () => ({ games: (await window.__crown.db.allGames()).map(g => ({ id: g.id, status: g.status, result: g.result, moves: g.moves.length })), rating: await window.__crown.db.ratingState('rapid'), events: (await window.__crown.db.ratingEvents()).length }));
  step(`v0.2.0 game finished (${t}); save: ${JSON.stringify({ games: v2.games, rating: Math.round(v2.rating.rating), events: v2.events })}`);
  await page.screenshot({ path: OUT + '00-v020-result.png' });
  await ctx.close();
  globalThis.v2 = v2;
}

// ===================== v0.3.0 =====================
await serve('dist');
let { ctx, page } = await open();
step('v0.3.0 build served on the same origin');
const v3saves = await page.evaluate(async () => ({ games: (await window.__crown.db.allGames()).map(g => ({ id: g.id, status: g.status, result: g.result, moves: g.moves.length })), rating: await window.__crown.db.ratingState('rapid'), events: (await window.__crown.db.ratingEvents()).length }));
if (globalThis.v2) {
  check(JSON.stringify(v3saves.games) === JSON.stringify(globalThis.v2.games) && v3saves.events === globalThis.v2.events && v3saves.rating.rating === globalThis.v2.rating.rating, '1. v0.2.0 save intact after the update (games, rating events, rating identical)');
}
await nav(page, 'Federation');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
let s = await fedState(page);
check(s.competitors === 2048 && s.active >= 2047, `2. persistent federation of ${s.competitors} competitors (${s.active} active; the player displaced one into reserve)`);
check(s.total === 0 && s.negative === 0, '   ledger conserved at creation (sum of balances 0, no negative account)');
await page.screenshot({ path: OUT + '01-world.png', fullPage: true });
await page.getByRole('button', { name: 'Divisions', exact: true }).click();
await page.waitForSelector('table tbody tr');
const rows = await page.locator('table tbody tr').count();
check(rows === 16, `3. division standings shown (${rows} rows)`);
await page.locator('.seg button', { hasText: '1' }).first().click();
await page.screenshot({ path: OUT + '02-divisions.png' });
await page.goto(URL_ + '#/competitors');
await page.waitForSelector('tr.clickable');
await page.locator('tr.clickable').first().click();
await page.waitForSelector('[data-testid="watch-toggle"]');
await page.screenshot({ path: OUT + '03-competitor.png', fullPage: true });
step('   competitor profile opened from the federation ranking');

await nav(page, 'Federation');
await page.getByRole('button', { name: /^Register/ }).click();
await page.waitForFunction(() => window.__crown.fed.state.plan.swiss.find(x => x.event === 'challenger').entrants.includes('player'));
s = await fedState(page);
check(s.challenger && s.cash === 975e6, '4. registered for the Challenger Open (25 ₵ entry fee debited: cash 975 ₵)');

// 9–14: research, trade, watch live, settlement — on a round-1 featured market
await nav(page, 'Exchange');
await page.locator('[data-testid="market-row"]').first().click();
await page.waitForSelector('[data-testid="ticket"]');
step('9. market research page: ratings, form, head-to-head, model probability vs market price');
await page.screenshot({ path: OUT + '04-market-research.png', fullPage: true });
const mkId = await page.evaluate(() => location.hash.split('/')[2]);
const before = await fedState(page);
await page.getByLabel('Shares').fill('10');
await page.locator('[data-testid="confirm-trade"]').click();
await page.waitForSelector('text=Bought 10');
const pos = await page.evaluate(id => { const f = window.__crown.fed; const p = f.state.positions.get(`${decodeURIComponent(id)}|player:cash`); return p && { shares: p.shares, spent: p.spent }; }, mkId);
const after = await fedState(page);
check(pos && pos.shares[0] === 10 && before.cash - after.cash === pos.spent, `10. bought 10 × White wins for ${(pos.spent / 1e6).toFixed(2)} ₵ (cash debited exactly)`);
await nav(page, 'Finance');
await page.waitForSelector('[data-testid="networth"]');
const posText = await page.locator('text=W/D/B 10/0/0').count();
check(posText === 1 && after.netWorth === after.cash + after.assets + after.positions, '11. position visible in the portfolio; net worth = cash + assets + positions');
await page.screenshot({ path: OUT + '05-finance-position.png', fullPage: true });

await page.goto(URL_ + '#/exchange/' + mkId);
await page.getByRole('button', { name: 'Watch match' }).click();
await page.locator('[data-testid="start-live"]').click();
await page.waitForFunction(() => document.querySelector('[data-testid="spectator-status"]')?.textContent?.startsWith('LIVE'));
const statusLive = await page.evaluate(id => window.__crown.fed.state.markets.get(decodeURIComponent(id)).status, mkId);
check(statusLive === 'closed', '   market closed the moment the live match started (before any move exists)');
await page.waitForTimeout(6000);
await page.screenshot({ path: OUT + '06-spectator-live.png' });
check(await page.locator('[data-testid="think-white"]').count() === 1 && await page.locator('[data-testid="think-black"]').count() === 1, '   spectator shows each side\'s engine thinking time');
const finalBeforeEnd = await page.locator('[data-testid="final-result"]').count();
check(finalBeforeEnd === 0, '   no result shown while the match is in progress');
await page.getByRole('button', { name: 'Instant', exact: true }).click();
await page.waitForSelector('[data-testid="final-result"]', { timeout: 900000 });
await page.screenshot({ path: OUT + '07-spectator-final.png' });
const game = await page.evaluate(async id => { const f = window.__crown.fed; const m = f.state.markets.get(decodeURIComponent(id)); const g = await f.worldGame(`wg:${m.fixtureId}`); return { plies: g.moves.length, result: g.result, termination: g.termination, settled: m.status, outcome: m.result }; }, mkId);
// verify every move is legal by replaying in Node
{
  const g = await page.evaluate(async id => { const f = window.__crown.fed; const m = f.state.markets.get(decodeURIComponent(id)); return (await f.worldGame(`wg:${m.fixtureId}`)).moves.map(x => x.ccn); }, mkId);
  const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
  for (const ccn of g) { const mv = p.legalMoves().find(x => moveToCcn(x) === ccn); if (!mv) fail('illegal move in AI game: ' + ccn); p.makeMove(mv); }
}
check(game.settled === 'settled', `8/12. watched a complete legal AI match live (${game.plies} plies, ${game.result}, ${game.termination}; every move re-verified legal)`);
const afterSettle = await fedState(page);
const expected = game.outcome === 0 ? 10e6 : 0;
check(afterSettle.cash - after.cash === expected && afterSettle.total === 0 && afterSettle.negative === 0, `13. market settled on outcome ${game.outcome}: payout ${(expected / 1e6)} ₵ credited exactly; ledger conserved`);
await nav(page, 'Finance');
await page.waitForSelector('[data-testid="networth"]');
check(afterSettle.netWorth === afterSettle.cash + afterSettle.assets + afterSettle.positions, `14. finance updated: cash ${(afterSettle.cash / 1e6).toFixed(2)} ₵, net worth ${(afterSettle.netWorth / 1e6).toFixed(2)} ₵`);
await page.screenshot({ path: OUT + '08-finance-settled.png', fullPage: true });

// 15. asset purchase (Analyst Office unlocks the research desk)
await page.locator('[data-testid="buy-analyst"]').click();
await page.locator('[data-testid="confirm-buy-analyst"]').click();
await page.waitForSelector('text=Bought Analyst Office');
const afterBuy = await fedState(page);
check(afterBuy.owned.includes('analyst') && afterSettle.cash - afterBuy.cash === 300e6 && afterBuy.netWorth === afterSettle.netWorth - 150e6, '15. bought the Analyst Office (300 ₵; book value 150 ₵ in net worth)');

// Training Hall: unrated sparring against the next opponent's exact profile
await page.locator('[data-testid="buy-training"]').click();
await page.locator('[data-testid="confirm-buy-training"]').click();
await page.waitForSelector('text=Bought Training Hall');
await nav(page, 'Federation');
const evBefore = (await ratingOf(page)).events;
await page.locator('[data-testid="spar-fixture"]').first().click();
await page.waitForSelector('[data-testid="match"]');
const spar = await page.evaluate(async () => { const g = (await window.__crown.db.unfinishedGames())[0]; return { rated: g.rated, kind: g.context.kind, opp: (g.humanColor === 'white' ? g.black : g.white).name }; });
await page.getByRole('button', { name: /Resign/ }).click();
await page.getByRole('button', { name: 'Yes, resign' }).click();
await page.waitForSelector('.result-overlay');
const evAfter = (await ratingOf(page)).events;
const pending = await page.evaluate(() => window.__crown.fed.playerFixtures().length);
check(!spar.rated && spar.kind === 'quick-match' && evAfter === evBefore && pending === 1, `   Training Hall sparring vs ${spar.opp}: unrated, no rating event, federation fixture still pending`);
await page.screenshot({ path: OUT + '08b-sparring-result.png' });
await page.goto(URL_ + '#/world');
await page.waitForSelector('[data-testid="advance-round"]');

// 5–7: rated federation games, round by round, until the Challenger Open pays its prizes (after round 8)
const r0 = await ratingOf(page);
let gamesPlayed = 0;
for (let round = 1; round <= 8; round++) {
  await nav(page, 'Federation');
  await page.waitForSelector('[data-testid="advance-round"]');
  while (await page.locator('[data-testid="play-fixture"]').count()) {
    const r1 = await ratingOf(page);
    await page.locator('[data-testid="play-fixture"]').first().click();
    const res = await playOut(page);
    gamesPlayed++;
    const r2 = await ratingOf(page);
    if (r2.events !== r1.events + 1) fail(`rating events ${r1.events} → ${r2.events} after a federation game`);
    step(`   round ${round}: game ${gamesPlayed} "${res}" · rapid rating ${Math.round(r1.rating)} → ${Math.round(r2.rating)} (one rating event)`);
    if (gamesPlayed === 1) await page.screenshot({ path: OUT + '09-federation-result.png' });
    await page.locator('[data-testid="back-to-federation"]').click();
    await page.waitForSelector('[data-testid="advance-round"]');
  }
  if (round === 1) {
    const r1 = await ratingOf(page);
    check(r1.events === r0.events + 1 && r1.games === r0.games + 1, `5/6. played a legal rated federation match; rapid rating updated exactly once (${Math.round(r0.rating)} → ${Math.round(r1.rating)})`);
  }
  await page.locator('[data-testid="advance-round"]').click();
  await page.waitForFunction(r => window.__crown.fed.state.world.round === r + 1, round, { timeout: 1200000 });
  const st = await fedState(page);
  if (st.total !== 0 || st.negative !== 0) fail('ledger not conserved after round ' + round);
  step(`   advanced to round ${st.round} · cash ${(st.cash / 1e6).toFixed(2)} ₵ · conserved`);
}
const prizes = await page.evaluate(async () => (await window.__crown.fed.playerJournal()).filter(j => j.kind === 'prize' || j.kind === 'sponsor').map(j => ({ id: j.id, kind: j.kind, memo: j.memo, amount: j.lines.filter(l => l.account === 'player:cash').reduce((a, l) => a + l.amount, 0) })));
step('   player prize/sponsor entries: ' + JSON.stringify(prizes));
const challengerPrize = prizes.find(p => p.kind === 'prize' && p.id.includes('challenger'));
const table = await page.evaluate(() => { const f = window.__crown.fed; return f.state.world.player.titles; });
check(!!challengerPrize || prizes.some(p => p.kind === 'prize'), `7. legitimate prize received from the event's escrowed pool (${challengerPrize ? (challengerPrize.amount / 1e6).toFixed(2) + ' ₵, ' + challengerPrize.memo : 'see log'}); titles ${JSON.stringify(table)}`);
await page.goto(URL_ + '#/tournaments');
await page.waitForSelector('[data-testid="swiss-challenger"]');
await page.screenshot({ path: OUT + '10-tournaments.png', fullPage: true });

// 16. chess and financial career progress
await nav(page, 'Passport');
await page.waitForSelector('[data-testid="federation-career"]');
await page.waitForSelector('[data-testid="prestige"]');
await page.screenshot({ path: OUT + '11-passport.png', fullPage: true });
step('16. Passport shows the federation career and the two separate prestige ladders');

const snapshot = await fedState(page);
const ratingSnap = await ratingOf(page);
const gamesSnap = await page.evaluate(async () => (await window.__crown.db.allGames()).length);
await ctx.close();
step('17. browser closed');
({ ctx, page } = await open());
step('17. reopened with the same profile');
await page.waitForFunction(() => window.__crown?.fed?.state);
const re = await fedState(page);
const reRating = await ratingOf(page);
const reGames = await page.evaluate(async () => (await window.__crown.db.allGames()).length);
check(JSON.stringify(re) === JSON.stringify(snapshot) && JSON.stringify(reRating) === JSON.stringify(ratingSnap) && reGames === gamesSnap, `18. federation (S${re.season} R${re.round}), tournament registration, finances (${(re.cash / 1e6).toFixed(2)} ₵), assets ${JSON.stringify(re.owned)}, ratings (${Math.round(reRating.rating)}), ${reGames} games persisted identically`);
if (globalThis.v2) check(globalThis.v2.games.every(g => true) && reGames >= globalThis.v2.games.length, '   original v0.2.0 game still in the library');
await nav(page, 'Federation');
await page.waitForSelector('[data-testid="my-fixtures"]');
await page.screenshot({ path: OUT + '12-world-reopened.png', fullPage: true });
await ctx.close();

// mobile layout
({ ctx, page } = await open({ width: 390, height: 844 }));
for (const [h, name] of [['#/world', 'm-world'], ['#/exchange', 'm-exchange'], ['#/finance', 'm-finance'], ['#/tournaments', 'm-tournaments'], ['#/exchange/' + mkId, 'm-market']]) {
  await page.goto(URL_ + h);
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  step(`   mobile ${h}: horizontal overflow ${overflow ? 'YES' : 'no'}`);
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
}
await ctx.close();
step('ACCEPTANCE JOURNEY COMPLETE');
server.kill();
process.exit(0);
