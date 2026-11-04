import { describe, expect, it } from 'vitest';
import golden from './fixtures/levels-golden.json';
import { goldenMoves } from '../tools/bench/levels_golden';
import { LEVELS } from '../src/engine/levels';

// The calibrated levels L1–L9 must keep their exact behaviour: the fixture was generated from the v0.9.0 code before
// the sub-800 beginner levels (crown-error-1) were added (tools/bench/levels_golden.ts).
describe('calibrated levels L1–L9 are unchanged', () => {
  it('choose identical moves to v0.9.0 on a fixed position set with fixed seeds', () => {
    const now = goldenMoves();
    const before = (golden as { items: typeof now }).items;
    expect(now.length).toBe(before.length);
    expect(now).toEqual(before);
  }, 60_000);
  it('keep their v0.9.0 profiles', () => {
    expect(LEVELS.map(l => [l.id, l.depth, l.nodes, l.maxTimeMs, l.selection?.marginCp ?? null, l.selection?.temperatureCp ?? null, l.ttBits ?? 18])).toEqual([
      ['L1', 1, 2000, 400, 320, 200, 18], ['L2', 1, 2000, 400, 200, 110, 18], ['L3', 2, 6000, 500, 130, 70, 18], ['L4', 2, 8000, 600, 70, 35, 18],
      ['L5', 64, 600, 400, null, null, 18], ['L6', 64, 4000, 800, null, null, 18], ['L7', 64, 30000, 2000, null, null, 18],
      ['L8', 64, Infinity, 6000, null, null, 18], ['L9', 64, Infinity, 10000, null, null, 20],
    ]);
    for (const l of LEVELS) expect('error' in l).toBe(false);
  });
});
