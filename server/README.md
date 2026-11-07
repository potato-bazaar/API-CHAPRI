# Chapri Racer room server

One Node process that serves the game page at `/` and the friends-rooms socket at `/socket.io`. Players create a room,
share its 4-digit PIN, and race their friends (up to 8) from their own phones or laptops. There are no accounts and
nothing is written to disk: rooms live in memory and disappear when they empty out or the process stops.

- Protocol: [`PROTOCOL.md`](PROTOCOL.md) (spec section 3 plus the exact server behaviour).
- Code: `index.mjs` (HTTP, Socket.IO, CLI, `createServer`), `config.mjs` (environment), `protocol.mjs` (validators),
  `rooms.mjs` (rooms, seats, sessions, room timers), `race.mjs` (race start, relay, finish, results), `limits.mjs` (rate
  limits, connection caps, PIN lockouts), `log.mjs` (JSON-lines logs).
- Tests: `npm run test:server` (unit tests on a fake clock, plus integration tests against a real server on an
  ephemeral port).

## Running it

Requirements: Node 20 or later (developed on Node 24), and `npm install` run once in the repository.

```sh
npm run server            # builds dist/chapri-racer.html, then starts the server on port 8080
node server/index.mjs     # starts the server without building (serves the dist/ page as it is)
PORT=3000 node server/index.mjs
```

Open `http://localhost:8080/` in a browser. `http://localhost:8080/?room=1234` opens the join flow for room 1234.

Check that it is up:

```sh
curl http://localhost:8080/healthz                      # {"ok":true,"rooms":0,"sockets":0,"uptimeSec":3}
curl -sI http://localhost:8080/socket.io/socket.io.js   # 200, the browser client
```

Stop it with Ctrl+C (SIGINT) or SIGTERM. Every player in a room gets `room:closed` (`server-shutdown`), the sockets and the
HTTP server close, and the process exits with code 0 within 5 s. A second signal exits at once.

A rebuild (`npm run build`) while the server runs is picked up on the next page load; no restart is needed. If the page
has not been built yet, `/` answers 503 and everything else works.

### Using it from code

```js
import { createServer } from './server/index.mjs';

const srv = await createServer({ port: 0, host: '127.0.0.1', quiet: true });
console.log(srv.url);        // http://127.0.0.1:<port>
console.log(srv.stats());    // rooms, seats, races, sockets, counters
await srv.close();           // graceful, same as SIGTERM
```

Options (all optional):

