/** Engine-vs-engine game with Crown adjudication (claims taken automatically). Deterministic for node-limited profiles. */
import { Position } from '../rules/position';
import { moveToCcn, moveToSan } from '../rules/notation';
import { automaticOutcome, claimableDraws } from '../rules/adjudication';
import { Searcher } from './search';
import { chooseMove, StrengthProfile } from './levels';
import { playStyle } from './styles';
import { typedScore } from '../analysis/analyzer';
import type { EngineScore } from '../analysis/types';
import type { StyleId } from '../federation/model';

export interface SelfplayMove { ccn: string; san: string; fen: string; score: EngineScore; depth: number; nodes: number; ms: number }
export interface SelfplaySide { profile: StrengthProfile; style?: StyleId }

export function playSelfplay(initialFen: string, white: SelfplaySide, black: SelfplaySide, seed: number, maxPlies: number, onMove?: (m: SelfplayMove, ply: number) => void):
  { moves: SelfplayMove[]; result: '1-0' | '0-1' | '1/2-1/2'; termination: string } {
  const pos = Position.fromFen(initialFen);
  const sw = new Searcher(16), sb = new Searcher(16);
  const moves: SelfplayMove[] = [];
  let result: '1-0' | '0-1' | '1/2-1/2' = '1/2-1/2', termination = 'playing-limit';
  for (let ply = 0; ply <= maxPlies; ply++) {
    const o = automaticOutcome(pos);
    if (o) { result = o.result; termination = o.termination; break; }
    const c = claimableDraws(pos);
    if (c.threefold || c.fiftyMove) { result = '1/2-1/2'; termination = c.threefold ? 'threefold-claim' : 'fifty-move-claim'; break; }
    if (ply === maxPlies) break;
    const side = pos.side === 0 ? white : black;
    const r = chooseMove(pos.side === 0 ? sw : sb, pos, side.profile, (seed + ply * 7919) >>> 0, undefined, undefined, playStyle(side.style ?? 'universal'));
    if (!pos.legalMoves().includes(r.move)) throw new Error('Engine produced an illegal move');
    const san = moveToSan(pos, r.move);
    const score = typedScore(r.search.score, pos.side === 0 ? 'white' : 'black');
    pos.makeMove(r.move);
    const mv = { ccn: moveToCcn(r.move), san, fen: pos.toFen(), score, depth: r.search.depth, nodes: r.search.nodes, ms: Math.round(r.search.timeMs) };
    moves.push(mv);
    onMove?.(mv, ply + 1);
  }
  return { moves, result, termination };
}
