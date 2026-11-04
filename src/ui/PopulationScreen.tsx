/**
 * Federation population analytics (v0.10): the whole federation's public ratings from saved data — counts per band,
 * distribution, mean and median, your percentile, top competitors, the strongest of each division and the rating
 * movement over the seasons stored in competitors' histories (src/app/population.ts).
 */
import { useEffect, useMemo, useState } from 'react';
import { NeedsFederation } from './NeedsFederation';
import { useApp, useServices } from './App';
import { DIVISIONS, divisionLabel, regionName } from '../federation/model';
import { RATING_BANDS, populationStats } from '../app/population';
import { displayElo, gamesToEstablish, isEstablished } from '../ratings/career';

const fmt = (x: number) => Math.round(x).toLocaleString('en');

export function PopulationScreen() {
  const services = useServices();
  const { go } = useApp();
  const st = services.fed.state;
  const [mine, setMine] = useState<number | null>(null);
  // percentiles compare you with the field: only for an established rating (docs/CAREER_RATING.md)
  const [prov, setProv] = useState<{ rating: number; games: number } | null>(null);
  useEffect(() => { void services.db.ratingState('rapid').then(p => { const est = isEstablished(p.games, p.rd); setMine(est ? p.rating : null); setProv(est ? null : { rating: p.rating, games: p.games }); }).catch(() => setMine(null)); }, [services, services.revision]);
  const stats = useMemo(() => (st ? populationStats(st.competitors.values(), mine, DIVISIONS) : null), [st, mine, services.revision]);
  if (!st || !stats) return <NeedsFederation />;
  const maxBand = Math.max(1, ...stats.bands);
  const seasons = stats.seasons;
  const W = 600, H = 140;
  const lo = Math.min(...seasons.map(s => Math.min(s.mean, s.median)), stats.mean, stats.median) - 50;
  const hi = Math.max(...seasons.map(s => Math.max(s.mean, s.median)), stats.mean, stats.median) + 50;
  const pts = [...seasons.map(s => ({ label: `S${s.season}`, mean: s.mean, median: s.median })), { label: 'Now', mean: stats.mean, median: stats.median }];
  const x = (i: number) => (pts.length < 2 ? W / 2 : 20 + (i * (W - 40)) / (pts.length - 1));
  const y = (v: number) => H - 16 - ((v - lo) / Math.max(1, hi - lo)) * (H - 32);
  const line = (k: 'mean' | 'median') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  return (
    <div data-testid="population">
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0 }}>Federation Population</h1>
        <span className="chip">{fmt(stats.active)} Active · {fmt(stats.onRecord)} on Record</span>
      </div>
      <p className="small muted">Public federation ratings (Glicko-2) from your saved federation. Hidden playing strengths are never shown.</p>
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div className="panel stat"><span className="k">Active Competitors</span><span className="v">{fmt(stats.active)}</span><span className="small muted">{fmt(stats.retired)} retired · {fmt(stats.reserve)} reserve</span></div>
        <div className="panel stat"><span className="k">Mean Rating</span><span className="v mono">{fmt(stats.mean)}</span></div>
        <div className="panel stat"><span className="k">Median Rating</span><span className="v mono">{fmt(stats.median)}</span><span className="small muted">range {fmt(stats.min)}–{fmt(stats.max)}</span></div>
        <div className="panel stat" data-testid="player-percentile"><span className="k">Your Percentile</span><span className="v mono">{stats.playerPercentile === null ? '—' : `${stats.playerPercentile.toFixed(1)}%`}</span><span className="small muted">{mine === null ? (prov ? `Your career Elo ${displayElo(prov.rating)} is provisional; your percentile appears once it is established (${gamesToEstablish(prov.games)} more rated games at least, ±100).` : 'Play a rated rapid game to get a rating.') : `Your rating ${fmt(mine)} is above ${stats.playerPercentile!.toFixed(1)}% of active competitors.`}</span></div>
      </div>
      <section className="panel stack" data-testid="rating-bands">
        <h3 style={{ margin: 0 }}>Rating Distribution</h3>
        <svg viewBox={`0 0 ${W} 220`} role="img" aria-label="Active competitors per rating band" style={{ width: '100%', height: 'auto', maxHeight: 260 }}>
          {stats.bands.map((n, i) => {
            const bw = (W - 20) / stats.bands.length, h = (n / maxBand) * 160;
            return (
              <g key={i}>
                <rect x={10 + i * bw + 3} y={180 - h} width={bw - 6} height={Math.max(h, n ? 1 : 0)} style={{ fill: 'var(--accent)' }} rx={2} />
                <text x={10 + i * bw + bw / 2} y={174 - h} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 11 }}>{n ? fmt(n) : ''}</text>
                <text x={10 + i * bw + bw / 2} y={198} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 10 }}>{RATING_BANDS[i].label}</text>
              </g>
            );
          })}
          <line x1="10" x2={W - 10} y1="180" y2="180" style={{ stroke: 'var(--line-strong)' }} />
        </svg>
        <div style={{ overflowX: 'auto' }}>
          <table className="small"><thead><tr><th>Band</th><th>Competitors</th><th>Share</th></tr></thead>
            <tbody>{stats.bands.map((n, i) => <tr key={i}><td>{RATING_BANDS[i].label}</td><td className="mono">{fmt(n)}</td><td className="mono">{stats.active ? ((100 * n) / stats.active).toFixed(1) : '0.0'}%</td></tr>)}</tbody></table>
        </div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
        <section className="panel" data-testid="top-competitors">
          <h3>Top Competitors</h3>
          <table className="small"><thead><tr><th>#</th><th>Competitor</th><th>Rating</th></tr></thead>
            <tbody>{stats.top.map((c, i) => <tr key={c.id} className="clickable" onClick={() => go({ name: 'competitor', id: c.id })}><td>{i + 1}</td><td>{c.name}<div className="muted">{divisionLabel(c.division)} · {regionName(c.region)}</div></td><td className="mono">{fmt(c.rating)}</td></tr>)}</tbody></table>
        </section>
        <section className="panel" data-testid="strongest-per-division">
          <h3>Strongest in Each Division</h3>
          <table className="small"><thead><tr><th>Division</th><th>Competitor</th><th>Rating</th></tr></thead>
            <tbody>{stats.strongestPerDivision.map((c, i) => <tr key={i} className={c ? 'clickable' : ''} onClick={() => c && go({ name: 'competitor', id: c.id })}><td>{divisionLabel(i + 1)}</td><td>{c ? <>{c.name}<div className="muted">{regionName(c.region)}</div></> : '—'}</td><td className="mono">{c ? fmt(c.rating) : ''}</td></tr>)}</tbody></table>
        </section>
      </div>
      <section className="panel stack" style={{ marginTop: 12 }} data-testid="rating-movement">
        <h3 style={{ margin: 0 }}>Rating Movement over Seasons</h3>
        {seasons.length === 0 ? <p className="small muted">The first season is still running. Season-end ratings appear here after each season.</p> : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mean and median rating at the end of each season and now" style={{ width: '100%', height: 'auto', maxHeight: 180 }}>
              <path d={line('mean')} style={{ fill: 'none', stroke: 'var(--accent)' }} strokeWidth={2} />
              <path d={line('median')} style={{ fill: 'none', stroke: 'var(--muted)' }} strokeWidth={2} strokeDasharray="5 4" />
              {pts.map((p, i) => <text key={p.label} x={x(i)} y={H - 2} textAnchor="middle" style={{ fill: 'var(--muted)', fontSize: 10 }}>{p.label}</text>)}
            </svg>
            <div className="small muted">Solid: mean. Dashed: median. Season points use the rating stored at each season's end (competitors in the leagues that season).</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="small"><thead><tr><th>Season</th><th>Competitors</th><th>Mean</th><th>Median</th>{RATING_BANDS.map(b => <th key={b.label} className="hide-sm">{b.label}</th>)}</tr></thead>
                <tbody>{seasons.map(s => <tr key={s.season}><td>{s.season}</td><td className="mono">{fmt(s.count)}</td><td className="mono">{fmt(s.mean)}</td><td className="mono">{fmt(s.median)}</td>{s.bands.map((n, i) => <td key={i} className="hide-sm mono">{fmt(n)}</td>)}</tr>)}</tbody></table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
