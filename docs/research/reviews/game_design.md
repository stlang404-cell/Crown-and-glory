# Independent senior game-design review

Scope: documents 01, 03, 08, 10, 11, 15 and 18. This is an independent reasoning review, not human playtesting or external expert certification.

## Judgment

The mastery-first career is coherent. Keeping chess rating, forecasting quality, money and institutional prestige distinct avoids several obvious incentives to buy or fake strength. Optional market participation, free recovery play, evidence-linked postgame feedback and permanent historical achievements are appropriate foundations. Enjoyment and hundred-hour viability remain hypotheses. The package is a useful gated blueprint, but several fundamental design details are still choices for the implementation team rather than finished specifications.

## Prioritized findings

1. **High — world advancement can conflict with player commitments.** Explicit Continue Round/Season avoids real-time chores, but there is no rule for advancing past a player's scheduled match, unfinished tournament round, open trade or required qualification decision. A season-skip button could silently forfeit competitive opportunities or settle positions without comprehension. **Correction:** make Advance a preview command: list affected fixtures, market closures and institution charges; block advance while a committed player match is active; offer play, explicit withdraw/forfeit with consequence preview, or defer where the event rules permit. Advancing must never secretly auto-play a player's rated game. Retest a chess-only and trader-only season timeline.

2. **High — federation topology and promotion/title mapping are incomplete.** 128 circuits of16 and top/bottom2 movement are specified, but destination mapping, highest/lowest tier handling, vacancy/retirement repair, championship allocation and the relationship between named ranks, rating eligibility and division placement are not. **Correction:** define the entire tier graph and route every promotion/relegation with deterministic tie/entrant rules. Publish an explicit qualification table before the championship season. Keep prestige rank separate from league division to avoid contradictory statuses. This is a dependency gate for M3, not balancing polish.

3. **High — economic branch decisions are not yet implementation-ready.** The document names facilities, capacities and opportunity costs without defining a first investment's exact cost, recurring liability, useful benefit, or hosting settlement formula. An implementer must invent the core institution game. **Correction:** specify one complete first institution scenario with parameter tables, guaranteed-free alternatives, budget equations, event capacity and success/failure outcomes, then validate it in the integrated simulation. Preserve the other institution systems, but implement them after that reference contract works. Current toy experiments do not establish viability of specialist paths.

4. **High — stylistic breadth and adaptive career depth are aspirational.** The observed style experiment found no move-choice differences. Rivalries and metagame evolution could consequently become portraits over identical play. **Correction:** require observable style metrics at matched strength (opening distribution, forcing-move choices, pawn structure, risk in near-equivalent positions), repertoire adaptation based on prior games and an exploitation suite. Do not add a numerical adaptation buff as a substitute for chess behavior. The existing negative finding should remain visible.

5. **Medium — optionality needs path-specific onboarding.** The first launch offers Play/Learn/Watch, but the narrative largely assumes a friendly, rated game, postgame exercise and tournament before other paths. Pure traders/club managers need a legitimate starting dossier and bounded bankroll/opportunity set without being forced into chess. **Correction:** define one first-session checklist per specialist path, all linked through the same public federation state. Keep the chess route as default. Validate comprehension without measuring only time spent.

6. **Medium — first-ten-minute and first-hour sequences need explicit bounds.** An untimed friendly can last longer than ten minutes, and a four-player round robin can exceed an hour. **Correction:** present these as illustrative journeys, not promised completion times; offer a resumable short curated scenario as an optional tutorial while the first authentic match remains unrigged and permanently recorded. Never compress the actual chess rules or force a result to meet onboarding timing.

7. **Medium — replayable/summary-only events require a consistent user contract.** A user can promote a match before start, but cannot obtain a replay after an abstract result. That is defensible, yet may disappoint analysts when a major rival game becomes interesting later. **Correction:** persist full engine play for a bounded, preannounced selection of marquee/rival/championship events regardless of current watching, and label summary-only events before they start. Include the storage/search budget in that policy. Do not manufacture a replay later.

8. **Medium — progression may overemphasize external rank after choosing academy-first.** There is no concrete academy endgame beyond certificates. **Correction:** specify held-out mastery achievements with uncertainty, annotated portfolio projects and novel assessment families so puzzle/analysis specialists have meaningful long-term goals without tournament titles or invented IQ scores. Keep this separate from financial rewards that could motivate answer farming.

## Recommended acceptance additions

- Walk through a full season as chess-only, puzzle-only, spectator/forecaster-only and institution-only players; each must have at least one meaningful choice, affordable continuation and intelligible success measure.
- Attempt Continue Season during an active match, unresolved withdrawal, open position, low institution cash and qualification cutoff; no silent consequence is allowed.
- Verify one complete two-season promotion/retirement/entrant trace against the published tier graph.
- Test mobile postgame navigation and path selection with actual users before claiming a coherent or enjoyable loop.

## Simplifications without scope removal

Use one institution reference scenario before expanding all facility interactions; deterministic curated event templates before arbitrary scheduling customization; bounded conditional market trees before general combinatorial markets; motifs/templates before a local language model. Retain each full system in the roadmap, with the chess/analytics foundation protected.
