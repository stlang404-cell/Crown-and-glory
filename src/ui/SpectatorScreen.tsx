import { useEffect, useRef, useState } from 'react';
import { useApp, useServices } from './App';
import { Board } from './Board';
import { Icon } from './Icons';
import { whiteU, formatScore } from './Charts';
import { Portrait } from './Portrait';
import { eventName, WorldGame } from '../app/federation';
import type { SelfplayMove } from '../engine/selfplay';
import { prices } from '../exchange/lmsr';
import { OUTCOMES } from '../exchange/market';
import { STYLE_LABEL, isValidatedStyle } from '../engine/styles';

const START_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const SPEEDS = [{ label: 'Slow', ms: 2200 }, { label: 'Normal', ms: 1100 }, { label: 'Fast', ms: 450 }, { label: 'Instant', ms: 0 }];

/** Expected-score track for white, from the engine's own search scores (not a postgame analysis). */
function ScoreTrack({ moves, shown, onSelect }: { moves: SelfplayMove[]; shown: number; onSelect: (ply: number) => void }) {
  const W = 600, H = 90;
  const n = Math.max(moves.length, 20);
  const pts = moves.slice(0, shown).map((m, i) => [((i + 1) / n) * W, H - whiteU(m.score) * H] as const);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Engine expected score for White, move by move" style={{ background: 'rgba(255,255,255,.02)', borderRadius: 8, cursor: 'pointer' }}
      onClick={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); onSelect(Math.max(0, Math.min(shown, Math.round(((e.clientX - r.left) / r.width) * n)))); }}>
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--line)" />
      {pts.length > 1 && <polyline points={`0,${H / 2} ${pts.map(p => p.join(',')).join(' ')}`} fill="none" stroke="var(--accent)" strokeWidth={2} />}
    </svg>
  );
}

