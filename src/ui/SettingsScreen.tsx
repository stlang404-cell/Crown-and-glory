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
import { BOARDS, MOTIONS, PIECE_SPEEDS, THEMES, DEFAULT_PREFS, getCurrentPrefs, prefersReducedMotion, setBoard, setMotion, setPieceSpeed, setPrefs, setTheme, subscribePrefs, type BoardId } from './theme';
import { DEFAULT_SOUND, SOUND_CATEGORIES, getSoundPrefs, playSound, setSoundPrefs, subscribeSound, unlockAudio, type SoundId } from './sound';

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
      <p className="muted" style={{ marginTop: 0 }}>Display settings apply right away and are remembered in this browser only. They are not part of your saves or backups.</p>

      <section className="panel" aria-labelledby="set-theme">
        <div className="panel-title"><h2 id="set-theme" style={{ margin: 0 }}>Colour Theme</h2></div>
        <div className="pick-grid" role="radiogroup" aria-labelledby="set-theme">
          {THEMES.map(t => (
            <label key={t.id} className="pick" data-testid={`theme-${t.id}`}>
              <input type="radio" name="theme" value={t.id} checked={prefs.theme === t.id} onChange={() => setTheme(t.id)} />
              <span className="pick-name">{t.name}{t.id === DEFAULT_PREFS.theme && <span className="chip">Default</span>}<span className="tick" aria-hidden /></span>
              <div className="theme-preview" data-theme={t.id} data-board={prefs.board} aria-hidden>
                <div className="tp-panel">
                  <span className="tp-title">Crown League</span>
                  <span className="small muted">Round 4 · Rapid</span>
                  <span className="tp-row"><span className="chip pos">+12</span><span className="chip neg">−8</span><span className="chip gold">Title</span></span>
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
        <div className="panel-title"><h2 id="set-board" style={{ margin: 0 }}>Board Colours</h2><span className="small muted">Separate from the colour theme</span></div>
        <div className="pick-grid boards" role="radiogroup" aria-labelledby="set-board">
          {BOARDS.map(b => { const locked = !!PREMIUM_BOARDS[b.id] && !(services.fed?.ready && services.fed.hasCosmetic(PREMIUM_BOARDS[b.id])); return (
            <label key={b.id} className="pick" data-testid={`board-${b.id}`} style={locked ? { opacity: 0.6 } : undefined}>
              <input type="radio" name="board" value={b.id} checked={prefs.board === b.id} disabled={locked} onChange={() => setBoard(b.id as BoardId)} />
              <span style={{ display: 'block' }} data-board={b.id} data-theme={b.id === 'theme' ? prefs.theme : undefined}><MiniBoard /></span>
              <span className="pick-name">{b.name}<span className="tick" aria-hidden /></span>
              <span className="pick-blurb">{locked ? 'Locked. ' : ''}{b.blurb}</span>
            </label>
          ); })}
        </div>
      </section>

      <section className="panel" aria-labelledby="set-motion">
        <div className="panel-title"><h2 id="set-motion" style={{ margin: 0 }}>Motion</h2>
          <span className={`chip ${reduced ? 'info' : ''}`}>{reduced ? 'Animations Reduced' : 'Animations On'}</span>
        </div>
        <div className="seg" role="group" aria-labelledby="set-motion">
          {MOTIONS.map(m => <button key={m.id} aria-pressed={prefs.motion === m.id} onClick={() => setMotion(m.id)}>{m.name}</button>)}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          “Follow system” uses your device’s reduced-motion setting (now {systemReduced ? 'on' : 'off'}). “Reduce” turns off piece slides and screen transitions. “Full” keeps them on even when your device asks for less motion.
        </p>
        <h3 id="set-piece-speed" className="small" style={{ margin: '12px 0 6px' }}>Piece Movement</h3>
        <div className="seg" role="group" aria-labelledby="set-piece-speed" data-testid="piece-speed">
          {PIECE_SPEEDS.map(m => <button key={m.id} aria-pressed={prefs.pieceSpeed === m.id} onClick={() => setPieceSpeed(m.id)}>{m.name}</button>)}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          How quickly pieces slide to their new square{reduced ? ' (off while motion is reduced)' : ''}. Moves, clocks and markets never wait for an animation.
        </p>
      </section>

      <SoundSettings />

      <section className="panel about" aria-labelledby="set-about">
        <div className="panel-title"><h2 id="set-about" style={{ margin: 0 }}>About</h2>
          <button className="btn small ghost" onClick={() => setPrefs(DEFAULT_PREFS)}>Reset Display Settings</button>
        </div>
        <dl>
          <dt>Game</dt><dd>Crown &amp; Calculation: The Six-Square Federation</dd>
          <dt>Version</dt><dd className="mono">v{APP_VERSION}</dd>
          <dt>Saves</dt><dd>Stored on this device only.</dd>
          <dt>Money</dt><dd>Crowns are fictional and have no cash value.</dd>
          <dt>Network</dt><dd>Works fully offline. The engine, Match Analysis and the federation all run on this device. No accounts, ads or tracking.</dd>
          <dt>Artwork</dt><dd>Original pieces, pixel portraits and icons, with system fonts.</dd>
        </dl>
      </section>
      <details className="advanced" style={{ marginTop: 14 }}>
        <summary><h2 style={{ display: 'inline', margin: 0 }}>Advanced</h2></summary>
        <section className="panel" aria-labelledby="set-engine">
          <div className="panel-title"><h2 id="set-engine" style={{ margin: 0 }}>Analysis Engine</h2><span className="chip">On This Device · {ENGINE_BUILD}</span></div>
          <p className="small" style={{ marginTop: 0 }}>Match Analysis runs the engine in the background on this device. Pick a setting for each game on the Analysis screen, or for batch re-analysis in Games. Each run is saved as its own report and never replaces an older one.</p>
          <table className="small">
            <thead><tr><th>Setting</th><th>Search</th><th>Measured Speed*</th><th>Best For</th></tr></thead>
            <tbody>{ANALYSIS_PRESETS.map(p => { const m = (SPEED.presets as Record<string, { msPerPly: number }>)[p.id]; return <tr key={p.id}><td>{p.label}{p.id === DEFAULT_ANALYSIS.id ? ' (default)' : ''}</td><td className="mono">depth {p.depth}, {p.candidates} candidates</td><td className="mono">{m ? `≈ ${m.msPerPly < 1000 ? `${m.msPerPly} ms` : `${(m.msPerPly / 1000).toFixed(1)} s`} per move` : '—'}</td><td>{p.depth <= 5 ? 'Quick overview; misses deeper tactics' : p.depth <= 7 ? 'Balanced; grades are calibrated at this setting' : 'Slowest; best for important games'}</td></tr>; })}</tbody>
          </table>
          <p className="small muted" style={{ marginBottom: 0 }}>*Measured on three engine games on a 4-core cloud computer ({SPEED.measuredAt.slice(0, 10)}); phones are usually slower. Deeper search finds more, but no setting plays like a grandmaster. Grade thresholds are the game’s own and still experimental, not FIDE-calibrated.</p>
        </section>

        <EngineDiagnostics />

        <section className="panel about" aria-labelledby="set-build">
          <div className="panel-title"><h2 id="set-build" style={{ margin: 0 }}>Build Details</h2></div>
          <dl>
            <dt>Rules</dt><dd className="mono">crown-la6-v1 · rules {RULES_VERSION}</dd>
            <dt>Save database</dt><dd className="mono">IndexedDB schema v{DB_VERSION}, on this device</dd>
          </dl>
        </section>
      </details>
    </div>
  );
}

function SoundSettings() {
  const p = useSyncExternalStore(subscribeSound, getSoundPrefs, getSoundPrefs);
  const preview = (id: SoundId) => { unlockAudio(); setTimeout(() => playSound(id), 30); };
  return (
    <section className="panel" aria-labelledby="set-sound" data-testid="sound-settings">
      <div className="panel-title"><h2 id="set-sound" style={{ margin: 0 }}>Sound</h2>
        <span className={`chip ${p.enabled ? '' : 'info'}`}>{p.enabled ? 'Sound On' : 'Muted'}</span>
      </div>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={p.enabled} onChange={e => setSoundPrefs({ enabled: e.target.checked })} data-testid="sound-enabled" /> Play sound effects
      </label>
      <label className="row" style={{ gap: 8, marginTop: 8 }}>
        <span style={{ minWidth: 64 }}>Volume</span>
        <input type="range" min={0} max={100} step={5} value={Math.round(p.volume * 100)} disabled={!p.enabled} aria-label="Sound effects volume"
          onChange={e => setSoundPrefs({ volume: +e.target.value / 100 })} onPointerUp={() => preview('move')} data-testid="sound-volume" style={{ flex: 1, maxWidth: 260 }} />
        <span className="mono small" style={{ minWidth: 36 }}>{Math.round(p.volume * 100)}%</span>
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: '10px 0 0' }} disabled={!p.enabled}>
        <legend className="small muted" style={{ marginBottom: 4 }}>Sound categories</legend>
        {SOUND_CATEGORIES.map(c => (
          <label key={c.id} className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={p.categories[c.id]} onChange={e => setSoundPrefs({ categories: { ...p.categories, [c.id]: e.target.checked } })} data-testid={`sound-cat-${c.id}`} />
            <span>{c.name}</span><span className="small muted">{c.detail}</span>
          </label>
        ))}
      </fieldset>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }} role="group" aria-label="Preview sounds">
        {(['move', 'capture', 'check', 'promotion', 'checkmate', 'victory', 'defeat', 'draw', 'tournament', 'rank'] as SoundId[]).map(id => (
          <button key={id} className="btn small ghost" disabled={!p.enabled} onClick={() => preview(id)}>{id[0].toUpperCase() + id.slice(1)}</button>
        ))}
        <span className="spacer" />
        <button className="btn small ghost" onClick={() => setSoundPrefs(DEFAULT_SOUND)}>Reset Sound Settings</button>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>
        All sounds are made on this device; nothing is downloaded. Browsers keep sound off until you first tap or press a key, so the very first moments of a visit are silent.
        On iPhone, the ring/silent switch can also mute sounds.
      </p>
    </section>
  );
}
