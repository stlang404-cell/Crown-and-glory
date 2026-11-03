/** Minimal UCI client for a local Fairy-Stockfish binary (development reference only, never bundled). */
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';

export class UciEngine {
  private proc: ChildProcessWithoutNullStreams;
  private buf = '';
  private waiters: { test: (l: string) => boolean; resolve: (l: string) => void }[] = [];
  lines: string[] = [];
  name = '';
  constructor(path: string) {
    this.proc = spawn(path, [], { stdio: 'pipe' });
    this.proc.stdout.on('data', d => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.lines.push(line);
        if (this.lines.length > 2000) this.lines.splice(0, 1000);
        for (const w of [...this.waiters]) if (w.test(line)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(line); }
      }
    });
  }
  send(cmd: string): void { this.proc.stdin.write(cmd + '\n'); }
  wait(test: (l: string) => boolean): Promise<string> { return new Promise(resolve => this.waiters.push({ test, resolve })); }
  async init(variant = 'losalamos', hashMb = 16): Promise<void> {
    this.send('uci');
    const idLine = await this.wait(l => l.startsWith('id name') );
    this.name = idLine.slice(8);
    await this.wait(l => l === 'uciok');
    this.send(`setoption name UCI_Variant value ${variant}`);
    this.send(`setoption name Hash value ${hashMb}`);
    this.send('setoption name Threads value 1');
    this.send('isready');
    await this.wait(l => l === 'readyok');
  }
  async newGame(): Promise<void> { this.send('ucinewgame'); this.send('isready'); await this.wait(l => l === 'readyok'); }
  /** Returns bestmove and last info line. */
  async go(fen: string, moves: string[], limit: string): Promise<{ bestmove: string; info: string }> {
    this.lines = [];
    this.send(`position fen ${fen}${moves.length ? ' moves ' + moves.join(' ') : ''}`);
    this.send(`go ${limit}`);
    const bm = await this.wait(l => l.startsWith('bestmove'));
    const info = [...this.lines].reverse().find(l => l.startsWith('info') && l.includes(' score ')) ?? '';
    return { bestmove: bm.split(' ')[1], info };
  }
  quit(): void { try { this.send('quit'); } catch { /* ignore */ } setTimeout(() => this.proc.kill(), 200); }
}

export function parseInfoScore(info: string): { cp?: number; mate?: number; depth?: number } {
  const d = /\bdepth (\d+)/.exec(info);
  const cp = /score cp (-?\d+)/.exec(info);
  const mate = /score mate (-?\d+)/.exec(info);
  return { depth: d ? +d[1] : undefined, cp: cp ? +cp[1] : undefined, mate: mate ? +mate[1] : undefined };
}
