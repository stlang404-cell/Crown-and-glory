/**
 * Feudal rank adapter (package I ↔ package P). Package P implements the 16-rank × 3-sublevel feudal system in
 * `src/federation/ranks*.ts`; the header and profile only need this small interface:
 *
 *   currentRank(state) → { gradeId, rankName, sublevel: 'III' | 'II' | 'I', label, insignia }
 *   highestRank(state) → the same, plus when it was first achieved (season and/or date)
 *
 * The module is discovered at build time (`import.meta.glob`, eager): when no ranks module exists — or it does not
 * export these functions — every call returns null and the UI falls back to the existing rating title, labelled as
 * such. No rank is ever invented here.
 */
import type { EmblemSpec } from '../heraldry/spec';

export type Sublevel = 'III' | 'II' | 'I';
export interface RankView { gradeId: string; rankName: string; sublevel: Sublevel; label: string; insignia: EmblemSpec | null }
export interface HighestRankView extends RankView { season?: number | null; at?: string | null }
export interface RankModule { currentRank(state: unknown): RankView | null | undefined; highestRank(state: unknown): HighestRankView | null | undefined }

const found = import.meta.glob('../federation/ranks*.ts', { eager: true }) as Record<string, Partial<RankModule>>;
let mod: RankModule | null = (() => {
  for (const m of Object.values(found)) if (typeof m.currentRank === 'function' && typeof m.highestRank === 'function') return m as RankModule;
  return null;
})();

/** Explicit wiring (the integrator, or tests); overrides discovery. */
export function registerRankModule(m: RankModule | null): void { mod = m; }
export const rankModuleAvailable = (): boolean => mod !== null;

const valid = (r: RankView | null | undefined): r is RankView => !!r && typeof r.rankName === 'string' && ['III', 'II', 'I'].includes(r.sublevel);
export function currentRankOf(state: unknown): RankView | null {
  if (!mod || !state) return null;
  try { const r = mod.currentRank(state); return valid(r) ? { ...r, label: r.label || `${r.rankName} ${r.sublevel}` } : null; } catch { return null; }
}
export function highestRankOf(state: unknown): HighestRankView | null {
  if (!mod || !state) return null;
  try { const r = mod.highestRank(state); return valid(r) ? { ...r, label: r.label || `${r.rankName} ${r.sublevel}` } : null; } catch { return null; }
}
