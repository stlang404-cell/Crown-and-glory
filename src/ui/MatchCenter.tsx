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
 *  - EvalBar / EvalBoard: the vertical evaluation bar beside the board (v0.10, docs/V10_PLAN.md Decision 3).
 *
 * Presentation only. These components render exactly what the screen passes in: a move gets a grade icon only when
 * the caller supplies a grade for it, the bar shows only the evaluation the caller passes, and nothing here reads
 * engine evaluations, markets or analysis reports. Each screen keeps its own information policy (no grades in the
 * Arena before settlement, only the published evaluation while a market can trade, no engine help and no bar in
 * player games: `evalBarAllowed` is the single gate every screen goes through).
 */
import { KeyboardEvent, ReactNode, useEffect, useId, useRef } from 'react';
import { Icon } from './Icons';
import { capturedFrom } from './Board';
import { PieceSvg, PieceKind, PIECE_NAMES } from './Pieces';
import type { EngineScore, Grade } from '../analysis/types';
import { expectedU, toPov } from '../analysis/methodology';
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

/* ---------- evaluation bar ---------- */

/**
 * Where an evaluation bar may appear (fairness rules, docs/V10_PLAN.md): spectating (the published per-move
 * evaluation only), replays and analysis. Never in a player's own game in progress — rated games have no engine help
 * at all, and in casual games the Assistant gives an evaluation only on request and records each use (a permanent bar
 * would bypass that record), so no live player game shows one.
 */
export type EvalContext = { kind: 'play'; rated: boolean } | { kind: 'spectate' } | { kind: 'replay' } | { kind: 'analysis' };
export const evalBarAllowed = (c: EvalContext): boolean => c.kind !== 'play';

