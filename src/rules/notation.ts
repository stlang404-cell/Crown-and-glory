/**
 * Notation for crown-la6-v1.
 *
 * Authoritative record notation is "crown coordinate notation" (CCN, notation version ccn-1):
 * from-square + to-square + optional lowercase promotion letter (q/r/n), e.g. "c2c3", "b5b6q".
 * This is the same spelling Fairy-Stockfish uses for UCI moves on this variant.
 *
 * SAN (display only, notation version csan-1) follows the familiar standard-chess conventions
 * restricted to this piece set: piece letter (N/R/Q/K, none for pawns), file/rank disambiguation,
 * "x" for captures, "=Q/R/N" for promotion and "+"/"#" suffixes. It is NOT standard-chess PGN.
 */
import { Position } from './position';
import {
  EMPTY, KING, KNIGHT, Move, PAWN, QUEEN, ROOK, encodeMove, fileOf, moveFrom, movePromo, moveTo, parseSquare,
  pieceType, rankOf, squareName, FILES,
} from './types';

export const NOTATION_VERSION = 'ccn-1';
export const SAN_VERSION = 'csan-1';

const PROMO_LETTER: Record<number, string> = { [QUEEN]: 'q', [ROOK]: 'r', [KNIGHT]: 'n' };
const LETTER_PROMO: Record<string, number> = { q: QUEEN, r: ROOK, n: KNIGHT };
const SAN_PIECE = ['', '', 'N', 'R', 'Q', 'K'];

export function moveToCcn(m: Move): string {
  const promo = movePromo(m);
  return squareName(moveFrom(m)) + squareName(moveTo(m)) + (promo ? PROMO_LETTER[promo] : '');
}

/** Parse CCN without legality checking; returns -1 if malformed. */
export function parseCcn(s: string): Move {
  if (s.length !== 4 && s.length !== 5) return -1;
  const from = parseSquare(s.slice(0, 2));
  const to = parseSquare(s.slice(2, 4));
  if (from < 0 || to < 0) return -1;
  let promo = 0;
  if (s.length === 5) {
    promo = LETTER_PROMO[s[4]] ?? -1;
    if (promo < 0) return -1;
  }
  return encodeMove(from, to, promo);
}

/** Parse CCN and verify legality in `pos`; returns -1 if illegal. */
export function parseLegalCcn(pos: Position, s: string): Move {
  const m = parseCcn(s);
  if (m < 0) return -1;
  return pos.legalMoves().includes(m) ? m : -1;
}

/** SAN for a legal move in `pos` (position is not modified on return). */
export function moveToSan(pos: Position, m: Move, legal?: Move[]): string {
  const from = moveFrom(m), to = moveTo(m), promo = movePromo(m);
  const piece = pos.board[from];
  const t = pieceType(piece);
  const capture = pos.board[to] !== EMPTY;
  let san = '';
  if (t === PAWN) {
    if (capture) san += FILES[fileOf(from)] + 'x';
    san += squareName(to);
    if (promo) san += '=' + PROMO_LETTER[promo].toUpperCase();
  } else {
    san += SAN_PIECE[t];
    if (t !== KING) {
      const moves = legal ?? pos.legalMoves();
      const others = moves.filter(o => o !== m && moveTo(o) === to && pos.board[moveFrom(o)] === piece);
      if (others.length) {
        const sameFile = others.some(o => fileOf(moveFrom(o)) === fileOf(from));
        const sameRank = others.some(o => rankOf(moveFrom(o)) === rankOf(from));
        if (!sameFile) san += FILES[fileOf(from)];
        else if (!sameRank) san += String(rankOf(from) + 1);
        else san += squareName(from);
      }
    }
    if (capture) san += 'x';
    san += squareName(to);
  }
  pos.makeMove(m);
  if (pos.inCheck()) san += pos.hasLegalMove() ? '+' : '#';
  pos.unmakeMove();
  return san;
}

/** Parse SAN (as produced by moveToSan; tolerant of missing +/# and 'x'). Returns -1 if no unique legal match. */
export function parseSan(pos: Position, san: string): Move {
  const clean = san.replace(/[+#!?]/g, '');
  const legal = pos.legalMoves();
  const matches = legal.filter(m => moveToSan(pos, m, legal).replace(/[+#]/g, '') === clean);
  return matches.length === 1 ? matches[0] : -1;
}

/** Convert a sequence of CCN moves into SAN, validating legality. Throws on illegal move. */
export function ccnLineToSan(fen: string, line: string[]): string[] {
  const pos = Position.fromFen(fen);
  const out: string[] = [];
  for (const s of line) {
    const m = parseLegalCcn(pos, s);
    if (m < 0) throw new Error(`Illegal move ${s} in line`);
    out.push(moveToSan(pos, m));
    pos.makeMove(m);
  }
  return out;
}
