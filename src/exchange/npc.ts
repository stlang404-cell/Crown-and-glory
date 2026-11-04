/**
 * NPC traders (crown-npc-traders-2). Funded wallets, information available at decision time only:
 * the published model (public ratings), the board position's public engine evaluation during live play,
 * and public price history — never hidden strength, never a future move or result. Every trade goes through
 * the same LMSR `trade()` as the player's. Long-only, per-market budgets and a portfolio exposure cap; no
 * trader is guaranteed to profit.
 *   roles: 'pre'   — opening liquidity on any newly listed market
 *          'live'  — in-play reaction after a published move
 *          'round' — periodic re-trading of season/tournament markets as public results arrive
 */
import { hashSeed, normal, rng01 } from '../federation/generator';
import { Market, Position, trade, claimsOf, claimPrices, MarketKind } from './market';
import { buyClaimMicro, feeMicro } from './lmsr';
import type { Journal } from './ledger';

export type NpcRole = 'pre' | 'live' | 'round';
export interface NpcTrader {
  id: string; name: string; noise: number; margin: number; budgetShare: number;
  bias: 'none' | 'favourite' | 'underdog'; strategy: 'value' | 'momentum' | 'tactical';
  roles: NpcRole[]; kinds?: MarketKind[]; description: string;
}

/** Trading order matters: biased and noisy traders act first, the informed traders last, so prices end near the
 *  public-information consensus with residual noise (measured in docs/V3_ECONOMY.md and docs/M4_EXCHANGE.md). */
export const NPC_TRADERS: NpcTrader[] = [
  { id: 'npc:conservative', name: 'Old Harbour Fund', noise: 0.05, margin: 0.06, budgetShare: 0.02, bias: 'none', strategy: 'value', roles: ['pre', 'round'], description: 'Conservative liquidity seeker: trades only large mispricings, small size.' },
  { id: 'npc:fan', name: 'Crown Supporters Club', noise: 0.08, margin: 0.02, budgetShare: 0.05, bias: 'favourite', strategy: 'value', roles: ['pre', 'live'], description: 'Overconfident fans of the favourite.' },
  { id: 'npc:contrarian', name: 'Lantern Contrarians', noise: 0.08, margin: 0.04, budgetShare: 0.03, bias: 'underdog', strategy: 'value', roles: ['pre', 'round'], description: 'Back the underdog.' },
  { id: 'npc:novice', name: 'First-Time Forecasters', noise: 0.14, margin: 0.02, budgetShare: 0.03, bias: 'none', strategy: 'value', roles: ['pre', 'live'], description: 'Noisy novices.' },
  { id: 'npc:momentum', name: 'Tidewater Momentum', noise: 0, margin: 0.03, budgetShare: 0.02, bias: 'none', strategy: 'momentum', roles: ['live', 'round'], description: 'Buys whatever has risen since the last window (price history only).' },
  { id: 'npc:specialist', name: 'Summit Tournament Partners', noise: 0.03, margin: 0.02, budgetShare: 0.06, bias: 'none', strategy: 'value', roles: ['pre', 'round'], kinds: ['winner', 'bracket', 'season', 'promotion', 'qualification', 'advancement'], description: 'Tournament specialist: season and tournament markets only.' },
  { id: 'npc:tactician', name: 'Kestrel Tactical Desk', noise: 0.03, margin: 0.03, budgetShare: 0.04, bias: 'none', strategy: 'tactical', roles: ['live'], description: 'Trades in-play on the public engine evaluation of the current position.' },
  { id: 'npc:analyst', name: 'Meridian Analytics', noise: 0.03, margin: 0.02, budgetShare: 0.12, bias: 'none', strategy: 'value', roles: ['pre', 'round'], kinds: ['match', 'winner', 'season', 'promotion', 'qualification', 'bracket', 'length', 'advancement'], description: 'Calibrated fundamental trader on the public rating model.' },
];
export const NPC_WALLET_CAP = 4_000 * 1_000_000; // µ; topped up each season from the treasury up to this cap
/** Portfolio exposure cap: open cost basis may not exceed this share of the wallet. */
export const NPC_EXPOSURE_SHARE = 0.6;

/** Shares of claim S needed so that its price reaches `target` (closed form for the LMSR). */
export function sharesToClaimTarget(q: number[], b: number, S: readonly number[], target: number): number {
  const inS = new Set(S);
  const m = Math.max(...q.map(x => x / b));
  let A = 0, B = 0;
  q.forEach((x, s) => { const e = Math.exp(x / b - m); if (inS.has(s)) A += e; else B += e; });
  if (B === 0 || target <= 0 || target >= 1) return 0;
  return b * Math.log((target * B) / ((1 - target) * A));
}

