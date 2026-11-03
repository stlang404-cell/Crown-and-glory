/**
 * Crown opening classifier (crown-open-0). There is no established 6x6 opening taxonomy and no ECO
 * code applies; names below are descriptive Crown labels for White's first move and Black's reply.
 * Lines are matched only after legal replay from the standard start position.
 */
import { START_FEN } from '../rules/types';

export const OPENING_CLASSIFIER = 'crown-open-0';

const FIRST: Record<string, string> = {
  a2a3: 'Rook-pawn advance (a3)',
  b2b3: 'Knight-pawn advance (b3)',
  c2c3: "Queen's pawn advance (c3)",
  d2d3: "King's pawn advance (d3)",
  e2e3: 'Kingside knight-pawn advance (e3)',
  f2f3: 'Kingside rook-pawn advance (f3)',
  b1a3: 'Queenside knight to the rim (Na3)',
  b1c3: 'Queenside knight development (Nc3)',
  e1d3: 'Kingside knight to the centre (Nd3)',
  e1f3: 'Kingside knight development (Nf3)',
};
const REPLY: Record<string, string> = {
  a5a4: 'a4', b5b4: 'b4', c5c4: 'c4', d5d4: 'd4', e5e4: 'e4', f5f4: 'f4',
  b6a4: 'Na4', b6c4: 'Nc4', e6d4: 'Nd4', e6f4: 'Nf4',
};

export function classifyOpening(initialFen: string, moves: string[]): { name: string; classifierVersion: string } | null {
  if (initialFen !== START_FEN || moves.length < 1) return null;
  const first = FIRST[moves[0]];
  if (!first) return null;
  const reply = moves[1] ? REPLY[moves[1]] : undefined;
  return { name: reply ? `${first}, ${reply} reply` : first, classifierVersion: OPENING_CLASSIFIER };
}
