/**
 * Federation service: the single authoritative command layer for the living federation, the Crown
 * Exchange and the economy. Each command (1) clones the cached state, (2) computes the next state with
 * the pure domain functions, (3) validates every ledger journal against the cloned balances and (4)
 * commits ALL changed records in ONE IndexedDB transaction, guarded by the committed world cursor.
 * Only after the commit succeeds is the in-memory cache replaced. A crash or failed commit leaves the
 * previous consistent state; retries are idempotent via journal ids and the round cursor.
 * The UI reads from this service and never mutates money, ratings or results directly.
 */
import { CrownDB, FederationStore } from '../storage/db';
import { generateFederation, hashSeed } from '../federation/generator';
import { createWorld, joinPlayer, openRound, registerChallenger as registerChallengerPure, settleRound, Ctx, RoundRecord, SeasonPlan, WorldState, leagueTable, swissTable } from '../federation/world';
import { processRound, gamesOf, ProcessedRound } from '../federation/driver';
import { Competitor, Fixture, PLAYER_ID, SWISS_ROUNDS, LEAGUE_ROUNDS, CHAMPIONSHIP_ROUNDS, ROUNDS_PER_SEASON, CLUB_ROUNDS, StyleId } from '../federation/model';
import { wdl, RESULT_MODEL_ID } from '../federation/resultModel';
import { profileForStrength } from '../federation/profiles';
import { Journal, validateJournal, MICRO } from '../exchange/ledger';
import { Market, Position, openMarket, trade, closeMarket, settleMarket, cancelMarket, acct, liquidationValue } from '../exchange/market';
import { NPC_TRADERS, NPC_WALLET_CAP, npcRound } from '../exchange/npc';
import { subsidyMicro } from '../exchange/lmsr';
import {
  ASSETS, OwnedAsset, assetType, assetValue, genesisJournals, prizePools, seasonStartJournals, payPool, sponsorJournal, purchaseJournal, saleJournal, upkeepJournal,
  CHALLENGER_FEE, RECOVERY_THRESHOLD, treasuryReplenishJournal, voucherJournal, entryFeeJournal, LEAGUE_SPLIT, SWISS_SPLIT, CHAMP_SPLIT, netWorth,
} from '../economy/economy';
import { playSelfplay, SelfplayMove } from '../engine/selfplay';
import type { GameRecord } from '../games/types';
import type { KoMatch } from '../federation/formats';
import type { KoState } from '../federation/world';

export interface WorldGame {
  id: string; fixtureId: string; season: number; round: number; event: string; stage?: string;
  white: string; black: string; whiteName: string; blackName: string; whiteRating: number; blackRating: number;
  initialFen: string; moves: SelfplayMove[]; result: '1-0' | '0-1' | '1/2-1/2'; termination: string;
  createdAt: string; mode: 'watched-live' | 'background'; seed: number; profiles: string[];
}
export interface FinanceHistory { key: 'history'; points: { season: number; round: number; at: string; cash: number; assets: number; positions: number; netWorth: number }[]; peak: number }
export interface PlayerExtra { key: 'player'; watchlist: string[]; sponsorsPaid: string[]; vouchers: number[]; sandboxGranted: boolean; forecasts: { marketId: string; probs: number[]; at: string; outcome: number | null }[] }

const START_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
const FEATURED_NODE_CAP = 30_000;
const MARKET_B = 120;
const NPC_FUND = 2_000 * MICRO;
export const COMPETITOR_EXPENSE_SHARE = 0.75;

export interface FedState {
  world: WorldState;
  plan: SeasonPlan;
  plans: Map<string, SeasonPlan>;
  competitors: Map<string, Competitor>;
  rounds: Map<string, RoundRecord>;
  markets: Map<string, Market>;
  positions: Map<string, Position>;
  balances: Map<string, number>;
  journalIds: Set<string>;
  assets: Map<string, OwnedAsset>;
  finance: FinanceHistory;
  extra: PlayerExtra;
}

type Writes = { store: FederationStore | 'games'; put?: unknown[]; del?: string[] }[];

export class FederationService {
  state: FedState | null = null;
  private busy = false;
  live = new Map<string, SelfplayMove[]>();
  onChange: (() => void) | null = null;
  /** Featured-game runner: the app plugs in a Web Worker; tests run in-process. */
  runSelfplay: (req: { initialFen: string; white: { profile: ReturnType<typeof profileForStrength>; style: StyleId }; black: { profile: ReturnType<typeof profileForStrength>; style: StyleId }; seed: number; maxPlies: number }, onMove: (m: SelfplayMove) => void) => Promise<{ moves: SelfplayMove[]; result: '1-0' | '0-1' | '1/2-1/2'; termination: string }>
    = async (req, onMove) => playSelfplay(req.initialFen, req.white, req.black, req.seed, req.maxPlies, m => onMove(m));

  constructor(readonly db: CrownDB, readonly playerRating: () => Promise<{ rating: number; rd: number }>, readonly now: () => string = () => new Date().toISOString()) {}

  get ready(): boolean { return this.state !== null; }

  async load(): Promise<void> {
    const [worlds, seasons, comps, rounds, markets, positions, accounts, journal, assets, finance] = await Promise.all([
      this.db.loadAll<WorldState>('world'), this.db.loadAll<SeasonPlan>('seasons'), this.db.loadAll<Competitor>('competitors'), this.db.loadAll<RoundRecord>('rounds'),
      this.db.loadAll<Market>('markets'), this.db.loadAll<Position>('positions'), this.db.loadAll<{ account: string; balance: number }>('accounts'),
      this.db.loadAll<Journal>('journal'), this.db.loadAll<OwnedAsset>('assets'), this.db.loadAll<FinanceHistory | PlayerExtra>('finance'),
    ]);
    const world = worlds.find(w => w.key === 'world');
    if (!world) { this.state = null; return; }
    const plans = new Map(seasons.map(p => [p.id, p]));
    this.state = {
      world, plan: plans.get(`season:${world.season}`)!, plans,
      competitors: new Map(comps.map(c => [c.id, c])), rounds: new Map(rounds.map(r => [r.id, r])),
      markets: new Map(markets.map(m => [m.id, m])), positions: new Map(positions.map(p => [p.id, p])),
      balances: new Map(accounts.map(a => [a.account, a.balance])), journalIds: new Set(journal.map(j => j.id)),
      assets: new Map(assets.map(a => [a.id, a])),
      finance: (finance.find(f => f.key === 'history') as FinanceHistory) ?? { key: 'history', points: [], peak: 0 },
      extra: (finance.find(f => f.key === 'player') as PlayerExtra) ?? { key: 'player', watchlist: [], sponsorsPaid: [], vouchers: [], sandboxGranted: false, forecasts: [] },
    };
  }

