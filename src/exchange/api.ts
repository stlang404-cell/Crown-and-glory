/**
 * Crown Exchange trading API (crown-exchange-api-1) — the one entry point for screens that trade (Exchange, Live Match
 * Center / Spectator, Finance). Fictional dollars only. UI code should call this instead of FederationService.trade.
 *
 *   const ex = exchangeApi(services.fed);
 *   ex.status(marketId)                       → MarketStatusView  status, label, tradable, suspension reason, rules
 *   ex.quote(marketId, claim, shares, side)   → TicketPreview     exact cost / proceeds, fee, total, average price,
 *                                                                 price before → after, max payout / loss, the
 *                                                                 position after the trade, and the market revision
 *   await ex.buy(marketId, claim, shares, { revision, maxTotal })        throws a player-facing reason; never fills
 *   await ex.sell(marketId, claim, shares, { revision, minTotal })       at a price other than the quoted revision
 *   await ex.close(marketId, { claim?, revision, minTotal })  → µ net   sells every held share (or one claim) atomically
 *   ex.position(marketId)                     → PositionView | null  basis, realised / unrealised P&L, exit value,
 *                                                                 per-state scenario P&L incl. VOID, amount at risk
 *   ex.positions()                            → { market, view }[]   all of the player's positions
 *   ex.pnl()                                  → PortfolioSummary
 *   ex.watch(marketId, on) / ex.watchlist()   persisted market watchlist
 *
 * Rules every caller relies on:
 *  - `revision` (from quote/status) is mandatory for buy/sell/close: a trade quoted before a published move or another
 *    trade is rejected ("Stale quote"), never re-priced. In-play, each published move advances the revision.
 *  - A suspended or closed market rejects every trade; `status().tradable` is false and `reason` says why.
 *  - Claims are indexed as in `claimsOf(market)`. Match markets (v0.10) have claims [White, Draw, Black, Decisive];
 *    claim prices begin with the state prices, and `claimModel()` maps a state forecast to claims.
 *  - Amounts are integer µ (1,000,000 = $1). Every trade is one balanced journal in one IndexedDB transaction.
 */
import type { Market, Position, Quote } from './market';
import { claimsOf, quote as quoteMarket, revisionOf, trade as tradeMarket } from './market';
import { positionView, portfolioSummary, PositionView, PortfolioSummary } from './portfolio';

/** The part of FederationService this API uses (structural, so the exchange layer does not import the app layer). */
export interface ExchangeHost {
  state: { markets: Map<string, Market>; positions: Map<string, Position> } | null;
  balance(account: string): number;
  suspension(marketId: string): string | null;
  trade(marketId: string, claim: number, shares: number, side: 'buy' | 'sell', opts: { expectRevision?: string; maxTotal?: number; minTotal?: number }): Promise<void>;
  closePosition(marketId: string, opts: { claim?: number; expectRevision?: string; minTotal?: number }): Promise<number>;
  marketWatchlist(): string[];
  setMarketWatch(marketId: string, on: boolean): Promise<void>;
}

export const HOLDER = 'player:cash';
export const STATUS_TEXT: Record<Market['status'], string> = { open: 'Trading Open', closed: 'Trading Closed', settled: 'Market Settled', cancelled: 'Market VOID (cancelled)' };

export interface MarketStatusView { status: Market['status']; label: string; tradable: boolean; suspended: boolean; reason: string | null; revision: string; rules: string | null }
export interface TicketPreview {
  ok: boolean; error: string | null; quote: Quote | null; revision: string; tradable: boolean; reason: string | null;
  cash: number; holding: number; affordable: boolean;
  /** The player's position in this market if the trade executed now (exact, computed with the same trade function). */
  after: PositionView | null;
}

/** Map a per-state probability vector to the market's claims. */
export const claimModel = (m: Market, stateProbs: number[]): number[] => claimsOf(m).map(c => c.states.reduce((a, s) => a + (stateProbs[s] ?? 0), 0));

export function exchangeApi(host: ExchangeHost, readOnly = false) {
  const market = (id: string) => { const m = host.state?.markets.get(id); if (!m) throw new Error('That market could not be found.'); return m; };
  const pos = (id: string) => host.state?.positions.get(`${id}|${HOLDER}`) ?? null;
  const status = (id: string): MarketStatusView => {
    const m = market(id);
    const reason = readOnly ? 'This window is read-only.' : m.status !== 'open' ? `${STATUS_TEXT[m.status]}: trading has ended.` : host.suspension(id);
    return { status: m.status, label: host.suspension(id) && m.status === 'open' ? 'Trading Suspended' : STATUS_TEXT[m.status], tradable: !reason, suspended: m.status === 'open' && !!host.suspension(id), reason, revision: revisionOf(m), rules: m.rules ?? null };
  };
  return {
    status,
    quote(id: string, claim: number, shares: number, side: 'buy' | 'sell'): TicketPreview {
      const m = market(id), s = status(id), cash = host.balance(HOLDER), p = pos(id);
      const holding = p?.shares[claim] ?? 0;
      try {
        const q = quoteMarket(m, claim, shares, side);
        if (side === 'sell' && shares > holding) throw new Error(`You only have ${holding} ${holding === 1 ? 'share' : 'shares'} of this outcome to sell.`);
        let after: PositionView | null = null;
        if (m.status === 'open') { const t = tradeMarket(m, p, HOLDER, claim, shares, side, '', m.history.length); after = positionView(t.market, t.position); }
        const affordable = side === 'sell' || q.total <= cash;
        return { ok: true, error: affordable ? null : `Not enough cash: this costs more than your balance.`, quote: q, revision: s.revision, tradable: s.tradable, reason: s.reason, cash, holding, affordable, after };
      } catch (e) {
        return { ok: false, error: (e as Error).message, quote: null, revision: s.revision, tradable: s.tradable, reason: s.reason, cash, holding, affordable: false, after: null };
      }
    },
    buy: (id: string, claim: number, shares: number, o: { revision: string; maxTotal?: number }) => host.trade(id, claim, shares, 'buy', { expectRevision: o.revision, maxTotal: o.maxTotal }),
    sell: (id: string, claim: number, shares: number, o: { revision: string; minTotal?: number }) => host.trade(id, claim, shares, 'sell', { expectRevision: o.revision, minTotal: o.minTotal }),
    close: (id: string, o: { revision: string; claim?: number; minTotal?: number }) => host.closePosition(id, { claim: o.claim, expectRevision: o.revision, minTotal: o.minTotal }),
    position(id: string): PositionView | null { const p = pos(id); return p ? positionView(market(id), p) : null; },
    positions(): { market: Market; view: PositionView }[] {
      const st = host.state; if (!st) return [];
      return [...st.positions.values()].filter(p => p.holder === HOLDER && st.markets.has(p.marketId)).map(p => ({ market: st.markets.get(p.marketId)!, view: positionView(st.markets.get(p.marketId)!, p) }));
    },
    pnl(): PortfolioSummary { const st = host.state; return st ? portfolioSummary(st.markets, [...st.positions.values()].filter(p => p.holder === HOLDER)) : portfolioSummary(new Map(), []); },
    watchlist: () => host.marketWatchlist(),
    watch: (id: string, on: boolean) => host.setMarketWatch(id, on),
  };
}
export type ExchangeApi = ReturnType<typeof exchangeApi>;
