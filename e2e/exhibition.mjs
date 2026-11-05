/**
 * v0.11 Exhibition Arena journey (package O), real UI in Chromium against a production build:
 * found the Federation → Federation screen → Exhibition Arena → pick a beginner (0–399) for White and a legend (4,000+,
 * found by name search) for Black → start → pause (no new moves while paused) → step back / forward → skip to the
 * result → Match Analysis appears (grades, Played Like for both sides, Elo comparison) → reload: the exhibition is in
 * the Exhibition history and in the Replay Library's Exhibitions filter → ratings, standings, records, balances,
 * markets and official game/report counts are unchanged (snapshots before/after) → 390 px phone: picker and match
 * screen without horizontal overflow, page scroll works, a second exhibition plays to the end; delete it.
 * The live scheduler is switched off for the journey (Settings value) so the before/after snapshots compare the
 * Federation with itself; that switch is setup, not under test.
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4440 &  node e2e/exhibition.mjs http://127.0.0.1:4440/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4440/';
const OUT = new URL('./artifacts/exhibition/', import.meta.url).pathname;
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
await page.locator('[data-testid="ceremony-continue"]').click({ timeout: 2000 }).catch(() => {});

const snapshot = () => page.evaluate(async () => {
  const s = window.__crown, st = s.fed.state;
  const comps = [...st.competitors.values()].map(c => [c.id, c.rating, c.rd, c.stats.w, c.stats.d, c.stats.l, c.titles.length, c.fedTitle ?? null, c.earnings, c.history.length].join('|')).sort().join('\n');
  const balances = [...st.balances.entries()].sort().map(e => e.join('=')).join(',');
  const rounds = JSON.stringify([...st.rounds.values()].map(r => r.fixtures.map(f => [f.id, f.result])));
  const enc = new TextEncoder();
  const h = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  const d = await s.db.dump();
  return { comps: await h(comps), balances: await h(balances), rounds: await h(rounds), world: JSON.stringify([st.world.season, st.world.round]), markets: st.markets.size,
    games: d.games.length, reports: d.reports.length, ratingEvents: d.ratingEvents.length, rapid: JSON.stringify(await s.db.ratingState('rapid')), worldGames: d.federation.worldGames.length,
    vault: (await s.db.metaWithPrefix('ach:')).length };
});
const before = await snapshot();
step('before: ' + JSON.stringify(before));

// entry point from the Federation screen
await page.locator('[data-testid="exhibition-link"]').click();
await page.waitForSelector('[data-testid="exhibition-home"]');
check(1, await page.locator('[data-testid="exhibition-isolation"]').isVisible(), 'Exhibition Arena opens from the Federation screen with the unofficial notice');
// White: a beginner (0–399)
await page.locator('[data-testid="exh-band-white"]').selectOption({ label: '0–399' });
await page.locator('[data-testid="exh-row-white"]').first().click();
const wSel = await page.locator('[data-testid="exh-selected-white"]').getAttribute('data-id');
const wRating = await page.evaluate(id => window.__crown.fed.state.competitors.get(id).rating, wSel);
// Black: a legend (4,000+) found by name search
await page.locator('[data-testid="exh-band-black"]').selectOption({ label: '4000+' });
const legend = await page.locator('[data-testid="exh-row-black"]').first().getAttribute('data-id');
const legendName = await page.evaluate(id => window.__crown.fed.state.competitors.get(id).name, legend);
await page.locator('[data-testid="exh-band-black"]').selectOption({ label: 'Any rating' });
await page.locator('[data-testid="exh-search-black"]').fill(legendName);
await page.waitForTimeout(400);
await page.locator(`[data-testid="exh-row-black"][data-id="${legend}"]`).click();
const bRating = await page.evaluate(id => window.__crown.fed.state.competitors.get(id).rating, legend);
const total = await page.evaluate(() => [...window.__crown.fed.state.competitors.values()].filter(c => c.status === 'active').length);
check(2, Math.round(wRating) < 400 && Math.round(bRating) >= 4000 && total > 10000, `Picked ${wSel} (${Math.round(wRating)}) vs ${legendName} (${Math.round(bRating)}) from ${total} competitors`);
check(3, (await page.locator('[data-testid="exh-note-black"]').innerText()).includes('measured'), 'The legend shows the "strongest measured engine" note');
await page.screenshot({ path: OUT + 'desktop-picker.png', fullPage: true });
await page.locator('[data-testid="exh-start"]').click();
await page.waitForSelector('[data-testid="exhibition"]');
const exhId = decodeURIComponent((await page.evaluate(() => location.hash)).split('/')[2]);
await page.waitForFunction(() => +document.querySelector('[data-testid="exhibition"]').dataset.plies >= 3, null, { timeout: 60000 });
check(4, await page.locator('[data-testid="eval-bar"]').count() === 1, 'Board with the evaluation bar while the exhibition plays');
// pause: no more moves
await page.locator('[data-testid="exh-pause"]').click();
await page.waitForFunction(() => document.querySelector('[data-testid="exhibition"]').dataset.state === 'paused');
const p1 = +(await page.locator('[data-testid="exhibition"]').getAttribute('data-plies'));
await page.waitForTimeout(2500);
const p2 = +(await page.locator('[data-testid="exhibition"]').getAttribute('data-plies'));
check(5, p1 === p2, `Paused: ${p1} plies before and ${p2} after 2.5 s`);
await page.getByRole('button', { name: 'Previous Move' }).click();
const back = await page.locator('[data-testid="exh-ply"]').innerText();
await page.getByRole('button', { name: 'Next Move' }).click();
await page.getByRole('button', { name: 'Next Move' }).click(); // at the newest move: computes one more
await page.waitForFunction(n => +document.querySelector('[data-testid="exhibition"]').dataset.plies === n + 1, p2, { timeout: 30000 });
check(6, back === `${p2 - 1}/${p2}`, `Step back shows ${back}; step forward at the newest move computed move ${p2 + 1}`);
// skip to the result
await page.locator('[data-testid="exh-skip"]').click();
await page.waitForFunction(() => document.querySelector('[data-testid="exhibition"]').dataset.state === 'finished', null, { timeout: 300000 });
const result = await page.locator('[data-testid="exhibition"]').getAttribute('data-result');
check(7, ['1-0', '0-1', '1/2-1/2'].includes(result) && await page.locator('[data-testid="exh-final"]').isVisible(), `Skip to result: ${result}`);
await page.getByRole('tab', { name: 'Study' }).click().catch(() => {});
await page.waitForSelector('[data-testid="exh-report"]', { timeout: 300000 });
const pl = await page.locator('[data-testid="exh-played-like"]').innerText();
check(8, (await page.locator('[data-testid="exh-grade-summary"]').count()) === 1 && (await page.locator('[data-testid="exh-elo"]').count()) === 1 && /Played Like/.test(pl)
  && (await page.locator('[data-testid="exh-played-like-white"]').count()) === 1 && (await page.locator('[data-testid="exh-played-like-black"]').count()) === 1,
`Match Analysis: grades, mistakes, Elo comparison and Played Like for both sides`);
await page.screenshot({ path: OUT + 'desktop-study.png', fullPage: true });
// practise a position (sandbox) when a mistake exists
if (await page.locator('[data-testid="exh-practise"]').count()) {
  await page.locator('[data-testid="exh-practise"]').first().click();
  check(9, await page.locator('[data-testid="sandbox"]').isVisible(), 'Practise This Position opens the sandbox before the mistake');
  await page.locator('[data-testid="sandbox-exit"]').click();
} else step('no mistakes in this game: practise step skipped');

// reload → archive
await page.reload();
await page.waitForFunction(() => window.__crown);
await page.goto(url + '#/exhibition');
await page.waitForSelector('[data-testid="exh-history-row"]');
const hist = await page.$$eval('[data-testid="exh-history-row"]', els => els.map(e => [e.dataset.id, e.dataset.status]));
check(10, hist.some(([id, s]) => id === exhId && s === 'finished'), `Exhibition history after reload: ${JSON.stringify(hist)}`);
await page.goto(url + '#/replays');
await page.locator('[data-testid="replay-filter-exhibitions"]').click();
const lib = await page.$$eval('[data-testid="replay-row"]', els => els.map(e => [e.dataset.id, e.dataset.kind]));
check(11, lib.length >= 1 && lib.every(([, k]) => k === 'exhibition') && lib.some(([id]) => id === exhId), `Replay Library · Exhibitions: ${JSON.stringify(lib)}`);
await page.locator(`[data-testid="replay-row"][data-id="${exhId}"] .replay-open`).click();
await page.waitForSelector('[data-testid="exhibition"][data-state="finished"]');
check(12, true, 'Opening the library row reopens the exhibition replay');
const after = await snapshot();
step('after: ' + JSON.stringify(after));
check(13, JSON.stringify(after) === JSON.stringify(before), 'Ratings/RD, records, titles, earnings, balances, standings, markets, world cursor, official games, reports, rating events and Vault unchanged');

// phone
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(url + '#/exhibition');
await page.waitForSelector('[data-testid="exhibition-home"]');
const ov1 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(200);
const sy = await page.evaluate(() => window.scrollY);
await page.locator('[data-testid="exh-row-white"]').first().click();
await page.locator('[data-testid="exh-row-black"]:not([disabled])').first().click();
await page.screenshot({ path: OUT + 'phone-picker.png', fullPage: true });
await page.locator('[data-testid="exh-start"]').click();
await page.waitForSelector('[data-testid="exhibition"]');
const exh2 = decodeURIComponent((await page.evaluate(() => location.hash)).split('/')[2]);
await page.waitForFunction(() => +document.querySelector('[data-testid="exhibition"]').dataset.plies >= 2, null, { timeout: 60000 });
const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.locator('[data-testid="exh-skip"]').click();
await page.waitForFunction(() => document.querySelector('[data-testid="exhibition"]').dataset.state === 'finished', null, { timeout: 300000 });
const ov3 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.screenshot({ path: OUT + 'phone-match.png', fullPage: true });
check(14, ov1 <= 0 && ov2 <= 0 && ov3 <= 0 && sy > 0, `390 px: overflow picker ${ov1}, playing ${ov2}, finished ${ov3}; page scrolls (${sy})`);
// delete the second exhibition
await page.goto(url + '#/exhibition');
await page.locator(`[data-testid="exh-history-row"][data-id="${exh2}"] [data-testid="exh-delete"]`).click();
await page.locator(`[data-testid="exh-history-row"][data-id="${exh2}"] [data-testid="exh-delete-confirm"]`).click();
await page.waitForTimeout(500);
check(15, await page.locator(`[data-testid="exh-history-row"][data-id="${exh2}"]`).count() === 0 && await page.locator(`[data-testid="exh-history-row"][data-id="${exhId}"]`).count() === 1, 'Deleting an exhibition removes only that entry');
const final = await snapshot();
check(16, JSON.stringify(final) === JSON.stringify(before), 'Official state still unchanged after the phone exhibition and the deletion');
check(17, errors.length === 0, `No page errors (${errors.length})`);
await ctx.close();
step(failed ? `FAILED ${failed}` : 'ALL PASS');
process.exit(failed ? 1 : 0);
