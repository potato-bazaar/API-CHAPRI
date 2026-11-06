# Chapri Racer multiplayer: architecture

Written for: you, deciding whether to approve implementation, and the coding agent that will build it.

Status: Phase 1 audit complete. No game code has changed. Decisions that need your sign-off are in `MULTIPLAYER_IMPLEMENTATION_PLAN.md`, section 3. Test strategy is in `MULTIPLAYER_TEST_PLAN.md`.

Evidence date: 2026-11-06, gathered at commit b0dc4d7. HEAD is now 6b56f08 (street life, combat and controls overhaul), so section 3 must be re-verified at HEAD before M1. Section 3 tags each claim. Every claim was re-run, or read in source, and an independent reviewer checked each cited line against the source. The reviewer's corrections are applied below.

Terms: in these documents **solo** means any race without the server: one human plus AI, in any mode, including Quick. The code uses "solo modes" for modes without rivals (`45_race.js`). These documents do not use it that way.

---

## 1. Recommendation

Run the game's real race simulation on one Node.js server. The server owns every race outcome. Browsers send inputs, render server snapshots, and predict only their own bike.

This is possible because the audit spike ran the existing `Race` class in plain Node, with no source changes, using 8 AI riders on Mumbai Central. The race reached `finished` with no exceptions after about 86 to 88 seconds of simulated time, in a few seconds of wall-clock time. The physics does not need to be replaced with a fake. It needs to be made reproducible and safe to run for several races in one process.

Why not the alternatives:
- **Clients report positions or finish times.** Any client can report a finish it did not earn. The plan requires that clients send inputs, not results.
- **Deterministic lockstep.** The rider physics calls `Math.sin`, `Math.cos`, `Math.atan2`, `Math.exp`, `Math.pow` and `Math.tan` at about 16 sites (E30). ECMAScript lets engines differ in the last bits of these functions. One slow client would also stall every other player.

What has to change first. This is a refactor of existing code, not a rewrite:
1. **Reproducible randomness.** One global random stream, seeded from the clock, is shared by simulation, visuals and audio (spike blocker 1; `45_race.js:16`).
2. **A physics-only world.** Obstacles, pickup spots and barricades are created inside the visual `World` build. That build took 275 to 333 ms here (E29) and about 20 MB per race (E7).
3. **Browser singletons out of the simulation.** The rider reads `SAVE` and `DEBUG`, and the race writes `SAVE` mid-race (section 6).
4. **A multi-human race controller.** One local player is special throughout `Race` (`45_race.js:193-202`, `:79`).
5. **A fixed-step path for multiplayer only.** Solo keeps its current variable step, so solo feel does not change.

---

## 2. The game today

- **Stack.** Vanilla JavaScript with Three.js r160 from a CDN. About 6,000 lines of JavaScript in `src/js/`, concatenated by `tools/build.mjs` into `dist/chapri-racer.html`, a tracked, self-contained file (2.7 MB, with both bike and rider models embedded).
- **No server and no network code.** Nothing in `src/` uses WebSocket, `fetch`, XHR or EventSource. The only multiplayer trace is the Friends button. It opens a modal that says the room server "isn't switched on in this build yet", and it already describes 4-digit PIN rooms of up to 8 riders (`src/template.html:57`, `:204-207`).
- **Progress.** Solo save data lives in `localStorage` under `chapri-racer-save-v1` (`src/js/00_core.js:168`).
- **Simulation.** `Track` builds the centreline (`src/js/15_track.js`). `Rider` runs each bike's physics (`src/js/40_rider.js`). `Race` runs the race rules (`src/js/45_race.js`). Combat, police and underground logic live in `46_police.js`, `47_underground.js` and `50_combat.js`.
- **Presentation.** `World`, `BikeRig`, the HUD, audio, camera and post-processing read simulation state but do not change it, with two exceptions: the winner's cutscene and the time-scale hooks (section 6).
- **Game states.** `Game.state` runs `loading`, `menu` (with `garage` and `store`), `race` (with `paused`), and `results`. `Race.state` runs `countdown`, `racing`, `finished`. The local player's end-of-race events set `finished`: a finish, an elimination, or a police bust (`45_race.js:186`, `:191`, `:195`; `46_police.js:110`).
- **Tests.** 39 scripts (`tools/t*.mjs`) drive the game through Playwright and print results. None of them asserts or exits non-zero. `npm run test:race` passes today: all 8 riders finish, no errors. See the test plan for why that is weaker than it looks.

---

## 3. Evidence

Status key: **Re-run** = executed in this audit. **Source, checked** = read in source and independently re-checked by a reviewer. **Source** = read in source by the audit. **Audit map** = reported by a mapper and not separately re-checked.

