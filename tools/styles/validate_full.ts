/**
 * Full-game style validation (crown-style-validation-3) for crown-styles-4: asymmetric evaluation + contempt
 * (src/engine/styles.ts STYLE_EVAL), on top of the opening repertoire for styles whose repertoire passed.
 *
 * (a) Behaviour on a MIDDLEGAME/ENDGAME position suite: positions sampled from recorded benchmark games
 *     (tools/bench/results/suite-ablation-games.json, plies 14–90, every 7th ply). Even-indexed positions form
 *     the PILOT set (used only to choose multipliers, `pilot` command); odd-indexed positions form the
 *     VALIDATION set. At every position the styled side and the universal engine each search NODES nodes
 *     (fresh tables); we record disagreement and the style's signature rate minus the universal rate with
 *     a 95% bootstrap interval (resampling source games).
 *     Signatures (fixed before the run):
 *       tactical   = contact move (capture, check, or the moved piece attacks an enemy non-king piece)
 *       positional = quiet move (not a contact move)
 *       aggressive = the move increases the mover's attacks on the enemy king zone
 *       defensive  = the move reduces the enemy's attacks on the mover's king zone or adds a defender next
 *                    to the mover's king
 *       endgame    = simplifying move (captures a non-pawn piece, or pushes a passed pawn), measured only in
 *                    positions where the mover is ahead by ≥ 100 cp (universal search) and phase ≤ 12
 *     Pass: disagreement ≥ 20% AND Δ ≥ 10 pp AND the interval's lower bound > 0.
 * (b) Strength parity: PAIRS colour-swapped games per style vs universal from tools/bench/openings.json at
 *     PARITY_NODES, full style policy (book where validated + styled evaluation + contempt). Pass: Elo point
 *     estimate within ±100 and its 95% interval overlapping [−100, 100] (the crown-style-validation-2 rule).
 *     Whole-game behaviour from the same games is reported (draw rate, game length, styled side's contact
 *     rate and king-zone pressure vs the universal side's).
 *   npx tsx tools/styles/validate_full.ts pilot '<json STYLE_EVAL overrides>'
 *   npx tsx tools/styles/validate_full.ts validate
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

const STYLES = ['tactical', 'positional', 'aggressive', 'defensive', 'endgame'] as const;
const NODES = 8000, PAIRS = +(process.env.PAIRS ?? 32), PARITY_NODES = 8000;
const SUITE_GAMES = new URL('../bench/results/suite-ablation-games.json', import.meta.url);

async function features() {
  const { Position } = await import('../../src/rules/position');
  const { KING_TARGETS, KNIGHT_TARGETS, RAYS, PAWN_ATTACKS } = await import('../../src/rules/tables');
  type P = InstanceType<typeof Position>;
  /** Attack count of `color` on each square. */
  const attackMap = (pos: P, color: number): Int8Array => {
    const a = new Int8Array(36);
    const b = pos.board;
    for (let sq = 0; sq < 36; sq++) {
      const p = b[sq];
      if (!p || (p >> 3) !== color) continue;
      const t = p & 7;
      if (t === 1) { for (const s of PAWN_ATTACKS[color][sq]) a[s]++; }
      else if (t === 2) { for (const s of KNIGHT_TARGETS[sq]) a[s]++; }
      else if (t === 5) { for (const s of KING_TARGETS[sq]) a[s]++; }
      else {
        const dEnd = t === 3 ? 4 : 8;
        for (let d = 0; d < dEnd; d++) for (const s of RAYS[sq][d]) { a[s]++; if (b[s]) break; }
      }
    }
    return a;
  };
  const pieceAttacks = (b: Int8Array, sq: number): number[] => {
    const p = b[sq], t = p & 7, c = p >> 3;
    if (t === 1) return [...PAWN_ATTACKS[c][sq]];
    if (t === 2) return [...KNIGHT_TARGETS[sq]];
    if (t === 5) return [...KING_TARGETS[sq]];
    const out: number[] = [];
    const dEnd = t === 3 ? 4 : 8;
    for (let d = 0; d < dEnd; d++) for (const s of RAYS[sq][d]) { out.push(s); if (b[s]) break; }
    return out;
  };
  const zone = (k: number) => [k, ...KING_TARGETS[k]];
  const zoneAttacks = (pos: P, attacker: number) => { const a = attackMap(pos, attacker); return zone(pos.kingSq[attacker ^ 1]).reduce((t, s) => t + a[s], 0); };
  const passed = (pos: P, sq: number, c: number) => {
    const f = sq % 6, r = (sq / 6) | 0, ep = 1 | ((c ^ 1) << 3);
    for (let df = -1; df <= 1; df++) { const nf = f + df; if (nf < 0 || nf > 5) continue; if (c === 0) { for (let nr = r + 1; nr < 6; nr++) if (pos.board[nr * 6 + nf] === ep) return false; } else { for (let nr = r - 1; nr >= 0; nr--) if (pos.board[nr * 6 + nf] === ep) return false; } }
    return true;
  };
  return (pos: P, m: number) => {
    const us = pos.side, from = m & 63, to = (m >> 6) & 63;
    const piece = pos.board[from] & 7, victim = pos.board[to] & 7;
    const myZoneBefore = zoneAttacks(pos, us), enemyOnMeBefore = zoneAttacks(pos, us ^ 1);
    const defBefore = KING_TARGETS[pos.kingSq[us]].filter(s => pos.board[s] && (pos.board[s] >> 3) === us).length;
    const passedPush = piece === 1 && passed(pos, from, us);
    const q = pos.clone(); q.makeMove(m);
    const check = q.inCheck();
    // does the moved piece attack an enemy non-king piece from its new square?
    let hits = false;
    for (const s of pieceAttacks(q.board, to)) { const x = q.board[s]; if (x && (x >> 3) !== us && (x & 7) !== 5) hits = true; }
    const myZoneAfter = zoneAttacks(q, us), enemyOnMeAfter = zoneAttacks(q, us ^ 1);
    const defAfter = KING_TARGETS[q.kingSq[us]].filter(s => q.board[s] && (q.board[s] >> 3) === us).length;
    const contact = victim !== 0 || check || hits;
    return {
      contact, quiet: !contact,
      kingPressure: myZoneAfter > myZoneBefore,
      safety: enemyOnMeAfter < enemyOnMeBefore || defAfter > defBefore,
      simplify: (victim !== 0 && victim !== 1) || passedPush,
    };
  };
}

