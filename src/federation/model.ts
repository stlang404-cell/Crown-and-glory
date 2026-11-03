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

export type StyleId = 'universal' | 'tactical' | 'positional' | 'defensive' | 'endgame' | 'aggressive';

export interface CompetitorSeason { season: number; region: number; division: number; rank: number; points: number; played: number; rating: number; earnings: number }

export interface Competitor {
  id: string;
  name: string;
  portraitSeed: number;
  region: number; // 0..15
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
  earnings: number; // microcrowns, mirrors the competitor's ledger account
  stats: { w: number; d: number; l: number };
  history: CompetitorSeason[];
  milestones: { season: number; round: number; text: string }[];
  status: 'active' | 'reserve' | 'retired';
  joinedSeason: number;
  retiredSeason: number | null;
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
}

export const PLAYER_ID = 'player';

export const LEAGUE_EVENT = (region: number, division: number) => `league:${region}:${division}`;
export const divisionLabel = (d: number) => ['Crown Division', 'Grand Division', 'Premier Division', 'Masters Division', 'Senior Division', 'District Division', 'Club Division', 'Open Division'][d - 1] ?? `Division ${d}`;

export const REGION_NAMES = [
  'Ashmere', 'Brightwater', 'Calderon', 'Dunmarch', 'Eastreach', 'Fenwick', 'Greyhollow', 'Highcourt',
  'Ironvale', 'Juniper Coast', 'Kestrel Isles', 'Lanternfall', 'Moorgate', 'Northwind', 'Oakhaven', 'Pellmoor',
];
