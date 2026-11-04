/**
 * Circuit Grades (crown-circuit-grades-1, docs/FEUDAL_RANKS.md): the 48 steps, insignia, the checkpoint rule with
 * hysteresis and protection, season boundaries, exclusions, money, highest-rank monotonicity, persistence, backups,
 * migration of saves without ranks, and the cost at 10,240 competitors.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB, FEDERATION_STORES } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { exportBundle, importBundle } from '../src/storage/backup';
import { decodeFederationStores } from '../src/federation/persist';
import { generateFederation, hashSeed } from '../src/federation/generator';
import { createWorld, joinPlayer, type Ctx, type RoundRecord, type WorldState } from '../src/federation/world';
import { runRoundHeadless, gamesOf } from '../src/federation/driver';
import { DIVISIONS, PLAYER_ID, ROUNDS_PER_SEASON, TOPOLOGY_V1, TOPOLOGY_V3, type Competitor } from '../src/federation/model';
import { POPULATION_V2 } from '../src/federation/population';
import { sampleResult } from '../src/federation/resultModel';
import {
  ALL_RANKS, HYSTERESIS, MID_ROUND, PROMOTION_LANDING, RELEGATION_LANDING, STEPS, THRESHOLDS, checkpointStep, competitorHighestRank, competitorRank,
  computeStandings, currentRank, divisionBase, divisionOfStep, ensureRanks, highestRank, initialPlayerRank, localOf, rankCheckpoint, rankLabel,
  rankProgress, rankView, seedLocal, standingScore, sublevelOf,
} from '../src/federation/ranks';
import { CIRCUIT_GRADE_NAMES } from '../src/federation/rankNames';
import { gradeEmblem } from '../src/heraldry/ranks';
import { signature } from '../src/heraldry/spec';
import { divisionEmblem, rankEmblem, RANK_ORDER, titleEmblem, FED_TITLES, regionEmblem, tournamentCrest, TOURNAMENTS, financialEmblem, FIN_TIERS } from '../src/heraldry/catalog';
import { rankCeremonies } from '../src/app/ranks';
import type { Ceremony } from '../src/app/federation';

function newCtx(seed = 42, topology = TOPOLOGY_V1): Ctx {
  const comps = generateFederation(seed, topology, POPULATION_V2);
  const { world, plan } = createWorld(seed, comps, 'T', topology, POPULATION_V2);
  const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 900, rd: 80, name: 'You' }, swissHistory: [] };
  joinPlayer(ctx, 0);
  ensureRanks(ctx, ctx.player.rating, { newCareer: true });
  return ctx;
}
const tier1For = (ctx: Ctx, strength: number, seed = 5) => {
  let i = 0;
  return (f: { white: string; black: string }) => { const s = (id: string) => (id === PLAYER_ID ? strength : ctx.competitors.get(id)!.latent); return sampleResult(s(f.white), s(f.black), (hashSeed(seed, i++) % 10000) / 10000); };
};

function makeSvc(f = new IDBFactory(), start = 0) {
  let clock = start;
  const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
  return CrownDB.open(f).then(db => {
    const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
    svc.runSelfplay = async req => { const h = hashSeed(req.seed, 'stub') % 3; return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: 'checkmate' }; };
    return { svc, db, f, tick: () => clock };
  });
}
async function round(svc: FederationService) {
  for (const f of svc.playerFixtures()) await svc.forfeit(f.id);
  await svc.advanceRound();
}
const ranksOf = (svc: FederationService) => JSON.stringify({ p: svc.state!.world.player.rank, c: [...svc.state!.competitors.values()].map(c => [c.id, c.rank]) });

describe('the 48 Circuit Grade steps', () => {
  it('16 stable ids, three sublevels each, ordered Commoner III … High Sovereign I with full labels', () => {
    expect(CIRCUIT_GRADE_NAMES.map(g => g.id)).toEqual(Array.from({ length: 16 }, (_, i) => `cg-${String(i + 1).padStart(2, '0')}`));
    expect(CIRCUIT_GRADE_NAMES.map(g => g.name)).toEqual(['Commoner', 'Page', 'Squire', 'Man-at-Arms', 'Knight', 'Knight Banneret', 'Baronet', 'Baron', 'Viscount', 'Earl', 'Marquess', 'Duke', 'Grand Duke', 'Prince', 'King', 'High Sovereign']);
    expect(ALL_RANKS).toHaveLength(48);
    expect(STEPS).toBe(48);
    expect(ALL_RANKS[0].label).toBe('Commoner III');
    expect(ALL_RANKS[1].label).toBe('Commoner II');
    expect(ALL_RANKS[2].label).toBe('Commoner I');
    expect(ALL_RANKS[3].label).toBe('Page III');
    expect(ALL_RANKS[47].label).toBe('High Sovereign I');
    expect(new Set(ALL_RANKS.map(r => r.label)).size).toBe(48);
    ALL_RANKS.forEach((r, i) => {
      expect(r.step).toBe(i);
      expect(r.sublevel).toBe(['III', 'II', 'I'][i % 3]);
      expect(r.label).toBe(`${r.rankName} ${r.sublevel}`);
      expect(r.gradeId).toBe(CIRCUIT_GRADE_NAMES[Math.floor(i / 3)].id);
      expect(r.ariaLabel).toContain(r.label);
      expect(rankLabel(i)).toBe(r.label);
      expect(sublevelOf(i)).toBe(r.sublevel);
    });
  });
  it('two grades per division: division 8 → cg-01/cg-02 … division 1 → cg-15/cg-16', () => {
    for (let d = 1; d <= DIVISIONS; d++) {
      const steps = ALL_RANKS.filter(r => r.division === d);
      expect(steps).toHaveLength(6);
      expect(new Set(steps.map(s => s.gradeId))).toEqual(new Set([`cg-${String(2 * (8 - d) + 1).padStart(2, '0')}`, `cg-${String(2 * (8 - d) + 2).padStart(2, '0')}`]));
      expect(steps[0].step).toBe(divisionBase(d));
      for (const s of steps) expect(divisionOfStep(s.step)).toBe(d);
    }
  });
  it('48 visually distinct insignia, distinct from every other emblem family; sublevel marks 1–3', () => {
    const sigs = ALL_RANKS.map(r => signature(r.insignia));
    expect(new Set(sigs).size).toBe(48);
    ALL_RANKS.forEach(r => expect(r.insignia.marks).toBe(({ III: 1, II: 2, I: 3 } as const)[r.sublevel]));
    // the 16 grades differ without the marks too (shape · charge · field partition)
    expect(new Set(Array.from({ length: 16 }, (_, g) => { const s = gradeEmblem(g, 0); return [s.shape, s.charge, s.division].join('|'); })).size).toBe(16);
    const others = [
      ...Array.from({ length: 8 }, (_, i) => divisionEmblem(i + 1)), ...RANK_ORDER.map(rankEmblem), ...FED_TITLES.map(titleEmblem),
      ...Array.from({ length: 80 }, (_, i) => regionEmblem(i)), ...TOURNAMENTS.map(tournamentCrest), ...FIN_TIERS.map(financialEmblem),
    ].map(signature);
    for (const s of sigs) expect(others.includes(s)).toBe(false);
    // the shield shape is the division's
    for (const r of ALL_RANKS) expect(r.insignia.shape).toBe(divisionEmblem(r.division).shape);
  });
});

describe('the checkpoint rule', () => {
  it('steps up at the threshold, at most one step per checkpoint, never past the division', () => {
    expect(checkpointStep(0, THRESHOLDS[1], 0)).toEqual({ local: 1, protect: 1, change: 1 });
    expect(checkpointStep(0, THRESHOLDS[1] - 0.1, 0)).toEqual({ local: 0, protect: 0, change: 0 });
    expect(checkpointStep(0, 100, 0).local).toBe(1); // one step even with a perfect score
    expect(checkpointStep(5, 100, 0)).toEqual({ local: 5, protect: 0, change: 0 }); // top of the division
    expect(checkpointStep(0, 0, 0).local).toBe(0); // bottom of the division
    expect(checkpointStep(2, 100, 0, false)).toEqual({ local: 2, protect: 0, change: 0 }); // relegation places: no rise
  });
  it('hysteresis: a step down needs a score HYSTERESIS below the step mark; protection blocks it once', () => {
    for (let k = 1; k <= 5; k++) {
      expect(checkpointStep(k, THRESHOLDS[k] - HYSTERESIS, 0).local).toBe(k); // inside the band: stays
      expect(checkpointStep(k, THRESHOLDS[k] - HYSTERESIS - 0.1, 0)).toEqual({ local: k - 1, protect: 0, change: -1 });
      expect(checkpointStep(k, 0, 1)).toEqual({ local: k, protect: 0, change: 0 }); // protected: no drop, protection used
    }
  });
  it('oscillation is bounded: a score jittering around a threshold moves the rank once, not every checkpoint', () => {
    for (let k = 1; k <= 5; k++) {
      let local = k - 1, protect = 0, moves = 0;
      for (let t = 0; t < 40; t++) { const r = checkpointStep(local, THRESHOLDS[k] + (t % 2 ? -3 : 3), protect); if (r.change) moves++; local = r.local; protect = r.protect; }
      expect(moves).toBe(1);
    }
    // random scores: the hysteresis rule reverses far fewer moves than a rule without it
    let a = 0, b = 0, revA = 0, revB = 0, la = 2, lb = 2, pa = 0, lastA = 0, lastB = 0;
    for (let t = 0; t < 4000; t++) {
      const s = 54 + ((hashSeed(9, t) % 2001) / 100 - 10);
      const r = checkpointStep(la, s, pa); if (r.change) { a++; if (r.change === -lastA) revA++; lastA = r.change; } else lastA = 0; la = r.local; pa = r.protect;
      const nb = lb < 5 && s >= THRESHOLDS[lb + 1] ? lb + 1 : lb > 0 && s < THRESHOLDS[lb] ? lb - 1 : lb; const d = Math.sign(nb - lb);
      if (d) { b++; if (d === -lastB) revB++; lastB = d; } else lastB = 0; lb = nb;
    }
    expect(revA / Math.max(1, a)).toBeLessThan(0.05);
    expect(revB / b).toBeGreaterThan(0.3);
  });
  it('standing score: weighted parts, missing parts renormalised', () => {
    expect(standingScore({ position: 1, results: 1, rating: 1 })).toBe(100);
    expect(standingScore({ position: 0, results: 0, rating: 0 })).toBe(0);
    expect(standingScore({ position: 1, results: 0, rating: 0 })).toBe(45);
    expect(standingScore({ position: 1, results: 1, rating: null })).toBe(100);
    expect(standingScore({ position: null, results: null, rating: 0.5 })).toBe(50);
    expect(seedLocal(0)).toBe(0); expect(seedLocal(0.999)).toBe(5); expect(seedLocal(0.5)).toBe(2);
  });
});

describe('seasons and the federation', () => {
  it('new careers start at Commoner III; the founding world has a rank for everyone, consistent with divisions', () => {
    const ctx = newCtx();
    expect(currentRank(ctx).label).toBe('Commoner III');
    expect(ctx.world.player.rank!.origin).toBe('new');
    expect(highestRank(ctx)!.via).toBe('start');
    expect(initialPlayerRank(1, 1).step).toBe(0);
    expect(currentRank(null).label).toBe('Commoner III'); // before a federation exists
    for (const c of ctx.competitors.values()) if (c.status === 'active') { expect(divisionOfStep(c.rank![0])).toBe(c.division); expect(c.rank![2]).toBe(c.rank![0]); }
  });

  it('checkpoints after round 8 and at season end; promotions land on lower grade III (protected), relegations on upper grade III, entrants at the bottom; highest never falls', () => {
    const ctx = newCtx(7);
    const tier1 = tier1For(ctx, 2200);
    let rounds: RoundRecord[] = [];
    const highest = new Map<string, number>();
    let playerHighest = 0;
    for (let s = 0; s < 3; s++) {
      for (let r = 1; r <= ROUNDS_PER_SEASON; r++) {
        const before = new Map([...ctx.competitors.values()].map(c => [c.id, c.rank ? [...c.rank] : null]));
        const p = runRoundHeadless(ctx, rounds, 'T', tier1);
        rounds.push(p.record);
        const changed = [...ctx.competitors.values()].filter(c => c.rank && before.get(c.id) && before.get(c.id)![0] !== c.rank[0]).length;
        if (r !== MID_ROUND && r !== ROUNDS_PER_SEASON) expect(changed).toBe(0); // only at checkpoints
        if (r === MID_ROUND) expect(changed).toBeGreaterThan(100);
        if (p.seasonEnd) {
          for (const m of p.seasonEnd.promotions) { const k = m.id === PLAYER_ID ? [ctx.world.player.rank!.step, ctx.world.player.rank!.protect] : ctx.competitors.get(m.id)!.rank!; if (ctx.competitors.get(m.id)?.status === 'retired') continue; expect(k[0]).toBe(divisionBase(m.to) + PROMOTION_LANDING); expect(k[1]).toBe(1); }
          for (const m of p.seasonEnd.relegations) { const k = m.id === PLAYER_ID ? [ctx.world.player.rank!.step] : ctx.competitors.get(m.id)!.rank!; if (ctx.competitors.get(m.id)?.status === 'retired') continue; expect(k[0]).toBe(divisionBase(m.to) + RELEGATION_LANDING); }
          for (const e of p.seasonEnd.entrants) expect(ctx.competitors.get(e.id)!.rank![0]).toBe(divisionBase(e.division));
          rounds = [];
        }
        for (const c of ctx.competitors.values()) {
          if (!c.rank) continue;
          if (c.status === 'active') expect(divisionOfStep(c.rank[0])).toBe(c.division);
          // within a checkpoint the in-division change is at most one step
          const b = before.get(c.id);
          if (b && divisionOfStep(b[0]) === divisionOfStep(c.rank[0]) && !p.seasonEnd) expect(Math.abs(c.rank[0] - b[0])).toBeLessThanOrEqual(1);
          expect(c.rank[2]).toBeGreaterThanOrEqual(c.rank[0]);
          expect(c.rank[2]).toBeGreaterThanOrEqual(highest.get(c.id) ?? 0);
          highest.set(c.id, c.rank[2]);
        }
        const pr = ctx.world.player.rank!;
        expect(pr.highest.step).toBeGreaterThanOrEqual(playerHighest);
        expect(pr.highest.step).toBeGreaterThanOrEqual(pr.step);
        playerHighest = pr.highest.step;
        expect(divisionOfStep(pr.step)).toBe(ctx.world.player.division);
      }
    }
    // a 2200-strength player climbs out of the Open Division and its highest rank is recorded with a season
    expect(ctx.world.player.division).toBeLessThan(8);
    expect(highestRank(ctx)!.step).toBeGreaterThanOrEqual(divisionBase(7));
    expect(ctx.world.player.rank!.log.some(e => e.kind === 'promotion')).toBe(true);
  });

  it('demotion, relegation and rating loss never lower the highest rank', () => {
    const ctx = newCtx(11);
    const r = ctx.world.player.rank!;
    r.step = divisionBase(8) + 4; r.highest = { step: r.step, season: 1, round: 8, via: 'checkpoint' };
    const games: { event: string; white: string; black: string; result: number | null }[] = [];
    // every league game lost: last place, zero results
    for (const c of ctx.plan.circuits) if (c.members.includes(PLAYER_ID)) for (const m of c.members) if (m !== PLAYER_ID) games.push({ event: `league:${c.region}:${c.division}`, white: PLAYER_ID, black: m, result: 0 });
    ctx.world.round = MID_ROUND;
    rankCheckpoint(ctx, games, 0, 'mid');
    expect(r.step).toBe(divisionBase(8) + 3);
    expect(r.highest.step).toBe(divisionBase(8) + 4);
    ctx.world.round = ROUNDS_PER_SEASON;
    rankCheckpoint(ctx, games, 0, 'end');
    expect(r.step).toBe(divisionBase(8) + 2);
    expect(r.highest.step).toBe(divisionBase(8) + 4);
  });

  it('exhibitions, unrated, sandbox, practice, quick-match and Club Weekend games never count', () => {
    const ctx = newCtx(3);
    const circuit = ctx.plan.circuits.find(c => c.members.includes(PLAYER_ID))!;
    const league = circuit.members.filter(m => m !== PLAYER_ID).map((m, i) => ({ event: `league:${circuit.region}:${circuit.division}`, white: PLAYER_ID, black: m, result: i % 2 ? 1 : 0 }));
    const base = computeStandings(ctx, league, 900).get(PLAYER_ID)!;
    const noise = ['exhibition', 'unrated', 'sandbox', 'practice', 'quick', 'club', 'assisted', 'friendly'].flatMap(event => circuit.members.filter(m => m !== PLAYER_ID).map(m => ({ event, white: PLAYER_ID, black: m, result: 1 })));
    expect(computeStandings(ctx, [...league, ...noise], 900).get(PLAYER_ID)).toEqual(base);
    // sanctioned Swiss games do count
    const swiss = computeStandings(ctx, [...league, { event: 'challenger', white: PLAYER_ID, black: 'c0001', result: 1 }], 900).get(PLAYER_ID)!;
    expect(swiss.results).toBeGreaterThan(base.results!);
  });

  it('the live projection and the guide data come from recorded standing only', () => {
    const ctx = newCtx(5);
    const p = rankProgress(ctx, { position: 1, results: 1, rating: 1 });
    expect(p.current.label).toBe('Commoner III');
    expect(p.next!.label).toBe('Commoner II');
    expect(p.promoteAt).toBe(THRESHOLDS[1]);
    expect(p.demoteBelow).toBeNull();
    expect(p.divisionUp!.label).toBe('Squire III');
    expect(p.divisionDown).toBeNull();
    expect(p.fraction).toBe(1);
    expect(rankView(divisionBase(1) + 5).label).toBe('High Sovereign I');
  });
});

describe('the federation service: persistence, money, backups, migration', () => {
  it('a new career is Commoner III; ranks survive reloads identically through a checkpoint and a season end', async () => {
    const a = await makeSvc();
    await a.svc.create(2, 77);
    expect(currentRank(a.svc.state).label).toBe('Commoner III');
    for (let r = 0; r < ROUNDS_PER_SEASON + MID_ROUND; r++) {
      await round(a.svc);
      if (r % 9 === 0 || r === MID_ROUND - 1 || r === ROUNDS_PER_SEASON - 1) {
        const before = ranksOf(a.svc);
        const fresh = new FederationService(a.db, async () => ({ rating: 1500, rd: 200 }), a.svc.now);
        fresh.runSelfplay = a.svc.runSelfplay;
        await fresh.load();
        expect(ranksOf(fresh)).toBe(before);
        a.svc = fresh;
      }
    }
    // forfeiting every game: last place in the Open Division, still Commoner III, never below
    expect(currentRank(a.svc.state).label).toBe('Commoner III');
  }, 120_000);

  it('money cannot affect rank: buying assets and cosmetics leaves every rank identical', async () => {
    const a = await makeSvc(), b = await makeSvc();
    await a.svc.create(4, 4242); await b.svc.create(4, 4242);
    await b.svc.buyAsset('trophy-cabinet');
    await b.svc.buyCosmetic('frame-bronze');
    await b.svc.buyAsset('scouting');
    for (let r = 0; r < MID_ROUND + 1; r++) { await round(a.svc); await round(b.svc); }
    expect(b.svc.balance('player:cash')).not.toBe(a.svc.balance('player:cash'));
    expect(ranksOf(b.svc)).toBe(ranksOf(a.svc));
  }, 120_000);

  it('backups carry ranks and highest ranks exactly', async () => {
    const a = await makeSvc();
    await a.svc.create(1, 31);
    for (let r = 0; r < MID_ROUND + 1; r++) await round(a.svc);
    const bundle = JSON.parse(JSON.stringify(await exportBundle(a.db, 'test')));
    const c = await makeSvc(new IDBFactory());
    await importBundle(c.db, bundle);
    await c.svc.load();
    expect(ranksOf(c.svc)).toBe(ranksOf(a.svc));
  }, 120_000);

  it('a v0.9/v0.10 save without ranks migrates deterministically from stored history, never resetting progress or inventing achievements', async () => {
    const a = await makeSvc();
    await a.svc.create(5, 909);
    for (let r = 0; r < ROUNDS_PER_SEASON + MID_ROUND + 2; r++) await round(a.svc); // a full season, then past the next mid-season checkpoint
    // write the same federation as a v0.9 save stored it: individual records, no rank fields anywhere
    const stores = decodeFederationStores((await a.db.dump()).federation);
    const strip = (c: Competitor) => { const { rank, ...rest } = c; void rank; return rest; };
    stores.competitors = (stores.competitors as Competitor[]).map(strip);
    stores.world = (stores.world as WorldState[]).map(w => { const { rank, ...player } = w.player; void rank; return { ...w, player }; });
    const f2 = new IDBFactory();
    const db2 = await CrownDB.open(f2);
    await db2.commit(FEDERATION_STORES.map(store => ({ store, put: stores[store] ?? [] })));
    const load = async () => { const s = new FederationService(db2, async () => ({ rating: 1500, rd: 200 }), () => '2026-02-01T00:00:00.000Z'); await s.load(); return s; };
    const b = await load(), b2 = await load();
    expect(ranksOf(b)).toBe(ranksOf(b2)); // deterministic
    const st = b.state!;
    const p = st.world.player;
    expect(p.rank!.origin).toBe('migrated');
    expect(divisionOfStep(p.rank!.step)).toBe(p.division);
    expect(p.rank!.highest.step).toBeGreaterThanOrEqual(p.rank!.step);
    expect(p.rank!.log.at(-1)!.kind).toBe('migration');
    let replayed = 0;
    for (const c of st.competitors.values()) {
      const orig = a.svc.state!.competitors.get(c.id)!;
      expect(c.rating).toBe(orig.rating); expect(c.division).toBe(orig.division); expect(c.history).toEqual(orig.history); // nothing else changed
      if (c.status !== 'active') continue;
      expect(divisionOfStep(c.rank![0])).toBe(c.division);
      expect(c.rank![2]).toBeGreaterThanOrEqual(c.rank![0]);
      expect(c.rank![3]).toBeGreaterThanOrEqual(1);
      expect(c.rank![3]).toBeLessThanOrEqual(st.world.season);
      if (c.history.length) replayed++;
    }
    expect(replayed).toBeGreaterThan(1500);
    // a competitor promoted at the last season end is on its new division's grades
    const promoted = [...st.competitors.values()].find(c => c.status === 'active' && c.history.length && c.history.at(-1)!.division > c.division)!;
    expect(localOf(promoted.rank![0])).toBeGreaterThanOrEqual(PROMOTION_LANDING);
    expect(competitorRank(promoted)!.division).toBe(promoted.division);
    expect(competitorHighestRank(promoted)!.step).toBeGreaterThanOrEqual(divisionBase(promoted.division));
    // the migrated save keeps playing
    b.runSelfplay = a.svc.runSelfplay;
    for (let r = 0; r < 3; r++) await round(b);
    expect(divisionOfStep(b.state!.world.player.rank!.step)).toBe(b.state!.world.player.division);
  }, 180_000);

  it('a rank change produces one restrained ceremony; a division promotion carries the grade in its own card', () => {
    const before = initialPlayerRank(1, 1);
    const after = { ...before, step: 1, log: [...before.log, { season: 1, round: 8, kind: 'mid' as const, from: 0, to: 1, score: 61.2 }] };
    const cs: Ceremony[] = [];
    rankCeremonies(before, after, 1, 8, cs);
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ kind: 'rank', title: 'Circuit Grade: Commoner II' });
    expect(cs[0].detail).toContain('61.2');
    rankCeremonies(before, before, 1, 9, cs);
    expect(cs).toHaveLength(1);
    const promo: Ceremony[] = [{ id: 'promotion:1:7', season: 1, round: 19, kind: 'promotion', title: 'Promoted', ids: [PLAYER_ID], detail: 'Ashmere', seen: false }];
    rankCeremonies(before, { ...before, step: 6 }, 1, 19, promo);
    expect(promo).toHaveLength(1);
    expect(promo[0].detail).toContain('Squire III');
  });
});

describe('scale: 10,240 competitors', () => {
  it('ranks for every competitor are compact and the checkpoint is cheap', () => {
    const ctx = newCtx(4242, TOPOLOGY_V3);
    expect(ctx.competitors.size).toBe(10_240);
    const rounds: RoundRecord[] = [];
    for (let r = 1; r < MID_ROUND; r++) rounds.push(runRoundHeadless(ctx, rounds, 'T', tier1For(ctx, 900)).record);
    const games = gamesOf(rounds);
    ctx.world.round = MID_ROUND;
    const t0 = performance.now();
    rankCheckpoint(ctx, games, 900, 'mid');
    const ms = performance.now() - t0;
    console.log(`[ranks] mid-season checkpoint at 10,240 competitors: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(2500); // measured 189 ms in node on the shared 4-core VM (load average 12)
    const bytes = [...ctx.competitors.values()].reduce((s, c) => s + JSON.stringify(c.rank).length + 8, 0);
    expect(bytes / ctx.competitors.size).toBeLessThan(30);
    const t1 = performance.now();
    for (const c of ctx.competitors.values()) competitorRank(c);
    expect(performance.now() - t1).toBeLessThan(200);
  }, 120_000);
});
