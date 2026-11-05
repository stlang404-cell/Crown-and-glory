import { careerTimeline } from '../ratings/pools';
import { useServices } from './App';
import { titleEmblem } from '../heraldry/catalog';
import { Elo, usePlayerElo } from './CareerElo';
import { insigniaSpec, titleFor } from '../ratings/titles';
import { PLAYER_ID, REGION_NAMES, divisionLabel } from '../federation/model';
import { currentRankOf, highestRankOf } from '../legacy/ranks';
import type { RatingEvent } from '../ratings/ledger';
import { collectedTitles } from '../ratings/titles';
import { isProvisional } from '../ratings/glicko2';
import { fmtCareerElo } from '../ratings/display';
import { FED_TITLE_TOOLTIP, HonourFrame, HonourTag, RANK_TOOLTIP, RATING_TITLE_TOOLTIP, TitleBadge } from './RankBadge';

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
  const fedTitle = services.fed.state?.world.player.fedTitle ?? null;
  return (
    <div className="rank-heading" data-testid="rank-heading" data-source={rank ? 'feudal-rank' : 'rating-title'}>
      {spec ? <HonourFrame kind={rank ? 'rank' : 'rating'} spec={spec} size="md" title={`${rank ? rank.label : t!.name} insignia`} /> : <span className="id-blank" aria-hidden />}
      <div className="rank-heading-text">
        <span className="rank-heading-k" data-testid="rank-heading-kind" title={rank ? RANK_TOOLTIP : RATING_TITLE_TOOLTIP}>{rank ? 'Competitive Rank' : 'Rating title'} <HonourTag kind={rank ? 'rank' : 'rating'} /></span>
        <span className="rank-heading-name" data-testid="rank-label">{rank ? <a href="#/ranks" title={`Competitive Rank ${rank.label}. ${RANK_TOOLTIP} Opens the rank guide.`} aria-label={`Competitive Rank: ${rank.label} (open the rank guide)`} data-testid="rank-heading-link">{rank.label}</a> : t ? t.name : 'Unrated'}</span>
        <span className="rank-heading-meta">
          <span className="rank-heading-elo">Career Elo {me ? <Elo rating={me.rating} rd={me.rd} provisional={me.provisional} /> : <span className="muted">— no rated games yet</span>}</span>
          <span className="muted"> · {division}</span>
        </span>
        <span className="rank-heading-title" data-testid="rank-heading-fedtitle" title={FED_TITLE_TOOLTIP}>
          {fedTitle ? <TitleBadge title={fedTitle} labelled testId="rank-heading-fedtitle-badge" /> : <><span className="honour-kind">Federation Title: </span><span className="muted">none yet (earned by norms)</span> <HonourTag kind="title" /></>}
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
  const fedTitle = st?.world.player.fedTitle ?? null;
  const rapid = careerTimeline(events);
  const top = rapid.reduce<RatingEvent | null>((b, e) => (!b || e.after.rating > b.after.rating ? e : b), null);
  const est = rapid.filter(e => !isProvisional(e.gamesBefore + 1, e.after.rd));
  const estTop = est.reduce<RatingEvent | null>((b, e) => (!b || e.after.rating > b.after.rating ? e : b), null);
  const peakTitle = collectedTitles(rapid.map(e => ({ after: e.after, games: e.gamesBefore + 1, at: e.at })), isProvisional).peak;
  const date = (at?: string | null) => (at ? new Date(at).toLocaleDateString() : null);
  return (
    <section className="panel stack" style={{ marginTop: 14 }} data-testid="career-statistics">
      <h2 style={{ margin: 0 }}>Career Statistics</h2>
      <div className="career-stats">
        <div className="stat" data-testid="highest-rank" title={RANK_TOOLTIP}><span className="k">Highest Competitive Rank Ever <HonourTag kind="rank" /></span>
          {hi ? <><span className="v row" style={{ gap: 8, fontSize: '1.15rem' }}>{hi.insignia && <HonourFrame kind="rank" spec={hi.insignia} size="sm" title={`${hi.label} insignia`} />}{hi.label}</span>
            <span className="small muted">{(hi as { via?: string }).via === 'start' ? `Starting rank, season ${hi.season ?? 1}` : `First achieved ${[hi.season ? `in season ${hi.season}${(hi as { round?: number }).round ? `, round ${(hi as { round?: number }).round}` : ''}` : null, date(hi.at)].filter(Boolean).join(' · ') || '(date not recorded)'}`} · <a href="#/ranks">rank guide</a></span></>
            : <><span className="v" style={{ fontSize: '1.15rem' }}>{peakTitle ? peakTitle.name : '—'}</span><span className="small muted">{peakTitle ? 'Highest rating title (established)' : 'Appears once your career Elo is established'}</span></>}
        </div>
        <div className="stat" data-testid="current-rank" title={cur ? RANK_TOOLTIP : RATING_TITLE_TOOLTIP}><span className="k">{cur ? 'Current Competitive Rank' : 'Current Rating Title'} <HonourTag kind={cur ? 'rank' : 'rating'} /></span><span className="v" style={{ fontSize: '1.15rem' }}>{cur ? cur.label : me ? titleFor(me.rating).name : '—'}</span><span className="small muted">{cur ? 'Circuit Grade · goes up and down with results' : 'Rating title (Career Elo band)'}</span></div>
        <div className="stat" data-testid="stats-fedtitle" title={FED_TITLE_TOOLTIP}><span className="k">Federation Title <HonourTag kind="title" /></span><span className="v row" style={{ gap: 8, fontSize: '1.15rem' }}>{fedTitle ? <><HonourFrame kind="title" spec={titleEmblem(fedTitle)} size="sm" title={`Federation Title ${fedTitle} emblem`} />{fedTitle}</> : 'None yet'}</span><span className="small muted">Permanent · earned by norms, never lost</span></div>
        <div className="stat" data-testid="current-elo"><span className="k">Current Career Elo</span><span className="v mono">{me ? fmtCareerElo(me.rating, { rd: me.rd }) : '—'}</span><span className="small muted">{me?.provisional ? 'Provisional' : me ? 'Established' : 'No rated games yet'}</span></div>
        <div className="stat" data-testid="highest-elo"><span className="k">Highest Career Elo</span><span className="v mono">{top ? fmtCareerElo(top.after.rating) : '—'}</span>
          <span className="small muted">{top ? `${date(top.at)} · established peak ${estTop ? fmtCareerElo(estTop.after.rating) : 'not yet'}` : 'After your first rated game'}</span></div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Career Elo is the Glicko-2 rating on the Crown scale (not FIDE). Highest and lowest Played Like are in the Played Like panel below.</p>
    </section>
  );
}
