# Bug-fix register

Defects found while verifying v0.5 → v0.7 ("Grandmaster Polish"), with severity, root cause, fix and evidence.
Severity: **High** = wrong results, lost data or money, or a blocked core flow; **Medium** = wrong or misleading
behaviour with a workaround; **Low** = presentation.

| # | Severity | Area | Defect | Root cause | Fix | Evidence |
|---|---|---|---|---|---|---|
| 1 | High | Save / launcher | A second launch while port 5173 was busy silently opened a new port, so the career looked empty (browsers keep saves per address). | `scripts/serve.mjs` / `Start-Crown.ps1` took the next free port without checking. | The launcher detects a running Crown & Calculation and opens it; a forced port change prints a loud warning. | Manual test of both paths (Linux); PowerShell path NOT RUN on Windows. |
| 2 | High | Analysis | A game with a complete report from an older engine could never be re-analysed with the current one. | Analysis jobs were keyed by game + preset only. | Jobs and "already analysed" checks include the engine build and grading version. | `e2e/v5-journey.mjs` step 6a. |
| 3 | High | Markets / Arena | A quote taken before a live move could still execute after the move if no NPC had traded in between. | The stale-quote check compared the trade count only. | Market revision = trades + published moves; trades carry `expectRevision`; duplicate steps rejected. | `tests/arena.test.ts`; `e2e/m6-arena.mjs` steps 3–4b. |
| 4 | Medium | Analysis grading | A Mistake/Blunder could rest on one search depth (a shallow miss of the move's purpose). | No deeper confirmation for errors (only for Brilliant). | Grading v3 confirms Mistakes and Blunders with a deeper search and only ever softens the label. | `tests/grading.audit.test.ts`; v3 grade corpus. |
| 5 | Medium | Economy balance | Owning a club lost money in every simulated seed. | Club income (Club Weekend only) was below upkeep by design; tools (scouting/analyst/training) have no revenue. | Clubs earn membership dues by how they are run (crown-club-appeal-1), as transfers between existing accounts. | Economy sweep before/after (docs/GRANDMASTER_POLISH.md). |
| 6 | Medium | Performance | Advancing a round spent most of its time recomputing full league tables inside market models (300–400 simulations × 16 leagues). | Full tiebreak ordering computed even when the leader was unique. | Exact fast path (points by array; full order only on ties); results identical, a season ~2× faster. | Byte-identical simulation output before/after. |
| 7 | Medium | Accessibility | Decorative piece images were announced as unlabelled images; icon-only buttons had no names. | `role="img"` without labels; buttons containing only SVG. | Decorative SVGs hidden; icon buttons labelled; icons accept titles. | `e2e/v5-journey.mjs` step 28. |
| 8 | Medium | Contrast | Two premium boards failed square/coordinate/piece contrast. | Palette values. | Palettes retuned; contrast audit passes. | `node tools/contrast/check-themes.mjs`. |
| 9 | Low | Copy | Internal identifiers (engine builds, grading ids, calibration ids, market revisions, policy ids) and developer wording on gameplay screens; mixed capitalisation. | Development-era text. | Edited to docs/STYLE_GUIDE.md; technical detail moved to Details / Settings → Advanced. | Before/after screenshots. |
| 10 | Low | Copy | Opponent bio said L7 used "one million nodes" (it uses 30,000). | Stale text. | Corrected. | `src/federation/roster.ts`. |
| 11 | Low | Test harness | Async predicates in `waitForFunction` did not wait; a stale server from a crashed run could be tested instead of the new build; ceremonies blocked an older journey. | Harness assumptions. | Polling helper; journeys refuse a pre-existing server; older journey dismisses ceremonies like a player. | Journeys pass on the final build. |

Not reproduced in this pass (searched for, none found): illegal engine moves (0 in the ~650 benchmark games and all journey games
run in this pass), incorrect promotions, duplicate rewards or ceremonies, negative balances, ledger imbalance (every simulated
season conserved), rating double-updates, save corruption on restart, migration loss from v0.3.0/v0.4.0 saves,
offline asset gaps (offline journeys pass), horizontal overflow at 390 px.
