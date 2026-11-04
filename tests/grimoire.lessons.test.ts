/**
 * The Sovereign's Grimoire in the Academy: the lesson data can never drift from the book, every exercise has a legal,
 * solvable target checked the same way the book's claims were proven, progress and spaced repetition behave as
 * documented, chapter completion is idempotent, and the Grimoire achievements cannot be farmed.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { OUT_DATA, OUT_INDEX, buildGrimoire, parseAnswers, serialize, slug } from '../tools/grimoire/lessons';
import {
  ATT_PREFIX, GRIMOIRE_INDEX, chapterComplete, chaptersOfBook, chaptersTagged, completeChapter, dailyPlan, dueReviews, firstOutcomes, indexChapters, loadProgress,
  markRead, reviewSchedule, saveAttempt, solvedSet, suggestLevel, topicMastery, type GrimAttempt, type GrimOutcome, type GrimoireData,
} from '../src/academy/grimoire';
import { matingFirstMoves, moveMates, stubbornDefence } from '../src/academy/mateProver';
import { Position } from '../src/rules/position';
import { moveToCcn, parseLegalCcn, parseSan } from '../src/rules/notation';
import { Markdown } from '../src/ui/Markdown';
import { CrownDB } from '../src/storage/db';
import { buildFacts } from '../src/vault/facts';
import { evaluateDef, vaultDef } from '../src/vault/catalog';

const built = buildGrimoire();
const data: GrimoireData = built.data;
const exercises = data.books.flatMap(b => b.chapters.flatMap(c => c.exercises));
const puzzles = new Map((JSON.parse(readFileSync('src/academy/data/puzzles.json', 'utf8')).puzzles as { id: string; fen: string; solution: string[]; split: string; themes: string[]; difficulty: number }[]).map(p => [p.id, p]));

describe('Grimoire lesson data (generated from docs/grimoire)', () => {
  it('the committed grimoire.json and grimoire-index.json equal a fresh generation from the book', () => {
    expect(readFileSync(OUT_DATA, 'utf8') === serialize(built.data), `${OUT_DATA} is stale: run npx tsx tools/grimoire/lessons.ts`).toBe(true);
    expect(readFileSync(OUT_INDEX, 'utf8') === serialize(built.index), `${OUT_INDEX} is stale: run npx tsx tools/grimoire/lessons.ts`).toBe(true);
    expect(GRIMOIRE_INDEX).toEqual(built.index);
  });
  it('has six books and the two appendices, with stable unique chapter and exercise ids', () => {
    expect(data.books.filter(b => b.kind === 'book').map(b => b.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(data.books.filter(b => b.kind === 'appendix')).toHaveLength(2);
    const chapterIds = data.books.flatMap(b => b.chapters.map(c => c.id));
    expect(new Set(chapterIds).size).toBe(chapterIds.length);
    expect(new Set(exercises.map(e => e.id)).size).toBe(exercises.length);
    expect(chapterIds).toContain('b2-1-double-attacks-and-forks');
    for (const id of chapterIds) expect(id).toMatch(/^b\d-[a-z0-9-]+$/);
    expect(chaptersOfBook(2)).toHaveLength(11);
    expect(exercises.length).toBeGreaterThan(100);
  });
  it('every book chapter has objectives and prose; no raw HTML or text diagrams survive in the prose', () => {
    for (const b of data.books.filter(x => x.kind === 'book')) for (const c of b.chapters) {
      if (/^Chapter/.test(c.title)) expect(c.objectives.length, c.id).toBeGreaterThan(0);
      const md = c.sections.flatMap(s => s.parts).filter(p => p.kind === 'md').map(p => (p as { md: string }).md).join('\n');
      expect(md.length).toBeGreaterThan(200);
      expect(md).not.toMatch(/<!--|```crown|┌─/);
    }
  });
  it('exercises are exactly the interactive crown blocks in Guided / Independent exercise sections', () => {
    const src = data.books.flatMap(b => readFileSync(b.file, 'utf8').split('\n'));
    let h3 = '', count = 0;
    for (let i = 0; i < src.length; i++) {
      if (src[i].startsWith('### ')) h3 = src[i];
      if (src[i].startsWith('## ')) h3 = '';
      if (src[i].trim() !== '```crown') continue;
      let claim = 'legal';
      for (let j = i + 1; src[j].trim() !== '```'; j++) { const m = /^\s*claim:\s*(.*)$/.exec(src[j]); if (m) claim = m[1]; }
      if (/Guided exercise|Independent exercises/.test(h3) && /^(puzzle|best|(only-)?mate-in-\d)\b/.test(claim)) count++;
    }
    expect(exercises).toHaveLength(count);
  });
  it('every exercise is associated with the book’s answer (by exercise number) or shows its caption', () => {
    for (const e of exercises) expect((e.answer ?? e.caption).length, e.id).toBeGreaterThan(5);
    expect(exercises.filter(e => e.answer).length / exercises.length).toBeGreaterThan(0.9);
    const forks = data.books[1].chapters[0];
    expect(forks.exercises.map(e => e.number)).toEqual(['guided', 1, 2, 3]);
    expect(forks.exercises[0].answer).toMatch(/^`Qc6\+`/);
    expect(forks.exercises[2].answer).toMatch(/^`d2\+`/);
  });
  it('parses the answer formats the books use', () => {
    const a = parseAnswers(['- **Guided (pz-1):** `Qc6+`. Check.', '- **2 (pz-1c8fjp0):** `Rxb4`.', '* **V.1.2:** **1.Qxe4+!** only move.', '  continued', '3. `4...Qb5`. Safe.', '* **Exercise 4:** compare.'].join('\n'));
    expect(a.get('guided')).toContain('Qc6+');
    expect(a.get('2')).toContain('Rxb4');
    expect(a.get('2')).not.toContain('Qxe4');
    expect(a.get('3')).toBe('`4...Qb5`. Safe.');
    expect(a.get('4')).toBe('compare.');
    expect([...a.keys()]).toContain('2');
    expect(slug('Chapter III.1 — The First Ten Doors')).toBe('chapter-iii-1-the-first-ten-doors');
  });
});

describe('Grimoire exercises: legal, solvable targets', () => {
  it('puzzle exercises replay the verified Academy line legally from the same FEN', () => {
    for (const e of exercises.filter(x => x.kind === 'line' && x.source === 'puzzle')) {
      if (e.kind !== 'line') continue;
      const p = puzzles.get(e.puzzleId!)!;
      expect(p, e.id).toBeTruthy();
      expect(p.fen).toBe(e.fen);
      expect(e.solution).toEqual(p.solution);
      const pos = Position.fromFen(e.fen);
      for (const m of e.solution) { const mv = parseLegalCcn(pos, m); expect(mv, `${e.id} ${m}`).toBeGreaterThanOrEqual(0); pos.makeMove(mv); }
    }
  });
  it('best-move exercises expect exactly the claimed move', () => {
    for (const e of exercises.filter(x => x.source === 'best')) {
      if (e.kind !== 'line') continue;
      const pos = Position.fromFen(e.fen);
      const claimed = e.claim.split(/\s+/)[1];
      expect(moveToCcn(parseSan(pos, claimed))).toBe(e.solution[0]);
      expect(e.solution).toHaveLength(1);
    }
  });
  it('mate exercises accept exactly the proven mating first moves, and the prover can finish every one of them against the most stubborn defence', () => {
    const mates = exercises.filter(x => x.kind === 'mate');
    expect(mates.length).toBeGreaterThan(10);
    for (const e of mates) {
      if (e.kind !== 'mate') continue;
      const pos = Position.fromFen(e.fen);
      expect(matingFirstMoves(pos, e.mateIn).map(moveToCcn), e.id).toEqual(e.firstMoves);
      if (e.only) expect(e.firstMoves).toHaveLength(1);
      // a non-mating legal move is rejected
      const wrong = pos.legalMoves().find(m => !e.firstMoves.includes(moveToCcn(m)));
      if (wrong !== undefined) expect(moveMates(pos, wrong, e.mateIn)).toBe(false);
      // play it out exactly as the app does: player = a proven mating move, defence = stubbornDefence
      for (const first of e.firstMoves) {
        const p = Position.fromFen(e.fen);
        p.makeMove(parseLegalCcn(p, first));
        let left = e.mateIn - 1, guard = 0;
        while (p.hasLegalMove() && guard++ < 10) {
          expect(left, `${e.id} ${first}: mate not delivered in time`).toBeGreaterThan(0);
          p.makeMove(stubbornDefence(p, left)!);
          const next = matingFirstMoves(p, left)[0];
          expect(next, `${e.id}: no mating continuation`).toBeDefined();
          p.makeMove(next);
          left--;
        }
        expect(p.inCheck() && !p.hasLegalMove(), `${e.id} ${first}`).toBe(true);
      }
    }
  }, 60_000);
  it('example boards (with their lines) are legal positions', () => {
    for (const b of data.books) for (const c of b.chapters) for (const s of c.sections) for (const p of s.parts) {
      if (p.kind !== 'board') continue;
      const pos = Position.fromFen(p.board.fen);
      for (const m of p.board.ccn) pos.makeMove(parseLegalCcn(pos, m));
      expect(p.board.ccn).toHaveLength(p.board.line.length);
    }
  });
});

describe('Markdown renderer (safe)', () => {
  const html = (md: string) => renderToStaticMarkup(createElement(Markdown, { md }));
  it('renders headings, emphasis, lists, tables and code', () => {
    const out = html('#### Title\n\nSome **bold** and *it* and `Nf3`.\n\n- one\n- two\n  - nested\n\n1. first\n2. second\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```text\nx < y\n```');
    expect(out).toContain('<h4>Title</h4>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>it</em>');
    expect(out).toContain('<code>Nf3</code>');
    expect(out).toMatch(/<ul><li>one<\/li><li>two<ul><li>nested<\/li><\/ul><\/li><\/ul>/);
    expect(out).toContain('<ol start="1"><li>first</li><li>second</li></ol>');
    expect(out).toContain('<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
    expect(out).toContain('x &lt; y');
  });
  it('never interprets raw HTML; links show their text only', () => {
    const out = html('Hello <script>alert(1)</script> <img src=x onerror=alert(1)> [click](javascript:alert(1)) <!-- hidden -->');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('href');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('hidden');
    expect(out).toContain('click');
  });
});

// ---------------------------------------------------------------- progress and spaced repetition
const DAY = 86_400_000;
const T0 = Date.parse('2026-05-01T09:00:00.000Z');
const iso = (days: number) => new Date(T0 + days * DAY).toISOString();
let n = 0;
const att = (exerciseId: string, outcome: GrimOutcome, days: number, solved = outcome !== 'revealed'): GrimAttempt =>
  ({ id: `${exerciseId}:${++n}`, exerciseId, chapterId: exerciseId.split('/')[0], outcome, solved, at: iso(days) });

describe('Spaced repetition (1, 3, 7, 14 days)', () => {
  it('a first-try solve never enters the queue', () => {
    expect(reviewSchedule([att('c/ex-1', 'first-try', 0)]).size).toBe(0);
  });
  it('a miss is due after 1 day; correct answers push it to 3, 7, 14 days and then out; a miss resets it', () => {
    const e = 'c/ex-1';
    const log = [att(e, 'failed', 0)];
    expect(reviewSchedule(log).get(e)).toMatchObject({ stage: 0, due: iso(1) });
    expect(dueReviews(log, iso(0.5))).toHaveLength(0);
    expect(dueReviews(log, iso(1)).map(r => r.exerciseId)).toEqual([e]);
    log.push(att(e, 'first-try', 1));
    expect(reviewSchedule(log).get(e)).toMatchObject({ stage: 1, due: iso(4) });
    log.push(att(e, 'first-try', 4));
    expect(reviewSchedule(log).get(e)).toMatchObject({ stage: 2, due: iso(11) });
    log.push(att(e, 'failed', 12));
    expect(reviewSchedule(log).get(e)).toMatchObject({ stage: 0, due: iso(13), misses: 2 });
    log.push(att(e, 'first-try', 13), att(e, 'first-try', 16), att(e, 'first-try', 23));
    expect(reviewSchedule(log).get(e)).toMatchObject({ stage: 3, due: iso(37) });
    log.push(att(e, 'first-try', 37));
    expect(reviewSchedule(log).has(e)).toBe(false);
  });
  it('early correct answers do not move the schedule; hints and reveals count as misses', () => {
    const e = 'c/ex-2';
    expect(reviewSchedule([att(e, 'failed', 0), att(e, 'first-try', 0.2)]).get(e)).toMatchObject({ stage: 0, due: iso(1) });
    expect(reviewSchedule([att(e, 'after-hint', 0)]).get(e)?.stage).toBe(0);
    expect(reviewSchedule([att(e, 'revealed', 0)]).get(e)?.stage).toBe(0);
  });
});

describe('Progress, completion and mastery', () => {
  const forks = chaptersTagged('fork')[0];
  it('a chapter is complete when every exercise is solved (reveals never count), or when an exercise-free chapter was read', () => {
    const [g, e1, e2, e3] = forks.exercises;
    const log = [att(g, 'first-try', 0), att(e1, 'failed', 0, true), att(e2, 'after-hint', 0), att(e3, 'revealed', 0)];
    expect(chapterComplete(forks, solvedSet(log), new Set())).toBe(false);
    log.push(att(e3, 'first-try', 1));
    expect(chapterComplete(forks, solvedSet(log), new Set())).toBe(true);
    const free = indexChapters().find(c => !c.exercises.length)!;
    expect(chapterComplete(free, new Set(), new Set())).toBe(false);
    expect(chapterComplete(free, new Set(), new Set([free.id]))).toBe(true);
  });
  it('mastery per Book II topic uses the latest attempt of each exercise', () => {
    const [g, e1] = forks.exercises;
    const m = topicMastery([att(g, 'failed', 0), att(g, 'first-try', 2), att(e1, 'failed', 1)]).find(t => t.topic.id === forks.id)!;
    expect(m).toMatchObject({ exercises: 4, attempted: 2, firstTry: 1, mastery: 0.5 });
    expect(topicMastery([]).every(t => t.mastery === null)).toBe(true);
    expect(topicMastery([]).length).toBe(11);
  });
  it('completion and reads are put-if-absent in the meta store; an attempt can never become a first-try solve', async () => {
    const db = await CrownDB.open(new IDBFactory());
    expect(await completeChapter(db, forks.id, 2, iso(0))).toBe(true);
    expect(await completeChapter(db, forks.id, 2, iso(5))).toBe(false);
    await markRead(db, forks.id, iso(0)); await markRead(db, forks.id, iso(9));
    const a = att(forks.exercises[0], 'failed', 0, false);
    await saveAttempt(db, a);
    await saveAttempt(db, a); // retry of the same first write: no change
    await saveAttempt(db, { ...a, solved: true }, a);
    await expect(saveAttempt(db, { ...a, outcome: 'first-try' }, a)).rejects.toThrow();
    const p = await loadProgress(db);
    expect(p.completions.get(forks.id)?.at).toBe(iso(0));
    expect(p.read).toEqual(new Set([forks.id]));
    expect(p.attempts).toEqual([{ ...a, solved: true }]);
    expect((await db.metaWithPrefix(ATT_PREFIX))).toHaveLength(1);
    expect((await db.recordCounts()).grimoire).toBe(3); // the Vault's change key sees Grimoire records
    db.close();
  });
});

describe('Learning plan', () => {
  const pz = [...puzzles.values()].map(p => ({ ...p, retired: undefined }));
  it('builds today’s plan from real items: next chapter for the level, due reviews, weak-topic puzzles, a practice game', () => {
    const forks = chaptersTagged('fork')[0];
    const log = forks.exercises.map(e => att(e, 'failed', 0));
    const plan = dailyPlan({ settings: { level: 'developing', minutes: 30 }, progress: { attempts: log, completions: new Map(), read: new Set() }, nowIso: iso(2), puzzles: pz, academyAttemptIds: new Set() });
    expect(plan.chapter?.id).toBe(forks.id);
    expect(plan.reviews.map(r => r.exerciseId).sort()).toEqual([...forks.exercises].sort());
    expect(plan.puzzles?.theme).toBe('fork');
    expect(plan.puzzles!.ids).toHaveLength(5);
    const used = new Set(indexChapters().flatMap(c => c.puzzles));
    for (const id of plan.puzzles!.ids) { expect(puzzles.get(id)!.themes).toContain('fork'); expect(puzzles.get(id)!.split).toBe('training'); expect(used.has(id)).toBe(false); }
    expect(plan.game?.opponentLevel).toBe(3);
    const short = dailyPlan({ settings: { level: 'beginner', minutes: 10 }, progress: { attempts: [], completions: new Map(), read: new Set() }, nowIso: iso(0), puzzles: pz, academyAttemptIds: new Set() });
    expect(short.chapter?.book).toBe(1);
    expect(short.game).toBeNull();
    expect(short.reviews).toEqual([]);
  });
  it('skips completed and read chapters; suggests a level only from Assessments, never a rating', () => {
    const first = chaptersOfBook(1);
    const plan = dailyPlan({ settings: { level: 'beginner', minutes: 20 }, progress: { attempts: [], completions: new Map([[first[0].id, { chapterId: first[0].id, book: 1, at: iso(0) }]]), read: new Set([first[1].id]) }, nowIso: iso(0), puzzles: pz, academyAttemptIds: new Set() });
    expect(plan.chapter?.id).toBe(first[2].id);
    expect(suggestLevel([])).toBeNull();
    expect(suggestLevel([{ mode: 'rush', endedAt: 'x', attempted: 10, solved: 10 }])).toBeNull();
    expect(suggestLevel([{ mode: 'assessment', endedAt: 'x', attempted: 10, solved: 6 }])?.level).toBe('intermediate');
    expect(suggestLevel([{ mode: 'assessment', endedAt: 'x', attempted: 10, solved: 9 }, { mode: 'assessment', endedAt: 'y', attempted: 10, solved: 9 }])?.level).toBe('elite');
  });
});

describe('Grimoire achievements (Vault)', () => {
  const facts = (attempts: GrimAttempt[], done: string[]) => buildFacts({ games: [], ratingEvents: [], reports: [], grimoire: { attempts, completions: done.map((chapterId, i) => ({ chapterId, book: +chapterId[1], at: iso(i) })) } });
  const earned = (id: string, attempts: GrimAttempt[], done: string[]) => evaluateDef(vaultDef(id)!, facts(attempts, done)).earned;
  const ids = ['first-lesson', 'apprentice-graduate', 'tactical-scholar', 'fork-specialist', 'endgame-apprentice', 'calculation-adept', 'academy-graduate', 'sovereign-trial'];
  it('all eight exist and nothing is earned without records', () => {
    for (const id of ids) { expect(vaultDef(id), id).toBeTruthy(); expect(earned(id, [], []), id).toBe(false); }
  });
  it('book achievements need every chapter of the book; one missing chapter is not enough', () => {
    const b1 = chaptersOfBook(1).map(c => c.id);
    expect(earned('first-lesson', [], [b1[0]])).toBe(true);
    expect(earned('apprentice-graduate', [], b1.slice(1))).toBe(false);
    expect(earned('apprentice-graduate', [], b1)).toBe(true);
    const all4 = [1, 2, 3, 4].flatMap(b => chaptersOfBook(b).map(c => c.id));
    expect(earned('academy-graduate', [], all4.slice(0, -1))).toBe(false);
    expect(earned('academy-graduate', [], all4)).toBe(true);
    expect(earned('sovereign-trial', [], chaptersOfBook(5).map(c => c.id))).toBe(true);
    expect(earned('endgame-apprentice', [], chaptersTagged('endgame').map(c => c.id))).toBe(true);
    expect(chaptersTagged('endgame').length).toBeGreaterThanOrEqual(3);
  });
  it('fork-specialist counts each exercise once by id: re-solving one exercise many times never fills the set', () => {
    const fx = chaptersTagged('fork').flatMap(c => c.exercises);
    const farm = Array.from({ length: 20 }, (_, i) => att(fx[0], 'first-try', i));
    expect(earned('fork-specialist', farm, [])).toBe(false);
    expect(evaluateDef(vaultDef('fork-specialist')!, facts(farm, [])).progress).toEqual({ have: 1, need: fx.length });
    const hinted = fx.map(e => att(e, 'after-hint', 0));
    expect(earned('fork-specialist', hinted, [])).toBe(false);
    expect(earned('fork-specialist', [...hinted, ...fx.map(e => att(e, 'first-try', 3))], [])).toBe(true);
  });
  it('calculation-adept uses the first attempt of each exercise: later clean re-solves do not raise the rate', () => {
    const chs = chaptersTagged('calculation');
    const ex = chs.flatMap(c => c.exercises);
    const done = chs.map(c => c.id);
    const misses = Math.ceil(ex.length * 0.2) + 1;
    const log = ex.map((e, i) => att(e, i < misses ? 'failed' : 'first-try', 0, true));
    expect(earned('calculation-adept', log, done)).toBe(false);
    expect(earned('calculation-adept', [...log, ...ex.map(e => att(e, 'first-try', 5))], done)).toBe(false);
    expect(firstOutcomes([...log, ...ex.map(e => att(e, 'first-try', 5))]).get(ex[0])).toBe('failed');
    const good = ex.map((e, i) => att(e, i === 0 ? 'failed' : 'first-try', 0, true));
    expect(ex.length >= 5).toBe(true);
    expect(earned('calculation-adept', good, done)).toBe(true);
    expect(earned('calculation-adept', good, done.slice(1))).toBe(false);
  });
  it('a duplicated completion record (e.g. an import) still counts the chapter once', () => {
    const c = chaptersOfBook(1)[0].id;
    const f = buildFacts({ games: [], ratingEvents: [], reports: [], grimoire: { attempts: [], completions: [{ chapterId: c, book: 1, at: iso(3) }, { chapterId: c, book: 1, at: iso(1) }] } });
    expect(f.grimoire.completed.size).toBe(1);
    expect(f.grimoire.completed.get(c)).toBe(iso(1));
  });
});
