/**
 * v0.9 differential move-generation tests: Position.generatePseudo (occupancy-mask driven) must emit exactly the
 * same move list, in the same order, as the frozen v0.8 full-board-scan generator, and isAttacked / inCheck the
 * same answers as the v0.8 version (tests/helpers/
 * movegenReference.ts) — for all moves and captures-only — at every node of perft trees from ≥ 1 000 positions
 * (benchmark corpus + random games with promotions, checks, mates and stalemates). make/unmake must restore
 * hash, board, king squares, counters and the incremental state exactly.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { FenError, Position, perft } from '../src/rules';
import { mulberry32 } from '../src/rules/tables';
import { movePromo } from '../src/rules/types';
import { generatePseudoReference, isAttackedReference } from './helpers/movegenReference';

// FENs of tools/bench/tune/positions.json (git-ignored), committed as a gzipped fixture so a clean checkout runs this test.
const corpus = (JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/position-corpus.json.gz', import.meta.url))).toString('utf8')) as { fens: string[] }).fens;

function snapshot(p: Position): string {
  return [p.toFen(), p.hashKey(), p.kingSq.join(','), p.ply, p.halfmove, p.fullmove, Array.from(p.pieceCnt).join(','), Array.from(p.pawnBits).join(','), Array.from(p.occ).join(','), p.psqMg, p.psqEg].join('|');
}

/** From-scratch recomputation of the incremental state of `p`. */
function fresh(p: Position): string {
  const f = Position.fromFen(p.toFen());
  f.setPsqTable(p.psqTab);
  return [Array.from(f.pieceCnt).join(','), Array.from(f.pawnBits).join(','), Array.from(f.occ).join(',')].join('|');
}

const bufA = new Int32Array(256), bufB = new Int32Array(256), bufC = new Int32Array(256);
const stats = { nodes: 0, promotions: 0, checks: 0, mates: 0, stalemates: 0 };
function compareAt(p: Position): void {
  for (const capturesOnly of [false, true]) {
    const na = p.generatePseudoFast(bufA, capturesOnly);
    const nb = generatePseudoReference(p, bufB, capturesOnly);
    const nc = p.generatePseudo(bufC, capturesOnly);
    if (na !== nb || bufA.subarray(0, na).some((m, i) => m !== bufB[i])) {
      expect({ fen: p.toFen(), capturesOnly, moves: Array.from(bufA.subarray(0, na)) }).toEqual({ fen: p.toFen(), capturesOnly, moves: Array.from(bufB.subarray(0, nb)) });
    }
    if (nc !== nb || bufC.subarray(0, nc).some((m, i) => m !== bufB[i])) {
      expect({ fen: p.toFen(), capturesOnly, moves: Array.from(bufC.subarray(0, nc)) }).toEqual({ fen: p.toFen(), capturesOnly, moves: Array.from(bufB.subarray(0, nb)) });
    }
    if (!capturesOnly) for (let i = 0; i < na; i++) if (movePromo(bufA[i])) stats.promotions++;
  }
  for (const c of [0, 1] as const) {
    const ref = isAttackedReference(p, p.kingSq[c], c ^ 1);
    expect(p.inCheck(c)).toBe(ref);
    expect(p.inCheckFast(c)).toBe(ref);
  }
  if (stats.nodes % 5 === 0) {
    for (let sq = 0; sq < 36; sq++) for (const by of [0, 1] as const) {
      const ref = isAttackedReference(p, sq, by);
      if (p.isAttacked(sq, by) !== ref || p.isAttackedFast(sq, by) !== ref) expect({ fen: p.toFen(), sq, by }).toBe('isAttacked mismatch');
    }
  }
  if (stats.nodes++ % 37 === 0) expect(fresh(p)).toBe([Array.from(p.pieceCnt).join(','), Array.from(p.pawnBits).join(','), Array.from(p.occ).join(',')].join('|'));
}

