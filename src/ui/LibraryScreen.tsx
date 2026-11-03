import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useServices } from './App';
import { resultText } from './PlayScreen';
import type { GameRecord } from '../games/types';
import type { AnalysisReport } from '../analysis/types';
import type { RatingEvent } from '../ratings/ledger';
import { exportBundle, importBundle } from '../storage/backup';
import { APP_VERSION, requestPersistentStorage } from '../app/services';
import { ANALYSIS_PRESETS, DEFAULT_ANALYSIS } from '../analysis/analyzer';

const PAGE = 25;

export interface LibraryRow {
  game: GameRecord;
  opponent: string;
  result: string;
  accuracy: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  delta: number | null;
  mistakes: number | null;
  blunders: number | null;
  analysis: string;
}

export function buildRows(games: GameRecord[], reports: AnalysisReport[], events: RatingEvent[], jobs: { gameId: string; status: string }[]): LibraryRow[] {
  const repBy = new Map<string, AnalysisReport>();
  for (const r of reports) { const cur = repBy.get(r.gameId); if (!cur || r.completedAt > cur.completedAt) repBy.set(r.gameId, r); }
  const evBy = new Map(events.map(e => [e.gameId, e]));
  const jobBy = new Map(jobs.map(j => [j.gameId, j.status]));
  return games.map(g => {
    const r = repBy.get(g.id);
    const s = r?.summary[g.humanColor];
    const e = evBy.get(g.id);
    return {
      game: g, opponent: g.humanColor === 'white' ? g.black.name : g.white.name, result: resultText(g),
      accuracy: s?.accuracy ?? null, ratingBefore: e?.before.rating ?? null, ratingAfter: e?.after.rating ?? null, delta: e?.delta ?? null,
      mistakes: s ? s.counts.mistake : null, blunders: s ? s.counts.blunder : null,
      analysis: r ? (r.status === 'complete' ? 'complete' : 'partial') : g.status !== 'finalized' ? 'game unfinished' : (jobBy.get(g.id) ?? 'not analysed'),
    };
  });
}

