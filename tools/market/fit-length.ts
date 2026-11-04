/**
 * Fit and validate the match-length model (crown-length-1) for the over/under plies market.
 *   npx tsx tools/market/fit-length.ts [dataDir=tools/odds/data] [coefOut=src/exchange/length-coefficients.json] [reportOut=docs/sim/length-crown-length-1.json]
 *
 * Data: the same 3,200 federation-style engine games used for crown-odds-2 (tools/odds/generate.ts): public ratings
 * and RDs, the official ply count of each game. Games censored by the 400-ply limit would be kept (the length market
 * settles on the recorded ply count, which is 400 for such a game); the data has none.
 * Split BY GAME exactly as tools/odds/fit.ts (FNV-1a(game id) mod 4 = 0 held out). Coefficients are maximum-likelihood
 * (Newton/IRLS) on training games only; every reported metric is on held-out games only.
 *
 * Model: logit P(plies > X) = c·f, f = [1, u, L, G, L·u, G·u], u = ln(X/60), L = clamp((mean rating − 2200)/400),
 * G = clamp(|rating gap|/400). Public ratings only (never latent strength).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lengthFeatures, LengthCoefficients, pOver, lengthLine } from '../../src/exchange/length';

interface Side { rating: number; rd: number }
interface Game { id: string; white: Side; black: Side; plies: number; termination: string }
const DIR = process.argv[2] ?? 'tools/odds/data', COEF_OUT = process.argv[3] ?? 'src/exchange/length-coefficients.json', REPORT_OUT = process.argv[4] ?? 'docs/sim/length-crown-length-1.json';
const games: Game[] = readdirSync(DIR).filter(f => f.endsWith('.json')).sort().flatMap(f => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Game[]);
const fnv = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const isTest = (g: Game) => fnv(g.id) % 4 === 0;
const train = games.filter(g => !isTest(g)), test = games.filter(isTest);
const GRID = Array.from({ length: 37 }, (_, i) => 20 + 5 * i); // X = 20 … 200
const range = { levelMin: -1.75, levelMax: 1.25, gapMax: 1.5 };
const base: LengthCoefficients = { id: 'crown-length-1', c: [0, 0, 0, 0, 0, 0], ...range };

const rows = (gs: Game[]) => gs.flatMap(g => GRID.map(X => ({ f: lengthFeatures(g.white, g.black, X, base), y: g.plies > X ? 1 : 0 })));
const R = rows(train);
const sig = (z: number) => 1 / (1 + Math.exp(-z));
let c = [0, -2, 0, 0, 0, 0];
for (let it = 0; it < 50; it++) {
  const k = c.length, g = new Array(k).fill(0), H = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const r of R) {
    const p = sig(r.f.reduce((a, x, i) => a + x * c[i], 0)), w = p * (1 - p);
    for (let i = 0; i < k; i++) { g[i] += (r.y - p) * r.f[i]; for (let j = 0; j < k; j++) H[i][j] += w * r.f[i] * r.f[j]; }
  }
  // solve H·d = g (Gaussian elimination)
  const A = H.map((row, i) => [...row, g[i]]);
  for (let i = 0; i < k; i++) {
    let piv = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    for (let r = 0; r < k; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let j = i; j <= k; j++) A[r][j] -= f * A[i][j]; }
  }
  const d = A.map((row, i) => row[k] / row[i]);
  c = c.map((x, i) => x + d[i]);
  if (Math.max(...d.map(Math.abs)) < 1e-10) break;
}
const coef: LengthCoefficients = { ...base, c: c.map(x => +x.toFixed(6)) };

// ---------------------------------------------------------------- held-out evaluation
const ll = (p: number, y: number) => -(y ? Math.log(Math.max(1e-12, p)) : Math.log(Math.max(1e-12, 1 - p)));
const marginal = new Map(GRID.map(X => [X, train.filter(g => g.plies > X).length / train.length]));
let llModel = 0, llBase = 0, n = 0;
for (const g of test) for (const X of GRID) { const y = g.plies > X ? 1 : 0; llModel += ll(pOver(g.white, g.black, X, coef), y); llBase += ll(marginal.get(X)!, y); n++; }
// the market line: per held-out game the model's own line; calibration of P(over) at that line, in 5 bins
// calibration of P(N > X) over every held-out (game, X) row, ten bins
const bins = Array.from({ length: 10 }, (_, i) => ({ lo: i / 10, hi: (i + 1) / 10, n: 0, sp: 0, sy: 0 }));
for (const g of test) for (const X of GRID) { const p = pOver(g.white, g.black, X, coef), y = g.plies > X ? 1 : 0; const b = bins[Math.min(9, Math.floor(p * 10))]; b.n++; b.sp += p; b.sy += y; }
let lineOver = 0, brierLine = 0;
for (const g of test) {
  const X = lengthLine(g.white, g.black, coef), p = pOver(g.white, g.black, X, coef), y = g.plies > X ? 1 : 0;
  lineOver += y; brierLine += (p - y) ** 2;
}
const monotone = [-1.75, 0, 1.25].every(L => [0, 0.75, 1.5].every(G => GRID.every((X, i) => i === 0 || lengthLogit(L, G, X) < lengthLogit(L, G, GRID[i - 1]))));
function lengthLogit(L: number, G: number, X: number) { const u = Math.log(X / 60); return [1, u, L, G, L * u, G * u].reduce((a, x, i) => a + x * coef.c[i], 0); }

const report = {
  id: coef.id,
  data: `${games.length} games from ${DIR} (tools/odds/generate.ts), censored by the playing limit: ${games.filter(g => g.termination === 'playing-limit').length}`,
  split: 'by game: FNV-1a(game id) mod 4 = 0 held out', trainGames: train.length, testGames: test.length, grid: `X = ${GRID[0]}…${GRID[GRID.length - 1]} step 5`,
  coefficients: coef.c, features: '[1, ln(X/60), level, gap, level·ln(X/60), gap·ln(X/60)]',
  heldOut: {
    logLossPerRow: +(llModel / n).toFixed(5), baselineMarginalLogLoss: +(llBase / n).toFixed(5), rows: n,
    atModelLine: { games: test.length, overRate: +(lineOver / test.length).toFixed(4), brier: +(brierLine / test.length).toFixed(4) },
    calibrationAllRows: bins.map(b => ({ bin: `${b.lo.toFixed(2)}–${b.hi.toFixed(2)}`, n: b.n, meanP: b.n ? +(b.sp / b.n).toFixed(3) : null, freq: b.n ? +(b.sy / b.n).toFixed(3) : null })),
  },
  monotoneInLine: monotone,
};
writeFileSync(COEF_OUT, JSON.stringify({ ...coef, fit: { trainGames: train.length, testGames: test.length, heldOutLogLoss: report.heldOut.logLossPerRow, baselineLogLoss: report.heldOut.baselineMarginalLogLoss } }, null, 1) + '\n');
writeFileSync(REPORT_OUT, JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
