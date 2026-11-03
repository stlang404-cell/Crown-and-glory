/**
 * Double-entry ledger in integer microcrowns (1 crown = 1,000,000 µ). Every journal entry balances to zero,
 * carries a unique idempotency id, and may not drive a non-negative account below zero. The only accounts
 * allowed to go negative are the issuance accounts (`mint`, `sandbox:mint`), whose negative balance equals
 * the total currency ever created. All money is fictional and non-redeemable.
 */
export const LEDGER_ID = 'crown-ledger-1';
export const MICRO = 1_000_000;

export interface JournalLine { account: string; amount: number }
export interface Journal { id: string; at: string; kind: string; memo: string; lines: JournalLine[]; season?: number; round?: number }

export class LedgerError extends Error {}

export const isIssuance = (account: string) => account === 'mint' || account === 'sandbox:mint';
export const crowns = (micro: number) => micro / MICRO;
export const toMicro = (c: number) => Math.round(c * MICRO);
export const fmtCrowns = (micro: number, digits = 2) => `${(micro / MICRO).toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ₵`;

/** Validate an entry against current balances (pure). */
export function validateJournal(j: Journal, balance: (account: string) => number): void {
  if (!j.id) throw new LedgerError('Journal entry needs an id');
  if (!j.lines.length) throw new LedgerError('Empty journal entry');
  let sum = 0;
  const delta = new Map<string, number>();
  for (const l of j.lines) {
    if (!Number.isSafeInteger(l.amount)) throw new LedgerError(`Non-integer amount on ${l.account}`);
    sum += l.amount;
    delta.set(l.account, (delta.get(l.account) ?? 0) + l.amount);
  }
  if (sum !== 0) throw new LedgerError(`Unbalanced journal ${j.id}: ${sum}`);
  // official and sandbox money never mix in one entry
  const sb = j.lines.map(l => l.account.startsWith('sandbox:'));
  if (sb.some(x => x) && sb.some(x => !x)) throw new LedgerError('Sandbox and official accounts cannot appear in one entry');
  for (const [acc, d] of delta) {
    if (isIssuance(acc)) continue;
    if (balance(acc) + d < 0) throw new LedgerError(`Insufficient funds in ${acc}`);
  }
}

/** In-memory books (tests, simulations); the app persists the same entries in IndexedDB. */
export class Books {
  balances = new Map<string, number>();
  journals = new Map<string, Journal>();
  balance(a: string): number { return this.balances.get(a) ?? 0; }
  /** Idempotent: re-posting an existing id is a no-op that returns false. */
  post(j: Journal): boolean {
    if (this.journals.has(j.id)) return false;
    validateJournal(j, a => this.balance(a));
    for (const l of j.lines) this.balances.set(l.account, this.balance(l.account) + l.amount);
    this.journals.set(j.id, j);
    return true;
  }
  /** Sum of all balances is always zero (conservation). */
  total(): number { let t = 0; for (const v of this.balances.values()) t += v; return t; }
}
