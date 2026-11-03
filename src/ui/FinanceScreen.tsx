import { useEffect, useState } from 'react';
import { useApp, useServices } from './App';
import { fmtCrowns, MICRO } from '../exchange/ledger';
import type { Journal } from '../exchange/ledger';
import { ASSETS, assetValue, prestige, RECOVERY_THRESHOLD, ECONOMY_ID } from '../economy/economy';
import type { FederationService } from '../app/federation';

const KIND_LABEL: Record<string, string> = {
  prize: 'Prize money', sponsor: 'Sponsorships', 'trade-buy': 'Exchange purchases', 'trade-sell': 'Exchange sales', 'market-settle': 'Exchange settlements', 'market-cancel': 'Exchange cancellations',
  'asset-purchase': 'Asset purchases', 'asset-sale': 'Asset sales', upkeep: 'Upkeep', 'entry-fee': 'Entry fees', 'recovery-voucher': 'Recovery vouchers', mint: 'Starting grant', grant: 'Starting grant', 'club-hosting': 'Club Weekend hosting', 'club-attendance': 'Club Weekend attendance',
};

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
  return prestige({ titles: st.world.player.titles, promotions, bestRating, podiums: h.filter(x => x.rank <= 3).length }, { netWorth: fin.netWorth, peakNetWorth: fin.peak, realizedTrading: fin.realized, assets: fin.owned.length });
}

export function PrestigeLadders({ bestRating }: { bestRating: number | null }) {
  const services = useServices();
  if (!services.fed.ready) return null;
  const p = playerPrestige(services.fed, bestRating);
  return (
    <div className="grid-2" data-testid="prestige">
      <div className="panel">
        <div className="panel-title"><h3 style={{ margin: 0 }}>Chess prestige</h3><span className="chip gold">{p.chessTier} · {p.chess}</span></div>
        <ul className="small">{p.chessBasis.length ? p.chessBasis.map((b, i) => <li key={i}>{b}</li>) : <li className="muted">Earned only through results: titles, promotions, podiums and established rating.</li>}</ul>
      </div>
      <div className="panel">
        <div className="panel-title"><h3 style={{ margin: 0 }}>Financial prestige</h3><span className="chip info">{p.financialTier} · {p.financial}</span></div>
        <ul className="small">{p.financialBasis.map((b, i) => <li key={i}>{b}</li>)}</ul>
        <div className="small muted">Separate ladder: money never buys chess prestige or titles.</div>
      </div>
    </div>
  );
}

