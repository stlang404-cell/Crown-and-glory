import { scrollRegion } from './scrollRegion';
import { useEffect, useState } from 'react';
import { NeedsFederation } from './NeedsFederation';
import { useApp, useServices } from './App';
import { ClubEditor } from './ClubEditor';
import { CosmeticsShop } from './Cosmetics';
import { Emblem } from './Emblem';
import { financialEmblem } from '../heraldry/catalog';
import { fmtCrowns, MICRO } from '../exchange/ledger';
import type { Journal } from '../exchange/ledger';
import { wealthPrestige } from '../economy/wealth';
import { ASSETS, assetValue, prestige, withWealthPrestige, RECOVERY_THRESHOLD, ECONOMY_ID, CLUB_LEVELS, clubLevel, CONTRACT_SHARE } from '../economy/economy';
import type { FederationService } from '../app/federation';
import { statusLabel } from './ExchangeScreen';
import { exchangeApi } from '../exchange/api';
import { fmtMoneyDelta } from '../exchange/ledger';
import { categoryOf } from '../economy/stats';
import { AdministrationPanel, EstatesPanel, FacilitiesPanel, LifetimeStatsPanel, SponsorshipPanel } from './WealthPanels';


function NetWorthChart({ points }: { points: { netWorth: number; cash: number; season: number; round: number }[] }) {
  const W = 600, H = 150;
  if (points.length < 2) return <div className="small muted">The chart starts after your next transaction or round.</div>;
  const max = Math.max(...points.map(p => p.netWorth), 1), min = Math.min(0, ...points.map(p => p.cash));
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * (H - 10) - 5;
  const line = (k: 'netWorth' | 'cash') => points.map((p, i) => `${(i / (points.length - 1)) * W},${y(p[k])}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Net worth history: ${fmtCrowns(points[0].netWorth, 0)} to ${fmtCrowns(points[points.length - 1].netWorth, 0)}`}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} style={{ stroke: 'var(--chart-grid)' }} />
      <polyline points={line('cash')} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={1.5} strokeDasharray="4 3" />
      <polyline points={line('netWorth')} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
    </svg>
  );
}

export function playerPrestige(fed: FederationService, bestRating: number | null) {
  const st = fed.state!;
  const h = st.world.player.history;
  let promotions = 0;
  const divs = [...h.map(x => x.division), st.world.player.division];
  for (let i = 1; i < divs.length; i++) if (divs[i] < divs[i - 1]) promotions++;
  const fin = fed.finance();
  const wp = wealthPrestige(fed.wealthState());
  const base = prestige({ titles: st.world.player.titles, promotions, bestRating, podiums: h.filter(x => x.rank <= 3).length }, { netWorth: fin.netWorth, peakNetWorth: fin.peak, realizedTrading: fin.realized, assets: fin.owned.length });
  return withWealthPrestige(base, wp);
}

export function PrestigeLadders({ bestRating }: { bestRating: number | null }) {
  const services = useServices();
  if (!services.fed.ready) return null;
  const p = playerPrestige(services.fed, bestRating);
  return (
    <div className="grid-2" data-testid="prestige">
      <div className="panel">
        <div className="panel-title"><h2 className="h3" style={{ margin: 0 }}>Chess Prestige</h2><span className="chip gold">{p.chessTier} · {p.chess}</span></div>
        <ul className="small">{p.chessBasis.length ? p.chessBasis.map((b, i) => <li key={i}>{b}</li>) : <li className="muted">Earned only through results: titles, promotions, podiums and established rating.</li>}</ul>
      </div>
      <div className="panel">
        <div className="panel-title"><h2 style={{ margin: 0 }} className="h3 row"><Emblem spec={financialEmblem(p.financialTier)} size="md" title={`Financial Prestige: ${p.financialTier}`} /> Financial Prestige</h2><span className="chip info">{p.financialTier} · {p.financial}</span></div>
        <ul className="small">{p.financialBasis.map((b, i) => <li key={i}>{b}</li>)}</ul>
        <div className="small muted">Money never buys chess prestige or titles.</div>
      </div>
    </div>
  );
}

