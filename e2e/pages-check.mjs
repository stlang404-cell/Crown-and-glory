/**
 * GitHub Pages / installed-PWA check (Chromium, iPhone-sized viewport — not Safari, not a physical iPhone).
 * Serves a production build under a project-site subpath exactly like GitHub Pages (static files only, no SPA
 * fallback, no special headers), then verifies: manifest + icons + scope; service worker scope and full precache;
 * build identity (window.__crownBuild, version.json, Settings → About); engine move and analysis workers; Federation
 * founding + a round + a market trade; offline reload with AI play and saved data intact; and the update lifecycle
 * between two real builds A and B (different version/commit):
 *   - idle: a foreground (visibilitychange) re-check finds the update, it installs and activates by itself, saves kept;
 *   - in a game: NOT applied, "Restart to Update" shown, the game continues; applied once the player leaves the game;
 *   - with an Exchange position: balances and positions identical after the update;
 *   - interrupted: one file of the new build fails to download → install fails, the old version keeps working
 *     (also offline), nothing waits; once the file is back the update completes.
 * Usage (see docs/IPHONE_PAGES.md):
 *   npx vite build --outDir /tmp/a && CROWN_VERSION=0.8.1 CROWN_COMMIT=bbbbbbb npx vite build --outDir /tmp/b
 *   node e2e/pages-check.mjs /tmp/a /tmp/b [subpath=/Crown-and-glory/]
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [distA, distB] = [process.argv[2], process.argv[3]];
const BASE = process.argv[4] ?? '/Crown-and-glory/';
const ART = new URL('./artifacts/pages-check/', import.meta.url).pathname;
const SHOTS = new URL('../docs/screenshots/pages/', import.meta.url).pathname;
rmSync(ART, { recursive: true, force: true }); mkdirSync(ART, { recursive: true }); mkdirSync(SHOTS, { recursive: true });
const log = []; let failed = 0;
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };
const check = (id, ok, m) => { step(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };

// ---- GitHub-Pages-like static server: only files under BASE; directory → index.html; everything else 404
let root = distA;
const fail = new Set(); // paths (relative to BASE) answered with 503: simulates a file that fails to download
const hits = [];        // request log (path) for version.json / sw.js checks
const buildOf = d => JSON.parse(readFileSync(path.join(d, 'version.json'), 'utf8'));
const A = buildOf(distA), B = buildOf(distB);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!u.startsWith(BASE)) { res.writeHead(404); return res.end('not found'); }
  hits.push(u.slice(BASE.length));
  if (fail.has(u.slice(BASE.length))) { res.writeHead(503); return res.end('unavailable'); }
  let p = path.join(root, u.slice(BASE.length));
  try { if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html'); const b = await readFile(p); res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(4420, '127.0.0.1', r));
const url = `http://127.0.0.1:4420${BASE}`;
step(`serving ${distA} at ${url} (GitHub Pages layout, static only); build A v${A.version} ${A.commit}, build B v${B.version} ${B.commit}`);
if (A.commit === B.commit && A.version === B.version) { console.error('builds A and B must differ in version or commit'); process.exit(2); }

const ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = []; const failedReq = [];
page.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); });
let expectFail = false; // during the interrupted-update check the injected 503s are expected
const noise = u => u.includes('__crown-health') || u.includes('version.json') || expectFail;
page.on('requestfailed', r => { if (!noise(r.url())) failedReq.push(r.url()); });
page.on('response', r => { if (r.status() >= 400 && !noise(r.url())) failedReq.push(`${r.status()} ${r.url()}`); });
async function buildIdentity() {
  const back = page.url();
  await page.goto(url + '#/settings');
  const about = (await page.locator('[data-testid="build-info"]').textContent({ timeout: 15000 }))?.trim() ?? '';
  const r = await page.evaluate(async () => ({ running: window.__crownBuild, server: await (await fetch('version.json', { cache: 'no-store' })).json() }));
  await page.goto(back);
  return { ...r, about };
}
/** The app comes back to the foreground (what iOS does when a Home Screen app is reopened): visibilitychange → visible. */
async function foreground() {
  await page.evaluate(() => {
    window.__crownUpdate.throttleMs = 0;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
const keptAll = (b, a) => b.ids.every(id => a.ids.includes(id)); // every record saved before is still there (new analysis reports may appear)
const diff = (b, a) => JSON.stringify({ lostPos: b.pos.filter(x => !a.pos.includes(x)), newPos: a.pos.filter(x => !b.pos.includes(x)), lostBal: b.bal.filter(x => !a.bal.includes(x)), newBal: a.bal.filter(x => !b.bal.includes(x)) });
const running = () => page.evaluate(() => window.__crownBuild);
const waitBuild = (b, timeout = 60000) => page.waitForFunction(c => window.__crownBuild?.commit === c && window.__crown, b.commit, { timeout }).then(() => true).catch(() => false);
const swState = () => page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const keys = (await caches.keys()).filter(k => k.startsWith('crown-' + r.scope)); return { waiting: !!r.waiting, installing: !!r.installing, active: r.active?.state, caches: keys.length }; });
const snapshot = () => page.evaluate(async () => {
  const d = await window.__crown.db.dump(); const f = window.__crown.fed;
  const pos = [...(f.state?.positions?.values() ?? [])].filter(p => String(p.holder).startsWith('player')).map(p => JSON.stringify(p)).sort();
  const bal = [...(f.state?.balances?.entries() ?? [])].filter(([a]) => a.startsWith('player') || a.startsWith('sandbox')).map(([a, b]) => `${a}=${b}`).sort();
  return { ids: [...d.games.map(g => g.id), ...d.reports.map(r => r.id), ...d.ratingEvents.map(e => e.id)].sort(), games: d.games.length, round: f.state?.world.round, pos, bal };
});
async function startCasual() {
  await page.goto(url + '#/play');
  await page.getByRole('button', { name: /Mira Vell/ }).click();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Casual', exact: true }).click();
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('button', { name: /Start match/i }).click();
  await page.waitForSelector('[data-testid="match"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 30000 });
}
/** Play one black move by tapping squares (tries simple pawn pushes / knight hops until the position changes). */
async function blackMove() {
  const before = await page.getAttribute('[data-testid="match"]', 'data-fen');
  for (const [a, b] of [['c5', 'c4'], ['d5', 'd4'], ['b5', 'b4'], ['e5', 'e4'], ['a5', 'a4'], ['f5', 'f4'], ['b6', 'c4'], ['e6', 'd4']]) {
    await page.click(`[data-square="${a}"]`).catch(() => {}); await page.click(`[data-square="${b}"]`).catch(() => {});
    await page.waitForTimeout(300);
    if ((await page.getAttribute('[data-testid="match"]', 'data-fen')) !== before) break;
  }
  const after = await page.getAttribute('[data-testid="match"]', 'data-fen');
  // the engine replied when it is the human's turn again in a position different from the one before Black's move
  const replied = await page.waitForFunction(f => { const m = document.querySelector('[data-testid="match"]'); return m?.getAttribute('data-turn') === 'human' && m.getAttribute('data-fen') !== f; }, before, { timeout: 30000 }).then(() => true).catch(() => false);
  return { moved: after !== before, replied };
}

await page.goto(url);
await page.waitForFunction(() => window.__crown, null, { timeout: 30000 });

// 1. manifest, icons, iOS tags
const man = await page.evaluate(async () => {
  const href = document.querySelector('link[rel="manifest"]').href;
  const m = await (await fetch(href)).json();
  const abs = s => new URL(s, href).href;
  const icons = await Promise.all(m.icons.map(async i => (await fetch(abs(i.src))).status));
  const touch = document.querySelector('link[rel="apple-touch-icon"]').href;
  return { href, start: abs(m.start_url), scope: abs(m.scope), display: m.display, icons, touch: (await fetch(touch)).status, capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content };
});
check(1, man.start === url && man.scope === url && man.display === 'standalone' && man.icons.every(s => s === 200) && man.touch === 200 && man.capable === 'yes',
  `Manifest at ${man.href}: start_url ${man.start}, scope ${man.scope}, display ${man.display}, icons ${man.icons}, apple-touch-icon ${man.touch}, apple-mobile-web-app-capable ${man.capable}`);

// 2. service worker scope + full precache
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 }).catch(() => {});
if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 }); }
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const keys = await caches.keys();
  const mine = keys.filter(k => k.startsWith('crown-' + reg.scope));
  const c = await caches.open(mine[0]);
  const reqs = await c.keys();
  const src = await (await fetch(reg.active.scriptURL)).text();
  const list = JSON.parse(src.match(/const PRECACHE = (\[.*?\]);/s)[1]);
  return { scope: reg.scope, caches: keys, cached: reqs.length, listed: list.length, missing: list.filter(f => !reqs.some(r => r.url === new URL(f, reg.scope).href)), versionCached: reqs.some(r => r.url.endsWith('version.json')) };
});
check(2, sw.scope === url && sw.caches.length === 1 && sw.missing.length === 0 && sw.cached >= sw.listed && !sw.versionCached,
  `Service worker scope ${sw.scope}; cache ${sw.caches[0]?.slice(0, 60)}…; ${sw.cached} cached of ${sw.listed} precache entries; missing ${JSON.stringify(sw.missing)}; version.json cached ${sw.versionCached}`);