export interface NpcContext {
  role: NpcRole;
  /** Public belief source per STATE: the published model, or the live model during play. */
  belief: number[];
  /** Price per claim at the previous window (momentum), if any. */
  previousClaimPrices?: number[];
  /** Open exposure (cost basis) per trader across other markets, µ. */
  exposure?: (trader: string) => number;
}

/** Run the eligible NPC traders once against an open market. */
export function npcTrade(market: Market, positions: Map<string, Position>, balances: (a: string) => number, seed: number, at: string, startSeq: number, ctx: NpcContext):
  { market: Market; journals: Journal[]; positions: Map<string, Position>; seq: number } {
  let m = market, seq = startSeq;
  const journals: Journal[] = [];
  const kind: MarketKind = m.kind ?? 'match';
  const claims = claimsOf(m);
  for (const t of NPC_TRADERS) {
    if (m.status !== 'open') break;
    if (!t.roles.includes(ctx.role) || (t.kinds && !t.kinds.includes(kind)) || (m.sandbox && kind !== 'sandbox')) continue;
    if (kind === 'sandbox') continue; // sandbox markets have no NPC participation
    const wallet = balances(t.id);
    if (wallet <= 0) continue;
    const r = rng01(hashSeed(seed, 'npc', t.id, m.id, ctx.role, m.history.length));
    const pr = claimPrices(m);
    // belief per claim
    let beliefStates = ctx.belief.map(x => Math.max(0.005, x + t.noise * normal(r)));
    if (t.bias !== 'none' && claims.length >= 2) {
      const order = ctx.belief.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]);
      const k = t.bias === 'favourite' ? order[0][1] : order[order.length - 1][1];
      beliefStates[k] += 0.06;
    }
    const sum = beliefStates.reduce((a, x) => a + x, 0);
    beliefStates = beliefStates.map(x => x / sum);
    const beliefClaims = claims.map(c => c.states.reduce((a, s) => a + beliefStates[s], 0));
    let pick = -1, target = 0;
    if (t.strategy === 'momentum') {
      if (!ctx.previousClaimPrices) continue;
      const rise = pr.map((p, i) => p - (ctx.previousClaimPrices![i] ?? p));
      const i = rise.indexOf(Math.max(...rise));
      if (rise[i] < t.margin) continue;
      pick = i; target = Math.min(0.97, pr[i] + rise[i] / 2);
    } else {
      // only claims that partition the states are traded by value traders (avoid double counting)
      // (default singleton claims s0…; listed singletons s0…; champion claims; "reaches the semifinals" claims semi:…)
      const tradable = claims.map((_, i) => i).filter(i => !m.claims || claims[i].id.startsWith('champ:') || claims[i].id.startsWith('s'));
      let best = 0;
      for (const i of tradable) { const e = beliefClaims[i] - pr[i] - t.margin; if (e > best) { best = e; pick = i; } }
      if (pick < 0) continue;
      target = Math.min(0.97, beliefClaims[pick] - t.margin);
    }
    let shares = Math.floor(sharesToClaimTarget(m.q, m.b, claims[pick].states, target));
    const budget = Math.floor(wallet * t.budgetShare);
    const room = Math.floor(wallet * NPC_EXPOSURE_SHARE) - (ctx.exposure?.(t.id) ?? 0);
    const limit = Math.min(budget, room);
    const costOf = (k: number) => { const c = buyClaimMicro(m.q, m.b, claims[pick].states, k); return c + feeMicro(c); };
    while (shares > 0 && costOf(shares) > limit) shares = Math.floor(shares / 2);
    if (shares <= 0) continue;
    const pos = positions.get(`${m.id}|${t.id}`) ?? null;
    const res = trade(m, pos, t.id, pick, shares, 'buy', at, seq++);
    m = res.market;
    positions.set(res.position.id, res.position);
    journals.push(res.journal);
  }
  return { market: m, journals, positions, seq };
}

/** v0.3-compatible entry point: opening liquidity on a match market from its published forecast. */
export function npcRound(market: Market, positions: Map<string, Position>, balances: (a: string) => number, seed: number, at: string, startSeq: number):
  { market: Market; journals: Journal[]; positions: Map<string, Position>; seq: number } {
  const f = market.forecast;
  return npcTrade(market, positions, balances, seed, at, startSeq, { role: 'pre', belief: market.model ?? [f.w, f.d, f.l] });
}
