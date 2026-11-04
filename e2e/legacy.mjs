/**
 * Legacy journey (v0.11 package I): identity header on desktop and at 390 px (compact, expand/collapse, safe flow),
 * scrolling to the bottom of every main screen at 390 px, a rated game's "Previous → New (±)" career Elo line, the
 * Trophy Hall with a trophy awarded from a recorded Federation season (one restrained ceremony, reduced motion),
 * customisation from earned items only, persistence and no duplicates across a reload. Package Q: the header and the
 * Dashboard heading show the Competitive Rank and the Federation Title in separate labelled areas, each with its own
 * tag, frame and tooltip, and the rating title tagged apart, at 1366 and 390 px. Screenshots → docs/screenshots/v0.11/.
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4430 &  node e2e/legacy.mjs http://127.0.0.1:4430/
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4430/';
const OUT = new URL('./artifacts/legacy/', import.meta.url).pathname;
const SHOTS = new URL('../docs/screenshots/v0.11/', import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true }); mkdirSync(SHOTS, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const errors = [];
const watch = p => { p.on('pageerror', e => { errors.push(String(e).slice(0, 300)); step('pageerror: ' + String(e).slice(0, 300)); }); p.on('console', m => { if (m.type() === 'error') { errors.push(m.text().slice(0, 300)); step('console.error: ' + m.text().slice(0, 300)); } }); };
const RANK_TIP = /current competitive standing.*up or down/i, TITLE_TIP = /permanent honour earned by title norms.*never lost/i;
/** Separate labelled areas for the Competitive Rank, the Federation Title and the rating title (header + heading). */
const honours = p => p.evaluate(() => {
  const q = s => document.querySelector(s); const vis = e => !!e && e.getBoundingClientRect().height > 0;
  const area = q('[data-testid="header-rank-area"]'), head = q('[data-testid="rank-heading-kind"]'), ht = q('[data-testid="rank-heading-fedtitle"]'), rt = q('[data-testid="banner-title"]');
  const frame = q('[data-testid="identity-banner"] [data-honour-frame]'), hframe = q('[data-testid="rank-heading"] > [data-honour-frame]'), tframe = q('[data-testid="rank-heading-fedtitle"] [data-honour-frame], [data-testid="rank-heading-fedtitle"] [data-honour-tag]');
  return { area: area?.textContent.replace(/\s+/g, ' ').trim(), areaVisible: vis(area), aria: area?.getAttribute('aria-label'), tip: area?.getAttribute('title') ?? '', fedArea: q('[data-testid="header-fedtitle-area"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    fed: !!q('[data-testid="identity-banner"]') && (window.__crown.fed.state?.world.player.fedTitle ?? null),
    ratingTag: rt?.querySelector('[data-honour-tag]')?.textContent, ratingTip: rt?.getAttribute('title') ?? '', frame: frame?.getAttribute('data-honour-frame'), frameRadius: frame ? parseFloat(getComputedStyle(frame).borderTopLeftRadius) : null,
    head: head?.textContent.trim(), headTip: head?.getAttribute('title') ?? '', headFrame: hframe?.getAttribute('data-honour-frame'), title: ht?.textContent.replace(/\s+/g, ' ').trim(), titleTip: ht?.getAttribute('title') ?? '', titleTag: tframe?.getAttribute('data-honour-tag') ?? tframe?.getAttribute('data-honour-frame') };
});
const honoursOk = h => /^Competitive Rank \S.* (III|II|I) Rank$/.test(h.area ?? '') && h.areaVisible && /^Competitive Rank: /.test(h.aria ?? '') && RANK_TIP.test(h.tip) && h.frame === 'rank' && h.frameRadius < 8
  && (h.fed ? h.fedArea === `Federation Title ${h.fed} Title` : h.fedArea === null) && h.ratingTag === 'Rating' && /neither a Competitive Rank nor a Federation Title/.test(h.ratingTip)
  && h.head === 'Competitive Rank Rank' && RANK_TIP.test(h.headTip) && h.headFrame === 'rank' && /^Federation Title: /.test(h.title ?? '') && TITLE_TIP.test(h.titleTip) && h.titleTag === 'title';
const legacyReady = p => p.waitForFunction(() => window.__crown?.legacy?.ready, null, { timeout: 30000 });

let ctx = await chromium.launchPersistentContext(OUT + 'profile', { viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
let page = ctx.pages()[0] ?? await ctx.newPage();
watch(page);
await page.goto(url);
await legacyReady(page);
await page.waitForSelector('[data-testid="identity-banner"]');
const fresh = await page.evaluate(() => ({
  name: document.querySelector('[data-testid="header-name"]')?.textContent, rating: document.querySelector('[data-testid="banner-rating"]')?.textContent,
  position: getComputedStyle(document.querySelector('[data-testid="identity-banner"]')).position,
}));
check(1, fresh.name === 'You' && (/No rated games yet/.test(fresh.rating ?? '') || /^Career Elo 0\b.*provisional/.test(fresh.rating ?? '')) /* v0.11: new careers start at 0, provisional */ && fresh.position !== 'fixed' && fresh.position !== 'sticky', `Fresh header: ${JSON.stringify(fresh)}`);

// ---- a rated game: Previous → New (±)
await page.locator('nav.rail').getByRole('button', { name: 'Play', exact: true }).click();
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Rated', exact: true }).click().catch(() => {});
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
for (let i = 0; i < 3; i++) {
  await page.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')), null, { timeout: 30000 });
  if (await page.getAttribute('[data-testid="match"]', 'data-turn') === 'over') break;
  const sqs = await page.$$eval('[data-testid="match"] [data-square]', els => els.map(e => e.getAttribute('data-square')));
  for (const s of sqs) {
    await page.click(`[data-square="${s}"]`);
    const hs = await page.$$eval('[data-square]', els => els.filter(e => e.querySelector('.dot, .ring')).map(e => e.getAttribute('data-square')));
    if (hs.length) { await page.click(`[data-square="${hs[0]}"]`); break; }
  }
  await page.waitForTimeout(300);
}
if (await page.getAttribute('[data-testid="match"]', 'data-turn') !== 'over') { await page.getByRole('button', { name: /Resign/ }).first().click(); await page.getByRole('button', { name: 'Yes, Resign' }).click(); }
await page.waitForSelector('.result-overlay [data-testid="rating-change"]', { timeout: 20000 });
const change = await page.evaluate(async () => {
  const e = (await window.__crown.db.ratingEvents('rapid')).at(-1);
  const shown = (v) => Math.max(0, Math.round(v));
  const d = shown(e.after.rating) - shown(e.before.rating);
  const want = `Previous ${shown(e.before.rating).toLocaleString('en-US')} → New ${shown(e.after.rating).toLocaleString('en-US')} (${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('en-US')})`;
  return { text: document.querySelector('.result-overlay [data-testid="rating-change"]').textContent.replace(/\s+/g, ' ').replace(' to ', ' ').replace(/ · provisional$/, '').trim(), want };
});
check(2, change.text.replace('→to', '→') === change.want || change.text.includes(change.want.split(' (')[0].replace('→ ', '')) || change.text.replace(/\s/g, '') === change.want.replace(/\s/g, ''), `Rated game shows "${change.text}" (ledger: "${change.want}")`);
await page.screenshot({ path: SHOTS + 'rated-game-rating-change.png' });
await page.keyboard.press('Escape').catch(() => {});

// ---- profile: career Elo, graph, peak, customisation, Played Like slot
await page.goto(url + '#/profile');
await page.waitForSelector('[data-testid="legacy-customise"]', { timeout: 20000 });
const prof = await page.evaluate(() => ({
  elo: document.querySelector('[data-testid="current-rating"]')?.textContent, line: document.querySelector('main [data-testid="rating-change"]')?.textContent,
  slot: !!document.querySelector('[data-testid="played-like-slot"]'), header: document.querySelector('[data-testid="banner-rating"]')?.textContent,
}));
check(3, /^\d[\d,]*$/.test(prof.elo ?? '') && /Previous/.test(prof.line ?? '') && prof.slot && /Career Elo \d[\d,]* ±\d+/.test(prof.header ?? ''), `Profile career Elo ${prof.elo}, "${prof.line}", header "${prof.header}", Played Like slot ${prof.slot}`);
await page.screenshot({ path: SHOTS + 'profile-career-elo-desktop.png', fullPage: true });

// ---- a recorded Federation season → trophies (Seasons Monument at least), one ceremony
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
const t0 = Date.now();
await page.evaluate(async () => { const f = window.__crown.fed; while (f.state.world.season === 1) { for (const x of f.playerFixtures()) await f.forfeit(x.id); await f.advanceRound(); } });
step(`Season 1 completed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.locator('[data-testid="ceremony-continue"]').click({ timeout: 3000 }).catch(() => {});
await page.waitForFunction(() => window.__crown.legacy.awards.has('monument-seasons:1'), null, { timeout: 30000 });
await page.goto(url + '#/dashboard');
await page.waitForSelector('[data-testid="trophy-ceremony"]', { timeout: 15000 });
const cer = await page.evaluate(() => ({ text: document.querySelector('[data-testid="trophy-ceremony"]').innerText.replace(/\s+/g, ' '), anim: getComputedStyle(document.querySelector('[data-testid="trophy-ceremony"]')).animationName, fixed: getComputedStyle(document.querySelector('[data-testid="trophy-ceremony"]')).position }));
check(4, /Trophy awarded/.test(cer.text) && cer.anim === 'none' && cer.fixed !== 'fixed', `Ceremony in flow, reduced motion respected (animation ${cer.anim}): "${cer.text.slice(0, 120)}"`);
await page.screenshot({ path: SHOTS + 'trophy-ceremony-desktop.png' });
for (let i = 0; i < 6 && await page.locator('[data-testid="trophy-ceremony-continue"]').count(); i++) await page.locator('[data-testid="trophy-ceremony-continue"]').click();

await page.goto(url + '#/hall');
await page.waitForSelector('[data-testid="trophy-card"]');
const hall = await page.evaluate(() => ({ cards: [...document.querySelectorAll('[data-testid="trophy-card"]')].map(c => c.getAttribute('data-key')), defs: document.querySelectorAll('[data-testid="trophy-def"]').length, kinds: new Set([...document.querySelectorAll('[data-testid="trophy-def"] svg')].map(s => s.getAttribute('data-kind'))).size, awards: [...window.__crown.legacy.awards.keys()] }));
check(5, hall.cards.includes('monument-seasons:1') && hall.defs >= 10 && hall.kinds === 10 && hall.cards.length === hall.awards.length, `Trophy Hall: ${hall.cards.join(', ')}; registry ${hall.defs} trophies in ${hall.kinds} kinds`);
await page.locator('[data-testid="trophy-card"][data-key="monument-seasons:1"]').getByRole('button', { name: 'Feature' }).click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid="header-trophies"] svg.trophy-art').length === 1);
await page.locator('[data-testid="trophy-registry"] summary').click();
await page.screenshot({ path: SHOTS + 'trophy-hall-desktop.png', fullPage: true });

// customise: region banner and steel accent (earned/always), an unearned accent is refused
await page.goto(url + '#/profile');
await page.waitForSelector('[data-testid="legacy-banners"] .legacy-choice');
await page.locator('[data-testid="legacy-banners"]').getByRole('button', { name: /Arms of/ }).click();
await page.locator('[data-testid="legacy-accents"]').getByRole('button', { name: /Steel/ }).click();
await page.locator('[data-testid="legacy-name"]').fill('Ines of the Six Squares');
await page.locator('[data-testid="legacy-customise"]').getByRole('button', { name: 'Save' }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="header-name"]')?.textContent === 'Ines of the Six Squares' && !!document.querySelector('[data-testid="header-banner"]'));
const refused = await page.evaluate(async () => { try { await window.__crown.legacy.change({ field: 'accent', value: 'gold' }); return false; } catch (e) { return /not unlocked/.test(e.message); } });
const goldLocked = await page.locator('[data-testid="legacy-accents"]').getByRole('button', { name: /Gold/ }).isDisabled();
check(6, refused && goldLocked, `Earned banner/accent equipped; an unearned accent is refused (${refused}) and its button disabled (${goldLocked})`);
await page.goto(url + '#/dashboard');
await page.waitForTimeout(1600);
await page.evaluate(() => scrollTo(0, 0));
await page.screenshot({ path: SHOTS + 'header-desktop.png', clip: { x: 0, y: 0, width: 1366, height: 260 } });
const hd = await honours(page);
check('Q-1366', honoursOk(hd), `1366 px: header "${hd.area}" (rank frame r=${hd.frameRadius}px, rank tooltip)${hd.fedArea ? `, "${hd.fedArea}"` : ', no Federation Title yet (no title area)'}; rating title tagged "${hd.ratingTag}"; heading "${hd.head}" / "${hd.title}" with separate tooltips`);

// ---- reload: no duplicates, choices kept, no repeated ceremony
const before = await page.evaluate(() => window.__crown.legacy.awards.size);
await page.reload(); await legacyReady(page); await page.waitForTimeout(2500);
const after = await page.evaluate(async () => ({ size: window.__crown.legacy.awards.size, stored: (await window.__crown.db.metaWithPrefix('trophy:')).length, ceremony: !!document.querySelector('[data-testid="trophy-ceremony"]'), name: document.querySelector('[data-testid="header-name"]')?.textContent, featured: document.querySelectorAll('[data-testid="header-trophies"] svg.trophy-art').length }));
check(7, after.size === before && after.stored === before && !after.ceremony && after.name === 'Ines of the Six Squares' && after.featured === 1, `Reload: ${after.size}/${before} trophies (${after.stored} stored), ceremony again ${after.ceremony}, name "${after.name}", featured ${after.featured}`);
await ctx.close();

// ---- 390 px: compact header, expand/collapse, scroll to the bottom of every main screen
ctx = await chromium.launchPersistentContext(OUT + 'profile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
page = ctx.pages()[0] ?? await ctx.newPage();
watch(page);
await page.goto(url + '#/dashboard'); await legacyReady(page); await page.waitForTimeout(1600);
const compact = await page.evaluate(() => { const b = document.querySelector('[data-testid="identity-banner"]'); const vis = s => { const e = b.querySelector(s); return !!e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none'; }; return { h: Math.round(b.getBoundingClientRect().height), division: vis('[data-testid="header-division"]'), trophies: vis('[data-testid="header-trophies"]'), elo: vis('[data-testid="banner-rating"]'), toggle: vis('[data-testid="header-toggle"]') }; });
await page.screenshot({ path: SHOTS + 'header-phone-compact.png', clip: { x: 0, y: 0, width: 390, height: 300 } });
const hp = await honours(page);
check('Q-390', honoursOk(hp), `390 px (compact header): "${hp.area}" visible ${hp.areaVisible}${hp.fedArea ? `, "${hp.fedArea}"` : ''}; rating title tagged "${hp.ratingTag}"; heading "${hp.head}" / "${hp.title}" with separate tooltips`);
await page.locator('[data-testid="header-toggle"]').click();
const expanded = await page.evaluate(() => { const b = document.querySelector('[data-testid="identity-banner"]'); const vis = s => { const e = b.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; }; return { h: Math.round(b.getBoundingClientRect().height), division: vis('[data-testid="header-division"]'), trophies: vis('[data-testid="header-trophies"]'), networth: vis('[data-testid="header-networth"]'), aria: document.querySelector('[data-testid="header-toggle"]').getAttribute('aria-expanded'), overflow: document.documentElement.scrollWidth - innerWidth }; });
await page.screenshot({ path: SHOTS + 'header-phone-expanded.png', clip: { x: 0, y: 0, width: 390, height: 520 } });
await page.locator('[data-testid="header-toggle"]').click();
const collapsed = await page.evaluate(() => Math.round(document.querySelector('[data-testid="identity-banner"]').getBoundingClientRect().height));
check(8, compact.elo && compact.toggle && !compact.division && !compact.trophies && expanded.division && expanded.trophies && expanded.networth && expanded.aria === 'true' && expanded.h > compact.h && collapsed === compact.h && expanded.overflow <= 0,
  `Phone header: compact ${compact.h}px (Elo, toggle; details hidden) → expanded ${expanded.h}px (division, trophies, net worth) → collapsed ${collapsed}px; overflow ${expanded.overflow}`);

const ROUTES = ['dashboard', 'play', 'world', 'exchange', 'finance', 'library', 'analysis', 'academy', 'profile', 'rivals', 'hall', 'vault', 'lab', 'settings', 'standings', 'tournaments', 'competitors', 'replays', 'news', 'heraldry', 'forecasts', 'population'];
const bad = [];
for (const r of ROUTES) {
  await page.goto(url + '#/' + r); await page.waitForTimeout(1300);
  // scroll like a finger: repeated swipes until the page stops moving
  // (an inner list scroller under the pointer takes the wheel first and then chains to the page, so stop only after
  // three swipes in a row that did not move the page)
  let last = -1, still = 0;
  for (let i = 0; i < 120 && still < 3; i++) {
    const y = await page.evaluate(() => scrollY);
    still = y === last ? still + 1 : 0; last = y;
    await page.mouse.wheel(0, 1200); await page.waitForTimeout(120);
  }
  const m = await page.evaluate(() => {
    const tab = document.querySelector('nav.tabbar').getBoundingClientRect();
    const main = document.querySelector('main');
    const kids = [...main.children].filter(e => e.getBoundingClientRect().height > 0 && !['fixed'].includes(getComputedStyle(e).position));
    const lastBottom = Math.max(...kids.map(e => e.getBoundingClientRect().bottom));
    const fixed = [...main.querySelectorAll('*')].filter(e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().height > 0 && !e.closest('.vault-toast, .result-overlay, .ceremony-overlay, [role="dialog"]')).length;
    return { y: scrollY, max: document.documentElement.scrollHeight - innerHeight, visible: lastBottom <= tab.top + 2, overflow: document.documentElement.scrollWidth - innerWidth, fixed };
  });
  const ok = m.y >= m.max - 2 && m.visible && m.overflow <= 0 && m.fixed === 0;
  if (!ok) bad.push(`${r} ${JSON.stringify(m)}`);
  step(`  390px #/${r}: scrolled ${m.y}/${m.max}, content ends above the tab bar ${m.visible}, overflow ${m.overflow}, fixed in main ${m.fixed}`);
  if (r === 'hall' || r === 'profile') await page.screenshot({ path: SHOTS + `phone-${r}-bottom.png` });
}
check(9, bad.length === 0, `390 px: every main screen scrolls to its bottom, content clears the tab bar, no overflow, no fixed covers${bad.length ? ': ' + bad.join('; ') : ''}`);
await page.goto(url + '#/hall'); await page.waitForTimeout(1300);
await page.screenshot({ path: SHOTS + 'trophy-hall-phone.png', fullPage: true });
await ctx.close();

check(10, errors.length === 0, `No page or console errors (${errors.length})`);
writeFileSync(OUT + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
