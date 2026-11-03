/// <reference lib="webworker" />
/**
 * Engine worker: owns its own Searcher (transposition table, ~6 MiB at 2^18 entries) and runs
 * move searches and full-game analysis off the main thread. Cancellation is by worker
 * termination (the search is synchronous); the client discards any reply from an older generation.
 */
import { Position } from '../rules/position';
import { moveToCcn, parseLegalCcn, moveToSan, ccnLineToSan } from '../rules/notation';
import { Searcher } from './search';
import { PLAY_WEIGHTS, mergeWeights } from './evaluate';
import { playStyle } from './styles';
import { playSelfplay } from './selfplay';
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
      const r = chooseMove(searcher, pos, req.profile ?? getLevel(req.level), req.seed, req.clock, req.weights ? mergeWeights(PLAY_WEIGHTS, req.weights) : undefined, playStyle(req.style ?? 'universal'));
      // Defence in depth: the engine may never play an illegal move.
      if (!pos.legalMoves().includes(r.move)) throw new Error('Engine produced an illegal move');
      post({
        type: 'move-result', ...base, move: moveToCcn(r.move), score: typedScore(r.search.score, pov), depth: r.search.depth,
        nodes: r.search.nodes, timeMs: Math.round(r.search.timeMs), pv: r.search.pv.map(moveToCcn), selected: r.selected, stopReason: r.search.stopReason,
      });
      return;
    }
    if (req.type === 'selfplay') {
      const r = playSelfplay(req.initialFen, req.white, req.black, req.seed, req.maxPlies, (mv, ply) => post({ type: 'selfplay-move', ...base, ply, ...mv }));
      post({ type: 'selfplay-result', ...base, ...r });
      return;
    }
    if (req.type === 'assist') {
      const pos = Position.fromFen(req.initialFen);
      for (const s of [...(req.setupMoves ?? []), ...req.moves]) pos.makeMove(parseLegalCcn(pos, s));
      const pov = pos.side === 0 ? 'white' : 'black';
      const legal = pos.legalMoves();
      const screen = searcher.scoreRootMoves(pos, legal, Math.min(3, req.depth)).sort((a, b) => b.score - a.score).slice(0, 3);
      const exact = searcher.scoreRootMoves(pos, screen.map(x => x.move), req.depth).sort((a, b) => b.score - a.score);
      const candidates = exact.map(c => {
        const pv = c.pv.map(moveToCcn);
        return { ccn: moveToCcn(c.move), san: moveToSan(pos, c.move, legal), score: typedScore(c.score, pov), pv, pvSan: ccnLineToSan(pos.toFen(), pv) };
      });
      post({ type: 'assist-result', ...base, candidates, depth: req.depth });
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
