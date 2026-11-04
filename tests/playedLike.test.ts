/** Played Like (experimental): determinism, gates, exclusions, and that better move quality reads as stronger. */
import { describe, expect, it } from 'vitest';
import { eligibleLosses, estimateFromLosses, playedLike, rawPlayedLike, PLAYED_LIKE_VALIDATED } from '../src/analysis/playedLike';
import MODEL from '../src/analysis/played-like-model.json';
import type { AnalysisReport, PlyAnalysis } from '../src/analysis/types';

const ply = (n: number, color: 'white' | 'black', loss: number | null, forced = false) => ({ ply: n, color, loss, forced } as unknown as PlyAnalysis);
const game = (losses: number[], color: 'white' | 'black' = 'white') => losses.map((l, i) => ply(color === 'white' ? 2 * i + 1 : 2 * i + 2, color, l));

describe('Played Like', () => {
  it('is deterministic for the same analysed game and model', () => {
    const l = [0.02, 0.0, 0.11, 0.04, 0.0, 0.01, 0.3, 0.0, 0.05, 0.02];
    expect(estimateFromLosses(l)).toEqual(estimateFromLosses([...l]));
  });
  it('leaves out forced moves and the book-like opening plies', () => {
    const plies = [ply(1, 'white', 0.5), ply(3, 'white', 0.5), ply(5, 'white', 0.02), ply(7, 'white', 0.9, true), ply(9, 'white', 0.01), ply(2, 'black', 0.2)];
    expect(eligibleLosses(plies, 'white')).toEqual(plies.filter(p => p.ply > MODEL.bookPlies && !p.forced && p.color === 'white').map(p => p.loss));
  });
  it('short games and forced-move games give "insufficient", never a precise number', () => {
    expect(estimateFromLosses([0, 0, 0]).status).toMatch(/insufficient|uncalibrated/);
    const forcedOnly = Array.from({ length: 30 }, (_, i) => ply(2 * i + 1, 'white', 0, true));
    expect(estimateFromLosses(eligibleLosses(forcedOnly, 'white')).status).toMatch(/insufficient|uncalibrated/);
  });
  it('missing or incomplete analysis is "pending"', () => {
    expect(playedLike(null, 'white').status).toBe('pending');
    expect(playedLike({ status: 'partial', plies: game([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) } as unknown as AnalysisReport, 'white').status).toBe('pending');
  });
  it('only shows numbers once the held-out validation passed', () => {
    const r = estimateFromLosses(Array.from({ length: 20 }, () => 0.03));
    if (!PLAYED_LIKE_VALIDATED) expect(r.status).toBe('uncalibrated');
    else expect(['ok', 'below-range', 'above-range']).toContain(r.status);
  });
  it.runIf(PLAYED_LIKE_VALIDATED)('better move quality reads as stronger (validated model)', () => {
    const base = [0.02, 0.0, 0.12, 0.04, 0.0, 0.01, 0.25, 0.0, 0.05, 0.02, 0.03, 0.0];
    expect(rawPlayedLike(base.map(l => l / 3))).toBeGreaterThan(rawPlayedLike(base));
    expect(rawPlayedLike(base.map(l => Math.min(1, l * 3)))).toBeLessThan(rawPlayedLike(base));
  });
});
