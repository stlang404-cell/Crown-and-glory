/**
 * Position analytics (crown-portfolio-1). Pure functions over a market and a holder's position; every amount is integer
 * µ (1,000,000 = $1, fictional money).
 *
 * Definitions (all exact, no estimates):
 *   cost basis      per claim, average-cost method incl. buy fees (Position.basis; recorded from v0.10)
 *   exit value      what selling every held share now would return after fees (open markets: executable, sequential
 *                   sales through the same LMSR; other states: 0 — nothing can be sold)
 *   realised P&L    net sale proceeds and payouts minus the basis of the shares they closed (Position.realised)
 *   unrealised P&L  open markets: exit value − basis of the shares still held; closed (awaiting settlement): 0, the
 *                   basis is reported as `pending` until the result is known; resolved: 0
 *   realised + unrealised = exit value + received − spent      (open markets; tested identity)
 *   scenario P&L    for every state s: payout if s happens (Σ_c shares_c · payout_c(s), floored as at settlement) +
 *                   received − spent; plus the VOID scenario on the published cancellation vector
 *   at risk         max(0, −worst scenario): the most the holding can still lose from here (long-only: never more
 *                   than what was paid)
 */
import { MICRO } from './ledger';
import { Market, Position, basisOf, claimsOf, claimPrices, liquidationValue, statesOf, uniformPayout } from './market';
import { feeMicro, sellClaimMicro } from './lmsr';

export const PORTFOLIO_ID = 'crown-portfolio-1';

export interface ClaimHolding {
  claim: number; label: string; shares: number;
  /** µ basis of these shares (null: not recorded, legacy holding). */
  basis: number | null;
  /** µ per share (null: not recorded). */
  avgCost: number | null;
  price: number;
  /** Net µ from selling just this claim now (0 when the market is not open). */
  exitValue: number;
  unrealised: number | null;
}
export interface Scenario { label: string; payout: number; pnl: number; void?: boolean }
export interface PositionView {
  marketId: string; status: Market['status']; tradable: boolean;
  holdings: ClaimHolding[];
  spent: number; received: number; fees: number;
  basisKnown: boolean; openBasis: number | null; realised: number | null;
  exitValue: number; unrealised: number | null;
  /** Basis of shares in a closed market awaiting settlement (no exit possible), µ. */
  pending: number;
  /** exit value + received − spent: the result if everything were sold now (open markets). */
  netIfClosedNow: number;
  scenarios: Scenario[]; worst: number; best: number; atRisk: number;
}

/** µ payout of a position under a payout vector over states (floored per holding, as resolveMarket does). */
export function payoutUnder(m: Market, p: Position, v: number[]): number {
  const claims = claimsOf(m);
  return Math.floor(p.shares.reduce((a, x, c) => a + x * (claims[c]?.states.reduce((s, st) => s + (v[st] ?? 0), 0) ?? 0), 0) * MICRO + 1e-6);
}

export function positionView(m: Market, p: Position): PositionView {
  const claims = claimsOf(m);
  const open = m.status === 'open';
  const resolved = m.status === 'settled' || m.status === 'cancelled';
  const pr = claimPrices(m);
  const rec = basisOf(p, claims.length);
  const holdings: ClaimHolding[] = [];
  claims.forEach((c, i) => {
    const k = p.shares[i] ?? 0;
    if (!k || resolved) return;
    const proceeds = open ? sellClaimMicro(m.q, m.b, c.states, k) : 0;
    const exit = open ? proceeds - feeMicro(proceeds) : 0;
    const basis = rec ? rec.basis[i] : null;
    holdings.push({ claim: i, label: c.label, shares: k, basis, avgCost: basis === null ? null : basis / k, price: pr[i], exitValue: exit, unrealised: basis === null ? null : exit - basis });
  });
  const exitValue = open ? liquidationValue(m, p) : 0;
  const openBasis = rec ? (resolved ? 0 : rec.basis.reduce((a, x) => a + x, 0)) : null;
  const n = statesOf(m).length;
  const scenarios: Scenario[] = resolved
    ? [{ label: m.status === 'settled' ? 'Settled' : 'VOID (cancelled)', payout: 0, pnl: p.received - p.spent, void: m.status === 'cancelled' }]
    : [
      ...statesOf(m).map((label, s) => { const pay = payoutUnder(m, p, statesOf(m).map((_, j) => (j === s ? 1 : 0))); return { label, payout: pay, pnl: pay + p.received - p.spent }; }),
      (() => { const pay = payoutUnder(m, p, m.cancelVector ?? uniformPayout(n)); return { label: 'VOID (cancelled)', payout: pay, pnl: pay + p.received - p.spent, void: true }; })(),
    ];
  // worst/best over the real outcomes (VOID is shown, not counted: it pays inside the outcomes' range)
  const real = scenarios.filter(x => !x.void || resolved);
  const worst = Math.min(...real.map(x => x.pnl)), best = Math.max(...real.map(x => x.pnl));
  return {
    marketId: m.id, status: m.status, tradable: open, holdings, spent: p.spent, received: p.received, fees: p.fees,
    basisKnown: !!rec, openBasis, realised: rec ? rec.realised : null,
    exitValue, unrealised: rec ? (open ? exitValue - (openBasis ?? 0) : 0) : null, pending: rec && m.status === 'closed' ? openBasis ?? 0 : 0,
    netIfClosedNow: exitValue + p.received - p.spent,
    scenarios, worst, best, atRisk: Math.max(0, -worst),
  };
}

export interface PortfolioSummary {
  markets: number; openMarkets: number;
  exitValue: number; realised: number; unrealised: number; pending: number; atRisk: number; fees: number;
  /** Positions whose per-claim basis was not recorded (pre-v0.10 holdings still open): their P&L is in `legacyNet`. */
  legacy: number; legacyNet: number;
}
/** Summary over a holder's positions (markets not found are skipped). */
export function portfolioSummary(markets: Map<string, Market>, positions: Position[]): PortfolioSummary {
  const out: PortfolioSummary = { markets: 0, openMarkets: 0, exitValue: 0, realised: 0, unrealised: 0, pending: 0, atRisk: 0, fees: 0, legacy: 0, legacyNet: 0 };
  for (const p of positions) {
    const m = markets.get(p.marketId);
    if (!m) continue;
    const v = positionView(m, p);
    out.markets++; out.fees += p.fees;
    if (m.status === 'open' || m.status === 'closed') { out.openMarkets++; out.atRisk += v.atRisk; out.exitValue += v.exitValue; }
    if (v.realised === null) { out.legacy++; out.legacyNet += v.netIfClosedNow; continue; }
    out.realised += v.realised;
    out.unrealised += v.unrealised ?? 0;
    out.pending += v.pending;
  }
  return out;
}
