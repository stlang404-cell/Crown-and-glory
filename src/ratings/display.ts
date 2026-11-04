/**
 * Career Elo display (crown-career-elo-display-1). The "career Elo" shown everywhere in the game IS the Glicko-2
 * rating (src/ratings/glicko2.ts) on the Crown scale (anchored at engine level L1 = 800, docs/ENGINE_BENCHMARKS.md).
 * It is not a FIDE rating and is not comparable with one. See docs/LEGACY.md.
 *
 * One shared formatter keeps every surface consistent:
 *  - the displayed value is max(0, round(r)): a stored Glicko-2 rating may dip below 0 (new careers start at a very
 *    low rating with a high RD), but no surface ever prints a negative career Elo;
 *  - "±RD" is shown where there is room;
 *  - a provisional rating is LABELLED ("provisional"), never ranked or compared;
 *  - a rating change is computed from the displayed values: stored −40 → −10 displays "0 → 0 (+0)".
 */
import { isProvisional } from './glicko2';

export const CAREER_ELO_ID = 'crown-career-elo-display-1';

/** The displayed career Elo for a stored Glicko-2 rating. */
export const displayCareerElo = (r: number): number => (Number.isFinite(r) ? Math.max(0, Math.round(r)) : 0);

/** Thousands separators (1,427), fixed locale so screenshots and tests are stable. */
export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');

export interface EloFormat { rd?: number | null; provisional?: boolean; /** omit "±RD" (tight spaces) */ compact?: boolean }

/** "1,427 ±45", "1,427", "0 ±350 · provisional" (or "0 · provisional" when compact). */
export function fmtCareerElo(r: number, o: EloFormat = {}): string {
  const v = fmtInt(displayCareerElo(r));
  const rd = !o.compact && o.rd !== undefined && o.rd !== null && Number.isFinite(o.rd) ? ` ±${Math.round(o.rd)}` : '';
  return `${v}${rd}${o.provisional ? ' · provisional' : ''}`;
}

/** Provisional rule shared with the rating ledger (20 rated games and RD ≤ 100 to be established). */
export const careerProvisional = (games: number, rd: number): boolean => isProvisional(games, rd);

export interface RatingChange { previous: number; next: number; delta: number; text: string; deltaText: string }
/** "Previous 1,427 → New 1,445 (+18)" from two stored ratings, using displayed values only. */
export function ratingChange(before: number, after: number): RatingChange {
  const previous = displayCareerElo(before), next = displayCareerElo(after);
  const delta = next - previous;
  const deltaText = `${delta >= 0 ? '+' : '−'}${fmtInt(Math.abs(delta))}`;
  return { previous, next, delta, deltaText, text: `Previous ${fmtInt(previous)} → New ${fmtInt(next)} (${deltaText})` };
}

/** Short tooltip used next to career Elo numbers. */
export const CAREER_ELO_NOTE = 'Career Elo: the Glicko-2 rating on the Crown scale (not FIDE).';
