/**
 * Fit and validate the match odds model (crown-odds-2).
 *   npx tsx tools/odds/fit.ts <dataDir> [coefOut=src/exchange/odds-coefficients.json] [reportOut=docs/sim/odds-crown-odds-2.json]
 * Data: games written by tools/odds/generate.ts (public ratings/RDs, per-ply published evaluation, material,
 * result). Games censored by the 400-ply playing limit are excluded (their markets are cancelled, not settled).
 * Split BY GAME (FNV hash of the game id; 25% held out). All coefficients are maximum-likelihood fits on the
 * training games; every reported metric is on held-out games only.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OddsCoefficients, liveModelVector, pregameWdl, START_MATERIAL, knotValue, ordered, pregameLatent } from '../../src/exchange/odds';
import { wdl as davidson } from '../../src/federation/resultModel';
import { expectedU } from '../../src/analysis/methodology';

interface Side { id: string; rating: number; rd: number; latent: number; division: number }
interface Game { id: string; white: Side; black: Side; result: string; termination: string; plies: number; evals: number[]; material: number[][] }

const DIR = process.argv[2], COEF_OUT = process.argv[3] ?? 'src/exchange/odds-coefficients.json', REPORT_OUT = process.argv[4] ?? 'docs/sim/odds-crown-odds-2.json';
const all: Game[] = readdirSync(DIR).filter(f => f.endsWith('.json')).sort().flatMap(f => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Game[]);
const games = all.filter(g => g.termination !== 'playing-limit');
const fnv = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const isTest = (g: Game) => fnv(g.id) % 4 === 0;
const train = games.filter(g => !isTest(g)), test = games.filter(isTest);
const outcome = (g: Game) => (g.result === '1-0' ? 0 : g.result === '0-1' ? 2 : 1); // index in [W, D, L]
console.log(`games ${all.length}, censored ${all.length - games.length}, train ${train.length}, test ${test.length}`);

// ------------------------------------------------------------------ observations
interface Obs { g: Game; ply: number; cp: number; mat: number; y: number }
const MAX_PLY = 240;
function obsOf(gs: Game[], plies?: number[]): Obs[] {
  const out: Obs[] = [];
  for (const g of gs) {
    const y = outcome(g);
    // a live point exists after ply n for n = 1 .. plies−1 (the final move ends the game); ply 0 = pre-game
    const ns = plies ?? Array.from({ length: Math.min(g.plies, MAX_PLY + 1) }, (_, n) => n);
    for (const n of ns) {
      if (n > g.plies - 1) continue;
      const cp = n === 0 ? 0 : g.evals[n - 1];
      const m = n === 0 ? START_MATERIAL : g.material[n - 1][0] + g.material[n - 1][1];
      out.push({ g, ply: n, cp, mat: m, y });
    }
  }
  return out;
}
const pub = (s: Side) => ({ rating: s.rating, rd: s.rd });

// ------------------------------------------------------------------ BFGS with numerical gradients
function minimize(f: (p: number[]) => number, p0: number[], iters = 200): number[] {
  const n = p0.length;
  let p = [...p0], fp = f(p);
  const grad = (x: number[]) => x.map((_, i) => { const h = 1e-5 * Math.max(1, Math.abs(x[i])); const a = [...x], b = [...x]; a[i] += h; b[i] -= h; return (f(a) - f(b)) / (2 * h); });
  let g = grad(p);
  let H: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let it = 0; it < iters; it++) {
    const d = H.map(row => -row.reduce((a, h, j) => a + h * g[j], 0));
    let step = 1, pn = p, fn = fp;
    const slope = d.reduce((a, x, i) => a + x * g[i], 0);
    if (slope >= 0) { H = H.map((r, i) => r.map((_, j): number => (i === j ? 1 : 0))); continue; }
    for (let k = 0; k < 40; k++) { pn = p.map((x, i) => x + step * d[i]); fn = f(pn); if (fn <= fp + 1e-4 * step * slope) break; step /= 2; }
    if (!(fn < fp)) break;
    const gn = grad(pn);
    const s = pn.map((x, i) => x - p[i]), yv = gn.map((x, i) => x - g[i]);
    const sy = s.reduce((a, x, i) => a + x * yv[i], 0);
    if (sy > 1e-12) {
      const Hy = H.map(row => row.reduce((a, h, j) => a + h * yv[j], 0));
      const yHy = yv.reduce((a, x, i) => a + x * Hy[i], 0);
      H = H.map((row, i) => row.map((h, j) => h + ((sy + yHy) * s[i] * s[j]) / (sy * sy) - (Hy[i] * s[j] + s[i] * Hy[j]) / sy));
    }
    const done = Math.abs(fp - fn) < 1e-10 * Math.max(1, Math.abs(fp));
    p = pn; fp = fn; g = gn;
    if (done) break;
  }
  return p;
}
/** Approximate standard errors from a numerical Hessian of the total negative log-likelihood. */
function stdErrors(f: (p: number[]) => number, p: number[], nObs: number): number[] {
  const n = p.length, h = 1e-3;
  const Hm = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    const e = (di: number, dj: number) => { const x = [...p]; x[i] += di; x[j] += dj; return f(x); };
    const v = (e(h, h) - e(h, -h) - e(-h, h) + e(-h, -h)) / (4 * h * h) * nObs;
    Hm[i][j] = Hm[j][i] = v;
  }
  // invert (Gauss–Jordan)
  const A: number[][] = Hm.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c]; if (Math.abs(d) < 1e-14) return new Array(n).fill(NaN);
    for (let k = 0; k < 2 * n; k++) A[c][k] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const m = A[r][c]; for (let k = 0; k < 2 * n; k++) A[r][k] -= m * A[c][k]; }
  }
  return A.map((r, i) => Math.sqrt(Math.max(0, r[n + i])));
}

