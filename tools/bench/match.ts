/** Game runner using the production rules and Crown adjudication (claims taken automatically). */
import { Position } from '../../src/rules/position';
import { parseLegalCcn } from '../../src/rules/notation';
import { automaticOutcome, claimableDraws } from '../../src/rules/adjudication';
import { Player } from './players';

export interface GameRecord {
  white: string; black: string; opening: string[]; moves: string[];
  result: '1-0' | '0-1' | '1/2-1/2' | '*'; reason: string; plies: number;
  illegal?: string;
  stats: Record<string, { nodes: number; depth: number; ms: number; moves: number }>;
}

export const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

export async function playGame(white: Player, black: Player, opening: string[], seed: number, maxPlies = 300): Promise<GameRecord> {
  await white.newGame(); await black.newGame();
  const pos = Position.fromFen(START);
  const moves: string[] = [];
  const stats: GameRecord['stats'] = { [white.id + '#w']: { nodes: 0, depth: 0, ms: 0, moves: 0 }, [black.id + '#b']: { nodes: 0, depth: 0, ms: 0, moves: 0 } };
  for (const m of opening) { pos.makeMove(parseLegalCcn(pos, m)); moves.push(m); }
  for (;;) {
    const out = automaticOutcome(pos);
    if (out) return { white: white.id, black: black.id, opening, moves, result: out.result, reason: out.termination, plies: moves.length, stats };
    const claims = claimableDraws(pos);
    if (claims.threefold || claims.fiftyMove) return { white: white.id, black: black.id, opening, moves, result: '1/2-1/2', reason: claims.threefold ? 'threefold-claim' : 'fifty-move-claim', plies: moves.length, stats };
    if (moves.length >= maxPlies) return { white: white.id, black: black.id, opening, moves, result: '*', reason: 'cap', plies: moves.length, stats };
    const mover = pos.side === 0 ? white : black;
    const key = mover.id + (pos.side === 0 ? '#w' : '#b');
    const r = await mover.move(START, moves, (seed * 1000 + moves.length) >>> 0);
    const m = parseLegalCcn(pos, r.move);
    if (m < 0) return { white: white.id, black: black.id, opening, moves, result: pos.side === 0 ? '0-1' : '1-0', reason: 'illegal-move', illegal: r.move, plies: moves.length, stats };
    stats[key].nodes += r.nodes; stats[key].depth += r.depth; stats[key].ms += r.ms; stats[key].moves++;
    pos.makeMove(m);
    moves.push(r.move);
  }
}

/** Color-swapped opening pairs → per-pair score for the first player (0..2). */
export function scoreFor(id: string, g: GameRecord): number | null {
  if (g.result === '*') return null;
  if (g.result === '1/2-1/2') return 0.5;
  const whiteWon = g.result === '1-0';
  return (g.white === id) === whiteWon ? 1 : 0;
}

/** Pair bootstrap 95% interval of mean score (resampling opening pairs). */
export function pairBootstrap(pairScores: number[], iters = 4000, seed = 7): [number, number] {
  if (!pairScores.length) return [NaN, NaN];
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const means: number[] = [];
  for (let i = 0; i < iters; i++) {
    let t = 0;
    for (let j = 0; j < pairScores.length; j++) t += pairScores[Math.floor(rnd() * pairScores.length)];
    means.push(t / pairScores.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(iters * 0.025)], means[Math.floor(iters * 0.975)]];
}

export function eloFromScore(p: number): number {
  const q = Math.min(Math.max(p, 1e-3), 1 - 1e-3);
  return -400 * Math.log10(1 / q - 1);
}
