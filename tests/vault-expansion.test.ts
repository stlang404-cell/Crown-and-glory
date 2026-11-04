/**
 * Sovereign Vault crown-vault-2 (v0.11): families and tiers, every new predicate (positive and negative), the
 * anti-farming rules, idempotency across reloads and the migration of a v0.9 save (crown-vault-1 unlocks kept,
 * expansion back-filled without notices).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../src/games/types';
import type { RatingEvent } from '../src/ratings/ledger';
import type { AnalysisReport } from '../src/analysis/types';
import type { Market, Position } from '../src/exchange/market';
import { buildFacts, calibrationStats, drawdownRecovery, qualifiedWins, winStreak, DAILY_CAP, type FedInput, type VaultInput } from '../src/vault/facts';
import { VAULT, VAULT_ID, VAULT_V1_COUNT, earnable, evaluateDef, vaultDef } from '../src/vault/catalog';
import { FAMILIES, TIER_OF_RARITY } from '../src/vault/families';
import { BACKFILL_KEY, BACKFILL_V2_KEY, evaluateAll, loadUnlocks, UNLOCK_PREFIX, type UnlockRecord } from '../src/vault/store';
import { VaultService, type VaultHost } from '../src/vault/service';
import { CrownDB } from '../src/storage/db';
import { MICRO } from '../src/exchange/ledger';
import { chaptersOfBook } from '../src/academy/grimoire';
import { PLAYED_LIKE_ID, PLAYED_LIKE_VALIDATED } from '../src/analysis/playedLike';

// ---------------------------------------------------------------- synthetic records
const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const DOWN3 = 'rnqknr/pppppp/6/6/PPPPPP/R1QKNR w - - 0 1'; // White without a knight: −3
const DOWN6 = 'rnqknr/pppppp/6/6/PPPPPP/R1QK1R w - - 0 1'; // −6
const DOWN9 = 'rnqknr/pppppp/6/6/PPPPPP/RN1KNR w - - 0 1'; // −9
const ENDING = 'k5/pp4/6/6/PP4/K4R w - - 0 1'; // one rook left
let seq = 0;
const dayN = (n: number) => new Date(Date.UTC(2025, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);
interface G { id?: string; score?: 1 | 0.5 | 0; color?: 'white' | 'black'; oppId?: string; myRating?: number | null; oppRating?: number | null; mode?: 'rated' | 'casual' | 'training';
  at?: string; termination?: string; plies?: number; fens?: string[]; ccns?: string[]; assisted?: boolean; context?: GameRecord['context']; oppKind?: 'engine' | 'human';
  pl?: { rating: number; moves?: number; capped?: boolean; modelId?: string; confidence?: 'adequate' | 'low' } }
function game(o: G = {}): GameRecord {
  const n = ++seq;
  const id = o.id ?? `g${n}`;
  const color = o.color ?? 'white';
  const score = o.score ?? 1;
  const result = score === 0.5 ? '1/2-1/2' : (score === 1) === (color === 'white') ? '1-0' : '0-1';
  const at = o.at ?? `${dayN(n)}T12:00:00.000Z`;
  const len = Math.max(o.plies ?? 12, o.fens?.length ?? 0, o.ccns?.length ?? 0);
  const fens = Array.from({ length: len }, (_, i) => o.fens?.[i] ?? o.fens?.[o.fens.length - 1] ?? START);
  const me = { kind: 'human' as const, id: 'player', name: 'You', rating: o.myRating === undefined ? 1500 : o.myRating, rd: 80 };
  const oppId = o.oppId ?? `opp${n}`;
  const opp = { kind: (o.oppKind ?? 'engine') as 'engine', id: oppId, name: oppId, rating: o.oppRating === undefined ? 1500 : o.oppRating, rd: 60,
    engine: { profileId: 'L3', level: 3, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'c', style: 's' } };
  const rated = (o.mode ?? 'rated') === 'rated';
  return {
    id, schemaVersion: 1, variantId: 'v', rulesVersion: 'r', adjudicationPolicy: 'a', notationVersion: 'n', initialFen: START,
    mode: o.mode ?? 'rated', status: 'finalized', timeControl: { id: 'rapid', label: 'Rapid', initialMs: 300000, incrementMs: 3000 }, pool: 'rapid', rated,
    humanColor: color, white: color === 'white' ? me : opp, black: color === 'white' ? opp : me,
    createdAt: at, startedAt: at, endedAt: at,
    moves: fens.map((f, i) => ({ ply: i + 1, ccn: o.ccns?.[i] ?? 'a2a3', san: 'a3', preHash: '', postHash: '', fenAfter: f, clockBeforeMs: null, clockAfterMs: null, elapsedMs: 1 })),
    assistance: o.assisted ? [{ ply: 1, kind: 'hint', at }] : [], pauses: [], result, termination: (o.termination ?? 'resignation') as never, clocks: null,
    context: o.context ?? { kind: 'quick-match' }, opening: null,
    ...(o.pl ? { playedLike: [{ schema: 'crown-pl-record-1' as const, modelId: o.pl.modelId ?? PLAYED_LIKE_ID, reportId: 'r', gameId: id, at, recordedAt: at, pov: color, opponent: { id: oppId, name: oppId }, result: score, pool: 'rapid', career: null,
      estimate: { status: 'ok' as const, rating: o.pl.rating, low: o.pl.rating - 150, high: o.pl.rating + 150, low95: o.pl.rating - 250, high95: o.pl.rating + 250, half80: 150, sd: 117, moves: o.pl.moves ?? 20, capped: !!o.pl.capped, modelId: o.pl.modelId ?? PLAYED_LIKE_ID },
      confidence: o.pl.confidence ?? 'adequate' }] } : {}), finalizationKey: `final:${id}`, ratingEventId: rated ? `rating:${id}:rapid` : null, reportIds: [], bookmarks: [], checksum: 'x', engineSeed: 1,
  };
}
const seqAt = (i: number) => `2026-03-01T00:00:${String(Math.floor(i / 1000)).padStart(2, '0')}.${String(i % 1000).padStart(3, '0')}Z`;
function ev(o: { score?: number; at?: string; rating?: number; rd?: number; gamesBefore?: number; oppId?: string; oppRating?: number; before?: number; gameId?: string }): RatingEvent {
  const n = ++seq, gid = o.gameId ?? `e${n}`;
  return {
    id: `rating:${gid}:rapid`, schemaVersion: 1, model: 'm', policy: 'p', pool: 'rapid', sequence: seq, gameId: gid, at: o.at ?? seqAt(n),
    opponent: { id: o.oppId ?? `eo${n}`, name: o.oppId ?? 'Opp', rating: o.oppRating ?? 1500, rd: 60, calibrationId: 'c' }, score: o.score ?? 1, expected: 0.5,
    before: { rating: o.before ?? 1500, rd: 80, sigma: 0.06 }, after: { rating: o.rating ?? 1500, rd: o.rd ?? 80, sigma: 0.06 }, delta: 0, provisionalBefore: false, provisionalAfter: false,
    gamesBefore: o.gamesBefore ?? 30, rankBefore: 'Club', rankAfter: 'Club', explanation: { v: 0, delta: 0, g: 0, tau: 0, iterations: 0 },
  };
}
const report = (gameId: string): AnalysisReport => ({ id: `rep:${gameId}:${++seq}`, gameId, status: 'complete', settings: { id: 'std-d7' }, completedAt: '2026-04-01T00:00:00Z' } as unknown as AnalysisReport);
const comp = (id: string, region: number) => ({ id, region, name: `Name ${id}` });
function market(id: string, o: Partial<Market> = {}): Market {
  return { id, sandbox: false, fixtureId: id, title: `Market ${id}`, white: 'a', black: 'b', season: 1, round: 1, b: 100, q: [0, 0, 0], status: 'settled', subsidy: 0, result: 0,
    forecast: { w: 0.4, d: 0.2, l: 0.4, source: 's' }, history: [], openedAt: '2026-01-01T00:00:00Z', closedAt: null, settledAt: '2026-05-01T00:00:00Z', gameId: null, ...o };
}
const pos = (marketId: string, pnl: number): Position => ({ id: `${marketId}|player:cash`, marketId, holder: 'player:cash', shares: [10, 0, 0], spent: 100 * MICRO, received: 100 * MICRO + pnl, fees: 0 });
function fed(o: { player?: Partial<FedInput['world']['player']>; featured?: string[]; competitors?: { id: string; region: number; name: string }[]; regions?: number;
  markets?: Market[]; positions?: Position[]; forecasts?: FedInput['extra']['forecasts']; points?: FedInput['finance']['points'] } = {}): FedInput {
  return {
    world: { season: 2, round: 1, featured: (o.featured ?? []).map(id => ({ id, tag: 'legend' as const, since: 1 })), ...(o.regions ? { topology: { regions: o.regions } } : {}),
      player: { joined: true, region: 0, division: 8, swissRegistered: false, titles: [], history: [], displaced: null, ...o.player } },
    plans: new Map(), rounds: new Map(), competitors: new Map((o.competitors ?? [comp('c1', 1)]).map(c => [c.id, c])),
    markets: new Map((o.markets ?? []).map(m => [m.id, m])), positions: new Map((o.positions ?? []).map(p => [p.id, p])),
    assets: new Map(), finance: { points: o.points ?? [], peak: 0 }, extra: { sponsorsPaid: [], forecasts: o.forecasts ?? [] },
  };
}
const facts = (i: Partial<VaultInput>) => buildFacts({ games: [], ratingEvents: [], reports: [], ...i });
const run = (id: string, i: Partial<VaultInput>) => evaluateDef(vaultDef(id)!, facts(i));
const earned = (id: string, i: Partial<VaultInput>) => run(id, i).earned;
/** n rated wins against distinct opponents on distinct days. */
const wins = (n: number, o: (i: number) => G = () => ({})) => Array.from({ length: n }, () => 0).map((_, i) => game({ ...o(i) }));
const winEvents = (n: number, o: (i: number) => Parameters<typeof ev>[0] = () => ({})) => Array.from({ length: n }, (_, i) => ev({ at: seqAt(i), ...o(i) }));
const established = (ratings: number[]) => ratings.map((r, i) => ev({ rating: r, rd: 80, gamesBefore: 25 + i, at: seqAt(i) }));
const pts = (usd: number[]) => usd.map((u, i) => ({ netWorth: u * MICRO, at: seqAt(i), season: 1, round: i + 1 }));
const ps = (n: number, pnl: (i: number) => number, season: (i: number) => number = () => 1) => {
  const ms = Array.from({ length: n }, (_, i) => market(`pm${i}-${season(i)}`, { season: season(i) }));
  return { markets: ms, positions: ms.map((m, i) => pos(m.id, pnl(i) * MICRO)) };
};
/** n resolved forecasts [0.5, 0.25, 0.25] whose outcomes happen 50/25/25 % of the time (perfectly calibrated), priced flat. */
function calibrated(n: number, probs = [0.5, 0.25, 0.25]) {
  const ms: Market[] = [], fs: FedInput['extra']['forecasts'] = [];
  for (let i = 0; i < n; i++) {
    const id = `cf${i}`;
    ms.push(market(id, { result: i % 4 === 0 || i % 4 === 1 ? 0 : i % 4 === 2 ? 1 : 2 }));
    fs.push({ marketId: id, probs, at: seqAt(i), outcome: null, prices: [1 / 3, 1 / 3, 1 / 3] });
  }
  return { markets: ms, forecasts: fs };
}
const grimDone = (ids: string[]) => ids.map((chapterId, i) => ({ chapterId, book: +chapterId.slice(1, chapterId.indexOf('-')), at: seqAt(i) }));
const bookIds = (...books: number[]) => books.flatMap(b => chaptersOfBook(b).map(c => c.id));
const firstTry = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `x${i}:s`, exerciseId: `ch/x${i}`, chapterId: 'ch', outcome: 'first-try' as const, solved: true, at: seqAt(i) }));
const REGIONS80 = Array.from({ length: 80 }, (_, r) => comp(`r${r}`, r));
const vsComps = (cs: { id: string }[], o: (i: number) => G = () => ({})) => cs.map((c, i) => game({ oppId: c.id, ...o(i) }));

