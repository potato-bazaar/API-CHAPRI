import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_FILE, DEFAULT_LIMITS, DEFAULT_TIMERS, loadConfig, resolveOptions, resolveTuning } from '../../server/config.mjs';
import { createLogger, scrub } from '../../server/log.mjs';
import { createServer } from '../../server/index.mjs';

const ENV_TIMER_KEYS = {
  RECONNECT_GRACE_MS: 'reconnectGraceMs', EMPTY_ROOM_MS: 'emptyRoomMs', IDLE_ROOM_MS: 'idleRoomMs',
  FINISH_TIMEOUT_MS: 'finishTimeoutMs', GO_DELAY_MS: 'goDelayMs',
};

describe('defaults', () => {
  it('match the spec limits and timers', () => {
    expect(DEFAULT_LIMITS).toMatchObject({
      seats: 8, minRacers: 2, maxRooms: 1000, maxSockets: 1000, maxSocketsPerIp: 20, maxMessageBytes: 102400,
      requestBurst: 60, requestWindowMs: 10000, statesPerSecond: 20, floodMessages: 300, floodWindowMs: 10000,
      pinFailureLimit: 20, pinFailureWindowMs: 600000, pinLockoutMs: 1800000, lookMaxBytes: 2048,
    });
    expect(DEFAULT_TIMERS).toMatchObject({
      reconnectGraceMs: 60000, emptyRoomMs: 60000, idleRoomMs: 1800000, finishTimeoutMs: 120000, goDelayMs: 5000,
    });
  });

  it('createServer options default to port 8080 on all interfaces and the built page', () => {
    const o = resolveOptions({});
    expect(o).toMatchObject({ port: 8080, host: '0.0.0.0', gameFile: DEFAULT_GAME_FILE, allowedOrigins: [], trustProxy: false, quiet: false });
    expect(DEFAULT_GAME_FILE.endsWith(path.join('dist', 'chapri-racer.html'))).toBe(true);
  });
});

describe('resolveTuning', () => {
  it('routes keys to their group from either option object, by name or env name', () => {
    const { limits, timers } = resolveTuning({ goDelayMs: 100, MAX_ROOMS: 5 }, { PIN_FAILURE_LIMIT: 3, reconnectGraceMs: 200 });
    expect(timers.goDelayMs).toBe(100);
    expect(timers.reconnectGraceMs).toBe(200);
    expect(limits.maxRooms).toBe(5);
    expect(limits.pinFailureLimit).toBe(3);
  });

  it('throws on unknown keys and bad values', () => {
    expect(() => resolveTuning({ goDelay: 1 })).toThrow(/unknown limits option "goDelay"/);
    expect(() => resolveTuning({}, { goDelayMs: -1 })).toThrow(/integer/);
    expect(() => resolveTuning({ seats: 9 })).toThrow(/seats/);
    expect(() => resolveTuning({ maxRooms: 0 })).toThrow(/maxRooms/);
    expect(() => resolveTuning({ maxRooms: '5' })).toThrow(/integer/);
  });
});

