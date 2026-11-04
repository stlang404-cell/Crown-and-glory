/**
 * v0.9 Federation Dashboard, through the real UI: a fresh career lands on the dashboard (#/) with empty states and
 * no errors → found the Federation → the dashboard shows live Federation matches and the Random Match → Watch on a
 * match card opens the Live Arena → Trade opens that match's market → desktop and 390 px screenshots, no overflow.
 *   node scripts/serve.mjs --dir dist --port 4405 &  node e2e/dashboard.mjs http://127.0.0.1:4405/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4405/';
const SHOTS = new URL('../docs/screenshots/v0.9.0/', import.meta.url).pathname;
const ART = new URL('./artifacts/dashboard/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const errors = [];
const watch = p => { p.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); }); p.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); step('console.error ' + m.text()); } }); };
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const boundary = p => p.locator('[data-testid="screen-error"]').count();

let ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1366, height: 900 } });
let page = ctx.pages()[0] ?? await ctx.newPage();
watch(page);
await page.addInitScript(() => { try { localStorage.setItem('crown.display.v1', JSON.stringify({ ...(JSON.parse(localStorage.getItem('crown.display.v1') || '{}')), motion: 'reduce' })); } catch { /* ignore */ } });

// 1. fresh career: the landing page is the dashboard, with empty states
await page.goto(url); await page.waitForFunction(() => window.__crown);
await page.waitForSelector('[data-testid="dashboard"]');
await page.waitForSelector('[data-testid="dash-grim-complete"]', { timeout: 15000 });
await page.waitForSelector('[data-testid="dash-vault-earned"]', { timeout: 15000 });
const fresh = await page.evaluate(() => ({
  hash: location.hash,
  current: document.querySelector('nav.rail [aria-current="page"]')?.textContent?.trim(),
  railFirst: document.querySelector('nav.rail .nav-btn')?.textContent?.trim(),
  tabs: [...document.querySelectorAll('nav.tabbar button')].map(b => b.textContent.trim()),
  notFounded: !!document.querySelector('[data-testid="dash-not-founded"]'),
  qm: !!document.querySelector('[data-testid="quick-match"]'),
  banner: document.querySelectorAll('[data-testid="identity-banner"]').length,
  matchesEmpty: document.querySelector('[data-testid="dash-matches"]')?.textContent ?? '',
  exchangeEmpty: document.querySelector('[data-testid="dash-exchange"]')?.textContent ?? '',
  rating: document.querySelector('[data-testid="dash-rating"]')?.textContent ?? '',
  results: document.querySelector('[data-testid="dash-results"]')?.textContent ?? '',
  vault: document.querySelector('[data-testid="dash-vault-earned"]')?.textContent,
  grim: document.querySelector('[data-testid="dash-grim-complete"]')?.textContent,
}));
step('fresh: ' + JSON.stringify({ ...fresh, matchesEmpty: fresh.matchesEmpty.slice(0, 90), exchangeEmpty: fresh.exchangeEmpty.slice(0, 90), rating: fresh.rating.slice(0, 90), results: fresh.results.slice(0, 90) }));
check(1, fresh.current === 'Dashboard' && fresh.railFirst === 'Dashboard' && fresh.tabs.length <= 6 && fresh.tabs[0] === 'Dashboard' && fresh.tabs.includes('Play') && fresh.tabs.includes('Settings'),
  `Landing page is the Dashboard (hash "${fresh.hash}"); rail starts with Dashboard; tabs ${fresh.tabs.join(', ')}`);
check(2, fresh.notFounded && fresh.qm && fresh.banner === 1 && /found the Federation/i.test(fresh.matchesEmpty) && /Exchange opens/i.test(fresh.exchangeEmpty)
  && /after your first rated/i.test(fresh.rating) && /No rated games yet/.test(fresh.results) && /^0\/\d+$/.test(fresh.vault ?? '') && /^0\/\d+$/.test(fresh.grim ?? '') && (await boundary(page)) === 0,
  'Fresh career: identity banner once, Random Match, and clear empty states with actions (matches, exchange, rating, results, Vault 0/n, Grimoire 0/n)');
await page.screenshot({ path: SHOTS + 'dashboard-fresh-desktop.png', fullPage: true });
const hashPlay = await page.evaluate(async () => { location.hash = '#/play'; await new Promise(r => setTimeout(r, 400)); return !!document.querySelector('[data-testid="quick-match"]') && /Choose your opponent/i.test(document.body.innerText) && !document.querySelector('[data-testid="dashboard"]') && document.querySelector('nav.rail [aria-current="page"]')?.textContent?.trim() === 'Play'; });
check(3, hashPlay, 'Play stays at #/play');

