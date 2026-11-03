import { describe, expect, it } from 'vitest';
import { generateFederation, ageOf } from '../src/federation/generator';
import { createWorld, joinPlayer, Ctx, leagueTable } from '../src/federation/world';
import { runRoundHeadless, gamesOf } from '../src/federation/driver';
import { DIVISIONS, DIVISION_SIZE, REGIONS, ROUNDS_PER_SEASON, PLAYER_ID, LEAGUE_ROUNDS } from '../src/federation/model';
import { roundRobin, swissPairing, koNext, KoMatch, standings, leagueOrder } from '../src/federation/formats';
import { wdl } from '../src/federation/resultModel';
import type { RoundRecord } from '../src/federation/world';

function newCtx(seed = 42): Ctx {
  const comps = generateFederation(seed);
  const { world, plan } = createWorld(seed, comps, 'T');
  return { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1500, rd: 350, name: 'You' }, swissHistory: [] };
}

describe('population generator', () => {
  it('creates 2,048 unique, deterministic competitors in the 16 × 8 × 16 topology', () => {
    const a = generateFederation(7), b = generateFederation(7), c = generateFederation(8);
    expect(a).toHaveLength(REGIONS * DIVISIONS * DIVISION_SIZE);
    expect(new Set(a.map(x => x.id)).size).toBe(2048);
    expect(new Set(a.map(x => x.name)).size).toBe(2048);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    for (let r = 0; r < REGIONS; r++) for (let d = 1; d <= DIVISIONS; d++) expect(a.filter(x => x.region === r && x.division === d)).toHaveLength(16);
  });
  it('rating distribution: ordered by division, within the calibrated engine scale', () => {
    const a = generateFederation(7);
    const mean = (d: number) => a.filter(x => x.division === d).reduce((s, x) => s + x.latent, 0) / 256;
    for (let d = 1; d < DIVISIONS; d++) expect(mean(d)).toBeGreaterThan(mean(d + 1) + 120);
    expect(Math.min(...a.map(x => x.latent))).toBeGreaterThanOrEqual(750);
    expect(Math.max(...a.map(x => x.latent))).toBeLessThanOrEqual(3050);
    const err = a.map(x => x.rating - x.latent);
    const sd = Math.sqrt(err.reduce((s, e) => s + e * e, 0) / err.length);
    expect(sd).toBeGreaterThan(60); expect(sd).toBeLessThan(100); // public rating is informative but imperfect
  });
});

describe('formats', () => {
  it('round robin: every pair meets exactly once, one game per player per round, colours balanced', () => {
    for (const n of [16, 17, 4, 5]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const rounds = roundRobin(ids);
      const seen = new Set<string>();
      for (const r of rounds) {
        const inRound = r.flat();
        expect(new Set(inRound).size).toBe(inRound.length);
        for (const [a, b] of r) { const k = [a, b].sort().join(); expect(seen.has(k)).toBe(false); seen.add(k); }
      }
      expect(seen.size).toBe((n * (n - 1)) / 2);
      if (n === 16) for (const id of ids) { const w = rounds.flat().filter(([a]) => a === id).length; expect(Math.abs(w - 7.5)).toBeLessThanOrEqual(1.5); }
    }
  });
  it('Swiss pairing avoids repeats, gives byes to the lowest player without one, handles impossible cases', () => {
    const players = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, points: 0, seed: i + 1, whites: 0, hadBye: i === 6 }));
    const r = swissPairing(players, new Set());
    expect(r.bye).toBe('s5');
    expect(r.pairs).toHaveLength(3);
    // 4 players who have all met: a repeat is unavoidable and is counted
    const four = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, points: 0, seed: i, whites: 0, hadBye: false }));
    const met = new Set(['a|b', 'a|c', 'a|d', 'b|c', 'b|d', 'c|d']);
    const r2 = swissPairing(four, met);
    expect(r2.pairs).toHaveLength(2);
    expect(r2.repeats).toBe(2);
    // a case where greedy pairing fails but backtracking succeeds
    const g = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, points: 0, seed: i, whites: 0, hadBye: false }));
    const r3 = swissPairing(g, new Set(['a|b', 'c|d']));
    expect(r3.repeats).toBe(0);
  });
  it('knockout matches always terminate: seed rule, joint title only in the final', () => {
    const draw = (m: KoMatch, fin: boolean) => { for (let i = 0; i < 20; i++) { const nx = koNext(m, fin); if (!nx) break; m.games.push({ ...nx, result: 0.5 }); } return m; };
    const m1 = draw({ a: 'x', b: 'y', seedA: 3, seedB: 1, games: [], winner: null, joint: false, decidedBy: null }, false);
    expect(m1.winner).toBe('y'); expect(m1.games).toHaveLength(6); expect(m1.decidedBy).toBe('pre-event seed');
    const m2 = draw({ a: 'x', b: 'y', seedA: 3, seedB: 1, games: [], winner: null, joint: false, decidedBy: null }, true);
    expect(m2.joint).toBe(true); expect(m2.winner).toBeNull();
    const m3: KoMatch = { a: 'x', b: 'y', seedA: 1, seedB: 2, games: [], winner: null, joint: false, decidedBy: null };
    let nx = koNext(m3, false)!; m3.games.push({ ...nx, result: 1 }); nx = koNext(m3, false)!; m3.games.push({ ...nx, result: 0.5 });
    expect(koNext(m3, false)).toBeNull(); expect(m3.winner).toBe('x'); expect(m3.decidedBy).toBe('classical');
  });
  it('league tiebreak: head-to-head before Sonneborn–Berger before seed', () => {
    const ids = ['a', 'b', 'c'];
    const games = [{ white: 'a', black: 'b', result: 0 }, { white: 'b', black: 'c', result: 0 }, { white: 'c', black: 'a', result: 0 }];
    const rows = leagueOrder(standings(ids, games, new Map([['a', 2], ['b', 1], ['c', 3]])), games);
    expect(rows.map(r => r.points)).toEqual([1, 1, 1]);
    expect(rows[0].id).toBe('b'); // full cycle: h2h and SB equal → seed
  });
  it('Davidson model probabilities sum to one and favour the stronger side', () => {
    const p = wdl(1800, 1500);
    expect(p.w + p.d + p.l).toBeCloseTo(1, 12);
    expect(p.w).toBeGreaterThan(p.l);
    expect(wdl(1500, 1500).d).toBeCloseTo(0.9 / 2.9, 10);
  });
});

