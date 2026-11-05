/**
 * Trophy registry (crown-trophies-1). Every trophy the player can hold is defined here: a stable id, a name, a
 * description, the unlock rule in plain words, its kind (which fixes the original heraldic art, src/ui/TrophyArt.tsx),
 * its prestige tier and how its season, event and optional replay link are found.
 *
 * Trophies are AWARDED ONLY FROM RECORDED RESULTS — the Federation's recorded titles, season tables, norms and
 * federation title, the rating ledger, recorded meetings (rivalries), the forecasting league computed from stored
 * paper forecasts and the finished-game archive. `deriveAwards` is pure and deterministic: each award has a key built
 * from its definition and the recorded fact it rests on (e.g. `div-champion:s3:league`), and the store writes awards
 * put-if-absent (src/legacy/store.ts), so reloading, re-processing or back-filling an old save never duplicates,
 * rewrites or revokes a trophy. Nothing here is ever read by results, pairings, ratings or engine strength.
 */
import { careerTimeline } from '../ratings/pools';
import type { RatingEvent } from '../ratings/ledger';
import type { GameRecord } from '../games/types';
import type { Norm } from '../heraldry/titles';
import { FED_TITLES, type FedTitle } from '../heraldry/catalog';
import { isProvisional } from '../ratings/glicko2';
import { fmtInt } from '../ratings/display';

export const TROPHY_REGISTRY_ID = 'crown-trophies-1';

/** Ten families of trophy, each with its own silhouette. */
export const TROPHY_KINDS = ['regional-cup', 'division-trophy', 'seasonal-banner', 'invitational', 'rivalry-trophy', 'rating-milestone', 'medal', 'elite-honour', 'forecasting-championship', 'career-monument'] as const;
export type TrophyKind = typeof TROPHY_KINDS[number];
export const KIND_LABEL: Record<TrophyKind, string> = {
  'regional-cup': 'Regional Cups', 'division-trophy': 'Division Trophies', 'seasonal-banner': 'Seasonal Banners', invitational: 'Invitationals and Opens',
  'rivalry-trophy': 'Rivalry Trophies', 'rating-milestone': 'Rating Milestones', medal: 'Medals', 'elite-honour': 'Elite Honours',
  'forecasting-championship': 'Forecasting Championships', 'career-monument': 'Career Monuments',
};

/** Prestige tiers 1–5 (the art's metal and ornament follow the tier). */
export type Tier = 1 | 2 | 3 | 4 | 5;
export const TIER_NAME: Record<Tier, string> = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Royal', 5: 'Sovereign' };

export interface TrophyDef {
  id: string;
  kind: TrophyKind;
  name: string;
  description: string;
  /** The unlock rule, in plain words, exactly as `deriveAwards` applies it. */
  rule: string;
  /** Default tier; some awards set their own (e.g. a division title by division). */
  tier: Tier;
  /** Seasonal = one award per season (or event) it is won in; otherwise once per career. */
  repeatable: boolean;
}

