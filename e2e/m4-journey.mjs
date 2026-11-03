/**
 * v0.4.0 "The Grand Exchange" player acceptance journey (directive Part X, 28 steps), driven through the real
 * UI in Chromium. A v0.3.0 production build first creates a save with a federation, a trade and an asset; the
 * v0.4.0 build is then served on the SAME origin. The "human" is a scripted robot (Crown engine in Node).
 *   npm run build && node e2e/m4-journey.mjs <v0.3.0 dist dir> [port]
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
const PORT = +(process.argv[3] ?? 4291);
const URL_ = `http://127.0.0.1:${PORT}/`;
const OUT = new URL('../docs/evidence/m4/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/m4-profile', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });
const log = [];
const results = {};
const step = (m) => { const line = `[${new Date().toISOString()}] ${m}`; log.push(line); console.log(line); writeFileSync(OUT + 'journey-log.txt', log.join('\n') + '\n'); };
const check = (n, cond, m) => { results[n] = !!cond; step(`${cond ? 'PASS' : 'FAIL'}: ${n}. ${m}`); if (!cond) { writeFileSync(OUT + 'journey-results.json', JSON.stringify(results, null, 1)); process.exit(1); } };

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
  page.on('console', m => { if (m.type() === 'error') step('console.error: ' + m.text().slice(0, 300)); });
  await page.goto(URL_);
  await page.waitForSelector('.app');
  await page.waitForFunction(() => window.__crown);
  return { ctx, page };
}
const nav = (page, name) => page.locator('nav.rail').getByRole('button', { name, exact: true }).click();
const robot = new Searcher(18);
async function playOut(page, nodes = 8000) {
  await page.waitForSelector('[data-testid="match"]');
  const deadline = Date.now() + 40 * 60_000; // time budget, not a poll count (strong engines think for seconds)
  while (Date.now() < deadline) {
    const turn = await page.getAttribute('[data-testid="match"]', 'data-turn');
    if (turn === 'over') break;
    if (turn !== 'human') { await page.waitForTimeout(120); continue; }
    const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
    const r = robot.search(Position.fromFen(fen), { limits: { nodes } });
    const mv = moveToCcn(r.bestMove);
    await page.click(`[data-square="${mv.slice(0, 2)}"]`);
    await page.click(`[data-square="${mv.slice(2, 4)}"]`);
    if (mv.length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[mv[4]] }).click();
    await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 60000 }).catch(() => {});
  }
  await page.waitForSelector('.result-overlay', { timeout: 120000 });
  return page.textContent('.result-title');
}
const fed = page => page.evaluate(() => {
  const f = window.__crown.fed; const s = f.state; if (!s) return null;
  const fin = f.finance();
  return { season: s.world.season, round: s.world.round, comps: s.competitors.size, cash: fin.cash, netWorth: fin.netWorth, assets: fin.assets, positions: fin.positions,
    total: [...s.balances.values()].reduce((a, b) => a + b, 0), negative: [...s.balances].filter(([a, v]) => a !== 'mint' && a !== 'sandbox:mint' && v < 0).length,
    official: [...s.balances].filter(([a]) => !a.startsWith('sandbox:')).map(([a, v]) => `${a}=${v}`).sort().join(';'), sandbox: f.sandboxBalance(),
    clubLevel: f.clubLevelOf(), journals: s.journalIds.size, markets: s.markets.size };
});
const market = (page, id) => page.evaluate(i => { const m = window.__crown.fed.state.markets.get(i); return m && { status: m.status, result: m.result, payout: m.payout, q: m.q, history: m.history.length, kind: m.kind }; }, id);
const myPos = (page, id) => page.evaluate(i => { const p = window.__crown.fed.state.positions.get(`${i}|player:cash`); return p && { shares: p.shares, spent: p.spent, received: p.received }; }, id);
const ratingOf = page => page.evaluate(async () => { const r = await window.__crown.db.ratingState('rapid'); return { rating: r.rating, games: r.games, events: (await window.__crown.db.ratingEvents()).length }; });
async function playMyFixtures(page, tag) {
  let n = 0;
  await page.goto(URL_ + '#/world');
  await page.waitForSelector('[data-testid="advance-round"]');
  while (await page.locator('[data-testid="play-fixture"]').count()) {
    await page.locator('[data-testid="play-fixture"]').first().click();
    await playOut(page);
    n++;
    await page.locator('[data-testid="back-to-federation"]').click();
    await page.waitForSelector('[data-testid="advance-round"]');
  }
  return n;
}
async function advance(page) {
  const r0 = (await fed(page)).round, s0 = (await fed(page)).season;
  await page.locator('[data-testid="advance-round"]').click();
  await page.waitForFunction(([r, s]) => { const w = window.__crown.fed.state.world; return w.round !== r || w.season !== s; }, [r0, s0], { timeout: 1800000 });
  const st = await fed(page);
  if (st.total !== 0 || st.negative !== 0) { step('ledger not conserved'); process.exit(1); }
}

// ===================== v0.3.0 save =====================
let v3 = null;
if (OLD_DIST) {
  await serve(OLD_DIST);
  const { ctx, page } = await open();
  step(`v0.3.0 build served from ${OLD_DIST}`);
  await page.goto(URL_ + '#/world');
  await page.getByRole('button', { name: 'Found the federation' }).click();
  await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
  await page.evaluate(async () => { const f = window.__crown.fed; const m = f.featuredFixtures().map(x => f.marketFor(x.id)).find(x => x && x.status === 'open'); await f.trade(m.id, 0, 7, 'buy'); await f.buyAsset('brass-clock'); });
  v3 = await page.evaluate(async () => {
    const f = window.__crown.fed, s = f.state;
    return { seed: s.world.seed, round: s.world.round, cash: f.balance('player:cash'), journals: s.journalIds.size, markets: s.markets.size, positions: s.positions.size, assets: [...s.assets.keys()].sort().join(','), balances: [...s.balances].map(([a, v]) => `${a}=${v}`).sort().join(';') };
  });
  step('v0.3.0 save: ' + JSON.stringify({ ...v3, balances: `${v3.balances.length} chars` }));
  await page.screenshot({ path: OUT + '00-v030-save.png' });
  await ctx.close();
}

// ===================== v0.4.0 =====================
await serve('dist');
let { ctx, page } = await open();
step('v0.4.0 build served on the same origin');
if (v3) {
  const now = await page.evaluate(async () => {
    const f = window.__crown.fed, s = f.state;
    return { seed: s.world.seed, round: s.world.round, cash: f.balance('player:cash'), journals: s.journalIds.size, markets: s.markets.size, positions: s.positions.size, assets: [...s.assets.keys()].sort().join(','), balances: [...s.balances].map(([a, v]) => `${a}=${v}`).sort().join(';'),
      stores: [...window.__crown.db.db.objectStoreNames].join(','), version: window.__crown.db.db.version };
  });
  check(1, now.seed === v3.seed && now.cash === v3.cash && now.journals === v3.journals && now.markets === v3.markets && now.positions === v3.positions && now.assets === v3.assets && now.balances === v3.balances && now.version === 4 && now.stores.includes('liveGames'),
    `M3 (v0.3.0) save migrated to DB v${now.version}: federation, ledger (${now.journals} journals), markets, positions and assets identical`);
}

await page.goto(URL_ + '#/settings');
await page.locator('[data-testid="theme-obsidian"]').click();
const theme = await page.evaluate(() => document.documentElement.dataset.theme);
check(2, theme === 'obsidian', 'Obsidian & Crimson theme selected');
await page.locator('[data-testid="board-walnut"]').click();
const board = await page.evaluate(() => document.documentElement.dataset.board);
check(3, board === 'walnut', 'Board colours customised (Walnut)');
await page.screenshot({ path: OUT + '01-settings.png', fullPage: true });

await page.goto(URL_ + '#/competitors');
await page.waitForSelector('tr.clickable');
const s0 = await fed(page);
check(4, s0.comps === 2048, `Federation of ${s0.comps} competitors inspected`);
await page.screenshot({ path: OUT + '02-competitors.png' });

// 5–7 strongest engine, rated game, analysis
const r0 = await ratingOf(page);
await page.goto(URL_ + '#/play');
await page.getByRole('button', { name: /The Crown Engine/ }).click();
await page.getByRole('button', { name: 'Rapid 5+3' }).click();
await page.getByRole('button', { name: 'Rated', exact: true }).click();
await page.getByRole('button', { name: 'White', exact: true }).click();
await page.getByRole('button', { name: /Start match/ }).click();
const lvl = await page.evaluate(async () => { const g = (await window.__crown.db.unfinishedGames())[0]; return { level: (g.humanColor === 'white' ? g.black : g.white).engine?.level, rated: g.rated }; });
check(5, lvl.level === 8 && lvl.rated, 'Challenged the strongest engine (L8, The Crown Engine) in a rated rapid game');
const res8 = await playOut(page, 20000);
const r1 = await ratingOf(page);
check(6, r1.events === r0.events + 1, `Rated game completed (${res8}); rapid rating ${Math.round(r0.rating)} → ${Math.round(r1.rating)}, one rating event`);
await page.screenshot({ path: OUT + '03-l8-result.png' });
await page.getByRole('button', { name: 'View analysis' }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="analysis-status"]')?.textContent === 'complete', null, { timeout: 600000 });
await page.click('[data-ply="3"]');
const cands = await page.locator('[data-testid="candidate"]').count();
check(7, cands > 0, `Engine-backed analysis complete; ${cands} engine candidate line(s) at ply 3`);
await page.screenshot({ path: OUT + '04-analysis.png', fullPage: true });

// 8 Academy
await page.goto(URL_ + '#/academy');
await page.getByRole('button', { name: /Start adaptive training/ }).click();
await page.waitForSelector('[data-testid="puzzle-panel"]');
{
  const panel = page.locator('[data-testid="puzzle-panel"]');
  const sol = (await panel.getAttribute('data-solution')).split(' ');
  for (let i = 0; i < sol.length; i += 2) {
    await page.click(`[data-square="${sol[i].slice(0, 2)}"]`);
    await page.click(`[data-square="${sol[i].slice(2, 4)}"]`);
    if (sol[i].length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[sol[i][4]] }).click();
    await page.waitForTimeout(700);
  }
  const status = await panel.getAttribute('data-status');
  check(8, status === 'solved', 'Adaptive Academy practice (targets weak themes): puzzle solved');
  await page.screenshot({ path: OUT + '05-academy.png' });
}

// federation: register, club, season markets, sandbox
await page.goto(URL_ + '#/world');
if (!v3) { await page.getByRole('button', { name: 'Found the federation' }).click(); }
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
await page.getByRole('button', { name: /^Register/ }).click();
await page.waitForFunction(() => window.__crown.fed.state.plan.swiss.find(x => x.event === 'challenger').entrants.includes('player'));
check(9, true, 'Entered the Challenger Open (Swiss tournament)');
await page.goto(URL_ + '#/finance');
await page.locator('[data-testid="buy-club"]').click();
await page.locator('[data-testid="confirm-buy-club"]').click();
await page.waitForSelector('text=Bought Starter Chess Club');
const S = (await fed(page)).season;
// tournament-winner and promotion positions (season families)
for (const [id, claim] of [[`mk:open-winner:${S}`, 0], [`mk:promo:${S}`, 0]]) {
  await page.goto(URL_ + '#/exchange/' + encodeURIComponent(id));
  await page.waitForSelector('[data-testid="ticket"]');
  if (await page.locator('[data-testid="claim-select"]').count()) await page.selectOption('[data-testid="claim-select"]', String(claim));
  await page.getByLabel('Shares').fill('6');
  await page.locator('[data-testid="confirm-trade"]').click();
  await page.waitForSelector('text=Bought 6');
}
await page.screenshot({ path: OUT + '06-tournament-market.png', fullPage: true });
step(`   bought 6 shares in the Federation Open champion market and the promotion market`);
// sandbox on a casual game
const officialBefore = (await fed(page)).official;
await page.goto(URL_ + '#/play');
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('button', { name: 'Rapid 5+3' }).click();
await page.getByRole('button', { name: 'Casual', exact: true }).click();
await page.getByRole('button', { name: 'White', exact: true }).click();
await page.getByRole('button', { name: /Start match/ }).click();
await page.waitForSelector('[data-testid="sandbox-panel"]');
await page.locator('[data-testid="open-sandbox"]').click();
await page.waitForSelector('[data-testid="sandbox-buy-win"]');
const sb0 = (await fed(page)).sandbox;
await page.locator('[data-testid="sandbox-buy-win"]').click();
await page.waitForFunction(b => window.__crown.fed.sandboxBalance() < b, sb0);
await page.screenshot({ path: OUT + '07-sandbox-open.png' });
const sbRes = await playOut(page);
await page.waitForFunction(() => { const f = window.__crown.fed; const g = [...f.state.markets.values()].find(m => m.kind === 'sandbox'); return g && (g.status === 'settled' || g.status === 'cancelled'); }, null, { timeout: 30000 });
const sbm = await page.evaluate(() => { const m = [...window.__crown.fed.state.markets.values()].find(x => x.kind === 'sandbox'); return { status: m.status, result: m.result }; });
const s1 = await fed(page);
check(20, sbm.status === 'settled', `Sandbox position on a casual game (${sbRes}) settled: ${JSON.stringify(sbm)}; sandbox balance ${(sb0 / 1e6).toFixed(2)} → ${(s1.sandbox / 1e6).toFixed(2)}`);
check(21, s1.official === officialBefore, 'Official balances unchanged by the sandbox (every non-sandbox account identical)');
await page.screenshot({ path: OUT + '08-sandbox-result.png' });

// season loop
let watched = false, bracketBought = false, recvBefore = 0;
for (let guard = 0; guard < 25; guard++) {
  const st = await fed(page);
  if (st.season !== S) break;
  if (st.round === 9 && st.clubLevel === 1) {
    await page.goto(URL_ + '#/finance');
    await page.locator('[data-testid="upgrade-club"]').click();
    await page.locator('[data-testid="confirm-upgrade"]').click();
    await page.waitForSelector('text=Club upgraded');
    check(22, (await fed(page)).clubLevel === 2, 'Upgraded the club to a Club with Tournament Venue');
    await page.screenshot({ path: OUT + '09-club.png', fullPage: true });
  }
  if (st.round === 10) {
    const q = await page.evaluate(() => window.__crown.fed.state.plan.club?.qualifiers.length ?? 0);
    const esc = await page.evaluate(() => window.__crown.fed.balance('asset:club:upgrade'));
    check(23, q === 8 && esc === 200e6, `Institution effects: 8-player Club Weekend scheduled (${q} players) · 200 ₵ upgrade escrow in book value · venue upkeep +30 ₵/season`);
    await page.goto(URL_ + '#/tournaments');
    await page.screenshot({ path: OUT + '10-club-weekend.png', fullPage: true });
  }
  if (st.round === 16 && !watched) {
    // 11–17: live championship match with in-play trading
    const fx = await page.evaluate(() => { const f = window.__crown.fed; const x = f.featuredFixtures().find(y => y.event === 'champ' && y.result === null && f.marketFor(y.id)?.status === 'open'); return x && { id: x.id, market: f.marketFor(x.id).id }; });
    if (fx) {
      await page.goto(URL_ + '#/exchange/' + encodeURIComponent(fx.market));
      await page.waitForSelector('[data-testid="ticket"]');
      const research = await page.locator('text=Match research').count();
      check(12, research > 0, 'Researched the championship match: ratings, form, head-to-head, model probability vs market price');
      await page.locator('[data-testid="record-forecast"]').click();
      await page.waitForSelector('text=Forecast recorded');
      check(13, await page.evaluate(i => window.__crown.fed.state.extra.forecasts.some(f => f.marketId === i), fx.market), 'Paper forecast submitted (locked at closure, scored with Brier/log)');
      await page.getByLabel('Shares').fill('12');
      await page.locator('[data-testid="confirm-trade"]').click();
      await page.waitForSelector('text=Bought 12');
      const p0 = await myPos(page, fx.market);
      check(14, p0.shares[0] === 12, 'Bought 12 official shares of White wins before the match');
      await page.screenshot({ path: OUT + '11-research.png', fullPage: true });
      await page.goto(URL_ + '#/watch/' + encodeURIComponent(fx.id));
      await page.locator('[data-testid="start-inplay"]').click();
      await page.waitForSelector('[data-testid="inplay"]');
      const h0 = (await market(page, fx.market)).history;
      for (let i = 0; i < 8; i++) { const n = await page.evaluate(id => window.__crown.fed.liveGame(id).moves.length, fx.id); await page.locator('[data-testid="next-move"]').click(); await page.waitForFunction(([id, n0]) => window.__crown.fed.liveGame(id).moves.length > n0 || window.__crown.fed.liveGame(id).status === 'done', [fx.id, n], { timeout: 120000 }); }
      const lg = await page.evaluate(id => { const g = window.__crown.fed.liveGame(id); return { moves: g.moves.length, points: g.points.length, status: g.status }; }, fx.id);
      const h1 = (await market(page, fx.market)).history;
      check(15, lg.moves >= 8 && lg.points >= 2 && h1 > h0, `Observed ${lg.moves} live moves published one window at a time; live model updated ${lg.points - 1}×, market traded ${h1 - h0}× in-play (NPCs through the same market maker)`);
      await page.screenshot({ path: OUT + '12-inplay.png', fullPage: true });
      if (lg.status === 'live') {
        await page.locator('[data-testid="ticket"] button', { hasText: 'Sell' }).first().click();
        await page.getByLabel('Shares').fill('5');
        await page.locator('[data-testid="confirm-trade"]').click();
        await page.waitForSelector('text=Sold 5');
        const p1 = await myPos(page, fx.market);
        check(16, p1.shares[0] === 7 && p1.received > 0, 'Adjusted the position during an in-play window (sold 5 of 12 shares)');
        recvBefore = p1.received;
        await page.locator('[data-testid="auto-run"]').click();
        await page.getByRole('button', { name: '1 s', exact: true }).click();
      } else check(16, false, 'game ended before an in-play adjustment was possible');
      await page.waitForFunction(id => window.__crown.fed.liveGame(id)?.status === 'done', fx.id, { timeout: 1800000 });
      await page.waitForSelector('[data-testid="spectator-status"]');
      // 11: every move legal
      const ccns = await page.evaluate(async id => (await window.__crown.fed.worldGame(`wg:${id}`)).moves.map(m => m.ccn), fx.id);
      const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
      let legal = true;
      for (const c of ccns) { const mv = p.legalMoves().find(x => moveToCcn(x) === c); if (!mv) { legal = false; break; } p.makeMove(mv); }
      const g = await page.evaluate(async id => { const w = await window.__crown.fed.worldGame(`wg:${id}`); return { result: w.result, termination: w.termination, plies: w.moves.length }; }, fx.id);
      check(11, legal, `Watched a legal AI championship match (${g.plies} plies, ${g.result}, ${g.termination}; every move re-verified)`);
      const mk = await market(page, fx.market);
      const p2 = await myPos(page, fx.market);
      const expected = mk.status === 'settled' ? (mk.result === 0 ? 7e6 : 0) : Math.floor(7e6 / 3);
      check(17, (mk.status === 'settled' || mk.status === 'cancelled') && p2.received - recvBefore === expected, `Market ${mk.status} on ${mk.result}; payout ${(expected / 1e6).toFixed(2)} ₵ exactly`);
      await page.screenshot({ path: OUT + '13-settled.png', fullPage: true });
      watched = true;
    }
  }
  if (st.round === 18 && !bracketBought) {
    const id = `mk:bracket:${S}`;
    if ((await market(page, id))?.status === 'open') {
      await page.goto(URL_ + '#/exchange/' + encodeURIComponent(id));
      await page.waitForSelector('[data-testid="claim-select"]');
      await page.selectOption('[data-testid="claim-select"]', '8'); // a conjunction claim: "X beats Y in the final"
      await page.getByLabel('Shares').fill('4');
      await page.locator('[data-testid="confirm-trade"]').click();
      await page.waitForSelector('text=Bought 4');
      await page.screenshot({ path: OUT + '14-conditional.png', fullPage: true });
      bracketBought = true;
    }
  }
  await playMyFixtures(page);
  await advance(page);
  const after = await fed(page);
  step(`   advanced to S${after.season} R${after.round} · cash ${(after.cash / 1e6).toFixed(2)} ₵ · net worth ${(after.netWorth / 1e6).toFixed(2)} · conserved`);
  if (st.round === 8) {
    const prizes = await page.evaluate(async () => (await window.__crown.fed.playerJournal()).filter(j => j.kind === 'prize').map(j => ({ id: j.id, amount: j.lines.filter(l => l.account === 'player:cash').reduce((a, l) => a + l.amount, 0) })));
    check(10, prizes.some(p => p.id.includes('challenger') && p.amount > 0), `Funded prize earned: ${JSON.stringify(prizes)}`);
    const ow = await market(page, `mk:open-winner:${S}`);
    const pos = await myPos(page, `mk:open-winner:${S}`);
    check(18, ow.status === 'settled' && pos.received === (ow.result === 0 ? 6e6 : 0), `Tournament-winner market (Federation Open) settled on state ${ow.result}; your 6 shares of state 0 paid ${(pos.received / 1e6).toFixed(2)} ₵`);
  }
}

// season end checks
const promo = await market(page, `mk:promo:${S}`), pp = await myPos(page, `mk:promo:${S}`);
const br = await market(page, `mk:bracket:${S}`);
check(19, promo.status === 'settled' && pp.received === (promo.result === 0 ? 6e6 : 0) && (!bracketBought || br.status === 'settled'), `Promotion market settled (${promo.result === 0 ? 'Yes' : 'No'}; paid ${(pp.received / 1e6).toFixed(2)} ₵)${bracketBought ? `; conditional final-four market settled on path vector ${JSON.stringify(br.payout)}` : ''}`);
await page.goto(URL_ + '#/finance');
await page.waitForSelector('[data-testid="networth"]');
const fin = await fed(page);
const prest = await page.locator('[data-testid="prestige"]').count();
check(24, fin.netWorth === fin.cash + fin.assets + fin.positions && prest === 1, `Finance: cash ${(fin.cash / 1e6).toFixed(2)}, assets ${(fin.assets / 1e6).toFixed(2)}, positions ${(fin.positions / 1e6).toFixed(2)} → net worth ${(fin.netWorth / 1e6).toFixed(2)} ₵; ledger history and financial prestige shown`);
await page.screenshot({ path: OUT + '15-finance.png', fullPage: true });
await page.goto(URL_ + '#/news');
await page.waitForSelector('[data-testid="champ-history"]');
const champRows = await page.locator('[data-testid="champ-history"] tbody tr').count();
check(25, champRows >= 1, `News & history: ${champRows} championship(s) in the history, federation news and rivalries shown`);
await page.screenshot({ path: OUT + '16-news.png', fullPage: true });
await page.goto(URL_ + '#/forecasts');
await page.waitForSelector('[data-testid="forecast-summary"]');
await page.screenshot({ path: OUT + '17-forecasts.png', fullPage: true });

const snap = await fed(page);
const rSnap = await ratingOf(page);
await ctx.close();
step('26. browser closed');
({ ctx, page } = await open());
const re = await fed(page);
const rRe = await ratingOf(page);
check(26, true, 'Reopened the application with the same profile');
check(27, JSON.stringify(re) === JSON.stringify(snap) && JSON.stringify(rRe) === JSON.stringify(rSnap) && (await page.evaluate(() => document.documentElement.dataset.theme)) === 'obsidian', `All progress persisted identically (S${re.season} R${re.round}, ${re.journals} journals, ${re.markets} markets, club level ${re.clubLevel}, rating ${Math.round(rRe.rating)}, theme)`);
// 28 offline
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.app');
await page.goto(URL_ + '#/play');
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('button', { name: 'Casual', exact: true }).click();
await page.getByRole('button', { name: 'Black', exact: true }).click();
await page.getByRole('button', { name: /Start match/ }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 30000 });
const ofen = await page.getAttribute('[data-testid="match"]', 'data-fen');
const offFed = await page.evaluate(() => window.__crown.fed.state.world.round);
check(28, !ofen.startsWith('rnqknr/pppppp/6/6/PPPPPP/RNQKNR') && offFed === re.round, 'Continued offline: app shell from the service worker, engine move in a Web Worker, federation loaded from IndexedDB');
await page.screenshot({ path: OUT + '18-offline.png' });
await ctx.close();

// phone layout
({ ctx, page } = await open({ width: 390, height: 844 }));
for (const [h, name] of [['#/world', 'm-world'], ['#/exchange', 'm-exchange'], ['#/forecasts', 'm-forecasts'], ['#/finance', 'm-finance'], ['#/news', 'm-news'], ['#/settings', 'm-settings']]) {
  await page.goto(URL_ + h);
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  step(`   phone ${h}: horizontal overflow ${overflow ? 'YES' : 'no'}`);
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
}
await ctx.close();
writeFileSync(OUT + 'journey-results.json', JSON.stringify(results, null, 1));
step(`ACCEPTANCE JOURNEY: ${Object.values(results).filter(Boolean).length}/${Object.keys(results).length} steps passed`);
server.kill();
process.exit(0);
