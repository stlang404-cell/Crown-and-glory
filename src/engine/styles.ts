/**
 * Playing styles (crown-styles-2) as bounded move-choice policies (research doc 05: "styles choose among
 * near-equivalent candidates using stable preferences while preserving a common strength budget").
 * After the normal search, all legal moves are scored exactly at (achieved depth − 2); among moves within
 * STYLE_MARGIN_CP of the best, the style picks the one with the highest preference score (ties → engine
 * choice). A style therefore never plays a move judged more than 20 cp worse at that depth.
 * A style is shown only if tools/styles/validate.ts measured a real behavioural difference in the claimed
 * direction AND strength parity (src/engine/styles-validation.json); otherwise it plays as Universal.
 */
import { Position } from '../rules/position';
import { KING, KNIGHT, Move, PAWN, QUEEN, moveFrom, moveTo, movePromo, pieceColor, pieceType, fileOf, rankOf } from '../rules/types';
import { KING_TARGETS } from '../rules/tables';
import validation from './styles-validation.json';
import type { StyleId } from '../federation/model';

export const STYLE_MARGIN_CP = 20;

export const STYLE_LABEL: Record<StyleId, string> = {
  universal: 'Universal', tactical: 'Tactical attacker', positional: 'Positional strategist', defensive: 'Defensive specialist', endgame: 'Endgame technician', aggressive: 'Risk-taking aggressor',
};

function attacksFromSq(pos: Position, sq: number): number[] {
  const out: number[] = [];
  const t = pieceType(pos.board[sq]);
  const c = pieceColor(pos.board[sq]);
  const f = fileOf(sq), r = rankOf(sq);
  const inB = (nf: number, nr: number) => nf >= 0 && nf < 6 && nr >= 0 && nr < 6;
  if (t === PAWN) { const dr = c === 0 ? 1 : -1; for (const df of [-1, 1]) if (inB(f + df, r + dr)) out.push((r + dr) * 6 + f + df); return out; }
  const jumps = t === KNIGHT ? [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] : t === KING ? [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] : [];
  if (jumps.length) { for (const [df, dr] of jumps) if (inB(f + df, r + dr)) out.push((r + dr) * 6 + f + df); return out; }
  const slide = t === QUEEN ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [df, dr] of slide) { let nf = f + df, nr = r + dr; while (inB(nf, nr)) { const s = nr * 6 + nf; out.push(s); if (pos.board[s]) break; nf += df; nr += dr; } }
  return out;
}

const isEndgame = (pos: Position) => {
  const c = pos.pieceCount();
  const pieces = c.white.reduce((a, x, t) => a + (t !== PAWN && t !== KING ? x : 0), 0) + c.black.reduce((a, x, t) => a + (t !== PAWN && t !== KING ? x : 0), 0);
  return c.white[QUEEN] + c.black[QUEEN] === 0 || pieces <= 4;
};

/** Preference score of a move for a style (higher = preferred). */
export function stylePreference(style: StyleId, pos: Position, m: Move): number {
  if (style === 'universal') return 0;
  const us = pos.side;
  const from = moveFrom(m), to = moveTo(m);
  const piece = pieceType(pos.board[from]);
  const capture = pos.board[to] !== 0 || movePromo(m) !== 0;
  const enemyKing = pos.kingSq[us ^ 1], ownKing = pos.kingSq[us];
  const p = pos.clone();
  p.makeMove(m);
  const check = p.inCheck() ? 1 : 0;
  const att = attacksFromSq(p, to);
  const valuableHits = att.filter(s => { const q = p.board[s]; return q && pieceColor(q) !== us && pieceType(q) >= KNIGHT; }).length;
  const nearEnemyKing = att.filter(s => s === enemyKing || KING_TARGETS[enemyKing].includes(s)).length;
  const advance = us === 0 ? rankOf(to) - rankOf(from) : rankOf(from) - rankOf(to);
  const central = (fileOf(to) === 2 || fileOf(to) === 3) && (rankOf(to) === 2 || rankOf(to) === 3) ? 1 : 0;
  const shield = (k: number, pp: Position) => KING_TARGETS[k].filter(s => { const q = pp.board[s]; return q && pieceColor(q) === us; }).length;
  switch (style) {
    case 'tactical': return 3 * check + 2 * (capture ? 1 : 0) + valuableHits;
    case 'aggressive': return 2 * check + 2 * nearEnemyKing + Math.max(0, advance) + (piece === PAWN ? 1 : 0);
    case 'positional': return (!capture && !check ? 2 : 0) + 2 * central + (piece !== PAWN && piece !== KING ? 1 : 0);
    case 'defensive': return 2 * (shield(piece === KING ? to : ownKing, p) - shield(ownKing, pos)) + (advance <= 0 ? 1 : 0) - 2 * check - (capture ? 1 : 0);
    case 'endgame': return isEndgame(pos) ? (piece === PAWN ? 3 + advance : 0) + (piece === KING ? 2 * central + 1 : 0) : 0;
  }
  return 0;
}

const V = validation as { id: string; validated: StyleId[]; results: Record<string, unknown> };
export const STYLE_VALIDATION_ID = V.id;
export const isValidatedStyle = (s: StyleId) => s === 'universal' || V.validated.includes(s);
/** The style actually used in play: unvalidated styles fall back to Universal. */
export const playStyle = (s: StyleId): StyleId => (isValidatedStyle(s) ? s : 'universal');