const ll = (v: number[], y: number) => -Math.log(Math.max(1e-12, v[y]));
const brier = (v: number[], y: number) => v.reduce((a, p, i) => a + (p - (i === y ? 1 : 0)) ** 2, 0);

// ------------------------------------------------------------------ models
const KNOTS = [0, 1, 10, 20, 40, 80, 160];
function makeCoef(pre: OddsCoefficients['pre'], live: number[], clampCp: number, id: string): OddsCoefficients {
  const k = KNOTS.length - 1; // free knots (index 1..)
  const a = [1, ...live.slice(0, k)], b = [0, ...live.slice(k, 2 * k).map(Math.exp)], d = [0, ...live.slice(2 * k, 3 * k)];
  return { id, pre, live: { knots: KNOTS, a, b, d, m: live[3 * k], clampCp } };
}
const vecNew = (c: OddsCoefficients, o: Obs) => liveModelVector({ white: pub(o.g.white), black: pub(o.g.black), ply: o.ply, evalCp: o.cp, material: o.mat }, 0.005, c);
/** The pre-v0.9 model (crown-result-model-1 + the inline live mapping in FederationService.liveStep). */
function vecOld(o: Obs): number[] {
  const f = davidson(o.g.white.rating, o.g.black.rating);
  if (o.ply === 0) return [f.w, f.d, f.l];
  const sc = Math.abs(o.cp) >= 100000 ? { kind: 'mate' as const, plies: o.cp > 0 ? 1 : -1, pov: 'white' as const, proven: false as const } : { kind: 'cp' as const, value: o.cp, pov: 'white' as const };
  const u = expectedU(sc);
  const d = Math.max(0.01, f.d * (1 - Math.abs(2 * u - 1)));
  const live = [Math.max(0.005, u - d / 2), d, Math.max(0.005, 1 - u - d / 2)];
  const s = live.reduce((a, x) => a + x, 0);
  return live.map(x => x / s);
}

