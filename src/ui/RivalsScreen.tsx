import { scrollRegion } from './scrollRegion';
import { useEffect, useMemo, useState } from 'react';
import { fmtCareerElo } from '../ratings/display';
import { NeedsFederation } from './NeedsFederation';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { Emblem } from './Emblem';
import { PLAYER_ID, divisionLabel, REGION_NAMES } from '../federation/model';
import { personalEmblem, divisionEmblem } from '../heraldry/catalog';
import { RankBadge, TitleBadge } from './RankBadge';
import { competitorRank } from '../federation/ranks';
import { clubEmblem, clubOf, clubsOf } from '../heraldry/clubs';
import type { Competitor } from '../federation/model';
import { ambitionOf } from '../heraldry/rivals';
import { rivalriesOf, featuredRivalries, headToHead, lostLastMeeting, rivalryFixtures, rivalryTrophies, collect } from '../app/rivalries';
import { fmtCrowns } from '../exchange/ledger';
import type { GameRecord } from '../games/types';
import type { Rivalry } from '../heraldry/rivalry';

export function IntensityBar({ r }: { r: Rivalry }) {
  return <div className="stack" style={{ gap: 2 }}><div className="intensity" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.intensity} aria-label={`Rivalry intensity ${r.intensity} of 100`}><i style={{ width: `${r.intensity}%` }} /></div><span className="small muted">{r.level} · {r.intensity}/100 · {r.w}–{r.d}–{r.l} in {r.meetings}</span></div>;
}

export function usePlayerGames(kinds: string[] = ['federation']): GameRecord[] {
  const services = useServices();
  const [g, setG] = useState<GameRecord[]>([]);
  const key = kinds.join(',');
  useEffect(() => { let live = true; services.db.allGames().then(x => { if (live) setG(x.filter(y => key.split(',').includes(y.context.kind))); }); return () => { live = false; }; }, [services.revision, key]);
  return g;
}

/** v0.11: a rated Rivalry Challenge (or rematch) — an ordinary rated Quick Match against the rival; it counts in the
 *  head-to-head shown here but never adds rivalry intensity, standings or prizes. */
function ChallengeButton({ id, rematch }: { id: string; rematch: boolean }) {
  const services = useServices();
  const { go } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return <>
    <button className="btn small" data-testid={rematch ? 'rival-rematch' : 'rival-challenge'} disabled={busy || services.readOnly} title="A rated rapid game against this rival (not a league fixture)" onClick={async e => {
      e.stopPropagation(); setBusy(true);
      try {
        const r = await services.db.ratingState('rapid');
        const g = await services.fed.quickMatchGameFor(id, { rated: true, humanColor: Math.random() < 0.5 ? 'white' : 'black', human: { rating: r.rating, rd: r.rd }, nowMs: Date.now(), challenge: true });
        await services.saveGame(g); go({ name: 'match', gameId: g.id });
      } catch (err) { setMsg((err as Error).message); setBusy(false); }
    }}>{rematch ? 'Rematch' : 'Challenge'}</button>
    {msg && <span className="small neg">{msg}</span>}
  </>;
}

