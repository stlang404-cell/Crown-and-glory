/** Engine speed inside real Chromium (production build, Web Worker): L8 search, 3 positions × 3 runs. */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(url);
await p.waitForFunction(() => !!window.__crown);
const version = await p.evaluate(() => navigator.userAgent);
const positions = [
  { initialFen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', moves: [] },
  { initialFen: 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', moves: ['c2c3', 'c5c4', 'e1f3', 'e6f4', 'b1a3', 'b6a4'] },
  { initialFen: '2rk2/1q3p/p1n3/3N2/PP1Q1P/3K1R w - - 0 20', moves: [] },
];
const results = [];
for (const pos of positions) for (let rep = 0; rep < 3; rep++) {
  const r = await p.evaluate(async ({ pos, rep }) => {
    const s = window.__crown;
    const t = performance.now();
    const res = await s.play.move({ ...pos, level: 8, seed: rep, clock: { remainingMs: 60_000, incrementMs: 0 }, newGame: true });
    return { nodes: res.nodes, depth: res.depth, engineMs: res.timeMs, wallMs: performance.now() - t, move: res.move };
  }, { pos, rep });
  results.push({ fen: pos.initialFen, plies: pos.moves.length, ...r, nps: Math.round(r.nodes / (r.engineMs / 1000)) });
  console.log(JSON.stringify(results[results.length - 1]));
}
await b.close();
mkdirSync(new URL('../tools/bench/results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../tools/bench/results/browser-speed.json', import.meta.url), JSON.stringify({ browser: version, budget: 'L8 with a 60 s clock (allocation ≈ 2.7 s/move)', results }, null, 1));
