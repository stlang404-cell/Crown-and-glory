import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { AppServices } from './app/services';
import { applyPrefs } from './ui/theme';
import { updates, CURRENT_BUILD } from './app/updates';
import { installAudioUnlock } from './ui/sound';
import './ui/themes.css';
import './ui/styles.css';

applyPrefs(); // idempotent with the inline pre-paint script in index.html
installAudioUnlock(); // audio starts only after the player's first tap or key press

const root = createRoot(document.getElementById('root')!);

AppServices.boot().then(services => {
  (window as unknown as { __crown?: AppServices }).__crown = services; // debugging / e2e inspection only
  void import('./ui/sound').then(m => { (window as unknown as { __crownSound?: unknown }).__crownSound = m; }); // e2e inspection only
  root.render(<StrictMode><App services={services} /></StrictMode>);
  void services.processQueue();
}).catch(e => {
  // Nothing is in progress when the app could not even open: switch to a downloaded fix as soon as one is ready.
  const tryFix = () => { if (updates.state.waiting || updates.state.activatedElsewhere) updates.apply(); };
  updates.subscribe(tryFix); tryFix();
  root.render(
    <div style={{ padding: 24 }}>
      <h1>Crown &amp; Calculation could not open its local database</h1>
      <p>{String(e?.message ?? e)}</p>
      <p>Your saved games have not been deleted. Private browsing modes and some storage settings block IndexedDB; close other Crown tabs and reload.</p>
    </div>,
  );
});

// Build identity (same as dist/version.json) — shown in Settings → About; exposed for e2e checks.
(window as unknown as { __crownBuild?: unknown }).__crownBuild = CURRENT_BUILD;
if (import.meta.env.PROD) {
  // Registers the service worker, checks for updates on launch and whenever the app returns to the foreground.
  // Switching to a downloaded update is decided by <UpdateNotice /> (never in the middle of a game).
  updates.start();
  (window as unknown as { __crownUpdate?: unknown }).__crownUpdate = updates; // e2e inspection only
}
