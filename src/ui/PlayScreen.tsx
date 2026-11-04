import { CONTEMPORARY_DISCLOSURE, isContemporaryId, shownPersona } from '../federation/rosterPersonas';
import { fmtCareerElo } from '../ratings/display';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useApp, useServices } from './App';
import { Board } from './Board';
import { Captured, Clock, KingAvatar, MatchHeader, MatchLayout, MoveNav, NotationList, PlayerBar, moveKeys } from './MatchCenter';
import { Portrait } from './Portrait';
import { Icon } from './Icons';
import { ROSTER, CALIBRATION_ID } from '../federation/roster';
import { BEGINNER_OPPONENTS, PLAY_OPPONENTS, PlayOpponent, findOpponent, opponentLevelLabel, opponentProfile, opponentRating, playOpponentSnapshot } from '../federation/opponents';
import { BEGINNER_CALIBRATION_ID } from '../federation/profiles';
import { MAX_BUDGET_NAMES, MAX_BUDGETS_S, MAX_LEVEL, MAX_RATED_BUDGET_S, maxProfile } from '../engine/levels';
import { CancelledError } from '../engine/client';
import { GameSession, createGameRecord } from '../games/session';
import { TIME_CONTROLS, TimeControlId, GameRecord, poolFor } from '../games/types';
import { TERMINATION_LABEL } from '../rules/adjudication';
import { Position } from '../rules/position';
import { squareName } from '../rules/types';
import type { RatingEvent, PoolState } from '../ratings/ledger';
import { explainEvent } from '../ratings/ledger';
import { ratingChange } from '../ratings/display';
import { RatingChangeLine } from './CareerElo';
import type { EngineScore } from '../analysis/types';
import { formatScore } from './Charts';
import type { AssistCandidate } from '../engine/protocol';
import { motifsForLine, threatsAgainst, MOTIF_LABEL } from '../academy/motifs';
import { parseLegalCcn } from '../rules/notation';
import { FederationService } from '../app/federation';
import { claimsOf, claimPrices, statesOf } from '../exchange/market';
import { fmtCrowns, fmtPrice } from '../exchange/ledger';
import { wdl } from '../federation/resultModel';
import { playOnce, playSound } from './sound';
import { QuickMatch } from './QuickMatch';
import { PlayedLikeResultLines } from './PlayedLikeCard';
import { clearPractice, peekPractice } from '../app/practice';

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
  // A practice game handed over by another screen (the Grimoire's Today's Plan): preselect its opponent and time
  // control, and Casual — a practice setup never starts a rated game by itself (src/app/practice.ts).
  const [practice] = useState(() => peekPractice());
  useEffect(() => { if (practice) clearPractice(); }, [practice]);
  const [opp, setOpp] = useState<PlayOpponent>(() => (practice && findOpponent(practice.opponentId)) || ROSTER[2]);
  const [tc, setTc] = useState<TimeControlId>(practice?.timeControl ?? 'rapid');
  const [mode, setMode] = useState<'rated' | 'casual'>(practice ? 'casual' : 'rated');
  const [color, setColor] = useState<'white' | 'black' | 'random'>('random');
  const [unfinished, setUnfinished] = useState<GameRecord[]>([]);
  const [recent, setRecent] = useState<GameRecord | null>(null);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [budget, setBudget] = useState<number>(MAX_RATED_BUDGET_S);
  const isMax = opp.level === MAX_LEVEL;
  // Sovereign Unbound is calibrated only at its rated budget; other budgets are casual
  const calibrated = opponentRating(opp) !== null && (!isMax || budget === MAX_RATED_BUDGET_S);
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
      engine: playOpponentSnapshot(opp, budget), engineSeed: Math.floor(Math.random() * 2 ** 31), nowIso: new Date().toISOString(),
    });
    await services.saveGame(record);
    go({ name: 'match', gameId: record.id });
  };

  return (
    <div>
      <section className="hero">
        <Portrait seed={opp.portraitSeed} size={84} crown={opp.level >= 8} />
        <div>
          <h1>Six Squares. Every Move Remembered.</h1>
          <p className="muted" style={{ margin: 0 }}>Six-square chess against engine opponents. Every game is saved, rated games change your rating, and every finished game gets a full analysis.</p>
        </div>
      </section>
      <QuickMatch />
      <div className="grid-3" style={{ marginBottom: 14 }} aria-label="Your improvement loop">
        {[
          { k: '1 · Play', t: 'Play a rated or casual game against an engine opponent.', a: null },
          { k: '2 · Analyse', t: recent ? `Review every move of your last game vs ${recent.humanColor === 'white' ? recent.black.name : recent.white.name}.` : 'Every finished game gets a full analysis.', a: recent ? () => go({ name: 'analysis', gameId: recent.id }) : null },
          { k: '3 · Train', t: 'Solve puzzles, play Puzzle Rush and replay your own mistakes in the Academy.', a: () => go({ name: 'academy' }) },
          { k: '4 · Improve', t: 'Track how your skills change over time in the Lab.', a: () => go({ name: 'lab' }) },
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
              <span>vs {g.humanColor === 'white' ? g.black.name : g.white.name} · {g.timeControl.label} · {Math.ceil(g.moves.length / 2)} moves · {g.rated ? 'Rated' : 'Casual'}</span>
              <span className="spacer" />
              <button className="btn primary" onClick={() => go({ name: 'match', gameId: g.id })}>{g.status === 'terminal' ? 'Finish Saving' : 'Resume'}</button>
            </div>
          ))}
        </div>
      )}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-title"><h2>Choose Your Opponent</h2><span className="chip info" title="Opponent ratings are measured from test games">Measured Ratings</span></div>
          <div className="stack" role="radiogroup" aria-label="Opponent">
            {PLAY_OPPONENTS.map((o: PlayOpponent, i) => {
              const cal = opponentRating(o);
              const beginner = !!o.beginner;
              return (<div key={o.id} style={{ display: 'contents' }}>
                {i === 0 && <div className="small muted" data-testid="beginner-group" style={{ fontWeight: 700 }}>Beginners · under 800 · they miss threats and sometimes play random moves</div>}
                {i === BEGINNER_OPPONENTS.length && <div className="small muted" style={{ fontWeight: 700, marginTop: 6 }}>Calibrated ladder · 800 and up</div>}
                <button className="opp-card" aria-pressed={opp.id === o.id} onClick={() => setOpp(o)} data-testid={beginner ? `opp-beginner-${o.beginner}` : undefined}>
                  <Portrait seed={o.portraitSeed} size={48} crown={o.level >= 8} />
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}><strong>{o.name}</strong><span className={beginner ? 'chip info' : 'chip gold'}>{opponentLevelLabel(o)}</span>{beginner && <span className="chip">Beginner</span>}</div>
                    <div className="small muted">{o.club} · {opponentProfile(o).description}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{cal ? fmtCareerElo(cal.rating) : '—'}</div>
                    <div className="small muted">{cal ? `±${Math.round(cal.rd)}` : 'not yet rated'}</div>
                  </div>
                </button>
              </div>);
            })}
          </div>
          <details className="small">
            <summary>Details</summary>
            <p className="muted">Opponent ratings come from measured engine test games (calibration {CALIBRATION_ID}; beginners {BEGINNER_CALIBRATION_ID}, measured by matches chained down from L1 = 800). Ratings are engine-vs-engine on the Crown scale, not FIDE or human ratings.</p>
          </details>
        </div>
        <div className="panel stack">
          <h2>Match Settings</h2>
          {practice && mode === 'casual' && opp.id === practice.opponentId && (
            <div className="notice" data-testid="practice-preset">Practice game from Today’s Plan: {opp.name}, {TIME_CONTROLS[tc].label}, Casual — saved and analysed, never rated.</div>
          )}
          <div>
            <div className="small muted">Time Control</div>
            <div className="seg" role="group" aria-label="Time control">
              {(Object.keys(TIME_CONTROLS) as TimeControlId[]).map(id => <button key={id} aria-pressed={tc === id} onClick={() => setTc(id)}>{TIME_CONTROLS[id].label}</button>)}
            </div>
          </div>
          {isMax && (
            <div data-testid="max-budget">
              <div className="small muted">Thinking Time per Move</div>
              <div className="seg" role="group" aria-label="Thinking budget">
                {MAX_BUDGETS_S.map(b => <button key={b} aria-pressed={budget === b} onClick={() => setBudget(b)} aria-label={`${b} s`}>{MAX_BUDGET_NAMES[b]} · {b} s</button>)}
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>The most Sovereign Unbound thinks per move. The clock can cut a move short but never extends it. Rated games use {MAX_RATED_BUDGET_S} s.</div>
              <details className="small">
                <summary>Details</summary>
                <span className="muted">Engine: {maxProfile(budget).description.split(':')[0]} · crown-search-2 + crown-eval-4 · {(1 << (maxProfile(budget).ttBits ?? 18)) * 11 / 1048576 | 0} MB table · no random choices, no handicap.</span>
              </details>
            </div>
          )}
          <div>
            <div className="small muted">Mode</div>
            <div className="seg" role="group" aria-label="Mode">
              <button aria-pressed={mode === 'rated'} onClick={() => setMode('rated')} disabled={!ratedAllowed}>Rated</button>
              <button aria-pressed={mode === 'casual' || !ratedAllowed} onClick={() => setMode('casual')}>Casual</button>
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {!calibrated ? (isMax && opponentRating(opp) ? `Only the ${MAX_RATED_BUDGET_S} s setting is rated, so this game is casual.` : 'This opponent has no rating yet, so games are casual.') : tc === 'untimed' ? 'Untimed games are never rated.' : mode === 'rated' ? 'Rated: no engine help during play, and the result changes your rating.' : 'Casual: saved and analysed, never rated.'}
            </div>
          </div>
          <div>
            <div className="small muted">Your Colour</div>
            <div className="seg" role="group" aria-label="Colour">
              {(['white', 'random', 'black'] as const).map(c => <button key={c} aria-pressed={color === c} onClick={() => setColor(c)}>{c[0].toUpperCase() + c.slice(1)}</button>)}
            </div>
          </div>
          {pool && mode === 'rated' && ratedAllowed && (
            <div className="notice">
              Your {poolFor(tc)} rating: <strong>{fmtCareerElo(pool.rating)}</strong> ±{Math.round(pool.rd)} ({pool.games} games). It becomes more certain as you play more rated games.
            </div>
          )}
          <button className="btn primary" style={{ width: '100%', fontSize: '1.05rem' }} onClick={start} disabled={services.readOnly}>
            <Icon name="play" /> Start Match vs {opp.name}
          </button>
          <details className="small">
            <summary>Rules at a Glance</summary>
            <ul className="muted">
              <li>6×6 board: rooks, knights, queens, kings and pawns. No bishops.</li>
              <li>Pawns move one square only (no double step, no en passant). No castling.</li>
              <li>Promotion on the last rank is mandatory: queen, rook or knight.</li>
              <li>You can claim a draw after threefold repetition or 50 moves each without a pawn move or capture. Fivefold repetition and 75 moves each are automatic draws.</li>
              <li>King against king is an automatic draw. Unlike standard chess, other low-material endings play on.</li>
              <li>If your time runs out, you lose when your opponent has any piece besides the king, even one that cannot mate. Otherwise it is a draw.</li>
              <li>Draws by agreement are allowed after each side has made ten moves.</li>
            </ul>
          </details>
          {recent && (
            <div className="row small">
              <span className="muted">Last game: {resultText(recent)} vs {recent.humanColor === 'white' ? recent.black.name : recent.white.name}</span>
              <span className="spacer" />
              <button className="btn small" onClick={() => go({ name: 'analysis', gameId: recent.id })}>Open Analysis</button>
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
  // history browsing (Match Center): null follows the game; a number shows that earlier position read-only
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [tab, setTab] = useState<'moves' | 'assistant'>('moves');

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
      setError(`Couldn't save the result (${(e as Error).message}). Your game is kept. Reopen it from Play to try again.`);
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
      initialFen: rec.initialFen, setupMoves: rec.setupMoves, moves: rec.moves.map(m => m.ccn), level: engine.engine!.level || 1, profile: engine.engine?.profile, style: engine.engine?.styleId, seed: (rec.engineSeed + ply * 7919) >>> 0,
      clock: session.timed ? { remainingMs: session.remaining(engineColor as 0 | 1, Date.now()), incrementMs: rec.timeControl.incrementMs } : undefined,
      newGame: ply < 2,
    }).then(r => {
      setThinking(false);
      engineScore.current = r.score;
      const res = session.applyMove(r.move, Date.now(), new Date().toISOString(), { depth: r.depth, nodes: r.nodes, timeMs: r.timeMs, selected: r.selected, seed: (rec.engineSeed + ply * 7919) >>> 0, score: r.score.kind === 'mate' ? { kind: 'mate', value: r.score.plies } : r.score.kind === 'cp' ? { kind: 'cp', value: r.score.value } : undefined, stopReason: r.stopReason, build: r.provenance?.build });
      if (!res.ok && !res.outcome) setError(`The engine's move was rejected (${res.error}). Reopen the game from Play to continue.`);
      void services.saveGame(session.snapshot());
      if (session.isOver) void finalize(session);
      force();
    }).catch(e => {
      setThinking(false);
      if (!(e instanceof CancelledError)) setError(`The engine stopped (${(e as Error).message}). Reopen the game from Play to continue.`);
    });
  }, [session, session?.plies, session?.paused, thinking, engineColor, services, finalize]);

  useEffect(() => { setAssist(null); setViewPly(null); }, [session?.plies]);

  const askAssist = async (kind: 'hint' | 'candidates' | 'threat' | 'evaluation' | 'explanation') => {
    if (!session || !session.assistanceAllowed || session.sideToMove !== session.humanColor) return;
    if (!session.markAssisted(kind, new Date().toISOString())) return;
    void services.saveGame(session.snapshot());
    force();
    if (kind === 'threat') {
      const t = threatsAgainst(session.pos, session.humanColor as 0 | 1);
      setAssist({ kind, text: t.mateInOne ? 'Your opponent threatens mate in one.' : t.bestGain >= 100 ? `Your opponent threatens to win material worth about ${Math.round(t.bestGain / 100)} pawn(s) on ${squareName(t.square)}.` : 'No immediate threat to your material or of mate in one. Deeper threats are still possible.' });
      return;
    }
    setAssistBusy(true);
    try {
      const rec = session.record;
      const r = await services.assist.assist({ initialFen: rec.initialFen, setupMoves: rec.setupMoves, moves: rec.moves.map(m => m.ccn), depth: 6 });
      const best = r.candidates[0];
      const pov = session.humanColor === 0 ? 'white' : 'black';
      if (kind === 'hint') setAssist({ kind, text: `Consider moving the piece on ${best.ccn.slice(0, 2)}.`, hint: best.ccn.slice(0, 2) });
      else if (kind === 'evaluation') setAssist({ kind, text: `Evaluation from your side: ${formatScore(best.score, pov)} (depth ${r.depth}).` });
      else if (kind === 'candidates') setAssist({ kind, text: `The engine's top moves (depth ${r.depth}):`, candidates: r.candidates });
      else {
        const line = best.pv;
        const start = session.pos.clone();
        const moves: number[] = [];
        const tmp = start.clone();
        for (const c of line) { const mv = parseLegalCcn(tmp, c); if (mv < 0) break; moves.push(mv); tmp.makeMove(mv); }
        const motifs = motifsForLine(start, moves, best.score.kind === 'mate' && best.score.plies > 0);
        setAssist({ kind, text: `The engine prefers ${best.san} (${formatScore(best.score, pov)}), continuing ${best.pvSan.slice(0, 6).join(' ')}.${motifs.length ? ` Ideas on that line: ${motifs.map(m => MOTIF_LABEL[m.motif].toLowerCase()).join(', ')}.` : ' No clear tactic; it is a positional choice.'}` });
      }
    } catch (e) {
      if (!(e instanceof CancelledError)) setAssist({ kind, text: `The assistant isn't available right now (${(e as Error).message}). Try again in a moment.` });
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
  const claims = session.claims();
  const humanToMove = session.sideToMove === humanColor && !session.isOver;
  const opp = rec.humanColor === 'white' ? rec.black : rec.white;
  const oppMeta = findOpponent(opp.id);
  const plies = rec.moves.length;

  // the shown position: the live game, or an earlier position while browsing (no moves can be made there)
  const shownPly = viewPly ?? plies;
  const browsing = shownPly !== plies;
  const startFen = () => { const p = Position.fromFen(rec.initialFen); for (const m of rec.setupMoves ?? []) p.makeMove(parseLegalCcn(p, m)); return p.toFen(); };
  const shownFen = !browsing ? fen : shownPly === 0 ? startFen() : rec.moves[shownPly - 1].fenAfter;
  const shownPos = browsing ? Position.fromFen(shownFen) : session.pos;
  const last = shownPly > 0 ? rec.moves[shownPly - 1].ccn : null;
  const check = shownPos.inCheck() ? squareName(shownPos.kingSq[shownPos.side]) : null;
  const goPly = (k: number) => { const t = Math.max(0, Math.min(plies, k)); setViewPly(t === plies ? null : t); };
  const nav = { first: () => goPly(0), prev: () => goPly(shownPly - 1), next: () => goPly(shownPly + 1), last: () => setViewPly(null) };

  const bar = (c: 0 | 1) => {
    const p = c === 0 ? rec.white : rec.black;
    const color = c === 0 ? 'white' : 'black';
    const isHuman = c === humanColor;
    const ms = session.remaining(c, now);
    const running = session.timed && session.sideToMove === c && !session.isOver && !session.paused;
    // Federation opponent: shown under the contemporary-names setting, with the persona disclosure
    const comp = !isHuman && p.id ? services.fed.state?.competitors.get(p.id.replace(/^spar:/, '')) : undefined;
    const sp = shownPersona(comp, services.fed.showNames);
    const shownName = comp && isContemporaryId(comp.persona) ? `${comp.name}${p.id.startsWith('spar:') ? ' (sparring)' : ''}` : p.name;
    return (
      <PlayerBar color={color} active={session.sideToMove === c && !session.isOver} testId={isHuman ? 'human-bar' : 'engine-bar'}
        avatar={isHuman ? <KingAvatar color={color} /> : <Portrait seed={oppMeta?.portraitSeed ?? 1} size={40} crown={(oppMeta?.level ?? 0) >= 8} />}
        name={<>{shownName} {!isHuman && <span className="chip gold">{p.engine?.profile ? (p.engine.profileId.startsWith('L0') ? p.engine.profileId : 'Federation') : `L${p.engine?.level}`}</span>}{sp && <> <span className="chip" data-testid="opponent-persona" title={sp.kind === 'historical' ? 'Historical persona (fictional)' : CONTEMPORARY_DISCLOSURE} aria-label={sp.kind === 'historical' ? 'Historical persona (fictional)' : `Fictional persona. ${CONTEMPORARY_DISCLOSURE}`}>Fictional Persona</span></>}</>}
        meta={<>
          {p.rating !== null ? `${fmtCareerElo(p.rating, { rd: p.rd })}` : isHuman ? 'Unrated' : 'Not yet rated'}
          {!isHuman && thinking && session.sideToMove === c && ' · thinking…'}
          {isHuman && <> · {rec.rated ? <span className="chip pos">Rated · Unassisted</span> : <span className="chip">Casual</span>}</>}
        </>}
        aside={session.timed ? <Clock live text={fmtClock(ms)} label={`${p.name} clock`} running={running} low={ms < 20000} /> : undefined}>
        <Captured fen={shownFen} color={color} name={p.name} />
      </PlayerBar>
    );
  };

  const startBlack = (rec.moves[0] ? Position.fromFen(rec.moves[0].fenAfter).side === 0 : session.pos.side === 1);
  const rating = (p: GameRecord['white']) => (p.rating !== null ? fmtCareerElo(p.rating) : null);
  const budgetMs = opp.engine?.config?.maxTimeMs;
  const statusText = session.paused ? 'Paused' : session.isOver ? 'Finished' : humanToMove ? 'Your Move'
    : thinking && opp.engine?.level === MAX_LEVEL && budgetMs ? `Thinking · up to ${budgetMs / 1000} s` : thinking ? 'Thinking…' : 'Opponent to Move';

  const board = (
    <>
      {bar(top as 0 | 1)}
      <Board sounds={!browsing} live={!browsing} fen={shownFen} orientation={orientation} legal={browsing ? [] : legal} onMove={onMove} lastMove={last} checkSquare={check} label={browsing ? `Game against ${opp.name}, earlier position after ${shownPly} moves` : `Game against ${opp.name}`} highlights={!browsing && assist?.hint ? [assist.hint] : []} />
      {bar(bottom)}
      <MoveNav onFirst={nav.first} onPrev={nav.prev} onNext={nav.next} onLast={nav.last} lastLabel="Current Position" onFlip={() => setFlipped(f => !f)}
        indicator={browsing ? <span className="chip gold" data-testid="viewing-earlier">Move {Math.ceil(shownPly / 2)} · Earlier Position</span> : undefined} />
      <div className="sr-only" aria-live="polite">{rec.moves.length ? `Last move ${rec.moves.at(-1)!.san}` : 'Game started'}{session.isOver && rec.termination ? `. ${TERMINATION_LABEL[rec.termination]}` : ''}</div>
    </>
  );

  const movesPanel = (
    <>
      <div className="panel stack">
        <div className="panel-title"><h3>Moves</h3>{rec.opening && <span className="small muted">{rec.opening.name}</span>}</div>
        <NotationList label="Move list" startsWithBlack={startBlack} current={shownPly} onSelect={goPly} moves={rec.moves.map(m => ({ san: m.san }))} empty="Moves appear here as they are played." />
        {browsing && <div className="small muted">You are looking at an earlier position. Use Current Position to return to the game.</div>}
      </div>
      <div className="panel stack">
        <div className="row">
          <button className="btn" disabled={!session.canAgreeDraw() || !humanToMove} onClick={() => {
            const yes = engineDrawDecision(engineScore.current, session.plies);
            if (yes) { session.agreeDraw(Date.now(), new Date().toISOString()); void finalize(session); force(); }
            else setToast(`${opp.name} declines the draw offer.`);
          }} title={session.canAgreeDraw() ? 'Offer a draw' : 'You can offer a draw after each side has made ten moves'}><Icon name="handshake" /> Offer Draw</button>
          {(claims.threefold || claims.fiftyMove) && humanToMove && (
            <button className="btn" onClick={() => { session.claimDraw(claims.threefold ? 'threefold' : 'fiftyMove', Date.now(), new Date().toISOString()); void finalize(session); force(); }}>
              Claim Draw ({claims.threefold ? 'Threefold Repetition' : '50-Move Rule'})
            </button>
          )}
          {!confirmResign
            ? <button className="btn danger" disabled={session.isOver} onClick={() => setConfirmResign(true)}><Icon name="flag" /> Resign</button>
            : <span className="row"><span className="small">Resign this game?</span>
              <button className="btn danger" onClick={() => { session.resign(humanColor as 0 | 1, Date.now(), new Date().toISOString()); setConfirmResign(false); void finalize(session); force(); }}>Yes, Resign</button>
              <button className="btn" onClick={() => setConfirmResign(false)}>No</button></span>}
        </div>
        {toast && <div className="notice" role="status" onClick={() => setToast(null)}>{toast}</div>}
        {session.paused && <div className="notice warn">Clocks are paused while the app is in the background.</div>}
      </div>
    </>
  );

  const assistantPanel = (
    <div className="panel stack">
      {rec.rated ? (
        <div className="small" data-testid="assist-locked">Engine help is off in rated games.</div>
      ) : (
        <SandboxPanel rec={rec} />
      )}
      {rec.rated ? null : (
        <div className="stack" data-testid="assist-panel">
          <div className="row small"><strong>Assistant</strong>{rec.assistance.length > 0 && <span className="chip">Assisted · {rec.assistance.length}</span>}<span className="muted">Casual game, never rated</span></div>
          <div className="row">
            {(['hint', 'candidates', 'threat', 'evaluation', 'explanation'] as const).map(k => (
              <button key={k} className="btn small" disabled={!humanToMove || assistBusy || session.paused} onClick={() => void askAssist(k)}>
                {{ hint: 'Hint', candidates: 'Candidate Moves', threat: 'Threat Check', evaluation: 'Evaluation', explanation: 'Explain Best Move' }[k]}
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
      <div className="small muted" data-testid="engine-config">Full analysis opens after the game.
        <details className="small">
          <summary>Details</summary>
          Engine: {opp.engine?.searchId} · {opp.engine?.evalId} · calibration {opp.engine?.calibrationId}{opp.engine?.config ? ` · ${opp.engine.config.selection === 'best' ? 'best move only' : 'bounded selection'} · up to ${opp.engine.config.maxTimeMs / 1000} s per move · ${Math.round((1 << opp.engine.config.ttBits) * 11 / 1048576)} MB table · ${opp.engine.config.backend}` : ''}
        </details>
      </div>
    </div>
  );

  return (
    <div className="mc match-play" data-testid="match" data-fen={fen} data-turn={session.isOver ? 'over' : humanToMove ? (session.paused ? 'paused' : 'human') : 'engine'} data-human={humanColor === 0 ? 'w' : 'b'} onKeyDown={moveKeys(nav)}>
      <MatchHeader
        kicker={rec.mode === 'training' ? 'Training' : 'Match'}
        title={rec.context.eventName ?? `${rec.timeControl.label} · ${rec.rated ? 'Rated' : 'Casual'}`}
        subtitle={rec.opening?.name}
        status={<span className={`chip ${humanToMove && !session.paused ? 'gold' : ''}`} data-testid="match-status">{statusText}</span>}
        white={{ name: rec.white.name, rating: rating(rec.white) }}
        black={{ name: rec.black.name, rating: rating(rec.black) }}
        result={session.isOver ? rec.result ?? null : null} />
      <MatchLayout board={board} active={tab} onActive={t => setTab(t as typeof tab)} tabsLabel="Match Panels"
        panels={[{ id: 'moves', label: 'Moves', content: movesPanel }, { id: 'assistant', label: rec.rated ? 'Game Info' : 'Assistant', content: assistantPanel }]} />
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
  // one result sound per finished game (the overlay only appears for a game that ended in this session)
  useEffect(() => {
    const human = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.humanColor === 'white') ? 1 : 0;
    const outcome = human === 0.5 ? 'draw' : human === 1 ? 'victory' : 'defeat';
    if (g.termination === 'checkmate') {
      playOnce(`result:${g.id}`, 'checkmate');
      const t = setTimeout(() => playSound(outcome), 650);
      return () => clearTimeout(t);
    }
    playOnce(`result:${g.id}`, outcome);
  }, [g.id]);  
  const rematch = async () => {
    const o = findOpponent(opp.id);
    if (!o) return go({ name: 'play' });
    const pool = g.pool ? await services.db.ratingState(g.pool) : null;
    const rec = createGameRecord({
      id: newId(), mode: g.rated ? 'rated' : 'casual', timeControl: g.timeControl, humanColor: g.humanColor === 'white' ? 'black' : 'white',
      human: { kind: 'human', id: 'player', name: 'You', rating: pool?.rating ?? null, rd: pool?.rd ?? null },
      engine: playOpponentSnapshot(o), engineSeed: Math.floor(Math.random() * 2 ** 31), nowIso: new Date().toISOString(),
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
            <div className={`delta ${e.delta >= 0 ? 'up' : 'down'}`} data-testid="rating-delta">{ratingChange(e.before.rating, e.after.rating).deltaText}</div>
            <div className="small muted">{e.pool[0].toUpperCase() + e.pool.slice(1)} career Elo{e.provisionalAfter ? ' · provisional' : ''} · ±{Math.round(e.after.rd)}</div>
            <RatingChangeLine before={e.before.rating} after={e.after.rating} />
            <p className="small muted">{explainEvent(e)}</p>
          </div>
        ) : <p className="muted">{g.rated ? 'Rating update unavailable.' : 'Casual game: saved to your Library, no rating change.'}</p>}
        <p className="small muted">Game saved. Your analysis is being prepared.</p>
        <PlayedLikeResultLines gameId={g.id} sides={{
          white: { name: g.white.name, career: g.humanColor === 'white' ? (e ? Math.round(e.after.rating) : null) : g.white.rating ?? null },
          black: { name: g.black.name, career: g.humanColor === 'black' ? (e ? Math.round(e.after.rating) : null) : g.black.rating ?? null },
        }} />
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => go({ name: 'analysis', gameId: g.id })}>View Analysis</button>
          {g.context.kind === 'federation'
            ? <button className="btn" data-testid="back-to-federation" onClick={() => { onClose(); go({ name: 'world' }); }}>Back to Federation</button>
            : <><button className="btn" onClick={rematch}>Rematch</button>
              <button className="btn ghost" onClick={() => { onClose(); go({ name: 'play' }); }}>New Game</button></>}
        </div>
      </div>
    </div>
  );
}

export { formatScore };

/** Sandbox Exchange on your own casual game: practice money only, back-yourself claims, closes at move 1. */
function SandboxPanel({ rec }: { rec: GameRecord }) {
  const { services } = useApp();
  const fed = services.fed;
  const [msg, setMsg] = useState<string | null>(null);
  const [shares, setShares] = useState(10);
  const [, bump] = useState(0);
  const m = fed.ready ? fed.sandboxMarketFor(rec.id) : undefined;
  useEffect(() => { if (m && m.status === 'open' && rec.moves.length > 0) void fed.closeSandbox(rec.id).then(() => bump(x => x + 1)); }, [rec.moves.length, m?.status]);
  if (!fed.ready) return null;
  const why = FederationService.sandboxIneligible(rec);
  if (!m && why) return rec.moves.length === 0 ? <div className="small muted" data-testid="sandbox-ineligible">Sandbox Exchange: {why}.</div> : null;
  const open = async () => {
    setMsg(null);
    try {
      const pool = await services.db.ratingState('rapid');
      const opp = rec.humanColor === 'white' ? rec.black : rec.white;
      const o = opp.rating ?? 1500;
      const p = rec.humanColor === 'white' ? wdl(pool.rating, o) : wdl(o, pool.rating);
      const prior = rec.humanColor === 'white' ? [p.w, p.d, p.l] : [p.l, p.d, p.w];
      await fed.openSandbox(rec, prior); bump(x => x + 1);
    } catch (e) { setMsg((e as Error).message); }
  };
  const buy = async (claim: number) => { setMsg(null); try { await fed.sandboxTrade(rec.id, claim, shares, 'buy'); bump(x => x + 1); } catch (e) { setMsg((e as Error).message); } };
  const pos = m ? fed.state!.positions.get(`${m.id}|sandbox:player`) : undefined;
  const cp = m ? claimPrices(m) : [];
  return (
    <div className="panel stack" data-testid="sandbox-panel" style={{ padding: 10 }}>
      <div className="row small"><strong>Sandbox Exchange</strong><span className="chip">Practice Money · {fmtCrowns(fed.sandboxBalance(), 0)}</span>{m && <span className={`chip ${m.status === 'open' ? 'pos' : 'info'}`}>{({ open: 'Trading Open', closed: 'Trading Closed', settled: 'Market Settled', cancelled: 'Market Cancelled' } as Record<string, string>)[m.status] ?? m.status}</span>}</div>
      {!m ? (
        <><div className="small muted">Back yourself on this casual game with practice dollars, not your real balance. Prices start from your rapid rating vs your opponent, and trading closes at the first move. If you use the assistant or the game ends before move 10, the market is cancelled at the opening prices.</div>
          <button className="btn small" data-testid="open-sandbox" onClick={open} disabled={services.readOnly}>Open a Sandbox Market</button></>
      ) : (
        <>
          <div className="small">{claimsOf(m).map((c, i) => <span key={c.id} style={{ marginRight: 10 }}>{c.label}: <strong className="mono">{fmtPrice(cp[i])}</strong>{pos?.shares[i] ? ` · you hold ${pos.shares[i]}` : ''}</span>)}</div>
          {m.status === 'open' && <div className="row"><input type="number" min={1} value={shares} onChange={e => setShares(Math.max(1, Math.floor(+e.target.value || 1)))} style={{ width: 70 }} aria-label="Sandbox shares" />{claimsOf(m).map((c, i) => <button key={c.id} className="btn small" data-testid={`sandbox-buy-${c.id}`} onClick={() => buy(i)}>Buy {c.label}</button>)}</div>}
          {m.status === 'settled' && <div className="small">Market settled: {statesOf(m)[m.result!]}. You received {fmtCrowns(pos?.received ?? 0)} practice dollars.</div>}
          {m.status === 'cancelled' && <div className="small">Market cancelled at the opening prices (assistant used, game abandoned or under 10 moves).</div>}
        </>
      )}
      {msg && <div className="small notice warn">{msg}</div>}
    </div>
  );
}
