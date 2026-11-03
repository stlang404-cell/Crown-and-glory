import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Position, moveToCcn, START_FEN } from '../src/rules';
import { Searcher, MATE, see, isMateScore, mateInPlies, scoreToTT, scoreFromTT } from '../src/engine/search';
import { chooseMove, getLevel, LEVELS, allocateTime } from '../src/engine/levels';
import { parseLegalCcn } from '../src/rules/notation';

const oracle = JSON.parse(readFileSync(new URL('./fixtures/oracle_positions.json', import.meta.url), 'utf8')).positions as { fen: string; moves: string[] }[];

describe('engine search', () => {
  it('finds mate in one', () => {
    const r = new Searcher(16).search(Position.fromFen('k5/6/1K4/6/6/5R w - - 0 1'), { limits: { depth: 4 } });
    expect(moveToCcn(r.bestMove)).toBe('f1f6');
    expect(r.score).toBe(MATE - 1);
  });
  it('finds a forced mate with two rooks and reports distance', () => {
    const r = new Searcher(16).search(Position.fromFen('3k2/6/6/6/6/R2K1R w - - 0 1'), { limits: { depth: 8 } });
    expect(isMateScore(r.score)).toBe(true);
    expect(mateInPlies(r.score)).toBeGreaterThan(0);
    expect(mateInPlies(r.score) % 2).toBe(1);
  });
  it('wins a hanging queen', () => {
    const r = new Searcher(16).search(Position.fromFen('3k2/6/3q2/6/3R2/3K2 w - - 0 1'), { limits: { depth: 4 } });
    expect(moveToCcn(r.bestMove)).toBe('d2d4');
  });
  it('promotes when promotion wins', () => {
    const p = Position.fromFen('3k2/P5/6/6/6/K5 w - - 0 1');
    const r = new Searcher(16).search(p, { limits: { depth: 5 } });
    expect(moveToCcn(r.bestMove).startsWith('a5a6')).toBe(true);
  });
  it('mate scores survive TT storage at different plies', () => {
    for (const s of [MATE - 3, -(MATE - 5), 120]) for (const ply of [0, 3, 9]) expect(scoreFromTT(scoreToTT(s, ply), ply)).toBe(s);
  });
  it('static exchange evaluation', () => {
    // rook takes defended pawn: loses rook for pawn
    expect(see(Position.fromFen('3k2/2p3/3p2/6/3R2/3K2 w - - 0 1'), parseLegalCcn(Position.fromFen('3k2/2p3/3p2/6/3R2/3K2 w - - 0 1'), 'd2d4'))).toBe(100 - 480);
  });
  it('obeys node and time limits and always returns a legal move', () => {
    const s = new Searcher(16);
    const p = Position.fromFen(START_FEN);
    const n = s.search(p, { limits: { nodes: 5000 } });
    expect(n.nodes).toBeLessThanOrEqual(5100);
    const t0 = Date.now();
    const t = s.search(p, { limits: { timeMs: 200 } });
    expect(Date.now() - t0).toBeLessThan(450);
    expect(p.legalMoves()).toContain(t.bestMove);
    const tiny = s.search(p, { limits: { nodes: 1 } });
    expect(p.legalMoves()).toContain(tiny.bestMove);
  });
  it('every best move and PV is legal across 300 oracle positions', () => {
    const s = new Searcher(16);
    let checked = 0;
    for (const r of oracle.filter(x => x.moves.length > 0).filter((_, i) => i % 15 === 0).slice(0, 300)) {
      const p = Position.fromFen(r.fen);
      const res = s.search(p, { limits: { nodes: 3000 } });
      expect(r.moves).toContain(moveToCcn(res.bestMove));
      const q = p.clone();
      for (const m of res.pv) { expect(q.legalMoves()).toContain(m); q.makeMove(m); }
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });
  it('treats repetition as a draw inside search (does not repeat when winning)', () => {
    const s = new Searcher(16);
    const p = Position.fromFen('3k2/6/6/6/6/2QK2 w - - 0 1');
    const r = s.search(p, { limits: { depth: 6 } });
    expect(r.score).toBeGreaterThan(500);
  });
});

describe('strength levels', () => {
  it('every level returns a legal move; bounded selection never exceeds its margin', () => {
    const p = Position.fromFen('r1qk1r/pp1ppp/2n1n1/2p3/PPPPPP/RNQKNR w - - 0 4');
    for (const lv of LEVELS.slice(0, 5)) {
      const s = new Searcher(16);
      const r = chooseMove(s, p, { ...lv, maxTimeMs: 300 }, 42);
      expect(p.legalMoves()).toContain(r.move);
      if (r.candidates && lv.selection) {
        const best = Math.max(...r.candidates.map(c => c.score));
        const chosen = r.candidates.find(c => c.move === r.move)!;
        expect(best - chosen.score).toBeLessThanOrEqual(lv.selection.marginCp);
      }
    }
  });
  it('selection is reproducible for the same seed', () => {
    const p = Position.fromFen(START_FEN);
    const a = chooseMove(new Searcher(16), p, getLevel(1), 7).move;
    const b = chooseMove(new Searcher(16), p, getLevel(1), 7).move;
    expect(a).toBe(b);
  });
  it('time allocation respects the clock', () => {
    expect(allocateTime(getLevel(8), { remainingMs: 2000, incrementMs: 0 })).toBeLessThan(700);
    expect(allocateTime(getLevel(8), { remainingMs: 300_000, incrementMs: 3000 })).toBeLessThanOrEqual(6000);
  });
});