export function FinanceScreen() {
  const services = useServices();
  const fed = services.fed;
  const [journal, setJournal] = useState<Journal[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => { if (fed.ready) fed.playerJournal(Infinity).then(setJournal); }, [services.revision]);
  if (!fed.ready) return <NeedsFederation title="Finance" />;
  const st = fed.state!;
  const fin = fed.finance();
  const byKind = new Map<string, number>();
  for (const j of journal) { const amt = j.lines.filter(l => l.account === 'player:cash').reduce((s, l) => s + l.amount, 0); const c = categoryOf(j.kind); const k = c.cls === 'exchange' ? 'Exchange (net)' : c.label; byKind.set(k, (byKind.get(k) ?? 0) + amt); }
  const act = async (label: string, fn: () => Promise<void>) => {
    setMsg(null); setConfirm(null);
    try { await fn(); setMsg({ kind: 'ok', text: label }); } catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); }
  };
  const owned = new Map(fin.owned.map(a => [a.typeId, a]));
  return (
    <div>
      <h1>Finance</h1>
      <div className="small muted" style={{ marginBottom: 12 }}>All money is fictional dollars ($) with no real-world value.</div>
      {msg && <div className={`notice ${msg.kind === 'warn' ? 'warn' : ''}`} role="status" style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div className="panel" data-testid="networth">
        <div className="row" style={{ gap: 28, flexWrap: 'wrap' }}>
          <div className="stat"><span className="v">{fmtCrowns(fin.netWorth, 0)}</span><span className="k">Net Worth</span></div>
          <div className="stat"><span className="v">{fmtCrowns(fin.cash, 0)}</span><span className="k">Cash</span></div>
          <div className="stat"><span className="v">{fmtCrowns(fin.assets, 0)}</span><span className="k">Assets</span></div>
          <div className="stat"><span className="v">{fmtCrowns(fin.positions, 0)}</span><span className="k">Open Positions</span></div>
          <div className="stat"><span className="v" data-testid="liabilities">{fmtCrowns(fin.liabilities, 0)}</span><span className="k">Liabilities</span></div>
          <div className="stat"><span className="v">{fmtCrowns(fin.peak, 0)}</span><span className="k">Peak Net Worth</span></div>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>Net worth is your cash, plus your assets, plus what your open positions would sell for now, minus what you owe (only the recovery loan, if you took it).</div>
        <NetWorthChart points={st.finance.points} />
        <div className="small muted">Solid line: net worth · dashed line: cash.</div>
        <details className="small muted"><summary>Details</summary>Net worth = cash + asset book value (refundable bond + resale price) + open positions at their sell-now value after fees (closed, unsettled markets at the 1/3 cancellation refund) − liabilities (the outstanding recovery loan, if any). Every figure is read from the double-entry ledger ({ECONOMY_ID}) · {st.finance.points.length} snapshots.</details>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h2 className="h3">Income and Spending</h2>
          <table className="small"><tbody>
            {[...byKind].sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><td>{k}</td><td className={`mono ${v >= 0 ? 'pos' : 'neg'}`}>{v >= 0 ? '+' : ''}{fmtCrowns(v)}</td></tr>)}
          </tbody></table>
          <div className="small" style={{ marginTop: 8 }}>Exchange: realised {fmtCrowns(fin.realized)} · unrealised {fmtCrowns(fin.unrealized)} · fees paid {fmtCrowns(fin.fees)}</div>
          {fin.cash < RECOVERY_THRESHOLD && <div className="notice" style={{ marginTop: 8 }}>Low on cash? Below {fmtCrowns(RECOVERY_THRESHOLD, 0)} you get one free recovery voucher per season for the Challenger Open entry. You can also sell assets, and prizes and sponsorships keep coming from your results.</div>}
        </div>
        <PortfolioPanel />
      </div>
      <AdministrationPanel />
      <LifetimeStatsPanel journals={journal} />
      <Institutions />
      <div className="grid-2" style={{ marginTop: 14 }}><FacilitiesPanel /><SponsorshipPanel /></div>
      <EstatesPanel />
      <CosmeticsShop />
      <div className="panel" style={{ marginTop: 14 }} data-testid="assets">
        <h2 className="h3">Assets</h2>
        <div className="grid-2">
          {ASSETS.map(a => {
            const o = owned.get(a.id);
            return (
              <div key={a.id} className="panel stack" style={{ background: 'transparent', borderColor: o ? 'var(--accent)' : undefined }}>
                <div className="row"><strong>{a.name}</strong><span className="spacer" />{o ? <span className={`chip ${o.suspended ? 'neg' : 'pos'}`}>{o.suspended ? 'Suspended · Upkeep Unpaid' : 'Owned'}</span> : <span className="chip">{fmtCrowns(a.price, 0)}</span>}</div>
                <div className="small">{a.effect}</div>
                <div className="small muted">Price {fmtCrowns(a.price, 0)}{a.bond ? ` (includes a ${fmtCrowns(a.bond, 0)} refundable bond)` : ''} · resale {fmtCrowns(a.resale, 0)} · counts {fmtCrowns(assetValue(a), 0)} toward net worth · {a.upkeep ? `upkeep ${fmtCrowns(a.upkeep, 0)} per season` : 'no upkeep'}</div>
                {o ? (
                  confirm === a.id
                    ? <div className="row"><button className="btn danger small" onClick={() => act(`Sold ${a.name}.`, () => fed.sellAsset(o.id))}>Confirm: Receive {fmtCrowns(assetValue(a), 0)}</button><button className="btn small" onClick={() => setConfirm(null)}>Keep</button></div>
                    : <button className="btn small" disabled={services.readOnly} onClick={() => setConfirm(a.id)}>{a.kind === 'club' ? 'Close Club' : 'Sell'}</button>
                ) : confirm === a.id
                  ? <div className="row"><button className="btn primary small" data-testid={`confirm-buy-${a.id}`} onClick={() => act(`Bought ${a.name}.`, () => fed.buyAsset(a.id))}>Confirm: Pay {fmtCrowns(a.price, 0)}</button><button className="btn small" onClick={() => setConfirm(null)}>Cancel</button></div>
                  : <button className="btn small" data-testid={`buy-${a.id}`} disabled={services.readOnly || fin.cash < a.price} onClick={() => setConfirm(a.id)}>Buy</button>}
              </div>
            );
          })}
        </div>
        <div className="small muted">Upkeep is charged at season end. If you can't cover it, the asset is suspended — its effect stops and it leaves your net worth — until you pay. You never go into debt.</div>
      </div>
      <div style={{ marginTop: 14 }}><PrestigeLadders bestRating={null} /></div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h2 className="h3">Cash Ledger</h2>
        <div style={{ maxHeight: 360, overflow: 'auto' }} ref={scrollRegion('Cash ledger')}>
          <table className="small">
            <thead><tr><th>When</th><th>Entry</th><th>Amount</th></tr></thead>
            <tbody>{journal.slice(0, 200).map(j => { const amt = j.lines.filter(l => l.account === 'player:cash').reduce((s, l) => s + l.amount, 0); return <tr key={j.id}><td className="mono">{j.season ? `S${j.season}${j.round ? ` R${j.round}` : ''}` : j.at.slice(0, 10)}</td><td>{j.memo}</td><td className={`mono ${amt >= 0 ? 'pos' : 'neg'}`}>{amt >= 0 ? '+' : ''}{fmtCrowns(amt)}</td></tr>; })}</tbody>
          </table>
        </div>
        <details className="small muted"><summary>Details</summary>Each entry is a balanced double-entry journal in whole micro-dollars ({MICRO.toLocaleString('en')} µ = $1); entries are idempotent and never edited.</details>
      </div>
    </div>
  );
}

