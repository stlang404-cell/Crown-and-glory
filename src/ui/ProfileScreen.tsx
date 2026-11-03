import { useEffect, useState } from 'react';
import { useApp, useServices } from './App';
import { RatingChart } from './Charts';
import type { PoolId, GameRecord } from '../games/types';
import type { PoolState, RatingEvent } from '../ratings/ledger';
import { explainEvent, newPoolState, RANKS, rankFor, RANK_POLICY } from '../ratings/ledger';
import { isProvisional } from '../ratings/glicko2';

const POOLS: PoolId[] = ['rapid', 'blitz', 'classical'];

export function ProfileScreen() {
  const services = useServices();
  const { go } = useApp();
  const [pool, setPool] = useState<PoolId>('rapid');
  const [states, setStates] = useState<Record<string, PoolState>>({});
  const [events, setEvents] = useState<RatingEvent[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [window_, setWindow] = useState<'10' | '30' | '100' | 'all'>('all');

  useEffect(() => {
    void (async () => {
      const st = await services.db.allRatingStates();
      setStates(Object.fromEntries(st.map(s => [s.pool, s])));
      setEvents(await services.db.ratingEvents());
      setGames(await services.db.allGames());
    })();
  }, [services, services.revision]);

  const s = states[pool] ?? newPoolState(pool);
  const ev = events.filter(e => e.pool === pool).sort((a, b) => a.sequence - b.sequence);
  const win = window_ === 'all' ? ev : ev.slice(-+window_);
  const points = [
    ...(win.length && win[0].sequence === 1 ? [{ at: win[0].at, rating: win[0].before.rating, rd: win[0].before.rd, label: 'Initial rating' }] : []),
    ...win.map(e => ({ at: e.at, rating: e.after.rating, rd: e.after.rd, label: `#${e.sequence} ${e.score === 1 ? 'W' : e.score === 0 ? 'L' : 'D'} vs ${e.opponent.name}: ${Math.round(e.after.rating)}` })),
  ];
  const rankChanges = ev.filter(e => e.rankBefore !== e.rankAfter);
  const finished = games.filter(g => g.status === 'finalized');
  const byTc = ['blitz', 'rapid', 'classical', 'untimed'].map(tc => {
    const gs = finished.filter(g => g.timeControl.id === tc);
    const w = gs.filter(g => g.result && g.result !== '1/2-1/2' && (g.result === '1-0') === (g.humanColor === 'white')).length;
    const d = gs.filter(g => g.result === '1/2-1/2').length;
    return { tc, n: gs.length, w, d, l: gs.length - w - d };
  });
  const bands = [[0, 1200], [1200, 1400], [1400, 1600], [1600, 1800], [1800, 9999]].map(([lo, hi]) => {
    const es = ev.filter(e => e.opponent.rating >= lo && e.opponent.rating < hi);
    const score = es.reduce((a, e) => a + e.score, 0);
    const exp = es.reduce((a, e) => a + e.expected, 0);
    return { label: hi > 5000 ? `${lo}+` : `${lo}–${hi - 1}`, n: es.length, score, exp };
  });
  const prov = isProvisional(s.games, s.rd);

  return (
    <div>
      <h1>Career</h1>
      <div className="seg" role="group" aria-label="Rating pool" style={{ marginBottom: 12 }}>
        {POOLS.map(p => <button key={p} aria-pressed={pool === p} onClick={() => setPool(p)}>{p[0].toUpperCase() + p.slice(1)} ({states[p]?.games ?? 0})</button>)}
      </div>
      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="panel stat"><span className="k">Crown rating ({pool})</span><span className="v" data-testid="current-rating">{Math.round(s.rating)}</span><span className="small muted">RD ±{Math.round(s.rd)} · σ {s.sigma.toFixed(4)} · {prov ? 'provisional' : 'established'}</span></div>
        <div className="panel stat"><span className="k">Rank</span><span className="v" style={{ fontSize: '1.3rem' }}>{rankFor(s.rating, s.games, s.rd)}</span><span className="small muted">Policy {RANK_POLICY} (rating bands until federation events exist)</span></div>
        <div className="panel stat"><span className="k">Record</span><span className="v">{s.wins}–{s.draws}–{s.losses}</span><span className="small muted">W–D–L in {s.games} rated games</span></div>
        <div className="panel stat"><span className="k">Peak / lowest (established)</span><span className="v" style={{ fontSize: '1.3rem' }}>{s.peak === null ? '—' : Math.round(s.peak)} / {s.lowest === null ? '—' : Math.round(s.lowest)}</span><span className="small muted">Provisional ratings are excluded</span></div>
      </div>
      <div className="panel">
        <div className="panel-title"><h2>Rating history</h2>
          <div className="seg" role="group" aria-label="Window">{(['10', '30', '100', 'all'] as const).map(w => <button key={w} aria-pressed={window_ === w} onClick={() => setWindow(w)}>{w === 'all' ? 'All' : `Last ${w}`}</button>)}</div>
        </div>
        <RatingChart points={points} />
        <p className="small muted">Internal Crown ratings (Glicko-2, initial 1500 ±350, τ = 0.5, one rated game per rating period). They are not FIDE ratings. Provisional until 20 games and RD ≤ 100.</p>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3>By time control (all saved games)</h3>
          <table><thead><tr><th>Control</th><th>Games</th><th>W</th><th>D</th><th>L</th></tr></thead>
            <tbody>{byTc.map(r => <tr key={r.tc}><td>{r.tc}</td><td>{r.n}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td></tr>)}</tbody></table>
        </div>
        <div className="panel">
          <h3>By opponent strength ({pool}, rated)</h3>
          <table><thead><tr><th>Opp. rating</th><th>Games</th><th>Score</th><th>Expected</th></tr></thead>
            <tbody>{bands.map(b => <tr key={b.label}><td>{b.label}</td><td>{b.n}</td><td>{b.n ? b.score : '—'}</td><td>{b.n ? b.exp.toFixed(1) : '—'}</td></tr>)}</tbody></table>
          <p className="small muted">Expected = sum of Glicko-2 expected scores before each game.</p>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Rating events ({ev.length})</h3>
        {ev.length === 0 ? <p className="muted">No rated games in this pool yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>#</th><th>Date</th><th>Opponent</th><th>Score</th><th>Expected</th><th>Before</th><th>After</th><th>Δ</th><th className="hide-sm">Rank</th></tr></thead>
              <tbody>
                {[...ev].reverse().map(e => (
                  <tr key={e.id} className="clickable" title={explainEvent(e)} onClick={() => go({ name: 'analysis', gameId: e.gameId })} data-testid="rating-event">
                    <td>{e.sequence}</td><td>{new Date(e.at).toLocaleDateString()}</td><td>{e.opponent.name} ({Math.round(e.opponent.rating)})</td>
                    <td>{e.score}</td><td>{(e.expected * 100).toFixed(0)}%</td>
                    <td>{Math.round(e.before.rating)} ±{Math.round(e.before.rd)}</td><td>{Math.round(e.after.rating)} ±{Math.round(e.after.rd)}</td>
                    <td style={{ color: e.delta >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{e.delta >= 0 ? '+' : ''}{e.delta.toFixed(1)}</td>
                    <td className="hide-sm small">{e.rankBefore === e.rankAfter ? e.rankAfter : `${e.rankBefore} → ${e.rankAfter}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Rank history</h3>
        {rankChanges.length === 0 ? <p className="muted small">No rank changes yet. Ranks: Provisional → {RANKS.map(r => `${r.name} (${r.min}+)`).join(' → ')}. Crown Champion is earned only through federation championships (M3).</p>
          : <ul>{rankChanges.map(e => <li key={e.id}>{new Date(e.at).toLocaleDateString()}: {e.rankBefore} → <strong>{e.rankAfter}</strong> (rating {Math.round(e.after.rating)}, game {e.gameId})</li>)}</ul>}
      </div>
    </div>
  );
}
