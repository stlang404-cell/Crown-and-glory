import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { playSelfplay } from '../src/engine/selfplay';
import { PLAYER_ID, ROUNDS_PER_SEASON } from '../src/federation/model';
import { MICRO } from '../src/exchange/ledger';
import { exportBundle, importBundle } from '../src/storage/backup';
import { wdl } from '../src/federation/resultModel';
import type { GameRecord } from '../src/games/types';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();

async function make(f = new IDBFactory()) {
  const db = await CrownDB.open(f);
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
  // fast, deterministic featured games for tests (tiny node budgets)
  svc.runSelfplay = async (req, onMove) => playSelfplay(req.initialFen, { ...req.white, profile: { ...req.white.profile, nodes: 150, depth: 3, selection: null } }, { ...req.black, profile: { ...req.black.profile, nodes: 150, depth: 3, selection: null } }, req.seed, req.maxPlies, m => onMove(m));
  return { db, svc, f };
}
const total = (svc: FederationService) => [...svc.state!.balances.values()].reduce((a, b) => a + b, 0);
const nonNegative = (svc: FederationService) => [...svc.state!.balances].every(([a, v]) => a === 'mint' || v >= 0);

async function playMine(svc: FederationService, outcomeForPlayer = 1) {
  for (const f of svc.playerFixtures()) {
    const g = await svc.playerGameFor(f.id, { rating: 1500, rd: 200 });
    const white = g.humanColor === 'white';
    const res = outcomeForPlayer === 0.5 ? '1/2-1/2' : (outcomeForPlayer === 1) === white ? '1-0' : '0-1';
    await svc.recordPlayerGame({ ...g, result: res, status: 'finalized' } as GameRecord);
  }
}

