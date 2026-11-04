import { useServices } from './App';
import { HARD_MAX_LIVE, capacityFor, defaultLiveSettings, type LiveSettings } from '../app/scheduler';

/** Settings → Live Games: how many scheduled engine games run at once on this device (src/app/scheduler.ts). */
export function LiveSchedulerSettings() {
  const services = useServices();
  const s = services.liveSettings;
  const st = services.live?.stats();
  const set = (patch: Partial<LiveSettings>) => services.setLiveSettings({ ...s, ...patch });
  const auto = capacityFor({ ...s, mode: 'auto' }, st?.medianMoveMs ?? null, services.livePool.length);
  return (
    <section className="panel" aria-labelledby="set-live" data-testid="live-settings">
      <div className="panel-title"><h2 id="set-live" style={{ margin: 0 }}>Live Games</h2><span className="chip">On This Device</span></div>
      <p className="small" style={{ marginTop: 0 }}>The federation plays some of each round's background games move by move so you can watch them. More games use more processor time and battery.</p>
      <div className="seg" role="group" aria-label="Live games">
        <button aria-pressed={s.mode === 'off'} onClick={() => set({ mode: 'off' })}>Off</button>
        <button aria-pressed={s.mode === 'auto'} onClick={() => set({ mode: 'auto' })}>Automatic</button>
        <button aria-pressed={s.mode === 'fixed'} onClick={() => set({ mode: 'fixed' })}>Fixed</button>
      </div>
      {s.mode === 'fixed' && (
        <label className="small" style={{ display: 'block', marginTop: 8 }}>Games at once{' '}
          <input type="number" min={1} max={HARD_MAX_LIVE} value={s.fixed} data-testid="live-fixed" onChange={e => set({ fixed: +e.target.value })} style={{ width: 64 }} />
        </label>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>
        {s.mode === 'auto' ? `Automatic keeps up to ${s.maxAuto} games going, fewer if this device is slow: now ${auto}` : s.mode === 'fixed' ? `${s.fixed} games` : 'No live games'}
        {st?.medianMoveMs != null ? ` · measured ${st.medianMoveMs} ms per engine move on ${st.workers} worker${st.workers === 1 ? '' : 's'}` : ''}
        {' '}· one move per game about every {Math.round(s.plyIntervalMs / 1000)} s. Nothing runs while the app is closed; when you come back after a while, at most {s.catchUpK} unfinished games are fast-forwarded and the rest get model results (labelled).
      </p>
      <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => services.setLiveSettings(defaultLiveSettings(services.device))}>Reset</button>
    </section>
  );
}