const idA = await buildIdentity();
check('2b', idA.running.commit === A.commit && idA.running.version === A.version && idA.server.commit === A.commit && idA.about.includes(`Version ${A.version} · commit ${A.commit}`),
  `Build identity: running ${JSON.stringify(idA.running)}; version.json ${idA.server.version}/${idA.server.commit}; Settings → About "${idA.about}"`);

// 3. play: engine worker answers; a game is saved
await page.goto(url + '#/play');
await page.getByRole('button', { name: /Mira Vell/ }).click();
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Casual', exact: true }).click();
await page.getByRole('button', { name: 'Black', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 30000 });
const fen1 = await page.getAttribute('[data-testid="match"]', 'data-fen');
check(3, !fen1.startsWith('rnqknr/pppppp/6/6/PPPPPP/'), `Engine worker played White's first move under the subpath (FEN ${fen1})`);
await page.getByRole('button', { name: /Resign/ }).first().click();
await page.getByRole('button', { name: 'Yes, Resign' }).click();
await page.waitForSelector('.result-overlay');

// 4. Federation simulation + market trade (online first)
await page.goto(url + '#/world');
await page.getByRole('button', { name: 'Found the federation' }).click();
await page.waitForSelector('[data-testid="my-fixtures"]', { timeout: 60000 });
const fed = await page.evaluate(async () => { const f = window.__crown.fed; for (const x of f.playerFixtures()) await f.forfeit(x.id); await f.advanceRound(); return { round: f.state.world.round, comps: f.state.competitors.size }; });
check(4, fed.round === 2 && fed.comps > 2000, `Federation founded and a round simulated (${fed.comps} competitors, round ${fed.round})`);

