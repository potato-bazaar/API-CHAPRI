// The real server (createServer on an ephemeral port) driven by socket.io-client. The game page is a small fixture
// written to a temporary directory, so these tests do not depend on dist/ or src/.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from '../../server/index.mjs';
import { FIXTURE_HTML, connectClient, connectError, deafPollingClient, delay, makeFixtureDir, stateFor } from './helpers.mjs';

let fixture;
const servers = [];
const clients = [];

beforeAll(() => {
  fixture = makeFixtureDir();
});

afterAll(() => {
  fixture.remove();
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

async function start(options = {}) {
  const srv = await createServer({ port: 0, host: '127.0.0.1', quiet: true, gameFile: fixture.file, ...options });
  servers.push(srv);
  return srv;
}

async function client(url, options) {
  const c = await connectClient(url, options);
  clients.push(c);
  return c;
}

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Host creates a room, the others join it. Returns { pin, host, guests, tokens }.
async function room(url, n = 2, names = ['Host', 'Bo', 'Cy', 'Di']) {
  const host = await client(url);
  const created = await host.request('room:create', { name: names[0], bike: 'kaali', look: { tank: '#111' } });
  expect(created.ok).toBe(true);
  const guests = [];
  const tokens = [created.token];
  for (let i = 1; i < n; i++) {
    const g = await client(url);
    const res = await g.request('room:join', { pin: created.pin, name: names[i] });
    expect(res.ok).toBe(true);
    tokens.push(res.token);
    guests.push(g);
  }
  return { pin: created.pin, host, guests, tokens };
}

describe('HTTP', () => {
  it('serves the game page at / and /index.html with a doctype, a viewport and the no-cache headers', async () => {
    const srv = await start();
    for (const p of ['/', '/index.html', '/?room=1234']) {
      const res = await request(srv.url + p);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      const html = res.body.toString('utf8');
      expect(html.startsWith('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport"')).toBe(true);
      expect(html).toContain('width=device-width');
      expect(html).toContain(FIXTURE_HTML);
      expect(html.endsWith('</body></html>')).toBe(true);
    }
  });

  it('compresses the page for gzip clients, answers HEAD and revalidates with an ETag', async () => {
    const srv = await start();
    const plain = await request(srv.url + '/');
    const zipped = await request(srv.url + '/', { headers: { 'accept-encoding': 'gzip, deflate' } });
    expect(zipped.headers['content-encoding']).toBe('gzip');
    expect(zlib.gunzipSync(zipped.body).equals(plain.body)).toBe(true);
    const head = await request(srv.url + '/', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.body.length).toBe(0);
    expect(Number(head.headers['content-length'])).toBe(plain.body.length);
    const etag = plain.headers.etag;
    expect(etag).toBeTruthy();
    const again = await request(srv.url + '/', { headers: { 'if-none-match': etag } });
    expect(again.status).toBe(304);
    expect(again.body.length).toBe(0);
  });

  it('serves a full document as it is, and adds only a missing viewport', async () => {
    const full = makeFixtureDir('<!doctype html><html><head><meta name="viewport" content="width=500"><title>T</title></head><body>x</body></html>');
    const noViewport = makeFixtureDir('<!DOCTYPE html><html><head><title>T</title></head><body>y</body></html>');
    try {
      const a = await start({ gameFile: full.file });
      expect((await request(a.url + '/')).body.toString()).toBe(fs.readFileSync(full.file, 'utf8'));
      const b = await start({ gameFile: noViewport.file });
      const html = (await request(b.url + '/')).body.toString();
      expect(html).toMatch(/^<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width[^"]*"><title>T<\/title>/);
    } finally {
      full.remove();
      noViewport.remove();
    }
  });

  it('picks up a rebuilt page without a restart', async () => {
    const dir = makeFixtureDir('<title>one</title>');
    try {
      const srv = await start({ gameFile: dir.file });
      expect((await request(srv.url + '/')).body.toString()).toContain('<title>one</title>');
      fs.writeFileSync(dir.file, '<title>two, longer</title>');
      expect((await request(srv.url + '/')).body.toString()).toContain('<title>two, longer</title>');
    } finally {
      dir.remove();
    }
  });

  it('answers 503 while the game page is missing', async () => {
    const srv = await start({ gameFile: path.join(fixture.dir, 'missing.html') });
    const res = await request(srv.url + '/');
    expect(res.status).toBe(503);
    expect((await request(srv.url + '/healthz')).status).toBe(200);
  });

  it('reports health', async () => {
    const srv = await start();
    const res = await request(srv.url + '/healthz');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(res.headers['cache-control']).toBe('no-cache');
    const body = JSON.parse(res.body.toString());
    expect(body).toEqual({ ok: true, rooms: 0, sockets: 0, uptimeSec: expect.any(Number) });
    await room(srv.url, 2);
    const later = JSON.parse((await request(srv.url + '/healthz')).body.toString());
    expect(later).toMatchObject({ rooms: 1, sockets: 2 });
  });

  it('serves the Socket.IO browser client', async () => {
    const srv = await start();
    const res = await request(srv.url + '/socket.io/socket.io.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body.length).toBeGreaterThan(10000);
    expect(res.body.toString('utf8', 0, 2000)).toMatch(/Socket\.IO v4\.8\.4/);
    const handshake = await request(srv.url + '/socket.io/?EIO=4&transport=polling');
    expect(handshake.status).toBe(200);
    // Engine.io sets its own, stricter no-store on polling responses.
    expect(handshake.headers['cache-control']).toMatch(/^no-(cache|store)$/);
    expect(handshake.headers['x-content-type-options']).toBe('nosniff');
  });

  it('answers 404 for everything else and 405 for other methods', async () => {
    const srv = await start();
    for (const p of ['/nope', '/dist/chapri-racer.html', '/server/index.mjs', '/package.json', '/healthz/x', '/index.htm']) {
      const res = await request(srv.url + p);
      expect(res.status, p).toBe(404);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    }
    for (const [method, p] of [['POST', '/'], ['PUT', '/healthz'], ['DELETE', '/nope'], ['PATCH', '/index.html']]) {
      const res = await request(srv.url + p, { method });
      expect(res.status, `${method} ${p}`).toBe(405);
      expect(res.headers.allow).toBe('GET, HEAD');
    }
  });
});

describe('rooms over sockets', () => {
  it('creates and joins a room, and keeps every roster in sync', async () => {
    const srv = await start();
    const host = await client(srv.url);
    const created = await host.request('room:create', { name: '  Host ', bike: 'kaali', look: { tank: '#111' } });
    expect(created).toMatchObject({ ok: true, seat: 0, pin: expect.stringMatching(/^\d{4}$/), token: expect.stringMatching(/^[0-9a-f]{32}$/) });
    expect(created.room.racers).toEqual([{ seat: 0, name: 'Host', bike: 'kaali', look: { tank: '#111' }, host: true, connected: true }]);
    const guest = await client(srv.url);
    const joined = await guest.request('room:join', { pin: created.pin, name: 'Bo', bike: 'neon' });
    expect(joined).toMatchObject({ ok: true, seat: 1, pin: created.pin });
    expect(await host.wait('room:notice')).toEqual({ kind: 'joined', name: 'Bo' });
    const hv = await host.wait('room:update', (v) => v.racers.length === 2);
    const gv = await guest.wait('room:update', (v) => v.racers.length === 2);
    expect(hv.you).toBe(0);
    expect(gv.you).toBe(1);
    expect({ ...hv, you: null }).toEqual({ ...gv, you: null });
    expect(gv.racers[1]).toEqual({ seat: 1, name: 'Bo', bike: 'neon', look: {}, host: false, connected: true });
  });

  it('answers a wrong PIN with NOT_FOUND and a full room with FULL', async () => {
    const srv = await start();
    const { pin } = await room(srv.url, 8, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const ninth = await client(srv.url);
    expect(await ninth.request('room:join', { pin })).toMatchObject({ ok: false, code: 'FULL' });
    const wrong = pin === '0000' ? '0001' : '0000';
    expect(await ninth.request('room:join', { pin: wrong })).toMatchObject({ ok: false, code: 'NOT_FOUND', message: expect.any(String) });
    expect(await ninth.request('room:join', { pin: '12' })).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
  });

  it('syncs settings from the host and refuses them from anyone else', async () => {
    const srv = await start();
    const { host, guests: [g] } = await room(srv.url);
    const res = await host.request('room:settings', { track: 'dharavi-lanes', laps: 5, time: 'night', weather: 'monsoon' });
    expect(res.ok).toBe(true);
    expect(res.room.settings).toEqual({ track: 'dharavi-lanes', laps: 5, time: 'night', weather: 'monsoon' });
    expect(await g.wait('room:notice', (n) => n.kind === 'settings')).toEqual({ kind: 'settings', name: 'Host' });
    expect((await g.wait('room:update', (v) => v.settings.laps === 5)).settings.track).toBe('dharavi-lanes');
    expect(await g.request('room:settings', { laps: 1 })).toMatchObject({ ok: false, code: 'NOT_HOST' });
    expect(await host.request('room:settings', { laps: 4 })).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
  });

  it('syncs racer updates', async () => {
    const srv = await start();
    const { host, guests: [g] } = await room(srv.url);
    const res = await g.request('racer:update', { name: 'Neo', bike: 'raja', look: { paint: 'gold' } });
    expect(res.ok).toBe(true);
    const v = await host.wait('room:update', (r) => r.racers[1] && r.racers[1].name === 'Neo');
    expect(v.racers[1]).toMatchObject({ bike: 'raja', look: { paint: 'gold' } });
  });

  it('resumes a seat after a dropped connection', async () => {
    const srv = await start({ timers: { reconnectGraceMs: 5000 } });
    const { pin, host, guests: [g], tokens } = await room(srv.url);
    g.close();
    expect(await host.wait('room:notice', (n) => n.kind === 'disconnected')).toEqual({ kind: 'disconnected', name: 'Bo' });
    expect((await host.wait('room:update', (v) => v.racers[1] && !v.racers[1].connected)).racers[1].connected).toBe(false);
    const back = await client(srv.url);
    const res = await back.request('session:resume', { token: tokens[1] });
    expect(res).toMatchObject({ ok: true, pin, seat: 1 });
    expect(res.token).toBeUndefined();
    expect(await host.wait('room:notice', (n) => n.kind === 'reconnected')).toEqual({ kind: 'reconnected', name: 'Bo' });
    expect(await back.request('session:resume', { token: 'f'.repeat(32) })).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('hands a seat to a newer socket and closes the old one with SUPERSEDED', async () => {
    const srv = await start();
    const { guests: [g], tokens } = await room(srv.url);
    const tab2 = await client(srv.url);
    expect((await tab2.request('session:resume', { token: tokens[1] })).ok).toBe(true);
    expect(await g.wait('error')).toMatchObject({ code: 'SUPERSEDED' });
    expect(await g.wait('disconnect')).toBe('io server disconnect');
  });

  it('answers EXPIRED for a seat that has left', async () => {
    const srv = await start();
    const { guests: [g], tokens } = await room(srv.url);
    expect(await g.request('room:leave', {})).toEqual({ ok: true });
    const later = await client(srv.url);
    expect(await later.request('session:resume', { token: tokens[1] })).toMatchObject({ ok: false, code: 'EXPIRED' });
  });

  it('migrates the host when the host leaves', async () => {
    const srv = await start();
    const { host, guests: [b, c] } = await room(srv.url, 3);
    expect(await host.request('room:leave', {})).toEqual({ ok: true });
    expect(await b.wait('room:notice', (n) => n.kind === 'left')).toEqual({ kind: 'left', name: 'Host' });
    expect(await b.wait('room:notice', (n) => n.kind === 'new-host')).toEqual({ kind: 'new-host', name: 'Bo' });
    const v = await c.wait('room:update', (r) => r.racers.length === 2);
    expect(v.hostSeat).toBe(1);
    expect(v.racers.find((r) => r.seat === 1).host).toBe(true);
    // The old host is free to make a new room.
    expect((await host.request('room:create', {})).ok).toBe(true);
    // The new host can now change settings.
    expect((await b.request('room:settings', { laps: 1 })).ok).toBe(true);
  });

  it('migrates the host after the grace period when the host stays away', async () => {
    const srv = await start({ timers: { reconnectGraceMs: 300 } });
    const { host, guests: [b] } = await room(srv.url);
    host.close();
    const v = await b.wait('room:update', (r) => r.hostSeat === 1, 3000);
    expect(v.racers).toHaveLength(1);
    expect(await b.wait('room:notice', (n) => n.kind === 'new-host')).toEqual({ kind: 'new-host', name: 'Bo' });
  });

  it('refuses to start with fewer than 2 racers', async () => {
    const srv = await start();
    const host = await client(srv.url);
    await host.request('room:create', {});
    expect(await host.request('race:start', {})).toMatchObject({ ok: false, code: 'NOT_ENOUGH_RACERS' });
  });

  it('answers clock:ping with the server time', async () => {
    const srv = await start();
    const c = await client(srv.url);
    const before = Date.now();
    const res = await c.request('clock:ping', {});
    expect(res.ok).toBe(true);
    expect(res.serverNow).toBeGreaterThanOrEqual(before);
    expect(res.serverNow).toBeLessThanOrEqual(Date.now());
  });

  it('rejects malformed requests without dropping the connection', async () => {
    const srv = await start();
    const c = await client(srv.url);
    expect(await c.request('room:create', { name: 'x', extra: 1 })).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
    expect(await c.request('room:create', null)).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
    expect(await c.request('room:create', { look: { big: 'x'.repeat(3000) } })).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
    expect(await c.request('room:bogus', {})).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
    expect(await c.socket.timeout(2000).emitWithAck('room:create', {}, 'extra')).toMatchObject({ ok: false, code: 'BAD_REQUEST' });
    expect(await c.request('room:settings', {})).toMatchObject({ ok: false, code: 'NOT_IN_ROOM' });
    c.emit('room:create', {}); // no ack
    expect(await c.wait('error')).toMatchObject({ code: 'BAD_REQUEST' });
    expect(c.socket.connected).toBe(true);
    expect((await c.request('room:create', {})).ok).toBe(true);
  });
});

describe('races over sockets', () => {
  it('runs a full race: begin, GO, relay, finishes and the same results everywhere', async () => {
    const srv = await start({ timers: { goDelayMs: 300 } });
    const { host, guests: [b, c] } = await room(srv.url, 3);
    await host.request('room:settings', { laps: 1, track: 'random' });
    const t0 = Date.now();
    const started = await host.request('race:start', {});
    expect(started).toMatchObject({ ok: true, raceId: expect.any(Number) });
    expect(started.goAt).toBeGreaterThanOrEqual(t0 + 300);
    const begins = await Promise.all([host, b, c].map((x) => x.wait('race:begin')));
    expect(begins[1]).toEqual(begins[0]);
    expect(begins[2]).toEqual(begins[0]);
    expect(begins[0]).toMatchObject({ raceId: started.raceId, goAt: started.goAt, laps: 1, time: 'morning', weather: 'clear' });
    expect(begins[0].track).not.toBe('random');
    expect(begins[0].racers.map((r) => r.seat)).toEqual([0, 1, 2]);
    await host.wait('room:update', (v) => v.phase === 'countdown');
    await Promise.all([host, b, c].map((x) => x.wait('room:update', (v) => v.phase === 'racing', 3000)));
    const id = started.raceId;
    b.emit('race:state', stateFor(id, 1, { dist: 20 }));
    expect(await host.wait('race:state')).toEqual({ seat: 1, ...stateFor(id, 1, { dist: 20 }) });
    expect(await c.wait('race:state')).toMatchObject({ seat: 1 });
    expect(await host.request('race:finish', { raceId: id, raceT: 61.25, dist: 3000, lap: 1 })).toEqual({ ok: true });
    expect(await c.request('race:finish', { raceId: id, raceT: 60.5, dist: 3000, lap: 1 })).toEqual({ ok: true });
    expect(await b.request('race:finish', { raceId: id, raceT: 70, dist: 3000, lap: 1 })).toEqual({ ok: true });
    const results = await Promise.all([host, b, c].map((x) => x.wait('race:results')));
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[0].reason).toBe('all-finished');
    expect(results[0].order.map((o) => [o.pos, o.seat, o.finishT])).toEqual([[1, 2, 60.5], [2, 0, 61.25], [3, 1, 70]]);
    const lobby = await b.wait('room:update', (v) => v.phase === 'lobby' && v.raceId === null);
    expect(lobby.hostSeat).toBe(0);
    // Race again.
    const again = await host.request('race:start', {});
    expect(again.raceId).toBeGreaterThan(id);
  });

  it('relays only valid, current, newer snapshots and tells the sender about invalid ones', async () => {
    const srv = await start({ timers: { goDelayMs: 100 } });
    const { host, guests: [b] } = await room(srv.url);
    const { raceId } = await host.request('race:start', {});
    await host.wait('room:update', (v) => v.phase === 'racing', 3000);
    b.emit('race:state', stateFor(raceId, 5));
    b.emit('race:state', stateFor(raceId, 4)); // older: dropped
    b.emit('race:state', stateFor(raceId + 7, 6)); // other race: dropped
    b.emit('race:state', { ...stateFor(raceId, 7), v: 999 }); // out of range: dropped, error to sender
    b.emit('race:state', { ...stateFor(raceId, 8), hack: true }); // unknown key: dropped
    b.emit('race:state', stateFor(raceId, 9));
    expect((await b.wait('error')).code).toBe('BAD_REQUEST');
    await host.wait('race:state', (s) => s.raceT === 9);
    expect(host.received('race:state').map((s) => s.raceT)).toEqual([5, 9]);
    expect(b.received('race:state')).toEqual([]);
    expect(srv.stats().statesInvalid).toBe(2);
  });

  it('sends race:begin straight after the ack when a racer resumes mid-race', async () => {
    const srv = await start({ timers: { goDelayMs: 100, reconnectGraceMs: 5000 } });
    const { host, guests: [b], tokens } = await room(srv.url);
    const { raceId } = await host.request('race:start', {});
    await host.wait('room:update', (v) => v.phase === 'racing', 3000);
    b.close();
    await host.wait('room:notice', (n) => n.kind === 'disconnected');
    const back = await client(srv.url);
    const order = [];
    back.socket.onAny((ev) => order.push(ev));
    // A plain callback runs as soon as the ack packet is decoded, so `order` is the order on the wire.
    const res = await new Promise((resolve) => back.socket.emit('session:resume', { token: tokens[1] }, (ack) => {
      order.push('ack');
      resolve(ack);
    }));
    expect(res).toMatchObject({ ok: true, seat: 1, room: { phase: 'racing', raceId } });
    const begin = await back.wait('race:begin');
    expect(begin.raceId).toBe(raceId);
    expect(order.slice(0, 2)).toEqual(['ack', 'race:begin']);
    expect(back.received('race:begin')).toHaveLength(1);
  });

  it('ends with timeout results when a racer never finishes', async () => {
    const srv = await start({ timers: { goDelayMs: 100, finishTimeoutMs: 300 } });
    const { host, guests: [b] } = await room(srv.url);
    const { raceId } = await host.request('race:start', {});
    await host.wait('room:update', (v) => v.phase === 'racing', 3000);
    b.emit('race:state', stateFor(raceId, 2, { dist: 77 }));
    await host.wait('race:state');
    await host.request('race:finish', { raceId, raceT: 30, dist: 1000, lap: 1 });
    const r = await b.wait('race:results', () => true, 3000);
    expect(r.reason).toBe('timeout');
    expect(r.order[1]).toMatchObject({ seat: 1, finished: false, dnf: true, dist: 77, finishT: null });
  });

  it('aborts at GO when only one racer is left connected', async () => {
    // disconnectNoticeMs: 0 sends the disconnected notice at once, so it can show that the server saw the drop before GO.
    const srv = await start({ timers: { goDelayMs: 2000, reconnectGraceMs: 10000, disconnectNoticeMs: 0 } });
    const { host, guests: [b] } = await room(srv.url);
    const { goAt } = await host.request('race:start', {});
    b.close();
    await host.wait('room:notice', (n) => n.kind === 'disconnected');
    // The server saw the disconnect before GO, or this test cannot say anything about the abort rule.
    expect(Date.now()).toBeLessThan(goAt);
    const r = await host.wait('race:results', () => true, 5000);
    expect(r.reason).toBe('aborted');
    expect((await host.wait('room:update', (v) => v.phase === 'lobby')).raceId).toBeNull();
  });

  it('refuses a join while racing with RACING, and settings with RACE_IN_PROGRESS', async () => {
    const srv = await start({ timers: { goDelayMs: 100 } });
    const { pin, host } = await room(srv.url);
    await host.request('race:start', {});
    const late = await client(srv.url);
    expect(await late.request('room:join', { pin })).toMatchObject({ ok: false, code: 'RACING' });
    expect(await host.request('room:settings', { laps: 1 })).toMatchObject({ ok: false, code: 'RACE_IN_PROGRESS' });
    expect(await host.request('race:start', {})).toMatchObject({ ok: false, code: 'RACE_IN_PROGRESS' });
  });
});

describe('protection', () => {
  it('refuses a handshake from a foreign origin with ORIGIN_DENIED', async () => {
    const srv = await start();
    for (const transports of [['websocket'], ['polling']]) {
      const err = await connectError(srv.url, { transports, extraHeaders: { origin: 'https://evil.example' } });
      expect(err).toBeInstanceOf(Error);
    }
    expect(srv.stats().originDenied).toBe(2);
    const raw = await request(srv.url + '/socket.io/?EIO=4&transport=polling', { headers: { origin: 'https://evil.example' } });
    expect(raw.status).toBe(403);
    expect(JSON.parse(raw.body.toString())).toMatchObject({ message: 'ORIGIN_DENIED' });
    expect(srv.stats().sockets).toBe(0);
  });

  it('allows the same origin, a listed origin and a client without an Origin header', async () => {
    const srv = await start({ allowedOrigins: ['https://friends.example'] });
    await client(srv.url, { extraHeaders: { origin: srv.url } });
    await client(srv.url, { extraHeaders: { origin: 'https://friends.example' } });
    await client(srv.url);
    await client(srv.url, { transports: ['polling'], extraHeaders: { origin: srv.url } });
    const other = await connectError(srv.url, { extraHeaders: { origin: srv.url.replace('127.0.0.1', 'localhost') } });
    expect(other).toBeInstanceOf(Error);
    expect(srv.stats().sockets).toBe(4);
  });

  it('closes a connection that sends a 150 KB message and keeps serving', async () => {
    const srv = await start();
    for (const transports of [['websocket'], ['polling']]) {
      const c = await client(srv.url, { transports });
      c.emit('room:create', { name: 'x', look: { blob: 'x'.repeat(150 * 1024) } });
      const reason = await c.wait('disconnect', () => true, 5000);
      expect(reason).toMatch(/transport (close|error)/);
    }
    const health = JSON.parse((await request(srv.url + '/healthz')).body.toString());
    expect(health.ok).toBe(true);
    const fresh = await client(srv.url);
    expect((await fresh.request('room:create', {})).ok).toBe(true);
  });

  it('rate-limits requests to 60 per 10 s with retryAfterSec', async () => {
    const srv = await start();
    const c = await client(srv.url);
    const t0 = Date.now();
    const acks = await Promise.all(Array.from({ length: 80 }, () => c.request('clock:ping', {})));
    const elapsedSec = (Date.now() - t0) / 1000;
    expect(acks.slice(0, 60).every((a) => a.ok)).toBe(true);
    const ok = acks.filter((a) => a.ok).length;
    // The bucket refills at 6 per second, so a slow machine may let a few more through during the burst.
    expect(ok).toBeLessThanOrEqual(60 + Math.ceil(6 * elapsedSec) + 1);
    const refused = acks.filter((a) => !a.ok);
    expect(refused.length).toBeGreaterThan(0);
    for (const r of refused) {
      expect(r).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryAfterSec: expect.any(Number) });
      expect(r.retryAfterSec).toBeGreaterThanOrEqual(1);
    }
    expect(srv.stats().requestsRateLimited).toBe(refused.length);
    expect(c.socket.connected).toBe(true);
  });

  it('caps race:state at 20 per second and drops the excess silently', async () => {
    const srv = await start({ timers: { goDelayMs: 100 } });
    const { host, guests: [b] } = await room(srv.url);
    const { raceId } = await host.request('race:start', {});
    await host.wait('room:update', (v) => v.phase === 'racing', 3000);
    const t0 = Date.now();
    for (let i = 1; i <= 40; i++) b.emit('race:state', stateFor(raceId, i));
    await b.request('clock:ping', {}); // everything before it has been processed
    const elapsedSec = (Date.now() - t0) / 1000;
    const relayedByServer = srv.stats().statesRelayed;
    await host.wait('race:state', (s) => s.raceT === 40, 3000).catch(() => {});
    await delay(100);
    const relayed = host.received('race:state').length;
    expect(relayed).toBe(relayedByServer);
    expect(relayed).toBeGreaterThanOrEqual(20);
    // 20 at once, plus the refill (20 per second) while the burst was arriving.
    expect(relayed).toBeLessThanOrEqual(20 + Math.ceil(20 * elapsedSec) + 1);
    expect(relayed).toBeLessThan(40);
    expect(srv.stats().statesRateLimited).toBe(40 - relayed);
    expect(b.received('error')).toEqual([]);
    expect(b.socket.connected).toBe(true);
  });

  it('disconnects a socket that floods more than 300 messages in 10 s with RATE_LIMITED', async () => {
    const srv = await start();
    const c = await client(srv.url);
    for (let i = 0; i < 320; i++) c.emit('race:state', stateFor(1, i));
    expect(await c.wait('error', (e) => e.code === 'RATE_LIMITED', 5000)).toMatchObject({ code: 'RATE_LIMITED' });
    expect(await c.wait('disconnect')).toBe('io server disconnect');
    expect(srv.stats().floodDisconnects).toBe(1);
  });

  it('caps sockets per IP with a readable SERVER_BUSY', async () => {
    const srv = await start({ limits: { maxSocketsPerIp: 2 } });
    const a = await client(srv.url);
    await client(srv.url);
    const err = await connectError(srv.url);
    expect(err.message).toBe('SERVER_BUSY');
    expect(err.data).toMatchObject({ code: 'SERVER_BUSY', message: expect.any(String) });
    a.close();
    for (let i = 0; i < 100 && srv.stats().connections > 1; i++) await delay(20);
    await client(srv.url);
  });

  it('locks out PIN guessing after the failure limit, for the IP and not just the socket', async () => {
    const srv = await start({ limits: { pinFailureLimit: 3 } });
    const { pin } = await room(srv.url, 1);
    const guesser = await client(srv.url);
    const wrong = ['0000', '0001', '0002', '0003'].filter((p) => p !== pin).slice(0, 3);
    for (const p of wrong) expect(await guesser.request('room:join', { pin: p })).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    const locked = await guesser.request('room:join', { pin });
    expect(locked).toMatchObject({ ok: false, code: 'LOCKED_OUT' });
    expect(locked.retryAfterSec).toBeGreaterThan(1700);
    const sameIp = await client(srv.url);
    expect(await sameIp.request('room:join', { pin })).toMatchObject({ ok: false, code: 'LOCKED_OUT' });
    // Malformed PINs do not count, and creating a room still works.
    expect((await sameIp.request('room:create', {})).ok).toBe(true);
  });
});

describe('abuse limits', () => {
  const from = (address) => ({ extraHeaders: { 'x-forwarded-for': address } });

  it('budgets room creation per address, and one address churning rooms cannot lock others out (finding 1)', async () => {
    const srv = await start({ trustProxy: true, limits: { maxRooms: 4 } });
    // One address, several sockets, create then leave as fast as it may.
    const churn = await Promise.all(Array.from({ length: 4 }, () => client(srv.url, from('198.51.100.7:40000'))));
    let created = 0;
    let refused = null;
    for (let i = 0; i < 30 && !refused; i++) {
      const c = churn[i % churn.length];
      const res = await c.request('room:create', {});
      if (!res.ok) refused = res;
      else {
        created++;
        await c.request('room:leave', {});
      }
    }
    expect(created).toBe(10);
    expect(refused).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryAfterSec: expect.any(Number) });
    expect(refused.retryAfterSec).toBeGreaterThan(590);
    expect(refused.retryAfterSec).toBeLessThanOrEqual(600);
    // The rooms it left behind wait out their 60 s, but do not count: other players still get every room up to the cap.
    for (let i = 1; i <= 4; i++) {
      const other = await client(srv.url, from(`203.0.113.${i}`));
      expect((await other.request('room:create', {})).ok).toBe(true);
    }
    expect(srv.stats()).toMatchObject({ rooms: 4, emptyRooms: 0 });
    const late = await client(srv.url, from('203.0.113.99'));
    expect(await late.request('room:create', {})).toMatchObject({ ok: false, code: 'SERVER_BUSY' });
  });

  it('lets one address keep at most 5 open rooms', async () => {
    const srv = await start({ trustProxy: true });
    const mine = await Promise.all(Array.from({ length: 6 }, (_, i) => client(srv.url, from(`198.51.100.8:${50000 + i}`))));
    for (const c of mine.slice(0, 5)) expect((await c.request('room:create', {})).ok).toBe(true);
    expect(await mine[5].request('room:create', {})).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryAfterSec: 60 });
    const other = await client(srv.url, from('198.51.100.9'));
    expect((await other.request('room:create', {})).ok).toBe(true);
    expect(await mine[0].request('room:leave', {})).toEqual({ ok: true });
    expect((await mine[5].request('room:create', {})).ok).toBe(true);
  });

  it('never queues more than a few snapshots for a racer who stops reading (finding 2)', async () => {
    const srv = await start({ timers: { goDelayMs: 100 }, limits: { backlogSkipPackets: 16 } });
    const { pin, host, guests: [b] } = await room(srv.url);
    const deaf = await deafPollingClient(srv.url, () => srv.stats().sockets === 3);
    await deaf.emit('room:join', { pin, name: 'Deaf' }, 1);
    await host.wait('room:update', (v) => v.racers.length === 3);
    const { raceId } = await host.request('race:start', {});
    await host.wait('room:update', (v) => v.phase === 'racing', 3000);
    // Two racers at the client rate (15 per second) for 2 s: 60 snapshots relayed to the deaf racer's seat.
    for (let i = 1; i <= 30; i++) {
      host.emit('race:state', stateFor(raceId, i / 15));
      b.emit('race:state', stateFor(raceId, i / 15));
      await delay(1000 / 15);
    }
    await host.request('clock:ping', {});
    await b.request('clock:ping', {});
    // The racers who read get every snapshot.
    await b.wait('race:state', (s) => s.raceT === 2, 3000);
    await host.wait('race:state', (s) => s.raceT === 2, 3000);
    expect(b.received('race:state')).toHaveLength(30);
    expect(host.received('race:state')).toHaveLength(30);
    const st = srv.stats();
    expect(st.statesRelayed).toBe(60);
    // The deaf one holds at most backlogSkipPackets of them; the rest were skipped for it.
    expect(st.backlogMax).toBeLessThanOrEqual(16);
    expect(st.statesSkipped).toBeGreaterThanOrEqual(60 - 16);
    expect(st.backlogDisconnects).toBe(0);
  });

  it('drops a socket that stops reading once its backlog stays over the hard cap (finding 2)', async () => {
    const srv = await start({ limits: { backlogMaxPackets: 20 }, timers: { backlogGraceMs: 300 } });
    const { pin, host, guests: [b] } = await room(srv.url);
    const deaf = await deafPollingClient(srv.url, () => srv.stats().sockets === 3);
    await deaf.emit('room:join', { pin, name: 'Deaf' }, 1);
    await host.wait('room:update', (v) => v.racers.length === 3);
    // Each rename sends every seat a room:update. The deaf seat queues them all.
    for (let i = 0; i < 25; i++) expect((await b.request('racer:update', { name: `Bo${i}` })).ok).toBe(true);
    expect(srv.stats().backlogMax).toBeGreaterThan(20);
    await delay(350);
    await b.request('racer:update', { name: 'Bo!' });
    const v = await host.wait('room:update', (r) => r.racers.length === 3 && r.racers[2].connected === false, 3000);
    expect(v.racers[2]).toMatchObject({ seat: 2, name: 'Deaf', connected: false });
    expect(srv.stats()).toMatchObject({ sockets: 2, backlogDisconnects: 1 });
    expect(srv.stats().backlogMax).toBeLessThan(20);
    // The server goes on as normal for everyone else.
    expect((await b.request('racer:update', { name: 'Bo' })).ok).toBe(true);
  });

  it('limits how often a seat moves to a new connection, and a quick reconnect tells nobody (finding 3)', async () => {
    const srv = await start();
    const { host, guests: [g], tokens } = await room(srv.url);
    let cur = g;
    let cycles = 0;
    let refused = null;
    for (let i = 0; i < 20 && !refused; i++) {
      cur.close();
      cur = await client(srv.url);
      const res = await cur.request('session:resume', { token: tokens[1] });
      if (res.ok) cycles++;
      else refused = res;
    }
    expect(cycles).toBe(5);
    expect(refused).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(refused.retryAfterSec).toBeGreaterThanOrEqual(50);
    expect(refused.retryAfterSec).toBeLessThanOrEqual(60);
    await host.request('clock:ping', {});
    // Every reconnect was back within 3 s: no disconnected or reconnected notices. Views: 2 from create and join, then
    // one per drop (6) and one per accepted resume (5).
    expect(host.received('room:notice').filter((n) => n.kind === 'disconnected' || n.kind === 'reconnected')).toEqual([]);
    expect(host.received('room:update').length).toBeLessThanOrEqual(2 + 6 + 5);
  });

  it('counts an address behind a proxy that adds the port as one address (finding 4)', async () => {
    const srv = await start({ trustProxy: true, limits: { maxSocketsPerIp: 2 } });
    await client(srv.url, from('203.0.113.5:51234'));
    await client(srv.url, from('203.0.113.5:51235'));
    expect((await connectError(srv.url, from('203.0.113.5:51236'))).message).toBe('SERVER_BUSY');
    await client(srv.url, from('[2001:db8::1]:443'));
    await client(srv.url, from('[2001:db8::2]:444'));
    expect((await connectError(srv.url, from('[2001:db8::3]:445'))).message).toBe('SERVER_BUSY');
    // Values that are not addresses share one key, so they cannot be varied for fresh limits either.
    await client(srv.url, from('garbage-1'));
    await client(srv.url, from('unknown'));
    expect((await connectError(srv.url, from('garbage-3'))).message).toBe('SERVER_BUSY');
    expect((await client(srv.url, from('203.0.113.6:1'))).socket.connected).toBe(true);
  });
});

