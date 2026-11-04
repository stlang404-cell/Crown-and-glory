import { useApp, useServices } from './App';
import { eventName } from '../app/federation';
import type { Fixture } from '../federation/model';

const fmtResult = (r: number) => (r === 1 ? '1–0' : r === 0 ? '0–1' : '½–½');
const LABEL: Record<NonNullable<Fixture['resolution']>, string> = { simulated: 'Played live', 'fast-forwarded': 'Fast-forwarded', abstract: 'Abstract result' };

/** v0.9 "Live Now": the round's scheduled engine games (src/app/scheduler.ts), with how each result was produced. */
export function LiveNow() {
  const services = useServices();
  const { go } = useApp();
  const fed = services.fed;
  const slate = fed.slateFixtures();
  const st = services.live?.stats();
  const s = services.liveSettings;
  const live = slate.filter(f => f.result === null);
  const done = slate.filter(f => f.result !== null);
  const row = (f: Fixture) => {
    const lg = fed.liveGame(f.id);
    const last = lg?.moves[lg.moves.length - 1];
    return (
      <div key={f.id} className="row small" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 6, flexWrap: 'wrap' }} data-testid="live-now-row">
        <strong>{fed.name(f.white)}</strong><span className="muted">vs</span><strong>{fed.name(f.black)}</strong>
        <span className="muted">{eventName(f.event)}</span>
        <span className="spacer" />
        {f.result === null
          ? <span className="chip neg is-live">LIVE · move {lg?.moves.length ?? 0}{last ? ` · ${last.san}` : ''}</span>
          : <span className={`chip ${f.resolution === 'abstract' ? '' : 'info'}`} title={f.resolution === 'abstract' ? 'Decided by the result model; there is no replay.' : undefined}>{fmtResult(f.result)} · {LABEL[f.resolution ?? 'simulated']}</span>}
        <button className="btn small" onClick={() => go({ name: 'watch', id: f.id })}>{f.result === null ? 'Watch' : f.resolution === 'abstract' ? 'Details' : 'Replay'}</button>
      </div>
    );
  };
  return (
    <div className="panel stack" style={{ marginTop: 14 }} data-testid="live-now">
      <div className="panel-title">
        <h3 style={{ margin: 0 }}>Live Now</h3>
        <span className="chip">{s.mode === 'off' ? 'Off' : `${live.length} of ${st?.capacity ?? '—'} in progress`}{st?.paused.length ? ' · Paused' : ''}</span>
      </div>
      {s.mode === 'off' ? <p className="small muted" style={{ margin: 0 }}>Live games are switched off in Settings.</p>
        : live.length === 0 && done.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Background games of this round start here shortly, played move by move by the engine.</p> : live.map(row)}
      {done.length > 0 && <details className="small"><summary>Finished this round ({done.length})</summary><div className="stack">{done.map(row)}</div></details>}
      <div className="small muted">Engine games from this round's leagues and Swiss events, played while the app is open (paused during your own games). If the round advances first, an unfinished game takes its model result and is labelled Abstract. No markets are listed on these games.</div>
    </div>
  );
}
