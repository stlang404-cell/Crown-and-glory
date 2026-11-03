/**
 * Personal Chess Intelligence Lab — methodology crown-lab-1 (docs/M2_INTELLIGENCE_METHODOLOGY.md).
 *
 * Every number is a success rate on explicitly defined opportunities with its denominator, the games
 * it came from, and a 95% interval (game-clustered bootstrap for game evidence, Beta(1+s,1+n−s) for
 * independent first-exposure puzzles). Dimensions without enough evidence say so. Only reports of one
 * methodology (the most common grading id + engine build + settings) are aggregated; others are counted
 * as excluded. Training games and assisted games are excluded from game evidence. These are
 * chess-specific performance summaries, not IQ and not validated psychometric scores.
 */
import type { AnalysisReport, PlyAnalysis } from '../analysis/types';
import type { GameRecord } from '../games/types';
import type { RatingEvent } from '../ratings/ledger';
import type { Attempt, Puzzle, TrainingRun } from './academy';
import { Position } from '../rules/position';
import { parseLegalCcn } from '../rules/notation';
import { threatsAgainst } from './motifs';
import { mulberry32 } from '../rules/tables';

export const LAB_ID = 'crown-lab-1';
export const MIN_GAME_OPPS = 10;
export const MIN_GAMES = 3;
export const MIN_PUZZLES = 8;
export const RECURRING_MIN_OCCURRENCES = 5;
export const RECURRING_MIN_GAMES = 3;

export interface Evidence {
  source: 'games' | 'puzzles' | 'assessment';
  status: 'measured' | 'insufficient';
  s: number;
  n: number;
  games: number;
  rate: number | null;
  ci: [number, number] | null;
  refs: { gameId?: string; ply?: number; puzzleId?: string }[];
}

export interface Dimension {
  id: string;
  name: string;
  rubric: string;
  evidence: Evidence[];
  status: 'measured' | 'insufficient' | 'not-measured';
  note?: string;
}

export interface LabInput { games: GameRecord[]; reports: AnalysisReport[]; attempts: Attempt[]; puzzles: Puzzle[]; runs: TrainingRun[]; events: RatingEvent[] }

interface Item { gameId: string; game: GameRecord; report: AnalysisReport; plies: PlyAnalysis[] }

export const methodKey = (r: AnalysisReport) => `${r.methodology.gradingId} / ${r.engine.buildId} / ${r.settings.id}`;

export function eligibleItems(games: GameRecord[], reports: AnalysisReport[]): { items: Item[]; method: string | null; excluded: number } {
  const byGame = new Map<string, AnalysisReport>();
  // federation engine games (Live Arena, gameId "wg:…") are not the player's games
  for (const r of reports) if (r.status === 'complete' && !r.gameId.startsWith('wg:')) { const c = byGame.get(r.gameId); if (!c || r.completedAt > c.completedAt) byGame.set(r.gameId, r); }
  const counts = new Map<string, number>();
  for (const r of byGame.values()) counts.set(methodKey(r), (counts.get(methodKey(r)) ?? 0) + 1);
  const method = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const gameById = new Map(games.map(g => [g.id, g]));
  const items: Item[] = [];
  let excluded = 0;
  for (const r of byGame.values()) {
    const g = gameById.get(r.gameId);
    if (!g || methodKey(r) !== method || g.mode === 'training' || g.assistance.length > 0) { excluded++; continue; }
    items.push({ gameId: g.id, game: g, report: r, plies: r.plies.filter(p => p.color === g.humanColor && !p.forced && p.loss !== null) });
  }
  items.sort((a, b) => a.game.startedAt.localeCompare(b.game.startedAt));
  return { items, method, excluded };
}

function clusterCI(perGame: { s: number; n: number }[], seed = 12345, iters = 1000): [number, number] | null {
  const total = perGame.reduce((a, g) => a + g.n, 0);
  if (perGame.length < MIN_GAMES || total < MIN_GAME_OPPS) return null;
  const r = mulberry32(seed);
  const vals: number[] = [];
  for (let i = 0; i < iters; i++) {
    let s = 0, n = 0;
    for (let j = 0; j < perGame.length; j++) { const g = perGame[Math.floor((r() / 4294967296) * perGame.length)]; s += g.s; n += g.n; }
    vals.push(n ? s / n : 0);
  }
  vals.sort((a, b) => a - b);
  return [vals[Math.floor(iters * 0.025)], vals[Math.floor(iters * 0.975)]];
}

