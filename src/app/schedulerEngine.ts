/**
 * Live-game move primitives shared by the live scheduler, FederationService.liveStep and the measurement tools.
 * A live move is a FRESH seeded search (the transposition table is cleared before every move), so a game resumed
 * after a reload, or computed by another worker, continues on exactly the same timeline: move k depends only on the
 * moves before it, the side's profile and style, and seed + k·7919.
 */
import { Position } from '../rules/position';
import { automaticOutcome, claimableDraws } from '../rules/adjudication';
import { moveToCcn } from '../rules/notation';
import { Searcher } from '../engine/search';
import { chooseMove, type StrengthProfile } from '../engine/levels';
import { playStyle } from '../engine/styles';
import { typedScore } from '../analysis/analyzer';
import type { EngineScore } from '../analysis/types';
import type { StyleId } from '../federation/model';

export const START_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
/** Playing-length limit of a live game (plies); a game reaching it is censored ('playing-limit'). */
export const LIVE_MAX_PLIES = 400;
/** Seed of ply k of a live game. */
export const plySeed = (gameSeed: number, ply: number) => (gameSeed + ply * 7919) >>> 0;

/** Terminal state of a live game after `plies` moves (automatic outcomes, claims taken at once, playing limit). */
export function liveTerminal(pos: Position, plies: number): { result: '1-0' | '0-1' | '1/2-1/2'; termination: string } | null {
  const o = automaticOutcome(pos);
  if (o) return { result: o.result, termination: o.termination };
  const c = claimableDraws(pos);
  if (c.threefold || c.fiftyMove) return { result: '1/2-1/2', termination: c.threefold ? 'threefold-claim' : 'fifty-move-claim' };
  if (plies >= LIVE_MAX_PLIES) return { result: '1/2-1/2', termination: 'playing-limit' };
  return null;
}

let searcher: Searcher | null = null;
/** In-process live move (Node tools and tests): the same search the spectator worker runs for a `move` request with
 *  `newGame: true` (Searcher(18), table cleared). */
export function playLiveMove(pos: Position, profile: StrengthProfile, style: StyleId, seed: number): { move: number; ccn: string; score: EngineScore; depth: number; nodes: number; ms: number } {
  searcher ??= new Searcher(18);
  searcher.newGame();
  const t0 = Date.now();
  const r = chooseMove(searcher, pos, profile, seed, undefined, undefined, playStyle(style));
  if (!pos.legalMoves().includes(r.move)) throw new Error('Engine produced an illegal move');
  return { move: r.move, ccn: moveToCcn(r.move), score: typedScore(r.search.score, pos.side === 0 ? 'white' : 'black'), depth: r.search.depth, nodes: r.search.nodes, ms: Date.now() - t0 };
}