| # | Claim | Evidence | Status |
|---|---|---|---|
| E1 | The race runs headless in Node with only a shim and no source changes. `state` becomes `finished` at 86.2 s of simulated time, after about 5,170 steps. The loop ends at 89.8 s (5,387 steps), when every rider has finished. The spike reported 87.9 s; the value varies per run | Spike `run-race.mjs`, re-run | Re-run |
| E2 | Races are reproducible when `Date.now` is pinned and `Math.random` is real, on `mumbai-central` | Spike `determinism.mjs`, case b3 | Re-run |
| E3 | Seeding `Math.random` alone does not make races reproducible, because the race seed comes from the clock: `RNG = mulberry32(Date.now() & 0xffff)` | Spike case b; `src/js/45_race.js:16` | Re-run; Source, checked |
| E4 | Two runs with `Date.now` pinned still differ on `mumbai-underground` and `bhaag-chapri` | Two runs each, `--pinDate=1000` | Re-run |
| E5 | Two races in one process interfere: race A alone and race A interleaved with race B give different results (`riders[0].pos` 7 vs 8) | Spike case d | Re-run |
| E6 | Per-tick cost from `bench.mjs`, two repetitions, visuals on and off: 8 riders mean 0.14 to 0.25 ms, p95 0.26 to 0.53 ms; 1 rider mean 0.02 to 0.04 ms. The spike report gave the same ranges | `bench.mjs`, i3-1115G4, Node 24.18 | Re-run |
| E7 | Memory, measured as `heapUsed` (not RSS): 8 races sharing one `World` use 34.6 MB (0.76 MB per race). 8 races with their own `World` use 192.7 MB (20.5 MB each) | `mem.mjs`, with and without `--own-world` | Re-run |
| E8 | Solo substeps depend on frame time: `steps = max(1, ceil(dt / (1/90)))`, `h = dt / steps` | `src/js/45_race.js:77` | Source, checked |
| E9 | At exactly 60 fps, solo takes two substeps of 1/120 s: `ceil(0.016667 × 90) = 2` | Arithmetic from E8; verified by reviewer | Source, checked |
| E10 | `Rider` physics arithmetic has no Three.js reads except in the constructor (`degToRad`, `new BikeRig`, `showWeapon`). The physics does call race callbacks that reach the rig, HUD, audio and camera. For example, `onRespawn` calls `r.rig.gesture` (`45_race.js:220`) | `src/js/40_rider.js:15`, `:18`, `:19`; callbacks listed in section 6 | Source, checked |
| E11 | `Rider` reads browser settings. During `step`: `SAVE.settings.manualGears` (`:46`) and `SAVE.settings.wheelieAssist` (`:150`). In the constructor: `SAVE.settings.steerAssist` and `DEBUG.autopilot` (`:17`, `:31`), cached per rider. `Race.update` reads `DEBUG.autopilot` every substep (`45_race.js:79`) | `src/js/40_rider.js` as cited | Source, checked |
| E12 | Finish time is the frame `raceT`, so riders who finish in the same frame get equal times. `ranking()` then returns 0 for ties, and the stable sort keeps `riders` array order | `40_rider.js:175`; `45_race.js:73`, `:80`, `:189-192`, `:254-257` | Source, checked |
| E13 | Laps are `floor(dist / T.L)` with no checkpoint validation. `lap` only increases. `cpSpacing` is used only to place respawns (`:221`) | `src/js/40_rider.js:174-175`, `:221` | Source, checked |
| E14 | `Race.state` becomes `finished` only in `playerDone` (`45_race.js:195`). `playerDone` is called for the local player's finish (`:191`), the local player's elimination (`:186`) and the police bust (`46_police.js:110`) | As cited | Source, checked |
| E15 | The winner's cutscene starts inside the physics call chain: `onLap` (`40_rider.js:175`) → `finish` (`45_race.js:189`) → `playerDone` (`:191-193`) → `startEntry` (`:200`). Its frame updates overwrite the winner's `dist`, `s`, `d`, `psi`, `v`, `lean`, `rpm`, `y`, `slide` and `sliding` during the first 1.9 s (`58_entry.js:46-52`), then only `v`, `sliding`, `lean` and `rpm` (`:52`) | As cited | Source, checked |
| E16 | Slow motion: At b0dc4d7, `45_race.js:63` multiplied dt by 0.35 while `slowmo > 0`, and a player knockdown set `slowmo` to 0.3 (`45_race.js:212`). **At 6b56f08 the knockdown slow motion is removed.** The scale is now 0.32 (`45_race.js:66`). `slowmo` is set to 0.85 on a UDAAN jump (`47_underground.js:53`) and to 0.8 or 1.1 for the takedown camera (`90_main.js:292`). Hit-stop (`45_race.js:65`, set by melee hits at `50_combat.js:129`) freezes the race clock for 50 to 80 ms. The winner's time scale is `58_entry.js:44`, applied at `90_main.js:278`. The results state also calls `race.update(dt)` (`90_main.js:244`) without the entry factor | As cited | Source, checked |
| E17 | The browser loop clamps dt to 0.1 s (`90_main.js:238`) and multiplies it by `DEBUG.timescale` (`:240`, default 1 from `00_core.js:26`) | As cited | Source, checked |
| E18 | `src/template.html` has no doctype, and `dist/chapri-racer.html` starts with `<title>`. `build.mjs` writes the unwrapped template to the tracked file (line 12). Only `dist/test.html` (line 13) is wrapped | `tools/build.mjs:12-13`; file heads | Source, checked |
| E19 | Importing the bundle boots the game (`90_main.js:388`). `00_core.js` reads `location.search` at load (`:23`) and calls `matchMedia` and references `window` at load (`:30`) | As cited; spike needed a shim for these | Source, checked; Re-run |
| E20 | `Track` is math-only (`THREE.Vector3`, `CatmullRomCurve3`, `15_track.js:9-13`) and deterministic per track id (`:36`). It depends on helpers defined in `00_core.js`: `wrapAngle`, `mulberry32`, `hashStr`, `clamp`, `lerp` and `sstep`. The spike built a `Track` headless | `src/js/15_track.js`; `src/js/00_core.js` | Source, checked; Re-run |
| E21 | The `World` is cached and reused across races on the same track (`90_main.js:68-74`). `applyQuality` resets the key (line 54), which forces a rebuild | As cited | Source, checked |
| E22 | Socket.IO 4.8.4 serves its own browser client by default (`dist/index.js:121`: `serveClient` defaults to true). The browser bundles are in `client-dist/`: `socket.io.js`, `socket.io.min.js` and others | Package source, `npm pack` into a scratch directory | Package source |
| E23 | Socket.IO 4.8.4 was published 2026-09-25, more than two weeks before this audit | `npm view socket.io time --json` | Re-run |
| E24 | The test harness routes every path on `http://chapri.test` to `dist/test.html` | `tools/serve-test.mjs:24-25` | Source, checked |
| E25 | Modes (`00_core.js:130-136`): Quick and Elimination have rivals and combat (Elimination runs 7 laps). Rumble has rivals with combat forced (3 laps). Time Trial and Stunt have neither. Police has no rivals, forces combat, and runs only on `bhaag-chapri` | As cited | Source, checked |
| E26 | Gameplay randomness outside the race stream: dog run speed (`46_police.js:25`) and shooter timers (`:87`, `:119`) use `Math.random`. The honk timer (`47_underground.js:80`) uses `Math.random` to decide whether `pick()` draws from the race stream. E4 confirms the effect on two tracks | Audit map; E4 | Audit map; Re-run (E4) |
| E27 | `npm run build` reproduces the committed `dist/chapri-racer.html` byte for byte (`git status` clean) | Re-run | Re-run |
| E28 | The solo smoke test passes: finished, 8 of 8 riders, no errors, 17.9 s. `t17` sets no mode, so the default Quick mode runs, with rivals | `npm run test:race`; `tools/t17.mjs`; reviewer check | Re-run; Source, checked |
| E29 | `World` construction takes 275 to 333 ms on this machine (98,478 triangles), across two runs. The spike's own run reported 148 ms | `timing.mjs`, re-run | Re-run |
| E30 | Math call sites in `40_rider.js`: 6 `sin`, 5 `cos`, 2 `atan2`, 1 `exp`, 1 `pow`, 1 `tan` | grep | Re-run |
| E31 | Underground traffic spawn, respawn and near-miss scoring are keyed to the local player: `P = R.player` (`47_underground.js:56`), spread when a zone is near `P` (`:62`), respawn relative to `P.s` (`:69-70`), near-miss scoring (`:73-75`) | As cited | Source, checked |
| E32 | engine.io sets the WebSocket `maxPayload` to `maxHttpBufferSize` (`build/server.js:488-491` in engine.io 6.6.11). An oversize frame is refused by the `ws` library, which closes the connection. The client sees a disconnect, not an application error | Package source | Package source |

