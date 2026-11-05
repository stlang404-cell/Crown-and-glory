/**
 * Played Like Performance Elo UI (crown-played-like-2). Career Elo (Glicko-2, from results) and Played Like (from this
 * game's moves only) side by side for BOTH sides.
 *
 * Integration API (for the Replay & Analysis Center, spectator archives, result overlay, summaries):
 *  - usePlayedLike(gameId)            → { report, white, black } for any game id with stored reports (player games and
 *                                        federation engine games "wg:<fixtureId>"); re-reads on services.revision.
 *  - <PlayedLikePanel report sides>   → the full two-sided card for any report; sides = { white: { name, career }, black }.
 *  - <PlayedLikeLine name color career pl /> → one compact line: "White — Career 1,427 · Played like 2,190 ± 240".
 *  - fmtPlayedLike / fmtPlayedLikeDetail → plain strings (tables, lists).
 *  - <PlayedLikeCard …>               → the player's post-game card (AnalysisScreen), unchanged signature.
 *  - <PlayedLikeResultLines gameId sides> → result overlay block; <PlayedLikeCareerPanel games onOpenGame> → Passport records.
 */
import { useEffect, useState } from 'react';
import type { AnalysisReport, Pov, SideSummary } from '../analysis/types';
import type { RatingEvent } from '../ratings/ledger';
import { PLAYED_LIKE_ID, PLAYED_LIKE_INFO, PLAYED_LIKE_VALIDATED, playedLike, reportForPlayedLike, type PlayedLike } from '../analysis/playedLike';
import { useServices } from './App';
import { RatingChart } from './Charts';
import type { GameRecord } from '../games/types';
import { ADEQUATE_MOVES, CONFIDENCE_LABEL, playedLikeCareer, type PlayedLikeGameRecord } from '../analysis/playedLikeRecords';

const n0 = (x: number) => Math.round(x).toLocaleString('en-US');

/** The headline value: "2,190 ± 240", or a status word. */
export function fmtPlayedLike(p: PlayedLike): string {
  switch (p.status) {
    case 'ok': return `${n0(p.rating)} ± ${n0(p.half80)}`;
    case 'insufficient': return 'Insufficient information';
    case 'pending': return 'Waiting for analysis';
    case 'other-settings': return 'Needs Standard analysis';
    case 'uncalibrated': return 'Calibrating';
  }
}

/** The explanatory sub-line under the value. */
export function fmtPlayedLikeDetail(p: PlayedLike): string {
  switch (p.status) {
    case 'ok': return `80 % range ${n0(p.low)}–${n0(p.high)}${p.capped ? '+' : ''} · ${p.moves} informative moves`;
    case 'insufficient': return `${p.moves} informative move${p.moves === 1 ? '' : 's'}; needs ${p.needed} (forced, opening and already-lost moves are left out)`;
    case 'pending': return 'Appears when the move-by-move analysis is complete';
    case 'other-settings': return `This analysis used ${p.settingsId}; Played Like is calibrated on Standard (depth 7) analysis`;
    case 'uncalibrated': return 'Not shown until the model beats simpler estimates on held-out games';
  }
}

export interface PlayedLikeSideInfo { name: string; /** career Elo (number), a ready string such as "1,412 → 1,427", or null = unrated */ career: number | string | null }

const careerText = (c: PlayedLikeSideInfo['career']) => (c === null ? 'Unrated' : typeof c === 'number' ? n0(c) : c);

/** One compact line for lists, overlays and archives. */
export function PlayedLikeLine({ name, color, career, pl, testId }: { name?: string; color: Pov; career: PlayedLikeSideInfo['career']; pl: PlayedLike; testId?: string }) {
  return (
    <div className="small" data-testid={testId}>
      <strong>{name ?? (color === 'white' ? 'White' : 'Black')}</strong>{name ? <span className="muted"> ({color === 'white' ? 'White' : 'Black'})</span> : null}
      {' — '}Career <span className="mono">{careerText(career)}</span> · Played like <span className="mono" data-testid={testId ? `${testId}-value` : undefined}>{fmtPlayedLike(pl)}</span>
    </div>
  );
}

function Side({ name, color, career, summary, pl, testId }: { name: string; color: Pov; career: string; summary: SideSummary; pl: PlayedLike; testId: string }) {
  return (
    <div className="stack" style={{ gap: 6 }} data-testid={testId}>
      <strong>{name} <span className="small muted">· {color === 'white' ? 'White' : 'Black'}</span></strong>
      <div className="stat"><span className="k">Career Elo</span><span className="v mono">{career}</span><span className="small muted">from results (Glicko-2)</span></div>
      <div className="stat"><span className="k">Played Like</span><span className="v mono" data-testid={`${testId}-value`}>{fmtPlayedLike(pl)}</span>
        <span className="small muted">{fmtPlayedLikeDetail(pl)}</span></div>
      <div className="small">Accuracy {summary.accuracy === null ? '—' : summary.accuracy.toFixed(1)} · Blunders {summary.counts.blunder} · Mistakes {summary.counts.mistake} · Best {summary.counts.best}</div>
    </div>
  );
}