  // ------------------------------------------------------------------ helpers
  private clone(): FedState {
    const s = this.state!;
    return {
      world: structuredClone(s.world), plan: structuredClone(s.plan), plans: new Map(s.plans),
      competitors: new Map([...s.competitors].map(([k, v]) => [k, structuredClone(v)])),
      rounds: new Map(s.rounds), markets: new Map(s.markets), positions: new Map(s.positions),
      balances: new Map(s.balances), journalIds: new Set(s.journalIds), assets: new Map(s.assets),
      finance: structuredClone(s.finance), extra: structuredClone(s.extra),
    };
  }
  balance(account: string): number { return this.state?.balances.get(account) ?? 0; }

  /** Validate and apply journals to a working state (idempotent: existing ids are skipped). */
  private post(st: FedState, journals: (Journal | null)[], posted: Journal[]): void {
    for (const j of journals) {
      if (!j || st.journalIds.has(j.id)) continue;
      validateJournal(j, a => st.balances.get(a) ?? 0);
      for (const l of j.lines) st.balances.set(l.account, (st.balances.get(l.account) ?? 0) + l.amount);
      st.journalIds.add(j.id);
      posted.push({ ...j, at: j.at || this.now() });
    }
  }

  private ctxOf(st: FedState, player: { rating: number; rd: number }): Ctx {
    const seasonRounds = [...st.rounds.values()].filter(r => r.season === st.world.season);
    const swissHistory = gamesOf(seasonRounds).filter(g => g.event === 'open' || g.event === 'challenger');
    return { world: st.world, plan: st.plan, competitors: st.competitors, player: { ...player, name: 'You' }, swissHistory };
  }