---

## 4. Options considered

| Option | Physics fidelity | Cheat resistance | Effort | Main risk | Verdict |
|---|---|---|---|---|---|
| **A. Server runs the real simulation core** | Identical code on server and browser | Server owns results and positions | Medium to large refactor (section 6) | Refactor touches many files; solo regression | **Recommended** |
| B. Clients simulate; server checks reported progress | Identical code | Low: a client can report any progress within the checks | Small | Results are client-owned, which breaks the plan's rules | Fallback only |
| C. Deterministic lockstep | Only if identical across browsers. ECMAScript permits last-bit differences in `Math` functions, and `40_rider.js` calls them at about 16 sites (E30) | Medium: results agree, but inputs are visible | Medium | One slow client stalls the room; divergence is hard to debug | Not recommended |
| D. Run the whole browser bundle in Node with DOM stubs | Identical code | Server owns results | Small, for a prototype | About 20 MB and 275 to 333 ms per world (E7, E29), boot on import, and module-level state shared across rooms | Test harness only, not production |

Option D is what the spike used. It proves feasibility but cannot be the production design: the world is built for rendering, the bundle boots the game on import, and mutable module state would be shared between rooms.

---

## 5. Design

### 5.1 Topology

```
Browser A ─┐                     ┌──────────────── one Node.js process ─────────────────┐
Browser B ─┼─ Socket.IO over WSS ┤ HTTP: game page (wrapped doctype), /healthz,         │
Browser N ─┘                     │       /socket.io/socket.io.js (served by Socket.IO) │
                                 │ Room manager: PIN, seats, host, lifecycle           │
                                 │ Race loop: one 60 Hz timer drives every room        │
                                 │ Sim core (shared with the browser, headless):       │
                                 │   Track · Rider · Race rules · physics world data   │
                                 │ Snapshot encoder: 20 Hz per room                    │
                                 │ All state in RAM (Maps). No database. No Redis.     │
                                 └─────────────────────────────────────────────────────┘
```

- One process. Scaling out is a later decision, after load tests.
- The server serves the game page, so the browser and the socket share one origin and need no CORS for the game itself.
- Solo play still works by opening the file directly, with no server.

### 5.2 Authority

