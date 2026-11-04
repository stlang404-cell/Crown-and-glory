/**
 * Strength spectrum of the federation population (v0.10, docs/RATING_SPECTRUM.md).
 *
 * crown-population-1 (v0.3–v0.9): latent ~ N(2500 − 190·(d−1), 120²) clamped to [750, 3050]. Division 8 averaged 1170,
 *   so the Federation had almost nobody below 800 and nobody above 3050.
 * crown-population-2 (v0.10, new federations): the population follows the owner's target pyramid (TARGET_PER_10K)
 *   across the whole Crown scale. Each division owns one eighth of the population quantiles (with a small overlap),
 *   so division 8 holds genuine beginners (0–~600, playing the calibrated sub-800 levels L0a–L0d) and the Crown
 *   Division the strongest eighth (~2,000 up, plus a tiny 4,000+ apex). Ratings then move only through results.
 *
 * Existing worlds are never rescaled: a world without `populationModel` is crown-population-1 and keeps every
 * competitor's latent, rating and history. From v0.10 its season-turnover entrants into divisions 7–8 come from the
 * crown-population-2 beginner distribution (an expanded lower tier); entrants elsewhere keep the v1 rule.
 */
import type { Topology } from './model';

export type PopulationModel = 'crown-population-1' | 'crown-population-2';
export const POPULATION_V1: PopulationModel = 'crown-population-1';
export const POPULATION_V2: PopulationModel = 'crown-population-2';
/** Population model given to NEWLY founded federations (stored in the world record; existing worlds keep theirs). */
export const NEW_FEDERATION_POPULATION: PopulationModel = POPULATION_V2;
export const populationModelOf = (world?: { populationModel?: PopulationModel } | null): PopulationModel => world?.populationModel ?? POPULATION_V1;

/** Latent bounds for every world from v0.10 (drift and new competitors). v1 generation keeps its own [750, 3050]. */
export const LATENT_MIN = 0;
export const LATENT_MAX = 4400;

/**
 * The owner's v1.0 target pyramid per 10,000 competitors (docs/V10_PLAN.md, binding): 0–399 500, 400–799 1,500,
 * 800–1199 2,500, 1200–1599 2,600, 1600–1999 1,700, 2000–2399 800, 2400–2799 280, 2800–3199 90, 3200+ 30.
 * Refinement (documented in docs/RATING_SPECTRUM.md): the 3200+ share is split 22 (3200–3599) / 8 (3600–3999) so the
 * top thins out, and a separate apex (APEX_BASE + 120·|z|) supplies the "few 4,000+".
 * Latent is linear within a band, so the cumulative distribution is piecewise linear.
 */
export const TARGET_PER_10K: { lo: number; hi: number; n: number }[] = [
  { lo: 0, hi: 400, n: 500 }, { lo: 400, hi: 800, n: 1500 }, { lo: 800, hi: 1200, n: 2500 }, { lo: 1200, hi: 1600, n: 2600 },
  { lo: 1600, hi: 2000, n: 1700 }, { lo: 2000, hi: 2400, n: 800 }, { lo: 2400, hi: 2800, n: 280 }, { lo: 2800, hi: 3200, n: 90 },
  { lo: 3200, hi: 3600, n: 22 }, { lo: 3600, hi: 4000, n: 8 },
];
/** Apex: latent 4000 + 120·|z| for max(2, round(population / 3,000)) Crown-Division competitors (2 in 2,048; 3 in 10,000). */
export const APEX_BASE = 4000;
export const APEX_PER = 3000;
export const apexCount = (population: number): number => Math.max(2, Math.round(population / APEX_PER));
/** Overlap of neighbouring divisions: sd of the quantile jitter (one division is 1/8 = 0.125 of the population). */
export const DIVISION_OVERLAP = 0.04;