describe('world simulation', () => {
  it('a full season: one game per active competitor per league round, 16 per division afterwards, championship decided', () => {
    const ctx = newCtx();
    const rounds: RoundRecord[] = [];
    let end = null;
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) {
      const p = runRoundHeadless(ctx, rounds);
      if (p.record.round <= LEAGUE_ROUNDS) {
        const league = p.record.abstract.filter(f => f[0].startsWith('league'));
        const playing = league.flatMap(f => [f[1], f[2]]);
        expect(new Set(playing).size).toBe(playing.length);
        expect(playing.length).toBe(2048);
      }
      rounds.push(p.record);
      if (p.seasonEnd) end = p.seasonEnd;
    }
    expect(end).not.toBeNull();
    expect(ctx.world.season).toBe(2);
    expect(end!.promotions.length).toBe(REGIONS * (DIVISIONS - 1) * 2);
    for (let r = 0; r < REGIONS; r++) for (let d = 1; d <= DIVISIONS; d++) expect([...ctx.competitors.values()].filter(c => c.status === 'active' && c.region === r && c.division === d)).toHaveLength(16);
    expect(end!.titles.some(t => t.title.startsWith('Crown Champion') || t.title.startsWith('Joint Crown'))).toBe(true);
  }, 120_000);

  it('is deterministic for a seed', () => {
    const a = newCtx(9), b = newCtx(9);
    const ra: RoundRecord[] = [], rb: RoundRecord[] = [];
    for (let i = 0; i < 5; i++) { ra.push(runRoundHeadless(a, ra).record); rb.push(runRoundHeadless(b, rb).record); }
    expect(JSON.stringify(ra)).toBe(JSON.stringify(rb));
    expect([...a.competitors.values()].map(c => c.rating).join()).toBe([...b.competitors.values()].map(c => c.rating).join());
  });

  it('player joins a bottom-division circuit and plays exactly one league game per round', () => {
    const ctx = newCtx(3);
    joinPlayer(ctx, 5);
    expect(ctx.plan.circuits.find(c => c.region === 5 && c.division === 8)!.members).toContain(PLAYER_ID);
    const rounds: RoundRecord[] = [];
    for (let i = 0; i < LEAGUE_ROUNDS; i++) {
      let mine = 0;
      const p = runRoundHeadless(ctx, rounds, 'T', f => { mine++; return f.white === PLAYER_ID ? 1 : 0; });
      expect(mine).toBe(1);
      rounds.push(p.record);
    }
    const t = leagueTable(ctx.plan.circuits.find(c => c.region === 5 && c.division === 8)!, gamesOf(rounds));
    expect(t[0].id).toBe(PLAYER_ID); // won every game
  }, 60_000);

  it('multi-season stability: population size, division sizes and mean ratings stay controlled (no inflation)', () => {
    const ctx = newCtx(11);
    const mean = () => { const a = [...ctx.competitors.values()].filter(c => c.status === 'active'); return { rating: a.reduce((s, c) => s + c.rating, 0) / a.length, latent: a.reduce((s, c) => s + c.latent, 0) / a.length, n: a.length }; };
    const m0 = mean();
    let rounds: RoundRecord[] = [];
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < ROUNDS_PER_SEASON; i++) { const p = runRoundHeadless(ctx, rounds); rounds = p.seasonEnd ? [] : [...rounds, p.record]; }
    }
    const m1 = mean();
    expect(m1.n).toBe(2048);
    expect(Math.abs(m1.rating - m0.rating)).toBeLessThan(60);
    expect(Math.abs(m1.latent - m0.latent)).toBeLessThan(60);
    const ages = [...ctx.competitors.values()].filter(c => c.status === 'active').map(c => ageOf(c, ctx.world.season));
    expect(Math.max(...ages)).toBeLessThan(48);
  }, 240_000);
});
