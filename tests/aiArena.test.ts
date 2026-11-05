/**
 * v1.1 AI vs AI Arena (docs/AI_ARENA.md): exhibition picker filters (name, rating, division, title, style, region),
 * the display clock vs the AI thinking budget (separate: the clock never changes a search request), restart semantics
 * (new record; same seed = identical game, new seed = new seed; old record kept and marked), and the optional practice
 * market (casual Sandbox Exchange reused): prices change only from published moves and trades, stale quotes are
 * rejected, it settles exactly once or is voided on restart, it never touches an official account, and an exhibition
 * with a practice market changes no rating, standing, record or official market — the season simulation continues
 * identically to a world that never had one.
 */
import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { TOPOLOGY_V3, type Competitor } from '../src/federation/model';
import { filterCompetitors } from '../src/app/discovery';
import { isValidatedStyle } from '../src/engine/styles';
import { Position } from '../src/rules/position';
import { parseLegalCcn } from '../src/rules/notation';
import { START_FEN, playLiveMove } from '../src/app/schedulerEngine';
import {
  EXHIBITION_TIME_CONTROLS, ExhibitionRunner, clocksAt, fmtClock, loadExhibition, restartOf, thinkingBudget, timeControlById, validateExhibition, type ComputeMove,
} from '../src/app/exhibition';
import { EXH_MAKER, exhibitionLiveModel, exhibitionMarketId, exhibitionPrior } from '../src/app/exhibitionMarket';
import { claimPrices } from '../src/exchange/market';
import { hashSeed } from '../src/federation/generator';
import { decodeFederationStores } from '../src/federation/persist';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
const NO_SETS = { watchlist: new Set<string>(), featured: new Set<string>(), rivals: null, upcoming: new Set<string>(), favorites: new Set<string>() };
const ALL = { q: '', region: -1, division: 0, minR: -1e9, maxR: 1e9, title: '', style: '', club: '', special: '' as const };

/** In-process engine, capped hard; reports a fixed 1,000 ms thinking time so the display clock is checkable. */
function fastCompute(log?: { profile: string; nodes: number; maxTimeMs: number; style: string; seed: number; ply: number }[]): ComputeMove {
  return async req => {
    log?.push({ profile: req.profile.id, nodes: req.profile.nodes, maxTimeMs: req.profile.maxTimeMs, style: req.style, seed: req.seed, ply: req.moves.length });
    const pos = Position.fromFen(START_FEN);
    for (const c of req.moves) pos.makeMove(parseLegalCcn(pos, c));
    const r = playLiveMove(pos, { ...req.profile, nodes: Math.min(req.profile.nodes, 300), depth: Math.min(req.profile.depth, 4), maxTimeMs: 2000 }, req.style, req.seed);
    return { ccn: r.ccn, score: r.score, depth: r.depth, nodes: r.nodes, ms: 1000 };
  };
}
async function world(seed = 4242) {
  const f = new IDBFactory();
  const db = await CrownDB.open(f);
  let own = 0;
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), () => new Date(Date.UTC(2026, 0, 1) + (own++) * 1000).toISOString());
  svc.runSelfplay = async req => { const h = hashSeed(req.seed, 'stub') % 3; return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: h === 2 ? 'threefold-claim' : 'checkmate' }; };
  await svc.create(3, seed, TOPOLOGY_V3);
  return { f, db, svc };
}
const active = (svc: FederationService) => [...svc.state!.competitors.values()].filter(c => c.status === 'active');
const runner = (db: CrownDB, compute: ComputeMove, extra: Partial<ConstructorParameters<typeof ExhibitionRunner>[0]> = {}) => {
  const r = new ExhibitionRunner({ db, compute, cancel: () => {}, now, ...extra });
  r.paceMs = 0;
  return r;
};
/** The runner wired to the practice market exactly as the app does (src/app/services.ts). */
const marketRunner = (db: CrownDB, svc: FederationService, compute: ComputeMove, extra: Partial<ConstructorParameters<typeof ExhibitionRunner>[0]> = {}) => runner(db, compute, {
  onMoved: async g => { await svc.publishExhibitionMove(g); },
  onSkip: async g => { await svc.closeExhibitionMarket(g.id); },
  onRestart: async old => { if (old.status !== 'finished') await svc.resolveExhibitionMarket(old, 'restarted'); },
  onFinished: g => { void svc.resolveExhibitionMarket(g); },
  ...extra,
});
const officialBalances = (svc: FederationService) => JSON.stringify([...svc.state!.balances.entries()].filter(([a]) => !a.startsWith('sandbox:')).sort());
const STRIP = new Set(['at', 'openedAt', 'closedAt', 'settledAt', 'createdAt', 'startedAt', 'lastMoveAt', 'finishedAt', 'processedAt']);
const norm = (v: unknown): unknown => (Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).filter(k => !STRIP.has(k)).sort().map(k => [k, norm((v as Record<string, unknown>)[k])])) : v);
/** Every official record (federation decoded, sandbox accounts/markets/positions/journals removed; timestamps aside),
 *  the player's games, ratings and reports. */
