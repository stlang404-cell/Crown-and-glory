/** Benchmark participants: Crown engine configurations and the Fairy-Stockfish reference. */
import { Position } from '../../src/rules/position';
import { moveToCcn, parseLegalCcn } from '../../src/rules/notation';
import { Searcher, SearchFeatures, PLAY_FEATURES } from '../../src/engine/search';
import { chooseMove, getLevel, StrengthProfile } from '../../src/engine/levels';
import { PLAY_WEIGHTS, EvalWeights } from '../../src/engine/evaluate';
import { UciEngine } from './uci';
import { Searcher as BaseSearcher } from './baseline/search1';
import { DEFAULT_WEIGHTS as BASE_WEIGHTS } from './baseline/eval3';

export interface Player {
  id: string;
  newGame(): Promise<void>;
  move(startFen: string, moves: string[], seed: number): Promise<{ move: string; nodes: number; depth: number; ms: number }>;
  close(): void;
}

export const FAIRY_PATH = process.env.FAIRY_STOCKFISH ?? '';

/**
 * A Crown engine configuration. `engine: 'base'` uses the frozen M3 engine (tools/bench/baseline:
 * crown-search-1 + crown-eval-3) so later versions can always be measured against it.
 * `timeMs` (instead of nodes) gives an equal-time player.
 */
export function crownConfig(id: string, nodes: number, features: Partial<SearchFeatures> = {}, weights: EvalWeights = PLAY_WEIGHTS, engine: 'current' | 'base' = 'current', timeMs?: number, ttBits = 18): Player {
  const s: { newGame(): void; search(p: Position, o: object): { bestMove: number; nodes: number; depth: number; timeMs: number } } =
    engine === 'base' ? new BaseSearcher(ttBits) : new Searcher(ttBits);
  if (engine === 'base') weights = { ...BASE_WEIGHTS, ...weights } as EvalWeights;
  return {
    id,
    async newGame() { s.newGame(); },
    async move(startFen, moves) {
      const p = Position.fromFen(startFen);
      for (const m of moves) p.makeMove(parseLegalCcn(p, m));
      // the current engine plays with the play profile (PLAY_FEATURES) unless a spec overrides features
      const r = s.search(p, { limits: timeMs ? { timeMs } : { nodes }, features: engine === 'base' ? features : { ...PLAY_FEATURES, ...features }, weights });
      return { move: moveToCcn(r.bestMove), nodes: r.nodes, depth: r.depth, ms: r.timeMs };
    },
    close() {},
  };
}

export function crownLevel(level: number, timeCapMs?: number): Player {
  const profile = { ...getLevel(level) };
  if (timeCapMs) profile.maxTimeMs = timeCapMs;
  return crownProfile(`crown-${profile.id}`, profile);
}

/** Any strength profile played through chooseMove (levels, v0.10 beginner levels, error-model pilots). */
export function crownProfile(id: string, profile: StrengthProfile): Player {
  const s = new Searcher(profile.ttBits ?? 18);
  return {
    id,
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
