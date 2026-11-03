import { describe, expect, it } from 'vitest';
import set from '../src/academy/data/puzzles.json';
import { Puzzle, Attempt, validatePuzzle, nextPuzzle, modeFilter, adaptiveThemes, themeStats } from '../src/academy/academy';
import { Position } from '../src/rules/position';
import { parseLegalCcn } from '../src/rules/notation';
import { Searcher } from '../src/engine/search';
import { verifyPuzzle } from '../src/academy/verify';
import { betaInterval } from '../src/academy/lab';
import { detectFork, detectLineTactics, threatsAgainst } from '../src/academy/motifs';

const puzzles = (set as unknown as { puzzles: Puzzle[] }).puzzles;

describe(`Academy puzzle bank (${puzzles.length} puzzles)`, () => {
  it('every puzzle is a legal crown-la6-v1 position with a legal solution line', () => {
    expect(puzzles.length).toBeGreaterThan(0);
    for (const p of puzzles) expect(validatePuzzle(p)).toBe(true);
  });
  it('no duplicate positions; player moves and SAN consistent', () => {
    const keys = puzzles.map(p => p.fen.split(' ').slice(0, 2).join(' '));
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of puzzles) { expect(p.solutionSan).toHaveLength(p.solution.length); expect(p.playerMoves).toBe(Math.ceil(p.solution.length / 2)); expect(p.themes.length).toBeGreaterThan(0); }
  });
  it('held-out and training splits never share a source family (no leakage)', () => {
    const fam = new Map<string, Set<string>>();
    for (const p of puzzles) { const s = fam.get(p.family) ?? new Set(); s.add(p.split); fam.set(p.family, s); }
    for (const s of fam.values()) expect(s.size).toBe(1);
    expect(puzzles.some(p => p.split === 'heldout')).toBe(true);
  });
  it('practice modes never serve held-out puzzles; assessments never repeat', () => {
    for (const m of ['tactics', 'calculation', 'defense', 'endgame', 'rush', 'adaptive'] as const) for (const p of puzzles) if (p.split === 'heldout') expect(modeFilter(m, p)).toBe(false);
    const held = puzzles.filter(p => p.split === 'heldout');
    const attempts = held.slice(0, Math.max(0, held.length - 1)).map((p, i) => ({ id: `a${i}`, puzzleId: p.id, split: 'heldout', exposure: 0 }) as unknown as Attempt);
    const nxt = nextPuzzle('assessment', puzzles, attempts, { targetDifficulty: 3 });
    expect(nxt?.id).toBe(held[held.length - 1].id);
    const all = held.map((p, i) => ({ id: `b${i}`, puzzleId: p.id }) as unknown as Attempt);
    expect(nextPuzzle('assessment', puzzles, all, { targetDifficulty: 3 })).toBeNull();
  });
  it('practice prefers unseen puzzles and statistics ignore repeat exposures', () => {
    const train = puzzles.filter(p => p.split === 'training');
    const seen = train.slice(0, train.length - 1).map((p, i) => ({ id: `s${i}`, puzzleId: p.id, split: 'training', exposure: 0, clean: true, themes: p.themes }) as unknown as Attempt);
    expect(nextPuzzle('tactics', puzzles, seen, { targetDifficulty: 3 })?.id).toBe(train[train.length - 1].id);
    const rep = [...seen, { ...seen[0], id: 'rep', exposure: 1, clean: false } as Attempt];
    const t = themeStats(rep, puzzles);
    const total = [...t.values()].reduce((a, s) => a + s.attempts, 0);
    const base = [...themeStats(seen, puzzles).values()].reduce((a, s) => a + s.attempts, 0);
    expect(total).toBe(base);
  });
  it('adaptive training only claims a weakness with enough attempts', () => {
    expect(adaptiveThemes([], puzzles, [], []).themes).toEqual([]);
  });
  it('a sample of active puzzles re-verifies with the canonical engine (crown-puzzle-verify-2, best defences)', () => {
    const s = new Searcher(18);
    const active = puzzles.filter(p => !p.retired);
    const sample = active.filter((_, i) => i % Math.max(1, Math.floor(active.length / 12)) === 0).slice(0, 12);
    for (const p of sample) {
      const v = verifyPuzzle(s, p);
      expect(v.ok).toBe(true);
      expect(v.gap).toBeCloseTo(p.canonical!.gap, 3);
    }
  }, 180_000);
  it('retired puzzles are kept (history) but never served; every active puzzle carries a canonical verification', () => {
    const retired = puzzles.filter(p => p.retired);
    expect(retired.length).toBeGreaterThan(0);
    for (const m of ['tactics', 'rush', 'calculation', 'defense', 'endgame', 'adaptive', 'assessment'] as const) for (const p of retired) expect(modeFilter(m, p)).toBe(false);
    for (const p of puzzles.filter(x => !x.retired)) { expect(p.canonical?.ok).toBe(true); expect(p.canonical?.verifyId).toBe('crown-puzzle-verify-2'); }
  });
});

describe('motif detectors', () => {
  it('detects a knight fork of king and rook', () => {
    const pos = Position.fromFen('r1k3/6/6/6/2N3/3K2 w - - 0 1');
    const m = parseLegalCcn(pos, 'c2b4');
    pos.makeMove(m);
    expect(detectFork(pos, m)?.motif).toBe('fork');
  });
  it('detects a pin against the king', () => {
    const pos = Position.fromFen('3k2/6/3n2/6/6/3RK1 b - - 0 1');
    expect(detectLineTactics(pos, 0).some(h => h.motif === 'pin')).toBe(true);
  });
  it('finds a hanging-piece threat and mate-in-one threats', () => {
    expect(threatsAgainst(Position.fromFen('3k2/6/3q2/6/3R2/3K2 b - - 0 1'), 1).bestGain).toBeGreaterThan(500);
    expect(threatsAgainst(Position.fromFen('3k2/6/3K2/6/6/R5 b - - 0 1'), 1).mateInOne).toBe(true);
  });
  it('Beta interval is sane', () => {
    const [lo, hi] = betaInterval(8, 10);
    expect(lo).toBeGreaterThan(0.4); expect(hi).toBeLessThan(0.98); expect(lo).toBeLessThan(0.75);
  });
});
