import { scrollRegion } from './scrollRegion';
import { HelpTip, TourHint } from './Onboarding';
import { useMemo, useState } from 'react';
import { fmtCareerElo } from '../ratings/display';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { eventName } from '../app/federation';
import { prices } from '../exchange/lmsr';
import { EXCHANGE_ID, claimsOf, statesOf, claimPrices, revisionOf, uniformPayout } from '../exchange/market';
import { exchangeApi } from '../exchange/api';
import type { PositionView } from '../exchange/portfolio';
import type { Market, Position } from '../exchange/market';
import { fmtCrowns, fmtPrice, fmtMoneyDelta, MICRO } from '../exchange/ledger';
import { pregameWdl, ODDS_MODEL_ID } from '../exchange/odds';
import { REGION_NAMES, divisionLabel, PLAYER_ID } from '../federation/model';
import { STYLE_LABEL, isValidatedStyle } from '../engine/styles';
import { MARKETS_ID } from '../exchange/families';
import { NPC_TRADERS } from '../exchange/npc';
import { scoreAll, summary } from '../app/forecasting';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const KIND_LABEL: Record<string, string> = { match: 'Match', winner: 'Tournament Champion', promotion: 'Promotion', qualification: 'Qualification', season: 'Season Title', bracket: 'Conditional · Final Four', sandbox: 'Sandbox', length: 'Match Length', advancement: 'Tournament Advancement' };
/** Player-facing market states (style guide terminology). */
export const STATUS_LABEL: Record<string, string> = { open: 'Trading Open', closed: 'Trading Closed', settled: 'Market Settled', cancelled: 'Market Cancelled (VOID)' };
/** Who made a recorded trade (market history). */
const traderName = (by: string) => (by === 'player:cash' ? 'You' : by === 'open' ? 'Market opened' : NPC_TRADERS.find(t => t.id === by)?.name ?? by);
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
const SERIES = ['var(--text)', 'var(--accent)', 'var(--info)', 'var(--positive)', 'var(--warn)'];

