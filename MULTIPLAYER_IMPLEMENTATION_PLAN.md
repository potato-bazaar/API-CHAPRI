# Chapri Racer multiplayer: implementation plan

Written for: you, approving the work, and the coding agent that will carry it out.

Status: **awaiting approval.** Nothing has been implemented. This turn added three documents to the repository root and changed no game code.

Read with: `MULTIPLAYER_ARCHITECTURE.md` (design and evidence) and `MULTIPLAYER_TEST_PLAN.md` (how each milestone is verified). Scenario letters (A to O) refer to the test plan's matrix. "Solo" means any race without the server, as defined in the architecture document.

---

## 1. How the work proceeds

- Milestones run in order, M0 to M9. Each one ends with a gate: its tests pass, an entry is written to `MULTIPLAYER_TEST_REPORT.md`, and work stops if anything is red.
- Each milestone's tests start with a fresh server process and clean browser contexts.
- A failing test is never disabled, skipped or edited to pass. A wrong test is recorded in `MULTIPLAYER_BUG_TRACKER.md` with the reason, and the question goes back to you.
- Work happens on a branch named `multiplayer`, created at M0. Nothing is committed or pushed unless you ask. Nothing is deployed.
- Solo gameplay is protected by golden trajectory tests captured from the current code before any refactor (M0).
- No database, no Redis, no serverless functions, and no new hosting until you have decided D11 and D12 (section 3).

---

## 2. Milestones

Sizes are relative effort: **S** is about one focused session, **M** is several, **L** is the largest and expects iteration.

| ID | Goal | Gate | Scenarios | Size | Main risk |
|---|---|---|---|---|---|
| M0 | Safety net: golden solo trajectories, assertion-based smoke test, test runner | `npm test` green on unchanged code | I, J | S | Golden hashes depend on determinism; see M0 notes |
| M1 | Server skeleton: Socket.IO on Node, origin checks, health, shutdown | Integration tests green | J (server-free boot) | S–M | Serving the game page from Node |
| M2 | Rooms and PIN (server only) | Room and PIN tests green | B, H | M | PIN brute force |
| M3 | Lobby UI in the browser | Three-context E2E green; solo smoke green | A (lobby part), B, L | M | Browser focus and gesture rules |
| M4 | Shared headless simulation core | Golden gates A and B green; determinism proven | C (isolation), I, J | **L** | Refactor regressions (main schedule risk) |
| M5 | Authoritative race loop and networking | Scenarios A, B, C, K, M green three times in a row | A, B, C, K, M | **L** | Prediction feel; sync under latency and loss |
| M6 | Race lifecycle and results | Countdown, results and rematch tests green | M, O | M | Stale state across races |
| M7 | Reconnection and host migration | Scenarios D, E and K (hidden tab) green, with real interruptions | D, E, K | M | Interruptions that look real but are not |
| M8 | Security hardening | Scenario F, fuzzing and PIN abuse green; no open critical or high findings | F, H, N | S–M | Trust boundary through stats and inputs |
| M9 | Production readiness and load | Acceptance suite passes three consecutive fresh-process runs | G, plus the acceptance composition in section 8 | M | Capacity on this 4-thread machine |

### M0. Safety net (no gameplay change)

- **Golden trajectory tool.** It runs the current simulation headless in Node for the six cup tracks, all in Quick mode: Mumbai Central (1 lap), Dharavi Lanes (1 lap), Mumbai Underground (2 laps), Sion Flyover (1 lap), Crawford Market (1 lap), and Bandstand Rush (1 lap). It pins `Date.now`, and it seeds `Math.random` so that Underground and stage tracks are reproducible (E3, E4). It records a state hash per simulated second and the final results. The baseline is committed. Bhaag Chapri Bhaag is police-only and is not part of v1.
- **Assertion-based smoke test.** `npm run test:race` (the existing `tools/t17.mjs`) will exit non-zero if the race does not finish or if the page logs an error. Today it only prints. Note that it runs Quick mode with rivals, so it is one human plus AI.
- **Vitest installed.** `npm test` runs the golden tests and an empty unit suite.
- **Reference stream.** Golden hashes use a 60 fps frame stream. Variable-frame behaviour (30, 60 and 144 Hz streams) gets its own baselines, so frame-rate changes are visible.
- **Branch.** Create the `multiplayer` branch.

