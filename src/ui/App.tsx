import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { AppServices } from '../app/services';
import { PieceDefs } from './Pieces';
import { BrandMark } from './Portrait';
import { PlayScreen, MatchScreen } from './PlayScreen';
import { AnalysisScreen } from './AnalysisScreen';
import { LibraryScreen } from './LibraryScreen';
import { ProfileScreen } from './ProfileScreen';
import { LabScreen } from './LabScreen';
import { FederationScreen } from './FederationScreen';
import { AcademyScreen } from './AcademyScreen';
import { Icon } from './Icons';

export type View =
  | { name: 'play' }
  | { name: 'match'; gameId: string }
  | { name: 'analysis'; gameId: string; ply?: number }
  | { name: 'library' }
  | { name: 'profile' }
  | { name: 'lab' }
  | { name: 'academy' }
  | { name: 'federation' };

const Ctx = createContext<{ services: AppServices; go: (v: View) => void } | null>(null);
export const useApp = () => useContext(Ctx)!;

/** Re-render whenever the services layer publishes a change. */
export function useServices(): AppServices {
  const { services } = useApp();
  useSyncExternalStore(l => services.subscribe(l), () => services.revision);
  return services;
}

function parseHash(): View {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, id, ply] = h.split('/');
  if (name === 'match' && id) return { name: 'match', gameId: decodeURIComponent(id) };
  if (name === 'analysis' && id) return { name: 'analysis', gameId: decodeURIComponent(id), ply: ply ? +ply : undefined };
  if (name === 'library' || name === 'profile' || name === 'lab' || name === 'federation' || name === 'academy') return { name };
  return { name: 'play' };
}
function toHash(v: View): string {
  if (v.name === 'match') return `#/match/${encodeURIComponent(v.gameId)}`;
  if (v.name === 'analysis') return `#/analysis/${encodeURIComponent(v.gameId)}${v.ply !== undefined ? '/' + v.ply : ''}`;
  return `#/${v.name}`;
}

const NAV: { id: View['name']; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'play', label: 'Play', icon: 'play' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'academy', label: 'Academy', icon: 'academy' },
  { id: 'profile', label: 'Passport', icon: 'profile' },
  { id: 'lab', label: 'Lab', icon: 'lab' },
  { id: 'federation', label: 'Federation', icon: 'world' },
];

export function App({ services }: { services: AppServices }) {
  const [view, setView] = useState<View>(parseHash);
  useEffect(() => {
    const on = () => setView(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (v: View) => { const h = toHash(v); if (location.hash !== h) location.hash = h; else setView(v); window.scrollTo(0, 0); };
  const section = view.name === 'match' ? 'play' : view.name === 'analysis' ? 'library' : view.name;
  return (
    <Ctx.Provider value={{ services, go }}>
      <PieceDefs />
      <div className="app">
        <nav className="rail" aria-label="Main">
          <div className="brand">
            <BrandMark />
            <div>
              <div className="brand-name">Crown &amp; Calculation</div>
              <div className="brand-sub">Six-Square Federation</div>
            </div>
          </div>
          {NAV.map(n => (
            <button key={n.id} className="nav-btn" aria-current={section === n.id ? 'page' : undefined} onClick={() => go({ name: n.id } as View)}>
              <Icon name={n.icon} /> {n.label}
            </button>
          ))}
          <div className="rail-foot">
            Offline · local saves · fictional money only<br />v{'0.2.0'} · crown-la6-v1
          </div>
        </nav>
        <main className="main" id="main">
          {services.readOnly && <div className="notice warn" role="alert" style={{ marginBottom: 12 }}>Crown &amp; Calculation is open in another tab. This tab is read-only to protect your saves.</div>}
          {view.name === 'play' && <PlayScreen />}
          {view.name === 'match' && <MatchScreen key={view.gameId} gameId={view.gameId} />}
          {view.name === 'analysis' && <AnalysisScreen key={view.gameId} gameId={view.gameId} initialPly={view.ply} />}
          {view.name === 'library' && <LibraryScreen />}
          {view.name === 'profile' && <ProfileScreen />}
          {view.name === 'lab' && <LabScreen />}
          {view.name === 'academy' && <AcademyScreen />}
          {view.name === 'federation' && <FederationScreen />}
        </main>
        <nav className="tabbar" aria-label="Main">
          {NAV.map(n => (
            <button key={n.id} aria-current={section === n.id ? 'page' : undefined} onClick={() => go({ name: n.id } as View)}>
              <Icon name={n.icon} />{n.label}
            </button>
          ))}
        </nav>
      </div>
    </Ctx.Provider>
  );
}
