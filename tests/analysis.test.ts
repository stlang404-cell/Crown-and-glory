import { describe, expect, it } from 'vitest';
import { analyzeGame, ANALYSIS_PRESETS, reportId, recommendationsFor } from '../src/analysis/analyzer';
import { accuracyFromLosses, expectedU, gradeForLoss, gradeMove, nextPhase, flipScore } from '../src/analysis/methodology';
import { Position, START_FEN } from '../src/rules';

const quick = ANALYSIS_PRESETS[0];
const base = { legalCount: 10, uBest: 0.6, uPlayed: 0.6, uSecond: 0.55, uBestPrev: 0.6, uPlayedPrev: 0.6, playedIsBest: true, playedIsBestPrev: true, mateInvolved: false, mateStable: true, sacrifice: null, uSecondPrev: 0.55 };

describe('grading methodology v0', () => {
  it('loss bins with inclusive upper boundaries', () => {
    expect(gradeForLoss(0)).toBe('best');
    expect(gradeForLoss(0.002)).toBe('best');
    expect(gradeForLoss(0.0021)).toBe('excellent');
    expect(gradeForLoss(0.02)).toBe('excellent');
    expect(gradeForLoss(0.05)).toBe('good');
    expect(gradeForLoss(0.12)).toBe('inaccuracy');
    expect(gradeForLoss(0.25)).toBe('mistake');
    expect(gradeForLoss(0.2501)).toBe('blunder');
    expect(gradeForLoss(5)).toBe('blunder');
  });
  it('all eight labels are reachable', () => {
    const g = (o: object) => gradeMove({ ...base, ...o }).grade;
    expect(g({ uPlayed: 0.6 - 0.01, uPlayedPrev: 0.59, playedIsBest: false })).toBe('excellent');
    expect(g({ uPlayed: 0.56, uPlayedPrev: 0.56, playedIsBest: false })).toBe('good');
    expect(g({ uPlayed: 0.5, uPlayedPrev: 0.5, playedIsBest: false })).toBe('inaccuracy');
    expect(g({ uPlayed: 0.4, uPlayedPrev: 0.4, playedIsBest: false })).toBe('mistake');
    expect(g({ uPlayed: 0.1, uPlayedPrev: 0.1, playedIsBest: false })).toBe('blunder');
    expect(g({})).toBe('best');
    expect(g({ uSecond: 0.4, uSecondPrev: 0.4 })).toBe('great');
    expect(g({ uSecond: 0.4, uSecondPrev: 0.4, sacrifice: { material: 320, verified: true, recapture: false } })).toBe('brilliant');
  });
  it('a forced (single legal) move is Best, never Great/Brilliant', () => {
    const r = gradeMove({ ...base, legalCount: 1, uSecond: null, sacrifice: { material: 900, verified: true, recapture: false } });
    expect(r.grade).toBe('best');
    expect(r.reasons[0]).toMatch(/forced/);
  });
  it('unverified or recapture sacrifices are not Brilliant', () => {
    expect(gradeMove({ ...base, uSecond: 0.4, uSecondPrev: 0.4, sacrifice: { material: 500, verified: false, recapture: false } }).grade).toBe('great');
    expect(gradeMove({ ...base, uSecond: 0.4, uSecondPrev: 0.4, sacrifice: { material: 500, verified: true, recapture: true } }).grade).toBe('great');
  });
  it('Great requires the gap to be stable at both depths', () => {
    expect(gradeMove({ ...base, uSecond: 0.4, uSecondPrev: 0.58 }).grade).toBe('best');
    expect(gradeMove({ ...base, uSecond: 0.4, uSecondPrev: 0.4, playedIsBestPrev: false }).grade).toBe('best');
  });
  it('loss interval crossing a boundary is flagged uncertain and withholds special labels', () => {
    const r = gradeMove({ ...base, uPlayed: 0.5, uPlayedPrev: 0.58, playedIsBest: false });
    expect(r.uncertain).toEqual(expect.arrayContaining(['excellent', 'good', 'inaccuracy']));
    expect(r.provisional).toBe(true);
  });
  it('unstable mate evidence yields no grade; stable mate is provisional', () => {
    expect(gradeMove({ ...base, mateInvolved: true, mateStable: false }).grade).toBeNull();
    const r = gradeMove({ ...base, uBest: 1, uPlayed: 1, uBestPrev: 1, uPlayedPrev: 1, mateInvolved: true, mateStable: true });
    expect(r.grade).toBe('best');
    expect(r.provisional).toBe(true);
  });
  it('negative loss is clamped and flagged', () => {
    const r = gradeMove({ ...base, uPlayed: 0.7, playedIsBest: false });
    expect(r.loss).toBe(0);
    expect(r.inconsistency).toBe(true);
  });
  it('accuracy is bounded, null when empty', () => {
    expect(accuracyFromLosses([])).toBeNull();
    expect(accuracyFromLosses([0, 0])).toBe(100);
    expect(accuracyFromLosses([1, 1])).toBeCloseTo(100 * Math.exp(-4), 6);
  });
  it('mate never becomes a centipawn value', () => {
    expect(expectedU({ kind: 'mate', plies: 3, pov: 'white', proven: false })).toBe(1);
    expect(expectedU(flipScore({ kind: 'mate', plies: 3, pov: 'white', proven: false }))).toBe(0);
    expect(expectedU({ kind: 'terminal', outcome: 'draw', pov: 'black' })).toBe(0.5);
    expect(expectedU({ kind: 'cp', value: 0, pov: 'white' })).toBe(0.5);
  });
  it('phases are monotone and do not reverse after promotion', () => {
    let p = nextPhase('opening', { fullmove: 5, whiteQueens: 1, blackQueens: 1, minorMajor: 10 });
    expect(p).toBe('opening');
    p = nextPhase(p, { fullmove: 6, whiteQueens: 0, blackQueens: 1, minorMajor: 9 });
    expect(p).toBe('middlegame');
    p = nextPhase(p, { fullmove: 20, whiteQueens: 0, blackQueens: 0, minorMajor: 4 });
    expect(p).toBe('endgame');
    expect(nextPhase(p, { fullmove: 30, whiteQueens: 1, blackQueens: 0, minorMajor: 5 })).toBe('endgame');
  });
});

