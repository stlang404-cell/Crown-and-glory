/**
 * Versioned move-grading and accuracy methodology (research doc 07, "v0-experimental").
 *
 * EXPERIMENTAL: s = 200 cp and k = 4 and the loss bins are research placeholders that have NOT
 * been calibrated on crown-la6-v1 outcomes. Every report carries these identifiers and the UI
 * labels accuracy and grades as experimental.
 */
import type { EngineScore, Grade, Phase, Pov } from './types';
import { logisticU, mapV1, mapV2 } from './outcomeMap';

/**
 * Versions: v0 used the research placeholder logistic s = 200 cp. v1 (M2) uses crown-outcome-map-v1, an
 * isotonic expected-score map validated on held-out opening families (docs/M2_ANALYSIS_CALIBRATION.md).
 * Grade bins and accuracy k are unchanged and remain experimental.
 */
export const GRADING_ID = 'crown-grade-v2-experimental';
export const ACCURACY_ID = 'crown-accuracy-v2';
/** Earlier methodologies, kept so historical reports display with their own map and are reproducible. */
export const LEGACY_IDS = {
  grading: 'crown-grade-v0-experimental', accuracy: 'crown-accuracy-v0-experimental',
  v1: { grading: 'crown-grade-v1-experimental', accuracy: 'crown-accuracy-v1', calibration: 'expected-score map crown-outcome-map-v1 (isotonic, held-out validated on engine games); grade bins and k=4 are uncalibrated placeholders' },
};
export const PHASE_ID = 'crown-phase-1';
export const CRITICAL_ID = 'crown-critical-1';
export const CALIBRATION = 'expected-score map crown-outcome-map-v2 (isotonic, refitted for the canonical engine crown-search-2+crown-eval-4, held-out validated by opening family); grade bins and k=4 unchanged and experimental';

export const S_CP = 200;
export const K_ACC = 4;
export const TOL = 1e-9;

/** Upper inclusive loss boundaries. */
export const LOSS_BINS: { grade: Grade; max: number }[] = [
  { grade: 'best', max: 0.002 },
  { grade: 'excellent', max: 0.02 },
  { grade: 'good', max: 0.05 },
  { grade: 'inaccuracy', max: 0.12 },
  { grade: 'mistake', max: 0.25 },
  { grade: 'blunder', max: 1 },
];
export const GREAT_GAP = 0.1;
/** v2: Great/Brilliant need a position that is not already lost after the move (expected score ≥ 0.25) and not
 * already trivially won before it (best alternative ≤ 0.97): an "only move" that still loses, or one of many
 * winning moves, earns no special credit. */
export const GREAT_MIN_U = 0.25;
export const GREAT_MAX_SECOND_U = 0.97;
export const CRITICAL_GAP = 0.1;

/** Bounded expected score of a typed score for the score's own POV, under a methodology's map. */
export function expectedU(s: EngineScore, accuracyId: string = ACCURACY_ID): number {
  if (s.kind === 'cp') return accuracyId === LEGACY_IDS.accuracy ? logisticU(s.value, S_CP) : accuracyId === LEGACY_IDS.v1.accuracy ? mapV1(s.value) : mapV2(s.value);
  if (s.kind === 'mate') return s.plies > 0 ? 1 : 0;
  return s.outcome === 'win' ? 1 : s.outcome === 'draw' ? 0.5 : 0;
}

export function flipScore(s: EngineScore): EngineScore {
  const pov: Pov = s.pov === 'white' ? 'black' : 'white';
  if (s.kind === 'cp') return { kind: 'cp', value: -s.value, pov };
  if (s.kind === 'mate') return { kind: 'mate', plies: -s.plies, pov, proven: false };
  return { kind: 'terminal', outcome: s.outcome === 'win' ? 'loss' : s.outcome === 'loss' ? 'win' : 'draw', pov };
}
export const toPov = (s: EngineScore, pov: Pov): EngineScore => (s.pov === pov ? s : flipScore(s));
void flipScore;

export function gradeForLoss(L: number): Grade {
  const x = Math.min(1, Math.max(0, L));
  for (const b of LOSS_BINS) if (x <= b.max + TOL) return b.grade;
  return 'blunder';
}

export const isMateLike = (s: EngineScore | null): boolean => !!s && s.kind === 'mate';

export interface GradeInput {
  legalCount: number;
  uBest: number; uPlayed: number; uSecond: number | null;
  uBestPrev: number | null; uPlayedPrev: number | null;
  playedIsBest: boolean; playedIsBestPrev: boolean;
  /** Mate scores involved and whether their sign agreed at both depths. */
  mateInvolved: boolean; mateStable: boolean;
  /** Verified sacrifice evidence for Brilliant (null = not a sacrifice or not verified). */
  sacrifice: { material: number; verified: boolean; recapture: boolean } | null;
  /** Second-best alternative at depth-1 (for gap stability). */
  uSecondPrev: number | null;
  /** Apply the v2 Great/Brilliant guards (GREAT_MIN_U, GREAT_MAX_SECOND_U). */
  v2?: boolean;
}

