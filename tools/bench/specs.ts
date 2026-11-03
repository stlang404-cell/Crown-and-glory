import { crownConfig, crownLevel, fairy, Player } from './players';
import { SearchFeatures } from '../../src/engine/search';

export type Spec =
  | { kind: 'config'; id: string; nodes: number; features?: Partial<SearchFeatures> }
  | { kind: 'level'; level: number; timeCapMs?: number }
  | { kind: 'fairy'; id: string; limit: string };

export function specId(s: Spec): string {
  return s.kind === 'level' ? `crown-L${s.level}` : s.id;
}

export async function makePlayer(s: Spec): Promise<Player> {
  if (s.kind === 'config') return crownConfig(s.id, s.nodes, s.features);
  if (s.kind === 'level') return crownLevel(s.level, s.timeCapMs);
  return fairy(s.id, s.limit);
}
