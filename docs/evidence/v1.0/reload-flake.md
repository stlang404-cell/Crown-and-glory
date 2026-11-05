# Slow / missing rating event after a reload (v1.0 package R)

**Symptom (v0.11 package Q, docs/evidence/v0.11/bottom-gap.md).** In 1 of 12 runs of `e2e/new-career.mjs`, 4 in
parallel at load average 7–10, the step "reload keeps it" timed out: after `page.reload()` →
`waitForFunction(__crown)` → `goto('#/profile')`, `[data-testid="rating-event"]` was not visible within 30 s.

All measurements: Chromium (Playwright headless shell 1243) on a shared 4-core VM whose load from other sessions varied
between 1 and 35 during the work; production builds served by `scripts/serve.mjs`. **A proxy for, not a measurement of,
an iPhone** (no WebKit, no physical device). To keep the background load fair, every before/after comparison
alternates the two builds run by run in one harness (`e2e/startup.mjs URL_A URL_B --labels before,after`).

* **before** = v0.11 base (0b10f79) plus measurement-only startup marks (`src/app/startup.ts`), no behaviour change;
* **after** = this package.

## 1. Reproduction

`e2e/startup.mjs --mode reload` replays exactly the journey's moment: a fresh career plays a rated rapid game against
the L0c beginner (the scripted robot of e2e/new-career.mjs), the page reloads at once (the game's background analysis
is running; the reload lands on `#/match/<id>`), then `goto('#/profile')` and wait for the rating event (120 s, so the
tail is measured instead of cut off). Every run is a fresh browser profile; CPU throttling via CDP
`Emulation.setCPUThrottlingRate` 1×/4×/6× (verified: a 33 ms loop takes 122–140 ms at 4×, across reloads).

| Runs (before) | Conditions | Result |
|---|---|---|
| 12 | 4 in parallel, ×1/×4/×6, load ≈ 4 | 12/12 visible; in page 0.9–3.5 s |
| 24 | 6 in parallel + 3 CPU burners, load 14 | **23/24**; run 23 (×6): rating event **never** visible (120 s) |
| 24 + 24 (A/B) | 6 in parallel + 2 burners, load ≈ 30 | before 24/24, after 24/24 (a rare event at random timing; see §2A for the deterministic reproduction) |

The failing run's timeline (ms since the reloaded page's navigation start, startup marks + a MutationObserver):
`render:start 960` (boot done, `root.render()` called, `__crown` set just before it) → the test's hash change to
`#/profile` at **1,069** → no `current-rating` and no `rating-event` ever: the page stayed on the **match screen**
with `location.hash === '#/profile'`. Boot, IndexedDB and the analysis queue all ran normally (vault 1.9–3.9 s,
legacy 3.9–4.4 s, analysis job at 977 ms). No page error.

## 2. Root causes

### A. Lost navigation (the > 30 s / never case)
`App` read the hash in `useState(parseHash)` during its first render but subscribed to `hashchange` in a passive
effect (`useEffect`), which React runs after the commit — on a loaded or slow device, tens to hundreds of ms later.
A hash change in that window dispatches its event to nobody: the view never updates until the next navigation.
`window.__crown` is assigned right before `root.render()`, so a test that navigates as soon as `__crown` exists hits
exactly that window whenever the first render (here the heavy match screen at ×6) is slow. A real user hits it with a
tap on the tab bar (or a deep link/hash change) during a slow first render — the tap "does nothing".

