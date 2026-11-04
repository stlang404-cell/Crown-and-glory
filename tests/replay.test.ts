/**
 * v0.10 Replay & Analysis Center (src/app/replay.ts): recorded prices synchronised to the replay ply (never invented),
 * the player's trades, portfolio value and settlement; the sandbox never mutates the saved game; library filters;
 * turning points.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { claimPrices, closeMarket, openMarket, settleMarket, trade, type Market, type Position as MarketPosition } from '../src/exchange/market';
import type { Journal } from '../src/exchange/ledger';
import { MICRO } from '../src/exchange/ledger';
import {
  buildMarketTimeline, createSandbox, federationEntry, filterReplays, marketAtPly, matchEvents, personalEntry, sandboxFen, sandboxHistory,
  sandboxLegal, sandboxMove, sandboxUndo, turningPoints, upsetGapOf, type RecordedPoint, type ReplayEntry,
} from '../src/app/replay';
import { Position } from '../src/rules/position';
import { moveToCcn } from '../src/rules/notation';
import type { GameRecord } from '../src/games/types';

const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const rev = (m: Market, plies: number) => `${m.history.length}.${plies}`;

/** A market traded the way FederationService does it: pre-game trades, then per move NPC reactions + a point. */
function recordedGame() {
  let { market: m } = openMarket({ id: 'mk:f1', sandbox: false, fixtureId: 'f1', title: 'A–B', white: 'a', black: 'b', season: 1, round: 2, b: 120, forecast: { w: 0.4, d: 0.2, l: 0.4, source: 't' }, at: '2026-01-01T00:00:00.000Z' });
  const journals: Journal[] = [];
  let pos: MarketPosition | null = null;
  const points: RecordedPoint[] = [];
  const t = (holder: string, o: number, n: number, side: 'buy' | 'sell', at: string) => {
    const r = trade(m, holder === 'player:cash' ? pos : null, holder, o, n, side, at, m.history.length);
    m = r.market;
    if (holder === 'player:cash') { pos = r.position; journals.push(r.journal); }
  };
  t('npc:1', 0, 20, 'buy', '2026-01-01T00:00:01.000Z');                     // index 1: before the game
  points.push({ ply: 0, prices: claimPrices(m), model: [0.4, 0.2, 0.4], at: '2026-01-01T00:00:02.000Z' }); // startLive: no revision
  t('player:cash', 2, 10, 'buy', '2026-01-01T00:00:03.000Z');               // index 2: window 0
  t('npc:2', 0, 15, 'buy', '2026-01-01T00:00:04.000Z');                     // index 3: NPC reaction to move 1
  points.push({ ply: 1, prices: claimPrices(m), model: [0.45, 0.2, 0.35], at: '2026-01-01T00:00:04.000Z', revision: rev(m, 1) });
  t('player:cash', 0, 5, 'buy', '2026-01-01T00:00:05.000Z');                // index 4: window 1
  t('npc:1', 2, 40, 'buy', '2026-01-01T00:00:06.000Z');                     // index 5: reaction to move 2
  points.push({ ply: 2, prices: claimPrices(m), model: [0.3, 0.2, 0.5], at: '2026-01-01T00:00:06.000Z', revision: rev(m, 2) });
  t('player:cash', 2, 4, 'sell', '2026-01-01T00:00:07.000Z');               // index 6: window 2
  // move 3 ends the game (no point is published for the final move), the market closes and settles on Black
  const closed = closeMarket(m, '2026-01-01T00:00:08.000Z');
  const collateral = 10_000 * MICRO;
  const s = settleMarket(closed, [pos!], 2, '2026-01-01T00:00:09.000Z', collateral, 'wg:f1');
  return { market: s.market, points, journals, position: s.positions[0], open: m };
}

