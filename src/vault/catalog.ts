/**
 * The Sovereign Vault — catalog (crown-vault-1). Permanent collectibles: achievements, the 31 rating-title insignias
 * and the Exchange title ladder. Every entry is data plus a pure rule over Facts (src/vault/facts.ts). Ids are stable
 * and never reused; the eight achievements from v0.5–v0.8 keep their ids. Art uses the heraldry grammar only:
 * the collection sets the silhouette, rarity raises border, crest, wreath, pips and prestige.
 *
 * Brilliance and grading-based entries are defined but cannot be earned while the move grading is experimental
 * (GRADING_ID ends in "-experimental"): they show as "Awaiting validated grading" and are never awarded.
 */
import type { EmblemSpec } from '../heraldry/spec';
import type { ChargeId, ShapeId, Tincture } from '../heraldry/charges';
import { FED_TITLES, type FedTitle } from '../heraldry/catalog';
import { RATING_TITLES, insigniaSpec, type Era } from '../ratings/titles';
import { GRADING_ID } from '../analysis/methodology';
import { PLAYED_LIKE_ID, PLAYED_LIKE_VALIDATED } from '../analysis/playedLike';
import { fmtMoney, MICRO } from '../exchange/ledger';
import { chaptersOfBook, chaptersTagged, indexChapters } from '../academy/grimoire';
import { calibrationStats, comebackRun, drawdownRecovery, exchangeStats, lowToHigh, qualifiedWins, ratedGames, seasonPnl, unbeatenRun, winStreak, DAILY_CAP, WEAK_GAP, type Facts, type OwnGame } from './facts';
import { LEGACY_FAMILY, TIER_OF_RARITY, type FamilyId, type Tier } from './families';

/** crown-vault-2 (v0.11) adds the families, tiers and the expansion below; every crown-vault-1 entry is unchanged. */
export const VAULT_ID = 'crown-vault-2';
/** Ids of the crown-vault-1 catalog (v0.9/v0.10 saves), for the migration back-fill and the preservation tests. */
export const VAULT_V1_COUNT = 142;
/** Brilliance, accuracy and Played Like collectibles unlock only once the grading is validated. */
export const GRADING_VALIDATED = !/experimental/.test(GRADING_ID);

export const COLLECTIONS = ['Chess Mastery', 'Brilliant Mind', 'Federation Career', 'Rivals', 'Tournaments', 'Grand Exchange', "Patron's Treasury", 'Legacy', 'Insignias'] as const;
export type Collection = typeof COLLECTIONS[number];
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;
export type Rarity = typeof RARITIES[number];
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };

export interface EvalResult { earned: boolean; progress?: { have: number; need: number }; evidence?: string; ref?: string; when?: string }
export interface VaultDef {
  id: string; name: string; collection: Collection; rarity: Rarity;
  kind: 'achievement' | 'insignia' | 'exchange-title';
  description: string;
  /** Exact condition, in plain words. */
  rule: string;
  secret?: boolean;
  /** Needs validated move grading; never earned while GRADING_VALIDATED is false. */
  requiresValidatedGrading?: boolean;
  /** crown-vault-2: needs the validated Played Like model; never earned while PLAYED_LIKE_VALIDATED is false. */
  requiresValidatedPlayedLike?: boolean;
  /** crown-vault-2: the family this collectible belongs to, and its tier (a fixed reading of rarity). */
  family: FamilyId;
  tier: Tier;
  /** crown-vault-2: catalog version that introduced it. */
  since: 'crown-vault-1' | 'crown-vault-2';
  art: EmblemSpec;
  evaluate(f: Facts): EvalResult;
}

// ---------------------------------------------------------------- art
const SHAPE: Record<Collection, ShapeId> = {
  'Chess Mastery': 'hexagon', 'Brilliant Mind': 'lozenge', 'Federation Career': 'heater', Rivals: 'kite', Tournaments: 'banner',
  'Grand Exchange': 'roundel', "Patron's Treasury": 'octagon', Legacy: 'tower', Insignias: 'pennant',
};
const DIV: Record<Rarity, EmblemSpec['division']> = { common: 'plain', uncommon: 'fess', rare: 'chief', epic: 'chevron', legendary: 'saltire', mythic: 'quarterly' };
const LIGHT = new Set<string>(['or', 'argent', 'celeste']);
export function vaultArt(collection: Collection, rarity: Rarity, charge: ChargeId, field: Tincture, monogram?: string): EmblemSpec {
  const r = RARITIES.indexOf(rarity);
  return {
    shape: SHAPE[collection], division: DIV[rarity], field: [field, r >= 4 ? 'or' : 'sable'], charge,
    chargeColor: LIGHT.has(field) ? 'sable' : r >= 3 ? 'or' : 'argent',
    border: r >= 4 ? 'pixel' : r >= 2 ? 'double' : 'single',
    crest: r === 5 ? 'crown' : r === 4 ? 'star' : r === 3 ? 'coronet' : null,
    wreath: r >= 4, pips: r + 1, prestige: r, ...(monogram ? { monogram } : {}),
  };
}

// ---------------------------------------------------------------- rule helpers
const count = (have: number, need: number, evidence?: string, when?: string): EvalResult =>
  ({ earned: have >= need, progress: { have: Math.min(have, need), need }, ...(have >= need ? { evidence, when } : {}) });
const hit = (ok: boolean, evidence?: string | null | false, when?: string, ref?: string): EvalResult => (ok ? { earned: true, evidence: evidence || undefined, when, ref } : { earned: false });
const day = (iso: string) => iso.slice(0, 10);
const vs = (g: OwnGame, extra = '') => `${g.score === 1 ? 'Won' : g.score === 0.5 ? 'Drew' : 'Lost'} vs ${g.oppName}${extra} on ${day(g.at)}`;
const gap = (g: OwnGame) => (g.myRating !== null && g.oppRating !== null ? g.oppRating - g.myRating : null);
const firstWin = (f: Facts, p: (g: OwnGame) => boolean, label = (g: OwnGame) => vs(g)): EvalResult => {
  const g = f.games.find(x => x.score === 1 && p(x));
  return g ? { earned: true, evidence: label(g), when: g.at, ref: g.id } : { earned: false };
};
const winsWithGap = (min: number, onlyQm = false) => (f: Facts) =>
  firstWin(f, g => (!onlyQm || g.quickMatch) && (!onlyQm || g.rated) && gap(g) !== null && gap(g)! >= min, g => vs(g, ` (${Math.round(g.oppRating!)} vs your ${Math.round(g.myRating!)})`));
