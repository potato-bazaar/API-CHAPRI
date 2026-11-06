# Chapri Racer multiplayer: current state

Date: 2026-11-06. Repository: /home/yuvraj/API-CHAPRI, branch main, commit 6b56f08.
This audit changed no repository files. The only new file is this report. The three MULTIPLAYER_*.md planning documents were already untracked before the audit.

## A. Executive summary

**Multiplayer is not implemented.** The repository has no server, no socket code, and no room, PIN, lobby, invitation, or networked-race code. The git history, stashes, reflog, and built game agree. Nothing supports the belief that room creation was implemented. A time-limited search of the owner's home directory also found no room or PIN server code.

What exists:
- Three planning documents, never committed. The implementation plan's own status line reads: "awaiting approval. Nothing has been implemented."
- A "Friends" button that opens a "Play with friends" dialog. The dialog says the room server "isn't switched on in this build yet" (src/template.html:57, 205-209).
- Global, Friends and Weekly leaderboard tabs, all disabled (src/js/80_ui.js:215-217).

What works: the solo game. The production build reproduces the committed file byte for byte, and the solo race test finishes with no errors recorded (with caveats in section F).

Headline numbers:
- Acceptance checklist: 0 of 27 items verified working.
- Weighted completion: about 2% (method in section B).
- Milestones M0-M9: 0 of 10 exit gates met.

Not testable: rooms, lobby sync, race sync, reconnection, security, and load. There is no server to test. The Friends dialog makes no network request and opens no socket.

## B. Completion percentage and method

- Source: the 27 items in MULTIPLAYER_IMPLEMENTATION_PLAN.md section 8.2.
- Scores: VERIFIED_WORKING = 1, PARTIAL = 0.5, IMPLEMENTED_UNVERIFIED = 0.25, anything else = 0.
- Result: one item scores. "Existing solo gameplay works" is PARTIAL (0.5). The solo race finishes in a test run, but the planned golden tests do not exist and the smoke script asserts nothing. 0.5 / 27 = 1.9%, shown as about 2%.
- Two items, "No database dependency" and "No Redis dependency", are met only because nothing was added. They can only be verified at M9, so they score 0. If you give them full credit, the figure becomes 2.5 / 27, about 9%.
- Milestones: 0 of 10 exit gates met. M0 needs `npm test`, Vitest, and golden tests. None exist. package.json has only `build` and `test:race`.

## C. Architecture

Existing (solo only):
- The game is one HTML file. tools/build.mjs concatenates src/template.html, src/style.css, and the files in src/js/ (in the order listed in that script) into dist/chapri-racer.html (2.8 MB). Three.js 0.160 loads from a CDN.
- All game state lives in the browser. Saves use localStorage.
- The game reads 17 URL options. None relates to rooms or joining.
- Absent: server code, server dependencies, a socket library in node_modules, server/, tests/, .github/ (no CI), a test runner, and lint or type-check configuration.

Planned (not implemented):
- A Node server with Socket.IO 4.8.4 in server/ (TypeScript), zod, Vitest, one 60 Hz loop for all rooms, a shared headless simulation core, a server-authoritative race, and 4-digit PINs with lockouts. Sources: MULTIPLAYER_ARCHITECTURE.md section 5 and MULTIPLAYER_IMPLEMENTATION_PLAN.md sections 2-3. Decisions D1-D18 await approval.

## D. Room creation and management: NOT_IMPLEMENTED

| Item | Status | Evidence |
|---|---|---|
| Create room | NOT_IMPLEMENTED | The Friends dialog has only a "×" and a "Got it" control (runtime). No room code in src/ (grep). |
| PIN generation, uniqueness, collision re-roll | NOT_IMPLEMENTED | No code (inspection). |
| Join by PIN, invalid code rejection | NOT_IMPLEMENTED | No join UI. `?join=4207` changes nothing (runtime). |
| Invitation links | NOT_IMPLEMENTED | No code. |
| Capacity of 8, leave, host assignment, host migration, empty-room deletion, stale cleanup, multiple rooms | NOT_IMPLEMENTED | No server to hold rooms. |

The dialog also shows a decorative "4 2 0 7" PIN (src/template.html:209). It is an example, not a real code, but it is visible.

## E. Lobby: NOT_IMPLEMENTED

Roster sync, join and leave broadcasts, host identity, ready state, settings sync, host-only permissions, the start button, and invitation links do not exist.

Two independent browser sessions each opened the Friends dialog and showed the same static text. Neither had WebSockets, and both had empty localStorage. This shows the sessions are isolated. It is not a multiplayer test.

## F. Racing