describe('historical market synchronised to the replay ply', () => {
  const g = recordedGame();
  const tl = buildMarketTimeline(g.market, g.points, g.journals, g.position);

  it('assigns each trade to the trading window of the move on the board', () => {
    expect(tl.trades.map(x => [x.index, x.ply])).toEqual([[1, 0], [2, 0], [3, 0], [4, 1], [5, 1], [6, 2]]);
    expect(tl.playerTrades.map(x => [x.ply, x.side, x.claim, x.shares])).toEqual([[0, 'buy', 2, 10], [1, 'buy', 0, 5], [2, 'sell', 2, 4]]);
    for (const x of tl.playerTrades) expect(x.cash).toBe(g.journals.find(j => j.id === `trade:${g.market.id}:${x.index}`)!.lines.find(l => l.account === 'player:cash')!.amount);
  });

  it('shows exactly the recorded prices at each ply and never invents one', () => {
    for (const p of g.points) expect(marketAtPly(tl, p.ply, 3).point!.prices).toEqual(p.prices);
    // the final move has no published point: the latest earlier recorded point is shown, labelled with its own ply
    const end = marketAtPly(tl, 3, 3);
    expect(end.point!.ply).toBe(2);
    expect(end.point!.prices).toEqual(g.points[2].prices);
    const ch = marketAtPly(tl, 2, 3).change!;
    ch.forEach((d, i) => expect(d).toBeCloseTo(g.points[2].prices[i] - g.points[1].prices[i], 12));
    // a market that was never traded in play has no recorded prices at all
    const none = buildMarketTimeline(g.market, [], g.journals, g.position);
    expect(marketAtPly(none, 2, 3).point).toBeNull();
    expect(marketAtPly(none, 2, 3).markValue).toBe(0);
  });

  it('replays holdings, value and P&L at the recorded prices, then the recorded settlement', () => {
    const a0 = marketAtPly(tl, 0, 3);
    expect(a0.holdings).toEqual([0, 0, 10]);
    expect(a0.markValue).toBe(Math.round(10 * g.points[0].prices[2] * MICRO));
    expect(a0.pnl).toBe(a0.netCash + a0.markValue);
    const a1 = marketAtPly(tl, 1, 3);
    expect(a1.holdings).toEqual([5, 0, 10]);
    expect(a1.markValue).toBe(Math.round((5 * g.points[1].prices[0] + 10 * g.points[1].prices[2]) * MICRO));
    expect(a1.resolved).toBe(false);
    const a2 = marketAtPly(tl, 2, 3);
    expect(a2.holdings).toEqual([5, 0, 6]);
    expect(a2.resolved).toBe(false);
    const end = marketAtPly(tl, 3, 3);
    expect(end.resolved).toBe(true);
    expect(end.markValue).toBe(6 * MICRO); // 6 Black shares × $1, as paid at settlement
    expect(end.realised).toBe(g.position.received - g.position.spent);
    expect(end.pnl).toBe(end.realised);
    expect(tl.resolution).toMatchObject({ status: 'settled', result: 2 });
  });

  it('lists recorded price moves and the player’s trades as match events', () => {
    const ev = matchEvents({ sans: ['a3', 'f4', 'Nxb3'], timeline: tl, result: '0-1', termination: 'checkmate', priceMin: 0.01 });
    expect(ev.filter(e => e.kind === 'trade').map(e => e.ply)).toEqual([0, 1, 2]);
    expect(ev.some(e => e.kind === 'price' && /\(recorded\)/.test(e.text))).toBe(true);
    expect(ev.find(e => e.kind === 'capture')?.ply).toBe(3);
    expect(ev[ev.length - 1]).toMatchObject({ kind: 'settlement', ply: 3 });
  });

  it('falls back to timestamps only for points without a revision', () => {
    const pts = g.points.map(p => ({ ...p, revision: undefined }));
    const t2 = buildMarketTimeline(g.market, pts, g.journals, g.position);
    expect(t2.playerTrades.map(x => x.ply)).toEqual([0, 1, 2]);
  });
});

