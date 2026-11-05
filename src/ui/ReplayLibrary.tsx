/**
 * Replay Library (#/replays): every recorded game in one list — the player's finished games and the federation's
 * recorded games — with filters for championship finals, rivalries, upsets, dramatic evaluation swings, memorable
 * market moves and favourites (bookmark records, backed up with the career). Opening a row goes to the Replay &
 * Analysis Center for that game: Game Review for the player's games, the Arena replay for federation games.
 */
import { fmtCareerElo } from '../ratings/display';
import { useEffect, useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { eventName } from '../app/federation';
import { PLAYER_ID } from '../federation/model';
import { featuredRivalries, rivalriesOf } from '../app/rivalries';
import type { AnalysisReport } from '../analysis/types';
import {
  DRAMATIC_SWING, MARKET_MOVE, REPLAY_FILTERS, UPSET_GAP, exhibitionEntry, favouriteId, federationEntry, filterReplays, personalEntry,
  type ReplayBookmark, type ReplayEntry, type ReplayFilter,
} from '../app/replay';
import { listExhibitions } from '../app/exhibition';

const PAGE = 30;

export function ReplayLibrary() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [rows, setRows] = useState<ReplayEntry[] | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ReplayFilter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [games, reports, bms] = await Promise.all([services.db.allGames(), services.db.allReports(), services.db.getAll<ReplayBookmark>('bookmarks')]);
        const latest = new Map<string, AnalysisReport>();
        for (const r of reports) { const c = latest.get(r.gameId); if (r.status === 'complete' && (!c || r.completedAt > c.completedAt)) latest.set(r.gameId, r); }
        const st = fed.state;
        const finished = games.filter(g => g.status === 'finalized');
        const rivals = new Set<string>();
        const pairs = new Set<string>();
        if (st) {
          for (const r of rivalriesOf(st, PLAYER_ID, finished)) if (r.intensity >= 10) rivals.add(r.b);
          for (const r of featuredRivalries(st)) if (r.intensity >= 10) pairs.add(r.a < r.b ? `${r.a}|${r.b}` : `${r.b}|${r.a}`);
        }
        const out: ReplayEntry[] = finished.map(g => personalEntry(g, latest.get(g.id) ?? null, rivals));
        if (st) {
          const wgs = await fed.worldGames();
          for (const wg of wgs) out.push(federationEntry(wg, st.liveGames.get(wg.fixtureId)?.points ?? null, pairs, rivals, eventName));
        }
        // v0.11: unofficial Exhibition Arena games (their own archive, src/app/exhibition.ts)
        for (const g of await listExhibitions(services.db)) out.push(exhibitionEntry(g));
        if (!alive) return;
        setRows(out);
        setFavs(new Set(bms.filter(b => b.kind === 'favourite').map(b => b.gameId)));
      } catch (e) { if (alive) setError(String((e as Error)?.message ?? e)); }
    })();
    return () => { alive = false; };
  }, [services, services.revision]);

  const view = useMemo(() => (rows ? filterReplays(rows, filter, favs, q) : []), [rows, filter, favs, q]);
  useEffect(() => setPage(0), [filter, q]);
  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  const shown = view.slice(page * PAGE, page * PAGE + PAGE);
  const toggleFav = async (id: string) => {
    if (favs.has(id)) await services.db.remove('bookmarks', favouriteId(id));
    else await services.db.put('bookmarks', { id: favouriteId(id), gameId: id, ply: -1, memorable: false, note: '', at: new Date().toISOString(), kind: 'favourite' } satisfies ReplayBookmark);
    const n = new Set(favs); if (n.has(id)) n.delete(id); else n.add(id);
    setFavs(n);
  };
  const open = (r: ReplayEntry) => go(r.kind === 'personal' ? { name: 'analysis', gameId: r.id } : r.kind === 'exhibition' ? { name: 'exhibition', id: r.id } : { name: 'watch', id: r.id.replace(/^wg:/, '') });
  const count = (f: ReplayFilter) => (rows ? filterReplays(rows, f, favs).length : 0);

  return (
    <div data-testid="replay-library">
      <header className="page-head">
        <div className="kicker">Replay &amp; Analysis Center</div>
        <h1>Replay Library</h1>
        <p className="muted">Every recorded game on this device: yours and the Federation's. Open one to replay it move by move with the evaluation bar, the graph and, for games traded in play, the prices that were recorded.</p>
        <button className="btn small" data-testid="open-exhibition-arena" onClick={() => go({ name: 'exhibition' })}>Exhibition Arena: pick any two competitors</button>
      </header>
      {error && <div className="notice warn" role="alert">The library could not be loaded: {error}</div>}
      <div className="panel stack">
        <div className="seg replay-filters" role="group" aria-label="Replay filter">
          {REPLAY_FILTERS.map(f => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} data-testid={`replay-filter-${f.id}`}>{f.label} <span className="muted small">{count(f.id)}</span></button>)}
        </div>
        <input type="search" placeholder="Search players or events" value={q} onChange={e => setQ(e.target.value)} aria-label="Search replays" />
        <details className="small muted"><summary>How the filters work</summary>
          Upsets: the lower-rated side won with a rating gap of at least {UPSET_GAP} at game time. Dramatic swings: White's expected score changed by at least {Math.round(DRAMATIC_SWING * 100)} points between two moves (published engine evaluations for Federation games, your analysis for your games). Market moments: a recorded price moved by at least ${MARKET_MOVE.toFixed(2)} between two published moves. Rivalries: a rivalry of level Rival or above. Championship finals: Crown Championship and Club Weekend finals.
        </details>
        {rows === null && !error && <p className="muted" role="status">Loading replays…</p>}
        {rows && view.length === 0 && <p className="muted" data-testid="replay-empty">{rows.length ? 'No replays match this filter.' : <>No recorded games yet. Finish a game, or watch a Federation match, and it appears here. <button className="btn small" onClick={() => go({ name: 'play' })}>Play a Game</button> <button className="btn small ghost" onClick={() => go({ name: 'world' })}>Federation</button></>}</p>}
        {shown.length > 0 && (
          <ul className="replay-list">
            {shown.map(r => (
              <li key={r.id} className="replay-row" data-testid="replay-row" data-kind={r.kind} data-id={r.id}>
                <button className="replay-open" onClick={() => open(r)}>
                  <span className="replay-players"><strong>{r.white}</strong>{r.whiteRating !== null ? <span className="mono muted"> {fmtCareerElo(r.whiteRating)}</span> : null} – <strong>{r.black}</strong>{r.blackRating !== null ? <span className="mono muted"> {fmtCareerElo(r.blackRating)}</span> : null}</span>
                  <span className="replay-meta small muted">{r.event}{r.stage ? ` · ${r.stage}` : ''}{r.season ? ` · S${r.season} R${r.round}` : ''} · {Math.ceil(r.plies / 2)} moves · {r.at.slice(0, 10)}</span>
                  <span className="replay-tags">
                    <span className="chip mono">{r.result}</span>
                    {r.kind === 'personal' ? <span className="chip">My game</span> : r.kind === 'exhibition' ? <span className="chip gold">Exhibition · unofficial</span> : <span className="chip info">Federation</span>}
                    {r.championshipFinal && <span className="chip gold">Final</span>}
                    {r.rivalry && <span className="chip">Rivalry</span>}
                    {r.upsetGap >= UPSET_GAP && <span className="chip neg">Upset +{Math.round(r.upsetGap)}</span>}
                    {(r.swing ?? 0) >= DRAMATIC_SWING && <span className="chip">Swing {Math.round(r.swing! * 100)}</span>}
                    {(r.priceMove ?? 0) >= MARKET_MOVE && <span className="chip pos">Price move ${r.priceMove!.toFixed(3)}</span>}
                    {r.hasMarket && <span className="chip">Recorded market</span>}
                  </span>
                </button>
                <button className="btn small ghost replay-fav" aria-pressed={favs.has(r.id)} aria-label={favs.has(r.id) ? `Remove ${r.white} – ${r.black} from favourites` : `Add ${r.white} – ${r.black} to favourites`}
                  data-testid="replay-fav" disabled={services.readOnly} onClick={() => void toggleFav(r.id)}>{favs.has(r.id) ? '★' : '☆'}</button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="small">Page {page + 1} of {pages} · {view.length} replays</span>
            <button className="btn small" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
