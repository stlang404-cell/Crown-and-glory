import { useEffect, useMemo, useState } from 'react';
import { NeedsFederation } from './NeedsFederation';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { Emblem } from './Emblem';
import { PLAYER_ID, divisionLabel, REGION_NAMES } from '../federation/model';
import { personalEmblem, titleEmblem, divisionEmblem } from '../heraldry/catalog';
import { AI_CLUBS, clubEmblem, clubOf } from '../heraldry/clubs';
import { ambitionOf } from '../heraldry/rivals';
import { rivalriesOf, featuredRivalries } from '../app/rivalries';
import { fmtCrowns } from '../exchange/ledger';
import type { GameRecord } from '../games/types';
import type { Rivalry } from '../heraldry/rivalry';

export function IntensityBar({ r }: { r: Rivalry }) {
  return <div className="stack" style={{ gap: 2 }}><div className="intensity" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.intensity} aria-label={`Rivalry intensity ${r.intensity} of 100`}><i style={{ width: `${r.intensity}%` }} /></div><span className="small muted">{r.level} · {r.intensity}/100 · {r.w}–{r.d}–{r.l} in {r.meetings}</span></div>;
}

export function usePlayerGames(): GameRecord[] {
  const services = useServices();
  const [g, setG] = useState<GameRecord[]>([]);
  useEffect(() => { let live = true; services.db.allGames().then(x => { if (live) setG(x.filter(y => y.context.kind === 'federation')); }); return () => { live = false; }; }, [services.revision]);
  return g;
}

