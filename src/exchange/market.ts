/**
 * Screens that trade should use the trading API in ./api.ts (quote, buy, sell, close, positions, P&L).
 *
 * Crown Exchange markets (crown-exchange-2). Pure functions: each returns the journal entry to post and
 * the updated market/position objects; the caller posts the journal and saves the objects in ONE
 * transaction. States: open → closed → settled | cancelled (terminal; never reopened).
 *
 * A market is one fixed-b LMSR over n exhaustive, mutually exclusive STATES (research doc 09). Traders buy
 * and sell CLAIMS: a claim pays 1 crown per share in every state of its subset S (a categorical outcome is
 * the singleton S = {i}). All claims of a market share one inventory q, one collateral account and one
 * funded subsidy b·ln n (uniform q0 = 0), so prices of all claims are coherent and the maker's worst-case
 * loss is bounded by the funded subsidy. Inventory changes only through paid trades (no re-centring).
 * Retail holdings are long-only (no naked shorts).
 * Resolution pays a published PAYOUT VECTOR over states (a single winning state is the unit vector; joint
 * champions split equally; cancellation is the uniform vector 1/n). A claim pays Σ_{s∈S} payout[s] per share.
 */
import { Journal, MICRO } from './ledger';
import { buyClaimMicro, feeMicro, prices, sellClaimMicro, subsidyMicro } from './lmsr';

export const EXCHANGE_ID = 'crown-exchange-2';
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
  /** v0.4.0: market family; absent on v0.3 match markets. */
  kind?: MarketKind;
  /** State labels (absent → W/D/B). */
  outcomes?: string[];
  /** Tradable claims as state subsets (absent → one singleton claim per state). */
  claims?: { id: string; label: string; states: number[] }[];
  /** Published model probability per state (information only; never moves q). */
  model?: number[];
  /** Resolution payout vector over states (sums to 1). */
  payout?: number[] | null;
  /** Human-readable trading, closure, settlement and cancellation rules shown before trading. */
  rules?: string;
  /** Live in-play state for match markets traded during the game. */
  live?: { plies: number; lastEval: number | null } | null;
  /** Virtual initial inventory for prior-priced markets (liabilities are q − q0, never q0). */
  q0?: number[];
  /** Published cancellation payout vector (default uniform 1/n). */
  cancelVector?: number[];
  /** Ids this market depends on (fixture, event, competitor, …) for idempotent resolution. */
  ref?: Record<string, string | number>;
}

export type MarketKind = 'match' | 'winner' | 'promotion' | 'qualification' | 'season' | 'bracket' | 'sandbox' | 'length' | 'advancement';

export const statesOf = (m: Market): string[] => m.outcomes ?? [...OUTCOMES];
export const claimsOf = (m: Market): { id: string; label: string; states: number[] }[] =>
  m.claims ?? statesOf(m).map((label, i) => ({ id: `s${i}`, label, states: [i] }));
export const claimPrice = (m: Market, c: number): number => { const p = prices(m.q, m.b); return claimsOf(m)[c].states.reduce((a, s) => a + p[s], 0); };
export const claimPrices = (m: Market): number[] => claimsOf(m).map((_, i) => claimPrice(m, i));
/** Payout per share (crowns) of claim c under a payout vector. */
export const claimPayout = (m: Market, c: number, payout: number[]): number => claimsOf(m)[c].states.reduce((a, s) => a + payout[s], 0);

export interface Position {
  id: string; // `${marketId}|${holder}`
  marketId: string;
  holder: string; // ledger account of the holder
  shares: number[];
  spent: number; // µ total paid incl. fees (cost basis)
  received: number; // µ total received from sales and settlement
  fees: number;
  /** v0.10: average-cost basis per claim of the shares still held, µ incl. buy fees. Absent on positions opened before
   *  v0.10 while they still hold shares (the per-claim split was never recorded and is not reconstructed). */
  basis?: number[];
  /** v0.10: realised P&L, µ: net sale proceeds and settlement payouts minus the basis of the shares they closed. */
  realised?: number;
}

