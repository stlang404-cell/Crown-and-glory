import { useEffect, useLayoutEffect, useMemo, useRef, useState, KeyboardEvent, PointerEvent as RPointerEvent } from 'react';
import { PieceSvg, PieceKind, PIECE_NAMES } from './Pieces';
import { detectTransition, isForward, parseBoard as parseCells, type Cell } from './boardMotion';
import { pieceMoveMs } from './theme';
import { moveSoundId, playSound } from './sound';

const FILES = 'abcdef';
export interface BoardArrow { from: string; to: string; color?: string }

export interface BoardProps {
  fen: string;
  orientation: 'white' | 'black';
  /** Legal moves in CCN for the side that may move now (empty = not interactive). */
  legal?: string[];
  onMove?: (ccn: string) => void;
  lastMove?: string | null;
  checkSquare?: string | null;
  arrows?: BoardArrow[];
  showCoords?: boolean;
  label?: string;
  /** Extra highlighted squares (e.g. puzzle hints). */
  highlights?: string[];
  /** Play move sounds when the game's last move is played forward on this board (live play, spectating, replay). */
  sounds?: boolean;
  /** A live game (play, live spectating): an instant reply waits for the previous slide instead of being skipped. */
  live?: boolean;
}

const parseBoard = parseCells;
const sqName = (i: number) => FILES[i % 6] + (Math.floor(i / 6) + 1);
const sqIndex = (n: string) => FILES.indexOf(n[0]) + (+n[1] - 1) * 6;
const describe = (p: string | null) => (p ? `${p === p.toUpperCase() ? 'white' : 'black'} ${PIECE_NAMES[p.toLowerCase() as PieceKind]}` : 'empty');

