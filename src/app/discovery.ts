/**
 * Competitor discovery (Discover Competitors screen): filtering, ordering and paging of the whole federation.
 * Pure and allocation-light so a 10,240-competitor world filters well inside one frame budget on desktop
 * (measured in tests/population.test.ts and docs/FEDERATION_SCALE.md §0.5). Rendering is paged: a screen never
 * builds more than one page of rows, however many competitors match.
 */
import type { Competitor } from '../federation/model';
import { clubOf } from '../heraldry/clubs';
import { isValidatedStyle } from '../engine/styles';

export type DiscoverySpecial = '' | 'watch' | 'featured' | 'rival' | 'titled' | 'upcoming' | 'favorites';
export interface DiscoveryFilters {
  q: string; region: number; division: number; minR: number; maxR: number; title: string; style: string; club: string; special: DiscoverySpecial;
}
export interface DiscoverySets { watchlist: Set<string>; featured: Set<string>; rivals: Set<string> | null; upcoming: Set<string>; favorites: Set<string> }
export const PAGE_SIZE = 100;

/** Active competitors matching every filter, highest rating first (ties by id, so pages are stable). */
export function filterCompetitors(competitors: Iterable<Competitor>, f: DiscoveryFilters, sets: DiscoverySets): Competitor[] {
  const ql = f.q.trim().toLowerCase();
  const out: Competitor[] = [];
  for (const c of competitors) {
    if (c.status !== 'active') continue;
    if (f.region >= 0 && c.region !== f.region) continue;
    if (f.division && c.division !== f.division) continue;
    if (c.rating < f.minR || c.rating > f.maxR) continue;
    if (f.title && (f.title === 'any' ? !c.fedTitle : c.fedTitle !== f.title)) continue;
    if (f.style && (isValidatedStyle(c.style) ? c.style : 'universal') !== f.style) continue;
    if (ql && !c.name.toLowerCase().includes(ql)) continue;
    if (f.club && clubOf(c.id, c.region).id !== f.club) continue;
    switch (f.special) {
      case 'watch': if (!sets.watchlist.has(c.id)) continue; break;
      case 'featured': if (!sets.featured.has(c.id)) continue; break;
      case 'rival': if (!sets.rivals?.has(c.id)) continue; break;
      case 'titled': if (!c.titles.length) continue; break;
      case 'upcoming': if (!sets.upcoming.has(c.id)) continue; break;
      case 'favorites': if (!sets.favorites.has(c.id)) continue; break;
    }
    out.push(c);
  }
  return out.sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** One page of a list (pages are numbered from 0; an out-of-range page is clamped). */
export function pageOf<T>(list: T[], page: number, size = PAGE_SIZE): { rows: T[]; page: number; pages: number; from: number } {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(0, Math.floor(page) || 0), pages - 1);
  return { rows: list.slice(p * size, (p + 1) * size), page: p, pages, from: p * size };
}