describe('shutdown and logs', () => {
  it('tells every seat server-shutdown, closes every socket and stops within 5 s', async () => {
    const srv = await createServer({ port: 0, host: '127.0.0.1', quiet: true, gameFile: fixture.file });
    const { host, guests: [b] } = await room(srv.url);
    const idle = await client(srv.url);
    const t0 = Date.now();
    await srv.close();
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(await host.wait('room:closed')).toEqual({ reason: 'server-shutdown' });
    expect(await b.wait('room:closed')).toEqual({ reason: 'server-shutdown' });
    for (const c of [host, b, idle]) expect(await c.wait('disconnect')).toBeTruthy();
    expect(idle.received('room:closed')).toEqual([]);
    await expect(request(srv.url + '/healthz')).rejects.toThrow();
    // close() is idempotent.
    await srv.close();
  });

  it('logs JSON lines without tokens, looks or IP addresses', async () => {
    const lines = [];
    const srv = await start({ quiet: false, logLevel: 'debug', onLog: (l) => lines.push(l), timers: { goDelayMs: 50 } });
    const { host, guests: [b], tokens } = await room(srv.url);
    const { raceId } = await host.request('race:start', {});
    await host.wait('room:update', (v) => v.phase === 'racing', 3000);
    await host.request('race:finish', { raceId, raceT: 10, dist: 100, lap: 1 });
    await b.request('race:finish', { raceId, raceT: 11, dist: 100, lap: 1 });
    await b.request('room:join', { pin: '9999' });
    b.close();
    await delay(100);
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      const rec = JSON.parse(line);
      expect(typeof rec.t).toBe('string');
      expect(typeof rec.level).toBe('string');
      expect(typeof rec.msg).toBe('string');
    }
    const text = lines.join('\n');
    for (const t of tokens) expect(text).not.toContain(t);
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('#111');
    expect(text).toContain('race started');
  });

  it('reports stats', async () => {
    const srv = await start();
    await room(srv.url, 2);
    expect(srv.stats()).toMatchObject({ rooms: 1, seats: 2, sockets: 2, races: 0, roomsCreated: 1 });
    expect(srv.port).toBeGreaterThan(0);
    expect(srv.url).toBe(`http://127.0.0.1:${srv.port}`);
  });
});