const SIG: Record<string, 'contact' | 'quiet' | 'kingPressure' | 'safety' | 'simplify'> = { tactical: 'contact', positional: 'quiet', aggressive: 'kingPressure', defensive: 'safety', endgame: 'simplify' };

async function suite(part: 0 | 1) {
  const { Position } = await import('../../src/rules/position');
  const { parseLegalCcn } = await import('../../src/rules/notation');
  const data = JSON.parse(readFileSync(SUITE_GAMES, 'utf8')) as Record<string, { moves: string[] }[]>;
  const out: { fen: string; game: number }[] = [];
  let gi = 0, k = 0;
  for (const list of Object.values(data)) for (const g of list) {
    gi++;
    const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    for (let i = 0; i < g.moves.length && i < 90; i++) {
      p.makeMove(parseLegalCcn(p, g.moves[i]));
      if (i + 1 >= 14 && (i + 1) % 7 === 0 && p.legalMoves().length > 1) { if (k++ % 2 === part) out.push({ fen: p.toFen(), game: gi }); }
    }
  }
  return out;
}

async function behaviour(part: 0 | 1, defs: Record<string, unknown> | undefined, limit: number) {
  const { Position } = await import('../../src/rules/position');
  const { Searcher, PLAY_FEATURES } = await import('../../src/engine/search');
  const { PLAY_WEIGHTS } = await import('../../src/engine/evaluate');
  const { styledWeights, STYLE_EVAL } = await import('../../src/engine/styles');
  const { phaseOf } = await import('../../src/engine/eval4');
  const feat = await features();
  const positions = (await suite(part)).slice(0, limit);
  const s = new Searcher(16);
  const uni = positions.map(x => { const p = Position.fromFen(x.fen); s.newGame(); const r = s.search(p, { limits: { nodes: NODES }, weights: PLAY_WEIGHTS, features: PLAY_FEATURES }); return { move: r.bestMove, score: r.score }; });
  const res: Record<string, unknown> = {};
  for (const st of STYLES) {
    const sw = styledWeights(st, PLAY_WEIGHTS, { ...STYLE_EVAL, ...(defs ?? {}) } as never)!;
    const rows: { game: number; dis: number; sS: number; sU: number }[] = [];
    positions.forEach((x, i) => {
      const p = Position.fromFen(x.fen);
      if (st === 'endgame' && !(uni[i].score >= 100 && phaseOf(p) <= 12)) return;
      s.newGame();
      const r = s.search(p, { limits: { nodes: NODES }, weights: sw.weights, features: PLAY_FEATURES, contempt: sw.contempt });
      const fs = feat(p, r.bestMove)[SIG[st]], fu = feat(p, uni[i].move)[SIG[st]];
      rows.push({ game: x.game, dis: r.bestMove !== uni[i].move ? 1 : 0, sS: fs ? 1 : 0, sU: fu ? 1 : 0 });
    });
    const games = [...new Set(rows.map(r => r.game))];
    const byGame = new Map(games.map(g => [g, rows.filter(r => r.game === g)]));
    const stat = (rs: typeof rows) => ({ n: rs.length, dis: rs.reduce((a, r) => a + r.dis, 0) / rs.length, rate: rs.reduce((a, r) => a + r.sS, 0) / rs.length, base: rs.reduce((a, r) => a + r.sU, 0) / rs.length });
    const a = stat(rows);
    let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const boots: number[] = [];
    for (let b = 0; b < 1000; b++) { const rs = Array.from({ length: games.length }, () => byGame.get(games[Math.floor(rnd() * games.length)])!).flat(); const q = stat(rs); boots.push(q.rate - q.base); }
    boots.sort((x, y) => x - y);
    res[st] = { positions: a.n, disagreement: +a.dis.toFixed(3), signatureRate: +a.rate.toFixed(3), universalRate: +a.base.toFixed(3), signatureDelta: +(a.rate - a.base).toFixed(3), deltaCI: [+boots[25].toFixed(3), +boots[974].toFixed(3)] };
    console.log(st, JSON.stringify(res[st]));
  }
  return res;
}

