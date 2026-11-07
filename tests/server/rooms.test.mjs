import { describe, expect, it } from 'vitest';
import { codeOf, errorOf, roomHarness, stateFor } from './helpers.mjs';
import { RACE_TRACKS } from '../../server/protocol.mjs';

const GRACE = 60000;
const GO = 5000;

// Creates a room with `n` seats: sockets s0..s(n-1), s0 is the host.
function roomWith(h, n, names = []) {
  const created = h.rooms.create('s0', { name: names[0] || 'R0' });
  const tokens = [created.token];
  for (let i = 1; i < n; i++) tokens.push(h.rooms.join(`s${i}`, { pin: created.pin, name: names[i] || `R${i}` }).token);
  return { pin: created.pin, tokens };
}

function startedRace(h, n) {
  const r = roomWith(h, n);
  const { raceId, goAt } = h.rooms.startRace('s0');
  return { ...r, raceId, goAt };
}

describe('create and join', () => {
  it('creates a room with a 4-digit PIN, seat 0, a 128-bit token and the host flag', () => {
    const h = roomHarness();
    const res = h.rooms.create('a', { name: 'Ash', bike: 'kaali', look: { tank: '#111' } });
    expect(res.pin).toMatch(/^\d{4}$/);
    expect(res.seat).toBe(0);
    expect(res.token).toMatch(/^[0-9a-f]{32}$/);
    expect(res.room).toEqual({
      pin: res.pin, phase: 'lobby', you: 0, raceId: null, hostSeat: 0,
      settings: { track: 'mumbai-central', laps: 3, time: 'morning', weather: 'clear' },
      racers: [{ seat: 0, name: 'Ash', bike: 'kaali', look: { tank: '#111' }, host: true, connected: true }],
    });
  });

  it('fills in the default name, bike and look', () => {
    const h = roomHarness();
    const res = h.rooms.create('a', {});
    expect(res.room.racers[0]).toMatchObject({ name: 'Rider', bike: 'stock', look: {} });
  });

  it('gives 500 rooms 500 different PINs', () => {
    const h = roomHarness();
    const pins = new Set();
    for (let i = 0; i < 500; i++) pins.add(h.rooms.create(`s${i}`, {}).pin);
    expect(pins.size).toBe(500);
    for (const pin of pins) expect(pin).toMatch(/^\d{4}$/);
    expect(h.rooms.counts().rooms).toBe(500);
  });

  it('re-rolls a PIN that collides with an active room', () => {
    const draws = [42, 42, 42, 7];
    const random = { int: () => draws.shift(), uint32: () => 1, token: (() => { let n = 0; return () => String(++n).padStart(32, '0'); })() };
    const h = roomHarness({ random });
    expect(h.rooms.create('a', {}).pin).toBe('0042');
    expect(h.rooms.create('b', {}).pin).toBe('0007');
  });

  it('refuses a new room above the room cap with SERVER_BUSY', () => {
    const h = roomHarness({ limits: { maxRooms: 3 } });
    for (let i = 0; i < 3; i++) h.rooms.create(`s${i}`, {});
    expect(codeOf(() => h.rooms.create('s9', {}))).toBe('SERVER_BUSY');
  });

  it('seats eight racers and gives the ninth FULL', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 8);
    const room = h.rooms.get(pin);
    expect([...room.seats.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(codeOf(() => h.rooms.join('s8', { pin }))).toBe('FULL');
    // Everyone was told about every joiner, and every view lists eight racers.
    expect(h.last('s0', 'room:update').racers).toHaveLength(8);
    expect(h.to('s0', 'room:notice').filter((n) => n.kind === 'joined')).toHaveLength(7);
  });

  it('counts a disconnected seat as taken', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 8);
    h.rooms.disconnect('s3');
    expect(codeOf(() => h.rooms.join('s8', { pin }))).toBe('FULL');
  });

  it('answers NOT_FOUND for an unknown PIN and RACING when the room is not in the lobby', () => {
    const h = roomHarness();
    const { pin } = startedRace(h, 2);
    const other = pin === '0000' ? '0001' : '0000';
    expect(codeOf(() => h.rooms.join('x', { pin: other }))).toBe('NOT_FOUND');
    expect(codeOf(() => h.rooms.join('x', { pin }))).toBe('RACING');
    h.clock.advance(GO);
    expect(codeOf(() => h.rooms.join('x', { pin }))).toBe('RACING');
  });

  it('refuses a second room for the same socket with ALREADY_IN_ROOM', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 2);
    expect(codeOf(() => h.rooms.create('s0', {}))).toBe('ALREADY_IN_ROOM');
    expect(codeOf(() => h.rooms.join('s1', { pin }))).toBe('ALREADY_IN_ROOM');
  });

  it('gives a new joiner the lowest free seat', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 3);
    h.rooms.leave('s1');
    expect(h.rooms.join('s9', { pin }).seat).toBe(1);
  });

  it('notifies the others, not the joiner, and sends everyone a view with their own seat', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 1, ['Host']);
    h.clear();
    h.rooms.join('b', { pin, name: 'Bo' });
    expect(h.to('s0', 'room:notice')).toEqual([{ kind: 'joined', name: 'Bo' }]);
    expect(h.to('b', 'room:notice')).toEqual([]);
    expect(h.last('s0', 'room:update').you).toBe(0);
    expect(h.last('b', 'room:update').you).toBe(1);
  });
});

