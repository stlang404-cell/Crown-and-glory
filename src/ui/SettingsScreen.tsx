import { useSyncExternalStore } from 'react';
import { APP_VERSION } from '../app/services';
import { DB_VERSION } from '../storage/db';
import { RULES_VERSION } from '../rules/types';
import { PieceSvg } from './Pieces';
import { ANALYSIS_PRESETS, DEFAULT_ANALYSIS, ENGINE_BUILD } from '../analysis/analyzer';
import SPEED from '../analysis/analysis-speed.json';
import { EngineDiagnostics } from './EngineDiagnostics';
import { PREMIUM_BOARDS } from './theme';
import { useServices } from './App';
import { BOARDS, MOTIONS, THEMES, DEFAULT_PREFS, getCurrentPrefs, prefersReducedMotion, setBoard, setMotion, setPrefs, setTheme, subscribePrefs, type BoardId } from './theme';

function usePrefs() {
  return useSyncExternalStore(subscribePrefs, getCurrentPrefs, getCurrentPrefs);
}

/** A 4×4 corner of a board with two pieces and a last-move highlight, coloured by the nearest data-board/theme. */
function MiniBoard({ label }: { label?: string }) {
  const cells = Array.from({ length: 16 }, (_, i) => {
    const r = Math.floor(i / 4), f = i % 4;
    return { light: (r + f) % 2 === 0, hl: i === 5 || i === 10 };
  });
  const pieces: Record<number, ['k' | 'q' | 'n' | 'p', 'w' | 'b']> = { 1: ['q', 'b'], 6: ['p', 'b'], 10: ['n', 'w'], 13: ['k', 'w'] };
  return (
    <div className="mini-board" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {cells.map((c, i) => (
        <i key={i} className={`${c.light ? 'l' : 'd'}${c.hl ? ' hl' : ''}`}>
          {pieces[i] && <PieceSvg kind={pieces[i][0]} color={pieces[i][1]} />}
        </i>
      ))}
    </div>
  );
}