  /** Serialize commands: one at a time, guarded by the committed cursor. */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('Another federation operation is in progress');
    this.busy = true;
    try { return await fn(); } finally { this.busy = false; }
  }

  private async commit(next: FedState, posted: Journal[], changed: { competitors?: boolean; rounds?: RoundRecord[]; markets?: Market[]; positions?: Position[]; plans?: SeasonPlan[]; assets?: OwnedAsset[]; delAssets?: string[]; worldGames?: WorldGame[] }, expect: { season: number; round: number } | null): Promise<void> {
    const accounts = new Set(posted.flatMap(j => j.lines.map(l => l.account)));
    const writes: Writes = [
      { store: 'world', put: [next.world] },
      { store: 'seasons', put: changed.plans ?? [next.plan] },
      { store: 'finance', put: [next.finance, next.extra] },
      { store: 'journal', put: posted },
      { store: 'accounts', put: [...accounts].map(a => ({ account: a, balance: next.balances.get(a) ?? 0 })) },
    ];
    if (changed.competitors) writes.push({ store: 'competitors', put: [...next.competitors.values()] });
    if (changed.rounds?.length) writes.push({ store: 'rounds', put: changed.rounds });
    if (changed.markets?.length) writes.push({ store: 'markets', put: changed.markets });
    if (changed.positions?.length) writes.push({ store: 'positions', put: changed.positions });
    if (changed.assets?.length || changed.delAssets?.length) writes.push({ store: 'assets', put: changed.assets ?? [], del: changed.delAssets ?? [] });
    if (changed.worldGames?.length) writes.push({ store: 'worldGames', put: changed.worldGames });
    await this.db.commit(writes, async get => {
      const w = (await get('world', 'world')) as WorldState | undefined;
      if (expect && (!w || w.season !== expect.season || w.round !== expect.round)) throw new Error('World changed underneath this command (stale or duplicate); reload');
      if (!expect && w) throw new Error('A federation already exists');
      for (const j of posted.slice(0, 3)) if (await get('journal', j.id)) throw new Error(`Journal ${j.id} already committed`);
    });
    this.state = next;
    this.onChange?.();
  }

  private snapshotFinance(st: FedState): void {
    const cash = st.balances.get('player:cash') ?? 0;
    const assets = [...st.assets.values()].filter(a => !a.suspended).reduce((s, a) => s + assetValue(assetType(a.typeId)), 0);
    const positions = [...st.positions.values()].filter(p => p.holder === 'player:cash').reduce((s, p) => s + liquidationValue(st.markets.get(p.marketId)!, p), 0);
    const nw = netWorth(cash, assets, positions);
    st.finance.points.push({ season: st.world.season, round: st.world.round, at: this.now(), cash, assets, positions, netWorth: nw });
    if (st.finance.points.length > 2000) st.finance.points.splice(0, st.finance.points.length - 2000);
    st.finance.peak = Math.max(st.finance.peak, nw);
  }

  // ------------------------------------------------------------------ creation
  async create(region: number, seed = Date.now() % 2_147_483_647): Promise<void> {
    return this.run(async () => {
      if (this.state) throw new Error('A federation already exists');
      const comps = generateFederation(seed);
      const { world, plan } = createWorld(seed, comps, this.now());
      const st: FedState = {
        world, plan, plans: new Map([[plan.id, plan]]), competitors: new Map(comps.map(c => [c.id, c])), rounds: new Map(), markets: new Map(), positions: new Map(),
        balances: new Map(), journalIds: new Set(), assets: new Map(), finance: { key: 'history', points: [], peak: 0 },
        extra: { key: 'player', watchlist: [], sponsorsPaid: [], vouchers: [], sandboxGranted: false, forecasts: [] },
      };
      const player = await this.playerRating();
      const ctx = this.ctxOf(st, player);
      joinPlayer(ctx, region);
      const posted: Journal[] = [];
      this.post(st, genesisJournals(this.now(), NPC_TRADERS.map(t => t.id), NPC_FUND), posted);
      this.post(st, seasonStartJournals(1, prizePools(st.plan.circuits), this.now()), posted);
      const opened = this.openRoundWithMarkets(st, ctx, posted);
      st.rounds.set(opened.rec.id, opened.rec);
      this.snapshotFinance(st);
      await this.commit(st, posted, { competitors: true, rounds: [opened.rec], markets: opened.markets, positions: opened.positions }, null);
    });
  }

  /** Open the current round, choose featured (engine) games and open their markets with NPC trading. */
  private openRoundWithMarkets(st: FedState, ctx: Ctx, posted: Journal[]): { rec: RoundRecord; markets: Market[]; positions: Position[] } {
    const rec = openRound(ctx);
    settleNothing(rec);
    const featured = this.chooseFeatured(st, rec);
    const markets: Market[] = [];
    const positions: Position[] = [];
    for (const f of featured) {
      // a market opens only with its worst-case subsidy funded; otherwise the match is still featured, unlisted
      if ((st.balances.get('treasury') ?? 0) < subsidyMicro(MARKET_B, 3)) continue;
      const w = st.competitors.get(f.white)!, b = st.competitors.get(f.black)!;
      const p = wdl(w.rating, b.rating);
      const { market, journal } = openMarket({ id: `mk:${f.id}`, sandbox: false, fixtureId: f.id, title: `${w.name} – ${b.name}`, white: f.white, black: f.black, season: rec.season, round: rec.round, b: MARKET_B, forecast: { ...p, source: `${RESULT_MODEL_ID} on public ratings` }, at: this.now() });
      this.post(st, [journal], posted);
      // NPC trading on public information; all-or-nothing per market so the market and ledger never diverge
      const res = npcRound(market, new Map(), a => st.balances.get(a) ?? 0, st.world.seed, this.now(), 1);
      let m = market;
      const trial = new Map(st.balances);
      let ok = true;
      for (const j of res.journals) { try { validateJournal(j, a => trial.get(a) ?? 0); for (const l of j.lines) trial.set(l.account, (trial.get(l.account) ?? 0) + l.amount); } catch { ok = false; break; } }
      if (ok) {
        this.post(st, res.journals, posted);
        m = res.market;
        for (const p2 of res.positions.values()) { st.positions.set(p2.id, p2); positions.push(p2); }
      }
      st.markets.set(m.id, m); markets.push(m);
    }
    return { rec, markets, positions };
  }

  /** Featured games: up to three per round, chosen by public rating; never involving the player. */
  private chooseFeatured(st: FedState, rec: RoundRecord): Fixture[] {
    const rating = (id: string) => st.competitors.get(id)?.rating ?? 0;
    const cands: { f: Fixture; score: number; kind: string }[] = [];
    rec.abstract.forEach(([event, white, black], i) => {
      const kind = event.startsWith('league:') ? (event.endsWith(':1') ? (event === `league:${st.world.player.region}:1` ? 'home-top' : 'top') : 'league') : event;
      if (kind === 'league') return;
      cands.push({ f: { id: `${rec.season}:${rec.round}:${event}:f${i}`, season: rec.season, round: rec.round, event, white, black, result: null, tier: 2, gameId: null }, score: rating(white) + rating(black), kind });
    });
    for (const f of rec.fixtures) if (f.tier === 3 && f.event === 'champ' && f.result === null) cands.push({ f, score: rating(f.white) + rating(f.black) + 1e5, kind: 'champ' });
    const pick: typeof cands = [];
    const by = (k: string) => cands.filter(c => c.kind === k).sort((a, b) => b.score - a.score);
    for (const k of ['champ', 'home-top', 'open', 'top', 'challenger']) for (const c of by(k)) { if (pick.length < 3 && !pick.some(p => p.kind === k && k !== 'champ')) pick.push(c); }
    const featured: Fixture[] = [];
    for (const c of pick.slice(0, 3)) {
      if (c.kind === 'champ') { c.f.tier = 2; featured.push(c.f); continue; }
      const idx = rec.abstract.findIndex(a => a[0] === c.f.event && a[1] === c.f.white && a[2] === c.f.black);
      rec.abstract.splice(idx, 1);
      rec.fixtures.push(c.f);
      featured.push(c.f);
    }
    return featured;
  }

  // ------------------------------------------------------------------ queries
  currentRound(): RoundRecord | null { const s = this.state; return s ? s.rounds.get(`${s.world.season}:${s.world.round}`) ?? null : null; }
  seasonRounds(season?: number): RoundRecord[] { const s = this.state!; const n = season ?? s.world.season; return [...s.rounds.values()].filter(r => r.season === n).sort((a, b) => a.round - b.round); }
  playerFixtures(): Fixture[] { return this.currentRound()?.fixtures.filter(f => f.tier === 1 && f.result === null) ?? []; }
  featuredFixtures(): Fixture[] { return this.currentRound()?.fixtures.filter(f => f.tier === 2) ?? []; }
  marketFor(fixtureId: string): Market | undefined { return this.state?.markets.get(`mk:${fixtureId}`); }
  name(id: string): string { return id === PLAYER_ID ? 'You' : this.state?.competitors.get(id)?.name ?? id; }
  ratingOf(id: string): number { return this.state?.competitors.get(id)?.rating ?? 0; }

  // ------------------------------------------------------------------ player league games
  /** Create (or return) the rated game record for a player fixture. Opponent strength comes from hidden latent via the calibrated profile map. */
  async playerGameFor(fixtureId: string, human: { rating: number | null; rd: number | null }): Promise<GameRecord> {
    const f = this.currentRound()!.fixtures.find(x => x.id === fixtureId);
    if (!f || f.tier !== 1) throw new Error('Not a player fixture');
    const existing = (await this.db.allGames()).find(g => g.context.fixtureId === fixtureId);
    if (existing) return existing;
    const oppId = f.white === PLAYER_ID ? f.black : f.white;
    const c = this.state!.competitors.get(oppId)!;
    const profile = profileForStrength(c.latent);
    const { createGameRecord } = await import('../games/session');
    const { TIME_CONTROLS } = await import('../games/types');
    const { LEVELS_ID } = await import('../engine/levels');
    const { SEARCH_ID } = await import('../engine/search');
    const { EVAL_ID } = await import('../engine/evaluate');
    const { playStyle, STYLE_LABEL } = await import('../engine/styles');
    const style = playStyle(c.style);
    const rec = createGameRecord({
      id: `fed-${fixtureId.replace(/:/g, '-')}`, mode: 'rated', timeControl: TIME_CONTROLS.rapid, humanColor: f.white === PLAYER_ID ? 'white' : 'black',
      human: { kind: 'human', id: 'player', name: 'You', rating: human.rating, rd: human.rd },
      engine: { kind: 'engine', id: c.id, name: c.name, rating: c.rating, rd: c.rd, engine: { profileId: profile.id, level: 0, levelsId: LEVELS_ID, searchId: SEARCH_ID, evalId: EVAL_ID, calibrationId: 'federation-public-rating', style: STYLE_LABEL[style], profile, styleId: style } },
      engineSeed: hashSeed(this.state!.world.seed, 'player-game', fixtureId), nowIso: this.now(),
      context: { kind: 'federation', fixtureId, tournamentId: f.event, eventName: eventName(f.event) },
    });
    return rec;
  }

  /** Training Hall: an unrated practice game against a fixture opponent's exact profile (never a federation result). */
  async sparringGameFor(fixtureId: string, humanColor: 'white' | 'black'): Promise<GameRecord> {
    if (!this.ownsAsset('training')) throw new Error('Sparring needs a Training Hall');
    const f = this.currentRound()?.fixtures.find(x => x.id === fixtureId);
    if (!f || f.tier !== 1) throw new Error('Not one of your fixtures');
    const c = this.state!.competitors.get(f.white === PLAYER_ID ? f.black : f.white)!;
    const profile = profileForStrength(c.latent);
    const { createGameRecord } = await import('../games/session');
    const { TIME_CONTROLS } = await import('../games/types');
    const { LEVELS_ID } = await import('../engine/levels');
    const { SEARCH_ID } = await import('../engine/search');
    const { EVAL_ID } = await import('../engine/evaluate');
    const { playStyle, STYLE_LABEL } = await import('../engine/styles');
    const style = playStyle(c.style);
    return createGameRecord({
      id: `spar-${fixtureId.replace(/:/g, '-')}-${Date.now().toString(36)}`, mode: 'casual', timeControl: TIME_CONTROLS.rapid, humanColor,
      human: { kind: 'human', id: 'player', name: 'You', rating: null, rd: null },
      engine: { kind: 'engine', id: `spar:${c.id}`, name: `${c.name} (sparring)`, rating: null, rd: null, engine: { profileId: profile.id, level: 0, levelsId: LEVELS_ID, searchId: SEARCH_ID, evalId: EVAL_ID, calibrationId: 'federation-sparring', style: STYLE_LABEL[style], profile, styleId: style } },
      engineSeed: (Date.now() % 2_147_483_647) >>> 0, nowIso: this.now(),
      context: { kind: 'quick-match', eventName: `Sparring vs ${c.name}` },
    });
  }

  /** Called after a federation game has been finalized by the normal (atomic, rated) path. */
  async recordPlayerGame(game: GameRecord): Promise<void> {
    return this.run(async () => {
      const fixtureId = game.context.fixtureId;
      if (!fixtureId || !game.result) return;
      const st = this.clone();
      const rec = structuredClone(st.rounds.get(`${st.world.season}:${st.world.round}`)!);
      const f = rec.fixtures.find(x => x.id === fixtureId);
      if (!f || f.result !== null) return; // already recorded (idempotent) or stale
      f.result = game.result === '1-0' ? 1 : game.result === '0-1' ? 0 : 0.5;
      f.gameId = game.id;
      st.rounds.set(rec.id, rec);
      const posted: Journal[] = [];
      const won = (f.white === PLAYER_ID ? f.result : 1 - f.result) === 1;
      if (won && !st.extra.sponsorsPaid.includes('first-federation-win')) {
        const j = sponsorJournal(st.world.season, 'first-federation-win', st.balances.get(`sponsor:${st.world.season}`) ?? 0, this.now());
        if (j) { this.post(st, [j], posted); st.extra.sponsorsPaid.push('first-federation-win'); }
      }
      const ctx = this.ctxOf(st, await this.playerRating());
      settleRound(ctx, rec); // schedule knockout follow-ups if any
      this.snapshotFinance(st);
      await this.commit(st, posted, { rounds: [rec], plans: [st.plan] }, { season: st.world.season, round: st.world.round });
    });
  }

  /** Recovery: record any finalized federation game whose fixture is still pending (e.g. the app closed between the two commits). */
  async reconcilePlayerGames(): Promise<number> {
    if (!this.state) return 0;
    let n = 0;
    const pending = new Set(this.playerFixtures().map(f => f.id));
    if (!pending.size) return 0;
    for (const g of await this.db.allGames()) {
      if (g.context.kind === 'federation' && g.status === 'finalized' && g.context.fixtureId && pending.has(g.context.fixtureId)) { await this.recordPlayerGame(g); n++; }
    }
    return n;
  }

  /** Forfeit a player fixture (loss, no game, unrated). */
  async forfeit(fixtureId: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const rec = structuredClone(st.rounds.get(`${st.world.season}:${st.world.round}`)!);
      const f = rec.fixtures.find(x => x.id === fixtureId);
      if (!f || f.tier !== 1 || f.result !== null) throw new Error('Nothing to forfeit');
      f.result = f.white === PLAYER_ID ? 0 : 1;
      f.forfeit = true;
      st.rounds.set(rec.id, rec);
      settleRound(this.ctxOf(st, await this.playerRating()), rec);
      await this.commit(st, [], { rounds: [rec], plans: [st.plan] }, { season: st.world.season, round: st.world.round });
    });
  }

  async registerChallenger(useVoucher: boolean): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      if (st.world.round >= SWISS_ROUNDS[0]) throw new Error('Registration closes before round 4');
      const posted: Journal[] = [];
      const cash = st.balances.get('player:cash') ?? 0;
      if (useVoucher) {
        if (cash >= RECOVERY_THRESHOLD) throw new Error('Recovery vouchers are only for players with less than 100 ₵');
        if (st.extra.vouchers.includes(st.world.season)) throw new Error('One recovery voucher per season');
        this.post(st, [voucherJournal(st.world.season, this.now())], posted);
        st.extra.vouchers.push(st.world.season);
      } else {
        if (cash < CHALLENGER_FEE) throw new Error('Not enough cash for the entry fee (a recovery voucher is available below 100 ₵)');
        this.post(st, [entryFeeJournal(st.world.season, this.now())], posted);
      }
      registerChallengerPure(this.ctxOf(st, await this.playerRating()));
      await this.commit(st, posted, { plans: [st.plan] }, { season: st.world.season, round: st.world.round });
    });
  }

  // ------------------------------------------------------------------ featured games (spectating)
  /**
   * Watch a featured game: the market is CLOSED and committed first; only then is the game generated
   * (live, move by move). Settlement commits the game, the fixture result and the market settlement in one
   * transaction. Deterministic: node-limited profiles + seeded choices, so a crash simply replays it.
   */
  /** In-flight featured games: a second caller (e.g. Advance while a game is being watched) joins the same run. */
  private inflight = new Map<string, Promise<WorldGame>>();
  playFeatured(fixtureId: string, mode: 'watched-live' | 'background', onMove?: (m: SelfplayMove, ply: number) => void): Promise<WorldGame> {
    const running = this.inflight.get(fixtureId);
    if (running) return running;
    const p = this.playFeaturedOnce(fixtureId, mode, onMove).finally(() => { this.inflight.delete(fixtureId); this.live.delete(fixtureId); this.onChange?.(); });
    this.inflight.set(fixtureId, p);
    return p;
  }
  isLive(fixtureId: string): boolean { return this.inflight.has(fixtureId); }

  private async playFeaturedOnce(fixtureId: string, mode: 'watched-live' | 'background', onMove?: (m: SelfplayMove, ply: number) => void): Promise<WorldGame> {
    if (!this.state) throw new Error('No federation');
    const f0 = this.currentRound()!.fixtures.find(x => x.id === fixtureId);
    if (!f0 || f0.tier !== 2) throw new Error('Not a featured fixture');
    if (f0.result !== null) throw new Error('Already played');
    // 1) close the market (commit) before any move exists
    const mk = this.marketFor(fixtureId);
    if (mk && mk.status === 'open') {
      await this.run(async () => {
        const st = this.clone();
        const m = closeMarket(st.markets.get(mk.id)!, this.now());
        st.markets.set(m.id, m);
        await this.commit(st, [], { markets: [m] }, { season: st.world.season, round: st.world.round });
      });
    }
    // 2) generate the game
    const w = this.state.competitors.get(f0.white)!, b = this.state.competitors.get(f0.black)!;
    const seed = hashSeed(this.state.world.seed, 'featured', fixtureId);
    const pw = profileForStrength(w.latent, FEATURED_NODE_CAP), pb = profileForStrength(b.latent, FEATURED_NODE_CAP);
    const { playStyle } = await import('../engine/styles');
    const moves: SelfplayMove[] = [];
    this.live.set(fixtureId, moves);
    const r = await this.runSelfplay({ initialFen: START_FEN, white: { profile: pw, style: playStyle(w.style) }, black: { profile: pb, style: playStyle(b.style) }, seed, maxPlies: 400 }, m => { moves.push(m); onMove?.(m, moves.length); this.onChange?.(); });
    // 3) commit game + fixture result + settlement atomically
    return this.run(async () => {
      const st = this.clone();
      const rec = structuredClone(st.rounds.get(`${st.world.season}:${st.world.round}`)!);
      const f = rec.fixtures.find(x => x.id === fixtureId)!;
      if (f.result !== null) throw new Error('Already recorded');
      const game: WorldGame = {
        id: `wg:${fixtureId}`, fixtureId, season: f.season, round: f.round, event: f.event, stage: f.stage, white: f.white, black: f.black, whiteName: w.name, blackName: b.name,
        whiteRating: Math.round(w.rating), blackRating: Math.round(b.rating), initialFen: START_FEN, moves: r.moves, result: r.result, termination: r.termination,
        createdAt: this.now(), mode, seed, profiles: [pw.id, pb.id],
      };
      f.result = r.result === '1-0' ? 1 : r.result === '0-1' ? 0 : 0.5;
      f.gameId = game.id;
      st.rounds.set(rec.id, rec);
      const posted: Journal[] = [];
      const changedMarkets: Market[] = [], changedPositions: Position[] = [];
      const m = st.markets.get(`mk:${fixtureId}`);
      if (m && (m.status === 'closed' || m.status === 'open')) {
        const closed = m.status === 'open' ? closeMarket(m, this.now()) : m;
        const ps = [...st.positions.values()].filter(p => p.marketId === m.id);
        const outcome = f.result === 1 ? 0 : f.result === 0.5 ? 1 : 2;
        const s2 = settleMarket(closed, ps, outcome, this.now(), st.balances.get(acct(m, 'collateral')) ?? 0, game.id);
        this.post(st, [s2.journal], posted);
        st.markets.set(m.id, s2.market); changedMarkets.push(s2.market);
        for (const p of s2.positions) { st.positions.set(p.id, p); changedPositions.push(p); }
        const fc = st.extra.forecasts.find(x => x.marketId === m.id);
        if (fc) fc.outcome = outcome;
      }
      settleRound(this.ctxOf(st, await this.playerRating()), rec);
      this.snapshotFinance(st);
      await this.commit(st, posted, { rounds: [rec], markets: changedMarkets, positions: changedPositions, worldGames: [game], plans: [st.plan] }, { season: st.world.season, round: st.world.round });
      this.live.delete(fixtureId);
      return game;
    });
  }

  // ------------------------------------------------------------------ round advance
  /** Advance the world by one round. Player fixtures must be played or forfeited; featured games are played in the background first. */
  async advanceRound(): Promise<ProcessedRound> {
    if (!this.state) throw new Error('No federation');
    if (this.playerFixtures().length) throw new Error('Play or forfeit your fixtures first');
    for (const f of this.featuredFixtures().filter(x => x.result === null)) await this.playFeatured(f.id, 'background');
    if (this.playerFixtures().length) throw new Error('A new game of your knockout match is ready — play it first');
    return this.run(async () => {
      const st = this.clone();
      const expect = { season: st.world.season, round: st.world.round };
      const player = await this.playerRating();
      const ctx = this.ctxOf(st, player);
      const rec = structuredClone(st.rounds.get(`${expect.season}:${expect.round}`)!);
      const seasonRounds = [...st.rounds.values()].filter(r => r.season === expect.season && r.id !== rec.id);
      const posted: Journal[] = [];
      const plansChanged: SeasonPlan[] = [];
      const oldPlan = ctx.plan;
      const res = processRound(ctx, rec, seasonRounds, this.now());
      const expensesPaid = new Map<string, number>();
      st.rounds.set(rec.id, rec);
      const games = gamesOf([...seasonRounds, rec]);
      const season = expect.season, round = expect.round;
      // Swiss prizes after the last Swiss round
      if (round === SWISS_ROUNDS[SWISS_ROUNDS.length - 1]) {
        for (const ev of oldPlan.swiss) {
          const order = swissTable(ev, games).map(r => r.id);
          const pool = `prize:${season}:${ev.event}`;
          this.post(st, [payPool(`prize-pay:${season}:${ev.event}`, pool, st.balances.get(pool) ?? 0, order.slice(0, 8).map((id, i) => ({ id, share: SWISS_SPLIT[i] })), `${ev.name} prizes`, season, round, this.now())], posted);
          if (order.slice(0, 8).includes(PLAYER_ID)) this.sponsor(st, 'swiss-top8', posted, season);
        }
      }
      // League prizes when the league ends
      if (round === LEAGUE_ROUNDS) {
        for (const c of oldPlan.circuits) {
          const order = leagueTable(c, games).map(r => r.id);
          const pool = `prize:${season}:league:${c.region}:${c.division}`;
          this.post(st, [payPool(`prize-pay:${season}:league:${c.region}:${c.division}`, pool, st.balances.get(pool) ?? 0, order.slice(0, 3).map((id, i) => ({ id, share: LEAGUE_SPLIT[i] })), `League prizes R${c.region + 1} D${c.division}`, season, round, this.now())], posted);
          const pi = order.indexOf(PLAYER_ID);
          if (pi === 0) this.sponsor(st, 'league-title', posted, season);
          else if (pi > 0 && pi < 3) this.sponsor(st, 'league-podium', posted, season);
        }
        if (ctx.plan.champ?.qualifiers.includes(PLAYER_ID)) this.sponsor(st, 'champ-qualified', posted, season);
      }
      // Club Weekend (owner only): set up at round 10, pay at round 11
      if (round === CLUB_ROUNDS[0] - 1 && [...st.assets.values()].some(a => a.typeId === 'club' && !a.suspended)) this.setupClubWeekend(st, ctx, posted);
      if (round === CLUB_ROUNDS[1] && oldPlan.club?.champions.length) this.payClubWeekend(st, oldPlan.club, posted);
      if (res.seasonEnd) {
        // championship prizes by stage reached
        const champ = oldPlan.champ;
        if (champ) {
          const recips: { id: string; share: number }[] = [];
          const fin = champ.stages[3].matches[0];
          const finalists = [fin.a, fin.b];
          if (champ.champions.length === 2) recips.push(...finalists.map(id => ({ id, share: (CHAMP_SPLIT.champion + CHAMP_SPLIT.final) / 2 })));
          else { recips.push({ id: champ.champions[0], share: CHAMP_SPLIT.champion }); recips.push({ id: finalists.find(x => x !== champ.champions[0])!, share: CHAMP_SPLIT.final }); }
          for (const m of champ.stages[2].matches) recips.push({ id: m.winner === m.a ? m.b : m.a, share: CHAMP_SPLIT.semi });
          for (const m of champ.stages[1].matches) recips.push({ id: m.winner === m.a ? m.b : m.a, share: CHAMP_SPLIT.quarter });
          const pool = `prize:${season}:champ`;
          this.post(st, [payPool(`prize-pay:${season}:champ`, pool, st.balances.get(pool) ?? 0, recips, 'Crown Championship prizes', season, round, this.now())], posted);
        }
        if (res.seasonEnd.promotions.some(p => p.id === PLAYER_ID)) this.sponsor(st, 'promotion', posted, season);
        // unspent sponsor budget and fee income return to the treasury
        const sp = st.balances.get(`sponsor:${season}`) ?? 0;
        if (sp) this.post(st, [{ id: `sponsor-return:${season}`, at: this.now(), kind: 'transfer', memo: 'Unspent sponsor budget returns to the treasury', lines: [{ account: `sponsor:${season}`, amount: -sp }, { account: 'treasury', amount: sp }], season }], posted);
        const fees = st.balances.get('fees') ?? 0;
        if (fees) this.post(st, [{ id: `fees-recycle:${season}`, at: this.now(), kind: 'transfer', memo: 'Exchange fees recycled to the treasury', lines: [{ account: 'fees', amount: -fees }, { account: 'treasury', amount: fees }], season }], posted);
        // upkeep: unpaid assets are suspended (no debt is ever created)
        for (const a of st.assets.values()) {
          const t = assetType(a.typeId);
          if (!t.upkeep) continue;
          const cash = st.balances.get('player:cash') ?? 0;
          const na = { ...a };
          if (cash >= t.upkeep) { this.post(st, [upkeepJournal(t, season, this.now())], posted); na.suspended = false; na.upkeepPaidSeason = season; }
          else na.suspended = true;
          st.assets.set(a.id, na);
        }
        // treasury replenishment toward its target (explicit, capped issuance)
        { const rj = treasuryReplenishJournal(season + 1, st.balances.get('treasury') ?? 0, this.now()); if (rj) this.post(st, [rj], posted); }
        // NPC wallet top-up (bounded by cap and treasury)
        for (const t of NPC_TRADERS) {
          const need = NPC_WALLET_CAP - (st.balances.get(t.id) ?? 0);
          const avail = (st.balances.get('treasury') ?? 0) - 10_000 * MICRO;
          const amt = Math.min(need, Math.max(0, avail), 1_000 * MICRO);
          if (amt > 0) this.post(st, [{ id: `npc-fund:${season + 1}:${t.id}`, at: this.now(), kind: 'npc-fund', memo: `Season top-up ${t.name}`, lines: [{ account: 'treasury', amount: -amt }, { account: t.id, amount: amt }], season: season + 1 }], posted);
        }
        // leftover prize escrow (e.g. rounding) returns to the treasury
        for (const [acc, bal] of st.balances) if (acc.startsWith(`prize:${season}:`) && bal > 0) this.post(st, [{ id: `prize-return:${acc}`, at: this.now(), kind: 'transfer', memo: `Unpaid remainder of ${acc}`, lines: [{ account: acc, amount: -bal }, { account: 'treasury', amount: bal }], season }], posted);
        // competitor career expenses (coaching, travel, living costs): 75% of each competitor's balance, all of a
        // retired competitor's, leaves circulation into the sink. With fixed issuance per season this bounds the
        // circulating supply (steady state ≈ issuance / 3 held by competitors) instead of growing forever.
        {
          const lines: { account: string; amount: number }[] = [];
          for (const c of st.competitors.values()) {
            const bal = st.balances.get(`comp:${c.id}`) ?? 0;
            if (bal <= 0) continue;
            const amt = c.status === 'retired' ? bal : Math.floor(bal * COMPETITOR_EXPENSE_SHARE);
            if (amt > 0) { lines.push({ account: `comp:${c.id}`, amount: -amt }); expensesPaid.set(c.id, amt); }
          }
          const total = -lines.reduce((a, l) => a + l.amount, 0);
          if (total) this.post(st, [{ id: `comp-expenses:${season}`, at: this.now(), kind: 'expenses', memo: 'Competitor season expenses', lines: [...lines, { account: 'sink', amount: total }], season }], posted);
        }
        // new season issuance
        this.post(st, seasonStartJournals(season + 1, prizePools(ctx.plan.circuits), this.now()), posted);
        plansChanged.push(structuredClone(oldPlan));
      }
      // career earnings accumulate every credit to the competitor's account (expenses are not subtracted)
      for (const c of st.competitors.values()) {
        const bal = st.balances.get(`comp:${c.id}`) ?? 0;
        const gain = bal + (expensesPaid.get(c.id) ?? 0) - (c.balanceSeen ?? 0);
        if (gain > 0) c.earnings += gain;
        c.balanceSeen = bal;
      }
      st.world = ctx.world;
      st.plan = ctx.plan;
      st.plans.set(st.plan.id, st.plan);
      plansChanged.push(st.plan);
      const opened = this.openRoundWithMarkets(st, this.ctxOf(st, player), posted);
      st.rounds.set(opened.rec.id, opened.rec);
      this.snapshotFinance(st);
      await this.commit(st, posted, { competitors: true, rounds: [rec, opened.rec], markets: opened.markets, positions: opened.positions, plans: plansChanged }, expect);
      return res;
    });
  }

  private sponsor(st: FedState, milestone: string, posted: Journal[], season: number): void {
    const key = `${season}:${milestone}`;
    if (st.extra.sponsorsPaid.includes(key)) return;
    const j = sponsorJournal(season, milestone, st.balances.get(`sponsor:${season}`) ?? 0, this.now());
    if (j) { this.post(st, [j], posted); st.extra.sponsorsPaid.push(key); }
  }

  private setupClubWeekend(st: FedState, ctx: Ctx, posted: Journal[]): void {
    const circuit = ctx.plan.circuits.find(c => c.members.includes(PLAYER_ID));
    if (!circuit) return;
    const myR = ctx.player.rating;
    const guests = circuit.members.filter(m => m !== PLAYER_ID).sort((a, b) => Math.abs(ratingOfC(st, a) - myR) - Math.abs(ratingOfC(st, b) - myR) || a.localeCompare(b)).slice(0, 3);
    const ids = [PLAYER_ID, ...guests];
    const seeds = Object.fromEntries([...ids].sort((a, b) => (b === PLAYER_ID ? myR : ratingOfC(st, b)) - (a === PLAYER_ID ? myR : ratingOfC(st, a))).map((id, i) => [id, i + 1]));
    const bySeed = [...ids].sort((a, b) => seeds[a] - seeds[b]);
    const mk = (a: string, b: string): KoMatch => ({ a, b, seedA: seeds[a], seedB: seeds[b], games: [], winner: null, joint: false, decidedBy: null });
    ctx.plan.club = { name: 'club', qualifiers: ids, seeds, stages: [{ round: CLUB_ROUNDS[0], label: 'Club Semifinal', matches: [mk(bySeed[0], bySeed[3]), mk(bySeed[1], bySeed[2])] }, { round: CLUB_ROUNDS[1], label: 'Club Final', matches: [] }], champions: [] };
    const season = st.world.season;
    const cash = st.balances.get('player:cash') ?? 0;
    const C = (x: number) => x * MICRO;
    if (cash >= C(60)) this.post(st, [{ id: `club-host:${season}`, at: this.now(), kind: 'club-hosting', memo: 'Club Weekend: hosting cost and prize escrow', lines: [{ account: 'player:cash', amount: -C(60) }, { account: 'sink', amount: C(20) }, { account: `prize:${season}:club`, amount: C(40) }], season }], posted);
    // attendance revenue: each guest pays 5 ₵ if they can
    for (const g of guests) if ((st.balances.get(`comp:${g}`) ?? 0) >= C(5)) this.post(st, [{ id: `club-attend:${season}:${g}`, at: this.now(), kind: 'club-attendance', memo: `Club Weekend attendance (${this.name(g)})`, lines: [{ account: `comp:${g}`, amount: -C(5) }, { account: 'player:cash', amount: C(5) }], season }], posted);
  }

  private payClubWeekend(st: FedState, club: KoState, posted: Journal[]): void {
    const season = st.world.season;
    const pool = `prize:${season}:club`;
    const bal = st.balances.get(pool) ?? 0;
    if (bal) this.post(st, [payPool(`prize-pay:${season}:club`, pool, bal, club.champions.map(id => ({ id, share: 1 / club.champions.length })), 'Club Weekend prize', season, CLUB_ROUNDS[1], this.now())], posted);
    const sp = st.balances.get(`sponsor:${season}`) ?? 0;
    if (sp >= 30 * MICRO) this.post(st, [{ id: `club-sponsor:${season}`, at: this.now(), kind: 'sponsor', memo: 'Club Weekend sponsor (completed event)', lines: [{ account: `sponsor:${season}`, amount: -30 * MICRO }, { account: 'player:cash', amount: 30 * MICRO }], season }], posted);
  }

  // ------------------------------------------------------------------ exchange
  async trade(marketId: string, outcome: number, shares: number, side: 'buy' | 'sell'): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const m = st.markets.get(marketId);
      if (!m || m.sandbox) throw new Error('Unknown market');
      if (m.white === PLAYER_ID || m.black === PLAYER_ID) throw new Error('Official markets never list your own games');
      const pos = st.positions.get(`${m.id}|player:cash`) ?? null;
      const seq = m.history.length + 1000 * (1 + (pos ? 1 : 0)) + Math.floor(Math.random() * 1e6);
      const t = trade(m, pos, 'player:cash', outcome, shares, side, this.now(), seq);
      const posted: Journal[] = [];
      this.post(st, [t.journal], posted);
      st.markets.set(m.id, t.market);
      st.positions.set(t.position.id, t.position);
      this.snapshotFinance(st);
      await this.commit(st, posted, { markets: [t.market], positions: [t.position] }, { season: st.world.season, round: st.world.round });
    });
  }

  /** Free paper forecast (proper-scored; no money). One per market, before closure. */
  async forecast(marketId: string, probs: number[]): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const m = st.markets.get(marketId);
      if (!m || m.status !== 'open') throw new Error('Forecasts close with the market');
      const s = probs.reduce((a, b) => a + b, 0);
      if (s <= 0) throw new Error('Invalid forecast');
      st.extra.forecasts = [...st.extra.forecasts.filter(f => f.marketId !== marketId), { marketId, probs: probs.map(p => p / s), at: this.now(), outcome: null }];
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
    });
  }

  // ------------------------------------------------------------------ assets
  async buyAsset(typeId: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const t = ASSETS.find(a => a.id === typeId);
      if (!t) throw new Error('Unknown asset');
      if (t.unique && [...st.assets.values()].some(a => a.typeId === typeId)) throw new Error('Already owned');
      const posted: Journal[] = [];
      this.post(st, [purchaseJournal(t, st.world.season, this.now())], posted);
      const owned: OwnedAsset = { id: typeId, typeId, acquiredSeason: st.world.season, suspended: false, upkeepPaidSeason: st.world.season };
      st.assets.set(owned.id, owned);
      this.snapshotFinance(st);
      await this.commit(st, posted, { assets: [owned] }, { season: st.world.season, round: st.world.round });
    });
  }

  async sellAsset(id: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const a = st.assets.get(id);
      if (!a) throw new Error('Not owned');
      if (a.typeId === 'club' && st.plan.club && !st.plan.club.champions.length) throw new Error('Finish this season’s Club Weekend before closing the club');
      const posted: Journal[] = [];
      this.post(st, [saleJournal(assetType(a.typeId), st.world.season, this.now())], posted);
      st.assets.delete(id);
      this.snapshotFinance(st);
      await this.commit(st, posted, { delAssets: [id] }, { season: st.world.season, round: st.world.round });
    });
  }

  ownsAsset(typeId: string): boolean { return [...(this.state?.assets.values() ?? [])].some(a => a.typeId === typeId && !a.suspended); }

  async setWatchlist(ids: string[]): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const limit = this.ownsAsset('scouting') ? Infinity : 3;
      if (ids.length > limit) throw new Error('The watchlist holds 3 competitors without a Scouting Department');
      st.extra.watchlist = [...new Set(ids)];
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
    });
  }

  // ------------------------------------------------------------------ finance view
  finance() {
    const st = this.state!;
    const cash = st.balances.get('player:cash') ?? 0;
    const owned = [...st.assets.values()];
    const assetValueSum = owned.filter(a => !a.suspended).reduce((s, a) => s + assetValue(assetType(a.typeId)), 0);
    const myPositions = [...st.positions.values()].filter(p => p.holder === 'player:cash');
    let open = 0, realized = 0, unrealized = 0, fees = 0;
    for (const p of myPositions) {
      const m = st.markets.get(p.marketId)!;
      fees += p.fees;
      if (m.status === 'settled' || m.status === 'cancelled') realized += p.received - p.spent;
      else { const lv = liquidationValue(m, p); open += lv; unrealized += lv + p.received - p.spent; }
    }
    const journals = [...st.journalIds];
    void journals;
    return { cash, assets: assetValueSum, positions: open, netWorth: netWorth(cash, assetValueSum, open), realized, unrealized, fees, peak: st.finance.peak, owned, myPositions };
  }

  /** Player-side ledger history (entries touching player:cash), newest first. */
  async playerJournal(limit = 200): Promise<Journal[]> {
    const all = await this.db.loadAll<Journal>('journal');
    return all.filter(j => j.lines.some(l => l.account === 'player:cash')).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  async worldGame(id: string): Promise<WorldGame | undefined> {
    return (await this.db.loadAll<WorldGame>('worldGames')).find(g => g.id === id);
  }
  async worldGames(): Promise<WorldGame[]> { return this.db.loadAll<WorldGame>('worldGames'); }

  /** Cancel an open/closed market (fixed 1/3 vector). Used if a fixture can never be played. */
  async cancel(marketId: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const m = st.markets.get(marketId)!;
      const ps = [...st.positions.values()].filter(p => p.marketId === m.id);
      const c = cancelMarket(m, ps, this.now(), st.balances.get(acct(m, 'collateral')) ?? 0);
      const posted: Journal[] = [];
      this.post(st, [c.journal], posted);
      st.markets.set(m.id, c.market);
      for (const p of c.positions) st.positions.set(p.id, p);
      await this.commit(st, posted, { markets: [c.market], positions: c.positions }, { season: st.world.season, round: st.world.round });
    });
  }
}

function settleNothing(rec: RoundRecord): void { void rec; }
function ratingOfC(st: FedState, id: string): number { return st.competitors.get(id)?.rating ?? 0; }
export function eventName(event: string): string {
  if (event.startsWith('league:')) { const [, r, d] = event.split(':'); return `League · Region ${+r + 1} · Division ${d}`; }
  return { open: 'Federation Open', challenger: 'Challenger Open', champ: 'Crown Championship', club: 'Club Weekend' }[event] ?? event;
}
export { CHAMPIONSHIP_ROUNDS, ROUNDS_PER_SEASON };
