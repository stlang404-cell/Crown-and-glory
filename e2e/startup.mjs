/**
 * v1.0 package R — startup budgets and the reload-visibility scenario (docs/evidence/v1.0/reload-flake.md).
 * Production build served by scripts/serve.mjs; Chromium only (a proxy for, not a measurement of, an iPhone).
 *
 *   npx vite build && node scripts/serve.mjs --dir dist --port 4460 &
 *   node e2e/startup.mjs http://127.0.0.1:4460/ [--mode all|race|reload|budget] [--runs 20] [--parallel 4]
 *        [--throttle 1,4,6] [--budget-parallel 1] [--fixture <dir>] [--out <file.json>] [--no-assert]
 *   A/B (before/after a change; runs alternate so background load hits both alike):
 *   node e2e/startup.mjs http://127.0.0.1:4502/ http://127.0.0.1:4503/ --labels before,after …
 * Defaults: 20 runs per build per scenario. The populated-career fixture is built once per port (a few minutes) in
 * $TMPDIR/crown-startup-fixture-<port> and reused; delete it to rebuild.
 *
 * race: the lost-navigation race forced deterministically (hash change between the first commit and the App's
 *   hashchange subscription): the Career Passport must be shown (`--race-runs`, default 10 per build).
 * reload: the e2e/new-career.mjs moment where the flake was seen — a fresh career plays a rated game (scripted robot),
 *   the page reloads at once (the game's background analysis is running), then the Career Passport must list the
 *   rating event. Every run is a fresh profile; `--parallel` runs at once; `--throttle` cycles CDP CPU throttling.
 * budget: a populated career (default fixture: the 10,240-competitor Federation two seasons in, 12 rated games with
 *   their analysis reports, Vault/legacy back-filled) copied into a fresh profile per run, measured as
 *   cold online (new browser, service worker installed), warm (reload in the same browser) and offline cold
 *   (new browser, network off: the service worker serves everything), at 1366 px and as a 390 px touch viewport with
 *   4× and 6× CPU throttling: time to the interactive Dashboard and time to the visible Career Passport rating events.
 * Each run records the app's startup marks (src/app/startup.ts) so a slow run shows which phase was slow.
 */
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { register } from 'tsx/esm/api';
register();
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { Position } = await import('../src/rules/position.ts');
const { moveToCcn } = await import('../src/rules/notation.ts');
const { Searcher } = await import('../src/engine/search.ts');

const args = process.argv.slice(2);
// one URL, or several (A/B: e.g. the build before and after a change, served on two ports): runs alternate between
// them so that the machine's background load affects every build alike
const URLS = args.filter(a => /^https?:/.test(a)).length ? args.filter(a => /^https?:/.test(a)) : ['http://127.0.0.1:4460/'];
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const MODE = opt('mode', 'all');
const RUNS = +opt('runs', 20);
const PARALLEL = +opt('parallel', 4);
const THROTTLES = opt('throttle', '1,4,6').split(',').map(Number);
const ASSERT = !args.includes('--no-assert');
const OUTFILE = opt('out', null);
const LABELS = (opt('labels', null) ?? URLS.map(u => new URL(u).port).join(',')).split(',');
const labelOf = base => LABELS[URLS.indexOf(base)] ?? base;
// the fixture belongs to one origin (its saves and service worker): one per port
const fixtureFor = base => opt('fixture', null) ?? join(tmpdir(), `crown-startup-fixture-${new URL(base).port}`);
const VISIBLE_TIMEOUT = 120_000; // the tail is measured, not cut off at the journeys' 30 s

/** Budgets (ms, p95 over the runs): see docs/IPHONE_PAGES.md "Startup". */
const BUDGET = {
  reloadEvents: { 1: 6000, 4: 10000, 6: 12000 },
  dashboard: { 1: 2500, 4: 8000, 6: 10000 },
  events: { 1: 3000, 4: 10000, 6: 12000 },
};

