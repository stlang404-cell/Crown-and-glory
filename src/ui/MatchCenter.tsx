/**
 * Match Center: the shared layout and controls for the three ways of looking at a game — playing it (MatchScreen),
 * spectating a federation game (SpectatorScreen, the Live Arena) and reviewing a finished one (AnalysisScreen).
 *
 *  - MatchHeader: back link, event name, status chips and the scoreboard strip (players, ratings, result).
 *  - PlayerBar / Clock / Captured: the compact player cards above and below the board (clock or thinking time).
 *  - MoveNav: first / previous / next / last, flip, and in replay mode play/pause plus a speed control.
 *  - NotationList: the two-column move list.
 *  - MatchLayout: board left (top on phones), side panels right; at ≤ 700 px the panels become tabs under the board.
 *
 * Presentation only. These components render exactly what the screen passes in: a move gets a grade icon only when
 * the caller supplies a grade for it, and nothing here reads engine evaluations, markets or analysis reports. Each
 * screen keeps its own information policy (no grades in the Arena before settlement, no engine help in rated play).
 */
import { KeyboardEvent, ReactNode, useEffect, useId, useRef } from 'react';
import { Icon } from './Icons';
import { capturedFrom } from './Board';
import { PieceSvg, PieceKind, PIECE_NAMES } from './Pieces';
import type { Grade } from '../analysis/types';
import './match-center.css';

/* ---------- grade icons (shared by the notation list, the analysis panels and the Arena) ---------- */

export const GRADE_LABEL: Record<Grade, string> = {
  brilliant: 'Brilliant', great: 'Great', best: 'Best', excellent: 'Excellent', good: 'Good', inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder',
};
const GRADE_SYMBOL: Record<Grade, string> = { brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '·', inaccuracy: '?!', mistake: '?', blunder: '??' };

export function GradeIcon({ grade, provisional }: { grade: Grade | null; provisional?: boolean }) {
  if (!grade) return <span className="grade-icon grade-none" title="Not graded">–</span>;
  return <span className={`grade-icon grade-${grade}`} title={`${GRADE_LABEL[grade]}${provisional ? ' (provisional)' : ''}`} aria-label={GRADE_LABEL[grade]}>{GRADE_SYMBOL[grade]}</span>;
}

/* ---------- header and scoreboard ---------- */

export interface ScoreSide { name: string; rating?: string | null }

export function MatchHeader({ back, kicker, title, subtitle, status, actions, white, black, result }: {
  back?: { label: string; onClick: () => void };
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Status chips (live / replay / your move …), shown next to the title. */
  status?: ReactNode;
  actions?: ReactNode;
  white: ScoreSide;
  black: ScoreSide;
  /** Result to show between the players; omit (or null) to show "vs". */
  result?: string | null;
}) {
  const side = (s: ScoreSide, color: 'white' | 'black') => (
    <div className={`mc-sb-side ${color}`}>
      <span className={`mc-pip ${color}`} aria-hidden />
      <span className="mc-sb-name">{s.name}</span>
      {s.rating && <span className="mc-sb-rating mono">{s.rating}</span>}
    </div>
  );
  return (
    <header className="mc-head">
      <div className="mc-head-top">
        {back && <button className="btn ghost small" onClick={back.onClick}>{back.label}</button>}
        <div className="mc-title">
          {kicker && <span className="mc-kicker">{kicker}</span>}
          <h1>{title}</h1>
          {subtitle && <span className="small muted">{subtitle}</span>}
        </div>
        <span className="spacer" />
        {status}
        {actions}
      </div>
      <div className="mc-scoreboard" role="group" aria-label={`${white.name} (White) vs ${black.name} (Black)${result ? `, final result ${result}` : ''}`}>
        {side(white, 'white')}
        <div className="mc-sb-mid mono" aria-hidden>{result ?? 'vs'}</div>
        {side(black, 'black')}
      </div>
    </header>
  );
}

/* ---------- player cards ---------- */

export function PlayerBar({ color, avatar, name, meta, aside, active, testId, children }: {
  color: 'white' | 'black';
  avatar?: ReactNode;
  name: ReactNode;
  meta?: ReactNode;
  /** Right-hand slot: a Clock, or the Arena's thinking-time chip. */
  aside?: ReactNode;
  /** Highlights the side to move. */
  active?: boolean;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`player-bar mc-player${active ? ' to-move' : ''}`} data-testid={testId}>
      <span className={`mc-pip ${color}`} aria-hidden />
      {avatar}
      <div className="mc-player-id">
        <div className="player-name">{name}</div>
        {meta && <div className="player-meta">{meta}</div>}
        {children}
      </div>
      {aside && <div className="mc-player-aside">{aside}</div>}
    </div>
  );
}

