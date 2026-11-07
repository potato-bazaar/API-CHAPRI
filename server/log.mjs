// JSON-lines logger. One object per line: { t, level, msg, ...fields }.
//
// Privacy rules: seat tokens, the `look` payload and IP addresses are never written. Callers should not pass them, and
// as a second line of defence this module drops fields with those names and scrubs anything shaped like a seat token
// (32 hex characters) or an IPv4 address from the finished line.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const DROP_KEYS = new Set(['token', 'look', 'ip', 'ips', 'address', 'remoteaddress', 'headers', 'x-forwarded-for', 'forwarded', 'origin', 'host', 'email']);
const TOKEN_RE = /\b[0-9a-f]{32}\b/gi;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_MAPPED_RE = /::ffff:[0-9.]+/gi;

function serializeError(err, withStack) {
  const out = { name: err.name, message: String(err.message) };
  if (err.code !== undefined) out.code = err.code;
  if (withStack && err.stack) out.stack = String(err.stack);
  return out;
}

function clean(value, depth, withStack) {
  if (value instanceof Error) return serializeError(value, withStack);
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    return value;
  }
  if (depth > 4) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => clean(v, depth + 1, withStack));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (DROP_KEYS.has(k.toLowerCase())) continue;
    const c = clean(v, depth + 1, withStack);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

export function scrub(line) {
  return line.replace(TOKEN_RE, '[redacted]').replace(IPV6_MAPPED_RE, '[ip]').replace(IPV4_RE, '[ip]');
}

// options: { level = 'info', quiet = false, write(line) } - `write` defaults to stdout; tests pass their own to inspect
// what would have been printed. `quiet` turns everything off.
export function createLogger({ level = 'info', quiet = false, write } = {}) {
  const min = quiet ? LEVELS.silent : (LEVELS[level] ?? LEVELS.info);
  const sink = write || ((line) => { process.stdout.write(line + '\n'); });
  function emit(lvl, msg, fields) {
    if (LEVELS[lvl] < min) return;
    const record = { t: new Date().toISOString(), level: lvl, msg: String(msg) };
    if (fields && typeof fields === 'object') {
      const extra = clean(fields, 0, LEVELS[lvl] >= LEVELS.warn);
      for (const [k, v] of Object.entries(extra)) if (!Object.hasOwn(record, k)) record[k] = v;
    }
    let line;
    try {
      line = JSON.stringify(record);
    } catch {
      line = JSON.stringify({ t: record.t, level: lvl, msg: String(msg), note: 'fields could not be serialized' });
    }
    try {
      sink(scrub(line));
    } catch {
      // A broken log sink (closed stdout, for example) must never take the server down.
    }
  }
  return {
    level: quiet ? 'silent' : level,
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
  };
}
