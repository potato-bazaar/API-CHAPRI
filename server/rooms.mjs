// Room state: PINs, seats, sessions, host, phases and the room timers. Pure logic: no sockets, no network. The clock,
// the timers and the random source are injected, so the unit tests drive everything on a fake clock.
//
// Data model (shared with race.mjs):
//   room = { pin, phase: 'lobby'|'countdown'|'racing', settings: { track, laps, time, weather },
//            seats: Map<seatNo, seat>, hostSeat: seatNo|null, joinSeq, lastActivity, race: object|null,
//            emptyTimer, idleTimer, closed, owner: string|null }
//   seat = { seat: 0..7, name, bike, look, token, socketId: string|null, connected, joinOrder, graceTimer,
//            noticeTimer, dropNoticed, resumes: SlidingWindow }
// Seats are numbered from 0. A new seat takes the lowest free number.
//
// Room budgets: `owner` is an opaque tag for the address that created the room (index.mjs passes a keyed hash, never
// the address). An owner may have limits.maxRoomsPerIp rooms with someone in them, and create limits.roomCreatesPerIp
// rooms per limits.roomCreateWindowMs. An empty room (waiting out timers.emptyRoomMs) counts for neither, nor for
// limits.maxRooms; when the server holds maxRooms rooms in total, a create evicts the room that has been empty longest.
//
// Output goes through two injected functions: send(socketId, event, payload) and kick(socketId, code, message). The
// socket layer (index.mjs) holds these sends until it has written the request's ack, so a client always sees its ack
// before the room:update and race events that the same request caused.
import crypto from 'node:crypto';
import { DEFAULT_BIKE, DEFAULT_NAME, DEFAULT_SETTINGS, ProtocolError } from './protocol.mjs';
import { createRaceControl } from './race.mjs';
import { SlidingWindow, retryAfterSec } from './limits.mjs';

const RETIRED_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const RETIRED_TOKEN_MAX = 20000;

export function realClock() {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => {
      const t = setTimeout(fn, ms);
      if (t && typeof t.unref === 'function') t.unref();
      return t;
    },
    clearTimeout: (t) => clearTimeout(t),
  };
}

export const cryptoRandom = Object.freeze({
  int: (max) => crypto.randomInt(0, max),
  uint32: () => crypto.randomInt(0, 0x100000000),
  token: () => crypto.randomBytes(16).toString('hex'),
});

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

