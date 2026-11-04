import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from './App';
import { updates } from '../app/updates';
import { updateSafety, blockingLiveGames, BLOCKER_TEXT, type UpdateSafety } from '../app/updatePolicy';
import type { GameStatus } from '../games/types';
import type { AppServices } from '../app/services';

const IDLE_MS = 1500;
const POLL_MS = 2000;

function currentRoute(): { name: string; id: string | null } {
  const [name = 'play', id] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || 'play', id: id ? decodeURIComponent(id) : null };
}

/** Federation internals the decision needs (read-only; not part of the service's public API). */
function arena(services: AppServices) {
  const fed = services.fed as unknown as { state?: { liveGames?: Map<string, { status: string; marketId?: string | null }> }; inflight?: Map<string, unknown>; busy?: boolean } | undefined;
  const live = fed?.state?.liveGames ? blockingLiveGames(fed.state.liveGames.values()) : 0;
  return { live, inFlight: (fed?.inflight?.size ?? 0) > 0, busy: !!fed?.busy };
}

/**
 * Shows the app-update state and decides when a downloaded update is switched on:
 *  - nothing in progress → it installs by itself at an idle moment (the page reloads once);
 *  - a game or live in-play market in progress → "Update ready — Restart to Update", and it installs by itself as
 *    soon as the player leaves the game;
 *  - after the reload → "Updated to vX (commit)" once.
 */
export function UpdateNotice() {
  const { services } = useApp();
  const st = useSyncExternalStore(updates.subscribe, updates.getState);
  const pending = st.waiting || st.activatedElsewhere;
  const [, setTick] = useState(0);
  const matchStatus = useRef<{ id: string; status: GameStatus | 'unknown' } | null>(null);

  const safety = (): UpdateSafety => {
    const r = currentRoute();
    let status: GameStatus | 'unknown' | null = null;
    if (r.name === 'match') status = r.id && matchStatus.current?.id === r.id ? matchStatus.current.status : 'unknown';
    const a = arena(services);
    return updateSafety({ route: r.name, matchGameStatus: status, liveArenaGames: a.live, featuredInFlight: a.inFlight, federationBusy: a.busy, readOnly: !!services.readOnly });
  };

  // While an update waits: follow the route, refresh the match game's status, re-evaluate every couple of seconds.
  useEffect(() => {
    if (!pending) return;
    let alive = true;
    const refresh = async () => {
      const r = currentRoute();
      if (r.name === 'match' && r.id) {
        const g = await services.db.getGame(r.id).catch(() => undefined);
        if (!alive) return;
        matchStatus.current = { id: r.id, status: g ? g.status : 'finalized' };
      }
      setTick(t => t + 1);
    };
    void refresh();
    const iv = setInterval(() => { void refresh(); }, POLL_MS);
    window.addEventListener('hashchange', refresh);
    return () => { alive = false; clearInterval(iv); window.removeEventListener('hashchange', refresh); };
  }, [pending, services]);

  const now = pending ? safety() : null;
  const safeNow = !!now?.safe;
  // Switch automatically: immediately when the page already runs the waiting release, otherwise at an idle moment.
  useEffect(() => {
    if (!pending || st.applying) return;
    if (st.waiting && !st.activatedElsewhere && updates.runningMatchesWaiting()) { updates.apply(); return; }
    if (!safeNow) return;
    const t = setTimeout(() => { if (safety().safe) updates.apply(); }, IDLE_MS);
    return () => clearTimeout(t);
  });

  // Confirmation after the update reload, shown once.
  useEffect(() => {
    if (!st.justUpdated) return;
    const t = setTimeout(() => updates.dismissConfirmation(), 8000);
    return () => clearTimeout(t);
  }, [st.justUpdated]);

  const label = (b: { version: string; commit: string } | null) => b ? `v${b.version} (${b.commit})` : 'a new version';
  if (st.justUpdated) {
    return <div className="notice info row" role="status" data-testid="update-done" style={{ marginBottom: 12, gap: 8 }}>
      Updated to {label(st.justUpdated)}. Your games and money are as you left them.
      <span className="spacer" /><button className="btn small ghost" onClick={() => updates.dismissConfirmation()}>OK</button>
    </div>;
  }
  if (st.applying) return <div className="notice info" role="status" data-testid="update-applying" style={{ marginBottom: 12 }}>Updating Crown &amp; Calculation…</div>;
  if (!pending || !now || now.safe) return null;
  const next = st.activatedElsewhere ? null : st.available;
  return (
    <div className="notice info row" role="status" data-testid="update-ready" data-blocker={now.reason} style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
      <span><strong>Update ready</strong>{next ? ` — ${label(next)}` : ''}. {BLOCKER_TEXT[now.reason]} Your games are saved.</span>
      <span className="spacer" />
      <button className="btn small primary" onClick={() => updates.apply()}>Restart to Update</button>
    </div>
  );
}