| Item | Status | Evidence |
|---|---|---|
| Server runs the bike simulation | NOT_IMPLEMENTED | No server. |
| Bike physics integrated into multiplayer | NOT_IMPLEMENTED | Physics runs only in the browser (see blockers below). |
| Inputs, positions, rotations, speeds, laps, checkpoints, collisions, and results sent or validated by a server | NOT_IMPLEMENTED | No server. Solo lap and checkpoint code was not inspected in this pass. |
| Solo race | VERIFIED_WORKING (smoke only) | See below. |

Solo race test (`npm run test:race`, run in a private copy): exit code 0, wall time 44.8 s, output `state: finished`, `err: null`, `crashedFrames: 0`. Caveats:
- tools/t17.mjs:8 stops the loop when `R.state` becomes 'finished'. At that point 6 of the 8 riders had finished. Pinku and Tinu had not. The run does not show that all riders finish.
- tools/t17.mjs has no exit-code logic, so the process exits 0 even when an error is recorded in the `err` field.
- The output lists 8 riders (you and 7 AI rivals). This matches the Friends dialog ("race the seven AI rivals") and the Quick Race description ("8 riders"). An earlier draft said 7; that was a misreading of the output.

Blockers to server authority (code inspection):
- 45_race.js:16: `RNG = mulberry32(Date.now() & 0xffff)`. The race is seeded from the clock, so a race cannot be replayed.
- 45_race.js:80: `steps = max(1, ceil(dt/(1/90)))`, `h = dt/steps`. The integration step depends on frame time. At 60 fps the step is 1/120 s. At 144 fps it is 1/144 s.
- 40_rider.js:17, 33, 49, 159: the physics reads `SAVE.settings.*` and `DEBUG.autopilot`. A headless or server run would need these replaced.

Solo race states (45_race.js): countdown (line 13), racing (line 71), finished (line 199). There is no WAITING or CLOSED state.

## G. Networking and synchronization: NOT_IMPLEMENTED

- Port probe (runtime): on ports 3000, 3001, 4000, 5000, 8000, 8080, 8081, 8787, and 9000, `/healthz`, the `/socket.io/` polling endpoint, and a WebSocket connection all failed with connection refused. No server is listening.
- The game JavaScript makes no network calls. A grep of src/js for fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, and socket.io found none. The `io(` matches are inside setPixelRatio and getPixelRatio.
- During the Friends dialog, 0 requests and 0 WebSocket connections occurred in a 3-second window (runtime).
- Tick rate, snapshots, interpolation, prediction, reconciliation, packet order, stale packets, latency, jitter, and divergence: NOT_IMPLEMENTED. There is nothing to measure.
- socket.io-client and Vitest are not installed in node_modules. The planned test harness cannot run yet.

## H. Race lifecycle

| State | Status | Evidence |
|---|---|---|
| WAITING | NOT_IMPLEMENTED | No such state. |
| COUNTDOWN | Solo only | 45_race.js:13 |
| RACING | Solo only | 45_race.js:71 |
| FINISHED | Solo only | 45_race.js:199 |
| CLOSED | NOT_IMPLEMENTED | No such state. |

Multiplayer countdown sync, results, rematch, return to lobby, and room cleanup are NOT_IMPLEMENTED.

## I. Reconnection and recovery: NOT_IMPLEMENTED

There are no session tokens, no reconnection, no host migration, and no server-restart handling. Every disconnect and reconnect scenario needs a server and cannot run. The planned AI takeover for disconnected players (D10) awaits approval.

## J. Security: NOT_TESTABLE (no server)

- There is no server-facing surface, so room authorization, PIN brute force, payload validation, rate limits, speed checks, result validation, and session tokens cannot be tested.
- The planned controls (20 failures in 10 minutes, then a 30-minute lockout; socket rate limits; origin checks) are design only: MULTIPLAYER_IMPLEMENTATION_PLAN.md section 3 (D15) and section 8.1.
- Client side: no secrets or tokens found. localStorage was empty in fresh sessions.

## K. Multiple rooms and load: NOT_EXECUTED (BLOCKED)

There is no server, so no 2x4, 8-per-room, or 10x8 (80 clients) runs were possible. CPU, RAM, event-loop lag, bandwidth, snapshot delivery, room isolation, and cleanup were not measured. No capacity is claimed.

For reference only, solo: test:race took 44.8 s wall time in this run. The test plan records 17.9 s. The difference was not investigated.

## L. Frontend

| Item | Status | Evidence |
|---|---|---|
| Friends dialog open and close | VERIFIED_WORKING (as a placeholder) | Opens on click. Closes with × and with Escape. No console errors. |
| Create room, join UI, PIN display, copy link, player list, countdown, results, error messages, disconnect indicators, reconnect UI | NOT_IMPLEMENTED | Not in the dialog or the page. |
| Leaderboard tabs | Disabled (static only) | src/js/80_ui.js:215-217. Not clicked in a browser. |
| Phone layout | PARTIAL | See defect M-1. |