| Option | Default | Meaning |
|---|---|---|
| `port` | `8080` | `0` picks a free port. |
| `host` | `0.0.0.0` | Interface to listen on. |
| `gameFile` | `dist/chapri-racer.html` | The page served at `/`. |
| `allowedOrigins` | `[]` | Extra browser origins allowed to connect (besides the page's own origin). |
| `trustProxy` | `false` | Read the client address from `X-Forwarded-For` (see Deployment). |
| `logLevel` | `info` | `debug`, `info`, `warn`, `error` or `silent`. |
| `quiet` | `false` | No logs at all. |
| `onLog` | stdout | `function (line)` that receives each JSON log line instead of stdout. |
| `limits` | see below | Overrides for the limits, for tests. |
| `timers` | see below | Overrides for the timers, for tests. |

`limits` and `timers` take the camelCase names below or the environment variable names (`{ GO_DELAY_MS: 300 }` and
`{ goDelayMs: 300 }` are the same), in either object. An unknown name throws, so a typo fails loudly.

- `limits`: `seats` (8), `minRacers` (2), `maxRooms` (1000), `maxSockets` (1000), `maxSocketsPerIp` (20),
  `maxMessageBytes` (102400), `lookMaxBytes` (2048), `requestBurst` (60), `requestWindowMs` (10000),
  `statesPerSecond` (20), `floodMessages` (300), `floodWindowMs` (10000), `pinFailureLimit` (20),
  `pinFailureWindowMs` (600000), `pinLockoutMs` (1800000), `maxRoomsPerIp` (5), `roomCreatesPerIp` (10),
  `roomCreateWindowMs` (600000), `resumesPerSeat` (5), `resumeWindowMs` (60000), `backlogSkipPackets` (64),
  `backlogMaxPackets` (512), `backlogMaxBytes` (1048576).
- `timers`: `reconnectGraceMs` (60000), `emptyRoomMs` (60000), `idleRoomMs` (1800000), `finishTimeoutMs` (120000),
  `goDelayMs` (5000), `maxRaceMs` (3660000), `sweepMs` (15000), `disconnectNoticeMs` (3000), `backlogGraceMs` (5000).
  Every timer is at most 2147483647 ms (about 24.8 days, the longest delay Node.js timers support; Node would turn a
  longer one into 1 ms). A larger value throws a `TypeError`.

## Environment variables

All optional. A malformed value stops the server at start with a readable error, instead of running with a surprise.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port to listen on. |
| `HOST` | `0.0.0.0` | Interface to listen on. Use `127.0.0.1` behind a local reverse proxy. |
| `ALLOWED_ORIGINS` | (none) | Comma-separated origins, such as `https://chapri.example,https://www.chapri.example`, that may connect besides the page's own origin. |
| `TRUST_PROXY` | `0` | `1` when a reverse proxy sits in front: the first (left-most) `X-Forwarded-For` entry is the client address, and `X-Forwarded-Host` counts for the same-origin check. A port in that entry (`203.0.113.5:51234`, `[2001:db8::1]:443`) is ignored; a value that is not an IP address counts as one shared address. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` or `silent`. |
| `GAME_FILE` | `dist/chapri-racer.html` | Page served at `/` (relative paths are resolved from the working directory). |
| `MAX_SOCKETS` | `1000` | Sockets in total. |
| `MAX_SOCKETS_PER_IP` | `20` | Sockets per client address (IPv4 address, or IPv6 /64). |
| `MAX_ROOMS` | `1000` | Active rooms (rooms with someone in them). |
| `MAX_ROOMS_PER_IP` | `5` | Active rooms created from one client address. Raise it if many players share one address (a school or office network, carrier-grade NAT). |
| `ROOM_CREATES_PER_IP` | `10` | Rooms one client address may create in any 10 minutes. |
| `PIN_FAILURE_LIMIT` | `20` | Wrong PINs before a lockout. |
| `PIN_FAILURE_WINDOW_MS` | `600000` | Window in which those wrong PINs count (10 minutes). |
| `PIN_LOCKOUT_MS` | `1800000` | Lockout length (30 minutes). |
| `RECONNECT_GRACE_MS` | `60000` | How long a disconnected seat is held. |
| `EMPTY_ROOM_MS` | `60000` | How long an empty room is kept before it is deleted. |
| `IDLE_ROOM_MS` | `1800000` | Lobby inactivity before the room expires (30 minutes). |
| `FINISH_TIMEOUT_MS` | `120000` | Time after the first finisher before everyone else is DNF. |
| `GO_DELAY_MS` | `5000` | Time from `race:start` to GO. The client countdown starts 3400 ms before GO. |

The five `*_MS` timer variables accept at most `2147483647` (about 24.8 days); a larger value stops the server at start.

## Deployment notes

Nothing is deployed by this repository. Hosting, TLS and the domain are the owner's choice. What the server needs:

- **One long-running process.** It serves the page and the socket together, and keeps every room in memory. It is not
  a serverless function, and it does not scale out: two processes behind a load balancer would each have their own
  rooms, so a PIN made on one would not exist on the other. Run exactly one, under a supervisor (systemd, a container
  restart policy, pm2) that restarts it if it dies and sends SIGTERM to stop it.
- **Put it behind TLS.** Browsers need `https://` (and `wss://`) on phones and for clipboard access. Terminate TLS in a
  reverse proxy (nginx, Caddy, a platform load balancer) that forwards WebSocket upgrades. A minimal nginx location:

  ```nginx
  location / {
      proxy_pass http://127.0.0.1:8080;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $remote_addr;
      proxy_read_timeout 120s;
  }
  ```

- **Set `TRUST_PROXY=1` behind a proxy**, or every player looks like the proxy's address and the per-address limits (20
  sockets, PIN lockout) hit everyone at once. The server takes the **first** `X-Forwarded-For` entry as the client, so the
  proxy must **overwrite** that header with the real client address (`$remote_addr` above), not append to whatever the
  client sent. Never set `TRUST_PROXY=1` without a proxy in front: anyone could then pick their own address.
- **Origins.** The page and the socket are on the same origin, so no setting is needed when the proxy passes `Host`
  through. If the proxy rewrites `Host`, or the page is served from another origin, list the page's origin in
  `ALLOWED_ORIGINS` (for example `ALLOWED_ORIGINS=https://chapri.example`).
- **Health check:** `GET /healthz` returns 200 with `{ ok, rooms, sockets, uptimeSec }`.
- **Logs** are JSON lines on stdout. They never contain seat tokens, the `look` payload or IP addresses.
- **Restart = empty server.** A restart drops every room. Players see `room:closed` (`server-shutdown`) and can create a
  new room.

## Limits

