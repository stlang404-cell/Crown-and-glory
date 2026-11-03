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
  const label = e.source === 'games' ? 'Games' : e.source === 'puzzles' ? 'Practice puzzles (first try)' : 'Held-out assessments';
  return (
    <div className="small" style={{ marginTop: 4 }}>
      <strong>{label}:</strong>{' '}
      {e.status === 'measured' ? <>{pct(e.rate)} <span className="muted">(95% {pct(e.ci![0])}–{pct(e.ci![1])})</span> · </> : <span className="muted">insufficient evidence · </span>}
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
        Chess-specific performance summaries ({LAB_ID}) — not IQ, not general intelligence, not validated psychometrics. Each figure is a success rate on defined opportunities with its count and a 95% interval;
        game evidence needs ≥ 10 opportunities across ≥ 3 games, puzzle evidence ≥ 8 first-try attempts. Methodology {dims.method ?? '—'} · {dims.gamesUsed} games used{dims.excluded ? ` · ${dims.excluded} excluded (other analysis version, training or assisted)` : ''}.
      </div>
      {measured.length >= 2 && strongest && weakest && strongest.d.id !== weakest.d.id && (
        <div className="grid-2" style={{ marginBottom: 14 }}>
          <div className="panel stat"><span className="k">Strongest measured</span><span className="v" style={{ fontSize: '1.3rem' }}>{strongest.d.name}</span><span className="small muted">highest lower interval bound</span></div>
          <div className="panel stat"><span className="k">Weakest measured</span><span className="v" style={{ fontSize: '1.3rem' }}>{weakest.d.name}</span><span className="small muted">lowest upper interval bound · <button className="btn ghost small" onClick={() => go({ name: 'academy' })}>Train in the Academy</button></span></div>
        </div>
      )}
      <div className="grid-2">
        {dims.dimensions.map(d => (
          <div key={d.id} className="panel" data-testid="lab-dimension">
            <div className="panel-title"><h3 style={{ margin: 0 }}>{d.name}</h3>
              {d.status === 'measured' ? <span className="chip gold">measured</span> : <span className="chip">insufficient evidence</span>}
            </div>
            <div className="small muted">{d.rubric}</div>
            {d.evidence.map((e, i) => <EvidenceLine key={i} e={e} />)}
          </div>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Accuracy trend</h3>
        {pts.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={`Per-game accuracy for ${pts.length} analysed games`}>
            <rect width={W} height={H} fill="#1d2532" />
            {[25, 50, 75].map(v => <line key={v} x1="0" x2={W} y1={H - (v / 100) * H} y2={H - (v / 100) * H} stroke="#2e3a4d" />)}
            <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * W},${H - ((p.accuracy ?? 0) / 100) * H}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" />
          </svg>
        ) : <p className="muted small">Appears after two analysed games of the same methodology.</p>}
        <p className="small">{trend.recent && trend.earlier ? <>Recent {trend.recent.games} games: {trend.recent.accuracy!.toFixed(1)} · earlier {trend.earlier.games}: {trend.earlier.accuracy!.toFixed(1)} · difference {trend.difference!.value >= 0 ? '+' : ''}{trend.difference!.value.toFixed(1)} (95% {trend.difference!.ci[0].toFixed(1)} to {trend.difference!.ci[1].toFixed(1)}) · velocity {trend.velocity!.perTenGames.toFixed(2)} per 10 games (95% {trend.velocity!.ci[0].toFixed(2)} to {trend.velocity!.ci[1].toFixed(2)}).</> : null}</p>
        <p className="small muted">{trend.note}</p>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Recurring patterns (coach)</h3>
        {patterns.length === 0 ? <p className="muted small">No engine-verified error patterns yet.</p> : patterns.slice(0, 6).map(p => (
          <div key={p.topic} className="coach" style={{ marginBottom: 8 }}>
            <div><strong>{TOPICS[p.topic] ?? p.topic}</strong> — {p.status === 'established' ? <span className="chip neg">established pattern</span> : <span className="chip">tentative</span>}</div>
            <div className="small">{p.occurrences} occurrence{p.occurrences === 1 ? '' : 's'} in {p.games} game{p.games === 1 ? '' : 's'}{p.status === 'tentative' ? ' (needs ≥ 5 across ≥ 3 games before it is called a pattern)' : ''}.
              {' '}Examples: {p.refs.slice(0, 3).map(r => <button key={`${r.gameId}-${r.ply}`} className="btn ghost small" onClick={() => go({ name: 'analysis', gameId: r.gameId, ply: r.ply })}>ply {r.ply}</button>)}</div>
            {p.effectiveness && <div className="small muted">Training check: {p.effectiveness}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
