import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import calibration from '../src/engine/calibration.json';
import { LEVELS, StrengthProfile } from '../src/engine/levels';
import { MEASURED_FLOOR, MEASURED_TOP, profileForStrength, strengthNote, beginnerRating, PROFILE_MAP_ID } from '../src/federation/profiles';
import { generateFederation } from '../src/federation/generator';
import { createWorld, Ctx, RoundRecord } from '../src/federation/world';
import { runRoundHeadless } from '../src/federation/driver';
import { DIVISIONS, ROUNDS_PER_SEASON, TOPOLOGY_V1, topologyWithRegions } from '../src/federation/model';
import { BANDS, TARGET_PER_10K, LATENT_MIN, NEW_FEDERATION_POPULATION, POPULATION_V1, POPULATION_V2, bandCounts, entrantModel, populationModelOf } from '../src/federation/population';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';

/** crown-profile-map-1 exactly as shipped in v0.9.0 (frozen reference). */
function profileMap1(latent: number, nodeCap = 2_000_000): StrengthProfile {
  const CAL = (calibration as { levels: { level: number; rating: number }[] }).levels;
  const l5 = CAL.find(c => c.level === 5)!.rating;
  if (latent < l5) {
    let best = LEVELS[0], d = Infinity;
    for (const lv of LEVELS.slice(0, 5)) { const r = CAL.find(c => c.level === lv.level)!.rating; if (Math.abs(r - latent) < d) { d = Math.abs(r - latent); best = lv; } }
    return { ...best, id: `fed-${best.id}` };
  }
  const nodes = Math.min(nodeCap, Math.round(600 * Math.pow(2, (latent - l5) / 118)));
  return { level: 0, id: `fed-n${nodes}`, name: 'Federation', depth: 64, nodes, maxTimeMs: 6_000, selection: null, description: `Full search, ${nodes.toLocaleString('en')} nodes per move` };
}

describe('latent → engine profile (crown-profile-map-2)', () => {
  it('is identical to crown-profile-map-1 over the whole v0.9 measured range (750 … the L9 rating)', () => {
    expect(PROFILE_MAP_ID).toBe('crown-profile-map-2');
    for (let x = 750; x <= MEASURED_TOP; x += 7) for (const cap of [2_000_000, 30_000]) expect(profileForStrength(x, cap)).toEqual(profileMap1(x, cap));
  });
  it('below L1: calibrated beginner levels at their measured points, interpolated error models between them', () => {
    expect(profileForStrength(beginnerRating('L0b')!.rating).id).toBe('fed-L0b');
    expect(profileForStrength(MEASURED_FLOOR - 200).id).toBe('fed-L0d');
    expect(profileForStrength(0).id).toBe('fed-L0d');
    // nearer of L0a and L1 between them (as map-1 does between L1 and L5)
    expect(profileForStrength(beginnerRating('L0a')!.rating + 10).id).toBe('fed-L0a');
    expect(profileForStrength(790).id).toBe('fed-L1');
    // every parameter weakens monotonically as the latent falls
    let prev = profileForStrength(beginnerRating('L0a')!.rating).error!;
    for (let x = beginnerRating('L0a')!.rating - 5; x >= MEASURED_FLOOR; x -= 5) {
      const p = profileForStrength(x);
      expect(p.error).toBeDefined();
      expect(p.error!.pRandom).toBeGreaterThanOrEqual(prev.pRandom);
      expect(p.error!.pBlind).toBeGreaterThanOrEqual(prev.pBlind);
      expect(p.error!.temperatureCp).toBeGreaterThanOrEqual(prev.temperatureCp);
      prev = p.error!;
    }
    const mid = profileForStrength((beginnerRating('L0b')!.rating + beginnerRating('L0c')!.rating) / 2);
    expect(mid.id.startsWith('fed-e')).toBe(true);
  });
  it('above the measured top: the strongest budget allowed at the call site, flagged in plain words', () => {
    expect(profileForStrength(MEASURED_TOP + 1).nodes).toBe(2_000_000);
    expect(profileForStrength(4200, 30_000).nodes).toBe(30_000);
    const n = strengthNote(4100);
    expect(n.kind).toBe('beyond-measured');
    expect(n.text).toContain("strongest measured engine (~3,050)");
    expect(strengthNote(2000).text).toBeNull();
    expect(strengthNote(300).kind).toBe('beginner');
    expect(strengthNote(MEASURED_FLOOR - 1).kind).toBe('below-measured');
    expect(strengthNote(2900, 30_000).kind).toBe('capped');
  });
});

