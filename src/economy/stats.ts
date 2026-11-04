/**
 * Lifetime financial statistics (crown-wealth-1, v0.11), computed only from the double-entry ledger: every journal
 * line on `player:cash`, summed exactly in integer micro-units, grouped by the journal's kind. Net worth over time
 * comes from the recorded finance snapshots. Nothing here is estimated.
 */
import { MICRO, type Journal } from '../exchange/ledger';

export type FlowClass = 'earning' | 'expense' | 'exchange' | 'financing' | 'capital';
/** Category of a journal kind as seen from the player's cash account. `capital` = buying or selling property (book
 *  value moves, wealth does not); `financing` = the starting grant and the recovery loan; `exchange` = trading (shown as one net figure). */
export const CATEGORY: Record<string, { label: string; cls: FlowClass }> = {
  prize: { label: 'Prize money', cls: 'earning' },
  sponsor: { label: 'Sponsorships', cls: 'earning' },
  'event-sponsor-return': { label: 'Event sponsorship returns', cls: 'earning' },
  'club-dues': { label: 'Club dues', cls: 'earning' },
  'club-attendance': { label: 'Club Weekend attendance', cls: 'earning' },
  'contract-share': { label: 'Contract prize shares', cls: 'earning' },
  'hardship-stipend': { label: 'Hardship stipend', cls: 'earning' },
  grant: { label: 'Starting grant', cls: 'financing' },
  mint: { label: 'Starting grant', cls: 'financing' },
  upkeep: { label: 'Upkeep', cls: 'expense' },
  'entry-fee': { label: 'Entry fees', cls: 'expense' },
  'club-hosting': { label: 'Club Weekend hosting', cls: 'expense' },
  'contract-stipend': { label: 'Contract stipends', cls: 'expense' },
  'cosmetic-purchase': { label: 'Cosmetics', cls: 'expense' },
  'event-sponsor': { label: 'Event sponsorship stakes', cls: 'expense' },
  'asset-purchase': { label: 'Assets and upgrades', cls: 'capital' },
  'asset-sale': { label: 'Asset sales and refunds', cls: 'capital' },
  'facility-build': { label: 'Club facilities', cls: 'capital' },
  'facility-close': { label: 'Facility deposits returned', cls: 'capital' },
  'estate-purchase': { label: 'Estates', cls: 'capital' },
  'estate-sale': { label: 'Estate deposits returned', cls: 'capital' },
  'loan-draw': { label: 'Recovery loan received', cls: 'financing' },
  'loan-repay': { label: 'Recovery loan repaid', cls: 'financing' },
  'trade-buy': { label: 'Exchange', cls: 'exchange' },
  'trade-sell': { label: 'Exchange', cls: 'exchange' },
  'market-settle': { label: 'Exchange', cls: 'exchange' },
  'market-cancel': { label: 'Exchange', cls: 'exchange' },
};
export const categoryOf = (kind: string) => CATEGORY[kind] ?? { label: kind, cls: 'expense' as FlowClass };

export const cashDelta = (j: Journal) => j.lines.reduce((s, l) => (l.account === 'player:cash' ? s + l.amount : s), 0);

export interface Milestone { id: string; label: string; season: number | null; round: number | null; at: string }
export interface LifetimeStats {
  /** Category label → total (µ, signed as seen from cash). */
  byCategory: { label: string; cls: FlowClass; inflow: number; outflow: number; net: number }[];
  earnings: number; expenses: number; exchangeNet: number; capitalNet: number; financingNet: number;
  /** Cash change over all journals (= current cash). */
  cashNet: number;
  journals: number;
  milestones: Milestone[];
  bySeason: { season: number; earnings: number; expenses: number; exchangeNet: number }[];
}

const EARN_STEPS = [1_000, 5_000, 10_000, 25_000, 100_000];
const WORTH_STEPS = [2_500, 5_000, 10_000, 25_000, 100_000];

