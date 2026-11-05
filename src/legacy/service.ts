/**
 * Legacy service: awards trophies from recorded results (put-if-absent, idempotent), back-fills an existing save once,
 * keeps the earned-item lists the header customisation is checked against, and the restrained trophy ceremonies.
 * Event-driven and throttled like the Vault (src/vault/service.ts); deferred while a match is in progress.
 */
import { careerTimeline } from '../ratings/pools';
import type { CrownDB } from '../storage/db';
import type { FederationService } from '../app/federation';
import type { GameRecord } from '../games/types';
import type { PoolState, RatingEvent } from '../ratings/ledger';
import { PLAYER_ID, REGION_NAMES } from '../federation/model';
import { rivalriesOf } from '../app/rivalries';
import { leagueTable } from '../app/forecastLeague';
import { collectedTitles } from '../ratings/titles';
import { isProvisional } from '../ratings/glicko2';
import { regionEmblem } from '../heraldry/catalog';
import { TINCTURES } from '../heraldry/charges';
import { vaultDef } from '../vault/catalog';
import type { UnlockRecord } from '../vault/store';
import { cosmetic } from '../economy/cosmetics';
import { deriveAwards, newAwards, byPrestige, type LegacyInput, type TrophyRecord, type RivalryFact } from './trophies';
import { defaultPrefs, effective, equip, type BannerOption, type Change, type Earned, type LegacyPrefs } from './customise';
import { LEGACY_BACKFILL_KEY, loadAwards, loadPrefs, loadSeen, markSeen, saveAwards, savePrefs, type LegacyDB } from './store';

export interface LegacyHost {
  db: CrownDB & LegacyDB;
  fed: FederationService;
  readonly readOnly: boolean;
  matchActive: boolean;
  vault?: { owned: Map<string, UnlockRecord>; subscribe(l: () => void): () => void };
  subscribe(l: () => void): () => void;
}
const THROTTLE_MS = 1500;
const tint = (t: string) => (TINCTURES as Record<string, string>)[t] ?? t;
const TIER_COLORS: Record<number, [string, string]> = { 1: ['#9a6b3c', '#23262e'], 2: ['#c9d1da', '#2f5d93'], 3: ['#d6ac4f', '#7a2430'], 4: ['#d6ac4f', '#6b4a8c'], 5: ['#d6ac4f', '#111318'] };

/** Pure: which banners the career has (cosmetics owned or earned, region arms, seasonal banner trophies). */
export function bannerOptions(fed: FederationService, trophies: TrophyRecord[]): BannerOption[] {
  const out: BannerOption[] = [];
  if (fed.ready) {
    for (const id of ['banner-obsidian', 'banner-arms', 'banner-victor']) if (fed.hasCosmetic(id)) {
      const club = fed.clubIdentity();
      const colors: [string, string] = id === 'banner-arms' && club ? [tint(club.primary), tint(club.secondary)] : id === 'banner-victor' ? ['#8e2f3a', '#e2b84b'] : ['#14161c', '#8e2f3a'];
      out.push({ id: `cosmetic:${id}`, name: cosmetic(id)?.name ?? id, colors, source: 'Cosmetic' });
    }
    const r = fed.state!.world.player.region;
    const em = regionEmblem(r);
    out.push({ id: `region:${r}`, name: `Arms of ${REGION_NAMES[r]}`, colors: [tint(em.field[0]), tint(em.field[1])], source: 'Your regional federation' });
  }
  for (const t of trophies) if (t.kind === 'seasonal-banner') out.push({ id: `trophy:${t.key}`, name: t.name, colors: TIER_COLORS[t.tier], source: 'Seasonal banner trophy' });
  return out;
}

export interface CareerSnapshot { pool: PoolState | null; events: RatingEvent[] }

export class LegacyService {
  awards = new Map<string, TrophyRecord>();
  prefs: LegacyPrefs = defaultPrefs();
  earned: Earned = { trophies: [], banners: [], insignias: [], vault: [], exchangeTitles: [] };
  career: CareerSnapshot = { pool: null, events: [] };
  /** Newly awarded trophies waiting for their one-time ceremony. */
  pending: TrophyRecord[] = [];
  ready = false;
  version = 0;
  evaluations = 0;
  private seen = new Set<string>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private dirty = false;
  private unsubs: (() => void)[] = [];

  constructor(readonly host: LegacyHost, readonly now: () => string = () => new Date().toISOString()) {}

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private emit() { this.version++; for (const l of this.listeners) l(); }

  async start(): Promise<void> {
    this.awards = await loadAwards(this.host.db);
    this.seen = await loadSeen(this.host.db);
    this.prefs = await loadPrefs(this.host.db);
    this.pending = [...this.awards.values()].filter(a => !a.backfill && !this.seen.has(a.key)).sort((a, b) => a.at.localeCompare(b.at));
    await this.evaluate(true);
    this.ready = true;
    this.emit();
    this.unsubs.push(this.host.subscribe(() => this.schedule()));
    if (this.host.vault) this.unsubs.push(this.host.vault.subscribe(() => this.schedule(300)));
  }
  stop() { for (const u of this.unsubs) u(); this.unsubs = []; if (this.timer) clearTimeout(this.timer); this.timer = null; }

