/**
 * Crownmaster Study Match (crown-study-1): an unrated, untimed game against any engine opponent with optional,
 * individually toggleable learning aids (engine hint, best-move suggestion, evaluation display, move-quality feedback,
 * take back).
 *
 * Integrity rules (enforced here, in game state, not only by hiding buttons):
 *  - a study game is always `mode: 'casual'`, untimed, `rated: false`, `pool: null` and `context.kind: 'study'`;
 *    `createStudyGame` refuses anything else and `CrownDB.finalizeGame` never writes a rating event for it;
 *  - aids are available ONLY for an unfinished study game (`studyAidsAllowed`); rated games, ordinary casual games,
 *    Federation, training and exhibition games are refused by every command here (`assertStudyAids`);
 *  - every use of an aid is recorded on the game (`assistance`, as for the casual assistant);
 *  - study games never count toward permanent Played Like records, Vault facts, ratings, Federation results or
 *    markets (the guards live in playedLikeRecords.needsRecord, vault/facts.eligible, CrownDB.finalizeGame and
 *    FederationService.sandboxIneligible, each calling `isStudyGame`).
 */
import { createGameRecord } from '../games/session';
import { TIME_CONTROLS, type AssistanceEvent, type GameRecord, type ParticipantSnapshot } from '../games/types';
import type { EngineScore, Grade } from '../analysis/types';

export const STUDY_ID = 'crown-study-1';
/** Game ids of study matches start with this prefix (the App routes them to the Study screen). */
export const STUDY_PREFIX = 'study-';
export const STUDY_LABEL = 'Study — unrated';

export type StudyAidId = 'hint' | 'best' | 'eval' | 'feedback' | 'takeback';
export const STUDY_AIDS: { id: StudyAidId; label: string; detail: string }[] = [
  { id: 'hint', label: 'Engine Hint', detail: 'On request, highlights the piece the engine would move.' },
  { id: 'best', label: 'Best Move', detail: 'On request, shows the engine’s best move, its line and why.' },
  { id: 'eval', label: 'Evaluation', detail: 'Shows the engine evaluation bar for the position on the board.' },
  { id: 'feedback', label: 'Move Feedback', detail: 'Grades each of your moves with the standard analysis (expected-score loss).' },
  { id: 'takeback', label: 'Take Back', detail: 'Lets you take back your last move (and the reply).' },
];
export type StudyAidPrefs = Record<StudyAidId, boolean>;
export const NO_AIDS: StudyAidPrefs = { hint: false, best: false, eval: false, feedback: false, takeback: false };

/** Move-quality feedback for one of the learner's moves: engine data only (the text is templated at render). */
export interface StudyFeedback {
  ply: number;
  san: string;
  grade: Grade | null;
  /** Expected-score loss (0..1) from the standard analysis, null when the analysis gave no confident grade. */
  loss: number | null;
  provisional: boolean;
  forced: boolean;
  depth: number;
  settingsId: string;
  bestSan: string;
  bestPvSan: string[];
  playedPvSan: string[];
  /** Engine evaluations from White's view: best play before the move, and after the played move. */
  evalBefore: EngineScore;
  evalAfter: EngineScore;
  /** FEN before the learner's move (material along the lines is computed from it). */
  fenBefore: string;
  bestPv: string[];
  playedPv: string[];
}

export interface StudyState { schema: typeof STUDY_ID; aids: StudyAidPrefs; feedback: StudyFeedback[] }

export const isStudyId = (id: string | null | undefined): boolean => typeof id === 'string' && id.startsWith(STUDY_PREFIX);
/** Is this a Study Match? (context kind, with the id prefix as a second marker.) */
export function isStudyGame(g: Pick<GameRecord, 'id' | 'context'> | null | undefined): boolean {
  return !!g && (g.context?.kind === 'study' || isStudyId(g.id));
}

/** Aids are offered only for an unfinished, unrated, untimed study game. Never for any other game. */
export function studyAidsAllowed(g: GameRecord | null | undefined): boolean {
  return !!g && isStudyGame(g) && g.context.kind === 'study' && !g.rated && g.mode === 'casual' && g.pool === null &&
    g.timeControl.id === 'untimed' && g.clocks === null && g.ratingEventId === null && (g.status === 'active' || g.status === 'paused');
}

export class StudyAidRefused extends Error {}
export function assertStudyAids(g: GameRecord | null | undefined): asserts g is GameRecord {
  if (!studyAidsAllowed(g)) throw new StudyAidRefused(g?.rated ? 'Engine help is never available in rated games.' : 'Study aids are available only in an unfinished Study Match.');
}

