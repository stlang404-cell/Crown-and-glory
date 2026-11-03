/**
 * The canonical chess-intelligence foundation (crown-intel-1).
 *
 * One engine configuration — crown-search-2 + crown-eval-4 — is used by every active system: rated and casual
 * play (all levels and Sovereign Max), federation and spectator games, the move assistant, threat checks,
 * post-game analysis and grading, puzzle verification, the Academy and the Lab. Systems differ only in their
 * budget (depth / nodes / time). Reports produced earlier by crown-search-1 + crown-eval-3 keep their own
 * fingerprints and are never re-labelled.
 */
import { PLAY_FEATURES, PLAY_SEARCH_ID, type SearchFeatures } from './search';
import { PLAY_WEIGHTS, PLAY_EVAL_ID, type EvalWeights } from './evaluate';
import { RULES_VERSION, VARIANT_ID } from '../rules/types';

export const INTEL_ID = 'crown-intel-1';
export const CANON_SEARCH_ID = PLAY_SEARCH_ID;
export const CANON_EVAL_ID = PLAY_EVAL_ID;
export const CANON_BUILD = `${CANON_SEARCH_ID}+${CANON_EVAL_ID}`;
/** The TypeScript engine is the only shipped backend (Fairy-Stockfish stays a development reference). */
export const CANON_BACKEND = 'crown-ts';
export const RULES_FINGERPRINT = `${VARIANT_ID}@${RULES_VERSION}`;
/** Options passed to every Searcher call made on behalf of an active intelligence system. */
export const CANON_OPTS: { features: SearchFeatures; weights: EvalWeights } = { features: PLAY_FEATURES, weights: PLAY_WEIGHTS };
/** Short, stable fingerprint of the enabled search features (part of every provenance record). */
export const CANON_FEATURES_KEY = Object.entries(PLAY_FEATURES).filter(([, v]) => v).map(([k]) => k).sort().join(',');

export type EnginePurpose = 'play' | 'max' | 'federation' | 'spectator' | 'assist' | 'analysis' | 'puzzle' | 'sparring';

/** Recorded with every engine request/result (crown-provenance-1). */
export interface EngineProvenance {
  id: 'crown-provenance-1';
  rules: string;
  backend: string;
  build: string;
  intel: string;
  features: string;
  purpose: EnginePurpose;
  budget: { depth?: number; nodes?: number; timeMs?: number; ttBits?: number };
  generation: number;
  depth: number;
  nodes: number;
  elapsedMs: number;
  /** Score in centipawns or mate plies, from the side to move's point of view. */
  score?: { kind: 'cp' | 'mate'; value: number; pov: 'white' | 'black' };
  pv?: string[];
  stopReason?: string;
  analysisIds?: { gradingId: string; accuracyId: string };
  events?: string[];
}

export function provenance(p: Omit<EngineProvenance, 'id' | 'rules' | 'backend' | 'build' | 'intel' | 'features'>): EngineProvenance {
  return { id: 'crown-provenance-1', rules: RULES_FINGERPRINT, backend: CANON_BACKEND, build: CANON_BUILD, intel: INTEL_ID, features: CANON_FEATURES_KEY, ...p };
}
