/**
 * Crown Exchange markets (crown-exchange-1). Pure functions: each returns the journal entry to post and
 * the updated market/position objects; the caller posts the journal and saves the objects in ONE
 * transaction. States: open → closed → settled | cancelled (terminal; never reopened).
 *
 * Contract: categorical match market over {White wins, Draw, Black wins}; exactly one outcome pays
 * 1 crown per share. Inventory q changes only through paid trades (no external re-centring). Retail
 * holdings are long-only (no naked shorts). Cancellation pays 1/n per share (fixed, published vector).
 */
import { Journal, MICRO } from './ledger';
import { buyCostMicro, feeMicro, prices, sellProceedsMicro, subsidyMicro } from './lmsr';

export const EXCHANGE_ID = 'crown-exchange-1';
export const OUTCOMES = ['White wins', 'Draw', 'Black wins'] as const;

export interface Market {
  id: string;
  sandbox: boolean;
  fixtureId: string;
  title: string;
  white: string;
  black: string;
  season: number;
  round: number;
  b: number; // liquidity (crowns)
  q: number[]; // shares outstanding per outcome (q0 = 0)
  status: 'open' | 'closed' | 'settled' | 'cancelled';
  subsidy: number; // µ funded at open
  result: number | null; // outcome index
  forecast: { w: number; d: number; l: number; source: string };
  history: { at: string; seq: number; prices: number[]; by: string }[];
  openedAt: string;
  closedAt: string | null;
  settledAt: string | null;
  gameId: string | null;
}

export interface Position {
  id: string; // `${marketId}|${holder}`
  marketId: string;
  holder: string; // ledger account of the holder
  shares: number[];
  spent: number; // µ total paid incl. fees (cost basis)
  received: number; // µ total received from sales and settlement
  fees: number;
}

export const acct = (m: Market, part: 'collateral' | 'subsidy') => `${m.sandbox ? 'sandbox:' : ''}market:${m.id}:${part}`;
export const feeAccount = (m: Market) => (m.sandbox ? 'sandbox:fees' : 'fees');
export const treasuryAccount = (m: Market) => (m.sandbox ? 'sandbox:treasury' : 'treasury');

export class MarketError extends Error {}

export function openMarket(p: { id: string; sandbox: boolean; fixtureId: string; title: string; white: string; black: string; season: number; round: number; b: number; forecast: Market['forecast']; at: string }): { market: Market; journal: Journal } {
  const market: Market = {
    ...p, q: [0, 0, 0], status: 'open', subsidy: subsidyMicro(p.b, 3), result: null,
    history: [{ at: p.at, seq: 0, prices: [1 / 3, 1 / 3, 1 / 3], by: 'open' }], openedAt: p.at, closedAt: null, settledAt: null, gameId: null,
  };
  const journal: Journal = {
    id: `market-open:${p.id}`, at: p.at, kind: 'market-subsidy', memo: `Fund worst-case maker subsidy b·ln 3 for ${p.title}`,
    lines: [{ account: treasuryAccount(market), amount: -market.subsidy }, { account: acct(market, 'subsidy'), amount: market.subsidy }], season: p.season, round: p.round,
  };
  return { market, journal };
}

export interface Quote { outcome: number; shares: number; side: 'buy' | 'sell'; amount: number; fee: number; total: number; priceBefore: number; priceAfter: number; avgPrice: number; maxPayout: number; maxLoss: number }

export function quote(m: Market, outcome: number, shares: number, side: 'buy' | 'sell'): Quote {
  if (!Number.isInteger(shares) || shares <= 0) throw new MarketError('Shares must be a positive whole number');
  const amount = side === 'buy' ? buyCostMicro(m.q, m.b, outcome, shares) : sellProceedsMicro(m.q, m.b, outcome, shares);
  const fee = feeMicro(amount);
  const q2 = [...m.q]; q2[outcome] += side === 'buy' ? shares : -shares;
  const total = side === 'buy' ? amount + fee : amount - fee;
  return {
    outcome, shares, side, amount, fee, total,
    priceBefore: prices(m.q, m.b)[outcome], priceAfter: prices(q2, m.b)[outcome], avgPrice: amount / shares / MICRO,
    maxPayout: side === 'buy' ? shares * MICRO : 0, maxLoss: side === 'buy' ? total : 0,
  };
}

/** Execute a retail trade. `seq` must be unique per market (idempotency key). */
export function trade(m: Market, pos: Position | null, holder: string, outcome: number, shares: number, side: 'buy' | 'sell', at: string, seq: number):
  { market: Market; position: Position; journal: Journal; quote: Quote } {
  if (m.status !== 'open') throw new MarketError('Market is not open');
  if (outcome < 0 || outcome > 2) throw new MarketError('Unknown outcome');
  const position: Position = pos ? structuredClone(pos) : { id: `${m.id}|${holder}`, marketId: m.id, holder, shares: [0, 0, 0], spent: 0, received: 0, fees: 0 };
  if (side === 'sell' && position.shares[outcome] < shares) throw new MarketError('Cannot sell more shares than held (no short selling)');
  const qt = quote(m, outcome, shares, side);
  if (side === 'sell' && qt.total < 0) throw new MarketError('Sale proceeds do not cover the fee');
  const market = structuredClone(m);
  market.q[outcome] += side === 'buy' ? shares : -shares;
  market.history.push({ at, seq, prices: prices(market.q, market.b), by: holder });
  position.shares[outcome] += side === 'buy' ? shares : -shares;
  position.fees += qt.fee;
  if (side === 'buy') position.spent += qt.total; else position.received += qt.total;
  const journal: Journal = side === 'buy'
    ? { id: `trade:${m.id}:${seq}`, at, kind: 'trade-buy', memo: `Buy ${shares} × ${OUTCOMES[outcome]} — ${m.title}`, season: m.season, round: m.round,
      lines: [{ account: holder, amount: -qt.total }, { account: acct(m, 'collateral'), amount: qt.amount }, { account: feeAccount(m), amount: qt.fee }] }
    : { id: `trade:${m.id}:${seq}`, at, kind: 'trade-sell', memo: `Sell ${shares} × ${OUTCOMES[outcome]} — ${m.title}`, season: m.season, round: m.round,
      lines: [{ account: acct(m, 'collateral'), amount: -qt.amount }, { account: holder, amount: qt.total }, { account: feeAccount(m), amount: qt.fee }] };
  return { market, position, journal, quote: qt };
}

