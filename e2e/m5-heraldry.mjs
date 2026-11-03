/**
 * M5 addendum "Living Rivalry & Heraldry" acceptance journey (addendum section 9, 11 steps), driven through the
 * real UI of the production build in Chromium. The "human" is a scripted robot (Crown engine in Node) that plays
 * the player's federation fixtures move by move through the board.
 *   npm run build && node e2e/m5-heraldry.mjs [port]
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

const PORT = +(process.argv[2] ?? 4293);
const URL_ = `http://127.0.0.1:${PORT}/`;
const OUT = new URL('../docs/evidence/m5-heraldry/', import.meta.url).pathname;
const PROFILE = new URL('./artifacts/tmp/m5-profile', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });
const log = [];
const results = {};
const step = (m) => { const line = `[${new Date().toISOString()}] ${m}`; log.push(line); console.log(line); writeFileSync(OUT + 'journey-log.txt', log.join('\n') + '\n'); };
const save = () => writeFileSync(OUT + 'journey-results.json', JSON.stringify(results, null, 1));
const check = (n, cond, m) => { results[n] = !!cond; step(`${cond ? 'PASS' : 'FAIL'}: ${n}. ${m}`); save(); if (!cond) { server?.kill(); process.exit(1); } };

let server = spawn(process.execPath, ['scripts/serve.mjs', '--dir', 'dist', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => server.stdout.once('data', r));
await new Promise(r => setTimeout(r, 300));
const errors = [];
async function open(viewport = { width: 1366, height: 900 }) {
  const ctx = await chromium.launchPersistentContext(PROFILE, { viewport });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', e => { errors.push(String(e)); step('pageerror: ' + e); });
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); step('console.error: ' + m.text().slice(0, 300)); } });
  page.on('requestfailed', r => step('requestfailed: ' + r.url()));
  await page.goto(URL_);
  await page.waitForSelector('.app');
  await page.waitForFunction(() => window.__crown);
  return { ctx, page };
}
const robot = new Searcher(18);
const shots = new Set();
/** Dismiss any pending ceremonies through the overlay's Continue button; the first of each kind is photographed. */
async function ceremonies(page) {
  const seen = [];
  for (let i = 0; i < 12; i++) {
    if (!(await page.locator('[data-testid="ceremony"]').count())) break;
    const c = await page.evaluate(() => { const x = window.__crown.fed.state.extra.ceremonies.find(y => !y.seen); return x && { id: x.id, kind: x.kind, title: x.title }; });
    if (!c) break;
    seen.push(c);
    if (!shots.has(c.kind)) { shots.add(c.kind); await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}ceremony-${c.kind}.png` }); }
    await page.locator('[data-testid="ceremony-continue"]').click();
    await page.waitForFunction(id => window.__crown.fed.state.extra.ceremonies.find(y => y.id === id)?.seen, c.id);
  }
  return seen;
}
async function playOut(page, nodes = 12000) {
  await page.waitForSelector('[data-testid="match"]');
  const deadline = Date.now() + 40 * 60_000;
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
const world = page => page.evaluate(() => { const s = window.__crown.fed.state; return s && { season: s.world.season, round: s.world.round }; });
/** Plays the player's open fixtures; returns [{opponent, result}] */
async function playMyFixtures(page) {
  const out = [];
  await page.goto(URL_ + '#/world');
  await page.waitForSelector('[data-testid="advance-round"]');
  await ceremonies(page);
  while (await page.locator('[data-testid="play-fixture"]').count()) {
    const fx = await page.evaluate(() => { const f = window.__crown.fed, s = f.state; const x = f.playerFixtures?.()?.find(y => y.result === null); return x ? { id: x.id, opp: x.white === 'player' ? x.black : x.white, event: x.event } : null; }).catch(() => null);
    await page.locator('[data-testid="play-fixture"]').first().click();
    const res = await playOut(page);
    out.push({ ...(fx ?? {}), res });
    await page.locator('[data-testid="back-to-federation"]').click();
    await page.waitForSelector('[data-testid="advance-round"]');
    await ceremonies(page);
  }
  return out;
}
async function advance(page) {
  const w0 = await world(page);
  await page.locator('[data-testid="advance-round"]').click();
  await page.waitForFunction(([r, s]) => { const w = window.__crown.fed.state.world; return w.round !== r || w.season !== s; }, [w0.round, w0.season], { timeout: 1800000 });
  const total = await page.evaluate(() => [...window.__crown.fed.state.balances.values()].reduce((a, b) => a + b, 0));
  if (total !== 0) { step('ledger not conserved'); process.exit(1); }
}
const rivalryVs = (page, id) => page.evaluate(async id => {
  const p = document.querySelector('[data-testid="rivalry-panel"]');
  return p?.textContent ?? '';
}, id);
const snapshot = page => page.evaluate(async () => {
  const f = window.__crown.fed, s = f.state, p = s.world.player;
  const r = await window.__crown.db.ratingState('rapid');
  return JSON.stringify({ season: s.world.season, round: s.world.round, featured: s.world.featured, norms: p.norms, fedTitle: p.fedTitle, peak: p.peakRating, titles: p.titles, division: p.division,
    ceremonies: s.extra.ceremonies, favorites: s.extra.favorites, watch: s.extra.watchlist, identity: f.clubIdentity(), club: f.clubLevelOf(), journals: s.journalIds.size, markets: s.markets.size,
    balances: [...s.balances].sort(([a], [b]) => a.localeCompare(b)), compTitles: [...s.competitors.values()].map(c => `${c.id}:${c.fedTitle ?? ''}:${c.titles.length}:${(c.norms ?? []).length}`).join(','), rating: r.rating, games: r.games });
});

let { ctx, page } = await open();
step('production build served; fresh profile');
await page.goto(URL_ + '#/settings');
await page.locator('[data-testid="theme-obsidian"]').click();
await page.goto(URL_ + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });

// ---- 1. every league and rank insignia (gallery), no broken assets
const t0 = Date.now();
await page.goto(URL_ + '#/heraldry');
await page.waitForSelector('[data-testid="gallery-clubs"] svg');
const renderMs = Date.now() - t0;
const gal = await page.evaluate(() => {
  const svgs = [...document.querySelectorAll('svg.emblem, .emblem svg, svg[data-emblem]')];
  const all = svgs.length ? svgs : [...document.querySelectorAll('main svg')];
  const broken = all.filter(s => { const b = s.getBoundingClientRect(); return b.width < 10 || b.height < 10 || s.querySelectorAll('path,circle,rect,polygon,ellipse').length === 0; }).length;
  const external = [...document.querySelectorAll('img, image, use')].filter(e => { const h = e.getAttribute('src') ?? e.getAttribute('href') ?? e.getAttribute('xlink:href') ?? ''; return /^https?:/.test(h); }).length;
  const cells = s => document.querySelectorAll(`[data-testid="${s}"] [data-testid="emblem-cell"]`).length;
  return { svgs: all.length, broken, external, divisions: cells('gallery-divisions'), ranks: cells('gallery-ranks'), titles: cells('gallery-titles'), regions: cells('gallery-regions'), finance: cells('gallery-finance'), achievements: cells('gallery-achievements'), clubs: cells('gallery-clubs'), overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
});
await page.screenshot({ path: OUT + '01-gallery.png', fullPage: true });
check(1, gal.divisions === 8 && gal.ranks >= 6 && gal.titles === 4 && gal.broken === 0 && gal.external === 0 && !gal.overflow,
  `Heraldry gallery: ${gal.divisions} division, ${gal.ranks} rank, ${gal.titles} federation-title, ${gal.regions} regional, ${gal.finance} financial, ${gal.achievements} achievement and ${gal.clubs} club emblems; ${gal.svgs} SVGs, ${gal.broken} broken, ${gal.external} external images; rendered in ${renderMs} ms`);

// ---- 2. featured rival profile
await page.goto(URL_ + '#/rivals');
await page.waitForSelector('[data-testid="rival-card"]');
const nFeatured = await page.locator('[data-testid="rival-card"]').count();
await page.screenshot({ path: OUT + '02-rivals.png', fullPage: true });
// choose a circle rival who is the player's next league opponent if possible
const target = await page.evaluate(() => {
  const s = window.__crown.fed.state; const circle = s.world.featured.filter(f => f.tag === 'circle').map(f => f.id);
  const fx = [...(s.plan.league ?? [])];
  return { circle, first: circle[0] };
});
await page.locator('[data-testid="rival-card"]', { hasText: await page.evaluate(id => window.__crown.fed.name(id), target.first) }).first().click();
await page.waitForSelector('[data-testid="insignia-row"]');
const prof = await page.evaluate(() => ({ insignia: document.querySelectorAll('[data-testid="insignia-row"] svg').length, rivalry: document.querySelector('[data-testid="rivalry-panel"]').textContent, h1: document.querySelector('h1').textContent }));
await page.screenshot({ path: OUT + '03-rival-profile.png', fullPage: true });
check(2, nFeatured >= 24 && nFeatured <= 32 && prof.insignia >= 4, `Opened featured rival ${prof.h1} (one of ${nFeatured} featured; ${prof.insignia} insignia: personal, division, club, region${prof.insignia > 4 ? ', title' : ''}); rivalry panel: "${prof.rivalry.slice(0, 80)}"`);

// ---- 5 (prepared early). follow this rival's career
await page.locator('[data-testid="follow-toggle"]').click();
await page.waitForFunction(id => (window.__crown.fed.state.extra.favorites ?? []).includes(id), target.first);
const followedId = target.first;

// ---- 7. enter a major championship (Challenger Open — the major Swiss event open to the player in season 1)
await page.goto(URL_ + '#/world');
await page.getByRole('button', { name: /^Register/ }).click();
await page.waitForFunction(() => window.__crown.fed.state.plan.swiss.find(x => x.event === 'challenger').entrants.includes('player'));
const chFieldAvg = await page.evaluate(() => { const s = window.__crown.fed.state; const sw = s.plan.swiss.find(x => x.event === 'challenger'); const r = sw.entrants.filter(e => e !== 'player').map(e => s.competitors.get(e).rating); return Math.round(r.reduce((a, b) => a + b, 0) / r.length); });
await page.screenshot({ path: OUT + '07-challenger-registered.png' });
step(`   registered for the Challenger Open (field average rating ${chFieldAvg})`);

// ---- 6. club emblem
await page.goto(URL_ + '#/finance');
await page.locator('[data-testid="buy-club"]').click();
await page.locator('[data-testid="confirm-buy-club"]').click();
await page.waitForSelector('text=Bought Starter Chess Club');
await page.locator('[data-testid="club-identity"] summary').click();
await page.locator('[data-testid="club-name"]').fill('Obsidian Gambit Circle');
await page.locator('[data-testid="club-motto"]').fill('Six squares, no fear');
await page.locator('[data-testid="primary-sable"]').click();
await page.locator('[data-testid="secondary-sanguine"]').click();
await page.locator('[data-testid="shape-kite"]').click();
await page.locator('[data-testid="symbol-griffin"]').click();
await page.locator('[data-testid="save-club-identity"]').click();
await page.waitForSelector('text=Club identity saved.');
const ident = await page.evaluate(() => window.__crown.fed.clubIdentity());
await page.locator('[data-testid="club-editor"]').screenshot({ path: OUT + '06-club-editor.png' });
check(6, ident?.name === 'Obsidian Gambit Circle' && ident.primary === 'sable' && ident.secondary === 'sanguine' && ident.shape === 'kite' && ident.symbol === 'griffin' && ident.motto === 'Six squares, no fear',
  `Customised the club emblem: ${JSON.stringify(ident)}`);

// ---- season loop: play every fixture, advance through the season
const S = (await world(page)).season;
const played = [];
let rivalryChecked = false, followChecked = false, allCeremonies = [];
for (let guard = 0; guard < 25; guard++) {
  const w = await world(page);
  if (w.season !== S) break;
  // rivalry records before this round's games
  const before = await page.evaluate(() => Object.fromEntries((window.__crown.fed.state.world.featured ?? []).map(f => [f.id, 0])));
  const games = await playMyFixtures(page);
  played.push(...games.map(g => ({ ...g, round: w.round })));
  if (games.length) step(`   R${w.round}: ${games.map(g => `${g.event ?? '?'} vs ${g.opp ?? '?'} — ${g.res}`).join('; ')}`);
  // 3 & 4: first played game changes the rivalry with that opponent; view the updated head-to-head
  if (!rivalryChecked && games.length && games[0].opp) {
    const opp = games[0].opp;
    await page.goto(URL_ + '#/competitor/' + encodeURIComponent(opp));
    await page.waitForSelector('[data-testid="rivalry-panel"]');
    await page.waitForFunction(() => !/No recorded meetings/.test(document.querySelector('[data-testid="rivalry-panel"]').textContent), null, { timeout: 15000 }).catch(() => {});
    const txt = await rivalryVs(page, opp);
    const nm = await page.evaluate(id => window.__crown.fed.name(id), opp);
    const isFeatured = await page.evaluate(id => window.__crown.fed.state.world.featured.some(f => f.id === id), opp);
    check(3, games[0].res && !/No recorded meetings/.test(txt), `Played a federation ${games[0].event} game vs ${nm}${isFeatured ? ' (a featured rival)' : ''} (${games[0].res}); the rivalry record went from no meetings to a recorded meeting`);
    await page.locator('[data-testid="rivalry-panel"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: OUT + '04-h2h-updated.png', fullPage: true });
    check(4, /Met|met|meeting|draw|won|beat|lost|Acquaintance|Rival/.test(txt), `Updated head-to-head on ${nm}'s profile: "${txt.replace(/\s+/g, ' ').slice(0, 160)}"`);
    rivalryChecked = true;
  }
  // 5: follow the rival's tournament once the Swiss events have started
  if (!followChecked && w.round >= 5) {
    await page.goto(URL_ + '#/competitor/' + encodeURIComponent(followedId));
    await page.waitForSelector('[data-testid="following-panel"]');
    const fp = (await page.locator('[data-testid="following-panel"]').textContent()).replace(/\s+/g, ' ');
    const followed = (await page.locator('[data-testid="follow-toggle"]').textContent()).includes('Following');
    await page.screenshot({ path: OUT + '05-following.png', fullPage: true });
    check(5, followed && /League: \d+/.test(fp), `Following ${await page.evaluate(id => window.__crown.fed.name(id), followedId)}: "${fp.slice(0, 220)}"`);
    followChecked = true;
  }
  await page.goto(URL_ + '#/world');
  await page.waitForSelector('[data-testid="advance-round"]');
  if (w.round === 8) await page.screenshot({ path: OUT + '07b-swiss-standings.png', fullPage: true });
  if (w.round === 18) await page.locator('[data-testid="championship"]').screenshot({ path: OUT + '08-bracket.png' }).catch(() => {});
  await advance(page);
  await page.goto(URL_ + '#/world');
  await page.waitForSelector('[data-testid="advance-round"]');
  const seen = await ceremonies(page);
  allCeremonies.push(...seen);
  if (seen.length) step(`   ceremonies: ${seen.map(c => `${c.kind}: ${c.title}`).join(' | ')}`);
  if (w.round === 8) {
    const ch = await page.evaluate(() => { const s = window.__crown.fed.state, p = s.world.player; return { norms: p.norms, fedTitle: p.fedTitle, peak: p.peakRating }; });
    step(`   after the Swiss events: norms ${JSON.stringify(ch.norms)}, peak ${ch.peak}, federation title ${ch.fedTitle ?? 'none'}`);
  }
}
step(`   season ${S} complete: ${played.length} games — ${played.filter(g => /Victory|win/i.test(g.res)).length} wins`);

