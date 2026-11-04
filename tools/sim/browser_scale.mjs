/**
 * Headless Chromium measurement of the real app (docs/FEDERATION_SCALE.md): founds a federation in a fresh profile,
 * advances rounds (featured games stubbed, as in scale_probe.mts, so the world simulation is what is measured) and
 * records create/advance times, JS heap and IndexedDB usage; then runs the live scheduler at fixed N for a while and
 * records committed moves, measured engine time per move and main-thread long tasks.
 *   npx vite build --outDir <dir> && node tools/sim/browser_scale.mjs <dir> [rounds=19] [liveN=12,24] [liveSeconds=60] [port=4231]
 */
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIR = process.argv[2];
const ROUNDS = +(process.argv[3] ?? 19);
const LIVE_N = (process.argv[4] ?? '12,24').split(',').map(Number).filter(Boolean);
const LIVE_S = +(process.argv[5] ?? 60);
const PORT = +(process.argv[6] ?? 4231);
if (!DIR) { console.error('usage: node tools/sim/browser_scale.mjs <built dist dir> [rounds] [liveN] [liveSeconds] [port]'); process.exit(2); }

const server = spawn(process.execPath, ['scripts/serve.mjs', '--dir', DIR, '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => server.stdout.once('data', r));
const profile = mkdtempSync(join(tmpdir(), 'crown-scale-'));
const ctx = await chromium.launchPersistentContext(profile, { viewport: { width: 1366, height: 900 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/#/world`);
await page.waitForFunction(() => !!window.__crown?.fed);

const world = await page.evaluate(async (rounds) => {
  const s = window.__crown;
  s.setLiveSettings({ ...s.liveSettings, mode: 'off' });
  s.fed.runSelfplay = async () => ({ moves: [], result: '1/2-1/2', termination: 'simulated' });
  const heap = () => (performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null);
  let t = performance.now();
  await s.fed.create(3, 4242);
  const createMs = performance.now() - t;
  const roundMs = [];
  for (let r = 0; r < rounds; r++) {
    for (const f of s.fed.playerFixtures()) await s.fed.forfeit(f.id);
    t = performance.now();
    await s.fed.advanceRound();
    roundMs.push(Math.round(performance.now() - t));
  }
  const est = await navigator.storage.estimate();
  const sorted = [...roundMs].sort((a, b) => a - b);
  return { competitors: s.fed.state.competitors.size, createMs: Math.round(createMs), roundMs, roundMedianMs: sorted[sorted.length >> 1], roundMaxMs: sorted.at(-1), heapMB: heap(), storageMB: +((est.usage ?? 0) / 1048576).toFixed(2), cores: navigator.hardwareConcurrency, pool: s.livePool.length };
}, ROUNDS);
console.log(JSON.stringify({ world }));

for (const n of LIVE_N) {
  const live = await page.evaluate(async ({ n, seconds }) => {
    const s = window.__crown;
    const long = [];
    const obs = new PerformanceObserver(l => { for (const e of l.getEntries()) long.push(e.duration); });
    try { obs.observe({ type: 'longtask', buffered: false }); } catch { /* unsupported */ }
    const before = s.live.stats();
    // time every scheduler commit on the main thread
    const orig = s.fed.scheduledStep.bind(s.fed);
    const commits = [];
    s.fed.scheduledStep = async (...a) => { const t = performance.now(); try { return await orig(...a); } finally { commits.push(performance.now() - t); } };
    s.setLiveSettings({ ...s.liveSettings, mode: 'fixed', fixed: n, plyIntervalMs: 3000 });
    await s.live.start();
    const t0 = performance.now();
    let maxActive = 0;
    while (performance.now() - t0 < seconds * 1000) { await new Promise(r => setTimeout(r, 500)); maxActive = Math.max(maxActive, s.fed.activeScheduled().length); }
    s.setLiveSettings({ ...s.liveSettings, mode: 'off' });
    await s.live.idle();
    s.fed.scheduledStep = orig;
    obs.disconnect();
    const after = s.live.stats();
    const q = (a, p) => { const x = [...a].sort((u, v) => u - v); return x.length ? +x[Math.min(x.length - 1, Math.floor(p * x.length))].toFixed(1) : null; };
    const moves = after.moves - before.moves;
    return { n, seconds, workers: after.workers, maxActive, moves, movesPerSec: +(moves / seconds).toFixed(2), targetMovesPerSec: +(n / 3).toFixed(2), finished: after.finished - before.finished, medianEngineMs: after.medianMoveMs, commitMs: { median: q(commits, 0.5), p95: q(commits, 0.95) }, longTasks: long.length, longTaskP95: q(long, 0.95), errors: after.errors };
  }, { n, seconds: LIVE_S });
  console.log(JSON.stringify({ live }));
}
const est = await page.evaluate(async () => ({ storageMB: +(((await navigator.storage.estimate()).usage ?? 0) / 1048576).toFixed(2), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }));
console.log(JSON.stringify({ end: est, pageErrors: errors.slice(0, 5) }));
await ctx.close();
server.kill();
rmSync(profile, { recursive: true, force: true });
process.exit(0);
