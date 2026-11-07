// Shared helpers for the server tests: a fake clock for the pure room logic, and a small socket.io-client wrapper for
// the integration tests.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as ioClient } from 'socket.io-client';
import { createRooms, cryptoRandom } from '../../server/rooms.mjs';
import { DEFAULT_LIMITS, DEFAULT_TIMERS } from '../../server/config.mjs';

// Timers run only when the test advances the clock, in time order (ties in the order they were set).
export function fakeClock(start = 1_800_000_000_000) {
  let now = start;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(id, { at: now + Math.max(0, ms), fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let nextId = null;
        let next = null;
        for (const [id, t] of timers) {
          if (t.at <= end && (!next || t.at < next.at || (t.at === next.at && id < nextId))) {
            next = t;
            nextId = id;
          }
        }
        if (!next) break;
        timers.delete(nextId);
        now = next.at;
        next.fn();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}

// createRooms() on a fake clock, with every outgoing message recorded.
export function roomHarness({ limits = {}, timers = {}, random = cryptoRandom } = {}) {
  const clock = fakeClock();
  const sent = [];
  const kicked = [];
  const stats = {};
  const rooms = createRooms({
    clock, random, stats,
    limits: { ...DEFAULT_LIMITS, ...limits },
    timers: { ...DEFAULT_TIMERS, ...timers },
    send: (to, event, payload) => sent.push({ to, event, payload }),
    kick: (to, code, message) => kicked.push({ to, code, message }),
  });
  return {
    clock, rooms, sent, kicked, stats,
    // Payloads of `event` sent to `to`, oldest first.
    to: (to, event) => sent.filter((m) => m.to === to && (!event || m.event === event)).map((m) => m.payload),
    last: (to, event) => {
      const list = sent.filter((m) => m.to === to && m.event === event);
      return list.length ? list[list.length - 1].payload : undefined;
    },
    events: (to) => sent.filter((m) => m.to === to).map((m) => m.event),
    clear: () => { sent.length = 0; kicked.length = 0; },
  };
}

// Calls fn and returns the ProtocolError code it throws (or 'no error').
export function codeOf(fn) {
  try {
    fn();
  } catch (err) {
    return err.code || String(err);
  }
  return 'no error';
}

// Calls fn and returns { code, retryAfterSec } of the ProtocolError it throws (or null).
export function errorOf(fn) {
  try {
    fn();
  } catch (err) {
    const out = { code: err.code || String(err) };
    if (err.retryAfterSec !== undefined) out.retryAfterSec = err.retryAfterSec;
    return out;
  }
  return null;
}

// ---- integration ----

export const FIXTURE_HTML = '<title>Fixture Racer</title>\n<meta name="description" content="test page">\n<style>body{margin:0}</style>\n<div id="menu">fixture</div>\n<script type="module">window.fixture = 1;</script>\n';

export function makeFixtureDir(html = FIXTURE_HTML) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapri-server-test-'));
  const file = path.join(dir, 'game.html');
  fs.writeFileSync(file, html);
  return { dir, file, remove: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One socket.io-client connection that records every event it receives, so a test can wait for an event that may
// already have arrived.
export class TestClient {
  constructor(socket) {
    this.socket = socket;
    this.events = [];
    this.waiters = [];
    socket.onAny((event, payload) => this.record(event, payload));
    socket.on('disconnect', (reason) => this.record('disconnect', reason));
  }

  record(event, payload) {
    this.events.push({ event, payload, taken: false });
    for (const w of [...this.waiters]) w.check();
  }

  // Resolves with the payload of the first not-yet-taken `event` that matches `pred`.
  wait(event, pred = () => true, timeout = 4000) {
    return new Promise((resolve, reject) => {
      const waiter = {
        check: () => {
          const hit = this.events.find((e) => !e.taken && e.event === event && pred(e.payload));
          if (!hit) return false;
          hit.taken = true;
          clearTimeout(timer);
          this.waiters = this.waiters.filter((w) => w !== waiter);
          resolve(hit.payload);
          return true;
        },
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`timed out waiting for ${event}; saw ${this.events.map((e) => e.event).join(', ') || 'nothing'}`));
      }, timeout);
      if (!waiter.check()) this.waiters.push(waiter);
    });
  }

  received(event) {
    return this.events.filter((e) => e.event === event).map((e) => e.payload);
  }

  request(event, payload, timeout = 4000) {
    return this.socket.timeout(timeout).emitWithAck(event, payload);
  }

  emit(event, payload) {
    this.socket.emit(event, payload);
  }

  close() {
    this.socket.disconnect();
  }
}

export function connectClient(url, options = {}) {
  const socket = ioClient(url, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 4000, ...options });
  const client = new TestClient(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(client));
    socket.once('connect_error', (err) => {
      socket.disconnect();
      reject(err);
    });
  });
}

// Resolves with the connect_error a connection attempt gets (fails the test if it connects).
export function connectError(url, options = {}) {
  const socket = ioClient(url, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 4000, ...options });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => {
      socket.disconnect();
      reject(new Error('connected, but a refusal was expected'));
    });
    socket.once('connect_error', (err) => {
      socket.disconnect();
      resolve(err);
    });
  });
}

// A raw engine.io polling client that only ever POSTs: it never GETs, so it never takes anything the server sends it
// (a client that has stopped reading). `emit` sends a Socket.IO event, with an ack id if one is given.
export async function deafPollingClient(url, isConnected) {
  const base = `${url}/socket.io/?EIO=4&transport=polling`;
  const open = await (await fetch(base)).text();
  const sid = JSON.parse(open.slice(1)).sid;
  const post = async (body) => {
    const res = await fetch(`${base}&sid=${encodeURIComponent(sid)}`, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } });
    await res.text();
    return res.status;
  };
  await post('40');
  // The namespace connect completes on a later tick; events sent before it would be dropped.
  for (let i = 0; i < 100 && !isConnected(); i++) await delay(10);
  return {
    sid,
    post,
    emit: (event, payload, ackId = '') => post(`42${ackId}${JSON.stringify([event, payload])}`),
  };
}

export const stateFor = (raceId, raceT, extra = {}) => ({
  raceId, raceT, dist: raceT * 10, s: raceT * 10, d: 0, y: 0, psi: 0, v: 20, lean: 0, pitch: 0, lap: 0, boost: 0, crashed: false, finished: false, ...extra,
});
