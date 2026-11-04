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
import { fmtMoney, MICRO } from '../exchange/ledger';
import { comebackRun, exchangeStats, seasonPnl, unbeatenRun, type Facts, type OwnGame } from './facts';

export const VAULT_ID = 'crown-vault-1';
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

interface Spec { id: string; name: string; c: Collection; r: Rarity; charge: ChargeId; field: Tincture; d: string; rule: string; secret?: boolean; grading?: boolean; kind?: VaultDef['kind']; mono?: string; ev: (f: Facts) => EvalResult }
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

// ---------------------------------------------------------------- insignias
const ERA_RARITY: Record<Era, Rarity> = { Apprentice: 'common', Scholarly: 'uncommon', Master: 'epic', Legendary: 'legendary', Sovereign: 'mythic' };
const INSIGNIAS: VaultDef[] = RATING_TITLES.map(t => ({
  id: `insignia-${t.min}`, name: t.name, collection: 'Insignias', rarity: t.era === 'Scholarly' && t.min >= 1200 ? 'rare' : ERA_RARITY[t.era], kind: 'insignia',
  description: `Rating-title insignia for ${t.min}${t.max === null ? '+' : `–${t.max}`} (${t.era} era).`,
  rule: `Your established Rapid rating reaches or passes through ${t.min}${t.max === null ? ' or more' : `–${t.max}`}. Kept even if your rating falls later; provisional ratings never collect.`,
  art: insigniaSpec(t),
  evaluate: f => hit(f.insignia.collected.includes(t.index), `Established rating in the ${t.name} band`),
}));

let cache: VaultDef[] | null = null;
function DEFS_BASE(): VaultDef[] {
  cache ??= [
    ...[...SPECS, ...MORE].map((s): VaultDef => ({
      id: s.id, name: s.name, collection: s.c, rarity: s.r, kind: s.kind ?? 'achievement', description: s.d, rule: s.rule,
      ...(s.secret ? { secret: true } : {}), ...(s.grading ? { requiresValidatedGrading: true } : {}),
      art: vaultArt(s.c, s.r, s.charge, s.field, s.mono), evaluate: s.ev,
    })),
    ...EXCHANGE_TITLES.map((t, i): VaultDef => ({
      id: t.id, name: t.name, collection: 'Grand Exchange', rarity: t.rarity, kind: 'exchange-title',
      description: `Exchange title ${i + 1} of ${EXCHANGE_TITLES.length}.`, rule: exchangeTitleRuleText(t),
      art: { ...vaultArt('Grand Exchange', t.rarity, i >= 6 ? 'crown' : i >= 3 ? 'scales' : 'coin', i >= 6 ? 'or' : i >= 3 ? 'azure' : 'steel'), shape: 'cartouche', pips: Math.min(5, Math.floor(i / 2) + 1) },
      evaluate: f => exchangeTitleEarned(t, f),
    })),
    ...INSIGNIAS,
  ];
  return cache;
}
export const VAULT: VaultDef[] = DEFS_BASE();
export const vaultDef = (id: string) => VAULT.find(d => d.id === id);

/** Can this collectible be earned in this build? (Grading-based ones wait for validated grading.) */
export const earnable = (d: VaultDef) => !d.requiresValidatedGrading || GRADING_VALIDATED;

/** Evaluate one definition safely; grading-based entries are never earned while grading is experimental. */
export function evaluateDef(d: VaultDef, f: Facts): EvalResult {
  if (!earnable(d)) return { earned: false };
  try { return d.evaluate(f); } catch (e) { console.error('vault rule', d.id, e); return { earned: false }; }
}
