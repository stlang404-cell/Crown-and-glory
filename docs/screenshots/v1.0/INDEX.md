# v1.0 visual identity — before / after screenshots (package U)

Real captures from production builds served locally, made by `e2e/visual-shots.mjs` (Chromium; desktop 1366 × 900,
phone 390 × 844 at 2×, touch). Same fresh career in both: a founded federation after one forfeited round, theme
Obsidian (default), motion reduced. **Before** = v0.11 baseline build (commit 0b10f79 merged base); **after** = package U.
Phone captures show the top of each screen and its scrolled end (proving the page scrolls to the bottom above the tab
bar). JPEG, quality 78. No physical-device claims.

| Screen | Desktop before | Desktop after | 390 px before | 390 px after |
|---|---|---|---|---|
| Dashboard | [before](before-desktop-dashboard.jpg) | [after](after-desktop-dashboard.jpg) | [top](before-phone-dashboard.jpg) · [end](before-phone-dashboard-end.jpg) | [top](after-phone-dashboard.jpg) · [end](after-phone-dashboard-end.jpg) |
| Play | [before](before-desktop-play.jpg) | [after](after-desktop-play.jpg) | [top](before-phone-play.jpg) · [end](before-phone-play-end.jpg) | [top](after-phone-play.jpg) · [end](after-phone-play-end.jpg) |
| Match (live game) | [before](before-desktop-match.jpg) | [after](after-desktop-match.jpg) | [top](before-phone-match.jpg) · — | [top](after-phone-match.jpg) · — |
| Federation | [before](before-desktop-federation.jpg) | [after](after-desktop-federation.jpg) | [top](before-phone-federation.jpg) · [end](before-phone-federation-end.jpg) | [top](after-phone-federation.jpg) · [end](after-phone-federation-end.jpg) |
| Standings (Divisions) | [before](before-desktop-standings.jpg) | [after](after-desktop-standings.jpg) | [top](before-phone-standings.jpg) · [end](before-phone-standings-end.jpg) | [top](after-phone-standings.jpg) · [end](after-phone-standings-end.jpg) |
| Tournaments / Brackets | [before](before-desktop-tournaments.jpg) | [after](after-desktop-tournaments.jpg) | [top](before-phone-tournaments.jpg) · [end](before-phone-tournaments-end.jpg) | [top](after-phone-tournaments.jpg) · [end](after-phone-tournaments-end.jpg) |
| Competitors | [before](before-desktop-competitors.jpg) | [after](after-desktop-competitors.jpg) | [top](before-phone-competitors.jpg) · [end](before-phone-competitors-end.jpg) | [top](after-phone-competitors.jpg) · [end](after-phone-competitors-end.jpg) |
| Profile (Career) | [before](before-desktop-profile.jpg) | [after](after-desktop-profile.jpg) | [top](before-phone-profile.jpg) · [end](before-phone-profile-end.jpg) | [top](after-phone-profile.jpg) · [end](after-phone-profile-end.jpg) |
| Ranks | [before](before-desktop-ranks.jpg) | [after](after-desktop-ranks.jpg) | [top](before-phone-ranks.jpg) · [end](before-phone-ranks-end.jpg) | [top](after-phone-ranks.jpg) · [end](after-phone-ranks-end.jpg) |
| Hall of Fame / Trophy Hall | [before](before-desktop-hall.jpg) | [after](after-desktop-hall.jpg) | [top](before-phone-hall.jpg) · [end](before-phone-hall-end.jpg) | [top](after-phone-hall.jpg) · [end](after-phone-hall-end.jpg) |
| Vault | [before](before-desktop-vault.jpg) | [after](after-desktop-vault.jpg) | [top](before-phone-vault.jpg) · [end](before-phone-vault-end.jpg) | [top](after-phone-vault.jpg) · [end](after-phone-vault-end.jpg) |
| Heraldry | [before](before-desktop-heraldry.jpg) | [after](after-desktop-heraldry.jpg) | [top](before-phone-heraldry.jpg) · [end](before-phone-heraldry-end.jpg) | [top](after-phone-heraldry.jpg) · [end](after-phone-heraldry-end.jpg) |
| Exchange / Market | [before](before-desktop-exchange.jpg) | [after](after-desktop-exchange.jpg) | [top](before-phone-exchange.jpg) · [end](before-phone-exchange-end.jpg) | [top](after-phone-exchange.jpg) · [end](after-phone-exchange-end.jpg) |
| Finance | [before](before-desktop-finance.jpg) | [after](after-desktop-finance.jpg) | [top](before-phone-finance.jpg) · [end](before-phone-finance-end.jpg) | [top](after-phone-finance.jpg) · [end](after-phone-finance-end.jpg) |
| Replay Library (Games) | [before](before-desktop-library.jpg) | [after](after-desktop-library.jpg) | [top](before-phone-library.jpg) · [end](before-phone-library-end.jpg) | [top](after-phone-library.jpg) · [end](after-phone-library-end.jpg) |
| Replay Center | [before](before-desktop-replays.jpg) | [after](after-desktop-replays.jpg) | [top](before-phone-replays.jpg) · [end](before-phone-replays-end.jpg) | [top](after-phone-replays.jpg) · [end](after-phone-replays-end.jpg) |
| Exhibition Arena | [before](before-desktop-exhibition.jpg) | [after](after-desktop-exhibition.jpg) | [top](before-phone-exhibition.jpg) · [end](before-phone-exhibition-end.jpg) | [top](after-phone-exhibition.jpg) · [end](after-phone-exhibition-end.jpg) |
| Academy | [before](before-desktop-academy.jpg) | [after](after-desktop-academy.jpg) | [top](before-phone-academy.jpg) · [end](before-phone-academy-end.jpg) | [top](after-phone-academy.jpg) · [end](after-phone-academy-end.jpg) |
| Grimoire | [before](before-desktop-grimoire.jpg) | [after](after-desktop-grimoire.jpg) | [top](before-phone-grimoire.jpg) · [end](before-phone-grimoire-end.jpg) | [top](after-phone-grimoire.jpg) · [end](after-phone-grimoire-end.jpg) |
| Settings | [before](before-desktop-settings.jpg) | [after](after-desktop-settings.jpg) | [top](before-phone-settings.jpg) · [end](before-phone-settings-end.jpg) | [top](after-phone-settings.jpg) · [end](after-phone-settings-end.jpg) |

