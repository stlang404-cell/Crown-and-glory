/**
 * Tuning corpus, round 2: self-play games of a given eval-4 parameter set from seeded random openings
 * (the first RANDOM_PLIES plies are uniformly random legal moves, then both sides search NODES nodes).
 * Games are written in the bench game-record format to tools/bench/tune/games-<tag>.json so extract.ts
 * can read them (EXTRA_GAMES).
 *   npx tsx tools/bench/tune/selfplay_gen.ts <paramsFile> <games> <nodes> <tag> [threads]
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';

const RANDOM_PLIES = 6;

if (isMainThread) {
  const [paramsFile, gamesArg, nodesArg, tag, threadsArg] = process.argv.slice(2);
  const games = +gamesArg, nodes = +nodesArg, threads = +(threadsArg ?? 3);
  const params = JSON.parse(readFileSync(paramsFile, 'utf8')).params as number[];
  const out: unknown[] = [];
  await Promise.all(Array.from({ length: threads }, (_, k) => new Promise<void>((res, rej) => {
    const ids = Array.from({ length: games }, (_, i) => i).filter(i => i % threads === k);
    const w = new Worker(new URL('./selfplay_boot.mjs', import.meta.url), { workerData: { ids, nodes, params } });
    w.on('message', (m: unknown[]) => { out.push(...m); res(); });
    w.on('error', rej);
  })));
  writeFileSync(new URL(`./games-${tag}.json`, import.meta.url), JSON.stringify({ [`selfplay-${tag}`]: out }));
  console.log('games', out.length);
  process.exit(0);
} else {
  const { Position } = await import('../../../src/rules/position');
  const { moveToCcn } = await import('../../../src/rules/notation');
  const { automaticOutcome, claimableDraws } = await import('../../../src/rules/adjudication');
  const { Searcher } = await import('../../../src/engine/search');
  const { mulberry32 } = await import('../../../src/rules/tables');
  const { ids, nodes, params } = workerData as { ids: number[]; nodes: number; params: number[] };
  const { paramsFrom } = await import('../../../src/engine/eval4');
  const weights = { version: 4 as const, p: paramsFrom(params) };
  const recs: unknown[] = [];
  for (const id of ids) {
    const rng = mulberry32(0xc0ffee + id * 7919);
    const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    const sw = new Searcher(16), sb = new Searcher(16);
    const moves: string[] = [];
    let result = '*';
    for (let ply = 0; ply < 240; ply++) {
      const o = automaticOutcome(p); if (o) { result = o.result; break; }
      const c = claimableDraws(p); if (c.threefold || c.fiftyMove) { result = '1/2-1/2'; break; }
      let m: number;
      if (ply < RANDOM_PLIES) { const legal = p.legalMoves(); m = legal[Math.floor((rng() / 4294967296) * legal.length)]; }
      else m = (p.side === 0 ? sw : sb).search(p, { limits: { nodes }, weights }).bestMove;
      moves.push(moveToCcn(m));
      p.makeMove(m);
    }
    recs.push({ white: 'gen', black: 'gen', opening: [], moves, result, reason: 'gen', plies: moves.length, stats: {} });
  }
  parentPort!.postMessage(recs);
}
