/**
 * Career rating pool (crown-career-pool-1, docs/CAREER_RATING.md §7).
 *
 * THE career Elo shown everywhere — identity header, Play, Quick Match, Passport, ranks and percentiles, Vault facts,
 * trophies, Played Like comparisons, the Federation's player rating (pairings, divisions, ranks) and backups — is the
 * Glicko-2 state of ONE pool, `CAREER_POOL`. Every surface reads it through this module (never a literal pool id).
 *
 * v1.1 (Grand Classical update): human-rated play needs a base of 30+ minutes, and all of it is rated in the new
 * 'classical-long' pool. Each existing career's pool is SEEDED ONCE from its measured Rapid rating (the career pool
 * until v1.0): same rating, RD = max(RD, 150), σ kept, rated-game count carried for the provisional rule — standard
 * Glicko practice when a player moves to a new pool (the rating carries over, the uncertainty grows). The seed is
 * recorded with provenance on the pool state (`PoolState.seed`) and in the meta record `careerPoolSeed`; it is never
 * repeated. A career with no rated Rapid games is not seeded: its pool starts at the career's origin (0 ±350 for a
 * new career, docs/CAREER_RATING.md). Legacy pools (rapid, blitz, classical 15+10) keep their histories.
 */
import type { PoolId } from '../games/types';
import type { PoolState, RatingEvent } from './ledger';

export const CAREER_POOL_MODEL = 'crown-career-pool-1';
/** The career pool: every rated game of 30+ minutes (src/games/types.ts `poolFor`). */
export const CAREER_POOL: PoolId = 'classical-long';
/** The pool that was the career Elo until v1.0 (seed source). */
export const LEGACY_CAREER_POOL: PoolId = 'rapid';
/** Seeding rule: the new pool's RD is at least this (a new pool is less certain than the old one). */
export const SEED_MIN_RD = 150;

export const POOL_LABEL: Record<PoolId, string> = {
  'classical-long': 'Long Classical',
  rapid: 'Rapid (legacy)',
  blitz: 'Blitz (legacy)',
  classical: 'Classical 15+10 (legacy)',
};
/** Display order: the career pool first, then the legacy pools. */
export const POOL_ORDER: readonly PoolId[] = ['classical-long', 'rapid', 'blitz', 'classical'];
export const isLegacyPool = (p: PoolId): boolean => p !== CAREER_POOL;

/** Provenance of a seeded career pool. */
export interface PoolSeed {
  model: typeof CAREER_POOL_MODEL;
  from: PoolId;
  at: string;
  /** The source pool's state at seeding time (rating, RD, σ, rated games, last event). */
  source: { rating: number; rd: number; sigma: number; games: number; lastEventId: string | null };
  rule: string;
}
export const SEED_RULE = `rating kept, RD = max(RD, ${SEED_MIN_RD}), volatility kept, rated games carried for the provisional rule`;

/** The seeded career pool state for a measured source pool (pure). W/D/L start at 0: they count this pool's games. */
export function seededPoolState(source: PoolState, at: string, pool: PoolId = CAREER_POOL): PoolState {
  const seed: PoolSeed = {
    model: CAREER_POOL_MODEL, from: source.pool, at,
    source: { rating: source.rating, rd: source.rd, sigma: source.sigma, games: source.games, lastEventId: source.lastEventId },
    rule: SEED_RULE,
  };
  return {
    pool, rating: source.rating, rd: Math.max(source.rd, SEED_MIN_RD), sigma: source.sigma,
    games: source.games, wins: 0, draws: 0, losses: 0, peak: null, lowest: null, lastEventId: null, updatedAt: at, seed,
  };
}

/** Should this career's pool be seeded now? Exactly when it has never been written and the source has rated games. */
export const shouldSeed = (career: PoolState | undefined, careerEvents: number, source: PoolState | undefined): source is PoolState =>
  !career && careerEvents === 0 && !!source && source.games > 0;

/**
 * The career's rating timeline: the legacy Rapid events up to the seeding point, then the career pool's own events.
 * Because the career pool continues the Rapid rating, the concatenation is one continuous line (used by peaks,
 * insignias, milestones and charts). A career pool that was not seeded (a new career) is its own timeline. Before
 * the first career-pool game the timeline is the Rapid history.
 */
export function careerTimeline(events: readonly RatingEvent[]): RatingEvent[] {
  const legacy = events.filter(e => e.pool === LEGACY_CAREER_POOL).sort((a, b) => a.sequence - b.sequence);
  const own = events.filter(e => e.pool === CAREER_POOL).sort((a, b) => a.sequence - b.sequence);
  if (!own.length) return legacy;
  const carried = own[0].gamesBefore; // seeded pools carry the Rapid game count; 0 when not seeded
  return [...legacy.filter(e => e.sequence <= carried), ...own];
}

/** Rated games played in the career pool itself (excluding games carried from Rapid at seeding). */
export const ownGames = (p: PoolState): number => p.games - (p.seed?.source.games ?? 0);
