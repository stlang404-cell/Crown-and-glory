/**
 * Engine strength profiles (profile set crown-levels-1).
 *
 * Strength is controlled by node budgets (hardware independent) with a wall-clock safety cap.
 * Lower levels choose among the moves whose exact score at their search depth lies within a
 * bounded margin of their best move (softmax with a temperature), so weaker play stays within a
 * documented quality range: no level ever picks a move worse than `marginCp` below its own best,
 * no level receives hidden information, extra material or illegal moves, and no level "throws"
 * games mid-match. Strength ratings for these profiles come from measured calibration matches
 * (src/engine/calibration.json), not from the labels.
 */
import { Position } from '../rules/position';
import { Move } from '../rules/types';
import { Searcher, SearchResult, isMateScore, PLAY_FEATURES, PLAY_SEARCH_ID } from './search';
import { PLAY_WEIGHTS, PLAY_EVAL_ID } from './evaluate';
import type { EvalWeights } from './evaluate';
import { repertoireChoice, styledWeights, usesRepertoire, usesStyleEval } from './styles';
import type { StyleId } from '../federation/model';
import { mulberry32 } from '../rules/tables';

/**
 * crown-levels-4 = crown-levels-3 (L1–L8, unchanged and still calibrated) + L9 Sovereign Max: the canonical
 * engine with no selection, no handicap, a 4× larger transposition table and a player-chosen thinking budget.
 * crown-levels-5 (v0.7): L8 and L9 (clock-limited) use the partialRoot search option; L1–L7 node for node unchanged.
 * crown-levels-6 (v0.8): L8 and L9 also use fullBudget (start iterations until 62.5 % of the budget): +23 [6, 41] Elo
 *   over 640 games at 200 ms vs crown-levels-5 (tools/bench/results/v8-final-summary.txt); L1–L7 unchanged.
 */
export const LEVELS_ID = 'crown-levels-6';
/** Thinking budgets offered for Sovereign Max (seconds per move, upper bound; the clock can lower it). */
export const MAX_BUDGETS_S = [1, 5, 10, 15, 30, 60] as const;
/** Names shown for the budgets (targets, not strength guarantees: see docs/V8_SOVEREIGN_STANDARD.md). */
export const MAX_BUDGET_NAMES: Record<number, string> = { 1: 'Fast', 5: 'Strong', 10: 'Rated', 15: 'Deep', 30: 'Unbound', 60: 'Unbound+' };
/** Rated games against Sovereign Max always use this budget, so its measured strength stays meaningful. */
export const MAX_RATED_BUDGET_S = 10;
export const MAX_LEVEL = 9;
/** Engine used for all play through chooseMove (levels, federation games, sparring). */
export const PLAY_ENGINE_ID = `${PLAY_SEARCH_ID}+${PLAY_EVAL_ID}`;

export interface StrengthProfile {
  level: number;
  id: string;
  name: string;
  /** Maximum nominal depth. */
  depth: number;
  /** Node budget per move (Infinity = time-limited only). */
  nodes: number;
  /** Wall-clock cap per move, ms. */
  maxTimeMs: number;
  /** Bounded selection among near-best moves (null = always play the best move found). */
  selection: { marginCp: number; temperatureCp: number } | null;
  description: string;
  /** Transposition-table size (log2 entries; default 18 ≈ 2.9 MB, 20 ≈ 11.5 MB). */
  ttBits?: number;
}

export const LEVELS: StrengthProfile[] = [
  { level: 1, id: 'L1', name: 'Novice', depth: 1, nodes: 2_000, maxTimeMs: 400, selection: { marginCp: 320, temperatureCp: 200 }, description: '1-ply search; picks among moves within 3.2 pawns of its best, often loosely.' },
  { level: 2, id: 'L2', name: 'Apprentice', depth: 1, nodes: 2_000, maxTimeMs: 400, selection: { marginCp: 200, temperatureCp: 110 }, description: '1-ply search with quiescence; picks among moves within 2 pawns of its best.' },
  { level: 3, id: 'L3', name: 'Club', depth: 2, nodes: 6_000, maxTimeMs: 500, selection: { marginCp: 130, temperatureCp: 70 }, description: '2-ply search; picks among moves within 1.3 pawns of its best.' },
  { level: 4, id: 'L4', name: 'District', depth: 2, nodes: 8_000, maxTimeMs: 600, selection: { marginCp: 70, temperatureCp: 35 }, description: '2-ply search; picks among moves within 0.7 pawns of its best.' },
  { level: 5, id: 'L5', name: 'Regional', depth: 64, nodes: 600, maxTimeMs: 400, selection: null, description: 'Full search, 600 nodes per move.' },
  { level: 6, id: 'L6', name: 'National', depth: 64, nodes: 4_000, maxTimeMs: 800, selection: null, description: 'Full search, 4k nodes per move.' },
  { level: 7, id: 'L7', name: 'Master', depth: 64, nodes: 30_000, maxTimeMs: 2_000, selection: null, description: 'Full search, 30k nodes per move.' },
  { level: 8, id: 'L8', name: 'Crown', depth: 64, nodes: Infinity, maxTimeMs: 6_000, selection: null, description: 'Full search limited only by the clock (up to 6 s per move).' },
  { level: 9, id: 'L9', name: 'Sovereign Unbound', depth: 64, nodes: Infinity, maxTimeMs: MAX_RATED_BUDGET_S * 1000, selection: null, ttBits: 20, description: 'Strongest configuration: the canonical engine with no handicap, an 11.5 MB transposition table and your chosen thinking budget (rated games: 10 s per move).' },
];

