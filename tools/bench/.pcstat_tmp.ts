import { pawnCacheStats } from '../../src/engine/eval4';
await import('./speed_probe');
const s = pawnCacheStats(); console.log(s, (s.hits / s.probes).toFixed(3));
