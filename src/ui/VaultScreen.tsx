import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useApp } from './App';
import { Emblem } from './Emblem';
import { COLLECTIONS, EXCHANGE_TITLES, GRADING_VALIDATED, RARITIES, RARITY_LABEL, VAULT, earnable, vaultDef, type Collection, type EvalResult, type Rarity, type VaultDef } from '../vault/catalog';
import type { VaultService } from '../vault/service';
import type { UnlockRecord } from '../vault/store';
import type { EmblemSpec } from '../heraldry/spec';
import { FAMILIES, TIERS, TIER_LABEL, type FamilyId, type Tier } from '../vault/families';

const noop = () => () => {};
/** Re-render on Vault changes only (not on every app notification). */
function useVault(): VaultService | undefined {
  const { services } = useApp();
  const v = services.vault as VaultService | undefined;
  useSyncExternalStore(v ? v.subscribe : noop, () => v?.version ?? 0);
  return v;
}

type ItemState = 'earned' | 'locked' | 'awaiting';
interface Item { def: VaultDef; state: ItemState; unlock: UnlockRecord | null; result: EvalResult | undefined; masked: boolean; name: string; rule: string; art: EmblemSpec }

const MASK_ART = (d: VaultDef): EmblemSpec => ({ ...d.art, charge: null, crest: null, wreath: false, monogram: undefined, field: ['sable', 'sable'], division: 'plain' });
function itemOf(d: VaultDef, v: VaultService): Item {
  const unlock = v.owned.get(d.id) ?? null;
  const state: ItemState = unlock ? 'earned' : earnable(d) ? 'locked' : 'awaiting';
  const masked = !!d.secret && !unlock;
  return {
    def: d, state, unlock, result: v.results.get(d.id), masked,
    name: masked ? 'Secret Collectible' : d.name,
    rule: masked ? 'Secret: the condition is revealed when you earn it.' : d.rule,
    art: masked ? MASK_ART(d) : d.art,
  };
}
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
const STATE_LABEL: Record<ItemState, string> = { earned: 'Earned', locked: 'Locked', awaiting: 'Awaiting Validated Grading' };

function RarityChip({ r }: { r: Rarity }) { return <span className={`chip rarity rarity-${r}`}>{RARITY_LABEL[r]}</span>; }
function TierChip({ t }: { t: Tier }) { return <span className={`chip vault-tier tier-${t}`} data-testid="vault-tier">{TIER_LABEL[t]}</span>; }
const ratio = (it: Item) => { const p = it.result?.progress; return p && p.need > 0 ? p.have / p.need : 0; };

interface FamilyRow { id: FamilyId; name: string; blurb: string; items: Item[]; earned: number; earnable: number; tiers: Record<Tier, { earned: number; total: number }>; next: Item | undefined }
function familyRows(items: Item[]): FamilyRow[] {
  return FAMILIES.map(f => {
    const its = items.filter(it => it.def.family === f.id);
    const tiers = Object.fromEntries(TIERS.map(t => [t, { earned: 0, total: 0 }])) as FamilyRow['tiers'];
    for (const it of its) if (earnable(it.def)) { tiers[it.def.tier].total++; if (it.state === 'earned') tiers[it.def.tier].earned++; }
    const next = its.filter(it => it.state === 'locked' && !it.masked).sort((a, b) => ratio(b) - ratio(a) || RARITIES.indexOf(a.def.rarity) - RARITIES.indexOf(b.def.rarity))[0];
    return { id: f.id, name: f.name, blurb: f.blurb, items: its, earned: its.filter(it => it.state === 'earned').length, earnable: its.filter(it => earnable(it.def)).length, tiers, next };
  }).filter(r => r.items.length > 0);
}

