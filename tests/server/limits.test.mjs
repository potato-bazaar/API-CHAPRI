import { describe, expect, it } from 'vitest';
import {
  INVALID_ADDRESS_KEY, SlidingWindow, TokenBucket, WindowCounter, addressKey, clientAddress, createConnectionCounter,
  createPinGuard, createSocketLimiter,
} from '../../server/limits.mjs';
import { DEFAULT_LIMITS } from '../../server/config.mjs';

const T0 = 1_800_000_000_000;

// The most entries of a sorted list of times that fit in one window of `ms` (half-open).
function maxInWindow(times, ms) {
  let best = 0;
  for (let i = 0, j = 0; j < times.length; j++) {
    while (times[j] - times[i] >= ms) i++;
    best = Math.max(best, j - i + 1);
  }
  return best;
}

describe('TokenBucket', () => {
  it('allows a burst up to capacity, then refills over time', () => {
    const b = new TokenBucket(5, 1, T0);
    for (let i = 0; i < 5; i++) expect(b.take(T0)).toBe(true);
    expect(b.take(T0)).toBe(false);
    expect(b.retryAfterMs(T0)).toBe(1000);
    expect(b.take(T0 + 999)).toBe(false);
    expect(b.take(T0 + 1000)).toBe(true);
    expect(b.take(T0 + 1000)).toBe(false);
  });

  it('never holds more than its capacity', () => {
    const b = new TokenBucket(3, 10, T0);
    let n = 0;
    while (b.take(T0 + 60000)) n++;
    expect(n).toBe(3);
  });
});

describe('WindowCounter', () => {
  it('counts the last window only', () => {
    const w = new WindowCounter(10000, 10);
    for (let i = 0; i < 100; i++) w.add(T0);
    expect(w.count(T0)).toBe(100);
    expect(w.count(T0 + 5000)).toBe(100);
    expect(w.count(T0 + 10000)).toBe(0);
    w.add(T0 + 10000, 7);
    expect(w.count(T0 + 15000)).toBe(7);
  });
});

describe('SlidingWindow', () => {
  it('allows `limit` events in any window and says when the next one fits', () => {
    const w = new SlidingWindow(3, 1000);
    expect(w.take(T0)).toBe(true);
    expect(w.take(T0 + 100)).toBe(true);
    expect(w.take(T0 + 200)).toBe(true);
    expect(w.take(T0 + 300)).toBe(false);
    expect(w.retryAfterMs(T0 + 300)).toBe(700);
    expect(w.take(T0 + 999)).toBe(false);
    expect(w.take(T0 + 1000)).toBe(true);
    expect(w.take(T0 + 1000)).toBe(false);
    expect(w.retryAfterMs(T0 + 1000)).toBe(100);
    expect(w.idle(T0 + 1999)).toBe(false);
    expect(w.idle(T0 + 2000)).toBe(true);
  });

  it('forgets times from the future when the clock steps back, instead of refusing until it catches up', () => {
    const w = new SlidingWindow(2, 10000);
    w.take(T0);
    w.take(T0 + 1);
    expect(w.take(T0 + 2)).toBe(false);
    expect(w.take(T0 - 3_600_000)).toBe(true);
  });
});

