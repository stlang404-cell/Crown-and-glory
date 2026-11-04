import type { AnalysisReport, Pov, SideSummary } from '../analysis/types';
import type { RatingEvent } from '../ratings/ledger';
import { PLAYED_LIKE_INFO, playedLike, type PlayedLike } from '../analysis/playedLike';

export function fmtPlayedLike(p: PlayedLike): string {
  switch (p.status) {
    case 'ok': return `${p.rating.toLocaleString('en-US')}`;
    case 'below-range': return `Below ${p.bound}`;
    case 'above-range': return `Above ${p.bound}`;
    case 'insufficient': return 'Insufficient data';
    case 'pending': return 'Waiting for analysis';
    case 'uncalibrated': return 'Calibrating';
  }
}

function Side({ name, rating, summary, pl, testId }: { name: string; rating: string; summary: SideSummary; pl: PlayedLike; testId: string }) {
  return (
    <div className="stack" style={{ gap: 6 }} data-testid={testId}>
      <strong>{name}</strong>
      <div className="stat"><span className="k">Actual Rating</span><span className="v mono">{rating}</span></div>
      <div className="stat"><span className="k">Played Like</span><span className="v mono" data-testid={`${testId}-value`}>{fmtPlayedLike(pl)}</span>
        <span className="small muted">{pl.status === 'ok' ? `likely ${pl.low}–${pl.high} · ${pl.moves} moves` : pl.status === 'insufficient' ? `${pl.moves} informative moves; needs ${pl.needed}` : pl.status === 'below-range' || pl.status === 'above-range' ? `outside the calibrated range · ${pl.moves} moves` : pl.status === 'uncalibrated' ? 'model not yet validated' : ''}</span></div>
      <div className="small">Accuracy {summary.accuracy === null ? '—' : summary.accuracy.toFixed(1)} · Blunders {summary.counts.blunder} · Mistakes {summary.counts.mistake} · Best {summary.counts.best}</div>
    </div>
  );
}

/** Post-game performance card: "Played Like" for both sides next to their actual ratings (experimental estimate). */
export function PlayedLikeCard({ report, human, humanName, oppName, oppRating, event, onOpenMoves }: {
  report: AnalysisReport; human: Pov; humanName: string; oppName: string; oppRating: number | null; event: RatingEvent | null; onOpenMoves?: () => void;
}) {
  const other: Pov = human === 'white' ? 'black' : 'white';
  const mine = playedLike(report, human), theirs = playedLike(report, other);
  const myRating = event ? `${Math.round(event.before.rating)} → ${Math.round(event.after.rating)}` : 'Unrated game';
  const [lo, hi] = PLAYED_LIKE_INFO.calibratedRange;
  return (
    <div className="panel" data-testid="played-like">
      <div className="panel-title"><h3>Played Like</h3><span className="chip gold" title={PLAYED_LIKE_INFO.status}>Estimate · Experimental</span></div>
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <Side name={humanName} rating={myRating} summary={report.summary[human]} pl={mine} testId="played-like-you" />
        <Side name={oppName} rating={oppRating === null ? 'Unrated' : String(Math.round(oppRating))} summary={report.summary[other]} pl={theirs} testId="played-like-opp" />
      </div>
      <details className="small" style={{ marginTop: 8 }}>
        <summary>What “Played Like” means</summary>
        <p>An estimate of the strength your moves showed in this game alone, from how much each move lost against the engine's best play (forced moves and the first two moves each are left out). It ignores the result and both ratings, and it never changes your rating — only results do.</p>
        <p>One game is a small sample: a game of quiet, simple positions can look stronger than usual, a sharp game weaker. The range shows the likely spread. It is calibrated on engine games of measured strength between {lo} and {hi} on the Crown scale (not FIDE); outside that range it says “below” or “above”.</p>
      </details>
      {onOpenMoves && <button className="btn small" style={{ marginTop: 8 }} onClick={onOpenMoves}>See Move-by-Move Analysis</button>}
    </div>
  );
}
