/**
 * Playing styles (crown-styles-3) as OPENING REPERTOIRE preferences.
 * src/engine/repertoire.json (tools/styles/build_repertoire.ts) lists, for every book position of the first
 * six plies, all moves the engine scores within 30 cp of the best at depth 7. A styled competitor picks among
 * those book moves with probability ∝ exp(STYLE_BETA · preference) (seeded per game, so games vary); after
 * the book it plays the common engine policy. A style can therefore never choose a book move judged more
 * than 30 cp worse than the best at depth 7. (crown-styles-2 — a 20 cp move filter applied all game — failed
 * validation; docs/V3_STYLES.md.)
 * A style is shown and used only if tools/styles/validate.ts measured a behavioural difference in the claimed
 * direction AND strength parity (src/engine/styles-validation.json); otherwise it plays as Universal.
 * crown-styles-5 (v0.9, below STYLE_EVAL) adds a full-game styled evaluation + draw contempt, measured by
 * tools/styles/measure.ts (docs/STYLES_REPORT.md); styles listed in styles-validation.json → fullGame use it.
 */
import { Position } from '../rules/position';
import { KING, KNIGHT, Move, PAWN, QUEEN, moveFrom, moveTo, movePromo, pieceColor, pieceType, fileOf, rankOf } from '../rules/types';
import { KING_TARGETS } from '../rules/tables';
import validation from './styles-validation.json';
import repertoire from './repertoire.json';
import { moveToCcn } from '../rules/notation';
import { mulberry32 } from '../rules/tables';
import type { StyleId } from '../federation/model';
import { OFF } from './eval4';
import type { EvalWeights } from './evaluate';

export const STYLE_BETA = 1.2;
export const REPERTOIRE_ID = (repertoire as { id: string }).id;

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

/** Opening preference score of a move for a style (higher = preferred). Endgame technicians have none. */
export function stylePreference(style: StyleId, pos: Position, m: Move): number {
  if (style === 'universal' || style === 'endgame') return 0;
  const us = pos.side;
  const from = moveFrom(m), to = moveTo(m);
  const piece = pieceType(pos.board[from]);
  const capture = pos.board[to] !== 0 || movePromo(m) !== 0;
  const enemyKing = pos.kingSq[us ^ 1], ownKing = pos.kingSq[us];
  const p = pos.clone();
  p.makeMove(m);
  const check = p.inCheck() ? 1 : 0;
  const att = attacksFromSq(p, to);
  const hits = att.filter(sq => { const q = p.board[sq]; return q && pieceColor(q) !== us && pieceType(q) !== KING; }).length;
  const nearEnemyKing = att.filter(sq => sq === enemyKing || KING_TARGETS[enemyKing].includes(sq)).length;
  const relRank = (sq: number) => (us === 0 ? rankOf(sq) : 5 - rankOf(sq));
  const central = fileOf(to) === 2 || fileOf(to) === 3 ? 1 : 0;
  const shield = (k: number, pp: Position) => KING_TARGETS[k].filter(sq => { const q = pp.board[sq]; return q && pieceColor(q) === us; }).length;
  switch (style) {
    case 'aggressive': return (piece === PAWN ? 2 : 0) + Math.max(0, relRank(to) - 1) + nearEnemyKing + 2 * check;
    case 'tactical': return 2 * hits + 2 * (capture ? 1 : 0) + 2 * check + (piece === KNIGHT || piece === QUEEN ? 1 : 0);
    case 'positional': return (piece === KNIGHT ? 2 : 0) + (piece !== PAWN && piece !== KING ? 1 : 0) + central;
    case 'defensive': return 2 * (shield(piece === KING ? to : ownKing, p) - shield(ownKing, pos)) + (relRank(to) <= 1 ? 2 : 0) - (capture ? 1 : 0) - check;
  }
  return 0;
}

