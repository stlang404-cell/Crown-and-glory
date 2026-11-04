/**
 * Board motion: decides, from the previous and the new board, whether a change is one piece moving (forward, or
 * backwards when stepping back through a replay) and what to animate. Anything else (a jump of several moves, a new
 * game, a flipped position) returns null and the board is drawn instantly. Presentation only: the board passed in is
 * always the authoritative position.
 */
export type Cell = string | null;

export interface Transition {
  /** Square the moving piece leaves (in the old board) and the square it lands on (in the new board). */
  from: string;
  to: string;
  /** Piece left behind and fading out at `to` (forward capture). */
  captured: Cell;
  /** Piece reappearing at `from` (stepping back over a capture). */
  restored: Cell;
  /** The piece changed kind on the way (promotion forward, or un-promotion stepping back). */
  promotion: boolean;
}

const FILES = 'abcdef';
export const sqName = (i: number) => FILES[i % 6] + (Math.floor(i / 6) + 1);
const white = (p: string) => p === p.toUpperCase();

export function parseBoard(fen: string): Cell[] {
  const out: Cell[] = new Array(36).fill(null);
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    const rank = 5 - i;
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += +ch;
      else { out[rank * 6 + f] = ch; f++; }
    }
  });
  return out;
}

function samePieceOrPromotion(a: string, b: string): { ok: boolean; promotion: boolean } {
  if (white(a) !== white(b)) return { ok: false, promotion: false };
  if (a === b) return { ok: true, promotion: false };
  // pawn → piece (forward) or piece → pawn (stepping back over a promotion)
  if (a.toLowerCase() === 'p' || b.toLowerCase() === 'p') return { ok: true, promotion: true };
  return { ok: false, promotion: false };
}

export function detectTransition(prev: Cell[] | null, next: Cell[]): Transition | null {
  if (!prev) return null;
  const changed: number[] = [];
  for (let i = 0; i < 36; i++) if (prev[i] !== next[i]) { changed.push(i); if (changed.length > 2) return null; }
  if (changed.length !== 2) return null;
  const [i, j] = changed;
  // Case 1: one square emptied — the piece slid from it to the other square (forward move, or a non-capture step back).
  for (const [src, dst] of [[i, j], [j, i]]) {
    if (prev[src] && !next[src] && next[dst]) {
      const m = samePieceOrPromotion(prev[src]!, next[dst]!);
      if (!m.ok) continue;
      if (prev[dst] && white(prev[dst]!) === white(next[dst]!)) return null; // cannot capture own piece
      return { from: sqName(src), to: sqName(dst), captured: prev[dst], restored: null, promotion: m.promotion };
    }
  }
  // Case 2: stepping back over a capture — the mover returns to an empty square and the captured piece reappears.
  for (const [src, dst] of [[i, j], [j, i]]) {
    if (prev[src] && next[src] && !prev[dst] && next[dst] && white(prev[src]!) !== white(next[src]!)) {
      const m = samePieceOrPromotion(prev[src]!, next[dst]!);
      if (m.ok) return { from: sqName(src), to: sqName(dst), captured: null, restored: next[src], promotion: m.promotion };
    }
  }
  return null;
}

/** True when the transition is the game's move `lastMove` being played forward (used for sound and drag handling). */
export function isForward(t: Transition, lastMove: string | null | undefined): boolean {
  return !!lastMove && lastMove.slice(0, 2) === t.from && lastMove.slice(2, 4) === t.to;
}
