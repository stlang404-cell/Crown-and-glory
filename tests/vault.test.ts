import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../src/games/types';
import type { RatingEvent } from '../src/ratings/ledger';
import type { AnalysisReport } from '../src/analysis/types';
import type { Market, Position } from '../src/exchange/market';
import type { SeasonPlan, RoundRecord } from '../src/federation/world';
import type { Fixture } from '../src/federation/model';
import { buildFacts, materialOf, exchangeStats, type FedInput, type VaultInput } from '../src/vault/facts';
import { VAULT, GRADING_VALIDATED, EXCHANGE_TITLES, earnable, evaluateDef, exchangeTitleEarned, vaultDef, COLLECTIONS } from '../src/vault/catalog';
import { evaluateAll, loadUnlocks, newUnlocks, saveUnlocks, loadToasted, markToasted } from '../src/vault/store';
import { CrownDB } from '../src/storage/db';
import { SHAPES, CHARGES } from '../src/heraldry/charges';
import { MICRO } from '../src/exchange/ledger';
import { chaptersOfBook, chaptersTagged, indexChapters } from '../src/academy/grimoire';

// ---------------------------------------------------------------- synthetic records
const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
let seq = 0;
interface G { id?: string; score?: 1 | 0.5 | 0; color?: 'white' | 'black'; oppId?: string; oppName?: string; myRating?: number | null; oppRating?: number | null; mode?: 'rated' | 'casual' | 'training';
  at?: string; startedAt?: string; termination?: string; level?: number; budgetMs?: number; plies?: number; fens?: string[]; assisted?: boolean; context?: GameRecord['context']; rated?: boolean }
function game(o: G = {}): GameRecord {
  const id = o.id ?? `g${++seq}`;
  const color = o.color ?? 'white';
  const score = o.score ?? 1;
  const result = score === 0.5 ? '1/2-1/2' : (score === 1) === (color === 'white') ? '1-0' : '0-1';
  const at = o.at ?? `2026-01-${String((seq % 28) + 1).padStart(2, '0')}T12:00:00.000Z`;
  const fens = o.fens ?? Array.from({ length: o.plies ?? 12 }, () => START);
  const me = { kind: 'human' as const, id: 'player', name: 'You', rating: o.myRating === undefined ? 1500 : o.myRating, rd: 80 };
  const opp = { kind: 'engine' as const, id: o.oppId ?? 'opp-ines', name: o.oppName ?? (o.oppId ?? 'Ines'), rating: o.oppRating === undefined ? 1400 : o.oppRating, rd: 60,
    engine: { profileId: 'L3', level: o.level ?? 3, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'c', style: 's', ...(o.budgetMs ? { profile: { maxTimeMs: o.budgetMs } as never } : {}) } };
  const rated = o.rated ?? (o.mode ?? 'rated') === 'rated';
  return {
    id, schemaVersion: 1, variantId: 'v', rulesVersion: 'r', adjudicationPolicy: 'a', notationVersion: 'n', initialFen: START,
    mode: o.mode ?? 'rated', status: 'finalized', timeControl: { id: 'rapid', label: 'Rapid', initialMs: 300000, incrementMs: 3000 }, pool: 'rapid', rated,
    humanColor: color, white: color === 'white' ? me : opp, black: color === 'white' ? opp : me,
    createdAt: o.startedAt ?? at, startedAt: o.startedAt ?? at, endedAt: at,
    moves: fens.map((f, i) => ({ ply: i + 1, ccn: 'a2a3', san: 'a3', preHash: '', postHash: '', fenAfter: f, clockBeforeMs: null, clockAfterMs: null, elapsedMs: 1 })),
    assistance: o.assisted ? [{ ply: 1, kind: 'hint', at }] : [], pauses: [], result, termination: (o.termination ?? 'checkmate') as never, clocks: null,
    context: o.context ?? { kind: 'quick-match' }, opening: null, finalizationKey: `final:${id}`, ratingEventId: rated ? `rating:${id}:rapid` : null, reportIds: [], bookmarks: [], checksum: 'x', engineSeed: 1,
  };
}
function ev(o: { gameId?: string; score?: number; at?: string; rating?: number; rd?: number; gamesBefore?: number; oppId?: string; oppRating?: number; before?: number }): RatingEvent {
  const gid = o.gameId ?? `e${++seq}`;
  return {
    id: `rating:${gid}:rapid`, schemaVersion: 1, model: 'm', policy: 'p', pool: 'rapid', sequence: seq, gameId: gid, at: o.at ?? `2026-02-01T00:00:${String(seq % 60).padStart(2, '0')}.${String(seq).padStart(3, '0')}Z`,
    opponent: { id: o.oppId ?? 'opp-ines', name: o.oppId ?? 'Ines', rating: o.oppRating ?? 1500, rd: 60, calibrationId: 'c' }, score: o.score ?? 1, expected: 0.5,
    before: { rating: o.before ?? 1500, rd: 80, sigma: 0.06 }, after: { rating: o.rating ?? 1500, rd: o.rd ?? 80, sigma: 0.06 }, delta: 0, provisionalBefore: false, provisionalAfter: false,
    gamesBefore: o.gamesBefore ?? 30, rankBefore: 'Club', rankAfter: 'Club', explanation: { v: 0, delta: 0, g: 0, tau: 0, iterations: 0 },
  };
}
const seqAt = (i: number) => `2026-03-01T00:00:${String(Math.floor(i / 1000)).padStart(2, '0')}.${String(i % 1000).padStart(3, '0')}Z`;
const streak = (scores: number[]) => scores.map((s, i) => ev({ score: s, at: seqAt(i) }));
function report(gameId: string, deep = false): AnalysisReport {
  return { id: `rep:${gameId}:${++seq}`, gameId, status: 'complete', settings: { id: deep ? 'deep-d9' : 'std-d7' }, completedAt: '2026-04-01T00:00:00Z' } as unknown as AnalysisReport;
}
const comp = (id: string, region: number) => ({ id, region, name: `Name ${id}` });
function market(id: string, o: Partial<Market> = {}): Market {
  return { id, sandbox: false, fixtureId: id, title: `Market ${id}`, white: 'a', black: 'b', season: 1, round: 1, b: 100, q: [0, 0, 0], status: 'settled', subsidy: 0, result: 0,
    forecast: { w: 0.4, d: 0.2, l: 0.4, source: 's' }, history: [], openedAt: '2026-01-01T00:00:00Z', closedAt: null, settledAt: `2026-05-01T00:00:00Z`, gameId: null, ...o };
}
const pos = (marketId: string, pnl: number, shares = 10): Position => ({ id: `${marketId}|player:cash`, marketId, holder: 'player:cash', shares: [shares, 0, 0], spent: 100 * MICRO, received: 100 * MICRO + pnl, fees: 0 });

