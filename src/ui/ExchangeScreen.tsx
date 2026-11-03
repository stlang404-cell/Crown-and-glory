import { useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { eventName } from '../app/federation';
import { prices } from '../exchange/lmsr';
import { OUTCOMES, quote, liquidationValue, EXCHANGE_ID } from '../exchange/market';
import type { Market } from '../exchange/market';
import { fmtCrowns, MICRO } from '../exchange/ledger';
import { wdl, NU, RESULT_MODEL_ID } from '../federation/resultModel';
import { REGION_NAMES, divisionLabel, PLAYER_ID } from '../federation/model';
import { STYLE_LABEL, isValidatedStyle } from '../engine/styles';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const brier = (p: number[], o: number) => p.reduce((s, x, i) => s + (x - (i === o ? 1 : 0)) ** 2, 0);

function PriceChart({ m }: { m: Market }) {
  const W = 520, H = 120;
  const h = m.history;
  if (h.length < 2) return <div className="small muted">Not enough trades for a chart yet.</div>;
  const colors = ['var(--text)', 'var(--muted)', 'var(--accent)'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Price history">
      {[0.25, 0.5, 0.75].map(y => <line key={y} x1={0} x2={W} y1={H - y * H} y2={H - y * H} stroke="var(--line)" />)}
      {[0, 1, 2].map(i => <polyline key={i} fill="none" stroke={colors[i]} strokeWidth={2} points={h.map((p, k) => `${(k / (h.length - 1)) * W},${H - p.prices[i] * H}`).join(' ')} />)}
    </svg>
  );
}

export function ExchangeScreen({ marketId }: { marketId?: string }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  if (!st) return <div className="panel"><h1>Crown Exchange</h1><p>Found the federation first; markets list featured federation matches.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  if (marketId && st.markets.has(marketId)) return <MarketScreen m={st.markets.get(marketId)!} />;
  const all = [...st.markets.values()].filter(m => !m.sandbox).sort((a, b) => b.season - a.season || b.round - a.round);
  const open = all.filter(m => m.status === 'open' || m.status === 'closed');
  const settled = all.filter(m => m.status === 'settled' || m.status === 'cancelled');
  const mine = (m: Market) => st.positions.get(`${m.id}|player:cash`);
  const fc = st.extra.forecasts.filter(f => f.outcome !== null);
  const myBrier = fc.length ? fc.reduce((s, f) => s + brier(f.probs, f.outcome!), 0) / fc.length : null;
  const modelBrier = fc.length ? fc.reduce((s, f) => { const m = st.markets.get(f.marketId)!; return s + brier([m.forecast.w, m.forecast.d, m.forecast.l], f.outcome!); }, 0) / fc.length : null;
  return (
    <div>
      <h1>Crown Exchange</h1>
      <div className="notice" style={{ marginBottom: 12 }}>Forecast markets on featured AI-vs-AI federation matches, priced by an automated market maker (LMSR, liquidity b = 120). Shares pay 1 ₵ if their outcome happens. All crowns are fictional and non-redeemable; nothing here involves real money. Markets close before a match starts; your own games are never listed.</div>
      <div className="grid-2">
        <div className="panel">
          <h3>Open and closed markets</h3>
          {open.length === 0 ? <p className="small muted">No markets this round.</p> : <MarketTable markets={open} mine={mine} />}
        </div>
        <div className="panel stack">
          <h3>Paper forecasts</h3>
          <p className="small muted">Free, no money: record a probability forecast on any open market; it is scored with the Brier score (lower is better) when the market settles.</p>
          {fc.length === 0 ? <p className="small">No scored forecasts yet.</p> : <p className="small">Your Brier score over {fc.length} forecast{fc.length > 1 ? 's' : ''}: <strong>{myBrier!.toFixed(3)}</strong> vs the public-rating model's {modelBrier!.toFixed(3)} on the same matches.</p>}
          <h3>Sandbox Exchange</h3>
          <p className="small muted">A separate practice exchange on your own casual games is planned for v0.4.0 (see docs). It is not implemented yet.</p>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Settled history</h3>
        {settled.length === 0 ? <p className="small muted">Nothing settled yet.</p> : <MarketTable markets={settled.slice(0, 60)} mine={mine} />}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>Exchange {EXCHANGE_ID} · forecasts {RESULT_MODEL_ID} on public ratings.</div>
    </div>
  );
}

function MarketTable({ markets, mine }: { markets: Market[]; mine: (m: Market) => { shares: number[] } | undefined }) {
  const { go } = useApp();
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr><th>Match</th><th className="hide-sm">Event</th><th>W / D / B</th><th>Status</th><th className="hide-sm">You</th></tr></thead>
        <tbody>{markets.map(m => {
          const p = prices(m.q, m.b);
          const pos = mine(m);
          return (
            <tr key={m.id} className="clickable" data-testid="market-row" onClick={() => go({ name: 'exchange', id: m.id })}>
              <td>{m.title}<div className="small muted">S{m.season} R{m.round}</div></td>
              <td className="hide-sm small">{eventName(m.fixtureId.split(':').slice(2, -1).join(':'))}</td>
              <td className="mono small">{m.status === 'settled' ? OUTCOMES[m.result!] : p.map(x => (x * 100).toFixed(0)).join(' / ')}</td>
              <td><span className={`chip ${m.status === 'open' ? 'pos' : m.status === 'settled' ? 'info' : ''}`}>{m.status}</span></td>
              <td className="hide-sm mono small">{pos && pos.shares.some(x => x) ? pos.shares.join('/') : ''}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function MarketScreen({ m }: { m: Market }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state!;
  const [outcome, setOutcome] = useState(0);
  const [shares, setShares] = useState(10);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const existing = st.extra.forecasts.find(f => f.marketId === m.id);
  const [fcast, setFcast] = useState<number[]>(existing ? existing.probs.map(x => Math.round(x * 100)) : [Math.round(m.forecast.w * 100), Math.round(m.forecast.d * 100), Math.round(m.forecast.l * 100)]);
  const p = prices(m.q, m.b);
  const pos = st.positions.get(`${m.id}|player:cash`);
  const cash = fed.balance('player:cash');
  const analyst = fed.ownsAsset('analyst');
  const w = st.competitors.get(m.white)!, b = st.competitors.get(m.black)!;
  const q = useMemo(() => { try { return { ok: quote(m, outcome, shares, side) }; } catch (e) { return { err: (e as Error).message }; } }, [m, outcome, shares, side]);
  const holding = pos?.shares[outcome] ?? 0;
  const canTrade = m.status === 'open' && !services.readOnly && m.white !== PLAYER_ID && m.black !== PLAYER_ID;
  const tooMuch = q.ok && side === 'buy' && q.ok.total > cash;
  const tooMany = side === 'sell' && shares > holding;
  // head-to-head from stored rounds (summary results included)
  const h2h = useMemo(() => {
    let a = 0, n = 0;
    for (const r of st.rounds.values()) {
      for (const [, x, y, res] of r.abstract) if (res !== null && ((x === m.white && y === m.black) || (x === m.black && y === m.white))) { n++; a += x === m.white ? res : 1 - res; }
      for (const f of r.fixtures) if (f.result !== null && f.id !== m.fixtureId && ((f.white === m.white && f.black === m.black) || (f.white === m.black && f.black === m.white))) { n++; a += f.white === m.white ? f.result : 1 - f.result; }
    }
    return { a, n };
  }, [st, m]);
  const band = useMemo(() => {
    const lo = wdl(w.rating - w.rd, b.rating + b.rd), hi = wdl(w.rating + w.rd, b.rating - b.rd);
    return { lo: lo.w, hi: hi.w };
  }, [w, b]);
  const exec = async () => {
    setBusy(true); setMsg(null);
    try { await fed.trade(m.id, outcome, shares, side); setMsg({ kind: 'ok', text: `${side === 'buy' ? 'Bought' : 'Sold'} ${shares} × ${OUTCOMES[outcome]}.` }); } catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } finally { setBusy(false); }
  };
  const model = [m.forecast.w, m.forecast.d, m.forecast.l];
  const settledShown = m.status === 'settled';
  return (
    <div>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn ghost small" onClick={() => go({ name: 'exchange' })}>← Exchange</button>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{m.title}</h1>
        <span className={`chip ${m.status === 'open' ? 'pos' : 'info'}`} data-testid="market-status">{m.status}</span>
        <span className="spacer" />
        <button className="btn small" onClick={() => go({ name: 'watch', id: m.fixtureId })}>{m.status === 'settled' ? 'Replay match' : 'Watch match'}</button>
      </div>
      {msg && <div className={`notice ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div>}
      <div className="grid-2">
        <div className="panel stack">
          <h3>Match research</h3>
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
          <table>
            <thead><tr><th></th>{OUTCOMES.map(o => <th key={o}>{o}</th>)}</tr></thead>
            <tbody>
              <tr><td className="small">Model probability</td>{model.map((x, i) => <td key={i} className="mono">{pct(x)}</td>)}</tr>
              <tr><td className="small">Market price</td>{p.map((x, i) => <td key={i} className="mono">{(x * 100).toFixed(1)}¢</td>)}</tr>
              <tr><td className="small">Model − price</td>{p.map((x, i) => <td key={i} className={`mono ${model[i] - x > 0.02 ? 'pos' : ''}`}>{((model[i] - x) * 100).toFixed(1)}</td>)}</tr>
            </tbody>
          </table>
          <div className="small muted">Model probability: {RESULT_MODEL_ID} (Davidson draw model, ν = {NU}) on the two public ratings. Market price: what the market maker charges now; it moves with trades. They are different numbers. Fees are 1% of each trade.</div>
          {analyst ? (
            <div className="stack" data-testid="analyst">
              <strong>Analyst Office</strong>
              <div className="small">White expected score {(model[0] + model[1] / 2).toFixed(3)} · rating difference {Math.round(w.rating - b.rating)} · White-win probability across ±1 RD: {pct(band.lo)} – {pct(band.hi)} (rating uncertainty, not a confidence interval of the model).</div>
              <PriceChart m={m} />
              <div className="small muted">Price history (White / Draw / Black) over {m.history.length} trade(s).</div>
            </div>
          ) : <div className="small muted">An Analyst Office (Finance → Assets) adds the forecast breakdown, rating-uncertainty range and price history.</div>}
        </div>
        <div className="stack">
          <div className="panel stack" data-testid="ticket">
            <h3>Trade ticket</h3>
            {!canTrade && <div className="small notice">{m.status === 'open' ? 'Trading unavailable in this tab.' : `This market is ${m.status}; trading has ended.`}</div>}
            <div className="seg" role="group" aria-label="Side"><button aria-pressed={side === 'buy'} onClick={() => setSide('buy')}>Buy</button><button aria-pressed={side === 'sell'} onClick={() => setSide('sell')}>Sell</button></div>
            <div className="seg" role="group" aria-label="Outcome">{OUTCOMES.map((o, i) => <button key={o} aria-pressed={outcome === i} onClick={() => setOutcome(i)}>{o}</button>)}</div>
            <label className="small">Shares <input type="number" min={1} step={1} value={shares} onChange={e => setShares(Math.max(1, Math.floor(+e.target.value || 1)))} style={{ width: 90 }} aria-label="Shares" /></label>
            {q.ok ? (
              <table className="small"><tbody>
                <tr><td>{side === 'buy' ? 'Cost' : 'Proceeds'}</td><td className="mono">{fmtCrowns(q.ok.amount)}</td></tr>
                <tr><td>Fee (1%)</td><td className="mono">{fmtCrowns(q.ok.fee)}</td></tr>
                <tr><td><strong>{side === 'buy' ? 'You pay' : 'You receive'}</strong></td><td className="mono"><strong>{fmtCrowns(q.ok.total)}</strong></td></tr>
                <tr><td>Average price</td><td className="mono">{(q.ok.avgPrice * 100).toFixed(2)}¢</td></tr>
                <tr><td>Price after</td><td className="mono">{(q.ok.priceBefore * 100).toFixed(1)}¢ → {(q.ok.priceAfter * 100).toFixed(1)}¢</td></tr>
                {side === 'buy' && <><tr><td>Max payout</td><td className="mono">{fmtCrowns(q.ok.maxPayout)}</td></tr><tr><td>Max loss</td><td className="mono">{fmtCrowns(q.ok.maxLoss)}</td></tr></>}
              </tbody></table>
            ) : <div className="small notice warn">{q.err}</div>}
            {tooMuch && <div className="small notice warn">Not enough cash ({fmtCrowns(cash)}).</div>}
            {tooMany && <div className="small notice warn">You hold only {holding} share(s) of this outcome (no short selling).</div>}
            <button className="btn primary" data-testid="confirm-trade" disabled={!canTrade || busy || !q.ok || tooMuch || tooMany} onClick={exec}>{busy ? 'Executing…' : `Confirm ${side}`}</button>
            <div className="small muted">Cash {fmtCrowns(cash)}</div>
          </div>
          <div className="panel stack">
            <h3>Your position</h3>
            {!pos || (!pos.shares.some(x => x) && !pos.spent) ? <p className="small muted">None.</p> : (
              <div className="small">
                {OUTCOMES.map((o, i) => <div key={o}>{o}: <strong>{pos.shares[i]}</strong> share(s)</div>)}
                <div>Spent {fmtCrowns(pos.spent)} (incl. fees {fmtCrowns(pos.fees)}) · received {fmtCrowns(pos.received)}</div>
                {m.status === 'open' && <div>Sell-everything value now: {fmtCrowns(liquidationValue(m, pos))}</div>}
                {m.status === 'closed' && <div>Trading closed; awaiting the result.</div>}
                {settledShown && <div>Settled on <strong>{OUTCOMES[m.result!]}</strong> · net {fmtCrowns(pos.received - pos.spent)}</div>}
              </div>
            )}
          </div>
          <div className="panel stack">
            <h3>Paper forecast</h3>
            {OUTCOMES.map((o, i) => (
              <label key={o} className="small row">{o}<input type="range" min={0} max={100} value={fcast[i]} disabled={m.status !== 'open'} onChange={e => { const v = [...fcast]; v[i] = +e.target.value; setFcast(v); }} aria-label={`${o} forecast`} /><span className="mono">{Math.round((100 * fcast[i]) / Math.max(1, fcast.reduce((a, x) => a + x, 0)))}%</span></label>
            ))}
            <button className="btn small" disabled={m.status !== 'open' || services.readOnly} onClick={() => fed.forecast(m.id, fcast).then(() => setMsg({ kind: 'ok', text: 'Forecast recorded.' }), e => setMsg({ kind: 'warn', text: (e as Error).message }))}>{existing ? 'Update forecast' : 'Record forecast'}</button>
            {existing && existing.outcome !== null && <div className="small">Brier score: {brier(existing.probs, existing.outcome).toFixed(3)}</div>}
          </div>
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>Market b = {m.b} · subsidy {fmtCrowns(m.subsidy, 0)} from the federation treasury (the market maker's maximum possible loss is b·ln 3 ≈ {(m.b * Math.log(3)).toFixed(1)} ₵) · {MICRO.toLocaleString('en')} µ = 1 ₵.</div>
    </div>
  );
}