/** Price history of the (up to five) currently most likely claims, from recorded trades only. */
export function PriceChart({ m, points }: { m: Market; points?: { prices: number[] }[] }) {
  const W = 520, H = 130;
  const claims = claimsOf(m);
  // history entries record state prices; claim price = sum over its states
  const series = (points ?? m.history).map(h => claims.map(c => c.states.reduce((a, s) => a + (h.prices[s] ?? 0), 0)));
  if (series.length < 2) return <div className="small muted">Not enough trades for a chart yet.</div>;
  const last = series[series.length - 1];
  const top = last.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]).slice(0, Math.min(5, claims.length)).map(x => x[1]);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Price history of ${m.title}`}>
        {[0.25, 0.5, 0.75].map(y => <line key={y} x1={0} x2={W} y1={H - y * H} y2={H - y * H} style={{ stroke: 'var(--chart-grid)' }} />)}
        {top.map((ci, k) => <polyline key={ci} fill="none" style={{ stroke: SERIES[k] }} strokeWidth={2} strokeDasharray={k % 2 ? '6 4' : undefined} points={series.map((p, j) => `${(j / (series.length - 1)) * W},${H - p[ci] * H}`).join(' ')} />)}
      </svg>
      <div className="legend" aria-hidden>{top.map((ci, k) => <span key={ci}><i style={{ background: SERIES[k] }} />{claims[ci].label}</span>)}</div>
    </div>
  );
}

export function ExchangeScreen({ marketId }: { marketId?: string }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  const [tab, setTab] = useState<'markets' | 'forecasts' | 'traders'>('markets');
  if (!st) return <div className="panel"><h1>Crown Exchange</h1><p>Found the federation to open the Exchange. Markets cover federation matches, tournaments and seasons.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  if (marketId && st.markets.has(marketId)) return <MarketScreen m={st.markets.get(marketId)!} />;
  const all = [...st.markets.values()].filter(m => !m.sandbox).sort((a, b) => b.season - a.season || b.round - a.round || a.title.localeCompare(b.title));
  const live = all.filter(m => m.status === 'open' || m.status === 'closed');
  const settled = all.filter(m => m.status === 'settled' || m.status === 'cancelled');
  const mine = (m: Market) => st.positions.get(`${m.id}|player:cash`);
  // [test id key (unchanged), heading, markets]
  const watch = new Set(fed.marketWatchlist());
  const groups: [string, string, Market[]][] = [
    ...(watch.size ? [['Watchlist', 'Watchlist', all.filter(m => watch.has(m.id))] as [string, string, Market[]]] : []),
    ['Matches', 'Matches', live.filter(m => (m.kind ?? 'match') === 'match' || m.kind === 'length')],
    ['Tournaments', 'Tournaments', live.filter(m => m.kind === 'winner' || m.kind === 'advancement')],
    ['Season & league', 'Season & League', live.filter(m => m.kind === 'promotion' || m.kind === 'qualification' || m.kind === 'season')],
    ['Conditional (bounded state model)', 'Conditional Markets', live.filter(m => m.kind === 'bracket')],
  ];
  const sc = scoreAll(st.extra.forecasts, st.markets);
  const sum = summary(sc);
  return (
    <div>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Crown Exchange</h1>
        <span className="spacer" />
        <div className="seg" role="tablist" aria-label="Exchange sections">
          {(['markets', 'forecasts', 'traders'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'markets' ? 'Markets' : t === 'forecasts' ? 'Forecasts' : 'Traders'}</button>)}
        </div>
      </div>
      <div className="notice" style={{ marginBottom: 12 }}>Trade on federation events you can't influence. Each share pays $1 if its outcome happens, and every market shows its rules before you trade. All money is fictional and can't be redeemed. <HelpTip term="Live Odds / price" label="a market price" /></div>
      <TourHint step="market" />
      {tab === 'markets' && (
        <>
          <div className="grid-2">
            {groups.map(([key, label, ms]) => (
              <div key={key} className="panel" data-testid={`group-${key}`}>
                <h2 className="h3">{label}</h2>
                {ms.length === 0 ? <p className="small muted">None open right now.</p> : <MarketTable markets={ms} mine={mine} label={`${label} markets`} />}
              </div>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 14 }}>
            <h2 className="h3">Settled Markets</h2>
            {settled.length === 0 ? <p className="small muted">No settled markets yet.</p> : <MarketTable markets={settled.slice(0, 80)} mine={mine} label="Settled markets" />}
          </div>
        </>
      )}
      {tab === 'forecasts' && (
        <div className="panel stack">
          <h2 className="h3">Paper Forecasts</h2>
          <p className="small">Free practice with no money at stake. {sum.n === 0 ? 'No scored forecasts yet.' : <>Over {sum.n} resolved forecast{sum.n > 1 ? 's' : ''}, your Brier score is <strong>{sum.brier!.toFixed(3)}</strong> (lower is better){sum.priceBrier !== null && <> · market price {sum.priceBrier.toFixed(3)}</>}{sum.modelBrier !== null && <> · public forecast {sum.modelBrier.toFixed(3)}</>}.</>}</p>
          <button className="btn" onClick={() => go({ name: 'forecasts' })}>Open Forecasting</button>
        </div>
      )}
      {tab === 'traders' && (
        <div className="panel">
          <h2 className="h3">Other Traders</h2>
          <p className="small muted">Computer traders funded by the federation. They trade through the same market maker as you, using only public information, and none is guaranteed to profit.</p>
          <table className="small"><thead><tr><th>Trader</th><th>Strategy</th><th>Wallet</th><th>At Risk</th></tr></thead>
            <tbody>{NPC_TRADERS.map(t => {
              const exp = [...st.positions.values()].filter(p => p.holder === t.id && ['open', 'closed'].includes(st.markets.get(p.marketId)?.status ?? '')).reduce((a, p) => a + Math.max(0, p.spent - p.received), 0);
              return <tr key={t.id}><td>{t.name}</td><td>{t.description}</td><td className="mono">{fmtCrowns(fed.balance(t.id), 0)}</td><td className="mono">{fmtCrowns(exp, 0)}</td></tr>;
            })}</tbody></table>
        </div>
      )}
      <details className="small muted" style={{ marginTop: 8 }}><summary>Details</summary>Each event has one automated market maker (LMSR): prices move only when someone trades. Exchange {EXCHANGE_ID} · market families {MARKETS_ID} · match forecasts {ODDS_MODEL_ID} on public ratings and rating deviations.</details>
    </div>
  );
}

function MarketTable({ markets, mine, label = 'Markets table' }: { markets: Market[]; mine: (m: Market) => Position | undefined; label?: string }) {
  const { go } = useApp();
  const services = useServices();
  const suspended = (m: Market) => m.status === 'open' && !!services.fed.suspension(m.id);
  return (
    <div style={{ overflowX: 'auto' }} ref={scrollRegion(label)}>
      <table>
        <thead><tr><th>Market</th><th>Leading</th><th className="hide-sm">Status</th><th className="hide-sm">You</th></tr></thead>
        <tbody>{markets.map(m => {
          const claims = claimsOf(m);
          const pr = claimPrices(m);
          const lead = m.status === 'settled' ? (m.result !== null && m.result >= 0 ? statesOf(m)[m.result] : 'Split') : (() => { const i = pr.indexOf(Math.max(...pr)); return `${claims[i].label} ${fmtPrice(pr[i])}`; })();
          const pos = mine(m);
          return (
            <tr key={m.id} className="clickable" data-testid="market-row" data-kind={m.kind ?? 'match'} onClick={() => go({ name: 'exchange', id: m.id })}>
              <td>{m.title}<div className="small muted">{KIND_LABEL[m.kind ?? 'match']} · Season {m.season}, Round {m.round}{m.live ? ' · live trading' : ''}</div><div className="show-sm" style={{ marginTop: 4 }}>{suspended(m) ? <span className="chip warn">Trading Suspended</span> : <span className={`chip ${m.status === 'open' ? 'pos' : m.status === 'settled' ? 'info' : ''}`}>{statusLabel(m.status)}</span>}</div></td>
              <td className="small">{lead}</td>
              <td className="hide-sm">{suspended(m) ? <span className="chip warn" data-testid="suspended-chip">Trading Suspended</span> : <span className={`chip ${m.status === 'open' ? 'pos' : m.status === 'settled' ? 'info' : ''}`}>{statusLabel(m.status)}</span>}</td>
              <td className="hide-sm mono small">{pos && pos.shares.some(x => x) ? `${pos.shares.reduce((a, b) => a + b, 0)} shares` : ''}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/** Generic trade ticket (any claim of any market). Used by the market page and the live spectator. All quoting and
 *  execution goes through the trading API (src/exchange/api.ts); the ticket only renders it. */
export function TradeTicket({ m, compact = false }: { m: Market; compact?: boolean }) {
  const services = useServices();
  const fed = services.fed;
  const api = exchangeApi(fed, services.readOnly);
  const claims = claimsOf(m);
  const [claim, setClaim] = useState(0);
  const [shares, setShares] = useState(10);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const status = api.status(m.id);
  const pv = api.quote(m.id, claim, shares, side);
  const q = pv.quote;
  const canTrade = status.tradable && m.white !== PLAYER_ID && m.black !== PLAYER_ID;
  const tooMuch = !!q && side === 'buy' && !pv.affordable;
  const tooMany = side === 'sell' && shares > pv.holding;
  const revision = revisionOf(m);
  const exec = async () => {
    setBusy(true); setMsg(null);
    try {
      // the exact previewed total is the limit: with the revision check the trade fills at exactly this amount or not at all
      if (side === 'buy') await api.buy(m.id, claim, shares, { revision, maxTotal: q?.total });
      else await api.sell(m.id, claim, shares, { revision, minTotal: q?.total });
      setMsg({ kind: 'ok', text: `${side === 'buy' ? 'Bought' : 'Sold'} ${shares} shares of ${claims[claim].label} for ${fmtCrowns(q?.total ?? 0)}.` });
    } catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } finally { setBusy(false); }
  };
  const held = pv.after?.holdings.find(h => h.claim === claim);
  return (
    <div className="panel stack" data-testid="ticket" data-revision={revision}>
      <h2 className="h3">Trade Ticket</h2>
      {status.suspended && <div className="small notice warn" data-testid="ticket-suspended">{status.reason}</div>}
      {!canTrade && !status.suspended && <div className="small notice">{m.status === 'open' ? 'Trading isn’t available here.' : `${statusLabel(m.status)}: trading has ended.`}</div>}
      {msg && <div className={`notice small ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div>}
      <div className="seg" role="group" aria-label="Side"><button aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>Buy</button><button aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Sell</button></div>
      {claims.length <= 3
        ? <div className="seg" role="group" aria-label="Outcome">{claims.map((c, i) => <button key={c.id} aria-pressed={claim === i} onClick={() => setClaim(i)}>{c.label}</button>)}</div>
        : <label className="small">Outcome <select value={claim} onChange={e => setClaim(+e.target.value)} aria-label="Outcome" data-testid="claim-select">{claims.map((c, i) => <option key={c.id} value={i}>{c.label} — {fmtPrice(claimPrices(m)[i])}</option>)}</select></label>}
      <label className="small">Shares <input type="number" min={1} step={1} value={shares} onChange={e => setShares(Math.max(1, Math.floor(+e.target.value || 1)))} style={{ width: 90 }} aria-label="Shares" /></label>
      {q ? (
        <table className="small" data-testid="ticket-preview"><tbody>
          <tr><td>{side === 'buy' ? 'Cost' : 'Proceeds'}</td><td className="mono">{fmtCrowns(q.amount)}</td></tr>
          <tr><td>Fee (1%)</td><td className="mono">{fmtCrowns(q.fee)}</td></tr>
          <tr><td><strong>{side === 'buy' ? 'You pay' : 'You receive'}</strong></td><td className="mono"><strong>{fmtCrowns(q.total)}</strong></td></tr>
          {!compact && <tr><td>Average price</td><td className="mono">{fmtPrice(q.avgPrice)}</td></tr>}
          <tr><td>Price moves</td><td className="mono">{fmtPrice(q.priceBefore)} → {fmtPrice(q.priceAfter)}</td></tr>
          {side === 'buy' && <><tr><td>Max payout</td><td className="mono">{fmtCrowns(q.maxPayout)}</td></tr><tr><td>Max loss</td><td className="mono">{fmtCrowns(q.maxLoss)}</td></tr></>}
          {!compact && pv.after && <tr><td>After this trade</td><td className="mono small">{held ? `${held.shares} held${held.avgCost !== null ? ` · avg ${fmtPrice(held.avgCost / MICRO)}` : ''}` : 'none held'} · worst case {fmtMoneyDelta(pv.after.worst)} · best {fmtMoneyDelta(pv.after.best)}</td></tr>}
        </tbody></table>
      ) : <div className="small notice warn">{pv.error}</div>}
      {tooMuch && <div className="small notice warn">Not enough cash: you have {fmtCrowns(pv.cash)}.</div>}
      <button className="btn primary" data-testid="confirm-trade" disabled={!canTrade || busy || !q || tooMuch || tooMany} onClick={exec}>{busy ? 'Placing Trade…' : q ? `Confirm: ${side === 'buy' ? 'Pay' : 'Receive'} ${fmtCrowns(q.total)}` : `Confirm ${side === 'buy' ? 'Buy' : 'Sell'}`}</button>
      <div className="small muted">Cash {fmtCrowns(pv.cash)} · you pay or receive exactly the amount on the button: if a move or another trade changes the price first, the trade is rejected, never filled at a new price.</div>
    </div>
  );
}

