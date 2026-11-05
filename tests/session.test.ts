import { describe, expect, it } from 'vitest';
import { GameSession, createGameRecord } from '../src/games/session';
import { TIME_CONTROLS } from '../src/games/types';

const human = { kind: 'human' as const, id: 'player', name: 'You', rating: 1500, rd: 350 };
const engine = { kind: 'engine' as const, id: 'ai', name: 'AI', rating: 1400, rd: 60 };
const mk = (tc = TIME_CONTROLS.rapid, mode: 'rated' | 'casual' = 'rated', fen?: string) => new GameSession(createGameRecord({
  id: 'g1', mode, timeControl: tc, humanColor: 'white', human, engine, engineSeed: 1, nowIso: 'T0', initialFen: fen,
}));

describe('game session', () => {
  it('rejects illegal moves and records clocks with increment', () => {
    const s = mk();
    s.start(0);
    expect(s.applyMove('a2a4', 1000, 'T').ok).toBe(false);
    const r = s.applyMove('c2c3', 10_000, 'T');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.elapsedMs).toBe(10_000);
      expect(r.record.clockAfterMs).toBe(300_000 - 10_000 + 3_000);
      expect(r.record.san).toBe('c3');
    }
  });
  it('flag falls on tick: timeout loss when opponent has material', () => {
    const s = mk(TIME_CONTROLS.blitz);
    s.start(0);
    expect(s.tick(179_999, 'T')).toBeNull();
    const o = s.tick(180_001, 'T');
    expect(o?.termination).toBe('timeout');
    expect(o?.result).toBe('0-1');
  });
  it('timeout against a bare king is a draw', () => {
    const s = mk(TIME_CONTROLS.blitz, 'rated', '3k2/6/6/6/6/2RK2 b - - 0 1');
    s.start(0);
    expect(s.tick(200_000, 'T')?.termination).toBe('timeout'); // black flags, white has a rook
    const s2 = mk(TIME_CONTROLS.blitz, 'rated', '3k2/6/6/6/6/2RK2 w - - 0 1');
    s2.start(0);
    expect(s2.tick(200_000, 'T')?.termination).toBe('timeout-vs-bare-king');
  });
  it('a move submitted after the flag fell is a timeout, not a move', () => {
    const s = mk(TIME_CONTROLS.blitz);
    s.start(0);
    const r = s.applyMove('c2c3', 181_000, 'T');
    expect(r.ok).toBe(false);
    expect(s.outcome?.termination).toBe('timeout');
  });
  it('checkmate ends the game automatically', () => {
    const s = mk(TIME_CONTROLS.rapid, 'rated', '3k2/6/3K2/6/6/R5 w - - 0 1');
    s.start(0);
    const r = s.applyMove('a1a6', 100, 'T');
    expect(r.ok && r.outcome?.termination).toBe('checkmate');
    expect(s.record.status).toBe('terminal');
  });
  it('pause stops the clock; resume restarts it', () => {
    const s = mk();
    s.start(0);
    s.pause(5_000, 'visibility', 'T');
    expect(s.remaining(0, 100_000)).toBe(295_000);
    s.resume(100_000, 'T');
    expect(s.remaining(0, 101_000)).toBe(294_000);
    expect(s.record.pauses).toHaveLength(1);
  });
  it('untimed games are never rated; assistance is refused in a rated game', () => {
    expect(mk(TIME_CONTROLS.untimed).record.rated).toBe(false);
    expect(mk(TIME_CONTROLS.rapid).record.rated).toBe(false); // v1.1: shorter controls are casual for new games
    const s = mk(TIME_CONTROLS.classical60);
    expect(s.record.rated).toBe(true);
    expect(s.assistanceAllowed).toBe(false);
    expect(s.markAssisted('hint', 'T')).toBe(false); // refused in rated games
    expect(s.record.rated).toBe(true);
    expect(s.record.assistance).toHaveLength(0);
    const c = mk(TIME_CONTROLS.rapid, 'casual');
    expect(c.markAssisted('hint', 'T')).toBe(true);
    expect(c.record.assistance).toHaveLength(1);
    expect(c.record.rated).toBe(false);
  });
  it('draw agreement only after 20 plies; resignation', () => {
    const s = mk(TIME_CONTROLS.untimed, 'casual');
    expect(s.canAgreeDraw()).toBe(false);
    expect(s.resign(0, 0, 'T').result).toBe('0-1');
  });
  it('rebuilding a session from its record reproduces the position', () => {
    const s = mk();
    s.start(0);
    for (const m of ['c2c3', 'c5c4', 'e1f3', 'e6f4']) s.applyMove(m, 1, 'T');
    const s2 = new GameSession(s.snapshot());
    expect(s2.pos.toFen()).toBe(s.pos.toFen());
    expect(s.record.moves.map(m => m.fenAfter).at(-1)).toBe(s.pos.toFen());
  });
});

describe('acceptance game types', () => {
  it('draw by agreement after each side made ten moves', () => {
    const s = mk(TIME_CONTROLS.untimed, 'casual');
    s.start(0);
    // 20 plies without reaching fivefold: knights shuffle, then pawns advance.
    const seq = ['b1c3', 'b6c4', 'c3b1', 'c4b6', 'a2a3', 'a5a4', 'e1f3', 'e6f4', 'f3e1', 'f4e6', 'f2f3', 'f5f4', 'b1c3', 'b6c4', 'c3b1', 'c4b6', 'e1f3'.replace('f3', 'd3'), 'e6d4', 'd3e1', 'd4e6'];
    for (let i = 0; i < 20; i++) expect(s.applyMove(seq[i], 0, 'T').ok).toBe(true);
    expect(s.canAgreeDraw()).toBe(true);
    expect(s.agreeDraw(0, 'T')?.termination).toBe('agreement');
    expect(s.record.result).toBe('1/2-1/2');
  });
  it('fivefold repetition ends the game automatically even without a claim', () => {
    const s = mk(TIME_CONTROLS.untimed, 'casual');
    s.start(0);
    const cycle = ['b1c3', 'b6c4', 'c3b1', 'c4b6'];
    let last;
    for (let i = 0; i < 16 && !s.isOver; i++) last = s.applyMove(cycle[i % 4], 0, 'T');
    expect(last && last.ok && last.outcome?.termination).toBe('fivefold-repetition');
  });
  it('promotion game: underpromotion is recorded in CCN and SAN', () => {
    const s = mk(TIME_CONTROLS.rapid, 'rated', '3k2/P5/6/6/6/3K2 w - - 0 1');
    s.start(0);
    const r = s.applyMove('a5a6n', 10, 'T');
    expect(r.ok && r.record.ccn).toBe('a5a6n');
    expect(r.ok && r.record.san).toBe('a6=N');
    expect(s.pos.toFen().startsWith('N2k2')).toBe(true);
  });
});
