/**
 * Game analyser: replays a stored game with the production rules and analyses every ply with the
 * Crown engine under one fixed search policy (settings), producing an immutable report.
 *
 * Per ply: (1) shallow exact screen of all legal moves, (2) full iterative search to the target
 * depth, (3) exact full-window scores at depth D and D-1 for the candidate set (top screened moves,
 * the engine's best and the played move) so the played move and alternatives share an identical
 * search policy, (4) grading/accuracy via the versioned methodology, (5) evidence-based coach notes.
 */
import { Position } from '../rules/position';
import { parseLegalCcn, moveToCcn, moveToSan, ccnLineToSan } from '../rules/notation';
import { automaticOutcome } from '../rules/adjudication';
import { Color, KING, PAWN, QUEEN, RULES_VERSION, VARIANT_ID, WHITE, moveTo } from '../rules/types';
import { Searcher, isMateScore, mateInPlies, see } from '../engine/search';
import { CANON_BUILD, CANON_EVAL_ID, CANON_OPTS, CANON_SEARCH_ID } from '../engine/canonical';
import {
  ACCURACY_ID, CALIBRATION, CRITICAL_GAP, CRITICAL_ID, GRADING_ID, LEGACY_IDS, PHASE_ID, accuracyFromLosses, expectedU, gradeForLoss, gradeMove, nextPhase, toPov,
} from './methodology';
import { COACH_ID, TOPICS, coachNotes, sacrificedMaterial } from '../academy/coach';
import type {
  AnalysisReport, AnalysisSettings, Candidate, EngineScore, Grade, Phase, PlyAnalysis, Pov, SideSummary,
} from './types';
import { GRADES } from './types';

/** Analysis runs on the canonical foundation (crown-intel-1); historical reports keep their own build id. */
export const ENGINE_BUILD = CANON_BUILD;
/** 'legacy-v1' reproduces pre-v0.5 reports exactly (crown-search-1 + crown-eval-3, grading v1); never used for new reports. */
export type AnalysisEngine = 'canonical' | 'canonical-v2' | 'legacy-v1';
const LEGACY_BUILD = 'crown-search-1+crown-eval-3';
interface Profile { opts: typeof CANON_OPTS | Record<string, never>; build: string; searchId: string; evalId: string; gradingId: string; accuracyId: string; calibration: string; v2: boolean; verifyErrors: boolean }
function profileOf(e: AnalysisEngine): Profile {
  return e === 'legacy-v1'
    ? { opts: {}, build: LEGACY_BUILD, searchId: 'crown-search-1', evalId: 'crown-eval-3', gradingId: LEGACY_IDS.v1.grading, accuracyId: LEGACY_IDS.v1.accuracy, calibration: LEGACY_IDS.v1.calibration, v2: false, verifyErrors: false }
    : e === 'canonical-v2'
      ? { opts: CANON_OPTS, build: CANON_BUILD, searchId: CANON_SEARCH_ID, evalId: CANON_EVAL_ID, gradingId: LEGACY_IDS.v2.grading, accuracyId: ACCURACY_ID, calibration: CALIBRATION, v2: true, verifyErrors: false }
      : { opts: CANON_OPTS, build: CANON_BUILD, searchId: CANON_SEARCH_ID, evalId: CANON_EVAL_ID, gradingId: GRADING_ID, accuracyId: ACCURACY_ID, calibration: CALIBRATION, v2: true, verifyErrors: true };
}

export const ANALYSIS_PRESETS: AnalysisSettings[] = [
  { id: 'quick-d5', label: 'Quick (depth 5)', depth: 5, screenDepth: 2, verifyExtra: 2, candidates: 3 },
  { id: 'std-d7', label: 'Standard (depth 7)', depth: 7, screenDepth: 3, verifyExtra: 2, candidates: 3 },
  { id: 'deep-d9', label: 'Deep (depth 9)', depth: 9, screenDepth: 4, verifyExtra: 2, candidates: 4 },
];
export const DEFAULT_ANALYSIS = ANALYSIS_PRESETS[1];

const povOf = (c: Color): Pov => (c === WHITE ? 'white' : 'black');

/** Convert an internal mover-perspective search score (or terminal state) to a typed score. */
export function typedScore(score: number, pov: Pov): EngineScore {
  if (isMateScore(score)) return { kind: 'mate', plies: mateInPlies(score), pov, proven: false };
  return { kind: 'cp', value: score, pov };
}