describe('leave, host migration and seat grace', () => {
  it('moves the host to the earliest-joined connected seat when the host leaves', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 3, ['A', 'B', 'C']);
    h.rooms.leave('s1'); // B leaves; seat 1 is free
    h.rooms.join('d', { pin, name: 'D' }); // D takes seat 1 but joined after C
    h.clear();
    h.rooms.leave('s0');
    const room = h.rooms.get(pin);
    expect(room.hostSeat).toBe(2); // C, not D, although D has the lower seat number
    expect(h.to('d', 'room:notice')).toEqual([{ kind: 'left', name: 'A' }, { kind: 'new-host', name: 'C' }]);
    expect(h.last('d', 'room:update').racers.find((r) => r.seat === 2).host).toBe(true);
  });

  it('skips disconnected seats when picking the new host', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 3, ['A', 'B', 'C']);
    h.rooms.disconnect('s1');
    h.rooms.leave('s0');
    expect(h.rooms.get(pin).hostSeat).toBe(2);
  });

  it('keeps a disconnected host for the grace period, then migrates', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 2, ['A', 'B']);
    h.rooms.disconnect('s0');
    expect(h.last('s1', 'room:update').racers[0]).toMatchObject({ seat: 0, connected: false, host: true });
    // The notice follows once the seat has stayed away for 3 s.
    h.clock.advance(3000);
    expect(h.last('s1', 'room:notice')).toEqual({ kind: 'disconnected', name: 'A' });
    h.clock.advance(GRACE - 3000 - 1);
    expect(h.rooms.get(pin).hostSeat).toBe(0);
    h.clock.advance(1);
    expect(h.rooms.get(pin).hostSeat).toBe(1);
    expect(h.rooms.get(pin).seats.size).toBe(1);
    expect(h.to('s1', 'room:notice').slice(-2)).toEqual([{ kind: 'left', name: 'A' }, { kind: 'new-host', name: 'B' }]);
  });

  it('answers leave without a seat with ok', () => {
    const h = roomHarness();
    expect(h.rooms.leave('nobody')).toEqual({});
  });
});

describe('sessions', () => {
  it('resumes the same seat with the token after a disconnect', () => {
    const h = roomHarness();
    const { pin, tokens } = roomWith(h, 2, ['A', 'B']);
    h.rooms.disconnect('s1');
    h.clock.advance(GRACE - 1000);
    h.clear();
    const res = h.rooms.resume('s1b', { token: tokens[1] });
    expect(res).toMatchObject({ pin, seat: 1 });
    expect(res.token).toBeUndefined();
    expect(res.room.racers[1].connected).toBe(true);
    expect(h.to('s0', 'room:notice')).toEqual([{ kind: 'reconnected', name: 'B' }]);
    // The grace timer was cancelled.
    h.clock.advance(GRACE);
    expect(h.rooms.get(pin).seats.size).toBe(2);
  });

  it('takes over a seat that another socket still holds and kicks it with SUPERSEDED', () => {
    const h = roomHarness();
    const { tokens } = roomWith(h, 2);
    h.clear();
    const res = h.rooms.resume('tab2', { token: tokens[1] });
    expect(res.seat).toBe(1);
    expect(h.kicked).toEqual([{ to: 's1', code: 'SUPERSEDED', message: expect.any(String) }]);
    expect(h.rooms.seatOf('s1')).toBeNull();
    expect(h.rooms.seatOf('tab2')).toMatchObject({ seat: 1 });
    // A takeover is not a reconnect.
    expect(h.to('s0', 'room:notice')).toEqual([]);
    // The old socket's late disconnect does not touch the seat.
    h.rooms.disconnect('s1');
    expect(h.rooms.get(res.pin).seats.get(1).connected).toBe(true);
  });

  it('is idempotent for the socket that already holds the seat', () => {
    const h = roomHarness();
    const { tokens } = roomWith(h, 1);
    expect(h.rooms.resume('s0', { token: tokens[0] }).seat).toBe(0);
    expect(h.kicked).toEqual([]);
  });

  it('refuses a socket that holds a different seat with ALREADY_IN_ROOM', () => {
    const h = roomHarness();
    const { tokens } = roomWith(h, 2);
    expect(codeOf(() => h.rooms.resume('s0', { token: tokens[1] }))).toBe('ALREADY_IN_ROOM');
  });

  it('answers NOT_FOUND for an unknown token and EXPIRED for a seat that is gone', () => {
    const h = roomHarness();
    const { pin, tokens } = roomWith(h, 3);
    expect(codeOf(() => h.rooms.resume('x', { token: 'f'.repeat(32) }))).toBe('NOT_FOUND');
    h.rooms.leave('s1');
    expect(codeOf(() => h.rooms.resume('x', { token: tokens[1] }))).toBe('EXPIRED');
    h.rooms.disconnect('s2');
    h.clock.advance(GRACE);
    expect(codeOf(() => h.rooms.resume('x', { token: tokens[2] }))).toBe('EXPIRED');
    expect(h.rooms.get(pin).seats.size).toBe(1);
  });

  it('answers EXPIRED after the room has closed', () => {
    const h = roomHarness();
    const { tokens } = roomWith(h, 1);
    h.rooms.disconnect('s0');
    h.clock.advance(GRACE + 60000);
    expect(codeOf(() => h.rooms.resume('x', { token: tokens[0] }))).toBe('EXPIRED');
  });
});

