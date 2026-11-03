import { parentPort } from 'node:worker_threads';
import { makePlayer, Spec } from './specs';
import { playGame } from './match';

parentPort!.on('message', async (job: { id: number; white: Spec; black: Spec; opening: string[]; seed: number }) => {
  try {
    const w = await makePlayer(job.white);
    const b = await makePlayer(job.black);
    const g = await playGame(w, b, job.opening, job.seed);
    w.close(); b.close();
    parentPort!.postMessage({ id: job.id, game: g });
  } catch (e) {
    parentPort!.postMessage({ id: job.id, error: String(e) });
  }
});
