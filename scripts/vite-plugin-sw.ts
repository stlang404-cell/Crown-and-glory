/**
 * Build identity + service worker generation.
 *
 * `crownBuildInfo()` is the single source of the build identity ({ version, commit, builtAt }): vite.config.ts
 * defines it as `__BUILD__` for the app, and this plugin writes the same data to dist/version.json (never
 * precached; the app fetches it with cache: 'no-store' to show which version an update brings).
 *
 * dist/sw.js gets a precache list of every emitted asset and a cache name bound to a hash of that list and the build
 * identity, so each release gets its own cache. Lifecycle (see docs/IPHONE_PAGES.md):
 *  - install: precache everything (bypassing the HTTP cache), then WAIT — no skipWaiting here. If any entry fails the
 *    install fails and the old worker keeps serving the old version untouched.
 *  - the page decides when to activate (only when no game or live in-play market is in progress) by posting
 *    { type: 'SKIP_WAITING' }.
 *  - activate: delete only this scope's older 'crown-' caches (never IndexedDB, localStorage or other sites' caches
 *    on a shared origin such as GitHub Pages), then claim clients.
 *  - fetch: navigations network-first with a timeout, falling back to the cached index.html; version.json is never
 *    intercepted (always network); other same-origin GETs cache-first.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export interface BuildInfo { version: string; commit: string; builtAt: string }

let memo: BuildInfo | null = null;
/** Build identity. Env overrides (used by e2e/pages-check.mjs to make a distinct second build):
 *  CROWN_VERSION, CROWN_COMMIT, CROWN_BUILT_AT. In CI the commit comes from GITHUB_SHA. */
export function crownBuildInfo(): BuildInfo {
  if (memo) return memo;
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  let commit = process.env.CROWN_COMMIT || (process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : '');
  if (!commit) { try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { commit = ''; } }
  memo = { version: process.env.CROWN_VERSION || pkg.version, commit: commit || 'local', builtAt: process.env.CROWN_BUILT_AT || new Date().toISOString() };
  return memo;
}

/** The generated worker source (exported for tests). */
export function serviceWorkerSource(list: string[], build: BuildInfo): string {
  const version = createHash('sha256').update(list.join('|') + '|' + JSON.stringify(build)).digest('hex').slice(0, 12);
  return `/* Crown & Calculation service worker — generated at build, cache ${version}, v${build.version} commit ${build.commit} built ${build.builtAt} */
// Cache names carry the service-worker scope, so several copies on one origin (e.g. GitHub Pages project sites under
// <user>.github.io) never delete each other's caches. This worker never touches IndexedDB or localStorage (saves).
const PREFIX = 'crown-' + self.registration.scope + '-';
const CACHE = PREFIX + '${version}';
const BUILD = ${JSON.stringify(build)};
const PRECACHE = ${JSON.stringify(list)};
const NAV_TIMEOUT_MS = 3500;
self.addEventListener('install', e => {
  // The new version installs and then waits until the page says it is safe to switch (no skip-waiting here).
  // If any file fails to download the install fails as a whole: the half-filled cache is dropped and the old worker
  // keeps serving the old version untouched; the next check tries again.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
    .catch(err => caches.delete(CACHE).then(() => { throw err; })));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'GET_BUILD' && e.ports && e.ports[0]) e.ports[0].postMessage(BUILD);
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const cachedShell = () => caches.open(CACHE).then(c => c.match('index.html', { ignoreSearch: true }).then(r => r || c.match('./')));
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // always network, never cached
  if (req.mode === 'navigate') {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => { if (done) return; done = true; resolve(cachedShell().then(r => r || fetch(req))); };
      const t = setTimeout(fallback, NAV_TIMEOUT_MS);
      fetch(req).then(res => { if (done) return; if (!res.ok && res.status >= 500) { clearTimeout(t); fallback(); return; } done = true; clearTimeout(t); resolve(res); }, () => { clearTimeout(t); fallback(); });
    }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
`;
}

export function crownServiceWorker(): Plugin {
  return {
    name: 'crown-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const build = crownBuildInfo();
      const files = Object.keys(bundle).filter(f => !f.endsWith('.map') && f !== 'version.json');
      const extra = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
      const list = [...new Set([...extra, ...files])];
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(build, null, 2) + '\n' });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(list, build) });
    },
  };
}
