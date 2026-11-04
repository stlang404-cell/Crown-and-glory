import { useEffect, useMemo, useState } from 'react';
import { NeedsFederation } from './NeedsFederation';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { Emblem, Trophy } from './Emblem';
import { PLAYER_ID } from '../federation/model';
import { titleEmblem, FED_TITLES, tournamentCrest, TROPHY_FOR, achievementEmblem, type TournamentId } from '../heraldry/catalog';
import { nextTitleProgress } from '../heraldry/titles';
import { achievementsOf } from '../app/achievements';
import { rivalriesOf } from '../app/rivalries';
import type { WorldGame } from '../app/federation';
import { usePlayerGames } from './RivalsScreen';

/** Which tournament a recorded title belongs to (titles are recorded strings from the season engine). */
export function titleKind(title: string): TournamentId {
  if (/Crown Champion/.test(title)) return 'champ';
  if (/Federation Open/.test(title)) return 'open';
  if (/Challenger/.test(title)) return 'challenger';
  if (/Club Weekend/.test(title)) return 'club';
  return 'league';
}

export function HallScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  const games = usePlayerGames();
  const [finals, setFinals] = useState<WorldGame[]>([]);
  useEffect(() => { if (st) fed.worldGames().then(g => setFinals(g.filter(x => x.event === 'champ'))); }, [services.revision]);
  const data = useMemo(() => {
    if (!st) return null;
    const champs = new Map<number, { id: string; name: string; seed: number; title: string }[]>();
    const events: { season: number; title: string; id: string; name: string }[] = [];
    for (const c of st.competitors.values()) for (const t of c.titles) {
      if (/Crown Champion/.test(t.title)) champs.set(t.season, [...(champs.get(t.season) ?? []), { id: c.id, name: c.name, seed: c.portraitSeed, title: t.title }]);
      if (/winner|Crown Champion/.test(t.title)) events.push({ season: t.season, title: t.title, id: c.id, name: c.name });
    }
    for (const t of st.world.player.titles) {
      if (/Crown Champion/.test(t.title)) champs.set(t.season, [...(champs.get(t.season) ?? []), { id: PLAYER_ID, name: 'You', seed: 0, title: t.title }]);
      events.push({ season: t.season, title: t.title, id: PLAYER_ID, name: 'You' });
    }
    const titled = [...st.competitors.values()].filter(c => c.fedTitle && FED_TITLES.indexOf(c.fedTitle) >= 2).sort((a, b) => FED_TITLES.indexOf(b.fedTitle!) - FED_TITLES.indexOf(a.fedTitle!) || b.rating - a.rating).slice(0, 24);
    return { champs: [...champs].sort((a, b) => b[0] - a[0]), events: events.sort((a, b) => b.season - a.season), titled };
  }, [st, services.revision]);
  if (!st || !data) return <NeedsFederation title="Hall of Fame" />;
  const p = st.world.player;
  const progress = nextTitleProgress({ norms: p.norms ?? [], peakRating: p.peakRating ?? 0, establishedPeak: p.establishedPeak ?? 0, honours: p.titles.map(t => t.title), current: p.fedTitle ?? null });
  const ach = achievementsOf(st, rivalriesOf(st, PLAYER_ID, games));
  const finalOf = (s: number) => finals.find(g => g.season === s && (g.stage ?? '').startsWith('Final'));
  return (
    <div>
      <h1>Hall of Fame</h1>
      <section className="panel stack" data-testid="trophy-room">
        <div className="panel-title"><h3 style={{ margin: 0 }}>Your Trophy Room</h3>{p.fedTitle && <span className="chip gold">{p.fedTitle}</span>}</div>
        <div className="emblem-row">
          {p.fedTitle && <div className="emblem-cell"><Emblem spec={titleEmblem(p.fedTitle)} size="lg" title={`Federation title ${p.fedTitle}`} /><span className="small"><strong>{p.fedTitle}</strong><br /><span className="muted">Federation Title</span></span></div>}
          {p.titles.map((t, i) => <div key={i} className="emblem-cell" data-testid="player-trophy"><Trophy kind={TROPHY_FOR[titleKind(t.title)]} size="lg" title={t.title} /><span className="small"><strong>{t.title.replace(/ S\d+$/, '')}</strong><br /><span className="muted">Season {t.season}</span></span></div>)}
          {!p.fedTitle && p.titles.length === 0 && <p className="small muted">No trophies yet. Win an event to fill your trophy room.</p>}
        </div>
        <div className="small">{progress.next ? <>Next Federation Title: <strong>{progress.next}</strong> · {progress.lines.join(' · ')}</> : progress.lines[0]}</div>
        <div className="small muted">Norms: {(p.norms ?? []).length ? (p.norms ?? []).map(n => `${n.event} (${n.score}/${n.games}, performance ${n.tpr}, ${n.tier})`).join(' · ') : 'None yet'}</div>
        <h3>Achievements</h3>
        <div className="emblem-row">{ach.map(a => <div key={a.def.id} className="emblem-cell" style={{ opacity: a.earned ? 1 : 0.55 }}><Emblem spec={achievementEmblem(a.def, a.earned)} size="md" title={`${a.def.name}${a.earned ? '' : ' (not yet earned)'}`} /><span className="small"><strong>{a.def.name}</strong><br /><span className="muted">{a.earned ? a.evidence || 'Earned' : a.def.description}</span></span></div>)}</div>
      </section>
      <section className="panel stack" style={{ marginTop: 14 }} data-testid="hall-champions">
        <div className="panel-title"><h3 style={{ margin: 0 }} className="row"><Emblem spec={tournamentCrest('champ')} size="sm" title="Crown Championship" /> Crown Champions</h3></div>
        {data.champs.length === 0 ? <p className="small muted">No Crown Championship has been decided yet. It runs in rounds 16–19.</p> : data.champs.map(([s, who]) => {
          const g = finalOf(s);
          return (
            <div key={s} className="row" style={{ flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 8 }} data-testid="hall-row">
              <Trophy kind="grand" size="md" title={`Crown Championship, Season ${s}`} />
              {who.map(w => <span key={w.id} className="row" style={{ gap: 6 }}>{w.id !== PLAYER_ID && <Portrait seed={w.seed} size={40} crown />}<button className="btn ghost small" style={{ padding: 0 }} onClick={() => w.id !== PLAYER_ID && go({ name: 'competitor', id: w.id })}><strong>{w.name}</strong></button></span>)}
              <span className="small muted">Season {s}{who.length > 1 ? ' · Joint title' : ''}</span>
              <span className="spacer" />
              {g ? <button className="btn small" onClick={() => go({ name: 'watch', id: g.fixtureId })}>Replay Final</button> : <span className="small muted">Result only, no replay</span>}
            </div>
          );
        })}
      </section>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <section className="panel" data-testid="hall-events">
          <h3>Event Champions</h3>
          <ul className="small" style={{ maxHeight: 360, overflow: 'auto', paddingLeft: 0, listStyle: 'none' }}>
            {data.events.slice(0, 60).map((e, i) => <li key={i} className="row" style={{ gap: 6 }}><Trophy kind={TROPHY_FOR[titleKind(e.title)]} size="sm" title={e.title} /> S{e.season} · {e.title.replace(/ S\d+$/, '')}: <button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => e.id !== PLAYER_ID && go({ name: 'competitor', id: e.id })}>{e.name}</button></li>)}
          </ul>
        </section>
        <section className="panel" data-testid="hall-titled">
          <h3>Paladins and Sovereigns</h3>
          {data.titled.length === 0 ? <p className="small muted">No one has earned Paladin or Sovereign yet. Both need three high norms, a proven peak rating and major honours.</p> : (
            <ul className="small" style={{ paddingLeft: 0, listStyle: 'none' }}>{data.titled.map(c => <li key={c.id} className="row" style={{ gap: 6 }}><Emblem spec={titleEmblem(c.fedTitle!)} size="sm" title={c.fedTitle!} /> <button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'competitor', id: c.id })}>{c.name}</button> <span className="muted">{c.fedTitle} · {c.norms?.length ?? 0} norms · Peak {c.establishedPeak ?? '—'}</span></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
