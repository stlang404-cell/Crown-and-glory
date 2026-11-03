/**
 * Move-grading audit (crown-grade-v3-experimental): the rules that keep labels honest.
 *  - a sacrifice is never Brilliant by itself (needs: only strong move, stable, deeper verification, not a recapture);
 *  - forced moves are Best and never special; "only moves" in lost or trivially won positions get no special credit;
 *  - unstable mate evidence gets no grade; depth disagreement marks the label provisional;
 *  - Mistakes and Blunders are confirmed by a deeper search before they are shown (v3) and never made harsher.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gradeMove, type GradeInput } from '../src/analysis/methodology';
import { analyzeGame, ANALYSIS_PRESETS } from '../src/analysis/analyzer';
import { Searcher } from '../src/engine/search';

const base: GradeInput = { legalCount: 12, uBest: 0.6, uPlayed: 0.6, uSecond: 0.45, uBestPrev: 0.6, uPlayedPrev: 0.6, playedIsBest: true, playedIsBestPrev: true, mateInvolved: false, mateStable: true, sacrifice: null, uSecondPrev: 0.45, v2: true };

describe('grading rules', () => {
  it('a stable only-move is Great; adding a sacrifice makes it Brilliant only when verified and not a recapture', () => {
    expect(gradeMove(base).grade).toBe('great');
    expect(gradeMove({ ...base, sacrifice: { material: 480, verified: false, recapture: false } }).grade).toBe('great');
    expect(gradeMove({ ...base, sacrifice: { material: 480, verified: true, recapture: true } }).grade).toBe('great');
    expect(gradeMove({ ...base, sacrifice: { material: 150, verified: true, recapture: false } }).grade).toBe('great');
    expect(gradeMove({ ...base, sacrifice: { material: 480, verified: true, recapture: false } }).grade).toBe('brilliant');
  });
  it('a sacrifice that is not the only strong move is never special', () => {
    const g = gradeMove({ ...base, uSecond: 0.58, uSecondPrev: 0.58, sacrifice: { material: 900, verified: true, recapture: false } });
    expect(['brilliant', 'great']).not.toContain(g.grade);
  });
  it('forced moves are Best and excluded from special credit', () => {
    const g = gradeMove({ ...base, legalCount: 1, sacrifice: { material: 900, verified: true, recapture: false } });
    expect(g.grade).toBe('best');
  });
  it('no Great in a lost position or among many winning moves', () => {
    expect(gradeMove({ ...base, uBest: 0.2, uPlayed: 0.2, uSecond: 0.05, uBestPrev: 0.2, uPlayedPrev: 0.2, uSecondPrev: 0.05 }).grade).toBe('best');
    expect(gradeMove({ ...base, uBest: 1, uPlayed: 1, uSecond: 0.985, uBestPrev: 1, uPlayedPrev: 1, uSecondPrev: 0.985 }).grade).toBe('best');
  });
  it('the only-move gap must hold at both depths', () => {
    expect(gradeMove({ ...base, uSecondPrev: 0.58 }).grade).toBe('best');
    expect(gradeMove({ ...base, playedIsBestPrev: false }).grade).toBe('best');
  });
  it('unstable mate evidence gets no grade; depth disagreement is provisional with the possible labels', () => {
    expect(gradeMove({ ...base, mateInvolved: true, mateStable: false }).grade).toBeNull();
    const g = gradeMove({ ...base, playedIsBest: false, uPlayed: 0.45, uPlayedPrev: 0.59 });
    expect(g.provisional).toBe(true);
    expect(g.uncertain).toContain(g.grade);
  });
  it('loss bins: inaccuracy, mistake and blunder thresholds', () => {
    const at = (loss: number) => gradeMove({ ...base, playedIsBest: false, uPlayed: 0.6 - loss, uPlayedPrev: 0.6 - loss }).grade;
    expect(at(0.08)).toBe('inaccuracy');
    expect(at(0.2)).toBe('mistake');
    expect(at(0.4)).toBe('blunder');
  });
});

describe('analysis: deeper confirmation of errors (v3)', () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/grades.json', import.meta.url), 'utf8')) as { settings: string; fixtures: { fen: string; move: string; grade: string | null; kind: string; prior?: string; priorFen?: string }[] };
  const settings = ANALYSIS_PRESETS.find(p => p.id === corpus.settings)!;
  it('every Mistake and Blunder label carries a deeper-check reason; v2 mode never adds one', () => {
    const s = new Searcher(16);
    const errs = corpus.fixtures.filter(f => (f.grade === 'mistake' || f.grade === 'blunder') && !f.prior);
    expect(errs.length).toBeGreaterThan(2);
    for (const f of errs) {
      const p3 = analyzeGame({ gameId: 'fx', checksum: '0'.repeat(64), initialFen: f.fen, moves: [f.move] }, settings, {}, s).plies[0];
      expect(p3.gradeReasons.some(r => /deeper check/.test(r))).toBe(true);
      const p2 = analyzeGame({ gameId: 'fx', checksum: '0'.repeat(64), initialFen: f.fen, moves: [f.move] }, settings, {}, s, 'canonical-v2').plies[0];
      expect(p2.gradeReasons.some(r => /deeper check/.test(r))).toBe(false);
      // the deeper check can only make a label milder
      const order = ['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
      expect(order.indexOf(p3.grade!)).toBeLessThanOrEqual(order.indexOf(p2.grade!));
    }
  }, 300_000);
  it('the winning promotion is graded Best', () => {
    const r = analyzeGame({ gameId: 'fx', checksum: '0'.repeat(64), initialFen: '3k2/P5/6/6/6/K5 w - - 0 1', moves: ['a5a6q'] }, ANALYSIS_PRESETS[0], {}, new Searcher(16));
    expect(['best', 'great', 'excellent']).toContain(r.plies[0].grade);
  });
});
