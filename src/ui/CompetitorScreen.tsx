import { scrollRegion } from './scrollRegion';
import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { fmtCareerElo } from '../ratings/display';
import { NeedsFederation } from './NeedsFederation';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { Insignia } from './WorldScreen';
import { REGION_NAMES, divisionLabel, PLAYER_ID, DIVISIONS, regionNamesOf } from '../federation/model';
import type { Competitor } from '../federation/model';
import { ageOf } from '../federation/generator';
import { strengthNote } from '../federation/profiles';
import { eventName, WorldGame } from '../app/federation';
import { STYLE_LABEL, isValidatedStyle, styleTendency } from '../engine/styles';
import { fmtCrowns } from '../exchange/ledger';
import { stipendFor, avgSeasonEarnings } from '../economy/economy';
import type { GameRecord } from '../games/types';
import { Emblem } from './Emblem';
import { personalEmblem, divisionEmblem, titleEmblem, regionEmblem, FED_TITLES } from '../heraldry/catalog';
import { clubOf, clubEmblem, clubsOf } from '../heraldry/clubs';
import { ambitionOf } from '../heraldry/rivals';
import { nextTitleProgress } from '../heraldry/titles';
import { rivalriesOf, collect } from '../app/rivalries';
import { computeRivalry } from '../heraldry/rivalry';
import { IntensityBar, usePlayerGames } from './RivalsScreen';
import { RankBadge, TitleBadge, HonourFrame, HonourTag, RANK_TOOLTIP, FED_TITLE_TOOLTIP } from './RankBadge';
import { competitorRank, competitorHighestRank } from '../federation/ranks';
import { leagueTable, swissTable } from '../federation/world';
import { gamesOf } from '../federation/driver';
import { CATEGORY_LABEL, CONTEMPORARY_DISCLOSURE, CONTEMPORARY_NOTE, PERSONA_NOTE, ROSTER_CATEGORIES, lifespan, shownPersona, type ShownPersona } from '../federation/rosterPersonas';

/** Rating bands of the Federation's spectrum (docs/V10_PLAN.md Decision 1). */
const RATING_BANDS: [number, number][] = [[0, 399], [400, 799], [800, 1199], [1200, 1599], [1600, 1999], [2000, 2399], [2400, 2799], [2800, 3199], [3200, 3999], [4000, 99999]];
import { filterCompetitors, pageOf, PAGE_SIZE, type DiscoverySpecial } from '../app/discovery';

/** All results of a competitor across stored rounds (summary results included), newest first. */
function resultsOf(rounds: Iterable<{ season: number; round: number; abstract: [string, string, string, number | null][]; fixtures: { event: string; white: string; black: string; result: number | null; tier: number; gameId: string | null }[] }>, id: string) {
  const out: { season: number; round: number; event: string; opp: string; color: 'white' | 'black'; score: number; tier: number; gameId: string | null }[] = [];
  for (const r of rounds) {
    for (const [event, w, b, res] of r.abstract) if (res !== null && (w === id || b === id)) out.push({ season: r.season, round: r.round, event, opp: w === id ? b : w, color: w === id ? 'white' : 'black', score: w === id ? res : 1 - res, tier: 3, gameId: null });
    for (const f of r.fixtures) if (f.result !== null && (f.white === id || f.black === id)) out.push({ season: r.season, round: r.round, event: f.event, opp: f.white === id ? f.black : f.white, color: f.white === id ? 'white' : 'black', score: f.white === id ? f.result : 1 - f.result, tier: f.tier, gameId: f.gameId });
  }
  return out.sort((a, b) => b.season - a.season || b.round - a.round);
}

/** Identity filter of the roster browser: personas count as shown under the contemporary-names setting. */
function personaMatches(sp: ShownPersona | null, identity: '' | 'persona' | 'historical' | 'contemporary' | 'original', category: string): boolean {
  if (identity === 'original') return !sp;
  if (identity === 'persona' && !sp) return false;
  if ((identity === 'historical' || identity === 'contemporary') && sp?.kind !== identity) return false;
  return !category || sp?.identity.category === category;
}

