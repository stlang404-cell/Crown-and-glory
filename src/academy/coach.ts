/**
 * Evidence-templated local coach (coach id crown-coach-0). Every note is derived from actual engine
 * continuations replayed with the production rules: material changes along the line, captured
 * pieces, attacked targets and mate scores. Nothing is inferred about intent or emotion.
 */
import { Position } from '../rules/position';
import { KING, KNIGHT, PAWN, ROOK, Move, moveTo, pieceColor, pieceType, squareName, Color } from '../rules/types';
import { moveToSan, parseLegalCcn } from '../rules/notation';
import { KING_TARGETS, KNIGHT_TARGETS, PAWN_ATTACKS, RAYS } from '../rules/tables';
import type { Candidate, CoachNote } from '../analysis/types';

export const COACH_ID = 'crown-coach-0';
export const PIECE_NAME = ['', 'pawn', 'knight', 'rook', 'queen', 'king'];
const VAL = [0, 100, 320, 480, 920, 0];

export const TOPICS: Record<string, string> = {
  'hanging-pieces': 'Hanging pieces: check what every move leaves undefended',
  'knight-forks': 'Knight forks on the 6×6 board',
  'double-attacks': 'Double attacks and multiple threats',
  'mating-nets': 'Mating patterns and king safety',
  'threat-awareness': "Opponent's threats before your move",
  'promotion-races': 'Pawn promotion races (promotion is only four steps away)',
  'converting-advantages': 'Converting winning positions',
  'calculation': 'Calculation: forcing lines',
};

function material(pos: Position, color: Color): number {
  let m = 0;
  for (let sq = 0; sq < 36; sq++) {
    const p = pos.board[sq];
    if (p && pieceColor(p) === color) m += VAL[pieceType(p)];
  }
  return m;
}

/** Squares attacked by the piece on `sq`. */
export function attacksFrom(pos: Position, sq: number): number[] {
  const p = pos.board[sq];
  if (!p) return [];
  const t = pieceType(p), c = pieceColor(p);
  if (t === PAWN) return [...PAWN_ATTACKS[c][sq]];
  if (t === KNIGHT) return [...KNIGHT_TARGETS[sq]];
  if (t === KING) return [...KING_TARGETS[sq]];
  const out: number[] = [];
  const dEnd = t === ROOK ? 4 : 8;
  for (let d = 0; d < dEnd; d++) {
    for (const s of RAYS[sq][d]) { out.push(s); if (pos.board[s]) break; }
  }
  return out;
}

/** Enemy pieces (value >= knight, or king) attacked by the piece on `sq`. */
export function valuableTargets(pos: Position, sq: number): number[] {
  const c = pieceColor(pos.board[sq]);
  return attacksFrom(pos, sq).filter(s => {
    const q = pos.board[s];
    return q && pieceColor(q) !== c && (pieceType(q) >= KNIGHT);
  });
}

function describeTargets(pos: Position, squares: number[]): string {
  return squares.map(s => `${PIECE_NAME[pieceType(pos.board[s])]} on ${squareName(s)}`).join(' and ');
}

/** Follow a CCN line and report net material change for `color` and the first capture. */
function lineFacts(start: Position, line: string[], color: Color, maxPlies = 6) {
  const p = start.clone();
  const m0 = material(p, color) - material(p, (color ^ 1) as Color);
  let firstCapture: { ply: number; piece: number; square: number; byColor: Color } | null = null;
  let promoted = false;
  let mate = false;
  for (let i = 0; i < Math.min(line.length, maxPlies); i++) {
    const m = parseLegalCcn(p, line[i]);
    if (m < 0) break;
    const victim = p.board[moveTo(m)];
    if (victim && !firstCapture) firstCapture = { ply: i, piece: pieceType(victim), square: moveTo(m), byColor: p.side };
    if (line[i].length === 5) promoted = true;
    p.makeMove(m);
    if (!p.hasLegalMove() && p.inCheck()) { mate = true; break; }
  }
  const m1 = material(p, color) - material(p, (color ^ 1) as Color);
  return { delta: m1 - m0, firstCapture, promoted, mate };
}

const san = (pos: Position, line: string[], n = 6): string[] => {
  const p = pos.clone();
  const out: string[] = [];
  for (const s of line.slice(0, n)) {
    const m = parseLegalCcn(p, s);
    if (m < 0) break;
    out.push(moveToSan(p, m));
    p.makeMove(m);
  }
  return out;
};

export interface CoachInput {
  pre: Position;
  mover: Color;
  played: Candidate;
  best: Candidate;
  loss: number | null;
  depth: number;
}