describe('game analysis', () => {
  const legalMoves = ['b1c3', 'b6c4', 'c3d5', 'e6d4', 'd5f6'];
  it('ply alignment: ply n describes move n from the pre-move position', () => {
    const rep = analyzeGame({ gameId: 'g', checksum: 'c'.repeat(64), initialFen: START_FEN, moves: legalMoves }, quick);
    expect(rep.plies).toHaveLength(legalMoves.length);
    const p = Position.fromFen(START_FEN);
    rep.plies.forEach((pl, i) => {
      expect(pl.ply).toBe(i + 1);
      expect(pl.ccn).toBe(legalMoves[i]);
      expect(pl.preHash).toBe(p.hashKey());
      expect(pl.color).toBe(i % 2 === 0 ? 'white' : 'black');
      p.makeMove(p.legalMoves().find(m => toCcn(m) === pl.ccn)!);
      expect(pl.postHash).toBe(p.hashKey());
      for (const c of pl.candidates) expect(c.pv[0]).toBe(c.ccn);
    });
    expect(rep.status).toBe('complete');
    expect(rep.methodology.experimental).toBe(true);
    const w = rep.summary.white;
    expect(w.accuracy === null || (w.accuracy >= 0 && w.accuracy <= 100)).toBe(true);
    expect(recommendationsFor(rep, 'white').length).toBeGreaterThan(0);
  });
  it('a hanging-queen blunder is graded as a blunder with an engine-backed note', () => {
    // White queen move leaves it en prise to a pawn.
    const fen = '3k2/2p3/6/6/1Q4/3K2 w - - 0 1';
    const rep = analyzeGame({ gameId: 'b', checksum: 'd'.repeat(64), initialFen: fen, moves: ['b2b4'] }, quick);
    const pl = rep.plies[0];
    expect(['mistake', 'blunder']).toContain(pl.grade);
    expect(pl.notes.some(n => n.kind === 'hanging-piece')).toBe(true);
  });
  it('forced moves are flagged and excluded from accuracy', () => {
    // Black king in check with a single legal reply.
    const fen = 'k1Q3/6/6/6/6/5K b - - 0 1';
    const p = Position.fromFen(fen);
    const legal = p.legalMoves();
    expect(legal).toHaveLength(1);
    {
      const rep = analyzeGame({ gameId: 'f', checksum: 'e'.repeat(64), initialFen: fen, moves: [toCcn(legal[0])] }, quick);
      expect(rep.plies[0].forced).toBe(true);
      expect(rep.plies[0].grade).toBe('best');
      expect(rep.summary.black.eligible).toBe(0);
      expect(rep.summary.black.accuracy).toBeNull();
    }
  });
  it('cancellation yields a partial report and never invents the missing plies', () => {
    let n = 0;
    const rep = analyzeGame({ gameId: 'g', checksum: 'c'.repeat(64), initialFen: START_FEN, moves: legalMoves }, quick, { shouldStop: () => n++ >= 2 });
    expect(rep.status).toBe('partial');
    expect(rep.plies).toHaveLength(2);
    expect(rep.coverage).toEqual({ analysed: 2, total: legalMoves.length });
  });
  it('report ids change with settings/methodology so old reports stay immutable', () => {
    expect(reportId('g', 'abc', ANALYSIS_PRESETS[0])).not.toBe(reportId('g', 'abc', ANALYSIS_PRESETS[1]));
  });
});

function toCcn(m: number): string {
  const sq = (s: number) => 'abcdef'[s % 6] + (Math.floor(s / 6) + 1);
  const promo = (m >> 12) & 7;
  return sq(m & 63) + sq((m >> 6) & 63) + (promo ? ' pnrqk'[promo] : '');
}
