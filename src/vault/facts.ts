/**
 * The Sovereign Vault — facts (crown-vault-1). One Facts object is built from saved records only (finalized game
 * records, rating events, analysis reports, Academy records and the Federation state). Every function here is pure:
 * no storage, no clock (local-hour checks use the record's own timestamp), so each achievement rule can be tested
 * with plain objects. Assisted, abandoned, imported and unfinished games never count.
 */
import type { GameRecord } from '../games/types';
import type { RatingEvent } from '../ratings/ledger';
import type { AnalysisReport } from '../analysis/types';
import type { Competitor, Fixture } from '../federation/model';
import type { RoundRecord, SeasonPlan, WorldState } from '../federation/world';
import { swissTable } from '../federation/world';
import { gamesOf } from '../federation/driver';
import type { Market, Position } from '../exchange/market';
import type { OwnedAsset } from '../economy/economy';
import type { FedTitle } from '../heraldry/catalog';
import { scoreAll, summary, type ForecastRecord } from '../app/forecasting';
import { collectedTitles } from '../ratings/titles';
import { isProvisional } from '../ratings/glicko2';
import { grimoireFacts, type GrimAttempt, type GrimCompletion, type GrimoireFacts } from '../academy/grimoire';

const PLAYER = 'player';

// ---------------------------------------------------------------- inputs (structural: FedState satisfies FedInput)
export interface FedInput {
  world: Pick<WorldState, 'season' | 'round' | 'player' | 'featured'>;
  plans: Map<string, SeasonPlan>;
  /** The current season's plan (FederationService keeps it fresher than the `plans` map). */
  plan?: SeasonPlan;
  rounds: Map<string, RoundRecord>;
  competitors: Map<string, Pick<Competitor, 'id' | 'region' | 'name'>>;
  markets: Map<string, Market>;
  positions: Map<string, Position>;
  assets: Map<string, OwnedAsset>;
  finance: { points: { netWorth: number; at: string; season: number; round: number }[]; peak: number };
  extra: { sponsorsPaid: string[]; forecasts: ForecastRecord[] };
}
export interface VaultInput {
  games: GameRecord[];
  ratingEvents: RatingEvent[];
  reports: AnalysisReport[];
  bookmarks?: { gameId: string; ply: number }[];
  attempts?: { puzzleId: string; solved: boolean; clean: boolean; at?: string }[];
  trainingRuns?: { endedAt: string | null; attempted: number }[];
  fed?: FedInput | null;
  /** Current net worth (µ) from the Federation finance view; null when unknown. */
  netWorthNow?: number | null;
  /** Ids already owned (for meta achievements such as all-collections). */
  owned?: Iterable<string>;
  /** Grimoire lesson records (meta store `grim:`): exercise sessions and chapter completions. */
  grimoire?: { attempts: GrimAttempt[]; completions: GrimCompletion[] };
}

// ---------------------------------------------------------------- derived facts
export interface OwnGame {
  id: string; at: string; startedAt: string; day: string;
  oppId: string; oppName: string; score: 0 | 0.5 | 1; rated: boolean; color: 'white' | 'black';
  termination: string | null; myRating: number | null; oppRating: number | null;
  level: number | null; budgetMs: number | null; quickMatch: boolean; federation: boolean; oppRegion: number | null;
  plies: number; lostMaterial: boolean; worstDiff: number;
}
export interface RatedResult { at: string; score: number; oppId: string; oppName: string; gameId: string; myRating: number; oppRating: number }
export interface SettledPosition { marketId: string; title: string; season: number; family: string; pnl: number; at: string }
export interface ScoredFc { marketId: string; title: string; family: string; at: string; brier: number; ref: number | null; model: number | null; price: number | null; topPrice: number | null; topWon: boolean }