**Exit:** `npm test` green on the unchanged code. A deliberate one-line change to physics makes the golden test fail, which proves it can catch regressions.

### M1. Server skeleton

- `server/` TypeScript project. `tsx` for development, `tsc` for builds (D12).
- Socket.IO 4.8.4 on a Node HTTP server. Settings come from environment variables (section 8.1 lists them).
- Origin check for both HTTP and Socket.IO handshakes.
- `GET /` serves the game page with a document wrapper (doctype, charset, viewport) that the server adds. The tracked `dist` file is unchanged (D11).
- `GET /socket.io/socket.io.js` is served by Socket.IO itself (E22).
- `GET /healthz` returns JSON with counts.
- Graceful shutdown on SIGINT and SIGTERM: close sockets and exit within 5 seconds.
- Structured JSON logs with connection IDs. Tokens are never logged.
- Connection limits (proposed, to confirm when measured): at most 1,000 sockets per process, at most 20 per address, and a payload limit of 100 KB per message (`maxHttpBufferSize`).

**Tests** (Vitest with `socket.io-client`, against a real server on an ephemeral port)
- Connect and disconnect, with logging.
- 50 concurrent clients connect and stay connected.
- Disconnected clients are detected within the heartbeat window.
- Malformed payloads (wrong types, unknown keys) get an `error` event (`BAD_REQUEST`) and do not crash the server.
- An oversize frame closes that connection. The client sees a disconnect, not an application error (E32). The server stays up.
- A disallowed origin is refused at handshake (`ORIGIN_DENIED`).
- SIGTERM closes every connection within 5 seconds, and clients observe the disconnect.
- `/healthz` returns 200. Unknown paths return 404.

**Exit:** integration tests green. `npm run server` serves the page, and the page loads from the server origin in a browser. Solo still loads with no server running and makes no socket connection (scenario J).

### M2. Rooms and PIN (server only)

- In-memory room manager.
- **Create.** PIN is 4 digits from a cryptographically secure source. A PIN already used by an active room is re-rolled. Active rooms are capped at 1,000.
- **Join.** Only `LOBBY` rooms are joinable, and the joinable room cap is 200. Capacity is 8. A repeated join with a valid token from the same seat is idempotent. Join attempts are limited: 20 failed attempts in 10 minutes per address, then a 30-minute lockout (`LOCKED_OUT`). The same limit applies per socket (R14, D15).
- Leave. Host transfer to the earliest-joined connected human. Ready state. Host-only settings, validated.
- **Cleanup timers.** Empty lobby removed after 60 s. Idle lobby expires after 10 minutes. Finished race room closed 120 s after the last human leaves.

**Tests** (unit and integration)
- **Scenario B (part).** Create a room. Eight players join; the ninth is refused with `FULL`.
- **Scenario H (part).** PIN is unique among active rooms. Invalid PIN returns `NOT_FOUND`. 1,000 random guesses from one address trigger the lockout, and the lockout expires after 30 minutes (fake clock).
- Joining during a race returns `RACING`. Leave. Host leaves and a new host is assigned.
- Empty room is deleted. A duplicate request creates no duplicate player.
- Idle lobby expires after 10 minutes, and a finished race room closes 120 s after its last human leaves (fake clock).
- 500 parallel creates give 500 unique PINs.
- A forced PIN collision is re-rolled.

**Exit:** all green.

### M3. Lobby UI

- The Friends button (`src/template.html:57`) opens **Play with friends**: Create room, or Join with PIN.
- **Lobby screen:** PIN badge, copy invite link, 8 seats with host badge and ready toggles, host-only settings (track, laps, weather, time of day, mode, difficulty), Start (host), and Leave.
- `?join=PIN` opens the join dialog with the PIN filled in.
- Notices (someone joined, left, disconnected) use the existing `flashNote`. The single-modal rule (`80_ui.js:51-57`) is respected.
- A socket client module that loads `/socket.io/socket.io.js` only when the player opens multiplayer. Solo never loads it.
- Solo race flow unchanged.

