/**
 * Exhibition Arena (crown-exhibition-1, src/app/exhibition.ts): selection of any two distinct competitors at 10,240
 * (including an extreme 0–399 vs 4,000+ mismatch), each side's own engine profile and validated style, completion,
 * pause/resume determinism, archive persistence (reload and backup round trip) and isolation from every official
 * record: ratings/RD, game counts, standings, W/L, prize money and balances, markets, Vault facts, titles, rivalries,
 * scheduling and season simulation (federation hash), analysis reports and Played Like career records.
 */
import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService, FEATURED_NODE_CAP } from '../src/app/federation';
import { TOPOLOGY_V3, type Competitor } from '../src/federation/model';
import { filterCompetitors, pageOf } from '../src/app/discovery';
import { RATING_BANDS } from '../src/app/population';
import { profileForStrength, strengthNote, MEASURED_TOP } from '../src/federation/profiles';
import { playStyle } from '../src/engine/styles';
import { Position } from '../src/rules/position';
import { parseLegalCcn } from '../src/rules/notation';
import { START_FEN, playLiveMove, plySeed } from '../src/app/schedulerEngine';
import {
  EXHIBITION_NODE_CAP, ExhibitionRunner, deleteExhibition, listExhibitions, loadExhibition, loadExhibitionReport, newExhibition, sideOf, type ComputeMove, type ExhibitionGame,
} from '../src/app/exhibition';
import { exportBundle, importBundle, validateBundle } from '../src/storage/backup';
import { sha256Hex } from '../src/storage/checksum';
import { analyzeGame, ANALYSIS_PRESETS } from '../src/analysis/analyzer';
import { AppServices } from '../src/app/services';
import { buildFacts } from '../src/vault/facts';
import { exhibitionEntry, filterReplays } from '../src/app/replay';
import { needsRecord, buildPlayedLikeRecord } from '../src/analysis/playedLikeRecords';
import { backfillPlayedLike } from '../src/storage/playedLikeStore';
import { hashSeed } from '../src/federation/generator';
import { decodeFederationStores } from '../src/federation/persist';
import type { GameRecord } from '../src/games/types';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
const NO_SETS = { watchlist: new Set<string>(), featured: new Set<string>(), rivals: null, upcoming: new Set<string>(), favorites: new Set<string>() };
const ALL = { q: '', region: -1, division: 0, minR: -1e9, maxR: 1e9, title: '', style: '', club: '', special: '' as const };
const band = (i: number) => { const B = RATING_BANDS[i]; return { minR: B.lo === -Infinity ? -1e9 : B.lo - 0.5, maxR: B.hi === Infinity ? 1e9 : B.hi - 0.5 - 1e-9 }; };

/** In-process engine with the side's own profile, capped hard so the test is quick (the request is recorded unchanged). */
function fastCompute(log?: { profile: string; nodes: number; style: string; seed: number; ply: number }[]): ComputeMove {
  return async req => {
    log?.push({ profile: req.profile.id, nodes: req.profile.nodes, style: req.style, seed: req.seed, ply: req.moves.length });
    const pos = Position.fromFen(START_FEN);
    for (const c of req.moves) pos.makeMove(parseLegalCcn(pos, c));
    const p = { ...req.profile, nodes: Math.min(req.profile.nodes, 300), depth: Math.min(req.profile.depth, 4), maxTimeMs: 2000 };
    const r = playLiveMove(pos, p, req.style, req.seed);
    return { ccn: r.ccn, score: r.score, depth: r.depth, nodes: r.nodes, ms: r.ms };
  };
}