let failed = 0;
const check = (id, ok, m) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${m}`); if (!ok) failed++; };
const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const stats = xs => ({ n: xs.length, median: q(xs, 0.5), p95: q(xs, 0.95), max: xs.length ? Math.max(...xs) : null });
const fmt = s => s.n ? `median ${Math.round(s.median)} ms, p95 ${Math.round(s.p95)} ms, max ${Math.round(s.max)} ms (n ${s.n})` : 'no samples';

/** First-visibility recorder, installed before any page script: performance.now() of the first frame each selector
 *  was in the DOM (ms since this document's navigation start). */
const VIS_SCRIPT = () => {
  const want = { dashboard: '[data-testid="dashboard"]', passport: '[data-testid="current-rating"]', events: '[data-testid="rating-event"]', play: '[data-testid="beginner-group"]' };
  const seen = {};
  window.__crownVis = seen;
  const scan = () => { for (const [k, sel] of Object.entries(want)) if (!(k in seen) && document.querySelector(sel)) seen[k] = Math.round(performance.now()); };
  new MutationObserver(scan).observe(document, { childList: true, subtree: true });
  addEventListener('hashchange', () => { for (const k of Object.keys(seen)) delete seen[k]; seen.hashAt = Math.round(performance.now()); scan(); });
};

async function launch(dir, { throttle = 1, offline = false, phone = false } = {}) {
  const ctx = await chromium.launchPersistentContext(dir, phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, offline }
    : { viewport: { width: 1366, height: 900 }, offline });
  await ctx.addInitScript(VIS_SCRIPT);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  if (throttle > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  return { ctx, page, errors };
}
const marksOf = page => page.evaluate(() => ({ marks: window.__crownStartup?.marks() ?? [], vis: { ...(window.__crownVis ?? {}) } })).catch(() => ({ marks: [], vis: {} }));
const markAt = (m, name) => m.marks.find(x => x.name === name)?.t ?? null;

/** Play one rated rapid game vs the L0c beginner through the UI (as e2e/new-career.mjs does). */
async function playRatedGame(page, base) {
  await page.goto(base + '#/play');
  await page.waitForSelector('[data-testid="beginner-group"]');
  await page.locator('[data-testid="opp-beginner-L0c"]').click();
  await page.getByRole('button', { name: 'Rapid 5+3' }).click();
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Rated', exact: true }).click();
  await page.getByRole('button', { name: 'White', exact: true }).click();
  await page.getByRole('button', { name: /Start match/i }).click();
  await page.waitForSelector('[data-testid="match"]');
  const robot = new Searcher(18);
  for (let guard = 0; guard < 400; guard++) {
    const turn = await page.getAttribute('[data-testid="match"]', 'data-turn');
    if (turn === 'over') break;
    if (turn !== 'human') { await page.waitForTimeout(120); continue; }
    const fen = await page.getAttribute('[data-testid="match"]', 'data-fen');
    const mv = moveToCcn(robot.search(Position.fromFen(fen), { limits: { nodes: 20000 } }).bestMove);
    await page.click(`[data-square="${mv.slice(0, 2)}"]`);
    await page.click(`[data-square="${mv.slice(2, 4)}"]`);
    if (mv.length === 5) await page.getByRole('button', { name: { q: /Promote to queen/, r: /Promote to rook/, n: /Promote to knight/ }[mv[4]] }).click();
    await page.waitForFunction(f => document.querySelector('[data-testid="match"]')?.getAttribute('data-fen') !== f, fen, { timeout: 60000 }).catch(() => {});
  }
  await page.waitForSelector('.result-overlay', { timeout: 120000 });
}

/** One reload-visibility run: fresh profile → rated game → reload at once → Career Passport rating event visible. */
async function reloadRun(i, throttle, base) {
  const dir = mkdtempSync(join(tmpdir(), 'crown-reload-'));
  const { ctx, page, errors } = await launch(dir, { throttle });
  try {
    await page.goto(base); await page.waitForFunction(() => window.__crown);
    await playRatedGame(page, base);
    const job = await page.evaluate(async () => (await window.__crown.db.allJobs()).map(j => j.status).join(','));
    const t0 = Date.now();
    await page.reload(); await page.waitForFunction(() => window.__crown, null, { timeout: VISIBLE_TIMEOUT });
    const tReady = Date.now() - t0;
    await page.goto(base + '#/profile');
    await page.waitForSelector('[data-testid="rating-event"]', { timeout: VISIBLE_TIMEOUT });
    const total = Date.now() - t0;
    const m = await marksOf(page);
    const rows = await page.locator('[data-testid="rating-event"]').count();
    const lease = await page.evaluate(() => window.__crown.writerLease);
    return { i, label: labelOf(base), throttle, ok: rows === 1 && !errors.length && lease !== 'unavailable', total, tReady, jobAtReload: job, rows, lease, errors, ...m };
  } catch (e) {
    const m = await marksOf(page);
    return { i, label: labelOf(base), throttle, ok: false, error: String(e).slice(0, 300), errors, ...m };
  } finally { await ctx.close().catch(() => {}); rmSync(dir, { recursive: true, force: true }); }
}

async function pool(n, par, f) {
  const out = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(par, n) }, async () => { for (let i = next++; i < n; i = next++) out[i] = await f(i); }));
  return out;
}

const phaseSummary = runs => {
  const names = ['db:open:end', 'fed:read', 'fed:load:end', 'boot:end', 'render:start', 'app:mounted', 'profile:events', 'bg:start', 'analysis:job', 'vault:end', 'bg:vault:end', 'legacy:end', 'bg:legacy:end', 'playedLike:end', 'bg:playedLike:end', 'live:start', 'bg:live:start'];
  return Object.fromEntries(names.map(n => [n, stats(runs.map(r => r.marks && markAt(r, n)).filter(x => x !== null && x !== undefined))]));
};

const report = { urls: URLS, labels: LABELS, at: new Date().toISOString(), reload: null, budget: null };

const groups = (runs, f) => LABELS.flatMap(l => THROTTLES.map(t => ({ label: l, throttle: t, s: stats(runs.filter(r => r.ok && r.label === l && r.throttle === t).map(f).filter(x => Number.isFinite(x))) })));

/** The lost-navigation race made deterministic: the hash moves to #/profile right after <App>'s first commit, before
 *  React runs its effects (where the App subscribes to hashchange). Before v1.0 the screen stayed on the old view for
 *  good — the "rating event never visible after the reload" flake; now the App re-reads the hash when it subscribes. */
async function raceRun(base) {
  const dir = mkdtempSync(join(tmpdir(), 'crown-race-'));
  const { ctx, page } = await launch(dir);
  try {
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem('crown-race')) return;
      const mo = new MutationObserver(() => { if (document.querySelector('#root .app')) { mo.disconnect(); location.hash = '#/profile'; } });
      document.addEventListener('DOMContentLoaded', () => mo.observe(document.getElementById('root'), { childList: true, subtree: true }));
    });
    await page.goto(base + '#/play'); await page.waitForFunction(() => window.__crown);
    await page.evaluate(() => sessionStorage.setItem('crown-race', '1'));
    await page.reload(); await page.waitForFunction(() => window.__crown);
    const shown = await page.waitForSelector('[data-testid="current-rating"]', { timeout: 10_000 }).then(() => true, () => false);
    return { label: labelOf(base), shown, hash: await page.evaluate(() => location.hash) };
  } finally { await ctx.close().catch(() => {}); rmSync(dir, { recursive: true, force: true }); }
}

if (MODE === 'all' || MODE === 'race') {
  const n = +opt('race-runs', 10);
  const runs = await pool(n * URLS.length, Math.min(PARALLEL, 2), i => raceRun(URLS[i % URLS.length]));
  report.race = runs;
  for (const l of LABELS) {
    const mine = runs.filter(r => r.label === l);
    check(`R0 ${l}`, mine.every(r => r.shown && r.hash === '#/profile'), `navigation during the first render (${l}): the Career Passport is shown in ${mine.filter(r => r.shown).length}/${mine.length} runs`);
  }
}

if (MODE === 'all' || MODE === 'reload') {
  console.log(`reload scenario: ${RUNS} runs per build (${LABELS.join(' / ')}), ${PARALLEL} in parallel, CPU throttling ${THROTTLES.join('/')}×`);
  const n = RUNS * URLS.length;
  const runs = await pool(n, PARALLEL, i => reloadRun(i, THROTTLES[Math.floor(i / URLS.length) % THROTTLES.length], URLS[i % URLS.length]));
  for (const r of runs) console.log(`  run ${r.i} ${r.label} ×${r.throttle}: ${r.ok ? 'ok' : 'FAILED'} reload→events ${r.total ?? '-'} ms (in page: hash change → events ${r.vis?.events != null ? r.vis.events - r.vis.hashAt : '-'} ms, events ${r.vis?.events ?? '-'} ms after navigation start; app ready ${r.tReady ?? '-'} ms; analysis at reload ${r.jobAtReload ?? '-'}; writer lease ${r.lease ?? '-'})${r.error ? ' ' + r.error.split('\n')[0] : ''}`);
  const wall = groups(runs, r => r.total), page = groups(runs, r => r.vis.events), screen = groups(runs, r => r.vis.events - r.vis.hashAt);
  report.reload = { runs, wall, page, screen, phases: Object.fromEntries(LABELS.map(l => [l, phaseSummary(runs.filter(r => r.label === l))])) };
  for (let k = 0; k < wall.length; k++) console.log(`  ${wall[k].label} ×${wall[k].throttle}: reload → events (test's view) ${fmt(wall[k].s)} | in page since navigation start ${fmt(page[k].s)} | hash change → events ${fmt(screen[k].s)}`);
  for (const l of LABELS) {
    const mine = runs.filter(r => r.label === l);
    check(`R1 ${l}`, mine.every(r => r.ok), `reload-visibility (${l}): ${mine.filter(r => r.ok).length}/${mine.length} runs show the rating event after the reload (timeout ${VISIBLE_TIMEOUT / 1000} s)`);
  }
  if (ASSERT) for (const g of page) if (g.s.n) check(`R2 ${g.label} ×${g.throttle}`, g.s.p95 <= (BUDGET.reloadEvents[g.throttle] ?? Infinity), `rating event visible after the reload at CPU ×${g.throttle} (in page): p95 ${Math.round(g.s.p95)} ms ≤ ${BUDGET.reloadEvents[g.throttle]} ms`);
}