describe('createSocketLimiter', () => {
  it('allows 60 requests per 10 s', () => {
    const l = createSocketLimiter(DEFAULT_LIMITS, T0);
    for (let i = 0; i < 60; i++) expect(l.request(T0).ok).toBe(true);
    const refused = l.request(T0);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfterSec).toBeGreaterThanOrEqual(1);
    // A sliding window, not a refilling bucket: nothing more until the burst is 10 s old, then a full 60 again.
    expect(refused.retryAfterSec).toBe(10);
    expect(l.request(T0 + 170).ok).toBe(false);
    expect(l.request(T0 + 9999).ok).toBe(false);
    let n = 0;
    while (l.request(T0 + 10000).ok) n++;
    expect(n).toBe(60);
  });

  it('never lets more than 60 requests through in any 10 s, however they are spaced (finding 5)', () => {
    const l = createSocketLimiter(DEFAULT_LIMITS, T0);
    const accepted = [];
    for (let t = 0; t < 30000; t += 50) if (l.request(T0 + t).ok) accepted.push(t);
    expect(accepted.filter((t) => t < 10000)).toHaveLength(60);
    expect(maxInWindow(accepted, 10000)).toBe(60);
    // retryAfterSec comes from the oldest request still in the window.
    const m = createSocketLimiter(DEFAULT_LIMITS, T0);
    for (let i = 0; i < 60; i++) m.request(T0 + i * 100);
    expect(m.request(T0 + 6000)).toEqual({ ok: false, retryAfterSec: 4 });
    expect(m.request(T0 + 10000).ok).toBe(true);
    expect(m.request(T0 + 10000).ok).toBe(false);
    expect(m.request(T0 + 10100).ok).toBe(true);
  });

  it('never lets more than 20 race:state through in any 1 s (finding 5)', () => {
    const l = createSocketLimiter(DEFAULT_LIMITS, T0);
    const accepted = [];
    for (let t = 0; t < 5000; t += 5) if (l.state(T0 + t)) accepted.push(t);
    expect(accepted.filter((t) => t < 1000)).toHaveLength(20);
    expect(maxInWindow(accepted, 1000)).toBe(20);
    // Idle for a second, then a second of flooding, again and again: still 20 in every second.
    const m = createSocketLimiter(DEFAULT_LIMITS, T0);
    const bursts = [];
    for (let s = 0; s < 4; s++) {
      let n = 0;
      for (let t = 0; t < 1000; t += 5) if (m.state(T0 + (2 * s + 1) * 1000 + t)) n++;
      bursts.push(n);
    }
    expect(bursts).toEqual([20, 20, 20, 20]);
  });

  it('caps race:state at 20 per second', () => {
    const l = createSocketLimiter(DEFAULT_LIMITS, T0);
    let ok = 0;
    for (let i = 0; i < 50; i++) if (l.state(T0)) ok++;
    expect(ok).toBe(20);
    // 15 per second (the client rate) never hits the cap.
    let dropped = 0;
    for (let i = 0; i < 15 * 30; i++) if (!l.state(T0 + 1000 + i * (1000 / 15))) dropped++;
    expect(dropped).toBe(0);
  });

  it('flags more than 300 messages in 10 s', () => {
    const l = createSocketLimiter(DEFAULT_LIMITS, T0);
    for (let i = 0; i < 300; i++) expect(l.message(T0 + i)).toBe(true);
    expect(l.message(T0 + 300)).toBe(false);
  });

  it('allows a steady 15 snapshots and a few requests per second forever', () => {
    const l = createSocketLimiter(DEFAULT_LIMITS, T0);
    for (let s = 0; s < 120; s++) {
      for (let i = 0; i < 15; i++) expect(l.message(T0 + s * 1000 + i * 66)).toBe(true);
      expect(l.message(T0 + s * 1000 + 999)).toBe(true);
    }
  });
});

describe('createPinGuard', () => {
  const opts = { limit: 20, windowMs: 600000, lockoutMs: 1800000 };

  it('locks a key after 20 failures in 10 minutes, for 30 minutes', () => {
    const g = createPinGuard(opts);
    const keys = ['ip:1.2.3.4', 'sock:a'];
    for (let i = 0; i < 19; i++) expect(g.fail(keys, T0 + i * 1000)).toBe(false);
    expect(g.lockedFor(keys, T0 + 19000)).toBe(0);
    expect(g.fail(keys, T0 + 19000)).toBe(true);
    expect(g.lockedFor(keys, T0 + 19000)).toBe(1800);
    expect(g.lockedFor(keys, T0 + 19000 + 1799000)).toBe(1);
    // Expired: open again, and the count starts from zero.
    expect(g.lockedFor(keys, T0 + 19000 + 1800000)).toBe(0);
    expect(g.fail(keys, T0 + 19000 + 1800001)).toBe(false);
  });

  it('locks every key that reaches the limit, independently', () => {
    const g = createPinGuard(opts);
    // One IP guessing from 20 different sockets: the IP locks, each socket does not.
    for (let i = 0; i < 20; i++) g.fail(['ip:9.9.9.9', `sock:${i}`], T0 + i);
    expect(g.lockedFor(['ip:9.9.9.9'], T0 + 100)).toBeGreaterThan(0);
    expect(g.lockedFor(['sock:3'], T0 + 100)).toBe(0);
    expect(g.lockedFor(['ip:8.8.8.8', 'sock:3'], T0 + 100)).toBe(0);
    // A new socket from the locked IP is still locked.
    expect(g.lockedFor(['ip:9.9.9.9', 'sock:new'], T0 + 100)).toBeGreaterThan(0);
  });

  it('forgets failures older than the window', () => {
    const g = createPinGuard(opts);
    const keys = ['ip:1.1.1.1'];
    for (let i = 0; i < 19; i++) g.fail(keys, T0);
    // Eleven minutes later the old failures no longer count.
    expect(g.fail(keys, T0 + 660000)).toBe(false);
    for (let i = 0; i < 18; i++) g.fail(keys, T0 + 660000);
    expect(g.lockedFor(keys, T0 + 660000)).toBe(0);
    expect(g.fail(keys, T0 + 660000)).toBe(true);
  });

  it('sweep drops expired records, so addresses are not kept longer than needed', () => {
    const g = createPinGuard(opts);
    g.fail(['ip:a'], T0);
    for (let i = 0; i < 20; i++) g.fail(['ip:b'], T0);
    expect(g.size()).toBe(2);
    g.sweep(T0 + 600001);
    expect(g.size()).toBe(1);
    g.sweep(T0 + 1800000);
    expect(g.size()).toBe(0);
  });
});

