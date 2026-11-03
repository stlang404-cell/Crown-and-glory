import { describe, expect, it } from 'vitest';
import repertoire from '../src/engine/repertoire.json';
import { Position } from '../src/rules/position';
import { moveToCcn } from '../src/rules/notation';
import { bookMoves, repertoireChoice, playStyle, isValidatedStyle } from '../src/engine/styles';
import validation from '../src/engine/styles-validation.json';

const START = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const book = repertoire as unknown as { marginCp: number; positions: Record<string, [string, number][]> };

describe('opening repertoire styles (crown-styles-3)', () => {
  it('every book move is legal and within the margin of the best scored move', () => {
    for (const [key, moves] of Object.entries(book.positions)) {
      const pos = Position.fromFen(`${key} - - 0 1`);
      const legal = pos.legalMoves().map(moveToCcn);
      const best = Math.max(...moves.map(m => m[1]));
      for (const [ccn, cp] of moves) { expect(legal).toContain(ccn); expect(cp).toBeGreaterThanOrEqual(best - book.marginCp); }
    }
  });
  it('choices are seeded, always book moves, and universal/endgame never use the book', () => {
    const pos = Position.fromFen(START);
    const menu = bookMoves(pos).map(m => m.move);
    expect(menu.length).toBeGreaterThan(1);
    for (let s = 0; s < 50; s++) {
      const a = repertoireChoice('tactical', pos, s);
      expect(menu).toContain(a);
      expect(repertoireChoice('tactical', pos, s)).toBe(a);
    }
    expect(repertoireChoice('universal', pos, 1)).toBeNull();
    expect(repertoireChoice('endgame', pos, 1)).toBeNull();
  });
  it('only styles listed as validated are ever played', () => {
    const v = validation as { validated: string[] };
    for (const s of ['tactical', 'positional', 'defensive', 'endgame', 'aggressive'] as const) {
      expect(isValidatedStyle(s)).toBe(v.validated.includes(s));
      expect(playStyle(s)).toBe(v.validated.includes(s) ? s : 'universal');
    }
  });
});
