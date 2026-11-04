/**
 * Rating event ledger. Every rated result produces one immutable, explainable, reproducible event.
 * Replaying all events of a pool from the initial rating reproduces the current state exactly.
 */
import { DEFAULTS, GLICKO_MODEL, Rating, expectedScore, initialRating, isProvisional, updateRating } from './glicko2';
import type { PoolId } from '../games/types';

export const RATING_POLICY = 'crown-rating-policy-1';

export interface PoolState extends Rating {
  pool: PoolId;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  peak: number | null; // established (non-provisional) peak only
  lowest: number | null; // established lowest only
  lastEventId: string | null;
  updatedAt: string | null;
}

export interface RatingEvent {
  id: string; // idempotency key: rating:<gameId>:<pool>
  schemaVersion: 1;
  model: string;
  policy: string;
  pool: PoolId;
  sequence: number; // 1-based within pool
  gameId: string;
  at: string;
  opponent: { id: string; name: string; rating: number; rd: number; calibrationId: string };
  score: number; // 1/0.5/0
  expected: number;
  before: Rating;
  after: Rating;
  delta: number;
  provisionalBefore: boolean;
  provisionalAfter: boolean;
  gamesBefore: number;
  rankBefore: string;
  rankAfter: string;
  explanation: { v: number; delta: number; g: number; tau: number; iterations: number };
}

/** A pool before its first rated game. `start` is the career's rating origin (src/ratings/career.ts): 0 for careers
 *  created from v0.11, 1500 (the default here) for older careers. The storage layer always passes the career's own. */
export const newPoolState = (pool: PoolId, start: number = DEFAULTS.rating): PoolState => ({
  pool, ...initialRating(start), games: 0, wins: 0, draws: 0, losses: 0, peak: null, lowest: null, lastEventId: null, updatedAt: null,
});

/** Rank ladder (policy crown-rank-0): rating-only bands until federation qualification exists (M3). */
export const RANK_POLICY = 'crown-rank-0';
export const RANKS: { name: string; min: number }[] = [
  { name: 'Club', min: 0 },
  { name: 'District', min: 1300 },
  { name: 'Regional', min: 1500 },
  { name: 'National', min: 1700 },
  { name: 'Master Circuit', min: 1900 },
  { name: 'Crown Contender', min: 2100 },
];
export function rankFor(rating: number, games: number, rd: number): string {
  if (isProvisional(games, rd)) return 'Provisional';
  let r = RANKS[0].name;
  for (const k of RANKS) if (rating >= k.min) r = k.name;
  return r;
}

export function computeRatingEvent(
  state: PoolState,
  gameId: string,
  at: string,
  opponent: RatingEvent['opponent'],
  score: number,
): { event: RatingEvent; next: PoolState } {
  const before: Rating = { rating: state.rating, rd: state.rd, sigma: state.sigma };
  const { after, explanation } = updateRating(before, [{ rating: opponent.rating, rd: opponent.rd, score }]);
  const games = state.games + 1;
  const provisionalAfter = isProvisional(games, after.rd);
  const event: RatingEvent = {
    id: `rating:${gameId}:${state.pool}`,
    schemaVersion: 1,
    model: GLICKO_MODEL,
    policy: RATING_POLICY,
    pool: state.pool,
    sequence: games,
    gameId,
    at,
    opponent,
    score,
    expected: expectedScore(before, opponent),
    before,
    after,
    delta: after.rating - before.rating,
    provisionalBefore: isProvisional(state.games, state.rd),
    provisionalAfter,
    gamesBefore: state.games,
    rankBefore: rankFor(state.rating, state.games, state.rd),
    rankAfter: rankFor(after.rating, games, after.rd),
    explanation: { v: explanation!.v, delta: explanation!.delta, g: explanation!.g[0], tau: DEFAULTS.tau, iterations: explanation!.iterations },
  };
  const next: PoolState = {
    ...state,
    ...after,
    games,
    wins: state.wins + (score === 1 ? 1 : 0),
    draws: state.draws + (score === 0.5 ? 1 : 0),
    losses: state.losses + (score === 0 ? 1 : 0),
    peak: provisionalAfter ? state.peak : Math.max(state.peak ?? -Infinity, after.rating),
    lowest: provisionalAfter ? state.lowest : Math.min(state.lowest ?? Infinity, after.rating),
    lastEventId: event.id,
    updatedAt: at,
  };
  return { event, next };
}

/** Replay a pool's ledger from scratch; used for audit tests and corruption checks. `start` is the career's rating
 *  origin; when omitted it is read from the first event (each event records the state before it). */
export function replayLedger(pool: PoolId, events: RatingEvent[], start?: number): PoolState {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
  let s = newPoolState(pool, start ?? (sorted[0]?.sequence === 1 ? sorted[0].before.rating : DEFAULTS.rating));
  for (const e of sorted) {
    s = computeRatingEvent(s, e.gameId, e.at, e.opponent, e.score).next;
  }
  return s;
}

/** Plain-language explanation of a rating change. */
export function explainEvent(e: RatingEvent): string {
  const exp = (e.expected * 100).toFixed(0);
  const outcome = e.score === 1 ? 'won' : e.score === 0 ? 'lost' : 'drew';
  const sign = e.delta >= 0 ? '+' : '';
  return `You ${outcome} against ${e.opponent.name} (${Math.round(e.opponent.rating)} ±${Math.round(e.opponent.rd)}). ` +
    `Your expected score was ${exp}% and you scored ${e.score * 100}%, so your rating moved ${sign}${e.delta.toFixed(1)}. ` +
    `Uncertainty (RD) went from ${Math.round(e.before.rd)} to ${Math.round(e.after.rd)}; ` +
    `larger uncertainty makes single results move the rating more.`;
}
