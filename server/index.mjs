// Chapri Racer room server: one Node process serves the game page at / and the Socket.IO endpoint at /socket.io.
//
//   import { createServer } from './server/index.mjs';
//   const srv = await createServer({ port: 0 });   // -> { url, port, close(), stats() }
//
// Run directly (node server/index.mjs) it reads its settings from the environment (server/README.md) and shuts down
// cleanly on SIGINT and SIGTERM.
//
// Layers: this file owns HTTP, the socket handshake checks, the per-socket limits and the request/ack plumbing.
// Business state lives only in rooms.mjs (rooms, seats, sessions) and race.mjs (races). protocol.mjs validates every
// payload before those modules see it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { loadConfig, resolveOptions } from './config.mjs';
import { createLogger } from './log.mjs';
import { KNOWN_EVENTS, ProtocolError, REQUEST_EVENTS, STATE_EVENT, validate } from './protocol.mjs';
import { createRooms, cryptoRandom, realClock } from './rooms.mjs';
import { addressKey, clientAddress, createConnectionCounter, createPinGuard, createSocketLimiter } from './limits.mjs';

const gzip = promisify(zlib.gzip);

const BASE_HEADERS = Object.freeze({ 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
const VIEWPORT = '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
// Raw engine.io connections are capped a little above the socket limits. The socket limits are checked again when the
// client joins the namespace, where the refusal reaches the client as a readable connect_error (SERVER_BUSY); this
// looser cap only stops connections that never get that far from piling up.
const ENGINE_HEADROOM_TOTAL = 50;
const ENGINE_HEADROOM_PER_IP = 5;
const ERROR_NOTICE_INTERVAL_MS = 5000;
const SHUTDOWN_FLUSH_MS = 1500;
const SHUTDOWN_CLOSE_MS = 2500;

// tools/build.mjs writes the page as a fragment (no doctype, no viewport). Wrap it the same way dist/test.html does,
// so phones get a proper viewport. A page that already has a doctype only gets the viewport tag if it lacks one.
export function wrapPage(raw) {
  const headEnd = (() => {
    let end = raw.length;
    for (const tag of ['<style', '<script', '<body']) {
      const i = raw.search(new RegExp(tag, 'i'));
      if (i >= 0 && i < end) end = i;
    }
    return end;
  })();
  const head = raw.slice(0, headEnd);
  const hasViewport = /<meta[^>]+name\s*=\s*["']?viewport["'\s>]/i.test(head);
  if (!/^\s*<!doctype html/i.test(raw)) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">${hasViewport ? '' : VIEWPORT}</head><body>${raw}</body></html>`;
  }
  if (hasViewport) return raw;
  const headTag = head.match(/<head[^>]*>/i);
  if (headTag) {
    const at = headTag.index + headTag[0].length;
    return raw.slice(0, at) + VIEWPORT + raw.slice(at);
  }
  const doctype = raw.match(/^\s*<!doctype html[^>]*>/i);
  return raw.slice(0, doctype[0].length) + VIEWPORT + raw.slice(doctype[0].length);
}

// The page is read from disk on demand and cached until the file changes (a rebuild while the server runs is picked up
// on the next request). The gzip copy is made once per version.
function createPageCache(file) {
  let cache = null;
  let loading = null;
  async function load(st) {
    const raw = await fs.promises.readFile(file, 'utf8');
    const body = Buffer.from(wrapPage(raw), 'utf8');
    const zipped = await gzip(body, { level: 6 });
    const etag = '"' + crypto.createHash('sha1').update(body).digest('base64url').slice(0, 22) + '"';
    cache = { mtimeMs: st.mtimeMs, size: st.size, body, gzip: zipped, etag };
    return cache;
  }
  return {
    async get() {
      const st = await fs.promises.stat(file);
      if (cache && cache.mtimeMs === st.mtimeMs && cache.size === st.size) return cache;
      if (!loading) loading = load(st).finally(() => { loading = null; });
      return loading;
    },
  };
}

function parseHostHeader(value, defaultPort) {
  const m = String(value || '').trim().toLowerCase().match(/^(\[[0-9a-f:.]+\]|[^:\s]+)(?::(\d+))?$/);
  if (!m) return null;
  return { hostname: m[1], port: m[2] || defaultPort };
}

function codeError(code, message) {
  const err = new Error(code);
  err.data = { code, message };
  return err;
}

export async function createServer(options = {}) {
  const cfg = resolveOptions(options);
  const { limits, timers } = cfg;
  const log = createLogger({ level: cfg.logLevel, quiet: cfg.quiet, write: cfg.onLog });
  const clock = realClock();
  const startedAt = Date.now();
  const allowed = new Set(cfg.allowedOrigins);
  const page = createPageCache(cfg.gameFile);
  const counters = {
    connectionsRefused: 0, originDenied: 0, requestsRateLimited: 0, statesRateLimited: 0, statesInvalid: 0,
    floodDisconnects: 0, pinFailures: 0, lockedOut: 0, internalErrors: 0,
    statesSkipped: 0, backlogDisconnects: 0,
  };
  // Rooms remember who created them (for the per-address room budget) by a keyed hash of the address key, not by the
  // address: the secret lives only in this process, so the tags say nothing about addresses on their own.
  const ownerSecret = crypto.randomBytes(32);
  const ownerTag = (key) => crypto.createHmac('sha256', ownerSecret).update(key).digest('base64url').slice(0, 22);
  let isClosing = false;
  let closePromise = null;

  if (!fs.existsSync(cfg.gameFile)) {
    log.warn('game page not found; / answers 503 until it is built (npm run build)', { gameFile: path.basename(cfg.gameFile) });
  }

  // ---- HTTP ----

  function sendText(res, status, text, extra = {}, head = false) {
    const body = Buffer.from(text + '\n', 'utf8');
    res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length, ...extra });
    res.end(head ? undefined : body);
  }

  function sendJson(res, status, value, head = false) {
    const body = Buffer.from(JSON.stringify(value), 'utf8');
    res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
    res.end(head ? undefined : body);
  }

  async function servePage(req, res, head) {
    let p;
    try {
      p = await page.get();
    } catch (err) {
      if (err && err.code === 'ENOENT') return sendText(res, 503, 'The game page has not been built yet. Run npm run build.', {}, head);
      throw err;
    }
    const inm = String(req.headers['if-none-match'] || '');
    if (inm && inm.split(',').map((s) => s.trim()).includes(p.etag)) {
      res.writeHead(304, { ...BASE_HEADERS, ETag: p.etag, Vary: 'Accept-Encoding' });
      res.end();
      return;
    }
    const useGzip = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
    const body = useGzip ? p.gzip : p.body;
    const headers = { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, ETag: p.etag, Vary: 'Accept-Encoding' };
    if (useGzip) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    res.end(head ? undefined : body);
  }

  function health() {
    return { ok: !isClosing, rooms: rooms.counts().rooms, sockets: io.of('/').sockets.size, uptimeSec: Math.floor((Date.now() - startedAt) / 1000) };
  }

  async function handleHttp(req, res) {
    const head = req.method === 'HEAD';
    if (req.method !== 'GET' && !head) return sendText(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      pathname = '';
    }
    if (pathname === '/' || pathname === '/index.html') return servePage(req, res, head);
    if (pathname === '/healthz') return sendJson(res, 200, health(), head);
    return sendText(res, 404, 'Not found', {}, head);
  }

  const httpServer = http.createServer((req, res) => {
    handleHttp(req, res).catch((err) => {
      counters.internalErrors++;
      log.error('http request failed', { err });
      if (!res.headersSent) sendText(res, 500, 'Internal error');
      else res.destroy();
    });
  });
  httpServer.on('error', (err) => log.error('http server error', { err }));

  // ---- origin and connection admission ----

  function originAllowed(origin, req) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      return allowed.has(String(origin).trim().toLowerCase());
    }
    if (allowed.has(url.origin.toLowerCase())) return true;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const defaultPort = url.protocol === 'https:' ? '443' : '80';
    const want = { hostname: url.hostname.toLowerCase(), port: url.port || defaultPort };
    const hosts = [req.headers.host];
    // Behind a proxy that rewrites Host, the original host arrives in X-Forwarded-Host.
    if (cfg.trustProxy && req.headers['x-forwarded-host']) hosts.push(String(req.headers['x-forwarded-host']).split(',')[0]);
    for (const h of hosts) {
      const got = parseHostHeader(h, defaultPort);
      if (got && got.hostname === want.hostname && got.port === want.port) return true;
    }
    return false;
  }

  const engineConns = createConnectionCounter();
  const socketConns = createConnectionCounter();
  const addressOf = new WeakMap(); // socket -> address key (never logged)

  const io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: true,
    transports: ['polling', 'websocket'],
    maxHttpBufferSize: limits.maxMessageBytes,
    connectTimeout: 10000,
    allowEIO3: false,
    cors: cfg.allowedOrigins.length ? { origin: cfg.allowedOrigins.filter((o) => o !== 'null'), methods: ['GET', 'POST'] } : undefined,
    allowRequest: (req, callback) => {
      if (isClosing) return callback('SERVER_BUSY', false);
      const origin = req.headers.origin;
      if (origin !== undefined && !originAllowed(origin, req)) {
        counters.originDenied++;
        log.info('handshake refused', { code: 'ORIGIN_DENIED' });
        return callback('ORIGIN_DENIED', false);
      }
      const key = addressKey(clientAddress(req, cfg.trustProxy));
      if (io.engine.clientsCount >= limits.maxSockets + ENGINE_HEADROOM_TOTAL || engineConns.count(key) >= limits.maxSocketsPerIp + ENGINE_HEADROOM_PER_IP) {
        counters.connectionsRefused++;
        return callback('SERVER_BUSY', false);
      }
      callback(null, true);
    },
  });

  // Socket.IO answers /socket.io/* itself, ahead of our handler. Wrap its request listener so those responses (the
  // client script, polling) carry the same base headers; Socket.IO may still override them (the client script sets its
  // own Cache-Control with an ETag).
  const socketIoListeners = httpServer.listeners('request').slice();
  httpServer.removeAllListeners('request');
  httpServer.on('request', (req, res) => {
    for (const [name, value] of Object.entries(BASE_HEADERS)) res.setHeader(name, value);
    for (const listener of socketIoListeners) listener.call(httpServer, req, res);
  });

  io.engine.on('connection', (raw) => {
    const key = addressKey(clientAddress(raw.request, cfg.trustProxy));
    engineConns.add(key);
    raw.once('close', () => engineConns.remove(key));
  });
  io.engine.on('connection_error', (err) => {
    log.debug('engine connection error', { code: err.code, message: err.message });
  });

  io.use((socket, next) => {
    if (isClosing) return next(codeError('SERVER_BUSY', 'The server is shutting down.'));
    const key = addressKey(clientAddress(socket.request, cfg.trustProxy));
    if (socketConns.total >= limits.maxSockets || socketConns.count(key) >= limits.maxSocketsPerIp) {
      counters.connectionsRefused++;
      log.info('connection refused', { code: 'SERVER_BUSY' });
      return next(codeError('SERVER_BUSY', 'Too many connections right now. Try again soon.'));
    }
    // Counted now, released when the underlying connection closes (that also covers a connection that drops before
    // the namespace connect completes, which never emits 'disconnect').
    socketConns.add(key);
    addressOf.set(socket, key);
    socket.conn.once('close', () => socketConns.remove(key));
    next();
  });

  // ---- outgoing messages ----

  // While a request is being handled, sends are queued and written after its ack (see rooms.mjs).
  let outbox = null;
  const nsp = io.of('/');

  // ---- outgoing backlog ----
  //
  // Engine.io queues every packet for a socket until the client takes it (polling: its next GET; websocket: when the
  // previous write has drained). A client that stops reading would make that queue grow without end. So:
  // droppable messages (race:state) are never queued behind a backlog, and a socket whose backlog stays over the hard
  // cap for timers.backlogGraceMs is dropped.

  const overSince = new WeakMap(); // socket -> time its backlog went over the hard cap
  const dropping = new WeakSet();

  function packetBytes(p) {
    const d = p && p.data;
    if (typeof d === 'string') return d.length;
    return d && typeof d.byteLength === 'number' ? d.byteLength : 0;
  }

  function wsOf(s) {
    const t = s.conn && s.conn.transport;
    return t && t.name === 'websocket' ? t.socket : null;
  }

  function backlogPackets(s) {
    const buf = s.conn && s.conn.writeBuffer;
    return buf ? buf.length : 0;
  }

  function overHardCap(s) {
    const buf = (s.conn && s.conn.writeBuffer) || [];
    if (buf.length > limits.backlogMaxPackets) return true;
    const ws = wsOf(s);
    let bytes = ws && typeof ws.bufferedAmount === 'number' ? ws.bufferedAmount : 0;
    // Summing the queue is only worth it once it is long.
    if (buf.length >= limits.backlogSkipPackets) for (const p of buf) bytes += packetBytes(p);
    return bytes > limits.backlogMaxBytes;
  }

  function dropSlow(s) {
    if (dropping.has(s)) return;
    dropping.add(s);
    counters.backlogDisconnects++;
    log.warn('socket dropped: it is not reading what it is sent', { sid: s.id });
    // Later, not inside the send that noticed it (that may be in the middle of a room update). close(true) discards the
    // queue instead of waiting for it to drain, which a client that does not read would never let happen.
    setImmediate(() => {
      const conn = s.conn;
      if (!conn || conn.readyState === 'closed') return;
      const ws = wsOf(s);
      try {
        conn.close(true);
        if (ws && typeof ws.terminate === 'function') ws.terminate();
      } catch (err) {
        log.warn('dropping a slow socket failed', { sid: s.id, err });
      }
    });
  }

  function checkBacklog(s, now = clock.now()) {
    if (!overHardCap(s)) {
      overSince.delete(s);
      return;
    }
    const since = overSince.get(s);
    if (since === undefined) overSince.set(s, now);
    else if (now - since >= timers.backlogGraceMs) dropSlow(s);
  }

  function deliver(socketId, event, payload) {
    const s = nsp.sockets.get(socketId);
    if (!s) return;
    s.emit(event, payload);
    checkBacklog(s);
  }

  function send(socketId, event, payload) {
    if (outbox) outbox.push(() => deliver(socketId, event, payload));
    else deliver(socketId, event, payload);
  }

  // A droppable message (race:state) is skipped for a socket that already has backlogSkipPackets waiting: that client
  // is not reading, and the next snapshot replaces this one anyway. So a stalled client holds at most that many
  // snapshots, however long it stalls.
  //
  // Socket.IO's own `volatile` flag is not used on purpose. It drops a packet whenever the transport is busy at that
  // instant, which is normal for a healthy client: a websocket is busy while its previous write is in flight (several
  // snapshots from one sender that arrive in one TCP read would all be dropped but the first, the oldest), and a
  // polling client is busy for a round trip after every GET. Racers on a healthy connection would lose snapshots.
  function broadcastDroppable(socketIds, event, payload) {
    const ids = [];
    for (const id of socketIds) {
      const s = nsp.sockets.get(id);
      if (!s) continue;
      if (backlogPackets(s) >= limits.backlogSkipPackets) counters.statesSkipped++;
      else ids.push(id);
    }
    if (ids.length) nsp.to(ids).emit(event, payload);
  }

  function broadcast(socketIds, event, payload, opts = {}) {
    if (!socketIds.length) return;
    const run = () => {
      if (opts.droppable) {
        broadcastDroppable(socketIds, event, payload);
        return;
      }
      // One encode for every recipient. Each socket is in the Socket.IO room named after its id.
      nsp.to(socketIds).emit(event, payload);
      const now = clock.now();
      for (const id of socketIds) {
        const s = nsp.sockets.get(id);
        if (s) checkBacklog(s, now);
      }
    };
    if (outbox) outbox.push(run);
    else run();
  }

  function kick(socketId, code, message) {
    const run = () => {
      const s = io.of('/').sockets.get(socketId);
      if (!s) return;
      s.emit('error', { code, message });
      s.disconnect(true);
    };
    if (outbox) outbox.push(run);
    else run();
  }

  const rooms = createRooms({ clock, random: cryptoRandom, limits, timers, send, broadcast, kick, log, stats: counters });
  const pinGuard = createPinGuard({ limit: limits.pinFailureLimit, windowMs: limits.pinFailureWindowMs, lockoutMs: limits.pinLockoutMs });
  const sweepTimer = setInterval(() => {
    try {
      const now = clock.now();
      pinGuard.sweep(now);
      rooms.sweep();
      // A backlog only grows when something is sent, and every send checks it. This catches a socket that went over
      // the cap and was then sent nothing more.
      for (const s of nsp.sockets.values()) checkBacklog(s, now);
    } catch (err) {
      log.error('sweep failed', { err });
    }
  }, timers.sweepMs);
  sweepTimer.unref();

  // ---- requests ----

  const handlers = {
    'room:create': (socket, key, data) => rooms.create(socket.id, data, ownerTag(key)),
    'room:join': (socket, key, data) => {
      const keys = ['ip:' + key, 'sock:' + socket.id];
      const now = clock.now();
      const wait = pinGuard.lockedFor(keys, now);
      if (wait) {
        counters.lockedOut++;
        throw new ProtocolError('LOCKED_OUT', `Too many wrong PINs. Try again in ${Math.ceil(wait / 60)} min.`, wait);
      }
      try {
        return rooms.join(socket.id, data);
      } catch (err) {
        if (err instanceof ProtocolError && err.code === 'NOT_FOUND') {
          counters.pinFailures++;
          if (pinGuard.fail(keys, now)) log.info('pin lockout', { sid: socket.id });
        }
        throw err;
      }
    },
    'session:resume': (socket, key, data) => rooms.resume(socket.id, data),
    'room:leave': (socket) => rooms.leave(socket.id),
    'room:settings': (socket, key, data) => rooms.settings(socket.id, data),
    'racer:update': (socket, key, data) => rooms.updateRacer(socket.id, data),
    'race:start': (socket) => rooms.startRace(socket.id),
    'race:finish': (socket, key, data) => rooms.finish(socket.id, data),
    'clock:ping': () => ({ serverNow: clock.now() }),
  };

  function reply(ack, value) {
    try {
      ack(value);
    } catch (err) {
      log.warn('ack failed', { err });
    }
  }

  function runQueued(queue) {
    for (const fn of queue) {
      try {
        fn();
      } catch (err) {
        counters.internalErrors++;
        log.error('send failed', { err });
      }
    }
  }

  const known = new Set(KNOWN_EVENTS);

  io.on('connection', (socket) => {
    const key = addressOf.get(socket) || 'unknown';
    const limiter = createSocketLimiter(limits);
    let lastNoticeAt = -Infinity;
    log.debug('socket connected', { sid: socket.id });

    // Protocol errors that have no ack to travel on. Rate limited, so a broken client is told without being flooded.
    function notify(code, message) {
      const now = clock.now();
      if (now - lastNoticeAt < ERROR_NOTICE_INTERVAL_MS) return;
      lastNoticeAt = now;
      socket.emit('error', { code, message });
    }

    socket.use((packet, next) => {
      if (!limiter.message(clock.now())) {
        if (socket.connected) {
          counters.floodDisconnects++;
          log.warn('socket disconnected for flooding', { sid: socket.id, code: 'RATE_LIMITED' });
          socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many messages. Disconnected.' });
          socket.disconnect(true);
        }
        return;
      }
      const event = packet[0];
      if (typeof event !== 'string' || !known.has(event)) {
        const last = packet[packet.length - 1];
        const res = { ok: false, code: 'BAD_REQUEST', message: 'Unknown event.' };
        if (packet.length > 1 && typeof last === 'function') reply(last, res);
        else notify('BAD_REQUEST', 'Unknown event.');
        return;
      }
      next();
    });

    for (const event of REQUEST_EVENTS) {
      socket.on(event, (...args) => {
        const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
        if (!ack) {
          notify('BAD_REQUEST', `${event} needs an ack callback.`);
          return;
        }
        if (args.length > 1) {
          reply(ack, { ok: false, code: 'BAD_REQUEST', message: `${event} takes one payload object.` });
          return;
        }
        const rl = limiter.request(clock.now());
        if (!rl.ok) {
          counters.requestsRateLimited++;
          reply(ack, { ok: false, code: 'RATE_LIMITED', message: 'Too many requests. Slow down.', retryAfterSec: rl.retryAfterSec });
          return;
        }
        outbox = [];
        let result;
        try {
          const data = validate(event, args[0], { lookMaxBytes: limits.lookMaxBytes });
          result = { ok: true, ...handlers[event](socket, key, data) };
        } catch (err) {
          if (err instanceof ProtocolError) {
            result = err.toAck();
          } else {
            counters.internalErrors++;
            log.error('request failed', { event, sid: socket.id, err });
            result = { ok: false, code: 'SERVER_BUSY', message: 'The server hit an error. Please try again.' };
          }
        }
        const queue = outbox;
        outbox = null;
        reply(ack, result);
        runQueued(queue);
      });
    }

    socket.on(STATE_EVENT, (...args) => {
      if (typeof args[args.length - 1] === 'function') args.pop();
      if (!limiter.state(clock.now())) {
        counters.statesRateLimited++;
        return;
      }
      let data;
      try {
        if (args.length !== 1) throw new ProtocolError('BAD_REQUEST', 'race:state takes one payload object');
        data = validate(STATE_EVENT, args[0]);
      } catch (err) {
        counters.statesInvalid++;
        notify('BAD_REQUEST', err instanceof ProtocolError ? `race:state dropped: ${err.message}` : 'race:state dropped');
        return;
      }
      try {
        rooms.state(socket.id, data);
      } catch (err) {
        counters.internalErrors++;
        log.error('relay failed', { sid: socket.id, err });
      }
    });

    socket.on('disconnect', (reason) => {
      try {
        rooms.disconnect(socket.id);
      } catch (err) {
        counters.internalErrors++;
        log.error('disconnect handling failed', { sid: socket.id, err });
      }
      pinGuard.forget('sock:' + socket.id);
      log.debug('socket disconnected', { sid: socket.id, reason });
    });
  });

  // ---- listen ----

  await new Promise((resolve, reject) => {
    const onError = (err) => {
      httpServer.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      httpServer.off('error', onError);
      resolve();
    };
    httpServer.once('error', onError);
    httpServer.once('listening', onListening);
    httpServer.listen(cfg.port, cfg.host);
  }).catch((err) => {
    clearInterval(sweepTimer);
    io.close();
    throw err;
  });

  const port = httpServer.address().port;
  const urlHost = cfg.host === '0.0.0.0' ? '127.0.0.1' : (cfg.host === '::' ? 'localhost' : (cfg.host.includes(':') ? `[${cfg.host}]` : cfg.host));
  const url = `http://${urlHost}:${port}`;
  log.info('listening', { port });

  function waitUntil(test, ms) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        if (test() || Date.now() - t0 >= ms) resolve();
        else setTimeout(tick, 20);
      };
      tick();
    });
  }

  // Graceful close: every seat gets room:closed (server-shutdown), then sockets close, then the HTTP server. Finishes
  // within about 4 s even if clients do not cooperate.
  function close() {
    if (closePromise) return closePromise;
    isClosing = true;
    closePromise = (async () => {
      clearInterval(sweepTimer);
      outbox = null;
      try {
        rooms.shutdown();
      } catch (err) {
        log.error('room shutdown failed', { err });
      }
      // disconnect(true) closes each connection after its queued packets (room:closed among them) are written. Only
      // these connections are waited for; io.close() below drops the rest (bare handshakes that never joined).
      const sockets = [...io.of('/').sockets.values()];
      const conns = sockets.map((s) => s.conn);
      for (const s of sockets) s.disconnect(true);
      await waitUntil(() => conns.every((c) => c.readyState === 'closed'), SHUTDOWN_FLUSH_MS);
      await new Promise((resolve) => {
        const t = setTimeout(resolve, SHUTDOWN_CLOSE_MS);
        io.close(() => {
          clearTimeout(t);
          resolve();
        });
        if (typeof httpServer.closeIdleConnections === 'function') httpServer.closeIdleConnections();
      });
      if (typeof httpServer.closeAllConnections === 'function') httpServer.closeAllConnections();
      log.info('server closed');
    })();
    return closePromise;
  }

  function stats() {
    const c = rooms.counts();
    let backlogMax = 0;
    for (const s of nsp.sockets.values()) backlogMax = Math.max(backlogMax, backlogPackets(s));
    return {
      ...c,
      sockets: nsp.sockets.size,
      connections: io.engine.clientsCount,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      pinGuardEntries: pinGuard.size(),
      // The longest outgoing queue of any socket right now, in packets.
      backlogMax,
      ...counters,
    };
  }

  return { url, port, close, stats };
}

// ---- CLI ----

async function main() {
  let options;
  try {
    options = loadConfig(process.env);
  } catch (err) {
    process.stderr.write(JSON.stringify({ t: new Date().toISOString(), level: 'error', msg: 'invalid configuration', error: err.message }) + '\n');
    process.exit(1);
  }
  const log = createLogger({ level: options.logLevel || 'info' });
  // Keep serving after an unexpected error: log it as JSON instead of crashing every room on the server.
  process.on('uncaughtException', (err) => log.error('uncaught exception', { err }));
  process.on('unhandledRejection', (err) => log.error('unhandled rejection', { err }));
  let server;
  try {
    server = await createServer(options);
  } catch (err) {
    log.error('could not start the server', { err });
    process.exit(1);
  }
  let stopping = false;
  const stop = (signal) => {
    if (stopping) process.exit(0);
    stopping = true;
    log.info('shutting down', { signal });
    const hard = setTimeout(() => {
      log.warn('shutdown took too long; exiting');
      process.exit(0);
    }, 4800);
    hard.unref();
    server.close().then(() => process.exit(0), (err) => {
      log.error('shutdown failed', { err });
      process.exit(0);
    });
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) main();