export function newStudyId(nowMs: number, rnd: () => number = Math.random): string {
  return `${STUDY_PREFIX}${nowMs.toString(36)}-${Math.floor(rnd() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

export interface NewStudyOptions {
  id?: string;
  humanColor: 'white' | 'black';
  engine: ParticipantSnapshot;
  engineSeed: number;
  nowIso: string;
  nowMs?: number;
  aids?: Partial<StudyAidPrefs>;
}

/** A new Study Match record: casual, untimed, unrated, no pool, context "study". */
export function createStudyGame(o: NewStudyOptions): GameRecord {
  if (o.engine.kind !== 'engine' || !o.engine.engine) throw new Error('A Study Match is played against an engine opponent.');
  const id = o.id ?? newStudyId(o.nowMs ?? Date.parse(o.nowIso));
  if (!isStudyId(id)) throw new Error(`Study game ids start with "${STUDY_PREFIX}"`);
  const rec = createGameRecord({
    id, mode: 'casual', timeControl: TIME_CONTROLS.untimed, humanColor: o.humanColor,
    // the learner's rating is never snapshotted: nothing about a study game is rated
    human: { kind: 'human', id: 'player', name: 'You', rating: null, rd: null },
    engine: o.engine, engineSeed: o.engineSeed, nowIso: o.nowIso,
    context: { kind: 'study', eventName: `${STUDY_LABEL} · vs ${o.engine.name}` },
  });
  rec.study = { schema: STUDY_ID, aids: { ...NO_AIDS, ...(o.aids ?? {}) }, feedback: [] };
  if (rec.rated || rec.pool !== null || rec.clocks !== null) throw new Error('A Study Match can never be rated or timed.');
  return rec;
}

export const studyState = (g: GameRecord): StudyState => g.study ?? { schema: STUDY_ID, aids: { ...NO_AIDS }, feedback: [] };

/** Turn an aid on or off (a preference; switching it on is not itself a use). */
export function setAid(g: GameRecord, id: StudyAidId, on: boolean): void {
  assertStudyAids(g);
  const st = studyState(g);
  g.study = { ...st, aids: { ...st.aids, [id]: on } };
}

export type StudyAssistKind = Extract<AssistanceEvent['kind'], 'hint' | 'best-move' | 'evaluation' | 'feedback' | 'takeback' | 'explanation'>;
const AID_OF: Record<StudyAssistKind, StudyAidId> = { hint: 'hint', 'best-move': 'best', explanation: 'best', evaluation: 'eval', feedback: 'feedback', takeback: 'takeback' };

/**
 * Record one use of an aid. Refused (throws) unless the game is an unfinished study game and that aid is switched on.
 * `once`: do not record a second event of the same kind at the same ply (the evaluation bar refreshing).
 */
export function recordAid(g: GameRecord, kind: StudyAssistKind, nowIso: string, opts: { once?: boolean; ply?: number } = {}): boolean {
  assertStudyAids(g);
  if (!studyState(g).aids[AID_OF[kind]]) throw new StudyAidRefused(`The ${AID_OF[kind]} aid is switched off.`);
  const ply = opts.ply ?? g.moves.length;
  if (opts.once && g.assistance.some(a => a.kind === kind && a.ply === ply)) return false;
  g.assistance.push({ ply, kind, at: nowIso });
  g.pool = null;
  return true;
}

/** Store the feedback for one of the learner's moves (replacing an earlier entry for that ply). */
export function addFeedback(g: GameRecord, f: StudyFeedback, nowIso: string): void {
  recordAid(g, 'feedback', nowIso, { once: true, ply: f.ply });
  const st = studyState(g);
  g.study = { ...st, feedback: [...st.feedback.filter(x => x.ply !== f.ply), f].sort((a, b) => a.ply - b.ply) };
}

const humanMoved = (g: GameRecord, idx: number): boolean => {
  // idx is 0-based into g.moves; the side to move at idx follows from the FEN before it
  const fenBefore = idx === 0 ? null : g.moves[idx - 1].fenAfter;
  const side = fenBefore ? fenBefore.split(' ')[1] : null;
  if (side) return (side === 'w') === (g.humanColor === 'white');
  // first move of the record: side to move of the starting position (setup moves alternate from initialFen)
  const startSide = (g.initialFen.split(' ')[1] ?? 'w') === 'w' ? 0 : 1;
  const s = (startSide + (g.setupMoves?.length ?? 0)) % 2;
  return (s === 0) === (g.humanColor === 'white');
};

/** How many plies a take back would remove now (0 = nothing to take back). */
export function takeBackPlies(g: GameRecord): number {
  if (!studyAidsAllowed(g) || g.result) return 0;
  let n = 0;
  for (let i = g.moves.length - 1; i >= 0; i--) {
    n++;
    if (humanMoved(g, i)) return n;
  }
  return 0;
}

/**
 * Take back the learner's last move (and the engine's reply after it). Returns a new record; the caller rebuilds the
 * session from it. Refused for any game where aids are not allowed, when the aid is off, or when the game is over.
 */
export function takeBack(g: GameRecord, nowIso: string): GameRecord {
  assertStudyAids(g);
  const n = takeBackPlies(g);
  if (n === 0) throw new StudyAidRefused('There is no move of yours to take back.');
  const next = structuredClone(g);
  recordAid(next, 'takeback', nowIso);
  next.moves = next.moves.slice(0, next.moves.length - n);
  const st = studyState(next);
  next.study = { ...st, feedback: st.feedback.filter(f => f.ply <= next.moves.length) };
  if (next.moves.length < 2) next.opening = null;
  next.status = 'active';
  return next;
}

/** The label of a game's mode for headers, the game library and replays. */
export function gameModeLabel(g: Pick<GameRecord, 'id' | 'context' | 'mode' | 'rated'>): string {
  if (isStudyGame(g)) return STUDY_LABEL;
  return g.mode === 'training' ? 'Training' : g.rated ? 'Rated' : 'Casual';
}