export interface GradeOutput {
  grade: Grade | null;
  loss: number | null;
  lossPrev: number | null;
  interval: [number, number] | null;
  provisional: boolean;
  uncertain: Grade[] | null;
  reasons: string[];
  inconsistency: boolean;
}

export function gradeMove(i: GradeInput): GradeOutput {
  const reasons: string[] = [];
  const raw = i.uBest - i.uPlayed;
  const inconsistency = raw < -TOL;
  const L = Math.min(1, Math.max(0, raw));
  if (inconsistency) reasons.push('Played move scored above the reported best (search inconsistency); loss clamped to 0.');
  if (i.legalCount === 1) {
    return { grade: 'best', loss: L, lossPrev: null, interval: null, provisional: false, uncertain: null, reasons: ['Only legal move (forced); excluded from accuracy and special credit.'], inconsistency };
  }
  if (i.mateInvolved && !i.mateStable) {
    return { grade: null, loss: null, lossPrev: null, interval: null, provisional: true, uncertain: null, reasons: ['Mate evidence unstable between search depths; no confident grade.'], inconsistency };
  }
  let lossPrev: number | null = null;
  let interval: [number, number] | null = null;
  let uncertain: Grade[] | null = null;
  let provisional = i.mateInvolved; // stable heuristic mate scores are still not proofs
  if (i.mateInvolved) reasons.push('Engine mate score (stable at two depths, not a proof).');
  if (i.uBestPrev !== null && i.uPlayedPrev !== null) {
    lossPrev = Math.min(1, Math.max(0, i.uBestPrev - i.uPlayedPrev));
    interval = [Math.min(L, lossPrev), Math.max(L, lossPrev)];
    const lo = gradeForLoss(interval[0]), hi = gradeForLoss(interval[1]);
    if (lo !== hi) {
      const set = new Set<Grade>();
      for (let k = 0; k < LOSS_BINS.length; k++) {
        const lower = k === 0 ? -Infinity : LOSS_BINS[k - 1].max; // bin k covers (lower, max]
        if (interval[1] > lower + TOL && interval[0] <= LOSS_BINS[k].max + TOL) set.add(LOSS_BINS[k].grade);
      }
      uncertain = [...set];
      provisional = true;
      reasons.push(`Loss varies between depths (${interval[0].toFixed(3)}–${interval[1].toFixed(3)}); label uncertain.`);
    }
  }
  let grade = gradeForLoss(L);
  const greatAllowed = !i.v2 || (i.uBest >= GREAT_MIN_U && (i.uSecond === null || i.uSecond <= GREAT_MAX_SECOND_U));
  if (grade === 'best' && !uncertain && !i.mateInvolved && greatAllowed) {
    const gap = i.uSecond !== null ? i.uBest - i.uSecond : 0;
    const gapPrev = i.uSecondPrev !== null && i.uBestPrev !== null ? i.uBestPrev - i.uSecondPrev : null;
    const stable = i.playedIsBest && i.playedIsBestPrev && gapPrev !== null && gapPrev >= GREAT_GAP - TOL;
    if (gap >= GREAT_GAP - TOL && stable) {
      grade = 'great';
      reasons.push(`Only strong move: next alternative is ${(gap * 100).toFixed(0)} expected-score points worse, stable at two depths.`);
      if (i.sacrifice && i.sacrifice.verified && !i.sacrifice.recapture && i.sacrifice.material >= 200) {
        grade = 'brilliant';
        reasons.push(`Sound sacrifice of ~${i.sacrifice.material} cp confirmed by a deeper verification search (heuristic, not a proof).`);
      }
    }
  }
  return { grade, loss: L, lossPrev, interval, provisional, uncertain, reasons, inconsistency };
}

/** Accuracy = 100 * exp(-k * mean L) over eligible decisions; null for an empty denominator. */
export function accuracyFromLosses(losses: number[]): number | null {
  if (!losses.length) return null;
  const mean = losses.reduce((a, b) => a + b, 0) / losses.length;
  return 100 * Math.exp(-K_ACC * mean);
}

/**
 * Phase state machine (crown-phase-1). Phase of move n is determined from its pre-move state.
 * Opening → middlegame when fullmove >= 13 or any position has a side without a queen.
 * → endgame at the first position with both queens absent and <= 4 non-pawn non-king pieces.
 * Transitions are monotone; promotions never reverse them.
 */
export function nextPhase(current: Phase, pre: { fullmove: number; whiteQueens: number; blackQueens: number; minorMajor: number }): Phase {
  let p = current;
  if (p === 'opening' && (pre.fullmove >= 13 || pre.whiteQueens === 0 || pre.blackQueens === 0)) p = 'middlegame';
  if (p !== 'endgame' && pre.whiteQueens === 0 && pre.blackQueens === 0 && pre.minorMajor <= 4) p = 'endgame';
  return p;
}
