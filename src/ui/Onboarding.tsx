/**
 * First-run guide UI (crown-tour-1; logic in src/app/onboarding.ts):
 *  - <GuideCard/> on the Dashboard: the current step only (progressive), with the full checklist on demand;
 *  - <TourHint step/> inline on the screen where a step matters (never an overlay, never on the match screen);
 *  - <HelpPanel/> in Settings: restart (replay) the guide, show/hide it, open any tutorial, glossary;
 *  - <HelpTip/>: a small keyboard-accessible "?" disclosure for confusing labels.
 * Everything is optional and skippable; nothing blocks play.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import './onboarding.css';
import { useApp, useServices, type View } from './App';
import type { AppServices } from '../app/services';
import { PLAYER_ID } from '../federation/model';
import {
  STEPS, TOUR_KEY, ackStep, emptyTour, hintVisible, markSeen, restartTour, sanitizeTour, setDismissed, stepById, tourView,
  type StepTarget, type TourFacts, type TourState, type TourStepId,
} from '../app/onboarding';

// ---------------------------------------------------------------- store (one per services instance)
class TourStore {
  state: TourState | null = null;
  version = 0;
  private listeners = new Set<() => void>();
  constructor(private services: AppServices) {
    void services.db.getMeta(TOUR_KEY).then(v => { this.state = sanitizeTour(v); this.emit(); }, () => { this.state = emptyTour(); this.emit(); });
  }
  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getVersion = () => this.version;
  private emit() { this.version++; for (const l of this.listeners) l(); }
  update(fn: (s: TourState) => TourState): void {
    const prev = this.state ?? emptyTour();
    const next = fn(prev);
    if (next === prev) return;
    this.state = next;
    this.emit();
    if (!this.services.readOnly) void this.services.db.setMeta(TOUR_KEY, next).catch(e => console.error('tour', e));
  }
}
const stores = new WeakMap<AppServices, TourStore>();
function storeFor(s: AppServices): TourStore {
  let t = stores.get(s);
  if (!t) { t = new TourStore(s); stores.set(s, t); }
  return t;
}
export function useTourState(): { state: TourState | null; update: (fn: (s: TourState) => TourState) => void } {
  const { services } = useApp();
  const store = storeFor(services);
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return { state: store.state, update: fn => store.update(fn) };
}
/** Record that something was seen (e.g. the analysis of a finished game), once. */
export function useMarkSeen(key: string, when = true): void {
  const { update } = useTourState();
  useEffect(() => { if (when) update(s => markSeen(s, key, new Date().toISOString())); }, [key, when]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------------------------------------------------------------- facts from the save
let factsCache: { rev: number; at: number; games: { games: number; rated: number; federation: number } } | null = null;
export function useTourFacts(): TourFacts | null {
  const services = useServices();
  const rev = services.revision;
  const [g, setG] = useState(factsCache?.games ?? null);
  useEffect(() => {
    let alive = true;
    const fresh = factsCache && factsCache.rev === rev;
    const t = setTimeout(() => {
      void services.db.allGames().then(all => {
        const fin = all.filter(x => x.status === 'finalized');
        const games = { games: fin.length, rated: fin.filter(x => x.rated).length, federation: fin.filter(x => x.context.kind === 'federation').length };
        factsCache = { rev, at: Date.now(), games };
        if (alive) setG(games);
      }).catch(() => {});
    }, fresh ? 0 : factsCache ? 1200 : 50);
    return () => { alive = false; clearTimeout(t); };
  }, [services, rev]);
  if (!g) return null;
  const st = services.fed?.ready ? services.fed.state : null;
  let traded = false;
  if (st) for (const p of st.positions.values()) { if (p.holder === 'player:cash' && !st.markets.get(p.marketId)?.sandbox) { traded = true; break; } }
  const tournamentEntry = !!st && st.plan.swiss.some(sw => sw.entrants.includes(PLAYER_ID));
  return {
    games: g.games, ratedGames: g.rated, federationGames: g.federation, federation: !!st, tournamentEntry, traded,
    trophies: services.legacy?.ready ? services.legacy.earned.trophies.length : 0,
  };
}

const viewOf = (t: StepTarget): View => t as View;

// ---------------------------------------------------------------- dashboard card
export function GuideCard() {
  const { go } = useApp();
  const { state, update } = useTourState();
  const facts = useTourFacts();
  const [all, setAll] = useState(false);
  const hid = useId();
  if (!state || !facts || state.dismissed) return null;
  const v = tourView(state, facts);
  if (v.complete) return null;
  const now = () => new Date().toISOString();
  const cur = v.current;
  return (
    <section className="panel guide-card" aria-labelledby={hid} data-testid="guide-card" data-step={cur?.id ?? ''}>
      <div className="panel-title">
        <h2 id={hid} className="dash-h">Getting Started</h2>
        <span className="chip" data-testid="guide-progress">{v.done} of {v.total} done</span>
        <span className="spacer" />
        <button className="btn ghost small" data-testid="guide-hide" onClick={() => update(s => setDismissed(s, true))}>Hide the guide</button>
      </div>
      <div className="guide-bar" role="progressbar" aria-label="Guide progress" aria-valuemin={0} aria-valuemax={v.total} aria-valuenow={v.done}><span style={{ width: `${Math.round((100 * v.done) / v.total)}%` }} /></div>
      {cur ? (
        <div className="stack" style={{ gap: 6 }} data-testid="guide-current">
          <h3 className="h4" style={{ margin: '6px 0 0' }}>Next: {cur.title}</h3>
          {cur.body.map((p, i) => <p key={i} className="small" style={{ margin: 0 }}>{p}</p>)}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn small primary" data-testid="guide-cta" onClick={() => { if (cur.kind === 'explain') update(s => ackStep(s, cur.id, now())); go(viewOf(cur.cta.to)); }}>{cur.cta.label}</button>
            {cur.more && <button className="btn small" onClick={() => go(viewOf(cur.more!.to))}>{cur.more.label}</button>}
            <button className="btn small ghost" data-testid="guide-skip" onClick={() => update(s => ackStep(s, cur.id, now()))}>{cur.kind === 'explain' ? 'Got it' : 'Skip this step'}</button>
          </div>
        </div>
      ) : <p className="small muted" data-testid="guide-waiting">The next steps open as you play: {v.steps.filter(x => x.status === 'locked').map(x => `${x.step.title.toLowerCase()} (after ${x.step.unlocksAfter})`).join('; ')}.</p>}
      <details className="small" open={all} onToggle={e => setAll((e.target as HTMLDetailsElement).open)}>
        <summary>All steps</summary>
        <ol className="guide-steps" data-testid="guide-steps">
          {v.steps.map(({ step, status }) => (
            <li key={step.id} data-status={status} data-step={step.id}>
              <span className={`chip ${status === 'done' ? 'pos' : status === 'current' ? 'gold' : ''}`}>{status === 'done' ? 'Done' : status === 'current' ? 'Next' : status === 'open' ? 'Open' : 'Later'}</span>{' '}
              <strong>{step.title}</strong> <span className="muted">— {status === 'locked' ? `opens after ${step.unlocksAfter}` : step.why}</span>
              {status !== 'locked' && <> <button className="btn ghost small inline-link" onClick={() => go(viewOf(step.cta.to))}>Open</button></>}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------- inline hint on a screen
export function TourHint({ step, children }: { step: TourStepId; children?: ReactNode }) {
  const { go } = useApp();
  const { state, update } = useTourState();
  const facts = useTourFacts();
  if (!state || !facts || !hintVisible(step, state, facts)) return null;
  const s = stepById(step);
  const now = new Date().toISOString();
  return (
    <div className="notice info tour-hint" role="note" aria-label={`Guide: ${s.title}`} data-testid={`tour-hint-${step}`}>
      <strong>Guide · {s.title}</strong>
      {s.body.map((p, i) => <p key={i} className="small" style={{ margin: '4px 0 0' }}>{p}</p>)}
      {children}
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        <button className="btn small" data-testid={`tour-ack-${step}`} onClick={() => update(x => ackStep(x, step, now))}>Got it</button>
        {s.more && <button className="btn small ghost" onClick={() => go(viewOf(s.more!.to))}>{s.more.label}</button>}
        <button className="btn small ghost" data-testid="tour-hide" onClick={() => update(x => setDismissed(x, true))}>Hide all guide tips</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Settings → Help & Tutorials
export const GLOSSARY: { term: string; text: string }[] = [
  { term: 'Career Elo', text: 'Your rating, from 0 upward, with its uncertainty (±). Changes after every rated game, only through results. Provisional for the first 20 rated games.' },
  { term: 'Competitive Rank (Circuit Grade)', text: '48 steps from Commoner III to High Sovereign I. Follows your division and standing at season checkpoints; can go up and down. Your highest rank is kept.' },
  { term: 'Federation Title', text: 'An honour won in competitions and norms. Never taken away; independent of your rank and of your Elo.' },
  { term: 'Rating title', text: 'The name of the rating band a career Elo falls in (shown next to ratings). It follows the Elo; it is not a Federation Title.' },
  { term: 'Played Like', text: 'A per-game performance estimate from the analysis of that game alone, for both sides, with an uncertainty. It never changes your career Elo.' },
  { term: 'Live Odds / price', text: 'A share pays $1 if its outcome happens. Its price is the market\'s probability. Money is fictional; the most you can lose on a trade is what you paid.' },
];

export function HelpPanel() {
  const { go } = useApp();
  const { state, update } = useTourState();
  const facts = useTourFacts();
  const [msg, setMsg] = useState<string | null>(null);
  const v = state && facts ? tourView(state, facts) : null;
  return (
    <section className="panel" aria-labelledby="set-help" data-testid="help-panel">
      <div className="panel-title"><h2 id="set-help" style={{ margin: 0 }}>Help &amp; Tutorials</h2>{v && <span className="chip">{v.done} of {v.total} guide steps done</span>}</div>
      <p className="small muted" style={{ marginTop: 0 }}>The Getting Started guide introduces each part of the game when it becomes relevant. It is optional: hide it any time, and restart it here to see every explanation again. Its progress is part of your saves and backups.</p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn small" data-testid="help-restart" disabled={!state} onClick={() => { update(restartTour); setMsg('The guide starts again on your Dashboard; tips reappear on each screen.'); }}>Restart the Guide</button>
        {state?.dismissed
          ? <button className="btn small" data-testid="help-show" onClick={() => { update(s => setDismissed(s, false)); setMsg('The guide is shown again.'); }}>Show the Guide</button>
          : <button className="btn small ghost" data-testid="help-hide" disabled={!state} onClick={() => { update(s => setDismissed(s, true)); setMsg('The guide is hidden. Restart or show it here.'); }}>Hide the Guide</button>}
      </div>
      {msg && <div className="notice small" role="status" style={{ marginTop: 8 }}>{msg}</div>}
      <h3 className="small" style={{ margin: '12px 0 4px' }}>Tutorials</h3>
      <ul className="small guide-steps" data-testid="help-tutorials">
        {STEPS.map(s => {
          const st = v?.steps.find(x => x.step.id === s.id)?.status;
          return (
            <li key={s.id}>
              <details>
                <summary><strong>{s.title}</strong>{st === 'done' && <span className="chip pos" style={{ marginLeft: 6 }}>Done</span>}</summary>
                {s.body.map((p, i) => <p key={i} style={{ margin: '4px 0' }}>{p}</p>)}
                <button className="btn small" onClick={() => go(viewOf(s.cta.to))}>{s.cta.label}</button>
              </details>
            </li>
          );
        })}
      </ul>
      <h3 className="small" style={{ margin: '12px 0 4px' }}>Glossary</h3>
      <dl className="small help-glossary">
        {GLOSSARY.map(g => <div key={g.term}><dt><strong>{g.term}</strong></dt><dd style={{ margin: '0 0 6px' }}>{g.text}</dd></div>)}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- "?" disclosure
export function HelpTip({ term, label }: { term: string; label?: string }) {
  const g = GLOSSARY.find(x => x.term === term);
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  if (!g) return null;
  return (
    <span className="help-tip">
      <button ref={ref} type="button" className="help-tip-btn" aria-expanded={open} aria-controls={id} aria-label={`What is ${label ?? g.term}?`}
        onClick={() => setOpen(o => !o)} onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}>?</button>
      {open && <span id={id} role="note" className="help-tip-text small">{g.text}</span>}
    </span>
  );
}
