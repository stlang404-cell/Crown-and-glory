/**
 * The Sovereign Vault — families and tiers (crown-vault-2). A family groups achievements about one skill or career
 * thread across the existing collections (collections and ids are unchanged). Tiers are a fixed reading of rarity:
 * Common/Uncommon = Bronze, Rare = Silver, Epic/Legendary = Gold, Mythic = Sovereign — so every collectible, old or new,
 * has exactly one tier and no existing definition changes.
 */
import type { Rarity } from './catalog';

export const TIERS = ['bronze', 'silver', 'gold', 'sovereign'] as const;
export type Tier = typeof TIERS[number];
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', sovereign: 'Sovereign' };
export const TIER_OF_RARITY: Record<Rarity, Tier> = { common: 'bronze', uncommon: 'bronze', rare: 'silver', epic: 'gold', legendary: 'gold', mythic: 'sovereign' };

export const FAMILIES = [
  { id: 'mastery', name: 'Chess Mastery', blurb: 'Wins, checkmates and the strongest engines.' },
  { id: 'tactics', name: 'Tactical Brilliance', blurb: 'Puzzles, sacrificial finishes and (once validated) Brilliant moves.' },
  { id: 'defence', name: 'Defensive Resilience', blurb: 'Saving and turning lost positions.' },
  { id: 'endgames', name: 'Endgame Technique', blurb: 'Converting endings and crowning pawns.' },
  { id: 'tournaments', name: 'Tournament Victories', blurb: 'Entries, podiums and titles.' },
  { id: 'upsets', name: 'Upsets', blurb: 'Beating players rated above you.' },
  { id: 'streaks', name: 'Win Streaks', blurb: 'Runs of rated wins and unbeaten games.' },
  { id: 'ratings', name: 'Rating Milestones', blurb: 'Established ratings across the 0–4,000+ spectrum.' },
  { id: 'federation', name: 'Federation Career', blurb: 'Divisions, promotions, norms and titles.' },
  { id: 'rivalries', name: 'Rivalries', blurb: 'Head-to-head records against Federation competitors.' },
  { id: 'regions', name: 'Regional Conquest', blurb: 'Victories across the Federation’s regions.' },
  { id: 'grimoire', name: 'Grimoire Mastery', blurb: 'The Sovereign’s Grimoire and the Academy.' },
  { id: 'forecasting', name: 'Forecasting Calibration', blurb: 'Paper forecasts scored against the market.' },
  { id: 'exchange', name: 'Exchange Profitability', blurb: 'Realized profit and the Exchange title ladder.' },
  { id: 'recovery', name: 'Financial Recovery', blurb: 'Coming back from losses and the brink.' },
  { id: 'treasury', name: 'Patron’s Treasury', blurb: 'Clubs and net worth.' },
  { id: 'longevity', name: 'Career Longevity', blurb: 'Days at the board and seasons completed.' },
  { id: 'analysis', name: 'Replay Analysis', blurb: 'Reviewing, bookmarking and retrying your games.' },
  { id: 'secrets', name: 'Rare Secrets', blurb: 'Hidden until earned.' },
  { id: 'insignias', name: 'Rating Insignias', blurb: 'The 31 rating-title insignias.' },
] as const;
export type FamilyId = typeof FAMILIES[number]['id'];

/** Families of the crown-vault-1 achievements (exchange titles and insignias are assigned by kind). */
export const LEGACY_FAMILY: Record<string, FamilyId> = {
  'first-win': 'mastery', 'first-draw': 'mastery', 'wins-10': 'mastery', 'wins-50': 'mastery', 'wins-100': 'mastery', 'wins-500': 'mastery', 'wins-1000': 'mastery',
  'first-mate': 'mastery', 'clean-sheet': 'mastery', 'sovereign-unbound': 'mastery', 'sovereign-deep': 'mastery', 'all-colours': 'mastery', 'accuracy-90': 'mastery',
  comeback: 'defence', 'defence-critical': 'defence',
  'upset-higher': 'upsets', 'giant-slayer': 'upsets', 'titan-slayer': 'upsets', 'qm-giant': 'upsets', 'qm-titan': 'upsets',
  'streak-10': 'streaks', 'streak-25': 'streaks',
  'brilliant-1': 'tactics', 'brilliant-5': 'tactics', 'brilliant-25': 'tactics', 'brilliant-100': 'tactics', 'brilliant-up': 'tactics', 'brilliant-final': 'tactics',
  'academy-set': 'tactics', 'puzzles-100': 'tactics', 'puzzles-500': 'tactics',
  'played-like-high': 'analysis', 'played-like-steady': 'analysis', 'analyses-10': 'analysis', 'analyses-100': 'analysis', 'deep-review': 'analysis', 'bookmarks-25': 'analysis', 'retry-master': 'analysis',
  'first-title': 'ratings', 'rating-500': 'ratings', 'rating-1000': 'ratings', 'rating-1500': 'ratings', 'rating-2000': 'ratings', 'rating-2500': 'ratings', 'rating-3000': 'ratings',
  'insignias-10': 'ratings', 'insignias-20': 'ratings', 'insignias-31': 'ratings',
  promotion: 'federation', 'crown-division': 'federation', norm: 'federation', 'fed-knight': 'federation', 'fed-paladin': 'federation', 'fed-sovereign': 'federation',
  'relegation-recovery': 'recovery',
  'league-title': 'tournaments', champion: 'tournaments', 'title-defence': 'tournaments', 'event-first': 'tournaments', 'swiss-podium': 'tournaments', semi: 'tournaments',
  final: 'tournaments', 'event-win': 'tournaments', 'club-weekend': 'tournaments',
  'rival-first': 'rivalries', 'rival-bo5': 'rivalries', revenge: 'rivalries', nemesis: 'rivalries', 'upset-feud': 'rivalries', 'qm-first': 'rivalries',
  'regions-8': 'regions', 'regions-16': 'regions', 'qm-regions-8': 'regions',
  'forecast-upset': 'forecasting', forecaster: 'forecasting', 'calibrated-100': 'forecasting', specialist: 'forecasting',
  'trade-first': 'exchange', 'win-forecast': 'exchange', 'season-profit': 'exchange', 'market-variety': 'exchange',
  'recover-trading': 'recovery', 'near-ruin': 'recovery',
  patron: 'treasury', 'club-level-3': 'treasury', 'networth-5k': 'treasury', 'networth-25k': 'treasury', 'networth-100k': 'treasury',
  'first-lesson': 'grimoire', 'apprentice-graduate': 'grimoire', 'tactical-scholar': 'grimoire', 'fork-specialist': 'grimoire', 'endgame-apprentice': 'grimoire',
  'calculation-adept': 'grimoire', 'academy-graduate': 'grimoire', 'sovereign-trial': 'grimoire',
  'full-season': 'longevity', 'ten-seasons': 'longevity',
  'comeback-run': 'secrets', 'night-owl': 'secrets', 'perfect-promotion': 'secrets', 'all-collections': 'secrets',
};
