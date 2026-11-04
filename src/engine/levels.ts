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
  /** v0.10 beginner levels below L1 (crown-error-1): a calibrated error model replaces search + bounded selection.
   *  Absent on L1–L9, whose behaviour is unchanged. */
  error?: ErrorModel;
}

/**
 * crown-error-1: the error model of the beginner levels (below L1 = 800). Each move:
 *  1. with probability `pRandom` the move is a uniformly random legal move (a real beginner's "no idea" move);
 *  2. otherwise every legal move is judged at a one-ply horizon. With probability `pBlind` the judgement is *blind*:
 *     the static evaluation right after the move, with no quiescence, so recaptures, hanging pieces and the
 *     opponent's threats are not seen (missed threats). Otherwise captures are followed to quiescence, as at L1;
 *  3. a move is sampled by softmax (`temperatureCp`) among moves within `marginCp` of the best judged move.
 * All draws come from mulberry32(seed): deterministic for a seed, always legal, and cheap (≤ a few thousand nodes).
 * The parameters are interpolated continuously by src/federation/profiles.ts between calibrated points.
 */
export interface ErrorModel { pRandom: number; pBlind: number; temperatureCp: number; marginCp: number }
export const ERROR_MODEL_ID = 'crown-error-1';

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

/**
 * v0.10 beginner levels below L1 (crown-error-1; ratings in src/engine/calibration-beginners.json, chained down from
 * L1 = 800 by engine-vs-engine matches). Listed strongest first. L1–L9 above are untouched.
 */
export const BEGINNER_LEVELS: StrengthProfile[] = [
  { level: 0, id: 'L0a', name: 'Starter', depth: 1, nodes: 4_000, maxTimeMs: 400, selection: null, error: { pRandom: 0, pBlind: 0.05, temperatureCp: 220, marginCp: 400 }, description: 'Looks one move ahead; now and then misses a recapture.' },
  { level: 0, id: 'L0b', name: 'Beginner', depth: 1, nodes: 4_000, maxTimeMs: 400, selection: null, error: { pRandom: 0, pBlind: 0.3, temperatureCp: 220, marginCp: 550 }, description: 'Looks one move ahead; often misses that a piece can be taken back.' },
  { level: 0, id: 'L0c', name: 'Newcomer', depth: 1, nodes: 4_000, maxTimeMs: 400, selection: null, error: { pRandom: 0.06, pBlind: 0.45, temperatureCp: 245, marginCp: 700 }, description: 'Grabs material and often leaves pieces hanging; sometimes plays a random move.' },
  { level: 0, id: 'L0d', name: 'First Moves', depth: 1, nodes: 4_000, maxTimeMs: 400, selection: null, error: { pRandom: 0.2, pBlind: 0.7, temperatureCp: 300, marginCp: 1000 }, description: 'Just learning: rarely sees threats, and about one move in seven is random.' },
];
export const getBeginnerLevel = (id: string): StrengthProfile | undefined => BEGINNER_LEVELS.find(l => l.id === id);

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
  selected: MoveSelection;
}
export type MoveSelection = 'best' | 'bounded-sample' | 'repertoire' | 'error-random' | 'error-sample';

/**
 * Choose a move for a strength profile. `seed` makes the bounded sampling reproducible
 * (the game stores the seed and ply so the choice can be audited).
 */
export function chooseMove(searcher: Searcher, pos: Position, profile: StrengthProfile, seed: number, clock?: ClockContext, evalWeights: EvalWeights = PLAY_WEIGHTS, style: StyleId = 'universal', styleEvalOverride?: boolean): ChooseResult {
  // beginner levels (crown-error-1) only; every profile without `error` takes the unchanged path below
  if (profile.error) return chooseErrorMove(searcher, pos, profile, seed, evalWeights);
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

/** Blind horizon: static evaluation after the move (no quiescence); check extension still finds mate in one. */
const BLIND_FEATURES = { ...PLAY_FEATURES, quiescence: false };

/** crown-error-1 move choice (see ErrorModel). Styles and repertoire are not used by beginner levels. */
export function chooseErrorMove(searcher: Searcher, pos: Position, profile: StrengthProfile, seed: number, evalWeights: EvalWeights = PLAY_WEIGHTS): ChooseResult {
  const e = profile.error!;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const legal = pos.legalMoves();
  const rng = mulberry32(seed >>> 0);
  const u = () => rng() / 4294967296;
  // the three draws are always taken in this order so the choice is a pure function of (position, profile, seed)
  const uRandom = u(), uBlind = u(), uPick = u();
  const blind = uBlind < e.pBlind;
  const per = Math.max(50, Math.floor(profile.nodes / Math.max(1, legal.length)));
  // every move is judged (also before a random move, so the recorded score is the engine's own view of it)
  const scored = searcher.scoreRootMoves(pos, legal, 1, { nodeLimitPerMove: per, weights: evalWeights, features: blind ? BLIND_FEATURES : PLAY_FEATURES }).filter(s => Number.isFinite(s.score));
  const nodes = scored.reduce((a, s) => a + s.nodes, 0);
  const result = (move: Move, score: number, selected: MoveSelection): ChooseResult => {
    const timeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    const search: SearchResult = { bestMove: move, score, depth: 1, seldepth: 1, nodes, qnodes: 0, timeMs, pv: [move], iterations: [], stopReason: 'depth', ttHits: 0 };
    return { move, search, candidates: scored, selected };
  };
  const scoreOf = (m: Move) => scored.find(s => s.move === m)?.score ?? 0;
  if (legal.length === 1) return result(legal[0], scoreOf(legal[0]), 'best');
  if (uRandom < e.pRandom || !scored.length) {
    const m = legal[Math.min(legal.length - 1, Math.floor(uPick * legal.length))];
    return result(m, scoreOf(m), 'error-random');
  }
  const best = Math.max(...scored.map(s => s.score));
  const pool = scored.filter(s => s.score >= best - e.marginCp);
  const weights = pool.map(s => Math.exp(Math.max(-60, (s.score - best) / e.temperatureCp)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = uPick * total;
  let chosen = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { chosen = pool[i]; break; } }
  return result(chosen.move, chosen.score, chosen.score === best ? 'best' : 'error-sample');
}