describe('room lifetime', () => {
  it('deletes an empty room 60 s after its last seat leaves', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 1);
    h.rooms.leave('s0');
    expect(h.rooms.get(pin)).not.toBeNull();
    h.clock.advance(59999);
    expect(h.rooms.get(pin)).not.toBeNull();
    h.clock.advance(1);
    expect(h.rooms.get(pin)).toBeNull();
    expect(h.rooms.counts().rooms).toBe(0);
    expect(codeOf(() => h.rooms.join('x', { pin }))).toBe('NOT_FOUND');
  });

  it('keeps an empty room that someone joins again, with the joiner as host', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 1);
    h.rooms.leave('s0');
    h.clock.advance(30000);
    const res = h.rooms.join('back', { pin });
    expect(res.room.hostSeat).toBe(res.seat);
    h.clock.advance(60000);
    expect(h.rooms.get(pin)).not.toBeNull();
  });

  it('deletes a room whose last seat expires, 60 s after that', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 1);
    h.rooms.disconnect('s0');
    h.clock.advance(GRACE);
    expect(h.rooms.get(pin)).not.toBeNull();
    h.clock.advance(60000);
    expect(h.rooms.get(pin)).toBeNull();
  });

  it('expires a lobby after 30 minutes without activity', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 2);
    h.clock.advance(20 * 60000);
    h.rooms.settings('s0', { laps: 5 }); // activity
    h.clock.advance(20 * 60000);
    expect(h.rooms.get(pin)).not.toBeNull();
    h.clock.advance(10 * 60000);
    expect(h.rooms.get(pin)).toBeNull();
    expect(h.last('s0', 'room:closed')).toEqual({ reason: 'expired' });
    expect(h.last('s1', 'room:closed')).toEqual({ reason: 'expired' });
    // The sockets are free to start again.
    expect(h.rooms.seatOf('s0')).toBeNull();
    expect(h.rooms.create('s0', {}).seat).toBe(0);
  });

  it('does not expire a room while it races', () => {
    const h = roomHarness();
    const { pin } = startedRace(h, 2);
    h.clock.advance(GO);
    h.clock.advance(35 * 60000);
    expect(h.rooms.get(pin)).not.toBeNull();
    expect(h.rooms.get(pin).phase).toBe('racing');
  });

  it('sends server-shutdown to every seat on shutdown', () => {
    const h = roomHarness();
    roomWith(h, 2);
    h.rooms.create('lonely', {});
    h.rooms.shutdown();
    for (const s of ['s0', 's1', 'lonely']) expect(h.last(s, 'room:closed')).toEqual({ reason: 'server-shutdown' });
    expect(h.rooms.counts().rooms).toBe(0);
    expect(h.clock.pending()).toBe(0);
  });
});