/** Recorded per-claim basis, or null when it was never recorded (legacy holdings). A position with no shares has an
 *  exact basis of zero and realised P&L received − spent, whatever its age. */
export function basisOf(p: Position, nClaims: number): { basis: number[]; realised: number } | null {
  if (p.basis && p.realised !== undefined) { const b = [...p.basis]; while (b.length < nClaims) b.push(0); return { basis: b, realised: p.realised }; }
  if (p.shares.every(x => x === 0)) return { basis: new Array(nClaims).fill(0), realised: p.received - p.spent };
  return null;
}

export const acct = (m: Market, part: 'collateral' | 'subsidy') => `${m.sandbox ? 'sandbox:' : ''}market:${m.id}:${part}`;
export const feeAccount = (m: Market) => (m.sandbox ? 'sandbox:fees' : 'fees');
export const treasuryAccount = (m: Market) => (m.sandbox ? 'sandbox:treasury' : 'treasury');

export class MarketError extends Error {}

/** v0.10 match claims: the three results plus "Decisive (either side wins)" = {White, Black} on the SAME inventory, so
 *  P(decisive) = 1 − P(draw) holds by construction and no cross-market arbitrage exists. The singleton claims come first
 *  in state order, so claim prices begin with the state prices (charts and live points rely on this prefix). */
export const MATCH_CLAIMS: { id: string; label: string; states: number[] }[] = [
  { id: 's0', label: 'White wins', states: [0] }, { id: 's1', label: 'Draw', states: [1] }, { id: 's2', label: 'Black wins', states: [2] },
  { id: 'decisive', label: 'Decisive (either side wins)', states: [0, 2] },
];

export function openMarket(p: { id: string; sandbox: boolean; fixtureId: string; title: string; white: string; black: string; season: number; round: number; b: number; forecast: Market['forecast']; at: string; claims?: Market['claims']; rules?: string }): { market: Market; journal: Journal } {
  const { claims, rules, ...rest } = p;
  const market: Market = {
    ...rest, q: [0, 0, 0], status: 'open', subsidy: subsidyMicro(p.b, 3), result: null, ...(claims ? { claims, kind: 'match' as const } : {}), ...(rules ? { rules } : {}),
    history: [{ at: p.at, seq: 0, prices: [1 / 3, 1 / 3, 1 / 3], by: 'open' }], openedAt: p.at, closedAt: null, settledAt: null, gameId: null,
  };
  const journal: Journal = {
    id: `market-open:${p.id}`, at: p.at, kind: 'market-subsidy', memo: `Fund worst-case maker subsidy b·ln 3 for ${p.title}`,
    lines: [{ account: treasuryAccount(market), amount: -market.subsidy }, { account: acct(market, 'subsidy'), amount: market.subsidy }], season: p.season, round: p.round,
  };
  return { market, journal };
}

