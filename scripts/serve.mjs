#!/usr/bin/env node
/**
 * Dependency-free static server for the production build (Windows/macOS/Linux).
 *   node scripts/serve.mjs [--dir dist] [--port 5173] [--host 127.0.0.1] [--open]
 * Saves live in the browser per address (origin), so the port matters: if the preferred port is busy and the
 * process there is already Crown & Calculation, that address is opened instead of starting a second server.
 * Only if another program holds the port is the next free port used (up to +50), with a loud warning that
 * this address has separate saves (use Settings → Backup to move them). --host 0.0.0.0 exposes the game on the
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

const HEALTH = '/__crown-health';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === HEALTH) { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ app: 'crown-and-calculation' })); return; }
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

const preferred = port;
const urlOf = p => `http://${host === '0.0.0.0' ? 'localhost' : host}:${p}/`;
function openBrowser(url) {
  if (!open) return;
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* no browser opener */ }
}
/** Is the program on this port already Crown & Calculation? */
function isCrown(p) {
  return new Promise(resolve => {
    const req = http.get({ host: host === '0.0.0.0' ? '127.0.0.1' : host, port: p, path: HEALTH, timeout: 1500 }, res => {
      let body = ''; res.on('data', d => { body += d; }); res.on('end', () => { try { resolve(JSON.parse(body).app === 'crown-and-calculation'); } catch { resolve(false); } });
    });
    req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}
function listen(attempt = 0) {
  server.once('error', async e => {
    if (e.code !== 'EADDRINUSE' || attempt >= 50) { console.error(e.message); process.exit(1); }
    if (attempt === 0 && await isCrown(port)) {
      console.log(`Crown & Calculation is already running at ${urlOf(port)} — opening it (your saves are there).`);
      openBrowser(urlOf(port));
      process.exit(0);
    }
    port++; listen(attempt + 1);
  });
  server.listen(port, host, () => {
    const url = urlOf(port);
    console.log(`Crown & Calculation is running at ${url}`);
    if (port !== preferred) {
      console.log('');
      console.log(`WARNING: port ${preferred} is used by another program, so the game started on port ${port}.`);
      console.log(`Browsers keep saves per address: games saved at ${urlOf(preferred)} are NOT visible here.`);
      console.log(`Close the other program and restart, or move your career with Settings -> Backup (export there, import here).`);
      console.log('');
    }
    console.log('Keep this window open while you play. Press Ctrl+C to stop.');
    openBrowser(url);
  });
}
listen();