/** Beta(1+s, 1+n−s) equal-tailed 95% interval by numerical inversion. */
export function betaInterval(s: number, n: number): [number, number] {
  const a = 1 + s, b = 1 + n - s;
  const steps = 2000;
  const logB = lgamma(a) + lgamma(b) - lgamma(a + b);
  const pdf = (x: number) => Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logB);
  let acc = 0, lo = 0, hi = 1, foundLo = false;
  for (let i = 1; i < steps; i++) {
    const x = i / steps;
    acc += pdf(x) / steps;
    if (!foundLo && acc >= 0.025) { lo = x; foundLo = true; }
    if (acc >= 0.975) { hi = x; break; }
  }
  return [lo, hi];
}
function lgamma(z: number): number {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function gameEvidence(items: Item[], opp: (p: PlyAnalysis, it: Item) => boolean, ok: (p: PlyAnalysis, it: Item) => boolean): Evidence {
  const perGame: { s: number; n: number }[] = [];
  const refs: Evidence['refs'] = [];
  for (const it of items) {
    const ps = it.plies.filter(p => opp(p, it));
    if (!ps.length) continue;
    const s = ps.filter(p => ok(p, it)).length;
    perGame.push({ s, n: ps.length });
    for (const p of ps) refs.push({ gameId: it.gameId, ply: p.ply });
  }
  const n = perGame.reduce((a, g) => a + g.n, 0), s = perGame.reduce((a, g) => a + g.s, 0);
  const ci = clusterCI(perGame);
  return { source: 'games', status: ci ? 'measured' : 'insufficient', s, n, games: perGame.length, rate: n ? s / n : null, ci, refs };
}

function puzzleEvidence(attempts: Attempt[], puzzles: Puzzle[], filter: (p: Puzzle) => boolean, split: 'training' | 'heldout'): Evidence {
  const byId = new Map(puzzles.map(p => [p.id, p]));
  const first = attempts.filter(a => a.split === split && a.exposure === 0 && byId.has(a.puzzleId) && filter(byId.get(a.puzzleId)!));
  const s = first.filter(a => a.clean).length, n = first.length;
  const ok = n >= MIN_PUZZLES;
  return { source: split === 'heldout' ? 'assessment' : 'puzzles', status: ok ? 'measured' : 'insufficient', s, n, games: 0, rate: n ? s / n : null, ci: ok ? betaInterval(s, n) : null, refs: first.map(a => ({ puzzleId: a.puzzleId })) };
}

const has = (p: Puzzle, ...t: string[]) => p.themes.some(x => t.includes(x));
const tacticalNote = (p: PlyAnalysis) => p.notes.some(n => n.kind === 'missed-win' || n.kind === 'missed-mate' || n.kind === 'fork');
const allowedTactic = (p: PlyAnalysis) => p.notes.some(n => n.kind === 'hanging-piece' || n.kind === 'allowed-tactic' || n.kind === 'allowed-mate');

/** Opponent threats before each of the player's moves (static: SEE gain >= 200 or mate in one). */
export function threatenedPlies(it: Item): Set<number> {
  const out = new Set<number>();
  const pos = Position.fromFen(it.game.initialFen);
  for (const s of it.game.setupMoves ?? []) pos.makeMove(parseLegalCcn(pos, s));
  it.game.moves.forEach((m, i) => {
    const ply = i + 1;
    if ((it.game.humanColor === 'white') === (pos.side === 0) && !pos.inCheck()) {
      const t = threatsAgainst(pos, pos.side);
      if (t.bestGain >= 200 || t.mateInOne) out.add(ply);
    }
    pos.makeMove(parseLegalCcn(pos, m.ccn));
  });
  return out;
}

export function computeDimensions(input: LabInput): { dimensions: Dimension[]; method: string | null; excluded: number; gamesUsed: number } {
  const { items, method, excluded } = eligibleItems(input.games, input.reports);
  const threats = new Map(items.map(it => [it.gameId, threatenedPlies(it)]));
  const P = input.puzzles, A = input.attempts;
  const good = (p: PlyAnalysis) => (p.loss ?? 1) <= 0.05;
  const raw: Omit<Dimension, 'status'>[] = [
    { id: 'tactical', name: 'Tactical vision', rubric: 'Games: played the engine-best move where the engine line wins material or mates (coach-verified opportunity). Puzzles: first-try clean solves of fork / pin / skewer / discovered-attack / hanging-piece / mate puzzles.',
      evidence: [gameEvidence(items, p => tacticalNote(p) || (p.critical && p.best.ccn === p.ccn && p.notes.length === 0 && p.best.score.kind === 'mate'), p => p.best.ccn === p.ccn), puzzleEvidence(A, P, p => has(p, 'fork', 'pin', 'skewer', 'discovered-attack', 'hanging-piece', 'mate'), 'training')] },
    { id: 'calculation', name: 'Calculation', rubric: 'First-try clean solves of puzzles requiring two or more of your moves against best defence (verified line).',
      evidence: [puzzleEvidence(A, P, p => p.playerMoves >= 2, 'training')] },
    { id: 'positional', name: 'Positional understanding', rubric: 'Games: quiet, non-critical decisions with no tactical note where expected-score loss ≤ 0.02. Puzzles: “position evaluation” puzzles (quiet unique best move).',
      evidence: [gameEvidence(items, p => !p.critical && p.notes.length === 0 && !p.san.includes('x'), p => (p.loss ?? 1) <= 0.02), puzzleEvidence(A, P, p => has(p, 'evaluation'), 'training')] },
    { id: 'defense', name: 'Defensive awareness', rubric: 'Games: moves that did not allow an engine-verified material-winning reply or mate. Puzzles: defensive-resource puzzles.',
      evidence: [gameEvidence(items, () => true, p => !allowedTactic(p)), puzzleEvidence(A, P, p => has(p, 'defensive'), 'training')] },
    { id: 'endgame', name: 'Endgame technique', rubric: 'Games: endgame-phase decisions with loss ≤ 0.05. Puzzles: endgame puzzles.',
      evidence: [gameEvidence(items, p => p.phase === 'endgame', good), puzzleEvidence(A, P, p => has(p, 'endgame'), 'training')] },
    { id: 'threats', name: 'Threat recognition', rubric: 'Games: positions where the opponent threatened ≥ 2 pawns of material or mate in one (static check before your move); success = loss ≤ 0.05.',
      evidence: [gameEvidence(items, (p, it) => threats.get(it.gameId)!.has(p.ply), good)] },
    { id: 'opening', name: 'Opening understanding', rubric: 'Games: opening-phase decisions with loss ≤ 0.05 (no 6×6 opening theory exists; this measures soundness, not memorised lines).',
      evidence: [gameEvidence(items, p => p.phase === 'opening', good)] },
    { id: 'time', name: 'Time management', rubric: 'Timed games: critical decisions on which you spent at least your median thinking time for that game (taking time when it matters). Descriptive; speed alone is not skill.',
      evidence: [gameEvidence(items.filter(it => it.game.clocks), (p) => p.critical, (p, it) => {
        const mine = it.game.moves.filter((_, i) => (i % 2 === 0) === (it.game.humanColor === 'white')).map(m => m.elapsedMs).sort((a, b) => a - b);
        const med = mine[Math.floor(mine.length / 2)] ?? 0;
        return (it.game.moves[p.ply - 1]?.elapsedMs ?? 0) >= med;
      })] },
    { id: 'consistency', name: 'Decision consistency', rubric: 'Games: share of graded decisions without a Mistake or Blunder.',
      evidence: [gameEvidence(items, () => true, p => p.grade !== 'mistake' && p.grade !== 'blunder')] },
    { id: 'adaptability', name: 'Adaptability', rubric: 'Held-out assessments: first-exposure solve rate on unseen puzzles (never used in practice). Change over time requires two or more assessment windows.',
      evidence: [puzzleEvidence(A, P, () => true, 'heldout')] },
  ];
  const dims: Dimension[] = raw.map(d => ({ ...d, status: d.evidence.some(e => e.status === 'measured') ? 'measured' : 'insufficient' }));
  return { dimensions: dims, method, excluded, gamesUsed: items.length };
}

export interface Trend {
  perGame: { gameId: string; at: string; accuracy: number | null; blunderRate: number | null; opponent: number | null; tc: string }[];
  recent: { games: number; accuracy: number | null } | null;
  earlier: { games: number; accuracy: number | null } | null;
  difference: { value: number; ci: [number, number] } | null;
  velocity: { perTenGames: number; ci: [number, number] } | null;
  note: string;
}

/** Accuracy trend, recent-vs-earlier comparison (non-overlapping windows) and improvement velocity. */
export function computeTrend(input: LabInput, windowSize = 10): Trend {
  const { items } = eligibleItems(input.games, input.reports);
  const perGame = items.map(it => {
    const s = it.report.summary[it.game.humanColor];
    const opp = it.game.humanColor === 'white' ? it.game.black : it.game.white;
    return { gameId: it.gameId, at: it.game.startedAt, accuracy: s.accuracy, blunderRate: s.eligible ? (s.counts.blunder + s.counts.mistake) / s.eligible : null, opponent: opp.rating, tc: it.game.timeControl.id };
  }).filter(x => x.accuracy !== null);
  const acc = perGame.map(x => x.accuracy!);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  let recent = null, earlier = null, difference = null, velocity = null;
  let note = '';
  if (acc.length >= 2 * windowSize) {
    const r = acc.slice(-windowSize), e = acc.slice(0, -windowSize);
    recent = { games: r.length, accuracy: mean(r) };
    earlier = { games: e.length, accuracy: mean(e) };
    const rng = mulberry32(777);
    const diffs: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const rs = r.map(() => r[Math.floor((rng() / 4294967296) * r.length)]);
      const es = e.map(() => e[Math.floor((rng() / 4294967296) * e.length)]);
      diffs.push(mean(rs) - mean(es));
    }
    diffs.sort((a, b) => a - b);
    difference = { value: recent.accuracy - earlier.accuracy, ci: [diffs[25], diffs[974]] as [number, number] };
    // velocity: OLS slope per 10 games, bootstrap over games
    const slope = (ix: number[]) => { const xs = ix, ys = ix.map(i => acc[i]); const mx = mean(xs), my = mean(ys); const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0); return sxx ? (xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0) / sxx) * 10 : 0; };
    const idx = acc.map((_, i) => i);
    const sl: number[] = [];
    for (let i = 0; i < 1000; i++) sl.push(slope(idx.map(() => idx[Math.floor((rng() / 4294967296) * idx.length)])));
    sl.sort((a, b) => a - b);
    velocity = { perTenGames: slope(idx), ci: [sl[25], sl[974]] as [number, number] };
    const opps = perGame.map(x => x.opponent).filter((x): x is number => x !== null);
    const oppShift = opps.length >= 2 * windowSize ? mean(opps.slice(-windowSize)) - mean(opps.slice(0, -windowSize)) : 0;
    note = `Descriptive comparison of non-overlapping windows (last ${windowSize} vs earlier ${e.length} analysed games). Opponent rating changed by ${oppShift >= 0 ? '+' : ''}${Math.round(oppShift)} between windows; accuracy is not adjusted for opponent strength or time control.` +
      (difference.ci[0] > 0 ? ' The interval excludes zero (a single planned comparison, not a validated improvement claim).' : ' The interval includes zero: no reliable change.');
  } else note = `Needs at least ${2 * windowSize} analysed games of one methodology for a recent-vs-earlier comparison (have ${acc.length}).`;
  return { perGame, recent, earlier, difference, velocity, note };
}

