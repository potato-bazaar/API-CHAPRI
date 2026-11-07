# Chapri Racer: friends rooms build spec (v1, binding)

Date: 2026-11-06. Branch: `multiplayer`. Written for the build agents and the owner. This document is the contract. Where it
differs from `MULTIPLAYER_IMPLEMENTATION_PLAN.md`, this document wins (see section 1).

## 0. What "done" means

1. **Same flow as the reference (autorush.autos).** Friends → Play with friends → name → **Create a room** (4-digit PIN, copy
   link) or **Join with PIN** → lobby (ROOM PIN, RACERS n/8 with HOST and YOU badges, YOUR BIKE carousel, TRACK, LAPS, TIME,
   WEATHER, "Waiting for friends…" until 2 racers, host **Start race**) → countdown → race where every racer sees the others
   → the same results on every device → race again or leave.
2. **No sign-up.** A player types the PIN on their own phone or laptop. `?room=PIN` in the URL opens the join flow pre-filled.
3. **Guest progress.** A brand-new browser starts at level 1 with the default save. A returning browser resumes its saved
   progress (XP level, coins, garage, records, settings, name) from localStorage. It survives reloads and browser restarts.
   Blocked or corrupted storage never breaks the game.
4. **Solo unchanged.** Same gameplay, same visuals and sounds, and the same golden baselines. The only solo-visible change is
   what the Friends dialog shows.
5. **No errors.** `npm test`, `npm run test:server`, `npm run test:e2e` and `npm run test:race` pass. No console errors in the
   browser during the flows. The server logs no unhandled errors and never prints tokens.

## 1. Decisions (binding)

- **A1. Physics is client-side.** No server physics. Each client runs the existing solo simulation unchanged for its own bike.
  The server owns the room, settings, the GO time and seed, the relay of racer snapshots, and the final order (from reported
  finish times). Consequence: a modified client could misreport its own finish. This is documented, not hidden. The
  server-authoritative simulation (plan M4) would change solo physics code, which the owner asked us not to touch.
- **A2. Other racers are ghost bikes.** A remote racer is a visual bike, interpolated from snapshots about 100 ms behind real
  time. It does not collide with the local bike. It does not take part in combat, AI, traffic, scoring callouts (overtake,
  squeeze, near miss) or the local score. It does count for position and ranking, and it appears in the standings.
- **A3. Mode.** A new mode key `friends` (defined in `84_mp_race.js` as `MODES.friends`): Quick Race rules with no AI rivals,
  no combat, and the laps from the lobby. Humans only, 2 to 8 racers. Solo modes are untouched.
- **A4. Rewards.** A multiplayer race pays the same coin and XP table as a Quick Race for the local player. The position points
  use the server's final order. Coins collected on track count as in solo. Economy numbers do not change.
- **A5. Transport.** Socket.IO 4.8.4. The server serves the browser client at `/socket.io/socket.io.js`. The client loads it
  only when the player opens Friends, so solo never touches the network.
- **A6. Server stack.** Node (target 24, must also run on 20+). Plain ESM JavaScript (`.mjs`), no TypeScript, no zod. Runtime
  dependency: `socket.io@4.8.4` only. Dev dependencies: `socket.io-client@4.8.4`, plus the existing `vitest` and `playwright`.
- **A7. Hosting.** One Node process serves the game page at `/` and the socket at `/socket.io`. The page is the output of
  `tools/build.mjs`. The server adds `<!doctype html>` and a viewport meta tag when it serves the page, if they are missing.
  The tracked `dist/chapri-racer.html` is not hand-edited. Hosting, TLS and the domain belong to the owner. Nothing is deployed.
- **A8. Storage.** Progress stays in localStorage under `chapri-racer-save-v1`. There are no server accounts.
- **A9. PIN.** Four digits `0000` to `9999`, from `crypto.randomInt`. Unique among active rooms (re-rolled on collision).
  Failed joins (`NOT_FOUND`) are counted per IP and per socket: 20 in 10 minutes gives `LOCKED_OUT` for 30 minutes.
