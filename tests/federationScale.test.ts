/**
 * Federation scale (docs/FEDERATION_SCALE.md): versioned topology with existing 2,048 saves unchanged, the larger
 * crown-topology-2 world, and the behaviour-preserving optimisations (shared competitor records in commands that do
 * not change them; head-to-head computed once per tied group).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { generateFederation } from '../src/federation/generator';
import { createWorld, joinPlayer, makePlan, Ctx, RoundRecord, WorldState } from '../src/federation/world';
import { runRoundHeadless } from '../src/federation/driver';
import { NEW_FEDERATION_TOPOLOGY, PLAYER_ID, ROUNDS_PER_SEASON, TOPOLOGY_V1, TOPOLOGY_V2, TOPOLOGY_V3, newFederationTopology, populationOf, regionName, regionNamesOf, topologyOf } from '../src/federation/model';
import { leagueOrder, standings, type Game, type StandingRow } from '../src/federation/formats';
import { playSelfplay } from '../src/engine/selfplay';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
async function make(f = new IDBFactory()) {
  const svc = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
  const tiny = <T extends { profile: { nodes: number } }>(x: T): T => ({ ...x, profile: { ...x.profile, nodes: 120, depth: 3, selection: null } });
  svc.runSelfplay = async (req, onMove) => playSelfplay(req.initialFen, tiny(req.white), tiny(req.black), req.seed, req.maxPlies, m => onMove(m));
  return { svc, f };
}

/** The pre-v0.9 league order (head-to-head re-filtered on every comparison), kept as the reference. */
function leagueOrderReference(rows: StandingRow[], games: Game[]): StandingRow[] {
  const byPts = new Map<number, StandingRow[]>();
  for (const r of rows) byPts.set(r.points, [...(byPts.get(r.points) ?? []), r]);
  const h2h = (group: Set<string>, id: string) => games.filter(g => g.result !== null && group.has(g.white) && group.has(g.black) && (g.white === id || g.black === id))
    .reduce((a, g) => a + (g.white === id ? g.result! : 1 - g.result!), 0);
  const out: StandingRow[] = [];
  for (const p of [...byPts.keys()].sort((a, b) => b - a)) {
    const group = byPts.get(p)!;
    const ids = new Set(group.map(r => r.id));
    out.push(...group.sort((a, b) => h2h(ids, b.id) - h2h(ids, a.id) || b.sb - a.sb || a.seed - b.seed));
  }
  return out;
}

describe('federation topology', () => {
  it('new federations keep the original 2,048 world unless the constant changes; the world record format is unchanged', async () => {
    expect(NEW_FEDERATION_TOPOLOGY.id).toBe(TOPOLOGY_V1.id);
    expect(populationOf(TOPOLOGY_V1)).toBe(2048);
    expect(populationOf(TOPOLOGY_V2)).toBe(4096);
    const comps = generateFederation(42);
    expect(comps).toHaveLength(2048);
    expect(comps.at(-1)!.id).toBe('c2047');
    expect(generateFederation(42, TOPOLOGY_V1)).toEqual(comps); // explicit v1 = default
    const { world, plan } = createWorld(42, comps, 'T');
    expect('topology' in world).toBe(false); // v1 worlds are stored exactly as before v0.9
    expect(plan.circuits).toHaveLength(128);
    expect(topologyOf(world)).toBe(TOPOLOGY_V1);
    expect(regionNamesOf(TOPOLOGY_V1)).toHaveLength(16);
    expect(regionNamesOf(TOPOLOGY_V2)).toHaveLength(32);
    expect(new Set(regionNamesOf(TOPOLOGY_V2)).size).toBe(32);
    expect(regionName(80)).toBe('Region 81');
    expect(new Set(regionNamesOf(TOPOLOGY_V3)).size).toBe(80);
    expect(regionNamesOf(TOPOLOGY_V3).every(n => !/^Region \d/.test(n))).toBe(true);
    expect(populationOf(TOPOLOGY_V3)).toBe(10240);
    expect(newFederationTopology({ mobile: false })).toBe(TOPOLOGY_V3);
  });

  it('save compatibility: a stored 2,048 world (no topology field) loads, advances and rolls over a season with 16 regions', async () => {
    const { svc, f } = await make();
    await svc.create(3, 2026);
    const w = svc.state!.world as WorldState;
    expect(w.topology).toBeUndefined();
    // reload as an existing save would be
    const again = (await make(f)).svc;
    await again.load();
    expect(again.topology().id).toBe('crown-topology-1');
    expect(again.state!.competitors.size).toBe(2048);
    await expect(again.create(3, 1)).rejects.toThrow();
    // a whole season through the pure driver on the loaded state: 16 regions before and after the rollover
    const st = again.state!;
    const ctx: Ctx = { world: structuredClone(st.world), plan: structuredClone(st.plan), competitors: new Map([...st.competitors].map(([k, v]) => [k, structuredClone(v)])), player: { rating: 1500, rd: 200, name: 'You' } };
    const rounds: RoundRecord[] = [];
    for (let r = 0; r < ROUNDS_PER_SEASON; r++) {
      const res = runRoundHeadless(ctx, rounds, 'T', () => 0.5);
      rounds.push(res.record);
      if (res.seasonEnd) expect(res.seasonEnd.standings).toHaveLength(128);
    }
    expect(ctx.world.season).toBe(2);
    expect(ctx.plan.circuits).toHaveLength(128);
    expect(new Set(ctx.plan.circuits.map(c => c.region)).size).toBe(16);
    expect('topology' in ctx.world).toBe(false);
  }, 120_000);

  it('crown-topology-2: 4,096 competitors in 32 regions, persisted with the world and kept across reloads and seasons', async () => {
    const { svc, f } = await make();
    await expect(svc.create(32, 7, TOPOLOGY_V2)).rejects.toThrow(/regions/);
    await expect(svc.create(16, 7)).rejects.toThrow(/regions/); // v1 has regions 0–15 only
    await svc.create(31, 7, TOPOLOGY_V2);
    expect(svc.state!.competitors.size).toBe(4096);
    expect(svc.state!.plan.circuits).toHaveLength(256);
    expect(svc.state!.world.topology).toEqual(TOPOLOGY_V2);
    expect(svc.state!.plan.circuits.find(c => c.members.includes(PLAYER_ID))!.region).toBe(31);
    const again = (await make(f)).svc;
    await again.load();
    expect(again.topology()).toEqual(TOPOLOGY_V2);
    // season rollover keeps 32 regions (pure driver, results drawn from the model)
    const ctx: Ctx = { world: structuredClone(again.state!.world), plan: makePlan(7, 1, [...again.state!.competitors.values()], again.state!.world.player, TOPOLOGY_V2), competitors: new Map([...again.state!.competitors].map(([k, v]) => [k, structuredClone(v)])), player: { rating: 1500, rd: 200, name: 'You' } };
    const rounds: RoundRecord[] = [];
    for (let r = 0; r < ROUNDS_PER_SEASON; r++) rounds.push(runRoundHeadless(ctx, rounds, 'T', () => 0.5).record);
    expect(ctx.world.season).toBe(2);
    expect(ctx.plan.circuits).toHaveLength(256);
    expect(Math.max(...ctx.plan.circuits.map(c => c.region))).toBe(31);
  }, 120_000);

  it('joinPlayer and plans work for any region of a larger topology', () => {
    const comps = generateFederation(5, TOPOLOGY_V2);
    const { world, plan } = createWorld(5, comps, 'T', TOPOLOGY_V2);
    const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 1500, rd: 200, name: 'You' } };
    joinPlayer(ctx, 20);
    expect(plan.circuits.find(c => c.region === 20 && c.division === 8)!.members).toContain(PLAYER_ID);
    expect(plan.circuits.every(c => c.members.length === 16)).toBe(true);
  });
});

