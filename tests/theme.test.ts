import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

/** Minimal DOM + storage stand-ins: the test environment is node. */
function fakeEnv(store: Record<string, string> | 'throws') {
  const dataset: Record<string, string> = {};
  const meta = { content: '', setAttribute(_: string, v: string) { this.content = v; } };
  vi.stubGlobal('document', { documentElement: { dataset }, querySelector: () => meta });
  vi.stubGlobal('localStorage', store === 'throws'
    ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }
    : { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } });
  return { dataset, meta };
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('display preferences (src/ui/theme.ts)', () => {
  it('defaults to Obsidian & Crimson with the theme board when nothing is stored', async () => {
    fakeEnv({});
    const t = await import('../src/ui/theme');
    expect(t.getPrefs()).toEqual({ theme: 'obsidian', board: 'theme', motion: 'system' });
  });
  it('falls back to defaults when storage throws or holds junk, and still applies changes', async () => {
    const { dataset } = fakeEnv('throws');
    const t = await import('../src/ui/theme');
    expect(t.getPrefs()).toEqual(t.DEFAULT_PREFS);
    expect(() => t.setTheme('ivory')).not.toThrow();
    expect(dataset.theme).toBe('ivory');
    vi.resetModules();
    fakeEnv({ [t.PREFS_KEY]: '{"theme":"neon","board":42' });
    const t2 = await import('../src/ui/theme');
    expect(t2.getPrefs()).toEqual(t2.DEFAULT_PREFS);
  });
  it('persists and applies theme, board and motion', async () => {
    const store: Record<string, string> = {};
    const { dataset, meta } = fakeEnv(store);
    const t = await import('../src/ui/theme');
    t.setTheme('midnight');
    t.setBoard('walnut');
    t.setMotion('reduce');
    expect(JSON.parse(store[t.PREFS_KEY])).toEqual({ theme: 'midnight', board: 'walnut', motion: 'reduce' });
    expect(dataset).toMatchObject({ theme: 'midnight', board: 'walnut', motion: 'reduce' });
    expect(meta.content).toBe('#10151e');
    expect(t.prefersReducedMotion()).toBe(true);
  });
  it('every theme and board id has a CSS block, and the inline pre-paint script knows them all', async () => {
    fakeEnv({});
    const t = await import('../src/ui/theme');
    const css = fs.readFileSync(new URL('../src/ui/themes.css', import.meta.url), 'utf8');
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain(`'${t.PREFS_KEY}'`);
    for (const th of t.THEMES) { expect(css).toContain(`[data-theme="${th.id}"]`); expect(html).toContain(`${th.id}: '${th.meta}'`); }
    for (const b of t.BOARDS) { if (b.id !== 'theme') expect(css).toContain(`[data-board="${b.id}"]`); expect(html).toMatch(new RegExp(`[(|]${b.id}[|)]`)); }
  });
});
