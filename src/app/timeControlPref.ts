/**
 * The player's last selected time control (v1.1, crown-tc-pref-1). Stored in the IndexedDB meta store under the
 * additive key `pref:timeControl` (no schema change; not part of backups, like other display preferences). New
 * profiles and unreadable values get the default, Classical 60+60. Play and Quick Match share it: a change in one is
 * published to the other (same tab).
 */
import { CUSTOM_LIMITS, DEFAULT_RATED_CONTROL, TIME_CONTROLS, customTimeControl, type PresetId, type TimeControl } from '../games/types';

export const TC_PREF_KEY = 'pref:timeControl';
export interface TimeControlPref { v: 1; id: PresetId | 'custom'; baseMin?: number; incS?: number }

/** A stored preference → a time control (sanitised; anything unknown → the default). */
export function controlFromPref(raw: unknown): TimeControl {
  if (!raw || typeof raw !== 'object') return DEFAULT_RATED_CONTROL;
  const p = raw as Partial<TimeControlPref>;
  if (p.id === 'custom') {
    const b = Number(p.baseMin), i = Number(p.incS);
    if (!Number.isFinite(b) || !Number.isFinite(i) || b < CUSTOM_LIMITS.minBaseMin || b > CUSTOM_LIMITS.maxBaseMin || i < CUSTOM_LIMITS.minIncS || i > CUSTOM_LIMITS.maxIncS) return DEFAULT_RATED_CONTROL;
    return customTimeControl(b, i);
  }
  if (typeof p.id === 'string' && Object.prototype.hasOwnProperty.call(TIME_CONTROLS, p.id)) return TIME_CONTROLS[p.id as PresetId];
  return DEFAULT_RATED_CONTROL;
}

export function prefFromControl(tc: TimeControl): TimeControlPref {
  return tc.id === 'custom' ? { v: 1, id: 'custom', baseMin: tc.initialMs / 60_000, incS: tc.incrementMs / 1000 } : { v: 1, id: tc.id };
}

interface MetaStore { getMeta<T = unknown>(key: string): Promise<T | undefined>; setMeta(key: string, value: unknown): Promise<void> }
const listeners = new Set<(tc: TimeControl) => void>();
let current: TimeControl | null = null;

export async function loadTimeControl(db: MetaStore): Promise<TimeControl> {
  if (current) return current;
  try { current = controlFromPref(await db.getMeta(TC_PREF_KEY)); } catch { current = DEFAULT_RATED_CONTROL; }
  return current;
}

/** Remember a selection (persisted; published to every open selector). Read-only tabs keep it in memory only. */
export async function saveTimeControl(db: MetaStore, tc: TimeControl, persist = true): Promise<void> {
  current = tc;
  for (const l of listeners) l(tc);
  if (persist) await db.setMeta(TC_PREF_KEY, prefFromControl(tc)).catch(() => { /* quota / read-only: kept in memory */ });
}

export function onTimeControl(l: (tc: TimeControl) => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
/** Tests only. */
export function resetTimeControlCache(): void { current = null; listeners.clear(); }
