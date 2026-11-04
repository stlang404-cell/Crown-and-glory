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
import { generateFederation, hashSeed, rng01 } from '../federation/generator';
import { applyFoundingPersonas, applyNameMode } from '../federation/rosterPersonas';
import { showContemporaryNames } from './namePrefs';
import { NEW_FEDERATION_POPULATION } from '../federation/population';
import { createWorld, joinPlayer, openRound, registerChallenger as registerChallengerPure, swissEventFor, settleRound, Ctx, RoundRecord, SeasonPlan, WorldState, leagueTable, swissTable, gamesByEvent } from '../federation/world';
import { processRound, gamesOf, ProcessedRound } from '../federation/driver';
import { Competitor, Fixture, PLAYER_ID, SWISS_ROUNDS, LEAGUE_ROUNDS, CHAMPIONSHIP_ROUNDS, ROUNDS_PER_SEASON, CLUB_ROUNDS, StyleId, Topology, NEW_FEDERATION_TOPOLOGY, topologyOf } from '../federation/model';
import { pregameWdl, liveModelVector, whiteCp, materialOfFen, ODDS_MODEL_ID } from '../exchange/odds';
import { profileForStrength } from '../federation/profiles';
import { Journal, validateJournal, MICRO } from '../exchange/ledger';
import { prices } from '../exchange/lmsr';
import { Market, Position, openMarket, openGenericMarket, trade, closeMarket, settleMarket, cancelMarket, acct, liquidationValue, claimPrices, revisionOf, MATCH_CLAIMS, claimsOf } from '../exchange/market';
import { normaliseModel, RULES } from '../exchange/families';
import { NPC_TRADERS, NPC_WALLET_CAP, npcRound } from '../exchange/npc';
import { subsidyMicro } from '../exchange/lmsr';
import { MarketOps, openSeasonMarkets, closeDue, afterRound, npcBatch, openLengthMarket, closeLengthMarket, resolveLengthMarket, suspensionOf, lengthMarketId } from './markets';
import { cosmetic, cosmeticJournal, earned, emptyCosmetics, AVATAR_SEEDS, type CosmeticKind, type CosmeticState } from '../economy/cosmetics';
import { FED_TITLES } from '../heraldry/catalog';
import { playerClubAppeal } from './heraldry';
import { ensureFeatured, trackPeaks, awardNorms, eventGames, NORM_EVENTS, clubFinances, seasonCeremonies } from './heraldry';
import { validateIdentity, type ClubIdentity } from '../heraldry/clubs';
import {
  ASSETS, OwnedAsset, assetType, assetValue, genesisJournals, prizePools, seasonStartJournals, payPool, sponsorJournal, purchaseJournal, saleJournal, upkeepJournal,
  CHALLENGER_FEE, RECOVERY_THRESHOLD, treasuryReplenishJournal, voucherJournal, clubLevel, clubUpgradeJournal, clubUpgradeRefundJournal, CONTRACT_SHARE, stipendFor, avgSeasonEarnings, stipendJournal, contractShareJournal, entryFeeJournal, LEAGUE_SPLIT, SWISS_SPLIT, CHAMP_SPLIT, netWorth, CLUB_SPONSOR_POOL,
} from '../economy/economy';
import { playSelfplay, SelfplayMove } from '../engine/selfplay';
import { liveTerminal, plySeed } from './schedulerEngine';
import { sampleResult } from '../federation/resultModel';
import { copyData } from '../federation/copy';
import { accountWrites, competitorWrites, decodeAccounts, decodeCompetitors, decodeRound, encodeRound } from '../federation/persist';
import type { GameRecord } from '../games/types';
import type { KoMatch } from '../federation/formats';
import type { KoState } from '../federation/world';

export interface WorldGame {
  id: string; fixtureId: string; season: number; round: number; event: string; stage?: string;
  white: string; black: string; whiteName: string; blackName: string; whiteRating: number; blackRating: number;
  initialFen: string; moves: SelfplayMove[]; result: '1-0' | '0-1' | '1/2-1/2'; termination: string;
  createdAt: string; mode: 'watched-live' | 'background' | 'scheduled-live' | 'fast-forwarded'; seed: number; profiles: string[];
}
export interface FinanceHistory { key: 'history'; points: { season: number; round: number; at: string; cash: number; assets: number; positions: number; netWorth: number }[]; peak: number }
/** A featured game played move by move with in-play trading windows (persisted after every move). */
export interface LiveGame {
  id: string; fixtureId: string; season: number; round: number; seed: number; moves: SelfplayMove[];
  status: 'live' | 'done'; startedAt: string; marketId: string | null;
  /** Public information published after each move: market prices and the live model (for charts). */
  points: { ply: number; prices: number[]; model: number[]; at: string; revision?: string }[];
  /** v0.9: 'scheduled' = driven by the live scheduler (src/app/scheduler.ts), no market; absent = in-play featured game. */
  kind?: 'in-play' | 'scheduled';
  /** v0.9 scheduled games: when the last move was committed (pacing and reopen catch-up). */
  lastMoveAt?: string;
  /** v0.9 scheduled games: how the game ended or is being completed (see Fixture.resolution). */
  resolution?: 'simulated' | 'fast-forwarded' | 'abstract';
  /** Why a scheduled game was resolved abstractly (shown with the label). */
  note?: string;
}
/** Sponsorship contract: the player pays a season stipend to a competitor and receives a share of their prizes. */
export interface Contract { id: string; competitorId: string; signedSeason: number; stipend: number; share: number; status: 'active' | 'ended'; earned: number; paid: number; endedSeason: number | null }
export interface PlayerExtra { key: 'player'; watchlist: string[]; sponsorsPaid: string[]; vouchers: number[]; sandboxGranted: boolean; sandboxRefillAt?: number;
  /** v0.10: markets the player follows on the Exchange (ids; persisted). */
  marketWatch?: string[];
  forecasts: { marketId: string; probs: number[]; at: string; outcome: number | null; prices?: number[]; model?: number[]; ply?: number }[];
  /** v0.5: ceremonies to present (titles, promotions, championships); `seen` once dismissed. */
  ceremonies?: Ceremony[]; favorites?: string[];
  /** v0.5: owned and equipped cosmetics (crown-cosmetics-1). */
  cosmetics?: CosmeticState }
export interface Ceremony { id: string; season: number; round: number; kind: 'fed-title' | 'event-title' | 'promotion' | 'championship'; title: string; ids: string[]; detail: string; seen: boolean }

const START_FEN = 'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1';
/** Node cap of featured, scheduled and exhibition games (profileForStrength above the measured range plays this budget). */
export const FEATURED_NODE_CAP = 30_000;
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
  liveGames: Map<string, LiveGame>;
  contracts: Map<string, Contract>;
}

type Writes = { store: FederationStore | 'games'; put?: unknown[]; del?: string[] }[];

export class FederationService {
  state: FedState | null = null;
  /** Records of an older save still stored individually (replaced by chunk records on their next write). */
  private legacy = { competitors: new Set<string>(), accounts: new Set<string>() };
  private busy = false;
  live = new Map<string, SelfplayMove[]>();
  onChange: (() => void) | null = null;
  /** Change notification for live-scheduler commits (the app throttles these); falls back to onChange. */
  onLiveChange: (() => void) | null = null;
  /** Featured-game runner: the app plugs in a Web Worker; tests run in-process. */
  runSelfplay: (req: { initialFen: string; white: { profile: ReturnType<typeof profileForStrength>; style: StyleId }; black: { profile: ReturnType<typeof profileForStrength>; style: StyleId }; seed: number; maxPlies: number }, onMove: (m: SelfplayMove) => void) => Promise<{ moves: SelfplayMove[]; result: '1-0' | '0-1' | '1/2-1/2'; termination: string }>
    = async (req, onMove) => playSelfplay(req.initialFen, req.white, req.black, req.seed, req.maxPlies, m => onMove(m));

  constructor(readonly db: CrownDB, readonly playerRating: () => Promise<{ rating: number; rd: number }>, readonly now: () => string = () => new Date().toISOString()) {}

  get ready(): boolean { return this.state !== null; }

  async load(): Promise<void> {
    const [worlds, seasons, comps, rounds, markets, positions, accounts, journal, assets, finance, liveGames, contracts] = await Promise.all([
      this.db.loadAll<WorldState>('world'), this.db.loadAll<SeasonPlan>('seasons'), this.db.loadAll<unknown>('competitors'), this.db.loadAll<RoundRecord>('rounds'),
      this.db.loadAll<Market>('markets'), this.db.loadAll<Position>('positions'), this.db.loadAll<unknown>('accounts'),
      this.db.loadAll<Journal>('journal'), this.db.loadAll<OwnedAsset>('assets'), this.db.loadAll<FinanceHistory | PlayerExtra>('finance'),
      this.db.loadAll<LiveGame>('liveGames'), this.db.loadAll<Contract>('contracts'),
    ]);
    const world = worlds.find(w => w.key === 'world');
    if (!world) { this.state = null; return; }
    // compact persistence (src/federation/persist.ts): chunks expanded; individual records of older saves noted so
    // they are replaced by their chunk on the next write
    const dc = decodeCompetitors(comps), da = decodeAccounts(accounts);
    this.legacy = { competitors: new Set(dc.legacyIds), accounts: new Set(da.legacyIds) };
    const plans = new Map(seasons.map(p => [p.id, p]));
    this.state = {
      world, plan: plans.get(`season:${world.season}`)!, plans,
      competitors: new Map(dc.competitors.map(c => [c.id, c])), rounds: new Map(rounds.map(r => [r.id, decodeRound(r)])),
      markets: new Map(markets.map(m => [m.id, m])), positions: new Map(positions.map(p => [p.id, p])),
      balances: new Map(da.accounts.map(a => [a.account, a.balance])), journalIds: new Set(journal.map(j => j.id)),
      assets: new Map(assets.map(a => [a.id, a])),
      finance: (finance.find(f => f.key === 'history') as FinanceHistory) ?? { key: 'history', points: [], peak: 0 },
      extra: (finance.find(f => f.key === 'player') as PlayerExtra) ?? { key: 'player', watchlist: [], sponsorsPaid: [], vouchers: [], sandboxGranted: false, forecasts: [] },
      liveGames: new Map(liveGames.map(g => [g.id, g])), contracts: new Map(contracts.map(c => [c.id, c])),
    };
    applyNameMode(this.state.competitors.values(), this.showNames, { texts: true });
  }

  /** Settings → "Show contemporary famous names" (display only; docs/ROSTER.md). */
  showNames = showContemporaryNames();
  /** Switch the contemporary-names display. Names only, in memory: ids, records and history are untouched. */
  setContemporaryNames(show: boolean): void {
    if (show === this.showNames) return;
    this.showNames = show;
    if (this.state && applyNameMode(this.state.competitors.values(), show, { texts: true }) > 0) this.onChange?.();
  }

