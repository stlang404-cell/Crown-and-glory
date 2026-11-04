import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { AppServices } from '../app/services';
import { PieceDefs } from './Pieces';
import { BrandMark } from './Portrait';
import { PlayScreen, MatchScreen } from './PlayScreen';
import { AnalysisScreen } from './AnalysisScreen';
import { AnalysisPicker } from './AnalysisPicker';
import { ScreenBoundary } from './ScreenBoundary';
import { IdentityBanner } from './IdentityBanner';
import { LibraryScreen } from './LibraryScreen';
import { ProfileScreen } from './ProfileScreen';
import { LabScreen } from './LabScreen';
import { WorldScreen, StandingsScreen, TournamentsScreen } from './WorldScreen';
import { CompetitorsScreen, CompetitorScreen } from './CompetitorScreen';
import { SpectatorScreen } from './SpectatorScreen';
import { ExchangeScreen } from './ExchangeScreen';
import { FinanceScreen } from './FinanceScreen';
import { ForecastScreen } from './ForecastScreen';
import { NewsScreen } from './NewsScreen';
import { RivalsScreen } from './RivalsScreen';
import { HallScreen } from './HallScreen';
import { HeraldryScreen } from './HeraldryScreen';
import { CeremonyOverlay } from './Ceremony';
import { APP_VERSION } from '../app/services';
import { AcademyScreen } from './AcademyScreen';
import { Icon } from './Icons';
import { SettingsScreen } from './SettingsScreen';
import { VaultScreen, VaultToast } from './VaultScreen';

export type View =
  | { name: 'play' }
  | { name: 'match'; gameId: string }
  | { name: 'analysis'; gameId: string; ply?: number }
  | { name: 'analyses' }
  | { name: 'library' }
  | { name: 'profile' }
  | { name: 'lab' }
  | { name: 'academy' }
  | { name: 'world' }
  | { name: 'standings' }
  | { name: 'tournaments' }
  | { name: 'competitors' }
  | { name: 'competitor'; id: string }
  | { name: 'watch'; id: string }
  | { name: 'exchange'; id?: string }
  | { name: 'finance' }
  | { name: 'forecasts' }
  | { name: 'news' }
  | { name: 'rivals' }
  | { name: 'hall' }
  | { name: 'heraldry' }
  | { name: 'vault' }
  | { name: 'settings' };

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
  if (name === 'analysis') return { name: 'analyses' };
  if (name === 'competitor' && id) return { name: 'competitor', id: decodeURIComponent(id) };
  if (name === 'watch' && id) return { name: 'watch', id: decodeURIComponent(id) };
  if (name === 'exchange') return id ? { name: 'exchange', id: decodeURIComponent(id) } : { name: 'exchange' };
  if (name === 'federation') return { name: 'world' };
  if (['library', 'profile', 'lab', 'academy', 'world', 'standings', 'tournaments', 'competitors', 'finance', 'forecasts', 'news', 'settings', 'rivals', 'hall', 'heraldry', 'vault'].includes(name)) return { name } as View;
  return { name: 'play' };
}
function toHash(v: View): string {
  if (v.name === 'match') return `#/match/${encodeURIComponent(v.gameId)}`;
  if (v.name === 'analysis') return `#/analysis/${encodeURIComponent(v.gameId)}${v.ply !== undefined ? '/' + v.ply : ''}`;
  if (v.name === 'analyses') return '#/analysis';
  if (v.name === 'competitor' || v.name === 'watch') return `#/${v.name}/${encodeURIComponent(v.id)}`;
  if (v.name === 'exchange' && v.id) return `#/exchange/${encodeURIComponent(v.id)}`;
  return `#/${v.name}`;
}

const NAV: { id: View['name']; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'play', label: 'Play', icon: 'play' },
  { id: 'world', label: 'Federation', icon: 'world' },
  { id: 'exchange', label: 'Exchange', icon: 'exchange' },
  { id: 'finance', label: 'Finance', icon: 'finance' },
  { id: 'library', label: 'Games', icon: 'library' },
  { id: 'analyses', label: 'Analysis', icon: 'analysis' },
  { id: 'academy', label: 'Academy', icon: 'academy' },
  { id: 'profile', label: 'Career', icon: 'profile' },
  { id: 'rivals', label: 'Rivals', icon: 'rivals' },
  { id: 'hall', label: 'Hall of Fame', icon: 'hall' },
  { id: 'vault', label: 'Vault', icon: 'vault' },
  { id: 'lab', label: 'Lab', icon: 'lab' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];
