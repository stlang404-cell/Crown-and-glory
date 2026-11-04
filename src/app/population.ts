/**
 * Federation population analytics (v0.10, docs/FEDERATION_SCALE.md §0.5): computed from saved data only — each
 * competitor's current public rating (Glicko-2) and the season history stored on its record. Never the hidden
 * strength. One pass over the competitors plus one sort, so a 10,240-competitor world is analysed in a few
 * milliseconds (tests/population.test.ts measures it); the screen memoises the result per committed state.
 */
import type { Competitor } from '../federation/model';

/** Rating bands of the analytics screen (lower bound inclusive, upper bound exclusive; the last is open). */
export const RATING_BANDS: { lo: number; hi: number; label: string }[] = [
  { lo: -Infinity, hi: 400, label: '0–399' }, { lo: 400, hi: 800, label: '400–799' }, { lo: 800, hi: 1200, label: '800–1199' },
  { lo: 1200, hi: 1600, label: '1200–1599' }, { lo: 1600, hi: 2000, label: '1600–1999' }, { lo: 2000, hi: 2400, label: '2000–2399' },
  { lo: 2400, hi: 2800, label: '2400–2799' }, { lo: 2800, hi: 3200, label: '2800–3199' }, { lo: 3200, hi: 4000, label: '3200–3999' },
  { lo: 4000, hi: Infinity, label: '4000+' },
];
export const bandOf = (rating: number): number => {
  const r = Math.round(rating);
  for (let i = RATING_BANDS.length - 1; i >= 0; i--) if (r >= RATING_BANDS[i].lo) return i;
  return 0;
};

export interface PopulationStats {
  active: number; onRecord: number; retired: number; reserve: number;
  bands: number[]; mean: number; median: number; min: number; max: number;
  /** Share of active competitors rated below the player (ties count half), 0–100; null without a rating. */
  playerPercentile: number | null;
  top: Competitor[];
  /** Highest-rated active competitor of each division (index 0 = division 1). */
  strongestPerDivision: (Competitor | null)[];
  /** Per completed season, from the ratings stored in each competitor's season history. */
  seasons: { season: number; count: number; mean: number; median: number; bands: number[] }[];
}

const medianOf = (sorted: number[]) => (sorted.length ? (sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0);

export function populationStats(competitors: Iterable<Competitor>, playerRating: number | null, divisions = 8, topN = 10): PopulationStats {
  const ratings: number[] = [];
  const bands = RATING_BANDS.map(() => 0);
  const strongest: (Competitor | null)[] = Array.from({ length: divisions }, () => null);
  const top: Competitor[] = [];
  let onRecord = 0, retired = 0, reserve = 0, sum = 0;
  const hist = new Map<number, number[]>();
  for (const c of competitors) {
    onRecord++;
    for (const h of c.history) { const l = hist.get(h.season); if (l) l.push(h.rating); else hist.set(h.season, [h.rating]); }
    if (c.status === 'retired') { retired++; continue; }
    if (c.status === 'reserve') { reserve++; continue; }
    ratings.push(c.rating); sum += c.rating; bands[bandOf(c.rating)]++;
    const d = c.division - 1;
    if (d >= 0 && d < divisions && (!strongest[d] || c.rating > strongest[d]!.rating)) strongest[d] = c;
    // keep the top N without sorting everyone
    if (top.length < topN || c.rating > top[top.length - 1].rating) {
      let i = top.length; while (i > 0 && top[i - 1].rating < c.rating) i--;
      top.splice(i, 0, c); if (top.length > topN) top.pop();
    }
  }
  const sorted = Float64Array.from(ratings).sort();
  const arr = Array.from(sorted);
  let below = 0, equal = 0;
  if (playerRating !== null) for (const r of arr) { if (r < playerRating) below++; else if (r === playerRating) equal++; }
  const seasons = [...hist.keys()].sort((a, b) => a - b).map(season => {
    const rs = Array.from(Float64Array.from(hist.get(season)!).sort());
    const b = RATING_BANDS.map(() => 0); for (const r of rs) b[bandOf(r)]++;
    return { season, count: rs.length, mean: rs.reduce((a, x) => a + x, 0) / rs.length, median: medianOf(rs), bands: b };
  });
  return {
    active: arr.length, onRecord, retired, reserve, bands, mean: arr.length ? sum / arr.length : 0, median: medianOf(arr),
    min: arr[0] ?? 0, max: arr[arr.length - 1] ?? 0,
    playerPercentile: playerRating === null || !arr.length ? null : (100 * (below + equal / 2)) / arr.length,
    top, strongestPerDivision: strongest, seasons,
  };
}
