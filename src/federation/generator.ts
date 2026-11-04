/**
 * Deterministic seeded population generator. crown-population-1 (default, every pre-v0.10 world):
 * latent strength by division N(2500 − 190·(d−1), 120²) clamped to [750, 3050] on the calibrated engine
 * scale (L1 = 800 … L8 ≈ 2987). crown-population-2 (new federations from v0.10): the full 0–4,000+ spectrum,
 * src/federation/population.ts. Public ratings start at latent + N(0, 80²) with RD 120 (established
 * veterans) so that forecasts begin informative but imperfect. Names are generated from original syllables.
 */
import { mulberry32 } from '../rules/tables';
import { Competitor, StyleId, Topology, TOPOLOGY_V1 } from './model';
import { POPULATION_V1, PopulationModel, apexRegions, entrantRating, latentFrom, v1DivisionMean } from './population';

const FIRST_A = ['Al', 'Be', 'Ca', 'Da', 'El', 'Fa', 'Ga', 'Ha', 'Is', 'Jo', 'Ka', 'Le', 'Ma', 'Ne', 'Or', 'Pa', 'Qu', 'Ro', 'Sa', 'Te', 'Ul', 'Va', 'Wi', 'Ya', 'Ze', 'Mi', 'No', 'Ri', 'Lu', 'Eo'];
const FIRST_B = ['ra', 'ren', 'lia', 'mon', 'nis', 'tor', 'via', 'den', 'ric', 'sha', 'lan', 'mira', 'dov', 'ella', 'tis', 'ko', 'rin', 'sel', 'vin', 'na', 'th', 'mar', 'ise', 'dan'];
const LAST_A = ['Ash', 'Brack', 'Cold', 'Dar', 'Ever', 'Fair', 'Gold', 'Hollow', 'Iron', 'Kings', 'Lark', 'Marr', 'North', 'Oak', 'Pike', 'Quill', 'Raven', 'Stone', 'Thorn', 'Vale', 'West', 'Wren', 'Brook', 'Crane', 'Dusk', 'Fen', 'Glen', 'Hart', 'Moss', 'Rook'];
const LAST_B = ['ford', 'well', 'mere', 'wood', 'by', 'ton', 'field', 'grave', 'holt', 'stead', 'ley', 'worth', 'combe', 'ridge', 'more', 'gate', 'shaw', 'bury', 'den', 'hurst'];
export const STYLES: StyleId[] = ['universal', 'tactical', 'positional', 'defensive', 'endgame', 'aggressive'];

export function normal(r: () => number): number {
  const u = Math.max(1e-12, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const rng01 = (seed: number) => { const m = mulberry32(seed); return () => m() / 4294967296; };
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) for (const c of String(p) + '|') h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

/** crown-population-1 division mean (unchanged). */
export function divisionMean(d: number): number { return v1DivisionMean(d); }

export function makeName(r: () => number, used: Set<string>): string {
  for (let k = 0; k < 50; k++) {
    const f = FIRST_A[Math.floor(r() * FIRST_A.length)] + FIRST_B[Math.floor(r() * FIRST_B.length)];
    const l = LAST_A[Math.floor(r() * LAST_A.length)] + LAST_B[Math.floor(r() * LAST_B.length)];
    const n = `${f} ${l}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = `Competitor ${used.size + 1}`;
  used.add(n);
  return n;
}

export function makeCompetitor(seed: number, index: number, region: number, division: number, season: number, used: Set<string>, entrant = false, model: PopulationModel = POPULATION_V1, apex = false): Competitor {
  const r = rng01(hashSeed(seed, 'competitor', index, season));
  // one normal draw in every model, so the rest of the record (name, age, style) uses the same random stream
  // crown-population-2 also needs a division-overlap jitter: from its own stream, so names/ages/styles stay identical
  const z2 = model === POPULATION_V1 ? 0 : normal(rng01(hashSeed(seed, 'spread', index, season)));
  const latent = latentFrom(model, division, normal(r), apex, z2);
  const rating = entrant ? entrantRating(model, division) : Math.max(0, Math.round(latent + 80 * normal(r)));
  const age = entrant ? 17 + Math.floor(r() * 5) : 18 + Math.floor(r() * 22);
  return {
    id: `c${String(index).padStart(4, '0')}`,
    name: makeName(r, used),
    portraitSeed: hashSeed(seed, 'portrait', index) % 100000,
    region, division,
    birthSeason: season - (age - 20),
    style: STYLES[Math.floor(r() * STYLES.length)],
    latent: Math.round(latent),
    rating, rd: entrant ? 300 : 120, sigma: 0.06,
    form: '', reputation: entrant ? 5 : Math.round(Math.max(0, Math.min(60, (9 - division) * 7 + 5 * normal(r)))),
    titles: [], earnings: 0, stats: { w: 0, d: 0, l: 0 }, history: [], milestones: [],
    status: 'active', joinedSeason: season, retiredSeason: null,
  };
}

/** Generate the initial competitors (2,048 for crown-topology-1; deterministic for a world seed, topology and
 *  population model). The default model is crown-population-1, so every pre-v0.10 seed regenerates identically. */
export function generateFederation(seed: number, topology: Topology = TOPOLOGY_V1, model: PopulationModel = POPULATION_V1): Competitor[] {
  const used = new Set<string>();
  const out: Competitor[] = [];
  const apex = model === POPULATION_V1 ? new Set<number>() : apexRegions(seed, topology, hashSeed);
  let i = 0;
  for (let region = 0; region < topology.regions; region++) for (let division = 1; division <= topology.divisions; division++) for (let k = 0; k < topology.divisionSize; k++) {
    out.push(makeCompetitor(seed, i++, region, division, 1, used, false, model, division === 1 && k === 0 && apex.has(region)));
  }
  return out;
}

export const ageOf = (c: Competitor, season: number) => 20 + (season - c.birthSeason);
