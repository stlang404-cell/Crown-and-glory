/**
 * Legacy header customisation (crown-legacy-prefs-1): primary banner, featured trophies, insignia, header accent,
 * achievement showcase and Exchange honour. Every choice must be something the career has genuinely earned:
 * `equip` refuses anything else, and `effective` drops a stored choice that is not (or no longer) available, so a
 * hand-edited or restored save can never display an unearned item. Stored in the meta store under `legacy:prefs`
 * (carried in backups, docs/SAVE_FORMAT.md). Purely visual: nothing here affects play, ratings or prizes.
 */
import type { TrophyAward } from './trophies';

export const PREFS_KEY = 'legacy:prefs';
export const MAX_FEATURED = 3;
export const MAX_SHOWCASE = 3;
export const MAX_NAME = 24;

export const ACCENTS = [
  { id: 'crimson', name: 'Crimson', color: '#b8323f', rule: 'Always available.' },
  { id: 'steel', name: 'Steel', color: '#6c7686', rule: 'Always available.' },
  { id: 'royal-blue', name: 'Royal Blue', color: '#2f5d93', rule: 'Hold any Silver-tier (tier 2) trophy or better.' },
  { id: 'emerald', name: 'Emerald', color: '#2f7a55', rule: 'Hold a Promotion Banner.' },
  { id: 'amethyst', name: 'Amethyst', color: '#6b4a8c', rule: 'Hold a Norm Medal.' },
  { id: 'burgundy', name: 'Burgundy', color: '#7a2430', rule: 'Hold a Division Shield.' },
  { id: 'silver', name: 'Silver', color: '#c9d1da', rule: 'Hold a Rating Milestone.' },
  { id: 'gold', name: 'Gold', color: '#d6ac4f', rule: 'Hold a Royal-tier (tier 4) trophy or better.' },
] as const;
export type AccentId = typeof ACCENTS[number]['id'];

export interface LegacyPrefs {
  v: 1;
  /** Display name in the header (free text; "You" when empty). */
  name: string;
  banner: string | null;
  featured: string[];
  /** Rating-title index of a collected insignia; null = the current rating title's insignia. */
  insignia: number | null;
  accent: AccentId;
  /** Vault collectible ids. */
  showcase: string[];
  /** A held Exchange title (Vault `xt-*` id). */
  honour: string | null;
}
export const defaultPrefs = (): LegacyPrefs => ({ v: 1, name: '', banner: null, featured: [], insignia: null, accent: 'crimson', showcase: [], honour: null });

export interface BannerOption { id: string; name: string; colors: [string, string]; source: string }
export interface Earned {
  trophies: TrophyAward[];
  banners: BannerOption[];
  /** Collected insignia (rating-title indices). */
  insignias: number[];
  /** Owned Vault collectibles (achievements), id → name. */
  vault: { id: string; name: string }[];
  /** Held Exchange titles, id → name. */
  exchangeTitles: { id: string; name: string }[];
}

/** Accents the career has earned (rule per ACCENTS entry). */
export function earnedAccents(trophies: TrophyAward[]): AccentId[] {
  const has = (f: (t: TrophyAward) => boolean) => trophies.some(f);
  const ok: Record<AccentId, boolean> = {
    crimson: true, steel: true,
    'royal-blue': has(t => t.tier >= 2), emerald: has(t => t.defId === 'season-promotion'), amethyst: has(t => t.defId === 'norm-medal'),
    burgundy: has(t => t.defId === 'div-champion'), silver: has(t => t.defId === 'rating-milestone'), gold: has(t => t.tier >= 4),
  };
  return ACCENTS.map(a => a.id).filter(id => ok[id]);
}

export class LegacyError extends Error {}

/** Normalise any stored value into prefs (unknown fields and malformed values fall back to the defaults). */
export function parsePrefs(raw: unknown): LegacyPrefs {
  const d = defaultPrefs();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  const strs = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))].slice(0, max) : []);
  return {
    v: 1,
    name: typeof o.name === 'string' ? o.name.slice(0, MAX_NAME) : '',
    banner: typeof o.banner === 'string' ? o.banner : null,
    featured: strs(o.featured, MAX_FEATURED),
    insignia: typeof o.insignia === 'number' && Number.isInteger(o.insignia) ? o.insignia : null,
    accent: ACCENTS.some(a => a.id === o.accent) ? (o.accent as AccentId) : d.accent,
    showcase: strs(o.showcase, MAX_SHOWCASE),
    honour: typeof o.honour === 'string' ? o.honour : null,
  };
}

/** What is actually shown: stored choices filtered to earned items. */
export function effective(p: LegacyPrefs, e: Earned): LegacyPrefs {
  const tk = new Set(e.trophies.map(t => t.key));
  const vk = new Set(e.vault.map(v => v.id));
  return {
    ...p,
    banner: p.banner && e.banners.some(b => b.id === p.banner) ? p.banner : null,
    featured: p.featured.filter(k => tk.has(k)),
    insignia: p.insignia !== null && e.insignias.includes(p.insignia) ? p.insignia : null,
    accent: earnedAccents(e.trophies).includes(p.accent) ? p.accent : 'crimson',
    showcase: p.showcase.filter(id => vk.has(id)),
    honour: p.honour && e.exchangeTitles.some(x => x.id === p.honour) ? p.honour : null,
  };
}

export type Change =
  | { field: 'name'; value: string }
  | { field: 'banner'; value: string | null }
  | { field: 'featured'; value: string[] }
  | { field: 'insignia'; value: number | null }
  | { field: 'accent'; value: AccentId }
  | { field: 'showcase'; value: string[] }
  | { field: 'honour'; value: string | null };

/** Apply one change, refusing anything not earned. Pure; returns the new prefs. */
export function equip(p: LegacyPrefs, c: Change, e: Earned): LegacyPrefs {
  switch (c.field) {
    case 'name': return { ...p, name: c.value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) };
    case 'banner':
      if (c.value !== null && !e.banners.some(b => b.id === c.value)) throw new LegacyError('You have not earned that banner.');
      return { ...p, banner: c.value };
    case 'featured': {
      const v = [...new Set(c.value)];
      if (v.length > MAX_FEATURED) throw new LegacyError(`Feature at most ${MAX_FEATURED} trophies.`);
      if (v.some(k => !e.trophies.some(t => t.key === k))) throw new LegacyError('You can only feature trophies you hold.');
      return { ...p, featured: v };
    }
    case 'insignia':
      if (c.value !== null && !e.insignias.includes(c.value)) throw new LegacyError('You have not collected that insignia.');
      return { ...p, insignia: c.value };
    case 'accent':
      if (!earnedAccents(e.trophies).includes(c.value)) throw new LegacyError('That accent is not unlocked yet.');
      return { ...p, accent: c.value };
    case 'showcase': {
      const v = [...new Set(c.value)];
      if (v.length > MAX_SHOWCASE) throw new LegacyError(`Showcase at most ${MAX_SHOWCASE} achievements.`);
      if (v.some(id => !e.vault.some(x => x.id === id))) throw new LegacyError('You can only showcase achievements you have unlocked.');
      return { ...p, showcase: v };
    }
    case 'honour':
      if (c.value !== null && !e.exchangeTitles.some(x => x.id === c.value)) throw new LegacyError('You do not hold that Exchange title.');
      return { ...p, honour: c.value };
  }
}