## Layout audit (from the same runs)

Each screen is checked for horizontal overflow (`scrollWidth > innerWidth`), an error boundary, and whether the last
element of `<main>` ends above the phone tab bar when scrolled to the bottom ("bottom reach" ≤ 0 px). Both runs passed
every check; after package U:

```
ok   desktop dashboard: overflow 0, bottom reach -48
ok   desktop play: overflow 0, bottom reach -48
ok   desktop federation: overflow 0, bottom reach -48
ok   desktop standings: overflow 0, bottom reach -48
ok   desktop tournaments: overflow 0, bottom reach -48
ok   desktop competitors: overflow 0, bottom reach -48
ok   desktop profile: overflow 0, bottom reach -47
ok   desktop ranks: overflow 0, bottom reach -48
ok   desktop hall: overflow 0, bottom reach -47
ok   desktop vault: overflow 0, bottom reach -47
ok   desktop heraldry: overflow 0, bottom reach -48
ok   desktop exchange: overflow 0, bottom reach -48
ok   desktop finance: overflow 0, bottom reach -48
ok   desktop library: overflow 0, bottom reach -489
ok   desktop replays: overflow 0, bottom reach -132
ok   desktop exhibition: overflow 0, bottom reach -47
ok   desktop academy: overflow 0, bottom reach -47
ok   desktop grimoire: overflow 0, bottom reach -84
ok   desktop settings: overflow 0, bottom reach -48
ok   desktop match: overflow 0
ok   phone dashboard: overflow 0, bottom reach -20
ok   phone play: overflow 0, bottom reach -21
ok   phone federation: overflow 0, bottom reach -21
ok   phone standings: overflow 0, bottom reach -20
ok   phone tournaments: overflow 0, bottom reach -20
ok   phone competitors: overflow 0, bottom reach -21
ok   phone profile: overflow 0, bottom reach -20
ok   phone ranks: overflow 0, bottom reach -20
ok   phone hall: overflow 0, bottom reach -21
ok   phone vault: overflow 0, bottom reach -21
ok   phone heraldry: overflow 0, bottom reach -21
ok   phone exchange: overflow 0, bottom reach -21
ok   phone finance: overflow 0, bottom reach -20
ok   phone library: overflow 0, bottom reach -70
ok   phone replays: overflow 0, bottom reach -21
ok   phone exhibition: overflow 0, bottom reach -20
ok   phone academy: overflow 0, bottom reach -20
ok   phone grimoire: overflow 0, bottom reach -21
ok   phone settings: overflow 0, bottom reach -20
ok   phone match: overflow 0
ALL CHECKS PASSED
```

