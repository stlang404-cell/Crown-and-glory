/** Reproduces the research package's own fixtures (data/replay_fixtures.json, data/positions.json)
 *  against the production rules: 20 full games, every applied move legal and every state identical. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Position, encodeMove, KNIGHT, QUEEN, ROOK, WHITE, pieceChar } from '../src/rules';

type St = { board: string; side: number; half: number };
const games = JSON.parse(readFileSync(new URL('./fixtures/research/replay_fixtures.json', import.meta.url), 'utf8')) as { game: string; moves: [number, number, string][]; states: St[] }[];
const positions = JSON.parse(readFileSync(new URL('./fixtures/research/positions.json', import.meta.url), 'utf8')) as St[];
const PROMO: Record<string, number> = { Q: QUEEN, R: ROOK, N: KNIGHT, q: QUEEN, r: ROOK, n: KNIGHT };

const boardString = (p: Position) => Array.from(p.board, pieceChar).join('');
/** Research encoding: a1-first flat string, uppercase = White; side 1 = White to move, -1 = Black. */
function fromResearch(s: St): Position {
  const rows: string[] = [];
  for (let r = 5; r >= 0; r--) {
    let row = '', e = 0;
    for (let f = 0; f < 6; f++) { const c = s.board[r * 6 + f]; if (c === '.') e++; else { if (e) { row += e; e = 0; } row += c; } }
    if (e) row += e;
    rows.push(row);
  }
  return Position.fromFen(`${rows.join('/')} ${s.side === 1 ? 'w' : 'b'} - - ${s.half} 1`);
}

describe('research package fixtures', () => {
  it(`replays all ${games.length} research games with identical states`, () => {
    let plies = 0;
    for (const g of games) {
      const p = fromResearch(g.states[0]);
      g.moves.forEach(([from, to, promo], i) => {
        const m = encodeMove(from, to, promo ? PROMO[promo] : 0);
        expect(p.legalMoves()).toContain(m);
        p.makeMove(m);
        const exp = g.states[i + 1];
        expect(boardString(p)).toBe(exp.board);
        expect(p.side === WHITE ? 1 : -1).toBe(exp.side);
        expect(p.halfmove).toBe(exp.half);
        plies++;
      });
    }
    expect(plies).toBeGreaterThan(1000);
  });
  it('loads every benchmark position', () => {
    for (const s of positions) expect(() => fromResearch(s)).not.toThrow();
  });
});
