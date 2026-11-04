/**
 * The Sovereign's Grimoire — exhaustive endgame solver (retrograde analysis) for crown-la6-v1.
 *
 * Every legal position of a small material class (3 or 4 men on the 6×6 board, either side to move) is generated,
 * its legal moves are produced by the REAL move generator of src/rules (Position.generatePseudo / makeMove /
 * unmakeMove / lastMoveLeftKingInCheck), and won / drawn / lost values with distance to mate (DTM, in plies) are
 * computed backwards from the checkmates (backward induction with a bucket queue: a position is a WIN in d plies when
 * some move reaches a LOSS in d-1, a LOSS in d plies when every move reaches a WIN and the longest of them is d-1).
 *
 * Captures and promotions leave the class: the resulting smaller / different classes are solved first (recursively,
 * memoised), so DTM is measured across promotions ("mate in 20 including the promotion"). The rules model is the
 * game's: checkmate wins, stalemate draws, bare kings (K v K) draw. Repetition and the 100/150-halfmove rules are
 * ignored (as in every DTM tablebase); `stats` reports the longest wins so the book can compare them with 100 halfmoves.
 *
 *   npx tsx tools/grimoire/endgame.ts            solve KQK KRK KNK KNNK KPK KQKR KRKN and print the book's statistics
 *   npx tsx tools/grimoire/endgame.ts --probe "<fen>"   value and DTM of one position (and of every legal move)
 *
 * Library use (tests, check.ts): `probeFen(fen)` and `solve(key)`.
 */
import { Position } from '../../src/rules/position';
import { moveToSan } from '../../src/rules/notation';
import {
  BLACK, EMPTY, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE, type Color, makePiece, rankOf, fileOf,
} from '../../src/rules/types';

export const UNKNOWN = 0, WIN = 1, LOSS = 2, DRAW = 3, INVALID = 255;
const LETTER: Record<string, number> = { Q: QUEEN, R: ROOK, N: KNIGHT, P: PAWN };
const ORDER = [QUEEN, ROOK, KNIGHT, PAWN];
const POW = [1, 36, 1296, 46656, 1679616, 60466176];
const MAX_MEN = 4;

/** One solved material class, e.g. key "KQvKR". `res`/`dtm` are indexed by `index(squares, side)`. */
export interface Table {
  key: string;
  /** piece code per slot: slot 0 = white king, slot 1 = black king, then white non-kings (Q,R,N,P), then black. */
  pieces: number[];
  slotStart: Int8Array; // by piece code (0..15): first slot of that piece kind, -1 if absent
  res: Uint8Array;      // WIN/LOSS/DRAW/INVALID for the side to move
  dtm: Uint16Array;     // plies to mate (WIN: odd, LOSS: even); 0 for draws
}

/** Canonical class key: `K<white pieces>vK<black pieces>`, pieces ordered Q, R, N, P. */
export function canonicalKey(white: string, black: string): string {
  const sort = (s: string) => s.split('').filter(c => c !== 'K').sort((a, b) => ORDER.indexOf(LETTER[a]) - ORDER.indexOf(LETTER[b])).join('');
  return `K${sort(white.toUpperCase())}vK${sort(black.toUpperCase())}`;
}

function piecesOf(key: string): number[] {
  const [w, b] = key.split('v');
  const out = [makePiece(KING, WHITE), makePiece(KING, BLACK)];
  for (const c of w.slice(1)) out.push(makePiece(LETTER[c], WHITE));
  for (const c of b.slice(1)) out.push(makePiece(LETTER[c], BLACK));
  return out;
}

// Material signature of a board (non-king pieces only), 3 bits per piece code → class lookup without strings.
const SIGW = new Int32Array(16);
for (let c = 0; c < 2; c++) for (let t = 1; t <= 4; t++) SIGW[makePiece(t, c as Color)] = 1 << (3 * (c * 4 + t - 1));
function sigOfPieces(pieces: number[]): number { let s = 0; for (const p of pieces) s += SIGW[p]; return s; }
function sigOfBoard(board: Int8Array): number { let s = 0; for (let i = 0; i < 36; i++) s += SIGW[board[i]]; return s; }

const tables = new Map<string, Table>();
const bySig = new Map<number, Table>();
const used = new Int8Array(16);

