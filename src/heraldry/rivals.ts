/**
 * Featured rivals (crown-rivals-1): 28 stable identities chosen ONCE when the federation is founded (or when a
 * v0.4 save is first opened) and persisted in the world record:
 *   24 "legends"  — the highest-rated Crown Division player of each of the 16 regions, plus the 8 highest-rated
 *                   remaining competitors of divisions 1–2;
 *    4 "circle"   — the four highest-rated members of the player's starting division (the rivals you will meet).
 * Retired featured rivals stay featured (as retired legends) — identities never change.
 * Playing-style labels come only from validated styles (src/engine/styles-validation.json); everything else
 * shown is computed from recorded results.
 */
import type { Competitor } from '../federation/model';

export interface FeaturedRival { id: string; tag: 'legend' | 'circle'; since: number }
export const FEATURED_ID = 'crown-rivals-1';

export function selectFeatured(competitors: Competitor[], playerRegion: number, playerDivision: number, season: number): FeaturedRival[] {
  const active = competitors.filter(c => c.status === 'active');
  const byRating = (xs: Competitor[]) => [...xs].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
  const picked = new Map<string, FeaturedRival>();
  for (let r = 0; r < 16; r++) {
    const top = byRating(active.filter(c => c.region === r && c.division === 1))[0];
    if (top) picked.set(top.id, { id: top.id, tag: 'legend', since: season });
  }
  for (const c of byRating(active.filter(c => c.division <= 2))) { if (picked.size >= 24) break; if (!picked.has(c.id)) picked.set(c.id, { id: c.id, tag: 'legend', since: season }); }
  for (const c of byRating(active.filter(c => c.region === playerRegion && c.division === playerDivision)).slice(0, 4)) if (!picked.has(c.id)) picked.set(c.id, { id: c.id, tag: 'circle', since: season });
  return [...picked.values()];
}

/** Ambition derived from the competitor's current standing (public information). */
export function ambitionOf(c: Competitor): string {
  if (c.status === 'retired') return 'Retired — a legend of the federation';
  if (c.titles.some(t => /Crown Champion/.test(t.title))) return 'Defend the Crown and add to the title count';
  if (c.division === 1) return 'Win the division and qualify for the Crown Championship';
  if (c.division <= 4) return 'Reach the Federation Open top eight, then the Crown Division';
  return 'Win promotion and climb toward the Federation Open divisions';
}
