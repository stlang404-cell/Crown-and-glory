/**
 * Crown economy rules (crown-economy-1). Every flow is a balanced ledger journal with an idempotent id.
 * Currency is created only by the explicit, logged `mint` entries below (genesis, season issuance) and
 * destroyed into `sink` (asset setup costs, upkeep, entry fees). Prizes and sponsorships are transfers
 * from escrowed pools funded at season start — never minted per win. Fictional, non-redeemable money.
 */
import { Journal, MICRO } from '../exchange/ledger';
import { DIVISIONS } from '../federation/model';

export const ECONOMY_ID = 'crown-economy-1';
const C = (crowns: number) => Math.round(crowns * MICRO);

export const GENESIS_TREASURY = C(25_000); // standing float for market subsidies and NPC wallets
export const STARTING_GRANT = C(1_000);
export const SPONSOR_BUDGET = C(1_200);
/** The treasury funds market subsidies and NPC wallets. At each season start it is replenished toward the
 *  target by an explicit, capped mint entry — the only issuance besides prize pools, sponsors and grants. */
export const TREASURY_TARGET = C(25_000);
export const TREASURY_REPLENISH_CAP = C(8_000);
export const CHALLENGER_FEE = C(25);
export const LEAGUE_SPLIT = [0.5, 0.3, 0.2];
/** League prize pool per circuit: 2,000 ₵ in the Crown Division down to 120 ₵ in the Open Division (geometric). */
export const leaguePool = (division: number) => C(Math.round(2000 * Math.pow(120 / 2000, (division - 1) / (DIVISIONS - 1))));
export const OPEN_POOL = C(1_500);
export const CHALLENGER_POOL = C(600);
export const CHAMP_POOL = C(8_000);
export const SWISS_SPLIT = [0.3, 0.2, 0.12, 0.12, 0.065, 0.065, 0.065, 0.065];
export const CHAMP_SPLIT: Record<string, number> = { champion: 0.4, final: 0.2, semi: 0.1, quarter: 0.05 };

/** Player-only sponsor milestones, each paid at most once per season from the season's sponsor budget. */
export const SPONSOR_MILESTONES: Record<string, { label: string; amount: number }> = {
  'first-federation-win': { label: 'First federation win', amount: C(50) },
  promotion: { label: 'Promotion to a higher division', amount: C(150) },
  'league-podium': { label: 'League top-three finish', amount: C(80) },
  'league-title': { label: 'Division title', amount: C(200) },
  'swiss-top8': { label: 'Swiss event top eight', amount: C(100) },
  'champ-qualified': { label: 'Championship qualification', amount: C(300) },
};

export interface AssetType { id: string; name: string; kind: 'club' | 'analyst' | 'scouting' | 'training' | 'trophy'; price: number; bond: number; resale: number; upkeep: number; effect: string; unique: boolean }
export const ASSETS: AssetType[] = [
  { id: 'club', name: 'Starter Chess Club', kind: 'club', price: C(500), bond: C(300), resale: 0, upkeep: C(40), unique: true,
    effect: 'Club identity and prestige; hosts the Club Weekend, a four-player knockout each season (hosting cost 20 ₵, prize escrow 40 ₵, attendance 5 ₵ per guest, sponsor 30 ₵ when completed). The 300 ₵ bond is refundable when you close the club. Income comes mainly from membership dues: your club attracts a share of your region\'s players, larger when you upgrade it, complete the Club Weekend, sponsor players and win titles. Members pay 5% of what they hold at season end, so income rises and falls with their prize money. An idle club loses money.' },
  { id: 'analyst', name: 'Analyst Office', kind: 'analyst', price: C(300), bond: 0, resale: C(150), upkeep: C(20), unique: true,
    effect: 'Exchange research desk: full forecast breakdown (expected score, rating uncertainty, draw model), price history charts and your forecast track record. Uses public information only.' },
  { id: 'scouting', name: 'Scouting Department', kind: 'scouting', price: C(200), bond: 0, resale: C(100), upkeep: C(15), unique: true,
    effect: 'Unlimited competitor watchlist (3 without it) and an automatic dossier on your next league opponent: rating trend, form, results against common opponents and their recorded games.' },
  { id: 'training', name: 'Training Hall', kind: 'training', price: C(250), bond: 0, resale: C(125), upkeep: C(20), unique: true,
    effect: 'Sparring: unlimited unrated practice games against your next federation opponent, using their exact engine strength profile and style. Practice only: sparring games never count for ratings, standings or prizes.' },
  { id: 'trophy-cabinet', name: 'Walnut Trophy Cabinet', kind: 'trophy', price: C(120), bond: 0, resale: C(60), upkeep: 0, unique: true, effect: 'Displays your titles on your Passport. Cosmetic.' },
  { id: 'brass-clock', name: 'Brass Tournament Clock', kind: 'trophy', price: C(80), bond: 0, resale: C(40), upkeep: 0, unique: true, effect: 'A collectible for your study. Cosmetic.' },
];
export const assetType = (id: string) => ASSETS.find(a => a.id === id)!;