/** Open any market family with uniform q0 and its funded subsidy b·ln n. */
export function openGenericMarket(p: { id: string; kind: MarketKind; sandbox: boolean; title: string; outcomes: string[]; claims?: Market['claims']; model: number[]; rules: string;
  fixtureId?: string; white?: string; black?: string; season: number; round: number; b: number; at: string; ref?: Market['ref']; forecast?: Market['forecast'];
  /** Optional opening prices p0 (research doc 09): virtual inventory q0_i = b·ln(p0_i/max p0); worst-case subsidy b·ln(1/min p0). */
  prior?: number[] }): { market: Market; journal: Journal } {
  const n = p.outcomes.length;
  if (p.prior && (p.prior.length !== n || p.prior.some(x => !(x > 0)) || Math.abs(p.prior.reduce((a, x) => a + x, 0) - 1) > 1e-9)) throw new MarketError('Prior must be a strictly positive probability vector');
  if (n < 2) throw new MarketError('A market needs at least two states');
  if (p.model.length !== n || Math.abs(p.model.reduce((a, x) => a + x, 0) - 1) > 1e-6) throw new MarketError('Model must be a probability vector over the states');
  for (const c of p.claims ?? []) if (!c.states.length || c.states.some(s => s < 0 || s >= n) || new Set(c.states).size !== c.states.length) throw new MarketError(`Bad claim ${c.id}`);
  const market: Market = {
    id: p.id, sandbox: p.sandbox, fixtureId: p.fixtureId ?? '', title: p.title, white: p.white ?? '', black: p.black ?? '', season: p.season, round: p.round, b: p.b,
    q: p.prior ? p.prior.map(x => p.b * Math.log(x / Math.max(...p.prior!))) : new Array(n).fill(0), status: 'open',
    subsidy: p.prior ? Math.ceil(p.b * Math.log(1 / Math.min(...p.prior)) * MICRO) : subsidyMicro(p.b, n), result: null, q0: p.prior ? p.prior.map(x => p.b * Math.log(x / Math.max(...p.prior!))) : undefined,
    forecast: p.forecast ?? { w: p.model[0], d: n > 1 ? p.model[1] : 0, l: n > 2 ? p.model[2] : 0, source: 'model' },
    history: [{ at: p.at, seq: 0, prices: p.prior ?? new Array(n).fill(1 / n), by: 'open' }], openedAt: p.at, closedAt: null, settledAt: null, gameId: null,
    kind: p.kind, outcomes: p.outcomes, claims: p.claims, model: p.model, payout: null, rules: p.rules, live: null, ref: p.ref,
  };
  const journal: Journal = {
    id: `market-open:${p.id}`, at: p.at, kind: 'market-subsidy', memo: `Fund worst-case maker subsidy b·ln ${n} for ${p.title}`,
    lines: [{ account: treasuryAccount(market), amount: -market.subsidy }, { account: acct(market, 'subsidy'), amount: market.subsidy }], season: p.season, round: p.round,
  };
  return { market, journal };
}

export interface Quote { outcome: number; shares: number; side: 'buy' | 'sell'; amount: number; fee: number; total: number; priceBefore: number; priceAfter: number; avgPrice: number; maxPayout: number; maxLoss: number }

export function quote(m: Market, outcome: number, shares: number, side: 'buy' | 'sell'): Quote {
  if (!Number.isInteger(shares) || shares <= 0) throw new MarketError('Shares must be a positive whole number');
  const claims = claimsOf(m);
  if (!Number.isInteger(outcome) || outcome < 0 || outcome >= claims.length) throw new MarketError('Unknown outcome');
  const S = claims[outcome].states;
  const amount = side === 'buy' ? buyClaimMicro(m.q, m.b, S, shares) : sellClaimMicro(m.q, m.b, S, shares);
  const fee = feeMicro(amount);
  const q2 = [...m.q]; for (const st of S) q2[st] += side === 'buy' ? shares : -shares;
  const total = side === 'buy' ? amount + fee : amount - fee;
  const sum = (q: number[]) => { const p = prices(q, m.b); return S.reduce((a, st) => a + p[st], 0); };
  return {
    outcome, shares, side, amount, fee, total,
    priceBefore: sum(m.q), priceAfter: sum(q2), avgPrice: amount / shares / MICRO,
    maxPayout: side === 'buy' ? shares * MICRO : 0, maxLoss: side === 'buy' ? total : 0,
  };
}

