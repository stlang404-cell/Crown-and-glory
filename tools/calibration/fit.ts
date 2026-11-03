/**
 * Expected-outcome mapping validation (crown-calib-fit-1).
 * Leave-one-opening-family-out cross-validation (families = White's first move, 10 families):
 * every position is predicted by a model fitted without its family. Candidates:
 *   P0  logistic, s = 200 cp (research placeholder, no fitting)
 *   L1  logistic, fitted scale s
 *   L2  logistic, fitted scale s and side-to-move intercept a
 *   ISO isotonic (pool-adjacent-violators) on cp
 * Metrics on out-of-fold predictions: Brier, log loss (soft labels ½ for draws), expected calibration
 * error (10 equal-count bins). 95% intervals by bootstrap over games (positions in a game are correlated).
 * Mate-scored positions are excluded from the cp mapping and reported separately.
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface P { g: string; fam: string; ply: number; stm: number; cp: number | null; mate: number | null; y: number; queens: number; pieces: number }
const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8')) as { depth: number; games: number; data: P[] };
const all = corpus.data;
const cpPos = all.filter(p => p.cp !== null).map(p => ({ ...p, cp: Math.max(-2000, Math.min(2000, p.cp!)) }));
const matePos = all.filter(p => p.mate !== null);
const fams = [...new Set(cpPos.map(p => p.fam))].sort();
const sig = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (p: number) => Math.min(1 - 1e-6, Math.max(1e-6, p));

type Model = (p: { cp: number; stm: number }) => number;
function fitLogistic(train: { cp: number; y: number; stm: number }[], intercept: boolean): { s: number; a: number; model: Model } {
  // gradient descent on soft-label cross-entropy, parameters w = 1/s and a
  let w = 1 / 200, a = 0;
  for (let it = 0; it < 3000; it++) {
    let gw = 0, ga = 0, hw = 0, ha = 0;
    for (const p of train) {
      const q = sig(w * p.cp + a);
      gw += (q - p.y) * p.cp; ga += (q - p.y);
      hw += q * (1 - q) * p.cp * p.cp; ha += q * (1 - q);
    }
    w -= gw / Math.max(hw, 1e-9);
    if (intercept) a -= ga / Math.max(ha, 1e-9);
    if (Math.abs(gw / Math.max(hw, 1e-9)) < 1e-10) break;
  }
  return { s: 1 / w, a, model: p => sig(w * p.cp + a) };
}
function fitIsotonic(train: { cp: number; y: number }[]): Model {
  const sorted = [...train].sort((a, b) => a.cp - b.cp);
  const blocks: { lo: number; hi: number; sum: number; n: number }[] = [];
  for (const p of sorted) {
    blocks.push({ lo: p.cp, hi: p.cp, sum: p.y, n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n >= blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
      const b = blocks.pop()!, a = blocks.pop()!;
      blocks.push({ lo: a.lo, hi: b.hi, sum: a.sum + b.sum, n: a.n + b.n });
    }
  }
  const pts = blocks.map(b => ({ x: (b.lo + b.hi) / 2, v: b.sum / b.n }));
  return p => {
    if (p.cp <= pts[0].x) return pts[0].v;
    if (p.cp >= pts[pts.length - 1].x) return pts[pts.length - 1].v;
    let i = 1; while (pts[i].x < p.cp) i++;
    const a = pts[i - 1], b = pts[i];
    return a.v + ((b.v - a.v) * (p.cp - a.x)) / Math.max(1e-9, b.x - a.x);
  };
}

const names = ['P0', 'L1', 'L2', 'ISO'] as const;
const oof: Record<string, number[]> = { P0: [], L1: [], L2: [], ISO: [] };
const fitted: Record<string, { s: number; a: number }[]> = { L1: [], L2: [] };
const order: P[] = [];
for (const fam of fams) {
  const train = cpPos.filter(p => p.fam !== fam), test = cpPos.filter(p => p.fam === fam);
  const l1 = fitLogistic(train, false), l2 = fitLogistic(train, true), iso = fitIsotonic(train);
  fitted.L1.push({ s: l1.s, a: 0 }); fitted.L2.push({ s: l2.s, a: l2.a });
  for (const p of test) {
    order.push(p as P);
    oof.P0.push(sig(p.cp / 200)); oof.L1.push(l1.model(p)); oof.L2.push(l2.model(p)); oof.ISO.push(iso(p));
  }
}
const ys = order.map(p => p.y);
const brier = (pred: number[], idx: number[]) => idx.reduce((a, i) => a + (pred[i] - ys[i]) ** 2, 0) / idx.length;
const logloss = (pred: number[], idx: number[]) => idx.reduce((a, i) => { const q = clamp(pred[i]); return a - (ys[i] * Math.log(q) + (1 - ys[i]) * Math.log(1 - q)); }, 0) / idx.length;
function ece(pred: number[], idx: number[], bins = 10) {
  const s = [...idx].sort((a, b) => pred[a] - pred[b]);
  let e = 0; const table: { meanPred: number; meanOutcome: number; n: number }[] = [];
  for (let k = 0; k < bins; k++) {
    const part = s.slice(Math.floor((k * s.length) / bins), Math.floor(((k + 1) * s.length) / bins));
    if (!part.length) continue;
    const mp = part.reduce((a, i) => a + pred[i], 0) / part.length, mo = part.reduce((a, i) => a + ys[i], 0) / part.length;
    e += (part.length / s.length) * Math.abs(mp - mo);
    table.push({ meanPred: +mp.toFixed(3), meanOutcome: +mo.toFixed(3), n: part.length });
  }
  return { ece: e, table };
}
// game-cluster bootstrap
const games = [...new Set(order.map(p => p.g))];
const byGame = new Map<string, number[]>();
order.forEach((p, i) => byGame.set(p.g, [...(byGame.get(p.g) ?? []), i]));
let seed = 99;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const allIdx = order.map((_, i) => i);
const boot: Record<string, number[]> = Object.fromEntries(names.map(n => [n, []]));
const bootDiff: Record<string, number[]> = Object.fromEntries(names.map(n => [n, []]));
for (let b = 0; b < 500; b++) {
  const idx: number[] = [];
  for (let k = 0; k < games.length; k++) idx.push(...byGame.get(games[Math.floor(rnd() * games.length)])!);
  const base = brier(oof.P0, idx);
  for (const n of names) { const v = brier(oof[n], idx); boot[n].push(v); bootDiff[n].push(v - base); }
}
const ci = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(s.length * 0.025)], s[Math.floor(s.length * 0.975)]]; };
const metrics = Object.fromEntries(names.map(n => {
  const e = ece(oof[n], allIdx);
  return [n, { brier: brier(oof[n], allIdx), brierCI: ci(boot[n]), brierMinusP0CI: ci(bootDiff[n]), logloss: logloss(oof[n], allIdx), ece: e.ece, reliability: e.table }];
}));
// full-data fits for publication
const full1 = fitLogistic(cpPos, false), full2 = fitLogistic(cpPos, true);
const mateWins = matePos.filter(p => p.mate! > 0), mateLoss = matePos.filter(p => p.mate! < 0);
const out = {
  id: 'crown-calib-fit-1', corpus: { depth: corpus.depth, games: corpus.games, positions: all.length, cpPositions: cpPos.length, matePositions: matePos.length, families: fams },
  metrics,
  foldParams: fitted,
  fullFit: { L1: { s: full1.s }, L2: { s: full2.s, a: full2.a } },
  mate: { favourable: { n: mateWins.length, meanOutcome: mateWins.reduce((a, p) => a + p.y, 0) / Math.max(1, mateWins.length) }, unfavourable: { n: mateLoss.length, meanOutcome: mateLoss.reduce((a, p) => a + p.y, 0) / Math.max(1, mateLoss.length) } },
};
writeFileSync(new URL('./fit-results.json', import.meta.url), JSON.stringify(out, null, 1));
for (const n of names) console.log(n, 'brier', metrics[n].brier.toFixed(5), 'CI', metrics[n].brierCI.map(x => x.toFixed(5)).join('–'), 'Δ vs P0', metrics[n].brierMinusP0CI.map(x => x.toFixed(5)).join('–'), 'logloss', metrics[n].logloss.toFixed(4), 'ece', metrics[n].ece.toFixed(4));
console.log('full fit L1 s', full1.s.toFixed(1), 'L2', full2.s.toFixed(1), full2.a.toFixed(3), 'mate', JSON.stringify(out.mate));
