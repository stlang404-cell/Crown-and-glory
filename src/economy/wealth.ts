/**
 * Wealth and financial progression (crown-wealth-1, v0.11). THE single config module for every amount added in
 * v0.11 — club facilities, prestige estates, event sponsorship, administration (bankruptcy) and recovery — plus the
 * pure journal builders for those flows. The v0.4–v0.8 amounts (prize pools, assets, club levels, contracts) stay in
 * src/economy/economy.ts, where they always were; docs/ECONOMY_V11.md lists both.
 *
 * Rules (docs/V10_PLAN.md, binding): fictional money only, integer micro-units, every flow a balanced journal with a
 * deterministic idempotent id, no new issuance (every v0.11 flow moves existing money between accounts or into the
 * sink), and NOTHING here can change engine strength, ratings, pairings, results, standings or qualification. The
 * no-pay-to-win test (tests/wealth.test.ts) asserts that the type of every effect is money, club appeal or prestige.
 */
import { MICRO, type Journal } from '../exchange/ledger';

export const WEALTH_ID = 'crown-wealth-1';
const C = (dollars: number) => Math.round(dollars * MICRO);

// ------------------------------------------------------------------ club facilities
/**
 * Facilities extend a player club (they need an active club). Building one costs `cost`: `deposit` is held in escrow
 * (refunded when the facility or the club is closed; counted in net worth), the rest is spent. `upkeep` is charged at
 * every season end. Effects are club appeal (members → dues, a transfer from competitors' own balances, capped by the
 * 45% appeal ceiling), Club Weekend income or prestige — never chess strength.
 */
export type FacilityId = 'lounge' | 'gallery' | 'library';
export interface Facility { id: FacilityId; name: string; cost: number; deposit: number; upkeep: number; appeal: number; prestige: number; effect: string }
export const FACILITIES: Facility[] = [
  { id: 'lounge', name: "Members' Lounge", cost: C(350), deposit: C(150), upkeep: C(30), appeal: 0.05, prestige: 15,
    effect: 'Club appeal +5%: more of your region\'s competitors join your club and pay its dues (5% of what they hold at season end). Worth it only if your region\'s players are earning.' },
  { id: 'gallery', name: 'Spectator Gallery', cost: C(300), deposit: C(100), upkeep: C(20), appeal: 0.02, prestige: 10,
    effect: 'Club Weekend guests pay $12 instead of $5 to attend, and the completed-event sponsor pays $20 more (from the season sponsor budget). Club appeal +2%. Pays only if you host the Club Weekend.' },
  { id: 'library', name: 'Heritage Library', cost: C(250), deposit: C(100), upkeep: C(15), appeal: 0.02, prestige: 40,
    effect: 'A reading room with your club\'s records. Financial prestige +40 and club appeal +2%. Mostly prestige.' },
];
export const facility = (id: string) => FACILITIES.find(f => f.id === id);
/** Club Weekend attendance fee per guest with and without the Spectator Gallery. */
export const ATTENDANCE_FEE = C(5);
export const GALLERY_ATTENDANCE_FEE = C(12);
export const GALLERY_SPONSOR_BONUS = C(20);

// ------------------------------------------------------------------ prestige estates
/**
 * Estates are cosmetic prestige with upkeep: a sink for wealth, never income. Half the price is a refundable deed
 * deposit (book value; returned on sale), half is spent. Unpaid upkeep suspends the estate (no prestige); in
 * administration estates are liquidated first.
 */
export interface Estate { id: string; name: string; price: number; deposit: number; upkeep: number; prestige: number; description: string }
export const ESTATES: Estate[] = [
  { id: 'townhouse', name: 'Townhouse Study', price: C(600), deposit: C(300), upkeep: C(25), prestige: 30, description: 'A panelled study in the regional capital. Cosmetic prestige.' },
  { id: 'country', name: 'Country Estate', price: C(2_000), deposit: C(1_000), upkeep: C(80), prestige: 100, description: 'Grounds, a long gallery and a summer tournament lawn. Cosmetic prestige.' },
  { id: 'palace', name: 'Grand Chess Palace', price: C(6_000), deposit: C(3_000), upkeep: C(200), prestige: 300, description: 'A domed hall with a six-square marble floor. Cosmetic prestige — the federation\'s largest money sink.' },
];
export const estate = (id: string) => ESTATES.find(e => e.id === id);

