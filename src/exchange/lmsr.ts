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

/** Exact (float) crown cost of changing outcome i by `shares` (negative = sell). */
export function tradeCost(q: number[], b: number, i: number, shares: number): number {
  const q2 = [...q]; q2[i] += shares;
  return cost(q2, b) - cost(q, b);
}
/** Integer microcrown cost to buy (rounded up, with a 1µ guard against float error). */
export function buyCostMicro(q: number[], b: number, i: number, shares: number): number {
  return Math.ceil(tradeCost(q, b, i, shares) * MICRO + 1e-6) ;
}
/** Integer microcrown proceeds of selling (rounded down, with a 1µ guard). */
export function sellProceedsMicro(q: number[], b: number, i: number, shares: number): number {
  return Math.max(0, Math.floor(-tradeCost(q, b, i, -shares) * MICRO - 1e-6));
}
/** Fee: 1% of executed cash amount, rounded up. */
export const FEE_BPS = 100;
export const feeMicro = (amount: number) => Math.ceil((amount * FEE_BPS) / 10_000);

/** Inventory needed on outcome i so that its price equals target (other inventories fixed). */
export function sharesToTarget(q: number[], b: number, i: number, target: number): number {
  const others = q.reduce((s, x, j) => (j === i ? s : s + Math.exp(x / b)), 0);
  const qi = b * Math.log((target * others) / (1 - target));
  return qi - q[i];
}