/** Lifetime statistics from the player's journals (any order) and net-worth snapshots. Exact integer sums. */
export function lifetimeStats(journals: Journal[], points: { season: number; round: number; at: string; netWorth: number }[] = [], episodes: { since: number; until: number | null }[] = []): LifetimeStats {
  const js = journals.filter(j => j.lines.some(l => l.account === 'player:cash')).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
  const cats = new Map<string, { label: string; cls: FlowClass; inflow: number; outflow: number; net: number }>();
  const seasons = new Map<number, { season: number; earnings: number; expenses: number; exchangeNet: number }>();
  let earnings = 0, expenses = 0, exchangeNet = 0, capitalNet = 0, financingNet = 0, cashNet = 0;
  const milestones: Milestone[] = [];
  const hit = new Set<string>();
  const mark = (id: string, label: string, j: { season?: number; round?: number; at: string }) => { if (hit.has(id)) return; hit.add(id); milestones.push({ id, label, season: j.season ?? null, round: j.round ?? null, at: j.at }); };
  for (const j of js) {
    const d = cashDelta(j);
    if (!d) continue;
    cashNet += d;
    const c = categoryOf(j.kind);
    const row = cats.get(c.label) ?? { label: c.label, cls: c.cls, inflow: 0, outflow: 0, net: 0 };
    if (d > 0) row.inflow += d; else row.outflow -= d;
    row.net += d;
    cats.set(c.label, row);
    const s = seasons.get(j.season ?? 0) ?? { season: j.season ?? 0, earnings: 0, expenses: 0, exchangeNet: 0 };
    if (c.cls === 'earning') { earnings += d; s.earnings += d; }
    else if (c.cls === 'expense') { expenses -= d; s.expenses -= d; }
    else if (c.cls === 'exchange') { exchangeNet += d; s.exchangeNet += d; }
    else if (c.cls === 'capital') capitalNet += d;
    else financingNet += d;
    seasons.set(s.season, s);
    if (j.kind === 'prize' && d > 0) mark('first-prize', 'First prize money', j);
    if (j.kind === 'sponsor' && d > 0) mark('first-sponsor', 'First sponsorship', j);
    if (j.kind === 'asset-purchase' && j.memo.includes('Chess Club')) mark('first-club', 'Founded a club', j);
    if (j.kind === 'facility-build') mark('first-facility', 'First club facility', j);
    if (j.kind === 'estate-purchase') mark('first-estate', 'First estate', j);
    if (j.kind === 'event-sponsor') mark('first-event-sponsor', 'First event sponsorship', j);
    if (j.kind === 'loan-draw') mark('loan', 'Took the recovery loan', j);
    if (j.kind === 'loan-repay') mark('loan-repay', 'First loan instalment repaid', j);
    for (const step of EARN_STEPS) if (earnings >= step * MICRO) mark(`earned-${step}`, `Lifetime earnings $${step.toLocaleString('en')}`, j);
  }
  if (exchangeNet > 0) { const j = js.filter(x => categoryOf(x.kind).cls === 'exchange').at(-1); if (j) mark('exchange-profit', 'Lifetime Exchange profit', j); }
  for (const p of [...points].sort((a, b) => (a.at < b.at ? -1 : 1))) for (const step of WORTH_STEPS) if (p.netWorth >= step * MICRO) mark(`worth-${step}`, `Net worth $${step.toLocaleString('en')}`, p);
  for (const e of episodes) {
    milestones.push({ id: `admin-${e.since}`, label: 'Entered financial administration', season: e.since, round: null, at: '' });
    if (e.until !== null) milestones.push({ id: `recovered-${e.until}`, label: `Recovered from administration (${e.until - e.since} season${e.until - e.since === 1 ? '' : 's'})`, season: e.until, round: null, at: '' });
  }
  milestones.sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.round ?? 99) - (b.round ?? 99));
  return {
    byCategory: [...cats.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    earnings, expenses, exchangeNet, capitalNet, financingNet, cashNet, journals: js.length, milestones,
    bySeason: [...seasons.values()].filter(s => s.season > 0).sort((a, b) => a.season - b.season),
  };
}
