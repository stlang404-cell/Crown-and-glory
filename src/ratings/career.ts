/**
 * Career rating origin and display (crown-career-1, docs/CAREER_RATING.md).
 *
 * Every genuinely new human career starts its Glicko-2 rating at r = 0 on the Crown scale (L1 = 800), RD 350,
 * σ 0.06, with 0 rated games and provisional status; the rating is earned only through rated results. Glicko-2 is
 * location-invariant (it works on (r − 1500)/173.7178 and only differences of ratings enter the update), so a start
 * at 0 is the same mathematics as a start at 1500 translated by −1500.
 *
 * Careers created before v0.11 ("legacy") keep their start of 1500 and their history unchanged: the origin is
 * recorded per career (IndexedDB meta record `career`), never inferred from the current build.
 *
 * Display: the stored rating is never clamped (that would break the mathematics: repeated losses at 0 make it
 * negative); the DISPLAYED career Elo is max(0, round(r)).
 */
import { isProvisional } from './glicko2';

export const CAREER_MODEL = 'crown-career-1';
/** Start of every new career (v0.11+). */
export const CAREER_START = 0;
/** Start of careers created before v0.11 (the original Glicko-2 default). */
export const LEGACY_START = 1500;
export const KNOWN_STARTS: readonly number[] = [CAREER_START, LEGACY_START];

export interface CareerRecord {
  model: typeof CAREER_MODEL;
  /** Unique id of this career (a new career gets a new id). */
  id: string;
  /** Initial Glicko-2 rating of every pool of this career. */
  ratingStart: number;
  /** 'new': created at 0 (fresh profile or Start New Career); 'legacy': existed before v0.11, keeps 1500. */
  origin: 'new' | 'legacy';
  createdAt: string;
  /** Start New Career: the archived backup of the previous career (crown-calculation-archive), if one was kept. */
  previousArchiveId?: string | null;
}

/**
 * THE initial state of every new career — the only place it is defined. Used by a brand-new database
 * (CrownDB.open, onupgradeneeded from version 0), by an old but empty database (CrownDB.loadCareer) and by Start New
 * Career (src/app/career.ts → CrownDB.startNewCareer). Every pool of the career then starts from `ratingStart`
 * (newPoolState(pool, ratingStart): r 0, RD 350, σ 0.06, 0 games, provisional). Anything else a new career starts
 * with (e.g. a starting rank) should be added to this record here, so all three paths get it.
 */
export const newCareerRecord = (nowIso: string, previousArchiveId: string | null = null): CareerRecord => ({
  model: CAREER_MODEL, id: `career:${nowIso}:${Math.random().toString(36).slice(2, 8)}`, ratingStart: CAREER_START, origin: 'new', createdAt: nowIso, previousArchiveId,
});
export const legacyCareerRecord = (nowIso: string): CareerRecord => ({
  model: CAREER_MODEL, id: 'career:legacy', ratingStart: LEGACY_START, origin: 'legacy', createdAt: nowIso,
});

/** The displayed career Elo: never negative, whole points. */
export const displayElo = (rating: number): number => Math.max(0, Math.round(rating));

/** Is this career rating established (the game's existing rule: 20+ rated games and RD ≤ 100)? */
export const isEstablished = (games: number, rd: number): boolean => !isProvisional(games, rd);

/** "0 · provisional" / "1,234". */
export function careerEloLabel(rating: number, games: number, rd: number): string {
  const v = displayElo(rating).toLocaleString('en');
  return isEstablished(games, rd) ? v : `${v} · provisional`;
}

/** Rated games still needed before the rating can become established (the RD condition may need more). */
export const gamesToEstablish = (games: number): number => Math.max(0, 20 - games);

/** Suggestion bands for matchmaking (docs/RATING_SPECTRUM.md bands). */
export const BEGINNER_BANDS = [{ lo: 0, hi: 399, label: '0–399' }, { lo: 400, hi: 799, label: '400–799' }] as const;
export const BEGINNER_BAND_MAX = 800;

/**
 * Should Play / Quick Match default to the beginner bands (0–399 and 400–799)? Yes while a new (0-start) career is
 * provisional, and for any career whose displayed rating is below 800. Legacy careers that are provisional at ~1500
 * keep their rating-based defaults.
 */
export function suggestBeginnerBands(p: { rating: number; games: number; rd: number }, ratingStart: number): boolean {
  if (displayElo(p.rating) < BEGINNER_BAND_MAX) return true;
  return ratingStart === CAREER_START && !isEstablished(p.games, p.rd);
}