**Tests** (Playwright, three browser contexts, real server)
- **Scenario A (lobby part).** Three contexts create and join. All three see the same three-player roster within one second.
- One player leaves and the others update. The host leaves and the host role moves.
- **Scenario B (UI part).** Invalid PIN shows an error. The ninth player is refused with a message. The room accepts up to eight; sampled contexts (up to four) join.
- **Scenario L.** At 844 × 390 landscape, the lobby is usable with touch, and there is no horizontal scroll.
- Invite link opens the join dialog pre-filled in a second context.
- Solo smoke test still green.

**Exit:** green on three consecutive runs.

### M4. Shared headless simulation core

This is the largest milestone. It is split into two phases so that solo can be checked at each step.

**Phase A: injection only (solo golden hashes must not change at all)**
- Inject the race seed. The default is the current clock seed (`45_race.js:16`).
- Replace the browser-global reads in the rider with injected options: `steerAssist` and `DEBUG.autopilot` in the constructor (`40_rider.js:17`, `:31`), and `manualGears` and `wheelieAssist` in `step` (`:46`, `:150`). Defaults equal today's values.
- Route the rider's race draws (`40_rider.js:29`, `:31`, `:107-108`, `:279`, `:288`) through the injected generator, in the same order. The cosmetic draws at `:107-108` still consume the stream, so they keep their place in the sequence.
- Local seeds for the visual builds: `05_textures.js:20` and `20_world.js:15` stop reseeding the shared generator. Golden hashes stay identical because the race reseeds at construction.
- Persistence adapter for records, ghosts, coins and daily progress (`45_race.js:172-173`, `:239`, `:300`). Solo writes exactly as today. The server adapter does nothing.
- Rig becomes optional (`40_rider.js:18-19`).
- Headless presenter for the callbacks that Rider and Race fire into the HUD, audio and camera.
- **Gate A:** golden hashes identical for every baseline setup.

**Phase B: deliberate changes (golden regenerated, with a reviewed diff)**
- **Physics-only world builder.** Obstacles, shortcut blockers, kicker blockers and pickup spots come from one pure function of `Track`. The visual build calls the same function. Compare the obstacle lists with the old ones for every track.
- **Debris draws.** `21_stage.js:131` (`smashBarricade`) currently draws from the race generator. Move it to a visual generator.
- **Gameplay draws from `Math.random`.** Move `46_police.js:25`, `:87` and `:119` to the race generator. Police is out of v1 scope, so this is only needed for the engine's shared rules.
- **Underground.** `47_underground.js:43`, `:50` and `:66` already draw from the global stream, so they are routed through the injected race generator. `47_underground.js:80` keeps `Math.random` for its timing, but its `pick()` call stops drawing from the race generator.
- **Traffic with several humans.** Spawn, respawn and near-miss scoring (`47_underground.js:56-75`) key to the group of humans under decision D18, not to one local player (E31).
- **Multiplayer controller.** List of humans, per-rider `human` flag replacing `isPlayer` for AI gating (`45_race.js:79`, `:83`), race-end rule that does not depend on `playerDone`, sub-tick finish times, and a fixed tie-break. Solo keeps its existing rules.
- **Fixed-step entry point.** One tick is two substeps of 1/120 s.
- **Build.** `tools/build.mjs` emits `dist/sim-core.mjs` from the same ordered source list. Importing it in Node with no browser shim must succeed.
- **Gate B:** golden regenerated and reviewed, determinism proven, and the checks below pass.

**Checks**
- **Scenario I (determinism).** Same seed gives identical state hashes across separate processes, for every cup track, with 8 riders, one lap and two laps.
- **Scenario C (isolation).** Two rooms interleaved in one process match their solo replays.
- **Scenario J.** A solo race finishes, and the golden baselines are unchanged where Gate A requires it.
- A headless 8-human race finishes with scripted inputs.
- Per-tick cost, 8 riders: p95 under 2 ms on the test machine (E6 measured p95 0.26 to 0.53 ms).
- Memory for one physics-only room: under 2 MB (threshold to confirm when measured).

