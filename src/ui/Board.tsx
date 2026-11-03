import { useEffect, useMemo, useRef, useState, KeyboardEvent, PointerEvent as RPointerEvent } from 'react';
import { PieceSvg, PieceKind, PIECE_NAMES } from './Pieces';

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
}

function parseBoard(fen: string): (string | null)[] {
  const out: (string | null)[] = new Array(36).fill(null);
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, i) => {
    const rank = 5 - i;
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += +ch;
      else { out[rank * 6 + f] = ch; f++; }
    }
  });
  return out;
}
const sqName = (i: number) => FILES[i % 6] + (Math.floor(i / 6) + 1);
const sqIndex = (n: string) => FILES.indexOf(n[0]) + (+n[1] - 1) * 6;
const describe = (p: string | null) => (p ? `${p === p.toUpperCase() ? 'white' : 'black'} ${PIECE_NAMES[p.toLowerCase() as PieceKind]}` : 'empty');

export function Board({ fen, orientation, legal = [], onMove, lastMove, checkSquare, arrows = [], showCoords = true, label = 'Chess board', highlights = [] }: BoardProps) {
  const board = useMemo(() => parseBoard(fen), [fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [drag, setDrag] = useState<{ from: string; x: number; y: number; started: boolean; size: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<(HTMLButtonElement | null)[]>([]);
  const justDragged = useRef(false);

  useEffect(() => { setSelected(null); setPromo(null); }, [fen]);

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
    if (target && target !== d.from) { setSelected(d.from); if (!tryMove(d.from, target)) setSelected(null); }
  };

  const onKey = (e: KeyboardEvent, pos: number) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = pos + map[e.key];
    if (next >= 0 && next < 36) focusRef.current[next]?.focus();
  };

  const last = lastMove ? [lastMove.slice(0, 2), lastMove.slice(2, 4)] : [];
  const movingIdx = lastMove ? sqIndex(lastMove.slice(2, 4)) : -1;
  const delta = (() => {
    if (!lastMove) return { dx: 0, dy: 0 };
    const a = order.indexOf(sqIndex(lastMove.slice(0, 2))), b = order.indexOf(sqIndex(lastMove.slice(2, 4)));
    return { dx: ((a % 6) - (b % 6)) * (100 / 0.92), dy: (Math.floor(a / 6) - Math.floor(b / 6)) * (100 / 0.92) };
  })();
  const promoColor = promo ? (board[sqIndex(promo.from)] === board[sqIndex(promo.from)]?.toUpperCase() ? 'w' : 'b') : 'w';

  const center = (n: string) => {
    const i = order.indexOf(sqIndex(n));
    return { x: (i % 6) + 0.5, y: Math.floor(i / 6) + 0.5 };
  };

  return (
    <div className="board-wrap">
      <div ref={boardRef} className="board" role="grid" aria-label={label} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
        {order.map((idx, pos) => {
          const name = sqName(idx);
          const p = board[idx];
          const light = (idx % 6 + Math.floor(idx / 6)) % 2 === 1;
          const cls = ['sq', light ? 'light' : 'dark', last.includes(name) ? 'last' : '', selected === name || highlights.includes(name) ? 'sel' : '', checkSquare === name ? 'check' : ''].join(' ');
          const isDest = dests.has(name);
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
                  key={idx === movingIdx ? `${name}-${lastMove}` : name}
                  kind={p.toLowerCase() as PieceKind}
                  color={p === p.toUpperCase() ? 'w' : 'b'}
                  className={`piece${idx === movingIdx ? ' moving' : ''}${drag?.started && drag.from === name ? ' dragging' : ''}`}
                  style={idx === movingIdx ? ({ '--dx': `${delta.dx}%`, '--dy': `${delta.dy}%` } as React.CSSProperties) : undefined}
                />
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
              return <line key={i} x1={s.x} y1={s.y} x2={ex} y2={ey} stroke={a.color ?? 'rgba(131,214,176,.85)'} strokeWidth={0.14} strokeLinecap="round" markerEnd="url(#ah)" />;
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
              <button aria-label="Cancel promotion" onClick={() => { setPromo(null); setSelected(null); }} style={{ background: 'var(--panel-2)', color: 'var(--muted)', fontSize: 28 }}>×</button>
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