export interface OwnedAsset { id: string; typeId: string; acquiredSeason: number; suspended: boolean; upkeepPaidSeason: number; level?: number; identity?: import('../heraldry/clubs').ClubIdentity }

const j = (id: string, kind: string, memo: string, lines: { account: string; amount: number }[], season?: number, round?: number, at = ''): Journal => ({ id, at, kind, memo, lines: lines.filter(l => l.amount !== 0), season, round });

export function genesisJournals(at: string, npcIds: string[], npcFund: number): Journal[] {
  const out = [j('mint:genesis', 'mint', 'Federation treasury founded', [{ account: 'mint', amount: -GENESIS_TREASURY }, { account: 'treasury', amount: GENESIS_TREASURY }], 1, 0, at)];
  out.push(j('grant:player-start', 'grant', 'Career starting grant', [{ account: 'mint', amount: -STARTING_GRANT }, { account: 'player:cash', amount: STARTING_GRANT }], 1, 0, at));
  for (const id of npcIds) out.push(j(`npc-fund:1:${id}`, 'npc-fund', `Starting wallet ${id}`, [{ account: 'treasury', amount: -npcFund }, { account: id, amount: npcFund }], 1, 0, at));
  return out;
}

export interface PrizePools { league: Record<string, number>; open: number; challenger: number; champ: number; sponsor: number }
export function prizePools(circuits: { region: number; division: number }[]): PrizePools {
  return {
    league: Object.fromEntries(circuits.map(c => [`${c.region}:${c.division}`, leaguePool(c.division)])),
    open: OPEN_POOL, challenger: CHALLENGER_POOL, champ: CHAMP_POOL, sponsor: SPONSOR_BUDGET,
  };
}

/** Season issuance: mint exactly the season's prize pools and sponsor budget, escrowed immediately. */
export function seasonStartJournals(season: number, pools: PrizePools, at: string): Journal[] {
  const total = Object.values(pools.league).reduce((a, b) => a + b, 0) + pools.open + pools.challenger + pools.champ + pools.sponsor;
  const lines = [{ account: 'mint', amount: -total }];
  for (const [k, v] of Object.entries(pools.league)) lines.push({ account: `prize:${season}:league:${k}`, amount: v });
  lines.push({ account: `prize:${season}:open`, amount: pools.open }, { account: `prize:${season}:challenger`, amount: pools.challenger }, { account: `prize:${season}:champ`, amount: pools.champ }, { account: `sponsor:${season}`, amount: pools.sponsor });
  return [j(`mint:season:${season}`, 'mint', `Season ${season} issuance: prize pools and sponsor budget (escrowed)`, lines, season, 0, at)];
}

export function treasuryReplenishJournal(season: number, treasury: number, at: string): Journal | null {
  const amt = Math.min(TREASURY_REPLENISH_CAP, TREASURY_TARGET - treasury);
  if (amt <= 0) return null;
  return j(`mint:treasury:${season}`, 'mint', `Season ${season} treasury replenishment (capped at ${TREASURY_REPLENISH_CAP / MICRO} ₵)`, [{ account: 'mint', amount: -amt }, { account: 'treasury', amount: amt }], season, 0, at);
}

export const holderAccount = (id: string) => (id === 'player' ? 'player:cash' : `comp:${id}`);

/** Pay a pool by shares; any remainder (rounding, absent places) returns to the treasury. */
export function payPool(id: string, pool: string, balance: number, recipients: { id: string; share: number }[], memo: string, season: number, round: number, at: string): Journal {
  const lines = [{ account: pool, amount: -balance }];
  let paid = 0;
  for (const r of recipients) { const a = Math.floor(balance * r.share); paid += a; lines.push({ account: holderAccount(r.id), amount: a }); }
  lines.push({ account: 'treasury', amount: balance - paid });
  return j(id, 'prize', memo, lines, season, round, at);
}

export function sponsorJournal(season: number, milestone: string, budget: number, at: string, bonus = 0): Journal | null {
  const m = SPONSOR_MILESTONES[milestone];
  if (!m) return null;
  const amount = Math.min(budget, Math.round(m.amount * (1 + bonus)));
  if (amount < m.amount) return null;
  return j(`sponsor:${season}:${milestone}`, 'sponsor', `Sponsor milestone: ${m.label}${bonus ? ' (Federation Club bonus)' : ''}`, [{ account: `sponsor:${season}`, amount: -amount }, { account: 'player:cash', amount }], season, undefined, at);
}