export interface Pattern { topic: string; occurrences: number; games: number; status: 'established' | 'tentative'; refs: { gameId: string; ply: number; text: string }[]; trainingAttempts: number; effectiveness: string | null }

const TOPIC_THEME: Record<string, string[]> = {
  'knight-forks': ['fork'], 'double-attacks': ['fork', 'pin', 'skewer'], 'hanging-pieces': ['hanging-piece', 'defensive'], 'mating-nets': ['mate', 'mate-threat'],
  'threat-awareness': ['defensive'], 'promotion-races': ['promotion'], calculation: ['calculation'], 'converting-advantages': ['endgame'],
};

/** Recurring mistake patterns from coach notes on the player's own moves (≥ 5 occurrences over ≥ 3 games = established). */
export function recurringPatterns(input: LabInput): Pattern[] {
  const { items } = eligibleItems(input.games, input.reports);
  const by = new Map<string, Pattern['refs']>();
  for (const it of items) for (const p of it.plies) for (const n of p.notes) {
    if (n.kind === 'good-find') continue;
    by.set(n.topic, [...(by.get(n.topic) ?? []), { gameId: it.gameId, ply: p.ply, text: n.text }]);
  }
  const puzzleById = new Map(input.puzzles.map(p => [p.id, p]));
  return [...by.entries()].map(([topic, refs]) => {
    const games = new Set(refs.map(r => r.gameId)).size;
    const themes = TOPIC_THEME[topic] ?? [];
    const att = input.attempts.filter(a => (puzzleById.get(a.puzzleId)?.themes ?? a.themes).some(t => themes.includes(t)));
    let effectiveness: string | null = null;
    if (att.length) {
      const firstTraining = att.map(a => a.at).sort()[0];
      const before = items.filter(it => it.game.startedAt < firstTraining), after = items.filter(it => it.game.startedAt >= firstTraining);
      const rate = (set: Item[]) => { const n = set.reduce((a, it) => a + it.plies.length, 0); const k = set.reduce((a, it) => a + it.plies.filter(p => p.notes.some(x => x.topic === topic)).length, 0); return { n, k }; };
      const b = rate(before), a = rate(after);
      effectiveness = b.n >= 30 && a.n >= 30
        ? `Before training: ${b.k} per ${b.n} decisions (${(100 * b.k / b.n).toFixed(1)}%); after: ${a.k} per ${a.n} (${(100 * a.k / a.n).toFixed(1)}%). Observational — other changes (opponents, time control) are not controlled.`
        : 'Not enough games before and after training on this theme to compare (need ≥ 30 decisions each).';
    }
    return { topic, occurrences: refs.length, games, status: refs.length >= RECURRING_MIN_OCCURRENCES && games >= RECURRING_MIN_GAMES ? 'established' : 'tentative', refs, trainingAttempts: att.length, effectiveness } as Pattern;
  }).sort((a, b) => b.occurrences - a.occurrences);
}