describe('population spectrum (crown-population-2)', () => {
  it('new federations span 0–399 … 3200–3999 plus a tiny 4,000+ apex, with real beginners in the lower divisions', () => {
    expect(NEW_FEDERATION_POPULATION).toBe(POPULATION_V2);
    for (const seed of [42, 7, 1234]) {
      const comps = generateFederation(seed, TOPOLOGY_V1, POPULATION_V2);
      expect(comps).toHaveLength(2048);
      const bands = bandCounts(comps.map(c => c.latent));
      for (const b of BANDS) expect(bands[b.label]).toBeGreaterThan(0);
      // the owner's target pyramid per 10,000, scaled to 2,048 (docs/V10_PLAN.md): within 15 % or 4 binomial sd + 2 (small top bands are noisy per seed)
      for (const b of BANDS) {
        const t = TARGET_PER_10K.filter(x => x.lo >= b.lo && x.hi <= b.hi).reduce((a, x) => a + x.n, 0) * comps.length / 10000;
        if (b.label === '4000+') continue;
        expect(Math.abs(bands[b.label] - t)).toBeLessThanOrEqual(Math.max(4 * Math.sqrt(t) + 2, 0.15 * t));
      }
      expect(bands['4000+']).toBeGreaterThanOrEqual(2);
      expect(bands['4000+']).toBeLessThanOrEqual(4);
      const mean = (d: number) => { const a = comps.filter(c => c.division === d); return a.reduce((s, c) => s + c.latent, 0) / a.length; };
      for (let d = 1; d < DIVISIONS; d++) expect(mean(d)).toBeGreaterThan(mean(d + 1) + 100);
      const d8 = comps.filter(c => c.division === 8);
      expect(d8.filter(c => c.latent < 800).length / d8.length).toBeGreaterThan(0.9);
      expect(Math.min(...comps.map(c => c.latent))).toBeGreaterThanOrEqual(LATENT_MIN);
      expect(Math.min(...comps.map(c => c.rating))).toBeGreaterThanOrEqual(0);
    }
    // a ~10,000 federation (78 regions) hits the target per 10,000 closely and has a few 4,000+
    const big = generateFederation(5, topologyWithRegions(78), POPULATION_V2);
    const bb = bandCounts(big.map(c => c.latent));
    const per10k = (k: string) => bb[k] * 10000 / big.length;
    for (const [k, t] of [['0–399', 500], ['400–799', 1500], ['800–1199', 2500], ['1200–1599', 2600], ['1600–1999', 1700], ['2000–2399', 800], ['2400–2799', 280], ['2800–3199', 90], ['3200–3999', 30]] as const) expect(Math.abs(per10k(k) - t)).toBeLessThanOrEqual(Math.max(3 * Math.sqrt(t), 0.12 * t));
    expect(bb['4000+']).toBeGreaterThanOrEqual(3);
  });
  it('the default (crown-population-1) is unchanged, so every pre-v0.10 seed regenerates identically', () => {
    const a = generateFederation(7), b = generateFederation(7, TOPOLOGY_V1, POPULATION_V1);
    expect(b).toEqual(a);
    expect(Math.min(...a.map(c => c.latent))).toBeGreaterThanOrEqual(750);
    expect(Math.max(...a.map(c => c.latent))).toBeLessThanOrEqual(3050);
    // the population model only changes strength and rating: identities are the same
    const v2 = generateFederation(7, TOPOLOGY_V1, POPULATION_V2);
    expect(v2.map(c => [c.id, c.name, c.region, c.division, c.style, c.birthSeason])).toEqual(a.map(c => [c.id, c.name, c.region, c.division, c.style, c.birthSeason]));
  });
  it('the world records the model only when it is not the legacy one', () => {
    const v1 = createWorld(9, generateFederation(9), 'T').world;
    expect('populationModel' in v1).toBe(false);
    expect(populationModelOf(v1)).toBe(POPULATION_V1);
    const v2 = createWorld(9, generateFederation(9, TOPOLOGY_V1, POPULATION_V2), 'T', TOPOLOGY_V1, POPULATION_V2).world;
    expect(v2.populationModel).toBe(POPULATION_V2);
  });
  it('a new federation founded by the service uses the full spectrum', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), () => '2026-01-01T00:00:00.000Z');
    await svc.create(2, 4242);
    expect(svc.state!.world.populationModel).toBe(POPULATION_V2);
    const lat = [...svc.state!.competitors.values()].map(c => c.latent);
    expect(lat.filter(x => x < 400).length).toBeGreaterThan(70);
    expect(lat.filter(x => x >= 4000).length).toBeGreaterThanOrEqual(1);
  }, 60_000);
});