export function RivalsScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  const games = usePlayerGames();
  const [tab, setTab] = useState<'featured' | 'mine' | 'legends' | 'clubs'>('featured');
  const mine = useMemo(() => (st ? rivalriesOf(st, PLAYER_ID, games, id => fed.name(id)) : []), [st, games, services.revision]);
  const legends = useMemo(() => (st && tab === 'legends' ? featuredRivalries(st, id => fed.name(id)) : []), [st, tab, services.revision]);
  if (!st) return <NeedsFederation title="Rivals" />;
  const featured = st.world.featured ?? [];
  const favs = new Set(st.extra.favorites ?? []);
  const rivalryWith = (id: string) => mine.find(r => r.b === id);
  return (
    <div>
      <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Rivals</h1><span className="spacer" />
        <div className="seg" role="tablist" aria-label="Rivals Sections">
          {(['featured', 'mine', 'legends', 'clubs'] as const).map(t => <button key={t} role="tab" aria-pressed={tab === t} onClick={() => setTab(t)}>{{ featured: 'Featured Rivals', mine: 'Your Rivalries', legends: 'Legend Rivalries', clubs: 'Clubs' }[t]}</button>)}
        </div>
      </div>
      <p className="small muted">Rivalries grow from what actually happens between players. They never affect results, pairings or playing strength.</p>
      <details className="small muted"><summary>Details</summary>Intensity counts meetings, upsets, knockout eliminations, championship rematches, promotion battles and streaks. Repeated low-stakes games are capped, and points fade each season.</details>
      {tab === 'featured' && (
        <div className="grid-2" data-testid="featured-rivals">
          {featured.map(f => {
            const c = st.competitors.get(f.id)!;
            const club = clubOf(c.id, c.region);
            const r = rivalryWith(c.id);
            return (
              <div key={f.id} className="panel rival-card clickable" data-testid="rival-card" onClick={() => go({ name: 'competitor', id: c.id })} style={{ cursor: 'pointer' }}>
                <div className="stack" style={{ alignItems: 'center', gap: 4 }}><Portrait seed={c.portraitSeed} size={56} crown={c.titles.some(t => /Crown Champion/.test(t.title))} /><Emblem spec={personalEmblem(c.id, c.titles.length, c.fedTitle ?? null)} size="md" title={`${c.name}'s insignia`} /></div>
                <div className="stack" style={{ gap: 4 }}>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}><strong>{c.name}</strong>{c.fedTitle && <span className="chip gold"><Emblem spec={titleEmblem(c.fedTitle)} size="sm" title={c.fedTitle} /> {c.fedTitle}</span>}{f.tag === 'circle' && <span className="chip info">Your Circle</span>}{favs.has(c.id) && <span className="chip">★ Followed</span>}{c.status === 'retired' && <span className="chip">Retired</span>}</div>
                  <div className="small"><Emblem spec={divisionEmblem(c.division)} size="sm" title={divisionLabel(c.division)} /> {divisionLabel(c.division)} · {REGION_NAMES[c.region]} · {Math.round(c.rating)} ±{Math.round(c.rd)} · Form <span className="mono">{c.form || '—'}</span></div>
                  <div className="small"><Emblem spec={clubEmblem(club.identity)} size="sm" title={club.identity.name} /> {club.identity.name} · {c.titles.length} {c.titles.length === 1 ? 'title' : 'titles'} · Reputation {c.reputation}</div>
                  <div className="small muted">{ambitionOf(c)}</div>
                  {r ? <IntensityBar r={r} /> : <span className="small muted">You have not met yet.</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'mine' && (
        <div className="panel" data-testid="my-rivalries">
          {mine.length === 0 ? <p className="small muted">No rivalries yet. Play federation games to start one.</p> : (
            <table className="small"><thead><tr><th>Opponent</th><th>Intensity</th><th className="hide-sm">Latest</th></tr></thead>
              <tbody>{mine.slice(0, 30).map(r => <tr key={r.b} className="clickable" onClick={() => go({ name: 'competitor', id: r.b })}><td>{fed.name(r.b)}</td><td style={{ minWidth: 160 }}><IntensityBar r={r} /></td><td className="hide-sm muted">{r.events[0]?.text ?? ''}</td></tr>)}</tbody></table>
          )}
        </div>
      )}
      {tab === 'legends' && (
        <div className="panel" data-testid="legend-rivalries">
          {legends.length === 0 ? <p className="small muted">The featured rivals have not met yet.</p> : (
            <table className="small"><thead><tr><th>Rivalry</th><th>Intensity</th><th className="hide-sm">Storyline</th></tr></thead>
              <tbody>{legends.map(r => <tr key={r.a + r.b}><td><button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'competitor', id: r.a })}>{fed.name(r.a)}</button> vs <button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'competitor', id: r.b })}>{fed.name(r.b)}</button></td><td style={{ minWidth: 160 }}><IntensityBar r={r} /></td><td className="hide-sm muted">{r.events.slice(0, 2).map(e => e.text).join(' · ')}</td></tr>)}</tbody></table>
          )}
        </div>
      )}
      {tab === 'clubs' && (
        <div className="panel" data-testid="clubs">
          <table className="small"><thead><tr><th>Club</th><th className="hide-sm">Region</th><th>Members</th><th>Titles</th><th>Treasury</th></tr></thead>
            <tbody>{AI_CLUBS.map(k => {
              const members = [...st.competitors.values()].filter(c => c.status === 'active' && c.region === k.region && clubOf(c.id, c.region).id === k.id);
              return <tr key={k.id}><td><span className="row" style={{ gap: 8 }}><Emblem spec={clubEmblem(k.identity, members.reduce((a, c) => a + c.titles.length, 0) >= 10 ? 2 : 1)} size="sm" title={k.identity.name} /><span>{k.identity.name}<div className="muted">“{k.identity.motto}”</div></span></span></td><td className="hide-sm">{REGION_NAMES[k.region]}</td><td>{members.length}</td><td>{members.reduce((a, c) => a + c.titles.length, 0)}</td><td className="mono">{fmtCrowns(fed.balance(`club:${k.id}`), 0)}</td></tr>;
            })}</tbody></table>
          <div className="small muted">Each season, members pay 5% of their balance in dues and the club spends 60% of its treasury on running costs.</div>
        </div>
      )}
    </div>
  );
}
