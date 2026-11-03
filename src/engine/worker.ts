/// <reference lib="webworker" />
/**
 * Engine worker: owns its own Searcher (transposition table, ~6 MiB at 2^18 entries) and runs
 * move searches and full-game analysis off the main thread. Cancellation is by worker
 * termination (the search is synchronous); the client discards any reply from an older generation.
 */
import { Position } from '../rules/position';
import { moveToCcn, parseLegalCcn, moveToSan, ccnLineToSan } from '../rules/notation';
import { Searcher } from './search';
import { DEFAULT_WEIGHTS } from './evaluate';
import { playStyle } from './styles';
import { automaticOutcome, claimableDraws } from '../rules/adjudication';
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
      const r = chooseMove(searcher, pos, req.profile ?? getLevel(req.level), req.seed, req.clock, req.weights ? { ...DEFAULT_WEIGHTS, ...req.weights } : undefined, playStyle(req.style ?? 'universal'));
      // Defence in depth: the engine may never play an illegal move.
      if (!pos.legalMoves().includes(r.move)) throw new Error('Engine produced an illegal move');
      post({
        type: 'move-result', ...base, move: moveToCcn(r.move), score: typedScore(r.search.score, pov), depth: r.search.depth,
        nodes: r.search.nodes, timeMs: Math.round(r.search.timeMs), pv: r.search.pv.map(moveToCcn), selected: r.selected, stopReason: r.search.stopReason,
      });
      return;
    }
    if (req.type === 'selfplay') {
      const pos = Position.fromFen(req.initialFen);
      const sw = new Searcher(16), sb = new Searcher(16);
      const moves: { ccn: string; san: string; fen: string; score: ReturnType<typeof typedScore>; depth: number; nodes: number; ms: number }[] = [];
      let result: '1-0' | '0-1' | '1/2-1/2' = '1/2-1/2', termination = 'playing-limit';
      for (let ply = 0; ply < req.maxPlies; ply++) {
        const o = automaticOutcome(pos);
        if (o) { result = o.result; termination = o.termination; break; }
        const c = claimableDraws(pos);
        if (c.threefold || c.fiftyMove) { result = '1/2-1/2'; termination = c.threefold ? 'threefold-claim' : 'fifty-move-claim'; break; }
        const side = pos.side === 0 ? req.white : req.black;
        const r = chooseMove(pos.side === 0 ? sw : sb, pos, side.profile, (req.seed + ply * 7919) >>> 0, undefined, undefined, playStyle(side.style ?? 'universal'));
        if (!pos.legalMoves().includes(r.move)) throw new Error('Engine produced an illegal move');
        const san = moveToSan(pos, r.move);
        const score = typedScore(r.search.score, pos.side === 0 ? 'white' : 'black');
        pos.makeMove(r.move);
        const mv = { ccn: moveToCcn(r.move), san, fen: pos.toFen(), score, depth: r.search.depth, nodes: r.search.nodes, ms: Math.round(r.search.timeMs) };
        moves.push(mv);
        post({ type: 'selfplay-move', ...base, ply: ply + 1, ...mv });
      }
      if (termination === 'playing-limit') { const o = automaticOutcome(pos); if (o) { result = o.result; termination = o.termination; } }
      post({ type: 'selfplay-result', ...base, moves, result, termination });
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
