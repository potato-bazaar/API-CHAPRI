# Chapri Racer multiplayer: test plan

Written for: you, approving the work, and the coding agent that will run these tests.

Status: **planning.** Nothing new has been built or tested yet. Section 1 records what runs today.

Read with: `MULTIPLAYER_IMPLEMENTATION_PLAN.md` (milestones and gates) and `MULTIPLAYER_ARCHITECTURE.md` (design and evidence). "Solo" means any race without the server (one human plus AI, in any mode), as defined in the architecture document.

---

## 1. Current state (checked 2026-11-06)

| What | Result |
|---|---|
| Browser scripts | 39 `tools/t*.mjs` files drive the game through Playwright. None asserts pass or fail, and none exits non-zero on failure. Most print `ERR` and exit 0 |
| `npm run test:race` (`tools/t17.mjs mumbai-central 1`) | Passes: finishes, 8 of 8 riders finish, no errors, 17.9 s. It runs Quick mode, which means one human plus AI |
| Unit tests | None. No test runner in `package.json` |
| Golden or determinism tests | None. Races are not reproducible today (`MULTIPLAYER_ARCHITECTURE.md` E3, E4) |
| Lint, type checking, CI | None. No `.github`, no ESLint, no TypeScript config |
| Multiplayer or networking tests | None. Nothing in `tools/` touches the Friends modal or any socket |
| Test harness | `tools/serve-test.mjs` routes the CDN and fonts locally. Its catch-all route serves the test page for every path on `http://chapri.test` (line 24), so a `/socket.io/` request would get HTML (E24) |
| Browsers | Playwright 1.64.1, chromium 1248 installed. System Chrome at `/usr/bin/google-chrome` |

Conclusion: the existing tests show that solo still runs. They do not show that solo is correct, and they cannot catch a wrong result. Milestone M0 fixes that before any multiplayer code exists.

---

## 2. Test levels and tools

| Level | Tool | What it proves | Location |
|---|---|---|---|
| Unit | Vitest | Room manager, PIN generation and limits, tokens, rate limiters, Zod schemas, snapshot encoding, stale-packet rule, finish tie-break | `tests/unit/` |
| Integration | Vitest with `socket.io-client`, real server on an ephemeral port | Protocol flows, validation, origin checks, shutdown, concurrency | `tests/integration/` |
| Golden and determinism | Node scripts (promoted from the audit spike) | Solo behaviour unchanged; reproducibility; isolation between rooms | `tests/golden/`, `tests/sim/` |
| End to end | Playwright, several browser contexts, real server, SwiftShader, `?q=low` | The real UI: lobby, race, results, reconnect | `tests/e2e/` |
| Network realism | TCP proxy (cuts, latency, jitter), CDP network emulation, offline contexts, application-level snapshot drops | Behaviour under latency, loss and real disconnects | `tests/chaos/` |
| Load | Node harness with `socket.io-client` | Capacity, memory, event-loop lag, bandwidth | `tests/load/` |
| Acceptance | Runner script | Full suite, three times, fresh processes each time | `tests/acceptance/run.mjs` |

Planned commands (D12 and D13 pending):

- `npm test`: unit, integration and golden. No browser. Fast.
- `npm run test:e2e`: Playwright suite.
- `npm run test:chaos`: proxy and network scenarios.
- `npm run test:load`: short load run. The full run is part of acceptance.
- `npm run test:acceptance`: three complete runs, each with a fresh server.
- `npm run test:race`: the existing solo smoke test, which will now assert.

Test IDs follow the pattern `LEVEL-AREA-NN`, for example `UNIT-ROOM-03`, so reports and the bug tracker can refer to them.

---

## 3. Scenario matrix

Scenarios A to G are the ones in the master prompt. H to O were added in the audit. The milestone column is the single source of truth for where each scenario is verified; the implementation plan repeats it.

