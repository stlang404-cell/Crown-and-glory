import { useApp, useServices } from './App';
import { scoreAll, summary, calibration, rollingBrier, FORECAST_ID } from '../app/forecasting';
import { statesOf } from '../exchange/market';
import { KIND_LABEL } from './ExchangeScreen';

function CalibrationChart({ bins }: { bins: ReturnType<typeof calibration> }) {
  const W = 300, H = 300, pad = 30;
  const x = (p: number) => pad + p * (W - pad - 8), y = (p: number) => H - pad - p * (H - pad - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label="Calibration: forecast probability against observed frequency">
      <rect x={pad} y={8} width={W - pad - 8} height={H - pad - 8} style={{ fill: 'var(--chart-bg)', stroke: 'var(--chart-grid)' }} />
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} style={{ stroke: 'var(--muted)' }} strokeDasharray="4 4" />
      {bins.filter(b => b.n > 0).map(b => (
        <g key={b.lo}>
          <line x1={x(b.meanP)} x2={x(b.meanP)} y1={y(b.ciLo)} y2={y(b.ciHi)} style={{ stroke: 'var(--info)' }} />
          <circle cx={x(b.meanP)} cy={y(b.freq)} r={Math.min(9, 3 + Math.sqrt(b.n))} style={{ fill: 'var(--accent)' }}><title>{`${(b.lo * 100).toFixed(0)}–${(b.hi * 100).toFixed(0)}%: n=${b.n}, observed ${(b.freq * 100).toFixed(0)}%`}</title></circle>
        </g>
      ))}
      {[0, 0.5, 1].map(t => <text key={t} x={x(t)} y={H - 10} fontSize={10} textAnchor="middle" style={{ fill: 'var(--muted)' }}>{t * 100}%</text>)}
      {[0.5, 1].map(t => <text key={t} x={pad - 4} y={y(t) + 3} fontSize={10} textAnchor="end" style={{ fill: 'var(--muted)' }}>{t * 100}%</text>)}
    </svg>
  );
}

