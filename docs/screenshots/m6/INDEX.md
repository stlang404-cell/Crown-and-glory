# M6 visual showcase — screenshots of the running game

Every image is a screenshot of the real production build running in headless Chromium (desktop 1440×1000 and
phone 390×844, device scale 2), using careers that the executed acceptance journeys actually played. **No data
was seeded or edited.** Sources: `e2e/m6-arena.mjs`, `e2e/m6-showcase.mjs`, and the careers from
`e2e/m4-journey.mjs`, `e2e/m5-heraldry.mjs`, `e2e/v5-journey.mjs`. The "Phone" images are Chromium phone-sized
viewports, not a physical iPhone. Full-page phone captures show the fixed bottom navigation bar where it sat when
the capture was taken.

| File | What it shows | Source |
|---|---|---|
| [01-dashboard-federation.png](01-dashboard-federation.png) | Main dashboard: the Federation screen with navigation, fixtures, standings and featured matches (season 2). | m4 journey career |
| [01b-dashboard-play.png](01b-dashboard-play.png) | Play home: opponent ladder L1–L9 including Sovereign Max, match settings. | m4 journey career |
| [02-live-arena-desktop.png](02-live-arena-desktop.png) | Sovereign Live Arena, desktop, during in-play trading of a Crown Championship round-of-16 game: board, players, thinking clocks, published evaluation, odds, price history, trade ticket. No move labels while trading is open. | m6 Arena journey (executed) |
| [02b-live-arena-midgame.png](02b-live-arena-midgame.png) | Live Arena mid-game (another championship match): published evaluation, live odds, price history; no labels while trading. | m6 Arena journey career |
| [03-live-arena-postgame-desktop.png](03-live-arena-postgame-desktop.png) | The same match after settlement: labelled notation (post-game canonical analysis), dashed post-game curve, settled market, realised P&L in the portfolio. | m6 Arena journey (executed) |
| [04-career-passport.png](04-career-passport.png) | Career Passport: rating, rank, career standing (six separate records), title progress, trophies, achievements. | m5 journey career |
| [05-grand-exchange.png](05-grand-exchange.png) | Grand Exchange: open markets, families, portfolio. | m4 journey career |
| [05b-exchange-market.png](05b-exchange-market.png) | A market: research, model vs price, price history and the trade ticket. | m4 journey career |
| [05c-forecasting.png](05c-forecasting.png) | Forecasting companion: Brier/log scores and calibration. | m4 journey career |
| [06-chess-analysis.png](06-chess-analysis.png) | Chess analysis of a finished game (grades in this game: {"excellent":4,"best":25,"mistake":1,"inaccuracy":4,"good":2,"great":2}). | v0.5 journey career |
| [06b-lab.png](06b-lab.png) | Chess Intelligence Lab (one methodology, evidence thresholds). | v0.5 journey career |
| [06c-academy.png](06c-academy.png) | Crown Academy with the re-verified puzzle library. | v0.5 journey career |
| [06d-analysis-brilliant.png](06d-analysis-brilliant.png) | Chess analysis of a real league game with an earned Brilliant (13. Kd3, an only move confirmed by a deeper search) — this game also has a Mistake and two Blunders. | m5 journey career |
| [06e-analysis-blunder.png](06e-analysis-blunder.png) | The same game at a Blunder. | m5 journey career |
| [07-finance-clubs.png](07-finance-clubs.png) | Finance: cash, assets, positions, net worth history, financial prestige, club (Tournament Venue) and sponsorship contracts, cosmetics shop. | m4 journey career |
| [08-tournaments.png](08-tournaments.png) | Tournaments: Swiss standings, Club Weekend and Crown Championship bracket. | m4 journey career |
| [08b-hall-of-fame.png](08b-hall-of-fame.png) | Hall of Fame: trophy room, Crown Champions with final replay, event champions, Paladins and Sovereigns. | m5 journey career |
| [08c-rivals.png](08c-rivals.png) | Featured rivals with insignia, clubs, ambitions and rivalry intensity. | m5 journey career |
| [08d-rival-profile.png](08d-rival-profile.png) | Competitor career: insignia, rivalry with you, this season, head-to-head, career by season. | m5 journey career |
| [08e-championship-bracket.png](08e-championship-bracket.png) | Crown Championship bracket during the round of 16 (rivalry previews, crests). | m6 Arena journey career |
| [09-heraldry-ladders.png](09-heraldry-ladders.png) | Rank ladders and emblems: 8 league divisions, 7 rating ranks, 4 federation titles, regions, tournaments, trophies, clubs, achievements. | m5 journey career |
| [09b-club-editor.png](09b-club-editor.png) | Club identity editor: name, motto, colours, shield, field and symbol. | m5 journey career |
| [09c-settings-customisation.png](09c-settings-customisation.png) | Customisation: three themes, board palettes (two premium, locked until unlocked), motion, chess-intelligence panel. | m5 journey career |
| [09d-cosmetics.png](09d-cosmetics.png) | Cosmetics: frames, banners, premium boards, portraits — bought with fictional crowns or earned. | v0.5 journey career |
| [10-mobile-arena-market.png](10-mobile-arena-market.png) | Phone: Arena Market tab (odds, price history). | m6 Arena journey (executed) |
| [10-mobile-arena-moves.png](10-mobile-arena-moves.png) | Phone (390 px): Arena replay, board on top, Moves & eval tab. | m6 Arena journey (executed) |
| [10-mobile-arena-portfolio.png](10-mobile-arena-portfolio.png) | Phone: Arena Portfolio tab. | m6 Arena journey (executed) |
| [10b-mobile-federation.png](10b-mobile-federation.png) | Phone: Federation dashboard. | m4 journey career |
| [10c-mobile-exchange.png](10c-mobile-exchange.png) | Phone: Grand Exchange. | m4 journey career |
| [10d-mobile-finance.png](10d-mobile-finance.png) | Phone: Finance and clubs. | m4 journey career |
| [10e-mobile-passport.png](10e-mobile-passport.png) | Phone: Career Passport. | m5 journey career |
| [live-arena.gif](live-arena.gif) | GIF excerpt of the same live match. | m6 Arena journey career |
| [live-arena.webm](live-arena.webm) | Video: a live championship match advancing with in-play windows; the market and evaluation update per published move. | m6 Arena journey career |