**Exit:** gates A and B green.

### M5. Authoritative race loop and networking

- **Server.** One 60 Hz timer drives every room. Per-seat input buffer keyed by `seq`, holding the last input for up to six ticks. Snapshots at 20 Hz. Sub-tick finish times. Results sent once per race.
- **Client.** Clock sync (`clock:ping`, median of eight). Interpolation buffer of 120 ms for remote bikes. Remote bikes are `Rider` objects with the human flag, fed from snapshots, so the existing visuals, HUD and audio work. The local bike is predicted through the shared core and corrected toward the server state with smoothing. Crash, lap and finish events come from `race:event`.
- **Input.** Keyboard and touch mapping unchanged. Input is also sent with a sequence number, after `INPUT.read` (`90_main.js:241`).

**Tests**
- **Scenario A.** Two humans in two browser contexts. Both see each other move. Both receive identical results.
- **Scenario B.** Eight humans: eight socket clients driving inputs headless, plus up to four browser contexts (sampled) for the visual path.
- **Scenario C.** Two rooms concurrently on different tracks. Server state matches the solo replay with the same seed and inputs.
- **Scenario K.** A client that loses focus or is hidden keeps receiving snapshots, the race continues on the server, and the display resumes on return. Where a background tab cannot be produced reliably in headless Chromium, this is recorded as a manual step.
- **Scenario M.** Countdown timestamps aligned across clients within 50 ms.
- **Sync quality.** Latency and jitter come from the TCP proxy in `tests/chaos/`: 100 ms one-way latency with 20 ms jitter. Packet loss is a 2% drop of incoming snapshots applied in the client by a test hook, because WebSocket runs over TCP and hides packet loss as latency. Under these conditions: remote bike position error p95 under 0.5 m, no visible local correction over 0.5 m, and no remote bike teleport over 3 m except on a crash or respawn event.
- **Stale packets.** A snapshot older than the newest applied one never overwrites newer state (unit).
- **Traffic.** On Mumbai Underground with several humans, traffic is identical on every client (R23).

**Exit:** all green on three consecutive runs.

### M6. Race lifecycle and results

- Countdown driven by server time, aligned across clients within 50 ms (scenario M).
- Only the host can start a race. A non-host start is rejected by the server.
- Results come from the server and are identical on every client.
- Race end rule: all humans finished or out. Unfinished AI keep their order by distance, as `ranking()` does today.
- Return to lobby. Rematch by the host with a fresh seed and reset state.
- Solo-only result buttons (restart, next track) are replaced in multiplayer (`80_ui.js:40-41`).

**Tests**
- **Scenario O.** Three consecutive rematches in one room with no stale state: laps, finish flags, timers, grid and seed all reset.
- Non-host start rejected. Results identical across clients.
- **Scenario M.** Countdown alignment within 50 ms.
- Race end when a human disconnects.

**Exit:** green.

### M7. Reconnection and host migration

- **Tokens.** Each seat has one token for its lifetime, and tokens do not rotate. A new socket that presents a valid token takes over the seat, and the old socket receives `SUPERSEDED` and is closed. The token is random, 128 bits, kept in server memory, and stored in `sessionStorage` (per tab), so it does not survive closing the tab.
- **Windows.** `session:resume` is accepted within 60 seconds in the lobby and within 60 seconds in a race.
- During a race, AI takes the seat while the human is away. Control returns if they resume within 60 s. After 60 s the AI keeps the bike to the finish, and the player is recorded as having left (D10).
- Lobby seat is held for 60 seconds. Host role moves on disconnect.

**Tests**
- **Scenario D.** Host disconnects in the lobby. Host role moves. The new host starts a race.
- **Scenario E.** A player is gone for 5 s and for 30 s mid-race. AI covers the seat. Reconnect restores the bike state within one snapshot.
- **Real interruptions only.** The TCP proxy cuts the connection, and CDP offline mode is used in the browser. `socket.disconnect()` alone does not count.
- **Scenario K (hidden tab).** The recovery path after a hidden tab is exercised, with the manual step recorded where automation cannot produce it.
- Disconnect during countdown. Resume after the room closed gives a clean error. A token used by another socket takes over the seat, and the old socket is refused with `SUPERSEDED`.

