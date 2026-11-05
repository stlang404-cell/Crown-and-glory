/**
 * Read-only selectors for the Federation Dashboard. Every value comes from saved state (federation state, rating
 * events, Vault unlocks, Grimoire progress); nothing is estimated or invented. Lists are capped so the dashboard
 * stays cheap however long the career gets. These functions never write.
 */
import { careerTimeline } from '../ratings/pools';
import type { Fixture } from '../federation/model';
import { PLAYER_ID, SWISS_ROUNDS } from '../federation/model';
import type { KoState, SwissState } from '../federation/world';
import { swissTable } from '../federation/world';
import { claimPrices, claimsOf, liquidationValue, statesOf, type Market, type Position } from '../exchange/market';
import { prices } from '../exchange/lmsr';
import type { RatingEvent } from '../ratings/ledger';
import type { PoolId } from '../games/types';
import { CHALLENGER_POOL, CHAMP_POOL, OPEN_POOL, cupPool } from '../economy/economy';
import { koTitle } from '../federation/competitions';
import { earnable, type EvalResult, type VaultDef } from '../vault/catalog';
import type { UnlockRecord } from '../vault/store';
import { DEFAULT_PLAN, GRIMOIRE_INDEX, dailyPlan, dueReviews, indexChapters, type GrimProgress, type GrimoireIndex } from '../academy/grimoire';

export const DASH_LIMITS = { matches: 6, positions: 5, markets: 5, results: 6, leaders: 3 } as const;
const PLAYER_CASH = 'player:cash';

/** The parts of the federation state the dashboard reads (FedState satisfies it). */
export interface DashFedState {
  world: { season: number; round: number };
  plan: { swiss: SwissState[]; champ: KoState | null; club: KoState | null; cups?: KoState[] };
  competitors: ReadonlyMap<string, { name: string; rating: number; rd: number }>;
  markets: ReadonlyMap<string, Market>;
  positions: ReadonlyMap<string, Position>;
  balances: ReadonlyMap<string, number>;
  finance: { points: { season: number; round: number; netWorth: number; cash: number }[] };
  liveGames: ReadonlyMap<string, { status: 'live' | 'done'; points: { prices: number[] }[] }>;
}

// ---------------------------------------------------------------- live federation matches
export type MatchStatus = 'live' | 'upcoming' | 'finished';
export interface DashSide { id: string; name: string; rating: number; rd: number }
export interface DashMatch {
  fixtureId: string; event: string; stage?: string; white: DashSide; black: DashSide; status: MatchStatus; result: number | null;
  market: { id: string; status: Market['status']; prices: number[] } | null;
}

const side = (st: DashFedState, id: string): DashSide => {
  const c = st.competitors.get(id);
  return { id, name: id === PLAYER_ID ? 'You' : c?.name ?? id, rating: c?.rating ?? 0, rd: c?.rd ?? 0 };
};
const STATUS_ORDER: Record<MatchStatus, number> = { live: 0, upcoming: 1, finished: 2 };

/** Featured fixtures of the current round: live first, then upcoming, then finished; with current market prices. */
export function liveMatches(st: DashFedState, featured: readonly Fixture[], isLive: (fixtureId: string) => boolean, limit: number = DASH_LIMITS.matches): DashMatch[] {
  const out = featured.map((f): DashMatch => {
    const m = st.markets.get(`mk:${f.id}`);
    const live = f.result === null && (isLive(f.id) || st.liveGames.get(f.id)?.status === 'live');
    return {
      fixtureId: f.id, event: f.event, stage: f.stage, white: side(st, f.white), black: side(st, f.black),
      status: f.result !== null ? 'finished' : live ? 'live' : 'upcoming', result: f.result,
      market: m ? { id: m.id, status: m.status, prices: prices(m.q, m.b) } : null,
    };
  });
  return out.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]).slice(0, limit);
}

/** The featured market with the most published price points (live in-play points win over trade history). */
export function featuredMarketForChart(st: DashFedState, featured: readonly Fixture[]): { market: Market; points: { prices: number[] }[] } | null {
  let best: { market: Market; points: { prices: number[] }[] } | null = null;
  for (const f of featured) {
    const m = st.markets.get(`mk:${f.id}`);
    if (!m) continue;
    const lg = st.liveGames.get(f.id);
    const points = lg && lg.points.length >= 2 ? lg.points : m.history;
    if (!best || points.length > best.points.length) best = { market: m, points };
  }
  return best;
}

