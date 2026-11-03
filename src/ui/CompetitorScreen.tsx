import { useEffect, useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { Insignia } from './WorldScreen';
import { REGION_NAMES, divisionLabel, PLAYER_ID, DIVISIONS } from '../federation/model';
import type { Competitor } from '../federation/model';
import { ageOf } from '../federation/generator';
import { eventName, WorldGame } from '../app/federation';
import { STYLE_LABEL, isValidatedStyle } from '../engine/styles';
import { fmtCrowns } from '../exchange/ledger';
import { stipendFor, avgSeasonEarnings } from '../economy/economy';
import type { GameRecord } from '../games/types';
import { Emblem } from './Emblem';
import { personalEmblem, divisionEmblem, titleEmblem, regionEmblem, FED_TITLES, FED_TITLE_ABBR } from '../heraldry/catalog';
import { AI_CLUBS, clubOf, clubEmblem } from '../heraldry/clubs';
import { ambitionOf } from '../heraldry/rivals';
import { nextTitleProgress } from '../heraldry/titles';
import { rivalriesOf, collect } from '../app/rivalries';
import { computeRivalry } from '../heraldry/rivalry';
import { IntensityBar, usePlayerGames } from './RivalsScreen';
import { leagueTable, swissTable } from '../federation/world';
import { gamesOf } from '../federation/driver';

/** All results of a competitor across stored rounds (summary results included), newest first. */
function resultsOf(rounds: Iterable<{ season: number; round: number; abstract: [string, string, string, number | null][]; fixtures: { event: string; white: string; black: string; result: number | null; tier: number; gameId: string | null }[] }>, id: string) {
  const out: { season: number; round: number; event: string; opp: string; color: 'white' | 'black'; score: number; tier: number; gameId: string | null }[] = [];
  for (const r of rounds) {
    for (const [event, w, b, res] of r.abstract) if (res !== null && (w === id || b === id)) out.push({ season: r.season, round: r.round, event, opp: w === id ? b : w, color: w === id ? 'white' : 'black', score: w === id ? res : 1 - res, tier: 3, gameId: null });
    for (const f of r.fixtures) if (f.result !== null && (f.white === id || f.black === id)) out.push({ season: r.season, round: r.round, event: f.event, opp: f.white === id ? f.black : f.white, color: f.white === id ? 'white' : 'black', score: f.white === id ? f.result : 1 - f.result, tier: f.tier, gameId: f.gameId });
  }
  return out.sort((a, b) => b.season - a.season || b.round - a.round);
}

export function CompetitorsScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  const games = usePlayerGames();
  const [q, setQ] = useState('');
  const [region, setRegion] = useState(-1);
  const [division, setDivision] = useState(0);
  const [minR, setMinR] = useState(0);
  const [maxR, setMaxR] = useState(4000);
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState('');
  const [club, setClub] = useState('');
  const [special, setSpecial] = useState<'' | 'watch' | 'featured' | 'rival' | 'titled' | 'upcoming' | 'favorites'>('');
  const rivals = useMemo(() => (st && special === 'rival' ? new Set(rivalriesOf(st, PLAYER_ID, games).filter(r => r.intensity >= 10).map(r => r.b)) : null), [st, special, games]);
  const list = useMemo(() => {
    if (!st) return [];
    const ql = q.trim().toLowerCase();
    const featured = new Set((st.world.featured ?? []).map(f => f.id));
    const upcoming = new Set(st.rounds.get(`${st.world.season}:${st.world.round}`)?.fixtures.flatMap(f => (f.result === null ? [f.white, f.black] : [])) ?? []);
    const favs = new Set(st.extra.favorites ?? []);
    return [...st.competitors.values()]
      .filter(c => c.status === 'active' && (region < 0 || c.region === region) && (!division || c.division === division) && (!ql || c.name.toLowerCase().includes(ql))
        && c.rating >= minR && c.rating <= maxR && (!title || (title === 'any' ? !!c.fedTitle : c.fedTitle === title)) && (!style || (isValidatedStyle(c.style) ? c.style : 'universal') === style)
        && (!club || clubOf(c.id, c.region).id === club)
        && (special !== 'watch' || st.extra.watchlist.includes(c.id)) && (special !== 'featured' || featured.has(c.id)) && (special !== 'rival' || !!rivals?.has(c.id))
        && (special !== 'titled' || c.titles.length > 0) && (special !== 'upcoming' || upcoming.has(c.id)) && (special !== 'favorites' || favs.has(c.id)))
      .sort((a, b) => b.rating - a.rating);
  }, [st, q, region, division, minR, maxR, title, style, club, special, rivals, services.revision]);
  if (!st) return <div className="panel"><p>Found the federation first.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  const active = [...st.competitors.values()].filter(c => c.status === 'active').length;
  const styles = ['universal', ...(['tactical', 'positional', 'defensive', 'endgame', 'aggressive'] as const).filter(x => isValidatedStyle(x))];
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0 }}>Discover Competitors</h1>
        <span className="chip">{active.toLocaleString('en')} Active · {st.competitors.size.toLocaleString('en')} on Record</span>
      </div>
      <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }} data-testid="discovery-filters">
        <input type="search" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search Competitors" />
        <select value={region} onChange={e => setRegion(+e.target.value)} aria-label="Region"><option value={-1}>All Regions</option>{REGION_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
        <select value={division} onChange={e => setDivision(+e.target.value)} aria-label="Division"><option value={0}>All Divisions</option>{Array.from({ length: DIVISIONS }, (_, i) => <option key={i} value={i + 1}>{i + 1} · {divisionLabel(i + 1)}</option>)}</select>
        <label className="small">Rating <input type="number" value={minR} step={50} onChange={e => setMinR(+e.target.value || 0)} style={{ width: 72 }} aria-label="Minimum Rating" />–<input type="number" value={maxR} step={50} onChange={e => setMaxR(+e.target.value || 4000)} style={{ width: 72 }} aria-label="Maximum Rating" /></label>
        <select value={title} onChange={e => setTitle(e.target.value)} aria-label="Federation Title"><option value="">Any Title or None</option><option value="any">Any Federation Title</option>{FED_TITLES.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <select value={style} onChange={e => setStyle(e.target.value)} aria-label="Playing Style"><option value="">Any Style</option>{styles.map(x => <option key={x} value={x}>{STYLE_LABEL[x as keyof typeof STYLE_LABEL]}</option>)}</select>
        <select value={club} onChange={e => setClub(e.target.value)} aria-label="Club"><option value="">Any Club</option>{AI_CLUBS.map(k => <option key={k.id} value={k.id}>{k.identity.name}</option>)}</select>
        <select value={special} onChange={e => setSpecial(e.target.value as typeof special)} aria-label="Show"><option value="">Everyone</option><option value="featured">Featured Rivals</option><option value="rival">Your Rivals</option><option value="favorites">Followed</option><option value="watch">Watchlist ({st.extra.watchlist.length})</option><option value="titled">Event Champions</option><option value="upcoming">Playing This Round</option></select>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>#</th><th>Competitor</th><th className="hide-sm">Region</th><th>Div</th><th>Rating</th><th className="hide-sm">Form</th><th className="hide-sm">Titles</th></tr></thead>
          <tbody>
            {list.slice(0, 200).map((c, i) => (
              <tr key={c.id} className="clickable" data-testid="competitor-row" onClick={() => go({ name: 'competitor', id: c.id })}>
                <td>{i + 1}</td>
                <td><span className="row" style={{ gap: 8 }}><Emblem spec={personalEmblem(c.id, c.titles.length, c.fedTitle ?? null)} size="sm" title={`${c.name}'s insignia`} />{c.name}{c.fedTitle && <span className="chip gold">{FED_TITLE_ABBR[c.fedTitle]}</span>}{st.extra.watchlist.includes(c.id) && <span className="chip gold">★</span>}</span></td>
                <td className="hide-sm">{REGION_NAMES[c.region]}</td><td><Emblem spec={divisionEmblem(c.division)} size="sm" title={divisionLabel(c.division)} /></td>
                <td className="mono">{Math.round(c.rating)} <span className="muted">±{Math.round(c.rd)}</span></td>
                <td className="hide-sm mono">{c.form || '—'}</td><td className="hide-sm">{c.titles.length || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > 200 && <div className="small muted">Showing the top 200 of {list.length.toLocaleString('en')} by rating. Narrow the filters to see the rest.</div>}
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
          <div className="row small muted" style={{ flexWrap: 'wrap' }}>
            <Insignia division={c.division} size={20} />{divisionLabel(c.division)} · {REGION_NAMES[c.region]} · Age {ageOf(c, season)} · {c.status === 'retired' ? 'Retired' : c.status === 'reserve' ? 'Reserve' : 'Active'}{c.status === 'retired' && c.retiredSeason ? ` (season ${c.retiredSeason})` : ''}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 24, flexWrap: 'wrap' }}>
            <div className="stat"><span className="v">{Math.round(c.rating)}</span><span className="k">Rating ±{Math.round(c.rd)}</span></div>
            <div className="stat"><span className="v mono">{c.form || '—'}</span><span className="k">Form (last 5)</span></div>
            <div className="stat"><span className="v">{c.stats.w}–{c.stats.d}–{c.stats.l}</span><span className="k">Career W–D–L</span></div>
            <div className="stat"><span className="v">{c.reputation}</span><span className="k">Reputation</span></div>
            <div className="stat"><span className="v">{fmtCrowns(c.earnings, 0)}</span><span className="k">Career Earnings</span></div>
          </div>
          <div className="small" style={{ marginTop: 8 }}>Style: <strong>{styleShown}</strong>{!isValidatedStyle(c.style) && c.style !== 'universal' && <span className="muted"> (listed as {STYLE_LABEL[c.style]}, but they play the standard engine style)</span>}</div>
          <div className="small muted">This is their public rating. Their true strength stays hidden, from forecasts and traders too.</div>
          <div className="small" style={{ marginTop: 6 }}><strong>Ambition:</strong> {ambitionOf(c)}{featuredTag ? <> · <span className="chip gold">{featuredTag === 'circle' ? 'Featured Rival · Your Circle' : 'Featured Legend'}</span></> : null}</div>
        </div>
        <div className="emblem-row" data-testid="insignia-row">
          <div className="emblem-cell"><Emblem spec={personalEmblem(c.id, c.titles.length, c.fedTitle ?? null)} size="md" title={`${c.name}'s personal insignia`} /><span className="small muted">Insignia</span></div>
          {c.fedTitle && <div className="emblem-cell"><Emblem spec={titleEmblem(c.fedTitle)} size="md" title={`Federation title ${c.fedTitle}`} /><span className="small">{c.fedTitle}</span></div>}
          <div className="emblem-cell"><Emblem spec={divisionEmblem(c.division)} size="md" title={divisionLabel(c.division)} /><span className="small muted">Division {c.division}</span></div>
          <div className="emblem-cell"><Emblem spec={clubEmblem(clubOf(c.id, c.region).identity)} size="md" title={clubOf(c.id, c.region).identity.name} /><span className="small muted">{clubOf(c.id, c.region).identity.name}</span></div>
          <div className="emblem-cell"><Emblem spec={regionEmblem(c.region)} size="md" title={`Arms of ${REGION_NAMES[c.region]}`} /><span className="small muted">{REGION_NAMES[c.region]}</span></div>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel stack" data-testid="rivalry-panel">
          <h3>Rivalry with You</h3>
          {rivalry && rivalry.meetings > 0 ? <>
            <IntensityBar r={rivalry} />
            <ul className="small" style={{ margin: 0 }}>{rivalry.events.slice(0, 8).map((e, i) => <li key={i}>{e.text} <span className="muted">(+{e.points}, S{e.season})</span></li>)}</ul>
            <details className="small muted"><summary>Details</summary>Points fade by 30% each season. Only the first two meetings in a season count.</details>
          </> : <p className="small muted">No recorded meetings yet.</p>}
        </div>
        <div className="panel stack" data-testid="following-panel">
          <h3>This Season</h3>
          {current.map((x, i) => <div key={i} className="small">{x}</div>)}
          <div className="small"><strong>Federation Title:</strong> {c.fedTitle ?? 'None'}{progress.next ? <> · Next: <strong>{progress.next}</strong>: {progress.lines.join(' · ')}</> : null}</div>
          <div className="small muted">Norms: {(c.norms ?? []).length ? (c.norms ?? []).slice(-4).map(n => `${n.event} ${n.tpr}`).join(' · ') : 'None'}</div>
        </div>
      </div>
      {scouting && nextOpp && (
        <div className="panel" style={{ marginTop: 14, borderColor: 'var(--accent)' }} data-testid="dossier">
          <h3>Scouting Dossier · Your Next Opponent</h3>
          <div className="small">Rating trend: {c.history.slice(-4).map(h => `S${h.season} ${Math.round(h.rating)}`).join(' → ') || 'First season'} → now {Math.round(c.rating)}. Form {c.form || '—'}. This season: {results.filter(r => r.season === season).reduce((s, r) => s + r.score, 0)} / {results.filter(r => r.season === season).length}. As White {pct(results.filter(r => r.color === 'white'))}, as Black {pct(results.filter(r => r.color === 'black'))}.</div>
          <div className="small muted">You can replay the recorded games below. Summary results have no moves to replay.</div>
        </div>
      )}
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3>Head-to-Head with You</h3>
          {vsMe.length === 0 ? <p className="small muted">You have not met yet.</p> : <p>You {vsMe.reduce((s, r) => s + (1 - r.score), 0)} – {vsMe.reduce((s, r) => s + r.score, 0)} {c.name} ({vsMe.length} game{vsMe.length > 1 ? 's' : ''})</p>}
          <h3>Rivalries</h3>
          {topRivals.length === 0 ? <p className="small muted">No repeated opponents yet.</p> : (
            <ul className="small">{topRivals.map(([o, v]) => <li key={o}><button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'competitor', id: o })}>{fed.name(o)}</button> — {v.score}/{v.n}</li>)}</ul>
          )}
          <h3>Titles</h3>
          {c.titles.length === 0 ? <p className="small muted">None yet.</p> : <ul className="small">{c.titles.map((t, i) => <li key={i}>{t.title}</li>)}</ul>}
        </div>
        <div className="panel">
          <h3>Career by Season</h3>
          {c.history.length === 0 ? <p className="small muted">First season in progress.</p> : (
            <table><thead><tr><th>Season</th><th>Division</th><th>Place</th><th>Pts</th><th>Rating</th></tr></thead>
              <tbody>{c.history.slice().reverse().map(h => <tr key={h.season}><td>{h.season}</td><td>{h.division} · {REGION_NAMES[h.region]}</td><td>{h.rank}</td><td>{h.points}</td><td>{Math.round(h.rating)}</td></tr>)}</tbody></table>
          )}
          {c.milestones.length > 0 && <><h3>Milestones</h3><ul className="small">{c.milestones.slice(-8).reverse().map((m, i) => <li key={i}>S{m.season} R{m.round}: {m.text}</li>)}</ul></>}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Recorded Games</h3>
        {games.world.length + games.mine.length === 0 ? <p className="small muted">No recorded games yet. Only featured matches and your own games are recorded move by move.</p> : (
          <ul className="small">
            {games.world.map(g => <li key={g.id}><button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'watch', id: g.fixtureId })}>{g.whiteName} – {g.blackName} {g.result}</button> <span className="muted">S{g.season} R{g.round} · {eventName(g.event)} · Engine game ({g.mode === 'watched-live' ? 'watched live' : 'played in background'})</span></li>)}
            {games.mine.map(g => <li key={g.id}><button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'analysis', gameId: g.id })}>You vs {c.name} {g.result ?? ''}</button> <span className="muted">{g.context.eventName ?? 'Federation'} · Your rated game</span></li>)}
          </ul>
        )}
        <h3>Recent Results</h3>
        <table><thead><tr><th>S/R</th><th>Event</th><th>Opponent</th><th>Colour</th><th>Score</th><th className="hide-sm">Record</th></tr></thead>
          <tbody>{results.slice(0, 25).map((r, i) => <tr key={i}><td>{r.season}/{r.round}</td><td className="small">{eventName(r.event)}</td><td>{fed.name(r.opp)}</td><td>{r.color === 'white' ? 'White' : 'Black'}</td><td>{r.score === 1 ? 'W' : r.score === 0 ? 'L' : 'D'}</td><td className="hide-sm small muted">{r.tier === 3 ? 'Summary result' : r.tier === 2 ? 'Engine game' : 'Your game'}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

const pct = (rs: { score: number }[]) => (rs.length ? `${Math.round((100 * rs.reduce((s, r) => s + r.score, 0)) / rs.length)}% (${rs.length})` : '—');
