/**
 * Crown Academy (academy policy crown-academy-1).
 * Puzzles come from src/academy/data/puzzles.json (engine-verified, see tools/academy/build_puzzles.ts).
 * Practice modes use only the training split; the held-out split is reserved for Assessments and each
 * held-out item is shown at most once per player, so assessment scores are not inflated by memorisation.
 */
import type { AnalysisReport } from '../analysis/types';
import type { GameRecord } from '../games/types';
import { Position } from '../rules/position';
import { parseLegalCcn } from '../rules/notation';
import type { Motif } from './motifs';

export const ACADEMY_ID = 'crown-academy-1';

export interface Puzzle {
  id: string;
  fen: string;
  solution: string[];
  solutionSan: string[];
  playerMoves: number;
  themes: (Motif | string)[];
  motifDetails: string[];
  goal: string;
  difficulty: number;
  family: string;
  split: 'training' | 'heldout';
  verification: { crownDepth: number; gap: number; bestScore: number; secondScore: number | null; fairy: string };
  phase: string;
  /** Alternative first moves accepted as equivalent (mistake puzzles only). */
  accept?: string[];
  source?: 'corpus' | 'mistake';
  sourceGameId?: string;
  sourcePly?: number;
}

export type AcademyMode = 'tactics' | 'rush' | 'calculation' | 'defense' | 'endgame' | 'mistakes' | 'adaptive' | 'assessment';

export interface Attempt {
  id: string;
  puzzleId: string;
  mode: AcademyMode;
  split: 'training' | 'heldout' | 'mistake';
  at: string;
  solved: boolean;
  /** Solved on the first try without hints. */
  clean: boolean;
  hintsUsed: number;
  revealed: boolean;
  msToFirstMove: number;
  msTotal: number;
  firstMove: string | null;
  exposure: number; // number of earlier attempts on this puzzle
  difficulty: number;
  themes: string[];
  runId?: string;
}

export interface TrainingRun {
  id: string;
  mode: 'rush' | 'assessment';
  startedAt: string;
  endedAt: string | null;
  score: number;
  attempted: number;
  solved: number;
  durationMs: number;
  puzzleIds: string[];
}

let cache: Promise<{ id: string; engine: string; policy: string; puzzles: Puzzle[] }> | null = null;
export function loadPuzzleSet() {
  cache ??= import('./data/puzzles.json').then(m => (m.default ?? m) as unknown as { id: string; engine: string; policy: string; puzzles: Puzzle[] });
  return cache;
}

export const MODE_INFO: Record<AcademyMode, { title: string; blurb: string }> = {
  tactics: { title: 'Tactical Academy', blurb: 'Themed, engine-verified combinations with rising difficulty.' },
  rush: { title: 'Puzzle Rush', blurb: 'Three minutes, three strikes. Solve as many as you can.' },
  calculation: { title: 'Calculation Chamber', blurb: 'Lines of two or more of your moves — every reply is the engine’s best defence.' },
  defense: { title: 'Defensive Survival', blurb: 'Your position is under threat. Find the only move that holds.' },
  endgame: { title: 'Endgame Workshop', blurb: 'Endgame positions to solve, then play out against the engine.' },
  mistakes: { title: 'Replay Your Mistakes', blurb: 'Positions from your own analysed games where you went wrong.' },
  adaptive: { title: 'Adaptive Training', blurb: 'Puzzles chosen from the themes where your record is weakest.' },
  assessment: { title: 'Held-out Assessment', blurb: 'Ten unseen puzzles, never shown in practice. Measures, does not train.' },
};

export function modeFilter(mode: AcademyMode, p: Puzzle): boolean {
  if (p.split !== 'training' && mode !== 'assessment') return false;
  switch (mode) {
    case 'calculation': return p.playerMoves >= 2;
    case 'defense': return p.themes.includes('defensive') || p.goal.startsWith('Find the only move');
    case 'endgame': return p.themes.includes('endgame');
    case 'assessment': return p.split === 'heldout';
    default: return true;
  }
}

/** Per-theme practice statistics (training split only). */
export function themeStats(attempts: Attempt[], puzzles: Puzzle[]) {
  const byId = new Map(puzzles.map(p => [p.id, p]));
  const stats = new Map<string, { attempts: number; clean: number; puzzles: Set<string> }>();
  for (const a of attempts) {
    if (a.split !== 'training') continue;
    const p = byId.get(a.puzzleId);
    for (const t of p?.themes ?? a.themes) {
      const s = stats.get(t) ?? { attempts: 0, clean: 0, puzzles: new Set() };
      if (a.exposure === 0) { s.attempts++; if (a.clean) s.clean++; } // first exposures only: repeats can be memorised
      s.puzzles.add(a.puzzleId);
      stats.set(t, s);
    }
  }
  return stats;
}

/**
 * Choose the next puzzle. Unseen puzzles first; for practice modes a puzzle is repeated only after all
 * eligible puzzles were seen (and repeats are flagged with exposure > 0 so they never count as evidence).
 * Difficulty rises with clean solves in the current session.
 */
