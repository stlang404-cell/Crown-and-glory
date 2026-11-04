/**
 * Historical roster (crown-roster-1, docs/ROSTER.md, docs/V10_PLAN.md Decision 2).
 *
 * A curated list of historical figures who died in 1925 or earlier appears in the Federation as clearly fictional
 * chess personas. A persona is only a name laid over a competitor that the population generator has already made:
 * rating, hidden strength, style, region, division, age and career all come from the seeded generator and are
 * independent of the person (never chosen by fame, nationality, politics or any other trait). Which competitors
 * carry a persona, and which identity each gets, is decided by seeded hashes of the world seed and competitor id.
 *
 * Existing competitors are never renamed. Personas reach a world in two ways only:
 *  * founding: a share of a NEW federation's competitors (applyFoundingPersonas, called once when it is founded);
 *  * turnover: some of the new entrants that replace retirements at a season's end (assignEntrantPersonas).
 * Each identity is used at most once per world, even after its competitor retires.
 */
import identities from './rosterIdentities.json';
import type { Competitor } from './model';
import { hashSeed, rng01 } from './generator';

export const ROSTER_ID = 'crown-roster-1';

export const ROSTER_CATEGORIES = ['statesman', 'musician', 'performer', 'artist', 'scientist', 'inventor', 'author', 'philosopher', 'explorer', 'athlete', 'chess', 'cultural'] as const;
export type RosterCategory = (typeof ROSTER_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<RosterCategory, string> = {
  statesman: 'Leaders & Statespeople', musician: 'Musicians & Composers', performer: 'Actors & Performers', artist: 'Artists & Architects',
  scientist: 'Scientists & Mathematicians', inventor: 'Inventors & Engineers', author: 'Authors & Poets', philosopher: 'Philosophers & Thinkers',
  explorer: 'Explorers & Travellers', athlete: 'Athletes', chess: 'Chess Masters', cultural: 'Reformers & Other Cultural Figures',
};
export const ROSTER_REGIONS = ['Europe', 'North America', 'Latin America & Caribbean', 'Sub-Saharan Africa', 'Middle East & North Africa', 'Central Asia', 'South Asia', 'East Asia', 'Southeast Asia', 'Oceania'] as const;
/** Latest permitted year of death: more than 100 years before 2026 (Decision 2). */
export const MAX_DEATH_YEAR = 1925;

export interface RosterIdentity {
  id: string; // stable, e.g. hist-ada-lovelace
  name: string; // display name as commonly written
  born: number; // year; negative = BC
  died: number; // year; negative = BC; <= MAX_DEATH_YEAR
  circa?: boolean; // one or both years are approximate
  category: RosterCategory;
  region: (typeof ROSTER_REGIONS)[number];
  descriptor: string; // one neutral line
  reference: string; // English Wikipedia article title
}

export const ROSTER_IDENTITIES = identities as RosterIdentity[];
const BY_ID = new Map(ROSTER_IDENTITIES.map(r => [r.id, r]));
export const rosterIdentity = (id: string | undefined | null): RosterIdentity | undefined => (id ? BY_ID.get(id) : undefined);

/** Share of a new federation's founding population that carries a persona … */
export const FOUNDING_PERSONA_SHARE = 0.08;
/** … but never more than this fraction of the roster, so later entrants can still bring new identities. */
export const FOUNDING_ROSTER_CAP = 0.6;
/** Chance that a new entrant (season-end turnover) carries a persona while unused identities remain. */
export const ENTRANT_PERSONA_CHANCE = 0.12;

export const PERSONA_NOTE = 'Historical figures appear as fictional chess personas. Their ratings, styles and results are invented and say nothing about the real people.';

const yr = (y: number) => (y < 0 ? `${-y} BC` : `${y}`);
/** "1815–1852", "c. 470 BC – 399 BC". */
export function lifespan(r: RosterIdentity): string {
  const bc = r.born < 0 || r.died < 0;
  return `${r.circa ? 'c. ' : ''}${yr(r.born)}${bc ? ' – ' : '–'}${yr(r.died)}`;
}

/** A well-mixed seeded sort key (FNV alone correlates with sequential ids such as c0001, c0002, …). */
const key = (...parts: (string | number)[]) => rng01(hashSeed(...parts))();
function seededSort<T extends { id: string }>(xs: T[], seed: number, purpose: string): T[] {
  const k = new Map(xs.map(x => [x.id, key(seed, purpose, x.id)]));
  return [...xs].sort((a, b) => k.get(a.id)! - k.get(b.id)! || a.id.localeCompare(b.id));
}
/** The world's fixed, seeded order in which identities are handed out (independent of fame or any trait). */
const identityOrder = (seed: number): RosterIdentity[] => seededSort(ROSTER_IDENTITIES, seed, 'persona-order');

function takenIn(competitors: Iterable<Competitor>): { ids: Set<string>; names: Set<string> } {
  const ids = new Set<string>(), names = new Set<string>();
  for (const c of competitors) { names.add(c.name); if (c.persona) ids.add(c.persona); }
  return { ids, names };
}

function apply(c: Competitor, r: RosterIdentity, names: Set<string>): void {
  names.delete(c.name);
  c.name = r.name;
  c.persona = r.id;
  names.add(r.name);
}

/**
 * Give a share of a newly generated federation persona identities. Call once, when the federation is founded and
 * before anything refers to competitor names. Mutates the given competitors; returns how many received a persona.
 */
export function applyFoundingPersonas(seed: number, competitors: Competitor[]): number {
  const taken = takenIn(competitors);
  if (taken.ids.size) return 0; // already applied
  const k = Math.min(Math.round(competitors.length * FOUNDING_PERSONA_SHARE), Math.floor(ROSTER_IDENTITIES.length * FOUNDING_ROSTER_CAP));
  const slots = seededSort(competitors, seed, 'persona-slot');
  const order = identityOrder(seed).filter(r => !taken.names.has(r.name));
  let n = 0;
  for (let i = 0; i < slots.length && n < k && n < order.length; i++) { apply(slots[i], order[n], taken.names); n++; }
  return n;
}

/**
 * Season-end turnover: each new entrant has a seeded chance of carrying the next unused identity. `everyone` is the
 * whole population (including the entrants). Mutates the entrants; returns the ids that received a persona.
 */
export function assignEntrantPersonas(seed: number, season: number, entrants: Competitor[], everyone: Iterable<Competitor>): string[] {
  if (!entrants.length) return [];
  const taken = takenIn(everyone);
  const order = identityOrder(seed).filter(r => !taken.ids.has(r.id));
  const out: string[] = [];
  let next = 0;
  for (const e of entrants) {
    if (e.persona) continue;
    if (key(seed, 'persona-entrant', season, e.id) >= ENTRANT_PERSONA_CHANCE) continue;
    while (next < order.length && taken.names.has(order[next].name)) next++;
    if (next >= order.length) break;
    apply(e, order[next++], taken.names);
    out.push(e.id);
  }
  return out;
}
