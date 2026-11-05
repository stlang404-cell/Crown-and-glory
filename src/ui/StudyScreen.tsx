/**
 * Crownmaster Study Match screen (#/study and #/study/<gameId>): an unrated, untimed game against any engine opponent
 * (the Play ladder, the beginners, or any Federation competitor with its own profile and style) with opt-in aids.
 * Domain rules live in src/app/study.ts; explanation text only comes from src/app/studyExplain.ts (engine data only).
 * Mobile first: the board comes first, the aids sit in a compact tabbed panel below it.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useApp, useServices } from './App';
import { Board, type BoardArrow } from './Board';
import { Captured, EvalBoard, GradeIcon, KingAvatar, MatchHeader, MatchLayout, MoveNav, NotationList, PlayerBar, moveKeys } from './MatchCenter';
import { Portrait } from './Portrait';
import { Icon } from './Icons';
import { CompetitorPicker } from './ExhibitionScreen';
import { fmtCareerElo } from '../ratings/display';
import { PLAY_OPPONENTS, type PlayOpponent, findOpponent, opponentLevelLabel, opponentProfile, opponentRating, playOpponentSnapshot } from '../federation/opponents';
import type { Competitor } from '../federation/model';
import { CancelledError, EngineChannel } from '../engine/client';
import type { AssistCandidate } from '../engine/protocol';
import { GameSession } from '../games/session';
import type { GameRecord, ParticipantSnapshot } from '../games/types';
import { Position } from '../rules/position';
import { parseLegalCcn } from '../rules/notation';
import { squareName } from '../rules/types';
import { TERMINATION_LABEL } from '../rules/adjudication';
import { DEFAULT_ANALYSIS } from '../analysis/analyzer';
import { toPov } from '../analysis/methodology';
import type { EngineScore, PlyAnalysis, Pov } from '../analysis/types';
import {
  NO_AIDS, STUDY_AIDS, STUDY_LABEL, StudyAidRefused, addFeedback, createStudyGame, isStudyGame, recordAid, setAid, studyAidsAllowed, studyState,
  takeBack, takeBackPlies, type StudyAidId, type StudyAidPrefs, type StudyFeedback,
} from '../app/study';
import { explainBestMove, explainFeedback, hintText } from '../app/studyExplain';
import './study.css';

/** Depth of the on-request engine aids (hint, best move, evaluation): the casual assistant's depth. */
export const STUDY_AID_DEPTH = 6;

export function StudyScreen({ gameId }: { gameId?: string }) {
  return gameId ? <StudyMatch key={gameId} gameId={gameId} /> : <StudyHome />;
}

/* ------------------------------------------------------------------ setup */

type Pick = { kind: 'ladder'; opp: PlayOpponent } | { kind: 'federation'; c: Competitor };