// 5. offline: reload, AI play, analysis, federation round, market trade, saved data intact
await ctx.setOffline(true);
await page.reload();
await page.waitForFunction(() => window.__crown, null, { timeout: 30000 });
const off = await page.evaluate(async () => {
  const f = window.__crown.fed;
  const games = (await window.__crown.db.allGames()).length;
  for (const x of f.playerFixtures()) await f.forfeit(x.id);
  await f.advanceRound();
  const mk = [...f.state.markets.values()].find(m => m.status === 'open');
  let traded = false;
  if (mk) { try { await f.trade(mk.id, 0, 2, 'buy'); traded = true; } catch (e) { traded = String(e?.message ?? e); } }
  return { games, round: f.state.world.round, traded };
});
await page.goto(url + '#/play');
await page.getByRole('button', { name: /Tomas Rook/ }).click().catch(() => page.getByRole('button', { name: /Mira Vell/ }).click());
await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Casual', exact: true }).click();
await page.getByRole('button', { name: 'Black', exact: true }).click();
await page.getByRole('button', { name: /Start match/i }).click();
await page.waitForSelector('[data-testid="match"]');
const offMove = await page.waitForFunction(() => document.querySelector('[data-testid="match"]')?.getAttribute('data-turn') === 'human', null, { timeout: 30000 }).then(() => true).catch(() => false);
await page.screenshot({ path: SHOTS + 'offline-iphone-size-match.png' });
check(5, off.games >= 1 && off.round === 3 && offMove && off.traded === true,
  `Offline after reload: ${off.games} saved game(s) present, Federation advanced to round ${off.round}, market trade ${off.traded}, engine replied offline ${offMove}`);
