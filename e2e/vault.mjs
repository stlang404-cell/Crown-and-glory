/**
 * v0.9 The Sovereign Vault, through the real UI: fresh career → Vault shows 0 earned with locked, awaiting and insignia
 * items → filters and search (secret rules never match) → item detail → found the Federation → rated Quick Match,
 * resign → casual Quick Match, resign → nothing wrongly awarded (no win, draw or Quick Match collectible) → register for
 * the Challenger Open → "First Entry" unlocks with one notice → reload: no duplicate record, no repeated notice →
 * insignias match the (provisional) rating state → phone layout without horizontal overflow → no page errors.
 *   node scripts/serve.mjs --dir dist --port 4403 &  node e2e/vault.mjs http://127.0.0.1:4403/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4403/';
const SHOTS = new URL('../docs/screenshots/v0.9.0/', import.meta.url).pathname;
const ART = new URL('./artifacts/vault/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true }); rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
let ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
let page = ctx.pages()[0] ?? await ctx.newPage();
const errors = []; const watch = p => p.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); }); watch(page);
const vaultReady = () => page.waitForFunction(() => window.__crown?.vault?.ready, null, { timeout: 30000 });
const owned = () => page.evaluate(() => [...window.__crown.vault.owned.values()].map(u => ({ id: u.id, backfill: u.backfill })));
const settle = async () => { // wait for the event-driven evaluation to catch up with the saved records
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(async () => { const v = window.__crown.vault; return (await v.changeKey()) === v['lastKey']; })) return;
    await page.waitForTimeout(500);
  }
  throw new Error('Vault evaluation did not catch up within 30 s');
};
const justified = () => page.evaluate(() => { const v = window.__crown.vault; return [...v.owned.keys()].filter(id => !v.results.get(id)?.earned); });
const count = async () => (await page.locator('[data-testid="vault-count"]').textContent()).trim();

await page.goto(url); await page.waitForFunction(() => window.__crown); await vaultReady();
await page.goto(url + '#/vault');
await page.waitForSelector('[data-testid="vault"]');
const s0 = await page.evaluate(() => ({
  earned: document.querySelector('[data-testid="vault-earned"]')?.textContent,
  insignias: document.querySelector('[data-testid="vault-insignias"]')?.textContent,
  items: document.querySelectorAll('[data-testid="vault-item"]').length,
  locked: document.querySelectorAll('[data-testid="vault-item"][data-state="locked"]').length,
  awaiting: document.querySelectorAll('[data-testid="vault-item"][data-state="awaiting"]').length,
  earnedItems: document.querySelectorAll('[data-testid="vault-item"][data-state="earned"]').length,
  meta: 0,
}));
s0.meta = await page.evaluate(async () => (await window.__crown.db.metaWithPrefix('ach:')).length);
check(1, s0.earned.startsWith('0 ') && s0.earnedItems === 0 && s0.meta === 0 && s0.items >= 120 && s0.locked > 80 && s0.awaiting >= 10 && s0.insignias.startsWith('0 '),
  `Fresh career: "${s0.earned}" earned, ${s0.items} items (${s0.locked} locked, ${s0.awaiting} awaiting grading), insignias "${s0.insignias}", ${s0.meta} unlock records`);
await page.screenshot({ path: SHOTS + 'vault-empty-desktop.png', fullPage: false });

// filters and search
await page.selectOption('[data-testid="vault-filter-collection"]', 'Insignias');
const cIns = await count();
await page.selectOption('[data-testid="vault-filter-collection"]', 'all');
await page.selectOption('[data-testid="vault-filter-state"]', 'awaiting');
const cAw = await count();
const awaitingIds = await page.evaluate(() => [...document.querySelectorAll('[data-testid="vault-item"]')].map(e => e.dataset.id));
await page.selectOption('[data-testid="vault-filter-state"]', 'all');
await page.selectOption('[data-testid="vault-filter-rarity"]', 'mythic');
const mythic = await page.evaluate(() => [...document.querySelectorAll('[data-testid="vault-item"]')].map(e => e.querySelector('.chip.rarity')?.textContent));
await page.selectOption('[data-testid="vault-filter-rarity"]', 'all');
await page.fill('[data-testid="vault-search"]', 'giant');
const giant = await page.evaluate(() => [...document.querySelectorAll('[data-testid="vault-item"]')].map(e => e.dataset.id));
await page.fill('[data-testid="vault-search"]', 'small hours');
const secretHits = await count();
await page.fill('[data-testid="vault-search"]', '');
check(2, cIns === '31 collectibles' && /^1\d collectibles$/.test(cAw) && awaitingIds.includes('brilliant-1') && mythic.length > 3 && mythic.every(x => x === 'Mythic') && giant.includes('giant-slayer') && secretHits === '0 collectibles',
  `Filters: Insignias → ${cIns}; Awaiting → ${cAw} (incl. brilliant-1); Mythic → ${mythic.length} all Mythic; search "giant" → ${giant.join(', ')}; secret condition search → ${secretHits}`);
await page.locator('[data-testid="vault-item"][data-id="sovereign-unbound"]').click();
await page.waitForSelector('[data-testid="vault-detail"]');
const detail = await page.locator('[data-testid="vault-detail"] [role="dialog"]').textContent();
await page.screenshot({ path: SHOTS + 'vault-detail-desktop.png' });
await page.keyboard.press('Escape');
const closed = await page.locator('[data-testid="vault-detail"]').count();
const secretCard = await page.locator('[data-testid="vault-item"][data-id="night-owl"]').textContent();
check(3, /Unbound Victory/.test(detail) && /Locked/.test(detail) && /10 s per move/.test(detail) && closed === 0 && /Secret Collectible/.test(secretCard) && !/04:00/.test(secretCard),
  `Detail shows rule and state, Escape closes; secret card masked ("${secretCard.slice(0, 60)}…")`);

// Federation + rated Quick Match (resign)
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
const playQm = async rated => {
  await page.goto(url + '#/play');
  await page.waitForSelector('[data-testid="quick-match"]');
  await page.getByRole('group', { name: 'Match type' }).getByRole('button', { name: rated ? 'Rated' : 'Casual' }).click();
  await page.locator('[data-testid="qm-draw"]').click();
  await page.locator('[data-testid="qm-start"]').click();
  await page.waitForSelector('[data-testid="match"]');
  await page.getByRole('button', { name: /Resign/ }).first().click();
  await page.getByRole('button', { name: 'Yes, Resign' }).click();
  await page.waitForSelector('.result-overlay', { timeout: 20000 });
};
const ev0 = await page.evaluate(() => window.__crown.vault.evaluations);
await playQm(true);
await page.goto(url + '#/vault'); await page.waitForSelector('[data-testid="vault"]');
await settle();
const ev1 = await page.evaluate(() => ({ n: window.__crown.vault.evaluations, games: window.__crown.vault.facts.games.length, rated: window.__crown.vault.facts.rated.length }));
const o1 = await owned();
check(4, ev1.n > ev0 && ev1.games === 1 && ev1.rated === 1 && !o1.some(u => ['first-win', 'first-draw', 'qm-first', 'giant-slayer'].includes(u.id)) && (await justified()).length === 0,
  `After a resigned rated Quick Match the Vault re-evaluated (${ev0} → ${ev1.n}; ${ev1.games} game, ${ev1.rated} rating event); owned: [${o1.map(u => u.id).join(', ')}] — no win/draw/Quick Match award, every unlock backed by its rule`);
await playQm(false);
await page.goto(url + '#/vault'); await page.waitForSelector('[data-testid="vault"]');
await settle();
const o2 = await owned();
check(5, !o2.some(u => ['first-win', 'first-draw', 'qm-first'].includes(u.id)) && (await justified()).length === 0, `After a resigned casual Quick Match: still no win/draw award (owned: [${o2.map(u => u.id).join(', ')}])`);

// a real unlock: register for the Challenger Open
await page.goto(url + '#/world');
await page.getByRole('button', { name: /^Register/ }).click();
await page.waitForSelector('[data-testid="vault-toast"]', { timeout: 20000 });
const toast = await page.locator('[data-testid="vault-toast"]').textContent();
const role = await page.locator('[data-testid="vault-toast"]').getAttribute('role');
await page.screenshot({ path: SHOTS + 'vault-toast-desktop.png' });
const o3 = await owned();
const rec = o3.find(u => u.id === 'event-first');
check(6, !!rec && rec.backfill === false && /First Entry/.test(toast) && role === 'status', `Registering for the Challenger Open unlocked "First Entry" (backfill ${rec?.backfill}); notice: "${toast.trim()}" role=${role}`);
await page.getByRole('button', { name: 'Dismiss' }).click();
const gone = await page.locator('[data-testid="vault-toast"]').count();

// reload: no duplicates, no repeated notice, ownership kept
const metaBefore = await page.evaluate(async () => (await window.__crown.db.metaWithPrefix('ach:')).map(r => r.key));
await page.reload(); await page.waitForFunction(() => window.__crown); await vaultReady();
await page.goto(url + '#/world'); await page.waitForTimeout(3500);
const toastAgain = await page.locator('[data-testid="vault-toast"]').count();
await page.evaluate(() => window.__crown.vault.evaluate());
const metaAfter = await page.evaluate(async () => (await window.__crown.db.metaWithPrefix('ach:')).map(r => r.key));
check(7, gone === 0 && toastAgain === 0 && metaAfter.length === metaBefore.length && new Set(metaAfter).size === metaAfter.length && metaAfter.includes('ach:event-first'),
  `Dismissed (${gone} left); after reload + forced re-evaluation: notice shown again ${toastAgain}×, unlock records ${metaBefore.length} → ${metaAfter.length} (unique ${new Set(metaAfter).size})`);

// insignias reflect the rating state (one rated game: provisional, nothing collected)
await page.goto(url + '#/vault'); await page.waitForSelector('[data-testid="vault"]');
const ins = await page.evaluate(async () => {
  const p = await window.__crown.db.ratingState('rapid');
  return { games: p.games, rd: Math.round(p.rd), collected: window.__crown.vault.facts.insignia.collected.length, ui: document.querySelector('[data-testid="vault-insignias"]')?.textContent,
    earnedInsignia: document.querySelectorAll('[data-testid="vault-item"][data-id^="insignia-"][data-state="earned"]').length,
    eventFirst: document.querySelector('[data-testid="vault-item"][data-id="event-first"]')?.dataset.state, earned: document.querySelector('[data-testid="vault-earned"]')?.textContent };
});
check(8, ins.games === 1 && ins.collected === 0 && ins.ui.startsWith('0 ') && ins.earnedInsignia === 0 && ins.eventFirst === 'earned',
  `Insignias follow the rating state: ${ins.games} rated game (RD ${ins.rd}, provisional) → ${ins.collected} collected, UI "${ins.ui}"; First Entry shown as ${ins.eventFirst}; totals "${ins.earned}"`);
await page.screenshot({ path: SHOTS + 'vault-desktop.png', fullPage: true });
await ctx.close();

// phone
ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page = ctx.pages()[0] ?? await ctx.newPage(); watch(page);
await page.goto(url + '#/profile'); await page.waitForFunction(() => window.__crown); await vaultReady();
await page.locator('[data-testid="open-vault"]').click();
await page.waitForSelector('[data-testid="vault"]');
const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const wide = await page.evaluate(() => [...document.querySelectorAll('[data-testid="vault"] *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length);
await page.screenshot({ path: SHOTS + 'vault-phone.png' });
await page.locator('[data-testid="vault-item"]').first().click();
await page.waitForSelector('[data-testid="vault-detail"]');
const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
await page.screenshot({ path: SHOTS + 'vault-phone-detail.png' });
await page.locator('[data-testid="vault-detail-close"]').click();
check(9, ov <= 0 && wide === 0 && ov2 <= 0, `Phone (390 px, reached from Career Passport): horizontal overflow ${ov}px, ${wide} elements past the edge, detail overflow ${ov2}px`);
check(10, errors.length === 0, `No page errors (${errors.length})`);
await ctx.close();
writeFileSync(ART + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
