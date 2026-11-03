import { useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { eventName } from '../app/federation';
import { prices } from '../exchange/lmsr';
import { quote, liquidationValue, EXCHANGE_ID, claimsOf, statesOf, claimPrices, revisionOf } from '../exchange/market';
import type { Market, Position } from '../exchange/market';
import { fmtCrowns, MICRO } from '../exchange/ledger';
import { wdl, NU, RESULT_MODEL_ID } from '../federation/resultModel';
import { REGION_NAMES, divisionLabel, PLAYER_ID } from '../federation/model';
import { STYLE_LABEL, isValidatedStyle } from '../engine/styles';
import { MARKETS_ID } from '../exchange/families';
import { NPC_TRADERS } from '../exchange/npc';
import { scoreAll, summary } from '../app/forecasting';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const KIND_LABEL: Record<string, string> = { match: 'Match', winner: 'Tournament Champion', promotion: 'Promotion', qualification: 'Qualification', season: 'Season Title', bracket: 'Conditional · Final Four', sandbox: 'Sandbox' };
/** Player-facing market states (style guide terminology). */
export const STATUS_LABEL: Record<string, string> = { open: 'Trading Open', closed: 'Trading Closed', settled: 'Market Settled', cancelled: 'Market Cancelled' };
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
  const groups: [string, string, Market[]][] = [
    ['Matches', 'Matches', live.filter(m => (m.kind ?? 'match') === 'match')],
    ['Tournaments', 'Tournaments', live.filter(m => m.kind === 'winner')],
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
          {(['markets', 'forecasts', 'traders'] as const).map(t => <button key={t} role="tab" aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'markets' ? 'Markets' : t === 'forecasts' ? 'Forecasts' : 'Traders'}</button>)}
        </div>
      </div>
      <div className="notice" style={{ marginBottom: 12 }}>Trade on federation events you can't influence. Each share pays 1 ₵ if its outcome happens, and every market shows its rules before you trade. All crowns are fictional and can't be redeemed.</div>
      {tab === 'markets' && (
        <>
          <div className="grid-2">
            {groups.map(([key, label, ms]) => (
              <div key={key} className="panel" data-testid={`group-${key}`}>
                <h3>{label}</h3>
                {ms.length === 0 ? <p className="small muted">None open right now.</p> : <MarketTable markets={ms} mine={mine} />}
              </div>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 14 }}>
            <h3>Settled Markets</h3>
            {settled.length === 0 ? <p className="small muted">No settled markets yet.</p> : <MarketTable markets={settled.slice(0, 80)} mine={mine} />}
          </div>
        </>
      )}
      {tab === 'forecasts' && (
        <div className="panel stack">
          <h3>Paper Forecasts</h3>
          <p className="small">Free practice with no money at stake. {sum.n === 0 ? 'No scored forecasts yet.' : <>Over {sum.n} resolved forecast{sum.n > 1 ? 's' : ''}, your Brier score is <strong>{sum.brier!.toFixed(3)}</strong> (lower is better){sum.priceBrier !== null && <> · market price {sum.priceBrier.toFixed(3)}</>}{sum.modelBrier !== null && <> · public forecast {sum.modelBrier.toFixed(3)}</>}.</>}</p>
          <button className="btn" onClick={() => go({ name: 'forecasts' })}>Open Forecasting</button>
        </div>
      )}
      {tab === 'traders' && (
        <div className="panel">
          <h3>Other Traders</h3>
          <p className="small muted">Computer traders funded by the federation. They trade through the same market maker as you, using only public information, and none is guaranteed to profit.</p>
          <table className="small"><thead><tr><th>Trader</th><th>Strategy</th><th>Wallet</th><th>At Risk</th></tr></thead>
            <tbody>{NPC_TRADERS.map(t => {
              const exp = [...st.positions.values()].filter(p => p.holder === t.id && ['open', 'closed'].includes(st.markets.get(p.marketId)?.status ?? '')).reduce((a, p) => a + Math.max(0, p.spent - p.received), 0);
              return <tr key={t.id}><td>{t.name}</td><td>{t.description}</td><td className="mono">{fmtCrowns(fed.balance(t.id), 0)}</td><td className="mono">{fmtCrowns(exp, 0)}</td></tr>;
            })}</tbody></table>
        </div>
      )}
      <details className="small muted" style={{ marginTop: 8 }}><summary>Details</summary>Each event has one automated market maker (LMSR): prices move only when someone trades. Exchange {EXCHANGE_ID} · market families {MARKETS_ID} · match forecasts {RESULT_MODEL_ID} on public ratings.</details>
    </div>
  );
}

