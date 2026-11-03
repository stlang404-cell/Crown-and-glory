/**
 * Reproducible puzzle verification (crown-puzzle-verify-1). Fresh transposition table for every check, so
 * the result depends only on the position, engine build and policy:
 *  - every legal move scored at depth 3; the top 4 plus the solution move re-scored exactly at depth 8;
 *  - the solution's first move must be best with an expected-score gap >= 0.20 (s = 200 cp) and the
 *    second-best move must not be a winning mate;
 *  - every later player move of the line is checked the same way at depth 7 after the stored reply.
 * crown-puzzle-verify-2 (v0.5): the same policy on the canonical engine (crown-intel-1: crown-search-2 +
 * crown-eval-4), plus a defence check — every stored opponent reply must be the engine's best reply or within
 * 0.05 expected score of it at depth 7 — so a puzzle can no longer rely on a weak defence.
 */
import { Position } from '../rules/position';
import { parseLegalCcn } from '../rules/notation';
import { Searcher, isMateScore, type SearchFeatures } from '../engine/search';
import type { EvalWeights } from '../engine/evaluate';
import { CANON_OPTS } from '../engine/canonical';

export const VERIFY_ID_V1 = 'crown-puzzle-verify-1';
export const VERIFY_ID = 'crown-puzzle-verify-2';
type Opts = { features?: SearchFeatures; weights?: EvalWeights };
const u = (x: number) => (isMateScore(x) ? (x > 0 ? 1 : 0) : 1 / (1 + Math.exp(-x / 200)));

function check(s: Searcher, pos: Position, moveCcn: string, depth: number, o: Opts = {}): { ok: boolean; gap: number; best: number } {
  s.newGame();
  const target = parseLegalCcn(pos, moveCcn);
  const legal = pos.legalMoves();
  if (target < 0 || legal.length < 2) return { ok: false, gap: 0, best: 0 };
  const screen = s.scoreRootMoves(pos, legal, 3, o).sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.move);
  if (!screen.includes(target)) screen.push(target);
  s.newGame();
  const ex = s.scoreRootMoves(pos, screen, depth, o).sort((a, b) => b.score - a.score);
  const gap = u(ex[0].score) - u(ex[1].score);
  const ok = ex[0].move === target && gap >= 0.2 - 1e-9 && !(isMateScore(ex[1].score) && ex[1].score > 0);
  return { ok, gap, best: ex[0].score };
}

/** Is the stored defence the engine's best reply (or within 0.05 expected score of it)? */
function defenceOk(s: Searcher, pos: Position, replyCcn: string, o: Opts): boolean {
  s.newGame();
  const target = parseLegalCcn(pos, replyCcn);
  const legal = pos.legalMoves();
  if (target < 0) return false;
  if (legal.length < 2) return true;
  const sc = s.scoreRootMoves(pos, legal, 7, o).sort((a, b) => b.score - a.score);
  const mine = sc.find(x => x.move === target);
  return !!mine && u(sc[0].score) - u(mine.score) <= 0.05 + 1e-9;
}

/** v0.5 canonical verification (crown-puzzle-verify-2). `legacy` reproduces crown-puzzle-verify-1 exactly. */
export function verifyPuzzle(s: Searcher, p: { fen: string; solution: string[] }, legacy = false): { ok: boolean; gap: number; steps: number; defence?: boolean } {
  const o: Opts = legacy ? {} : CANON_OPTS;
  const pos = Position.fromFen(p.fen);
  const first = check(s, pos, p.solution[0], 8, o);
  if (!first.ok) return { ok: false, gap: first.gap, steps: 0 };
  let steps = 1;
  pos.makeMove(parseLegalCcn(pos, p.solution[0]));
  for (let i = 1; i + 1 < p.solution.length; i += 2) {
    if (!legacy && !defenceOk(s, pos, p.solution[i], o)) return { ok: false, gap: first.gap, steps, defence: false };
    pos.makeMove(parseLegalCcn(pos, p.solution[i]));
    if (!check(s, pos, p.solution[i + 1], 7, o).ok) return { ok: false, gap: first.gap, steps };
    pos.makeMove(parseLegalCcn(pos, p.solution[i + 1]));
    steps++;
  }
  return { ok: true, gap: first.gap, steps };
}
