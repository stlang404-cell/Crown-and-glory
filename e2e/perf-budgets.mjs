/**
 * Performance budgets (v1.0 package V). Measures every budget in docs/PERFORMANCE_BUDGETS.md against the production
 * build in Chromium, on a 10,240-competitor save, twice:
 *   desktop — 1366×900, no throttling;
 *   phone proxy — 390×844, isMobile/touch, Chromium CPU throttling 4× (a PROXY for a phone, not a phone).
 * Every budget uses >= 10 runs and reports median and p95; the verdict compares p95 with the budget.
 *   node scripts/serve.mjs --dir dist --port 4458 &  node e2e/perf-budgets.mjs http://127.0.0.1:4458/ [--runs 10] [--only desktop|phone]
 * Writes e2e/artifacts/perf-budgets/results.json and log.txt. Exit code 1 if any measured budget fails.
 *
 * UI latencies are measured inside the page: the action is dispatched, then the clock stops at the first DOM change
 * it causes plus two animation frames (the frame that paints it). Engine, market, round and save timings call the
 * same service methods the screens call (window.__crown, an inspection handle the app exposes for tests).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { loadavg, cpus } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = (process.argv[2] ?? 'http://127.0.0.1:4458/').replace(/\/?$/, '/');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = Math.max(10, +arg('runs', 10));
const ONLY = arg('only', '');
const OUT = new URL('./artifacts/perf-budgets/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
rmSync(OUT + 'profile', { recursive: true, force: true });
const log = [];
const step = m => { const l = `[${new Date().toISOString()}] ${m}`; log.push(l); console.log(l); };

/** Budgets (p95, milliseconds unless stated): [desktop, phone proxy]. Set before measuring; see the doc for reasons. */
const BUDGETS = {
  startup: { label: 'Startup → interactive Dashboard (10,240 save, warm cache)', d: 3000, p: 8000 },
  transition: { label: 'Screen transition (tap → new screen painted)', d: 300, p: 1000 },
  moveInput: { label: 'Move input → board updated', d: 50, p: 100 },
  engineL1: { label: 'Engine move L1 (cap 400 ms)', d: 600, p: 900 },
  engineL2: { label: 'Engine move L2 (cap 400 ms)', d: 600, p: 900 },
  engineL3: { label: 'Engine move L3 (cap 500 ms)', d: 700, p: 1000 },
  engineL4: { label: 'Engine move L4 (cap 600 ms)', d: 800, p: 1100 },
  engineL5: { label: 'Engine move L5 (cap 400 ms)', d: 600, p: 900 },
  engineFeatured: { label: 'Engine move, featured budget (30k nodes)', d: 2000, p: 6000 },
  quote: { label: 'Market quote (shares typed → quote painted)', d: 100, p: 250 },
  trade: { label: 'Market trade (buy committed and saved)', d: 300, p: 1000 },
  round: { label: 'Federation round advance (world + commit, featured games excluded)', d: 1500, p: 3000 },
  tick: { label: 'Live scheduler tick (scheduling pass)', d: 50, p: 150 },
  save: { label: 'Save a game record (IndexedDB)', d: 50, p: 150 },
  replay: { label: 'Replay playback step (→ painted)', d: 50, p: 100 },
  search: { label: 'Roster search at 10,240 (query → results painted)', d: 200, p: 600 },
  heap: { label: 'JS heap after the tour (MB, after GC)', d: 300, p: 300, unit: 'MB' },
};
const stats = xs => {
  const s = [...xs].sort((a, b) => a - b);
  const q = p => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
  return { n: s.length, median: s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null, p95: s.length ? q(0.95) : null, min: s[0], max: s[s.length - 1] };
};
const results = { url, at: new Date().toISOString(), host: { cpus: cpus().length, model: cpus()[0]?.model, loadavgStart: loadavg() }, runs: RUNS, devices: {} };

