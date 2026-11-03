import { useApp, useServices } from './App';
import { Emblem, Trophy } from './Emblem';
import { divisionEmblem, titleEmblem, financialEmblem, achievementEmblem, TROPHY_FOR } from '../heraldry/catalog';
import { divisionLabel, REGION_NAMES, PLAYER_ID } from '../federation/model';
import { swissEventFor } from '../federation/world';
import { nextTitleProgress } from '../heraldry/titles';
import { clubEmblem } from '../heraldry/clubs';
import { rivalriesOf } from '../app/rivalries';
import { achievementsOf } from '../app/achievements';
import { scoreAll, summary } from '../app/forecasting';
import { usePlayerGames } from './RivalsScreen';
import { titleKind } from './HallScreen';
import { fmtCrowns } from '../exchange/ledger';
import { playerPrestige } from './FinanceScreen';

/**
 * The Passport's career standing (crown-passport-2): six separate identities that are never mixed —
 * chess rating (skill), competitive division, earned federation title, career experience, financial prestige
 * and achievements — plus eligibility, requirements, rivalries, club and finances. Every number is read from
 * recorded state; nothing here is estimated or invented.
 */
export function CareerStanding({ rating, rd, games, peak }: { rating: number; rd: number; games: number; peak: number | null }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const pg = usePlayerGames();
  if (!fed.ready || !fed.state) return null;
  const st = fed.state;
  const p = st.world.player;
  const fin = fed.finance();
  const pr = playerPrestige(fed, peak);
  const riv = rivalriesOf(st, PLAYER_ID, pg, x => fed.name(x));
  const ach = achievementsOf(st, riv);
  const upsets = riv.flatMap(r => r.events.filter(e => e.kind === 'upset').map(e => ({ ...e, opp: r.b }))).slice(0, 5);
  const fc = summary(scoreAll(st.extra.forecasts, st.markets));
  const progress = nextTitleProgress({ norms: p.norms ?? [], peakRating: p.peakRating ?? 0, establishedPeak: p.establishedPeak ?? 0, honours: p.titles.map(t => t.title), current: p.fedTitle ?? null });
  const ev = swissEventFor(p.division);
  const club = fed.clubIdentity();
  const fedGames = pg.filter(g => g.status === 'finalized').length;
  const seasons = p.history.length;
  return (
    <section className="panel stack" style={{ marginTop: 14 }} data-testid="career-standing" aria-labelledby="career-standing-h">
      <div className="panel-title"><h2 id="career-standing-h" style={{ margin: 0 }}>Career Standing</h2><span className="small muted">Six separate records. Money can't buy your rating, division or title.</span></div>
      <div className="grid-3">
        <div className="panel stat"><span className="k">Rating</span><span className="v">{Math.round(rating)}</span><span className="small muted">±{Math.round(rd)} · {games} rated games. Changes only with rated games.</span></div>
        <div className="panel stat"><span className="k">Division</span><span className="v row" style={{ gap: 6 }}><Emblem spec={divisionEmblem(p.division)} size="sm" title={divisionLabel(p.division)} />{divisionLabel(p.division)}</span><span className="small muted">Division {p.division} of 8 · {REGION_NAMES[p.region]}. Each season the top two are promoted and the bottom two relegated.</span></div>
        <div className="panel stat"><span className="k">Federation Title</span><span className="v row" style={{ gap: 6 }}>{p.fedTitle ? <><Emblem spec={titleEmblem(p.fedTitle)} size="sm" title={p.fedTitle} />{p.fedTitle}</> : 'None yet'}</span><span className="small muted">{progress.next ? `Next: ${progress.next} · ${progress.lines.join(' · ')}` : progress.lines[0]}. Earned by norms; not a FIDE title.</span></div>
        <div className="panel stat"><span className="k">Experience</span><span className="v">{seasons} season{seasons === 1 ? '' : 's'}</span><span className="small muted">{fedGames} federation games played · Season {st.world.season}, Round {st.world.round}.</span></div>
        <div className="panel stat"><span className="k">Financial Prestige</span><span className="v row" style={{ gap: 6 }}>{pr && <Emblem spec={financialEmblem(pr.financialTier)} size="sm" title={pr.financialTier} />}{pr?.financialTier ?? '—'}</span><span className="small muted">Cash {fmtCrowns(fin.cash, 0)} · net worth {fmtCrowns(fin.netWorth, 0)} · open positions {fmtCrowns(fin.positions, 0)}. Fictional money.</span></div>
        <div className="panel stat"><span className="k">Achievements</span><span className="v">{ach.filter(a => a.earned).length} / {ach.length}</span><span className="small muted">Each one shows the game or event that earned it.</span></div>
      </div>
      <div className="grid-2">
        <div className="stack">
          <h3 style={{ margin: 0 }}>Eligibility this season</h3>
          <ul className="small" style={{ margin: 0 }}>
            <li>League: {divisionLabel(p.division)}, {REGION_NAMES[p.region]} (15 rounds).</li>
            <li>{ev === 'challenger' ? 'Challenger Open (divisions 5–8): open to you. Register on the Federation screen before round 4.' : ev === 'open' ? 'Federation Open (divisions 2–4): open to you. The top eight qualify for the Crown Championship.' : 'Crown Division: the best eight regional league winners qualify for the Crown Championship.'}</li>
            <li>Crown Championship (rounds 16–19): the best eight Crown Division winners and the top eight of the Federation Open.</li>
            <li>Club Weekend: {fed.clubLevelOf() >= 2 ? 'you host one with your Tournament Venue.' : 'needs a club with a Tournament Venue.'}</li>
          </ul>
          <h3 style={{ margin: '8px 0 0' }}>Trophies and Titles</h3>
          {p.titles.length === 0 ? <p className="small muted" style={{ margin: 0 }}>None yet. Win an event to earn a trophy.</p>
            : <div className="emblem-row">{p.titles.map((t, i) => <span key={i} className="emblem-cell"><Trophy kind={TROPHY_FOR[titleKind(t.title)]} size="sm" title={t.title} /><span className="small">{t.title}</span></span>)}</div>}
          <h3 style={{ margin: '8px 0 0' }}>Club</h3>
          {club ? <div className="row small" style={{ gap: 8 }}><Emblem spec={clubEmblem(club, fed.clubLevelOf())} size="md" title={club.name} /><span><strong>{club.name}</strong> · Level {fed.clubLevelOf()}{club.motto ? <> · “{club.motto}”</> : null}</span></div> : <p className="small muted" style={{ margin: 0 }}>No club yet. Buy one on the Finance screen.</p>}
        </div>
        <div className="stack">
          <h3 style={{ margin: 0 }}>Rivalries</h3>
          {riv.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No recorded meetings yet.</p> : (
            <ul className="small" style={{ margin: 0 }}>{riv.slice(0, 5).map(r => <li key={r.b}><button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'competitor', id: r.b })}>{fed.name(r.b)}</button> — {r.level} · {r.intensity}/100 · {r.w}–{r.d}–{r.l}</li>)}</ul>
          )}
          <h3 style={{ margin: '8px 0 0' }}>Significant Upsets</h3>
          {upsets.length === 0 ? <p className="small muted" style={{ margin: 0 }}>None yet. Beat someone rated 150 or more above you to record one.</p> : <ul className="small" style={{ margin: 0 }}>{upsets.map((u, i) => <li key={i}>{u.text} (S{u.season})</li>)}</ul>}
          <h3 style={{ margin: '8px 0 0' }}>Forecasting Record</h3>
          <p className="small" style={{ margin: 0 }}>{fc.n ? `${fc.n} resolved forecasts · Brier score ${fc.brier!.toFixed(3)}${fc.priceBrier !== null ? ` (market ${fc.priceBrier.toFixed(3)})` : ''}. Lower is better.` : 'No resolved forecasts yet.'}</p>
          <h3 style={{ margin: '8px 0 0' }}>Achievements</h3>
          <div className="emblem-row">{ach.filter(a => a.earned).map(a => <span key={a.def.id} className="emblem-cell"><Emblem spec={achievementEmblem(a.def, true)} size="sm" title={a.def.name} /><span className="small">{a.def.name}</span></span>)}{!ach.some(a => a.earned) && <span className="small muted">None yet.</span>}</div>
        </div>
      </div>
    </section>
  );
}