| ID | Scenario | Level | Setup | Pass criteria | Milestone |
|---|---|---|---|---|---|
| A | Basic multiplayer | E2E (2 contexts), integration | One creates a room, the other joins by PIN, host starts, both move, both finish | Both see each other. Both receive identical results | M3 (lobby), M5 (race) |
| B | Eight-player room | Integration (8 clients), E2E (up to 4 contexts, sampled) | Eight join; a ninth tries | Eight join. Ninth gets `FULL`. Race runs with 8 humans | M2, M3, M5 |
| C | Multiple independent rooms | Integration (2 rooms of 8), golden (isolation) | Two rooms on different tracks, raced at the same time | No state leaks. Each race matches its solo replay with the same seed and inputs | M4, M5 |
| D | Host disconnection | Integration, chaos (TCP cut) | Three players; host connection cut | Host role moves. Others stay connected. New host starts a race | M7 |
| E | Network interruption | Chaos | Mid-race, one player's connection cut for 5 s, then for 30 s | AI covers the seat. Reconnect restores control. Bike state matches the server within one snapshot | M7 |
| F | Security | Integration | Non-host start; non-host settings; invalid moves; excessive input rate; full room; invalid PIN | Every attempt rejected with a specific code. Race state unchanged | M8 |
| G | Server restart | Integration, E2E | Several active rooms; server restarted | Old sessions refused. Clients show a notice. Fresh rooms work. No stale state | M9 |
| H | PIN brute force | Integration | 1,000 random guesses from one address | Lockout engages after 20 failures in 10 minutes. Expected random joins per address per day stay within 720 × joinable rooms / 10,000 (about 14 with 200 rooms, D15) | M2, M8 |
| I | Golden and determinism | Golden | Solo baseline; same seed in separate processes | Solo hashes unchanged in Phase A. Same seed gives identical hashes | M0, M4 |
| J | Solo regression | Smoke, golden, boot | Load the game with no server; run a solo race | Solo race finishes. Boot works offline. No socket connection attempted in solo | M0 onward, every gate |
| K | Focus and background | E2E (partly manual) | One client loses focus or is hidden during a race | Server keeps racing. Client resumes display on return | M5, M7 |
| L | Phone layout and touch | E2E with mobile emulation | 844 × 390 landscape; touch Join and Ready | Lobby usable. No horizontal scroll | M3 |
| M | Time sync and countdown | Integration, unit | Injected delays on the clock ping | Countdown alignment within 50 ms across clients | M5, M6 |
| N | Protocol fuzzing | Integration | 10,000 random and structured messages | No crash. Memory bounded. Every invalid message gets an error or a connection close, as specified | M8 |
| O | Results and rematch | Integration, E2E | Three races in one room, host rematches | No stale state (laps, finish flags, timers, grid, seed all reset) | M6 |

**Notes on the matrix**

- Scenario K can only be partly automated. Where a background tab cannot be produced reliably in headless Chromium, the check is recorded as a manual step with the date and result.
- Scenario L checks layout only. Real phone performance is manual.

---

## 4. Determinism and golden tests

These are the most important technical checks, because the server-authoritative design depends on them.

**Golden trajectory tests (solo, from M0)**

- Setups: the six cup tracks in Quick mode: Mumbai Central, Dharavi Lanes, Mumbai Underground (2 laps), Sion Flyover, Crawford Market, and Bandstand Rush. Bhaag Chapri Bhaag is police-only and is not part of v1.
- Each run records a state hash per simulated second and the final results. Hashed fields include each rider's `dist`, `d`, `psi`, `v`, `y`, `lean`, `pitch`, `wobble`, `boost`, `lap`, `finished`, `finishT`, and the race clock `raceT`. The race generator's state cannot be read from outside its closure, so its effect is checked through the rider fields. From M4, a draw count is added once the generator is injectable.
- Reference stream: `dt = 1/60`. Separate baselines for 30 Hz and 144 Hz streams, so frame-rate behaviour is recorded rather than assumed.
- Phase A (injection only) must produce identical hashes. Phase B (deliberate changes) regenerates the baselines, and each regenerated diff is reviewed and written up.

