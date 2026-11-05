import { Emblem } from './Emblem';
import type { EmblemSpec, EmblemSize } from '../heraldry/spec';
import { titleEmblem, FED_TITLE_ABBR, type FedTitle } from '../heraldry/catalog';
import { insigniaSpec, type RatingTitle } from '../ratings/titles';

/**
 * Three different things share medieval-sounding names in this game, so they are always shown apart
 * (docs/FEUDAL_RANKS.md §0):
 *   • COMPETITIVE RANK — the Circuit Grade with its sublevel ("Knight II"): the current competitive standing, set by
 *     league and tournament results at each checkpoint; it can go up or down from season to season.
 *     Treatment: square steel-blue frame with a chevron, tag "Rank" (`--rank-tone`).
 *   • FEDERATION TITLE — Squire, Knight, Paladin, Sovereign: a permanent honour earned by title norms, never lost.
 *     Treatment: round gold medallion frame with a star, tag "Title" (`--title-tone`).
 *   • RATING TITLE — the name of the current 100-point Career Elo band ("Rune Reader"); tag "Rating".
 * Promotions/demotions never change a Federation Title, and earning a title never changes the rank (separate fields
 * `rank` and `fedTitle`; tests/rank-title-independence.test.ts).
 */
export const RANK_TOOLTIP = 'Competitive Rank (Circuit Grade): your current competitive standing, set by league and tournament results at each checkpoint (league place, sanctioned results, rating within the division). It can go up or down from season to season. Not a Federation Title, not your Career Elo and not Played Like.';
export const FED_TITLE_TOOLTIP = 'Federation Title: a permanent honour earned by title norms (strong performances in sanctioned events). Once earned it is never lost, and it is separate from the Competitive Rank, which goes up and down with results.';
export const RATING_TITLE_TOOLTIP = 'Rating title: the name of the current 100-point Career Elo band. It changes with the rating; it is neither a Competitive Rank nor a Federation Title.';

export type HonourKind = 'rank' | 'title' | 'rating';
const TAG: Record<HonourKind, string> = { rank: 'Rank', title: 'Title', rating: 'Rating' };
const LONG: Record<HonourKind, string> = { rank: 'Competitive Rank', title: 'Federation Title', rating: 'Rating title' };
const TIP: Record<HonourKind, string> = { rank: RANK_TOOLTIP, title: FED_TITLE_TOOLTIP, rating: RATING_TITLE_TOOLTIP };

/** The small text tag that names the kind ("Rank" / "Title" / "Rating"); kept even in compact rows. */
export function HonourTag({ kind }: { kind: HonourKind }) {
  return <span className={`honour-tag honour-tag-${kind}`} data-honour-tag={kind} aria-hidden>{TAG[kind]}</span>;
}

/** The framed insignia of one kind (square chevron frame for a rank, round medallion for a Federation Title). */
export function HonourFrame({ kind, spec, size = 'sm', title }: { kind: HonourKind; spec: EmblemSpec; size?: EmblemSize; title: string }) {
  return <span className={`honour-frame honour-frame-${kind} honour-frame-${size}`} data-honour-frame={kind}><Emblem spec={spec} size={size} title={title} /></span>;
}

interface Common {
  size?: EmblemSize;
  /** Insignia + tag only (the label is in the tooltip and the accessible name). */
  compact?: boolean;
  /** Prefix the label with its kind ("Competitive Rank: Knight II"). */
  labelled?: boolean;
  /** No insignia (text and tag only). */
  plain?: boolean;
  testId?: string;
  extra?: string;
}

function Badge({ kind, label, spec, insigniaTitle, size = 'sm', compact, labelled, plain, testId, extra, data }: Common & { kind: HonourKind; label: string; spec: EmblemSpec | null; insigniaTitle: string; data?: Record<string, string> }) {
  const tip = `${LONG[kind]}: ${label}. ${TIP[kind]}${extra ? ` ${extra}` : ''}`;
  return (
    <span className={`honour-badge honour-${kind}${kind === 'rank' ? ' rank-badge' : kind === 'title' ? ' title-badge' : ''}${compact ? ' compact' : ''}`} data-testid={testId} data-honour={kind} title={tip} aria-label={`${LONG[kind]}: ${label}`} role="group" {...data}>
      {spec && !plain && <HonourFrame kind={kind} spec={spec} size={size} title={insigniaTitle} />}
      {!compact && <span className="honour-label">{labelled && <span className="honour-kind">{LONG[kind]}: </span>}<span className={kind === 'rank' ? 'rank-badge-label' : 'honour-name'}>{label}</span></span>}
      {' '}<HonourTag kind={kind} />
    </span>
  );
}

/** A Competitive Rank (Circuit Grade + sublevel, e.g. "Knight II") with its chevron-framed insignia and "Rank" tag. */
export function RankBadge({ rank, ...o }: Common & { rank: { label: string; insignia: EmblemSpec | null; gradeId?: string; sublevel?: string; ariaLabel?: string } | null }) {
  if (!rank) return null;
  return <Badge kind="rank" label={rank.label} spec={rank.insignia} insigniaTitle={rank.ariaLabel ?? `${rank.label}: Competitive Rank insignia`} data={{ 'data-rank': rank.gradeId ?? '', 'data-sublevel': rank.sublevel ?? '' }} {...o} />;
}

/** A Federation Title (Squire … Sovereign, earned by norms) with its round medallion and "Title" tag; null when none. */
export function TitleBadge({ title, abbr, ...o }: Common & { title: FedTitle | null | undefined; abbr?: boolean }) {
  if (!title) return null;
  return <Badge kind="title" label={abbr ? FED_TITLE_ABBR[title] : title} spec={titleEmblem(title)} insigniaTitle={`Federation Title ${title} emblem`} data={{ 'data-fed-title': title }} {...o} />;
}

/** A rating title (100-point Career Elo band name) with the "Rating" tag. */
export function RatingTitleBadge({ title, ...o }: Common & { title: RatingTitle | null | undefined }) {
  if (!title) return null;
  return <Badge kind="rating" label={title.name} spec={insigniaSpec(title)} insigniaTitle={`${title.name}: rating title insignia`} {...o} />;
}

/** Plain-text form for places that cannot hold markup (tooltips, aria labels, one-line summaries). */
export const rankText = (label: string) => `Competitive Rank ${label}`;
export const titleText = (t: FedTitle) => `Federation Title ${t}`;
