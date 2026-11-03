# A persistent chess civilization

## Identity and strength

Generate 2,048 competitors [D] across128 local circuits of16, grouped into regional divisions; identities are cheap persistent records, not simultaneous engines. Each has stable ID, portrait seed, age/career timeline, home club, public rating by pool, hidden simulated strength vector, style preferences, opening repertoire, preparation state and career ledger. Fictional personas never imply real human opponents.

Separate latent simulated strength from public estimated rating. Skill may improve/decline on scheduled career arcs with bounded innovations; age is fictional narrative, not a scientific model of human ability. Anchors retain frozen engine profiles. Retirement/new entrants preserve historical records and do not delete games. Calibrate entrants against anchors rather than assigning everyone a strong rating. The default world seed creates a reproducible federation. Record versioned PRNG state per subsystem; never use UI timing or render order as random inputs.

Styles: tactical/forcing, positional/mobility, defensive, pawn-racer, time-pressure specialist, repertoire specialist. These are desired behaviors, not demonstrated personalities. The current test of three hand-evaluation profiles produced zero disagreement in five positions [E]. Require a larger equal-strength position suite with action-distribution/feature differences and exploit resistance before naming production personalities. Portraits/dialogue cannot substitute for distinct chess behavior.

## Simulation tiers

Tier1: player games and selected marquee broadcasts use the real engine and fully stored legal move histories. Tier2: scheduled watched games run bounded full searches, serialized with foreground tasks. Tier3: unobserved results sampled from calibrated W/D/L strength/clock/style models. Tier3 outcomes have metadata `abstract-result`, not invented moves or engine accuracy.

Never fabricate a legal replay to fit a pre-sampled result. Once a user requests a replayable match before it starts, promote it to Tier1/2 and derive settlement from actual engine play. Abstract matches remain labeled summary-only; all **played** matches retain full records. Historical broadcast access cannot silently manufacture games. This distinction is required for performance and truthfulness.

No prediction market may settle on a result already revealed or computed in a way the honest-play interface can access. Do not eagerly precompute future outcomes into inspectable save fields and call that secure. The offline adversary can still read code/seed; see14.

## Time and scheduling

World time advances on explicit Continue Round/Season actions. Training and research do not age the world accidentally; the user may advance rounds while focused on another path. No wall-clock interest, missed daily prize, or forced catch-up. Tick transaction: validate schedule→lock eligible markets→resolve games→post ratings→standings/titles→settle markets→post economy→commit event log/checksum. A failed tick resumes idempotently from recorded stages.

Round robin uses the circle method, one game per competitor per round, color balancing and home/away reversal next season. 16-player circuit =15 rounds/120 games [derived]. Seeded tie-breaks: points, head-to-head within tied group where valid, Sonneborn–Berger for complete round robin, then playoff; titles never decided by hidden randomness. Award1/.5/0.

Promote/relegate top/bottom2 at season end [D], using verified standings and explicit tie policies. Freeze qualification cutoffs before a season. Regional open Swiss events use a deterministic pairing solver that avoids repeats and balances colors; if no legal pairing exists, relax documented priorities and explain. Do not claim FIDE-compliant Swiss without implementing/auditing that system.

## Format choices

- Round robin: local leagues, predictable rival encounters and complete comparison, but O(n²) matches.
- Swiss: open fields, fewer rounds and varied opponents, but harder fairness/pairing.
- Single elimination: championship finals, readable stakes, high variance; use two-game color-swapped mini-matches and tiebreaks.
- Double elimination: occasional optional festivals; more recovery but burdens schedules/mobile explanation.
- Qualification: league merit plus open qualifier paths; titles cannot be purchased.

World championship [D]: qualify16 through regional champions/open points, four groups of4 round robin, top2 to an8-player bracket. Group points/head-to-head rules published. A tied two-game bracket match receives one two-game rapid pair and then one two-game blitz pair. If still tied, the higher pre-event qualification seed advances (the seed and this rule are public before registration). In the championship final, a tie after those pairs awards a shared championship; both are recorded as joint champions. This finite policy sacrifices guaranteed sole champions rather than introducing unreviewed Armageddon fairness. No hidden coin flip or endless replay.

## Rank and prestige

Proposed hierarchy: Provisional, Club, District, Regional, National, Master Circuit, Crown Contender, Crown Champion. Competitive division is current earned placement; titles are historical achievements; rating is continuous skill evidence. Promotions combine established rating eligibility with qualifier achievements, with thresholds calibrated from anchor/population distributions rather than guessed FIDE labels. No grind-only move count requirement. Rank events store date, prior/new rank, rating snapshot, qualifying event and policy.

Ceremonies celebrate the exact result and let the player skip. A title defense records opponent and score. Rivalries derive from repeated consequential games; prestige accrues from tournament titles, hosting quality and verified forecast performance separately. Hall of Fame records enduring achievements without making relegation erase the past.

`data/world_schedule.json` tests 2,048 stationary identities for three15-round seasons. It verifies arithmetic scheduling/throughput, not full promotions, retirement dynamics, evolving styles or rating-inflation control. Those remain required simulation gates.

## Complete topology and world-advance contract [D]

Group the128 circuits into16 regions with8 ordered divisions each,16 competitors per division. At season end, simultaneous top2/bottom2 exchange occurs only between adjacent divisions in the same region; the top division has no automatic promotion beyond itself and the bottom has no relegation below itself. Preserve circuit IDs and archive old membership. Retired slots are filled after exchanges by entrants calibrated for the destination strength band; the rules never duplicate a competitor across circuits. A player selects one home region at career creation and uses the same promotion rules. Club/title paths do not purchase placement.

World championship allocation:8 seats go to a regional-champions qualifier (the16 top-division winners play two seeded groups of8, top4 each), and8 to a federation open Swiss qualifier. A player already qualified is removed from the second allocation before pairing; reserve finishers in the same qualifier fill withdrawals. Seeds sort by prior completed-season qualifier points, established rating snapshot, then a public fixed pre-event draw order. Publish all tie-break criteria before play. Division standings after head-to-head/Sonneborn–Berger ties use a two-game playoff; if still tied, pre-season seed decides placement. Champion joint-title exception applies only to the final.

Continue Round opens a preview listing own matches, event deadlines, affected market locks, expected facility costs and tournaments resolved. An active player match blocks advancement. For scheduled player matches, choose Play, explicitly Withdraw (record event loss/unrated forfeit; no invented moves), or Cancel advance. Abstract scheduling never resolves a player game behind the user's back. Continue Season repeats round previews and stops at every player decision or conflict; it cannot silently forfeit. Training/analysis time does not advance ticks. Club commitments create budget choices, not wall-clock chores. All multi-step tick effects remain invisible until the committed tick cursor is published.
