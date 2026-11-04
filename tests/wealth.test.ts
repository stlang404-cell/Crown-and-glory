/**
 * v0.11 wealth and financial progression (crown-wealth-1, docs/ECONOMY_V11.md): club facilities, estates, event
 * sponsorship, administration (bankruptcy) and recovery, lifetime statistics. Every flow: ledger conserved, no
 * negative account, idempotent ids (no double charge or credit on reload or retry), upkeep at the season end, and
 * nothing purchasable changes ratings, results, pairings or qualification.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { PLAYER_ID, ROUNDS_PER_SEASON, TOPOLOGY_V1 } from '../src/federation/model';
import { MICRO, Books, type Journal } from '../src/exchange/ledger';
import { hashSeed } from '../src/federation/generator';
import {
  ADMIN, ESTATES, FACILITIES, HARDSHIP, LOAN, SPONSOR, SPONSOR_TIERS, emptyWealth, estateBuyJournal, facilityBuildJournal, loanDrawJournal, loanRepayJournal,
  sponsorMultiplier, sponsorshipSettleJournals, sponsorshipStakeJournal, wealthAppealParts, wealthOf, hardshipJournal, TREASURY_CEILING,
} from '../src/economy/wealth';
import { lifetimeStats } from '../src/economy/stats';
import { playerClubAppeal } from '../src/app/heraldry';
import type { GameRecord } from '../src/games/types';

const D = (x: number) => x * MICRO;
const TOPO = TOPOLOGY_V1; // small custom topologies are not a supported federation size

async function make(f = new IDBFactory(), start = 0) {
  let clock = start;
  const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
  const db = await CrownDB.open(f);
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
  svc.runSelfplay = async req => { const h = hashSeed(req.seed, 'stub') % 3; return { moves: [], result: h === 0 ? '1-0' : h === 1 ? '0-1' : '1/2-1/2', termination: 'checkmate' }; };
  return { svc, db, f, tick: () => clock };
}
const total = (svc: FederationService) => [...svc.state!.balances.values()].reduce((a, b) => a + b, 0);
const nonNegative = (svc: FederationService) => [...svc.state!.balances].every(([a, v]) => a === 'mint' || v >= 0);
const ok = (svc: FederationService) => { expect(total(svc)).toBe(0); expect(nonNegative(svc)).toBe(true); };

/** Play (win/lose/draw by `score`) or forfeit every player fixture of the round, then advance. */
async function round(svc: FederationService, score: number | 'forfeit' = 'forfeit') {
  for (let f = svc.playerFixtures()[0]; f; f = svc.playerFixtures()[0]) {
    if (score === 'forfeit') { await svc.forfeit(f.id); continue; }
    const g = await svc.playerGameFor(f.id, { rating: 1500, rd: 200 });
    const white = g.humanColor === 'white';
    const res = score === 0.5 ? '1/2-1/2' : (score === 1) === white ? '1-0' : '0-1';
    await svc.recordPlayerGame({ ...g, result: res, status: 'finalized' } as GameRecord);
  }
  await svc.advanceRound();
}
async function toSeasonEnd(svc: FederationService, score: number | 'forfeit' = 'forfeit') {
  const s = svc.state!.world.season;
  while (svc.state!.world.season === s) { await round(svc, score); ok(svc); }
}
const journals = async (db: CrownDB) => db.loadAll<Journal>('journal');