**Determinism tests (from M4)**

- Same seed, same inputs, same ticks gives identical hashes across separate processes, for every cup track, with 8 riders, one lap and two laps.
- Isolation: two rooms interleaved in one process give the same results as each run alone (scenario C).
- Sensitivity: different seeds give different outcomes. A test that always passes is a bug.
- Gameplay randomness on the server path comes only from the race generator. A test fails if `Math.random` is called from the sim core on the server path.

**Known facts that these tests must handle** (from the spike, re-run on 2026-11-06)

- Pinning `Date.now` alone makes `mumbai-central` reproducible, but not `mumbai-underground` or `bhaag-chapri`. Those tracks draw from `Math.random` during gameplay until M4 moves those draws to the race generator (E4, E26).
- Two races in one process interfere until each race has its own generator (E5).

---

## 5. Network realism

WebSocket runs over TCP, so the test design must respect what TCP can and cannot model.

- **Latency and jitter.** Injected by the TCP proxy in `tests/chaos/`, which delays the bytes it forwards. This works for every socket message. CDP network emulation is used for page loads and is not relied on for socket timing unless it is verified to apply to WebSocket frames.
- **Packet loss.** TCP hides packet loss as added latency. Loss of snapshots is therefore simulated at the application layer: a test-only hook in the client discards a chosen fraction of incoming `race:snap` messages. This tests what the interpolation and prediction code does when snapshots go missing. It does not model TCP behaviour. The hook exists only when the page is loaded with the test flag, and it is off in normal play.
- **Real interruptions.** Scenarios D and E use the TCP proxy to cut the connection (reset) and to black-hole it (no traffic, no reset). Socket.IO then detects the drop through its heartbeat. CDP offline mode is used for browser-level disconnects. `socket.disconnect()` does not count as a real interruption and is never used as the only evidence.
- **Heartbeat settings for tests** are shortened, so that drops are detected in seconds. Production values are set separately and tested too.

---

## 6. Browser test rules

- Each browser context has its own `localStorage`, so each player has their own save profile by default.
- Tests use `?test` (stays on the menu, no autostart). `?autopilot` is used only if D16 allows multiplayer bots.
- Rendering is kept cheap: `?q=low`, and viewport 480 × 270 for desktop or 844 × 390 for phones.
- Tests wait on state (`waitForFunction` on the game state, roster or tick), never on fixed sleeps.
- Every test records console errors and warnings, page errors, and failed network requests, including socket URLs. The current harness does not record failed requests, so this is a fix (section 7).
- On failure: screenshot, the logs above, and the server log for the room.

---

## 7. Harness fixes needed before multiplayer tests

These come from the tooling audit. They are needed before the multiplayer gates can be trusted.

1. **Assertions and exit codes.** `tools/t17.mjs` (the solo gate, changed in M0) must exit non-zero when the race does not finish or an error is logged. Other scripts can stay as they are, but no gate may rely on them.
2. **Route narrowing.** The `http://chapri.test/**` catch-all must not intercept `/socket.io/`. Multiplayer tests use the real server origin.
3. **Failed requests logged.** Add `requestfailed` handling so a blocked or failed socket connection is never silent.
4. **Multi-context helper.** One browser with N contexts, instead of one browser per call.
5. **Test hook.** A `window` object for multiplayer state (phase, roster, seat, tick, last snapshot time), available only with `?test`.
6. **Hygiene (optional).** `tools/t24.mjs` (line 26), `tools/preview/shoot.mjs` (line 3) and `tools/model/build-rider.mjs` (line 14) have hard-coded `/tmp/claude-0/...` paths. Fix them when the scripts are next used.

---

## 8. Metrics and thresholds

These are proposals. The first measurement on the chosen host sets the final values, and any change needs your approval. Where a metric has a pass limit and a target, both are shown: the limit fails the build, the target is the goal.

