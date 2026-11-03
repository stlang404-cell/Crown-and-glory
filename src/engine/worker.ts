/// <reference lib="webworker" />
/**
 * Engine worker: owns its own Searcher (transposition table, ~6 MiB at 2^18 entries) and runs
 * move searches and full-game analysis off the main thread. Cancellation is by worker
 * termination (the search is synchronous); the client discards any reply from an older generation.
 */
import { Position } from '../rules/position';
import { moveToCcn, parseLegalCcn } from '../rules/notation';
import { Searcher } from './search';
import { chooseMove, getLevel } from './levels';
import { analyzeGame, typedScore, ENGINE_BUILD } from '../analysis/analyzer';
import type { WorkerReply, WorkerRequest } from './protocol';

const searcher = new Searcher(18);
const post = (m: WorkerReply) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  const base = { requestId: req.requestId, generation: req.generation };
  try {
    if (req.type === 'ping') { post({ type: 'pong', ...base, engine: ENGINE_BUILD }); return; }
    if (req.type === 'move') {
      const pos = Position.fromFen(req.initialFen);
      for (const s of [...(req.setupMoves ?? []), ...req.moves]) {
        const m = parseLegalCcn(pos, s);
        if (m < 0) throw new Error(`Illegal history move ${s}`);
        pos.makeMove(m);
      }
      if (req.newGame) searcher.newGame();
      const pov = pos.side === 0 ? 'white' : 'black';
      const r = chooseMove(searcher, pos, getLevel(req.level), req.seed, req.clock);
      // Defence in depth: the engine may never play an illegal move.
      if (!pos.legalMoves().includes(r.move)) throw new Error('Engine produced an illegal move');
      post({
        type: 'move-result', ...base, move: moveToCcn(r.move), score: typedScore(r.search.score, pov), depth: r.search.depth,
        nodes: r.search.nodes, timeMs: Math.round(r.search.timeMs), pv: r.search.pv.map(moveToCcn), selected: r.selected, stopReason: r.search.stopReason,
      });
      return;
    }
    if (req.type === 'analyze') {
      const report = analyzeGame(
        { gameId: req.gameId, checksum: req.checksum, initialFen: req.initialFen, setupMoves: req.setupMoves, moves: req.moves },
        req.settings,
        { onPly: (ply, index, total) => post({ type: 'ply', ...base, index, total, ply }) },
        searcher,
      );
      post({ type: 'analysis-result', ...base, report });
    }
  } catch (e) {
    post({ type: 'error', ...base, message: e instanceof Error ? e.message : String(e) });
  }
};
