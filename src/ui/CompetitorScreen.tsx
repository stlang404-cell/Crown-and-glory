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
import type { GameRecord } from '../games/types';

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
  const [q, setQ] = useState('');
  const [region, setRegion] = useState(-1);
  const [division, setDivision] = useState(0);
  const [onlyWatch, setOnlyWatch] = useState(false);
  const list = useMemo(() => {
    if (!st) return [];
    const ql = q.trim().toLowerCase();
    return [...st.competitors.values()]
      .filter(c => c.status === 'active' && (region < 0 || c.region === region) && (!division || c.division === division) && (!ql || c.name.toLowerCase().includes(ql)) && (!onlyWatch || st.extra.watchlist.includes(c.id)))
      .sort((a, b) => b.rating - a.rating);
  }, [st, q, region, division, onlyWatch, services.revision]);
  if (!st) return <div className="panel"><p>Found the federation first.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  const active = [...st.competitors.values()].filter(c => c.status === 'active').length;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0 }}>Competitors</h1>
        <span className="chip">{active.toLocaleString('en')} active · {st.competitors.size.toLocaleString('en')} on record</span>
      </div>
      <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <input type="search" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search competitors" />
        <select value={region} onChange={e => setRegion(+e.target.value)} aria-label="Region"><option value={-1}>All regions</option>{REGION_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
        <select value={division} onChange={e => setDivision(+e.target.value)} aria-label="Division"><option value={0}>All divisions</option>{Array.from({ length: DIVISIONS }, (_, i) => <option key={i} value={i + 1}>{i + 1} · {divisionLabel(i + 1)}</option>)}</select>
        <label className="small"><input type="checkbox" checked={onlyWatch} onChange={e => setOnlyWatch(e.target.checked)} /> Watchlist only ({st.extra.watchlist.length})</label>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>#</th><th>Competitor</th><th className="hide-sm">Region</th><th>Div</th><th>Rating</th><th className="hide-sm">Form</th><th className="hide-sm">Titles</th></tr></thead>
          <tbody>
            {list.slice(0, 200).map((c, i) => (
              <tr key={c.id} className="clickable" onClick={() => go({ name: 'competitor', id: c.id })}>
                <td>{i + 1}</td>
                <td><span className="row" style={{ gap: 8 }}><Portrait seed={c.portraitSeed} size={24} />{c.name}{st.extra.watchlist.includes(c.id) && <span className="chip gold">★</span>}</span></td>
                <td className="hide-sm">{REGION_NAMES[c.region]}</td><td>{c.division}</td>
                <td className="mono">{Math.round(c.rating)} <span className="muted">±{Math.round(c.rd)}</span></td>
                <td className="hide-sm mono">{c.form || '—'}</td><td className="hide-sm">{c.titles.length || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > 200 && <div className="small muted">Showing the top 200 of {list.length.toLocaleString('en')} by rating. Narrow the filters to see more.</div>}
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
  const toggleWatch = async () => {
    setMsg(null);
    try { await fed.setWatchlist(watched ? st.extra.watchlist.filter(x => x !== id) : [...st.extra.watchlist, id]); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => history.back()}>← Back</button>
        <span className="spacer" />
        <button className="btn small" data-testid="watch-toggle" disabled={services.readOnly} onClick={toggleWatch}>{watched ? '★ On watchlist' : '☆ Add to watchlist'}</button>
      </div>
      {msg && <div className="notice warn" role="alert">{msg}</div>}
      <div className="panel row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <Portrait seed={c.portraitSeed} size={96} crown={c.titles.some(t => t.title.includes('Crown Champion'))} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0 }}>{c.name}</h1>
          <div className="row small muted" style={{ flexWrap: 'wrap' }}>
            <Insignia division={c.division} size={20} />{divisionLabel(c.division)} · {REGION_NAMES[c.region]} · age {ageOf(c, season)} · {c.status}{c.status === 'retired' && c.retiredSeason ? ` (season ${c.retiredSeason})` : ''}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 24, flexWrap: 'wrap' }}>
            <div className="stat"><span className="v">{Math.round(c.rating)}</span><span className="k">Rating ±{Math.round(c.rd)}</span></div>
            <div className="stat"><span className="v mono">{c.form || '—'}</span><span className="k">Form (last 5)</span></div>
            <div className="stat"><span className="v">{c.stats.w}-{c.stats.d}-{c.stats.l}</span><span className="k">Career W-D-L</span></div>
            <div className="stat"><span className="v">{c.reputation}</span><span className="k">Reputation</span></div>
            <div className="stat"><span className="v">{fmtCrowns(c.earnings, 0)}</span><span className="k">Career earnings</span></div>
          </div>
          <div className="small" style={{ marginTop: 8 }}>Style: <strong>{styleShown}</strong>{!isValidatedStyle(c.style) && c.style !== 'universal' && <span className="muted"> (listed as {STYLE_LABEL[c.style]}, but that style did not pass behavioural validation, so they play the common engine policy)</span>}</div>
          <div className="small muted">Public rating only. Their hidden playing strength is never shown and is not used by forecasts or traders.</div>
        </div>
      </div>
      {scouting && nextOpp && (
        <div className="panel" style={{ marginTop: 14, borderColor: 'var(--accent)' }} data-testid="dossier">
          <h3>Scouting dossier · your next opponent</h3>
          <div className="small">Rating trend: {c.history.slice(-4).map(h => `S${h.season} ${Math.round(h.rating)}`).join(' → ') || 'first season'} → now {Math.round(c.rating)}. Form {c.form || '—'}. This season: {results.filter(r => r.season === season).reduce((s, r) => s + r.score, 0)} / {results.filter(r => r.season === season).length}. As White {pct(results.filter(r => r.color === 'white'))}, as Black {pct(results.filter(r => r.color === 'black'))}.</div>
          <div className="small muted">Recorded games below can be replayed; summary results are not games.</div>
        </div>
      )}
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3>Head-to-head with you</h3>
          {vsMe.length === 0 ? <p className="small muted">You have not met yet.</p> : <p>You {vsMe.reduce((s, r) => s + (1 - r.score), 0)} – {vsMe.reduce((s, r) => s + r.score, 0)} {c.name} ({vsMe.length} game{vsMe.length > 1 ? 's' : ''})</p>}
          <h3>Rivalries</h3>
          {topRivals.length === 0 ? <p className="small muted">No repeated opponents yet.</p> : (
            <ul className="small">{topRivals.map(([o, v]) => <li key={o}><button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'competitor', id: o })}>{fed.name(o)}</button> — {v.score}/{v.n}</li>)}</ul>
          )}
          <h3>Titles</h3>
          {c.titles.length === 0 ? <p className="small muted">None yet.</p> : <ul className="small">{c.titles.map((t, i) => <li key={i}>{t.title}</li>)}</ul>}
        </div>
        <div className="panel">
          <h3>Career by season</h3>
          {c.history.length === 0 ? <p className="small muted">First season in progress.</p> : (
            <table><thead><tr><th>Season</th><th>Division</th><th>Rank</th><th>Pts</th><th>Rating</th></tr></thead>
              <tbody>{c.history.slice().reverse().map(h => <tr key={h.season}><td>{h.season}</td><td>{h.division} · {REGION_NAMES[h.region]}</td><td>{h.rank}</td><td>{h.points}</td><td>{Math.round(h.rating)}</td></tr>)}</tbody></table>
          )}
          {c.milestones.length > 0 && <><h3>Milestones</h3><ul className="small">{c.milestones.slice(-8).reverse().map((m, i) => <li key={i}>S{m.season} R{m.round}: {m.text}</li>)}</ul></>}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Recorded games</h3>
        {games.world.length + games.mine.length === 0 ? <p className="small muted">No full game records yet. Most AI-vs-AI results are summary results (not replayable); only featured matches and your own games are recorded move by move.</p> : (
          <ul className="small">
            {games.world.map(g => <li key={g.id}><button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'watch', id: g.fixtureId })}>{g.whiteName} – {g.blackName} {g.result}</button> <span className="muted">S{g.season} R{g.round} · {eventName(g.event)} · engine game ({g.mode === 'watched-live' ? 'watched live' : 'played in background'})</span></li>)}
            {games.mine.map(g => <li key={g.id}><button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'analysis', gameId: g.id })}>You vs {c.name} {g.result ?? ''}</button> <span className="muted">{g.context.eventName ?? 'Federation'} · your rated game</span></li>)}
          </ul>
        )}
        <h3>Recent results</h3>
        <table><thead><tr><th>S/R</th><th>Event</th><th>Opponent</th><th>Colour</th><th>Score</th><th className="hide-sm">Record</th></tr></thead>
          <tbody>{results.slice(0, 25).map((r, i) => <tr key={i}><td>{r.season}/{r.round}</td><td className="small">{eventName(r.event)}</td><td>{fed.name(r.opp)}</td><td>{r.color}</td><td>{r.score === 1 ? 'W' : r.score === 0 ? 'L' : 'D'}</td><td className="hide-sm small muted">{r.tier === 3 ? 'summary result' : r.tier === 2 ? 'engine game' : 'your game'}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

const pct = (rs: { score: number }[]) => (rs.length ? `${Math.round((100 * rs.reduce((s, r) => s + r.score, 0)) / rs.length)}% (${rs.length})` : '—');