// ---------------------------------------------------------------- positive scenario per crown-vault-2 achievement
const SCENARIOS: Record<string, () => Partial<VaultInput>> = {
  'mates-10': () => ({ games: wins(10, () => ({ termination: 'checkmate' })) }),
  'mates-50': () => ({ games: wins(50, () => ({ termination: 'checkmate' })) }),
  'pl-1200': () => ({ games: [game({ score: 0, pl: { rating: 1250 }, oppRating: 400 })] }),
  'pl-1800': () => ({ games: [game({ score: 0.5, pl: { rating: 1800 }, oppRating: 1000 })] }),
  'pl-2400': () => ({ games: [game({ pl: { rating: 2450 }, oppRating: 1700 })] }),
  'pl-3000': () => ({ games: [game({ pl: { rating: 3010 }, oppRating: 2300 })] }),
  miniature: () => ({ games: [game({ termination: 'checkmate', plies: 30, oppRating: 1400 })] }),
  'sacrificial-mate': () => ({ games: [game({ termination: 'checkmate', fens: [START, DOWN3], oppRating: 1300 })] }),
  'puzzles-25': () => ({ attempts: Array.from({ length: 25 }, (_, i) => ({ puzzleId: `p${i}`, solved: true, clean: true })) }),
  fortress: () => ({ games: [game({ score: 0.5, fens: [START, DOWN3, DOWN3, DOWN3, DOWN3, START] })] }),
  'hold-the-line': () => ({ games: [game({ score: 0.5, oppRating: 1800 })] }),
  'against-odds': () => ({ games: [game({ fens: [START, DOWN6, DOWN6, DOWN6, DOWN6, START] })] }),
  miracle: () => ({ games: [game({ fens: [START, DOWN9, DOWN9, DOWN9, DOWN9, START], oppRating: 1500 })] }),
  'endgame-5': () => ({ games: wins(5, () => ({ fens: [START, ENDING] })) }),
  'endgame-25': () => ({ games: wins(25, () => ({ fens: [START, ENDING] })) }),
  'endgame-100': () => ({ games: wins(100, () => ({ fens: [START, ENDING] })) }),
  'crowned-pawn': () => ({ games: [game({ ccns: ['a5a6q'] })] }),
  'endgame-giant': () => ({ games: [game({ fens: [START, ENDING], oppRating: 1700 })] }),
  'upsets-5': () => ({ games: wins(5, () => ({ oppRating: 1600 })) }),
  'upsets-25': () => ({ games: wins(25, () => ({ oppRating: 1650 })) }),
  colossus: () => ({ games: [game({ myRating: 700, oppRating: 1500 })] }),
  'winstreak-5': () => ({ ratingEvents: winEvents(5) }),
  'winstreak-10': () => ({ ratingEvents: winEvents(10) }),
  'winstreak-20': () => ({ ratingEvents: winEvents(20) }),
  'winstreak-40': () => ({ ratingEvents: winEvents(40) }),
  'rating-3500': () => ({ ratingEvents: established([3200, 3505]) }),
  'rating-4000': () => ({ ratingEvents: established([3800, 4010]) }),
  'climb-200': () => ({ ratingEvents: established([400, 600]) }),
  'climb-500': () => ({ ratingEvents: established([400, 700, 900]) }),
  'climb-1000': () => ({ ratingEvents: established([300, 1300]) }),
  'division-masters': () => ({ fed: fed({ player: { division: 4 } }) }),
  'promotions-3': () => ({ fed: fed({ player: { history: [8, 7, 6].map((d, i) => ({ season: i + 1, division: d, rank: 1, points: 30 })), division: 5 } }) }),
  'titles-3': () => ({ fed: fed({ player: { titles: [1, 2, 3].map(s => ({ season: s, title: `Open Division champion (North) S${s}` })) } }) }),
  'titles-10': () => ({ fed: fed({ player: { titles: Array.from({ length: 10 }, (_, s) => ({ season: s + 1, title: `Open Division champion (North) S${s + 1}` })) } }) }),
  'titles-25': () => ({ fed: fed({ player: { titles: Array.from({ length: 25 }, (_, s) => ({ season: s + 1, title: `Challenger Open winner S${s + 1}` })) } }) }),
  'season-double': () => ({ fed: fed({ player: { titles: [{ season: 2, title: 'Club Division champion (North) S2' }, { season: 2, title: 'Challenger Open winner S2' }] } }) }),
  'triple-crown': () => ({ fed: fed({ player: { titles: [{ season: 1, title: 'Open Division champion (North) S1' }, { season: 2, title: 'Federation Open winner S2' }, { season: 3, title: 'Crown Champion S3' }] } }) }),
  'rivals-ahead-3': () => { const cs = [comp('c1', 1), comp('c2', 2), comp('c3', 3)]; return { games: cs.flatMap(c => [1, 1, 0].map(s => game({ oppId: c.id, score: s as 0 | 1 }))), fed: fed({ competitors: cs }) }; },
  'rivals-ahead-10': () => { const cs = REGIONS80.slice(0, 10); return { games: cs.flatMap(c => [1, 0.5, 1].map(s => game({ oppId: c.id, score: s as 1 | 0.5 }))), fed: fed({ competitors: cs }) }; },
  'long-rivalry': () => ({ games: Array.from({ length: 15 }, (_, i) => game({ oppId: 'c1', score: (i % 3) as 0 | 1 })), fed: fed() }),
  'featured-sweep': () => { const cs = [comp('c1', 1), comp('c2', 2), comp('c3', 3)]; return { games: vsComps(cs), fed: fed({ competitors: cs, featured: ['c1', 'c2', 'c3'] }) }; },
  'home-region': () => { const cs = Array.from({ length: 5 }, (_, i) => comp(`h${i}`, 0)); return { games: vsComps(cs), fed: fed({ competitors: cs }) }; },
  'regions-32': () => ({ games: vsComps(REGIONS80.slice(0, 32)), fed: fed({ competitors: REGIONS80, regions: 80 }) }),
  'regions-80': () => ({ games: vsComps(REGIONS80), fed: fed({ competitors: REGIONS80, regions: 80 }) }),
  'strategist-graduate': () => ({ grimoire: { completions: grimDone(bookIds(3)), attempts: [] } }),
  'oracle-reader': () => ({ grimoire: { completions: grimDone(bookIds(6)), attempts: [] } }),
  'grimoire-complete': () => ({ grimoire: { completions: grimDone(bookIds(1, 2, 3, 4, 5, 6)), attempts: [] } }),
  'first-try-25': () => ({ grimoire: { completions: [], attempts: firstTry(25) } }),
  'first-try-100': () => ({ grimoire: { completions: [], attempts: firstTry(100) } }),
  'calibration-30': () => ({ fed: fed(calibrated(32)) }),
  'calibration-100': () => ({ fed: fed(calibrated(100)) }),
  'calibration-250': () => ({ fed: fed(calibrated(252)) }),
  'pnl-1k': () => ({ fed: fed(ps(10, () => 200)) }),
  'pnl-10k': () => ({ fed: fed(ps(40, () => 400)) }),
  'profit-seasons-3': () => ({ fed: fed(ps(15, () => 5, i => 1 + Math.floor(i / 5))) }),
  'profit-seasons-10': () => ({ fed: fed(ps(50, () => 5, i => 1 + Math.floor(i / 5))) }),
  'weathered-storm': () => ({ fed: fed({ points: pts([1000, 2000, 1300, 2100]) }) }),
  'second-fortune': () => ({ fed: fed({ points: pts([10_000, 3_900, 10_001]) }) }),
  'from-ashes': () => ({ fed: fed({ points: pts([1000, 50, 10_000]) }) }),
  'days-7': () => ({ games: wins(7, () => ({ score: 0 })) }),
  'days-30': () => ({ games: wins(30, () => ({ score: 0.5 })) }),
  'days-100': () => ({ games: wins(100) }),
  'days-365': () => ({ games: wins(365) }),
  'seasons-3': () => ({ fed: fed({ player: { history: [1, 2, 3].map(s => ({ season: s, division: 8, rank: 9, points: 10 })) } }) }),
  'seasons-25': () => ({ fed: fed({ player: { history: Array.from({ length: 25 }, (_, s) => ({ season: s + 1, division: 8, rank: 9, points: 10 })) } }) }),
  'analyses-300': () => { const gs = wins(300, () => ({ plies: 20 })); return { games: gs, reports: gs.map(g => report(g.id)) }; },
  'lessons-defeat': () => { const gs = wins(10, () => ({ score: 0 })); return { games: gs, reports: gs.map(g => report(g.id)) }; },
  'retry-25': () => ({ games: wins(25, i => ({ mode: 'training', context: { kind: 'training-retry', sourceGameId: 'src', sourcePly: i } })) }),
  'stalemate-swindle': () => ({ games: [game({ score: 0.5, termination: 'stalemate', fens: [START, DOWN3] })] }),
  'humble-crown': () => ({ games: [game({ ccns: ['a2a3', 'a5a4', 'a5a6n'] })] }),
  marathon: () => ({ games: [game({ plies: 200 })] }),
  anniversary: () => ({ games: [game({ at: '2025-03-04T10:00:00Z' }), game({ at: '2026-03-04T18:00:00Z' })] }),
};

