/**
 * Main-thread engine client. One worker per role (play / analysis) so a long analysis never delays
 * the opponent's move. Cancellation terminates the worker and bumps the generation; late replies
 * from terminated or superseded requests are discarded.
 */
import type { MoveRequest, AnalyzeRequest, WorkerReply } from './protocol';
import type { AnalysisReport, PlyAnalysis } from '../analysis/types';

type MoveResult = Extract<WorkerReply, { type: 'move-result' }>;

export type WorkerFactory = () => Worker;
export const defaultFactory: WorkerFactory = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export class CancelledError extends Error { constructor() { super('cancelled'); } }

export class EngineChannel {
  private worker: Worker | null = null;
  private generation = 0;
  private pending: { id: string; gen: number; resolve: (r: WorkerReply) => void; reject: (e: unknown) => void; onPly?: (p: PlyAnalysis, i: number, n: number) => void } | null = null;
  private seq = 0;
  constructor(private factory: WorkerFactory = defaultFactory, readonly role = 'engine') {}

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = this.factory();
    w.onmessage = (ev: MessageEvent<WorkerReply>) => {
      const m = ev.data;
      const p = this.pending;
      if (!p || m.requestId !== p.id || m.generation !== p.gen) return; // stale reply: discard
      if (m.type === 'ply') { p.onPly?.(m.ply, m.index, m.total); return; }
      if (m.type === 'progress') return;
      this.pending = null;
      if (m.type === 'error') p.reject(new Error(m.message)); else p.resolve(m);
    };
    w.onerror = ev => {
      const p = this.pending;
      this.pending = null;
      this.terminate();
      p?.reject(new Error(`Engine worker crashed: ${ev.message}`));
    };
    this.worker = w;
    return w;
  }

  get busy(): boolean { return this.pending !== null; }

  private send<T extends WorkerReply>(req: Omit<MoveRequest, 'requestId' | 'generation'> | Omit<AnalyzeRequest, 'requestId' | 'generation'>, onPly?: (p: PlyAnalysis, i: number, n: number) => void): Promise<T> {
    if (this.pending) this.cancel();
    const gen = ++this.generation;
    const id = `${this.role}-${++this.seq}`;
    const w = this.ensure();
    return new Promise<T>((resolve, reject) => {
      this.pending = { id, gen, resolve: resolve as (r: WorkerReply) => void, reject, onPly };
      w.postMessage({ ...req, requestId: id, generation: gen });
    });
  }

  move(req: Omit<MoveRequest, 'type' | 'requestId' | 'generation'>): Promise<MoveResult> {
    return this.send<MoveResult>({ type: 'move', ...req });
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
    this.terminate();
    p?.reject(new CancelledError());
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
