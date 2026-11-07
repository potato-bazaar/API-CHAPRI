// Settings for the room server: defaults, environment parsing and test overrides. Nothing here has side effects, so
// createServer() and the unit tests can build configurations without touching process.env.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_GAME_FILE = path.join(ROOT, 'dist', 'chapri-racer.html');

export const DEFAULT_LIMITS = Object.freeze({
  seats: 8,
  minRacers: 2,
  maxRooms: 1000,
  maxSockets: 1000,
  maxSocketsPerIp: 20,
  maxMessageBytes: 100 * 1024,
  lookMaxBytes: 2048,
  requestBurst: 60,
  requestWindowMs: 10000,
  statesPerSecond: 20,
  floodMessages: 300,
  floodWindowMs: 10000,
  pinFailureLimit: 20,
  pinFailureWindowMs: 600000,
  pinLockoutMs: 1800000,
  // Room creation per client address (IPv4 address or IPv6 /64): rooms that still have someone in them, and creates
  // in a sliding window. Both answer RATE_LIMITED. Empty rooms count for neither, nor for maxRooms.
  maxRoomsPerIp: 5,
  roomCreatesPerIp: 10,
  roomCreateWindowMs: 600000,
  // session:resume calls that move a seat to another socket (a reconnect or a takeover), per seat.
  resumesPerSeat: 5,
  resumeWindowMs: 60000,
  // Outgoing backlog per socket (packets queued by engine.io, plus bytes waiting in a websocket). race:state is not
  // queued for a socket with backlogSkipPackets or more; a socket over backlogMaxPackets or backlogMaxBytes for
  // timers.backlogGraceMs is disconnected, since it is not reading what it is sent.
  backlogSkipPackets: 64,
  backlogMaxPackets: 512,
  backlogMaxBytes: 1048576,
});

// setTimeout and setInterval take at most 2^31 - 1 ms (about 24.8 days). Node turns a longer delay into 1 ms, so a
// longer timer would fire at once instead of late.
export const MAX_TIMER_MS = 2147483647;

export const DEFAULT_TIMERS = Object.freeze({
  reconnectGraceMs: 60000,
  emptyRoomMs: 60000,
  idleRoomMs: 1800000,
  finishTimeoutMs: 120000,
  goDelayMs: 5000,
  // raceT is capped at 3600 s by the protocol, so a race that is still running a minute after that can only be stuck
  // (every client frozen but still connected). It ends as a timeout instead of holding the room forever.
  maxRaceMs: 3660000,
  // How often expired PIN-failure records and retired tokens are dropped from memory. Short, so an address is not kept
  // much past the end of its lockout.
  sweepMs: 15000,
  // The other racers hear `disconnected` only if the seat is still away this long after it dropped (a reload or a
  // short network drop is back sooner, and then they hear neither `disconnected` nor `reconnected`).
  disconnectNoticeMs: 3000,
  // How long a socket's outgoing backlog may stay over the hard cap (see the backlog limits) before it is dropped.
  backlogGraceMs: 5000,
});

// Environment variable name -> [group, key]. The same names are accepted inside the `limits` and `timers` options, so
// a test can write either { goDelayMs: 300 } or { GO_DELAY_MS: 300 }.
const ENV_NUMBERS = {
  MAX_SOCKETS: ['limits', 'maxSockets'],
  MAX_SOCKETS_PER_IP: ['limits', 'maxSocketsPerIp'],
  MAX_ROOMS: ['limits', 'maxRooms'],
  MAX_ROOMS_PER_IP: ['limits', 'maxRoomsPerIp'],
  ROOM_CREATES_PER_IP: ['limits', 'roomCreatesPerIp'],
  PIN_FAILURE_LIMIT: ['limits', 'pinFailureLimit'],
  PIN_FAILURE_WINDOW_MS: ['limits', 'pinFailureWindowMs'],
  PIN_LOCKOUT_MS: ['limits', 'pinLockoutMs'],
  RECONNECT_GRACE_MS: ['timers', 'reconnectGraceMs'],
  EMPTY_ROOM_MS: ['timers', 'emptyRoomMs'],
  IDLE_ROOM_MS: ['timers', 'idleRoomMs'],
  FINISH_TIMEOUT_MS: ['timers', 'finishTimeoutMs'],
  GO_DELAY_MS: ['timers', 'goDelayMs'],
};

const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'];

function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function checkNumber(name, value, { min = 0, max = Number.MAX_SAFE_INTEGER, why = '' } = {}) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(`${name} must be an integer from ${min} to ${max}${why}, got ${JSON.stringify(value)}`);
  }
  return value;
}

// Every timer value ends up in setTimeout or setInterval.
const TIMER_RANGE = Object.freeze({ min: 0, max: MAX_TIMER_MS, why: ' (the longest timer Node.js supports, about 24.8 days)' });

function rangeFor(group) {
  return group === 'timers' ? TIMER_RANGE : {};
}

