# Play on iPhone: free hosting with GitHub Pages

Game URL (once deployed): **https://stlang404-cell.github.io/Crown-and-glory/**

Everything runs on your phone: the chess engine, analysis, Federation simulation, markets and your saves (IndexedDB in
Safari). GitHub Pages only serves the game's static files over HTTPS; there is no server code, account or paid service.

## One-time setup in GitHub (about two minutes)
1. **Create the `main` branch** from the current work (the workflow deploys `main`). On github.com:
   repository → **Pull requests → New pull request**, base `main` ← compare `claude/fervent-brahmagupta-fnui2e`,
   or, if `main` does not exist yet, **Branches → New branch** named `main` from `claude/fervent-brahmagupta-fnui2e`.
2. **Turn on Pages with Actions:** repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   (Nothing else to choose; no branch/folder setting is used.)
3. **Allow Actions** if your account restricts them: **Settings → Actions → General → Allow all actions**, and under
   *Workflow permissions* keep the default (the workflow itself requests `pages: write` and `id-token: write`).
4. **Run it:** push anything to `main`, or open **Actions → Deploy to GitHub Pages → Run workflow**. The run installs,
   runs the unit tests, builds, checks the build, and deploys. When it finishes, the URL above is shown on the run's *deploy* step and
   under Settings → Pages.

After that, every push to `main` builds and deploys automatically (`.github/workflows/deploy-pages.yml`).
A failing unit test stops the deployment, so a broken build never replaces the game on your phone.

## Install on iPhone
1. Open **Safari** (installation to the Home Screen works from Safari) and go to
   https://stlang404-cell.github.io/Crown-and-glory/.
2. Wait until the Play screen has loaded once (this downloads and caches the whole game: about 1 MB).
3. Tap **Share** (square with an arrow) → **Add to Home Screen** → **Add**.
4. Open **Crown** from the Home Screen. It runs full-screen, offline, with the chess engine on the phone.
5. Optional: in the game, **Games → Export Backup** saves your whole career to a file (keep it in Files/iCloud); **Import Backup**
   imports it on any device.

## How a change reaches your phone
* **Live URL:** https://stlang404-cell.github.io/Crown-and-glory/ — deployed from branch **`main`** only.
* **How changes reach `main`:** work is done on `claude/fervent-brahmagupta-fnui2e`; the owner opens a pull request
  (base `main` ← compare `claude/fervent-brahmagupta-fnui2e`) and merges it. Nothing is pushed to `main` directly.
* **What triggers a deploy:** every push to `main` (a merged PR is a push) or **Actions → Deploy to GitHub Pages →
  Run workflow**. The workflow runs `npm ci`, the unit tests, `npm run build`, then a release check
  (`node scripts/verify-dist.mjs dist`: `sw.js` exists and every file in its precache list exists in `dist`,
  `dist/version.json` matches the `package.json` version and the commit being deployed, and the manifest's
  `start_url`/`scope` are `./`). Any failure stops the job before upload, so the game on your phone is never replaced
  by a broken build. The run's summary shows the deployed version and commit.
* **Build identity:** every build carries `{ version, commit, builtAt }` (package.json version, short commit SHA,
  build time) in the app and in `version.json` next to it. Settings → About shows
  *Version x · commit y · built z*.

## Updates on iPhone (what happens, what you see)
1. **Detection.** The app checks for a new release when it launches and every time it comes back to the
   foreground (switching back to it, or tapping its Home Screen icon while it is suspended — iOS usually resumes a
   Home Screen app rather than relaunching it), at most once every few minutes, and when the phone comes back online.
   It asks the service worker to re-check `sw.js` and reads `version.json` (never cached) to learn the new version.
2. **Download in the background.** The new version downloads every file into a new cache while you keep playing the
   old one. It then *waits*: nothing changes on screen yet. If any file fails to download (bad connection, a
   deploy still in progress) the download is thrown away and the old version keeps working, also offline; the next
   check simply tries again.
3. **Safe switch.** The app switches to the waiting version only when nothing is in progress:
   * nothing in progress (Play screen, Exchange, Finance, Federation, Settings, …) → it switches by itself after a
     moment of idle (the page reloads once, about a second);
   * you are in a game (the match screen — playing, paused, or looking at the result), a live in-play arena game is
     still unsettled, a Federation action is being saved, or another Crown tab is open → you see
     **"Update ready — vX (commit). It will install when you leave this game. — Restart to Update"**. Tap the
     button to restart now (your game is saved after every move and resumes), or just keep playing: it installs
     by itself as soon as you leave the game.
4. **Confirmation.** After the switch you see **"Updated to vX (commit)"** once.
5. Navigations are network-first with a short timeout (fresh `index.html` when online, the cached copy when offline
   or on a very slow connection), so reopening the app online also loads the newest page.

