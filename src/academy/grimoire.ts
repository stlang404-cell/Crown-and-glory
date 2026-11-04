/**
 * The Sovereign's Grimoire in the Crown Academy (crown-grimoire-lessons-1): lesson data types, progress records,
 * spaced-repetition review, topic mastery and the daily learning plan. Everything here is pure except the small
 * storage helpers at the end, which use the existing IndexedDB `meta` store (no schema change):
 *   grim:att:<exerciseId>:<session>   one record per exercise session (outcome + solved), first write put-if-absent
 *   grim:done:<chapterId>             chapter completion, put-if-absent (idempotent, never rewritten)
 *   grim:read:<chapterId>             the chapter was read to the end, put-if-absent
 *   grim:plan                         learning-plan settings (level, daily minutes)
 * The lesson text itself is build data (src/academy/data/grimoire.json, generated from docs/grimoire by
 * tools/grimoire/lessons.ts) and is loaded lazily; grimoire-index.json holds only the ids (for the Vault and the plan).
 */
import indexJson from './data/grimoire-index.json';

export const GRIMOIRE_ID = 'crown-grimoire-lessons-1';

// ---------------------------------------------------------------- lesson data (generated)
export interface GrimoireBoard { fen: string; caption: string; line: string[]; ccn: string[]; show: 'before' | 'after'; flip: boolean; claim: string }
export type GrimoirePart = { kind: 'md'; md: string; spoiler?: boolean } | { kind: 'board'; board: GrimoireBoard } | { kind: 'exercise'; id: string };
export interface GrimoireSection { heading: string; answers: boolean; parts: GrimoirePart[] }
interface ExerciseBase {
  id: string; chapterId: string; book: number; number: 'guided' | number; fen: string; flip: boolean; caption: string; claim: string;
  /** The book's answer for this exercise (matched by exercise number), or null (the caption is shown instead). */
  answer: string | null;
  hint: string | null;
  topic: string | null;
}
export interface LineExercise extends ExerciseBase {
  kind: 'line'; source: 'puzzle' | 'best';
  /** CCN moves: the player's moves at even indices, the stored replies at odd indices. */
  solution: string[]; solutionSan: string[];
  puzzleId?: string; goal?: string; themes?: string[]; line?: string[];
}
export interface MateExercise extends ExerciseBase {
  kind: 'mate'; source: 'mate'; mateIn: number; only: boolean;
  /** Every first move that forces mate within mateIn (exhaustive proof, src/academy/mateProver.ts). */
  firstMoves: string[]; firstMovesSan: string[];
  /** The book's line (SAN), if the block gives one. */
  line: string[];
}
export type GrimoireExercise = LineExercise | MateExercise;
export interface GrimoireTopic { id: string; label: string; theme: string }
export interface GrimoireChapter {
  id: string; book: number; index: number; title: string; objectives: string[]; sections: GrimoireSection[]; exercises: GrimoireExercise[];
  topic: GrimoireTopic | null; tags: string[];
}
export interface GrimoireBook { id: string; number: number; kind: 'book' | 'appendix'; title: string; file: string; intro: GrimoirePart[]; chapters: GrimoireChapter[] }
export interface GrimoireData { id: string; prover: string; books: GrimoireBook[] }
export interface GrimoireIndex {
  id: string;
  books: { number: number; kind: 'book' | 'appendix'; title: string; chapters: { id: string; title: string; tags: string[]; topic: GrimoireTopic | null; exercises: string[]; puzzles: string[] }[] }[];
}

export const GRIMOIRE_INDEX = indexJson as unknown as GrimoireIndex;
let cache: Promise<GrimoireData> | null = null;
/** Lazy: the lesson text is its own chunk, precached by the service worker for offline use. */
export function loadGrimoire(): Promise<GrimoireData> {
  cache ??= import('./data/grimoire.json').then(m => (m.default ?? m) as unknown as GrimoireData);
  return cache;
}

export type IndexChapter = GrimoireIndex['books'][number]['chapters'][number];
export const indexChapters = (ix: GrimoireIndex = GRIMOIRE_INDEX): (IndexChapter & { book: number })[] =>
  ix.books.flatMap(b => b.chapters.map(c => ({ ...c, book: b.number })));
export const chaptersOfBook = (book: number, ix: GrimoireIndex = GRIMOIRE_INDEX) => indexChapters(ix).filter(c => c.book === book);
export const chaptersTagged = (tag: string, ix: GrimoireIndex = GRIMOIRE_INDEX) => indexChapters(ix).filter(c => c.tags.includes(tag));

