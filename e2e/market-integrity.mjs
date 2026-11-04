/**
 * v0.10 Crown Exchange through the real UI (docs/MARKET_INTEGRITY.md): found the Federation → open a featured match
 * market → the ticket previews the exact total and the position after the trade → buy (the committed cost equals the
 * previewed total) → Your Position shows cost basis, realised/unrealised P&L, at-risk and outcome scenarios → Close
 * Position with an exact-proceeds confirmation (all shares sold, realised = received − paid) → watch the market (the
 * watchlist survives a reload) → the over/under market page shows its definition and VOID terms → Finance portfolio and
 * the Forecasting League render → no page errors, no horizontal overflow at 390 px.
 *   node scripts/serve.mjs --dir dist --port 4412 &  node e2e/market-integrity.mjs http://127.0.0.1:4412/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4412/';
const ART = new URL('./artifacts/market-integrity/', import.meta.url).pathname;
const OUT = new URL('../docs/evidence/market-integrity/', import.meta.url).pathname;
rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true }); mkdirSync(OUT, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const errors = [];
const watch = p => { p.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); }); p.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); step('console.error ' + m.text()); } }); };
const money = t => Number(String(t).replace(/[^0-9.-]/g, ''));

let ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1366, height: 900 } });
let page = ctx.pages()[0] ?? await ctx.newPage();
watch(page);
await page.goto(url + '#/world'); await page.waitForFunction(() => window.__crown);
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
for (let i = 0; i < 6 && await page.locator('[data-testid="ceremony-continue"]').count(); i++) await page.locator('[data-testid="ceremony-continue"]').click();

// 1. a featured match market: four claims, exact preview
const ids = await page.evaluate(() => { const f = window.__crown.fed; const fx = f.featuredFixtures().find(x => f.marketFor(x.id)?.status === 'open'); return { m: `mk:${fx.id}`, len: `mk:len:${fx.id}` }; });
await page.evaluate(id => { location.hash = `#/exchange/${encodeURIComponent(id)}`; }, ids.m);
await page.waitForSelector('[data-testid="ticket-preview"]');
const claimsN = await page.evaluate(id => window.__crown.fed.state.markets.get(id).claims?.length, ids.m);
const preview = await page.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="ticket-preview"] tr')].map(r => r.innerText); return { pay: rows.find(r => /You pay/.test(r)), after: rows.find(r => /After this trade/.test(r)), button: document.querySelector('[data-testid="confirm-trade"]').textContent }; });
check(1, claimsN === 4 && /You pay/.test(preview.pay ?? '') && /worst case/.test(preview.after ?? '') && /Confirm: Pay \$/.test(preview.button), `Match market lists 4 claims (with Decisive); the ticket previews "${preview.pay?.replace(/\s+/g, ' ')}" and "${preview.after?.replace(/\s+/g, ' ')}"`);

// 2. buy: the committed cost equals the previewed total
const cash0 = await page.evaluate(() => window.__crown.fed.balance('player:cash'));
await page.locator('[data-testid="confirm-trade"]').click();
await page.waitForFunction(id => (window.__crown.fed.state.positions.get(`${id}|player:cash`)?.shares[0] ?? 0) > 0, ids.m);
const cash1 = await page.evaluate(() => window.__crown.fed.balance('player:cash'));
check(2, Math.round((cash0 - cash1) / 1e4) === Math.round(money(preview.button) * 100), `Bought 10 shares: cash fell by $${((cash0 - cash1) / 1e6).toFixed(2)}, the previewed amount on the button ("${preview.button}")`);

// 3. position panel
await page.waitForSelector('[data-testid="pnl"]');
const pos = await page.evaluate(() => ({ text: document.querySelector('[data-testid="position-panel"]').innerText, close: !!document.querySelector('[data-testid="close-position"]') }));
check(3, /Avg Cost/i.test(pos.text) && /Realised/i.test(pos.text) && /unrealised/i.test(pos.text) && /At risk/i.test(pos.text) && pos.close, 'Your Position shows cost basis, realised and unrealised P&L, the amount at risk and a Close Position button');

// 4. close position with an exact-proceeds confirmation
await page.locator('[data-testid="close-position"]').click();
const confirmText = await page.locator('[data-testid="confirm-close"]').textContent();
const cash2 = await page.evaluate(() => window.__crown.fed.balance('player:cash'));
await page.locator('[data-testid="confirm-close"]').click();
await page.waitForFunction(id => window.__crown.fed.state.positions.get(`${id}|player:cash`).shares.every(x => x === 0), ids.m);
const closed = await page.evaluate(id => { const f = window.__crown.fed; const p = f.state.positions.get(`${id}|player:cash`); return { cash: f.balance('player:cash'), realised: p.realised, net: p.received - p.spent }; }, ids.m);
check(4, Math.round((closed.cash - cash2) / 1e4) === Math.round(money(confirmText) * 100) && closed.realised === closed.net && closed.net < 0, `Closed the position: received $${((closed.cash - cash2) / 1e6).toFixed(2)} as confirmed ("${confirmText}"); realised ${(closed.realised / 1e6).toFixed(2)} = received − paid (fees and spread)`);

// 5. watchlist survives a reload
await page.locator('[data-testid="watch-market"]').click();
await page.waitForFunction(id => window.__crown.fed.marketWatchlist().includes(id), ids.m);
await page.reload(); await page.waitForFunction(() => window.__crown?.fed?.ready);
await page.evaluate(() => { location.hash = '#/exchange'; });
await page.waitForSelector('[data-testid="group-Watchlist"]');
const wl = await page.evaluate(() => document.querySelector('[data-testid="group-Watchlist"]').querySelectorAll('[data-testid="market-row"]').length);
check(5, wl === 1, `After a reload the Exchange shows a Watchlist with the watched market (${wl} row)`);

// 6. over/under page: definition and VOID terms
await page.evaluate(id => { location.hash = `#/exchange/${encodeURIComponent(id)}`; }, ids.len);
await page.waitForSelector('[data-testid="settlement-terms"]');
const len = await page.evaluate(() => ({ h1: document.querySelector('main h1')?.textContent, rules: document.body.innerText.match(/official game record[^.]*\./)?.[0], terms: document.querySelector('[data-testid="settlement-terms"]').innerText }));
check(6, /over\/under \d+\.5 plies/.test(len.h1 ?? '') && !!len.rules && /VOID/.test(len.terms), `Over/under market "${len.h1}": rules state "${len.rules}"; settlement and VOID terms listed`);

// 7. finance portfolio and forecasting league
await page.evaluate(() => { location.hash = '#/finance'; });
await page.waitForSelector('[data-testid="portfolio"]');
await page.evaluate(() => { location.hash = '#/forecasts'; });
await page.waitForSelector('[data-testid="forecast-league"]');
await page.waitForSelector('[data-testid="calibration-challenge"]');
check(7, true, 'Finance shows the portfolio panel; Forecasting shows the Forecasting League and the Calibration Challenge');

// 8. phone width
await ctx.close();
ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 390, height: 844 }, isMobile: true });
page = ctx.pages()[0] ?? await ctx.newPage(); watch(page);
const over = [];
for (const h of [`#/exchange/${encodeURIComponent(ids.m)}`, '#/finance', '#/forecasts']) {
  await page.goto(url + h); await page.waitForFunction(() => window.__crown?.fed?.ready); await page.waitForTimeout(600);
  over.push(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
}
await page.goto(url + `#/exchange/${encodeURIComponent(ids.m)}`); await page.waitForTimeout(600);
await page.screenshot({ path: OUT + 'market-phone.png', fullPage: true });
check(8, over.every(x => x <= 1), `No horizontal overflow at 390 px (market, finance, forecasting: ${over.join(', ')} px)`);
check(9, errors.length === 0, `No page or console errors (${errors.length})`);
await ctx.close();
step(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
writeFileSync(OUT + 'journey-log.txt', log.join('\n') + '\n');
process.exit(failed ? 1 : 0);