export function LibraryScreen() {
  const services = useServices();
  const { go } = useApp();
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [q, setQ] = useState('');
  const [result, setResult] = useState('all');
  const [tc, setTc] = useState('all');
  const [mode, setMode] = useState('all');
  const [sort, setSort] = useState<'date' | 'accuracy' | 'delta' | 'moves'>('date');
  const [page, setPage] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof requestPersistentStorage>> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [batch, setBatch] = useState(DEFAULT_ANALYSIS.id);

  useEffect(() => {
    void (async () => {
      const [games, reports, events, jobs] = await Promise.all([services.db.allGames(), services.db.allReports(), services.db.ratingEvents(), services.db.allJobs()]);
      setRows(buildRows(games, reports, events, jobs));
    })();
  }, [services, services.revision]);
  useEffect(() => { void requestPersistentStorage().then(setStorage); }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let r = rows.filter(x =>
      (!ql || x.opponent.toLowerCase().includes(ql) || (x.game.opening?.name ?? '').toLowerCase().includes(ql) || x.game.id.includes(ql)) &&
      (result === 'all' || x.result.toLowerCase() === result) &&
      (tc === 'all' || x.game.timeControl.id === tc) &&
      (mode === 'all' || (mode === 'rated' ? x.game.rated : mode === 'training' ? x.game.mode === 'training' : !x.game.rated && x.game.mode !== 'training')));
    const key = (x: LibraryRow) => sort === 'date' ? x.game.startedAt : sort === 'accuracy' ? (x.accuracy ?? -1) : sort === 'delta' ? (x.delta ?? -1e9) : x.game.moves.length;
    r = [...r].sort((a, b) => { const ka = key(a), kb = key(b); return ka < kb ? 1 : ka > kb ? -1 : a.game.id.localeCompare(b.game.id); });
    return r;
  }, [rows, q, result, tc, mode, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);
  useEffect(() => setPage(0), [q, result, tc, mode, sort]);

  const doExport = async () => {
    const b = await exportBundle(services.db, APP_VERSION);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
    a.download = `crown-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setMsg(`Exported ${b.counts.games} games, ${b.counts.ratingEvents} rating changes and ${b.counts.reports} analyses. Keep the file somewhere safe, because your browser can clear its storage.`);
    await services.db.setMeta('lastBackup', new Date().toISOString());
  };
  const doImport = async (f: File) => {
    try {
      const r = await importBundle(services.db, JSON.parse(await f.text()));
      setMsg(r.mode === 'restore' ? `Restored ${r.games} games, ${r.events} rating changes and ${r.reports} analyses.` : `Added ${r.games} new games and ${r.reports} analyses (${r.skipped} already here). Importing never changes your existing rating history.`);
      services.notify();
    } catch (e) {
      setMsg(`Couldn't import this file (${(e as Error).message}). Choose a Crown & Calculation backup file and try again.`);
    }
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Chess Library</h1>
        <span className="chip">{rows.length} Games</span>
        <span className="spacer" />
        <select value={batch} onChange={e => setBatch(e.target.value)} aria-label="Batch analysis settings">{ANALYSIS_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        <button className="btn small" disabled={services.readOnly} onClick={async () => { const n = await services.batchReanalyze(ANALYSIS_PRESETS.find(p => p.id === batch)!); setMsg(n ? `Queued ${n} game(s) for analysis. Earlier analyses are kept.` : 'Every finished game already has a complete analysis with these settings.'); }}>Analyse All</button>
        {services.progress && <button className="btn small" onClick={() => void services.cancelAllAnalysis()}>Cancel Analysis</button>}
        <button className="btn small" onClick={doExport}>Export Backup</button>
        <button className="btn small" onClick={() => fileRef.current?.click()} disabled={services.readOnly}>Import Backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
      </div>
      {msg && <div className="notice" role="status" style={{ marginBottom: 12 }}>{msg}</div>}
      {storage && (
        <div className="small muted" style={{ marginBottom: 12 }}>
          Storage: {storage.persisted === true ? 'protected, so your browser won’t clear it automatically' : storage.persisted === false ? 'not protected, so your browser may clear it when space runs low. Export backups regularly' : 'status unknown'}
          {storage.usage !== null && storage.quota !== null && ` · ${(storage.usage / 1048576).toFixed(1)} MB used of ~${(storage.quota / 1048576).toFixed(0)} MB`}
        </div>
      )}
      <div className="panel">
        <div className="row" style={{ marginBottom: 10 }}>
          <input type="search" placeholder="Search opponent or opening" value={q} onChange={e => setQ(e.target.value)} aria-label="Search games" style={{ flex: '1 1 200px' }} />
          <select value={result} onChange={e => setResult(e.target.value)} aria-label="Result filter"><option value="all">All results</option><option value="victory">Wins</option><option value="defeat">Losses</option><option value="draw">Draws</option><option value="in progress">Unfinished</option></select>
          <select value={tc} onChange={e => setTc(e.target.value)} aria-label="Time control filter"><option value="all">All time controls</option><option value="blitz">Blitz</option><option value="rapid">Rapid</option><option value="classical">Classical</option><option value="untimed">Untimed</option></select>
          <select value={mode} onChange={e => setMode(e.target.value)} aria-label="Mode filter"><option value="all">All modes</option><option value="rated">Rated</option><option value="casual">Casual</option><option value="training">Training</option></select>
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort"><option value="date">Newest first</option><option value="accuracy">Accuracy</option><option value="delta">Rating change</option><option value="moves">Length</option></select>
        </div>
        {view.length === 0 ? <p className="muted">{rows.length ? 'No games match these filters.' : 'No games yet. Play a game and it will be saved here.'}</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>Rating</th><th>Accuracy</th><th className="hide-sm">Mistakes/Blunders</th><th className="hide-sm">Opening</th><th className="hide-sm">Moves</th><th className="hide-sm">Time Control</th><th>Analysis</th></tr></thead>
              <tbody>
                {view.map(r => (
                  <tr key={r.game.id} className="clickable" onClick={() => go(r.game.status === 'finalized' ? { name: 'analysis', gameId: r.game.id } : { name: 'match', gameId: r.game.id })} data-testid="library-row">
                    <td>{new Date(r.game.startedAt).toLocaleDateString()}</td>
                    <td>{r.opponent}{r.game.mode === 'training' && <span className="chip" style={{ marginLeft: 4 }}>Training</span>}</td>
                    <td><span className={`chip ${r.result === 'Victory' ? 'pos' : r.result === 'Defeat' ? 'neg' : ''}`}>{r.result}</span></td>
                    <td>{r.delta !== null ? <>{Math.round(r.ratingBefore!)}→{Math.round(r.ratingAfter!)} <span style={{ color: r.delta >= 0 ? 'var(--positive)' : 'var(--negative)' }}>({r.delta >= 0 ? '+' : ''}{r.delta.toFixed(1)})</span></> : <span className="muted">{r.game.rated ? 'pending' : 'unrated'}</span>}</td>
                    <td>{r.accuracy === null ? <span className="muted">—</span> : r.accuracy.toFixed(1)}</td>
                    <td className="hide-sm">{r.mistakes === null ? '—' : `${r.mistakes}/${r.blunders}`}</td>
                    <td className="hide-sm small">{r.game.opening?.name ?? '—'}</td>
                    <td className="hide-sm">{Math.ceil(r.game.moves.length / 2)}</td>
                    <td className="hide-sm">{r.game.timeControl.label}</td>
                    <td><span className="chip">{r.analysis.replace(/\b\w/g, c => c.toUpperCase())}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
            <button className="btn small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="small">Page {page + 1} of {pages} · {filtered.length} games</span>
            <button className="btn small" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
