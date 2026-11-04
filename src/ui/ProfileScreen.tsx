import { useEffect, useState } from 'react';
import { useApp, useServices } from './App';
import { RatingChart } from './Charts';
import type { PoolId, GameRecord } from '../games/types';
import type { PoolState, RatingEvent } from '../ratings/ledger';
import { explainEvent, newPoolState, RANKS, RANK_POLICY } from '../ratings/ledger';
import { isProvisional } from '../ratings/glicko2';
import { personalRecords } from '../academy/lab';
import type { AnalysisReport } from '../analysis/types';
import type { Attempt, TrainingRun } from '../academy/academy';
import { resultText } from './PlayScreen';
import { PrestigeLadders } from './FinanceScreen';
import { Emblem } from './Emblem';
import { titleEmblem } from '../heraldry/catalog';
import { divisionLabel, REGION_NAMES } from '../federation/model';
import { CareerStanding } from './CareerStanding';
import { PlayerAvatar, PassportBanner } from './Cosmetics';
import { RATING_TITLES, collectedTitles, insigniaSpec, titleFor } from '../ratings/titles';
import { PLAYED_LIKE_VALIDATED, playedLike, type PlayedLike } from '../analysis/playedLike';
import { fmtPlayedLike } from './PlayedLikeCard';
import { Trophy } from './Emblem';
import { TROPHY_FOR } from '../heraldry/catalog';
import { titleKind } from './HallScreen';

const POOLS: PoolId[] = ['rapid', 'blitz', 'classical'];

