/** Every board in the rulebook and The Sovereign's Grimoire must pass the position checker (legal positions, legal
 *  lines with correct +/# marks, exhaustively proven mate claims, engine-policy best moves, real puzzle references). */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

describe('Grimoire positions', () => {
  it.runIf(existsSync('docs/grimoire') || existsSync('docs/RULEBOOK.md'))('all positions and claims check out', () => {
    const r = spawnSync('npx', ['tsx', 'tools/grimoire/check.ts'], { encoding: 'utf8', timeout: 900_000 });
    const tail = (r.stdout ?? '').trim().split('\n').slice(-15).join('\n');
    expect(r.status, tail).toBe(0);
  }, 900_000);
});
