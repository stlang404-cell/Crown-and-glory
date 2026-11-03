/** Benchmark participants: Crown engine configurations and the Fairy-Stockfish reference. */
import { Position } from '../../src/rules/position';
import { moveToCcn, parseLegalCcn } from '../../src/rules/notation';
import { Searcher, SearchFeatures } from '../../src/engine/search';
import { chooseMove, getLevel } from '../../src/engine/levels';
import { DEFAULT_WEIGHTS, EvalWeights } from '../../src/engine/evaluate';
import { UciEngine } from './uci';

export interface Player {
  id: string;
  newGame(): Promise<void>;
  move(startFen: string, moves: string[], seed: number): Promise<{ move: string; nodes: number; depth: number; ms: number }>;
  close(): void;
}

export const FAIRY_PATH = process.env.FAIRY_STOCKFISH ?? '';

export function crownConfig(id: string, nodes: number, features: Partial<SearchFeatures> = {}, weights: EvalWeights = DEFAULT_WEIGHTS): Player {
  const s = new Searcher(18);
  return {
    id,
    async newGame() { s.newGame(); },
    async move(startFen, moves) {
      const p = Position.fromFen(startFen);
      for (const m of moves) p.makeMove(parseLegalCcn(p, m));
      const r = s.search(p, { limits: { nodes }, features, weights });
      return { move: moveToCcn(r.bestMove), nodes: r.nodes, depth: r.depth, ms: r.timeMs };
    },
    close() {},
  };
}

export function crownLevel(level: number, timeCapMs?: number): Player {
  const s = new Searcher(18);
  const profile = { ...getLevel(level) };
  if (timeCapMs) profile.maxTimeMs = timeCapMs;
  return {
    id: `crown-${profile.id}`,
    async newGame() { s.newGame(); },
    async move(startFen, moves, seed) {
      const p = Position.fromFen(startFen);
      for (const m of moves) p.makeMove(parseLegalCcn(p, m));
      const r = chooseMove(s, p, profile, seed);
      return { move: moveToCcn(r.move), nodes: r.search.nodes, depth: r.search.depth, ms: r.search.timeMs };
    },
    close() {},
  };
}

export async function fairy(id: string, limit: string): Promise<Player> {
  if (!FAIRY_PATH) throw new Error('Set FAIRY_STOCKFISH to a Fairy-Stockfish binary path');
  const e = new UciEngine(FAIRY_PATH);
  await e.init();
  return {
    id,
    async newGame() { await e.newGame(); },
    async move(startFen, moves) {
      const t = Date.now();
      const r = await e.go(startFen, moves, limit);
      const nodes = +(/nodes (\d+)/.exec(r.info)?.[1] ?? 0);
      const depth = +(/depth (\d+)/.exec(r.info)?.[1] ?? 0);
      return { move: r.bestmove, nodes, depth, ms: Date.now() - t };
    },
    close() { e.quit(); },
  };
}
