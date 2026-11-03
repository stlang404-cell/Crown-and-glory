/**
 * Main-thread engine client. One worker per role (play / analysis) so a long analysis never delays
 * the opponent's move. Cancellation terminates the worker and bumps the generation; late replies
 * from terminated or superseded requests are discarded.
 */
import type { MoveRequest, AnalyzeRequest, AssistRequest, AssistCandidate, SelfplayRequest, WorkerReply } from './protocol';
import type { AnalysisReport, PlyAnalysis } from '../analysis/types';

type MoveResult = Extract<WorkerReply, { type: 'move-result' }>;

export type WorkerFactory = () => Worker;
export const defaultFactory: WorkerFactory = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export class CancelledError extends Error { constructor() { super('cancelled'); } }

/** Engine events across all channels (crown-engine-events-1), newest last, bounded. Shown in Settings. */
export interface EngineEvent { at: number; role: string; requestId: string; generation: number; kind: string; event: 'start' | 'done' | 'cancelled' | 'stale-discarded' | 'error' | 'crash'; ms?: number; detail?: string }
export const ENGINE_EVENTS: EngineEvent[] = [];
const MAX_EVENTS = 300;
function logEvent(e: EngineEvent): void { ENGINE_EVENTS.push(e); if (ENGINE_EVENTS.length > MAX_EVENTS) ENGINE_EVENTS.splice(0, ENGINE_EVENTS.length - MAX_EVENTS); }
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class EngineChannel {
  private worker: Worker | null = null;
  private generation = 0;
  private pending: { id: string; gen: number; kind: string; t0: number; resolve: (r: WorkerReply) => void; reject: (e: unknown) => void; onPly?: (p: PlyAnalysis, i: number, n: number) => void; onMove?: (m: Extract<WorkerReply, { type: 'selfplay-move' }>) => void } | null = null;
  private seq = 0;
  constructor(private factory: WorkerFactory = defaultFactory, readonly role = 'engine') {}

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = this.factory();
    w.onmessage = (ev: MessageEvent<WorkerReply>) => {
      const m = ev.data;
      const p = this.pending;
      if (!p || m.requestId !== p.id || m.generation !== p.gen) { // stale reply: discard
        if (m.type !== 'progress' && m.type !== 'ply' && m.type !== 'selfplay-move') logEvent({ at: Date.now(), role: this.role, requestId: m.requestId, generation: m.generation, kind: m.type, event: 'stale-discarded' });
        return;
      }
      if (m.type === 'ply') { p.onPly?.(m.ply, m.index, m.total); return; }
      if (m.type === 'selfplay-move') { p.onMove?.(m); return; }
      if (m.type === 'progress') return;
      this.pending = null;
      logEvent({ at: Date.now(), role: this.role, requestId: p.id, generation: p.gen, kind: p.kind, event: m.type === 'error' ? 'error' : 'done', ms: Math.round(nowMs() - p.t0), detail: m.type === 'error' ? m.message : undefined });
      if (m.type === 'error') p.reject(new Error(m.message)); else p.resolve(m);
    };
    w.onerror = ev => {
      const p = this.pending;
      this.pending = null;
      this.terminate();
      if (p) logEvent({ at: Date.now(), role: this.role, requestId: p.id, generation: p.gen, kind: p.kind, event: 'crash', ms: Math.round(nowMs() - p.t0), detail: ev.message });
      p?.reject(new Error(`Engine worker crashed: ${ev.message}`));
    };
    this.worker = w;
    return w;
  }

  get busy(): boolean { return this.pending !== null; }

  private send<T extends WorkerReply>(req: Omit<MoveRequest, 'requestId' | 'generation'> | Omit<AnalyzeRequest, 'requestId' | 'generation'> | Omit<AssistRequest, 'requestId' | 'generation'> | Omit<SelfplayRequest, 'requestId' | 'generation'>, onPly?: (p: PlyAnalysis, i: number, n: number) => void, onMove?: (m: Extract<WorkerReply, { type: 'selfplay-move' }>) => void): Promise<T> {
    if (this.pending) this.cancel();
    const gen = ++this.generation;
    const id = `${this.role}-${++this.seq}`;
    const w = this.ensure();
    return new Promise<T>((resolve, reject) => {
      this.pending = { id, gen, kind: req.type, t0: nowMs(), resolve: resolve as (r: WorkerReply) => void, reject, onPly, onMove };
      logEvent({ at: Date.now(), role: this.role, requestId: id, generation: gen, kind: req.type, event: 'start' });
      w.postMessage({ ...req, requestId: id, generation: gen });
    });
  }

  move(req: Omit<MoveRequest, 'type' | 'requestId' | 'generation'>): Promise<MoveResult> {
    return this.send<MoveResult>({ type: 'move', ...req });
  }

  selfplay(req: Omit<SelfplayRequest, 'type' | 'requestId' | 'generation'>, onMove?: (m: Extract<WorkerReply, { type: 'selfplay-move' }>) => void): Promise<Extract<WorkerReply, { type: 'selfplay-result' }>> {
    return this.send<Extract<WorkerReply, { type: 'selfplay-result' }>>({ type: 'selfplay', ...req }, undefined, onMove);
  }

  async assist(req: Omit<AssistRequest, 'type' | 'requestId' | 'generation'>): Promise<{ candidates: AssistCandidate[]; depth: number }> {
    const r = await this.send<Extract<WorkerReply, { type: 'assist-result' }>>({ type: 'assist', ...req });
    return { candidates: r.candidates, depth: r.depth };
  }

  async analyze(req: Omit<AnalyzeRequest, 'type' | 'requestId' | 'generation'>, onPly?: (p: PlyAnalysis, i: number, n: number) => void): Promise<AnalysisReport> {
    const r = await this.send<Extract<WorkerReply, { type: 'analysis-result' }>>({ type: 'analyze', ...req }, onPly);
    return r.report;
  }

  /** Immediate cancellation: the worker is terminated (search is synchronous) and recreated lazily. */
  cancel(): void {
    const p = this.pending;
    this.pending = null;
    this.generation++;
    const t = nowMs();
    this.terminate();
    if (p) logEvent({ at: Date.now(), role: this.role, requestId: p.id, generation: p.gen, kind: p.kind, event: 'cancelled', ms: Math.round(nowMs() - t), detail: `after ${Math.round(t - p.t0)} ms` });
    p?.reject(new CancelledError());
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