describe('settings and racer updates', () => {
  it('lets only the host change settings, only in the lobby', () => {
    const h = roomHarness();
    roomWith(h, 2, ['A', 'B']);
    h.clear();
    const res = h.rooms.settings('s0', { track: 'random', laps: 1, time: 'night', weather: 'monsoon' });
    expect(res.room.settings).toEqual({ track: 'random', laps: 1, time: 'night', weather: 'monsoon' });
    expect(h.to('s1', 'room:notice')).toEqual([{ kind: 'settings', name: 'A' }]);
    expect(h.last('s1', 'room:update').settings.laps).toBe(1);
    expect(codeOf(() => h.rooms.settings('s1', { laps: 5 }))).toBe('NOT_HOST');
    expect(codeOf(() => h.rooms.settings('zz', { laps: 5 }))).toBe('NOT_IN_ROOM');
    h.rooms.startRace('s0');
    expect(codeOf(() => h.rooms.settings('s0', { laps: 5 }))).toBe('RACE_IN_PROGRESS');
  });

  it('does not broadcast a settings patch that changes nothing', () => {
    const h = roomHarness();
    roomWith(h, 2);
    h.clear();
    h.rooms.settings('s0', { laps: 3 });
    expect(h.to('s1')).toEqual([]);
  });

  it('updates a racer in the lobby only', () => {
    const h = roomHarness();
    roomWith(h, 2);
    h.clear();
    const res = h.rooms.updateRacer('s1', { name: 'Neo', bike: 'neon', look: { t: 1 } });
    expect(res.room.racers[1]).toMatchObject({ name: 'Neo', bike: 'neon', look: { t: 1 } });
    expect(h.last('s0', 'room:update').racers[1].name).toBe('Neo');
    h.rooms.startRace('s0');
    expect(codeOf(() => h.rooms.updateRacer('s1', { name: 'X' }))).toBe('RACE_IN_PROGRESS');
  });
});

describe('race start', () => {
  it('needs the host and at least 2 connected racers', () => {
    const h = roomHarness();
    roomWith(h, 1);
    expect(codeOf(() => h.rooms.startRace('s0'))).toBe('NOT_ENOUGH_RACERS');
    const h2 = roomHarness();
    roomWith(h2, 3);
    h2.rooms.disconnect('s1');
    h2.rooms.disconnect('s2');
    expect(codeOf(() => h2.rooms.startRace('s0'))).toBe('NOT_ENOUGH_RACERS');
    expect(codeOf(() => h2.rooms.startRace('nobody'))).toBe('NOT_IN_ROOM');
    const h3 = roomHarness();
    roomWith(h3, 2);
    expect(codeOf(() => h3.rooms.startRace('s1'))).toBe('NOT_HOST');
  });

  it('sends the same race:begin to every seat, with GO 5 s ahead and the grid in seat order', () => {
    const h = roomHarness();
    const { pin } = roomWith(h, 3, ['A', 'B', 'C']);
    h.rooms.updateRacer('s2', { bike: 'raja', look: { x: 1 } });
    h.clear();
    const now = h.clock.now();
    const res = h.rooms.startRace('s0');
    expect(res.goAt).toBe(now + 5000);
    const begins = ['s0', 's1', 's2'].map((s) => h.last(s, 'race:begin'));
    expect(begins[0]).toEqual(begins[1]);
    expect(begins[0]).toEqual(begins[2]);
    expect(begins[0]).toMatchObject({ raceId: res.raceId, goAt: res.goAt, track: 'mumbai-central', laps: 3, time: 'morning', weather: 'clear' });
    expect(Number.isInteger(begins[0].seed) && begins[0].seed >= 0 && begins[0].seed < 2 ** 32).toBe(true);
    expect(begins[0].racers).toEqual([
      { seat: 0, name: 'A', bike: 'stock', look: {} },
      { seat: 1, name: 'B', bike: 'stock', look: {} },
      { seat: 2, name: 'C', bike: 'raja', look: { x: 1 } },
    ]);
    expect(h.last('s1', 'room:update')).toMatchObject({ phase: 'countdown', raceId: res.raceId });
    expect(h.rooms.get(pin).phase).toBe('countdown');
  });

  it('resolves the random track from the seed', () => {
    for (const seed of [0, 1, 5, 6, 4000000000]) {
      const random = { int: (m) => 1234 % m, uint32: () => seed, token: () => Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32) };
      const h = roomHarness({ random });
      roomWith(h, 2);
      h.rooms.settings('s0', { track: 'random' });
      h.rooms.startRace('s0');
      expect(h.last('s1', 'race:begin').track).toBe(RACE_TRACKS[seed % RACE_TRACKS.length]);
    }
  });

  it('turns to racing at GO', () => {
    const h = roomHarness();
    const { pin } = startedRace(h, 2);
    h.clock.advance(GO - 1);
    expect(h.rooms.get(pin).phase).toBe('countdown');
    h.clock.advance(1);
    expect(h.rooms.get(pin).phase).toBe('racing');
    expect(h.last('s1', 'room:update').phase).toBe('racing');
  });

  it('aborts at GO when fewer than 2 racers are still connected', () => {
    const h = roomHarness();
    const { pin, raceId } = startedRace(h, 2);
    h.rooms.disconnect('s1');
    h.clock.advance(GO);
    const results = h.last('s0', 'race:results');
    expect(results).toMatchObject({ raceId, reason: 'aborted' });
    expect(results.order.map((o) => o.dnf)).toEqual([false, false]);
    expect(h.rooms.get(pin).phase).toBe('lobby');
    expect(h.last('s0', 'room:update')).toMatchObject({ phase: 'lobby', raceId: null });
  });

  it('drops the race quietly when every seat leaves during the countdown', () => {
    const h = roomHarness();
    const { pin } = startedRace(h, 2);
    h.rooms.leave('s0');
    h.rooms.leave('s1');
    expect(h.rooms.get(pin).race).toBeNull();
    expect(h.rooms.get(pin).phase).toBe('lobby');
    h.clock.advance(GO);
    h.clock.advance(60000);
    expect(h.rooms.get(pin)).toBeNull();
  });
});

