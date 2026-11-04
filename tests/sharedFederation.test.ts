/**
 * v0.11 package K: one shared Federation (crown-competition-2). Entry rules, scheduling, never-auto-play, the
 * postponement deadline / forfeit rule, determinism, qualification and the mid-season migration of an older world.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService, POSTPONE_DEADLINE, POSTPONE_LIMIT } from '../src/app/federation';
import { generateFederation, hashSeed } from '../src/federation/generator';
import { createWorld, joinPlayer, registerChallenger, swissEventsOpenTo, promotionMoves, leagueZone, allKos, type Ctx, type RoundRecord } from '../src/federation/world';
import { runRoundHeadless, gamesOf } from '../src/federation/driver';
import { LEAGUE_ROUNDS, PLAYER_ID, ROUNDS_PER_SEASON, TOPOLOGY_V1, topologyWithRegions } from '../src/federation/model';
import { CUP_ROUNDS, OPEN_INVITES, ZONAL_ROUNDS, cupFields, koPlacings, openField, zoneOf, zoneRegions, zonalFields, zonesOf } from '../src/federation/competitions';
import { roundRobin, type StandingRow } from '../src/federation/formats';
import { opportunities, upcomingMatches } from '../src/app/seasonCareer';
import { headToHead, rivalryFixtures, rivalryTrophies } from '../src/app/rivalries';
import { NEW_FEDERATION_POPULATION } from '../src/federation/population';
import type { GameRecord } from '../src/games/types';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
async function make(f = new IDBFactory(), rules?: number) {
  const db = await CrownDB.open(f);
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
  if (rules) svc.competitionRules = rules;
  svc.runSelfplay = async req => { const h = hashSeed(req.seed, 'stub') % 3; return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: 'checkmate' }; };
  return { db, svc, f };
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

function headless(seed: number, rules: number, regions = 16, strength = 1500) {
  const topo = topologyWithRegions(regions);
  const comps = generateFederation(seed, topo, NEW_FEDERATION_POPULATION);
  const { world, plan } = createWorld(seed, comps, 'T', topo, NEW_FEDERATION_POPULATION, rules);
  const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: strength, rd: 60, name: 'You' }, swissHistory: [], targetRules: rules };
  joinPlayer(ctx, 1);
  let rounds: RoundRecord[] = [];
  const plans: typeof plan[] = [];
  const season = () => {
    for (let r = 1; r <= ROUNDS_PER_SEASON; r++) {
      const before = ctx.plan;
      const res = runRoundHeadless(ctx, rounds, 'T', f => (f.white === PLAYER_ID ? 1 : 0));
      rounds = r === ROUNDS_PER_SEASON ? [] : [...rounds, res.record];
      if (r === ROUNDS_PER_SEASON) plans.push(before);
    }
  };
  return { ctx, season, plans };
}

describe('crown-competition-2: pure rules', () => {
  it('zones scale with the world: 2 regions at 16, 4 at 32, 10 at 80; every region in exactly one of 8 zones', () => {
    for (const [regions, per] of [[16, 2], [32, 4], [80, 10]] as const) {
      expect(zonesOf(regions)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      for (const z of zonesOf(regions)) expect(zoneRegions(z, regions)).toHaveLength(per);
      expect(zoneOf(regions - 1, regions)).toBe(7);
    }
  });
  it('zonal field: by finishing rank across the zone, points then rating inside a rank, excluding Championship qualifiers', () => {
    const row = (id: string, points: number): StandingRow => ({ id, points, played: 15, w: 0, d: 0, l: 0, sb: 0, buchholz: 0, buchholzCut1: 0, seed: 1 });
    const tables = new Map<string, StandingRow[]>();
    for (const r of [0, 1]) tables.set(`${r}:1`, Array.from({ length: 16 }, (_, i) => row(`r${r}p${i}`, 15 - i - (r === 1 ? 0.5 : 0))));
    const f = zonalFields(16, tables, new Set(['r0p0']), () => 1500);
    expect(f[0].ids).toHaveLength(16);
    expect(f[0].ids[0]).toBe('r1p0'); // the only rank-1 left
    expect(f[0].ids.slice(1, 3)).toEqual(['r0p1', 'r1p1']); // rank 2 by points
    expect(f[0].ids).not.toContain('r0p0');
    expect(f[0].ids).toContain('r0p8'); // rank 9 fills the place of the excluded qualifier
  });
  it('cup field: champions of divisions 2–8 plus the division-2 runner-up; excluded players replaced by their division', () => {
    const tables = new Map<string, StandingRow[]>();
    for (let d = 1; d <= 8; d++) tables.set(`0:${d}`, Array.from({ length: 16 }, (_, i) => ({ id: `d${d}p${i}`, points: 15 - i, played: 15, w: 0, d: 0, l: 0, sb: 0, buchholz: 0, buchholzCut1: 0, seed: i })));
    const [c] = cupFields(1, tables, new Set(['d2p0']));
    expect(c.ids).toEqual(['d2p1', 'd2p2', 'd3p0', 'd4p0', 'd5p0', 'd6p0', 'd7p0', 'd8p0']);
  });
  it('Open field: invitees first, then rating; 32; seeded by rating', () => {
    const rating = (id: string) => +id.slice(1);
    const field = openField(['x10', 'x20'], Array.from({ length: 40 }, (_, i) => `x${3000 - i}`), rating);
    expect(field).toHaveLength(32);
    expect(field).toContain('x10');
    expect(field[field.length - 1]).toBe('x10');
    expect(field).not.toContain('x2970');
  });
  it('promotion/relegation rule is exported and unchanged: top 2 up, bottom 2 down, none above 1 or below 8', () => {
    const tables = new Map<string, StandingRow[]>();
    for (let d = 1; d <= 8; d++) tables.set(`0:${d}`, Array.from({ length: 16 }, (_, i) => ({ id: `d${d}p${i}`, points: 0, played: 0, w: 0, d: 0, l: 0, sb: 0, buchholz: 0, buchholzCut1: 0, seed: i })));
    const moves = promotionMoves(tables, { ...TOPOLOGY_V1, regions: 1 });
    expect(moves).toHaveLength(28);
    expect(moves.filter(m => m.from === 1).map(m => m.id)).toEqual(['d1p14', 'd1p15']);
    expect(moves.some(m => m.from === 8 && m.to === 9)).toBe(false);
    expect(leagueZone(1, 1, 16)).toBe(null); expect(leagueZone(2, 2, 16)).toBe('promotion'); expect(leagueZone(8, 16, 16)).toBe(null); expect(leagueZone(3, 15, 16)).toBe('relegation');
  });
});

describe('crown-competition-2: the season calendar', () => {
  it('builds 8 Zonal Championships and one Regional Cup per region after round 15; disjoint fields; all decided; qualification carried to next season', () => {
    const h = headless(77, 2);
    h.season();
    const plan = h.plans[0];
    const zonals = plan.cups!.filter(k => k.kind === 'zonal'), cups = plan.cups!.filter(k => k.kind === 'cup');
    expect(zonals).toHaveLength(8); expect(cups).toHaveLength(16);
    for (const z of zonals) { expect(z.qualifiers).toHaveLength(16); expect(z.stages.map(s => s.round)).toEqual(ZONAL_ROUNDS); expect(z.champions).toHaveLength(1); }
    for (const c of cups) { expect(c.qualifiers).toHaveLength(8); expect(c.stages.map(s => s.round)).toEqual(CUP_ROUNDS); expect(c.champions).toHaveLength(1); }
    const all = [...plan.champ!.qualifiers, ...plan.cups!.flatMap(k => k.qualifiers)];
    expect(new Set(all).size).toBe(all.length); // nobody plays two knockouts
    const w = h.ctx.world;
    expect(w.crownQualified).toEqual({ season: 2, ids: zonals.map(z => z.champions[0]) });
    expect(w.openInvites!.ids.length).toBeLessThanOrEqual(OPEN_INVITES);
    // the player (always winning) won the Open Division and their Regional Cup
    expect(cups.find(c => c.qualifiers.includes(PLAYER_ID))!.champions).toEqual([PLAYER_ID]);
    expect(w.player.titles.some(t => /Regional Cup winner S1/.test(t.title))).toBe(true);
    // next season: invitees are in the Open; the Championship gives zone places to last season's zonal champions
    const open2 = h.ctx.plan.swiss.find(s => s.event === 'open')!;
    for (const id of w.openInvites!.ids) expect(open2.entrants).toContain(id);
    expect(h.ctx.plan.invited).toEqual(w.openInvites!.ids);
    const zonePlaces = [...w.crownQualified!.ids];
    h.season();
    const champ2 = h.plans[1].champ!;
    for (const id of zonePlaces.filter(id => h.ctx.competitors.get(id)!.status === 'active' || id === PLAYER_ID)) expect(champ2.qualifiers).toContain(id);
    // prizes by placing: one champion, one finalist, two semifinalists, four quarterfinalists in a zonal
    const pl = koPlacings(zonals[0]);
    expect(pl.filter(p => p.place === 'champion')).toHaveLength(1); expect(pl.filter(p => p.place === 'semi')).toHaveLength(2); expect(pl.filter(p => p.place === 'quarter')).toHaveLength(4);
  });
  it('is deterministic, and crown-competition-1 worlds get none of it', () => {
    const a = headless(5, 2), b = headless(5, 2);
    a.season(); b.season();
    expect(JSON.stringify([...a.ctx.competitors.values()])).toBe(JSON.stringify([...b.ctx.competitors.values()]));
    expect(JSON.stringify(a.plans[0])).toBe(JSON.stringify(b.plans[0]));
    const legacy = headless(5, 1);
    legacy.ctx.targetRules = undefined;
    legacy.season();
    expect(legacy.plans[0].cups).toBeUndefined();
    expect('rules' in legacy.ctx.world).toBe(false);
    expect(legacy.ctx.world.crownQualified).toBeUndefined();
  });
  it('entry rules: the Open needs divisions 2–4 or an invitation; registration closes before round 4; one Swiss per season', () => {
    const h = headless(9, 2);
    const ctx = h.ctx;
    expect(swissEventsOpenTo(ctx.world)).toEqual(['challenger']);
    expect(() => registerChallenger(ctx, 'open')).toThrow(/invited/);
    ctx.world.player.invite = { season: 1, event: 'open', reason: 'test' };
    expect(swissEventsOpenTo(ctx.world)).toEqual(['open', 'challenger']);
    registerChallenger(ctx, 'open');
    expect(ctx.plan.swiss.find(s => s.event === 'open')!.entrants).toContain(PLAYER_ID);
    expect(() => registerChallenger(ctx, 'challenger')).toThrow(/Already registered/);
    const h2 = headless(9, 2);
    h2.ctx.world.round = 4;
    expect(() => registerChallenger(h2.ctx, 'challenger')).toThrow(/closed/);
  });
});

describe('shared Federation service: never auto-play, deadline and forfeit rule', () => {
  it('a pending player game blocks advance; postponement moves it out, keeps it playable, and round 15 is the deadline', async () => {
    const { svc } = await make();
    await svc.create(2, 4242);
    expect(svc.state!.world.rules).toBe(2);
    const f1 = svc.roundFixtures()[0];
    await expect(svc.advanceRound()).rejects.toThrow(/postpone or forfeit/);
    // the live scheduler never takes a player game
    expect(svc.slateCandidates().some(([, w, b]) => w === PLAYER_ID || b === PLAYER_ID)).toBe(false);
    await svc.postpone(f1.id);
    expect(svc.postponedFixtures().map(f => f.id)).toEqual([f1.id]);
    expect(svc.state!.world.player.postponed![0].postponedFrom).toBe(1);
    await svc.advanceRound(); // round 1 closes without the game: nothing was played for the player
    expect(svc.state!.world.round).toBe(2);
    const r1 = svc.seasonRounds()[0];
    expect(r1.fixtures.some(f => f.id === f1.id)).toBe(false);
    // limit
    await svc.postpone(svc.roundFixtures()[0].id);
    await svc.advanceRound();
    expect(svc.postponeBlocker(svc.roundFixtures()[0].id)).toMatch(new RegExp(`${POSTPONE_LIMIT} postponed`));
    // the postponed game is played later: counted in this round, rated once, in the standings
    await play(svc, f1, 1);
    expect(svc.postponedFixtures()).toHaveLength(1);
    const rec = svc.currentRound()!;
    expect(rec.fixtures.find(f => f.id === f1.id)).toMatchObject({ result: f1.white === PLAYER_ID ? 1 : 0, round: 3, postponedFrom: 1 });
    // play to the deadline round with the other postponed game outstanding
    while (svc.state!.world.round < POSTPONE_DEADLINE) { await playAll(svc); for (const f of svc.roundFixtures()) await play(svc, f, 1); await svc.advanceRound(); }
    expect(svc.blockingFixtures().length).toBeGreaterThanOrEqual(1);
    await expect(svc.advanceRound()).rejects.toThrow(/deadline|postpone/);
    const opp = svc.postponedFixtures()[0];
    await svc.forfeitAndAdvance();
    expect(svc.state!.world.round).toBe(LEAGUE_ROUNDS + 1);
    const forfeited = svc.seasonRounds().flatMap(r => r.fixtures).find(f => f.id === opp.id)!;
    expect(forfeited.forfeit).toBe(true);
    expect(total(svc)).toBe(0);
  }, 120_000);

  it('Swiss and knockout games cannot be postponed', async () => {
    const { svc } = await make();
    await svc.create(2, 99);
    await svc.registerChallenger(false);
    while (svc.state!.world.round < 4) { await playAll(svc); await svc.advanceRound(); }
    const sw = svc.roundFixtures().find(f => f.event === 'challenger')!;
    expect(svc.postponeBlocker(sw.id)).toMatch(/Only league games/);
    await expect(svc.postpone(sw.id)).rejects.toThrow(/Only league games/);
  }, 60_000);

  it('a full crown-competition-2 season through the service: cup prizes from escrow, ledger conserved, career selectors from saved state', async () => {
    const { svc } = await make();
    await svc.create(5, 31);
    const opp = opportunities(svc.state!, []);
    expect(opp.find(o => o.id === 'challenger')).toMatchObject({ status: 'open', action: { event: 'challenger', free: false } });
    expect(opp.find(o => o.id === 'promotion')!.need).toMatch(/top 2/);
    const up = upcomingMatches(svc.state!, 20);
    const circuit = svc.state!.plan.circuits.find(c => c.members.includes(PLAYER_ID))!;
    const rr = roundRobin(circuit.members);
    const r2 = up.find(u => u.round === 2 && u.status === 'scheduled')!;
    const p2 = rr[1].find(([a, b]) => a === PLAYER_ID || b === PLAYER_ID)!;
    expect(r2.opponent).toBe(p2[0] === PLAYER_ID ? p2[1] : p2[0]);
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) { await playAll(svc); await svc.advanceRound(); expect(total(svc)).toBe(0); }
    const journals = await svc.db.loadAll<{ id: string }>('journal');
    expect(journals.filter(j => /^prize-pay:1:zonal-/.test(j.id))).toHaveLength(8);
    expect(journals.filter(j => /^prize-pay:1:cup-/.test(j.id))).toHaveLength(16);
    expect(svc.state!.world.player.titles.some(t => /Regional Cup winner S1/.test(t.title))).toBe(true);
    expect(svc.state!.world.player.invite).toMatchObject({ season: 2, event: 'open' });
    // invitation: free Federation Open entry although the player is in division 7
    const cash = svc.balance('player:cash');
    await svc.registerChallenger(false, 'open');
    expect(svc.balance('player:cash')).toBe(cash);
    expect(svc.state!.plan.swiss.find(s => s.event === 'open')!.entrants).toContain(PLAYER_ID);
  }, 180_000);

  it('migrates a crown-competition-1 (v0.9/v0.10) world mid-season: the season finishes under its rules, the next adopts crown-competition-2', async () => {
    const f = new IDBFactory();
    const old = await make(f, 1);
    await old.svc.create(3, 555);
    for (let i = 0; i < 8; i++) { await playAll(old.svc); await old.svc.advanceRound(); }
    expect(old.svc.state!.world.rules).toBeUndefined();
    const { svc } = await make(f); // the v0.11 app (rules 2) opens the same save
    await svc.load();
    expect(svc.state!.world.round).toBe(9);
    for (let i = 8; i < ROUNDS_PER_SEASON; i++) { await playAll(svc); await svc.advanceRound(); expect(total(svc)).toBe(0); }
    const s1 = svc.state!.plans.get('season:1')!;
    expect(s1.cups).toBeUndefined(); // season 1 kept crown-competition-1
    expect(svc.state!.world.rules).toBe(2);
    expect(svc.state!.plan.rules).toBe(2);
    const journals = await svc.db.loadAll<{ id: string; lines: { account: string }[] }>('journal');
    expect(journals.find(j => j.id === 'mint:season:2')!.lines.some(l => l.account === 'prize:2:zonal-0')).toBe(true);
    for (let i = 0; i < LEAGUE_ROUNDS; i++) { await playAll(svc); await svc.advanceRound(); }
    expect(svc.state!.plan.cups!.length).toBe(24);
    expect(allKos(svc.state!.plan).length).toBe(25);
  }, 240_000);
});

describe('rivalries: head-to-head, rivalry events, trophies hook', () => {
  it('challenges count separately; scheduled meetings come from the round robin; trophies only from recorded results', () => {
    const r = { a: PLAYER_ID, b: 'c1', intensity: 35, level: 'Nemesis', w: 3, d: 1, l: 1, meetings: 5, events: [], lastSeason: 1 };
    const g = (res: string, colour: 'white' | 'black', opp = 'c1') => ({ context: { kind: 'quick-match' }, status: 'finalized', result: res, humanColor: colour, white: { id: colour === 'white' ? 'player' : opp }, black: { id: colour === 'black' ? 'player' : opp } }) as unknown as GameRecord;
    const h = headToHead(r, 'c1', [g('1-0', 'white'), g('1-0', 'black'), g('1/2-1/2', 'white'), g('1-0', 'white', 'c2')]);
    expect(h).toEqual({ federation: { w: 3, d: 1, l: 1 }, challenges: { w: 1, d: 1, l: 1 } });
    const t = rivalryTrophies(r, [{ winner: PLAYER_ID, loser: 'c1' }]);
    expect(t.filter(x => x.earned).map(x => x.id)).toEqual(['rivalry-laurel', 'rivalry-knockout']);
    const h0 = headless(3, 2);
    const circuit = h0.ctx.plan.circuits.find(c => c.members.includes(PLAYER_ID))!;
    const opp = roundRobin(circuit.members)[4].find(([a, b]) => a === PLAYER_ID || b === PLAYER_ID)!.find(x => x !== PLAYER_ID)!;
    const ev = rivalryFixtures(h0.ctx.plan, 1, new Set([opp]), x => x);
    expect(ev).toEqual([{ rival: opp, round: 5, kind: 'league', text: `League round 5: you meet ${opp}` }]);
    void gamesOf;
  });
});
