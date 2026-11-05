import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
export default defineConfig({ root: 'crownmaster', base: './', plugins: [react(), { name: 'crownmaster-offline', generateBundle(_, bundle) {
  const files = ['./', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', ...Object.keys(bundle).map(x => './' + x)];
  const version = createHash('sha256').update(Object.values(bundle).map(x => x.type === 'chunk' ? x.code : String(x.source)).join('')).digest('hex').slice(0, 16);
  this.emitFile({ type: 'asset', fileName: 'sw.js', source: `const PREFIX='crownmaster-'+self.registration.scope+'-'; const CACHE=PREFIX+'${version}'; const FILES=${JSON.stringify(files)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request,{cacheName:CACHE}).then(r=>r||fetch(e.request)));});` });
} }], worker: { format: 'es' }, build: { outDir: '../dist-crownmaster', emptyOutDir: true }, server: { host: true, fs: { allow: ['..'] } } });