// ------------------------------------------------------------------ event sponsorship
/**
 * Sponsor one of this season's events before it starts. The stake is escrowed; when the event pays its prizes:
 *  - PURSE_SHARE of the stake is added to the purse, paid by the event's own split to the AI prize winners (a sponsor
 *    never wins its own purse: the player's share goes to the treasury);
 *  - the rest is event costs (sink);
 *  - a visibility return is paid from the season sponsor budget (existing escrow; no new money):
 *      stake × min(CAP, BASE + LOCAL·localShare + STAR·[you finished in the prize places]),
 *    where localShare is the share of the event's prize places taken by competitors of your region (you included).
 *    Returns in a season are capped at RETURN_BUDGET_SHARE of the sponsor budget, first come first served.
 * Expected value without chess results is below the stake (BASE + LOCAL < 1): sponsorship buys reputation and club
 * appeal; it makes money only when you or your region's players do well in the event.
 */
export const SPONSOR_TIERS = [{ id: 'supporter', name: 'Supporter', stake: C(100) }, { id: 'patron', name: 'Patron', stake: C(250) }, { id: 'title', name: 'Title sponsor', stake: C(500) }] as const;
export type SponsorTier = typeof SPONSOR_TIERS[number]['id'];
export const SPONSOR = {
  purseShare: 0.6, base: 0.55, local: 0.4, star: 0.35, cap: 1.3, returnBudgetShare: 0.6, perSeason: 2,
  /** Club appeal per sponsored event this season (max perSeason events). */
  appealPerEvent: 0.03,
  /** Reputation per settled sponsorship (max 100). */
  reputation: 5,
} as const;
export interface EventSponsorship { id: string; season: number; event: string; label: string; tier: SponsorTier; stake: number; status: 'active' | 'settled'; purse?: number; costs?: number; ret?: number; multiplier?: number; localShare?: number; star?: boolean }
export const sponsorshipId = (season: number, event: string) => `${season}:${event}`;
export function sponsorMultiplier(localShare: number, star: boolean): number {
  const m = SPONSOR.base + SPONSOR.local * Math.max(0, Math.min(1, localShare)) + (star ? SPONSOR.star : 0);
  return Math.min(SPONSOR.cap, m);
}

// ------------------------------------------------------------------ administration (bankruptcy) and recovery
/**
 * Administration is entered at a season end when, after upkeep, the player could not pay an obligation (an asset,
 * facility or estate was suspended, or a loan instalment was missed) or net worth is below NET_WORTH_FLOOR.
 * Consequences (once, on entry): estates and facilities are liquidated (deposits returned), unpaid tools are sold
 * back, sponsorship contracts end, reputation −REPUTATION_HIT, club appeal −APPEAL_PENALTY while in administration.
 * Restrictions while in administration: no purchases (assets, facilities, estates, cosmetics, upgrades, contracts,
 * event sponsorship) and Exchange buys of at most EXCHANGE_BUY_CAP each. Chess and every Federation event stay
 * open (the Challenger voucher still applies). Path back: prize money, the hardship stipend for every federation game
 * played, and one recovery loan per episode. Exit at a season end with net worth ≥ EXIT_NET_WORTH and no loan arrears.
 */
export const ADMIN = {
  netWorthFloor: C(100), exitNetWorth: C(300), reputationHit: 25, appealPenalty: 0.1, exchangeBuyCap: C(25),
} as const;
export const LOAN = { principal: C(300), fee: C(30), instalment: C(110), minTreasury: C(10_000) } as const;
export const HARDSHIP = { perGame: C(8), maxGamesPerSeason: 10 } as const;
export const REPUTATION_START = 50;

export interface Loan { drawnSeason: number; principal: number; fee: number; outstanding: number; repaid: number; arrears: number }
export interface AdminEpisode { since: number; until: number | null; reason: string; liquidated: string[]; loanTaken: boolean }
export interface WealthState {
  facilities: { id: FacilityId; builtSeason: number; suspended: boolean }[];
  estates: { id: string; boughtSeason: number; suspended: boolean }[];
  sponsorships: EventSponsorship[];
  admin: AdminEpisode | null;
  episodes: AdminEpisode[];
  loan: Loan | null;
  hardship: { season: number; games: number } | null;
  reputation: number;
}
export const emptyWealth = (): WealthState => ({ facilities: [], estates: [], sponsorships: [], admin: null, episodes: [], loan: null, hardship: null, reputation: REPUTATION_START });
/** Saves before v0.11 have no wealth record: the defaults (nothing owned, not in administration). */
export const wealthOf = (extra: { wealth?: WealthState }): WealthState => ({ ...emptyWealth(), ...(extra.wealth ?? {}) });

