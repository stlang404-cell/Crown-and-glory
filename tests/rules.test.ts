import { describe, expect, it } from 'vitest';
import {
  Position, perft, START_FEN, moveToCcn, parseCcn, parseLegalCcn, moveToSan, parseSan, automaticOutcome,
  claimableDraws, timeoutOutcome, agreementAllowed, WHITE, BLACK, FenError,
} from '../src/rules';

const ccnSet = (p: Position) => p.legalMoves().map(moveToCcn).sort();
function play(fen: string, moves: string[]): Position {
  const p = Position.fromFen(fen);
  for (const s of moves) {
    const m = parseLegalCcn(p, s);
    if (m < 0) throw new Error('illegal ' + s);
    p.makeMove(m);
  }
  return p;
}

describe('crown-la6-v1 initial state', () => {
  it('parses and round-trips the start FEN', () => {
    const p = Position.start();
    expect(p.toFen()).toBe(START_FEN);
    expect(p.side).toBe(WHITE);
  });
  it('perft depth 1-5 matches the research values and the native Fairy-Stockfish build', () => {
    const p = Position.start();
    // depths 1-4 from research doc 04 (pyffish 0.0.90); depth 5 measured with Fairy-Stockfish `go perft 5`.
    expect([1, 2, 3, 4, 5].map(d => perft(p, d))).toEqual([10, 100, 1212, 14332, 191846]);
  });
  it('has exactly the ten legal opening moves (single pawn steps and knight moves only)', () => {
    expect(ccnSet(Position.start())).toEqual(['a2a3', 'b1a3', 'b1c3', 'b2b3', 'c2c3', 'd2d3', 'e1d3', 'e1f3', 'e2e3', 'f2f3']);
  });
  it('rejects bishops, castling rights and en passant squares', () => {
    expect(() => Position.fromFen('rnbknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1')).toThrow(FenError);
    expect(() => Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w KQ - 0 1')).toThrow(FenError);
    expect(() => Position.fromFen('rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - c3 0 1')).toThrow(FenError);
  });
});

describe('move rules', () => {
  it('pawns never double-step', () => {
    const p = Position.start();
    expect(p.legalMoves().map(moveToCcn)).not.toContain('a2a4');
  });
  it('promotion is mandatory and offers exactly Q, R, N', () => {
    const p = Position.fromFen('3k2/P5/6/6/6/3K2 w - - 0 1');
    const promos = ccnSet(p).filter(m => m.startsWith('a5'));
    expect(promos).toEqual(['a5a6n', 'a5a6q', 'a5a6r']);
    expect(parseLegalCcn(p, 'a5a6')).toBe(-1);
  });
  it('promotion by capture offers Q/R/N', () => {
    const p = Position.fromFen('1r1k2/P5/6/6/6/3K2 w - - 0 1');
    expect(ccnSet(p).filter(m => m.startsWith('a5'))).toEqual(['a5a6n', 'a5a6q', 'a5a6r', 'a5b6n', 'a5b6q', 'a5b6r']);
  });
  it('black promotes on rank 1', () => {
    const p = Position.fromFen('3k2/6/6/6/p5/3K2 b - - 0 1');
    expect(ccnSet(p).filter(m => m.startsWith('a2'))).toEqual(['a2a1n', 'a2a1q', 'a2a1r']);
  });
  it('pinned pieces cannot leave the pin line', () => {
    // White king d1, white knight d2 pinned by black rook d6.
    const p = Position.fromFen('3r1k/6/6/6/3N2/3K2 w - - 0 1');
    expect(ccnSet(p).filter(m => m.startsWith('d2'))).toEqual([]);
  });
  it('kings may not move adjacent to the other king', () => {
    const p = Position.fromFen('6/6/2k3/6/2K3/6 w - - 0 1');
    const kingMoves = ccnSet(p);
    for (const m of ['b3b4', 'c3c4', 'c3d4'].map(s => s)) expect(kingMoves).not.toContain(m);
  });
  it('check must be answered', () => {
    const p = Position.fromFen('3k2/6/6/6/6/r2K2 w - - 0 1');
    expect(p.inCheck()).toBe(true);
    for (const m of p.legalMoves()) {
      p.makeMove(m);
      expect(p.lastMoveLeftKingInCheck()).toBe(false);
      p.unmakeMove();
    }
  });
  it('make/unmake restores state and hash', () => {
    const p = Position.start();
    const fen = p.toFen(), h = p.hashKey();
    for (const m of p.legalMoves()) {
      p.makeMove(m);
      for (const r of p.legalMoves()) { p.makeMove(r); p.unmakeMove(); }
      p.unmakeMove();
      expect(p.toFen()).toBe(fen);
      expect(p.hashKey()).toBe(h);
    }
  });
  it('incremental hash equals recomputed hash along a game', () => {
    const p = play(START_FEN, ['c2c3', 'c5c4', 'e1f3', 'b6a4', 'f3e5', 'a4b2', 'c1b2']);
    const h = p.hashKey();
    p.recomputeHash();
    expect(p.hashKey()).toBe(h);
  });
  it('halfmove clock resets on pawn moves and captures; fullmove increments after Black', () => {
    const p = play(START_FEN, ['b1c3', 'b6c4']);
    expect(p.halfmove).toBe(2);
    expect(p.fullmove).toBe(2);
    p.makeMove(parseLegalCcn(p, 'a2a3'));
    expect(p.halfmove).toBe(0);
  });
});

describe('notation', () => {
  it('CCN round trip', () => {
    for (const m of Position.start().legalMoves()) expect(parseCcn(moveToCcn(m))).toBe(m);
  });
  it('SAN with check/mate markers and promotion', () => {
    const p = Position.fromFen('3k2/P5/3K2/6/6/6 w - - 0 1');
    const m = parseLegalCcn(p, 'a5a6q');
    expect(moveToSan(p, m)).toBe('a6=Q#');
    expect(parseSan(p, 'a6=Q#')).toBe(m);
  });
  it('SAN disambiguates knights', () => {
    const p = Position.fromFen('3k2/6/6/6/6/N1K1N1 w - - 0 1');
    const sans = p.legalMoves().map(m => moveToSan(p, m));
    expect(sans).toContain('Nac2');
    expect(sans).toContain('Nec2');
  });
});

describe('Crown adjudication (crown-adj-1)', () => {
  it('checkmate', () => {
    const p = Position.fromFen('3k2/6/3K2/6/6/R5 w - - 0 1');
    p.makeMove(parseLegalCcn(p, 'a1a6'));
    expect(automaticOutcome(p)).toEqual({ result: '1-0', termination: 'checkmate', winner: WHITE });
  });
  it('stalemate is a draw', () => {
    const p = Position.fromFen('k5/6/1Q4/6/6/5K b - - 0 1');
    expect(p.inCheck()).toBe(false);
    expect(p.legalMoves()).toHaveLength(0);
    expect(automaticOutcome(p)?.termination).toBe('stalemate');
  });
  it('bare kings is an automatic draw, but K+N vs K continues (declared Crown difference)', () => {
    expect(automaticOutcome(Position.fromFen('3k2/6/6/6/6/3K2 w - - 0 1'))?.termination).toBe('bare-kings');
    expect(automaticOutcome(Position.fromFen('3k2/6/6/6/6/2NK2 w - - 0 1'))).toBeNull();
  });
  it('threefold is claimable, fivefold automatic', () => {
    const cycle = ['b1c3', 'b6c4', 'c3b1', 'c4b6'];
    let p = play(START_FEN, [...cycle, ...cycle]);
    expect(p.repetitionCount()).toBe(3);
    expect(claimableDraws(p).threefold).toBe(true);
    expect(automaticOutcome(p)).toBeNull();
    p = play(START_FEN, [...cycle, ...cycle, ...cycle, ...cycle]);
    expect(p.repetitionCount()).toBe(5);
    expect(automaticOutcome(p)?.termination).toBe('fivefold-repetition');
  });
  it('100 halfmoves claimable, 150 automatic', () => {
    expect(claimableDraws(Position.fromFen('3k2/6/6/6/6/2RK2 w - - 100 80')).fiftyMove).toBe(true);
    expect(claimableDraws(Position.fromFen('3k2/6/6/6/6/2RK2 w - - 99 80')).fiftyMove).toBe(false);
    expect(automaticOutcome(Position.fromFen('3k2/6/6/6/6/2RK2 w - - 150 100'))?.termination).toBe('seventy-five-move');
  });
  it('checkmate on the 150th halfmove takes precedence over the no-progress draw', () => {
    const p = Position.fromFen('3k2/6/3K2/6/6/R5 w - - 149 100');
    p.makeMove(parseLegalCcn(p, 'a1a6'));
    expect(p.halfmove).toBe(150);
    expect(automaticOutcome(p)?.termination).toBe('checkmate');
  });
  it('timeout loses if the opponent has any non-king piece, even one that cannot mate', () => {
    const p = Position.fromFen('3k2/6/6/6/6/2NK2 b - - 0 1');
    expect(timeoutOutcome(p, BLACK)).toEqual({ result: '1-0', termination: 'timeout', winner: WHITE });
    expect(timeoutOutcome(p, WHITE)).toEqual({ result: '1/2-1/2', termination: 'timeout-vs-bare-king', winner: null });
  });
  it('draw by agreement only after each side moved ten times', () => {
    expect(agreementAllowed(19)).toBe(false);
    expect(agreementAllowed(20)).toBe(true);
  });
});

describe('metamorphic colour symmetry', () => {
  // Mirror ranks and swap colours: the legal move count must be identical.
  function mirrorFen(fen: string): string {
    const [board, side, , , h, f] = fen.split(' ');
    const rows = board.split('/').reverse().map(r => r.replace(/[a-z]/gi, c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())));
    return `${rows.join('/')} ${side === 'w' ? 'b' : 'w'} - - ${h} ${f}`;
  }
  it('mirrored positions have mirrored move counts and perft', () => {
    const fens = [START_FEN, '1r1k2/P5/6/6/6/3K2 w - - 0 1', '3r1k/6/6/6/3N2/3K2 w - - 0 1', 'r2k1r/1p3p/2n3/3Q2/PP3P/R2K1R b - - 0 1'];
    for (const fen of fens) {
      const a = Position.fromFen(fen), b = Position.fromFen(mirrorFen(fen));
      expect(perft(b, 3)).toBe(perft(a, 3));
    }
  });
});
