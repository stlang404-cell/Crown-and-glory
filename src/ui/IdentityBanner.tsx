import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApp, useServices } from './App';
import { Emblem } from './Emblem';
import { RATING_TITLES, insigniaSpec, titleFor, titleProgress } from '../ratings/titles';
import { isProvisional } from '../ratings/glicko2';
import type { PoolState, RatingEvent } from '../ratings/ledger';
import { PLAYER_ID } from '../federation/model';
import { REGION_NAMES, divisionLabel } from '../federation/model';
import { fmtCrowns } from '../exchange/ledger';
import { ratingChange } from '../ratings/display';
import { Elo } from './CareerElo';
import { TrophyArt } from './TrophyArt';
import { ACCENTS } from '../legacy/customise';
import { vaultDef } from '../vault/catalog';
import type { LegacyService } from '../legacy/service';
import './legacy.css';

interface Data { pool: PoolState | null; last: RatingEvent | null; brilliants: number; games: number }

const NOOP = () => () => {};
/** Re-render when the legacy service publishes (trophies, customisation). */
export function useLegacy(): LegacyService | null {
  const services = useServices();
  const lg = services.legacy ?? null;
  useSyncExternalStore(lg ? lg.subscribe : NOOP, () => lg?.version ?? 0);
  return lg;
}

/**
 * The persistent identity header (v0.11 "legacy header"): name, career Elo (numeric, ±RD), rating title and insignia,
 * division and regional league, featured banner, featured trophies, showcased achievements, Exchange honour, net worth,
 * cash, career Brilliant moves and the latest rated result. Desktop: one rich row. Phone (≤ 700 px): a compact row
 * (insignia, name, title, Elo) that expands in place — it is part of the page flow (no fixed position, no inner
 * scroller), so it never covers content or traps scrolling. Everything comes from saved state; a value that does not
 * exist yet is shown as such ("No rated games yet"), never as a placeholder number. Customisation shows only earned
 * items (src/legacy/customise.ts).
 */
export function IdentityBanner() {
  const services = useServices();
  const { go } = useApp();
  const lg = useLegacy();
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
  let cash: number | null = null, netWorth: number | null = null;
  try { if (fed.ready) { const f = fed.finance(); cash = f.cash; netWorth = f.netWorth; } } catch { /* finance view unavailable */ }
  const ceremony = st?.extra.ceremonies?.at(-1) ?? null;
  const last = d.last;
  const shown = lg?.ready ? lg.shown() : null;
  const earned = lg?.earned;
  const insignia = shown?.insignia !== null && shown?.insignia !== undefined ? RATING_TITLES[shown.insignia] : t;
  const banner = shown?.banner ? earned?.banners.find(b => b.id === shown.banner) ?? null : null;
  const featured = shown ? shown.featured.map(k => earned!.trophies.find(x => x.key === k)).filter(x => !!x) : [];
  const showcase = shown ? shown.showcase.map(id => vaultDef(id)).filter(x => !!x) : [];
  const honour = shown?.honour ? vaultDef(shown.honour) ?? null : null;
  const accent = ACCENTS.find(a => a.id === (shown?.accent ?? 'crimson'))!;
  const name = shown?.name || 'You';
  const trophyCount = earned?.trophies.length ?? 0;
  const lastChange = last ? ratingChange(last.before.rating, last.after.rating) : null;
  return (
    <section className={`id-banner legacy-header${open ? ' expanded' : ''}`} aria-label="Your Federation identity" data-testid="identity-banner" data-accent={accent.id}
      style={{ ...(shown && shown.accent !== 'crimson' ? { ['--legacy-accent' as string]: accent.color } : {}), ...(banner ? { ['--legacy-banner-a' as string]: banner.colors[0], ['--legacy-banner-b' as string]: banner.colors[1] } : {}) }}>
      {banner && <div className="legacy-banner-strip" aria-hidden data-testid="header-banner" title={banner.name} />}
      <button className="id-main" onClick={() => go({ name: 'profile' })} title="Open your Career Passport">
        {insignia ? <Emblem spec={insigniaSpec(insignia)} size="md" title={`${insignia.name} insignia`} /> : <span className="id-blank" aria-hidden />}
        <span className="id-who">
          <span className="id-name" data-testid="header-name">{name}</span>
          <span className="id-title" data-testid="banner-title">{t ? t.name : 'Unrated'}{t && prov ? <span className="id-prov"> · provisional</span> : null}</span>
          <span className="id-rating" data-testid="banner-rating">{rating !== null ? <><span className="id-elo-k">Career Elo </span><Elo rating={rating} rd={d.pool!.rd} /></> : 'No rated games yet'}</span>
        </span>
      </button>
      {prog && (
        <div className="id-progress" title={prog.next ? `${prog.toNext} points to ${prog.next.name}` : 'Highest rating title'}>
          <div className="id-bar" role="progressbar" aria-label="Progress to the next rating title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog.fraction * 100)}><i style={{ width: `${prog.fraction * 100}%` }} /></div>
          <span className="small muted" data-testid="banner-next">{prog.next ? `${prog.toNext} to ${prog.next.name}` : 'Highest title'}</span>
        </div>
      )}
      <div className={`id-stats${open ? ' open' : ''}`} id="legacy-details">
        <span className="id-stat sec"><span className="k">Division</span><span className="v" data-testid="header-division">{circuit ? `${divisionLabel(circuit.division)} · ${REGION_NAMES[circuit.region]}` : fed.ready ? 'Between seasons' : 'Not founded'}</span></span>
        <span className="id-stat"><span className="k">Cash</span><span className="v mono" data-testid="banner-cash">{cash !== null ? fmtCrowns(cash, 0) : '—'}</span></span>
        <span className="id-stat sec"><span className="k">Net Worth</span><span className="v mono" data-testid="header-networth">{netWorth !== null ? fmtCrowns(netWorth, 0) : '—'}</span></span>
        <span className="id-stat sec"><span className="k">Last Rated</span><span className="v mono" data-testid="banner-last">{last && lastChange ? `${last.score === 1 ? 'Win' : last.score === 0 ? 'Loss' : 'Draw'} ${lastChange.deltaText}` : '—'}</span></span>
        <span className="id-stat sec"><span className="k">Brilliant Moves</span><span className="v mono" data-testid="banner-brilliants">{d.brilliants}</span></span>
        {honour && <span className="id-stat sec"><span className="k">Exchange Honour</span><span className="v" data-testid="header-honour">{honour.name}</span></span>}
        {ceremony && <span className="id-stat sec"><span className="k">Latest</span><span className="v">{ceremony.title.replace('Federation title: ', '')}</span></span>}
        <span className="id-stat sec legacy-trophies">
          <span className="k">Trophies</span>
          <button className="legacy-trophy-row" onClick={() => go({ name: 'hall' })} title="Open the Trophy Hall" data-testid="header-trophies">
            {featured.length ? featured.map(f => <TrophyArt key={f.key} kind={f.kind} tier={f.tier} size={28} title={f.name} />) : <span className="v mono">{trophyCount}</span>}
          </button>
        </span>
        {showcase.length > 0 && <span className="id-stat sec legacy-showcase" data-testid="header-showcase"><span className="k">Showcase</span>
          <span className="legacy-trophy-row">{showcase.map(v => <Emblem key={v.id} spec={v.art} size="sm" title={v.name} />)}</span></span>}
      </div>
      <button className="id-more btn ghost small" aria-expanded={open} aria-controls="legacy-details" data-testid="header-toggle" onClick={() => setOpen(o => !o)}>{open ? 'Less' : 'More'}</button>
    </section>
  );
}
