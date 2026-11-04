import { scrollRegion } from './scrollRegion';
import { TourHint } from './Onboarding';
import { NeedsFederation } from './NeedsFederation';
import { fmtCareerElo } from '../ratings/display';
import { CompetitorElo } from './CareerElo';
import { useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { Emblem, Trophy } from './Emblem';
import { divisionEmblem, tournamentCrest } from '../heraldry/catalog';
import { collect } from '../app/rivalries';
import { computeRivalry } from '../heraldry/rivalry';
import { FEDERATION_SIZES, newFederationTopology, populationOf, regionNamesOf } from '../federation/model';
import { detectDevice } from '../app/scheduler';
import { LiveNow } from './LiveNow';
import { REGION_NAMES, divisionLabel, PLAYER_ID, LEAGUE_ROUNDS, SWISS_ROUNDS, CHAMPIONSHIP_ROUNDS, CLUB_ROUNDS, ROUNDS_PER_SEASON, DIVISIONS, LEAGUE_EVENT } from '../federation/model';
import { leagueTable, swissTable, swissEventFor } from '../federation/world';
import { gamesOf } from '../federation/driver';
import { RankBadge, TitleBadge } from './RankBadge';
import { currentRank, competitorRank } from '../federation/ranks';
import { eventName } from '../app/federation';
import { prices } from '../exchange/lmsr';
import { fmtCrowns, MICRO } from '../exchange/ledger';
import { CHALLENGER_FEE, RECOVERY_THRESHOLD, CUP_POOL, ZONAL_POOL } from '../economy/economy';
import { Bracket, DeadlineRule, Opportunities, UpcomingMatches } from './CareerPanels';
import { CUP_ROUNDS, RULES_V2, ZONAL_ROUNDS, koTitle, rulesOf, zoneOf } from '../federation/competitions';
import { swissEventsOpenTo } from '../federation/world';

/** League division insignia (crown-heraldry-1 emblem family: one shield shape per division). */
export function Insignia({ division, size = 28 }: { division: number; size?: number }) {
  return <Emblem spec={divisionEmblem(division)} size={size >= 64 ? 'lg' : size >= 32 ? 'md' : 'sm'} title={divisionLabel(division)} />;
}

function phase(round: number): string {
  if (round <= LEAGUE_ROUNDS) return SWISS_ROUNDS.includes(round) ? `League round ${round} · Swiss round ${round - SWISS_ROUNDS[0] + 1}` : `League round ${round}`;
  return `Crown Championship · ${['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'][round - CHAMPIONSHIP_ROUNDS[0]]}`;
}

export function WorldScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [region, setRegion] = useState(0);
  // v0.10: the size of a new federation; the default depends on the device (docs/FEDERATION_SCALE.md §0)
  const [device] = useState(() => detectDevice());
  const [sizeId, setSizeId] = useState(() => newFederationTopology(device).id);
  const size = (FEDERATION_SIZES.find(s => s.topology.id === sizeId) ?? FEDERATION_SIZES[0]).topology;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmForfeit, setConfirmForfeit] = useState<string | null>(null);
  const [confirmAdvance, setConfirmAdvance] = useState(false);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };

  if (!fed.ready) {
    return (
      <div>
        <h1>The Six-Square Federation</h1>
        <TourHint step="federation" />
        <div className="panel stack" style={{ maxWidth: 760 }}>
          <p>Found a federation of <strong>{populationOf(size).toLocaleString('en')} AI competitors</strong> across {size.regions} regions and 8 divisions. You start in the Open Division of your home region with $1,000 (fictional money), at the Circuit Grade of <strong>Commoner III</strong>: climb the 48 steps to High Sovereign I through your results (<a href="#/ranks">rank guide</a>).</p>
          <details className="small"><summary>Details</summary>
            <p>Each season has a 15-round league, the Federation Open and Challenger Open (Swiss), the Crown Championship (16-player knockout), Zonal Championships and Regional Cups (knockouts in rounds 16–19) and, for club owners, a Club Weekend. You enter the same competitions as every AI competitor.</p>
            <p>Every competitor has a lasting identity, a hidden playing strength, a public rating (Glicko-2), a career and titles. Your league games are rated. Other results come from a model fitted on engine games, except featured matches, which the engine plays move by move.</p>
          </details>
          <label className="small">Federation Size{' '}
            <select value={sizeId} onChange={e => { setSizeId(e.target.value); setRegion(0); }} aria-label="Federation Size">
              {FEDERATION_SIZES.map(s => <option key={s.topology.id} value={s.topology.id}>{s.label} · {populationOf(s.topology).toLocaleString('en')} competitors, {s.topology.regions} regions{s.topology.id === newFederationTopology(device).id ? ' (recommended here)' : ''}</option>)}
            </select>
          </label>
          <div className="small muted" data-testid="size-note">{device.mobile
            ? 'Every competitor is persistent. On this device fewer AI games play live at once, and a Grand round takes about a second to advance; choose Standard for the quickest rounds. The size is fixed once founded.'
            : 'Every competitor is persistent; results of the games you do not watch come from the result model, so a larger world costs time only when a round is advanced. The size is fixed once founded.'}</div>
          <label className="small">Home Region{' '}
            <select value={region} onChange={e => setRegion(+e.target.value)}>{regionNamesOf(size).map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
          </label>
          <button className="btn primary" disabled={!!busy || services.readOnly} onClick={() => act('create', () => fed.create(region, undefined, size))}>{busy ? 'Founding the federation…' : 'Found the federation'}</button>
          {msg && <div className="notice warn">{msg}</div>}
        </div>
      </div>
    );
  }
  const st = fed.state!;
  const w = st.world;
  const games = gamesOf(fed.seasonRounds());
  const myCircuit = st.plan.circuits.find(c => c.members.includes(PLAYER_ID));
  const table = myCircuit ? leagueTable(myCircuit, games) : [];
  const mine = fed.playerFixtures();
  const blocking = fed.blockingFixtures();
  const featured = fed.featuredFixtures();
  const myEvent = swissEventsOpenTo(w)[0] ?? swissEventFor(w.player.division);
  const invited = w.player.invite?.season === w.season;
  const mySwiss = st.plan.swiss.find(s => s.event === (myEvent ?? 'challenger'))!;
  const v2 = rulesOf(st.plan) >= RULES_V2;
  const registered = st.plan.swiss.some(s => s.entrants.includes(PLAYER_ID));
  const cash = fed.balance('player:cash');

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Insignia division={w.player.division} size={40} />
        <div>
          <h1 style={{ margin: 0 }}>Season {w.season} · Round {w.round}/{ROUNDS_PER_SEASON}</h1>
          <div className="small muted">{phase(w.round)} · You: {divisionLabel(w.player.division)}, {REGION_NAMES[w.player.region]} · Cash {fmtCrowns(cash, 0)}</div>
        </div>
        <span className="spacer" />
        <button className="btn small" onClick={() => go({ name: 'standings' })}>Divisions</button>
        <button className="btn small" onClick={() => go({ name: 'tournaments' })}>Tournaments</button>
        <button className="btn small" onClick={() => go({ name: 'competitors' })}>Competitors</button>
        <button className="btn small" onClick={() => go({ name: 'population' })}>Population</button>
        <button className="btn small" data-testid="exhibition-link" onClick={() => go({ name: 'exhibition' })}>Exhibition Arena</button>
        <button className="btn small" data-testid="news-link" onClick={() => go({ name: 'news' })}>News &amp; History</button>
        <button className="btn small" onClick={() => go({ name: 'rivals' })}>Rivals</button>
        <button className="btn small" onClick={() => go({ name: 'hall' })}>Hall of Fame</button>
        <button className="btn small" onClick={() => go({ name: 'heraldry' })}>Heraldry</button>
      </div>
      {msg && <div className="notice warn" role="alert" style={{ marginBottom: 12 }}>{msg}</div>}
      <TourHint step="tournament" />
      <div className="grid-2">
        <div className="panel stack" data-testid="my-fixtures">
          <h2 className="h3">Your Fixtures This Round</h2>
          {mine.length === 0 ? <p className="small muted">{w.round > LEAGUE_ROUNDS ? 'No games for you this round. The league has finished.' : 'You have played all your games this round.'}</p> : mine.map(f => {
            const opp = f.white === PLAYER_ID ? f.black : f.white;
            const c = st.competitors.get(opp)!;
            return (
              <div key={f.id} className="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <Portrait seed={c.portraitSeed} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button className="btn ghost small inline-link" onClick={() => go({ name: 'competitor', id: opp })}>{c.name}</button>
                  <div className="small muted">{eventName(f.event)}{f.stage ? ` · ${f.stage}` : ''} · You play {f.white === PLAYER_ID ? 'White' : 'Black'} · {fmtCareerElo(c.rating, { rd: c.rd })} · Rapid 5+3, rated</div>
                  {f.postponedFrom !== undefined && <div className="small"><span className="chip neg" data-testid="postponed-chip">Postponed from round {f.postponedFrom}</span> <span className="muted">Play by the end of round {LEAGUE_ROUNDS}.</span></div>}
                </div>
                <button className="btn primary small" disabled={!!busy} data-testid="play-fixture" onClick={() => act('play', async () => {
                  const pr = await services.db.ratingState('rapid');
                  const g = await fed.playerGameFor(f.id, { rating: pr.rating, rd: pr.rd });
                  if (!(await services.db.getGame(g.id))) await services.saveGame(g);
                  go({ name: 'match', gameId: g.id });
                })}>Play</button>
                {fed.ownsAsset('training') && <button className="btn small" data-testid="spar-fixture" disabled={!!busy} title="Unrated practice against this opponent's playing style (Training Hall)" onClick={() => act('spar', async () => {
                  const g = await fed.sparringGameFor(f.id, f.white === PLAYER_ID ? 'white' : 'black');
                  await services.saveGame(g);
                  go({ name: 'match', gameId: g.id });
                })}>Spar</button>}
                {f.postponedFrom === undefined && !fed.postponeBlocker(f.id) && <button className="btn small" data-testid="postpone-fixture" disabled={!!busy || services.readOnly} title={`Play it later; due by the end of round ${LEAGUE_ROUNDS}`} onClick={() => act('postpone', () => fed.postpone(f.id))}>Postpone</button>}
                {confirmForfeit === f.id
                  ? <><button className="btn danger small" onClick={() => act('forfeit', () => fed.forfeit(f.id)).then(() => setConfirmForfeit(null))}>Confirm Forfeit</button><button className="btn small" onClick={() => setConfirmForfeit(null)}>Keep</button></>
                  : <button className="btn ghost small" onClick={() => setConfirmForfeit(f.id)}>Forfeit</button>}
              </div>
            );
          })}
          <button className="btn primary" data-testid="advance-round" disabled={!!busy || blocking.length > 0 || services.readOnly} onClick={() => act('advance', () => fed.advanceRound())}>
            {busy === 'advance' ? 'Advancing… Playing featured games' : `Advance to Round ${w.round === ROUNDS_PER_SEASON ? `1 of Season ${w.season + 1}` : w.round + 1}`}
          </button>
          {blocking.length > 0 && !services.readOnly && (confirmAdvance
            ? <div className="notice warn small" data-testid="forfeit-confirm">Forfeit {blocking.map(f => `${fed.name(f.white === PLAYER_ID ? f.black : f.white)} (${eventName(f.event)})`).join(', ')}? Each is recorded as a loss with no game and no rating change{blocking.some(f => !f.event.startsWith('league:')) ? '; a forfeited knockout match is lost' : ''}.
                <div className="row" style={{ marginTop: 6 }}><button className="btn danger small" data-testid="forfeit-and-advance" disabled={!!busy} onClick={() => act('advance', () => fed.forfeitAndAdvance()).then(() => setConfirmAdvance(false))}>Forfeit and Advance</button><button className="btn small" onClick={() => setConfirmAdvance(false)}>Keep My Games</button></div></div>
            : <button className="btn ghost small" data-testid="advance-forfeit" onClick={() => setConfirmAdvance(true)}>Advance Without Playing ({blocking.length} forfeit{blocking.length === 1 ? '' : 's'})…</button>)}
          <DeadlineRule />
          <div className="small muted">Advancing plays the round's other {((st.rounds.get(`${w.season}:${w.round}`)?.abstract.length) ?? 0).toLocaleString('en')} games (results only, no replays) and any featured games you haven't watched, then updates ratings and standings and settles markets.</div>
        </div>
        <div className="panel stack" data-testid="featured">
          <h2 className="h3">Featured Matches · Crown Exchange</h2>
          {featured.length === 0 ? <p className="small muted">No featured matches this round.</p> : featured.map(f => {
            const m = fed.marketFor(f.id);
            const p = m ? prices(m.q, m.b) : null;
            return (
              <div key={f.id} className="stack" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <div className="row"><strong>{fed.name(f.white)}</strong><span className="muted">vs</span><strong>{fed.name(f.black)}</strong><span className="spacer" /><span className="chip">{eventName(f.event)}</span></div>
                <div className="row small">
                  {p && <span className="mono">W {(p[0] * 100).toFixed(0)}% · D {(p[1] * 100).toFixed(0)}% · B {(p[2] * 100).toFixed(0)}%</span>}
                  <span className={`chip ${m?.status === 'open' ? 'pos' : ''}`}>{f.result !== null ? `Final: ${f.result === 1 ? '1–0' : f.result === 0 ? '0–1' : '½–½'}` : m?.status === 'open' ? 'Trading Open' : 'Trading Closed'}</span>
                  <span className="spacer" />
                  {m?.status === 'open' && <button className="btn small" onClick={() => go({ name: 'exchange', id: m.id })}>Trade</button>}
                  <button className="btn small" onClick={() => go({ name: 'watch', id: f.id })}>{f.result === null ? 'Watch live' : 'Replay'}</button>
                </div>
              </div>
            );
          })}
          <div className="small muted">Trading closes when a match starts. There are no markets on your own games.</div>
        </div>
      </div>
      <LiveNow />
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="panel-title"><h2 className="h3" style={{ margin: 0 }}>{myCircuit ? `${divisionLabel(myCircuit.division)} · ${REGION_NAMES[myCircuit.region]}` : 'Your Division'}</h2><button className="btn ghost small" onClick={() => go({ name: 'standings' })}>All Divisions</button></div>
          <LeagueTableView rows={table} division={myCircuit?.division ?? DIVISIONS} />
        </div>
        <div className="panel stack">
          <h2 className="h3">Season Calendar</h2>
          <div className="small" data-testid="season-calendar">League: rounds 1–{LEAGUE_ROUNDS} · Federation Open & Challenger Open (Swiss): rounds {SWISS_ROUNDS[0]}–{SWISS_ROUNDS[SWISS_ROUNDS.length - 1]} · Club Weekend (club owners): rounds {CLUB_ROUNDS.join('–')} · Crown Championship: rounds {CHAMPIONSHIP_ROUNDS[0]}–{CHAMPIONSHIP_ROUNDS[CHAMPIONSHIP_ROUNDS.length - 1]}{v2 ? <> · Zonal Championships (Crown Division, {fmtCrowns(ZONAL_POOL, 0)} each): rounds {ZONAL_ROUNDS[0]}–{ZONAL_ROUNDS[ZONAL_ROUNDS.length - 1]} · Regional Cups (division champions, {fmtCrowns(CUP_POOL, 0)} each): rounds {CUP_ROUNDS[0]}–{CUP_ROUNDS[CUP_ROUNDS.length - 1]}</> : null} · At season end, the top two are promoted and the bottom two relegated. Circuit Grade checkpoints: after round 8 and at season end (<a href="#/ranks">rank guide</a>).</div>
          <div className="panel" style={{ background: 'transparent' }}>
            <strong>Your Next Matches</strong>
            <UpcomingMatches limit={5} />
          </div>
          <div className="panel" style={{ background: 'transparent' }}>
            <strong>Qualification · What You Need</strong>
            <Opportunities games={games} />
          </div>
          <div className="panel" style={{ background: 'transparent' }}>
            <strong>{mySwiss.name}</strong> — {myEvent === 'open' ? `Divisions 2–4${v2 ? ' and invited Regional Cup winners' : ''}, 32 players, five Swiss rounds, $1,500 in prizes. The top 8 qualify for the Crown Championship` : 'Divisions 5–8, 32 players, five Swiss rounds, $600 in prizes'}.
            <div className="small muted">{invited && myEvent === 'open' ? `Invited (${w.player.invite!.reason}): free entry` : `Entry ${fmtCrowns(CHALLENGER_FEE, 0)}`}{cash < RECOVERY_THRESHOLD ? ' · Recovery voucher available (one per season)' : ''}. Registration closes before round {SWISS_ROUNDS[0]}.{myEvent === 'open' ? ' Entering cancels the Open champion market; each share pays out 1/32.' : ''}</div>
            {registered ? <span className="chip pos">Registered</span> : w.round < SWISS_ROUNDS[0] && myEvent ? (
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn small" data-testid="register-swiss" disabled={!!busy || (cash < CHALLENGER_FEE && !(invited && myEvent === 'open'))} onClick={() => act('reg', () => fed.registerChallenger(false, myEvent ?? undefined))}>{invited && myEvent === 'open' ? 'Accept Invitation (free)' : `Register (${fmtCrowns(CHALLENGER_FEE, 0)})`}</button>
                {cash < RECOVERY_THRESHOLD && !(invited && myEvent === 'open') && <button className="btn small" disabled={!!busy || st.extra.vouchers.includes(w.season)} onClick={() => act('reg', () => fed.registerChallenger(true, myEvent ?? undefined))}>Use Recovery Voucher</button>}
              </div>
            ) : <span className="chip">{!myEvent ? 'Crown Division: Qualify Through Your League' : 'Registration Closed'}</span>}
          </div>
          {w.player.titles.length > 0 && <div><strong>Your Titles</strong><ul className="small">{w.player.titles.map((t, i) => <li key={i}>{t.title}</li>)}</ul></div>}
        </div>
      </div>
    </div>
  );
}