- **A10. Limits.** 8 seats, 2 racers minimum, 1000 active rooms, 1000 sockets total, 20 sockets per IP, 100 KB per message
  (`maxHttpBufferSize`). Per-socket rate limit: an exact sliding window of 60 requests per 10 s, and `race:state` capped at 20 per
  second. Per address: at most 5 rooms with someone in them, and 10 room creates in any 10 minutes; past either, `room:create` is
  refused with `RATE_LIMITED` and `retryAfterSec`. A seat may move to a new socket at most 5 times in 60 s. A relayed `race:state`
  is skipped for a socket with 64 packets already waiting, and a socket that stops reading (over 512 packets or 1 MiB for 5 s) is
  closed.
  Excess `race:state` is dropped silently and counted. A socket that sends more than 300 messages in 10 s is disconnected with
  `error` code `RATE_LIMITED`.
- **A11. Sessions.** A seat token is 128-bit random hex, kept in server memory, and never logged. The client keeps it in
  `sessionStorage` (per tab), so a reload rejoins the same seat. A disconnected seat is held for 60 s, in the lobby and in a
  race. A later socket that presents the token takes the seat over. The old socket gets `error` `SUPERSEDED` and is closed.
- **A12. Host.** The host is the earliest-joined connected seat. It migrates when the host leaves, or is disconnected past
  the grace period.
- **A13. Lifecycle.** Phases are `lobby` → `countdown` → `racing` → back to `lobby`. Results are a one-shot event
  (`race:results`) and do not change the phase. A room with no seats stops counting toward the room cap and its creator's budget at once. It is deleted 60 s after its last
  seat leaves, or sooner when 1000 rooms exist (the one empty longest is closed first). A lobby with no
  activity for 30 minutes gets `room:closed` (`expired`) and is deleted. A race ends when every racer has finished or is DNF.
  A racer is DNF when disconnected for more than 60 s, or when 120 s have passed since the first finisher.

## 2. Reference UX (from the owner's screenshots; copy these labels)

