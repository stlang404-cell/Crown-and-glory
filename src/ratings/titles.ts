/**
 * Rating titles (crown-rating-titles-1): one cosmetic title for every 100 points of the Federation rating (the
 * player's career Glicko-2 rating, src/ratings/pools.ts, as used by the Federation), with an insignia built from the game's heraldry grammar.
 *
 * A rating title only describes the current rating. It is not a Federation title (Squire … Sovereign, earned by
 * norms), not a division, not a regional league and not financial prestige. Titles and the insignia collection are
 * COMPUTED from the saved rating history — never stored — so they cannot be duplicated, lost in a migration or
 * silently rewritten. The collection and the peak title count established ratings only (provisional ratings swing
 * by hundreds of points and would hand out titles that were never really held).
 */
import type { EmblemSpec } from '../heraldry/spec';
import type { ChargeId, ShapeId } from '../heraldry/charges';

export const RATING_TITLES_ID = 'crown-rating-titles-1';

export type Era = 'Apprentice' | 'Scholarly' | 'Master' | 'Legendary' | 'Sovereign';
export interface RatingTitle { index: number; min: number; max: number | null; name: string; era: Era; charge: ChargeId }

const NAMES: [string, ChargeId][] = [
  ['Wandless Wanderer', 'gate'], ['First-Year Initiate', 'key'], ['Candlelight Apprentice', 'flame'], ['Spellbook Novice', 'book'],
  ['Charmed Pawn', 'pawn'], ['Potion Scholar', 'chalice'], ['Wandcraft Student', 'quill'], ['Hex Apprentice', 'moon'],
  ['Arcane Challenger', 'sword'], ['Rune Reader', 'book'], ['Dueling Scholar', 'knight'], ['Enchanted Tactician', 'star'],
  ['Arcane Strategist', 'rook'], ['Runic Tactician', 'key'], ['Spellweaver', 'quill'], ['Wardbreaker', 'gate'],
  ['Mystic Duelist', 'sword'], ['Grand Enchanter', 'star'], ['High Arcanist', 'tower'], ["Archmage's Heir", 'key'],
  ['Royal Spellmaster', 'queen'], ['Grand Runemaster', 'book'], ['Elder Magister', 'laurel'], ['Crown Sorcerer', 'crown'],
  ['Supreme Arcanist', 'sun'], ['Grand Runelord', 'griffin'], ['Imperial Archmage', 'king'], ['Elder of the Crown', 'crown'],
  ['Sovereign Magister', 'scales'], ['Astral Archon', 'star'], ['Eternal Sovereign', 'crown'],
];
const eraOf = (i: number): Era => (i < 8 ? 'Apprentice' : i < 16 ? 'Scholarly' : i < 24 ? 'Master' : i < 30 ? 'Legendary' : 'Sovereign');

export const RATING_TITLES: RatingTitle[] = NAMES.map(([name, charge], i) => ({ index: i, min: i * 100, max: i === NAMES.length - 1 ? null : i * 100 + 99, name, era: eraOf(i), charge }));

/** Title for a rating (ratings below 0 use the first title; 3000+ is the last, uncapped). */
export function titleFor(rating: number): RatingTitle {
  const i = Math.max(0, Math.min(RATING_TITLES.length - 1, Math.floor(rating / 100)));
  return RATING_TITLES[i];
}

/** Points to the next title (null at the top) and progress through the current 100-point band (0–1). */
export function titleProgress(rating: number): { next: RatingTitle | null; toNext: number | null; fraction: number } {
  const t = titleFor(rating);
  const next = RATING_TITLES[t.index + 1] ?? null;
  if (!next) return { next: null, toNext: null, fraction: 1 };
  const r = Math.max(0, rating);
  return { next, toNext: Math.max(1, Math.ceil(next.min - r)), fraction: Math.min(1, Math.max(0, (r - t.min) / 100)) };
}

// ---------------------------------------------------------------- insignia design (heraldry grammar)
const ERA_STYLE: Record<Era, { shape: ShapeId; field: [string, string]; chargeColor: string; border: EmblemSpec['border']; prestige: number; crest: EmblemSpec['crest']; wreath: boolean }> = {
  // wood and parchment
  Apprentice: { shape: 'pennant', field: ['bronze', '#e6d7b5'], chargeColor: '#3a2a18', border: 'single', prestige: 0, crest: null, wreath: false },
  // silver
  Scholarly: { shape: 'heater', field: ['steel', 'argent'], chargeColor: 'argent', border: 'double', prestige: 1, crest: null, wreath: false },
  // jewelled crests
  Master: { shape: 'kite', field: ['purpure', 'sanguine'], chargeColor: 'or', border: 'double', prestige: 3, crest: 'helm', wreath: false },
  // gold, platinum and celestial
  Legendary: { shape: 'cartouche', field: ['azure', 'or'], chargeColor: 'or', border: 'pixel', prestige: 4, crest: 'star', wreath: true },
  Sovereign: { shape: 'octagon', field: ['sable', 'or'], chargeColor: 'or', border: 'pixel', prestige: 5, crest: 'crown', wreath: true },
};
const ERA_DIVISION: Record<Era, EmblemSpec['division'][]> = {
  Apprentice: ['plain', 'fess'], Scholarly: ['plain', 'chief'], Master: ['chevron', 'pale'], Legendary: ['chief', 'saltire'], Sovereign: ['quarterly'],
};

/** The insignia of a rating title: era sets shape, material, border, crest and prestige; the charge and field
 *  division identify the title within its era; pips mark the step inside the era. */
export function insigniaSpec(t: RatingTitle): EmblemSpec {
  const st = ERA_STYLE[t.era];
  const eraStart = RATING_TITLES.findIndex(x => x.era === t.era);
  const step = t.index - eraStart;
  return {
    shape: st.shape, field: st.field as EmblemSpec['field'], division: ERA_DIVISION[t.era][step % ERA_DIVISION[t.era].length],
    charge: t.charge, chargeColor: st.chargeColor, border: st.border, crest: st.crest, wreath: st.wreath,
    pips: t.era === 'Sovereign' ? 5 : Math.min(5, Math.floor(step / 2) + 1), prestige: st.prestige,
  };
}

// ---------------------------------------------------------------- collection and peak (from saved rating events)
export interface RatingPoint { after: { rating: number; rd: number }; games: number; at: string }

/** Established rating = the Glicko-2 rating once it is no longer provisional (same rule as the Passport). */
export type IsProvisional = (games: number, rd: number) => boolean;

/** Titles held while established, including every band passed through (rising or falling) between two consecutive established
 *  ratings; bands below the first established rating are not collected. Deterministic and idempotent. */
export function collectedTitles(points: RatingPoint[], isProvisional: IsProvisional): { collected: RatingTitle[]; peak: RatingTitle | null; peakRating: number | null } {
  const est = points.filter(p => !isProvisional(p.games, p.after.rd)).sort((a, b) => a.at.localeCompare(b.at));
  if (!est.length) return { collected: [], peak: null, peakRating: null };
  const have = new Set<number>();
  let prev = est[0].after.rating;
  have.add(titleFor(prev).index);
  for (const p of est.slice(1)) {
    const r = p.after.rating;
    const a = titleFor(Math.min(prev, r)).index, b = titleFor(Math.max(prev, r)).index;
    for (let i = a; i <= b; i++) have.add(i);
    prev = r;
  }
  const peakRating = Math.max(...est.map(p => p.after.rating));
  return { collected: [...have].sort((x, y) => x - y).map(i => RATING_TITLES[i]), peak: titleFor(peakRating), peakRating };
}
