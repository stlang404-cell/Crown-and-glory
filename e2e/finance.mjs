/**
 * v0.11 Finance journey (crown-wealth-1), through the real UI: found the Federation → Finance shows Lifetime
 * Statistics, the administration explainer, Club Facilities, Event Sponsorship and Estates → buy a club, build a
 * facility and sponsor an event with the on-screen buttons → every figure equals the service's ledger → a reload
 * charges nothing twice → 390 px: no horizontal overflow; no page errors.
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4436 &  node e2e/finance.mjs http://127.0.0.1:4436/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4436/';
const SHOTS = new URL('../docs/screenshots/v0.11/', import.meta.url).pathname;
const ART = new URL('./artifacts/finance/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const errors = [];
const watch = p => { p.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); }); p.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); step('console.error ' + m.text()); } }); };
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const money = micro => '$' + Math.round(micro / 1e6).toLocaleString('en');
const ledger = p => p.evaluate(async () => {
  const fed = window.__crown.fed;
  const js = await fed.playerJournal(Infinity);
  const f = fed.finance();
  return { cash: f.cash, netWorth: f.netWorth, liabilities: f.liabilities, journals: js.length, ids: js.map(j => j.id).sort(), wealth: fed.wealthState(), total: [...fed.state.balances.values()].reduce((a, b) => a + b, 0) };
});

const ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1366, height: 900 } });
let page = ctx.pages()[0] ?? await ctx.newPage();
watch(page);
await page.addInitScript(() => { try { localStorage.setItem('crown.display.v1', JSON.stringify({ ...(JSON.parse(localStorage.getItem('crown.display.v1') || '{}')), motion: 'reduce' })); } catch { /* ignore */ } });

// 1. found the Federation
await page.goto(url + '#/world'); await page.waitForFunction(() => window.__crown);
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
for (let i = 0; i < 6 && await page.locator('[data-testid="ceremony-continue"]').count(); i++) await page.locator('[data-testid="ceremony-continue"]').click();

// 2. Finance: the v0.11 panels
await page.goto(url + '#/finance');
await page.waitForSelector('[data-testid="lifetime"]', { timeout: 15000 });
const panels = await page.evaluate(() => ['networth', 'lifetime', 'admin-none', 'facilities', 'sponsorship', 'estates', 'milestones', 'liabilities'].map(id => [id, !!document.querySelector(`[data-testid="${id}"]`)]));
check(1, panels.every(([, v]) => v), 'Finance shows net worth, Lifetime Statistics, milestones, the administration explainer, facilities, sponsorship and estates: ' + JSON.stringify(panels));
const l0 = await ledger(page);
const ui0 = await page.evaluate(() => ({ earn: document.querySelector('[data-testid="lifetime-earnings"]')?.textContent, liab: document.querySelector('[data-testid="liabilities"]')?.textContent }));
check(2, ui0.liab === '$0' && l0.liabilities === 0 && ui0.earn === '$0' && l0.total === 0, `Fresh career: liabilities ${ui0.liab}, lifetime earnings ${ui0.earn} (the $1,000 grant is financing, not earnings); ledger total ${l0.total}`);

// 3. buy a club, build the Members' Lounge, sponsor the player's league — all with on-screen buttons
await page.locator('[data-testid="buy-club"]').click(); await page.locator('[data-testid="confirm-buy-club"]').click();
await page.waitForFunction(() => window.__crown.fed.ownsAsset('club'));
await page.locator('[data-testid="build-lounge"]').click(); await page.locator('[data-testid="confirm-build-lounge"]').click();
await page.waitForFunction(() => window.__crown.fed.wealthState().facilities.length === 1);
const league = await page.evaluate(() => window.__crown.fed.sponsorableEvents().find(e => e.event.startsWith('league:') && e.event.endsWith(':' + window.__crown.fed.state.world.player.division)).event);
await page.locator(`[data-testid="sponsor-${league}"]`).click();
await page.waitForFunction(() => window.__crown.fed.wealthState().sponsorships.length === 1);
await page.waitForTimeout(500);
const l1 = await ledger(page);
const ui1 = await page.evaluate(() => ({ nw: document.querySelector('[data-testid="networth"] .stat .v')?.textContent, built: document.querySelector('[data-testid="facilities"]')?.textContent.includes('Built'), sponsored: document.querySelector('[data-testid="sponsorship"]')?.textContent.includes('Sponsored') }));
// $1,000 − $500 club − $350 lounge − $100 sponsorship stake = $50 cash; book value $300 bond + $150 deposit
check(3, l1.cash === 50e6 && l1.netWorth === 500e6 && ui1.nw === money(l1.netWorth) && ui1.built && ui1.sponsored && l1.total === 0,
  `After club + lounge + Supporter sponsorship: cash ${money(l1.cash)}, net worth ${ui1.nw} (ledger ${money(l1.netWorth)}); conserved ${l1.total === 0}`);
const ids = ['asset-buy:club', 'facility-build:lounge', `event-sponsor:1:${league}`];
check(4, ids.every(p => l1.ids.filter(x => x.startsWith(p)).length === 1), 'One journal per action: ' + ids.join(', '));
await page.screenshot({ path: SHOTS + 'finance-desktop.png', fullPage: true });

// 4. reload: nothing is charged or credited twice
await page.reload(); await page.waitForSelector('[data-testid="lifetime"]', { timeout: 30000 }); await page.waitForTimeout(800);
const l2 = await ledger(page);
check(5, l2.cash === l1.cash && l2.journals === l1.journals && JSON.stringify(l2.ids) === JSON.stringify(l1.ids) && JSON.stringify(l2.wealth) === JSON.stringify(l1.wealth),
  `Reload: cash ${money(l2.cash)}, ${l2.journals} player journals (before ${l1.journals}), wealth state unchanged`);
// 5. restrictions are explained and buttons disabled when cash is short
const disabled = await page.evaluate(() => ['estate-townhouse', 'build-gallery'].map(id => document.querySelector(`[data-testid="${id}"]`)?.disabled));
check(6, disabled.every(Boolean), 'Unaffordable estate and facility buttons are disabled: ' + JSON.stringify(disabled));

// 6. 390 px
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
const ov = await overflow(page);
check(7, ov <= 0, `390 px: horizontal overflow ${ov}px`);
await page.screenshot({ path: SHOTS + 'finance-390.png', fullPage: true });
check(8, errors.length === 0 && (await page.locator('[data-testid="screen-error"]').count()) === 0, `No page errors (${errors.length})`);

await ctx.close();
writeFileSync(ART + 'log.txt', log.join('\n'));
console.log(failed ? `FAILED ${failed}` : 'ALL PASS');
process.exit(failed ? 1 : 0);
