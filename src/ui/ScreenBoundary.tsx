import { Component, type ReactNode } from 'react';

/**
 * Contains a rendering failure to the screen it happened on. Without this, one throwing component unmounts the
 * whole app and the player sees a blank page (the v0.8 Analysis defect). Saves are untouched: the failure is in
 * presentation, and the rest of the app (navigation, other screens) keeps working.
 */
export class ScreenBoundary extends Component<{ children: ReactNode; screen: string; onHome: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(`[screen ${this.props.screen}]`, error); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="panel" role="alert" data-testid="screen-error" style={{ maxWidth: 640 }}>
        <h2 style={{ marginTop: 0 }}>This screen could not be shown</h2>
        <p>Something went wrong while drawing this screen. Your saved games, ratings and balances are not affected.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" onClick={() => location.reload()}>Reload</button>
          <button className="btn" onClick={() => { this.setState({ error: null }); this.props.onHome(); }}>Back to Play</button>
        </div>
        <details style={{ marginTop: 12 }}><summary className="small muted">Details</summary><pre className="small" style={{ whiteSpace: 'pre-wrap' }}>{String(error.message || error)}</pre></details>
      </div>
    );
  }
}
