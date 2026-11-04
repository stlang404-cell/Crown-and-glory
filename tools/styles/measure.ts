/**
 * Full-game style measurement (crown-style-validation-4) for crown-styles-5 (src/engine/styles.ts STYLE_EVAL).
 * Every style is measured with its complete play policy (chooseMove: repertoire where validated + styled
 * evaluation + contempt) against the Universal engine at an equal node budget.
 *
 *  (a) decisions: DECISIONS middlegame positions from tools/bench/tune/positions.json (one per source game,
 *      phase 10–18, fullmove ≥ 6, ≥ 2 legal moves). Styled side and Universal each search NODES nodes with fresh
 *      tables; we record how often the chosen move differs and the style's signature rate vs Universal's.
 *  (b) games: PAIRS colour-swapped games per style vs Universal from tools/bench/openings-4ply.json (first PAIRS
 *      lines), NODES nodes per move, plus one Universal-vs-Universal reference game per opening. Per game:
 *      length, result, ply at which both queens are off, styled/universal captures, checks, promotions, attacks
 *      on the enemy king zone after each own move, and enemy attacks on the own king zone.
 *  (c) strength: score vs Universal with a 95 % bootstrap interval over colour-swapped pairs, as Elo.
 *
 *   npx tsx tools/styles/measure.ts decisions            # (a), writes tools/styles/results/decisions.json
 *   npx tsx tools/styles/measure.ts games [style ...]    # (b)+(c), writes tools/styles/results/games-<style>.json
 *   npx tsx tools/styles/measure.ts summary [--write]    # tables; --write updates src/engine/styles-validation.json
 * crown-styles-6 (v0.10): new styles (gambiteer, materialist, complicator), new per-side statistics (behind / ahead on
 *   material after own moves, pieces at ply 40, pawns at ply 30), and `summary --write` needs TAG2K (the tag of the
 *   2 000-node summary) because the strength rule must hold at both budgets. EXTRA=name,… summarises pilot-only
 *   variants defined through DEFS. crown-styles-6 run: TAG=s6 (decisions, 8k games) and TAG=s6-n2k (NODES=2000).
 * Env: NODES (8000), PAIRS (100), DECISIONS (300), THREADS (2), DEFS (JSON STYLE_EVAL overrides, pilot only),
 *      TAG (suffix for result files, pilot only), OFFSET (first opening line; pilots used 200+ so the measured
 *      openings 0–99 were never used for choosing magnitudes).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

/** crown-styles-5 styles plus the crown-styles-6 candidates (docs/STYLES_REPORT.md §8). */
const STYLES = ['tactical', 'positional', 'aggressive', 'defensive', 'endgame', 'gambiteer', 'materialist', 'complicator'] as const;
const NODES = +(process.env.NODES ?? 8000), PAIRS = +(process.env.PAIRS ?? 100), DECISIONS = +(process.env.DECISIONS ?? 300);
const THREADS = +(process.env.THREADS ?? 2);
/** First opening line used (pilot runs use lines 200+, the measurement uses lines 0 … PAIRS−1). */
const OFFSET = +(process.env.OFFSET ?? 0);
const TAG = process.env.TAG ? `-${process.env.TAG}` : '';
const OUT = new URL('./results/', import.meta.url);
const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

async function applyDefs() {
  if (!process.env.DEFS) return;
  const { STYLE_EVAL } = await import('../../src/engine/styles');
  Object.assign(STYLE_EVAL, JSON.parse(process.env.DEFS));
}

