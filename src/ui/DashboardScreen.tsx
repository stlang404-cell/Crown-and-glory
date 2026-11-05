import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { GuideCard } from './Onboarding';
import { HonourTag, RATING_TITLE_TOOLTIP } from './RankBadge';
import { RankHeading } from './RankHeading';
import { fmtCareerElo } from '../ratings/display';
import { useApp, useServices } from './App';
import { QuickMatch } from './QuickMatch';
import { Emblem } from './Emblem';
import { Icon } from './Icons';
import { RatingChart } from './Charts';
import { PriceChart } from './ExchangeScreen';
import { tournamentCrest, tournamentOf } from '../heraldry/catalog';
import { insigniaSpec, titleFor } from '../ratings/titles';
import { eventName } from '../app/federation';
import { gamesOf } from '../federation/driver';
import { LEAGUE_ROUNDS, ROUNDS_PER_SEASON, SWISS_ROUNDS, CHAMPIONSHIP_ROUNDS } from '../federation/model';
import { fmtMoney, fmtMoneyDelta, fmtPrice, fmtPriceDelta } from '../exchange/ledger';
import { statesOf } from '../exchange/market';
import { prices } from '../exchange/lmsr';
import { VAULT } from '../vault/catalog';
import type { VaultService } from '../vault/service';
import { loadProgress } from '../academy/grimoire';
import type { RatingEvent } from '../ratings/ledger';
import {
  featuredMarketForChart, grimoireSummary, liveMatches, netWorthSeries, openMarkets, portfolio, ratingSeries, recentRated, recentSettlements, tournamentEvents, vaultSummary,
  type DashEvent, type DashGrimoire, type DashMatch, type DashSide, type MatchStatus,
} from '../app/dashboard';
import './dashboard.css';
import { Opportunities, StandingSummary, UpcomingMatches, DeadlineRule } from './CareerPanels';

const noop = () => () => {};
/** Re-render on Vault changes only. */
function useVault(): VaultService | undefined {
  const { services } = useApp();
  const v = services.vault as VaultService | undefined;
  useSyncExternalStore(v ? v.subscribe : noop, () => v?.version ?? 0);
  return v;
}

/** Load something off the first paint, then reload at most once per 1.5 s of quiet after app changes. */
function useLazy<T>(load: () => Promise<T>, fallback: T, rev: number): T | null {
  const [v, setV] = useState<T | null>(null);
  const first = useRef(true);
  const fn = useRef(load); fn.current = load;
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => { fn.current().then(x => { if (alive) setV(x); }, () => { if (alive) setV(fallback); }); }, first.current ? 60 : 1500);
    first.current = false;
    return () => { alive = false; clearTimeout(t); };
  }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

function phase(round: number): string {
  if (round <= LEAGUE_ROUNDS) return SWISS_ROUNDS.includes(round) ? `League round ${round} · Swiss round ${round - SWISS_ROUNDS[0] + 1}` : `League round ${round}`;
  return `Crown Championship · ${['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'][round - CHAMPIONSHIP_ROUNDS[0]]}`;
}
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
const resultText = (r: number | null) => (r === 1 ? '1–0' : r === 0 ? '0–1' : r === 0.5 ? '½–½' : '');
const STATUS_LABEL: Record<MatchStatus, string> = { live: 'Live', upcoming: 'Upcoming', finished: 'Finished' };