| State | Owner | Why |
|---|---|---|
| Bike position, speed, lean, wobble, crash state | Server (sim core) | Results depend on it |
| Lap count, lap times, finish order and times | Server | Plan requirement: server-calculated results |
| Pickups, hits, traffic, barricades (when enabled) | Server | Shared world state; clients must agree |
| Race seed, seat assignment, countdown start | Server | Reproducibility and fairness |
| Own bike between snapshots | Client prediction, corrected toward the server | Responsiveness |
| Other bikes between snapshots | Client interpolation of server snapshots | Smooth display |
| Camera, HUD, audio, post effects, cutscene | Client | Presentation only |
| Player's appearance and name | Client, sanitized by the server | Cosmetic |
| Stats used for physics | Server (stock stats in v1; see decision D7) | A client must not set its own top speed |
| Coins, XP, records, ghosts | Client (solo only, as today) | Multiplayer v1 does not award rewards (decision D6) |

### 5.3 Simulation contract

- **Tick.** The server ticks at 60 Hz. Each tick runs two substeps of 1/120 s. That is the substep solo uses at exactly 60 fps (E9), and it does not depend on frame rate.
- **Order within a tick.** For each substep: AI `think` for AI riders, `step` for every rider, then `interactions`. Once per tick: AI fight decisions, combat, stage, underground and police updates (when enabled), coin collection, scoring, and then snapshot encoding (every third tick, which gives 20 Hz).
- **Randomness.** Each race has its own generator, seeded by the server when the race starts. AI decisions and any gameplay randomness draw only from it. Visual and audio randomness keeps using `Math.random` and never touches the simulation.
- **Inputs.** The client sends `{seq, throttle, brake, rear, steer, back, boost, act?}` at up to 60 Hz. Each tick the server applies the newest `seq` it has received for that seat. Older packets are dropped. If no new input arrives, the last input is held for up to six ticks (100 ms); after that the bike receives neutral input (throttle 0, brake 0, no boost). Values are clamped to their ranges. Input messages above 60 per second are dropped and counted. A socket that sends more than 300 messages in any 5-second window is disconnected with `RATE_LIMITED`.
- **Finish.** The finish time is the sub-tick crossing time, not the frame or tick time. Ties go to the earlier crossing time, then to the lower seat number. Both rules are deterministic.
- **Race end.** A race ends when every human has finished or is out. Unfinished AI riders keep their current order by distance, as `ranking()` already does for unfinished riders.

### 5.4 Race lifecycle (server)

```
LOBBY ──start (host)──▶ COUNTDOWN ──3.4 s, server clock──▶ RACING ──all humans done──▶ RESULTS
  ▲                                                                                   │
  └────────────── leave / rematch (host) ─────────────────────────────────────────────┘
```

- The joinable room phase is `LOBBY`. There is no separate `WAITING` state.
- `COUNTDOWN` reuses the existing 3.4 s countdown, driven by the server clock.
- **Disconnect in lobby:** the seat is held for 60 s and the player can resume with its token.
- **Disconnect in race:** AI takes over the seat while the player is away. If they return within 60 s, control returns. After 60 s the AI keeps the bike to the finish, and the player is recorded as having left (decision D10).
- **Tokens.** Each seat has one token for its lifetime. Tokens do not rotate. A new socket that presents a valid token takes over the seat. The old socket receives `SUPERSEDED` and is closed. The token is random, 128 bits, kept in server memory, and stored by the browser in `sessionStorage` (per tab).
- **Room cleanup:** empty lobbies are deleted after 60 s. Finished race rooms are closed 120 s after the last human leaves. Idle lobbies expire after 10 minutes.

### 5.5 Protocol (proposal, validated with Zod at the boundary)

| Direction | Event | Payload | Rules |
|---|---|---|---|
| C→S | `room:create` | `{name, look}` | Ack: `{ok, pin, seat, token}` |
| C→S | `room:join` | `{pin, name, look, token?}` | Joinable only in `LOBBY`, capacity 8, rate limited. A valid `token` from the same seat resumes it (idempotent). Ack: `{ok, seat, token, phase}` or `{ok: false, code}` |
| C→S | `room:leave` | `{}` | |
| C→S | `room:ready` | `{ready}` | |
| C→S | `room:settings` | `{track, laps, weather, time, mode, diff}` | Host only; `LOCKED` from countdown until results |
| C→S | `race:start` | `{}` | Host only; `LOBBY` to `COUNTDOWN` |
| C→S | `race:input` | `{seq, throttle, brake, rear, steer, back, boost, act?}` | At most 60 accepted per second per socket |
| C→S | `race:return` | `{}` | Host only, after results |
| C→S | `session:resume` | `{token, pin}` | Inside the grace window; takes over the seat (section 5.4) |
| C→S | `clock:ping` | `{t0}` | Answered immediately with server time |
| S→C | `room:state` | `{pin, host, seats[], settings, phase}` | Sent on every change. `phase` is `LOBBY`, `COUNTDOWN`, `RACING` or `RESULTS` |
| S→C | `race:countdown` | `{goAt, serverNow}` | Server timestamps |
| S→C | `race:snap` | `{tick, t, bikes[]}` | 20 Hz; quantized (see below) |
| S→C | `race:event` | `{kind, seat, t}` | `kind` is `crash`, `lap`, `finish`, `knockdown` or `respawn` |
| S→C | `race:results` | `{order[], times[], serverT}` | Sent once per race |
| S→C | `room:closed` | `{reason}` | |
| S→C | `error` | `{code, message}` | Codes below |