async function tools() {
  const { Position } = await import('../../src/rules/position');
  const { KING_TARGETS, KNIGHT_TARGETS, RAYS, PAWN_ATTACKS } = await import('../../src/rules/tables');
  type P = InstanceType<typeof Position>;
  const attackMap = (pos: P, color: number): Int8Array => {
    const a = new Int8Array(36), b = pos.board;
    for (let sq = 0; sq < 36; sq++) {
      const p = b[sq];
      if (!p || (p >> 3) !== color) continue;
      const t = p & 7;
      if (t === 1) { for (const s of PAWN_ATTACKS[color][sq]) a[s]++; }
      else if (t === 2) { for (const s of KNIGHT_TARGETS[sq]) a[s]++; }
      else if (t === 5) { for (const s of KING_TARGETS[sq]) a[s]++; }
      else { const dEnd = t === 3 ? 4 : 8; for (let d = 0; d < dEnd; d++) for (const s of RAYS[sq][d]) { a[s]++; if (b[s]) break; } }
    }
    return a;
  };
  const pieceAttacks = (b: Int8Array, sq: number): number[] => {
    const p = b[sq], t = p & 7, c = p >> 3;
    if (t === 1) return [...PAWN_ATTACKS[c][sq]];
    if (t === 2) return [...KNIGHT_TARGETS[sq]];
    if (t === 5) return [...KING_TARGETS[sq]];
    const out: number[] = []; const dEnd = t === 3 ? 4 : 8;
    for (let d = 0; d < dEnd; d++) for (const s of RAYS[sq][d]) { out.push(s); if (b[s]) break; }
    return out;
  };
  /** Attacks by `attacker` on the king zone (king square + neighbours) of the other side. */
  const zoneAttacks = (pos: P, attacker: number) => { const a = attackMap(pos, attacker), k = pos.kingSq[attacker ^ 1]; return [k, ...KING_TARGETS[k]].reduce((t, s) => t + a[s], 0); };
  const passed = (pos: P, sq: number, c: number) => {
    const f = sq % 6, r = (sq / 6) | 0, ep = 1 | ((c ^ 1) << 3);
    for (let df = -1; df <= 1; df++) { const nf = f + df; if (nf < 0 || nf > 5) continue; if (c === 0) { for (let nr = r + 1; nr < 6; nr++) if (pos.board[nr * 6 + nf] === ep) return false; } else { for (let nr = r - 1; nr >= 0; nr--) if (pos.board[nr * 6 + nf] === ep) return false; } }
    return true;
  };
  const hasQueen = (pos: P, c: number) => { for (let s = 0; s < 36; s++) if (pos.board[s] === (4 | (c << 3))) return true; return false; };
  /** Features of move m in pos (from the mover's view). */
  const feat = (pos: P, m: number) => {
    const us = pos.side, from = m & 63, to = (m >> 6) & 63;
    const piece = pos.board[from] & 7, victim = pos.board[to] & 7;
    const promo = (m >> 12) & 7;
    const myZoneBefore = zoneAttacks(pos, us), enemyOnMeBefore = zoneAttacks(pos, us ^ 1);
    const defBefore = KING_TARGETS[pos.kingSq[us]].filter(s => pos.board[s] && (pos.board[s] >> 3) === us).length;
    const passedPush = piece === 1 && passed(pos, from, us);
    let count0 = 0; for (let s = 0; s < 36; s++) if (pos.board[s]) count0++;
    const q = pos.clone(); q.makeMove(m);
    let count1 = 0; for (let s = 0; s < 36; s++) if (q.board[s]) count1++;
    const capture = count1 < count0;
    const check = q.inCheck();
    let hits = false;
    for (const s of pieceAttacks(q.board, to)) { const x = q.board[s]; if (x && (x >> 3) !== us && (x & 7) !== 5) hits = true; }
    const myZoneAfter = zoneAttacks(q, us), enemyOnMeAfter = zoneAttacks(q, us ^ 1);
    const defAfter = KING_TARGETS[q.kingSq[us]].filter(s => q.board[s] && (q.board[s] >> 3) === us).length;
    const contact = capture || check || hits;
    return {
      capture, check, promo: promo !== 0, zoneAfter: myZoneAfter, enemyZoneAfter: enemyOnMeAfter,
      sig: {
        contact, quiet: !contact,
        kingPressure: myZoneAfter > myZoneBefore,
        safety: enemyOnMeAfter < enemyOnMeBefore || defAfter > defBefore,
        simplify: (capture && victim !== 1 && victim !== 0) || passedPush,
        queenTrade: victim === 4,
        capture,
      },
    };
  };
  return { feat, hasQueen, zoneAttacks };
}

