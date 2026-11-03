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
import { Searcher, SearchResult, isMateScore } from './search';
import type { EvalWeights } from './evaluate';
import { STYLE_MARGIN_CP, stylePreference } from './styles';
import type { StyleId } from '../federation/model';
import { mulberry32 } from '../rules/tables';

export const LEVELS_ID = 'crown-levels-2';

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
}

export const LEVELS: StrengthProfile[] = [
  { level: 1, id: 'L1', name: 'Novice', depth: 1, nodes: 2_000, maxTimeMs: 400, selection: { marginCp: 320, temperatureCp: 200 }, description: '1-ply search; picks among moves within 3.2 pawns of its best, often loosely.' },
  { level: 2, id: 'L2', name: 'Apprentice', depth: 1, nodes: 2_000, maxTimeMs: 400, selection: { marginCp: 200, temperatureCp: 110 }, description: '1-ply search with quiescence; picks among moves within 2 pawns of its best.' },
  { level: 3, id: 'L3', name: 'Club', depth: 2, nodes: 6_000, maxTimeMs: 500, selection: { marginCp: 130, temperatureCp: 70 }, description: '2-ply search; picks among moves within 1.3 pawns of its best.' },
  { level: 4, id: 'L4', name: 'District', depth: 2, nodes: 8_000, maxTimeMs: 600, selection: { marginCp: 70, temperatureCp: 35 }, description: '2-ply search; picks among moves within 0.7 pawns of its best.' },
  { level: 5, id: 'L5', name: 'Regional', depth: 64, nodes: 600, maxTimeMs: 400, selection: null, description: 'Full search, 600 nodes per move.' },
  { level: 6, id: 'L6', name: 'National', depth: 64, nodes: 4_000, maxTimeMs: 800, selection: null, description: 'Full search, 4k nodes per move.' },
  { level: 7, id: 'L7', name: 'Master', depth: 64, nodes: 30_000, maxTimeMs: 2_000, selection: null, description: 'Full search, 30k nodes per move.' },
  { level: 8, id: 'L8', name: 'Crown', depth: 64, nodes: Infinity, maxTimeMs: 6_000, selection: null, description: 'Strongest configuration: full search limited only by the clock (up to 6 s per move).' },
];

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
  selected: 'best' | 'bounded-sample';
}

/**
 * Choose a move for a strength profile. `seed` makes the bounded sampling reproducible
 * (the game stores the seed and ply so the choice can be audited).
 */
export function chooseMove(searcher: Searcher, pos: Position, profile: StrengthProfile, seed: number, clock?: ClockContext, evalWeights?: EvalWeights, style: StyleId = 'universal'): ChooseResult {
  const timeMs = allocateTime(profile, clock);
  const search = searcher.search(pos, {
    limits: { depth: profile.depth, nodes: profile.nodes === Infinity ? undefined : profile.nodes, timeMs },
    stopOnSingleMove: true,
    weights: evalWeights,
  });
  if (!profile.selection && style !== 'universal' && !isMateScore(search.score) && search.depth >= 3) {
    // bounded style choice among near-equal moves (src/engine/styles.ts)
    const legal = pos.legalMoves();
    if (legal.length > 1) {
      const scored = searcher.scoreRootMoves(pos, legal, Math.max(1, search.depth - 2), { weights: evalWeights }).filter(x => Number.isFinite(x.score));
      const best = Math.max(...scored.map(x => x.score));
      const near = scored.filter(x => x.score >= best - STYLE_MARGIN_CP && !isMateScore(x.score));
      if (near.length > 1 && near.some(x => x.move === search.bestMove)) {
        let pick = search.bestMove, pickPref = stylePreference(style, pos, search.bestMove);
        for (const x of near) { const pr = stylePreference(style, pos, x.move); if (pr > pickPref) { pick = x.move; pickPref = pr; } }
        return { move: pick, search, candidates: scored, selected: pick === search.bestMove ? 'best' : 'bounded-sample' };
      }
    }
  }
  if (!profile.selection || isMateScore(search.score)) return { move: search.bestMove, search, selected: 'best' };
  const legal = pos.legalMoves();
  if (legal.length < 2) return { move: search.bestMove, search, selected: 'best' };
  const depth = Math.max(1, Math.min(profile.depth, search.depth || 1));
  const scored = searcher.scoreRootMoves(pos, legal, depth, { nodeLimitPerMove: Math.max(200, Math.floor(profile.nodes / legal.length)), weights: evalWeights })
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
