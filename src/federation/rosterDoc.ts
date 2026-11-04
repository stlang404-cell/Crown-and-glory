/** Provenance table and counts for docs/ROSTER.md, generated from rosterIdentities.json (tools/roster/gen-doc.mts). */
import { CATEGORY_LABEL, ROSTER_CATEGORIES, ROSTER_IDENTITIES, ROSTER_REGIONS, lifespan } from './rosterPersonas';

export const DOC_BEGIN = '<!-- roster:generated:begin -->';
export const DOC_END = '<!-- roster:generated:end -->';

const cell = (s: string) => s.replace(/\|/g, '\\|');

export function rosterDocSection(): string {
  const n = ROSTER_IDENTITIES.length;
  const byCat = ROSTER_CATEGORIES.map(c => [CATEGORY_LABEL[c], ROSTER_IDENTITIES.filter(r => r.category === c).length] as const);
  const byReg = ROSTER_REGIONS.map(g => [g, ROSTER_IDENTITIES.filter(r => r.region === g).length] as const);
  const lines: string[] = [DOC_BEGIN, '', `**${n} identities.** Generated from \`src/federation/rosterIdentities.json\` by \`npx tsx tools/roster/gen-doc.mts\`; do not edit by hand.`, ''];
  lines.push('| Category | Identities |', '|---|---:|', ...byCat.map(([k, v]) => `| ${k} | ${v} |`), '');
  lines.push('| Region | Identities |', '|---|---:|', ...byReg.map(([k, v]) => `| ${k} | ${v} |`), '');
  lines.push('### Provenance', '', '| Id | Name | Lifespan | Category | Region | Descriptor | Reference (English Wikipedia title) |', '|---|---|---|---|---|---|---|');
  for (const c of ROSTER_CATEGORIES) {
    for (const r of ROSTER_IDENTITIES.filter(x => x.category === c).sort((a, b) => a.born - b.born || a.name.localeCompare(b.name))) {
      lines.push(`| \`${r.id}\` | ${cell(r.name)} | ${lifespan(r)} | ${CATEGORY_LABEL[r.category]} | ${r.region} | ${cell(r.descriptor)} | ${cell(r.reference)} |`);
    }
  }
  lines.push('', DOC_END);
  return lines.join('\n');
}

/** Replace the generated section of a ROSTER.md text. */
export function withRosterSection(doc: string): string {
  const a = doc.indexOf(DOC_BEGIN), b = doc.indexOf(DOC_END);
  if (a < 0 || b < a) throw new Error('docs/ROSTER.md has no generated section markers');
  return doc.slice(0, a) + rosterDocSection() + doc.slice(b + DOC_END.length);
}
