/**
 * Federation data model (crown-federation-1). Topology from research doc 08: 16 regions × 8 ordered
 * divisions × 16 competitors = 2,048 AI competitors. Strength ("latent") is on the calibrated engine scale
 * (src/engine/calibration.json); the public federation rating is a Glicko-2 estimate updated only from results.
 */
export const FEDERATION_ID = 'crown-federation-1';
export const REGIONS = 16;
export const DIVISIONS = 8;
export const DIVISION_SIZE = 16;
export const LEAGUE_ROUNDS = 15;
export const SWISS_ROUNDS = [4, 5, 6, 7, 8];
export const CHAMPIONSHIP_ROUNDS = [16, 17, 18, 19];
export const CLUB_ROUNDS = [10, 11];
export const ROUNDS_PER_SEASON = 19;

/**
 * Federation topology (docs/FEDERATION_SCALE.md). Only the number of regions varies: eight divisions (league pools,
 * Swiss bands, labels) and sixteen per circuit (a 15-round single round robin) are part of the competition rules.
 * A world records its topology when founded; a world without the field is the original crown-topology-1
 * (16 regions, 2,048 competitors) — existing saves never change size.
 */
export interface Topology { id: string; regions: number; divisions: number; divisionSize: number }
export const TOPOLOGY_V1: Topology = { id: 'crown-topology-1', regions: REGIONS, divisions: DIVISIONS, divisionSize: DIVISION_SIZE };
export const TOPOLOGY_V2: Topology = { id: 'crown-topology-2', regions: 32, divisions: DIVISIONS, divisionSize: DIVISION_SIZE };
export const TOPOLOGIES: Topology[] = [TOPOLOGY_V1, TOPOLOGY_V2];
/** Topology given to NEWLY founded federations (existing worlds keep the one they were founded with). */
export const NEW_FEDERATION_TOPOLOGY: Topology = TOPOLOGY_V1;
/** The topology of a stored world (absent field = crown-topology-1, the v0.1–v0.8 federation). */
export const topologyOf = (world?: { topology?: Topology } | null): Topology => world?.topology ?? TOPOLOGY_V1;
export const populationOf = (t: Topology) => t.regions * t.divisions * t.divisionSize;
/** A custom topology for scale experiments (tools/sim/scale_probe.mts); not offered in the app. */
export function topologyWithRegions(regions: number): Topology {
  if (!Number.isInteger(regions) || regions < 1) throw new Error('regions must be a positive integer');
  return TOPOLOGIES.find(t => t.regions === regions) ?? { id: `crown-topology-custom-${regions}`, regions, divisions: DIVISIONS, divisionSize: DIVISION_SIZE };
}

export type StyleId = 'universal' | 'tactical' | 'positional' | 'defensive' | 'endgame' | 'aggressive';

export interface CompetitorSeason { season: number; region: number; division: number; rank: number; points: number; played: number; rating: number; earnings: number }

export interface Competitor {
  id: string;
  name: string;
  portraitSeed: number;
  region: number; // 0..topology.regions-1 (0..15 in crown-topology-1)
  division: number; // 1 (top) .. 8
  birthSeason: number; // age = 20 + (season - birthSeason) at season 1 baseline
  style: StyleId;
  latent: number; // hidden engine-scale strength (never shown, never used by forecasts or NPC traders)
  rating: number;
  rd: number;
  sigma: number;
  form: string; // last 5 results, newest last: W/D/L
  reputation: number; // 0..100, from public achievements only
  titles: { season: number; title: string }[];
  earnings: number; // microcrowns, lifetime credits (prizes, attendance) to the competitor's ledger account
  balanceSeen?: number; // last observed ledger balance (bookkeeping for `earnings`)
  stats: { w: number; d: number; l: number };
  history: CompetitorSeason[];
  milestones: { season: number; round: number; text: string }[];
  status: 'active' | 'reserve' | 'retired';
  joinedSeason: number;
  retiredSeason: number | null;
  /** v0.5 federation-title record (computed from recorded events; src/heraldry/titles.ts). */
  norms?: import('../heraldry/titles').Norm[];
  fedTitle?: import('../heraldry/catalog').FedTitle | null;
  peakRating?: number;
  establishedPeak?: number;
}

/** A pairing in a world round. result: 1 white win, 0.5 draw, 0 black win, null pending. */
export interface Fixture {
  id: string; // `${season}:${round}:${event}:${board}`
  season: number;
  round: number;
  event: string; // league:<region>:<division> | swiss | champ | club
  white: string; // competitor id or 'player'
  black: string;
  result: number | null;
  tier: 1 | 2 | 3; // 1 = player game, 2 = featured engine game, 3 = abstract result
  gameId: string | null; // full legal record for tiers 1 and 2
  stage?: string; // knockout stage label
  forfeit?: boolean;
  /** v0.9 live scheduler (src/app/scheduler.ts): a background fixture promoted to a watchable engine game. */
  slate?: boolean;
  /** How a slate fixture's result was produced: 'simulated' = played move by move live; 'fast-forwarded' = every move
   *  computed by the engine, but after the app reopened rather than live; 'abstract' = drawn from the tier-3 result
   *  model (exactly the draw the fixture would have had without the scheduler) — no game record exists. */
  resolution?: 'simulated' | 'fast-forwarded' | 'abstract';
}

export const PLAYER_ID = 'player';

export const LEAGUE_EVENT = (region: number, division: number) => `league:${region}:${division}`;
export const divisionLabel = (d: number) => ['Crown Division', 'Grand Division', 'Premier Division', 'Masters Division', 'Senior Division', 'District Division', 'Club Division', 'Open Division'][d - 1] ?? `Division ${d}`;

export const REGION_NAMES = [
  'Ashmere', 'Brightwater', 'Calderon', 'Dunmarch', 'Eastreach', 'Fenwick', 'Greyhollow', 'Highcourt',
  'Ironvale', 'Juniper Coast', 'Kestrel Isles', 'Lanternfall', 'Moorgate', 'Northwind', 'Oakhaven', 'Pellmoor',
  // crown-topology-2 regions 17–32 (original names)
  'Quarrydown', 'Rivenford', 'Saltmarsh', 'Thistlemoor', 'Umberlea', 'Vantage Bay', 'Westerholm', 'Yarrowdale',
  'Amberlynn', 'Blackwater', 'Corrin Heights', 'Driftmoor', 'Emberfell', 'Foxglove Vale', 'Gullhaven', 'Harrowmere',
];
/** Region name; regions beyond the named 32 (scale experiments only) are numbered. */
export const regionName = (r: number) => REGION_NAMES[r] ?? `Region ${r + 1}`;
/** Names of the regions that exist in a world of this topology (UI pickers). */
export const regionNamesOf = (t: Topology) => Array.from({ length: t.regions }, (_, i) => regionName(i));
