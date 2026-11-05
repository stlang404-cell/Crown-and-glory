import { crownConfig, crownLevel, crownProfile, fairy, Player } from './players';
import { BEGINNER_LEVELS, ErrorModel } from '../../src/engine/levels';
import { SearchFeatures } from '../../src/engine/search';
import { readFileSync } from 'node:fs';
import { PLAY_WEIGHTS, EvalWeights, Eval3Weights, mergeWeights, EVAL3_WEIGHTS, EVAL4_WEIGHTS } from '../../src/engine/evaluate';
import { paramsFrom, type Eval4Weights } from '../../src/engine/eval4';

export type Spec =
  | { kind: 'config'; id: string; nodes: number; features?: Partial<SearchFeatures>; weights?: Partial<Eval3Weights> | Partial<Eval4Weights>; engine?: 'current' | 'base'; timeMs?: number; ttBits?: number; /** eval-4 parameter JSON (tools/bench/tune output, field params) */ paramsFile?: string; eval?: 'eval3' | 'eval4' }
  | { kind: 'level'; level: number; timeCapMs?: number }
  | { kind: 'fairy'; id: string; limit: string }
  /** v0.10 beginner level by id (L0a…L0d), or an inline crown-error-1 model (pilot runs) */
  | { kind: 'beginner'; id: string }
  | { kind: 'error'; id: string; error: ErrorModel; nodes?: number };

export function specId(s: Spec): string {
  return s.kind === 'level' ? `crown-L${s.level}` : s.kind === 'beginner' ? `crown-${s.id}` : s.id;
}

export async function makePlayer(s: Spec): Promise<Player> {
  if (s.kind === 'config' && s.paramsFile) {
    const params = JSON.parse(readFileSync(s.paramsFile, 'utf8')).params as number[];
    return crownConfig(s.id, s.nodes, s.features, { version: 4, p: paramsFrom(params) }, s.engine ?? 'current', s.timeMs, s.ttBits);
  }
  if (s.kind === 'config' && s.eval) return crownConfig(s.id, s.nodes, s.features, s.eval === 'eval4' ? EVAL4_WEIGHTS : EVAL3_WEIGHTS, s.engine ?? 'current', s.timeMs, s.ttBits);
  if (s.kind === 'config') return crownConfig(s.id, s.nodes, s.features, s.engine === 'base' ? (s.weights ?? {}) as EvalWeights : mergeWeights(PLAY_WEIGHTS, s.weights), s.engine ?? 'current', s.timeMs, s.ttBits);
  if (s.kind === 'level') return crownLevel(s.level, s.timeCapMs);
  if (s.kind === 'beginner') { const p = BEGINNER_LEVELS.find(l => l.id === s.id); if (!p) throw new Error(`unknown beginner level ${s.id}`); return crownProfile(`crown-${p.id}`, p); }
  if (s.kind === 'error') return crownProfile(s.id, { ...BEGINNER_LEVELS[0], id: s.id, nodes: s.nodes ?? BEGINNER_LEVELS[0].nodes, error: s.error });
  return fairy(s.id, s.limit);
}