async function officialBody(db: CrownDB): Promise<Record<string, unknown>> {
  const d = await db.dump();
  const fed = decodeFederationStores(d.federation) as Record<string, Record<string, unknown>[]>;
  const sb = new Set((fed.markets ?? []).filter(m => m.sandbox).map(m => m.id as string));
  const body = {
    ...fed,
    accounts: (fed.accounts ?? []).filter(a => !String(a.account).startsWith('sandbox:')),
    markets: (fed.markets ?? []).filter(m => !m.sandbox),
    positions: (fed.positions ?? []).filter(p => !sb.has(p.marketId as string)),
    journal: (fed.journal ?? []).filter(j => !(j.lines as { account: string }[]).some(l => l.account.startsWith('sandbox:'))),
    games: d.games, ratingEvents: d.ratingEvents, ratingState: d.ratingState, reports: d.reports,
  };
  return norm(body) as Record<string, unknown>;
}
async function officialHash(db: CrownDB): Promise<string> { return createHash('sha256').update(JSON.stringify(await officialBody(db))).digest('hex'); }

describe('AI Arena: competitor filters', () => {
  it('filters by title, style and region (with name, rating band and division) over the whole federation', async () => {
    const { svc } = await world();
    const all = active(svc);
    // titles are awarded later in a career: give a few competitors titles (copies) so every title filter is exercised
    const T = ['Squire', 'Knight', 'Paladin'] as const;
    for (let i = 0; i < 60; i++) all[i * 37] = { ...all[i * 37], fedTitle: T[i % 3] } as Competitor;
    const titled = all.find(c => c.fedTitle)!;
    const byTitle = filterCompetitors(all, { ...ALL, title: titled.fedTitle! }, NO_SETS);
    expect(byTitle.length).toBeGreaterThan(0);
    expect(byTitle.every(c => c.fedTitle === titled.fedTitle)).toBe(true);
    const anyTitle = filterCompetitors(all, { ...ALL, title: 'any' }, NO_SETS);
    expect(anyTitle.every(c => !!c.fedTitle)).toBe(true);
    const style = isValidatedStyle(all[0].style) ? all[0].style : 'universal';
    const byStyle = filterCompetitors(all, { ...ALL, style }, NO_SETS);
    expect(byStyle.length).toBeGreaterThan(0);
    expect(byStyle.every(c => (isValidatedStyle(c.style) ? c.style : 'universal') === style)).toBe(true);
    const byRegion = filterCompetitors(all, { ...ALL, region: 2 }, NO_SETS);
    expect(byRegion.length).toBeGreaterThan(0);
    expect(byRegion.every(c => c.region === 2)).toBe(true);
    const combo = filterCompetitors(all, { ...ALL, region: titled.region, title: titled.fedTitle!, division: titled.division, q: titled.name.slice(0, 4) }, NO_SETS);
    expect(combo.some(c => c.id === titled.id)).toBe(true);
    expect(combo.every(c => c.region === titled.region && c.division === titled.division && c.fedTitle === titled.fedTitle)).toBe(true);
  });
});