  // ------------------------------------------------------------------ helpers
  /**
   * Working copy for one command. Competitor records are deep-copied only for the commands that change them
   * (`competitors: true`: round advance); every other command shares the committed (immutable-by-convention) records,
   * which was the dominant cost of a command at scale (docs/FEDERATION_SCALE.md; tests/federationScale.test.ts
   * freezes the records to prove those commands never write to them).
   */
  private clone(opts: { competitors?: boolean } = {}): FedState {
    const s = this.state!;
    return {
      world: copyData(s.world), plan: copyData(s.plan), plans: new Map(s.plans),
      competitors: opts.competitors ? new Map([...s.competitors].map(([k, v]) => [k, copyData(v)])) : new Map(s.competitors),
      rounds: new Map(s.rounds), markets: new Map(s.markets), positions: new Map(s.positions),
      balances: new Map(s.balances), journalIds: new Set(s.journalIds), assets: new Map(s.assets),
      finance: copyData(s.finance), extra: copyData(s.extra),
      liveGames: new Map(s.liveGames), contracts: new Map(s.contracts),
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

  /** Market lifecycle operations bound to a working state (see src/app/markets.ts). */
  private opsOf(st: FedState, posted: Journal[]): MarketOps {
    return { st, post: js => this.post(st, js, posted), now: () => this.now(), markets: new Map(), positions: new Map() };
  }

  /** List any season-family market missing for the current season while its trading window is open
   *  (saves migrated from v0.3.0 mid-season). Idempotent. */
  async ensureSeasonMarkets(): Promise<number> {
    if (!this.state) return 0;
    const S = this.state.world.season;
    if (['open-winner', 'promo', 'qual', 'season'].every(k => this.state!.markets.has(`mk:${k}:${S}`))) return 0;
    return this.run(async () => {
      const st = this.clone();
      const posted: Journal[] = [];
      const ops = this.opsOf(st, posted);
      openSeasonMarkets(ops);
      if (!ops.markets.size) return 0;
      await this.commit(st, posted, { markets: [...ops.markets.values()], positions: [...ops.positions.values()] }, { season: st.world.season, round: st.world.round });
      return ops.markets.size;
    });
  }

  /** v0.5: choose and persist featured rivals for saves that predate them. Idempotent. */
  async ensureHeraldry(): Promise<boolean> {
    if (!this.state || this.state.world.featured?.length) return false;
    return this.run(async () => {
      const st = this.clone();
      st.world = copyData(st.world);
      if (!ensureFeatured(st)) return false;
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
      return true;
    });
  }

  /**
   * v0.5 engine-commitment record (transition policy, docs/V5_ENGINE.md): the canonical build used for federation,
   * spectator and in-play games is recorded per (season, round). A build can only change with an app update; the
   * change is appended here (never silently), every game keeps the build that produced it, no recorded result is
   * regenerated, and both sides of every later game use the same build. Idempotent.
   */
  async ensureEngineCommitment(build: string): Promise<boolean> {
    const last = this.state?.world.engineCommitments?.at(-1);
    if (!this.state || last?.build === build) return false;
    return this.run(async () => {
      const st = this.clone();
      st.world = copyData(st.world);
      const live = [...st.liveGames.values()].filter(g => g.status === 'live').length;
      st.world.engineCommitments = [...(st.world.engineCommitments ?? []), { season: st.world.season, round: st.world.round, build, at: this.now(), liveGamesInProgress: live }];
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
      return true;
    });
  }

  /** Save the player club's identity (validated; persisted with the club asset). */
  async setClubIdentity(identity: ClubIdentity): Promise<void> {
    const err = validateIdentity(identity);
    if (err) throw new Error(err);
    return this.run(async () => {
      const st = this.clone();
      const club = [...st.assets.values()].find(a => a.typeId === 'club');
      if (!club) throw new Error('You need a club first. Buy a Starter Chess Club in Finance.');
      const next = { ...club, identity: { ...identity, name: identity.name.trim(), motto: identity.motto.trim() } };
      st.assets.set(club.id, next);
      await this.commit(st, [], { assets: [next] }, { season: st.world.season, round: st.world.round });
    });
  }
  clubIdentity(): ClubIdentity | null { const c = [...(this.state?.assets.values() ?? [])].find(a => a.typeId === 'club'); return c?.identity ?? null; }

  async markCeremonySeen(id: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      st.extra.ceremonies = (st.extra.ceremonies ?? []).map(c => (c.id === id ? { ...c, seen: true } : c));
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
    });
  }
  async setFavorites(ids: string[]): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      st.extra.favorites = [...new Set(ids)].slice(0, 32);
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
    });
  }

  /** Close family markets whose closing round has started, committed before any game of that round runs. */
  private async closeDueMarkets(): Promise<void> {
    if (!this.state) return;
    const st0 = this.state;
    const due = [...st0.markets.values()].some(m => m.status === 'open' && m.ref?.closeRound !== undefined && m.ref.season === st0.world.season && st0.world.round >= Number(m.ref.closeRound));
    if (!due) return;
    await this.run(async () => {
      const st = this.clone();
      const posted: Journal[] = [];
      const ops = this.opsOf(st, posted);
      closeDue(ops, st.world.round);
      await this.commit(st, posted, { markets: [...ops.markets.values()] }, { season: st.world.season, round: st.world.round });
    });
  }

  private ctxOf(st: FedState, player: { rating: number; rd: number }): Ctx {
    const seasonRounds = [...st.rounds.values()].filter(r => r.season === st.world.season);
    const swissHistory = gamesOf(seasonRounds).filter(g => g.event === 'open' || g.event === 'challenger');
    return { world: st.world, plan: st.plan, competitors: st.competitors, player: { ...player, name: 'You' }, swissHistory };
  }

  /**
   * Serialize commands: one at a time, guarded by the committed cursor. A user command that meets another user
   * command fails fast (as before); a short live-scheduler commit is waited for instead, and scheduler commits wait
   * behind anything (docs/FEDERATION_SCALE.md).
   */
  private busyKind: 'user' | 'scheduler' = 'user';
  private idle: Promise<void> = Promise.resolve();
  private async run<T>(fn: () => Promise<T>, kind: 'user' | 'scheduler' = 'user'): Promise<T> {
    while (this.busy) {
      if (kind === 'user' && this.busyKind === 'user') throw new Error('Another federation action is still running. Wait a moment and try again.');
      await this.idle;
    }
    this.busy = true;
    this.busyKind = kind;
    let release!: () => void;
    this.idle = new Promise<void>(r => { release = r; });
    try { return await fn(); } finally { this.busy = false; release(); }
  }

  private async commit(next: FedState, posted: Journal[], changed: { competitors?: boolean; rounds?: RoundRecord[]; markets?: Market[]; positions?: Position[]; plans?: SeasonPlan[]; assets?: OwnedAsset[]; delAssets?: string[]; worldGames?: WorldGame[]; liveGames?: LiveGame[]; contracts?: Contract[] }, expect: { season: number; round: number } | null): Promise<void> {
    const accounts = new Set(posted.flatMap(j => j.lines.map(l => l.account)));
    const acctW = accountWrites(accounts, next.balances, this.legacy.accounts);
    const writes: Writes = [
      { store: 'world', put: [next.world] },
      { store: 'seasons', put: changed.plans ?? [next.plan] },
      { store: 'finance', put: [next.finance, next.extra] },
      { store: 'journal', put: posted },
      { store: 'accounts', put: acctW.put, del: acctW.del },
    ];
    // compact persistence (src/federation/persist.ts): competitors in chunks of 512, only changed chunks rewritten
    const compW = changed.competitors ? competitorWrites(next.competitors, this.state?.competitors ?? null, this.legacy.competitors) : null;
    if (compW) writes.push({ store: 'competitors', put: compW.put, del: compW.del });
    if (changed.rounds?.length) writes.push({ store: 'rounds', put: changed.rounds.map(encodeRound) });
    if (changed.markets?.length) writes.push({ store: 'markets', put: changed.markets });
    if (changed.positions?.length) writes.push({ store: 'positions', put: changed.positions });
    if (changed.assets?.length || changed.delAssets?.length) writes.push({ store: 'assets', put: changed.assets ?? [], del: changed.delAssets ?? [] });
    if (changed.worldGames?.length) writes.push({ store: 'worldGames', put: changed.worldGames });
    if (changed.liveGames?.length) writes.push({ store: 'liveGames', put: changed.liveGames });
    if (changed.contracts?.length) writes.push({ store: 'contracts', put: changed.contracts });
    await this.db.commit(writes, async get => {
      const w = (await get('world', 'world')) as WorldState | undefined;
      if (expect && (!w || w.season !== expect.season || w.round !== expect.round)) throw new Error('World changed since this screen loaded. Reload and try again.');
      if (!expect && w) throw new Error('A federation already exists. Reload to see it.');
      for (const j of posted.slice(0, 3)) if (await get('journal', j.id)) throw new Error(`Journal ${j.id} already committed`);
    });
    for (const id of compW?.del ?? []) this.legacy.competitors.delete(id);
    for (const a of acctW.del) this.legacy.accounts.delete(a);
    this.state = next;
    if (changed.competitors) applyNameMode(next.competitors.values(), this.showNames); // new entrants under the current setting
    if (this.busyKind === 'scheduler' && this.onLiveChange) this.onLiveChange(); else this.onChange?.();
  }

  private snapshotFinance(st: FedState): void {
    const cash = st.balances.get('player:cash') ?? 0;
    const assets = [...st.assets.values()].filter(a => !a.suspended).reduce((s, a) => s + assetValue(assetType(a.typeId)), 0) + ([...st.assets.values()].some(a => a.typeId === 'club' && !a.suspended) ? st.balances.get('asset:club:upgrade') ?? 0 : 0);
    const positions = [...st.positions.values()].filter(p => p.holder === 'player:cash').reduce((s, p) => s + liquidationValue(st.markets.get(p.marketId)!, p), 0);
    const nw = netWorth(cash, assets, positions);
    st.finance.points.push({ season: st.world.season, round: st.world.round, at: this.now(), cash, assets, positions, netWorth: nw });
    if (st.finance.points.length > 2000) st.finance.points.splice(0, st.finance.points.length - 2000);
    st.finance.peak = Math.max(st.finance.peak, nw);
  }

  // ------------------------------------------------------------------ creation
  /** Found a federation. New worlds get NEW_FEDERATION_TOPOLOGY unless a topology is given (tests, scale probes);
   *  the topology is stored in the world record and never changes afterwards. */
  async create(region: number, seed = Date.now() % 2_147_483_647, topology: Topology = NEW_FEDERATION_TOPOLOGY): Promise<void> {
    if (!Number.isInteger(region) || region < 0 || region >= topology.regions) throw new Error('Choose one of the regions of this federation.');
    return this.run(async () => {
      if (this.state) throw new Error('A federation already exists. Reload to see it.');
      // v0.10: new federations use the full rating spectrum (crown-population-2); existing worlds keep theirs
      const comps = generateFederation(seed, topology, NEW_FEDERATION_POPULATION);
      applyFoundingPersonas(seed, comps, this.showNames); // v0.10 persona roster: names only, for newly founded federations
      const { world, plan } = createWorld(seed, comps, this.now(), topology, NEW_FEDERATION_POPULATION);
      const st: FedState = {
        world, plan, plans: new Map([[plan.id, plan]]), competitors: new Map(comps.map(c => [c.id, c])), rounds: new Map(), markets: new Map(), positions: new Map(),
        balances: new Map(), journalIds: new Set(), assets: new Map(), finance: { key: 'history', points: [], peak: 0 },
        extra: { key: 'player', watchlist: [], sponsorsPaid: [], vouchers: [], sandboxGranted: false, forecasts: [] },
        liveGames: new Map(), contracts: new Map(),
      };
      const player = await this.playerRating();
      const ctx = this.ctxOf(st, player);
      joinPlayer(ctx, region);
      ensureFeatured(st);
      const posted: Journal[] = [];
      this.post(st, genesisJournals(this.now(), NPC_TRADERS.map(t => t.id), NPC_FUND), posted);
      this.post(st, seasonStartJournals(1, prizePools(st.plan.circuits), this.now()), posted);
      const opened = this.openRoundWithMarkets(st, ctx, posted);
      st.rounds.set(opened.rec.id, opened.rec);
      const ops = this.opsOf(st, posted);
      openSeasonMarkets(ops);
      this.snapshotFinance(st);
      await this.commit(st, posted, { competitors: true, rounds: [opened.rec], markets: [...opened.markets, ...ops.markets.values()], positions: [...opened.positions, ...ops.positions.values()] }, null);
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
      const p = pregameWdl({ rating: w.rating, rd: w.rd }, { rating: b.rating, rd: b.rd });
      const { market, journal } = openMarket({ id: `mk:${f.id}`, sandbox: false, fixtureId: f.id, title: `${w.name} – ${b.name}`, white: f.white, black: f.black, season: rec.season, round: rec.round, b: MARKET_B, forecast: { ...p, source: `${ODDS_MODEL_ID} on public ratings and RDs` }, at: this.now(), claims: MATCH_CLAIMS, rules: RULES.match });
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
      // v0.10: the match-length (over/under plies) market of the same fixture, public ratings only
      const ops = this.opsOf(st, posted);
      openLengthMarket(ops, f, m.title);
      markets.push(...ops.markets.values()); positions.push(...ops.positions.values());
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
  featuredFixtures(): Fixture[] { return this.currentRound()?.fixtures.filter(f => f.tier === 2 && !f.slate) ?? []; }
  /** v0.9: fixtures of the current round promoted to scheduled live games (src/app/scheduler.ts). */
  slateFixtures(): Fixture[] { return this.currentRound()?.fixtures.filter(f => f.slate) ?? []; }
  /** The federation's topology (fixed when it was founded). */
  topology(): Topology { return topologyOf(this.state?.world); }
  marketFor(fixtureId: string): Market | undefined { return this.state?.markets.get(`mk:${fixtureId}`); }
  name(id: string): string { return id === PLAYER_ID ? 'You' : this.state?.competitors.get(id)?.name ?? id; }
  ratingOf(id: string): number { return this.state?.competitors.get(id)?.rating ?? 0; }

  // ------------------------------------------------------------------ player league games
  /** Create (or return) the rated game record for a player fixture. Opponent strength comes from hidden latent via the calibrated profile map. */
  async playerGameFor(fixtureId: string, human: { rating: number | null; rd: number | null }): Promise<GameRecord> {
    const f = this.currentRound()!.fixtures.find(x => x.id === fixtureId);
    if (!f || f.tier !== 1) throw new Error('That match is not one of yours.');
    const existing = (await this.db.allGames()).find(g => g.context.fixtureId === fixtureId);
    if (existing) return existing;
    const oppId = f.white === PLAYER_ID ? f.black : f.white;
    const c = this.state!.competitors.get(oppId)!;
    const profile = profileForStrength(c.latent);
    const { createGameRecord } = await import('../games/session');
    const { TIME_CONTROLS } = await import('../games/types');
    const { LEVELS_ID } = await import('../engine/levels');
    const { PLAY_SEARCH_ID: SEARCH_ID } = await import('../engine/search');
    const { PLAY_EVAL_ID: EVAL_ID } = await import('../engine/evaluate');
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
    if (!this.ownsAsset('training')) throw new Error('Sparring needs a Training Hall. Buy one in Finance first.');
    const f = this.currentRound()?.fixtures.find(x => x.id === fixtureId);
    if (!f || f.tier !== 1) throw new Error('That match is not one of yours.');
    const c = this.state!.competitors.get(f.white === PLAYER_ID ? f.black : f.white)!;
    const profile = profileForStrength(c.latent);
    const { createGameRecord } = await import('../games/session');
    const { TIME_CONTROLS } = await import('../games/types');
    const { LEVELS_ID } = await import('../engine/levels');
    const { PLAY_SEARCH_ID: SEARCH_ID } = await import('../engine/search');
    const { PLAY_EVAL_ID: EVAL_ID } = await import('../engine/evaluate');
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

  /** v0.9 Random Federation Quick Match: a rapid game against any active competitor, played by its own calibrated
   *  profile (hidden latent strength → engine profile, same map as league games) with its public Glicko-2 rating.
   *  Rated games go through the normal finalisation (one rating event per game id); casual games never rate.
   *  Not a league fixture: standings, prize pools and markets are untouched. */
  async quickMatchGameFor(competitorId: string, opts: { rated: boolean; humanColor: 'white' | 'black'; human: { rating: number | null; rd: number | null }; nowMs: number }): Promise<GameRecord> {
    const c = this.state?.competitors.get(competitorId);
    if (!c || c.status !== 'active') throw new Error('That competitor is not available for a challenge.');
    const profile = profileForStrength(c.latent);
    const { createGameRecord } = await import('../games/session');
    const { TIME_CONTROLS } = await import('../games/types');
    const { LEVELS_ID } = await import('../engine/levels');
    const { PLAY_SEARCH_ID: SEARCH_ID } = await import('../engine/search');
    const { PLAY_EVAL_ID: EVAL_ID } = await import('../engine/evaluate');
    const { playStyle, STYLE_LABEL } = await import('../engine/styles');
    const style = playStyle(c.style);
    return createGameRecord({
      id: `qm-${c.id.replace(/:/g, '-')}-${opts.nowMs.toString(36)}`, mode: opts.rated ? 'rated' : 'casual', timeControl: TIME_CONTROLS.rapid, humanColor: opts.humanColor,
      human: { kind: 'human', id: 'player', name: 'You', rating: opts.rated ? opts.human.rating : null, rd: opts.rated ? opts.human.rd : null },
      engine: { kind: 'engine', id: c.id, name: c.name, rating: opts.rated ? c.rating : null, rd: opts.rated ? c.rd : null, engine: { profileId: profile.id, level: 0, levelsId: LEVELS_ID, searchId: SEARCH_ID, evalId: EVAL_ID, calibrationId: 'federation-public-rating', style: STYLE_LABEL[style], profile, styleId: style } },
      engineSeed: hashSeed(this.state!.world.seed, 'quick-match', `${c.id}:${opts.nowMs}`), nowIso: this.now(),
      context: { kind: 'quick-match', eventName: `Quick Match vs ${c.name}` },
    });
  }

  /** Called after a federation game has been finalized by the normal (atomic, rated) path. */
  async recordPlayerGame(game: GameRecord): Promise<void> {
    return this.run(async () => {
      const fixtureId = game.context.fixtureId;
      if (!fixtureId || !game.result) return;
      const st = this.clone();
      const rec = copyData(st.rounds.get(`${st.world.season}:${st.world.round}`)!);
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
      const rec = copyData(st.rounds.get(`${st.world.season}:${st.world.round}`)!);
      const f = rec.fixtures.find(x => x.id === fixtureId);
      if (!f || f.tier !== 1 || f.result !== null) throw new Error('There is no unplayed match to forfeit.');
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
      if (st.world.round >= SWISS_ROUNDS[0]) throw new Error('Registration closed before round 4. You can enter next season.');
      // v0.10 (bug #31): entering the Open cancels its champion market at 1/n per share; a holder who could trigger that
      // cancellation could buy entrants below 1/n and register to collect the difference. You must hold no shares in it.
      if (swissEventFor(st.world.player.division) === 'open') {
        const own = st.positions.get(`mk:open-winner:${st.world.season}|player:cash`);
        const m = st.markets.get(`mk:open-winner:${st.world.season}`);
        if (own && m && (m.status === 'open' || m.status === 'closed') && own.shares.some(x => x > 0)) throw new Error('You hold shares in the Federation Open champion market. Entering the Open cancels that market, so sell your shares first.');
      }
      const posted: Journal[] = [];
      const cash = st.balances.get('player:cash') ?? 0;
      if (useVoucher) {
        if (cash >= RECOVERY_THRESHOLD) throw new Error('Recovery vouchers are only for players with less than $100.');
        if (st.extra.vouchers.includes(st.world.season)) throw new Error('You have already used this season’s recovery voucher.');
        this.post(st, [voucherJournal(st.world.season, this.now())], posted);
        st.extra.vouchers.push(st.world.season);
      } else {
        if (cash < CHALLENGER_FEE) throw new Error('You do not have enough cash for the entry fee. If you have less than $100, use a recovery voucher.');
        this.post(st, [entryFeeJournal(st.world.season, this.now())], posted);
      }
      // conflict procedure: entering an event cancels its open market on the published 1/n vector first
      const cancelled: Market[] = [], cancelledPos: Position[] = [];
      if (swissEventFor(st.world.player.division) === 'open') {
        const m = st.markets.get(`mk:open-winner:${st.world.season}`);
        if (m && (m.status === 'open' || m.status === 'closed')) {
          const c = cancelMarket(m, [...st.positions.values()].filter(p => p.marketId === m.id), this.now(), st.balances.get(acct(m, 'collateral')) ?? 0);
          this.post(st, [c.journal], posted);
          st.markets.set(m.id, c.market); cancelled.push(c.market);
          for (const p of c.positions) { st.positions.set(p.id, p); cancelledPos.push(p); }
        }
      }
      registerChallengerPure(this.ctxOf(st, await this.playerRating()));
      await this.commit(st, posted, { plans: [st.plan], markets: cancelled, positions: cancelledPos }, { season: st.world.season, round: st.world.round });
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
    if (!this.state) throw new Error('No federation yet. Found the federation first.');
    const f0 = this.currentRound()!.fixtures.find(x => x.id === fixtureId);
    if (!f0 || f0.tier !== 2) throw new Error('That is not a featured match.');
    if (f0.result !== null) throw new Error('This match has already been played.');
    // a game already running live is finished move by move (same committed timeline)
    if (this.state.liveGames.get(fixtureId)?.status === 'live') {
      for (let guard = 0; guard < 500; guard++) { const r = await this.liveStep(fixtureId); if (r.done) return r.game!; }
      throw new Error('The live game did not finish. Try again.');
    }
    // 1) close the market (commit) before any move exists — and any family market whose closing round started
    await this.closeDueMarkets();
    const mk = this.marketFor(fixtureId);
    const lk = this.state.markets.get(lengthMarketId(fixtureId));
    if ((mk && mk.status === 'open') || (lk && lk.status === 'open')) {
      await this.run(async () => {
        const st = this.clone();
        const ops = this.opsOf(st, []);
        const m0 = st.markets.get(`mk:${fixtureId}`);
        if (m0 && m0.status === 'open') { const m = closeMarket(m0, this.now()); st.markets.set(m.id, m); ops.markets.set(m.id, m); }
        closeLengthMarket(ops, fixtureId);
        await this.commit(st, [], { markets: [...ops.markets.values()] }, { season: st.world.season, round: st.world.round });
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
      const posted: Journal[] = [];
      const fin = await this.finishFeaturedIn(st, posted, fixtureId, r.moves, r.result, r.termination, mode, seed, [pw.id, pb.id]);
      this.snapshotFinance(st);
      await this.commit(st, posted, { rounds: [fin.rec], markets: fin.markets, positions: fin.positions, worldGames: [fin.game], plans: [st.plan] }, { season: st.world.season, round: st.world.round });
      this.live.delete(fixtureId);
      return fin.game;
    });
  }

  /** Record a finished featured game in a working state: game record, fixture result, market settlement
   *  (or cancellation when the playing-length limit censored the game). */
  private async finishFeaturedIn(st: FedState, posted: Journal[], fixtureId: string, moves: SelfplayMove[], result: '1-0' | '0-1' | '1/2-1/2', termination: string, mode: WorldGame['mode'], seed: number, profiles: string[]) {
    const rec = copyData(st.rounds.get(`${st.world.season}:${st.world.round}`)!);
    const f = rec.fixtures.find(x => x.id === fixtureId)!;
    if (f.result !== null) throw new Error('This result is already recorded.');
    const w = st.competitors.get(f.white)!, b = st.competitors.get(f.black)!;
    const game: WorldGame = {
      id: `wg:${fixtureId}`, fixtureId, season: f.season, round: f.round, event: f.event, stage: f.stage, white: f.white, black: f.black, whiteName: w.name, blackName: b.name,
      whiteRating: Math.round(w.rating), blackRating: Math.round(b.rating), initialFen: START_FEN, moves, result, termination,
      createdAt: this.now(), mode, seed, profiles,
    };
    f.result = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
    f.gameId = game.id;
    st.rounds.set(rec.id, rec);
    const markets: Market[] = [], positions: Position[] = [];
    const m = st.markets.get(`mk:${fixtureId}`);
    if (m && (m.status === 'closed' || m.status === 'open')) {
      const closed = m.status === 'open' ? closeMarket(m, this.now()) : m;
      const ps = [...st.positions.values()].filter(p => p.marketId === m.id);
      const outcome = f.result === 1 ? 0 : f.result === 0.5 ? 1 : 2;
      // a game stopped by the playing-length limit is censored, not a result: the market is cancelled with
      // its published 1/n vector (research doc 09); standings record the adjudicated draw, labelled as such
      const s2 = termination === 'playing-limit'
        ? cancelMarket(closed, ps, this.now(), st.balances.get(acct(m, 'collateral')) ?? 0)
        : settleMarket(closed, ps, outcome, this.now(), st.balances.get(acct(m, 'collateral')) ?? 0, game.id);
      this.post(st, [s2.journal], posted);
      st.markets.set(m.id, s2.market); markets.push(s2.market);
      for (const p of s2.positions) { st.positions.set(p.id, p); positions.push(p); }
      const fc = st.extra.forecasts.find(x => x.marketId === m.id);
      if (fc) fc.outcome = termination === 'playing-limit' ? null : outcome;
    }
    // v0.10: the over/under market settles on the official record's ply count (a playing-limit game has 400 plies)
    { const ops = this.opsOf(st, posted); resolveLengthMarket(ops, fixtureId, moves.length, game.id); markets.push(...ops.markets.values()); positions.push(...ops.positions.values()); }
    settleRound(this.ctxOf(st, await this.playerRating()), rec);
    return { rec, game, markets, positions };
  }

  // ------------------------------------------------------------------ Sandbox Exchange (own casual games)
  /** Sandbox balances live only in `sandbox:*` accounts: the ledger rejects any journal mixing them with official
   *  accounts, and official net worth, P&L, prestige and the federation never read them. */
  sandboxBalance(): number { return this.balance('sandbox:player'); }
  sandboxMarketFor(gameId: string): Market | undefined { return this.state?.markets.get(`sb:${gameId}`); }

  /** A Training Hall sparring game (see sparringGameFor: id `spar-…`, engine participant `spar:<competitor>`). */
  static isSparring(g: GameRecord): boolean {
    return g.id.startsWith('spar-') || g.white.id.startsWith('spar:') || g.black.id.startsWith('spar:');
  }

  /** Why a game cannot carry a sandbox market, or null if it can. */
  static sandboxIneligible(g: GameRecord): string | null {
    if (g.mode === 'rated' || g.rated) return 'Rated games never carry markets';
    if (g.context.kind !== 'quick-match') return 'Only casual quick matches (federation and training games are excluded)';
    // Training Hall sparring is created with context 'quick-match' but is a training game, not one started from Play or
    // Random Match (RULEBOOK §Sandbox; RULES_TRACEABILITY D10): it never carries a practice market.
    if (FederationService.isSparring(g)) return 'Only casual quick matches (federation and training games are excluded)';
    if (g.initialFen !== START_FEN || (g.setupMoves?.length ?? 0) > 0) return 'Only games from the standard start position';
    if (g.assistance.length) return 'Assisted games are excluded';
    if (g.moves.length) return 'The sandbox market closes when the game starts';
    if (g.status !== 'active' && g.status !== 'paused') return 'This game is over';
    return null;
  }

  /** Open a sandbox market on the player's own casual game, priced at the rating-based prior. */
  async openSandbox(g: GameRecord, prior: number[]): Promise<Market> {
    const why = FederationService.sandboxIneligible(g);
    if (why) throw new Error(why);
    return this.run(async () => {
      const st = this.clone();
      const id = `sb:${g.id}`;
      if (st.markets.has(id)) return st.markets.get(id)!;
      const posted: Journal[] = [];
      const C = (x: number) => x * MICRO;
      // sandbox money is created only by explicit sandbox:mint entries (never official mint)
      if (!st.journalIds.has('sandbox-grant:player')) this.post(st, [{ id: 'sandbox-grant:player', at: this.now(), kind: 'sandbox-mint', memo: 'Sandbox starting balance (practice money)', lines: [{ account: 'sandbox:mint', amount: -C(500) }, { account: 'sandbox:player', amount: C(500) }] }], posted);
      const tr = st.balances.get('sandbox:treasury') ?? 0;
      if (tr < C(1_000)) this.post(st, [{ id: `sandbox-treasury:${st.journalIds.size}`, at: this.now(), kind: 'sandbox-mint', memo: 'Sandbox market-maker float', lines: [{ account: 'sandbox:mint', amount: -(C(5_000) - tr) }, { account: 'sandbox:treasury', amount: C(5_000) - tr }] }], posted);
      const p0 = normaliseModel(prior, 0.03);
      const opp = g.humanColor === 'white' ? g.black : g.white;
      const { market, journal } = openGenericMarket({
        id, kind: 'sandbox', sandbox: true, title: `Your casual game vs ${opp.name}`, outcomes: ['You win', 'Draw', 'You lose'],
        claims: [{ id: 'win', label: 'You win', states: [0] }, { id: 'nolose', label: 'You draw or win', states: [0, 1] }],
        model: p0, prior: p0, rules: 'Sandbox practice market on your own casual game. Opens at the rating-based prior; you may only back yourself (win, or draw-or-win), never your own loss. Trading closes at the first move. Settlement: the result. Cancelled at the published opening prices if the game is assisted, or ends within its first 20 half-moves other than by checkmate. Sandbox money never affects official cash, net worth, ratings, standings, or prestige.',
        season: st.world.season, round: st.world.round, b: 60, at: this.now(), ref: { gameId: g.id },
      });
      market.cancelVector = p0;
      this.post(st, [journal], posted);
      st.markets.set(id, market);
      await this.commit(st, posted, { markets: [market] }, { season: st.world.season, round: st.world.round });
      return market;
    });
  }

  async sandboxTrade(gameId: string, claim: number, shares: number, side: 'buy' | 'sell'): Promise<void> {
    const g = await this.db.getGame(gameId);
    if (!g || g.moves.length) throw new Error('Trading closed because the game has started.');
    return this.run(async () => {
      const st = this.clone();
      const m = st.markets.get(`sb:${gameId}`);
      if (!m || m.status !== 'open') throw new Error('This game has no open practice market.');
      const pos = st.positions.get(`${m.id}|sandbox:player`) ?? null;
      const t = trade(m, pos, 'sandbox:player', claim, shares, side, this.now(), m.history.length);
      const posted: Journal[] = [];
      this.post(st, [t.journal], posted);
      st.markets.set(m.id, t.market); st.positions.set(t.position.id, t.position);
      await this.commit(st, posted, { markets: [t.market], positions: [t.position] }, { season: st.world.season, round: st.world.round });
    });
  }

  /** Close the sandbox market when the game starts (trading is also refused once a move exists). */
  async closeSandbox(gameId: string): Promise<void> {
    const m = this.sandboxMarketFor(gameId);
    if (!m || m.status !== 'open') return;
    return this.run(async () => {
      const st = this.clone();
      const c = closeMarket(st.markets.get(m.id)!, this.now());
      st.markets.set(c.id, c);
      await this.commit(st, [], { markets: [c] }, { season: st.world.season, round: st.world.round });
    });
  }

  /** Resolve a sandbox market from the finalized game (idempotent). */
  async settleSandbox(g: GameRecord): Promise<void> {
    const m0 = this.sandboxMarketFor(g.id);
    if (!m0 || m0.status === 'settled' || m0.status === 'cancelled' || !g.result) return;
    return this.run(async () => {
      const st = this.clone();
      const m = st.markets.get(m0.id)!;
      const ps = [...st.positions.values()].filter(p => p.marketId === m.id);
      const closed = closeMarket(m, this.now());
      const short = g.moves.length < 20; // fewer than 10 moves each
      const voided = g.assistance.length > 0 || g.status === 'abandoned' || (short && g.termination !== 'checkmate');
      const coll = st.balances.get(acct(m, 'collateral')) ?? 0;
      const mine = g.result === '1/2-1/2' ? 1 : (g.result === '1-0') === (g.humanColor === 'white') ? 0 : 2;
      const r = voided ? cancelMarket(closed, ps, this.now(), coll) : settleMarket(closed, ps, mine, this.now(), coll, g.id);
      const posted: Journal[] = [];
      this.post(st, [r.journal], posted);
      st.markets.set(m.id, r.market);
      for (const p of r.positions) st.positions.set(p.id, p);
      // controlled refill: practice money tops up to 200 only after 5 settled sandbox markets since the last refill
      const settledCount = [...st.markets.values()].filter(x => x.kind === 'sandbox' && (x.status === 'settled' || x.status === 'cancelled')).length;
      const lastRefill = st.extra.sandboxRefillAt ?? 0;
      if ((st.balances.get('sandbox:player') ?? 0) < 20 * MICRO && settledCount - lastRefill >= 5) {
        const amt = 200 * MICRO - (st.balances.get('sandbox:player') ?? 0);
        this.post(st, [{ id: `sandbox-refill:${settledCount}`, at: this.now(), kind: 'sandbox-mint', memo: 'Sandbox practice refill', lines: [{ account: 'sandbox:mint', amount: -amt }, { account: 'sandbox:player', amount: amt }] }], posted);
        st.extra.sandboxRefillAt = settledCount;
      }
      await this.commit(st, posted, { markets: [r.market], positions: r.positions }, { season: st.world.season, round: st.world.round });
    });
  }

  // ------------------------------------------------------------------ live in-play featured games
  /** Single-move engine hook (fresh, seeded search → a reload resumes the same timeline). The app plugs in a worker. */
  computeMove: (req: { moves: string[]; profile: ReturnType<typeof profileForStrength>; style: StyleId; seed: number }) => Promise<{ ccn: string; score: SelfplayMove['score']; depth: number; nodes: number; ms: number }>
    = async req => {
      const [{ Position }, { parseLegalCcn, moveToCcn }, { Searcher }, { chooseMove }, { typedScore }] = await Promise.all([import('../rules/position'), import('../rules/notation'), import('../engine/search'), import('../engine/levels'), import('../analysis/analyzer')]);
      const pos = Position.fromFen(START_FEN);
      for (const c of req.moves) pos.makeMove(parseLegalCcn(pos, c));
      const t0 = Date.now();
      const r = chooseMove(new Searcher(16), pos, req.profile, req.seed, undefined, undefined, req.style);
      return { ccn: moveToCcn(r.move), score: typedScore(r.search.score, pos.side === 0 ? 'white' : 'black'), depth: r.search.depth, nodes: r.search.nodes, ms: Date.now() - t0 };
    };

  liveGame(fixtureId: string): LiveGame | undefined { return this.state?.liveGames.get(fixtureId); }

  /** Start a featured game in live mode: its market (if any) stays open for in-play trading between moves. */
  async startLive(fixtureId: string): Promise<LiveGame> {
    if (!this.state) throw new Error('No federation yet. Found the federation first.');
    await this.closeDueMarkets();
    return this.run(async () => {
      const st = this.clone();
      const f = st.rounds.get(`${st.world.season}:${st.world.round}`)!.fixtures.find(x => x.id === fixtureId);
      if (!f || f.tier !== 2) throw new Error('That is not a featured match in this round.');
      if (f.result !== null || st.liveGames.has(fixtureId)) throw new Error('This match has already started.');
      const m = st.markets.get(`mk:${fixtureId}`);
      if (m && m.status !== 'open') throw new Error('This market has already closed.');
      const lg: LiveGame = {
        id: fixtureId, fixtureId, season: f.season, round: f.round, seed: hashSeed(st.world.seed, 'featured', fixtureId), moves: [], status: 'live', startedAt: this.now(),
        marketId: m ? m.id : null, points: m ? [{ ply: 0, prices: claimPrices(m), model: m.model ?? [m.forecast.w, m.forecast.d, m.forecast.l], at: this.now() }] : [],
      };
      st.liveGames.set(fixtureId, lg);
      if (m) { const lm = { ...m, live: { plies: 0, lastEval: null } }; st.markets.set(m.id, lm); }
      // the over/under market is not traded in play: it closes when the match starts
      const ops = this.opsOf(st, []);
      closeLengthMarket(ops, fixtureId);
      await this.commit(st, [], { liveGames: [lg], markets: [...(m ? [st.markets.get(m.id)!] : []), ...ops.markets.values()] }, { season: st.world.season, round: st.world.round });
      return lg;
    });
  }

  /** Play the next move of a live game, publish it, let NPC traders react, and settle at the end.
   *  Trading is suspended while the move is computed (commands are serialized); it reopens once the move and
   *  the new public information are committed. Returns the new move, or null when the game was already over. */
  async liveStep(fixtureId: string, expectPly?: number): Promise<{ move: SelfplayMove | null; done: boolean; game?: WorldGame }> {
    return this.run(async () => {
      const st = this.clone();
      const lg0 = st.liveGames.get(fixtureId);
      if (!lg0 || lg0.status !== 'live') throw new Error('No live game for this match right now.');
      // duplicate or stale step request (e.g. a second tab, a double click): never publish two moves for one request
      if (expectPly !== undefined && lg0.moves.length !== expectPly) throw new Error(`Stale step: the game has moved on (ply ${lg0.moves.length}, not ${expectPly}). Wait for the board to update and try again.`);
      // the market revision is locked for the duration of this command (commands are serialised): no trade can
      // execute between computing the move and publishing it; trades quoted before it are rejected afterwards
      const lockedRevision = lg0.marketId && st.markets.get(lg0.marketId) ? revisionOf(st.markets.get(lg0.marketId)!) : null;
      const lg: LiveGame = structuredClone(lg0);
      const f = st.rounds.get(`${st.world.season}:${st.world.round}`)!.fixtures.find(x => x.id === fixtureId)!;
      const w = st.competitors.get(f.white)!, b = st.competitors.get(f.black)!;
      const [{ Position }, { parseLegalCcn, moveToCcn, moveToSan }, { automaticOutcome, claimableDraws }, { playStyle }, { expectedU, toPov }] = await Promise.all([
        import('../rules/position'), import('../rules/notation'), import('../rules/adjudication'), import('../engine/styles'), import('../analysis/methodology')]);
      const pos = Position.fromFen(START_FEN);
      for (const mv of lg.moves) pos.makeMove(parseLegalCcn(pos, mv.ccn));
      const terminal = (): { result: '1-0' | '0-1' | '1/2-1/2'; termination: string } | null => {
        const o = automaticOutcome(pos);
        if (o) return { result: o.result, termination: o.termination };
        const c = claimableDraws(pos);
        if (c.threefold || c.fiftyMove) return { result: '1/2-1/2', termination: c.threefold ? 'threefold-claim' : 'fifty-move-claim' };
        if (lg.moves.length >= 400) return { result: '1/2-1/2', termination: 'playing-limit' };
        return null;
      };
      let move: SelfplayMove | null = null;
      let end = terminal();
      if (!end) {
        const side = pos.side === 0 ? w : b;
        const profile = profileForStrength(side.latent, FEATURED_NODE_CAP);
        const r = await this.computeMove({ moves: lg.moves.map(x => x.ccn), profile, style: playStyle(side.style), seed: (lg.seed + lg.moves.length * 7919) >>> 0 });
        const mv = parseLegalCcn(pos, r.ccn);
        if (!pos.legalMoves().includes(mv)) throw new Error('Engine produced an illegal move');
        const san = moveToSan(pos, mv);
        pos.makeMove(mv);
        move = { ccn: moveToCcn(mv), san, fen: pos.toFen(), score: r.score, depth: r.depth, nodes: r.nodes, ms: r.ms };
        lg.moves.push(move);
        end = terminal();
      }
      const posted: Journal[] = [];
      const markets: Market[] = [], positions: Position[] = [];
      let m = lg.marketId ? st.markets.get(lg.marketId) : undefined;
      if (m && lockedRevision !== null && revisionOf(m) !== lockedRevision) throw new Error('Market revision changed while the move was computed'); // invariant
      if (m && m.status === 'open' && move && !end) {
        // public information after the move: the engine's evaluation → live model (a forecast, never the price)
        // crown-odds-2 (src/exchange/odds.ts): pre-game prior from public ratings/RDs + published evaluation, ply, material
        const u = expectedU(toPov(move.score, 'white'));
        const model = liveModelVector({ white: { rating: w.rating, rd: w.rd }, black: { rating: b.rating, rd: b.rd }, ply: lg.moves.length, evalCp: whiteCp(move.score), material: materialOfFen(move.fen) });
        const prev = lg.points.length ? lg.points[lg.points.length - 1].prices : undefined;
        const ops = this.opsOf(st, posted);
        m = npcBatch(ops, { ...m, live: { plies: lg.moves.length, lastEval: u } }, 'live', model, prev);
        for (const x of ops.markets.values()) markets.push(x);
        for (const x of ops.positions.values()) positions.push(x);
        if (!ops.markets.size) { st.markets.set(m.id, m); markets.push(m); }
        lg.points.push({ ply: lg.moves.length, prices: claimPrices(m), model, at: this.now(), revision: revisionOf(m) });
      }
      let game: WorldGame | undefined;
      const rounds: RoundRecord[] = [];
      if (end) {
        lg.status = 'done';
        const fin = await this.finishFeaturedIn(st, posted, fixtureId, lg.moves, end.result, end.termination, 'watched-live', lg.seed, [profileForStrength(w.latent, FEATURED_NODE_CAP).id, profileForStrength(b.latent, FEATURED_NODE_CAP).id]);
        game = fin.game; rounds.push(fin.rec); markets.push(...fin.markets); positions.push(...fin.positions);
        this.snapshotFinance(st);
      }
      st.liveGames.set(fixtureId, lg);
      await this.commit(st, posted, { liveGames: [lg], markets, positions, rounds, worldGames: game ? [game] : [], plans: end ? [st.plan] : undefined }, { season: st.world.season, round: st.world.round });
      return { move, done: !!end, game };
    });
  }

  // ------------------------------------------------------------------ v0.9 live scheduler (scheduled slate games)
  /** Scheduled live games of the current round that are still being played. */
  activeScheduled(): LiveGame[] {
    const s = this.state;
    if (!s) return [];
    return [...s.liveGames.values()].filter(g => g.kind === 'scheduled' && g.status === 'live' && g.season === s.world.season && g.round === s.world.round);
  }

  /** Background fixtures of the current round in the order the scheduler promotes them (deterministic for a round:
   *  your own circuit, then the Swiss events, then the leagues from the Crown Division down; higher public rating
   *  sum first; ties by event and ids). */
  slateCandidates(): [string, string, string][] {
    const s = this.state, rec = this.currentRound();
    if (!s || !rec || rec.status !== 'open') return [];
    const home = `league:${s.world.player.region}:${s.world.player.division}`;
    const rating = (id: string) => s.competitors.get(id)?.rating ?? 0;
    const pri = (e: string) => (e === home ? 0 : e === 'open' || e === 'challenger' ? 1 : 2 + Number(e.split(':')[2] ?? 9));
    // (an abstract entry may already hold its tier-3 draw — settleRound draws them when a featured game finishes; the
    // draw is deterministic, so a promoted fixture resolved abstractly later gets the same value)
    return rec.abstract.map(a => [a[0], a[1], a[2]] as [string, string, string])
      .sort((a, b) => pri(a[0]) - pri(b[0]) || (rating(b[1]) + rating(b[2])) - (rating(a[1]) + rating(a[2])) || a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]));
  }

  /**
   * Promote up to `count` background fixtures of the open round to scheduled live games (one commit). A promoted
   * fixture keeps its pairing; its result will come from the engine game, or — if the round closes first — from
   * exactly the tier-3 draw it would have had anyway. Never touches the player's games, featured games or markets.
   * `maxPerRound` bounds how many fixtures of one round are ever promoted.
   */
  async startSlate(count: number, maxPerRound = 64): Promise<LiveGame[]> {
    if (!this.state || count <= 0) return [];
    return this.run(async () => {
      const st = this.clone();
      const key = `${st.world.season}:${st.world.round}`;
      const rec0 = st.rounds.get(key);
      if (!rec0 || rec0.status !== 'open') return [];
      const promoted = rec0.fixtures.filter(f => f.slate).length;
      const n = Math.min(count, maxPerRound - promoted);
      if (n <= 0) return [];
      const cands = this.slateCandidates().slice(0, n);
      if (!cands.length) return [];
      const rec = copyData(rec0);
      const out: LiveGame[] = [];
      const at = this.now();
      // v0.10 (bug #29): a scheduled game is a game of this round starting — family markets whose closing round this is
      // close in the same commit, before any of its moves exists
      const ops = this.opsOf(st, []);
      closeDue(ops, st.world.round);
      for (const [event, white, black] of cands) {
        const idx = rec.abstract.findIndex(a => a[0] === event && a[1] === white && a[2] === black);
        if (idx < 0) continue;
        rec.abstract.splice(idx, 1);
        const id = `${rec.season}:${rec.round}:${event}:s-${white}-${black}`;
        rec.fixtures.push({ id, season: rec.season, round: rec.round, event, white, black, result: null, tier: 2, gameId: null, slate: true });
        const lg: LiveGame = { id, fixtureId: id, season: rec.season, round: rec.round, seed: hashSeed(st.world.seed, 'featured', id), moves: [], status: 'live', startedAt: at, marketId: null, points: [], kind: 'scheduled', lastMoveAt: at };
        st.liveGames.set(id, lg);
        out.push(lg);
      }
      st.rounds.set(rec.id, rec);
      await this.commit(st, [], { rounds: [rec], liveGames: out, markets: [...ops.markets.values()] }, { season: st.world.season, round: st.world.round });
      return out;
    }, 'scheduler');
  }

  /** Everything an engine needs to compute the next move of a scheduled game (read from committed state). */
  scheduledRequest(fixtureId: string): { moves: string[]; ply: number; profile: ReturnType<typeof profileForStrength>; style: StyleId; seed: number } | null {
    const s = this.state;
    const lg = s?.liveGames.get(fixtureId);
    if (!s || !lg || lg.kind !== 'scheduled' || lg.status !== 'live') return null;
    const f = this.currentRound()?.fixtures.find(x => x.id === fixtureId);
    if (!f || f.result !== null) return null;
    const side = s.competitors.get(lg.moves.length % 2 === 0 ? f.white : f.black)!;
    return { moves: lg.moves.map(m => m.ccn), ply: lg.moves.length, profile: profileForStrength(side.latent, FEATURED_NODE_CAP), style: side.style, seed: plySeed(lg.seed, lg.moves.length) };
  }

  /**
   * Commit one engine move of a scheduled game, computed outside the command lock by a scheduler worker for ply
   * `expectPly`. Stale results (the game moved on, ended, or the round closed) are discarded, never applied twice.
   * At the end of the game the result, game record and fixture are committed with the move (settlement path of
   * featured games; there is no market). `fastForward` marks moves computed during reopen catch-up.
   */
  async scheduledStep(fixtureId: string, expectPly: number, mv: { ccn: string; score: SelfplayMove['score']; depth: number; nodes: number; ms: number }, fastForward = false): Promise<{ applied: boolean; done: boolean; game?: WorldGame }> {
    if (!this.state) return { applied: false, done: false };
    return this.run(async () => {
      const st = this.clone();
      const lg0 = st.liveGames.get(fixtureId);
      const rec0 = st.rounds.get(`${st.world.season}:${st.world.round}`);
      const f0 = rec0?.fixtures.find(x => x.id === fixtureId);
      if (!lg0 || lg0.kind !== 'scheduled' || lg0.status !== 'live' || !f0 || f0.result !== null || lg0.moves.length !== expectPly) return { applied: false, done: false };
      const [{ Position }, { parseLegalCcn, moveToCcn, moveToSan }] = await Promise.all([import('../rules/position'), import('../rules/notation')]);
      const pos = Position.fromFen(START_FEN);
      for (const m of lg0.moves) pos.makeMove(parseLegalCcn(pos, m.ccn));
      const m = parseLegalCcn(pos, mv.ccn);
      if (m < 0 || !pos.legalMoves().includes(m)) throw new Error('Engine produced an illegal move');
      const lg: LiveGame = structuredClone(lg0);
      const san = moveToSan(pos, m);
      pos.makeMove(m);
      lg.moves.push({ ccn: moveToCcn(m), san, fen: pos.toFen(), score: mv.score, depth: mv.depth, nodes: mv.nodes, ms: mv.ms });
      lg.lastMoveAt = this.now();
      if (fastForward) lg.resolution = 'fast-forwarded';
      const end = liveTerminal(pos, lg.moves.length);
      if (!end) {
        st.liveGames.set(fixtureId, lg);
        await this.commit(st, [], { liveGames: [lg] }, { season: st.world.season, round: st.world.round });
        return { applied: true, done: false };
      }
      lg.status = 'done';
      lg.resolution = lg.resolution ?? 'simulated';
      const w = st.competitors.get(f0.white)!, b = st.competitors.get(f0.black)!;
      const posted: Journal[] = [];
      const fin = await this.finishFeaturedIn(st, posted, fixtureId, lg.moves, end.result, end.termination, lg.resolution === 'fast-forwarded' ? 'fast-forwarded' : 'scheduled-live', lg.seed, [profileForStrength(w.latent, FEATURED_NODE_CAP).id, profileForStrength(b.latent, FEATURED_NODE_CAP).id]);
      const ff = fin.rec.fixtures.find(x => x.id === fixtureId)!;
      ff.resolution = lg.resolution;
      st.liveGames.set(fixtureId, lg);
      await this.commit(st, posted, { liveGames: [lg], rounds: [fin.rec], worldGames: [fin.game], markets: fin.markets, positions: fin.positions, plans: [st.plan] }, { season: st.world.season, round: st.world.round });
      return { applied: true, done: true, game: fin.game };
    }, 'scheduler');
  }

  /** Resolve scheduled games abstractly (labelled; no game record). Used by reopen catch-up beyond its bound. */
  async resolveScheduledAbstract(fixtureIds: string[], note: string): Promise<number> {
    if (!this.state || !fixtureIds.length) return 0;
    return this.run(async () => {
      const st = this.clone();
      const rec = copyData(st.rounds.get(`${st.world.season}:${st.world.round}`)!);
      const lgs = this.abstractSlate(st, rec, fixtureIds, note);
      if (!lgs.length) return 0;
      settleRound(this.ctxOf(st, await this.playerRating()), rec);
      st.rounds.set(rec.id, rec);
      await this.commit(st, [], { rounds: [rec], liveGames: lgs, plans: [st.plan] }, { season: st.world.season, round: st.world.round });
      return lgs.length;
    }, 'scheduler');
  }

  /** Abstract resolution of unfinished slate fixtures in a working round record: the exact tier-3 draw of the
   *  pairing (same seed and formula as resolveAbstract), so a promoted fixture never changes the result it would
   *  otherwise have had. Partial moves stay in the live-game record but no replay (WorldGame) is created. */
  private abstractSlate(st: FedState, rec: RoundRecord, fixtureIds: string[] | null, note: string): LiveGame[] {
    const out: LiveGame[] = [];
    for (const f of rec.fixtures) {
      if (!f.slate || f.result !== null || (fixtureIds && !fixtureIds.includes(f.id))) continue;
      const u = rng01(hashSeed(st.world.seed, 'result', rec.season, rec.round, f.event, f.white, f.black))();
      f.result = sampleResult(st.competitors.get(f.white)!.latent, st.competitors.get(f.black)!.latent, u);
      f.resolution = 'abstract';
      const lg0 = st.liveGames.get(f.id);
      if (lg0) { const lg = { ...lg0, status: 'done' as const, resolution: 'abstract' as const, note }; st.liveGames.set(f.id, lg); out.push(lg); }
    }
    return out;
  }

  // ------------------------------------------------------------------ round advance
  /** Advance the world by one round. Player fixtures must be played or forfeited; featured games are played in the background first. */
  async advanceRound(): Promise<ProcessedRound> {
    if (!this.state) throw new Error('No federation yet. Found the federation first.');
    if (this.playerFixtures().length) throw new Error('Play or forfeit your remaining fixtures first.');
    await this.closeDueMarkets();
    for (const f of this.featuredFixtures().filter(x => x.result === null)) await this.playFeatured(f.id, 'background');
    if (this.playerFixtures().length) throw new Error('A new game of your knockout match is ready. Play it first.');
    return this.run(async () => {
      const st = this.clone({ competitors: true });
      const expect = { season: st.world.season, round: st.world.round };
      const player = await this.playerRating();
      const ctx = this.ctxOf(st, player);
      const rec = copyData(st.rounds.get(`${expect.season}:${expect.round}`)!);
      // scheduled live games still in progress when the round closes take their tier-3 draw (labelled abstract)
      const slateClosed = this.abstractSlate(st, rec, null, 'The round closed before this game finished.');
      const seasonRounds = [...st.rounds.values()].filter(r => r.season === expect.season && r.id !== rec.id);
      const posted: Journal[] = [];
      const plansChanged: SeasonPlan[] = [];
      const oldPlan = ctx.plan;
      const titlesBefore = st.world.player.titles.length, divisionBefore = st.world.player.division;
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
        const byEvent = gamesByEvent(games);
        for (const c of oldPlan.circuits) {
          const order = leagueTable(c, games, undefined, byEvent).map(r => r.id);
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
      if (oldPlan.club && round === oldPlan.club.stages[oldPlan.club.stages.length - 1].round && oldPlan.club.champions.length) this.payClubWeekend(st, oldPlan.club, posted);
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
        // v0.8 club sponsorship (crown-club-appeal-1): local sponsors back a well-run player club from the season's
        // existing sponsor budget, in proportion to the club's appeal share (max 45% of $600). No new money: it is
        // paid from a pool that otherwise returns to the treasury.
        {
          const { share } = playerClubAppeal(st, season);
          const avail = st.balances.get(`sponsor:${season}`) ?? 0;
          const amt = Math.min(avail, Math.floor(CLUB_SPONSOR_POOL * share));
          if (amt > 0) this.post(st, [{ id: `club-season-sponsor:${season}`, at: this.now(), kind: 'sponsor', memo: `Club sponsorship (appeal ${(share * 100).toFixed(0)}%)`, lines: [{ account: `sponsor:${season}`, amount: -amt }, { account: 'player:cash', amount: amt }], season }], posted);
        }
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
          const extra = a.typeId === 'club' ? clubLevel(a.level ?? 1).extraUpkeep : 0;
          if (cash >= t.upkeep + extra) {
            this.post(st, [upkeepJournal(t, season, this.now())], posted);
            if (extra) this.post(st, [{ id: `upkeep:club-level:${season}`, at: this.now(), kind: 'upkeep', memo: `${clubLevel(a.level ?? 1).name}: facility upkeep, season ${season}`, lines: [{ account: 'player:cash', amount: -extra }, { account: 'sink', amount: extra }], season }], posted);
            na.suspended = false; na.upkeepPaidSeason = season;
          } else na.suspended = true;
          st.assets.set(a.id, na);
        }
        // treasury replenishment toward its target (explicit, capped issuance)
        { const rj = treasuryReplenishJournal(season + 1, st.balances.get('treasury') ?? 0, this.now()); if (rj) this.post(st, [rj], posted); }
        // NPC profit sweep: wallet balances above the cap return to the treasury, so trading profits funded by market
        // subsidies do not accumulate as new money (the treasury is the subsidy source and is replenished by capped mint)
        for (const t of NPC_TRADERS) {
          const bal = st.balances.get(t.id) ?? 0;
          if (bal > NPC_WALLET_CAP) this.post(st, [{ id: `npc-sweep:${season}:${t.id}`, at: this.now(), kind: 'transfer', memo: `${t.name}: balance above the wallet cap returned to the treasury`, lines: [{ account: t.id, amount: -(bal - NPC_WALLET_CAP) }, { account: 'treasury', amount: bal - NPC_WALLET_CAP }], season }], posted);
        }
        // NPC wallet top-up (bounded by cap and treasury)
        for (const t of NPC_TRADERS) {
          const need = NPC_WALLET_CAP - (st.balances.get(t.id) ?? 0);
          const avail = (st.balances.get('treasury') ?? 0) - 10_000 * MICRO;
          const amt = Math.min(need, Math.max(0, avail), 1_000 * MICRO);
          if (amt > 0) this.post(st, [{ id: `npc-fund:${season + 1}:${t.id}`, at: this.now(), kind: 'npc-fund', memo: `Season top-up ${t.name}`, lines: [{ account: 'treasury', amount: -amt }, { account: t.id, amount: amt }], season: season + 1 }], posted);
        }
        // leftover prize escrow (e.g. rounding) returns to the treasury
        for (const [acc, bal] of st.balances) if (acc.startsWith(`prize:${season}:`) && bal > 0) this.post(st, [{ id: `prize-return:${acc}`, at: this.now(), kind: 'transfer', memo: `Unpaid remainder of ${acc}`, lines: [{ account: acc, amount: -bal }, { account: 'treasury', amount: bal }], season }], posted);
        // AI club finances (dues from members' balances, operating costs) before competitor expenses
        clubFinances(st, season, js => this.post(st, js, posted), this.now());
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
        plansChanged.push(copyData(oldPlan));
      }
      // career earnings accumulate every credit to the competitor's account (expenses are not subtracted)
      for (const c of st.competitors.values()) {
        const bal = st.balances.get(`comp:${c.id}`) ?? 0;
        const gain = bal + (expensesPaid.get(c.id) ?? 0) - (c.balanceSeen ?? 0);
        if (gain > 0) c.earnings += gain;
        c.balanceSeen = bal;
      }
      // honours: peaks, norms at each event's end, permanent federation titles, ceremonies (recorded results only)
      {
        const ceremonies: Ceremony[] = [];
        trackPeaks(st, player);
        if (round === NORM_EVENTS.swissRound) for (const ev of ['open', 'challenger'] as const) awardNorms(st, season, round, `${ev === 'open' ? 'Federation Open' : 'Challenger Open'} S${season}`, eventGames(games, ev), player.rating, ceremonies);
        if (round === NORM_EVENTS.leagueRound) awardNorms(st, season, round, `League season S${season}`, eventGames(games, 'league'), player.rating, ceremonies);
        if (res.seasonEnd && oldPlan.champ) {
          const fin = oldPlan.champ.stages[oldPlan.champ.stages.length - 1].matches[0];
          awardNorms(st, season, round, `Crown Championship S${season}`, eventGames(games, 'champ'), player.rating, ceremonies, fin ? [fin.a, fin.b] : []);
        }
        if (res.seasonEnd) seasonCeremonies(st, season, round, oldPlan.champ, titlesBefore, divisionBefore, ceremonies);
        if (ceremonies.length) st.extra.ceremonies = [...(st.extra.ceremonies ?? []).filter(c => !ceremonies.some(n => n.id === c.id)), ...ceremonies].slice(-60);
      }
      // sponsorship contracts: share of prizes paid this round; next season's stipends at season end
      const changedContracts: Contract[] = [];
      this.contractShares(st, posted, changedContracts);
      if (res.seasonEnd) {
        for (const ct of [...st.contracts.values()].filter(c => c.status === 'active')) {
          const comp = st.competitors.get(ct.competitorId);
          const cash = st.balances.get('player:cash') ?? 0;
          const club = [...st.assets.values()].find(a => a.typeId === 'club' && !a.suspended);
          if (!comp || comp.status !== 'active' || !club || cash < ct.stipend) { const e = { ...ct, status: 'ended' as const, endedSeason: season }; st.contracts.set(ct.id, e); changedContracts.push(e); continue; }
          const stipend = stipendFor(comp.division, avgSeasonEarnings(comp)); // repriced at renewal
          if (cash < stipend) { const e = { ...ct, status: 'ended' as const, endedSeason: season }; st.contracts.set(ct.id, e); changedContracts.push(e); continue; }
          this.post(st, [stipendJournal(ct.id, ct.competitorId, stipend, season + 1, this.now())], posted);
          const n = { ...ct, stipend, paid: ct.paid + stipend }; st.contracts.set(ct.id, n); changedContracts.push(n);
        }
      }
      // Grand Exchange: settle from recorded results, list new markets, refresh models, NPC re-trading
      const ops = this.opsOf(st, posted);
      afterRound(ops, season, round, rec, games, oldPlan, res.seasonEnd);
      st.world = ctx.world;
      st.plan = ctx.plan;
      st.plans.set(st.plan.id, st.plan);
      plansChanged.push(st.plan);
      const opened = this.openRoundWithMarkets(st, this.ctxOf(st, player), posted);
      st.rounds.set(opened.rec.id, opened.rec);
      openSeasonMarkets(ops); // new season: lists all families; otherwise only fills gaps within their windows
      this.snapshotFinance(st);
      await this.commit(st, posted, { competitors: true, rounds: [rec, opened.rec], markets: [...opened.markets, ...ops.markets.values()], positions: [...opened.positions, ...ops.positions.values()], plans: plansChanged, contracts: changedContracts, liveGames: slateClosed }, expect);
      return res;
    });
  }

  private sponsor(st: FedState, milestone: string, posted: Journal[], season: number): void {
    const key = `${season}:${milestone}`;
    if (st.extra.sponsorsPaid.includes(key)) return;
    const club = [...st.assets.values()].find(a => a.typeId === 'club' && !a.suspended);
    const j = sponsorJournal(season, milestone, st.balances.get(`sponsor:${season}`) ?? 0, this.now(), club ? clubLevel(club.level ?? 1).sponsorBonus : 0);
    if (j) { this.post(st, [j], posted); st.extra.sponsorsPaid.push(key); }
  }

  private setupClubWeekend(st: FedState, ctx: Ctx, posted: Journal[]): void {
    const circuit = ctx.plan.circuits.find(c => c.members.includes(PLAYER_ID));
    if (!circuit) return;
    const club = [...st.assets.values()].find(a => a.typeId === 'club')!;
    const L = clubLevel(club.level ?? 1);
    const myR = ctx.player.rating;
    const guests = circuit.members.filter(m => m !== PLAYER_ID).sort((a, b) => Math.abs(ratingOfC(st, a) - myR) - Math.abs(ratingOfC(st, b) - myR) || a.localeCompare(b)).slice(0, L.weekendSize - 1);
    const ids = [PLAYER_ID, ...guests];
    const seeds = Object.fromEntries([...ids].sort((a, b) => (b === PLAYER_ID ? myR : ratingOfC(st, b)) - (a === PLAYER_ID ? myR : ratingOfC(st, a))).map((id, i) => [id, i + 1]));
    const bySeed = [...ids].sort((a, b) => seeds[a] - seeds[b]);
    const mk = (a: string, b: string): KoMatch => ({ a, b, seedA: seeds[a], seedB: seeds[b], games: [], winner: null, joint: false, decidedBy: null });
    const stages = L.weekendSize === 8
      ? [{ round: CLUB_ROUNDS[0], label: 'Club Quarterfinal', matches: [mk(bySeed[0], bySeed[7]), mk(bySeed[3], bySeed[4]), mk(bySeed[2], bySeed[5]), mk(bySeed[1], bySeed[6])] },
        { round: CLUB_ROUNDS[1], label: 'Club Semifinal', matches: [] as KoMatch[] }, { round: CLUB_ROUNDS[1] + 1, label: 'Club Final', matches: [] as KoMatch[] }]
      : [{ round: CLUB_ROUNDS[0], label: 'Club Semifinal', matches: [mk(bySeed[0], bySeed[3]), mk(bySeed[1], bySeed[2])] }, { round: CLUB_ROUNDS[1], label: 'Club Final', matches: [] as KoMatch[] }];
    ctx.plan.club = { name: 'club', qualifiers: ids, seeds, stages, champions: [] };
    const season = st.world.season;
    const cash = st.balances.get('player:cash') ?? 0;
    const C = (x: number) => x * MICRO;
    const host = L.weekendSize === 8 ? C(40) : C(20), escrow = L.weekendSize === 8 ? C(80) : C(40);
    if (cash >= host + escrow) this.post(st, [{ id: `club-host:${season}`, at: this.now(), kind: 'club-hosting', memo: `Club Weekend (${L.weekendSize} players): hosting cost and prize escrow`, lines: [{ account: 'player:cash', amount: -(host + escrow) }, { account: 'sink', amount: host }, { account: `prize:${season}:club`, amount: escrow }], season }], posted);
    // attendance revenue: each guest pays $5 if they can
    for (const g of guests) if ((st.balances.get(`comp:${g}`) ?? 0) >= C(5)) this.post(st, [{ id: `club-attend:${season}:${g}`, at: this.now(), kind: 'club-attendance', memo: `Club Weekend attendance (${this.name(g)})`, lines: [{ account: `comp:${g}`, amount: -C(5) }, { account: 'player:cash', amount: C(5) }], season }], posted);
  }

  private payClubWeekend(st: FedState, club: KoState, posted: Journal[]): void {
    const season = st.world.season;
    const pool = `prize:${season}:club`;
    const bal = st.balances.get(pool) ?? 0;
    const last = club.stages[club.stages.length - 1].round;
    if (bal) this.post(st, [payPool(`prize-pay:${season}:club`, pool, bal, club.champions.map(id => ({ id, share: 1 / club.champions.length })), 'Club Weekend prize', season, last, this.now())], posted);
    const sponsorAmt = (club.qualifiers.length === 8 ? 60 : 30) * MICRO;
    const sp = st.balances.get(`sponsor:${season}`) ?? 0;
    if (sp >= sponsorAmt) this.post(st, [{ id: `club-sponsor:${season}`, at: this.now(), kind: 'sponsor', memo: 'Club Weekend sponsor (completed event)', lines: [{ account: `sponsor:${season}`, amount: -sponsorAmt }, { account: 'player:cash', amount: sponsorAmt }], season }], posted);
  }

  // ------------------------------------------------------------------ institutions: club levels and sponsorship contracts
  clubLevelOf(): number { const c = [...(this.state?.assets.values() ?? [])].find(a => a.typeId === 'club'); return c ? c.level ?? 1 : 0; }

  async upgradeClub(): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const club = [...st.assets.values()].find(a => a.typeId === 'club');
      if (!club || club.suspended) throw new Error('You need an active Starter Chess Club to do this.');
      const to = (club.level ?? 1) + 1;
      if (to > 3) throw new Error('Your club is already a Federation Club, the top level.');
      if (st.plan.club && !st.plan.club.champions.length) throw new Error('Finish this season’s Club Weekend before you rebuild the club.');
      const posted: Journal[] = [];
      this.post(st, [clubUpgradeJournal(to, st.world.season, this.now())], posted);
      const next = { ...club, level: to };
      st.assets.set(club.id, next);
      this.snapshotFinance(st);
      await this.commit(st, posted, { assets: [next] }, { season: st.world.season, round: st.world.round });
    });
  }

  activeContracts(): Contract[] { return [...(this.state?.contracts.values() ?? [])].filter(c => c.status === 'active'); }

  /** Sign a competitor to a sponsorship contract (stipend for this season paid now). */
  async signContract(competitorId: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const club = [...st.assets.values()].find(a => a.typeId === 'club' && !a.suspended);
      if (!club) throw new Error('Sponsorship contracts are signed through your club. Buy a Starter Chess Club first.');
      const active = [...st.contracts.values()].filter(c => c.status === 'active');
      if (active.length >= clubLevel(club.level ?? 1).contractSlots) throw new Error('All your contract slots are full. Upgrade your club or release a contract.');
      const c = st.competitors.get(competitorId);
      if (!c || c.status !== 'active') throw new Error('That competitor is not active right now.');
      if (active.some(x => x.competitorId === competitorId)) throw new Error('You already sponsor this competitor.');
      // conflict rule: no new contract while you hold a position in an open market involving them
      const conflict = [...st.positions.values()].some(p => p.holder === 'player:cash' && p.shares.some(x => x) && ['open', 'closed'].includes(st.markets.get(p.marketId)?.status ?? '') && marketInvolves(st.markets.get(p.marketId)!, competitorId));
      if (conflict) throw new Error('You hold shares in a market with this competitor. Sell them or wait for the market to settle first.');
      const stipend = stipendFor(c.division, avgSeasonEarnings(c));
      const ct: Contract = { id: `ct:${competitorId}:${st.world.season}`, competitorId, signedSeason: st.world.season, stipend, share: CONTRACT_SHARE, status: 'active', earned: 0, paid: stipend, endedSeason: null };
      const posted: Journal[] = [];
      this.post(st, [stipendJournal(ct.id, competitorId, stipend, st.world.season, this.now())], posted);
      st.contracts.set(ct.id, ct);
      this.snapshotFinance(st);
      await this.commit(st, posted, { contracts: [ct], competitors: true }, { season: st.world.season, round: st.world.round });
    });
  }

  async releaseContract(contractId: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const ct = st.contracts.get(contractId);
      if (!ct || ct.status !== 'active') throw new Error('You have no active contract with this competitor.');
      const next: Contract = { ...ct, status: 'ended', endedSeason: st.world.season };
      st.contracts.set(ct.id, next);
      await this.commit(st, [], { contracts: [next] }, { season: st.world.season, round: st.world.round });
    });
  }

  /** Transfer the contract share of every prize paid in this command to a contracted competitor. */
  private contractShares(st: FedState, posted: Journal[], changed: Contract[]): void {
    const active = new Map([...st.contracts.values()].filter(c => c.status === 'active').map(c => [c.competitorId, c]));
    if (!active.size) return;
    for (const j of [...posted]) {
      if (j.kind !== 'prize') continue;
      for (const l of j.lines) {
        if (!l.account.startsWith('comp:') || l.amount <= 0) continue;
        const ct = active.get(l.account.slice(5));
        if (!ct) continue;
        const amt = Math.floor(l.amount * ct.share);
        if (amt <= 0) continue;
        this.post(st, [contractShareJournal(j.id, ct.competitorId, amt, st.world.season, this.now())], posted);
        const next = { ...ct, earned: ct.earned + amt };
        st.contracts.set(ct.id, next); active.set(ct.competitorId, next);
        const k = changed.findIndex(x => x.id === ct.id); if (k >= 0) changed[k] = next; else changed.push(next);
      }
    }
  }

  // ------------------------------------------------------------------ exchange
  /** Execute a player trade. `opts.expectVersion` (the market history length the quote was computed on) rejects
   *  stale quotes; `opts.maxTotal` caps what a buy may cost (slippage guard). */
  async trade(marketId: string, outcome: number, shares: number, side: 'buy' | 'sell', opts: { expectVersion?: number; expectRevision?: string; maxTotal?: number; minTotal?: number } = {}): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const m = this.tradableMarket(st, marketId, side, opts);
      const seq = m.history.length; // deterministic and unique per market: every trade appends one history entry
      const t = trade(m, st.positions.get(`${m.id}|player:cash`) ?? null, 'player:cash', outcome, shares, side, this.now(), seq);
      if (opts.maxTotal !== undefined && side === 'buy' && t.quote.total > opts.maxTotal) throw new Error('The cost is now above your limit. Check the new price and try again.');
      if (opts.minTotal !== undefined && side === 'sell' && t.quote.total < opts.minTotal) throw new Error('The sale would now return less than your limit. Check the new price and try again.');
      const posted: Journal[] = [];
      this.post(st, [t.journal], posted);
      st.markets.set(m.id, t.market);
      st.positions.set(t.position.id, t.position);
      this.snapshotFinance(st);
      await this.commit(st, posted, { markets: [t.market], positions: [t.position] }, { season: st.world.season, round: st.world.round });
    });
  }

  /** Every pre-trade check of a player trade, against the working state of the command (throws a player-facing reason). */
  private tradableMarket(st: FedState, marketId: string, side: 'buy' | 'sell', opts: { expectVersion?: number; expectRevision?: string }): Market {
    const m = st.markets.get(marketId);
    if (!m || m.sandbox) throw new Error('That market could not be found.');
    if (m.white === PLAYER_ID || m.black === PLAYER_ID) throw new Error('Official markets never list your own games.');
    const conflict = [...st.contracts.values()].find(c => c.status === 'active' && marketInvolves(m, c.competitorId));
    if (conflict && side === 'buy') throw new Error(`Conflict of interest: you sponsor ${this.name(conflict.competitorId)}, who plays in this market. You can still sell shares you already hold.`);
    if (opts.expectVersion !== undefined && m.history.length !== opts.expectVersion) throw new Error('Prices changed since you opened this ticket. Check the new price and try again.');
    if (opts.expectRevision !== undefined && revisionOf(m) !== opts.expectRevision) throw new Error(`Stale quote: the market moved (a new move or trade). Check the new price and try again.`);
    if (m.status !== 'open') throw new Error('Trading is closed for this market.');
    const sus = suspensionOf(st, m);
    if (sus) throw new Error(sus.text);
    return m;
  }

  /** Why trading is suspended on an open market right now (null = tradable or not open). */
  suspension(marketId: string): string | null {
    const st = this.state, m = st?.markets.get(marketId);
    return st && m ? suspensionOf(st, m)?.text ?? null : null;
  }

  /**
   * Close a position: sell every share the player holds in `marketId` (or only claim `claim`) in ONE command and one
   * commit — either every sale executes at the quoted revision or none does. `minTotal` bounds the combined net
   * proceeds (slippage guard). Returns the net proceeds, µ.
   */
  async closePosition(marketId: string, opts: { claim?: number; expectRevision?: string; minTotal?: number } = {}): Promise<number> {
    return this.run(async () => {
      const st = this.clone();
      let m = this.tradableMarket(st, marketId, 'sell', opts);
      let pos = st.positions.get(`${m.id}|player:cash`) ?? null;
      if (!pos || !pos.shares.some(x => x > 0)) throw new Error('You hold no shares in this market.');
      const claims = claimsOf(m);
      const which = opts.claim === undefined ? claims.map((_, i) => i) : [opts.claim];
      const posted: Journal[] = [];
      let net = 0;
      for (const c of which) {
        const k = pos!.shares[c] ?? 0;
        if (k <= 0) continue;
        const t = trade(m, pos, 'player:cash', c, k, 'sell', this.now(), m.history.length);
        this.post(st, [t.journal], posted);
        m = t.market; pos = t.position; net += t.quote.total;
      }
      if (!posted.length) throw new Error('You hold no shares of that outcome.');
      if (opts.minTotal !== undefined && net < opts.minTotal) throw new Error('Closing would now return less than your limit. Check the new price and try again.');
      st.markets.set(m.id, m);
      st.positions.set(pos!.id, pos!);
      this.snapshotFinance(st);
      await this.commit(st, posted, { markets: [m], positions: [pos!] }, { season: st.world.season, round: st.world.round });
      return net;
    });
  }

  /** v0.10 market watchlist (persisted with the player record; independent of the competitor watchlist). */
  marketWatchlist(): string[] { return this.state?.extra.marketWatch ?? []; }
  async setMarketWatch(marketId: string, on: boolean): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      if (!st.markets.has(marketId)) throw new Error('That market could not be found.');
      const cur = st.extra.marketWatch ?? [];
      st.extra.marketWatch = on ? [...new Set([...cur, marketId])].slice(-200) : cur.filter(x => x !== marketId);
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
    });
  }

  /** Free paper forecast (proper-scored; no money). One per market, before closure. */
  async forecast(marketId: string, probs: number[]): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const m = st.markets.get(marketId);
      if (!m || m.status !== 'open') throw new Error('Forecasts are closed because this market has closed.');
      const s = probs.reduce((a, b) => a + b, 0);
      if (s <= 0) throw new Error('That forecast is not valid. Enter a stake above zero.');
      if (probs.length !== m.q.length) throw new Error('A forecast needs one probability for each outcome.');
      if (probs.some(p => !Number.isFinite(p) || p < 0)) throw new Error('A forecast needs probabilities of zero or more.');
      // v0.10: no forecast while the market is suspended (recorded results the published model has not seen yet)
      const sus = suspensionOf(st, m);
      if (sus) throw new Error(sus.text.replace('Trading reopens', 'Forecasts reopen'));
      // snapshot of the public market price and model at forecast time (for honest comparisons later). v0.10 (bug #30):
      // in play, the public model at that moment is the LIVE model of the last published move, not the pre-game one
      const lg = m.live ? [...st.liveGames.values()].find(g => g.marketId === m.id) : undefined;
      const liveModel = lg && lg.moves.length > 0 && lg.points.length ? lg.points[lg.points.length - 1].model : null;
      st.extra.forecasts = [...st.extra.forecasts.filter(f => f.marketId !== marketId), { marketId, probs: probs.map(p => p / s), at: this.now(), outcome: null, prices: prices(m.q, m.b), model: liveModel ?? m.model ?? [m.forecast.w, m.forecast.d, m.forecast.l], ...(liveModel ? { ply: lg!.moves.length } : {}) }];
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
    });
  }

  // ------------------------------------------------------------------ assets
  async buyAsset(typeId: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const t = ASSETS.find(a => a.id === typeId);
      if (!t) throw new Error('That asset could not be found.');
      if (t.unique && [...st.assets.values()].some(a => a.typeId === typeId)) throw new Error('Already owned: you can only have one of these.');
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
      if (!a) throw new Error('You do not own this asset.');
      if (a.typeId === 'club' && st.plan.club && !st.plan.club.champions.length) throw new Error('Finish this season’s Club Weekend before you close the club.');
      const posted: Journal[] = [];
      this.post(st, [saleJournal(assetType(a.typeId), st.world.season, this.now())], posted);
      const ended: Contract[] = [];
      if (a.typeId === 'club') {
        this.post(st, [clubUpgradeRefundJournal(st.balances.get('asset:club:upgrade') ?? 0, st.world.season, this.now())], posted);
        for (const ct of [...st.contracts.values()].filter(c => c.status === 'active')) { const e = { ...ct, status: 'ended' as const, endedSeason: st.world.season }; st.contracts.set(ct.id, e); ended.push(e); }
      }
      st.assets.delete(id);
      this.snapshotFinance(st);
      await this.commit(st, posted, { delAssets: [id], contracts: ended }, { season: st.world.season, round: st.world.round });
    });
  }

  // ------------------------------------------------------------------ cosmetics (crown-cosmetics-1)
  cosmetics(): CosmeticState { return this.state?.extra.cosmetics ?? emptyCosmetics(); }
  /** Owned by purchase, or unlocked by a recorded accomplishment. */
  hasCosmetic(id: string): boolean {
    const c = cosmetic(id); const st = this.state;
    if (!c || !st) return false;
    if (c.earn) return earned(c, { fedTitle: st.world.player.fedTitle ?? null, titles: st.world.player.titles.map(t => t.title) }, FED_TITLES);
    return (st.extra.cosmetics?.owned ?? []).includes(id);
  }
  async buyCosmetic(id: string): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const c = cosmetic(id);
      if (!c) throw new Error('That item could not be found.');
      if (c.price === null) throw new Error('This item is earned through results and cannot be bought.');
      const cs = st.extra.cosmetics ?? emptyCosmetics();
      if (cs.owned.includes(id)) throw new Error('Already owned: this item is already in your collection.');
      if ((st.balances.get('player:cash') ?? 0) < c.price) throw new Error('You do not have enough cash for this item.');
      const posted: Journal[] = [];
      this.post(st, [cosmeticJournal(c, st.world.season, this.now())], posted);
      st.extra.cosmetics = { ...cs, owned: [...cs.owned, id], equipped: { ...cs.equipped, [c.kind]: id } };
      this.snapshotFinance(st);
      await this.commit(st, posted, {}, { season: st.world.season, round: st.world.round });
    });
  }
  async equipCosmetic(kind: CosmeticKind, id: string | null, avatarSeed?: number): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      if (id && (!this.hasCosmetic(id) || cosmetic(id)?.kind !== kind)) throw new Error('You have not unlocked this item yet.');
      if (avatarSeed !== undefined && (!this.hasCosmetic('avatar-portraits') || !AVATAR_SEEDS.includes(avatarSeed))) throw new Error('You need the Portrait Studio for this.');
      const cs = st.extra.cosmetics ?? emptyCosmetics();
      const equipped = { ...cs.equipped };
      if (id) equipped[kind] = id; else delete equipped[kind];
      st.extra.cosmetics = { ...cs, equipped, ...(avatarSeed !== undefined ? { avatarSeed } : {}) };
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
    });
  }

  ownsAsset(typeId: string): boolean { return [...(this.state?.assets.values() ?? [])].some(a => a.typeId === typeId && !a.suspended); }

  async setWatchlist(ids: string[]): Promise<void> {
    return this.run(async () => {
      const st = this.clone();
      const limit = this.ownsAsset('scouting') ? Infinity : 3;
      if (ids.length > limit) throw new Error('Your watchlist holds 3 competitors. Buy a Scouting Department to follow more.');
      st.extra.watchlist = [...new Set(ids)];
      await this.commit(st, [], {}, { season: st.world.season, round: st.world.round });
    });
  }

  // ------------------------------------------------------------------ finance view
  finance() {
    const st = this.state!;
    const cash = st.balances.get('player:cash') ?? 0;
    const owned = [...st.assets.values()];
    const assetValueSum = owned.filter(a => !a.suspended).reduce((s, a) => s + assetValue(assetType(a.typeId)), 0) + (owned.some(a => a.typeId === 'club' && !a.suspended) ? st.balances.get('asset:club:upgrade') ?? 0 : 0);
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

/** Does a market's outcome depend on this competitor? (conflict-of-interest rule for sponsorship contracts) */
export function marketInvolves(m: Market, competitorId: string): boolean {
  if (m.white === competitorId || m.black === competitorId) return true;
  if (m.ref?.subject === competitorId) return true;
  return String(m.ref?.ids ?? '').split(',').includes(competitorId);
}
