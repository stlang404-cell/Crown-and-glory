/**
 * Study Match "why" explanations (crown-study-explain-1): every sentence is a template filled ONLY from engine output —
 * the engine's move, its principal variation, its score and search depth, the standard analysis of a move (grade,
 * expected-score loss, evaluations before/after) — and from replaying that engine line on the board (material
 * balance and checkmate at the end of the line). Nothing is invented: when the engine data does not support a
 * sentence, the sentence is left out. Every explanation is labelled as an engine estimate at its depth; none claims
 * to be perfect analysis.
 */
import { Position } from '../rules/position';
import { parseLegalCcn } from '../rules/notation';
import { toPov } from '../analysis/methodology';
import type { EngineScore, Grade, Pov } from '../analysis/types';
import type { StudyFeedback } from './study';

export const EXPLAIN_ID = 'crown-study-explain-1';
/** Piece values used for the material count along an engine line (pawn units, shown to the learner). */
export const MATERIAL_VALUES = { p: 1, n: 3, r: 5, q: 9, k: 0 } as const;
export const MATERIAL_KEY = 'pawn 1, knight 3, rook 5, queen 9';
const PV_SHOWN = 8;

export const STUDY_GRADE_LABEL: Record<Grade, string> = {
  brilliant: 'Brilliant', great: 'Great', best: 'Best', excellent: 'Excellent', good: 'Good', inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder',
};

/** Material from a FEN, in pawn units, per side. */
export function materialOf(fen: string): { white: number; black: number } {
  const out = { white: 0, black: 0 };
  for (const ch of fen.split(' ')[0]) {
    const v = MATERIAL_VALUES[ch.toLowerCase() as keyof typeof MATERIAL_VALUES];
    if (v === undefined) continue;
    if (ch === ch.toUpperCase()) out.white += v; else out.black += v;
  }
  return out;
}

export interface LineFacts {
  /** Engine-line moves that were replayed (all of them unless the line was not legal from here). */
  applied: number;
  /** Material change for `pov` from the start to the end of the replayed line (pawn units). */
  materialDelta: number;
  endsInMate: boolean;
  matedSide: Pov | null;
}

/** Replay an engine line (CCN) from a FEN and measure what concretely happens on it. */
export function lineFacts(fen: string, pv: string[], pov: Pov): LineFacts {
  const pos = Position.fromFen(fen);
  const before = materialOf(fen);
  let applied = 0;
  for (const c of pv) {
    const m = parseLegalCcn(pos, c);
    if (m < 0) break;
    pos.makeMove(m);
    applied++;
  }
  const after = materialOf(pos.toFen());
  const me = (x: { white: number; black: number }) => (pov === 'white' ? x.white - x.black : x.black - x.white);
  const mate = applied > 0 && pos.legalMoves().length === 0 && pos.inCheck();
  return { applied, materialDelta: me(after) - me(before), endsInMate: mate, matedSide: mate ? (pos.side === 0 ? 'white' : 'black') : null };
}