describe('AI Arena: display clock vs AI thinking budget', () => {
  it('has the long presets; the clock never changes a search request, and is charged the recorded thinking time', async () => {
    const { db, svc } = await world();
    const all = active(svc);
    const a = all[5], b = all[900];
    // the official presets (src/games/types.ts) plus the legacy short clocks and No clock; retired ids still resolve
    expect(EXHIBITION_TIME_CONTROLS.map(t => t.id)).toEqual(['untimed', '3+2', '5+3', '15+10', '30+30', '60+60', '90+60', '120+90', '180+120', '240+120']);
    expect(EXHIBITION_TIME_CONTROLS.find(t => t.id === '60+60')!.label).toBe('Classical 60+60');
    expect(EXHIBITION_TIME_CONTROLS.find(t => t.id === '240+120')!.label).toBe('Eternal Crown 240+120');
    expect(timeControlById('60+30')).toMatchObject({ initialMs: 60 * 60_000, incrementMs: 30_000 });
    expect(clocksAt({ moves: [{ ms: 1000 }] as never, timeControl: { id: '180+60', label: 'Classical 180+60', initialMs: 180 * 60_000, incrementMs: 60_000 } })!.white).toBe(180 * 60_000 + 59_000);
    const long = timeControlById('120+90')!;
    expect(long.initialMs).toBe(120 * 60_000);
    expect(long.incrementMs).toBe(90_000);
    expect(timeControlById('untimed')).toBeNull();
    const logA: Parameters<typeof fastCompute>[0] = [], logB: Parameters<typeof fastCompute>[0] = [];
    const rA = runner(db, fastCompute(logA)), rB = runner(db, fastCompute(logB));
    const gA = await rA.start(a, b, { seed: 11, timeControl: long }); await rA.settled();
    const gB = await rB.start(a, b, { seed: 11 }); await rB.settled();
    expect(gA.timeControl?.id).toBe('120+90');
    expect(gB.timeControl ?? null).toBeNull();
    // identical engine requests (profile, nodes, wall-clock cap, style, seed) with or without a 2-hour clock
    expect(logA).toEqual(logB);
    expect(rA.game!.moves.map(m => m.ccn)).toEqual(rB.game!.moves.map(m => m.ccn));
    // each side's budget is its own profile's, not the clock's
    expect(new Set(logA.filter(e => e.ply % 2 === 0).map(e => e.maxTimeMs))).toEqual(new Set([gA.white.profile.maxTimeMs]));
    expect(thinkingBudget(gA.white.profile).seconds).toBe(Math.round(gA.white.profile.maxTimeMs / 100) / 10);
    expect(thinkingBudget(gA.white.profile).text).toMatch(/^AI thinking budget: up to [\d.]+ s per move/);
    expect(thinkingBudget(gA.white.profile).seconds).toBeLessThan(60); // a 120-minute game is not hours of waiting
    // clock arithmetic: initial − Σ measured ms + increment per move made (display/accounting only)
    const fin = rA.game!;
    const c = clocksAt(fin)!;
    const nW = Math.ceil(fin.moves.length / 2), nB = Math.floor(fin.moves.length / 2);
    expect(c.white).toBe(long.initialMs + nW * (long.incrementMs - 1000));
    expect(c.black).toBe(long.initialMs + nB * (long.incrementMs - 1000));
    expect(clocksAt(fin, 0)).toEqual({ white: long.initialMs, black: long.initialMs, spent: { white: 0, black: 0 } });
    expect(clocksAt(rB.game!)).toBeNull();
    expect(fmtClock(long.initialMs)).toBe('2:00:00');
    expect(fmtClock(65_000)).toBe('1:05');
    // the game ended by the rules, never on time, and the record still validates (deterministic replay)
    expect(['checkmate', 'stalemate', 'threefold-claim', 'fifty-move-claim', 'playing-limit', 'insufficient-material', 'threefold', 'fifty-move']).toContain(fin.termination);
    const stored = (await loadExhibition(db, fin.id))!;
    expect(() => validateExhibition(stored)).not.toThrow();
  }, 180_000);
});