/** One roster row. Memoised: the live scheduler re-renders the screen about twice a second, and a page has 100 rows with
 *  three emblems each; unchanged competitors (same record object) are not re-rendered (docs/PERFORMANCE_BUDGETS.md). */
const CompetitorRow = memo(function CompetitorRow({ c, n, showNames, watched }: { c: Competitor; n: number; showNames: boolean; watched: boolean }) {
  const { go } = useApp();
  const sp = shownPersona(c, showNames);
  return (
              <tr className="clickable" data-testid="competitor-row" onClick={() => go({ name: 'competitor', id: c.id })}>
                <td>{n}</td>
                <td><span className="row" style={{ gap: 8 }}><Emblem spec={personalEmblem(c.id, c.titles.length, c.fedTitle ?? null)} size="sm" title={`${c.name}'s insignia`} />{c.name}{sp && <span className="chip" data-testid={`persona-chip-${sp.kind}`} title={sp.kind === 'historical' ? 'Historical persona (fictional)' : CONTEMPORARY_DISCLOSURE} aria-label={sp.kind === 'historical' ? 'Historical persona (fictional)' : `Persona. ${CONTEMPORARY_DISCLOSURE}`}>Persona</span>}<TitleBadge title={c.fedTitle} abbr plain testId="competitor-row-title" />{watched && <span className="chip gold">★</span>}</span></td>
                <td className="hide-sm">{REGION_NAMES[c.region]}</td><td><span className="row" style={{ gap: 4, flexWrap: 'nowrap' }} data-testid="competitor-row-rank"><Emblem spec={divisionEmblem(c.division)} size="sm" title={divisionLabel(c.division)} /><RankBadge rank={competitorRank(c)} compact /></span></td>
                <td className="mono">{fmtCareerElo(c.rating, { rd: c.rd })}</td>
                <td className="hide-sm mono">{c.form || '—'}</td><td className="hide-sm">{c.titles.length || ''}</td>
              </tr>
  );
});