| Metric | Threshold | How it is measured |
|---|---|---|
| Server tick cost, 8 humans | p95 under 2 ms (pass limit) | Timing inside the tick loop, on the test machine. Audit baseline: mean 0.14 to 0.25 ms, p95 0.26 to 0.53 ms (E6) |
| Event-loop lag, p99, at target load | Under 20 ms | `perf_hooks` `monitorEventLoopDelay` |
| Snapshot cadence | 20 Hz, p95 jitter under 2 ms on the server | Server-side timestamps |
| Client interpolation underrun | Under 1% of frames | Test hook in the client |
| Remote bike position error vs server truth, p95 | Under 0.5 m at 100 ms latency | Server state compared with the client's rendered state |
| Visible local correction | None above 0.5 m at 100 ms latency with 2% snapshot loss | Client correction log |
| Remote teleports | None above 3 m between frames, except on a crash or respawn event | Client log |
| Bandwidth per client, 8 bikes | Pass limit 20 KB/s. Target 10 KB/s | Bytes per second at the server |
| Memory growth in soak | Under 5% per hour, measured as RSS | RSS over a 30-minute soak with rooms cycling. Note that E7 measured `heapUsed`, not RSS |
| World build time | Measured and reported, not gated (E29: 275 to 333 ms) | Timing around `new World` |
| Room cleanup | Empty lobby removed within 60 s; finished race room closed within 120 s | Timestamps in the room manager |
| Countdown alignment | Within 50 ms across clients | Client-side GO timestamps |
| Results agreement | 100% identical across clients | Compare the results payloads |
| Stale snapshots applied | 0 | Counter in the client |

---

## 9. Reporting

**`MULTIPLAYER_TEST_REPORT.md`**: one entry per milestone and per acceptance run.

- Date and time. Commit hash, once committing is approved. Until then, the state of the working tree.
- Commands run and their exit codes.
- Summary table: test ID, result, duration.
- For every failure, the seven questions from the master prompt: what failed, how it was reproduced, root cause, files changed, what changed, whether the original failing test now passes, and whether anything regressed.

**`MULTIPLAYER_BUG_TRACKER.md`**: one row per defect.

- ID, severity (critical, high, medium, low), status (open, resolved, regression, blocked), component, linked test ID, notes.
- Performance problems and security issues have their own sections, so they cannot be lost in the general list.

The final report sections are listed in `MULTIPLAYER_IMPLEMENTATION_PLAN.md`, section 8.3.

---

## 10. Acceptance (final gate)

The project is complete only when all of the following hold.

- Scenarios A to G pass. H to O pass, or have a recorded manual step with the date and result.
- Solo golden tests and the solo smoke test pass.
- Three consecutive complete acceptance runs pass, each with fresh processes. Each run includes every suite and the full load test at 5 minutes (D17). The 30-minute soak runs once before the first acceptance run.
- The smoke scenario (A) passes in Playwright Firefox and WebKit, or a manual check is recorded for each engine.
- No open critical or high defects.
- The load target (D17) is met, or the measured limit is reported to you and accepted.
- Every claim in the final report names the test that verifies it, or says plainly that it is not verified.

---

## 11. Known limits of these tests

State these in every report.

- **Software rendering.** SwiftShader is slow and differs from a real GPU. Browser tests check behaviour, not performance.
- **TCP.** Packet loss is simulated at the application layer (section 5). Real UDP-like loss is not tested because WebSocket does not use it.
- **Browsers.** Automation covers Chromium, and Firefox and WebKit only in the smoke check (section 10). Other engines need a manual check before release.
- **Machine.** Load results come from a 4-thread machine. They give ratios and bounds, not a production forecast.
- **Background tabs.** Scenario K is partly manual.
- **Determinism.** Golden and determinism tests cover the simulation. They do not cover visual or audio output, which is checked by the E2E tests and by screenshots.