describe('federation service', () => {
  it('creates a persistent federation with a funded, conserved economy and open markets', async () => {
    const { svc, db, f } = await make();
    await svc.create(3, 1234);
    expect(svc.state!.competitors.size).toBe(2048);
    expect(svc.balance('player:cash')).toBe(1000 * MICRO);
    expect(total(svc)).toBe(0);
    expect(nonNegative(svc)).toBe(true);
    const featured = svc.featuredFixtures();
    expect(featured.length).toBeGreaterThan(0);
    for (const fx of featured) {
      const m = svc.marketFor(fx.id)!;
      expect(m.status).toBe('open');
      expect(fx.result).toBeNull();
      expect(m.white).not.toBe(PLAYER_ID);
    }
    // persisted: a second service instance loads the same world
    const svc2 = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await svc2.load();
    expect(svc2.state!.world.seed).toBe(1234);
    expect(svc2.state!.competitors.get('c0005')!.name).toBe(svc.state!.competitors.get('c0005')!.name);
    expect(svc2.balance('player:cash')).toBe(1000 * MICRO);
    db.close();
  });

  it('player fixture → rated game record against the competitor; result recorded once', async () => {
    const { svc } = await make();
    await svc.create(0, 77);
    const [fx] = svc.playerFixtures();
    const g = await svc.playerGameFor(fx.id, { rating: 1500, rd: 200 });
    expect(g.rated).toBe(true);
    expect(g.context.kind).toBe('federation');
    const opp = g.humanColor === 'white' ? g.black : g.white;
    expect(opp.engine?.profile).toBeTruthy();
    await svc.recordPlayerGame({ ...g, result: g.humanColor === 'white' ? '1-0' : '0-1', status: 'finalized' } as GameRecord);
    await svc.recordPlayerGame({ ...g, result: g.humanColor === 'white' ? '0-1' : '1-0', status: 'finalized' } as GameRecord); // duplicate/contradicting retry ignored
    const f2 = svc.currentRound()!.fixtures.find(x => x.id === fx.id)!;
    expect(f2.white === PLAYER_ID ? f2.result : 1 - f2.result!).toBe(1);
    expect(svc.balance('player:cash')).toBe(1050 * MICRO); // first federation win sponsor milestone, paid once
  });

  it('trading, market closure before the game exists, settlement and conservation', async () => {
    const { svc } = await make();
    await svc.create(1, 99);
    const fx = svc.featuredFixtures()[0];
    const m = svc.marketFor(fx.id)!;
    await svc.trade(m.id, 0, 10, 'buy');
    const pos = svc.state!.positions.get(`${m.id}|player:cash`)!;
    expect(pos.shares[0]).toBe(10);
    expect(svc.balance('player:cash')).toBeLessThan(1000 * MICRO);
    // the market must already be closed when the engine game starts
    const orig = svc.runSelfplay;
    let statusAtStart = '';
    svc.runSelfplay = async (req, onMove) => { statusAtStart = (await svc.db.loadAll<{ id: string; status: string }>('markets')).find(x => x.id === m.id)!.status; return orig(req, onMove); };
    const cashBefore = svc.balance('player:cash');
    const game = await svc.playFeatured(fx.id, 'watched-live');
    expect(statusAtStart).toBe('closed');
    await expect(svc.trade(m.id, 0, 1, 'buy')).rejects.toThrow();
    const settled = svc.marketFor(fx.id)!;
    expect(settled.status).toBe('settled');
    const outcome = game.result === '1-0' ? 0 : game.result === '1/2-1/2' ? 1 : 2;
    expect(settled.result).toBe(outcome);
    expect(svc.balance('player:cash') - cashBefore).toBe(outcome === 0 ? 10 * MICRO : 0);
    expect(total(svc)).toBe(0);
    expect(nonNegative(svc)).toBe(true);
    // every move of the stored game is legal (playSelfplay verifies legality move by move); replayable
    expect(game.moves.length).toBeGreaterThan(0);
  }, 60_000);

  it('a full season: prizes from escrow, sponsor milestones once, new season issuance, conservation throughout', async () => {
    const { svc } = await make();
    await svc.create(2, 4242);
    const seenTreasuryMint: number[] = [];
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) {
      await playMine(svc, 1);
      await svc.advanceRound();
      expect(total(svc)).toBe(0);
      expect(nonNegative(svc)).toBe(true);
      seenTreasuryMint.push(svc.balance('mint'));
    }
    expect(svc.state!.world.season).toBe(2);
    // the player won every league game: title, promotion and their sponsor milestones
    expect(svc.state!.world.player.division).toBe(7);
    expect(svc.state!.world.player.titles.some(t => t.title.includes('Open Division champion'))).toBe(true);
    expect(svc.state!.extra.sponsorsPaid).toEqual(expect.arrayContaining(['1:league-title', '1:promotion']));
    const journals = await svc.db.loadAll<{ id: string }>('journal');
    expect(journals.some(j => j.id === 'mint:season:2')).toBe(true);
    // competitor expenses leave circulation into the sink; lifetime earnings are kept separately
    expect(journals.some(j => j.id === 'comp-expenses:1')).toBe(true);
    expect(svc.balance('sink')).toBeGreaterThan(0);
    const earner = [...svc.state!.competitors.values()].find(c => c.titles.some(t => t.season === 1))!;
    expect(earner.earnings).toBeGreaterThan(svc.balance(`comp:${earner.id}`));
    expect(journals.filter(j => j.id.startsWith('prize-pay:1:league:')).length).toBe(128);
    // currency is only created by explicit mint entries
    const mintLines = journals.flatMap(j => (j as unknown as { lines: { account: string; amount: number }[] }).lines.filter(l => l.account === 'mint').map(() => j.id));
    expect(mintLines.every(id => id.startsWith('mint:') || id === 'grant:player-start')).toBe(true);
  }, 240_000);

  it('stale or duplicate commands are rejected; a failed commit leaves state and storage unchanged', async () => {
    const { svc, f } = await make();
    await svc.create(4, 5);
    const other = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await other.load();
    await playMine(svc, 0.5);
    await playMine(other, 0.5).catch(() => {}); // other tab: stale view
    await svc.advanceRound();
    await expect(other.advanceRound()).rejects.toThrow(/stale|World changed|fixtures/);
    // crash: the next commit fails
    const before = JSON.stringify([svc.state!.world, [...svc.state!.balances]]);
    const realCommit = svc.db.commit.bind(svc.db);
    svc.db.commit = async () => { throw new Error('simulated crash'); };
    await playMine(svc, 1).catch(() => {});
    await expect(svc.buyAsset('brass-clock')).rejects.toThrow('simulated crash');
    expect(JSON.stringify([svc.state!.world, [...svc.state!.balances]])).toBe(before);
    svc.db.commit = realCommit;
    const fresh = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await fresh.load();
    expect(fresh.state!.assets.size).toBe(0);
    await svc.buyAsset('brass-clock');
    expect(svc.state!.assets.has('brass-clock')).toBe(true);
  }, 120_000);

  it('assets: purchase, book value in net worth, sale refunds, upkeep suspension without debt', async () => {
    const { svc } = await make();
    await svc.create(6, 8);
    await svc.buyAsset('club');
    await svc.buyAsset('analyst');
    let fin = svc.finance();
    expect(fin.cash).toBe(200 * MICRO);
    expect(fin.assets).toBe(450 * MICRO);
    expect(fin.netWorth).toBe(fin.cash + fin.assets + fin.positions);
    await expect(svc.buyAsset('club')).rejects.toThrow(/Already owned/);
    await svc.sellAsset('analyst');
    fin = svc.finance();
    expect(fin.cash).toBe(350 * MICRO);
    expect(total(svc)).toBe(0);
  });

  it('backup export/import of an active season restores an identical world and ledger', async () => {
    const { svc, db } = await make();
    await svc.create(7, 31);
    await playMine(svc, 1);
    await svc.advanceRound();
    const bundle = JSON.parse(JSON.stringify(await exportBundle(db, 'test')));
    const { db: db2, svc: svc2 } = await make(new IDBFactory());
    await importBundle(db2, bundle);
    await svc2.load();
    expect(svc2.state!.world.round).toBe(svc.state!.world.round);
    expect([...svc2.state!.balances].sort().join()).toBe([...svc.state!.balances].sort().join());
    expect(svc2.state!.competitors.size).toBe(2048);
    // a tampered ledger is rejected
    const bad = structuredClone(bundle);
    (bad.payload.federation.accounts as { account: string; balance: number }[]).find(a => a.account === 'player:cash')!.balance += 1;
    const { sha256Hex } = await import('../src/storage/checksum');
    bad.payloadSha256 = await sha256Hex(JSON.stringify(bad.payload));
    const { db: db3 } = await make(new IDBFactory());
    await expect(importBundle(db3, bad)).rejects.toThrow(/does not match/);
  }, 60_000);

  it('no leakage: market forecasts are the public-rating model only, never the hidden strength', async () => {
    const { svc } = await make();
    await svc.create(5, 2024);
    for (const fx of svc.featuredFixtures()) {
      const m = svc.marketFor(fx.id)!;
      const w = svc.state!.competitors.get(fx.white)!, b = svc.state!.competitors.get(fx.black)!;
      const pub = wdl(w.rating, b.rating), hidden = wdl(w.latent, b.latent);
      expect(m.forecast.w).toBeCloseTo(pub.w, 12);
      expect(m.forecast.l).toBeCloseTo(pub.l, 12);
      expect(Math.abs(hidden.w - pub.w)).toBeGreaterThan(0); // they differ, and the market used the public one
      expect(fx.result).toBeNull(); // no result exists while the market is open
      expect(await svc.worldGame(`wg:${fx.id}`)).toBeUndefined();
    }
  });

  it('Training Hall: sparring is an unrated casual game vs the fixture opponent profile, never a federation result', async () => {
    const { svc } = await make();
    await svc.create(2, 77);
    const [fx] = svc.playerFixtures();
    await expect(svc.sparringGameFor(fx.id, 'white')).rejects.toThrow(/Training Hall/);
    await svc.buyAsset('training');
    const g = await svc.sparringGameFor(fx.id, 'white');
    expect(g.rated).toBe(false);
    expect(g.context.kind).toBe('quick-match');
    const real = await svc.playerGameFor(fx.id, { rating: 1500, rd: 200 });
    const opp = (x: typeof g) => (x.humanColor === 'white' ? x.black : x.white).engine!.profile;
    expect(opp(g)).toEqual(opp(real));
    await svc.recordPlayerGame({ ...g, result: '1-0', status: 'finalized' } as typeof g); // ignored: not a federation game
    expect(svc.currentRound()!.fixtures.find(f => f.id === fx.id)!.result).toBeNull();
  });
});