/** Close trading (before any result exists). Terminal for trading; idempotent. */
export function closeMarket(m: Market, at: string): Market {
  if (m.status !== 'open') return m;
  return { ...m, status: 'closed', closedAt: at };
}

/** Required collateral: the maximum possible payout. */
export const maxLiability = (m: Market) => Math.max(...m.q) * MICRO;

/**
 * Settle on the winning outcome: pay holders from collateral (then subsidy), return the rest to the
 * treasury. One balanced journal with a unique id (`settle:<market>`), so a retry is a no-op.
 */
export function settleMarket(m: Market, positions: Position[], result: number, at: string, collateral: number, gameId: string | null): { market: Market; positions: Position[]; journal: Journal } {
  if (m.status === 'settled' || m.status === 'cancelled') throw new MarketError('Market already resolved');
  if (m.status === 'open') throw new MarketError('Close the market before settling');
  const payouts = positions.map(p => ({ p, amount: p.shares[result] * MICRO }));
  const due = payouts.reduce((s, x) => s + x.amount, 0);
  const funds = collateral + m.subsidy;
  if (due > funds) throw new MarketError(`Insolvent market: due ${due} > funds ${funds}`);
  const lines = [{ account: acct(m, 'collateral'), amount: -collateral }, { account: acct(m, 'subsidy'), amount: -m.subsidy }];
  for (const x of payouts) if (x.amount) lines.push({ account: x.p.holder, amount: x.amount });
  lines.push({ account: treasuryAccount(m), amount: funds - due });
  const newPositions = payouts.map(x => ({ ...x.p, received: x.p.received + x.amount }));
  return {
    market: { ...m, status: 'settled', result, settledAt: at, gameId },
    positions: newPositions,
    journal: { id: `settle:${m.id}`, at, kind: 'market-settle', memo: `Settle ${m.title}: ${OUTCOMES[result]}`, lines: lines.filter(l => l.amount !== 0), season: m.season, round: m.round },
  };
}

/** Cancellation: every share pays 1/3 crown (rounded down per holding); residue to the treasury. */
export function cancelMarket(m: Market, positions: Position[], at: string, collateral: number): { market: Market; positions: Position[]; journal: Journal } {
  if (m.status === 'settled' || m.status === 'cancelled') throw new MarketError('Market already resolved');
  const funds = collateral + m.subsidy;
  const payouts = positions.map(p => ({ p, amount: Math.floor((p.shares.reduce((s, x) => s + x, 0) * MICRO) / 3) }));
  const due = payouts.reduce((s, x) => s + x.amount, 0);
  const lines = [{ account: acct(m, 'collateral'), amount: -collateral }, { account: acct(m, 'subsidy'), amount: -m.subsidy }];
  for (const x of payouts) if (x.amount) lines.push({ account: x.p.holder, amount: x.amount });
  lines.push({ account: treasuryAccount(m), amount: funds - due });
  return {
    market: { ...m, status: 'cancelled', settledAt: at, closedAt: m.closedAt ?? at },
    positions: payouts.map(x => ({ ...x.p, received: x.p.received + x.amount })),
    journal: { id: `settle:${m.id}`, at, kind: 'market-cancel', memo: `Cancel ${m.title}: 1/3 per share`, lines: lines.filter(l => l.amount !== 0), season: m.season, round: m.round },
  };
}

/** Executable liquidation value of a position (sell everything now, after fees), µ. */
export function liquidationValue(m: Market, p: Position): number {
  if (m.status === 'settled' || m.status === 'cancelled') return 0;
  if (m.status === 'closed') {
    // not tradeable: value at the 1/3 cancellation floor is the only executable guarantee
    return Math.floor((p.shares.reduce((s, x) => s + x, 0) * MICRO) / 3);
  }
  let q = [...m.q], total = 0;
  for (let i = 0; i < 3; i++) {
    if (!p.shares[i]) continue;
    const proceeds = sellProceedsMicro(q, m.b, i, p.shares[i]);
    total += proceeds - feeMicro(proceeds);
    q = [...q]; q[i] -= p.shares[i];
  }
  return Math.max(0, total);
}
/** Marginal-price mark (informational, not executable), µ. */
export function markValue(m: Market, p: Position): number {
  if (m.status !== 'open' && m.status !== 'closed') return 0;
  const pr = prices(m.q, m.b);
  return Math.round(p.shares.reduce((s, x, i) => s + x * pr[i] * MICRO, 0));
}
