/**
 * Regression guard for the v0.8 Analysis blank screen: a useState/useEffect declared after AnalysisScreen's
 * "Loading game…" early return made React throw error #310 ("Rendered more hooks than during the previous render")
 * when the game finished loading, unmounting the whole app. Every hook in src/ must obey the Rules of Hooks.
 */
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

describe('Rules of Hooks', () => {
  it('no component calls a hook conditionally or after an early return', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const results = await eslint.lintFiles(['src/**/*.tsx', 'src/**/*.ts']);
    const problems = results.flatMap(r => r.messages.filter(m => m.ruleId === 'react-hooks/rules-of-hooks').map(m => `${r.filePath}:${m.line} ${m.message}`));
    expect(problems).toEqual([]);
  }, 120000);

  it('the rule catches the original defect', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const src = `import { useState } from 'react';\nexport function A({ g }: { g: unknown }) {\n  const [x] = useState(0);\n  if (!g) return null;\n  const [y] = useState(1);\n  return x + y;\n}\n`;
    const [r] = await eslint.lintText(src, { filePath: 'src/ui/__probe.tsx' });
    expect(r.messages.some(m => m.ruleId === 'react-hooks/rules-of-hooks')).toBe(true);
  });
});