async function world(seed = 4242) {
  const f = new IDBFactory();
  const db = await CrownDB.open(f);
  let own = 0; // each world has its own clock, so two identical worlds commit identical timestamps
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), () => new Date(Date.UTC(2026, 0, 1) + (own++) * 1000).toISOString());
  svc.runSelfplay = async req => { const h = hashSeed(req.seed, 'stub') % 3; return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: h === 2 ? 'threefold-claim' : 'checkmate' }; };
  await svc.create(3, seed, TOPOLOGY_V3);
  return { f, db, svc };
}
const active = (svc: FederationService) => [...svc.state!.competitors.values()].filter(c => c.status === 'active');
function extremes(svc: FederationService): { low: Competitor; high: Competitor } {
  const all = active(svc);
  const low = filterCompetitors(all, { ...ALL, ...band(0) }, NO_SETS).at(-1)!;
  const high = filterCompetitors(all, { ...ALL, ...band(9) }, NO_SETS)[0]!;
  return { low, high };
}
const sortKeys = (v: unknown): unknown => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys((v as Record<string, unknown>)[k])])) : v);
/** Everything official: the federation (decoded), games, rating events and state, reports, Vault/Grimoire meta. */
async function officialHash(db: CrownDB): Promise<string> {
  const d = await db.dump();
  const meta: { key: string; value: unknown }[] = [];
  for (const p of ['ach:', 'achtoast:', 'vault:', 'grim:']) meta.push(...(await db.metaWithPrefix(p)));
  const body = { fed: decodeFederationStores(d.federation), games: d.games, ratingEvents: d.ratingEvents, ratingState: d.ratingState, reports: d.reports, bookmarks: d.bookmarks, meta, counts: await db.recordCounts() };
  return createHash('sha256').update(JSON.stringify(sortKeys(body))).digest('hex');
}
const runner = (db: CrownDB, compute: ComputeMove, extra: Partial<ConstructorParameters<typeof ExhibitionRunner>[0]> = {}) => {
  const r = new ExhibitionRunner({ db, compute, cancel: () => {}, now, ...extra });
  r.paceMs = 0;
  return r;
};

describe('Exhibition Arena: selection', () => {
  it('finds any two distinct competitors at 10,240, including a 0–399 vs 4,000+ mismatch, and pages the lists', async () => {
    const { svc } = await world();
    const all = active(svc);
    expect(all.length).toBeGreaterThan(10_000);
    const t = performance.now();
    const every = filterCompetitors(all, ALL, NO_SETS);
    const ms = performance.now() - t;
    expect(every.length).toBe(all.length);
    expect(ms).toBeLessThan(200);
    expect(pageOf(every, 3, 8).rows).toHaveLength(8);
    const { low, high } = extremes(svc);
    expect(Math.round(low.rating)).toBeLessThan(400);
    expect(Math.round(high.rating)).toBeGreaterThanOrEqual(4000);
    // search by name reaches any competitor
    const byName = filterCompetitors(all, { ...ALL, q: high.name.slice(0, 6) }, NO_SETS);
    expect(byName.some(c => c.id === high.id)).toBe(true);
    const g = newExhibition(low, high, now(), 1);
    expect(g.white.id).toBe(low.id);
    expect(g.black.id).toBe(high.id);
    expect(g.official).toBe(false);
    expect(() => newExhibition(low, low, now())).toThrow(/different/);
  });

  it('each side uses its own profile (profileForStrength at the featured-game node cap) and validated style', async () => {
    const { svc, db } = await world();
    const { low, high } = extremes(svc);
    expect(EXHIBITION_NODE_CAP).toBe(FEATURED_NODE_CAP);
    const sw = sideOf(low), sb = sideOf(high);
    expect(sw.profile).toEqual(profileForStrength(low.latent, FEATURED_NODE_CAP));
    expect(sb.profile).toEqual(profileForStrength(high.latent, FEATURED_NODE_CAP));
    expect(sw.playedStyle).toBe(playStyle(low.style));
    expect(sb.playedStyle).toBe(playStyle(high.style));
    expect(sw.profile.id).not.toBe(sb.profile.id);
    // above the measured range: the strongest budget allowed (the cap), and the UI note says so
    if (high.latent > MEASURED_TOP) expect(sb.profile.nodes).toBe(FEATURED_NODE_CAP);
    expect(strengthNote(high.rating, EXHIBITION_NODE_CAP).kind).toBe('beyond-measured');
    const log: Parameters<typeof fastCompute>[0] = [];
    const r = runner(db, fastCompute(log));
    const g = await r.start(low, high, { seed: 99 });
    await r.settled();
    expect(r.state).toBe('finished');
    for (const e of log!) {
      const side = e.ply % 2 === 0 ? sw : sb;
      expect(e.profile).toBe(side.profile.id);
      expect(e.nodes).toBe(side.profile.nodes);
      expect(e.style).toBe(side.playedStyle);
      expect(e.seed).toBe(plySeed(g.seed, e.ply));
    }
  }, 120_000);
});