describe('behaviour-preserving optimisations', () => {
  it('league order with head-to-head computed once per group equals the reference on random tied tables', () => {
    let seed = 99;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    for (let t = 0; t < 400; t++) {
      const n = 4 + Math.floor(rnd() * 13);
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const games: Game[] = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < 0.7) { const u = rnd(); games.push({ white: rnd() < 0.5 ? ids[i] : ids[j], black: '', result: u < 0.3 ? 1 : u < 0.75 ? 0.5 : u < 0.95 ? 0 : null }); games[games.length - 1].black = games[games.length - 1].white === ids[i] ? ids[j] : ids[i]; }
      const seeds = new Map(ids.map((id, i) => [id, i + 1]));
      const a = leagueOrder(standings(ids, games, seeds), games).map(r => r.id);
      const b = leagueOrderReference(standings(ids, games, seeds), games).map(r => r.id);
      expect(a).toEqual(b);
    }
  });

  it('commands other than the round advance never write to competitor records (they are shared, not copied)', async () => {
    const { svc } = await make();
    await svc.create(4, 31337);
    const deepFreeze = (o: unknown): void => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } };
    for (const c of svc.state!.competitors.values()) deepFreeze(c);
    // a representative set of commands: trading, forfeits, a featured game, Swiss registration, scheduled games
    const fx = svc.featuredFixtures().find(f => svc.marketFor(f.id)?.status === 'open');
    if (fx) await svc.trade(svc.marketFor(fx.id)!.id, 0, 2, 'buy');
    await svc.setFavorites(['c0001', 'c0002']);
    await svc.setWatchlist(['c0003']);
    await svc.registerChallenger(false).catch(() => undefined);
    const live = await svc.startSlate(2);
    const req = svc.scheduledRequest(live[0].id)!;
    const { inProcessEngines } = await import('../src/app/scheduler');
    const [eng] = await inProcessEngines(1, r => ({ ...r, profile: { ...r.profile, nodes: 120, depth: 3, selection: null } }));
    await svc.scheduledStep(live[0].id, req.ply, await eng.compute(req));
    await svc.resolveScheduledAbstract([live[1].id], 'test');
    if (fx) await svc.playFeatured(fx.id, 'background');
    for (const f of svc.playerFixtures()) await svc.forfeit(f.id);
    // the round advance copies the records before changing them: frozen originals are untouched
    const before = JSON.stringify(svc.state!.competitors.get('c0001'));
    await svc.advanceRound();
    expect(Object.isFrozen(svc.state!.competitors.get('c0001'))).toBe(false);
    expect(JSON.stringify(svc.state!.competitors.get('c0001'))).not.toBe(before); // rating period applied to the copy
  }, 300_000);
});