describe('crown-vault-2 catalog: preservation, families and tiers', () => {
  it('keeps every crown-vault-1 collectible byte for byte (ids, names, rules, rarity, collection, order)', () => {
    const v1 = JSON.parse(readFileSync(new URL('./fixtures/vault-v1-catalog.json', import.meta.url), 'utf8')) as { id: string }[];
    expect(v1).toHaveLength(VAULT_V1_COUNT);
    const now = VAULT.slice(0, v1.length).map(d => ({ id: d.id, name: d.name, collection: d.collection, rarity: d.rarity, kind: d.kind, description: d.description, rule: d.rule, secret: !!d.secret, grading: !!d.requiresValidatedGrading }));
    // v0.11 (docs/CAREER_RATING.md): five rating-gap rules gained one clause — they count only while your rating is
    // established, so a provisional 0-start career cannot farm "upsets". Everything else stays byte for byte.
    const CLARIFIED = new Set(['upset-higher', 'giant-slayer', 'titan-slayer', 'qm-giant', 'qm-titan']);
    const CLAUSE = ' Counts only while your rating is established (±100 or less).';
    for (const [i, d] of now.entries()) if (CLARIFIED.has(d.id)) {
      expect(d.rule).toBe(`${(v1[i] as { rule: string }).rule}${CLAUSE}`);
      now[i] = { ...d, rule: (v1[i] as { rule: string }).rule };
    }
    expect(now).toEqual(v1);
    expect(VAULT.slice(0, v1.length).every(d => d.since === 'crown-vault-1')).toBe(true);
    expect(VAULT.slice(v1.length).every(d => d.since === 'crown-vault-2')).toBe(true);
  });
  it('counts: 142 → 214 collectibles; 102 → 174 achievements (72 new, all earnable); 9 titles and 31 insignias unchanged', () => {
    expect(VAULT).toHaveLength(214);
    expect(VAULT.filter(d => d.kind === 'achievement')).toHaveLength(174);
    const added = VAULT.filter(d => d.since === 'crown-vault-2');
    expect(added).toHaveLength(72);
    expect(PLAYED_LIKE_VALIDATED).toBe(true);
    expect(added.every(d => d.kind === 'achievement' && earnable(d) && !d.requiresValidatedGrading)).toBe(true);
    expect(added.filter(d => d.requiresValidatedPlayedLike).map(d => d.id)).toEqual(['pl-1200', 'pl-1800', 'pl-2400', 'pl-3000']);
    expect(VAULT.filter(d => d.kind === 'exchange-title')).toHaveLength(9);
    expect(VAULT.filter(d => d.kind === 'insignia')).toHaveLength(31);
    expect(VAULT.filter(d => d.kind === 'achievement' && earnable(d))).toHaveLength(163);
    expect(new Set(VAULT.map(d => d.id)).size).toBe(VAULT.length);
    expect(VAULT_ID).toBe('crown-vault-2');
  });
  it('every collectible has one family and the tier its rarity implies; every family is populated', () => {
    const ids = new Set(FAMILIES.map(f => f.id));
    for (const d of VAULT) { expect(ids.has(d.family), d.id).toBe(true); expect(d.tier).toBe(TIER_OF_RARITY[d.rarity]); }
    for (const f of FAMILIES) expect(VAULT.some(d => d.family === f.id), f.id).toBe(true);
    for (const f of ['mastery', 'tactics', 'defence', 'endgames', 'tournaments', 'upsets', 'streaks', 'ratings', 'rivalries', 'regions', 'grimoire', 'forecasting', 'exchange', 'recovery', 'longevity', 'analysis', 'secrets']) expect(ids.has(f as never)).toBe(true);
    // the new families each offer at least one Bronze-to-Gold path
    for (const f of ['defence', 'endgames', 'streaks', 'forecasting', 'recovery', 'longevity']) expect(new Set(VAULT.filter(d => d.family === f).map(d => d.tier)).size, f).toBeGreaterThanOrEqual(3);
  });
  it('no new achievement depends on move grading (the Brilliant-move set stays awaiting validated grading)', () => {
    for (const d of VAULT.filter(x => x.since === 'crown-vault-2')) expect(/brilliant|accuracy/i.test(d.rule), d.id).toBe(false);
    // the crown-vault-1 Played Like entries are unchanged and still wait for validated move grading
    for (const id of ['played-like-high', 'played-like-steady']) expect(earnable(vaultDef(id)!)).toBe(false);
  });
  it('every crown-vault-2 achievement has a positive scenario', () => {
    expect(VAULT.filter(d => d.since === 'crown-vault-2').map(d => d.id).filter(id => !SCENARIOS[id])).toEqual([]);
  });
  for (const [id, mk] of Object.entries(SCENARIOS)) it(`facts → earned: ${id}`, () => { const r = run(id, mk()); expect(r.earned).toBe(true); });
  it('a fresh career earns nothing new', () => {
    const r = evaluateAll(VAULT, facts({ fed: fed() }));
    expect([...r].filter(([, x]) => x.earned).map(([id]) => id)).toEqual([]);
  });
});

