import { useApp } from './App';

/** Shared empty state for federation screens opened before the federation exists (never a dead end). */
export function NeedsFederation({ title, detail }: { title?: string; detail?: string }) {
  const { go } = useApp();
  return (
    <div className="panel" data-testid="needs-federation" style={{ maxWidth: 640 }}>
      {title && <h1 style={{ marginTop: 0 }}>{title}</h1>}
      <p>{detail ?? 'This part of the game opens once you found the Federation: 2,048 AI competitors in eight divisions, with leagues, tournaments, rivals and markets.'}</p>
      <p className="small muted">Founding takes a few seconds and gives you a 1,000 ₵ starting grant (fictional money). Your games and ratings so far are kept.</p>
      <button className="btn primary" onClick={() => go({ name: 'world' })}>Go to the Federation</button>
    </div>
  );
}