/** Evaluation text from White's side: "+1.3", "−0.4", "0.0", mate "M3" / "−M2", a finished game "1-0" / "0-1" / "½-½". */
export function formatEval(s: EngineScore | null): string {
  if (!s) return '–';
  const w = toPov(s, 'white');
  if (w.kind === 'cp') { const v = Math.round(w.value / 10) / 10; return v === 0 ? '0.0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`; }
  if (w.kind === 'mate') return `${w.plies > 0 ? '' : '−'}M${Math.max(1, Math.ceil(Math.abs(w.plies) / 2))}`;
  return w.outcome === 'win' ? '1-0' : w.outcome === 'loss' ? '0-1' : '½-½';
}

export interface EvalBarModel { white: number; text: string; leader: 'white' | 'black' | null; label: string }

/**
 * The bar's geometry and wording. The boundary is White's expected score under the methodology's expected-score map
 * (crown-outcome-map-v2 by default), so it is not linear in centipawns; mate puts the boundary at the edge.
 */
export function evalBarModel(s: EngineScore | null, accuracyId?: string): EvalBarModel {
  if (!s) return { white: 0.5, text: '–', leader: null, label: 'No evaluation yet' };
  const u = Math.max(0, Math.min(1, expectedU(toPov(s, 'white'), accuracyId)));
  const text = formatEval(s);
  const leader = Math.abs(u - 0.5) < 0.005 ? null : u > 0.5 ? 'white' : 'black';
  const w = toPov(s, 'white');
  const spoken = w.kind === 'mate' ? `${w.plies > 0 ? 'White' : 'Black'} mates in ${Math.max(1, Math.ceil(Math.abs(w.plies) / 2))}`
    : w.kind === 'terminal' ? (w.outcome === 'draw' ? 'game drawn' : `${w.outcome === 'win' ? 'White' : 'Black'} has won`)
    : `${text.replace('+', 'plus ').replace('−', 'minus ')} pawns${leader ? `, ${leader === 'white' ? 'White' : 'Black'} is better` : ', equal'}`;
  return { white: u, text, leader, label: `${spoken}; White's expected score ${Math.round(u * 100)}%` };
}

/**
 * Vertical evaluation bar: White's share fills from White's side of the board (bottom when White is at the bottom),
 * so it flips with the board. The value is printed on the leading side. The fill animates (CSS), except with reduced
 * motion. `source` names where the number comes from ("published engine evaluation", "Match Analysis" …).
 */
export function EvalBar({ score, orientation, accuracyId, source, testId = 'eval-bar' }: {
  score: EngineScore | null; orientation: 'white' | 'black'; accuracyId?: string; source: string; testId?: string;
}) {
  const m = evalBarModel(score, accuracyId);
  const whiteBottom = orientation === 'white';
  // the value sits at the leading side's end of the bar (White's end when level)
  const atBottom = (m.leader ?? 'white') === 'white' ? whiteBottom : !whiteBottom;
  return (
    <div className={`mc-evalbar ${whiteBottom ? 'white-bottom' : 'white-top'}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(m.white * 100)}
      aria-valuetext={`${m.text}: ${m.label}`} aria-label={`Evaluation bar (${source})`} data-testid={testId} data-orientation={orientation} data-white={m.white.toFixed(3)} data-value={m.text}
      title={`${source}: ${m.text}`}>
      <div className="mc-evalbar-fill" style={{ transform: `scaleY(${m.white})` }} />
      <span className="mc-evalbar-mid" aria-hidden />
      <span className={`mc-evalbar-value ${atBottom ? 'at-bottom' : 'at-top'} ${(m.leader ?? 'white') === 'white' ? 'on-white' : 'on-black'}`} aria-hidden>{m.text}</span>
    </div>
  );
}

/** The board with the evaluation bar beside it — only when `context` allows a bar and a score source is given. */
export function EvalBoard({ context, score, orientation, accuracyId, source, children }: {
  context: EvalContext; score?: EngineScore | null; orientation: 'white' | 'black'; accuracyId?: string; source?: string; children: ReactNode;
}) {
  const show = evalBarAllowed(context) && score !== undefined && !!source;
  if (!show) return <>{children}</>;
  return (
    <div className="mc-evalboard">
      <EvalBar score={score ?? null} orientation={orientation} accuracyId={accuracyId} source={source!} />
      <div className="mc-evalboard-board">{children}</div>
    </div>
  );
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
    <div className="captured" role="group" aria-label={`Captured by ${name}`}>
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

export function MatchLayout({ board, panels, active, onActive, tabsLabel, columns = 1, className = '', boardTab, context }: {
  board: ReactNode;
  panels: MatchPanel[];
  active: string;
  onActive: (id: string) => void;
  tabsLabel: string;
  columns?: number;
  className?: string;
  /** Phones: make the board a tab of its own (id "board", this label) instead of keeping it above the tabs. */
  boardTab?: string;
  /** Match context (names, score, clocks, prices) kept above the tabs, visible whichever tab is open. */
  context?: ReactNode;
}) {
  const uid = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs = boardTab ? [{ id: 'board', label: boardTab }, ...panels] : panels;
  const onTabKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex(p => p.id === active);
    const j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    e.stopPropagation();
    onActive(tabs[j].id);
    tabRefs.current[j]?.focus();
  };
  const cols = Array.from({ length: columns }, (_, c) => panels.filter(p => (p.column ?? 0) === c));
  const tabbed = tabs.length > 1;
  const tabList = tabbed && (
    <div className="seg mc-tabs" role="tablist" aria-label={tabsLabel} onKeyDown={onTabKey}>
      {tabs.map((p, i) => (
        <button key={p.id} ref={el => { tabRefs.current[i] = el; }} id={`${uid}-tab-${p.id}`} role="tab" aria-selected={active === p.id} aria-controls={`${uid}-panel-${p.id}`}
          tabIndex={active === p.id ? 0 : -1} onClick={() => onActive(p.id)}>{p.label}</button>
      ))}
    </div>
  );
  return (
    <div className={`mc-layout ${className}${boardTab ? ' mc-board-tabbed' : ''}`}>
      {(context || boardTab) && <div className="mc-context-wrap">{context}{boardTab && tabList}</div>}
      <div className={`mc-board${boardTab ? ` mc-panel-board ${active === 'board' ? 'is-on' : 'is-off'}` : ''}`}
        {...(boardTab ? { id: `${uid}-panel-board`, role: 'tabpanel', 'aria-labelledby': `${uid}-tab-board` } : {})}>{board}</div>
      {!boardTab && tabList}
      <div className={`mc-side mc-cols-${columns}`}>
        {cols.map((ps, c) => (
          <div key={c} className={`mc-col mc-col-${c}`}>
            {ps.map(p => (
              <div key={p.id} id={`${uid}-panel-${p.id}`} role={tabbed ? 'tabpanel' : undefined} aria-labelledby={tabbed ? `${uid}-tab-${p.id}` : undefined}
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
