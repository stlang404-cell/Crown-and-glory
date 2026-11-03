import { useEffect, useState } from 'react';
import { CANON_BUILD, CANON_FEATURES_KEY, INTEL_ID, RULES_FINGERPRINT, CANON_BACKEND } from '../engine/canonical';
import { ENGINE_EVENTS, type EngineEvent } from '../engine/client';
import { LEVELS_ID, MAX_BUDGETS_S, MAX_RATED_BUDGET_S } from '../engine/levels';
import { GRADING_ID, ACCURACY_ID } from '../analysis/methodology';
import { VERIFY_ID } from '../academy/verify';

/** Which engine every intelligence system runs, and the most recent engine jobs (crown-engine-events-1). */
export function EngineDiagnostics() {
  const [events, setEvents] = useState<EngineEvent[]>([]);
  useEffect(() => { const t = setInterval(() => setEvents([...ENGINE_EVENTS].slice(-12).reverse()), 1000); setEvents([...ENGINE_EVENTS].slice(-12).reverse()); return () => clearInterval(t); }, []);
  const rows: [string, string][] = [
    ['Rated and casual play (L1–L8)', `${LEVELS_ID}, node/time budgets per level`],
    ['Sovereign Max (L9)', `best move only, 2^20 table, ${MAX_BUDGETS_S.join('/')} s (rated: ${MAX_RATED_BUDGET_S} s)`],
    ['Federation, spectator and sparring games', 'competitor profiles (node budgets)'],
    ['Move assistant, candidate moves', 'exact scores at the chosen depth'],
    ['Post-game analysis and grading', `${GRADING_ID} · ${ACCURACY_ID}`],
    ['Puzzle verification, Academy', VERIFY_ID],
    ['Chess Intelligence Lab', 'reads reports; never mixes engine or grading versions'],
  ];
  return (
    <section className="panel" aria-labelledby="set-intel" data-testid="engine-diagnostics">
      <div className="panel-title"><h2 id="set-intel" style={{ margin: 0 }}>Chess intelligence</h2><span className="chip">{INTEL_ID}</span></div>
      <p className="small" style={{ marginTop: 0 }}>Every system below runs the same engine — <span className="mono">{CANON_BUILD}</span> ({CANON_BACKEND}, rules <span className="mono">{RULES_FINGERPRINT}</span>) — and differs only in how long it may think. Reports made by older engines keep their original engine and grading labels and are never relabelled.</p>
      <table className="small"><thead><tr><th>System</th><th>Budget / method</th></tr></thead><tbody>{rows.map(([a, b]) => <tr key={a}><td>{a}</td><td className="mono">{b}</td></tr>)}</tbody></table>
      <details className="small" style={{ marginTop: 8 }}><summary>Search features</summary><span className="mono">{CANON_FEATURES_KEY}</span></details>
      <h3 style={{ marginBottom: 4 }}>Recent engine jobs</h3>
      {events.length === 0 ? <p className="small muted">No engine work since this page was opened.</p> : (
        <table className="small" data-testid="engine-events"><thead><tr><th>Worker</th><th>Job</th><th>Event</th><th>Time</th></tr></thead>
          <tbody>{events.map((e, i) => <tr key={i}><td>{e.role}</td><td className="mono">{e.kind} #{e.generation}</td><td>{e.event}{e.detail ? ` (${e.detail})` : ''}</td><td className="mono">{e.ms !== undefined ? `${e.ms} ms` : ''}</td></tr>)}</tbody></table>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>Cancelled or superseded jobs are discarded: their results are never saved.</p>
    </section>
  );
}
