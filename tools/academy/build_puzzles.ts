/**
 * Crown Academy puzzle builder (crown-puzzles-1).
 *  1. Source: every position of the benchmark game corpus (tools/bench/results/*-games.json).
 *  2. Screen: Crown engine exact scores of all legal moves at depth 3; keep positions whose best move
 *     beats the second by >= 0.20 expected score (s = 200 cp) or is the only forced mate.
 *  3. Verify: Crown exact scores of the top-4 screened moves at depth 8 must agree (same best, gap >= 0.20,
 *     second-best not a winning mate). If FAIRY_STOCKFISH is set, Fairy-Stockfish depth 16 MultiPV 2 must
 *     also choose the same move with a gap >= 150 cp (or a mate the second move lacks).
 *  4. Extend: follow the engine reply and repeat the uniqueness test (depth 7) for up to 3 player moves.
 *  5. Tag motifs (src/academy/motifs.ts), phase, difficulty (smallest Crown node budget that finds move 1),
 *     independence family (source game) and a training / held-out split (20% of families held out).
 * Output: src/academy/data/puzzles.json (bundled as a lazily loaded chunk).
 *   FAIRY_STOCKFISH=... npx tsx tools/academy/build_puzzles.ts [maxPuzzles]
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

const RES = new URL('../bench/results/', import.meta.url);

if (isMainThread) {
  const max = +(process.argv[2] ?? 600);
  const games: { id: string; moves: string[] }[] = [];
  for (const f of readdirSync(RES).filter(f => f.endsWith('-games.json'))) {
    const all = JSON.parse(readFileSync(new URL(f, RES), 'utf8')) as Record<string, { moves: string[] }[]>;
    for (const [k, gs] of Object.entries(all)) gs.forEach((g, i) => games.push({ id: `${f.replace('-games.json', '')}:${k}:${i}`, moves: g.moves }));
  }
  const n = Math.max(1, os.cpus().length);
  console.log('source games', games.length, 'workers', n);
  const parts = await Promise.all(Array.from({ length: n }, (_, k) => new Promise<unknown[]>((res, rej) => {
    const w = new Worker(new URL('./boot.mjs', import.meta.url), { workerData: { games: games.filter((_, i) => i % n === k), fairy: process.env.FAIRY_STOCKFISH ?? '', quota: Math.ceil((max * 1.3) / n) } });
    w.on('message', res); w.on('error', rej);
  })));
  type Pz = { id: string; key: string; family: string; split: string; difficulty: number };
  const seen = new Set<string>();
  const puzzles = (parts.flat() as Pz[]).filter(p => { if (seen.has(p.key)) return false; seen.add(p.key); return true; }).slice(0, max);
  const { SEARCH_ID } = await import('../../src/engine/search');
  const { EVAL_ID } = await import('../../src/engine/evaluate');
  mkdirSync(new URL('../../src/academy/data/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../../src/academy/data/puzzles.json', import.meta.url), JSON.stringify({
    id: 'crown-puzzles-1', createdAt: new Date().toISOString(), engine: `${SEARCH_ID}+${EVAL_ID}`,
    policy: 'Unique best move: Crown depth 3 screen, Crown depth 8 exact verification (gap >= 0.20 expected score, s=200cp), follow-up moves depth 7; optional Fairy-Stockfish depth 16 MultiPV 2 cross-check (gap >= 150cp or exclusive mate).',
    fairyCrossCheck: !!process.env.FAIRY_STOCKFISH, count: puzzles.length, puzzles,
  }));
  console.log('puzzles', puzzles.length);
  process.exit(0);
} else {
  const { Position } = await import('../../src/rules/position');
  const { parseLegalCcn, moveToCcn, moveToSan } = await import('../../src/rules/notation');
  const { Searcher, isMateScore, mateInPlies } = await import('../../src/engine/search');
  const { QUEEN, KING, PAWN } = await import('../../src/rules/types');
  const { motifsForLine, isQuiet } = await import('../../src/academy/motifs');
  const { UciEngine } = await import('../bench/uci');
  const { games, fairy, quota } = workerData as { games: { id: string; moves: string[] }[]; fairy: string; quota: number };
  const s = new Searcher(18);
  const u = (x: number) => (isMateScore(x) ? (x > 0 ? 1 : 0) : 1 / (1 + Math.exp(-x / 200)));
  const fs = fairy ? new UciEngine(fairy) : null;
  if (fs) { await fs.init(); fs.send('setoption name MultiPV value 2'); }
  const out: unknown[] = [];
  const hash = (x: string) => { let h = 2166136261; for (const c of x) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };

  function unique(p: InstanceType<typeof Position>, depth: number): { best: number; score: number; gap: number; second: number | null; pv: number[] } | null {
    const legal = p.legalMoves();
    if (legal.length < 2) return null;
    const screen = s.scoreRootMoves(p, legal, 3).sort((a, b) => b.score - a.score);
    if (u(screen[0].score) - u(screen[1].score) < 0.15) return null;
    const exact = s.scoreRootMoves(p, screen.slice(0, 4).map(x => x.move), depth).sort((a, b) => b.score - a.score);
    const gap = u(exact[0].score) - u(exact[1].score);
    if (gap < 0.2) return null;
    if (isMateScore(exact[1].score) && exact[1].score > 0) return null;
    return { best: exact[0].move, score: exact[0].score, gap, second: exact[1].score, pv: exact[0].pv };
  }

  for (const g of games) {
    if (out.length >= quota) break;
    s.newGame();
    const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    let found = 0;
    let lastCapture = -1;
    const advance = (mv: string) => { const m = parseLegalCcn(p, mv); lastCapture = p.board[(m >> 6) & 63] ? (m >> 6) & 63 : -1; p.makeMove(m); };
    for (let i = 0; i < g.moves.length && found < 3; i++) {
      if (i >= 6 && !p.inCheck()) {
        let first = unique(p, 8);
        // exclude plain recaptures on the square just captured on (trivial, not a puzzle)
        if (first && ((first.best >> 6) & 63) === lastCapture) first = null;
        if (first && u(first.second!) < 0.9) {
          // Fairy cross-check
          let fairyOk = true; let fairyNote = 'not run';
          if (fs) {
            fs.lines = [];
            fs.send(`position fen ${p.toFen()}`); fs.send('go depth 16');
            await fs.wait(l => l.startsWith('bestmove'));
            const last = (k: number) => [...fs.lines].reverse().find(l => l.startsWith('info depth 16 ') && l.includes(` multipv ${k} `)) ?? '';
            const pr = (l: string) => ({ cp: /score cp (-?\d+)/.exec(l)?.[1], mate: /score mate (-?\d+)/.exec(l)?.[1], mv: / pv (\S+)/.exec(l)?.[1] });
            const a = pr(last(1)), b = pr(last(2));
            const aMate = a.mate && +a.mate > 0, bMate = b.mate && +b.mate > 0;
            fairyOk = a.mv === moveToCcn(first.best) && ((!!aMate && !bMate) || (!!a.cp && !!b.cp && +a.cp - +b.cp >= 150) || (!!a.cp && !!b.mate && +b.mate < 0));
            fairyNote = `${a.mv} ${a.mate ? 'mate ' + a.mate : a.cp + 'cp'} vs ${b.mv} ${b.mate ? 'mate ' + b.mate : b.cp + 'cp'}`;
          }
          if (fairyOk) {
            // extend line
            const line = [first.best];
            const q = p.clone();
            q.makeMove(first.best);
            let mateEnd = !q.hasLegalMove() && q.inCheck();
            for (let step = 1; step < 3 && !mateEnd; step++) {
              const reply = s.search(q, { limits: { depth: 7 } }).bestMove;
              if (!reply) break;
              q.makeMove(reply);
              const nxt = unique(q, 7);
              if (!nxt) { q.unmakeMove(); break; }
              line.push(reply, nxt.best);
              q.makeMove(nxt.best);
              mateEnd = !q.hasLegalMove() && q.inCheck();
            }
            const startFen = p.toFen();
            const motifs = motifsForLine(p, line, mateEnd || (isMateScore(first.score) && first.score > 0 && line.length >= mateInPlies(first.score)));
            const c = p.pieceCount();
            const pieces = c.white.reduce((a, x, t) => a + (t !== PAWN && t !== KING ? x : 0), 0) + c.black.reduce((a, x, t) => a + (t !== PAWN && t !== KING ? x : 0), 0);
            const endgame = c.white[QUEEN] + c.black[QUEEN] === 0 && pieces <= 4;
            const tags = motifs.map(m => m.motif) as string[];
            if (endgame) tags.push('endgame');
            if (line.length >= 3) tags.push('calculation');
            if (isQuiet(p, first.best) && !tags.some(t => ['fork', 'pin', 'skewer', 'discovered-attack', 'mate', 'promotion', 'hanging-piece', 'mate-threat'].includes(t))) tags.push('evaluation');
            // Heuristic difficulty 1-5 (crown-difficulty-0, NOT calibrated on human solvers):
            // +1 per extra player move, +1 quiet first move, +1 if the line invests material,
            // +1 if the Crown engine needs more than 2,000 nodes to find move 1.
            let difficulty = 1 + (Math.ceil(line.length / 2) - 1) + (isQuiet(p, first.best) ? 1 : 0);
            { const after = p.clone(); after.makeMove(first.best); const replyCaptures = line[1] !== undefined && after.board[(line[1] >> 6) & 63] !== 0; if (replyCaptures && !p.board[(first.best >> 6) & 63]) difficulty++; }
            s.newGame();
            if (s.search(p, { limits: { nodes: 2000 } }).bestMove !== first.best) difficulty++;
            difficulty = Math.max(1, Math.min(5, difficulty));
            if (!tags.length) tags.push('calculation');
            const sanLine: string[] = [];
            const r = p.clone();
            for (const m of line) { sanLine.push(moveToSan(r, m)); r.makeMove(m); }
            const family = g.id;
            out.push({
              id: `pz-${hash(startFen).toString(36)}`, key: startFen.split(' ').slice(0, 2).join(' '), fen: startFen,
              solution: line.map(moveToCcn), solutionSan: sanLine, playerMoves: Math.ceil(line.length / 2),
              themes: [...new Set(tags)], motifDetails: motifs.map(m => m.detail),
              goal: isMateScore(first.score) && first.score > 0 ? `Mate in ${Math.ceil(mateInPlies(first.score) / 2)}` : u(first.score) < 0.65 ? 'Find the only move that holds' : 'Win material or a decisive advantage',
              difficulty, family, split: hash(family) % 5 === 0 ? 'heldout' : 'training',
              verification: { crownDepth: 8, gap: +first.gap.toFixed(3), bestScore: first.score, secondScore: first.second, fairy: fairyNote },
              phase: endgame ? 'endgame' : c.white[QUEEN] + c.black[QUEEN] < 2 ? 'middlegame' : 'opening/middlegame',
            });
            found++;
            i += 4; // skip correlated neighbours
            for (let k = 0; k < 4 && i - 4 + k < g.moves.length; k++) { /* positions advanced below */ }
            // advance the board by the skipped plies (we jumped i forward)
            for (let k = i - 4; k <= i && k < g.moves.length; k++) advance(g.moves[k]);
            continue;
          }
        }
      }
      advance(g.moves[i]);
    }
  }
  fs?.quit();
  parentPort!.postMessage(out);
}
