/**
 * Gate E: a 100-game history (real legal games between Crown engine configurations, real engine reports,
 * real rating events and puzzle attempts) must yield coherent, traceable Lab output with no fabricated
 * measurements. The "player" is a node-budgeted engine whose budget grows over time (simulated learning).
 */
import { describe, expect, it } from 'vitest';
import { Searcher } from '../src/engine/search';
import { GameSession, createGameRecord } from '../src/games/session';
import { TIME_CONTROLS, GameRecord, legacyPoolFor } from '../src/games/types';
import { moveToCcn } from '../src/rules/notation';
import { analyzeGame } from '../src/analysis/analyzer';
import type { AnalysisReport, AnalysisSettings } from '../src/analysis/types';
import { computeRatingEvent, newPoolState, RatingEvent } from '../src/ratings/ledger';
import { computeDimensions, computeTrend, recurringPatterns, personalRecords, eligibleItems, MIN_GAME_OPPS } from '../src/academy/lab';
import puzzleSet from '../src/academy/data/puzzles.json';
import type { Attempt, Puzzle } from '../src/academy/academy';

const tiny: AnalysisSettings = { id: 'test-d2', label: 'test', depth: 2, screenDepth: 1, verifyExtra: 1, candidates: 2 };
const other: AnalysisSettings = { ...tiny, id: 'test-d3', depth: 3 };

function playGame(i: number, humanNodes: number, oppNodes: number): GameRecord {
  const humanColor = i % 2 ? 'white' : 'black';
  const tc = i % 3 === 0 ? TIME_CONTROLS.blitz : TIME_CONTROLS.rapid;
  const rec = createGameRecord({
    id: `h${String(i).padStart(3, '0')}`, mode: 'rated', timeControl: tc, humanColor,
    human: { kind: 'human', id: 'player', name: 'You', rating: 1500, rd: 100 },
    engine: { kind: 'engine', id: `opp${i % 4}`, name: `Opponent ${i % 4}`, rating: 1300 + (i % 4) * 100, rd: 50 },
    engineSeed: i, nowIso: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
  });
  // a pre-v1.1 development history: these legacy controls were rated in their own pools then (new games are casual)
  Object.assign(rec, { mode: 'rated', rated: true, pool: legacyPoolFor(tc.id) });
  const s = new GameSession(rec);
  const se = new Searcher(14);
  let t = 0;
  s.start(0);
  while (!s.isOver && s.plies < 160) {
    const human = s.sideToMove === s.humanColor;
    const r = se.search(s.pos, { limits: { nodes: human ? humanNodes : oppNodes } });
    t += human ? 1000 + ((i * 7 + s.plies) % 9) * 900 : 800;
    s.applyMove(moveToCcn(r.bestMove), t, 'T');
  }
  if (!s.isOver) s.resign(s.sideToMove, t, 'T');
  const g = s.snapshot();
  g.status = 'finalized';
  return g;
}