function fed(o: { player?: Partial<FedInput['world']['player']>; featured?: string[]; season?: number; plans?: SeasonPlan[]; rounds?: RoundRecord[]; competitors?: { id: string; region: number; name: string }[];
  markets?: Market[]; positions?: Position[]; forecasts?: FedInput['extra']['forecasts']; assets?: FedInput['assets'] extends Map<string, infer A> ? A[] : never; points?: FedInput['finance']['points']; peak?: number; sponsors?: string[] } = {}): FedInput {
  return {
    world: { season: o.season ?? 2, round: 1, featured: (o.featured ?? []).map(id => ({ id, tag: 'legend' as const, since: 1 })),
      player: { joined: true, region: 0, division: 8, swissRegistered: false, titles: [], history: [], displaced: null, ...o.player } },
    plans: new Map((o.plans ?? []).map(p => [p.id, p])), rounds: new Map((o.rounds ?? []).map(r => [r.id, r])),
    competitors: new Map((o.competitors ?? [comp('c1', 1)]).map(c => [c.id, c])),
    markets: new Map((o.markets ?? []).map(m => [m.id, m])), positions: new Map((o.positions ?? []).map(p => [p.id, p])),
    assets: new Map((o.assets ?? []).map(a => [a.id, a])), finance: { points: o.points ?? [], peak: o.peak ?? 0 },
    extra: { sponsorsPaid: o.sponsors ?? [], forecasts: o.forecasts ?? [] },
  };
}
const facts = (i: Partial<VaultInput>) => buildFacts({ games: [], ratingEvents: [], reports: [], ...i });
const earned = (id: string, i: Partial<VaultInput>) => evaluateDef(vaultDef(id)!, facts(i)).earned;
const wins = (n: number, o: (i: number) => G = () => ({})) => Array.from({ length: n }, (_, i) => game({ oppId: `o${i}`, ...o(i) }));
const DOWN_ROOK = 'rnqknr/pppppp/6/6/PPPPPP/1NQKNR w - - 0 1';
const LOST_PAWN = 'rnqknr/pppppp/6/6/1PPPPP/RNQKNR w - - 0 1';
const leagueFixtures = (season: number, scores: number[]): RoundRecord[] => scores.map((s, i) => ({ id: `${season}:${i + 1}`, season, round: i + 1, status: 'done', processedAt: 'x', abstract: [],
  fixtures: [{ id: `${season}:${i + 1}:league:0:8:0`, season, round: i + 1, event: 'league:0:8', white: 'player', black: `c${i}`, result: s, tier: 1, gameId: `fed-${season}-${i}` } as Fixture] }));