export function CompetitorsScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  const games = usePlayerGames();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [region, setRegion] = useState(-1);
  const [division, setDivision] = useState(0);
  const [minR, setMinR] = useState(0);
  const [maxR, setMaxR] = useState(5000);
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState('');
  const [club, setClub] = useState('');
  const [special, setSpecial] = useState<DiscoverySpecial>('');
  const [identity, setIdentity] = useState<'' | 'persona' | 'historical' | 'contemporary' | 'original'>('');
  const showNames = fed.showNames;
  const [category, setCategory] = useState('');
  const [band, setBand] = useState(-1);
  const [page, setPage] = useState(0);
  const rivals = useMemo(() => (st && special === 'rival' ? new Set(rivalriesOf(st, PLAYER_ID, games).filter(r => r.intensity >= 10).map(r => r.b)) : null), [st, special, games]);
  const list = useMemo(() => {
    if (!st) return [];
    const sets = {
      watchlist: new Set(st.extra.watchlist), featured: new Set((st.world.featured ?? []).map(f => f.id)), rivals,
      upcoming: new Set(st.rounds.get(`${st.world.season}:${st.world.round}`)?.fixtures.flatMap(f => (f.result === null ? [f.white, f.black] : [])) ?? []),
      favorites: new Set(st.extra.favorites ?? []),
    };
    // fast pass (app/discovery), then the persona and rating-band filters of the v0.10 roster browser
    return filterCompetitors(st.competitors.values(), { q: dq, region, division, minR, maxR, title, style, club, special }, sets)
      .filter(c => personaMatches(shownPersona(c, showNames), identity, category) && (band < 0 || (c.rating >= RATING_BANDS[band][0] && c.rating < RATING_BANDS[band][1] + 1)));
  }, [st, dq, region, division, minR, maxR, title, style, club, special, rivals, identity, category, band, showNames, services.revision]);
  // any filter change returns to the first page; pageOf clamps a page past the end (after a round)
  useEffect(() => { setPage(0); }, [q, region, division, minR, maxR, title, style, club, special, identity, category, band]);
  const pg = pageOf(list, page);
  if (!st) return <NeedsFederation />;
  const active = [...st.competitors.values()].filter(c => c.status === 'active').length;
  const styles = ['universal', ...(['tactical', 'positional', 'defensive', 'endgame', 'aggressive', 'gambiteer', 'materialist', 'complicator'] as const).filter(x => isValidatedStyle(x))];
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0 }}>Discover Competitors</h1>
        <span className="chip">{active.toLocaleString('en')} Active · {st.competitors.size.toLocaleString('en')} on Record</span>
        <button className="btn ghost small" onClick={() => go({ name: 'population' })}>Population analytics</button>
      </div>
      <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }} data-testid="discovery-filters">
        <input type="search" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search Competitors" />
        <select value={region} onChange={e => setRegion(+e.target.value)} aria-label="Region"><option value={-1}>All Regions</option>{regionNamesOf(fed.topology()).map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
        <select value={division} onChange={e => setDivision(+e.target.value)} aria-label="Division"><option value={0}>All Divisions</option>{Array.from({ length: DIVISIONS }, (_, i) => <option key={i} value={i + 1}>{i + 1} · {divisionLabel(i + 1)}</option>)}</select>
        <label className="small">Rating <input type="number" value={minR} step={50} onChange={e => setMinR(+e.target.value || 0)} style={{ width: 72 }} aria-label="Minimum Rating" />–<input type="number" value={maxR} step={50} onChange={e => setMaxR(+e.target.value || 5000)} style={{ width: 72 }} aria-label="Maximum Rating" /></label>
        <select value={title} onChange={e => setTitle(e.target.value)} aria-label="Federation Title"><option value="">Any Title or None</option><option value="any">Any Federation Title</option>{FED_TITLES.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <select value={style} onChange={e => setStyle(e.target.value)} aria-label="Playing Style"><option value="">Any Style</option>{styles.map(x => <option key={x} value={x}>{STYLE_LABEL[x as keyof typeof STYLE_LABEL]}</option>)}</select>
        <select value={club} onChange={e => setClub(e.target.value)} aria-label="Club"><option value="">Any Club</option>{clubsOf(fed.topology().regions).map(k => <option key={k.id} value={k.id}>{k.identity.name}</option>)}</select>
        <select value={band} onChange={e => setBand(+e.target.value)} aria-label="Rating Band"><option value={-1}>Any Rating Band</option>{RATING_BANDS.map(([lo, hi], i) => <option key={lo} value={i}>{hi > 9999 ? `${lo.toLocaleString('en')}+` : `${lo}–${hi.toLocaleString('en')}`}</option>)}</select>
        <select value={identity} onChange={e => { setIdentity(e.target.value as typeof identity); if (e.target.value === 'original') setCategory(''); }} aria-label="Identity"><option value="">Personas and Originals</option><option value="persona">All Personas</option><option value="historical">Historical Personas</option>{showNames && <option value="contemporary">Contemporary Personas</option>}<option value="original">Original Competitors</option></select>
        <select value={category} disabled={identity === 'original'} onChange={e => setCategory(e.target.value)} aria-label="Persona Category"><option value="">Any Persona Category</option>{ROSTER_CATEGORIES.map(k => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}</select>
        <select value={special} onChange={e => setSpecial(e.target.value as typeof special)} aria-label="Show"><option value="">Everyone</option><option value="featured">Featured Rivals</option><option value="rival">Your Rivals</option><option value="favorites">Followed</option><option value="watch">Watchlist ({st.extra.watchlist.length})</option><option value="titled">Event Champions</option><option value="upcoming">Playing This Round</option></select>
      </div>
      <p className="small muted" data-testid="persona-note" style={{ margin: '0 0 10px' }}>{PERSONA_NOTE}{showNames && <> {CONTEMPORARY_NOTE} <strong data-testid="persona-disclosure">{CONTEMPORARY_DISCLOSURE}</strong></>}</p>
      <div className="panel" style={{ overflowX: 'auto' }} ref={scrollRegion('Competitors table')}>
        <table>
          <thead><tr><th>#</th><th>Competitor</th><th className="hide-sm">Region</th><th title="Division and Competitive Rank (Circuit Grade)">Div · Rank</th><th>Rating</th><th className="hide-sm">Form</th><th className="hide-sm">Titles</th></tr></thead>
          <tbody>
            {pg.rows.map((c, i) => <CompetitorRow key={c.id} c={c} n={pg.from + i + 1} showNames={showNames} watched={st.extra.watchlist.includes(c.id)} />)}
          </tbody>
        </table>
        {list.length > PAGE_SIZE && (
          <div className="row small" data-testid="discovery-pages" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
            <button className="btn small" disabled={pg.page === 0} onClick={() => setPage(0)} aria-label="First Page">«</button>
            <button className="btn small" disabled={pg.page === 0} onClick={() => setPage(pg.page - 1)}>← Previous</button>
            <span className="muted">{(pg.from + 1).toLocaleString('en')}–{(pg.from + pg.rows.length).toLocaleString('en')} of {list.length.toLocaleString('en')} by rating · page {pg.page + 1} of {pg.pages.toLocaleString('en')}</span>
            <button className="btn small" disabled={pg.page >= pg.pages - 1} onClick={() => setPage(pg.page + 1)}>Next →</button>
            <button className="btn small" disabled={pg.page >= pg.pages - 1} onClick={() => setPage(pg.pages - 1)} aria-label="Last Page">»</button>
          </div>
        )}
        {list.length === 0 && <div className="small muted">No competitors match these filters. Try widening them.</div>}
      </div>
    </div>
  );
}

export function CompetitorScreen({ id }: { id: string }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  const [games, setGames] = useState<{ world: WorldGame[]; mine: GameRecord[] }>({ world: [], mine: [] });
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const world = (await fed.worldGames()).filter(g => g.white === id || g.black === id);
      const mine = (await services.db.allGames()).filter(g => g.context.kind === 'federation' && (g.white.id === id || g.black.id === id));
      if (live) setGames({ world, mine });
    })();
    return () => { live = false; };
  }, [id, services.revision]);
  const c: Competitor | undefined = st?.competitors.get(id);
  const results = useMemo(() => (st ? resultsOf(st.rounds.values(), id) : []), [st, id, services.revision]);
  if (!st || !c) return <div className="panel"><p>Unknown competitor.</p><button className="btn" onClick={() => go({ name: 'competitors' })}>Competitors</button></div>;
  const season = st.world.season;
  const vsMe = results.filter(r => r.opp === PLAYER_ID);
  const rivals = new Map<string, { n: number; score: number }>();
  for (const r of results) { if (r.opp === PLAYER_ID) continue; const x = rivals.get(r.opp) ?? { n: 0, score: 0 }; x.n++; x.score += r.score; rivals.set(r.opp, x); }
  const topRivals = [...rivals].filter(([, v]) => v.n >= 2).sort((a, b) => b[1].n - a[1].n || Math.abs(b[1].score / b[1].n - 0.5) - Math.abs(a[1].score / a[1].n - 0.5)).slice(0, 6);
  const watched = st.extra.watchlist.includes(id);
  const scouting = fed.ownsAsset('scouting');
  const nextOpp = fed.playerFixtures().some(f => f.white === id || f.black === id);
  const styleShown = isValidatedStyle(c.style) ? STYLE_LABEL[c.style] : 'Universal';
  const persona = shownPersona(c, fed.showNames);
  const featuredTag = st.world.featured?.find(f => f.id === id)?.tag ?? null;
  const progress = nextTitleProgress({ norms: c.norms ?? [], peakRating: c.peakRating ?? 0, establishedPeak: c.establishedPeak ?? 0, honours: c.titles.map(t => t.title), current: c.fedTitle ?? null });
  // tournament following: where they stand right now (recorded results of this season)
  const seasonGames = gamesOf(fed.seasonRounds());
  const current: string[] = [];
  const circuit = st.plan.circuits.find(x => x.members.includes(id));
  if (circuit) { const t = leagueTable(circuit, seasonGames); const pos = t.findIndex(r => r.id === id); current.push(`League: ${pos + 1}${['st', 'nd', 'rd'][pos] ?? 'th'} of ${t.length} in the ${divisionLabel(circuit.division)} (${REGION_NAMES[circuit.region]}), ${t[pos]?.points ?? 0} points`); }
  for (const sw of st.plan.swiss) if (sw.entrants.includes(id)) { const t = swissTable(sw, seasonGames); const pos = t.findIndex(r => r.id === id); current.push(`${sw.name}: ${sw.rounds.length ? `${pos + 1} of ${t.length}, ${t[pos]?.points ?? 0} points after ${sw.rounds.length} round(s)` : 'Entered (starts round 4)'}`); }
  if (st.plan.champ?.qualifiers.includes(id)) { const out = st.plan.champ.stages.flatMap(sg => sg.matches.map(m => ({ sg, m }))).filter(x => x.m.a === id || x.m.b === id); const last = out[out.length - 1]; current.push(`Crown Championship: ${last ? (last.m.winner === id || (st.plan.champ.champions.includes(id)) ? `through the ${last.sg.label}` : last.m.winner ? `eliminated in the ${last.sg.label}` : `playing the ${last.sg.label}`) : 'Qualified'}`); }
  if (!current.length) current.push(c.status === 'retired' ? 'Retired.' : 'No event in progress.');
  const rivalry = (() => { const { meetings, kos, finishes } = collect(st, new Set([PLAYER_ID]), games.mine); return computeRivalry(PLAYER_ID, id, meetings, kos, finishes, st.world.season, x => fed.name(x)); })();
  const toggleWatch = async () => {
    setMsg(null);
    try { await fed.setWatchlist(watched ? st.extra.watchlist.filter(x => x !== id) : [...st.extra.watchlist, id]); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => history.back()}>← Back</button>
        <span className="spacer" />
        <button className="btn small" data-testid="watch-toggle" disabled={services.readOnly} onClick={toggleWatch}>{watched ? '★ On Watchlist' : '☆ Add to Watchlist'}</button>
        <button className="btn small" data-testid="follow-toggle" disabled={services.readOnly} onClick={() => { const f = st.extra.favorites ?? []; void fed.setFavorites(f.includes(id) ? f.filter(x => x !== id) : [...f, id]); }}>{(st.extra.favorites ?? []).includes(id) ? 'Following ✓' : 'Follow Career'}</button>
        {fed.clubLevelOf() > 0 && c && c.status === 'active' && !fed.activeContracts().some(x => x.competitorId === c.id) && (
          <button className="btn small" data-testid="offer-contract" disabled={services.readOnly} title={`Stipend ${fmtCrowns(stipendFor(c.division, avgSeasonEarnings(c)), 0)} per season; you receive 25% of their prize money`} onClick={async () => { setMsg(null); try { await fed.signContract(c.id); setMsg(`Signed ${c.name}: stipend ${fmtCrowns(stipendFor(c.division, avgSeasonEarnings(c)), 0)} per season.`); } catch (e) { setMsg((e as Error).message); } }}>Offer Contract ({fmtCrowns(stipendFor(c.division, avgSeasonEarnings(c)), 0)}/Season)</button>
        )}
        {fed.activeContracts().some(x => x.competitorId === id) && <span className="chip gold">Sponsored by You</span>}
      </div>
      {msg && <div className="notice warn" role="alert">{msg}</div>}
      <div className="panel row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <Portrait seed={c.portraitSeed} size={96} crown={c.titles.some(t => t.title.includes('Crown Champion'))} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0 }}>{c.name}</h1>
          {persona?.kind === 'historical' && (
            <div className="small" data-testid="persona-profile" style={{ margin: '4px 0' }}>
              <span className="chip">Historical persona (fictional)</span>{' '}
              <span className="muted">Named after {persona.identity.name} ({lifespan(persona.identity)}): {persona.identity.descriptor}. {PERSONA_NOTE}</span>
            </div>
          )}
          {persona?.kind === 'contemporary' && (
            <div className="small" data-testid="persona-profile" style={{ margin: '4px 0' }}>
              <span className="chip">Contemporary persona (fictional)</span>{' '}
              <strong data-testid="persona-disclosure">{CONTEMPORARY_DISCLOSURE}</strong>{' '}
              <span className="muted">Named after {persona.identity.name}, {persona.identity.descriptor}. {CONTEMPORARY_NOTE} Settings can show an original name instead.</span>
            </div>
          )}
          <div className="row small muted" style={{ flexWrap: 'wrap' }}>
            <Insignia division={c.division} size={20} />{divisionLabel(c.division)} · {REGION_NAMES[c.region]} · Age {ageOf(c, season)} · {c.status === 'retired' ? 'Retired' : c.status === 'reserve' ? 'Reserve' : 'Active'}{c.status === 'retired' && c.retiredSeason ? ` (season ${c.retiredSeason})` : ''}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 24, flexWrap: 'wrap' }}>
            <div className="stat"><span className="v mono" data-testid="competitor-elo">{fmtCareerElo(c.rating)}</span><span className="k">Career Elo ±{Math.round(c.rd)}</span></div>
            <div className="stat"><span className="v mono">{c.form || '—'}</span><span className="k">Form (last 5)</span></div>
            <div className="stat"><span className="v">{c.stats.w}–{c.stats.d}–{c.stats.l}</span><span className="k">Career W–D–L</span></div>
            <div className="stat" data-testid="competitor-rank" title={RANK_TOOLTIP}><span className="v" style={{ fontSize: '1.15rem' }}><RankBadge rank={competitorRank(c)} size="sm" /></span><span className="k">Competitive Rank (Circuit Grade){competitorHighestRank(c) && competitorHighestRank(c)!.step > competitorRank(c)!.step ? ` · highest ${competitorHighestRank(c)!.label} (S${competitorHighestRank(c)!.season})` : ' · their highest so far'} · <a href="#/ranks">guide</a></span></div>
            <div className="stat" data-testid="competitor-fedtitle" title={FED_TITLE_TOOLTIP}><span className="v" style={{ fontSize: '1.15rem' }}>{c.fedTitle ? <TitleBadge title={c.fedTitle} size="sm" /> : <>None <HonourTag kind="title" /></>}</span><span className="k">Federation Title · permanent, earned by norms</span></div>
            <div className="stat"><span className="v">{c.reputation}</span><span className="k">Reputation</span></div>
            <div className="stat"><span className="v">{fmtCrowns(c.earnings, 0)}</span><span className="k">Career Earnings</span></div>
          </div>
          <div className="small" style={{ marginTop: 8 }}>Style: <strong>{styleShown}</strong>{!isValidatedStyle(c.style) && c.style !== 'universal' && <span className="muted"> (listed as {STYLE_LABEL[c.style]}, but they play the standard engine style)</span>}</div>
          {styleTendency(c.style) && <div className="small muted" data-testid="style-tendency">Scouting: {styleTendency(c.style)}</div>}
          <div className="small muted">This is their public rating. Their true strength stays hidden, from forecasts and traders too.</div>
          {/* v0.10: said from the public rating only, so nothing hidden leaks (docs/RATING_SPECTRUM.md) */}
          {(() => { const n = strengthNote(c.rating); return n.text && (n.kind === 'beyond-measured' || n.kind === 'beginner' || n.kind === 'below-measured') ? <div className="small muted" data-testid="strength-note">{n.text}</div> : null; })()}
          <div className="small" style={{ marginTop: 6 }}><strong>Ambition:</strong> {ambitionOf(c)}{featuredTag ? <> · <span className="chip gold">{featuredTag === 'circle' ? 'Featured Rival · Your Circle' : 'Featured Legend'}</span></> : null}</div>
        </div>
        <div className="emblem-row" data-testid="insignia-row">
          <div className="emblem-cell"><Emblem spec={personalEmblem(c.id, c.titles.length, c.fedTitle ?? null)} size="md" title={`${c.name}'s personal insignia`} /><span className="small muted">Insignia</span></div>
          {competitorRank(c) && <div className="emblem-cell" title={RANK_TOOLTIP} data-testid="insignia-rank"><HonourFrame kind="rank" spec={competitorRank(c)!.insignia} size="md" title={competitorRank(c)!.ariaLabel} /><span className="small muted">{competitorRank(c)!.label}</span><HonourTag kind="rank" /></div>}
          {c.fedTitle && <div className="emblem-cell" title={FED_TITLE_TOOLTIP} data-testid="insignia-fedtitle"><HonourFrame kind="title" spec={titleEmblem(c.fedTitle)} size="md" title={`Federation Title ${c.fedTitle} emblem`} /><span className="small">{c.fedTitle}</span><HonourTag kind="title" /></div>}
          <div className="emblem-cell"><Emblem spec={divisionEmblem(c.division)} size="md" title={divisionLabel(c.division)} /><span className="small muted">Division {c.division}</span></div>
          <div className="emblem-cell"><Emblem spec={clubEmblem(clubOf(c.id, c.region).identity)} size="md" title={clubOf(c.id, c.region).identity.name} /><span className="small muted">{clubOf(c.id, c.region).identity.name}</span></div>
          <div className="emblem-cell"><Emblem spec={regionEmblem(c.region)} size="md" title={`Arms of ${REGION_NAMES[c.region]}`} /><span className="small muted">{REGION_NAMES[c.region]}</span></div>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel stack" data-testid="rivalry-panel">
          <h2 className="h3">Rivalry with You</h2>
          {rivalry && rivalry.meetings > 0 ? <>
            <IntensityBar r={rivalry} />
            <ul className="small" style={{ margin: 0 }}>{rivalry.events.slice(0, 8).map((e, i) => <li key={i}>{e.text} <span className="muted">(+{e.points}, S{e.season})</span></li>)}</ul>
            <details className="small muted"><summary>Details</summary>Points fade by 30% each season. Only the first two meetings in a season count.</details>
          </> : <p className="small muted">No recorded meetings yet.</p>}
        </div>
        <div className="panel stack" data-testid="following-panel">
          <h2 className="h3">This Season</h2>
          {current.map((x, i) => <div key={i} className="small">{x}</div>)}
          <div className="small" title={FED_TITLE_TOOLTIP}><strong>Federation Title:</strong> {c.fedTitle ?? 'None'} <HonourTag kind="title" />{progress.next ? <> · Next: <strong>{progress.next}</strong>: {progress.lines.join(' · ')}</> : null}</div>
          <div className="small muted">Norms: {(c.norms ?? []).length ? (c.norms ?? []).slice(-4).map(n => `${n.event} ${n.tpr}`).join(' · ') : 'None'}</div>
        </div>
      </div>
      {scouting && nextOpp && (
        <div className="panel" style={{ marginTop: 14, borderColor: 'var(--accent)' }} data-testid="dossier">
          <h2 className="h3">Scouting Dossier · Your Next Opponent</h2>
          {competitorRank(c) && <div className="small" data-testid="dossier-rank" title={RANK_TOOLTIP}>Competitive Rank (Circuit Grade): <strong>{competitorRank(c)!.label}</strong> <HonourTag kind="rank" />{competitorHighestRank(c) && competitorHighestRank(c)!.step > competitorRank(c)!.step ? ` (highest ${competitorHighestRank(c)!.label})` : ''}. Standing score at the last checkpoint: {c.rank && c.rank[4] >= 0 ? (c.rank[4] / 10).toFixed(1) : '—'}.</div>}
          <div className="small" data-testid="dossier-fedtitle" title={FED_TITLE_TOOLTIP}>Federation Title: <strong>{c.fedTitle ?? 'none'}</strong> <HonourTag kind="title" /> <span className="muted">(permanent, earned by norms; separate from the rank)</span></div>
          <div className="small">Rating trend: {c.history.slice(-4).map(h => `S${h.season} ${fmtCareerElo(h.rating)}`).join(' → ') || 'First season'} → now {fmtCareerElo(c.rating)}. Form {c.form || '—'}. This season: {results.filter(r => r.season === season).reduce((s, r) => s + r.score, 0)} / {results.filter(r => r.season === season).length}. As White {pct(results.filter(r => r.color === 'white'))}, as Black {pct(results.filter(r => r.color === 'black'))}.</div>
          <div className="small muted">You can replay the recorded games below. Summary results have no moves to replay.</div>
        </div>
      )}
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h2 className="h3">Head-to-Head with You</h2>
          {vsMe.length === 0 ? <p className="small muted">You have not met yet.</p> : <p>You {vsMe.reduce((s, r) => s + (1 - r.score), 0)} – {vsMe.reduce((s, r) => s + r.score, 0)} {c.name} ({vsMe.length} game{vsMe.length > 1 ? 's' : ''})</p>}
          <h2 className="h3">Rivalries</h2>
          {topRivals.length === 0 ? <p className="small muted">No repeated opponents yet.</p> : (
            <ul className="small">{topRivals.map(([o, v]) => <li key={o}><button className="btn ghost small inline-link" onClick={() => go({ name: 'competitor', id: o })}>{fed.name(o)}</button> — {v.score}/{v.n}</li>)}</ul>
          )}
          <h2 className="h3">Titles</h2>
          {c.titles.length === 0 ? <p className="small muted">None yet.</p> : <ul className="small">{c.titles.map((t, i) => <li key={i}>{t.title}</li>)}</ul>}
        </div>
        <div className="panel">
          <h2 className="h3">Career by Season</h2>
          {c.history.length === 0 ? <p className="small muted">First season in progress.</p> : (
            <table><thead><tr><th>Season</th><th>Division</th><th>Place</th><th>Pts</th><th>Rating</th></tr></thead>
              <tbody>{c.history.slice().reverse().map(h => <tr key={h.season}><td>{h.season}</td><td>{h.division} · {REGION_NAMES[h.region]}</td><td>{h.rank}</td><td>{h.points}</td><td>{fmtCareerElo(h.rating)}</td></tr>)}</tbody></table>
          )}
          {c.milestones.length > 0 && <><h2 className="h3">Milestones</h2><ul className="small">{c.milestones.slice(-8).reverse().map((m, i) => <li key={i}>S{m.season} R{m.round}: {m.text}</li>)}</ul></>}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h2 className="h3">Recorded Games</h2>
        {games.world.length + games.mine.length === 0 ? <p className="small muted">No recorded games yet. Only featured matches and your own games are recorded move by move.</p> : (
          <ul className="small">
            {games.world.map(g => <li key={g.id}><button className="btn ghost small inline-link" onClick={() => go({ name: 'watch', id: g.fixtureId })}>{fed.name(g.white)} – {fed.name(g.black)} {g.result}</button> <span className="muted">S{g.season} R{g.round} · {eventName(g.event)} · Engine game ({g.mode === 'watched-live' ? 'watched live' : 'played in background'})</span></li>)}
            {games.mine.map(g => <li key={g.id}><button className="btn ghost small inline-link" onClick={() => go({ name: 'analysis', gameId: g.id })}>You vs {c.name} {g.result ?? ''}</button> <span className="muted">{g.context.eventName ?? 'Federation'} · Your rated game</span></li>)}
          </ul>
        )}
        <h2 className="h3">Recent Results</h2>
        <table><thead><tr><th>S/R</th><th>Event</th><th>Opponent</th><th>Colour</th><th>Score</th><th className="hide-sm">Record</th></tr></thead>
          <tbody>{results.slice(0, 25).map((r, i) => <tr key={i}><td>{r.season}/{r.round}</td><td className="small">{eventName(r.event)}</td><td>{fed.name(r.opp)}</td><td>{r.color === 'white' ? 'White' : 'Black'}</td><td>{r.score === 1 ? 'W' : r.score === 0 ? 'L' : 'D'}</td><td className="hide-sm small muted">{r.tier === 3 ? 'Summary result' : r.tier === 2 ? 'Engine game' : 'Your game'}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

const pct = (rs: { score: number }[]) => (rs.length ? `${Math.round((100 * rs.reduce((s, r) => s + r.score, 0)) / rs.length)}% (${rs.length})` : '—');
