/**
 * Grand Exchange families through the real FederationService over a full season: listing, information
 * timing (closure before the closing round's first game), settlement from recorded results, conservation.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { playSelfplay } from '../src/engine/selfplay';
import { PLAYER_ID, ROUNDS_PER_SEASON, SWISS_ROUNDS, LEAGUE_ROUNDS } from '../src/federation/model';
import { claimsOf, statesOf } from '../src/exchange/market';
import { koMatchProb, bracketChampionModel, bracketStates, bracketModel } from '../src/exchange/families';
import type { GameRecord } from '../src/games/types';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
async function make() {
  const db = await CrownDB.open(new IDBFactory());
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
  svc.runSelfplay = async (req, onMove) => playSelfplay(req.initialFen, { ...req.white, profile: { ...req.white.profile, nodes: 150, depth: 3, selection: null } }, { ...req.black, profile: { ...req.black.profile, nodes: 150, depth: 3, selection: null } }, req.seed, req.maxPlies, m => onMove(m));
  return svc;
}
async function playMine(svc: FederationService) {
  for (let f = svc.playerFixtures()[0]; f; f = svc.playerFixtures()[0]) {
    const g = await svc.playerGameFor(f.id, { rating: 1500, rd: 200 });
    await svc.recordPlayerGame({ ...g, result: g.humanColor === 'white' ? '0-1' : '1-0', status: 'finalized' } as GameRecord);
  }
}
const total = (svc: FederationService) => [...svc.state!.balances.values()].reduce((a, b) => a + b, 0);

describe('market family models', () => {
  it('knockout probabilities are coherent', () => {
    const r = koMatchProb(1800, 1800, 1, 2, false);
    expect(r.a).toBeGreaterThan(0.5); // equal ratings: the higher seed wins the final tiebreak
    const f = koMatchProb(1800, 1800, 1, 2, true);
    expect(2 * f.a + f.joint).toBeCloseTo(1, 12);
    const first = Array.from({ length: 8 }, (_, i) => ({ a: `p${2 * i}`, b: `p${2 * i + 1}`, seedA: 2 * i + 1, seedB: 2 * i + 2 }));
    const m = bracketChampionModel(first, id => 2000 - Number(id.slice(1)) * 20, id => Number(id.slice(1)) + 1);
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(m.get('p0')!).toBeGreaterThan(m.get('p15')!);
    const st = bracketStates(['a', 'b', 'c', 'd']);
    expect(bracketModel(['a', 'b', 'c', 'd'], st, () => 1800, x => x.charCodeAt(0)).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe('Grand Exchange families over a season', () => {
  it('lists, closes on time, settles from recorded results and conserves money', async () => {
    const svc = await make();
    await svc.create(0, 31337);
    const S = 1;
    const ids = ['mk:open-winner:1', 'mk:promo:1', 'mk:qual:1', 'mk:season:1'];
    for (const id of ids) {
      const m = svc.state!.markets.get(id)!;
      expect(m, id).toBeTruthy();
      expect(m.status).toBe('open');
      expect(m.rules).toBeTruthy();
      expect(m.model!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
      // never lists an event involving the player
      expect(String(m.ref!.ids ?? m.ref!.subject)).not.toContain(PLAYER_ID);
    }
    // the player buys into the open winner market and the promotion market
    await svc.trade('mk:open-winner:1', 0, 5, 'buy');
    await svc.trade('mk:promo:1', 0, 5, 'buy');
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) {
      const round = svc.state!.world.round;
      await playMine(svc);
      await svc.advanceRound();
      const st = svc.state!;
      expect(total(svc)).toBe(0);
      for (const [a, v] of st.balances) if (a !== 'mint') expect(v, a).toBeGreaterThanOrEqual(0);
      const ow = st.markets.get('mk:open-winner:1')!;
      if (round >= SWISS_ROUNDS[0]) expect(ow.status).not.toBe('open');
      if (round === SWISS_ROUNDS[SWISS_ROUNDS.length - 1]) expect(ow.status).toBe('settled');
      if (round === LEAGUE_ROUNDS) {
        expect(st.markets.get('mk:qual:1')!.status).toBe('settled');
        expect(st.markets.get('mk:season:1')!.status).toBe('settled');
        expect(st.markets.get('mk:champ:1')!.status).toBe('open'); // listed when the bracket is drawn
      }
      if (round === 17) expect(st.markets.get('mk:bracket:1')?.status).toBe('open');
    }
    const st = svc.state!;
    expect(st.world.season).toBe(2);
    for (const id of [...ids, 'mk:champ:1', 'mk:bracket:1']) expect(st.markets.get(id)!.status, id).toBe('settled');
    // the bracket market settled on a path consistent with the champion market
    const champ = st.markets.get('mk:champ:1')!, bracket = st.markets.get('mk:bracket:1')!;
    const champs = statesOf(champ).filter((_, i) => champ.payout![i] > 0);
    const claims = claimsOf(bracket).filter(c => c.id.startsWith('champ:'));
    const winners = claims.filter(c => c.states.some(s => bracket.payout![s] > 0)).map(c => c.label.replace(' wins the Championship', ''));
    expect(winners.sort()).toEqual(champs.sort());
    // season 2 families are listed for the new season
    expect(st.markets.get(`mk:open-winner:${S + 1}`)?.status).toBe('open');
  }, 300_000);
});

describe('live in-play trading', () => {
  it('trading windows between published moves, NPC reaction on public evaluation, settlement, resume after reload', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
    const small = (req: Parameters<FederationService['computeMove']>[0]) => ({ ...req, profile: { ...req.profile, nodes: 200, depth: 3, selection: null } });
    const base = svc.computeMove;
    svc.computeMove = req => base(small(req));
    await svc.create(4, 4242);
    const fx = svc.featuredFixtures().find(x => svc.marketFor(x.id)?.status === 'open')!;
    const m0 = svc.marketFor(fx.id)!;
    await svc.startLive(fx.id);
    expect(svc.marketFor(fx.id)!.status).toBe('open');
    expect(fx.result).toBeNull();
    for (let i = 0; i < 6; i++) await svc.liveStep(fx.id);
    const lg = svc.liveGame(fx.id)!;
    expect(lg.moves).toHaveLength(6);
    expect(lg.points.length).toBeGreaterThan(1);
    for (const p of lg.points) expect(p.model.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    // a trade inside a window, with a stale-quote guard
    const v = svc.marketFor(fx.id)!.history.length;
    await svc.trade(m0.id, 0, 8, 'buy', { expectVersion: v });
    await expect(svc.trade(m0.id, 0, 1, 'buy', { expectVersion: v })).rejects.toThrow(/Prices changed/);
    const v2 = svc.marketFor(fx.id)!.history.length;
    await svc.trade(m0.id, 0, 3, 'sell', { expectVersion: v2 });
    // reload: a second instance resumes the committed timeline
    const svc2 = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    svc2.computeMove = req => base(small(req));
    await svc2.load();
    expect(svc2.liveGame(fx.id)!.moves).toHaveLength(6);
    let done = false, game;
    for (let i = 0; i < 400 && !done; i++) { const r = await svc2.liveStep(fx.id); done = r.done; game = r.game; }
    expect(done).toBe(true);
    const m = svc2.marketFor(fx.id)!;
    expect(['settled', 'cancelled']).toContain(m.status);
    expect(game!.moves.length).toBe(svc2.liveGame(fx.id)!.moves.length);
    expect(svc2.state!.rounds.get('1:1')!.fixtures.find(x => x.id === fx.id)!.result).not.toBeNull();
    await expect(svc2.liveStep(fx.id)).rejects.toThrow(/No live game/);
    await expect(svc2.trade(m0.id, 0, 1, 'buy')).rejects.toThrow();
    expect([...svc2.state!.balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
    for (const [a, val] of svc2.state!.balances) if (a !== 'mint') expect(val).toBeGreaterThanOrEqual(0);
  }, 300_000);
});