const regionsBeaten = (games: OwnGame[]) => new Set(games.filter(g => g.score === 1 && g.oppRegion !== null).map(g => g.oppRegion));
const seasonsOf = (titles: { season: number; title: string }[], re: RegExp) => titles.filter(t => re.test(t.title)).map(t => t.season);
const CHAMP = /^(Joint )?Crown Champion S\d+/;
const LEAGUE = / champion \(/;

/** Grimoire chapters: earned when every listed chapter has a completion record; `when` is the last of them. */
const chaptersDone = (f: Facts, ids: string[], evidence: string): EvalResult => {
  const have = ids.filter(id => f.grimoire.completed.has(id));
  const when = have.map(id => f.grimoire.completed.get(id)!).sort().pop();
  return count(have.length, ids.length || Infinity, evidence, when);
};
const booksDone = (f: Facts, books: number[], evidence: string) => chaptersDone(f, books.flatMap(b => chaptersOfBook(b).map(c => c.id)), evidence);
const chapterTitle = (id: string) => indexChapters().find(c => c.id === id)?.title ?? id;

interface Spec { id: string; name: string; c: Collection; r: Rarity; charge: ChargeId; field: Tincture; d: string; rule: string; secret?: boolean; grading?: boolean; pl?: boolean; kind?: VaultDef['kind']; mono?: string; fam?: FamilyId; ev: (f: Facts) => EvalResult }
const AWAIT = (): EvalResult => ({ earned: false });

const WIN_TIERS: [number, string, Rarity][] = [[10, 'Ten Victories', 'common'], [50, 'Fifty Victories', 'uncommon'], [100, 'Hundred Victories', 'rare'], [500, 'Five Hundred Victories', 'epic'], [1000, 'Thousand Victories', 'legendary']];
const RATING_TIERS: [number, Rarity][] = [[500, 'common'], [1000, 'common'], [1500, 'uncommon'], [2000, 'rare'], [2500, 'legendary'], [3000, 'mythic']];

const SPECS: Spec[] = [
  // ---------------------------------------------------------------- A. Chess Mastery
  { id: 'first-win', name: 'First Blood', c: 'Chess Mastery', r: 'common', charge: 'sword', field: 'gules', d: 'Win your first game.', rule: 'Win a finished rated or casual game without assistance.',
    ev: f => { const r = firstWin(f, () => true); return r.earned || !f.fed?.sponsorsPaid.includes('first-federation-win') ? r : { earned: true, evidence: 'First Federation win (sponsor milestone)' }; } },
  { id: 'first-draw', name: 'Honours Even', c: 'Chess Mastery', r: 'common', charge: 'scales', field: 'steel', d: 'Hold an engine to a draw.', rule: 'Draw a finished rated or casual game without assistance.',
    ev: f => { const g = f.games.find(x => x.score === 0.5); return g ? { earned: true, evidence: vs(g), when: g.at, ref: g.id } : { earned: false }; } },
  ...WIN_TIERS.map(([n, name, r]): Spec => ({ id: `wins-${n}`, name, c: 'Chess Mastery', r, charge: n >= 500 ? 'crown' : n >= 100 ? 'queen' : 'knight', field: n >= 500 ? 'sanguine' : 'gules', d: `Win ${n.toLocaleString('en')} games.`,
    rule: `Win ${n.toLocaleString('en')} rated or casual games without assistance. Each opponent counts once per day.`,
    ev: f => { const w = f.countedWins; return count(w.length, n, w[n - 1] && `Win ${n}: ${vs(w[n - 1])}`, w[n - 1]?.at); } })),
  { id: 'first-mate', name: 'The Final Spell', c: 'Chess Mastery', r: 'common', charge: 'king', field: 'purpure', d: 'Deliver checkmate.', rule: 'Win a game by checkmate.', ev: f => firstWin(f, g => g.termination === 'checkmate', g => vs(g, ' by checkmate')) },
  { id: 'clean-sheet', name: 'Untouched', c: 'Chess Mastery', r: 'rare', charge: 'chalice', field: 'argent', d: 'Win without losing a single piece.', rule: 'Win a game of at least 20 moves in total without losing any piece or pawn.',
    ev: f => firstWin(f, g => g.plies >= 20 && !g.lostMaterial, g => vs(g, `, ${g.plies} moves, nothing lost`)) },
  { id: 'comeback', name: 'Turned Tide', c: 'Chess Mastery', r: 'rare', charge: 'hourglass', field: 'azure', d: 'Win from a big material deficit.', rule: 'Win a game after being at least 3 pawns down in material at any point.',
    ev: f => firstWin(f, g => g.worstDiff <= -3, g => vs(g, ` after being ${-g.worstDiff} pawns down`)) },
  { id: 'upset-higher', name: 'Upward Duel', c: 'Chess Mastery', r: 'uncommon', charge: 'tower', field: 'vert', d: 'Beat a higher-rated opponent.', rule: 'Win a game against an opponent rated above you (both ratings recorded in the game).', ev: winsWithGap(1) },
  { id: 'giant-slayer', name: 'Giant Slayer', c: 'Chess Mastery', r: 'rare', charge: 'griffin', field: 'sanguine', d: 'Beat an opponent rated 200+ above you.', rule: 'Win a game against an opponent whose recorded rating is at least 200 above yours.', ev: winsWithGap(200) },
  { id: 'titan-slayer', name: 'Titan Slayer', c: 'Chess Mastery', r: 'epic', charge: 'griffin', field: 'purpure', d: 'Beat an opponent rated 500+ above you.', rule: 'Win a game against an opponent whose recorded rating is at least 500 above yours.', ev: winsWithGap(500) },
  { id: 'sovereign-unbound', name: 'Unbound Victory', c: 'Chess Mastery', r: 'legendary', charge: 'crown', field: 'sable', d: 'Defeat Sovereign Unbound.', rule: 'Win a game against Sovereign Unbound at the rated thinking budget (10 s per move) or more.',
    ev: f => firstWin(f, g => g.level === 9 && (g.budgetMs ?? 0) >= 10_000, g => vs(g, ` at ${Math.round(g.budgetMs! / 1000)} s per move`)) },
  { id: 'sovereign-deep', name: 'Beyond Time', c: 'Chess Mastery', r: 'mythic', charge: 'sun', field: 'sable', d: 'Defeat Sovereign Unbound at its deepest.', rule: 'Win a game against Sovereign Unbound at a thinking budget of 30 s per move or more.',
    ev: f => firstWin(f, g => g.level === 9 && (g.budgetMs ?? 0) >= 30_000, g => vs(g, ` at ${Math.round(g.budgetMs! / 1000)} s per move`)) },
  ...([[10, 'Unbroken Ten', 'rare'], [25, 'Unbroken Twenty-Five', 'epic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `streak-${n}`, name, c: 'Chess Mastery', r, charge: 'rook', field: n > 10 ? 'purpure' : 'azure', d: `Go ${n} rated games without a loss.`, rule: `Play ${n} rated games in a row without a loss (draws keep the run alive).`,
    ev: f => { const u = unbeatenRun(f.rated, n); return count(u.best, n, u.reached ? `Run completed vs ${u.reached.oppName} on ${day(u.reached.at)}` : undefined, u.reached?.at); } })),
  { id: 'all-colours', name: 'Both Sides of the Board', c: 'Chess Mastery', r: 'uncommon', charge: 'pawn', field: 'steel', d: 'Win rated games with both colours.', rule: 'Win 10 rated games with White and 10 rated games with Black.',
    ev: f => { const { white, black } = f.ratedWinsByColour; return count(Math.min(white, 10) + Math.min(black, 10), 20, `${white} wins with White, ${black} with Black`); } },
  { id: 'accuracy-90', name: 'Precise Hand', c: 'Chess Mastery', r: 'rare', charge: 'quill', field: 'celeste', d: 'Play a near-flawless game.', rule: 'A complete Match Analysis with accuracy of 90 or more over at least 20 graded moves.', grading: true, ev: AWAIT },

  // ---------------------------------------------------------------- B. Brilliant Mind
  ...([[1, 'First Spark', 'uncommon'], [5, 'Five Sparks', 'rare'], [25, 'Constellation', 'epic'], [100, 'Starfield', 'legendary']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `brilliant-${n}`, name, c: 'Brilliant Mind', r, charge: 'star', field: n >= 25 ? 'azure' : 'celeste', d: `Play ${n === 1 ? 'a Brilliant move' : `${n} Brilliant moves`}.`, rule: `Career Brilliant moves in your own games: ${n}. Counts the latest complete report per game.`, grading: true, ev: AWAIT })),
  { id: 'brilliant-up', name: 'Spark Above', c: 'Brilliant Mind', r: 'rare', charge: 'flame', field: 'tenne', d: 'Shine against a stronger player.', rule: 'Play a Brilliant move in a win against a higher-rated opponent.', grading: true, ev: AWAIT },
  { id: 'brilliant-final', name: 'Final Flourish', c: 'Brilliant Mind', r: 'epic', charge: 'sun', field: 'sanguine', d: 'Shine in a final.', rule: 'Play a Brilliant move in a tournament final.', grading: true, ev: AWAIT },
  { id: 'defence-critical', name: 'Last Ward', c: 'Brilliant Mind', r: 'rare', charge: 'gate', field: 'steel', d: 'Find the only defence.', rule: 'Win a game in which a critical defensive only move was graded Best.', grading: true, ev: AWAIT },
  { id: 'played-like-high', name: 'Beyond Yourself', c: 'Brilliant Mind', r: 'epic', charge: 'moon', field: 'purpure', d: 'Play far above your rating.', rule: 'A validated Played Like estimate at least 300 above your rating whose interval excludes your rating.', grading: true, ev: AWAIT },
  { id: 'played-like-steady', name: 'Steady Hand', c: 'Brilliant Mind', r: 'rare', charge: 'scales', field: 'azure', d: 'Play true to your rating.', rule: '10 consecutive estimated games within 150 of your rating.', grading: true, ev: AWAIT },
  { id: 'analyses-10', name: 'Student of the Game', c: 'Brilliant Mind', r: 'common', charge: 'book', field: 'bronze', d: 'Review your games.', rule: 'Complete a Match Analysis of 10 of your own finished games (re-analysing a game does not count twice).',
    ev: f => count(f.analyses.complete, 10, `${f.analyses.complete} games analysed`, f.analyses.lastAt ?? undefined) },
  { id: 'analyses-100', name: 'Archivist', c: 'Brilliant Mind', r: 'rare', charge: 'book', field: 'purpure', d: 'Build a library of reviewed games.', rule: 'Complete a Match Analysis of 100 of your own finished games.',
    ev: f => count(f.analyses.complete, 100, `${f.analyses.complete} games analysed`, f.analyses.lastAt ?? undefined) },
  { id: 'deep-review', name: 'Deep Reading', c: 'Brilliant Mind', r: 'uncommon', charge: 'key', field: 'azure', d: 'Study games in depth.', rule: 'Complete a Deep (depth 9) Match Analysis of 10 different games.',
    ev: f => count(f.analyses.deep, 10, `${f.analyses.deep} deep analyses`) },
  { id: 'bookmarks-25', name: 'Marginalia', c: 'Brilliant Mind', r: 'common', charge: 'quill', field: 'bronze', d: 'Mark positions worth remembering.', rule: 'Bookmark 25 different positions in your games.',
    ev: f => count(f.bookmarks, 25, `${f.bookmarks} bookmarked positions`) },
  { id: 'retry-master', name: 'Second Chance', c: 'Brilliant Mind', r: 'uncommon', charge: 'hourglass', field: 'vert', d: 'Turn mistakes into wins.', rule: 'Win 5 different training retries started from your own mistakes.',
    ev: f => count(f.retryWins, 5, `${f.retryWins} retries won`) },

  // ---------------------------------------------------------------- C. Federation Career
  { id: 'first-title', name: 'Named', c: 'Federation Career', r: 'common', charge: 'quill', field: 'azure', d: 'Establish your rating.', rule: 'Reach an established Rapid rating (20+ rated games and RD 100 or less) and collect your first insignia.',
    ev: f => hit(f.insignia.collected.length > 0, `First insignia: ${RATING_TITLES[f.insignia.collected[0]]?.name}`) },
  ...RATING_TIERS.map(([n, r]): Spec => ({ id: `rating-${n}`, name: `Rating ${n.toLocaleString('en')}`, c: 'Federation Career', r, charge: n >= 2500 ? 'crown' : n >= 2000 ? 'king' : 'rook', field: n >= 2500 ? 'sanguine' : n >= 2000 ? 'purpure' : 'steel',
    d: `Reach an established rating of ${n.toLocaleString('en')}.`, rule: `Your established Rapid rating reaches ${n.toLocaleString('en')} or more.`,
    ev: f => hit((f.insignia.peakRating ?? -Infinity) >= n, `Peak established rating ${Math.round(f.insignia.peakRating ?? 0)}`) })),
  ...([[10, 'Collector', 'rare'], [20, 'Curator', 'epic'], [31, 'Complete Heraldry', 'mythic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `insignias-${n}`, name, c: 'Federation Career', r, charge: 'laurel', field: n === 31 ? 'or' : 'bronze', d: `Collect ${n} rating insignias.`, rule: `Collect ${n} of the 31 rating-title insignias with an established Rapid rating.`,
    ev: f => count(f.insignia.collected.length, n, `${f.insignia.collected.length} insignias collected`) })),
  { id: 'promotion', name: 'Ascent', c: 'Federation Career', r: 'uncommon', charge: 'tower', field: 'vert', d: 'Win promotion.', rule: 'Be promoted to a higher division at the end of a season.',
    ev: f => { const p = f.fed?.promotions[0]; return hit(!!p, p && `Season ${p.season}: Division ${p.from} to Division ${p.to}`); } },
  { id: 'league-title', name: 'Division Crown', c: 'Federation Career', r: 'rare', charge: 'crown', field: 'purpure', d: 'Win your division.', rule: 'Finish first in your regional division league.',
    ev: f => { const t = f.fed?.titles.find(x => LEAGUE.test(x.title)); return hit(!!t, t?.title); } },
  { id: 'crown-division', name: 'Crown Bearer', c: 'Federation Career', r: 'epic', charge: 'crown', field: 'sanguine', d: 'Reach the top division.', rule: 'Play in Division 1, the Crown Division.',
    ev: f => hit(!!f.fed?.divisions.includes(1), 'Reached the Crown Division') },
  { id: 'champion', name: 'Crown Champion', c: 'Federation Career', r: 'legendary', charge: 'crown', field: 'or', d: 'Win the Crown Championship.', rule: 'Win (or share) the Crown Championship.',
    ev: f => { const t = f.fed?.titles.find(x => CHAMP.test(x.title)); return hit(!!t, t?.title); } },
  { id: 'title-defence', name: 'Crown Defended', c: 'Federation Career', r: 'mythic', charge: 'crown', field: 'sable', d: 'Defend the Crown.', rule: 'Win the Crown Championship in two consecutive seasons.',
    ev: f => { const s = seasonsOf(f.fed?.titles ?? [], CHAMP); const k = s.find(x => s.includes(x + 1)); return hit(k !== undefined, `Champion in seasons ${k} and ${(k ?? 0) + 1}`); } },
  { id: 'relegation-recovery', name: 'Rise Again', c: 'Federation Career', r: 'rare', charge: 'flame', field: 'tenne', d: 'Bounce straight back.', rule: 'Be promoted at the end of the season right after a relegation.',
    ev: f => { const fd = f.fed; const r = fd?.relegations.find(x => fd.promotions.some(p => p.season === x.season + 1)); return hit(!!r, r && `Relegated after season ${r.season}, promoted after season ${r.season + 1}`); } },
  { id: 'norm', name: 'First Norm', c: 'Federation Career', r: 'rare', charge: 'star', field: 'steel', d: 'Score a title norm.', rule: 'Score a Federation title norm in a league season, Swiss event or the Crown Championship.',
    ev: f => { const n = f.fed?.norms[0]; return hit(!!n, n && `${n.event}, season ${n.season}: performance ${n.tpr}`); } },
  ...(['Knight', 'Paladin', 'Sovereign'] as FedTitle[]).map((t, i): Spec => ({
    id: `fed-${t.toLowerCase()}`, name: ['Knighted', 'Paladin', 'Sovereign'][i], c: 'Federation Career', r: (['epic', 'legendary', 'mythic'] as Rarity[])[i], charge: (['knight', 'sword', 'crown'] as ChargeId[])[i], field: (['sanguine', 'purpure', 'sable'] as Tincture[])[i],
    d: `Earn the Federation Title ${t}.`, rule: `Hold the Federation Title ${t} or higher (earned through norms; permanent).`, mono: t.slice(0, 2).toUpperCase(),
    ev: f => hit(!!f.fed?.fedTitle && FED_TITLES.indexOf(f.fed.fedTitle) >= FED_TITLES.indexOf(t), `Federation Title ${f.fed?.fedTitle}`) })),

  // ---------------------------------------------------------------- D. Rivals (and Quick Match)
  { id: 'rival-first', name: 'Old Score', c: 'Rivals', r: 'common', charge: 'sword', field: 'tenne', d: 'Beat a featured rival.', rule: 'Win a game against one of your featured rivals.',
    ev: f => firstWin(f, g => !!f.fed?.featured.has(g.oppId)) },
  { id: 'rival-bo5', name: 'Best of Five', c: 'Rivals', r: 'rare', charge: 'scales', field: 'azure', d: 'Lead a rivalry.', rule: 'Lead a head-to-head record against one Federation competitor by 3 or more wins after at least 5 meetings.',
    ev: f => { for (const [id, gs] of byOpponent(f)) { const w = gs.filter(g => g.score === 1).length, l = gs.filter(g => g.score === 0).length; if (gs.length >= 5 && w - l >= 3) return { earned: true, evidence: `${w}–${gs.length - w - l}–${l} vs ${gs[0].oppName}`, ref: id }; } return { earned: false }; } },
  ...([[8, 'Wanderer', 'uncommon'], [16, 'Grand Tour', 'epic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `regions-${n}`, name, c: 'Rivals', r, charge: 'anchor', field: n > 8 ? 'purpure' : 'vert', d: `Beat opponents from ${n} regions.`, rule: `Win games against Federation competitors from ${n} different regions.`,
    ev: f => count(regionsBeaten(f.games).size, n, `${regionsBeaten(f.games).size} regions beaten`) })),
  { id: 'revenge', name: 'Redemption', c: 'Rivals', r: 'rare', charge: 'flame', field: 'gules', d: 'Break a losing streak against one opponent.', rule: 'Beat a Federation competitor right after losing your last 3 games against them.',
    ev: f => { for (const gs of byOpponent(f).values()) for (let i = 3; i < gs.length; i++) if (gs.slice(i - 3, i).every(g => g.score === 0) && gs[i].score === 1) return { earned: true, evidence: vs(gs[i], ' after 3 straight losses'), when: gs[i].at, ref: gs[i].id }; return { earned: false }; } },
  { id: 'nemesis', name: 'Nemesis', c: 'Rivals', r: 'epic', charge: 'griffin', field: 'sable', d: 'Become a rival’s nemesis.', rule: 'Beat the same Federation competitor 10 times (once per day counts).',
    ev: f => { let best = 0, name = ''; const m = new Map<string, number>(); for (const g of f.countedWins) if (f.fed?.regionOf.has(g.oppId)) { const k = (m.get(g.oppId) ?? 0) + 1; m.set(g.oppId, k); if (k > best) { best = k; name = g.oppName; } } return count(best, 10, `10 wins vs ${name}`); } },
  { id: 'upset-feud', name: 'Underdog’s Feud', c: 'Rivals', r: 'epic', charge: 'tower', field: 'purpure', d: 'Topple a stronger rival twice.', rule: 'Beat the same featured rival twice when they were rated at least 200 above you.',
    ev: f => { const m = new Map<string, OwnGame[]>(); for (const g of f.games) if (g.score === 1 && f.fed?.featured.has(g.oppId) && (gap(g) ?? -1) >= 200) m.set(g.oppId, [...(m.get(g.oppId) ?? []), g]); const x = [...m.values()].find(gs => gs.length >= 2); return hit(!!x, x && `${x[1].oppName}: ${day(x[0].at)} and ${day(x[1].at)}`, x?.[1].at); } },
  { id: 'qm-first', name: 'Open Challenge', c: 'Rivals', r: 'common', charge: 'knight', field: 'azure', d: 'Win a Quick Match.', rule: 'Win a Random Federation Quick Match (rated or casual).', ev: f => firstWin(f, g => g.quickMatch) },
  { id: 'qm-giant', name: 'Fortune Favours', c: 'Rivals', r: 'rare', charge: 'griffin', field: 'tenne', d: 'Win a Quick Match against a much stronger opponent.', rule: 'Win a rated Quick Match against an opponent rated at least 200 above you.', ev: winsWithGap(200, true) },
  { id: 'qm-titan', name: 'Lightning Strikes', c: 'Rivals', r: 'epic', charge: 'flame', field: 'sanguine', d: 'Win a Quick Match against a titan.', rule: 'Win a rated Quick Match against an opponent rated at least 500 above you.', ev: winsWithGap(500, true) },
  { id: 'qm-regions-8', name: 'Federation Tour', c: 'Rivals', r: 'uncommon', charge: 'anchor', field: 'celeste', d: 'Win Quick Matches across the Federation.', rule: 'Win Quick Matches against competitors from 8 different regions.',
    ev: f => { const n = regionsBeaten(f.games.filter(g => g.quickMatch)).size; return count(n, 8, `${n} regions beaten in Quick Matches`); } },

  // ---------------------------------------------------------------- E. Tournaments
  { id: 'event-first', name: 'First Entry', c: 'Tournaments', r: 'common', charge: 'gate', field: 'bronze', d: 'Enter a Swiss event.', rule: 'Enter the Federation Open or the Challenger Open (qualifying or registering both count).',
    ev: f => { const e = f.fed?.swissEntries[0]; return hit(!!e, e && `Season ${e.season}: ${e.event === 'open' ? 'Federation Open' : 'Challenger Open'}`); } },
  { id: 'swiss-podium', name: 'Swiss Laurel', c: 'Tournaments', r: 'rare', charge: 'laurel', field: 'azure', d: 'Finish on a Swiss podium.', rule: 'Finish in the top three of a completed Federation Open or Challenger Open.',
    ev: f => { const p = f.fed?.swissPlaces.find(x => x.place <= 3); return hit(!!p, p && `${p.name}, season ${p.season}: place ${p.place}`); } },
  { id: 'semi', name: 'Last Four', c: 'Tournaments', r: 'uncommon', charge: 'rook', field: 'steel', d: 'Reach a semifinal.', rule: 'Play in a semifinal of the Crown Championship or the Club Weekend.',
    ev: f => { const k = f.fed?.koAppearances.find(x => x.label === 'Semifinal' || x.label === 'Final'); return hit(!!k, k && `Season ${k.season}: ${k.event === 'champ' ? 'Crown Championship' : 'Club Weekend'}`); } },
  { id: 'final', name: 'Finalist', c: 'Tournaments', r: 'rare', charge: 'queen', field: 'purpure', d: 'Reach a final.', rule: 'Play in the final of the Crown Championship or the Club Weekend.',
    ev: f => { const k = f.fed?.koAppearances.find(x => x.label === 'Final'); return hit(!!k, k && `Season ${k.season}: ${k.event === 'champ' ? 'Crown Championship' : 'Club Weekend'} final`); } },
  { id: 'event-win', name: 'Champion of the Day', c: 'Tournaments', r: 'rare', charge: 'laurel', field: 'or', d: 'Win an event.', rule: 'Win a division league, a Swiss event, the Crown Championship or the Club Weekend.',
    ev: f => { const t = f.fed?.titles[0]; const c = f.fed?.clubWins[0]; return hit(!!t || c !== undefined, t?.title ?? `Club Weekend, season ${c}`); } },
  { id: 'club-weekend', name: 'Club Weekend Victor', c: 'Tournaments', r: 'rare', charge: 'chalice', field: 'tenne', d: 'Win the Club Weekend.', rule: 'Win the Club Weekend knockout.',
    ev: f => { const c = f.fed?.clubWins[0]; return hit(c !== undefined, `Club Weekend, season ${c}`); } },
  { id: 'forecast-upset', name: 'Saw It Coming', c: 'Tournaments', r: 'rare', charge: 'moon', field: 'celeste', d: 'Call an upset.', rule: 'A settled paper forecast whose most likely outcome was priced at 30% or less when you made it, and happened.',
    ev: f => { const s = f.fed?.scored.find(x => x.topWon && x.topPrice !== null && x.topPrice <= 0.3); return hit(!!s, s && `${s.title}: priced ${Math.round(s.topPrice! * 100)}%`, s?.at); } },

  // ---------------------------------------------------------------- F. Grand Exchange
  { id: 'trade-first', name: 'Opening Position', c: 'Grand Exchange', r: 'common', charge: 'coin', field: 'steel', d: 'Hold a position to settlement.', rule: 'Hold shares in a Grand Exchange market until it settles (sandbox markets do not count).',
    ev: f => { const s = f.fed?.settled[0]; return hit(!!s, s?.title, s?.at, s?.marketId); } },
  { id: 'win-forecast', name: 'Right Call', c: 'Grand Exchange', r: 'common', charge: 'coin', field: 'vert', d: 'Profit from a settled position.', rule: 'A settled Grand Exchange position that paid more than it cost.',
    ev: f => { const s = f.fed?.settled.find(x => x.pnl > 0); return hit(!!s, s && `${s.title}: ${fmtMoney(s.pnl)}`, s?.at, s?.marketId); } },
  { id: 'season-profit', name: 'Profitable Season', c: 'Grand Exchange', r: 'uncommon', charge: 'scales', field: 'vert', d: 'Trade profitably over a season.', rule: 'Positive realized P&L over one season with at least 10 settled positions.',
    ev: f => { const s = seasonPnl(f.fed?.settled ?? []).find(x => x.n >= 10 && x.pnl > 0); return hit(!!s, s && `Season ${s.season}: ${fmtMoney(s.pnl)} over ${s.n} positions`); } },
  { id: 'recover-trading', name: 'Back From the Red', c: 'Grand Exchange', r: 'rare', charge: 'flame', field: 'tenne', d: 'Recover from a losing season.', rule: 'A losing season (5+ settled positions) followed by a profitable next season (5+ settled positions).',
    ev: f => { const ss = seasonPnl(f.fed?.settled ?? []); const x = ss.find(a => a.n >= 5 && a.pnl < 0 && ss.some(b => b.season === a.season + 1 && b.n >= 5 && b.pnl > 0)); return hit(!!x, x && `Season ${x.season} lost, season ${x.season + 1} profitable`); } },
  { id: 'market-variety', name: 'Many Markets', c: 'Grand Exchange', r: 'uncommon', charge: 'key', field: 'azure', d: 'Profit across market types.', rule: 'Profitable settled positions in 5 different market families.',
    ev: f => { const n = exchangeStats(f.fed).families; return count(n, 5, `${n} market families`); } },
  { id: 'forecaster', name: 'Clear Sight', c: 'Grand Exchange', r: 'epic', charge: 'sun', field: 'celeste', d: 'Forecast better than the model.', rule: 'At least 10 resolved paper forecasts with a mean Brier score below the public model.',
    ev: f => { const s = f.fed?.legacyForecast; return { ...count(s?.n ?? 0, 10), earned: !!s && s.n >= 10 && s.brier !== null && s.modelBrier !== null && s.brier < s.modelBrier, evidence: s?.n ? `${s.n} scored forecasts, Brier ${s.brier?.toFixed(3)} vs model ${s.modelBrier?.toFixed(3)}` : undefined }; } },
  { id: 'calibrated-100', name: 'True Sight', c: 'Grand Exchange', r: 'legendary', charge: 'sun', field: 'or', d: 'Beat the market over a long sample.', rule: 'At least 100 resolved paper forecasts with a mean Brier score below both the public model and the market price.',
    ev: f => { const sc = f.fed?.scored ?? []; const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); const b = mean(sc.map(s => s.brier)); const pm = sc.filter(s => s.model !== null), pp = sc.filter(s => s.price !== null);
      return { ...count(sc.length, 100), earned: sc.length >= 100 && pm.length === sc.length && b < mean(pm.map(s => s.model!)) && (pp.length === 0 || mean(pp.map(s => s.brier)) < mean(pp.map(s => s.price!))), evidence: `${sc.length} forecasts, Brier ${b.toFixed(3)}` }; } },
  { id: 'specialist', name: 'Specialist', c: 'Grand Exchange', r: 'epic', charge: 'quill', field: 'purpure', d: 'Master one kind of market.', rule: 'Within one market family, at least 30 resolved paper forecasts with a mean Brier score below the market.',
    ev: f => { const fam = new Map<string, { n: number; b: number; r: number }>(); for (const s of f.fed?.scored ?? []) if (s.ref !== null) { const x = fam.get(s.family) ?? { n: 0, b: 0, r: 0 }; x.n++; x.b += s.brier; x.r += s.ref; fam.set(s.family, x); }
      const best = [...fam.entries()].sort((a, b) => b[1].n - a[1].n)[0]; const ok = [...fam.entries()].find(([, x]) => x.n >= 30 && x.b < x.r);
      return { ...count(best?.[1].n ?? 0, 30), earned: !!ok, evidence: ok ? `${ok[1].n} forecasts in ${ok[0]} markets` : undefined }; } },
];

