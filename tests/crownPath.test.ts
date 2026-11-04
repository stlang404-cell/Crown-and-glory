/**
 * v1.0 package S: crown-competition-3, the Crown Path (docs/V3_COMPETITION_RULES.md § crown-competition-3).
 * Pure rules, the season calendar, determinism, registration that never displaces an invitee, a full season through the
 * service with prizes and a balanced ledger, and the migration of crown-competition-1 / -2 worlds mid-season.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { generateFederation, hashSeed } from '../src/federation/generator';
import { createWorld, joinPlayer, registerChallenger, type Ctx, type RoundRecord, type SeasonPlan } from '../src/federation/world';
import { runRoundHeadless } from '../src/federation/driver';
import { LEAGUE_ROUNDS, PLAYER_ID, ROUNDS_PER_SEASON, topologyWithRegions } from '../src/federation/model';
import {
  CHALLENGER_INVITES, COMPETITION_RULES_ID, PATH_MIN_POINTS, PATH_PLACES, RULES_V3, ZONAL_DEPTH, competitionRulesId, cupFields, openChampionshipPlaces,
  openInvitationsV3, openInvitesMax, openInvitesPerZone, zoneOf, zoneRegions, zonalFields,
} from '../src/federation/competitions';
import type { StandingRow } from '../src/federation/formats';
import { opportunities } from '../src/app/seasonCareer';
import { NEW_FEDERATION_POPULATION } from '../src/federation/population';
import type { GameRecord } from '../src/games/types';

const row = (id: string, points: number, seed = 1): StandingRow => ({ id, points, played: 15, w: 0, d: 0, l: 0, sb: 0, buchholz: 0, buchholzCut1: 0, seed });

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
async function make(f = new IDBFactory(), rules?: number) {
  const db = await CrownDB.open(f);
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
  if (rules) svc.competitionRules = rules;
  svc.runSelfplay = async req => { const h = hashSeed(req.seed, 'stub') % 3; return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: 'checkmate' }; };
  return { db, svc };
}
const total = (svc: FederationService) => [...svc.state!.balances.values()].reduce((a, b) => a + b, 0);
async function play(svc: FederationService, f: { id: string }, score: 1 | 0 | 0.5) {
  const g = await svc.playerGameFor(f.id, { rating: 1500, rd: 200 });
  const white = g.humanColor === 'white';
  const res = score === 0.5 ? '1/2-1/2' : (score === 1) === white ? '1-0' : '0-1';
  await svc.recordPlayerGame({ ...g, result: res, status: 'finalized' } as GameRecord);
}
async function playAll(svc: FederationService, score: 1 | 0 | 0.5 = 1) {
  for (let pass = 0; pass < 8 && svc.blockingFixtures().length; pass++) for (const f of svc.blockingFixtures()) await play(svc, f, score);
}

function headless(seed: number, rules: number, regions = 16, strength = 1500, result: (white: boolean) => number = w => (w ? 1 : 0)) {
  const topo = topologyWithRegions(regions);
  const comps = generateFederation(seed, topo, NEW_FEDERATION_POPULATION);
  const { world, plan } = createWorld(seed, comps, 'T', topo, NEW_FEDERATION_POPULATION, rules);
  const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: strength, rd: 60, name: 'You' }, swissHistory: [], targetRules: rules };
  joinPlayer(ctx, 1);
  let rounds: RoundRecord[] = [];
  const plans: SeasonPlan[] = [];
  const season = (before?: (ctx: Ctx) => void) => {
    before?.(ctx);
    for (let r = 1; r <= ROUNDS_PER_SEASON; r++) {
      const p = ctx.plan;
      const res = runRoundHeadless(ctx, rounds, 'T', f => result(f.white === PLAYER_ID));
      rounds = r === ROUNDS_PER_SEASON ? [] : [...rounds, res.record];
      if (r === ROUNDS_PER_SEASON) plans.push(p);
    }
  };
  return { ctx, season, plans };
}

describe('crown-competition-3: pure rules', () => {
  it('is versioned: rules 3 is crown-competition-3, the id of new federations', () => {
    expect(RULES_V3).toBe(3);
    expect(COMPETITION_RULES_ID).toBe('crown-competition-3');
    expect(competitionRulesId(2)).toBe('crown-competition-2');
    expect(competitionRulesId(1)).toBe('crown-competition-1');
  });

  it('zonal field at 10,240 (10 regions per zone): every regional winner, then the highest-rated 2nd and 3rd places', () => {
    const tables = new Map<string, StandingRow[]>();
    for (const r of zoneRegions(0, 80)) tables.set(`${r}:1`, Array.from({ length: 16 }, (_, i) => row(`r${r}p${i}`, 15 - i)));
    // rating: a 3rd place of region 9 is rated highest of all; the 2nd places are rated by region number
    const rating = (id: string) => { const [r, p] = id.slice(1).split('p').map(Number); return p === 2 && r === 9 ? 3000 : p === 1 ? 2000 + r : p === 2 ? 1900 + r : 1500; };
    const [f3] = zonalFields(80, tables, new Set(), rating, 3);
    expect(f3.ids).toHaveLength(16);
    expect(f3.ids.slice(0, 10).sort()).toEqual(zoneRegions(0, 80).map(r => `r${r}p0`).sort());
    expect(f3.ids.slice(10)).toEqual(['r9p2', 'r9p1', 'r8p1', 'r7p1', 'r6p1', 'r5p1']);
    // crown-competition-2 took the 6 runners-up with most points (all equal here: rating, then id)
    const [f2] = zonalFields(80, tables, new Set(), rating, 2);
    expect(f2.ids).not.toContain('r9p2');
    // a regional winner already in the Crown Championship frees one more place for the depth pool
    const [fx] = zonalFields(80, tables, new Set(['r0p0']), rating, 3);
    expect(fx.ids).not.toContain('r0p0');
    expect(fx.ids).toContain('r4p1');
    expect(fx.ids.every(id => +id.split('p')[1] < ZONAL_DEPTH)).toBe(true);
  });

  it('zonal field at 2,048 and 4,096 is exactly crown-competition-2 (the guaranteed places fill the field)', () => {
    for (const regions of [16, 32]) {
      const tables = new Map<string, StandingRow[]>();
      for (const r of zoneRegions(0, regions)) tables.set(`${r}:1`, Array.from({ length: 16 }, (_, i) => row(`r${r}p${i}`, 15 - i - r * 0.25)));
      const rating = (id: string) => (hashSeed(1, id) % 1000) + 1500;
      for (const ex of [new Set<string>(), new Set(['r0p0', `r${zoneRegions(0, regions)[1]}p0`, 'r0p3'])]) expect(zonalFields(regions, tables, ex, rating, 3)).toEqual(zonalFields(regions, tables, ex, rating, 2));
    }
  });

  it('cup field: champions and runners-up of divisions 3–4, champions of 5–8; no Grand Division; excluded players replaced', () => {
    const tables = new Map<string, StandingRow[]>();
    for (let d = 1; d <= 8; d++) tables.set(`0:${d}`, Array.from({ length: 16 }, (_, i) => row(`d${d}p${i}`, 15 - i, i)));
    const [c] = cupFields(1, tables, new Set(['d3p0']), 3);
    expect(c.ids).toEqual(['d3p1', 'd3p2', 'd4p0', 'd4p1', 'd5p0', 'd6p0', 'd7p0', 'd8p0']);
    expect(cupFields(1, tables, new Set(), 2)[0].ids).toEqual(['d2p0', 'd2p1', 'd3p0', 'd4p0', 'd5p0', 'd6p0', 'd7p0', 'd8p0']);
  });

  it('Open invitations: per zone the highest-rated cup winners who stay in divisions 2–8, plus the Challenger Open winner', () => {
    expect(openInvitesPerZone(16)).toBe(1); expect(openInvitesPerZone(32)).toBe(1); expect(openInvitesPerZone(80)).toBe(2);
    expect(CHALLENGER_INVITES).toBe(1);
    expect(openInvitesMax(16)).toBe(9); expect(openInvitesMax(80)).toBe(17);
    const rating = (id: string) => +id.split(':')[1];
    const div = (id: string) => (id.startsWith('up') ? 1 : 3);
    // 2,048: zone 0 = regions 0–1, zone 1 = regions 2–3
    const winners = [{ id: 'a:1800', region: 0 }, { id: 'b:1900', region: 1 }, { id: 'up:2500', region: 2 }, { id: 'c:1700', region: 3 }];
    const inv = openInvitationsV3(winners, ['ch:1400', 'ch2:1450'], 16, div, rating);
    expect(inv).toEqual(['b:1900', 'c:1700', 'ch:1400']); // zone 1's best stays-down winner is c (up is promoted to the Crown Division)
    expect(openInvitationsV3(winners, ['b:1900', 'x:1'], 16, div, rating)).toEqual(['b:1900', 'c:1700']); // counted once
    // 10,240: 2 per zone
    const w80 = zoneRegions(0, 80).map((r, i) => ({ id: `z${r}:${1600 + i * 10}`, region: r }));
    expect(openInvitationsV3(w80, [], 80, () => 3, rating)).toEqual(['z9:1690', 'z8:1680']);
    expect(zoneOf(9, 80)).toBe(0);
  });

  it('Championship places of the Open: top 6, then 2 Crown Path places for invited entrants with ≥ 3 / 5, else the Open order', () => {
    const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((id, i) => row(id, 5 - i * 0.4));
    // points: a 5, b 4.6, c 4.2, d 3.8, e 3.4, f 3.0, g 2.6, h 2.2, ... (made-up values; only the order and threshold matter)
    order[6].points = 3.5; order[7].points = 3; order[8].points = 3; order[9].points = 2.5;
    expect(PATH_PLACES).toBe(2); expect(PATH_MIN_POINTS).toBe(3);
    // invitees i (3 points) and j (2.5): i takes a path place, j is below the threshold, so the 8th place is the next finisher
    const r1 = openChampionshipPlaces(order, new Set(['i', 'j']), []);
    expect(r1.path).toEqual(['i']);
    expect(r1.ids).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'i', 'g']);
    // an invitee inside the top 6 holds a regular place; already-qualified players are skipped
    const r2 = openChampionshipPlaces(order, new Set(['b', 'h', 'i']), ['a']);
    expect(r2.ids.slice(0, 6)).toEqual(['b', 'c', 'd', 'e', 'f', 'g']);
    expect(r2.path).toEqual(['h', 'i']);
    expect(r2.ids).toHaveLength(8);
    // no invitees: the Open's top 8, as before
    expect(openChampionshipPlaces(order, new Set(), []).ids).toEqual(order.slice(0, 8).map(r => r.id));
  });
});

describe('crown-competition-3: the season calendar', () => {
  it('cups, invitations and Crown Path places follow the rules over two seasons; deterministic', () => {
    const run = () => { const h = headless(77, 3); h.season(); h.season(); return h; };
    const h = run();
    const [p1, p2] = h.plans;
    expect(p1.rules).toBe(3); expect(p2.rules).toBe(3);
    const cups = p1.cups!.filter(k => k.kind === 'cup');
    expect(cups).toHaveLength(16);
    const divOf = new Map<string, number>(); for (const c of p1.circuits) for (const m of c.members) divOf.set(m, c.division);
    for (const c of cups) expect(c.qualifiers.every(id => divOf.get(id)! >= 3)).toBe(true);
    // season-2 Open: invitations = 1 per zone of the cup winners + the Challenger Open winner; all of them entered
    const invited = p2.invited!;
    expect(invited.length).toBeLessThanOrEqual(openInvitesMax(16));
    const open2 = p2.swiss.find(s => s.event === 'open')!;
    for (const id of invited) expect(open2.entrants).toContain(id);
    const winnersByZone = new Map<number, number>();
    for (const id of invited) { const k = cups.find(c => c.champions.includes(id)); if (k) winnersByZone.set(zoneOf(k.region!, 16), (winnersByZone.get(zoneOf(k.region!, 16)) ?? 0) + 1); }
    for (const n of winnersByZone.values()) expect(n).toBe(1);
    // the Championship: 16; path places only to invitees with ≥ 3 Open points
    const champ = p2.champ!;
    expect(champ.qualifiers).toHaveLength(16);
    expect(champ.pathPlaces!.length).toBeLessThanOrEqual(PATH_PLACES);
    for (const id of champ.pathPlaces!) expect(invited.includes(id) || id === PLAYER_ID).toBe(true);
    // deterministic
    const h2 = run();
    expect(JSON.stringify(h2.plans)).toBe(JSON.stringify(h.plans));
    expect(JSON.stringify([...h2.ctx.competitors.values()])).toBe(JSON.stringify([...h.ctx.competitors.values()]));
  });

  it('the always-winning player climbs the Crown Path: Challenger Open → Open invitation (free, never displaces an invitee) → Crown Championship', () => {
    const h = headless(31, 3);
    h.season(ctx => registerChallenger(ctx, 'challenger'));
    const w = h.ctx.world;
    expect(w.player.titles.some(t => /Regional Cup winner S1/.test(t.title))).toBe(true);
    // the player won the Challenger Open (5/5) and their cup: invited as the Challenger Open winner or as their zone's cup winner
    expect(w.player.invite).toMatchObject({ season: 2, event: 'open' });
    const open = h.ctx.plan.swiss.find(s => s.event === 'open')!;
    const invited = h.ctx.plan.invited!;
    const before = [...open.entrants];
    const { replaced } = registerChallenger(h.ctx, 'open');
    expect(invited).not.toContain(replaced);
    for (const id of invited) expect(open.entrants).toContain(id);
    expect(open.entrants).toHaveLength(32);
    expect(before).toContain(replaced);
    h.season();
    const champ = h.plans[1].champ!;
    expect(champ.qualifiers).toContain(PLAYER_ID); // 5 / 5 in the Open
  });

});

describe('crown-competition-3 through the service', () => {
  it('a full season: prizes from escrow, ledger balanced every round, opportunities state the Crown Path', async () => {
    const { svc } = await make();
    await svc.create(5, 31);
    expect(svc.state!.world.rules).toBe(3);
    const opp = opportunities(svc.state!, []);
    expect(opp.find(o => o.id === 'challenger')!.need).toMatch(/invited to next season's Federation Open/);
    expect(opp.find(o => o.id === 'cup')!.need).toMatch(/Win the Open Division/);
    expect(opp.find(o => o.id === 'champ')!.need).toMatch(/Crown Path/);
    await svc.registerChallenger(false);
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) { await playAll(svc); await svc.advanceRound(); expect(total(svc)).toBe(0); }
    const journals = await svc.db.loadAll<{ id: string }>('journal');
    expect(journals.filter(j => /^prize-pay:1:zonal-/.test(j.id))).toHaveLength(8);
    expect(journals.filter(j => /^prize-pay:1:cup-/.test(j.id))).toHaveLength(16);
    expect(journals.some(j => j.id === 'prize-pay:1:champ' || /^prize-pay:1:champ/.test(j.id))).toBe(true);
    const s1 = svc.state!.plans.get('season:1')!;
    expect(s1.champ!.pathPlaces).toBeDefined();
    // the player (won every game) won the Challenger Open: invited to season 2's Federation Open, free entry
    expect(svc.state!.world.player.invite).toMatchObject({ season: 2, event: 'open' });
    const cash = svc.balance('player:cash');
    expect(opportunities(svc.state!, []).find(o => o.id === 'champ')!.need).toMatch(/You are invited to the Federation Open/);
    await svc.registerChallenger(false, 'open');
    expect(svc.balance('player:cash')).toBe(cash);
    expect(svc.state!.plan.swiss.find(s => s.event === 'open')!.entrants).toContain(PLAYER_ID);
    for (const id of svc.state!.plan.invited ?? []) expect(svc.state!.plan.swiss.find(s => s.event === 'open')!.entrants).toContain(id);
  }, 240_000);

  it('migrates a crown-competition-2 (v0.11) world mid-season: it finishes under -2, the next season starts under -3', async () => {
    const f = new IDBFactory();
    const old = await make(f, 2);
    await old.svc.create(3, 555);
    for (let i = 0; i < 8; i++) { await playAll(old.svc); await old.svc.advanceRound(); }
    expect(old.svc.state!.world.rules).toBe(2);
    const { svc } = await make(f); // the v1.0 app (crown-competition-3) opens the same save
    await svc.load();
    expect(svc.state!.world.round).toBe(9);
    for (let i = 8; i < ROUNDS_PER_SEASON; i++) {
      await playAll(svc); await svc.advanceRound(); expect(total(svc)).toBe(0);
      if (svc.state!.world.round === LEAGUE_ROUNDS + 2) {
        // still crown-competition-2: the cups include the Grand Division, the Championship has no Crown Path places
        const p = svc.state!.plan;
        expect(p.rules).toBe(2);
        const divOf = new Map<string, number>(); for (const c of p.circuits) for (const m of c.members) divOf.set(m, c.division);
        expect(p.cups!.filter(k => k.kind === 'cup').some(k => k.qualifiers.some(id => divOf.get(id) === 2))).toBe(true);
        expect(p.champ!.pathPlaces).toBeUndefined();
      }
    }
    const s1 = svc.state!.plans.get('season:1')!;
    expect(s1.rules).toBe(2);
    expect(svc.state!.world.rules).toBe(3);
    expect(svc.state!.plan.rules).toBe(3);
    // the invitations earned under -2 are honoured in the first -3 season
    expect(svc.state!.plan.invited).toEqual(svc.state!.world.openInvites!.ids.filter(id => svc.state!.competitors.get(id)!.status === 'active' && svc.state!.competitors.get(id)!.division >= 2));
    for (let i = 0; i < LEAGUE_ROUNDS; i++) { await playAll(svc); await svc.advanceRound(); expect(total(svc)).toBe(0); }
    const p2 = svc.state!.plan;
    expect(p2.cups!.length).toBe(24);
    const divOf = new Map<string, number>(); for (const c of p2.circuits) for (const m of c.members) divOf.set(m, c.division);
    for (const k of p2.cups!.filter(k => k.kind === 'cup')) expect(k.qualifiers.every(id => divOf.get(id)! >= 3)).toBe(true);
    expect(p2.champ!.pathPlaces).toBeDefined();
  }, 300_000);

  it('a crown-competition-1 world adopts crown-competition-3 directly at its next season start', async () => {
    const f = new IDBFactory();
    const old = await make(f, 1);
    await old.svc.create(2, 808);
    for (let i = 0; i < 12; i++) { await playAll(old.svc); await old.svc.advanceRound(); }
    const { svc } = await make(f);
    await svc.load();
    for (let i = 12; i < ROUNDS_PER_SEASON; i++) { await playAll(svc); await svc.advanceRound(); expect(total(svc)).toBe(0); }
    expect(svc.state!.plans.get('season:1')!.cups).toBeUndefined();
    expect(svc.state!.world.rules).toBe(3);
    expect(svc.state!.plan.rules).toBe(3);
  }, 240_000);
});
