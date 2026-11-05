import { calculate, replay, type Study } from './core';
import { analyzeGame, ANALYSIS_PRESETS } from '../../src/analysis/analyzer';
self.onmessage = (e: MessageEvent<{ type: 'calculate' | 'review'; study: Study; ply: number; budget: number; count: number; id: number }>) => {
  const { type, study, ply, budget, count, id } = e.data;
  try {
    replay(study);
    if (type === 'calculate') {
      const result = calculate(study, ply, budget, count, snapshot => self.postMessage({ type: 'progress', snapshot, id }));
      self.postMessage({ type: 'result', snapshot: result, id });
    } else {
      const report = analyzeGame({ gameId: 'crownmaster-local', checksum: JSON.stringify(study), initialFen: study.initialFen, setupMoves: study.setupMoves, moves: study.moves }, ANALYSIS_PRESETS[0], { onPly: (row, index, total) => self.postMessage({ type: 'review-progress', row, index, total, id }) });
      self.postMessage({ type: 'review-result', report, id });
    }
  } catch (err) { self.postMessage({ type: 'error', message: (err as Error).message, id }); }
};