export function RivalsScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  const games = usePlayerGames();
  const allMine = usePlayerGames(['federation', 'quick-match']);
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
          {(['featured', 'mine', 'legends', 'clubs'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{{ featured: 'Featured Rivals', mine: 'Your Rivalries', legends: 'Legend Rivalries', clubs: 'Clubs' }[t]}</button>)}
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
                  <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}><strong>{c.name}</strong><RankBadge rank={competitorRank(c)} testId="rival-rank" /><TitleBadge title={c.fedTitle} testId="rival-fedtitle" />{f.tag === 'circle' && <span className="chip info">Your Circle</span>}{favs.has(c.id) && <span className="chip">★ Followed</span>}{c.status === 'retired' && <span className="chip">Retired</span>}</div>
                  <div className="small"><Emblem spec={divisionEmblem(c.division)} size="sm" title={divisionLabel(c.division)} /> {divisionLabel(c.division)} · {REGION_NAMES[c.region]} · {fmtCareerElo(c.rating, { rd: c.rd })} · Form <span className="mono">{c.form || '—'}</span></div>
                  <div className="small"><Emblem spec={clubEmblem(club.identity)} size="sm" title={club.identity.name} /> {club.identity.name} · {c.titles.length} {c.titles.length === 1 ? 'title' : 'titles'} · Reputation {c.reputation}</div>
                  <div className="small muted">{ambitionOf(c)}</div>
                  {r ? <IntensityBar r={r} /> : <span className="small muted">You have not met yet.</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'mine' && (() => {
        const rivals = mine.filter(r => r.intensity >= 10).slice(0, 30);
        const upcoming = rivalryFixtures(st.plan, st.world.round, new Set(rivals.map(r => r.b)), id => fed.name(id));
        const kos = collect(st, new Set([PLAYER_ID])).kos;
        return (
          <div className="stack">
            <div className="panel" data-testid="rivalry-events">
              <h3 style={{ marginTop: 0 }}>Rivalry Events This Season</h3>
              {upcoming.length === 0 ? <p className="small muted">No scheduled meeting with a rival this season. League meetings come from the fixed round-robin schedule; knockout meetings appear once drawn.</p>
                : <ul className="small">{upcoming.map(u => <li key={`${u.rival}:${u.round}:${u.kind}`}><span className="chip">{u.kind === 'league' ? 'League' : 'Knockout'}</span> {u.text}</li>)}</ul>}
            </div>
            <div className="panel" data-testid="my-rivalries">
              {mine.length === 0 ? <p className="small muted" data-testid="rivals-empty">No rivalries yet. Play federation games to start one. <button className="btn small" onClick={() => go({ name: 'world' })}>Your Fixtures</button></p> : (
                <div style={{ overflowX: 'auto' }} ref={scrollRegion('Your rivalries table')}><table className="small"><thead><tr><th>Opponent</th><th>Intensity</th><th>Head-to-Head</th><th className="hide-sm">Trophies</th><th></th></tr></thead>
                  <tbody>{mine.slice(0, 30).map(r => {
                    const h = headToHead(r, r.b, allMine);
                    const tr = rivalryTrophies(r, kos).filter(t => t.earned);
                    const active = st.competitors.get(r.b)?.status === 'active';
                    return <tr key={r.b} className="clickable" data-testid="rivalry-row" onClick={() => go({ name: 'competitor', id: r.b })}>
                      <td>{fed.name(r.b)}<div className="muted hide-sm">{r.events[0]?.text ?? ''}</div></td>
                      <td style={{ minWidth: 140 }}><IntensityBar r={r} /></td>
                      <td className="mono" data-testid="h2h">Federation {h.federation.w}–{h.federation.d}–{h.federation.l}{h.challenges.w + h.challenges.d + h.challenges.l > 0 ? <div className="muted">Challenges {h.challenges.w}–{h.challenges.d}–{h.challenges.l}</div> : null}</td>
                      <td className="hide-sm">{tr.length ? tr.map(t => <span key={t.id} className="chip gold" title={t.rule}>{t.name}</span>) : <span className="muted">—</span>}</td>
                      <td>{active && <ChallengeButton id={r.b} rematch={lostLastMeeting(st, r.b)} />}</td>
                    </tr>;
                  })}</tbody></table></div>
              )}
              <details className="small muted"><summary>Challenges, rematches and rivalry trophies</summary>A challenge or rematch is a rated rapid game against the rival (a Quick Match, never a league fixture): it counts in the head-to-head shown here but never in rivalry intensity, standings or prizes. Rivalry trophies come from recorded results only: Rivalry Laurel (Nemesis level and you lead the federation head-to-head), Arch-rival Crown (Arch-rival level and you lead), Knockout Verdict (you eliminated the rival in a knockout).</details>
            </div>
          </div>
        );
      })()}
      {tab === 'legends' && (
        <div className="panel" data-testid="legend-rivalries">
          {legends.length === 0 ? <p className="small muted">The featured rivals have not met yet.</p> : (
            <table className="small"><thead><tr><th>Rivalry</th><th>Intensity</th><th className="hide-sm">Storyline</th></tr></thead>
              <tbody>{legends.map(r => <tr key={r.a + r.b}><td><button className="btn ghost small inline-link" onClick={() => go({ name: 'competitor', id: r.a })}>{fed.name(r.a)}</button> vs <button className="btn ghost small inline-link" onClick={() => go({ name: 'competitor', id: r.b })}>{fed.name(r.b)}</button></td><td style={{ minWidth: 160 }}><IntensityBar r={r} /></td><td className="hide-sm muted">{r.events.slice(0, 2).map(e => e.text).join(' · ')}</td></tr>)}</tbody></table>
          )}
        </div>
      )}
      {tab === 'clubs' && (
        <div className="panel" data-testid="clubs">
          <table className="small"><thead><tr><th>Club</th><th className="hide-sm">Region</th><th>Members</th><th>Titles</th><th>Treasury</th></tr></thead>
            <tbody>{(() => {
              // members grouped once (a 10,240 world has 160 clubs: one pass, not one pass per club)
              const byClub = new Map<string, Competitor[]>();
              for (const c of st.competitors.values()) { if (c.status !== 'active') continue; const id = clubOf(c.id, c.region).id; const l = byClub.get(id); if (l) l.push(c); else byClub.set(id, [c]); }
              return clubsOf(fed.topology().regions).map(k => ({ k, members: byClub.get(k.id) ?? [] }));
            })().map(({ k, members }) => {
              return <tr key={k.id}><td><span className="row" style={{ gap: 8 }}><Emblem spec={clubEmblem(k.identity, members.reduce((a, c) => a + c.titles.length, 0) >= 10 ? 2 : 1)} size="sm" title={k.identity.name} /><span>{k.identity.name}<div className="muted">“{k.identity.motto}”</div></span></span></td><td className="hide-sm">{REGION_NAMES[k.region]}</td><td>{members.length}</td><td>{members.reduce((a, c) => a + c.titles.length, 0)}</td><td className="mono">{fmtCrowns(fed.balance(`club:${k.id}`), 0)}</td></tr>;
            })}</tbody></table>
          <div className="small muted">Each season, members pay 5% of their balance in dues and the club spends 60% of its treasury on running costs.</div>
        </div>
      )}
    </div>
  );
}
