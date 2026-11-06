# Golden tests (tests/golden)

These tests pin the solo race simulation before any multiplayer code changes it (milestone M0).

## What is recorded

A golden run is one solo Quick race on one of the six cup tracks. The game's own autopilot drives the player, combat is on, and the save is a default save. The race advances one frame at a time through the game's own `raceFrame`.

Every simulated second, the harness hashes these fields for every rider: `dist`, `d`, `psi`, `v`, `y`, `lean`, `pitch`, `wobble`, `boost`, `lap`, `crashed`, `finished`, `finishT`, `eliminated`, and the number of completed laps. The race clock `raceT` is included. Each track is recorded at three frame streams: 60, 30 and 144 Hz. The 60 Hz stream is the reference.

## How a run is made repeatable

- Each run is a separate Node process (`worker.mjs`), so no state carries over between runs.
- The game source is read from `src/js` on every run, never from `dist/`. It becomes a headless module in `tests/golden/.cache` (git-ignored). Only the bare `three` import changes, to an absolute path.
- `Date.now()` and `new Date()` return a fixed time. `performance.now()` returns 0.
- `Math.random` is replaced by a seeded generator (seed 12345).
- Browser objects that a headless boot cannot create (renderer, HUD, effects) are stubs. Visual objects return nothing and read as 0, so a visual read cannot feed a physics value.

## Commands

- `npm test` runs the golden tests and the unit tests. Each baseline must match exactly. Runs must repeat across processes. A different seed must change the outcome.
- `npm run golden:capture` rewrites every baseline. Run it only after reviewing why the simulation changed. It refuses to write a baseline unless two runs agree and every rider finishes.

## Limits

- Human input is not covered. The player is driven by the autopilot, the same code path that `?autopilot` uses.
- The winner's entry cinematic does not run under autopilot (`45_race.js`, `playerDone`), so it is not covered.
- Floating-point results can change between Node versions. Each baseline records the Node version it was captured with. If that version changes, review the failure and recapture.
- Only the solo race is covered. Multiplayer is outside M0.
