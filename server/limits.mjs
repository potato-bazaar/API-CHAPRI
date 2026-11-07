// Rate limits, connection caps and PIN-guessing lockouts. Everything takes `now` from the caller (or an injected clock),
// so the unit tests can run it on a fake clock.
//
// This is the only place where client IP addresses are kept, and only in memory: as keys of the per-IP connection
// count (while a connection is open) and of the PIN failure records (until they expire, at most the lockout time after
// the last failed PIN). The per-address room budget (rooms.mjs) sees only a keyed hash of the address key.

// Classic token bucket: `capacity` tokens, refilled continuously at `refillPerSec`.
export class TokenBucket {
  constructor(capacity, refillPerSec, now) {
    this.capacity = capacity;
    this.refillPerMs = refillPerSec / 1000;
    this.tokens = capacity;
    this.at = now;
  }

  refill(now) {
    if (now > this.at) {
      this.tokens = Math.min(this.capacity, this.tokens + (now - this.at) * this.refillPerMs);
      this.at = now;
    }
  }

  take(now, n = 1) {
    this.refill(now);
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  // Milliseconds until one token is available.
  retryAfterMs(now) {
    this.refill(now);
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillPerMs);
  }
}

// At most `limit` events in any window of `windowMs` (half-open: (now - windowMs, now]). Exact: it keeps the times of
// the last `limit` accepted events in a ring, so the oldest of them says both whether one more fits and, if not, how
// long until it does. Unlike a token bucket, a full burst cannot be followed by a refill inside the same window, so
// "60 per 10 s" never lets 119 through.
export class SlidingWindow {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.times = new Array(limit).fill(-Infinity);
    this.next = 0; // index of the oldest kept time, and of the slot the next accepted event overwrites
    this.newest = -Infinity;
  }

  // The wall clock can step backwards (NTP). Times "from the future" would then refuse everything until the clock
  // caught up, so they are forgotten instead.
  rewind(now) {
    if (now < this.newest) {
      this.times.fill(-Infinity);
      this.newest = -Infinity;
    }
  }

  allowed(now) {
    this.rewind(now);
    return now - this.times[this.next] >= this.windowMs;
  }

  record(now) {
    this.times[this.next] = now;
    this.next = (this.next + 1) % this.limit;
    if (now > this.newest) this.newest = now;
  }

  take(now) {
    if (!this.allowed(now)) return false;
    this.record(now);
    return true;
  }

  // Milliseconds until one more event fits: when the oldest of the last `limit` leaves the window.
  retryAfterMs(now) {
    this.rewind(now);
    return Math.max(0, this.times[this.next] + this.windowMs - now);
  }

  // True when nothing accepted is inside the window any more (the record can be dropped).
  idle(now) {
    return now - this.newest >= this.windowMs || now < this.newest;
  }
}

// Counts events in a sliding window, at a resolution of windowMs / slots. Used for the "more than N messages in 10 s"
// flood rule, where a cheap approximate count is enough (it only decides when to cut off a socket that floods).
export class WindowCounter {
  constructor(windowMs, slots = 10) {
    this.slotMs = Math.max(1, Math.floor(windowMs / slots));
    this.slots = slots;
    this.counts = new Array(slots).fill(0);
    this.slotAt = new Array(slots).fill(-1);
  }

  add(now, n = 1) {
    const slot = Math.floor(now / this.slotMs);
    const i = slot % this.slots;
    if (this.slotAt[i] !== slot) {
      this.slotAt[i] = slot;
      this.counts[i] = 0;
    }
    this.counts[i] += n;
    return this.count(now);
  }

  count(now) {
    const slot = Math.floor(now / this.slotMs);
    let total = 0;
    for (let i = 0; i < this.slots; i++) if (this.slotAt[i] > slot - this.slots) total += this.counts[i];
    return total;
  }
}

export function retryAfterSec(ms) {
  return Math.max(1, Math.ceil(ms / 1000));
}

// Per-socket limits (spec A10): at most 60 requests in any 10 s, at most 20 race:state in any 1 s, and a flood ceiling
// of 300 messages of any kind per 10 s, above which the socket is disconnected.
export function createSocketLimiter(limits) {
  const requests = new SlidingWindow(limits.requestBurst, limits.requestWindowMs);
  const states = new SlidingWindow(limits.statesPerSecond, 1000);
  const flood = new WindowCounter(limits.floodWindowMs, 10);
  return {
    // Every incoming message. Returns false when the socket has gone over the flood ceiling.
    message(t) {
      return flood.add(t) <= limits.floodMessages;
    },
    request(t) {
      if (requests.take(t)) return { ok: true };
      return { ok: false, retryAfterSec: retryAfterSec(requests.retryAfterMs(t)) };
    },
    state(t) {
      return states.take(t);
    },
  };
}

