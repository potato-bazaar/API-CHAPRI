# Chapri Racer room protocol (v1)

This is section 3 of `MULTIPLAYER_BUILD_SPEC.md`, copied as written, followed by notes on exactly how the server applies
it. The spec section is binding. The notes add detail and never contradict it. The code that implements this file:
`server/protocol.mjs` (constants and validators), `server/rooms.mjs` (rooms, seats, sessions), `server/race.mjs` (races)
and `server/index.mjs` (transport, limits, acks).

## Protocol (spec section 3)

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
- `session:resume` `{ token }` → `{ ok, pin, seat, room }`, or `NOT_FOUND` / `EXPIRED`. If a race is in progress, the server
  also sends `race:begin` to this socket straight after the ack.
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

## How the server applies it

### Seats, tokens and defaults

- Seats are numbered **0 to 7**. Seat 0 is a real seat (the room creator gets it), so test for a seat with
  `seat !== null`, never with truthiness. A new racer takes the lowest free seat number.
- `seat` in an ack and `you` in a `RoomView` are the same number.
- A token is 32 lowercase hex characters (128 bits from `crypto.randomBytes`). It is returned only by `room:create` and
  `room:join`, never by `session:resume`, and never appears in any event or log.
- A new room starts with `{ track: 'mumbai-central', laps: 3, time: 'morning', weather: 'clear' }`.
- `name`, `bike` and `look` are optional in `room:create` and `room:join`. Missing values become `Rider`, `stock` and `{}`.

### Validation (every request and `race:state`)

- The payload must be a plain object (a missing payload counts as `{}`). Arrays, `null`, strings, numbers and binary are
  refused. Every key must be one this file lists for the event; any other key, including `__proto__` and `constructor`,
  gives `BAD_REQUEST`. Types are strict: `laps: '3'` is refused, `laps: 3` is accepted.
- A request must carry exactly one payload and an ack callback. Extra arguments give `BAD_REQUEST` in the ack. A request
  without an ack is not processed, and the socket gets `error` `BAD_REQUEST`.
- `pin` is a string of exactly 4 ASCII digits (`'0042'`, not `42`).
- `name`: Unicode NFC, control characters (C0, DEL, C1), line and paragraph separators and bidirectional override marks
  removed, runs of white space collapsed to one space, trimmed, then cut to 16 code points (an emoji is never split). An
  empty result becomes `Rider`. A non-string is `BAD_REQUEST`.
- `bike` must be one of the 8 ids, otherwise `BAD_REQUEST`.
- `look` must be a plain object whose JSON is at most 2048 bytes (UTF-8), otherwise `BAD_REQUEST`. The server stores a
  copy rebuilt from JSON and relays it as it is. Clients must still sanitize it (and render names as text, not HTML).
- `race:state` requires all 14 fields, each in its range (`lap` an integer, `crashed` and `finished` booleans). An
  invalid snapshot is dropped and the sender gets `error` `BAD_REQUEST` naming the problem, at most once every 5 s.

### Requests in detail

| Request | Success data | Error codes |
|---|---|---|
| `room:create` | `pin, seat, token, room` | `ALREADY_IN_ROOM` (this socket holds a seat), `RATE_LIMITED` (the address's room budget, with `retryAfterSec`; see Rate limits), `SERVER_BUSY` (1000 rooms with someone in them), `BAD_REQUEST` |
| `room:join` | `pin, seat, token, room` | `LOCKED_OUT` (with `retryAfterSec`), `ALREADY_IN_ROOM`, `NOT_FOUND`, `RACING`, `FULL`, `BAD_REQUEST` |
| `session:resume` | `pin, seat, room` | `NOT_FOUND` (unknown token), `EXPIRED` (the seat or the room is gone), `ALREADY_IN_ROOM` (this socket holds another seat), `RATE_LIMITED` (the seat moved to a new socket 5 times in the last minute, with `retryAfterSec`), `BAD_REQUEST` |
| `room:leave` | (none) | none: also `{ ok: true }` when the socket has no seat |
| `room:settings` | `room` | `NOT_IN_ROOM`, `NOT_HOST`, `RACE_IN_PROGRESS`, `BAD_REQUEST` |
| `racer:update` | `room` | `NOT_IN_ROOM`, `RACE_IN_PROGRESS`, `BAD_REQUEST` |
| `race:start` | `raceId, goAt` | `NOT_IN_ROOM`, `NOT_HOST`, `RACE_IN_PROGRESS`, `NOT_ENOUGH_RACERS` |
| `race:finish` | (none), or `duplicate: true` for a repeat | `NOT_IN_ROOM`, `BAD_REQUEST` (no race running, another `raceId`, or the racer is already DNF) |
| `clock:ping` | `serverNow` | none |

Any request can also get `RATE_LIMITED` (with `retryAfterSec`) and, if the server hits an internal error, `SERVER_BUSY`.
An unknown event name gets `BAD_REQUEST` in its ack, or as an `error` event if it has no ack.

`error` events with `BAD_REQUEST` (an invalid `race:state`, a request without an ack, an unknown event without an ack)
are sent at most once every 5 s per socket, so a broken client is told without being flooded. `SUPERSEDED` and
`RATE_LIMITED` are always sent, right before the server closes that socket.

- `room:join` checks in this order: lockout, already seated, PIN exists, lobby phase, free seat. Only `NOT_FOUND` counts
  as a failed PIN. A malformed PIN is `BAD_REQUEST` and does not count.
- `session:resume` with a token whose seat is held by another socket moves the seat to the new socket. The old socket
  gets `error` `{ code: 'SUPERSEDED' }` and is disconnected. Resuming the seat this socket already holds is a no-op that
  answers `ok`. The other seats get `room:notice` `reconnected` only if they were told the seat had `disconnected`
  (that notice is held back for 3 s, see "Rooms and seats over time").
- A seat can move to a new socket (a reconnect after a drop, or a takeover) at most 5 times in any 60 s. The next
  `session:resume` within that minute answers `RATE_LIMITED` with `retryAfterSec` (when the oldest of those 5 moves
  is a minute old) and changes nothing: the seat stays where it is, and a socket that holds it is not kicked. With the
  default settings (a 60 s window and a 60 s grace period), that `retryAfterSec` always ends before the seat's grace
  period does, so a client that waits it out and resumes keeps its seat. A refused resume does not count, and neither
  does the no-op resume of a seat the socket already holds.
- `session:resume` during `countdown` or `racing` sends that race's original `race:begin` (same `goAt`, `seed` and
  racers) right after the ack, before any `room:update`. The exception is a seat whose racer has already finished
  that race (its `race:finish` was accepted): it gets no `race:begin`, because the race is over for it. Its
  `room:update` still shows `phase: 'racing'` with that `raceId`, which tells it that `race:results` are still to
  come; they reach it like every other seat.
