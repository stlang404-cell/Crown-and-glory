/**
 * Release check run by .github/workflows/deploy-pages.yml after the build (and usable locally):
 *   node scripts/verify-dist.mjs [dist]
 * Fails (exit 1) unless: dist/sw.js exists and every PRECACHE entry exists in dist; dist/version.json matches
 * package.json's version (and GITHUB_SHA's short form when set); the manifest's start_url and scope are './'.
 * Prints "version <v> commit <c> built <t>" on success (also appended to $GITHUB_STEP_SUMMARY in CI).
 */
import { existsSync, readFileSync, appendFileSync, statSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const problems = [];
const read = f => readFileSync(path.join(dist, f), 'utf8');
const exists = f => { const p = path.join(dist, f); return existsSync(p) && (statSync(p).isFile() || existsSync(path.join(p, 'index.html'))); };

let precache = [];
if (!exists('sw.js')) problems.push('dist/sw.js is missing');
else {
  const m = read('sw.js').match(/const PRECACHE = (\[.*?\]);/s);
  if (!m) problems.push('dist/sw.js has no PRECACHE list');
  else {
    precache = JSON.parse(m[1]);
    for (const f of precache) if (!exists(f === './' ? 'index.html' : f)) problems.push(`precache entry missing from dist: ${f}`);
    if (precache.includes('version.json')) problems.push('version.json must not be precached');
  }
}

// The repository's package.json (next to scripts/), so a build output outside the repo is checked too.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let v = null;
if (!exists('version.json')) problems.push('dist/version.json is missing');
else {
  v = JSON.parse(read('version.json'));
  if (v.version !== pkg.version) problems.push(`version.json version ${v.version} != package.json ${pkg.version}`);
  if (process.env.GITHUB_SHA && v.commit !== process.env.GITHUB_SHA.slice(0, 7)) problems.push(`version.json commit ${v.commit} != GITHUB_SHA ${process.env.GITHUB_SHA.slice(0, 7)}`);
  if (!v.builtAt || Number.isNaN(Date.parse(v.builtAt))) problems.push('version.json builtAt is not a date');
  if (exists('sw.js') && !read('sw.js').includes(JSON.stringify(v))) problems.push('sw.js was not generated from the same build identity as version.json');
}

if (!exists('manifest.webmanifest')) problems.push('dist/manifest.webmanifest is missing');
else {
  const man = JSON.parse(read('manifest.webmanifest'));
  if (man.start_url !== './') problems.push(`manifest start_url is ${JSON.stringify(man.start_url)}, expected "./"`);
  if (man.scope !== './') problems.push(`manifest scope is ${JSON.stringify(man.scope)}, expected "./"`);
}

if (problems.length) {
  console.error('Release check FAILED:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
const line = `Crown & Calculation version ${v.version} · commit ${v.commit} · built ${v.builtAt} · ${precache.length} precached files verified`;
console.log('Release check passed: ' + line);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Build verified: ${line}\n`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${v.version}\ncommit=${v.commit}\nbuilt=${v.builtAt}\n`);
