import { useState } from 'react';
import { useServices } from './App';
import { Portrait } from './Portrait';
import { PieceSvg } from './Pieces';
import { COSMETICS, AVATAR_SEEDS, cosmetic, type CosmeticKind } from '../economy/cosmetics';
import { fmtCrowns } from '../exchange/ledger';
import { TINCTURES } from '../heraldry/charges';
import { setBoard, type BoardId } from './theme';

const FRAME_STYLE: Record<string, { border: string; shadow: string }> = {
  'frame-bronze': { border: '#b08d57', shadow: '0 0 0 2px #5a4325' },
  'frame-silver': { border: '#c9d1da', shadow: '0 0 0 2px #59626d' },
  'frame-gold': { border: '#e2b84b', shadow: '0 0 0 2px #8e2f3a' },
  'frame-laurel': { border: '#6f9b4f', shadow: '0 0 0 2px #e2b84b' },
  'frame-crown': { border: '#e2b84b', shadow: '0 0 0 3px #e2b84b, 0 0 14px #e2b84b88' },
};

/** The player's avatar with the equipped frame (original pixel portraits; the king piece by default). */
export function PlayerAvatar({ size = 72 }: { size?: number }) {
  const fed = useServices().fed;
  const cs = fed.ready ? fed.cosmetics() : null;
  const frame = cs?.equipped.frame && fed.hasCosmetic(cs.equipped.frame) ? FRAME_STYLE[cs.equipped.frame] : null;
  const seed = cs?.avatarSeed !== undefined && fed.hasCosmetic('avatar-portraits') ? cs.avatarSeed : null;
  return (
    <span data-testid="player-avatar" style={{ display: 'inline-grid', placeItems: 'center', width: size + 8, height: size + 8, borderRadius: 10, border: frame ? `3px solid ${frame.border}` : '1px solid var(--line)', boxShadow: frame?.shadow, background: 'var(--panel-2, transparent)' }}>
      {seed !== null ? <Portrait seed={seed} size={size} crown={cs?.equipped.frame === 'frame-crown'} /> : <span style={{ width: size * 0.7, height: size * 0.7, display: 'block' }}><PieceSvg kind="k" color="w" title="Your avatar: the white king" /></span>}
    </span>
  );
}

/** Passport banner from the equipped banner cosmetic (purely visual). */
export function PassportBanner() {
  const fed = useServices().fed;
  if (!fed.ready) return null;
  const id = fed.cosmetics().equipped.banner;
  if (!id || !fed.hasCosmetic(id)) return null;
  const club = fed.clubIdentity();
  const [a, b] = id === 'banner-arms' && club ? [TINCTURES[club.primary], TINCTURES[club.secondary]] : id === 'banner-victor' ? ['#8e2f3a', '#e2b84b'] : ['#14161c', '#8e2f3a'];
  return <div data-testid="passport-banner" aria-hidden style={{ height: 14, borderRadius: 6, margin: '0 0 12px', background: `repeating-linear-gradient(135deg, ${a} 0 18px, ${b} 18px 22px)` }} />;
}

/** Finance → Cosmetics: buy with fictional crowns, or see what results unlock. Never affects play or titles. */
export function CosmeticsShop() {
  const services = useServices();
  const fed = services.fed;
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  if (!fed.ready) return null;
  const cs = fed.cosmetics();
  const cash = fed.finance().cash;
  const act = async (fn: () => Promise<void>, text: string) => { setMsg(null); try { await fn(); setMsg({ kind: 'ok', text }); } catch (e) { setMsg({ kind: 'warn', text: (e as Error).message }); } };
  const kinds: [CosmeticKind, string][] = [['frame', 'Portrait Frames'], ['banner', 'Passport Banners'], ['board', 'Board Palettes'], ['avatar', 'Portraits']];
  return (
    <section className="panel stack" style={{ marginTop: 14 }} data-testid="cosmetics">
      <div className="panel-title"><h3 style={{ margin: 0 }}>Cosmetics</h3><span className="small muted">Looks only: never affects strength, rating, titles or prizes. Purchases can't be resold.</span></div>
      {msg && <div className={`notice small ${msg.kind === 'warn' ? 'warn' : ''}`} role="status">{msg.text}</div>}
      {kinds.map(([k, label]) => (
        <div key={k}>
          <strong className="small">{label}</strong>
          <div className="grid-3" style={{ marginTop: 6 }}>
            {COSMETICS.filter(c => c.kind === k).map(c => {
              const have = fed.hasCosmetic(c.id);
              const on = cs.equipped[k] === c.id;
              return (
                <div key={c.id} className="panel stack" style={{ gap: 4 }} data-testid={`cosmetic-${c.id}`}>
                  <div className="row" style={{ gap: 6 }}><strong className="small">{c.name}</strong>{on && <span className="chip pos">Equipped</span>}{c.price === null && <span className="chip gold">Earned</span>}</div>
                  <span className="small muted">{c.description}</span>
                  {have ? (
                    k === 'avatar' ? null : k === 'board' ? <button className="btn small" onClick={() => setBoard(c.boardId as BoardId)}>Use Board</button>
                      : <button className="btn small" disabled={services.readOnly} onClick={() => act(() => fed.equipCosmetic(k, on ? null : c.id), on ? 'Removed.' : `${c.name} equipped.`)}>{on ? 'Remove' : 'Equip'}</button>
                  ) : c.price === null ? <span className="small muted">Locked: earn it through your results.</span>
                    : <button className="btn small primary" data-testid={`buy-cosmetic-${c.id}`} disabled={services.readOnly || cash < c.price} onClick={() => act(() => fed.buyCosmetic(c.id), `Bought ${c.name} for ${fmtCrowns(c.price!, 0)}.`)}>Buy {fmtCrowns(c.price, 0)}</button>}
                </div>
              );
            })}
          </div>
          {k === 'avatar' && fed.hasCosmetic('avatar-portraits') && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }} role="radiogroup" aria-label="Choose your portrait">
              {AVATAR_SEEDS.map(sd => <button key={sd} className="btn ghost small" aria-label={`Portrait ${AVATAR_SEEDS.indexOf(sd) + 1}`} aria-pressed={cs.avatarSeed === sd} style={{ padding: 2, outline: cs.avatarSeed === sd ? '2px solid var(--accent)' : undefined }} onClick={() => act(() => fed.equipCosmetic('avatar', 'avatar-portraits', sd), 'Portrait chosen.')}><Portrait seed={sd} size={40} /></button>)}
            </div>
          )}
        </div>
      ))}
      <div className="small muted">Owned: {cs.owned.map(id => cosmetic(id)?.name).filter(Boolean).join(', ') || 'nothing yet'}.</div>
    </section>
  );
}