// ---------------------------------------------------------------- progress records
/** first-try: solved with no wrong move and no hint; after-hint: solved after a hint; failed: a wrong move was made
 *  (the record notes whether the exercise was solved afterwards); revealed: "Show solution" (never counts as solved). */
export type GrimOutcome = 'first-try' | 'after-hint' | 'failed' | 'revealed';
export interface GrimAttempt { id: string; exerciseId: string; chapterId: string; outcome: GrimOutcome; solved: boolean; at: string; review?: boolean }
export interface GrimCompletion { chapterId: string; book: number; at: string }
export type Level = 'beginner' | 'developing' | 'intermediate' | 'advanced' | 'elite';
export const LEVELS: Level[] = ['beginner', 'developing', 'intermediate', 'advanced', 'elite'];
export const MINUTES = [10, 20, 30, 60] as const;
export interface PlanSettings { level: Level; minutes: (typeof MINUTES)[number] }
export const DEFAULT_PLAN: PlanSettings = { level: 'beginner', minutes: 20 };
export interface GrimProgress { attempts: GrimAttempt[]; completions: Map<string, GrimCompletion>; read: Set<string>; plan: PlanSettings | null }

export const ATT_PREFIX = 'grim:att:';
export const DONE_PREFIX = 'grim:done:';
export const READ_PREFIX = 'grim:read:';
export const PLAN_KEY = 'grim:plan';

export const isMiss = (o: GrimOutcome) => o !== 'first-try';
const byTime = (a: GrimAttempt, b: GrimAttempt) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id);

/** Exercises solved at least once (any outcome except a reveal). */
export function solvedSet(attempts: GrimAttempt[]): Set<string> {
  return new Set(attempts.filter(a => a.solved && a.outcome !== 'revealed').map(a => a.exerciseId));
}
/** Exercises solved first try at least once — counted once per exercise id. */
export function firstTrySet(attempts: GrimAttempt[]): Set<string> {
  return new Set(attempts.filter(a => a.outcome === 'first-try').map(a => a.exerciseId));
}
/** The first recorded outcome of each exercise (re-solving later never changes it). */
export function firstOutcomes(attempts: GrimAttempt[]): Map<string, GrimOutcome> {
  const out = new Map<string, GrimOutcome>();
  for (const a of [...attempts].sort(byTime)) if (!out.has(a.exerciseId)) out.set(a.exerciseId, a.outcome);
  return out;
}

/** A chapter is complete when every exercise is solved, or — with no exercises — when it was read to the end. */
export function chapterComplete(ch: { id: string; exercises: readonly (string | { id: string })[] }, solved: Set<string>, read: Set<string>): boolean {
  const ids = ch.exercises.map(e => (typeof e === 'string' ? e : e.id));
  return ids.length ? ids.every(id => solved.has(id)) : read.has(ch.id);
}

// ---------------------------------------------------------------- spaced repetition
export const REVIEW_DAYS = [1, 3, 7, 14];
const DAY = 86_400_000;
export interface ReviewState { exerciseId: string; stage: number; due: string; misses: number }
/**
 * Review schedule from the attempt log. A miss (anything but a first-try solve) puts the exercise in the queue due one
 * day later and resets its interval. A first-try solve made when the item is due moves it to the next interval
 * (1 → 3 → 7 → 14 days); a correct answer at the 14-day step graduates it out of the queue. Early correct answers
 * (before the due time) do not move the schedule.
 */
export function reviewSchedule(attempts: GrimAttempt[]): Map<string, ReviewState> {
  const st = new Map<string, ReviewState>();
  for (const a of [...attempts].sort(byTime)) {
    const t = Date.parse(a.at);
    const cur = st.get(a.exerciseId);
    if (isMiss(a.outcome)) { st.set(a.exerciseId, { exerciseId: a.exerciseId, stage: 0, due: new Date(t + REVIEW_DAYS[0] * DAY).toISOString(), misses: (cur?.misses ?? 0) + 1 }); continue; }
    if (!cur || t < Date.parse(cur.due)) continue;
    const stage = cur.stage + 1;
    if (stage >= REVIEW_DAYS.length) st.delete(a.exerciseId);
    else st.set(a.exerciseId, { ...cur, stage, due: new Date(t + REVIEW_DAYS[stage] * DAY).toISOString() });
  }
  return st;
}
export function dueReviews(attempts: GrimAttempt[], nowIso: string): ReviewState[] {
  const now = Date.parse(nowIso);
  return [...reviewSchedule(attempts).values()].filter(r => Date.parse(r.due) <= now).sort((a, b) => a.due.localeCompare(b.due) || a.exerciseId.localeCompare(b.exerciseId));
}

