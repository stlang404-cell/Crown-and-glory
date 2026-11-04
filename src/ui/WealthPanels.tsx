/**
 * Finance → v0.11 wealth panels (crown-wealth-1): administration and recovery, club facilities, event sponsorship,
 * estates and lifetime statistics. Every figure comes from the service (ledger balances and journals); every action
 * is a service command. Fictional money only; nothing here affects strength, ratings, pairings or qualification.
 */
import { useState } from 'react';
import { useServices } from './App';
import { fmtCrowns, type Journal } from '../exchange/ledger';
import { ADMIN, ESTATES, FACILITIES, HARDSHIP, LOAN, SPONSOR, SPONSOR_TIERS, type FacilityId, type SponsorTier } from '../economy/wealth';
import { lifetimeStats } from '../economy/stats';

type Msg = { kind: 'ok' | 'warn'; text: string } | null;
function useAct(): [Msg, (label: string, fn: () => Promise<void>) => Promise<void>] {
  const [msg, setMsg] = useState<Msg>(null);
  return [msg, async (label, fn) => { setMsg(null); try { await fn(); setMsg({ kind: 'ok', text: label }); } catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } }];
}
const Note = ({ msg }: { msg: Msg }) => (msg ? <div className={`notice small ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div> : null);

/** Administration (bankruptcy) state, consequences, restrictions and the path back. */
export function AdministrationPanel() {
  const services = useServices();
  const fed = services.fed;
  const [msg, act] = useAct();
  const w = fed.wealthState();
  const fin = fed.finance();
  const season = fed.state!.world.season;
  if (!w.admin && !w.loan && !w.episodes.length) {
    return (
      <div className="small muted" data-testid="admin-none" style={{ marginTop: 8 }}>
        <details><summary>What happens if money runs out?</summary>
          At a season end, if you can't pay an upkeep bill or your net worth is under {fmtCrowns(ADMIN.netWorthFloor, 0)}, you go into financial administration: estates and club facilities are sold (their deposits come back to you), unpaid tools are sold back, sponsorship contracts end, reputation falls by {ADMIN.reputationHit} and purchases pause. Your games, events and rating are never affected. The way back: prize money, a hardship stipend of {fmtCrowns(HARDSHIP.perGame, 0)} for each federation game you play (up to {HARDSHIP.maxGamesPerSeason} per season) and one recovery loan of {fmtCrowns(LOAN.principal, 0)}.
        </details>
      </div>
    );
  }
  const hard = w.hardship?.season === season ? w.hardship.games : 0;
  return (
    <div className={`panel stack ${w.admin ? 'warn' : ''}`} style={{ marginTop: 14 }} data-testid="administration">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Financial Administration</h3>{w.admin ? <span className="chip neg">In administration since season {w.admin.since}</span> : <span className="chip pos">Solvent</span>}</div>
      <Note msg={msg} />
      {w.admin && (
        <>
          <div className="small"><strong>Why:</strong> {w.admin.reason}.{w.admin.liquidated.length ? ` Sold to cover it: ${w.admin.liquidated.join(', ')}.` : ''}</div>
          <ul className="small">
            <li>Paused: buying assets, facilities, estates and cosmetics, club upgrades, contracts and event sponsorship. Each Exchange purchase is limited to {fmtCrowns(ADMIN.exchangeBuyCap, 0)}.</li>
            <li>Never paused: your games, every Federation event, your rating and the Challenger voucher.</li>
            <li>Hardship stipend: {fmtCrowns(HARDSHIP.perGame, 0)} per federation game you play · this season {hard}/{HARDSHIP.maxGamesPerSeason}.</li>
            <li>You recover at a season end once your net worth is at least {fmtCrowns(ADMIN.exitNetWorth, 0)} (now {fmtCrowns(fin.netWorth, 0)}), every bill is paid and no loan instalment is overdue.</li>
          </ul>
          {!w.admin.loanTaken && !w.loan && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="small">Recovery loan: {fmtCrowns(LOAN.principal, 0)} now, repay {fmtCrowns(LOAN.principal + LOAN.fee, 0)} in instalments of {fmtCrowns(LOAN.instalment, 0)} at each season end from next season (once per administration).</span>
              <button className="btn small" data-testid="take-loan" disabled={services.readOnly} onClick={() => act('Recovery loan received.', () => fed.takeRecoveryLoan())}>Take the Loan</button>
            </div>
          )}
        </>
      )}
      {w.loan && <div className="small" data-testid="loan">Recovery loan: {fmtCrowns(w.loan.outstanding, 2)} outstanding (counts as a liability) · repaid {fmtCrowns(w.loan.repaid, 2)}{w.loan.arrears ? ` · overdue ${fmtCrowns(w.loan.arrears, 2)}` : ''}.</div>}
      {w.episodes.length > 0 && <div className="small muted">Past administrations: {w.episodes.map(e => `season ${e.since} → ${e.until} (${(e.until ?? e.since) - e.since} season${(e.until ?? e.since) - e.since === 1 ? '' : 's'})`).join(' · ')}</div>}
      <div className="small muted">Reputation {w.reputation}/100 (event sponsorship raises it, administration lowers it; it moves your club's appeal by up to ±10%).</div>
    </div>
  );
}

/** Club facilities (needs an active club). */
export function FacilitiesPanel() {
  const services = useServices();
  const fed = services.fed;
  const [msg, act] = useAct();
  const [confirm, setConfirm] = useState<string | null>(null);
  const w = fed.wealthState();
  const hasClub = fed.ownsAsset('club');
  const cash = fed.balance('player:cash');
  return (
    <div className="panel stack" data-testid="facilities">
      <h3>Club Facilities</h3>
      <Note msg={msg} />
      {!hasClub && <div className="small muted">Facilities are built onto an active club.</div>}
      {FACILITIES.map(F => {
        const built = w.facilities.find(f => f.id === F.id);
        return (
          <div key={F.id} className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <div className="row"><strong>{F.name}</strong><span className="spacer" />{built ? <span className={`chip ${built.suspended ? 'neg' : 'pos'}`}>{built.suspended ? 'Suspended · Upkeep Unpaid' : 'Built'}</span> : <span className="chip">{fmtCrowns(F.cost, 0)}</span>}</div>
            <div className="small">{F.effect}</div>
            <div className="small muted">Cost {fmtCrowns(F.cost, 0)} ({fmtCrowns(F.deposit, 0)} refundable deposit) · upkeep {fmtCrowns(F.upkeep, 0)} per season</div>
            {built
              ? <button className="btn small" disabled={services.readOnly} onClick={() => act(`Closed ${F.name}.`, () => fed.closeFacility(F.id))}>Close · Receive {fmtCrowns(F.deposit, 0)}</button>
              : confirm === F.id
                ? <div className="row"><button className="btn primary small" data-testid={`confirm-build-${F.id}`} onClick={() => { setConfirm(null); void act(`Built ${F.name}.`, () => fed.buildFacility(F.id as FacilityId)); }}>Confirm: Pay {fmtCrowns(F.cost, 0)}</button><button className="btn small" onClick={() => setConfirm(null)}>Cancel</button></div>
                : <button className="btn small" data-testid={`build-${F.id}`} disabled={services.readOnly || !hasClub || cash < F.cost || !!w.admin} onClick={() => setConfirm(F.id)}>Build</button>}
          </div>
        );
      })}
    </div>
  );
}

/** Event sponsorship: sponsor an event of this season before it starts. */
export function SponsorshipPanel() {
  const services = useServices();
  const fed = services.fed;
  const [msg, act] = useAct();
  const [tier, setTier] = useState<SponsorTier>('supporter');
  const w = fed.wealthState();
  const season = fed.state!.world.season;
  const events = fed.sponsorableEvents();
  const mine = w.sponsorships.filter(s => s.season === season);
  const stake = SPONSOR_TIERS.find(t => t.id === tier)!.stake;
  const cash = fed.balance('player:cash');
  const history = [...w.sponsorships].reverse().slice(0, 8);
  return (
    <div className="panel stack" data-testid="sponsorship">
      <h3>Event Sponsorship</h3>
      <Note msg={msg} />
      <div className="small">Sponsor up to {SPONSOR.perSeason} events a season before they start. {Math.round(SPONSOR.purseShare * 100)}% of your stake is added to the prizes of the other prize winners (a sponsor never wins its own purse) and the rest pays for the event. When it ends, sponsors pay you a visibility return of {Math.round(SPONSOR.base * 100)}% of your stake, plus up to {Math.round(SPONSOR.local * 100)}% for the share of prize places your region's players take, plus {Math.round(SPONSOR.star * 100)}% if you finish in the prizes yourself (at most {Math.round(SPONSOR.cap * 100)}%). Each sponsorship also raises your reputation and your club's appeal.</div>
      <div className="row" style={{ flexWrap: 'wrap' }} role="radiogroup" aria-label="Sponsorship tier">
        {SPONSOR_TIERS.map(t => <button key={t.id} className={`btn small ${tier === t.id ? 'primary' : ''}`} aria-pressed={tier === t.id} onClick={() => setTier(t.id)}>{t.name} · {fmtCrowns(t.stake, 0)}</button>)}
      </div>
      {events.length === 0 ? <div className="small muted">Every event of this season has started. Sponsorship reopens at the start of next season.</div> : (
        <table className="small"><tbody>{events.map(e => (
          <tr key={e.event}><td>{e.label}</td><td style={{ textAlign: 'right' }}>{e.sponsored ? <span className="chip pos">Sponsored</span>
            : <button className="btn small" data-testid={`sponsor-${e.event}`} disabled={services.readOnly || !!w.admin || mine.length >= SPONSOR.perSeason || cash < stake} onClick={() => act(`You sponsor ${e.label}.`, () => fed.sponsorEvent(e.event, tier))}>Sponsor · {fmtCrowns(stake, 0)}</button>}</td></tr>
        ))}</tbody></table>
      )}
      {history.length > 0 && (
        <table className="small"><thead><tr><th>Season</th><th>Event</th><th>Stake</th><th>Return</th></tr></thead>
          <tbody>{history.map(s => <tr key={s.id}><td>{s.season}</td><td>{s.label}</td><td className="mono">{fmtCrowns(s.stake, 0)}</td><td className="mono">{s.status === 'settled' ? `${fmtCrowns(s.ret ?? 0, 0)} (${Math.round((s.multiplier ?? 0) * 100)}%${s.star ? ', you placed' : ''})` : 'pending'}</td></tr>)}</tbody></table>
      )}
    </div>
  );
}

/** Prestige estates: cosmetic, upkeep, no income. */
export function EstatesPanel() {
  const services = useServices();
  const fed = services.fed;
  const [msg, act] = useAct();
  const [confirm, setConfirm] = useState<string | null>(null);
  const w = fed.wealthState();
  const cash = fed.balance('player:cash');
  return (
    <section className="panel stack" style={{ marginTop: 14 }} data-testid="estates">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Estates</h3><span className="small muted">Prestige only: estates never earn money and never affect play.</span></div>
      <Note msg={msg} />
      <div className="grid-3">
        {ESTATES.map(E => {
          const own = w.estates.find(e => e.id === E.id);
          return (
            <div key={E.id} className="panel stack" style={{ background: 'transparent', borderColor: own ? 'var(--accent)' : undefined }}>
              <div className="row"><strong>{E.name}</strong><span className="spacer" />{own ? <span className={`chip ${own.suspended ? 'neg' : 'pos'}`}>{own.suspended ? 'Suspended' : 'Owned'}</span> : <span className="chip">{fmtCrowns(E.price, 0)}</span>}</div>
              <div className="small">{E.description}</div>
              <div className="small muted">Price {fmtCrowns(E.price, 0)} ({fmtCrowns(E.deposit, 0)} refundable deed deposit) · upkeep {fmtCrowns(E.upkeep, 0)} per season · financial prestige +{E.prestige}</div>
              {own
                ? <button className="btn small" disabled={services.readOnly} onClick={() => act(`Sold ${E.name}.`, () => fed.sellEstate(E.id))}>Sell · Receive {fmtCrowns(E.deposit, 0)}</button>
                : confirm === E.id
                  ? <div className="row"><button className="btn primary small" data-testid={`confirm-estate-${E.id}`} onClick={() => { setConfirm(null); void act(`Bought ${E.name}.`, () => fed.buyEstate(E.id)); }}>Confirm: Pay {fmtCrowns(E.price, 0)}</button><button className="btn small" onClick={() => setConfirm(null)}>Cancel</button></div>
                  : <button className="btn small" data-testid={`estate-${E.id}`} disabled={services.readOnly || cash < E.price || !!w.admin} onClick={() => setConfirm(E.id)}>Buy</button>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Lifetime statistics from the ledger (exact). */
export function LifetimeStatsPanel({ journals }: { journals: Journal[] }) {
  const fed = useServices().fed;
  const st = fed.state!;
  const w = fed.wealthState();
  const s = lifetimeStats(journals, st.finance.points, [...w.episodes, ...(w.admin ? [w.admin] : [])]);
  const earn = s.byCategory.filter(c => c.cls === 'earning');
  const spend = s.byCategory.filter(c => c.cls === 'expense');
  const other = s.byCategory.filter(c => c.cls !== 'earning' && c.cls !== 'expense' && c.cls !== 'exchange');
  const row = (label: string, v: number, key?: string) => <tr key={key ?? label}><td>{label}</td><td className={`mono ${v >= 0 ? 'pos' : 'neg'}`} style={{ textAlign: 'right' }}>{v >= 0 ? '+' : ''}{fmtCrowns(v)}</td></tr>;
  return (
    <section className="panel stack" style={{ marginTop: 14 }} data-testid="lifetime">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Lifetime Statistics</h3><span className="small muted">From {s.journals.toLocaleString('en')} ledger entries</span></div>
      <div className="row" style={{ gap: 28, flexWrap: 'wrap' }}>
        <div className="stat"><span className="v" data-testid="lifetime-earnings">{fmtCrowns(s.earnings, 0)}</span><span className="k">Earned</span></div>
        <div className="stat"><span className="v" data-testid="lifetime-expenses">{fmtCrowns(s.expenses, 0)}</span><span className="k">Spent</span></div>
        <div className="stat"><span className="v">{fmtCrowns(s.exchangeNet, 0)}</span><span className="k">Exchange (net)</span></div>
        <div className="stat"><span className="v">{fmtCrowns(fed.finance().peak, 0)}</span><span className="k">Peak Net Worth</span></div>
      </div>
      <div className="grid-2">
        <div><strong className="small">Earnings by category</strong><table className="small"><tbody>{earn.map(c => row(c.label, c.net))}</tbody></table></div>
        <div><strong className="small">Expenses by category</strong><table className="small"><tbody>{spend.map(c => row(c.label, c.net))}</tbody></table>
          {other.length > 0 && <><strong className="small">Property, grant and loans</strong><table className="small"><tbody>{other.map(c => row(c.label, c.net))}</tbody></table></>}</div>
      </div>
      {s.bySeason.length > 0 && (
        <details className="small"><summary>By season</summary>
          <table className="small"><thead><tr><th>Season</th><th>Earned</th><th>Spent</th><th>Exchange</th></tr></thead>
            <tbody>{[...s.bySeason].reverse().slice(0, 12).map(x => <tr key={x.season}><td>{x.season}</td><td className="mono">{fmtCrowns(x.earnings, 0)}</td><td className="mono">{fmtCrowns(x.expenses, 0)}</td><td className="mono">{fmtCrowns(x.exchangeNet, 0)}</td></tr>)}</tbody></table>
        </details>
      )}
      <div data-testid="milestones"><strong className="small">Financial milestones</strong>
        {s.milestones.length === 0 ? <div className="small muted">None yet: your first prize, sponsorship, club or net-worth step will appear here.</div>
          : <ul className="small">{s.milestones.map(m => <li key={m.id}>{m.label}{m.season ? <span className="muted"> · season {m.season}{m.round ? `, round ${m.round}` : ''}</span> : null}</li>)}</ul>}
      </div>
      <details className="small muted"><summary>Details</summary>Earned = prizes, sponsorships, sponsorship returns, club dues and attendance, contract prize shares and the hardship stipend. Spent = upkeep, entry fees, hosting, stipends, cosmetics and sponsorship stakes. Buying property moves cash into book value (shown separately), the starting grant and the recovery loan are financing. Sums are exact in micro-dollars.</details>
    </section>
  );
}