**Exit:** green.

### M8. Security hardening

- Zod schema for every event. Unknown keys are rejected. Payload size is capped (`maxHttpBufferSize`, 100 KB).
- Per-socket rate limit for each event type. Input rate: 60 per second accepted, excess dropped and counted, and a socket above 300 messages in any 5-second window is disconnected with `RATE_LIMITED`.
- PIN failure limits from M2 verified under abuse.
- Host-only actions enforced on the server.
- Inputs clamped and rate limited. The server ignores any client-reported position, lap, time or result.
- Stock stats enforced for everyone in v1 (D7).
- Tokens are never logged.

**Tests**
- **Scenario F.** Unauthorized start and settings changes, invalid moves, excessive input frequency, joining a full room, invalid PIN. Every attempt is rejected with a specific code and the race state is unchanged.
- **Scenario N.** 10,000 random or structured messages: no crash, memory bounded, and every invalid message gets an error event or a connection close, as specified.
- **Scenario H (abuse).** Sustained PIN guessing from one address hits the lockout, and the expected number of random joins matches R14.
- Oversize payloads close the connection (E32). Replayed old tokens are refused. A log scan finds no tokens.

**Exit:** green, with no open critical or high findings.

### M9. Production readiness and load

- **Environment variables** (documented, with `.env.example`): `PORT`, `ALLOWED_ORIGINS`, `LOG_LEVEL`, `TRUST_PROXY` (needed for per-address limits behind a reverse proxy), `MAX_SOCKETS`, `MAX_SOCKETS_PER_IP`, `MAX_ROOMS`, `MAX_LOBBY_ROOMS`, `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_TIMEOUT_MS`, and the PIN limits.
- TLS: WSS through the platform or a reverse proxy, depending on D11. A container image only if D11 approves it.
- Health check and metrics: event-loop lag, tick time, rooms, sockets, RSS, bytes per second.
- Graceful shutdown during active races. **Scenario G:** the server is restarted; old sessions are refused; clients show a notice; fresh rooms work; no stale state remains.
- Load harness in `tests/load/` (Node with `socket.io-client`, D13). Full load: 10 rooms of 8 humans (80 clients, D17) with 5-minute races, measuring CPU, RSS, event-loop lag, bandwidth per client, snapshot jitter, room cleanup and socket drops. Increase load until a threshold breaks, and report the first one that does.
- **Soak:** 30 minutes with rooms cycling, run once before the first acceptance run. Memory growth under 5% per hour (proposed threshold).
- **Cross-browser:** the smoke scenario (A) runs in Playwright Firefox and WebKit, or a manual check is recorded for each engine if those browsers cannot be installed here.
- **Acceptance runner** `tests/acceptance/run.mjs`: starts a fresh server for each of three complete runs. Each run includes every suite (unit, integration, golden, E2E, chaos) and the full load test at 5 minutes. Any failure stops the run.
- **Final report** sections are listed in section 8.

**Exit:** three consecutive complete acceptance runs pass with fresh processes. Capacity is documented from measurement, with the machine stated. No critical or high defects open.

---

## 3. Decisions for approval

Each row has a recommended default. Reply with "approve defaults" to accept them all, or name the IDs you want changed.

