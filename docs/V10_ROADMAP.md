# v0.10 roadmap

Planned work after v0.9.0. Nothing here is implemented unless a later report says so.

## 1. Final Gameplay Expansion (requested; next milestone)
* **Replay and analysis centre:** a vertical evaluation bar beside the board, the evaluation graph, recorded
  historical odds for featured games, a practice sandbox from any position that never alters records, a replay
  library.
* **Header and honours:** a redesigned top header showing championship banners and trophies the player chooses;
  a Trophy Hall; expanded achievement families (Giant Slayer, Unbroken Shield, Crown Collector, Oracle's Eye,
  Phoenix Ledger, Sovereign Historian), all computed from recorded results.
* **Colour and themes:** more theme tokens and accent colours, checked for contrast in light and dark.
* **Loops:** rivalry, qualification, replay-to-improvement, forecasting, prestige, scouting and wealth loops, each
  surfaced on the Dashboard in a clear hierarchy.
* **Balance and release tests** for every new reward (no duplicate awards, no rewards from unrated or assisted play).
* Open questions for the owner (not assumed): the "0–4,000 rating ladder" (the current titles run one per 100 points
  from the rating floor, uncapped) and "real-world names as fictional personas" (not done: the game uses original
  names only).

## 2. Federation at scale
* Switch new federations to crown-topology-2 (4,096) once retired-competitor records are compacted, old rounds'
  abstract results are compacted, and the qualification market's cost per region is reduced
  (docs/FEDERATION_SCALE.md §4).
* A browser journey through the Live Now panel and Settings → Live Games.
* Measure round times and storage on a real phone.

## 3. Engine and opponents
* Remaining optimisation steps 4, 6, 7 of docs/ENGINE_OPTIMIZATION_PLAN.md; each must keep the speed-probe checksum
  or be validated by a confirmation match.
* Aggressive style: a new parameter set and a new pre-registered criterion; stays Universal until it passes.
* Measure styles at the sampling levels L1–L4 directly.

## 4. Platform
* Test on a physical iPhone (Home Screen app: update timing, storage eviction, audio) and on Windows; record the
  results in docs/IPHONE_PAGES.md and the launcher README section.
* Re-run the economy simulations with scheduled background games enabled in the headless driver.