function Explainer() {
  const [lo, hi] = PLAYED_LIKE_INFO.calibratedRange;
  const h = (PLAYED_LIKE_INFO.validation as { heldOut?: { mae?: number; n?: number } }).heldOut;
  return (
    <details className="small" style={{ marginTop: 8 }}>
      <summary>What “Played Like” means</summary>
      <p>A performance rating for this one game: the Crown-scale strength whose moves typically look like these, judged from the move-by-move analysis (how much each move lost against the engine's best play, how often errors and only-moves came up, and how hard the positions were). Forced moves, the first two moves each and moves in already-lost positions are left out. It ignores the result and both ratings and never changes anyone's rating — only results do.</p>
      <p>One game is a small sample: the ± is the 80 % range, and it narrows as the number of informative moves grows. Calibrated on {PLAYED_LIKE_VALIDATED && h?.n ? `held-out ` : ''}engine games of measured strength from {lo} to {n0(hi)} on the Crown scale{PLAYED_LIKE_VALIDATED && h?.mae ? ` (typical error on held-out games ±${n0(h.mae)})` : ''} — engine play only, no human games, not FIDE.</p>
    </details>
  );
}

/** Two-sided Played Like card for any analysed game (player games, engine archives, replays). */
export function PlayedLikePanel({ report, sides, onOpenMoves, testIds = { white: 'played-like-white', black: 'played-like-black' }, order = ['white', 'black'] }: {
  report: AnalysisReport; sides: Record<Pov, PlayedLikeSideInfo>; onOpenMoves?: () => void; testIds?: Record<Pov, string>; order?: [Pov, Pov];
}) {
  return (
    <div className="panel" data-testid="played-like">
      <div className="panel-title"><h3>Played Like</h3><span className="chip gold" title={PLAYED_LIKE_INFO.status}>Performance Elo · Estimate</span></div>
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {order.map(pov => <Side key={pov} name={sides[pov].name} color={pov} career={careerText(sides[pov].career)} summary={report.summary[pov]} pl={playedLike(report, pov)} testId={testIds[pov]} />)}
      </div>
      <Explainer />
      {onOpenMoves && <button className="btn small" style={{ marginTop: 8 }} onClick={onOpenMoves}>See Move-by-Move Analysis</button>}
    </div>
  );
}

/** Post-game performance card for the player's own game (AnalysisScreen): the player first, then the opponent. */
export function PlayedLikeCard({ report, human, humanName, oppName, oppRating, event, onOpenMoves }: {
  report: AnalysisReport; human: Pov; humanName: string; oppName: string; oppRating: number | null; event: RatingEvent | null; onOpenMoves?: () => void;
}) {
  const other: Pov = human === 'white' ? 'black' : 'white';
  const myCareer = event ? `${n0(event.before.rating)} → ${n0(event.after.rating)}` : 'Unrated game';
  const sides = { [human]: { name: humanName, career: myCareer }, [other]: { name: oppName, career: oppRating } } as Record<Pov, PlayedLikeSideInfo>;
  return <PlayedLikePanel report={report} sides={sides} onOpenMoves={onOpenMoves} order={[human, other]}
    testIds={{ [human]: 'played-like-you', [other]: 'played-like-opp' } as Record<Pov, string>} />;
}

/** Played Like for any stored game (player game id or "wg:<fixtureId>"), refreshed as analysis completes. */
export function usePlayedLike(gameId: string | null | undefined): { report: AnalysisReport | null; white: PlayedLike; black: PlayedLike } {
  const services = useServices();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  useEffect(() => {
    let live = true;
    if (!gameId) { setReport(null); return; }
    void services.reportsFor(gameId).then(rs => { if (live) setReport(reportForPlayedLike(rs)); }).catch(() => { if (live) setReport(null); });
    return () => { live = false; };
  }, [gameId, services, services.revision]);
  return { report, white: playedLike(report, 'white'), black: playedLike(report, 'black') };
}

/** Compact two-line Played Like block for a just-finished game (result overlay); updates when the analysis lands. */
export function PlayedLikeResultLines({ gameId, sides }: { gameId: string; sides: Record<Pov, PlayedLikeSideInfo> }) {
  const { white, black } = usePlayedLike(gameId);
  if (white.status === 'pending' && black.status === 'pending') return <p className="small muted" data-testid="result-played-like">Played Like appears for both sides when the analysis finishes.</p>;
  return (
    <div className="stack" style={{ gap: 2 }} data-testid="result-played-like">
      <PlayedLikeLine name={sides.white.name} color="white" career={sides.white.career} pl={white} testId="result-played-like-white" />
      <PlayedLikeLine name={sides.black.name} color="black" career={sides.black.career} pl={black} testId="result-played-like-black" />
    </div>
  );
}

/** Career Passport: permanent Played Like records and statistics (per model version, never mixed). */
export function PlayedLikeCareerPanel({ games, onOpenGame }: { games: GameRecord[]; onOpenGame: (gameId: string) => void }) {
  const { records, byModel } = playedLikeCareer(games);
  const recent = [...records].filter(r => r.modelId === PLAYED_LIKE_ID).sort((a, b) => b.at.localeCompare(a.at));
  const older = byModel.filter(s => s.modelId !== PLAYED_LIKE_ID);
  const cur = byModel.find(s => s.modelId === PLAYED_LIKE_ID) ?? null;
  const opp = (r: PlayedLikeGameRecord) => r.opponent.name;
  const resTxt = (x: number | null) => (x === 1 ? 'Win' : x === 0 ? 'Loss' : x === 0.5 ? 'Draw' : '—');
  const val = (r: PlayedLikeGameRecord | null) => (r && r.estimate.status === 'ok' ? n0(r.estimate.rating) : '—');
  const linkStat = (k: string, r: PlayedLikeGameRecord | null, testId: string) => (
    <div className="stat"><span className="k">{k}</span>
      {r ? <button className="btn ghost small mono" data-testid={testId} title="Open this game" onClick={() => onOpenGame(r.gameId)}>{val(r)}</button> : <span className="v mono" data-testid={testId}>—</span>}
      {r && <span className="small muted">vs {opp(r)} · {new Date(r.at).toLocaleDateString()}</span>}</div>
  );
  const plain = (k: string, v: string | number | null, sub?: string, testId?: string) => (
    <div className="stat"><span className="k">{k}</span><span className="v mono" data-testid={testId}>{v === null ? '—' : typeof v === 'number' ? n0(v) : v}</span>{sub && <span className="small muted">{sub}</span>}</div>
  );
  return (
    <div className="panel" style={{ marginTop: 14 }} data-testid="passport-played-like">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Played Like Records</h3><span className="chip gold" title={PLAYED_LIKE_INFO.status}>Performance Elo · {PLAYED_LIKE_ID}</span></div>
      {!PLAYED_LIKE_VALIDATED && <p className="small muted">The Played Like model is still being calibrated: on held-out games it does not yet pass its validation, so no numbers are shown. Your analysed games are recorded and get their estimates once a validated model exists.</p>}
      {!cur ? <p className="small muted" data-testid="pl-records-empty">Records appear after your finished games are analysed (Standard analysis).</p> : (<>
        <div className="grid-3">
          {linkStat('Highest', cur.highest, 'pl-highest')}
          {linkStat('Lowest', cur.lowest, 'pl-lowest')}
          {plain('Most Recent', cur.mostRecent && cur.mostRecent.estimate.status === 'ok' ? n0(cur.mostRecent.estimate.rating) : null, cur.mostRecent ? `vs ${opp(cur.mostRecent)}` : undefined, 'pl-recent')}
          {plain('Average', cur.average, `${cur.counted} counted of ${cur.analysed} analysed games`, 'pl-average')}
          {plain('Median', cur.median)}
          {plain('Trend', cur.trend === null ? null : `${cur.trend >= 0 ? '+' : ''}${cur.trend}`, 'last 10 vs the 10 before (needs 20)')}
          {plain('Last 10', cur.recent[10], cur.recent[10] === null ? 'needs 10 counted games' : undefined)}
          {plain('Last 50', cur.recent[50], cur.recent[50] === null ? 'needs 50' : undefined)}
          {plain('Last 100', cur.recent[100], cur.recent[100] === null ? 'needs 100' : undefined)}
        </div>
        <RatingChart points={cur.series.map(p => ({ at: p.at, rating: p.rating, rd: p.sd, label: `${n0(p.rating)} (rolling ${n0(p.rolling)}) · ${new Date(p.at).toLocaleDateString()}` }))}
          caption="Played Like per counted game; shaded band: ±1 SD of each estimate" empty="The history graph appears after two counted games." label="Played Like history" />
        <p className="small muted">Only estimates from a validated model with at least {ADEQUATE_MOVES} informative moves count toward these statistics; the others stay in the history below with their label. Played Like never changes your rating, which comes from results. Records are permanent across seasons and divisions.</p>
        <table className="table small" data-testid="pl-history"><thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>Career</th><th>Played Like</th><th>Status</th></tr></thead>
          <tbody>{recent.slice(0, 15).map(r => (
            <tr key={r.gameId + r.modelId} className="clickable" data-testid="pl-history-row" onClick={() => onOpenGame(r.gameId)}>
              <td>{new Date(r.at).toLocaleDateString()}</td><td>{opp(r)}</td><td>{resTxt(r.result)}</td>
              <td className="mono">{r.career ? n0(r.career.after) : 'Unrated'}</td>
              <td className="mono">{fmtPlayedLike(r.estimate)}</td><td className="small">{CONFIDENCE_LABEL[r.confidence]}</td></tr>))}</tbody></table>
      </>)}
      {older.map(s => (
        <details key={s.modelId} className="small" style={{ marginTop: 8 }} data-testid="pl-older-model">
          <summary>Earlier model {s.modelId}: {s.counted} counted of {s.analysed} (shown separately; not comparable)</summary>
          <p>Highest {val(s.highest)} · Lowest {val(s.lowest)} · Average {s.average === null ? '—' : n0(s.average)} · Median {s.median === null ? '—' : n0(s.median)}</p>
        </details>
      ))}
    </div>
  );
}
