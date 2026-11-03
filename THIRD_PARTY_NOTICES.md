# Third-party software

## Shipped in the game build (runtime)

| Package | Version | License |
| --- | --- | --- |
| react | 19.2.0 | MIT |
| react-dom | 19.2.0 | MIT |
| scheduler | 0.27.0 | MIT (React dependency) |

All piece artwork, pixel portraits, icons and the brand mark are original to this project. No fonts
are bundled (system font stack). No network services are used.

## Development only (not shipped)

Build/test tooling from npm (Vite, TypeScript, Vitest, fake-indexeddb, tsx, @vitejs/plugin-react,
@types/*; licenses in the lockfile tree: MIT, ISC, Apache-2.0, BSD-3-Clause, CC-BY-4.0 for
caniuse-lite data). Playwright (Apache-2.0) is used from the environment for end-to-end tests.

**Fairy-Stockfish (GPL-3.0)** — used only as an independent rules oracle (`pyffish==0.0.90`) and as
a reference opponent in `tools/bench` (native build of commit
`3a95e072f8e60b94ad4d04a3c6d98129c772a301`, https://github.com/fairy-stockfish/Fairy-Stockfish).
It is **not** included in the repository, the build or the game. The committed files
`tests/fixtures/oracle_positions.json`, `tools/bench/openings.json` and `tools/bench/tactics.json`
contain positions/moves produced by running it (data outputs, not program code).
