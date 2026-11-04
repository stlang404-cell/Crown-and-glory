/**
 * Played Like features (crown-played-like-2): per-side move-quality features computed ONLY from a stored analysis
 * report's per-ply data. The calibration tools (tools/playedlike/*) and the app run this same code, so the model sees
 * identical inputs in fitting and in production. Never uses the result, the clock, the opponent or any rating.
 *
 * Designed for crown-la6-v1 (6×6, short games, sharp tactics): a move counts as "informative" when it is not forced,
 * comes after the first BOOK_PLIES plies (book-like in practice), has a measured loss, and the position was not
 * already hopeless for the mover (best expected score ≤ LOST_U: nothing left to lose). Difficulty comes from the
 * analysis's own candidate set: how many candidates are within GOOD_MARGIN of the best, and whether the best move
 * stands out (an "only move", gap ≥ ONLY_GAP to the next candidate).
 */
import type { PlyAnalysis, Pov } from './types';
import { GRADES } from './types';

/** The subset of a PlyAnalysis Played Like needs (compact; also the calibration corpus's storage format). */
export interface LitePly {
  ply: number;
  /** 0 = white, 1 = black */
  c: 0 | 1;
  forced: 0 | 1;
  legal: number;
  /** 0 opening, 1 middlegame, 2 endgame */
  ph: 0 | 1 | 2;
  loss: number | null;
  lossPrev: number | null;
  /** index into GRADES, -1 = none */
  g: number;
  /** expected scores (mover's view) of the best move, the played move and the candidate set (descending) */
  ub: number;
  up: number;
  cu: number[];
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const PHASES = ['opening', 'middlegame', 'endgame'] as const;

export function toLitePly(p: PlyAnalysis): LitePly {
  return {
    ply: p.ply, c: p.color === 'white' ? 0 : 1, forced: p.forced ? 1 : 0, legal: p.legalCount,
    ph: Math.max(0, PHASES.indexOf(p.phase)) as 0 | 1 | 2,
    loss: p.loss === null ? null : r4(p.loss), lossPrev: p.lossPrev === null ? null : r4(p.lossPrev),
    g: p.grade ? GRADES.indexOf(p.grade) : -1,
    ub: r4(p.best.u), up: r4(p.played.u),
    cu: p.candidates.map(c => r4(c.u)).sort((a, b) => b - a),
  };
}

export const FEATURE_CONSTANTS = { BOOK_PLIES: 4, LOST_U: 0.03, GOOD_MARGIN: 0.05, ONLY_GAP: 0.1, EPS: 0.01 } as const;
const { BOOK_PLIES, LOST_U, GOOD_MARGIN, ONLY_GAP, EPS } = FEATURE_CONSTANTS;

/** Is this ply one of the side's informative moves? */
export function isInformative(p: LitePly, side: 0 | 1): boolean {
  return p.c === side && !p.forced && p.loss !== null && p.ply > BOOK_PLIES && p.ub > LOST_U;
}

export interface SideFeatures {
  /** informative moves */
  n: number;
  /** ln(mean loss + EPS) */
  lnMean: number;
  /** ln(mean loss after dropping the largest 10 % + EPS) */
  lnTrim: number;
  /** share of moves losing > 0.25 (blunder bin) */
  blunder: number;
  /** share losing > 0.12 (mistake or worse) */
  mistake: number;
  /** share losing ≤ 0.02 (best/excellent) */
  precise: number;
  /** ln(mean loss + EPS) on "hard" moves (at most one candidate within GOOD_MARGIN of the best), smoothed */
  lnHard: number;
  /** ln(mean loss + EPS) on moves with ≥ 2 good candidates ("easy"), smoothed */
  lnEasy: number;
  /** share of only-move positions (best ≥ ONLY_GAP above the next candidate) solved with loss ≤ 0.05, smoothed */
  onlyFound: number;
  /** mean ln(legal moves) of informative positions (position complexity) */
  lnLegal: number;
  /** mean |swing| of the best expected score between the side's consecutive informative moves (volatility) */
  swing: number;
  /** share of informative moves in the endgame phase */
  endShare: number;
}

export const FEATURE_NAMES: (keyof SideFeatures)[] = ['n', 'lnMean', 'lnTrim', 'blunder', 'mistake', 'precise', 'lnHard', 'lnEasy', 'onlyFound', 'lnLegal', 'swing', 'endShare'];

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/** Features for one side (pov) from the plies of a report (lite or full). */
export function sideFeatures(plies: LitePly[], pov: Pov): SideFeatures {
  const side: 0 | 1 = pov === 'white' ? 0 : 1;
  const mine = plies.filter(p => isInformative(p, side)).sort((a, b) => a.ply - b.ply);
  const losses = mine.map(p => p.loss as number);
  const n = losses.length;
  const m = mean(losses);
  const sorted = [...losses].sort((a, b) => a - b);
  const trim = sorted.slice(0, Math.max(1, Math.ceil(n * 0.9)));
  const good = (p: LitePly) => p.cu.filter(u => p.ub - u <= GOOD_MARGIN).length;
  const hard = mine.filter(p => good(p) <= 1).map(p => p.loss as number);
  const easy = mine.filter(p => good(p) >= 2).map(p => p.loss as number);
  // smoothing: a group's mean is pulled toward the side's overall mean with the weight of K pseudo-moves
  const K = 3;
  const smooth = (a: number[]) => (a.reduce((s, x) => s + x, 0) + K * m) / (a.length + K);
  const only = mine.filter(p => p.cu.length >= 2 && p.cu[0] - p.cu[1] >= ONLY_GAP);
  const found = only.filter(p => (p.loss as number) <= 0.05).length;
  const swings: number[] = [];
  for (let i = 1; i < mine.length; i++) swings.push(Math.abs(mine[i].ub - mine[i - 1].ub));
  return {
    n,
    lnMean: Math.log(m + EPS),
    lnTrim: Math.log(mean(trim) + EPS),
    blunder: n ? losses.filter(l => l > 0.25).length / n : 0,
    mistake: n ? losses.filter(l => l > 0.12).length / n : 0,
    precise: n ? losses.filter(l => l <= 0.02).length / n : 0,
    lnHard: Math.log(smooth(hard) + EPS),
    lnEasy: Math.log(smooth(easy) + EPS),
    onlyFound: (found + 1) / (only.length + 2),
    lnLegal: mean(mine.map(p => Math.log(Math.max(1, p.legal)))),
    swing: mean(swings),
    endShare: n ? mine.filter(p => p.ph === 2).length / n : 0,
  };
}