// Merges `limits` and `timers` overrides onto the defaults. A key may be given in either object (or by its environment
// variable name); it lands in its home group. Unknown keys throw, so a mistyped override in a test fails loudly instead
// of being ignored.
export function resolveTuning(limitsOverride = {}, timersOverride = {}) {
  const limits = { ...DEFAULT_LIMITS };
  const timers = { ...DEFAULT_TIMERS };
  for (const [label, src] of [['limits', limitsOverride], ['timers', timersOverride]]) {
    if (src == null) continue;
    if (!isPlainObject(src)) throw new TypeError(`${label} must be a plain object`);
    for (const [rawKey, value] of Object.entries(src)) {
      if (value === undefined) continue;
      let group = null;
      let key = rawKey;
      if (Object.hasOwn(ENV_NUMBERS, rawKey)) [group, key] = ENV_NUMBERS[rawKey];
      else if (Object.hasOwn(DEFAULT_LIMITS, rawKey)) group = 'limits';
      else if (Object.hasOwn(DEFAULT_TIMERS, rawKey)) group = 'timers';
      if (!group) {
        const known = [...Object.keys(DEFAULT_LIMITS), ...Object.keys(DEFAULT_TIMERS)].join(', ');
        throw new TypeError(`unknown ${label} option "${rawKey}". Known options: ${known}`);
      }
      const target = group === 'limits' ? limits : timers;
      target[key] = checkNumber(`${label}.${rawKey}`, value, rangeFor(group));
    }
  }
  if (limits.seats < 1 || limits.seats > 8) throw new TypeError('limits.seats must be from 1 to 8');
  if (limits.minRacers < 1) throw new TypeError('limits.minRacers must be at least 1');
  for (const key of ['maxRooms', 'maxSockets', 'maxSocketsPerIp', 'maxMessageBytes', 'requestBurst', 'requestWindowMs',
    'statesPerSecond', 'floodMessages', 'floodWindowMs', 'pinFailureLimit', 'pinFailureWindowMs', 'lookMaxBytes',
    'maxRoomsPerIp', 'roomCreatesPerIp', 'roomCreateWindowMs', 'resumesPerSeat', 'resumeWindowMs',
    'backlogSkipPackets', 'backlogMaxPackets', 'backlogMaxBytes']) {
    if (limits[key] < 1) throw new TypeError(`limits.${key} must be at least 1`);
  }
  if (timers.sweepMs < 1) throw new TypeError('timers.sweepMs must be at least 1');
  return { limits, timers };
}

export function normalizeOrigin(value) {
  const text = String(value).trim();
  if (text === 'null') return 'null';
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new TypeError(`not a valid origin: ${JSON.stringify(text)}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError(`origin must be http or https: ${text}`);
  return url.origin.toLowerCase();
}

function envInt(env, name, range) {
  const raw = env[name];
  if (raw === undefined || String(raw).trim() === '') return undefined;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) throw new TypeError(`${name} must be a whole number, got ${JSON.stringify(raw)}`);
  return checkNumber(name, Number(text), range);
}

function envBool(env, name) {
  const raw = env[name];
  if (raw === undefined || String(raw).trim() === '') return undefined;
  const text = String(raw).trim().toLowerCase();
  if (text === '1' || text === 'true' || text === 'yes') return true;
  if (text === '0' || text === 'false' || text === 'no') return false;
  throw new TypeError(`${name} must be 0 or 1, got ${JSON.stringify(raw)}`);
}

// Reads the environment into createServer() options. Every variable is optional. Throws a TypeError with a readable
// message when a value is malformed, so the CLI can refuse to start instead of running with a surprising setting.
export function loadConfig(env = process.env, cwd = process.cwd()) {
  const options = { limits: {}, timers: {} };
  const port = envInt(env, 'PORT', { min: 0, max: 65535 });
  if (port !== undefined) options.port = port;
  if (env.HOST && String(env.HOST).trim()) options.host = String(env.HOST).trim();
  if (env.ALLOWED_ORIGINS && String(env.ALLOWED_ORIGINS).trim()) {
    options.allowedOrigins = String(env.ALLOWED_ORIGINS).split(',').map((s) => s.trim()).filter(Boolean).map(normalizeOrigin);
  }
  const trustProxy = envBool(env, 'TRUST_PROXY');
  if (trustProxy !== undefined) options.trustProxy = trustProxy;
  if (env.LOG_LEVEL && String(env.LOG_LEVEL).trim()) {
    const level = String(env.LOG_LEVEL).trim().toLowerCase();
    if (!LOG_LEVELS.includes(level)) throw new TypeError(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}`);
    options.logLevel = level;
  }
  if (env.GAME_FILE && String(env.GAME_FILE).trim()) options.gameFile = path.resolve(cwd, String(env.GAME_FILE).trim());
  for (const [name, [group, key]] of Object.entries(ENV_NUMBERS)) {
    const value = envInt(env, name, group === 'timers' ? TIMER_RANGE : { min: 0, max: Number.MAX_SAFE_INTEGER });
    if (value !== undefined) options[group][key] = value;
  }
  resolveTuning(options.limits, options.timers);
  return options;
}

// Fills in createServer() defaults and validates option types.
export function resolveOptions(options = {}) {
  if (!isPlainObject(options)) throw new TypeError('createServer options must be a plain object');
  const port = options.port === undefined ? 8080 : checkNumber('port', options.port, { min: 0, max: 65535 });
  const host = options.host === undefined ? '0.0.0.0' : String(options.host);
  const gameFile = options.gameFile === undefined ? DEFAULT_GAME_FILE : path.resolve(String(options.gameFile));
  let allowedOrigins = [];
  if (options.allowedOrigins !== undefined) {
    if (!Array.isArray(options.allowedOrigins)) throw new TypeError('allowedOrigins must be an array of origins');
    allowedOrigins = options.allowedOrigins.map(normalizeOrigin);
  }
  const logLevel = options.logLevel === undefined ? 'info' : String(options.logLevel).toLowerCase();
  if (!LOG_LEVELS.includes(logLevel)) throw new TypeError(`logLevel must be one of ${LOG_LEVELS.join(', ')}`);
  if (options.onLog !== undefined && typeof options.onLog !== 'function') throw new TypeError('onLog must be a function');
  const { limits, timers } = resolveTuning(options.limits, options.timers);
  return {
    port, host, gameFile, allowedOrigins,
    trustProxy: !!options.trustProxy,
    quiet: !!options.quiet,
    logLevel,
    onLog: options.onLog,
    limits, timers,
  };
}