await page.getByRole('button', { name: /Resign/ }).first().click();
await page.getByRole('button', { name: 'Yes, Resign' }).click();
await page.waitForSelector('.result-overlay');
const ana = await page.waitForFunction(async () => (await window.__crown.db.allReports()).filter(r => r.status === 'complete').length >= 1, null, { timeout: 240000 }).then(() => true).catch(() => false);
check(6, ana, `Analysis worker completed a report while offline`);
await ctx.setOffline(false);

// 7. update while idle, found by the foreground re-check: installs, waits, activates by itself (no tap), saves kept
await page.goto(url + '#/play'); await page.waitForFunction(() => window.__crown, null, { timeout: 30000 });
const s7 = await snapshot();
root = distB; hits.length = 0;
await page.evaluate(() => { window.__marker = 'A-page'; });
await foreground();
const t7 = Date.now();
const auto7 = await waitBuild(B, 90000);
const done7 = await page.locator('[data-testid="update-done"]').textContent({ timeout: 10000 }).catch(() => '');
const a7 = await snapshot(); const sw7 = await swState(); const id7 = await buildIdentity();
check(7, auto7 && hits.includes('version.json') && hits.includes('sw.js') && keptAll(s7, a7) && a7.round === s7.round && sw7.caches === 1 && !sw7.waiting && done7.includes(`v${B.version} (${B.commit})`) && id7.about.includes(`commit ${B.commit}`),
  `Idle update A→B: foreground re-check requested version.json + sw.js (${hits.filter(h => h === 'version.json' || h === 'sw.js').join(', ')}); activated by itself in ${((Date.now() - t7) / 1000).toFixed(1)}s, running ${JSON.stringify(await running())}; confirmation "${done7.trim()}"; ${s7.ids.length} saved records kept (round ${s7.round}→${a7.round}); caches ${sw7.caches}, waiting ${sw7.waiting}; About "${id7.about}"`);

// 8. update while a game is in progress: not applied, notice shown, game continues; applied after leaving the game
await startCasual();
const gameId = decodeURIComponent(page.url().split('#/match/')[1]);
await page.evaluate(() => { window.__marker = 'in-game'; });
root = distA;
await foreground();
const notice8 = await page.waitForSelector('[data-testid="update-ready"]', { timeout: 90000 }).then(() => true).catch(() => false);
const text8 = (await page.locator('[data-testid="update-ready"]').textContent().catch(() => '')) ?? '';
const blocker8 = await page.getAttribute('[data-testid="update-ready"]', 'data-blocker').catch(() => null);
await page.waitForTimeout(4000); // longer than the idle delay: it must still not switch
const mv8 = await blackMove();
const still8 = await page.evaluate(() => ({ marker: window.__marker, build: window.__crownBuild.commit }));
const sw8 = await swState();
await page.screenshot({ path: SHOTS + 'update-ready-in-game-iphone-size.png' });
const g8 = await page.evaluate(id => window.__crown.db.getGame(id).then(g => ({ status: g.status, plies: g.moves.length })), gameId);
await page.goto(url + '#/play'); // leave the game
const auto8 = await waitBuild(A, 60000);
const g8b = await page.evaluate(id => window.__crown.db.getGame(id).then(g => ({ status: g.status, plies: g.moves.length })), gameId);
check(8, notice8 && blocker8 === 'game-in-progress' && text8.includes('Restart to Update') && text8.includes(`v${A.version} (${A.commit})`) && still8.marker === 'in-game' && still8.build === B.commit && sw8.waiting && mv8.moved && mv8.replied && auto8 && g8b.plies === g8.plies && ['active', 'paused'].includes(g8b.status),
  `In-game update B→A: notice "${text8.trim()}" (blocker ${blocker8}); after 4s+ still running ${still8.build} on the same page (${still8.marker}), worker waiting ${sw8.waiting}; game continued (black moved ${mv8.moved}, engine replied ${mv8.replied}, ${g8.plies} plies, ${g8.status}); after leaving the game it switched by itself to ${JSON.stringify(await running())} (${auto8}); game still resumable (${g8b.status}, ${g8b.plies} plies)`);
// finish that game so later steps start clean
await page.goto(url + '#/match/' + encodeURIComponent(gameId)); await page.waitForSelector('[data-testid="match"]');
await page.getByRole('button', { name: /Resign/ }).first().click(); await page.getByRole('button', { name: 'Yes, Resign' }).click(); await page.waitForSelector('.result-overlay');

