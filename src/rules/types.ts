/**
 * crown-la6-v1 — core rule types.
 *
 * Coordinates: files a–f (0–5) left to right from White, ranks 1–6 (0–5) bottom to top.
 * Square index = rank * 6 + file, so a1 = 0, f1 = 5, a6 = 30, f6 = 35 ("a1-first flat" encoding,
 * identical to the research package fixtures).
 */

export const VARIANT_ID = 'crown-la6-v1' as const;
export const RULES_VERSION = '1.0.0' as const;
export const START_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
export const BOARD_SIZE = 6;
export const NUM_SQUARES = 36;

export const WHITE = 0;
export const BLACK = 1;
export type Color = 0 | 1;

/** Piece types (low 3 bits). No bishops exist in crown-la6-v1. */
export const PAWN = 1;
export const KNIGHT = 2;
export const ROOK = 3;
export const QUEEN = 4;
export const KING = 5;
export type PieceType = 1 | 2 | 3 | 4 | 5;

/** Piece code = type | (color << 3). 0 = empty. */
export const EMPTY = 0;
export const BLACK_FLAG = 8;

export const pieceType = (p: number): number => p & 7;
export const pieceColor = (p: number): Color => ((p >> 3) & 1) as Color;
export const makePiece = (type: number, color: Color): number => type | (color << 3);

export const PROMOTION_TYPES: readonly PieceType[] = [QUEEN, ROOK, KNIGHT];

/**
 * Move encoding (int): from (6 bits) | to << 6 | promotionType << 12.
 * promotionType is 0 for non-promotions, otherwise QUEEN/ROOK/KNIGHT.
 */
export type Move = number;
export const NULL_MOVE = 0xffff;
export const moveFrom = (m: Move): number => m & 63;
export const moveTo = (m: Move): number => (m >> 6) & 63;
export const movePromo = (m: Move): number => (m >> 12) & 7;
export const encodeMove = (from: number, to: number, promo = 0): Move => from | (to << 6) | (promo << 12);

export const fileOf = (sq: number): number => sq % 6;
export const rankOf = (sq: number): number => (sq / 6) | 0;
export const squareOf = (file: number, rank: number): number => rank * 6 + file;

export const FILES = 'abcdef';
export const squareName = (sq: number): string => FILES[fileOf(sq)] + String(rankOf(sq) + 1);
export function parseSquare(name: string): number {
  if (name.length !== 2) return -1;
  const f = FILES.indexOf(name[0]);
  const r = name.charCodeAt(1) - 49;
  if (f < 0 || r < 0 || r > 5) return -1;
  return squareOf(f, r);
}

export const PIECE_CHARS = ' PNRQK';
export function pieceChar(p: number): string {
  if (p === EMPTY) return '.';
  const c = PIECE_CHARS[pieceType(p)];
  return pieceColor(p) === WHITE ? c : c.toLowerCase();
}
export function charToPiece(ch: string): number {
  const upper = ch.toUpperCase();
  const t = PIECE_CHARS.indexOf(upper);
  if (t <= 0) return -1;
  return makePiece(t, ch === upper ? WHITE : BLACK);
}
