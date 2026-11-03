import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { playSelfplay } from '../src/engine/selfplay';
import { PLAYER_ID, ROUNDS_PER_SEASON } from '../src/federation/model';
import { rivalriesOf, featuredRivalries } from '../src/app/rivalries';
import { AI_CLUBS } from '../src/heraldry/clubs';
import type { GameRecord } from '../src/games/types';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
async function make(f = new IDBFactory(), rating = 1900) {
  const db = await CrownDB.open(f);
  const svc = new FederationService(db, async () => ({ rating, rd: 80 }), now);
  svc.runSelfplay = async (req, onMove) => playSelfplay(req.initialFen, { ...req.white, profile: { ...req.white.profile, nodes: 150, depth: 3, selection: null } }, { ...req.black, profile: { ...req.black.profile, nodes: 150, depth: 3, selection: null } }, req.seed, req.maxPlies, m => onMove(m));
  return { svc, f };
}
async function playMine(svc: FederationService, win = true) {
  for (let f = svc.playerFixtures()[0]; f; f = svc.playerFixtures()[0]) {
    const g = await svc.playerGameFor(f.id, { rating: 1900, rd: 80 });
    const res = win === (g.humanColor === 'white') ? '1-0' : '0-1';
    await svc.recordPlayerGame({ ...g, result: res, status: 'finalized' } as GameRecord);
  }
}

describe('heraldry & honours through the federation service', () => {
  it('featured rivals persist; titles come from real norms; ceremonies are unique; club ledgers conserve; identity persists', async () => {
    const { svc, f } = await make();
    await svc.create(4, 2468);
    const featured = svc.state!.world.featured!.map(x => x.id);
    expect(featured).toHaveLength(28);
    await svc.registerChallenger(false);
    await svc.buyAsset('club');
    await svc.setClubIdentity({ name: 'Obsidian Gambit Society', primary: 'sanguine', secondary: 'or', shape: 'tower', symbol: 'griffin', motto: 'Every square counts' });
    await expect(svc.setClubIdentity({ name: 'x', primary: 'or', secondary: 'or', shape: 'heater', symbol: 'rook', motto: '' })).rejects.toThrow();
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) {
      await playMine(svc, true);
      await svc.advanceRound();
      expect([...svc.state!.balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
    }
    const st = svc.state!;
    // player: perfect Challenger and league → at least one Squire norm and the Squire title, with a ceremony
    expect(st.world.player.norms!.length).toBeGreaterThanOrEqual(1);
    expect(st.world.player.fedTitle).toBeTruthy();
    const cer = st.extra.ceremonies ?? [];
    expect(cer.some(c => c.kind === 'fed-title')).toBe(true);
    expect(cer.filter(c => c.kind === 'championship')).toHaveLength(1);
    expect(new Set(cer.map(c => c.id)).size).toBe(cer.length);
    // competitors earned titles only from norms (every title holder has at least one norm)
    const holders = [...st.competitors.values()].filter(c => c.fedTitle);
    expect(holders.length).toBeGreaterThan(0);
    for (const c of holders) expect(c.norms!.length).toBeGreaterThan(0);
    // AI clubs: dues and operating journals, non-negative club accounts
    const journals = await svc.db.loadAll<{ id: string; lines: { account: string; amount: number }[] }>('journal');
    expect(journals.some(j => j.id === 'club-dues:1')).toBe(true);
    expect(journals.some(j => j.id === 'club-ops:1')).toBe(true);
    for (const k of AI_CLUBS) expect(svc.balance(`club:${k.id}`)).toBeGreaterThanOrEqual(0);
    // reload: featured, identity, norms, titles and ceremonies persist
    const svc2 = new FederationService(await CrownDB.open(f), async () => ({ rating: 1900, rd: 80 }), now);
    await svc2.load();
    expect(svc2.state!.world.featured!.map(x => x.id)).toEqual(featured);
    expect(svc2.clubIdentity()!.name).toBe('Obsidian Gambit Society');
    expect(svc2.state!.world.player.fedTitle).toBe(st.world.player.fedTitle);
    expect((svc2.state!.extra.ceremonies ?? []).length).toBe(cer.length);
    // rivalries are computed from recorded events
    const mine = rivalriesOf(st, PLAYER_ID);
    expect(mine.length).toBeGreaterThan(10);
    expect(mine[0].meetings).toBeGreaterThan(0);
    for (const r of mine) expect(r.intensity).toBeLessThanOrEqual(100);
    expect(featuredRivalries(st).length).toBeGreaterThan(0);
  }, 300_000);

  it('computing rivalries never changes results (two identical worlds, one queried every round)', async () => {
    const a = (await make()).svc, b = (await make()).svc;
    await a.create(2, 999); await b.create(2, 999);
    for (let i = 0; i < 6; i++) {
      await playMine(a, false); await playMine(b, false);
      rivalriesOf(a.state!, PLAYER_ID); featuredRivalries(a.state!);
      await a.advanceRound(); await b.advanceRound();
    }
    const results = (s: FederationService) => JSON.stringify([...s.state!.rounds.values()].sort((x, y) => x.id.localeCompare(y.id)).map(r => [r.abstract.map(x => x[3]), r.fixtures.map(x => x.result)]));
    expect(results(a)).toBe(results(b));
    expect([...a.state!.competitors.values()].map(c => c.rating).join()).toBe([...b.state!.competitors.values()].map(c => c.rating).join());
  }, 300_000);
});
