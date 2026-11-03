import { ROSTER, levelRating, CALIBRATION_ID } from '../federation/roster';
import { getLevel } from '../engine/levels';
import { Portrait } from './Portrait';
import calibration from '../engine/calibration.json';

export function FederationScreen() {
  const cal = calibration as { id: string; status: string; method?: string; anchor?: string };
  return (
    <div>
      <h1>The Six-Square Federation</h1>
      <div className="notice" style={{ marginBottom: 14 }}>
        M1 contains the federation's founding roster: eight persistent opponents bound to measured engine strength profiles.
        Leagues, divisions, tournaments, championships and the 2,048-player world (M3) and the optional Crown Exchange with a
        separate Sandbox mode (M4) are designed but <strong>not implemented yet</strong> — nothing here is simulated or fake.
      </div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3>Calibration</h3>
        <p className="small muted" style={{ margin: 0 }}>Calibration <span className="mono">{CALIBRATION_ID}</span> — {cal.status}. {cal.method ?? ''} {cal.anchor ?? ''}</p>
      </div>
      <div className="grid-2">
        {ROSTER.map(o => {
          const c = levelRating(o.level);
          const lv = getLevel(o.level);
          return (
            <div key={o.id} className="panel row" style={{ alignItems: 'flex-start' }}>
              <Portrait seed={o.portraitSeed} size={72} crown={o.level === 8} />
              <div style={{ flex: 1 }}>
                <div className="row"><h3 style={{ margin: 0 }}>{o.name}</h3><span className="chip gold">L{o.level} {lv.name}</span></div>
                <div className="small muted">{o.club}</div>
                <p className="small" style={{ margin: '6px 0' }}>{o.bio}</p>
                <div className="small">Rating: <strong>{c ? `${Math.round(c.rating)} ±${Math.round(c.rd)}` : 'uncalibrated'}</strong>{c ? ` (${c.games} calibration games)` : ''}</div>
                <div className="small muted">{lv.description} Style: standard evaluation — distinct playing styles are not yet demonstrated.</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
