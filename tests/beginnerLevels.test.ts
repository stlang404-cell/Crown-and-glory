import { describe, expect, it } from 'vitest';
import { Position } from '../src/rules/position';
import { moveToCcn } from '../src/rules/notation';
import { automaticOutcome } from '../src/rules/adjudication';
import { Searcher } from '../src/engine/search';
import { BEGINNER_LEVELS, LEVELS, chooseMove, getBeginnerLevel, getLevel } from '../src/engine/levels';
import { mulberry32 } from '../src/rules/tables';
import beginnerCal from '../src/engine/calibration-beginners.json';
import { tacticsSolveRate } from '../tools/bench/beginner_tactics';
import { goldenFens } from '../tools/bench/levels_golden';

const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';

describe('beginner levels (crown-error-1)', () => {
  it('are four levels below L1, strongest first, each with a monotone error model', () => {
    expect(BEGINNER_LEVELS.map(l => l.id)).toEqual(['L0a', 'L0b', 'L0c', 'L0d']);
    for (let i = 1; i < BEGINNER_LEVELS.length; i++) {
      const a = BEGINNER_LEVELS[i - 1].error!, b = BEGINNER_LEVELS[i].error!;
      expect(b.pRandom).toBeGreaterThanOrEqual(a.pRandom);
      expect(b.pBlind).toBeGreaterThanOrEqual(a.pBlind);
      expect(b.temperatureCp).toBeGreaterThanOrEqual(a.temperatureCp);
      expect(b.marginCp).toBeGreaterThanOrEqual(a.marginCp);
    }
    // beginner levels never leak into the calibrated ladder
    expect(LEVELS.some(l => l.id.startsWith('L0'))).toBe(false);
    expect(getLevel(0).id).toBe('L1');
    expect(getBeginnerLevel('L0c')!.name).toBe('Newcomer');
  });

  it('always play legal moves through whole games (random playouts from many positions)', () => {
    const s = new Searcher(16);
    let moves = 0;
    for (const p of BEGINNER_LEVELS) for (let g = 0; g < 3; g++) {
      const pos = Position.fromFen(START);
      s.newGame();
      for (let ply = 0; ply < 160 && !automaticOutcome(pos); ply++) {
        const legal = pos.legalMoves();
        const r = chooseMove(s, pos, p, (g * 1000 + ply) >>> 0);
        expect(legal).toContain(r.move);
        expect(['best', 'error-sample', 'error-random']).toContain(r.selected);
        expect(r.search.nodes).toBeLessThanOrEqual(p.nodes + 200 * legal.length); // cheap: bounded per-move budget
        pos.makeMove(r.move);
        moves++;
      }
    }
    expect(moves).toBeGreaterThan(500);
  }, 60_000);

  it('are deterministic for a seed (fresh searcher or reused) and vary with the seed', () => {
    for (const p of BEGINNER_LEVELS) {
      const seen = new Set<string>();
      for (const fen of goldenFens().slice(0, 8)) {
        for (const seed of [3, 99, 12345]) {
          const a = new Searcher(16), b = new Searcher(16);
          const ma = moveToCcn(chooseMove(a, Position.fromFen(fen), p, seed).move);
          const mb = moveToCcn(chooseMove(b, Position.fromFen(fen), p, seed).move);
          expect(mb).toBe(ma);
          seen.add(`${fen}|${ma}`);
        }
      }
      expect(seen.size).toBeGreaterThan(8); // different seeds give different (sampled) moves somewhere
    }
  }, 60_000);

  it('random moves happen at about the configured rate', () => {
    const p = getBeginnerLevel('L0d')!;
    const s = new Searcher(16);
    const pos = Position.fromFen(START);
    const rng = mulberry32(5);
    let random = 0;
    const N = 400;
    for (let i = 0; i < N; i++) if (chooseMove(s, pos, p, rng() >>> 0).selected === 'error-random') random++;
    expect(random / N).toBeGreaterThan(p.error!.pRandom - 0.07);
    expect(random / N).toBeLessThan(p.error!.pRandom + 0.07);
  }, 60_000);

  it('get monotonically weaker on the verified tactics set (L1 > L0a > L0b > L0c > L0d)', () => {
    const seeds = [1000, 8919, 16838, 24757, 32676, 40595];
    const rates = [getLevel(1), ...BEGINNER_LEVELS].map(p => tacticsSolveRate(p, seeds));
    const pct = rates.map(r => r.solved / r.tries);
    for (let i = 1; i < pct.length; i++) expect(pct[i]).toBeLessThan(pct[i - 1]);
    expect(pct[0] - pct[pct.length - 1]).toBeGreaterThan(0.15);
  }, 60_000);

  it('have measured ratings below 800 that cover the 0–399 and 400–799 bands', () => {
    const levels = (beginnerCal as { levels: { id: string; rating: number; rd: number; se: number; games: number; ci95: number[] }[] }).levels;
    expect(levels.map(l => l.id)).toEqual(['L0a', 'L0b', 'L0c', 'L0d']);
    for (let i = 1; i < levels.length; i++) expect(levels[i].rating).toBeLessThan(levels[i - 1].rating);
    expect(levels[0].rating).toBeLessThan(800);
    expect(levels.filter(l => l.rating >= 400 && l.rating < 800).length).toBeGreaterThanOrEqual(2);
    expect(levels.filter(l => l.rating < 400).length).toBeGreaterThanOrEqual(2);
    for (const l of levels) { expect(l.games).toBeGreaterThanOrEqual(300); expect(l.ci95[0]).toBeLessThan(l.rating); expect(l.ci95[1]).toBeGreaterThan(l.rating); }
    // the stored parameters are the ones the levels play
    for (const l of levels) expect((l as unknown as { error: unknown }).error).toEqual(getBeginnerLevel(l.id)!.error);
  });
});
