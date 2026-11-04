import { AppServices } from '../app/services';
import { useEffect, useMemo, useState, KeyboardEvent } from 'react';
import { useApp, useServices } from './App';
import { Board } from './Board';
import { EvalGraph, formatScore, whiteU } from './Charts';
import { fmtClock, resultText } from './PlayScreen';
import { Captured, Clock, GRADE_LABEL, GradeIcon, KingAvatar, MatchHeader, MatchLayout, MoveNav, NotationList, PlayerBar } from './MatchCenter';
import { Portrait } from './Portrait';
import { Position } from '../rules/position';
import { parseLegalCcn } from '../rules/notation';
import { squareName } from '../rules/types';
import { TERMINATION_LABEL } from '../rules/adjudication';
import { ANALYSIS_PRESETS, DEFAULT_ANALYSIS } from '../analysis/analyzer';
import type { AnalysisReport, Candidate, PlyAnalysis, SideSummary } from '../analysis/types';
import { GRADES } from '../analysis/types';
import type { GameRecord } from '../games/types';
import type { RatingEvent } from '../ratings/ledger';
import { explainEvent } from '../ratings/ledger';
import { createGameRecord } from '../games/session';
import { getOpponent, opponentSnapshot } from '../federation/roster';
import { TIME_CONTROLS } from '../games/types';
import { exportGame } from '../storage/backup';

export { GRADE_LABEL, GradeIcon } from './MatchCenter';