describe('AI Arena: restart semantics', () => {
  it('restart = new record; same seed replays the identical game, new seed draws a new one; old record kept', async () => {
    const { db, svc } = await world();
    const all = active(svc);
    const a = all[20], b = all[3000];
    let cancels = 0;
    const base = fastCompute();
    let r!: ExhibitionRunner;
    const compute: ComputeMove = async req => { const out = await base(req); if (req.moves.length === 7 && r.game?.restartOf == null) r.pause(); return out; };
    r = runner(db, compute, { cancel: () => { cancels++; } });
    const g0 = await r.start(a, b, { seed: 77, timeControl: timeControlById('30+30') });
    await r.settled();
    expect(r.state).toBe('paused');
    expect(r.game!.moves.length).toBe(7);
    const same = await r.restart('same');
    await r.settled();
    expect(same.id).not.toBe(g0.id);
    expect(same.seed).toBe(g0.seed);
    expect(same.restartOf).toEqual({ id: g0.id, seed: 'same' });
    expect(same.white).toEqual(g0.white);
    expect(same.black).toEqual(g0.black);
    expect(same.timeControl?.id).toBe('30+30');
    const old = (await loadExhibition(db, g0.id))!;
    expect(old.restartedAs).toBe(same.id);
    expect(old.moves).toHaveLength(7); // kept in the archive, untouched
    expect(r.game!.status).toBe('finished');
    // the same seed: the first 7 plies are identical, and the whole game equals an uninterrupted run
    expect(r.game!.moves.slice(0, 7).map(m => m.ccn)).toEqual(old.moves.map(m => m.ccn));
    const ref = runner(db, fastCompute());
    await ref.start(a, b, { seed: 77 }); await ref.settled();
    expect(r.game!.moves.map(m => m.ccn)).toEqual(ref.game!.moves.map(m => m.ccn));
    // a new seed
    const fresh = await r.restart('new', { paused: true, fresh: 12345 });
    expect(fresh.seed).toBe(12345);
    expect(fresh.restartOf).toEqual({ id: same.id, seed: 'new' });
    expect(r.state).toBe('paused');
    expect(fresh.moves).toHaveLength(0);
    // pure helper: same seed restart of itself never collides on id
    const self = restartOf(fresh, fresh.createdAt, 'same');
    expect(self.id).not.toBe(fresh.id);
    expect(cancels).toBeGreaterThanOrEqual(1);
  }, 180_000);
});

