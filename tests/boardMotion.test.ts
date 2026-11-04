/** Board motion detection (presentation only): which changes animate, which are drawn instantly. */
import { describe, expect, it } from 'vitest';
import { detectTransition, isForward, parseBoard } from '../src/ui/boardMotion';
import { Position } from '../src/rules/position';
import { moveToCcn, parseLegalCcn } from '../src/rules/notation';

import { START_FEN } from '../src/rules/types';
const START = Position.fromFen(START_FEN);
const after = (fen: string, ...ccn: string[]) => { const p = Position.fromFen(fen); for (const m of ccn) p.makeMove(parseLegalCcn(p, m)); return p.toFen(); };

describe('detectTransition', () => {
  const s = START.toFen();
  it('a quiet move slides from origin to destination', () => {
    const p = Position.fromFen(s); const m = moveToCcn(p.legalMoves()[0]);
    const t = detectTransition(parseBoard(s), parseBoard(after(s, m)))!;
    expect(t).toMatchObject({ from: m.slice(0, 2), to: m.slice(2, 4), captured: null, restored: null, promotion: false });
    expect(isForward(t, m)).toBe(true);
  });
  it('stepping back slides the piece home and is not "forward" (no sound)', () => {
    const p = Position.fromFen(s); const m = moveToCcn(p.legalMoves()[0]);
    const t = detectTransition(parseBoard(after(s, m)), parseBoard(s))!;
    expect(t).toMatchObject({ from: m.slice(2, 4), to: m.slice(0, 2) });
    expect(isForward(t, m)).toBe(false);
  });
  it('captures leave a fading ghost; stepping back restores the captured piece', () => {
    // play until some capture is available
    const p = Position.fromFen(s); let fen = s; let cap: string | null = null;
    for (let i = 0; i < 40 && !cap; i++) {
      const mv = p.legalMoves();
      const c = mv.find(x => { const t = moveToCcn(x).slice(2, 4); return parseBoard(p.toFen())['abcdef'.indexOf(t[0]) + (+t[1] - 1) * 6] !== null; });
      const m = c ?? mv[i % mv.length];
      fen = p.toFen(); p.makeMove(m); if (c) cap = moveToCcn(c);
    }
    expect(cap).not.toBeNull();
    const t = detectTransition(parseBoard(fen), parseBoard(p.toFen()))!;
    expect(t.captured).not.toBeNull();
    const back = detectTransition(parseBoard(p.toFen()), parseBoard(fen))!;
    expect(back).toMatchObject({ from: cap!.slice(2, 4), to: cap!.slice(0, 2), restored: t.captured });
  });
  it('a promotion is flagged', () => {
    const before = parseBoard('6/P4k/6/6/6/K5 w - - 0 1');
    const t = detectTransition(before, parseBoard('Q5/5k/6/6/6/K5 b - - 0 1'))!;
    expect(t).toMatchObject({ from: 'a5', to: 'a6', promotion: true });
  });
  it('jumps of several moves, new games and the first render are drawn instantly', () => {
    expect(detectTransition(null, parseBoard(s))).toBeNull();
    const p = Position.fromFen(s); const ms = p.legalMoves().slice(0, 1).map(moveToCcn);
    const two = after(s, ms[0], moveToCcn(Position.fromFen(after(s, ms[0])).legalMoves()[0]));
    expect(detectTransition(parseBoard(s), parseBoard(two))).toBeNull();
    expect(detectTransition(parseBoard(s), parseBoard(s))).toBeNull();
  });
});