// ---------------------------------------------------------------- mastery (Book II motif chapters are the topics)
export interface TopicMastery { topic: GrimoireTopic; exercises: number; attempted: number; firstTry: number; mastery: number | null }
/** Mastery = share of the topic's attempted exercises whose most recent attempt was solved first try. */
export function topicMastery(attempts: GrimAttempt[], ix: GrimoireIndex = GRIMOIRE_INDEX): TopicMastery[] {
  const last = new Map<string, GrimAttempt>();
  for (const a of [...attempts].sort(byTime)) last.set(a.exerciseId, a);
  return indexChapters(ix).filter(c => c.topic).map(c => {
    const tried = c.exercises.filter(id => last.has(id));
    const ft = tried.filter(id => last.get(id)!.outcome === 'first-try').length;
    return { topic: c.topic!, exercises: c.exercises.length, attempted: tried.length, firstTry: ft, mastery: tried.length ? ft / tried.length : null };
  });
}
/** Topics with a record below 80 %, weakest first. */
export const weakTopics = (m: TopicMastery[]) => m.filter(t => t.mastery !== null && t.mastery < 0.8).sort((a, b) => a.mastery! - b.mastery! || b.attempted - a.attempted);

// ---------------------------------------------------------------- learning plan
export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', developing: 'Developing', intermediate: 'Intermediate', advanced: 'Advanced', elite: 'Elite' };
/** Where each level starts reading, and the practice opponent (an existing engine level) it suggests. */
export const LEVEL_PLAN: Record<Level, { book: number; opponentLevel: number }> = {
  beginner: { book: 1, opponentLevel: 1 }, developing: { book: 2, opponentLevel: 3 }, intermediate: { book: 3, opponentLevel: 4 },
  advanced: { book: 4, opponentLevel: 6 }, elite: { book: 5, opponentLevel: 8 },
};
const BUDGET: Record<number, { reviews: number; puzzles: number; game: boolean }> = {
  10: { reviews: 2, puzzles: 2, game: false }, 20: { reviews: 3, puzzles: 4, game: false }, 30: { reviews: 5, puzzles: 5, game: true }, 60: { reviews: 8, puzzles: 8, game: true },
};
export interface PlanPuzzle { id: string; themes: string[]; difficulty: number; split: string; retired?: unknown }
export interface DailyPlan {
  chapter: { id: string; title: string; book: number } | null;
  reviews: ReviewState[];
  puzzles: { theme: string; ids: string[]; reason: string } | null;
  /** A practice game: always casual (never rated), Rapid 5+3 by default; the Play screen preselects it. */
  game: { opponentLevel: number; timeControl: 'rapid'; mode: 'casual'; reason: string } | null;
}
/** Today's plan from real items: the next unread chapter, due reviews, Academy puzzles for the weakest topic, a practice game. */
export function dailyPlan(o: {
  settings: PlanSettings; progress: Pick<GrimProgress, 'attempts' | 'completions' | 'read'>; nowIso: string;
  puzzles: PlanPuzzle[]; academyAttemptIds: Set<string>; ix?: GrimoireIndex;
}): DailyPlan {
  const ix = o.ix ?? GRIMOIRE_INDEX;
  const b = BUDGET[o.settings.minutes] ?? BUDGET[20];
  const start = LEVEL_PLAN[o.settings.level].book;
  const chapters = indexChapters(ix).filter(c => ix.books.find(x => x.number === c.book)?.kind === 'book');
  const pending = (c: IndexChapter) => !o.progress.completions.has(c.id) && !o.progress.read.has(c.id);
  const next = chapters.find(c => c.book >= start && pending(c)) ?? chapters.find(pending) ?? null;
  const reviews = dueReviews(o.progress.attempts, o.nowIso).slice(0, b.reviews);
  const weak = weakTopics(topicMastery(o.progress.attempts, ix));
  const theme = weak[0]?.topic.theme ?? (next?.topic?.theme ?? null);
  let puzzles: DailyPlan['puzzles'] = null;
  if (theme) {
    const used = new Set(indexChapters(ix).flatMap(c => c.puzzles));
    const pool = o.puzzles.filter(p => !p.retired && p.split === 'training' && p.themes.includes(theme) && !used.has(p.id));
    const fresh = pool.filter(p => !o.academyAttemptIds.has(p.id));
    const pick = (fresh.length >= b.puzzles ? fresh : pool).slice().sort((x, y) => x.difficulty - y.difficulty || x.id.localeCompare(y.id)).slice(0, b.puzzles);
    if (pick.length) puzzles = { theme, ids: pick.map(p => p.id), reason: weak[0] ? `Weakest topic: ${weak[0].topic.label} (${Math.round(weak[0].mastery! * 100)}% first try over your latest attempts)` : `Practice for the chapter you are reading next` };
  }
  const game = b.game ? { opponentLevel: LEVEL_PLAN[o.settings.level].opponentLevel, timeControl: 'rapid' as const, mode: 'casual' as const, reason: `A practice game at your chosen level (${LEVEL_LABEL[o.settings.level]})` } : null;
  return { chapter: next ? { id: next.id, title: next.title, book: next.book } : null, reviews, puzzles, game };
}

