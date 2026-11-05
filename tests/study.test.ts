/**
 * Crownmaster Study Match (src/app/study.ts, src/app/studyExplain.ts, src/ui/StudyScreen.tsx):
 *  - a study game is always unrated: no rating event (even if its record were forged), no Federation result, no market,
 *    no Vault fact, no permanent Played Like record;
 *  - aids are never available in rated (or any non-study) games: the service guard refuses, the panel renders none,
 *    and the evaluation bar gate stays closed;
 *  - explanation text only comes from engine data (a real analysis, engine lines replayed on the board);
 *  - save / reload / resume keeps moves, aid switches and feedback.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MODEL from '../src/analysis/played-like-model.json';
import { CrownDB } from '../src/storage/db';
import { gameChecksum } from '../src/storage/checksum';
import { backfillPlayedLike, recordPlayedLike } from '../src/storage/playedLikeStore';
import { needsRecord } from '../src/analysis/playedLikeRecords';
import { GameSession, createGameRecord } from '../src/games/session';
import { TIME_CONTROLS, type GameRecord, type ParticipantSnapshot } from '../src/games/types';
import type { LitePly } from '../src/analysis/playedLikeFeatures';
import type { AnalysisReport } from '../src/analysis/types';
import { buildFacts, eligible } from '../src/vault/facts';
import { FederationService } from '../src/app/federation';
import { playSelfplay } from '../src/engine/selfplay';
import { analyzeGame, ANALYSIS_PRESETS } from '../src/analysis/analyzer';
import { Searcher } from '../src/engine/search';
import { Position } from '../src/rules/position';
import { moveToCcn, moveToSan } from '../src/rules/notation';
import { START_FEN } from '../src/rules/types';
import {
  STUDY_LABEL, StudyAidRefused, addFeedback, assertStudyAids, createStudyGame, gameModeLabel, isStudyGame, recordAid, setAid, studyAidsAllowed, studyState,
  takeBack, takeBackPlies,
} from '../src/app/study';
import { estimateLabel, explainBestMove, explainFeedback, hintText, lineFacts, materialOf } from '../src/app/studyExplain';
import { EvalBoard, evalBarAllowed } from '../src/ui/MatchCenter';
import { StudyAidsPanel, feedbackFromPly } from '../src/ui/StudyScreen';

const engine: ParticipantSnapshot = { kind: 'engine', id: 'L0b', name: 'Pip Wren', rating: 446, rd: 60, engine: { profileId: 'L0b', level: 0, levelsId: 'x', searchId: 's', evalId: 'e', calibrationId: 'cal', style: 'standard' } };
const human = { kind: 'human' as const, id: 'player', name: 'You', rating: 1500, rd: 80 };
const NOW = '2026-11-05T10:00:00.000Z';
const study = (over: Partial<Parameters<typeof createStudyGame>[0]> = {}) =>
  createStudyGame({ id: 'study-test-1', humanColor: 'white', engine, engineSeed: 7, nowIso: NOW, aids: { hint: true, best: true, eval: true, feedback: true, takeback: true }, ...over });
const MOVES = ['c2c3', 'c5c4', 'e1f3', 'e6f4'];

function play(rec: GameRecord, moves = MOVES): GameSession {
  const s = new GameSession(rec);
  s.start(0);
  for (const m of moves) { const r = s.applyMove(m, 1, NOW); if (!r.ok) throw new Error(r.error); }
  return s;
}
function finishedStudy(id = 'study-test-1'): GameRecord {
  const s = play(study({ id }));
  s.resign(1, 2, '2026-11-05T10:10:00.000Z'); // Black (engine) resigns: a win for the learner
  return s.snapshot();
}
function plies(n: number): LitePly[] {
  const out: LitePly[] = [];
  for (let i = 0; i < n; i++) for (const c of [0, 1] as const) {
    const ub = 0.5, loss = i % 5 === 0 ? 0.08 : 0.01;
    out.push({ ply: 2 * i + 1 + c + 4, c, forced: 0, legal: 12, ph: 1, loss, lossPrev: loss, g: -1, ub, up: ub - loss, cu: [ub, ub - 0.06, ub - 0.12] });
  }
  return out;
}
const report = (gameId: string) => ({
  id: `report:${gameId}:x:${MODEL.analysis.engine}:${MODEL.analysis.settings}:${MODEL.analysis.grading}`, gameId, status: 'complete',
  settings: { id: MODEL.analysis.settings }, engine: { buildId: MODEL.analysis.engine }, methodology: { gradingId: MODEL.analysis.grading },
  completedAt: '2026-11-05T10:20:00Z', plies: plies(30), summary: {},
}) as unknown as AnalysisReport;

describe('a Study Match record', () => {
  it('is casual, untimed, unrated, without a pool or a rating snapshot of the learner, and labelled everywhere', () => {
    const g = study();
    expect(g).toMatchObject({ mode: 'casual', rated: false, pool: null, clocks: null, ratingEventId: null, context: { kind: 'study' } });
    expect(g.timeControl.id).toBe('untimed');
    expect(g.white).toMatchObject({ kind: 'human', rating: null, rd: null });
    expect(g.context.eventName).toBe(`${STUDY_LABEL} · vs Pip Wren`);
    expect(isStudyGame(g)).toBe(true);
    expect(gameModeLabel(g)).toBe('Study — unrated');
    expect(studyAidsAllowed(g)).toBe(true);
    expect(() => createStudyGame({ id: 'qm-x', humanColor: 'white', engine, engineSeed: 1, nowIso: NOW })).toThrow(/study-/);
    expect(() => createStudyGame({ humanColor: 'white', engine: { ...human }, engineSeed: 1, nowIso: NOW })).toThrow(/engine opponent/);
  });
});

describe('study games are unrated and never touch official records', () => {
  it('finalizes without a rating event or rating change — even if the record were forged as rated', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const before = await db.ratingState('rapid');
    const g = finishedStudy();
    const r = await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: NOW, analysisSettingsId: 'std-d7', humanScore: 1 });
    expect(r.event).toBeNull();
    expect(r.game.ratingEventId).toBeNull();
    const forged = { ...finishedStudy('study-forged'), rated: true, mode: 'rated', pool: 'rapid' } as GameRecord;
    const r2 = await db.finalizeGame(forged, { checksum: await gameChecksum(forged), nowIso: NOW, analysisSettingsId: 'std-d7', humanScore: 1 });
    expect(r2.event).toBeNull();
    expect(await db.ratingEvents()).toHaveLength(0);
    expect(await db.ratingState('rapid')).toEqual(before);
  });

  it('gets no permanent Played Like record (the analysis still carries Played Like for display)', async () => {
    const db = await CrownDB.open(new IDBFactory());
    const g = finishedStudy();
    await db.finalizeGame(g, { checksum: await gameChecksum(g), nowIso: NOW, analysisSettingsId: 'std-d7', humanScore: 1 });
    await db.addReport(report(g.id));
    const saved = (await db.getGame(g.id))!;
    expect(needsRecord(saved, [report(g.id)])).toBeNull();
    expect(await recordPlayedLike(db, g.id)).toBe(false);
    expect(await backfillPlayedLike(db)).toBe(0);
    expect((await db.getGame(g.id))!.playedLike).toBeUndefined();
    // control: the same game as an ordinary casual game does get its record
    const c = new GameSession(createGameRecord({ id: 'g-casual', mode: 'casual', timeControl: TIME_CONTROLS.rapid, humanColor: 'white', human, engine, engineSeed: 1, nowIso: NOW }));
    c.start(0); for (const m of MOVES) c.applyMove(m, 1, NOW); c.resign(1, 2, NOW);
    const cg = c.snapshot();
    await db.finalizeGame(cg, { checksum: await gameChecksum(cg), nowIso: NOW, analysisSettingsId: 'std-d7', humanScore: 1 });
    await db.addReport(report(cg.id));
    expect(await recordPlayedLike(db, cg.id)).toBe(true);
  });

  it('never counts toward Vault facts: games, wins, analyses or saved positions', () => {
    const g = { ...finishedStudy(), status: 'finalized' as const, bookmarks: [3] };
    expect(eligible(g)).toBe(false);
    const f = buildFacts({ games: [g], ratingEvents: [], reports: [report(g.id)] });
    expect(f.games).toHaveLength(0);
    expect(f.countedWins).toEqual(buildFacts({ games: [], ratingEvents: [], reports: [] }).countedWins);
    expect(f.analyses.complete).toBe(0);
    expect(f.bookmarks).toBe(0);
    // control: an ordinary casual game with the same moves counts
    const casual = { ...g, id: 'g-casual', context: { kind: 'quick-match' as const }, study: undefined };
    const fc = buildFacts({ games: [casual], ratingEvents: [], reports: [report('g-casual')] });
    expect(fc.games).toHaveLength(1);
    expect(fc.analyses.complete).toBe(1);
  });

  it('never carries a market, never records a Federation result, and keeps a competitor’s profile and style', { timeout: 120_000 }, async () => {
    const db = await CrownDB.open(new IDBFactory());
    let clock = 0;
    const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString());
    svc.runSelfplay = async (req, onMove) => playSelfplay(req.initialFen, { ...req.white, profile: { ...req.white.profile, nodes: 150, depth: 3, selection: null } }, { ...req.black, profile: { ...req.black.profile, nodes: 150, depth: 3, selection: null } }, req.seed, req.maxPlies, m => onMove(m));
    await svc.create(3, 1234);
    const g = study();
    expect(FederationService.sandboxIneligible(g)).toMatch(/Study/);
    await expect(svc.openSandbox(g, [0.4, 0.2, 0.4])).rejects.toThrow();
    expect(svc.sandboxMarketFor(g.id)).toBeUndefined();
    // a study record carrying a (forged) real fixture id records nothing
    const fx = svc.blockingFixtures()[0];
    const forged = { ...finishedStudy(), status: 'finalized', context: { kind: 'study', fixtureId: fx.id } } as GameRecord;
    const markets = svc.state!.markets.size;
    await svc.recordPlayerGame(forged);
    expect(svc.state!.rounds.get(`${svc.state!.world.season}:${svc.state!.world.round}`)!.fixtures.find(f => f.id === fx.id)!.result).toBeNull();
    expect(svc.state!.markets.size).toBe(markets);
    // a Federation competitor as the study opponent: its own calibrated profile and style
    const c = [...svc.state!.competitors.values()].find(x => x.status === 'active')!;
    const qm = await svc.quickMatchGameFor(c.id, { rated: false, humanColor: 'white', human: { rating: null, rd: null }, nowMs: 1 });
    const sg = createStudyGame({ humanColor: 'white', engine: qm.black, engineSeed: qm.engineSeed, nowIso: NOW, nowMs: 1 });
    expect(sg.black.engine?.profile).toEqual(qm.black.engine?.profile);
    expect(sg.black.engine?.styleId).toBe(qm.black.engine?.styleId);
    expect(sg).toMatchObject({ rated: false, pool: null, context: { kind: 'study' } });
    expect(FederationService.sandboxIneligible(sg)).toMatch(/Study/);
  });
});

describe('aids are never available outside an unfinished study game', () => {
  const rated = () => createGameRecord({ id: 'g-rated', mode: 'rated', timeControl: TIME_CONTROLS.classical60, humanColor: 'white', human, engine, engineSeed: 1, nowIso: NOW });
  const casual = () => createGameRecord({ id: 'g-casual', mode: 'casual', timeControl: TIME_CONTROLS.untimed, humanColor: 'white', human, engine, engineSeed: 1, nowIso: NOW });

  it('the service guard refuses every aid command for rated, ordinary casual and finished games', () => {
    for (const g of [rated(), casual(), { ...finishedStudy(), status: 'finalized' as const }, { ...study(), rated: true } as GameRecord, { ...study(), timeControl: TIME_CONTROLS.rapid }]) {
      expect(studyAidsAllowed(g)).toBe(false);
      expect(() => assertStudyAids(g)).toThrow(StudyAidRefused);
      expect(() => recordAid(g, 'hint', NOW)).toThrow(StudyAidRefused);
      expect(() => setAid(g, 'eval', true)).toThrow(StudyAidRefused);
      expect(() => takeBack(g, NOW)).toThrow(StudyAidRefused);
      expect(takeBackPlies(g)).toBe(0);
    }
    expect(() => assertStudyAids(rated())).toThrow(/never available in rated games/);
    expect(rated().assistance).toHaveLength(0);
  });

  it('an aid that is switched off is refused; each use is recorded once per position', () => {
    const g = study({ aids: { hint: false, eval: true } });
    expect(() => recordAid(g, 'hint', NOW)).toThrow(/switched off/);
    setAid(g, 'hint', true);
    expect(recordAid(g, 'hint', NOW, { once: true })).toBe(true);
    expect(recordAid(g, 'hint', NOW, { once: true })).toBe(false);
    expect(recordAid(g, 'evaluation', NOW, { once: true })).toBe(true);
    expect(g.assistance.map(a => a.kind)).toEqual(['hint', 'evaluation']);
    expect(g.rated).toBe(false);
  });

  it('take back removes the learner’s last move and the reply, and the feedback for them', () => {
    const s = play(study());
    const g = s.snapshot();
    addFeedback(g, { ply: 3, san: 'Nf3', grade: 'good', loss: 0.03, provisional: false, forced: false, depth: 7, settingsId: 'std-d7', bestSan: 'Nf3', bestPvSan: [], playedPvSan: [], evalBefore: { kind: 'cp', value: 0, pov: 'white' }, evalAfter: { kind: 'cp', value: 0, pov: 'white' }, fenBefore: START_FEN, bestPv: [], playedPv: [] }, NOW);
    expect(takeBackPlies(g)).toBe(2);
    const t = takeBack(g, NOW);
    expect(t.moves.map(m => m.ccn)).toEqual(MOVES.slice(0, 2));
    expect(studyState(t).feedback).toHaveLength(0);
    expect(t.assistance.map(a => a.kind)).toEqual(['feedback', 'takeback']);
    expect(new GameSession(t).pos.toFen()).toBe(g.moves[1].fenAfter);
    // nothing to take back at the start
    expect(takeBackPlies(study())).toBe(0);
    // a learner playing Black: only the engine has moved → nothing to take back
    const b = new GameSession(study({ humanColor: 'black', id: 'study-black' })); b.start(0); b.applyMove('c2c3', 1, NOW);
    expect(takeBackPlies(b.snapshot())).toBe(0);
  });

  it('the aids panel renders no aid control for a rated game, and the evaluation bar gate stays closed', () => {
    const noop = () => {};
    const props = { humanToMove: true, busy: false, grading: null, onToggle: noop, onHint: noop, onBest: noop, onTakeBack: noop, hint: 'x', bestLines: ['y'], evalText: 'z' };
    const lockedHtml = renderToStaticMarkup(createElement(StudyAidsPanel, { ...props, record: rated() }));
    expect(lockedHtml).toContain('study-aids-locked');
    expect(lockedHtml).toContain('Engine help is off in rated games.');
    for (const t of ['study-hint', 'study-best', 'study-takeback', 'study-aid-eval', 'study-aid-feedback']) expect(lockedHtml).not.toContain(`data-testid="${t}"`);
    expect(renderToStaticMarkup(createElement(StudyAidsPanel, { ...props, record: casual() }))).toContain('study-aids-locked');
    const openHtml = renderToStaticMarkup(createElement(StudyAidsPanel, { ...props, record: study() }));
    for (const t of ['study-hint', 'study-best', 'study-takeback', 'study-aid-eval', 'study-aid-feedback']) expect(openHtml).toContain(`data-testid="${t}"`);
    expect(openHtml).toContain('Study — unrated');
    // the bar: only a study game whose aids are allowed may show it; live play never
    expect(evalBarAllowed({ kind: 'play', rated: true })).toBe(false);
    expect(evalBarAllowed({ kind: 'play', rated: false })).toBe(false);
    expect(evalBarAllowed({ kind: 'study', aidsAllowed: studyAidsAllowed(rated()) })).toBe(false);
    expect(evalBarAllowed({ kind: 'study', aidsAllowed: studyAidsAllowed(study()) })).toBe(true);
    const score = { kind: 'cp' as const, value: 40, pov: 'white' as const };
    expect(renderToStaticMarkup(createElement(EvalBoard, { context: { kind: 'study', aidsAllowed: false }, score, orientation: 'white', source: 'Engine estimate, depth 6', children: 'board' }))).not.toContain('eval-bar');
    expect(renderToStaticMarkup(createElement(EvalBoard, { context: { kind: 'study', aidsAllowed: true }, score, orientation: 'white', source: 'Engine estimate, depth 6', children: 'board' }))).toContain('eval-bar');
  });
});

describe('explanations come only from engine data', () => {
  // 6×6: White queen c2 can take the undefended Black queen on c4
  const QFEN = '3k2/6/2q3/6/2Q3/3K2 w - - 0 1';
  it('material and mate facts are measured by replaying the engine line on the board', () => {
    expect(materialOf(START_FEN)).toEqual({ white: 31, black: 31 }); // 6 pawns, 2 knights, 2 rooks, a queen
    expect(lineFacts(QFEN, ['c2c4'], 'white')).toMatchObject({ applied: 1, materialDelta: 9, endsInMate: false });
    expect(lineFacts(QFEN, ['c2c4'], 'black').materialDelta).toBe(-9);
    expect(lineFacts(QFEN, ['a1a1', 'c2c4'], 'white').applied).toBe(0); // an illegal line is not replayed (no claim)
  });

  it('the best-move text is a template of the engine candidate: move, score, depth, line, measured material', () => {
    const lines = explainBestMove({ fen: QFEN, pov: 'white', depth: 6, candidate: { ccn: 'c2c4', san: 'Qxc4', score: { kind: 'cp', value: 905, pov: 'white' }, pv: ['c2c4'], pvSan: ['Qxc4'] } });
    expect(lines).toEqual([
      'Engine estimate, depth 6 — not a perfect analysis.',
      'Best move: Qxc4 (evaluation +9.05).',
      'Along this line you win 9 points of material (pawn 1, knight 3, rook 5, queen 9).',
    ]);
    // no line, no material/mate claims: nothing is invented
    const bare = explainBestMove({ fen: QFEN, pov: 'white', depth: 4, candidate: { ccn: 'd1e1', san: 'Ke1', score: { kind: 'cp', value: -12, pov: 'white' }, pv: [], pvSan: [] } });
    expect(bare).toEqual(['Engine estimate, depth 4 — not a perfect analysis.', 'Best move: Ke1 (evaluation −0.12).']);
    expect(hintText({ ccn: 'c2c4', san: 'Qxc4', score: { kind: 'cp', value: 905, pov: 'white' }, pv: [], pvSan: [] }, 6)).toBe('Engine hint (depth 6): consider moving the piece on c2.');
  });

  it('a mate on the engine line is stated only when the replayed line really ends in checkmate', () => {
    // find a real mate-in-one position from the engine's own search: K+Q vs K
    const fen = 'k5/6/1K4/6/6/4Q1 w - - 0 1';
    const pos = Position.fromFen(fen);
    const mates = pos.legalMoves().filter(m => { pos.makeMove(m); const ok = pos.legalMoves().length === 0 && pos.inCheck(); pos.unmakeMove(); return ok; });
    expect(mates.length).toBeGreaterThan(0);
    const ccn = moveToCcn(mates[0]), san = moveToSan(pos, mates[0]);
    const lines = explainBestMove({ fen, pov: 'white', depth: 6, candidate: { ccn, san, score: { kind: 'mate', plies: 1, pov: 'white', proven: false }, pv: [ccn], pvSan: [san] } });
    expect(lines).toContain('The engine line ends in checkmate for you.');
    // the same score without a mating line: only the engine's score is reported, labelled as an estimate
    const quiet = pos.legalMoves().find(m => !mates.includes(m))!;
    const l2 = explainBestMove({ fen, pov: 'white', depth: 6, candidate: { ccn: moveToCcn(quiet), san: moveToSan(pos, quiet), score: { kind: 'mate', plies: 3, pov: 'white', proven: false }, pv: [moveToCcn(quiet)], pvSan: [moveToSan(pos, quiet)] } });
    expect(l2.some(l => l.includes('checkmate'))).toBe(false);
    expect(l2).toContain('The engine’s score is mate in 2 for you (engine estimate, not a proof).');
  });

  it('move feedback is built from a real standard analysis of the move: grade, loss, evaluations and the engine lines', { timeout: 120_000 }, () => {
    const settings = ANALYSIS_PRESETS.find(s => s.id === 'quick-d5')!;
    // the learner (White) plays a3-ish c2c3 after two setup plies; analysed exactly like the Study screen does
    const rep = analyzeGame({ gameId: 'study-x:feedback:3', checksum: 'study-feedback', initialFen: START_FEN, setupMoves: ['c2c3', 'c5c4'], moves: ['e1f3'] }, settings, {}, new Searcher(16));
    const p = rep.plies[0];
    const pre = Position.fromFen(START_FEN); for (const m of ['c2c3', 'c5c4']) pre.makeMove(pre.legalMoves().find(x => moveToCcn(x) === m)!);
    const f = feedbackFromPly(p, pre.toFen(), settings.depth, settings.id);
    const { headline, lines } = explainFeedback(f, 'white');
    expect(headline.startsWith(`${p.san}: `)).toBe(true);
    if (p.loss !== null) expect(headline).toContain(`expected-score loss ${p.loss.toFixed(2)}`);
    expect(lines[0]).toBe(estimateLabel(5, 'Standard analysis (quick-d5)'));
    // every move named in the text is the played move, the engine's best move or a move of an engine line
    const allowedSan = new Set([p.san, p.best.san, ...p.best.pvSan, ...p.played.pvSan]);
    const named = lines.slice(1).join(' ').match(/\b(?:[KQRN]?[a-f]?[1-6]?x?[a-f][1-6](?:=[QRN])?[+#]?)/g) ?? [];
    for (const n of named) expect(allowedSan.has(n) || [...allowedSan].some(a => a.startsWith(n))).toBe(true);
    // never claims perfection or certainty
    for (const l of [headline, ...lines]) expect(l).not.toMatch(/\b(perfect(?!\s+analysis)|certain|always|guarantee)/i);
    expect(lines.join(' ')).toContain('not a perfect analysis');
  });
});

describe('save and resume', () => {
  it('a study game in progress survives a reload with its moves, aid switches and feedback, and resumes playable', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    const s = play(study());
    setAid(s.record, 'eval', false);
    addFeedback(s.record, { ply: 3, san: 'Nf3', grade: 'inaccuracy', loss: 0.07, provisional: false, forced: false, depth: 7, settingsId: 'std-d7', bestSan: 'Qd3', bestPvSan: ['Qd3'], playedPvSan: ['Nf3'], evalBefore: { kind: 'cp', value: 20, pov: 'white' }, evalAfter: { kind: 'cp', value: -10, pov: 'white' }, fenBefore: s.record.moves[1].fenAfter, bestPv: [], playedPv: [] }, NOW);
    await db.saveGame(s.snapshot());
    const db2 = await CrownDB.open(f);
    const g = (await db2.getGame('study-test-1'))!;
    expect((await db2.unfinishedGames()).map(x => x.id)).toContain('study-test-1');
    expect(g.moves.map(m => m.ccn)).toEqual(MOVES);
    expect(studyState(g).aids).toMatchObject({ eval: false, hint: true, feedback: true });
    expect(studyState(g).feedback.map(x => [x.ply, x.grade])).toEqual([[3, 'inaccuracy']]);
    const resumed = new GameSession(g);
    resumed.start(10);
    expect(resumed.pos.toFen()).toBe(s.pos.toFen());
    expect(resumed.applyMove('c3c4', 11, NOW).ok || resumed.legalMoves().length > 0).toBe(true);
    expect(studyAidsAllowed(g)).toBe(true);
    // the study state is not part of the checksum (rules-relevant content only)
    expect(await gameChecksum({ ...g, study: undefined })).toBe(await gameChecksum(g));
  });
});