// 2. found the Federation, back to the dashboard
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
for (let i = 0; i < 6 && await page.locator('[data-testid="ceremony-continue"]').count(); i++) await page.locator('[data-testid="ceremony-continue"]').click();
await page.locator('nav.rail').getByRole('button', { name: 'Dashboard', exact: true }).click();
await page.waitForSelector('[data-testid="dash-match"]', { timeout: 15000 });
await page.waitForTimeout(800);
const founded = await page.evaluate(() => {
  const st = window.__crown.fed.state;
  return {
    hash: location.hash,
    cards: document.querySelectorAll('[data-testid="dash-match"]').length,
    featured: window.__crown.fed.featuredFixtures().length,
    statuses: [...document.querySelectorAll('[data-testid="dash-match"]')].map(c => c.getAttribute('data-status')),
    firstCard: document.querySelector('[data-testid="dash-match"]')?.textContent ?? '',
    trade: document.querySelectorAll('[data-testid="dash-trade"]').length,
    qmDraw: !!document.querySelector('[data-testid="qm-draw"]'),
    cash: document.querySelector('[data-testid="dash-cash"]')?.textContent,
    cashState: '$' + Math.round((st.balances.get('player:cash') ?? 0) / 1e6).toLocaleString('en'),
    markets: document.querySelectorAll('[data-testid="dash-open-market"]').length,
    events: [...document.querySelectorAll('[data-testid="dash-event"]')].map(e => `${e.getAttribute('data-event')}:${e.getAttribute('data-status')}`),
    season: document.querySelector('[data-testid="dash-season"]')?.textContent,
    notFounded: !!document.querySelector('[data-testid="dash-not-founded"]'),
  };
});
step('founded: ' + JSON.stringify({ ...founded, firstCard: founded.firstCard.slice(0, 140) }));
check(4, founded.cards > 0 && founded.cards <= 6 && founded.cards === Math.min(6, founded.featured) && founded.trade > 0 && founded.qmDraw && !founded.notFounded && /\$0\.\d{3}/.test(founded.firstCard),
  `Dashboard shows ${founded.cards} live Federation match cards (of ${founded.featured} featured) with prices, Trade buttons and the Random Match`);
check(5, founded.cash === founded.cashState && founded.markets > 0 && founded.events.length >= 3 && /^Season 1 · Round 1/.test(founded.season ?? ''),
  `Exchange snapshot cash ${founded.cash} matches saved state ${founded.cashState}; ${founded.markets} open markets; events ${founded.events.join(', ')}`);
await page.screenshot({ path: SHOTS + 'dashboard-desktop.png', fullPage: true });
const ovDesk = await overflow(page);

// 3. Watch → Live Arena
const card = page.locator('[data-testid="dash-match"]').first();
const fixtureId = await card.getAttribute('data-fixture');
await card.locator('[data-testid="dash-watch"]').click();
await page.waitForSelector('[data-testid="arena"]', { timeout: 15000 });
const arenaHash = await page.evaluate(() => decodeURIComponent(location.hash));
check(6, arenaHash === `#/watch/${fixtureId}` && (await boundary(page)) === 0, `Watch opened the Live Arena at ${arenaHash}`);

// 4. Trade → market
await page.goBack(); await page.waitForSelector('[data-testid="dash-trade"]');
const tradeCard = page.locator('[data-testid="dash-match"]').filter({ has: page.locator('[data-testid="dash-trade"]') }).first();
const tradeFixture = await tradeCard.getAttribute('data-fixture');
await tradeCard.locator('[data-testid="dash-trade"]').click();
await page.waitForFunction(() => location.hash.startsWith('#/exchange/'));
await page.waitForTimeout(600);
const mkt = await page.evaluate(() => ({ hash: decodeURIComponent(location.hash), h1: document.querySelector('main h1')?.textContent ?? '', text: document.querySelector('main')?.innerText.length ?? 0 }));
check(7, mkt.hash === `#/exchange/mk:${tradeFixture}` && mkt.text > 100 && (await boundary(page)) === 0, `Trade opened the market ${mkt.hash} ("${mkt.h1}")`);

// 5. keyboard: the Watch button is reachable and activates with Enter
await page.goto(url + '#/'); await page.waitForSelector('[data-testid="dash-watch"]');
await page.locator('[data-testid="dash-watch"]').first().focus();
await page.keyboard.press('Enter');
await page.waitForSelector('[data-testid="arena"]', { timeout: 15000 });
check(8, (await page.evaluate(() => location.hash)).startsWith('#/watch/'), 'Keyboard: Enter on a focused Watch button opens the Arena');
await ctx.close();

// 6. phone, 390 px
ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page = ctx.pages()[0] ?? await ctx.newPage();
watch(page);
await page.goto(url); await page.waitForSelector('[data-testid="dash-match"]', { timeout: 20000 });
await page.waitForSelector('[data-testid="dash-grim-complete"]', { timeout: 15000 });
await page.waitForTimeout(800);
const ovPhone = await overflow(page);
const phone = await page.evaluate(() => ({
  tabs: [...document.querySelectorAll('nav.tabbar button')].map(b => b.textContent.trim()),
  current: document.querySelector('nav.tabbar [aria-current="page"]')?.textContent?.trim(),
  cols: getComputedStyle(document.querySelector('.dash-grid')).gridTemplateColumns.split(' ').length,
  wide: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 5).map(e => e.className || e.tagName),
}));
step('phone: ' + JSON.stringify(phone));
await page.screenshot({ path: SHOTS + 'dashboard-phone.png', fullPage: true });
await page.screenshot({ path: SHOTS + 'dashboard-phone-top.png' });
check(9, ovDesk <= 0 && ovPhone <= 0 && phone.cols === 1 && phone.current === 'Dashboard' && phone.tabs.length <= 6,
  `No horizontal overflow (desktop ${ovDesk}px, 390 px ${ovPhone}px); single column on phone; tabs ${phone.tabs.join(', ')}`);
await ctx.close();

check(10, errors.length === 0, `No page or console errors (${errors.length})`);
writeFileSync(ART + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
