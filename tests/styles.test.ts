import { describe, expect, it } from 'vitest';
import repertoire from '../src/engine/repertoire.json';
import { Position } from '../src/rules/position';
import { moveToCcn } from '../src/rules/notation';
import { bookMoves, repertoireChoice, playStyle, isValidatedStyle } from '../src/engine/styles';
import validation from '../src/engine/styles-validation.json';
import { evaluate, PLAY_WEIGHTS } from '../src/engine/evaluate';
import type { EvalWeights } from '../src/engine/evaluate';
import { styledWeights, STYLE_EVAL, usesStyleEval, styleTendency, STYLE_LABEL } from '../src/engine/styles';
import { STYLES } from '../src/federation/generator';
import { chooseMove } from '../src/engine/levels';
import { Searcher } from '../src/engine/search';
import type { StyleId } from '../src/federation/model';

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
    for (const s of ['tactical', 'positional', 'defensive', 'endgame', 'aggressive', 'gambiteer', 'materialist', 'complicator'] as const) {
      expect(isValidatedStyle(s)).toBe(v.validated.includes(s));
      expect(playStyle(s)).toBe(v.validated.includes(s) ? s : 'universal');
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// crown-styles-5: full-game styled evaluation (src/engine/styles.ts STYLE_EVAL; docs/STYLES_REPORT.md)

const ALL: StyleId[] = ['tactical', 'positional', 'aggressive', 'defensive', 'endgame', 'gambiteer', 'materialist', 'complicator'];
/** White-view evaluation with `style` playing White (universal = the unstyled play weights). */
const ev = (style: StyleId, fen: string, color: 0 | 1 = 0) => {
  const p = Position.fromFen(fen);
  const w: EvalWeights = style === 'universal' ? PLAY_WEIGHTS : { ...styledWeights(style, PLAY_WEIGHTS)!.weights, styleColor: color } as EvalWeights;
  const v = evaluate(p, w);
  return p.side === 0 ? v : -v;
};
/** How much more the style prefers position a over b than Universal does (cp, White view). */
const pref = (style: StyleId, a: string, b: string) => (ev(style, a) - ev(style, b)) - (ev('universal', a) - ev('universal', b));
/** Colour-flipped FEN (ranks mirrored, colours swapped). */
const flip = (fen: string) => { const [b, s] = fen.split(' '); return `${b.split('/').reverse().map(r => r.replace(/[a-z]/gi, c => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()))).join('/')} ${s === 'w' ? 'b' : 'w'} - - 0 1`; };

const FENS = {
  // White queen + knight bearing on the black king's zone vs the same pieces at home
  attack: ['3k2/ppp1pp/6/2Q1N1/PPP1PP/3K2 w - - 0 1', '3k2/ppp1pp/6/6/PPP1PP/QN1K2 w - - 0 1'],
  // Black queen + knight bearing on the white king's zone vs the same pieces far away
  underAttack: ['2rk2/1pp1pp/6/2q1n1/PPPPPP/R1NKNR w - - 0 1', '2rk2/qnp1pp/1p4/6/PPPPPP/R1NKNR w - - 0 1'],
  // queens on vs queens traded (otherwise identical)
  queensOn: ['rnqk1r/pppppp/6/6/PPPPPP/RNQK1R w - - 0 1', 'rn1k1r/pppppp/6/6/PPPPPP/RN1K1R w - - 0 1'],
  // free passed pawn vs blocked pawn (pawn endgame)
  passer: ['3k2/6/6/3P2/6/2K3 w - - 0 1', '3k2/6/3p2/3P2/6/2K3 w - - 0 1'],
  // a knight up: rooks traded vs rooks on
  simplify: ['3k2/1pp3/6/6/1PPP2/2K2N w - - 0 1', 'r2k2/1pp3/6/6/1PPP2/R1K2N w - - 0 1'],
  // White rook attacks an undefended black knight vs not
  hanging: ['k5/p4p/6/3n2/PP3P/3RK1 w - - 0 1', 'k5/p4p/6/3n2/PP3P/R3K1 w - - 0 1'],
  // active (central) king vs passive king in a pawn ending
  activeKing: ['3k2/2p3/6/2K3/3P2/6 w - - 0 1', '3k2/2p3/6/6/3P2/K5 w - - 0 1'],
} as const;

describe('full-game styles (crown-styles-5)', () => {
  it('universal and the default play weights are unchanged', () => {
    const before = Int32Array.from((PLAY_WEIGHTS as { p: Int32Array }).p);
    const vals = Object.values(FENS).flat().map(f => evaluate(Position.fromFen(f), PLAY_WEIGHTS));
    for (const s of ALL) styledWeights(s, PLAY_WEIGHTS);
    expect(Int32Array.from((PLAY_WEIGHTS as { p: Int32Array }).p)).toEqual(before);
    expect(Object.values(FENS).flat().map(f => evaluate(Position.fromFen(f), PLAY_WEIGHTS))).toEqual(vals);
    expect(styledWeights('universal', PLAY_WEIGHTS)).toBeNull();
    expect(usesStyleEval('universal')).toBe(false);
    // chooseMove with style 'universal' is the plain engine
    const prof = { level: 0, id: 't', name: 't', depth: 64, nodes: 3000, maxTimeMs: 60_000, selection: null, description: '' };
    const p = Position.fromFen(FENS.underAttack[0]);
    const a = chooseMove(new Searcher(14), p, prof, 1), b = chooseMove(new Searcher(14), p, prof, 1, undefined, undefined, 'universal', true);
    expect(b.move).toBe(a.move); expect(b.search.score).toBe(a.search.score); expect(b.search.nodes).toBe(a.search.nodes);
  });
  it('styled weights apply to the styled side only (colour symmetric)', () => {
    for (const s of ALL) for (const f of Object.values(FENS).flat()) expect(ev(s, f, 0)).toBe(-ev(s, flip(f), 1));
    // the unstyled side sees no change: a styled Black does not alter White's attack terms
    // (tactical has own-term changes only; crown-styles-6 aggressive also changes how it sees the opponent's attack)
    expect(ev('tactical', FENS.attack[0], 1) - ev('tactical', FENS.attack[1], 1)).toBe(ev('universal', FENS.attack[0]) - ev('universal', FENS.attack[1]));
    expect(pref('aggressive', ...FENS.underAttack)).toBeLessThan(0);
  });
  it('aggressive values its own king attack more and avoids draws', () => {
    expect(pref('aggressive', ...FENS.attack)).toBeGreaterThan(10);
    expect(STYLE_EVAL.aggressive!.contempt).toBeGreaterThan(0);
  });
  it('defensive fears the opponent attack more, welcomes queen trades and accepts draws', () => {
    expect(pref('defensive', ...FENS.underAttack)).toBeLessThan(-20);
    expect(pref('defensive', ...FENS.queensOn)).toBeLessThan(-10);
    expect(STYLE_EVAL.defensive!.contempt).toBeLessThan(0);
  });
  it('endgame technician values passed pawns, an active king and trades when ahead', () => {
    expect(pref('endgame', ...FENS.passer)).toBeGreaterThan(40);
    expect(pref('endgame', ...FENS.activeKing)).toBeGreaterThan(5);
    expect(pref('endgame', ...FENS.simplify)).toBeGreaterThan(5);
    expect(pref('endgame', ...FENS.queensOn)).toBeLessThan(-10);
  });
  it('tactical values threats on enemy pieces more; positional less', () => {
    expect(pref('tactical', ...FENS.hanging)).toBeGreaterThan(5);
    expect(pref('positional', ...FENS.hanging)).toBeLessThan(0);
  });
  it('every style plays legal moves', () => {
    const prof = { level: 0, id: 't', name: 't', depth: 64, nodes: 2000, maxTimeMs: 60_000, selection: null, description: '' };
    for (const s of ALL) for (const f of [START, FENS.underAttack[0], FENS.simplify[0], FENS.passer[0]]) {
      const p = Position.fromFen(f);
      expect(p.legalMoves()).toContain(chooseMove(new Searcher(14), p, prof, 3, undefined, undefined, s, true).move);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// crown-styles-6: Aggressive redesign, new styles, scouting tendencies (docs/STYLES_REPORT.md §8)
describe('crown-styles-6', () => {
  const V = validation as unknown as { fullGame: string[]; fullGameResults: Record<string, { games: { games: number } }> };
  it('every style has a label and an evaluation profile', () => {
    for (const s of ALL) { expect(STYLE_LABEL[s]).toBeTruthy(); expect(STYLE_EVAL[s]).toBeDefined(); }
  });
  it('scouting tendencies exist exactly for the styles that are played, and quote the measurement', () => {
    expect(styleTendency('universal')).toBeNull();
    for (const s of ALL) {
      const t = styleTendency(s);
      if (!V.fullGame.includes(s)) { expect(t).toBeNull(); continue; }
      expect(t).toBeTruthy();
      expect(t).toContain(`${V.fullGameResults[s].games.games} games`);
      expect(t).not.toMatch(/NaN|undefined/);
    }
  });
  it('the generator assigns a crown-styles-6 style only once it is validated', () => {
    const legacy = ['universal', 'tactical', 'positional', 'defensive', 'endgame', 'aggressive'];
    for (const s of STYLES) expect(legacy.includes(s) || V.fullGame.includes(s)).toBe(true);
  });
  it('the materialist and gambiteer judge material in opposite directions', () => {
    // White a pawn down in the middlegame: the materialist minds it more than Universal, the gambiteer less
    const fens = ['rnqknr/pppppp/6/6/PP1PPP/RNQKNR w - - 0 1', START] as const;
    expect(pref('materialist', ...fens)).toBeLessThan(-3);
    expect(pref('gambiteer', ...fens)).toBeGreaterThan(3);
  });
});
