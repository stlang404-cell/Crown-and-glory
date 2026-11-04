# v0.10 Match Center — screenshots of the running build

Every image is a screenshot of the production build (`npm run build`, served with `node scripts/serve.mjs --dir dist
--port 4410`) in headless Chromium, taken by `e2e/replay-center.mjs` during its executed run (desktop 1440×1000,
phone 390×844 at device scale 3). Nothing was seeded or edited: the federation, the in-play trades, the games and
the analyses were all produced by that journey. "Phone" means a Chromium phone viewport, not a physical iPhone.

| File | What it shows |
|---|---|
| 01-live-match-center-desktop.png | Live Match Center during in-play trading: evaluation bar (published engine evaluation), context strip with W/D/B prices, analysis column, market and trade ticket side by side. |
| 02-replay-recorded-market-desktop.png | Replay of the finished match: recorded prices at the shown move, your holdings and value at the recorded prices. |
| 03-replay-sandbox-desktop.png | Branching sandbox after settlement: alternative line with engine help; the recorded game is unchanged. |
| 04-replay-analysis-desktop.png | Replay after Match Analysis: graded notation, turning points, match events, lessons, the bar on the Match Analysis evaluation (full page). |
| 05-game-review-sandbox-desktop.png | Game Review of the player's casual game with the bar and a sandbox line. |
| 06-replay-library-desktop.png | Replay Library with filters (personal, Federation, finals, rivalries, upsets, swings, market moments, favourites). |
| 07-phone-board.png, 08-phone-analysis.png, 09-phone-trade.png | 390 px Board · Analysis · Trade tabs with the context strip above the tabs. |
| 10-phone-analysis-scrolled.png | The Analysis tab scrolled: the context strip and tabs stay at the top while the page scrolls. |
| 11-phone-replay-library.png | Replay Library at 390 px. |
| 12-phone-game-review.png | Game Review at 390 px with the evaluation bar. |