export function coachNotes(i: CoachInput): CoachNote[] {
  const notes: CoachNote[] = [];
  const { pre, mover, played, best, loss, depth } = i;
  const significant = loss !== null && loss > 0.05;
  const evidence = `Engine line at depth ${depth}; heuristic, not a proof of every defence.`;
  // 1. After the played move: what does the engine's reply do?
  if (significant && played.pv.length >= 2) {
    const after = pre.clone();
    after.makeMove(parseLegalCcn(after, played.pv[0]));
    const reply = played.pv[1];
    const facts = lineFacts(after, played.pv.slice(1), mover);
    const replySan = san(after, [reply], 1)[0];
    const lineSan = san(after, played.pv.slice(1));
    if (played.score.kind === 'mate' && played.score.plies < 0) {
      notes.push({ kind: 'allowed-mate', topic: 'mating-nets', line: lineSan, evidence,
        text: `After ${played.san}, the engine finds a forced mate for your opponent starting with ${replySan} (${lineSan.join(' ')}).` });
    } else if (facts.firstCapture && facts.firstCapture.byColor !== mover && facts.delta <= -200) {
      const moved = moveTo(parseLegalCcn(pre, played.ccn));
      const isMovedPiece = facts.firstCapture.square === moved;
      notes.push({
        kind: isMovedPiece ? 'hanging-piece' : 'allowed-tactic', topic: isMovedPiece ? 'hanging-pieces' : 'threat-awareness', line: lineSan, evidence,
        text: `After ${played.san}, ${replySan} wins material: your ${PIECE_NAME[facts.firstCapture.piece]} on ${squareName(facts.firstCapture.square)} falls ` +
          `(net ${Math.round(-facts.delta / 100)} pawn${Math.round(-facts.delta / 100) === 1 ? '' : 's'} of material along ${lineSan.join(' ')}).`,
      });
    }
    // Fork check: does the reply piece attack two or more valuable pieces?
    const rm = parseLegalCcn(after, reply);
    if (rm >= 0) {
      after.makeMove(rm);
      const targets = valuableTargets(after, moveTo(rm));
      if (targets.length >= 2) {
        const pt = pieceType(after.board[moveTo(rm)]);
        notes.push({ kind: 'fork', topic: pt === KNIGHT ? 'knight-forks' : 'double-attacks', line: lineSan, evidence,
          text: `${replySan} attacks your ${describeTargets(after, targets)} at the same time.` });
      }
    }
  }
  // 2. Missed opportunity: the best move wins material or mates.
  if (significant && best.ccn !== played.ccn) {
    const facts = lineFacts(pre, best.pv, mover);
    const bestLine = san(pre, best.pv);
    if (best.score.kind === 'mate' && best.score.plies > 0) {
      notes.push({ kind: 'missed-mate', topic: 'mating-nets', line: bestLine, evidence,
        text: `You had a forced mate (engine): ${bestLine.join(' ')}.` });
    } else if (facts.delta >= 200) {
      notes.push({ kind: 'missed-win', topic: facts.promoted ? 'promotion-races' : 'calculation', line: bestLine, evidence,
        text: `${best.san} was stronger: along ${bestLine.join(' ')} you win about ${Math.round(facts.delta / 100)} pawns of material.` });
    } else if (facts.promoted) {
      notes.push({ kind: 'promotion', topic: 'promotion-races', line: bestLine, evidence,
        text: `${best.san} pushes toward promotion: ${bestLine.join(' ')}.` });
    }
    const bm = parseLegalCcn(pre, best.ccn);
    if (bm >= 0) {
      const p2 = pre.clone();
      p2.makeMove(bm);
      const targets = valuableTargets(p2, moveTo(bm));
      if (targets.length >= 2 && facts.delta >= 100) {
        const pt = pieceType(p2.board[moveTo(bm)]);
        notes.push({ kind: 'fork', topic: pt === KNIGHT ? 'knight-forks' : 'double-attacks', line: bestLine, evidence,
          text: `${best.san} would have attacked the ${describeTargets(p2, targets)} at once.` });
      }
    }
  }
  return notes;
}

/**
 * Material invested by a move according to the engine line: the material deficit must persist both after
 * the opponent's reply AND after the mover's own next move, so an ordinary exchange (capture, recapture)
 * is not a sacrifice.
 */
export function sacrificedMaterial(pre: Position, m: Move, pv: string[]): number {
  const mover = pre.side;
  const bal = (p: Position) => material(p, mover) - material(p, (mover ^ 1) as Color);
  const p = pre.clone();
  const before = bal(p);
  p.makeMove(m);
  if (pv.length < 2) return 0;
  const r = parseLegalCcn(p, pv[1]);
  if (r < 0) return 0;
  p.makeMove(r);
  const d1 = before - bal(p);
  if (pv.length < 3) return Math.max(0, d1);
  const f = parseLegalCcn(p, pv[2]);
  if (f < 0) return Math.max(0, d1);
  p.makeMove(f);
  const d2 = before - bal(p);
  return Math.max(0, Math.min(d1, d2));
}