/** The player's own avatar: a king in their colour. */
export function KingAvatar({ color, size = 40 }: { color: 'white' | 'black'; size?: number }) {
  return <div className="portrait mc-king" style={{ width: size, height: size }}><PieceSvg kind="k" color={color === 'white' ? 'w' : 'b'} /></div>;
}

/** A game clock. `live` marks a running game clock (role="timer"); replays show a static reading. */
export function Clock({ text, label, running, low, live }: { text: string; label: string; running?: boolean; low?: boolean; live?: boolean }) {
  return <div className={`clock${running ? ' running' : ''}${low ? ' low' : ''}`} role={live ? 'timer' : undefined} aria-label={label}>{text}</div>;
}

/** Pieces captured by one side in the given position, plus the material lead. */
export function Captured({ fen, color, name }: { fen: string; color: 'white' | 'black'; name: string }) {
  const cap = capturedFrom(fen);
  const caps = color === 'white' ? cap.byWhite : cap.byBlack;
  const adv = color === 'white' ? cap.advantage : -cap.advantage;
  return (
    <div className="captured" aria-label={`Captured by ${name}`}>
      {caps.map((k, i) => <PieceSvg key={i} kind={k.toLowerCase() as PieceKind} color={k === k.toUpperCase() ? 'w' : 'b'} title={`${k === k.toUpperCase() ? 'white' : 'black'} ${PIECE_NAMES[k.toLowerCase() as PieceKind]}`} />)}
      {adv > 0 && <span className="adv">+{adv}</span>}
    </div>
  );
}

/* ---------- move navigation and replay ---------- */

export interface ReplayControl {
  playing: boolean;
  onToggle: () => void;
  testId: string;
  /** Label of the button while stopped ("Play", or "Resume" for the Arena's reveal). */
  playLabel?: string;
  disabled?: boolean;
  speeds: readonly { label: string }[];
  speed: number;
  onSpeed: (index: number) => void;
}

