/**
 * Outcome-calibration corpus (crown-calib-corpus-1).
 * Source: benchmark games between near-equal-strength Crown configurations (|measured Elo diff| < 75),
 * so that outcomes reflect the position rather than a strength mismatch. Every 3rd ply from ply 6
 * is scored by the Crown engine with a fixed policy (depth 6 full search, fresh TT per game) from the
 * side-to-move perspective and labelled with the final game result for that side (1 / ½ / 0).
 *   npx tsx tools/calibration/build_corpus.ts [depth]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

const RES = new URL('../bench/results/', import.meta.url);
const OUT = new URL('./corpus.json', import.meta.url);
interface G { white: string; black: string; opening: string[]; moves: string[]; result: string; reason: string }

if (isMainThread) {
  const depth = +(process.argv[2] ?? 6);
  const files = ['suite-ablation', 'suite-experiments', 'suite-evalexp', 'suite-confirm', 'suite-confirmmob', 'suite-mobstep'];
  const games: (G & { gameId: string })[] = [];
  for (const f of files) {
    const gf = new URL(`${f}-games.json`, RES), sf = new URL(`${f}.json`, RES);
    if (!existsSync(gf) || !existsSync(sf)) continue;
    const summaries = JSON.parse(readFileSync(sf, 'utf8')).summaries as { a: string; b: string; eloDiff: number | null }[];
    const all = JSON.parse(readFileSync(gf, 'utf8')) as Record<string, G[]>;
    for (const [key, gs] of Object.entries(all)) {
      const [a, b] = key.split('-vs-');
      const s = summaries.find(x => x.a.startsWith(a) && x.b.startsWith(b)) ?? summaries.find(x => `${x.a}-vs-${x.b}` === key);
      if (!s || s.eloDiff === null || Math.abs(s.eloDiff) >= 75) continue;
      gs.forEach((g, i) => { if (g.result !== '*') games.push({ ...g, gameId: `${f}:${key}:${i}` }); });
    }
  }
  console.log('games', games.length);
  const n = Math.max(1, os.cpus().length);
  const chunks = Array.from({ length: n }, (_, k) => games.filter((_, i) => i % n === k));
  const results = await Promise.all(chunks.map(chunk => new Promise<unknown[]>((res, rej) => {
    const w = new Worker(new URL('./boot.mjs', import.meta.url), { workerData: { chunk, depth } });
    w.on('message', res); w.on('error', rej);
  })));
  const positions = results.flat();
  writeFileSync(OUT, JSON.stringify({ id: 'crown-calib-corpus-1', depth, games: games.length, positions: positions.length, createdAt: new Date().toISOString(), data: positions }));
  console.log('positions', positions.length);
  process.exit(0);
} else {
  const { Position } = await import('../../src/rules/position');
  const { parseLegalCcn } = await import('../../src/rules/notation');
  const { Searcher, isMateScore, mateInPlies } = await import('../../src/engine/search');
  const { QUEEN, KING, PAWN } = await import('../../src/rules/types');
  const { chunk, depth } = workerData as { chunk: (G & { gameId: string })[]; depth: number };
  const s = new Searcher(18);
  const out: unknown[] = [];
  for (const g of chunk) {
    s.newGame();
    const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    const whiteScore = g.result === '1-0' ? 1 : g.result === '0-1' ? 0 : 0.5;
    for (let i = 0; i < g.moves.length; i++) {
      if (i >= 6 && i % 3 === 0 && i < g.moves.length - 1 && p.legalMoves().length > 1) {
        const r = s.search(p, { limits: { depth } });
        const c = p.pieceCount();
        const pieces = c.white.reduce((a, x, t) => a + (t !== PAWN && t !== KING ? x : 0), 0) + c.black.reduce((a, x, t) => a + (t !== PAWN && t !== KING ? x : 0), 0);
        out.push({
          g: g.gameId, fam: g.opening[0], ply: i, stm: p.side,
          cp: isMateScore(r.score) ? null : r.score, mate: isMateScore(r.score) ? mateInPlies(r.score) : null,
          y: p.side === 0 ? whiteScore : 1 - whiteScore,
          queens: c.white[QUEEN] + c.black[QUEEN], pieces,
        });
      }
      p.makeMove(parseLegalCcn(p, g.moves[i]));
    }
  }
  parentPort!.postMessage(out);
}
