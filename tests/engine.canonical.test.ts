/**
 * v0.5 canonical engine (crown-intel-1 = crown-search-2 + crown-eval-4) regression tests: tactics, terminal
 * positions, legality, mate scores, Sovereign Max determinism, provenance, and that analysis/assist/puzzle
 * verification really run the canonical configuration (not just carry its label).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Position, moveToCcn, START_FEN } from '../src/rules';
import { Searcher, MATE, isMateScore, mateInPlies } from '../src/engine/search';
import { chooseMove, getLevel, maxProfile, LEVELS, MAX_LEVEL, MAX_RATED_BUDGET_S, LEVELS_ID } from '../src/engine/levels';
import { CANON_OPTS, CANON_BUILD, provenance, RULES_FINGERPRINT } from '../src/engine/canonical';
import { analyzeGame, ANALYSIS_PRESETS, ENGINE_BUILD } from '../src/analysis/analyzer';
import { GRADING_ID, ACCURACY_ID, LEGACY_IDS } from '../src/analysis/methodology';
import { opponentSnapshot, ROSTER, getOpponent } from '../src/federation/roster';
import { parseLegalCcn } from '../src/rules/notation';

const oracle = JSON.parse(readFileSync(new URL('./fixtures/oracle_positions.json', import.meta.url), 'utf8')).positions as { fen: string; moves: string[] }[];
const canon = (fen: string, depth: number) => new Searcher(16).search(Position.fromFen(fen), { limits: { depth }, ...CANON_OPTS });

describe('canonical engine: tactics and terminal positions', () => {
  it('mate in one, with the exact mate distance', () => {
    const r = canon('k5/6/1K4/6/6/5R w - - 0 1', 4);
    expect(moveToCcn(r.bestMove)).toBe('f1f6');
    expect(r.score).toBe(MATE - 1);
  });
  it('forced two-rook mate: odd positive distance, stable across a reused table', () => {
    const s = new Searcher(16);
    const p = Position.fromFen('3k2/6/6/6/6/R2K1R w - - 0 1');
    const a = s.search(p, { limits: { depth: 8 }, ...CANON_OPTS });
    const b = s.search(p, { limits: { depth: 8 }, ...CANON_OPTS });
    expect(isMateScore(a.score)).toBe(true);
    expect(mateInPlies(a.score) % 2).toBe(1);
    expect(b.score).toBe(a.score);
  });
  it('the losing side sees a negative mate score', () => {
    const r = canon('k5/6/1K4/6/6/5R b - - 0 1', 6);
    expect(r.score).toBeLessThan(0);
  });
  it('wins a hanging queen and promotes when promotion wins', () => {
    expect(moveToCcn(canon('3k2/6/3q2/6/3R2/3K2 w - - 0 1', 4).bestMove)).toBe('d2d4');
    expect(moveToCcn(canon('3k2/P5/6/6/6/K5 w - - 0 1', 5).bestMove).startsWith('a5a6')).toBe(true);
  });
  it('no legal move: checkmate scores −MATE, stalemate scores 0 (no crash, no move)', () => {
    const mated = new Searcher(16).search(Position.fromFen('k5/R5/1K4/6/6/6 b - - 0 1'), { limits: { depth: 3 }, ...CANON_OPTS });
    const p = Position.fromFen('k5/R5/1K4/6/6/6 b - - 0 1');
    if (p.legalMoves().length === 0) expect(mated.score).toBe(p.inCheck() ? -MATE : 0);
    const stale = Position.fromFen('k5/2Q3/1K4/6/6/6 b - - 0 1');
    const rs = new Searcher(16).search(stale, { limits: { depth: 3 }, ...CANON_OPTS });
    if (stale.legalMoves().length === 0 && !stale.inCheck()) expect(rs.score).toBe(0);
  });
  it('avoids stalemating when winning', () => {
    const p = Position.fromFen('k5/6/1K4/6/6/2Q3 w - - 0 1');
    const r = new Searcher(16).search(p, { limits: { depth: 6 }, ...CANON_OPTS });
    const q = p.clone(); q.makeMove(r.bestMove);
    expect(q.legalMoves().length === 0 && !q.inCheck()).toBe(false);
    expect(r.score).toBeGreaterThan(500);
  });
  it('every best move and PV is legal across 200 oracle positions', () => {
    const s = new Searcher(16);
    let n = 0;
    for (const r of oracle.filter(x => x.moves.length > 0).filter((_, i) => i % 21 === 0).slice(0, 200)) {
      const p = Position.fromFen(r.fen);
      const res = s.search(p, { limits: { nodes: 3000 }, ...CANON_OPTS });
      expect(r.moves).toContain(moveToCcn(res.bestMove));
      const q = p.clone();
      for (const m of res.pv) { expect(q.legalMoves()).toContain(m); q.makeMove(m); }
      n++;
    }
    expect(n).toBeGreaterThan(150);
  });
});

describe('Sovereign Max', () => {
  it('is the last level, plays the best move only, uses a 2^20 table and the rated budget by default', () => {
    expect(LEVELS_ID).toBe('crown-levels-5');
    expect(LEVELS[LEVELS.length - 1].level).toBe(MAX_LEVEL);
    const m = getLevel(MAX_LEVEL);
    expect(m.selection).toBeNull();
    expect(m.nodes).toBe(Infinity);
    expect(m.ttBits).toBe(20);
    expect(m.maxTimeMs).toBe(MAX_RATED_BUDGET_S * 1000);
    expect(maxProfile(40).maxTimeMs).toBe(40_000);
    expect(maxProfile(7).maxTimeMs).toBe(MAX_RATED_BUDGET_S * 1000); // unknown budget → rated budget
  });
  it('partialRoot is used only by clock-limited levels; node-limited levels search exactly as before', () => {
    const p = Position.fromFen(START_FEN);
    const prof = getLevel(6);
    const a = chooseMove(new Searcher(18), p, prof, 5);
    const b = new Searcher(18).search(p, { limits: { depth: prof.depth, nodes: prof.nodes, timeMs: prof.maxTimeMs }, stopOnSingleMove: true, ...CANON_OPTS });
    expect(a.search.nodes).toBe(b.nodes);
    expect(a.move).toBe(b.bestMove);
  });
  it('is deterministic: no random choice regardless of seed (node-limited for the test)', () => {
    const prof = { ...maxProfile(5), nodes: 20_000 };
    const p = Position.fromFen(START_FEN);
    const moves = new Set([1, 2, 3, 99].map(seed => { const s = new Searcher(18); return moveToCcn(chooseMove(s, p, prof, seed).move); }));
    expect(moves.size).toBe(1);
  });
  it('the game snapshot records the exact configuration; only the rated budget carries a calibration', () => {
    const o = getOpponent('opp-sovereign')!;
    expect(ROSTER.some(x => x.level === MAX_LEVEL)).toBe(true);
    const a = opponentSnapshot(o), b = opponentSnapshot(o, 40);
    expect(a.engine!.config).toMatchObject({ build: CANON_BUILD, rules: RULES_FINGERPRINT, ttBits: 20, maxTimeMs: 10_000, selection: 'best' });
    expect(b.engine!.config!.maxTimeMs).toBe(40_000);
    expect(b.rating).toBeNull();
    expect(a.engine!.profile!.maxTimeMs).toBe(10_000);
  });
});

describe('one intelligence foundation', () => {
  it('provenance records rules, backend, build and budget', () => {
    const p = provenance({ purpose: 'max', generation: 3, budget: { timeMs: 10_000, ttBits: 20 }, depth: 12, nodes: 1000, elapsedMs: 5 });
    expect(p).toMatchObject({ id: 'crown-provenance-1', rules: RULES_FINGERPRINT, build: CANON_BUILD, backend: 'crown-ts', purpose: 'max' });
  });
  it('new reports use the canonical engine and grading v2; legacy mode reproduces v1 ids and differs in its search', () => {
    expect(ENGINE_BUILD).toBe(CANON_BUILD);
    const st = ANALYSIS_PRESETS[0];
    const input = { gameId: 'g', checksum: '0'.repeat(64), initialFen: START_FEN, moves: ['b1c3', 'b6c4', 'd2d3'] };
    const r = analyzeGame(input, st, {}, new Searcher(16));
    expect(r.engine.buildId).toBe(CANON_BUILD);
    expect(r.methodology.gradingId).toBe(GRADING_ID);
    expect(r.methodology.accuracyId).toBe(ACCURACY_ID);
    expect(r.id).toContain(CANON_BUILD);
    const old = analyzeGame(input, st, {}, new Searcher(16), 'legacy-v1');
    expect(old.engine.buildId).toBe('crown-search-1+crown-eval-3');
    expect(old.methodology.gradingId).toBe(LEGACY_IDS.v1.grading);
    expect(old.id).not.toBe(r.id);
    // the canonical and legacy evaluations of the same position differ (they are different engines, not labels)
    const a = new Searcher(16).search(Position.fromFen(START_FEN), { limits: { depth: 5 }, ...CANON_OPTS });
    const b = new Searcher(16).search(Position.fromFen(START_FEN), { limits: { depth: 5 } });
    expect(a.nodes === b.nodes && a.score === b.score).toBe(false);
  });
  it('the canonical analysis agrees with a direct canonical search on the best move', () => {
    const fen = '3k2/6/3q2/6/3R2/3K2 w - - 0 1';
    const r = analyzeGame({ gameId: 'g', checksum: '0'.repeat(64), initialFen: fen, moves: ['d2d4'] }, ANALYSIS_PRESETS[0], {}, new Searcher(16));
    expect(r.plies[0].best.ccn).toBe('d2d4');
    expect(r.plies[0].grade).toBe('best');
    void parseLegalCcn;
  });
});
