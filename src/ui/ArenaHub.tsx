/**
 * AI vs AI Match Arena hub (#/arena; v1.1, docs/AI_ARENA.md). One mobile-first entry point to everything where AI
 * competitors play each other:
 *  * Start a custom exhibition (any two competitors; src/ui/ExhibitionScreen.tsx) or continue the current one;
 *  * Watch live official matches — the round's featured games with their official markets and the scheduled live
 *    slate (the Live Match Center, src/ui/SpectatorScreen.tsx);
 *  * Upcoming federation matches of the round;
 *  * Completed match replays: official recorded games and exhibitions (Replay Library);
 *  * Search AI competitors and send one straight to the exhibition picker.
 * Read only: the hub writes nothing.
 */
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { NeedsFederation } from './NeedsFederation';
import { eventName, type WorldGame } from '../app/federation';
import { liveMatches, type DashMatch } from '../app/dashboard';
import { filterCompetitors } from '../app/discovery';
import { listExhibitions, type ExhibitionGame } from '../app/exhibition';
import { fmtCareerElo } from '../ratings/display';
import { fmtPrice } from '../exchange/ledger';
import { divisionLabel, type Fixture } from '../federation/model';
import { STYLE_LABEL, isValidatedStyle } from '../engine/styles';
import { TitleBadge } from './RankBadge';
import { requestExhibitionPick } from './ExhibitionScreen';
import './arena.css';

const NO_SETS = { watchlist: new Set<string>(), featured: new Set<string>(), rivals: null, upcoming: new Set<string>(), favorites: new Set<string>() };
const RES = (r: string | null) => (r === '1/2-1/2' ? '½-½' : r ?? '*');
const fixRes = (r: number) => (r === 1 ? '1-0' : r === 0 ? '0-1' : '½-½');

type Replay = { id: string; kind: 'official' | 'exhibition'; white: string; black: string; result: string; at: string; detail: string; open: () => void };

