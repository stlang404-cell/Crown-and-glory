/**
 * Compact persistence for a large federation (crown-persist-1, docs/FEDERATION_SCALE.md §1.6, docs/SAVE_FORMAT.md).
 * The in-memory records are unchanged; only what is written to IndexedDB is packed. Every codec is lossless and reads
 * the records of older saves as they are, so a save written before v0.10 loads without a schema migration.
 *
 * Why: in a real browser the cost of an IndexedDB write is dominated by the number of records, not their size.
 * Measured in Chromium (4-core VM): 10,240 competitor records put one by one took 600–840 ms; the same records in
 * 20 chunk records of 512 took about 55 ms. A round advance used to write every competitor (and, at season end,
 * every competitor's ledger account) as its own record.
 *
 * 1. Competitors are stored in chunk records `~c:<n>` of up to 512 full records (by competitor index). Only chunks
 *    with a changed record are rewritten. Individual records of an older save are read as they are and deleted when
 *    their chunk is first written (in the same transaction).
 * 2. Competitor ledger accounts (`comp:<id>`) are stored the same way in the accounts store (`~a:<n>`); every other
 *    account stays an individual record.
 * 3. Round records keep their fixtures; the tier-3 results (`abstract`, one 4-tuple per background game: about
 *    5,000 per round at 10,240 competitors) are stored as a few strings: `packed = { v: 1, n, events, ev, w, b, r }`
 *    with `abstract: []`.
 */
import type { Competitor } from './model';
import type { RoundRecord } from './world';

export const CHUNK = 512;
export const COMP_CHUNK_PREFIX = '~c:';
export const ACCT_CHUNK_PREFIX = '~a:';

/** Chunk of a competitor id (`c<index>`: index / 512; anything else hashes into one of 16 extra chunks). */
export function chunkOf(id: string): string {
  const m = /^c(\d+)$/.exec(id);
  if (m) return String(Math.floor(+m[1] / CHUNK)).padStart(4, '0');
  let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `x${((h >>> 0) % 16).toString(16)}`;
}
const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------- competitors
export interface CompetitorChunk { id: string; kind: 'competitors'; v: 1; records: Competitor[] }
export const isCompetitorChunk = (r: unknown): r is CompetitorChunk => typeof (r as { id?: unknown })?.id === 'string' && (r as { id: string }).id.startsWith(COMP_CHUNK_PREFIX);

/** Competitor records from the competitors store (chunks and older individual records), in id order. A record in a
 *  chunk takes precedence over an individual record with the same id (never both: the individual one is deleted). */
export function decodeCompetitors(stored: unknown[]): { competitors: Competitor[]; legacyIds: string[] } {
  const out = new Map<string, Competitor>();
  const legacyIds: string[] = [];
  for (const r of stored) {
    if (!isCompetitorChunk(r)) { const c = r as Competitor; legacyIds.push(c.id); if (!out.has(c.id)) out.set(c.id, c); continue; }
    if (r.v !== 1) throw new Error(`Unknown competitor chunk format ${String(r.v)} (${r.id})`);
    for (const c of r.records) out.set(c.id, c);
  }
  return { competitors: [...out.values()].sort((a, b) => byKey(a.id, b.id)), legacyIds };
}

/**
 * The chunk records to write for `next`: every chunk with a record that is new or differs from `prev` (all chunks
 * when `prev` is null or `all` is set). `legacy`: ids still stored as individual records, deleted once their chunk is
 * written (returned in `del`).
 */
export function competitorWrites(next: Map<string, Competitor>, prev: Map<string, Competitor> | null, legacy: Set<string>, all = false): { put: CompetitorChunk[]; del: string[] } {
  const chunks = new Map<string, Competitor[]>();
  const dirty = new Set<string>();
  for (const c of next.values()) {
    const k = chunkOf(c.id);
    const l = chunks.get(k); if (l) l.push(c); else chunks.set(k, [c]);
    if (all || !prev || legacy.has(c.id)) { dirty.add(k); continue; }
    if (dirty.has(k)) continue;
    const p = prev.get(c.id);
    if (!p || (p !== c && !same(p, c))) dirty.add(k);
  }
  if (prev) for (const id of prev.keys()) if (!next.has(id)) dirty.add(chunkOf(id)); // (records are never removed today)
  const put: CompetitorChunk[] = [];
  for (const k of [...dirty].sort(byKey)) put.push({ id: `${COMP_CHUNK_PREFIX}${k}`, kind: 'competitors', v: 1, records: (chunks.get(k) ?? []).sort((a, b) => byKey(a.id, b.id)) });
  const del = [...legacy].filter(id => dirty.has(chunkOf(id)));
  return { put, del };
}

// ---------------------------------------------------------------- accounts
export interface AccountChunk { account: string; kind: 'accounts'; v: 1; accounts: string[]; balances: number[] }
const isAccountChunk = (r: unknown): r is AccountChunk => typeof (r as { account?: unknown })?.account === 'string' && (r as { account: string }).account.startsWith(ACCT_CHUNK_PREFIX);
/** Accounts held in chunks: competitors' ledger accounts. */
export const chunkedAccount = (account: string) => account.startsWith('comp:');