| ID | Decision | Recommended default | Alternative | What it affects |
|---|---|---|---|---|
| D1 | Physics approach | A: the real simulation core runs on the server (architecture, section 4) | B: clients simulate and the server only checks reported progress. Weaker: results are client-owned | Everything |
| D2 | Race composition | Human players fill seats; AI fills the rest up to 8 | Humans only, 2 to 8 racers | M4 and M5 scope; AI takeover |
| D3 | Modes in v1 | Quick and Elimination, with combat off in v1 (D4) | Add Gali Rumble (combat forced, 3 laps) later | Combat dependence |
| D4 | Combat in v1 (melee, bottles, gutka, pickups) | Off in v1 | On after M5 is stable | M4 scope (combat extraction) |
| D5 | Tracks in v1 | The six cup tracks, including Mumbai Underground. Traffic, nitro and burst main run on the server. Bhaag Chapri Bhaag excluded | Leave Mumbai Underground out to shorten M4 | M4 scope; R23 |
| D6 | Rewards | No coins, XP, records or ghosts from multiplayer races. Solo economy unchanged | Server-validated rewards later | R15 |
| D7 | Bike stats | Stock stats for everyone | A common capped tier that the host chooses, so everyone races at the same stats. Validated upgrades are not possible without accounts, because the server cannot check what a player owns | R10, fairness, M8 |
| D8 | Grid | Fair grid in multiplayer: the player is not last | Keep the solo "start last" grid | Fairness |
| D9 | Slow motion and winner's cutscene | Slow motion off in multiplayer. Cutscene plays after server results, client-side only | Skip the cutscene in multiplayer | R8, R9 |
| D10 | Disconnects | AI takes the seat while the player is away. If they return within 60 s, control returns. After 60 s the AI keeps the bike to the finish and the player is recorded as having left | The seat stays idle, coasting | M7 |
| D11 | Hosting and serving | One Node process serves the game and the socket. You provide the host and domain. The server adds the doctype wrapper when it serves the page. The tracked `dist/chapri-racer.html` is unchanged, so solo renders exactly as today. A container image only if you want one | Separate static host for the game and a WSS server (needs CORS) | M1, M9, R12 |
| D12 | Dependencies and language | socket.io 4.8.4; zod; vitest; TypeScript for the server only (`tsx` in development, `tsc` for builds) | Plain JavaScript with JSDoc and `node:test` (no TypeScript) | Toolchain |
| D13 | Load test tool | Node harness with `socket.io-client` | k6 with a Socket.IO-capable extension. k6 has no native Socket.IO client, so this is a deviation from the original plan | M9 |
| D14 | Pacing | Stop at each gate for your review | Run M0 to M2 unattended, then review | Process |
| D15 | PIN policy | 4 digits. Only `LOBBY` rooms joinable, capped at 200. 20 failed attempts in 10 minutes per address and per socket, then a 30-minute lockout (at most 720 guesses a day per address) | 6-digit PIN, or invite-link tokens instead of typed PINs | R14 |
| D16 | Autopilot and time-scale URL flags | Ignored in multiplayer | Keep `?autopilot` working for multiplayer test bots | Test tooling |
| D17 | Load target | 10 rooms of 8 humans (80 clients), run on the test machine (this i3 host or a comparable VM). The production host is chosen later under D11, and the load test is re-run there before launch | A different number, once the production host is chosen | M9 gate |
| D18 | Traffic with several humans | Traffic spawn, respawn and near-miss scoring keyed to the lead human (first place) | Keyed to all humans (more traffic, more CPU) | R23; M4 Phase B |

---

## 4. Tooling and dependencies

Added if D12 is approved:

- `socket.io@4.8.4`: server, and it serves its own browser client. Published 2026-09-25, more than two weeks before this audit (E23).
- `zod`: schema validation. The version is pinned when installed, and must be at least two weeks old at that time.
- `vitest`: unit and integration tests.
- `typescript` and `tsx`: server build and development.

Already present: `playwright` 1.64.1, with chromium 1248 installed. `three` 0.160.0.

Not added, by design: a database, Redis, an authentication provider, serverless tooling, and a CDN for the Socket.IO client.

---

## 5. Environment readiness (checked 2026-11-06)

- Node v24.18.0, npm 11.16.0. The npm registry is reachable.
- Playwright 1.64.1 with chromium 1248 in `~/.cache/ms-playwright`. System Chrome at `/usr/bin/google-chrome` as a fallback.
- Machine: Intel i3-1115G4, 4 threads. Load results from here are a lower bound on production, not a forecast. Report them as ratios and state the machine.
- `npm run build` reproduces the committed `dist/chapri-racer.html`. `npm run test:race` passes today.
- Measured on this machine: `World` construction 275 to 333 ms (E29); race construction about 34 ms on average after warm-up; per-tick cost as in E6.
- Audit spike scripts are in the session scratch directory. They become the starting point for `tests/golden/` and `tests/sim/`.

