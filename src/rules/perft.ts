import { Position } from './position';

/** Count leaf nodes of the legal move tree to `depth` (standard perft). */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const buf: number[] = [];
  const n = pos.generatePseudo(buf);
  let total = 0;
  for (let i = 0; i < n; i++) {
    pos.makeMove(buf[i]);
    if (!pos.lastMoveLeftKingInCheck()) total += depth === 1 ? 1 : perft(pos, depth - 1);
    pos.unmakeMove();
  }
  return total;
}