describe('crown-vault-2 negatives (each predicate)', () => {
  it('Played Like: only counted estimates of the validated model, unassisted rated games, worthy opponents', () => {
    expect(earned('pl-1800', { games: [game({ pl: { rating: 1799 }, oppRating: 1200 })] })).toBe(false);
    expect(earned('pl-1800', { games: [game({ pl: { rating: 1900, moves: 14, confidence: 'low' }, oppRating: 1200 })] })).toBe(false);
    expect(earned('pl-1800', { games: [game({ pl: { rating: 1900, modelId: 'crown-played-like-1' }, oppRating: 1200 })] })).toBe(false);
    expect(earned('pl-3000', { games: [game({ pl: { rating: 3038, capped: true }, oppRating: 2500 })] })).toBe(false);
    expect(earned('pl-1800', { games: [game({ pl: { rating: 1900 }, oppRating: 999 })] })).toBe(false);
    expect(earned('pl-1800', { games: [game({ pl: { rating: 1900 }, oppRating: 1200, mode: 'casual' })] })).toBe(false);
    expect(earned('pl-1800', { games: [game({ pl: { rating: 1900 }, oppRating: 1200, assisted: true })] })).toBe(false);
    expect(earned('pl-1800', { games: [game({ pl: { rating: 1900 }, oppRating: 1200, myRating: null })] })).toBe(true); // a career rating is not needed
  });
  it('mastery and tactics', () => {
    expect(earned('mates-10', { games: wins(9, () => ({ termination: 'checkmate' })) })).toBe(false);
    expect(earned('mates-10', { games: wins(10) })).toBe(false); // resignations are not mates
    expect(earned('miniature', { games: [game({ termination: 'checkmate', plies: 31, oppRating: 1400 })] })).toBe(false);
    expect(earned('miniature', { games: [game({ termination: 'checkmate', plies: 20, oppRating: 1399 })] })).toBe(false);
    expect(earned('sacrificial-mate', { games: [game({ termination: 'checkmate', fens: [DOWN3, START] })] })).toBe(false); // material level at the end
    expect(earned('sacrificial-mate', { games: [game({ termination: 'checkmate', fens: [START, DOWN3], oppRating: 1299 })] })).toBe(false);
    expect(earned('puzzles-25', { attempts: Array.from({ length: 25 }, (_, i) => ({ puzzleId: `p${i % 24}`, solved: true, clean: true })) })).toBe(false);
  });
  it('defence: a capture-recapture dip is not a sustained deficit', () => {
    const dip = [START, DOWN9, START, DOWN9, START, DOWN9, START];
    expect(earned('miracle', { games: [game({ fens: dip })] })).toBe(false);
    expect(earned('miracle', { games: [game({ fens: [START, DOWN9, DOWN9, DOWN9, START] })] })).toBe(false); // only 3 plies
    expect(earned('miracle', { games: [game({ fens: [START, DOWN9, DOWN9, DOWN9, DOWN9], oppRating: 1499 })] })).toBe(false);
    expect(earned('against-odds', { games: [game({ fens: [START, DOWN3, DOWN3, DOWN3, DOWN3] })] })).toBe(false);
    expect(earned('fortress', { games: [game({ score: 1, fens: [START, DOWN3, DOWN3, DOWN3, DOWN3] })] })).toBe(false);
    expect(earned('hold-the-line', { games: [game({ score: 0.5, oppRating: 1799 })] })).toBe(false);
    expect(earned('hold-the-line', { games: [game({ score: 0.5, myRating: null, oppRating: 2400 })] })).toBe(false);
  });
  it('endgames', () => {
    expect(earned('endgame-5', { games: wins(5) })).toBe(false);
    expect(earned('crowned-pawn', { games: [game({ ccns: ['a2a3', 'a5a6q'] })] })).toBe(false); // the opponent promoted
    expect(earned('crowned-pawn', { games: [game({ score: 0, ccns: ['a5a6q'] })] })).toBe(false);
    expect(earned('endgame-giant', { games: [game({ fens: [START, ENDING], oppRating: 1699 })] })).toBe(false);
  });
  it('upsets need distinct opponents', () => {
    expect(earned('upsets-5', { games: wins(5, () => ({ oppId: 'same', oppRating: 1700 })) })).toBe(false);
    expect(earned('upsets-5', { games: wins(5, () => ({ oppRating: 1599 })) })).toBe(false);
    expect(earned('colossus', { games: [game({ myRating: 700, oppRating: 1499 })] })).toBe(false);
  });
  it('win streaks: a draw or loss ends the run; weak and same-day repeat wins are skipped', () => {
    expect(earned('winstreak-5', { ratingEvents: winEvents(6, i => ({ score: i === 3 ? 0.5 : 1 })) })).toBe(false);
    const weak = winEvents(5, i => ({ oppRating: i === 2 ? 1000 : 1500, before: 1500 }));
    expect(winStreak(facts({ ratingEvents: weak }).rated, 5).best).toBe(4);
    const repeat = winEvents(5, i => ({ oppId: i < 2 ? 'same' : `o${i}` }));
    expect(winStreak(facts({ ratingEvents: repeat }).rated, 5).best).toBe(4);
    expect(earned('winstreak-5', { ratingEvents: [...weak, ev({ at: seqAt(999) })] })).toBe(true); // skipped, not broken
  });
  it('rating milestones and climbs read established ratings only', () => {
    expect(earned('rating-3500', { ratingEvents: [ev({ rating: 3600, rd: 200, gamesBefore: 3 })] })).toBe(false);
    expect(earned('rating-4000', { ratingEvents: established([3999]) })).toBe(false);
    // provisional peak above the first established rating does not count
    expect(earned('climb-200', { ratingEvents: [ev({ rating: 900, rd: 200, gamesBefore: 3, at: seqAt(1) }), ev({ rating: 700, gamesBefore: 25, at: seqAt(2) }), ev({ rating: 899, gamesBefore: 26, at: seqAt(3) })] })).toBe(false);
    expect(run('climb-500', { ratingEvents: established([400, 700]) }).progress).toEqual({ have: 300, need: 500 });
  });
  it('federation and tournaments', () => {
    expect(earned('division-masters', { fed: fed({ player: { division: 5 } }) })).toBe(false);
    expect(earned('promotions-3', { fed: fed({ player: { history: [8, 7].map((d, i) => ({ season: i + 1, division: d, rank: 1, points: 30 })), division: 6 } }) })).toBe(false);
    expect(earned('titles-3', { fed: fed({ player: { titles: [{ season: 1, title: 'Crown Champion S1' }, { season: 2, title: 'Crown Champion S2' }] } }) })).toBe(false);
    expect(earned('season-double', { fed: fed({ player: { titles: [{ season: 1, title: 'Crown Champion S1' }, { season: 2, title: 'Crown Champion S2' }] } }) })).toBe(false);
    expect(earned('triple-crown', { fed: fed({ player: { titles: [{ season: 1, title: 'Open Division champion (North) S1' }, { season: 2, title: 'Federation Open winner S2' }] } }) })).toBe(false);
  });
  it('rivalries: once per opponent per day, weak wins ignored, at least three featured rivals', () => {
    const same = { games: [1, 1, 1].map(() => game({ oppId: 'c1', at: '2026-05-05T10:00:00Z' })), fed: fed() };
    expect(earned('rivals-ahead-3', same)).toBe(false);
    const cs = [comp('c1', 1), comp('c2', 2), comp('c3', 3)];
    expect(earned('rivals-ahead-3', { games: cs.flatMap(c => [1, 1, 0].map(s => game({ oppId: c.id, score: s as 0 | 1, oppRating: 1000 }))), fed: fed({ competitors: cs }) })).toBe(false);
    expect(earned('rivals-ahead-3', { games: cs.flatMap(c => [1, 1, 0].map(s => game({ oppId: c.id, score: s as 0 | 1, mode: 'casual' }))), fed: fed({ competitors: cs }) })).toBe(false);
    expect(earned('long-rivalry', { games: Array.from({ length: 15 }, () => game({ oppId: 'c1', at: '2026-05-05T10:00:00Z' })), fed: fed() })).toBe(false);
    expect(earned('featured-sweep', { games: vsComps(cs.slice(0, 2)), fed: fed({ competitors: cs, featured: ['c1', 'c2'] }) })).toBe(false);
    expect(earned('featured-sweep', { games: vsComps(cs.slice(0, 2)), fed: fed({ competitors: cs, featured: ['c1', 'c2', 'c3'] }) })).toBe(false);
  });
  it('regional conquest', () => {
    const away = Array.from({ length: 5 }, (_, i) => comp(`a${i}`, 3));
    expect(earned('home-region', { games: vsComps(away), fed: fed({ competitors: away }) })).toBe(false);
    expect(earned('regions-32', { games: vsComps(REGIONS80.slice(0, 31)), fed: fed({ competitors: REGIONS80, regions: 80 }) })).toBe(false);
    expect(run('regions-80', { games: vsComps(REGIONS80.slice(0, 16)), fed: fed({ competitors: REGIONS80.slice(0, 16) }) }).progress).toEqual({ have: 16, need: 80 });
    expect(earned('regions-32', { games: vsComps(REGIONS80.slice(0, 32), () => ({ mode: 'casual' })), fed: fed({ competitors: REGIONS80, regions: 80 }) })).toBe(false);
  });
  it('Grimoire: an incomplete book or a re-solve after a failure does not count', () => {
    expect(earned('strategist-graduate', { grimoire: { completions: grimDone(bookIds(3).slice(1)), attempts: [] } })).toBe(false);
    expect(earned('grimoire-complete', { grimoire: { completions: grimDone(bookIds(1, 2, 3, 4, 5)), attempts: [] } })).toBe(false);
    const failedFirst = firstTry(25).flatMap((a, i) => [{ ...a, id: `${a.id}0`, outcome: 'failed' as never, solved: false, at: seqAt(i) }, { ...a, at: seqAt(500 + i) }]);
    expect(earned('first-try-25', { grimoire: { completions: [], attempts: failedFirst } })).toBe(false);
  });
  it('calibration: overconfidence fails, re-forecasting a market adds nothing, worse than the market fails', () => {
    expect(earned('calibration-30', { fed: fed(calibrated(32, [0.9, 0.05, 0.05])) })).toBe(false);
    const c = calibrated(20); const again = { markets: c.markets, forecasts: [...c.forecasts, ...c.forecasts.map(f => ({ ...f, at: seqAt(900) }))] };
    expect(calibrationStats(facts({ fed: fed(again) }).fed!.scored).n).toBe(20);
    expect(earned('calibration-30', { fed: fed(again) })).toBe(false);
    // calibrated but no better than a sharper market price
    const sharp = calibrated(100); sharp.forecasts.forEach((f, i) => { f.prices = sharp.markets[i].result === 0 ? [0.9, 0.05, 0.05] : sharp.markets[i].result === 1 ? [0.05, 0.9, 0.05] : [0.05, 0.05, 0.9]; });
    expect(earned('calibration-100', { fed: fed(sharp) })).toBe(false);
    expect(earned('calibration-250', { fed: fed(calibrated(248)) })).toBe(false);
  });
  it('exchange profit: one lucky market never qualifies; sandbox never counts; seasons need 5 positions', () => {
    expect(earned('pnl-1k', { fed: fed(ps(10, i => (i === 0 ? 5000 : -10))) })).toBe(false);
    expect(earned('pnl-1k', { fed: fed(ps(9, () => 500)) })).toBe(false);
    const sb = ps(10, () => 200); sb.markets.forEach(m => { m.sandbox = true; });
    expect(earned('pnl-1k', { fed: fed(sb) })).toBe(false);
    expect(earned('profit-seasons-3', { fed: fed(ps(12, () => 5, i => 1 + Math.floor(i / 4))) })).toBe(false);
  });
  it('financial recovery: the drop, the peak floor and a new high are all required', () => {
    expect(earned('weathered-storm', { fed: fed({ points: pts([2000, 1500, 2100]) }) })).toBe(false); // −25 %
    expect(earned('weathered-storm', { fed: fed({ points: pts([1900, 1000, 2500]) }) })).toBe(false); // peak below $2,000
    expect(earned('weathered-storm', { fed: fed({ points: pts([2000, 1300, 2000]) }) })).toBe(false); // back to, not above, the peak
    expect(drawdownRecovery(pts([5000, 4000, 3000, 6000]).map(p => ({ netWorth: p.netWorth, at: p.at })), 2000 * MICRO, 0.3)?.peak).toBe(5000 * MICRO);
    expect(earned('from-ashes', { fed: fed({ points: pts([50, 9_999]) }) })).toBe(false);
    expect(earned('second-fortune', { fed: fed({ points: pts([10_000, 4_100, 12_000]) }) })).toBe(false);
  });
  it('longevity counts distinct days of rated games; seasons are exact', () => {
    expect(earned('days-7', { games: wins(7, () => ({ at: '2026-05-05T10:00:00Z' })) })).toBe(false);
    expect(earned('days-7', { games: wins(7, () => ({ mode: 'casual' })) })).toBe(false);
    expect(earned('seasons-3', { fed: fed({ player: { history: [1, 2].map(s => ({ season: s, division: 8, rank: 9, points: 10 })) } }) })).toBe(false);
  });
  it('analysis: short games, casual losses and re-analysis do not count', () => {
    const short = wins(300, () => ({ plies: 19 }));
    expect(earned('analyses-300', { games: short, reports: short.map(g => report(g.id)) })).toBe(false);
    const casual = wins(10, () => ({ score: 0, mode: 'casual' }));
    expect(earned('lessons-defeat', { games: casual, reports: casual.map(g => report(g.id)) })).toBe(false);
    const nine = wins(9, () => ({ score: 0 }));
    expect(earned('lessons-defeat', { games: nine, reports: [...nine.map(g => report(g.id)), report(nine[0].id)] })).toBe(false);
    expect(earned('retry-25', { games: wins(25, () => ({ mode: 'training', context: { kind: 'training-retry', sourceGameId: 'src', sourcePly: 1 } })) })).toBe(false);
  });
  it('secrets', () => {
    expect(earned('stalemate-swindle', { games: [game({ score: 0.5, termination: 'stalemate' })] })).toBe(false);
    expect(earned('humble-crown', { games: [game({ ccns: ['a5a6q'] })] })).toBe(false);
    expect(earned('marathon', { games: [game({ plies: 199 })] })).toBe(false);
    expect(earned('anniversary', { games: [game({ at: '2026-03-04T10:00:00Z' }), game({ at: '2026-03-04T18:00:00Z' })] })).toBe(false);
    expect(earned('anniversary', { games: [game({ at: '2025-03-04T10:00:00Z' }), game({ at: '2026-03-05T18:00:00Z' })] })).toBe(false);
    expect(VAULT.filter(d => d.since === 'crown-vault-2' && d.secret).map(d => d.id).sort()).toEqual(['anniversary', 'humble-crown', 'marathon', 'stalemate-swindle']);
  });
});