function byOpponent(f: Facts): Map<string, OwnGame[]> {
  const m = new Map<string, OwnGame[]>();
  for (const g of f.games) if (f.fed?.regionOf.has(g.oppId)) m.set(g.oppId, [...(m.get(g.oppId) ?? []), g]);
  return m;
}

// ---------------------------------------------------------------- Exchange title ladder (crown-exchange-titles-1)
/**
 * Exact, testable rules. Skill = market Brier − your Brier, averaged over resolved paper forecasts that recorded the
 * market price (or, for older saves, the public model) — positive means better than the market. Realized P&L counts
 * official settled positions only and must stay above the bar after removing your single best market, so one lucky
 * position never qualifies. Volume alone (trades, shares, turnover) never counts.
 */
export interface ExchangeTitleRule { id: string; name: string; rarity: Rarity; n: number; skill: number; markets: number; pnlExBest: number | null; families: number; seasons: number }
export const EXCHANGE_TITLES: ExchangeTitleRule[] = [
  { id: 'xt-apprentice-forecaster', name: 'Apprentice Forecaster', rarity: 'common', n: 10, skill: -0.05, markets: 0, pnlExBest: null, families: 0, seasons: 0 },
  { id: 'xt-odds-scholar', name: 'Odds Scholar', rarity: 'uncommon', n: 20, skill: 0, markets: 0, pnlExBest: null, families: 0, seasons: 0 },
  { id: 'xt-market-diviner', name: 'Market Diviner', rarity: 'rare', n: 30, skill: 0.01, markets: 0, pnlExBest: null, families: 0, seasons: 0 },
  { id: 'xt-odds-alchemist', name: 'Odds Alchemist', rarity: 'rare', n: 30, skill: 0.01, markets: 10, pnlExBest: 1, families: 0, seasons: 0 },
  { id: 'xt-hedge-wizard', name: 'Hedge Wizard', rarity: 'epic', n: 50, skill: 0.02, markets: 20, pnlExBest: 1, families: 3, seasons: 0 },
  { id: 'xt-grand-speculator', name: 'Grand Speculator', rarity: 'epic', n: 75, skill: 0.02, markets: 30, pnlExBest: 250 * MICRO, families: 3, seasons: 0 },
  { id: 'xt-oracle', name: 'Oracle of the Exchange', rarity: 'legendary', n: 100, skill: 0.03, markets: 40, pnlExBest: 500 * MICRO, families: 3, seasons: 3 },
  { id: 'xt-crown-marketmaker', name: 'Crown Marketmaker', rarity: 'legendary', n: 150, skill: 0.03, markets: 60, pnlExBest: 1_500 * MICRO, families: 5, seasons: 3 },
  { id: 'xt-sovereign-probability', name: 'Sovereign of Probability', rarity: 'mythic', n: 250, skill: 0.05, markets: 100, pnlExBest: 5_000 * MICRO, families: 5, seasons: 5 },
];
export function exchangeTitleRuleText(t: ExchangeTitleRule): string {
  const parts = [`At least ${t.n} resolved paper forecasts on different markets with a mean Brier score ${t.skill < 0 ? `no more than ${Math.abs(t.skill).toFixed(2)} worse than` : t.skill === 0 ? 'equal to or better than' : `at least ${t.skill.toFixed(2)} better than`} the market price`];
  if (t.pnlExBest !== null) parts.push(`realized P&L across at least ${t.markets} settled markets of ${t.pnlExBest <= 1 ? 'more than $0' : `${fmtMoney(t.pnlExBest, 0)} or more`}, even after removing your single best market`);
  if (t.families) parts.push(`profitable positions in ${t.families} market families`);
  if (t.seasons) parts.push(`${t.seasons} profitable seasons (5+ settled positions each)`);
  return parts.join('; ') + '.';
}
export function exchangeTitleEarned(t: ExchangeTitleRule, f: Facts): EvalResult {
  const s = exchangeStats(f.fed);
  const ok = s.n >= t.n && s.skill !== null && s.skill >= t.skill - 1e-12 &&
    (t.pnlExBest === null || (s.markets >= t.markets && s.pnlExBest >= t.pnlExBest)) && s.families >= t.families && s.profitableSeasons >= t.seasons;
  return { earned: ok, progress: { have: Math.min(s.n, t.n), need: t.n }, ...(ok ? { evidence: `${s.n} forecasts, skill ${s.skill!.toFixed(3)}${t.pnlExBest !== null ? `, P&L ${fmtMoney(s.pnl)} over ${s.markets} markets` : ''}` } : {}) };
}
/** Highest Exchange title currently met (titles once earned are kept by the store). */
export function exchangeTitleOf(f: Facts): ExchangeTitleRule | null {
  let best: ExchangeTitleRule | null = null;
  for (const t of EXCHANGE_TITLES) if (exchangeTitleEarned(t, f).earned) best = t;
  return best;
}