// ------------------------------------------------------------------ budget: populated career
/** Build (once per server port) the populated career: 10,240-competitor Federation two seasons in (featured engine
 *  games stubbed as in e2e/ranks.mjs; every other result is the normal simulation; the live scheduler runs real
 *  engine games meanwhile), 12 rated games won by the robot with their analysis reports, Vault/legacy back-filled. */
async function buildFixture(dir, base) {
  console.log(`building the populated-career fixture in ${dir} …`);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const { ctx, page } = await launch(dir);
  page.setDefaultTimeout(600_000);
  await page.goto(base + '#/world'); await page.waitForFunction(() => window.__crown);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole('button', { name: 'Found the federation' }).click();
  await page.waitForFunction(() => window.__crown.fed.ready, null, { timeout: 600_000 });
  const adv = await page.evaluate(async () => {
    const f = window.__crown.fed;
    f.runSelfplay = async req => ({ moves: [], result: ['1-0', '0-1', '1/2-1/2'][req.seed % 3], termination: 'checkmate' });
    const t0 = performance.now();
    while (f.state.world.season < 3) {
      await f.forfeitAndAdvance();
      for (const c of (f.state.extra.ceremonies ?? []).filter(x => !x.seen)) await f.markCeremonySeen(c.id);
    }
    return { season: f.state.world.season, round: f.state.world.round, ms: Math.round(performance.now() - t0), n: f.state.competitors.size };
  });
  console.log(`  federation: ${adv.n} competitors, season ${adv.season} round ${adv.round} (${Math.round(adv.ms / 1000)} s)`);
  for (let g = 0; g < 12; g++) { await playRatedGame(page, base); await page.goto(base + '#/play'); }
  await page.goto(base + '#/profile');
  for (let t = 0; t < 600; t++) { // analysis of the 12 games (polled from Node: waitForFunction cannot await)
    const left = await page.evaluate(async () => (await window.__crown.db.allJobs()).filter(j => j.status === 'queued' || j.status === 'running').length);
    if (!left) break;
    await page.waitForTimeout(2000);
  }
  await page.waitForFunction(() => window.__crown.vault?.ready && window.__crown.legacy?.ready, null, { timeout: 120_000 });
  const sum = await page.evaluate(async () => { const d = window.__crown.db; return { games: (await d.allGames()).length, reports: (await d.allReports()).length, events: (await d.ratingEvents()).length, competitors: window.__crown.fed.state.competitors.size, season: window.__crown.fed.state.world.season }; });
  console.log(`  career: ${sum.games} games, ${sum.reports} reports, ${sum.events} rating events`);
  writeFileSync(join(dir, 'crown-fixture.json'), JSON.stringify(sum));
  await ctx.close();
  return sum;
}

