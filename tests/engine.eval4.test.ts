import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Position } from '../src/rules';
import { OFF, NUM_PAIRS, evaluate4, setTrace, lastTraceScale, phaseOf } from '../src/engine/eval4';
import { EVAL4_WEIGHTS } from '../src/engine/evaluate';

const oracle = JSON.parse(readFileSync(new URL('./fixtures/oracle_positions.json', import.meta.url), 'utf8')).positions as { fen: string }[];

/** Mirror a position colours-and-ranks (White ↔ Black). */
function flip(fen: string): string {
  const [board, side] = fen.split(' ');
  const rows = board.split('/').reverse().map(r => [...r].map(ch => (ch >= 'a' && ch <= 'z' ? ch.toUpperCase() : ch >= 'A' && ch <= 'Z' ? ch.toLowerCase() : ch)).join(''));
  return `${rows.join('/')} ${side === 'w' ? 'b' : 'w'} - - 0 1`;
}

describe('crown-eval-4', () => {
  const sample = oracle.filter((_, i) => i % 9 === 0).slice(0, 400);
  it('the tuning trace reproduces the evaluation (linear in its parameters)', () => {
    const P = EVAL4_WEIGHTS.p;
    const tr = new Float64Array(NUM_PAIRS);
    for (const r of sample) {
      const p = Position.fromFen(r.fen);
      tr.fill(0);
      setTrace(tr);
      const stm = evaluate4(p, EVAL4_WEIGHTS);
      setTrace(null);
      const ph = phaseOf(p);
      const tsign = tr[OFF.TEMPO];
      let lin = 0;
      for (let i = 0; i < NUM_PAIRS; i++) if (i !== OFF.TEMPO && tr[i]) lin += tr[i] * (P[2 * i] * ph + P[2 * i + 1] * (20 - ph)) / 20;
      const white = lastTraceScale() * lin;
      const tempo = (P[2 * OFF.TEMPO] * ph + P[2 * OFF.TEMPO + 1] * (20 - ph)) / 20;
      const expected = (p.side === 0 ? white : -white) + Math.sign(tsign) * (p.side === 0 ? 1 : -1) * tempo;
      // mop-up (bare king) is the only non-linear term; it never applies in these positions or is small
      if (p.hasNonKingPiece(0) && p.hasNonKingPiece(1)) expect(Math.abs(stm - expected)).toBeLessThanOrEqual(1.5);
    }
  });
  it('is colour symmetric', () => {
    for (const r of sample) {
      const a = evaluate4(Position.fromFen(r.fen), EVAL4_WEIGHTS);
      const b = evaluate4(Position.fromFen(flip(r.fen)), EVAL4_WEIGHTS);
      expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
    }
  });
});