export function ArenaHub() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [replays, setReplays] = useState<Replay[] | null>(null);
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const st = fed.state;
  useEffect(() => {
    if (!st) return;
    let live = true;
    void (async () => {
      const [wgs, exhs] = await Promise.all([fed.worldGames().catch(() => [] as WorldGame[]), listExhibitions(services.db)]);
      const off: Replay[] = wgs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4).map(g => ({
        id: g.id, kind: 'official', white: g.whiteName, black: g.blackName, result: RES(g.result), at: g.createdAt,
        detail: `${eventName(g.event)}${g.stage ? ` · ${g.stage}` : ''} · S${g.season} R${g.round}`, open: () => go({ name: 'watch', id: g.fixtureId }),
      }));
      const ex: Replay[] = exhs.filter((g: ExhibitionGame) => g.status === 'finished').slice(0, 4).map(g => ({
        id: g.id, kind: 'exhibition', white: g.white.name, black: g.black.name, result: RES(g.result), at: g.finishedAt ?? g.createdAt,
        detail: `Exhibition · ${Math.ceil(g.moves.length / 2)} moves${g.timeControl ? ` · ${g.timeControl.label}` : ''}`, open: () => go({ name: 'exhibition', id: g.id }),
      }));
      if (live) setReplays([...off, ...ex].sort((a, b) => b.at.localeCompare(a.at)));
    })();
    return () => { live = false; };
  }, [st, services.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const featured = useMemo(() => (st ? fed.featuredFixtures() : []), [st, services.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = useMemo(() => (st ? liveMatches(st, featured, id => fed.isLive(id), 50) : []), [st, featured, services.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const found = useMemo(() => {
    if (!st) return [];
    return filterCompetitors(st.competitors.values(), { q: dq, region: -1, division: 0, minR: -1e9, maxR: 1e9, title: '', style: '', club: '', special: '' }, NO_SETS).slice(0, 6);
  }, [st, dq]);
  if (!st) return <NeedsFederation title="AI vs AI Arena" detail="The AI vs AI Arena lists live official matches, upcoming fixtures, replays and custom exhibitions between any two Federation competitors. It opens once you found the Federation." />;

  const slate = fed.slateFixtures();
  const liveOfficial = matches.filter(m => m.status === 'live');
  const liveSlate = slate.filter(f => f.result === null && fed.liveGame(f.id)?.status === 'live');
  const upcoming = matches.filter(m => m.status === 'upcoming');
  const cur = services.exhibitions.game;
  const unfinished = cur && cur.status !== 'finished' ? cur : null;

  const matchRow = (m: DashMatch) => (
    <li key={m.fixtureId} className="hub-row" data-testid="hub-official" data-status={m.status} data-fixture={m.fixtureId}>
      <div className="hub-row-main">
        <span className={`chip ${m.status === 'live' ? 'neg is-live' : ''}`}>{m.status === 'live' ? 'LIVE' : m.status === 'upcoming' ? 'Upcoming' : `Final ${fixRes(m.result!)}`}</span>
        <strong>{m.white.name}</strong> <span className="mono muted">{fmtCareerElo(m.white.rating)}</span>
        <span className="muted">vs</span>
        <strong>{m.black.name}</strong> <span className="mono muted">{fmtCareerElo(m.black.rating)}</span>
      </div>
      <div className="hub-row-foot small">
        <span className="muted">{eventName(m.event)}{m.stage ? ` · ${m.stage}` : ''}</span>
        {m.market ? <span className="mono" aria-label="Official market prices">W {fmtPrice(m.market.prices[0])} · D {fmtPrice(m.market.prices[1])} · B {fmtPrice(m.market.prices[2])}</span> : <span className="muted">No market</span>}
        <span className="spacer" />
        {m.market?.status === 'open' && <button className="btn small" data-testid="hub-trade" onClick={() => go({ name: 'exchange', id: m.market!.id })}>Trade</button>}
        <button className={`btn small ${m.status === 'live' ? 'primary' : ''}`} data-testid="hub-watch" onClick={() => go({ name: 'watch', id: m.fixtureId })}>{m.status === 'live' ? 'Watch Live' : m.status === 'upcoming' ? 'Open Match' : 'Replay'}</button>
      </div>
    </li>
  );
  const slateRow = (f: Fixture) => {
    const lg = fed.liveGame(f.id);
    return (
      <li key={f.id} className="hub-row" data-testid="hub-slate" data-fixture={f.id}>
        <div className="hub-row-main"><span className="chip neg is-live">LIVE</span><strong>{fed.name(f.white)}</strong><span className="muted">vs</span><strong>{fed.name(f.black)}</strong></div>
        <div className="hub-row-foot small"><span className="muted">{eventName(f.event)} · scheduled game · move {lg?.moves.length ?? 0} · no market</span><span className="spacer" />
          <button className="btn small" onClick={() => go({ name: 'watch', id: f.id })}>Watch</button></div>
      </li>
    );
  };

  return (
    <div className="arena-hub" data-testid="arena-hub">
      <header className="page-head">
        <div className="kicker">Federation · AI vs AI</div>
        <h1>AI vs AI Match Arena</h1>
        <p className="muted">Watch Federation competitors play each other: official matches live with their markets, replays of every recorded game, or a custom exhibition between any two competitors you choose.</p>
      </header>

      <section className="panel stack hub-hero" data-testid="hub-exhibition" aria-labelledby="hub-h-exh">
        <div className="panel-title"><h2 id="hub-h-exh" className="h3" style={{ margin: 0 }}>Custom Exhibition</h2><span className="chip gold">Unofficial</span></div>
        <p className="small" style={{ margin: 0 }}>Pick any two competitors, choose colours and a display clock (up to 240+120), and watch at your speed: pause, restart, skip to the result. Optionally trade a practice market with sandbox money. Exhibitions never change ratings, standings, records or official markets.</p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn primary" data-testid="hub-start-exhibition" onClick={() => go({ name: 'exhibition' })}>Start Custom Exhibition</button>
          {unfinished && <button className="btn" data-testid="hub-continue" onClick={() => go({ name: 'exhibition', id: unfinished.id })}>Continue: {unfinished.white.name} vs {unfinished.black.name} ({unfinished.moves.length} plies)</button>}
        </div>
      </section>

      <div className="hub-grid">
        <section className="panel stack" data-testid="hub-live" aria-labelledby="hub-h-live">
          <div className="panel-title"><h2 id="hub-h-live" className="h3" style={{ margin: 0 }}>Watch Live Official Matches</h2><span className="chip">{liveOfficial.length + liveSlate.length} live</span></div>
          {liveOfficial.length + liveSlate.length === 0
            ? <p className="small muted" style={{ margin: 0 }}>No official match is being played right now. Open a featured match below and choose Watch Live and Trade to play it move by move with its market open between moves; scheduled games start on their own while the app is open.</p>
            : <ul className="hub-list">{liveOfficial.map(matchRow)}{liveSlate.map(slateRow)}</ul>}
          <p className="small muted" style={{ margin: 0 }}>Official matches follow the Federation’s rules: they cannot be paused, restarted or replayed differently, and you see only what every trader sees (published moves and the engine’s own evaluation).</p>
        </section>

        <section className="panel stack" data-testid="hub-upcoming" aria-labelledby="hub-h-up">
          <div className="panel-title"><h2 id="hub-h-up" className="h3" style={{ margin: 0 }}>Upcoming Federation Matches</h2><span className="small muted">Season {st.world.season} · Round {st.world.round}</span></div>
          {upcoming.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No featured match is waiting to start this round.</p> : <ul className="hub-list">{upcoming.slice(0, 8).map(matchRow)}</ul>}
          {upcoming.length > 8 && <p className="small muted" style={{ margin: 0 }}>Showing 8 of {upcoming.length}.</p>}
          <button className="btn small ghost" onClick={() => go({ name: 'world' })}>All Fixtures</button>
        </section>

        <section className="panel stack" data-testid="hub-replays" aria-labelledby="hub-h-rep">
          <div className="panel-title"><h2 id="hub-h-rep" className="h3" style={{ margin: 0 }}>Completed Match Replays</h2><button className="btn small ghost" data-testid="hub-replay-library" onClick={() => go({ name: 'replays' })}>Replay Library</button></div>
          {replays === null ? <p className="small muted" role="status">Loading…</p> : replays.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No recorded AI game yet. Finished featured matches and exhibitions appear here.</p> : (
            <ul className="hub-list">
              {replays.map(r => (
                <li key={r.id} className="hub-row" data-testid="hub-replay" data-kind={r.kind} data-id={r.id}>
                  <button className="btn ghost hub-replay-open" onClick={r.open}>
                    <span><strong>{r.white}</strong> – <strong>{r.black}</strong> <span className="chip mono">{r.result}</span> {r.kind === 'exhibition' ? <span className="chip gold">Exhibition</span> : <span className="chip info">Official</span>}</span>
                    <span className="small muted">{r.detail} · {r.at.slice(0, 10)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel stack" data-testid="hub-search" aria-labelledby="hub-h-search">
          <div className="panel-title"><h2 id="hub-h-search" className="h3" style={{ margin: 0 }}>Search AI Competitors</h2><button className="btn small ghost" onClick={() => go({ name: 'competitors' })}>Discover All</button></div>
          <input type="search" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search AI competitors" data-testid="hub-search-input" />
          <ul className="hub-list">
            {found.map(c => (
              <li key={c.id} className="hub-row" data-testid="hub-search-row" data-id={c.id}>
                <div className="hub-row-main">
                  <button className="btn ghost small arena-player-name" onClick={() => go({ name: 'competitor', id: c.id })}><strong>{c.name}</strong></button>
                  <span className="mono">{fmtCareerElo(c.rating)}</span><TitleBadge title={c.fedTitle} abbr plain />
                </div>
                <div className="hub-row-foot small"><span className="muted">{divisionLabel(c.division)} · {STYLE_LABEL[isValidatedStyle(c.style) ? c.style : 'universal']}</span><span className="spacer" />
                  <button className="btn small" data-testid="hub-pick-white" onClick={() => { requestExhibitionPick('white', c.id); go({ name: 'exhibition' }); }}>As White</button>
                  <button className="btn small" data-testid="hub-pick-black" onClick={() => { requestExhibitionPick('black', c.id); go({ name: 'exhibition' }); }}>As Black</button>
                </div>
              </li>
            ))}
          </ul>
          {found.length === 0 && <p className="small muted" style={{ margin: 0 }}>No competitor matches.</p>}
        </section>
      </div>
    </div>
  );
}