/** A score from `pov`'s side: "+0.45", "−1.20", "mate in 2", "mate in 3 against you", "drawn". */
export function scoreText(s: EngineScore, pov: Pov): string {
  const t = toPov(s, pov);
  if (t.kind === 'cp') { const v = t.value / 100; return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`; }
  if (t.kind === 'mate') { const n = Math.max(1, Math.ceil(Math.abs(t.plies) / 2)); return t.plies > 0 ? `mate in ${n} for you` : `mate in ${n} against you`; }
  return t.outcome === 'draw' ? 'drawn' : t.outcome === 'win' ? 'won for you' : 'lost for you';
}

const pts = (n: number) => `${n} point${n === 1 ? '' : 's'}`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function materialSentence(f: LineFacts, who: string): string | null {
  if (f.applied === 0) return null;
  if (f.materialDelta > 0) return `${who} you win ${pts(f.materialDelta)} of material (${MATERIAL_KEY}).`;
  if (f.materialDelta < 0) return `${who} you lose ${pts(-f.materialDelta)} of material (${MATERIAL_KEY}).`;
  return `${who} the material balance does not change.`;
}

function mateSentence(f: LineFacts, pov: Pov): string | null {
  if (!f.endsInMate) return null;
  return f.matedSide === pov ? 'The engine line ends with you checkmated.' : 'The engine line ends in checkmate for you.';
}

export const estimateLabel = (depth: number, what = 'Engine estimate') => `${what}, depth ${depth} — not a perfect analysis.`;

export interface EngineCandidate { ccn: string; san: string; score: EngineScore; pv: string[]; pvSan: string[] }

/** Why the engine prefers its best move here: its line, its score, and the material/mate consequence on that line. */
export function explainBestMove(o: { fen: string; pov: Pov; candidate: EngineCandidate; depth: number }): string[] {
  const c = o.candidate;
  const lines = [estimateLabel(o.depth)];
  lines.push(`Best move: ${c.san} (evaluation ${scoreText(c.score, o.pov)}).`);
  const pvSan = c.pvSan.slice(0, PV_SHOWN);
  if (pvSan.length > 1) lines.push(`Engine line: ${pvSan.join(' ')}${c.pvSan.length > PV_SHOWN ? ' …' : ''}.`);
  const f = lineFacts(o.fen, c.pv, o.pov);
  const mat = materialSentence(f, 'Along this line');
  if (mat) lines.push(mat);
  const mate = mateSentence(f, o.pov);
  if (mate) lines.push(mate);
  else if (c.score.kind === 'mate') lines.push(`The engine’s score is ${scoreText(c.score, o.pov)} (engine estimate, not a proof).`);
  return lines;
}

/** The engine hint: only the square of the piece to move, from the engine's best move. */
export function hintText(c: EngineCandidate, depth: number): string {
  return `Engine hint (depth ${depth}): consider moving the piece on ${c.ccn.slice(0, 2)}.`;
}

/** Move-quality feedback for one of the learner's moves, from its standard analysis. */
export function explainFeedback(f: StudyFeedback, pov: Pov): { headline: string; lines: string[] } {
  const label = f.grade ? STUDY_GRADE_LABEL[f.grade] : 'Not graded';
  const loss = f.loss !== null ? `expected-score loss ${f.loss.toFixed(2)}` : 'no confident grade (the engine evidence was unstable between depths)';
  const headline = `${f.san}: ${label}${f.provisional && f.grade ? ' (provisional)' : ''} — ${loss}`;
  const lines = [estimateLabel(f.depth, `Standard analysis (${f.settingsId})`)];
  if (f.forced) lines.push('It was your only legal move.');
  lines.push(`Evaluation: ${scoreText(f.evalBefore, pov)} with the engine’s best move, ${scoreText(f.evalAfter, pov)} after ${f.san}.`);
  if (f.bestSan && f.bestSan !== f.san) {
    const pv = f.bestPvSan.slice(0, PV_SHOWN);
    lines.push(`The engine preferred ${f.bestSan}${pv.length > 1 ? `: ${pv.join(' ')}` : ''}.`);
    const played = lineFacts(f.fenBefore, f.playedPv, pov);
    const best = lineFacts(f.fenBefore, f.bestPv, pov);
    if (played.applied > 1 && best.applied > 1 && played.materialDelta !== best.materialDelta) {
      lines.push(`Material on the engine line after ${f.san}: ${signed(played.materialDelta)}; after ${f.bestSan}: ${signed(best.materialDelta)} (${MATERIAL_KEY}).`);
    }
    const pm = mateSentence(played, pov);
    if (pm && played.matedSide === pov) lines.push(`After ${f.san}, ${pm.charAt(0).toLowerCase()}${pm.slice(1)}`);
    const bm = mateSentence(best, pov);
    if (bm && best.matedSide !== pov) lines.push(`After ${f.bestSan}, ${bm.charAt(0).toLowerCase()}${bm.slice(1)}`);
  } else if (f.bestSan === f.san) {
    lines.push(`${f.san} was the engine’s own choice.`);
  }
  if (f.playedPvSan.length > 1) lines.push(`Engine line after ${f.san}: ${f.playedPvSan.slice(0, PV_SHOWN).join(' ')}.`);
  return { headline, lines };
}