describe('crown-vault-2 anti-farming', () => {
  it('casual, assisted, training, imported, aborted and self-play games never count', () => {
    for (const o of [{ mode: 'casual' as const }, { assisted: true }, { mode: 'training' as const }, { context: { kind: 'imported' as const } }, { termination: 'abandoned' }, { oppKind: 'human' as const }]) {
      expect(earned('mates-10', { games: wins(10, () => ({ termination: 'checkmate', ...o })) }), JSON.stringify(o)).toBe(false);
      expect(earned('upsets-5', { games: wins(5, () => ({ oppRating: 1700, ...o })) }), JSON.stringify(o)).toBe(false);
      expect(earned('days-7', { games: wins(7, () => o) }), JSON.stringify(o)).toBe(false);
    }
  });
  it('repeat wins against the same opponent count once per day', () => {
    const farm = wins(10, () => ({ oppId: 'weakling', at: '2026-06-01T10:00:00Z', termination: 'checkmate', fens: [START, ENDING] }));
    expect(qualifiedWins(facts({ games: farm }).games)).toHaveLength(1);
    expect(run('mates-10', { games: farm }).progress).toEqual({ have: 1, need: 10 });
    expect(earned('endgame-5', { games: farm })).toBe(false);
  });
  it(`at most ${DAILY_CAP} counted wins a day`, () => {
    const day = wins(30, () => ({ at: '2026-06-02T10:00:00Z', termination: 'checkmate' }));
    expect(qualifiedWins(facts({ games: day }).games)).toHaveLength(DAILY_CAP);
    expect(earned('mates-50', { games: day })).toBe(false);
  });
  it('wins against opponents rated more than 400 below you never count', () => {
    expect(earned('mates-10', { games: wins(10, () => ({ termination: 'checkmate', myRating: 1500, oppRating: 1099 })) })).toBe(false);
    expect(earned('mates-10', { games: wins(10, () => ({ termination: 'checkmate', myRating: 1500, oppRating: 1100 })) })).toBe(true);
    expect(earned('home-region', { games: vsComps(Array.from({ length: 5 }, (_, i) => comp(`h${i}`, 0)), () => ({ oppRating: 900 })), fed: fed({ competitors: Array.from({ length: 5 }, (_, i) => comp(`h${i}`, 0)) }) })).toBe(false);
    expect(earned('winstreak-5', { ratingEvents: winEvents(5, () => ({ oppRating: 1000 })) })).toBe(false);
  });
  it('practice and sandbox markets, and unscored forecasts, never reach Exchange or calibration rules', () => {
    const c = calibrated(32); c.markets.forEach(m => { m.sandbox = true; });
    expect(earned('calibration-30', { fed: fed(c) })).toBe(false);
    const open = calibrated(32); open.markets.forEach(m => { m.status = 'open'; });
    expect(earned('calibration-30', { fed: fed(open) })).toBe(false);
  });
});

