import { useEffect, useState } from 'react';
import { useApp, useServices } from './App';
import { Emblem } from './Emblem';
import { insigniaSpec, titleFor, titleProgress } from '../ratings/titles';
import { isProvisional } from '../ratings/glicko2';
import type { PoolState, RatingEvent } from '../ratings/ledger';
import { PLAYER_ID } from '../federation/model';
import { REGION_NAMES, divisionLabel } from '../federation/model';
import { fmtCrowns } from '../exchange/ledger';

interface Data { pool: PoolState | null; last: RatingEvent | null; brilliants: number; games: number }

/**
 * Federation identity banner: rating, rating title + insignia, progress to the next title, division and regional
 * league, cash, career Brilliant moves, latest rated result and latest ceremony. Everything comes from saved state;
 * a value that does not exist yet is shown as such ("No rated games yet"), never as a placeholder number.
 */
export function IdentityBanner() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const rev = services.revision;
  useEffect(() => {
    let alive = true;
    // throttled: at most one reload per 1.5 s however often the services publish changes
    const t = setTimeout(() => void (async () => {
      try {
        const [pool, events, games, reports] = await Promise.all([
          services.db.ratingState('rapid').catch(() => null), services.db.ratingEvents('rapid'), services.db.allGames(), services.db.allReports(),
        ]);
        // career Brilliant moves: latest complete report per finished game, the player's own moves only (re-analysis never double-counts)
        const latest = new Map<string, (typeof reports)[number]>();
        for (const r of reports) if (r.status === 'complete') { const c = latest.get(r.gameId); if (!c || r.completedAt > c.completedAt) latest.set(r.gameId, r); }
        let brilliants = 0;
        for (const g of games) { const r = latest.get(g.id); if (r && g.status === 'finalized') brilliants += r.plies.filter(p => p.color === g.humanColor && p.grade === 'brilliant').length; }
        const last = [...events].sort((a, b) => a.at.localeCompare(b.at)).at(-1) ?? null;
        if (alive) setD({ pool: pool && (pool as PoolState).games > 0 ? (pool as PoolState) : null, last, brilliants, games: games.filter(g => g.status === 'finalized').length });
      } catch { if (alive) setD({ pool: null, last: null, brilliants: 0, games: 0 }); }
    })(), d ? 1500 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [services, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return null;
  const rating = d.pool?.rating ?? null;
  const prov = d.pool ? isProvisional(d.pool.games, d.pool.rd) : true;
  const t = rating !== null ? titleFor(rating) : null;
  const prog = rating !== null ? titleProgress(rating) : null;
  const st = fed.ready ? fed.state : null;
  const circuit = st?.plan.circuits.find(c => c.members.includes(PLAYER_ID));
  const cash = fed.ready ? fed.finance().cash : null;
  const ceremony = st?.extra.ceremonies?.at(-1) ?? null;
  const last = d.last;
  return (
    <section className="id-banner" aria-label="Your Federation identity" data-testid="identity-banner">
      <button className="id-main" onClick={() => go({ name: 'profile' })} title="Open your Career Passport">
        {t ? <Emblem spec={insigniaSpec(t)} size="md" title={`${t.name} insignia`} /> : <span className="id-blank" aria-hidden />}
        <span className="id-who">
          <span className="id-title" data-testid="banner-title">{t ? t.name : 'Unrated'}{t && prov ? <span className="id-prov"> · provisional</span> : null}</span>
          <span className="id-rating mono" data-testid="banner-rating">{rating !== null ? `${Math.round(rating)} ±${Math.round(d.pool!.rd)}` : 'No rated games yet'}</span>
        </span>
      </button>
      {prog && (
        <div className="id-progress" title={prog.next ? `${prog.toNext} points to ${prog.next.name}` : 'Highest rating title'}>
          <div className="id-bar" role="progressbar" aria-label="Progress to the next rating title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog.fraction * 100)}><i style={{ width: `${prog.fraction * 100}%` }} /></div>
          <span className="small muted" data-testid="banner-next">{prog.next ? `${prog.toNext} to ${prog.next.name}` : 'Highest title'}</span>
        </div>
      )}
      <div className={`id-stats${open ? ' open' : ''}`}>
        <span className="id-stat sec"><span className="k">League</span><span className="v">{circuit ? `${divisionLabel(circuit.division)} · ${REGION_NAMES[circuit.region]}` : fed.ready ? 'Between seasons' : 'Not founded'}</span></span>
        <span className="id-stat"><span className="k">Cash</span><span className="v mono" data-testid="banner-cash">{cash !== null ? fmtCrowns(cash, 0) : '—'}</span></span>
        <span className="id-stat sec"><span className="k">Brilliant Moves</span><span className="v mono" data-testid="banner-brilliants">{d.brilliants}</span></span>
        <span className="id-stat sec"><span className="k">Last Rated</span><span className="v mono" data-testid="banner-last">{last ? `${last.score === 1 ? 'Win' : last.score === 0 ? 'Loss' : 'Draw'} ${last.delta >= 0 ? '+' : ''}${last.delta.toFixed(0)}` : '—'}</span></span>
        {ceremony && <span className="id-stat sec"><span className="k">Latest</span><span className="v">{ceremony.title.replace('Federation title: ', '')}</span></span>}
      </div>
      <button className="id-more btn ghost small" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Less' : 'More'}</button>
    </section>
  );
}