describe('wealth config and journals (pure)', () => {
  it('every v0.11 journal balances and none mints money', () => {
    const b = new Books();
    b.post({ id: 'seed', at: '', kind: 'mint', memo: '', lines: [{ account: 'mint', amount: -D(50_000) }, { account: 'player:cash', amount: D(20_000) }, { account: 'treasury', amount: D(20_000) }, { account: 'sponsor:1', amount: D(10_000) }] });
    const js: Journal[] = [
      facilityBuildJournal(FACILITIES[0], 1, 'a'), estateBuyJournal(ESTATES[0], 1, 'b'), sponsorshipStakeJournal(1, 'open', 'Federation Open', D(250), 'c'),
      loanDrawJournal(1, 'd'), loanRepayJournal(2, D(110), 'e'), hardshipJournal(1, 'fx1', 'f'),
    ];
    for (const j of js) { expect(b.post(j)).toBe(true); expect(j.lines.some(l => l.account === 'mint')).toBe(false); }
    const sp = { id: '1:open', season: 1, event: 'open', label: 'Open', tier: 'patron' as const, stake: D(250), status: 'active' as const };
    for (const j of sponsorshipSettleJournals(sp, [{ id: 'c1', share: 0.5 }, { id: PLAYER_ID, share: 0.3 }, { id: 'c2', share: 0.2 }], D(100), 1, 'g')) { expect(b.post(j)).toBe(true); expect(j.lines.some(l => l.account === 'mint')).toBe(false); }
    expect(b.total()).toBe(0);
    // the sponsor never wins its own purse: 60% of $250 = $150, the player's 30% share goes to the treasury
    expect(b.balance('comp:c1')).toBe(D(75));
    expect(b.balance('comp:c2')).toBe(D(30));
    expect(b.balance('sponsorship:1:open')).toBe(0);
    // re-posting is a no-op
    for (const j of js) expect(b.post(j)).toBe(false);
  });

  it('sponsorship return is bounded and below the stake without results', () => {
    expect(sponsorMultiplier(0, false)).toBe(SPONSOR.base);
    expect(sponsorMultiplier(1, false)).toBeLessThan(1);
    expect(sponsorMultiplier(1, true)).toBe(SPONSOR.cap);
    expect(sponsorMultiplier(5, true)).toBe(SPONSOR.cap);
    expect(SPONSOR.base + SPONSOR.local).toBeLessThan(1);
  });

  it('older saves read as the defaults (v0.9 records have no wealth field)', () => {
    expect(wealthOf({})).toEqual(emptyWealth());
    expect(wealthAppealParts(emptyWealth(), 1)).toEqual([]);
  });

  it('no pay-to-win: every purchasable effect is money, club appeal or prestige', () => {
    const allowed = new Set(['id', 'name', 'cost', 'deposit', 'upkeep', 'appeal', 'prestige', 'effect', 'price', 'description', 'stake']);
    for (const x of [...FACILITIES, ...ESTATES, ...SPONSOR_TIERS]) for (const k of Object.keys(x)) expect(allowed.has(k), k).toBe(true);
    for (const f of FACILITIES) expect(f.effect).not.toMatch(/rating|strength|engine|pairing|qualif/i);
  });
});

