import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { AppServices } from './app/services';
import { applyPrefs } from './ui/theme';
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
  root.render(
    <div style={{ padding: 24 }}>
      <h1>Crown &amp; Calculation could not open its local database</h1>
      <p>{String(e?.message ?? e)}</p>
      <p>Your saved games have not been deleted. Private browsing modes and some storage settings block IndexedDB; close other Crown tabs and reload.</p>
    </div>,
  );
});

if ('serviceWorker' in navigator && import.meta.env.PROD && window.isSecureContext) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js'); });
}