describe('Exhibition Arena: play, pause, archive', () => {
  it('completes, pauses without engine work, resumes on the same timeline, and persists across reload and backup', async () => {
    const { f, db, svc } = await world();
    const all = active(svc);
    const a = all[10], b = all[2000];
    // reference: uninterrupted
    const ref = runner(db, fastCompute());
    const g0 = await ref.start(a, b, { seed: 7 });
    await ref.settled();
    const full = ref.game!;
    expect(full.status).toBe('finished');
    expect(full.result).not.toBeNull();
    expect(full.checksum).toBe(await sha256Hex(JSON.stringify({ id: full.id, moves: full.moves.map(m => m.ccn), result: full.result })));
    // interrupted: pause after 6 plies, no engine calls while paused, step, then skip to the end
    let calls = 0, cancels = 0;
    const base = fastCompute();
    let r!: ExhibitionRunner;
    const compute: ComputeMove = async req => { calls++; const out = await base(req); if (req.moves.length === 5) r.pause(); return out; };
    r = runner(db, compute, { cancel: () => { cancels++; } });
    await r.start(a, b, { seed: 7 });
    await r.settled();
    expect(r.state).toBe('paused');
    expect(cancels).toBe(1);
    const n = r.game!.moves.length;
    expect(n).toBe(5); // the reply that arrived after the pause was discarded
    const before = calls;
    await new Promise(res => setTimeout(res, 50));
    expect(calls).toBe(before);
    await r.stepForward();
    expect(r.game!.moves.length).toBe(6);
    await r.finish();
    expect(r.state).toBe('finished');
    expect(r.game!.moves.map(m => m.ccn)).toEqual(full.moves.map(m => m.ccn));
    expect(r.game!.result).toBe(full.result);
    // reload
    const db2 = await CrownDB.open(f);
    const list = await listExhibitions(db2);
    expect(list.map(x => x.id)).toContain(g0.id);
    expect((await loadExhibition(db2, r.game!.id))!.moves).toHaveLength(full.moves.length);
    // backup round trip into an empty save
    const bundle = await exportBundle(db2, 'test');
    expect(bundle.payload.exhibitions!.length).toBe(2);
    const fresh = await CrownDB.open(new IDBFactory());
    await importBundle(fresh, JSON.parse(JSON.stringify(bundle)));
    expect((await listExhibitions(fresh)).map(x => x.id).sort()).toEqual(list.map(x => x.id).sort());
    // a tampered exhibition is rejected
    const bad = JSON.parse(JSON.stringify(bundle));
    const e0 = bad.payload.exhibitions.find((e: { key: string }) => e.key.startsWith('exh:'));
    (e0.value as ExhibitionGame).moves[0].ccn = 'a1a6';
    bad.payloadSha256 = await sha256Hex(JSON.stringify(bad.payload));
    await expect(validateBundle(bad)).rejects.toThrow(/Exhibition/);
    // delete
    await deleteExhibition(db2, g0.id);
    expect((await listExhibitions(db2)).map(x => x.id)).not.toContain(g0.id);
  }, 180_000);
});

