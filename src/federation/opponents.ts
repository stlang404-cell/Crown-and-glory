/**
 * Play-screen opponents: the M1 roster (src/federation/roster.ts, L1–L9) plus, from v0.10, genuine beginners below
 * 800 who play the calibrated beginner levels L0a–L0d (crown-error-1; ratings measured by engine-vs-engine matches
 * chained down from L1 = 800, src/engine/calibration-beginners.json). Names are original and fictional.
 */
import { ROSTER, Opponent, getOpponent, opponentSnapshot, levelRating } from './roster';
import { ERROR_MODEL_ID, LEVELS_ID, StrengthProfile, getBeginnerLevel, getLevel } from '../engine/levels';
import { CANON_BUILD, RULES_FINGERPRINT, CANON_BACKEND, INTEL_ID } from '../engine/canonical';
import { PLAY_SEARCH_ID } from '../engine/search';
import { PLAY_EVAL_ID } from '../engine/evaluate';
import { BEGINNER_CALIBRATION_ID, beginnerRating } from './profiles';
import type { ParticipantSnapshot } from '../games/types';

export interface PlayOpponent extends Opponent {
  /** Beginner opponents: the beginner level they play (L0a…L0d). */
  beginner?: string;
}

export const BEGINNER_OPPONENTS: PlayOpponent[] = [
  { id: 'opp-pip', name: 'Pip Hollins', title: 'Starter', club: 'Lantern Square Juniors', level: 0, beginner: 'L0a', portraitSeed: 5, bio: 'Knows the basics and looks one move ahead.' },
  { id: 'opp-wren', name: 'Wren Abernath', title: 'Beginner', club: 'Lantern Square Juniors', level: 0, beginner: 'L0b', portraitSeed: 17, bio: 'Loves capturing; not always careful about what comes back.' },
  { id: 'opp-tam', name: 'Tam Orrell', title: 'Newcomer', club: 'Harbor Gate Learners', level: 0, beginner: 'L0c', portraitSeed: 29, bio: 'Has just learned how the pieces move.' },
  { id: 'opp-bea', name: 'Bea Fallow', title: 'First Moves', club: 'Harbor Gate Learners', level: 0, beginner: 'L0d', portraitSeed: 3, bio: 'Playing their very first games.' },
];

/** Every Play opponent, weakest group first: beginners (under 800), then the calibrated ladder L1–L9. */
export const PLAY_OPPONENTS: PlayOpponent[] = [...[...BEGINNER_OPPONENTS].reverse(), ...ROSTER];

export const findOpponent = (id: string): PlayOpponent | undefined => BEGINNER_OPPONENTS.find(o => o.id === id) ?? getOpponent(id);
export const isBeginner = (o: PlayOpponent): boolean => !!o.beginner;

/** The engine profile an opponent plays. */
export function opponentProfile(o: PlayOpponent): StrengthProfile {
  return o.beginner ? getBeginnerLevel(o.beginner)! : getLevel(o.level);
}
/** Short level label (chip): "L0b Beginner", "L3 Club". */
export function opponentLevelLabel(o: PlayOpponent): string {
  const p = opponentProfile(o);
  return `${p.id} ${p.name}`;
}
/** Measured rating of an opponent's level (null if not calibrated). */
export function opponentRating(o: PlayOpponent): { rating: number; rd: number } | null {
  if (o.beginner) return beginnerRating(o.beginner);
  const c = levelRating(o.level);
  return c ? { rating: c.rating, rd: c.rd } : null;
}

/** Game-record snapshot. Beginners carry their exact profile, so the worker plays the error model. */
export function playOpponentSnapshot(o: PlayOpponent, maxBudgetS?: number): ParticipantSnapshot {
  if (!o.beginner) return opponentSnapshot(o, maxBudgetS);
  const p = opponentProfile(o);
  const cal = beginnerRating(o.beginner);
  return {
    kind: 'engine', id: o.id, name: o.name, rating: cal?.rating ?? null, rd: cal?.rd ?? null,
    engine: {
      profileId: p.id, level: 0, levelsId: `${LEVELS_ID}+${ERROR_MODEL_ID}`, searchId: PLAY_SEARCH_ID, evalId: PLAY_EVAL_ID, calibrationId: BEGINNER_CALIBRATION_ID, style: 'standard (beginner error model)',
      profile: p,
      config: { rules: RULES_FINGERPRINT, backend: CANON_BACKEND, build: CANON_BUILD, intel: INTEL_ID, ttBits: p.ttBits ?? 18, maxTimeMs: p.maxTimeMs, nodes: p.nodes, selection: 'bounded' },
    },
  };
}
