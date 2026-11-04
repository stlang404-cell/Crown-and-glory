/**
 * Mutable position with make/unmake, legal move generation and Zobrist hashing for crown-la6-v1.
 *
 * This is the application's rules authority. It is differential-tested against an independent
 * Fairy-Stockfish build (pyffish 0.0.90, variant "losalamos") — see tests/rules.oracle.test.ts.
 */
import {
  BLACK, EMPTY, KING, KNIGHT, Move, NUM_SQUARES, PAWN, PROMOTION_TYPES, QUEEN, ROOK, WHITE, Color,
  charToPiece, encodeMove, makePiece, moveFrom, movePromo, moveTo, pieceChar, pieceColor, pieceType, rankOf,
  START_FEN,
} from './types';
import {
  KING_TARGETS, KNIGHT_TARGETS, PAWN_ATTACKERS, PAWN_ATTACKS, RAYS,
  ZOBRIST_HI, ZOBRIST_LO, ZOBRIST_SIDE_HI, ZOBRIST_SIDE_LO,
} from './tables';

/** Undo record stride in Position.undoBuf: move, captured piece, halfmove clock, hashLo, hashHi. */
const U_STRIDE = 5;
/** Scratch move buffer for legalMoves / hasLegalMove (synchronous, never re-entered). */
const scratchMoves = new Int32Array(256);

export class FenError extends Error {}

export class Position {
  board = new Int8Array(NUM_SQUARES);
  side: Color = WHITE;
  halfmove = 0;
  fullmove = 1;
  kingSq: [number, number] = [-1, -1];
  hashLo = 0;
  hashHi = 0;
  /** Hash history of every position reached so far (including the current one at index `ply`). */
  histLo: number[] = [];
  histHi: number[] = [];
  private undoBuf = new Int32Array(64 * U_STRIDE);
  private undoLen = 0;
  /**
   * Incremental evaluation support (engine hot path; no rules semantics). Maintained by setFen, makeMove,
   * unmakeMove and clone; null moves do not change them.
   * pieceCnt[pieceCode] = number of such pieces on the board; pawnBits[color] has bit sq set for every pawn
   * of that color (pawns only ever stand on squares 6..29, so the mask fits an int32).
   */
  pieceCnt = new Int8Array(16);
  pawnBits = new Int32Array(2);
  /**
   * Optional piece-square table (psqTab[(piece * 36 + sq) * 2] = mg, + 1 = eg; entries of piece code 0 must be 0)
   * installed by the evaluation;
   * while set, psqMg / psqEg hold the sum of the table over all pieces on the board.
   */
  psqTab: Int32Array | null = null;
  psqMg = 0;
  psqEg = 0;

  /** Install (or re-install) a piece-square table and recompute its sums from scratch. */
  setPsqTable(tab: Int32Array | null): void {
    this.psqTab = tab;
    let mg = 0, eg = 0;
    if (tab) {
      const b = this.board;
      for (let sq = 0; sq < NUM_SQUARES; sq++) {
        const p = b[sq];
        if (p) { mg += tab[(p * 36 + sq) * 2]; eg += tab[(p * 36 + sq) * 2 + 1]; }
      }
    }
    this.psqMg = mg; this.psqEg = eg;
  }

  /** Recompute piece counts and pawn masks from the board. */
  private recomputeCounts(): void {
    const cnt = this.pieceCnt, b = this.board;
    cnt.fill(0);
    let w = 0, bl = 0;
    for (let sq = 0; sq < NUM_SQUARES; sq++) {
      const p = b[sq];
      if (!p) continue;
      cnt[p]++;
      if (p === PAWN) w |= 1 << sq;
      else if (p === (PAWN | 8)) bl |= 1 << sq;
    }
    this.pawnBits[0] = w; this.pawnBits[1] = bl;
  }

  static fromFen(fen: string): Position {
    const p = new Position();
    p.setFen(fen);
    return p;
  }

  static start(): Position {
    return Position.fromFen(START_FEN);
  }

