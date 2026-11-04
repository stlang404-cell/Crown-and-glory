import { useEffect, useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { Emblem } from './Emblem';
import { Portrait } from './Portrait';
import { Icon } from './Icons';
import { QUICK_POOLS, eligiblePool, pickOpponent, type QuickPool } from '../federation/quickMatch';
import { REGION_NAMES, divisionLabel } from '../federation/model';
import type { Competitor } from '../federation/model';
import { insigniaSpec, titleFor } from '../ratings/titles';
import { careerEloLabel, displayElo, suggestBeginnerBands } from '../ratings/career';

/**
 * Random Federation Quick Match: one button, any opponent in the Federation (uniform, not rating-weighted), rated by
 * default. Drawing and rerolling create nothing; a game record exists only after Start, and is then a normal game
 * (rated: one Glicko-2 event at finalisation; casual: no rating change, no standings).
 */
export function QuickMatch() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [pool, setPoolRaw] = useState<QuickPool>('anyone');
  // the default follows the career: a provisional new career (or anyone under 800) starts from the beginner bands
  const [touched, setTouched] = useState(false);
  const setPool = (p: QuickPool) => { setTouched(true); setPoolRaw(p); };
  const [rated, setRated] = useState(true);
  const [pick, setPick] = useState<Competitor | null>(null);
  const [myRating, setMyRating] = useState<{ rating: number; rd: number; games?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const st = fed.ready ? fed.state : null;
  useEffect(() => { void services.db.ratingState('rapid').then(p => setMyRating({ rating: p.rating, rd: p.rd, games: p.games })).catch(() => {}); }, [services, services.revision]);
  const suggested = !!myRating && suggestBeginnerBands({ rating: myRating.rating, rd: myRating.rd, games: myRating.games ?? 0 }, services.db.ratingStart);
  useEffect(() => { if (!touched && myRating) setPoolRaw(suggested ? 'beginner' : 'anyone'); }, [suggested, touched, myRating]);
  // "near" and "higher" compare with the displayed career Elo (never below 0)
  const eligible = useMemo(() => (st && myRating ? eligiblePool(st.competitors.values(), pool, displayElo(myRating.rating)) : []), [st, pool, myRating, services.revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = async (avoid?: string) => {
    setMsg(null);
    let r = myRating;
    if (!r) { const p = await services.db.ratingState('rapid'); r = { rating: p.rating, rd: p.rd, games: p.games }; setMyRating(r); }
    const list = st ? eligiblePool(st.competitors.values(), pool, displayElo(r.rating)) : [];
    const c = pickOpponent(list, Math.random, avoid);
    setPick(c);
    if (!c) setMsg('No competitor matches this filter right now.');
  };
  const start = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      const r = await services.db.ratingState('rapid');
      const g = await fed.quickMatchGameFor(pick.id, { rated, humanColor: Math.random() < 0.5 ? 'white' : 'black', human: { rating: r.rating, rd: r.rd }, nowMs: Date.now() });
      await services.saveGame(g);
      go({ name: 'match', gameId: g.id });
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  };

  if (!st) {
    return (
      <section className="panel quick-match" data-testid="quick-match" style={{ marginBottom: 14 }}>
        <div className="panel-title"><h2 style={{ margin: 0 }}>Random Match</h2></div>
        <p className="small muted">Random Match challenges any of the Federation's competitors. Found the Federation first; it takes a few seconds.</p>
        <button className="btn" onClick={() => go({ name: 'world' })}>Go to the Federation</button>
      </section>
    );
  }
  const t = pick ? titleFor(pick.rating) : null;
  const rec = pick ? pick.stats : null;
  return (
    <section className="panel quick-match" data-testid="quick-match" style={{ marginBottom: 14 }}>
      <div className="panel-title"><h2 style={{ margin: 0 }}>Random Match</h2><span className={`chip ${rated ? 'gold' : ''}`} data-testid="qm-mode">{rated ? 'Rated' : 'Casual'}</span></div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="Opponent pool">
          {QUICK_POOLS.map(p => <button key={p.id} aria-pressed={pool === p.id} title={p.detail} onClick={() => { setPool(p.id); setPick(null); setMsg(null); }}>{p.label}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Match type">
          <button aria-pressed={rated} onClick={() => setRated(true)}>Rated</button>
          <button aria-pressed={!rated} onClick={() => setRated(false)}>Casual</button>
        </div>
      </div>
      <p className="small muted" style={{ margin: '6px 0' }}>
        {pool === 'beginner' && suggested && <span className="chip info" data-testid="qm-suggested" style={{ marginRight: 6 }}>Suggested for your career Elo</span>}
        {myRating && <span data-testid="qm-my-rating">Your career Elo {careerEloLabel(myRating.rating, myRating.games ?? 0, myRating.rd)} · </span>}
        {QUICK_POOLS.find(p => p.id === pool)!.detail}{myRating ? ` · ${eligible.length.toLocaleString('en')} eligible` : ''} · every eligible competitor is equally likely · Rapid 5+3 ·{' '}
        {rated ? 'rated: your Rapid rating changes once, when the game ends' : 'casual: no rating change'}. Not a league game: standings are unaffected.
      </p>
      {!pick && <button className="btn primary qm-draw" data-testid="qm-draw" onClick={() => void draw()}><Icon name="play" /> Random Match</button>}
      {msg && <div className="notice small" role="status">{msg}{pool !== 'anyone' && <> <button className="btn small ghost" onClick={() => { setPool('anyone'); setMsg(null); }}>Use Anyone</button></>}</div>}
      {pick && t && (
        <div className="qm-card" data-testid="qm-card">
          <Portrait seed={pick.portraitSeed} size={64} />
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <strong data-testid="qm-name">{pick.name}</strong>
            <span className="row small" style={{ gap: 6 }}><Emblem spec={insigniaSpec(t)} size="sm" title={`${t.name} insignia`} />{t.name}</span>
            <span className="small"><span className="mono" data-testid="qm-rating">{Math.round(pick.rating)} ±{Math.round(pick.rd)}</span><span className="muted"> · {divisionLabel(pick.division)} · {REGION_NAMES[pick.region]}{rec ? ` · career ${rec.w}–${rec.d}–${rec.l}` : ''}{pick.titles.length ? ` · ${pick.titles.length} title${pick.titles.length === 1 ? '' : 's'}` : ''}</span></span>
          </div>
          <div className="row qm-actions" style={{ gap: 6 }}>
            <button className="btn primary" data-testid="qm-start" disabled={busy || services.readOnly} onClick={() => void start()}>{rated ? 'Start Rated Match' : 'Start Casual Match'}</button>
            <button className="btn" data-testid="qm-reroll" disabled={busy} onClick={() => void draw(pick.id)}>Reroll</button>
            <button className="btn ghost" data-testid="qm-cancel" disabled={busy} onClick={() => { setPick(null); setMsg(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
