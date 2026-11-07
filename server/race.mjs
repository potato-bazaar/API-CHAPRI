// Race lifecycle for one room: start (countdown and GO), relay of racer snapshots, finishes, DNF rules and results.
//
// The physics runs on the clients (spec A1). The server owns the GO time and the seed, relays snapshots between seats,
// and orders the results from the finish times the clients report.
//
// This module works on the room objects that rooms.mjs creates (see the data model there). It never touches sockets:
// it talks through `send(socketId, event, payload)` and `broadcast(socketIds, event, payload, opts)`, where
// `opts.droppable` marks a message that may be skipped for a socket that is not keeping up (race:state).
import { ProtocolError, RACE_TRACKS } from './protocol.mjs';

const ACTIVE = new Set(['countdown', 'racing']);

export function createRaceControl({ clock, random, limits, timers, send, broadcast, hooks, stats }) {
  let lastRaceId = 0;

  function seatSockets(room, exceptSeat) {
    const ids = [];
    for (const seat of room.seats.values()) if (seat.socketId && seat.seat !== exceptSeat) ids.push(seat.socketId);
    return ids;
  }

  function clearRaceTimers(race) {
    for (const key of ['goTimer', 'finishTimer', 'maxTimer']) {
      if (race[key] !== null) clock.clearTimeout(race[key]);
      race[key] = null;
    }
  }

  // Host pressed Start. The caller (rooms.mjs) has checked host, phase and the number of connected racers.
  function start(room) {
    const now = clock.now();
    const seed = random.uint32();
    const settings = room.settings;
    const track = settings.track === 'random' ? RACE_TRACKS[seed % RACE_TRACKS.length] : settings.track;
    const raceId = ++lastRaceId;
    const goAt = now + timers.goDelayMs;
    const seats = [...room.seats.values()].sort((a, b) => a.seat - b.seat);
    // Every seat in the room races, including one that is briefly disconnected: it can resume within the grace period
    // and pick the race up from race:begin, or it is DNF when the grace period runs out.
    const entrants = new Map();
    for (const s of seats) {
      entrants.set(s.seat, {
        seat: s.seat, name: s.name, bike: s.bike,
        lastRaceT: -1, dist: 0, lap: 0,
        finished: false, finishT: null, arrival: 0,
        dnf: false, gone: false,
      });
    }
    const begin = {
      raceId, goAt, seed, track,
      laps: settings.laps, time: settings.time, weather: settings.weather,
      racers: seats.map((s) => ({ seat: s.seat, name: s.name, bike: s.bike, look: s.look })),
    };
    const race = { raceId, goAt, seed, track, begin, entrants, arrivals: 0, firstFinishAt: null, goTimer: null, finishTimer: null, maxTimer: null };
    room.race = race;
    room.phase = 'countdown';
    race.goTimer = clock.setTimeout(() => go(room, race), Math.max(0, goAt - now));
    broadcast(seatSockets(room), 'race:begin', begin);
    stats.racesStarted++;
    return { raceId, goAt };
  }

  function connectedEntrants(room, race) {
    let n = 0;
    for (const e of race.entrants.values()) {
      if (e.gone || e.dnf) continue;
      const seat = room.seats.get(e.seat);
      if (seat && seat.connected) n++;
    }
    return n;
  }

  function go(room, race) {
    if (room.race !== race) return;
    race.goTimer = null;
    if (connectedEntrants(room, race) < limits.minRacers) {
      end(room, 'aborted');
      return;
    }
    room.phase = 'racing';
    race.maxTimer = clock.setTimeout(() => {
      if (room.race === race) end(room, 'timeout');
    }, timers.maxRaceMs);
    hooks.changed(room);
    checkEnd(room);
  }

  // race:state from one seat. Returns true when it was relayed. Stale or out-of-phase snapshots are dropped silently:
  // they are normal around phase changes and reconnects.
  function relay(room, seatNo, st) {
    const race = room.race;
    if (!race || !ACTIVE.has(room.phase) || st.raceId !== race.raceId) {
      stats.statesDropped++;
      return false;
    }
    const e = race.entrants.get(seatNo);
    if (!e || e.gone || e.dnf || st.raceT <= e.lastRaceT) {
      stats.statesDropped++;
      return false;
    }
    e.lastRaceT = st.raceT;
    if (!e.finished) {
      e.dist = st.dist;
      e.lap = st.lap;
    }
    const ids = seatSockets(room, seatNo);
    // A snapshot is replaced by the next one 1/15 s later, so it is sent as droppable: never queued behind a socket
    // that is not reading (index.mjs decides per socket).
    if (ids.length) broadcast(ids, 'race:state', { seat: seatNo, ...st }, { droppable: true });
    stats.statesRelayed++;
    return true;
  }

  function finish(room, seatNo, f) {
    const race = room.race;
    if (!race || room.phase !== 'racing') throw new ProtocolError('BAD_REQUEST', 'No race is running in this room.');
    if (f.raceId !== race.raceId) throw new ProtocolError('BAD_REQUEST', 'That is not the current race.');
    const e = race.entrants.get(seatNo);
    if (!e) throw new ProtocolError('NOT_IN_ROOM', 'You are not in this race.');
    if (e.dnf) throw new ProtocolError('BAD_REQUEST', 'You are already out of this race.');
    // Accepted once per seat per race. A repeat (a retry after a reconnect, say) is acknowledged without changes.
    if (e.finished) return { duplicate: true };
    const now = clock.now();
    e.finished = true;
    e.finishT = f.raceT;
    e.dist = f.dist;
    e.lap = f.lap;
    e.arrival = ++race.arrivals;
    if (f.raceT > e.lastRaceT) e.lastRaceT = f.raceT;
    if (race.firstFinishAt === null) {
      race.firstFinishAt = now;
      race.finishTimer = clock.setTimeout(() => {
        if (room.race === race) end(room, 'timeout');
      }, timers.finishTimeoutMs);
    }
    // The ack goes out before any results this finish triggers (rooms.mjs queues sends until the ack).
    checkEnd(room);
    return {};
  }

  // The seat left the room (`left`) or was disconnected past the grace period (`expired`). Its racer is DNF unless it
  // had already finished.
  function seatGone(room, seatNo) {
    const race = room.race;
    if (!race) return;
    const e = race.entrants.get(seatNo);
    if (!e) return;
    e.gone = true;
    if (!e.finished) e.dnf = true;
    if (room.seats.size === 0) {
      // Nobody left to race or to tell: drop the race quietly. rooms.mjs starts the empty-room timer.
      cancel(room);
      return;
    }
    if (room.phase === 'racing') checkEnd(room);
  }

  function checkEnd(room) {
    const race = room.race;
    if (!race || room.phase !== 'racing') return;
    for (const e of race.entrants.values()) if (!e.finished && !e.dnf) return;
    end(room, 'all-finished');
  }

  // Standings: finished racers by finish time (ties by arrival), then everyone else by distance, furthest first.
  function standings(race, reason) {
    const all = [...race.entrants.values()];
    const done = all.filter((e) => e.finished).sort((a, b) => (a.finishT - b.finishT) || (a.arrival - b.arrival));
    const rest = all.filter((e) => !e.finished).sort((a, b) => (b.dist - a.dist) || (a.seat - b.seat));
    return [...done, ...rest].map((e, i) => ({
      pos: i + 1,
      seat: e.seat,
      name: e.name,
      bike: e.bike,
      finished: e.finished,
      finishT: e.finished ? e.finishT : null,
      dist: e.dist,
      lap: e.lap,
      // An aborted race never started, so nobody in it is DNF.
      dnf: reason === 'aborted' ? false : !e.finished,
    }));
  }

  function end(room, reason) {
    const race = room.race;
    if (!race) return;
    clearRaceTimers(race);
    if (reason === 'timeout') for (const e of race.entrants.values()) if (!e.finished) e.dnf = true;
    const results = { raceId: race.raceId, reason, order: standings(race, reason) };
    room.race = null;
    room.phase = 'lobby';
    broadcast(seatSockets(room), 'race:results', results);
    stats.racesFinished++;
    hooks.ended(room, results);
  }

  // Drops the race without results (room deleted, or nobody left in it).
  function cancel(room) {
    const race = room.race;
    if (!race) return;
    clearRaceTimers(race);
    room.race = null;
    room.phase = 'lobby';
  }

  // A seat resumed while its race is in progress: it gets the same race:begin again, unless its racer has already
  // finished that race (a race:begin would put a finished racer back on the grid of a race it has completed; it waits
  // for race:results instead, which the room:update with that raceId tells it are still to come).
  function resendBegin(room, seatNo, socketId) {
    const race = room.race;
    if (!race || !ACTIVE.has(room.phase)) return false;
    const e = race.entrants.get(seatNo);
    if (!e || e.gone || e.finished) return false;
    send(socketId, 'race:begin', race.begin);
    return true;
  }

  return { start, relay, finish, seatGone, cancel, resendBegin, standings, isActive: (room) => ACTIVE.has(room.phase) };
}