export function purchaseJournal(a: AssetType, season: number, at: string): Journal {
  return j(`asset-buy:${a.id}:${season}:${at}`, 'asset-purchase', `Purchase ${a.name}`, [
    { account: 'player:cash', amount: -a.price },
    { account: `asset:${a.id}:bond`, amount: a.bond },
    { account: 'sink', amount: a.price - a.bond },
  ], season, undefined, at);
}

/** Selling back: bond refunded from escrow; resale value paid by the treasury (a disclosed buy-back). */
export function saleJournal(a: AssetType, season: number, at: string): Journal {
  return j(`asset-sell:${a.id}:${season}:${at}`, 'asset-sale', `Sell ${a.name}`, [
    { account: `asset:${a.id}:bond`, amount: -a.bond },
    { account: 'treasury', amount: -a.resale },
    { account: 'player:cash', amount: a.bond + a.resale },
  ], season, undefined, at);
}

export function upkeepJournal(a: AssetType, season: number, at: string): Journal {
  return j(`upkeep:${a.id}:${season}`, 'upkeep', `${a.name} upkeep, season ${season}`, [{ account: 'player:cash', amount: -a.upkeep }, { account: 'sink', amount: a.upkeep }], season, undefined, at);
}

/** Book value of an owned asset for net worth: refundable bond + disclosed buy-back value (if not suspended). */
export const assetValue = (a: AssetType) => a.bond + a.resale;

/** Recovery (research doc 10): when cash is below 100 ₵ the player may take one non-cash entry voucher per season. */
export const RECOVERY_THRESHOLD = C(100);
export function voucherJournal(season: number, at: string): Journal {
  return j(`voucher:${season}`, 'recovery-voucher', 'Recovery voucher: Challenger Open entry paid by the federation', [{ account: 'treasury', amount: -CHALLENGER_FEE }, { account: 'sink', amount: CHALLENGER_FEE }], season, undefined, at);
}
export function entryFeeJournal(season: number, at: string): Journal {
  return j(`entry:challenger:${season}`, 'entry-fee', 'Challenger Open entry fee', [{ account: 'player:cash', amount: -CHALLENGER_FEE }, { account: 'sink', amount: CHALLENGER_FEE }], season, undefined, at);
}

/** Net worth = cash + asset book values + executable liquidation value of open positions − liabilities (none: no credit exists). */
export function netWorth(cash: number, assets: number, positions: number, liabilities = 0): number {
  return cash + assets + positions - liabilities;
}

export interface Prestige { chess: number; chessTier: string; chessBasis: string[]; financial: number; financialTier: string; financialBasis: string[] }
const tier = (v: number, names: [number, string][]) => names.filter(([t]) => v >= t).pop()?.[1] ?? names[0][1];

/** Two separate ladders. Money never buys chess prestige; chess results never count as financial prestige. */
export function prestige(p: { titles: { title: string }[]; promotions: number; bestRating: number | null; podiums: number }, f: { netWorth: number; peakNetWorth: number; realizedTrading: number; assets: number }): Prestige {
  const chessBasis: string[] = [];
  let chess = 0;
  for (const t of p.titles) {
    const v = t.title.startsWith('Crown Champion') ? 500 : t.title.startsWith('Joint Crown') ? 400 : t.title.startsWith('Federation Open') ? 150 : t.title.startsWith('Challenger') ? 60 : 100;
    chess += v; chessBasis.push(`${t.title} +${v}`);
  }
  if (p.promotions) { chess += 25 * p.promotions; chessBasis.push(`${p.promotions} promotion(s) +${25 * p.promotions}`); }
  if (p.podiums) { chess += 15 * p.podiums; chessBasis.push(`${p.podiums} league podium(s) +${15 * p.podiums}`); }
  if (p.bestRating) { const r = Math.max(0, Math.round((p.bestRating - 1400) / 10)); chess += r; chessBasis.push(`Established peak rating ${Math.round(p.bestRating)} +${r}`); }
  const financialBasis: string[] = [];
  const fin = Math.max(0, Math.round(f.peakNetWorth / MICRO / 20)) + Math.max(0, Math.round(f.realizedTrading / MICRO / 10)) + 20 * f.assets;
  financialBasis.push(`Peak net worth ${Math.round(f.peakNetWorth / MICRO)} ₵ → +${Math.round(f.peakNetWorth / MICRO / 20)}`);
  if (f.realizedTrading > 0) financialBasis.push(`Realized trading profit ${Math.round(f.realizedTrading / MICRO)} ₵ → +${Math.round(f.realizedTrading / MICRO / 10)}`);
  if (f.assets) financialBasis.push(`${f.assets} asset(s) owned → +${20 * f.assets}`);
  return {
    chess, chessTier: tier(chess, [[0, 'Unranked'], [50, 'Contender'], [200, 'Titled'], [500, 'Laureate'], [1000, 'Grandee']]), chessBasis,
    financial: fin, financialTier: tier(fin, [[0, 'Apprentice'], [60, 'Saver'], [150, 'Investor'], [300, 'Patron'], [600, 'Magnate']]), financialBasis,
  };
}

