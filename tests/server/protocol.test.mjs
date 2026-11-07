import { describe, expect, it } from 'vitest';
import {
  BIKES, KNOWN_EVENTS, ProtocolError, RACE_TRACKS, REQUEST_EVENTS, TRACKS, sanitizeLook, sanitizeName, validate,
} from '../../server/protocol.mjs';
import { codeOf, stateFor } from './helpers.mjs';

const bad = (event, payload) => codeOf(() => validate(event, payload));

describe('protocol constants', () => {
  it('match the spec lists', () => {
    expect(BIKES).toEqual(['stock', 'kaali', 'chrome', 'sticker', 'cafe', 'neon', 'drag', 'raja']);
    expect(TRACKS).toEqual(['random', 'mumbai-central', 'dharavi-lanes', 'mumbai-underground', 'sion-flyover', 'crawford-market', 'bandstand-rush']);
    expect(RACE_TRACKS).not.toContain('random');
    expect(REQUEST_EVENTS).toEqual(['room:create', 'room:join', 'session:resume', 'room:leave', 'room:settings', 'racer:update', 'race:start', 'race:finish', 'clock:ping']);
    expect(KNOWN_EVENTS).toContain('race:state');
  });

  it('ProtocolError turns into an ack', () => {
    expect(new ProtocolError('LOCKED_OUT', 'wait', 60).toAck()).toEqual({ ok: false, code: 'LOCKED_OUT', message: 'wait', retryAfterSec: 60 });
    expect(new ProtocolError('FULL', 'full').toAck()).toEqual({ ok: false, code: 'FULL', message: 'full' });
  });
});

