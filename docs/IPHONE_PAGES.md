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
   runs the unit tests, builds, and deploys. When it finishes, the URL above is shown on the run's *deploy* step and
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

## Updates and your saves
* New versions download in the background the next time you open the app online; the game then shows **"A new
  version is ready — Reload Now"**. Your games, ratings, Federation and money are kept: they live in the phone's
  storage, not in the downloaded files, and every save format change is a tested, additive migration.
* Saves belong to this address and this app. Safari website data and the Home Screen app are separate stores:
  play from the Home Screen icon consistently, and use **Export Backup** before deleting the app or clearing Safari data.
* iOS may delete storage of websites you have not opened for a long time; Home Screen apps are treated as in use when
  you open them. Back up occasionally.

## What was verified, and what was not
Verified automatically (Chromium with an iPhone-sized touch viewport, `e2e/pages-check.mjs`, 9/9) against a build
served exactly like GitHub Pages under `/Crown-and-glory/`:
manifest, icons and Apple meta tags resolve under the subpath; the service worker's scope is the subpath and all 10
precache entries are cached; the engine worker plays; the Federation founds and simulates; after going offline and
reloading, saved games are present, the engine still plays, a Federation round runs, a market trade executes and the
analysis worker completes a report; a new build activates as an update, shows the update notice, keeps every saved
record and removes the old cache; no horizontal overflow at 390 px; no page errors or failed requests. Desktop offline
play (`e2e/offline.mjs`) still passes.

**Not verified:** Safari/WebKit itself and a physical iPhone (only Chromium is available in this environment), and the
GitHub Actions run (it will run in your repository after the setup above). Known iOS differences to watch: Safari's
storage limits and eviction policy, and audio, which starts after the first tap like on other platforms.
