/**
 * Sovereign Live Arena (crown-arena-1): one dashboard for a federation engine match — board, clocks, players and
 * context, notation, evaluation graph, live market prices and history, portfolio and replay.
 *
 * Information policy (crown-arena-policy-1), enforced here and in the services:
 *  1. Public live-match information: moves already published, the players' public profiles, thinking time.
 *  2. Market-authorised public evaluation: the evaluation the moving engine itself produced for the move just
 *     played — published at the same moment to the player and to every NPC trader (it drives the live model).
 *  3. Privileged deep analysis: never shown and never computed while the official market can trade.
 *  4. Post-game analysis (move-quality labels, canonical evaluation curve): computed by the canonical engine only
 *     after the game is recorded and its market is settled or cancelled, and labelled with its provenance.
 * Every live view reads the same committed state; trades carry the market revision they were quoted on and are
 * rejected if a move or trade happened in between.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useServices } from './App';
import { Board } from './Board';
import { Icon } from './Icons';
import { whiteU, formatScore } from './Charts';
import { Portrait } from './Portrait';
import { Emblem } from './Emblem';
import { GradeIcon, GRADE_LABEL } from './AnalysisScreen';
import { eventName, WorldGame } from '../app/federation';
import type { SelfplayMove } from '../engine/selfplay';
import { OUTCOMES, claimPrices, claimsOf, liquidationValue, revisionOf } from '../exchange/market';
import { fmtCrowns } from '../exchange/ledger';
import { TradeTicket, PriceChart } from './ExchangeScreen';
import { STYLE_LABEL, isValidatedStyle } from '../engine/styles';
import { divisionEmblem, titleEmblem } from '../heraldry/catalog';
import { clubEmblem, clubOf } from '../heraldry/clubs';
import { divisionLabel } from '../federation/model';
import { ENGINE_BUILD } from '../analysis/analyzer';
import { GRADING_ID, expectedU, toPov } from '../analysis/methodology';
import type { AnalysisReport } from '../analysis/types';

const START_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const SPEEDS = [{ label: 'Slow', ms: 2200 }, { label: 'Normal', ms: 1100 }, { label: 'Fast', ms: 450 }, { label: 'Instant', ms: 0 }];
const WINDOWS = [{ label: '6 s', ms: 6000 }, { label: '3 s', ms: 3000 }, { label: '1 s', ms: 1000 }];

/** White's expected score by ply: the published engine evaluation (always) and the post-game curve (when allowed). */
function EvalGraph({ moves, shown, post, onSelect, ply }: { moves: SelfplayMove[]; shown: number; post: number[] | null; onSelect: (ply: number) => void; ply: number }) {
  const W = 600, H = 110;
  const n = Math.max(moves.length, 20);
  const x = (i: number) => (i / n) * W;
  const pub = moves.slice(0, shown).map((m, i) => `${x(i + 1)},${H - whiteU(m.score) * H}`);
  const pg = post ? post.slice(0, shown).map((u, i) => `${x(i + 1)},${H - u * H}`) : [];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" data-testid="arena-eval-graph"
      aria-label={`Expected score for White over ${shown} plies${post ? ', published evaluation and post-game analysis' : ', published engine evaluation'}. A table version follows.`}
      style={{ background: 'var(--chart-bg)', borderRadius: 8, cursor: 'pointer' }}
      onClick={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); onSelect(Math.max(0, Math.min(shown, Math.round(((e.clientX - r.left) / r.width) * n)))); }}>
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} style={{ stroke: 'var(--chart-grid)' }} />
      <line x1={x(ply)} x2={x(ply)} y1={0} y2={H} style={{ stroke: 'var(--line)' }} strokeDasharray="3 3" />
      {pub.length > 0 && <polyline points={`0,${H / 2} ${pub.join(' ')}`} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2} />}
      {pg.length > 0 && <polyline points={`0,${H / 2} ${pg.join(' ')}`} fill="none" style={{ stroke: '#6aa7ff' }} strokeWidth={2.2} strokeDasharray="6 3" />}
    </svg>
  );
}