const SIG: Record<string, 'contact' | 'quiet' | 'kingPressure' | 'safety' | 'simplify' | 'capture'> = { tactical: 'contact', positional: 'quiet', aggressive: 'kingPressure', defensive: 'safety', endgame: 'simplify', gambiteer: 'quiet', materialist: 'capture', complicator: 'contact' };
const profile = () => ({ level: 0, id: 'measure', name: 'measure', depth: 64, nodes: NODES, maxTimeMs: 600_000, selection: null, description: '' });

function boot(task: 'decisions' | 'games', jobs: unknown[]): Promise<unknown[]> {
  const out: unknown[] = [];
  const n = Math.max(1, Math.min(THREADS, jobs.length));
  return Promise.all(Array.from({ length: n }, (_, k) => new Promise<void>((res, rej) => {
    const w = new Worker(new URL('./boot_measure.mjs', import.meta.url), { workerData: { task, jobs: jobs.filter((_, i) => i % n === k) } });
    w.on('message', (m: unknown[]) => { out.push(...m); res(); }); w.on('error', rej);
  }))).then(() => out);
}

async function decisionPositions(): Promise<{ fen: string; game: string }[]> {
  const { Position } = await import('../../src/rules/position');
  const { phaseOf } = await import('../../src/engine/eval4');
  const data = JSON.parse(readFileSync(new URL('../bench/tune/positions.json', import.meta.url), 'utf8')) as { positions: { fen: string; game: string }[] };
  const seen = new Set<string>(), all: { fen: string; game: string }[] = [];
  for (const x of data.positions) {
    if (seen.has(x.game)) continue;
    const p = Position.fromFen(x.fen);
    const full = +x.fen.split(' ')[5];
    const ph = phaseOf(p);
    if (full < 6 || ph < 10 || ph > 18 || p.inCheck() || p.legalMoves().length < 2) continue;
    seen.add(x.game); all.push({ fen: x.fen, game: x.game });
  }
  // evenly spaced over the corpus (deterministic)
  const step = all.length / DECISIONS;
  // DEC_PART=1 takes the positions half-way between the measured ones (pilot set for choosing magnitudes)
  const shift = process.env.DEC_PART === '1' ? step / 2 : 0;
  return Array.from({ length: Math.min(DECISIONS, all.length) }, (_, i) => all[Math.floor(i * step + shift)]);
}

function eloOf(p: number) { return -400 * Math.log10(1 / Math.min(Math.max(p, 0.001), 0.999) - 1); }

/** Per side. behind/ahead (crown-styles-6): own moves after which the side's material (P 1, N 3, R 5, Q 9) is at
 * least one pawn below / above the opponent's. */
type Side = { moves: number; captures: number; checks: number; promos: number; zone: number; enemyZone: number; behind?: number; ahead?: number };
/** piecesAt40 (crown-styles-6): knights, rooks and queens of both sides on the board after ply 40 (or at the end);
 * pawnsAt30: [styled, Universal] pawns after ply 30 (or at the end). */
type Game = { style: string; white: boolean; i: number; result: string; plies: number; queensOffPly: number | null; styledQueenLostPly: number | null; styled: Side; uni: Side; piecesAt40?: number; pawnsAt30?: [number, number] };