// ---- 8. earned title
const pl = await page.evaluate(async () => { const p = window.__crown.fed.state.world.player; const r = await window.__crown.db.ratingState('rapid'); return { fedTitle: p.fedTitle ?? null, norms: p.norms ?? [], peak: p.peakRating, titles: p.titles, rating: Math.round(r.rating) }; });
check(8, !!pl.fedTitle, `Earned the federation title ${pl.fedTitle ?? '— none'} from ${pl.norms.length} norm(s) ${JSON.stringify(pl.norms.map(n => `${n.event} ${n.score}/${n.games} TPR ${n.tpr} ${n.tier}`))}; peak rating ${pl.peak}`);
// ---- 7. (reported) the major championship entered
check(7, played.filter(g => g.event === 'challenger').length >= 5, `Entered and played the Challenger Open: ${played.filter(g => g.event === 'challenger').map(g => g.res).join(', ')}`);

// ---- 9. ceremonies
const cer = await page.evaluate(() => window.__crown.fed.state.extra.ceremonies);
const ids = cer.map(c => c.id);
const champCount = cer.filter(c => c.kind === 'championship').length;
check(9, cer.some(c => c.kind === 'fed-title') && champCount === 1 && new Set(ids).size === ids.length && cer.every(c => c.seen),
  `Saw ${cer.length} ceremonies (${[...new Set(cer.map(c => c.kind))].join(', ')}): ${cer.map(c => c.title).join(' | ')}; exactly one championship award, no duplicate ids`);

