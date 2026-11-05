# Game-loop audit (v1.0, package V)

Method: every main screen was opened on a fresh career and on a populated one (a finished rated game, a founded
10,240 Federation, advanced rounds) at 1366 px and 390 px (`e2e/a11y.mjs`, `e2e/nav-audit.mjs`), and its code was read for
what it offers, what it records and where it links. For each screen the table answers: what the player can do, why,
what they can win, lose, learn or unlock, what changes afterwards, what brings them back, what happens on failure and
how it connects. "Dead end" means a state with nothing to do next on the screen itself.

## 1. Screen by screen

| Screen | Do | Why | Win / lose / learn / unlock | Changes afterwards | Brings you back | On failure | Connects to |
|---|---|---|---|---|---|---|---|
| Dashboard | See season, fixtures, qualification, live matches, markets, rating, net worth, Vault and Grimoire progress; Quick Match; **Getting Started guide (new)** | One place for "what next" | — (summary only) | Reflects every other screen | Live matches, due reviews, open markets, next guide step | Empty cards say what fills them and link there | Every section links to its screen |
| Play (setup) | Pick an opponent (beginners first for new careers), time control, rated/casual, colour; resume unfinished games | Start a game | Rated: career Elo ±; casual: practice | New game record; rating after rated games | Rating climb, beginner → ladder, last-game analysis link | — | Match, Analysis (last game), Academy, Lab; **first-game / first-rated guide hints (new)** |
| Match | Play with mouse, touch or **keyboard (arrow keys + Enter, promotion dialog takes focus, Escape cancels; fixed)**; offer/claim draws; resign; assistant in casual games only | The game itself | Win/draw/loss, rating change (rated), Played Like | Game saved, analysis queued, rating event, Federation result for fixtures | Rematch, the next fixture | Loss → result dialog | Result dialog; nothing from the guide appears here |
| Result dialog | See result, rating before → after, Played Like when ready | Close the loop on a game | — | — | **After a loss: "Every loss is study material" with View Analysis, Practise in the Academy, Rematch (practice option new)**; focus moves to View Analysis (fixed) | — | Analysis, Academy, Play/rematch, Federation (fixtures) |
| Analysis (Game Review) | Step through moves (keys, list, graph), grades, turning points, evaluation bar, try moves (sandbox), bookmarks, "Practise This Mistake" | Learn from the game | Learn: mistakes, Played Like for both sides | Bookmarks, mistake puzzles become available in the Academy | New games to analyse | Analysis still running: progress shown | Academy (drill), Grimoire lessons, Games; **replay guide hint (new)** |
| Games (Library) / Replay Library / Analysis picker | Browse, filter, export, open any game or Federation replay | Find a game to study | — | — | New games | **Empty library now offers "Play a Game" (and Federation in the Replay Library); before: text only** | Analysis, Watch |
| Academy | Puzzles, Rush, assessments, endgames, own mistakes, themes, Today's Plan | Train | Learn; Vault collectibles from solves | Puzzle ratings, assessment history, Lab inputs | Daily plan, due reviews, Rush best | Wrong move → hint/reveal; revealed solutions don't count | Grimoire, Lab, Play (practice game) |
| Grimoire | Six books + programme + glossary; exercises; spaced review | Learn the rules and strategy | Chapter completions, Vault collectibles | Review schedule | Reviews due | Wrong → feedback; revealed → returns in review | Academy, Dashboard plan; **rules step of the guide links Book I and the glossary (new)** |
| Lab | Skill dimensions, accuracy trend, recurring mistakes | See improvement | Learn | — | More analysed games | **No mistakes yet now links "Analyse a Game" (before: text only)** | Academy, Analysis |
| Federation | Found it; your fixtures (play / postpone / forfeit), season calendar, opportunities, registration, advance round | Shared league career | Promotion/relegation, prizes (fictional money), titles, ranks | Standings, rank checkpoints, markets, news | Next round, qualification targets, rivalries | Losses move you down; forfeits count; relegation at season end | Standings, Tournaments, Competitors, Exchange, Hall, News, Rivals, Exhibition; **joining/tournament guide hints (new)** |
| Standings / Tournaments | Division tables, Swiss tables, brackets, knockout paths | Know where you stand | Qualification, prizes | — | Next pairing | — | Competitor, Watch; Heraldry now links back here |
| Competitors / Competitor | Search 10,240 competitors, filters, profile, history, rivalry, recorded games | Scout opponents | Learn (style, form) | Rivalry challenge (Rivals) | Upcoming opponents | — | Watch, Analysis, Exhibition, Rivals |
| Population | Rating distribution, bands, top competitors, movement | Context for your rating | — | — | — | — | Competitors (deliberately informational) |
| Watch (Live Match Center) / replays | Watch live or recorded games with the evaluation bar, odds and Played Like | Spectate, follow markets | Learn | — | Live games each round | — | Exchange (market), Competitor |
| Exhibition Arena | Any two competitors, unofficial, own archive | Curiosity, study | Learn (separate from official records) | Exhibition archive only | — | — | Watch-style review, Competitors |
| Exchange / Market | Buy/sell outcome shares, close positions, watchlist, paper forecasts | Use your knowledge of players | Win/lose fictional money (never more than paid) | Cash, positions, P&L, Finance ledger | Open markets every round | Loss: shares pay $0; VOID: shares pay ⅓ | Watch, Finance, Forecasts; **market tutorial with the fictional-money and losses explanation (new)**; **settled market now offers "Replay the Match with Its Recorded Odds" next to the result (new)** |
| Finance | Cash, ledger, assets, club, estates, sponsorship, sandbox money | Spend winnings | Prestige, club levels, costs | Net worth, reputation | Income each round | Administration and recovery rules | Exchange, Federation |
| Forecasts | Paper-forecast calibration, Forecasting League | Practice without money | Brier score; Vault | — | Resolved forecasts | — | **Empty history now links "Open the Exchange" (before: text only)** |
| News & History | Federation news, champions, rivalries, title archive | The world's story | — | — | New round news | — | Competitor, Watch; **no-news state links "Your Fixtures" (new)** |
| Rivals | Featured rivalries, your rivalries, legends, clubs | Personal stakes | Rivalry trophies | — | Upcoming rivalry games | — | **No rivalries now links "Your Fixtures" (new)** |
| Hall of Fame | Your trophies and titles, achievement emblems, champions, titled players | Prestige | Trophies (recorded results only) | — | Ceremonies | **No trophies now links "See What You Can Enter" (Tournaments) (new)** | Trophy Hall, Watch (final replays), Competitor; **first-trophy guide hint (new)** |
| Heraldry | Every emblem family and its rules | Reference | — | — | — | — | Rank guide; **tournament trophies now link "This Season's Tournaments" (new)** |
| Vault | 174 collectibles, families, next goals, showcase | Long-term collection | Collectibles, premium boards | Settings (boards) | Next goals | **No goal under way now links Play / Grimoire / Exchange (before: text only)** | Settings, Dashboard |
| Career (Profile) / Ranks | Career Elo per pool, history, rank and highest rank, titles, club, upsets | See your career | — | — | Rank checkpoints | **No rated games in a pool now links "Play a Rated Game" (new)** | Ranks guide, Vault, Hall; **ranks vs titles vs Elo vs Played Like guide hint (new)** |
| Settings | Display, sound, live scheduler, names, career (backup, new career), **Help & Tutorials (new)** | Control | — | — | — | — | **Restart / hide / show the guide, every tutorial, glossary (new)** |