describe('100-game development history (Gate E)', () => {
  const games: GameRecord[] = [];
  const reports: AnalysisReport[] = [];
  const events: RatingEvent[] = [];
  it('builds 100 legal games with reports and rating events', async () => {
    let pool = newPoolState('rapid'), blitz = newPoolState('blitz');
    for (let i = 0; i < 100; i++) {
      await new Promise(r => setTimeout(r, 0)); // keep the test worker responsive
      const g = playGame(i, 150 + i * 25, 900);
      if (i >= 95) { g.assistance.push({ ply: 2, kind: 'hint', at: 'T' }); g.rated = false; g.mode = 'casual'; }
      games.push(g);
      const settings = i < 10 ? other : tiny; // 10 reports use a different methodology
      reports.push(analyzeGame({ gameId: g.id, checksum: 'c'.repeat(64), initialFen: g.initialFen, moves: g.moves.map(m => m.ccn) }, settings));
      if (g.rated) {
        const sc = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.humanColor === 'white') ? 1 : 0;
        const opp = g.humanColor === 'white' ? g.black : g.white;
        const st = g.timeControl.id === 'blitz' ? blitz : pool;
        const r = computeRatingEvent(st, g.id, g.startedAt, { id: opp.id, name: opp.name, rating: opp.rating!, rd: opp.rd!, calibrationId: 'test' }, sc);
        events.push(r.event);
        if (g.timeControl.id === 'blitz') blitz = r.next; else pool = r.next;
      }
    }
    expect(games).toHaveLength(100);
    expect(new Set(events.map(e => e.pool))).toEqual(new Set(['rapid', 'blitz']));
  }, 300_000);

  it('produces coherent, traceable dimensions and excludes incompatible / assisted games', () => {
    const puzzles = (puzzleSet as unknown as { puzzles: Puzzle[] }).puzzles;
    const attempts: Attempt[] = puzzles.slice(0, 12).map((p, k) => ({
      id: `a${k}`, puzzleId: p.id, mode: 'tactics', split: p.split, at: `2026-03-0${(k % 9) + 1}T00:00:00Z`, solved: k % 3 !== 0, clean: k % 3 !== 0,
      hintsUsed: 0, revealed: false, msToFirstMove: 5000, msTotal: 8000, firstMove: null, exposure: 0, difficulty: p.difficulty, themes: p.themes as string[],
    }));
    const input = { games, reports, attempts, puzzles, runs: [], events };
    const { dimensions, excluded, gamesUsed, method } = computeDimensions(input);
    expect(method).toContain('test-d2');
    expect(excluded).toBe(15); // 10 other-method reports + 5 assisted games
    expect(gamesUsed).toBe(85);
    expect(dimensions).toHaveLength(10);
    const reportBy = new Map(reports.map(r => [r.gameId, r]));
    for (const d of dimensions) {
      for (const e of d.evidence) {
        expect(e.s).toBeLessThanOrEqual(e.n);
        if (e.rate !== null) { expect(e.rate).toBeGreaterThanOrEqual(0); expect(e.rate).toBeLessThanOrEqual(1); }
        expect(e.refs).toHaveLength(e.n); // every opportunity is traceable
        for (const r of e.refs) if (r.gameId) expect(reportBy.get(r.gameId)!.plies.some(p => p.ply === r.ply)).toBe(true);
        if (e.status === 'measured') { expect(e.ci).not.toBeNull(); expect(e.ci![0]).toBeLessThanOrEqual(e.rate!); expect(e.ci![1]).toBeGreaterThanOrEqual(e.rate!); }
        else expect(e.ci).toBeNull();
        if (e.source === 'games' && e.status === 'measured') { expect(e.n).toBeGreaterThanOrEqual(MIN_GAME_OPPS); expect(e.games).toBeGreaterThanOrEqual(3); }
      }
    }
    // consistency is recomputable by hand from the reports
    const cons = dimensions.find(d => d.id === 'consistency')!.evidence[0];
    const { items } = eligibleItems(games, reports);
    const manual = items.flatMap(it => it.plies).filter(p => p.grade !== 'mistake' && p.grade !== 'blunder').length;
    expect(cons.s).toBe(manual);
    // 12 attempts are fewer than the puzzle minimum per theme → puzzle-only dimension stays insufficient
    expect(dimensions.find(d => d.id === 'calculation')!.status).toBe('insufficient');
  });

  it('trend, velocity, recurring patterns and records are defined and honest', () => {
    const input = { games, reports, attempts: [], puzzles: [], runs: [], events };
    const t = computeTrend(input);
    expect(t.perGame.length).toBe(85);
    expect(t.difference).not.toBeNull();
    expect(Number.isFinite(t.velocity!.perTenGames)).toBe(true);
    expect(t.difference!.ci[0]).toBeLessThanOrEqual(t.difference!.ci[1]);
    for (const p of recurringPatterns(input)) {
      expect(p.status === 'established').toBe(p.occurrences >= 5 && p.games >= 3);
      expect(p.refs).toHaveLength(p.occurrences);
    }
    const rec = personalRecords(input);
    expect(rec.longestWinStreak).toBeGreaterThanOrEqual(0);
    if (rec.bestAccuracy) expect(games.some(g => g.id === rec.bestAccuracy!.gameId)).toBe(true);
  });

  it('a near-empty history reports insufficient evidence everywhere instead of numbers', () => {
    const d = computeDimensions({ games: games.slice(20, 22), reports: reports.filter(r => ['h020', 'h021'].includes(r.gameId)), attempts: [], puzzles: [], runs: [], events: [] });
    for (const dim of d.dimensions) expect(dim.status).toBe('insufficient');
  });
});