// 1) pre-game fit on ply-0 observations (results only)
const pre0 = obsOf(train, [0]);
// level range of the fit data (the model never extrapolates the draw-width level term beyond it)
const levels = train.map(g => ((g.white.rating + g.black.rating) / 2 - 2200) / 400).sort((a, b) => a - b);
const levelMin = +levels[Math.floor(0.01 * levels.length)].toFixed(3), levelMax = +levels[Math.floor(0.99 * levels.length)].toFixed(3);
const dummyLive = { knots: [0], a: [1], b: [0], d: [0], m: 0, clampCp: 1 };
const preLossWith = (pr: OddsCoefficients['pre']) => { let s = 0; for (const o of pre0) { const r = pregameWdl(pub(o.g.white), pub(o.g.black), { id: '', pre: pr, live: dummyLive }); s += ll([r.w, r.d, r.l], o.y); } return s / pre0.length; };
// γ = 1: Glicko's g(RD). A free γ is fitted too and reported only (it is not identified by these RDs).
const preOf = (p: number[]) => ({ beta: p[0], gamma: 1, alpha: p[1], t0: p[2], t1: p[3], levelMin, levelMax });
const preLoss = (p: number[]) => preLossWith(preOf(p));
const preP = minimize(preLoss, [1, 0, -0.5, 0]);
const preSe = stdErrors(preLoss, preP, pre0.length);
const PRE = preOf(preP);
const freeG = minimize(p => preLossWith({ beta: p[0], gamma: Math.exp(p[1]), alpha: p[2], t0: p[3], t1: p[4], levelMin, levelMax }), [preP[0], 0, preP[1], preP[2], preP[3]]);
const freeGamma = { gamma: +Math.exp(freeG[1]).toFixed(3), beta: +freeG[0].toFixed(3), trainLogLoss: +preLossWith({ beta: freeG[0], gamma: Math.exp(freeG[1]), alpha: freeG[2], t0: freeG[3], t1: freeG[4], levelMin, levelMax }).toFixed(5), fixedGammaTrainLogLoss: +preLoss(preP).toFixed(5) };
console.log('pre-game', PRE, 'se', preSe.map(x => +x.toFixed(4)), 'train ll', preLoss(preP).toFixed(4), 'free gamma', freeGamma);

// 2) live fit on all training plies, pre-game fixed; clamp chosen by training likelihood
// every ply up to 40, then every 4th ply (keeps the fit cheap; late plies are highly correlated within a game)
const trainObs = obsOf(train).filter(o => o.ply > 0 && (o.ply <= 40 || o.ply % 4 === 0));
const k = KNOTS.length - 1;
const liveInit = [...new Array(k).fill(1), ...new Array(k).fill(Math.log(0.5)), ...new Array(k).fill(0), 0];
function fitLive(pre: OddsCoefficients['pre'], clampCp: number, obs: Obs[], init = liveInit) {
  const loss = (p: number[]) => { const c = makeCoef(pre, p, clampCp, ''); let s = 0; for (const o of obs) s += ll(vecNew(c, o), o.y); return s / obs.length; };
  const p = minimize(loss, init, 150);
  return { p, loss: loss(p), lossFn: loss };
}
const clampGrid = [400, 800, 1600];
let best: { clamp: number; p: number[]; loss: number; lossFn: (p: number[]) => number } | null = null;
const clampLoss: Record<number, number> = {};
for (const cl of clampGrid) {
  const r = fitLive(PRE, cl, trainObs);
  clampLoss[cl] = +r.loss.toFixed(5);
  console.log('clamp', cl, 'train ll', r.loss.toFixed(5));
  if (!best || r.loss < best.loss) best = { clamp: cl, ...r };
}
const liveSe = stdErrors(best!.lossFn, best!.p, trainObs.length);
const NEW = makeCoef(PRE, best!.p, best!.clamp, 'crown-odds-2');

// 3) eval-only baseline: no ratings at all (β = 0, no level term), same live structure
const preE = obsOf(train, [0]);
const preEL = (p: number[]) => { let s = 0; for (const o of preE) { const r = ordered(p[0], Math.exp(p[1])); s += ll([r.w, r.d, r.l], o.y); } return s / preE.length; };
const pe = minimize(preEL, [0, -0.5]);
const PRE_E = { beta: 0, gamma: 0, alpha: pe[0], t0: pe[1], t1: 0, levelMin: 0, levelMax: 0 };
const EVAL_ONLY = makeCoef(PRE_E, fitLive(PRE_E, best!.clamp, trainObs).p, best!.clamp, 'eval-only');