/** Account balances from the accounts store (chunks and individual records), in account order. */
export function decodeAccounts(stored: unknown[]): { accounts: { account: string; balance: number }[]; legacyIds: string[] } {
  const out = new Map<string, number>();
  const legacyIds: string[] = [];
  for (const r of stored) {
    if (!isAccountChunk(r)) { const a = r as { account: string; balance: number }; if (chunkedAccount(a.account)) legacyIds.push(a.account); if (!out.has(a.account)) out.set(a.account, a.balance); continue; }
    if (r.v !== 1 || r.accounts.length !== r.balances.length) throw new Error(`Account chunk ${r.account} is damaged`);
    r.accounts.forEach((a, i) => out.set(a, r.balances[i]));
  }
  return { accounts: [...out].map(([account, balance]) => ({ account, balance })).sort((a, b) => byKey(a.account, b.account)), legacyIds };
}

/** Records to write for the accounts a command changed: individual records for ordinary accounts, and every chunk
 *  that holds a changed competitor account (rebuilt from all balances). Legacy individual competitor accounts in a
 *  rewritten chunk are deleted. */
export function accountWrites(changed: Iterable<string>, balances: Map<string, number>, legacy: Set<string>): { put: unknown[]; del: string[] } {
  const put: unknown[] = [];
  const dirty = new Set<string>();
  for (const a of changed) {
    if (chunkedAccount(a)) dirty.add(chunkOf(a.slice(5)));
    else put.push({ account: a, balance: balances.get(a) ?? 0 });
  }
  if (dirty.size) {
    const chunks = new Map<string, [string, number][]>();
    for (const [a, b] of balances) {
      if (!chunkedAccount(a)) continue;
      const k = chunkOf(a.slice(5));
      if (!dirty.has(k)) continue;
      const l = chunks.get(k); if (l) l.push([a, b]); else chunks.set(k, [[a, b]]);
    }
    for (const k of [...dirty].sort(byKey)) {
      const e = (chunks.get(k) ?? []).sort((x, y) => byKey(x[0], y[0]));
      put.push({ account: `${ACCT_CHUNK_PREFIX}${k}`, kind: 'accounts', v: 1, accounts: e.map(x => x[0]), balances: e.map(x => x[1]) } satisfies AccountChunk);
    }
  }
  const del = [...legacy].filter(a => dirty.has(chunkOf(a.slice(5))));
  return { put, del };
}

// ---------------------------------------------------------------- round records
export interface PackedAbstract { v: 1; n: number; events: string; ev: string; w: string; b: string; r: string }
export type StoredRound = RoundRecord & { packed?: PackedAbstract };

const R_ENC = (x: number | null) => (x === null ? '.' : x === 1 ? '1' : x === 0 ? '0' : x === 0.5 ? '=' : null);
const R_DEC: Record<string, number | null> = { '.': null, '1': 1, '0': 0, '=': 0.5 };

/** The stored form of a round record (lossless; a record whose results cannot be packed is stored as it is). */
export function encodeRound(rec: RoundRecord): StoredRound {
  const a = rec.abstract;
  if (!a.length) return rec;
  const events: string[] = [], evIx = new Map<string, number>();
  const ev: number[] = [], w: string[] = [], b: string[] = [];
  let r = '';
  for (const [e, x, y, res] of a) {
    const code = R_ENC(res);
    // ids and events never contain the separators; anything unexpected is stored unpacked rather than guessed
    if (code === null || x.includes(',') || y.includes(',') || e.includes('\n')) return rec;
    let i = evIx.get(e);
    if (i === undefined) { i = events.length; evIx.set(e, i); events.push(e); }
    ev.push(i); w.push(x); b.push(y); r += code;
  }
  return { ...rec, abstract: [], packed: { v: 1, n: a.length, events: events.join('\n'), ev: ev.join(','), w: w.join(','), b: b.join(','), r } };
}

/** The in-memory round record from its stored form (records without `packed` are returned unchanged). */
export function decodeRound(stored: StoredRound): RoundRecord {
  const p = stored.packed;
  if (!p) return stored;
  if (p.v !== 1) throw new Error(`Unknown packed round format ${String(p.v)} in round ${stored.id}`);
  const events = p.events.split('\n'), ev = p.ev.split(','), w = p.w.split(','), b = p.b.split(',');
  if (ev.length !== p.n || w.length !== p.n || b.length !== p.n || p.r.length !== p.n) throw new Error(`Round ${stored.id}: packed results are damaged`);
  const abstract: RoundRecord['abstract'] = new Array(p.n);
  for (let i = 0; i < p.n; i++) {
    const res = R_DEC[p.r[i]];
    if (res === undefined || events[+ev[i]] === undefined) throw new Error(`Round ${stored.id}: packed results are damaged`);
    abstract[i] = [events[+ev[i]], w[i], b[i], res];
  }
  const { packed, ...rest } = stored;
  void packed;
  return { ...rest, abstract };
}

// ---------------------------------------------------------------- helpers
/** Deep equality of plain data. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

/** The federation stores as the app reads them (chunks expanded, rounds unpacked): for checks, tools and backups. */
export function decodeFederationStores(fed: Record<string, unknown[]>): Record<string, unknown[]> {
  const out = { ...fed };
  if (fed.competitors) out.competitors = decodeCompetitors(fed.competitors).competitors;
  if (fed.accounts) out.accounts = decodeAccounts(fed.accounts).accounts;
  if (fed.rounds) out.rounds = fed.rounds.map(r => decodeRound(r as StoredRound));
  return out;
}