describe('race:state relay', () => {
  it('relays to the other seats with the sender seat added', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 3);
    h.clock.advance(GO);
    h.clear();
    expect(h.rooms.state('s1', stateFor(raceId, 1))).toBe(true);
    expect(h.to('s0', 'race:state')).toEqual([{ seat: 1, ...stateFor(raceId, 1) }]);
    expect(h.to('s2', 'race:state')).toHaveLength(1);
    expect(h.to('s1', 'race:state')).toEqual([]);
  });

  it('accepts snapshots during the countdown', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 2);
    expect(h.rooms.state('s0', stateFor(raceId, 0))).toBe(true);
  });

  it('drops a wrong raceId, a non-increasing raceT, a lobby phase and an unseated socket', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 2);
    h.clock.advance(GO);
    expect(h.rooms.state('s0', stateFor(raceId + 1, 1))).toBe(false);
    expect(h.rooms.state('s0', stateFor(raceId, 2))).toBe(true);
    expect(h.rooms.state('s0', stateFor(raceId, 2))).toBe(false);
    expect(h.rooms.state('s0', stateFor(raceId, 1.5))).toBe(false);
    expect(h.rooms.state('s0', stateFor(raceId, 2.1))).toBe(true);
    expect(h.rooms.state('nobody', stateFor(raceId, 3))).toBe(false);
    expect(h.stats.statesDropped).toBe(4);
    const h2 = roomHarness();
    roomWith(h2, 2);
    expect(h2.rooms.state('s0', stateFor(1, 1))).toBe(false);
  });
});