// in-page helper: run an action, stop at the first DOM mutation under `sel` plus two frames
const MEASURE = `window.__measure = (sel, action, timeout = 10000) => new Promise(res => {
  const root = document.querySelector(sel) || document.body; let done = false; const t0 = performance.now();
  const fin = () => { if (done) return; done = true; (window.__dom ??= []).push(performance.now() - t0); obs.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0))); };
  const obs = new MutationObserver(fin); obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
  setTimeout(() => { if (!done) { done = true; obs.disconnect(); res(-1); } }, timeout);
  action();
});`;

async function device(kind) {
  const phone = kind === 'phone';
  const ctx = await chromium.launchPersistentContext(OUT + 'profile', phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(MEASURE);
  // startup probe: the first frame where the Dashboard shows the loaded Federation season line
  await ctx.addInitScript(() => {
    const t = () => { const el = document.querySelector('[data-testid="dash-season"]'); if (el && /^Season/.test(el.textContent ?? '') && window.__crown) { window.__ready = performance.now(); return; } requestAnimationFrame(t); };
    requestAnimationFrame(t);
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { errors.push(String(e).slice(0, 200)); step(`pageerror (${kind}): ${String(e).slice(0, 200)}`); });
  const cdp = await ctx.newCDPSession(page);
  const throttle = async on => cdp.send('Emulation.setCPUThrottlingRate', { rate: phone && on ? 4 : 1 });
  await page.goto(url); await page.waitForFunction(() => window.__crown);
  const R = {};
  const put = (k, xs) => { R[k] = { ...stats(xs.filter(x => x >= 0)), timeouts: xs.filter(x => x < 0).length, samples: xs.map(x => Math.round(x * 10) / 10) }; const b = BUDGETS[k]; step(`  ${kind} ${k}: median ${R[k].median?.toFixed(1)} p95 ${R[k].p95?.toFixed(1)} (n ${R[k].n}${R[k].timeouts ? `, ${R[k].timeouts} timeouts` : ''}) budget ${phone ? b.p : b.d}`); };

  // ---- setup (unthrottled): a 10,240 federation, one round played
  if (!(await page.evaluate(() => window.__crown.fed.ready))) {
    await page.goto(url + '#/world');
    await page.getByRole('button', { name: 'Found the federation' }).click();
    await page.waitForFunction(() => window.__crown.fed.ready, null, { timeout: 180000 });
    await page.evaluate(async () => { const f = window.__crown.fed; for (const x of f.playerFixtures()) await f.forfeit(x.id); await f.advanceRound(); });
  }
  const size = await page.evaluate(() => window.__crown.fed.state.competitors.size);
  step(`${kind}: save has ${size} competitors`);
  await throttle(true);

  // ---- startup (reload, warm service-worker cache and IndexedDB)
  const st = [];
  for (let i = 0; i < RUNS; i++) {
    // a real document load each time (a hash-only navigation would not restart the app)
    await page.goto('about:blank');
    await page.goto(url + '#/dashboard', { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 }).catch(() => {});
    st.push(await page.evaluate(() => window.__ready ?? -1));
  }
  put('startup', st);
  await page.waitForTimeout(2000);

  // ---- screen transitions through the main navigation
  const navSel = phone ? 'nav.tabbar' : 'nav.rail';
  const names = phone ? ['Play', 'Federation', 'Exchange', 'Career', 'Settings', 'Dashboard'] : ['Play', 'Federation', 'Exchange', 'Finance', 'Games', 'Career', 'Settings', 'Dashboard'];
  const tr = [];
  for (let c = 0; tr.length < Math.max(RUNS, 12); c++) for (const n of names) {
    const ms = await page.evaluate(({ navSel, n }) => {
      const b = [...document.querySelectorAll(`${navSel} button`)].find(x => x.textContent.trim() === n);
      return window.__measure('main', () => b.click());
    }, { navSel, n });
    tr.push(ms); await page.waitForTimeout(400);
  }
  put('transition', tr);

  // ---- move input on a casual untimed game vs the fastest beginner, then the replay of that game
  await page.goto(url + '#/play');
  await page.getByTestId('opp-beginner-L0d').click();
  await page.getByRole('group', { name: 'Time control' }).getByRole('button', { name: 'Untimed' }).click();
  await page.getByRole('group', { name: 'Colour' }).getByRole('button', { name: 'White' }).click();
  await page.getByRole('button', { name: /Start match/i }).click();
  await page.waitForSelector('[data-testid="match"]');
  const mv = [];
  await page.evaluate(() => { window.__dom = []; window.__sync = []; });
  for (let i = 0; i < RUNS * 4 && mv.length < RUNS; i++) {
    const t = await page.waitForFunction(() => ['human', 'over'].includes(document.querySelector('[data-testid="match"]')?.getAttribute('data-turn')), null, { timeout: 30000 }).then(() => page.getAttribute('[data-testid="match"]', 'data-turn'));
    if (t === 'over') break;
    const ms = await page.evaluate(async () => {
      // only the player's own pieces (White): selecting one never plays a move by itself
      const sqs = [...document.querySelectorAll('[data-testid="match"] [data-square]')].filter(e => / white /.test(` ${e.getAttribute('aria-label')} `.replace(',', ' ')));
      for (const s of sqs) {
        s.click();
        await new Promise(r => requestAnimationFrame(r));
        const d = document.querySelector('[data-testid="match"] [data-square] .dot, [data-testid="match"] [data-square] .ring')?.closest('[data-square]');
        if (d) return window.__measure('[data-testid="match"] .board', () => { const t = performance.now(); d.click(); (window.__sync ??= []).push(performance.now() - t); });
      }
      return -1;
    });
    if (ms >= 0) mv.push(ms);
    await page.waitForTimeout(250);
  }
  put('moveInput', mv);
  R.moveInput.syncMs = stats(await page.evaluate(() => window.__sync ?? []));
  R.moveInput.domUpdatedMs = stats(await page.evaluate(() => window.__dom ?? []));
  R.moveInput.loadavg = loadavg();
  if (await page.getAttribute('[data-testid="match"]', 'data-turn') !== 'over') { await page.getByRole('button', { name: /Resign/ }).first().click(); await page.getByRole('button', { name: 'Yes, Resign' }).click(); }
  await page.waitForSelector('.result-overlay', { timeout: 20000 });
  await page.getByRole('button', { name: 'View Analysis' }).click();
  await page.waitForSelector('[data-testid="ply-indicator"]');
  await page.waitForTimeout(1500);
  const rpBusy = [];
  for (let i = 0; i < RUNS; i++) { rpBusy.push(await page.evaluate(i => window.__measure('[data-testid="ply-indicator"]', () => document.querySelector(`[aria-label="${i % 2 ? 'Previous Move' : 'Next Move'}"]`)?.click()), i)); await page.waitForTimeout(120); }
  R.replayWhileAnalysing = { ...stats(rpBusy.filter(x => x >= 0)), samples: rpBusy };
  await page.waitForFunction(async () => (await window.__crown.db.allReports()).some(r => r.status === 'complete'), null, { timeout: 240000 }).catch(() => step('  analysis did not finish in 240 s'));
  await page.waitForTimeout(1500);
  const rp = [];
  for (let i = 0; i < RUNS * 2; i++) {
    const ms = await page.evaluate(i => window.__measure('[data-testid="ply-indicator"]', () => document.querySelector(`[aria-label="${i % 2 ? 'Previous Move' : 'Next Move'}"]`)?.click()), i);
    rp.push(ms); await page.waitForTimeout(120);
  }
  put('replay', rp);

  // ---- engine moves (the play worker, as in a game; one warm-up excluded) and the featured budget (spectator worker)
  // middlegame positions outside the opening book (book moves return in ~1 ms and would not measure the search)
  const positions = ['2rk2/1pp1pp/6/2q1n1/PPPPPP/R1NKNR w - - 0 1', '2rk2/1q3p/p1n3/3N2/PP1Q1P/3K1R w - - 0 20', '2rk2/qnp1pp/1p4/6/PPPPPP/R1NKNR w - - 0 1'];
  const engineMs = {};
  for (const level of [1, 2, 3, 4, 5]) {
    const xs = [];
    await page.evaluate(lv => window.__crown.play.move({ initialFen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', moves: [], level: lv, seed: 99, clock: { remainingMs: 600000, incrementMs: 0 }, newGame: true }), level);
    for (let i = 0; i < RUNS; i++) {
      const r = await page.evaluate(async ({ level, fen, i }) => { const t = performance.now(); const res = await window.__crown.play.move({ initialFen: fen, moves: [], level, seed: i, clock: { remainingMs: 600000, incrementMs: 0 }, newGame: true }); return { wall: performance.now() - t, engine: res.timeMs, nodes: res.nodes }; }, { level, fen: positions[i % 3], i });
      xs.push(r.wall); (engineMs[level] ??= []).push(r);
    }
    put(`engineL${level}`, xs);
    R[`engineL${level}`].engine = { medianEngineMs: stats(engineMs[level].map(x => x.engine)).median, medianNodes: stats(engineMs[level].map(x => x.nodes)).median };
  }
  // featured budget: full search capped at FEATURED_NODE_CAP = 30,000 nodes (the budget of featured/scheduled games of
  // strong competitors; same configuration as L7), on the spectator worker those games use; live games paused
  {
    const xs = [], eng = [];
    await page.evaluate(() => window.__crown.live.pause('perf'));
    await page.evaluate(() => window.__crown.spectator.move({ initialFen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', moves: [], level: 7, seed: 1, newGame: true, purpose: 'spectator' }));
    for (let i = 0; i < RUNS; i++) {
      const r = await page.evaluate(async ({ fen, i }) => { const t = performance.now(); const res = await window.__crown.spectator.move({ initialFen: fen, moves: [], level: 7, seed: i, newGame: true, purpose: 'spectator' }); return { wall: performance.now() - t, engine: res.timeMs, nodes: res.nodes }; }, { fen: positions[i % 3], i });
      xs.push(r.wall); eng.push(r);
    }
    await page.evaluate(() => window.__crown.live.resume('perf'));
    put('engineFeatured', xs);
    R.engineFeatured.engine = { medianEngineMs: stats(eng.map(x => x.engine)).median, medianNodes: stats(eng.map(x => x.nodes)).median };
  }

  // ---- market quote (UI) and trade (service)
  const mid = await page.evaluate(() => [...window.__crown.fed.state.markets.values()].find(m => m.status === 'open' && !m.sandbox && (m.kind ?? 'match') === 'match' && m.white !== 'player' && m.black !== 'player')?.id);
  if (mid) {
    await page.goto(url + '#/exchange/' + encodeURIComponent(mid));
    await page.waitForSelector('input[aria-label="Shares"]');
    const qs = [];
    for (let i = 0; i < RUNS; i++) {
      qs.push(await page.evaluate(i => { const inp = document.querySelector('input[aria-label="Shares"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; return window.__measure('main', () => { set.call(inp, String(5 + i)); inp.dispatchEvent(new Event('input', { bubbles: true })); }); }, i));
      await page.waitForTimeout(100);
    }
    put('quote', qs);
    const ts = [];
    for (let i = 0; i < RUNS; i++) ts.push(await page.evaluate(async mid => { const t = performance.now(); await window.__crown.fed.trade(mid, 0, 1, 'buy'); return performance.now() - t; }, mid));
    put('trade', ts);
  } else step(`  ${kind} quote/trade: no open market — not measured`);

  // ---- save operations
  const sv = await page.evaluate(async runs => {
    const s = window.__crown; const g = (await s.db.allGames()).find(x => x.status === 'finalized');
    const xs = [];
    for (let i = 0; i < runs; i++) { const rec = { ...g, id: `perf-save-${i}`, status: 'active', checksum: null }; const t = performance.now(); await s.db.saveGame(rec); xs.push(performance.now() - t); }
    return xs;
  }, RUNS);
  put('save', sv);
  await page.evaluate(async runs => { const s = window.__crown; const tx = s.db.db.transaction('games', 'readwrite'); for (let i = 0; i < runs; i++) tx.objectStore('games').delete(`perf-save-${i}`); await new Promise(r => { tx.oncomplete = r; tx.onerror = r; }); }, RUNS).catch(() => {});

  // ---- scheduler tick
  const tk = [];
  for (let i = 0; i < RUNS; i++) { tk.push(await page.evaluate(async () => { const t = performance.now(); await window.__crown.live.tick(); return performance.now() - t; })); await page.waitForTimeout(300); }
  put('tick', tk);

  // ---- roster search
  await page.goto(url + '#/competitors');
  await page.waitForSelector('input[aria-label="Search Competitors"]');
  await page.waitForTimeout(1500);
  const queries = ['an', 'mar', 'ell', 'ton', 'ri', 'son', 'ber', 'al', 'is', 'or', 'ha', 'en'];
  const sr = [];
  for (let i = 0; i < RUNS; i++) {
    sr.push(await page.evaluate(q => { const inp = document.querySelector('input[aria-label="Search Competitors"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; return window.__measure('main', () => { set.call(inp, q); inp.dispatchEvent(new Event('input', { bubbles: true })); }); }, queries[i % queries.length]));
    await page.waitForTimeout(300);
  }
  put('search', sr);

  // ---- round advance: featured games are played unthrottled first (engine work is budgeted above), then the
  // world simulation and commit are timed under the device's throttling
  const rd = [];
  for (let i = 0; i < RUNS; i++) {
    await throttle(false);
    await page.evaluate(async () => { const f = window.__crown.fed; for (const x of f.playerFixtures()) await f.forfeit(x.id); for (const x of f.featuredFixtures().filter(y => y.result === null)) await f.playFeatured(x.id, 'background'); });
    await throttle(true);
    rd.push(await page.evaluate(async () => { const f = window.__crown.fed; for (const x of f.playerFixtures()) await f.forfeit(x.id); const t = performance.now(); await f.advanceRound(); return performance.now() - t; }));
    await page.locator('[data-testid="ceremony-continue"]').click({ timeout: 300 }).catch(() => {});
  }
  put('round', rd);

  // ---- heap after the tour (after a forced GC)
  await page.goto(url + '#/dashboard'); await page.waitForTimeout(3000);
  await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
  const m = await cdp.send('Performance.enable').then(() => cdp.send('Performance.getMetrics'));
  const heap = (m.metrics.find(x => x.name === 'JSHeapUsedSize')?.value ?? 0) / 1048576;
  R.heap = { n: 1, median: Math.round(heap * 10) / 10, p95: Math.round(heap * 10) / 10, samples: [heap] };
  step(`  ${kind} heap: ${heap.toFixed(1)} MB`);
  // engine-reported time vs wall time tells whether throttling reached the workers
  R.notes = { workersThrottled: null };
  await throttle(false);
  results.devices[kind] = { results: R, errors };
  await ctx.close();
}

if (ONLY !== 'phone') await device('desktop');
if (ONLY !== 'desktop') await device('phone');
results.host.loadavgEnd = loadavg();

// verdicts
const table = [];
let fails = 0;
for (const [k, b] of Object.entries(BUDGETS)) {
  const row = { budget: k, label: b.label };
  for (const [dev, lim] of [['desktop', b.d], ['phone', b.p]]) {
    const r = results.devices[dev]?.results[k];
    if (!r || r.p95 == null) { row[dev] = { limit: lim, verdict: 'not measured' }; continue; }
    const ok = r.p95 <= lim && !r.timeouts;
    if (!ok) fails++;
    row[dev] = { limit: lim, median: r.median, p95: r.p95, n: r.n, verdict: ok ? 'pass' : 'FAIL' };
  }
  table.push(row);
}
results.table = table;
for (const r of table) step(`${r.verdict ?? ''}${r.budget.padEnd(15)} desktop ${JSON.stringify(r.desktop)} · phone ${JSON.stringify(r.phone)}`);
writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 1));
writeFileSync(OUT + 'log.txt', log.join('\n') + '\n');
step(fails ? `${fails} budget(s) FAILED` : 'ALL MEASURED BUDGETS PASS');
process.exit(fails ? 1 : 0);
