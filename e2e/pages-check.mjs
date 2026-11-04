/**
 * GitHub Pages / installed-PWA check (Chromium, iPhone-sized viewport — not Safari, not a physical iPhone).
 * Serves a production build under a project-site subpath exactly like GitHub Pages (static files only, no SPA
 * fallback, no special headers), then verifies: manifest + icons + scope; service worker scope and full precache;
 * engine move and analysis workers; Federation founding + a round + a market trade; offline reload with AI play and
 * saved data intact; a second build activating as an update with saves preserved and the update notice shown.
 *   npm run build && cp -r dist /tmp/a && (edit) … see usage in docs/IPHONE_PAGES.md
 *   node e2e/pages-check.mjs <distA> <distB> [subpath=/Crown-and-glory/]
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
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
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!u.startsWith(BASE)) { res.writeHead(404); return res.end('not found'); }
  let p = path.join(root, u.slice(BASE.length));
  try { if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html'); const b = await readFile(p); res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(4420, '127.0.0.1', r));
const url = `http://127.0.0.1:4420${BASE}`;
step(`serving ${distA} at ${url} (GitHub Pages layout, static only)`);

const ctx = await chromium.launchPersistentContext(ART + 'profile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = []; const failedReq = [];
page.on('pageerror', e => { errors.push(String(e)); step('pageerror ' + e); });
page.on('requestfailed', r => { if (!r.url().includes('__crown-health')) failedReq.push(r.url()); });
page.on('response', r => { if (r.status() >= 400 && !r.url().includes('__crown-health')) failedReq.push(`${r.status()} ${r.url()}`); });
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
  return { scope: reg.scope, caches: keys, cached: reqs.length, listed: list.length, missing: list.filter(f => !reqs.some(r => r.url === new URL(f, reg.scope).href)) };
});
check(2, sw.scope === url && sw.caches.length === 1 && sw.missing.length === 0 && sw.cached >= sw.listed,
  `Service worker scope ${sw.scope}; cache ${sw.caches[0]?.slice(0, 60)}…; ${sw.cached} cached of ${sw.listed} precache entries; missing ${JSON.stringify(sw.missing)}`);

// 3. play: engine worker answers; a game is saved
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

// 7. update: serve build B; the new worker takes over, saves are kept, notice shown
const before = await page.evaluate(async () => { const d = await window.__crown.db.dump(); return { games: d.games.length, reports: d.reports.length, ids: [...d.games.map(g => g.id), ...d.reports.map(r => r.id), ...d.ratingEvents.map(e => e.id)], round: window.__crown.fed.state.world.round }; });
root = distB;
await page.goto(url + '#/play');
const upd = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); return true; });
await page.waitForSelector('[data-testid="update-ready"]', { timeout: 60000 }).catch(() => {});
const notice = await page.locator('[data-testid="update-ready"]').count();
if (notice) await page.getByRole('button', { name: 'Reload Now' }).click(); else await page.reload();
await page.waitForFunction(() => window.__crown, null, { timeout: 30000 });
const after = await page.evaluate(async () => { const d = await window.__crown.db.dump(); const keys = await caches.keys(); return { games: d.games.length, reports: d.reports.length, ids: [...d.games.map(g => g.id), ...d.reports.map(r => r.id), ...d.ratingEvents.map(e => e.id)], round: window.__crown.fed.state.world.round, caches: keys.length, b: (await (await fetch('build-b.txt')).text()).trim() }; });
const kept = before.ids.every(id => after.ids.includes(id));
check(7, upd && notice === 1 && kept && after.round === before.round && after.caches === 1 && after.b === 'update test',
  `Update to build B (serving its new file: ${after.b === 'update test'}): notice shown ${notice === 1}; every saved record kept (${before.ids.length} ids; games ${before.games}→${after.games}, reports ${before.reports}→${after.reports}, round ${before.round}→${after.round}); old cache removed (${after.caches} cache)`);
const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
await page.goto(url + '#/library'); await page.waitForTimeout(800);
const backup = await page.getByRole('button', { name: /Export|Back Up|Backup/i }).count();
await page.screenshot({ path: SHOTS + 'library-backup-iphone-size.png' });
check(8, ov <= 0 && backup > 0, `Phone layout overflow ${ov}px; backup export controls present (${backup})`);
check(9, errors.length === 0 && failedReq.filter(u => !u.includes('.map')).length === 0, `No page errors (${errors.length}); failed requests ${JSON.stringify(failedReq.slice(0, 5))}`);
await ctx.close(); server.close();
writeFileSync(ART + 'log.txt', log.join('\n') + '\n');
step(failed ? `${failed} check(s) FAILED` : 'ALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