| What | Limit | When exceeded |
|---|---|---|
| Racers per room | 8 | `room:join` answers `FULL`. |
| Racers to start | 2 connected | `race:start` answers `NOT_ENOUGH_RACERS`. |
| Active rooms (with someone in them) | 1000 | `room:create` answers `SERVER_BUSY`. |
| Rooms per address | 5 active, 10 created per 10 min | `room:create` answers `RATE_LIMITED` with `retryAfterSec`. |
| Sockets in total | 1000 | `connect_error` `SERVER_BUSY`. |
| Sockets per address | 20 | `connect_error` `SERVER_BUSY`. |
| Message size | 100 KB | The connection is closed. |
| `look` size | 2 KB as JSON | `BAD_REQUEST`. |
| Requests per socket | 60 in any 10 s | Ack `RATE_LIMITED` with `retryAfterSec`. |
| `race:state` per socket | 20 in any 1 s | Excess dropped silently and counted. |
| All messages per socket | 300 per 10 s | `error` `RATE_LIMITED`, then disconnected. |
| Seat moves (`session:resume` to a new socket) | 5 per minute, per seat | `RATE_LIMITED` with `retryAfterSec`. |
| Wrong PINs | 20 in 10 min, per address and per socket | `LOCKED_OUT` for 30 min, with `retryAfterSec`. |
| Unread messages queued for a socket | 64 packets for `race:state`; 512 packets or 1 MiB for 5 s in all | `race:state` is skipped for that socket; past the hard cap it is disconnected. |
| Disconnected seat | held 60 s | Seat removed; DNF if racing. The others get `disconnected` only after 3 s away. |
| Empty room | kept 60 s | Deleted. It does not count as active, and at 1000 rooms in total the longest-empty one makes way for a new room. |
| Idle lobby | 30 min | `room:closed` `expired`. |
| Race after first finish | 120 s | Everyone still racing is DNF; results `timeout`. |

Measured capacity: see "Capacity" below. These are measurements on the development machine, not on any production host.

## What is not protected

The server keeps the rooms honest (who is host, who may start, what the settings are, who finished first by reported
time), but it does not check the racing itself:

- **Each client runs its own physics.** The server relays positions and accepts the finish time each client reports. A
  modified client could report a false finish time or false positions. Only the value ranges are checked.
- **Racers are ghosts:** no bike-to-bike contact in multiplayer, so nothing a client reports can push another bike.
- **No hero entry, no slow motion and no combat in multiplayer.**
- **Traffic and street life are random on each device**, so two racers can see different traffic.
- **A phone that locks its screen mid-race freezes its racer** until it comes back. The server DNFs a racer 120 s after
  the first finish, or after 60 s of disconnection.
- **No accounts.** Progress is per device (browser storage). The 4-digit PIN is the only key to a room: anyone with the PIN
  can join while the room is in the lobby and has a free seat. PIN guessing is slowed by the lockout, but with many active
  rooms a random guess can land in a stranger's lobby. Seat tokens (128-bit) protect a seat once it is taken.
- **Names are free text** (sanitized for length and control characters only). Clients must render names and `look` as
  data, never as HTML.
- **Denial of service** beyond the per-socket and per-address limits above (for example a botnet with many addresses) is
  not handled here; that belongs in front of the server (a CDN or proxy with rate limiting).

## Privacy

The server keeps no accounts and writes nothing to disk. A player's name, bike and `look` are shown to the other racers
in the same room and are forgotten when the seat goes. IP addresses are kept only in memory, for two purposes: a count
of open connections per address (only while connected, for the 20-connection cap), and the wrong-PIN records, which
are dropped within 15 s of their 10-minute window or 30-minute lockout running out (so about 30 minutes after the last
wrong PIN at most). The room budget per address (5 active rooms, 10 creates in 10 minutes) does not keep the address:
it keeps a keyed hash of it (HMAC-SHA-256 with a random secret made at start and held only in memory) on each room the
address created, and a list of recent create times under that hash, dropped within 15 s of its 10-minute window
running out. Logs carry no addresses.

## Capacity

Measured on the development machine (4 cores, Node 24), with the server in its own process and every client simulated
by a second Node process on the same machine (websocket transport, every racer sending `race:state` at 15 per second for
20 s, so each snapshot is relayed to 7 others):

| Racing rooms (8 racers each) | Snapshots in / s | Relays out / s | Server CPU (one core) | Server RSS | Relay latency p50 / p95 / p99 |
|---|---|---|---|---|---|
| 10 (80 racers) | 1,205 | 8,432 | 35% | 89 MB | 0.9 / 3.5 / 10.4 ms |
| 25 (200 racers) | 3,006 | 21,042 | 60% | 106 MB | 1.7 / 5.4 / 11.7 ms |

Every snapshot was delivered in both runs, and the server logged no warnings. Node runs the rooms on one core, so the
practical ceiling is CPU: by straight-line extrapolation (an estimate, not a measurement) one core saturates at roughly
45 to 50 rooms racing at the same time. Lobbies cost almost nothing. These are not production numbers: a real host, real
networks and real phones (with polling fallbacks) will differ.
