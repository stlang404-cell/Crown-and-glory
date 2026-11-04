import { Emblem } from './Emblem';
import type { RankView } from '../federation/ranks';
import type { EmblemSize } from '../heraldry/spec';

/** Tooltip text shared by every Circuit Grade badge (rank ≠ Career Elo ≠ Played Like). */
export const RANK_TOOLTIP = 'Circuit Grade: a rank set by your division and your standing at each checkpoint (league place, sanctioned results, rating within the division). Not your Career Elo and not Played Like.';

/** A Circuit Grade insignia with its full label ("Knight II"); `compact` shows the insignia only (label in the tooltip). */
export function RankBadge({ rank, size = 'sm', compact = false, testId, extra }: { rank: RankView | null; size?: EmblemSize; compact?: boolean; testId?: string; extra?: string }) {
  if (!rank) return null;
  const title = `${rank.label} · ${RANK_TOOLTIP}${extra ? ` ${extra}` : ''}`;
  return (
    <span className="rank-badge" data-testid={testId} data-rank={rank.gradeId} data-sublevel={rank.sublevel} title={title}>
      <Emblem spec={rank.insignia} size={size} title={rank.ariaLabel} />
      {!compact && <span className="rank-badge-label">{rank.label}</span>}
    </span>
  );
}