// ---------------------------------------------------------------- Patron's Treasury, Legacy
const WEALTH: [number, string, Rarity][] = [[5_000, 'Comfortable Purse', 'uncommon'], [25_000, 'Gilded Vault', 'epic'], [100_000, 'Treasury of Ages', 'legendary']];
const MORE: Spec[] = [
  { id: 'patron', name: 'Patron of the Game', c: "Patron's Treasury", r: 'uncommon', charge: 'chalice', field: 'or', d: 'Own a club.', rule: 'Own a chess club.', ev: f => hit(!!f.fed?.club.owned, `Club level ${f.fed?.club.level}`) },
  { id: 'club-level-3', name: 'Grand Hall', c: "Patron's Treasury", r: 'rare', charge: 'gate', field: 'purpure', d: 'Raise your club to its highest level.', rule: 'Upgrade your club to level 3.', ev: f => count(f.fed?.club.level ?? 0, 3, 'Club level 3') },
  ...WEALTH.map(([n, name, r]): Spec => ({ id: `networth-${n / 1000}k`, name, c: "Patron's Treasury", r, charge: n >= 100_000 ? 'crown' : 'coin', field: n >= 25_000 ? 'or' : 'bronze', d: `Reach a net worth of ${fmtMoney(n * MICRO, 0)}.`,
    rule: `Your net worth (cash, assets and open positions) reaches ${fmtMoney(n * MICRO, 0)} at any recorded point. Sandbox money never counts.`,
    ev: f => count(Math.floor((f.fed?.peakNetWorth ?? 0) / MICRO), n, `Peak net worth ${fmtMoney(f.fed?.peakNetWorth ?? 0, 0)}`) })),
  { id: 'near-ruin', name: 'Phoenix', c: "Patron's Treasury", r: 'rare', charge: 'flame', field: 'sanguine', d: 'Recover from the brink.', rule: 'Recover from a net worth below $100 to $1,000 or more.',
    ev: f => { const x = f.fed?.ruinRecovery; return hit(!!x, x && `Below $100 on ${day(x.lowAt)}, $1,000 by ${day(x.highAt)}`, x?.highAt); } },
  { id: 'academy-set', name: 'Scholar', c: 'Legacy', r: 'common', charge: 'book', field: 'azure', d: 'Finish an Academy session.', rule: 'Complete a Puzzle Rush or an Assessment in the Crown Academy.', ev: f => count(f.trainingSets, 1, 'Academy session completed') },
  ...([[100, 'Puzzle Adept', 'uncommon'], [500, 'Puzzle Sage', 'epic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `puzzles-${n}`, name, c: 'Legacy', r, charge: 'key', field: n > 100 ? 'purpure' : 'vert', d: `Solve ${n} puzzles cleanly.`, rule: `Solve ${n} different Academy puzzles on the first try without hints.`,
    ev: f => count(f.puzzlesClean, n, `${f.puzzlesClean} puzzles solved cleanly`) })),
  // The Sovereign's Grimoire (Academy lessons): chapter completions are stored once per chapter, and exercises count
  // once per exercise id, so re-reading or re-solving never adds anything.
  { id: 'first-lesson', name: 'First Lesson', c: 'Legacy', r: 'common', charge: 'book', field: 'celeste', d: 'Complete a Grimoire chapter.', rule: "Complete any chapter of The Sovereign's Grimoire in the Academy (solve its exercises, or read a chapter without exercises to the end).",
    ev: f => { const first = [...f.grimoire.completed].sort((a, b) => a[1].localeCompare(b[1]))[0]; return hit(!!first, first && `Completed ${chapterTitle(first[0])}`, first?.[1]); } },
  { id: 'apprentice-graduate', name: 'Apprentice Graduate', c: 'Legacy', r: 'uncommon', charge: 'quill', field: 'vert', d: 'Complete Book I of the Grimoire.', rule: 'Complete every chapter of Book I — The Apprentice.', ev: f => booksDone(f, [1], 'Book I complete') },
  { id: 'tactical-scholar', name: 'Tactical Scholar', c: 'Legacy', r: 'rare', charge: 'sword', field: 'gules', d: 'Complete Book II of the Grimoire.', rule: 'Complete every chapter of Book II — The Duelist.', ev: f => booksDone(f, [2], 'Book II complete') },
  { id: 'fork-specialist', name: 'Fork Specialist', c: 'Legacy', r: 'rare', charge: 'knight', field: 'tenne', d: 'Master the fork exercises.', rule: 'Solve every exercise of the Grimoire fork chapter (Book II, Chapter 1) on the first try, without a hint, at least once each.',
    ev: f => { const ids = chaptersTagged('fork').flatMap(c => c.exercises); const have = ids.filter(id => f.grimoire.firstTry.has(id)).length; return count(have, ids.length || Infinity, `All ${ids.length} fork exercises solved first try`); } },
  { id: 'endgame-apprentice', name: 'Endgame Apprentice', c: 'Legacy', r: 'rare', charge: 'pawn', field: 'steel', d: 'Complete the endgame chapters of Book IV.', rule: 'Complete the Book IV endgame chapters (king and pawn, rook, knight and queen endings, and draws and fortresses).',
    ev: f => chaptersDone(f, chaptersTagged('endgame').map(c => c.id), 'Book IV endgame chapters complete') },
  { id: 'calculation-adept', name: 'Calculation Adept', c: 'Legacy', r: 'epic', charge: 'hourglass', field: 'azure', d: 'Calculate cleanly through Book IV.', rule: 'Complete the Book IV candidate-move and forcing-line chapters with at least 80% of their exercises solved first try on your first attempt.',
    ev: f => { const chs = chaptersTagged('calculation'); const ids = chs.flatMap(c => c.exercises); const ft = ids.filter(id => f.grimoire.firstOutcome.get(id) === 'first-try').length;
      const done = chaptersDone(f, chs.map(c => c.id), `${ft} of ${ids.length} solved first try`); return ids.length && done.earned && ft / ids.length >= 0.8 ? done : { earned: false, progress: done.progress }; } },
  { id: 'academy-graduate', name: 'Academy Graduate', c: 'Legacy', r: 'epic', charge: 'laurel', field: 'or', d: 'Complete Books I–IV of the Grimoire.', rule: 'Complete every chapter of Books I, II, III and IV.', ev: f => booksDone(f, [1, 2, 3, 4], 'Books I–IV complete') },
  { id: 'sovereign-trial', name: "The Sovereign's Trial", c: 'Legacy', r: 'legendary', charge: 'crown', field: 'purpure', d: 'Complete Book V of the Grimoire.', rule: 'Complete every chapter of Book V — The Sovereign.', ev: f => booksDone(f, [5], 'Book V complete') },
  { id: 'full-season', name: 'Full Season', c: 'Legacy', r: 'uncommon', charge: 'hourglass', field: 'steel', d: 'Play a whole season.', rule: 'Play every one of your own fixtures in a completed season over the board (no forfeits).',
    ev: f => { const s = f.fed?.fullSeasons[0]; return hit(s !== undefined, `Season ${s}`); } },
  { id: 'ten-seasons', name: 'Decade', c: 'Legacy', r: 'legendary', charge: 'hourglass', field: 'or', d: 'Ten seasons in the Federation.', rule: 'Complete 10 Federation seasons.', ev: f => count(f.fed?.seasonsCompleted ?? 0, 10, '10 seasons completed') },
  { id: 'comeback-run', name: 'The Long Road', c: 'Legacy', r: 'epic', charge: 'moon', field: 'sable', secret: true, d: 'Turn your fortunes around.', rule: 'Win 5 rated games in a row straight after losing 5 rated games in a row.',
    ev: f => { const r = comebackRun(f.rated); return hit(!!r, r && `Fifth straight win vs ${r.oppName} on ${day(r.at)}`, r?.at); } },
  { id: 'night-owl', name: 'Midnight Duel', c: 'Legacy', r: 'uncommon', charge: 'moon', field: 'azure', secret: true, d: 'Win in the small hours.', rule: 'Win a rated game started between 00:00 and 04:00 local time.',
    ev: f => firstWin(f, g => g.rated && new Date(g.startedAt).getHours() < 4) },
  { id: 'perfect-promotion', name: 'Unbeaten Ascent', c: 'Legacy', r: 'legendary', charge: 'tower', field: 'or', secret: true, d: 'Climb without a single defeat.', rule: 'Be promoted after a league season with no league losses.',
    ev: f => { const s = f.fed?.unbeatenPromotions[0]; return hit(s !== undefined, `Season ${s}`); } },
  { id: 'all-collections', name: 'Archmage of the Federation', c: 'Legacy', r: 'mythic', charge: 'crown', field: 'purpure', secret: true, grading: true, d: 'Master every collection.', rule: 'Own at least one Epic or rarer collectible in every collection.',
    ev: f => { const have = new Set(DEFS_BASE().filter(d => f.owned.has(d.id) && RARITIES.indexOf(d.rarity) >= 3).map(d => d.collection)); return hit(COLLECTIONS.every(c => have.has(c)), 'Epic or rarer in every collection'); } },
];