/** Long tasks and paint timing, recorded from navigation start. */
const PERF_SCRIPT = () => {
  window.__crownLong = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__crownLong.push([Math.round(e.startTime), Math.round(e.startTime + e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch { /* unsupported */ }
};
/** Interactive: the screen is visible and the main thread then has a 500 ms window without a long task. */
const interactiveAt = (visible, longs) => {
  let t = visible;
  for (const [a, b] of [...longs].sort((x, y) => x[0] - y[0])) { if (b <= t) continue; if (a < t + 500) t = Math.max(t, b); else break; }
  return t;
};

async function measure(page, key, settleMs = 3000) {
  const sel = { dashboard: '[data-testid="dashboard"]', events: '[data-testid="rating-event"]' }[key];
  await page.waitForSelector(sel, { timeout: VISIBLE_TIMEOUT });
  await page.waitForTimeout(settleMs);
  const r = await page.evaluate(() => ({ vis: { ...window.__crownVis }, longs: window.__crownLong ?? [], marks: window.__crownStartup?.marks() ?? [], sw: !!navigator.serviceWorker?.controller }));
  const visible = r.vis[key];
  const maxLong = Math.max(0, ...r.longs.map(([a, b]) => b - a));
  return { visible, interactive: interactiveAt(visible, r.longs), maxLong, sw: r.sw, marks: r.marks };
}

async function budgetRun(i, cfg, base) {
  const dir = mkdtempSync(join(tmpdir(), 'crown-budget-'));
  cpSync(fixtureFor(base), dir, { recursive: true });
  const out = { i, label: labelOf(base), cfg: cfg.name };
  const open = async (hash, offline = false) => {
    const L = await launch(dir, { throttle: cfg.throttle, phone: cfg.phone, offline });
    await L.ctx.addInitScript(PERF_SCRIPT);
    await L.page.goto(base + hash);
    return L;
  };
  try {
    // cold online: a new browser process, service worker installed, saved career on disk
    let L = await open('#/dashboard');
    out.coldDashboard = await measure(L.page, 'dashboard');
    await L.ctx.close();
    L = await open('#/profile');
    out.coldEvents = await measure(L.page, 'events');
    // warm: reload in the same browser
    await L.page.reload(); out.warmEvents = await measure(L.page, 'events');
    await L.page.goto(base + '#/dashboard'); await L.page.reload(); out.warmDashboard = await measure(L.page, 'dashboard');
    await L.ctx.close();
    // offline cold: a new browser with the network off — everything comes from the service worker and IndexedDB
    L = await open('#/dashboard', true);
    out.offlineDashboard = await measure(L.page, 'dashboard');
    await L.ctx.close();
    L = await open('#/profile', true);
    out.offlineEvents = await measure(L.page, 'events');
    out.offlineSw = out.offlineEvents.sw;
    await L.ctx.close();
    out.ok = true;
  } catch (e) { out.ok = false; out.error = String(e).slice(0, 300); }
  finally { rmSync(dir, { recursive: true, force: true }); }
  return out;
}

if (MODE === 'all' || MODE === 'budget') {
  const fxs = {};
  for (const base of URLS) {
    const dir = fixtureFor(base);
    fxs[labelOf(base)] = existsSync(join(dir, 'crown-fixture.json')) ? JSON.parse(readFileSync(join(dir, 'crown-fixture.json'), 'utf8')) : await buildFixture(dir, base);
  }
  const CFGS = [{ name: 'desktop ×1', throttle: 1, phone: false }, { name: '390 px ×4', throttle: 4, phone: true }, { name: '390 px ×6', throttle: 6, phone: true }]
    .filter(c => THROTTLES.includes(c.throttle));
  const BPAR = +opt('budget-parallel', 1);
  const keys = ['coldDashboard', 'coldEvents', 'warmDashboard', 'warmEvents', 'offlineDashboard', 'offlineEvents'];
  report.budget = { fixtures: fxs, configs: {} };
  for (const cfg of CFGS) {
    console.log(`budget ${cfg.name}: ${RUNS} runs per build (${BPAR} at a time); fixtures ${Object.entries(fxs).map(([l, f]) => `${l}: ${f.competitors} competitors, ${f.games} games, ${f.reports} reports`).join('; ')}`);
    const runs = await pool(RUNS * URLS.length, BPAR, i => budgetRun(i, cfg, URLS[i % URLS.length]));
    report.budget.configs[cfg.name] = { runs, tables: {} };
    for (const l of LABELS) {
      const ok = runs.filter(r => r.label === l && r.ok);
      const table = Object.fromEntries(keys.map(k => [k, { visible: stats(ok.map(r => r[k].visible)), interactive: stats(ok.map(r => r[k].interactive)), maxLong: stats(ok.map(r => r[k].maxLong)) }]));
      report.budget.configs[cfg.name].tables[l] = table;
      for (const k of keys) console.log(`  ${l} ${k.padEnd(17)} visible ${fmt(table[k].visible)} | interactive ${fmt(table[k].interactive)} | longest task median ${table[k].maxLong.median} ms`);
      const mine = runs.filter(r => r.label === l);
      check(`B1 ${l} ${cfg.name}`, mine.every(r => r.ok), `${ok.length}/${mine.length} budget runs completed${mine.find(r => !r.ok)?.error ? ' — ' + mine.find(r => !r.ok).error.split('\n')[0] : ''}`);
      check(`B2 ${l} ${cfg.name}`, ok.every(r => r.offlineSw), 'offline cold starts were served by the service worker');
      if (ASSERT) for (const k of keys) {
        const lim = BUDGET[/Dashboard/.test(k) ? 'dashboard' : 'events'][cfg.throttle];
        check(`B3 ${l} ${cfg.name} ${k}`, (table[k].interactive.p95 ?? Infinity) <= lim, `${k}: interactive p95 ${table[k].interactive.p95} ms ≤ ${lim} ms`);
      }
    }
  }
}

if (OUTFILE) writeFileSync(OUTFILE, JSON.stringify(report, null, 2));
console.log(failed ? `${failed} check(s) FAILED` : 'All checks passed');
process.exit(failed ? 1 : 0);