/** Collection completion: one card per family with its tier ladder and next goal. */
function Families({ rows, onPick }: { rows: FamilyRow[]; onPick: (f: FamilyId) => void }) {
  return (
    <div className="vault-families">
      {rows.map(r => (
        <button key={r.id} className={`vault-family${r.earned === r.earnable && r.earnable > 0 ? ' complete' : ''}`} onClick={() => onPick(r.id)} data-testid="vault-family" data-family={r.id}
          aria-label={`${r.name}: ${r.earned} of ${r.earnable} earned. Show this family.`}>
          <span className="vault-family-head"><strong>{r.name}</strong><span className="small mono" data-testid="vault-family-count">{r.earned}/{r.earnable}</span></span>
          <Bar have={r.earned} need={r.earnable} label={`${r.name} completion`} />
          <span className="vault-tiers">{TIERS.filter(t => r.tiers[t].total > 0).map(t => <span key={t} className={`vault-tier-pip tier-${t}${r.tiers[t].earned === r.tiers[t].total ? ' full' : ''}`} title={`${TIER_LABEL[t]}: ${r.tiers[t].earned} of ${r.tiers[t].total}`}>{TIER_LABEL[t]} {r.tiers[t].earned}/{r.tiers[t].total}</span>)}</span>
          <span className="small muted vault-family-next">{r.next ? <>Next: {r.next.name}{r.next.result?.progress ? ` (${r.next.result.progress.have.toLocaleString('en')}/${r.next.result.progress.need.toLocaleString('en')})` : ''}</> : r.earned === r.earnable ? 'Family complete' : r.blurb}</span>
        </button>
      ))}
    </div>
  );
}
function Bar({ have, need, label }: { have: number; need: number; label: string }) {
  const pct = need > 0 ? Math.round((100 * Math.min(have, need)) / need) : 0;
  return <div className="vault-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(have, need)}><span style={{ width: `${pct}%` }} /></div>;
}

function Card({ it, onOpen }: { it: Item; onOpen: () => void }) {
  const p = it.state === 'locked' && !it.masked ? it.result?.progress : undefined;
  return (
    <button className={`vault-card ${it.state}`} onClick={onOpen} data-testid="vault-item" data-id={it.def.id} data-state={it.state} aria-label={`${it.name}, ${RARITY_LABEL[it.def.rarity]}, ${STATE_LABEL[it.state]}`}>
      <Emblem spec={it.art} size="md" title={`${it.name}${it.state === 'earned' ? '' : ' (not earned)'}`} />
      <span className="vault-card-text">
        <strong className="vault-name">{it.name}</strong>
        <span className="row" style={{ gap: 6 }}><TierChip t={it.def.tier} /><RarityChip r={it.def.rarity} />{it.state === 'awaiting' && <span className="chip info">Awaiting Grading (experimental)</span>}</span>
        <span className="small muted vault-rule">{it.rule}</span>
        {p && <><Bar have={p.have} need={p.need} label={`${it.name} progress`} /><span className="small muted mono">{p.have.toLocaleString('en')} / {p.need.toLocaleString('en')}</span></>}
        {it.unlock && <span className="small vault-date">Earned {fmtDate(it.unlock.earnedAt)}</span>}
      </span>
    </button>
  );
}