/** Index of the board in table t (squares of identical pieces in ascending order — the canonical slot order). */
function boardIndex(t: Table, board: Int8Array, side: number): number {
  used.fill(0);
  let idx = 0;
  for (let sq = 0; sq < 36; sq++) {
    const p = board[sq];
    if (p !== EMPTY) idx += sq * POW[t.slotStart[p] + used[p]++];
  }
  return idx * 2 + side;
}

export interface SolveOptions { log?: (msg: string) => void }

/** Solve (or return the memoised) table for a material class key such as "KQvK" or "KRvKN". */
export function solve(keyIn: string, opts: SolveOptions = {}): Table {
  const [w, b] = keyIn.split('v');
  const key = canonicalKey(w, b);
  const hit = tables.get(key);
  if (hit) return hit;
  const pieces = piecesOf(key);
  const n = pieces.length;
  if (n > MAX_MEN) throw new Error(`${key}: at most ${MAX_MEN} men are supported`);
  const slotStart = new Int8Array(16).fill(-1);
  pieces.forEach((p, i) => { if (slotStart[p] < 0) slotStart[p] = i; });
  const size = POW[n] * 2;
  const res = new Uint8Array(size).fill(INVALID);
  const dtm = new Uint16Array(size);
  const t: Table = { key, pieces, slotStart, res, dtm };
  const t0 = Date.now();

  tables.set(key, t);
  bySig.set(sigOfPieces(pieces), t);

  if (n === 2) { // bare kings: every legal position is an automatic draw
    enumerate(t, () => DRAW);
    return t;
  }

  // Pass 1: legal positions and their in-class successor counts; out-of-class successors resolved from sub-tables.
  const pos = new Position();
  const buf: number[] = [];
  const fwdCount = new Uint8Array(size);
  const extWin = new Uint16Array(size).fill(0xffff); // smallest win depth through an exit (child LOSS d → d+1)
  const extLoss = new Uint16Array(size);             // largest loss depth through exits (child WIN d → d+1)
  const extSafe = new Uint8Array(size);              // some exit is not a win for the opponent → never a LOSS
  let edges: Int32Array = new Int32Array(1 << 20);
  let ne = 0;
  const fwdOff = new Int32Array(size + 1);
  const squares = new Int8Array(n);
  const ownSig = sigOfPieces(pieces);

  for (let idx = 0; idx < size; idx++) {
    fwdOff[idx] = ne;
    if (!setup(t, pos, idx, squares)) continue;
    const nm = pos.generatePseudo(buf);
    let legal = 0;
    for (let i = 0; i < nm; i++) {
      pos.makeMove(buf[i]);
      if (!pos.lastMoveLeftKingInCheck()) {
        legal++;
        const sig = sigOfBoard(pos.board);
        if (sig === ownSig) {
          if (ne === edges.length) { const g = new Int32Array(edges.length * 2); g.set(edges); edges = g; }
          edges[ne++] = boardIndex(t, pos.board, pos.side);
          fwdCount[idx]++;
        } else {
          // a capture or promotion left the class: solve that class first (memoised; it uses its own Position)
          const st = bySig.get(sig) ?? solve(keyOfBoard(pos), opts);
          const ci = boardIndex(st, pos.board, pos.side);
          const r = st.res[ci], d = st.dtm[ci];
          if (r === LOSS) { if (d + 1 < extWin[idx]) extWin[idx] = d + 1; }
          else if (r === WIN) { if (d + 1 > extLoss[idx]) extLoss[idx] = d + 1; }
          else extSafe[idx] = 1;
        }
      }
      pos.unmakeMove();
    }
    if (legal === 0) res[idx] = pos.inCheck() ? LOSS : DRAW, dtm[idx] = 0;
    else res[idx] = UNKNOWN;
  }
  fwdOff[size] = ne;

  // Reverse edges (predecessor lists), CSR.
  const revOff = new Int32Array(size + 1);
  for (let e = 0; e < ne; e++) revOff[edges[e] + 1]++;
  for (let i = 0; i < size; i++) revOff[i + 1] += revOff[i];
  const preds = new Int32Array(ne);
  const fill = revOff.slice(0, size);
  for (let idx = 0; idx < size; idx++) for (let e = fwdOff[idx]; e < fwdOff[idx + 1]; e++) preds[fill[edges[e]]++] = idx;
  edges = new Int32Array(0);

  // Bucket queue by depth.
  const buckets: number[][] = [];
  const push = (d: number, idx: number) => { (buckets[d] ??= []).push(idx); };
  const remaining = fwdCount;
  const lossDepth = extLoss;
  for (let idx = 0; idx < size; idx++) {
    const r = res[idx];
    if (r === LOSS) push(0, idx);
    else if (r === UNKNOWN) {
      if (extWin[idx] !== 0xffff) push(extWin[idx], idx);
      if (remaining[idx] === 0 && !extSafe[idx] && extWin[idx] === 0xffff) push(lossDepth[idx], idx); // all exits are opponent wins
    }
  }
  for (let d = 0; d < buckets.length; d++) {
    const bk = buckets[d];
    if (!bk) continue;
    for (let q = 0; q < bk.length; q++) {
      const idx = bk[q];
      let r = res[idx];
      if (r === UNKNOWN) { r = d & 1 ? WIN : LOSS; res[idx] = r; dtm[idx] = d; }
      else if (!(r === LOSS && d === 0 && dtm[idx] === 0)) continue; // already resolved (checkmates enter once at 0)
      if (r === LOSS) {
        for (let e = revOff[idx]; e < revOff[idx + 1]; e++) { const p = preds[e]; if (res[p] === UNKNOWN) push(d + 1, p); }
      } else {
        for (let e = revOff[idx]; e < revOff[idx + 1]; e++) {
          const p = preds[e];
          if (res[p] !== UNKNOWN) continue;
          if (d + 1 > lossDepth[p]) lossDepth[p] = d + 1;
          if (--remaining[p] === 0 && !extSafe[p] && extWin[p] === 0xffff) push(lossDepth[p], p);
        }
      }
    }
    buckets[d] = [];
  }
  for (let idx = 0; idx < size; idx++) if (res[idx] === UNKNOWN) res[idx] = DRAW;
  opts.log?.(`${key}: solved in ${((Date.now() - t0) / 1000).toFixed(1)} s (${ne.toLocaleString('en-US')} in-class moves)`);
  return t;
}