/** Execute a retail trade. `seq` must be unique per market (idempotency key). */
export function trade(m: Market, pos: Position | null, holder: string, outcome: number, shares: number, side: 'buy' | 'sell', at: string, seq: number):
  { market: Market; position: Position; journal: Journal; quote: Quote } {
  if (m.status !== 'open') throw new MarketError('Market is not open');
  const claims = claimsOf(m);
  if (!Number.isInteger(outcome) || outcome < 0 || outcome >= claims.length) throw new MarketError('Unknown outcome');
  const position: Position = pos ? structuredClone(pos) : { id: `${m.id}|${holder}`, marketId: m.id, holder, shares: new Array(claims.length).fill(0), spent: 0, received: 0, fees: 0 };
  while (position.shares.length < claims.length) position.shares.push(0);
  if (side === 'sell' && position.shares[outcome] < shares) throw new MarketError('Cannot sell more shares than held (no short selling)');
  const qt = quote(m, outcome, shares, side);
  if (side === 'sell' && qt.total < 0) throw new MarketError('Sale proceeds do not cover the fee');
  const market = structuredClone(m);
  for (const st of claims[outcome].states) market.q[st] += side === 'buy' ? shares : -shares;
  market.history.push({ at, seq, prices: prices(market.q, market.b), by: holder });
  const rec = basisOf(position, claims.length);
  position.fees += qt.fee;
  if (side === 'buy') position.spent += qt.total; else position.received += qt.total;
  if (rec) {
    // average cost: a sale closes held/shares of the claim's basis (rounded to the nearest µ; a full close takes all of it)
    const held = position.shares[outcome];
    if (side === 'buy') rec.basis[outcome] += qt.total;
    else { const out = shares === held ? rec.basis[outcome] : Math.round((rec.basis[outcome] * shares) / held); rec.basis[outcome] -= out; rec.realised += qt.total - out; }
    position.basis = rec.basis; position.realised = rec.realised;
  }
  position.shares[outcome] += side === 'buy' ? shares : -shares;
  const journal: Journal = side === 'buy'
    ? { id: `trade:${m.id}:${seq}`, at, kind: 'trade-buy', memo: `Buy ${shares} × ${claims[outcome].label} — ${m.title}`, season: m.season, round: m.round,
      lines: [{ account: holder, amount: -qt.total }, { account: acct(m, 'collateral'), amount: qt.amount }, { account: feeAccount(m), amount: qt.fee }] }
    : { id: `trade:${m.id}:${seq}`, at, kind: 'trade-sell', memo: `Sell ${shares} × ${claims[outcome].label} — ${m.title}`, season: m.season, round: m.round,
      lines: [{ account: acct(m, 'collateral'), amount: -qt.amount }, { account: holder, amount: qt.total }, { account: feeAccount(m), amount: qt.fee }] };
  return { market, position, journal, quote: qt };
}

/** Close trading (before any result exists). Terminal for trading; idempotent. */
export function closeMarket(m: Market, at: string): Market {
  if (m.status !== 'open') return m;
  return { ...m, status: 'closed', closedAt: at };
}

/** Required collateral: the maximum possible payout. */
/** Issued shares per state (q − q0). */
/**
 * Market revision (crown-market-revision-1): advances on every trade AND on every published live move, so a quote
 * taken before new public information can never execute after it (in-play: a trade queued while the next move is
 * being computed is rejected once that move is published).
 */
export const revisionOf = (m: Market): string => `${m.history.length}.${m.live?.plies ?? 0}`;
export const exposure = (m: Market) => m.q.map((x, i) => x - (m.q0?.[i] ?? 0));
export const maxLiability = (m: Market) => Math.max(...exposure(m)) * MICRO;

/** Resolve by a payout vector over states: pay holders from collateral (then subsidy), return the rest to
 *  the treasury. One balanced journal with a unique id (`settle:<market>`), so a retry is rejected. */
