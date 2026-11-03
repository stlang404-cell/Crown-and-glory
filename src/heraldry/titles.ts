/**
 * Federation titles (crown-titles-1) — clearly fictional honours of the Six-Square Federation, NOT FIDE titles.
 * Modelled on how real title systems reward *sustained* performance (FIDE Title Regulations: titles are permanent,
 * and the higher ones require several "norms" — minimum tournament performances over a minimum number of games
 * against opponents above a rating floor — plus a rating requirement):
 *
 *   norm  = one completed event (league season, Swiss, or Crown Championship) with ≥ 5 games where the
 *           performance rating (average opponent rating + dp, dp = −400·log10(1/p − 1) for score fraction p,
 *           capped at ±800 for 100% / 0% — the Elo inverse used by performance-rating tables) reaches a tier's
 *           threshold AND the opponents' average rating reaches that tier's floor.
 *   title = the required number of norms of that tier (or higher) over a minimum total number of norm games,
 *           a peak rating (established — RD ≤ 100 — for Knight and above), and for the top two an event honour.
 *
 * Titles are permanent, are distinct from rating ranks (temporary bands) and from league positions, and are
 * computed only from recorded results.
 */
import { FED_TITLES, type FedTitle } from './catalog';

export interface Norm { event: string; season: number; games: number; score: number; avgOpp: number; tpr: number; tier: FedTitle | null }
export interface TitleRule { title: FedTitle; tpr: number; oppFloor: number; norms: number; normGames: number; peak: number; established: boolean; honour: 'none' | 'any-title' | 'championship-final' }
export const TITLE_RULES: TitleRule[] = [
  { title: 'Squire', tpr: 1700, oppFloor: 1100, norms: 1, normGames: 5, peak: 1600, established: false, honour: 'none' },
  { title: 'Knight', tpr: 2000, oppFloor: 1500, norms: 2, normGames: 15, peak: 1900, established: true, honour: 'none' },
  { title: 'Paladin', tpr: 2300, oppFloor: 1800, norms: 3, normGames: 27, peak: 2200, established: true, honour: 'any-title' },
  { title: 'Sovereign', tpr: 2600, oppFloor: 2100, norms: 3, normGames: 27, peak: 2500, established: true, honour: 'championship-final' },
];
export const TITLES_ID = 'crown-titles-1';
export const MIN_NORM_GAMES = 5;

/** Performance rating: average opposition + Elo-inverse rating difference of the score fraction (±800 cap). */
export function performance(avgOpp: number, score: number, n: number): number {
  if (n <= 0) return 0;
  const p = score / n;
  const dp = p >= 1 ? 800 : p <= 0 ? -800 : Math.max(-800, Math.min(800, -400 * Math.log10(1 / p - 1)));
  return Math.round(avgOpp + dp);
}
/** The highest tier a single event performance qualifies for (null if none). */
export function normTier(tpr: number, avgOpp: number, games: number): FedTitle | null {
  if (games < MIN_NORM_GAMES) return null;
  let best: FedTitle | null = null;
  for (const r of TITLE_RULES) if (tpr >= r.tpr && avgOpp >= r.oppFloor) best = r.title;
  return best;
}
export function makeNorm(event: string, season: number, results: { score: number; oppRating: number }[]): Norm | null {
  const n = results.length;
  if (n < MIN_NORM_GAMES) return null;
  const score = results.reduce((a, r) => a + r.score, 0);
  const avgOpp = Math.round(results.reduce((a, r) => a + r.oppRating, 0) / n);
  const tpr = performance(avgOpp, score, n);
  const tier = normTier(tpr, avgOpp, n);
  return tier ? { event, season, games: n, score, avgOpp, tpr, tier } : null;
}

export interface TitleCandidate { norms: Norm[]; peakRating: number; establishedPeak: number; honours: string[]; current: FedTitle | null }
/** Highest title the record supports (never lower than the current one: titles are permanent). */
export function earnedTitle(c: TitleCandidate): FedTitle | null {
  let best: FedTitle | null = c.current;
  const rank = (t: FedTitle | null) => (t ? FED_TITLES.indexOf(t) : -1);
  for (const r of TITLE_RULES) {
    const qualifying = c.norms.filter(n => n.tier && rank(n.tier) >= rank(r.title));
    const games = qualifying.reduce((a, n) => a + n.games, 0);
    const peak = r.established ? c.establishedPeak : c.peakRating;
    const honourOk = r.honour === 'none' || (r.honour === 'any-title' ? c.honours.length > 0 : c.honours.some(h => /Crown Champion|Championship finalist/.test(h)));
    if (qualifying.length >= r.norms && games >= r.normGames && peak >= r.peak && honourOk && rank(r.title) > rank(best)) best = r.title;
  }
  return best;
}
/** Human-readable progress toward the next title. */
export function nextTitleProgress(c: TitleCandidate): { next: FedTitle | null; lines: string[] } {
  const rank = (t: FedTitle | null) => (t ? FED_TITLES.indexOf(t) : -1);
  const r = TITLE_RULES.find(x => rank(x.title) > rank(c.current));
  if (!r) return { next: null, lines: ['Highest federation title held.'] };
  const q = c.norms.filter(n => n.tier && rank(n.tier) >= rank(r.title));
  const peak = r.established ? c.establishedPeak : c.peakRating;
  return {
    next: r.title,
    lines: [
      `Norms at ${r.tpr}+ performance vs ${r.oppFloor}+ average opposition: ${q.length}/${r.norms} (${q.reduce((a, n) => a + n.games, 0)}/${r.normGames} games)`,
      `${r.established ? 'Established peak' : 'Peak'} rating (recorded at each federation round): ${peak > 0 ? Math.round(peak) : 'none yet'}/${r.peak}`,
      ...(r.honour === 'any-title' ? [`An event title: ${c.honours.length ? 'yes' : 'not yet'}`] : r.honour === 'championship-final' ? [`A Crown Championship final: ${c.honours.some(h => /Crown Champion|Championship finalist/.test(h)) ? 'yes' : 'not yet'}`] : []),
    ],
  };
}
