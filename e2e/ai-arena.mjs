/**
 * v1.1 AI vs AI Match Arena journey (package Z, docs/AI_ARENA.md), real UI in Chromium against a production build:
 * Dashboard → "Watch AI Match" → hub (custom exhibition, live official, upcoming, replays, search) → Start Custom
 * Exhibition with the new filters (style, region, title; rating band) → 120+90 display clock, AI thinking budget
 * shown separately, Fast speed, practice market → trade with sandbox money → pause (no moves) / resume → restart
 * (same seed: new record, old practice market VOID) → practice market on the new game → Skip to Result → settled
 * exactly once → official state unchanged (ratings, records, standings, official balances and markets, games,
 * reports) → open a live official match from the hub (featured game started in play) with odds, cutoff, rules and
 * the trade ticket on one screen → open a completed replay from the hub → 375 and 390 px phones: hub, picker and
 * match tabs without horizontal overflow; the official match's Trade tab is reachable without leaving the match.
 * The live scheduler is switched off for the journey (setup, not under test).
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4484 &  node e2e/ai-arena.mjs http://127.0.0.1:4484/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4484/';
const OUT = new URL('./artifacts/ai-arena/', import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); writeFileSync(OUT + 'journey-log.txt', log.join('\n') + '\n'); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };

const ctx = await chromium.launchPersistentContext(OUT + 'profile', { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => { errors.push(String(e).slice(0, 300)); step('pageerror: ' + String(e).slice(0, 300)); });
page.on('console', m => { if (m.type() === 'error') { errors.push(m.text().slice(0, 300)); step('console.error: ' + m.text().slice(0, 300)); } });
await page.goto(url);
await page.waitForFunction(() => window.__crown);
await page.evaluate(() => { const s = window.__crown; s.setLiveSettings({ ...s.liveSettings, mode: 'off' }); s.live?.pause('e2e'); });
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 120000 });
for (let i = 0; i < 4; i++) await page.locator('[data-testid="ceremony-continue"]').click({ timeout: 1500 }).catch(() => {});

const plies = () => page.evaluate(() => +(document.querySelector('[data-testid="exhibition"]')?.dataset.plies ?? -1));
const exState = () => page.evaluate(() => document.querySelector('[data-testid="exhibition"]')?.dataset.state);
const hashId = async () => decodeURIComponent((await page.evaluate(() => location.hash)).split('/')[2] ?? '');
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const snapshot = () => page.evaluate(async () => {
  const s = window.__crown, st = s.fed.state;
  const comps = [...st.competitors.values()].map(c => [c.id, c.rating, c.rd, c.stats.w, c.stats.d, c.stats.l, c.titles.length, c.fedTitle ?? null, c.earnings, c.history.length].join('|')).sort().join('\n');
  const balances = [...st.balances.entries()].filter(([a]) => !a.startsWith('sandbox:')).sort().map(e => e.join('=')).join(',');
  const markets = [...st.markets.values()].filter(m => !m.sandbox).map(m => JSON.stringify([m.id, m.status, m.q, m.history.length])).sort().join('\n');
  const rounds = JSON.stringify([...st.rounds.values()].map(r => r.fixtures.map(f => [f.id, f.result])));
  const enc = new TextEncoder();
  const h = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  const d = await s.db.dump();
  return { comps: await h(comps), balances: await h(balances), markets: await h(markets), rounds: await h(rounds), world: JSON.stringify([st.world.season, st.world.round]),
    games: d.games.length, reports: d.reports.length, ratingEvents: d.ratingEvents.length, rapid: JSON.stringify(await s.db.ratingState('rapid')), worldGames: d.federation.worldGames.length };
});
const before = await snapshot();
step('before: ' + JSON.stringify(before));

// 1. hub from the Dashboard
await page.goto(url + '#/dashboard');
await page.locator('[data-testid="dash-open-arena"]').click();
await page.waitForSelector('[data-testid="arena-hub"]');
const sections = await page.$$eval('[data-testid^="hub-"]', els => [...new Set(els.map(e => e.dataset.testid))]);
check(1, ['hub-exhibition', 'hub-live', 'hub-upcoming', 'hub-replays', 'hub-search'].every(x => sections.includes(x)), `Dashboard → AI vs AI Arena hub with its five sections (${sections.filter(x => !x.includes('row')).join(', ')})`);
check(2, await page.locator('[data-testid="hub-upcoming"] [data-testid="hub-official"]').count() > 0, 'Upcoming featured Federation matches are listed with their markets');
await page.screenshot({ path: OUT + 'desktop-hub.png', fullPage: true });

// 2. custom exhibition with filters
await page.locator('[data-testid="hub-start-exhibition"]').click();
await page.waitForSelector('[data-testid="exhibition-home"]');
const count = side => page.locator(`[data-testid="exh-count-${side}"]`).innerText().then(t => +t.replace(/[^0-9]/g, ''));
const all = await count('white');
await page.locator('[data-testid="exh-region-white"]').selectOption({ index: 2 });
await page.waitForTimeout(300);
const byRegion = await count('white');
const styleOpt = await page.$$eval('[data-testid="exh-style-white"] option', os => os.map(o => o.value).filter(Boolean)[1]);
await page.locator('[data-testid="exh-style-white"]').selectOption(styleOpt);
await page.waitForTimeout(300);
const byStyle = await count('white');
await page.locator('[data-testid="exh-title-white"]').selectOption('any');
await page.waitForTimeout(300);
const titled = await count('white');
const titledTruth = await page.evaluate(([r, sty]) => [...window.__crown.fed.state.competitors.values()].filter(c => c.status === 'active' && c.region === r && c.fedTitle && (c.style === sty)).length, [1, styleOpt]);
await page.locator('[data-testid="exh-title-white"]').selectOption('');
await page.waitForTimeout(300);
const rowFacts = await page.$$eval('[data-testid="exh-row-white"]', els => els.map(e => e.dataset.id));
const okRows = await page.evaluate(([ids, sty]) => ids.every(id => { const c = window.__crown.fed.state.competitors.get(id); return c.region === 1 && c.style === sty; }), [rowFacts, styleOpt]);
check(3, all > 10000 / 5 && byRegion < all && byStyle <= byRegion && byStyle > 0 && titled === titledTruth && okRows, `Filters: all ${all} → region ${byRegion} → style ${styleOpt} ${byStyle} → titled ${titled} (truth ${titledTruth}); listed rows match`);
await page.locator('[data-testid="exh-row-white"]').first().click();
await page.locator('[data-testid="exh-band-black"]').selectOption({ index: 6 });
await page.locator('[data-testid="exh-row-black"]:not([disabled])').first().click();
await page.locator('[data-testid="exh-tc"]').selectOption('120+90');
await page.locator('[data-testid="exh-speed"]').selectOption({ label: 'Fast' });
await page.locator('[data-testid="exh-practice-market"]').check();
const budget = await page.locator('[data-testid="exh-budget"]').innerText();
const note = await page.locator('[data-testid="exh-clock-note"]').innerText();
check(4, /White .*AI thinking budget: up to [\d.]+ s per move/.test(budget) && /Black .*AI thinking budget/.test(budget) && /display and accounting only/.test(note), `Budget shown apart from the 120+90 display clock: ${budget.replace(/\n/g, ' | ')}`);
await page.screenshot({ path: OUT + 'desktop-picker.png', fullPage: true });
await page.locator('[data-testid="exh-start"]').click();
await page.waitForSelector('[data-testid="exhibition"]');
const ex1 = await hashId();
await page.waitForFunction(() => +document.querySelector('[data-testid="exhibition"]').dataset.plies >= 2, null, { timeout: 60000 });
const clockW = await page.locator('[data-testid="exh-clock-white"]').innerText();
const budgetLine = await page.locator('[data-testid="exh-budget-line-white"]').innerText();
check(5, /^(2:00:\d\d|1:59:\d\d|2:0\d:\d\d)$/.test(clockW.trim()) && /AI thinking budget/.test(budgetLine), `120+90 display clock ${clockW.trim()} while the engines keep their own budget (${budgetLine})`);
const m1 = await page.evaluate(id => window.__crown.fed.exhibitionMarketFor(id)?.status, ex1);
check(6, m1 === 'open' && await page.locator('[data-testid="exh-market"][data-status="open"]').count() === 1, `Practice market open: ${m1}`);
// a sandbox trade
const sb0 = await page.evaluate(() => window.__crown.fed.sandboxBalance());
const cash0 = await page.evaluate(() => window.__crown.fed.balance('player:cash'));
await page.locator('[data-testid="exh-pause"]').click();
await page.waitForFunction(() => document.querySelector('[data-testid="exhibition"]').dataset.state === 'paused');
await page.waitForFunction(() => { const e = document.querySelector('[data-testid="exh-market"]'); return e && +e.dataset.plies === +document.querySelector('[data-testid="exhibition"]').dataset.plies; }, null, { timeout: 10000 });
await page.locator('[data-testid="exh-trade"]').click();
await page.waitForFunction(() => /\d+ \/ \d+ \/ \d+/.test(document.querySelector('[data-testid="exh-shares-held"]')?.textContent ?? ''), null, { timeout: 10000 });
const sb1 = await page.evaluate(() => window.__crown.fed.sandboxBalance());
const offBal = await page.evaluate(() => window.__crown.fed.balance('player:cash'));
check(7, sb1 < sb0 && offBal === cash0, `Practice trade paid ${(sb0 - sb1) / 1e6} sandbox dollars; official cash ${offBal / 1e6}`);
// pause: no moves; resume: moves
const p1 = await plies();
await page.waitForTimeout(2500);
const p2 = await plies();
await page.locator('[data-testid="exh-pause"]').click();
await page.waitForFunction(n => +document.querySelector('[data-testid="exhibition"]').dataset.plies > n, p2, { timeout: 60000 });
check(8, p1 === p2 && (await plies()) > p2, `Paused at ${p1} (still ${p2} after 2.5 s); resumed to ${await plies()}`);
await page.screenshot({ path: OUT + 'desktop-match.png', fullPage: true });
// 3. restart, same seed
await page.locator('[data-testid="exh-restart"]').click();
await page.locator('[data-testid="exh-restart-same"]').click();
await page.waitForFunction(old => !location.hash.includes(encodeURIComponent(old)) && !!document.querySelector('[data-testid="exhibition"]'), ex1, { timeout: 20000 });
const ex2 = await hashId();
const rs = await page.evaluate(async ([a, b]) => { const s = window.__crown; const o = await s.db.getMeta(a), n = await s.db.getMeta(b); const m = s.fed.exhibitionMarketFor(a); return { oldAs: o.restartedAs, seedSame: o.seed === n.seed, of: n.restartOf, tc: n.timeControl?.id, market: m?.status, voidWhy: m?.ref?.void }; }, [ex1, ex2]);
check(9, rs.oldAs === ex2 && rs.seedSame && rs.of?.seed === 'same' && rs.tc === '120+90' && rs.market === 'cancelled' && rs.voidWhy === 'restarted', `Restart (same seed) = new record ${ex2}; old kept and marked; old practice market VOID: ${JSON.stringify(rs)}`);
// practice market on the new game, then skip to the result
await page.locator('[data-testid="exh-pause"]').click().catch(() => {});
await page.waitForFunction(() => document.querySelector('[data-testid="exhibition"]').dataset.state === 'paused', null, { timeout: 20000 }).catch(() => {});
await page.locator('[data-testid="exh-market-open"]').click();
await page.waitForSelector('[data-testid="exh-market"][data-status="open"]');
await page.waitForFunction(() => { const e = document.querySelector('[data-testid="exh-market"]'); return e && +e.dataset.plies === +document.querySelector('[data-testid="exhibition"]').dataset.plies; }, null, { timeout: 10000 });
await page.locator('[data-testid="exh-trade"]').click();
await page.waitForFunction(() => /\d+ \/ \d+ \/ \d+/.test(document.querySelector('[data-testid="exh-shares-held"]')?.textContent ?? ''), null, { timeout: 10000 });
await page.locator('[data-testid="exh-skip"]').click();
await page.waitForFunction(() => document.querySelector('[data-testid="exhibition"]').dataset.state === 'finished', null, { timeout: 400000 });
await page.waitForFunction(id => ['settled', 'cancelled'].includes(window.__crown.fed.exhibitionMarketFor(id)?.status), ex2, { timeout: 30000 });
const fin = await page.evaluate(async id => {
  const s = window.__crown; const m = s.fed.exhibitionMarketFor(id); const g = await s.db.getMeta(id);
  const j = (await s.db.dump()).federation.journal.filter(x => x.id === `settle:${m.id}`);
  return { status: m.status, result: g.result, termination: g.termination, settleJournals: j.length, sandboxOnly: j.every(x => x.lines.every(l => l.account.startsWith('sandbox:'))) };
}, ex2);
const shown = await page.locator('[data-testid="exh-market-status"]').innerText();
check(10, (fin.status === 'settled' || (fin.status === 'cancelled' && fin.termination === 'playing-limit')) && fin.settleJournals === 1 && fin.sandboxOnly && /Settled|Cancel|void/i.test(shown), `Skip to Result ${fin.result} (${fin.termination}); practice market ${fin.status} exactly once (sandbox-only journal): "${shown}"`);
await page.screenshot({ path: OUT + 'desktop-settled.png', fullPage: true });
const after = await snapshot();
step('after: ' + JSON.stringify(after));
check(11, JSON.stringify(after) === JSON.stringify(before), 'Ratings/RD, records, titles, earnings, standings, official balances and markets, world cursor, official games, reports and rating events unchanged');

// 4. completed replay from the hub
await page.goto(url + '#/arena');
await page.waitForSelector('[data-testid="hub-replay"]');
await page.locator(`[data-testid="hub-replay"][data-id="${ex2}"] button`).click();
await page.waitForSelector('[data-testid="exhibition"][data-state="finished"]');
check(12, (await hashId()) === ex2, 'A completed exhibition replay opens from the hub');

// 5. a live official match from the hub (featured game started in play: its official market stays open between moves)
await page.goto(url + '#/arena');
const fx = await page.locator('[data-testid="hub-upcoming"] [data-testid="hub-official"]').filter({ has: page.locator('[data-testid="hub-trade"]') }).first().getAttribute('data-fixture');
await page.locator(`[data-testid="hub-upcoming"] [data-testid="hub-official"][data-fixture="${fx}"] [data-testid="hub-watch"]`).click();
await page.waitForSelector('[data-testid="arena"]');
await page.locator('[data-testid="start-inplay"]').click();
await page.waitForSelector('[data-testid="inplay"]');
await page.goto(url + '#/arena');
await page.waitForSelector(`[data-testid="hub-live"] [data-testid="hub-official"][data-fixture="${fx}"]`);
await page.locator(`[data-testid="hub-live"] [data-testid="hub-official"][data-fixture="${fx}"] [data-testid="hub-watch"]`).click();
await page.waitForSelector('[data-testid="arena"] [data-testid="ticket"]');
const one = await page.evaluate(() => ['live-price-0', 'arena-cutoff', 'arena-rules', 'ticket', 'arena-portfolio', 'think-white', 'arena-forecast', 'arena-eval-graph'].filter(t => !document.querySelector(`[data-testid="${t}"]`)));
check(13, one.length === 0, `Live official match from the hub: odds, cutoff, rules, ticket (fees, payout), position, thinking time and forecast on one desktop screen${one.length ? ' — missing ' + one.join(', ') : ''}`);
await page.screenshot({ path: OUT + 'desktop-official.png', fullPage: true });

// 6. phones
for (const W of [375, 390]) {
  await page.setViewportSize({ width: W, height: W === 375 ? 812 : 844 });
  await page.goto(url + '#/arena'); await page.waitForSelector('[data-testid="arena-hub"]');
  const o1 = await overflow();
  await page.screenshot({ path: OUT + `phone-${W}-hub.png`, fullPage: true });
  await page.goto(url + '#/exhibition'); await page.waitForSelector('[data-testid="exhibition-home"]');
  const o2 = await overflow();
  await page.goto(url + '#/exhibition/' + encodeURIComponent(ex2)); await page.waitForSelector('[data-testid="exhibition"]');
  const tabs = await page.$$eval('[role="tab"]', ts => ts.map(t => t.textContent));
  await page.getByRole('tab', { name: 'Market' }).click();
  const o3 = await overflow();
  const mk = await page.locator('[data-testid="exh-market"]').isVisible();
  await page.screenshot({ path: OUT + `phone-${W}-exhibition-market.png`, fullPage: true });
  await page.goto(url + '#/watch/' + encodeURIComponent(fx)); await page.waitForSelector('[data-testid="arena"]');
  await page.getByRole('tab', { name: 'Trade' }).click();
  const tk = await page.locator('[data-testid="ticket"]').isVisible() && await page.locator('[data-testid="arena-cutoff"]').isVisible();
  const o4 = await overflow();
  await page.screenshot({ path: OUT + `phone-${W}-official-trade.png`, fullPage: true });
  check(14 + (W === 390 ? 1 : 0), o1 <= 0 && o2 <= 0 && o3 <= 0 && o4 <= 0 && mk && tk && ['Board', 'Moves', 'Study', 'Market'].every(t => tabs.includes(t)), `${W} px: hub ${o1}, picker ${o2}, exhibition market tab ${o3} (tabs ${tabs.join('·')}), official Trade tab in the match ${o4}; overflow ≤ 0`);
}
check(16, errors.length === 0, `No page errors (${errors.length})`);
await ctx.close();
step(failed ? `FAILED ${failed}` : 'ALL PASS');
process.exit(failed ? 1 : 0);
