import { useState } from 'react';
import { useApp, useServices } from './App';
import { useLegacy } from './IdentityBanner';
import { TrophyArt } from './TrophyArt';
import { Emblem } from './Emblem';
import { KIND_LABEL, TIER_NAME, TROPHIES, TROPHY_KINDS, type TrophyAward } from '../legacy/trophies';
import { ACCENTS, MAX_FEATURED, MAX_SHOWCASE, MAX_NAME, earnedAccents, type Change } from '../legacy/customise';
import { RATING_TITLES, insigniaSpec } from '../ratings/titles';
import { vaultDef } from '../vault/catalog';

type Held = TrophyAward & { at?: string; backfill?: boolean };
const when = (t: Held) => t.earnedAt ? new Date(t.earnedAt).toLocaleDateString() : t.season !== null ? `Season ${t.season}` : t.at ? new Date(t.at).toLocaleDateString() : '';

/** One held trophy. */
function TrophyCard({ t, featured, onFeature }: { t: Held; featured: boolean; onFeature?: () => void }) {
  const { go } = useApp();
  return (
    <div className="trophy-card held" data-testid="trophy-card" data-key={t.key}>
      <TrophyArt kind={t.kind} tier={t.tier} size={56} title={t.name} />
      <div className="trophy-card-text">
        <strong>{t.name}</strong>
        <span className="small"><span className="chip">{TIER_NAME[t.tier]}</span> <span className="muted">{when(t)}</span></span>
        <span className="small muted">{t.evidence}{t.backfill ? ' · recorded from your history' : ''}</span>
        <span className="row" style={{ gap: 6 }}>
          {t.replay && <button className="btn ghost small" data-testid="trophy-replay" onClick={() => go({ name: 'analysis', gameId: t.replay!.gameId })}>Replay Game</button>}
          {onFeature && <button className="btn ghost small" aria-pressed={featured} onClick={onFeature}>{featured ? 'Featured' : 'Feature'}</button>}
        </span>
      </div>
    </div>
  );
}