## Your saves during updates
* Games, ratings, Federation, Exchange positions and money live in the phone's storage (IndexedDB), not in the
  downloaded files. Updates replace only the downloaded files: the service worker deletes only its own older
  `crown-…` caches for this address, and never touches IndexedDB or localStorage (a unit test checks the worker's
  code for this). Every save-format change is a tested, additive migration.
* Saves belong to this address and this app. Safari website data and the Home Screen app are separate stores:
  play from the Home Screen icon consistently, and use **Export Backup** before deleting the app or clearing Safari data.
* iOS may delete storage of websites you have not opened for a long time; Home Screen apps are treated as in use when
  you open them. Back up occasionally.

## Which version is installed?
Settings → About → **Version x · commit y · built z**. Compare the commit with the latest *Deploy to GitHub Pages*
run summary (or `https://stlang404-cell.github.io/Crown-and-glory/version.json`). If it is older: close the app
fully (swipe it away), reopen it online, wait a few seconds; leave any game you are in.

## Recovery
1. **Reload:** swipe the app away and reopen it (or pull to reload in Safari).
2. **Still broken or stuck on an old version:** in the game, **Games → Export Backup** (save the file to Files/iCloud),
   then remove the Home Screen app (long-press → Remove App → Delete), open the URL in Safari, **Add to Home Screen**
   again, open it and **Import Backup**. Removing the app deletes its storage, so export first.

## Startup (v1.0)
What happens when the app opens (also offline): the service worker serves the cached files → IndexedDB opens (no
upgrade unless the save format changed) → your Federation and, at the same time, your rating history are read → the
first screen renders (until then a one-line "opening your saved career…" notice is shown) → after that screen has been
painted and a quiet second, background work starts one idle step at a time: analysis queue, Vault, legacy trophies,
Played Like records, live scheduler and its catch-up. A tap on the tab bar during a slow first render is no longer lost.

Budgets (`e2e/startup.mjs`; ×4/×6 measured on the intermediate v1.0 build; p95 of "interactive" — screen visible, then 500 ms without a long task), populated
career: ~10,900-competitor Federation two seasons in, 12 rated games with analysis reports:

| | Dashboard | Career Passport rating events |
|---|---|---|
| desktop, Chromium ×1 (cold, warm, offline) | ≤ 2.5 s (measured ≤ 0.9 s) | ≤ 3 s (measured ≤ 1.3 s) |
| 390 px, CPU ×4 | ≤ 8 s (measured ≤ 6.9 s) | ≤ 10 s (measured ≤ 8.9 s) |
| 390 px, CPU ×6 | ≤ 10 s (measured ≤ 8.5 s) | ≤ 12 s (measured ≤ 10.8 s) |

Measured in Chromium with CDP CPU throttling as a proxy for a phone — **not on a physical iPhone and not in Safari**.
At ×4/×6 most of the cold start is reading and decoding the Federation (≈ 2.5 s at ×6); see
docs/evidence/v1.0/reload-flake.md for the measurements, the root cause of the v0.11 reload flake and what remains.

## What was verified, and what was not
Verified automatically with `e2e/pages-check.mjs` (Chromium with an iPhone-sized touch viewport, 13/13 checks)
against two real builds served exactly like GitHub Pages under `/Crown-and-glory/` — build A (package version,
current commit) and build B (`CROWN_VERSION=0.9.1 CROWN_COMMIT=bbbbbbb`):
manifest, icons and Apple meta tags resolve under the subpath; the service worker's scope is the subpath and all
precache entries are cached (`version.json` is not); the build identity matches in the app, `version.json` and
Settings → About; the engine worker plays; the Federation founds and simulates; offline reload with saved games, AI
play, a Federation round, a market trade and an analysis report; **idle update** found by the foreground
(visibilitychange) re-check, installed and switched by itself with every record kept and the "Updated to" message;
**update during a game** not applied (notice shown, the same page keeps running, the game continues with a move and
an engine reply), then applied by itself on leaving the game with the game still resumable; **update with an Exchange
position** keeps every player position and balance identical; **interrupted update** (one file of the new build
answers 503) leaves nothing waiting, keeps one cache and the old version running online and offline, and completes
once the file is back; no horizontal overflow at 390 px; no page errors or failed requests. Desktop offline play
(`e2e/offline.mjs` via `node scripts/serve.mjs --dir dist`) still passes.

To re-run:
```
npx vite build --outDir /tmp/crown-a
CROWN_VERSION=0.9.1 CROWN_COMMIT=bbbbbbb npx vite build --outDir /tmp/crown-b
node e2e/pages-check.mjs /tmp/crown-a /tmp/crown-b
```

**Not verified:** Safari/WebKit itself and a physical iPhone (only Chromium is available in this environment) —
in particular how often iOS resumes vs. relaunches a Home Screen app and when it fires the foreground event, and
Safari's own service-worker update timing; and the GitHub Actions run (it runs in your repository). Known iOS
differences to watch: Safari's storage limits and eviction policy, and audio, which starts after the first tap like
on other platforms.