type Book = { id: string; positions: Record<string, [string, number][]> };
const BOOK = repertoire as unknown as Book;
export const bookKey = (fen: string) => fen.split(' ').slice(0, 2).join(' ');
/** Book moves (legal, with depth-7 scores) for a position, or [] when out of book. */
export function bookMoves(pos: Position): { move: Move; cp: number }[] {
  const e = BOOK.positions[bookKey(pos.toFen())];
  if (!e) return [];
  const legal = pos.legalMoves();
  return e.map(([ccn, cp]) => ({ move: legal.find(x => moveToCcn(x) === ccn)!, cp })).filter(x => x.move !== undefined);
}
/** A styled repertoire choice (seeded), or null when out of book / universal. */
export function repertoireChoice(style: StyleId, pos: Position, seed: number): Move | null {
  if (style === 'universal' || style === 'endgame') return null;
  const moves = bookMoves(pos);
  if (moves.length < 2) return null;
  const w = moves.map(x => Math.exp(STYLE_BETA * stylePreference(style, pos, x.move)));
  const total = w.reduce((a, b) => a + b, 0);
  let r = (mulberry32(seed ^ 0x5bd1e995)() / 4294967296) * total;
  for (let i = 0; i < moves.length; i++) { r -= w[i]; if (r <= 0) return moves[i].move; }
  return moves[moves.length - 1].move;
}

// ---------------------------------------------------------------------------------------------------------
// Full-game styles (crown-styles-5): an asymmetric evaluation for the styled side plus a draw contempt.
// Adjustments change crown-eval-4 parameters for the styled side's OWN terms (`own`) or for the opponent's
// terms as the styled side sees them (`opp`, e.g. a defensive player over-weights the opponent's attacking
// chances). They change judgement only, never legality, depth or node budgets; the opponent's own search is
// untouched. Played only by styles listed in styles-validation.json → fullGame (tools/styles/measure.ts);
// design and measurements: docs/STYLES_REPORT.md.
type Term = keyof typeof OFF;
/**
 * A term adjustment: a multiplier for mg and eg (number), [mg, eg] centipawns added to every entry of the term,
 * or { x: [mgMul, egMul] } separate multipliers. A key `TERM.i` addresses entry i of a table term only
 * (MAT.4 = queen value, PST.5 = the king square table, MOB.5 = king mobility).
 */
