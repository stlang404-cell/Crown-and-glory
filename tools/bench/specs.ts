import { crownConfig, crownLevel, fairy, Player } from './players';
import { SearchFeatures } from '../../src/engine/search';
import { readFileSync } from 'node:fs';
import { PLAY_WEIGHTS, EvalWeights, Eval3Weights, mergeWeights, EVAL3_WEIGHTS, EVAL4_WEIGHTS } from '../../src/engine/evaluate';
import { paramsFrom, type Eval4Weights } from '../../src/engine/eval4';

export type Spec =
  | { kind: 'config'; id: string; nodes: number; features?: Partial<SearchFeatures>; weights?: Partial<Eval3Weights> | Partial<Eval4Weights>; engine?: 'current' | 'base'; timeMs?: number; ttBits?: number; /** eval-4 parameter JSON (tools/bench/tune output, field params) */ paramsFile?: string; eval?: 'eval3' | 'eval4' }
  | { kind: 'level'; level: number; timeCapMs?: number }
  | { kind: 'fairy'; id: string; limit: string };

export function specId(s: Spec): string {
  return s.kind === 'level' ? `crown-L${s.level}` : s.id;
}

export async function makePlayer(s: Spec): Promise<Player> {
  if (s.kind === 'config' && s.paramsFile) {
    const params = JSON.parse(readFileSync(s.paramsFile, 'utf8')).params as number[];
    return crownConfig(s.id, s.nodes, s.features, { version: 4, p: paramsFrom(params) }, s.engine ?? 'current', s.timeMs, s.ttBits);
  }
  if (s.kind === 'config' && s.eval) return crownConfig(s.id, s.nodes, s.features, s.eval === 'eval4' ? EVAL4_WEIGHTS : EVAL3_WEIGHTS, s.engine ?? 'current', s.timeMs, s.ttBits);
  if (s.kind === 'config') return crownConfig(s.id, s.nodes, s.features, s.engine === 'base' ? (s.weights ?? {}) as EvalWeights : mergeWeights(PLAY_WEIGHTS, s.weights), s.engine ?? 'current', s.timeMs, s.ttBits);
  if (s.kind === 'level') return crownLevel(s.level, s.timeCapMs);
  return fairy(s.id, s.limit);
}
