import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { closeMarket, liquidationValue, openMarket, settleMarket, trade, type Market, type Position } from '../src/exchange/market';
import { MICRO } from '../src/exchange/ledger';
import {
  DASH_LIMITS, featuredMarketForChart, grimoireSummary, liveMatches, netWorthSeries, openMarkets, portfolio, positionPnl, ratingSeries, recentRated, recentSettlements,
  tournamentEvents, vaultSummary, type DashFedState,
} from '../src/app/dashboard';
import { VAULT, earnable } from '../src/vault/catalog';
import type { UnlockRecord } from '../src/vault/store';
import { GRIMOIRE_INDEX, indexChapters } from '../src/academy/grimoire';
import type { RatingEvent } from '../src/ratings/ledger';
import type { Fixture } from '../src/federation/model';
import { CHAMP_POOL, OPEN_POOL } from '../src/economy/economy';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';

const AT = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
const mk = (id: string, i = 0): Market => openMarket({ id, sandbox: false, fixtureId: id.replace(/^mk:/, ''), title: `Match ${id}`, white: 'c1', black: 'c2', season: 1, round: 1, b: 120, forecast: { w: 0.4, d: 0.2, l: 0.4, source: 'test' }, at: AT(i) }).market;

function emptyState(over: Partial<DashFedState> = {}): DashFedState {
  return {
    world: { season: 1, round: 1 }, plan: { swiss: [], champ: null, club: null },
    competitors: new Map([['c1', { name: 'Alda Crane', rating: 1612, rd: 60 }], ['c2', { name: 'Bram Holt', rating: 1488, rd: 70 }]]),
    markets: new Map(), positions: new Map(), balances: new Map([['player:cash', 1000 * MICRO]]), finance: { points: [] }, liveGames: new Map(), ...over,
  };
}
function withTrades() {
  let a = mk('mk:a', 1), b = mk('mk:b', 2);
  const t1 = trade(a, null, 'player:cash', 0, 10, 'buy', AT(3), 1); a = t1.market;
  const t2 = trade(a, null, 'npc:x', 2, 30, 'buy', AT(4), 2); a = t2.market; // moves the market against the player
  const t3 = trade(b, null, 'npc:x', 1, 5, 'buy', AT(5), 1); b = t3.market;
  return { a, b, mine: t1.position, npc: t2.position };
}