- `room:settings` with no change answers `ok` and broadcasts nothing. A real change sends `room:notice` `settings` (with
  the host's name) to the other seats and `room:update` to every seat.
- `race:finish`: the first finish of a seat counts; a repeat answers `{ ok: true, duplicate: true }` and changes nothing.
  The finish time is the client's `raceT`. Ties in `raceT` go to the earlier arrival at the server.

### Order of messages

A request's ack is always written before the events the same request causes. For example, the joiner gets the
`room:join` ack, then its `room:update`. Events for one socket arrive in the order the server sends them.

### Rooms and seats over time

- `room:update` goes to every seat with a live socket after every change: join, leave, disconnect, reconnect, host
  change, settings, racer update, and each phase change (`countdown` at start, `racing` at GO, `lobby` after results).
  `raceId` is the current race during `countdown` and `racing`, otherwise `null`.
- `room:notice` goes to every other seat (not the one it is about): `joined`, `left` (left, or held past the grace
  period), `disconnected`, `reconnected`, `settings`. `new-host` goes to every seat, the new host included, with the new
  host's name.
- `disconnected` is sent 3 s after the drop, and only if the seat is still away then. A seat that is back sooner (a
  reload, a short network drop) causes neither `disconnected` nor `reconnected`. A seat that leaves, or runs out of
  grace, before its `disconnected` is due causes only `left`. The `room:update` that shows the seat as
  `connected: false` is still sent at once.
- A disconnected seat is held for 60 s (`connected: false` in the views). Within that time `session:resume` takes it
  back. After it the seat is removed: `left` notice, host migration if needed, and in a race the racer is DNF.
- Host: the earliest-joined connected seat (join order, not seat number). The host keeps the role while disconnected
  within the grace period. When the host leaves or its seat expires, the role moves to the earliest-joined connected seat,
  or, if nobody is connected, the earliest-joined seat still held.
- A room with no seats is deleted 60 s after the last one went. A join in those 60 s keeps the room, and the joiner
  becomes host. `room:closed` `empty` therefore usually reaches nobody, and a later `session:resume` answers `EXPIRED`.
- A room with no seats does not count toward the 1000-room cap, or toward the room budget of the address that created
  it. When 1000 rooms exist in total (empty ones included), `room:create` closes the room that has been empty longest
  to make way, before its 60 s are up. A room whose seats are all disconnected but still in their grace period still
  counts.
- A lobby with no activity for 30 minutes gets `room:closed` `{ reason: 'expired' }` and is deleted. Activity is a
  successful create, join, resume, leave, `room:settings` or `racer:update` in that room, or the end of a race (a race
  in progress never expires). `clock:ping` and refused requests do not count.
- On shutdown every seat gets `room:closed` `{ reason: 'server-shutdown' }`, then its socket is closed.
- After `room:closed`, the socket stays connected and may create or join another room.

### Races

- `race:start`: every seat in the room races, including a seat inside its grace period (it can resume and pick up the
  race). GO is `serverNow + 5000` (`GO_DELAY_MS`). The phase is `countdown` from `race:start` until GO, then `racing`.
- `random` resolves to `RACE_TRACKS[seed % 6]`, with the tracks in this order: `mumbai-central dharavi-lanes
  mumbai-underground sion-flyover crawford-market bandstand-rush`.
- At GO, if fewer than 2 of the racers are connected, the race ends at once with `reason: 'aborted'` and every racer
  has `dnf: false`.
- `race:state` is accepted during `countdown` and `racing`, from a racer that is not DNF, including one that has
  finished (so the others keep seeing the bike roll past the line). The first `raceT` may be 0. The relayed payload is the
  validated snapshot plus `seat`, sent to every other seat. The sender does not get its own snapshot back.
- The last reported `dist` and `lap` (from `race:state`, or from `race:finish` for a finisher) are what the results show.
- The race ends when every racer has finished or is DNF (`all-finished`), or 120 s after the first finish
  (`timeout`; everyone still racing is DNF). A racer who leaves the room mid-race, or whose seat expires, is DNF. A race
  still running 61 minutes after GO (past the 3600 s `raceT` limit) also ends as `timeout`.
- `race:results` goes to every seat with a live socket, followed by `room:update` with `phase: 'lobby'`. Results are
  sent once. A racer who resumes later sees the lobby.
- In `race:results`, `finishT` is `null` for a racer who did not finish. `dnf` is `!finished`, except in an `aborted`
  race, where it is `false` for everyone.
- `raceId` values are positive integers that increase over the life of the server process.

### Connection-level refusals

These happen before any request, so they arrive as Socket.IO `connect_error`, not as acks:

- **Origin.** If the handshake has an `Origin` header, its host and port must equal the `Host` header (with
  `TRUST_PROXY=1`, `X-Forwarded-Host` is also accepted), or the origin must be in `ALLOWED_ORIGINS`. Otherwise the
  transport handshake is refused with HTTP 403 and body `{"code":4,"message":"ORIGIN_DENIED"}` (polling), or HTTP 400 with
  body `ORIGIN_DENIED` (websocket). Browsers surface that as a transport error (`xhr poll error` or `websocket error`).
  A request without `Origin` (a non-browser client) is allowed.
- **Capacity.** More than 1000 sockets in total, or more than 20 from one address (IPv4 address, or IPv6 /64), gives
  `connect_error` with `err.message === 'SERVER_BUSY'` and `err.data = { code: 'SERVER_BUSY', message }`. The same happens
  while the server is shutting down.
- **Addresses.** An address is the connection's own, or with `TRUST_PROXY=1` the first `X-Forwarded-For` entry. A
  port in it is ignored (`203.0.113.5:51234` is `203.0.113.5`, `[2001:db8::1]:443` is `2001:db8::1`), and IPv4-mapped
  IPv6 counts as the IPv4 address. Every value that is not an IP address counts as one shared address. This applies to
  every per-address limit: sockets, the PIN lockout and the room budget.
- **Clients that stop reading.** A socket that does not take what it is sent stops getting `race:state` once 64
  packets are waiting for it (the newer snapshots it misses replace each other anyway). If more than 512 packets, or
  more than 1 MiB (1048576 bytes), stay queued for it for 5 s, it is disconnected without an `error` event (it would
  not read one). Its seat is then held like any dropped seat. A client that reads normally never gets near these
  numbers: its queue empties every time it takes its messages.
- **Message size.** A message over 100 KB (`maxHttpBufferSize`, 102400 bytes) closes the connection (`transport close`
  or `transport error` on the client). There is no ack.
- **Flooding.** More than 300 messages of any kind in 10 s: the socket gets `error` `{ code: 'RATE_LIMITED' }` and is
  disconnected (`io server disconnect`). Socket.IO does not reconnect by itself after that.

### Rate limits

- Requests: at most 60 in any 10 s per socket. This is a sliding window, not a refilling bucket, so a burst of 60 is
  followed by nothing until it is 10 s old. Over the limit the ack is `{ ok: false, code: 'RATE_LIMITED', retryAfterSec }`.
  `retryAfterSec` is the time until the oldest of the last 60 accepted requests is 10 s old, rounded up.
- `race:state`: at most 20 in any 1 s per socket (a sliding window too). The excess is dropped without a reply and
  counted.
- Room creation, per address: at most 5 rooms with someone in them, and at most 10 successful `room:create` in any
  10 minutes. Past either, `room:create` answers `RATE_LIMITED`. For the first limit `retryAfterSec` is 60 (a room
  frees its place when it empties, or when its last dropped seat runs out of grace). For the second it is the time
  until the oldest of those 10 creates is 10 minutes old. Refused creates do not count.
- Seat moves: at most 5 `session:resume` calls that move a seat to another socket, in any 60 s per seat
  (`RATE_LIMITED` with `retryAfterSec`, see "Requests in detail").
- PIN guessing: 20 `NOT_FOUND` joins in 10 minutes from one address, or from one socket, locks that address or socket out
  of `room:join` for 30 minutes (`LOCKED_OUT`, with `retryAfterSec`). While locked, even a correct PIN is refused.
  `room:create` (within the room budget above) and `session:resume` stay open.
