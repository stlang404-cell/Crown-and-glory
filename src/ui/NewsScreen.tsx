import { useEffect, useMemo, useState } from 'react';
import { NeedsFederation } from './NeedsFederation';
import { useApp, useServices } from './App';
import { PLAYER_ID } from '../federation/model';
import type { WorldGame } from '../app/federation';
import { statesOf } from '../exchange/market';
import { Insignia } from './WorldScreen';

/** Federation news, championship history, season archive and rivalries — every item is derived from stored
 *  records (titles, milestones, results, settled markets); nothing is invented. */
export function NewsScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const st = fed.state;
  const [finals, setFinals] = useState<WorldGame[]>([]);
  useEffect(() => { if (st) fed.worldGames().then(gs => setFinals(gs.filter(g => g.event === 'champ'))); }, [services.revision]);
  const data = useMemo(() => {
    if (!st) return null;
    const name = (id: string) => fed.name(id);
    // news: titles and milestones (upsets) of the current and previous season, newest first
    const news: { season: number; round: number; text: string; id?: string }[] = [];
    for (const c of st.competitors.values()) {
      for (const t of c.titles) news.push({ season: t.season, round: 99, text: `${c.name}: ${t.title.replace(/ S\d+$/, '')}`, id: c.id });
      for (const m of c.milestones) news.push({ season: m.season, round: m.round, text: `${c.name}: ${m.text}`, id: c.id });
    }
    for (const t of st.world.player.titles) news.push({ season: t.season, round: 99, text: `You: ${t.title.replace(/ S\d+$/, '')}` });
    for (const m of st.markets.values()) if (m.status === 'settled' && m.kind && m.kind !== 'match' && m.kind !== 'sandbox') news.push({ season: m.season, round: 98, text: `Exchange: “${m.title}” settled: ${m.result !== null && m.result >= 0 ? statesOf(m)[m.result] : 'split payout (joint result)'}` });
    news.sort((a, b) => b.season - a.season || b.round - a.round);
    // championship history from titles (one row per season)
    const champs = new Map<number, string[]>();
    for (const c of st.competitors.values()) for (const t of c.titles) if (/^(Joint )?Crown Champion/.test(t.title)) champs.set(t.season, [...(champs.get(t.season) ?? []), c.name]);
    for (const t of st.world.player.titles) if (/^(Joint )?Crown Champion/.test(t.title)) champs.set(t.season, [...(champs.get(t.season) ?? []), 'You']);
    // season archive: event winners by season
    const archive = new Map<number, { title: string; who: string; id?: string }[]>();
    for (const c of st.competitors.values()) for (const t of c.titles) if (/Open winner|Crown Champion|Crown Division champion/.test(t.title)) archive.set(t.season, [...(archive.get(t.season) ?? []), { title: t.title.replace(/ S\d+$/, ''), who: c.name, id: c.id }]);
    // rivalries: pairs with the most decisive recorded meetings (summary results included, labelled)
    const pairs = new Map<string, { a: string; b: string; n: number; sa: number; champ: number }>();
    const add = (w: string, b: string, res: number | null, champ: boolean) => {
      if (res === null || w === PLAYER_ID || b === PLAYER_ID) return;
      const [a, z] = w < b ? [w, b] : [b, w];
      const k = `${a}|${z}`;
      const p = pairs.get(k) ?? { a, b: z, n: 0, sa: 0, champ: 0 };
      p.n++; p.sa += a === w ? res : 1 - res; if (champ) p.champ++;
      pairs.set(k, p);
    };
    for (const r of st.rounds.values()) {
      for (const [e, w, b, res] of r.abstract) if (e.endsWith(':1') || e === 'open') add(w, b, res, false);
      for (const f of r.fixtures) add(f.white, f.black, f.result, f.event === 'champ');
    }
    const rivalries = [...pairs.values()].filter(p => p.n >= 3).sort((x, y) => y.champ - x.champ || y.n - x.n || Math.abs(y.sa / y.n - 0.5) - Math.abs(x.sa / x.n - 0.5)).slice(0, 15);
    return { news: news.slice(0, 60), champs: [...champs].sort((a, b) => b[0] - a[0]), archive: [...archive].sort((a, b) => b[0] - a[0]), rivalries, name };
  }, [st, services.revision]);
  if (!st || !data) return <NeedsFederation title="News & History" />;
  const finalGame = (season: number) => finals.find(g => g.season === season && (g.stage ?? '').startsWith('Final'));
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0 }}>News &amp; History</h1>
      </div>
      <div className="grid-2">
        <div className="panel" data-testid="news">
          <h3>Federation News</h3>
          {data.news.length === 0 ? <p className="small muted">No news yet. Advance a round to see results here.</p> : (
            <ul className="small" style={{ maxHeight: 420, overflow: 'auto', paddingLeft: 18 }}>
              {data.news.map((n, i) => <li key={i}><span className="muted">S{n.season}{n.round < 98 ? ` R${n.round}` : ''} · </span>{n.id ? <button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'competitor', id: n.id! })}>{n.text}</button> : n.text}</li>)}
            </ul>
          )}
          <div className="small muted">Titles, upsets and settled markets.</div>
        </div>
        <div className="stack">
          <div className="panel" data-testid="champ-history">
            <h3><span aria-hidden="true">🏆 </span>Crown Championship History</h3>
            {data.champs.length === 0 ? <p className="small muted">No championship decided yet. It runs in rounds 16–19.</p> : (
              <table className="small"><thead><tr><th>Season</th><th>Champion</th><th>Final</th></tr></thead>
                <tbody>{data.champs.map(([s, who]) => { const g = finalGame(s); return <tr key={s}><td>{s}</td><td><strong>{who.join(' & ')}</strong>{who.length > 1 ? ' (Joint)' : ''}</td><td>{g ? <button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'watch', id: g.fixtureId })}>Replay {fed.name(g.white)} – {fed.name(g.black)}</button> : <span className="muted">Result only</span>}</td></tr>; })}</tbody></table>
            )}
          </div>
          <div className="panel">
            <h3>Rivalries</h3>
            {data.rivalries.length === 0 ? <p className="small muted">Rivalries appear here once two competitors have met three times.</p> : (
              <table className="small"><thead><tr><th>Pair</th><th>Meetings</th><th>Score</th></tr></thead>
                <tbody>{data.rivalries.map(r => <tr key={r.a + r.b}><td><button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'competitor', id: r.a })}>{data.name(r.a)}</button> vs <button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => go({ name: 'competitor', id: r.b })}>{data.name(r.b)}</button>{r.champ ? <span className="chip gold" style={{ marginLeft: 6 }}>Championship ×{r.champ}</span> : null}</td><td>{r.n}</td><td className="mono">{r.sa}–{r.n - r.sa}</td></tr>)}</tbody></table>
            )}
            <div className="small muted">Counts meetings in the Crown Division, Federation Open and Crown Championship.</div>
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Season Archive</h3>
        {data.archive.length === 0 ? <p className="small muted">No titles yet. Event winners appear here when each event ends.</p> : data.archive.map(([s, items]) => (
          <details key={s} open={s === data.archive[0][0]}><summary><strong>Season {s}</strong> · {items.length} {items.length === 1 ? 'title' : 'titles'}</summary>
            <ul className="small">{items.sort((a, b) => a.title.localeCompare(b.title)).map((x, i) => <li key={i}>{/Crown Division/.test(x.title) && <Insignia division={1} size={14} />} {x.title}: <button className="btn ghost small" style={{ padding: 0, minHeight: 0 }} onClick={() => x.id && go({ name: 'competitor', id: x.id })}>{x.who}</button></li>)}</ul>
          </details>
        ))}
      </div>
    </div>
  );
}