**Deterministic reproduction** (`e2e/startup.mjs --mode race`: an init script moves the hash to `#/profile` right
after `<App>`'s first commit, before its effects run):

| Build | Career Passport shown |
|---|---|
| before | **0/20** (hash `#/profile`, Play screen still shown) — and 0/5, 0/20 in two earlier batches |
| after | **20/20** (and 5/5, 20/20) |

### B. Contention that stretches the window and the time to the player's own data
Measured with the startup marks on the populated career (§4) and the reload scenario:
1. **Every analysed move bumped the app-wide revision** (`notify()` per ply): every open screen re-ran its record
   loads several times a second while the reloaded game's analysis restarted — the Career Passport re-read
   ratings, games, reports, Academy attempts and runs (sequentially, without cancellation) per move.
2. **Background work started on fixed timers, not after the first screen**: analysis queue before the first render,
   Vault (crown-vault-2 back-fill) at boot + 0.8 s, Played Like back-fill + 1.2 s, live scheduler and reopen catch-up
   + 1.5 s — under load these ran while the first screen was still loading its data (e.g. legacy evaluation
   0.65–2.5 s overlapping the Passport's reads at ×1 under load).
3. **The Passport's own data came last**: its rating states and ledger were read only after the first render, behind
   the identity banner's and the background steps' reads.
4. **Federation load before the first render dominates a populated cold start**: 10,883 competitors (22 chunks,
   ≈ 8 MB), rounds 3.4 MB, journal 1.6 MB after two seasons. At ×6 the reads take ≈ 1.4–1.7 s and the competitor
   decode ≈ 0.7 s (one ≈ 1.2–1.4 s long task) before anything renders. The journal values were read only to collect
   their ids.
Not a cause (checked): IndexedDB open/upgrade (no upgrade on reload; median 0.05–0.3 s, up to 2 s only under load average > 14, the same in both builds), the Web Lock (every reload run
recorded `writerLease: held`), service-worker activation (offline cold starts served by the worker in 100% of runs).

## 3. Fix

| Cause | Change |
|---|---|
| A | `src/ui/route.ts` `subscribeHash()`: subscribe to `hashchange`, **then re-read the hash once**; an unchanged route keeps the same view object (no extra render). App uses it. |
| B1 | Analysis progress has its own channel (`services.subscribeProgress`, `useAnalysisProgress()` in the five screens that show it); per-move updates no longer change `services.revision`. |
| B1 | `src/app/reloader.ts` `RecordsReloader` for the Career Passport: loads at once; afterwards only when a cheap change key (record counts) moves; never two loads at once (coalesced, newest data last; a notification stream cannot starve a load); nothing applied after unmount. |
| B2 | `src/app/backgroundStart.ts`: one ordered queue — analysis queue → Vault → legacy → Played Like back-fill → live scheduler/catch-up — that starts only after the first screen has been committed **and painted**, then a quiet second; each step waits for an idle moment (`requestIdleCallback`, 1 s deadline) and until no screen is loading its records (bounded 3 s). Idempotent steps; a fallback starts it after 4 s if no UI reports. Stopped by Start New Career. |
| B3 | The player's rating states + ledger are read in one transaction **in parallel with the Federation load** (`db.careerRatings()`), so the Passport's first render already lists the rating events; the Passport then loads the rest (games, reports, Academy) in parallel. |
| B4 | The Federation journal is loaded as keys only (`getAllKeys`), same state. The competitor decode itself is unchanged (save format; see "Remaining"). |
| UX | `index.html` shows "Crown & Calculation · opening your saved career…" until the first screen replaces it (a cold iPhone start no longer shows a blank page during the Federation load). |

Deterministic and safe: the step order is fixed; every back-fill is put-if-absent / idempotent; the queue writes
nothing itself; a reload in the middle loses nothing (unit test: Played Like back-fill killed after 4 of 10 writes →
next start completes all 10, the 4 earlier records unchanged, trophies not duplicated, rating ledger and game checksums
untouched).

## 4. Before / after

### Reload-visibility (fresh career, reload during the analysis)
A/B, 24 runs per build, 6 in parallel + 2 CPU burners, machine load ≈ 30 (other sessions), ms. Build "after" here is
the intermediate build (fix A + progress channel + reloader + background queue; before the boot read of the ratings,
the foreground gate and the quiet second). In-page time = since the reloaded page's navigation start.

| CPU | before: visible | after: visible | before: hash change → events p95 | after |
|---|---|---|---|---|
| ×1 | 24/24 · median 3,039 · p95 4,161 | 24/24 · median 2,941 · p95 7,828 | 533 | 1,353 |
| ×4 | median 3,443 · p95 5,315 | median 3,252 · p95 5,013 | 669 | 2,597 |
| ×6 | median 4,158 · p95 8,610 | median 4,425 · p95 9,314 | 4,281 | 4,790 |

At this load the fresh-career numbers are dominated by the machine (the slowest after-runs had the legacy/Vault
evaluation running while the Passport loaded — which is what the foreground gate and the boot read added afterwards
address; their effect is measured in the budget table below). The decisive result for this scenario is the
deterministic race in §2A (before 0/20, after 20/20); in this random-timing batch neither build lost a reload (24/24 each).

### Startup budgets (populated career)
Fixture (built per origin by `e2e/startup.mjs`): Federation founded through the UI at the default size, two full
seasons simulated (featured engine games stubbed as in e2e/ranks.mjs; the live scheduler ran real engine games),
**10,882–10,889 competitors**, 12 rated games won by the robot with their 12 analysis reports, Vault and legacy
back-filled; copied into a fresh browser profile for every run. Per run: cold online (new browser process, service
worker installed) → Dashboard; cold online → Career Passport; warm reloads of both; offline cold (new browser,
network off) → Dashboard and → Passport. *visible* = first frame with `[data-testid=dashboard]` /
`[data-testid=rating-event]`, ms since navigation start; *interactive* = visible and then 500 ms without a long task.
20 runs per build per configuration, 2 at a time, builds alternating.

**Desktop 1366 px, CPU ×1 — final build** (load 7–9), ms, median / p95:

| Start | Dashboard visible: before → after | Dashboard interactive | Passport rating events visible | Passport interactive |
|---|---|---|---|---|
| cold online | 769 / 1,171 → **673 / 876** | 769 / 1,650 → **687 / 879** | 1,201 / 1,370 → **774 / 916** | 1,385 / 1,667 → **1,071 / 1,176** |
| warm reload | 582 / 684 → **518 / 600** | 586 / 774 → **540 / 728** | 938 / 1,095 → **707 / 792** | 1,016 / 1,253 → **855 / 1,070** |
| offline cold | 723 / 790 → **667 / 833** | 723 / 1,007 → **710 / 894** | 1,074 / 1,385 → **756 / 901** | 1,358 / 1,626 → **1,037 / 1,257** |

**390 px touch, CPU ×4 and ×6 — intermediate build** (the final-build ×4/×6 batch was stopped when the release was
called; these runs had load 14–22 and lack the boot read of the ratings and the quiet second, so they understate the
Passport gain shown at ×1), ms, median / p95:

| Start | ×4 Dashboard interactive | ×4 Passport interactive | ×6 Dashboard interactive | ×6 Passport interactive |
|---|---|---|---|---|
| cold online | 3,875 / 6,426 → 5,222 / 6,859 | 7,011 / 9,089 → 6,701 / 8,868 | 4,638 / 8,220 → 4,884 / 8,534 | 9,700 / 12,544 → **7,546 / 10,820** |
| warm reload | 3,342 / 5,263 → 3,324 / 4,826 | 5,532 / 7,744 → 5,149 / 7,181 | 3,758 / 6,436 → 3,995 / 6,318 | 5,951 / 9,390 → **5,913 / 6,824** |
| offline cold | 5,112 / 6,441 → 4,294 / 6,190 | 7,776 / 9,683 → 5,929 / 7,886 | 4,173 / 7,752 → 4,214 / 7,086 | 9,583 / 11,878 → **7,493 / 9,630** |

Phase medians (cold Dashboard, final ×1 / intermediate ×6, ms since navigation start): script start 320–331 / 974–993,
IndexedDB open done 373–380 / 1,253–1,256, Federation stores read 714–832 / 2,610–2,914, competitors decoded
876–993 / 3,266–3,702, first render 925–1,072 / 3,624–3,889. The Dashboard's interactive time at ×4/×6 is bounded
by the Federation load (§5), which this package does not change beyond the journal keys.

## 5. Remaining (not fixed here)
* The Federation load still precedes the first render: at ×6 ≈ 2.2–2.5 s of a ≈ 3.5–4 s cold start is reading and
  decoding the competitor chunks (one ≈ 1.2 s long task). Rendering before the Federation is loaded would need a
  "loading" state in every Federation-dependent screen, and a cheaper decode would need a new competitor chunk format
  (a save-format migration). Proposed for a later package; not attempted here.
* Other screens (Library, Lab, Academy, …) still reload on every revision; they are no longer hit per analysed move,
  but still on Federation commits (≤ 2/s while scheduled games run).
* Chromium only. Safari/WebKit timing, iOS process suspension and real-device storage speed are not measured.