export function LeagueTableView({ rows, division }: { rows: ReturnType<typeof leagueTable>; division: number }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  return (
    <div style={{ overflowX: 'auto' }} ref={scrollRegion('Standings table')}>
      <table>
        <thead><tr><th>#</th><th>Competitor</th><th>Pts</th><th className="hide-sm">P</th><th className="hide-sm">W–D–L</th><th className="hide-sm">SB</th><th>Career Elo</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const promo = division > 1 && i < 2, releg = division < DIVISIONS && i >= rows.length - 2;
            const c = fed.state!.competitors.get(r.id);
            return (
              <tr key={r.id} className={r.id === PLAYER_ID ? '' : 'clickable'} onClick={() => r.id !== PLAYER_ID && go({ name: 'competitor', id: r.id })} style={{ background: r.id === PLAYER_ID ? 'var(--accent-soft)' : undefined, boxShadow: promo ? 'inset 3px 0 0 var(--positive)' : releg ? 'inset 3px 0 0 var(--negative)' : undefined }}>
                <td>{i + 1}</td><td><span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><RankBadge rank={r.id === PLAYER_ID ? currentRank(fed.state) : competitorRank(c)} compact />{r.id === PLAYER_ID ? <strong>You</strong> : c?.name}<TitleBadge title={r.id === PLAYER_ID ? fed.state!.world.player.fedTitle : c?.fedTitle} abbr plain /></span></td><td>{r.points}</td><td className="hide-sm">{r.played}</td><td className="hide-sm">{r.w}–{r.d}–{r.l}</td><td className="hide-sm">{r.sb.toFixed(1)}</td><td><CompetitorElo id={r.id} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="small muted" style={{ marginTop: 4 }}>A green left edge marks the promotion zone; a red one marks the relegation zone.</div>
      <details className="small"><summary>Details</summary>P: games played. SB: Sonneborn–Berger. Tiebreak order: points, head-to-head, Sonneborn–Berger, pre-season seed.</details>
    </div>
  );
}

export function StandingsScreen() {
  const services = useServices();
  const fed = services.fed;
  const { go } = useApp();
  const st = fed.state;
  const [region, setRegion] = useState(st?.world.player.region ?? 0);
  const [division, setDivision] = useState(st?.world.player.division ?? DIVISIONS);
  const rows = useMemo(() => {
    if (!st) return [];
    const c = st.plan.circuits.find(x => x.region === region && x.division === division)!;
    return leagueTable(c, gamesOf(fed.seasonRounds()).filter(g => g.event === LEAGUE_EVENT(region, division)));
  }, [st, region, division, fed, services.revision]);
  if (!st) return <NeedsFederation />;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0 }}>Divisions</h1>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <select value={region} onChange={e => setRegion(+e.target.value)} aria-label="Region">{regionNamesOf(fed.topology()).map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
        <div className="seg" role="group" aria-label="Division">{Array.from({ length: DIVISIONS }, (_, i) => i + 1).map(d => <button key={d} aria-pressed={division === d} onClick={() => setDivision(d)}>{d}</button>)}</div>
      </div>
      <div className="panel">
        <div className="panel-title"><h2 style={{ margin: 0 }} className="h3 row"><Insignia division={division} /> {divisionLabel(division)} · {REGION_NAMES[region]}</h2><span className="chip">Season {st.world.season}</span></div>
        <LeagueTableView rows={rows} division={division} />
      </div>
    </div>
  );
}