describe('finish and results', () => {
  it('orders finishers by time (ties by arrival), then the rest by distance', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 5);
    h.clock.advance(GO);
    h.rooms.state('s3', stateFor(raceId, 30, { dist: 900, lap: 1 }));
    h.rooms.state('s4', stateFor(raceId, 30, { dist: 1200, lap: 1 }));
    h.rooms.finish('s2', { raceId, raceT: 61, dist: 3000, lap: 3 });
    h.rooms.finish('s0', { raceId, raceT: 60, dist: 3000, lap: 3 });
    h.rooms.finish('s1', { raceId, raceT: 61, dist: 3000, lap: 3 });
    h.clock.advance(120000);
    const r = h.last('s0', 'race:results');
    expect(r.reason).toBe('timeout');
    expect(r.order.map((o) => o.seat)).toEqual([0, 2, 1, 4, 3]);
    expect(r.order.map((o) => o.pos)).toEqual([1, 2, 3, 4, 5]);
    expect(r.order[0]).toEqual({ pos: 1, seat: 0, name: 'R0', bike: 'stock', finished: true, finishT: 60, dist: 3000, lap: 3, dnf: false });
    expect(r.order[3]).toEqual({ pos: 4, seat: 4, name: 'R4', bike: 'stock', finished: false, finishT: null, dist: 1200, lap: 1, dnf: true });
    // Every seat got the identical results.
    for (const s of ['s1', 's2', 's3', 's4']) expect(h.last(s, 'race:results')).toEqual(r);
  });

  it('ends with all-finished as soon as everyone has finished, and sends the ack data first', () => {
    const h = roomHarness();
    const { pin, raceId } = startedRace(h, 2);
    h.clock.advance(GO);
    expect(h.rooms.finish('s0', { raceId, raceT: 50, dist: 1000, lap: 1 })).toEqual({});
    expect(h.last('s0', 'race:results')).toBeUndefined();
    h.rooms.finish('s1', { raceId, raceT: 55, dist: 1000, lap: 1 });
    expect(h.last('s0', 'race:results')).toMatchObject({ reason: 'all-finished', raceId });
    expect(h.rooms.get(pin)).toMatchObject({ phase: 'lobby', race: null });
    // The finish timer was cleared with the race.
    h.clock.advance(200000);
    expect(h.to('s0', 'race:results')).toHaveLength(1);
  });

  it('accepts one finish per seat and acknowledges repeats without changes', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 3);
    h.clock.advance(GO);
    h.rooms.finish('s0', { raceId, raceT: 50, dist: 1000, lap: 1 });
    expect(h.rooms.finish('s0', { raceId, raceT: 10, dist: 1000, lap: 1 })).toEqual({ duplicate: true });
    h.clock.advance(120000);
    expect(h.last('s0', 'race:results').order[0].finishT).toBe(50);
  });

  it('rejects a finish outside a running race or for another race', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 2);
    expect(codeOf(() => h.rooms.finish('s0', { raceId, raceT: 1, dist: 1, lap: 1 }))).toBe('BAD_REQUEST'); // countdown
    h.clock.advance(GO);
    expect(codeOf(() => h.rooms.finish('s0', { raceId: raceId + 1, raceT: 1, dist: 1, lap: 1 }))).toBe('BAD_REQUEST');
    expect(codeOf(() => h.rooms.finish('zz', { raceId, raceT: 1, dist: 1, lap: 1 }))).toBe('NOT_IN_ROOM');
  });

  it('DNFs a racer disconnected for more than 60 s and ends the race when the rest are done', () => {
    const h = roomHarness();
    const { pin, raceId } = startedRace(h, 3);
    h.clock.advance(GO);
    h.rooms.state('s2', stateFor(raceId, 5, { dist: 400 }));
    h.rooms.disconnect('s2');
    h.rooms.finish('s0', { raceId, raceT: 40, dist: 1000, lap: 1 });
    h.rooms.finish('s1', { raceId, raceT: 41, dist: 1000, lap: 1 });
    expect(h.last('s0', 'race:results')).toBeUndefined();
    h.clock.advance(GRACE);
    const r = h.last('s0', 'race:results');
    expect(r.reason).toBe('all-finished');
    expect(r.order[2]).toMatchObject({ seat: 2, finished: false, dnf: true, dist: 400 });
    expect(h.rooms.get(pin).seats.size).toBe(2);
  });

  it('DNFs everyone still racing 120 s after the first finisher', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 3);
    h.clock.advance(GO + 30000);
    h.rooms.finish('s1', { raceId, raceT: 30, dist: 1000, lap: 1 });
    h.clock.advance(119999);
    expect(h.last('s0', 'race:results')).toBeUndefined();
    h.clock.advance(1);
    const r = h.last('s0', 'race:results');
    expect(r.reason).toBe('timeout');
    expect(r.order.map((o) => [o.seat, o.dnf])).toEqual([[1, false], [0, true], [2, true]]);
  });

  it('keeps a racer who resumes within the grace period in the race', () => {
    const h = roomHarness();
    const { tokens, raceId } = startedRace(h, 2);
    h.clock.advance(GO);
    h.rooms.disconnect('s1');
    h.clock.advance(30000);
    h.clear();
    h.rooms.resume('s1b', { token: tokens[1] });
    // race:begin comes straight after the ack, before the views.
    expect(h.events('s1b').slice(0, 2)).toEqual(['race:begin', 'room:update']);
    expect(h.last('s1b', 'race:begin').raceId).toBe(raceId);
    h.clock.advance(GRACE);
    h.rooms.finish('s0', { raceId, raceT: 80, dist: 1000, lap: 1 });
    h.rooms.finish('s1b', { raceId, raceT: 81, dist: 1000, lap: 1 });
    expect(h.last('s0', 'race:results').order.map((o) => o.finished)).toEqual([true, true]);
  });

  it('counts a racer who leaves mid-race as DNF in the results', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 3);
    h.clock.advance(GO);
    h.rooms.state('s2', stateFor(raceId, 3, { dist: 50 }));
    h.rooms.leave('s2');
    h.rooms.finish('s0', { raceId, raceT: 40, dist: 1000, lap: 1 });
    h.rooms.finish('s1', { raceId, raceT: 42, dist: 1000, lap: 1 });
    const r = h.last('s0', 'race:results');
    expect(r.reason).toBe('all-finished');
    expect(r.order[2]).toMatchObject({ seat: 2, name: 'R2', dnf: true, finished: false });
  });

  it('ends the race when the last racer still on track leaves', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 2);
    h.clock.advance(GO);
    h.rooms.finish('s0', { raceId, raceT: 40, dist: 1000, lap: 1 });
    h.rooms.leave('s1');
    expect(h.last('s0', 'race:results')).toMatchObject({ reason: 'all-finished' });
  });

  it('allows the host to race again after results, with a new raceId', () => {
    const h = roomHarness();
    const { raceId } = startedRace(h, 2);
    h.clock.advance(GO);
    h.rooms.finish('s0', { raceId, raceT: 40, dist: 1000, lap: 1 });
    h.rooms.finish('s1', { raceId, raceT: 41, dist: 1000, lap: 1 });
    const again = h.rooms.startRace('s0');
    expect(again.raceId).toBeGreaterThan(raceId);
    expect(h.last('s1', 'race:begin').raceId).toBe(again.raceId);
  });

  it('ends a race that runs past the protocol maximum as a timeout', () => {
    const h = roomHarness();
    startedRace(h, 2);
    h.clock.advance(GO + 3660000);
    expect(h.last('s0', 'race:results')).toMatchObject({ reason: 'timeout' });
  });

  it('does not send race:begin again to a seat whose racer has already finished that race (finding 16)', () => {
    const h = roomHarness();
    const { tokens, raceId } = startedRace(h, 3);
    h.clock.advance(GO);
    h.rooms.finish('s1', { raceId, raceT: 30, dist: 1000, lap: 1 });
    h.rooms.disconnect('s1');
    h.clock.advance(1000);
    h.clear();
    const res = h.rooms.resume('s1b', { token: tokens[1] });
    // The view still says the race is on, so the client knows results are to come.
    expect(res.room).toMatchObject({ phase: 'racing', raceId });
    expect(h.events('s1b')).toEqual(['room:update']);
    // A racer who is still on track does get it.
    h.rooms.disconnect('s2');
    h.clock.advance(1000);
    h.rooms.resume('s2b', { token: tokens[2] });
    expect(h.events('s2b').slice(0, 2)).toEqual(['race:begin', 'room:update']);
    // The finished racer gets the results like everyone else.
    h.rooms.finish('s0', { raceId, raceT: 31, dist: 1000, lap: 1 });
    h.rooms.finish('s2b', { raceId, raceT: 32, dist: 1000, lap: 1 });
    expect(h.last('s1b', 'race:results')).toMatchObject({ raceId, reason: 'all-finished' });
    expect(h.last('s1b', 'race:results').order.map((o) => o.seat)).toEqual([1, 0, 2]);
  });
});

