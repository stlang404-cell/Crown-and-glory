import { useMemo, useState } from 'react';
import { useApp, useServices } from './App';
import { Portrait } from './Portrait';
import { REGION_NAMES, divisionLabel, PLAYER_ID, LEAGUE_ROUNDS, SWISS_ROUNDS, CHAMPIONSHIP_ROUNDS, CLUB_ROUNDS, ROUNDS_PER_SEASON, DIVISIONS, LEAGUE_EVENT } from '../federation/model';
import { leagueTable, swissTable, swissEventFor } from '../federation/world';
import { gamesOf } from '../federation/driver';
import { eventName } from '../app/federation';
import { prices } from '../exchange/lmsr';
import { fmtCrowns, MICRO } from '../exchange/ledger';
import { CHALLENGER_FEE, RECOVERY_THRESHOLD } from '../economy/economy';

export function Insignia({ division, size = 28 }: { division: number; size?: number }) {
  // Division colours are theme tokens (--ins-1 … --ins-8 in themes.css).
  const c = { fill: `var(--ins-${((division - 1) % 8) + 1})` };
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-label={divisionLabel(division)}>
      <rect x="2" y="1" width="8" height="8" style={c} /><rect x="3" y="9" width="6" height="1" style={c} /><rect x="4" y="10" width="4" height="1" style={c} />
      <rect x="3" y="2" width="6" height="6" style={{ fill: 'var(--ins-ink)' }} />
      {Array.from({ length: Math.max(1, 9 - division) }).map((_, i) => <rect key={i} x={3 + (i % 3) * 2} y={3 + Math.floor(i / 3) * 2} width="1" height="1" style={c} />)}
    </svg>
  );
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
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmForfeit, setConfirmForfeit] = useState<string | null>(null);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setMsg(null);
    try { await fn(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };

  if (!fed.ready) {
    return (
      <div>
        <h1>The Six-Square Federation</h1>
        <div className="panel stack" style={{ maxWidth: 760 }}>
          <p>Found your federation: <strong>2,048 AI competitors</strong> in 16 regions × 8 divisions, each with a persistent identity, hidden playing strength, public Glicko-2 rating, career and titles. You join the Open Division (division 8) of your home region with a 1,000 ₵ starting grant (fictional, non-redeemable).</p>
          <p className="small muted">Every season: a 15-round league, the Federation Open and Challenger Open (Swiss), the Crown Championship (16-player knockout) and, if you own a club, a Club Weekend. Your league games are real rated games; AI-vs-AI results are drawn from a model fitted on engine games, except featured matches, which the engine plays move by move.</p>
          <label className="small">Home region{' '}
            <select value={region} onChange={e => setRegion(+e.target.value)}>{REGION_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
          </label>
          <button className="btn primary" disabled={!!busy || services.readOnly} onClick={() => act('create', () => fed.create(region))}>{busy ? 'Founding the federation…' : 'Found the federation'}</button>
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
  const featured = fed.featuredFixtures();
  const myEvent = swissEventFor(w.player.division);
  const mySwiss = st.plan.swiss.find(s => s.event === (myEvent ?? 'challenger'))!;
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
        <button className="btn small" data-testid="news-link" onClick={() => go({ name: 'news' })}>News &amp; history</button>
      </div>
      {msg && <div className="notice warn" role="alert" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="grid-2">
        <div className="panel stack" data-testid="my-fixtures">
          <h3>Your fixtures this round</h3>
          {mine.length === 0 ? <p className="small muted">{w.round > LEAGUE_ROUNDS ? 'No games for you this round (league finished).' : 'All your games this round are done.'}</p> : mine.map(f => {
            const opp = f.white === PLAYER_ID ? f.black : f.white;
            const c = st.competitors.get(opp)!;
            return (
              <div key={f.id} className="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <Portrait seed={c.portraitSeed} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'competitor', id: opp })}>{c.name}</button>
                  <div className="small muted">{eventName(f.event)}{f.stage ? ` · ${f.stage}` : ''} · you play {f.white === PLAYER_ID ? 'White' : 'Black'} · {Math.round(c.rating)} ±{Math.round(c.rd)} · rapid 5+3, rated</div>
                </div>
                <button className="btn primary small" disabled={!!busy} data-testid="play-fixture" onClick={() => act('play', async () => {
                  const pr = await services.db.ratingState('rapid');
                  const g = await fed.playerGameFor(f.id, { rating: pr.rating, rd: pr.rd });
                  if (!(await services.db.getGame(g.id))) await services.saveGame(g);
                  go({ name: 'match', gameId: g.id });
                })}>Play</button>
                {fed.ownsAsset('training') && <button className="btn small" data-testid="spar-fixture" disabled={!!busy} title="Unrated practice against this opponent's exact engine profile (Training Hall)" onClick={() => act('spar', async () => {
                  const g = await fed.sparringGameFor(f.id, f.white === PLAYER_ID ? 'white' : 'black');
                  await services.saveGame(g);
                  go({ name: 'match', gameId: g.id });
                })}>Spar</button>}
                {confirmForfeit === f.id
                  ? <><button className="btn danger small" onClick={() => act('forfeit', () => fed.forfeit(f.id)).then(() => setConfirmForfeit(null))}>Confirm forfeit</button><button className="btn small" onClick={() => setConfirmForfeit(null)}>Keep</button></>
                  : <button className="btn ghost small" onClick={() => setConfirmForfeit(f.id)}>Forfeit</button>}
              </div>
            );
          })}
          <button className="btn primary" data-testid="advance-round" disabled={!!busy || mine.length > 0 || services.readOnly} onClick={() => act('advance', () => fed.advanceRound())}>
            {busy === 'advance' ? 'Advancing… (featured games are being played)' : `Advance to round ${w.round === ROUNDS_PER_SEASON ? `1 of season ${w.season + 1}` : w.round + 1}`}
          </button>
          <div className="small muted">Advancing resolves all {((st.rounds.get(`${w.season}:${w.round}`)?.abstract.length) ?? 0).toLocaleString('en')} background games of the round (summary results, not replayable), plays any unwatched featured games on the engine, updates ratings and standings, and settles markets.</div>
        </div>
        <div className="panel stack" data-testid="featured">
          <h3>Featured matches · Crown Exchange</h3>
          {featured.length === 0 ? <p className="small muted">No featured matches this round.</p> : featured.map(f => {
            const m = fed.marketFor(f.id);
            const p = m ? prices(m.q, m.b) : null;
            return (
              <div key={f.id} className="stack" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <div className="row"><strong>{fed.name(f.white)}</strong><span className="muted">vs</span><strong>{fed.name(f.black)}</strong><span className="spacer" /><span className="chip">{eventName(f.event)}</span></div>
                <div className="row small">
                  {p && <span className="mono">W {(p[0] * 100).toFixed(0)}% · D {(p[1] * 100).toFixed(0)}% · B {(p[2] * 100).toFixed(0)}%</span>}
                  <span className={`chip ${m?.status === 'open' ? 'pos' : ''}`}>{f.result !== null ? `final: ${f.result === 1 ? '1–0' : f.result === 0 ? '0–1' : '½–½'}` : m?.status === 'open' ? 'market open' : 'closed'}</span>
                  <span className="spacer" />
                  {m?.status === 'open' && <button className="btn small" onClick={() => go({ name: 'exchange', id: m.id })}>Trade</button>}
                  <button className="btn small" onClick={() => go({ name: 'watch', id: f.id })}>{f.result === null ? 'Watch live' : 'Replay'}</button>
                </div>
              </div>
            );
          })}
          <div className="small muted">Markets close the moment a match starts; the result does not exist before that. Official markets never include your own games.</div>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="panel-title"><h3 style={{ margin: 0 }}>{myCircuit ? `${divisionLabel(myCircuit.division)} · ${REGION_NAMES[myCircuit.region]}` : 'Your division'}</h3><button className="btn ghost small" onClick={() => go({ name: 'standings' })}>All divisions</button></div>
          <LeagueTableView rows={table} division={myCircuit?.division ?? DIVISIONS} />
        </div>
        <div className="panel stack">
          <h3>Season calendar</h3>
          <div className="small">League: rounds 1–{LEAGUE_ROUNDS} · Federation Open & Challenger Open (Swiss): rounds {SWISS_ROUNDS[0]}–{SWISS_ROUNDS[SWISS_ROUNDS.length - 1]} · Club Weekend (club owners): rounds {CLUB_ROUNDS.join('–')} · Crown Championship: rounds {CHAMPIONSHIP_ROUNDS[0]}–{CHAMPIONSHIP_ROUNDS[CHAMPIONSHIP_ROUNDS.length - 1]} · Promotion/relegation at season end (top/bottom two).</div>
          <div className="panel" style={{ background: 'transparent' }}>
            <strong>{mySwiss.name}</strong> — {myEvent === 'open' ? 'divisions 2–4, 32 players, five Swiss rounds, prizes 1,500 ₵; the top 8 qualify for the Crown Championship' : 'divisions 5–8, 32 players, five Swiss rounds, prizes 600 ₵'}.
            <div className="small muted">Entry {fmtCrowns(CHALLENGER_FEE, 0)}{cash < RECOVERY_THRESHOLD ? ' · recovery voucher available (one per season)' : ''}. Registration closes before round {SWISS_ROUNDS[0]}.{myEvent === 'open' ? ' Entering cancels the Open champion market at 1/32 per share (published conflict rule).' : ''}</div>
            {registered ? <span className="chip pos">Registered</span> : w.round < SWISS_ROUNDS[0] && myEvent ? (
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn small" disabled={!!busy || cash < CHALLENGER_FEE} onClick={() => act('reg', () => fed.registerChallenger(false))}>Register ({fmtCrowns(CHALLENGER_FEE, 0)})</button>
                {cash < RECOVERY_THRESHOLD && <button className="btn small" disabled={!!busy || st.extra.vouchers.includes(w.season)} onClick={() => act('reg', () => fed.registerChallenger(true))}>Use recovery voucher</button>}
              </div>
            ) : <span className="chip">{!myEvent ? 'Crown Division: qualify through your league' : 'Registration closed'}</span>}
          </div>
          {w.player.titles.length > 0 && <div><strong>Your titles</strong><ul className="small">{w.player.titles.map((t, i) => <li key={i}>{t.title}</li>)}</ul></div>}
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
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr><th>#</th><th>Competitor</th><th>Pts</th><th className="hide-sm">P</th><th className="hide-sm">W-D-L</th><th className="hide-sm">SB</th><th>Rating</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const promo = division > 1 && i < 2, releg = division < DIVISIONS && i >= rows.length - 2;
            const c = fed.state!.competitors.get(r.id);
            return (
              <tr key={r.id} className={r.id === PLAYER_ID ? '' : 'clickable'} onClick={() => r.id !== PLAYER_ID && go({ name: 'competitor', id: r.id })} style={{ background: r.id === PLAYER_ID ? 'var(--accent-soft)' : undefined, boxShadow: promo ? 'inset 3px 0 0 var(--positive)' : releg ? 'inset 3px 0 0 var(--negative)' : undefined }}>
                <td>{i + 1}</td><td>{r.id === PLAYER_ID ? <strong>You</strong> : c?.name}</td><td>{r.points}</td><td className="hide-sm">{r.played}</td><td className="hide-sm">{r.w}-{r.d}-{r.l}</td><td className="hide-sm">{r.sb.toFixed(1)}</td><td>{r.id === PLAYER_ID ? '—' : Math.round(c!.rating)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="small muted" style={{ marginTop: 4 }}>Green edge: promotion zone · red edge: relegation zone. Order: points, head-to-head, Sonneborn–Berger, pre-season seed.</div>
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
  if (!st) return <div className="panel"><p>Found the federation first.</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn ghost small" onClick={() => go({ name: 'world' })}>← Federation</button>
        <h1 style={{ margin: 0 }}>Divisions</h1>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <select value={region} onChange={e => setRegion(+e.target.value)} aria-label="Region">{REGION_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select>
        <div className="seg" role="group" aria-label="Division">{Array.from({ length: DIVISIONS }, (_, i) => i + 1).map(d => <button key={d} aria-pressed={division === d} onClick={() => setDivision(d)}>{d}</button>)}</div>
      </div>
      <div className="panel">
        <div className="panel-title"><h3 style={{ margin: 0 }} className="row"><Insignia division={division} /> {divisionLabel(division)} · {REGION_NAMES[region]}</h3><span className="chip">Season {st.world.season}</span></div>
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
  if (!st) return <div className="panel"><p>Found the federation first.</p></div>;
  const games = gamesOf(fed.seasonRounds());
  const champ = st.plan.champ;
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
              <div className="panel-title"><h3 style={{ margin: 0 }}>{sw.name}</h3><span className="chip">{sw.rounds.length}/5 rounds</span></div>
              <div className="small muted" style={{ marginBottom: 6 }}>{sw.event === 'open' ? 'Divisions 2–4 · top 8 qualify for the Crown Championship · prizes 1,500 ₵' : 'Divisions 5–8 (+ you if registered) · prizes 600 ₵'} · Swiss pairing without repeats, byes to the lowest player without one · order: points, Buchholz Cut-1, Buchholz, SB, seed.</div>
              <div style={{ maxHeight: 340, overflow: 'auto' }}>
                <table><thead><tr><th>#</th><th>Player</th><th>Pts</th><th className="hide-sm">BH-1</th></tr></thead>
                  <tbody>{rows.slice(0, 32).map((r, i) => <tr key={r.id} className="clickable" onClick={() => r.id !== PLAYER_ID && go({ name: 'competitor', id: r.id })} style={{ background: r.id === PLAYER_ID ? 'var(--accent-soft)' : undefined }}><td>{i + 1}</td><td>{fed.name(r.id)}</td><td>{r.points}</td><td className="hide-sm">{r.buchholzCut1}</td></tr>)}</tbody></table>
              </div>
              {sw.rounds.some(r => r.repeats > 0) && <div className="small notice warn">A pairing round required a rematch (no repeat-free pairing existed).</div>}
            </div>
          );
        })}
      </div>
      <div className="panel" style={{ marginTop: 14 }} data-testid="championship">
        <div className="panel-title"><h3 style={{ margin: 0 }}>🏆 Crown Championship</h3><span className="chip gold">8,000 ₵ prize fund</span></div>
        {!champ ? <p className="small muted">The 16-player bracket is drawn after league round {LEAGUE_ROUNDS}: the 8 best regional Crown Division winners and the top 8 of the Federation Open. Two-game matches; level → rapid pair → blitz pair → higher seed advances (the final ends in joint champions instead).</p> : (
          <div className="row" style={{ alignItems: 'flex-start', gap: 16, overflowX: 'auto' }}>
            {champ.stages.map(sg => (
              <div key={sg.label} style={{ minWidth: 200 }}>
                <div className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>{sg.label} · round {sg.round}</div>
                {sg.matches.length === 0 ? <div className="small muted">to be decided</div> : sg.matches.map((m, i) => (
                  <div key={i} className="panel" style={{ padding: 8, margin: '6px 0' }}>
                    {[m.a, m.b].map(id => <div key={id} className="row small" style={{ fontWeight: m.winner === id || (m.joint) ? 700 : 400 }}><span>({m.a === id ? m.seedA : m.seedB}) {fed.name(id)}</span><span className="spacer" /><span className="mono">{m.games.filter(g => g.result !== null).reduce((s, g) => s + (g.white === id ? g.result! : g.black === id ? 1 - g.result! : 0), 0)}</span></div>)}
                    {m.decidedBy && <div className="small muted">{m.joint ? 'Joint champions' : `decided by ${m.decidedBy}`}</div>}
                  </div>
                ))}
              </div>
            ))}
            {champ.champions.length > 0 && <div className="panel" style={{ minWidth: 180, borderColor: 'var(--accent)' }}><div style={{ fontSize: 40 }}>🏆</div><strong>{champ.champions.map(id => fed.name(id)).join(' & ')}</strong><div className="small muted">{champ.champions.length > 1 ? 'Joint Crown Champions' : 'Crown Champion'} · Season {st.world.season}</div></div>}
          </div>
        )}
      </div>
      {st.plan.club && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3>Club Weekend</h3>
          {st.plan.club.stages.map(sg => <div key={sg.label} className="small"><strong>{sg.label}</strong>: {sg.matches.map((m, i) => <span key={i}>{fed.name(m.a)} vs {fed.name(m.b)}{m.winner ? ` → ${fed.name(m.winner)}` : ''}; </span>)}</div>)}
        </div>
      )}
      <HallOfChampions />
    </div>
  );
}

function HallOfChampions() {
  const services = useServices();
  const fed = services.fed;
  const champs: { season: number; title: string; name: string }[] = [];
  for (const c of fed.state!.competitors.values()) for (const t of c.titles) if (t.title.includes('Crown Champion') || t.title.includes('Open winner')) champs.push({ season: t.season, title: t.title, name: c.name });
  for (const t of fed.state!.world.player.titles) if (t.title.includes('Crown Champion') || t.title.includes('Open winner')) champs.push({ season: t.season, title: t.title, name: 'You' });
  if (!champs.length) return null;
  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <h3>Hall of champions</h3>
      <ul className="small">{champs.sort((a, b) => b.season - a.season).map((c, i) => <li key={i}>S{c.season} · {c.title.replace(/ S\d+$/, '')}: <strong>{c.name}</strong></li>)}</ul>
    </div>
  );
}

export { MICRO };
