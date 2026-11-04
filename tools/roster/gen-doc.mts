/** Regenerate the counts and provenance table in docs/ROSTER.md from src/federation/rosterIdentities.json.
 *   npx tsx tools/roster/gen-doc.mts */
import { readFileSync, writeFileSync } from 'node:fs';
import { withRosterSection } from '../../src/federation/rosterDoc';

const path = new URL('../../docs/ROSTER.md', import.meta.url);
writeFileSync(path, withRosterSection(readFileSync(path, 'utf8')));
console.log('docs/ROSTER.md updated');