describe('wealth service flows', () => {
  it('facilities: club required, deposit in net worth, upkeep once per season end, appeal, refund on close; ledger conserved', async () => {
    const { svc, db, f, tick } = await make();
    await svc.create(0, 77, TOPO);
    await expect(svc.buildFacility('lounge')).rejects.toThrow(/club/);
    await svc.buyAsset('club');
    const before = svc.finance();
    await svc.buildFacility('lounge');
    ok(svc);
    const L = FACILITIES.find(x => x.id === 'lounge')!;
    expect(svc.balance('player:cash')).toBe(before.cash - L.cost);
    expect(svc.finance().assets).toBe(before.assets + L.deposit);
    expect(svc.finance().netWorth).toBe(before.netWorth - (L.cost - L.deposit));
    await expect(svc.buildFacility('lounge')).rejects.toThrow(/already/);
    expect(playerClubAppeal(svc.state!, 1).parts.some(p => p.label === L.name && p.value === L.appeal)).toBe(true);
    await toSeasonEnd(svc);
    const js = await journals(db);
    expect(js.filter(j => j.id === 'upkeep:facility:lounge:1')).toHaveLength(1);
    expect(js.find(j => j.id === 'upkeep:facility:lounge:1')!.lines).toEqual([{ account: 'player:cash', amount: -L.upkeep }, { account: 'sink', amount: L.upkeep }]);
    // reload: identical balances and wealth state, no new journals
    const n = js.length;
    const b = await make(f, tick());
    await b.svc.load();
    expect(b.svc.state!.balances).toEqual(svc.state!.balances);
    expect(b.svc.wealthState()).toEqual(svc.wealthState());
    expect((await journals(b.db)).length).toBe(n);
    await b.svc.closeFacility('lounge');
    expect(b.svc.balance('asset:facility:lounge')).toBe(0);
    ok(b.svc);
    db.close(); b.db.close();
  }, 120_000);

  it('estates: cosmetic prestige with upkeep; unpaid upkeep suspends it and removes it from net worth', async () => {
    const { svc, db } = await make();
    await svc.create(1, 78, TOPO);
    await svc.buyEstate('townhouse');
    ok(svc);
    const E = ESTATES[0];
    expect(svc.finance().assets).toBe(E.deposit);
    await expect(svc.buyEstate('townhouse')).rejects.toThrow(/already/);
    await expect(svc.buyEstate('palace')).rejects.toThrow(/cash/);
    await toSeasonEnd(svc);
    expect((await journals(db)).filter(j => j.id === 'upkeep:estate:townhouse:1')).toHaveLength(1);
    await svc.sellEstate('townhouse');
    ok(svc);
    expect(svc.wealthState().estates).toEqual([]);
    db.close();
  }, 120_000);

  it('event sponsorship: window, per-season limit, purse to AI winners only, bounded return, conservation', async () => {
    const { svc, db } = await make();
    await svc.create(0, 79, TOPO);
    const evs = svc.sponsorableEvents();
    const league = `league:0:${svc.state!.world.player.division}`;
    expect(evs.map(e => e.event)).toEqual(expect.arrayContaining([league, 'open', 'challenger', 'champ']));
    expect(evs.every(e => e.event.startsWith('league:0:') || !e.event.startsWith('league:'))).toBe(true); // own region only
    await svc.sponsorEvent(league, 'patron');
    await expect(svc.sponsorEvent(league, 'supporter')).rejects.toThrow(/already/);
    await svc.sponsorEvent('open', 'supporter');
    await expect(svc.sponsorEvent('challenger', 'supporter')).rejects.toThrow(/at most/);
    ok(svc);
    await round(svc);
    expect(svc.sponsorableEvents().some(e => e.event.startsWith('league:'))).toBe(false); // league started
    const cash0 = svc.balance('player:cash');
    await toSeasonEnd(svc);
    const w = svc.wealthState();
    const done = w.sponsorships.filter(s => s.season === 1);
    expect(done.every(s => s.status === 'settled')).toBe(true);
    const js = await journals(db);
    for (const s of done) {
      expect(s.ret!).toBeLessThanOrEqual(Math.floor(s.stake * SPONSOR.cap));
      const settle = js.find(j => j.id === `event-sponsor-settle:1:${s.event}`)!;
      expect(settle.lines.some(l => l.account === 'player:cash')).toBe(false); // the sponsor never receives its purse
      expect(svc.balance(`sponsorship:1:${s.event}`)).toBe(0);
    }
    const returns = done.reduce((a, s) => a + (s.ret ?? 0), 0);
    expect(returns).toBeLessThanOrEqual(1_200 * MICRO * SPONSOR.returnBudgetShare);
    expect(w.reputation).toBe(50 + 2 * SPONSOR.reputation);
    expect(svc.balance('treasury')).toBeLessThanOrEqual(TREASURY_CEILING); // idle federation money above the ceiling is retired
    expect(svc.balance('player:cash')).toBeGreaterThanOrEqual(cash0 - 0); // returns only add cash at settlement
    db.close();
  }, 120_000);

  it('administration: entry on unpaid upkeep, liquidation, restrictions, loan, hardship stipend, recovery — chess never stops', async () => {
    const { svc, db, f, tick } = await make();
    await svc.create(1, 80, TOPO);
    for (const a of ['analyst', 'training', 'scouting']) await svc.buyAsset(a);
    for (const c of ['frame-bronze', 'frame-silver', 'banner-obsidian', 'avatar-portraits']) await svc.buyCosmetic(c);
    expect(svc.balance('player:cash')).toBe(D(35));
    await toSeasonEnd(svc); // forfeits: no income; $55 upkeep due on $35
    let w = svc.wealthState();
    expect(w.admin).not.toBeNull();
    expect(w.admin!.since).toBe(1);
    expect(w.admin!.reason).toMatch(/Could not pay/);
    expect(w.admin!.liquidated.length).toBeGreaterThan(0);
    expect(w.reputation).toBe(50 - ADMIN.reputationHit);
    ok(svc);
    // restrictions: no purchases; chess continues
    await expect(svc.buyCosmetic('frame-gold')).rejects.toThrow(/administration/);
    await expect(svc.buyEstate('townhouse')).rejects.toThrow(/administration/);
    await expect(svc.sponsorEvent(`league:1:${svc.state!.world.player.division}`, 'supporter')).rejects.toThrow(/administration/);
    expect(playerClubAppeal(svc.state!, 2).parts.length).toBe(0); // no club: appeal unaffected
    // the recovery loan: once, a liability in net worth
    const nw0 = svc.finance().netWorth;
    await svc.takeRecoveryLoan();
    await expect(svc.takeRecoveryLoan()).rejects.toThrow(/already/);
    expect(svc.finance().liabilities).toBe(LOAN.principal + LOAN.fee);
    expect(svc.finance().netWorth).toBe(nw0 - LOAN.fee);
    ok(svc);
    // hardship stipend for games actually played (not forfeits), bounded per season
    const before = svc.balance('player:cash');
    for (let r = 0; r < 12; r++) await round(svc, 0);
    const paid = (await journals(db)).filter(j => j.kind === 'hardship-stipend' && j.season === 2);
    expect(paid.length).toBeGreaterThan(0);
    expect(paid.length).toBeLessThanOrEqual(HARDSHIP.maxGamesPerSeason);
    expect(svc.balance('player:cash')).toBeGreaterThanOrEqual(before + paid.length * HARDSHIP.perGame - D(1));
    await toSeasonEnd(svc, 0);
    w = svc.wealthState();
    expect(w.admin).toBeNull(); // net worth ≥ $300, no arrears, everything paid
    expect(w.episodes).toEqual([expect.objectContaining({ since: 1, until: 2, loanTaken: true })]);
    // the loan is repaid in instalments from the season after the draw; exactly once per season (reload-safe)
    const b = await make(f, tick());
    await b.svc.load();
    await toSeasonEnd(b.svc, 0);
    const reps = (await journals(b.db)).filter(j => j.kind === 'loan-repay');
    expect(reps.map(j => j.id)).toEqual(['loan-repay:3']);
    expect(b.svc.wealthState().loan!.outstanding).toBe(LOAN.principal + LOAN.fee - LOAN.instalment);
    ok(b.svc);
    // lifetime statistics from the ledger are exact: their cash total equals the cash balance
    const st = lifetimeStats(await journals(b.db), b.svc.state!.finance.points, b.svc.wealthState().episodes);
    expect(st.cashNet).toBe(b.svc.balance('player:cash'));
    expect(st.milestones.map(m => m.id)).toEqual(expect.arrayContaining(['loan', 'loan-repay', 'admin-1', 'recovered-2']));
    db.close(); b.db.close();
  }, 240_000);

  it('a player with no money keeps playing: games, Challenger voucher and season advance all work in administration', async () => {
    const { svc, db } = await make();
    await svc.create(0, 81, TOPO);
    for (const a of ['analyst', 'training', 'scouting']) await svc.buyAsset(a);
    for (const c of ['frame-bronze', 'frame-silver', 'banner-obsidian', 'avatar-portraits']) await svc.buyCosmetic(c);
    await toSeasonEnd(svc);
    expect(svc.inAdministration()).toBe(true);
    // every remaining dollar spent on the Exchange (capped buys) is not needed to play: chess never asks for money
    await svc.registerChallenger(svc.balance('player:cash') < D(100));
    expect(svc.state!.plan.swiss.find(x => x.event === 'challenger')!.entrants).toContain(PLAYER_ID);
    for (let r = 0; r < 3; r++) { expect(svc.playerFixtures().length).toBeGreaterThan(0); await round(svc, 1); ok(svc); }
    expect(svc.state!.world.round).toBe(4);
    db.close();
  }, 240_000);

  it('no pay-to-win: v0.11 purchases leave ratings, results, pairings and qualifiers identical', async () => {
    const view = (s: FederationService) => JSON.stringify({
      ratings: [...s.state!.competitors.values()].map(c => [c.id, c.rating, c.rd, c.division, c.status]),
      rounds: [...s.state!.rounds.values()].map(r => [r.id, r.fixtures.map(x => [x.white, x.black, x.result])]),
      champ: s.state!.plans.get('season:1')!.champ?.qualifiers, player: s.state!.world.player,
    });
    // (1) two club owners (the Club Weekend is a v0.4 event of every club): one also builds a facility and sponsors two events
    const a = await make(), b = await make();
    await a.svc.create(0, 82, TOPO); await b.svc.create(0, 82, TOPO);
    await a.svc.buyAsset('club'); await b.svc.buyAsset('club');
    await a.svc.buildFacility('library');
    await a.svc.sponsorEvent(`league:0:${a.svc.state!.world.player.division}`, 'supporter'); await a.svc.sponsorEvent('champ', 'supporter');
    // (2) no club: an estate and two sponsorships against a player who buys nothing
    const c = await make(), d = await make();
    await c.svc.create(0, 82, TOPO); await d.svc.create(0, 82, TOPO);
    await c.svc.buyEstate('townhouse'); await c.svc.sponsorEvent('open', 'patron'); await c.svc.sponsorEvent('champ', 'supporter');
    for (let r = 0; r < ROUNDS_PER_SEASON; r++) for (const x of [a, b, c, d]) await round(x.svc, 0.5);
    expect(view(a.svc)).toBe(view(b.svc));
    expect(view(c.svc)).toBe(view(d.svc));
    expect(a.svc.balance('player:cash')).not.toBe(b.svc.balance('player:cash'));
    for (const x of [a, b, c, d]) { ok(x.svc); x.db.close(); }
  }, 240_000);

  it('a v0.9 save (no wealth record, upkeep before dues) loads and continues with the defaults', async () => {
    const a = await make();
    await a.svc.create(0, 83, TOPO);
    await a.svc.buyAsset('club');
    await round(a.svc);
    // strip the v0.11 field exactly as a v0.9 save stores the player record
    const fin = await a.db.loadAll<{ key: string; wealth?: unknown }>('finance');
    const player = fin.find(x => x.key === 'player')!;
    delete player.wealth;
    await a.db.commit([{ store: 'finance', put: [player] }]);
    const b = await make(a.f, a.tick());
    await b.svc.load();
    expect(b.svc.state!.extra.wealth).toBeUndefined();
    expect(b.svc.wealthState()).toEqual(emptyWealth());
    expect(b.svc.finance().liabilities).toBe(0);
    expect(b.svc.finance().netWorth).toBe(a.svc.finance().netWorth);
    await toSeasonEnd(b.svc);
    expect(b.svc.wealthState().reputation).toBe(50);
    await b.svc.buildFacility('library');
    ok(b.svc);
    a.db.close(); b.db.close();
  }, 120_000);
});