export interface AnalyzeInput {
  gameId: string;
  checksum: string;
  initialFen: string;
  /** Replayed (not analysed) before `moves`, e.g. training-retry history. */
  setupMoves?: string[];
  moves: string[];
  preHashes?: string[];
  postHashes?: string[];
}

export interface AnalyzeCallbacks {
  onPly?(p: PlyAnalysis, index: number, total: number): void;
  shouldStop?(): boolean;
  now?(): number;
}

export function reportId(gameId: string, checksum: string, settings: AnalysisSettings, engine: AnalysisEngine = 'canonical'): string {
  const pr = profileOf(engine);
  return `report:${gameId}:${checksum.slice(0, 12)}:${pr.build}:${settings.id}:${pr.gradingId}`;
}

function terminalScoreAfter(pos: Position, mover: Color): EngineScore | null {
  const o = automaticOutcome(pos);
  if (!o) return null;
  const pov = povOf(mover);
  if (o.winner === null) return { kind: 'terminal', outcome: 'draw', pov };
  return { kind: 'terminal', outcome: o.winner === mover ? 'win' : 'loss', pov };
}

export function analyzeGame(input: AnalyzeInput, settings: AnalysisSettings, cb: AnalyzeCallbacks = {}, searcher = new Searcher(18), engine: AnalysisEngine = 'canonical'): AnalysisReport {
  const PR = profileOf(engine);
  const O = PR.opts;
  const eu = (s: EngineScore) => expectedU(s, PR.accuracyId);
  const now = cb.now ?? (() => Date.now());
  const t0 = now();
  const startedAt = new Date().toISOString();
  searcher.newGame();
  const pos = Position.fromFen(input.initialFen);
  for (const s of input.setupMoves ?? []) {
    const m = parseLegalCcn(pos, s);
    if (m < 0) throw new Error(`Illegal setup move ${s}`);
    pos.makeMove(m);
  }
  const plies: PlyAnalysis[] = [];
  let phase: Phase = 'opening';
  let prevCaptureSquare = -1;
  let status: 'complete' | 'partial' = 'complete';

  for (let i = 0; i < input.moves.length; i++) {
    if (cb.shouldStop?.()) { status = 'partial'; break; }
    const ccn = input.moves[i];
    const playedMove = parseLegalCcn(pos, ccn);
    if (playedMove < 0) throw new Error(`Illegal move ${ccn} at ply ${i + 1} during analysis`);
    const mover = pos.side;
    const pov = povOf(mover);
    const legal = pos.legalMoves();
    const counts = pos.pieceCount();
    phase = nextPhase(phase, {
      fullmove: pos.fullmove, whiteQueens: counts.white[QUEEN], blackQueens: counts.black[QUEEN],
      minorMajor: counts.white.reduce((a, n, t) => a + (t !== PAWN && t !== KING ? n : 0), 0) + counts.black.reduce((a, n, t) => a + (t !== PAWN && t !== KING ? n : 0), 0),
    });
    const preHash = pos.hashKey();
    const D = settings.depth;
    // (1) screen
    const screen = legal.length > 1 ? searcher.scoreRootMoves(pos, legal, Math.min(settings.screenDepth, D), O) : [];
    screen.sort((a, b) => b.score - a.score);
    // (2) full search
    const full = searcher.search(pos, { limits: { depth: D }, ...O });
    const set = new Set<number>([playedMove, full.bestMove, ...screen.slice(0, settings.candidates).map(s => s.move)]);
    if (legal.length === 1) set.add(legal[0]);
    const moves = [...set].filter(m => legal.includes(m));
    // (3) exact scores at D and D-1
    const atD = searcher.scoreRootMoves(pos, moves, D, O);
    const atPrev = D > 1 ? searcher.scoreRootMoves(pos, moves, D - 1, O) : null;
    const nodes = full.nodes + atD.reduce((a, b) => a + b.nodes, 0) + (atPrev?.reduce((a, b) => a + b.nodes, 0) ?? 0);

    const legalForSan = legal;
    const mk = (m: number): Candidate => {
      const d = atD.find(x => x.move === m)!;
      const pr = atPrev?.find(x => x.move === m) ?? null;
      // Terminal states after the move are typed exactly (mate/stalemate/bare kings/etc.).
      pos.makeMove(m);
      const term = terminalScoreAfter(pos, mover);
      pos.unmakeMove();
      const score = term ?? typedScore(d.score, pov);
      const scorePrev = term ?? (pr ? typedScore(pr.score, pov) : null);
      const pv = d.pv.map(moveToCcn);
      let pvSan: string[] = [];
      try { pvSan = ccnLineToSanFrom(pos, pv); } catch { pvSan = []; }
      return { ccn: moveToCcn(m), san: moveToSan(pos, m, legalForSan), score, scorePrev, u: eu(score), pv, pvSan };
    };
    const cands = moves.map(mk).sort((a, b) => b.u - a.u || cpOf(b.score) - cpOf(a.score));
    const best = cands[0];
    const played = cands.find(c => c.ccn === ccn)!;
    const second = cands.find(c => c.ccn !== best.ccn) ?? null;
    const prevSorted = cands.filter(c => c.scorePrev).map(c => ({ c, u: eu(c.scorePrev!) })).sort((a, b) => b.u - a.u);
    const bestPrev = prevSorted[0] ?? null;
    const uBestPrev = bestPrev ? bestPrev.u : null;
    const uPlayedPrev = played.scorePrev ? eu(played.scorePrev) : null;
    const uSecondPrev = prevSorted.find(x => x.c.ccn !== (bestPrev?.c.ccn))?.u ?? null;
    const mateInvolved = best.score.kind === 'mate' || played.score.kind === 'mate';
    const mateStable = [best, played].every(c => c.score.kind !== 'mate' || (c.scorePrev?.kind === 'mate' && Math.sign(c.scorePrev.plies) === Math.sign(c.score.plies)));

    const baseInput = {
      legalCount: legal.length, uBest: best.u, uPlayed: played.u, uSecond: second?.u ?? null,
      uBestPrev, uPlayedPrev, playedIsBest: best.ccn === ccn, playedIsBestPrev: bestPrev?.c.ccn === ccn,
      mateInvolved, mateStable, sacrifice: null, uSecondPrev, v2: PR.v2,
    };
    let g = gradeMove(baseInput);
    // A capture that simply wins material on the spot (positive static exchange) is the obvious move,
    // not a "difficult" only move: it stays Best.
    if (g.grade === 'great' && pos.board[moveTo(playedMove)] !== 0 && see(pos, playedMove) > 0) {
      g.grade = 'best';
      g.reasons = ['Engine best; an immediately winning capture, so no special Great credit.'];
    }
    // Brilliant verification: only for Great moves that invest material according to the engine line.
    if (g.grade === 'great') {
      const invested = sacrificedMaterial(pos, playedMove, played.pv);
      if (invested >= 200) {
        const recapture = moveTo(playedMove) === prevCaptureSquare;
        const verifyMoves = second ? [playedMove, parseLegalCcn(pos, second.ccn)] : [playedMove];
        const ver = searcher.scoreRootMoves(pos, verifyMoves, D + settings.verifyExtra, O);
        const uP = eu(typedScore(ver[0].score, pov));
        const uS = ver[1] ? eu(typedScore(ver[1].score, pov)) : 0;
        const verified = uP >= 0.5 && uP - uS >= CRITICAL_GAP;
        g = gradeMove({ ...baseInput, sacrifice: { material: invested, verified, recapture } });
        if (!verified) g.reasons.push(`Material investment of ~${invested} cp was not confirmed at depth ${D + settings.verifyExtra}; Brilliant withheld.`);
      }
    }
    // v3: a Mistake or Blunder is confirmed by a deeper search of the played and the best move before it is shown;
    // if the deeper search finds the move less costly, the milder label is used (a shallow search may have missed
    // the move's purpose). Errors are never made harsher by this check.
    if (PR.verifyErrors && (g.grade === 'mistake' || g.grade === 'blunder') && legal.length > 1 && best.ccn !== ccn) {
      const bestMv = parseLegalCcn(pos, best.ccn);
      const ver = searcher.scoreRootMoves(pos, [playedMove, bestMv], D + settings.verifyExtra, O);
      const uP = eu(typedScore(ver[0].score, pov)), uB = eu(typedScore(ver[1].score, pov));
      const lv = Math.min(1, Math.max(0, uB - uP));
      const milder = gradeForLoss(lv);
      const rank = (x: string) => GRADES.indexOf(x as typeof GRADES[number]);
      if (Number.isFinite(lv) && rank(milder) < rank(g.grade)) {
        g = { ...g, grade: milder, loss: lv, provisional: true, reasons: [...g.reasons, `A deeper check (depth ${D + settings.verifyExtra}) found this move less costly than first measured; labelled ${milder}.`] };
      } else g.reasons.push(`Confirmed by a deeper check (depth ${D + settings.verifyExtra}).`);
    }
    const critical = legal.length >= 2 && second !== null && (best.u - second.u >= CRITICAL_GAP || (best.score.kind === 'mate' && best.score.plies > 0 && second.score.kind !== 'mate'));
    let cpLoss: number | null = null;
    if (best.score.kind === 'cp' && played.score.kind === 'cp') cpLoss = Math.max(0, best.score.value - played.score.value);
    let mateNote: string | null = null;
    if (best.score.kind === 'mate' && played.score.kind === 'mate' && best.score.plies > 0 && played.score.plies > 0 && played.score.plies > best.score.plies) {
      mateNote = `Mate preserved but slower (mate in ${Math.ceil(played.score.plies / 2)} instead of ${Math.ceil(best.score.plies / 2)}); not penalised.`;
    }
    const notes = coachNotes({ pre: pos, mover, played, best, loss: g.loss, depth: D });

    const victim = pos.board[moveTo(playedMove)];
    pos.makeMove(playedMove);
    prevCaptureSquare = victim ? moveTo(playedMove) : -1;
    const pa: PlyAnalysis = {
      ply: i + 1, color: pov, ccn, san: played.san, preHash, postHash: pos.hashKey(),
      legalCount: legal.length, forced: legal.length === 1, phase,
      requestedDepth: D, achievedDepth: D, nodes,
      best, played, second, candidates: cands,
      evalBefore: toPov(best.score, 'white'), evalAfter: toPov(played.score, 'white'),
      loss: g.loss, lossPrev: g.lossPrev, lossInterval: g.interval, cpLoss,
      grade: g.grade, gradeProvisional: g.provisional, uncertainGrades: g.uncertain, gradeReasons: g.reasons,
      critical, criticalReason: critical ? (best.score.kind === 'mate' ? 'Mate available for the side to move' : `Best move ${Math.round((best.u - second!.u) * 100)} points better than the next alternative`) : null,
      mateNote, searchInconsistency: g.inconsistency, notes,
    };
    plies.push(pa);
    cb.onPly?.(pa, i, input.moves.length);
  }
  return buildReport(input, settings, plies, status, startedAt, now() - t0, engine);
}