describe('AI Arena: practice market on an exhibition', () => {
  it('sandbox money only; prices move only on published moves and trades; stale quotes rejected; settles exactly once', async () => {
    const { db, svc } = await world();
    const all = active(svc);
    const a = all[40], b = all[41];
    const official0 = officialBalances(svc);
    const officialMarkets0 = [...svc.state!.markets.values()].filter(m => !m.sandbox).map(m => JSON.stringify(m)).sort();
    let r!: ExhibitionRunner;
    const base = fastCompute();
    let once = false;
    const compute: ComputeMove = async req => { const out = await base(req); if (req.moves.length === 4 && !once) { once = true; r.pause(); } return out; };
    r = marketRunner(db, svc, compute);
    const g = await r.start(a, b, { seed: 5, paused: true });
    const m0 = await svc.openExhibitionMarket(g);
    expect(m0.id).toBe(exhibitionMarketId(g.id));
    expect(m0.sandbox).toBe(true);
    expect(m0.kind).toBe('sandbox');
    claimPrices(m0).forEach((p, i) => expect(p).toBeCloseTo(exhibitionPrior(g)[i], 6));
    expect(svc.sandboxBalance()).toBe(500 * 1_000_000);
    // buy at ply 0
    await svc.exhibitionTrade(g.id, 0, 10, 'buy', 0);
    const afterBuy = claimPrices(svc.exhibitionMarketFor(g.id)!);
    const bal1 = svc.sandboxBalance();
    expect(bal1).toBeLessThan(500 * 1_000_000);
    // no published move, no price change: waiting changes nothing
    await new Promise(res => setTimeout(res, 20));
    expect(claimPrices(svc.exhibitionMarketFor(g.id)!)).toEqual(afterBuy);
    // play to ply 4 (pause requested on the 5th reply, which is discarded): each published move re-anchors to the public live model
    r.resume(); await r.settled();
    const n = r.game!.moves.length;
    expect(n).toBe(4);
    const m1 = svc.exhibitionMarketFor(g.id)!;
    expect(m1.live?.plies).toBe(n);
    const model = exhibitionLiveModel(r.game!);
    claimPrices(m1).slice(0, 3).forEach((p, i) => expect(Math.abs(p - model[i])).toBeLessThan(0.02));
    expect(m1.history.slice(1).every(h => h.by === 'sandbox:player' || h.by === EXH_MAKER)).toBe(true);
    // a quote from an earlier ply is rejected
    await expect(svc.exhibitionTrade(g.id, 1, 5, 'buy', 0)).rejects.toThrow(/new move/);
    await svc.exhibitionTrade(g.id, 1, 5, 'buy', n);
    // a second publish of the same ply is a no-op (idempotent)
    expect(await svc.publishExhibitionMove(r.game!)).toBe(false);
    // finish: the market settles once on the result
    await r.finish();
    expect(r.state).toBe('finished');
    for (let i = 0; i < 100 && svc.exhibitionMarketFor(g.id)!.status !== 'settled' && svc.exhibitionMarketFor(g.id)!.status !== 'cancelled'; i++) await new Promise(res => setTimeout(res, 20));
    const fin = r.game!;
    const settled = svc.exhibitionMarketFor(g.id)!;
    expect(settled.status === 'settled' || (settled.status === 'cancelled' && fin.termination === 'playing-limit')).toBe(true);
    const balSettled = svc.sandboxBalance();
    const pos = svc.state!.positions.get(`${settled.id}|sandbox:player`)!;
    if (settled.status === 'settled') {
      const win = fin.result === '1-0' ? 0 : fin.result === '0-1' ? 2 : 1;
      expect(pos.received).toBe(pos.shares[win] * 1_000_000);
    }
    // exactly once
    expect(await svc.resolveExhibitionMarket(fin)).toBe('none');
    expect(await svc.resolveExhibitionMarket(fin, 'deleted')).toBe('none');
    expect(svc.sandboxBalance()).toBe(balSettled);
    expect(svc.state!.journalIds.has(`settle:${settled.id}`)).toBe(true);
    await expect(svc.exhibitionTrade(g.id, 0, 1, 'buy', fin.moves.length)).rejects.toThrow(/over|closed/);
    // official money, official markets untouched; every journal of the market is sandbox-only
    expect(officialBalances(svc)).toBe(official0);
    expect([...svc.state!.markets.values()].filter(m => !m.sandbox).map(m => JSON.stringify(m)).sort()).toEqual(officialMarkets0);
    const journals = (await db.dump()).federation.journal as { id: string; lines: { account: string }[] }[];
    for (const j of journals.filter(x => x.id.includes(settled.id) || x.id.startsWith('sandbox-'))) expect(j.lines.every(l => l.account.startsWith('sandbox:'))).toBe(true);
    // the market reloads from storage in the same state
    const svc2 = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
    await svc2.load();
    expect(svc2.exhibitionMarketFor(g.id)!.status).toBe(settled.status);
  }, 180_000);

  it('restart voids the old game’s market at its published opening prices; Skip to Result stops trading', async () => {
    const { db, svc } = await world();
    const all = active(svc);
    const a = all[60], b = all[61];
    let r!: ExhibitionRunner;
    const base = fastCompute();
    const compute: ComputeMove = async req => { const out = await base(req); if (req.moves.length === 2 && !r.game?.restartOf) r.pause(); return out; };
    r = marketRunner(db, svc, compute);
    const g = await r.start(a, b, { seed: 9 });
    await r.settled();
    const m = await svc.openExhibitionMarket(r.game!);
    expect(m.live?.plies).toBe(2); // opened mid-game: already anchored to the published moves
    await svc.exhibitionTrade(g.id, 2, 10, 'buy', 2);
    const spent = svc.state!.positions.get(`${m.id}|sandbox:player`)!.spent;
    const bal = svc.sandboxBalance();
    const next = await r.restart('same', { paused: true });
    const v = svc.exhibitionMarketFor(g.id)!;
    expect(v.status).toBe('cancelled');
    expect(v.ref?.void).toBe('restarted');
    const p = svc.state!.positions.get(`${m.id}|sandbox:player`)!;
    expect(p.received).toBe(Math.floor(10 * exhibitionPrior(g)[2] * 1_000_000 + 1e-6));
    expect(svc.sandboxBalance()).toBe(bal + p.received);
    expect(p.received).toBeLessThan(spent + 1_000_000);
    // the new game has its own (unopened) market; a restarted record cannot open one
    expect(svc.exhibitionMarketFor(next.id)).toBeUndefined();
    await expect(svc.openExhibitionMarket((await loadExhibition(db, g.id))!)).rejects.toThrow(/restarted/);
    // Skip to Result closes trading on the new game's market
    await svc.openExhibitionMarket(next);
    const done = r.finish();
    await done;
    const mk = svc.exhibitionMarketFor(next.id)!;
    expect(['closed', 'settled', 'cancelled']).toContain(mk.status);
    expect(mk.history.filter(h => h.by === EXH_MAKER).length).toBe(0); // no re-pricing while skipping
  }, 180_000);
});