export function createRooms({ clock = realClock(), random = cryptoRandom, limits, timers, send, broadcast, kick = () => {}, log, stats = {} }) {
  const rooms = new Map(); // pin -> room
  const emptyRooms = new Set(); // rooms with no seats, oldest-emptied first
  const byOwner = new Map(); // owner tag -> Set<room> (open rooms it created)
  const createsByOwner = new Map(); // owner tag -> SlidingWindow of its recent creates
  const bySocket = new Map(); // socketId -> { room, seat }
  const byToken = new Map(); // token -> { room, seat }
  // Tokens of seats that are gone, by hash, so a late resume can be told EXPIRED instead of NOT_FOUND. Only hashes are
  // kept: a retired token itself is never stored.
  const retired = new Map(); // hash -> expiresAt
  for (const key of ['racesStarted', 'racesFinished', 'statesRelayed', 'statesDropped', 'roomsCreated', 'roomsClosed']) {
    if (typeof stats[key] !== 'number') stats[key] = 0;
  }
  const logger = log || { debug() {}, info() {}, warn() {}, error() {} };

  const race = createRaceControl({
    clock, random, limits, timers, stats,
    send,
    broadcast: broadcast || ((ids, event, payload) => { for (const id of ids) send(id, event, payload); }),
    hooks: {
      changed: (room) => broadcastViews(room),
      ended: (room) => {
        touch(room);
        broadcastViews(room);
      },
    },
  });

  // ---- views and messages ----

  function sortedSeats(room) {
    return [...room.seats.values()].sort((a, b) => a.seat - b.seat);
  }

  function view(room, you) {
    return {
      pin: room.pin,
      phase: room.phase,
      you,
      raceId: room.race ? room.race.raceId : null,
      hostSeat: room.hostSeat,
      settings: { ...room.settings },
      racers: sortedSeats(room).map((s) => ({
        seat: s.seat, name: s.name, bike: s.bike, look: s.look, host: s.seat === room.hostSeat, connected: s.connected,
      })),
    };
  }

  function broadcastViews(room) {
    for (const s of room.seats.values()) if (s.socketId) send(s.socketId, 'room:update', view(room, s.seat));
  }

  function notice(room, payload, exceptSeat = null) {
    for (const s of room.seats.values()) if (s.socketId && s.seat !== exceptSeat) send(s.socketId, 'room:notice', payload);
  }

  // ---- timers ----

  function clearTimer(holder, key) {
    if (holder[key] !== null && holder[key] !== undefined) clock.clearTimeout(holder[key]);
    holder[key] = null;
  }

  // Activity keeps a lobby alive. The idle timer is armed once and re-arms itself for the remaining time when it fires
  // early, so frequent activity costs nothing.
  function touch(room) {
    room.lastActivity = clock.now();
    if (room.idleTimer === null) armIdle(room, timers.idleRoomMs);
  }

  function armIdle(room, ms) {
    clearTimer(room, 'idleTimer');
    room.idleTimer = clock.setTimeout(() => {
      room.idleTimer = null;
      if (room.closed) return;
      if (room.phase !== 'lobby') {
        // A race counts as activity; check again a full period after it.
        armIdle(room, timers.idleRoomMs);
        return;
      }
      const idleFor = clock.now() - room.lastActivity;
      if (idleFor >= timers.idleRoomMs) closeRoom(room, 'expired');
      else armIdle(room, timers.idleRoomMs - idleFor);
    }, ms);
  }

  function armEmpty(room) {
    clearTimer(room, 'emptyTimer');
    emptyRooms.delete(room);
    emptyRooms.add(room);
    room.emptyTimer = clock.setTimeout(() => {
      room.emptyTimer = null;
      if (!room.closed && room.seats.size === 0) closeRoom(room, 'empty');
    }, timers.emptyRoomMs);
  }

  function disarmEmpty(room) {
    clearTimer(room, 'emptyTimer');
    emptyRooms.delete(room);
  }

  // ---- room budgets ----

  function openRoomsOf(owner) {
    let n = 0;
    const set = byOwner.get(owner);
    if (set) for (const room of set) if (room.seats.size > 0) n++;
    return n;
  }

  // Throws RATE_LIMITED when `owner` may not create another room now.
  function checkOwnerBudget(owner, now) {
    if (openRoomsOf(owner) >= limits.maxRoomsPerIp) {
      // A room frees its slot when everyone has left it, or when its last disconnected seat runs out of grace.
      throw new ProtocolError('RATE_LIMITED', 'You already have too many open rooms. Leave one, then try again.',
        retryAfterSec(timers.reconnectGraceMs));
    }
    const recent = createsByOwner.get(owner);
    if (recent && !recent.allowed(now)) {
      throw new ProtocolError('RATE_LIMITED', 'Too many new rooms from your connection. Try again later.',
        retryAfterSec(recent.retryAfterMs(now)));
    }
  }

  function recordCreate(owner, room, now) {
    let recent = createsByOwner.get(owner);
    if (!recent) {
      recent = new SlidingWindow(limits.roomCreatesPerIp, limits.roomCreateWindowMs);
      createsByOwner.set(owner, recent);
    }
    recent.record(now);
    let set = byOwner.get(owner);
    if (!set) {
      set = new Set();
      byOwner.set(owner, set);
    }
    set.add(room);
  }

  function releaseOwner(room) {
    if (room.owner === null) return;
    const set = byOwner.get(room.owner);
    if (!set) return;
    set.delete(room);
    if (!set.size) byOwner.delete(room.owner);
  }

  // ---- PINs, tokens, seats ----

  function newPin() {
    // There are 10000 PINs and at most limits.maxRooms rooms, so a random draw almost always hits a free one quickly.
    for (let i = 0; i < 200; i++) {
      const pin = String(random.int(10000)).padStart(4, '0');
      if (!rooms.has(pin)) return pin;
    }
    // Only reachable with a broken random source or a huge room cap: scan from a random start instead.
    const start = random.int(10000);
    for (let i = 0; i < 10000; i++) {
      const pin = String((start + i) % 10000).padStart(4, '0');
      if (!rooms.has(pin)) return pin;
    }
    throw new ProtocolError('SERVER_BUSY', 'No free room PIN. Try again later.');
  }

  function newToken() {
    for (;;) {
      const token = random.token();
      if (!byToken.has(token)) return token;
    }
  }

  function retire(token) {
    if (!token) return;
    byToken.delete(token);
    if (retired.size >= RETIRED_TOKEN_MAX) retired.delete(retired.keys().next().value);
    retired.set(tokenHash(token), clock.now() + RETIRED_TOKEN_TTL_MS);
  }

  function addSeat(room, socketId, data) {
    let seatNo = 0;
    while (room.seats.has(seatNo)) seatNo++;
    const seat = {
      seat: seatNo,
      name: data.name || DEFAULT_NAME,
      bike: data.bike || DEFAULT_BIKE,
      look: data.look || {},
      token: newToken(),
      socketId,
      connected: true,
      joinOrder: ++room.joinSeq,
      graceTimer: null,
      noticeTimer: null, // pending `disconnected` notice
      dropNoticed: false, // the others were told this seat disconnected
      resumes: new SlidingWindow(limits.resumesPerSeat, limits.resumeWindowMs),
    };
    room.seats.set(seatNo, seat);
    bySocket.set(socketId, { room, seat });
    byToken.set(seat.token, { room, seat });
    return seat;
  }

  // The host is the earliest-joined connected seat. With nobody connected, the earliest-joined seat that is still held.
  function pickHost(room) {
    let best = null;
    for (const s of room.seats.values()) {
      if (!s.connected) continue;
      if (!best || s.joinOrder < best.joinOrder) best = s;
    }
    if (!best) for (const s of room.seats.values()) if (!best || s.joinOrder < best.joinOrder) best = s;
    return best ? best.seat : null;
  }

  // Removes a seat for good: it left (`left`) or stayed disconnected past the grace period (`expired`).
  function removeSeat(room, seat, why) {
    clearTimer(seat, 'graceTimer');
    clearTimer(seat, 'noticeTimer');
    if (seat.socketId) bySocket.delete(seat.socketId);
    seat.socketId = null;
    seat.connected = false;
    retire(seat.token);
    room.seats.delete(seat.seat);
    logger.debug('seat removed', { pin: room.pin, seat: seat.seat, why });
    if (room.seats.size === 0) {
      room.hostSeat = null;
      if (room.race) race.seatGone(room, seat.seat);
      armEmpty(room);
      return;
    }
    notice(room, { kind: 'left', name: seat.name });
    if (room.hostSeat === seat.seat) {
      room.hostSeat = pickHost(room);
      const host = room.seats.get(room.hostSeat);
      if (host) notice(room, { kind: 'new-host', name: host.name });
    }
    // This can end the race (the last racer still on track left). race.mjs then sends the results and the lobby
    // views itself; the extra view below is harmless and keeps this path simple.
    if (room.race) race.seatGone(room, seat.seat);
    broadcastViews(room);
  }

  function closeRoom(room, reason) {
    if (room.closed) return;
    room.closed = true;
    race.cancel(room);
    disarmEmpty(room);
    clearTimer(room, 'idleTimer');
    releaseOwner(room);
    for (const s of room.seats.values()) {
      clearTimer(s, 'graceTimer');
      clearTimer(s, 'noticeTimer');
      if (s.socketId) {
        send(s.socketId, 'room:closed', { reason });
        bySocket.delete(s.socketId);
      }
      retire(s.token);
    }
    room.seats.clear();
    rooms.delete(room.pin);
    stats.roomsClosed++;
    logger.info('room closed', { pin: room.pin, reason });
  }

  function seated(socketId) {
    const entry = bySocket.get(socketId);
    if (!entry) throw new ProtocolError('NOT_IN_ROOM', 'You are not in a room.');
    return entry;
  }

  function connectedCount(room) {
    let n = 0;
    for (const s of room.seats.values()) if (s.connected) n++;
    return n;
  }

  // ---- requests (each returns the ack data, or throws ProtocolError) ----

  // `owner` (optional) is the creator's address tag for the per-address budget; without one, only maxRooms applies.
  function create(socketId, data, owner = null) {
    if (bySocket.has(socketId)) throw new ProtocolError('ALREADY_IN_ROOM', 'Leave your room before creating another.');
    const now = clock.now();
    if (owner !== null) checkOwnerBudget(owner, now);
    // Only rooms with someone in them count against the cap. Empty rooms still hold their PIN for a while (so a late
    // join or resume finds them), but under pressure the longest-empty one makes way.
    if (rooms.size - emptyRooms.size >= limits.maxRooms) {
      throw new ProtocolError('SERVER_BUSY', 'The server has too many rooms right now. Try again soon.');
    }
    for (const old of emptyRooms) {
      if (rooms.size < limits.maxRooms) break;
      closeRoom(old, 'empty');
    }
    const pin = newPin();
    const room = {
      pin, phase: 'lobby', settings: { ...DEFAULT_SETTINGS }, seats: new Map(), hostSeat: null, joinSeq: 0,
      lastActivity: now, race: null, emptyTimer: null, idleTimer: null, closed: false, owner,
    };
    rooms.set(pin, room);
    const seat = addSeat(room, socketId, data);
    room.hostSeat = seat.seat;
    if (owner !== null) recordCreate(owner, room, now);
    touch(room);
    stats.roomsCreated++;
    logger.info('room created', { pin });
    broadcastViews(room);
    return { pin, seat: seat.seat, token: seat.token, room: view(room, seat.seat) };
  }

  function join(socketId, data) {
    if (bySocket.has(socketId)) throw new ProtocolError('ALREADY_IN_ROOM', 'Leave your room before joining another.');
    const room = rooms.get(data.pin);
    if (!room || room.closed) throw new ProtocolError('NOT_FOUND', 'No room has that PIN.');
    if (room.phase !== 'lobby') throw new ProtocolError('RACING', 'That room is racing right now. Try again when the race ends.');
    if (room.seats.size >= limits.seats) throw new ProtocolError('FULL', 'That room is full.');
    // An empty room someone joins counts as active again. It always fits: create() keeps rooms.size (empty rooms
    // included) at or under maxRooms.
    const wasEmpty = room.seats.size === 0;
    const seat = addSeat(room, socketId, data);
    disarmEmpty(room);
    if (wasEmpty || room.hostSeat === null) room.hostSeat = seat.seat;
    touch(room);
    notice(room, { kind: 'joined', name: seat.name }, seat.seat);
    broadcastViews(room);
    return { pin: room.pin, seat: seat.seat, token: seat.token, room: view(room, seat.seat) };
  }

  function resume(socketId, { token }) {
    const entry = byToken.get(token);
    if (!entry) {
      const h = tokenHash(token);
      const exp = retired.get(h);
      if (exp !== undefined && exp > clock.now()) throw new ProtocolError('EXPIRED', 'That room has closed.');
      throw new ProtocolError('NOT_FOUND', 'That session is not known.');
    }
    const { room, seat } = entry;
    const mine = bySocket.get(socketId);
    if (mine) {
      if (mine.seat === seat) return { pin: room.pin, seat: seat.seat, room: view(room, seat.seat) };
      throw new ProtocolError('ALREADY_IN_ROOM', 'This connection already holds another seat.');
    }
    // Every move of the seat to another socket (a reconnect or a takeover) costs the room a view update, so a seat may
    // move only so often. Otherwise a racer could churn connections and flood everyone else in the room.
    const now = clock.now();
    if (!seat.resumes.allowed(now)) {
      throw new ProtocolError('RATE_LIMITED', 'This seat reconnected too often. Try again in a moment.',
        retryAfterSec(seat.resumes.retryAfterMs(now)));
    }
    seat.resumes.record(now);
    const previous = seat.socketId;
    if (previous) {
      // Another socket holds the seat (an older tab, or a connection the server has not noticed is dead yet).
      bySocket.delete(previous);
      kick(previous, 'SUPERSEDED', 'This seat was taken over by another connection.');
    }
    const wasConnected = seat.connected;
    clearTimer(seat, 'graceTimer');
    clearTimer(seat, 'noticeTimer');
    seat.socketId = socketId;
    seat.connected = true;
    bySocket.set(socketId, { room, seat });
    if (room.phase === 'lobby') touch(room);
    // race:begin first, straight after the ack (spec section 3), then the views.
    race.resendBegin(room, seat.seat, socketId);
    // `reconnected` only answers a `disconnected` the others actually heard (it is held back for a short drop).
    if (!wasConnected && seat.dropNoticed) notice(room, { kind: 'reconnected', name: seat.name }, seat.seat);
    seat.dropNoticed = false;
    broadcastViews(room);
    return { pin: room.pin, seat: seat.seat, room: view(room, seat.seat) };
  }

  function leave(socketId) {
    const entry = bySocket.get(socketId);
    if (!entry) return {};
    const { room, seat } = entry;
    removeSeat(room, seat, 'left');
    if (room.phase === 'lobby' && room.seats.size) touch(room);
    return {};
  }

  function settings(socketId, patch) {
    const { room, seat } = seated(socketId);
    if (room.hostSeat !== seat.seat) throw new ProtocolError('NOT_HOST', 'Only the host can change the race settings.');
    if (room.phase !== 'lobby') throw new ProtocolError('RACE_IN_PROGRESS', 'Settings are locked while a race is on.');
    let changed = false;
    for (const key of ['track', 'laps', 'time', 'weather']) {
      if (patch[key] !== undefined && room.settings[key] !== patch[key]) {
        room.settings[key] = patch[key];
        changed = true;
      }
    }
    touch(room);
    if (changed) {
      notice(room, { kind: 'settings', name: seat.name }, seat.seat);
      broadcastViews(room);
    }
    return { room: view(room, seat.seat) };
  }

  function updateRacer(socketId, patch) {
    const { room, seat } = seated(socketId);
    if (room.phase !== 'lobby') throw new ProtocolError('RACE_IN_PROGRESS', 'You can change your rider only in the lobby.');
    let changed = false;
    if (patch.name !== undefined && patch.name !== seat.name) { seat.name = patch.name; changed = true; }
    if (patch.bike !== undefined && patch.bike !== seat.bike) { seat.bike = patch.bike; changed = true; }
    if (patch.look !== undefined) { seat.look = patch.look; changed = true; }
    touch(room);
    if (changed) broadcastViews(room);
    return { room: view(room, seat.seat) };
  }

  function startRace(socketId) {
    const { room, seat } = seated(socketId);
    if (room.hostSeat !== seat.seat) throw new ProtocolError('NOT_HOST', 'Only the host can start the race.');
    if (room.phase !== 'lobby') throw new ProtocolError('RACE_IN_PROGRESS', 'A race is already on.');
    if (connectedCount(room) < limits.minRacers) {
      throw new ProtocolError('NOT_ENOUGH_RACERS', `You need at least ${limits.minRacers} racers to start.`);
    }
    const result = race.start(room);
    broadcastViews(room);
    logger.info('race started', { pin: room.pin, raceId: result.raceId, racers: room.seats.size });
    return result;
  }

  function finish(socketId, data) {
    const { room, seat } = seated(socketId);
    return race.finish(room, seat.seat, data);
  }

  // race:state. No ack; returns whether the snapshot was relayed.
  function state(socketId, data) {
    const entry = bySocket.get(socketId);
    if (!entry) {
      stats.statesDropped++;
      return false;
    }
    return race.relay(entry.room, entry.seat.seat, data);
  }

  // ---- connection events ----

  function disconnect(socketId) {
    const entry = bySocket.get(socketId);
    if (!entry) return;
    const { room, seat } = entry;
    bySocket.delete(socketId);
    seat.socketId = null;
    seat.connected = false;
    clearTimer(seat, 'graceTimer');
    seat.graceTimer = clock.setTimeout(() => {
      seat.graceTimer = null;
      if (!room.closed && room.seats.get(seat.seat) === seat && !seat.connected) removeSeat(room, seat, 'expired');
    }, timers.reconnectGraceMs);
    // The views show the dropped seat at once (connected: false). The notice waits: a reload or a short drop is back
    // within a few seconds, and then the others hear nothing at all.
    clearTimer(seat, 'noticeTimer');
    const tell = () => {
      seat.noticeTimer = null;
      if (room.closed || room.seats.get(seat.seat) !== seat || seat.connected) return;
      seat.dropNoticed = true;
      notice(room, { kind: 'disconnected', name: seat.name }, seat.seat);
    };
    if (timers.disconnectNoticeMs > 0) seat.noticeTimer = clock.setTimeout(tell, timers.disconnectNoticeMs);
    else tell();
    broadcastViews(room);
  }

  function sweep() {
    const now = clock.now();
    for (const [h, exp] of retired) if (exp <= now) retired.delete(h);
    for (const [owner, recent] of createsByOwner) if (recent.idle(now)) createsByOwner.delete(owner);
  }

  function shutdown() {
    for (const room of [...rooms.values()]) closeRoom(room, 'server-shutdown');
  }

  function counts() {
    let seats = 0;
    let racing = 0;
    for (const room of rooms.values()) {
      seats += room.seats.size;
      if (room.race) racing++;
    }
    return { rooms: rooms.size, emptyRooms: emptyRooms.size, seats, races: racing };
  }

  return {
    create, join, resume, leave, settings, updateRacer, startRace, finish, state, disconnect,
    sweep, shutdown, counts,
    // For tests and diagnostics only.
    get: (pin) => rooms.get(pin) || null,
    seatOf: (socketId) => {
      const e = bySocket.get(socketId);
      return e ? { pin: e.room.pin, seat: e.seat.seat } : null;
    },
    view: (pin, you) => {
      const room = rooms.get(pin);
      return room ? view(room, you) : null;
    },
  };
}