const plan = (season: number, o: Partial<SeasonPlan> = {}): SeasonPlan => ({ id: `season:${season}`, season, circuits: [], swiss: [], champ: null, club: null, status: 'complete', ...o });
/** Forecasts that beat the recorded market price by `edge` (Brier units); `markets` settle on outcome 0. */
function forecasts(n: number, edge: number, o: { family?: Market['kind']; season?: number; prefix?: string } = {}) {
  const ms: Market[] = [], fs: FedInput['extra']['forecasts'] = [];
  for (let i = 0; i < n; i++) {
    const id = `${o.prefix ?? 'f'}${i}`;
    ms.push(market(id, { kind: o.family ?? 'match', season: o.season ?? 1 }));
    const price = [0.5, 0.25, 0.25];
    // price Brier = 0.375; choose p0 so that your Brier = 0.375 - edge (p = [p0, (1-p0)/2, (1-p0)/2])
    const p0 = 1 - Math.sqrt((0.375 - edge) / 1.5);
    fs.push({ marketId: id, probs: [p0, (1 - p0) / 2, (1 - p0) / 2], at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`, outcome: null, prices: price, model: price });
  }
  return { ms, fs };
}

// ---------------------------------------------------------------- positive scenario per implemented achievement
const RATED_COLOURS = [...wins(10, i => ({ color: 'white', id: `w${i}` })), ...wins(10, i => ({ color: 'black', id: `b${i}`, oppId: `ob${i}` }))];
const establishedTo = (ratings: number[]) => ratings.map((r, i) => ev({ rating: r, rd: 80, gamesBefore: 25 + i, at: seqAt(i) }));
const REGIONS16 = Array.from({ length: 16 }, (_, r) => comp(`r${r}`, r));
const ps = (n: number, pnl: (i: number) => number, o: (i: number) => Partial<Market> = () => ({})) => {
  const ms = Array.from({ length: n }, (_, i) => market(`m${i}-${JSON.stringify(o(i))}`, o(i)));
  return { markets: ms, positions: ms.map((m, i) => pos(m.id, pnl(i))) };
};
// Grimoire lesson records: chapter completions and first-try exercise sessions
const grimDone = (ids: string[]) => ids.map((chapterId, i) => ({ chapterId, book: +chapterId.slice(1, chapterId.indexOf('-')), at: seqAt(i) }));
const grimFirstTry = (ids: string[]) => ids.map((exerciseId, i) => ({ id: `${exerciseId}:s`, exerciseId, chapterId: exerciseId.split('/')[0], outcome: 'first-try' as const, solved: true, at: seqAt(i) }));
const grim = (chapters: string[], firstTry: string[] = []): Partial<VaultInput> => ({ grimoire: { completions: grimDone(chapters), attempts: grimFirstTry(firstTry) } });
const bookIds = (...books: number[]) => books.flatMap(b => chaptersOfBook(b).map(c => c.id));
const SCENARIOS: Record<string, () => Partial<VaultInput>> = {
  'first-win': () => ({ games: [game()] }),
  'first-draw': () => ({ games: [game({ score: 0.5 })] }),
  'wins-10': () => ({ games: wins(10) }), 'wins-50': () => ({ games: wins(50) }), 'wins-100': () => ({ games: wins(100) }),
  'wins-500': () => ({ games: wins(500) }), 'wins-1000': () => ({ games: wins(1000) }),
  'first-mate': () => ({ games: [game({ termination: 'checkmate' })] }),
  'clean-sheet': () => ({ games: [game({ plies: 20 })] }),
  comeback: () => ({ games: [game({ fens: [START, DOWN_ROOK, DOWN_ROOK] })] }),
  'upset-higher': () => ({ games: [game({ myRating: 1500, oppRating: 1501 })] }),
  'giant-slayer': () => ({ games: [game({ myRating: 1500, oppRating: 1700 })] }),
  'titan-slayer': () => ({ games: [game({ myRating: 1500, oppRating: 2000 })] }),
  'sovereign-unbound': () => ({ games: [game({ level: 9, budgetMs: 10_000 })] }),
  'sovereign-deep': () => ({ games: [game({ level: 9, budgetMs: 30_000 })] }),
  'streak-10': () => ({ ratingEvents: streak([1, 0.5, 1, 1, 0.5, 1, 1, 1, 0.5, 1]) }),
  'streak-25': () => ({ ratingEvents: streak(Array(25).fill(0.5)) }),
  'all-colours': () => ({ games: RATED_COLOURS, ratingEvents: RATED_COLOURS.map(g => ev({ gameId: g.id, score: 1 })) }),
  'analyses-10': () => { const gs = wins(10); return { games: gs, reports: gs.map(g => report(g.id)) }; },
  'analyses-100': () => { const gs = wins(100); return { games: gs, reports: gs.map(g => report(g.id)) }; },
  'deep-review': () => { const gs = wins(10); return { games: gs, reports: gs.map(g => report(g.id, true)) }; },
  'bookmarks-25': () => ({ bookmarks: Array.from({ length: 25 }, (_, i) => ({ gameId: 'g', ply: i })) }),
  'retry-master': () => ({ games: wins(5, i => ({ mode: 'training', context: { kind: 'training-retry', sourceGameId: 'src', sourcePly: i } })) }),
  'first-title': () => ({ ratingEvents: establishedTo([1234]) }),
  ...Object.fromEntries([500, 1000, 1500, 2000, 2500, 3000].map(n => [`rating-${n}`, () => ({ ratingEvents: establishedTo([n + 5]) })])),
  'insignias-10': () => ({ ratingEvents: establishedTo([800, 1799]) }),
  'insignias-20': () => ({ ratingEvents: establishedTo([0, 1999]) }),
  'insignias-31': () => ({ ratingEvents: establishedTo([0, 3100]) }),
  promotion: () => ({ fed: fed({ player: { history: [{ season: 1, division: 8, rank: 1, points: 30 }], division: 7 } }) }),
  'league-title': () => ({ fed: fed({ player: { titles: [{ season: 1, title: 'Open Division champion (1) S1' }] } }) }),
  'crown-division': () => ({ fed: fed({ player: { division: 1 } }) }),
  champion: () => ({ fed: fed({ player: { titles: [{ season: 3, title: 'Joint Crown Champion S3' }] } }) }),
  'title-defence': () => ({ fed: fed({ player: { titles: [{ season: 3, title: 'Crown Champion S3' }, { season: 4, title: 'Crown Champion S4' }] } }) }),
  'relegation-recovery': () => ({ fed: fed({ player: { history: [{ season: 1, division: 5, rank: 15, points: 3 }, { season: 2, division: 6, rank: 1, points: 30 }], division: 5 } }) }),
  norm: () => ({ fed: fed({ player: { norms: [{ event: 'League', season: 1, games: 15, score: 12, avgOpp: 1600, tpr: 2000, tier: 'Knight' }] } }) }),
  'fed-knight': () => ({ fed: fed({ player: { fedTitle: 'Knight' } }) }),
  'fed-paladin': () => ({ fed: fed({ player: { fedTitle: 'Paladin' } }) }),
  'fed-sovereign': () => ({ fed: fed({ player: { fedTitle: 'Sovereign' } }) }),
  'rival-first': () => ({ games: [game({ oppId: 'c1' })], fed: fed({ featured: ['c1'] }) }),
  'rival-bo5': () => ({ games: [1, 1, 0, 1, 1].map(s => game({ oppId: 'c1', score: s as 0 | 1 })), fed: fed() }),
  'regions-8': () => ({ games: REGIONS16.slice(0, 8).map(c => game({ oppId: c.id })), fed: fed({ competitors: REGIONS16 }) }),
  'regions-16': () => ({ games: REGIONS16.map(c => game({ oppId: c.id })), fed: fed({ competitors: REGIONS16 }) }),
  revenge: () => ({ games: [0, 0, 0, 1].map((s, i) => game({ oppId: 'c1', score: s as 0 | 1, at: seqAt(i) })), fed: fed() }),
  nemesis: () => ({ games: wins(10, i => ({ oppId: 'c1', at: `2026-06-${String(i + 1).padStart(2, '0')}T10:00:00Z` })), fed: fed() }),
  'upset-feud': () => ({ games: [game({ oppId: 'c1', oppRating: 1800 }), game({ oppId: 'c1', oppRating: 1750 })], fed: fed({ featured: ['c1'] }) }),
  'qm-first': () => ({ games: [game({ id: 'qm-c1-1', oppId: 'c1', mode: 'casual', myRating: null, oppRating: null })], fed: fed() }),
  'qm-giant': () => ({ games: [game({ id: 'qm-c1-2', oppId: 'c1', oppRating: 1700 })], fed: fed() }),
  'qm-titan': () => ({ games: [game({ id: 'qm-c1-3', oppId: 'c1', oppRating: 2000 })], fed: fed() }),
  'qm-regions-8': () => ({ games: REGIONS16.slice(0, 8).map((c, i) => game({ id: `qm-${c.id}-${i}`, oppId: c.id })), fed: fed({ competitors: REGIONS16 }) }),
  'event-first': () => ({ fed: fed({ plans: [plan(1, { status: 'active', swiss: [{ event: 'challenger', name: 'Challenger Open', entrants: ['player', 'c1'], seeds: {}, byes: {}, rounds: [] }] })] }) }),
  'swiss-podium': () => ({ fed: fed({
    plans: [plan(1, { swiss: [{ event: 'open', name: 'Federation Open', entrants: ['player', 'a', 'b', 'c'], seeds: { player: 1, a: 2, b: 3, c: 4 }, byes: {}, rounds: [] }] })],
    rounds: [{ id: '1:4', season: 1, round: 4, status: 'done', processedAt: 'x', abstract: [['open', 'a', 'b', 1]], fixtures: [{ id: '1:4:open:0', season: 1, round: 4, event: 'open', white: 'player', black: 'c', result: 1, tier: 1, gameId: 'g' }] }] }) }),
  semi: () => ({ fed: fed({ plans: [plan(1, { champ: { name: 'champ', qualifiers: [], seeds: {}, champions: [], stages: [{ round: 18, label: 'Semifinal', matches: [{ a: 'player', b: 'c1', seedA: 1, seedB: 4, games: [], winner: null, joint: false, decidedBy: null }] }] } })] }) }),
  final: () => ({ fed: fed({ plans: [plan(1, { club: { name: 'club', qualifiers: [], seeds: {}, champions: [], stages: [{ round: 19, label: 'Final', matches: [{ a: 'c1', b: 'player', seedA: 1, seedB: 2, games: [], winner: null, joint: false, decidedBy: null }] }] } })] }) }),
  'event-win': () => ({ fed: fed({ player: { titles: [{ season: 1, title: 'Challenger Open winner S1' }] } }) }),
  'club-weekend': () => ({ fed: fed({ plans: [plan(1, { club: { name: 'club', qualifiers: [], seeds: {}, champions: ['player'], stages: [] } })] }) }),
  'forecast-upset': () => ({ fed: fed({ markets: [market('u1', { result: 2 })], forecasts: [{ marketId: 'u1', probs: [0.2, 0.2, 0.6], at: 'x', outcome: null, prices: [0.5, 0.25, 0.25] }] }) }),
  'trade-first': () => ({ fed: fed({ markets: [market('t1')], positions: [pos('t1', -5 * MICRO)] }) }),
  'win-forecast': () => ({ fed: fed({ markets: [market('t1')], positions: [pos('t1', 5 * MICRO)] }) }),
  'season-profit': () => ({ fed: fed(ps(10, i => (i === 0 ? -20 : 5) * MICRO)) }),
  'recover-trading': () => ({ fed: fed(ps(10, i => (i < 5 ? -5 : 5) * MICRO, i => ({ season: i < 5 ? 1 : 2 }))) }),
  'market-variety': () => ({ fed: fed(ps(5, () => 5 * MICRO, i => ({ kind: (['match', 'winner', 'promotion', 'qualification', 'season'] as const)[i] }))) }),
  forecaster: () => { const { ms, fs } = forecasts(10, 0.05); return { fed: fed({ markets: ms, forecasts: fs }) }; },
  'calibrated-100': () => { const { ms, fs } = forecasts(100, 0.05); return { fed: fed({ markets: ms, forecasts: fs }) }; },
  specialist: () => { const { ms, fs } = forecasts(30, 0.05, { family: 'winner' }); return { fed: fed({ markets: ms, forecasts: fs }) }; },
  patron: () => ({ fed: fed({ assets: [{ id: 'club', typeId: 'club', acquiredSeason: 1, suspended: false, upkeepPaidSeason: 1 }] }) }),
  'club-level-3': () => ({ fed: fed({ assets: [{ id: 'club', typeId: 'club', acquiredSeason: 1, suspended: false, upkeepPaidSeason: 1, level: 3 }] }) }),
  'networth-5k': () => ({ fed: fed({ peak: 5_000 * MICRO }) }),
  'networth-25k': () => ({ fed: fed(), netWorthNow: 25_000 * MICRO }),
  'networth-100k': () => ({ fed: fed({ points: [{ netWorth: 100_000 * MICRO, at: 'x', season: 1, round: 1 }] }) }),
  'near-ruin': () => ({ fed: fed({ points: [{ netWorth: 50 * MICRO, at: '2026-01-01', season: 1, round: 1 }, { netWorth: 1_000 * MICRO, at: '2026-02-01', season: 1, round: 5 }] }) }),
  'academy-set': () => ({ trainingRuns: [{ endedAt: 'x', attempted: 10 }] }),
  'puzzles-100': () => ({ attempts: Array.from({ length: 100 }, (_, i) => ({ puzzleId: `p${i}`, solved: true, clean: true })) }),
  'puzzles-500': () => ({ attempts: Array.from({ length: 500 }, (_, i) => ({ puzzleId: `p${i}`, solved: true, clean: true })) }),
  'first-lesson': () => grim([indexChapters()[0].id]),
  'apprentice-graduate': () => grim(bookIds(1)),
  'tactical-scholar': () => grim(bookIds(2)),
  'fork-specialist': () => grim([], chaptersTagged('fork').flatMap(c => c.exercises)),
  'endgame-apprentice': () => grim(chaptersTagged('endgame').map(c => c.id)),
  'calculation-adept': () => { const chs = chaptersTagged('calculation'); return grim(chs.map(c => c.id), chs.flatMap(c => c.exercises)); },
  'academy-graduate': () => grim(bookIds(1, 2, 3, 4)),
  'sovereign-trial': () => grim(bookIds(5)),
  'full-season': () => ({ fed: fed({ player: { history: [{ season: 1, division: 8, rank: 5, points: 20 }] }, rounds: leagueFixtures(1, Array(15).fill(0)) }) }),
  'ten-seasons': () => ({ fed: fed({ player: { history: Array.from({ length: 10 }, (_, i) => ({ season: i + 1, division: 8, rank: 9, points: 10 })) } }) }),
  'comeback-run': () => ({ ratingEvents: streak([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]) }),
  'night-owl': () => ({ games: [game({ startedAt: new Date(2026, 0, 5, 2, 30).toISOString(), at: new Date(2026, 0, 5, 3, 10).toISOString() })] }),
  'perfect-promotion': () => ({ fed: fed({ player: { history: [{ season: 1, division: 8, rank: 1, points: 40 }], division: 7 }, rounds: leagueFixtures(1, [...Array(14).fill(1), 0.5]) }) }),
};

describe('Vault catalog', () => {
  it('has at least 40 earnable achievements, the 8 legacy ids, 31 insignias and the 9-step Exchange ladder', () => {
    const ach = VAULT.filter(d => d.kind === 'achievement' && earnable(d));
    expect(ach.length).toBeGreaterThanOrEqual(40);
    for (const id of ['first-win', 'promotion', 'league-title', 'swiss-podium', 'giant-slayer', 'norm', 'forecaster', 'patron']) expect(vaultDef(id)).toBeTruthy();
    expect(VAULT.filter(d => d.kind === 'insignia')).toHaveLength(31);
    expect(VAULT.filter(d => d.kind === 'exchange-title').map(d => d.name)).toEqual(['Apprentice Forecaster', 'Odds Scholar', 'Market Diviner', 'Odds Alchemist', 'Hedge Wizard', 'Grand Speculator', 'Oracle of the Exchange', 'Crown Marketmaker', 'Sovereign of Probability']);
    expect(new Set(VAULT.map(d => d.id)).size).toBe(VAULT.length);
    for (const d of VAULT) {
      expect(COLLECTIONS).toContain(d.collection);
      expect(SHAPES[d.art.shape]).toBeTruthy();
      if (d.art.charge) expect(CHARGES[d.art.charge]).toBeTruthy();
      expect(d.rule.length).toBeGreaterThan(10);
    }
  });
  it('a fresh career earns nothing', () => {
    const r = evaluateAll(VAULT, facts({}));
    expect([...r].filter(([, x]) => x.earned).map(([id]) => id)).toEqual([]);
    const r2 = evaluateAll(VAULT, facts({ fed: fed() }));
    expect([...r2].filter(([, x]) => x.earned).map(([id]) => id)).toEqual([]);
  });
  it('every implemented crown-vault-1 achievement has a positive scenario (crown-vault-2: tests/vault-expansion.test.ts)', () => {
    const ids = VAULT.filter(d => d.kind === 'achievement' && earnable(d) && d.since === 'crown-vault-1').map(d => d.id);
    expect(ids.filter(id => !SCENARIOS[id])).toEqual([]);
  });
  for (const [id, mk] of Object.entries(SCENARIOS)) {
    it(`facts → earned: ${id}`, () => { expect(earned(id, mk())).toBe(true); });
  }
});

describe('Vault rules: negatives and anti-exploit', () => {
  it('assisted, abandoned, training and unfinished games never count as wins', () => {
    expect(earned('first-win', { games: [game({ assisted: true })] })).toBe(false);
    expect(earned('first-win', { games: [game({ termination: 'abandoned' })] })).toBe(false);
    expect(earned('first-win', { games: [game({ mode: 'training' })] })).toBe(false);
    expect(earned('first-win', { games: [{ ...game(), status: 'active' }] })).toBe(false);
    expect(earned('first-win', { games: [game({ score: 0 })] })).toBe(false);
  });
  it('win counters count an opponent once per day', () => {
    const same = wins(10, () => ({ oppId: 'opp-mira', at: '2026-07-01T10:00:00Z' }));
    expect(earned('wins-10', { games: same })).toBe(false);
    expect(evaluateDef(vaultDef('wins-10')!, facts({ games: same })).progress).toEqual({ have: 1, need: 10 });
    const days = wins(10, i => ({ oppId: 'opp-mira', at: `2026-07-${String(i + 1).padStart(2, '0')}T10:00:00Z` }));
    expect(earned('wins-10', { games: days })).toBe(true);
  });
  it('rating gaps use the recorded snapshots and need both ratings', () => {
    expect(earned('giant-slayer', { games: [game({ myRating: 1500, oppRating: 1699 })] })).toBe(false);
    expect(earned('giant-slayer', { games: [game({ myRating: null, oppRating: 2400, mode: 'casual' })] })).toBe(false);
    expect(earned('titan-slayer', { games: [game({ myRating: 1500, oppRating: 1999 })] })).toBe(false);
    expect(earned('upset-higher', { games: [game({ myRating: 1500, oppRating: 1500 })] })).toBe(false);
  });
  it('Sovereign Unbound needs level 9 at the rated budget or more', () => {
    expect(earned('sovereign-unbound', { games: [game({ level: 9, budgetMs: 5_000 })] })).toBe(false);
    expect(earned('sovereign-unbound', { games: [game({ level: 8, budgetMs: 10_000 })] })).toBe(false);
    expect(earned('sovereign-deep', { games: [game({ level: 9, budgetMs: 15_000 })] })).toBe(false);
  });
  it('material rules read the FEN after every move', () => {
    expect(materialOf(START)).toEqual({ white: { n: 12, v: 2 * (5 + 3) + 9 + 6 }, black: { n: 12, v: 31 } });
    expect(earned('clean-sheet', { games: [game({ fens: [...Array(19).fill(START), LOST_PAWN] })] })).toBe(false);
    expect(earned('clean-sheet', { games: [game({ plies: 19 })] })).toBe(false);
    expect(earned('comeback', { games: [game({ fens: [START, LOST_PAWN] })] })).toBe(false);
  });
  it('a loss breaks an unbeaten streak; streaks come from rating events in order', () => {
    expect(earned('streak-10', { ratingEvents: streak([1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1]) })).toBe(false);
    expect(earned('comeback-run', { ratingEvents: streak([0, 0, 0, 0, 1, 1, 1, 1, 1]) })).toBe(false);
  });
  it('re-analysing a game counts it once', () => {
    const g = wins(9);
    expect(earned('analyses-10', { games: g, reports: [...g.map(x => report(x.id)), report(g[0].id), report(g[1].id, true)] })).toBe(false);
  });
  it('Quick Match collectibles need a real Federation competitor', () => {
    expect(earned('qm-first', { games: [game({ id: 'qm-x', oppId: 'opp-mira' })], fed: fed() })).toBe(false);
    expect(earned('qm-giant', { games: [game({ id: 'qm-c1-9', oppId: 'c1', oppRating: 1700, mode: 'casual', rated: false })], fed: fed() })).toBe(false);
  });
  it('rival counters respect the once-per-day rule; revenge needs three straight losses', () => {
    expect(earned('nemesis', { games: wins(10, () => ({ oppId: 'c1', at: '2026-06-01T10:00:00Z' })), fed: fed() })).toBe(false);
    expect(earned('revenge', { games: [0, 1, 0, 0, 1].map((s, i) => game({ oppId: 'c1', score: s as 0 | 1, at: seqAt(i) })), fed: fed() })).toBe(false);
    expect(earned('rival-bo5', { games: [1, 1, 1, 1].map(s => game({ oppId: 'c1', score: s as 0 | 1 })), fed: fed() })).toBe(false);
  });
  it('Federation titles are cumulative but exact', () => {
    expect(earned('fed-knight', { fed: fed({ player: { fedTitle: 'Squire' } }) })).toBe(false);
    expect(earned('fed-paladin', { fed: fed({ player: { fedTitle: 'Knight' } }) })).toBe(false);
    expect(earned('fed-knight', { fed: fed({ player: { fedTitle: 'Sovereign' } }) })).toBe(true);
  });
  it('provisional ratings never collect insignias or thresholds', () => {
    const prov = [ev({ rating: 2600, rd: 200, gamesBefore: 5 })];
    expect(earned('rating-2500', { ratingEvents: prov })).toBe(false);
    expect(earned('insignia-2600', { ratingEvents: prov })).toBe(false);
    expect(earned('insignia-2600', { ratingEvents: establishedTo([2650]) })).toBe(true);
  });
  it('settled positions need shares held at settlement, official markets only', () => {
    expect(earned('trade-first', { fed: fed({ markets: [market('t1')], positions: [pos('t1', 5 * MICRO, 0)] }) })).toBe(false);
    expect(earned('trade-first', { fed: fed({ markets: [market('t1', { sandbox: true })], positions: [pos('t1', 5 * MICRO)] }) })).toBe(false);
    expect(earned('trade-first', { fed: fed({ markets: [market('t1', { status: 'open' })], positions: [pos('t1', 5 * MICRO)] }) })).toBe(false);
    expect(earned('season-profit', { fed: fed(ps(9, () => 5 * MICRO)) })).toBe(false);
  });
  it('a forecast that matches the market is not an upset call', () => {
    expect(earned('forecast-upset', { fed: fed({ markets: [market('u1', { result: 0 })], forecasts: [{ marketId: 'u1', probs: [0.6, 0.2, 0.2], at: 'x', outcome: null, prices: [0.5, 0.25, 0.25] }] }) })).toBe(false);
  });
  it('the current season plan wins over a stale copy in the plans map (registration just committed)', () => {
    const stale = plan(2, { status: 'active', swiss: [{ event: 'challenger', name: 'Challenger Open', entrants: ['c1'], seeds: {}, byes: {}, rounds: [] }] });
    const fresh = { ...stale, swiss: [{ ...stale.swiss[0], entrants: ['player'] }] };
    expect(earned('event-first', { fed: fed({ plans: [stale] }) })).toBe(false);
    expect(earned('event-first', { fed: { ...fed({ plans: [stale] }), plan: fresh } })).toBe(true);
  });
  it('a Swiss podium needs a completed event', () => {
    const s = SCENARIOS['swiss-podium']().fed!;
    const active = { ...s, world: { ...s.world, season: 1 }, plans: new Map([...s.plans].map(([k, p]) => [k, { ...p, status: 'active' as const }])) };
    expect(earned('swiss-podium', { fed: active })).toBe(false);
  });
  it('a forfeit spoils a full season; a league loss spoils an unbeaten promotion', () => {
    const r = leagueFixtures(1, Array(15).fill(1)); r[3].fixtures[0].forfeit = true;
    expect(earned('full-season', { fed: fed({ player: { history: [{ season: 1, division: 8, rank: 1, points: 40 }] }, rounds: r }) })).toBe(false);
    expect(earned('perfect-promotion', { fed: fed({ player: { history: [{ season: 1, division: 8, rank: 1, points: 40 }], division: 7 }, rounds: leagueFixtures(1, [...Array(14).fill(1), 0]) }) })).toBe(false);
  });
});

describe('Vault secrets and grading', () => {
  it('secret collectibles exist and their rules are only shown once earned (UI masks by state)', () => {
    const secret = VAULT.filter(d => d.secret && d.since === 'crown-vault-1').map(d => d.id).sort();
    expect(secret).toEqual(['all-collections', 'comeback-run', 'night-owl', 'perfect-promotion']);
  });
  it('Brilliant and grading-based collectibles are never earned while grading is experimental', () => {
    expect(GRADING_VALIDATED).toBe(false);
    const graded = VAULT.filter(d => d.requiresValidatedGrading);
    expect(graded.map(d => d.id)).toEqual(expect.arrayContaining(['brilliant-1', 'brilliant-5', 'brilliant-25', 'brilliant-100', 'brilliant-up', 'brilliant-final', 'defence-critical', 'accuracy-90', 'played-like-high', 'played-like-steady']));
    for (const d of graded) expect(earnable(d)).toBe(false);
    // even a definition whose rule would pass is not awarded
    const forced = { ...graded[0], evaluate: () => ({ earned: true }) };
    expect(evaluateDef(forced, facts({})).earned).toBe(false);
    // and the full evaluation over a rich history awards none of them
    const all = Object.values(SCENARIOS).reduce<Partial<VaultInput>>((a, mk) => ({ ...a, ...mk() }), {});
    const r = evaluateAll(VAULT, facts(all));
    for (const d of graded) expect(r.get(d.id)!.earned).toBe(false);
  });
});

describe('Exchange title ladder', () => {
  const title = (id: string) => EXCHANGE_TITLES.find(t => t.id === id)!;
  const xt = (id: string, f: Partial<VaultInput>) => exchangeTitleEarned(title(id), facts(f)).earned;
  it('forecast-only tiers need a sample and skill against the market price', () => {
    const one = forecasts(1, 0.3);
    expect(xt('xt-apprentice-forecaster', { fed: fed({ markets: one.ms, forecasts: one.fs }) })).toBe(false);
    const ten = forecasts(10, 0);
    expect(xt('xt-apprentice-forecaster', { fed: fed({ markets: ten.ms, forecasts: ten.fs }) })).toBe(true);
    expect(xt('xt-odds-scholar', { fed: fed({ markets: ten.ms, forecasts: ten.fs }) })).toBe(false);
    const thirtyEven = forecasts(30, 0);
    expect(xt('xt-odds-scholar', { fed: fed({ markets: thirtyEven.ms, forecasts: thirtyEven.fs }) })).toBe(true);
    expect(xt('xt-market-diviner', { fed: fed({ markets: thirtyEven.ms, forecasts: thirtyEven.fs }) })).toBe(false);
    const worse = forecasts(30, -0.1);
    expect(xt('xt-apprentice-forecaster', { fed: fed({ markets: worse.ms, forecasts: worse.fs }) })).toBe(false);
  });
  it('one lucky position never qualifies a P&L tier', () => {
    const f = forecasts(30, 0.05);
    const lucky = ps(10, i => (i === 0 ? 1_000 : -50) * MICRO);
    const input = { fed: fed({ markets: [...f.ms, ...lucky.markets], forecasts: f.fs, positions: lucky.positions }) };
    expect(exchangeStats(facts(input).fed).pnl).toBe(550 * MICRO);
    expect(xt('xt-market-diviner', input)).toBe(true);
    expect(xt('xt-odds-alchemist', input)).toBe(false);
    const steady = ps(10, () => 20 * MICRO);
    expect(xt('xt-odds-alchemist', { fed: fed({ markets: [...f.ms, ...steady.markets], forecasts: f.fs, positions: steady.positions }) })).toBe(true);
    // a single huge win across too few markets fails too
    const few = ps(9, () => 500 * MICRO);
    expect(xt('xt-odds-alchemist', { fed: fed({ markets: [...f.ms, ...few.markets], forecasts: f.fs, positions: few.positions }) })).toBe(false);
  });
  it('volume alone never qualifies: many positions without forecast skill fail', () => {
    const many = ps(200, () => 100 * MICRO, i => ({ kind: (['match', 'winner', 'promotion', 'qualification', 'season'] as const)[i % 5], season: 1 + (i % 6) }));
    expect(EXCHANGE_TITLES.some(t => xt(t.id, { fed: fed(many) }))).toBe(false);
  });
  it('the top title is reachable with skill, breadth and steady profit', () => {
    const f = forecasts(250, 0.08);
    const steady = ps(120, () => 60 * MICRO, i => ({ kind: (['match', 'winner', 'promotion', 'qualification', 'season'] as const)[i % 5], season: 1 + (i % 6) }));
    const input = { fed: fed({ markets: [...f.ms, ...steady.markets], forecasts: f.fs, positions: steady.positions }) };
    for (const t of EXCHANGE_TITLES) expect(xt(t.id, input), t.id).toBe(true);
  });
});

describe('Vault store (IndexedDB meta, put-if-absent)', () => {
  const open = async () => CrownDB.open(new IDBFactory(), `vault-${Math.random()}`);
  it('unlocking twice keeps one record; re-evaluation after a rating drop keeps ownership', async () => {
    const db = await open();
    const high = facts({ ratingEvents: establishedTo([2050]) });
    let owned = await loadUnlocks(db);
    const r1 = evaluateAll(VAULT, high);
    expect(r1.get('rating-2000')!.earned).toBe(true);
    const w1 = await saveUnlocks(db, newUnlocks(r1, owned, '2026-11-01T00:00:00Z', true));
    expect(w1.map(u => u.id)).toEqual(expect.arrayContaining(['rating-2000', 'insignia-2000', 'first-title']));
    // the same unlocks again (e.g. a second tab or a retry): nothing is written, nothing duplicated
    const again = await saveUnlocks(db, newUnlocks(r1, new Map(), '2026-11-02T00:00:00Z', false));
    expect(again).toEqual([]);
    owned = await loadUnlocks(db);
    expect(owned.size).toBe(w1.length);
    expect(owned.get('rating-2000')!.at).toBe('2026-11-01T00:00:00Z');
    // the rating later falls: rules no longer pass, but nothing is removed
    const low = facts({ ratingEvents: [ev({ rating: 1200, rd: 80, gamesBefore: 25 })] });
    const r2 = evaluateAll(VAULT, low);
    expect(r2.get('rating-2000')!.earned).toBe(false);
    await saveUnlocks(db, newUnlocks(r2, owned, '2026-11-03T00:00:00Z', false));
    const after = await loadUnlocks(db);
    expect(after.has('rating-2000')).toBe(true);
    expect(after.get('rating-2000')!.at).toBe('2026-11-01T00:00:00Z');
    expect(after.has('insignia-1200')).toBe(true); // the newly reached band is added
    db.close();
  });
  it('unlock notices are remembered once', async () => {
    const db = await open();
    await markToasted(db, ['first-win'], 'x');
    await markToasted(db, ['first-win', 'first-draw'], 'y');
    expect([...(await loadToasted(db))].sort()).toEqual(['first-draw', 'first-win']);
    expect(await db.metaWithPrefix('achtoast:')).toHaveLength(2);
    db.close();
  });
});