// ---------------------------------------------------------------- crown-vault-2 expansion (v0.11)
/**
 * Every rule below reads rated games only (never casual, assisted, training, imported, sandbox or practice records)
 * unless it is explicitly about the Academy, analysis or the Exchange. Win counters use qualifiedWins (facts.ts): one
 * win per opponent per UTC day, at most DAILY_CAP counted wins a day, never a win against an opponent rated more than
 * WEAK_GAP below you. Distinct-opponent and distinct-day rules need no cap. See docs/ARCANE_FEDERATION.md §5.1.
 */
const QW = `Rated games only; one win per opponent per day, at most ${DAILY_CAP} counted a day, and wins against opponents rated more than ${WEAK_GAP} below you never count.`;
const RG = 'Rated games only.';
const qCount = (f: Facts, n: number, p: (g: OwnGame) => boolean, label: string): EvalResult => { const w = qualifiedWins(f.games, p); return count(w.length, n, w[n - 1] && `${label} ${n}: ${vs(w[n - 1])}`, w[n - 1]?.at); };
const qFirst = (f: Facts, p: (g: OwnGame) => boolean, label: (g: OwnGame) => string = g => vs(g)): EvalResult => { const g = qualifiedWins(f.games, p)[0]; return g ? { earned: true, evidence: label(g), when: g.at, ref: g.id } : { earned: false }; };
const ratedFirst = (f: Facts, p: (g: OwnGame) => boolean, label: (g: OwnGame) => string = g => vs(g)): EvalResult => { const g = ratedGames(f.games).find(p); return g ? { earned: true, evidence: label(g), when: g.at, ref: g.id } : { earned: false }; };
const atLeast = (g: OwnGame, min: number) => gap(g) !== null && gap(g)! >= min;
/** Distinct opponents (or regions) beaten in counted rated wins satisfying p; `when` is the game that reached n. */
const distinctBeaten = (f: Facts, n: number, p: (g: OwnGame) => boolean, key: (g: OwnGame) => string | number | null, label: string): EvalResult => {
  const seen = new Set<string | number>(); let reached: OwnGame | null = null;
  for (const g of qualifiedWins(f.games, p)) { const k = key(g); if (k === null || seen.has(k)) continue; seen.add(k); if (seen.size === n) reached = g; }
  return count(seen.size, n, reached ? `${label}: ${seen.size} (number ${n}: ${vs(reached)})` : undefined, reached?.at);
};
const isWeak = (g: OwnGame) => g.myRating !== null && g.oppRating !== null && g.oppRating < g.myRating - WEAK_GAP;
/** Head-to-head against Federation competitors: rated games, first game per opponent per day, weak wins ignored. */
function h2h(f: Facts): Map<string, { name: string; w: number; d: number; l: number; days: Set<string> }> {
  const m = new Map<string, { name: string; w: number; d: number; l: number; days: Set<string> }>();
  for (const g of ratedGames(f.games)) {
    if (!f.fed?.regionOf.has(g.oppId)) continue;
    const x = m.get(g.oppId) ?? { name: g.oppName, w: 0, d: 0, l: 0, days: new Set<string>() };
    m.set(g.oppId, x);
    if (x.days.has(g.day) || (g.score === 1 && isWeak(g))) continue;
    x.days.add(g.day);
    if (g.score === 1) x.w++; else if (g.score === 0.5) x.d++; else x.l++;
  }
  return m;
}
const titleCount = (f: Facts) => (f.fed?.titles.length ?? 0) + (f.fed?.clubWins.length ?? 0);
const SWISS_WIN = / winner S\d+$/;
const RATING_TIERS_V2: [number, Rarity][] = [[3500, 'mythic'], [4000, 'mythic']];
const nwSeries = (f: Facts) => f.fed?.netWorthSeries ?? [];