/** Decode slot squares; false when the index is not a legal, canonical position. Sets up `pos` otherwise. */
function setup(t: Table, pos: Position, idx: number, squares: Int8Array): boolean {
  const n = t.pieces.length;
  const side = idx & 1;
  let r = idx >> 1;
  for (let i = 0; i < n; i++) { squares[i] = r % 36; r = (r / 36) | 0; }
  for (let i = 0; i < n; i++) {
    const p = t.pieces[i];
    if ((p & 7) === PAWN) { const rk = rankOf(squares[i]); if (rk === 0 || rk === 5) return false; }
    for (let j = 0; j < i; j++) if (squares[j] === squares[i]) return false;
    if (i > 0 && t.pieces[i - 1] === p && squares[i - 1] > squares[i]) return false; // identical pieces: ascending
  }
  pos.board.fill(EMPTY);
  for (let i = 0; i < n; i++) pos.board[squares[i]] = t.pieces[i];
  pos.kingSq[0] = squares[0]; pos.kingSq[1] = squares[1];
  pos.side = side as Color;
  pos.halfmove = 0;
  // the side NOT to move may not be in check
  return !pos.isAttacked(pos.kingSq[side ^ 1], side as Color);
}

function enumerate(t: Table, f: (pos: Position, idx: number) => number): void {
  const pos = new Position();
  const sq = new Int8Array(t.pieces.length);
  for (let idx = 0; idx < t.res.length; idx++) if (setup(t, pos, idx, sq)) t.res[idx] = f(pos, idx);
}

/** Visit every legal position of a solved table (the Position is reused — copy what you need). */
export function forEachPosition(t: Table, f: (pos: Position, res: number, dtm: number, squares: Int8Array) => void): void {
  const pos = new Position();
  const sq = new Int8Array(t.pieces.length);
  for (let idx = 0; idx < t.res.length; idx++) {
    if (t.res[idx] === INVALID) continue;
    setup(t, pos, idx, sq);
    f(pos, t.res[idx], t.dtm[idx], sq);
  }
}

export interface Probe { key: string; result: 'win' | 'loss' | 'draw'; /** plies to mate (0 for draws) */ plies: number; /** moves to mate for the winner (draws: 0) */ moves: number }

function keyOfBoard(pos: Position): string {
  let w = 'K', b = 'K';
  for (let i = 0; i < 36; i++) {
    const p = pos.board[i];
    if (p === EMPTY || (p & 7) === KING) continue;
    const c = 'QRNP'[ORDER.indexOf(p & 7)];
    if (p >> 3) b += c; else w += c;
  }
  return canonicalKey(w, b);
}