// ------------------------------------------------------------------ held-out evaluation
const MODELS: Record<string, (o: Obs) => number[]> = {
  old: vecOld,
  new: o => vecNew(NEW, o),
  ratingOnly: o => { const r = pregameWdl(pub(o.g.white), pub(o.g.black), NEW); return [r.w, r.d, r.l]; },
  evalOnly: o => vecNew(EVAL_ONLY, o),
};
const CHECKPOINTS = [0, 10, 20, 40, 60, 80];
function score(obs: Obs[], fn: (o: Obs) => number[]) { let a = 0, b = 0; for (const o of obs) { const v = fn(o); a += ll(v, o.y); b += brier(v, o.y); } return { logLoss: +(a / obs.length).toFixed(4), brier: +(b / obs.length).toFixed(4) }; }
function bootDiff(obs: Obs[], f1: (o: Obs) => number[], f2: (o: Obs) => number[], reps = 400) {
  // cluster bootstrap by game of the log-loss difference f1 − f2
  const byGame = new Map<string, number[]>();
  for (const o of obs) { const v = ll(f1(o), o.y) - ll(f2(o), o.y); byGame.set(o.g.id, [...(byGame.get(o.g.id) ?? []), v]); }
  const gs = [...byGame.values()];
  let seed = 12345; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  const stats: number[] = [];
  for (let r = 0; r < reps; r++) { let s = 0, n = 0; for (let i = 0; i < gs.length; i++) { const x = gs[Math.floor(rnd() * gs.length)]; for (const v of x) { s += v; n++; } } stats.push(s / n); }
  stats.sort((a, b) => a - b);
  return [+stats[Math.floor(0.025 * reps)].toFixed(4), +stats[Math.floor(0.975 * reps)].toFixed(4)];
}
function calibration(obs: Obs[], fn: (o: Obs) => number[], cls: number) {
  const rows = obs.map(o => [fn(o)[cls], o.y === cls ? 1 : 0]).sort((a, b) => a[0] - b[0]);
  const out: { bin: number; n: number; predicted: number; observed: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const part = rows.slice(Math.floor((i * rows.length) / 10), Math.floor(((i + 1) * rows.length) / 10));
    if (!part.length) continue;
    out.push({ bin: i + 1, n: part.length, predicted: +(part.reduce((a, r) => a + r[0], 0) / part.length).toFixed(3), observed: +(part.reduce((a, r) => a + r[1], 0) / part.length).toFixed(3) });
  }
  const ece = out.reduce((a, r) => a + (r.n * Math.abs(r.predicted - r.observed)), 0) / rows.length;
  return { ece: +ece.toFixed(4), deciles: out };
}

const results: Record<string, unknown> = {};
for (const n of CHECKPOINTS) {
  const obs = obsOf(test, [n]);
  const row: Record<string, unknown> = { n: obs.length, observed: { w: +(obs.filter(o => o.y === 0).length / obs.length).toFixed(3), d: +(obs.filter(o => o.y === 1).length / obs.length).toFixed(3), l: +(obs.filter(o => o.y === 2).length / obs.length).toFixed(3) } };
  for (const [name, fn] of Object.entries(MODELS)) row[name] = score(obs, fn);
  row.newMinusOldLogLossCI = bootDiff(obs, MODELS.new, MODELS.old);
  results[`ply${n}`] = row;
}
const allTest = obsOf(test);
const pooled: Record<string, unknown> = { n: allTest.length };
for (const [name, fn] of Object.entries(MODELS)) pooled[name] = score(allTest, fn);
pooled.newMinusOldLogLossCI = bootDiff(allTest, MODELS.new, MODELS.old);
results.allPlies = pooled;
const calib: Record<string, unknown> = {};
for (const n of [0, 20]) {
  const obs = obsOf(test, [n]);
  calib[`ply${n}`] = { new: { white: calibration(obs, MODELS.new, 0), draw: calibration(obs, MODELS.new, 1) }, old: { white: calibration(obs, MODELS.old, 0), draw: calibration(obs, MODELS.old, 1) } };
}
calib.allPlies = { new: { white: calibration(allTest, MODELS.new, 0), draw: calibration(allTest, MODELS.new, 1) }, old: { white: calibration(allTest, MODELS.old, 0), draw: calibration(allTest, MODELS.old, 1) } };