/** Total order key for typed scores: faster wins first, slower losses last. */
function cpOf(s: EngineScore): number {
  if (s.kind === 'cp') return s.value;
  if (s.kind === 'mate') return s.plies > 0 ? 100_000 - s.plies : -100_000 - s.plies;
  return s.outcome === 'win' ? 200_000 : s.outcome === 'loss' ? -200_000 : 0;
}

function ccnLineToSanFrom(pos: Position, pv: string[]): string[] {
  return ccnLineToSan(pos.toFen(), pv).slice(0, 12);
}

function emptyCounts(): Record<Grade, number> {
  return Object.fromEntries(GRADES.map(g => [g, 0])) as Record<Grade, number>;
}

export function summarizeSide(plies: PlyAnalysis[], pov: Pov, totalMoves: number): SideSummary {
  const mine = plies.filter(p => p.color === pov);
  const counts = emptyCounts();
  const eligibleLosses: number[] = [];
  const byPhase: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };
  let cpSum = 0, cpN = 0, bestN = 0, forced = 0, provisional = 0, critTotal = 0, critHandled = 0;
  for (const p of mine) {
    if (p.grade) counts[p.grade]++;
    if (p.forced) { forced++; continue; }
    if (p.gradeProvisional) provisional++;
    if (p.loss === null || p.grade === null) continue;
    eligibleLosses.push(p.loss);
    byPhase[p.phase].push(p.loss);
    if (p.cpLoss !== null) { cpSum += p.cpLoss; cpN++; }
    if (p.grade === 'best' || p.grade === 'great' || p.grade === 'brilliant') bestN++;
    if (p.critical) { critTotal++; if (p.loss <= 0.05) critHandled++; }
  }
  const myTotal = Math.ceil(totalMoves / 2) - (pov === 'black' ? (totalMoves % 2) : 0);
  return {
    accuracy: accuracyFromLosses(eligibleLosses),
    eligible: eligibleLosses.length,
    moves: mine.length,
    forced,
    coverage: myTotal > 0 ? mine.length / myTotal : 1,
    counts,
    avgCpLoss: cpN ? cpSum / cpN : null,
    cpLossMoves: cpN,
    bestFrequency: eligibleLosses.length ? bestN / eligibleLosses.length : null,
    phaseAccuracy: {
      opening: { accuracy: accuracyFromLosses(byPhase.opening), eligible: byPhase.opening.length },
      middlegame: { accuracy: accuracyFromLosses(byPhase.middlegame), eligible: byPhase.middlegame.length },
      endgame: { accuracy: accuracyFromLosses(byPhase.endgame), eligible: byPhase.endgame.length },
    },
    critical: { total: critTotal, handled: critHandled },
    provisionalMoves: provisional,
  };
}