export function ProfileScreen() {
  const services = useServices();
  const { go } = useApp();
  const [pool, setPool] = useState<PoolId>('rapid');
  const [states, setStates] = useState<Record<string, PoolState>>({});
  const [events, setEvents] = useState<RatingEvent[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [window_, setWindow] = useState<'10' | '30' | '100' | 'all'>('all');
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [fOpp, setFOpp] = useState('all');
  const [fTc, setFTc] = useState('all');
  const [fRes, setFRes] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  useEffect(() => {
    void (async () => {
      const st = await services.db.allRatingStates();
      setStates(Object.fromEntries(st.map(s => [s.pool, s])));
      setEvents(await services.db.ratingEvents());
      setGames(await services.db.allGames());
      setReports(await services.db.allReports());
      setAttempts(await services.db.getAll<Attempt>('attempts'));
      setRuns(await services.db.getAll<TrainingRun>('trainingRuns'));
    })();
  }, [services, services.revision]);

  const s = states[pool] ?? newPoolState(pool);
  const ev = events.filter(e => e.pool === pool).sort((a, b) => a.sequence - b.sequence);
  const win = window_ === 'all' ? ev : ev.slice(-+window_);
  const points = [
    ...(win.length && win[0].sequence === 1 ? [{ at: win[0].at, rating: win[0].before.rating, rd: win[0].before.rd, label: 'Initial rating' }] : []),
    ...win.map(e => ({ at: e.at, rating: e.after.rating, rd: e.after.rd, label: `#${e.sequence} ${e.score === 1 ? 'W' : e.score === 0 ? 'L' : 'D'} vs ${e.opponent.name}: ${Math.round(e.after.rating)}` })),
  ];
  const rankChanges = ev.filter(e => e.rankBefore !== e.rankAfter);
  const finished = games.filter(g => g.status === 'finalized');
  const byTc = ['blitz', 'rapid', 'classical', 'untimed'].map(tc => {
    const gs = finished.filter(g => g.timeControl.id === tc);
    const w = gs.filter(g => g.result && g.result !== '1/2-1/2' && (g.result === '1-0') === (g.humanColor === 'white')).length;
    const d = gs.filter(g => g.result === '1/2-1/2').length;
    return { tc, n: gs.length, w, d, l: gs.length - w - d };
  });
  const bands = [[0, 1200], [1200, 1400], [1400, 1600], [1600, 1800], [1800, 9999]].map(([lo, hi]) => {
    const es = ev.filter(e => e.opponent.rating >= lo && e.opponent.rating < hi);
    const score = es.reduce((a, e) => a + e.score, 0);
    const exp = es.reduce((a, e) => a + e.expected, 0);
    return { label: hi > 5000 ? `${lo}+` : `${lo}–${hi - 1}`, n: es.length, score, exp };
  });
  const prov = isProvisional(s.games, s.rd);

  return (
    <div>
      <PassportBanner />
      <div className="row" style={{ gap: 12, marginBottom: 8 }}><PlayerAvatar size={56} /><h1 style={{ margin: 0 }}>Career Passport</h1></div>
      <div className="seg" role="group" aria-label="Rating Pool" style={{ marginBottom: 12 }}>
        {POOLS.map(p => <button key={p} aria-pressed={pool === p} onClick={() => setPool(p)}>{p[0].toUpperCase() + p.slice(1)} ({states[p]?.games ?? 0})</button>)}
      </div>
      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="panel stat"><span className="k">Rating ({pool[0].toUpperCase() + pool.slice(1)})</span><span className="v" data-testid="current-rating">{Math.round(s.rating)}</span><span className="small muted">±{Math.round(s.rd)} · {prov ? 'Provisional' : 'Established'}</span></div>
        <div className="panel stat" data-testid="passport-rating-title"><span className="k">Rating Title</span><span className="v row" style={{ fontSize: '1.15rem', gap: 8 }}><Emblem spec={insigniaSpec(titleFor(s.rating))} size="md" title={`${titleFor(s.rating).name} insignia`} />{titleFor(s.rating).name}</span><span className="small muted">{prov ? 'Provisional rating · ' : ''}Changes with your rating; one title every 100 points. Federation titles are earned separately and kept for good.</span></div>
        <div className="panel stat"><span className="k">Record</span><span className="v">{s.wins}–{s.draws}–{s.losses}</span><span className="small muted">W–D–L in {s.games} rated games</span></div>
        <div className="panel stat"><span className="k">Peak / Lowest</span><span className="v" style={{ fontSize: '1.3rem' }}>{s.peak === null ? 'Not yet' : `${Math.round(s.peak)} / ${Math.round(s.lowest ?? s.peak)}`}</span><span className="small muted">{s.peak === null ? `Counts once your rating is established (20 rated games, ±100); ${Math.max(0, 20 - s.games)} games to go` : 'Established ratings only'}</span></div>
      </div>
      <div className="panel">
        <div className="panel-title"><h2>Rating History</h2>
          <div className="seg" role="group" aria-label="Window">{(['10', '30', '100', 'all'] as const).map(w => <button key={w} aria-pressed={window_ === w} onClick={() => setWindow(w)}>{w === 'all' ? 'All' : `Last ${w}`}</button>)}</div>
        </div>
        <RatingChart points={points} />
        <p className="small muted">Game ratings, not FIDE ratings. Your rating is provisional until you have played 20 rated games and it has settled to ±100 or less.</p>
        <details className="small muted"><summary>Details</summary>Glicko-2: start 1500 ±350, τ = 0.5, one rated game per rating period. Current volatility σ {s.sigma.toFixed(4)}. Rank policy {RANK_POLICY}.</details>
      </div>
      <InsigniaCollection events={events.filter(e => e.pool === 'rapid')} />
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3>By Time Control</h3>
          <table><thead><tr><th>Time Control</th><th>Games</th><th>W</th><th>D</th><th>L</th></tr></thead>
            <tbody>{byTc.map(r => <tr key={r.tc}><td>{r.tc[0].toUpperCase() + r.tc.slice(1)}</td><td>{r.n}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td></tr>)}</tbody></table>
        </div>
        <div className="panel">
          <h3>By Opponent Strength</h3>
          <table><thead><tr><th>Opponent Rating</th><th>Games</th><th>Score</th><th>Expected</th></tr></thead>
            <tbody>{bands.map(b => <tr key={b.label}><td>{b.label}</td><td>{b.n}</td><td>{b.n ? b.score : '—'}</td><td>{b.n ? b.exp.toFixed(1) : '—'}</td></tr>)}</tbody></table>
          <p className="small muted">Rated {pool} games. Expected is the score your rating predicted before each game.</p>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Rated Games ({ev.length})</h3>
        {ev.length === 0 ? <p className="muted">No rated games in this pool yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>#</th><th>Date</th><th>Opponent</th><th>Score</th><th>Expected</th><th>Before</th><th>After</th><th>Δ</th><th className="hide-sm">Rank</th></tr></thead>
              <tbody>
                {[...ev].reverse().map(e => (
                  <tr key={e.id} className="clickable" title={explainEvent(e)} onClick={() => go({ name: 'analysis', gameId: e.gameId })} data-testid="rating-event">
                    <td>{e.sequence}</td><td>{new Date(e.at).toLocaleDateString()}</td><td>{e.opponent.name} ({Math.round(e.opponent.rating)})</td>
                    <td>{e.score}</td><td>{(e.expected * 100).toFixed(0)}%</td>
                    <td>{Math.round(e.before.rating)} ±{Math.round(e.before.rd)}</td><td>{Math.round(e.after.rating)} ±{Math.round(e.after.rd)}</td>
                    <td style={{ color: e.delta >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{e.delta >= 0 ? '+' : ''}{e.delta.toFixed(1)}</td>
                    <td className="hide-sm small">{e.rankBefore === e.rankAfter ? e.rankAfter : `${e.rankBefore} → ${e.rankAfter}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Rank History</h3>
        {rankChanges.length === 0 ? <p className="muted small">No rank changes yet. Ranks: Provisional → {RANKS.map(r => `${r.name} (${r.min}+)`).join(' → ')}.</p>
          : <ul>{rankChanges.map(e => <li key={e.id}>{new Date(e.at).toLocaleDateString()}: {e.rankBefore} → <strong>{e.rankAfter}</strong> (rating {Math.round(e.after.rating)})</li>)}</ul>}
      </div>
      <CareerStanding rating={s.rating} rd={s.rd} games={s.games} peak={s.peak} />
      <FederationCareer peak={s.peak} />
      <Passport games={games} events={events} reports={reports} attempts={attempts} runs={runs} filters={{ fOpp, setFOpp, fTc, setFTc, fRes, setFRes, fFrom, setFFrom, fTo, setFTo }} />
    </div>
  );
}

type F = { fOpp: string; setFOpp: (v: string) => void; fTc: string; setFTc: (v: string) => void; fRes: string; setFRes: (v: string) => void; fFrom: string; setFFrom: (v: string) => void; fTo: string; setFTo: (v: string) => void };

function Passport({ games, events, reports, attempts, runs, filters }: { games: GameRecord[]; events: RatingEvent[]; reports: AnalysisReport[]; attempts: Attempt[]; runs: TrainingRun[]; filters: F }) {
  const { go } = useApp();
  const rec = personalRecords({ games, reports, attempts, puzzles: [], runs, events });
  const finished = games.filter(g => g.status === 'finalized' && g.mode !== 'training').sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const oppName = (g: GameRecord) => (g.humanColor === 'white' ? g.black.name : g.white.name);
  // timeline: first game, first win, rank changes, established peak, puzzle milestones (all from stored records)
  const timeline: { at: string; text: string; gameId?: string }[] = [];
  if (finished[0]) timeline.push({ at: finished[0].startedAt, text: `First game, against ${oppName(finished[0])}`, gameId: finished[0].id });
  const firstWin = finished.find(g => resultText(g) === 'Victory');
  if (firstWin) timeline.push({ at: firstWin.startedAt, text: `First win, against ${oppName(firstWin)}`, gameId: firstWin.id });
  for (const e of events) if (e.rankBefore !== e.rankAfter) timeline.push({ at: e.at, text: `${e.pool}: ${e.rankBefore} → ${e.rankAfter} (${Math.round(e.after.rating)})`, gameId: e.gameId });
  const clean = attempts.filter(a => a.clean && a.exposure === 0).sort((a, b) => a.at.localeCompare(b.at));
  for (const m of [1, 10, 50, 100, 250]) if (clean.length >= m) timeline.push({ at: clean[m - 1].at, text: `${m} puzzle${m === 1 ? '' : 's'} solved cleanly` });
  timeline.sort((a, b) => b.at.localeCompare(a.at));
  // opponent history
  const opp = new Map<string, { w: number; d: number; l: number; last: string }>();
  for (const g of finished) {
    const k = oppName(g); const o = opp.get(k) ?? { w: 0, d: 0, l: 0, last: '' };
    const r = resultText(g); if (r === 'Victory') o.w++; else if (r === 'Draw') o.d++; else o.l++;
    o.last = g.startedAt; opp.set(k, o);
  }
  const greatest = finished.filter(g => resultText(g) === 'Victory').map(g => ({ g, r: (g.humanColor === 'white' ? g.black : g.white).rating ?? 0 })).sort((a, b) => b.r - a.r).slice(0, 5);
  const list = finished.filter(g =>
    (filters.fOpp === 'all' || oppName(g) === filters.fOpp) && (filters.fTc === 'all' || g.timeControl.id === filters.fTc) &&
    (filters.fRes === 'all' || resultText(g).toLowerCase() === filters.fRes) && (!filters.fFrom || g.startedAt >= filters.fFrom) && (!filters.fTo || g.startedAt.slice(0, 10) <= filters.fTo)).reverse();
  const evBy = new Map(events.map(e => [e.gameId, e]));
  const exportCsv = () => {
    const rows = [['date', 'game_id', 'opponent', 'colour', 'result', 'termination', 'time_control', 'rated', 'moves', 'rating_before', 'rating_after', 'opening']];
    for (const g of list) { const e = evBy.get(g.id); rows.push([g.startedAt, g.id, oppName(g), g.humanColor, g.result ?? '', g.termination ?? '', g.timeControl.id, String(g.rated), String(g.moves.length), e ? e.before.rating.toFixed(1) : '', e ? e.after.rating.toFixed(1) : '', g.opening?.name ?? '']); }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'crown-game-history.csv'; a.click();
  };
  return (
    <>
      <div className="grid-3" style={{ marginTop: 14 }}>
        <div className="panel stat"><span className="k">Best Accuracy</span><span className="v" style={{ fontSize: '1.3rem' }}>{rec.bestAccuracy ? rec.bestAccuracy.value.toFixed(1) : '—'}</span>{rec.bestAccuracy && <button className="btn ghost small" onClick={() => go({ name: 'analysis', gameId: rec.bestAccuracy!.gameId })}>Open Game</button>}</div>
        <div className="panel stat"><span className="k">Strongest Win</span><span className="v" style={{ fontSize: '1.3rem' }}>{rec.strongestWin ? `${rec.strongestWin.opponent} (${Math.round(rec.strongestWin.rating)})` : '—'}</span></div>
        <div className="panel stat"><span className="k">Longest Win Streak</span><span className="v">{rec.longestWinStreak}</span></div>
        <div className="panel stat"><span className="k">Peak Rating</span><span className="v" style={{ fontSize: '1.3rem' }}>{rec.peakRating ? `${Math.round(rec.peakRating.rating)} (${rec.peakRating.pool})` : '—'}</span><span className="small muted">Established ratings only</span></div>
        <div className="panel stat"><span className="k">Puzzle Rush Best</span><span className="v">{rec.bestRush ?? '—'}</span></div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3>Career Timeline</h3>
          {timeline.length === 0 ? <p className="muted small">Your milestones appear here as you play and train.</p> : (
            <ul className="small" style={{ paddingLeft: 18 }}>{timeline.slice(0, 20).map((t, i) => <li key={i}>{new Date(t.at).toLocaleDateString()} — {t.gameId ? <button className="btn ghost small" onClick={() => go({ name: 'analysis', gameId: t.gameId! })}>{t.text}</button> : t.text}</li>)}</ul>
          )}
        </div>
        <div className="panel">
          <h3>Memorable Moves &amp; Greatest Wins</h3>
          {rec.memorable.length === 0 && greatest.length === 0 ? <p className="muted small">Your Great and Brilliant moves and your best wins appear here once you play and analyse games.</p> : null}
          {rec.memorable.slice(0, 6).map(m => <div key={`${m.gameId}-${m.ply}`} className="small"><button className="btn ghost small" onClick={() => go({ name: 'analysis', gameId: m.gameId, ply: m.ply })}>{m.grade === 'brilliant' ? '!!' : '!'} {m.san} (move {Math.ceil(m.ply / 2)})</button></div>)}
          {greatest.map(({ g, r }) => <div key={g.id} className="small"><button className="btn ghost small" onClick={() => go({ name: 'analysis', gameId: g.id })}>Win vs {oppName(g)} ({Math.round(r)}) · {new Date(g.startedAt).toLocaleDateString()}</button></div>)}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Opponent History</h3>
        {opp.size === 0 ? <p className="muted small">No finished games yet.</p> : (
          <table><thead><tr><th>Opponent</th><th>W</th><th>D</th><th>L</th><th>Last Played</th></tr></thead>
            <tbody>{[...opp.entries()].map(([k, o]) => <tr key={k}><td>{k}</td><td>{o.w}</td><td>{o.d}</td><td>{o.l}</td><td>{new Date(o.last).toLocaleDateString()}</td></tr>)}</tbody></table>
        )}
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title"><h3 style={{ margin: 0 }}>Game History ({list.length})</h3><button className="btn small" onClick={exportCsv}>Export CSV</button></div>
        <div className="row" style={{ marginBottom: 8 }}>
          <select value={filters.fOpp} onChange={e => filters.setFOpp(e.target.value)} aria-label="Opponent"><option value="all">All Opponents</option>{[...opp.keys()].map(k => <option key={k}>{k}</option>)}</select>
          <select value={filters.fTc} onChange={e => filters.setFTc(e.target.value)} aria-label="Time Control"><option value="all">All Time Controls</option><option value="blitz">Blitz</option><option value="rapid">Rapid</option><option value="classical">Classical</option><option value="untimed">Untimed</option></select>
          <select value={filters.fRes} onChange={e => filters.setFRes(e.target.value)} aria-label="Result"><option value="all">All Results</option><option value="victory">Wins</option><option value="draw">Draws</option><option value="defeat">Losses</option></select>
          <input type="date" value={filters.fFrom} onChange={e => filters.setFFrom(e.target.value)} aria-label="From Date" />
          <input type="date" value={filters.fTo} onChange={e => filters.setFTo(e.target.value)} aria-label="To Date" />
        </div>
        <table><thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th className="hide-sm">Time Control</th><th>Rating</th></tr></thead>
          <tbody>{list.slice(0, 50).map(g => { const e = evBy.get(g.id); return (
            <tr key={g.id} className="clickable" onClick={() => go({ name: 'analysis', gameId: g.id })}><td>{new Date(g.startedAt).toLocaleDateString()}</td><td>{oppName(g)}</td><td>{resultText(g)}</td><td className="hide-sm">{g.timeControl.label}</td><td>{e ? `${Math.round(e.after.rating)} (${e.delta >= 0 ? '+' : ''}${e.delta.toFixed(1)})` : 'Unrated'}</td></tr>); })}</tbody></table>
        {list.length > 50 && <p className="small muted">Showing 50 of {list.length}. Open the Library to see them all.</p>}
      </div>
      <PlayedLikeHistory games={finished} reports={reports} />
    </>
  );
}

/** Passport: recent "Played Like" estimates (experimental; never replaces the Glicko-2 rating). */
function PlayedLikeHistory({ games, reports }: { games: GameRecord[]; reports: AnalysisReport[] }) {
  const { go } = useApp();
  const latest = new Map<string, AnalysisReport>();
  for (const r of reports) if (r.status === 'complete') { const c = latest.get(r.gameId); if (!c || r.completedAt > c.completedAt) latest.set(r.gameId, r); }
  const rows = games.map(g => ({ g, pl: playedLike(latest.get(g.id), g.humanColor) })).filter(x => x.pl.status !== 'pending').reverse();
  const ok = rows.filter(x => x.pl.status === 'ok') as { g: GameRecord; pl: Extract<PlayedLike, { status: 'ok' }> }[];
  const recent = ok.slice(0, 10);
  const avg = recent.length >= 5 ? Math.round(recent.reduce((a, x) => a + x.pl.rating, 0) / recent.length / 10) * 10 : null;
  const best = ok.reduce<typeof ok[number] | null>((b, x) => (!b || x.pl.rating > b.pl.rating ? x : b), null);
  return (
    <div className="panel" style={{ marginTop: 14 }} data-testid="passport-played-like">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Played Like</h3><span className="chip gold">Estimate · Experimental</span></div>
      {!PLAYED_LIKE_VALIDATED ? <p className="small muted">The Played Like model is still being calibrated; estimates appear here once it passes validation.</p>
        : !rows.length ? <p className="small muted">Estimates appear after your finished games are analysed.</p> : (<>
        <div className="grid-3">
          <div className="stat"><span className="k">Average (last {recent.length})</span><span className="v mono">{avg ?? '—'}</span><span className="small muted">{avg === null ? 'Needs 5 estimated games' : 'Not your rating; your rating comes from results'}</span></div>
          <div className="stat"><span className="k">Best Supported</span><span className="v mono">{best ? best.pl.rating : '—'}</span>{best && <button className="btn ghost small" onClick={() => go({ name: 'analysis', gameId: best.g.id })}>Open Game</button>}</div>
          <div className="stat"><span className="k">Estimated Games</span><span className="v mono">{ok.length}</span><span className="small muted">{rows.length - ok.length} without a number (too short or out of range)</span></div>
        </div>
        <table className="table small"><thead><tr><th>Date</th><th>Opponent</th><th>Played Like</th><th>Range</th></tr></thead>
          <tbody>{rows.slice(0, 10).map(x => (
            <tr key={x.g.id} className="clickable" onClick={() => go({ name: 'analysis', gameId: x.g.id })}>
              <td>{new Date(x.g.startedAt).toLocaleDateString()}</td><td>{x.g.humanColor === 'white' ? x.g.black.name : x.g.white.name}</td>
              <td className="mono">{fmtPlayedLike(x.pl)}</td><td className="mono small">{x.pl.status === 'ok' ? `${x.pl.low}–${x.pl.high}` : '—'}</td></tr>))}</tbody></table>
      </>)}
    </div>
  );
}

function FederationCareer({ peak }: { peak: number | null }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  if (!fed.ready) return <div className="panel" style={{ marginTop: 14 }}><h3>Federation Career</h3><p className="small muted">You haven't joined the federation yet. <button className="btn ghost small" onClick={() => go({ name: 'world' })}>Go to Federation</button></p></div>;
  const w = fed.state!.world;
  const cabinet = fed.ownsAsset('trophy-cabinet');
  return (
    <div style={{ marginTop: 14 }} className="stack" data-testid="federation-career">
      <div className="panel">
        <div className="panel-title"><h3 style={{ margin: 0 }}>Federation Career</h3>{w.player.fedTitle ? <span className="row" style={{ gap: 6 }}><Emblem spec={titleEmblem(w.player.fedTitle)} size="md" title={`Federation title ${w.player.fedTitle}`} /><strong>{w.player.fedTitle}</strong></span> : <span className="small muted">No Federation Title yet</span>}</div>
        <div className="small">Season {w.season} · {divisionLabel(w.player.division)}, {REGION_NAMES[w.player.region]}</div>
        {w.player.history.length > 0 && <table className="small"><thead><tr><th>Season</th><th>Division</th><th>Place</th><th>Points</th></tr></thead><tbody>{w.player.history.map(h => <tr key={h.season}><td>{h.season}</td><td>{h.division}</td><td>{h.rank}</td><td>{h.points}</td></tr>)}</tbody></table>}
        <h3>{cabinet ? 'Walnut Trophy Cabinet' : 'Titles'}</h3>
        {w.player.titles.length === 0 ? <p className="small muted">No titles yet. Win your league, a Swiss event or the Crown Championship to earn one. Titles can't be bought.</p>
          : <div className="row" style={{ flexWrap: 'wrap' }}>{w.player.titles.map((t, i) => <span key={i} className={`chip ${cabinet ? 'gold' : ''}`}>{cabinet && <Trophy kind={TROPHY_FOR[titleKind(t.title)]} size="sm" title={t.title} />} {t.title}</span>)}</div>}
      </div>
      <PrestigeLadders bestRating={peak} />
    </div>
  );
}

/** Passport: rating-title insignias held while the (Rapid, Federation) rating was established. Kept after a fall. */
function InsigniaCollection({ events }: { events: RatingEvent[] }) {
  const { collected, peak, peakRating } = collectedTitles(events.map(e => ({ after: e.after, games: e.gamesBefore + 1, at: e.at })), isProvisional);
  const have = new Set(collected.map(t => t.index));
  return (
    <div className="panel" style={{ marginTop: 14 }} data-testid="insignia-collection">
      <div className="panel-title"><h2 style={{ margin: 0 }}>Insignia Collection</h2><span className="small muted">{collected.length} of {RATING_TITLES.length} · Peak title: {peak ? `${peak.name} (${Math.round(peakRating!)})` : 'none yet'}</span></div>
      <p className="small muted" style={{ marginTop: 0 }}>Each 100-point rating title has an insignia. You keep every insignia your established Rapid rating has reached, even if it falls later. Provisional ratings do not count.</p>
      <div className="insignia-grid">
        {RATING_TITLES.map(t => (
          <div key={t.index} className={`insignia-cell${have.has(t.index) ? ' have' : ''}`} title={`${t.name} · ${t.min}${t.max === null ? '+' : `–${t.max}`}${have.has(t.index) ? '' : ' · not yet collected'}`}>
            <Emblem spec={insigniaSpec(t)} size="md" title={`${t.name} insignia${have.has(t.index) ? '' : ' (locked)'}`} />
            <span className="small">{t.name}</span><span className="small muted mono">{t.min}{t.max === null ? '+' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