/** Club appeal parts contributed by v0.11 state (added to src/app/heraldry.ts playerClubAppeal; still capped at 45%). */
export function wealthAppealParts(w: WealthState, season: number): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  for (const f of w.facilities) { const F = facility(f.id); if (F && !f.suspended) out.push({ label: F.name, value: F.appeal }); }
  const sponsored = Math.min(SPONSOR.perSeason, w.sponsorships.filter(s => s.season === season).length);
  if (sponsored) out.push({ label: `${sponsored} sponsored event(s) this season`, value: SPONSOR.appealPerEvent * sponsored });
  if (w.admin) out.push({ label: 'Owner in administration', value: -ADMIN.appealPenalty });
  const rep = (w.reputation - REPUTATION_START) / 500; // reputation 0..100 → −10% … +10%
  if (rep) out.push({ label: `Reputation ${w.reputation}`, value: rep });
  return out;
}

/** Book value of v0.11 holdings: facility and estate deposits of those not suspended. */
export function wealthBookValue(w: WealthState, clubActive: boolean): number {
  let v = 0;
  if (clubActive) for (const f of w.facilities) if (!f.suspended) v += facility(f.id)?.deposit ?? 0;
  for (const e of w.estates) if (!e.suspended) v += estate(e.id)?.deposit ?? 0;
  return v;
}
export const liabilities = (w: WealthState) => w.loan?.outstanding ?? 0;

/** Financial prestige from v0.11 holdings (estates, facilities, sponsorship record, reputation). Money never buys chess prestige. */
export function wealthPrestige(w: WealthState): { points: number; basis: string[] } {
  const basis: string[] = [];
  let pts = 0;
  for (const e of w.estates) { const E = estate(e.id); if (E && !e.suspended) { pts += E.prestige; basis.push(`${E.name} +${E.prestige}`); } }
  for (const f of w.facilities) { const F = facility(f.id); if (F && !f.suspended) { pts += F.prestige; basis.push(`${F.name} +${F.prestige}`); } }
  const settled = w.sponsorships.filter(s => s.status === 'settled').length;
  if (settled) { const p = Math.min(200, 10 * settled); pts += p; basis.push(`${settled} event sponsorship(s) +${p}`); }
  return { points: pts, basis };
}

// ------------------------------------------------------------------ journals (deterministic ids)
const j = (id: string, kind: string, memo: string, lines: { account: string; amount: number }[], season: number, at: string): Journal => ({ id, at, kind, memo, lines: lines.filter(l => l.amount !== 0), season });
export const facilityAccount = (id: string) => `asset:facility:${id}`;
export const estateAccount = (id: string) => `asset:estate:${id}`;
export const sponsorshipAccount = (season: number, event: string) => `sponsorship:${season}:${event}`;