/** Level suggestion from completed Academy Assessments (held-out puzzles), never a rating. */
export function suggestLevel(runs: { mode: string; endedAt: string | null; attempted: number; solved: number }[]): { level: Level; basis: string } | null {
  const done = runs.filter(r => r.mode === 'assessment' && r.endedAt && r.attempted > 0);
  if (!done.length) return null;
  const att = done.reduce((a, r) => a + r.attempted, 0), sol = done.reduce((a, r) => a + r.solved, 0);
  const rate = sol / att;
  const level: Level = rate < 0.3 ? 'beginner' : rate < 0.5 ? 'developing' : rate < 0.7 ? 'intermediate' : rate < 0.85 ? 'advanced' : 'elite';
  return { level, basis: `${sol} of ${att} held-out puzzles solved in ${done.length} Assessment${done.length > 1 ? 's' : ''} (${Math.round(rate * 100)}%)` };
}

// ---------------------------------------------------------------- Vault facts (pure)
export interface GrimoireFacts { completed: Map<string, string>; firstTry: Set<string>; firstOutcome: Map<string, GrimOutcome> }
export function grimoireFacts(input: { attempts?: GrimAttempt[]; completions?: GrimCompletion[] } | undefined): GrimoireFacts {
  const attempts = input?.attempts ?? [];
  const completed = new Map<string, string>();
  for (const c of input?.completions ?? []) if (!completed.has(c.chapterId) || c.at < completed.get(c.chapterId)!) completed.set(c.chapterId, c.at);
  return { completed, firstTry: firstTrySet(attempts), firstOutcome: firstOutcomes(attempts) };
}

// ---------------------------------------------------------------- storage (meta store)
export interface GrimMetaDB {
  metaWithPrefix<T = unknown>(prefix: string): Promise<{ key: string; value: T }[]>;
  putMetaIfAbsent(entries: { key: string; value: unknown }[]): Promise<string[]>;
  getMeta<T = unknown>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
}
export async function loadProgress(db: GrimMetaDB): Promise<GrimProgress> {
  const [att, done, read, plan] = await Promise.all([db.metaWithPrefix<GrimAttempt>(ATT_PREFIX), db.metaWithPrefix<GrimCompletion>(DONE_PREFIX), db.metaWithPrefix<{ at: string }>(READ_PREFIX), db.getMeta<PlanSettings>(PLAN_KEY)]);
  return { attempts: att.map(r => r.value), completions: new Map(done.map(r => [r.value.chapterId, r.value])), read: new Set(read.map(r => r.key.slice(READ_PREFIX.length))), plan: plan ?? null };
}
/** Write an exercise session's attempt. The first write is put-if-absent; a later write for the same session may only
 *  mark a failed attempt as solved afterwards (or turn it into a reveal) — it never turns a miss into a first-try solve. */
export async function saveAttempt(db: GrimMetaDB, a: GrimAttempt, prev?: GrimAttempt): Promise<void> {
  const key = ATT_PREFIX + a.id;
  if (!prev) { await db.putMetaIfAbsent([{ key, value: a }]); return; }
  if (prev.id !== a.id || (prev.outcome !== 'first-try' && a.outcome === 'first-try')) throw new Error('an attempt cannot become a first-try solve');
  await db.setMeta(key, a);
}
/** Record chapter completion once (put-if-absent): repeating it changes nothing. Returns true when newly written. */
export async function completeChapter(db: GrimMetaDB, chapterId: string, book: number, nowIso: string): Promise<boolean> {
  return (await db.putMetaIfAbsent([{ key: DONE_PREFIX + chapterId, value: { chapterId, book, at: nowIso } satisfies GrimCompletion }])).length > 0;
}
export async function markRead(db: GrimMetaDB, chapterId: string, nowIso: string): Promise<void> {
  await db.putMetaIfAbsent([{ key: READ_PREFIX + chapterId, value: { at: nowIso } }]);
}
export async function savePlan(db: GrimMetaDB, p: PlanSettings): Promise<void> { await db.setMeta(PLAN_KEY, p); }