describe('dashboard selectors', () => {
  it('empty state: no federation data gives empty lists, not invented numbers', () => {
    const st = emptyState();
    expect(portfolio(st)).toEqual({ cash: 1000 * MICRO, items: [], count: 0, value: 0, pnl: 0 });
    expect(openMarkets(st)).toEqual([]);
    expect(recentSettlements(st)).toEqual([]);
    expect(liveMatches(st, [], () => false)).toEqual([]);
    expect(featuredMarketForChart(st, [])).toBeNull();
    expect(netWorthSeries(null)).toEqual([]);
    expect(ratingSeries([])).toEqual([]);
    expect(recentRated([])).toEqual([]);
    const v = vaultSummary(VAULT, new Map(), new Map());
    expect(v.earned).toBe(0); expect(v.latest).toBeNull(); expect(v.total).toBe(VAULT.filter(earnable).length);
    const g = grimoireSummary({ attempts: [], completions: new Map(), read: new Set(), plan: null }, AT(0));
    expect(g).toMatchObject({ complete: 0, due: 0, started: false, total: indexChapters(GRIMOIRE_INDEX).length });
    expect(g.next).not.toBeNull();
  });

  it('position P&L equals sell-now value plus received minus spent, and sums over open positions', () => {
    const { a, b, mine } = withTrades();
    const st = emptyState({ markets: new Map([[a.id, a], [b.id, b]]), positions: new Map([[mine.id, mine]]) });
    const pf = portfolio(st);
    expect(pf.count).toBe(1);
    const lv = liquidationValue(a, mine);
    expect(pf.items[0]).toMatchObject({ marketId: 'mk:a', shares: 10, value: lv, pnl: lv + mine.received - mine.spent });
    expect(pf.items[0].pnl).toBeLessThan(0); // price fell after the NPC bought Black, and fees are paid
    expect(pf.items[0].label).toBe('10 White wins');
    expect(pf.value).toBe(lv); expect(pf.pnl).toBe(pf.items[0].pnl);
    expect(positionPnl(a, mine)).toEqual({ value: lv, pnl: lv + mine.received - mine.spent });
    // other holders and sandbox markets are never the player's
    expect(portfolio(emptyState({ markets: new Map([[a.id, a]]), positions: new Map([['x', { ...mine, holder: 'npc:x' } as Position]]) })).count).toBe(0);
  });

  it('open markets: most recently traded first, leading claim and its move since the previous trade', () => {
    const { a, b } = withTrades();
    const fresh = mk('mk:c', 0);
    const ms = openMarkets(emptyState({ markets: new Map([[a.id, a], [b.id, b], [fresh.id, fresh]]) }));
    expect(ms.map(m => m.id)).toEqual(['mk:b', 'mk:a', 'mk:c']);
    expect(ms[0].leader.label).toBe('Draw');
    expect(ms[0].move).toBeGreaterThan(0);
    expect(ms[2].move).toBeNull(); expect(ms[2].trades).toBe(0);
    const many = new Map(Array.from({ length: 12 }, (_, i) => { const m = mk(`mk:${i}`, i); return [m.id, m] as const; }));
    expect(openMarkets(emptyState({ markets: many })).length).toBe(DASH_LIMITS.markets);
  });

  it('settlements report realized P&L; settled positions leave the open portfolio', () => {
    const { a, mine, npc } = withTrades();
    const closed = closeMarket(a, AT(6));
    const s = settleMarket(closed, [mine, npc], 0, AT(7), 10_000 * MICRO, null);
    const myAfter = s.positions.find(p => p.holder === 'player:cash')!;
    const st = emptyState({ markets: new Map([[a.id, s.market]]), positions: new Map([[myAfter.id, myAfter]]) });
    expect(portfolio(st).count).toBe(0);
    const r = recentSettlements(st);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ marketId: 'mk:a', status: 'settled', outcome: 'White wins', pnl: myAfter.received - myAfter.spent });
    expect(r[0].pnl).toBeGreaterThan(0); // 10 shares paid $1 each
  });

  it('rating series and recent results come from rating events only', () => {
    const ev = (seq: number, score: number, before: number, after: number, pool: 'rapid' | 'blitz' = 'rapid'): RatingEvent => ({
      id: `r${seq}${pool}`, schemaVersion: 1, model: 'm', policy: 'p', pool, sequence: seq, gameId: `g${seq}${pool}`, at: AT(seq + (pool === 'blitz' ? 30 : 0)),
      opponent: { id: 'o', name: 'Mira Vell', rating: 1200, rd: 50, calibrationId: 'c' }, score, expected: 0.5,
      before: { rating: before, rd: 300, sigma: 0.06 }, after: { rating: after, rd: 280, sigma: 0.06 }, delta: after - before,
      provisionalBefore: true, provisionalAfter: true, gamesBefore: seq - 1, rankBefore: 'a', rankAfter: 'a', explanation: { v: 0, delta: 0, g: 0, tau: 0.5, iterations: 1 },
    } as unknown as RatingEvent);
    const events = [ev(2, 0, 1580, 1540), ev(1, 1, 1500, 1580), ev(1, 0.5, 1500, 1500, 'blitz')];
    const s = ratingSeries(events, 'rapid');
    expect(s.map(p => p.rating)).toEqual([1500, 1580, 1540]);
    expect(s[0].label).toBe('Initial rating');
    const r = recentRated(events);
    expect(r.map(x => x.gameId)).toEqual(['g1blitz', 'g2rapid', 'g1rapid']);
    expect(r[1]).toMatchObject({ score: 0, delta: -40, after: 1540 });
  });

  it('vault summary: latest unlock and the closest locked, non-secret collectible', () => {
    const [d1, d2] = VAULT.filter(d => earnable(d) && !d.secret);
    const owned = new Map<string, UnlockRecord>([[d1.id, { id: d1.id, at: AT(5), earnedAt: AT(5), evidence: '', backfill: false, catalog: 'x' }]]);
    const results = new Map([[d2.id, { earned: false, progress: { have: 3, need: 4 } }]]);
    const v = vaultSummary(VAULT, owned, results);
    expect(v.earned).toBe(1);
    expect(v.latest).toMatchObject({ id: d1.id, name: d1.name });
    expect(v.next).toMatchObject({ id: d2.id, have: 3, need: 4 });
  });

  it('with a founded federation: featured matches, markets and tournaments read real state', async () => {
    const db = await CrownDB.open(new IDBFactory());
    let clock = 0;
    const fed = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString());
    await fed.create(2, 777);
    const st = fed.state!;
    const featured: Fixture[] = fed.featuredFixtures();
    const ms = liveMatches(st, featured, id => fed.isLive(id));
    expect(ms.length).toBe(Math.min(featured.length, DASH_LIMITS.matches));
    for (const m of ms) {
      expect(m.status).toBe('upcoming');
      expect(m.white.name).toBe(st.competitors.get(m.white.id)!.name);
      expect(m.market?.status).toBe('open');
      expect(m.market!.prices.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
    const ev = tournamentEvents(st, []);
    expect(ev.find(e => e.id === 'open')).toMatchObject({ status: 'upcoming', prize: OPEN_POOL, leaders: [] });
    expect(ev.find(e => e.id === 'champ')).toMatchObject({ status: 'upcoming', prize: CHAMP_POOL });
    expect(openMarkets(st).length).toBeGreaterThan(0);
    expect(portfolio(st).cash).toBe(1000 * MICRO);
    const chart = featuredMarketForChart(st, featured)!;
    const most = Math.max(...featured.map(f => fed.marketFor(f.id)?.history.length ?? 0));
    expect(chart.points.length).toBe(most);
    expect(featured.some(f => `mk:${f.id}` === chart.market.id)).toBe(true);
  });
});