// ---------------------------------------------------------------- storage: idempotency and v0.9 migration
const openDb = () => CrownDB.open(new IDBFactory(), `vault2-${Math.random()}`);
function host(db: CrownDB): VaultHost {
  return { db, fed: { state: null, finance: () => ({ netWorth: 0 }) } as unknown as VaultHost['fed'], readOnly: false, matchActive: false, subscribe: () => () => {} };
}
async function seed(db: CrownDB, games: GameRecord[], events: RatingEvent[] = []) {
  await db.importRecords({ games, ratingEvents: events, ratingState: [], reports: [] }, false);
}
const v1Record = (id: string, at: string): UnlockRecord => ({ id, at, earnedAt: at, evidence: 'v0.9', backfill: true, catalog: 'crown-vault-1' });

describe('crown-vault-2 storage: migration and idempotency', () => {
  it('a v0.9 save keeps its unlocks byte for byte and back-fills the expansion once, without notices', async () => {
    const db = await openDb();
    const history = wins(12, () => ({ termination: 'checkmate', fens: [START, ENDING] }));
    await seed(db, history, history.map((g, i) => ev({ gameId: g.id, at: seqAt(i), score: 1 })));
    // what v0.9 had written: its back-fill flag and crown-vault-1 unlocks (one whose rule would no longer pass)
    const old = [v1Record('first-win', '2026-01-02T00:00:00Z'), v1Record('wins-10', '2026-01-03T00:00:00Z'), v1Record('rating-2000', '2026-01-04T00:00:00Z')];
    await db.putMetaIfAbsent([{ key: BACKFILL_KEY, value: { at: '2026-01-01T00:00:00Z', unlocks: 3 } }, ...old.map(r => ({ key: UNLOCK_PREFIX + r.id, value: r }))]);
    const v = new VaultService(host(db), () => '2026-11-04T09:00:00.000Z');
    await v.start(); v.stop();
    const owned = await loadUnlocks(db);
    for (const r of old) expect(owned.get(r.id)).toEqual(r);
    const added = [...owned.values()].filter(u => vaultDef(u.id)?.since === 'crown-vault-2');
    expect(added.every(u => v.results.get(u.id)?.earned)).toBe(true);
    expect(added.map(u => u.id)).toEqual(expect.arrayContaining(['endgame-5', 'mates-10', 'winstreak-10', 'days-7']));
    expect(added.every(u => u.backfill && u.catalog === 'crown-vault-2')).toBe(true);
    // crown-vault-1 rules newly met on this first run (e.g. first-mate) are recorded as before
    expect(owned.get('first-mate')?.catalog).toBe('crown-vault-2');
    expect(v.pending.filter(u => vaultDef(u.id)?.since === 'crown-vault-2')).toEqual([]);
    expect(await db.getMeta(BACKFILL_V2_KEY)).toBeTruthy();
    // every unlock is justified by its rule (except the pre-existing v0.9 record that is kept for good)
    expect([...owned.keys()].filter(id => !v.results.get(id)?.earned)).toEqual(['rating-2000']);
    db.close();
  });
  it('a Played Like record write moves the change key (event-driven re-evaluation without a new record count)', async () => {
    const db = await openDb();
    const h = host(db);
    const v = new VaultService(h);
    const k0 = await v.changeKey();
    h.playedLikeVersion = 1;
    expect(await v.changeKey()).not.toBe(k0);
    db.close();
  });
  it('reloading never duplicates or rewrites an unlock; a later rated game unlocks with one notice', async () => {
    const db = await openDb();
    await seed(db, wins(10, () => ({ termination: 'checkmate' })));
    const a = new VaultService(host(db), () => '2026-11-04T09:00:00.000Z');
    await a.start(); a.stop();
    const first = await db.metaWithPrefix(UNLOCK_PREFIX);
    expect(first.map(r => r.key)).toContain('ach:mates-10');
    for (let i = 0; i < 2; i++) { // two reloads
      const b = new VaultService(host(db), () => `2026-11-0${5 + i}T09:00:00.000Z`);
      await b.start(); await b.evaluate(); b.stop();
      expect(b.pending).toEqual([]);
    }
    const again = await db.metaWithPrefix(UNLOCK_PREFIX);
    expect(again).toEqual(first);
    // event-driven: a new record is committed and evaluated
    const c = new VaultService(host(db), () => '2026-11-08T09:00:00.000Z');
    await c.start();
    expect((await loadUnlocks(db)).has('hold-the-line')).toBe(false);
    await seed(db, [game({ score: 0.5, oppRating: 1850 })]);
    await c.evaluate(); c.stop();
    const held = (await loadUnlocks(db)).get('hold-the-line');
    expect(held?.backfill).toBe(false);
    expect(c.pending.map(u => u.id)).toContain('hold-the-line');
    expect((await db.metaWithPrefix(UNLOCK_PREFIX)).length).toBe(new Set((await db.metaWithPrefix(UNLOCK_PREFIX)).map(r => r.key)).size);
    db.close();
  });
});