async function summarise(write: boolean) {
  const rd = (f: string) => existsSync(new URL(f, OUT)) ? JSON.parse(readFileSync(new URL(f, OUT), 'utf8')) : null;
  const dec = rd(`decisions${TAG}.json`) as Record<string, { positions: number; disagreement: number; signature: string; styleRate: number; universalRate: number }> | null;
  const ref = (rd(`games-universal${TAG}.json`) ?? []) as Game[];
  const agg = (gs: Game[], k: 'styled' | 'uni') => {
    const s = gs.reduce((a, g) => ({ moves: a.moves + g[k].moves, captures: a.captures + g[k].captures, checks: a.checks + g[k].checks, promos: a.promos + g[k].promos, zone: a.zone + g[k].zone, enemyZone: a.enemyZone + g[k].enemyZone, behind: a.behind + (g[k].behind ?? 0), ahead: a.ahead + (g[k].ahead ?? 0) }), { moves: 0, captures: 0, checks: 0, promos: 0, zone: 0, enemyZone: 0, behind: 0, ahead: 0 });
    const n = gs.length || 1;
    return { capturesPerGame: +(s.captures / n).toFixed(2), checksPerGame: +(s.checks / n).toFixed(2), promosPerGame: +(s.promos / n).toFixed(2), kingZoneAttacksPerMove: +(s.zone / (s.moves || 1)).toFixed(3), attacksSufferedPerMove: +(s.enemyZone / (s.moves || 1)).toFixed(3), behindRate: +(s.behind / (s.moves || 1)).toFixed(3), aheadRate: +(s.ahead / (s.moves || 1)).toFixed(3) };
  };
  const gameStats = (gs: Game[]) => {
    const q = gs.map(g => g.queensOffPly ?? g.plies);
    return { games: gs.length, avgPlies: +(gs.reduce((a, g) => a + g.plies, 0) / (gs.length || 1)).toFixed(1), piecesAt40: +(gs.reduce((a, g) => a + (g.piecesAt40 ?? 0), 0) / (gs.length || 1)).toFixed(2), styledPawnsAt30: +(gs.reduce((a, g) => a + (g.pawnsAt30?.[0] ?? 0), 0) / (gs.length || 1)).toFixed(2), universalPawnsAt30: +(gs.reduce((a, g) => a + (g.pawnsAt30?.[1] ?? 0), 0) / (gs.length || 1)).toFixed(2), drawRate: +(gs.filter(g => g.result === '1/2-1/2' || g.result === '*').length / (gs.length || 1)).toFixed(3), queensOffRate: +(gs.filter(g => g.queensOffPly !== null).length / (gs.length || 1)).toFixed(3), medianQueensOffPly: q.sort((a, b) => a - b)[Math.floor(q.length / 2)] ?? null };
  };
  const out: Record<string, unknown> = {};
  // reference: Universal vs Universal (each game counts for both colours: 'styled' = White there)
  const refSides = { ...agg(ref, 'styled') };
  const refUni = agg(ref, 'uni');
  const refAvg = Object.fromEntries(Object.entries(refSides).map(([k, v]) => [k, +((v + (refUni as Record<string, number>)[k]) / 2).toFixed(3)]));
  out.universal = { games: gameStats(ref), side: refAvg };
  const fullGame: string[] = [];
  // EXTRA: pilot-only variant names defined through DEFS (never written to the validation file)
  for (const st of [...STYLES, ...(process.env.EXTRA ? process.env.EXTRA.split(',') : [])] as string[]) {
    const gs = rd(`games-${st}${TAG}.json`) as Game[] | null;
    if (!gs) continue;
    const sc = (g?: Game) => (!g || g.result === '1/2-1/2' || g.result === '*' ? 0.5 : (g.result === '1-0') === g.white ? 1 : 0);
    const idx = [...new Set(gs.map(g => g.i))];
    const pairScores = idx.map(i => (sc(gs.find(g => g.white && g.i === i)) + sc(gs.find(g => !g.white && g.i === i))) / 2);
    const mean = pairScores.reduce((a, b) => a + b, 0) / pairScores.length;
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const boots: number[] = [];
    for (let b = 0; b < 4000; b++) { let t = 0; for (let k = 0; k < pairScores.length; k++) t += pairScores[Math.floor(rnd() * pairScores.length)]; boots.push(t / pairScores.length); }
    boots.sort((a, b) => a - b);
    const W = gs.filter(g => sc(g) === 1).length, D = gs.filter(g => sc(g) === 0.5).length, L = gs.length - W - D;
    const strength = { games: gs.length, nodes: NODES, wdl: [W, D, L], score: +mean.toFixed(3), elo: Math.round(eloOf(mean)), eloCI: [Math.round(eloOf(boots[100])), Math.round(eloOf(boots[3899]))] };
    const strengthPass = Math.abs(strength.elo) <= 50 && strength.eloCI[0] <= 50 && strength.eloCI[1] >= -50;
    const g = gameStats(gs), me = agg(gs, 'styled'), them = agg(gs, 'uni'), rg = gameStats(ref);
    // intended direction (fixed before the measurement run; docs/STYLES_REPORT.md)
    const direction: Record<string, [string, boolean][]> = {
      tactical: [['captures+checks above the Universal side', me.capturesPerGame + me.checksPerGame > them.capturesPerGame + them.checksPerGame]],
      positional: [['fewer checks than the Universal side', me.checksPerGame < them.checksPerGame]],
      // crown-styles-6 (refined before measuring, docs/STYLES_REPORT.md §8.2): checks are compared with a side in
      // Universal self-play, not with the opponent's checks
      aggressive: [['more king-zone attacks than the Universal side', me.kingZoneAttacksPerMove > them.kingZoneAttacksPerMove], ['fewer draws than Universal self-play', g.drawRate < rg.drawRate], ['more checks than a side in Universal self-play', me.checksPerGame > (out.universal as { side: { checksPerGame: number } }).side.checksPerGame]],
      gambiteer: [['behind on material after more of its moves than the Universal side', me.behindRate > them.behindRate], ['more king-zone attacks than the Universal side', me.kingZoneAttacksPerMove > them.kingZoneAttacksPerMove]],
      materialist: [['behind on material after fewer of its moves than the Universal side', me.behindRate < them.behindRate], ['ahead on material after more of its moves than the Universal side', me.aheadRate > them.aheadRate]],
      complicator: [['more knights/rooks/queens at ply 40 than in Universal self-play', g.piecesAt40 > rg.piecesAt40], ['queens off later than in Universal self-play (median ply)', (g.medianQueensOffPly ?? 999) > (rg.medianQueensOffPly ?? 999)], ['fewer draws than Universal self-play', g.drawRate < rg.drawRate]],
      defensive: [['fewer attacks suffered than the Universal side', me.attacksSufferedPerMove < them.attacksSufferedPerMove], ['more draws than Universal self-play', g.drawRate > rg.drawRate]],
      endgame: [['queens off earlier than in Universal self-play (median ply)', (g.medianQueensOffPly ?? 999) < (rg.medianQueensOffPly ?? 999)]],
    };
    const dirs = direction[st] ?? [];
    const checks = Object.fromEntries(dirs.map(([k, v]) => [k, v]));
    const directionPass = dirs.length > 0 && dirs.every(([, v]) => v);
    const decisionPass = (dec?.[st]?.disagreement ?? 0) >= 0.1;
    out[st] = { decisions: dec?.[st] ?? null, games: g, styledSide: me, universalSide: them, strength, direction: checks, decisionPass, directionPass, strengthPass, pass: decisionPass && directionPass && strengthPass };
    console.log(st, JSON.stringify(out[st]));
    if (decisionPass && directionPass && strengthPass && (STYLES as readonly string[]).includes(st)) fullGame.push(st);
  }
  console.log('universal', JSON.stringify(out.universal));
  writeFileSync(new URL(`summary${TAG}.json`, OUT), JSON.stringify(out, null, 1));
  if (write) {
    const vf = new URL('../../src/engine/styles-validation.json', import.meta.url);
    const prev = JSON.parse(readFileSync(vf, 'utf8'));
    const repertoireStyles: string[] = prev.repertoireStyles ?? prev.validated;
    const { STYLE_EVAL, STYLES_EVAL_ID } = await import('../../src/engine/styles');
    // crown-styles-6: the strength rule also holds at the 2 000-node budget (TAG2K = tag of that run's summary)
    const s2 = process.env.TAG2K ? rd(`summary-${process.env.TAG2K}.json`) as Record<string, { strengthPass: boolean }> | null : null;
    if (!s2) throw new Error('summary --write needs TAG2K (the 2 000-node summary) for the strength rule at both budgets');
    for (let k = fullGame.length - 1; k >= 0; k--) if (!s2[fullGame[k]]?.strengthPass) fullGame.splice(k, 1);
    writeFileSync(vf, JSON.stringify({
      ...prev, id: `styles-6-${new Date().toISOString().slice(0, 10)}`, validated: [...new Set([...repertoireStyles, ...fullGame])], repertoireStyles, fullGame,
      fullGamePolicy: `${STYLES_EVAL_ID} (asymmetric evaluation + contempt; src/engine/styles.ts STYLE_EVAL)`, fullGameMethod: 'tools/styles/measure.ts header; docs/STYLES_REPORT.md',
      fullGameRule: 'decision disagreement >= 10% on middlegame positions AND every pre-registered game-characteristic direction holds (8 000 nodes) AND Elo vs Universal within +-50 (point) with the 95% interval overlapping [-50, 50] at 8 000 and at 2 000 nodes',
      fullGameDefs: STYLE_EVAL, fullGameResults: out, fullGameResults2k: s2,
    }, null, 1));
    console.log('wrote', vf.pathname, 'fullGame =', fullGame);
  }
}