type Adj = number | [number, number] | { x: [number, number] };
type TermKey = Term | `${Term}.${number}`;
export interface StyleEval { own?: Partial<Record<TermKey, Adj>>; opp?: Partial<Record<TermKey, Adj>>; contempt: number; simplify?: number }
export const STYLES_EVAL_ID = 'crown-styles-5';
export const STYLE_EVAL: Partial<Record<StyleId, StyleEval>> = {
  // more value on attacking enemy pieces (threats, hanging pieces) and on king-zone attackers
  tactical: { own: { HANGING: [25, 10], THREAT_PAWN: [20, 5], THREAT_MINOR: [20, 5], THREAT_ROOK: [20, 5], KING_ATTACKERS: [8, 0] }, contempt: 15 },
  // structure and piece placement over immediate threats
  positional: { own: { THREAT_PAWN: 0.85, THREAT_MINOR: 0.85, THREAT_ROOK: 0.85, HANGING: 0.85, SUPPORTED: [8, 4], PHALANX: [8, 4], OUTPOST: [20, 10], MOB: 1.1 }, contempt: 0 },
  // king hunt: king-zone attackers ×4, attack weight ×2, tropism +8 cp per step closer for N/R/Q (middlegame
  // only); strong draw avoidance
  aggressive: { own: { KING_ATTACKERS: [25, 0], KING_ATTACK: [2, 0], TROPISM: [8, 0] }, contempt: 35 },
  // safety first: own shelter and open king files weigh more, the opponent's attack and threats look bigger,
  // the opponent's queen is feared (queens off is welcome), and a draw is acceptable when not better
  defensive: { own: { KING_SHIELD: [10, 0], KING_OPEN: [-10, 0] }, opp: { KING_ATTACKERS: [10, 0], KING_ATTACK: [1, 0], TROPISM: [3, 0], HANGING: [15, 5], 'MAT.4': [20, 0] }, contempt: -20 },
  // conversion: trades when ahead (simplify), passed pawns and an active king weigh more in the endgame,
  // queens off is welcome
  endgame: { own: { PASSED: { x: [1, 1.5] }, PASSED_FREE: { x: [1, 1.5] }, PASSED_OWNK: { x: [1, 1.5] }, UNSTOPPABLE: [0, 60], 'PST.5': { x: [1, 1.5] } }, opp: { 'MAT.4': [25, 0] }, contempt: 15, simplify: 100 },
};
const TERM_SIZE: Partial<Record<Term, number>> = { MAT: 6, PST: 216, MOB: 6, PASSED: 6, PASSED_FREE: 6, MOBT: 96, TROPISM: 6 };
/** Size of one entry of a table term addressed as `TERM.i` (PST and MOBT entries are whole per-type tables). */
const ENTRY_SIZE: Partial<Record<Term, number>> = { PST: 36, MOBT: 16 };
function scaled(base: Int32Array, adj: Partial<Record<TermKey, Adj>>): Int32Array {
  const p = Int32Array.from(base);
  for (const [key, a] of Object.entries(adj) as [TermKey, Adj][]) {
    const [term, idx] = key.split('.') as [Term, string | undefined];
    if (!(term in OFF)) throw new Error(`unknown style term ${key}`);
    let start = OFF[term], n = TERM_SIZE[term] ?? 1;
    if (idx !== undefined) { const es = ENTRY_SIZE[term] ?? 1; start += +idx * es; n = es; }
    for (let i = start; i < start + n; i++) {
      if (typeof a === 'number') { p[2 * i] = Math.round(base[2 * i] * a); p[2 * i + 1] = Math.round(base[2 * i + 1] * a); }
      else if (Array.isArray(a)) { p[2 * i] = base[2 * i] + a[0]; p[2 * i + 1] = base[2 * i + 1] + a[1]; }
      else { p[2 * i] = Math.round(base[2 * i] * a.x[0]); p[2 * i + 1] = Math.round(base[2 * i + 1] * a.x[1]); }
    }
  }
  return p;
}
/** Styled evaluation weights and contempt for a style (null for universal or a style without an eval profile). */
export function styledWeights(style: StyleId, base: EvalWeights, defs: Partial<Record<StyleId, StyleEval>> = STYLE_EVAL): { weights: EvalWeights; contempt: number } | null {
  const d = defs[style];
  if (!d || base.version !== 4) return null;
  // memoised per (base weights, definition): the same parameter arrays are reused move after move, so the
  // evaluator's per-weights tables stay warm (results are identical either way)
  let m = memo.get(base);
  if (!m) { m = new WeakMap(); memo.set(base, m); }
  const hit = m.get(d);
  if (hit) return hit;
  const r = { weights: { ...base, own: d.own ? scaled(base.p, d.own) : undefined, opp: d.opp ? scaled(base.p, d.opp) : undefined, simplify: d.simplify }, contempt: d.contempt };
  m.set(d, r);
  return r;
}
const memo = new WeakMap<EvalWeights, WeakMap<StyleEval, { weights: EvalWeights; contempt: number }>>();
const V = validation as unknown as { id: string; validated: StyleId[]; repertoireStyles?: StyleId[]; fullGame?: StyleId[]; results: Record<string, unknown> };
export const STYLE_VALIDATION_ID = V.id;
/** A style is shown and played if any of its components passed validation. */
export const isValidatedStyle = (s: StyleId) => s === 'universal' || V.validated.includes(s);
/** The opening repertoire is used only by styles whose repertoire passed (crown-styles-3). */
export const usesRepertoire = (s: StyleId) => s !== 'universal' && (V.repertoireStyles ?? V.validated).includes(s);
/** The full-game styled evaluation is used only by styles that passed the full-game validation. */
export const usesStyleEval = (s: StyleId) => s !== 'universal' && (V.fullGame ?? []).includes(s);
/** The style actually used in play: unvalidated styles fall back to Universal. */
export const playStyle = (s: StyleId): StyleId => (isValidatedStyle(s) ? s : 'universal');