export function facilityBuildJournal(f: Facility, season: number, at: string): Journal {
  return j(`facility-build:${f.id}:${season}:${at}`, 'facility-build', `Build ${f.name}`, [{ account: 'player:cash', amount: -f.cost }, { account: facilityAccount(f.id), amount: f.deposit }, { account: 'sink', amount: f.cost - f.deposit }], season, at);
}
export function facilityCloseJournal(f: Facility, deposit: number, season: number, at: string, reason = 'Close'): Journal | null {
  if (deposit <= 0) return null;
  return j(`facility-close:${f.id}:${season}:${at}`, 'facility-close', `${reason} ${f.name}: deposit returned`, [{ account: facilityAccount(f.id), amount: -deposit }, { account: 'player:cash', amount: deposit }], season, at);
}
export function upkeepLine(id: string, name: string, amount: number, season: number, at: string): Journal {
  return j(`upkeep:${id}:${season}`, 'upkeep', `${name} upkeep, season ${season}`, [{ account: 'player:cash', amount: -amount }, { account: 'sink', amount }], season, at);
}
export function estateBuyJournal(e: Estate, season: number, at: string): Journal {
  return j(`estate-buy:${e.id}:${season}:${at}`, 'estate-purchase', `Purchase ${e.name}`, [{ account: 'player:cash', amount: -e.price }, { account: estateAccount(e.id), amount: e.deposit }, { account: 'sink', amount: e.price - e.deposit }], season, at);
}
export function estateSellJournal(e: Estate, deposit: number, season: number, at: string, reason = 'Sell'): Journal | null {
  if (deposit <= 0) return null;
  return j(`estate-sell:${e.id}:${season}:${at}`, 'estate-sale', `${reason} ${e.name}: deed deposit returned`, [{ account: estateAccount(e.id), amount: -deposit }, { account: 'player:cash', amount: deposit }], season, at);
}
export function sponsorshipStakeJournal(season: number, event: string, label: string, stake: number, at: string): Journal {
  return j(`event-sponsor:${season}:${event}`, 'event-sponsor', `Sponsor ${label}`, [{ account: 'player:cash', amount: -stake }, { account: sponsorshipAccount(season, event), amount: stake }], season, at);
}
/**
 * Settle a sponsorship when its event pays prizes: purse to the AI prize winners by `recipients` shares (the
 * player's share and rounding to the treasury), the rest of the stake to the sink, and the visibility return from
 * the sponsor budget (already capped by the caller).
 */
export function sponsorshipSettleJournals(s: EventSponsorship, recipients: { id: string; share: number }[], ret: number, season: number, at: string): Journal[] {
  const acc = sponsorshipAccount(season, s.event);
  const purse = Math.floor(s.stake * SPONSOR.purseShare);
  const lines = [{ account: acc, amount: -s.stake }];
  let paid = 0;
  const shareSum = recipients.reduce((a, r) => a + r.share, 0) || 1;
  for (const r of recipients) {
    if (r.id === 'player') continue;
    const a = Math.floor(purse * r.share / shareSum);
    if (a <= 0) continue;
    paid += a; lines.push({ account: `comp:${r.id}`, amount: a });
  }
  lines.push({ account: 'treasury', amount: purse - paid }, { account: 'sink', amount: s.stake - purse });
  const out = [j(`event-sponsor-settle:${season}:${s.event}`, 'event-sponsor-settle', `${s.label}: sponsored purse paid to the prize winners, event costs`, lines, season, at)];
  if (ret > 0) out.push(j(`event-sponsor-return:${season}:${s.event}`, 'event-sponsor-return', `${s.label}: sponsor visibility return`, [{ account: `sponsor:${season}`, amount: -ret }, { account: 'player:cash', amount: ret }], season, at));
  return out;
}
export function loanDrawJournal(season: number, at: string): Journal {
  return j(`loan-draw:${season}`, 'loan-draw', `Recovery loan: $${LOAN.principal / MICRO} from the federation treasury (fee $${LOAN.fee / MICRO})`, [{ account: 'treasury', amount: -LOAN.principal }, { account: 'player:cash', amount: LOAN.principal }], season, at);
}
export function loanRepayJournal(season: number, amount: number, at: string): Journal {
  return j(`loan-repay:${season}`, 'loan-repay', `Recovery loan instalment, season ${season}`, [{ account: 'player:cash', amount: -amount }, { account: 'treasury', amount }], season, at);
}
export function hardshipJournal(season: number, fixtureId: string, at: string): Journal {
  return j(`hardship:${season}:${fixtureId}`, 'hardship-stipend', 'Hardship stipend: federation game played while in administration', [{ account: 'treasury', amount: -HARDSHIP.perGame }, { account: 'player:cash', amount: HARDSHIP.perGame }], season, at);
}

/** Events the player may sponsor in the current round (before each event starts). */
export function sponsorableEvents(plan: { circuits: { region: number; division: number }[]; swiss: { event: string; name: string }[] }, region: number, round: number, swissStart: number, champStart: number): { event: string; label: string }[] {
  const out: { event: string; label: string }[] = [];
  if (round <= 1) for (const c of plan.circuits) if (c.region === region) out.push({ event: `league:${c.region}:${c.division}`, label: `League · Division ${c.division} (your region)` });
  if (round < swissStart) for (const s of plan.swiss) out.push({ event: s.event, label: s.name });
  if (round < champStart) out.push({ event: 'champ', label: 'Crown Championship' });
  return out;
}
