/**
 * Federation persona roster (docs/ROSTER.md, docs/V10_PLAN.md Decision 2 as revised).
 *
 * Two curated sets of identities appear in the Federation as clearly fictional chess personas:
 *  * historical (crown-roster-1, `hist-…`): figures who died in 1925 or earlier;
 *  * contemporary (crown-roster-pub-1, `pub-…`): widely known adult public figures who are living or died after
 *    1925, included at the owner's explicit instruction with the safeguards in docs/ROSTER.md.
 * A persona is only a name laid over a competitor that the population generator has already made: rating, hidden
 * strength, style, region, division, age and career all come from the seeded generator and are independent of the
 * person (never chosen by fame, nationality, politics or any other trait). Which competitors carry a persona, and
 * which identity each gets, is decided by seeded hashes of the world seed and competitor id.
 *
 * Existing competitors are never renamed. Personas reach a world in two ways only:
 *  * founding: a share of a NEW federation's competitors (applyFoundingPersonas, called once when it is founded);
 *  * turnover: some of the new entrants that replace retirements at a season's end (assignEntrantPersonas).
 * Each identity is used at most once per world, even after its competitor retires.
 *
 * A contemporary persona keeps the competitor's own generated name as `altName`. With Settings → "Show contemporary
 * famous names" off (or if an identity is ever removed from the data file) the competitor is shown under that
 * stable original name; its id, record and history never change (applyNameMode).
 */
import identities from './rosterIdentities.json';
import contemporary from './rosterContemporary.json';
import type { Competitor } from './model';
import { hashSeed, rng01 } from './generator';

export const ROSTER_ID = 'crown-roster-1';
export const CONTEMPORARY_ROSTER_ID = 'crown-roster-pub-1';