## 2. Decorative or dead-end parts found, and what was done

| Finding | Severity | Fix |
|---|---|---|
| New players met 14 navigation entries at once, with no order and nothing explaining rated vs casual, fictional money, ranks vs titles vs Elo vs Played Like | High | First-run guide crown-tour-1 (`src/app/onboarding.ts`, `src/ui/Onboarding.tsx`): one step at a time on the Dashboard, inline hints on the screens where a step matters, optional, saved, replayable from Settings |
| After a loss the result dialog offered analysis, rematch and new game, but no route to practice; focus stayed behind the dialog | Medium | Loss text + "Practise in the Academy"; the dialog's primary button takes focus |
| Settled market: the position panel showed the net result and stopped there | Medium | "Replay the Match with Its Recorded Odds" next to the settled result (match markets) |
| Empty states with text only (Games, Replay Library, Forecast history, Rivals, Hall trophies, Lab mistakes, Career rated games, News, Vault goals) | Medium | Each now has the one button that fills it |
| Heraldry tournament trophies: no way from the trophy to the event | Low | "This Season's Tournaments" link (once the Federation exists) |
| Population analytics, Heraldry gallery | Low (informational by design) | Kept; both link to the screens they describe |

## 3. Not changed here
* Competition rules, qualification fairness and wealth balance (packages S and T).
* Visual hierarchy and styling of the new elements (package U restyles; the guide uses the existing panel, notice and chip
  styles and `src/ui/onboarding.css` only for layout).
* Startup order (package R).

## 4. Evidence
`e2e/onboarding.mjs` (guide journey incl. after-loss options), `e2e/a11y.mjs` (every screen, both widths),
`e2e/nav-audit.mjs` (every navigation entry, no dead or broken screen), `tests/onboarding.test.ts`.
