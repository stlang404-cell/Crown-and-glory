/** The generated service worker: data safety (never touches saves, only deletes its own caches) and lifecycle. */
import { describe, expect, it } from 'vitest';
import { serviceWorkerSource, crownBuildInfo } from '../scripts/vite-plugin-sw';

const build = { version: '9.9.9', commit: 'abc1234', builtAt: '2026-01-01T00:00:00.000Z' };
const src = serviceWorkerSource(['./', 'index.html', 'assets/index-x.js'], build);
/** Executable code only (comments may explain what the worker deliberately does not touch). */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('service worker source', () => {
  it('never references IndexedDB, localStorage or storage clearing', () => {
    expect(code).not.toMatch(/indexedDB|deleteDatabase|IDBFactory|localStorage|sessionStorage|storage\.clear|StorageManager/i);
    // only deletes the filtered key variable, or its own half-filled cache after a failed install
    expect(code.match(/caches\.delete\([^)]*\)/g)).toEqual(['caches.delete(CACHE)', 'caches.delete(k)']);
  });
  it('deletes only caches with its own scope prefix, keeping the current one', () => {
    expect(src).toContain("const PREFIX = 'crown-' + self.registration.scope + '-';");
    expect(code).toMatch(/\.catch\(err => caches\.delete\(CACHE\)\.then\(\(\) => \{ throw err; \}\)\)/);
    expect(src).toMatch(/keys\.filter\(k => k\.startsWith\(PREFIX\) && k !== CACHE\)\.map\(k => caches\.delete\(k\)\)/);
  });
  it('waits after install; activates only on SKIP_WAITING from the page', () => {
    const install = code.slice(code.indexOf("addEventListener('install'"), code.indexOf("addEventListener('message'"));
    expect(install).not.toContain('skipWaiting');
    expect(src).toMatch(/e\.data\.type === 'SKIP_WAITING'\) self\.skipWaiting\(\)/);
    expect(code.match(/skipWaiting\(\)/g)).toHaveLength(1);
  });
  it('navigations are network-first with a timeout; version.json is never cached', () => {
    expect(src).toContain('NAV_TIMEOUT_MS');
    expect(src).toMatch(/version\.json'\)\) return;/);
    expect(src).not.toMatch(/PRECACHE = \[[^\]]*version\.json/);
  });
  it('cache name changes with the build identity even when the file list is the same', () => {
    const other = serviceWorkerSource(['./', 'index.html', 'assets/index-x.js'], { ...build, commit: 'def5678' });
    const name = (s: string) => s.match(/const CACHE = PREFIX \+ '([0-9a-f]+)'/)![1];
    expect(name(other)).not.toBe(name(src));
    expect(src).toContain(JSON.stringify(build));
  });
  it('build identity has version, commit and an ISO build time', () => {
    const b = crownBuildInfo();
    expect(b.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(b.commit.length).toBeGreaterThan(0);
    expect(new Date(b.builtAt).toISOString()).toBe(b.builtAt);
  });
});
