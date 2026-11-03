/**
 * Development probe (M4 assessment only): run the Fairy-Stockfish WASM npm build (fairy-stockfish-nnue.wasm,
 * GPL-3.0, never bundled) in Node and the native reference build on the same positions with `go nodes N`
 * and report nodes/s, so the WASM speed can be compared with native Fairy-Stockfish and the Crown engine.
 *   FAIRY_WASM_DIR=<unpacked package dir> FAIRY_STOCKFISH=<native binary> npx tsx tools/bench/wasm_speed.ts [nodes]
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import os from 'node:os';

const nodes = +(process.argv[2] ?? 2_000_000);
const FENS = [
  'rnqknr/pppppp/6/6/PPPPPP/RNQKNR w - - 0 1',
  'r1qk1r/pp1ppp/2n1n1/2p3/PPPPPP/RNQKNR w - - 0 4',
  '2rk2/1q3p/p1n3/3N2/PP1Q1P/3K1R w - - 0 20',
];

function engine(cmd: string, args: string[]) {
  const proc = spawn(cmd, args, { stdio: 'pipe' });
  proc.stderr.on('data', d => process.stderr.write(d));
  proc.on('exit', c => { if (process.env.DEBUG) console.error('engine exited', c); });
  let buf = '';
  const lines: string[] = [];
  let waiter: { test: (l: string) => boolean; resolve: (l: string) => void } | null = null;
  proc.stdout.on('data', d => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); lines.push(l);
      if (process.env.DEBUG) console.error('>', l.slice(0, 100));
      if (waiter && waiter.test(l)) { const w = waiter; waiter = null; w.resolve(l); }
    }
  });
  const send = (c: string) => proc.stdin.write(c + '\n');
  const wait = (test: (l: string) => boolean) => new Promise<string>(resolve => { waiter = { test, resolve }; });
  return { proc, lines, send, wait };
}

async function measure(name: string, cmd: string, args: string[]) {
  const t0 = Date.now();
  const e = engine(cmd, args);
  e.send('uci'); await e.wait(l => l === 'uciok');
  e.send('setoption name UCI_Variant value losalamos'); e.send('setoption name Threads value 1'); e.send('setoption name Hash value 16');
  e.send('isready'); await e.wait(l => l === 'readyok');
  const startupMs = Date.now() - t0;
  const rows: { fen: string; nps: number; depth: number; ms: number }[] = [];
  for (const fen of FENS) {
    e.send('ucinewgame'); e.send('isready'); await e.wait(l => l === 'readyok');
    e.lines.length = 0;
    const t = Date.now();
    e.send(`position fen ${fen}`); e.send(`go nodes ${nodes}`);
    await e.wait(l => l.startsWith('bestmove'));
    const ms = Date.now() - t;
    const info = [...e.lines].reverse().find(l => l.startsWith('info') && l.includes(' nps ')) ?? '';
    rows.push({ fen, nps: +(/ nps (\d+)/.exec(info)?.[1] ?? 0), depth: +(/ depth (\d+)/.exec(info)?.[1] ?? 0), ms });
  }
  e.send('quit');
  setTimeout(() => e.proc.kill(), 300);
  console.log(name, 'startup', startupMs, 'ms', JSON.stringify(rows));
  return { name, startupMs, rows };
}

const out = [];
// The 2021 Emscripten loader prefers fetch() when defined; Node ≥ 18 defines fetch but cannot fetch a file
// path, so the probe removes it and the loader reads the .wasm through fs.
const shim = `delete globalThis.fetch;
const Stockfish = require(${JSON.stringify(`${process.env.FAIRY_WASM_DIR}/stockfish.js`)});
Stockfish().then(sf => {
  sf.addMessageListener(line => process.stdout.write(line + '\\n'));
  const rl = require('readline').createInterface({ input: process.stdin });
  rl.on('line', cmd => { if (cmd === 'quit') { sf.postMessage('quit'); setTimeout(() => process.exit(0), 100); } else sf.postMessage(cmd); });
});`;
if (process.env.FAIRY_WASM_DIR) out.push(await measure('wasm-node', process.execPath, ['-e', shim]));
if (process.env.FAIRY_STOCKFISH) out.push(await measure('native', process.env.FAIRY_STOCKFISH, []));
writeFileSync('tools/bench/results/wasm-speed.json', JSON.stringify({ env: { node: process.version, cpu: os.cpus()[0]?.model, load: os.loadavg(), date: new Date().toISOString() }, nodes, out }, null, 1));
process.exit(0);
