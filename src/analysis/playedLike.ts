/**
 * "Played Like" Performance Elo (crown-played-like-2): the playing strength one side showed in ONE game, on the Crown
 * rating scale, from move-by-move analysis features only (src/analysis/playedLikeFeatures.ts). It never uses the
 * result, the clock, either career rating or the opponent, never changes a Glicko-2 rating, and is not FIDE.
 *
 * Model (tools/playedlike/fit.py → played-like-model.json, docs/PLAYED_LIKE.md): ridge regression on standardised
 * features, then a monotone piecewise-linear calibration onto the rating scale, fitted on engine games with calibrated
 * ratings 71–3,038 and validated on held-out openings. Uncertainty: a scale that shrinks with n (informative moves) and
 * depends on the predicted level, with interval multipliers calibrated out of fold and checked by held-out coverage. Too few informative moves → "insufficient". Shown only if the stored held-out
 * validation passed its gate (beats the mean and accuracy-line baselines, bands distinguishable, coverage on target).
 */
import MODEL from './played-like-model.json';
import { sideFeatures, toLitePly, type LitePly, type SideFeatures } from './playedLikeFeatures';
import type { AnalysisReport, PlyAnalysis, Pov } from './types';

export const PLAYED_LIKE_ID: string = MODEL.id;

export type PlayedLike =
  /** rating ± half80 is the 80 % interval [low, high]; low95/high95 the 95 % interval; sd = half80 / 1.28 (a normal-
   *  equivalent spread for charts); all on the Crown scale */
  | { status: 'ok'; rating: number; low: number; high: number; low95: number; high95: number; half80: number; sd: number; moves: number; capped: boolean; modelId: string }
  | { status: 'insufficient'; moves: number; needed: number; modelId: string }
  | { status: 'pending'; modelId: string }
  /** the report comes from analysis settings / engine / grading the model is not calibrated for */
  | { status: 'other-settings'; settingsId: string; modelId: string }
  | { status: 'uncalibrated'; modelId: string };

/** What a completed report persists (additive field `playedLike` on AnalysisReport, versioned by modelId). */
export interface PlayedLikeRecord { modelId: string; white: PlayedLike; black: PlayedLike }

interface Gate { passed: boolean }
const VALIDATION = MODEL.validation as unknown as { gate: Gate; heldOut: Record<string, unknown> };
/** Numbers are shown only if the stored held-out validation passed its gate (see tools/playedlike/fit.py). */
export const PLAYED_LIKE_VALIDATED: boolean = VALIDATION.gate?.passed === true;

const MU = MODEL.mu as number[], SD = MODEL.sd as number[], BETA = MODEL.beta as number[];
const KNOTS = MODEL.calibration.knots as number[], VALUES = MODEL.calibration.values as number[];
const [LO, HI] = MODEL.calibratedRange as [number, number];
const FEATS = MODEL.features as (keyof SideFeatures)[];