// ---------------------------------------------------------------- institutions (v0.4.0)
/** Club levels. Upgrade cost: half is escrowed (refundable when the club closes, counted in book value),
 *  half is spent (sink). Extra upkeep is charged with the club's upkeep each season. */
export interface ClubLevel { level: number; name: string; cost: number; escrow: number; extraUpkeep: number; weekendSize: number; contractSlots: number; sponsorBonus: number; effect: string }
export const CLUB_LEVELS: ClubLevel[] = [
  { level: 1, name: 'Starter Chess Club', cost: 0, escrow: 0, extraUpkeep: 0, weekendSize: 4, contractSlots: 1, sponsorBonus: 0, effect: '4-player Club Weekend; one sponsorship contract.' },
  { level: 2, name: 'Club with Tournament Venue', cost: C(400), escrow: C(200), extraUpkeep: C(30), weekendSize: 8, contractSlots: 2, sponsorBonus: 0, effect: '8-player Club Weekend over three rounds (more attendance income, larger funded prize and sponsor); two sponsorship contracts.' },
  { level: 3, name: 'Federation Club', cost: C(900), escrow: C(450), extraUpkeep: C(60), weekendSize: 8, contractSlots: 3, sponsorBonus: 0.25, effect: 'Sponsor milestones pay 25% more (from the season sponsor budget); three sponsorship contracts.' },
];
export const clubLevel = (lv: number) => CLUB_LEVELS[Math.max(1, Math.min(3, lv)) - 1];
export function clubUpgradeJournal(to: number, season: number, at: string): Journal {
  const L = clubLevel(to);
  return j(`club-upgrade:${to}:${season}:${at}`, 'asset-purchase', `Upgrade club to ${L.name}`, [
    { account: 'player:cash', amount: -L.cost }, { account: 'asset:club:upgrade', amount: L.escrow }, { account: 'sink', amount: L.cost - L.escrow },
  ], season, undefined, at);
}
export function clubUpgradeRefundJournal(escrow: number, season: number, at: string): Journal | null {
  if (escrow <= 0) return null;
  return j(`club-upgrade-refund:${season}:${at}`, 'asset-sale', 'Club upgrades: refundable escrow returned on closing', [{ account: 'asset:club:upgrade', amount: -escrow }, { account: 'player:cash', amount: escrow }], season, undefined, at);
}

/** Sponsorship contracts (talent recruitment): a season stipend paid to the competitor in exchange for a share of
 *  every prize they win while the contract is active. Contracts have no book value (they are an expense). */
export const CONTRACT_SHARE = 0.25;
/** Stipend priced off the competitor's own record: at least 30% of their average prize earnings per season (so a 25%
 *  share pays back only if they outperform their history) and 10% of their division's prize pool; repriced at
 *  every renewal. A scouting edge (spotting improving players) is the intended route to profit — not a sure thing. */
export const stipendFor = (division: number, avgSeasonEarnings = 0) => Math.max(C(25), Math.round(leaguePool(division) * 0.10), Math.round(avgSeasonEarnings * 0.30));
export const avgSeasonEarnings = (c: { earnings: number; history: unknown[] }) => c.earnings / Math.max(1, c.history.length);
export function stipendJournal(contractId: string, competitorId: string, amount: number, season: number, at: string): Journal {
  return j(`stipend:${contractId}:${season}`, 'contract-stipend', `Sponsorship stipend, season ${season}`, [{ account: 'player:cash', amount: -amount }, { account: `comp:${competitorId}`, amount }], season, undefined, at);
}
export function contractShareJournal(prizeJournalId: string, competitorId: string, amount: number, season: number, at: string): Journal {
  return j(`contract-share:${prizeJournalId}:${competitorId}`, 'contract-share', 'Sponsorship share of prize money', [{ account: `comp:${competitorId}`, amount: -amount }, { account: 'player:cash', amount }], season, undefined, at);
}
