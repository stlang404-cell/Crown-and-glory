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
export const KIND_LABEL: Record<string, string> = { match: 'Match', winner: 'Tournament champion', promotion: 'Promotion', qualification: 'Qualification', season: 'Season title', bracket: 'Conditional · final four', sandbox: 'Sandbox' };
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
  if (!st) return <div className="panel"><h1>Crown Exchange</h1><p>Found the federation first; markets list federation matches, tournaments and seasons.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  if (marketId && st.markets.has(marketId)) return <MarketScreen m={st.markets.get(marketId)!} />;
  const all = [...st.markets.values()].filter(m => !m.sandbox).sort((a, b) => b.season - a.season || b.round - a.round || a.title.localeCompare(b.title));
  const live = all.filter(m => m.status === 'open' || m.status === 'closed');
  const settled = all.filter(m => m.status === 'settled' || m.status === 'cancelled');
  const mine = (m: Market) => st.positions.get(`${m.id}|player:cash`);
  const groups: [string, Market[]][] = [
    ['Matches', live.filter(m => (m.kind ?? 'match') === 'match')],
    ['Tournaments', live.filter(m => m.kind === 'winner')],
    ['Season & league', live.filter(m => m.kind === 'promotion' || m.kind === 'qualification' || m.kind === 'season')],
    ['Conditional (bounded state model)', live.filter(m => m.kind === 'bracket')],
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
      <div className="notice" style={{ marginBottom: 12 }}>Prediction markets on federation events you cannot influence, priced by one automated market maker per event (LMSR). Shares pay 1 ₵ if their outcome happens. All crowns are fictional and non-redeemable. Each market shows its states, closing rule, settlement rule and cancellation terms before you trade.</div>
      {tab === 'markets' && (
        <>
          <div className="grid-2">
            {groups.map(([label, ms]) => (
              <div key={label} className="panel" data-testid={`group-${label}`}>
                <h3>{label}</h3>
                {ms.length === 0 ? <p className="small muted">None open right now.</p> : <MarketTable markets={ms} mine={mine} />}
              </div>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 14 }}>
            <h3>Settled history</h3>
            {settled.length === 0 ? <p className="small muted">Nothing settled yet.</p> : <MarketTable markets={settled.slice(0, 80)} mine={mine} />}
          </div>
        </>
      )}
      {tab === 'forecasts' && (
        <div className="panel stack">
          <h3>Paper forecasts</h3>
          <p className="small">Free, no money. {sum.n === 0 ? 'No scored forecasts yet.' : <>Over {sum.n} resolved forecast{sum.n > 1 ? 's' : ''}: your Brier <strong>{sum.brier!.toFixed(3)}</strong>{sum.priceBrier !== null && <> · market price at the time {sum.priceBrier.toFixed(3)}</>}{sum.modelBrier !== null && <> · public model {sum.modelBrier.toFixed(3)}</>}.</>}</p>
          <button className="btn" onClick={() => go({ name: 'forecasts' })}>Open the forecasting companion</button>
        </div>
      )}
      {tab === 'traders' && (
        <div className="panel">
          <h3>NPC traders</h3>
          <p className="small muted">Funded from the federation treasury, trading through the same market maker as you, on public information only (published model, live engine evaluation, price history). None is guaranteed to profit.</p>
          <table className="small"><thead><tr><th>Trader</th><th>Strategy</th><th>Wallet</th><th>Open exposure</th></tr></thead>
            <tbody>{NPC_TRADERS.map(t => {
              const exp = [...st.positions.values()].filter(p => p.holder === t.id && ['open', 'closed'].includes(st.markets.get(p.marketId)?.status ?? '')).reduce((a, p) => a + Math.max(0, p.spent - p.received), 0);
              return <tr key={t.id}><td>{t.name}</td><td>{t.description}</td><td className="mono">{fmtCrowns(fed.balance(t.id), 0)}</td><td className="mono">{fmtCrowns(exp, 0)}</td></tr>;
            })}</tbody></table>
        </div>
      )}
      <div className="small muted" style={{ marginTop: 8 }}>Exchange {EXCHANGE_ID} · market families {MARKETS_ID} · match forecasts {RESULT_MODEL_ID} on public ratings.</div>
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
          const lead = m.status === 'settled' ? (m.result !== null && m.result >= 0 ? statesOf(m)[m.result] : 'split') : (() => { const i = pr.indexOf(Math.max(...pr)); return `${claims[i].label} ${(pr[i] * 100).toFixed(0)}¢`; })();
          const pos = mine(m);
          return (
            <tr key={m.id} className="clickable" data-testid="market-row" data-kind={m.kind ?? 'match'} onClick={() => go({ name: 'exchange', id: m.id })}>
              <td>{m.title}<div className="small muted">{KIND_LABEL[m.kind ?? 'match']} · S{m.season} R{m.round}{m.live ? ' · in-play' : ''}</div></td>
              <td className="small">{lead}</td>
              <td><span className={`chip ${m.status === 'open' ? 'pos' : m.status === 'settled' ? 'info' : ''}`}>{m.status}</span></td>
              <td className="hide-sm mono small">{pos && pos.shares.some(x => x) ? `${pos.shares.reduce((a, b) => a + b, 0)} sh` : ''}</td>
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
    try { await fed.trade(m.id, claim, shares, side, { expectVersion: version, expectRevision: revision }); setMsg({ kind: 'ok', text: `${side === 'buy' ? 'Bought' : 'Sold'} ${shares} × ${claims[claim].label}.` }); }
    catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } finally { setBusy(false); }
  };
  return (
    <div className="panel stack" data-testid="ticket" data-revision={revision}>
      <h3>Trade ticket</h3>
      {!canTrade && <div className="small notice">{m.status === 'open' ? 'Trading unavailable in this tab.' : `This market is ${m.status}; trading has ended.`}</div>}
      {msg && <div className={`notice small ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div>}
      <div className="seg" role="group" aria-label="Side"><button aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>Buy</button><button aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Sell</button></div>
      {claims.length <= 3
        ? <div className="seg" role="group" aria-label="Outcome">{claims.map((c, i) => <button key={c.id} aria-pressed={claim === i} onClick={() => setClaim(i)}>{c.label}</button>)}</div>
        : <label className="small">Claim <select value={claim} onChange={e => setClaim(+e.target.value)} aria-label="Claim" data-testid="claim-select">{claims.map((c, i) => <option key={c.id} value={i}>{c.label} — {(claimPrices(m)[i] * 100).toFixed(1)}¢</option>)}</select></label>}
      <label className="small">Shares <input type="number" min={1} step={1} value={shares} onChange={e => setShares(Math.max(1, Math.floor(+e.target.value || 1)))} style={{ width: 90 }} aria-label="Shares" /></label>
      {q.ok ? (
        <table className="small"><tbody>
          <tr><td>{side === 'buy' ? 'Cost' : 'Proceeds'}</td><td className="mono">{fmtCrowns(q.ok.amount)}</td></tr>
          <tr><td>Fee (1%)</td><td className="mono">{fmtCrowns(q.ok.fee)}</td></tr>
          <tr><td><strong>{side === 'buy' ? 'You pay' : 'You receive'}</strong></td><td className="mono"><strong>{fmtCrowns(q.ok.total)}</strong></td></tr>
          {!compact && <tr><td>Average price</td><td className="mono">{(q.ok.avgPrice * 100).toFixed(2)}¢</td></tr>}
          <tr><td>Price after</td><td className="mono">{(q.ok.priceBefore * 100).toFixed(1)}¢ → {(q.ok.priceAfter * 100).toFixed(1)}¢</td></tr>
          {side === 'buy' && <><tr><td>Max payout</td><td className="mono">{fmtCrowns(q.ok.maxPayout)}</td></tr><tr><td>Max loss</td><td className="mono">{fmtCrowns(q.ok.maxLoss)}</td></tr></>}
        </tbody></table>
      ) : <div className="small notice warn">{q.err}</div>}
      {tooMuch && <div className="small notice warn">Not enough cash ({fmtCrowns(cash)}).</div>}
      {tooMany && <div className="small notice warn">You hold only {holding} share(s) of this claim (no short selling).</div>}
      <button className="btn primary" data-testid="confirm-trade" disabled={!canTrade || busy || !q.ok || tooMuch || tooMany} onClick={exec}>{busy ? 'Executing…' : `Confirm ${side}`}</button>
      <div className="small muted">Cash {fmtCrowns(cash)} · quote valid for market version {version} (a changed price is rejected, never silently filled)</div>
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
      <h3>Your position</h3>
      {!pos || (!pos.shares.some(x => x) && !pos.spent) ? <p className="small muted">None.</p> : (
        <div className="small">
          {claims.map((c, i) => pos.shares[i] ? <div key={c.id}>{c.label}: <strong>{pos.shares[i]}</strong> share(s)</div> : null)}
          <div>Spent {fmtCrowns(pos.spent)} (incl. fees {fmtCrowns(pos.fees)}) · received {fmtCrowns(pos.received)}</div>
          {(m.status === 'open' || m.status === 'closed') && <div>Executable value now: {fmtCrowns(liquidationValue(m, pos))}{m.status === 'closed' ? ' (closed: cancellation-terms floor)' : ''} · unrealized P&L {fmtCrowns(liquidationValue(m, pos) + pos.received - pos.spent)}</div>}
          {m.status === 'settled' && <div>Settled · net {fmtCrowns(pos.received - pos.spent)}</div>}
          {m.status === 'cancelled' && <div>Cancelled on the published terms · net {fmtCrowns(pos.received - pos.spent)}</div>}
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
      <h3>Paper forecast</h3>
      <div className="small muted">Free and scored with the Brier score when the market resolves. Your inputs are normalised to 100%.</div>
      <div style={{ maxHeight: 260, overflow: 'auto' }}>
        {states.map((o, i) => (
          <label key={i} className="small row" style={{ justifyContent: 'space-between' }}>{o}
            <span className="row"><input type="number" min={0} max={100} value={vals[i]} disabled={m.status !== 'open'} onChange={e => { const v = [...vals]; v[i] = Math.max(0, Math.min(100, +e.target.value || 0)); setVals(v); }} style={{ width: 64 }} aria-label={`${o} forecast`} /><span className="mono" style={{ width: 44, textAlign: 'right' }}>{Math.round((100 * vals[i]) / total)}%</span></span>
          </label>
        ))}
      </div>
      <button className="btn small" data-testid="record-forecast" disabled={m.status !== 'open' || services.readOnly} onClick={() => fed.forecast(m.id, vals).then(() => setMsg('Forecast recorded (locked when the market closes).'), e => setMsg((e as Error).message))}>{existing ? 'Update forecast' : 'Record forecast'}</button>
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
        <span className={`chip ${m.status === 'open' ? 'pos' : 'info'}`} data-testid="market-status">{m.status}</span>
        <span className="spacer" />
        {kind === 'match' && <button className="btn small" onClick={() => go({ name: 'watch', id: m.fixtureId })}>{m.status === 'settled' ? 'Replay match' : 'Watch match'}</button>}
      </div>
      <div className="grid-2">
        <div className="stack">
          {kind === 'match' && <MatchResearch m={m} />}
          <div className="panel stack">
            <h3>{kind === 'bracket' ? 'Claims' : 'Outcomes'} · model vs price</h3>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              <table className="small">
                <thead><tr><th>{kind === 'bracket' ? 'Claim (pays 1 ₵ in each listed path)' : 'State'}</th><th>Model</th><th>Price</th><th>Model − price</th></tr></thead>
                <tbody>{claims.map((c, i) => ({ c, i })).sort((a, b) => (kind === 'bracket' ? 0 : cp[b.i] - cp[a.i])).map(({ c, i }) => (
                  <tr key={c.id}><td>{c.label}{kind === 'bracket' && <div className="muted">paths {c.states.map(s => s + 1).join(', ')}</div>}</td><td className="mono">{pct(claimModel[i])}</td><td className="mono">{(cp[i] * 100).toFixed(1)}¢</td><td className={`mono ${claimModel[i] - cp[i] > 0.02 ? 'pos' : ''}`}>{((claimModel[i] - cp[i]) * 100).toFixed(1)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            {kind === 'bracket' && <ConditionalTable m={m} />}
            <div className="small muted">Model: published public-rating probabilities (information, never the price). Price: what the market maker charges now; it moves only with trades.</div>
          </div>
          <div className="panel small"><strong>Contract terms.</strong> {m.rules ?? 'States: White wins / Draw / Black wins. Trading: until the match starts. Settlement: the result. Cancellation: 1/3 per share.'}<div className="muted" style={{ marginTop: 4 }}>States: {states.length} · b = {m.b} · funded maker subsidy {fmtCrowns(m.subsidy, 0)} (worst-case loss b·ln {states.length}) · fee 1% each way.</div></div>
          {(analyst || kind !== 'match') && <div className="panel"><h3>Price history</h3><PriceChart m={m} /></div>}
        </div>
        <div className="stack">
          <TradeTicket m={m} />
          <PositionPanel m={m} />
          <ForecastPanel m={m} />
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>{MICRO.toLocaleString('en')} µ = 1 ₵ · prices from LMSR {prices(m.q, m.b).length}-state inventory.</div>
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
    <details className="small"><summary>Indicative conditional probabilities</summary>
      <table><thead><tr><th>Final</th><th>Joint price</th><th>P(win | loser reaches final)</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.label}><td>{r.label}</td><td className="mono">{(r.joint * 100).toFixed(1)}¢</td><td className="mono">{r.cond === null ? '—' : pct(r.cond)}</td></tr>)}</tbody></table>
      <div className="muted">The ratio of two prices is not an executable price; you trade the joint (conjunction) claim, which pays 0 if the condition fails.</div>
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
      <h3>Match research</h3>
      {fx && <div className="small muted">{eventName(fx.event)}{fx.stage ? ` · ${fx.stage}` : ''} · season {fx.season}, round {fx.round}</div>}
      {[w, b].map((c, i) => (
        <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
          <Portrait seed={c.portraitSeed} size={44} />
          <div style={{ flex: 1 }}>
            <button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'competitor', id: c.id })}><strong>{c.name}</strong></button> <span className="muted small">({i === 0 ? 'White' : 'Black'})</span>
            <div className="small">{Math.round(c.rating)} ±{Math.round(c.rd)} · form <span className="mono">{c.form || '—'}</span> · {c.stats.w}-{c.stats.d}-{c.stats.l} · {divisionLabel(c.division)}, {REGION_NAMES[c.region]}</div>
            <div className="small muted">Style: {isValidatedStyle(c.style) ? STYLE_LABEL[c.style] : 'Universal'}{c.titles.length ? ` · ${c.titles.length} title(s)` : ''}</div>
          </div>
        </div>
      ))}
      <div className="small">Head-to-head before this match: {h2h.n === 0 ? 'never met' : `${w.name} ${h2h.a} – ${h2h.n - h2h.a} ${b.name} (${h2h.n})`}</div>
      <div className="small muted">Model: {RESULT_MODEL_ID} (Davidson draw model, ν = {NU}) on public ratings: W {pct(model[0])} · D {pct(model[1])} · B {pct(model[2])}.</div>
      {analyst ? <div className="small" data-testid="analyst">Analyst Office · White expected score {(model[0] + model[1] / 2).toFixed(3)} · rating difference {Math.round(w.rating - b.rating)} · White-win probability across ±1 RD: {pct(lo.w)} – {pct(hi.w)} (rating uncertainty, not a model confidence interval).</div>
        : <div className="small muted">An Analyst Office adds the forecast breakdown, rating-uncertainty range and price history.</div>}
    </div>
  );
}