const V2: Spec[] = [
  // Chess Mastery
  ...([[10, 'Mating Net', 'uncommon'], [50, "Executioner's Art", 'epic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `mates-${n}`, name, c: 'Chess Mastery', r, fam: 'mastery', charge: 'king', field: n > 10 ? 'sable' : 'purpure', d: `Checkmate ${n} opponents in rated games.`,
    rule: `Win ${n} rated games by checkmate. ${QW}`, ev: f => qCount(f, n, g => g.termination === 'checkmate', 'Mate') })),
  { id: 'miniature', name: 'Miniature', c: 'Chess Mastery', r: 'rare', fam: 'mastery', charge: 'star', field: 'celeste', d: 'Checkmate a worthy opponent quickly.',
    rule: 'Win a rated game by checkmate within 30 plies (15 moves each) against an opponent rated no more than 100 below you (both ratings recorded).',
    ev: f => ratedFirst(f, g => g.score === 1 && g.termination === 'checkmate' && g.plies <= 30 && atLeast(g, -100), g => vs(g, ` by checkmate in ${g.plies} plies`)) },

  // Played Like performance (crown-played-like-2, validated on held-out games; docs/PLAYED_LIKE.md). The two
  // crown-vault-1 Played Like entries keep their definitions (they still wait for validated move grading).
  ...([[1200, 'Measured Strength', 'uncommon'], [1800, 'Played Like a Master', 'rare'], [2400, 'Played Like a Legend', 'epic'], [3000, 'Played Like a Sovereign', 'mythic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `pl-${n}`, name, c: 'Brilliant Mind', r, fam: 'mastery', pl: true, charge: 'moon', field: n >= 3000 ? 'sable' : n >= 2400 ? 'purpure' : n >= 1800 ? 'azure' : 'celeste',
    d: `Play a rated game at a Played Like ${n.toLocaleString('en')}.`,
    rule: `A counted Played Like estimate (model ${PLAYED_LIKE_ID}, at least 15 informative moves, inside the calibrated range) of ${n.toLocaleString('en')} or more in an unassisted rated game against an opponent rated at least ${(n - 800).toLocaleString('en')} (recorded).`,
    ev: f => ratedFirst(f, g => !!g.pl && g.pl.rating >= n && g.oppRating !== null && g.oppRating >= n - 800, g => vs(g, `: Played Like ${Math.round(g.pl!.rating)} (${Math.round(g.pl!.low)}–${Math.round(g.pl!.high)}, ${g.pl!.moves} moves)`)) })),

  // Tactical brilliance (without move grading: the Brilliant-move collectibles stay "Awaiting validated grading")
  { id: 'sacrificial-mate', name: 'Sacrificial Mate', c: 'Brilliant Mind', r: 'epic', fam: 'tactics', charge: 'flame', field: 'gules', d: 'Mate with less material.',
    rule: 'Win a rated game by checkmate while at least 2 points down in material in the final position, against an opponent rated no more than 200 below you (both ratings recorded).',
    ev: f => ratedFirst(f, g => g.score === 1 && g.termination === 'checkmate' && g.finalDiff <= -2 && atLeast(g, -200), g => vs(g, ` by checkmate, ${-g.finalDiff} points down`)) },
  { id: 'puzzles-25', name: 'Puzzle Apprentice', c: 'Legacy', r: 'common', fam: 'tactics', charge: 'key', field: 'celeste', d: 'Solve 25 puzzles cleanly.', rule: 'Solve 25 different Academy puzzles on the first try without hints.',
    ev: f => count(f.puzzlesClean, 25, `${f.puzzlesClean} puzzles solved cleanly`) },

  // Defensive resilience
  { id: 'fortress', name: 'Fortress', c: 'Chess Mastery', r: 'uncommon', fam: 'defence', charge: 'tower', field: 'steel', d: 'Draw a game you were losing.',
    rule: `Draw a rated game after being at least 3 points down in material for at least 4 consecutive plies. ${RG}`, ev: f => ratedFirst(f, g => g.score === 0.5 && g.sustainedWorst <= -3, g => vs(g, ` after ${-g.sustainedWorst} points down`)) },
  { id: 'hold-the-line', name: 'Hold the Line', c: 'Chess Mastery', r: 'rare', fam: 'defence', charge: 'gate', field: 'azure', d: 'Hold a far stronger opponent.',
    rule: 'Draw a rated game against an opponent rated at least 300 above you (both ratings recorded).', ev: f => ratedFirst(f, g => g.score === 0.5 && atLeast(g, 300), g => vs(g, ` (${Math.round(g.oppRating!)} vs your ${Math.round(g.myRating!)})`)) },
  { id: 'against-odds', name: 'Against the Odds', c: 'Chess Mastery', r: 'epic', fam: 'defence', charge: 'hourglass', field: 'sanguine', d: 'Win from a lost position.',
    rule: `Win a rated game after being at least 6 points down in material for at least 4 consecutive plies. ${QW}`, ev: f => qFirst(f, g => g.sustainedWorst <= -6, g => vs(g, ` after ${-g.sustainedWorst} points down`)) },
  { id: 'miracle', name: 'Miracle Escape', c: 'Chess Mastery', r: 'mythic', fam: 'defence', charge: 'sun', field: 'sable', d: 'Win a queen down against an equal or stronger opponent.',
    rule: 'Win a rated game after being at least 9 points down in material for at least 4 consecutive plies, against an opponent rated at or above you (both ratings recorded).',
    ev: f => ratedFirst(f, g => g.score === 1 && g.sustainedWorst <= -9 && atLeast(g, 0), g => vs(g, ` after ${-g.sustainedWorst} points down`)) },

  // Endgame technique
  ...([[5, 'Endgame Technician', 'uncommon'], [25, 'Endgame Master', 'rare'], [100, 'Endgame Sovereign', 'legendary']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `endgame-${n}`, name, c: 'Chess Mastery', r, fam: 'endgames', charge: 'pawn', field: n >= 100 ? 'or' : n >= 25 ? 'azure' : 'steel', d: `Convert ${n} endgames.`,
    rule: `Win ${n} rated games that reached an endgame (at most 2 queens, rooks or knights left on the whole board). ${QW}`, ev: f => qCount(f, n, g => g.endgame, 'Endgame win') })),
  { id: 'crowned-pawn', name: 'Crowned Pawn', c: 'Chess Mastery', r: 'uncommon', fam: 'endgames', charge: 'crown', field: 'vert', d: 'Promote a pawn and win.', rule: `Win a rated game in which you promoted a pawn. ${QW}`,
    ev: f => qFirst(f, g => g.promotions > 0, g => vs(g, `, ${g.promotions} promotion${g.promotions > 1 ? 's' : ''}`)) },
  { id: 'endgame-giant', name: 'Endgame Giant', c: 'Chess Mastery', r: 'epic', fam: 'endgames', charge: 'rook', field: 'purpure', d: 'Outplay a stronger player in the ending.',
    rule: 'Win a rated game that reached an endgame against an opponent rated at least 200 above you (both ratings recorded).', ev: f => ratedFirst(f, g => g.score === 1 && g.endgame && atLeast(g, 200)) },

  // Upsets
  ...([[5, 'Upstart', 'uncommon'], [25, "Kingmaker's Bane", 'epic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `upsets-${n}`, name, c: 'Chess Mastery', r, fam: 'upsets', charge: 'griffin', field: n > 5 ? 'sanguine' : 'tenne', d: `Beat ${n} different stronger opponents.`,
    rule: `Win rated games against ${n} different opponents, each rated at least 100 above you at the time (both ratings recorded).`, ev: f => distinctBeaten(f, n, g => atLeast(g, 100), g => g.oppId, 'Stronger opponents beaten') })),
  { id: 'colossus', name: 'Colossus Slayer', c: 'Chess Mastery', r: 'mythic', fam: 'upsets', charge: 'griffin', field: 'sable', d: 'Beat an opponent rated 800+ above you.',
    rule: 'Win a rated game against an opponent whose recorded rating is at least 800 above yours.', ev: f => ratedFirst(f, g => g.score === 1 && atLeast(g, 800), g => vs(g, ` (${Math.round(g.oppRating!)} vs your ${Math.round(g.myRating!)})`)) },

  // Win streaks
  ...([[5, 'Hot Hand', 'uncommon'], [10, 'Unstoppable', 'epic'], [20, 'Inexorable', 'legendary'], [40, 'Sovereign Run', 'mythic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `winstreak-${n}`, name, c: 'Chess Mastery', r, fam: 'streaks', charge: 'flame', field: n >= 20 ? 'sable' : n >= 10 ? 'sanguine' : 'tenne', d: `Win ${n} rated games in a row.`,
    rule: `Win ${n} rated games in a row. A draw or loss ends the run; a win against an opponent rated more than ${WEAK_GAP} below you, or a second win against the same opponent on the same day, neither extends nor breaks it.`,
    ev: f => { const s = winStreak(f.rated, n); return count(s.best, n, s.reached ? `Run completed vs ${s.reached.oppName} on ${day(s.reached.at)}` : undefined, s.reached?.at); } })),

  // Rating milestones (0–4,000+)
  ...RATING_TIERS_V2.map(([n, r]): Spec => ({ id: `rating-${n}`, name: `Rating ${n.toLocaleString('en')}`, c: 'Federation Career', r, fam: 'ratings', charge: 'crown', field: n >= 4000 ? 'or' : 'sable',
    d: `Reach an established rating of ${n.toLocaleString('en')}.`, rule: `Your established Rapid rating reaches ${n.toLocaleString('en')} or more.`,
    ev: f => hit((f.insignia.peakRating ?? -Infinity) >= n, `Peak established rating ${Math.round(f.insignia.peakRating ?? 0)}`) })),
  ...([[200, 'Rising Star', 'uncommon'], [500, 'Ascendant', 'rare'], [1000, 'Meteoric Rise', 'legendary']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `climb-${n}`, name, c: 'Federation Career', r, fam: 'ratings', charge: 'tower', field: n >= 1000 ? 'or' : n >= 500 ? 'azure' : 'vert', d: `Climb ${n.toLocaleString('en')} points.`,
    rule: `Your established Rapid rating peaks at least ${n.toLocaleString('en')} above the rating at which it first became established (20+ rated games and RD 100 or less).`,
    ev: f => { const a = f.insignia.firstEstablished ?? null, p = f.insignia.peakRating; const have = a !== null && p !== null ? Math.max(0, Math.round(p - a)) : 0; return count(have, n, a !== null ? `Established at ${Math.round(a)}, peak ${Math.round(p!)}` : undefined); } })),

  // Federation career
  { id: 'division-masters', name: "Masters' Gate", c: 'Federation Career', r: 'rare', fam: 'federation', charge: 'gate', field: 'purpure', d: 'Reach the Masters Division.', rule: 'Play in Division 4 (Masters) or higher.',
    ev: f => hit(!!f.fed?.divisions.some(d => d <= 4), 'Reached the Masters Division') },
  { id: 'promotions-3', name: 'Climber', c: 'Federation Career', r: 'rare', fam: 'federation', charge: 'tower', field: 'vert', d: 'Win promotion three times.', rule: 'Be promoted at the end of three different seasons.',
    ev: f => { const p = f.fed?.promotions ?? []; return count(p.length, 3, p[2] && `Third promotion after season ${p[2].season}`); } },

  // Tournament victories (career counts; each individual trophy lives in the Trophy Hall, not here)
  ...([[3, 'Laurel Collector', 'rare'], [10, 'Hall of Titles', 'epic'], [25, 'Dynasty', 'mythic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `titles-${n}`, name, c: 'Tournaments', r, fam: 'tournaments', charge: 'laurel', field: n >= 25 ? 'or' : n >= 10 ? 'purpure' : 'azure', d: `Win ${n} Federation titles.`,
    rule: `Win ${n} Federation titles in total (division leagues, Swiss events, the Crown Championship and the Club Weekend).`, ev: f => count(titleCount(f), n, `${titleCount(f)} titles`) })),
  { id: 'season-double', name: 'Double Crown', c: 'Tournaments', r: 'epic', fam: 'tournaments', charge: 'crown', field: 'purpure', d: 'Win two titles in one season.', rule: 'Win two or more Federation titles in the same season.',
    ev: f => { const m = new Map<number, number>(); for (const t of f.fed?.titles ?? []) m.set(t.season, (m.get(t.season) ?? 0) + 1); for (const s of f.fed?.clubWins ?? []) m.set(s, (m.get(s) ?? 0) + 1); const s = [...m].find(([, n]) => n >= 2); return hit(!!s, s && `Season ${s[0]}: ${s[1]} titles`); } },
  { id: 'triple-crown', name: 'Triple Crown', c: 'Tournaments', r: 'legendary', fam: 'tournaments', charge: 'crown', field: 'or', d: 'Win a league, a Swiss and a knockout.',
    rule: 'Over your career, win a division league, a Swiss event (Federation Open or Challenger Open) and a knockout (the Crown Championship or the Club Weekend).',
    ev: f => { const t = f.fed?.titles ?? []; const a = t.some(x => LEAGUE.test(x.title)), b = t.some(x => SWISS_WIN.test(x.title)), c = t.some(x => CHAMP.test(x.title)) || (f.fed?.clubWins.length ?? 0) > 0;
      return { ...count(+a + +b + +c, 3), ...(a && b && c ? { evidence: 'League, Swiss and knockout titles' } : {}) }; } },

  // Rivalries
  ...([[3, 'Circle of Rivals', 'uncommon'], [10, 'Feared Across the Federation', 'epic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `rivals-ahead-${n}`, name, c: 'Rivals', r, fam: 'rivalries', charge: 'scales', field: n > 3 ? 'sanguine' : 'tenne', d: `Lead ${n} head-to-head records.`,
    rule: `Hold a winning head-to-head record (more wins than losses, at least 3 meetings) against ${n} different Federation competitors. Rated games only; the first game per opponent per day counts, and wins against opponents rated more than ${WEAK_GAP} below you are ignored.`,
    ev: f => { const k = [...h2h(f).values()].filter(x => x.w + x.d + x.l >= 3 && x.w > x.l).length; return count(k, n, `${k} winning records`); } })),
  { id: 'long-rivalry', name: 'Old Acquaintance', c: 'Rivals', r: 'rare', fam: 'rivalries', charge: 'sword', field: 'steel', d: 'Meet one rival again and again.',
    rule: 'Play rated games against the same Federation competitor on 15 different days.',
    ev: f => { const best = [...h2h(f).values()].sort((a, b) => b.days.size - a.days.size)[0]; return count(best?.days.size ?? 0, 15, best && `${best.days.size} days vs ${best.name}`); } },
  { id: 'featured-sweep', name: 'Every Score Settled', c: 'Rivals', r: 'legendary', fam: 'rivalries', charge: 'griffin', field: 'or', d: 'Beat every featured rival.',
    rule: `Beat each of your featured rivals (at least 3) in a rated game. Wins against opponents rated more than ${WEAK_GAP} below you do not count.`,
    ev: f => { const feat = [...(f.fed?.featured ?? [])]; const m = h2h(f); const k = feat.filter(id => (m.get(id)?.w ?? 0) > 0).length; const ok = feat.length >= 3 && k === feat.length;
      return { ...count(k, Math.max(3, feat.length)), earned: ok, ...(ok ? { evidence: `All ${k} featured rivals beaten` } : {}) }; } },

  // Regional conquest
  { id: 'home-region', name: 'Home Turf', c: 'Rivals', r: 'common', fam: 'regions', charge: 'tower', field: 'vert', d: 'Beat five neighbours.', rule: `Win rated games against 5 different Federation competitors from your own region. ${QW}`,
    ev: f => distinctBeaten(f, 5, g => g.oppRegion !== null && g.oppRegion === f.fed?.playerRegion, g => g.oppId, 'Home-region competitors beaten') },
  ...([[32, 'Continental', 'legendary'], [80, 'Conqueror of the Eighty', 'mythic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `regions-${n}`, name, c: 'Rivals', r, fam: 'regions', charge: 'anchor', field: n >= 80 ? 'or' : 'sanguine', d: `Win in ${n} regions.`,
    rule: `Win rated games against Federation competitors from ${n} different regions (needs a federation of at least ${n} regions). ${QW}`,
    ev: f => distinctBeaten(f, n, g => g.oppRegion !== null, g => g.oppRegion, 'Regions conquered') })),

  // Grimoire mastery
  { id: 'strategist-graduate', name: 'The Strategist', c: 'Legacy', r: 'rare', fam: 'grimoire', charge: 'scales', field: 'azure', d: 'Complete Book III of the Grimoire.', rule: 'Complete every chapter of Book III — The Strategist.', ev: f => booksDone(f, [3], 'Book III complete') },
  { id: 'oracle-reader', name: "The Oracle's Reading", c: 'Legacy', r: 'epic', fam: 'grimoire', charge: 'moon', field: 'purpure', d: 'Complete Book VI of the Grimoire.', rule: 'Complete every chapter of Book VI — The Oracle (read each to the end).', ev: f => booksDone(f, [6], 'Book VI complete') },
  { id: 'grimoire-complete', name: 'Keeper of the Grimoire', c: 'Legacy', r: 'mythic', fam: 'grimoire', charge: 'book', field: 'or', d: 'Complete the whole Grimoire.', rule: 'Complete every chapter of Books I to VI.', ev: f => booksDone(f, [1, 2, 3, 4, 5, 6], 'Books I–VI complete') },
  ...([[25, 'Sharp Eye', 'uncommon'], [100, 'Flawless Scholar', 'legendary']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `first-try-${n}`, name, c: 'Legacy', r, fam: 'grimoire', charge: 'quill', field: n >= 100 ? 'or' : 'celeste', d: `Solve ${n} Grimoire exercises at first sight.`,
    rule: `Solve ${n} different Grimoire exercises first try on your very first attempt at each (later re-solves never count).`,
    ev: f => { const k = [...f.grimoire.firstOutcome.values()].filter(o => o === 'first-try').length; return count(k, n, `${k} exercises solved at first sight`); } })),

  // Forecasting calibration
  ...([[30, 0.10, -0.02, 'Steady Calibration', 'uncommon'], [100, 0.06, 0, 'True Calibration', 'rare'], [250, 0.04, 1e-9, 'Perfect Calibration', 'legendary']] as [number, number, number, string, Rarity][]).map(([n, ece, skill, name, r]): Spec => ({
    id: `calibration-${n}`, name, c: 'Grand Exchange', r, fam: 'forecasting', charge: 'scales', field: n >= 250 ? 'or' : n >= 100 ? 'azure' : 'celeste', d: `Forecast with calibrated confidence over ${n} markets.`,
    rule: `At least ${n} resolved paper forecasts on different markets (latest forecast per market) with an expected calibration error of ${ece.toFixed(2)} or less over 10 bins, and a mean Brier score ${skill < 0 ? `no more than ${(-skill).toFixed(2)} worse than` : skill > 0 ? 'better than' : 'equal to or better than'} the market price. Sandbox markets never count.`,
    ev: f => { const s = calibrationStats(f.fed?.scored ?? []); const ok = s.n >= n && s.ece !== null && s.ece <= ece + 1e-12 && s.skill !== null && s.skill >= skill - 1e-12;
      return { ...count(s.n, n), earned: ok, ...(ok ? { evidence: `${s.n} forecasts, calibration error ${s.ece!.toFixed(3)}, skill ${s.skill!.toFixed(3)}` } : {}) }; } })),

  // Exchange profitability
  ...([[1_000, 10, 'Steady Profits', 'rare'], [10_000, 40, 'Merchant Prince', 'legendary']] as [number, number, string, Rarity][]).map(([usd, mk, name, r]): Spec => ({
    id: `pnl-${usd / 1000}k`, name, c: 'Grand Exchange', r, fam: 'exchange', charge: 'coin', field: usd >= 10_000 ? 'or' : 'vert', d: `Realize ${fmtMoney(usd * MICRO, 0)} in trading profit.`,
    rule: `Realized P&L of ${fmtMoney(usd * MICRO, 0)} or more across at least ${mk} settled Grand Exchange markets, even after removing your single best market. Sandbox and practice markets never count; shares sold before settlement never count.`,
    ev: f => { const s = exchangeStats(f.fed); const ok = s.markets >= mk && s.pnlExBest >= usd * MICRO; return { ...count(Math.max(0, Math.floor(s.pnlExBest / MICRO)), usd), earned: ok, ...(ok ? { evidence: `${fmtMoney(s.pnl)} over ${s.markets} markets (${fmtMoney(s.pnlExBest)} without the best)` } : {}) }; } })),
  ...([[3, 'Three Good Seasons', 'rare'], [10, 'Golden Decade', 'mythic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `profit-seasons-${n}`, name, c: 'Grand Exchange', r, fam: 'exchange', charge: 'scales', field: n >= 10 ? 'or' : 'vert', d: `Trade profitably in ${n} seasons.`,
    rule: `Positive realized P&L in ${n} different seasons, each with at least 5 settled positions.`, ev: f => { const k = exchangeStats(f.fed).profitableSeasons; return count(k, n, `${k} profitable seasons`); } })),

  // Financial recovery
  { id: 'weathered-storm', name: 'Weathered the Storm', c: "Patron's Treasury", r: 'uncommon', fam: 'recovery', charge: 'anchor', field: 'steel', d: 'Recover from a heavy drawdown.',
    rule: 'Net worth falls at least 30% below an earlier recorded peak of $2,000 or more, then later rises above that peak. Only the Federation finance record counts.',
    ev: f => { const x = drawdownRecovery(nwSeries(f), 2_000 * MICRO, 0.3); return hit(!!x, x && `Below 70% of ${fmtMoney(x.peak, 0)} on ${day(x.lowAt)}, new high on ${day(x.highAt)}`, x?.highAt); } },
  { id: 'second-fortune', name: 'Second Fortune', c: "Patron's Treasury", r: 'epic', fam: 'recovery', charge: 'coin', field: 'or', d: 'Lose most of a fortune and rebuild it.',
    rule: 'Net worth falls at least 60% below an earlier recorded peak of $10,000 or more, then later rises above that peak.',
    ev: f => { const x = drawdownRecovery(nwSeries(f), 10_000 * MICRO, 0.6); return hit(!!x, x && `Below 40% of ${fmtMoney(x.peak, 0)} on ${day(x.lowAt)}, new high on ${day(x.highAt)}`, x?.highAt); } },
  { id: 'from-ashes', name: 'From Ashes', c: "Patron's Treasury", r: 'legendary', fam: 'recovery', charge: 'flame', field: 'or', d: 'From nothing to a fortune.',
    rule: 'Recover from a recorded net worth below $100 to $10,000 or more.',
    ev: f => { const x = lowToHigh(nwSeries(f), 100 * MICRO, 10_000 * MICRO); return hit(!!x, x && `Below $100 on ${day(x.lowAt)}, $10,000 by ${day(x.highAt)}`, x?.highAt); } },

  // Career longevity
  ...([[7, 'Regular', 'common'], [30, 'Devoted', 'rare'], [100, 'Lifelong', 'epic'], [365, 'A Year at the Board', 'mythic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `days-${n}`, name, c: 'Legacy', r, fam: 'longevity', charge: 'hourglass', field: n >= 365 ? 'or' : n >= 100 ? 'purpure' : 'steel', d: `Play rated games on ${n} different days.`,
    rule: `Finish rated games on ${n} different calendar days (UTC).`, ev: f => { const d = new Set(ratedGames(f.games).map(g => g.day)); return count(d.size, n, `${d.size} days`); } })),
  ...([[3, 'Seasoned', 'common'], [25, 'Elder of the Federation', 'mythic']] as [number, string, Rarity][]).map(([n, name, r]): Spec => ({
    id: `seasons-${n}`, name, c: 'Legacy', r, fam: 'longevity', charge: 'hourglass', field: n >= 25 ? 'sable' : 'bronze', d: `Complete ${n} Federation seasons.`, rule: `Complete ${n} Federation seasons.`,
    ev: f => count(f.fed?.seasonsCompleted ?? 0, n, `${n} seasons completed`) })),

  // Replay analysis
  { id: 'analyses-300', name: 'Grand Archive', c: 'Brilliant Mind', r: 'epic', fam: 'analysis', charge: 'book', field: 'or', d: 'Review 300 real games.', rule: 'Complete a Match Analysis of 300 of your own finished games of at least 20 plies (re-analysing a game does not count twice).',
    ev: f => count(f.analyses.long ?? 0, 300, `${f.analyses.long ?? 0} games analysed`) },
  { id: 'lessons-defeat', name: 'Lessons in Defeat', c: 'Brilliant Mind', r: 'uncommon', fam: 'analysis', charge: 'quill', field: 'steel', d: 'Study your losses.', rule: 'Complete a Match Analysis of 10 different rated games you lost.',
    ev: f => count(f.analyses.ratedLosses ?? 0, 10, `${f.analyses.ratedLosses ?? 0} losses reviewed`) },
  { id: 'retry-25', name: 'Relentless', c: 'Brilliant Mind', r: 'rare', fam: 'analysis', charge: 'hourglass', field: 'azure', d: 'Turn 25 mistakes into wins.', rule: 'Win 25 different training retries started from your own mistakes (each source position counts once).',
    ev: f => count(f.retryWins, 25, `${f.retryWins} retries won`) },

  // Rare secrets
  { id: 'stalemate-swindle', name: 'Stalemate Swindle', c: 'Legacy', r: 'rare', fam: 'secrets', secret: true, charge: 'king', field: 'steel', d: 'Escape by stalemate.',
    rule: 'Draw a rated game by stalemate while at least 3 points down in material in the final position.', ev: f => ratedFirst(f, g => g.score === 0.5 && g.termination === 'stalemate' && g.finalDiff <= -3) },
  { id: 'humble-crown', name: 'Humble Crown', c: 'Legacy', r: 'rare', fam: 'secrets', secret: true, charge: 'knight', field: 'tenne', d: 'Promote to less than a queen, and win.',
    rule: `Win a rated game in which you promoted a pawn to a rook or a knight. ${QW}`, ev: f => qFirst(f, g => g.underpromoted) },
  { id: 'marathon', name: 'Marathon', c: 'Legacy', r: 'uncommon', fam: 'secrets', secret: true, charge: 'hourglass', field: 'bronze', d: 'Win the longest of games.',
    rule: `Win a rated game of at least 200 plies. ${QW}`, ev: f => qFirst(f, g => g.plies >= 200, g => vs(g, ` in ${g.plies} plies`)) },
  { id: 'anniversary', name: 'Anniversary', c: 'Legacy', r: 'epic', fam: 'secrets', secret: true, charge: 'sun', field: 'celeste', d: 'Celebrate a year of victories.',
    rule: `Win a rated game on the calendar anniversary (same month and day, UTC) of your first counted rated win, a year or more later. ${QW}`,
    ev: f => { const w = qualifiedWins(f.games); const a = w[0]; const g = a && w.find(x => x.day.slice(5) === a.day.slice(5) && +x.day.slice(0, 4) > +a.day.slice(0, 4)); return g ? { earned: true, evidence: `First win ${a.day}, anniversary win ${g.day}`, when: g.at, ref: g.id } : { earned: false }; } },
];