function walk(p: Position, depth: number): void {
  compareAt(p);
  const legal = p.legalMoves();
  if (legal.length === 0) { if (p.inCheck()) stats.mates++; else stats.stalemates++; }
  else if (p.inCheck()) stats.checks++;
  if (depth === 0) return;
  const before = snapshot(p);
  // legal-move list equality vs the reference generator + legality filter
  const ref: number[] = [];
  const nb = generatePseudoReference(p, bufB);
  const pseudo = Array.from(bufB.subarray(0, nb));
  for (const m of pseudo) {
    p.makeMove(m);
    const illegal = isAttackedReference(p, p.kingSq[p.side ^ 1], p.side);
    expect(p.lastMoveLeftKingInCheckFast()).toBe(illegal);
    if (!illegal) ref.push(m);
    p.unmakeMove();
  }
  expect(legal).toEqual(ref);
  for (const m of legal) {
    p.makeMove(m);
    walk(p, depth - 1);
    p.unmakeMove();
    if (snapshot(p) !== before) expect(snapshot(p)).toBe(before);
  }
  if (!p.inCheck()) { p.makeNullMove(); compareAt(p); expect(p.lastMoveLeftKingInCheckFast()).toBe(false); p.unmakeNullMove(); expect(snapshot(p)).toBe(before); }
}

describe('v0.9 move generation equals the v0.8 reference generator', () => {
  it('FEN validation still sees every checker of the side not to move (piece counts are ready before the check test)', () => {
    for (const fen of ['k5/6/6/6/6/K4Q b - - 0 1', 'k5/6/6/6/6/R4K b - - 0 1', 'k5/6/1N4/6/6/5K b - - 0 1', '6/k5/1P4/6/6/5K b - - 0 1']) {
      expect(() => Position.fromFen(fen.replace(' b ', ' w '))).toThrow(FenError);
      const p = Position.start();
      expect(() => p.setFen(fen.replace(' b ', ' w '))).toThrow(FenError);
      expect(Position.fromFen(fen).inCheck()).toBe(true);
    }
  });

  it('the reference methods ignore the derived state (direct board writes stay valid); clone / syncDerived rebuild it', () => {
    const p = new Position();
    p.board.fill(0);
    p.board[0] = 5; p.board[35] = 13; p.board[20] = 4; p.kingSq[0] = 0; p.kingSq[1] = 35; p.side = 1;
    expect(p.isAttacked(35, 0)).toBe(false);
    expect(p.isAttacked(32, 0)).toBe(true); // queen c4 → c6
    expect(p.legalMoves().length).toBe(Position.fromFen('5k/6/2Q3/6/6/K5 b - - 0 1').legalMoves().length);
    const c = p.clone();
    expect(c.isAttackedFast(32, 0)).toBe(true);
    expect(c.generatePseudoFast(bufA)).toBe(p.generatePseudo(bufB));
    p.syncDerived();
    expect(Array.from(p.occ)).toEqual(Array.from(Position.fromFen('5k/6/2Q3/6/6/K5 b - - 0 1').occ));
  });

  it('perft numbers from the start position are unchanged', () => {
    const p = Position.start();
    expect([1, 2, 3, 4, 5].map(d => perft(p, d))).toEqual([10, 100, 1212, 14332, 191846]);
  });

  it('identical pseudo-legal and legal move lists at every node of perft trees from ≥ 1 000 positions; exact make/unmake', () => {
    const roots: string[] = corpus.filter((_, i) => i % 131 === 0).slice(0, 700);
    // random games: late positions with promotions, checks, mates, stalemates
    for (let g = 0; g < 600; g++) {
      const r = mulberry32(9000 + g);
      const p = Position.start();
      const stop = 20 + (r() % 140);
      for (let ply = 0; ply < stop; ply++) {
        const ms = p.legalMoves();
        if (!ms.length) break;
        p.makeMove(ms[r() % ms.length]);
      }
      roots.push(p.toFen());
      expect(fresh(p)).toBe([Array.from(p.pieceCnt).join(','), Array.from(p.pawnBits).join(','), Array.from(p.occ).join(',')].join('|'));
    }
    // explicit promotion / stalemate / check positions
    roots.push('6/2P3/6/6/3k2/K5 w - - 0 1', 'k5/2Q3/1K4/6/6/6 b - - 0 1', 'k5/2P1P1/6/6/1p2p1/2K3 w - - 0 1', '1r4/P5/6/6/6/K2k2 w - - 0 1');
    expect(roots.length).toBeGreaterThanOrEqual(1000);
    for (const f of roots) walk(Position.fromFen(f), 2);
    console.log('movegen differential:', roots.length, 'roots', JSON.stringify(stats));
    expect(stats.promotions).toBeGreaterThan(100);
    expect(stats.checks).toBeGreaterThan(100);
    expect(stats.mates).toBeGreaterThan(0);
    expect(stats.stalemates).toBeGreaterThan(0);
  }, 600_000);
});