// 9. update with an Exchange position open: balances and positions identical after the update
await page.goto(url + '#/exchange'); await page.waitForFunction(() => window.__crown, null, { timeout: 30000 });
const trade9 = await page.evaluate(async () => { const f = window.__crown.fed; const mk = [...f.state.markets.values()].find(m => m.status === 'open'); if (!mk) return 'no open market'; try { await f.trade(mk.id, 0, 3, 'buy'); return true; } catch (e) { return String(e?.message ?? e); } });
const s9 = await snapshot();
root = distB;
await foreground();
const auto9 = await waitBuild(B, 90000);
await page.waitForTimeout(1500);
const a9 = await snapshot();
check(9, trade9 === true && auto9 && s9.pos.length > 0 && JSON.stringify(a9.pos) === JSON.stringify(s9.pos) && JSON.stringify(a9.bal) === JSON.stringify(s9.bal) && keptAll(s9, a9),
  `Update A→B on the Exchange with a position (trade ${trade9}): switched to ${JSON.stringify(await running())}; ${s9.pos.length} player position(s) and ${s9.bal.length} balance(s) identical (${s9.bal.join(', ')}); differences ${diff(s9, a9)}; records kept ${keptAll(s9, a9)}`);

// 10. interrupted update: one file of build A fails to download → install fails; B keeps working (online and offline)
const listA = JSON.parse(readFileSync(path.join(distA, 'sw.js'), 'utf8').match(/const PRECACHE = (\[.*?\]);/s)[1]);
const victim = listA.find(f => /^assets\/.*\.js$/.test(f) && !readFileSync(path.join(distA, 'index.html'), 'utf8').includes(f)) ?? 'icons/icon-512.png';
root = distA; fail.add(victim); expectFail = true;
await page.goto(url + '#/play'); await page.waitForFunction(() => window.__crown, null, { timeout: 30000 });
const s10 = await snapshot();
await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update().catch(() => {}); });
await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !r.installing; }, null, { timeout: 60000, polling: 500 });
await page.waitForTimeout(2500);
const sw10 = await swState();
const notice10 = await page.locator('[data-testid="update-ready"]').count();
const still10 = (await running()).commit;
await ctx.setOffline(true);
await page.reload(); await page.waitForFunction(() => window.__crown, null, { timeout: 30000 });
const off10 = await page.evaluate(() => window.__crownBuild.commit);
const a10 = await snapshot();
await page.goto(url + '#/world'); await page.waitForTimeout(800);
const works10 = (await page.locator('.main').textContent()).length > 50 && errors.length === 0;
await ctx.setOffline(false);
fail.delete(victim); expectFail = false;
await page.goto(url + '#/play'); await page.waitForFunction(() => window.__crown, null, { timeout: 30000 });
await foreground();
const rec10 = await waitBuild(A, 90000);
const sw10b = await swState();
check(10, !sw10.waiting && !sw10.installing && sw10.active === 'activated' && sw10.caches === 1 && notice10 === 0 && still10 === B.commit && off10 === B.commit && keptAll(s10, a10) && works10 && rec10 && sw10b.caches === 1,
  `Interrupted update (${victim} → 503): nothing waiting (${sw10.waiting}), old worker ${sw10.active}, ${sw10.caches} cache (half-filled cache dropped), no notice (${notice10}); still running ${still10}; offline reload runs ${off10} with all ${a10.ids.length} records; screens work ${works10}; once the file is back the update completes → ${JSON.stringify(await running())} (${rec10}), ${sw10b.caches} cache`);

const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
await page.goto(url + '#/library'); await page.waitForTimeout(800);
const backup = await page.getByRole('button', { name: /Export|Back Up|Backup/i }).count();
await page.screenshot({ path: SHOTS + 'library-backup-iphone-size.png' });
check(11, ov <= 0 && backup > 0, `Phone layout overflow ${ov}px; backup export controls present (${backup})`);
check(12, errors.length === 0 && failedReq.filter(u => !u.includes('.map')).length === 0, `No page errors (${errors.length}); failed requests ${JSON.stringify(failedReq.slice(0, 5))}`);
await ctx.close(); server.close();
writeFileSync(ART + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