function SkillChart({ rows }: { rows: ReturnType<typeof rollingBrier> }) {
  const W = 560, H = 140;
  if (rows.length < 2) return <div className="small muted">The progression chart starts after two resolved forecasts.</div>;
  const max = Math.max(0.8, ...rows.map(r => Math.max(r.you, r.market ?? 0, r.model ?? 0)));
  const pts = (k: 'you' | 'market' | 'model') => rows.filter(r => r[k] !== null).map(r => `${((r.i - 1) / (rows.length - 1)) * W},${H - ((r[k] as number) / max) * H}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Rolling Brier score (lower is better)">
        <polyline points={pts('model')} fill="none" style={{ stroke: 'var(--muted)' }} strokeDasharray="4 4" strokeWidth={1.5} />
        <polyline points={pts('market')} fill="none" style={{ stroke: 'var(--info)' }} strokeWidth={1.5} />
        <polyline points={pts('you')} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
      </svg>
      <div className="legend" aria-hidden><span><i style={{ background: 'var(--accent)' }} />You</span><span><i style={{ background: 'var(--info)' }} />Market price at forecast time</span><span><i style={{ background: 'var(--muted)' }} />Public model</span></div>
    </div>
  );
}

export function ForecastScreen() {
  const services = useServices();
  const { go } = useApp();
  const st = services.fed.state;
  if (!st) return <div className="panel"><h1>Forecasting</h1><p>Found the federation first.</p></div>;
  const sc = scoreAll(st.extra.forecasts, st.markets);
  const s = summary(sc);
  const bins = calibration(sc);
  const pending = st.extra.forecasts.filter(f => { const m = st.markets.get(f.marketId); return m && (m.status === 'open' || m.status === 'closed'); });
  const tier = s.n < 10 ? 'Apprentice forecaster (fewer than 10 scored)' : s.brier! < (s.modelBrier ?? 1) - 0.02 ? 'Sharp — beating the public model' : s.brier! <= (s.modelBrier ?? 1) + 0.02 ? 'Calibrated — level with the public model' : 'Learning — behind the public model';
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'exchange' })}>← Exchange</button>
        <h1 style={{ margin: 0 }}>Forecasting companion</h1>
      </div>
      <div className="notice" style={{ marginBottom: 12 }}>Record probability forecasts on any open market for free. They lock when the market closes and are scored with proper scoring rules — honest probabilities give the best expected score. A good forecast is not the same as a profitable trade: trading also depends on the price you paid and fees (see Finance).</div>
      <div className="grid-3" data-testid="forecast-summary">
        <div className="panel stat"><span className="k">Scored forecasts</span><span className="v">{s.n}</span><span className="small muted">{pending.length} awaiting resolution</span></div>
        <div className="panel stat"><span className="k">Your Brier (lower is better)</span><span className="v">{s.brier === null ? '—' : s.brier.toFixed(3)}</span><span className="small muted">market at forecast time {s.priceBrier === null ? '—' : s.priceBrier.toFixed(3)} · public model {s.modelBrier === null ? '—' : s.modelBrier.toFixed(3)}</span></div>
        <div className="panel stat"><span className="k">Log score</span><span className="v">{s.log === null ? '—' : s.log.toFixed(3)}</span><span className="small muted">{tier}</span></div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3>Calibration</h3>
          {s.n === 0 ? <p className="small muted">No resolved forecasts yet.</p> : <CalibrationChart bins={bins} />}
          <div className="small muted">Each point pools every state probability you gave within a 10%-wide bin: x = your average probability, y = how often those states happened (bar: 95% Wilson interval). Perfect calibration lies on the dashed line. Small samples are noisy.</div>
        </div>
        <div className="panel">
          <h3>Skill progression</h3>
          <SkillChart rows={rollingBrier(sc)} />
          <div className="small muted">Rolling mean Brier over your last 10 resolved forecasts, against the market price and the public model on the same events.</div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>History</h3>
        {sc.length + pending.length === 0 ? <p className="small muted">No forecasts yet — open any market and use the Paper forecast panel.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="small">
              <thead><tr><th>Market</th><th>Kind</th><th>Your top call</th><th>Resolution</th><th>Brier</th><th className="hide-sm">Market</th><th className="hide-sm">Model</th></tr></thead>
              <tbody>
                {pending.map(f => { const m = st.markets.get(f.marketId)!; const i = f.probs.indexOf(Math.max(...f.probs)); return <tr key={f.marketId} className="clickable" onClick={() => go({ name: 'exchange', id: m.id })}><td>{m.title}</td><td>{KIND_LABEL[m.kind ?? 'match']}</td><td>{statesOf(m)[i]} {(f.probs[i] * 100).toFixed(0)}%</td><td className="muted">pending ({m.status})</td><td>—</td><td className="hide-sm">—</td><td className="hide-sm">—</td></tr>; })}
                {[...sc].reverse().map(x => { const i = x.f.probs.indexOf(Math.max(...x.f.probs)); const w = x.y.indexOf(Math.max(...x.y)); return <tr key={x.f.marketId} className="clickable" onClick={() => go({ name: 'exchange', id: x.market.id })}><td>{x.market.title}</td><td>{KIND_LABEL[x.market.kind ?? 'match']}</td><td>{statesOf(x.market)[i]} {(x.f.probs[i] * 100).toFixed(0)}%</td><td>{statesOf(x.market)[w]}</td><td className="mono">{x.brier.toFixed(3)}</td><td className="hide-sm mono">{x.priceBrier?.toFixed(3) ?? '—'}</td><td className="hide-sm mono">{x.modelBrier?.toFixed(3) ?? '—'}</td></tr>; })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>{FORECAST_ID}: Brier = Σ(p − y)², log = −ln p(outcome) (p floored at 0.001); cancelled markets are not scored; forecast skill is separate from chess and financial prestige.</div>
    </div>
  );
}
