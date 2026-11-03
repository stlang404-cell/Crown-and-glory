import { useState } from 'react';
import { useServices } from './App';
import { Emblem } from './Emblem';
import { CLUB_COLOURS, CLUB_SHAPES, CLUB_SYMBOLS, clubEmblem, defaultIdentity, validateIdentity, type ClubIdentity } from '../heraldry/clubs';
import { TINCTURES } from '../heraldry/charges';
import type { EmblemSpec } from '../heraldry/spec';

const DIVS: EmblemSpec['division'][] = ['chief', 'fess', 'pale', 'bend', 'chevron', 'quarterly', 'plain'];

/** Club identity editor: name, two colours from the federation palette, shield shape, field division, symbol, motto. */
export function ClubEditor() {
  const services = useServices();
  const fed = services.fed;
  const level = fed.clubLevelOf();
  const saved = fed.clubIdentity() ?? defaultIdentity(fed.state!.world.player.region);
  const [id, setId] = useState<ClubIdentity>(saved);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const err = validateIdentity(id);
  const set = (p: Partial<ClubIdentity>) => setId(x => ({ ...x, ...p }));
  const save = async () => { setMsg(null); try { await fed.setClubIdentity(id); setMsg({ kind: 'ok', text: 'Club identity saved.' }); } catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } };
  return (
    <div className="stack" data-testid="club-editor">
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div className="emblem-cell"><Emblem spec={clubEmblem(id, level)} size="lg" title={`${id.name} arms`} /><span className="small"><strong>{id.name || '—'}</strong>{id.motto && <><br /><em className="muted">“{id.motto}”</em></>}</span>
          <span className="row" style={{ gap: 6 }}><Emblem spec={clubEmblem(id, level)} size="md" title="medium" /><Emblem spec={clubEmblem(id, level)} size="sm" title="small" /></span></div>
        <div className="stack" style={{ flex: 1, minWidth: 240 }}>
          <label className="small">Club name <input value={id.name} maxLength={32} onChange={e => set({ name: e.target.value })} aria-label="Club name" data-testid="club-name" style={{ width: '100%' }} /></label>
          <label className="small">Motto (optional) <input value={id.motto} maxLength={48} onChange={e => set({ motto: e.target.value })} aria-label="Club motto" data-testid="club-motto" style={{ width: '100%' }} /></label>
          <div className="small">Primary colour<div className="swatch-pick" role="radiogroup" aria-label="Primary colour">{CLUB_COLOURS.map(c => <button key={c} aria-pressed={id.primary === c} aria-label={c} title={c} data-testid={`primary-${c}`} style={{ background: TINCTURES[c] }} onClick={() => set({ primary: c })} />)}</div></div>
          <div className="small">Secondary colour<div className="swatch-pick" role="radiogroup" aria-label="Secondary colour">{CLUB_COLOURS.map(c => <button key={c} aria-pressed={id.secondary === c} aria-label={c} title={c} data-testid={`secondary-${c}`} style={{ background: TINCTURES[c] }} onClick={() => set({ secondary: c })} />)}</div></div>
          <div className="small">Shape<div className="icon-pick" role="radiogroup" aria-label="Shield shape">{CLUB_SHAPES.map(sh => <button key={sh} aria-pressed={id.shape === sh} data-testid={`shape-${sh}`} onClick={() => set({ shape: sh })}><Emblem spec={clubEmblem({ ...id, shape: sh })} size="sm" title={sh} /></button>)}</div></div>
          <div className="small">Field<div className="icon-pick" role="radiogroup" aria-label="Field division">{DIVS.map(d => <button key={d} aria-pressed={(id.division ?? 'chief') === d} onClick={() => set({ division: d })}><Emblem spec={clubEmblem({ ...id, division: d })} size="sm" title={d} /></button>)}</div></div>
          <div className="small">Symbol<div className="icon-pick" role="radiogroup" aria-label="Symbol">{CLUB_SYMBOLS.map(sy => <button key={sy} aria-pressed={id.symbol === sy} data-testid={`symbol-${sy}`} onClick={() => set({ symbol: sy })}><Emblem spec={clubEmblem({ ...id, symbol: sy })} size="sm" title={sy} /></button>)}</div></div>
          {err && <div className="small notice warn">{err}</div>}
          {msg && <div className={`small notice ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div>}
          <button className="btn primary small" data-testid="save-club-identity" disabled={!!err || services.readOnly} onClick={save}>Save club identity</button>
          <div className="small muted">All shapes and symbols are original federation heraldry; your club's arms gain a double border at level 2 and a coronet at level 3.</div>
        </div>
      </div>
    </div>
  );
}