export function Board({ fen, orientation, legal = [], onMove, lastMove, checkSquare, arrows = [], showCoords = true, label = 'Chess board', highlights = [], sounds = false, live = false }: BoardProps) {
  const board = useMemo(() => parseBoard(fen), [fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [drag, setDrag] = useState<{ from: string; x: number; y: number; started: boolean; size: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<(HTMLButtonElement | null)[]>([]);
  const justDragged = useRef(false);

  useEffect(() => { setSelected(null); setPromo(null); }, [fen]);

  // ---- motion (presentation only: `board` is always the authoritative position) ----
  const prevBoard = useRef<Cell[] | null>(null);
  const prevOrientation = useRef(orientation);
  const lastChangeAt = useRef(0);
  const running = useRef<Animation[]>([]);
  const droppedMove = useRef<string | null>(null);
  const [ghost, setGhost] = useState<{ sq: string; piece: string; key: number; ms: number } | null>(null);
  const busyUntil = useRef(0);
  const chained = useRef(false);
  const timers = useRef<number[]>([]);
  useLayoutEffect(() => {
    const prev = prevBoard.current;
    prevBoard.current = board;
    const flipped = prevOrientation.current !== orientation;
    prevOrientation.current = orientation;
    const now = performance.now();
    const since = now - lastChangeAt.current;
    lastChangeAt.current = now;
    const t = flipped ? null : detectTransition(prev, board);
    const forward = !!t && isForward(t, lastMove);
    const ms = pieceMoveMs();
    let rapid = since < Math.max(90, ms * 0.6);
    // Live boards: a reply that arrives while the previous move is still sliding (an instant engine move) waits for
    // that slide, then slides itself. Only one move is ever queued; a longer backlog is drawn instantly.
    const chain = !!live && rapid && forward && !chained.current && busyUntil.current > now;
    chained.current = chain;
    if (chain) rapid = false;
    else {
      for (const x of running.current) x.cancel();
      running.current = [];
      for (const id of timers.current) clearTimeout(id);
      timers.current = [];
      setGhost(null);
    }
    if (!t) return;
    const dropped = forward && droppedMove.current?.slice(0, 4) === t.from + t.to;
    droppedMove.current = null;
    const delay = chain ? Math.max(0, busyUntil.current - now) : 0;
    // Rapid stepping (scrubbing, holding an arrow key) skips animation and sound to stay responsive.
    if (sounds && forward && !rapid) {
      const id = moveSoundId({ capture: !!t.captured, check: !!checkSquare, promotion: t.promotion });
      if (delay > 0) timers.current.push(window.setTimeout(() => playSound(id), delay)); else playSound(id);
    }
    if (!ms || rapid) { busyUntil.current = 0; return; }
    const root = boardRef.current;
    const fromEl = root?.querySelector<HTMLElement>(`[data-square="${t.from}"]`);
    const toEl = root?.querySelector<HTMLElement>(`[data-square="${t.to}"]`);
    const piece = toEl?.querySelector<SVGElement>('.piece');
    if (!fromEl || !toEl || !piece || typeof piece.animate !== 'function') return;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    const dist = Math.hypot(dx, dy) / Math.max(1, b.width);
    const dur = Math.round(ms * Math.min(1.35, 0.85 + 0.12 * dist)); // longer slides take slightly longer
    const ease = 'cubic-bezier(.22,.75,.25,1)';
    busyUntil.current = now + delay + (dropped ? 0 : dur);
    if (!dropped) {
      piece.classList.add('animating');
      // fill 'backwards' keeps a queued piece drawn on its origin square until its turn to slide
      const anim = piece.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: dur, delay, easing: ease, fill: 'backwards' });
      const done = () => piece.classList.remove('animating');
      anim.onfinish = done; anim.oncancel = done;
      running.current.push(anim);
    }
    if (t.captured) {
      const g = { sq: t.to, piece: t.captured, key: now, ms: dur };
      if (delay > 0) timers.current.push(window.setTimeout(() => setGhost(g), delay)); else setGhost(g);
    }
    if (t.restored) {
      const back = fromEl.querySelector<SVGElement>('.piece');
      if (back) running.current.push(back.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1)' }], { duration: dur, easing: ease }));
    }
    if (t.promotion && forward) {
      running.current.push(piece.animate(
        [{ filter: 'drop-shadow(0 0 0 transparent)' }, { filter: 'drop-shadow(0 0 7px var(--gold, #d8b25a)) brightness(1.15)' }, { filter: 'drop-shadow(0 0 0 transparent)' }],
        { duration: 520, delay: delay + (dropped ? 0 : dur * 0.7), easing: 'ease-out' }));
    }
  }, [board, orientation]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { for (const a of running.current) a.cancel(); for (const id of timers.current) clearTimeout(id); }, []);

  const order = useMemo(() => {
    const idx: number[] = [];
    for (let r = 5; r >= 0; r--) for (let f = 0; f < 6; f++) idx.push(r * 6 + f);
    return orientation === 'white' ? idx : idx.reverse();
  }, [orientation]);

  const movable = useMemo(() => new Set(legal.map(m => m.slice(0, 2))), [legal]);
  const dests = useMemo(() => (selected ? new Set(legal.filter(m => m.startsWith(selected)).map(m => m.slice(2, 4))) : new Set<string>()), [legal, selected]);

  const tryMove = (from: string, to: string) => {
    const cands = legal.filter(m => m.slice(0, 4) === from + to);
    if (!cands.length) return false;
    if (cands.length > 1 || cands[0].length === 5) { setPromo({ from, to }); return true; }
    setSelected(null);
    onMove?.(cands[0]);
    return true;
  };

  const clickSquare = (name: string) => {
    if (justDragged.current) { justDragged.current = false; return; }
    if (promo) return;
    if (selected && dests.has(name)) { tryMove(selected, name); return; }
    if (movable.has(name)) setSelected(selected === name ? null : name);
    else setSelected(null);
  };

  const squareFromPoint = (x: number, y: number): string | null => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const col = Math.floor(((x - r.left) / r.width) * 6), row = Math.floor(((y - r.top) / r.height) * 6);
    if (col < 0 || col > 5 || row < 0 || row > 5) return null;
    return sqName(order[row * 6 + col]);
  };

  const onPointerDown = (e: RPointerEvent, name: string) => {
    if (promo || !movable.has(name) || e.button > 0) return;
    const size = (boardRef.current?.getBoundingClientRect().width ?? 360) / 6;
    setDrag({ from: name, x: e.clientX, y: e.clientY, started: false, size });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent) => {
    if (!drag) return;
    const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6;
    if (moved || drag.started) setDrag({ ...drag, x: e.clientX, y: e.clientY, started: true });
  };
  const onPointerUp = (e: RPointerEvent) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.started) return; // treated as a tap by onClick
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 0);
    const target = squareFromPoint(e.clientX, e.clientY);
    if (target && target !== d.from) { droppedMove.current = d.from + target; setSelected(d.from); if (!tryMove(d.from, target)) { setSelected(null); droppedMove.current = null; } }
  };

  const onKey = (e: KeyboardEvent, pos: number) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = pos + map[e.key];
    if (next >= 0 && next < 36) focusRef.current[next]?.focus();
  };

  const last = lastMove ? [lastMove.slice(0, 2), lastMove.slice(2, 4)] : [];
  const promoColor = promo ? (board[sqIndex(promo.from)] === board[sqIndex(promo.from)]?.toUpperCase() ? 'w' : 'b') : 'w';

  const center = (n: string) => {
    const i = order.indexOf(sqIndex(n));
    return { x: (i % 6) + 0.5, y: Math.floor(i / 6) + 0.5 };
  };

  return (
    <div className={`board-wrap${showCoords ? ' with-coords' : ''}`}>
      <div ref={boardRef} className={`board${legal.length ? ' interactive' : ''}${selected ? ' has-sel' : ''}`} role="grid" aria-label={label} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
        {order.map((idx, pos) => {
          const name = sqName(idx);
          const p = board[idx];
          const light = (idx % 6 + Math.floor(idx / 6)) % 2 === 1;
          const isDest = dests.has(name);
          const cls = ['sq', light ? 'light' : 'dark', last.includes(name) ? `last ${name === last[0] ? 'last-from' : 'last-to'}` : '', selected === name || highlights.includes(name) ? 'sel' : '', checkSquare === name ? 'check' : '', isDest ? (p ? 'dest capture' : 'dest') : ''].filter(Boolean).join(' ');
          const row = Math.floor(pos / 6), col = pos % 6;
          return (
            <button
              key={name}
              ref={el => { focusRef.current[pos] = el; }}
              className={cls}
              data-square={name}
              aria-label={`${name}, ${describe(p)}${isDest ? ', legal destination' : ''}${selected === name ? ', selected' : ''}`}
              onClick={() => clickSquare(name)}
              onPointerDown={e => onPointerDown(e, name)}
              onKeyDown={e => onKey(e, pos)}
              tabIndex={pos === 0 ? 0 : -1}
            >
              {showCoords && col === 0 && <span className="coord rank">{name[1]}</span>}
              {showCoords && row === 5 && <span className="coord file">{name[0]}</span>}
              {p && (
                <PieceSvg
                  key={name + p}
                  kind={p.toLowerCase() as PieceKind}
                  color={p === p.toUpperCase() ? 'w' : 'b'}
                  className={`piece${drag?.started && drag.from === name ? ' dragging' : ''}`}
                />
              )}
              {ghost && ghost.sq === name && (
                <PieceSvg key={`ghost-${ghost.key}`} kind={ghost.piece.toLowerCase() as PieceKind} color={ghost.piece === ghost.piece.toUpperCase() ? 'w' : 'b'}
                  className="piece capture-ghost" style={{ animationDuration: `${ghost.ms}ms` }} onAnimationEnd={() => setGhost(g => (g?.key === ghost.key ? null : g))} />
              )}
              {isDest && (p ? <span className="ring" /> : <span className="dot" />)}
            </button>
          );
        })}
        {arrows.length > 0 && (
          <svg className="arrow-layer" viewBox="0 0 6 6" aria-hidden>
            <defs>
              <marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10z" fill="context-stroke" />
              </marker>
            </defs>
            {arrows.map((a, i) => {
              const s = center(a.from), t = center(a.to);
              const len = Math.hypot(t.x - s.x, t.y - s.y);
              const ex = t.x - ((t.x - s.x) / len) * 0.28, ey = t.y - ((t.y - s.y) / len) * 0.28;
              return <line key={i} x1={s.x} y1={s.y} x2={ex} y2={ey} style={{ stroke: a.color ?? 'color-mix(in srgb, var(--positive) 85%, transparent)' }} strokeWidth={0.14} strokeLinecap="round" markerEnd="url(#ah)" />;
            })}
          </svg>
        )}
        {promo && (
          <div className="promo" role="dialog" aria-label="Choose promotion piece">
            <div className="promo-card">
              {(['q', 'r', 'n'] as const).map(k => (
                <button key={k} aria-label={`Promote to ${PIECE_NAMES[k]}`} onClick={() => { const m = promo.from + promo.to + k; setPromo(null); setSelected(null); onMove?.(m); }}>
                  <PieceSvg kind={k} color={promoColor} />
                </button>
              ))}
              <button className="promo-cancel" aria-label="Cancel promotion" onClick={() => { setPromo(null); setSelected(null); }}>
                <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M7 7l10 10M17 7 7 17" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
      {drag?.started && board[sqIndex(drag.from)] && (
        <PieceSvg
          kind={board[sqIndex(drag.from)]!.toLowerCase() as PieceKind}
          color={board[sqIndex(drag.from)] === board[sqIndex(drag.from)]!.toUpperCase() ? 'w' : 'b'}
          className="drag-ghost"
          style={{ left: drag.x - drag.size / 2, top: drag.y - drag.size / 2, width: drag.size, height: drag.size }}
        />
      )}
    </div>
  );
}

/** Material captured so far, derived from the current board vs the initial set (promotions handled by net counts). */
export function capturedFrom(fen: string): { byWhite: string[]; byBlack: string[]; advantage: number } {
  const b = parseBoard(fen);
  const start: Record<string, number> = { p: 6, n: 2, r: 2, q: 1 };
  const val: Record<string, number> = { p: 1, n: 3, r: 5, q: 9 };
  const count = (ch: string) => b.filter(x => x === ch).length;
  const byWhite: string[] = [], byBlack: string[] = [];
  let adv = 0;
  for (const k of ['q', 'r', 'n', 'p']) {
    const missingBlack = Math.max(0, start[k] - count(k));
    const missingWhite = Math.max(0, start[k] - count(k.toUpperCase()));
    for (let i = 0; i < missingBlack; i++) byWhite.push(k);
    for (let i = 0; i < missingWhite; i++) byBlack.push(k.toUpperCase());
  }
  for (const k of ['q', 'r', 'n', 'p']) adv += val[k] * (count(k.toUpperCase()) - count(k));
  return { byWhite, byBlack, advantage: adv };
}