describe('connection counting and addresses', () => {
  it('counts per key and in total', () => {
    const c = createConnectionCounter();
    c.add('a');
    c.add('a');
    c.add('b');
    expect(c.count('a')).toBe(2);
    expect(c.total).toBe(3);
    c.remove('a');
    c.remove('a');
    expect(c.count('a')).toBe(0);
    expect(c.keys()).toBe(1);
    expect(c.total).toBe(1);
  });

  it('keys IPv4 per address and IPv6 per /64', () => {
    expect(addressKey('203.0.113.7')).toBe('203.0.113.7');
    expect(addressKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(addressKey('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(addressKey('2001:db8:1:2::9')).toBe('2001:db8:1:2::/64');
    expect(addressKey('[2001:db8:1:2::9]')).toBe('2001:db8:1:2::/64');
    expect(addressKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(addressKey('::1')).toBe('0:0:0:0::/64');
    expect(addressKey('')).toBe('unknown');
    expect(addressKey(undefined)).toBe('unknown');
  });

  it('ignores a port in X-Forwarded-For, and puts values that are not addresses in one shared key (finding 4)', () => {
    const key = (xff) => addressKey(clientAddress({ headers: { 'x-forwarded-for': xff }, socket: { remoteAddress: '10.0.0.1' } }, true));
    for (const v of ['203.0.113.5:51234', '203.0.113.5:51235', '203.0.113.5', '203.0.113.5:443, 10.0.0.1', '[::ffff:203.0.113.5]:80']) {
      expect(key(v), v).toBe('203.0.113.5');
    }
    for (const v of ['[2001:db8::1]:443', '[2001:db8::1]:444', '[2001:db8::1]', '2001:db8::1', '[2001:DB8::1%eth0]:8080']) {
      expect(key(v), v).toBe('2001:db8:0:0::/64');
    }
    for (const v of ['garbage-a', 'garbage-b', 'unknown', '_hidden', '999.1.1.1', '1.2.3.4.5', '1.2.3.4:x', '[2001:db8::1', '2001:db8::1::2', '[1.2.3']) {
      expect(key(v), v).toBe(INVALID_ADDRESS_KEY);
    }
    expect(addressKey(42)).toBe(INVALID_ADDRESS_KEY);
  });

  it('gives one address one key, however it is written', () => {
    expect(addressKey('010.000.000.001')).toBe('10.0.0.1');
    expect(addressKey('::ffff:cb00:7105')).toBe('203.0.113.5');
    expect(addressKey('::FFFF:203.0.113.5')).toBe('203.0.113.5');
    expect(addressKey('2001:0DB8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8:0:0::/64');
  });

  it('reads X-Forwarded-For only behind a trusted proxy', () => {
    const req = { headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }, socket: { remoteAddress: '10.0.0.1' } };
    expect(clientAddress(req, false)).toBe('10.0.0.1');
    expect(clientAddress(req, true)).toBe('198.51.100.4');
    expect(clientAddress({ headers: {}, socket: { remoteAddress: '10.0.0.2' } }, true)).toBe('10.0.0.2');
  });
});