// ---------------------------------------------------------------- tournaments
export type EventStatus = 'upcoming' | 'in-progress' | 'finished';
export interface DashEvent {
  /** 'open' | 'challenger' | 'champ' | 'club', or a crown-competition-2 knockout id (zonal-<z>, cup-<r>). */
  id: string; name: string; status: EventStatus; progress: string;
  leaders: { id: string; name: string; points: number | null }[]; prize: number | null; playerIn: boolean; champions: string[];
}
type Game = { event: string; white: string; black: string; result: number | null };

function koAlive(ko: KoState): string[] {
  const out = new Set<string>();
  for (const sg of ko.stages) for (const m of sg.matches) { if (m.winner && m.winner !== m.a) out.add(m.a); if (m.winner && m.winner !== m.b) out.add(m.b); }
  return ko.qualifiers.filter(id => !out.has(id)).sort((a, b) => (ko.seeds[a] ?? 99) - (ko.seeds[b] ?? 99));
}
function koEvent(id: string, ko: KoState, st: DashFedState, round: number, prize: number | null): DashEvent {
  const stage = ko.stages.find(sg => sg.round === round) ?? [...ko.stages].reverse().find(sg => sg.matches.length > 0) ?? null;
  const done = ko.champions.length > 0;
  const alive = done ? ko.champions : koAlive(ko);
  return {
    id, name: ko.name, status: done ? 'finished' : stage && stage.matches.length ? 'in-progress' : 'upcoming',
    progress: done ? (ko.champions.length > 1 ? 'Joint champions' : 'Champion crowned') : stage ? `${stage.label} · ${alive.length} left` : `${ko.qualifiers.length} qualifiers`,
    leaders: alive.slice(0, DASH_LIMITS.leaders).map(x => ({ id: x, name: side(st, x).name, points: null })), prize, playerIn: ko.qualifiers.includes(PLAYER_ID), champions: ko.champions,
  };
}

/** Swiss events, the Crown Championship and (for club owners) the Club Weekend of the current season. */
export function tournamentEvents(st: DashFedState, games: readonly Game[]): DashEvent[] {
  const { round } = st.world;
  const last = SWISS_ROUNDS[SWISS_ROUNDS.length - 1];
  const out: DashEvent[] = st.plan.swiss.map(sw => {
    const played = games.some(g => g.event === sw.event && g.result !== null);
    const rows = played ? swissTable(sw, games as Game[]) : [];
    const status: EventStatus = sw.rounds.length === 0 ? 'upcoming' : round > last ? 'finished' : 'in-progress';
    return {
      id: sw.event, name: sw.name, status,
      progress: status === 'upcoming' ? `Starts in round ${SWISS_ROUNDS[0]} · ${sw.entrants.length} players` : `${sw.rounds.length}/${SWISS_ROUNDS.length} rounds paired · ${sw.entrants.length} players`,
      leaders: rows.slice(0, DASH_LIMITS.leaders).map(r => ({ id: r.id, name: side(st, r.id).name, points: r.points })),
      prize: sw.event === 'open' ? OPEN_POOL : CHALLENGER_POOL, playerIn: sw.entrants.includes(PLAYER_ID), champions: status === 'finished' && rows[0] ? [rows[0].id] : [],
    };
  });
  if (st.plan.champ) out.push(koEvent('champ', st.plan.champ, st, round, CHAMP_POOL));
  else out.push({ id: 'champ', name: 'Crown Championship', status: 'upcoming', progress: 'Bracket drawn after league round 15', leaders: [], prize: CHAMP_POOL, playerIn: false, champions: [] });
  if (st.plan.club) out.push(koEvent('club', st.plan.club, st, round, null));
  // v0.11 crown-competition-2: the Zonal Championship / Regional Cup the player is in
  for (const ko of st.plan.cups ?? []) if (ko.qualifiers.includes(PLAYER_ID)) out.push({ ...koEvent(ko.name, ko, st, round, cupPool(ko.name)), name: koTitle(ko) });
  return out;
}