export function SpectatorScreen({ fixtureId }: { fixtureId: string }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [game, setGame] = useState<WorldGame | null>(null);
    const [err, setErr] = useState<string | null>(null);
  const [follow, setFollow] = useState(true); // follow the newest revealed move
  const [ply, setPly] = useState(0);
  const [revealed, setRevealed] = useState(0); // live: moves revealed so far (≤ moves generated)
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const startedHere = useRef(false);

  useEffect(() => {
    let live = true;
    fed.worldGame(`wg:${fixtureId}`).then(g => { if (!live) return; setGame(g ?? null); if (g && !startedHere.current) { setRevealed(g.moves.length); setPly(0); setFollow(false); } });
    return () => { live = false; };
  }, [fixtureId, services.revision]);

  const st = fed.state;
  const fixture = st ? [...st.rounds.values()].flatMap(r => r.fixtures).find(f => f.id === fixtureId) : undefined;
  const liveMoves = fed.live.get(fixtureId);
  const isLive = fed.isLive(fixtureId);
  const moves: SelfplayMove[] = game?.moves ?? liveMoves ?? [];
  const generationDone = !!game;
  if (isLive) startedHere.current = true; // watching a game in progress: keep the live reveal pacing
  const [seenEnd, setSeenEnd] = useState(false);
  useEffect(() => { if (generationDone && ply === moves.length && revealed === moves.length) setSeenEnd(true); }, [generationDone, ply, revealed, moves.length]);
  const market = fed.marketFor(fixtureId);
  // live reveal pacing: one move per tick from the generated buffer (the game is generated now, by the engine)
  useEffect(() => {
    if (paused || revealed >= moves.length) return;
    const ms = SPEEDS[speed].ms;
    const t = setTimeout(() => setRevealed(r => (ms === 0 ? moves.length : r + 1)), ms);
    return () => clearTimeout(t);
  }, [paused, revealed, moves.length, speed]);
  useEffect(() => { if (follow) setPly(revealed); }, [revealed, follow]);

  if (!st) return <div className="panel"><p>Found the federation first.</p></div>;
  if (!fixture) return <div className="panel"><p>Unknown match.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  const w = st.competitors.get(fixture.white), b = st.competitors.get(fixture.black);
  const start = async () => {
    setErr(null); startedHere.current = true; setRevealed(0); setFollow(true);
    try { await fed.playFeatured(fixtureId, 'watched-live'); } catch (e) { setErr((e as Error).message); }
  };
  const fen = ply === 0 ? (game?.initialFen ?? START_FEN) : moves[ply - 1]?.fen ?? START_FEN;
  const last = ply > 0 ? moves[ply - 1]?.ccn : null;
  const status = game ? (game.mode === 'watched-live' && startedHere.current && revealed < moves.length ? 'LIVE · reveal in progress' : 'REPLAY · recorded game') : isLive ? 'LIVE · being played now' : fixture.result === null ? 'NOT STARTED' : 'SUMMARY RESULT';
  const allRevealed = generationDone && revealed >= moves.length && seenEnd;
  const finalShown = allRevealed ? game!.result : null;
  const p = market ? prices(market.q, market.b) : null;
  const nav = (to: number) => { setFollow(to >= revealed); setPly(Math.max(0, Math.min(revealed, to))); };
  const style = (s: typeof w) => (s ? (isValidatedStyle(s.style) ? STYLE_LABEL[s.style] : 'Universal') : '');

  return (
    <div>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{eventName(fixture.event)}{fixture.stage ? ` · ${fixture.stage}` : ''} · S{fixture.season} R{fixture.round}</h1>
        <span className={`chip ${status.startsWith('LIVE') ? 'neg' : status.startsWith('REPLAY') ? 'info' : ''}`} data-testid="spectator-status">{status}</span>
      </div>
      {err && <div className="notice warn" role="alert">{err}</div>}
      <div className="play-layout">
        <div className="stack">
          {[orientation === 'white' ? b : w].map(c => c && <div key={c.id} className="row small"><Portrait seed={c.portraitSeed} size={28} /><strong>{c.name}</strong> <span className="muted">{Math.round(c.rating)} · {style(c)}</span></div>)}
          <Board fen={fen} orientation={orientation} lastMove={last} label={`${w?.name} versus ${b?.name}`} />
          {[orientation === 'white' ? w : b].map(c => c && <div key={c.id} className="row small"><Portrait seed={c.portraitSeed} size={28} /><strong>{c.name}</strong> <span className="muted">{Math.round(c.rating)} · {style(c)}</span></div>)}
          <div className="row" role="group" aria-label="Move navigation">
            <button className="btn small" aria-label="First move" onClick={() => nav(0)}><Icon name="first" /></button>
            <button className="btn small" aria-label="Previous move" onClick={() => nav(ply - 1)}><Icon name="prev" /></button>
            <button className="btn small" aria-label="Next move" onClick={() => nav(ply + 1)}><Icon name="next" /></button>
            <button className="btn small" aria-label="Latest move" onClick={() => { setFollow(true); setPly(revealed); }}><Icon name="last" /></button>
            <button className="btn small" aria-label="Flip board" onClick={() => setOrientation(o => (o === 'white' ? 'black' : 'white'))}><Icon name="flip" /></button>
            <span className="small muted mono">ply {ply}/{revealed}</span>
          </div>
        </div>
        <div className="stack">
          {fixture.result === null && !isLive && !game && (
            <div className="panel stack">
              <h3>Featured match</h3>
              <p className="small">This match has not been played. When you start it, its Crown Exchange market closes first (no trades after that), then the engine plays it move by move with each competitor's strength profile. Nothing about the result exists before then.</p>
              {market && p && <div className="small mono">Market now: {OUTCOMES.map((o, i) => `${o} ${(p[i] * 100).toFixed(0)}%`).join(' · ')}</div>}
              <div className="row">
                <button className="btn primary" data-testid="start-live" disabled={services.readOnly} onClick={start}>Start live (closes market)</button>
                {market?.status === 'open' && <button className="btn" onClick={() => go({ name: 'exchange', id: market.id })}>Trade first</button>}
              </div>
            </div>
          )}
          {fixture.result !== null && !game && <div className="panel small">This result was decided as a summary result (no move record exists, so there is nothing to replay).</div>}
          {(isLive || game) && (
            <div className="panel stack">
              <div className="row">
                <button className="btn small" onClick={() => setPaused(x => !x)} disabled={revealed >= moves.length && generationDone}>{paused ? 'Resume' : 'Pause'}</button>
                <div className="seg" role="group" aria-label="Speed">{SPEEDS.map((s, i) => <button key={s.label} aria-pressed={speed === i} onClick={() => setSpeed(i)}>{s.label}</button>)}</div>
              </div>
              <div className="small muted">{isLive ? `Engine has played ${moves.length} plies; showing ${revealed}.` : `${moves.length} plies recorded.`} {game && `Termination: ${game.termination.replace(/-/g, ' ')}.`}</div>
              <ScoreTrack moves={moves} shown={revealed} onSelect={nav} />
              <div className="small muted">Line: the engine's own expected score for White from its search at each move (not a postgame analysis).</div>
              {ply > 0 && moves[ply - 1] && <div className="small mono">{moves[ply - 1].san} · eval {formatScore(moves[ply - 1].score)} · depth {moves[ply - 1].depth} · {moves[ply - 1].nodes.toLocaleString('en')} nodes</div>}
              <div className="small" style={{ maxHeight: 160, overflow: 'auto', lineHeight: 1.8 }}>
                {moves.slice(0, revealed).map((m, i) => <button key={i} className="btn ghost small" style={{ padding: '0 4px', minHeight: 0, fontWeight: i + 1 === ply ? 700 : 400 }} onClick={() => nav(i + 1)}>{i % 2 === 0 ? `${i / 2 + 1}.` : ''}{m.san}</button>)}
              </div>
              {finalShown && <div className="notice" data-testid="final-result"><strong>Final: {finalShown}</strong> · {game!.termination.replace(/-/g, ' ')}</div>}
            </div>
          )}
          {market && (
            <div className="panel small">
              <strong>Crown Exchange</strong> · market {market.status}
              {market.status === 'settled' && allRevealed && <> · settled on <strong>{OUTCOMES[market.result!]}</strong></>}
              {market.status === 'settled' && !allRevealed && <> · result hidden until the replay reaches the end</>}
              {market.status === 'open' && <> · trading open</>}
              {market.status === 'closed' && <> · trading closed, awaiting the result</>}
              <div className="muted">Model forecast (public ratings): W {(market.forecast.w * 100).toFixed(0)}% · D {(market.forecast.d * 100).toFixed(0)}% · B {(market.forecast.l * 100).toFixed(0)}%</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