export function nextPuzzle(mode: AcademyMode, puzzles: Puzzle[], attempts: Attempt[], opts: { targetDifficulty: number; themes?: string[]; exclude?: Set<string>; rng?: () => number } ): Puzzle | null {
  const rng = opts.rng ?? Math.random;
  const seen = new Set(attempts.map(a => a.puzzleId));
  let pool = puzzles.filter(p => modeFilter(mode, p) && !opts.exclude?.has(p.id));
  if (opts.themes?.length) {
    const themed = pool.filter(p => p.themes.some(t => opts.themes!.includes(t)));
    if (themed.length) pool = themed;
  }
  if (mode === 'assessment') pool = pool.filter(p => !seen.has(p.id));
  if (!pool.length) return null;
  const unseen = pool.filter(p => !seen.has(p.id));
  const base = unseen.length ? unseen : pool;
  const dist = (p: Puzzle) => Math.abs(p.difficulty - opts.targetDifficulty);
  const best = Math.min(...base.map(dist));
  const near = base.filter(p => dist(p) === best);
  return near[Math.floor(rng() * near.length)];
}

/** Adaptive theme recommendation from practice results and coach topics in game reports. */
export function adaptiveThemes(attempts: Attempt[], puzzles: Puzzle[], reports: AnalysisReport[], games: GameRecord[]): { themes: string[]; basis: string } {
  const stats = themeStats(attempts, puzzles);
  const weak = [...stats.entries()].filter(([, s]) => s.attempts >= 5).map(([t, s]) => ({ t, rate: s.clean / s.attempts, n: s.attempts })).sort((a, b) => a.rate - b.rate);
  const topicToTheme: Record<string, string> = { 'knight-forks': 'fork', 'double-attacks': 'fork', 'hanging-pieces': 'hanging-piece', 'mating-nets': 'mate', 'threat-awareness': 'defensive', 'promotion-races': 'promotion', calculation: 'calculation' };
  const humanOf = new Map(games.map(g => [g.id, g.humanColor]));
  const topicCount = new Map<string, Set<string>>();
  for (const r of reports) for (const p of r.plies) if (p.color === humanOf.get(r.gameId)) for (const n of p.notes) {
    const th = topicToTheme[n.topic];
    if (th) { const s = topicCount.get(th) ?? new Set(); s.add(`${r.gameId}:${p.ply}`); topicCount.set(th, s); }
  }
  const fromGames = [...topicCount.entries()].sort((a, b) => b[1].size - a[1].size).filter(([, s]) => s.size >= 2).map(([t]) => t);
  const themes = [...new Set([...(weak.length ? [weak[0].t] : []), ...fromGames.slice(0, 2)])];
  if (!themes.length) return { themes: [], basis: 'Not enough history yet: mixed themes until you have at least five first-try attempts in a theme or repeated engine-verified errors in your games.' };
  const parts: string[] = [];
  if (weak.length) parts.push(`lowest first-try rate in practice: ${weak[0].t} (${Math.round(weak[0].rate * 100)}% of ${weak[0].n})`);
  if (fromGames.length) parts.push(`repeated in your games: ${fromGames.slice(0, 2).map(t => `${t} (${topicCount.get(t)!.size} moments)`).join(', ')}`);
  return { themes, basis: parts.join('; ') };
}

/** Mistake puzzles from the player's own analysed games: loss >= 0.12, non-forced, analysed position before the move. */
export function mistakePuzzles(reports: AnalysisReport[], games: GameRecord[]): Puzzle[] {
  const gameById = new Map(games.map(g => [g.id, g]));
  const latest = new Map<string, AnalysisReport>();
  for (const r of reports) { const c = latest.get(r.gameId); if (!c || r.completedAt > c.completedAt) latest.set(r.gameId, r); }
  const out: Puzzle[] = [];
  for (const r of latest.values()) {
    const g = gameById.get(r.gameId);
    if (!g) continue;
    const pos = Position.fromFen(g.initialFen);
    for (const s of g.setupMoves ?? []) pos.makeMove(parseLegalCcn(pos, s));
    const fens = [pos.toFen()];
    for (const m of g.moves) fens.push(m.fenAfter);
    for (const p of r.plies) {
      if (p.color !== g.humanColor || p.forced || p.loss === null || p.loss < 0.12) continue;
      const accept = p.candidates.filter(c => c.u >= p.best.u - 0.02).map(c => c.ccn);
      out.push({
        id: `mk-${g.id}-${p.ply}`, fen: fens[p.ply - 1], solution: [p.best.ccn], solutionSan: [p.best.san], playerMoves: 1,
        themes: p.notes.map(n => n.topic), motifDetails: p.notes.map(n => n.text), goal: `Improve on ${p.san} (you lost ${Math.round(p.loss * 100)} expected-score points)`,
        difficulty: 3, family: g.id, split: 'training', verification: { crownDepth: p.achievedDepth, gap: p.second ? +(p.best.u - p.second.u).toFixed(3) : 0, bestScore: 0, secondScore: null, fairy: 'n/a (from your game report)' },
        phase: p.phase, accept, source: 'mistake', sourceGameId: g.id, sourcePly: p.ply,
      });
    }
  }
  return out;
}

/** Validate that a puzzle line is legal from its FEN (used by tests and on load). */
export function validatePuzzle(p: Puzzle): boolean {
  try {
    const pos = Position.fromFen(p.fen);
    for (const m of p.solution) { const mv = parseLegalCcn(pos, m); if (mv < 0) return false; pos.makeMove(mv); }
    return true;
  } catch { return false; }
}
