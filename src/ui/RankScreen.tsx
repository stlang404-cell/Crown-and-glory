import { useEffect, useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { Emblem } from './Emblem';
import { DIVISIONS, divisionLabel } from '../federation/model';
import {
  ALL_RANKS, HYSTERESIS, MID_ROUND, RANK_WEIGHTS, THRESHOLDS, rankLabel, rankProgress, standingScore, divisionBase,
  PROMOTION_LANDING, RELEGATION_LANDING, type StandingParts,
} from '../federation/ranks';
import { CIRCUIT_GRADE_LIST_STATUS } from '../federation/rankNames';
import { liveStanding } from '../app/ranks';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}`);
const SUB_WORD = { III: 'one chevron', II: 'two chevrons', I: 'three chevrons' } as const;

/**
 * Rank guide (#/ranks): the 48 Circuit Grade steps, the player's position and highest rank, the standing score and
 * the exact requirements for the next step, and the rules (docs/FEUDAL_RANKS.md).
 */
export function RankScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.ready ? fed.state : null;
  const [rating, setRating] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    services.db.ratingState('rapid').then(p => { if (alive) setRating(p.rating); }).catch(() => { if (alive) setRating(null); });
    return () => { alive = false; };
  }, [services, services.revision]);
  const live: StandingParts | null = useMemo(() => (st && rating !== null ? liveStanding(st, rating) : null), [st, rating, services.revision]);
  const pr = rankProgress(st, live);
  const r = st?.world.player.rank;
  const joined = !!st?.world.player.joined;
  const currentStep = pr.current.step;
  const highestStep = pr.highest?.step ?? -1;
  const recent = (r?.log ?? []).filter(e => e.from !== e.to).slice(-8).reverse();

  return (
    <div className="stack rank-screen" data-testid="rank-guide">
      <div className="panel">
        <h1 style={{ margin: 0 }}>Circuit Grades</h1>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          Sixteen feudal ranks, each with three sublevels (III, then II, then I): 48 steps from Commoner III to High Sovereign I.
          Two grades belong to each Federation division. A Circuit Grade is a rank: it is not your Career Elo and not your Played Like Performance Elo.
          {CIRCUIT_GRADE_LIST_STATUS === 'proposed' && <> The names are a proposed list and may be renamed; ranks are stored by stable ids (cg-01 … cg-16), so a rename never changes your progress.</>}
        </p>
      </div>

      <div className="grid-2 rank-top">
        <section className="panel stack" data-testid="rank-current" aria-labelledby="rank-current-h">
          <h2 id="rank-current-h" style={{ margin: 0 }}>{joined ? 'Your Circuit Grade' : 'Where a career starts'}</h2>
          <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <Emblem spec={pr.current.insignia} size="lg" title={pr.current.ariaLabel} />
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <strong style={{ fontSize: '1.4rem' }} data-testid="rank-current-label">{pr.current.label}</strong>
              <span className="small muted">Grade {pr.current.grade} of 16 ({pr.current.gradeId}) · step {currentStep + 1} of 48 · {divisionLabel(pr.current.division)}</span>
              {pr.highest && <span className="small" data-testid="rank-highest">Highest ever: <strong>{pr.highest.label}</strong> <span className="muted">({pr.highest.via === 'start' ? `starting rank, season ${pr.highest.season}` : `first reached season ${pr.highest.season}, round ${pr.highest.round}${pr.highest.via === 'replay' ? ', from your stored season records' : ''}`})</span></span>}
              {!joined && <span className="small muted">Every new career starts at Commoner III in the Open Division.</span>}
            </div>
          </div>
          <div>
            <div className="row small" style={{ justifyContent: 'space-between' }}>
              <span>Standing score {pr.score === null ? '—' : pr.score.toFixed(1)} <span className="muted">{pr.scoreSource === 'live' ? '(if the checkpoint were now)' : pr.scoreSource === 'last' ? '(last checkpoint)' : ''}</span></span>
              <span className="muted">{pr.promoteAt !== null ? `${pr.promoteAt} for ${pr.next!.label}` : 'Top of this division'}</span>
            </div>
            <div className="id-bar rank-bar" role="progressbar" aria-label={pr.next ? `Progress toward ${pr.next.label}` : 'Progress within the top step of the division'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pr.fraction * 100)} data-testid="rank-progress"><i style={{ width: `${Math.round(pr.fraction * 100)}%` }} /></div>
          </div>
          <ul className="small" style={{ margin: 0 }} data-testid="rank-requirements">
            {pr.next
              ? <li><strong>Next attainable rank: {pr.next.label}.</strong> Reach a standing score of {pr.promoteAt} or more at the next checkpoint (season {pr.nextCheckpoint.season}, {pr.nextCheckpoint.kind === 'mid' ? `after round ${MID_ROUND}` : 'season end'}). One step per checkpoint at most.</li>
              : <li><strong>You hold the top step of your division.</strong> The next rank comes only with promotion to a higher division.</li>}
            {pr.divisionUp
              ? <li>Finish 1st or 2nd in your league at season end: promotion to the {divisionLabel(pr.current.division - 1)} at <strong>{pr.divisionUp.label}</strong>.</li>
              : <li>You are in the Crown Division: High Sovereign I is the highest rank in the Federation.</li>}
            {pr.demoteBelow !== null
              ? <li>{pr.protectedNow ? <>Protected: you stepped up at the last checkpoint, so the next checkpoint cannot lower your rank.</> : <>A score below {pr.demoteBelow} at a checkpoint lowers you one step, to {pr.prev!.label}.</>}</li>
              : <li>You are on the lowest step of your division: a checkpoint cannot lower it.</li>}
            {pr.divisionDown && <li>Finishing 15th or 16th relegates you to the {divisionLabel(pr.current.division + 1)} at {pr.divisionDown.label}.</li>}
          </ul>
        </section>

        <section className="panel stack" aria-labelledby="rank-score-h" data-testid="rank-score">
          <h2 id="rank-score-h" style={{ margin: 0 }}>Standing score</h2>
          <p className="small muted" style={{ margin: 0 }}>Worked out at two checkpoints a season: after round {MID_ROUND} and at season end (before promotion and relegation). 0 to 100.</p>
          <table className="small">
            <thead><tr><th>Part</th><th>Weight</th><th>{live ? 'Now' : 'Last'}</th></tr></thead>
            <tbody>
              {(() => { const parts = live ?? r?.last?.parts ?? null; return (<>
                <tr><td>League position (1st = 100, last = 0)</td><td>{RANK_WEIGHTS.position * 100}%</td><td className="mono">{pct(parts?.position ?? null)}</td></tr>
                <tr><td>Score in sanctioned rated games (league, Opens, Championship)</td><td>{RANK_WEIGHTS.results * 100}%</td><td className="mono">{pct(parts?.results ?? null)}</td></tr>
                <tr><td>Rating percentile within your division</td><td>{RANK_WEIGHTS.rating * 100}%</td><td className="mono">{pct(parts?.rating ?? null)}</td></tr>
                <tr><td><strong>Standing score</strong></td><td /><td className="mono"><strong>{parts ? standingScore(parts).toFixed(1) : '—'}</strong></td></tr>
              </>); })()}
            </tbody>
          </table>
          <p className="small muted" style={{ margin: 0 }}>A part with no data yet (before your first league game) is left out and the others are rescaled.</p>
          <h3 style={{ margin: '4px 0 0' }}>Steps within a division</h3>
          <table className="small" data-testid="rank-thresholds">
            <thead><tr><th>Step</th><th>Reach at</th><th>Drop below</th></tr></thead>
            <tbody>{[0, 1, 2, 3, 4, 5].map(k => <tr key={k}><td>{['Lower grade III', 'Lower grade II', 'Lower grade I', 'Upper grade III', 'Upper grade II', 'Upper grade I'][k]}</td><td className="mono">{k === 0 ? 'start' : THRESHOLDS[k]}</td><td className="mono">{k === 0 ? '—' : THRESHOLDS[k] - HYSTERESIS}</td></tr>)}</tbody>
          </table>
        </section>
      </div>

      <section className="panel stack" aria-labelledby="rank-ladder-h">
        <h2 id="rank-ladder-h" style={{ margin: 0 }}>All 48 steps</h2>
        <p className="small muted" style={{ margin: 0 }}>The shield shape is the division's, the charge is the grade, and the chevrons are the sublevel: {SUB_WORD.III} for III, {SUB_WORD.II} for II, {SUB_WORD.I} for I.</p>
        <div className="rank-ladder" data-testid="rank-ladder">
          {Array.from({ length: DIVISIONS }, (_, i) => i + 1).map(d => (
            <div key={d} className="rank-division" data-division={d}>
              <h3 className="small" style={{ margin: '0 0 6px' }}>{divisionLabel(d)} <span className="muted">· division {d}</span></h3>
              <ol className="rank-steps" start={divisionBase(d) + 1}>
                {ALL_RANKS.slice(divisionBase(d), divisionBase(d) + 6).map(v => (
                  <li key={v.step} className={`rank-step${v.step === currentStep && joined ? ' current' : ''}${v.step === highestStep ? ' highest' : ''}`} data-testid={`rank-step-${v.step}`} aria-current={v.step === currentStep && joined ? 'step' : undefined}>
                    <Emblem spec={v.insignia} size="md" title={v.ariaLabel} />
                    <span className="rank-step-label">{v.label}</span>
                    {v.step === currentStep && joined && <span className="chip gold">You</span>}
                    {v.step === highestStep && v.step !== currentStep && <span className="chip">Highest</span>}
                  </li>
                ))}
              </ol>
            </div>
          )).reverse()}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel stack" aria-labelledby="rank-rules-h">
          <h2 id="rank-rules-h" style={{ margin: 0 }}>Rules</h2>
          <ul className="small" style={{ margin: 0 }}>
            <li>Your division decides your pair of grades. Divisions change only at season end: the top two of each league go up, the bottom two go down.</li>
            <li>Promotion to a new division starts you at its lower grade III ({rankLabel(divisionBase(7) + PROMOTION_LANDING)} after the Open Division) and protects you at the next checkpoint. Relegation places you at the lower division's upper grade III ({rankLabel(divisionBase(8) + RELEGATION_LANDING)} below the Club Division).</li>
            <li>Inside your division, each checkpoint moves you at most one step. Stepping up needs the score in the table; stepping down needs a score {HYSTERESIS} points below the step's own mark, so a single bad half-season near a line does not bounce you back and forth.</li>
            <li>After any step up, the next checkpoint cannot lower your rank.</li>
            <li>Only recorded Federation results count: league games, the Federation and Challenger Opens and the Crown Championship. Exhibitions, unrated, assisted, practice, sandbox and quick-match games never count, and nothing can be bought: money, clubs, sponsorships and cosmetics have no effect.</li>
            <li>Your highest rank ever achieved is kept for good. Demotion, relegation, rating losses and new seasons never lower it.</li>
          </ul>
        </section>
        <section className="panel stack" aria-labelledby="rank-recent-h">
          <h2 id="rank-recent-h" style={{ margin: 0 }}>Recent rank changes</h2>
          {recent.length === 0 ? <p className="small muted" style={{ margin: 0 }}>{joined ? 'No changes yet. The first checkpoint is after round 8.' : 'Found the Federation to start your career.'}</p>
            : <ul className="small" style={{ margin: 0 }} data-testid="rank-log">{recent.map((e, i) => <li key={i}>Season {e.season}, round {e.round}: {rankLabel(e.from)} → <strong>{rankLabel(e.to)}</strong> <span className="muted">({{ mid: 'mid-season checkpoint', end: 'season-end checkpoint', promotion: 'division promotion', relegation: 'relegation', migration: 'from your stored records', start: 'start', entry: 'entry' }[e.kind]}{e.score !== undefined ? `, score ${e.score.toFixed(1)}` : ''})</span></li>)}</ul>}
          {r?.origin === 'migrated' && <p className="small muted" style={{ margin: 0 }}>Your rank was worked out from your stored season records when Circuit Grades arrived (season-end places and points; the mid-season tables of past seasons were not stored).</p>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn small" onClick={() => go({ name: 'standings' })}>Standings</button>
            <button className="btn small" onClick={() => go({ name: 'competitors' })}>Competitors</button>
          </div>
        </section>
      </div>
    </div>
  );
}
