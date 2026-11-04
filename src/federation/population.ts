/**
 * Strength spectrum of the federation population (v0.10, docs/RATING_SPECTRUM.md).
 *
 * crown-population-1 (v0.3–v0.9): latent ~ N(2500 − 190·(d−1), 120²) clamped to [750, 3050]. Division 8 averaged 1170,
 *   so the Federation had almost nobody below 800 and nobody above 3050.
 * crown-population-2 (v0.10, new federations): the eight divisions span the whole Crown scale, from genuine beginners
 *   (division 8, centred near 350, playing the calibrated sub-800 levels L0a–L0d) to the Crown Division (centred near
 *   3050), plus a tiny apex (latent ≥ 4,000: one per 1,024 competitors). Lower divisions are packed closer together
 *   than upper ones, so the low bands hold more people than the high ones (a pyramid, within the fixed 8 × 16 rule).
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
/** crown-population-2 apex: latent 4000 + 120·|z| for one Crown Division competitor per 1,024 competitors. */
export const APEX_BASE = 4000;
export const APEX_PER = 1024;

/** crown-population-2 division centres and spreads (division 1 = Crown … 8 = Open). */
export const V2_DIVISIONS: { mean: number; sd: number }[] = [
  { mean: 3050, sd: 200 }, { mean: 2600, sd: 190 }, { mean: 2150, sd: 180 }, { mean: 1720, sd: 170 },
  { mean: 1320, sd: 160 }, { mean: 960, sd: 150 }, { mean: 640, sd: 150 }, { mean: 340, sd: 160 },
];
/** v1 division mean (unchanged formula). */
export const v1DivisionMean = (d: number): number => 2500 - 190 * (d - 1);
export const v2DivisionMean = (d: number): number => V2_DIVISIONS[Math.max(1, Math.min(8, d)) - 1].mean;
const clampLatent = (x: number) => Math.max(LATENT_MIN, Math.min(LATENT_MAX, x));

/** The model an entrant is drawn from: v2 worlds use v2; legacy worlds use v2 only for the two bottom divisions. */
export const entrantModel = (world: PopulationModel, division: number): PopulationModel =>
  world === POPULATION_V2 || division >= 7 ? POPULATION_V2 : POPULATION_V1;

/** Latent from one standard-normal draw `z` (the generator draws it; one draw per competitor in every model). */
export function latentFrom(model: PopulationModel, division: number, z: number, apex = false): number {
  if (model === POPULATION_V1) return Math.max(750, Math.min(3050, v1DivisionMean(division) + 120 * z));
  if (apex) return clampLatent(APEX_BASE + 120 * Math.abs(z));
  const { mean, sd } = V2_DIVISIONS[Math.max(1, Math.min(8, division)) - 1];
  return clampLatent(mean + sd * z);
}
/** Public starting rating of an entrant (RD 300): the centre of its model's division. */
export const entrantRating = (model: PopulationModel, division: number): number => (model === POPULATION_V1 ? v1DivisionMean(division) : v2DivisionMean(division));

/** Regions whose Crown Division top slot holds an apex competitor in a new crown-population-2 world (seeded). */
export function apexRegions(seed: number, topology: Topology, hash: (...p: (string | number)[]) => number): Set<number> {
  const n = Math.max(1, Math.round((topology.regions * topology.divisions * topology.divisionSize) / APEX_PER));
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