describe('room budgets (finding 1)', () => {
  it('lets one address keep at most 5 rooms that have someone in them', () => {
    const h = roomHarness();
    for (let i = 0; i < 5; i++) h.rooms.create(`a${i}`, {}, 'owner-a');
    expect(errorOf(() => h.rooms.create('a5', {}, 'owner-a'))).toEqual({ code: 'RATE_LIMITED', retryAfterSec: 60 });
    // Another address is not affected.
    expect(h.rooms.create('b0', {}, 'owner-b').seat).toBe(0);
    // A room that empties frees its slot at once: it waits out its 60 s, but no longer counts.
    h.rooms.leave('a0');
    expect(h.rooms.create('a5', {}, 'owner-a').seat).toBe(0);
    expect(codeOf(() => h.rooms.create('a6', {}, 'owner-a'))).toBe('RATE_LIMITED');
    // So does a room whose last seat dropped and did not come back within the grace period.
    h.rooms.disconnect('a1');
    expect(codeOf(() => h.rooms.create('a6', {}, 'owner-a'))).toBe('RATE_LIMITED');
    h.clock.advance(GRACE);
    expect(h.rooms.create('a6', {}, 'owner-a').seat).toBe(0);
  });

  it('lets one address create at most 10 rooms in 10 minutes, with retryAfterSec from the oldest create', () => {
    const h = roomHarness();
    for (let i = 0; i < 10; i++) {
      h.rooms.create(`s${i}`, {}, 'owner-a');
      h.rooms.leave(`s${i}`);
      h.clock.advance(1000);
    }
    // The first create was 10 s ago, so the next one fits 590 s from now.
    expect(errorOf(() => h.rooms.create('x', {}, 'owner-a'))).toEqual({ code: 'RATE_LIMITED', retryAfterSec: 590 });
    expect(h.rooms.create('y', {}, 'owner-b').seat).toBe(0);
    h.clock.advance(589999);
    expect(codeOf(() => h.rooms.create('x', {}, 'owner-a'))).toBe('RATE_LIMITED');
    h.clock.advance(1);
    expect(h.rooms.create('x', {}, 'owner-a').seat).toBe(0);
    // A refused create costs nothing, and the record of an address goes once its window is over.
    h.clock.advance(600000);
    h.rooms.sweep();
    for (let i = 0; i < 10; i++) {
      h.rooms.create(`z${i}`, {}, 'owner-a');
      h.rooms.leave(`z${i}`);
    }
  });

  it('does not count empty rooms against the server cap: one address churning rooms cannot lock others out', () => {
    const h = roomHarness({ limits: { maxRooms: 3 } });
    // Without the per-address budget (no owner), as many creates and leaves as anyone likes.
    for (let i = 0; i < 50; i++) {
      h.rooms.create(`c${i}`, {});
      h.rooms.leave(`c${i}`);
    }
    expect(h.rooms.counts()).toMatchObject({ rooms: 3, emptyRooms: 3 });
    for (let i = 0; i < 3; i++) expect(h.rooms.create(`v${i}`, {}).seat).toBe(0);
    expect(h.rooms.counts()).toMatchObject({ rooms: 3, emptyRooms: 0, seats: 3 });
    // Three rooms with someone in them: the cap holds.
    expect(codeOf(() => h.rooms.create('v3', {}))).toBe('SERVER_BUSY');
  });

  it('makes way by closing the room that has been empty the longest', () => {
    const h = roomHarness({ limits: { maxRooms: 3 } });
    const a = h.rooms.create('a', {}).pin;
    const b = h.rooms.create('b', {}).pin;
    h.rooms.create('c', {});
    h.rooms.leave('b');
    h.clock.advance(10);
    h.rooms.leave('a');
    h.rooms.create('d', {});
    expect(h.rooms.get(b)).toBeNull();
    expect(h.rooms.get(a)).not.toBeNull();
    // A join brings an empty room back into the count.
    h.rooms.join('a2', { pin: a });
    expect(codeOf(() => h.rooms.create('e', {}))).toBe('SERVER_BUSY');
    expect(h.rooms.get(a).seats.size).toBe(1);
  });
});