/** Replay autoplay speeds (Match Center replay control). */
const REPLAY_SPEEDS = [{ label: 'Slow', ms: 2000 }, { label: 'Normal', ms: 1100 }, { label: 'Fast', ms: 450 }] as const;

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

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      let g: GameRecord | undefined;
      try { g = await services.db.getGame(gameId); }
      catch (e) { setLoadError(String((e as Error)?.message ?? e)); setLoadState('error'); return; }
      setGame(g ?? null);
      setLoadState(g ? 'ready' : 'missing');
      if (!g) return;
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

  // replay autoplay (Match Center): play/pause and speed, stops at the last move or when a variation is explored.
  // Declared before the loading return so the hook order never changes between renders.
  const [auto, setAuto] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [tab, setTab] = useState<'moves' | 'summary'>('moves');
  const total = game?.moves.length ?? 0;
  useEffect(() => {
    if (!auto) return;
    if (variation || ply >= total) { setAuto(false); return; }
    const t = setTimeout(() => setPly(x => Math.min(total, x + 1)), REPLAY_SPEEDS[speedIdx].ms);
    return () => clearTimeout(t);
  }, [auto, ply, total, speedIdx, variation]);

  if (loadState === 'error') return (
    <div className="panel" role="alert" data-testid="analysis-load-error"><h2 style={{ marginTop: 0 }}>This game could not be loaded</h2>
      <p>The saved game could not be read from this device's storage{loadError ? ` (${loadError})` : ''}. Reload the page to try again; your other games are not affected.</p>
      <div className="row" style={{ gap: 8 }}><button className="btn primary" onClick={() => location.reload()}>Reload</button><button className="btn" onClick={() => go({ name: 'analyses' })}>All Games</button></div></div>
  );
  if (loadState === 'missing') return (
    <div className="panel" data-testid="analysis-missing"><h2 style={{ marginTop: 0 }}>Game not found</h2>
      <p>This game is not saved on this device. It may have been played in another browser, or the link is out of date.</p>
      <button className="btn primary" onClick={() => go({ name: 'analyses' })}>Choose a Game</button></div>
  );
  if (!game) return <p className="muted" role="status" data-testid="analysis-loading">Loading game…</p>;
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

  const startsWithBlack = fens.length > 0 && Position.fromFen(fens[0]).side === 1;
  const stepBack = () => (variation ? setVariation(v => v && (v.idx > 0 ? { ...v, idx: v.idx - 1 } : null)) : goPly(ply - 1));
  const stepForward = () => (variation ? setVariation(v => v && { ...v, idx: Math.min(v.line.length - 1, v.idx + 1) }) : goPly(ply + 1));
  // clock of each side after its last move up to the shown ply (recorded games only; untimed games have none)
  const clockAt = (color: 'white' | 'black'): number | null => {
    if (!game.clocks) return null;
    for (let i = ply - 1; i >= 0; i--) {
      const mover = (i + (startsWithBlack ? 1 : 0)) % 2 === 0 ? 'white' : 'black';
      if (mover === color) return game.moves[i].clockAfterMs;
    }
    return game.timeControl.initialMs;
  };
  const sideToMove = posNow.side === 0 ? 'white' : 'black';
  const bar = (color: 'white' | 'black') => {
    const p = color === 'white' ? game.white : game.black;
    const isHuman = color === game.humanColor;
    const meta = getOpponent(p.id);
    const ms = clockAt(color);
    return (
      <PlayerBar color={color} active={!variation && ply < n && sideToMove === color}
        avatar={isHuman ? <KingAvatar color={color} /> : <Portrait seed={meta?.portraitSeed ?? 1} size={40} crown={(meta?.level ?? 0) >= 8} />}
        name={p.name} meta={p.rating !== null ? `${Math.round(p.rating)} ±${Math.round(p.rd ?? 0)}` : isHuman ? 'Unrated' : 'Not yet rated'}
        aside={ms !== null && Number.isFinite(ms) ? <Clock text={fmtClock(ms)} label={`${p.name} clock after this move`} /> : undefined}>
        <Captured fen={fen} color={color} name={p.name} />
      </PlayerBar>
    );
  };
  const topColor = orientation === 'white' ? 'black' : 'white';
  const rating = (p: GameRecord['white']) => (p.rating !== null ? String(Math.round(p.rating)) : null);

  const board = (
    <>
      {bar(topColor)}
      <Board sounds fen={fen} orientation={orientation} lastMove={lastMove} checkSquare={check} arrows={arrows} label="Analysis board" />
      {bar(topColor === 'white' ? 'black' : 'white')}
      <MoveNav onFirst={() => goPly(0)} onPrev={stepBack} onNext={stepForward} onLast={() => goPly(n)} onFlip={() => setFlipped(f => !f)}
        indicator={<span className="chip mono" data-testid="ply-indicator">{variation ? `variation ${variation.idx + 1}/${variation.line.length}` : `ply ${ply}/${n}`}</span>}
        replay={{ playing: auto, onToggle: () => { if (ply >= n) setPly(0); setAuto(a => !a); }, testId: 'replay-play', speeds: REPLAY_SPEEDS, speed: speedIdx, onSpeed: setSpeedIdx }} />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn small" disabled={!!variation} aria-pressed={bookmarks.some(b => b.ply === ply && !b.memorable)} onClick={() => void toggleBookmark(false)} data-testid="bookmark">{bookmarks.some(b => b.ply === ply && !b.memorable) ? '★ Bookmarked' : '☆ Bookmark Position'}</button>
        <button className="btn small" disabled={!!variation || ply === 0} onClick={() => void toggleBookmark(true)}>{bookmarks.some(b => b.ply === ply && b.memorable) ? '♛ Memorable Move' : '♔ Mark Memorable'}</button>
        {bookmarks.length > 0 && <span className="small muted">Saved: {[...new Set(bookmarks.map(b => b.ply))].sort((a, b) => a - b).map(k => <button key={k} className="btn ghost small" onClick={() => goPly(k)}>{k}</button>)}</span>}
      </div>
      {variation && (
        <div className="notice">
          Exploring {variation.label}: <span className="mono">{variation.sans.map((s, i) => <button key={i} className="btn ghost small" style={{ minHeight: 28, padding: '0 4px', fontWeight: i === variation.idx ? 800 : 400 }} onClick={() => setVariation({ ...variation, idx: i })}>{s}</button>)}</span>
          <button className="btn small" onClick={() => setVariation(null)}>Return to Main Line</button>
        </div>
      )}
    </>
  );

  const movesPanel = (
    <>
      <ReportStatus game={game} report={report} reports={reports} reportIdx={reportIdx} setReportIdx={setReportIdx} status={status} live={live} preset={preset} setPreset={setPreset} />
      {cur ? <MovePanel p={cur} onExplore={(c, label) => explore(ply - 1, c, label)} onRetry={retry} humanPov={humanPov} accuracyId={report?.methodology.accuracyId} /> : (
        <div className="panel"><h3>{ply === 0 ? 'Starting Position' : `Move ${Math.ceil(ply / 2)}`}</h3><p className="muted small">{ply === 0 ? 'Pick a move in the list or graph, or use the ← → keys.' : "This move hasn't been analysed yet."}</p></div>
      )}
      <div className="panel">
        <h3>Moves</h3>
        <NotationList label="Analysed move list" startsWithBlack={startsWithBlack} current={variation ? 0 : ply} onSelect={goPly}
          moves={game.moves.map((m, i) => { const pa = plies.find(p => p.ply === i + 1); return { san: m.san, grade: pa?.grade ?? null, provisional: pa?.gradeProvisional }; })} />
      </div>
      <div className="panel">
        <div className="panel-title"><h3>Evaluation</h3><span className="small muted">Higher is better for White</span></div>
        {plies.length ? <EvalGraph plies={plies} total={n} selected={ply} onSelect={goPly} accuracyId={report?.methodology.accuracyId} /> : <p className="muted">No evaluation yet. The graph appears as the analysis finishes.</p>}
      </div>
    </>
  );

  const summaryPanel = (
    <>
      {report && mine && theirs && (
        <div className="panel">
          <div className="panel-title"><h3>Summary</h3><span className="chip gold" title="Grades and accuracy are still being tuned">Experimental</span></div>
          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="stat"><span className="k">Your Accuracy</span><span className="v" data-testid="accuracy">{fmtAcc(mine.accuracy)}</span><span className="small muted">{mine.eligible} graded moves · {mine.forced} forced moves skipped</span></div>
            <div className="stat"><span className="k">{opp.name}</span><span className="v">{fmtAcc(theirs.accuracy)}</span><span className="small muted">{theirs.eligible} graded moves</span></div>
          </div>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Grade</th><th>You</th><th>{opp.name.split(' ')[0]}</th></tr></thead>
            <tbody>{GRADES.map(g => <tr key={g}><td><GradeIcon grade={g} /> {GRADE_LABEL[g]}</td><td>{mine.counts[g]}</td><td>{theirs.counts[g]}</td></tr>)}</tbody>
          </table>
          <div className="small muted" style={{ marginTop: 8 }}>
            Your accuracy by phase: opening {fmtAcc(mine.phaseAccuracy.opening.accuracy)} · middlegame {fmtAcc(mine.phaseAccuracy.middlegame.accuracy)} · endgame {fmtAcc(mine.phaseAccuracy.endgame.accuracy)} (“—” means the game never reached that phase).<br />
            Critical moments handled: {mine.critical.handled}/{mine.critical.total} · Best moves: {mine.bestFrequency === null ? '—' : `${Math.round(mine.bestFrequency * 100)}%`}.<br />
            Accuracy runs from 0 to 100 and shows how close your moves were to the engine's in this game. It is not a rating or an IQ.
            {report.methodology.accuracyId === 'crown-accuracy-v2'
              ? null
              : report.methodology.accuracyId === 'crown-accuracy-v1'
              ? ' Historical report: made with an older engine and kept unchanged. Analyse again for an up-to-date report.'
              : ' This report uses early, untuned settings. Analyse again for an up-to-date report.'}
          </div>
          <details className="small">
            <summary>Details</summary>
            <div className="muted">
              Graded moves by phase: opening {mine.phaseAccuracy.opening.eligible} · middlegame {mine.phaseAccuracy.middlegame.eligible} · endgame {mine.phaseAccuracy.endgame.eligible}.<br />
              Average loss on centipawn-scored moves: {mine.avgCpLoss === null ? '—' : `${Math.round(mine.avgCpLoss)} cp (${mine.cpLossMoves} moves; mate positions excluded)`}.<br />
              {report.methodology.accuracyId === 'crown-accuracy-v2'
                ? 'Accuracy = 100·exp(−4·mean expected-score loss), always between 0 and 100. The expected-score map (crown-outcome-map-v2) was refitted for the current engine and validated on held-out opening families; the grade boundaries and k = 4 remain experimental.'
                : report.methodology.accuracyId === 'crown-accuracy-v1'
                ? 'Engine crown-search-1 + crown-eval-3, map crown-outcome-map-v1. Accuracy = 100·exp(−4·mean expected-score loss), always between 0 and 100.'
                : 'Accuracy = 100·exp(−4·mean expected-score loss), always between 0 and 100; logistic scale s = 200 cp (methodology v0, uncalibrated placeholders).'}
              <br />Calibration: {report.methodology.calibration}
            </div>
          </details>
          <ClockPressure game={game} plies={plies} />
          <div className="row" style={{ marginTop: 10 }}>
            {report.highlights.worstMistake && <button className="btn small" onClick={() => goPly(report.highlights.worstMistake!)}>Biggest Mistake (Move {Math.ceil(report.highlights.worstMistake / 2)})</button>}
            {report.highlights.biggestMiss && <button className="btn small" onClick={() => goPly(report.highlights.biggestMiss!)}>Missed Chance (Move {Math.ceil(report.highlights.biggestMiss / 2)})</button>}
            {report.highlights.bestTactic && <button className="btn small" onClick={() => goPly(report.highlights.bestTactic!)}>Best Find (Move {Math.ceil(report.highlights.bestTactic / 2)})</button>}
          </div>
          {report.turningPoints.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>Turning points: {report.turningPoints.map(t => <button key={t} className="btn ghost small" onClick={() => goPly(t)}>{t}</button>)}</div>}
        </div>
      )}
      {report && report.recommendations.length > 0 && (
        <div className="panel">
          <h3>Training Focus</h3>
          {report.recommendations.slice(0, 3).map(r => (
            <div key={r.topic} className="coach" style={{ marginBottom: 8 }}>
              <strong>{r.label}</strong>
              <div className="small muted">{r.basis}</div>
              {r.plies.length > 0 && <div className="small">Moments: {r.plies.map(k => <button key={k} className="btn ghost small" onClick={() => goPly(k)}>move {Math.ceil(k / 2)}</button>)}</div>}
            </div>
          ))}
        </div>
      )}
      {event && (
        <div className="panel">
          <h3>Rating Change</h3>
          <div className={`delta ${event.delta >= 0 ? 'up' : 'down'}`}>{event.delta >= 0 ? '+' : ''}{event.delta.toFixed(1)}</div>
          <p className="small">{explainEvent(event)}</p>
          <details className="small">
            <summary>Details</summary>
            <span className="muted">Glicko-2 (rating/RD/volatility): {Math.round(event.before.rating)}/{Math.round(event.before.rd)}/{event.before.sigma.toFixed(4)} → {Math.round(event.after.rating)}/{Math.round(event.after.rd)}/{event.after.sigma.toFixed(4)} · event {event.id}</span>
          </details>
        </div>
      )}
      {!(report && mine && theirs) && !(report && report.recommendations.length > 0) && !event && (
        <div className="panel"><h3>Summary</h3><p className="muted small">The game summary appears when the analysis is complete.</p></div>
      )}
    </>
  );

  return (
    <div className="mc analysis-screen" onKeyDown={onKey} tabIndex={-1} style={{ outline: 'none' }}>
      <MatchHeader
        back={{ label: '← All Games', onClick: () => go({ name: 'analyses' }) }}
        kicker="Game Review"
        title={`${resultText(game)} vs ${opp.name}`}
        subtitle={game.context.eventName}
        status={<>
          <span className="chip">{game.result ?? '*'} · {game.termination ? TERMINATION_LABEL[game.termination] : 'Unfinished'}</span>
          <span className="chip">{game.timeControl.label}</span>
          <span className={`chip ${game.rated ? 'pos' : ''}`}>{game.mode === 'training' ? 'Training' : game.rated ? 'Rated' : 'Casual'}</span>
        </>}
        actions={<button className="btn small" onClick={() => download(`${game.id}.crown-game.json`, exportGame(game))}>Export Game</button>}
        white={{ name: game.white.name, rating: rating(game.white) }}
        black={{ name: game.black.name, rating: rating(game.black) }}
        result={game.result ?? null} />
      <MatchLayout board={board} active={tab} onActive={t => setTab(t as typeof tab)} tabsLabel="Analysis Panels"
        panels={[{ id: 'moves', label: 'Moves & Eval', content: movesPanel }, { id: 'summary', label: 'Summary', content: summaryPanel }]} />
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
        <h3>Match Analysis</h3>
        <span className={`chip ${status === 'complete' ? 'pos' : status === 'failed' ? 'neg' : 'info'}`} data-testid="analysis-status">{status ?? 'not analysed'}</span>
      </div>
      {live && (
        <div>
          <div className="evalbar" aria-label="Analysis progress"><div style={{ width: `${(live.done / Math.max(1, live.total)) * 100}%`, background: 'var(--accent)' }} /></div>
          <div className="row small"><span>Analysing… {live.done}/{live.total} positions</span><span className="spacer" /><button className="btn small" onClick={() => void services.cancelAnalysis()}>Cancel</button></div>
        </div>
      )}
      {report && (
        <div className="small muted">
          {report.settings.label}{report.status === 'partial' ? ` · Partial: ${report.coverage.analysed} of ${report.coverage.total} positions analysed` : ''} · {Math.round(report.elapsedMs / 1000)} s
          <details className="small">
            <summary>Details</summary>
            Engine {report.engine.buildId} · grading {report.methodology.gradingId} · {report.coverage.analysed}/{report.coverage.total} plies analysed
          </details>
        </div>
      )}
      {reports.length > 1 && (
        <label className="small">Version{' '}
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
            {reports.length ? 'Analyse Again' : status === 'cancelled' || status === 'failed' ? 'Retry Analysis' : 'Analyse Game'}
          </button>
        </div>
      )}
      {!report && !live && status === 'queued' && <div className="small muted">Queued. Analysis starts when you are not in a match.</div>}
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
      {p.uncertainGrades && <div className="small notice warn">Between {p.uncertainGrades.map(g => GRADE_LABEL[g]).join(' and ')}: the verdict changed with deeper search.</div>}
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
        <div className="stat"><span className="k">Before (Best Play)</span><span className="v" style={{ fontSize: '1.2rem' }}>{formatScore(p.evalBefore, 'white')}</span></div>
        <div className="stat"><span className="k">After {p.san}</span><span className="v" style={{ fontSize: '1.2rem' }}>{formatScore(p.evalAfter, 'white')}</span></div>
      </div>
      <div className="evalbar" aria-label={`White expected score ${Math.round(whiteU(p.evalAfter, accuracyId) * 100)}%`}><div style={{ width: `${whiteU(p.evalAfter, accuracyId) * 100}%` }} /></div>
      <div className="small muted">
        Scores are from White's side. {p.legalCount} legal move{p.legalCount === 1 ? '' : 's'} · {p.phase}{p.critical ? ' · critical position' : ''}.
        <details className="small">
          <summary>Details</summary>
          Expected-score loss for {mover}: {p.loss === null ? 'n/a' : p.loss.toFixed(3)}{p.lossInterval ? ` (range across depths ${p.lossInterval[0].toFixed(3)}–${p.lossInterval[1].toFixed(3)})` : ''}{p.cpLoss !== null ? ` · ${Math.round(p.cpLoss)} cp` : ''} · depth {p.achievedDepth} · {p.nodes.toLocaleString()} nodes
        </details>
      </div>
      {p.gradeReasons.map((r, i) => <div key={i} className="small">{r}</div>)}
      {p.mateNote && <div className="small">{p.mateNote}</div>}
      {p.notes.map((nt, i) => <div key={i} className="coach"><div>{nt.text}</div><div className="small muted">{nt.evidence}</div></div>)}
      <div>
        <div className="small muted" style={{ marginBottom: 6 }}>Engine moves, scored from {mover}'s side. Tap one to explore its line.</div>
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
      {p.color === humanPov && p.loss !== null && p.loss > 0.05 && <button className="btn" onClick={onRetry}>Retry from This Position (Unrated)</button>}
    </div>
  );
}

