/**
 * Exhibition Arena (#/exhibition, #/exhibition/<id>; crown-exhibition-1, src/app/exhibition.ts).
 *
 * Choose ANY two distinct competitors of the whole Federation (search and paged lists over every active competitor,
 * at any rating, division, region, title or persona), watch them play an UNOFFICIAL match on the shared Match Center
 * (board, evaluation bar from the moving engine's published score, move list, evaluation graph), and study it with
 * the standard Match Analysis: move grades, mistakes and blunders, turning points, Played Like for both sides,
 * career Elo comparison, the sandbox and lesson links. Exhibitions are archived apart from every official record
 * and never change ratings, standings, records, money, markets, achievements, titles, rivalries or the schedule.
 */
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { NeedsFederation } from './NeedsFederation';
import { Board } from './Board';
import { Portrait } from './Portrait';
import { EvalBoard, GradeIcon, GRADE_LABEL, MatchHeader, MatchLayout, MoveNav, NotationList, PlayerBar, formatEval, moveKeys } from './MatchCenter';
import { EvalGraph as LiveEvalGraph } from './SpectatorScreen';
import { LessonLinks, MatchEventList, SandboxPanel, TurningPointList, useSandbox } from './ReplayTools';
import { PlayedLikePanel } from './PlayedLikeCard';
import { filterCompetitors, pageOf } from '../app/discovery';
import { RATING_BANDS } from '../app/population';
import {
  EXHIBITION_NODE_CAP, EXHIBITION_SPEEDS, deleteExhibition, eloExpectation, listExhibitions, loadExhibitionReport, sideFacts,
  type ExhibitionGame, type ExhibitionSide,
} from '../app/exhibition';
import { matchEvents, turningPoints } from '../app/replay';
import { expectedU, toPov } from '../analysis/methodology';
import { ENGINE_BUILD, DEFAULT_ANALYSIS } from '../analysis/analyzer';
import type { AnalysisReport, EngineScore, Grade, Pov } from '../analysis/types';
import type { Competitor } from '../federation/model';
import { CONTEMPORARY_DISCLOSURE, shownPersona } from '../federation/rosterPersonas';
import { STYLE_LABEL } from '../engine/styles';
import { divisionLabel } from '../federation/model';
import { Position } from '../rules/position';
import { squareName } from '../rules/types';
import './arena.css';

const PICK_PAGE = 8;
const NO_SETS = { watchlist: new Set<string>(), featured: new Set<string>(), rivals: null, upcoming: new Set<string>(), favorites: new Set<string>() };
const elo = (r: number) => Math.round(r).toLocaleString('en-US');
const RESULT_LABEL = (r: string | null) => (r === '1/2-1/2' ? '½-½' : r ?? '*');

export function ExhibitionScreen({ id }: { id?: string }) {
  const services = useServices();
  if (!services.fed.state) return <NeedsFederation title="Exhibition Arena" detail="The Exhibition Arena lets you pick any two Federation competitors and watch an unofficial match. It opens once you found the Federation." />;
  return id ? <ExhibitionMatch id={id} /> : <ExhibitionHome />;
}

/* ------------------------------------------------------------------ selection + history */

