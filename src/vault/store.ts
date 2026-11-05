/**
 * The Sovereign Vault — permanent ownership (crown-vault-1). One unlock record per collectible, stored in the existing
 * IndexedDB `meta` store under the deterministic key `ach:<id>` and written put-if-absent: reloads, re-analysis and
 * re-evaluation can never duplicate, rewrite or remove an unlock, and ownership is never revoked when a rating or net
 * worth later falls. Unlock notices are remembered under `achtoast:<id>` so each is shown once, ever.
 * (Additive use of an existing store: no schema version change is needed.)
 */
import { VAULT_ID, evaluateDef, type EvalResult, type VaultDef } from './catalog';
import type { Facts } from './facts';

export interface UnlockRecord {
  id: string;
  /** When this device recorded the unlock. */
  at: string;
  /** When the evidence happened, if known (e.g. the game's end); otherwise equal to `at`. */
  earnedAt: string;
  evidence: string;
  ref?: string;
  /** Recorded by the first-run backfill from history (no notice is shown for these). */
  backfill: boolean;
  catalog: string;
}
export interface MetaDB {
  metaWithPrefix<T = unknown>(prefix: string): Promise<{ key: string; value: T }[]>;
  putMetaIfAbsent(entries: { key: string; value: unknown }[]): Promise<string[]>;
  getMeta<T = unknown>(key: string): Promise<T | undefined>;
}
export const UNLOCK_PREFIX = 'ach:';
export const TOAST_PREFIX = 'achtoast:';
export const BACKFILL_KEY = 'vault:backfilled';
/** crown-vault-2 (v0.11): the expansion's own one-time back-fill on saves that already ran the crown-vault-1 back-fill. */
export const BACKFILL_V2_KEY = 'vault:backfilled:crown-vault-2';

/** Evaluate every definition (and meta entries a second time with the newly earned ids) — pure. */
export function evaluateAll(defs: VaultDef[], facts: Facts): Map<string, EvalResult> {
  const out = new Map<string, EvalResult>();
  for (const d of defs) out.set(d.id, evaluateDef(d, facts));
  const owned = new Set([...facts.owned, ...[...out].filter(([, r]) => r.earned).map(([id]) => id)]);
  const again = { ...facts, owned };
  for (const d of defs) if (d.id === 'all-collections') out.set(d.id, evaluateDef(d, again));
  return out;
}

/** Unlock records for collectibles earned now and not yet owned — pure. */
export function newUnlocks(results: Map<string, EvalResult>, owned: ReadonlyMap<string, UnlockRecord>, nowIso: string, backfill: boolean | ((id: string) => boolean)): UnlockRecord[] {
  const out: UnlockRecord[] = [];
  for (const [id, r] of results) {
    if (!r.earned || owned.has(id)) continue;
    out.push({ id, at: nowIso, earnedAt: r.when ?? nowIso, evidence: r.evidence ?? '', ...(r.ref ? { ref: r.ref } : {}), backfill: typeof backfill === 'function' ? backfill(id) : backfill, catalog: VAULT_ID });
  }
  return out;
}

export async function loadUnlocks(db: MetaDB): Promise<Map<string, UnlockRecord>> {
  const rows = await db.metaWithPrefix<UnlockRecord>(UNLOCK_PREFIX);
  return new Map(rows.map(r => [r.value.id, r.value]));
}
/** Put-if-absent; returns the records that were actually written (never overwrites an existing unlock). */
export async function saveUnlocks(db: MetaDB, recs: UnlockRecord[]): Promise<UnlockRecord[]> {
  const written = new Set(await db.putMetaIfAbsent(recs.map(r => ({ key: UNLOCK_PREFIX + r.id, value: r }))));
  return recs.filter(r => written.has(UNLOCK_PREFIX + r.id));
}
export async function loadToasted(db: MetaDB): Promise<Set<string>> {
  return new Set((await db.metaWithPrefix<string>(TOAST_PREFIX)).map(r => r.key.slice(TOAST_PREFIX.length)));
}
export async function markToasted(db: MetaDB, ids: string[], nowIso: string): Promise<void> {
  await db.putMetaIfAbsent(ids.map(id => ({ key: TOAST_PREFIX + id, value: nowIso })));
}