Screenshots (outside the repository): `/tmp/claude-1000/-home-yuvraj-API-CHAPRI/c27f98c7-6c5a-4f00-b80d-649a64c87f9d/scratchpad/quick/` contains 01-load-desktop.png, 02-friends-desktop.png, 04-client-b-friends.png, 05-join-param.png, 06-mobile-landscape.png, 06-mobile-portrait.png, and 07-mobile-landscape-friends.png. Results are in friends-results.json and friends3-results.json in the same folder.

Browser checks used the working-tree build, served read-only, with `q=low&post=0&refl=0` so software rendering stays fast. Those options do not change the Friends dialog.

## M. Existing bugs and defects

**M-1. Phone layout uses a 980 px desktop width. Severity: Medium.**
- Location: src/template.html has no `<meta name="viewport">`. dist/chapri-racer.html has none either. tools/build.mjs adds the tag only to the test wrapper dist/test.html.
- Reproduce: open dist/chapri-racer.html in Chromium with phone emulation (844x390 or 390x844, isMobile). `document.documentElement.clientWidth` and `window.innerWidth` are both 980 in both orientations.
- Impact: the page is laid out for desktop and scaled down on phones. The screenshot shows it fits, with small text. It is not a crash.
- Fix: add the viewport meta tag to the template. Decision D11 says solo should render exactly as today and the tracked dist file stays unchanged, so the owner should choose between editing the template and rebuilding, or having the future server add the tag when it serves the page.
- Not verified: the rotate overlay in portrait.

**M-2. Decorative PIN in the Friends dialog. Severity: Low.**
- Location: src/template.html:209 (`.pin-demo`, spans "4 2 0 7").
- Reproduce: click Friends. Four visible digit boxes appear.
- Risk: players may read them as a live room code.
- Fix: remove the boxes, or label them as an example.

**M-3. The solo smoke test cannot fail. Severity: Medium.**
- Location: tools/t17.mjs:8 (stop condition and error capture). The script has no exit-code logic.
- Reproduce: run `npm run test:race` in a copy. It exits 0 even when riders do not all finish or an error is recorded.
- Fix: the M0 item in the plan. Assert that all racers finish and that no errors occur, and exit non-zero on failure.

**M-4. Withdrawn.** An earlier draft reported a rider-count mismatch, and it was wrong. tools/t17.mjs lists 8 riders (you and 7 AI rivals). RIVALS in src/js/00_core.js has 7 entries, so the Friends dialog's "seven AI rivals" and the Quick Race description "8 riders" are both correct.

**M-5. The planning documents are not committed. Severity: Low.**
- MULTIPLAYER_ARCHITECTURE.md, MULTIPLAYER_IMPLEMENTATION_PLAN.md, and MULTIPLAYER_TEST_PLAN.md are untracked (`git status`).
- Fix: commit them once the owner approves.

**M-6. Planned process artifacts are missing. Severity: Info.**
- The `multiplayer` branch (plan section 1) and MULTIPLAYER_TEST_REPORT.md (plan section 1, gate entries) do not exist.

**M-7. The test plan's "8 of 8 riders finish" claim is not what the script measures. Severity: Low.**
- Location: MULTIPLAYER_TEST_PLAN.md section 1, row for `npm run test:race`.
- Evidence: M-3 above. When the loop stopped, 6 of the 8 riders had finished.
- Fix: restate the claim after M0.

## N. Missing functionality

- The whole multiplayer system (sections D to K). Severity: Critical for the multiplayer goal.
- The server, tests, golden baselines, a test runner, the socket and zod dependencies, and CI. Severity: High.
- The gap between the owner's expectation and the repository. The next cycle has to start at M0, not at testing. Severity: High (process).

## O. Technical debt and architecture concerns

- The race is not deterministic: its RNG is seeded from the clock (45_race.js:16). This blocks golden tests and replays. Severity: High.
- The integration step depends on frame time (45_race.js:80). This blocks server-authoritative physics at a fixed step. Severity: High.
- The physics reads browser-side settings (40_rider.js:17, 33, 49, 159). This blocks headless use. Severity: High.
- No test assertions, no CI, no lint, no type checks. Severity: Medium.
- The build is one generated 2.8 MB HTML file, and the source order is a hard-coded list in tools/build.mjs. A new source file that is not in that list is not included. Severity: Medium.

## P. Exact remaining work (from the plan, awaiting approval)

