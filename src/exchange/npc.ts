/**
 * NPC traders (crown-npc-traders-1). Funded wallets, public information only: they read the published
 * forecast (Davidson model on PUBLIC ratings) plus their own seeded noise — never latent strength, never
 * a result. Each trader buys the outcome with the largest edge until its belief minus a margin is reached,
 * within a per-market budget. They never sell short and never trade closed markets.
 */
import { hashSeed, normal, rng01 } from '../federation/generator';
import { Market, Position, trade } from './market';
import { prices, sharesToTarget, buyCostMicro, feeMicro } from './lmsr';
import type { Journal } from './ledger';

export interface NpcTrader { id: string; name: string; noise: number; margin: number; budgetShare: number; bias: 'none' | 'favourite' | 'underdog' }

/** Trading order matters: biased and noisy traders act first, the informed analyst last, so prices end near the
 *  public-information consensus with residual noise (measured in docs/V3_ECONOMY.md). */
export const NPC_TRADERS: NpcTrader[] = [
  { id: 'npc:conservative', name: 'Old Harbour Fund', noise: 0.05, margin: 0.06, budgetShare: 0.02, bias: 'none' },
  { id: 'npc:fan', name: 'Crown Supporters Club', noise: 0.08, margin: 0.02, budgetShare: 0.05, bias: 'favourite' },
  { id: 'npc:contrarian', name: 'Lantern Contrarians', noise: 0.08, margin: 0.04, budgetShare: 0.03, bias: 'underdog' },
  { id: 'npc:novice', name: 'First-Time Forecasters', noise: 0.14, margin: 0.02, budgetShare: 0.03, bias: 'none' },
  { id: 'npc:analyst', name: 'Meridian Analytics', noise: 0.03, margin: 0.02, budgetShare: 0.12, bias: 'none' },
];
export const NPC_WALLET_CAP = 4_000 * 1_000_000; // µ; topped up each season from the treasury up to this cap

/** Run every NPC trader once against an open market. Returns journals and the updated market/positions. */
export function npcRound(market: Market, positions: Map<string, Position>, balances: (a: string) => number, seed: number, at: string, startSeq: number):
  { market: Market; journals: Journal[]; positions: Map<string, Position>; seq: number } {
  let m = market, seq = startSeq;
  const journals: Journal[] = [];
  for (const t of NPC_TRADERS) {
    if (m.status !== 'open') break;
    const r = rng01(hashSeed(seed, 'npc', t.id, m.id));
    const f = m.forecast;
    let belief = [f.w, f.d, f.l].map(x => Math.max(0.02, x + t.noise * normal(r)));
    if (t.bias !== 'none') {
      const fav = f.w >= f.l ? 0 : 2, dog = 2 - fav;
      const k = t.bias === 'favourite' ? fav : dog;
      belief[k] += 0.06;
    }
    const s = belief.reduce((a, x) => a + x, 0);
    belief = belief.map(x => x / s);
    const pr = prices(m.q, m.b);
    const edges = belief.map((b, i) => b - pr[i] - t.margin);
    const i = edges.indexOf(Math.max(...edges));
    if (edges[i] <= 0) continue;
    const target = Math.min(0.97, belief[i] - t.margin);
    let shares = Math.floor(sharesToTarget(m.q, m.b, i, target));
    const budget = Math.floor(balances(t.id) * t.budgetShare);
    while (shares > 0 && buyCostMicro(m.q, m.b, i, shares) + feeMicro(buyCostMicro(m.q, m.b, i, shares)) > budget) shares = Math.floor(shares / 2);
    if (shares <= 0) continue;
    const pos = positions.get(`${m.id}|${t.id}`) ?? null;
    const res = trade(m, pos, t.id, i, shares, 'buy', at, seq++);
    m = res.market;
    positions.set(res.position.id, res.position);
    journals.push(res.journal);
  }
  return { market: m, journals, positions, seq };
}
