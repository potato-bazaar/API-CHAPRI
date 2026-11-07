// Protocol constants and validators (server/PROTOCOL.md is the human-readable copy). Every payload that arrives from a
// client passes through validate() before any room or race code sees it. Validation is strict: the payload must be a
// plain object, unknown keys and wrong types are rejected with BAD_REQUEST, and the result is a fresh object that holds
// only the known keys, so nothing a client sends is ever stored or relayed by reference.
export const PIN_RE = /^[0-9]{4}$/;
export const TOKEN_RE = /^[0-9a-f]{32}$/;

export const SEATS = 8;
export const MIN_RACERS = 2;
export const NAME_MAX = 16;
export const DEFAULT_NAME = 'Rider';
export const DEFAULT_BIKE = 'stock';
export const LOOK_MAX_BYTES = 2048;

export const BIKES = Object.freeze(['stock', 'kaali', 'chrome', 'sticker', 'cafe', 'neon', 'drag', 'raja']);
export const TRACKS = Object.freeze(['random', 'mumbai-central', 'dharavi-lanes', 'mumbai-underground', 'sion-flyover', 'crawford-market', 'bandstand-rush']);
// The tracks `random` resolves to, in a fixed order, so the same seed always gives the same track.
export const RACE_TRACKS = Object.freeze(TRACKS.filter((t) => t !== 'random'));
export const LAPS = Object.freeze([1, 3, 5]);
export const TIMES = Object.freeze(['morning', 'golden', 'night']);
export const WEATHERS = Object.freeze(['clear', 'monsoon']);

export const DEFAULT_SETTINGS = Object.freeze({ track: 'mumbai-central', laps: 3, time: 'morning', weather: 'clear' });

export const PHASES = Object.freeze(['lobby', 'countdown', 'racing']);
export const COUNTDOWN_MS = 3400;

export const ERROR_CODES = Object.freeze([
  'BAD_REQUEST', 'NOT_FOUND', 'FULL', 'RACING', 'LOCKED_OUT', 'NOT_HOST', 'NOT_ENOUGH_RACERS', 'RACE_IN_PROGRESS',
  'ALREADY_IN_ROOM', 'NOT_IN_ROOM', 'EXPIRED', 'RATE_LIMITED', 'SERVER_BUSY', 'SUPERSEDED', 'ORIGIN_DENIED',
]);

// Requests carry an ack callback. race:state is fire and forget.
export const REQUEST_EVENTS = Object.freeze([
  'room:create', 'room:join', 'session:resume', 'room:leave', 'room:settings', 'racer:update', 'race:start',
  'race:finish', 'clock:ping',
]);
export const STATE_EVENT = 'race:state';

export class ProtocolError extends Error {
  constructor(code, message, retryAfterSec) {
    super(message || code);
    this.name = 'ProtocolError';
    this.code = code;
    if (retryAfterSec !== undefined) this.retryAfterSec = retryAfterSec;
  }

  toAck() {
    const ack = { ok: false, code: this.code, message: this.message };
    if (this.retryAfterSec !== undefined) ack.retryAfterSec = this.retryAfterSec;
    return ack;
  }
}

const bad = (message) => new ProtocolError('BAD_REQUEST', message);

export function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// Control characters (C0, DEL, C1), line and paragraph separators, and the bidirectional overrides that could make a
// name render as something else in other players' lobbies.
const STRIP_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069\u200e\u200f\u061c\ufeff]/g;