/** Value of a position for the side to move (solves the needed tables on first use). */
export function probePosition(pos: Position): Probe {
  const t = solve(keyOfBoard(pos));
  const idx = boardIndex(t, pos.board, pos.side);
  const r = t.res[idx], d = t.dtm[idx];
  if (r === INVALID) throw new Error('position not in table (illegal?)');
  const result = r === WIN ? 'win' : r === LOSS ? 'loss' : 'draw';
  return { key: t.key, result, plies: r === DRAW ? 0 : d, moves: r === WIN ? (d + 1) / 2 : r === LOSS ? d / 2 : 0 };
}
export function probeFen(fen: string): Probe {
  return probePosition(Position.fromFen(fen.split(' ').length < 4 ? `${fen} - - 0 1` : fen));
}

/** Every legal move with the value it reaches, from the mover's point of view. */
export function probeMoves(fen: string): { san: string; result: 'win' | 'loss' | 'draw'; moves: number }[] {
  const pos = Position.fromFen(fen.split(' ').length < 4 ? `${fen} - - 0 1` : fen);
  const out: { san: string; result: 'win' | 'loss' | 'draw'; moves: number }[] = [];
  for (const m of pos.legalMoves()) {
    const san = moveToSan(pos, m);
    pos.makeMove(m);
    let pr: Probe;
    if (!pos.hasLegalMove()) pr = { key: '', result: pos.inCheck() ? 'loss' : 'draw', plies: 0, moves: 0 };
    else pr = probePosition(pos);
    pos.unmakeMove();
    // child LOSS in d plies → mover wins in d+1 plies = (d+2)/2 moves
    if (pr.result === 'loss') out.push({ san, result: 'win', moves: pr.plies / 2 + 1 });
    else if (pr.result === 'win') out.push({ san, result: 'loss', moves: (pr.plies + 1) / 2 });
    else out.push({ san, result: 'draw', moves: 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Book statistics.

export interface ClassSummary {
  key: string;
  /** legal positions per side to move */
  positions: [number, number];
  wins: [number, number]; draws: [number, number]; losses: [number, number];
  /** longest win (moves) for the side to move, White-to-move / Black-to-move */
  maxWinMoves: [number, number];
  longestWtm: string | null;
}

export function summarise(t: Table): ClassSummary {
  const s: ClassSummary = { key: t.key, positions: [0, 0], wins: [0, 0], draws: [0, 0], losses: [0, 0], maxWinMoves: [0, 0], longestWtm: null };
  forEachPosition(t, (pos, r, d) => {
    const c = pos.side;
    s.positions[c]++;
    if (r === WIN) {
      s.wins[c]++;
      const mv = (d + 1) / 2;
      if (mv > s.maxWinMoves[c]) { s.maxWinMoves[c] = mv; if (c === WHITE) s.longestWtm = pos.toFen().split(' ').slice(0, 2).join(' '); }
    } else if (r === LOSS) s.losses[c]++;
    else s.draws[c]++;
  });
  return s;
}

/** "Quiet" as the book defines it (Book IV, Chapter IV.6): the side to move is not in check and has no capture. */
export function isQuiet(pos: Position): boolean {
  if (pos.inCheck()) return false;
  for (const m of pos.legalMoves()) if (pos.board[(m >> 6) & 63] !== EMPTY) return false;
  return true;
}

const cheb = (a: number, b: number) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
/** Ring of a square: 0 = edge (incl. corners), 1 = second ring, 2 = the four centre squares. */
const ring = (sq: number) => Math.min(fileOf(sq), 5 - fileOf(sq), rankOf(sq), 5 - rankOf(sq));
const isCorner = (sq: number) => (fileOf(sq) === 0 || fileOf(sq) === 5) && (rankOf(sq) === 0 || rankOf(sq) === 5);

const pct = (a: number, b: number) => (b ? (100 * a / b).toFixed(1) + '%' : '—');

export function bookReport(log: (s: string) => void = console.log): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const say = (s: string) => log(s);
  for (const k of ['KQvK', 'KRvK', 'KNvK', 'KNNvK', 'KPvK']) {
    const s = summarise(solve(k, { log: say }));
    out[k] = s;
    say(`${k}: WTM ${s.positions[0]} positions, won ${pct(s.wins[0], s.positions[0])} (max ${s.maxWinMoves[0]} moves, e.g. ${s.longestWtm}); BTM ${s.positions[1]}, Black loses ${s.losses[1]} (${pct(s.losses[1], s.positions[1])}), Black wins ${s.wins[1]}`);
  }
  // KNNK detail: are the White-to-move wins all mates in one?
  { const t = solve('KNNvK'); let m1 = 0, w = 0; forEachPosition(t, (pos, r, d) => { if (pos.side === WHITE && r === WIN) { w++; if (d === 1) m1++; } }); say(`KNNvK: WTM wins ${w}, of which mate-in-1 ${m1}`); out.KNNvK_m1 = { w, m1 }; }
  // KPK by pawn file
  {
    const t = solve('KPvK'); const won = [0, 0, 0], tot = [0, 0, 0];
    forEachPosition(t, (pos, r, _d, sq) => { if (pos.side !== WHITE) return; const f = fileOf(sq[2]); const g = Math.min(f, 5 - f); tot[g]++; if (r === WIN) won[g]++; });
    say(`KPvK by file (WTM): a/f ${pct(won[0], tot[0])}, b/e ${pct(won[1], tot[1])}, c/d ${pct(won[2], tot[2])}`);
    out.KPvK_files = { won, tot };
  }
  for (const k of ['KQvKR', 'KRvKN']) {
    const t = solve(k, { log: say });
    const s = summarise(t);
    out[k] = s;
    say(`${k}: WTM ${s.positions[0]} positions (W wins ${pct(s.wins[0], s.positions[0])}, max ${s.maxWinMoves[0]} moves, e.g. ${s.longestWtm}); BTM ${s.positions[1]} (B loses ${pct(s.losses[1], s.positions[1])})`);
    // quiet positions with the defender (Black) to move
    let q = 0, qLost = 0, qDraw = 0, qWon = 0, maxLoss = 0, maxLossAll = 0;
    const byDist = new Map<number, [number, number]>(), byRing = new Map<string, [number, number]>();
    forEachPosition(t, (pos, r, d, sq) => {
      if (pos.side !== BLACK) return;
      if (r === LOSS) maxLossAll = Math.max(maxLossAll, d / 2);
      if (!isQuiet(pos)) return;
      q++;
      if (r === LOSS) { qLost++; maxLoss = Math.max(maxLoss, d / 2); } else if (r === DRAW) qDraw++; else qWon++;
      const lost = r === LOSS ? 1 : 0;
      const dist = Math.min(4, cheb(sq[1], sq[3]));
      const a = byDist.get(dist) ?? [0, 0]; a[0] += lost; a[1]++; byDist.set(dist, a);
      const rk = isCorner(sq[1]) ? 'corner' : ['edge', 'second ring', 'centre'][ring(sq[1])];
      const b = byRing.get(rk) ?? [0, 0]; b[0] += lost; b[1]++; byRing.set(rk, b);
      if (ring(sq[1]) === 0) { const e = byRing.get('edge incl. corners') ?? [0, 0]; e[0] += lost; e[1]++; byRing.set('edge incl. corners', e); }
    });
    say(`${k}: quiet BTM ${q}: White wins ${pct(qLost, q)}, draws ${pct(qDraw, q)}, Black wins ${pct(qWon, q)}; longest quiet loss ${maxLoss} moves, longest BTM loss ${maxLossAll}`);
    out[`${k}_quiet`] = { q, qLost, qDraw, qWon, maxLoss, maxLossAll };
    if (k === 'KRvKN') {
      say(`  by king–knight distance: ${[1, 2, 3, 4].map(d => { const a = byDist.get(d) ?? [0, 0]; return `${d}${d === 4 ? '+' : ''}: ${pct(a[0], a[1])}`; }).join(', ')}`);
      say(`  by defender king: ${['edge', 'edge incl. corners', 'second ring', 'centre', 'corner'].map(r => { const a = byRing.get(r) ?? [0, 0]; return `${r}: ${pct(a[0], a[1])}`; }).join(', ')}`);
      out.KRvKN_dist = Object.fromEntries(byDist); out.KRvKN_ring = Object.fromEntries(byRing);
    }
  }
  return out;
}

const isMain = typeof process !== 'undefined' && process.argv[1] && /endgame\.ts$/.test(process.argv[1]);
if (isMain) {
  const i = process.argv.indexOf('--probe');
  if (i > 0) {
    const fen = process.argv[i + 1];
    console.log(probeFen(fen));
    for (const m of probeMoves(fen)) console.log(`  ${m.san}: ${m.result}${m.moves ? ` in ${m.moves}` : ''}`);
  } else bookReport();
}
