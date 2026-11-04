/**
 * The Sovereign Vault — event-driven evaluation. The service listens to the app's change notifications, but evaluates
 * only when a cheap change key moves (counts of finalized games, rating events, reports and Academy records, plus the
 * Federation round, titles, settled positions, forecasts and assets). Checks are throttled, deferred while a match is
 * being played, and never run per move. The first run backfills from history; later unlocks raise a notice once.
 */
import type { CrownDB } from '../storage/db';
import type { FederationService } from '../app/federation';
import type { GameRecord } from '../games/types';
import { VAULT, type EvalResult } from './catalog';
import { buildFacts, type Facts } from './facts';
import { loadProgress } from '../academy/grimoire';
import { BACKFILL_KEY, evaluateAll, loadToasted, loadUnlocks, markToasted, newUnlocks, saveUnlocks, type UnlockRecord } from './store';

export interface VaultHost {
  db: CrownDB;
  fed: FederationService;
  readonly readOnly: boolean;
  matchActive: boolean;
  subscribe(l: () => void): () => void;
}
const THROTTLE_MS = 1500;

export class VaultService {
  owned = new Map<string, UnlockRecord>();
  results = new Map<string, EvalResult>();
  facts: Facts | null = null;
  /** Unlocks waiting for their one-time notice. */
  pending: UnlockRecord[] = [];
  ready = false;
  version = 0;
  evaluations = 0;
  private toasted = new Set<string>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private dirty = false;
  private lastKey = '';
  private unsub: (() => void) | null = null;

  constructor(readonly host: VaultHost, readonly now: () => string = () => new Date().toISOString()) {}

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  private emit() { this.version++; for (const l of this.listeners) l(); }

  /** Load ownership, backfill once from history, then listen for changes. */
  async start(): Promise<void> {
    this.owned = await loadUnlocks(this.host.db);
    this.toasted = await loadToasted(this.host.db);
    this.pending = [...this.owned.values()].filter(u => !u.backfill && !this.toasted.has(u.id)).sort((a, b) => a.at.localeCompare(b.at));
    await this.evaluate(true);
    this.ready = true;
    this.emit();
    this.unsub = this.host.subscribe(() => this.schedule());
  }
  stop() { this.unsub?.(); if (this.timer) clearTimeout(this.timer); this.timer = null; }

  /** Throttled: at most one change-key check per THROTTLE_MS; deferred while a match is active. */
  schedule(delay = THROTTLE_MS): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; void this.tick(); }, delay);
  }
  private async tick(): Promise<void> {
    if (this.host.matchActive) { this.schedule(THROTTLE_MS * 2); return; }
    const key = await this.changeKey();
    if (key === this.lastKey) return;
    await this.evaluate(false);
  }

  async changeKey(): Promise<string> {
    const c = await this.host.db.recordCounts();
    const st = this.host.fed.state;
    let fed = 'none';
    if (st) {
      const p = st.world.player;
      let settled = 0;
      for (const m of st.markets.values()) if (m.status === 'settled') settled++;
      fed = [st.world.season, st.world.round, p.division, p.swissRegistered ? 1 : 0, st.balances.get('player:cash') ?? 0, p.history.length, p.titles.length, p.norms?.length ?? 0, p.fedTitle ?? '', settled, st.positions.size,
        st.extra.forecasts.length, st.assets.size, [...st.assets.values()].map(a => a.level ?? 1).join('.'), st.finance.points.length, Math.round(st.finance.peak)].join(':');
    }
    return `${Object.values(c).join(':')}|${fed}`;
  }

  /** Evaluate every collectible from saved records and record new unlocks (put-if-absent). */
  evaluate(firstRun = false): Promise<void> {
    if (this.running) { this.dirty = true; return this.running; }
    this.running = (async () => {
      try {
        do {
          this.dirty = false;
          const key = await this.changeKey();
          const facts = await this.loadFacts();
          const results = evaluateAll(VAULT, facts);
          this.facts = facts; this.results = results; this.evaluations++;
          if (!this.host.readOnly) {
            const backfill = firstRun && (await this.host.db.getMeta(BACKFILL_KEY)) === undefined;
            const fresh = await saveUnlocks(this.host.db, newUnlocks(results, this.owned, this.now(), backfill));
            for (const u of fresh) this.owned.set(u.id, u);
            if (backfill) await this.host.db.putMetaIfAbsent([{ key: BACKFILL_KEY, value: { at: this.now(), unlocks: fresh.length } }]);
            this.pending.push(...fresh.filter(u => !u.backfill && !this.toasted.has(u.id)));
          }
          this.lastKey = key;
          this.emit();
        } while (this.dirty);
      } catch (e) {
        console.error('vault evaluation', e);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async loadFacts(): Promise<Facts> {
    const db = this.host.db;
    const [games, ratingEvents, reports, bookmarks, attempts, trainingRuns] = await Promise.all([
      db.allGames(), db.ratingEvents(), db.allReports(),
      db.getAll<{ gameId: string; ply: number }>('bookmarks'), db.getAll<{ puzzleId: string; solved: boolean; clean: boolean }>('attempts'), db.getAll<{ endedAt: string | null; attempted: number }>('trainingRuns'),
    ]);
    const fed = this.host.fed.state;
    let netWorthNow: number | null = null;
    try { netWorthNow = fed ? this.host.fed.finance().netWorth : null; } catch { netWorthNow = null; }
    const grim = await loadProgress(db);
    return buildFacts({ games: games.filter((g: GameRecord) => g.status === 'finalized'), ratingEvents, reports, bookmarks, attempts, trainingRuns, fed, netWorthNow, owned: this.owned.keys(),
      grimoire: { attempts: grim.attempts, completions: [...grim.completions.values()] } });
  }

  /** The one-time notice was shown (or dismissed): never show it again, even after a reload. */
  async acknowledge(ids: string[]): Promise<void> {
    for (const id of ids) this.toasted.add(id);
    this.pending = this.pending.filter(u => !ids.includes(u.id));
    this.emit();
    if (!this.host.readOnly) await markToasted(this.host.db, ids, this.now());
  }
}
