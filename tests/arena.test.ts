/**
 * Sovereign Live Arena synchronisation (crown-arena-1): market revisions advance with every published move as well
 * as every trade; a quote taken before a move is rejected after it even if nobody traded; a duplicate step
 * request never publishes a second move; replay data (moves, price points with revisions) persists.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { revisionOf } from '../src/exchange/market';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();

describe('Live Arena synchronisation', () => {
  it('stale quotes and duplicate steps are rejected; revisions are recorded with every published move', async () => {
    const f = new IDBFactory();
    const svc = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    const base = svc.computeMove;
    const small = (req: Parameters<FederationService['computeMove']>[0]) => ({ ...req, profile: { ...req.profile, nodes: 200, depth: 3, selection: null } });
    svc.computeMove = req => base(small(req));
    await svc.create(6, 777);
    const fx = svc.featuredFixtures().find(x => svc.marketFor(x.id)?.status === 'open')!;
    await svc.startLive(fx.id);
    await svc.liveStep(fx.id, 0);
    const m1 = svc.marketFor(fx.id)!;
    const r1 = revisionOf(m1);
    expect(r1.endsWith('.1')).toBe(true);
    // a trade on the current revision executes
    await svc.trade(m1.id, 0, 5, 'buy', { expectRevision: r1 });
    const r2 = revisionOf(svc.marketFor(fx.id)!);
    expect(r2).not.toBe(r1);
    // the next move is published; a quote on r2 is now stale even if no NPC traded
    await svc.liveStep(fx.id, 1);
    const r3 = revisionOf(svc.marketFor(fx.id)!);
    expect(r3.split('.')[1]).toBe('2');
    await expect(svc.trade(m1.id, 0, 1, 'buy', { expectRevision: r2 })).rejects.toThrow(/Stale quote/);
    // duplicate step request (a second click / tab for the same ply) never publishes another move
    await expect(svc.liveStep(fx.id, 1)).rejects.toThrow(/Stale step/);
    expect(svc.liveGame(fx.id)!.moves).toHaveLength(2);
    // price points carry the revision at which each move's information was published
    const pts = svc.liveGame(fx.id)!.points;
    expect(pts.at(-1)!.revision).toBe(r3);
    // finish the match, then trading is refused and the replay data survives a reload
    let done = false;
    for (let i = 0; i < 400 && !done; i++) done = (await svc.liveStep(fx.id, svc.liveGame(fx.id)!.moves.length)).done;
    expect(done).toBe(true);
    await expect(svc.trade(m1.id, 0, 1, 'buy')).rejects.toThrow();
    const again = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    await again.load();
    const wg = await again.worldGame(`wg:${fx.id}`);
    expect(wg!.moves.length).toBe(svc.liveGame(fx.id)!.moves.length);
    expect(again.liveGame(fx.id)!.points.length).toBe(svc.liveGame(fx.id)!.points.length);
    expect(['settled', 'cancelled']).toContain(again.marketFor(fx.id)!.status);
    expect([...again.state!.balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
  }, 300_000);
});
