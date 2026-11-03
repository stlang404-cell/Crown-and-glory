/**
 * Visual showcase: screenshots of the REAL running production build, using careers created by the executed
 * acceptance journeys (no seeded or edited data). Each career lives in its own browser profile and origin, so each
 * is served on the port its journey used. Profiles are copied first, so the journeys' evidence stays untouched.
 *   npm run build && node e2e/m6-showcase.mjs
 * Output: docs/screenshots/m6/*.png, docs/screenshots/m6/live-arena.webm (+ .gif if ffmpeg exists), INDEX.md data.
 */
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SHOTS = new URL('../docs/screenshots/m6/', import.meta.url).pathname;
const TMP = new URL('./artifacts/tmp/showcase/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
const index = [];
const note = (file, desc, source) => { index.push({ file, desc, source }); console.log(file, '—', desc); };

let server = null;
async function serve(port) {
  if (server) { server.kill(); await new Promise(r => setTimeout(r, 400)); }
  server = spawn(process.execPath, ['scripts/serve.mjs', '--dir', 'dist', '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const first = await new Promise(r => server.stdout.once('data', d => r(String(d))));
  if (!first.includes(`:${port}/`) || first.includes('already running')) throw new Error('stale server on ' + port);
}
async function session(profileName, port, viewport, fn, video = false) {
  const src = new URL(`./artifacts/tmp/${profileName}`, import.meta.url).pathname;
  if (!existsSync(src)) { console.log('missing profile', profileName); return; }
  const dir = TMP + profileName + '-' + viewport.width;
  cpSync(src, dir, { recursive: true });
  await serve(port);
  const ctx = await chromium.launchPersistentContext(dir, { viewport, deviceScaleFactor: 2, ...(video ? { recordVideo: { dir: TMP + 'video', size: viewport } } : {}) });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const base = `http://127.0.0.1:${port}/`;
  await page.goto(base); await page.waitForSelector('.app'); await page.waitForFunction(() => window.__crown?.fed);
  // dismiss pending ceremonies so they do not cover the screens
  for (let i = 0; i < 8 && await page.locator('[data-testid="ceremony-continue"]').count(); i++) { await page.locator('[data-testid="ceremony-continue"]').click(); await page.waitForTimeout(250); }
  await fn(page, base);
  await ctx.close();
}
const shot = async (page, file, full = true) => { await page.waitForTimeout(700); await page.screenshot({ path: SHOTS + file, fullPage: full }); };
const D = { width: 1440, height: 1000 }, M = { width: 390, height: 844 };

// ---- M4 journey career (full season: trading, club with venue, contracts, forecasts, sandbox) — port 4291
await session('m4-profile', 4291, D, async (page, base) => {
  await page.goto(base + '#/world'); await page.waitForSelector('[data-testid="advance-round"]');
  await shot(page, '01-dashboard-federation.png', false); note('01-dashboard-federation.png', 'Main dashboard: the Federation screen with navigation, fixtures, standings and featured matches (season 2).', 'm4 journey career');
  await page.goto(base + '#/play'); await shot(page, '01b-dashboard-play.png', false); note('01b-dashboard-play.png', 'Play home: opponent ladder L1–L9 including Sovereign Max, match settings.', 'm4 journey career');
  await page.goto(base + '#/exchange'); await shot(page, '05-grand-exchange.png'); note('05-grand-exchange.png', 'Grand Exchange: open markets, families, portfolio.', 'm4 journey career');
  const mk = await page.evaluate(() => { const f = window.__crown.fed; return [...f.state.markets.values()].find(m => m.status === 'open' && m.kind && m.kind !== 'match')?.id ?? [...f.state.markets.values()].find(m => m.status === 'open')?.id; });
  if (mk) { await page.goto(base + '#/exchange/' + encodeURIComponent(mk)); await page.waitForSelector('[data-testid="ticket"]'); await shot(page, '05b-exchange-market.png'); note('05b-exchange-market.png', 'A market: research, model vs price, price history and the trade ticket.', 'm4 journey career'); }
  await page.goto(base + '#/forecasts'); await shot(page, '05c-forecasting.png'); note('05c-forecasting.png', 'Forecasting companion: Brier/log scores and calibration.', 'm4 journey career');
  await page.goto(base + '#/finance'); await page.waitForSelector('[data-testid="networth"]'); await shot(page, '07-finance-clubs.png'); note('07-finance-clubs.png', 'Finance: cash, assets, positions, net worth history, financial prestige, club (Tournament Venue) and sponsorship contracts, cosmetics shop.', 'm4 journey career');
  await page.goto(base + '#/tournaments'); await shot(page, '08-tournaments.png'); note('08-tournaments.png', 'Tournaments: Swiss standings, Club Weekend and Crown Championship bracket.', 'm4 journey career');
});
await session('m4-profile', 4291, M, async (page, base) => {
  for (const [h, f, d] of [['#/world', '10b-mobile-federation.png', 'Phone: Federation dashboard.'], ['#/exchange', '10c-mobile-exchange.png', 'Phone: Grand Exchange.'], ['#/finance', '10d-mobile-finance.png', 'Phone: Finance and clubs.']]) { await page.goto(base + h); await shot(page, f); note(f, d, 'm4 journey career'); }
});

// ---- M5 journey career (season 2: Squire, trophies, club identity, rivals) — port 4293
await session('m5-profile', 4293, D, async (page, base) => {
  await page.goto(base + '#/profile'); await page.waitForSelector('[data-testid="career-standing"]'); await shot(page, '04-career-passport.png'); note('04-career-passport.png', 'Career Passport: rating, rank, career standing (six separate records), title progress, trophies, achievements.', 'm5 journey career');
  await page.goto(base + '#/hall'); await shot(page, '08b-hall-of-fame.png'); note('08b-hall-of-fame.png', 'Hall of Fame: trophy room, Crown Champions with final replay, event champions, Paladins and Sovereigns.', 'm5 journey career');
  await page.goto(base + '#/rivals'); await shot(page, '08c-rivals.png', false); note('08c-rivals.png', 'Featured rivals with insignia, clubs, ambitions and rivalry intensity.', 'm5 journey career');
  const rid = await page.evaluate(() => window.__crown.fed.state.world.featured.find(f => f.tag === 'circle').id);
  await page.goto(base + '#/competitor/' + encodeURIComponent(rid)); await page.waitForSelector('[data-testid="insignia-row"]'); await shot(page, '08d-rival-profile.png'); note('08d-rival-profile.png', 'Competitor career: insignia, rivalry with you, this season, head-to-head, career by season.', 'm5 journey career');
  await page.goto(base + '#/heraldry'); await shot(page, '09-heraldry-ladders.png'); note('09-heraldry-ladders.png', 'Rank ladders and emblems: 8 league divisions, 7 rating ranks, 4 federation titles, regions, tournaments, trophies, clubs, achievements.', 'm5 journey career');
  await page.goto(base + '#/finance');
  if (await page.locator('[data-testid="club-identity"] summary').count()) { await page.locator('[data-testid="club-identity"] summary').click(); await page.locator('[data-testid="club-editor"]').screenshot({ path: SHOTS + '09b-club-editor.png' }); note('09b-club-editor.png', 'Club identity editor: name, motto, colours, shield, field and symbol.', 'm5 journey career'); }
  await page.goto(base + '#/settings'); await shot(page, '09c-settings-customisation.png'); note('09c-settings-customisation.png', 'Customisation: three themes, board palettes (two premium, locked until unlocked), motion, chess-intelligence panel.', 'm5 journey career');
});
await session('m5-profile', 4293, M, async (page, base) => {
  await page.goto(base + '#/profile'); await shot(page, '10e-mobile-passport.png'); note('10e-mobile-passport.png', 'Phone: Career Passport.', 'm5 journey career');
});

// ---- v0.5 journey career (Sovereign Max game, analysis, cosmetics) — port 4295
await session('v5-profile', 4295, D, async (page, base) => {
  // the analysed game with the widest spread of genuinely earned grades
  const pick = await page.evaluate(async () => {
    const want = ['brilliant', 'great', 'best', 'mistake', 'blunder'];
    const rs = (await window.__crown.db.allReports()).filter(r => r.status === 'complete' && !r.gameId.startsWith('wg:') && r.engine.buildId === 'crown-search-2+crown-eval-4');
    const scored = rs.map(r => ({ id: r.gameId, n: new Set(r.plies.map(p => p.grade).filter(g => want.includes(g))).size, grades: r.plies.reduce((a, p) => { a[p.grade ?? 'none'] = (a[p.grade ?? 'none'] ?? 0) + 1; return a; }, {}) }));
    return scored.sort((a, b) => b.n - a.n)[0];
  });
  if (pick) {
    await page.goto(base + '#/analysis/' + encodeURIComponent(pick.id)); await page.waitForSelector('[data-ply="3"]', { timeout: 60000 });
    const ply = await page.evaluate(async id => { const r = (await window.__crown.db.allReports()).filter(x => x.gameId === id && x.status === 'complete' && x.engine.buildId === 'crown-search-2+crown-eval-4')[0]; const i = r.plies.findIndex(p => p.grade === 'blunder' || p.grade === 'mistake' || p.grade === 'brilliant'); return i >= 0 ? i + 1 : 3; }, pick.id);
    await page.click(`[data-ply="${ply}"]`); await shot(page, '06-chess-analysis.png'); note('06-chess-analysis.png', `Chess analysis of a finished game (grades in this game: ${JSON.stringify(pick.grades)}).`, 'v0.5 journey career');
  }
  await page.goto(base + '#/finance'); await page.locator('[data-testid="cosmetics"]').scrollIntoViewIfNeeded(); await page.locator('[data-testid="cosmetics"]').screenshot({ path: SHOTS + '09d-cosmetics.png' }); note('09d-cosmetics.png', 'Cosmetics: frames, banners, premium boards, portraits — bought with fictional crowns or earned.', 'v0.5 journey career');
  await page.goto(base + '#/lab'); await shot(page, '06b-lab.png'); note('06b-lab.png', 'Chess Intelligence Lab (one methodology, evidence thresholds).', 'v0.5 journey career');
  await page.goto(base + '#/academy'); await shot(page, '06c-academy.png', false); note('06c-academy.png', 'Crown Academy with the re-verified puzzle library.', 'v0.5 journey career');
});

// ---- M6 Arena journey career — live match video + bracket — port 4299
await session('m6-profile', 4299, D, async (page, base) => {
  await page.goto(base + '#/tournaments'); await shot(page, '08e-championship-bracket.png'); note('08e-championship-bracket.png', 'Crown Championship bracket during the round of 16 (rivalry previews, crests).', 'm6 Arena journey career');
  // a second championship game, watched live with in-play trading (recorded as video)
  const fx = await page.evaluate(() => { const f = window.__crown.fed; return f.featuredFixtures().find(y => y.event === 'champ' && y.result === null && f.marketFor(y.id)?.status === 'open')?.id; });
  if (fx) {
    await page.goto(base + '#/watch/' + encodeURIComponent(fx)); await page.waitForSelector('[data-testid="start-inplay"]');
    await page.locator('[data-testid="start-inplay"]').click(); await page.waitForSelector('[data-testid="inplay"]');
    await page.getByRole('button', { name: '1 s', exact: true }).click(); await page.locator('[data-testid="auto-run"]').click();
    await page.waitForTimeout(15000);
    await shot(page, '02b-live-arena-midgame.png', false); note('02b-live-arena-midgame.png', 'Live Arena mid-game (another championship match): published evaluation, live odds, price history; no labels while trading.', 'm6 Arena journey career');
    await page.waitForTimeout(12000);
  }
}, true);
server?.kill();

// video → gif
const vids = existsSync(TMP + 'video') ? require('node:fs').readdirSync(TMP + 'video').filter(f => f.endsWith('.webm')) : [];
if (vids.length) {
  const v = TMP + 'video/' + vids[vids.length - 1];
  cpSync(v, SHOTS + 'live-arena.webm');
  note('live-arena.webm', 'Video: a live championship match advancing with in-play windows; the market and evaluation update per published move.', 'm6 Arena journey career');
  const r = spawnSync('ffmpeg', ['-y', '-ss', '3', '-t', '20', '-i', v, '-vf', 'fps=6,scale=900:-1:flags=lanczos', SHOTS + 'live-arena.gif'], { stdio: 'ignore' });
  if (r.status === 0) note('live-arena.gif', 'GIF excerpt of the same live match.', 'm6 Arena journey career');
}
writeFileSync(SHOTS + 'showcase-index.json', JSON.stringify(index, null, 1));
process.exit(0);
