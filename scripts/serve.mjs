#!/usr/bin/env node
/**
 * Dependency-free static server for the production build (Windows/macOS/Linux).
 *   node scripts/serve.mjs [--dir dist] [--port 5173] [--host 127.0.0.1] [--open]
 * If the port is busy the next free port is used (up to +50). --host 0.0.0.0 exposes the game on the
 * local network (same-Wi-Fi testing; NOT a secure context, so phones get no offline service worker).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const root = path.resolve(opt('dir', 'dist'));
const host = opt('host', '127.0.0.1');
let port = +opt('port', 5173);
const open = args.includes('--open');

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`No build found in ${root}. Run "npm run build" first.`);
  process.exit(1);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
});

function listen(attempt = 0) {
  server.once('error', e => {
    if (e.code === 'EADDRINUSE' && attempt < 50) { port++; listen(attempt + 1); }
    else { console.error(e.message); process.exit(1); }
  });
  server.listen(port, host, () => {
    const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`;
    console.log(`Crown & Calculation is running at ${url}`);
    console.log('Keep this window open while you play. Press Ctrl+C to stop.');
    if (open) {
      const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
      try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* no browser opener */ }
    }
  });
}
listen();
