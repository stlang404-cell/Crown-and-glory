/**
 * Style validation (crown-style-validation-2) for the opening-repertoire styles (crown-styles-3).
 *  (a) Behaviour: WALKS seeded opening walks from the start position per style (the style plays White in
 *      even walks, Black in odd walks; the other side picks uniformly among book moves). At every styled
 *      decision inside the book we record the style's move and the move the universal engine plays in the
 *      same position (chooseMove, 20k nodes). Metrics: disagreement rate and the style's signature feature
 *      rate minus the universal rate, with a 95% bootstrap interval clustered by walk.
 *      Signatures: aggressive = pawn pushes; tactical = contact moves (capture, check, or attacking an enemy
 *      piece); positional = piece (non-pawn) moves; defensive = moves ending on the mover's first two ranks.
 *      Endgame technicians have no opening preference and cannot pass this test.
 *      Pass: disagreement ≥ 20% AND signature Δ ≥ 10 pp AND the interval's lower bound > 0.
 *  (b) Strength parity: PAIRS colour-swapped seeded games from the start position, style vs universal at
 *      8k nodes. Pass: Elo point estimate within ±100 and its 95% bootstrap interval overlapping [−100, 100].
 *   npx tsx tools/styles/validate.ts
 */
import { writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

const STYLES = ['tactical', 'positional', 'defensive', 'endgame', 'aggressive'] as const;
const WALKS = 400, PAIRS = 24, PARITY_NODES = 8000;

if (isMainThread) {
  const { Position } = await import('../../src/rules/position');
  const { moveToCcn } = await import('../../src/rules/notation');
  const { Searcher } = await import('../../src/engine/search');
  const { chooseMove } = await import('../../src/engine/levels');
  const { repertoireChoice, bookMoves, bookKey, REPERTOIRE_ID } = await import('../../src/engine/styles');
  const { PAWN, KING, pieceType, pieceColor, moveFrom, moveTo, rankOf } = await import('../../src/rules/types');
  const { mulberry32 } = await import('../../src/rules/tables');
  const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
  const prof = { level: 0, id: 'v', name: 'v', depth: 64, nodes: 20_000, maxTimeMs: 60_000, selection: null, description: '' };
  const searcher = new Searcher(18);
  const uniCache = new Map<string, number>();
  const universal = (pos: InstanceType<typeof Position>) => {
    const k = bookKey(pos.toFen());
    if (!uniCache.has(k)) { searcher.newGame(); uniCache.set(k, chooseMove(searcher, pos, prof, 1).move); }
    return uniCache.get(k)!;
  };
  const feat = (pos: InstanceType<typeof Position>, m: number) => {
    const us = pos.side, from = moveFrom(m), to = moveTo(m);
    const piece = pieceType(pos.board[from]);
    const capture = pos.board[to] !== 0;
    const p = pos.clone(); p.makeMove(m);
    const check = p.inCheck();
    // contact: the moved piece attacks an enemy non-king piece (pseudo-attack via its legal captures next turn)
    p.side ^= 1; // look at the mover's captures from the new position (null-move view)
    let contact = false;
    try { contact = p.legalMoves().some(x => moveFrom(x) === to && p.board[moveTo(x)] !== 0 && pieceColor(p.board[moveTo(x)]) !== us && pieceType(p.board[moveTo(x)]) !== KING); } catch { contact = false; }
    p.side ^= 1;
    const relRank = us === 0 ? rankOf(to) : 5 - rankOf(to);
    return { pawn: piece === PAWN, piece: piece !== PAWN && piece !== KING, contact: capture || check || contact, backRanks: relRank <= 1 };
  };
  const sigOf: Record<string, (f: ReturnType<typeof feat>) => boolean> = { aggressive: f => f.pawn, tactical: f => f.contact, positional: f => f.piece, defensive: f => f.backRanks, endgame: f => f.pawn };
  const behaviour: Record<string, unknown> = {};
  for (const st of STYLES) {
    const walks: { n: number; dis: number; sStyle: number; sUni: number }[] = [];
    for (let w = 0; w < WALKS; w++) {
      const pos = Position.fromFen(START);
      const styleSide = w % 2;
      const rng = mulberry32(9000 + w);
      const rec = { n: 0, dis: 0, sStyle: 0, sUni: 0 };
      for (let ply = 0; ply < 6; ply++) {
        const moves = bookMoves(pos);
        if (!moves.length) break;
        let mv: number;
        if (pos.side === styleSide) {
          const pick = repertoireChoice(st, pos, 7 * w + ply) ?? moves[0].move;
          const uni = universal(pos);
          rec.n++; if (pick !== uni) rec.dis++;
          if (sigOf[st](feat(pos, pick))) rec.sStyle++;
          if (sigOf[st](feat(pos, uni))) rec.sUni++;
          mv = pick;
        } else mv = moves[Math.floor((rng() / 4294967296) * moves.length)].move;
        pos.makeMove(mv);
      }
      walks.push(rec);
    }
    const agg = (ws: typeof walks) => { const n = ws.reduce((a, x) => a + x.n, 0); return { n, dis: ws.reduce((a, x) => a + x.dis, 0) / n, delta: (ws.reduce((a, x) => a + x.sStyle, 0) - ws.reduce((a, x) => a + x.sUni, 0)) / n, rate: ws.reduce((a, x) => a + x.sStyle, 0) / n, base: ws.reduce((a, x) => a + x.sUni, 0) / n }; };
    const a = agg(walks);
    let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const boots: number[] = [];
    for (let b = 0; b < 1000; b++) boots.push(agg(Array.from({ length: walks.length }, () => walks[Math.floor(rnd() * walks.length)])).delta);
    boots.sort((x, y) => x - y);
    behaviour[st] = { decisions: a.n, disagreement: +a.dis.toFixed(3), signatureRate: +a.rate.toFixed(3), universalRate: +a.base.toFixed(3), signatureDelta: +a.delta.toFixed(3), deltaCI: [+boots[25].toFixed(3), +boots[974].toFixed(3)] };
    console.log(st, JSON.stringify(behaviour[st]));
  }
  void moveToCcn;
  // strength parity (worker pool)
  const n = Math.max(1, os.cpus().length);
  const jobs: { style: string; white: boolean; i: number }[] = [];
  for (const st of STYLES) for (let i = 0; i < PAIRS; i++) { jobs.push({ style: st, white: true, i }); jobs.push({ style: st, white: false, i }); }
  const results: { style: string; white: boolean; i: number; result: string }[] = [];
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise<void>((res, rej) => {
    const w = new Worker(new URL('./boot.mjs', import.meta.url), { workerData: jobs.filter((_, i) => i % n === k) });
    w.on('message', (m: typeof results) => { results.push(...m); res(); }); w.on('error', rej);
  })));
  const out: Record<string, unknown> = {};
  const validated: string[] = [];
  for (const st of STYLES) {
    const sc = (r?: { white: boolean; result: string }) => (!r || r.result === '1/2-1/2' || r.result === '*' ? 0.5 : (r.result === '1-0') === r.white ? 1 : 0);
    const pairScores = Array.from({ length: PAIRS }, (_, i) => (sc(results.find(r => r.style === st && r.white && r.i === i)) + sc(results.find(r => r.style === st && !r.white && r.i === i))) / 2);
    const mean = pairScores.reduce((a, b) => a + b, 0) / PAIRS;
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const boots: number[] = [];
    for (let b = 0; b < 2000; b++) { let t = 0; for (let k = 0; k < PAIRS; k++) t += pairScores[Math.floor(rnd() * PAIRS)]; boots.push(t / PAIRS); }
    boots.sort((a, b) => a - b);
    const elo = (p: number) => -400 * Math.log10(1 / Math.min(Math.max(p, 0.001), 0.999) - 1);
    const strength = { games: PAIRS * 2, nodes: PARITY_NODES, score: +mean.toFixed(3), elo: Math.round(elo(mean)), eloCI: [Math.round(elo(boots[50])), Math.round(elo(boots[1949]))] };
    const b = behaviour[st] as { disagreement: number; signatureDelta: number; deltaCI: number[] };
    const behaviourPass = st !== 'endgame' && b.disagreement >= 0.2 && b.signatureDelta >= 0.1 && b.deltaCI[0] > 0;
    const strengthPass = Math.abs(strength.elo) <= 100 && strength.eloCI[0] <= 100 && strength.eloCI[1] >= -100;
    if (behaviourPass && strengthPass) validated.push(st);
    out[st] = { behaviour: b, strength, behaviourPass, strengthPass, pass: behaviourPass && strengthPass };
    console.log(st, JSON.stringify(out[st]));
  }
  writeFileSync(new URL('../../src/engine/styles-validation.json', import.meta.url), JSON.stringify({ id: `styles-3-${new Date().toISOString().slice(0, 10)}`, policy: 'crown-styles-3 (opening repertoire)', repertoire: REPERTOIRE_ID, method: 'tools/styles/validate.ts header', walks: WALKS, validated, results: out }, null, 1));
  process.exit(0);
} else {
  const { Position } = await import('../../src/rules/position');
  const { automaticOutcome, claimableDraws } = await import('../../src/rules/adjudication');
  const { Searcher } = await import('../../src/engine/search');
  const { chooseMove } = await import('../../src/engine/levels');
  const jobs = workerData as { style: string; white: boolean; i: number }[];
  const prof = { level: 0, id: 'v', name: 'v', depth: 64, nodes: PARITY_NODES, maxTimeMs: 60_000, selection: null, description: '' };
  const out: unknown[] = [];
  for (const j of jobs) {
    const sw = new Searcher(16), sb = new Searcher(16);
    const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    let result = '*';
    for (let ply = 0; ply < 300; ply++) {
      const o = automaticOutcome(p); if (o) { result = o.result; break; }
      const c = claimableDraws(p); if (c.threefold || c.fiftyMove) { result = '1/2-1/2'; break; }
      const styleToMove = (p.side === 0) === j.white;
      const r = chooseMove(p.side === 0 ? sw : sb, p, prof, j.i * 1000 + ply, undefined, undefined, (styleToMove ? j.style : 'universal') as never);
      p.makeMove(r.move);
    }
    out.push({ style: j.style, white: j.white, i: j.i, result });
  }
  parentPort!.postMessage(out);
}