function ExhibitionHome() {
  const services = useServices();
  const { go } = useApp();
  const st = services.fed.state!;
  const [white, setWhite] = useState<string | null>(null);
  const [black, setBlack] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const w = white ? st.competitors.get(white) ?? null : null;
  const b = black ? st.competitors.get(black) ?? null : null;
  const start = async () => {
    if (!w || !b) return;
    setErr(null); setStarting(true);
    try { const g = await services.exhibitions.start(w, b); go({ name: 'exhibition', id: g.id }); }
    catch (e) { setErr((e as Error).message); } finally { setStarting(false); }
  };
  return (
    <div data-testid="exhibition-home">
      <header className="page-head">
        <div className="kicker">Federation · Unofficial</div>
        <h1>Exhibition Arena</h1>
        <p className="muted">Pick any two competitors of the Federation, at any rating, division, region or title, and watch them play an unofficial match. Each side plays with its own engine strength and style, exactly as in Federation games. Afterwards you can study the game with the full Match Analysis.</p>
      </header>
      <div className="notice small" data-testid="exhibition-isolation" style={{ marginBottom: 12 }}>
        <strong>Unofficial.</strong> Exhibitions never change career ratings, rating deviations, game counts, standings, win/loss records, prize money, balances, markets, achievements, titles, trophies, rivalries or the Federation schedule. They are kept in their own Exhibition archive.
      </div>
      {err && <div className="notice warn" role="alert">{err}</div>}
      <div className="grid-2 exh-pickers">
        <CompetitorPicker side="white" selected={w} other={b} onSelect={c => setWhite(c?.id ?? null)} />
        <CompetitorPicker side="black" selected={b} other={w} onSelect={c => setBlack(c?.id ?? null)} />
      </div>
      <div className="panel row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button className="btn" data-testid="exh-swap" disabled={!w && !b} onClick={() => { setWhite(black); setBlack(white); }}>Swap Colours</button>
        <span className="spacer" />
        {w && b && w.id === b.id && <span className="small neg" role="alert">Choose two different competitors.</span>}
        <span className="small muted">{w && b ? `${w.name} (White) vs ${b.name} (Black)` : 'Choose White and Black.'}</span>
        <button className="btn primary" data-testid="exh-start" disabled={!w || !b || w.id === b.id || starting || services.readOnly} onClick={() => void start()}>Start Exhibition</button>
      </div>
      <ExhibitionHistory />
    </div>
  );
}

function CompetitorPicker({ side, selected, other, onSelect }: { side: Pov; selected: Competitor | null; other: Competitor | null; onSelect: (c: Competitor | null) => void }) {
  const services = useServices();
  const fed = services.fed;
  const st = fed.state!;
  const [q, setQ] = useState('');
  const [band, setBand] = useState(-1);
  const [division, setDivision] = useState(0);
  const [page, setPage] = useState(0);
  const dq = useDeferredValue(q);
  const list = useMemo(() => {
    const B = band >= 0 ? RATING_BANDS[band] : null;
    const minR = !B || B.lo === -Infinity ? -1e9 : B.lo - 0.5, maxR = !B || B.hi === Infinity ? 1e9 : B.hi - 0.5 - 1e-9;
    return filterCompetitors(st.competitors.values(), { q: dq, region: -1, division, minR, maxR, title: '', style: '', club: '', special: '' }, NO_SETS);
  }, [st, dq, band, division]);
  useEffect(() => setPage(0), [dq, band, division]);
  const pg = pageOf(list, page, PICK_PAGE);
  const Side = side === 'white' ? 'White' : 'Black';
  return (
    <div className="panel stack" data-testid={`exh-picker-${side}`}>
      <div className="panel-title"><h3 style={{ margin: 0 }}><span className={`mc-pip ${side}`} aria-hidden /> {Side}</h3>{selected && <button className="btn small ghost" onClick={() => onSelect(null)}>Clear</button>}</div>
      {selected ? <SelectedCard c={selected} side={side} /> : <p className="small muted" style={{ margin: 0 }}>No competitor chosen yet.</p>}
      <input type="search" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} aria-label={`Search competitors for ${Side}`} data-testid={`exh-search-${side}`} />
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <label className="small">Rating <select value={band} onChange={e => setBand(+e.target.value)} data-testid={`exh-band-${side}`} aria-label={`Rating band for ${Side}`}>
          <option value={-1}>Any rating</option>
          {RATING_BANDS.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
        </select></label>
        <label className="small">Division <select value={division} onChange={e => setDivision(+e.target.value)} aria-label={`Division for ${Side}`}>
          <option value={0}>Any division</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(d => <option key={d} value={d}>{divisionLabel(d)}</option>)}
        </select></label>
      </div>
      <div className="small muted" data-testid={`exh-count-${side}`}>{list.length.toLocaleString('en-US')} competitors match</div>
      <ul className="exh-pick-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {pg.rows.map(c => {
          const sp = shownPersona(c, fed.showNames);
          const f = sideFacts(c);
          const taken = other?.id === c.id;
          return (
            <li key={c.id}>
              <button className="btn ghost exh-pick-row" data-testid={`exh-row-${side}`} data-id={c.id} data-rating={Math.round(c.rating)} aria-pressed={selected?.id === c.id} disabled={taken}
                title={taken ? 'Already playing the other colour' : undefined} onClick={() => onSelect(c)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', flexWrap: 'wrap', gap: '2px 8px', alignItems: 'baseline', whiteSpace: 'normal' }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{c.name}</strong>
                <span className="mono">{elo(c.rating)}</span>
                <span className="small muted">{f.division}{c.fedTitle ? ` · ${c.fedTitle}` : ''} · {f.styleLabel}</span>
                {sp && <span className="chip small" title={sp.kind === 'historical' ? 'Historical persona (fictional)' : CONTEMPORARY_DISCLOSURE}>Persona</span>}
                {taken && <span className="chip small">Other side</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="small muted">No competitor matches.</p>}
      {pg.pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
          <button className="btn small" aria-label={`Previous page (${Side})`} disabled={pg.page === 0} onClick={() => setPage(pg.page - 1)}>←</button>
          <span className="small">Page {pg.page + 1} of {pg.pages}</span>
          <button className="btn small" aria-label={`Next page (${Side})`} disabled={pg.page >= pg.pages - 1} onClick={() => setPage(pg.page + 1)}>→</button>
        </div>
      )}
    </div>
  );
}

