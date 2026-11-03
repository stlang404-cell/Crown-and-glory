import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useApp, useServices } from './App';
import { Board, capturedFrom } from './Board';
import { PieceSvg, PieceKind } from './Pieces';
import { Portrait } from './Portrait';
import { Icon } from './Icons';
import { ROSTER, Opponent, getOpponent, levelRating, opponentSnapshot, CALIBRATION_ID } from '../federation/roster';
import { getLevel } from '../engine/levels';
import { CancelledError } from '../engine/client';
import { GameSession, createGameRecord } from '../games/session';
import { TIME_CONTROLS, TimeControlId, GameRecord, poolFor } from '../games/types';
import { TERMINATION_LABEL } from '../rules/adjudication';
import { Position } from '../rules/position';
import { squareName } from '../rules/types';
import type { RatingEvent, PoolState } from '../ratings/ledger';
import { explainEvent } from '../ratings/ledger';
import type { EngineScore } from '../analysis/types';
import { formatScore } from './Charts';
import type { AssistCandidate } from '../engine/protocol';
import { motifsForLine, threatsAgainst, MOTIF_LABEL } from '../academy/motifs';
import { parseLegalCcn } from '../rules/notation';

const newId = () => `g-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
export const fmtClock = (ms: number) => {
  if (!Number.isFinite(ms)) return '∞';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000);
  return t < 20000 ? `${m}:${String(s).padStart(2, '0')}.${Math.floor((t % 1000) / 100)}` : `${m}:${String(s).padStart(2, '0')}`;
};
export const resultText = (g: GameRecord) => {
  if (!g.result) return 'In progress';
  if (g.result === '1/2-1/2') return 'Draw';
  const humanWon = (g.result === '1-0') === (g.humanColor === 'white');
  return humanWon ? 'Victory' : 'Defeat';
};

export function PlayScreen() {
  const services = useServices();
  const { go } = useApp();
  const [opp, setOpp] = useState<Opponent>(ROSTER[2]);
  const [tc, setTc] = useState<TimeControlId>('rapid');
  const [mode, setMode] = useState<'rated' | 'casual'>('rated');
  const [color, setColor] = useState<'white' | 'black' | 'random'>('random');
  const [unfinished, setUnfinished] = useState<GameRecord[]>([]);
  const [recent, setRecent] = useState<GameRecord | null>(null);
  const [pool, setPool] = useState<PoolState | null>(null);
  const calibrated = levelRating(opp.level) !== null;
  const ratedAllowed = calibrated && tc !== 'untimed';

  useEffect(() => {
    void services.db.unfinishedGames().then(setUnfinished);
    void services.db.allGames().then(gs => setRecent(gs.filter(g => g.status === 'finalized').sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))[0] ?? null));
  }, [services, services.revision]);
  useEffect(() => { const p = poolFor(tc); if (p) void services.db.ratingState(p).then(setPool); else setPool(null); }, [tc, services, services.revision]);

  const start = async () => {
    const humanColor = color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color;
    const rated = mode === 'rated' && ratedAllowed;
    const record = createGameRecord({
      id: newId(), mode: rated ? 'rated' : 'casual', timeControl: TIME_CONTROLS[tc], humanColor,
      human: { kind: 'human', id: 'player', name: 'You', rating: pool?.rating ?? null, rd: pool?.rd ?? null },
      engine: opponentSnapshot(opp), engineSeed: Math.floor(Math.random() * 2 ** 31), nowIso: new Date().toISOString(),
    });
    await services.saveGame(record);
    go({ name: 'match', gameId: record.id });
  };

  return (
    <div>
      <section className="hero">
        <Portrait seed={opp.portraitSeed} size={84} crown={opp.level === 8} />
        <div>
          <h1>Six squares. Every move remembered.</h1>
          <p className="muted" style={{ margin: 0 }}>Play the crown-la6-v1 variant against a genuine local engine. Every game is saved, rated games update your Glicko-2 rating once, and each finished game gets a full engine report.</p>
        </div>
      </section>
      <div className="grid-3" style={{ marginBottom: 14 }} aria-label="Your improvement loop">
        {[
          { k: '1 · Play', t: 'A rated or casual game against a calibrated engine opponent.', a: null },
          { k: '2 · Analyse', t: recent ? `Review every move of your last game vs ${recent.humanColor === 'white' ? recent.black.name : recent.white.name}.` : 'Every finished game gets an engine report.', a: recent ? () => go({ name: 'analysis', gameId: recent.id }) : null },
          { k: '3 · Train', t: 'Verified puzzles, Puzzle Rush and your own mistakes in the Academy.', a: () => go({ name: 'academy' }) },
          { k: '4 · Improve', t: 'Track measured skills with honest uncertainty in the Lab.', a: () => go({ name: 'lab' }) },
        ].map(x => (
          <div key={x.k} className="panel" style={{ padding: 12 }}>
            <div className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>{x.k}</div>
            <div className="small muted">{x.t}</div>
            {x.a && <button className="btn ghost small" style={{ marginTop: 4 }} onClick={x.a}>Open</button>}
          </div>
        ))}
      </div>
      {unfinished.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-title"><h2>Resume</h2></div>
          {unfinished.map(g => (
            <div key={g.id} className="row">
              <span>vs {g.humanColor === 'white' ? g.black.name : g.white.name} · {g.timeControl.label} · {g.moves.length} plies · {g.rated ? 'Rated' : 'Casual'}</span>
              <span className="spacer" />
              <button className="btn primary" onClick={() => go({ name: 'match', gameId: g.id })}>{g.status === 'terminal' ? 'Finish saving' : 'Resume'}</button>
            </div>
          ))}
        </div>
      )}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-title"><h2>Choose your opponent</h2><span className="chip info" title={`Calibration ${CALIBRATION_ID}`}>Calibrated ratings</span></div>
          <div className="stack" role="radiogroup" aria-label="Opponent">
            {ROSTER.map(o => {
              const cal = levelRating(o.level);
              return (
                <button key={o.id} className="opp-card" aria-pressed={opp.id === o.id} onClick={() => setOpp(o)}>
                  <Portrait seed={o.portraitSeed} size={48} crown={o.level === 8} />
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: 6 }}><strong>{o.name}</strong><span className="chip gold">L{o.level} {getLevel(o.level).name}</span></div>
                    <div className="small muted">{o.club} · {getLevel(o.level).description}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cal ? Math.round(cal.rating) : '—'}</div>
                    <div className="small muted">{cal ? `±${Math.round(cal.rd)}` : 'uncalibrated'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="panel stack">
          <h2>Match settings</h2>
          <div>
            <div className="small muted">Time control</div>
            <div className="seg" role="group" aria-label="Time control">
              {(Object.keys(TIME_CONTROLS) as TimeControlId[]).map(id => <button key={id} aria-pressed={tc === id} onClick={() => setTc(id)}>{TIME_CONTROLS[id].label}</button>)}
            </div>
          </div>
          <div>
            <div className="small muted">Mode</div>
            <div className="seg" role="group" aria-label="Mode">
              <button aria-pressed={mode === 'rated'} onClick={() => setMode('rated')} disabled={!ratedAllowed}>Rated</button>
              <button aria-pressed={mode === 'casual' || !ratedAllowed} onClick={() => setMode('casual')}>Casual</button>
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {!calibrated ? 'This opponent has no measured calibration yet, so games are casual.' : tc === 'untimed' ? 'Untimed games are never rated.' : mode === 'rated' ? 'Rated: no engine help during play. One result updates your rating once.' : 'Casual: saved and analysed, never rated.'}
            </div>
          </div>
          <div>
            <div className="small muted">Your colour</div>
            <div className="seg" role="group" aria-label="Colour">
              {(['white', 'random', 'black'] as const).map(c => <button key={c} aria-pressed={color === c} onClick={() => setColor(c)}>{c[0].toUpperCase() + c.slice(1)}</button>)}
            </div>
          </div>
          {pool && mode === 'rated' && ratedAllowed && (
            <div className="notice">
              Your {poolFor(tc)} rating: <strong>{Math.round(pool.rating)}</strong> ±{Math.round(pool.rd)} ({pool.games} games). Expected uncertainty is high until you have played more rated games.
            </div>
          )}
          <button className="btn primary" style={{ width: '100%', fontSize: '1.05rem' }} onClick={start} disabled={services.readOnly}>
            <Icon name="play" /> Start match vs {opp.name}
          </button>
          <details className="small">
            <summary>crown-la6-v1 rules at a glance</summary>
            <ul className="muted">
              <li>6×6 board: rooks, knights, queens, kings and pawns. No bishops.</li>
              <li>Pawns move one square only (no double step, no en passant). No castling.</li>
              <li>Promotion on the last rank is mandatory: queen, rook or knight.</li>
              <li>Threefold repetition and 100 halfmoves without pawn move/capture can be claimed; fivefold and 150 are automatic draws.</li>
              <li>Bare kings is an automatic draw; other low-material endings continue (a declared Crown difference from orthodox chess).</li>
              <li>On time-out you lose if your opponent has any piece besides the king — even one that could not mate. Otherwise it is a draw.</li>
              <li>Draws by agreement are allowed after each side has made ten moves.</li>
            </ul>
          </details>
          {recent && (
            <div className="row small">
              <span className="muted">Last game: {resultText(recent)} vs {recent.humanColor === 'white' ? recent.black.name : recent.white.name}</span>
              <span className="spacer" />
              <button className="btn small" onClick={() => go({ name: 'analysis', gameId: recent.id })}>Open report</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function engineDrawDecision(score: EngineScore | null, plies: number): boolean {
  // The engine accepts a draw only when its own last evaluation says it is worse,
  // or the position is level and the game is long. Evaluations never decide results; this is a player choice.
  if (!score) return false;
  if (score.kind === 'mate') return score.plies < 0;
  if (score.kind === 'terminal') return score.outcome !== 'win';
  return score.value <= -60 || (Math.abs(score.value) <= 20 && plies >= 60);
}

export function MatchScreen({ gameId }: { gameId: string }) {
  const services = useServices();
  const { go } = useApp();
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, force] = useReducer(x => x + 1, 0);
  const [flipped, setFlipped] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [final, setFinal] = useState<{ game: GameRecord; event: RatingEvent | null } | null>(null);
  const [assist, setAssist] = useState<{ kind: string; text: string; candidates?: AssistCandidate[]; hint?: string } | null>(null);
  const [assistBusy, setAssistBusy] = useState(false);
  const engineScore = useRef<EngineScore | null>(null);
  const finalizing = useRef(false);

  useEffect(() => {
    let alive = true;
    void services.db.getGame(gameId).then(g => {
      if (!alive) return;
      if (!g) { setError('Game not found.'); return; }
      if (g.status === 'finalized') { go({ name: 'analysis', gameId }); return; }
      const s = new GameSession(g);
      const t = Date.now(), iso = new Date().toISOString();
      if (g.status !== 'terminal') {
        s.start(t);
        // Reopening a saved game: time while the app was closed is not charged; the gap is recorded as a pause.
        if (g.moves.length > 0 || g.pauses.length > 0) { s.pause(t, 'reload', iso); s.resume(t, iso); }
      }
      setSession(s);
    });
    services.setMatchActive(true);
    return () => { alive = false; services.play.cancel(); services.setMatchActive(false); };
  }, [gameId, services, go]);

  const finalize = useCallback(async (s: GameSession) => {
    if (finalizing.current) return;
    finalizing.current = true;
    services.play.cancel();
    const snap = s.snapshot();
    try {
      await services.saveGame(snap);
      const r = await services.finalize(snap);
      setFinal(r);
    } catch (e) {
      setError(`Could not save the result: ${(e as Error).message}. Your game is kept; reopen it from Play to retry.`);
      finalizing.current = false;
    }
    services.setMatchActive(false);
  }, [services]);

  // terminal-but-not-finalized games (e.g. closed during save) finalize immediately on load
  useEffect(() => { if (session?.isOver) void finalize(session); }, [session, finalize]);

  // clock ticker
  useEffect(() => {
    if (!session || !session.timed) return;
    const id = setInterval(() => {
      const o = session.tick(Date.now(), new Date().toISOString());
      if (o) void finalize(session);
      force();
    }, 100);
    return () => clearInterval(id);
  }, [session, finalize]);

  // pause on app suspension (doc 04: rated clocks pause on suspension; pauses are recorded)
  useEffect(() => {
    if (!session) return;
    const on = () => {
      if (document.visibilityState === 'hidden') { services.play.cancel(); setThinking(false); session.pause(Date.now(), 'visibility', new Date().toISOString()); void services.saveGame(session.snapshot()); }
      else { session.resume(Date.now(), new Date().toISOString()); }
      force();
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [session, services]);

  const engineColor = session ? (session.humanColor ^ 1) : 1;

  // engine move
  useEffect(() => {
    if (!session || session.isOver || session.paused || thinking) return;
    if (session.sideToMove !== engineColor) return;
    const rec = session.record;
    const engine = rec.humanColor === 'white' ? rec.black : rec.white;
    // engine claims an available draw only if it is not better
    const claims = session.claims();
    if ((claims.threefold || claims.fiftyMove) && engineScore.current && engineDrawDecision(engineScore.current, 0)) {
      session.claimDraw(claims.threefold ? 'threefold' : 'fiftyMove', Date.now(), new Date().toISOString());
      void finalize(session);
      force();
      return;
    }
    setThinking(true);
    const ply = rec.moves.length;
    services.play.move({
      initialFen: rec.initialFen, setupMoves: rec.setupMoves, moves: rec.moves.map(m => m.ccn), level: engine.engine!.level, seed: (rec.engineSeed + ply * 7919) >>> 0,
      clock: session.timed ? { remainingMs: session.remaining(engineColor as 0 | 1, Date.now()), incrementMs: rec.timeControl.incrementMs } : undefined,
      newGame: ply < 2,
    }).then(r => {
      setThinking(false);
      engineScore.current = r.score;
      const res = session.applyMove(r.move, Date.now(), new Date().toISOString(), { depth: r.depth, nodes: r.nodes, timeMs: r.timeMs, selected: r.selected, seed: (rec.engineSeed + ply * 7919) >>> 0 });
      if (!res.ok && !res.outcome) setError(`Engine move rejected: ${res.error}`);
      void services.saveGame(session.snapshot());
      if (session.isOver) void finalize(session);
      force();
    }).catch(e => {
      setThinking(false);
      if (!(e instanceof CancelledError)) setError(`Engine error: ${(e as Error).message}`);
    });
  }, [session, session?.plies, session?.paused, thinking, engineColor, services, finalize]);

  useEffect(() => { setAssist(null); }, [session?.plies]);

  const askAssist = async (kind: 'hint' | 'candidates' | 'threat' | 'evaluation' | 'explanation') => {
    if (!session || !session.assistanceAllowed || session.sideToMove !== session.humanColor) return;
    if (!session.markAssisted(kind, new Date().toISOString())) return;
    void services.saveGame(session.snapshot());
    force();
    if (kind === 'threat') {
      const t = threatsAgainst(session.pos, session.humanColor as 0 | 1);
      setAssist({ kind, text: t.mateInOne ? 'Warning: your opponent threatens mate in one.' : t.bestGain >= 100 ? `Your opponent threatens to win about ${Math.round(t.bestGain / 100)} pawn(s) of material on ${squareName(t.square)} (static exchange).` : 'No immediate material or mate-in-one threat (static check; deeper threats are possible).' });
      return;
    }
    setAssistBusy(true);
    try {
      const rec = session.record;
      const r = await services.assist.assist({ initialFen: rec.initialFen, setupMoves: rec.setupMoves, moves: rec.moves.map(m => m.ccn), depth: 6 });
      const best = r.candidates[0];
      const pov = session.humanColor === 0 ? 'white' : 'black';
      if (kind === 'hint') setAssist({ kind, text: `Consider moving the piece on ${best.ccn.slice(0, 2)}.`, hint: best.ccn.slice(0, 2) });
      else if (kind === 'evaluation') setAssist({ kind, text: `Engine evaluation (depth ${r.depth}, your view): ${formatScore(best.score, pov)}.` });
      else if (kind === 'candidates') setAssist({ kind, text: `Top engine candidates at depth ${r.depth}:`, candidates: r.candidates });
      else {
        const line = best.pv;
        const start = session.pos.clone();
        const moves: number[] = [];
        const tmp = start.clone();
        for (const c of line) { const mv = parseLegalCcn(tmp, c); if (mv < 0) break; moves.push(mv); tmp.makeMove(mv); }
        const motifs = motifsForLine(start, moves, best.score.kind === 'mate' && best.score.plies > 0);
        setAssist({ kind, text: `The engine prefers ${best.san} (${formatScore(best.score, pov)}), line ${best.pvSan.slice(0, 6).join(' ')}.${motifs.length ? ` Features found on that line: ${motifs.map(m => MOTIF_LABEL[m.motif].toLowerCase()).join(', ')}.` : ' No specific tactical motif detected; it is a positional preference at this depth.'}` });
      }
    } catch (e) {
      if (!(e instanceof CancelledError)) setAssist({ kind, text: `Assistant unavailable: ${(e as Error).message}` });
    } finally { setAssistBusy(false); }
  };

  const onMove = (ccn: string) => {
    if (!session) return;
    const r = session.applyMove(ccn, Date.now(), new Date().toISOString());
    if (!r.ok && !r.outcome) { setToast(r.error); return; }
    void services.saveGame(session.snapshot());
    if (session.isOver) void finalize(session);
    force();
  };

  const legal = useMemo(() => {
    if (!session || session.isOver || session.sideToMove !== session.humanColor || session.paused) return [];
    return session.legalMoves().map(ccnOf);
  }, [session, session?.plies, session?.isOver, session?.paused]);

  if (error) return <div className="panel"><p role="alert">{error}</p><button className="btn" onClick={() => go({ name: 'play' })}>Back</button></div>;
  if (!session) return <p className="muted">Loading match…</p>;

  const rec = session.record;
  const now = Date.now();
  const humanColor = session.humanColor;
  const orientation: 'white' | 'black' = (humanColor === 0) !== flipped ? 'white' : 'black';
  const top = orientation === 'white' ? 1 : 0;
  const bottom = (top ^ 1) as 0 | 1;
  const fen = session.pos.toFen();
  const last = rec.moves.at(-1)?.ccn ?? null;
  const check = session.pos.inCheck() ? squareName(session.pos.kingSq[session.pos.side]) : null;
  const cap = capturedFrom(fen);
  const claims = session.claims();
  const humanToMove = session.sideToMove === humanColor && !session.isOver;
  const opp = rec.humanColor === 'white' ? rec.black : rec.white;
  const oppMeta = getOpponent(opp.id);

  const bar = (c: 0 | 1) => {
    const p = c === 0 ? rec.white : rec.black;
    const isHuman = c === humanColor;
    const ms = session.remaining(c, now);
    const running = session.timed && session.sideToMove === c && !session.isOver && !session.paused;
    const caps = c === 0 ? cap.byWhite : cap.byBlack;
    const adv = c === 0 ? cap.advantage : -cap.advantage;
    return (
      <div className={`player-bar${session.sideToMove === c && !session.isOver ? ' to-move' : ''}`} data-testid={isHuman ? 'human-bar' : 'engine-bar'}>
        {isHuman ? <div className="portrait" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}><PieceSvg kind="k" color={c === 0 ? 'w' : 'b'} /></div> : <Portrait seed={oppMeta?.portraitSeed ?? 1} size={40} crown={oppMeta?.level === 8} />}
        <div style={{ minWidth: 0 }}>
          <div className="player-name">{p.name} {!isHuman && <span className="chip gold">L{p.engine?.level}</span>}</div>
          <div className="player-meta">
            {p.rating !== null ? `${Math.round(p.rating)} ±${Math.round(p.rd ?? 0)}` : isHuman ? 'Unrated' : 'Uncalibrated'}
            {!isHuman && thinking && session.sideToMove === c && ' · thinking…'}
            {isHuman && <> · {rec.rated ? <span className="chip pos">Rated · unassisted</span> : <span className="chip">Casual</span>}</>}
          </div>
          <div className="captured" aria-label={`Captured by ${p.name}`}>
            {caps.map((k, i) => <PieceSvg key={i} kind={k.toLowerCase() as PieceKind} color={k === k.toUpperCase() ? 'w' : 'b'} />)}
            {adv > 0 && <span className="adv">+{adv}</span>}
          </div>
        </div>
        {session.timed && <div className={`clock${running ? ' running' : ''}${ms < 20000 ? ' low' : ''}`} role="timer" aria-label={`${p.name} clock`}>{fmtClock(ms)}</div>}
      </div>
    );
  };

  const pairs: { n: number; w?: GameRecord['moves'][number]; b?: GameRecord['moves'][number] }[] = [];
  const startBlack = (rec.moves[0] ? Position.fromFen(rec.moves[0].fenAfter).side === 0 : session.pos.side === 1);
  rec.moves.forEach((m, i) => {
    const idx = startBlack ? i + 1 : i;
    const n = Math.floor(idx / 2);
    pairs[n] ??= { n: n + 1 };
    if (idx % 2 === 0) pairs[n].w = m; else pairs[n].b = m;
  });

  return (
    <div className="match" data-testid="match" data-fen={fen} data-turn={session.isOver ? 'over' : humanToMove ? (session.paused ? 'paused' : 'human') : 'engine'} data-human={humanColor === 0 ? 'w' : 'b'}>
      <div className="board-col">
        {bar(top as 0 | 1)}
        <Board fen={fen} orientation={orientation} legal={legal} onMove={onMove} lastMove={last} checkSquare={check} label={`Game against ${opp.name}`} highlights={assist?.hint ? [assist.hint] : []} />
        {bar(bottom)}
        <div className="sr-only" aria-live="polite">{last ? `Last move ${rec.moves.at(-1)!.san}` : 'Game started'}{session.isOver && rec.termination ? `. ${TERMINATION_LABEL[rec.termination]}` : ''}</div>
      </div>
      <div className="side-col">
        <div className="panel">
          <div className="panel-title">
            <h3>{rec.timeControl.label} · {rec.rated ? 'Rated' : 'Casual'}</h3>
            <span className="chip">{session.paused ? 'Paused' : session.isOver ? 'Finished' : humanToMove ? 'Your move' : 'Opponent to move'}</span>
          </div>
          {rec.opening && <div className="small muted" style={{ marginBottom: 8 }}>{rec.opening.name}</div>}
          <div className="moves" aria-label="Move list">
            {pairs.map(p => (
              <div key={p.n} style={{ display: 'contents' }}>
                <span className="n">{p.n}.</span>
                <button tabIndex={-1}>{p.w?.san ?? '…'}</button>
                <button tabIndex={-1}>{p.b?.san ?? ''}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="panel stack">
          <div className="row">
            <button className="btn" onClick={() => setFlipped(f => !f)} aria-label="Flip board"><Icon name="flip" /> Flip</button>
            <button className="btn" disabled={!session.canAgreeDraw() || !humanToMove} onClick={() => {
              const yes = engineDrawDecision(engineScore.current, session.plies);
              if (yes) { session.agreeDraw(Date.now(), new Date().toISOString()); void finalize(session); force(); }
              else setToast(`${opp.name} declines the draw offer.`);
            }} title={session.canAgreeDraw() ? 'Offer a draw' : 'Draws by agreement are allowed after each side has moved ten times'}><Icon name="handshake" /> Offer draw</button>
            {(claims.threefold || claims.fiftyMove) && humanToMove && (
              <button className="btn" onClick={() => { session.claimDraw(claims.threefold ? 'threefold' : 'fiftyMove', Date.now(), new Date().toISOString()); void finalize(session); force(); }}>
                Claim draw ({claims.threefold ? 'threefold' : '100 halfmoves'})
              </button>
            )}
            {!confirmResign
              ? <button className="btn danger" disabled={session.isOver} onClick={() => setConfirmResign(true)}><Icon name="flag" /> Resign</button>
              : <span className="row"><span className="small">Resign this game?</span>
                <button className="btn danger" onClick={() => { session.resign(humanColor as 0 | 1, Date.now(), new Date().toISOString()); setConfirmResign(false); void finalize(session); force(); }}>Yes, resign</button>
                <button className="btn" onClick={() => setConfirmResign(false)}>No</button></span>}
          </div>
          {toast && <div className="notice" role="status" onClick={() => setToast(null)}>{toast}</div>}
          {session.paused && <div className="notice warn">Clocks are paused while the app is in the background. Pauses are recorded with the game.</div>}
          {rec.rated ? (
            <div className="small" data-testid="assist-locked">Rated game: the assistant is locked. Engine help is never available in rated play.</div>
          ) : (
            <div className="stack" data-testid="assist-panel">
              <div className="row small"><strong>Assistant</strong>{rec.assistance.length > 0 && <span className="chip">Assisted · {rec.assistance.length}</span>}<span className="muted">casual game — never rated</span></div>
              <div className="row">
                {(['hint', 'candidates', 'threat', 'evaluation', 'explanation'] as const).map(k => (
                  <button key={k} className="btn small" disabled={!humanToMove || assistBusy || session.paused} onClick={() => void askAssist(k)}>
                    {{ hint: 'Hint', candidates: 'Candidate moves', threat: 'Threat check', evaluation: 'Evaluation', explanation: 'Explain best move' }[k]}
                  </button>
                ))}
              </div>
              {assistBusy && <div className="small muted">Thinking…</div>}
              {assist && (
                <div className="coach" role="status">
                  <div>{assist.text}</div>
                  {assist.candidates && <ul className="small" style={{ margin: '4px 0 0' }}>{assist.candidates.map(c => <li key={c.ccn}><strong>{c.san}</strong> {formatScore(c.score, rec.humanColor)} · <span className="mono">{c.pvSan.slice(1, 6).join(' ')}</span></li>)}</ul>}
                </div>
              )}
            </div>
          )}
          <div className="small muted">Engine: {opp.engine?.searchId} · {opp.engine?.evalId} · calibration {opp.engine?.calibrationId}. {rec.rated ? 'No engine help is available in rated play; analysis opens after the game.' : 'Full engine analysis opens after the game.'}</div>
        </div>
      </div>
      {final && <ResultOverlay final={final} onClose={() => setFinal(null)} />}
    </div>
  );
}

function ccnOf(m: number): string {
  const sq = (s: number) => 'abcdef'[s % 6] + (Math.floor(s / 6) + 1);
  const promo = (m >> 12) & 7;
  return sq(m & 63) + sq((m >> 6) & 63) + (promo ? ' pnrqk'[promo] : '');
}

function ResultOverlay({ final, onClose }: { final: { game: GameRecord; event: RatingEvent | null }; onClose: () => void }) {
  const { go, services } = useApp();
  const g = final.game, e = final.event;
  const opp = g.humanColor === 'white' ? g.black : g.white;
  const rematch = async () => {
    const o = getOpponent(opp.id);
    if (!o) return go({ name: 'play' });
    const pool = g.pool ? await services.db.ratingState(g.pool) : null;
    const rec = createGameRecord({
      id: newId(), mode: g.rated ? 'rated' : 'casual', timeControl: g.timeControl, humanColor: g.humanColor === 'white' ? 'black' : 'white',
      human: { kind: 'human', id: 'player', name: 'You', rating: pool?.rating ?? null, rd: pool?.rd ?? null },
      engine: opponentSnapshot(o), engineSeed: Math.floor(Math.random() * 2 ** 31), nowIso: new Date().toISOString(),
    });
    await services.saveGame(rec);
    go({ name: 'match', gameId: rec.id });
  };
  return (
    <div className="result-overlay" role="dialog" aria-modal="true" aria-label="Game result">
      <div className="result-card stack">
        <div className="result-title">{resultText(g)}</div>
        <div className="muted">{g.result} · {g.termination ? TERMINATION_LABEL[g.termination] : ''} · vs {opp.name}</div>
        {e ? (
          <div>
            <div className={`delta ${e.delta >= 0 ? 'up' : 'down'}`} data-testid="rating-delta">{e.delta >= 0 ? '+' : ''}{e.delta.toFixed(1)}</div>
            <div>{e.pool[0].toUpperCase() + e.pool.slice(1)} rating {Math.round(e.before.rating)} → <strong>{Math.round(e.after.rating)}</strong> (±{Math.round(e.after.rd)}){e.provisionalAfter ? ' · provisional' : ''}</div>
            <p className="small muted">{explainEvent(e)}</p>
          </div>
        ) : <p className="muted">{g.rated ? 'Rating update unavailable.' : 'Casual game — saved to your Library, no rating change.'}</p>}
        <p className="small muted">Saved permanently. The engine report is being prepared in the background.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => go({ name: 'analysis', gameId: g.id })}>View analysis</button>
          <button className="btn" onClick={rematch}>Rematch</button>
          <button className="btn ghost" onClick={() => { onClose(); go({ name: 'play' }); }}>New game</button>
        </div>
      </div>
    </div>
  );
}

export { formatScore };
