/**
 * Hash routes of the app (#/profile, #/match/<id>, …). Pure parsing/formatting plus the one subscription the App uses.
 */
export type View =
  | { name: 'dashboard' }
  | { name: 'play' }
  | { name: 'match'; gameId: string }
  | { name: 'analysis'; gameId: string; ply?: number }
  | { name: 'analyses' }
  | { name: 'library' }
  | { name: 'replays' }
  | { name: 'profile' }
  | { name: 'lab' }
  | { name: 'academy' }
  | { name: 'grimoire'; path?: string }
  | { name: 'world' }
  | { name: 'standings' }
  | { name: 'tournaments' }
  | { name: 'competitors' }
  | { name: 'population' }
  | { name: 'competitor'; id: string }
  | { name: 'watch'; id: string }
  | { name: 'exhibition'; id?: string }
  /** v1.0 Crownmaster Study Match: setup (#/study) or a study game (#/study/<gameId>). */
  | { name: 'study'; gameId?: string }
  | { name: 'arena' }
  | { name: 'exchange'; id?: string }
  | { name: 'finance' }
  | { name: 'forecasts' }
  | { name: 'news' }
  | { name: 'rivals' }
  | { name: 'hall' }
  | { name: 'heraldry' }
  | { name: 'vault' }
  | { name: 'ranks' }
  | { name: 'settings' };

export function parseHash(hash: string = location.hash): View {
  const h = hash.replace(/^#\/?/, '');
  const [name, id, ply] = h.split('/');
  if (name === 'match' && id) return { name: 'match', gameId: decodeURIComponent(id) };
  if (name === 'analysis' && id) return { name: 'analysis', gameId: decodeURIComponent(id), ply: ply ? +ply : undefined };
  if (name === 'analysis') return { name: 'analyses' };
  if (name === 'competitor' && id) return { name: 'competitor', id: decodeURIComponent(id) };
  if (name === 'watch' && id) return { name: 'watch', id: decodeURIComponent(id) };
  if (name === 'study') return id ? { name: 'study', gameId: decodeURIComponent(id) } : { name: 'study' };
  if (name === 'exhibition') return id ? { name: 'exhibition', id: decodeURIComponent(id) } : { name: 'exhibition' };
  if (name === 'exchange') return id ? { name: 'exchange', id: decodeURIComponent(id) } : { name: 'exchange' };
  if (name === 'federation') return { name: 'world' };
  if (name === 'grimoire') return id ? { name: 'grimoire', path: decodeURIComponent(id) } : { name: 'grimoire' };
  if (name === '' || name === 'dashboard') return { name: 'dashboard' };
  if (['play', 'library', 'replays', 'profile', 'lab', 'academy', 'world', 'standings', 'tournaments', 'competitors', 'population', 'finance', 'forecasts', 'news', 'settings', 'rivals', 'hall', 'heraldry', 'vault', 'ranks', 'arena'].includes(name)) return { name } as View;
  return { name: 'dashboard' };
}
/** The view for a (re-)read hash: the current object when it is the same route (no re-render), else the new one. */
export function syncView(current: View, next: View): View { return toHash(current) === toHash(next) ? current : next; }
export function toHash(v: View): string {
  if (v.name === 'match') return `#/match/${encodeURIComponent(v.gameId)}`;
  if (v.name === 'analysis') return `#/analysis/${encodeURIComponent(v.gameId)}${v.ply !== undefined ? '/' + v.ply : ''}`;
  if (v.name === 'analyses') return '#/analysis';
  if (v.name === 'competitor' || v.name === 'watch') return `#/${v.name}/${encodeURIComponent(v.id)}`;
  if (v.name === 'exchange' && v.id) return `#/exchange/${encodeURIComponent(v.id)}`;
  if (v.name === 'study' && v.gameId) return `#/study/${encodeURIComponent(v.gameId)}`;
  if (v.name === 'exhibition' && v.id) return `#/exhibition/${encodeURIComponent(v.id)}`;
  if (v.name === 'grimoire' && v.path) return `#/grimoire/${encodeURIComponent(v.path)}`;
  return `#/${v.name}`;
}

interface HashWindow { location: { hash: string }; addEventListener(t: 'hashchange', l: () => void): void; removeEventListener(t: 'hashchange', l: () => void): void }

/**
 * Follow the location hash: `set` receives an updater on every hashchange. The App's first render reads the hash
 * before it can subscribe (effects run after the commit), so a hash change in between — a tap or a deep link during
 * a slow first render, or a test navigating as soon as the app object exists — fired no event anyone heard and the
 * screen stayed on the old view for good (v1.0 package R: the rating events "never" appeared after a reload,
 * docs/evidence/v1.0/reload-flake.md). Hence: subscribe first, then re-read the hash once. The updater keeps the
 * current view object when the route is unchanged (no extra render). Returns the unsubscribe function.
 */
export function subscribeHash(win: HashWindow, set: (update: (v: View) => View) => void): () => void {
  const on = () => { const next = parseHash(win.location.hash); set(v => syncView(v, next)); };
  win.addEventListener('hashchange', on);
  on();
  return () => win.removeEventListener('hashchange', on);
}
