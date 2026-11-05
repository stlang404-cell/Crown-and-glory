# v1.0.0-rc.1 "The Sovereign Legacy" — release candidate

Release commit: the commit that adds this file (code identical to the gated commit **37434f0**; only docs/evidence
were added after the gate). Built and checked on a 4-core Linux VM in Chromium (Playwright). **Not tested on a
physical iPhone, in Safari/WebKit, or on Windows.**

## What is in it (since v0.11.0)
* **Reload robustness (R):** a navigation during a slow first render was lost (the screen stayed on the old view —
  on a phone, a tab tap doing nothing). Fixed (`subscribeHash` re-reads the route after subscribing); background work
  now starts after the first screen in a fixed order; your own ratings load with the Federation. Forced reproduction
  0/20 → 20/20 (gate: 10/10). docs/evidence/v1.0/reload-flake.md.
* **Crown Path qualification (S, crown-competition-3):** a 1,900 player reaches the Championship in 7/8 (2,048) and
  8/8 (10,240) simulated careers, up from 3/8; 1,200 and 1,500 still never qualify. 1,700 at 10,240: 1/8 (below
  target). Existing worlds switch at their next season start. docs/V3_COMPETITION_RULES.md.
* **Royal visual identity (U):** six palette tokens in every theme, new Emerald & Gold theme, redrawn heraldry,
  tournament motifs, title order star; contrast gate over every painted pair (fixed real v0.11 contrast failures).
* **Release readiness (V):** optional onboarding guide (9 steps, replayable from Settings → Help & Tutorials);
  accessibility 49/48 → 0/0 axe violations at 1366/390 px, keyboard-only play incl. promotion; game-loop fixes;
  performance budgets (docs/PERFORMANCE_BUDGETS.md).
* **Release fixes:** Hall of Fame shows the Sovereign Vault's recorded unlocks (it re-evaluated 8 achievements under
  older rules and could disagree); compact Exchange rows and full-width Games search at 390/375 px; nav check at 375 px.
* **Deferred to the next release:** wealth rebalance (T; validated at 2,048 only — branch
  `worktree-agent-af375a091995e2798`, local), L2 recalibration (proposal only; needs Codex coordination —
  docs/proposals/L2_RECALIBRATION.md).

## Release gate (clean worktree of 37434f0; logs in docs/evidence/v1.0-rc1-gate/)
TypeScript pass · vitest **821/821** · production build + `verify-dist` (1.0.0-rc.1 · 37434f0, 11 precached files) ·
journeys: run, offline, analysis 16, nav-audit 6 (390 px) + nav-audit at **375 px**, motion-sound 11, motion-extra 9,
quick-match 10, vault 15, grimoire, dashboard 11, practice, academy, replay-center 17/17, market-integrity 10,
population 11, legacy 13, new-career 19, federation-career 12, exhibition 18, ranks 27, finance 9, onboarding 17,
a11y strict (0 serious, 1366 + 390 px), startup race 10/10, m6-arena 11/11, **v0.4 save migration 20/20**,
**pages-check** (GitHub Pages subpath, two builds, automatic update with saves kept) — all pass.

## Data safety
Every save change since v0.9 is additive (docs/SAVE_FORMAT.md); no store is deleted or rewritten destructively.
Verified: v0.4 save → current (v5 journey 20/20), update A→B with saves and Exchange positions identical
(pages-check), backups round-trip, existing careers keep their rating base (new careers only start at 0).
The update never clears IndexedDB; only the app's own `crown-…` file caches are replaced.

## Known risks / not done
* No physical iPhone/Safari/Windows test. Phone figures are Chromium with CPU throttling (a proxy).
* Performance budgets still failing on the phone proxy: move input → painted (p95 ~249 ms vs 100), replay step, and
  Federation round advance at 10,240 (p95 ~5.7 s vs 3 s) — playable, but slower than the targets on slow phones.
* Engine strength above ~3,040 is not measured; L2's published rating looks ~115 too high (proposal pending).
* Wealth: club ownership still the strongest non-chess path in this build (rebalance deferred).
* A backup merged into a *different* career that already has games brings learning progress only, not Vault unlocks
  (by design: achievements belong to the career that earned them). Restoring into a fresh profile restores all.