export function buildReport(input: AnalyzeInput, settings: AnalysisSettings, plies: PlyAnalysis[], status: 'complete' | 'partial', startedAt: string, elapsedMs: number, engine: AnalysisEngine = 'canonical'): AnalysisReport {
  const PR = profileOf(engine);
  const total = input.moves.length;
  const state = (s: EngineScore) => { const u = expectedU(s, PR.accuracyId); return u > 0.65 ? 1 : u < 0.35 ? -1 : 0; };
  const turningPoints: number[] = [];
  let prev = 0;
  for (const p of plies) {
    const st = state(p.evalAfter);
    if (st !== prev) turningPoints.push(p.ply);
    prev = st;
  }
  const graded = plies.filter(p => p.loss !== null && !p.forced);
  const worst = graded.reduce<PlyAnalysis | null>((a, p) => (p.loss! > 0.05 && (!a || p.loss! > a.loss!) ? p : a), null);
  const miss = graded.filter(p => p.notes.some(n => n.kind === 'missed-win' || n.kind === 'missed-mate')).reduce<PlyAnalysis | null>((a, p) => (!a || p.loss! > a.loss! ? p : a), null);
  const tactic = plies.filter(p => p.grade === 'brilliant' || p.grade === 'great').reduce<PlyAnalysis | null>((a, p) => {
    const gap = p.second ? p.best.u - p.second.u : 0; const ga = a?.second ? a.best.u - a.second.u : -1;
    return !a || (p.grade === 'brilliant' && a.grade !== 'brilliant') || gap > ga ? p : a;
  }, null);
  return {
    id: reportId(input.gameId, input.checksum, settings, engine),
    schemaVersion: 1,
    gameId: input.gameId,
    gameChecksum: input.checksum,
    variantId: VARIANT_ID,
    rulesVersion: RULES_VERSION,
    engine: { searchId: PR.searchId, evalId: PR.evalId, buildId: PR.build },
    settings,
    methodology: { gradingId: PR.gradingId, accuracyId: PR.accuracyId, phaseId: PHASE_ID, criticalId: CRITICAL_ID, coachId: COACH_ID, calibration: PR.calibration, experimental: true },
    status,
    coverage: { analysed: plies.length, total },
    plies,
    summary: { white: summarizeSide(plies, 'white', total), black: summarizeSide(plies, 'black', total) },
    turningPoints,
    highlights: { worstMistake: worst?.ply ?? null, biggestMiss: miss?.ply ?? null, bestTactic: tactic?.ply ?? null },
    recommendations: [],
    startedAt,
    completedAt: new Date().toISOString(),
    elapsedMs,
  };
}

/** Training recommendations for one side, sourced only from that side's coach notes. */
export function recommendationsFor(report: AnalysisReport, pov: Pov): AnalysisReport['recommendations'] {
  const byTopic = new Map<string, number[]>();
  for (const p of report.plies) if (p.color === pov) for (const n of p.notes) {
    if (n.kind === 'good-find') continue;
    byTopic.set(n.topic, [...(byTopic.get(n.topic) ?? []), p.ply]);
  }
  const recs = [...byTopic.entries()].sort((a, b) => b[1].length - a[1].length).map(([topic, plies]) => ({
    topic, label: TOPICS[topic] ?? topic, general: false, plies: [...new Set(plies)],
    basis: `${new Set(plies).size} engine-verified moment${new Set(plies).size === 1 ? '' : 's'} in this game (single game: a tentative signal, not an established pattern).`,
  }));
  if (!recs.length) recs.push({ topic: 'calculation', label: TOPICS.calculation, general: true, plies: [], basis: 'General suggestion: no specific engine-verified weakness was found in this game.' });
  return recs;
}
