# Crown & Calculation — UI copy and style guide

Applies to every player-visible string: navigation, headings, buttons, tabs, chips, body text, tooltips, notices,
errors, confirmations and empty states.

## Voice

* Short, plain, friendly, confident. Second person ("you"), present tense, active voice.
* Say what the player can do or what happened — not how the system works internally.
* One idea per sentence; most body text is one sentence. Cut filler ("Note that", "Please be aware", "simply").
* Never repeat a warning that is already visible on the same screen.

## Capitalisation

* **Title Case** for navigation, page titles, section headings, buttons, tabs, chips/badges and table headers:
  capitalise every word except *a, an, the, and, but, or, nor, of, in, on, at, to, by, for, with, vs* (unless first).
  Examples: "View Career", "Live Odds", "Your Clubs", "Match Analysis", "Market Settled", "Start Match".
* **Sentence case** for body text, notices, tooltips, descriptions and error messages.
* Proper names stay as they are: Crown Division, Federation Open, Challenger Open, Crown Championship, Club Weekend,
  Sovereign Max, Grand Exchange, Live Arena, Career Passport, Hall of Fame, Crown Academy.

## Terminology (one word per concept)

| Use | Not | Meaning |
|---|---|---|
| Rating | Glicko-2 rating, Crown rating (in headings) | chess skill, changed only by rated games |
| Division | league tier, circuit | competitive league placement (8 divisions) |
| Rank | rank band, rank policy | temporary label from your rating band |
| Federation Title | fed title, earned title | permanent honour earned by norms (Squire, Knight, Paladin, Sovereign) |
| Financial Prestige | wealth tier | money-based standing, separate from chess |
| Dollars, $ | currency units (formerly shown as crowns, ₵) | fictional money only |
| Match Analysis | engine report, canonical analysis report | post-game analysis |
| Live Odds | market price revision, probability | current market prices (shown in $ per $1 share, e.g. $0.436) |
| Trading Open / Trading Closed / Market Settled / Market Cancelled | open/closed/settled statuses in lowercase | market states |
| Position | holding, exposure (in headings) | your shares in a market |
| Moves | plies (in player text) | counting half-moves is fine in Analysis details |
| Engine | canonical engine, crown-search-2+crown-eval-4 | the game's chess engine |
| Your Club | institutional ownership asset | the player's club |

## What goes where

* Normal screens never show internal identifiers (`crown-…` ids, schema/policy/version names, calibration ids,
  build fingerprints, market revision numbers, event names, debug text).
* Technical detail that some players want (engine configuration, methodology, model ids) goes in a collapsed
  **Details** disclosure on the same screen, or in **Settings → Advanced**.
* Rules and risk information stays visible where it matters (rated vs casual, what a trade can lose, what an
  upgrade costs), written plainly.

## Messages

* Success: past tense, specific — "Bought 10 shares of White Wins."
* Errors: what happened + what to do — "Prices moved since you opened this ticket. Check the new price and try again."
* Empty states: what will appear and how to get it — "No trophies yet. Win an event to fill your cabinet."
* Confirmations: name the action and its cost on the button — "Confirm: Pay $400".

## Numbers and formatting

* Money: `$1,234.50`, sign first for losses `-$19.20` (two decimals in trading and finance tables; whole dollars in headlines). Always via `fmtMoney`/`fmtMoneyDelta`.
* Prices: `$0.436` per share that pays $1 (via `fmtPrice`); probabilities as `44%` — never mix the two.
* Ratings: whole numbers; uncertainty as `±80` only where it helps.
* Use the en dash for score lines (`3–1–0`) and ranges, "vs" without a full stop.

## Accessibility

* Every icon-only control has an `aria-label` in Title Case ("Flip Board").
* Charts keep a table alternative; decorative graphics are hidden from assistive technology.
* Never encode meaning in colour alone.