// Name rules from the spec: trimmed, control characters removed, 1 to 16 characters, default `Rider`. Characters are
// counted as code points, so an emoji is never cut in half.
export function sanitizeName(value) {
  if (typeof value !== 'string') throw bad('name must be a string');
  let s = value.normalize('NFC').replace(STRIP_RE, '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(s);
  if (chars.length > NAME_MAX) s = chars.slice(0, NAME_MAX).join('').trim();
  return s || DEFAULT_NAME;
}

export function sanitizeBike(value) {
  if (typeof value !== 'string') throw bad('bike must be a string');
  if (!BIKES.includes(value)) throw bad(`bike must be one of ${BIKES.join(' ')}`);
  return value;
}

// `look` is opaque to the server. It must be a plain object of at most 2 KB as JSON. The stored copy is rebuilt from
// JSON, which leaves only plain data (no prototypes, no shared references with the incoming packet).
export function sanitizeLook(value, maxBytes = LOOK_MAX_BYTES) {
  if (!isPlainObject(value)) throw bad('look must be a plain object');
  let json;
  try {
    json = JSON.stringify(value);
  } catch {
    throw bad('look must be plain JSON data');
  }
  if (Buffer.byteLength(json, 'utf8') > maxBytes) throw bad(`look is larger than ${maxBytes} bytes as JSON`);
  return JSON.parse(json);
}

const field = {
  pin: (v) => {
    if (typeof v !== 'string' || !PIN_RE.test(v)) throw bad('pin must be a string of 4 digits');
    return v;
  },
  token: (v) => {
    if (typeof v !== 'string' || !TOKEN_RE.test(v)) throw bad('token must be 32 lowercase hex characters');
    return v;
  },
  name: sanitizeName,
  bike: sanitizeBike,
  oneOf: (list, label) => (v) => {
    if (!list.includes(v)) throw bad(`${label} must be one of ${list.join(' ')}`);
    return v;
  },
  number: (label, min, max) => (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw bad(`${label} must be a number from ${min} to ${max}`);
    return v;
  },
  integer: (label, min, max) => (v) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad(`${label} must be an integer from ${min} to ${max}`);
    return v;
  },
  bool: (label) => (v) => {
    if (typeof v !== 'boolean') throw bad(`${label} must be true or false`);
    return v;
  },
};

const raceId = field.integer('raceId', 1, Number.MAX_SAFE_INTEGER);
const raceT = field.number('raceT', 0, 3600);
const dist = field.number('dist', 0, 1e6);
const lap = field.integer('lap', -1, 200);

// Schema: key -> [required, check]. `look` is checked with the configured size limit, so it is marked with a string.
const SCHEMAS = {
  'room:create': { name: [false, field.name], bike: [false, field.bike], look: [false, 'look'] },
  'room:join': { pin: [true, field.pin], name: [false, field.name], bike: [false, field.bike], look: [false, 'look'] },
  'session:resume': { token: [true, field.token] },
  'room:leave': {},
  'room:settings': {
    track: [false, field.oneOf(TRACKS, 'track')],
    laps: [false, field.oneOf(LAPS, 'laps')],
    time: [false, field.oneOf(TIMES, 'time')],
    weather: [false, field.oneOf(WEATHERS, 'weather')],
  },
  'racer:update': { name: [false, field.name], bike: [false, field.bike], look: [false, 'look'] },
  'race:start': {},
  'race:finish': { raceId: [true, raceId], raceT: [true, raceT], dist: [true, dist], lap: [true, lap] },
  'clock:ping': {},
  'race:state': {
    raceId: [true, raceId],
    raceT: [true, raceT],
    dist: [true, dist],
    s: [true, field.number('s', 0, 1e6)],
    d: [true, field.number('d', -60, 60)],
    y: [true, field.number('y', -20, 200)],
    psi: [true, field.number('psi', -20, 20)],
    v: [true, field.number('v', -10, 150)],
    lean: [true, field.number('lean', -3, 3)],
    pitch: [true, field.number('pitch', -3, 3)],
    lap: [true, lap],
    boost: [true, field.number('boost', 0, 100)],
    crashed: [true, field.bool('crashed')],
    finished: [true, field.bool('finished')],
  },
};

export const KNOWN_EVENTS = Object.freeze(Object.keys(SCHEMAS));

// Validates one client payload. A missing payload (undefined) counts as {}. Returns a new object with only the known
// keys, sanitized. Throws ProtocolError('BAD_REQUEST') on anything else.
export function validate(event, payload, { lookMaxBytes = LOOK_MAX_BYTES } = {}) {
  const schema = SCHEMAS[event];
  if (!schema) throw bad(`unknown event ${String(event).slice(0, 40)}`);
  const input = payload === undefined ? {} : payload;
  if (!isPlainObject(input)) throw bad(`${event} payload must be an object`);
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(schema, key)) throw bad(`${event}: unknown key ${JSON.stringify(key.slice(0, 40))}`);
  }
  const out = {};
  for (const [key, [required, check]] of Object.entries(schema)) {
    if (!Object.hasOwn(input, key) || input[key] === undefined) {
      if (required) throw bad(`${event}: ${key} is required`);
      continue;
    }
    out[key] = check === 'look' ? sanitizeLook(input[key], lookMaxBytes) : check(input[key]);
  }
  return out;
}
