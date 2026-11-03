/**
 * Tactical motif detectors (crown-motifs-1). Pure functions on legal positions; each returns the
 * concrete squares/pieces involved so explanations can cite them. Detectors describe geometry only;
 * whether a motif actually wins is decided by engine search elsewhere.
 */
import { Position } from '../rules/position';
import { Color, KING, KNIGHT, Move, PAWN, QUEEN, ROOK, moveFrom, moveTo, movePromo, pieceColor, pieceType } from '../rules/types';
import { KING_TARGETS, KNIGHT_TARGETS, PAWN_ATTACKS, RAYS } from '../rules/tables';
import { see } from '../engine/search';

export const MOTIFS_ID = 'crown-motifs-1';
export const VALUE = [0, 100, 320, 480, 920, 10000];

export type Motif = 'fork' | 'pin' | 'skewer' | 'discovered-attack' | 'hanging-piece' | 'mate' | 'promotion' | 'defensive' | 'endgame' | 'calculation' | 'evaluation' | 'mate-threat';

export const MOTIF_LABEL: Record<Motif, string> = {
  fork: 'Fork', pin: 'Pin', skewer: 'Skewer', 'discovered-attack': 'Discovered attack', 'hanging-piece': 'Hanging piece',
  mate: 'Checkmate', promotion: 'Promotion race', defensive: 'Defensive resource', endgame: 'Endgame technique',
  calculation: 'Calculation', evaluation: 'Position evaluation', 'mate-threat': 'Mate threat',
};

export function attacksFrom(pos: Position, sq: number): number[] {
  const p = pos.board[sq];
  if (!p) return [];
  const t = pieceType(p), c = pieceColor(p);
  if (t === PAWN) return [...PAWN_ATTACKS[c][sq]];
  if (t === KNIGHT) return [...KNIGHT_TARGETS[sq]];
  if (t === KING) return [...KING_TARGETS[sq]];
  const out: number[] = [];
  for (let d = 0; d < (t === ROOK ? 4 : 8); d++) for (const s of RAYS[sq][d]) { out.push(s); if (pos.board[s]) break; }
  return out;
}

const enemyAt = (pos: Position, s: number, c: Color) => { const q = pos.board[s]; return q && pieceColor(q) !== c ? q : 0; };

/** Is the piece on `sq` defended by its own side (x-rays ignored)? */
export function isDefended(pos: Position, sq: number): boolean {
  const c = pieceColor(pos.board[sq]);
  return pos.isAttacked(sq, c);
}

export interface MotifHit { motif: Motif; squares: number[]; detail: string }

/** Fork: after the move, the moved piece attacks two or more enemy targets worth ≥ a knight (or the king). */
export function detectFork(after: Position, m: Move): MotifHit | null {
  const to = moveTo(m);
  const c = pieceColor(after.board[to]);
  const targets = attacksFrom(after, to).filter(s => { const q = enemyAt(after, s, c); return q && (pieceType(q) >= KNIGHT); });
  if (targets.length < 2) return null;
  // must attack something more valuable than itself or undefended
  const own = VALUE[pieceType(after.board[to])];
  const meaningful = targets.filter(s => VALUE[pieceType(after.board[s])] > own || !isDefended(after, s) || pieceType(after.board[s]) === KING);
  if (meaningful.length < 2 && !targets.some(s => pieceType(after.board[s]) === KING)) return null;
  return { motif: 'fork', squares: [to, ...targets], detail: `${pieceType(after.board[to]) === KNIGHT ? 'knight' : 'piece'} fork` };
}

/** Pin / skewer along a slider ray from the moved piece (or any of the mover's sliders). */
export function detectLineTactics(after: Position, mover: Color): MotifHit[] {
  const hits: MotifHit[] = [];
  for (let sq = 0; sq < 36; sq++) {
    const p = after.board[sq];
    if (!p || pieceColor(p) !== mover) continue;
    const t = pieceType(p);
    if (t !== ROOK && t !== QUEEN) continue;
    for (let d = 0; d < (t === ROOK ? 4 : 8); d++) {
      const ray = RAYS[sq][d];
      let first = -1;
      for (const s of ray) {
        const q = after.board[s];
        if (!q) continue;
        if (first < 0) { if (pieceColor(q) === mover) break; first = s; continue; }
        if (pieceColor(q) === mover) break;
        const v1 = VALUE[pieceType(after.board[first])], v2 = VALUE[pieceType(q)];
        if (v2 > v1 && v2 > VALUE[t] - 1) hits.push({ motif: 'pin', squares: [sq, first, s], detail: pieceType(q) === KING ? 'absolute pin' : 'relative pin' });
        else if (v1 > v2 && v1 >= VALUE[ROOK] && pieceType(after.board[first]) !== PAWN) hits.push({ motif: 'skewer', squares: [sq, first, s], detail: 'skewer' });
        break;
      }
    }
  }
  return hits;
}