describe('AI Arena: isolation with clocks, restarts and a practice market', () => {
  it('no rating, standing, record or official market changes; the season simulation is identical', async () => {
    const A = await world(6161), B = await world(6161);
    const advance = async (svc: FederationService, k: number) => { for (let i = 0; i < k; i++) { for (const x of svc.playerFixtures()) await svc.forfeit(x.id); await svc.advanceRound(); } };
    await advance(A.svc, 1); await advance(B.svc, 1);
    expect(await officialHash(B.db)).toBe(await officialHash(A.db));
    const snap = (svc: FederationService) => JSON.stringify([...svc.state!.competitors.values()].map(c => [c.id, c.rating, c.rd, c.sigma, c.stats, c.titles, c.fedTitle ?? null, c.earnings, c.history.length]));
    const s0 = snap(B.svc);
    const all = active(B.svc);
    const pick: Competitor[] = [all[0], all[all.length - 1]];
    let r!: ExhibitionRunner;
    const base = fastCompute();
    const compute: ComputeMove = async req => { const out = await base(req); if (req.moves.length === 4 && !r.game?.restartOf) r.pause(); return out; };
    r = marketRunner(B.db, B.svc, compute);
    const g = await r.start(pick[0], pick[1], { seed: 1, timeControl: timeControlById('120+90'), paused: true });
    await B.svc.openExhibitionMarket(g);
    await B.svc.exhibitionTrade(g.id, 0, 5, 'buy', 0);
    r.resume(); await r.settled();
    await r.restart('new', { fresh: 4 });
    await B.svc.openExhibitionMarket(r.game!).catch(() => {});
    await r.settled();
    for (let i = 0; i < 100 && B.svc.exhibitionMarketFor(r.game!.id)?.status === 'open'; i++) await new Promise(res => setTimeout(res, 20));
    expect(snap(B.svc)).toBe(s0);
    const d = await B.db.dump();
    expect(d.games).toHaveLength(0);
    expect(d.ratingEvents).toHaveLength(0);
    expect(await officialHash(B.db)).toBe(await officialHash(A.db));
    await advance(A.svc, 2); await advance(B.svc, 2);
    expect(await officialHash(B.db)).toBe(await officialHash(A.db));
  }, 300_000);
});