export interface Records {
  bestAccuracy: { gameId: string; value: number } | null;
  strongestWin: { gameId: string; opponent: string; rating: number } | null;
  longestWinStreak: number;
  peakRating: { pool: string; rating: number; at: string } | null;
  bestRush: number | null;
  memorable: { gameId: string; ply: number; san: string; grade: string }[];
}

export function personalRecords(input: LabInput): Records {
  const { items } = eligibleItems(input.games, input.reports);
  let bestAccuracy: Records['bestAccuracy'] = null;
  for (const it of items) { const a = it.report.summary[it.game.humanColor].accuracy; if (a !== null && it.report.summary[it.game.humanColor].eligible >= 10 && (!bestAccuracy || a > bestAccuracy.value)) bestAccuracy = { gameId: it.gameId, value: a }; }
  const finished = input.games.filter(g => g.status === 'finalized' && g.mode !== 'training').sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const won = (g: GameRecord) => g.result !== null && g.result !== '1/2-1/2' && (g.result === '1-0') === (g.humanColor === 'white');
  let strongestWin: Records['strongestWin'] = null, streak = 0, best = 0;
  for (const g of finished) {
    const opp = g.humanColor === 'white' ? g.black : g.white;
    if (won(g)) { streak++; best = Math.max(best, streak); if (opp.rating !== null && (!strongestWin || opp.rating > strongestWin.rating)) strongestWin = { gameId: g.id, opponent: opp.name, rating: opp.rating }; } else streak = 0;
  }
  const established = input.events.filter(e => !e.provisionalAfter);
  const pk = established.reduce<RatingEvent | null>((a, e) => (!a || e.after.rating > a.after.rating ? e : a), null);
  const rush = input.runs.filter(r => r.mode === 'rush').map(r => r.score);
  const memorable: Records['memorable'] = [];
  for (const it of items) for (const p of it.report.plies) if (p.color === it.game.humanColor && (p.grade === 'brilliant' || p.grade === 'great')) memorable.push({ gameId: it.gameId, ply: p.ply, san: p.san, grade: p.grade });
  return { bestAccuracy, strongestWin, longestWinStreak: best, peakRating: pk ? { pool: pk.pool, rating: pk.after.rating, at: pk.at } : null, bestRush: rush.length ? Math.max(...rush) : null, memorable };
}