function Detail({ it, onClose }: { it: Item; onClose: () => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  const p = it.result?.progress;
  return (
    <div className="result-overlay" onClick={onClose} data-testid="vault-detail">
      <div className="result-card stack vault-detail" role="dialog" aria-modal="true" aria-label={it.name} onClick={e => e.stopPropagation()}>
        <div className={`vault-detail-art ${it.state}`}><Emblem spec={it.art} size="lg" title={it.name} /></div>
        <h2 style={{ margin: 0 }}>{it.name}</h2>
        <div className="row" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}><TierChip t={it.def.tier} /><RarityChip r={it.def.rarity} /><span className="chip">{FAMILIES.find(f => f.id === it.def.family)?.name ?? it.def.collection}</span><span className={`chip ${it.state === 'earned' ? 'pos' : it.state === 'awaiting' ? 'info' : ''}`}>{STATE_LABEL[it.state]}</span></div>
        {!it.masked && <p className="small" style={{ margin: 0 }}>{it.def.description}</p>}
        <p className="small muted" style={{ margin: 0 }}><strong>Rule:</strong> {it.rule}</p>
        {it.state === 'awaiting' && <p className="small muted" style={{ margin: 0 }}>Move grading is still being validated, so this cannot be earned yet. It unlocks for everyone once grading is validated.</p>}
        {it.state === 'locked' && p && !it.masked && <><Bar have={p.have} need={p.need} label="Progress" /><span className="small muted mono">{p.have.toLocaleString('en')} / {p.need.toLocaleString('en')}</span></>}
        {it.unlock && <p className="small" style={{ margin: 0 }}>Earned {fmtDate(it.unlock.earnedAt)}{it.unlock.evidence ? ` · ${it.unlock.evidence}` : ''}</p>}
        {it.unlock && <p className="small muted" style={{ margin: 0 }}>Yours for good: it stays in the Vault even if your rating or net worth falls later.</p>}
        <button className="btn primary" onClick={onClose} autoFocus data-testid="vault-detail-close">Close</button>
      </div>
    </div>
  );
}

