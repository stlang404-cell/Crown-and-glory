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
 * crown-styles-6 (v0.10) redesigns Aggressive, adds Gambiteer, Materialist and Complication seeker (the last one
 * failed and is not played) and a measured scouting summary per played style (styleTendency).
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
  gambiteer: 'Gambiteer', materialist: 'Materialist', complicator: 'Complication seeker',
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
export const STYLES_EVAL_ID = 'crown-styles-6';
export const STYLE_EVAL: Partial<Record<StyleId, StyleEval>> = {
  // more value on attacking enemy pieces (threats, hanging pieces) and on king-zone attackers
  tactical: { own: { HANGING: [25, 10], THREAT_PAWN: [20, 5], THREAT_MINOR: [20, 5], THREAT_ROOK: [20, 5], KING_ATTACKERS: [8, 0] }, contempt: 15 },
  // structure and piece placement over immediate threats
  positional: { own: { THREAT_PAWN: 0.85, THREAT_MINOR: 0.85, THREAT_ROOK: 0.85, HANGING: 0.85, SUPPORTED: [8, 4], PHALANX: [8, 4], OUTPOST: [20, 10], MOB: 1.1 }, contempt: 0 },
  // crown-styles-6 king hunt with a sound king: more weight on king-zone attackers, attack weight and tropism
  // (middlegame only), its own shelter and open king files weigh more and the opponent's attack looks bigger, so
  // it attacks without leaving its own king exposed; draw avoidance. (crown-styles-5 version, which failed:
  // own KING_ATTACKERS +25, KING_ATTACK +2, TROPISM +8, contempt 35.)
  aggressive: { own: { KING_ATTACKERS: [15, 0], KING_ATTACK: [1, 0], TROPISM: [6, 0], KING_SHIELD: [10, 0], KING_OPEN: [-10, 0] }, opp: { KING_ATTACKERS: [8, 0], KING_ATTACK: [1, 0] }, contempt: 25 },
  // safety first: own shelter and open king files weigh more, the opponent's attack and threats look bigger,
  // the opponent's queen is feared (queens off is welcome), and a draw is acceptable when not better
  defensive: { own: { KING_SHIELD: [10, 0], KING_OPEN: [-10, 0] }, opp: { KING_ATTACKERS: [10, 0], KING_ATTACK: [1, 0], TROPISM: [3, 0], HANGING: [15, 5], 'MAT.4': [20, 0] }, contempt: -20 },
  // conversion: trades when ahead (simplify), passed pawns and an active king weigh more in the endgame,
  // queens off is welcome
  endgame: { own: { PASSED: { x: [1, 1.5] }, PASSED_FREE: { x: [1, 1.5] }, PASSED_OWNK: { x: [1, 1.5] }, UNSTOPPABLE: [0, 60], 'PST.5': { x: [1, 1.5] } }, opp: { 'MAT.4': [25, 0] }, contempt: 15, simplify: 100 },
  // crown-styles-6 gambiteer: its own pawns are worth 15 cp less in the middlegame (gives pawns for play), more
  // value on mobility and king-zone attackers, draw avoidance
  gambiteer: { own: { 'MAT.1': [-15, 0], MOB: 1.15, KING_ATTACKERS: [10, 0] }, contempt: 25 },
  // crown-styles-6 materialist: all material (own and the opponent's) counts 15 % more against positional terms
  materialist: { own: { MAT: 1.15 }, opp: { MAT: 1.15 }, contempt: 0 },
  // crown-styles-6 complication seeker: its own knights, rooks and queen are worth 30 cp more in the middlegame,
  // so even trades look bad and pieces stay on; draw avoidance
  complicator: { own: { 'MAT.2': [30, 0], 'MAT.3': [30, 0], 'MAT.4': [30, 0] }, contempt: 30 },
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

// ---------------------------------------------------------------------------------------------------------
// Scouting (crown-styles-6): a short tendency summary per style, built from the measured game statistics in
// styles-validation.json (fullGameResults, 200 games vs Universal at 8 000 nodes; docs/STYLES_REPORT.md).
// Only styles that are actually played (usesStyleEval) get one; every number comes from the measurement.
type SideStats = { capturesPerGame: number; checksPerGame: number; kingZoneAttacksPerMove: number; attacksSufferedPerMove: number; behindRate?: number; aheadRate?: number };
type GameStats = { games: number; avgPlies: number; drawRate: number; medianQueensOffPly: number | null; piecesAt40?: number; styledPawnsAt30?: number; universalPawnsAt30?: number };
type StyleResult = { games: GameStats; styledSide: SideStats; universalSide: SideStats };
const pct = (x: number) => `${Math.round(x * 100)} %`;
const rel = (a: number, b: number) => `${Math.round(Math.abs(a / b - 1) * 100)} %`;
const TENDENCY: Partial<Record<StyleId, (r: StyleResult, u: { games: GameStats; side: SideStats }) => string>> = {
  tactical: (r, u) => `Seeks tactics: draws ${pct(r.games.drawRate)} of games (standard engine ${pct(u.games.drawRate)}) and makes slightly more captures and checks than its opponents.`,
  positional: r => `Quiet, structural play: slightly fewer checks than its opponents (${r.styledSide.checksPerGame} vs ${r.universalSide.checksPerGame} per game).`,
  defensive: (r, u) => `Safety first: its king zone is attacked ${rel(r.styledSide.attacksSufferedPerMove, r.universalSide.attacksSufferedPerMove)} less often than its opponents'; draws ${pct(r.games.drawRate)} (standard engine ${pct(u.games.drawRate)}) and trades queens early.`,
  endgame: (r, u) => `Heads for the ending: queens are off by ply ${r.games.medianQueensOffPly} at the median (standard engine ${u.games.medianQueensOffPly}), and its games run long (${r.games.avgPlies} plies; standard engine ${u.games.avgPlies}).`,
  aggressive: (r, u) => `Hunts the king: ${rel(r.styledSide.kingZoneAttacksPerMove, r.universalSide.kingZoneAttacksPerMove)} more attacks on the enemy king zone than its opponents, ${r.styledSide.checksPerGame} checks per game (standard engine ${+u.side.checksPerGame.toFixed(2)}); draws ${pct(r.games.drawRate)} (standard engine ${pct(u.games.drawRate)}).`,
  gambiteer: r => `Gives material for activity: behind on material after ${pct(r.styledSide.behindRate ?? 0)} of its moves (its opponents ${pct(r.universalSide.behindRate ?? 0)}), with slightly more pressure on the enemy king.`,
  materialist: r => `Counts the material: behind on material after only ${pct(r.styledSide.behindRate ?? 0)} of its moves (its opponents ${pct(r.universalSide.behindRate ?? 0)}) and ahead after ${pct(r.styledSide.aheadRate ?? 0)} (its opponents ${pct(r.universalSide.aheadRate ?? 0)}).`,
  complicator: (r, u) => `Keeps the pieces on: ${r.games.piecesAt40} knights, rooks and queens left at ply 40 (standard engine ${u.games.piecesAt40 ?? '—'}), queens off later and fewer draws.`,
};
/** Measured tendency summary for the scouting profile, or null for Universal and styles that are not played. */
export function styleTendency(s: StyleId): string | null {
  if (!usesStyleEval(s)) return null;
  const R = (V as unknown as { fullGameResults?: Record<string, unknown> }).fullGameResults;
  const r = R?.[s] as StyleResult | undefined, u = R?.universal as { games: GameStats; side: SideStats } | undefined;
  const f = TENDENCY[s];
  return r && u && f ? `${f(r, u)} (Measured over ${r.games.games} games against the standard engine.)` : null;
}