if (isMainThread) {
  mkdirSync(OUT, { recursive: true });
  const cmd = process.argv[2];
  if (cmd === 'decisions') {
    const positions = await decisionPositions();
    const jobs = positions.map((x, i) => ({ ...x, i }));
    const rows = (await boot('decisions', jobs)) as { i: number; uni: number; styles: Record<string, { move: number; sig: boolean; sigU: boolean; dis: boolean }> }[];
    const res: Record<string, unknown> = {};
    for (const st of STYLES) {
      const r = rows.map(x => x.styles[st]);
      res[st] = { positions: r.length, nodes: NODES, disagreement: +(r.filter(x => x.dis).length / r.length).toFixed(3), signature: SIG[st], styleRate: +(r.filter(x => x.sig).length / r.length).toFixed(3), universalRate: +(r.filter(x => x.sigU).length / r.length).toFixed(3) };
      console.log(st, JSON.stringify(res[st]));
    }
    writeFileSync(new URL(`decisions${TAG}.json`, OUT), JSON.stringify(res, null, 1));
  } else if (cmd === 'games') {
    const openings = (JSON.parse(readFileSync(new URL('../bench/openings-4ply.json', import.meta.url), 'utf8')).openings as string[][]).slice(OFFSET, OFFSET + PAIRS);
    const styles = process.argv.slice(3).length ? process.argv.slice(3) : [...STYLES, 'universal'];
    for (const st of styles) {
      const jobs: { style: string; white: boolean; i: number; opening: string[] }[] = [];
      openings.forEach((op, i) => { jobs.push({ style: st, white: true, i, opening: op }); if (st !== 'universal') jobs.push({ style: st, white: false, i, opening: op }); });
      const t0 = Date.now();
      const games = await boot('games', jobs);
      writeFileSync(new URL(`games-${st}${TAG}.json`, OUT), JSON.stringify(games));
      console.log(st, games.length, 'games', Math.round((Date.now() - t0) / 1000), 's');
    }
    await summarise(false);
  } else if (cmd === 'summary') {
    await summarise(process.argv.includes('--write'));
  } else {
    console.log('usage: decisions | games [style ...] | summary [--write]');
  }
  process.exit(0);
} else {
  await applyDefs();
  const { Position } = await import('../../src/rules/position');
  const { parseLegalCcn } = await import('../../src/rules/notation');
  const { automaticOutcome, claimableDraws } = await import('../../src/rules/adjudication');
  const { Searcher } = await import('../../src/engine/search');
  const { chooseMove } = await import('../../src/engine/levels');
  const { feat, hasQueen } = await tools();
  const { task, jobs } = workerData as { task: string; jobs: unknown[] };
  const out: unknown[] = [];
  const prof = profile();
  if (task === 'decisions') {
    const s = new Searcher(16);
    for (const j of jobs as { fen: string; i: number }[]) {
      const p = Position.fromFen(j.fen);
      s.newGame();
      const u = chooseMove(s, p, prof, j.i).move;
      const fu = feat(p, u).sig;
      const styles: Record<string, unknown> = {};
      for (const st of STYLES) {
        s.newGame();
        const m = chooseMove(s, p, prof, j.i, undefined, undefined, st, true).move;
        if (!p.legalMoves().includes(m)) throw new Error('illegal styled move');
        styles[st] = { move: m, dis: m !== u, sig: feat(p, m).sig[SIG[st]], sigU: fu[SIG[st]] };
      }
      out.push({ i: j.i, uni: u, styles });
    }
  } else {
    for (const j of jobs as { style: string; white: boolean; i: number; opening: string[] }[]) {
      const sw = new Searcher(16), sb = new Searcher(16);
      const p = Position.fromFen(START);
      for (const m of j.opening) p.makeMove(parseLegalCcn(p, m));
      let result = '*', plies = j.opening.length, queensOffPly: number | null = null, styledQueenLostPly: number | null = null;
      const styledColor = j.white ? 0 : 1;
      const side = (): Side => ({ moves: 0, captures: 0, checks: 0, promos: 0, zone: 0, enemyZone: 0, behind: 0, ahead: 0 });
      const VAL = [0, 1, 3, 5, 9, 0];
      const mat = (c: number) => { let t = 0; for (let s = 0; s < 36; s++) { const x = p.board[s]; if (x && (x >> 3) === c) t += VAL[x & 7]; } return t; };
      const pieces = () => { let t = 0; for (let s = 0; s < 36; s++) { const x = p.board[s] & 7; if (x >= 2 && x <= 4) t++; } return t; };
      let piecesAt40: number | null = null, pawnsAt30: [number, number] | null = null;
      const pawns = (c: number) => { let t = 0; for (let s = 0; s < 36; s++) if (p.board[s] === (1 | (c << 3))) t++; return t; };
      const styled = side(), uni = side();
      for (let ply = j.opening.length; ply < 400; ply++) {
        const o = automaticOutcome(p); if (o) { result = o.result; break; }
        const c = claimableDraws(p); if (c.threefold || c.fiftyMove) { result = '1/2-1/2'; break; }
        const styleToMove = p.side === styledColor;
        const st = styleToMove ? j.style : 'universal';
        const r = chooseMove(p.side === 0 ? sw : sb, p, prof, (j.i * 1000 + ply) >>> 0, undefined, undefined, st as never, styleToMove && st !== 'universal' ? true : undefined);
        if (!p.legalMoves().includes(r.move)) throw new Error('illegal move');
        const f = feat(p, r.move);
        const t = styleToMove ? styled : uni;
        t.moves++; if (f.capture) t.captures++; if (f.check) t.checks++; if (f.promo) t.promos++; t.zone += f.zoneAfter; t.enemyZone += f.enemyZoneAfter;
        p.makeMove(r.move);
        plies = ply + 1;
        const bal = mat(p.side ^ 1) - mat(p.side);
        if (bal <= -1) t.behind!++; else if (bal >= 1) t.ahead!++;
        if (plies === 40) piecesAt40 = pieces();
        if (plies === 30) pawnsAt30 = [pawns(styledColor), pawns(styledColor ^ 1)];
        if (queensOffPly === null && !hasQueen(p, 0) && !hasQueen(p, 1)) queensOffPly = plies;
        if (styledQueenLostPly === null && !hasQueen(p, styledColor)) styledQueenLostPly = plies;
      }
      out.push({ style: j.style, white: j.white, i: j.i, result, plies, queensOffPly, styledQueenLostPly, styled, uni, piecesAt40: piecesAt40 ?? pieces(), pawnsAt30: pawnsAt30 ?? [pawns(styledColor), pawns(styledColor ^ 1)] } satisfies Game);
    }
  }
  parentPort!.postMessage(out);
}
