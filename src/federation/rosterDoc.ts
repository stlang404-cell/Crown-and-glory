/** Provenance tables and counts for docs/ROSTER.md, generated from rosterIdentities.json and rosterContemporary.json
 *  (tools/roster/gen-doc.mts). */
import { CATEGORY_LABEL, CONTEMPORARY_IDENTITIES, OWNER_NAMED_CONTEMPORARY, OWNER_NAMED_HISTORICAL, ROSTER_CATEGORIES, ROSTER_IDENTITIES, ROSTER_REGIONS, lifespan } from './rosterPersonas';

export const DOC_BEGIN = '<!-- roster:generated:begin -->';
export const DOC_END = '<!-- roster:generated:end -->';
export const PUB_BEGIN = '<!-- roster:contemporary:begin -->';
export const PUB_END = '<!-- roster:contemporary:end -->';

const cell = (s: string) => s.replace(/\|/g, '\\|');
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function rosterDocSection(): string {
  const n = ROSTER_IDENTITIES.length;
  const byCat = ROSTER_CATEGORIES.map(c => [CATEGORY_LABEL[c], ROSTER_IDENTITIES.filter(r => r.category === c).length] as const);
  const byReg = ROSTER_REGIONS.map(g => [g, ROSTER_IDENTITIES.filter(r => r.region === g).length] as const);
  const owner = new Set(OWNER_NAMED_HISTORICAL);
  const lines: string[] = [DOC_BEGIN, '', `**${n} identities.** Generated from \`src/federation/rosterIdentities.json\` by \`npx tsx tools/roster/gen-doc.mts\`; do not edit by hand. Owner-named people are marked ★.`, ''];
  lines.push('| Category | Identities |', '|---|---:|', ...byCat.map(([k, v]) => `| ${k} | ${v} |`), '');
  lines.push('| Region | Identities |', '|---|---:|', ...byReg.map(([k, v]) => `| ${k} | ${v} |`), '');
  lines.push('### Provenance', '', '| Id | Name | Lifespan | Category | Region | Descriptor | Reference (English Wikipedia title) |', '|---|---|---|---|---|---|---|');
  for (const c of ROSTER_CATEGORIES) {
    for (const r of ROSTER_IDENTITIES.filter(x => x.category === c).sort((a, b) => a.born - b.born || a.name.localeCompare(b.name))) {
      lines.push(`| \`${r.id}\` | ${cell(r.name)}${owner.has(r.name) ? ' ★' : ''} | ${lifespan(r)} | ${CATEGORY_LABEL[r.category]} | ${r.region} | ${cell(r.descriptor)} | ${cell(r.reference)} |`);
    }
  }
  lines.push('', DOC_END);
  return lines.join('\n');
}

export function contemporaryDocSection(): string {
  const xs = CONTEMPORARY_IDENTITIES;
  const living = xs.filter(r => r.living).length;
  const owner = new Set(OWNER_NAMED_CONTEMPORARY);
  const lines: string[] = [PUB_BEGIN, '', `**${xs.length} identities** (${living} living, ${xs.length - living} deceased after 1925, as of compilation). Generated from \`src/federation/rosterContemporary.json\` by \`npx tsx tools/roster/gen-doc.mts\`; do not edit by hand. Owner-named people are marked ★.`, ''];
  const head = ['| Category |', ...ROSTER_REGIONS.map(g => ` ${g} |`), ' Total |'].join('');
  lines.push(head, `|---|${ROSTER_REGIONS.map(() => '---:|').join('')}---:|`);
  for (const c of ROSTER_CATEGORIES) {
    const row = ROSTER_REGIONS.map(g => xs.filter(r => r.category === c && r.region === g).length);
    lines.push(`| ${CATEGORY_LABEL[c]} | ${row.join(' | ')} | ${row.reduce((a, b) => a + b, 0)} |`);
  }
  lines.push(`| **Total** | ${ROSTER_REGIONS.map(g => xs.filter(r => r.region === g).length).join(' | ')} | ${xs.length} |`, '');
  lines.push('### Contemporary provenance', '', '| Id | Name | Living | Category | Region | Descriptor | Reference (English Wikipedia title) |', '|---|---|---|---|---|---|---|');
  for (const c of ROSTER_CATEGORIES) {
    for (const r of xs.filter(x => x.category === c).sort((a, b) => fold(a.name).localeCompare(fold(b.name)))) {
      lines.push(`| \`${r.id}\` | ${cell(r.name)}${owner.has(r.name) ? ' ★' : ''} | ${r.living ? 'yes' : 'no'} | ${CATEGORY_LABEL[r.category]} | ${r.region} | ${cell(r.descriptor)} | ${cell(r.reference)} |`);
    }
  }
  lines.push('', PUB_END);
  return lines.join('\n');
}

function replaceBetween(doc: string, begin: string, end: string, body: string): string {
  const a = doc.indexOf(begin), b = doc.indexOf(end);
  if (a < 0 || b < a) throw new Error(`docs/ROSTER.md has no ${begin} … ${end} section markers`);
  return doc.slice(0, a) + body + doc.slice(b + end.length);
}

/** Replace both generated sections of a ROSTER.md text. */
export function withRosterSection(doc: string): string {
  return replaceBetween(replaceBetween(doc, DOC_BEGIN, DOC_END, rosterDocSection()), PUB_BEGIN, PUB_END, contemporaryDocSection());
}