describe('loadConfig', () => {
  it('reads every documented variable', () => {
    const o = loadConfig({
      PORT: '9000', HOST: '127.0.0.1', ALLOWED_ORIGINS: 'https://a.example, https://b.example:8443/', TRUST_PROXY: '1',
      LOG_LEVEL: 'warn', GAME_FILE: 'x/page.html', MAX_SOCKETS: '10', MAX_SOCKETS_PER_IP: '2', MAX_ROOMS: '3',
      PIN_FAILURE_LIMIT: '4', PIN_FAILURE_WINDOW_MS: '5000', PIN_LOCKOUT_MS: '6000', RECONNECT_GRACE_MS: '7000',
      EMPTY_ROOM_MS: '8000', IDLE_ROOM_MS: '9000', FINISH_TIMEOUT_MS: '10000', GO_DELAY_MS: '11000',
    }, '/srv/app');
    expect(o).toMatchObject({
      port: 9000, host: '127.0.0.1', allowedOrigins: ['https://a.example', 'https://b.example:8443'], trustProxy: true,
      logLevel: 'warn', gameFile: path.resolve('/srv/app', 'x/page.html'),
      limits: { maxSockets: 10, maxSocketsPerIp: 2, maxRooms: 3, pinFailureLimit: 4, pinFailureWindowMs: 5000, pinLockoutMs: 6000 },
      timers: { reconnectGraceMs: 7000, emptyRoomMs: 8000, idleRoomMs: 9000, finishTimeoutMs: 10000, goDelayMs: 11000 },
    });
    // The result is valid input for createServer.
    expect(resolveOptions(o).limits.maxRooms).toBe(3);
  });

  it('treats unset and empty variables as defaults', () => {
    const o = resolveOptions(loadConfig({ PORT: '', TRUST_PROXY: '' }));
    expect(o.port).toBe(8080);
    expect(o.trustProxy).toBe(false);
    expect(o.limits).toEqual(DEFAULT_LIMITS);
    expect(o.timers).toEqual(DEFAULT_TIMERS);
  });

  it('refuses a timer above 2147483647 ms, which Node would run after 1 ms (finding 6)', async () => {
    for (const name of ['RECONNECT_GRACE_MS', 'EMPTY_ROOM_MS', 'IDLE_ROOM_MS', 'FINISH_TIMEOUT_MS', 'GO_DELAY_MS']) {
      expect(() => loadConfig({ [name]: '3000000000' }), name).toThrow(TypeError);
      expect(() => loadConfig({ [name]: '2147483648' }), name).toThrow(new RegExp(`^${name} must be an integer from 0 to 2147483647`));
      expect(loadConfig({ [name]: '2147483647' }).timers).toMatchObject({ [ENV_TIMER_KEYS[name]]: 2147483647 });
    }
    for (const key of Object.keys(DEFAULT_TIMERS)) {
      expect(() => resolveTuning({}, { [key]: 2147483648 }), key).toThrow(/2147483647/);
      expect(resolveTuning({}, { [key]: 2147483647 }).timers[key]).toBe(2147483647);
    }
    // A timer given in the `limits` object, or by its environment name, is still a timer.
    expect(() => resolveTuning({ maxRaceMs: 3e9 })).toThrow(/maxRaceMs/);
    expect(() => resolveTuning({}, { GO_DELAY_MS: 3e9 })).toThrow(/GO_DELAY_MS/);
    // createServer({ timers }) refuses it before it opens a port.
    await expect(createServer({ port: 0, quiet: true, timers: { reconnectGraceMs: 3e9 } })).rejects.toThrow(/2147483647/);
    // Limits that are never handed to a timer keep their wide range.
    expect(resolveTuning({ pinLockoutMs: 3e9 }).limits.pinLockoutMs).toBe(3e9);
  });

  it('refuses malformed values with a readable message', () => {
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadConfig({ TRUST_PROXY: 'maybe' })).toThrow(/TRUST_PROXY/);
    expect(() => loadConfig({ LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
    expect(() => loadConfig({ ALLOWED_ORIGINS: 'ftp://x.example' })).toThrow(/http/);
    expect(() => loadConfig({ ALLOWED_ORIGINS: 'not a url' })).toThrow(/origin/);
    expect(() => loadConfig({ MAX_ROOMS: '-3' })).toThrow(/MAX_ROOMS/);
    expect(() => loadConfig({ GO_DELAY_MS: '1.5' })).toThrow(/GO_DELAY_MS/);
  });
});

describe('logger', () => {
  function capture(level = 'debug') {
    const lines = [];
    const log = createLogger({ level, write: (l) => lines.push(l) });
    return { log, lines, records: () => lines.map((l) => JSON.parse(l)) };
  }

  it('writes one JSON object per line with t, level and msg', () => {
    const { log, records } = capture();
    log.info('room created', { pin: '1234', sid: 'abc' });
    const [r] = records();
    expect(r).toMatchObject({ level: 'info', msg: 'room created', pin: '1234', sid: 'abc' });
    expect(new Date(r.t).toString()).not.toBe('Invalid Date');
  });

  it('drops token, look and address fields and scrubs token- and IP-shaped text', () => {
    const { log, lines } = capture();
    const token = 'ab'.repeat(16);
    log.info('x', { token, look: { secret: 1 }, ip: '203.0.113.9', address: '::ffff:203.0.113.9', headers: { cookie: 'c' }, nested: { token } });
    log.error('failed', { err: new Error(`bad token ${token} from 198.51.100.7`) });
    const text = lines.join('\n');
    expect(text).not.toContain(token);
    expect(text).not.toContain('203.0.113.9');
    expect(text).not.toContain('198.51.100.7');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('cookie');
    expect(scrub(`a ${token} b 10.0.0.1 c`)).toBe('a [redacted] b [ip] c');
  });

  it('respects the level and quiet', () => {
    const { log, lines } = capture('warn');
    log.info('no');
    log.warn('yes');
    expect(lines).toHaveLength(1);
    const quiet = [];
    createLogger({ quiet: true, write: (l) => quiet.push(l) }).error('nothing');
    expect(quiet).toHaveLength(0);
  });

  it('never throws, even with a broken sink or odd fields', () => {
    const log = createLogger({ write: () => { throw new Error('closed'); } });
    expect(() => log.info('x', { big: 10n, fn: () => 1 })).not.toThrow();
    const circular = {};
    circular.self = circular;
    const lines = [];
    expect(() => createLogger({ write: (l) => lines.push(l) }).info('c', { circular })).not.toThrow();
    expect(lines).toHaveLength(1);
  });
});
