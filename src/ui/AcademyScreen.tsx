import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useServices } from './App';
import { Board } from './Board';
import { Position } from '../rules/position';
import { parseLegalCcn, moveToCcn } from '../rules/notation';
import { squareName } from '../rules/types';
import {
  AcademyMode, Attempt, MODE_INFO, Puzzle, TrainingRun, adaptiveThemes, loadPuzzleSet, mistakePuzzles, modeFilter, nextPuzzle, themeStats,
} from '../academy/academy';
import { MOTIF_LABEL, Motif } from '../academy/motifs';
import type { AnalysisReport } from '../analysis/types';
import type { GameRecord } from '../games/types';
import { TIME_CONTROLS } from '../games/types';
import { createGameRecord } from '../games/session';
import { ROSTER, opponentSnapshot } from '../federation/roster';

const themeLabel = (t: string) => MOTIF_LABEL[t as Motif] ?? t.replace(/-/g, ' ');
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface Data { puzzles: Puzzle[]; meta: { id: string; engine: string; policy: string }; attempts: Attempt[]; runs: TrainingRun[]; reports: AnalysisReport[]; games: GameRecord[] }

export function AcademyScreen() {
  const services = useServices();
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<AcademyMode | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const set = await loadPuzzleSet();
      const [attempts, runs, reports, games] = await Promise.all([services.db.getAll<Attempt>('attempts'), services.db.getAll<TrainingRun>('trainingRuns'), services.db.allReports(), services.db.allGames()]);
      setData({ puzzles: set.puzzles, meta: { id: set.id, engine: set.engine, policy: set.policy }, attempts, runs, reports, games });
    })();
  }, [services, services.revision]);
  if (!data) return <p className="muted">Loading the Academy…</p>;
  if (mode) return <PuzzleSession key={`${mode}:${theme}`} mode={mode} theme={theme} data={data} onExit={() => { setMode(null); setTheme(null); }} />;

  const mistakes = mistakePuzzles(data.reports, data.games);
  const count = (m: AcademyMode) => (m === 'mistakes' ? mistakes.length : data.puzzles.filter(p => modeFilter(m, p)).length);
  const stats = themeStats(data.attempts, data.puzzles);
  const first = data.attempts.filter(a => a.exposure === 0 && a.split === 'training');
  const cleanRate = first.length ? first.filter(a => a.clean).length / first.length : null;
  const rushBest = Math.max(0, ...data.runs.filter(r => r.mode === 'rush').map(r => r.score));
  const adaptive = adaptiveThemes(data.attempts, data.puzzles, data.reports, data.games);
  const themes = [...new Set(data.puzzles.filter(p => p.split === 'training').flatMap(p => p.themes))].sort();
  return (
    <div>
      <h1>Crown Academy</h1>
      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="panel stat"><span className="k">Solved First Try</span><span className="v">{first.filter(a => a.clean).length}</span><span className="small muted">{cleanRate === null ? 'No attempts yet' : `${Math.round(cleanRate * 100)}% of ${first.length} first attempts, without hints`}</span></div>
        <div className="panel stat"><span className="k">Puzzle Rush Best</span><span className="v">{rushBest}</span><span className="small muted">{data.runs.filter(r => r.mode === 'rush').length} runs</span></div>
        <div className="panel stat"><span className="k">Puzzles Available</span><span className="v">{data.puzzles.filter(p => !p.retired).length}</span><span className="small muted">{data.puzzles.filter(p => p.split === 'heldout' && !p.retired).length} kept for assessments{data.puzzles.some(p => p.retired) ? ` · ${data.puzzles.filter(p => p.retired).length} retired after a recheck` : ''}</span></div>
      </div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-title"><h3 style={{ margin: 0 }}>Recommended Next</h3><span className="chip gold">Adaptive</span></div>
        <p className="small" style={{ margin: '0 0 8px' }}>{adaptive.basis}</p>
        <button className="btn primary" onClick={() => setMode('adaptive')}>Start Adaptive Training{adaptive.themes.length ? `: ${adaptive.themes.map(themeLabel).join(', ')}` : ''}</button>
      </div>
      <div className="grid-2">
        {(['tactics', 'rush', 'calculation', 'defense', 'endgame', 'mistakes', 'assessment'] as AcademyMode[]).map(m => (
          <div key={m} className="panel" data-testid={`mode-${m}`}>
            <div className="panel-title"><h3 style={{ margin: 0 }}>{MODE_INFO[m].title}</h3><span className="chip">{count(m)} {m === 'mistakes' ? 'positions' : 'puzzles'}</span></div>
            <p className="small muted">{MODE_INFO[m].blurb}</p>
            <button className="btn" disabled={count(m) === 0} onClick={() => setMode(m)}>
              {count(m) === 0 ? (m === 'mistakes' ? 'Play and Analyse Games First' : 'No Puzzles Yet') : m === 'rush' ? 'Start a 3-Minute Rush' : m === 'assessment' ? 'Take an Assessment' : 'Start'}
            </button>
          </div>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Train a Theme</h3>
        <div className="row">
          {themes.map(t => {
            const s = stats.get(t);
            return <button key={t} className="btn small" onClick={() => { setTheme(t); setMode('tactics'); }}>{themeLabel(t)}{s?.attempts ? ` · ${s.clean}/${s.attempts}` : ''}</button>;
          })}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Every puzzle is a legal position, and the engine checked that its solution is the only best move.
          Difficulty is an estimate (line length, quiet first move, material given up, engine effort) and is not yet tuned on human solvers.
          Theme stats count only the first time you see each puzzle.
        </p>
        <details className="small muted"><summary>Details</summary>Verification policy {data.meta.policy} · engine {data.meta.engine}</details>
      </div>
    </div>
  );
}

function PuzzleSession({ mode, theme, data, onExit }: { mode: AcademyMode; theme: string | null; data: Data; onExit: () => void }) {
  const services = useServices();
  const { go } = useApp();
  const [attempts, setAttempts] = useState<Attempt[]>(data.attempts);
  const targetRef = useRef(mode === 'rush' ? 1 : 2);
  const [current, setCurrent] = useState<Puzzle | null>(null);
  const [run] = useState<TrainingRun | null>(() => (mode === 'rush' || mode === 'assessment' ? { id: uid(mode), mode: mode as 'rush' | 'assessment', startedAt: new Date().toISOString(), endedAt: null, score: 0, attempted: 0, solved: 0, durationMs: 0, puzzleIds: [] } : null));
  const [runState, setRunState] = useState({ score: 0, strikes: 0, attempted: 0, done: false });
  const [deadline] = useState(() => (mode === 'rush' ? Date.now() + 180_000 : null));
  const [, tick] = useState(0);
  const sessionSeen = useRef(new Set<string>());
  const adaptive = useMemo(() => adaptiveThemes(data.attempts, data.puzzles, data.reports, data.games), [data]);
  const mistakes = useMemo(() => mistakePuzzles(data.reports, data.games), [data]);
  const pool = mode === 'mistakes' ? mistakes : data.puzzles;

  const pick = (t = targetRef.current) => {
    const themes = mode === 'adaptive' ? adaptive.themes : theme ? [theme] : undefined;
    const p = nextPuzzle(mode === 'mistakes' ? 'tactics' : mode === 'adaptive' ? 'tactics' : mode, pool, attempts, { targetDifficulty: t, themes, exclude: sessionSeen.current });
    if (p) sessionSeen.current.add(p.id);
    setCurrent(p);
  };
  useEffect(() => { pick(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => { tick(x => x + 1); if (Date.now() >= deadline) finishRun(); }, 250);
    return () => clearInterval(id);
  });

  const finishRun = async () => {
    if (!run || runState.done) return;
    const r: TrainingRun = { ...run, endedAt: new Date().toISOString(), score: runState.score, attempted: runState.attempted, solved: runState.score, durationMs: Date.now() - Date.parse(run.startedAt), puzzleIds: [...sessionSeen.current] };
    await services.db.put('trainingRuns', r);
    setRunState(s => ({ ...s, done: true }));
    services.notify();
  };

  const record = async (p: Puzzle, res: { solved: boolean; clean: boolean; hints: number; revealed: boolean; msFirst: number; msTotal: number; firstMove: string | null }) => {
    const exposure = attempts.filter(a => a.puzzleId === p.id).length;
    const a: Attempt = {
      id: uid('att'), puzzleId: p.id, mode, split: p.source === 'mistake' ? 'mistake' : p.split, at: new Date().toISOString(), solved: res.solved, clean: res.clean,
      hintsUsed: res.hints, revealed: res.revealed, msToFirstMove: res.msFirst, msTotal: res.msTotal, firstMove: res.firstMove, exposure, difficulty: p.difficulty, themes: p.themes as string[], runId: run?.id,
    };
    await services.db.put('attempts', a);
    setAttempts(x => [...x, a]);
    const nextTarget = Math.max(1, Math.min(5, targetRef.current + (res.clean ? 1 : -1) * (mode === 'rush' ? 0.5 : 0.34)));
    targetRef.current = nextTarget;
    if (run) {
      const ns = { ...runState, attempted: runState.attempted + 1, score: runState.score + (res.clean ? 1 : 0), strikes: runState.strikes + (res.clean ? 0 : 1) };
      setRunState(ns);
      if ((mode === 'rush' && ns.strikes >= 3) || (mode === 'assessment' && ns.attempted >= 10)) { setRunState({ ...ns, done: false }); setTimeout(() => void finishRunWith(ns), 0); return nextTarget; }
    }
    return nextTarget;
  };
  const finishRunWith = async (ns: typeof runState) => {
    if (!run) return;
    const r: TrainingRun = { ...run, endedAt: new Date().toISOString(), score: ns.score, attempted: ns.attempted, solved: ns.score, durationMs: Date.now() - Date.parse(run.startedAt), puzzleIds: [...sessionSeen.current] };
    await services.db.put('trainingRuns', r);
    setRunState({ ...ns, done: true });
    services.notify();
  };

  const playOut = async (p: Puzzle) => {
    const opp = ROSTER.find(o => o.level === 6)!;
    const pos = Position.fromFen(p.fen);
    const rec = createGameRecord({
      id: uid('t'), mode: 'training', timeControl: TIME_CONTROLS.untimed, humanColor: pos.side === 0 ? 'white' : 'black',
      human: { kind: 'human', id: 'player', name: 'You', rating: null, rd: null }, engine: opponentSnapshot(opp), initialFen: p.fen,
      engineSeed: Math.floor(Math.random() * 2 ** 31), nowIso: new Date().toISOString(), context: { kind: 'training-retry', sourceGameId: p.sourceGameId },
    });
    await services.saveGame(rec);
    go({ name: 'match', gameId: rec.id });
  };

  const left = deadline ? Math.max(0, deadline - Date.now()) : null;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => { if (run && !runState.done) void finishRun(); onExit(); }}>← Academy</button>
        <h1 style={{ margin: 0 }}>{MODE_INFO[mode].title}{theme ? `: ${themeLabel(theme)}` : ''}</h1>
        {run && <span className="chip gold" data-testid="run-score">Score {runState.score}{mode === 'rush' ? ` · Strikes ${runState.strikes}/3` : ` · ${runState.attempted}/10`}</span>}
        {left !== null && <span className="chip" role="timer">{Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}</span>}
      </div>
      {mode === 'adaptive' && <div className="notice" style={{ marginBottom: 12 }}>{adaptive.basis}</div>}
      {runState.done ? (
        <div className="panel" style={{ maxWidth: 520 }}>
          <h2>{mode === 'rush' ? 'Rush Complete' : 'Assessment Complete'}</h2>
          <p>Solved {runState.score} of {runState.attempted} {mode === 'rush' ? 'before time ran out or three strikes' : 'assessment puzzles you had not seen before'}.</p>
          {mode === 'assessment' && <p className="small muted">Assessment puzzles are never reused, so this result reflects first attempts. Ten puzzles is a small sample; the Lab combines all your assessments and shows the uncertainty.</p>}
          <button className="btn primary" onClick={onExit}>Back to the Academy</button>
        </div>
      ) : !current ? (
        <div className="panel"><p>{mode === 'assessment' ? 'You have seen every assessment puzzle. New ones appear when the puzzle bank grows.' : 'No puzzles match this choice. Pick another mode or theme.'}</p><button className="btn" onClick={onExit}>Back</button></div>
      ) : (
        <PuzzlePlayer key={current.id} p={current} reveal={mode !== 'rush' && mode !== 'assessment'} onDone={async res => { await record(current, res); }} onNext={() => pick()} onPlayOut={mode === 'endgame' ? () => void playOut(current) : undefined} autoNext={mode === 'rush' || mode === 'assessment'} />
      )}
    </div>
  );
}