Before (v0.11 baseline):

```
ok   desktop dashboard: overflow 0, bottom reach -48
ok   desktop play: overflow 0, bottom reach -48
ok   desktop federation: overflow 0, bottom reach -47
ok   desktop standings: overflow 0, bottom reach -48
ok   desktop tournaments: overflow 0, bottom reach -48
ok   desktop competitors: overflow 0, bottom reach -48
ok   desktop profile: overflow 0, bottom reach -47
ok   desktop ranks: overflow 0, bottom reach -48
ok   desktop hall: overflow 0, bottom reach -47
ok   desktop vault: overflow 0, bottom reach -47
ok   desktop heraldry: overflow 0, bottom reach -48
ok   desktop exchange: overflow 0, bottom reach -48
ok   desktop finance: overflow 0, bottom reach -48
ok   desktop library: overflow 0, bottom reach -489
ok   desktop replays: overflow 0, bottom reach -132
ok   desktop exhibition: overflow 0, bottom reach -48
ok   desktop academy: overflow 0, bottom reach -47
ok   desktop grimoire: overflow 0, bottom reach -84
ok   desktop settings: overflow 0, bottom reach -47
ok   desktop match: overflow 0
ok   phone dashboard: overflow 0, bottom reach -20
ok   phone play: overflow 0, bottom reach -21
ok   phone federation: overflow 0, bottom reach -21
ok   phone standings: overflow 0, bottom reach -20
ok   phone tournaments: overflow 0, bottom reach -20
ok   phone competitors: overflow 0, bottom reach -21
ok   phone profile: overflow 0, bottom reach -20
ok   phone ranks: overflow 0, bottom reach -20
ok   phone hall: overflow 0, bottom reach -21
ok   phone vault: overflow 0, bottom reach -21
ok   phone heraldry: overflow 0, bottom reach -21
ok   phone exchange: overflow 0, bottom reach -20
ok   phone finance: overflow 0, bottom reach -20
ok   phone library: overflow 0, bottom reach -70
ok   phone replays: overflow 0, bottom reach -21
ok   phone exhibition: overflow 0, bottom reach -20
ok   phone academy: overflow 0, bottom reach -20
ok   phone grimoire: overflow 0, bottom reach -21
ok   phone settings: overflow 0, bottom reach -21
ok   phone match: overflow 0
ALL CHECKS PASSED
```

## 390 px fixes in package U

* Federation: the section links (Divisions … Heraldry) now start on their own left-aligned line instead of a ragged,
  right-pushed first row; a fixture's details get the full row width with Play / Postpone / Forfeit wrapping below,
  instead of a one-word-wide text column (see before/after `phone-federation`).
* Ceremony overlay: safe-area padding and internal scrolling for cards taller than a short phone screen.
