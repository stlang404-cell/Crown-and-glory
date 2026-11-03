import { AppServices } from '../app/services';
import { useEffect, useMemo, useState, KeyboardEvent } from 'react';
import { useApp, useServices } from './App';
import { Board } from './Board';
import { EvalGraph, formatScore, whiteU } from './Charts';
import { Icon } from './Icons';
import { resultText } from './PlayScreen';
import { Position } from '../rules/position';
import { parseLegalCcn } from '../rules/notation';
import { squareName } from '../rules/types';
import { TERMINATION_LABEL } from '../rules/adjudication';
import { ANALYSIS_PRESETS, DEFAULT_ANALYSIS } from '../analysis/analyzer';
import type { AnalysisReport, Candidate, Grade, PlyAnalysis, SideSummary } from '../analysis/types';
import { GRADES } from '../analysis/types';
import type { GameRecord } from '../games/types';
import type { RatingEvent } from '../ratings/ledger';
import { explainEvent } from '../ratings/ledger';
import { createGameRecord } from '../games/session';
import { getOpponent, opponentSnapshot } from '../federation/roster';
import { TIME_CONTROLS } from '../games/types';
import { exportGame } from '../storage/backup';

export const GRADE_LABEL: Record<Grade, string> = {
  brilliant: 'Brilliant', great: 'Great', best: 'Best', excellent: 'Excellent', good: 'Good', inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder',
};
const GRADE_SYMBOL: Record<Grade, string> = { brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '·', inaccuracy: '?!', mistake: '?', blunder: '??' };

export function GradeIcon({ grade, provisional }: { grade: Grade | null; provisional?: boolean }) {
  if (!grade) return <span className="grade-icon grade-none" title="Not graded">–</span>;
  return <span className={`grade-icon grade-${grade}`} title={`${GRADE_LABEL[grade]}${provisional ? ' (provisional)' : ''}`} aria-label={GRADE_LABEL[grade]}>{GRADE_SYMBOL[grade]}</span>;
}

const fmtAcc = (a: number | null) => (a === null ? '—' : a.toFixed(1));

