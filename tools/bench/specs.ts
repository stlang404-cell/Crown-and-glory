import { crownConfig, crownLevel, fairy, Player } from './players';
import { SearchFeatures } from '../../src/engine/search';
import { DEFAULT_WEIGHTS, EvalWeights } from '../../src/engine/evaluate';

export type Spec =
  | { kind: 'config'; id: string; nodes: number; features?: Partial<SearchFeatures>; weights?: Partial<EvalWeights> }
  | { kind: 'level'; level: number; timeCapMs?: number }
  | { kind: 'fairy'; id: string; limit: string };

export function specId(s: Spec): string {
  return s.kind === 'level' ? `crown-L${s.level}` : s.id;
}

export async function makePlayer(s: Spec): Promise<Player> {
  if (s.kind === 'config') return crownConfig(s.id, s.nodes, s.features, { ...DEFAULT_WEIGHTS, ...(s.weights ?? {}) });
  if (s.kind === 'level') return crownLevel(s.level, s.timeCapMs);
  return fairy(s.id, s.limit);
}