function PuzzlePlayer({ p, onDone, onNext, onPlayOut, reveal, autoNext }: {
  p: Puzzle; reveal: boolean; autoNext: boolean;
  onDone: (r: { solved: boolean; clean: boolean; hints: number; revealed: boolean; msFirst: number; msTotal: number; firstMove: string | null }) => Promise<void> | void;
  onNext: () => void; onPlayOut?: () => void;
}) {
  const [pos] = useState(() => Position.fromFen(p.fen));
  const [step, setStep] = useState(0);
  const [fen, setFen] = useState(p.fen);
  const [last, setLast] = useState<string | null>(null);
  const [status, setStatus] = useState<'playing' | 'wrong' | 'solved' | 'failed'>('playing');
  const [hints, setHints] = useState(0);
  const [mistaken, setMistaken] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [firstMove, setFirstMove] = useState<string | null>(null);
  const t0 = useRef(Date.now());
  const tFirst = useRef<number | null>(null);
  const reported = useRef(false);
  const orientation = Position.fromFen(p.fen).side === 0 ? 'white' : 'black';

  const finish = (solved: boolean, rev = revealed) => {
    if (reported.current) return;
    reported.current = true;
    void Promise.resolve(onDone({ solved, clean: solved && !mistaken && hints === 0 && !rev, hints, revealed: rev, msFirst: (tFirst.current ?? Date.now()) - t0.current, msTotal: Date.now() - t0.current, firstMove })).then(() => { if (autoNext) setTimeout(onNext, solved ? 500 : 1200); });
  };
  const apply = (ccn: string) => { pos.makeMove(parseLegalCcn(pos, ccn)); setFen(pos.toFen()); setLast(ccn); };

  const onMove = (ccn: string) => {
    if (status !== 'playing' && status !== 'wrong') return;
    if (tFirst.current === null) { tFirst.current = Date.now(); setFirstMove(ccn); }
    const ok = ccn === p.solution[step] || (step === 0 && p.accept?.includes(ccn));
    if (!ok) {
      setMistaken(true);
      setStatus('wrong');
      if (autoNext) { setStatus('failed'); finish(false); }
      return;
    }
    apply(ccn);
    setStatus('playing');
    const next = step + 1;
    if (next >= p.solution.length || (step === 0 && p.accept?.includes(ccn) && ccn !== p.solution[0])) { setStatus('solved'); finish(true); return; }
    setTimeout(() => { apply(p.solution[next]); setStep(next + 1); if (next + 1 >= p.solution.length) { setStatus('solved'); finish(true); } }, 450);
    setStep(next);
  };
  const doReveal = () => {
    setRevealed(true);
    const rest = p.solution.slice(step);
    rest.forEach((m, i) => setTimeout(() => apply(m), 500 * (i + 1)));
    setStep(p.solution.length);
    setStatus('failed');
    finish(false, true);
  };
  const legal = status === 'playing' || status === 'wrong' ? pos.legalMoves().map(moveToCcn) : [];
  const hintSq = hints > 0 && step < p.solution.length ? [p.solution[step].slice(0, 2)] : [];
  const check = Position.fromFen(fen);
  return (
    <div className="analysis">
      <div className="board-col">
        <Board fen={fen} orientation={orientation} legal={step % 2 === 0 ? legal : []} onMove={onMove} lastMove={last} checkSquare={check.inCheck() ? squareName(check.kingSq[check.side]) : null} highlights={hintSq} label="Puzzle Board" />
      </div>
      <div className="side-col">
        <div className="panel stack" data-testid="puzzle-panel" data-puzzle={p.id} data-solution={p.solution.join(' ')} data-status={status}>
          <div className="panel-title"><h3 style={{ margin: 0 }}>{orientation === 'white' ? 'White' : 'Black'} to Move</h3><span className="chip gold">Difficulty {p.difficulty}/5</span></div>
          <div><strong>{p.goal}</strong>{p.playerMoves > 1 && <span className="muted"> · {p.playerMoves} moves</span>}</div>
          <div className="row">{p.themes.slice(0, 4).map(t => <span key={t} className="chip">{themeLabel(t)}</span>)}</div>
          {status === 'wrong' && <div className="notice warn" role="status">That is not the best move. Look again{p.themes.includes('defensive') ? ' — what does your opponent threaten?' : ''}.</div>}
          {status === 'solved' && <div className="notice" role="status">Solved{mistaken || hints ? ' with help, so it does not count as a clean solve' : ''}. Line: {p.solutionSan.join(' ')}</div>}
          {status === 'failed' && <div className="notice warn" role="status">Solution: {p.solutionSan.join(' ')}</div>}
          <div className="row">
            {(status === 'playing' || status === 'wrong') && !autoNext && <button className="btn" onClick={() => setHints(h => h + 1)}>Hint</button>}
            {(status === 'playing' || status === 'wrong') && reveal && <button className="btn ghost" onClick={doReveal}>Show Solution</button>}
            {(status === 'solved' || status === 'failed') && !autoNext && <button className="btn primary" onClick={onNext}>Next Puzzle</button>}
            {onPlayOut && (status === 'solved' || status === 'failed') && <button className="btn" onClick={onPlayOut}>Play It Out vs the Engine</button>}
          </div>
          {p.source === 'mistake' && <div className="small muted">From your game (move {Math.ceil((p.sourcePly ?? 0) / 2)}). Moves almost as good as the best one are accepted.</div>}
          <details className="small muted">
            <summary>Details</summary>
            Engine check at depth {p.verification.crownDepth}: the solution beats the next move by {p.verification.gap.toFixed(2)} expected score{p.verification.fairy && p.verification.fairy !== 'not run' && !p.verification.fairy.startsWith('n/a') ? `; Fairy-Stockfish cross-check ${p.verification.fairy}` : ''}. {p.source === 'mistake' ? 'Moves within 0.02 of the best are accepted.' : 'Best under this search setting; not a mathematical proof.'}
          </details>
        </div>
      </div>
    </div>
  );
}