function SelectedCard({ c, side }: { c: Competitor; side: Pov }) {
  const services = useServices();
  const sp = shownPersona(c, services.fed.showNames);
  const f = sideFacts(c);
  return (
    <div className="stack" style={{ gap: 4 }} data-testid={`exh-selected-${side}`} data-id={c.id}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Portrait seed={c.portraitSeed} size={34} />
        <strong style={{ overflowWrap: 'anywhere' }}>{c.name}</strong>
        <span className="mono" title="Career Elo (Glicko-2 rating)">{elo(c.rating)} ±{Math.round(c.rd)}</span>
      </div>
      <div className="small">{f.division}{c.fedTitle ? ` · Federation Title ${c.fedTitle}` : ''} · {f.styleLabel}</div>
      {f.scouting && <div className="small muted">{f.scouting}</div>}
      {f.note.text && <div className="small muted" data-testid={`exh-note-${side}`}>{f.note.text}</div>}
      {sp && <div className="small muted">Persona{sp.kind === 'contemporary' ? `: ${CONTEMPORARY_DISCLOSURE}` : ' (historical figure, fictional chess persona)'}</div>}
    </div>
  );
}

function ExhibitionHistory() {
  const services = useServices();
  const { go } = useApp();
  const [rows, setRows] = useState<ExhibitionGame[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => { let live = true; void listExhibitions(services.db).then(r => { if (live) setRows(r); }); return () => { live = false; }; }, [services.revision]);
  const del = async (id: string) => {
    if (services.exhibitions.game?.id === id) services.exhibitions.close();
    await deleteExhibition(services.db, id);
    setConfirm(null);
    services.notify();
  };
  return (
    <div className="panel stack" data-testid="exhibition-history" style={{ marginTop: 12 }}>
      <div className="panel-title"><h3 style={{ margin: 0 }}>Exhibition History</h3><button className="btn small ghost" onClick={() => go({ name: 'replays' })}>Replay Library</button></div>
      {rows === null ? <p className="small muted">Loading…</p> : rows.length === 0 ? <p className="small muted">No exhibitions yet.</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
          {rows.map(g => (
            <li key={g.id} className="row" style={{ flexWrap: 'wrap', gap: 6 }} data-testid="exh-history-row" data-id={g.id} data-status={g.status}>
              <button className="btn ghost" style={{ flex: '1 1 220px', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => go({ name: 'exhibition', id: g.id })}>
                <strong>{g.white.name}</strong> <span className="mono muted">{elo(g.white.rating)}</span> – <strong>{g.black.name}</strong> <span className="mono muted">{elo(g.black.rating)}</span>
                <span className="small muted"> · {g.status === 'finished' ? RESULT_LABEL(g.result) : `unfinished, ${g.moves.length} plies`} · {Math.ceil(g.moves.length / 2)} moves · {g.createdAt.slice(0, 10)}</span>
              </button>
              {confirm === g.id
                ? <><button className="btn small danger" data-testid="exh-delete-confirm" disabled={services.readOnly} onClick={() => void del(g.id)}>Delete for Good</button><button className="btn small ghost" onClick={() => setConfirm(null)}>Keep</button></>
                : <button className="btn small ghost" data-testid="exh-delete" disabled={services.readOnly} onClick={() => setConfirm(g.id)}>Delete</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ watch + study */

function ExhibitionMatch({ id }: { id: string }) {
  const services = useServices();
  const { go } = useApp();
  const runner = services.exhibitions;
  const [stored, setStored] = useState<ExhibitionGame | null | undefined>(undefined);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [ply, setPly] = useState(0);
  const [follow, setFollow] = useState(true);
  const [speed, setSpeed] = useState(() => Math.max(0, EXHIBITION_SPEEDS.findIndex(s => s.ms === runner.paceMs)));
  const [orientation, setOrientation] = useState<Pov>('white');
  const [tab, setTab] = useState<string>('board');
  const [sandboxOrigin, setSandboxOrigin] = useState(0);
  const [practice, setPractice] = useState<{ ply: number; san: string } | null>(null);

  useEffect(() => {
    let live = true;
    void runner.open(id).then(g => { if (!live) return; setStored(g); if (g && g.status === 'finished') { setFollow(false); setPly(0); } });
    return () => { live = false; if (runner.game?.id === id && runner.state === 'running') runner.pause(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let live = true; void loadExhibitionReport(services.db, id).then(r => { if (live) setReport(r); }); return () => { live = false; }; }, [id, services.revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = runner.game?.id === id ? runner.game : stored ?? null;
  const moves = g?.moves ?? [];
  useEffect(() => { if (follow) setPly(moves.length); }, [moves.length, follow]);
  const reportReady = !!report && report.status === 'complete' && report.plies.length === moves.length && g?.status === 'finished';
  const postCurve = useMemo(() => (reportReady ? report!.plies.map(p => expectedU(toPov(p.evalAfter, 'white'), report!.methodology.accuracyId)) : null), [reportReady, report]);
  const pubCurve = useMemo(() => moves.map(m => expectedU(toPov(m.score, 'white'))), [moves]);
  const turns = useMemo(() => turningPoints(postCurve ?? pubCurve, 3), [postCurve, pubCurve]);
  const events = useMemo(() => matchEvents({ sans: moves.map(m => m.san), us: postCurve ?? pubCurve, timeline: null, result: g?.status === 'finished' ? g.result : null, termination: g?.termination ?? null }), [moves, postCurve, pubCurve, g?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const sandbox = useSandbox({ initialFen: g?.initialFen ?? 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1', mainline: moves.map(m => m.ccn) });

  if (stored === undefined && runner.game?.id !== id) return <p className="muted" role="status">Loading the exhibition…</p>;
  if (!g) return <div className="panel"><p>This exhibition doesn't exist (it may have been deleted).</p><button className="btn" onClick={() => go({ name: 'exhibition' })}>Exhibition Arena</button></div>;

  const st = services.fed.state!;
  const finished = g.status === 'finished';
  const isCurrent = runner.game?.id === id;
  const busy = isCurrent && runner.busy;
  const finishing = isCurrent && runner.state === 'finishing';
  const inSandbox = !!sandbox.sandbox;
  const nav = (to: number) => { if (inSandbox) sandbox.exit(); setPractice(null); const t = Math.max(0, Math.min(moves.length, to)); setFollow(t >= moves.length && !finished); setPly(t); };
  const next = () => {
    if (ply < moves.length) { nav(ply + 1); return; }
    if (!finished && !busy) { setFollow(true); void runner.stepForward(); } // paused at the newest move: compute one more
  };
  const togglePlay = () => { if (busy) runner.pause(); else { setFollow(true); runner.resume(); } };
  const setPace = (i: number) => { setSpeed(i); runner.paceMs = EXHIBITION_SPEEDS[i].ms; };
  const skip = async () => { setFollow(true); await runner.finish(); };
  const analysing = services.progress?.gameId === id;

  const mainFen = ply === 0 ? g.initialFen : moves[ply - 1]?.fen ?? g.initialFen;
  const fen = inSandbox ? sandbox.fen! : mainFen;
  const last = inSandbox ? (sandbox.sandbox!.line.length ? sandbox.sandbox!.line[sandbox.sandbox!.line.length - 1] : null) : ply > 0 ? moves[ply - 1]?.ccn : null;
  const checkSq = (() => { try { const p = Position.fromFen(fen); return p.inCheck() ? squareName(p.kingSq[p.side]) : null; } catch { return null; } })();
  const cur = ply > 0 ? moves[ply - 1] : null;
  const curPost = reportReady && ply > 0 ? report!.plies[ply - 1] : null;
  const barScore: EngineScore | null = inSandbox ? sandbox.eval?.score ?? null : curPost ? curPost.evalAfter : cur ? cur.score : null;
  const barSource = inSandbox ? 'sandbox engine evaluation' : curPost ? 'Match Analysis' : 'published engine evaluation (the moving engine’s own score)';
  const status = finished ? 'REPLAY · Exhibition' : finishing ? 'LIVE · Computing to the End' : busy ? 'LIVE · Exhibition' : 'PAUSED · Exhibition';

  const Player = ({ s, color }: { s: ExhibitionSide; color: Pov }) => {
    const c = st.competitors.get(s.id);
    const sp = shownPersona(c, services.fed.showNames);
    const f = sideFacts({ style: s.style, rating: s.rating, division: s.division });
    const toMove = !finished && moves.length % 2 === (color === 'white' ? 0 : 1) && ply === moves.length;
    return (
      <PlayerBar color={color} active={toMove && busy} testId={`exh-player-${color}`}
        avatar={c ? <Portrait seed={c.portraitSeed} size={34} /> : undefined}
        name={<button className="btn ghost small arena-player-name" onClick={() => go({ name: 'competitor', id: s.id })}><strong>{c?.name ?? s.name}</strong></button>}
        meta={<>
          <span className="mono" title="Career Elo at the start of the exhibition">{elo(s.rating)} ±{Math.round(s.rd)}</span>
          <span>{divisionLabel(s.division)}{s.fedTitle ? ` · ${s.fedTitle}` : ''}</span>
          <span title={f.scouting ?? undefined}>{STYLE_LABEL[s.playedStyle]}</span>
          {sp && <span className="chip" data-testid={`exh-persona-${color}`} title={sp.kind === 'historical' ? 'Historical persona (fictional)' : CONTEMPORARY_DISCLOSURE}>Persona</span>}
        </>}>
        {f.note.text && (f.note.kind === 'beyond-measured' || f.note.kind === 'below-measured' || f.note.kind === 'beginner') && <div className="small muted" data-testid={`exh-strength-${color}`}>{f.note.kind === 'beyond-measured' ? 'Plays at the Federation’s strongest measured engine within this device’s budget (rated above the measured range).' : f.note.text}</div>}
      </PlayerBar>
    );
  };

  const replay = {
    playing: busy, onToggle: togglePlay, testId: 'exh-pause', playLabel: 'Resume', disabled: finished,
    speeds: EXHIBITION_SPEEDS, speed, onSpeed: setPace,
  };
  const board = (
    <>
      <Player s={orientation === 'white' ? g.black : g.white} color={orientation === 'white' ? 'black' : 'white'} />
      <EvalBoard context={{ kind: finished ? 'replay' : 'spectate' }} score={barScore} orientation={orientation} accuracyId={!inSandbox && curPost ? report!.methodology.accuracyId : undefined} source={barSource}>
        <Board sounds={!inSandbox} live={!finished && follow} fen={fen} orientation={orientation} lastMove={last} checkSquare={checkSq}
          legal={inSandbox ? sandbox.legal : []} onMove={inSandbox ? sandbox.play : undefined}
          label={inSandbox ? `Sandbox board from move ${sandboxOrigin}` : `${g.white.name} vs ${g.black.name}, after ${ply} moves`} />
      </EvalBoard>
      <Player s={orientation === 'white' ? g.white : g.black} color={orientation} />
      {[g.white, g.black].some(s => shownPersona(st.competitors.get(s.id), services.fed.showNames)?.kind === 'contemporary') && (
        <p className="small muted" style={{ margin: '4px 0' }}>Persona: {CONTEMPORARY_DISCLOSURE} Ratings and results are assigned by the world seed.</p>
      )}
      <MoveNav onFirst={() => nav(0)} onPrev={() => nav(ply - 1)} onNext={next} onLast={() => { setFollow(!finished); nav(moves.length); }} lastLabel="Latest Move"
        onFlip={() => setOrientation(o => (o === 'white' ? 'black' : 'white'))}
        indicator={<span className="chip mono" data-testid="exh-ply">{inSandbox ? 'sandbox' : `${ply}/${moves.length}`}</span>}
        replay={replay}>
        {!finished && <button className="btn small" data-testid="exh-skip" disabled={finishing || services.readOnly} onClick={() => void skip()}>{finishing ? 'Computing…' : 'Skip to Result'}</button>}
      </MoveNav>
      {isCurrent && runner.error && <div className="notice warn" role="alert">The engine stopped: {runner.error} Resume to try again.</div>}
      {finished && <div className="notice" data-testid="exh-final"><strong>Final result: {RESULT_LABEL(g.result)}</strong> · {(g.termination ?? '').replace(/-/g, ' ')} · {Math.ceil(moves.length / 2)} moves</div>}
      {finished && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {!inSandbox && <button className="btn small" data-testid="sandbox-start" onClick={() => { setSandboxOrigin(ply); setPractice(null); sandbox.start(ply); }}>Try a Move Here</button>}
          <button className="btn small ghost" onClick={() => go({ name: 'replays' })}>Replay Library</button>
          <button className="btn small ghost" onClick={() => go({ name: 'exhibition' })}>New Exhibition</button>
        </div>
      )}
      {inSandbox && practice && <div className="small notice" data-testid="exh-practice">Practise: {practice.san} was played here. Find a better move on the board, then compare with the engine.</div>}
      {inSandbox && <SandboxPanel sb={sandbox} gameId={id} originPly={sandboxOrigin} onExit={() => { sandbox.exit(); setPractice(null); }} />}
    </>
  );

  const movesPanel = (
    <div className="panel stack" data-testid="exh-moves-panel">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Moves &amp; Evaluation</h3><span className="small muted mono">Move {ply} of {moves.length}</span></div>
      <LiveEvalGraph moves={moves} shown={moves.length} post={postCurve} onSelect={nav} ply={ply} turns={turns.map(t => t.ply)} />
      <div className="legend small" aria-hidden>
        <span><i style={{ background: 'var(--accent)' }} />Published evaluation (White's expected score)</span>
        {postCurve && <span><i style={{ background: '#6aa7ff' }} />Match Analysis</span>}
      </div>
      {cur && <div className="small mono" data-testid="exh-current">{Math.ceil(ply / 2)}{ply % 2 ? '.' : '…'} {cur.san} · Eval {formatEval(cur.score)}{curPost ? ` · ${curPost.grade ? GRADE_LABEL[curPost.grade] : 'Not graded'}` : ''}</div>}
      <NotationList moves={moves.map((m, i) => ({ san: m.san, grade: reportReady ? report!.plies[i]?.grade ?? null : undefined }))} current={inSandbox ? 0 : ply} onSelect={nav}
        label="Move list" testId="exh-moves" itemTestId="exh-move" empty="Moves appear here as they are played." />
      <MatchEventList events={events} onSelect={nav} current={ply} />
    </div>
  );

  const studyPanel = (
    <div className="panel stack" data-testid="exh-study">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Study</h3><span className="chip gold">Unofficial</span></div>
      {!finished ? <p className="small muted" style={{ margin: 0 }}>Match Analysis runs when the game is over. Use Skip to Result to finish it now.</p>
        : !reportReady ? (
          <div className="small" data-testid="exh-analysis-status">
            {analysing ? `Match Analysis running: ${services.progress!.done}/${services.progress!.total} moves.` : 'Match Analysis is queued.'}
            {!analysing && <button className="btn small" style={{ marginLeft: 8 }} disabled={services.readOnly} onClick={() => void services.requestExhibitionAnalysis(id)}>Queue Again</button>}
          </div>
        ) : <ExhibitionStudy g={g} report={report!} turns={turns} ply={ply} onSelect={nav}
          onPractise={(p, san) => { setPractice({ ply: p, san }); setFollow(false); setPly(p - 1); setSandboxOrigin(p - 1); sandbox.start(p - 1); setTab('board'); }} />}
      <EloComparison g={g} current={(cid: string) => st.competitors.get(cid)?.rating ?? null} />
      <LessonLinks topics={['turning-points', ...(reportReady ? ['postgame-study'] : []), ...(moves.length > 60 ? ['endgame'] : [])]} />
      <details className="small muted"><summary>How exhibitions are played</summary>
        <p>Each side plays with its own engine profile (its hidden strength mapped onto the calibrated engines, crown-profile-map-2) and its validated style, exactly like Federation featured and scheduled games, with the same budget of at most {EXHIBITION_NODE_CAP.toLocaleString('en-US')} nodes per move. A competitor rated above the strongest measured engine plays at that strongest budget; below the weakest calibrated beginner engine it plays that engine.</p>
        <p>The evaluation bar shows the moving engine’s own published score while the game is played, and the Match Analysis evaluation afterwards ({DEFAULT_ANALYSIS.label ?? DEFAULT_ANALYSIS.id}, engine {ENGINE_BUILD}). Played Like for exhibitions stays in this exhibition; it never enters your career records.</p>
      </details>
    </div>
  );

  return (
    <div className="mc arena" data-testid="exhibition" data-state={isCurrent ? runner.state : g.status} data-plies={moves.length} data-result={g.result ?? ''}
      onKeyDown={moveKeys({ first: () => nav(0), prev: () => nav(ply - 1), next, last: () => nav(moves.length) })}>
      <MatchHeader
        back={{ label: '← Exhibition Arena', onClick: () => go({ name: 'exhibition' }) }}
        kicker="Exhibition Arena · Unofficial"
        title="Exhibition Match"
        subtitle={`Started ${g.createdAt.slice(0, 16).replace('T', ' ')} · no rating, standings, money or records change`}
        status={<>
          <span className={`chip arena-status ${status.startsWith('LIVE') ? 'neg is-live' : status.startsWith('REPLAY') ? 'info' : ''}`} data-testid="exh-status">{status}</span>
          {finished && !reportReady && <span className="chip">Match Analysis {analysing ? `${services.progress!.done}/${services.progress!.total}` : 'Queued'}</span>}
        </>}
        white={{ name: g.white.name, rating: elo(g.white.rating) }}
        black={{ name: g.black.name, rating: elo(g.black.rating) }}
        result={finished ? RESULT_LABEL(g.result) : null} />
      <MatchLayout className="arena-layout" columns={2} board={board} active={tab} onActive={setTab} tabsLabel="Exhibition Panels" boardTab="Board"
        panels={[
          { id: 'moves', label: 'Moves', content: movesPanel, column: 0 },
          { id: 'study', label: 'Study', content: studyPanel, column: 1 },
        ]} />
    </div>
  );
}

function ExhibitionStudy({ g, report, turns, ply, onSelect, onPractise }: {
  g: ExhibitionGame; report: AnalysisReport; turns: ReturnType<typeof turningPoints>; ply: number; onSelect: (ply: number) => void; onPractise: (ply: number, san: string) => void;
}) {
  const bad = report.plies.filter(p => p.grade === 'mistake' || p.grade === 'blunder');
  const grades: Grade[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
  return (
    <div className="stack" data-testid="exh-report">
      <div className="small" data-testid="exh-grade-summary">{grades.map(gr => {
        const nW = report.summary.white.counts[gr], nB = report.summary.black.counts[gr];
        return nW + nB ? <span key={gr} className="chip" style={{ marginRight: 4 }}><GradeIcon grade={gr} /> {GRADE_LABEL[gr]} {nW}/{nB}</span> : null;
      })} <span className="muted">(White/Black)</span></div>
      <div className="small">Accuracy: {g.white.name} {report.summary.white.accuracy?.toFixed(1) ?? '—'} · {g.black.name} {report.summary.black.accuracy?.toFixed(1) ?? '—'}</div>
      <ExhibitionPlayedLike g={g} report={report} />
      <div className="stack" data-testid="exh-mistakes">
        <h4 style={{ margin: 0 }}>Mistakes and Blunders</h4>
        {bad.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Neither side made a mistake or a blunder.</p> : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
            {bad.map(p => (
              <li key={p.ply} className="row small" style={{ flexWrap: 'wrap', gap: 6 }}>
                <button className="btn small ghost" aria-current={ply === p.ply ? 'step' : undefined} onClick={() => onSelect(p.ply)}>
                  <GradeIcon grade={p.grade} /> {Math.ceil(p.ply / 2)}{p.ply % 2 ? '.' : '…'} {p.san} ({p.color === 'white' ? g.white.name : g.black.name}) · best {p.best.san}
                </button>
                <button className="btn small" data-testid="exh-practise" onClick={() => onPractise(p.ply, p.san)}>Practise This Position</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <TurningPointList points={turns} onSelect={onSelect} current={ply} source="Match Analysis" />
    </div>
  );
}

/** Played Like for both sides of an exhibition (package H's panel, from the report's playedLike; kept with the exhibition only). */
function ExhibitionPlayedLike({ g, report }: { g: ExhibitionGame; report: AnalysisReport }) {
  return (
    <div className="stack" data-testid="exh-played-like">
      <PlayedLikePanel report={report} sides={{ white: { name: g.white.name, career: g.white.rating }, black: { name: g.black.name, career: g.black.rating } }}
        testIds={{ white: 'exh-played-like-white', black: 'exh-played-like-black' }} />
      <div className="small muted">Shown here only: exhibition Played Like never enters your career records or averages.</div>
    </div>
  );
}

function EloComparison({ g, current }: { g: ExhibitionGame; current: (id: string) => number | null }) {
  const e = eloExpectation(g.white.rating, g.black.rating);
  const score = g.result === '1-0' ? 1 : g.result === '0-1' ? 0 : g.result === '1/2-1/2' ? 0.5 : null;
  const row = (s: ExhibitionSide, exp: number, sc: number | null) => {
    const now = current(s.id);
    return <tr key={s.id}><td>{s.name}</td><td className="mono">{elo(s.rating)}</td><td className="mono" data-testid="exh-elo-now">{now === null ? '—' : elo(now)}</td><td className="mono">{(exp * 100).toFixed(0)}%</td><td className="mono">{sc === null ? '—' : sc === 0.5 ? '½' : sc}</td></tr>;
  };
  return (
    <div className="stack" data-testid="exh-elo">
      <h4 style={{ margin: 0 }}>Career Elo Comparison</h4>
      <div style={{ overflowX: 'auto' }}>
        <table className="small"><thead><tr><th>Competitor</th><th>At start</th><th>Now</th><th>Elo expectation</th><th>Score</th></tr></thead>
          <tbody>{row(g.white, e, score)}{row(g.black, 1 - e, score === null ? null : 1 - score)}</tbody></table>
      </div>
      <div className="small muted">Gap {elo(Math.abs(g.white.rating - g.black.rating))} points. Exhibitions are unofficial: neither career Elo changes because of this game.</div>
    </div>
  );
}