---

## 6. Schedule risks

- **M4 is the schedule risk.** Golden hashes stop a regression early, so the refactor is checked after each step.
- **Browser tests are slow.** SwiftShader rendering makes each page slow. Keep the browser test count small, and use headless integration tests wherever they can prove the same thing.
- **Capacity numbers are provisional** until measured on the chosen host.
- **Browser-only behaviour** (pause on hidden tab, fullscreen, audio unlock) can make tests flaky. Tests wait on state, not on sleeps.

---

## 7. Working agreement

- Branch `multiplayer`. Commits only when you ask. No pushes. No deploys.
- No secrets in the repository. Session tokens are random and kept in memory on the server.
- Each milestone ends with an entry in `MULTIPLAYER_TEST_REPORT.md`: what ran, the output, pass or fail.
- Tests are never changed to make them pass. A wrong test is written up in `MULTIPLAYER_BUG_TRACKER.md`, and the question comes to you.

---

## 8. Acceptance checklist and final report

### 8.1 Environment variables (proposed)

`PORT`, `ALLOWED_ORIGINS`, `LOG_LEVEL`, `TRUST_PROXY`, `MAX_SOCKETS` (1,000), `MAX_SOCKETS_PER_IP` (20), `MAX_ROOMS` (1,000), `MAX_LOBBY_ROOMS` (200), `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_TIMEOUT_MS`, `PIN_FAILURE_WINDOW_MS` (10 minutes), `PIN_FAILURE_LIMIT` (20), `PIN_LOCKOUT_MS` (30 minutes). Defaults are proposals for review.

### 8.2 Acceptance checklist

Status is "not started" for every multiplayer item. The solo baseline passes today (E28).

| Item | Verified in |
|---|---|
| Players can create rooms | M2, M3 |
| Rooms receive unique PINs | M2 |
| Players can join through PIN | M2, M3 |
| Players can join through invitation links | M3 |
| Room capacity is enforced | M2, M3 (scenario B) |
| Lobby state synchronizes | M3, M5 |
| Host permissions work | M2, M6, M8 |
| Race settings synchronize | M3, M6 |
| Countdown is synchronized | M6 (scenario M) |
| Actual game physics are integrated | M4, M5 |
| Multiple players see each other's movement | M5 (scenario A) |
| Movement stays smooth under tested network conditions | M5 (sync quality), M9 |
| Race progression is consistent | M4 (scenario I), M5 |
| Race results are calculated by the server | M5, M6 |
| Reconnection works | M7 |
| Host migration works | M2, M7 (scenario D) |
| Multiple independent rooms work | M4 and M5 (scenario C) |
| Room cleanup works | M2, M9 |
| No database dependency introduced | M9 review |
| No Redis dependency introduced | M9 review |
| No critical security issues remain | M8, M9 |
| Existing solo gameplay works | M0 golden and smoke, then every milestone (scenario J) |
| Automated tests pass | M0 to M9 |
| Browser tests pass | M3, M5, M6, M7 |
| Browser tests pass in Firefox and WebKit, or a manual check is recorded | M9 |
| Load tests pass at the declared target | M9 (D17) |
| Three consecutive complete acceptance-suite runs pass | M9 |

### 8.3 Final report sections

The final report to you contains, in this order:

1. The architecture as built, with any changes from `MULTIPLAYER_ARCHITECTURE.md` and why.
2. Every file changed, with the reason.
3. Run and deploy instructions, including environment variables.
4. Test results per suite, with the commands and exit codes.
5. Measured capacity, with the machine described.
6. Known limits (from `MULTIPLAYER_TEST_PLAN.md`, section 11).
7. Open defects, from the bug tracker.
8. A claim-to-test table: every claim names the test that verifies it, or says plainly that it is not verified.