export interface FedFacts {
  season: number;
  divisions: number[]; // division played each completed season, then the current one
  promotions: { season: number; from: number; to: number }[];
  relegations: { season: number; from: number; to: number }[];
  titles: { season: number; title: string }[];
  norms: { event: string; season: number; tpr: number }[];
  fedTitle: FedTitle | null;
  featured: Set<string>;
  regionOf: Map<string, number>;
  nameOf: Map<string, string>;
  swissEntries: { season: number; event: string }[];
  swissPlaces: { season: number; name: string; place: number }[];
  koAppearances: { season: number; event: string; label: string }[];
  clubWins: number[];
  fullSeasons: number[];
  unbeatenPromotions: number[];
  seasonsCompleted: number;
  sponsorsPaid: string[];
  settled: SettledPosition[];
  scored: ScoredFc[];
  legacyForecast: { n: number; brier: number | null; modelBrier: number | null };
  club: { owned: boolean; level: number };
  peakNetWorth: number;
  nowNetWorth: number | null;
  ruinRecovery: { lowAt: string; highAt: string } | null;
}
export interface Facts {
  games: OwnGame[];
  countedWins: OwnGame[];
  rated: RatedResult[];
  ratedWinsByColour: { white: number; black: number };
  insignia: { collected: number[]; peakRating: number | null };
  analyses: { complete: number; deep: number; lastAt: string | null };
  bookmarks: number;
  retryWins: number;
  puzzlesClean: number;
  trainingSets: number;
  fed: FedFacts | null;
  owned: Set<string>;
  /** Completed Grimoire chapters (id → when), exercises ever solved first try, and each exercise's first outcome. */
  grimoire: GrimoireFacts;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
/** Material of each side from a FEN's piece field: count and value. */
export function materialOf(fen: string): { white: { n: number; v: number }; black: { n: number; v: number } } {
  const out = { white: { n: 0, v: 0 }, black: { n: 0, v: 0 } };
  for (const ch of fen.split(' ')[0] ?? '') {
    const lower = ch.toLowerCase();
    if (!(lower in VALUE)) continue;
    const side = ch === lower ? out.black : out.white;
    side.n++; side.v += VALUE[lower];
  }
  return out;
}

const scoreOf = (g: GameRecord): 0 | 0.5 | 1 | null => {
  if (g.result === '1/2-1/2') return 0.5;
  if (g.result === '1-0') return g.humanColor === 'white' ? 1 : 0;
  if (g.result === '0-1') return g.humanColor === 'black' ? 1 : 0;
  return null;
};

/** Eligible own games: finalized, unassisted, played from the start (not training, retry or import), not abandoned. */
export function eligible(g: GameRecord): boolean {
  return g.status === 'finalized' && (g.mode === 'rated' || g.mode === 'casual') && g.assistance.length === 0 &&
    g.context.kind !== 'training-retry' && g.context.kind !== 'imported' && !g.setupMoves?.length &&
    g.termination !== 'abandoned' && scoreOf(g) !== null;
}

function ownGame(g: GameRecord, regionOf: Map<string, number>): OwnGame {
  const me = g.humanColor === 'white' ? g.white : g.black;
  const opp = g.humanColor === 'white' ? g.black : g.white;
  const at = g.endedAt ?? g.startedAt;
  let worst = 0, lost = false;
  const start = materialOf(g.initialFen);
  const startMine = g.humanColor === 'white' ? start.white.n : start.black.n;
  for (const m of g.moves) {
    const mat = materialOf(m.fenAfter);
    const mine = g.humanColor === 'white' ? mat.white : mat.black;
    const theirs = g.humanColor === 'white' ? mat.black : mat.white;
    if (mine.n < startMine) lost = true;
    worst = Math.min(worst, mine.v - theirs.v);
  }
  const quickMatch = g.id.startsWith('qm-') && regionOf.has(opp.id);
  return {
    id: g.id, at, startedAt: g.startedAt, day: at.slice(0, 10), oppId: opp.id, oppName: opp.name, score: scoreOf(g)!,
    rated: g.mode === 'rated' && !!g.ratingEventId, color: g.humanColor, termination: g.termination,
    myRating: me.rating, oppRating: opp.rating, level: opp.engine?.level ?? null,
    budgetMs: opp.engine?.profile?.maxTimeMs ?? opp.engine?.config?.maxTimeMs ?? null,
    quickMatch, federation: g.context.kind === 'federation', oppRegion: regionOf.get(opp.id) ?? null,
    plies: g.moves.length, lostMaterial: lost, worstDiff: worst,
  };
}

/** Wins that count toward win counters: at most one per opponent per calendar day (UTC). */
export function countWins(games: OwnGame[]): OwnGame[] {
  const seen = new Set<string>();
  const out: OwnGame[] = [];
  for (const g of games) {
    if (g.score !== 1) continue;
    const k = `${g.oppId}|${g.day}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(g);
  }
  return out;
}

export function fedFacts(fed: FedInput, netWorthNow: number | null): FedFacts {
  const p = fed.world.player;
  const divisions = [...p.history.map(h => h.division), p.division];
  const promotions: FedFacts['promotions'] = [], relegations: FedFacts['relegations'] = [];
  p.history.forEach((h, i) => {
    const next = i + 1 < p.history.length ? p.history[i + 1].division : p.division;
    if (next < h.division) promotions.push({ season: h.season, from: h.division, to: next });
    if (next > h.division) relegations.push({ season: h.season, from: h.division, to: next });
  });
  const regionOf = new Map<string, number>(), nameOf = new Map<string, string>();
  for (const c of fed.competitors.values()) { regionOf.set(c.id, c.region); nameOf.set(c.id, c.name); }
  const rounds = [...fed.rounds.values()];
  const roundsOf = (s: number) => rounds.filter(r => r.season === s);
  const done = (pl: SeasonPlan) => pl.status === 'complete' || pl.season < fed.world.season;
  const swissEntries: FedFacts['swissEntries'] = [], swissPlaces: FedFacts['swissPlaces'] = [], koAppearances: FedFacts['koAppearances'] = [], clubWins: number[] = [];
  const plans = new Map(fed.plans);
  if (fed.plan) plans.set(fed.plan.id, fed.plan);
  for (const pl of plans.values()) {
    for (const sw of pl.swiss) {
      if (!sw.entrants.includes(PLAYER)) continue;
      swissEntries.push({ season: pl.season, event: sw.event });
      if (done(pl)) {
        const place = swissTable(sw, gamesOf(roundsOf(pl.season))).findIndex(r => r.id === PLAYER);
        if (place >= 0) swissPlaces.push({ season: pl.season, name: sw.name, place: place + 1 });
      }
    }
    for (const ko of [pl.champ, pl.club]) {
      if (!ko) continue;
      for (const st of ko.stages) if (st.matches.some(m => m.a === PLAYER || m.b === PLAYER)) koAppearances.push({ season: pl.season, event: ko.name, label: st.label });
      if (ko.name === 'club' && ko.champions.includes(PLAYER)) clubWins.push(pl.season);
    }
  }
  // seasons whose every own fixture was played over the board (no forfeits), and promotions without a league loss
  const mine = (f: Fixture) => f.tier === 1 && (f.white === PLAYER || f.black === PLAYER);
  const myScore = (f: Fixture) => (f.result === null ? null : f.white === PLAYER ? f.result : 1 - f.result);
  const fullSeasons: number[] = [], unbeatenPromotions: number[] = [];
  for (const h of p.history) {
    const fx = roundsOf(h.season).flatMap(r => r.fixtures).filter(mine);
    const league = fx.filter(f => f.event.startsWith('league'));
    if (league.length >= 15 && fx.every(f => f.result !== null && !f.forfeit && f.gameId)) fullSeasons.push(h.season);
    if (promotions.some(x => x.season === h.season) && league.length >= 15 && league.every(f => myScore(f) !== null && myScore(f)! > 0)) unbeatenPromotions.push(h.season);
  }
  // exchange: official settled positions still holding shares at settlement (round trips sold out beforehand never count)
  const settled: SettledPosition[] = [];
  for (const pos of fed.positions.values()) {
    if (pos.holder !== 'player:cash') continue;
    const m = fed.markets.get(pos.marketId);
    if (!m || m.sandbox || m.status !== 'settled' || !pos.shares.some(x => x > 0)) continue;
    settled.push({ marketId: m.id, title: m.title, season: m.season, family: m.kind ?? 'match', pnl: pos.received - pos.spent, at: m.settledAt ?? m.openedAt });
  }
  settled.sort((a, b) => a.at.localeCompare(b.at));
  const all = scoreAll(fed.extra.forecasts, fed.markets);
  const scored: ScoredFc[] = all.filter(s => !s.market.sandbox).map(s => {
    const top = s.f.probs.indexOf(Math.max(...s.f.probs));
    return {
      marketId: s.market.id, title: s.market.title, family: s.market.kind ?? 'match', at: s.f.at, brier: s.brier,
      ref: s.priceBrier ?? s.modelBrier, model: s.modelBrier, price: s.priceBrier,
      topPrice: s.f.prices && s.f.prices.length === s.f.probs.length ? s.f.prices[top] : null, topWon: s.y[top] === 1,
    };
  });
  const sm = summary(all);
  const club = [...fed.assets.values()].find(a => a.typeId === 'club');
  let ruinRecovery: FedFacts['ruinRecovery'] = null, low: string | null = null;
  for (const pt of fed.finance.points) {
    if (pt.netWorth < 100_000_000) low ??= pt.at;
    else if (low && pt.netWorth >= 1_000_000_000) { ruinRecovery = { lowAt: low, highAt: pt.at }; break; }
  }
  return {
    season: fed.world.season, divisions, promotions, relegations, titles: [...p.titles], norms: (p.norms ?? []).map(n => ({ event: n.event, season: n.season, tpr: n.tpr })),
    fedTitle: p.fedTitle ?? null, featured: new Set((fed.world.featured ?? []).map(f => f.id)), regionOf, nameOf,
    swissEntries, swissPlaces, koAppearances, clubWins, fullSeasons, unbeatenPromotions, seasonsCompleted: p.history.length,
    sponsorsPaid: [...fed.extra.sponsorsPaid], settled, scored, legacyForecast: { n: sm.n, brier: sm.brier, modelBrier: sm.modelBrier },
    club: { owned: !!club, level: club ? club.level ?? 1 : 0 },
    peakNetWorth: Math.max(fed.finance.peak, ...fed.finance.points.map(x => x.netWorth), netWorthNow ?? 0), nowNetWorth: netWorthNow, ruinRecovery,
  };
}

/** Build the Facts object from saved records. */
export function buildFacts(input: VaultInput): Facts {
  const fed = input.fed ? fedFacts(input.fed, input.netWorthNow ?? null) : null;
  const regionOf = fed?.regionOf ?? new Map<string, number>();
  const games = input.games.filter(eligible).map(g => ownGame(g, regionOf)).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const evs = [...input.ratingEvents].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const rated: RatedResult[] = evs.map(e => ({ at: e.at, score: e.score, oppId: e.opponent.id, oppName: e.opponent.name, gameId: e.gameId, myRating: e.before.rating, oppRating: e.opponent.rating }));
  const ratedWinsByColour = { white: 0, black: 0 };
  const byId = new Map(games.map(g => [g.id, g]));
  for (const r of rated) { const g = byId.get(r.gameId); if (g && r.score === 1) ratedWinsByColour[g.color]++; }
  const rapid = evs.filter(e => e.pool === 'rapid');
  const ct = collectedTitles(rapid.map(e => ({ after: e.after, games: e.gamesBefore + 1, at: e.at })), isProvisional);
  // analyses: own finalized games with at least one complete report (re-analysis never counts twice)
  const ownIds = new Set(input.games.filter(g => g.status === 'finalized').map(g => g.id));
  const complete = new Set<string>(), deep = new Set<string>();
  let lastAt: string | null = null;
  for (const r of input.reports) {
    if (r.status !== 'complete' || !ownIds.has(r.gameId)) continue;
    complete.add(r.gameId);
    if (r.settings.id === 'deep-d9') deep.add(r.gameId);
    if (!lastAt || r.completedAt > lastAt) lastAt = r.completedAt;
  }
  const marks = new Set<string>();
  for (const b of input.bookmarks ?? []) marks.add(`${b.gameId}:${b.ply}`);
  for (const g of input.games) for (const ply of g.bookmarks ?? []) marks.add(`${g.id}:${ply}`);
  const retries = new Set<string>();
  for (const g of input.games) {
    if (g.status !== 'finalized' || g.context.kind !== 'training-retry' || scoreOf(g) !== 1) continue;
    retries.add(`${g.context.sourceGameId ?? g.id}:${g.context.sourcePly ?? ''}`);
  }
  return {
    games, countedWins: countWins(games), rated, ratedWinsByColour,
    insignia: { collected: ct.collected.map(t => t.index), peakRating: ct.peakRating },
    analyses: { complete: complete.size, deep: deep.size, lastAt },
    bookmarks: marks.size, retryWins: retries.size,
    puzzlesClean: new Set((input.attempts ?? []).filter(a => a.solved && a.clean).map(a => a.puzzleId)).size,
    trainingSets: (input.trainingRuns ?? []).filter(r => r.endedAt && r.attempted > 0).length,
    fed, owned: new Set(input.owned ?? []), grimoire: grimoireFacts(input.grimoire),
  };
}

// ---------------------------------------------------------------- sequence helpers (rated results, chronological)
/** Longest run of rated games without a loss; returns its length and the result that completed `need` (if any). */
export function unbeatenRun(rated: RatedResult[], need: number): { best: number; reached: RatedResult | null } {
  let run = 0, best = 0, reached: RatedResult | null = null;
  for (const r of rated) {
    run = r.score > 0 ? run + 1 : 0;
    best = Math.max(best, run);
    if (!reached && run >= need) reached = r;
  }
  return { best, reached };
}
/** Five straight rated losses immediately followed by five straight rated wins. */
export function comebackRun(rated: RatedResult[], n = 5): RatedResult | null {
  for (let i = n; i + n <= rated.length; i++) {
    const before = rated.slice(i - n, i), after = rated.slice(i, i + n);
    if (before.every(r => r.score === 0) && after.every(r => r.score === 1)) return after[n - 1];
  }
  return null;
}

// ---------------------------------------------------------------- exchange statistics (forecast skill + realized P&L)
export interface ExchangeStats {
  n: number; brier: number | null; refBrier: number | null; skill: number | null;
  markets: number; pnl: number; pnlExBest: number; families: number; profitableSeasons: number;
}
export function exchangeStats(fed: FedFacts | null): ExchangeStats {
  const paired = (fed?.scored ?? []).filter(s => s.ref !== null);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const brier = mean(paired.map(s => s.brier)), refBrier = mean(paired.map(s => s.ref!));
  const settled = fed?.settled ?? [];
  const pnl = settled.reduce((a, s) => a + s.pnl, 0);
  const best = settled.reduce((a, s) => Math.max(a, s.pnl), 0);
  return {
    n: paired.length, brier, refBrier, skill: brier !== null && refBrier !== null ? refBrier - brier : null,
    markets: new Set(settled.map(s => s.marketId)).size, pnl, pnlExBest: pnl - best,
    families: new Set(settled.filter(s => s.pnl > 0).map(s => s.family)).size,
    profitableSeasons: seasonPnl(settled).filter(s => s.n >= 5 && s.pnl > 0).length,
  };
}
export function seasonPnl(settled: SettledPosition[]): { season: number; n: number; pnl: number }[] {
  const m = new Map<number, { season: number; n: number; pnl: number }>();
  for (const s of settled) { const x = m.get(s.season) ?? { season: s.season, n: 0, pnl: 0 }; x.n++; x.pnl += s.pnl; m.set(s.season, x); }
  return [...m.values()].sort((a, b) => a.season - b.season);
}
