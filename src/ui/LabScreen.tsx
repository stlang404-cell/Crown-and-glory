import { useEffect, useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import type { AnalysisReport } from '../analysis/types';
import type { GameRecord } from '../games/types';
import type { RatingEvent } from '../ratings/ledger';
import { Attempt, Puzzle, TrainingRun, loadPuzzleSet } from '../academy/academy';
import { computeDimensions, computeTrend, recurringPatterns, Evidence, LAB_ID } from '../academy/lab';
import { TOPICS } from '../academy/coach';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

function EvidenceLine({ e }: { e: Evidence }) {
  const label = e.source === 'games' ? 'Games' : e.source === 'puzzles' ? 'Practice puzzles (first try)' : 'Assessments';
  return (
    <div className="small" style={{ marginTop: 4 }}>
      <strong>{label}:</strong>{' '}
      {e.status === 'measured' ? <>{pct(e.rate)} <span className="muted">(95% {pct(e.ci![0])}–{pct(e.ci![1])})</span> · </> : <span className="muted">not enough data yet · </span>}
      {e.s}/{e.n} {e.source === 'games' ? `opportunities in ${e.games} game${e.games === 1 ? '' : 's'}` : 'puzzles'}
    </div>
  );
}

export function LabScreen() {
  const services = useServices();
  const { go } = useApp();
  const [data, setData] = useState<{ games: GameRecord[]; reports: AnalysisReport[]; attempts: Attempt[]; puzzles: Puzzle[]; runs: TrainingRun[]; events: RatingEvent[] } | null>(null);
  useEffect(() => {
    void (async () => {
      const [games, reports, attempts, runs, events, set] = await Promise.all([services.db.allGames(), services.db.allReports(), services.db.getAll<Attempt>('attempts'), services.db.getAll<TrainingRun>('trainingRuns'), services.db.ratingEvents(), loadPuzzleSet()]);
      setData({ games, reports, attempts, runs, events, puzzles: set.puzzles });
    })();
  }, [services, services.revision]);
  const computed = useMemo(() => data && { dims: computeDimensions(data), trend: computeTrend(data), patterns: recurringPatterns(data) }, [data]);
  if (!data || !computed) return <p className="muted">Loading…</p>;
  const { dims, trend, patterns } = computed;
  const measured = dims.dimensions.map(d => ({ d, e: d.evidence.find(e => e.status === 'measured') })).filter(x => x.e);
  const strongest = [...measured].sort((a, b) => b.e!.ci![0] - a.e!.ci![0])[0];
  const weakest = [...measured].sort((a, b) => a.e!.ci![1] - b.e!.ci![1])[0];
  const W = 600, H = 120;
  const pts = trend.perGame;
  return (
    <div>
      <h1>Chess Intelligence Lab</h1>
      <div className="notice" style={{ marginBottom: 14 }}>
        These are chess-only performance summaries, not IQ or general intelligence. Each figure is how often you succeeded at a specific kind of chance, with its count and a 95% range.
        Game figures need at least 10 chances across 3 games; puzzle figures need at least 8 first-try attempts.
        <details className="small" style={{ marginTop: 6 }}><summary>Details</summary>{LAB_ID} · Methodology {dims.method ?? '—'} · {dims.gamesUsed} games used{dims.excluded ? ` · ${dims.excluded} excluded (other analysis version, training or assisted)` : ''}.</details>
      </div>
      {measured.length >= 2 && strongest && weakest && strongest.d.id !== weakest.d.id && (
        <div className="grid-2" style={{ marginBottom: 14 }}>
          <div className="panel stat"><span className="k">Strongest Skill</span><span className="v" style={{ fontSize: '1.3rem' }}>{strongest.d.name}</span><span className="small muted">best result, allowing for uncertainty</span></div>
          <div className="panel stat"><span className="k">Weakest Skill</span><span className="v" style={{ fontSize: '1.3rem' }}>{weakest.d.name}</span><span className="small muted">most room to grow · <button className="btn ghost small" onClick={() => go({ name: 'academy' })}>Train in the Academy</button></span></div>
        </div>
      )}
      <div className="grid-2">
        {dims.dimensions.map(d => (
          <div key={d.id} className="panel" data-testid="lab-dimension">
            <div className="panel-title"><h2 className="h3" style={{ margin: 0 }}>{d.name}</h2>
              {d.status === 'measured' ? <span className="chip gold">Measured</span> : <span className="chip">Not Enough Data</span>}
            </div>
            <div className="small muted">{d.rubric}</div>
            {d.evidence.map((e, i) => <EvidenceLine key={i} e={e} />)}
          </div>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h2 className="h3">Accuracy Trend</h2>
        {pts.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={`Per-game accuracy for ${pts.length} analysed games`}>
            <rect width={W} height={H} rx={6} style={{ fill: 'var(--chart-bg)' }} />
            {[25, 50, 75].map(v => <line key={v} x1="0" x2={W} y1={H - (v / 100) * H} y2={H - (v / 100) * H} style={{ stroke: 'var(--chart-grid)' }} />)}
            <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * W},${H - ((p.accuracy ?? 0) / 100) * H}`).join(' ')} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" />
          </svg>
        ) : <p className="muted small">Appears once two of your games have been analysed the same way.</p>}
        <p className="small">{trend.recent && trend.earlier ? <>Recent {trend.recent.games} games: {trend.recent.accuracy!.toFixed(1)} · earlier {trend.earlier.games}: {trend.earlier.accuracy!.toFixed(1)} · difference {trend.difference!.value >= 0 ? '+' : ''}{trend.difference!.value.toFixed(1)} (95% {trend.difference!.ci[0].toFixed(1)} to {trend.difference!.ci[1].toFixed(1)}) · change {trend.velocity!.perTenGames.toFixed(2)} per 10 games (95% {trend.velocity!.ci[0].toFixed(2)} to {trend.velocity!.ci[1].toFixed(2)}).</> : null}</p>
        <p className="small muted">{trend.note}</p>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h2 className="h3">Recurring Mistakes</h2>
        {patterns.length === 0 ? <p className="muted small" data-testid="lab-empty">No repeated mistakes found yet. Analyse more of your games to see them here. <button className="btn small" onClick={() => go({ name: 'analyses' })}>Analyse a Game</button></p> : patterns.slice(0, 6).map(p => (
          <div key={p.topic} className="coach" style={{ marginBottom: 8 }}>
            <div><strong>{TOPICS[p.topic] ?? p.topic}</strong> — {p.status === 'established' ? <span className="chip neg">Pattern</span> : <span className="chip">Possible Pattern</span>}</div>
            <div className="small">{p.occurrences} occurrence{p.occurrences === 1 ? '' : 's'} in {p.games} game{p.games === 1 ? '' : 's'}{p.status === 'tentative' ? ' (it counts as a pattern at 5 or more across 3 or more games)' : ''}.
              {' '}Examples: {p.refs.slice(0, 3).map(r => <button key={`${r.gameId}-${r.ply}`} className="btn ghost small" onClick={() => go({ name: 'analysis', gameId: r.gameId, ply: r.ply })}>Move {Math.ceil(r.ply / 2)}</button>)}</div>
            {p.effectiveness && <div className="small muted">Training check: {p.effectiveness}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