/** Latent at population quantile p ∈ [0, 1] (0 = weakest) of the target pyramid. */
export function latentAtQuantile(p: number): number {
  const q = Math.max(0, Math.min(1, p)) * 10000;
  let acc = 0;
  for (const b of TARGET_PER_10K) {
    if (q <= acc + b.n) return b.lo + ((q - acc) / b.n) * (b.hi - b.lo);
    acc += b.n;
  }
  return TARGET_PER_10K[TARGET_PER_10K.length - 1].hi;
}
/** Standard normal CDF (Abramowitz–Stegun 7.1.26; |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}
/** Reflect into [0, 1]: keeps a uniform marginal uniform under symmetric jitter, so band counts stay on target. */
const reflect01 = (x: number) => { let y = x; for (let k = 0; k < 4 && (y < 0 || y > 1); k++) y = y < 0 ? -y : 2 - y; return Math.max(0, Math.min(1, y)); };
/** Division d (1 = Crown … 8 = Open) owns the population quantiles [(8 − d)/8, (9 − d)/8), jittered by DIVISION_OVERLAP. */
export function divisionQuantile(division: number, u: number, jitter: number): number {
  const slot = 8 - Math.max(1, Math.min(8, division));
  return reflect01((slot + u) / 8 + DIVISION_OVERLAP * jitter);
}
/** v1 division mean (unchanged formula). */
export const v1DivisionMean = (d: number): number => 2500 - 190 * (d - 1);
/** crown-population-2 division median (entrants' public starting rating). */
export const v2DivisionMedian = (d: number): number => Math.round(latentAtQuantile((8 - Math.max(1, Math.min(8, d)) + 0.5) / 8));
const clampLatent = (x: number) => Math.max(LATENT_MIN, Math.min(LATENT_MAX, x));

/** The model an entrant is drawn from: v2 worlds use v2; legacy worlds use v2 only for the two bottom divisions. */
export const entrantModel = (world: PopulationModel, division: number): PopulationModel =>
  world === POPULATION_V2 || division >= 7 ? POPULATION_V2 : POPULATION_V1;

/**
 * Latent from the competitor's standard-normal draw `z` (one per competitor in every model) and, for crown-population-2,
 * an independent jitter draw `z2` (from its own seeded stream, so identities are the same in both models).
 * v2: u = Φ(z) is uniform; the competitor sits at quantile divisionQuantile(d, u, z2) of the target pyramid.
 */
export function latentFrom(model: PopulationModel, division: number, z: number, apex = false, z2 = 0): number {
  if (model === POPULATION_V1) return Math.max(750, Math.min(3050, v1DivisionMean(division) + 120 * z));
  if (apex) return clampLatent(APEX_BASE + 120 * Math.abs(z));
  return clampLatent(latentAtQuantile(divisionQuantile(division, normalCdf(z), z2)));
}
/** Public starting rating of an entrant (RD 300): the centre of its model's division. */
export const entrantRating = (model: PopulationModel, division: number): number => (model === POPULATION_V1 ? v1DivisionMean(division) : v2DivisionMedian(division));

/** Regions whose Crown Division top slot holds an apex competitor in a new crown-population-2 world (seeded). */
export function apexRegions(seed: number, topology: Topology, hash: (...p: (string | number)[]) => number): Set<number> {
  const n = apexCount(topology.regions * topology.divisions * topology.divisionSize);
  const out = new Set<number>();
  for (let k = 0; out.size < Math.min(n, topology.regions); k++) out.add(hash(seed, 'apex', k) % topology.regions);
  return out;
}

/** Rating bands used in docs and tests (400 points wide up to 3,200; then 3,200–3,999 and the 4,000+ apex). */
export const BANDS: { label: string; lo: number; hi: number }[] = [
  { label: '0–399', lo: -Infinity, hi: 400 }, { label: '400–799', lo: 400, hi: 800 }, { label: '800–1199', lo: 800, hi: 1200 },
  { label: '1200–1599', lo: 1200, hi: 1600 }, { label: '1600–1999', lo: 1600, hi: 2000 }, { label: '2000–2399', lo: 2000, hi: 2400 },
  { label: '2400–2799', lo: 2400, hi: 2800 }, { label: '2800–3199', lo: 2800, hi: 3200 }, { label: '3200–3999', lo: 3200, hi: 4000 },
  { label: '4000+', lo: 4000, hi: Infinity },
];
export function bandCounts(values: number[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(BANDS.map(b => [b.label, 0]));
  for (const v of values) { const b = BANDS.find(x => v >= x.lo && v < x.hi)!; out[b.label]++; }
  return out;
}
