/**
 * Replay & Analysis Center tools shared by the Arena replay (SpectatorScreen) and Game Review (AnalysisScreen):
 * turning points, match events, Grimoire lesson links and the branching sandbox.
 *
 * The sandbox is analysis only: screens offer it for finished games (and, in the Arena, only once the market can
 * no longer trade). It keeps its own line (src/app/replay.ts) and never writes the saved game; positions can be
 * saved as bookmarks.
 */
import { useEffect, useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { formatEval } from './MatchCenter';
import type { EngineScore } from '../analysis/types';
import type { AssistCandidate } from '../engine/protocol';
import { CancelledError } from '../engine/client';
import { indexChapters } from '../academy/grimoire';
import { createSandbox, lessonsFor, sandboxFen, sandboxHistory, sandboxLegal, sandboxMove, sandboxUndo, type MatchEvent, type ReplayBookmark, type Sandbox, type TurningPoint } from '../app/replay';

const CHAPTERS = new Map(indexChapters().map(c => [c.id, c]));
const KNOWN = new Set(CHAPTERS.keys());

/** Links to the Grimoire chapters for the given topics (only chapters that exist). */
export function LessonLinks({ topics, title = 'Lessons for This Game' }: { topics: string[]; title?: string }) {
  const { go } = useApp();
  const ids = lessonsFor(topics, KNOWN).slice(0, 5);
  if (!ids.length) return null;
  return (
    <div className="stack mc-lessons" data-testid="lesson-links">
      <h4 style={{ margin: 0 }}>{title}</h4>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {ids.map(id => <button key={id} className="btn small ghost mc-lesson" data-chapter={id} onClick={() => go({ name: 'grimoire', path: id })}>{CHAPTERS.get(id)!.title.replace(/^Chapter [IVX0-9.]+ — /, '')}</button>)}
      </div>
    </div>
  );
}

export function TurningPointList({ points, onSelect, current, source }: { points: TurningPoint[]; onSelect: (ply: number) => void; current: number; source: string }) {
  return (
    <div className="stack" data-testid="turning-points">
      <div className="panel-title"><h4 style={{ margin: 0 }}>Turning Points</h4><span className="small muted">{source}</span></div>
      {points.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No swing of 10 percentage points or more in White's expected score.</p> : (
        <div className="stack" style={{ gap: 4 }}>
          {points.map(t => (
            <button key={t.ply} className={`cand mc-turn${current === t.ply ? ' on' : ''}`} data-testid="turning-point" data-ply={t.ply} onClick={() => onSelect(t.ply)}>
              <strong>Move {Math.ceil(t.ply / 2)}{t.ply % 2 ? '' : '…'}</strong>
              <span className="line">toward {t.favours === 'white' ? 'White' : 'Black'}</span>
              <span className="mono">{Math.round(t.before * 100)}% → {Math.round(t.after * 100)}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EVENT_ICON: Record<MatchEvent['kind'], string> = { start: '▶', capture: '×', check: '+', promotion: '♛', swing: '↕', price: '$', trade: '⇄', end: '■', settlement: '✓' };

export function MatchEventList({ events, onSelect, current }: { events: MatchEvent[]; onSelect: (ply: number) => void; current: number }) {
  const [all, setAll] = useState(false);
  // most interesting first when collapsed: everything except plain captures and checks
  const shown = all ? events : events.filter(e => !['capture', 'check'].includes(e.kind) || e.text.includes('checkmate'));
  return (
    <div className="stack" data-testid="match-events">
      <div className="panel-title"><h4 style={{ margin: 0 }}>Match Events</h4>
        <button className="btn ghost small" aria-pressed={all} onClick={() => setAll(x => !x)}>{all ? 'Key Events Only' : `All Events (${events.length})`}</button></div>
      <ol className="mc-events">
        {shown.map((e, i) => (
          <li key={i} className={`mc-event kind-${e.kind}${e.ply === current ? ' on' : ''}${e.ply > current ? ' future' : ''}`}>
            <button className="mc-event-btn" onClick={() => onSelect(e.ply)} data-testid="match-event" data-kind={e.kind} data-ply={e.ply}>
              <span className="mc-event-icon" aria-hidden>{EVENT_ICON[e.kind]}</span>
              <span className="mc-event-ply mono">{e.ply === 0 ? 'Start' : `${Math.ceil(e.ply / 2)}${e.ply % 2 ? '.' : '…'}`}</span>
              <span className="mc-event-text">{e.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export interface SandboxEval { key: string; score: EngineScore | null; best: AssistCandidate | null; depth: number; noMoves: boolean; error?: string }

/**
 * Branching sandbox state with engine help (the Assistant engine channel, depth 6, on the sandbox position only).
 * `mainline` is copied when the sandbox starts; nothing is written back.
 */
export function useSandbox({ initialFen, setupMoves, mainline }: { initialFen: string; setupMoves?: string[]; mainline: readonly string[] }) {
  const services = useServices();
  const [sb, setSb] = useState<Sandbox | null>(null);
  const [ev, setEv] = useState<SandboxEval | null>(null);
  const [busy, setBusy] = useState(false);
  const key = sb ? sandboxHistory(sb).join(' ') : '';
  const legal = useMemo(() => (sb ? sandboxLegal(sb) : []), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sb) { setEv(null); return; }
    if (!legal.length) { setEv({ key, score: null, best: null, depth: 0, noMoves: true }); return; }
    let live = true;
    setBusy(true);
    // the sandbox's base moves already include the setup moves
    services.assist.assist({ initialFen, moves: sandboxHistory(sb), depth: 6 })
      .then(r => { if (live) setEv({ key, score: r.candidates[0]?.score ?? null, best: r.candidates[0] ?? null, depth: r.depth, noMoves: false }); })
      .catch(e => { if (live && !(e instanceof CancelledError)) setEv({ key, score: null, best: null, depth: 0, noMoves: false, error: String((e as Error)?.message ?? e) }); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    sandbox: sb,
    fen: sb ? sandboxFen(sb) : null,
    legal,
    eval: ev && ev.key === key ? ev : null,
    busy,
    start: (origin: number) => setSb(createSandbox(initialFen, [...(setupMoves ?? []), ...mainline], (setupMoves?.length ?? 0) + origin)),
    /** Reopen a saved line (a saved position bookmark). Illegal moves (never expected) end the replayed line. */
    load: (origin: number, line: readonly string[]) => {
      let s = createSandbox(initialFen, [...(setupMoves ?? []), ...mainline], (setupMoves?.length ?? 0) + origin);
      for (const c of line) { const n = sandboxMove(s, c); if (!n) break; s = n; }
      setSb(s);
    },
    play: (ccn: string) => setSb(s => (s ? sandboxMove(s, ccn) ?? s : s)),
    undo: () => setSb(s => (s ? sandboxUndo(s) : s)),
    exit: () => setSb(null),
  };
}

/** Controls and engine help for an open sandbox. `gameId` names the saved game the position bookmark belongs to. */
export function SandboxPanel({ sb, gameId, originPly, onExit }: { sb: ReturnType<typeof useSandbox>; gameId: string; originPly: number; onExit: () => void }) {
  const services = useServices();
  const [saved, setSaved] = useState<string | null>(null);
  if (!sb.sandbox) return null;
  const s = sb.sandbox;
  const save = async () => {
    const id = `pos:${gameId}:${originPly}:${s.line.join('-') || 'start'}`;
    const rec: ReplayBookmark = { id, gameId, ply: originPly, memorable: false, note: s.sans.length ? `Sandbox line ${s.sans.join(' ')}` : 'Sandbox position', at: new Date().toISOString(), kind: 'position', fen: sb.fen ?? undefined, line: [...s.line], sans: [...s.sans] };
    await services.db.put('bookmarks', rec);
    setSaved(`Position saved (${s.sans.length ? s.sans.join(' ') : 'start of the line'}).`);
    services.notify();
  };
  const e = sb.eval;
  return (
    <div className="notice mc-sandbox stack" data-testid="sandbox" role="region" aria-label="Sandbox">
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <strong>Sandbox from move {Math.ceil(originPly / 2)}{originPly % 2 ? '' : originPly ? '…' : ''}{originPly === 0 ? ' (start)' : ''}</strong>
        <span className="chip">Not saved to the game</span>
      </div>
      <div className="small">Play any legal move on the board. The saved game and its analysis never change.</div>
      <div className="mono small" data-testid="sandbox-line">{s.sans.length ? s.sans.map((x, i) => <span key={i}>{x} </span>) : <span className="muted">No sandbox moves yet.</span>}</div>
      <div className="small" data-testid="sandbox-eval" aria-live="polite">
        {sb.busy ? 'Engine thinking…' : e?.noMoves ? 'No legal moves: the line has ended.' : e?.best ? <>Engine (depth {e.depth}): <strong className="mono">{formatEval(e.score)}</strong> · best {e.best.san}{e.best.pvSan.length > 1 ? <span className="muted"> ({e.best.pvSan.slice(1, 6).join(' ')})</span> : null}</> : e?.error ? `The engine isn't available right now (${e.error}).` : 'No evaluation.'}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button className="btn small" disabled={!s.line.length} onClick={sb.undo} data-testid="sandbox-undo">Take Back</button>
        <button className="btn small" disabled={!e?.best} onClick={() => e?.best && sb.play(e.best.ccn)} data-testid="sandbox-engine">Play Engine Move</button>
        <button className="btn small" onClick={() => void save()} data-testid="sandbox-save" disabled={services.readOnly}>Save Position</button>
        <button className="btn small primary" onClick={onExit} data-testid="sandbox-exit">Return to Game</button>
      </div>
      {saved && <div className="small" role="status">{saved}</div>}
    </div>
  );
}