Requested items and where they are:

1. Main dashboard — `01-dashboard-federation.png`, `01b-dashboard-play.png`
2. Sovereign Live Arena — `02-live-arena-desktop.png`, `02b-live-arena-midgame.png`, `03-live-arena-postgame-desktop.png`, `live-arena.webm` / `live-arena.gif`
3. Career Passport — `04-career-passport.png`
4. "16 Circuit Grades" — **not implemented.** The main M6 "Crown Legacy" prompt that would define them was not
   provided, so no 16-grade ladder was invented. The existing ladders are shown instead: `09-heraldry-ladders.png`
   (8 league divisions, 7 rating ranks, 4 fictional federation titles).
5. Grand Exchange — `05-grand-exchange.png`, `05b-exchange-market.png`, `05c-forecasting.png`
6. Chess analysis — `06d-analysis-brilliant.png`, `06e-analysis-blunder.png` (Brilliant, Best, Excellent, Mistake, Blunder earned in that game), `06-chess-analysis.png` (Great, Best, Mistake), `06b-lab.png`, `06c-academy.png`
7. Clubs & financial empire — `07-finance-clubs.png`, `09b-club-editor.png`
8. Tournaments & rivals — `08-tournaments.png`, `08e-championship-bracket.png`, `08b-hall-of-fame.png`, `08c-rivals.png`, `08d-rival-profile.png`
9. Customisation — `09c-settings-customisation.png`, `09d-cosmetics.png`, `09b-club-editor.png`, `09-heraldry-ladders.png`. Alternative piece sets do not exist (one original piece set).
10. Mobile — `10-mobile-arena-*.png`, `10b–10e` mobile screens