/** Discovered attack: moving piece unblocks a friendly slider which now attacks a valuable enemy piece or king. */
export function detectDiscovered(before: Position, m: Move): MotifHit | null {
  const from = moveFrom(m), to = moveTo(m);
  const mover = before.side;
  const after = before.clone();
  after.makeMove(m);
  for (let sq = 0; sq < 36; sq++) {
    const p = after.board[sq];
    if (!p || pieceColor(p) !== mover || sq === to) continue;
    const t = pieceType(p);
    if (t !== ROOK && t !== QUEEN) continue;
    for (let d = 0; d < (t === ROOK ? 4 : 8); d++) {
      const ray = RAYS[sq][d];
      if (!ray.includes(from)) continue;
      for (const s of ray) {
        const q = after.board[s];
        if (!q) continue;
        if (pieceColor(q) !== mover && (pieceType(q) === KING || VALUE[pieceType(q)] >= VALUE[KNIGHT])) {
          // was it blocked before?
          const idxFrom = ray.indexOf(from), idxS = ray.indexOf(s);
          if (idxFrom >= 0 && idxFrom < idxS) return { motif: 'discovered-attack', squares: [sq, from, s], detail: pieceType(q) === KING ? 'discovered check' : 'discovered attack' };
        }
        break;
      }
    }
  }
  return null;
}

/** Capturing a piece that cannot be profitably recaptured. */
export function detectHangingCapture(before: Position, m: Move): MotifHit | null {
  const victim = before.board[moveTo(m)];
  if (!victim) return null;
  const gain = see(before, m);
  if (gain >= VALUE[pieceType(victim)] - 1 && VALUE[pieceType(victim)] >= VALUE[KNIGHT]) return { motif: 'hanging-piece', squares: [moveTo(m)], detail: 'undefended piece captured' };
  return null;
}

/**
 * Threats against `color` if it were the opponent's turn: best static exchange the opponent could win,
 * and whether the opponent has a mate in one.
 */
export function threatsAgainst(pos: Position, color: Color): { bestGain: number; square: number; mateInOne: boolean } {
  const p = pos.clone();
  if (p.side === color) {
    if (p.inCheck()) return { bestGain: 0, square: -1, mateInOne: false };
    p.makeNullMove();
  }
  let bestGain = 0, square = -1, mateInOne = false;
  for (const m of p.legalMoves()) {
    if (p.board[moveTo(m)]) { const g = see(p, m); if (g > bestGain) { bestGain = g; square = moveTo(m); } }
    p.makeMove(m);
    if (p.inCheck() && !p.hasLegalMove()) mateInOne = true;
    p.unmakeMove();
  }
  return { bestGain, square, mateInOne };
}

export function isQuiet(pos: Position, m: Move): boolean {
  if (pos.board[moveTo(m)] || movePromo(m)) return false;
  const p = pos.clone();
  p.makeMove(m);
  return !p.inCheck();
}

/** All motifs present in a solution line (player moves at even indices). */
export function motifsForLine(start: Position, line: Move[], finalMate: boolean): MotifHit[] {
  const hits: MotifHit[] = [];
  const p = start.clone();
  const mover = p.side;
  const threats = threatsAgainst(start, mover);
  if (threats.bestGain >= 200 || threats.mateInOne) hits.push({ motif: 'defensive', squares: threats.square >= 0 ? [threats.square] : [], detail: threats.mateInOne ? 'mate threat against you' : 'material under attack' });
  line.forEach((m, i) => {
    if (i % 2 === 0) {
      const hang = detectHangingCapture(p, m); if (hang) hits.push(hang);
      const disc = detectDiscovered(p, m); if (disc) hits.push(disc);
      if (movePromo(m)) hits.push({ motif: 'promotion', squares: [moveTo(m)], detail: 'promotion' });
      p.makeMove(m);
      const fork = detectFork(p, m); if (fork) hits.push(fork);
      hits.push(...detectLineTactics(p, mover).filter(h => h.squares.includes(moveTo(m))));
      if (!p.inCheck()) {
        const t = threatsAgainst(p, (mover ^ 1) as Color);
        if (t.mateInOne) hits.push({ motif: 'mate-threat', squares: [], detail: 'threatens mate' });
      }
    } else p.makeMove(m);
  });
  if (finalMate) hits.push({ motif: 'mate', squares: [], detail: 'forced mate' });
  const seen = new Set<string>();
  return hits.filter(h => { const k = h.motif; if (seen.has(k)) return false; seen.add(k); return true; });
}
