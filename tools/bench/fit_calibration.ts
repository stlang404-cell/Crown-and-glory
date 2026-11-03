/**
 * Fit level ratings from calibration match summaries (Bradley–Terry / Elo logistic model, draws as
 * half points) by maximum likelihood; standard errors from the observed Fisher information.
 * Anchor: L1 Novice is fixed at ANCHOR (a design decision: the absolute Crown scale is arbitrary).
 *   npx tsx tools/bench/fit_calibration.ts tools/bench/results/suite-calibrate.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ANCHOR = 800;
const file = process.argv[2] ?? new URL('./results/suite-calibrate.json', import.meta.url).pathname;
const suite = JSON.parse(readFileSync(file, 'utf8')) as { env: Record<string, unknown>; summaries: { a: string; b: string; wins: number; draws: number; losses: number; capped: number; games: number }[] };
const ids = [...new Set(suite.summaries.flatMap(s => [s.a, s.b]))].filter(x => x.startsWith('crown-L')).sort();
const idx = new Map(ids.map((id, i) => [id, i]));
const matches = suite.summaries.filter(s => idx.has(s.a) && idx.has(s.b));
const K = Math.LN10 / 400;
let r = ids.map(() => 0);
const anchor = idx.get('crown-L1')!;
for (let it = 0; it < 2000; it++) {
  const grad = ids.map(() => 0), hess = ids.map(() => 0);
  for (const m of matches) {
    const i = idx.get(m.a)!, j = idx.get(m.b)!;
    // Laplace-style prior: one virtual drawn game per match keeps perfect scores finite.
    const n = m.wins + m.draws + m.losses + 1;
    const s = m.wins + m.draws / 2 + 0.5;
    const p = 1 / (1 + Math.exp(-K * (r[i] - r[j])));
    grad[i] += K * (s - n * p); grad[j] -= K * (s - n * p);
    const h = K * K * n * p * (1 - p);
    hess[i] += h; hess[j] += h;
  }
  let maxStep = 0;
  r = r.map((x, i) => { if (i === anchor) return 0; const step = Math.max(-50, Math.min(50, grad[i] / Math.max(hess[i], 1e-9))); maxStep = Math.max(maxStep, Math.abs(step)); return x + step; });
  if (maxStep < 1e-6) break;
}
// Standard errors: invert the Fisher information with the anchor removed.
const free = ids.map((_, i) => i).filter(i => i !== anchor);
const F = free.map(() => free.map(() => 0));
for (const m of matches) {
  const i = idx.get(m.a)!, j = idx.get(m.b)!;
  const n = m.wins + m.draws + m.losses + 1;
  const p = 1 / (1 + Math.exp(-K * (r[i] - r[j])));
  const h = K * K * n * p * (1 - p);
  const fi = free.indexOf(i), fj = free.indexOf(j);
  if (fi >= 0) F[fi][fi] += h;
  if (fj >= 0) F[fj][fj] += h;
  if (fi >= 0 && fj >= 0) { F[fi][fj] -= h; F[fj][fi] -= h; }
}
function invert(A: number[][]): number[][] {
  const n = A.length, M = A.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let k = c + 1; k < n; k++) if (Math.abs(M[k][c]) > Math.abs(M[p][c])) p = k;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c]; for (let k = 0; k < 2 * n; k++) M[c][k] /= d;
    for (let k = 0; k < n; k++) if (k !== c) { const f = M[k][c]; for (let l = 0; l < 2 * n; l++) M[k][l] -= f * M[c][l]; }
  }
  return M.map(row => row.slice(n));
}
const cov = invert(F);
const levels = ids.map((id, i) => {
  const fi = free.indexOf(i);
  const se = fi >= 0 ? Math.sqrt(cov[fi][fi]) : 0;
  const games = matches.filter(m => m.a === id || m.b === id).reduce((a, m) => a + m.wins + m.draws + m.losses, 0);
  // Published RD: statistical SE plus a 40-point floor for model/hardware/time-control uncertainty.
  return { level: +id.slice(7), rating: Math.round(ANCHOR + r[i]), rd: Math.round(Math.sqrt(se * se + 40 * 40)), se: Math.round(se), games };
});
const date = new Date().toISOString().slice(0, 10);
const out = {
  id: `cal-${date}-${String(suite.env.searchId)}+${String(suite.env.evalId)}`,
  status: `measured ${date}: ${matches.reduce((a, m) => a + m.games, 0)} engine-vs-engine games on ${String(suite.env.cpu)}`,
  method: 'Colour-swapped opening pairs from tools/bench/openings.json; Bradley–Terry maximum likelihood, draws = ½, plus one virtual draw per match (keeps lopsided results finite); RD = sqrt(SE² + 40²).',
  anchor: `Anchor: L1 Novice fixed at ${ANCHOR} (design choice; the absolute Crown scale is arbitrary and is not FIDE).`,
  caveats: 'Engine-vs-engine strength only; no human games. L8 is time-limited (2 s cap in calibration) and therefore hardware dependent. Capped games are excluded.',
  levels,
  matches: matches.map(m => ({ a: m.a, b: m.b, w: m.wins, d: m.draws, l: m.losses, capped: m.capped })),
};
writeFileSync(new URL('../../src/engine/calibration.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(levels));