function StudyHome() {
  const services = useServices();
  const { go } = useApp();
  const [source, setSource] = useState<'ladder' | 'federation'>('ladder');
  const [opp, setOpp] = useState<PlayOpponent>(() => PLAY_OPPONENTS.find(o => o.beginner) ?? PLAY_OPPONENTS[0]);
  const [comp, setComp] = useState<Competitor | null>(null);
  const [color, setColor] = useState<'white' | 'black' | 'random'>('white');
  const [aids, setAids] = useState<StudyAidPrefs>({ ...NO_AIDS, hint: true, best: true, eval: true, feedback: true, takeback: true });
  const [unfinished, setUnfinished] = useState<GameRecord[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void services.db.unfinishedGames().then(gs => setUnfinished(gs.filter(isStudyGame))); }, [services, services.revision]);
  const fed = services.fed;
  const pick: Pick | null = source === 'ladder' ? { kind: 'ladder', opp } : comp ? { kind: 'federation', c: comp } : null;
  const pickName = pick ? (pick.kind === 'ladder' ? pick.opp.name : pick.c.name) : null;

  const start = async () => {
    if (!pick) return;
    setBusy(true); setMsg(null);
    try {
      const humanColor = color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color;
      const nowMs = Date.now(), nowIso = new Date(nowMs).toISOString();
      let engine: ParticipantSnapshot, engineSeed = Math.floor(Math.random() * 2 ** 31);
      if (pick.kind === 'ladder') engine = playOpponentSnapshot(pick.opp);
      else {
        // the Federation competitor's own calibrated profile and style, exactly as a casual Quick Match builds it
        const tmp = await fed.quickMatchGameFor(pick.c.id, { rated: false, humanColor, human: { rating: null, rd: null }, nowMs });
        engine = humanColor === 'white' ? tmp.black : tmp.white;
        engineSeed = tmp.engineSeed;
      }
      const rec = createStudyGame({ humanColor, engine, engineSeed, nowIso, nowMs, aids });
      await services.saveGame(rec);
      go({ name: 'study', gameId: rec.id });
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  };

  return (
    <div className="study-home" data-testid="study-home">
      <section className="hero">
        <div>
          <span className="chip info" data-testid="study-label">{STUDY_LABEL}</span>
          <h1>Crownmaster Study Match</h1>
          <p className="muted" style={{ margin: 0 }}>Learn without a clock: play any engine opponent with no time limit and switch on the aids you want — engine hint, best move with the engine’s line, evaluation bar, feedback on each of your moves, and take back. Study games are always unrated and never count toward ratings, records, the Vault, the Federation or markets.</p>
        </div>
      </section>
      {unfinished.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }} data-testid="study-resume">
          <div className="panel-title"><h2>Resume a Study Match</h2></div>
          {unfinished.map(g => (
            <div key={g.id} className="row">
              <span>vs {g.humanColor === 'white' ? g.black.name : g.white.name} · {Math.ceil(g.moves.length / 2)} moves · {STUDY_LABEL}</span>
              <span className="spacer" />
              <button className="btn primary" data-testid="study-resume-btn" onClick={() => go({ name: 'study', gameId: g.id })}>{g.status === 'terminal' ? 'Finish Saving' : 'Resume'}</button>
            </div>
          ))}
        </div>
      )}
      <div className="grid-2">
        <div className="panel stack">
          <div className="panel-title"><h2>Opponent</h2></div>
          <div className="seg" role="group" aria-label="Opponent source">
            <button aria-pressed={source === 'ladder'} onClick={() => setSource('ladder')} data-testid="study-source-ladder">Engine Levels</button>
            <button aria-pressed={source === 'federation'} onClick={() => setSource('federation')} data-testid="study-source-federation">Federation Competitor</button>
          </div>
          {source === 'ladder' ? (
            <div className="stack study-opp-list" role="group" aria-label="Engine opponent">
              {PLAY_OPPONENTS.map(o => {
                const cal = opponentRating(o);
                return (
                  <button key={o.id} className="opp-card" aria-pressed={opp.id === o.id} onClick={() => setOpp(o)} data-testid="study-opp" data-id={o.id} data-beginner={o.beginner ?? undefined}>
                    <Portrait seed={o.portraitSeed} size={40} crown={o.level >= 8} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}><strong>{o.name}</strong><span className={o.beginner ? 'chip info' : 'chip gold'}>{opponentLevelLabel(o)}</span>{o.beginner && <span className="chip">Beginner</span>}</div>
                      <div className="small muted">{opponentProfile(o).description}</div>
                    </div>
                    <div className="mono small" style={{ textAlign: 'right' }}>{cal ? fmtCareerElo(cal.rating) : '—'}</div>
                  </button>
                );
              })}
            </div>
          ) : fed.ready && fed.state ? (
            <CompetitorPicker side="black" selected={comp} other={null} onSelect={setComp} />
          ) : (
            <div className="small muted">Federation competitors appear once the Federation is founded. <button className="btn small" onClick={() => go({ name: 'world' })}>Go to the Federation</button></div>
          )}
        </div>
        <div className="panel stack">
          <h2>Study Settings</h2>
          <div>
            <div className="small muted">Your Colour</div>
            <div className="seg" role="group" aria-label="Colour">
              {(['white', 'random', 'black'] as const).map(c => <button key={c} aria-pressed={color === c} onClick={() => setColor(c)}>{c[0].toUpperCase() + c.slice(1)}</button>)}
            </div>
          </div>
          <fieldset className="study-aid-set">
            <legend className="small muted">Aids (each can be switched on or off during the game)</legend>
            {STUDY_AIDS.map(a => (
              <label key={a.id} className="study-aid-check">
                <input type="checkbox" checked={aids[a.id]} onChange={e => setAids(x => ({ ...x, [a.id]: e.target.checked }))} data-testid={`study-setup-aid-${a.id}`} />
                <span><strong>{a.label}</strong> <span className="small muted">{a.detail}</span></span>
              </label>
            ))}
          </fieldset>
          <div className="notice small">Untimed · {STUDY_LABEL} · saved after every move, so you can stop and resume at any time. Every aid you use is recorded on the game.</div>
          <button className="btn primary" style={{ width: '100%' }} data-testid="study-start" onClick={() => void start()} disabled={!pick || busy || services.readOnly}>
            <Icon name="play" /> {pickName ? `Start Study Match vs ${pickName}` : 'Choose an opponent'}
          </button>
          {msg && <div className="notice warn small" role="alert">{msg}</div>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the match */

let gradeChannel: EngineChannel | null = null;
/** Move feedback runs on its own worker so a hint request never cancels it. */
const gradeEngine = () => (gradeChannel ??= new EngineChannel(undefined, 'study-grade'));

const ccnOf = (m: number): string => {
  const sq = (s: number) => 'abcdef'[s % 6] + (Math.floor(s / 6) + 1);
  const promo = (m >> 12) & 7;
  return sq(m & 63) + sq((m >> 6) & 63) + (promo ? ' pnrqk'[promo] : '');
};

/** Convert a standard-analysis ply into stored feedback (engine data only). */
export function feedbackFromPly(p: PlyAnalysis, fenBefore: string, depth: number, settingsId: string): StudyFeedback {
  return {
    ply: p.ply, san: p.san, grade: p.grade, loss: p.loss, provisional: p.gradeProvisional, forced: p.forced, depth, settingsId,
    bestSan: p.best.san, bestPvSan: p.best.pvSan, playedPvSan: p.played.pvSan, bestPv: p.best.pv, playedPv: p.played.pv,
    evalBefore: p.evalBefore, evalAfter: p.evalAfter, fenBefore,
  };
}

interface AidResult { ply: number; depth: number; candidates: AssistCandidate[]; fen: string }

function StudyMatch({ gameId }: { gameId: string }) {
  const services = useServices();
  const { go } = useApp();
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, force] = useReducer(x => x + 1, 0);
  const [flipped, setFlipped] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [finished, setFinished] = useState<GameRecord | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [tab, setTab] = useState<'aids' | 'moves'>('aids');
  const [aid, setAidResult] = useState<AidResult | null>(null);
  const [aidBusy, setAidBusy] = useState(false);
  const [shown, setShown] = useState<{ hint: number | null; best: number | null }>({ hint: null, best: null });
  const [grading, setGrading] = useState<number | null>(null);
  const requested = useRef(new Set<number>());
  const finalizing = useRef(false);
  const fresh = useRef(false);

  useEffect(() => {
    let alive = true;
    void services.db.getGame(gameId).then(g => {
      if (!alive) return;
      if (!g || !isStudyGame(g)) { setError('Study Match not found.'); return; }
      if (g.status === 'finalized') { go({ name: 'analysis', gameId }); return; }
      const s = new GameSession(g);
      if (g.status !== 'terminal') {
        s.start(Date.now());
        const iso = new Date().toISOString();
        // reopening a saved study game is recorded as a pause (untimed: nothing is charged)
        if (g.moves.length > 0) { g.pauses.push({ at: iso, resumedAt: iso, reason: 'reload' }); g.status = 'active'; }
      }
      setSession(s);
    });
    services.setMatchActive(true);
    return () => { alive = false; services.play.cancel(); services.assist.cancel(); gradeChannel?.cancel(); services.setMatchActive(false); };
  }, [gameId, services, go]);

  const save = useCallback((s: GameSession) => services.saveGame(s.snapshot()), [services]);

  const finalize = useCallback(async (s: GameSession) => {
    if (finalizing.current) return;
    finalizing.current = true;
    services.play.cancel(); services.assist.cancel(); gradeChannel?.cancel();
    const snap = s.snapshot();
    try {
      await services.saveGame(snap);
      const r = await services.finalize(snap);
      setFinished(r.game);
    } catch (e) {
      setError(`Couldn't save the result (${(e as Error).message}). Your game is kept. Reopen it from Study Match to try again.`);
      finalizing.current = false;
    }
    services.setMatchActive(false);
  }, [services]);

  useEffect(() => { if (session?.isOver) void finalize(session); }, [session, finalize]);

  // save when the app goes to the background (untimed: there is no clock to pause)
  useEffect(() => {
    if (!session) return;
    const on = () => { if (document.visibilityState === 'hidden' && !session.isOver) void save(session); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [session, save]);

  const engineColor = session ? (session.humanColor ^ 1) : 1;

  // the opponent's move
  useEffect(() => {
    if (!session || session.isOver || thinking) return;
    if (session.sideToMove !== engineColor) return;
    const rec = session.record;
    const engine = rec.humanColor === 'white' ? rec.black : rec.white;
    setThinking(true);
    const ply = rec.moves.length;
    const seed = (rec.engineSeed + ply * 7919) >>> 0;
    const newGame = ply < 2 || fresh.current;
    fresh.current = false;
    services.play.move({
      initialFen: rec.initialFen, setupMoves: rec.setupMoves, moves: rec.moves.map(m => m.ccn), level: engine.engine!.level || 1, profile: engine.engine?.profile, style: engine.engine?.styleId, seed, newGame,
    }).then(r => {
      setThinking(false);
      const res = session.applyMove(r.move, Date.now(), new Date().toISOString(), { depth: r.depth, nodes: r.nodes, timeMs: r.timeMs, selected: r.selected, seed, score: r.score.kind === 'mate' ? { kind: 'mate', value: r.score.plies } : r.score.kind === 'cp' ? { kind: 'cp', value: r.score.value } : undefined, stopReason: r.stopReason, build: r.provenance?.build });
      if (!res.ok && !res.outcome) setError(`The engine's move was rejected (${res.error}). Reopen the game to continue.`);
      void save(session);
      if (session.isOver) void finalize(session);
      force();
    }).catch(e => {
      setThinking(false);
      if (!(e instanceof CancelledError)) setError(`The engine stopped (${(e as Error).message}). Reopen the game to continue.`);
    });
  }, [session, session?.plies, thinking, engineColor, services, finalize, save]);

  const rec = session?.record ?? null;
  const plies = rec?.moves.length ?? 0;
  const humanToMove = !!session && !session.isOver && session.sideToMove === session.humanColor;
  const allowed = studyAidsAllowed(rec);
  const prefs = rec ? studyState(rec).aids : NO_AIDS;
  const pov: Pov = rec?.humanColor ?? 'white';

  // reset per-position aid displays when the position changes
  useEffect(() => { setViewPly(null); setShown({ hint: null, best: null }); }, [plies]);

  /** One engine query per position serves the hint, the best move and the evaluation. */
  const queryAid = useCallback(async (): Promise<AidResult | null> => {
    if (!session || !studyAidsAllowed(session.record) || session.sideToMove !== session.humanColor) return null;
    const r0 = session.record;
    const ply = r0.moves.length;
    if (aid && aid.ply === ply) return aid;
    setAidBusy(true);
    try {
      const r = await services.assist.assist({ initialFen: r0.initialFen, setupMoves: r0.setupMoves, moves: r0.moves.map(m => m.ccn), depth: STUDY_AID_DEPTH });
      if (session.record.moves.length !== ply || !r.candidates.length) return null;
      const res = { ply, depth: r.depth, candidates: r.candidates, fen: session.pos.toFen() };
      setAidResult(res);
      return res;
    } catch (e) {
      if (!(e instanceof CancelledError)) setToast(`The engine aid isn't available right now (${(e as Error).message}).`);
      return null;
    } finally { setAidBusy(false); }
  }, [session, aid, services]);

  // evaluation aid: computed for the position on the board on your turn; each position shown is recorded once
  useEffect(() => {
    if (!session || !allowed || !prefs.eval || !humanToMove) return;
    let live = true;
    void queryAid().then(r => {
      if (!live || !r) return;
      try { if (recordAid(session.record, 'evaluation', new Date().toISOString(), { once: true, ply: r.ply })) void save(session); } catch { /* refused: aid off */ }
      force();
    });
    return () => { live = false; };
  }, [session, plies, prefs.eval, humanToMove, allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  // move feedback: the standard analysis of each of your moves, run once the opponent has replied (no CPU contention)
  useEffect(() => {
    if (!session || !allowed || !humanToMove || grading !== null) return;
    const r0 = session.record;
    const have = new Set(studyState(r0).feedback.map(f => f.ply));
    const next = [...requested.current].filter(p => p <= r0.moves.length && !have.has(p)).sort((a, b) => a - b)[0];
    if (next === undefined) return;
    setGrading(next);
    const before = r0.moves.slice(0, next - 1).map(m => m.ccn);
    const fenBefore = next === 1 ? startFenOf(r0) : r0.moves[next - 2].fenAfter;
    void gradeEngine().analyze({ gameId: `${r0.id}:feedback:${next}`, checksum: 'study-feedback', initialFen: r0.initialFen, setupMoves: [...(r0.setupMoves ?? []), ...before], moves: [r0.moves[next - 1].ccn], settings: DEFAULT_ANALYSIS })
      .then(rep => {
        const p = rep.plies[0];
        requested.current.delete(next);
        if (!p || session.record.moves[next - 1]?.ccn !== p.ccn || !studyAidsAllowed(session.record)) return;
        try { addFeedback(session.record, feedbackFromPly(p, fenBefore, DEFAULT_ANALYSIS.depth, DEFAULT_ANALYSIS.id), new Date().toISOString()); void save(session); } catch { /* aid switched off meanwhile */ }
      })
      .catch(e => { if (!(e instanceof CancelledError)) { requested.current.delete(next); setToast(`Move feedback isn't available right now (${(e as Error).message}).`); } })
      .finally(() => { setGrading(null); force(); });
  }, [session, plies, humanToMove, allowed, grading, save]);

  const onMove = (ccn: string) => {
    if (!session) return;
    const r = session.applyMove(ccn, Date.now(), new Date().toISOString());
    if (!r.ok && !r.outcome) { setToast(r.error); return; }
    if (prefs.feedback && !session.isOver) requested.current.add(r.ok ? r.record.ply : session.plies);
    void save(session);
    if (session.isOver) void finalize(session);
    force();
  };

  const toggle = (id: StudyAidId) => {
    if (!session) return;
    try {
      setAid(session.record, id, !prefs[id]);
      if (id === 'hint' && prefs.hint) setShown(s => ({ ...s, hint: null }));
      if (id === 'best' && prefs.best) setShown(s => ({ ...s, best: null }));
      void save(session);
      force();
    } catch (e) { setToast((e as Error).message); }
  };

  const showAid = async (which: 'hint' | 'best') => {
    if (!session) return;
    const r = await queryAid();
    if (!r) return;
    try {
      recordAid(session.record, which === 'hint' ? 'hint' : 'best-move', new Date().toISOString(), { once: true, ply: r.ply });
      void save(session);
      setShown(s => ({ ...s, [which]: r.ply }));
    } catch (e) { setToast(e instanceof StudyAidRefused ? e.message : String(e)); }
    force();
  };

  const doTakeBack = async () => {
    if (!session) return;
    try {
      services.play.cancel(); services.assist.cancel();
      const next = takeBack(session.snapshot(), new Date().toISOString());
      await services.saveGame(next);
      const s = new GameSession(next);
      s.start(Date.now());
      fresh.current = true;
      setThinking(false);
      setAidResult(null);
      setSession(s);
      setToast('Move taken back.');
    } catch (e) { setToast((e as Error).message); }
  };

  const legal = useMemo(() => {
    if (!session || session.isOver || session.sideToMove !== session.humanColor) return [];
    return session.legalMoves().map(ccnOf);
  }, [session, session?.plies, session?.isOver]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="panel"><p role="alert">{error}</p><button className="btn" onClick={() => go({ name: 'study' })}>Back</button></div>;
  if (!session || !rec) return <p className="muted">Loading study match…</p>;

  const humanColor = session.humanColor;
  const orientation: 'white' | 'black' = (humanColor === 0) !== flipped ? 'white' : 'black';
  const top = orientation === 'white' ? 1 : 0;
  const bottom = (top ^ 1) as 0 | 1;
  const fen = session.pos.toFen();
  const opp = rec.humanColor === 'white' ? rec.black : rec.white;
  const oppMeta = findOpponent(opp.id);
  const shownPly = viewPly ?? plies;
  const browsing = shownPly !== plies;
  const shownFen = !browsing ? fen : shownPly === 0 ? startFenOf(rec) : rec.moves[shownPly - 1].fenAfter;
  const shownPos = browsing ? Position.fromFen(shownFen) : session.pos;
  const last = shownPly > 0 ? rec.moves[shownPly - 1].ccn : null;
  const check = shownPos.inCheck() ? squareName(shownPos.kingSq[shownPos.side]) : null;
  const goPly = (k: number) => { const t = Math.max(0, Math.min(plies, k)); setViewPly(t === plies ? null : t); };
  const nav = { first: () => goPly(0), prev: () => goPly(shownPly - 1), next: () => goPly(shownPly + 1), last: () => setViewPly(null) };
  const claims = session.claims();
  const current = aid && aid.ply === plies ? aid : null;
  const best = current?.candidates[0] ?? null;
  const hintOn = allowed && prefs.hint && shown.hint === plies && !!best && !browsing;
  const bestOn = allowed && prefs.best && shown.best === plies && !!best && !browsing;
  const arrows: BoardArrow[] = bestOn && best ? [{ from: best.ccn.slice(0, 2), to: best.ccn.slice(2, 4), color: 'var(--emerald)' }] : [];
  const evalScore: EngineScore | null = allowed && prefs.eval && current && best && !browsing ? toPov(best.score, 'white') : null;
  const feedback = studyState(rec).feedback;
  const fbByPly = new Map(feedback.map(f => [f.ply, f]));
  const lastFeedback = feedback.at(-1) ?? null;
  const startBlack = (rec.moves[0] ? Position.fromFen(rec.moves[0].fenAfter).side === 0 : session.pos.side === 1);
  const statusText = session.isOver ? 'Finished' : humanToMove ? 'Your Move' : thinking ? 'Thinking…' : 'Opponent to Move';

  const bar = (c: 0 | 1) => {
    const p = c === 0 ? rec.white : rec.black;
    const color = c === 0 ? 'white' : 'black';
    const isHuman = c === humanColor;
    return (
      <PlayerBar color={color} active={session.sideToMove === c && !session.isOver} testId={isHuman ? 'human-bar' : 'engine-bar'}
        avatar={isHuman ? <KingAvatar color={color} /> : <Portrait seed={oppMeta?.portraitSeed ?? (p.id.length * 7919) % 997} size={40} crown={(oppMeta?.level ?? 0) >= 8} />}
        name={<>{p.name}{!isHuman && <> <span className="chip gold">{p.engine?.profile ? (p.engine.profileId.startsWith('L0') ? p.engine.profileId : oppMeta ? `L${oppMeta.level}` : 'Federation') : `L${p.engine?.level}`}</span></>}</>}
        meta={<>{isHuman ? <span className="chip info">{STUDY_LABEL}</span> : p.rating !== null ? fmtCareerElo(p.rating, { rd: p.rd }) : 'Federation competitor'}{!isHuman && thinking && session.sideToMove === c && ' · thinking…'}</>}>
        <Captured fen={shownFen} color={color} name={p.name} />
      </PlayerBar>
    );
  };

  const board = (
    <>
      {bar(top as 0 | 1)}
      <EvalBoard context={{ kind: 'study', aidsAllowed: allowed && prefs.eval }} score={evalScore} orientation={orientation} source={current ? `Engine estimate, depth ${current.depth}` : 'Engine estimate (computing)'}>
        <Board sounds={!browsing} live={!browsing} fen={shownFen} orientation={orientation} legal={browsing ? [] : legal} onMove={onMove} lastMove={last} checkSquare={check}
          label={browsing ? `Study game against ${opp.name}, earlier position after ${shownPly} moves` : `Study game against ${opp.name}`}
          highlights={hintOn && best ? [best.ccn.slice(0, 2)] : []} arrows={arrows} />
      </EvalBoard>
      {bar(bottom)}
      <MoveNav onFirst={nav.first} onPrev={nav.prev} onNext={nav.next} onLast={nav.last} lastLabel="Current Position" onFlip={() => setFlipped(f => !f)}
        indicator={browsing ? <span className="chip gold" data-testid="viewing-earlier">Move {Math.ceil(shownPly / 2)} · Earlier Position</span> : undefined} />
      {lastFeedback && allowed && prefs.feedback && <FeedbackLine f={lastFeedback} pov={pov} compact />}
      <div className="sr-only" aria-live="polite">{rec.moves.length ? `Last move ${rec.moves.at(-1)!.san}` : 'Game started'}{session.isOver && rec.termination ? `. ${TERMINATION_LABEL[rec.termination]}` : ''}</div>
    </>
  );

  const aidsPanel = (
    <StudyAidsPanel record={rec} humanToMove={humanToMove && !browsing} busy={aidBusy} grading={grading}
      onToggle={toggle} onHint={() => void showAid('hint')} onBest={() => void showAid('best')} onTakeBack={() => void doTakeBack()}
      hint={hintOn && best && current ? hintText(best, current.depth) : null}
      bestLines={bestOn && best && current ? explainBestMove({ fen: current.fen, pov, candidate: best, depth: current.depth }) : null}
      evalText={evalScore && current ? `Evaluation: ${evalTextOf(best!.score, pov)} (engine estimate, depth ${current.depth}).` : null} />
  );

  const movesPanel = (
    <>
      <div className="panel stack">
        <div className="panel-title"><h2 className="h3">Moves</h2>{rec.opening && <span className="small muted">{rec.opening.name}</span>}</div>
        <NotationList label="Move list" startsWithBlack={startBlack} current={shownPly} onSelect={goPly}
          moves={rec.moves.map(m => { const f = fbByPly.get(m.ply); return f && prefs.feedback ? { san: m.san, grade: f.grade } : { san: m.san }; })} empty="Moves appear here as they are played." />
        {prefs.feedback && feedback.length > 0 && (
          <details className="small" data-testid="study-feedback-history">
            <summary>Feedback on your moves ({feedback.length})</summary>
            <ul className="study-fb-list">{[...feedback].reverse().map(f => <li key={f.ply}><FeedbackLine f={f} pov={pov} /></li>)}</ul>
          </details>
        )}
      </div>
      <div className="panel stack">
        <div className="row">
          {(claims.threefold || claims.fiftyMove) && humanToMove && (
            <button className="btn" onClick={() => { session.claimDraw(claims.threefold ? 'threefold' : 'fiftyMove', Date.now(), new Date().toISOString()); void finalize(session); force(); }}>
              Claim Draw ({claims.threefold ? 'Threefold Repetition' : '50-Move Rule'})
            </button>
          )}
          <button className="btn" data-testid="study-pause" disabled={session.isOver} onClick={() => { void save(session).then(() => go({ name: 'study' })); }}><Icon name="pause" /> Pause &amp; Save</button>
          {!confirmResign
            ? <button className="btn danger" data-testid="study-resign" disabled={session.isOver} onClick={() => setConfirmResign(true)}><Icon name="flag" /> Resign</button>
            : <span className="row"><span className="small">Resign this study game?</span>
              <button className="btn danger" data-testid="study-resign-yes" onClick={() => { session.resign(humanColor as 0 | 1, Date.now(), new Date().toISOString()); setConfirmResign(false); void finalize(session); force(); }}>Yes, Resign</button>
              <button className="btn" onClick={() => setConfirmResign(false)}>No</button></span>}
        </div>
        <div className="small muted">Untimed and saved after every move: leave at any time and resume from Study Match or Play.</div>
      </div>
    </>
  );

  return (
    <div className="mc match-play study-match" data-testid="study-match" data-fen={fen} data-plies={plies} data-turn={session.isOver ? 'over' : humanToMove ? 'human' : 'engine'} data-human={humanColor === 0 ? 'w' : 'b'} onKeyDown={moveKeys(nav)}>
      <MatchHeader
        back={{ label: '← Study', onClick: () => { void save(session).then(() => go({ name: 'study' })); } }}
        kicker="Crownmaster Study Match"
        title={<>{STUDY_LABEL} · vs {opp.name}</>}
        subtitle={rec.opening?.name}
        status={<><span className="chip info" data-testid="study-header-label">{STUDY_LABEL}</span><span className={`chip ${humanToMove ? 'gold' : ''}`} data-testid="match-status">{statusText}</span></>}
        white={{ name: rec.white.name, rating: rec.white.rating !== null ? fmtCareerElo(rec.white.rating) : null }}
        black={{ name: rec.black.name, rating: rec.black.rating !== null ? fmtCareerElo(rec.black.rating) : null }}
        result={session.isOver ? rec.result ?? null : null} />
      <MatchLayout board={board} active={tab} onActive={t => setTab(t as typeof tab)} tabsLabel="Study Panels"
        panels={[{ id: 'aids', label: 'Study Aids', content: aidsPanel }, { id: 'moves', label: 'Moves', content: movesPanel }]} />
      {toast && <div className="notice small study-toast" role="status" onClick={() => setToast(null)}>{toast}</div>}
      {finished && (
        <div className="result-overlay" role="dialog" aria-modal="true" aria-label="Study game result">
          <div className="result-card stack" data-testid="study-result">
            <div className="result-title">{resultWord(finished)}</div>
            <div className="muted">{finished.result} · {finished.termination ? TERMINATION_LABEL[finished.termination] : ''} · vs {opp.name}</div>
            <p className="muted"><span className="chip info">{STUDY_LABEL}</span> No rating change. Study games never count toward ratings, Played Like records, the Vault, the Federation or markets.</p>
            <p className="small muted">Game saved. The standard Match Analysis is being prepared.</p>
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary" autoFocus data-testid="study-view-analysis" onClick={() => go({ name: 'analysis', gameId: finished.id })}>View Analysis</button>
              <button className="btn" onClick={() => { setFinished(null); go({ name: 'study' }); }}>New Study Match</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const startFenOf = (rec: GameRecord) => { const p = Position.fromFen(rec.initialFen); for (const m of rec.setupMoves ?? []) p.makeMove(parseLegalCcn(p, m)); return p.toFen(); };
const resultWord = (g: GameRecord) => (!g.result ? 'Finished' : g.result === '1/2-1/2' ? 'Draw' : (g.result === '1-0') === (g.humanColor === 'white') ? 'Victory' : 'Defeat');
function evalTextOf(s: EngineScore, pov: Pov): string {
  const t = toPov(s, pov);
  if (t.kind === 'cp') return `${t.value >= 0 ? '+' : '−'}${Math.abs(t.value / 100).toFixed(2)} from your side`;
  if (t.kind === 'mate') return t.plies > 0 ? `mate in ${Math.ceil(t.plies / 2)} for you` : `mate in ${Math.ceil(-t.plies / 2)} against you`;
  return t.outcome === 'draw' ? 'drawn' : t.outcome === 'win' ? 'won for you' : 'lost for you';
}

function FeedbackLine({ f, pov, compact }: { f: StudyFeedback; pov: Pov; compact?: boolean }) {
  const ex = explainFeedback(f, pov);
  return (
    <div className={`study-fb ${compact ? 'compact' : ''} grade-tone-${f.grade ?? 'none'}`} data-testid={compact ? 'study-feedback' : 'study-feedback-item'} data-grade={f.grade ?? 'none'} data-loss={f.loss ?? ''}>
      <div className="row" style={{ gap: 6 }}><GradeIcon grade={f.grade} provisional={f.provisional} /><strong>{ex.headline}</strong></div>
      {compact ? <div className="small muted">{ex.lines[0]}</div> : <ul className="small">{ex.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {compact && ex.lines.length > 1 && (
        <details className="small"><summary>Why?</summary><ul>{ex.lines.slice(1).map((l, i) => <li key={i}>{l}</li>)}</ul></details>
      )}
    </div>
  );
}

/**
 * The aids panel. Presentation only, and gated by `studyAidsAllowed(record)`: for any record that is not an
 * unfinished study game (a rated game in particular) it renders no aid control at all.
 */
export function StudyAidsPanel({ record, humanToMove, busy, grading, onToggle, onHint, onBest, onTakeBack, hint, bestLines, evalText }: {
  record: GameRecord; humanToMove: boolean; busy: boolean; grading: number | null;
  onToggle: (id: StudyAidId) => void; onHint: () => void; onBest: () => void; onTakeBack: () => void;
  hint: string | null; bestLines: string[] | null; evalText: string | null;
}) {
  if (!studyAidsAllowed(record)) {
    return (
      <div className="panel small" data-testid="study-aids-locked">
        {record.rated ? 'Engine help is off in rated games.' : record.status === 'finalized' || record.status === 'terminal' ? 'The game is over: open the Match Analysis to review it.' : 'Study aids are available only in a Study Match.'}
      </div>
    );
  }
  const prefs = studyState(record).aids;
  const uses = record.assistance.length;
  const canTake = takeBackPlies(record) > 0;
  return (
    <div className="panel stack study-aids" data-testid="study-aids">
      <div className="row small" style={{ flexWrap: 'wrap', gap: 6 }}>
        <strong>Study Aids</strong><span className="chip info">{STUDY_LABEL}</span>
        <span className="chip" data-testid="study-aid-uses">Aids used · {uses}</span>
      </div>
      <div className="study-switches" role="group" aria-label="Study aids">
        {STUDY_AIDS.map(a => (
          <button key={a.id} className="study-switch" aria-pressed={prefs[a.id]} data-testid={`study-aid-${a.id}`} onClick={() => onToggle(a.id)} title={a.detail}>
            <span className="study-switch-dot" aria-hidden />{a.label}<span className="sr-only">: {prefs[a.id] ? 'on' : 'off'}</span>
          </button>
        ))}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {prefs.hint && <button className="btn small" data-testid="study-hint" disabled={!humanToMove || busy} onClick={onHint}>Show Hint</button>}
        {prefs.best && <button className="btn small" data-testid="study-best" disabled={!humanToMove || busy} onClick={onBest}>Show Best Move</button>}
        {prefs.takeback && <button className="btn small" data-testid="study-takeback" disabled={!humanToMove || !canTake} onClick={onTakeBack}>Take Back</button>}
      </div>
      {busy && <div className="small muted" role="status">Engine thinking…</div>}
      {grading !== null && prefs.feedback && <div className="small muted" role="status" data-testid="study-grading">Analysing your move (standard analysis)…</div>}
      {prefs.eval && evalText && <div className="small" data-testid="study-eval-text">{evalText}</div>}
      {hint && <div className="coach" role="status" data-testid="study-hint-text">{hint}</div>}
      {bestLines && (
        <div className="coach" role="status" data-testid="study-best-text">
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{bestLines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}
      {!prefs.hint && !prefs.best && !prefs.eval && !prefs.feedback && !prefs.takeback && <div className="small muted">All aids are off: switch one on above.</div>}
      <div className="small muted">Explanations come only from the engine’s own output (its move, line, score and depth) and are estimates, not perfect analysis.</div>
    </div>
  );
}