  setFen(fen: string): void {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 2) throw new FenError('FEN must contain at least board and side to move');
    const rows = parts[0].split('/');
    if (rows.length !== 6) throw new FenError('FEN board must contain 6 ranks');
    this.board.fill(EMPTY);
    this.kingSq = [-1, -1];
    for (let i = 0; i < 6; i++) {
      const rank = 5 - i;
      let file = 0;
      const row = rows[i];
      for (let j = 0; j < row.length; j++) {
        const ch = row[j];
        if (ch >= '1' && ch <= '6') {
          file += ch.charCodeAt(0) - 48;
          continue;
        }
        const piece = charToPiece(ch);
        if (piece < 0) throw new FenError(`Invalid piece '${ch}' (crown-la6-v1 has no bishops)`);
        if (file > 5) throw new FenError('Rank overflow');
        const sq = rank * 6 + file;
        this.board[sq] = piece;
        if (pieceType(piece) === KING) {
          const c = pieceColor(piece);
          if (this.kingSq[c] !== -1) throw new FenError('Multiple kings');
          this.kingSq[c] = sq;
        }
        if (pieceType(piece) === PAWN && (rank === 0 || rank === 5)) throw new FenError('Pawn on promotion/back rank');
        file++;
      }
      if (file !== 6) throw new FenError(`Rank ${rank + 1} does not have 6 files`);
    }
    if (this.kingSq[0] < 0 || this.kingSq[1] < 0) throw new FenError('Each side needs exactly one king');
    if (parts[1] !== 'w' && parts[1] !== 'b') throw new FenError('Side to move must be w or b');
    this.side = parts[1] === 'w' ? WHITE : BLACK;
    if (parts[2] && parts[2] !== '-') throw new FenError('crown-la6-v1 has no castling rights');
    if (parts[3] && parts[3] !== '-') throw new FenError('crown-la6-v1 has no en passant');
    this.halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
    this.fullmove = parts[5] ? parseInt(parts[5], 10) : 1;
    if (!Number.isFinite(this.halfmove) || this.halfmove < 0) throw new FenError('Bad halfmove clock');
    if (!Number.isFinite(this.fullmove) || this.fullmove < 1) throw new FenError('Bad fullmove number');
    // The side NOT to move must not be in check.
    if (this.isAttacked(this.kingSq[this.side ^ 1], this.side)) throw new FenError('Side not to move is in check');
    this.recomputeHash();
    this.recomputeCounts();
    this.setPsqTable(this.psqTab);
    this.histLo = [this.hashLo];
    this.histHi = [this.hashHi];
    this.undoLen = 0;
  }

  toFen(): string {
    const rows: string[] = [];
    for (let rank = 5; rank >= 0; rank--) {
      let row = '';
      let empty = 0;
      for (let file = 0; file < 6; file++) {
        const p = this.board[rank * 6 + file];
        if (p === EMPTY) empty++;
        else {
          if (empty) { row += empty; empty = 0; }
          row += pieceChar(p);
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return `${rows.join('/')} ${this.side === WHITE ? 'w' : 'b'} - - ${this.halfmove} ${this.fullmove}`;
  }

  /** Repetition identity: board + side to move (no castling/en-passant state exists). */
  positionKey(): string {
    return this.toFen().split(' ').slice(0, 2).join(' ');
  }

  clone(): Position {
    const p = new Position();
    p.board.set(this.board);
    p.side = this.side;
    p.halfmove = this.halfmove;
    p.fullmove = this.fullmove;
    p.kingSq = [this.kingSq[0], this.kingSq[1]];
    p.hashLo = this.hashLo;
    p.hashHi = this.hashHi;
    p.histLo = this.histLo.slice();
    p.histHi = this.histHi.slice();
    p.undoBuf = this.undoBuf.slice();
    p.undoLen = this.undoLen;
    p.pieceCnt.set(this.pieceCnt);
    p.pawnBits.set(this.pawnBits);
    p.psqTab = this.psqTab;
    p.psqMg = this.psqMg;
    p.psqEg = this.psqEg;
    return p;
  }

  recomputeHash(): void {
    let lo = 0, hi = 0;
    for (let sq = 0; sq < NUM_SQUARES; sq++) {
      const p = this.board[sq];
      if (p) { lo ^= ZOBRIST_LO[p * 36 + sq]; hi ^= ZOBRIST_HI[p * 36 + sq]; }
    }
    if (this.side === BLACK) { lo ^= ZOBRIST_SIDE_LO; hi ^= ZOBRIST_SIDE_HI; }
    this.hashLo = lo;
    this.hashHi = hi;
  }

  /** Is `sq` attacked by any piece of color `by`? Kings attack adjacent squares unconditionally. */
  isAttacked(sq: number, by: Color): boolean {
    const b = this.board;
    const byFlag = by << 3;
    const pa = PAWN_ATTACKERS[by][sq];
    for (let i = 0; i < pa.length; i++) if (b[pa[i]] === (PAWN | byFlag)) return true;
    const kn = KNIGHT_TARGETS[sq];
    for (let i = 0; i < kn.length; i++) if (b[kn[i]] === (KNIGHT | byFlag)) return true;
    const kg = KING_TARGETS[sq];
    for (let i = 0; i < kg.length; i++) if (b[kg[i]] === (KING | byFlag)) return true;
    const rays = RAYS[sq];
    for (let d = 0; d < 8; d++) {
      const ray = rays[d];
      for (let i = 0; i < ray.length; i++) {
        const p = b[ray[i]];
        if (p === EMPTY) continue;
        if ((p >> 3) === by) {
          const t = p & 7;
          if (t === QUEEN || (d < 4 && t === ROOK)) return true;
        }
        break;
      }
    }
    return false;
  }

  inCheck(color: Color = this.side): boolean {
    return this.isAttacked(this.kingSq[color], (color ^ 1) as Color);
  }

  /**
   * Generate pseudo-legal moves (may leave own king in check) into `out`; returns count.
   * capturesOnly also includes promotions (they are tactically forcing).
   */
  generatePseudo(out: Move[] | Int32Array, capturesOnly = false): number {
    const b = this.board;
    const us = this.side;
    let n = 0;
    for (let from = 0; from < NUM_SQUARES; from++) {
      const p = b[from];
      if (p === EMPTY || (p >> 3) !== us) continue;
      const t = p & 7;
      if (t === PAWN) {
        const dir = us === WHITE ? 6 : -6;
        const to = from + dir;
        const promoRank = us === WHITE ? 5 : 0;
        const toRank = rankOf(to);
        if (b[to] === EMPTY) {
          if (toRank === promoRank) {
            for (const pt of PROMOTION_TYPES) out[n++] = encodeMove(from, to, pt);
          } else if (!capturesOnly) out[n++] = encodeMove(from, to);
        }
        const caps = PAWN_ATTACKS[us][from];
        for (let i = 0; i < caps.length; i++) {
          const c = caps[i];
          const q = b[c];
          if (q !== EMPTY && (q >> 3) !== us) {
            if (toRank === promoRank) {
              for (const pt of PROMOTION_TYPES) out[n++] = encodeMove(from, c, pt);
            } else out[n++] = encodeMove(from, c);
          }
        }
      } else if (t === KNIGHT || t === KING) {
        const targets = t === KNIGHT ? KNIGHT_TARGETS[from] : KING_TARGETS[from];
        for (let i = 0; i < targets.length; i++) {
          const to = targets[i];
          const q = b[to];
          if (q === EMPTY) { if (!capturesOnly) out[n++] = encodeMove(from, to); }
          else if ((q >> 3) !== us) out[n++] = encodeMove(from, to);
        }
      } else {
        const d0 = 0;
        const d1 = t === ROOK ? 4 : 8;
        const rays = RAYS[from];
        for (let d = d0; d < d1; d++) {
          const ray = rays[d];
          for (let i = 0; i < ray.length; i++) {
            const to = ray[i];
            const q = b[to];
            if (q === EMPTY) { if (!capturesOnly) out[n++] = encodeMove(from, to); continue; }
            if ((q >> 3) !== us) out[n++] = encodeMove(from, to);
            break;
          }
        }
      }
    }
    return n;
  }

  /** Apply a move (assumed pseudo-legal). Always pair with unmakeMove(). */
  makeMove(m: Move): void {
    const b = this.board;
    const from = moveFrom(m), to = moveTo(m), promo = movePromo(m);
    const piece = b[from];
    const captured = b[to];
    this.pushUndo(m, captured);
    let lo = this.hashLo, hi = this.hashHi;
    lo ^= ZOBRIST_LO[piece * 36 + from]; hi ^= ZOBRIST_HI[piece * 36 + from];
    if (captured) { lo ^= ZOBRIST_LO[captured * 36 + to]; hi ^= ZOBRIST_HI[captured * 36 + to]; }
    const placed = promo ? makePiece(promo, this.side) : piece;
    lo ^= ZOBRIST_LO[placed * 36 + to]; hi ^= ZOBRIST_HI[placed * 36 + to];
    lo ^= ZOBRIST_SIDE_LO; hi ^= ZOBRIST_SIDE_HI;
    b[to] = placed;
    b[from] = EMPTY;
    // incremental evaluation state
    const cnt = this.pieceCnt;
    if (captured) {
      cnt[captured]--;
      if ((captured & 7) === PAWN) this.pawnBits[captured >> 3] ^= 1 << to;
    }
    if ((piece & 7) === PAWN) {
      const pb = this.pawnBits;
      if (promo) { cnt[piece]--; cnt[placed]++; pb[this.side] ^= 1 << from; }
      else pb[this.side] ^= (1 << from) | (1 << to);
    }
    const tab = this.psqTab;
    if (tab) {
      const a = (placed * 36 + to) * 2, r = (piece * 36 + from) * 2, c = (captured * 36 + to) * 2;
      this.psqMg += tab[a] - tab[r] - tab[c];
      this.psqEg += tab[a + 1] - tab[r + 1] - tab[c + 1];
    }
    if ((piece & 7) === KING) this.kingSq[this.side] = to;
    this.halfmove = (piece & 7) === PAWN || captured ? 0 : this.halfmove + 1;
    if (this.side === BLACK) this.fullmove++;
    this.side = (this.side ^ 1) as Color;
    this.hashLo = lo; this.hashHi = hi;
    this.histLo.push(lo); this.histHi.push(hi);
  }

  unmakeMove(): void {
    if (this.undoLen === 0) throw new Error('unmakeMove with empty undo stack');
    const ub = this.undoBuf, uo = --this.undoLen * U_STRIDE;
    const move = ub[uo];
    this.histLo.pop(); this.histHi.pop();
    this.side = (this.side ^ 1) as Color;
    if (this.side === BLACK) this.fullmove--;
    const from = moveFrom(move), to = moveTo(move), promo = movePromo(move);
    const b = this.board;
    const placed = b[to];
    const moved = promo ? makePiece(PAWN, this.side) : placed;
    const captured = ub[uo + 1];
    b[from] = moved;
    b[to] = captured;
    // incremental evaluation state (exact inverse of makeMove)
    const cnt = this.pieceCnt;
    if (captured) {
      cnt[captured]++;
      if ((captured & 7) === PAWN) this.pawnBits[captured >> 3] ^= 1 << to;
    }
    if ((moved & 7) === PAWN) {
      const pb = this.pawnBits;
      if (promo) { cnt[moved]++; cnt[placed]--; pb[this.side] ^= 1 << from; }
      else pb[this.side] ^= (1 << from) | (1 << to);
    }
    const tab = this.psqTab;
    if (tab) {
      const a = (placed * 36 + to) * 2, r = (moved * 36 + from) * 2, c = (captured * 36 + to) * 2;
      this.psqMg -= tab[a] - tab[r] - tab[c];
      this.psqEg -= tab[a + 1] - tab[r + 1] - tab[c + 1];
    }
    if ((moved & 7) === KING) this.kingSq[this.side] = from;
    this.halfmove = ub[uo + 2];
    this.hashLo = ub[uo + 3]; this.hashHi = ub[uo + 4];
  }

  private pushUndo(m: Move, captured: number): void {
    let ub = this.undoBuf;
    const uo = this.undoLen * U_STRIDE;
    if (uo + U_STRIDE > ub.length) {
      const nb = new Int32Array(ub.length * 2);
      nb.set(ub);
      this.undoBuf = ub = nb;
    }
    ub[uo] = m; ub[uo + 1] = captured; ub[uo + 2] = this.halfmove; ub[uo + 3] = this.hashLo; ub[uo + 4] = this.hashHi;
    this.undoLen++;
  }

  /** Null move for search pruning only (never part of a game record). */
  makeNullMove(): void {
    this.pushUndo(0xffff, 0);
    this.hashLo ^= ZOBRIST_SIDE_LO; this.hashHi ^= ZOBRIST_SIDE_HI;
    this.side = (this.side ^ 1) as Color;
    this.halfmove++;
    this.histLo.push(this.hashLo); this.histHi.push(this.hashHi);
  }

  unmakeNullMove(): void {
    if (this.undoLen === 0) throw new Error('unmakeNullMove with empty undo stack');
    const ub = this.undoBuf, uo = --this.undoLen * U_STRIDE;
    this.histLo.pop(); this.histHi.pop();
    this.side = (this.side ^ 1) as Color;
    this.halfmove = ub[uo + 2];
    this.hashLo = ub[uo + 3]; this.hashHi = ub[uo + 4];
  }

  /** True if the last made move left the mover's own king attacked (i.e. was illegal). */
  lastMoveLeftKingInCheck(): boolean {
    const mover = (this.side ^ 1) as Color;
    return this.isAttacked(this.kingSq[mover], this.side);
  }

  legalMoves(): Move[] {
    const buf = scratchMoves;
    const n = this.generatePseudo(buf);
    const out: Move[] = [];
    for (let i = 0; i < n; i++) {
      const m = buf[i];
      this.makeMove(m);
      if (!this.lastMoveLeftKingInCheck()) out.push(m);
      this.unmakeMove();
    }
    return out;
  }

  hasLegalMove(): boolean {
    const buf = scratchMoves;
    const n = this.generatePseudo(buf);
    for (let i = 0; i < n; i++) {
      this.makeMove(buf[i]);
      const ok = !this.lastMoveLeftKingInCheck();
      this.unmakeMove();
      if (ok) return true;
    }
    return false;
  }

  isLegal(m: Move): boolean {
    return this.legalMoves().includes(m);
  }

  /** Number of times the current position (board + side) has occurred, counting the current one. */
  repetitionCount(): number {
    const n = this.histLo.length - 1;
    let count = 1;
    // Positions before the last irreversible move (pawn move/capture) can never recur.
    const limit = Math.max(0, n - this.halfmove);
    for (let i = n - 2; i >= limit; i -= 2) {
      if (this.histLo[i] === this.hashLo && this.histHi[i] === this.hashHi) count++;
    }
    return count;
  }

  /** Search helper: has the current position appeared before since the last irreversible move? */
  isRepeatedSince(rootIndex: number): { repeated: boolean; beforeRoot: boolean } {
    const n = this.histLo.length - 1;
    const limit = Math.max(0, n - this.halfmove);
    for (let i = n - 4; i >= limit; i -= 2) {
      if (this.histLo[i] === this.hashLo && this.histHi[i] === this.hashHi) {
        return { repeated: true, beforeRoot: i < rootIndex };
      }
    }
    return { repeated: false, beforeRoot: false };
  }

  get ply(): number {
    return this.histLo.length - 1;
  }

  pieceCount(): { white: number[]; black: number[] } {
    const white = [0, 0, 0, 0, 0, 0], black = [0, 0, 0, 0, 0, 0];
    for (let sq = 0; sq < NUM_SQUARES; sq++) {
      const p = this.board[sq];
      if (!p) continue;
      (pieceColor(p) === WHITE ? white : black)[pieceType(p)]++;
    }
    return { white, black };
  }

  /** Does `color` have any piece other than its king? */
  hasNonKingPiece(color: Color): boolean {
    for (let sq = 0; sq < NUM_SQUARES; sq++) {
      const p = this.board[sq];
      if (p && pieceColor(p) === color && pieceType(p) !== KING) return true;
    }
    return false;
  }

  hashKey(): string {
    return (this.hashHi >>> 0).toString(16).padStart(8, '0') + (this.hashLo >>> 0).toString(16).padStart(8, '0');
  }
}