export const TROPHIES: TrophyDef[] = [
  { id: 'regional-cup', kind: 'regional-cup', name: 'Regional Cup', description: 'A knockout or weekend cup of your region.', rule: 'Recorded winner of a cup event (Club Weekend or any recorded "Cup" title).', tier: 2, repeatable: true },
  { id: 'div-champion', kind: 'division-trophy', name: 'Division Shield', description: 'Champion of a division league.', rule: 'Recorded division champion title at a season\'s end (first place in your league table).', tier: 2, repeatable: true },
  { id: 'season-podium', kind: 'seasonal-banner', name: 'Season Podium Banner', description: 'A top-three finish in your league.', rule: 'Finished first, second or third in your division table at a season\'s end.', tier: 1, repeatable: true },
  { id: 'season-promotion', kind: 'seasonal-banner', name: 'Promotion Banner', description: 'Promoted to a higher division.', rule: 'Your recorded division for the next season is higher than the one you finished.', tier: 2, repeatable: true },
  { id: 'open-winner', kind: 'invitational', name: 'Open Goblet', description: 'Winner of a Swiss open or invitational event.', rule: 'Recorded winner of the Federation Open, the Challenger Open or any recorded invitational, Swiss or round-robin event.', tier: 3, repeatable: true },
  { id: 'rivalry', kind: 'rivalry-trophy', name: 'Rivalry Trophy', description: 'Mastery over a named rival.', rule: 'A rivalry of Nemesis level or higher (crown-rivalry-1) with at least 4 recorded meetings in which you have won more games than you lost.', tier: 3, repeatable: true },
  { id: 'rating-milestone', kind: 'rating-milestone', name: 'Rating Milestone', description: 'Your established career Elo reached a new 200-point line.', rule: 'An established (non-provisional) career Elo at or above the line after a rated game. Kept if the rating later falls.', tier: 1, repeatable: true },
  { id: 'norm-medal', kind: 'medal', name: 'Norm Medal', description: 'A Federation title norm.', rule: 'A recorded title norm (crown-titles-1) at an event\'s end.', tier: 2, repeatable: true },
  { id: 'crown-champion', kind: 'elite-honour', name: 'Crown of the Federation', description: 'Crown Champion of the Federation.', rule: 'Recorded Crown Champion (or Joint Crown Champion) title.', tier: 5, repeatable: true },
  { id: 'elite-event', kind: 'elite-honour', name: 'Elite Laurel', description: 'Winner of an elite championship or Sovereign final.', rule: 'Recorded winner of an elite championship, masters event or Sovereign final.', tier: 4, repeatable: true },
  { id: 'fed-title', kind: 'elite-honour', name: 'Federation Title Standard', description: 'A permanent Federation title (Squire, Knight, Paladin, Sovereign).', rule: 'Your recorded Federation title, and each title below it (titles are earned in order and never removed).', tier: 2, repeatable: true },
  { id: 'forecast-champion', kind: 'forecasting-championship', name: 'Forecasting Orb', description: 'First place in a season of the Forecasting League.', rule: 'Ranked first of the Forecasting League table of a finished season with at least 5 resolved paper forecasts (crown-forecast-league-1).', tier: 3, repeatable: true },
  { id: 'monument-games', kind: 'career-monument', name: 'Career Obelisk', description: 'A milestone count of rated games.', rule: 'Finished rated games across all pools: 10, 50, 100, 250, 500.', tier: 1, repeatable: true },
  { id: 'monument-seasons', kind: 'career-monument', name: 'Seasons Monument', description: 'A milestone count of completed Federation seasons.', rule: 'Recorded season finishes in the Federation: 1, 5, 10, 20.', tier: 1, repeatable: true },
];
export const trophyDef = (id: string): TrophyDef | undefined => TROPHIES.find(t => t.id === id);

/** A trophy instance held by the player (stored put-if-absent under `trophy:<key>`). */
export interface TrophyAward {
  key: string;
  defId: string;
  kind: TrophyKind;
  tier: Tier;
  /** Instance name, e.g. "Crown Division Shield — Season 3". */
  name: string;
  season: number | null;
  /** The recorded event or fact it rests on (title string, norm event, milestone). */
  event: string;
  evidence: string;
  /** When the evidence happened, if recorded (game end, rating event); otherwise null. */
  earnedAt: string | null;
  /** Optional link to the deciding game. */
  replay?: { gameId: string };
}
/** Stored form (adds bookkeeping). */
export interface TrophyRecord extends TrophyAward { at: string; backfill: boolean; registry: string }

export interface RivalryFact { opponentId: string; opponentName: string; level: string; w: number; d: number; l: number; meetings: number; lastSeason: number }
export interface LegacyInput {
  titles: { season: number; title: string }[];
  /** Season finishes, oldest first. */
  history: { season: number; division: number; rank: number; points: number }[];
  /** The player's current division (the season after the last finish), if a Federation exists. */
  currentDivision: number | null;
  norms: Norm[];
  fedTitle: FedTitle | null;
  /** Rating events of every pool (milestones use the career timeline: legacy Rapid up to the v1.1 seeding, then the Long Classical career pool). */
  ratingEvents: RatingEvent[];
  /** Finished games (for replay links and monuments). */
  games: GameRecord[];
  rivalries: RivalryFact[];
  /** Seasons in which the player ranked first of the Forecasting League. */
  forecastChampionSeasons: number[];
}

const DIVISION_WORDS = ['Crown', 'Grand', 'Premier', 'Masters', 'Senior', 'District', 'Club', 'Open'];
export const RATING_LINES = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400];
const GAME_COUNTS: [number, Tier][] = [[10, 1], [50, 2], [100, 3], [250, 4], [500, 5]];
const SEASON_COUNTS: [number, Tier][] = [[1, 1], [5, 2], [10, 3], [20, 4]];
const ratingTier = (line: number): Tier => (line >= 2800 ? 5 : line >= 2400 ? 4 : line >= 1800 ? 3 : line >= 1200 ? 2 : 1);

