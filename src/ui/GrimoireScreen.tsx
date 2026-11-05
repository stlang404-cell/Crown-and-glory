/**
 * The Sovereign's Grimoire inside the Crown Academy: books → chapters (with progress) → chapter reader with example
 * boards and interactive exercises, plus the spaced-repetition Review queue. Lesson text is loaded lazily
 * (src/academy/data/grimoire.json, its own chunk, precached for offline use). Exercises are checked against exactly
 * what the book verified: Academy puzzle lines, engine-policy best moves, and mate-in-N claims via the shared exhaustive
 * mate prover (every move that forces mate within the remaining moves is accepted, and nothing else).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useServices } from './App';
import { Board } from './Board';
import { Markdown, inline } from './Markdown';
import { Position } from '../rules/position';
import { moveToCcn, parseLegalCcn } from '../rules/notation';
import { squareName } from '../rules/types';
import { matingFirstMoves, moveMates, stubbornDefence } from '../academy/mateProver';
import {
  type GrimAttempt, type GrimOutcome, type GrimProgress, type GrimoireBoard, type GrimoireChapter, type GrimoireData, type GrimoireExercise, type GrimoirePart,
  chapterComplete, completeChapter, dueReviews, reviewSchedule, loadGrimoire, loadProgress, markRead, saveAttempt, solvedSet, topicMastery,
} from '../academy/grimoire';
import './grimoire.css';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function GrimoireScreen({ path }: { path?: string }) {
  const services = useServices();
  const { go } = useApp();
  const [data, setData] = useState<GrimoireData | null>(null);
  const [progress, setProgress] = useState<GrimProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadGrimoire().then(setData, e => setError(String(e))); }, []);
  useEffect(() => { void loadProgress(services.db).then(setProgress); }, [services, services.revision]);
  const exMap = useMemo(() => new Map((data?.books ?? []).flatMap(b => b.chapters.flatMap(c => c.exercises.map(e => [e.id, e] as const)))), [data]);
  const chMap = useMemo(() => new Map((data?.books ?? []).flatMap(b => b.chapters.map(c => [c.id, c] as const))), [data]);

  /** After any record: re-read progress, then record the chapter's completion once if it is now complete. */
  const afterChange = async (chapterId: string) => {
    const p = await loadProgress(services.db);
    const ch = chMap.get(chapterId);
    if (ch && !services.readOnly && !p.completions.has(ch.id) && chapterComplete(ch, solvedSet(p.attempts), p.read)) {
      await completeChapter(services.db, ch.id, ch.book, new Date().toISOString());
    }
    services.notify();
  };

  if (error) return <div className="panel"><p>The Grimoire could not be loaded: {error}</p></div>;
  if (!data || !progress) return <p className="muted">Opening the Grimoire…</p>;
  const solved = solvedSet(progress.attempts);
  const book = /^b(\d+)$/.exec(path ?? '');
  const chapter = path ? chMap.get(path) : undefined;

  if (path === 'review') return <ReviewSession data={data} exMap={exMap} progress={progress} onBack={() => go({ name: 'grimoire' })} afterChange={afterChange} />;
  if (chapter) {
    const b = data.books.find(x => x.number === chapter.book)!;
    const i = b.chapters.indexOf(chapter);
    return <ChapterReader key={chapter.id} chapter={chapter} bookTitle={b.title} progress={progress} solved={solved} exMap={exMap} afterChange={afterChange}
      onBack={() => go({ name: 'grimoire', path: b.id })} next={b.chapters[i + 1] ?? null} onOpen={id => go({ name: 'grimoire', path: id })} />;
  }
  if (book) {
    const b = data.books.find(x => x.number === +book[1]);
    if (b) return (
      <div data-testid="grimoire-book" data-book={b.number}>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn ghost small" onClick={() => go({ name: 'grimoire' })}>← Grimoire</button>
          <h1 style={{ margin: 0 }}>{b.title}</h1>
        </div>
        {b.intro.length > 0 && <div className="panel grim-prose" style={{ marginBottom: 14 }}><Parts parts={b.intro} /></div>}
        <div className="stack">
          {b.chapters.map(c => {
            const st = chapterStatus(c, progress, solved);
            return (
              <button key={c.id} className="panel grim-chapter-row" data-testid="grimoire-chapter" data-chapter={c.id} data-status={st.key} onClick={() => go({ name: 'grimoire', path: c.id })}>
                <span className="grim-chapter-title">{c.title}</span>
                <span className="row">
                  {c.exercises.length > 0 && <span className="chip">{c.exercises.filter(e => solved.has(e.id)).length}/{c.exercises.length} exercises</span>}
                  <span className={`chip ${st.key === 'complete' ? 'pos' : st.key === 'started' ? 'gold' : ''}`}>{st.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const due = dueReviews(progress.attempts, new Date().toISOString());
  const scheduled = reviewSchedule(progress.attempts).size;
  const mastery = topicMastery(progress.attempts).filter(t => t.attempted > 0);
  return (
    <div data-testid="grimoire-home">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'academy' })}>← Academy</button>
        <h1 style={{ margin: 0 }}>The Sovereign’s Grimoire</h1>
      </div>
      <p className="muted small">The Academy’s textbook: six books and two appendices. Every board is checked against the real rules; exercises accept exactly the moves the book verified.</p>
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="panel" data-testid="grimoire-review">
          <div className="panel-title"><h2 className="h3" style={{ margin: 0 }}>Review</h2><span className={`chip ${due.length ? 'gold' : ''}`} data-testid="review-counts" data-due={due.length} data-scheduled={scheduled}>{due.length} due · {scheduled} scheduled</span></div>
          <p className="small muted">Missed exercises come back after 1, 3, 7 and 14 days. A clean solve moves an exercise to the next interval; a miss starts it again.</p>
          <button className="btn" disabled={!due.length} onClick={() => go({ name: 'grimoire', path: 'review' })}>{due.length ? 'Start Review' : 'Nothing Due Today'}</button>
        </div>
        <div className="panel">
          <div className="panel-title"><h2 className="h3" style={{ margin: 0 }}>Tactical Topics</h2><span className="chip">Book II</span></div>
          {mastery.length ? (
            <ul className="grim-mastery">{mastery.map(t => <li key={t.topic.id}><span>{t.topic.label}</span><span className="chip">{Math.round((t.mastery ?? 0) * 100)}% first try · {t.attempted}/{t.exercises}</span></li>)}</ul>
          ) : <p className="small muted">Mastery appears once you try the exercises of a Book II chapter: the share solved first try on your latest attempt.</p>}
        </div>
      </div>
      <div className="grid-2">
        {data.books.map(b => {
          const total = b.chapters.length, done = b.chapters.filter(c => progress.completions.has(c.id)).length;
          return (
            <button key={b.id} className="panel grim-book" data-testid="grimoire-book-card" data-book={b.number} onClick={() => go({ name: 'grimoire', path: b.id })}>
              <span className="grim-book-title">{b.title}</span>
              <span className="grim-bar" aria-hidden="true"><span style={{ width: `${(done / total) * 100}%` }} /></span>
              <span className="small muted">{done} of {total} {total === 1 ? 'chapter' : 'chapters'} complete · {b.chapters.reduce((a, c) => a + c.exercises.length, 0)} exercises</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function chapterStatus(c: GrimoireChapter, p: GrimProgress, solved: Set<string>): { key: 'complete' | 'started' | 'new'; label: string } {
  if (p.completions.has(c.id)) return { key: 'complete', label: 'Complete' };
  if (p.read.has(c.id) || c.exercises.some(e => p.attempts.some(a => a.exerciseId === e.id)) || c.exercises.some(e => solved.has(e.id))) return { key: 'started', label: 'In progress' };
  return { key: 'new', label: 'Not started' };
}

// ---------------------------------------------------------------- chapter reader
function ChapterReader({ chapter, bookTitle, progress, solved, exMap, afterChange, onBack, next, onOpen }: {
  chapter: GrimoireChapter; bookTitle: string; progress: GrimProgress; solved: Set<string>; exMap: Map<string, GrimoireExercise>;
  afterChange: (chapterId: string) => Promise<void>; onBack: () => void; next: GrimoireChapter | null; onOpen: (id: string) => void;
}) {
  const services = useServices();
  const complete = progress.completions.has(chapter.id);
  const read = progress.read.has(chapter.id);
  const nSolved = chapter.exercises.filter(e => solved.has(e.id)).length;
  const finish = async () => {
    if (!services.readOnly) await markRead(services.db, chapter.id, new Date().toISOString());
    await afterChange(chapter.id);
  };
  return (
    <article data-testid="grimoire-chapter-reader" data-chapter={chapter.id} data-complete={complete ? 'yes' : 'no'}>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn ghost small" onClick={onBack}>← {bookTitle.split(' — ')[0]}</button>
        {complete ? <span className="chip pos" data-testid="chapter-complete">Chapter complete</span> : chapter.exercises.length ? <span className="chip gold">{nSolved}/{chapter.exercises.length} exercises solved</span> : null}
      </div>
      <h1>{chapter.title}</h1>
      {chapter.objectives.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <h2 className="h3" style={{ marginTop: 0 }}>Learning objectives</h2>
          <ul className="md">{chapter.objectives.map((o, i) => <li key={i}>{inline(o, `o${i}`)}</li>)}</ul>
        </div>
      )}
      {chapter.sections.map((s, i) => (
        <section key={i} className="grim-section grim-prose">
          {s.answers ? (
            <details className="panel" data-testid="grimoire-answers"><summary><strong>{s.heading}</strong> <span className="small muted">(open after trying the exercises)</span></summary><Parts parts={s.parts} exMap={exMap} afterChange={afterChange} /></details>
          ) : (
            <>
              {s.heading && <h2>{s.heading}</h2>}
              <Parts parts={s.parts} exMap={exMap} afterChange={afterChange} />
            </>
          )}
        </section>
      ))}
      <div className="panel" style={{ marginTop: 18 }} data-testid="chapter-end">
        {complete ? <p style={{ marginTop: 0 }}><strong>Chapter complete.</strong></p>
          : chapter.exercises.length ? <p style={{ marginTop: 0 }}>Solve every exercise in this chapter to complete it ({nSolved}/{chapter.exercises.length} so far). “Show solution” does not count as solved.</p>
            : <p style={{ marginTop: 0 }}>This chapter has no exercises: it is complete once you have read it to the end.</p>}
        <div className="row">
          {!read && <button className="btn primary" onClick={() => void finish()} disabled={services.readOnly}>{chapter.exercises.length ? 'Mark as Read' : 'Finish Chapter'}</button>}
          {next && <button className="btn" onClick={() => onOpen(next.id)}>Next: {next.title}</button>}
        </div>
      </div>
    </article>
  );
}

function Parts({ parts, exMap, afterChange }: { parts: GrimoirePart[]; exMap?: Map<string, GrimoireExercise>; afterChange?: (chapterId: string) => Promise<void> }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === 'md') return p.spoiler
          ? <details key={i} className="grim-spoiler"><summary>Answer</summary><Markdown md={p.md} headingOffset={1} /></details>
          : <Markdown key={i} md={p.md} headingOffset={1} />;
        if (p.kind === 'board') return <ExampleBoard key={i} board={p.board} />;
        const ex = exMap?.get(p.id);
        return ex && afterChange ? <ExercisePlayer key={p.id} ex={ex} afterChange={afterChange} /> : null;
      })}
    </>
  );
}

// ---------------------------------------------------------------- static example boards (with line stepping)
function ExampleBoard({ board }: { board: GrimoireBoard }) {
  const fens = useMemo(() => {
    const pos = Position.fromFen(board.fen);
    const out = [pos.toFen()];
    for (const m of board.ccn) { pos.makeMove(parseLegalCcn(pos, m)); out.push(pos.toFen()); }
    return out;
  }, [board]);
  const [i, setI] = useState(board.show === 'after' ? fens.length - 1 : 0);
  const pos = Position.fromFen(fens[i]);
  return (
    <figure className="grim-board" data-testid="grimoire-example">
      <Board fen={fens[i]} orientation={board.flip ? 'black' : 'white'} lastMove={i > 0 ? board.ccn[i - 1] : null} checkSquare={pos.inCheck() ? squareName(pos.kingSq[pos.side]) : null} label={board.caption || 'Example position'} />
      {board.ccn.length > 0 && (
        <div className="row grim-stepper">
          <button className="btn small" onClick={() => setI(0)} disabled={i === 0} aria-label="Start of line">⏮</button>
          <button className="btn small" onClick={() => setI(x => Math.max(0, x - 1))} disabled={i === 0}>Prev</button>
          <span className="small muted">{i === 0 ? 'Start' : `${board.line[i - 1]} (${i}/${board.ccn.length})`}</span>
          <button className="btn small" onClick={() => setI(x => Math.min(fens.length - 1, x + 1))} disabled={i === fens.length - 1}>Next</button>
        </div>
      )}
      {board.caption && <figcaption className="small">{inline(board.caption, 'cap')}</figcaption>}
    </figure>
  );
}

// ---------------------------------------------------------------- interactive exercises
type Status = 'playing' | 'wrong' | 'solved' | 'revealed';
function accepted(ex: GrimoireExercise): string[] { return ex.kind === 'mate' ? ex.firstMoves : [ex.solution[0]]; }

function ExercisePlayer({ ex, afterChange, review = false, onDone }: { ex: GrimoireExercise; afterChange: (chapterId: string) => Promise<void>; review?: boolean; onDone?: () => void }) {
  const services = useServices();
  const posRef = useRef<Position>(Position.fromFen(ex.fen));
  const [fen, setFen] = useState(ex.fen);
  const [last, setLast] = useState<string | null>(null);
  const [step, setStep] = useState(0); // plies played from the start
  const [busy, setBusy] = useState(false); // the defence is replying
  const [status, setStatus] = useState<Status>('playing');
  const [hints, setHints] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const attempt = useRef<GrimAttempt | null>(null);
  const session = useRef(uid());
  const timers = useRef<number[]>([]);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);
  const orientation: 'white' | 'black' = ex.flip ? 'black' : Position.fromFen(ex.fen).side === 0 ? 'white' : 'black';
  const wrongExample = useMemo(() => { const acc = accepted(ex); return Position.fromFen(ex.fen).legalMoves().map(moveToCcn).sort((a, b) => a.length - b.length).find(m => !acc.includes(m)) ?? ''; }, [ex]);

  const record = async (outcome: GrimOutcome, solved: boolean) => {
    const prev = attempt.current;
    if (prev && (prev.outcome === 'revealed' || (prev.solved && solved))) return;
    const next: GrimAttempt = prev
      ? { ...prev, outcome: outcome === 'revealed' ? 'revealed' : prev.outcome, solved: outcome === 'revealed' ? false : solved }
      : { id: `${ex.id}:${session.current}`, exerciseId: ex.id, chapterId: ex.chapterId, outcome, solved, at: new Date().toISOString(), ...(review ? { review: true } : {}) };
    attempt.current = next;
    if (services.readOnly) return;
    await saveAttempt(services.db, next, prev ?? undefined);
    await afterChange(ex.chapterId);
  };
  const apply = (ccn: string) => { const p = posRef.current; p.makeMove(parseLegalCcn(p, ccn)); setFen(p.toFen()); setLast(ccn); };
  const remaining = () => (ex.kind === 'mate' ? ex.mateIn - Math.floor(step / 2) : 0);
  const solve = () => {
    setStatus('solved');
    const outcome: GrimOutcome = attempt.current ? attempt.current.outcome : hints > 0 ? 'after-hint' : 'first-try';
    setMsg(outcome === 'first-try' ? 'Correct — solved on the first try.' : 'Solved. It goes to your Review queue because it needed help.');
    void record(outcome, true);
  };

  const onMove = (ccn: string) => {
    if ((status !== 'playing' && status !== 'wrong') || busy) return;
    const p = posRef.current;
    let ok: boolean;
    if (ex.kind === 'line') ok = ccn === ex.solution[step];
    else if (step === 0) ok = ex.firstMoves.includes(ccn);
    else ok = moveMates(p, parseLegalCcn(p, ccn), remaining(), { nodes: 5_000_000 });
    if (!ok) {
      setStatus('wrong');
      setMsg(ex.kind === 'mate' ? `Not that move: it does not force mate${remaining() > 1 ? ` in ${remaining()}` : ''}. Try again.` : 'Not the book’s move. Try again.');
      if (!attempt.current) void record('failed', false);
      return;
    }
    apply(ccn);
    setStatus('playing'); setMsg('Good move.');
    const ply = step + 1;
    if (ex.kind === 'line') {
      if (ply >= ex.solution.length) { setStep(ply); solve(); return; }
      setStep(ply); setBusy(true);
      timers.current.push(window.setTimeout(() => {
        apply(ex.solution[ply]); setBusy(false); setStep(ply + 1);
        if (ply + 1 >= ex.solution.length) solve();
      }, 450));
      return;
    }
    // mate: checkmate ends it; otherwise the most stubborn defence replies (prover)
    if (!p.hasLegalMove()) { setStep(ply); solve(); return; }
    setStep(ply); setBusy(true);
    const left = ex.mateIn - Math.floor(step / 2) - 1;
    timers.current.push(window.setTimeout(() => {
      const r = stubbornDefence(p, Math.max(1, left));
      if (r !== null) apply(moveToCcn(r));
      setBusy(false); setStep(ply + 1);
    }, 450));
  };

  const hintMove = (): string | null => {
    const p = posRef.current;
    if (ex.kind === 'line') return ex.solution[step] ?? null;
    if (step === 0) return ex.firstMoves[0];
    const m = matingFirstMoves(p, remaining(), { nodes: 5_000_000 })[0];
    return m === undefined ? null : moveToCcn(m);
  };
  const reveal = () => {
    setStatus('revealed'); setMsg(null);
    void record('revealed', false);
    const p = posRef.current;
    const seq: string[] = [];
    if (ex.kind === 'line') seq.push(...ex.solution.slice(step));
    else {
      const probe = p.clone();
      for (let guard = 0; guard < 8 && probe.hasLegalMove(); guard++) {
        const ply = step + seq.length;
        const left = ex.mateIn - Math.floor(ply / 2); // attacker moves still available (counting the one to play now)
        const m = ply % 2 === 0 ? matingFirstMoves(probe, Math.max(1, left), { nodes: 5_000_000 })[0] : stubbornDefence(probe, Math.max(1, left - 1));
        if (m === undefined || m === null) break;
        seq.push(moveToCcn(m)); probe.makeMove(m);
      }
    }
    seq.forEach((m, i) => timers.current.push(window.setTimeout(() => apply(m), 500 * (i + 1))));
    setStep(s => s + seq.length);
  };

  const legal = (status === 'playing' || status === 'wrong') && !busy ? posRef.current.legalMoves().map(moveToCcn) : [];
  const check = Position.fromFen(fen);
  const hm = hints > 0 && (status === 'playing' || status === 'wrong') ? hintMove() : null;
  const hintText = ex.hint ?? (ex.kind === 'line' && ex.goal ? `${ex.goal}.` : null) ?? ex.caption;
  const solutionText = ex.kind === 'line' ? ex.solutionSan.join(' ') : `${ex.firstMovesSan.join(' or ')}${ex.line.length ? ` — the book’s line: ${ex.line.join(' ')}` : ''}`;
  const toMove = Position.fromFen(ex.fen).side === 0 ? 'White' : 'Black';
  const goal = ex.kind === 'mate' ? `${toMove} to move: mate in ${ex.mateIn}` : ex.source === 'puzzle' ? `${toMove} to move · Academy puzzle ${ex.puzzleId}` : `${toMove} to move · the engine’s choice`;
  return (
    <div className="grim-exercise panel" data-testid="grim-exercise" data-exercise={ex.id} data-status={status} data-answer={accepted(ex).join(' ')} data-solution={ex.kind === 'line' ? ex.solution.join(' ') : ex.firstMoves.join(' ')} data-wrong={wrongExample} data-kind={ex.kind}>
      <div className="panel-title"><h2 className="h3" style={{ margin: 0 }}>{ex.number === 'guided' ? 'Guided exercise' : `Exercise ${ex.number}`}</h2><span className="chip gold">{goal}</span></div>
      <div className="grim-exercise-body">
        <div className="grim-board">
          <Board fen={fen} orientation={orientation} legal={legal} onMove={onMove} lastMove={last} checkSquare={check.inCheck() ? squareName(check.kingSq[check.side]) : null} highlights={hm ? [hm.slice(0, 2)] : []} label={`Exercise board: ${ex.caption}`} />
        </div>
        <div className="stack grim-exercise-side">
          {ex.caption && <div className="small">{inline(ex.caption, 'c')}</div>}
          {status === 'wrong' && <div className="notice warn" role="status" data-testid="grim-feedback">{msg}</div>}
          {status === 'playing' && msg && <div className="notice" role="status" data-testid="grim-feedback">{msg}</div>}
          {status === 'solved' && <div className="notice" role="status" data-testid="grim-feedback">{msg} Line: {solutionText}</div>}
          {status === 'revealed' && <div className="notice warn" role="status" data-testid="grim-feedback">Solution: {solutionText}. Shown solutions do not count as solved; this exercise returns in Review.</div>}
          {hints > 0 && (status === 'playing' || status === 'wrong') && <div className="notice small" data-testid="grim-hint"><strong>Hint:</strong> {inline(hintText, 'h')}{hm ? ' The highlighted piece moves.' : ''}</div>}
          {(status === 'solved' || status === 'revealed') && ex.answer && <details className="grim-spoiler" open={status === 'revealed'}><summary>The book’s answer</summary><Markdown md={ex.answer} /></details>}
          <div className="row">
            {(status === 'playing' || status === 'wrong') && <button className="btn small" onClick={() => setHints(h => h + 1)} disabled={busy}>Hint</button>}
            {(status === 'playing' || status === 'wrong') && <button className="btn ghost small" onClick={reveal} disabled={busy}>Show Solution</button>}
            {(status === 'solved' || status === 'revealed') && onDone && <button className="btn primary small" onClick={onDone}>Next</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- review queue
function ReviewSession({ data, exMap, progress, onBack, afterChange }: { data: GrimoireData; exMap: Map<string, GrimoireExercise>; progress: GrimProgress; onBack: () => void; afterChange: (chapterId: string) => Promise<void> }) {
  const [queue] = useState(() => dueReviews(progress.attempts, new Date().toISOString()).map(r => r.exerciseId).filter(id => exMap.has(id)));
  const [i, setI] = useState(0);
  void data;
  const ex = queue[i] ? exMap.get(queue[i]) : undefined;
  return (
    <div data-testid="grimoire-review-session">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={onBack}>← Grimoire</button>
        <h1 style={{ margin: 0 }}>Review</h1>
        <span className="chip">{Math.min(i + 1, queue.length)} of {queue.length}</span>
      </div>
      {ex ? <ExercisePlayer key={ex.id + i} ex={ex} review afterChange={afterChange} onDone={() => setI(x => x + 1)} />
        : <div className="panel"><p>{queue.length ? 'Review done for today.' : 'Nothing is due for review.'}</p><button className="btn" onClick={onBack}>Back to the Grimoire</button></div>}
    </div>
  );
}