/** Open positions with cost basis, exit value, unrealised P&L and the amount at risk (src/exchange/portfolio.ts). */
function PortfolioPanel() {
  const services = useServices();
  const { go } = useApp();
  const api = exchangeApi(services.fed, services.readOnly);
  const rows = api.positions().filter(x => (x.market.status === 'open' || x.market.status === 'closed') && x.view.holdings.length);
  const sum = api.pnl();
  const sign = (x: number) => <span className={`mono ${x > 0 ? 'pos' : x < 0 ? 'neg' : ''}`}>{fmtMoneyDelta(x)}</span>;
  return (
    <div className="panel" data-testid="portfolio">
      <h2 className="h3">Open Positions</h2>
      {rows.length === 0 ? <p className="small muted">No open positions. <button className="btn ghost small" onClick={() => go({ name: 'exchange' })}>Go to Exchange</button></p> : (
        <div style={{ overflowX: 'auto' }} ref={scrollRegion('Open positions')}>
          <table className="small"><thead><tr><th>Market</th><th>Holding</th><th>Cost Basis</th><th>Sell Now</th><th>Unrealised</th><th>At Risk</th></tr></thead>
            <tbody>{rows.map(({ market: m, view: v }) => (
              <tr key={m.id} className="clickable" onClick={() => go({ name: 'exchange', id: m.id })}>
                <td>{m.title}<div className="muted">{statusLabel(m.status)}{services.fed.suspension(m.id) ? ' · suspended' : ''}</div></td>
                <td>{v.holdings.map(h => `${h.shares} × ${h.label}`).join(', ')}</td>
                <td className="mono">{v.openBasis === null ? '—' : fmtCrowns(v.openBasis)}</td>
                <td className="mono">{m.status === 'open' ? fmtCrowns(v.exitValue) : 'awaiting result'}</td>
                <td>{m.status === 'open' && v.unrealised !== null ? sign(v.unrealised) : '—'}</td>
                <td className="mono">{fmtCrowns(v.atRisk)}</td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
      <div className="small" style={{ marginTop: 6 }}>Realised {sign(sum.realised)} · unrealised {sign(sum.unrealised)} · awaiting settlement {fmtCrowns(sum.pending)} · at risk {fmtCrowns(sum.atRisk)}{sum.legacy ? ` · ${sum.legacy} older position${sum.legacy === 1 ? '' : 's'} without per-outcome cost basis (net ${fmtMoneyDelta(sum.legacyNet)})` : ''}</div>
      <details className="small muted"><summary>Details</summary>Cost basis is the average cost of the shares you still hold, including buy fees. Unrealised = what selling now would return after fees − cost basis. At risk = the most the position can still lose from here. Realised + unrealised = sell-now value + received − paid, exactly.</details>
    </div>
  );
}

/** Club management: level, upgrades, sponsorship contracts, and the (separate) sandbox balance. */
function Institutions() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const st = fed.state!;
  const level = fed.clubLevelOf();
  const L = level ? clubLevel(level) : null;
  const next = level && level < 3 ? CLUB_LEVELS[level] : null;
  const contracts = [...st.contracts.values()].sort((a, b) => (a.status === b.status ? b.signedSeason - a.signedSeason : a.status === 'active' ? -1 : 1));
  const act = async (label: string, fn: () => Promise<void>) => { setMsg(null); setConfirm(false); try { await fn(); setMsg({ kind: 'ok', text: label }); } catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } };
  return (
    <div className="grid-2" style={{ marginTop: 14 }} data-testid="institutions">
      <div className="panel stack">
        <h2 className="h3">Your Club</h2>
        {msg && <div className={`notice small ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div>}
        {!L ? <p className="small">You don't own a club yet. Buy the <strong>Starter Chess Club</strong> below to host a Club Weekend, sign sponsorship contracts and grow it into a Federation Club.</p> : (
          <>
            <div className="row"><span className="chip gold">Level {level}</span><strong>{fed.clubIdentity()?.name ?? L.name}</strong><span className="muted small">{L.name}</span></div>
            <details data-testid="club-identity"><summary className="small"><strong>Club Identity: Name, Colours and Arms</strong></summary><ClubEditor /></details>
            <div className="small">{L.effect} Club Weekend: {L.weekendSize} players · sponsorship slots: {L.contractSlots}{L.sponsorBonus ? ` · sponsor milestones +${L.sponsorBonus * 100}%` : ''}.</div>
            {next ? (
              <div className="panel stack" style={{ background: 'transparent' }}>
                <strong>Upgrade to {next.name}</strong>
                <div className="small">{next.effect}</div>
                <div className="small muted">Costs {fmtCrowns(next.cost, 0)}: {fmtCrowns(next.escrow, 0)} is a refundable deposit (it counts toward net worth and comes back if you close the club) and {fmtCrowns(next.cost - next.escrow, 0)} pays for building work. Upkeep rises by {fmtCrowns(next.extraUpkeep, 0)} per season. Profit isn't guaranteed: income comes only from the attendance, prizes and sponsors your events earn.</div>
                {confirm
                  ? <div className="row"><button className="btn primary small" data-testid="confirm-upgrade" onClick={() => act(`Club upgraded to ${next.name}.`, () => fed.upgradeClub())}>Confirm: Pay {fmtCrowns(next.cost, 0)}</button><button className="btn small" onClick={() => setConfirm(false)}>Cancel</button></div>
                  : <button className="btn small" data-testid="upgrade-club" disabled={services.readOnly || fed.balance('player:cash') < next.cost} onClick={() => setConfirm(true)}>Upgrade Club</button>}
              </div>
            ) : <div className="small muted">Your club is at the highest level.</div>}
          </>
        )}
      </div>
      <div className="panel stack" data-testid="contracts">
        <h2 className="h3">Sponsorship Contracts</h2>
        <div className="small muted">Pay a competitor a stipend each season and receive {CONTRACT_SHARE * 100}% of every prize they win while signed. Sign from a competitor's profile. While you sponsor someone, you can't buy into markets that involve them.</div>
        {contracts.length === 0 ? <p className="small">No contracts yet. <button className="btn ghost small" onClick={() => go({ name: 'competitors' })}>Browse Competitors</button></p> : (
          <table className="small"><thead><tr><th>Competitor</th><th>Stipend</th><th>Paid</th><th>Prize Share</th><th></th></tr></thead>
            <tbody>{contracts.map(c => <tr key={c.id}><td><button className="btn ghost small inline-link" onClick={() => go({ name: 'competitor', id: c.competitorId })}>{fed.name(c.competitorId)}</button><div className="muted">since season {c.signedSeason}{c.status === 'ended' ? ` · ended season ${c.endedSeason}` : ''}</div></td><td className="mono">{fmtCrowns(c.stipend, 0)}/season</td><td className="mono">{fmtCrowns(c.paid, 0)}</td><td className={`mono ${c.earned - c.paid >= 0 ? 'pos' : 'neg'}`}>{fmtCrowns(c.earned, 0)}</td><td>{c.status === 'active' && <button className="btn ghost small" onClick={() => act('Contract released.', () => fed.releaseContract(c.id))}>Release</button>}</td></tr>)}</tbody></table>
        )}
        <h2 className="h3">Sandbox Money</h2>
        <div className="small">Balance <strong className="mono" data-testid="sandbox-balance">{fmtCrowns(fed.sandboxBalance(), 2)}</strong> sandbox dollars for practice markets on your own casual games. Sandbox money is separate: it never counts toward cash, net worth, profit, prestige, ratings or standings.</div>
      </div>
    </div>
  );
}