/** Position, cost basis, P&L, scenarios and Close Position (exact proceeds preview). */
export function PositionPanel({ m }: { m: Market }) {
  const services = useServices();
  const { go } = useApp();
  const api = exchangeApi(services.fed, services.readOnly);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const v: PositionView | null = api.position(m.id);
  const status = api.status(m.id);
  const has = !!v && v.holdings.length > 0;
  const close = async () => {
    setMsg(null);
    try { const net = await api.close(m.id, { revision: status.revision, minTotal: v!.exitValue }); setMsg({ kind: 'ok', text: `Position closed: received ${fmtCrowns(net)}.` }); }
    catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } finally { setConfirm(false); }
  };
  const sign = (x: number) => <span className={`mono ${x > 0 ? 'pos' : x < 0 ? 'neg' : ''}`}>{fmtMoneyDelta(x)}</span>;
  return (
    <div className="panel stack" data-testid="position-panel">
      <h2 className="h3">Your Position</h2>
      {msg && <div className={`notice small ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div>}
      {!v || (!has && !v.spent) ? <p className="small muted">No shares in this market yet.</p> : (
        <div className="small stack" style={{ gap: 6 }}>
          {has && (
            <table className="small"><thead><tr><th>Outcome</th><th>Shares</th><th>Avg Cost</th><th>Price</th><th>{m.status === 'open' ? 'Sell Now' : 'Value'}</th><th>Unrealised</th></tr></thead>
              <tbody>{v.holdings.map(h => <tr key={h.claim}><td>{h.label}</td><td className="mono">{h.shares}</td><td className="mono">{h.avgCost === null ? '—' : fmtPrice(h.avgCost / MICRO)}</td><td className="mono">{fmtPrice(h.price)}</td><td className="mono">{m.status === 'open' ? fmtCrowns(h.exitValue) : '—'}</td><td>{h.unrealised === null || m.status !== 'open' ? '—' : sign(h.unrealised)}</td></tr>)}</tbody></table>
          )}
          <div>Paid {fmtCrowns(v.spent)} (including {fmtCrowns(v.fees)} fees) · received {fmtCrowns(v.received)}</div>
          {v.basisKnown
            ? <div data-testid="pnl">Realised {sign(v.realised!)} · {m.status === 'open' ? <>unrealised {sign(v.unrealised!)} (if sold now)</> : m.status === 'closed' ? <>{fmtCrowns(v.pending)} awaiting settlement</> : 'nothing open'}</div>
            : <div className="muted">Cost basis per outcome was not recorded for trades before v0.10; net so far {sign(v.netIfClosedNow)}.</div>}
          {(m.status === 'open' || m.status === 'closed') && has && <div>At risk: <strong className="mono">{fmtCrowns(v.atRisk)}</strong> · best case {sign(v.best)} · worst case {sign(v.worst)}</div>}
          {(m.status === 'open' || m.status === 'closed') && has && (
            <details><summary>Profit or Loss by Outcome</summary>
              <table className="small"><tbody>{v.scenarios.map(s => <tr key={s.label}><td>{s.label}</td><td className="mono">pays {fmtCrowns(s.payout)}</td><td>{sign(s.pnl)}</td></tr>)}</tbody></table>
            </details>
          )}
          {m.status === 'settled' && <div>Market Settled · net {sign(v.received - v.spent)}</div>}
          {m.status === 'settled' && (m.kind ?? 'match') === 'match' && m.fixtureId && <button className="btn small" data-testid="settled-replay" onClick={() => go({ name: 'watch', id: m.fixtureId! })}>Replay the Match with Its Recorded Odds</button>}
          {m.status === 'cancelled' && <div>Market VOID: refunded on its published cancellation terms · net {sign(v.received - v.spent)}</div>}
          {m.status === 'open' && has && (confirm
            ? <div className="row"><button className="btn primary small" data-testid="confirm-close" disabled={!status.tradable} onClick={close}>Confirm: Receive {fmtCrowns(v.exitValue)}</button><button className="btn small" onClick={() => setConfirm(false)}>Keep</button></div>
            : <button className="btn small" data-testid="close-position" disabled={!status.tradable} onClick={() => setConfirm(true)}>Close Position</button>)}
        </div>
      )}
    </div>
  );
}

/** Settlement and VOID terms per claim, from the market's published payout rules. */
function SettlementTerms({ m }: { m: Market }) {
  const claims = claimsOf(m), n = statesOf(m).length;
  const v = m.cancelVector ?? uniformPayout(n);
  return (
    <details className="small" data-testid="settlement-terms"><summary>Settlement and VOID Terms</summary>
      <table className="small"><thead><tr><th>Outcome</th><th>Pays if it happens</th><th>Pays if VOID</th></tr></thead>
        <tbody>{claims.slice(0, 40).map(c => <tr key={c.id}><td>{c.label}</td><td className="mono">$1.000 per share</td><td className="mono">{fmtPrice(c.states.reduce((a, s) => a + v[s], 0))}</td></tr>)}</tbody></table>
      <div className="muted">VOID means the market is cancelled on its published terms (see the rules); every holding is paid the VOID amount per share, rounded down to the micro-dollar. Settlement and VOID are final and happen once.</div>
    </details>
  );
}

/** Recorded trades (market history), newest first. */
function TradeHistory({ m }: { m: Market }) {
  const claims = claimsOf(m);
  const rows = m.history.slice(-30).reverse();
  return (
    <details className="small" data-testid="trade-history"><summary>Market History ({m.history.length - 1} {m.history.length === 2 ? 'trade' : 'trades'})</summary>
      <table className="small"><thead><tr><th>#</th><th>Trader</th><th>Leading After</th></tr></thead>
        <tbody>{rows.map(h => { const cp = claims.map(c => c.states.reduce((a, st) => a + (h.prices[st] ?? 0), 0)); const i = cp.indexOf(Math.max(...cp)); return <tr key={`${h.seq}-${h.by}`}><td className="mono">{h.seq}</td><td>{traderName(h.by)}</td><td className="mono">{claims[i]?.label} {fmtPrice(cp[i])}</td></tr>; })}</tbody></table>
    </details>
  );
}

function WatchButton({ m }: { m: Market }) {
  const services = useServices();
  const fed = services.fed;
  const on = fed.marketWatchlist().includes(m.id);
  return <button className="btn small" data-testid="watch-market" aria-pressed={on} disabled={services.readOnly} onClick={() => void fed.setMarketWatch(m.id, !on)}>{on ? '★ Watching' : '☆ Watch'}</button>;
}

export function ForecastPanel({ m }: { m: Market }) {
  const services = useServices();
  const fed = services.fed;
  const st = fed.state!;
  const states = statesOf(m);
  const existing = st.extra.forecasts.find(f => f.marketId === m.id);
  const base = existing?.probs ?? m.model ?? (states.length === 3 ? [m.forecast.w, m.forecast.d, m.forecast.l] : states.map(() => 1 / states.length));
  const [vals, setVals] = useState<number[]>(base.map(x => Math.round(x * 100)));
  const [msg, setMsg] = useState<string | null>(null);
  if (m.kind === 'bracket' || states.length > 16) return null;
  const total = Math.max(1, vals.reduce((a, x) => a + x, 0));
  return (
    <div className="panel stack" data-testid="forecast-panel">
      <h2 className="h3">Paper Forecast</h2>
      <div className="small muted">Free practice, scored when the market resolves. Your numbers are scaled to add up to 100%.</div>
      <div style={{ maxHeight: 260, overflow: 'auto' }} ref={scrollRegion('Paper forecast')}>
        {states.map((o, i) => (
          <label key={i} className="small row" style={{ justifyContent: 'space-between' }}>{o}
            <span className="row"><input type="number" min={0} max={100} value={vals[i]} disabled={m.status !== 'open'} onChange={e => { const v = [...vals]; v[i] = Math.max(0, Math.min(100, +e.target.value || 0)); setVals(v); }} style={{ width: 64 }} aria-label={`${o} forecast`} /><span className="mono" style={{ width: 44, textAlign: 'right' }}>{Math.round((100 * vals[i]) / total)}%</span></span>
          </label>
        ))}
      </div>
      <button className="btn small" data-testid="record-forecast" disabled={m.status !== 'open' || services.readOnly} onClick={() => fed.forecast(m.id, vals).then(() => setMsg('Forecast recorded. It locks when trading closes.'), e => setMsg((e as Error).message))}>{existing ? 'Update Forecast' : 'Record Forecast'}</button>
      {msg && <div className="small">{msg}</div>}
    </div>
  );
}

function MarketScreen({ m }: { m: Market }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const analyst = fed.ownsAsset('analyst');
  const kind = m.kind ?? 'match';
  const claims = claimsOf(m);
  const cp = claimPrices(m);
  const states = statesOf(m);
  const stateModel = m.model ?? [m.forecast.w, m.forecast.d, m.forecast.l];
  const claimModel = claims.map(c => c.states.reduce((a, s) => a + (stateModel[s] ?? 0), 0));
  return (
    <div>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn ghost small" onClick={() => go({ name: 'exchange' })}>← Exchange</button>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{m.title}</h1>
        <span className="chip">{KIND_LABEL[kind]}</span>
        <span className={`chip ${m.status === 'open' ? 'pos' : 'info'}`} data-testid="market-status">{statusLabel(m.status)}</span>
        {m.status === 'open' && fed.suspension(m.id) && <span className="chip warn">Trading Suspended</span>}
        <span className="spacer" />
        <WatchButton m={m} />
        {kind === 'match' && <button className="btn small" onClick={() => go({ name: 'watch', id: m.fixtureId })}>{m.status === 'settled' ? 'Replay Match' : 'Watch Match'}</button>}
      </div>
      <div className="grid-2">
        <div className="stack">
          {kind === 'match' && <MatchResearch m={m} />}
          <div className="panel stack">
            <h2 className="h3">Live Odds</h2>
            <div style={{ maxHeight: 420, overflow: 'auto' }} ref={scrollRegion('Live odds history')}>
              <table className="small">
                <thead><tr><th>Outcome</th><th>Forecast</th><th>Price</th><th>Difference</th></tr></thead>
                <tbody>{claims.map((c, i) => ({ c, i })).sort((a, b) => (kind === 'bracket' ? 0 : cp[b.i] - cp[a.i])).map(({ c, i }) => (
                  <tr key={c.id}><td>{c.label}{kind === 'bracket' && <div className="muted">pays $1 in paths {c.states.map(s => s + 1).join(', ')}</div>}</td><td className="mono">{pct(claimModel[i])}</td><td className="mono">{fmtPrice(cp[i])}</td><td className={`mono ${claimModel[i] - cp[i] > 0.02 ? 'pos' : ''}`}>{((claimModel[i] - cp[i]) * 100).toFixed(1)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            {kind === 'bracket' && <ConditionalTable m={m} />}
            <div className="small muted">Forecast: each outcome's chance from public ratings, for information only. Price: what a share costs now; it moves only when someone trades.</div>
          </div>
          <div className="panel small stack" style={{ gap: 6 }}>
            <div><strong>Rules.</strong> {m.rules ?? 'Outcomes: White wins, draw or Black wins. Trading: until the match starts. Settlement: each winning share pays $1. Cancellation: 1/$3 per share.'}</div>
            <div>Fee: 1% on every buy and sell. You can never lose more than you pay.</div>
            <SettlementTerms m={m} />
            <TradeHistory m={m} />
            <details className="small muted"><summary>Details</summary>Priced by an automated market maker (LMSR) over {states.length} outcomes · liquidity b = {m.b} · market maker subsidy {fmtCrowns(m.subsidy, 0)} (worst-case loss b·ln {states.length}) · prices from the {prices(m.q, m.b).length}-state inventory · {MICRO.toLocaleString('en')} µ = $1 · market revision {revisionOf(m)}.</details>
          </div>
          {(analyst || kind !== 'match') && <div className="panel"><h2 className="h3">Price History</h2><PriceChart m={m} /></div>}
        </div>
        <div className="stack">
          <TradeTicket m={m} />
          <PositionPanel m={m} />
          <ForecastPanel m={m} />
        </div>
      </div>
    </div>
  );
}

/** Indicative conditional probabilities P(X wins | X and Y meet in the final) from current prices — not a cash price. */
function ConditionalTable({ m }: { m: Market }) {
  const p = prices(m.q, m.b);
  const claims = claimsOf(m);
  const finals = claims.filter(c => c.id.startsWith('final:'));
  const beats = claims.filter(c => c.id.startsWith('beats:'));
  const rows = beats.map(c => {
    const loser = c.id.split('>')[1];
    const f = finals.find(x => x.id === `final:${loser}`)!;
    const pf = f.states.reduce((a, s) => a + p[s], 0);
    const pj = c.states.reduce((a, s) => a + p[s], 0);
    return { label: c.label.split(' (=')[0], cond: pf > 0 ? pj / pf : null, joint: pj };
  });
  return (
    <details className="small"><summary>Implied Final Odds</summary>
      <table><thead><tr><th>Final</th><th>Combined Price</th><th>Win Chance If Both Reach the Final</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.label}><td>{r.label}</td><td className="mono">{fmtPrice(r.joint)}</td><td className="mono">{r.cond === null ? '—' : pct(r.cond)}</td></tr>)}</tbody></table>
      <div className="muted">This is a ratio of two prices, not a price you can trade. You trade the combined outcome, which pays nothing if the two players don't meet in the final.</div>
    </details>
  );
}

function MatchResearch({ m }: { m: Market }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state!;
  const analyst = fed.ownsAsset('analyst');
  const w = st.competitors.get(m.white), b = st.competitors.get(m.black);
  const h2h = useMemo(() => {
    let a = 0, n = 0;
    for (const r of st.rounds.values()) {
      for (const [, x, y, res] of r.abstract) if (res !== null && ((x === m.white && y === m.black) || (x === m.black && y === m.white))) { n++; a += x === m.white ? res : 1 - res; }
      for (const f of r.fixtures) if (f.result !== null && f.id !== m.fixtureId && ((f.white === m.white && f.black === m.black) || (f.white === m.black && f.black === m.white))) { n++; a += f.white === m.white ? f.result : 1 - f.result; }
    }
    return { a, n };
  }, [st, m]);
  if (!w || !b) return null;
  const model = [m.forecast.w, m.forecast.d, m.forecast.l];
  const lo = pregameWdl({ rating: w.rating - w.rd, rd: w.rd }, { rating: b.rating + b.rd, rd: b.rd }), hi = pregameWdl({ rating: w.rating + w.rd, rd: w.rd }, { rating: b.rating - b.rd, rd: b.rd });
  const fx = [...st.rounds.values()].flatMap(r => r.fixtures).find(f => f.id === m.fixtureId);
  return (
    <div className="panel stack">
      <h2 className="h3">Match Research</h2>
      {fx && <div className="small muted">{eventName(fx.event)}{fx.stage ? ` · ${fx.stage}` : ''} · Season {fx.season}, Round {fx.round}</div>}
      {[w, b].map((c, i) => (
        <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
          <Portrait seed={c.portraitSeed} size={44} />
          <div style={{ flex: 1 }}>
            <button className="btn ghost small inline-link" onClick={() => go({ name: 'competitor', id: c.id })}><strong>{c.name}</strong></button> <span className="muted small">({i === 0 ? 'White' : 'Black'})</span>
            <div className="small">{fmtCareerElo(c.rating, { rd: c.rd })} · form <span className="mono">{c.form || '—'}</span> · {c.stats.w}–{c.stats.d}–{c.stats.l} · {divisionLabel(c.division)}, {REGION_NAMES[c.region]}</div>
            <div className="small muted">Style: {isValidatedStyle(c.style) ? STYLE_LABEL[c.style] : 'Universal'}{c.titles.length ? ` · ${c.titles.length} ${c.titles.length === 1 ? 'title' : 'titles'}` : ''}</div>
          </div>
        </div>
      ))}
      <div className="small">Head-to-head: {h2h.n === 0 ? 'never met before' : `${w.name} ${h2h.a}–${h2h.n - h2h.a} ${b.name} (${h2h.n} ${h2h.n === 1 ? 'game' : 'games'})`}</div>
      <div className="small muted">Forecast from public ratings: White {pct(model[0])} · Draw {pct(model[1])} · Black {pct(model[2])}.</div>
      {analyst ? <div className="small" data-testid="analyst">Analyst Office: White's expected score {(model[0] + model[1] / 2).toFixed(3)} · rating gap {Math.round(w.rating - b.rating)} · White win chance across both ratings' uncertainty {pct(lo.w)}–{pct(hi.w)}.</div>
        : <div className="small muted">An Analyst Office adds a forecast breakdown, a rating-uncertainty range and price history.</div>}
      <details className="small muted"><summary>Details</summary>Forecast model: {m.forecast.source}. {ODDS_MODEL_ID} is an ordered-logit W/D/L model fitted on engine games: public ratings and rating deviations, White's first-move edge and a draw rate that rises with the level of play (docs/ODDS_MODEL.md). The uncertainty range uses ±1 rating deviation; it is not a confidence interval of the model.</details>
    </div>
  );
}