  schedule(delay = THROTTLE_MS): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; if (this.host.matchActive) { this.schedule(THROTTLE_MS * 2); return; } void this.evaluate(false); }, delay);
  }

  /** Gather the recorded facts trophies rest on. */
  async input(): Promise<{ input: LegacyInput; events: RatingEvent[]; pool: PoolState | null }> {
    const db = this.host.db;
    const [games, events, pool] = await Promise.all([db.allGames(), db.ratingEvents(), db.careerRating().catch(() => null)]);
    const finished = games.filter((g: GameRecord) => g.status === 'finalized');
    const st = this.host.fed.state;
    let rivalries: RivalryFact[] = [], forecastChampionSeasons: number[] = [];
    if (st) {
      const nameOf = (id: string) => st.competitors.get(id)?.name ?? id;
      rivalries = rivalriesOf(st, PLAYER_ID, finished, nameOf).map(r => {
        const opp = r.a === PLAYER_ID ? r.b : r.a;
        const mine = r.a === PLAYER_ID;
        return { opponentId: opp, opponentName: nameOf(opp), level: r.level, w: mine ? r.w : r.l, d: r.d, l: mine ? r.l : r.w, meetings: r.meetings, lastSeason: r.lastSeason };
      });
      for (let s = 1; s < st.world.season; s++) {
        try { const t = leagueTable(st.extra.forecasts, st.markets, s); if (t.qualified && t.youRank === 1) forecastChampionSeasons.push(s); } catch { /* no table for that season */ }
      }
    }
    const p = st?.world.player;
    return {
      events, pool: pool && pool.games > 0 ? pool : null,
      input: {
        titles: p?.titles ?? [], history: p?.history ?? [], currentDivision: p ? p.division : null, norms: p?.norms ?? [], fedTitle: p?.fedTitle ?? null,
        ratingEvents: events, games: finished, rivalries, forecastChampionSeasons,
      },
    };
  }

  evaluate(firstRun = false): Promise<void> {
    if (this.running) { this.dirty = true; return this.running; }
    this.running = (async () => {
      try {
        do {
          this.dirty = false;
          const { input, events, pool } = await this.input();
          const derived = deriveAwards(input);
          this.evaluations++;
          if (!this.host.readOnly) {
            const backfill = firstRun && (await this.host.db.getMeta(LEGACY_BACKFILL_KEY)) === undefined;
            const fresh = await saveAwards(this.host.db, newAwards(derived, this.awards, this.now(), backfill));
            for (const a of fresh) this.awards.set(a.key, a);
            if (backfill) await this.host.db.putMetaIfAbsent([{ key: LEGACY_BACKFILL_KEY, value: { at: this.now(), awards: fresh.length } }]);
            this.pending.push(...fresh.filter(a => !a.backfill && !this.seen.has(a.key)));
          }
          this.career = { pool, events };
          this.earned = this.computeEarned(events);
          this.emit();
        } while (this.dirty);
      } catch (e) {
        console.error('legacy evaluation', e);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private computeEarned(events: RatingEvent[]): Earned {
    const trophies = [...this.awards.values()].sort(byPrestige);
    const { collected } = collectedTitles(careerTimeline(events).map(e => ({ after: e.after, games: e.gamesBefore + 1, at: e.at })), isProvisional);
    const owned = [...(this.host.vault?.owned.values() ?? [])];
    const vault: Earned['vault'] = [], exchangeTitles: Earned['exchangeTitles'] = [];
    for (const u of owned) {
      const d = vaultDef(u.id);
      if (!d) continue;
      if (d.kind === 'exchange-title') exchangeTitles.push({ id: d.id, name: d.name });
      else if (d.kind === 'achievement') vault.push({ id: d.id, name: d.name });
    }
    return { trophies, banners: bannerOptions(this.host.fed, trophies), insignias: collected.map(t => t.index), vault, exchangeTitles };
  }

  /** The prefs as displayed (unearned stored choices dropped). */
  shown(): LegacyPrefs { return effective(this.prefs, this.earned); }

  /** Change one customisation; throws LegacyError for anything not earned. */
  async change(c: Change): Promise<void> {
    if (this.host.readOnly) throw new Error('This tab is read-only.');
    const next = equip(this.shown(), c, this.earned);
    await savePrefs(this.host.db, next);
    this.prefs = next;
    this.emit();
  }

  /** The ceremony was shown or dismissed: never again, even after a reload. */
  async acknowledge(keys: string[]): Promise<void> {
    for (const k of keys) this.seen.add(k);
    this.pending = this.pending.filter(a => !keys.includes(a.key));
    this.emit();
    if (!this.host.readOnly) await markSeen(this.host.db, keys, this.now());
  }
}