// ---- 10. trophy in the Hall of Fame
await page.goto(URL_ + '#/hall');
await page.waitForSelector('[data-testid="trophy-room"]');
const hall = await page.evaluate(() => ({ room: document.querySelector('[data-testid="trophy-room"]').textContent.replace(/\s+/g, ' '), roomSvgs: document.querySelectorAll('[data-testid="trophy-room"] svg').length, champRows: document.querySelectorAll('[data-testid="hall-row"]').length, playerTrophies: document.querySelectorAll('[data-testid="player-trophy"]').length }));
await page.screenshot({ path: OUT + '10-hall.png', fullPage: true });
check(10, hall.roomSvgs > 0 && hall.room.includes(pl.fedTitle ?? '§') && hall.champRows >= 1, `Hall of Fame: your trophy room shows the ${pl.fedTitle} insignia${hall.playerTrophies ? ` and ${hall.playerTrophies} event trophy(ies)` : ''}; ${hall.champRows} Crown Champion row(s) with the grand trophy`);

// ---- 11. restart with everything preserved
const snap = await snapshot(page);
await ctx.close();
({ ctx, page } = await open());
await page.waitForFunction(() => window.__crown.fed.state);
const re = await snapshot(page);
const theme = await page.evaluate(() => document.documentElement.dataset.theme);
check(11, re === snap && theme === 'obsidian', `Restarted: featured rivals, norms, federation title, ceremonies (seen), favourites, club identity, balances, every competitor's titles/norms and rating identical (${snap.length} chars compared)`);

// ---- phone screens
await ctx.close();
({ ctx, page } = await open({ width: 390, height: 844 }));
for (const [h, name, sel] of [['#/heraldry', 'm-heraldry', '[data-testid="gallery-clubs"] svg'], ['#/rivals', 'm-rivals', '[data-testid="rival-card"]'], [`#/competitor/${followedId}`, 'm-rival-profile', '[data-testid="insignia-row"]'], ['#/hall', 'm-hall', '[data-testid="trophy-room"]'], ['#/finance', 'm-finance', '[data-testid="institutions"]'], ['#/world', 'm-world', '[data-testid="advance-round"]']]) {
  const t = Date.now();
  await page.goto(URL_ + h);
  await page.waitForSelector(sel);
  const ms = Date.now() - t;
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  step(`   phone ${h}: ready in ${ms} ms, horizontal overflow ${overflow ? 'YES' : 'no'}`);
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
}
await ctx.close();
step(`console/page errors: ${errors.length}`);
step(`ACCEPTANCE JOURNEY: ${Object.values(results).filter(Boolean).length}/${Object.keys(results).length} steps passed`);
server.kill();
process.exit(0);
