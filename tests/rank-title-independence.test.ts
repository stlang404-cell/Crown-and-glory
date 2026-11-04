/**
 * Competitive Rank (Circuit Grade + sublevel, `rank`) and Federation Title (Squire … Sovereign, `fedTitle`) are tracked
 * independently (docs/FEUDAL_RANKS.md §0): rank checkpoints, promotions and relegations never touch a title; earning a
 * title never touches the rank or the highest-rank record. The UI always shows them apart, each with its own label,
 * tag, frame and tooltip (src/ui/RankBadge.tsx).
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateFederation, hashSeed } from '../src/federation/generator';
import { createWorld, joinPlayer, type Ctx, type RoundRecord } from '../src/federation/world';
import { runRoundHeadless } from '../src/federation/driver';
import { PLAYER_ID, ROUNDS_PER_SEASON, TOPOLOGY_V1 } from '../src/federation/model';
import { POPULATION_V2 } from '../src/federation/population';
import { sampleResult } from '../src/federation/resultModel';
import { competitorHighestRank, competitorRank, currentRank, ensureRanks, highestRank, rankView, stepOf } from '../src/federation/ranks';
import { CIRCUIT_GRADE_NAMES, CIRCUIT_GRADE_LIST_STATUS } from '../src/federation/rankNames';
import { awardNorms } from '../src/app/heraldry';
import type { Ceremony, FedState } from '../src/app/federation';
import { FED_TITLES, type FedTitle } from '../src/heraldry/catalog';
import { RankBadge, TitleBadge, RatingTitleBadge, RANK_TOOLTIP, FED_TITLE_TOOLTIP, RATING_TITLE_TOOLTIP } from '../src/ui/RankBadge';
import { ceremonyHeadline } from '../src/ui/Ceremony';
import { titleFor } from '../src/ratings/titles';

function newCtx(seed = 42): Ctx {
  const comps = generateFederation(seed, TOPOLOGY_V1, POPULATION_V2);
  const { world, plan } = createWorld(seed, comps, 'T', TOPOLOGY_V1, POPULATION_V2);
  const ctx: Ctx = { world, plan, competitors: new Map(comps.map(c => [c.id, c])), player: { rating: 900, rd: 80, name: 'You' }, swissHistory: [] };
  joinPlayer(ctx, 0);
  ensureRanks(ctx, ctx.player.rating, { newCareer: true });
  return ctx;
}
const KNIGHT = CIRCUIT_GRADE_NAMES.findIndex(g => g.name === 'Knight');
const SQUIRE = CIRCUIT_GRADE_NAMES.findIndex(g => g.name === 'Squire');
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);

describe('the approved Circuit Grade list', () => {
  it('keeps the 16 names, their ids and 48 sublevels, and is approved', () => {
    expect(CIRCUIT_GRADE_LIST_STATUS).toBe('approved');
    expect(CIRCUIT_GRADE_NAMES.map(g => g.name)).toEqual(['Commoner', 'Page', 'Squire', 'Man-at-Arms', 'Knight', 'Knight Banneret', 'Baronet', 'Baron', 'Viscount', 'Earl', 'Marquess', 'Duke', 'Grand Duke', 'Prince', 'King', 'High Sovereign']);
    expect(CIRCUIT_GRADE_NAMES.map(g => g.id)).toEqual(Array.from({ length: 16 }, (_, i) => `cg-${String(i + 1).padStart(2, '0')}`));
    expect(rankView(stepOf(KNIGHT, 1)).label).toBe('Knight II');
    expect(rankView(stepOf(SQUIRE, 0)).label).toBe('Squire III');
    expect(FED_TITLES).toEqual(['Squire', 'Knight', 'Paladin', 'Sovereign']);
  });
});

describe('rank and Federation Title are independent', () => {
  it('a competitor can hold rank Knight II with title Squire, and rank Squire III with title Knight', () => {
    const ctx = newCtx(7);
    const [a, b] = [...ctx.competitors.values()];
    a.rank = [stepOf(KNIGHT, 1), 0, stepOf(KNIGHT, 1), 1, -1]; a.fedTitle = 'Squire';
    b.rank = [stepOf(SQUIRE, 0), 0, stepOf(SQUIRE, 0), 1, -1]; b.fedTitle = 'Knight';
    expect(competitorRank(a)!.label).toBe('Knight II'); expect(a.fedTitle).toBe('Squire');
    expect(competitorRank(b)!.label).toBe('Squire III'); expect(b.fedTitle).toBe('Knight');
    // the player: rank and title live in separate fields too
    const p = ctx.world.player;
    p.rank!.step = stepOf(SQUIRE, 0); p.fedTitle = 'Knight';
    expect(currentRank(ctx).label).toBe('Squire III'); expect(p.fedTitle).toBe('Knight');
  });

  it('a whole season of checkpoints, promotions and relegations never changes a title', () => {
    const ctx = newCtx(42);
    const comps = [...ctx.competitors.values()];
    comps.forEach((c, i) => { c.fedTitle = i % 5 === 0 ? FED_TITLES[i % 4] : null; });
    ctx.world.player.fedTitle = 'Squire';
    const titles = new Map(comps.map(c => [c.id, c.fedTitle ?? null]));
    const steps = new Map(comps.map(c => [c.id, c.rank![0]]));
    const rounds: RoundRecord[] = [];
    let i = 0;
    const tier1 = (f: { white: string; black: string }) => { const s = (id: string) => (id === PLAYER_ID ? 1400 : ctx.competitors.get(id)!.latent); return sampleResult(s(f.white), s(f.black), (hashSeed(9, i++) % 10000) / 10000); };
    for (let r = 0; r < ROUNDS_PER_SEASON; r++) rounds.push(runRoundHeadless(ctx, rounds, 'T', tier1).record);
    const moved = comps.filter(c => c.rank![0] !== steps.get(c.id)).length;
    expect(moved).toBeGreaterThan(200); // the season really moved ranks (checkpoints and division moves)
    expect(comps.filter(c => c.rank![0] < steps.get(c.id)!).length).toBeGreaterThan(0); // including demotions
    for (const c of comps) expect(c.fedTitle ?? null).toBe(titles.get(c.id));
    expect(ctx.world.player.fedTitle).toBe('Squire');
  }, 120_000);

  it('earning a title changes neither the rank nor the highest-rank record', () => {
    const ctx = newCtx(11);
    const st = ctx as unknown as FedState;
    const comps = [...ctx.competitors.values()].filter(c => c.status === 'active');
    const strong = comps.filter(c => c.rating >= 1300).slice(0, 12);
    const hero = comps.find(c => !c.fedTitle && !strong.includes(c))!;
    hero.peakRating = 1700; hero.fedTitle = null;
    hero.rank = [stepOf(KNIGHT, 1), 1, stepOf(KNIGHT, 2), 1, 555];
    const p = ctx.world.player;
    p.peakRating = 1700; p.fedTitle = null;
    p.rank!.step = stepOf(SQUIRE, 0); p.rank!.highest = { step: stepOf(KNIGHT, 0), season: 1, round: 8, via: 'checkpoint' };
    const playerRankBefore = JSON.stringify(p.rank);
    const heroRankBefore = JSON.stringify(hero.rank);
    const highestBefore = JSON.stringify(highestRank(ctx));
    const heroHighestBefore = JSON.stringify(competitorHighestRank(hero));
    const others = new Map(comps.map(c => [c.id, JSON.stringify(c.rank)]));
    const games = [hero.id, PLAYER_ID].flatMap(id => strong.slice(0, 6).map(o => ({ event: 'open', white: id, black: o.id, result: 1 as number | null })));
    const ceremonies: Ceremony[] = [];
    awardNorms(st, 1, 8, 'Federation Open', games, 1500, ceremonies);
    expect(hero.fedTitle).toBe('Squire');
    expect(p.fedTitle).toBe('Squire');
    expect(ceremonies.some(c => c.kind === 'fed-title')).toBe(true);
    expect(ceremonies.some(c => c.kind === 'rank')).toBe(false);
    expect(JSON.stringify(hero.rank)).toBe(heroRankBefore);
    expect(JSON.stringify(p.rank)).toBe(playerRankBefore);
    expect(JSON.stringify(highestRank(ctx))).toBe(highestBefore);
    expect(JSON.stringify(competitorHighestRank(hero))).toBe(heroHighestBefore);
    expect(currentRank(ctx).label).toBe('Squire III'); // rank Squire III with title Squire: still two separate things
    for (const c of comps) expect(JSON.stringify(c.rank)).toBe(others.get(c.id));
  });
});

describe('labels: rank, Federation Title and rating title are shown apart', () => {
  it('rank badge: chevron frame, "Rank" tag, labelled area and tooltip', () => {
    const r = rankView(stepOf(KNIGHT, 1));
    const full = html(createElement(RankBadge, { rank: r, labelled: true }));
    expect(full).toContain('Competitive Rank: </span>');
    expect(full).toContain('Knight II');
    expect(full).toContain('data-honour-frame="rank"');
    expect(full).toContain('data-honour-tag="rank"');
    expect(full).toContain('>Rank</span>');
    expect(full).toContain('aria-label="Competitive Rank: Knight II"');
    expect(full).toContain('go up or down from season to season');
    expect(full).toMatch(/data-marks="2"/); // sublevel II → two chevrons
    const compact = html(createElement(RankBadge, { rank: r, compact: true }));
    expect(compact).not.toContain('Knight II</span>');
    expect(compact).toContain('>Rank</span>');
    expect(compact).toContain('aria-label="Competitive Rank: Knight II"');
  });

  it('title badge: medallion frame, "Title" tag, labelled area and tooltip; abbreviations keep the tag', () => {
    const full = html(createElement(TitleBadge, { title: 'Knight' as FedTitle, labelled: true }));
    expect(full).toContain('Federation Title: </span>');
    expect(full).toContain('data-honour-frame="title"');
    expect(full).toContain('data-honour-tag="title"');
    expect(full).toContain('>Title</span>');
    expect(full).toContain('aria-label="Federation Title: Knight"');
    expect(full).toContain('never lost');
    expect(full).not.toContain('data-honour-frame="rank"');
    const abbr = html(createElement(TitleBadge, { title: 'Knight' as FedTitle, abbr: true, plain: true }));
    expect(abbr).toContain('>KT</span>');
    expect(abbr).toContain('>Title</span>');
    expect(abbr).not.toContain('<svg');
    expect(html(createElement(TitleBadge, { title: null }))).toBe('');
  });

  it('rating title badge is tagged "Rating"; the three tooltips explain the difference', () => {
    const t = titleFor(1050);
    const out = html(createElement(RatingTitleBadge, { title: t }));
    expect(out).toContain('>Rating</span>');
    expect(out).toContain(`aria-label="Rating title: ${t.name}"`);
    expect(RANK_TOOLTIP).toMatch(/current competitive standing/);
    expect(RANK_TOOLTIP).toMatch(/up or down/);
    expect(FED_TITLE_TOOLTIP).toMatch(/permanent honour earned by title norms/);
    expect(FED_TITLE_TOOLTIP).toMatch(/never lost/);
    expect(RATING_TITLE_TOOLTIP).toMatch(/neither a Competitive Rank nor a Federation Title/);
  });

  it('ceremony headlines name the kind without changing stored titles', () => {
    expect(ceremonyHeadline({ kind: 'fed-title', title: 'Federation title: Knight' })).toBe('Federation Title: Knight');
    expect(ceremonyHeadline({ kind: 'rank', title: 'Circuit Grade: Knight II' })).toBe('Competitive Rank: Knight II');
    expect(ceremonyHeadline({ kind: 'rank', title: 'Circuit Grade now Squire III' })).toBe('Competitive Rank now Squire III');
    expect(ceremonyHeadline({ kind: 'event-title', title: 'Crown Champion' })).toBe('Crown Champion');
  });
});
