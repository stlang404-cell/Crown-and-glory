/**
 * Played Like Performance Elo (crown-played-like-2): model loading, parity with the fitted model, held-out validation
 * recomputed by the shipped TypeScript code, monotonic sanity, uncertainty vs informative moves, gates, determinism.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import MODEL from '../src/analysis/played-like-model.json';
import {
  PLAYED_LIKE_ID, PLAYED_LIKE_VALIDATED, estimateFromFeatures, playedLike, playedLikeFromPlies, playedLikeRecord, playedLikeSd, rawPlayedLike, reportForPlayedLike,
} from '../src/analysis/playedLike';
import { FEATURE_NAMES, isInformative, sideFeatures, type LitePly, type SideFeatures } from '../src/analysis/playedLikeFeatures';
import type { AnalysisReport } from '../src/analysis/types';

// deterministic synthetic game: per-move losses for one side in positions with a given candidate spread
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
function synthGame(moves: number, lossScale: number, seed = 7, side: 0 | 1 = 0): LitePly[] {
  const r = rng(seed); const out: LitePly[] = [];
  for (let i = 0; i < moves; i++) {
    const ply = 2 * i + 1 + side + 4;
    const ub = 0.35 + 0.3 * r();
    const raw = r() < 0.15 ? 0.3 * r() + 0.15 : 0.04 * r() * r();
    const loss = Math.min(ub - 0.0001, raw * lossScale);
    const cu = [ub, ub - 0.02 - 0.15 * r(), ub - 0.2 * r() - 0.05].sort((a, b) => b - a);
    out.push({ ply, c: side, forced: 0, legal: 8 + Math.floor(12 * r()), ph: i < 6 ? 0 : i < 20 ? 1 : 2, loss, lossPrev: loss, g: -1, ub, up: ub - loss, cu });
  }
  return out;
}
const feats = (moves: number, scale: number, seed = 7) => sideFeatures(synthGame(moves, scale, seed), 'white');

interface Row extends SideFeatures { test: boolean; rating: number; accuracy: number | null }
const ROWS: Row[] = readFileSync('tools/playedlike/data/features-std-d7.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));

describe('Played Like model', () => {
  it('loads with its features, calibration, uncertainty and a stored held-out validation', () => {
    expect(PLAYED_LIKE_ID).toBe('crown-played-like-2');
    expect(MODEL.features.every(f => (FEATURE_NAMES as string[]).includes(f))).toBe(true);
    expect(MODEL.beta).toHaveLength(MODEL.features.length + 1);
    expect(MODEL.calibration.knots.length).toBe(MODEL.calibration.values.length);
    for (let i = 1; i < MODEL.calibration.values.length; i++) expect(MODEL.calibration.values[i]).toBeGreaterThanOrEqual(MODEL.calibration.values[i - 1]);
    expect(MODEL.validation.heldOut.n).toBeGreaterThan(100);
    expect(PLAYED_LIKE_VALIDATED).toBe(MODEL.validation.gate.passed);
  });

  it('the TypeScript prediction reproduces the fitted model on its fixtures', () => {
    for (const fx of MODEL.fixtures) expect(Math.abs(rawPlayedLike({ ...(fx.features as unknown as SideFeatures), n: fx.n }) - fx.pred)).toBeLessThan(0.5);
  });

  it('held-out validation recomputed by the shipped code matches the stored numbers', () => {
    const test = ROWS.filter(r => r.test && r.n >= MODEL.minMoves);
    expect(test.length).toBe(MODEL.validation.heldOut.n);
    const err = test.map(r => rawPlayedLike(r) - r.rating);
    const mae = err.reduce((a, e) => a + Math.abs(e), 0) / err.length;
    const rmse = Math.sqrt(err.reduce((a, e) => a + e * e, 0) / err.length);
    expect(Math.abs(mae - MODEL.validation.heldOut.mae)).toBeLessThan(1);
    expect(Math.abs(rmse - MODEL.validation.heldOut.rmse)).toBeLessThan(1);
    const in80 = test.filter(r => { const p = rawPlayedLike(r); return Math.abs(p - r.rating) <= MODEL.uncertainty.z80 * playedLikeSd(r.n, p); }).length / test.length;
    expect(Math.abs(in80 - MODEL.validation.heldOut.cover80)).toBeLessThan(0.002);
  });

  it.runIf(PLAYED_LIKE_VALIDATED)('validated: beats the mean and accuracy-line baselines on held-out games and separates the bands', () => {
    const V = MODEL.validation;
    expect(V.heldOut.mae).toBeLessThan(V.baselineMean.mae);
    expect(V.heldOut.mae).toBeLessThan(V.baselineAccuracyLine.mae);
    expect(V.heldOut.rmse).toBeLessThan(V.baselineAccuracyLine.rmse);
    expect(V.heldOut.spearman).toBeGreaterThan(V.baselineAccuracyLine.spearman);
    const b = Object.values(V.heldOut.bands).map(x => x.meanPred);
    expect(b).toHaveLength(4);
    for (let i = 1; i < b.length; i++) expect(b[i]).toBeGreaterThan(b[i - 1]);
  });

  it('better move quality in the same positions reads as stronger (monotonic sanity)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const base = rawPlayedLike(feats(30, 1, seed));
      expect(rawPlayedLike(feats(30, 0.3, seed))).toBeGreaterThan(base);
      expect(rawPlayedLike(feats(30, 3, seed))).toBeLessThan(base);
    }
    // a perfect game is near the top of the range, a game of blunders near the bottom
    expect(rawPlayedLike(feats(30, 0, 9))).toBeGreaterThan(rawPlayedLike(feats(30, 6, 9)) + 1000);
  });

  it('uncertainty grows as the number of informative moves shrinks', () => {
    for (const r of [300, 1200, 2000, 2800]) {
      expect(playedLikeSd(8, r)).toBeGreaterThan(playedLikeSd(15, r));
      expect(playedLikeSd(15, r)).toBeGreaterThan(playedLikeSd(40, r));
    }
    if (!PLAYED_LIKE_VALIDATED) return;
    // the same move quality, observed over fewer vs more informative moves
    const f = feats(40, 1);
    const short = estimateFromFeatures({ ...f, n: MODEL.minMoves }), long = estimateFromFeatures({ ...f, n: 60 });
    if (short.status !== 'ok' || long.status !== 'ok') throw new Error('expected numbers');
    expect(short.high - short.low).toBeGreaterThan(long.high - long.low);
    expect(long.low).toBeLessThanOrEqual(long.rating);
    expect(long.high).toBeGreaterThanOrEqual(long.rating);
  });

  it('"insufficient information" below the threshold, never a number', () => {
    const r = estimateFromFeatures(feats(MODEL.minMoves - 1, 1));
    expect(r.status).toBe(PLAYED_LIKE_VALIDATED ? 'insufficient' : 'uncalibrated');
    // forced moves, book plies and already-lost positions are not informative
    const g = synthGame(30, 1).map((p, i) => ({ ...p, forced: (i % 3 === 0 ? 1 : 0) as 0 | 1, ub: i % 3 === 1 ? 0.01 : p.ub }));
    expect(sideFeatures(g, 'white').n).toBe(g.filter(p => p.forced === 0 && p.ub > 0.03).length);
    expect(isInformative({ ...g[2], ply: 3 }, 0)).toBe(false);
    expect(sideFeatures(g, 'black').n).toBe(0);
  });

  it('is deterministic', () => {
    expect(estimateFromFeatures(feats(25, 1, 3))).toEqual(estimateFromFeatures(feats(25, 1, 3)));
    expect(playedLikeFromPlies(synthGame(25, 1, 3), 'white')).toEqual(playedLikeFromPlies(synthGame(25, 1, 3).map(p => ({ ...p })), 'white'));
  });

  it('reports: pending until complete; other settings are labelled; persisted record equals the on-read value', () => {
    expect(playedLike(null, 'white').status).toBe('pending');
    const plies = [...synthGame(25, 1, 3, 0), ...synthGame(25, 1, 4, 1)];
    const base = {
      status: 'complete', settings: { id: MODEL.analysis.settings }, engine: { buildId: MODEL.analysis.engine }, methodology: { gradingId: MODEL.analysis.grading },
      completedAt: '2026-11-04T00:00:00Z', summary: {},
    };
    // lite plies stand in for full plies here (playedLikeFromPlies accepts both)
    const rep = { ...base, plies } as unknown as AnalysisReport;
    expect(playedLike({ ...rep, status: 'partial' } as AnalysisReport, 'white').status).toBe('pending');
    expect(playedLike({ ...rep, settings: { id: 'quick-d5' } } as AnalysisReport, 'white').status).toBe('other-settings');
    const rec = playedLikeRecord(rep);
    expect(rec.white).toEqual(playedLike(rep, 'white'));
    expect(playedLike({ ...rep, playedLike: rec } as AnalysisReport, 'black')).toEqual(rec.black);
    const quick = { ...rep, settings: { id: 'quick-d5' }, completedAt: '2026-11-05T00:00:00Z' } as AnalysisReport;
    expect(reportForPlayedLike([quick, rep])).toBe(rep);
    expect(reportForPlayedLike([quick])).toBe(quick);
  });
});