export function TournamentsScreen() {
  const services = useServices();
  const fed = services.fed;
  const { go } = useApp();
  const st = fed.state;
  if (!st) return <NeedsFederation />;
  const games = gamesOf(fed.seasonRounds());
  const champ = st.plan.champ;
  const previewRivalry = (a: string, b: string) => { const d = collect(st, new Set([a])); return computeRivalry(a, b, d.meetings, d.kos, d.finishes, st.world.season, x => fed.name(x)); };
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0 }}>Tournaments · Season {st.world.season}</h1>
      </div>
      <div className="grid-2">
        {st.plan.swiss.map(sw => {
          const rows = swissTable(sw, games);
          return (
            <div key={sw.event} className="panel" data-testid={`swiss-${sw.event}`}>
              <div className="panel-title"><h2 style={{ margin: 0 }} className="h3 row"><Emblem spec={tournamentCrest(sw.event)} size="sm" title={`${sw.name} crest`} /> {sw.name}</h2><span className="chip">{sw.rounds.length}/5 Rounds</span></div>
              <div className="small muted" style={{ marginBottom: 6 }}>{sw.event === 'open' ? 'Divisions 2–4 · Top 8 qualify for the Crown Championship · $1,500 in prizes' : 'Divisions 5–8, plus you if registered · $600 in prizes'}</div>
              <details className="small" style={{ marginBottom: 6 }}><summary>Details</summary>Swiss pairing with no rematches; a bye goes to the lowest-placed player who hasn't had one. BH-1: Buchholz Cut-1. Tiebreak order: points, Buchholz Cut-1, Buchholz, Sonneborn–Berger, seed.</details>
              <div style={{ maxHeight: 340, overflow: 'auto' }} ref={scrollRegion(`${sw.name} standings`)}>
                <table><thead><tr><th>#</th><th>Player</th><th>Pts</th><th className="hide-sm">BH-1</th><th>Elo</th></tr></thead>
                  <tbody>{rows.slice(0, 32).map((r, i) => <tr key={r.id} className="clickable" onClick={() => r.id !== PLAYER_ID && go({ name: 'competitor', id: r.id })} style={{ background: r.id === PLAYER_ID ? 'var(--accent-soft)' : undefined }}><td>{i + 1}</td><td>{fed.name(r.id)}</td><td>{r.points}</td><td className="hide-sm">{r.buchholzCut1}</td><td><CompetitorElo id={r.id} compact /></td></tr>)}</tbody></table>
              </div>
              {sw.rounds.some(r => r.repeats > 0) && <div className="small notice warn">One round needed a rematch because no other pairing was possible.</div>}
            </div>
          );
        })}
      </div>
      <div className="panel" style={{ marginTop: 14 }} data-testid="championship">
        <div className="panel-title"><h2 style={{ margin: 0 }} className="h3 row"><Emblem spec={tournamentCrest('champ')} size="md" title="Crown Championship crest" /> Crown Championship</h2><span className="chip gold">$8,000 Prize Fund</span></div>
        {!champ ? <div className="small muted"><p>The 16-player bracket is drawn after league round {LEAGUE_ROUNDS}: the 8 best regional Crown Division winners and the top 8 of the Federation Open.</p><details><summary>Details</summary>Matches are two games. If level, a rapid pair is played, then a blitz pair, then the higher seed advances. A level final produces joint champions.</details></div> : (
          <div className="row" style={{ alignItems: 'flex-start', gap: 16, overflowX: 'auto' }} ref={scrollRegion('Championship bracket')}>
            {champ.stages.map(sg => (
              <div key={sg.label} style={{ minWidth: 200 }}>
                <div className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>{sg.label} · Round {sg.round}</div>
                {sg.matches.length === 0 ? <div className="small muted">To be decided</div> : sg.matches.map((m, i) => (
                  <div key={i} className="panel" style={{ padding: 8, margin: '6px 0' }}>
                    {[m.a, m.b].map(id => <div key={id} className="row small" style={{ fontWeight: m.winner === id || (m.joint) ? 700 : 400 }}><span>({m.a === id ? m.seedA : m.seedB}) {fed.name(id)} <CompetitorElo id={id} compact className="muted" /></span><span className="spacer" /><span className="mono">{m.games.filter(g => g.result !== null).reduce((s, g) => s + (g.white === id ? g.result! : g.black === id ? 1 - g.result! : 0), 0)}</span></div>)}
                    {m.decidedBy && <div className="small muted">{m.joint ? 'Joint champions' : `Decided by ${m.decidedBy}`}</div>}
                    {(() => { const r = previewRivalry(m.a, m.b); return r && r.meetings > 0 ? <div className="small" data-testid="rivalry-preview"><span className="chip">{r.level}</span> {r.w}–{r.d}–{r.l} in {r.meetings}{r.events[0] ? ` · ${r.events[0].text}` : ''}</div> : null; })()}
                  </div>
                ))}
              </div>
            ))}
            {champ.champions.length > 0 && <div className="panel" style={{ minWidth: 180, borderColor: 'var(--accent)' }}><Trophy kind="grand" size="lg" title="Crown Championship trophy" /><strong>{champ.champions.map(id => fed.name(id)).join(' & ')}</strong><div className="small muted">{champ.champions.length > 1 ? 'Joint Crown Champions' : 'Crown Champion'} · Season {st.world.season}</div></div>}
          </div>
        )}
      </div>
      {st.plan.club && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h2 className="h3">Club Weekend</h2>
          <Bracket ko={st.plan.club} testId="bracket-club" />
        </div>
      )}
      <CupsPanel />
      <HallOfChampions />
    </div>
  );
}