**Payload shapes (proposal):**
- `seats[]` items: `{seat, name, look, ready, human, connected, host}`.
- `name`: 1 to 16 characters after filtering. `look`: appearance ids only (tank, accent, shirt, hair, mods). The server checks every id against its own table and drops unknown ones.
- `act`: `{kind: 'respawn'}` or `{kind: 'gear', dir: -1 | 1}` in v1. Combat actions (`melee`, `throw`) are added only if D4 is changed.
- `bikes[]` (snapshot), quantized: positions to 1 cm, speeds to 0.01 m/s, angles to 1 mrad, flags as a bit field (boosting, crashed, air, finished, eliminated, invuln, sliding, tuck, back). Per bike: `seat, dist, d, psi, v, y, lean, pitch, wobble, rpm, throttle, back, flags, lap`.
- The snapshot size target is at most 10 KB per second per client at 8 bikes (a goal). The pass limit is 20 KB/s, measured in milestone M9.

**Error codes:**

| Code | Meaning |
|---|---|
| `BAD_REQUEST` | Payload failed its schema (wrong type, unknown key, out of range) |
| `NOT_FOUND` | No joinable room with that PIN |
| `FULL` | Room already has 8 humans |
| `RACING` | Room is in a race and cannot be joined |
| `LOCKED_OUT` | Too many failed PIN attempts from this address; retry after the lockout |
| `RATE_LIMITED` | Too many messages of this kind |
| `NOT_HOST` | Host-only action attempted by another seat |
| `LOCKED` | Settings or start not allowed in the current phase |
| `BAD_TOKEN` | Token unknown or expired |
| `SUPERSEDED` | Another socket took over this seat |
| `NOT_IN_ROOM` | Action needs a seat |
| `ROOM_CLOSED` | Room was closed |
| `SERVER_BUSY` | Room or socket limit reached |
| `ORIGIN_DENIED` | Connection refused at handshake (not sent as an event; the connection is refused) |

### 5.6 Clock sync and countdown

- The client measures its offset to server time with `clock:ping`, taking the median of eight samples at connect and refreshing every 30 seconds.
- `race:countdown` carries server timestamps. Each client starts its countdown UI at `goAt` after correcting for its offset.
- The countdown branch in `45_race.js:65-68` fires `hud.countdown` and `AUDIO.beep` from the local state. The server-driven start must still set the countdown state, or the HUD and music do not run.

### 5.7 Client changes

- **New modules.** A lobby screen (PIN badge, roster, ready, host settings, start, leave). A network module (socket, clock sync, snapshot buffer, prediction). A remote-bike presenter that feeds the existing `Rider` objects from snapshots. A remote rider is a `Rider` with a `human` flag and no physics of its own, so the HUD, audio and camera work unchanged.
- **Existing loop.** Input is sent after `INPUT.read` (`90_main.js:241`). Snapshots are applied before `raceFrame` (`90_main.js:260`).
- **Multiplayer ignores** `?timescale` (`90_main.js:240`), slow motion (`45_race.js:63`), the winner's time scale (`90_main.js:278`), pause on hidden tabs (`90_main.js:43`, which only applies while the state is `race`), the pause menu (`90_main.js:180`), and `?autopilot` for humans.
- **Fullscreen and orientation** requests move from `startRace` (`90_main.js:155`, touch devices only) to the Join or Ready click, because they need a user gesture.
- **Prediction.** The local bike runs through the shared core at the fixed step with local inputs. It is corrected toward the server state with smoothing. Exact replay is not used, because contacts with other bikes depend on states the client only approximates.

### 5.8 Rules for solo (must not change)

- The solo variable-step path, its RNG consumption order, the save format, the URL options, and the existing test scripts keep working.
- Refactors that change how solo consumes random numbers are a deliberate, documented step. Golden trajectory hashes are captured from the current code before any change (milestone M0), so every step is checked.

### 5.9 Origin and hosting

- The server adds a document wrapper (doctype, charset, viewport) when it serves `/`. The tracked `dist/chapri-racer.html` stays a fragment (E18) and is not changed, so solo renders byte-identically (decision D11).
- The Socket.IO client loads from `/socket.io/socket.io.js` on the same origin (E22). No new CDN dependency is added.
- Solo keeps working from `file://`. Multiplayer needs a server. A `?server=` parameter is available when the page is opened from elsewhere, with an origin allowlist on the server.
- Production: one persistent Node process behind TLS (WSS). Not a serverless function. A container image is optional and only if D11 approves it.

---

## 6. Simulation-core changes (what changes in existing files)

Each row is a change to existing code. The last column says how solo is protected.