function interp(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1;
  while (xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + t * (ys[i] - ys[i - 1]);
}

/** The model's raw rating for a feature row (no gates, no rounding); exported for tests and calibration tools. */
export function rawPlayedLike(f: Pick<SideFeatures, keyof SideFeatures>): number {
  let s = BETA[0];
  for (let i = 0; i < FEATS.length; i++) s += BETA[i + 1] * ((f[FEATS[i]] - MU[i]) / SD[i]);
  return Math.min(HI, Math.max(LO, interp(s, KNOTS, VALUES)));
}

const U = MODEL.uncertainty as { a: number; b: number; c: number; d: number; z80: number; z95: number };
/** Model uncertainty scale (rating points) for a side with n informative moves and predicted rating r: shrinks as n
 *  grows; depends on the level (held-out errors are larger for strong play). The 80 % / 95 % intervals are ± z80 / z95
 *  times this scale (multipliers calibrated on out-of-fold residuals). */
export function playedLikeSd(n: number, rating = 1500): number {
  const q = rating / 1000;
  return Math.exp(0.5 * (U.a + U.b * Math.log(Math.max(1, n)) + U.c * q + U.d * q * q));
}

const round10 = (x: number) => Math.round(x / 10) * 10;

/** Played Like from a side's features (gates applied). */
export function estimateFromFeatures(f: SideFeatures): PlayedLike {
  if (!PLAYED_LIKE_VALIDATED) return { status: 'uncalibrated', modelId: PLAYED_LIKE_ID };
  if (f.n < MODEL.minMoves) return { status: 'insufficient', moves: f.n, needed: MODEL.minMoves, modelId: PLAYED_LIKE_ID };
  const r = rawPlayedLike(f);
  const sd = playedLikeSd(f.n, r);
  const h80 = U.z80 * sd, h95 = U.z95 * sd;
  const clip = (x: number) => Math.max(0, Math.min(HI, x));
  return {
    status: 'ok', rating: round10(r), low: round10(clip(r - h80)), high: round10(clip(r + h80)), low95: round10(clip(r - h95)), high95: round10(clip(r + h95)),
    half80: round10(h80), sd: Math.round(h80 / 1.2816), moves: f.n, capped: r + h80 > HI, modelId: PLAYED_LIKE_ID,
  };
}

/** Is a report from the analysis setup the model was calibrated on? */
export function reportMatchesModel(r: Pick<AnalysisReport, 'settings' | 'engine' | 'methodology'>): boolean {
  return r.settings.id === MODEL.analysis.settings && r.engine.buildId === MODEL.analysis.engine && r.methodology.gradingId === MODEL.analysis.grading;
}

/** Played Like for one side, computed from a report's plies (lite or full). */
export function playedLikeFromPlies(plies: (PlyAnalysis | LitePly)[], pov: Pov): PlayedLike {
  const lite = plies.map(p => ('c' in p ? p : toLitePly(p)));
  return estimateFromFeatures(sideFeatures(lite, pov));
}

/** The record a completed report persists. */
export function playedLikeRecord(report: AnalysisReport): PlayedLikeRecord {
  return { modelId: PLAYED_LIKE_ID, white: compute(report, 'white'), black: compute(report, 'black') };
}

function compute(report: AnalysisReport, pov: Pov): PlayedLike {
  if (report.status !== 'complete') return { status: 'pending', modelId: PLAYED_LIKE_ID };
  if (!reportMatchesModel(report)) return { status: 'other-settings', settingsId: report.settings.id, modelId: PLAYED_LIKE_ID };
  return playedLikeFromPlies(report.plies, pov);
}

/**
 * Played Like for one side of a report: the persisted value when it was computed by the current model, otherwise
 * computed now from the report's stored plies (older reports, or reports saved before this model existed) — the same
 * function the queue persists, so both paths agree. 'pending' unless the report is complete.
 */
export function playedLike(report: AnalysisReport | null | undefined, pov: Pov): PlayedLike {
  if (!report || report.status !== 'complete') return { status: 'pending', modelId: PLAYED_LIKE_ID };
  const stored = report.playedLike;
  if (stored && stored.modelId === PLAYED_LIKE_ID) return stored[pov];
  return compute(report, pov);
}

/** Pick the report Played Like should use among a game's reports: newest complete report from the calibrated setup,
 *  else the newest complete report (which yields 'other-settings'), else null. */
export function reportForPlayedLike(reports: AnalysisReport[]): AnalysisReport | null {
  const done = reports.filter(r => r.status === 'complete');
  const byTime = (a: AnalysisReport, b: AnalysisReport) => (a.completedAt < b.completedAt ? 1 : -1);
  return [...done.filter(reportMatchesModel)].sort(byTime)[0] ?? [...done].sort(byTime)[0] ?? null;
}

export const PLAYED_LIKE_INFO = {
  calibratedRange: MODEL.calibratedRange as [number, number],
  minMoves: MODEL.minMoves as number,
  analysis: MODEL.analysis,
  validation: MODEL.validation,
  status: MODEL.status as string,
};
