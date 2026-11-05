/** Career Elo (the Glicko-2 rating on the Crown scale, docs/LEGACY.md) — one display for every surface. */
import { useSyncExternalStore } from 'react';
import { CAREER_ELO_NOTE, fmtCareerElo, ratingChange } from '../ratings/display';
import { isProvisional } from '../ratings/glicko2';
import { PLAYER_ID } from '../federation/model';
import { useServices } from './App';

/** "1,427 ±45" (with RD where there is room), "0 · provisional" when provisional. Never negative. */
export function Elo({ rating, rd, provisional, compact, className }: { rating: number | null | undefined; rd?: number | null; provisional?: boolean; compact?: boolean; className?: string }) {
  if (rating === null || rating === undefined || !Number.isFinite(rating)) return <span className={`elo mono muted ${className ?? ''}`}>—</span>;
  return <span className={`elo mono ${className ?? ''}`} title={CAREER_ELO_NOTE} data-elo={Math.max(0, Math.round(rating))}>{fmtCareerElo(rating, { rd, provisional, compact })}</span>;
}

/** "Previous 1,427 → New 1,445 (+18)" after a rated game (displayed values; never negative). */
export function RatingChangeLine({ before, after, className, provisional }: { before: number; after: number; className?: string; provisional?: boolean }) {
  const c = ratingChange(before, after);
  return (
    <div className={`rating-change ${className ?? ''}`} data-testid="rating-change" title={CAREER_ELO_NOTE}>
      <span className="muted">Previous</span> <span className="mono">{c.previous.toLocaleString('en-US')}</span> <span role="img" aria-label="to">→</span>{' '}
      <span className="muted">New</span> <strong className="mono">{c.next.toLocaleString('en-US')}</strong>{' '}
      <span className={`mono ${c.delta > 0 ? 'pos' : c.delta < 0 ? 'neg' : 'muted'}`}>({c.deltaText})</span>
      {provisional && <span className="muted"> · provisional</span>}
    </div>
  );
}

const NOOP = () => () => {};
/** The player's career Elo (the career pool, the Federation's rating) as the legacy service last read it. */
export function usePlayerElo(): { rating: number; rd: number; provisional: boolean } | null {
  const services = useServices();
  const lg = services.legacy ?? null;
  useSyncExternalStore(lg ? lg.subscribe : NOOP, () => lg?.version ?? 0);
  const p = lg?.career.pool;
  return p ? { rating: p.rating, rd: p.rd, provisional: isProvisional(p.games, p.rd) } : null;
}

/** Career Elo of any competitor id, the player included (RD hidden on phones in tables). */
export function CompetitorElo({ id, compact, className }: { id: string; compact?: boolean; className?: string }) {
  const services = useServices();
  const me = usePlayerElo();
  if (id === PLAYER_ID) return me ? <span className={`elo mono ${className ?? ''}`} title={CAREER_ELO_NOTE}>{fmtCareerElo(me.rating, { provisional: me.provisional, compact: true })}{!compact && <span className="muted hide-sm"> ±{Math.round(me.rd)}</span>}</span> : <span className="muted">—</span>;
  const c = services.fed.state?.competitors.get(id);
  if (!c) return <span className="muted">—</span>;
  return <span className={`elo mono ${className ?? ''}`} title={CAREER_ELO_NOTE}>{fmtCareerElo(c.rating)}{!compact && <span className="muted hide-sm"> ±{Math.round(c.rd)}</span>}</span>;
}