// ---------------------------------------------------------------- insignias
const ERA_RARITY: Record<Era, Rarity> = { Apprentice: 'common', Scholarly: 'uncommon', Master: 'epic', Legendary: 'legendary', Sovereign: 'mythic' };
const insigniaRarity = (t: typeof RATING_TITLES[number]): Rarity => (t.era === 'Scholarly' && t.min >= 1200 ? 'rare' : ERA_RARITY[t.era]);
const INSIGNIAS: VaultDef[] = RATING_TITLES.map(t => ({
  id: `insignia-${t.min}`, name: t.name, collection: 'Insignias', rarity: insigniaRarity(t), kind: 'insignia', family: 'insignias', tier: TIER_OF_RARITY[insigniaRarity(t)], since: 'crown-vault-1',
  description: `Rating-title insignia for ${t.min}${t.max === null ? '+' : `–${t.max}`} (${t.era} era).`,
  rule: `Your established Rapid rating reaches or passes through ${t.min}${t.max === null ? ' or more' : `–${t.max}`}. Kept even if your rating falls later; provisional ratings never collect.`,
  art: insigniaSpec(t),
  evaluate: f => hit(f.insignia.collected.includes(t.index), `Established rating in the ${t.name} band`),
}));

const def = (s: Spec, family: FamilyId, since: VaultDef['since']): VaultDef => ({
  id: s.id, name: s.name, collection: s.c, rarity: s.r, kind: s.kind ?? 'achievement', description: s.d, rule: s.rule,
  ...(s.secret ? { secret: true } : {}), ...(s.grading ? { requiresValidatedGrading: true } : {}), ...(s.pl ? { requiresValidatedPlayedLike: true } : {}),
  family, tier: TIER_OF_RARITY[s.r], since,
  art: vaultArt(s.c, s.r, s.charge, s.field, s.mono), evaluate: s.ev,
});
let cache: VaultDef[] | null = null;
function DEFS_BASE(): VaultDef[] {
  cache ??= [
    ...[...SPECS, ...MORE].map(s => def(s, LEGACY_FAMILY[s.id], 'crown-vault-1')),
    ...EXCHANGE_TITLES.map((t, i): VaultDef => ({
      id: t.id, name: t.name, collection: 'Grand Exchange', rarity: t.rarity, kind: 'exchange-title', family: 'exchange', tier: TIER_OF_RARITY[t.rarity], since: 'crown-vault-1',
      description: `Exchange title ${i + 1} of ${EXCHANGE_TITLES.length}.`, rule: exchangeTitleRuleText(t),
      art: { ...vaultArt('Grand Exchange', t.rarity, i >= 6 ? 'crown' : i >= 3 ? 'scales' : 'coin', i >= 6 ? 'or' : i >= 3 ? 'azure' : 'steel'), shape: 'cartouche', pips: Math.min(5, Math.floor(i / 2) + 1) },
      evaluate: f => exchangeTitleEarned(t, f),
    })),
    ...INSIGNIAS,
    ...V2.map(s => def(s, s.fam!, 'crown-vault-2')),
  ];
  return cache;
}
export const VAULT: VaultDef[] = DEFS_BASE();
export const vaultDef = (id: string) => VAULT.find(d => d.id === id);

/** Can this collectible be earned in this build? (Grading-based ones wait for validated grading.) */
export const earnable = (d: VaultDef) => (!d.requiresValidatedGrading || GRADING_VALIDATED) && (!d.requiresValidatedPlayedLike || PLAYED_LIKE_VALIDATED);

/** Evaluate one definition safely; grading-based entries are never earned while grading is experimental. */
export function evaluateDef(d: VaultDef, f: Facts): EvalResult {
  if (!earnable(d)) return { earned: false };
  try { return d.evaluate(f); } catch (e) { console.error('vault rule', d.id, e); return { earned: false }; }
}