if (isMainThread) {
  const cmd = process.argv[2];
  if (cmd === 'pilot') {
    const defs = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;
    await behaviour(0, defs, +(process.env.LIMIT ?? 200));
    process.exit(0);
  }
  const beh = await behaviour(1, undefined, +(process.env.LIMIT ?? 400));
  const { buildOpenings } = await import('../bench/openings');
  const openings = (await buildOpenings()).slice(0, PAIRS);
  const jobs: { style: string; white: boolean; i: number; opening: string[] }[] = [];
  for (const st of STYLES) openings.forEach((op, i) => { jobs.push({ style: st, white: true, i, opening: op }); jobs.push({ style: st, white: false, i, opening: op }); });
  const n = +(process.env.THREADS ?? Math.max(1, os.cpus().length - 1));
  const results: { style: string; white: boolean; i: number; result: string; plies: number; styled: { contact: number; pressure: number; moves: number }; uni: { contact: number; pressure: number; moves: number } }[] = [];
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise<void>((res, rej) => {
    const w = new Worker(new URL('./boot_full.mjs', import.meta.url), { workerData: jobs.filter((_, i) => i % n === k) });
    w.on('message', (m: typeof results) => { results.push(...m); res(); }); w.on('error', rej);
  })));
  const prev = JSON.parse(readFileSync(new URL('../../src/engine/styles-validation.json', import.meta.url), 'utf8'));
  const out: Record<string, unknown> = {};
  const fullGame: string[] = [];
  for (const st of STYLES) {
    const sc = (r?: { white: boolean; result: string }) => (!r || r.result === '1/2-1/2' || r.result === '*' ? 0.5 : (r.result === '1-0') === r.white ? 1 : 0);
    const mine = results.filter(r => r.style === st);
    const pairScores = Array.from({ length: PAIRS }, (_, i) => (sc(mine.find(r => r.white && r.i === i)) + sc(mine.find(r => !r.white && r.i === i))) / 2);
    const mean = pairScores.reduce((a, b) => a + b, 0) / PAIRS;
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const boots: number[] = [];
    for (let b = 0; b < 2000; b++) { let t = 0; for (let k = 0; k < PAIRS; k++) t += pairScores[Math.floor(rnd() * PAIRS)]; boots.push(t / PAIRS); }
    boots.sort((a, b) => a - b);
    const elo = (p: number) => -400 * Math.log10(1 / Math.min(Math.max(p, 0.001), 0.999) - 1);
    const W = mine.filter(r => sc(r) === 1).length, D = mine.filter(r => sc(r) === 0.5).length, L = mine.length - W - D;
    const agg = (k: 'styled' | 'uni') => { const m = mine.reduce((a, r) => a + r[k].moves, 0); return { contactRate: +(mine.reduce((a, r) => a + r[k].contact, 0) / m).toFixed(3), kingPressureRate: +(mine.reduce((a, r) => a + r[k].pressure, 0) / m).toFixed(3) }; };
    const strength = { games: mine.length, nodes: PARITY_NODES, wdl: [W, D, L], score: +mean.toFixed(3), elo: Math.round(elo(mean)), eloCI: [Math.round(elo(boots[50])), Math.round(elo(boots[1949]))] };
    const games = { drawRate: +(D / mine.length).toFixed(3), avgPlies: Math.round(mine.reduce((a, r) => a + r.plies, 0) / mine.length), styledSide: agg('styled'), universalSide: agg('uni') };
    const b = beh[st] as { disagreement: number; signatureDelta: number; deltaCI: number[] };
    const behaviourPass = b.disagreement >= 0.2 && b.signatureDelta >= 0.1 && b.deltaCI[0] > 0;
    const strengthPass = Math.abs(strength.elo) <= 100 && strength.eloCI[0] <= 100 && strength.eloCI[1] >= -100;
    if (behaviourPass && strengthPass) fullGame.push(st);
    out[st] = { behaviour: b, strength, games, behaviourPass, strengthPass, pass: behaviourPass && strengthPass };
    console.log(st, JSON.stringify(out[st]));
  }
  const repertoireStyles: string[] = prev.repertoireStyles ?? prev.validated;
  const validated = [...new Set([...repertoireStyles, ...fullGame])];
  writeFileSync(new URL('../../src/engine/styles-validation.json', import.meta.url), JSON.stringify({ ...prev, id: `styles-4-${new Date().toISOString().slice(0, 10)}`, validated, repertoireStyles, fullGame, fullGamePolicy: 'crown-styles-4 (asymmetric evaluation + contempt; src/engine/styles.ts STYLE_EVAL)', fullGameMethod: 'tools/styles/validate_full.ts header', fullGameResults: out }, null, 1));
  process.exit(0);
} else {
  const { Position } = await import('../../src/rules/position');
  const { parseLegalCcn } = await import('../../src/rules/notation');
  const { automaticOutcome, claimableDraws } = await import('../../src/rules/adjudication');
  const { Searcher } = await import('../../src/engine/search');
  const { chooseMove } = await import('../../src/engine/levels');
  const feat = await features();
  const jobs = workerData as { style: string; white: boolean; i: number; opening: string[] }[];
  const prof = { level: 0, id: 'v', name: 'v', depth: 64, nodes: PARITY_NODES, maxTimeMs: 60_000, selection: null, description: '' };
  const out: unknown[] = [];
  for (const j of jobs) {
    const sw = new Searcher(16), sb = new Searcher(16);
    const p = Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1');
    for (const m of j.opening) p.makeMove(parseLegalCcn(p, m));
    let result = '*', plies = j.opening.length;
    const styled = { contact: 0, pressure: 0, moves: 0 }, uni = { contact: 0, pressure: 0, moves: 0 };
    for (let ply = j.opening.length; ply < 300; ply++) {
      const o = automaticOutcome(p); if (o) { result = o.result; break; }
      const c = claimableDraws(p); if (c.threefold || c.fiftyMove) { result = '1/2-1/2'; break; }
      const styleToMove = (p.side === 0) === j.white;
      const r = chooseMove(p.side === 0 ? sw : sb, p, prof, j.i * 1000 + ply, undefined, undefined, (styleToMove ? j.style : 'universal') as never, styleToMove ? true : undefined);
      if (ply >= 12) { const f = feat(p, r.move); const t = styleToMove ? styled : uni; t.moves++; if (f.contact) t.contact++; if (f.kingPressure) t.pressure++; }
      p.makeMove(r.move);
      plies = ply + 1;
    }
    out.push({ style: j.style, white: j.white, i: j.i, result, plies, styled, uni });
  }
  parentPort!.postMessage(out);
}
