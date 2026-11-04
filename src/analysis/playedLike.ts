/**
 * "Played Like" (crown-played-like-1-experimental): an estimate of the playing strength shown in ONE game, from move
 * quality only (expected-score losses of the canonical analysis), on the Crown rating scale. It never uses the
 * result, the player's rating or the opponent's rating, never changes a Glicko-2 rating, and is not FIDE.
 *
 * Model: linear in ln(mean loss), share of moves losing ≥ 0.10 and share of near-perfect moves, fitted and validated
 * on engine games of measured strength (tools/perf/fit_played_like.py → played-like-model.json). Uncertainty:
 * held-out residual variance s0² + s1²/n. Too few informative moves → "insufficient"; estimates outside the calibrated
 * range are reported as "below/above" that range, not as a number.
 */
import MODEL from './played-like-model.json';
import type { AnalysisReport, PlyAnalysis, Pov } from './types';

export const PLAYED_LIKE_ID = MODEL.id;

export type PlayedLike =
  | { status: 'ok'; rating: number; low: number; high: number; moves: number; modelId: string }
  | { status: 'below-range' | 'above-range'; bound: number; moves: number; modelId: string }
  | { status: 'insufficient'; moves: number; needed: number; modelId: string }
  | { status: 'pending'; modelId: string }
  | { status: 'uncalibrated'; modelId: string };

/** Eligible losses: the side's analysed, non-forced moves after the book-like opening plies. */
export function eligibleLosses(plies: PlyAnalysis[], pov: Pov): number[] {
  return plies.filter(p => p.color === pov && !p.forced && p.loss !== null && p.ply > MODEL.bookPlies).map(p => p.loss as number);
}

/** The model is shown only if its held-out validation passed: estimates rise with measured strength level by level
 *  and correlate usefully (r ≥ 0.6) with it on games not used for fitting. */
export const PLAYED_LIKE_VALIDATED = MODEL.validation.monotoneByLevel === true && (MODEL.validation.heldOut.r ?? 0) >= 0.6;

/** The model's raw value for a list of losses (no gates, no rounding); exported for tests and calibration tools. */
export function rawPlayedLike(losses: number[]): number {
  const n = losses.length;
  const mean = losses.reduce((a, b) => a + b, 0) / n;
  const big = losses.filter(l => l >= 0.10).length / n;
  const exact = losses.filter(l => l <= 0.005).length / n;
  const [b0, b1, b2, b3] = MODEL.beta;
  return b0 + b1 * Math.log(mean + MODEL.eps) + b2 * big + b3 * exact;
}

export function estimateFromLosses(losses: number[]): PlayedLike {
  if (!PLAYED_LIKE_VALIDATED) return { status: 'uncalibrated', modelId: MODEL.id };
  const n = losses.length;
  if (n < MODEL.minMoves) return { status: 'insufficient', moves: n, needed: MODEL.minMoves, modelId: MODEL.id };
  const r = rawPlayedLike(losses);
  const sd = Math.sqrt(MODEL.sd.s0sq + MODEL.sd.s1sq / n);
  const [lo, hi] = MODEL.calibratedRange;
  if (r < lo - 50) return { status: 'below-range', bound: lo, moves: n, modelId: MODEL.id };
  if (r > hi + 50) return { status: 'above-range', bound: hi, moves: n, modelId: MODEL.id };
  const round = (x: number) => Math.round(x / 10) * 10;
  return { status: 'ok', rating: round(r), low: round(r - 1.645 * sd), high: round(r + 1.645 * sd), moves: n, modelId: MODEL.id };
}

/** Played Like for one side of a report; 'pending' unless the report is complete and from the model's analysis setup. */
export function playedLike(report: AnalysisReport | null | undefined, pov: Pov): PlayedLike {
  if (!report || report.status !== 'complete') return { status: 'pending', modelId: MODEL.id };
  return estimateFromLosses(eligibleLosses(report.plies, pov));
}

export const PLAYED_LIKE_INFO = {
  calibratedRange: MODEL.calibratedRange as [number, number],
  validation: MODEL.validation,
  status: MODEL.status,
};