**Entry dialog ("Play with friends").** Title `PLAY WITH FRIENDS`. Field `YOUR NAME` (prefilled from the save, max 16).
Button `CREATE A ROOM`. Divider `OR JOIN A FRIEND`. PIN input (numeric, max 4, placeholder `PIN`) and `JOIN`. Helper text:
`Create a room and share its 4-digit PIN. Friends type it here, on their phone or computer — up to 8 racers, no sign-up.`
Link `How your name and IP are used online` opens this note: `Your name and bike are shown to the other racers in your room. The
room server keeps no accounts. It keeps IP addresses in memory only, to limit open connections and wrong PIN guesses per address. It counts room creation under a keyed hash of the address, with a secret that changes each time the server starts. Nothing is written to disk, and each count is dropped as soon as it no longer applies.` (Keep the wording
true to the server's behaviour.)

**Lobby screen.** `‹ Leave` top left. Title `PLAY WITH FRIENDS` / `MULTIPLAYER`. Card `ROOM PIN` with the 4 digits and
`COPY LINK` (copies `<origin>/?room=PIN`). `RACERS n/8`, one row per racer: name, `HOST` badge on the host, `YOU` badge on
yourself, the bike's name on the right, a connected dot. `YOUR BIKE` with ‹ › arrows (owned builds only). `TRACK`: Random,
Mumbai Central, Dharavi Lanes, Underground, Sion Flyover, Crawford Market, Bandstand Rush. `LAPS`: 1, 3, 5. `TIME`: Morning,
Golden hour, Night. `WEATHER`: Clear, Rain. Host-only controls are disabled for everyone else, with a note `The host picks the
track`. Bottom: a dashed `WAITING FOR FRIENDS…` until 2 racers, then `START RACE` for the host, or `Waiting for the host to
start…` for everyone else. Caption: `Share the PIN — friends join on their own phone or computer`. The 3D backdrop shows the
room's track, time and weather, and the local bike.

**Results.** Standings from the server on every device, with the same order. Shows the reward line. Buttons: `RACE AGAIN`
(host) and `BACK TO LOBBY` (everyone).

**URL.** `?room=PIN` opens the entry dialog with the PIN filled in. If a name is saved, it joins at once. Otherwise it asks for
a name first.

**Reload.** If the tab still holds a session, the game silently resumes the seat and returns to the lobby. If the room is gone,
it shows `That room has closed.` and clears the session.

## 3. Protocol (binding; `server/PROTOCOL.md` must match this section)

Transport: Socket.IO, same origin, default path `/socket.io`, transports `websocket` and `polling`.

**Constants.** PIN: 4 digits. Seats: 8. Minimum racers to start: 2. Name: trimmed, control characters removed, 1 to 16
characters, default `Rider`. Bike ids: `stock kaali chrome sticker cafe neon drag raja`. Track ids: `random mumbai-central
dharavi-lanes mumbai-underground sion-flyover crawford-market bandstand-rush` (`random` is resolved by the server, with the race
seed). Laps: `1 3 5`. Time: `morning golden night`. Weather: `clear monsoon`. `look` is an opaque plain object from the client,
at most 2 KB as JSON. The server does not interpret it. Clients must sanitize it before use.

**Acks.** Every request has an ack callback: `{ ok: true, ...data }` or `{ ok: false, code, message, retryAfterSec? }`.

**Error codes.** `BAD_REQUEST`, `NOT_FOUND`, `FULL`, `RACING`, `LOCKED_OUT`, `NOT_HOST`, `NOT_ENOUGH_RACERS`, `RACE_IN_PROGRESS`,
`ALREADY_IN_ROOM`, `NOT_IN_ROOM`, `EXPIRED`, `RATE_LIMITED`, `SERVER_BUSY`, `SUPERSEDED`, `ORIGIN_DENIED`.

**Client → server (requests with ack unless noted)**
- `room:create` `{ name, bike, look }` → `{ ok, pin, seat, token, room }`
- `room:join` `{ pin, name, bike, look }` → `{ ok, pin, seat, token, room }`. Codes: `NOT_FOUND`, `FULL`, `RACING` (only
  when the room is not in the lobby phase), `LOCKED_OUT`, `BAD_REQUEST`.
- `session:resume` `{ token }` → `{ ok, pin, seat, room }`, or `NOT_FOUND` / `EXPIRED`, or `RATE_LIMITED` with `retryAfterSec` (the seat has
  moved to a new socket 5 times in the last minute; nothing changes). If a race is in progress, the server also sends that race's
  original `race:begin` to this socket straight after the ack, except to a racer who has already finished that race (its results
  come through `race:results`).
- `room:leave` `{}` → `{ ok: true }`. Allowed in any phase.
- `room:settings` `{ track?, laps?, time?, weather? }` → `{ ok, room }`. Host only (`NOT_HOST`). Lobby phase only
  (`RACE_IN_PROGRESS`).
- `racer:update` `{ name?, bike?, look? }` → `{ ok, room }`. Lobby phase only.
- `race:start` `{}` → `{ ok, raceId, goAt }`. Host only. Lobby phase only. Needs at least 2 connected racers
  (`NOT_ENOUGH_RACERS`). Sends `race:begin` to every seat.
- `race:finish` `{ raceId, raceT, dist, lap }` → `{ ok }`. Accepted once per seat per race, during `racing`. `raceT` is a finite
  number in `[0, 3600]`.
- `clock:ping` `{}` → `{ ok: true, serverNow }`. The client keeps the sample with the smallest round trip out of five.
- `race:state` (fire and forget, no ack) `{ raceId, raceT, dist, s, d, y, psi, v, lean, pitch, lap, boost, crashed, finished }`.
  Ranges: `raceT` `[0, 3600]`, `dist` `[0, 1e6]`, `s` `[0, 1e6]`, `d` `[-60, 60]`, `y` `[-20, 200]`, `psi` `[-20, 20]`,
  `v` `[-10, 150]`, `lean` and `pitch` `[-3, 3]`, `lap` integer `[-1, 200]`, `boost` `[0, 100]`. Dropped if the `raceId` is not
  the current race, the seat is not racing, or `raceT` is not larger than the last one from this seat. Relayed to the other
  seats as `race:state` with `seat` added.

**Server → client events**
- `room:update` `RoomView`:
  `{ pin, phase: 'lobby'|'countdown'|'racing', you: seat, raceId: number|null, hostSeat, settings: { track, laps, time, weather },
  racers: [{ seat, name, bike, look, host: bool, connected: bool }] }`. `racers` is ordered by seat. Sent on every change, to every seat.
- `room:notice` `{ kind: 'joined'|'left'|'disconnected'|'reconnected'|'new-host'|'settings', name? }`
- `race:begin` `{ raceId, goAt, seed, track, laps, time, weather, racers: [{ seat, name, bike, look }] }`. `goAt` is the server
  time (ms since epoch) of GO (raceT = 0). The countdown starts 3400 ms before `goAt`. `seed` is a uint32. `track` is the resolved id.
  Grid order = seat order.
- `race:state` `{ seat, raceId, raceT, dist, s, d, y, psi, v, lean, pitch, lap, boost, crashed, finished }` (relayed).
- `race:results` `{ raceId, reason: 'all-finished'|'timeout'|'aborted', order: [{ pos, seat, name, bike, finished, finishT, dist, lap, dnf }] }`.
  Order: finished racers by `finishT` ascending (ties by arrival), then the rest by `dist` descending. `aborted` means fewer
  than 2 connected racers when GO came. After any results, the phase is `lobby`.
- `room:closed` `{ reason: 'empty'|'expired'|'server-shutdown' }`
- `error` `{ code, message }`: protocol errors not tied to an ack, such as `RATE_LIMITED`, `SUPERSEDED`, `BAD_REQUEST`.

**Timing.** GO is `serverNow + 5000` at `race:start`. The countdown runs from `goAt - 3400`. Clients align their race clock to
`goAt` with `clockOffset`. The client's `race:state` rate is 15 per second at most.

## 4. Client and race APIs (binding names)

Files and owners are in section 7. All of these are top-level `const`s or functions in the concatenated game. The game is one
`<script type="module">`, so they are module-scoped, not globals. For tests and debugging only, expose them with no side effects:
`window.__chapri` (the existing Game, which already exists), plus `window.__mp = MP` and `window.__mpui = MPUI`, set by the
files that define them. Tests use these hooks through `page.evaluate`.

**`MP` (`82_mp_net.js`, owner WP-C)**
```
MP.status            // 'offline' | 'connecting' | 'online' | 'reconnecting'
MP.room              // latest RoomView, or null
MP.seat              // my seat number, or null
MP.isHost()          // boolean
MP.serverNow()       // ms; Date.now() + clock offset
MP.ensureConnected() // Promise; loads /socket.io/socket.io.js once, connects, rejects with a readable message if unreachable
MP.create({ name, bike, look })  → Promise<ack>
MP.join({ pin, name, bike, look }) → Promise<ack>
MP.resume()          // Promise<boolean>; uses sessionStorage 'chapri-mp-session' = { token, pin }
MP.leave()           // Promise; clears the session
MP.setSettings(patch) → Promise<ack>
MP.updateRacer(patch) → Promise<ack>
MP.startRace()       → Promise<ack>
MP.sendState(snap)   // fire and forget, throttled to 15 per second
MP.finish({ raceId, raceT, dist, lap }) → Promise<ack>
MP.on(event, fn) / MP.off(event, fn)
  // events: 'status' (string), 'room' (RoomView), 'begin' (race:begin payload), 'state' (race:state payload),
  // 'results' (race:results payload), 'closed' (payload), 'notice' (payload), 'error' (payload)
```

**`MPUI` (`83_mp_lobby.js`, owner WP-C)**
```
MPUI.open()            // opens the entry dialog (the existing #friends modal), or the lobby if the session is live
MPUI.showLobby()       // shows the lobby screen
MPUI.hideLobby()       // hides it (used when a race starts)
```
It also wires the `#friends` modal (`80_ui.js` calls `MPUI.open()` when the Friends button opens it). It also shows notices
through the existing `flashNote`.

**Race glue (`84_mp_race.js`, owner WP-R)**
```
MODES.friends = { label: 'Friends race', desc: ..., rivals: false, combat: false, laps: true, mp: true }
MPRACE.init(game)          // subscribes to MP 'begin', 'state', 'results', 'closed' and 'status'
game.startMultiplayerRace(begin)   // hides lobby and menus, builds the MP Race, starts the countdown at goAt
game.leaveMultiplayer()            // ends the MP race if any, clears the session, returns to the menu
```

**Race rules in multiplayer (owner WP-R)**
- Countdown: the race clock during countdown follows `MP.serverNow()` relative to `goAt`. Physics dt runs after GO. A late
  `race:begin` (for example, after a resume) starts at the current place on the countdown, or at the race's current
  `raceT` when GO has passed.
- The RNG is seeded from `begin.seed`, not the clock (the solo path still uses the clock).
- Remote racers are ghost `Rider` objects. Their physics is skipped, and they are placed from interpolated snapshots. They are
  excluded from AI, combat, scoring, near-miss and collisions. They are included in `ranking()`.
- The local player's snapshot goes out at 15 per second, from the game's own loop, with `race:state`.
- On local finish: `MP.finish({ raceId, raceT, dist, lap })`. The race keeps rendering until `race:results` arrives. The
  results screen shows the server's order. If results have not arrived within 60 s of the local finish, the screen shows the
  local standings with `Waiting for the other racers…`.
- Pause is disabled in multiplayer. The pause menu offers only `Leave race`. `?autopilot` is ignored in multiplayer.
- The winner's hero entry is not played in multiplayer (documented).
- The reward for the local player comes from `computeResults`-style rules, with the server position.
- `game.leaveMultiplayer()` returns to the menu cleanly and releases the race, the snapshot timer, the listeners and the
  ghost rigs. Leaving and re-entering must not leak. Rigs must be disposed.

## 5. Persistence rules (owner WP-P)

- Keep the key `chapri-racer-save-v1`. A returning browser keeps everything in the save. A new browser gets `defaultSave()`.
- A corrupted or unreadable save falls back to defaults without throwing, and the game still boots. Storage that throws on
  read or write is handled.
- Do not add saves mid-race, and do not change economy numbers. Saves happen at the existing checkpoints (results, purchases,
  settings).
- Add `tests/e2e/progress.e2e.test.mjs`. It covers: a fresh context shows level 1 and zero XP; a finished solo race raises XP
  and coins; a reload keeps them; a new context starts fresh again; corrupted storage recovers to defaults and the game boots;
  `Reset progress` clears it.

## 6. Server (owner WP-S)

**Files.** `server/index.mjs` (CLI and `createServer`), `server/config.mjs` (env), `server/protocol.mjs` (validators and
constants), `server/rooms.mjs` (room state, PINs, seats, phases and timers, pure logic with an injectable clock), `server/race.mjs`
(race start, relay, finish and results), `server/limits.mjs` (token buckets, PIN lockouts), `server/log.mjs` (JSON lines),
`server/PROTOCOL.md` (this section 3, verbatim), `server/README.md` (run, env vars, deploy notes, limits, what is not
protected).

**`createServer(options)`** → `{ url, port, close(): Promise<void>, stats() }`. Options: `port` (default 8080; `0` for
ephemeral), `host` (default `0.0.0.0`), `gameFile` (default `dist/chapri-racer.html`), `allowedOrigins` (array), `quiet`
(no logs), `limits` and `timers` overrides (for tests).

**HTTP.** `GET /` and `GET /index.html` serve the game page. `GET /healthz` returns `{ ok, rooms, sockets, uptimeSec }`.
`/socket.io/*` belongs to Socket.IO. Everything else is 404. Headers: `Cache-Control: no-cache`, `X-Content-Type-Options:
nosniff`. Any other method is 405.

**Origin.** If an `Origin` header is present, it must match the request's `Host` (same origin) or be in `ALLOWED_ORIGINS`.
Otherwise the handshake gets `ORIGIN_DENIED`. A missing `Origin` (non-browser client) is allowed.

**Env vars** (all optional): `PORT`, `HOST`, `ALLOWED_ORIGINS`, `TRUST_PROXY` (0 or 1; with 1, the first hop of
`X-Forwarded-For` is the client address), `LOG_LEVEL`, `GAME_FILE`, `MAX_SOCKETS`, `MAX_SOCKETS_PER_IP`, `MAX_ROOMS`,
`PIN_FAILURE_LIMIT` (20), `PIN_FAILURE_WINDOW_MS` (600000), `PIN_LOCKOUT_MS` (1800000), `RECONNECT_GRACE_MS` (60000),
`EMPTY_ROOM_MS` (60000), `IDLE_ROOM_MS` (1800000), `FINISH_TIMEOUT_MS` (120000), `GO_DELAY_MS` (5000).

**Shutdown.** On SIGINT or SIGTERM: send `room:closed` (`server-shutdown`) to every seat, close sockets and the HTTP server
within 5 s, exit 0. Unhandled errors are logged as JSON, and the process keeps serving.

**Logs.** JSON lines with `t`, `level`, `msg`, and a socket id where useful. Never log tokens, the `look` payload, or IP
addresses (keep IPs only in the in-memory limiter).

## 7. File ownership and coordination

Four workers run at the same time, in the same working tree. Each one edits only its own files. If you need a change in
someone else's file, say so in your final report and do not edit it.

| Owner | Writes | Tests |
|---|---|---|
| WP-S server | `server/**` | `tests/server/*.test.mjs` |
| WP-C client UI and net | `src/js/82_mp_net.js`, `src/js/83_mp_lobby.js`, `src/js/80_ui.js` (only the Friends hook), `src/template.html`, `src/style.css` (append only) | `tests/e2e/lobby.e2e.test.mjs` |
| WP-R race | `src/js/84_mp_race.js`, `src/js/40_rider.js`, `src/js/45_race.js`, `src/js/70_hud.js`, `src/js/90_main.js`, `src/js/58_entry.js` | `tests/e2e/race.e2e.test.mjs` |
| WP-P persistence | `src/js/00_core.js` | `tests/e2e/progress.e2e.test.mjs` |
| Orchestrator (do not edit) | `tools/build-order.mjs`, `package.json`, `vitest*.config.mjs`, `tests/e2e/harness.mjs`, this spec | |

**Solo guards.** Every multiplayer branch is behind a flag (`setup.mp`, `r.net`, `M.mp`, `MP.room`). Solo code paths must
produce the same result as before. `npm test` (golden baselines) is the regression guard for the solo simulation. Do not
regenerate golden baselines (`golden:capture`) to make a change pass. A baseline change needs a written reason in the report.

**Tests are never weakened.** A failing test is fixed in code. If a test is wrong, say why in your final report and do not edit
it to pass.

## 8. Acceptance (what the final verification checks)

1. `npm test` passes (unit, server and golden).
2. `npm run test:server` passes.
3. `npm run test:race` passes (the solo smoke test).
4. `npm run test:e2e` passes: lobby (create, join by PIN, invite link, roster sync, settings sync, host migration, leave,
   invalid PIN, resume after reload), race (three players start, see each other's ghosts, results match on every device),
   progress (fresh, returning, corrupted storage, reset).
5. No console errors in any e2e run, except known and explained ones (third-party CDN noise, if any).
6. The server starts with `npm run server`, serves `/`, `/healthz` and `/socket.io/socket.io.js`, and shuts down cleanly.

## 9. Known limits (to state in the README)

- Each client runs its own physics. A modified client could report a false finish time.
- Racers are ghosts: no bike-to-bike contact in multiplayer.
- No hero entry, no slow motion and no combat in multiplayer.
- Traffic and street life are random on each device, so the traffic a racer sees can differ from the traffic another sees.
- A phone that locks its screen mid-race freezes its racer until it returns. The server DNFs racers after 120 s from the
  first finish, or after 60 s of disconnection.
- No accounts. Progress is per device (localStorage).
- Capacity numbers come from measurement on the test machine, not from the production host.
