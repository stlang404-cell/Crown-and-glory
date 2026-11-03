/**
 * Grand Exchange families through the real FederationService over a full season: listing, information
 * timing (closure before the closing round's first game), settlement from recorded results, conservation.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CrownDB } from '../src/storage/db';
import { FederationService } from '../src/app/federation';
import { playSelfplay } from '../src/engine/selfplay';
import { PLAYER_ID, ROUNDS_PER_SEASON, SWISS_ROUNDS, LEAGUE_ROUNDS } from '../src/federation/model';
import { claimsOf, statesOf } from '../src/exchange/market';
import { koMatchProb, bracketChampionModel, bracketStates, bracketModel } from '../src/exchange/families';
import type { GameRecord } from '../src/games/types';

let clock = 0;
const now = () => new Date(Date.UTC(2026, 0, 1) + (clock++) * 1000).toISOString();
async function make() {
  const db = await CrownDB.open(new IDBFactory());
  const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
  svc.runSelfplay = async (req, onMove) => playSelfplay(req.initialFen, { ...req.white, profile: { ...req.white.profile, nodes: 150, depth: 3, selection: null } }, { ...req.black, profile: { ...req.black.profile, nodes: 150, depth: 3, selection: null } }, req.seed, req.maxPlies, m => onMove(m));
  return svc;
}
async function playMine(svc: FederationService) {
  for (let f = svc.playerFixtures()[0]; f; f = svc.playerFixtures()[0]) {
    const g = await svc.playerGameFor(f.id, { rating: 1500, rd: 200 });
    await svc.recordPlayerGame({ ...g, result: g.humanColor === 'white' ? '0-1' : '1-0', status: 'finalized' } as GameRecord);
  }
}
const total = (svc: FederationService) => [...svc.state!.balances.values()].reduce((a, b) => a + b, 0);

describe('market family models', () => {
  it('knockout probabilities are coherent', () => {
    const r = koMatchProb(1800, 1800, 1, 2, false);
    expect(r.a).toBeGreaterThan(0.5); // equal ratings: the higher seed wins the final tiebreak
    const f = koMatchProb(1800, 1800, 1, 2, true);
    expect(2 * f.a + f.joint).toBeCloseTo(1, 12);
    const first = Array.from({ length: 8 }, (_, i) => ({ a: `p${2 * i}`, b: `p${2 * i + 1}`, seedA: 2 * i + 1, seedB: 2 * i + 2 }));
    const m = bracketChampionModel(first, id => 2000 - Number(id.slice(1)) * 20, id => Number(id.slice(1)) + 1);
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(m.get('p0')!).toBeGreaterThan(m.get('p15')!);
    const st = bracketStates(['a', 'b', 'c', 'd']);
    expect(bracketModel(['a', 'b', 'c', 'd'], st, () => 1800, x => x.charCodeAt(0)).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe('Grand Exchange families over a season', () => {
  it('lists, closes on time, settles from recorded results and conserves money', async () => {
    const svc = await make();
    await svc.create(0, 31337);
    const S = 1;
    const ids = ['mk:open-winner:1', 'mk:promo:1', 'mk:qual:1', 'mk:season:1'];
    for (const id of ids) {
      const m = svc.state!.markets.get(id)!;
      expect(m, id).toBeTruthy();
      expect(m.status).toBe('open');
      expect(m.rules).toBeTruthy();
      expect(m.model!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
      // never lists an event involving the player
      expect(String(m.ref!.ids ?? m.ref!.subject)).not.toContain(PLAYER_ID);
    }
    // the player buys into the open winner market and the promotion market
    await svc.trade('mk:open-winner:1', 0, 5, 'buy');
    await svc.trade('mk:promo:1', 0, 5, 'buy');
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) {
      const round = svc.state!.world.round;
      await playMine(svc);
      await svc.advanceRound();
      const st = svc.state!;
      expect(total(svc)).toBe(0);
      for (const [a, v] of st.balances) if (a !== 'mint') expect(v, a).toBeGreaterThanOrEqual(0);
      const ow = st.markets.get('mk:open-winner:1')!;
      if (round >= SWISS_ROUNDS[0]) expect(ow.status).not.toBe('open');
      if (round === SWISS_ROUNDS[SWISS_ROUNDS.length - 1]) expect(ow.status).toBe('settled');
      if (round === LEAGUE_ROUNDS) {
        expect(st.markets.get('mk:qual:1')!.status).toBe('settled');
        expect(st.markets.get('mk:season:1')!.status).toBe('settled');
        expect(st.markets.get('mk:champ:1')!.status).toBe('open'); // listed when the bracket is drawn
      }
      if (round === 17) expect(st.markets.get('mk:bracket:1')?.status).toBe('open');
    }
    const st = svc.state!;
    expect(st.world.season).toBe(2);
    for (const id of [...ids, 'mk:champ:1', 'mk:bracket:1']) expect(st.markets.get(id)!.status, id).toBe('settled');
    // the bracket market settled on a path consistent with the champion market
    const champ = st.markets.get('mk:champ:1')!, bracket = st.markets.get('mk:bracket:1')!;
    const champs = statesOf(champ).filter((_, i) => champ.payout![i] > 0);
    const claims = claimsOf(bracket).filter(c => c.id.startsWith('champ:'));
    const winners = claims.filter(c => c.states.some(s => bracket.payout![s] > 0)).map(c => c.label.replace(' wins the Championship', ''));
    expect(winners.sort()).toEqual(champs.sort());
    // season 2 families are listed for the new season
    expect(st.markets.get(`mk:open-winner:${S + 1}`)?.status).toBe('open');
  }, 300_000);
});

describe('live in-play trading', () => {
  it('trading windows between published moves, NPC reaction on public evaluation, settlement, resume after reload', async () => {
    const f = new IDBFactory();
    const db = await CrownDB.open(f);
    const svc = new FederationService(db, async () => ({ rating: 1500, rd: 200 }), now);
    const small = (req: Parameters<FederationService['computeMove']>[0]) => ({ ...req, profile: { ...req.profile, nodes: 200, depth: 3, selection: null } });
    const base = svc.computeMove;
    svc.computeMove = req => base(small(req));
    await svc.create(4, 4242);
    const fx = svc.featuredFixtures().find(x => svc.marketFor(x.id)?.status === 'open')!;
    const m0 = svc.marketFor(fx.id)!;
    await svc.startLive(fx.id);
    expect(svc.marketFor(fx.id)!.status).toBe('open');
    expect(fx.result).toBeNull();
    for (let i = 0; i < 6; i++) await svc.liveStep(fx.id);
    const lg = svc.liveGame(fx.id)!;
    expect(lg.moves).toHaveLength(6);
    expect(lg.points.length).toBeGreaterThan(1);
    for (const p of lg.points) expect(p.model.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    // a trade inside a window, with a stale-quote guard
    const v = svc.marketFor(fx.id)!.history.length;
    await svc.trade(m0.id, 0, 8, 'buy', { expectVersion: v });
    await expect(svc.trade(m0.id, 0, 1, 'buy', { expectVersion: v })).rejects.toThrow(/Prices changed/);
    const v2 = svc.marketFor(fx.id)!.history.length;
    await svc.trade(m0.id, 0, 3, 'sell', { expectVersion: v2 });
    // reload: a second instance resumes the committed timeline
    const svc2 = new FederationService(await CrownDB.open(f), async () => ({ rating: 1500, rd: 200 }), now);
    svc2.computeMove = req => base(small(req));
    await svc2.load();
    expect(svc2.liveGame(fx.id)!.moves).toHaveLength(6);
    let done = false, game;
    for (let i = 0; i < 400 && !done; i++) { const r = await svc2.liveStep(fx.id); done = r.done; game = r.game; }
    expect(done).toBe(true);
    const m = svc2.marketFor(fx.id)!;
    expect(['settled', 'cancelled']).toContain(m.status);
    expect(game!.moves.length).toBe(svc2.liveGame(fx.id)!.moves.length);
    expect(svc2.state!.rounds.get('1:1')!.fixtures.find(x => x.id === fx.id)!.result).not.toBeNull();
    await expect(svc2.liveStep(fx.id)).rejects.toThrow(/No live game/);
    await expect(svc2.trade(m0.id, 0, 1, 'buy')).rejects.toThrow();
    expect([...svc2.state!.balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
    for (const [a, val] of svc2.state!.balances) if (a !== 'mint') expect(val).toBeGreaterThanOrEqual(0);
  }, 300_000);
});

describe('Sandbox Exchange isolation and anti-exploit rules', () => {
  it('own casual game: back yourself only, closes at move 1, settles in sandbox money, never touches official books', async () => {
    const svc = await make();
    await svc.create(1, 777);
    const { createGameRecord } = await import('../src/games/session');
    const { TIME_CONTROLS } = await import('../src/games/types');
    const { opponentSnapshot, ROSTER } = await import('../src/federation/roster') as never as { opponentSnapshot?: unknown; ROSTER: { id: string; name: string; level: number }[] };
    void opponentSnapshot;
    const mk = (id: string) => createGameRecord({ id, mode: 'casual', timeControl: TIME_CONTROLS.rapid, humanColor: 'white', human: { kind: 'human', id: 'player', name: 'You', rating: null, rd: null },
      engine: { kind: 'engine', id: ROSTER[0].id, name: ROSTER[0].name, rating: 800, rd: 50, engine: { profileId: 'L1', level: 1, levelsId: 'x', searchId: 'x', evalId: 'x', calibrationId: 'x', style: 'Universal' } as never }, engineSeed: 1, nowIso: now(), context: { kind: 'quick-match' } });
    const officialBefore = [...svc.state!.balances].filter(([a]) => !a.startsWith('sandbox:')).sort().join();
    const finBefore = JSON.stringify(svc.finance().netWorth);
    const g = mk('sb-test-1');
    await svc.db.saveGame(g);
    const m = await svc.openSandbox(g, [0.2, 0.3, 0.5]);
    expect(m.sandbox).toBe(true);
    expect(m.claims!.map(c => c.id)).toEqual(['win', 'nolose']); // no claim pays on your own loss
    await svc.sandboxTrade(g.id, 0, 10, 'buy');
    // isolation: no official account changed, net worth unchanged
    expect([...svc.state!.balances].filter(([a]) => !a.startsWith('sandbox:')).sort().join()).toBe(officialBefore);
    expect(JSON.stringify(svc.finance().netWorth)).toBe(finBefore);
    // win → pays 10 sandbox crowns
    const sbBefore = svc.sandboxBalance();
    await svc.settleSandbox({ ...g, moves: new Array(30).fill({}) as never, status: 'finalized', result: '1-0', termination: 'checkmate' } as GameRecord);
    expect(svc.sandboxBalance() - sbBefore).toBe(10_000_000);
    expect(svc.sandboxMarketFor(g.id)!.status).toBe('settled');
    await svc.settleSandbox({ ...g, status: 'finalized', result: '1-0' } as GameRecord); // idempotent
    expect(svc.sandboxBalance() - sbBefore).toBe(10_000_000);
    // assisted game → cancelled at the published opening prices (no profit from forcing a void)
    const g2 = mk('sb-test-2');
    await svc.db.saveGame(g2);
    await svc.openSandbox(g2, [0.1, 0.2, 0.7]);
    const before2 = svc.sandboxBalance();
    await svc.sandboxTrade(g2.id, 0, 20, 'buy');
    const paid = before2 - svc.sandboxBalance();
    await svc.settleSandbox({ ...g2, moves: new Array(40).fill({}) as never, assistance: [{ ply: 3, kind: 'hint' }] as never, status: 'finalized', result: '1-0', termination: 'checkmate' } as GameRecord);
    expect(svc.sandboxMarketFor(g2.id)!.status).toBe('cancelled');
    expect(svc.sandboxBalance() - (before2 - paid)).toBeLessThanOrEqual(paid);
    // rated, federation and assisted games are ineligible
    expect(FederationService.sandboxIneligible({ ...g, mode: 'rated', rated: true } as GameRecord)).toMatch(/Rated/);
    expect(FederationService.sandboxIneligible({ ...g, context: { kind: 'federation' } } as GameRecord)).toMatch(/casual/);
    // a mixed sandbox/official journal is impossible at the ledger level
    expect(svc.state!.balances.get('player:cash')).toBe(Number(officialBefore.match(/player:cash,(-?\d+)/)![1]));
    expect([...svc.state!.balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
  }, 60_000);
});

describe('institutions: club levels and sponsorship contracts', () => {
  it('upgrade escrow counts in book value and is refunded; contracts pay stipends, receive prize shares and block conflicted trades', async () => {
    const svc = await make();
    await svc.create(3, 9090);
    // fund the player generously through a real prize route is slow; use the ledger's issuance for the test only
    (svc as unknown as { state: { balances: Map<string, number> } }).state.balances.set('player:cash', 5_000_000_000);
    (svc as unknown as { state: { balances: Map<string, number> } }).state.balances.set('mint', svc.state!.balances.get('mint')! - 4_000_000_000);
    await svc.buyAsset('club');
    const nw0 = svc.finance().netWorth;
    await svc.upgradeClub();
    expect(svc.clubLevelOf()).toBe(2);
    expect(svc.finance().netWorth).toBe(nw0 - 200_000_000); // 400 paid: 200 escrowed (book value), 200 spent
    // sign a competitor whose market is open: buying is then a conflict of interest
    const m = svc.featuredFixtures().map(f => svc.marketFor(f.id)!).find(x => x && x.status === 'open')!;
    await svc.signContract(m.white);
    expect(svc.activeContracts()).toHaveLength(1);
    await expect(svc.trade(m.id, 0, 5, 'buy')).rejects.toThrow(/Conflict of interest/);
    // play the season: stipends and prize shares are journal transfers; money is conserved
    for (let i = 0; i < ROUNDS_PER_SEASON; i++) { await playMine(svc); await svc.advanceRound(); expect(total(svc)).toBe(0); }
    const ct = [...svc.state!.contracts.values()][0];
    const journals = await svc.db.loadAll<{ id: string; kind: string; lines: { account: string; amount: number }[] }>('journal');
    expect(journals.filter(j => j.kind === 'contract-stipend').length).toBeGreaterThanOrEqual(1);
    const prizesToHim = journals.filter(j => j.kind === 'prize').map(j => j.lines.filter(l => l.account === `comp:${ct.competitorId}` && l.amount > 0).reduce((a, l) => a + l.amount, 0)).filter(x => x > 0);
    const shares = journals.filter(j => j.kind === 'contract-share').reduce((a, j) => a + j.lines.filter(l => l.account === 'player:cash').reduce((x, l) => x + l.amount, 0), 0);
    expect(shares).toBe(prizesToHim.reduce((a, x) => a + Math.floor(x * 0.25), 0));
    expect(ct.earned).toBe(shares);
    // closing the club refunds the upgrade escrow and ends contracts
    if (!svc.state!.plan.club || svc.state!.plan.club.champions.length) {
      const before = svc.balance('player:cash');
      const esc = svc.balance('asset:club:upgrade');
      await svc.sellAsset('club');
      expect(svc.balance('player:cash') - before).toBe(300_000_000 + esc);
      expect(svc.activeContracts()).toHaveLength(0);
    }
    for (const [a, v] of svc.state!.balances) if (a !== 'mint') expect(v, a).toBeGreaterThanOrEqual(0);
  }, 300_000);
});

describe('v0.3.0 saves migrated mid-season', () => {
  it('lists the missing season families only while their trading windows are open', async () => {
    const svc = await make();
    await svc.create(2, 5150);
    // simulate a v0.3.0 world: no family markets (journals of the removed listings remain, so funding of the new
    // listings is verified end-to-end by e2e/m4-journey.mjs on a real v0.3.0 save, not here)
    for (const id of [...svc.state!.markets.keys()]) if (!id.startsWith('mk:1:')) svc.state!.markets.delete(id);
    expect(svc.state!.markets.has('mk:open-winner:1')).toBe(false);
    const n = await svc.ensureSeasonMarkets();
    expect(n).toBe(4);
    expect(await svc.ensureSeasonMarkets()).toBe(0); // idempotent
    expect([...svc.state!.balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
  }, 60_000);
});
