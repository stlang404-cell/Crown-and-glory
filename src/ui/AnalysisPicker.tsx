import { useEffect, useState } from 'react';
import { useApp, useServices } from './App';
import { buildRows, type LibraryRow } from './LibraryScreen';
import { AppServices } from '../app/services';
import { DEFAULT_ANALYSIS } from '../analysis/analyzer';

const STATUS_LABEL: Record<string, string> = {
  complete: 'Analysed', partial: 'Partly analysed', queued: 'Waiting to analyse', running: 'Analysing…',
  failed: 'Analysis failed', cancelled: 'Analysis cancelled', 'not analysed': 'Not analysed',
};

/**
 * Analysis home (#/analysis with no game): pick a completed game to review, or start its analysis.
 * Shown from the navigation so "Analysis" always opens something useful, including on a fresh career.
 */
export function AnalysisPicker() {
  const services = useServices();
  const { go } = useApp();
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [current, setCurrent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [games, reports, events, jobs] = await Promise.all([services.db.allGames(), services.db.allReports(), services.db.ratingEvents(), services.db.allJobs()]);
        const done = games.filter(g => g.status === 'finalized').sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt));
        const latestJob = new Map<string, { gameId: string; status: string; updatedAt: string }>();
        for (const j of jobs) { const c = latestJob.get(j.gameId); if (!c || j.updatedAt > c.updatedAt) latestJob.set(j.gameId, j); }
        if (!alive) return;
        setRows(buildRows(done, reports, events, [...latestJob.values()]));
        setCurrent(new Set(reports.filter(r => AppServices.isCurrent(r, DEFAULT_ANALYSIS.id)).map(r => r.gameId)));
      } catch (e) {
        if (alive) setError(String((e as Error)?.message ?? e));
      }
    })();
    return () => { alive = false; };
  }, [services, services.revision]);

  const live = services.progress;
  return (
    <div data-testid="analysis-picker">
      <header className="page-head">
        <div className="kicker">Analysis</div>
        <h1>Review a Game</h1>
        <p className="muted">Choose a finished game to see every move graded, the evaluation graph and the engine's best lines.</p>
      </header>
      {error && <div className="notice warn" role="alert">Your games could not be loaded: {error}. Reload the page to try again.</div>}
      {!error && rows === null && <p className="muted" role="status">Loading your games…</p>}
      {rows && rows.length === 0 && (
        <div className="panel" data-testid="analysis-empty">
          <h2 style={{ marginTop: 0 }}>No finished games yet</h2>
          <p>Play a game to completion and it appears here, ready to analyse.</p>
          <button className="btn primary" onClick={() => go({ name: 'play' })}>Play a Game</button>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>Moves</th><th>Analysis</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {rows.map(r => {
                const running = live?.gameId === r.game.id;
                const st = running ? `Analysing… ${live!.done}/${live!.total}` : STATUS_LABEL[r.analysis] ?? r.analysis;
                return (
                  <tr key={r.game.id} data-testid="analysis-pick-row">
                    <td className="mono small">{(r.game.endedAt ?? r.game.startedAt).slice(0, 10)}</td>
                    <td>{r.opponent}</td>
                    <td>{r.result}</td>
                    <td className="mono">{Math.ceil(r.game.moves.length / 2)}</td>
                    <td data-testid="analysis-pick-status">{st}{r.accuracy !== null && <span className="muted small"> · accuracy {r.accuracy.toFixed(1)}</span>}</td>
                    <td className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      {!current.has(r.game.id) && !running && r.game.moves.length > 0 && (
                        <button className="btn small" onClick={() => { void services.requestAnalysis(r.game.id, DEFAULT_ANALYSIS); go({ name: 'analysis', gameId: r.game.id }); }}>
                          {r.analysis === 'complete' ? 'Analyse Again' : 'Analyse Game'}
                        </button>
                      )}
                      <button className="btn primary small" onClick={() => go({ name: 'analysis', gameId: r.game.id })}>Open</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