// diagnostics: equal-rating draw rate by level, rating-gap effect at equal evaluation
const diag = {
  equalRatingsPregame: [1400, 1800, 2200, 2600].map(r => ({ rating: r, ...round3(pregameWdl({ rating: r, rd: 80 }, { rating: r, rd: 80 }, NEW)) })),
  equalEvalPly10: [-300, -150, 0, 150, 300].map(gap => ({ gap, ...round3(Object.fromEntries(['w', 'd', 'l'].map((kk, i) => [kk, liveModelVector({ white: { rating: 2300 + gap / 2, rd: 80 }, black: { rating: 2300 - gap / 2, rd: 80 }, ply: 10, evalCp: 0, material: START_MATERIAL }, 0.005, NEW)[i]])) as { w: number; d: number; l: number }) })),
  observedDrawRateByLevel: [[0, 1600], [1600, 2000], [2000, 2300], [2300, 9999]].map(([lo, hi]) => { const gs = games.filter(g => { const m = (g.white.rating + g.black.rating) / 2; return m >= lo && m < hi && Math.abs(g.white.rating - g.black.rating) < 150; }); return { meanRating: `${lo}–${hi}`, games: gs.length, drawRate: +(gs.filter(g => g.result === '1/2-1/2').length / Math.max(1, gs.length)).toFixed(3) }; }),
  whiteScore: +(games.reduce((a, g) => a + (g.result === '1-0' ? 1 : g.result === '1/2-1/2' ? 0.5 : 0), 0) / games.length).toFixed(4),
};
function round3(p: { w: number; d: number; l: number }) { return { w: +p.w.toFixed(3), d: +p.d.toFixed(3), l: +p.l.toFixed(3) }; }

const fit = {
  method: 'Two-stage maximum likelihood (BFGS, numerical gradients): pre-game ordered logit on ply-0 results; then live knots on every training ply ≤ 240 with the pre-game part fixed. Eval clamp chosen from the grid by training likelihood.',
  data: `tools/odds/generate.ts federation-style engine games: ${all.length} games (${all.length - games.length} censored by the 400-ply limit and excluded), worlds ${[...new Set(games.map(g => g.id.split('g')[0]))].join(', ')}`,
  split: 'by game: FNV-1a(game id) mod 4 = 0 held out',
  trainGames: train.length, testGames: test.length, trainLivePoints: trainObs.length,
  preGameStdErr: { beta: +preSe[0].toFixed(4), alpha: +preSe[1].toFixed(4), t0: +preSe[2].toFixed(4), t1: +preSe[3].toFixed(4) }, freeGammaCheck: freeGamma,
  liveStdErr: liveSe.map(x => +x.toFixed(4)),
  clampTrainLogLoss: clampLoss,
  heldOutLogLoss: { ply0: (results.ply0 as { new: unknown }).new, allPlies: pooled.new },
};
const rnd = (x: number) => +x.toFixed(5);
const coefOut = { id: NEW.id, pre: Object.fromEntries(Object.entries(NEW.pre).map(([kk, v]) => [kk, rnd(v)])), live: { knots: NEW.live.knots, a: NEW.live.a.map(rnd), b: NEW.live.b.map(rnd), d: NEW.live.d.map(rnd), m: rnd(NEW.live.m), clampCp: NEW.live.clampCp }, fit };
writeFileSync(COEF_OUT, JSON.stringify(coefOut, null, 1) + '\n');
writeFileSync(REPORT_OUT, JSON.stringify({ id: NEW.id, fit, coefficients: { pre: coefOut.pre, live: coefOut.live }, evalOnlyCoefficients: EVAL_ONLY, results, calibration: calib, diagnostics: diag }, null, 1) + '\n');
console.log(JSON.stringify({ coef: { pre: coefOut.pre, live: coefOut.live }, results, diag }, null, 1));
void knotValue; void pregameLatent;