describe('reconnect churn (finding 3)', () => {
  it('holds the disconnected notice for 3 s, and drops it (and reconnected) when the seat is back in time', () => {
    const h = roomHarness();
    const { tokens } = roomWith(h, 2, ['A', 'B']);
    h.clear();
    h.rooms.disconnect('s1');
    // The views show the drop at once; the notice waits.
    expect(h.last('s0', 'room:update').racers[1].connected).toBe(false);
    expect(h.to('s0', 'room:notice')).toEqual([]);
    h.clock.advance(2999);
    h.rooms.resume('s1b', { token: tokens[1] });
    h.clock.advance(10000);
    expect(h.to('s0', 'room:notice')).toEqual([]);
    expect(h.last('s0', 'room:update').racers[1].connected).toBe(true);
    // A drop that lasts: disconnected after 3 s, then reconnected when it comes back.
    h.rooms.disconnect('s1b');
    h.clock.advance(3000);
    expect(h.to('s0', 'room:notice')).toEqual([{ kind: 'disconnected', name: 'B' }]);
    h.rooms.resume('s1c', { token: tokens[1] });
    expect(h.to('s0', 'room:notice')).toEqual([{ kind: 'disconnected', name: 'B' }, { kind: 'reconnected', name: 'B' }]);
    // A seat that leaves before its notice is due goes with just `left`.
    h.clear();
    h.rooms.disconnect('s1c');
    h.rooms.resume('s1d', { token: tokens[1] });
    h.rooms.leave('s1d');
    h.clock.advance(10000);
    expect(h.to('s0', 'room:notice')).toEqual([{ kind: 'left', name: 'B' }]);
    expect(h.clock.pending()).toBe(1); // only the idle timer
  });

  it('lets a seat move to another socket at most 5 times a minute, answering RATE_LIMITED with retryAfterSec', () => {
    const h = roomHarness();
    const { tokens } = roomWith(h, 2, ['A', 'B']);
    h.clear();
    let sock = 's1';
    for (let i = 0; i < 5; i++) {
      h.rooms.disconnect(sock);
      h.clock.advance(1000);
      sock = `s1-${i}`;
      expect(h.rooms.resume(sock, { token: tokens[1] }).seat).toBe(1);
    }
    // The 6th move, here a takeover from another tab: the oldest of the 5 was at +1 s, so the next fits at +61 s.
    expect(errorOf(() => h.rooms.resume('tab', { token: tokens[1] }))).toEqual({ code: 'RATE_LIMITED', retryAfterSec: 56 });
    expect(h.kicked).toEqual([]);
    expect(h.rooms.seatOf(sock)).toMatchObject({ seat: 1 });
    expect(h.rooms.seatOf('tab')).toBeNull();
    // The churn cost the others 2 views per move, and not a single notice.
    expect(h.to('s0', 'room:update')).toHaveLength(10);
    expect(h.to('s0', 'room:notice')).toEqual([]);
    h.clock.advance(55999);
    expect(codeOf(() => h.rooms.resume('tab', { token: tokens[1] }))).toBe('RATE_LIMITED');
    h.clock.advance(1);
    expect(h.rooms.resume('tab', { token: tokens[1] }).seat).toBe(1);
    expect(h.kicked).toEqual([{ to: sock, code: 'SUPERSEDED', message: expect.any(String) }]);
    // A resume by the socket that already holds the seat moves nothing, and is not counted.
    for (let i = 0; i < 10; i++) expect(h.rooms.resume('tab', { token: tokens[1] }).seat).toBe(1);
  });
});