/** The phone tab bar keeps the five most-used sections plus Settings; the rest live in the Federation/Career screens and the side rail. */
const TABS: View['name'][] = ['play', 'world', 'exchange', 'finance', 'profile', 'settings'];
const SECTION: Partial<Record<View['name'], View['name']>> = { match: 'play', analysis: 'analyses', standings: 'world', tournaments: 'world', competitors: 'world', competitor: 'world', watch: 'world', forecasts: 'exchange', news: 'world', heraldry: 'hall' };

export function App({ services }: { services: AppServices }) {
  const [view, setView] = useState<View>(parseHash);
  useEffect(() => {
    const on = () => setView(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (v: View) => { const h = toHash(v); if (location.hash !== h) location.hash = h; else setView(v); window.scrollTo(0, 0); };
  const section = SECTION[view.name] ?? view.name;
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => { const on = () => setUpdateReady(true); window.addEventListener('crown-update-ready', on); return () => window.removeEventListener('crown-update-ready', on); }, []);
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
            Works offline · Saves stay on this device · Fictional money only<br />Version {APP_VERSION}
          </div>
        </nav>
        <main className="main" id="main">
          {updateReady && <div className="notice info row" role="status" data-testid="update-ready" style={{ marginBottom: 12, gap: 8 }}>A new version of Crown &amp; Calculation is ready. Your games are saved.<span className="spacer" /><button className="btn small primary" onClick={() => location.reload()}>Reload Now</button></div>}
          {services.readOnly && <div className="notice warn" role="alert" style={{ marginBottom: 12 }}>Crown &amp; Calculation is open in another tab, so this tab is read-only to protect your saves. Close the other tab and reload this one to keep playing here.</div>}
          {!['match', 'watch'].includes(view.name) && <ScreenBoundary key="banner" screen="banner" onHome={() => go({ name: 'play' })}><IdentityBanner /></ScreenBoundary>}
          <ScreenBoundary key={toHash(view)} screen={view.name} onHome={() => go({ name: 'play' })}>
            {view.name === 'play' && <PlayScreen />}
            {view.name === 'match' && <MatchScreen key={view.gameId} gameId={view.gameId} />}
            {view.name === 'analysis' && <AnalysisScreen key={view.gameId} gameId={view.gameId} initialPly={view.ply} />}
            {view.name === 'library' && <LibraryScreen />}
            {view.name === 'analyses' && <AnalysisPicker />}
            {view.name === 'profile' && <ProfileScreen />}
            {view.name === 'lab' && <LabScreen />}
            {view.name === 'academy' && <AcademyScreen />}
            {view.name === 'world' && <WorldScreen />}
            {view.name === 'standings' && <StandingsScreen />}
            {view.name === 'tournaments' && <TournamentsScreen />}
            {view.name === 'competitors' && <CompetitorsScreen />}
            {view.name === 'competitor' && <CompetitorScreen key={view.id} id={view.id} />}
            {view.name === 'watch' && <SpectatorScreen key={view.id} fixtureId={view.id} />}
            {view.name === 'exchange' && <ExchangeScreen key={view.id ?? ''} marketId={view.id} />}
            {view.name === 'finance' && <FinanceScreen />}
            {view.name === 'forecasts' && <ForecastScreen />}
            {view.name === 'news' && <NewsScreen />}
            {view.name === 'rivals' && <RivalsScreen />}
            {view.name === 'hall' && <HallScreen />}
            {view.name === 'heraldry' && <HeraldryScreen />}
            {view.name === 'vault' && <VaultScreen />}
          </ScreenBoundary>
          <CeremonyOverlay />
          <ScreenBoundary key="vault-toast" screen="vault-toast" onHome={() => go({ name: 'play' })}><VaultToast hidden={['match', 'watch', 'vault'].includes(view.name)} /></ScreenBoundary>
          <ScreenBoundary key={'s' + toHash(view)} screen={view.name} onHome={() => go({ name: 'play' })}>{view.name === 'settings' && <SettingsScreen />}</ScreenBoundary>
        </main>
        <nav className="tabbar" aria-label="Main">
          {NAV.filter(n => TABS.includes(n.id)).map(n => (
            <button key={n.id} aria-current={section === n.id ? 'page' : undefined} onClick={() => go({ name: n.id } as View)}>
              <Icon name={n.icon} />{n.label}
            </button>
          ))}
        </nav>
      </div>
    </Ctx.Provider>
  );
}
