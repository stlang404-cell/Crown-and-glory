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
import { TradeTicket, PriceChart, statusLabel } from './ExchangeScreen';
import './arena.css';
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
      aria-label={`White's expected score over ${shown} moves${post ? ': live evaluation and Match Analysis' : ': live engine evaluation'}. A table version follows.`}
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
  if (!fixture) return <div className="panel"><p>This match doesn't exist.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
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
  // status text: the LIVE / REPLAY prefixes are part of the contract with the journeys
  const status = game ? (game.mode === 'watched-live' && startedHere.current && revealed < moves.length ? 'LIVE · Revealing Moves' : 'REPLAY · Recorded Game') : inPlay ? 'LIVE · In-Play Trading' : isLive ? 'LIVE · Being Played' : fixture.result === null ? 'Not Started' : 'Summary Result';
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
  const shownMoves = moves.slice(0, revealed);
  // change of each claim price between the two latest published points (display only, from lg.points)
  const pts = lg?.points ?? [];
  const priceDelta = pts.length >= 2 ? pts[pts.length - 1].prices.map((x, i) => x - (pts[pts.length - 2].prices[i] ?? x)) : null;
  const fmtSigned = (v: number) => `${v > 0 ? '+' : ''}${fmtCrowns(v)}`;

  const PlayerCard = ({ id, side }: { id: string; side: 0 | 1 }) => {
    const c = st.competitors.get(id);
    if (!c) return null;
    const club = clubOf(c.id, c.region);
    const active = sideToMove === side && isLive && ply === revealed;
    return (
      <div className={`row small arena-player ${active ? 'is-active' : ''}`} data-testid={`arena-player-${side ? 'black' : 'white'}`}>
        <span className={`arena-pip ${side ? 'black' : 'white'}`} aria-hidden />
        <Portrait seed={c.portraitSeed} size={34} crown={c.titles.some(t => /Crown Champion/.test(t.title))} />
        <span className="arena-player-id">
          <button className="btn ghost small arena-player-name" onClick={() => go({ name: 'competitor', id: c.id })}><strong>{c.name}</strong></button>
          <span className="muted arena-player-meta">
            <span className="mono">{Math.round(c.rating)} ±{Math.round(c.rd)}</span>
            <Emblem spec={divisionEmblem(c.division)} size="sm" title={divisionLabel(c.division)} /><Emblem spec={clubEmblem(club.identity)} size="sm" title={club.identity.name} />
            {c.fedTitle && <Emblem spec={titleEmblem(c.fedTitle)} size="sm" title={`Federation Title: ${c.fedTitle}`} />}
            <span>{isValidatedStyle(c.style) ? STYLE_LABEL[c.style] : 'Universal'} · {side ? 'Black' : 'White'}</span>
          </span>
        </span>
        <span className="spacer" />
        <span className={`chip mono arena-think ${active ? 'gold' : ''}`} title="Engine thinking time used. Featured games have no game clock." data-testid={`think-${side ? 'black' : 'white'}`}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden focusable="false"><circle cx="8" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 5.5V9l2.2 1.6M6.5 1.5h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          {fmtT(think[side])}
        </span>
      </div>
    );
  };

  const policy = (
    <div className="small muted arena-policy" data-testid="arena-policy">
      <p style={{ margin: 0 }}>{marketTradable ? <>You see what every trader sees: published moves and the engine’s own evaluation. Move grades stay hidden until the market is settled.</>
        : postReady ? <>Match Analysis ran after the market settled.</>
          : postAllowed ? <>Match Analysis is queued; move grades appear when it’s done.</> : <>Published moves and evaluations only.</>}</p>
      <details className="small"><summary>Details</summary>
        <ul className="arena-policy-list">
          <li>Live information: published moves, public profiles and thinking time.</li>
          <li>The moving engine’s own evaluation of the move just played is published to you and every computer trader at the same moment; the live forecast uses it.</li>
          <li>Deeper analysis is never shown, or even computed, while the market can trade.</li>
          <li>Match Analysis (move grades and the dashed curve) runs only after the market is settled or cancelled. Future moves don’t exist while you can trade: each move is computed after the previous trading window.</li>
        </ul>
        <div className="mono">Engine {ENGINE_BUILD} · grading {GRADING_ID}{postReady ? ` · this analysis: ${report!.engine.buildId} (${report!.methodology.gradingId}), computed after settlement` : ''}{report && !postReady ? ' · a Match Analysis report exists and is shown after settlement' : ''}</div>
      </details>
    </div>
  );

  const moveButton = (m: SelfplayMove, i: number) => {
    const g = postReady ? report!.plies[i]?.grade ?? null : undefined;
    const on = i + 1 === ply;
    return (
      <button key={i} className={`arena-mv ${on ? 'on' : ''}`} aria-current={on ? 'step' : undefined} onClick={() => nav(i + 1)} data-testid="arena-move"
        aria-label={`${Math.floor(i / 2) + 1}. ${i % 2 ? 'Black' : 'White'} ${m.san}${g ? `, ${GRADE_LABEL[g]}` : g === null ? ', not graded' : ''}`}>
        <span className="arena-mv-san">{m.san}</span>{g !== undefined && <GradeIcon grade={g} />}
      </button>
    );
  };

  const analysisPanel = (
    <div className="panel stack" data-testid="arena-analysis">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Moves &amp; Evaluation</h3><span className="small muted mono">Move {ply} of {revealed}</span></div>
      <EvalGraph moves={moves} shown={revealed} post={postCurve} onSelect={nav} ply={ply} />
      <div className="legend small" aria-hidden>
        <span><i style={{ background: 'var(--accent)' }} />Live evaluation (White's expected score)</span>
        {postCurve && <span><i style={{ background: '#6aa7ff' }} />Match Analysis</span>}
      </div>
      {cur && <div className="small mono arena-current" data-testid="arena-current" title={`Search depth ${cur.depth} · ${cur.nodes.toLocaleString('en')} nodes`}>{Math.ceil(ply / 2)}{ply % 2 ? '.' : '…'} {cur.san} · Eval {formatScore(cur.score)}{curPost ? ` · ${curPost.grade ? GRADE_LABEL[curPost.grade] : 'Not graded'}` : ''}</div>}
      <div className="small arena-moves" data-testid="arena-moves">
        {shownMoves.length === 0 ? <p className="muted" style={{ margin: 0 }}>Moves appear here as they are played.</p> : (
          <>
            <div className="arena-move-row arena-move-head" aria-hidden><span /><span>White</span><span>Black</span></div>
            {Array.from({ length: Math.ceil(shownMoves.length / 2) }, (_, r) => (
              <div key={r} className="arena-move-row">
                <span className="arena-mv-no mono" aria-hidden>{r + 1}.</span>
                {moveButton(shownMoves[2 * r], 2 * r)}
                {2 * r + 1 < shownMoves.length ? moveButton(shownMoves[2 * r + 1], 2 * r + 1) : <span />}
              </div>
            ))}
          </>
        )}
      </div>
      {postReady && (
        <div className="small" data-testid="arena-grade-summary">{(['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as const).map(gr => { const nW = report!.plies.filter((p, i) => i % 2 === 0 && p.grade === gr).length, nB = report!.plies.filter((p, i) => i % 2 === 1 && p.grade === gr).length; return nW + nB ? <span key={gr} className="chip" style={{ marginRight: 4 }}><GradeIcon grade={gr} /> {GRADE_LABEL[gr]} {nW}/{nB}</span> : null; })} <span className="muted">(White/Black)</span></div>
      )}
      <details className="small"><summary>Evaluation Table</summary>
        <table className="small"><thead><tr><th>#</th><th>Move</th><th>Live Eval</th><th>Match Analysis</th></tr></thead>
          <tbody>{shownMoves.map((m, i) => <tr key={i}><td>{i + 1}</td><td>{m.san}</td><td className="mono">{formatScore(m.score)}</td><td>{postReady ? `${report!.plies[i]?.grade ? GRADE_LABEL[report!.plies[i].grade!] : '—'} · ${(postCurve![i] * 100).toFixed(0)}%` : 'After settlement'}</td></tr>)}</tbody></table>
      </details>
      {policy}
    </div>
  );

  const claims = market ? claimsOf(market) : [];
  const marketPanel = market ? (
    <div className="panel stack" data-testid="arena-market" data-revision={revisionOf(market)}>
      <div className="panel-title"><h3 style={{ margin: 0 }}>Live Odds</h3><span className={`chip ${market.status === 'open' ? 'pos' : market.status === 'settled' ? 'info' : ''}`}>{statusLabel(market.status)}{market.status === 'settled' && allRevealed ? ` · ${OUTCOMES[market.result!]}` : ''}</span></div>
      <div className="arena-odds">
        {claimPrices(market).map((x, i) => {
          const d = priceDelta?.[i];
          const dir = d === undefined ? '' : d > 0.0005 ? 'up' : d < -0.0005 ? 'down' : 'flat';
          return (
            <div key={i} className="arena-odd">
              <span className="arena-odd-label">{claims[i]?.label}</span>
              <span className="arena-odd-price mono" data-testid={`live-price-${i}`}>{(x * 100).toFixed(1)}¢</span>
              {d !== undefined && (
                <span className={`arena-odd-chg mono ${dir}`}>
                  <span aria-hidden>{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '='} </span>{dir === 'flat' ? '0.0¢' : `${d > 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)}¢`}<span className="sr-only"> since the previous move</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <table className="small arena-forecast"><thead><tr><th>Forecast</th>{claims.map(c => <th key={c.label}>{c.label}</th>)}</tr></thead><tbody>
        {inPlay && lg!.points.length > 0 && <tr><td>Live</td>{lg!.points[lg!.points.length - 1].model.map((x, i) => <td key={i} className="mono">{(x * 100).toFixed(1)}%</td>)}</tr>}
        <tr><td>Pre-match</td>{[market.forecast.w, market.forecast.d, market.forecast.l].map((x, i) => <td key={i} className="mono">{(x * 100).toFixed(0)}%</td>)}</tr>
      </tbody></table>
      <PriceChart m={market} points={lg?.points} />
      <div className="small muted">Prices move only when someone trades. The forecast is information, never the price.</div>
      <details className="small muted"><summary>Details</summary>
        Market revision <span className="mono" data-testid="arena-revision">{revisionOf(market)}</span> · {market.history.length} trades{lg ? ` · ${lg.points.length} published-move windows` : ''}. Prices come from the automated market maker (LMSR); the live forecast is updated from each published move and is never the price.
      </details>
      <details className="small"><summary>Price History Table</summary>
        <table className="small"><thead><tr><th>Move</th><th>Revision</th><th>Prices (W/D/B)</th></tr></thead>
          <tbody>{(lg?.points ?? []).map((p, i) => <tr key={i}><td>{p.ply}</td><td className="mono">{p.revision ?? ''}</td><td className="mono">{p.prices.map(x => (x * 100).toFixed(1)).join(' / ')}</td></tr>)}</tbody></table>
      </details>
      {market.status === 'open' && (fixture.result === null || inPlay) && <TradeTicket m={market} compact />}
    </div>
  ) : <div className="panel small" data-testid="arena-market">There’s no official market on this match.</div>;

  const portfolioPanel = (
    <div className="panel stack" data-testid="arena-portfolio">
      <h3 style={{ margin: 0 }}>Your Position</h3>
      {market && pos ? (
        <>
          <div className="arena-pos">
            <div className="arena-pos-cell"><span className="k">Shares (W/D/B)</span><span className="v mono" data-testid="arena-shares">{pos.shares.join(' / ')}</span></div>
            {marketTradable
              ? <div className="arena-pos-cell"><span className="k">Profit/Loss Now</span><span className={`v mono ${liquidationValue(market, pos) + pos.received - pos.spent >= 0 ? 'pos' : 'neg'}`}>{fmtSigned(liquidationValue(market, pos) + pos.received - pos.spent)}</span></div>
              : <div className="arena-pos-cell"><span className="k">Final Profit/Loss</span><span className={`v mono ${pos.received - pos.spent >= 0 ? 'pos' : 'neg'}`} data-testid="arena-realised">{fmtCrowns(pos.received - pos.spent)}</span></div>}
          </div>
          <table className="small arena-pos-table"><tbody>
            <tr><td>Spent / received</td><td className="mono">{fmtCrowns(pos.spent)} / {fmtCrowns(pos.received)}</td></tr>
            {marketTradable && <tr><td>Value if sold now</td><td className="mono">{fmtCrowns(liquidationValue(market, pos))}</td></tr>}
            <tr><td>Maximum loss</td><td className="mono">{fmtCrowns(Math.max(0, pos.spent - pos.received))}</td></tr>
          </tbody></table>
        </>
      ) : <p className="small muted" style={{ margin: 0 }}>You have no position in this match.</p>}
      <div className="small arena-wallet"><span>Cash <strong className="mono">{fmtCrowns(fin.cash)}</strong></span><span>Open positions <strong className="mono">{fmtCrowns(fin.positions)}</strong></span><span>Net worth <strong className="mono">{fmtCrowns(fin.netWorth)}</strong></span><span>Trading profit <strong className="mono">{fmtCrowns(fin.realized)}</strong></span></div>
      <div className="small muted">Fictional crowns only. Official markets never list your own games, and sandbox money is separate.</div>
    </div>
  );

  const controls = (
    <div className="panel stack arena-controls">
      {inPlay && (
        <div className="row" style={{ flexWrap: 'wrap' }} data-testid="inplay">
          <strong className="small">In-Play</strong>
          <span className={`chip ${running ? 'neg' : 'pos'}`}>{running ? 'Auto-Advancing' : 'Trading Open · Paused'}</span>
          <span className="spacer" />
          <button className="btn small" data-testid="next-move" onClick={() => { setRunning(false); void step(); }}>Next Move</button>
          <button className="btn small" data-testid="auto-run" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Auto'}</button>
          <div className="seg" role="group" aria-label="Trading Window">{WINDOWS.map((x, i) => <button key={x.label} aria-pressed={windowIdx === i} onClick={() => setWindowIdx(i)}>{x.label}</button>)}</div>
        </div>
      )}
      {!inPlay && (isLive || game) && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn small" data-testid="replay-pause" onClick={() => setPaused(x => !x)} disabled={revealed >= moves.length && generationDone}>{paused ? 'Resume' : 'Pause'}</button>
          <div className="seg" role="group" aria-label="Speed">{SPEEDS.map((s, i) => <button key={s.label} aria-pressed={speed === i} onClick={() => setSpeed(i)}>{s.label}</button>)}</div>
          <span className="small muted">{isLive ? `The engine has played ${moves.length} moves; showing ${revealed}.` : `${moves.length} moves recorded${game ? ` · ${game.termination.replace(/-/g, ' ')}` : ''}.`}</span>
        </div>
      )}
      {finalShown && <div className="notice" data-testid="final-result"><strong>Final result: {finalShown}</strong> · {game!.termination.replace(/-/g, ' ')}</div>}
      {fixture.result === null && !isLive && !game && (
        <div className="stack">
          <p className="small" style={{ margin: 0 }}>Not played yet. Once it starts, each move is played only after the previous trading window closes.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {market?.status === 'open' && <button className="btn primary" data-testid="start-inplay" disabled={services.readOnly} onClick={startInPlay}>Watch Live and Trade</button>}
            <button className={`btn ${market?.status === 'open' ? '' : 'primary'}`} data-testid="start-live" disabled={services.readOnly} onClick={start}>{market?.status === 'open' ? 'Watch Without Trading (Closes Market)' : 'Start Live'}</button>
          </div>
        </div>
      )}
      {fixture.result !== null && !game && <div className="small">This match was decided without a recorded game, so there is nothing to replay.</div>}
    </div>
  );

  const ScoreSide = ({ c, side }: { c: typeof w; side: 0 | 1 }) => (
    <div className={`arena-sb-side ${side ? 'black' : 'white'}`}>
      <span className={`arena-pip ${side ? 'black' : 'white'}`} aria-hidden />
      <span className="arena-sb-name">{c?.name ?? '—'}</span>
      {c && <span className="arena-sb-rating mono">{Math.round(c.rating)}</span>}
    </div>
  );

  return (
    <div className="arena" data-testid="arena">
      <header className="arena-head">
        <div className="arena-head-top">
          <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
          <div className="arena-title">
            <span className="arena-kicker">Live Arena</span>
            <h1>{eventName(fixture.event)}{fixture.stage ? ` · ${fixture.stage}` : ''}</h1>
            <span className="small muted">Season {fixture.season} · Round {fixture.round}</span>
          </div>
          <span className="spacer" />
          <span className={`chip arena-status ${status.startsWith('LIVE') ? 'neg is-live' : status.startsWith('REPLAY') ? 'info' : ''}`} data-testid="spectator-status">{status}</span>
          {postAllowed && !postReady && <span className="chip">Match Analysis {services.progress?.gameId === `wg:${fixtureId}` ? `${services.progress.done}/${services.progress.total}` : 'Queued'}</span>}
        </div>
        <div className="arena-scoreboard" role="group" aria-label={`${w?.name ?? 'White'} (White) vs ${b?.name ?? 'Black'} (Black)${finalShown ? `, final result ${finalShown}` : ''}`}>
          <ScoreSide c={w} side={0} />
          <div className="arena-sb-mid mono" aria-hidden>{finalShown ?? 'vs'}</div>
          <ScoreSide c={b} side={1} />
        </div>
      </header>
      {err && <div className="notice warn" role="alert">{err}</div>}
      <div className="arena-grid">
        <div className="stack arena-board">
          <PlayerCard id={orientation === 'white' ? fixture.black : fixture.white} side={orientation === 'white' ? 1 : 0} />
          <Board fen={fen} orientation={orientation} lastMove={last} label={`${w?.name} vs ${b?.name}, after ${ply} moves`} />
          <PlayerCard id={orientation === 'white' ? fixture.white : fixture.black} side={orientation === 'white' ? 0 : 1} />
          <div className="row arena-nav" role="group" aria-label="Move Navigation">
            <button className="btn small" aria-label="First Move" onClick={() => nav(0)}><Icon name="first" /></button>
            <button className="btn small" aria-label="Previous Move" onClick={() => nav(ply - 1)}><Icon name="prev" /></button>
            <button className="btn small" aria-label="Next Move" onClick={() => nav(ply + 1)}><Icon name="next" /></button>
            <button className="btn small" aria-label="Latest Move" onClick={() => { setFollow(true); setPly(revealed); }}><Icon name="last" /></button>
            <button className="btn small" aria-label="Flip Board" onClick={() => setOrientation(o => (o === 'white' ? 'black' : 'white'))}><Icon name="flip" /></button>
          </div>
          {controls}
        </div>
        <div className="seg arena-tabs" role="tablist" aria-label="Arena Panels">
          {(['analysis', 'market', 'portfolio'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{{ analysis: 'Moves & Eval', market: 'Market', portfolio: 'Portfolio' }[t]}</button>)}
        </div>
        <div className={`stack arena-col arena-tab-${tab === 'analysis' ? 'on' : 'off'}`}>{analysisPanel}</div>
        <div className={`stack arena-col arena-tab-${tab === 'analysis' ? 'off' : 'on'}`}>
          <div className={tab === 'market' ? 'arena-m-on' : 'arena-m-off'}>{marketPanel}</div>
          <div className={tab === 'portfolio' ? 'arena-m-on' : 'arena-m-off'}>{portfolioPanel}</div>
        </div>
      </div>
    </div>
  );
}
