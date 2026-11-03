import { buildOpenings } from './openings';
buildOpenings().then(o => { console.log('openings', o.length); process.exit(0); });