export function AnalysisScreen({ gameId, initialPly }: { gameId: string; initialPly?: number }) {
  const services = useServices();
  const { go } = useApp();
  const [game, setGame] = useState<GameRecord | null>(null);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [reportIdx, setReportIdx] = useState(-1);
  const [event, setEvent] = useState<RatingEvent | null>(null);
  const [ply, setPly] = useState(initialPly ?? 0);
  const [variation, setVariation] = useState<{ origin: number; line: string[]; sans: string[]; idx: number; label: string } | null>(null);
  const [preset, setPreset] = useState(DEFAULT_ANALYSIS.id);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [bookmarks, setBookmarks] = useState<{ id: string; gameId: string; ply: number; memorable: boolean; note: string; at: string }[]>([]);
  useEffect(() => { void services.db.getAll<{ id: string; gameId: string; ply: number; memorable: boolean; note: string; at: string }>('bookmarks').then(b => setBookmarks(b.filter(x => x.gameId === gameId))); }, [gameId, services, services.revision]);
  const toggleBookmark = async (memorable: boolean) => {
    const id = `${gameId}:${ply}:${memorable ? 'm' : 'b'}`;
    if (bookmarks.some(b => b.id === id)) await services.db.remove('bookmarks', id);
    else await services.db.put('bookmarks', { id, gameId, ply, memorable, note: '', at: new Date().toISOString() });
    services.notify();
  };

  useEffect(() => {
    void (async () => {
      const g = await services.db.getGame(gameId);
      setGame(g ?? null);
      const reps = await services.reportsFor(gameId);
      setReports(reps);
      setReportIdx(i => (i < 0 || i >= reps.length ? reps.length - 1 : i));
      if (g?.ratingEventId) setEvent((await services.db.ratingEvents(g.pool!)).find(e => e.id === g.ratingEventId) ?? null);
      const jobs = (await services.db.allJobs()).filter(j => j.gameId === gameId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setJobStatus(jobs[0]?.status ?? null);
      if (g && initialPly === undefined && ply === 0 && !reps.length) setPly(0);
    })();
  }, [gameId, services, services.revision]);

  const fens = useMemo(() => {
    if (!game) return [];
    const p = Position.fromFen(game.initialFen);
    for (const s of game.setupMoves ?? []) p.makeMove(parseLegalCcn(p, s));
    const out = [p.toFen()];
    for (const m of game.moves) out.push(m.fenAfter);
    return out;
  }, [game]);

  if (!game) return <p className="muted">Loading game…</p>;
  const report = reports[reportIdx] ?? null;
  const live = services.progress?.gameId === gameId ? services.progress : null;
  const plies: PlyAnalysis[] = report?.plies ?? live?.partial ?? [];
  const n = game.moves.length;
  const cur = ply > 0 ? plies.find(p => p.ply === ply) ?? null : null;
  const humanPov = game.humanColor;
  const orientation: 'white' | 'black' = (humanPov === 'white') !== flipped ? 'white' : 'black';

  // board state (mainline or variation)
  let fen = fens[ply] ?? fens[0];
  let lastMove: string | null = ply > 0 ? game.moves[ply - 1].ccn : null;
  if (variation) {
    const p = Position.fromFen(fens[variation.origin]);
    // replay with history for correctness of check display
    for (let i = 0; i <= variation.idx; i++) p.makeMove(parseLegalCcn(p, variation.line[i]));
    fen = p.toFen();
    lastMove = variation.line[variation.idx];
  }
  const posNow = Position.fromFen(fen);
  const check = posNow.inCheck() ? squareName(posNow.kingSq[posNow.side]) : null;
  const arrows = !variation && ply < n ? (() => {
    const next = plies.find(p => p.ply === ply + 1);
    return next && next.best.ccn !== next.ccn ? [{ from: next.best.ccn.slice(0, 2), to: next.best.ccn.slice(2, 4) }] : [];
  })() : [];

  const goPly = (k: number) => { setVariation(null); setPly(Math.max(0, Math.min(n, k))); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); variation ? setVariation(v => v && (v.idx > 0 ? { ...v, idx: v.idx - 1 } : null)) : goPly(ply - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); variation ? setVariation(v => v && { ...v, idx: Math.min(v.line.length - 1, v.idx + 1) }) : goPly(ply + 1); }
    if (e.key === 'Home') goPly(0);
    if (e.key === 'End') goPly(n);
    if (e.key === 'Escape') setVariation(null);
  };
  const explore = (origin: number, c: Candidate, label: string) => setVariation({ origin, line: c.pv, sans: c.pvSan, idx: 0, label });

  const retry = async () => {
    if (!cur) return;
    const o = getOpponent(game.humanColor === 'white' ? game.black.id : game.white.id);
    if (!o) return;
    const before = game.moves[ply - 1];
    const prefix = [...(game.setupMoves ?? []), ...game.moves.slice(0, ply - 1).map(m => m.ccn)];
    const moverIsHuman = cur.color === game.humanColor;
    const rec = createGameRecord({
      id: `t-${Date.now().toString(36)}`, mode: 'training', timeControl: TIME_CONTROLS.untimed, humanColor: moverIsHuman ? game.humanColor : (game.humanColor === 'white' ? 'black' : 'white'),
      human: { kind: 'human', id: 'player', name: 'You', rating: null, rd: null }, engine: opponentSnapshot(o),
      initialFen: game.initialFen, prefixMoves: prefix, engineSeed: Math.floor(Math.random() * 2 ** 31), nowIso: new Date().toISOString(),
      context: { kind: 'training-retry', sourceGameId: game.id, sourcePly: ply },
    });
    void before;
    await services.saveGame(rec);
    go({ name: 'match', gameId: rec.id });
  };

  const download = (name: string, text: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const opp = game.humanColor === 'white' ? game.black : game.white;
  const summary = report?.summary;
  const mine: SideSummary | undefined = summary?.[humanPov];
  const theirs: SideSummary | undefined = summary?.[humanPov === 'white' ? 'black' : 'white'];
  const status = report ? report.status : live ? 'running' : jobStatus;

  return (
    <div onKeyDown={onKey} tabIndex={-1} style={{ outline: 'none' }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'library' })}>← Library</button>
        <h1 style={{ margin: 0 }}>{resultText(game)} vs {opp.name}</h1>
        <span className="chip">{game.result ?? '*'} · {game.termination ? TERMINATION_LABEL[game.termination] : 'unfinished'}</span>
        <span className="chip">{game.timeControl.label}</span>
        <span className={`chip ${game.rated ? 'pos' : ''}`}>{game.mode === 'training' ? 'Training' : game.rated ? 'Rated' : 'Casual'}</span>
        <span className="spacer" />
        <button className="btn small" onClick={() => download(`${game.id}.crown-game.json`, exportGame(game))}>Export game</button>
      </div>
      <div className="analysis">
        <div className="board-col">
          <Board fen={fen} orientation={orientation} lastMove={lastMove} checkSquare={check} arrows={arrows} label="Analysis board" />
          <div className="navbar" role="group" aria-label="Move navigation">
            <button className="btn" onClick={() => goPly(0)} aria-label="First position"><Icon name="first" /></button>
            <button className="btn" onClick={() => variation ? setVariation(v => v && (v.idx > 0 ? { ...v, idx: v.idx - 1 } : null)) : goPly(ply - 1)} aria-label="Previous move"><Icon name="prev" /></button>
            <span className="chip mono" style={{ alignSelf: 'center' }} data-testid="ply-indicator">{variation ? `variation ${variation.idx + 1}/${variation.line.length}` : `ply ${ply}/${n}`}</span>
            <button className="btn" onClick={() => variation ? setVariation(v => v && { ...v, idx: Math.min(v.line.length - 1, v.idx + 1) }) : goPly(ply + 1)} aria-label="Next move"><Icon name="next" /></button>
            <button className="btn" onClick={() => goPly(n)} aria-label="Last position"><Icon name="last" /></button>
            <button className="btn" onClick={() => setFlipped(f => !f)} aria-label="Flip board"><Icon name="flip" /></button>
          </div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn small" disabled={!!variation} aria-pressed={bookmarks.some(b => b.ply === ply && !b.memorable)} onClick={() => void toggleBookmark(false)} data-testid="bookmark">{bookmarks.some(b => b.ply === ply && !b.memorable) ? '★ Bookmarked' : '☆ Bookmark position'}</button>
            <button className="btn small" disabled={!!variation || ply === 0} onClick={() => void toggleBookmark(true)}>{bookmarks.some(b => b.ply === ply && b.memorable) ? '♛ Memorable move' : '♔ Mark memorable'}</button>
            {bookmarks.length > 0 && <span className="small muted">Saved: {[...new Set(bookmarks.map(b => b.ply))].sort((a, b) => a - b).map(k => <button key={k} className="btn ghost small" onClick={() => goPly(k)}>{k}</button>)}</span>}
          </div>
          {variation && (
            <div className="notice">
              Exploring {variation.label} from ply {variation.origin}: <span className="mono">{variation.sans.map((s, i) => <button key={i} className="btn ghost small" style={{ minHeight: 28, padding: '0 4px', fontWeight: i === variation.idx ? 800 : 400 }} onClick={() => setVariation({ ...variation, idx: i })}>{s}</button>)}</span>
              <button className="btn small" onClick={() => setVariation(null)}>Return to main line</button>
            </div>
          )}
          <div className="panel">
            <div className="panel-title"><h3>Evaluation</h3><span className="small muted">White advantage up · bounded expected score (mate shown at the edge)</span></div>
            {plies.length ? <EvalGraph plies={plies} total={n} selected={ply} onSelect={goPly} accuracyId={report?.methodology.accuracyId} /> : <p className="muted">No evaluation yet — the graph is drawn only from completed engine analysis.</p>}
          </div>
        </div>
        <div className="side-col">
          <ReportStatus game={game} report={report} reports={reports} reportIdx={reportIdx} setReportIdx={setReportIdx} status={status} live={live} preset={preset} setPreset={setPreset} />
          {cur ? <MovePanel p={cur} onExplore={(c, label) => explore(ply - 1, c, label)} onRetry={retry} humanPov={humanPov} accuracyId={report?.methodology.accuracyId} /> : (
            <div className="panel"><h3>{ply === 0 ? 'Initial position' : `Ply ${ply}`}</h3><p className="muted small">{ply === 0 ? 'Select a move in the list or graph, or use ← → keys.' : 'This move has not been analysed yet.'}</p></div>
          )}
          <div className="panel">
            <h3>Moves</h3>
            <div className="moves" aria-label="Analysed move list">
              {Array.from({ length: Math.ceil(n / 2) + (fens.length && Position.fromFen(fens[0]).side === 1 ? 1 : 0) }).map((_, row) => {
                const startBlack = Position.fromFen(fens[0]).side === 1;
                const wPly = startBlack ? row * 2 : row * 2 + 1;
                const cells = [wPly, wPly + 1].map(k => {
                  if (k < 1 || k > n) return <span key={k} />;
                  const pa = plies.find(p => p.ply === k);
                  return (
                    <button key={k} className={ply === k && !variation ? 'cur' : ''} onClick={() => goPly(k)} data-ply={k}>
                      <GradeIcon grade={pa?.grade ?? null} provisional={pa?.gradeProvisional} /> {game.moves[k - 1].san}
                    </button>
                  );
                });
                return <div key={row} style={{ display: 'contents' }}><span className="n">{row + 1}.</span>{cells}</div>;
              })}
            </div>
          </div>
          {report && mine && theirs && (
            <div className="panel">
              <div className="panel-title"><h3>Summary</h3><span className="chip gold" title={report.methodology.calibration}>Experimental methodology</span></div>
              <div className="grid-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="stat"><span className="k">Your accuracy</span><span className="v" data-testid="accuracy">{fmtAcc(mine.accuracy)}</span><span className="small muted">{mine.eligible} graded decisions · {mine.forced} forced excluded</span></div>
                <div className="stat"><span className="k">{opp.name}</span><span className="v">{fmtAcc(theirs.accuracy)}</span><span className="small muted">{theirs.eligible} graded decisions</span></div>
              </div>
              <table style={{ marginTop: 10 }}>
                <thead><tr><th>Label</th><th>You</th><th>{opp.name.split(' ')[0]}</th></tr></thead>
                <tbody>{GRADES.map(g => <tr key={g}><td><GradeIcon grade={g} /> {GRADE_LABEL[g]}</td><td>{mine.counts[g]}</td><td>{theirs.counts[g]}</td></tr>)}</tbody>
              </table>
              <div className="small muted" style={{ marginTop: 8 }}>
                Phase accuracy (you): opening {fmtAcc(mine.phaseAccuracy.opening.accuracy)} ({mine.phaseAccuracy.opening.eligible}) · middlegame {fmtAcc(mine.phaseAccuracy.middlegame.accuracy)} ({mine.phaseAccuracy.middlegame.eligible}) · endgame {fmtAcc(mine.phaseAccuracy.endgame.accuracy)} ({mine.phaseAccuracy.endgame.eligible}). “—” means the phase did not occur.<br />
                Critical positions handled: {mine.critical.handled}/{mine.critical.total}. Best-move frequency: {mine.bestFrequency === null ? '—' : `${Math.round(mine.bestFrequency * 100)}%`}. Avg. loss on cp-scored moves: {mine.avgCpLoss === null ? '—' : `${Math.round(mine.avgCpLoss)} cp (${mine.cpLossMoves} moves; mate positions excluded)`}.<br />
                {report.methodology.accuracyId === 'crown-accuracy-v2'
                  ? 'Accuracy = 100·exp(−4·mean expected-score loss), always between 0 and 100. It measures move quality in this game against the engine — it is not a rating or an IQ. The expected-score map (crown-outcome-map-v2) was refitted for the canonical engine and validated on held-out opening families; the grade boundaries and k = 4 remain experimental.'
                  : report.methodology.accuracyId === 'crown-accuracy-v1'
                  ? 'Historical report (engine crown-search-1 + crown-eval-3, map crown-outcome-map-v1). Accuracy = 100·exp(−4·mean expected-score loss). Re-analyse to get a report from the current canonical engine; this one is kept unchanged.'
                  : 'Accuracy = 100·exp(−4·mean expected-score loss), logistic scale s = 200 cp (methodology v0). These parameters are uncalibrated research placeholders; re-analyse to get a current report.'}
              </div>
              <ClockPressure game={game} plies={plies} />
              <div className="row" style={{ marginTop: 10 }}>
                {report.highlights.worstMistake && <button className="btn small" onClick={() => goPly(report.highlights.worstMistake!)}>Biggest mistake (ply {report.highlights.worstMistake})</button>}
                {report.highlights.biggestMiss && <button className="btn small" onClick={() => goPly(report.highlights.biggestMiss!)}>Missed opportunity (ply {report.highlights.biggestMiss})</button>}
                {report.highlights.bestTactic && <button className="btn small" onClick={() => goPly(report.highlights.bestTactic!)}>Best find (ply {report.highlights.bestTactic})</button>}
              </div>
              {report.turningPoints.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>Turning points (evaluation crossed a ±0.65 / 0.35 expected-score band): {report.turningPoints.map(t => <button key={t} className="btn ghost small" onClick={() => goPly(t)}>{t}</button>)}</div>}
            </div>
          )}
          {report && report.recommendations.length > 0 && (
            <div className="panel">
              <h3>Training focus</h3>
              {report.recommendations.slice(0, 3).map(r => (
                <div key={r.topic} className="coach" style={{ marginBottom: 8 }}>
                  <strong>{r.label}</strong>
                  <div className="small muted">{r.basis}</div>
                  {r.plies.length > 0 && <div className="small">Moments: {r.plies.map(k => <button key={k} className="btn ghost small" onClick={() => goPly(k)}>ply {k}</button>)}</div>}
                </div>
              ))}
              <div className="small muted">The full training academy with held-out exercises is planned for M2.</div>
            </div>
          )}
          {event && (
            <div className="panel">
              <h3>Rating change</h3>
              <div className={`delta ${event.delta >= 0 ? 'up' : 'down'}`}>{event.delta >= 0 ? '+' : ''}{event.delta.toFixed(1)}</div>
              <p className="small">{explainEvent(event)}</p>
              <div className="small muted">Glicko-2: {Math.round(event.before.rating)}/{Math.round(event.before.rd)}/{event.before.sigma.toFixed(4)} → {Math.round(event.after.rating)}/{Math.round(event.after.rd)}/{event.after.sigma.toFixed(4)} · event {event.id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportStatus({ game, report, reports, reportIdx, setReportIdx, status, live, preset, setPreset }: {
  game: GameRecord; report: AnalysisReport | null; reports: AnalysisReport[]; reportIdx: number; setReportIdx: (i: number) => void;
  status: string | null; live: { done: number; total: number } | null; preset: string; setPreset: (s: string) => void;
}) {
  const services = useServices();
  return (
    <div className="panel stack" data-testid="report-status">
      <div className="panel-title">
        <h3>Engine report</h3>
        <span className={`chip ${status === 'complete' ? 'pos' : status === 'failed' ? 'neg' : 'info'}`} data-testid="analysis-status">{status ?? 'not analysed'}</span>
      </div>
      {live && (
        <div>
          <div className="evalbar" aria-label="Analysis progress"><div style={{ width: `${(live.done / Math.max(1, live.total)) * 100}%`, background: 'var(--accent)' }} /></div>
          <div className="row small"><span>Analysing ply {live.done}/{live.total} in a background worker…</span><span className="spacer" /><button className="btn small" onClick={() => void services.cancelAnalysis()}>Cancel</button></div>
        </div>
      )}
      {report && (
        <div className="small muted">
          {report.settings.label} · {report.engine.buildId} · {report.methodology.gradingId} · {report.status === 'partial' ? `PARTIAL (${report.coverage.analysed}/${report.coverage.total} plies)` : `${report.coverage.analysed}/${report.coverage.total} plies`} · {Math.round(report.elapsedMs / 1000)} s
        </div>
      )}
      {reports.length > 1 && (
        <label className="small">Report version{' '}
          <select value={reportIdx} onChange={e => setReportIdx(+e.target.value)}>
            {reports.map((r, i) => <option key={r.id} value={i}>{r.settings.label} · {new Date(r.completedAt).toLocaleString()}</option>)}
          </select>
        </label>
      )}
      {!live && game.status === 'finalized' && (
        <div className="row">
          <select value={preset} onChange={e => setPreset(e.target.value)} aria-label="Analysis depth">
            {ANALYSIS_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className="btn small" disabled={reports.some(r => AppServices.isCurrent(r, preset))} onClick={() => void services.requestAnalysis(game.id, ANALYSIS_PRESETS.find(p => p.id === preset)!)}>
            {reports.length ? 'Analyse with these settings (new version)' : status === 'cancelled' || status === 'failed' ? 'Retry analysis' : 'Analyse'}
          </button>
        </div>
      )}
      {!report && !live && status === 'queued' && <div className="small muted">Queued — analysis starts when no match is in progress.</div>}
    </div>
  );
}

function MovePanel({ p, onExplore, onRetry, humanPov, accuracyId }: { p: PlyAnalysis; onExplore: (c: Candidate, label: string) => void; onRetry: () => void; humanPov: 'white' | 'black'; accuracyId?: string }) {
  const mover = p.color;
  return (
    <div className="panel stack" data-testid="move-panel">
      <div className="panel-title">
        <h3 className="row" style={{ margin: 0 }}><GradeIcon grade={p.grade} provisional={p.gradeProvisional} /> {Math.ceil(p.ply / 2)}{p.color === 'white' ? '.' : '…'} {p.san}</h3>
        <span className="chip" data-testid="move-grade">{p.grade ? GRADE_LABEL[p.grade] : 'Ungraded'}{p.gradeProvisional ? ' (provisional)' : ''}</span>
      </div>
      {p.uncertainGrades && <div className="small notice warn">Uncertain between {p.uncertainGrades.map(g => GRADE_LABEL[g]).join(' / ')} — the loss changed between search depths.</div>}
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
        <div className="stat"><span className="k">Before (best play)</span><span className="v" style={{ fontSize: '1.2rem' }}>{formatScore(p.evalBefore, 'white')}</span></div>
        <div className="stat"><span className="k">After {p.san}</span><span className="v" style={{ fontSize: '1.2rem' }}>{formatScore(p.evalAfter, 'white')}</span></div>
      </div>
      <div className="evalbar" aria-label={`White expected score ${Math.round(whiteU(p.evalAfter, accuracyId) * 100)}%`}><div style={{ width: `${whiteU(p.evalAfter, accuracyId) * 100}%` }} /></div>
      <div className="small muted">
        Scores from White's view. Expected-score loss for {mover}: {p.loss === null ? 'n/a' : p.loss.toFixed(3)}{p.lossInterval ? ` (range across depths ${p.lossInterval[0].toFixed(3)}–${p.lossInterval[1].toFixed(3)})` : ''}{p.cpLoss !== null ? ` · ${Math.round(p.cpLoss)} cp` : ''}.
        {' '}{p.legalCount} legal move{p.legalCount === 1 ? '' : 's'} · depth {p.achievedDepth} · {p.nodes.toLocaleString()} nodes · {p.phase}{p.critical ? ' · critical position' : ''}.
      </div>
      {p.gradeReasons.map((r, i) => <div key={i} className="small">{r}</div>)}
      {p.mateNote && <div className="small">{p.mateNote}</div>}
      {p.notes.map((nt, i) => <div key={i} className="coach"><div>{nt.text}</div><div className="small muted">{nt.evidence}</div></div>)}
      <div>
        <div className="small muted" style={{ marginBottom: 6 }}>Engine candidates (same depth, {mover}'s view) — tap to explore the line</div>
        <div className="stack">
          {p.candidates.map(c => (
            <button key={c.ccn} className="cand" onClick={() => onExplore(c, c.ccn === p.ccn ? 'the played line' : `line after ${c.san}`)} data-testid="candidate">
              <strong>{c.san}{c.ccn === p.best.ccn ? ' ★' : ''}{c.ccn === p.ccn ? ' (played)' : ''}</strong>
              <span className="line">{c.pvSan.slice(1, 8).join(' ')}</span>
              <span className="mono">{formatScore(c.score, mover)}</span>
            </button>
          ))}
        </div>
      </div>
      {p.color === humanPov && p.loss !== null && p.loss > 0.05 && <button className="btn" onClick={onRetry}>Retry from this position (unrated training)</button>}
    </div>
  );
}

function ClockPressure({ game, plies }: { game: GameRecord; plies: PlyAnalysis[] }) {
  if (!game.clocks) return <div className="small muted" style={{ marginTop: 6 }}>Clock pressure: untimed game.</div>;
  const limit = game.timeControl.initialMs * 0.2;
  const mine = plies.filter(p => p.color === game.humanColor && !p.forced && p.loss !== null);
  const low = mine.filter(p => (game.moves[p.ply - 1]?.clockBeforeMs ?? Infinity) < limit);
  const rest = mine.filter(p => !low.includes(p));
  const mean = (a: PlyAnalysis[]) => (a.length ? a.reduce((x, p) => x + p.loss!, 0) / a.length : null);
  const think = mine.map(p => game.moves[p.ply - 1]?.elapsedMs ?? 0);
  const longest = mine.reduce<PlyAnalysis | null>((a, p) => (!a || (game.moves[p.ply - 1]?.elapsedMs ?? 0) > (game.moves[a.ply - 1]?.elapsedMs ?? 0) ? p : a), null);
  return (
    <div className="small" style={{ marginTop: 6 }} data-testid="clock-pressure">
      <strong>Clock:</strong> {low.length ? <>{low.length} decision{low.length === 1 ? '' : 's'} with under 20% of your starting time (average loss {mean(low)!.toFixed(3)} vs {mean(rest)?.toFixed(3) ?? '—'} otherwise; single game, descriptive only).</> : 'you never dropped below 20% of your starting time.'}
      {think.length > 0 && longest && <> Longest think: {Math.round((game.moves[longest.ply - 1].elapsedMs) / 1000)} s on {longest.san} (ply {longest.ply}{longest.critical ? ', a critical position' : ''}).</>}
    </div>
  );
}