describe('migration of a v0.9 (crown-population-1) world', () => {
  it('existing competitors are never rescaled; turnover entrants bring beginners into divisions 7–8', () => {
    const seed = 31;
    const comps = generateFederation(seed); // exactly what v0.9 generated and stored
    const { world, plan } = createWorld(seed, comps, 'T');
    const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1432, rd: 80, name: 'You' }, swissHistory: [] };
    const before = new Map(comps.map(c => [c.id, { name: c.name, latent: c.latent, region: c.region, style: c.style }]));
    let rounds: RoundRecord[] = [];
    const entrants: { id: string; division: number; latent: number; rating: number }[] = [];
    for (let s = 0; s < 3; s++) for (let i = 0; i < ROUNDS_PER_SEASON; i++) {
      const p = runRoundHeadless(ctx, rounds);
      if (p.seasonEnd) entrants.push(...p.seasonEnd.entrants.map(e => ({ id: e.id, division: e.division, latent: e.latent, rating: e.rating })));
      rounds = p.seasonEnd ? [] : [...rounds, p.record];
    }
    expect('populationModel' in ctx.world).toBe(false); // still a legacy world: nothing was rewritten
    expect(ctx.player.rating).toBe(1432); // the player's earned rating is never changed
    // every original competitor keeps identity; latent moved only by the season drift (≤ 90 per season, 3 seasons)
    for (const [id, b] of before) {
      const c = ctx.competitors.get(id)!;
      expect([c.name, c.region, c.style]).toEqual([b.name, b.region, b.style]);
      expect(Math.abs(c.latent - b.latent)).toBeLessThanOrEqual(3 * 90);
    }
    const low = entrants.filter(e => e.division >= 7), high = entrants.filter(e => e.division <= 6);
    expect(low.length).toBeGreaterThan(0);
    expect(high.length).toBeGreaterThan(0);
    // divisions 7–8: the v0.10 beginner distribution (centres 640 / 340); elsewhere the unchanged v1 rule
    for (const e of low) { expect(entrantModel(POPULATION_V1, e.division)).toBe(POPULATION_V2); expect(e.latent).toBeLessThan(1300); }
    expect(low.filter(e => e.latent < 800).length / low.length).toBeGreaterThan(0.6);
    for (const e of high) { expect(e.latent).toBeGreaterThanOrEqual(750); expect(e.latent).toBeLessThanOrEqual(3050); expect(e.rating).toBe(2500 - 190 * (e.division - 1)); }
  }, 240_000);
});
