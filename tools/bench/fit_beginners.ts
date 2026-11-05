/**
 * Fit the v0.10 beginner levels (L0a…L0d, crown-error-1) from the `beginners` suite: the same Bradley–Terry maximum
 * likelihood model as tools/bench/fit_calibration.ts (draws = ½, one virtual draw per match, SE from the observed
 * Fisher information, RD = sqrt(SE² + 40²)), with L1 held fixed at its published rating (800) so the chain hangs
 * from the existing anchor and L1–L9 keep their values. Writes src/engine/calibration-beginners.json.
 *   OPENINGS=4ply THREADS=2 npx tsx tools/bench/run.ts suite beginners 60
 *   npx tsx tools/bench/fit_beginners.ts tools/bench/results/suite-beginners-r2.json tools/bench/results/suite-beginners-r3.json [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { LEVELS_ID, ERROR_MODEL_ID, BEGINNER_LEVELS } from '../../src/engine/levels';

const ANCHOR_ID = 'crown-L1', ANCHOR = 800;
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
interface Summary { a: string; b: string; score: number; wins: number; draws: number; losses: number; capped: number; games: number; pairs: number; scoreCI: [number, number]; eloDiff: number | null; eloCI: [number | null, number | null] }
interface Suite { env: Record<string, unknown>; summaries: Summary[]; openings?: string; offset?: number }
const suites = files.map(f => ({ file: f.replace(/^.*tools\/bench\//, 'tools/bench/'), ...(JSON.parse(readFileSync(f, 'utf8')) as Suite) }));
const suite = suites[0];
// runs with the same parameters on disjoint openings are pooled (per-match W/D/L summed); per-run results stay listed
const pooled = new Map<string, Summary>();
for (const su of suites) for (const m of su.summaries) {
  const k = `${m.a}|${m.b}`, p = pooled.get(k);
  if (!p) pooled.set(k, { ...m });
  else { p.wins += m.wins; p.draws += m.draws; p.losses += m.losses; p.capped += m.capped; p.games += m.games; p.pairs += m.pairs; }
}
const matches = [...pooled.values()];
const ids = [...new Set(matches.flatMap(s => [s.a, s.b]))].sort();
const idx = new Map(ids.map((id, i) => [id, i]));
const anchor = idx.get(ANCHOR_ID)!;
const K = Math.LN10 / 400;
let r = ids.map(() => 0);
for (let it = 0; it < 4000; it++) {
  const grad = ids.map(() => 0), hess = ids.map(() => 0);
  for (const m of matches) {
    const i = idx.get(m.a)!, j = idx.get(m.b)!;
    const n = m.wins + m.draws + m.losses + 1;
    const s = m.wins + m.draws / 2 + 0.5;
    const p = 1 / (1 + Math.exp(-K * (r[i] - r[j])));
    grad[i] += K * (s - n * p); grad[j] -= K * (s - n * p);
    const h = K * K * n * p * (1 - p);
    hess[i] += h; hess[j] += h;
  }
  let maxStep = 0;
  r = r.map((x, i) => { if (i === anchor) return 0; const step = Math.max(-50, Math.min(50, grad[i] / Math.max(hess[i], 1e-9))); maxStep = Math.max(maxStep, Math.abs(step)); return x + step; });
  if (maxStep < 1e-7) break;
}
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
const levels = ids.filter(id => id !== ANCHOR_ID).map(id => {
  const i = idx.get(id)!, fi = free.indexOf(i);
  const se = Math.sqrt(cov[fi][fi]);
  const games = matches.filter(m => m.a === id || m.b === id).reduce((a, m) => a + m.wins + m.draws + m.losses, 0);
  const rating = ANCHOR + r[i];
  const profile = BEGINNER_LEVELS.find(l => `crown-${l.id}` === id)!;
  return { id: profile.id, name: profile.name, rating: Math.round(rating), rd: Math.round(Math.sqrt(se * se + 40 * 40)), se: Math.round(se), ci95: [Math.round(rating - 1.96 * se), Math.round(rating + 1.96 * se)], games, error: profile.error };
}).sort((a, b) => b.rating - a.rating);
const total = matches.reduce((a, m) => a + m.games, 0);
const date = new Date().toISOString().slice(0, 10);
const out = {
  id: `cal-${date}-beginners-${ERROR_MODEL_ID}`,
  status: `measured ${date}: ${total} engine-vs-engine games on ${String(suite.env.cpu)} (${String(suite.env.searchId)}+${String(suite.env.evalId)}, ${LEVELS_ID})`,
  method: `Colour-swapped opening pairs from ${suite.openings ?? 'tools/bench/openings-4ply.json'} (runs: ${suites.map(x => `${x.file} at opening offset ${x.offset ?? 0}`).join('; ')}; disjoint openings, pooled); a chain of adjacent-level matches L1→L0a→L0b→L0c→L0d plus one-step-skip matches; Bradley–Terry maximum likelihood, draws = ½, one virtual draw per match; L1 fixed at its published rating 800 (src/engine/calibration.json, id cal-2026-11-03); RD = sqrt(SE² + 40²); ci95 = rating ± 1.96·SE (statistical only, relative to L1).`,
  anchor: 'L1 Novice = 800 (the Crown scale anchor, unchanged). The L1 rating itself carries its own published RD 40.',
  caveats: 'Engine-vs-engine strength only, no human games. The error-model parameters were chosen in pilot matches on the 2-ply openings (tools/bench/openings.json) and a first 4-ply round (offset 0, not used here). Both pooled runs use the final parameters on fresh openings; tuning stopped after the offset-60 run, so that run may carry a small optional-stopping bias toward the targets, and the offset-120 run alone (listed under runs) is the cleanest check. Node-limited and seed-deterministic, so the ratings do not depend on hardware speed. Capped games (300 plies) are excluded. Ratings below 800 extend the same logistic Crown scale; they are not FIDE or human ratings.',
  levels,
  matches: matches.map(m => ({ a: m.a, b: m.b, games: m.games, w: m.wins, d: m.draws, l: m.losses, capped: m.capped })),
  runs: suites.map(x => ({ file: x.file, offset: x.offset ?? 0, date: x.env.date, matches: x.summaries.map(m => ({ a: m.a, b: m.b, games: m.games, w: m.wins, d: m.draws, l: m.losses, capped: m.capped, score: +m.score.toFixed(3), scoreCI: m.scoreCI.map(v => +v.toFixed(3)), eloDiff: m.eloDiff, eloCI: m.eloCI })) })),
};
console.log(JSON.stringify(levels.map(l => [l.id, l.rating, l.se, l.ci95, l.games])));
if (!dry) writeFileSync(new URL('../../src/engine/calibration-beginners.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