export function FinanceScreen() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const [journal, setJournal] = useState<Journal[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => { if (fed.ready) fed.playerJournal(400).then(setJournal); }, [services.revision]);
  if (!fed.ready) return <div className="panel"><h1>Finance</h1><p>Found the federation first. You receive a 1,000 ₵ starting grant (fictional).</p><button className="btn" onClick={() => go({ name: 'world' })}>Federation</button></div>;
  const st = fed.state!;
  const fin = fed.finance();
  const byKind = new Map<string, number>();
  for (const j of journal) { const amt = j.lines.filter(l => l.account === 'player:cash').reduce((s, l) => s + l.amount, 0); const k = j.kind === 'trade-buy' || j.kind === 'trade-sell' || j.kind === 'market-settle' || j.kind === 'market-cancel' ? 'exchange' : j.kind; byKind.set(k, (byKind.get(k) ?? 0) + amt); }
  const act = async (label: string, fn: () => Promise<void>) => {
    setMsg(null); setConfirm(null);
    try { await fn(); setMsg({ kind: 'ok', text: label }); } catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); }
  };
  const owned = new Map(fin.owned.map(a => [a.typeId, a]));
  return (
    <div>
      <h1>Finance</h1>
      <div className="small muted" style={{ marginBottom: 12 }}>All money is fictional crowns (₵) with no real-world value. Every figure below is read from the double-entry ledger ({ECONOMY_ID}).</div>
      {msg && <div className={`notice ${msg.kind === 'warn' ? 'warn' : ''}`} role="status" style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div className="panel" data-testid="networth">
        <div className="row" style={{ gap: 28, flexWrap: 'wrap' }}>
          <div className="stat"><span className="v">{fmtCrowns(fin.netWorth, 0)}</span><span className="k">Net worth</span></div>
          <div className="stat"><span className="v">{fmtCrowns(fin.cash, 0)}</span><span className="k">Cash</span></div>
          <div className="stat"><span className="v">{fmtCrowns(fin.assets, 0)}</span><span className="k">Assets (book)</span></div>
          <div className="stat"><span className="v">{fmtCrowns(fin.positions, 0)}</span><span className="k">Open positions</span></div>
          <div className="stat"><span className="v">{fmtCrowns(0, 0)}</span><span className="k">Liabilities</span></div>
          <div className="stat"><span className="v">{fmtCrowns(fin.peak, 0)}</span><span className="k">Peak net worth</span></div>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>Net worth = cash + asset book value (refundable bond + resale price) + open positions at their sell-now value after fees (closed, unsettled markets at the 1/3 cancellation floor) − liabilities (there is no borrowing, so liabilities are always 0).</div>
        <NetWorthChart points={st.finance.points} />
        <div className="small muted">Solid accent line: net worth · dashed: cash · {st.finance.points.length} snapshots.</div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3>Income and spending</h3>
          <table className="small"><tbody>
            {[...byKind].sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><td>{k === 'exchange' ? 'Exchange (net)' : KIND_LABEL[k] ?? k}</td><td className={`mono ${v >= 0 ? 'pos' : 'neg'}`}>{v >= 0 ? '+' : ''}{fmtCrowns(v)}</td></tr>)}
          </tbody></table>
          <div className="small" style={{ marginTop: 8 }}>Exchange: realized {fmtCrowns(fin.realized)} · unrealized {fmtCrowns(fin.unrealized)} · fees paid {fmtCrowns(fin.fees)}</div>
          {fin.cash < RECOVERY_THRESHOLD && <div className="notice" style={{ marginTop: 8 }}>Low on cash? You can never go into debt. Below {fmtCrowns(RECOVERY_THRESHOLD, 0)} a free recovery voucher (one per season) pays the Challenger Open entry, sell assets for their resale value, and league prizes and sponsorships keep coming from chess results.</div>}
        </div>
        <div className="panel">
          <h3>Open positions</h3>
          {fin.myPositions.filter(p => { const m = st.markets.get(p.marketId)!; return (m.status === 'open' || m.status === 'closed') && p.shares.some(x => x); }).length === 0 ? <p className="small muted">None. <button className="btn ghost small" onClick={() => go({ name: 'exchange' })}>Go to the Exchange</button></p> : (
            <ul className="small">{fin.myPositions.map(p => { const m = st.markets.get(p.marketId)!; if (!(m.status === 'open' || m.status === 'closed') || !p.shares.some(x => x)) return null; return <li key={p.id}><button className="btn ghost small" style={{ padding: 0 }} onClick={() => go({ name: 'exchange', id: m.id })}>{m.title}</button> · W/D/B {p.shares.join('/')} · {m.status}</li>; })}</ul>
          )}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 14 }} data-testid="assets">
        <h3>Assets</h3>
        <div className="grid-2">
          {ASSETS.map(a => {
            const o = owned.get(a.id);
            return (
              <div key={a.id} className="panel stack" style={{ background: 'transparent', borderColor: o ? 'var(--accent)' : undefined }}>
                <div className="row"><strong>{a.name}</strong><span className="spacer" />{o ? <span className={`chip ${o.suspended ? 'neg' : 'pos'}`}>{o.suspended ? 'suspended (upkeep unpaid)' : 'owned'}</span> : <span className="chip">{fmtCrowns(a.price, 0)}</span>}</div>
                <div className="small">{a.effect}</div>
                <div className="small muted">Price {fmtCrowns(a.price, 0)}{a.bond ? ` (incl. ${fmtCrowns(a.bond, 0)} refundable bond)` : ''} · resale {fmtCrowns(a.resale, 0)} · book value {fmtCrowns(assetValue(a), 0)} · upkeep {a.upkeep ? `${fmtCrowns(a.upkeep, 0)} per season` : 'none'}</div>
                {o ? (
                  confirm === a.id
                    ? <div className="row"><button className="btn danger small" onClick={() => act(`Sold ${a.name}.`, () => fed.sellAsset(o.id))}>Confirm: receive {fmtCrowns(assetValue(a), 0)}</button><button className="btn small" onClick={() => setConfirm(null)}>Keep</button></div>
                    : <button className="btn small" disabled={services.readOnly} onClick={() => setConfirm(a.id)}>{a.kind === 'club' ? 'Close club' : 'Sell'}</button>
                ) : confirm === a.id
                  ? <div className="row"><button className="btn primary small" data-testid={`confirm-buy-${a.id}`} onClick={() => act(`Bought ${a.name}.`, () => fed.buyAsset(a.id))}>Confirm: pay {fmtCrowns(a.price, 0)}</button><button className="btn small" onClick={() => setConfirm(null)}>Cancel</button></div>
                  : <button className="btn small" data-testid={`buy-${a.id}`} disabled={services.readOnly || fin.cash < a.price} onClick={() => setConfirm(a.id)}>Buy</button>}
              </div>
            );
          })}
        </div>
        <div className="small muted">Upkeep is charged at season end. If cash cannot cover it, the asset is suspended (its effect stops and it leaves net worth) until you can pay — you never go into debt.</div>
      </div>
      <div style={{ marginTop: 14 }}><PrestigeLadders bestRating={null} /></div>
      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Ledger · your cash account</h3>
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          <table className="small">
            <thead><tr><th>When</th><th>Entry</th><th>Amount</th></tr></thead>
            <tbody>{journal.slice(0, 200).map(j => { const amt = j.lines.filter(l => l.account === 'player:cash').reduce((s, l) => s + l.amount, 0); return <tr key={j.id}><td className="mono">{j.season ? `S${j.season}${j.round ? ` R${j.round}` : ''}` : j.at.slice(0, 10)}</td><td>{j.memo}</td><td className={`mono ${amt >= 0 ? 'pos' : 'neg'}`}>{amt >= 0 ? '+' : ''}{fmtCrowns(amt)}</td></tr>; })}</tbody>
          </table>
        </div>
        <div className="small muted">Each entry is a balanced double-entry journal in whole microcrowns ({MICRO.toLocaleString('en')} µ = 1 ₵); entries are idempotent and never edited.</div>
      </div>
    </div>
  );
}