/** crown-competition-2: Zonal Championships and Regional Cups — yours first, any other by selection. */
function CupsPanel() {
  const services = useServices();
  const fed = services.fed;
  const st = fed.state!;
  const cups = st.plan.cups ?? [];
  const regions = fed.topology().regions;
  const mine = cups.find(k => k.qualifiers.includes(PLAYER_ID)) ?? cups.find(k => k.kind === 'zonal' && k.zone === zoneOf(st.world.player.region, regions)) ?? cups.find(k => k.kind === 'cup' && k.region === st.world.player.region) ?? cups[0];
  const [sel, setSel] = useState<string | null>(null);
  if (rulesOf(st.plan) < RULES_V2) return null;
  const ko = cups.find(k => k.name === sel) ?? mine;
  return (
    <div className="panel" style={{ marginTop: 14 }} data-testid="cups">
      <div className="panel-title"><h2 className="h3" style={{ margin: 0 }}>Zonal Championships &amp; Regional Cups</h2>{cups.length > 0 && (
        <select aria-label="Choose an event" value={ko?.name ?? ''} onChange={e => setSel(e.target.value)} style={{ maxWidth: '100%' }}>
          {cups.map(k => <option key={k.name} value={k.name}>{koTitle(k)}{k.qualifiers.includes(PLAYER_ID) ? ' (you)' : ''}</option>)}
        </select>)}</div>
      {!ko ? <div className="small muted"><p>Drawn after league round {LEAGUE_ROUNDS}. <strong>Zonal Championships</strong> (rounds {ZONAL_ROUNDS[0]}–{ZONAL_ROUNDS[ZONAL_ROUNDS.length - 1]}, 16 players): Crown Division finishers of each zone's regions, by finishing rank, except Crown Championship qualifiers; the zonal champion qualifies for next season's Crown Championship. <strong>Regional Cups</strong> (rounds {CUP_ROUNDS[0]}–{CUP_ROUNDS[CUP_ROUNDS.length - 1]}, 8 players): the champions of divisions 2–8 and the Grand Division runner-up; the 8 highest-rated cup winners are invited to next season's Federation Open.</p></div>
        : <><div className="small muted" style={{ marginBottom: 6 }}>{ko.kind === 'zonal' ? `The winner qualifies for next season's Crown Championship · ${fmtCrowns(ZONAL_POOL, 0)} in prizes` : `The 8 highest-rated cup winners are invited to next season's Federation Open · ${fmtCrowns(CUP_POOL, 0)} in prizes`} · two-game matches, then rapid and blitz pairs; still level: the higher seed advances.</div>
          <Bracket ko={ko} testId="bracket-cup" /></>}
    </div>
  );
}

function HallOfChampions() {
  const services = useServices();
  const fed = services.fed;
  const champs: { season: number; title: string; name: string }[] = [];
  const major = (t: string) => t.includes('Crown Champion') || t.includes('Open winner') || t.includes('Zonal Champion');
  for (const c of fed.state!.competitors.values()) for (const t of c.titles) if (major(t.title)) champs.push({ season: t.season, title: t.title, name: c.name });
  // the player's every title (including Regional Cups and league titles): their own record
  for (const t of fed.state!.world.player.titles) champs.push({ season: t.season, title: t.title, name: 'You' });
  if (!champs.length) return null;
  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <h2 className="h3">Hall of Champions</h2>
      <ul className="small">{champs.sort((a, b) => b.season - a.season).map((c, i) => <li key={i}>S{c.season} · {c.title.replace(/ S\d+$/, '')}: <strong>{c.name}</strong></li>)}</ul>
    </div>
  );
}

export { MICRO };
