import { scrollRegion } from './scrollRegion';
import { NeedsFederation } from './NeedsFederation';
import { useApp, useServices } from './App';
import { scoreAll, summary, calibration, rollingBrier, FORECAST_ID } from '../app/forecasting';
import { statesOf } from '../exchange/market';
import { KIND_LABEL, statusLabel } from './ExchangeScreen';
import { useState } from 'react';
import { leagueTable, leagueSeasons, calibrationGrade, MIN_FORECASTS, CAL_MIN_PAIRS, LEAGUE_ID } from '../app/forecastLeague';
import type { Market } from '../exchange/market';
import type { ForecastRecord } from '../app/forecasting';

/** Season league table against simulated forecasters on the same markets and information, plus the calibration grade. */
function ForecastLeague({ forecasts, markets, season }: { forecasts: ForecastRecord[]; markets: Map<string, Market>; season: number }) {
  const seasons = leagueSeasons(forecasts, markets);
  const [sel, setSel] = useState<number>(seasons[0] ?? season);
  const t = leagueTable(forecasts, markets, sel);
  const cal = calibrationGrade(forecasts, markets);
  return (
    <div className="grid-2" style={{ marginTop: 14 }}>
      <div className="panel" data-testid="forecast-league">
        <div className="panel-title"><h2 className="h3" style={{ margin: 0 }}>Forecasting League</h2>
          {seasons.length > 1 && <select aria-label="Season" value={sel} onChange={e => setSel(+e.target.value)}>{seasons.map(x => <option key={x} value={x}>Season {x}</option>)}</select>}
        </div>
        <div className="small muted">Your resolved forecasts of season {sel} against simulated forecasters. Each forecasts exactly the markets you did, from the public forecast and prices at the moment you forecast — never later information. Lower Brier is better.</div>
        {t.n === 0 ? <p className="small muted">No resolved forecasts this season yet.</p> : (
          <table className="small"><thead><tr><th>#</th><th>Forecaster</th><th>Brier</th></tr></thead>
            <tbody>{t.rows.map(r => <tr key={r.id} style={r.id === 'you' ? { fontWeight: 700 } : undefined} title={r.description}><td className="mono">{r.rank}</td><td>{r.name}</td><td className="mono">{r.brier.toFixed(3)}</td></tr>)}</tbody></table>
        )}
        <div className="small">{t.qualified ? <>You rank <strong>{t.youRank}</strong> of {t.rows.length}{t.skillVsPrice !== null && <> · skill against the market price {(t.skillVsPrice * 100).toFixed(1)}%</>}.</> : <>Rank needs at least {MIN_FORECASTS} resolved forecasts this season ({t.n} so far).</>}</div>
      </div>
      <div className="panel" data-testid="calibration-challenge">
        <h2 className="h3">Calibration Challenge</h2>
        <div className="small">{cal.grade === 'Unrated' ? <>Unrated: the grade needs {CAL_MIN_PAIRS} probabilities from resolved forecasts ({cal.pairs} so far).</> : <><strong>{cal.grade}</strong> · expected calibration error {(cal.ece! * 100).toFixed(1)} points over {cal.pairs} probabilities{cal.direction && cal.direction !== 'balanced' ? ` · leaning ${cal.direction}` : ''}.</>}</div>
        <div className="small muted">Expected calibration error is the average gap between the chances you gave and how often those outcomes happened (weighted by how many fall in each 10% bin). Well calibrated: up to 5 points; fairly: up to 10. Practice only: no money and no prestige.</div>
        <details className="small muted"><summary>Details</summary>{LEAGUE_ID}. The simulated forecasters are formulas, not people: the published public forecast, the market price, an overconfident and an underconfident version of the forecast, a favourite-backer, a seeded noisy novice and equal chances.</details>
      </div>
    </div>
  );
}

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
      <div className="legend" aria-hidden><span><i style={{ background: 'var(--accent)' }} />You</span><span><i style={{ background: 'var(--info)' }} />Market Price</span><span><i style={{ background: 'var(--muted)' }} />Public Forecast</span></div>
    </div>
  );
}