describe('sandbox never mutates the saved game', () => {
  const pos = Position.fromFen(START);
  const mainline: string[] = [];
  for (let i = 0; i < 6; i++) { const mv = pos.legalMoves()[i % pos.legalMoves().length]; mainline.push(moveToCcn(mv)); pos.makeMove(mv); }
  const game = { id: 'g1', initialFen: START, moves: mainline.map(ccn => ({ ccn })) };
  const deepFreeze = <T,>(o: T): T => { Object.freeze(o); for (const v of Object.values(o as object)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v); return o; };

  it('plays alternative moves from a replay position without touching the record', () => {
    const frozen = deepFreeze(structuredClone(game));
    const before = JSON.stringify(frozen);
    const source = frozen.moves.map(m => m.ccn);
    let sb = createSandbox(frozen.initialFen, source, 3);
    expect(sb.baseMoves).toEqual(mainline.slice(0, 3));
    const alt = sandboxLegal(sb).find(c => c !== mainline[3])!;
    const s1 = sandboxMove(sb, alt)!;
    expect(s1.line).toEqual([alt]);
    expect(sb.line).toEqual([]); // the previous sandbox is unchanged
    sb = sandboxMove(s1, sandboxLegal(s1)[0])!;
    expect(sb.line.length).toBe(2);
    expect(sandboxHistory(sb)).toEqual([...mainline.slice(0, 3), ...sb.line]);
    expect(sandboxMove(sb, 'a1a1')).toBeNull();
    expect(sandboxUndo(sb).line).toEqual([alt]);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(frozen.moves.map(m => m.ccn)).toEqual(mainline);
  });

  it('copies the base moves, so later changes to the source cannot leak in', () => {
    const src = [...mainline];
    const sb = createSandbox(START, src, 2);
    src[0] = 'zz';
    expect(sb.baseMoves[0]).toBe(mainline[0]);
    expect(Object.isFrozen(sb.baseMoves)).toBe(true);
    const p = Position.fromFen(START); p.makeMove(p.legalMoves().find(m => moveToCcn(m) === mainline[0])!); p.makeMove(p.legalMoves().find(m => moveToCcn(m) === mainline[1])!);
    expect(sandboxFen(sb)).toBe(p.toFen());
  });

  it('the sandbox UI has no path that saves a game', () => {
    const src = readFileSync(new URL('../src/ui/ReplayTools.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/saveGame|putGame|finalize\(/);
    // it writes only bookmark records (saved positions)
    expect(src.match(/services\.db\.\w+\(/g)).toEqual(['services.db.put(']);
    expect(src).toContain("services.db.put('bookmarks'");
  });
});

describe('turning points', () => {
  it('ranks the largest expected-score swings and ignores small ones', () => {
    const us = [0.5, 0.52, 0.8, 0.78, 0.3, 0.32];
    const t = turningPoints(us, 3);
    expect(t.map(x => x.ply)).toEqual([5, 3]);
    expect(t[0]).toMatchObject({ favours: 'black' });
    expect(t[0].swing).toBeCloseTo(-0.48, 9);
    expect(turningPoints([0.5, 0.55], 3)).toEqual([]);
  });
});

describe('replay library filters', () => {
  const base: Omit<ReplayEntry, 'id'> = { kind: 'federation', white: 'Ada', black: 'Bo', whiteRating: 1500, blackRating: 1500, score: 0.5, result: '½-½', event: 'League', stage: null, season: 1, round: 1, at: '2026-01-01', plies: 40, swing: 0.1, priceMove: null, hasMarket: false, championshipFinal: false, rivalry: false, upsetGap: 0 };
  const rows: ReplayEntry[] = [
    { ...base, id: 'g-mine', kind: 'personal', at: '2026-02-01' },
    { ...base, id: 'wg:final', championshipFinal: true, stage: 'Final', event: 'Crown Championship' },
    { ...base, id: 'wg:upset', whiteRating: 1300, blackRating: 1600, score: 1, upsetGap: upsetGapOf(1300, 1600, 1) },
    { ...base, id: 'wg:swing', swing: 0.6 },
    { ...base, id: 'wg:market', priceMove: 0.22, hasMarket: true },
    { ...base, id: 'wg:rival', rivalry: true },
  ];
  const ids = (f: Parameters<typeof filterReplays>[1], fav = new Set<string>(), q = '') => filterReplays(rows, f, fav, q).map(r => r.id);
  it('filters by kind, finals, rivalries, upsets, swings, market moments and favourites', () => {
    expect(ids('all')).toHaveLength(6);
    expect(ids('personal')).toEqual(['g-mine']);
    expect(ids('federation')).toHaveLength(5);
    expect(ids('finals')).toEqual(['wg:final']);
    expect(ids('rivalries')).toEqual(['wg:rival']);
    expect(ids('upsets')).toEqual(['wg:upset']);
    expect(ids('swings')).toEqual(['wg:swing']);
    expect(ids('market')).toEqual(['wg:market']);
    expect(ids('favourites', new Set(['wg:swing', 'g-mine']))).toEqual(['g-mine', 'wg:swing']);
    expect(ids('all', new Set(), 'crown')).toEqual(['wg:final']);
  });
  it('measures upsets from the winner’s side only', () => {
    expect(upsetGapOf(1300, 1600, 1)).toBe(300);
    expect(upsetGapOf(1300, 1600, 0)).toBe(0);
    expect(upsetGapOf(1300, 1600, 0.5)).toBe(0);
    expect(upsetGapOf(null, 1600, 1)).toBe(0);
  });
  it('builds rows from recorded games', () => {
    const g = recordedGame();
    const wg = { id: 'wg:f1', event: 'champ', stage: 'Final', season: 2, round: 19, white: 'a', black: 'b', whiteName: 'A', blackName: 'B', whiteRating: 2000, blackRating: 2200, result: '1-0', createdAt: '2026-01-01',
      moves: [{ score: { kind: 'cp', value: 0, pov: 'white' } }, { score: { kind: 'cp', value: -900, pov: 'black' } }] } as const;
    const e = federationEntry(wg as never, g.points, new Set(['a|b']), new Set());
    expect(e).toMatchObject({ championshipFinal: true, rivalry: true, upsetGap: 200, hasMarket: true, kind: 'federation' });
    expect(e.swing!).toBeGreaterThan(0.3);
    const rec = { id: 'g9', white: { id: 'player', name: 'You', rating: 1400 }, black: { id: 'mira', name: 'Mira', rating: 1500 }, humanColor: 'white', result: '1-0', moves: [], context: { kind: 'quick-match' }, mode: 'rated', rated: true, startedAt: '2026-01-02', endedAt: '2026-01-02' } as unknown as GameRecord;
    expect(personalEntry(rec, null, new Set(['mira']))).toMatchObject({ kind: 'personal', rivalry: true, upsetGap: 100, swing: null, event: 'Rated game' });
  });
});
