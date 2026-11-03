/**
 * Style validation (crown-style-validation-1).
 *  Styles are bounded move-choice policies (src/engine/styles.ts).
 *  (a) Behaviour: on 400 fixed positions (every 3rd position of the oracle fixture with ≥ 3 legal moves),
 *      each style and the universal profile choose a move at 20k nodes. We record the disagreement rate and
 *      move-feature rates: captures, checks, pawn pushes, king moves, moves into the enemy half.
 *      Pass: disagreement ≥ 10% AND the style's signature feature moves in the claimed direction by ≥ 3
 *      percentage points (tactical/aggressive: more checks+captures; positional/defensive: fewer;
 *      endgame: more pawn pushes in positions with ≤ 4 pieces).
 *  (b) Strength parity: 32 colour-swapped opening pairs vs universal at 20k nodes; pass if the 95% interval
 *      of the Elo difference overlaps [−100, +100] and the point estimate lies within it.
 *   npx tsx tools/styles/validate.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

const STYLES = ['tactical', 'positional', 'defensive', 'endgame', 'aggressive'] as const;
if (isMainThread) {
  const { Position } = await import('../../src/rules/position');
  const { moveToCcn } = await import('../../src/rules/notation');
  const { Searcher } = await import('../../src/engine/search');
  const { chooseMove } = await import('../../src/engine/levels');
  const { KING, PAWN, QUEEN } = await import('../../src/rules/types');
  const fx = JSON.parse(readFileSync(new URL('../../tests/fixtures/oracle_positions.json', import.meta.url), 'utf8')).positions as { fen: string; moves: string[] }[];
  const suite = fx.filter((p, i) => i % 3 === 0 && p.moves.length >= 3).slice(0, 400).map(p => p.fen);
  const features = (fen: string, ccn: string) => {
    const p = Position.fromFen(fen);
    const m = p.legalMoves().find(x => moveToCcn(x) === ccn)!;
    const from = m & 63, to = (m >> 6) & 63;
    const piece = p.board[from] & 7;
    const capture = p.board[to] !== 0;
    const c = p.pieceCount();
    const pieces = c.white.reduce((a, x, t) => a + (t !== PAWN && t !== KING ? x : 0), 0) + c.black.reduce((a, x, t) => a + (t !== PAWN && t !== KING ? x : 0), 0);
    p.makeMove(m);
    return { capture, check: p.inCheck(), pawn: piece === PAWN, king: piece === KING, advance: p.side === 1 ? Math.floor(to / 6) >= 3 : Math.floor(to / 6) <= 2, endgame: c.white[QUEEN] + c.black[QUEEN] === 0 && pieces <= 4 };
  };
  const prof = { level: 0, id: 'v', name: 'v', depth: 64, nodes: 20_000, maxTimeMs: 60_000, selection: null, description: '' };
  const choose = (style: string) => { const s = new Searcher(16); return suite.map(fen => { s.newGame(); return moveToCcn(chooseMove(s, Position.fromFen(fen), prof, 1, undefined, undefined, style as never).move); }); };
  const base = choose('universal');
  const rate = (moves: string[], f: (x: ReturnType<typeof features>) => boolean, filter: (x: ReturnType<typeof features>) => boolean = () => true) => {
    let n = 0, k = 0; moves.forEach((mv, i) => { const ft = features(suite[i], mv); if (!filter(ft)) return; n++; if (f(ft)) k++; }); return n ? k / n : 0;
  };
  const behaviour: Record<string, unknown> = {};
  for (const st of STYLES) {
    const mv = choose(st);
    const dis = mv.filter((m, i) => m !== base[i]).length / suite.length;
    const forcing = (x: ReturnType<typeof features>) => x.capture || x.check;
    const sig = st === 'tactical' || st === 'aggressive' ? rate(mv, forcing) - rate(base, forcing)
      : st === 'endgame' ? rate(mv, x => x.pawn, x => x.endgame) - rate(base, x => x.pawn, x => x.endgame)
      : -(rate(mv, forcing) - rate(base, forcing));
    behaviour[st] = { disagreement: +dis.toFixed(3), signatureDelta: +sig.toFixed(3), forcingRate: +rate(mv, forcing).toFixed(3), baseForcing: +rate(base, forcing).toFixed(3), checkRate: +rate(mv, x => x.check).toFixed(3), pawnRate: +rate(mv, x => x.pawn).toFixed(3), advanceRate: +rate(mv, x => x.advance).toFixed(3) };
    console.log(st, JSON.stringify(behaviour[st]));
  }
  // strength parity via the bench worker pool
  const openings = JSON.parse(readFileSync(new URL('../bench/openings.json', import.meta.url), 'utf8')).openings as string[][];
  const n = os.cpus().length;
  const jobs: { style: string; white: boolean; opening: string[]; seed: number }[] = [];
  for (const st of STYLES) openings.slice(0, 32).forEach((op, i) => { jobs.push({ style: st, white: true, opening: op, seed: i * 2 }); jobs.push({ style: st, white: false, opening: op, seed: i * 2 + 1 }); });
  const results: { style: string; white: boolean; result: string }[] = [];
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise<void>((res, rej) => {
    const w = new Worker(new URL('./boot.mjs', import.meta.url), { workerData: jobs.filter((_, i) => i % n === k) });
    w.on('message', (m: typeof results) => { results.push(...m); res(); }); w.on('error', rej);
  })));
  const out: Record<string, unknown> = {};
  const validated: string[] = [];
  for (const st of STYLES) {
    const rs = results.filter(r => r.style === st);
    const pairScores: number[] = [];
    for (let i = 0; i < 32; i++) {
      const sc = (r: { white: boolean; result: string } | undefined) => !r ? 0.5 : r.result === '1/2-1/2' || r.result === '*' ? 0.5 : (r.result === '1-0') === r.white ? 1 : 0;
      pairScores.push((sc(rs.find(r => r.white && (r as never as { i: number }).i === i)) + sc(rs.find(r => !r.white && (r as never as { i: number }).i === i))) / 2);
    }
    const mean = pairScores.reduce((a, b) => a + b, 0) / pairScores.length;
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const boots: number[] = [];
    for (let b = 0; b < 2000; b++) { let t = 0; for (let k = 0; k < pairScores.length; k++) t += pairScores[Math.floor(rnd() * pairScores.length)]; boots.push(t / pairScores.length); }
    boots.sort((a, b) => a - b);
    const elo = (p: number) => -400 * Math.log10(1 / Math.min(Math.max(p, 0.001), 0.999) - 1);
    const strength = { score: +mean.toFixed(3), elo: Math.round(elo(mean)), eloCI: [Math.round(elo(boots[50])), Math.round(elo(boots[1949]))], games: rs.length };
    const b = behaviour[st] as { disagreement: number; signatureDelta: number };
    const pass = b.disagreement >= 0.1 && b.signatureDelta >= 0.03 && Math.abs(strength.elo) <= 100;
    if (pass) validated.push(st);
    out[st] = { behaviour: b, strength, pass };
    console.log(st, JSON.stringify(out[st]));
  }
  writeFileSync(new URL('../../src/engine/styles-validation.json', import.meta.url), JSON.stringify({ id: `styles-${new Date().toISOString().slice(0, 10)}-crown-eval-3`, method: 'see tools/styles/validate.ts header', suitePositions: suite.length, validated, results: out }, null, 1));
  process.exit(0);
} else {
  const { Position } = await import('../../src/rules/position');
  const { parseLegalCcn, moveToCcn } = await import('../../src/rules/notation');
  const { automaticOutcome, claimableDraws } = await import('../../src/rules/adjudication');
  const { Searcher } = await import('../../src/engine/search');
  const { chooseMove } = await import('../../src/engine/levels');
  const jobs = workerData as { style: string; white: boolean; opening: string[]; seed: number }[];
  const prof = { level: 0, id: 'v', name: 'v', depth: 64, nodes: 20_000, maxTimeMs: 60_000, selection: null, description: '' };
  const out: unknown[] = [];
  for (const j of jobs) {
    const sw = new Searcher(16), sb = new Searcher(16);
    const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    for (const m of j.opening) p.makeMove(parseLegalCcn(p, m));
    let result = '*';
    for (let ply = 0; ply < 300; ply++) {
      const o = automaticOutcome(p); if (o) { result = o.result; break; }
      const c = claimableDraws(p); if (c.threefold || c.fiftyMove) { result = '1/2-1/2'; break; }
      const styleToMove = (p.side === 0) === j.white;
      const r = chooseMove(styleToMove ? sw : sb, p, prof, ply, undefined, undefined, (styleToMove ? j.style : 'universal') as never);
      p.makeMove(r.move);
    }
    out.push({ style: j.style, white: j.white, result, i: Math.floor(j.seed / 2) });
    void moveToCcn;
  }
  parentPort!.postMessage(out);
}
