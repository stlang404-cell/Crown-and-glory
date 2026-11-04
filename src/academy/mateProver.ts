/**
 * Exact forced-mate prover (crown-mate-prover-1), shared by the Grimoire position checker (tools/grimoire/check.ts),
 * the lesson generator (tools/grimoire/lessons.ts) and the in-app Grimoire exercises, so the app accepts exactly the
 * moves the book's "mate in N" claims were proven with: every move that forces checkmate within N moves, and nothing else.
 * Exhaustive: every defence is tried. Pure functions on a Position (moves are made and unmade; the position is restored).
 */
import type { Position } from '../rules/position';
import type { Move } from '../rules/types';

export const MATE_PROVER_ID = 'crown-mate-prover-1';
export interface Budget { nodes: number }

/** Can the side to move force checkmate within n moves (2n-1 plies)? Throws when the node budget runs out. */
export function mates(pos: Position, n: number, budget: Budget): boolean {
  for (const m of pos.legalMoves()) {
    if (--budget.nodes < 0) throw new Error('mate proof exceeded node budget');
    pos.makeMove(m);
    let ok: boolean;
    const replies = pos.legalMoves();
    if (!replies.length) ok = pos.inCheck();
    else if (n === 1) ok = false;
    else {
      ok = true;
      for (const r of replies) {
        pos.makeMove(r);
        const sub = mates(pos, n - 1, budget);
        pos.unmakeMove();
        if (!sub) { ok = false; break; }
      }
    }
    pos.unmakeMove();
    if (ok) return true;
  }
  return false;
}

/** Does this legal move force checkmate within n moves (itself included)? */
export function moveMates(pos: Position, m: Move, n: number, budget: Budget = { nodes: 60_000_000 }): boolean {
  pos.makeMove(m);
  const replies = pos.legalMoves();
  let ok: boolean;
  if (!replies.length) ok = pos.inCheck();
  else if (n === 1) ok = false;
  else { ok = true; for (const r of replies) { pos.makeMove(r); const sub = mates(pos, n - 1, budget); pos.unmakeMove(); if (!sub) { ok = false; break; } } }
  pos.unmakeMove();
  return ok;
}

/** Every first move that forces checkmate within n moves (in legal-move order). */
export function matingFirstMoves(pos: Position, n: number, budget: Budget = { nodes: 60_000_000 }): Move[] {
  return pos.legalMoves().filter(m => moveMates(pos, m, n, budget));
}

/**
 * The most stubborn defence for the side to move (who is being mated): the reply after which the attacker's fastest
 * forced mate is longest, searching mate distances 1..maxN. Ties keep legal-move order, so the choice is deterministic.
 * Returns null when there is no legal reply.
 */
export function stubbornDefence(pos: Position, maxN: number, budget: Budget = { nodes: 5_000_000 }): Move | null {
  let best: Move | null = null, bestD = -1;
  for (const r of pos.legalMoves()) {
    pos.makeMove(r);
    let d = maxN + 1;
    for (let k = 1; k <= maxN; k++) if (mates(pos, k, budget)) { d = k; break; }
    pos.unmakeMove();
    if (d > bestD) { bestD = d; best = r; }
  }
  return best;
}