export function VaultScreen() {
  const v = useVault();
  const { go } = useApp();
  const [collection, setCollection] = useState<Collection | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [family, setFamily] = useState<FamilyId | 'all'>('all');
  const [state, setState] = useState<ItemState | 'all'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const version = v?.version ?? 0;
  const items = useMemo(() => (v ? VAULT.map(d => itemOf(d, v)) : []), [v, version]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(it => (collection === 'all' || it.def.collection === collection) && (family === 'all' || it.def.family === family) && (rarity === 'all' || it.def.rarity === rarity) && (state === 'all' || it.state === state) &&
      (!s || `${it.name} ${it.rule} ${it.def.collection} ${it.masked ? '' : it.def.description}`.toLowerCase().includes(s)));
  }, [items, collection, family, rarity, state, q]);
  const rows = useMemo(() => familyRows(items), [items]);
  // seeing the Vault counts as seeing its new unlocks: no notice for them afterwards
  const pendingIds = v?.pending.map(u => u.id).join(',') ?? '';
  useEffect(() => { if (v && pendingIds) void v.acknowledge(pendingIds.split(',')); }, [v, pendingIds]);

  if (!v || !v.ready) return <div><h1>The Sovereign Vault</h1><p className="muted" data-testid="vault-loading">Opening the Vault…</p></div>;
  const earnableItems = items.filter(it => earnable(it.def));
  const earned = items.filter(it => it.state === 'earned');
  const awaiting = items.filter(it => it.state === 'awaiting').length;
  const pct = earnableItems.length ? Math.round((1000 * earned.length) / earnableItems.length) / 10 : 0;
  const insignias = items.filter(it => it.def.kind === 'insignia');
  const xt = [...EXCHANGE_TITLES].reverse().find(t => v.owned.has(t.id));
  const recent = [...earned].sort((a, b) => b.unlock!.at.localeCompare(a.unlock!.at) || b.unlock!.earnedAt.localeCompare(a.unlock!.earnedAt)).slice(0, 6);
  const showcase = items.filter(it => it.def.rarity === 'legendary' || it.def.rarity === 'mythic').sort((a, b) => Number(b.state === 'earned') - Number(a.state === 'earned') || RARITIES.indexOf(b.def.rarity) - RARITIES.indexOf(a.def.rarity));
  const current = open ? items.find(it => it.def.id === open) : undefined;
  const next = items.filter(it => it.state === 'locked' && !it.masked && ratio(it) > 0 && ratio(it) < 1).sort((a, b) => ratio(b) - ratio(a) || RARITIES.indexOf(a.def.rarity) - RARITIES.indexOf(b.def.rarity)).slice(0, 6);
  const byRarity = RARITIES.map(r => ({ r, total: earnableItems.filter(it => it.def.rarity === r).length, earned: earned.filter(it => it.def.rarity === r).length }));
  const pickFamily = (f: FamilyId) => { setFamily(f); setCollection('all'); requestAnimationFrame(() => document.querySelector('[data-testid="vault-collection"]')?.scrollIntoView({ block: 'start' })); };
  return (
    <div data-testid="vault">
      <h1>The Sovereign Vault</h1>
      <p className="muted" style={{ marginTop: 0 }}>Permanent collectibles earned from your recorded games, ratings and Federation career. Once earned, they stay yours.</p>
      <section className="panel" data-testid="vault-totals">
        <div className="vault-stats">
          <div className="stat"><span className="k">Earned</span><span className="v" data-testid="vault-earned">{earned.length} <span className="small muted">of {earnableItems.length}</span></span><Bar have={earned.length} need={earnableItems.length} label="Vault completion" /><span className="small muted" data-testid="vault-pct">{pct}% complete</span></div>
          <div className="stat"><span className="k">Insignias</span><span className="v" data-testid="vault-insignias">{insignias.filter(i => i.state === 'earned').length} <span className="small muted">of {insignias.length}</span></span><span className="small muted">From your established Rapid rating</span></div>
          <div className="stat"><span className="k">Exchange Title</span><span className="v" style={{ fontSize: '1.15rem' }} data-testid="vault-exchange-title">{xt?.name ?? 'None Yet'}</span><span className="small muted">Forecast skill and realized profit, never volume</span></div>
          <div className="stat"><span className="k">Awaiting Grading</span><span className="v">{awaiting}</span><span className="small muted">{GRADING_VALIDATED ? 'Grading validated' : 'Brilliance collectibles open once move grading is validated'}</span></div>
        </div>
      </section>

      <section className="panel" data-testid="vault-families">
        <div className="panel-title"><h2>Collection Progress</h2><span className="small muted">{rows.length} families · Bronze, Silver, Gold and Sovereign tiers</span></div>
        <Families rows={rows} onPick={pickFamily} />
        <div className="vault-rarity" data-testid="vault-rarity" aria-label="Earned by rarity">
          {byRarity.map(x => <span key={x.r} className="vault-rarity-cell"><RarityChip r={x.r} /><span className="small mono">{x.earned}/{x.total}</span></span>)}
        </div>
      </section>

      <section className="panel" data-testid="vault-next">
        <div className="panel-title"><h2>Next Goals</h2><span className="small muted">Closest to unlocking</span></div>
        {next.length === 0 ? <p className="small muted" style={{ margin: 0 }} data-testid="vault-next-empty">No collectible is under way yet. Play rated games, study the Grimoire or forecast a market to start one. <button className="btn small" onClick={() => go({ name: 'play' })}>Play</button> <button className="btn small ghost" onClick={() => go({ name: 'grimoire' })}>Grimoire</button> <button className="btn small ghost" onClick={() => go({ name: 'exchange' })}>Exchange</button></p>
          : <div className="vault-strip">{next.map(it => <button key={it.def.id} className="vault-mini locked" onClick={() => setOpen(it.def.id)} data-testid="vault-next-item" data-id={it.def.id}><Emblem spec={it.art} size="md" title={it.name} /><span className="small"><strong>{it.name}</strong><br /><span className="muted mono">{it.result!.progress!.have.toLocaleString('en')} / {it.result!.progress!.need.toLocaleString('en')}</span></span></button>)}</div>}
      </section>

      <section className="panel" data-testid="vault-recent">
        <div className="panel-title"><h2>Recently Unlocked</h2></div>
        {recent.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Nothing yet. Win a game, finish a season or settle a position to unlock your first collectible.</p>
          : <div className="vault-strip">{recent.map(it => <button key={it.def.id} className="vault-mini" onClick={() => setOpen(it.def.id)}><Emblem spec={it.art} size="md" title={it.name} /><span className="small"><strong>{it.name}</strong><br /><span className="muted">{fmtDate(it.unlock!.earnedAt)}</span></span></button>)}</div>}
      </section>

      <section className="panel" data-testid="vault-showcase">
        <div className="panel-title"><h2>Legendary Showcase</h2><span className="small muted">{showcase.filter(i => i.state === 'earned').length} of {showcase.length} Legendary and Mythic</span></div>
        <div className="vault-strip">{showcase.slice(0, 12).map(it => <button key={it.def.id} className={`vault-mini ${it.state}`} onClick={() => setOpen(it.def.id)} aria-label={`${it.name}, ${STATE_LABEL[it.state]}`}><Emblem spec={it.art} size="md" title={it.name} /><span className="small"><strong>{it.name}</strong><br /><span className="muted">{RARITY_LABEL[it.def.rarity]}</span></span></button>)}</div>
      </section>

      <section className="panel" data-testid="vault-collection">
        <div className="vault-filters">
          <select aria-label="Collection" value={collection} onChange={e => setCollection(e.target.value as Collection | 'all')} data-testid="vault-filter-collection">
            <option value="all">All Collections</option>
            {COLLECTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="Family" value={family} onChange={e => setFamily(e.target.value as FamilyId | 'all')} data-testid="vault-filter-family">
            <option value="all">All Families</option>
            {FAMILIES.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select aria-label="Rarity" value={rarity} onChange={e => setRarity(e.target.value as Rarity | 'all')} data-testid="vault-filter-rarity">
            <option value="all">All Rarities</option>
            {RARITIES.map(r => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
          </select>
          <select aria-label="State" value={state} onChange={e => setState(e.target.value as ItemState | 'all')} data-testid="vault-filter-state">
            <option value="all">All States</option><option value="earned">Earned</option><option value="locked">Locked</option><option value="awaiting">Awaiting Grading</option>
          </select>
          <input type="search" placeholder="Search the Vault" aria-label="Search the Vault" value={q} onChange={e => setQ(e.target.value)} data-testid="vault-search" />
        </div>
        <p className="small muted" role="status" data-testid="vault-count">{shown.length} {shown.length === 1 ? 'collectible' : 'collectibles'}</p>
        {shown.length === 0 ? <p className="small muted">No collectibles match. Clear a filter or the search to see more.</p>
          : <div className="vault-grid">{shown.map(it => <Card key={it.def.id} it={it} onOpen={() => setOpen(it.def.id)} />)}</div>}
      </section>
      {current && <Detail it={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** One-time unlock notice: small, dismissible, announced politely; never repeats after a reload. */
export function VaultToast({ hidden }: { hidden: boolean }) {
  const v = useVault();
  const { go } = useApp();
  const [shown, setShown] = useState<UnlockRecord[] | null>(null);
  const pendingIds = v?.pending.map(u => u.id).join(',') ?? '';
  useEffect(() => {
    if (!v || hidden || shown || !pendingIds) return;
    const batch = [...v.pending];
    setShown(batch);
    void v.acknowledge(batch.map(u => u.id)); // recorded as shown at once, so a reload never repeats it
  }, [v, hidden, shown, pendingIds]);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 12_000);
    return () => clearTimeout(t);
  }, [shown]);
  if (!shown || hidden) return null;
  const defs = shown.map(u => vaultDef(u.id)).filter((d): d is VaultDef => !!d);
  const first = defs[0];
  if (!first) return null;
  return (
    <div className="vault-toast" role="status" aria-live="polite" data-testid="vault-toast">
      <Emblem spec={first.art} size="md" title={first.name} />
      <div className="vault-toast-text">
        <strong>{defs.length === 1 ? (first.kind === 'insignia' ? 'Insignia Collected' : 'Unlocked') : `${defs.length} New Collectibles`}</strong>
        <span className="small">{defs.slice(0, 3).map(d => d.name).join(', ')}{defs.length > 3 ? ` and ${defs.length - 3} more` : ''}</span>
        <button className="btn small" onClick={() => { setShown(null); go({ name: 'vault' }); }}>View in Vault</button>
      </div>
      <button className="btn ghost small vault-toast-close" aria-label="Dismiss" onClick={() => setShown(null)}><span aria-hidden="true">×</span></button>
    </div>
  );
}
