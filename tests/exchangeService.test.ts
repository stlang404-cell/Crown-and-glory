/**
 * v0.10 Exchange through the real FederationService (fake IndexedDB): new markets (Decisive claim, over/under plies,
 * quarterfinal advancement), settlement and VOID, information suspension, close-position atomicity, watchlist
 * persistence, the trading API, paper-forecast snapshots in play, and the defects of docs/BUG_REGISTER.md #26–#32.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { lengthMarketId, suspensionOf } from '../src/app/markets';
import { playSelfplay } from '../src/engine/selfplay';
import { ROUNDS_PER_SEASON, CHAMPIONSHIP_ROUNDS, PLAYER_ID } from '../src/federation/model';
import { claimsOf, claimPrices, statesOf, revisionOf } from '../src/exchange/market';
import { MICRO } from '../src/exchange/ledger';
import { exchangeApi } from '../src/exchange/api';
import { lengthLine, pOver } from '../src/exchange/length';
import { advancementStates } from '../src/exchange/families';
import type { GameRecord } from '../src/games/types';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
async function make(f = new IDBFactory()) {
  const db = await CrownDB.open(f);
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
  svc.runSelfplay = async (req, onMove) => playSelfplay(req.initialFen, { ...req.white, profile: { ...req.white.profile, nodes: 150, depth: 3, selection: null } }, { ...req.black, profile: { ...req.black.profile, nodes: 150, depth: 3, selection: null } }, req.seed, req.maxPlies, m => onMove(m));
  const base = svc.computeMove;
  svc.computeMove = req => base({ ...req, profile: { ...req.profile, nodes: 150, depth: 3, selection: null } });
  return { svc, f };
}
async function playMine(svc: FederationService) {
  for (let f = svc.playerFixtures()[0]; f; f = svc.playerFixtures()[0]) {
    const g = await svc.playerGameFor(f.id, { rating: 1500, rd: 200 });
    await svc.recordPlayerGame({ ...g, result: g.humanColor === 'white' ? '0-1' : '1-0', status: 'finalized' } as GameRecord);
  }
}
const total = (svc: FederationService) => [...svc.state!.balances.values()].reduce((a, b) => a + b, 0);
const cash = (svc: FederationService) => svc.balance('player:cash');

describe('v0.10 match markets: Decisive claim and over/under plies', () => {
  it('lists both markets per featured match, settles them on the official record, and VOIDs on cancellation', async () => {
    const { svc } = await make();
    await svc.create(3, 777);
    const featured = svc.featuredFixtures().filter(f => svc.marketFor(f.id));
    expect(featured.length).toBeGreaterThan(0);
    for (const f of featured) {
      const m = svc.marketFor(f.id)!;
      expect(claimsOf(m).map(c => c.id)).toEqual(['s0', 's1', 's2', 'decisive']);
      const p = claimPrices(m);
      expect(p[3]).toBeCloseTo(1 - p[1], 12);
      const len = svc.state!.markets.get(lengthMarketId(f.id))!;
      expect(len.kind).toBe('length');
      expect(len.status).toBe('open');
      const w = svc.state!.competitors.get(f.white)!, b = svc.state!.competitors.get(f.black)!;
      const line = lengthLine(w, b);
      expect(len.ref!.line).toBe(line);
      expect(len.title).toContain(`${line}.5 plies`);
      expect(len.model![0]).toBeCloseTo(pOver(w, b, line), 2); // public ratings only
      expect(len.rules).toMatch(/official game record/);
    }
    const [a, bfx] = featured;
    // the player buys Decisive and Over on the first match, Under on the second
    await svc.trade(`mk:${a.id}`, 3, 20, 'buy');
    await svc.trade(lengthMarketId(a.id), 0, 30, 'buy');
    if (bfx) await svc.trade(lengthMarketId(bfx.id), 1, 10, 'buy');
    const before = cash(svc);
    const game = await svc.playFeatured(a.id, 'background');
    const mm = svc.marketFor(a.id)!, lm = svc.state!.markets.get(lengthMarketId(a.id))!;
    const line = Number(lm.ref!.line);
    expect(lm.status).toBe('settled');
    expect(lm.result).toBe(game.moves.length > line ? 0 : 1);
    const decisivePays = mm.status === 'settled' && game.result !== '1/2-1/2' ? 20 : mm.status === 'cancelled' ? Math.floor(20 * (2 / 3) * MICRO + 1e-6) / MICRO : 0;
    const overPays = game.moves.length > line ? 30 : 0;
    expect(cash(svc) - before).toBe(Math.round((decisivePays + overPays) * MICRO));
    // closure happened before the game existed: the length market was closed when the match started
    expect(lm.closedAt! <= game.createdAt).toBe(true);
    // a second settlement attempt (same fixture) is refused
    await expect(svc.playFeatured(a.id, 'background')).rejects.toThrow();
    // VOID: a federation cancellation pays ½ per share on the over/under market
    if (bfx) {
      const c0 = cash(svc);
      await svc.cancel(lengthMarketId(bfx.id));
      expect(svc.state!.markets.get(lengthMarketId(bfx.id))!.status).toBe('cancelled');
      expect(cash(svc) - c0).toBe(5 * MICRO);
    }
    expect(total(svc)).toBe(0);
  }, 120_000);
  it('in play: the over/under market closes when the live match starts; paper forecasts snapshot the LIVE model (bug #30)', async () => {
    const { svc } = await make();
    await svc.create(4, 4242);
    const fx = svc.featuredFixtures().find(x => svc.marketFor(x.id)?.status === 'open')!;
    await svc.startLive(fx.id);
    expect(svc.state!.markets.get(lengthMarketId(fx.id))!.status).toBe('closed');
    expect(svc.marketFor(fx.id)!.status).toBe('open');
    await expect(svc.trade(lengthMarketId(fx.id), 0, 1, 'buy')).rejects.toThrow(/closed/);
    for (let i = 0; i < 5; i++) await svc.liveStep(fx.id);
    await svc.forecast(`mk:${fx.id}`, [50, 20, 30]);
    const rec = svc.state!.extra.forecasts.find(x => x.marketId === `mk:${fx.id}`)!;
    const lg = svc.liveGame(fx.id)!;
    expect(rec.model).toEqual(lg.points[lg.points.length - 1].model);
    expect(rec.ply).toBe(5);
    const m = svc.marketFor(fx.id)!;
    expect(rec.model).not.toEqual([m.forecast.w, m.forecast.d, m.forecast.l]);
  }, 120_000);
});

describe('v0.10 trading features through the service and the API', () => {
  it('close position sells every claim atomically at the quoted revision; a failed commit changes nothing', async () => {
    const { svc, f } = await make();
    await svc.create(2, 99);
    const api = exchangeApi(svc);
    const id = `mk:${svc.featuredFixtures().find(x => svc.marketFor(x.id))!.id}`;
    const q = api.quote(id, 0, 12, 'buy');
    expect(q.ok && q.quote!.total === q.quote!.amount + q.quote!.fee).toBe(true);
    expect(q.after!.holdings[0].shares).toBe(12);
    expect(q.after!.holdings[0].basis).toBe(q.quote!.total);
    await api.buy(id, 0, 12, { revision: q.revision });
    await expect(api.buy(id, 0, 1, { revision: q.revision })).rejects.toThrow(/Stale quote/);
    await api.buy(id, 3, 7, { revision: api.status(id).revision });
    const v = api.position(id)!;
    expect(v.basisKnown).toBe(true);
    expect(v.realised! + v.unrealised!).toBe(v.exitValue + v.received - v.spent);
    expect(v.scenarios.map(s => s.label)).toEqual([...statesOf(svc.state!.markets.get(id)!), 'VOID (cancelled)']);
    // failed commit: nothing changes
    const snap = JSON.stringify([[...svc.state!.balances], svc.state!.positions.get(`${id}|player:cash`)]);
    const real = svc.db.commit.bind(svc.db);
    svc.db.commit = async () => { throw new Error('simulated crash'); };
    await expect(api.close(id, { revision: api.status(id).revision })).rejects.toThrow('simulated crash');
    expect(JSON.stringify([[...svc.state!.balances], svc.state!.positions.get(`${id}|player:cash`)])).toBe(snap);
    svc.db.commit = real;
    const fresh = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await fresh.load();
    expect(fresh.state!.positions.get(`${id}|player:cash`)!.shares).toEqual([12, 0, 0, 7]);
    // slippage guard on close
    await expect(api.close(id, { revision: api.status(id).revision, minTotal: v.exitValue + 1 })).rejects.toThrow(/less than your limit/);
    const net = await api.close(id, { revision: api.status(id).revision, minTotal: v.exitValue });
    expect(net).toBe(v.exitValue);
    const after = svc.state!.positions.get(`${id}|player:cash`)!;
    expect(after.shares).toEqual([0, 0, 0, 0]);
    expect(after.realised).toBe(after.received - after.spent);
    expect(after.realised).toBeLessThan(0); // the round trip lost the fees and spread
    await expect(api.close(id, { revision: api.status(id).revision })).rejects.toThrow(/no shares/);
    expect(api.pnl().realised).toBe(after.realised);
    expect(total(svc)).toBe(0);
  }, 120_000);
  it('the market watchlist is persisted and survives a reload', async () => {
    const { svc, f } = await make();
    await svc.create(1, 5);
    const ids = [...svc.state!.markets.keys()].slice(0, 3);
    for (const id of ids) await svc.setMarketWatch(id, true);
    await svc.setMarketWatch(ids[1], false);
    await expect(svc.setMarketWatch('nope', true)).rejects.toThrow();
    const fresh = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await fresh.load();
    expect(fresh.marketWatchlist()).toEqual([ids[0], ids[2]]);
  });
});

describe('v0.10 integrity fixes in the federation', () => {
  it('family markets are suspended while this round has recorded results they depend on, and reopen after the round (bug #28)', async () => {
    const { svc } = await make();
    await svc.create(0, 31337);
    const id = 'mk:season:1';
    expect(svc.suspension(id)).toBeNull();
    await svc.trade(id, 0, 2, 'buy');
    // the first featured game of the round records its result — and draws every tier-3 result of the round
    const fx = svc.featuredFixtures().find(x => x.result === null)!;
    await svc.playFeatured(fx.id, 'background');
    const m = svc.state!.markets.get(id)!;
    expect(m.status).toBe('open');
    expect(suspensionOf(svc.state!, m)?.code).toBe('results-pending');
    await expect(svc.trade(id, 0, 1, 'buy')).rejects.toThrow(/Suspended/);
    await expect(svc.closePosition(id)).rejects.toThrow(/Suspended/);
    await expect(svc.forecast(id, svc.state!.markets.get(id)!.model!)).rejects.toThrow(/Forecasts reopen/);
    expect(exchangeApi(svc).status(id)).toMatchObject({ tradable: false, suspended: true, label: 'Trading Suspended' });
    // match markets are never suspended by this rule
    const other = svc.featuredFixtures().find(x => x.result === null && svc.marketFor(x.id)?.status === 'open');
    if (other) expect(svc.suspension(`mk:${other.id}`)).toBeNull();
    await playMine(svc);
    await svc.advanceRound();
    expect(svc.suspension(id)).toBeNull();
    await svc.trade(id, 0, 1, 'buy');
  }, 120_000);
  it('entering the Open cannot trigger a cancellation the player profits from (bug #31)', async () => {
    const { svc } = await make();
    await svc.create(5, 2024);
    // put the player in an Open division (2–4) for this test
    svc.state!.world.player.division = 3;
    const id = 'mk:open-winner:1';
    const m = svc.state!.markets.get(id)!;
    const pr = claimPrices(m);
    const n = pr.length;
    // buy the longshots priced below the 1/n cancellation refund
    const cheap = pr.map((p, i) => [p, i] as const).filter(([p]) => p < 1 / n).sort((a, b) => a[0] - b[0]).slice(0, 6).map(x => x[1]);
    expect(cheap.length).toBeGreaterThan(0);
    for (const c of cheap) await svc.trade(id, c, 40, 'buy');
    const pos = svc.state!.positions.get(`${id}|player:cash`)!;
    const refund = Math.floor(pos.shares.reduce((a, x) => a + x / n, 0) * MICRO + 1e-6);
    // before the fix, registering paid `refund` for shares that cost `pos.spent`: record the would-be gain
    expect(refund - pos.spent).toBeGreaterThan(0);
    await expect(svc.registerChallenger(false)).rejects.toThrow(/sell your shares first/);
    await svc.closePosition(id);
    await svc.registerChallenger(false);
    expect(svc.state!.markets.get(id)!.status).toBe('cancelled');
  }, 120_000);
  it('the qualification market is not listed while the player plays in a Crown Division (bug #32)', async () => {
    const { svc } = await make();
    await svc.create(2, 11);
    expect(svc.state!.markets.has('mk:qual:1')).toBe(true);
    svc.state!.markets.delete('mk:qual:1');
    svc.state!.world.player.division = 1;
    expect(await svc.ensureSeasonMarkets()).toBe(0);
    expect(svc.state!.markets.has('mk:qual:1')).toBe(false);
  });
  it('a scheduled game of a closing round closes the family markets in the same commit (bug #29)', async () => {
    const { svc } = await make();
    await svc.create(0, 31337);
    for (let r = 1; r < 4; r++) { await playMine(svc); await svc.advanceRound(); }
    expect(svc.state!.world.round).toBe(4);
    // the Open champion market closes when round 4 starts; a scheduled game is such a start
    expect(svc.state!.markets.get('mk:open-winner:1')!.status).toBe('open');
    const started = await svc.startSlate(1);
    expect(started.length).toBe(1);
    expect(svc.state!.markets.get('mk:open-winner:1')!.status).toBe('closed');
  }, 300_000);
});

describe('v0.10 quarterfinal advancement market over a full season', () => {
  it('lists after the round of 16, closes when the quarterfinals start, settles on the four recorded winners; length markets settle every round', async () => {
    const { svc } = await make();
    await svc.create(0, 31337);
    let sawOpen = false;
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) {
      const round = svc.state!.world.round;
      await playMine(svc);
      // every listed over/under market of this round settles on its game record when the round advances
      const lens = svc.featuredFixtures().map(f => f.id).filter(id => svc.state!.markets.has(lengthMarketId(id)));
      await svc.advanceRound();
      for (const fid of lens) {
        const lm = svc.state!.markets.get(lengthMarketId(fid))!;
        const g = await svc.worldGame(`wg:${fid}`);
        expect(lm.status, fid).toBe('settled');
        expect(lm.result).toBe(g!.moves.length > Number(lm.ref!.line) ? 0 : 1);
      }
      expect(total(svc)).toBe(0);
      const adv = svc.state!.markets.get('mk:adv:1');
      if (round < CHAMPIONSHIP_ROUNDS[0]) expect(adv).toBeUndefined();
      if (round === CHAMPIONSHIP_ROUNDS[0]) {
        expect(adv?.status).toBe('open');
        sawOpen = true;
        expect(statesOf(adv!)).toHaveLength(16);
        expect(adv!.model!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
        expect(String(adv!.ref!.ids)).not.toContain(PLAYER_ID);
        await svc.trade('mk:adv:1', 0, 10, 'buy');
      }
      if (round === CHAMPIONSHIP_ROUNDS[1]) {
        expect(adv!.status).toBe('settled');
        const qf = svc.state!.plans.get('season:1')!.champ!.stages[1].matches;
        const winners = qf.map(x => x.winner!);
        const ids = String(adv!.ref!.ids).split(',');
        const pairs = [0, 1, 2, 3].map(k => [ids[2 * k], ids[2 * k + 1]] as [string, string]);
        expect(advancementStates(pairs)[adv!.result!].winners).toEqual(winners);
        const pos = svc.state!.positions.get('mk:adv:1|player:cash')!;
        const c0 = claimsOf(adv!)[0];
        expect(pos.received).toBe(c0.states.includes(adv!.result!) ? 10 * MICRO : 0);
      }
    }
    expect(sawOpen).toBe(true);
  }, 600_000);
});

describe('information policy of the new markets', () => {
  it('over/under and advancement models read public ratings only: changing hidden strength changes nothing', async () => {
    const { svc } = await make();
    await svc.create(0, 31337);
    const f = svc.featuredFixtures().find(x => svc.state!.markets.has(lengthMarketId(x.id)))!;
    const w = svc.state!.competitors.get(f.white)!, b = svc.state!.competitors.get(f.black)!;
    const p1 = pOver(w, b, 60);
    const p2 = pOver({ ...w, latent: w.latent + 900 } as typeof w, { ...b, latent: b.latent - 900 } as typeof b, 60);
    expect(p1).toBe(p2);
    expect(revisionOf(svc.state!.markets.get(lengthMarketId(f.id))!)).toMatch(/^\d+\.0$/);
  });
});