| File (lines) | Change | Why | Solo protection |
|---|---|---|---|
| `00_core.js:11-16`, `:23`, `:30`, `:168-192` | Move the pure helpers and tables (`mulberry32`, `hashStr`, `wrapAngle`, `clamp`, `lerp`, `sstep`, `G`, `buildStats`, tables) into a module that loads without a browser. Keep `URLP`, `DEBUG`, `SAVE` and `persist` in the browser part | Import without browser globals; `15_track.js` needs `wrapAngle`, `clamp`, `lerp`, `sstep` (E20) | Same values, same functions |
| `00_core.js:12` | Add an injectable race generator. The module-level generator stays as the default for solo | Two races per process must not interfere (E5) | Default seed path unchanged |
| `05_textures.js:20` | Use a local seed for visual textures instead of reseeding the shared generator | Visual builds must not touch the race stream | Golden hashes unchanged (the race reseeds at construction, so this affects visuals only) |
| `15_track.js` | None to physics; import helpers from the pure module | Already math-only (E20) | Unchanged |
| `20_world.js:15` | Local seed for visuals only | As above | Golden hashes unchanged |
| `20_world.js:602-622`, `:631`, `:697`, `:773-783` | Extract obstacle, shortcut blocker, kicker blocker and pickup-spot data into a pure function of `Track`. The visual build calls the same function | Physics-only world, without the visual build cost (E29) and memory (E7) | Visual output unchanged; obstacle list compared with the old one for every track |
| `21_stage.js:131` | Debris draws (`smashBarricade`, which uses the race generator today) move to a visual generator | Stop barricade smashes from shifting AI draws | Deliberate change in Phase B; golden regenerated and documented |
| `40_rider.js:17`, `:31`, `:46`, `:150` | Read `assist` (constructor, `:17`), `DEBUG.autopilot` (constructor, `:31`), `manualGears` (`:46`) and `wheelieAssist` (`:150`) from the rider, not from `SAVE` or `DEBUG` | Multi-human server; no singleton reads (E11) | Solo passes the same values |
| `40_rider.js:18-19` | Rig is optional; headless riders have no rig | Memory and no Three.js objects on the server | Solo still creates a rig |
| `40_rider.js:29`, `:31`, `:107-108`, `:279`, `:288` | Draw from the race generator, in the same order | Reproducibility (E3). The cosmetic draws at `:107-108` (suspension chatter) still consume the shared stream, so they keep their place in the sequence in Phase A | Phase A keeps the sequence, so golden hashes stay identical |
| `40_rider.js:175` | `onLap` receives the sub-tick crossing time in multiplayer | Fair ties (E12) | Solo keeps the frame time |
| `45_race.js:16` | Seed injected; default = clock seed (solo) | Reproducibility (E3) | Default unchanged |
| `45_race.js:34-41` | Grid: a fair-grid option for multiplayer. In rival modes the player starts last (`:36-37`); other modes place the player at -4 m (`:38`) | Last place is unfair with several humans (decision D8) | Solo grid unchanged |
| `45_race.js:63`, `:212` | Slow motion disabled in multiplayer | Shared clock (E16) | Solo unchanged |
| `45_race.js:79`, `:83` | `think` and `aiFight` skip humans by a per-rider flag, not by `isPlayer` | Multi-human (E14) | Solo: the local player keeps `isPlayer` |
| `45_race.js:172-173`, `:239`, `:300` | Route records, ghosts, coins and daily progress through a persistence adapter. The server adapter does nothing | The server must never write `SAVE` (section 1, item 3) | Solo adapter writes exactly as today |
| `45_race.js:186-195` | Multiplayer race end is decided by the race controller, not by `playerDone` | `finished` must not depend on one local player (E14) | Solo path unchanged |
| `45_race.js:195`, `:201` | No `performance.now` or `setTimeout` on the server path | Headless | Solo unchanged |
| `45_race.js:253-261` | `ranking()` takes sub-tick crossing time and uses a fixed tie-break | Fair ties (E12) | Solo ties keep array order |
| `46_police.js:25`, `:87`, `:119` | Gameplay draws use `Math.random` today. Move them to the race generator | Reproducibility (E26) | Deliberate change (police is out of scope for v1) |
| `47_underground.js:43`, `:50`, `:66` | Traffic draws already use the global stream. Route them through the injected race generator | Reproducibility on Mumbai Underground (E4) | Phase B; golden regenerated and documented |
| `47_underground.js:56-75` | Traffic spawn, respawn and near-miss scoring are keyed to the group of humans, not to one local player (E31). Decision D18 sets the rule | Several humans would otherwise see different traffic | Solo keeps the single local human |
| `47_underground.js:80` | The honk keeps `Math.random` for timing, and its `pick()` call stops drawing from the race generator | Its draw decides when `pick()` consumes the stream (E4) | Phase B; golden regenerated |
| `47_underground.js:91` | UDAAN slow motion disabled in multiplayer | Shared clock (E16) | Solo unchanged |
| `50_combat.js:112-124`, `:141`, `:159`, `:161`, `:254` | Combat is out of v1 scope (D4). For v2: the combat draws are routed through the race generator; `helmet` is read from the rider; `hit()` writes `lastHitBy`, so when two hits land in one frame the later attacker wins (`:119`) | Multi-human; reproducibility; fairness | Only matters if combat is enabled |
| `58_entry.js:11`, `:44`, `:46-53` | Multiplayer: the cutscene plays after server results, reads a copy of the winner's state, and never writes sim state (E15) | The cutscene must not change the server's bike | Solo cutscene unchanged |
| `70_hud.js:20`, `:31`, `:33`, `:40-43` | Standings and minimap use the server roster; position comes from server results | Multi-human | Solo uses local ranking as today |
| `80_ui.js:51-57` | Friends render hook; lobby screens; multiplayer results buttons (`:40-43`) | UI | Solo buttons unchanged |
| `85_input.js` | Input snapshot is also sent to the server with a sequence number | Protocol | Keyboard and touch mapping unchanged |
| `90_main.js:155` | Fullscreen and orientation requests move to user-gesture handlers in multiplayer | Browser rule (touch devices only) | Solo unchanged |
| `90_main.js:240`, `:244`, `:278` | Multiplayer ignores `timescale` and the entry time scale. The results-state update at `:244` runs no entry factor | Shared clock (E16, E17) | Solo unchanged |
| `90_main.js:43`, `:180` | Multiplayer ignores hidden-tab and pause freezes | Server keeps running (R16) | Solo unchanged |
| `90_main.js:388` | Boot guard so that importing the sim core never boots the game | Server import (E19) | Browser boot unchanged |
| `src/template.html:1-3` | None. The server adds the wrapper at serve time (D11) | Quirks mode and encoding (E18) | Unchanged |
| `tools/build.mjs:12-14` | Existing outputs stay as they are, including the tracked `dist/chapri-racer.html` (D11). `dist/test.html` (wrapped) and `dist/game.mjs` (boots on import, gitignored) stay as test outputs. The new `dist/sim-core.mjs` becomes the server's entry point | One source of truth for physics; the spike used `game.mjs` | Golden hashes unchanged |

