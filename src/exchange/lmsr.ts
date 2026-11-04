/**
 * Logarithmic market scoring rule (Hanson), categorical, fixed liquidity b (crowns), uniform q0 = 0.
 *   C(q) = b · ln Σ exp(q_i / b),  p_i = exp(q_i / b) / Σ exp(q_j / b)
 * computed with log-sum-exp for stability. Shares pay 1 crown each if their outcome wins.
 * Money conversion (directed rounding, research doc 09): buy cost rounds UP to the next microcrown,
 * sell proceeds round DOWN, so rounding residue always favours the market's collateral.
 * Worst-case maker loss with uniform q0 is b·ln n; that amount is funded before the market opens.
 */
import { MICRO } from './ledger';

export function logSumExp(xs: number[]): number {
  const m = Math.max(...xs);
  return m + Math.log(xs.reduce((s, x) => s + Math.exp(x - m), 0));
}
export function cost(q: number[], b: number): number { return b * logSumExp(q.map(x => x / b)); }
export function prices(q: number[], b: number): number[] {
  const m = Math.max(...q.map(x => x / b));
  const e = q.map(x => Math.exp(x / b - m));
  const s = e.reduce((a, x) => a + x, 0);
  return e.map(x => x / s);
}
/** Funded worst-case subsidy b·ln n in microcrowns (rounded up). */
export const subsidyMicro = (b: number, n: number) => Math.ceil(b * Math.log(n) * MICRO);

/**
 * Exact (float) crown cost of adding `shares` to every state in S (negative = sell). A categorical outcome is S = [i].
 * v0.10 (bug #26): computed in the cancellation-free closed form
 *   C(q + k·1_S) − C(q) = b · ln(1 + P_S · (e^{k/b} − 1)) = b · log1p(P_S · expm1(k/b)),   P_S = Σ_{s∈S} p_s(q)
 * instead of the difference of two large costs. The old difference lost ~1e-5 µ at inventories of 10^4 shares, more
 * than the 1e-6 µ rounding guard, so a buy could round DOWN by 1 µ (and a sale up) — against the published direction.
 */
export function claimCost(q: number[], b: number, S: readonly number[], shares: number): number {
  if (!S.length || shares === 0) return 0;
  const p = prices(q, b);
  let P = 0;
  for (const s of S) P += p[s];
  if (P >= 1 - 1e-15 && S.length === q.length) return shares; // complete set: exactly its payout
  return b * Math.log1p(Math.min(1, P) * Math.expm1(shares / b));
}
export const tradeCost = (q: number[], b: number, i: number, shares: number): number => claimCost(q, b, [i], shares);
/** Integer microcrown cost to buy claim S (rounded up, with a guard against float error). */
export function buyClaimMicro(q: number[], b: number, S: readonly number[], shares: number): number {
  return Math.ceil(claimCost(q, b, S, shares) * MICRO + 1e-6);
}
/** Integer microcrown proceeds of selling claim S (rounded down, with a guard). */
export function sellClaimMicro(q: number[], b: number, S: readonly number[], shares: number): number {
  return Math.max(0, Math.floor(-claimCost(q, b, S, -shares) * MICRO - 1e-6));
}
export const buyCostMicro = (q: number[], b: number, i: number, shares: number) => buyClaimMicro(q, b, [i], shares);
export const sellProceedsMicro = (q: number[], b: number, i: number, shares: number) => sellClaimMicro(q, b, [i], shares);
/** Fee: 1% of executed cash amount, rounded up. */
export const FEE_BPS = 100;
export const feeMicro = (amount: number) => Math.ceil((amount * FEE_BPS) / 10_000);

/** Inventory needed on outcome i so that its price equals target (other inventories fixed). */
export function sharesToTarget(q: number[], b: number, i: number, target: number): number {
  const others = q.reduce((s, x, j) => (j === i ? s : s + Math.exp(x / b)), 0);
  const qi = b * Math.log((target * others) / (1 - target));
  return qi - q[i];
}
