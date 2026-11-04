import { useServices } from './App';
import { Emblem } from './Emblem';
import { Elo, usePlayerElo } from './CareerElo';
import { insigniaSpec, titleFor } from '../ratings/titles';
import { PLAYER_ID, REGION_NAMES, divisionLabel } from '../federation/model';
import { currentRankOf, highestRankOf } from '../legacy/ranks';
import type { RatingEvent } from '../ratings/ledger';
import { collectedTitles } from '../ratings/titles';
import { isProvisional } from '../ratings/glicko2';
import { fmtCareerElo } from '../ratings/display';

/** Division line of the player ("Senior Division · Aurelia"), or the Federation state when not in a league. */
export function useDivisionLine(): string {
  const fed = useServices().fed;
  const st = fed.ready ? fed.state : null;
  const circuit = st?.plan.circuits.find(c => c.members.includes(PLAYER_ID));
  return circuit ? `${divisionLabel(circuit.division)} · ${REGION_NAMES[circuit.region]}` : fed.ready ? 'Between seasons' : 'Federation not founded';
}

/**
 * Dashboard and Player Profile heading block: the player's CURRENT feudal rank with its insignia and sublevel
 * (e.g. "Duke II", from package P's ranks module via src/legacy/ranks.ts), the numerical career Elo beside it and the
 * Federation division. Without a ranks module it shows the rating title, labelled as a rating title.
 */
export function RankHeading() {
  const services = useServices();
  const me = usePlayerElo();
  const division = useDivisionLine();
  const rank = currentRankOf(services.fed.state);
  const t = me ? titleFor(me.rating) : null;
  const spec = rank?.insignia ?? (t ? insigniaSpec(t) : null);
  return (
    <div className="rank-heading" data-testid="rank-heading" data-source={rank ? 'feudal-rank' : 'rating-title'}>
      {spec ? <Emblem spec={spec} size="md" title={`${rank ? rank.label : t!.name} insignia`} /> : <span className="id-blank" aria-hidden />}
      <div className="rank-heading-text">
        <span className="rank-heading-name" data-testid="rank-label">{rank ? <a href="#/ranks" title="Circuit Grade: open the rank guide (not your Career Elo)" data-testid="rank-heading-link">{rank.label}</a> : t ? t.name : 'Unrated'}</span>
        <span className="rank-heading-meta">
          <span className="rank-heading-elo">Career Elo {me ? <Elo rating={me.rating} rd={me.rd} provisional={me.provisional} /> : <span className="muted">— no rated games yet</span>}</span>
          <span className="muted"> · {division}</span>
          {!rank && t && <span className="muted small"> · rating title</span>}
        </span>
      </div>
    </div>
  );
}

/**
 * Profile → Career Statistics: the HIGHEST RANK EVER ACHIEVED (exact sublevel, season/date first achieved) kept
 * separate from the current and highest career Elo. Highest/lowest Played Like live in the Played Like panel
 * (package H) further down the profile.
 */
export function CareerStatistics({ events }: { events: RatingEvent[] }) {
  const services = useServices();
  const me = usePlayerElo();
  const st = services.fed.state;
  const cur = currentRankOf(st);
  const hi = highestRankOf(st);
  const rapid = events.filter(e => e.pool === 'rapid');
  const top = rapid.reduce<RatingEvent | null>((b, e) => (!b || e.after.rating > b.after.rating ? e : b), null);
  const est = rapid.filter(e => !isProvisional(e.gamesBefore + 1, e.after.rd));
  const estTop = est.reduce<RatingEvent | null>((b, e) => (!b || e.after.rating > b.after.rating ? e : b), null);
  const peakTitle = collectedTitles(rapid.map(e => ({ after: e.after, games: e.gamesBefore + 1, at: e.at })), isProvisional).peak;
  const date = (at?: string | null) => (at ? new Date(at).toLocaleDateString() : null);
  return (
    <section className="panel stack" style={{ marginTop: 14 }} data-testid="career-statistics">
      <h2 style={{ margin: 0 }}>Career Statistics</h2>
      <div className="career-stats">
        <div className="stat" data-testid="highest-rank"><span className="k">Highest Rank Ever</span>
          {hi ? <><span className="v row" style={{ gap: 8, fontSize: '1.15rem' }}>{hi.insignia && <Emblem spec={hi.insignia} size="sm" title={`${hi.label} insignia`} />}{hi.label}</span>
            <span className="small muted">{(hi as { via?: string }).via === 'start' ? `Starting rank, season ${hi.season ?? 1}` : `First achieved ${[hi.season ? `in season ${hi.season}${(hi as { round?: number }).round ? `, round ${(hi as { round?: number }).round}` : ''}` : null, date(hi.at)].filter(Boolean).join(' · ') || '(date not recorded)'}`} · <a href="#/ranks">rank guide</a></span></>
            : <><span className="v" style={{ fontSize: '1.15rem' }}>{peakTitle ? peakTitle.name : '—'}</span><span className="small muted">{peakTitle ? 'Highest rating title (established)' : 'Appears once your career Elo is established'}</span></>}
        </div>
        <div className="stat" data-testid="current-rank"><span className="k">Current Rank</span><span className="v" style={{ fontSize: '1.15rem' }}>{cur ? cur.label : me ? titleFor(me.rating).name : '—'}</span><span className="small muted">{cur ? 'Circuit Grade (feudal rank)' : 'Rating title'}</span></div>
        <div className="stat" data-testid="current-elo"><span className="k">Current Career Elo</span><span className="v mono">{me ? fmtCareerElo(me.rating, { rd: me.rd }) : '—'}</span><span className="small muted">{me?.provisional ? 'Provisional' : me ? 'Established' : 'No rated games yet'}</span></div>
        <div className="stat" data-testid="highest-elo"><span className="k">Highest Career Elo</span><span className="v mono">{top ? fmtCareerElo(top.after.rating) : '—'}</span>
          <span className="small muted">{top ? `${date(top.at)} · established peak ${estTop ? fmtCareerElo(estTop.after.rating) : 'not yet'}` : 'After your first rated game'}</span></div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Career Elo is the Glicko-2 rating on the Crown scale (not FIDE). Highest and lowest Played Like are in the Played Like panel below.</p>
    </section>
  );
}