export const ROSTER_CATEGORIES = ['statesman', 'musician', 'performer', 'artist', 'scientist', 'inventor', 'author', 'philosopher', 'explorer', 'athlete', 'chess', 'cultural'] as const;
export type RosterCategory = (typeof ROSTER_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<RosterCategory, string> = {
  statesman: 'Leaders & Statespeople', musician: 'Musicians & Composers', performer: 'Actors & Performers', artist: 'Artists & Architects',
  scientist: 'Scientists & Mathematicians', inventor: 'Inventors & Engineers', author: 'Authors & Poets', philosopher: 'Philosophers & Thinkers',
  explorer: 'Explorers & Travellers', athlete: 'Athletes', chess: 'Chess Masters', cultural: 'Reformers & Other Cultural Figures',
};
export const ROSTER_REGIONS = ['Europe', 'North America', 'Latin America & Caribbean', 'Sub-Saharan Africa', 'Middle East & North Africa', 'Central Asia', 'South Asia', 'East Asia', 'Southeast Asia', 'Oceania'] as const;
export type RosterRegion = (typeof ROSTER_REGIONS)[number];
/** Latest permitted year of death for the historical set: more than 100 years before 2026 (Decision 2). */
export const MAX_DEATH_YEAR = 1925;

export interface RosterIdentity {
  id: string; // stable, e.g. hist-ada-lovelace
  name: string; // display name as commonly written
  born: number; // year; negative = BC
  died: number; // year; negative = BC; <= MAX_DEATH_YEAR
  circa?: boolean; // one or both years are approximate
  category: RosterCategory;
  region: RosterRegion;
  descriptor: string; // one neutral line
  reference: string; // English Wikipedia article title
}

/** A contemporary public figure: names and a neutral profession line only, no personal data. */
export interface ContemporaryIdentity {
  id: string; // stable, e.g. pub-taylor-swift
  name: string; // display name as commonly written
  category: RosterCategory;
  region: RosterRegion; // the person's real-world region (provenance only; never used to place the persona)
  descriptor: string; // one neutral profession line, e.g. "American singer-songwriter"
  reference: string; // English Wikipedia article title
  living: boolean; // as of the data's compilation (docs/ROSTER.md)
  born?: number; // optional; only where certain (none recorded at present)
}

export const ROSTER_IDENTITIES = identities as RosterIdentity[];
export const CONTEMPORARY_IDENTITIES = contemporary as ContemporaryIdentity[];
const BY_ID = new Map(ROSTER_IDENTITIES.map(r => [r.id, r]));
const PUB_BY_ID = new Map(CONTEMPORARY_IDENTITIES.map(r => [r.id, r]));
/** Historical identity by id (undefined for contemporary or unknown ids). */
export const rosterIdentity = (id: string | undefined | null): RosterIdentity | undefined => (id ? BY_ID.get(id) : undefined);
/** Contemporary identity by id (undefined if unknown, e.g. removed from the data file). */
export const contemporaryIdentity = (id: string | undefined | null): ContemporaryIdentity | undefined => (id ? PUB_BY_ID.get(id) : undefined);
export const isContemporaryId = (id: string | undefined | null): boolean => !!id && id.startsWith('pub-');

/**
 * People the owner named explicitly (docs/V10_PLAN.md Decision 2, owner instruction). They are handed out first
 * within their set, still to seeded-random competitors (and so seeded-random ratings, styles and divisions), so that
 * a new federation carries every one of them.
 */
export const OWNER_NAMED_CONTEMPORARY = ['Taylor Swift', 'Beyoncé', 'Drake', 'Michael Jackson', 'Barack Obama', 'Donald Trump', 'Leonardo DiCaprio', 'Tom Cruise', 'Morgan Freeman', 'Albert Einstein', 'Marie Curie', 'Michael Jordan', 'LeBron James', 'Serena Williams'];
export const OWNER_NAMED_HISTORICAL = ['Abraham Lincoln', 'Napoleon Bonaparte', 'Isaac Newton', 'Leonardo da Vinci', 'Vincent van Gogh', 'Julius Caesar'];
const ownerIds = (names: string[], xs: { id: string; name: string }[]) => new Set(names.map(n => xs.find(x => x.name === n)?.id).filter((x): x is string => !!x));
const OWNER_HIST = ownerIds(OWNER_NAMED_HISTORICAL, ROSTER_IDENTITIES);
const OWNER_PUB = ownerIds(OWNER_NAMED_CONTEMPORARY, CONTEMPORARY_IDENTITIES);

/** Share of a new federation's founding population that carries a historical persona … */
export const FOUNDING_PERSONA_SHARE = 0.08;
/** … and the share that carries a contemporary persona (other competitors: the two never overlap) … */
export const CONTEMPORARY_FOUNDING_SHARE = 0.06;
/** … but never more than this fraction of either set, so later entrants can still bring new identities. */
export const FOUNDING_ROSTER_CAP = 0.6;
/** Chance that a new entrant (season-end turnover) carries a historical persona while unused identities remain. */
export const ENTRANT_PERSONA_CHANCE = 0.12;
/** Chance that a new entrant carries a contemporary persona instead (a disjoint band of the same seeded draw). */
export const CONTEMPORARY_ENTRANT_CHANCE = 0.08;

export const PERSONA_NOTE = 'Historical figures appear as fictional chess personas. Their ratings, styles and results are invented and say nothing about the real people.';
/** Shown on every surface that shows a contemporary persona (Decision 2 safeguard). */
export const CONTEMPORARY_DISCLOSURE = 'Fictional chess persona — not the real person; no participation or endorsement.';
export const CONTEMPORARY_NOTE = 'Contemporary famous names appear as fictional chess personas. Rating, style, region, division and career are assigned by the world seed, independently of the person, and say nothing about them.';

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
/** The world's fixed, seeded order in which identities of a set are handed out: the owner-named people first (in
 *  seeded order), then everyone else (in seeded order). Independent of fame or any other trait. */
function priorityOrder<T extends { id: string }>(xs: T[], seed: number, purpose: string, first: Set<string>): T[] {
  const s = seededSort(xs, seed, purpose);
  return [...s.filter(x => first.has(x.id)), ...s.filter(x => !first.has(x.id))];
}
const historicalOrder = (seed: number) => priorityOrder(ROSTER_IDENTITIES, seed, 'persona-order', OWNER_HIST);
const contemporaryOrder = (seed: number) => priorityOrder(CONTEMPORARY_IDENTITIES, seed, 'persona-order-pub', OWNER_PUB);

/**
 * Names reserved in a world, independent of the "Show contemporary famous names" setting: every competitor's
 * current name, every contemporary persona's original name and its famous name. Used for the uniqueness of
 * generated names so that the setting can never change what the simulation generates.
 */
export function reservedNames(competitors: Iterable<Competitor>): Set<string> {
  const names = new Set<string>();
  for (const c of competitors) {
    names.add(c.name);
    if (c.altName) names.add(c.altName);
    const p = contemporaryIdentity(c.persona);
    if (p) names.add(p.name);
  }
  return names;
}

function takenIn(competitors: Iterable<Competitor>): { ids: Set<string>; names: Set<string> } {
  const list = [...competitors];
  const ids = new Set<string>();
  for (const c of list) if (c.persona) ids.add(c.persona);
  return { ids, names: reservedNames(list) };
}

function applyHistorical(c: Competitor, r: RosterIdentity, names: Set<string>): void {
  names.delete(c.name);
  c.name = r.name;
  c.persona = r.id;
  names.add(r.name);
}
/** Contemporary: the generated name stays reserved as the stable original name (altName). */
function applyContemporary(c: Competitor, r: ContemporaryIdentity, names: Set<string>, show: boolean): void {
  c.altName = c.name;
  c.persona = r.id;
  c.name = show ? r.name : c.altName;
  names.add(r.name);
}

/**
 * Give a share of a newly generated federation persona identities. Call once, when the federation is founded and
 * before anything refers to competitor names. Mutates the given competitors; returns how many received a persona.
 * `show` is the "Show contemporary famous names" setting (display only: it never changes which persona is given).
 */
export function applyFoundingPersonas(seed: number, competitors: Competitor[], show = true): number {
  const taken = takenIn(competitors);
  if (taken.ids.size) return 0; // already applied
  const kh = Math.min(Math.round(competitors.length * FOUNDING_PERSONA_SHARE), Math.floor(ROSTER_IDENTITIES.length * FOUNDING_ROSTER_CAP));
  const kc = Math.min(Math.round(competitors.length * CONTEMPORARY_FOUNDING_SHARE), Math.floor(CONTEMPORARY_IDENTITIES.length * FOUNDING_ROSTER_CAP));
  const slots = seededSort(competitors, seed, 'persona-slot');
  const hist = historicalOrder(seed).filter(r => !taken.names.has(r.name));
  let i = 0, n = 0;
  for (; i < slots.length && n < kh && n < hist.length; i++, n++) applyHistorical(slots[i], hist[n], taken.names);
  const pub = contemporaryOrder(seed).filter(r => !taken.names.has(r.name));
  for (let m = 0; i < slots.length && m < kc && m < pub.length; i++, m++, n++) applyContemporary(slots[i], pub[m], taken.names, show);
  return n;
}

/**
 * Season-end turnover: each new entrant has a seeded chance of carrying the next unused identity of a set (one draw:
 * below ENTRANT_PERSONA_CHANCE historical, the next CONTEMPORARY_ENTRANT_CHANCE contemporary). `everyone` is the
 * whole population (including the entrants). Mutates the entrants; returns the ids that received a persona.
 */
export function assignEntrantPersonas(seed: number, season: number, entrants: Competitor[], everyone: Iterable<Competitor>, show = true): string[] {
  if (!entrants.length) return [];
  const taken = takenIn(everyone);
  const hist = historicalOrder(seed).filter(r => !taken.ids.has(r.id));
  const pub = contemporaryOrder(seed).filter(r => !taken.ids.has(r.id));
  const out: string[] = [];
  let nh = 0, np = 0;
  for (const e of entrants) {
    if (e.persona) continue;
    const u = key(seed, 'persona-entrant', season, e.id);
    if (u < ENTRANT_PERSONA_CHANCE) {
      while (nh < hist.length && taken.names.has(hist[nh].name)) nh++;
      if (nh >= hist.length) continue;
      applyHistorical(e, hist[nh++], taken.names);
      out.push(e.id);
    } else if (u < ENTRANT_PERSONA_CHANCE + CONTEMPORARY_ENTRANT_CHANCE) {
      while (np < pub.length && taken.names.has(pub[np].name)) np++;
      if (np >= pub.length) continue;
      applyContemporary(e, pub[np++], taken.names, show);
      out.push(e.id);
    }
  }
  return out;
}

// ---------------------------------------------------------------- display ("Show contemporary famous names")

/** The persona a competitor is shown with under the current setting, or null when it is shown as an original. */
export type ShownPersona = { kind: 'historical'; identity: RosterIdentity } | { kind: 'contemporary'; identity: ContemporaryIdentity };
export function shownPersona(c: Pick<Competitor, 'persona'> | undefined | null, show: boolean): ShownPersona | null {
  if (!c?.persona) return null;
  const h = rosterIdentity(c.persona);
  if (h) return { kind: 'historical', identity: h };
  const p = show ? contemporaryIdentity(c.persona) : undefined;
  return p ? { kind: 'contemporary', identity: p } : null;
}

/** The name a contemporary persona competitor is shown under: the famous name when shown and still in the data,
 *  otherwise its stable original name. Other competitors keep their name. */
export function displayNameOf(c: Pick<Competitor, 'name' | 'persona' | 'altName'>, show: boolean): string {
  if (!isContemporaryId(c.persona) || !c.altName) return c.name;
  const p = contemporaryIdentity(c.persona);
  return show && p ? p.name : c.altName;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Apply the setting to a world's competitors in memory: every contemporary persona's `name` becomes its display
 * name, and (with `texts`) names inside career milestone texts are switched the same way. Ids, ratings, results and
 * history are untouched; switching back restores the same text. Returns the number of competitors renamed.
 */
export function applyNameMode(competitors: Iterable<Competitor>, show: boolean, opts: { texts?: boolean } = {}): number {
  const list = [...competitors];
  const swap = new Map<string, string>();
  let n = 0;
  for (const c of list) {
    if (!isContemporaryId(c.persona) || !c.altName) continue;
    const want = displayNameOf(c, show);
    const p = contemporaryIdentity(c.persona);
    if (p && p.name !== c.altName) swap.set(show ? c.altName : p.name, want);
    if (c.name !== want) { c.name = want; n++; }
  }
  if (opts.texts && swap.size) {
    const re = new RegExp([...swap.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|'), 'g');
    for (const c of list) for (const m of c.milestones) { re.lastIndex = 0; if (re.test(m.text)) m.text = m.text.replace(re, s => swap.get(s) ?? s); }
  }
  return n;
}