export function ForecastScreen() {
  const services = useServices();
  const { go } = useApp();
  const st = services.fed.state;
  if (!st) return <NeedsFederation title="Forecasting" />;
  const sc = scoreAll(st.extra.forecasts, st.markets);
  const s = summary(sc);
  const bins = calibration(sc);
  const pending = st.extra.forecasts.filter(f => { const m = st.markets.get(f.marketId); return m && (m.status === 'open' || m.status === 'closed'); });
  const tier = s.n < 10 ? 'Apprentice: fewer than 10 scored' : s.brier! < (s.modelBrier ?? 1) - 0.02 ? 'Sharp: beating the public forecast' : s.brier! <= (s.modelBrier ?? 1) + 0.02 ? 'Calibrated: level with the public forecast' : 'Learning: behind the public forecast';
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'exchange' })}>← Exchange</button>
        <h1 style={{ margin: 0 }}>Forecasting</h1>
      </div>
      <div className="notice" style={{ marginBottom: 12 }}>Forecast any open market for free. Forecasts lock when trading closes and are scored when the market resolves; honest probabilities score best. A good forecast isn't the same as a profitable trade, which also depends on the price and fees.</div>
      <div className="grid-3" data-testid="forecast-summary">
        <div className="panel stat"><span className="k">Scored Forecasts</span><span className="v">{s.n}</span><span className="small muted">{pending.length} awaiting resolution</span></div>
        <div className="panel stat"><span className="k">Your Brier Score</span><span className="v">{s.brier === null ? '—' : s.brier.toFixed(3)}</span><span className="small muted">lower is better · market price {s.priceBrier === null ? '—' : s.priceBrier.toFixed(3)} · public forecast {s.modelBrier === null ? '—' : s.modelBrier.toFixed(3)}</span></div>
        <div className="panel stat"><span className="k">Log Score</span><span className="v">{s.log === null ? '—' : s.log.toFixed(3)}</span><span className="small muted">{tier}</span></div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h2 className="h3">Calibration</h2>
          {s.n === 0 ? <p className="small muted">No resolved forecasts yet.</p> : <CalibrationChart bins={bins} />}
          <div className="small muted">How often things you called at a given chance actually happened. Points on the dashed line are perfectly calibrated; small samples are noisy.</div>
          <details className="small muted"><summary>Details</summary>Each point pools every outcome probability you gave within a 10%-wide bin: x = your average probability, y = how often those outcomes happened (bar: 95% Wilson interval).</details>
        </div>
        <div className="panel">
          <h2 className="h3">Skill Progression</h2>
          <SkillChart rows={rollingBrier(sc)} />
          <div className="small muted">Your average Brier score over your last 10 resolved forecasts, compared with the market price and the public forecast on the same events.</div>
        </div>
      </div>
      <ForecastLeague forecasts={st.extra.forecasts} markets={st.markets} season={st.world.season} />
      <div className="panel" style={{ marginTop: 14 }}>
        <h2 className="h3">History</h2>
        {sc.length + pending.length === 0 ? <p className="small muted" data-testid="forecast-empty">No forecasts yet. Open any market and use the Paper Forecast panel. <button className="btn small" onClick={() => go({ name: 'exchange' })}>Open the Exchange</button></p> : (
          <div style={{ overflowX: 'auto' }} ref={scrollRegion('Forecast history')}>
            <table className="small">
              <thead><tr><th>Market</th><th>Type</th><th>Your Top Call</th><th>Result</th><th>Brier</th><th className="hide-sm">Market</th><th className="hide-sm">Public</th></tr></thead>
              <tbody>
                {pending.map(f => { const m = st.markets.get(f.marketId)!; const i = f.probs.indexOf(Math.max(...f.probs)); return <tr key={f.marketId} className="clickable" onClick={() => go({ name: 'exchange', id: m.id })}><td>{m.title}</td><td>{KIND_LABEL[m.kind ?? 'match']}</td><td>{statesOf(m)[i]} {(f.probs[i] * 100).toFixed(0)}%</td><td className="muted">Pending · {statusLabel(m.status)}</td><td>—</td><td className="hide-sm">—</td><td className="hide-sm">—</td></tr>; })}
                {[...sc].reverse().map(x => { const i = x.f.probs.indexOf(Math.max(...x.f.probs)); const w = x.y.indexOf(Math.max(...x.y)); return <tr key={x.f.marketId} className="clickable" onClick={() => go({ name: 'exchange', id: x.market.id })}><td>{x.market.title}</td><td>{KIND_LABEL[x.market.kind ?? 'match']}</td><td>{statesOf(x.market)[i]} {(x.f.probs[i] * 100).toFixed(0)}%</td><td>{statesOf(x.market)[w]}</td><td className="mono">{x.brier.toFixed(3)}</td><td className="hide-sm mono">{x.priceBrier?.toFixed(3) ?? '—'}</td><td className="hide-sm mono">{x.modelBrier?.toFixed(3) ?? '—'}</td></tr>; })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>Cancelled markets aren't scored. Forecasting skill is separate from chess and financial prestige.</div>
      <details className="small muted"><summary>Details</summary>{FORECAST_ID}: Brier = Σ(p − y)², log = −ln p(outcome) (p floored at 0.001).</details>
    </div>
  );
}