Compatibility rule for the sim core: no module-level mutable state that is shared between races. Per-race state lives in objects that the race owns. A test runs two rooms in one process to prove it.

---

## 7. Risk register

Severity: critical blocks the design; high changes the plan; medium needs a mitigation in a milestone; low is a note.

| ID | Sev | Risk | Mitigation | Test |
|---|---|---|---|---|
| R1 | Critical | Solo physics depends on frame time (E8) | Multiplayer uses the fixed tick; solo unchanged | Multiplayer determinism; solo golden |
| R2 | Critical | One random stream seeded from the clock, shared across races (E3, E5) | Per-race generator, seeded by the server | Concurrent-race isolation |
| R3 | Critical | Gameplay draws from `Math.random` on some tracks (E4, E26) | Move gameplay draws to the race generator | Reproducibility on every multiplayer track |
| R4 | High | Finish order decided by frame time and array order (E12) | Sub-tick crossing time; fixed tie-break | Tie scenarios (unit) |
| R5 | High | One local player is special throughout (E14; `45_race.js:79`, `:83`; cop targeting at `50_combat.js:92`) | Per-rider `human` flag; race controller | Eight-human race (headless and browser) |
| R6 | High | Browser singletons are read in physics (E11) and written mid-race (`SAVE`) | Injected options and a persistence adapter; the server adapter does nothing | Server never writes `SAVE`; solo golden |
| R7 | High | Physics and visuals are built together; the world is cached and shared across races (E21); barricades and traffic persist | Physics-only world per room, reset per race | Per-race reset invariants; memory budget |
| R8 | High | The winner's cutscene starts inside the physics call chain (E15) and its frame updates overwrite the winner's bike | Multiplayer: cutscene only after server results, on a copy | Cutscene does not change server state |
| R9 | Medium | Slow motion and winner time scale change the whole race (E16) | Disabled in multiplayer | Multiplayer clock invariant |
| R10 | Medium | Client progress feeds physics (`buildStats(SAVE.build)`, `45_race.js:18`); a save edit can change top speed | Stock stats in v1 (D7); a common capped tier later, not validated upgrades | Tampered save cannot change multiplayer physics |
| R11 | Medium | Input is sampled once per frame and held across substeps (`90_main.js:266`); discrete actions are separate calls (`90_main.js:263`, `:267-277`; pause, horn and camera sit outside the racing block) | Protocol carries `seq` and actions; server applies per tick | Input loss, duplication and reordering |
| R12 | Medium | The tracked build is a fragment with no doctype (E18) | Server serves a wrapped document; decision D11 | End-to-end on the served origin |
| R13 | Medium | The test harness routes every path to the game page (E24) | Narrow the routes; multiplayer tests use a real server origin | Harness self-check |
| R14 | Medium | 4-digit PIN. A random guess hits a joinable room with probability R / 10,000. With 20 failed guesses allowed per 10 minutes and a 30-minute lockout per address, that is at most 720 guesses per day per address. With 200 joinable rooms, that is about 14 random joins per day per address (expected; successful guesses do not count toward the lockout, so this is slightly low). Griefing risk, not data risk | Only `LOBBY` rooms are joinable; failure limits per address and per socket; joinable room cap of 200; short room lifetime. Decision D15 | Brute-force scenario H; limit tests; cleanup tests |
| R15 | Medium | Results and rewards are computed locally (`90_main.js:200-233`) | Multiplayer results come from the server; no rewards in v1 (D6) | Solo economy unchanged |
| R16 | Medium | Browser rules: pause on hidden tab (only during a race), fullscreen needs a gesture (touch devices), audio unlock | Ignored in multiplayer; gesture handlers | Focus-loss and gesture tests |
| R17 | Medium | Presentation reads rider fields that remote bikes must supply: HUD, and the nearest rival's engine sound (`60_audio.js:53-54`, which uses `rpm` and `throttle`) | Snapshot includes those fields; remote bike is a `Rider` | Visual and audio state checks |
| R18 | Low | The `contactT` key `a.idx * 16 + b.idx` (`45_race.js:113`) is unique only while every rider index is below 16. Cops use indices 20 to 22 (`46_police.js:80`), so with rivals and cops the keys can collide: `(0, 20)` and `(1, 4)` both give 20. Multiplayer v1 has no cops (D3), so it is safe in v1 | Keep police out of multiplayer; if cops return, change the key | Unit test with cops present |
| R19 | Medium | Module-level state shared across rooms (generator, `SAVE`, texture caches) | Per-room state objects; no shared mutable sim state | Two rooms, one process |
| R20 | Medium | Server CPU and bandwidth at scale are unmeasured. Simulation costs a mean of 0.14 to 0.25 ms per 8-bike tick, with p95 up to 0.53 ms (E6). Fan-out is not measured | Load tests and a snapshot budget | Milestone M9 load test |
| R21 | Medium | Speed and grip constants differ between clients if a client uses its own stats | Server owns stats; client receives them | Stats consistency test |
| R22 | Low | Socket.IO and its client are new dependencies | Pinned at 4.8.4, published more than two weeks before this audit (E23) | Install and version check |
| R23 | High | Underground traffic is keyed to the local player (E31). With several humans and Mumbai Underground in v1 (D5), each client would spawn and respawn different traffic, and collisions would differ | Server owns traffic and keys it to the group of humans by a fixed rule (decision D18) | Traffic is identical on every client; multi-human scenario on Mumbai Underground |
| R24 | Low | Combat resolution is order-dependent: `lastHitBy` is last-writer-wins (`50_combat.js:119`), and pickups and projectiles go to the first rider in array order | Combat is out of v1 scope (D4). Revisit in v2 with a fixed tie-break | Combat tests in v2 |

