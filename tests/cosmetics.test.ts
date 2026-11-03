import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { COSMETICS, cosmetic } from '../src/economy/cosmetics';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
async function make(f = new IDBFactory()) {
  const db = await CrownDB.open(f);
  return new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
}
const total = (s: FederationService) => [...s.state!.balances.values()].reduce((a, b) => a + b, 0);

describe('cosmetic unlockables (crown-cosmetics-1)', () => {
  it('purchases are balanced journals to the sink, once only; earned items cannot be bought; state persists', async () => {
    const f = new IDBFactory();
    const svc = await make(f);
    await svc.create(3, 4242);
    const cash0 = svc.balance('player:cash'), sink0 = svc.balance('sink');
    const gold = cosmetic('frame-gold')!;
    await svc.buyCosmetic('frame-gold');
    expect(svc.balance('player:cash')).toBe(cash0 - gold.price!);
    expect(svc.balance('sink')).toBe(sink0 + gold.price!);
    expect(total(svc)).toBe(0);
    expect(svc.hasCosmetic('frame-gold')).toBe(true);
    expect(svc.cosmetics().equipped.frame).toBe('frame-gold');
    await expect(svc.buyCosmetic('frame-gold')).rejects.toThrow(/Already owned/);
    expect(svc.balance('player:cash')).toBe(cash0 - gold.price!);
    // earned-only items: never for sale, locked without the recorded accomplishment
    for (const c of COSMETICS.filter(x => x.price === null)) {
      await expect(svc.buyCosmetic(c.id)).rejects.toThrow(/earned/);
      expect(svc.hasCosmetic(c.id)).toBe(false);
      await expect(svc.equipCosmetic(c.kind, c.id)).rejects.toThrow();
    }
    await expect(svc.equipCosmetic('avatar', 'avatar-portraits', 3)).rejects.toThrow();
    await svc.buyCosmetic('avatar-portraits');
    await svc.equipCosmetic('avatar', 'avatar-portraits', 44);
    await expect(svc.equipCosmetic('avatar', 'avatar-portraits', 9999)).rejects.toThrow();
    // reload from storage
    const again = await make(f);
    await again.load();
    expect(again.cosmetics().owned.sort()).toEqual(['avatar-portraits', 'frame-gold']);
    expect(again.cosmetics().avatarSeed).toBe(44);
    expect(again.balance('player:cash')).toBe(svc.balance('player:cash'));
    // cosmetics never touch rating-related or competitive state
    expect(again.state!.world.player.titles).toEqual([]);
    expect(again.state!.world.player.fedTitle ?? null).toBeNull();
  });
  it('cannot buy without enough cash', async () => {
    const svc = await make();
    await svc.create(5, 99);
    const cash = svc.balance('player:cash');
    const affordable = COSMETICS.filter(c => c.price !== null);
    let spent = 0;
    for (const c of affordable) { if (spent + c.price! <= cash) { await svc.buyCosmetic(c.id); spent += c.price!; } }
    expect(svc.balance('player:cash')).toBe(cash - spent);
    expect(total(svc)).toBe(0);
  });
});