describe('Exhibition Arena: isolation', () => {
  it('changes no official record, and the Federation simulation is byte-identical with or without an exhibition', async () => {
    const A = await world(5151), B = await world(5151);
    const advance = async (svc: FederationService, k: number) => { for (let i = 0; i < k; i++) { for (const x of svc.playerFixtures()) await svc.forfeit(x.id); await svc.advanceRound(); } };
    await advance(A.svc, 2); await advance(B.svc, 2);
    const hBefore = await officialHash(B.db);
    expect(await officialHash(A.db)).toBe(hBefore);
    const snap = (svc: FederationService) => JSON.stringify(sortKeys({
      comps: [...svc.state!.competitors.values()].map(c => [c.id, c.rating, c.rd, c.sigma, c.stats, c.titles, c.fedTitle ?? null, c.earnings, c.form, c.history.length]),
      balances: [...svc.state!.balances.entries()], markets: svc.state!.markets.size, world: svc.state!.world, rounds: [...svc.state!.rounds.keys()],
    }));
    const s0 = snap(B.svc);
    // an exhibition in B: the extreme pair, played to the end, analysed through the app's standard queue
    const { low, high } = extremes(B.svc);
    const app = new AppServices(B.db);
    app.fed = B.svc;
    (app as unknown as { exhibitions: ExhibitionRunner }).exhibitions = runner(B.db, fastCompute(), { onFinished: g => { void app.requestExhibitionAnalysis(g.id); } });
    (app as unknown as { analysis: { analyze: unknown; cancel: () => void } }).analysis = {
      cancel: () => {},
      analyze: async (input: Parameters<typeof analyzeGame>[0] & { settings: unknown }) => analyzeGame(input, { ...ANALYSIS_PRESETS[0], id: ANALYSIS_PRESETS[1].id }),
    };
    const g = await app.exhibitions.start(low, high, { seed: 3 });
    await app.exhibitions.settled();
    expect(app.exhibitions.state).toBe('finished');
    for (let i = 0; i < 200 && !(await loadExhibitionReport(B.db, g.id)); i++) await new Promise(res => setTimeout(res, 50));
    const rep = await loadExhibitionReport(B.db, g.id);
    expect(rep?.status).toBe('complete');
    expect(rep!.playedLike).toBeTruthy(); // Played Like for both sides, kept with the exhibition
    // favourite + saved sandbox position on the exhibition
    await B.db.put('bookmarks', { id: `fav:${g.id}`, gameId: g.id, ply: -1, memorable: false, note: '', at: now(), kind: 'favourite' });
    await B.db.put('bookmarks', { id: `pos:${g.id}:3:start`, gameId: g.id, ply: 3, memorable: false, note: '', at: now(), kind: 'position' });
    // official state untouched: ratings/RD, counts, standings, W/L, money, markets, titles
    expect(snap(B.svc)).toBe(s0);
    const d = await B.db.dump();
    expect(d.games).toHaveLength(0);
    expect(d.reports).toHaveLength(0);
    expect(d.ratingEvents).toHaveLength(0);
    expect((await B.db.ratingState('rapid')).games).toBe(0);
    expect(d.federation.worldGames.some(w => (w as { id: string }).id.includes('exh'))).toBe(false);
    expect(d.federation.markets.some(m => JSON.stringify(m).includes('exh:'))).toBe(false);
    // Vault facts ignore exhibition bookmarks; Played Like records are never built for exhibitions
    const facts = buildFacts({ games: [], ratingEvents: [], reports: [], bookmarks: d.bookmarks as { gameId: string; ply: number }[], fed: null });
    expect(facts.bookmarks).toBe(0);
    expect(facts.analyses.complete).toBe(0);
    expect(await backfillPlayedLike(B.db)).toBe(0);
    const fake = { id: g.id, status: 'finalized', humanColor: 'white', playedLike: [], result: g.result, white: { name: 'x' }, black: { name: 'y' } } as unknown as GameRecord;
    expect(needsRecord(fake, [rep!])).toBeNull();
    expect(buildPlayedLikeRecord(fake, rep!, null)).toBeNull();
    // the Replay Library lists it only as an unofficial exhibition (never an upset, final or rivalry)
    const row = exhibitionEntry((await loadExhibition(B.db, g.id))!);
    expect(row.kind).toBe('exhibition');
    expect(filterReplays([row], 'exhibitions', new Set())).toHaveLength(1);
    for (const f of ['upsets', 'finals', 'rivalries', 'personal', 'federation'] as const) expect(filterReplays([row], f, new Set())).toHaveLength(0);
    // the official hash (federation, games, ratings, reports, Vault meta) — bookmarks aside — is unchanged …
    for (const id of [`fav:${g.id}`, `pos:${g.id}:3:start`]) await B.db.remove('bookmarks', id);
    expect(await officialHash(B.db)).toBe(hBefore);
    // … and the season simulation continues identically to the world that never had an exhibition
    await advance(A.svc, 3); await advance(B.svc, 3);
    expect(await officialHash(B.db)).toBe(await officialHash(A.db));
  }, 300_000);
});