// PIN guessing guard (spec A9). Failed joins are recorded under several keys at once (one per IP, one per socket);
// `limit` failures inside `windowMs` under any key locks that key for `lockoutMs`.
export function createPinGuard({ limit, windowMs, lockoutMs }) {
  const entries = new Map(); // key -> { fails: number[], lockedUntil: number }

  function entry(key) {
    let e = entries.get(key);
    if (!e) {
      e = { fails: [], lockedUntil: 0 };
      entries.set(key, e);
    }
    return e;
  }

  function prune(e, now) {
    while (e.fails.length && e.fails[0] <= now - windowMs) e.fails.shift();
  }

  return {
    // Returns 0 when every key may try, or the number of seconds until the longest lockout among them ends.
    lockedFor(keys, now) {
      let until = 0;
      for (const key of keys) {
        const e = entries.get(key);
        if (!e) continue;
        if (e.lockedUntil > now) until = Math.max(until, e.lockedUntil);
        else if (e.lockedUntil) {
          // The lockout is over: start counting again from zero.
          e.lockedUntil = 0;
          e.fails.length = 0;
        }
      }
      return until > now ? Math.max(1, Math.ceil((until - now) / 1000)) : 0;
    },

    // Records one failed join under every key. Returns true if any key is now locked.
    fail(keys, now) {
      let locked = false;
      for (const key of keys) {
        const e = entry(key);
        if (e.lockedUntil > now) {
          locked = true;
          continue;
        }
        prune(e, now);
        e.fails.push(now);
        if (e.fails.length >= limit) {
          e.lockedUntil = now + lockoutMs;
          e.fails.length = 0;
          locked = true;
        }
      }
      return locked;
    },

    forget(key) {
      entries.delete(key);
    },

    // Drops records that no longer matter: no lockout running and no failure inside the window.
    sweep(now) {
      for (const [key, e] of entries) {
        if (e.lockedUntil > now) continue;
        prune(e, now);
        if (!e.fails.length) entries.delete(key);
        else e.lockedUntil = 0;
      }
    },

    size() {
      return entries.size;
    },
  };
}

// Open connections, in total and per address key.
export function createConnectionCounter() {
  const perKey = new Map();
  let total = 0;
  return {
    count(key) {
      return perKey.get(key) || 0;
    },
    get total() {
      return total;
    },
    add(key) {
      perKey.set(key, (perKey.get(key) || 0) + 1);
      total++;
    },
    remove(key) {
      const n = (perKey.get(key) || 0) - 1;
      if (n > 0) perKey.set(key, n);
      else perKey.delete(key);
      total = Math.max(0, total - 1);
    },
    keys() {
      return perKey.size;
    },
  };
}

// Expands an IPv6 address into 8 groups. Returns null if it does not parse.
function ipv6Groups(text) {
  let s = text;
  let tail = [];
  const v4 = s.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const p = v4[1].split('.').map(Number);
    if (p.some((n) => n > 255)) return null;
    tail = [((p[0] << 8) | p[1]).toString(16), ((p[2] << 8) | p[3]).toString(16)];
    s = s.slice(0, -v4[1].length) + '0:0';
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups;
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length;
    if (fill < 0) return null;
    groups = [...head, ...new Array(fill).fill('0'), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  if (tail.length) groups.splice(6, 2, ...tail);
  return groups.map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''));
}

// Dotted IPv4 in canonical form ('010.0.0.1' and '10.0.0.1' are one key). Null if it does not parse.
function ipv4Canonical(text) {
  const m = text.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return parts.join('.');
}

// Every address that does not parse shares this one key, so odd values cannot be varied to get fresh limits.
export const INVALID_ADDRESS_KEY = 'invalid';

// The key under which an address is counted. IPv4 (and IPv4-mapped IPv6) counts per address. Plain IPv6 counts per
// /64 network, because one subscriber usually holds a whole /64 and could otherwise rotate addresses for free.
// A port is ignored ('203.0.113.5:51234', '[2001:db8::1]:443'): some proxies put it in X-Forwarded-For, and every new
// connection has a new source port. Anything else that is not an IP address is INVALID_ADDRESS_KEY.
export function addressKey(address) {
  if (address === undefined || address === null || address === '') return 'unknown';
  if (typeof address !== 'string') return INVALID_ADDRESS_KEY;
  let a = address.trim().toLowerCase();
  if (!a) return 'unknown';
  const bracketed = a.match(/^\[([^\]]*)\](?::\d{1,5})?$/);
  if (bracketed) {
    a = bracketed[1];
  } else {
    const v4port = a.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/);
    if (v4port) a = v4port[1];
  }
  const zone = a.indexOf('%');
  if (zone >= 0) a = a.slice(0, zone);
  const v4 = ipv4Canonical(a);
  if (v4) return v4;
  // Bracketed text must be IPv6; a bare value with a colon may be IPv6 (an unbracketed 'v6:port' parses as IPv6 too,
  // and the port then lands in the host half, which the /64 key drops anyway).
  if (a.includes(':')) {
    const g = ipv6Groups(a);
    if (g) {
      // IPv4-mapped (::ffff:a.b.c.d, in dotted or hex form) is that IPv4 address.
      if (g.slice(0, 5).every((x) => x === '0') && g[5] === 'ffff') {
        const hi = parseInt(g[6], 16);
        const lo = parseInt(g[7], 16);
        return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
      }
      return g.slice(0, 4).join(':') + '::/64';
    }
  }
  return INVALID_ADDRESS_KEY;
}

// The client address for a request. With trustProxy, the first (left-most) entry of X-Forwarded-For is the client, as
// the spec says; the proxy in front must overwrite that header rather than append to a client-supplied one.
export function clientAddress(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const first = String(Array.isArray(xff) ? xff[0] : (xff || '')).split(',')[0].trim();
    if (first) return first;
  }
  return (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || '';
}
