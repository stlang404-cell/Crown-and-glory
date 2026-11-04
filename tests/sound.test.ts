/** Sound preferences persist, invalid values fall back, and sounds respect master/category switches and de-duplication. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });
  vi.resetModules();
});

describe('sound preferences', () => {
  it('defaults, persistence and invalid values', async () => {
    const s = await import('../src/ui/sound');
    expect(s.readSoundPrefs()).toEqual(s.DEFAULT_SOUND);
    s.setSoundPrefs({ volume: 0.3, categories: { moves: false } as never });
    const s2 = await (vi.resetModules(), import('../src/ui/sound'));
    expect(s2.readSoundPrefs()).toMatchObject({ enabled: true, volume: 0.3, categories: { moves: false, results: true, ceremonies: true } });
    store.set(s.SOUND_KEY, JSON.stringify({ enabled: 'yes', volume: 7 }));
    expect(s2.readSoundPrefs()).toEqual(s2.DEFAULT_SOUND);
  });
  it('master switch and categories gate sounds; repeated calls are de-duplicated', async () => {
    const s = await import('../src/ui/sound');
    s.setSoundPrefs({ enabled: false });
    expect(s.playSound('move')).toBe(false);
    expect(s.soundLog).toHaveLength(0);
    s.setSoundPrefs({ enabled: true, categories: { moves: false, results: true, ceremonies: true } });
    s.playSound('capture'); expect(s.soundLog).toHaveLength(0);
    s.playSound('victory'); s.playSound('victory');
    expect(s.soundLog.filter(x => x.id === 'victory')).toHaveLength(1);
  });
  it('one sound per move, by priority', async () => {
    const s = await import('../src/ui/sound');
    expect(s.moveSoundId({ capture: true, check: true, promotion: false })).toBe('check');
    expect(s.moveSoundId({ capture: true, check: false, promotion: true })).toBe('promotion');
    expect(s.moveSoundId({ capture: true, check: false, promotion: false })).toBe('capture');
    expect(s.moveSoundId({ capture: false, check: false, promotion: false })).toBe('move');
  });
});