export function SettingsScreen() {
  const prefs = usePrefs();
  const services = useServices();
  const reduced = prefersReducedMotion(prefs);
  let systemReduced = false;
  try { systemReduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no matchMedia */ }

  return (
    <div className="settings">
      <h1>Settings</h1>
      <p className="muted" style={{ marginTop: 0 }}>Display preferences apply immediately and are remembered in this browser only. They are not part of your saves or backups.</p>

      <section className="panel" aria-labelledby="set-theme">
        <div className="panel-title"><h2 id="set-theme" style={{ margin: 0 }}>Colour theme</h2></div>
        <div className="pick-grid" role="radiogroup" aria-labelledby="set-theme">
          {THEMES.map(t => (
            <label key={t.id} className="pick" data-testid={`theme-${t.id}`}>
              <input type="radio" name="theme" value={t.id} checked={prefs.theme === t.id} onChange={() => setTheme(t.id)} />
              <span className="pick-name">{t.name}{t.id === DEFAULT_PREFS.theme && <span className="chip">default</span>}<span className="tick" aria-hidden /></span>
              <div className="theme-preview" data-theme={t.id} data-board={prefs.board} aria-hidden>
                <div className="tp-panel">
                  <span className="tp-title">Crown League</span>
                  <span className="small muted">Round 4 · rapid</span>
                  <span className="tp-row"><span className="chip pos">+12</span><span className="chip neg">−8</span><span className="chip gold">title</span></span>
                  <span className="tp-row"><span className="tp-btn">Play</span></span>
                </div>
                <MiniBoard />
              </div>
              <span className="swatches" aria-hidden>{t.swatches.map(c => <i key={c} style={{ background: c }} />)}</span>
              <span className="pick-blurb">{t.blurb}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="set-board">
        <div className="panel-title"><h2 id="set-board" style={{ margin: 0 }}>Board colours</h2><span className="small muted">Independent of the theme</span></div>
        <div className="pick-grid boards" role="radiogroup" aria-labelledby="set-board">
          {BOARDS.map(b => { const locked = !!PREMIUM_BOARDS[b.id] && !(services.fed?.ready && services.fed.hasCosmetic(PREMIUM_BOARDS[b.id])); return (
            <label key={b.id} className="pick" data-testid={`board-${b.id}`} style={locked ? { opacity: 0.6 } : undefined}>
              <input type="radio" name="board" value={b.id} checked={prefs.board === b.id} disabled={locked} onChange={() => setBoard(b.id as BoardId)} />
              <span style={{ display: 'block' }} data-board={b.id} data-theme={b.id === 'theme' ? prefs.theme : undefined}><MiniBoard /></span>
              <span className="pick-name">{b.name}<span className="tick" aria-hidden /></span>
              <span className="pick-blurb">{locked ? 'Locked — ' : ''}{b.blurb}</span>
            </label>
          ); })}
        </div>
      </section>

      <section className="panel" aria-labelledby="set-motion">
        <div className="panel-title"><h2 id="set-motion" style={{ margin: 0 }}>Motion</h2>
          <span className={`chip ${reduced ? 'info' : ''}`}>{reduced ? 'animations reduced' : 'animations on'}</span>
        </div>
        <div className="seg" role="group" aria-labelledby="set-motion">
          {MOTIONS.map(m => <button key={m.id} aria-pressed={prefs.motion === m.id} onClick={() => setMotion(m.id)}>{m.name}</button>)}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          “Follow system” uses your device’s reduced-motion setting (currently {systemReduced ? 'on' : 'off'}). Reduce turns off piece slides and interface transitions; Full keeps them even when the device asks for less motion.
        </p>
      </section>

      <section className="panel" aria-labelledby="set-engine">
        <div className="panel-title"><h2 id="set-engine" style={{ margin: 0 }}>Analysis engine</h2><span className="chip">local · {ENGINE_BUILD}</span></div>
        <p className="small" style={{ marginTop: 0 }}>Postgame analysis runs the Crown engine in a background worker on this device. Choose a configuration per game on the Analysis screen or for batch re-analysis in the Library; every run is stored as a separate, versioned report and never overwrites an older one.</p>
        <table className="small">
          <thead><tr><th>Configuration</th><th>Search</th><th>Measured speed*</th><th>Use</th></tr></thead>
          <tbody>{ANALYSIS_PRESETS.map(p => { const m = (SPEED.presets as Record<string, { msPerPly: number }>)[p.id]; return <tr key={p.id}><td>{p.label}{p.id === DEFAULT_ANALYSIS.id ? ' · default' : ''}</td><td className="mono">depth {p.depth}, {p.candidates} candidates</td><td className="mono">{m ? `≈ ${m.msPerPly < 1000 ? `${m.msPerPly} ms` : `${(m.msPerPly / 1000).toFixed(1)} s`} per move` : '—'}</td><td>{p.depth <= 5 ? 'fast overview; misses deeper tactics' : p.depth <= 7 ? 'balanced (grades calibrated at this setting)' : 'slowest; best for critical games'}</td></tr>; })}</tbody>
        </table>
        <p className="small muted" style={{ marginBottom: 0 }}>*Measured with tools/bench/analysis_speed.ts on three engine games in Node on a 4-core cloud machine ({SPEED.measuredAt.slice(0, 10)}); phones are usually slower. Deeper search finds more, but no setting is a grandmaster: the grade thresholds are internal and experimental, not FIDE-calibrated.</p>
      </section>

      <EngineDiagnostics />

      <section className="panel about" aria-labelledby="set-about">
        <div className="panel-title"><h2 id="set-about" style={{ margin: 0 }}>About</h2>
          <button className="btn small ghost" onClick={() => setPrefs(DEFAULT_PREFS)}>Reset display settings</button>
        </div>
        <dl>
          <dt>Game</dt><dd>Crown &amp; Calculation: The Six-Square Federation</dd>
          <dt>Version</dt><dd className="mono">v{APP_VERSION}</dd>
          <dt>Rules</dt><dd className="mono">crown-la6-v1 · rules {RULES_VERSION}</dd>
          <dt>Save database</dt><dd className="mono">IndexedDB schema v{DB_VERSION}, on this device</dd>
          <dt>Money</dt><dd>Crowns are fictional and have no cash value.</dd>
          <dt>Network</dt><dd>Fully offline: the engine, analysis and federation all run locally. No accounts, ads or tracking.</dd>
          <dt>Artwork</dt><dd>Original pieces, pixel portraits and icons; system fonts only.</dd>
        </dl>
      </section>
    </div>
  );
}