export function resolveMarket(m: Market, positions: Position[], payout: number[], kind: 'settle' | 'cancel', at: string, collateral: number, gameId: string | null, memo: string): { market: Market; positions: Position[]; journal: Journal } {
  if (m.status === 'settled' || m.status === 'cancelled') throw new MarketError('Market already resolved');
  if (kind === 'settle' && m.status === 'open') throw new MarketError('Close the market before settling');
  const n = statesOf(m).length;
  if (payout.length !== n || payout.some(x => x < 0) || Math.abs(payout.reduce((a, x) => a + x, 0) - 1) > 1e-9) throw new MarketError('Payout must be a probability vector over the states');
  const claims = claimsOf(m);
  const per = claims.map(c => c.states.reduce((a, st) => a + payout[st], 0));
  const payouts = positions.map(p => ({ p, amount: Math.floor(p.shares.reduce((a, x, c) => a + x * (per[c] ?? 0), 0) * MICRO + 1e-6) }));
  const due = payouts.reduce((a, x) => a + x.amount, 0);
  const funds = collateral + m.subsidy;
  if (due > funds) throw new MarketError(`Insolvent market: due ${due} > funds ${funds}`);
  const lines = [{ account: acct(m, 'collateral'), amount: -collateral }, { account: acct(m, 'subsidy'), amount: -m.subsidy }];
  for (const x of payouts) if (x.amount) lines.push({ account: x.p.holder, amount: x.amount });
  lines.push({ account: treasuryAccount(m), amount: funds - due });
  const win = payout.findIndex(x => x === 1);
  return {
    market: { ...m, status: kind === 'settle' ? 'settled' : 'cancelled', result: kind === 'settle' && win >= 0 ? win : kind === 'settle' ? -1 : null, payout, settledAt: at, closedAt: m.closedAt ?? at, gameId },
    // resolution closes every holding (shares stay recorded for history): nothing remains at risk and realised P&L is
    // exactly received − spent, legacy positions included
    positions: payouts.map(x => ({ ...x.p, received: x.p.received + x.amount, basis: new Array(claims.length).fill(0), realised: x.p.received + x.amount - x.p.spent })),
    journal: { id: `settle:${m.id}`, at, kind: kind === 'settle' ? 'market-settle' : 'market-cancel', memo, lines: lines.filter(l => l.amount !== 0), season: m.season, round: m.round },
  };
}
export const unitPayout = (n: number, w: number) => Array.from({ length: n }, (_, i) => (i === w ? 1 : 0));
export const uniformPayout = (n: number) => new Array(n).fill(1 / n);

/** Settle on a single winning state. */
export function settleMarket(m: Market, positions: Position[], result: number, at: string, collateral: number, gameId: string | null): { market: Market; positions: Position[]; journal: Journal } {
  const n = statesOf(m).length;
  if (!Number.isInteger(result) || result < 0 || result >= n) throw new MarketError('Unknown result');
  return resolveMarket(m, positions, unitPayout(n, result), 'settle', at, collateral, gameId, `Settle ${m.title}: ${statesOf(m)[result]}`);
}

/** Cancellation: the published uniform vector — each share pays |S|/n crowns (rounded down per holding). */
export function cancelMarket(m: Market, positions: Position[], at: string, collateral: number): { market: Market; positions: Position[]; journal: Journal } {
  const n = statesOf(m).length;
  const v = m.cancelVector ?? uniformPayout(n);
  return resolveMarket(m, positions, v, 'cancel', at, collateral, null, m.cancelVector ? `Cancel ${m.title}: published cancellation vector` : `Cancel ${m.title}: 1/${n} per state`);
}

/** Executable liquidation value of a position (sell everything now, after fees), µ. */
export function liquidationValue(m: Market, p: Position): number {
  if (m.status === 'settled' || m.status === 'cancelled') return 0;
  const claims = claimsOf(m);
  if (m.status === 'closed') {
    // not tradeable: the published cancellation vector is the only executable guarantee
    const v = m.cancelVector ?? uniformPayout(statesOf(m).length);
    return Math.floor(p.shares.reduce((a, x, c) => a + x * (claims[c]?.states.reduce((s2, st) => s2 + v[st], 0) ?? 0), 0) * MICRO);
  }
  let q = [...m.q], total = 0;
  for (let c = 0; c < claims.length; c++) {
    if (!p.shares[c]) continue;
    const proceeds = sellClaimMicro(q, m.b, claims[c].states, p.shares[c]);
    total += proceeds - feeMicro(proceeds);
    q = [...q]; for (const st of claims[c].states) q[st] -= p.shares[c];
  }
  return Math.max(0, total);
}
/** Marginal-price mark (informational, not executable), µ. */
export function markValue(m: Market, p: Position): number {
  if (m.status !== 'open' && m.status !== 'closed') return 0;
  const pr = claimPrices(m);
  return Math.round(p.shares.reduce((s, x, i) => s + x * (pr[i] ?? 0) * MICRO, 0));
}