function ClockPressure({ game, plies }: { game: GameRecord; plies: PlyAnalysis[] }) {
  if (!game.clocks) return <div className="small muted" style={{ marginTop: 6 }}>Clock: untimed game.</div>;
  const limit = game.timeControl.initialMs * 0.2;
  const mine = plies.filter(p => p.color === game.humanColor && !p.forced && p.loss !== null);
  const low = mine.filter(p => (game.moves[p.ply - 1]?.clockBeforeMs ?? Infinity) < limit);
  const rest = mine.filter(p => !low.includes(p));
  const mean = (a: PlyAnalysis[]) => (a.length ? a.reduce((x, p) => x + p.loss!, 0) / a.length : null);
  const think = mine.map(p => game.moves[p.ply - 1]?.elapsedMs ?? 0);
  const longest = mine.reduce<PlyAnalysis | null>((a, p) => (!a || (game.moves[p.ply - 1]?.elapsedMs ?? 0) > (game.moves[a.ply - 1]?.elapsedMs ?? 0) ? p : a), null);
  return (
    <div className="small" style={{ marginTop: 6 }} data-testid="clock-pressure">
      <strong>Clock:</strong> {low.length ? <>{low.length} move{low.length === 1 ? '' : 's'} played with under 20% of your starting time (average loss {mean(low)!.toFixed(3)} vs {mean(rest)?.toFixed(3) ?? '—'} otherwise).</> : 'you never dropped below 20% of your starting time.'}
      {think.length > 0 && longest && <> Longest think: {Math.round((game.moves[longest.ply - 1].elapsedMs) / 1000)} s on {longest.san}{longest.critical ? ', a critical position' : ''}.</>}
    </div>
  );
}
