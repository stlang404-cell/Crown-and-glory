/**
 * M1 opponent roster: persistent fictional AI competitors bound to calibrated engine strength
 * profiles. Ratings come from src/engine/calibration.json (measured engine-vs-engine matches),
 * never from difficulty labels. Styles are NOT yet behaviourally differentiated (research
 * experiment D found no distinct choices); every opponent uses the standard evaluation and says so.
 *
 * The federation module (M3) will grow this into 2,048 identities with tiered simulation.
 */
import calibration from '../engine/calibration.json';
import { LEVELS_ID, getLevel, maxProfile, MAX_LEVEL, MAX_RATED_BUDGET_S } from '../engine/levels';
import { CANON_BUILD, RULES_FINGERPRINT, CANON_BACKEND, INTEL_ID } from '../engine/canonical';
import { PLAY_SEARCH_ID } from '../engine/search';
import { PLAY_EVAL_ID } from '../engine/evaluate';
import type { ParticipantSnapshot } from '../games/types';

export interface Opponent {
  id: string;
  name: string;
  title: string;
  club: string;
  level: number;
  portraitSeed: number;
  bio: string;
}

export interface LevelCalibration { level: number; rating: number; rd: number; games: number }
export const CALIBRATION_ID: string = (calibration as { id: string }).id;
const CAL = (calibration as { levels: LevelCalibration[] }).levels;

export const ROSTER: Opponent[] = [
  { id: 'opp-mira', name: 'Mira Vell', title: 'Novice', club: 'Lantern Square Club', level: 1, portraitSeed: 11, bio: 'Learning the six-square board one move at a time.' },
  { id: 'opp-tomas', name: 'Tomas Rook', title: 'Apprentice', club: 'Lantern Square Club', level: 2, portraitSeed: 23, bio: 'Plays quickly and likes open files.' },
  { id: 'opp-ines', name: 'Ines Calder', title: 'Club player', club: 'Harbor Gate Circle', level: 3, portraitSeed: 37, bio: 'Steady club regular; rarely leaves pieces hanging.' },
  { id: 'opp-oskar', name: 'Oskar Brandt', title: 'District player', club: 'Harbor Gate Circle', level: 4, portraitSeed: 41, bio: 'Calculates short forcing lines well.' },
  { id: 'opp-lena', name: 'Lena Ashgrove', title: 'Regional player', club: 'Observatory Hill', level: 5, portraitSeed: 59, bio: 'Full search on a modest budget.' },
  { id: 'opp-dario', name: 'Dario Quill', title: 'National player', club: 'Observatory Hill', level: 6, portraitSeed: 67, bio: 'Deep, patient searcher.' },
  { id: 'opp-sable', name: 'Sable Marchetti', title: 'Master', club: 'The Brass Meridian', level: 7, portraitSeed: 73, bio: 'Full search on 30,000 nodes per move.' },
  { id: 'opp-crown', name: 'The Crown Engine', title: 'Crown', club: 'Federation Reference', level: 8, portraitSeed: 97, bio: 'Full search limited only by the clock (up to 6 s per move).' },
  { id: 'opp-sovereign', name: 'The Sovereign', title: 'Sovereign Max', club: 'Federation Reference', level: MAX_LEVEL, portraitSeed: 131, bio: 'The strongest validated configuration: no handicap, a larger memory table and the thinking time you choose.' },
];

export function levelRating(level: number): LevelCalibration | null {
  return CAL.find(c => c.level === level) ?? null;
}

/** Snapshot of an opponent for a game record. Sovereign Max carries its exact profile (thinking budget) and the
 * engine configuration actually used, so the game's provenance is self-contained. */
export function opponentSnapshot(o: Opponent, maxBudgetS: number = MAX_RATED_BUDGET_S): ParticipantSnapshot {
  const isMax = o.level === MAX_LEVEL;
  const p = isMax ? maxProfile(maxBudgetS) : getLevel(o.level);
  // only the rated budget is calibrated; other Max budgets are casual and unrated
  const cal = isMax && p.maxTimeMs !== MAX_RATED_BUDGET_S * 1000 ? null : levelRating(o.level);
  return {
    kind: 'engine', id: o.id, name: o.name, rating: cal?.rating ?? null, rd: cal?.rd ?? null,
    engine: {
      profileId: p.id, level: o.level, levelsId: LEVELS_ID, searchId: PLAY_SEARCH_ID, evalId: PLAY_EVAL_ID, calibrationId: CALIBRATION_ID, style: 'standard (no distinct style yet)',
      ...(isMax ? { profile: p } : {}),
      config: { rules: RULES_FINGERPRINT, backend: CANON_BACKEND, build: CANON_BUILD, intel: INTEL_ID, ttBits: p.ttBits ?? 18, maxTimeMs: p.maxTimeMs, nodes: Number.isFinite(p.nodes) ? p.nodes : null, selection: p.selection ? 'bounded' : 'best' },
    },
  };
}

export const getOpponent = (id: string): Opponent | undefined => ROSTER.find(o => o.id === id);