/** Which registry definition a recorded title string belongs to (titles come from the season engine and later packages). */
export function classifyTitle(title: string): { defId: string; tier: Tier; label: string } | null {
  if (/Crown Champion/.test(title)) return { defId: 'crown-champion', tier: 5, label: title.replace(/ S\d+$/, '') };
  if (/Sovereign Final|Elite|Masters Championship|Grand Final/i.test(title)) return { defId: 'elite-event', tier: 4, label: title.replace(/ S\d+$/, '') };
  const div = / ?(\w+) Division champion/.exec(title);
  if (div) { const d = DIVISION_WORDS.indexOf(div[1]) + 1; return { defId: 'div-champion', tier: d === 1 ? 4 : d > 0 && d <= 3 ? 3 : 2, label: `${div[1]} Division Shield` }; }
  if (/Cup|Club Weekend/i.test(title)) return { defId: 'regional-cup', tier: /Federation Cup|National Cup/i.test(title) ? 3 : 2, label: title.replace(/ S\d+$/, '').replace(/ winner$/, '') };
  if (/Federation Open/.test(title)) return { defId: 'open-winner', tier: 3, label: 'Federation Open Goblet' };
  if (/Challenger Open/.test(title)) return { defId: 'open-winner', tier: 2, label: 'Challenger Open Goblet' };
  if (/Invitational|Swiss|Round Robin|Open|winner|champion/i.test(title)) return { defId: 'open-winner', tier: 3, label: title.replace(/ S\d+$/, '').replace(/ winner$/, '') };
  return null;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** The player's last finished federation game of a season whose event matches (replay link of an event trophy). */
function deciderOf(games: GameRecord[], season: number, defId: string, title: string): string | undefined {
  const want = (ev: string) => defId === 'div-champion' ? ev.startsWith('league')
    : defId === 'crown-champion' ? ev.startsWith('champ')
      : /Club Weekend/.test(title) ? ev.startsWith('club')
        : /Open/.test(title) ? ev.startsWith('swiss') || ev.includes('open') || ev.includes('challenger') : false;
  const gs = games.filter(g => g.status === 'finalized' && g.context?.kind === 'federation' && (g.context.fixtureId ?? '').startsWith(`${season}:`) && want(g.context.tournamentId ?? g.context.fixtureId?.split(':')[2] ?? ''))
    .sort((a, b) => (a.endedAt ?? a.startedAt).localeCompare(b.endedAt ?? b.startedAt));
  return gs.at(-1)?.id;
}

/** Every trophy the recorded career supports — pure and deterministic (same input → same keys, same order). */
export function deriveAwards(x: LegacyInput): TrophyAward[] {
  const out: TrophyAward[] = [];
  const add = (a: TrophyAward) => { if (!out.some(o => o.key === a.key)) out.push(a); };
  // event titles
  const seen = new Map<string, number>();
  for (const t of [...x.titles].sort((a, b) => a.season - b.season || a.title.localeCompare(b.title))) {
    const c = classifyTitle(t.title);
    if (!c) continue;
    const base = `${c.defId}:s${t.season}:${slug(t.title.replace(/ S\d+$/, ''))}`;
    const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
    const gameId = deciderOf(x.games, t.season, c.defId, t.title);
    add({ key: n > 1 ? `${base}:${n}` : base, defId: c.defId, kind: trophyDef(c.defId)!.kind, tier: c.tier, name: `${c.label} — Season ${t.season}`, season: t.season, event: t.title, evidence: `Recorded title: ${t.title}`, earnedAt: null, ...(gameId ? { replay: { gameId } } : {}) });
  }
  // seasonal banners: podiums and promotions from the recorded season tables
  const hist = [...x.history].sort((a, b) => a.season - b.season);
  hist.forEach((h, i) => {
    if (h.rank <= 3) add({ key: `season-podium:s${h.season}`, defId: 'season-podium', kind: 'seasonal-banner', tier: h.rank === 1 ? 3 : h.rank === 2 ? 2 : 1, name: `${['First', 'Second', 'Third'][h.rank - 1]} Place Banner — Season ${h.season}`, season: h.season, event: `${DIVISION_WORDS[h.division - 1] ?? 'Division'} Division, place ${h.rank}`, evidence: `Season ${h.season}: place ${h.rank} with ${h.points} points`, earnedAt: null });
    const nextDiv = i + 1 < hist.length ? hist[i + 1].division : x.currentDivision;
    if (nextDiv !== null && nextDiv < h.division) add({ key: `season-promotion:s${h.season}`, defId: 'season-promotion', kind: 'seasonal-banner', tier: nextDiv <= 2 ? 3 : 2, name: `Promotion Banner — Season ${h.season}`, season: h.season, event: `${DIVISION_WORDS[h.division - 1] ?? 'Division'} → ${DIVISION_WORDS[nextDiv - 1] ?? 'Division'} Division`, evidence: `Promoted after finishing place ${h.rank} in season ${h.season}`, earnedAt: null });
  });
  // norms
  const normCount = new Map<string, number>();
  for (const nm of [...x.norms].sort((a, b) => a.season - b.season || a.event.localeCompare(b.event))) {
    const base = `norm-medal:s${nm.season}:${slug(nm.event)}`;
    const k = (normCount.get(base) ?? 0) + 1; normCount.set(base, k);
    const tier = (nm.tier ? Math.min(5, FED_TITLES.indexOf(nm.tier) + 2) : 1) as Tier;
    add({ key: k > 1 ? `${base}:${k}` : base, defId: 'norm-medal', kind: 'medal', tier, name: `${nm.tier ?? 'Title'} Norm Medal — ${nm.event}`, season: nm.season, event: nm.event, evidence: `${nm.score}/${nm.games}, performance ${nm.tpr}`, earnedAt: null });
  }
  // federation titles (held title and every one below it)
  if (x.fedTitle) for (const t of FED_TITLES.slice(0, FED_TITLES.indexOf(x.fedTitle) + 1)) {
    add({ key: `fed-title:${slug(t)}`, defId: 'fed-title', kind: 'elite-honour', tier: ([2, 3, 4, 5] as Tier[])[FED_TITLES.indexOf(t)], name: `${t} Standard`, season: null, event: `Federation title ${t}`, evidence: `Federation title ${x.fedTitle} recorded`, earnedAt: null });
  }
  // rating milestones (the career timeline = the Federation's career Elo, src/ratings/pools.ts; established ratings only)
  const rapid = careerTimeline(x.ratingEvents);
  for (const line of RATING_LINES) {
    const e = rapid.find(ev => ev.after.rating >= line && !isProvisional(ev.gamesBefore + 1, ev.after.rd));
    if (e) add({ key: `rating-milestone:${line}`, defId: 'rating-milestone', kind: 'rating-milestone', tier: ratingTier(line), name: `${fmtInt(line)} Career Elo Milestone`, season: null, event: `Established career Elo ${fmtInt(line)}+`, evidence: `${Math.round(e.after.rating)} ±${Math.round(e.after.rd)} after rated game ${e.sequence} vs ${e.opponent.name}`, earnedAt: e.at, replay: { gameId: e.gameId } });
  }
  // rivalries
  for (const r of [...x.rivalries].sort((a, b) => a.opponentId.localeCompare(b.opponentId))) {
    if (!['Nemesis', 'Arch-rival'].includes(r.level) || r.meetings < 4 || r.w <= r.l) continue;
    add({ key: `rivalry:${r.opponentId}`, defId: 'rivalry', kind: 'rivalry-trophy', tier: r.level === 'Arch-rival' ? 4 : 3, name: `Rivalry Trophy — ${r.opponentName}`, season: r.lastSeason, event: `${r.level}: ${r.w}–${r.d}–${r.l} in ${r.meetings} meetings`, evidence: `Recorded meetings with ${r.opponentName}: ${r.w} wins, ${r.d} draws, ${r.l} losses`, earnedAt: null });
  }
  // forecasting league
  for (const s of [...new Set(x.forecastChampionSeasons)].sort((a, b) => a - b)) add({ key: `forecast-champion:s${s}`, defId: 'forecast-champion', kind: 'forecasting-championship', tier: 3, name: `Forecasting Orb — Season ${s}`, season: s, event: `Forecasting League S${s}`, evidence: `First in the Forecasting League table of season ${s}`, earnedAt: null });
  // monuments
  const rated = x.games.filter(g => g.status === 'finalized' && g.rated && g.ratingEventId).sort((a, b) => (a.endedAt ?? a.startedAt).localeCompare(b.endedAt ?? b.startedAt));
  for (const [n, tier] of GAME_COUNTS) if (rated.length >= n) add({ key: `monument-games:${n}`, defId: 'monument-games', kind: 'career-monument', tier, name: `${fmtInt(n)} Rated Games Obelisk`, season: null, event: `${n} rated games`, evidence: `Rated game ${n} finished`, earnedAt: rated[n - 1].endedAt ?? rated[n - 1].startedAt, replay: { gameId: rated[n - 1].id } });
  for (const [n, tier] of SEASON_COUNTS) if (hist.length >= n) add({ key: `monument-seasons:${n}`, defId: 'monument-seasons', kind: 'career-monument', tier, name: `${n} Season${n === 1 ? '' : 's'} Monument`, season: hist[n - 1].season, event: `${n} Federation season${n === 1 ? '' : 's'} completed`, evidence: `Season ${hist[n - 1].season} finished`, earnedAt: null });
  return out;
}

/** Awards not yet held — pure. */
export function newAwards(derived: TrophyAward[], held: ReadonlyMap<string, unknown>, nowIso: string, backfill: boolean): TrophyRecord[] {
  return derived.filter(a => !held.has(a.key)).map(a => ({ ...a, at: nowIso, backfill, registry: TROPHY_REGISTRY_ID }));
}

/** Display order: highest tier first, then newest season. */
export const byPrestige = (a: TrophyAward, b: TrophyAward) => b.tier - a.tier || (b.season ?? 0) - (a.season ?? 0) || a.key.localeCompare(b.key);
