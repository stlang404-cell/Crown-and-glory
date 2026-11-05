# v1.0.0 "The Sovereign Legacy" — release-candidate plan

Baseline: v0.11.0 (release commit cc9725d, gate on dfffab6). Global rules of docs/V10_PLAN.md and docs/V11_PLAN.md
remain binding: offline, free, fictional money only, protected iPhone invariants (scrolling, safe areas, updates,
saves), additive tested migrations, no fabricated evidence, no physical-device claims.

## Owner constraints for v1.0
* Preserve every verified v0.11 feature: 16 Circuit Grades × 48 sublevels with current/highest rank, 10,240 AI
  competitors, Exhibition Arena, markets, historical records, Played Like records, all save migrations.
* **Codex isolation:** the shared engine search, evaluation and strength-calibration files are not modified
  without explicit coordination: `src/engine/search.ts`, `src/engine/eval*.ts`, `src/engine/levels.ts`,
  `src/engine/calibration*.json`, `src/engine/styles*.{ts,json}`, `src/federation/profiles.ts`, `src/rules/**`.
  Measurements that only *read* these (benchmarks, matches) are allowed; any proposed change is written as a
  proposal document and patch file, not applied.
* Nothing is merged to `main` or deployed. The release candidate is presented for approval.

## Work packages
| Package | Scope |
|---|---|
| R. Reload robustness | Find and fix the rare slow-reload flake (rating event > 30 s after reload under load), with emphasis on offline PWA cold start: service-worker start, IndexedDB open/upgrade, federation load, analysis queue and scheduler start order; startup budget. |
| S. Qualification fairness | A fair, achievable Championship path for skilled players below ~1,900 at 2,048 and 10,240 without trivialising it; simulate. |
| T. Wealth balance | Club ownership no longer systematically dominant; other paths viable; no runaway; re-simulate. |
| U. Royal visual identity | Palette (royal blue, emerald, amethyst, burgundy, gold, silver), original crests and tournament emblems, polished rank insignias and distinct Federation-title emblems, typography and cards, 390 px layouts; contrast and reduced motion. |
| V. Release readiness | First-run onboarding (optional, replayable tutorials), accessibility audit and fixes (axe-style automated + keyboard), explicit performance budgets measured (startup, transitions, move input, search, pricing, scheduling, saves, replay, roster search, memory), and a game-loop audit of every major screen with fixes for dead ends. |
| W. L2 evidence (integrator) | Engine-vs-engine matches around L2 with the existing bench tools (no file changes); a proposal for a recalibrated L2 rating for Codex/owner approval. |

Then: integration, the full release gate on a clean checkout, v1.0.0-rc.1 build, ZIP and checksums, and a
release-candidate report with verification results and remaining risks.
