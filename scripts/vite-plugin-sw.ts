/**
 * Generates dist/sw.js after the build with a precache list of every emitted asset and a cache
 * name bound to a content hash of that list, so each release gets its own cache and old caches are
 * removed on activation. Strategy: precache app shell + engine worker; cache-first for same-origin
 * GETs; navigations fall back to the cached index.html when offline.
 */
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

export function crownServiceWorker(): Plugin {
  return {
    name: 'crown-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter(f => !f.endsWith('.map'));
      const extra = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
      const list = [...new Set([...extra, ...files])];
      const version = createHash('sha256').update(list.join('|')).digest('hex').slice(0, 12);
      const source = `/* Crown & Calculation service worker — generated at build, cache ${version} */
const CACHE = 'crown-${version}';
const PRECACHE = ${JSON.stringify(list)};
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('crown-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html', { ignoreSearch: true }).then(r => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