describe('sanitizeName', () => {
  it('trims and keeps a normal name', () => {
    expect(sanitizeName('  Raju  ')).toBe('Raju');
  });

  it('removes control characters and bidi overrides and collapses spaces', () => {
    expect(sanitizeName('Ra\u0000ju\u0007\n\t Bhai')).toBe('Raju Bhai');
    expect(sanitizeName('\u202eevil\u202c')).toBe('evil');
    expect(sanitizeName('a\u2028b\u2029c\u0085d')).toBe('abcd');
  });

  it('cuts to 16 characters without splitting an emoji', () => {
    expect(sanitizeName('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnop');
    const name = '\u{1F3CD}'.repeat(20);
    const out = sanitizeName(name);
    expect(Array.from(out)).toHaveLength(16);
    expect(out).toBe('\u{1F3CD}'.repeat(16));
  });

  it('falls back to Rider when nothing is left', () => {
    expect(sanitizeName('')).toBe('Rider');
    expect(sanitizeName('   ')).toBe('Rider');
    expect(sanitizeName('\u0001\u0002')).toBe('Rider');
  });

  it('rejects a non-string', () => {
    expect(codeOf(() => sanitizeName(42))).toBe('BAD_REQUEST');
    expect(codeOf(() => sanitizeName(null))).toBe('BAD_REQUEST');
    expect(codeOf(() => sanitizeName(['a']))).toBe('BAD_REQUEST');
  });
});

describe('sanitizeLook', () => {
  it('accepts a plain object and returns a copy', () => {
    const look = { tank: '#fff', mods: { exhaust: 'twin' }, list: [1, 2] };
    const out = sanitizeLook(look);
    expect(out).toEqual(look);
    expect(out).not.toBe(look);
    expect(out.mods).not.toBe(look.mods);
  });

  it('accepts exactly 2 KB and rejects more', () => {
    const fits = { x: 'a'.repeat(2048 - JSON.stringify({ x: '' }).length) };
    expect(JSON.stringify(fits)).toHaveLength(2048);
    expect(sanitizeLook(fits)).toEqual(fits);
    const tooBig = { x: 'a'.repeat(2049 - JSON.stringify({ x: '' }).length) };
    expect(codeOf(() => sanitizeLook(tooBig))).toBe('BAD_REQUEST');
  });

  it('counts bytes, not characters', () => {
    const multi = { x: '\u0928'.repeat(700) }; // 3 bytes each in UTF-8
    expect(codeOf(() => sanitizeLook(multi))).toBe('BAD_REQUEST');
  });

  it('rejects anything that is not a plain object', () => {
    for (const v of [null, [], 'look', 5, true, new Date(), new Map()]) expect(codeOf(() => sanitizeLook(v))).toBe('BAD_REQUEST');
  });
});

describe('validate', () => {
  it('room:create takes optional name, bike and look', () => {
    expect(validate('room:create', {})).toEqual({});
    expect(validate('room:create', undefined)).toEqual({});
    expect(validate('room:create', { name: '  Ash ', bike: 'neon', look: { a: 1 } })).toEqual({ name: 'Ash', bike: 'neon', look: { a: 1 } });
  });

  it('rejects unknown keys and non-object payloads', () => {
    expect(bad('room:create', { name: 'a', admin: true })).toBe('BAD_REQUEST');
    expect(bad('room:leave', { x: 1 })).toBe('BAD_REQUEST');
    expect(bad('room:create', null)).toBe('BAD_REQUEST');
    expect(bad('room:create', [])).toBe('BAD_REQUEST');
    expect(bad('room:create', 'hi')).toBe('BAD_REQUEST');
    expect(bad('room:create', 7)).toBe('BAD_REQUEST');
  });

  it('ignores the prototype chain and rejects own __proto__ keys', () => {
    const evil = JSON.parse('{"__proto__": {"admin": true}}');
    expect(bad('room:create', evil)).toBe('BAD_REQUEST');
  });

  it('rejects unknown events', () => {
    expect(bad('room:destroy', {})).toBe('BAD_REQUEST');
  });

  it('room:join needs a 4-digit string PIN', () => {
    expect(validate('room:join', { pin: '0042' })).toEqual({ pin: '0042' });
    for (const pin of ['123', '12345', '12a4', ' 1234', 1234, null, undefined, '\uff11\uff12\uff13\uff14']) {
      expect(bad('room:join', { pin })).toBe('BAD_REQUEST');
    }
    expect(bad('room:join', {})).toBe('BAD_REQUEST');
  });

  it('rejects a wrong bike or a wrong-typed name', () => {
    expect(bad('room:join', { pin: '1234', bike: 'ducati' })).toBe('BAD_REQUEST');
    expect(bad('room:join', { pin: '1234', bike: 3 })).toBe('BAD_REQUEST');
    expect(bad('room:join', { pin: '1234', name: 5 })).toBe('BAD_REQUEST');
  });

  it('session:resume needs a 32-hex token', () => {
    const token = 'a'.repeat(32);
    expect(validate('session:resume', { token })).toEqual({ token });
    for (const t of ['A'.repeat(32), 'a'.repeat(31), 'a'.repeat(33), 'g'.repeat(32), 12]) expect(bad('session:resume', { token: t })).toBe('BAD_REQUEST');
  });

  it('room:settings takes only the listed values', () => {
    expect(validate('room:settings', { track: 'random', laps: 5, time: 'night', weather: 'monsoon' }))
      .toEqual({ track: 'random', laps: 5, time: 'night', weather: 'monsoon' });
    expect(validate('room:settings', {})).toEqual({});
    expect(bad('room:settings', { laps: 2 })).toBe('BAD_REQUEST');
    expect(bad('room:settings', { laps: '3' })).toBe('BAD_REQUEST');
    expect(bad('room:settings', { track: 'bhaag-chapri' })).toBe('BAD_REQUEST');
    expect(bad('room:settings', { time: 'auto' })).toBe('BAD_REQUEST');
    expect(bad('room:settings', { weather: 'rain' })).toBe('BAD_REQUEST');
  });

  it('race:finish checks every field', () => {
    const ok = { raceId: 3, raceT: 61.5, dist: 4000, lap: 3 };
    expect(validate('race:finish', ok)).toEqual(ok);
    expect(validate('race:finish', { ...ok, raceT: 0 })).toEqual({ ...ok, raceT: 0 });
    expect(validate('race:finish', { ...ok, raceT: 3600 })).toEqual({ ...ok, raceT: 3600 });
    for (const patch of [{ raceT: -0.1 }, { raceT: 3600.1 }, { raceT: NaN }, { raceT: Infinity }, { raceT: '10' }, { raceId: 0 }, { raceId: 1.5 },
      { dist: -1 }, { dist: 1e6 + 1 }, { lap: 1.5 }, { lap: -2 }, { lap: 201 }]) {
      expect(bad('race:finish', { ...ok, ...patch })).toBe('BAD_REQUEST');
    }
    expect(bad('race:finish', { raceId: 1, raceT: 5, dist: 5 })).toBe('BAD_REQUEST');
  });

  it('race:state needs every field inside its range', () => {
    const ok = stateFor(1, 10);
    expect(validate('race:state', ok)).toEqual(ok);
    const edges = { d: [-60, 60], y: [-20, 200], psi: [-20, 20], v: [-10, 150], lean: [-3, 3], pitch: [-3, 3], boost: [0, 100], s: [0, 1e6], dist: [0, 1e6], raceT: [0, 3600] };
    for (const [key, [lo, hi]] of Object.entries(edges)) {
      expect(validate('race:state', { ...ok, [key]: lo })[key]).toBe(lo);
      expect(validate('race:state', { ...ok, [key]: hi })[key]).toBe(hi);
      expect(bad('race:state', { ...ok, [key]: lo - 0.5 })).toBe('BAD_REQUEST');
      expect(bad('race:state', { ...ok, [key]: hi + 0.5 })).toBe('BAD_REQUEST');
    }
    expect(bad('race:state', { ...ok, lap: 0.5 })).toBe('BAD_REQUEST');
    expect(bad('race:state', { ...ok, crashed: 0 })).toBe('BAD_REQUEST');
    expect(bad('race:state', { ...ok, finished: 'no' })).toBe('BAD_REQUEST');
    expect(bad('race:state', { ...ok, seat: 3 })).toBe('BAD_REQUEST');
    const missing = { ...ok };
    delete missing.boost;
    expect(bad('race:state', missing)).toBe('BAD_REQUEST');
  });

  it('returns a fresh object holding only known keys', () => {
    const input = { name: 'A', bike: 'stock' };
    const out = validate('racer:update', input);
    expect(out).not.toBe(input);
    expect(Object.keys(out).sort()).toEqual(['bike', 'name']);
  });
});