// ---------------------------------------------------------------- Crown Exchange snapshot
export interface DashPosition { marketId: string; title: string; status: Market['status']; shares: number; value: number; pnl: number; label: string }
export interface DashPortfolio { cash: number; items: DashPosition[]; count: number; value: number; pnl: number }

/** Value of a position is its executable sell-now value after fees (as Finance); P&L = value + received − spent. */
export function positionPnl(m: Market, p: Position): { value: number; pnl: number } {
  const value = liquidationValue(m, p);
  return { value, pnl: value + p.received - p.spent };
}

/** The player's open positions (markets still open or closed-awaiting-settlement, shares held), biggest value first. */
export function portfolio(st: DashFedState, limit: number = DASH_LIMITS.positions): DashPortfolio {
  const all: DashPosition[] = [];
  for (const p of st.positions.values()) {
    if (p.holder !== PLAYER_CASH || !p.shares.some(x => x > 0)) continue;
    const m = st.markets.get(p.marketId);
    if (!m || m.sandbox || (m.status !== 'open' && m.status !== 'closed')) continue;
    const { value, pnl } = positionPnl(m, p);
    const claims = claimsOf(m);
    const held = p.shares.map((x, i) => (x > 0 ? `${x} ${claims[i]?.label ?? `#${i + 1}`}` : '')).filter(Boolean);
    all.push({ marketId: m.id, title: m.title, status: m.status, shares: p.shares.reduce((a, b) => a + b, 0), value, pnl, label: held.join(', ') });
  }
  all.sort((a, b) => b.value - a.value || a.title.localeCompare(b.title));
  return { cash: st.balances.get(PLAYER_CASH) ?? 0, items: all.slice(0, limit), count: all.length, value: all.reduce((s, x) => s + x.value, 0), pnl: all.reduce((s, x) => s + x.pnl, 0) };
}

export interface DashMarket { id: string; title: string; kind: string; leader: { label: string; price: number }; move: number | null; trades: number; lastAt: string }

/** Open (tradable) markets, most recently traded first, with the leading claim and its move since the previous trade. */
export function openMarkets(st: DashFedState, limit: number = DASH_LIMITS.markets): DashMarket[] {
  const out: DashMarket[] = [];
  for (const m of st.markets.values()) {
    if (m.sandbox || m.status !== 'open') continue;
    const claims = claimsOf(m);
    const pr = claimPrices(m);
    let li = 0; for (let i = 1; i < pr.length; i++) if (pr[i] > pr[li]) li = i;
    const h = m.history;
    const claimAt = (e: { prices: number[] }) => claims[li].states.reduce((a, s) => a + (e.prices[s] ?? 0), 0);
    const move = h.length >= 2 ? claimAt(h[h.length - 1]) - claimAt(h[h.length - 2]) : null;
    out.push({ id: m.id, title: m.title, kind: m.kind ?? 'match', leader: { label: claims[li].label, price: pr[li] }, move, trades: Math.max(0, h.length - 1), lastAt: h[h.length - 1]?.at ?? m.openedAt });
  }
  return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.trades - a.trades || a.title.localeCompare(b.title)).slice(0, limit);
}

export interface DashSettlement { marketId: string; title: string; status: 'settled' | 'cancelled'; outcome: string; pnl: number; at: string }
/** The player's resolved positions (settled or cancelled markets), newest first. */
export function recentSettlements(st: DashFedState, limit: number = DASH_LIMITS.results): DashSettlement[] {
  const out: DashSettlement[] = [];
  for (const p of st.positions.values()) {
    if (p.holder !== PLAYER_CASH) continue;
    const m = st.markets.get(p.marketId);
    if (!m || m.sandbox || (m.status !== 'settled' && m.status !== 'cancelled')) continue;
    if (p.spent === 0 && p.received === 0) continue;
    out.push({ marketId: m.id, title: m.title, status: m.status, outcome: m.status === 'cancelled' ? 'Cancelled' : m.result !== null && m.result >= 0 ? statesOf(m)[m.result] ?? 'Settled' : 'Split', pnl: p.received - p.spent, at: m.settledAt ?? m.closedAt ?? m.openedAt });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// ---------------------------------------------------------------- ratings and money history
export interface DashRatingPoint { at: string; rating: number; rd: number; label: string }
/** Rating history of one pool from its rating events (the same series as the Career Passport). */
export function ratingSeries(events: readonly RatingEvent[], pool: PoolId | 'career' = 'career'): DashRatingPoint[] {
  // 'career': the career timeline (legacy Rapid up to the v1.1 seeding, then the career pool; src/ratings/pools.ts)
  const ev = pool === 'career' ? careerTimeline(events) : events.filter(e => e.pool === pool).sort((a, b) => a.sequence - b.sequence);
  return [
    ...(ev.length && ev[0].sequence === 1 ? [{ at: ev[0].at, rating: ev[0].before.rating, rd: ev[0].before.rd, label: 'Initial rating' }] : []),
    ...ev.map(e => ({ at: e.at, rating: e.after.rating, rd: e.after.rd, label: `${e.score === 1 ? 'Win' : e.score === 0 ? 'Loss' : 'Draw'} vs ${e.opponent.name}: ${Math.max(0, Math.round(e.after.rating))}` })),
  ];
}
export interface DashResult { gameId: string; pool: PoolId; at: string; opponent: string; score: number; delta: number; after: number }
/** Latest rated results across all pools, newest first. */
export function recentRated(events: readonly RatingEvent[], limit: number = DASH_LIMITS.results): DashResult[] {
  return [...events].sort((a, b) => b.at.localeCompare(a.at) || b.sequence - a.sequence).slice(0, limit)
    .map(e => ({ gameId: e.gameId, pool: e.pool, at: e.at, opponent: e.opponent.name, score: e.score, delta: e.delta, after: e.after.rating }));
}
/** Net worth snapshots the Federation records after transactions and rounds (empty before founding). */
export function netWorthSeries(st: DashFedState | null): { season: number; round: number; netWorth: number; cash: number }[] {
  return st ? st.finance.points.map(p => ({ season: p.season, round: p.round, netWorth: p.netWorth, cash: p.cash })) : [];
}

// ---------------------------------------------------------------- Vault and Grimoire
export interface DashVault { earned: number; total: number; latest: { id: string; name: string; at: string } | null; next: { id: string; name: string; have: number; need: number } | null }
export function vaultSummary(defs: readonly VaultDef[], owned: ReadonlyMap<string, UnlockRecord>, results: ReadonlyMap<string, EvalResult>): DashVault {
  const pool = defs.filter(earnable);
  const earned = defs.filter(d => owned.has(d.id));
  let latest: DashVault['latest'] = null;
  for (const d of earned) { const u = owned.get(d.id)!; if (!latest || u.at > latest.at || (u.at === latest.at && d.id < latest.id)) latest = { id: d.id, name: d.name, at: u.at }; }
  let next: DashVault['next'] = null, best = -1;
  for (const d of pool) {
    if (owned.has(d.id) || d.secret) continue;
    const p = results.get(d.id)?.progress;
    if (!p || p.need <= 0 || p.have >= p.need) continue;
    const f = p.have / p.need;
    if (f > best || (f === best && next && d.id < next.id)) { best = f; next = { id: d.id, name: d.name, have: p.have, need: p.need }; }
  }
  return { earned: earned.length, total: pool.length, latest, next };
}

export interface DashGrimoire { complete: number; total: number; due: number; started: boolean; next: { id: string; title: string; book: number } | null }
export function grimoireSummary(progress: Pick<GrimProgress, 'attempts' | 'completions' | 'read' | 'plan'>, nowIso: string, ix: GrimoireIndex = GRIMOIRE_INDEX): DashGrimoire {
  const total = indexChapters(ix).length;
  const plan = dailyPlan({ settings: progress.plan ?? DEFAULT_PLAN, progress, nowIso, puzzles: [], academyAttemptIds: new Set(), ix });
  return {
    complete: progress.completions.size, total, due: dueReviews(progress.attempts, nowIso).length,
    started: progress.attempts.length > 0 || progress.read.size > 0 || progress.completions.size > 0, next: plan.chapter,
  };
}