/** The Trophy Hall: every trophy held, by kind, plus the registry of every trophy and its unlock rule. */
export function TrophyHall() {
  const lg = useLegacy();
  const [msg, setMsg] = useState<string | null>(null);
  if (!lg || !lg.ready) return <section className="panel" data-testid="trophy-hall"><h2 style={{ marginTop: 0 }}>Trophy Hall</h2><p className="small muted">Reading your recorded results…</p></section>;
  const held = lg.earned.trophies;
  const shown = lg.shown();
  const toggle = async (key: string) => {
    setMsg(null);
    const cur = shown.featured;
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
    if (next.length > MAX_FEATURED) { setMsg(`You can feature ${MAX_FEATURED} trophies in your header. Remove one first.`); return; }
    try { await lg.change({ field: 'featured', value: next }); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <section className="panel stack trophy-hall" data-testid="trophy-hall">
      <div className="panel-title"><h2 style={{ margin: 0 }}>Trophy Hall</h2><span className="small muted" data-testid="trophy-count">{held.length} {held.length === 1 ? 'trophy' : 'trophies'}</span></div>
      <p className="small muted" style={{ marginTop: 0 }}>Every trophy rests on a recorded result: titles, season tables, norms, your career Elo history, rivalries and the Forecasting League. They are kept for good and can't be bought. Feature up to {MAX_FEATURED} in your header.</p>
      {msg && <div className="notice small warn" role="status">{msg}</div>}
      {held.length === 0 && <p className="small muted" data-testid="trophy-empty">No trophies yet. Finish a Federation season in the top three, win an event, score a norm or establish your career Elo to earn your first.</p>}
      {TROPHY_KINDS.filter(k => held.some(t => t.kind === k)).map(k => (
        <div key={k}>
          <h3 className="small" style={{ margin: '6px 0' }}>{KIND_LABEL[k]}</h3>
          <div className="trophy-hall-grid">{held.filter(t => t.kind === k).map(t => <TrophyCard key={t.key} t={t} featured={shown.featured.includes(t.key)} onFeature={() => void toggle(t.key)} />)}</div>
        </div>
      ))}
      <details data-testid="trophy-registry">
        <summary className="small">Trophy registry ({TROPHIES.length} trophies, {TROPHY_KINDS.length} kinds)</summary>
        <div className="trophy-hall-grid" style={{ marginTop: 8 }}>
          {TROPHIES.map(d => {
            const n = held.filter(t => t.defId === d.id).length;
            return (
              <div key={d.id} className={`trophy-card ${n ? 'held' : 'locked'}`} data-testid="trophy-def">
                <TrophyArt kind={d.kind} tier={d.tier} size={44} title={`${d.name}${n ? '' : ' (not yet earned)'}`} />
                <div className="trophy-card-text"><strong>{d.name}</strong><span className="small muted">{KIND_LABEL[d.kind]} · {TIER_NAME[d.tier]}{d.repeatable ? ' · per season or event' : ''}</span><span className="small">{d.rule}</span><span className="small muted">{n ? `Held ${n}×` : 'Not yet earned'}</span></div>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}

/** Restrained, inline (non-blocking) ceremony for a newly awarded trophy. Respects reduced motion (CSS). */
export function TrophyCeremony() {
  const lg = useLegacy();
  const { go } = useApp();
  const t = lg?.pending[0];
  if (!lg || !t) return null;
  const more = lg.pending.length - 1;
  return (
    <section className="trophy-ceremony" role="status" aria-live="polite" data-testid="trophy-ceremony">
      <TrophyArt kind={t.kind} tier={t.tier} size={64} title={t.name} />
      <div className="trophy-ceremony-text">
        <span className="small muted">Trophy awarded · {TIER_NAME[t.tier]}</span>
        <strong>{t.name}</strong>
        <span className="small muted">{t.evidence}{more > 0 ? ` · ${more} more` : ''}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn small" onClick={() => { void lg.acknowledge([t.key]); go({ name: 'hall' }); }}>Trophy Hall</button>
        <button className="btn primary small" data-testid="trophy-ceremony-continue" onClick={() => void lg.acknowledge([t.key])}>Continue</button>
      </div>
    </section>
  );
}

/** Profile: customise the identity header from earned items only. */
export function LegacyCustomise() {
  const services = useServices();
  const lg = useLegacy();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState<string | null>(null);
  if (!lg || !lg.ready) return null;
  const e = lg.earned, p = lg.shown();
  const accents = earnedAccents(e.trophies);
  const act = async (c: Change, text: string) => { setMsg(null); try { await lg.change(c); setMsg({ ok: true, text }); } catch (err) { setMsg({ ok: false, text: (err as Error).message }); } };
  const toggle = (list: string[], id: string, max: number) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id].slice(-max));
  return (
    <section className="panel stack" style={{ marginTop: 14 }} data-testid="legacy-customise">
      <div className="panel-title"><h2 style={{ margin: 0 }}>Your Legacy Header</h2><span className="small muted">Shows only what you have earned · looks only</span></div>
      {msg && <div className={`notice small ${msg.ok ? '' : 'warn'}`} role="status">{msg.text}</div>}
      <label className="small">Display name
        <span className="row" style={{ gap: 6, marginTop: 4 }}>
          <input type="text" maxLength={MAX_NAME} value={name ?? p.name} placeholder="You" onChange={ev => setName(ev.target.value)} aria-label="Display name" data-testid="legacy-name" disabled={services.readOnly} />
          <button className="btn small" onClick={() => void act({ field: 'name', value: name ?? p.name }, 'Name saved.')} disabled={services.readOnly}>Save</button>
        </span>
      </label>
      <div><strong className="small">Primary banner</strong>
        <div className="legacy-choices" data-testid="legacy-banners">
          <button className="legacy-choice" aria-pressed={p.banner === null} onClick={() => void act({ field: 'banner', value: null }, 'Banner removed.')}>None</button>
          {e.banners.map(b => <button key={b.id} className="legacy-choice" aria-pressed={p.banner === b.id} onClick={() => void act({ field: 'banner', value: b.id }, `${b.name} raised.`)} title={b.source}><span className="legacy-swatch" style={{ background: `linear-gradient(135deg, ${b.colors[0]} 50%, ${b.colors[1]} 50%)` }} />{b.name}</button>)}
        </div>
        {e.banners.length === 0 && <p className="small muted">Banners come from your regional federation (found or join the Federation), seasonal banner trophies and banner cosmetics.</p>}
      </div>
      <div><strong className="small">Insignia</strong>
        <div className="legacy-choices" data-testid="legacy-insignia">
          <button className="legacy-choice" aria-pressed={p.insignia === null} onClick={() => void act({ field: 'insignia', value: null }, 'Showing your current rating title insignia.')}>Current title</button>
          {e.insignias.map(i => <button key={i} className="legacy-choice" aria-pressed={p.insignia === i} onClick={() => void act({ field: 'insignia', value: i }, `${RATING_TITLES[i].name} insignia shown.`)}><Emblem spec={insigniaSpec(RATING_TITLES[i])} size="sm" title="" />{RATING_TITLES[i].name}</button>)}
        </div>
        {e.insignias.length === 0 && <p className="small muted">Collected insignias appear once your career Elo is established.</p>}
      </div>
      <div><strong className="small">Header accent</strong>
        <div className="legacy-choices" data-testid="legacy-accents">
          {ACCENTS.map(a => { const ok = accents.includes(a.id); return <button key={a.id} className="legacy-choice" aria-pressed={p.accent === a.id} disabled={!ok} title={a.rule} onClick={() => void act({ field: 'accent', value: a.id }, `${a.name} accent applied.`)}><span className="legacy-swatch" style={{ background: a.color }} />{a.name}{ok ? '' : ' (locked)'}</button>; })}
        </div>
      </div>
      <div><strong className="small">Featured trophies (up to {MAX_FEATURED})</strong>
        <div className="legacy-choices" data-testid="legacy-featured">
          {e.trophies.map(t => <button key={t.key} className="legacy-choice" aria-pressed={p.featured.includes(t.key)} onClick={() => void act({ field: 'featured', value: toggle(p.featured, t.key, MAX_FEATURED) }, 'Featured trophies updated.')}><TrophyArt kind={t.kind} tier={t.tier} size={22} title="" />{t.name}</button>)}
        </div>
        {e.trophies.length === 0 && <p className="small muted">No trophies yet: they appear in the Trophy Hall (Hall of Fame) as you earn them.</p>}
      </div>
      <div><strong className="small">Achievement showcase (up to {MAX_SHOWCASE})</strong>
        <div className="legacy-choices" data-testid="legacy-showcase">
          {e.vault.map(v => { const d = vaultDef(v.id); return <button key={v.id} className="legacy-choice" aria-pressed={p.showcase.includes(v.id)} onClick={() => void act({ field: 'showcase', value: toggle(p.showcase, v.id, MAX_SHOWCASE) }, 'Showcase updated.')}>{d && <Emblem spec={d.art} size="sm" title="" />}{v.name}</button>; })}
        </div>
        {e.vault.length === 0 && <p className="small muted">Unlock achievements in the Sovereign Vault to showcase them.</p>}
      </div>
      <div><strong className="small">Exchange honour</strong>
        <div className="legacy-choices" data-testid="legacy-honour">
          <button className="legacy-choice" aria-pressed={p.honour === null} onClick={() => void act({ field: 'honour', value: null }, 'Exchange honour hidden.')}>None</button>
          {e.exchangeTitles.map(x => <button key={x.id} className="legacy-choice" aria-pressed={p.honour === x.id} onClick={() => void act({ field: 'honour', value: x.id }, `${x.name} shown.`)}>{x.name}</button>)}
        </div>
        {e.exchangeTitles.length === 0 && <p className="small muted">Exchange titles are earned by forecasting skill on the Grand Exchange (Vault → Grand Exchange).</p>}
      </div>
    </section>
  );
}