function MarketTable({ markets, mine }: { markets: Market[]; mine: (m: Market) => Position | undefined }) {
  const { go } = useApp();
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr><th>Market</th><th>Leading</th><th>Status</th><th className="hide-sm">You</th></tr></thead>
        <tbody>{markets.map(m => {
          const claims = claimsOf(m);
          const pr = claimPrices(m);
          const lead = m.status === 'settled' ? (m.result !== null && m.result >= 0 ? statesOf(m)[m.result] : 'Split') : (() => { const i = pr.indexOf(Math.max(...pr)); return `${claims[i].label} ${(pr[i] * 100).toFixed(0)}¢`; })();
          const pos = mine(m);
          return (
            <tr key={m.id} className="clickable" data-testid="market-row" data-kind={m.kind ?? 'match'} onClick={() => go({ name: 'exchange', id: m.id })}>
              <td>{m.title}<div className="small muted">{KIND_LABEL[m.kind ?? 'match']} · Season {m.season}, Round {m.round}{m.live ? ' · live trading' : ''}</div></td>
              <td className="small">{lead}</td>
              <td><span className={`chip ${m.status === 'open' ? 'pos' : m.status === 'settled' ? 'info' : ''}`}>{statusLabel(m.status)}</span></td>
              <td className="hide-sm mono small">{pos && pos.shares.some(x => x) ? `${pos.shares.reduce((a, b) => a + b, 0)} shares` : ''}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/** Generic trade ticket (any claim of any market). Used by the market page and the live spectator. */
export function TradeTicket({ m, compact = false }: { m: Market; compact?: boolean }) {
  const services = useServices();
  const fed = services.fed;
  const st = fed.state!;
  const claims = claimsOf(m);
  const [claim, setClaim] = useState(0);
  const [shares, setShares] = useState(10);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pos = st.positions.get(`${m.id}|player:cash`);
  const cash = fed.balance('player:cash');
  const q = useMemo(() => { try { return { ok: quote(m, claim, shares, side) }; } catch (e) { return { err: (e as Error).message }; } }, [m, claim, shares, side]);
  const holding = pos?.shares[claim] ?? 0;
  const canTrade = m.status === 'open' && !services.readOnly && m.white !== PLAYER_ID && m.black !== PLAYER_ID;
  const tooMuch = q.ok && side === 'buy' && q.ok.total > cash;
  const tooMany = side === 'sell' && shares > holding;
  const version = m.history.length;
  const revision = revisionOf(m);
  const exec = async () => {
    setBusy(true); setMsg(null);
    try { await fed.trade(m.id, claim, shares, side, { expectVersion: version, expectRevision: revision }); setMsg({ kind: 'ok', text: `${side === 'buy' ? 'Bought' : 'Sold'} ${shares} shares of ${claims[claim].label}.` }); }
    catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } finally { setBusy(false); }
  };
  return (
    <div className="panel stack" data-testid="ticket" data-revision={revision}>
      <h3>Trade Ticket</h3>
      {!canTrade && <div className="small notice">{m.status === 'open' ? 'Trading isn’t available here.' : `${statusLabel(m.status)}: trading has ended.`}</div>}
      {msg && <div className={`notice small ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div>}
      <div className="seg" role="group" aria-label="Side"><button aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>Buy</button><button aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Sell</button></div>
      {claims.length <= 3
        ? <div className="seg" role="group" aria-label="Outcome">{claims.map((c, i) => <button key={c.id} aria-pressed={claim === i} onClick={() => setClaim(i)}>{c.label}</button>)}</div>
        : <label className="small">Outcome <select value={claim} onChange={e => setClaim(+e.target.value)} aria-label="Outcome" data-testid="claim-select">{claims.map((c, i) => <option key={c.id} value={i}>{c.label} — {(claimPrices(m)[i] * 100).toFixed(1)}¢</option>)}</select></label>}
      <label className="small">Shares <input type="number" min={1} step={1} value={shares} onChange={e => setShares(Math.max(1, Math.floor(+e.target.value || 1)))} style={{ width: 90 }} aria-label="Shares" /></label>
      {q.ok ? (
        <table className="small"><tbody>
          <tr><td>{side === 'buy' ? 'Cost' : 'Proceeds'}</td><td className="mono">{fmtCrowns(q.ok.amount)}</td></tr>
          <tr><td>Fee (1%)</td><td className="mono">{fmtCrowns(q.ok.fee)}</td></tr>
          <tr><td><strong>{side === 'buy' ? 'You pay' : 'You receive'}</strong></td><td className="mono"><strong>{fmtCrowns(q.ok.total)}</strong></td></tr>
          {!compact && <tr><td>Average price</td><td className="mono">{(q.ok.avgPrice * 100).toFixed(2)}¢</td></tr>}
          <tr><td>Price moves</td><td className="mono">{(q.ok.priceBefore * 100).toFixed(1)}¢ → {(q.ok.priceAfter * 100).toFixed(1)}¢</td></tr>
          {side === 'buy' && <><tr><td>Max payout</td><td className="mono">{fmtCrowns(q.ok.maxPayout)}</td></tr><tr><td>Max loss</td><td className="mono">{fmtCrowns(q.ok.maxLoss)}</td></tr></>}
        </tbody></table>
      ) : <div className="small notice warn">{q.err}</div>}
      {tooMuch && <div className="small notice warn">Not enough cash: you have {fmtCrowns(cash)}.</div>}
      {tooMany && <div className="small notice warn">You only have {holding} {holding === 1 ? 'share' : 'shares'} of this outcome to sell.</div>}
      <button className="btn primary" data-testid="confirm-trade" disabled={!canTrade || busy || !q.ok || tooMuch || tooMany} onClick={exec}>{busy ? 'Placing Trade…' : q.ok ? `Confirm: ${side === 'buy' ? 'Pay' : 'Receive'} ${fmtCrowns(q.ok.total)}` : `Confirm ${side === 'buy' ? 'Buy' : 'Sell'}`}</button>
      <div className="small muted">Cash {fmtCrowns(cash)} · if the price changes before you confirm, the trade is rejected, never filled at a new price.</div>
    </div>
  );
}

function PositionPanel({ m }: { m: Market }) {
  const services = useServices();
  const st = services.fed.state!;
  const pos = st.positions.get(`${m.id}|player:cash`);
  const claims = claimsOf(m);
  return (
    <div className="panel stack">
      <h3>Your Position</h3>
      {!pos || (!pos.shares.some(x => x) && !pos.spent) ? <p className="small muted">No shares in this market yet.</p> : (
        <div className="small">
          {claims.map((c, i) => pos.shares[i] ? <div key={c.id}>{c.label}: <strong>{pos.shares[i]}</strong> {pos.shares[i] === 1 ? 'share' : 'shares'}</div> : null)}
          <div>Spent {fmtCrowns(pos.spent)} (including {fmtCrowns(pos.fees)} fees) · received {fmtCrowns(pos.received)}</div>
          {(m.status === 'open' || m.status === 'closed') && <div>Value if sold now: {fmtCrowns(liquidationValue(m, pos))}{m.status === 'closed' ? ' (trading closed: valued at the cancellation refund)' : ''} · profit or loss if sold now {fmtCrowns(liquidationValue(m, pos) + pos.received - pos.spent)}</div>}
          {m.status === 'settled' && <div>Market Settled · net {fmtCrowns(pos.received - pos.spent)}</div>}
          {m.status === 'cancelled' && <div>Market Cancelled and refunded on its published terms · net {fmtCrowns(pos.received - pos.spent)}</div>}
        </div>
      )}
    </div>
  );
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
      <h3>Paper Forecast</h3>
      <div className="small muted">Free practice, scored when the market resolves. Your numbers are scaled to add up to 100%.</div>
      <div style={{ maxHeight: 260, overflow: 'auto' }}>
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
        <span className="spacer" />
        {kind === 'match' && <button className="btn small" onClick={() => go({ name: 'watch', id: m.fixtureId })}>{m.status === 'settled' ? 'Replay Match' : 'Watch Match'}</button>}
      </div>
      <div className="grid-2">
        <div className="stack">
          {kind === 'match' && <MatchResearch m={m} />}
          <div className="panel stack">
            <h3>Live Odds</h3>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              <table className="small">
                <thead><tr><th>Outcome</th><th>Forecast</th><th>Price</th><th>Difference</th></tr></thead>
                <tbody>{claims.map((c, i) => ({ c, i })).sort((a, b) => (kind === 'bracket' ? 0 : cp[b.i] - cp[a.i])).map(({ c, i }) => (
                  <tr key={c.id}><td>{c.label}{kind === 'bracket' && <div className="muted">pays 1 ₵ in paths {c.states.map(s => s + 1).join(', ')}</div>}</td><td className="mono">{pct(claimModel[i])}</td><td className="mono">{(cp[i] * 100).toFixed(1)}¢</td><td className={`mono ${claimModel[i] - cp[i] > 0.02 ? 'pos' : ''}`}>{((claimModel[i] - cp[i]) * 100).toFixed(1)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            {kind === 'bracket' && <ConditionalTable m={m} />}
            <div className="small muted">Forecast: each outcome's chance from public ratings, for information only. Price: what a share costs now; it moves only when someone trades.</div>
          </div>
          <div className="panel small stack" style={{ gap: 6 }}>
            <div><strong>Rules.</strong> {m.rules ?? 'Outcomes: White wins, draw or Black wins. Trading: until the match starts. Settlement: each winning share pays 1 ₵. Cancellation: 1/3 ₵ per share.'}</div>
            <div>Fee: 1% on every buy and sell. You can never lose more than you pay.</div>
            <details className="small muted"><summary>Details</summary>Priced by an automated market maker (LMSR) over {states.length} outcomes · liquidity b = {m.b} · market maker subsidy {fmtCrowns(m.subsidy, 0)} (worst-case loss b·ln {states.length}) · prices from the {prices(m.q, m.b).length}-state inventory · {MICRO.toLocaleString('en')} µ = 1 ₵ · market revision {revisionOf(m)}.</details>
          </div>
          {(analyst || kind !== 'match') && <div className="panel"><h3>Price History</h3><PriceChart m={m} /></div>}
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
        <tbody>{rows.map(r => <tr key={r.label}><td>{r.label}</td><td className="mono">{(r.joint * 100).toFixed(1)}¢</td><td className="mono">{r.cond === null ? '—' : pct(r.cond)}</td></tr>)}</tbody></table>
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
  const lo = wdl(w.rating - w.rd, b.rating + b.rd), hi = wdl(w.rating + w.rd, b.rating - b.rd);
  const fx = [...st.rounds.values()].flatMap(r => r.fixtures).find(f => f.id === m.fixtureId);
  return (
    <div className="panel stack">
      <h3>Match Research</h3>
      {fx && <div className="small muted">{eventName(fx.event)}{fx.stage ? ` · ${fx.stage}` : ''} · Season {fx.season}, Round {fx.round}</div>}
      {[w, b].map((c, i) => (
        <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
          <Portrait seed={c.portraitSeed} size={44} />
          <div style={{ flex: 1 }}>
            <button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'competitor', id: c.id })}><strong>{c.name}</strong></button> <span className="muted small">({i === 0 ? 'White' : 'Black'})</span>
            <div className="small">{Math.round(c.rating)} ±{Math.round(c.rd)} · form <span className="mono">{c.form || '—'}</span> · {c.stats.w}–{c.stats.d}–{c.stats.l} · {divisionLabel(c.division)}, {REGION_NAMES[c.region]}</div>
            <div className="small muted">Style: {isValidatedStyle(c.style) ? STYLE_LABEL[c.style] : 'Universal'}{c.titles.length ? ` · ${c.titles.length} ${c.titles.length === 1 ? 'title' : 'titles'}` : ''}</div>
          </div>
        </div>
      ))}
      <div className="small">Head-to-head: {h2h.n === 0 ? 'never met before' : `${w.name} ${h2h.a}–${h2h.n - h2h.a} ${b.name} (${h2h.n} ${h2h.n === 1 ? 'game' : 'games'})`}</div>
      <div className="small muted">Forecast from public ratings: White {pct(model[0])} · Draw {pct(model[1])} · Black {pct(model[2])}.</div>
      {analyst ? <div className="small" data-testid="analyst">Analyst Office: White's expected score {(model[0] + model[1] / 2).toFixed(3)} · rating gap {Math.round(w.rating - b.rating)} · White win chance across both ratings' uncertainty {pct(lo.w)}–{pct(hi.w)}.</div>
        : <div className="small muted">An Analyst Office adds a forecast breakdown, a rating-uncertainty range and price history.</div>}
      <details className="small muted"><summary>Details</summary>Forecast model {RESULT_MODEL_ID}: Davidson draw model (ν = {NU}) on public ratings. The uncertainty range uses ±1 rating deviation; it is not a confidence interval of the model.</details>
    </div>
  );
}
