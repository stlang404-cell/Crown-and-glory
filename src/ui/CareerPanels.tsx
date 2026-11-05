/**
 * The player's season in the shared Federation (v0.11): upcoming matches, standing, qualification opportunities and
 * knockout brackets. Used by the Dashboard, the Federation screen and Tournaments. Reads src/app/career.ts only.
 */
import { scrollRegion } from './scrollRegion';
import { useState } from 'react';
import { useApp, useServices } from './App';
import { PLAYER_ID, divisionLabel, regionName } from '../federation/model';
import type { KoState } from '../federation/world';
import { koTitle } from '../federation/competitions';
import { koScore } from '../federation/formats';
import { deadlineRule, myStanding, opportunities, upcomingMatches, type Opportunity } from '../app/seasonCareer';
import type { SeasonGame } from '../federation/driver';

const STATUS: Record<Opportunity['status'], { label: string; cls: string }> = {
  qualified: { label: 'Qualified', cls: 'pos' }, entered: { label: 'Entered', cls: 'pos' }, won: { label: 'Won', cls: 'gold' },
  open: { label: 'Entry Open', cls: 'gold' }, 'in-reach': { label: 'In Reach', cls: 'info' }, 'next-season': { label: 'Route', cls: '' },
  closed: { label: 'Closed', cls: '' }, eliminated: { label: 'Eliminated', cls: 'neg' },
};

export function UpcomingMatches({ limit = 6 }: { limit?: number }) {
  const services = useServices();
  const { go } = useApp();
  const st = services.fed.state;
  if (!st) return null;
  const list = upcomingMatches(st, limit);
  if (!list.length) return <p className="small muted" data-testid="career-upcoming-empty">No more matches for you this season. Your next fixtures appear when the new season starts.</p>;
  return (
    <ul className="dash-list" data-testid="career-upcoming">
      {list.map(m => (
        <li key={m.key} className="row small" data-testid="career-match" data-status={m.status} style={{ gap: 8, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
          <span className={`chip ${m.status === 'play-now' ? 'gold' : m.status === 'postponed' ? 'neg' : ''}`}>{m.status === 'play-now' ? 'Play Now' : m.status === 'postponed' ? 'Postponed' : m.status === 'scheduled' ? `Round ${m.round}` : `Round ${m.round}`}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>{m.opponent ? <button className="btn ghost small inline-link" onClick={() => go({ name: 'competitor', id: m.opponent! })}>{services.fed.name(m.opponent)}</button> : 'Opponent to be paired'}</strong>
            {m.opponent && <span className="mono muted"> {Math.round(services.fed.ratingOf(m.opponent))}</span>}
            <div className="muted">{m.eventName} · {m.note}{m.colour ? ` · you play ${m.colour}` : ''}</div>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StandingSummary({ games }: { games: SeasonGame[] }) {
  const services = useServices();
  const st = services.fed.state;
  if (!st) return null;
  const s = myStanding(st, games);
  if (!s) return null;
  return (
    <div className="small" data-testid="career-standing">
      <strong>{divisionLabel(s.division)} · {regionName(s.region)}</strong>: {s.rank} of {s.size}, {s.points} pts from {s.played}
      {s.zone === 'promotion' && <span className="chip pos" style={{ marginLeft: 6 }}>Promotion Zone</span>}
      {s.zone === 'relegation' && <span className="chip neg" style={{ marginLeft: 6 }}>Relegation Zone</span>}
    </div>
  );
}

export function Opportunities({ games }: { games: SeasonGame[] }) {
  const services = useServices();
  const fed = services.fed;
  const st = fed.state;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!st) return null;
  const list = opportunities(st, games);
  return (
    <div className="stack" style={{ gap: 6 }} data-testid="career-opportunities">
      {list.map(o => (
        <div key={o.id} className="small" data-testid="career-opportunity" data-id={o.id} data-status={o.status} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
          <div className="row" style={{ gap: 6 }}><strong>{o.name}</strong><span className="spacer" /><span className={`chip ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span></div>
          <div className="muted">{o.need}</div>
          {o.action && (
            <button className="btn small" style={{ marginTop: 4 }} data-testid={`career-register-${o.action.event}`} disabled={busy || services.readOnly}
              onClick={async () => { setBusy(true); setMsg(null); try { await fed.registerChallenger(false, o.action!.event); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } }}>
              {o.action.free ? 'Accept Invitation' : 'Register'}
            </button>
          )}
        </div>
      ))}
      {msg && <div className="notice warn small" role="alert">{msg}</div>}
    </div>
  );
}

export function DeadlineRule() {
  const st = useServices().fed.state;
  return st ? <p className="small muted" data-testid="deadline-rule">{deadlineRule(st)}</p> : null;
}

/** Knockout bracket (any size): stages as columns, scores, seeds, how a match was decided. */
export function Bracket({ ko, testId }: { ko: KoState; testId?: string }) {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  return (
    <div data-testid={testId ?? 'bracket'} data-event={ko.name}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12, overflowX: 'auto', paddingBottom: 4 }} ref={scrollRegion('Bracket')}>
        {ko.stages.map(sg => (
          <div key={sg.label} style={{ minWidth: 170 }}>
            <div className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>{sg.label} · Round {sg.round}</div>
            {sg.matches.length === 0 ? <div className="small muted">To be decided</div> : sg.matches.map((m, i) => (
              <div key={i} className="panel" data-testid="bracket-match" style={{ padding: 6, margin: '6px 0', borderColor: m.a === PLAYER_ID || m.b === PLAYER_ID ? 'var(--accent)' : undefined }}>
                {[m.a, m.b].map(id => (
                  <div key={id} className="row small" style={{ fontWeight: m.winner === id || m.joint ? 700 : 400, gap: 4 }}>
                    <span className="muted mono">{m.a === id ? m.seedA : m.seedB}</span>
                    <button className="btn ghost small inline-link" style={{ fontWeight: 'inherit' }} disabled={id === PLAYER_ID} onClick={() => go({ name: 'competitor', id })}>{fed.name(id)}</button>
                    <span className="mono muted">{id === PLAYER_ID ? '' : Math.round(fed.ratingOf(id))}</span>
                    <span className="spacer" /><span className="mono">{m.games.length ? koScore(m, id) : ''}</span>
                  </div>
                ))}
                {m.decidedBy && <div className="small muted">{m.joint ? 'Joint champions' : `Decided by ${m.decidedBy}`}</div>}
              </div>
            ))}
          </div>
        ))}
        {ko.champions.length > 0 && <div className="panel" style={{ minWidth: 150, borderColor: 'var(--accent)' }}><strong data-testid="bracket-champion">{ko.champions.map(id => fed.name(id)).join(' & ')}</strong><div className="small muted">{koTitle(ko)} winner</div></div>}
      </div>
    </div>
  );
}