export function SpectatorScreen({ fixtureId }: { fixtureId: string }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [game, setGame] = useState<WorldGame | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [ply, setPly] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [tab, setTab] = useState<'analysis' | 'market' | 'portfolio'>('analysis');
  const startedHere = useRef(false);

  useEffect(() => {
    let live = true;
    fed.worldGame(`wg:${fixtureId}`).then(g => { if (!live) return; setGame(g ?? null); if (g && !startedHere.current) { setRevealed(g.moves.length); setPly(0); setFollow(false); } });
    services.reportsFor(`wg:${fixtureId}`).then(rs => { if (live) setReport([...rs].reverse().find(r => r.status === 'complete') ?? null); });
    return () => { live = false; };
  }, [fixtureId, services.revision]);

  const st = fed.state;
  const fixture = st ? [...st.rounds.values()].flatMap(r => r.fixtures).find(f => f.id === fixtureId) : undefined;
  const liveMoves = fed.live.get(fixtureId);
  const lg = fed.liveGame(fixtureId);
  const inPlay = !!lg && lg.status === 'live';
  const isLive = fed.isLive(fixtureId) || inPlay;
  const moves: SelfplayMove[] = game?.moves ?? (lg ? lg.moves : liveMoves) ?? [];
  const generationDone = !!game;
  if (isLive) startedHere.current = true;
  const [seenEnd, setSeenEnd] = useState(false);
  useEffect(() => { if (generationDone && ply === moves.length && revealed === moves.length) setSeenEnd(true); }, [generationDone, ply, revealed, moves.length]);
  const market = fed.marketFor(fixtureId);
  useEffect(() => { if (lg && !game) setRevealed(moves.length); }, [lg?.moves.length]);
  const [running, setRunning] = useState(false);
  const [windowIdx, setWindowIdx] = useState(1);
  const stepping = useRef(false);
  const step = async () => {
    if (stepping.current) return;
    stepping.current = true;
    try { const r = await fed.liveStep(fixtureId, fed.liveGame(fixtureId)?.moves.length); if (r.done) setRunning(false); } catch (e) { setErr((e as Error).message); setRunning(false); } finally { stepping.current = false; }
  };
  useEffect(() => {
    if (!running || !inPlay) return;
    const t = setTimeout(() => { void step(); }, WINDOWS[windowIdx].ms);
    return () => clearTimeout(t);
  }, [running, inPlay, lg?.moves.length, windowIdx]);
  useEffect(() => {
    if (paused || revealed >= moves.length) return;
    const ms = SPEEDS[speed].ms;
    const t = setTimeout(() => setRevealed(r => (ms === 0 ? moves.length : r + 1)), ms);
    return () => clearTimeout(t);
  }, [paused, revealed, moves.length, speed]);
  useEffect(() => { if (follow) setPly(revealed); }, [revealed, follow]);

  // policy gate for post-game analysis: recorded game, market no longer tradable, replay reached the end
  const marketTradable = !!market && (market.status === 'open' || market.status === 'closed');
  const allRevealed = generationDone && revealed >= moves.length && seenEnd;
  const postAllowed = generationDone && !marketTradable && !isLive;
  const postReady = postAllowed && !!report && report.plies.length > 0;
  const autoRequested = useRef(false);
  useEffect(() => {
    if (postAllowed && !report && !autoRequested.current && !services.readOnly) { autoRequested.current = true; void services.requestWorldAnalysis(fixtureId); }
  }, [postAllowed, !!report]);
  const postCurve = useMemo(() => (postReady ? report!.plies.map(p => expectedU(toPov(p.evalAfter, 'white'), report!.methodology.accuracyId)) : null), [postReady, report]);

  if (!st) return <div className="panel"><p>Found the federation first.</p></div>;
  if (!fixture) return <div className="panel"><p>Unknown match.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  const w = st.competitors.get(fixture.white), b = st.competitors.get(fixture.black);
  const start = async () => {
    setErr(null); startedHere.current = true; setRevealed(0); setFollow(true);
    try { await fed.playFeatured(fixtureId, 'watched-live'); } catch (e) { setErr((e as Error).message); }
  };
  const startInPlay = async () => {
    setErr(null); startedHere.current = true; setFollow(true);
    try { await fed.startLive(fixtureId); setRunning(false); } catch (e) { setErr((e as Error).message); }
  };
  const fen = ply === 0 ? (game?.initialFen ?? START_FEN) : moves[ply - 1]?.fen ?? START_FEN;
  const last = ply > 0 ? moves[ply - 1]?.ccn : null;
  const status = game ? (game.mode === 'watched-live' && startedHere.current && revealed < moves.length ? 'LIVE · reveal in progress' : 'REPLAY · recorded game') : inPlay ? 'LIVE · in-play trading' : isLive ? 'LIVE · being played now' : fixture.result === null ? 'NOT STARTED' : 'SUMMARY RESULT';
  const finalShown = allRevealed ? game!.result : null;
  const nav = (to: number) => { setFollow(to >= revealed); setPly(Math.max(0, Math.min(revealed, to))); };
  const think = [0, 0];
  moves.slice(0, ply).forEach((m, i) => { think[i % 2] += m.ms; });
  const fmtT = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  const sideToMove = ply % 2;
  const cur = ply > 0 ? moves[ply - 1] : null;
  const curPost = postReady && ply > 0 ? report!.plies[ply - 1] : null;
  const pos = market ? st.positions.get(`${market.id}|player:cash`) : undefined;
  const fin = fed.finance();

  const PlayerCard = ({ id, side }: { id: string; side: 0 | 1 }) => {
    const c = st.competitors.get(id);
    if (!c) return null;
    const club = clubOf(c.id, c.region);
    return (
      <div className="row small arena-player" data-testid={`arena-player-${side ? 'black' : 'white'}`}>
        <Portrait seed={c.portraitSeed} size={34} crown={c.titles.some(t => /Crown Champion/.test(t.title))} />
        <span className="stack" style={{ gap: 0 }}>
          <button className="btn ghost small" style={{ padding: 0, minHeight: 0, justifyContent: 'flex-start' }} onClick={() => go({ name: 'competitor', id: c.id })}><strong>{c.name}</strong></button>
          <span className="muted row" style={{ gap: 4 }}>
            {Math.round(c.rating)} ±{Math.round(c.rd)} · <Emblem spec={divisionEmblem(c.division)} size="sm" title={divisionLabel(c.division)} /><Emblem spec={clubEmblem(club.identity)} size="sm" title={club.identity.name} />
            {c.fedTitle && <Emblem spec={titleEmblem(c.fedTitle)} size="sm" title={`Federation title ${c.fedTitle}`} />} · {isValidatedStyle(c.style) ? STYLE_LABEL[c.style] : 'Universal'} · {side ? 'Black' : 'White'}
          </span>
        </span>
        <span className="spacer" />
        <span className={`chip mono ${sideToMove === side && isLive && ply === revealed ? 'gold' : ''}`} title="Engine thinking time used (node-limited game, no game clock)" data-testid={`think-${side ? 'black' : 'white'}`}>⏱ {fmtT(think[side])}</span>
      </div>
    );
  };

  const policy = (
    <div className="small muted" data-testid="arena-policy">
      {marketTradable ? <>Information shown: <strong>published moves and the moving engine’s own evaluation</strong> — exactly what every trader receives. Move-quality labels and deep analysis stay hidden until the market is settled.</>
        : postReady ? <>Post-game analysis by <span className="mono">{report!.engine.buildId}</span> ({report!.methodology.gradingId}), computed after settlement.</>
          : postAllowed ? <>Post-game analysis is queued (canonical engine); labels appear when it completes.</> : <>Published moves and evaluations only.</>}
    </div>
  );

  const analysisPanel = (
    <div className="panel stack" data-testid="arena-analysis">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Moves &amp; evaluation</h3><span className="small muted mono">ply {ply}/{revealed}</span></div>
      <EvalGraph moves={moves} shown={revealed} post={postCurve} onSelect={nav} ply={ply} />
      <div className="small muted">Solid: published engine evaluation (expected score for White). {postCurve ? 'Dashed: post-game canonical analysis.' : ''}</div>
      {cur && <div className="small mono" data-testid="arena-current">{Math.ceil(ply / 2)}{ply % 2 ? '.' : '…'} {cur.san} · published eval {formatScore(cur.score)} · depth {cur.depth} · {cur.nodes.toLocaleString('en')} nodes{curPost ? ` · ${curPost.grade ? GRADE_LABEL[curPost.grade] : 'ungraded'} (post-game)` : ''}</div>}
      <div className="small arena-moves" data-testid="arena-moves">
        {moves.slice(0, revealed).map((m, i) => {
          const g = postReady ? report!.plies[i]?.grade ?? null : undefined;
          return <button key={i} className="btn ghost small" style={{ padding: '0 4px', minHeight: 0, fontWeight: i + 1 === ply ? 700 : 400 }} onClick={() => nav(i + 1)} data-testid="arena-move">{i % 2 === 0 ? `${i / 2 + 1}.` : ''}{m.san}{g !== undefined && <GradeIcon grade={g} />}</button>;
        })}
      </div>
      {postReady && (
        <div className="small" data-testid="arena-grade-summary">{(['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as const).map(gr => { const nW = report!.plies.filter((p, i) => i % 2 === 0 && p.grade === gr).length, nB = report!.plies.filter((p, i) => i % 2 === 1 && p.grade === gr).length; return nW + nB ? <span key={gr} className="chip" style={{ marginRight: 4 }}><GradeIcon grade={gr} /> {GRADE_LABEL[gr]} {nW}/{nB}</span> : null; })} <span className="muted">(White/Black)</span></div>
      )}
      <details className="small"><summary>Evaluation table (accessible version of the graph)</summary>
        <table className="small"><thead><tr><th>Ply</th><th>Move</th><th>Published eval</th><th>Post-game</th></tr></thead>
          <tbody>{moves.slice(0, revealed).map((m, i) => <tr key={i}><td>{i + 1}</td><td>{m.san}</td><td className="mono">{formatScore(m.score)}</td><td>{postReady ? `${report!.plies[i]?.grade ? GRADE_LABEL[report!.plies[i].grade!] : '—'} · ${(postCurve![i] * 100).toFixed(0)}%` : 'after settlement'}</td></tr>)}</tbody></table>
      </details>
      {policy}
    </div>
  );

  const marketPanel = market ? (
    <div className="panel stack" data-testid="arena-market" data-revision={revisionOf(market)}>
      <div className="panel-title"><h3 style={{ margin: 0 }}>Crown Exchange</h3><span className="chip">{market.status}{market.status === 'settled' && allRevealed ? ` · ${OUTCOMES[market.result!]}` : ''}</span></div>
      <table className="small"><thead><tr><th></th>{claimsOf(market).map(c => <th key={c.label}>{c.label}</th>)}</tr></thead><tbody>
        <tr><td>Price</td>{claimPrices(market).map((x, i) => <td key={i} className="mono" data-testid={`live-price-${i}`}>{(x * 100).toFixed(1)}¢</td>)}</tr>
        {inPlay && lg!.points.length > 0 && <tr><td>Live model</td>{lg!.points[lg!.points.length - 1].model.map((x, i) => <td key={i} className="mono">{(x * 100).toFixed(1)}%</td>)}</tr>}
        <tr><td>Pre-match model</td>{[market.forecast.w, market.forecast.d, market.forecast.l].map((x, i) => <td key={i} className="mono">{(x * 100).toFixed(0)}%</td>)}</tr>
      </tbody></table>
      <PriceChart m={market} points={lg?.points} />
      <div className="small muted">Revision <span className="mono" data-testid="arena-revision">{revisionOf(market)}</span> · {market.history.length} trades{lg ? ` · ${lg.points.length} published-move windows` : ''}. Prices move only through trades with the market maker; the live model is a forecast, never the price.</div>
      <details className="small"><summary>Price history table</summary>
        <table className="small"><thead><tr><th>#</th><th>When</th><th>Prices (W/D/B)</th></tr></thead>
          <tbody>{(lg?.points ?? []).map((p, i) => <tr key={i}><td>ply {p.ply}</td><td className="mono">{p.revision ?? ''}</td><td className="mono">{p.prices.map(x => (x * 100).toFixed(1)).join(' / ')}</td></tr>)}</tbody></table>
      </details>
      {market.status === 'open' && (fixture.result === null || inPlay) && <TradeTicket m={market} compact />}
    </div>
  ) : <div className="panel small" data-testid="arena-market">No official market on this match.</div>;

  const portfolioPanel = (
    <div className="panel stack" data-testid="arena-portfolio">
      <h3 style={{ margin: 0 }}>Your portfolio</h3>
      {market && pos ? (
        <table className="small"><tbody>
          <tr><td>Shares (W/D/B)</td><td className="mono" data-testid="arena-shares">{pos.shares.join(' / ')}</td></tr>
          <tr><td>Spent / received</td><td className="mono">{fmtCrowns(pos.spent)} / {fmtCrowns(pos.received)}</td></tr>
          {(market.status === 'open' || market.status === 'closed') && <tr><td>Executable value now</td><td className="mono">{fmtCrowns(liquidationValue(market, pos))}</td></tr>}
          {(market.status === 'open' || market.status === 'closed') ? <tr><td>Unrealised P&amp;L</td><td className="mono">{fmtCrowns(liquidationValue(market, pos) + pos.received - pos.spent)}</td></tr>
            : <tr><td>Realised P&amp;L</td><td className="mono" data-testid="arena-realised">{fmtCrowns(pos.received - pos.spent)}</td></tr>}
          <tr><td>Maximum loss</td><td className="mono">{fmtCrowns(Math.max(0, pos.spent - pos.received))}</td></tr>
        </tbody></table>
      ) : <p className="small muted" style={{ margin: 0 }}>No position in this match.</p>}
      <div className="small">Cash {fmtCrowns(fin.cash)} · open positions {fmtCrowns(fin.positions)} · net worth {fmtCrowns(fin.netWorth)} · realised trading {fmtCrowns(fin.realized)}</div>
      <div className="small muted">Fictional crowns only. Official markets never list your own games; sandbox money is separate.</div>
    </div>
  );

  const controls = (
    <div className="panel stack">
      {inPlay && (
        <div className="row" style={{ flexWrap: 'wrap' }} data-testid="inplay">
          <strong className="small">In-play</strong>
          <span className={`chip ${running ? 'neg' : 'pos'}`}>{running ? 'auto-advancing' : 'trading open — paused'}</span>
          <span className="spacer" />
          <button className="btn small" data-testid="next-move" onClick={() => { setRunning(false); void step(); }}>Next move</button>
          <button className="btn small" data-testid="auto-run" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Auto'}</button>
          <div className="seg" role="group" aria-label="Window length">{WINDOWS.map((x, i) => <button key={x.label} aria-pressed={windowIdx === i} onClick={() => setWindowIdx(i)}>{x.label}</button>)}</div>
        </div>
      )}
      {!inPlay && (isLive || game) && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn small" data-testid="replay-pause" onClick={() => setPaused(x => !x)} disabled={revealed >= moves.length && generationDone}>{paused ? 'Resume' : 'Pause'}</button>
          <div className="seg" role="group" aria-label="Speed">{SPEEDS.map((s, i) => <button key={s.label} aria-pressed={speed === i} onClick={() => setSpeed(i)}>{s.label}</button>)}</div>
          <span className="small muted">{isLive ? `Engine has played ${moves.length} plies; showing ${revealed}.` : `${moves.length} plies recorded${game ? ` · ${game.termination.replace(/-/g, ' ')}` : ''}.`}</span>
        </div>
      )}
      {finalShown && <div className="notice" data-testid="final-result"><strong>Final: {finalShown}</strong> · {game!.termination.replace(/-/g, ' ')}</div>}
      {fixture.result === null && !isLive && !game && (
        <div className="stack">
          <p className="small" style={{ margin: 0 }}>Not played yet. Nothing about the result exists: when it starts, each move is computed by the engine only after the previous trading window closes.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {market?.status === 'open' && <button className="btn primary" data-testid="start-inplay" disabled={services.readOnly} onClick={startInPlay}>Watch live with in-play trading</button>}
            <button className={`btn ${market?.status === 'open' ? '' : 'primary'}`} data-testid="start-live" disabled={services.readOnly} onClick={start}>{market?.status === 'open' ? 'Watch without trading (closes market)' : 'Start live'}</button>
          </div>
        </div>
      )}
      {fixture.result !== null && !game && <div className="small">Decided as a summary result — no move record exists, so there is nothing to replay.</div>}
    </div>
  );

  return (
    <div className="arena" data-testid="arena">
      <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Live Arena · {eventName(fixture.event)}{fixture.stage ? ` · ${fixture.stage}` : ''} · S{fixture.season} R{fixture.round}</h1>
        <span className={`chip ${status.startsWith('LIVE') ? 'neg' : status.startsWith('REPLAY') ? 'info' : ''}`} data-testid="spectator-status">{status}</span>
        {postAllowed && !postReady && <span className="chip">analysis {services.progress?.gameId === `wg:${fixtureId}` ? `${services.progress.done}/${services.progress.total}` : 'queued'}</span>}
      </div>
      {err && <div className="notice warn" role="alert">{err}</div>}
      <div className="arena-grid">
        <div className="stack arena-board">
          <PlayerCard id={orientation === 'white' ? fixture.black : fixture.white} side={orientation === 'white' ? 1 : 0} />
          <Board fen={fen} orientation={orientation} lastMove={last} label={`${w?.name} versus ${b?.name}, ply ${ply}`} />
          <PlayerCard id={orientation === 'white' ? fixture.white : fixture.black} side={orientation === 'white' ? 0 : 1} />
          <div className="row" role="group" aria-label="Move navigation">
            <button className="btn small" aria-label="First move" onClick={() => nav(0)}><Icon name="first" /></button>
            <button className="btn small" aria-label="Previous move" onClick={() => nav(ply - 1)}><Icon name="prev" /></button>
            <button className="btn small" aria-label="Next move" onClick={() => nav(ply + 1)}><Icon name="next" /></button>
            <button className="btn small" aria-label="Latest move" onClick={() => { setFollow(true); setPly(revealed); }}><Icon name="last" /></button>
            <button className="btn small" aria-label="Flip board" onClick={() => setOrientation(o => (o === 'white' ? 'black' : 'white'))}><Icon name="flip" /></button>
          </div>
          {controls}
        </div>
        <div className="seg arena-tabs" role="tablist" aria-label="Arena panels">
          {(['analysis', 'market', 'portfolio'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{{ analysis: 'Moves & eval', market: 'Market', portfolio: 'Portfolio' }[t]}</button>)}
        </div>
        <div className={`stack arena-col arena-tab-${tab === 'analysis' ? 'on' : 'off'}`}>{analysisPanel}</div>
        <div className={`stack arena-col arena-tab-${tab === 'analysis' ? 'off' : 'on'}`}>
          <div className={tab === 'market' ? 'arena-m-on' : 'arena-m-off'}>{marketPanel}</div>
          <div className={tab === 'portfolio' ? 'arena-m-on' : 'arena-m-off'}>{portfolioPanel}</div>
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>Engine {ENGINE_BUILD} · grading {GRADING_ID}{report && !postReady ? ' · a post-game report exists and is shown after settlement' : ''}.</div>
    </div>
  );
}
