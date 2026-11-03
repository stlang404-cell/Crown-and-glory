/**
 * Cosmetic unlockables (crown-cosmetics-1). Purely visual: none changes engine strength, ratings, results,
 * titles, pairings, prizes or market access. Two ways to get one:
 *  - bought with fictional crowns (the money goes to the federation sink; no resale), or
 *  - earned by a recorded accomplishment (cannot be bought — titles and trophies are never for sale).
 * Ownership and the equipped set are federation save state (with the ledger), so they persist and back up.
 */
import { MICRO, type Journal } from '../exchange/ledger';
import type { FedTitle } from '../heraldry/catalog';

export type CosmeticKind = 'frame' | 'banner' | 'board' | 'avatar';
export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  description: string;
  /** Price in micro-crowns, or null when it can only be earned. */
  price: number | null;
  /** Earned unlock condition (checked against recorded state). */
  earn?: { kind: 'fed-title'; min: FedTitle } | { kind: 'event-title' } | { kind: 'crown-champion' };
  /** For boards: the palette id applied through Settings. */
  boardId?: string;
}

const C = (n: number) => n * MICRO;
export const COSMETICS: Cosmetic[] = [
  { id: 'frame-bronze', kind: 'frame', name: 'Bronze frame', description: 'A bronze rim for your Passport portrait.', price: C(40) },
  { id: 'frame-silver', kind: 'frame', name: 'Silver frame', description: 'Polished silver with pixel corners.', price: C(90) },
  { id: 'frame-gold', kind: 'frame', name: 'Gold frame', description: 'Gold leaf with crimson inlay.', price: C(180) },
  { id: 'frame-laurel', kind: 'frame', name: 'Laurel frame', description: 'Earned: hold any federation title (Squire or higher).', price: null, earn: { kind: 'fed-title', min: 'Squire' } },
  { id: 'frame-crown', kind: 'frame', name: 'Champion’s crown frame', description: 'Earned: win the Crown Championship.', price: null, earn: { kind: 'crown-champion' } },
  { id: 'banner-obsidian', kind: 'banner', name: 'Obsidian banner', description: 'A dark heraldic banner across your Passport.', price: C(60) },
  { id: 'banner-arms', kind: 'banner', name: 'Banner of arms', description: 'Your club’s colours on your Passport banner.', price: C(120) },
  { id: 'banner-victor', kind: 'banner', name: 'Victor’s banner', description: 'Earned: win any event title (league, Swiss, Club Weekend or Championship).', price: null, earn: { kind: 'event-title' } },
  { id: 'board-marble', kind: 'board', name: 'Royal Marble board', description: 'Ivory and veined grey marble.', price: C(120), boardId: 'marble' },
  { id: 'board-crimson', kind: 'board', name: 'Crimson Court board', description: 'Rose stone and oxblood, in the federation’s colours.', price: C(120), boardId: 'crimson' },
  { id: 'avatar-portraits', kind: 'avatar', name: 'Portrait studio', description: 'Choose one of twelve pixel portraits for your Passport.', price: C(25) },
];
export const cosmetic = (id: string): Cosmetic | undefined => COSMETICS.find(c => c.id === id);
/** Portrait seeds offered by the Portrait studio. */
export const AVATAR_SEEDS = [3, 8, 14, 19, 27, 31, 44, 52, 63, 78, 85, 101];

export interface CosmeticState { owned: string[]; equipped: Partial<Record<CosmeticKind, string>>; avatarSeed?: number }
export const emptyCosmetics = (): CosmeticState => ({ owned: [], equipped: {} });

/** Is an earned cosmetic unlocked by the recorded career? */
export function earned(c: Cosmetic, career: { fedTitle: FedTitle | null; titles: string[] }, titleOrder: readonly string[]): boolean {
  if (!c.earn) return false;
  if (c.earn.kind === 'fed-title') return !!career.fedTitle && titleOrder.indexOf(career.fedTitle) >= titleOrder.indexOf(c.earn.min);
  if (c.earn.kind === 'crown-champion') return career.titles.some(t => /Crown Champion/.test(t));
  return career.titles.length > 0;
}

/** Purchase journal: the full price leaves player cash for the sink (no resale value, no bond). */
export function cosmeticJournal(c: Cosmetic, season: number, at: string): Journal {
  return { id: `cosmetic:${c.id}`, at, kind: 'cosmetic-purchase', memo: `Cosmetic: ${c.name}`, season, lines: [{ account: 'player:cash', amount: -(c.price ?? 0) }, { account: 'sink', amount: c.price ?? 0 }] };
}
