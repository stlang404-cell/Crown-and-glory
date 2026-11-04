/**
 * Random Federation Quick Match (v0.9): pick one opponent uniformly at random from the persistent Federation roster.
 * Selection is NOT rating-weighted: every eligible competitor has the same chance. Filters only narrow the pool.
 * Pure functions; the caller supplies the random source (seeded in tests, Math.random in play).
 */
import type { Competitor } from './model';
import { PLAYER_ID } from './model';

export type QuickPool = 'beginner' | 'anyone' | 'near' | 'higher' | 'elite';
export const QUICK_POOLS: { id: QuickPool; label: string; detail: string }[] = [
  { id: 'beginner', label: 'Beginner Bands', detail: 'Competitors rated 0–399 and 400–799 (suggested while your career Elo is provisional or under 800)' },
  { id: 'anyone', label: 'Anyone', detail: 'Any active competitor in the Federation, any rating' },
  { id: 'near', label: 'Near My Rating', detail: 'Within 200 points of your rating' },
  { id: 'higher', label: 'Higher Rated', detail: 'Rated above you' },
  { id: 'elite', label: 'Elite and Sovereign', detail: 'Rated 2400 or more' },
];
export const NEAR_RANGE = 200;
export const ELITE_MIN = 2400;
/** Beginner bands 0–399 and 400–799 (docs/CAREER_RATING.md). */
export const BEGINNER_MAX = 800;

/** Active competitors only: reserves and retired players do not take challenges. */
export function eligiblePool(all: Iterable<Competitor>, pool: QuickPool, myRating: number): Competitor[] {
  const out: Competitor[] = [];
  for (const c of all) {
    if (c.id === PLAYER_ID || c.status !== 'active') continue;
    if (pool === 'near' && Math.abs(c.rating - myRating) > NEAR_RANGE) continue;
    if (pool === 'higher' && !(c.rating > myRating)) continue;
    if (pool === 'elite' && c.rating < ELITE_MIN) continue;
    if (pool === 'beginner' && !(c.rating < BEGINNER_MAX)) continue;
    out.push(c);
  }
  return out;
}

/** Uniform choice; `rng` returns [0, 1). Optionally avoids repeating the previous pick when another exists. */
export function pickOpponent(pool: Competitor[], rng: () => number, avoidId?: string): Competitor | null {
  if (!pool.length) return null;
  if (pool.length > 1 && avoidId) {
    const others = pool.filter(c => c.id !== avoidId);
    return others[Math.floor(rng() * others.length)];
  }
  return pool[Math.floor(rng() * pool.length)];
}

/** Small deterministic generator for tests and reproducible draws (mulberry32). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