---

## 8. Files

### 8.1 Existing files to modify

`src/js/00_core.js`, `05_textures.js`, `20_world.js`, `21_stage.js`, `40_rider.js`, `45_race.js`, `46_police.js`, `47_underground.js`, `50_combat.js`, `58_entry.js`, `70_hud.js`, `80_ui.js`, `85_input.js`, `90_main.js`, `src/template.html`, `src/style.css`, `tools/build.mjs`, `tools/serve-test.mjs`, `tools/t17.mjs` (M0: assertion and exit code), `package.json`, `README.md` (after M3), `.gitignore` (server build output, if any).

Optional hygiene, when those scripts are next used: `tools/t24.mjs` (line 26), `tools/preview/shoot.mjs` (line 3) and `tools/model/build-rider.mjs` (line 14) hard-code `/tmp/claude-0/...` paths.

Not modified: `15_track.js` (beyond import paths), `18_batch.js`, `22_underground.js` (visual only), `28_bikemodel.js`, `29_ridermodel.js`, `30_bike.js`, `31_cloth.js`, `32_bikemods.js`, `55_speedfx.js`, `56_reflect.js`, `57_comic.js`, `60_audio.js`, `62_music.js`, `10_tracks.js` (data only), and the other `tools/t*.mjs` scripts, which keep working.

### 8.2 New files (proposed)

- `server/`: `index.ts` (bootstrap, graceful shutdown), `config.ts` (environment), `http.ts` (game page, `/healthz`), `socket.ts` (connections, origin checks, rate limits), `protocol.ts` (Zod schemas and types), `rooms.ts` (room manager), `pin.ts` (PIN generation and limits), `sessions.ts` (tokens and resume), `loop.ts` (one 60 Hz timer for all rooms), `race.ts` (room race over the sim core), `snapshot.ts` (encoding), `metrics.ts`, `log.ts`.
- `src/sim/` or a marked subset of `src/js/` for the pure sim core (`rng.js`, `physics-world.js`, the pure parts of `00_core.js`), built into `dist/sim-core.mjs`.
- Client: `src/js/81_lobby.js` (lobby UI), `src/js/86_net.js` (socket, clock sync, snapshot buffer, prediction), `src/js/87_remote.js` (remote bike presenter).
- Tests: `tests/sim/` (determinism and isolation), `tests/golden/` (solo trajectory hashes), `tests/unit/`, `tests/integration/`, `tests/e2e/` (Playwright), `tests/chaos/` (TCP proxy), `tests/load/` (Node load harness), `tests/acceptance/run.mjs` (three fresh-process runs).
- Created during implementation: `MULTIPLAYER_TEST_REPORT.md`, `MULTIPLAYER_BUG_TRACKER.md`.
- Optional: `Dockerfile` (only if D11 approves a container), `.env.example`.

---

## 9. Compatibility notes

- **Browsers.** WebSocket and WSS work in all current desktop and mobile browsers. Phones must play in landscape (the existing rotate overlay applies to every screen, `style.css:315`). The soft keyboard resizes the viewport, so the PIN field needs its own layout check.
- **Node.** This machine runs Node 24.18 and npm 11.16. Production should use the current LTS, chosen at deployment time.
- **Save data.** Unchanged. Multiplayer stores only a session token in `sessionStorage` (per tab), so closing the tab forfeits the seat.
- **Existing documentation.** `README.md` describes solo play and the test scripts. It needs updating after M3.

---

## 10. Where the evidence files are

The audit spike's scripts (`harness.mjs`, `run-race.mjs`, `determinism.mjs`, `bench.mjs`, `mem.mjs`, `timing.mjs`, `input-test.mjs`, `multi-human.mjs`) live in the session scratch directory, outside the repository. They are the starting point for the golden, determinism and performance tests in milestones M0 and M4. They will be moved into `tests/` as part of the work, not used from scratch.