function Section({ title, id, action, children, className = '' }: { title: string; id: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel dash-card ${className}`} aria-labelledby={`dash-h-${id}`} data-testid={`dash-${id}`}>
      <div className="panel-title"><h2 id={`dash-h-${id}`} className="dash-h">{title}</h2>{action}</div>
      {children}
    </section>
  );
}
function Bar({ have, need, label }: { have: number; need: number; label: string }) {
  const pct = need > 0 ? Math.round((100 * Math.min(have, need)) / need) : 0;
  return <div className="dash-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(have, need)}><span style={{ width: `${pct}%` }} /></div>;
}
function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="dash-empty"><p className="small muted">{children}</p>{action}</div>;
}

// ---------------------------------------------------------------- live federation matches
function Player({ s }: { s: DashSide }) {
  const t = titleFor(s.rating);
  return (
    <span className="dash-player">
      <Emblem spec={insigniaSpec(t)} size="sm" title={`${t.name} insignia`} />
      <span className="dash-player-text">
        <strong className="dash-name">{s.name}</strong>
        <span className="small muted"><span className="mono">{fmtCareerElo(s.rating)}</span> · <span title={RATING_TITLE_TOOLTIP} aria-label={`Rating title: ${t.name}`}>{t.name}</span> <HonourTag kind="rating" /></span>
      </span>
    </span>
  );
}
function MatchCard({ m }: { m: DashMatch }) {
  const { go } = useApp();
  const vs = `${m.white.name} vs ${m.black.name}`;
  const labels = ['W', 'D', 'B'];
  return (
    <li className="dash-match" data-testid="dash-match" data-status={m.status} data-fixture={m.fixtureId}>
      <div className="dash-match-head">
        <span className={`chip dash-status ${m.status}`} data-testid="dash-match-status">{m.status === 'live' && <i className="dash-dot" aria-hidden />}{STATUS_LABEL[m.status]}{m.status === 'finished' ? ` · ${resultText(m.result)}` : ''}</span>
        <span className="small muted dash-event">{eventName(m.event)}{m.stage ? ` · ${m.stage}` : ''}</span>
      </div>
      <div className="dash-players"><Player s={m.white} /><span className="muted small dash-vs">vs</span><Player s={m.black} /></div>
      <div className="dash-match-foot">
        {m.market
          ? <span className="small mono dash-odds" aria-label={`Live Odds: White ${fmtPrice(m.market.prices[0])}, Draw ${fmtPrice(m.market.prices[1])}, Black ${fmtPrice(m.market.prices[2])}`}>{m.market.prices.map((p, i) => <span key={i}>{labels[i]} {fmtPrice(p)}</span>)}</span>
          : <span className="small muted">No market</span>}
        <span className="spacer" />
        {m.market && (m.market.status === 'open'
          ? <button className="btn small" data-testid="dash-trade" aria-label={`Trade ${vs}`} onClick={() => go({ name: 'exchange', id: m.market!.id })}>Trade</button>
          : <button className="btn small ghost" data-testid="dash-market" aria-label={`Market for ${vs}`} onClick={() => go({ name: 'exchange', id: m.market!.id })}>Market</button>)}
        <button className={`btn small ${m.status === 'live' ? 'primary' : ''}`} data-testid="dash-watch" aria-label={`${m.status === 'finished' ? 'Replay' : 'Watch'} ${vs}`} onClick={() => go({ name: 'watch', id: m.fixtureId })}>{m.status === 'finished' ? 'Replay' : m.status === 'live' ? 'Watch Live' : 'Watch'}</button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- tournaments
const EVENT_STATUS: Record<DashEvent['status'], string> = { upcoming: 'Upcoming', 'in-progress': 'In Progress', finished: 'Finished' };
function EventCard({ e }: { e: DashEvent }) {
  return (
    <li className="dash-event-card" data-testid="dash-event" data-event={e.id} data-status={e.status}>
      <div className="row" style={{ gap: 8 }}>
        <Emblem spec={tournamentCrest(tournamentOf(e.id))} size="sm" title={`${e.name} crest`} />
        <strong>{e.name}</strong>
        <span className="spacer" />
        <span className={`chip ${e.status === 'in-progress' ? 'gold' : e.status === 'finished' ? 'info' : ''}`}>{EVENT_STATUS[e.status]}</span>
      </div>
      <div className="small muted">{e.progress}{e.prize !== null ? ` · ${fmtMoney(e.prize, 0)} in prizes` : ''}{e.playerIn ? ' · You are entered' : ''}</div>
      {e.leaders.length > 0 && (
        <ol className="dash-leaders small" aria-label={e.status === 'finished' ? `${e.name} final placings` : `${e.name} leaders`}>
          {e.leaders.map(l => <li key={l.id}><span>{l.name}</span>{l.points !== null && <span className="mono muted">{l.points} pts</span>}</li>)}
        </ol>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- charts
function NetWorthSpark({ points }: { points: { season: number; round: number; netWorth: number; cash: number }[] }) {
  if (points.length < 2) return <Empty>Your net worth chart starts after your next transaction or round.</Empty>;
  const W = 320, H = 120, P = 6;
  const vals = points.flatMap(p => [p.netWorth, p.cash]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const y = (v: number) => P + (1 - (v - min) / (max - min || 1)) * (H - 2 * P);
  const line = (k: 'netWorth' | 'cash') => points.map((p, i) => `${((i / (points.length - 1)) * W).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const first = points[0], last = points[points.length - 1];
  return (
    <div>
      <svg className="dash-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Net worth history, ${points.length} snapshots: ${fmtMoney(first.netWorth, 0)} to ${fmtMoney(last.netWorth, 0)}`}>
        <polyline points={line('cash')} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        <polyline points={line('netWorth')} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="legend" aria-hidden><span><i style={{ background: 'var(--accent)' }} />Net Worth {fmtMoney(last.netWorth, 0)}</span><span><i style={{ background: 'var(--muted)' }} />Cash {fmtMoney(last.cash, 0)}</span></div>
      <details className="small"><summary>Table</summary>
        <table className="dash-table"><thead><tr><th>Season</th><th>Round</th><th>Net Worth</th><th>Cash</th></tr></thead>
          <tbody>{points.slice(-8).reverse().map((p, i) => <tr key={i}><td>{p.season}</td><td>{p.round}</td><td className="mono">{fmtMoney(p.netWorth, 0)}</td><td className="mono">{fmtMoney(p.cash, 0)}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------- the screen
export function DashboardScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const rev = services.revision;
  const st = fed.ready ? fed.state : null;
  const vault = useVault();

  // in-memory federation selectors: recomputed only when the state or the revision moves
  const featured = useMemo(() => (st ? fed.featuredFixtures() : []), [st, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = useMemo(() => (st ? liveMatches(st, featured, id => fed.isLive(id)) : []), [st, featured, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const events = useMemo(() => (st ? tournamentEvents(st, gamesOf(fed.seasonRounds().filter(r => SWISS_ROUNDS.includes(r.round)))) : []), [st, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const book = useMemo(() => (st ? portfolio(st) : null), [st, rev]);
  const seasonGames = useMemo(() => (st ? gamesOf(fed.seasonRounds()) : []), [st, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const markets = useMemo(() => (st ? openMarkets(st) : []), [st, rev]);
  const settlements = useMemo(() => (st ? recentSettlements(st) : []), [st, rev]);
  const chart = useMemo(() => (st ? featuredMarketForChart(st, featured) : null), [st, featured]);
  const worth = useMemo(() => netWorthSeries(st), [st, rev]);
  const vs = useMemo(() => (vault?.ready ? vaultSummary(VAULT, vault.owned, vault.results) : null), [vault, vault?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  // saved records outside the federation: loaded after the first paint, throttled
  const ratingEvents = useLazy<RatingEvent[]>(() => services.db.ratingEvents(), [], rev);
  const grim = useLazy<DashGrimoire | null>(async () => grimoireSummary(await loadProgress(services.db), new Date().toISOString()), null, rev);
  const rating = useMemo(() => (ratingEvents ? ratingSeries(ratingEvents, 'rapid') : []), [ratingEvents]);
  const rated = useMemo(() => (ratingEvents ? recentRated(ratingEvents) : []), [ratingEvents]);

  const foundCta = <button className="btn" data-testid="dash-found-cta" onClick={() => go({ name: 'world' })}>Go to the Federation</button>;
  const w = st?.world;
  return (
    <div className="dash" data-testid="dashboard">
      <div className="dash-head">
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <RankHeading />
          <div className="small muted" data-testid="dash-season">{w ? `Season ${w.season} · Round ${w.round}/${ROUNDS_PER_SEASON} · ${phase(w.round)}` : 'The Federation has not been founded yet'}</div>
        </div>
        <span className="spacer" />
        <span className="dash-head-actions">
          <button className="btn small" onClick={() => go({ name: 'play' })}><Icon name="play" /> Play</button>
          <button className="btn small" data-testid="dash-study" onClick={() => go({ name: 'study' })}><Icon name="academy" /> Study Match</button>
          <button className="btn small" onClick={() => go({ name: 'world' })}><Icon name="world" /> Federation</button>
        </span>
      </div>
      <GuideCard />
      {st && (
        <section className="panel dash-found dash-arena" data-testid="dash-arena" aria-labelledby="dash-h-arena">
          <div>
            <h2 id="dash-h-arena" className="dash-h">AI vs AI Match Arena</h2>
            <p className="small" style={{ margin: '4px 0 0' }}>Watch live official matches with their markets, replay finished games, or start a custom exhibition between any two of the Federation’s competitors.</p>
          </div>
          <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" data-testid="dash-open-arena" onClick={() => go({ name: 'arena' })}>Watch AI Match</button>
            <button className="btn" data-testid="dash-start-exhibition" onClick={() => go({ name: 'exhibition' })}>Custom Exhibition</button>
          </span>
        </section>
      )}
      {!st && (
        <div className="panel dash-found" data-testid="dash-not-founded">
          <div>
            <h2 className="dash-h">Found the Six-Square Federation</h2>
            <p className="small" style={{ margin: '4px 0 0' }}>2,048 AI competitors, leagues, tournaments and the Crown Exchange. Your dashboard fills in once it exists; your games and ratings so far are kept.</p>
          </div>
          {foundCta}
        </div>
      )}

      <div className="dash-grid">
        <div className="dash-qm"><QuickMatch /></div>

        {st && (
          <Section title="Your Season" id="season" className="dash-wide" action={<button className="btn ghost small" data-testid="dash-open-federation" onClick={() => go({ name: 'world' })}>Your Fixtures</button>}>
            <StandingSummary games={seasonGames} />
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div><h3 className="dash-sub">Upcoming Matches</h3><UpcomingMatches limit={6} /></div>
              <div><h3 className="dash-sub">Qualification · What You Need</h3><Opportunities games={seasonGames} /></div>
            </div>
            <DeadlineRule />
          </Section>
        )}

        <Section title="Live Federation Matches" id="matches" className="dash-wide" action={st ? <button className="btn ghost small" onClick={() => go({ name: 'world' })}>All Fixtures</button> : undefined}>
          {!st ? <Empty action={foundCta}>Featured matches appear here once you found the Federation.</Empty>
            : matches.length === 0 ? <Empty>No featured matches this round.</Empty>
              : <ul className="dash-list dash-matches">{matches.map(m => <MatchCard key={m.fixtureId} m={m} />)}</ul>}
          {st && featured.length > matches.length && <p className="small muted">Showing {matches.length} of {featured.length} featured matches.</p>}
        </Section>

        <Section title="Crown Exchange" id="exchange" action={st ? <button className="btn ghost small" data-testid="dash-open-exchange" onClick={() => go({ name: 'exchange' })}>Open Exchange</button> : undefined}>
          {!st || !book ? <Empty action={foundCta}>The Exchange opens with the Federation. You start with $1,000 in fictional money.</Empty> : (
            <>
              <div className="dash-stats">
                <div className="stat"><span className="k">Cash</span><span className="v mono" data-testid="dash-cash">{fmtMoney(book.cash, 0)}</span></div>
                <div className="stat"><span className="k">Positions</span><span className="v mono">{fmtMoney(book.value, 0)}</span><span className="small muted">{book.count} open</span></div>
                <div className="stat"><span className="k">Open P&amp;L</span><span className={`v mono ${book.pnl > 0 ? 'pos' : book.pnl < 0 ? 'neg' : ''}`} data-testid="dash-pnl">{book.count ? fmtMoneyDelta(book.pnl) : '—'}</span></div>
              </div>
              <h3 className="dash-sub">Your Positions</h3>
              {book.items.length === 0 ? <Empty>No open positions. Pick a market below to place your first trade.</Empty> : (
                <ul className="dash-list">{book.items.map(p => (
                  <li key={p.marketId}><button className="dash-row" data-testid="dash-position" onClick={() => go({ name: 'exchange', id: p.marketId })}>
                    <span className="dash-row-main"><span className="dash-ellipsis">{p.title}</span><span className="small muted">{p.label}{p.status === 'closed' ? ' · Trading Closed' : ''}</span></span>
                    <span className="dash-row-num"><span className="mono">{fmtMoney(p.value)}</span><span className={`small mono ${p.pnl > 0 ? 'pos' : p.pnl < 0 ? 'neg' : 'muted'}`}>{fmtMoneyDelta(p.pnl)}</span></span>
                  </button></li>))}
                </ul>
              )}
              {book.count > book.items.length && <p className="small muted">And {book.count - book.items.length} more on the Finance screen.</p>}
              <h3 className="dash-sub">Open Markets</h3>
              {markets.length === 0 ? <Empty>No markets are open right now.</Empty> : (
                <ul className="dash-list">{markets.map(m => (
                  <li key={m.id}><button className="dash-row" data-testid="dash-open-market" onClick={() => go({ name: 'exchange', id: m.id })}>
                    <span className="dash-row-main"><span className="dash-ellipsis">{m.title}</span><span className="small muted">Leading: {m.leader.label}</span></span>
                    <span className="dash-row-num"><span className="mono">{fmtPrice(m.leader.price)}</span><span className="small mono muted">{m.move === null ? 'No trades yet' : <><span aria-hidden>{m.move > 0 ? '▲ ' : m.move < 0 ? '▼ ' : ''}</span>{fmtPriceDelta(m.move)}</>}</span></span>
                  </button></li>))}
                </ul>
              )}
              <button className="btn ghost small" onClick={() => go({ name: 'finance' })}>Finance</button>
            </>
          )}
        </Section>

        <Section title="Tournaments" id="tournaments" action={st ? <button className="btn ghost small" data-testid="dash-open-tournaments" onClick={() => go({ name: 'tournaments' })}>All Tournaments</button> : undefined}>
          {!st ? <Empty action={foundCta}>Federation Open, Challenger Open, Crown Championship and Club Weekend appear here each season.</Empty>
            : <ul className="dash-list">{events.map(e => <EventCard key={e.id} e={e} />)}</ul>}
        </Section>

        <Section title="Rapid Rating" id="rating" action={<button className="btn ghost small" onClick={() => go({ name: 'profile' })}>Career</button>}>
          {ratingEvents === null ? <p className="small muted">Loading your rating history…</p> : rating.length < 2
            ? <Empty action={<button className="btn small" onClick={() => go({ name: 'play' })}>Play a Rated Game</button>}>Your rating chart appears after your first rated Rapid game.</Empty>
            : <RatingChart points={rating.slice(-60)} height={200} />}
        </Section>

        <Section title="Net Worth" id="networth" action={st ? <button className="btn ghost small" onClick={() => go({ name: 'finance' })}>Finance</button> : undefined}>
          {!st ? <Empty action={foundCta}>Net worth is tracked once the Federation exists.</Empty> : <NetWorthSpark points={worth} />}
        </Section>

        <Section title="Market Odds" id="odds" action={chart ? <button className="btn ghost small" onClick={() => go({ name: 'exchange', id: chart.market.id })}>Market</button> : undefined}>
          {!st ? <Empty action={foundCta}>Odds history of a featured match appears here.</Empty> : !chart ? <Empty>No featured market this round.</Empty> : (
            <>
              <div className="small dash-ellipsis" style={{ marginBottom: 4 }}>{chart.market.title}</div>
              {chart.points.length >= 2 ? <PriceChart m={chart.market} points={chart.points} /> : <Empty>Not enough trades for a chart yet. Prices now: {statesOf(chart.market).map((s, i) => `${s} ${fmtPrice(prices(chart.market.q, chart.market.b)[i] ?? 0)}`).join(' · ')}.</Empty>}
            </>
          )}
        </Section>

        <Section title="Recent Results" id="results" action={<button className="btn ghost small" onClick={() => go({ name: 'library' })}>Games</button>}>
          <h3 className="dash-sub">Rated Games</h3>
          {ratingEvents === null ? <p className="small muted">Loading…</p> : rated.length === 0
            ? <Empty action={<button className="btn small" onClick={() => go({ name: 'play' })}>Play</button>}>No rated games yet. Your results appear here after each rated game.</Empty>
            : <ul className="dash-list">{rated.map(r => (
              <li key={r.gameId + r.pool}><button className="dash-row" data-testid="dash-result" onClick={() => go({ name: 'analysis', gameId: r.gameId })}>
                <span className="dash-row-main"><span className="dash-ellipsis"><span className={`chip ${r.score === 1 ? 'pos' : r.score === 0 ? 'neg' : ''}`}>{r.score === 1 ? 'Win' : r.score === 0 ? 'Loss' : 'Draw'}</span> vs {r.opponent}</span><span className="small muted">{r.pool[0].toUpperCase() + r.pool.slice(1)} · {fmtDate(r.at)}</span></span>
                <span className="dash-row-num"><span className="mono">{Math.round(r.after)}</span><span className="small mono muted">{r.delta >= 0 ? '+' : ''}{r.delta.toFixed(0)}</span></span>
              </button></li>))}</ul>}
          {st && <>
            <h3 className="dash-sub">Settled Trades</h3>
            {settlements.length === 0 ? <Empty>No settled trades yet. Markets settle when their match or event ends.</Empty>
              : <ul className="dash-list">{settlements.map(s => (
                <li key={s.marketId}><button className="dash-row" data-testid="dash-settlement" onClick={() => go({ name: 'exchange', id: s.marketId })}>
                  <span className="dash-row-main"><span className="dash-ellipsis">{s.title}</span><span className="small muted">{s.status === 'cancelled' ? 'Market Cancelled' : `Market Settled · ${s.outcome}`}</span></span>
                  <span className="dash-row-num"><span className={`mono ${s.pnl > 0 ? 'pos' : s.pnl < 0 ? 'neg' : ''}`}>{fmtMoneyDelta(s.pnl)}</span></span>
                </button></li>))}</ul>}
          </>}
        </Section>

        <Section title="The Vault" id="vault" action={<button className="btn ghost small" onClick={() => go({ name: 'vault' })}>Open the Vault</button>}>
          {!vs ? <p className="small muted">Opening the Vault…</p> : (
            <div className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 10 }}><span className="mono dash-big" data-testid="dash-vault-earned">{vs.earned}/{vs.total}</span><span className="small muted">collectibles earned</span></div>
              <Bar have={vs.earned} need={vs.total} label="Vault completion" />
              <div className="small"><span className="muted">Latest: </span>{vs.latest ? <><strong>{vs.latest.name}</strong> <span className="muted">· {fmtDate(vs.latest.at)}</span></> : 'Nothing yet. Your first game or lesson can earn one.'}</div>
              {vs.next && <div className="small"><span className="muted">Closest: </span><strong>{vs.next.name}</strong> <span className="mono muted">{vs.next.have.toLocaleString('en')}/{vs.next.need.toLocaleString('en')}</span><Bar have={vs.next.have} need={vs.next.need} label={`${vs.next.name} progress`} /></div>}
            </div>
          )}
        </Section>

        <Section title="The Grimoire" id="grimoire" action={<button className="btn ghost small" data-testid="dash-plan" onClick={() => go({ name: 'academy' })}>Today’s Plan</button>}>
          {!grim ? <p className="small muted">Loading your lessons…</p> : (
            <div className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 10 }}><span className="mono dash-big" data-testid="dash-grim-complete">{grim.complete}/{grim.total}</span><span className="small muted">chapters complete</span></div>
              <Bar have={grim.complete} need={grim.total} label="Grimoire chapters complete" />
              <div className="small" data-testid="dash-grim-due">{grim.due ? `${grim.due} review${grim.due === 1 ? '' : 's'} due today` : 'No reviews due today'}</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {grim.next && <button className="btn small primary" onClick={() => go({ name: 'grimoire', path: grim.next!.id })}>{grim.started ? 'Continue' : 'Start'}: {grim.next.title}</button>}
                {grim.due > 0 && <button className="btn small" onClick={() => go({ name: 'grimoire', path: 'review' })}>Start Review</button>}
                <button className="btn small ghost" onClick={() => go({ name: 'grimoire' })}>Open the Grimoire</button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