| ID | Goal | Gate |
|---|---|---|
| M0 | Safety net: golden solo trajectories for the six cup tracks, an assertion-based smoke test, a Vitest runner, `npm test` | `npm test` green on unchanged code |
| M1 | Server skeleton: server/ in TypeScript, Socket.IO 4.8.4, origin checks, /healthz, graceful shutdown | Integration tests green; solo still loads with no server |
| M2 | Rooms and PIN, server only | Room and PIN tests green |
| M3 | Lobby UI | Three-context end-to-end tests green |
| M4 | Shared headless simulation core (largest schedule risk) | Golden gates A and B green; determinism proven |
| M5 | Authoritative race loop and networking | Scenarios A, B, C, K, M green three runs in a row |
| M6 | Race lifecycle and results | Countdown, results, and rematch tests green |
| M7 | Reconnection and host migration | Scenarios D, E, K green with real interruptions |
| M8 | Security hardening | Scenario F, fuzzing, and PIN abuse green; no open critical or high findings |
| M9 | Production readiness and load (10 rooms of 8) | Acceptance suite passes three consecutive fresh-process runs |

Decisions awaiting approval (plan section 3): D1-D18, each with a recommended default. Replying "approve defaults" accepts them all.

## Q. Recommended next priorities

1. Approve or change D1-D18. The plan says to stop at each gate for review (D14).
2. Start M0. Make tools/t17.mjs assert (fail on an error or an unfinished race), capture golden trajectories, and add a test runner. This makes the solo baseline trustworthy before any refactor.
3. Decide the phone viewport fix (M-1) under D11.
4. Decide on the decorative PIN (M-2).
5. If the room code exists anywhere else, send the path or branch. This search found none.

## R. Final acceptance checklist

Evidence type: I = code inspection, R = runtime, N = not testable here.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Players can create rooms | NOT_IMPLEMENTED | I, R |
| 2 | Rooms receive unique PINs | NOT_IMPLEMENTED | I |
| 3 | Players can join through PIN | NOT_IMPLEMENTED | I, R |
| 4 | Players can join through invitation links | NOT_IMPLEMENTED | I |
| 5 | Room capacity is enforced | NOT_IMPLEMENTED | I |
| 6 | Lobby state synchronizes | NOT_IMPLEMENTED | I |
| 7 | Host permissions work | NOT_IMPLEMENTED | I |
| 8 | Race settings synchronize | NOT_IMPLEMENTED | I |
| 9 | Countdown is synchronized | NOT_IMPLEMENTED | I |
| 10 | Actual game physics are integrated | NOT_IMPLEMENTED (solo physics runs: R) | I, R |
| 11 | Multiple players see each other's movement | NOT_IMPLEMENTED | N |
| 12 | Movement stays smooth under network conditions | NOT_IMPLEMENTED | N |
| 13 | Race progression is consistent | NOT_IMPLEMENTED | N |
| 14 | Race results are calculated by the server | NOT_IMPLEMENTED | N |
| 15 | Reconnection works | NOT_IMPLEMENTED | N |
| 16 | Host migration works | NOT_IMPLEMENTED | N |
| 17 | Multiple independent rooms work | NOT_IMPLEMENTED | N |
| 18 | Room cleanup works | NOT_IMPLEMENTED | N |
| 19 | No database dependency introduced | Met trivially, scored 0 | I |
| 20 | No Redis dependency introduced | Met trivially, scored 0 | I |
| 21 | No critical security issues remain | NOT_TESTABLE | N |
| 22 | Existing solo gameplay works | PARTIAL | R |
| 23 | Automated tests pass | NOT_IMPLEMENTED (no test runner) | I |
| 24 | Browser tests pass | PARTIAL (39 scripts, none asserts; 1 run) | R |
| 25 | Browser tests pass in Firefox and WebKit | NOT_IMPLEMENTED | I |
| 26 | Load tests pass at the declared target | NOT_EXECUTED (no server) | N |
| 27 | Three consecutive complete acceptance runs | NOT_IMPLEMENTED | N |

## S. Limits of this pass

- The background audit workflow was stopped to deliver quickly. Its agents had finished only partway. Not run: 38 of the 39 browser scripts; a line-by-line check of the claims in the three documents (only the plan's status line, the acceptance table, the build claim, and the script count were checked); the adversarial refutation pass; and the completeness review. The refutation was done by direct search instead: git refs, history, stashes, reflog, untracked and ignored files, node_modules, and a time-limited search of the home directory.
- Not inspected in detail: solo lap, checkpoint, and result code. The portrait rotate overlay.
- Earlier scratch folders outside the repository hold research material: a downloaded socket.io package, a spike, and scripts that verified the documents. None of it is part of the game.
- Repository changes: none. This report is the only new file.
