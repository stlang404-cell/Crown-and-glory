/**
 * Publishes the crown-outcome-map-v1 expected-score curve: isotonic (PAV) fit of game outcome on the
 * side-to-move Crown evaluation over the full calibration corpus, reduced to monotone knots and
 * interpolated linearly (src/analysis/outcomeMap.ts). Held-out evidence: tools/calibration/fit-results.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8')) as { data: { cp: number | null; y: number }[]; depth: number };
const fit = JSON.parse(readFileSync(new URL('./fit-results.json', import.meta.url), 'utf8'));
const pts = corpus.data.filter(p => p.cp !== null).map(p => ({ cp: Math.max(-2000, Math.min(2000, p.cp!)), y: p.y })).sort((a, b) => a.cp - b.cp);
const blocks: { lo: number; hi: number; sum: number; n: number }[] = [];
for (const p of pts) {
  blocks.push({ lo: p.cp, hi: p.cp, sum: p.y, n: 1 });
  while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n >= blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
    const b = blocks.pop()!, a = blocks.pop()!;
    blocks.push({ lo: a.lo, hi: b.hi, sum: a.sum + b.sum, n: a.n + b.n });
  }
}
let knots = blocks.map(b => [Math.round((b.lo + b.hi) / 2), +(b.sum / b.n).toFixed(4)] as [number, number]);
// merge knots closer than 10 cp, keep strictly increasing u, clamp ends to (0.005, 0.995)
const out: [number, number][] = [];
for (const k of knots) { if (out.length && k[0] - out[out.length - 1][0] < 10) { out[out.length - 1] = [out[out.length - 1][0], Math.max(out[out.length - 1][1], k[1])]; continue; } if (!out.length || k[1] > out[out.length - 1][1]) out.push(k); }
knots = out.map(([c, u]) => [c, Math.min(0.995, Math.max(0.005, u))]);
writeFileSync(new URL('../../src/analysis/outcome-map-v1.json', import.meta.url), JSON.stringify({
  id: 'crown-outcome-map-v1',
  method: 'Isotonic regression (pool-adjacent-violators) of game result for the side to move on Crown evaluation (depth ' + corpus.depth + '), monotone knots, linear interpolation, clamped to [-2000, 2000] cp.',
  corpusPositions: pts.length,
  heldOut: { brierP0: fit.metrics.P0.brier, brierIso: fit.metrics.ISO.brier, brierDiffCI: fit.metrics.ISO.brierMinusP0CI, eceP0: fit.metrics.P0.ece, eceIso: fit.metrics.ISO.ece, validation: 'leave-one-opening-family-out, game-cluster bootstrap' },
  caveat: 'Fitted on engine-vs-engine games (~40k nodes per move). Human games may convert advantages differently.',
  knots,
}));
console.log('knots', knots.length, knots.slice(0, 3), knots.slice(-3), 'u(0)≈', knots.find(k => k[0] >= 0));