export function MoveNav({ onFirst, onPrev, onNext, onLast, firstLabel = 'First Move', lastLabel = 'Last Move', indicator, onFlip, replay, children }: {
  onFirst: () => void; onPrev: () => void; onNext: () => void; onLast: () => void;
  firstLabel?: string; lastLabel?: string;
  /** Shown between previous and next (e.g. the ply indicator). */
  indicator?: ReactNode;
  onFlip?: () => void;
  replay?: ReplayControl;
  /** Extra content on the replay row (e.g. "showing 12 of 30 moves"). */
  children?: ReactNode;
}) {
  return (
    <div className="mc-nav">
      <div className="mc-nav-row" role="group" aria-label="Move Navigation">
        <button className="btn" aria-label={firstLabel} onClick={onFirst}><Icon name="first" /></button>
        <button className="btn" aria-label="Previous Move" onClick={onPrev}><Icon name="prev" /></button>
        {indicator}
        <button className="btn" aria-label="Next Move" onClick={onNext}><Icon name="next" /></button>
        <button className="btn" aria-label={lastLabel} onClick={onLast}><Icon name="last" /></button>
        {onFlip && <button className="btn" aria-label="Flip Board" onClick={onFlip}><Icon name="flip" /></button>}
      </div>
      {(replay || children) && (
        <div className="mc-nav-row mc-replay">
          {replay && (
            <>
              <button className="btn small" data-testid={replay.testId} disabled={replay.disabled} onClick={replay.onToggle}>
                <Icon name={replay.playing ? 'pause' : 'play'} /> {replay.playing ? 'Pause' : (replay.playLabel ?? 'Play')}
              </button>
              <div className="seg" role="group" aria-label="Replay Speed">
                {replay.speeds.map((s, i) => <button key={s.label} aria-pressed={replay.speed === i} onClick={() => replay.onSpeed(i)}>{s.label}</button>)}
              </div>
            </>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Arrow-key navigation for screens without their own handler: ←/→ step, Home/End jump. Keys already handled by a
 * focused control (board squares, tabs) or typed into a form field are left alone.
 */
export function moveKeys(nav: { prev: () => void; next: () => void; first: () => void; last: () => void }) {
  return (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, [contenteditable="true"]')) return;
    const f = ({ ArrowLeft: nav.prev, ArrowRight: nav.next, Home: nav.first, End: nav.last } as Record<string, (() => void) | undefined>)[e.key];
    if (!f) return;
    e.preventDefault();
    f();
  };
}

/* ---------- notation ---------- */

export interface NotationItem {
  san: string;
  /** undefined: no grade icon at all (live play, Arena before settlement); null: the "not graded" icon. */
  grade?: Grade | null;
  provisional?: boolean;
}

export function NotationList({ moves, current, onSelect, startsWithBlack = false, label, testId, itemTestId, empty = 'No moves yet.' }: {
  moves: NotationItem[];
  /** Highlighted ply (1-based); 0 or a value out of range highlights nothing. */
  current: number;
  onSelect?: (ply: number) => void;
  startsWithBlack?: boolean;
  label: string;
  testId?: string;
  itemTestId?: string;
  empty?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // keep the highlighted move in view inside the list (never scrolls the page)
  useEffect(() => {
    const c = ref.current;
    const el = c?.querySelector<HTMLElement>('.mc-mv.on');
    if (!c || !el) return;
    const head = c.querySelector<HTMLElement>('.mc-move-head')?.offsetHeight ?? 0;
    if (el.offsetTop - head < c.scrollTop) c.scrollTop = el.offsetTop - head;
    else if (el.offsetTop + el.offsetHeight > c.scrollTop + c.clientHeight) c.scrollTop = el.offsetTop + el.offsetHeight - c.clientHeight;
  }, [current, moves.length]);

  const offset = startsWithBlack ? 1 : 0;
  const rows = Math.ceil((moves.length + offset) / 2);
  const cell = (ply: number, no: number, white: boolean) => {
    if (ply < 1) return <span key={ply} className="mc-mv-gap muted" aria-hidden>…</span>;
    if (ply > moves.length) return <span key={ply} />;
    const m = moves[ply - 1];
    const on = ply === current;
    const grade = m.grade ? `, ${GRADE_LABEL[m.grade]}${m.provisional ? ' (provisional)' : ''}` : m.grade === null ? ', not graded' : '';
    return (
      <button key={ply} type="button" className={`mc-mv${on ? ' on' : ''}`} aria-current={on ? 'step' : undefined} data-ply={ply} data-testid={itemTestId}
        tabIndex={onSelect ? undefined : -1} onClick={onSelect ? () => onSelect(ply) : undefined} aria-label={`${no}. ${white ? 'White' : 'Black'} ${m.san}${grade}`}>
        <span className="mc-mv-san">{m.san}</span>{m.grade !== undefined && <GradeIcon grade={m.grade} provisional={m.provisional} />}
      </button>
    );
  };
  return (
    <div className="mc-moves" ref={ref} role="group" aria-label={label} data-testid={testId}>
      {moves.length === 0 ? <p className="muted small mc-moves-empty">{empty}</p> : (
        <>
          <div className="mc-move-row mc-move-head" aria-hidden><span /><span>White</span><span>Black</span></div>
          {Array.from({ length: rows }, (_, r) => {
            const w = 2 * r + 1 - offset;
            return (
              <div key={r} className="mc-move-row">
                <span className="mc-mv-no mono" aria-hidden>{r + 1}.</span>
                {cell(w, r + 1, true)}
                {cell(w + 1, r + 1, false)}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ---------- layout ---------- */

export interface MatchPanel {
  id: string;
  /** Tab label (phones). */
  label: string;
  content: ReactNode;
  /** Desktop column inside the side area (0-based); the Arena uses two. */
  column?: number;
}

export function MatchLayout({ board, panels, active, onActive, tabsLabel, columns = 1, className = '' }: {
  board: ReactNode;
  panels: MatchPanel[];
  active: string;
  onActive: (id: string) => void;
  tabsLabel: string;
  columns?: number;
  className?: string;
}) {
  const uid = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: KeyboardEvent) => {
    const i = panels.findIndex(p => p.id === active);
    const j = e.key === 'ArrowRight' ? (i + 1) % panels.length : e.key === 'ArrowLeft' ? (i - 1 + panels.length) % panels.length : e.key === 'Home' ? 0 : e.key === 'End' ? panels.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    e.stopPropagation();
    onActive(panels[j].id);
    tabRefs.current[j]?.focus();
  };
  const cols = Array.from({ length: columns }, (_, c) => panels.filter(p => (p.column ?? 0) === c));
  return (
    <div className={`mc-layout ${className}`}>
      <div className="mc-board">{board}</div>
      {panels.length > 1 && (
        <div className="seg mc-tabs" role="tablist" aria-label={tabsLabel} onKeyDown={onTabKey}>
          {panels.map((p, i) => (
            <button key={p.id} ref={el => { tabRefs.current[i] = el; }} id={`${uid}-tab-${p.id}`} role="tab" aria-selected={active === p.id} aria-controls={`${uid}-panel-${p.id}`}
              tabIndex={active === p.id ? 0 : -1} onClick={() => onActive(p.id)}>{p.label}</button>
          ))}
        </div>
      )}
      <div className={`mc-side mc-cols-${columns}`}>
        {cols.map((ps, c) => (
          <div key={c} className="mc-col">
            {ps.map(p => (
              <div key={p.id} id={`${uid}-panel-${p.id}`} role={panels.length > 1 ? 'tabpanel' : undefined} aria-labelledby={panels.length > 1 ? `${uid}-tab-${p.id}` : undefined}
                className={`mc-panel ${active === p.id ? 'is-on' : 'is-off'}`}>
                {p.content}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