/** Sovereign Max with a chosen thinking budget (casual games may pick any offered budget). */
export function maxProfile(budgetS: number = MAX_RATED_BUDGET_S): StrengthProfile {
  const b = (MAX_BUDGETS_S as readonly number[]).includes(budgetS) ? budgetS : MAX_RATED_BUDGET_S;
  return { ...LEVELS[MAX_LEVEL - 1], maxTimeMs: b * 1000, id: b === MAX_RATED_BUDGET_S ? 'L9' : `L9-${b}s` };
}

export const getLevel = (level: number): StrengthProfile => LEVELS[Math.max(1, Math.min(LEVELS.length, level)) - 1];

export interface ClockContext {
  remainingMs: number;
  incrementMs: number;
}

/** Time allocation for one move from the engine's own clock. */
export function allocateTime(profile: StrengthProfile, clock?: ClockContext): number {
  if (!clock) return profile.maxTimeMs;
  const { remainingMs, incrementMs } = clock;
  const reserve = Math.min(remainingMs * 0.1, 1500);
  let alloc = (remainingMs - reserve) / 22 + incrementMs * 0.75;
  alloc = Math.min(alloc, remainingMs * 0.35);
  return Math.max(30, Math.min(profile.maxTimeMs, alloc));
}

export interface ChooseResult {
  move: Move;
  search: SearchResult;
  /** Exact scores of candidate moves when bounded selection was used. */
  candidates?: { move: Move; score: number }[];
  selected: 'best' | 'bounded-sample' | 'repertoire';
}

/**
 * Choose a move for a strength profile. `seed` makes the bounded sampling reproducible
 * (the game stores the seed and ply so the choice can be audited).
 */
export function chooseMove(searcher: Searcher, pos: Position, profile: StrengthProfile, seed: number, clock?: ClockContext, evalWeights: EvalWeights = PLAY_WEIGHTS, style: StyleId = 'universal', styleEvalOverride?: boolean): ChooseResult {
  const timeMs = allocateTime(profile, clock);
  // full-game style (validated styles only): asymmetric evaluation + contempt
  // (styleEvalOverride is for the validation harness only: it measures a style before it is validated)
  const styled = (styleEvalOverride ?? usesStyleEval(style)) ? styledWeights(style, evalWeights) : null;
  if (styled) evalWeights = styled.weights;
  const contempt = styled?.contempt ?? 0;
  const search = searcher.search(pos, {
    limits: { depth: profile.depth, nodes: profile.nodes === Infinity ? undefined : profile.nodes, timeMs },
    stopOnSingleMove: true,
    weights: evalWeights,
    // crown-levels-5: clock-limited profiles (L8, L9) keep a fully searched better root move from an unfinished
    // iteration (partialRoot, +34 Elo [4, 66] at 100 ms/move, 192 games); node-limited levels are unchanged
    features: profile.nodes === Infinity ? { ...PLAY_FEATURES, partialRoot: true, fullBudget: true } : PLAY_FEATURES,
    contempt,
  });
  // styled opening repertoire (src/engine/styles.ts): only book moves within 30 cp of the best at depth 7
  if (usesRepertoire(style)) {
    const book = repertoireChoice(style, pos, seed);
    if (book !== null) return { move: book, search, selected: book === search.bestMove ? 'best' : 'repertoire' };
  }
  if (!profile.selection || isMateScore(search.score)) return { move: search.bestMove, search, selected: 'best' };
  const legal = pos.legalMoves();
  if (legal.length < 2) return { move: search.bestMove, search, selected: 'best' };
  const depth = Math.max(1, Math.min(profile.depth, search.depth || 1));
  const scored = searcher.scoreRootMoves(pos, legal, depth, { nodeLimitPerMove: Math.max(200, Math.floor(profile.nodes / legal.length)), weights: evalWeights, features: PLAY_FEATURES, contempt })
    .filter(s => Number.isFinite(s.score));
  if (!scored.length) return { move: search.bestMove, search, selected: 'best' };
  const bestScore = Math.max(...scored.map(s => s.score));
  if (isMateScore(bestScore)) {
    const mv = scored.find(s => s.score === bestScore)!.move;
    return { move: mv, search, candidates: scored, selected: 'best' };
  }
  const { marginCp, temperatureCp } = profile.selection;
  const pool = scored.filter(s => s.score >= bestScore - marginCp && !isMateScore(-s.score));
  const rng = mulberry32(seed);
  const weights = pool.map(s => Math.exp((s.score - bestScore) / temperatureCp));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = (rng() / 4294967296) * total;
  let chosen = pool[0].move;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) { chosen = pool[i].move; break; }
  }
  return { move: chosen, search, candidates: scored, selected: 'bounded-sample' };
}
