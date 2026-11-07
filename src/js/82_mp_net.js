// ───────────────────────── MULTIPLAYER NET: the friends-room connection ─────────────────────────
// Talks to the room server (server/index.mjs) over Socket.IO. Nothing here touches the network until a player opens
// Friends: the client library is fetched from the room server on first use, so solo play never loads it.
// Protocol: MULTIPLAYER_BUILD_SPEC.md section 3. Everything that arrives from the network is cleaned here before the
// lobby or the race sees it (names, bike ids, settings, and every `look`, which the server does not inspect).
const MP_SESSION_KEY = 'chapri-mp-session';
const MP_SEATS = 8, MP_MIN_RACERS = 2, MP_STATE_PER_SEC = 15;
const MP_BIKES = ['stock', 'kaali', 'chrome', 'sticker', 'cafe', 'neon', 'drag', 'raja'];
const MP_TRACKS = ['random', 'mumbai-central', 'dharavi-lanes', 'mumbai-underground', 'sion-flyover', 'crawford-market', 'bandstand-rush'];
const MP_LAPS = [1, 3, 5], MP_TIMES = ['morning', 'golden', 'night'], MP_WEATHERS = ['clear', 'monsoon'];
const MP_ERROR_TEXT = {
  BAD_REQUEST: 'The room server could not use that request. Check your name and PIN and try again.',
  BAD_PIN: 'Type the 4-digit PIN of the room.',
  NOT_FOUND: 'No room has that PIN. Check the 4 digits with your friend.',
  FULL: 'That room is full: 8 racers are in it already.',
  RACING: 'That room is in a race right now. Try again when the race ends.',
  LOCKED_OUT: 'Too many wrong PINs. Try again later.',
  NOT_HOST: 'Only the host can do that.',
  NOT_ENOUGH_RACERS: 'You need at least 2 racers to start.',
  RACE_IN_PROGRESS: 'A race is on. Settings can change when it ends.',
  ALREADY_IN_ROOM: 'You are already in a room. Leave it first.',
  NOT_IN_ROOM: 'You are not in a room any more.',
  EXPIRED: 'That room has closed.',
  RATE_LIMITED: 'Too many requests at once. Wait a moment and try again.',
  SERVER_BUSY: 'The room server is full right now. Try again in a minute.',
  SUPERSEDED: 'This room is now open in another tab or window, so this one has left it.',
  ORIGIN_DENIED: 'This page is not allowed to use the room server.',
  REFUSED: 'The room server refused the connection. Try again in a minute.',
  NETWORK:'Could not reach the room server. Check your connection and try again.',
  NO_SERVER: 'Could not reach the room server. Friends rooms work when the game is opened from the Chapri Racer room server.',
  TIMEOUT: 'The room server did not answer in time. Try again.',
  BAD_RESPONSE: 'The room server sent something this game does not understand. Reload the page and try again.',
  UNKNOWN: 'Something went wrong with the room server. Try again.',
};

// Same rule as the server: control and direction-override characters removed, spaces collapsed, trimmed, 1 to 16
// characters counted as code points (an emoji is never cut in half), default Rider.
function mpCleanName(v) {
  let s = String(v ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\u061c\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(s);
  if (chars.length > 16) s = chars.slice(0, 16).join('').trim();
  return s || 'Rider';
}
const mpBike = (id) => (MP_BIKES.includes(id) ? id : 'stock');
const mpPin = (v) => { const s = typeof v === 'number' && Number.isInteger(v) ? String(v).padStart(4, '0') : String(v ?? ''); return /^\d{4}$/.test(s) ? s : ''; };

// ── look sanitizer: a remote racer's look only ever reaches BikeRig through here ──
// The keys are the ones lookFromSave() produces. Anything else (render flags such as lod or ghost included) is dropped.
const MP_HEX = /^#[0-9a-f]{6}$/i;
const MP_HAIR = ['pomp', 'quiff', 'long', 'buzz', 'afro'];
function mpDefaultLook(bike) {
  const b = BUILDS.find(x => x.id === bike) || BUILDS[0];
  const shirt = COSMETICS.shirt[0], hair = COSMETICS.hair[0], shades = COSMETICS.shades[0];
  return { tank: b.tank, accent: b.accent, chrome: !!b.chrome, neon: !!b.neon, stickers: !!b.stickers, shirt: shirt.base, flowers: !!shirt.flowers, check: !!shirt.check,
    helmet: null, shades: shades.color || null, shadesStyle: shades.style || null, hair: hair.style, hairColor: hair.color, goldChain: true, watch: true, stubble: true, jeans: '#1f2a4a',
    mods: { exhaust: 'stock', tyres: 'stock', kit: 'none', finish: b.chrome ? 'chrome' : 'gloss' } };
}
function mpSanitizeLook(look, bike) {
  const d = mpDefaultLook(bike);
  if (!look || typeof look !== 'object' || Array.isArray(look)) return d;
  // lookFromSave() writes `shades: undefined` for No shades and `flowers: undefined` for a plain shirt. JSON drops
  // such keys on the way to the server, so the local copy must read them the same way: as missing, never as bad values.
  const has = (k) => Object.prototype.hasOwnProperty.call(look, k) && look[k] !== undefined;
  const out = {};
  for (const k of ['tank', 'accent', 'shirt', 'hairColor', 'jeans']) out[k] = has(k) && typeof look[k] === 'string' && MP_HEX.test(look[k]) ? look[k] : d[k];
  // no helmet and no shades are real choices, sent as a missing key
  for (const k of ['helmet', 'shades']) out[k] = !has(k) || look[k] === null ? null : typeof look[k] === 'string' && MP_HEX.test(look[k]) ? look[k] : d[k];
  // lookFromSave() leaves a flag out when it is off, so a missing flag means false
  for (const k of ['chrome', 'neon', 'stickers', 'flowers', 'check', 'goldChain', 'watch', 'stubble']) out[k] = !has(k) ? false : typeof look[k] === 'boolean' ? look[k] : d[k];
  out.shadesStyle = has('shadesStyle') && look.shadesStyle === 'aviator' ? 'aviator' : null;
  out.hair = has('hair') && MP_HAIR.includes(look.hair) ? look.hair : d.hair;
  const m = has('mods') && look.mods && typeof look.mods === 'object' && !Array.isArray(look.mods) ? look.mods : {};
  out.mods = {};
  for (const slot of Object.keys(MODS)) {
    const v = Object.prototype.hasOwnProperty.call(m, slot) ? m[slot] : undefined;
    out.mods[slot] = MODS[slot].items.some(it => it.id === v) ? v : d.mods[slot];
  }
  return out;
}

// ── incoming payloads ──
function mpRoomView(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.racers)) return null;
  const st = v.settings && typeof v.settings === 'object' ? v.settings : {};
  const racers = v.racers.filter(r => r && typeof r === 'object' && Number.isInteger(r.seat)).slice(0, MP_SEATS)
    .map(r => ({ seat: r.seat, name: mpCleanName(r.name), bike: mpBike(r.bike), look: mpSanitizeLook(r.look, r.bike), host: r.host === true, connected: r.connected !== false }))
    .sort((a, b) => a.seat - b.seat);
  return {
    pin: mpPin(v.pin), phase: ['lobby', 'countdown', 'racing'].includes(v.phase) ? v.phase : 'lobby',
    you: Number.isInteger(v.you) ? v.you : null, raceId: Number.isFinite(v.raceId) ? v.raceId : null, hostSeat: Number.isInteger(v.hostSeat) ? v.hostSeat : null,
    settings: { track: MP_TRACKS.includes(st.track) ? st.track : 'random', laps: MP_LAPS.includes(st.laps) ? st.laps : 3, time: MP_TIMES.includes(st.time) ? st.time : 'morning', weather: MP_WEATHERS.includes(st.weather) ? st.weather : 'clear' },
    racers,
  };
}
function mpBegin(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.racers) || !Number.isFinite(b.goAt)) return null;
  return Object.assign({}, b, {
    seed: (Number(b.seed) >>> 0), goAt: b.goAt,
    track: TRACKS.some(t => t.id === b.track) ? b.track : 'mumbai-central', laps: MP_LAPS.includes(b.laps) ? b.laps : 3,
    time: MP_TIMES.includes(b.time) ? b.time : 'morning', weather: MP_WEATHERS.includes(b.weather) ? b.weather : 'clear',
    racers: b.racers.filter(r => r && typeof r === 'object' && Number.isInteger(r.seat)).slice(0, MP_SEATS)
      .map(r => ({ seat: r.seat, name: mpCleanName(r.name), bike: mpBike(r.bike), look: mpSanitizeLook(r.look, r.bike) })).sort((a, b2) => a.seat - b2.seat),
  });
}
function mpResults(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.order)) return null;
  return Object.assign({}, r, { order: r.order.filter(o => o && typeof o === 'object' && Number.isInteger(o.seat)).map(o => Object.assign({}, o, { name: mpCleanName(o.name), bike: mpBike(o.bike) })) });
}
// A timeout that counts only time the page could run. After a long stall (a slow phone drawing its first frame) the
// event we wait for is often queued right behind the timer, so a plain setTimeout would give up on an answer that has
// already arrived. Each one-second tick counts for at most 1.5 s, however long the page was stuck.
function mpPatientTimer(ms, fn) {
  let left = ms, last = Date.now(), id = 0;
  const tick = () => { const now = Date.now(); left -= Math.min(now - last, 1500); last = now; if (left <= 0) fn(); else id = setTimeout(tick, 1000); };
  id = setTimeout(tick, 1000);
  return { cancel: () => clearTimeout(id) };
}
// A handshake the server refuses (engine.io allowRequest: origin not allowed, server full or shutting down) reaches
// the client as an HTTP 403 transport error, not as a socket.io error with a code, and socket.io would keep retrying
// it. Over long-polling the reason is in the response body; without a readable body it is still a refusal.
function mpRefusal(err) {
  if (!err || err.type !== 'TransportError') return null;
  try {
    const xhr = err.context && typeof err.context === 'object' ? err.context : null;
    const status = typeof err.description === 'number' ? err.description : xhr && typeof xhr.status === 'number' ? xhr.status : 0;
    if (status !== 403) return null;
    let code = '';
    try { const body = JSON.parse(xhr && typeof xhr.responseText === 'string' ? xhr.responseText : 'null'); code = body && typeof body.message === 'string' ? body.message : ''; } catch (e) { code = ''; }
    return code === 'ORIGIN_DENIED' || code === 'SERVER_BUSY' ? code : 'REFUSED';
  } catch (e) { return null; }
}
// For each ack, how many room:update events had been applied when it arrived. An ack's room view is older than any
// update that arrives after it; over long-polling both come in one batch and the ack's promise resumes last.
const mpAckSeq = new WeakMap();
// The race:state keys and ranges the server accepts. sendState() rebuilds every snapshot from this list, so a stray key
// or an out-of-range number never gets the whole packet dropped by the server.
const MP_STATE_NUM = { raceT: [0, 3600], dist: [0, 1e6], s: [0, 1e6], d: [-60, 60], y: [-20, 200], psi: [-20, 20], v: [-10, 150], lean: [-3, 3], pitch: [-3, 3], boost: [0, 100] };

const MP = {
  status: 'offline', room: null, seat: null, clockOffset: 0, rtt: null, lastError: null,
  socket: null, _libP: null, _connP: null, _ready: false, _leaving: false, _listeners: {}, _sent: [], _mem: null, _idleT: 0, _giveUpT: 0, _heldBegin: null,
  _roomSeq: 0, lastBegin: null,

  isHost() { return !!this.room && this.seat !== null && this.room.hostSeat === this.seat; },
  serverNow() { return Date.now() + this.clockOffset; },
  on(ev, fn) { (this._listeners[ev] || (this._listeners[ev] = [])).push(fn); return fn; },
  off(ev, fn) { const L = this._listeners[ev]; if (!L) return; const i = L.indexOf(fn); if (i >= 0) L.splice(i, 1); },
  _emit(ev, data) { for (const fn of (this._listeners[ev] || []).slice()) { try { fn(data); } catch (e) { console.error('multiplayer listener failed:', ev, e); } } },
  _setStatus(s) { if (s === this.status) return; this.status = s; this._emit('status', s); },

  errorText(code, ack) {
    if (code === 'LOCKED_OUT') { const sec = Number(ack && ack.retryAfterSec); if (Number.isFinite(sec) && sec > 0) { const m = Math.ceil(sec / 60); return `Too many wrong PINs. Try again in ${m} minute${m > 1 ? 's' : ''}.`; } }
    if (code === 'RATE_LIMITED') {
      // the server says how long: a room budget can be 10 minutes, a burst a few seconds
      const sec = Number(ack && ack.retryAfterSec);
      if (Number.isFinite(sec) && sec > 0) {
        const minutes = sec >= 120;
        const n = minutes ? Math.ceil(sec / 60) : Math.ceil(sec);
        return `Too many requests in a short time. Try again in ${n} ${minutes ? 'minute' : 'second'}${n === 1 ? '' : 's'}.`;
      }
    }
    if (MP_ERROR_TEXT[code]) return MP_ERROR_TEXT[code];
    return ack && typeof ack.message === 'string' && ack.message && ack.message.length < 160 ? ack.message : MP_ERROR_TEXT.UNKNOWN;
  },
  _fail(code, message) { return { ok: false, code, message: message || this.errorText(code) }; },
  _readable(ack) { const code = (ack && ack.code) || 'UNKNOWN'; const out = { ok: false, code, message: this.errorText(code, ack) }; if (ack && ack.retryAfterSec !== undefined) out.retryAfterSec = ack.retryAfterSec; this.lastError = out; return out; },

  // ── the seat token lives in sessionStorage (per tab), so a reload rejoins the same seat; memory is the fallback ──
  session() {
    let s = null;
    try { const raw = sessionStorage.getItem(MP_SESSION_KEY); if (raw) s = JSON.parse(raw); } catch (e) { s = null; }
    if (!s) s = this._mem;
    return s && typeof s.token === 'string' && /^[0-9a-f]{16,128}$/i.test(s.token) && mpPin(s.pin) ? { token: s.token, pin: mpPin(s.pin) } : null;
  },
  _saveSession(token, pin) { this._mem = { token, pin }; try { sessionStorage.setItem(MP_SESSION_KEY, JSON.stringify({ token, pin })); } catch (e) { /* memory copy only */ } },
  clearSession() { this._mem = null; try { sessionStorage.removeItem(MP_SESSION_KEY); } catch (e) { /* nothing stored */ } },

  // ── connection ──
  ensureConnected() {
    if (this._ready && this.socket && this.socket.connected) return Promise.resolve();
    if (!this._connP) this._connP = this._connect().finally(() => { this._connP = null; });
    return this._connP;
  },
  async _connect() {
    clearTimeout(this._idleT);
    if (this._ready && this.status === 'reconnecting') {   // socket.io is already reconnecting on its own
      if (await this._waitStatus('online', 30000)) return;
      throw new Error(this.errorText('NETWORK'));
    }
    this._setStatus('connecting');
    try {
      const io = await this._loadLib();
      if (!this.socket) this._makeSocket(io); else if (!this.socket.connected) this.socket.connect();
      await this._waitConnect(30000);   // generous: a slow phone on a bad network, or a page busy building the scene
      await this._syncClock();
      this._ready = true;
      this._setStatus('online');
    } catch (e) {
      if (this.socket) this.socket.disconnect();   // stops socket.io from retrying in the background
      this._ready = false;
      this._setStatus('offline');
      throw e instanceof Error ? e : new Error(this.errorText('NETWORK'));
    }
  },
  _loadLib() {
    if (typeof window.io === 'function') return Promise.resolve(window.io);
    if (this._libP) return this._libP;
    if (location.protocol === 'file:') return Promise.reject(new Error(this.errorText('NO_SERVER')));
    this._libP = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      const fail = () => { t.cancel(); el.remove(); this._libP = null; reject(new Error(this.errorText('NO_SERVER'))); };
      const t = mpPatientTimer(30000, () => { if (typeof window.io === 'function') resolve(window.io); else fail(); });
      el.onload = () => { t.cancel(); if (typeof window.io === 'function') resolve(window.io); else fail(); };
      el.onerror = fail;
      el.async = true; el.src = '/socket.io/socket.io.js';
      document.head.appendChild(el);
    });
    return this._libP;
  },
  _makeSocket(io) {
    // websocket first; tryAllTransports falls back to long-polling where a proxy blocks websockets
    const s = this.socket = io({ transports: ['websocket', 'polling'], tryAllTransports: true, reconnectionDelay: 700, reconnectionDelayMax: 5000, timeout: 20000 });
    s.on('connect', () => { if (this._ready) this._afterReconnect(); });
    s.on('disconnect', (reason) => this._onDisconnect(reason));
    s.on('room:update', (v) => this._onRoom(v, true));
    s.on('room:notice', (n) => { if (this._leaving || !n || typeof n !== 'object' || typeof n.kind !== 'string') return; this._emit('notice', { kind: n.kind, name: n.name == null ? undefined : mpCleanName(n.name) }); });
    // On a reload mid-race, race:begin comes straight after the session:resume ack. When both arrive in one batch they
    // are handled before the ack's promise sets this.seat, and the race glue needs the seat: hold it for the room view.
    s.on('race:begin', (b) => { if (this._leaving) return; const v = mpBegin(b); if (!v) return; if (this.seat === null) { this._heldBegin = v; return; } this._emitBegin(v); });
    s.on('race:state', (st) => { if (!this._leaving && st && typeof st === 'object' && Number.isInteger(st.seat)) this._emit('state', st); });
    s.on('race:results', (r) => { if (this._leaving) return; const v = mpResults(r); if (v) this._emit('results', v); });
    s.on('room:closed', (c) => this._onClosed(c));
    s.on('error', (e) => this._onServerError(e));
  },
  _waitConnect(ms) {
    const s = this.socket;
    if (s.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = (err) => { t.cancel(); s.off('connect', ok); s.off('connect_error', bad); if (err) reject(err); else resolve(); };
      const ok = () => done();
      // a refusal from the server (a known code, or a middleware error that socket.io will not retry) fails at once;
      // transport errors are retried by socket.io until the timeout
      const bad = (err) => {
        const refused = mpRefusal(err);
        if (refused) { done(new Error(this.errorText(refused))); return; }
        const c = (err && err.data && err.data.code) || (err && err.message);
        if (MP_ERROR_TEXT[c] || !s.active) done(new Error(this.errorText(MP_ERROR_TEXT[c] ? c : 'NETWORK')));
      };
      const t = mpPatientTimer(ms, () => done(s.connected ? null : new Error(this.errorText('NETWORK'))));
      s.on('connect', ok); s.on('connect_error', bad);
    });
  },
  // five clock:ping round trips; the one with the smallest round trip sets the offset
  async _syncClock() {
    let best = null;
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now(); const ack = await this._ack('clock:ping', {}, 4000); const t1 = Date.now();
      if (!ack.ok || !Number.isFinite(ack.serverNow)) { if (ack.code === 'TIMEOUT') break; continue; }
      const rtt = t1 - t0; if (!best || rtt < best.rtt) best = { rtt, offset: ack.serverNow + rtt / 2 - t1 };
    }
    if (best) { this.clockOffset = best.offset; this.rtt = best.rtt; }
  },
  _waitStatus(want, ms) {
    if (this.status === want) return Promise.resolve(true);
    if (this.status === 'offline') return Promise.resolve(false);
    return new Promise((resolve) => {
      const fn = (s) => { if (s === want || s === 'offline') done(s === want); };
      const done = (v) => { t.cancel(); this.off('status', fn); resolve(v); };
      const t = mpPatientTimer(ms, () => done(false));
      this.on('status', fn);
    });
  },
  _ack(event, data, ms = 15000) {
    const s = this.socket;
    if (!s) return Promise.resolve(this._fail('NETWORK'));
    return new Promise((resolve) => {
      let settled = false;
      const t = mpPatientTimer(ms, () => { if (!settled) { settled = true; resolve(this._fail('TIMEOUT')); } });
      s.emit(event, data, (ack) => {
        if (settled) return;   // answered after we gave up: too late to use
        settled = true; t.cancel();
        if (ack && typeof ack === 'object') { mpAckSeq.set(ack, this._roomSeq); resolve(ack); } else resolve(this._fail('BAD_RESPONSE'));
      });
    });
  },
  async _request(event, data, ms = 15000) {
    if (!this.room) return this._readable({ code: 'NOT_IN_ROOM' });
    if (this.status !== 'online' && !(await this._waitStatus('online', 20000))) return this._readable({ code: 'NETWORK' });
    const ack = await this._ack(event, data, ms);
    if (!ack.ok) return this._readable(ack);
    this._ackRoom(ack);
    return ack;
  },
  // The room view inside an ack, unless a room:update arrived after that ack: that update is newer and already applied.
  _ackRoom(ack) {
    if (!ack || !ack.room) return;
    const seq = mpAckSeq.get(ack);
    if (seq !== undefined && seq !== this._roomSeq) return;
    this._onRoom(ack.room);
  },
  _onRoom(v, live = false) {
    if (this._leaving) return;
    const r = mpRoomView(v); if (!r) return;
    if (live) this._roomSeq++;
    this.room = r; if (r.you !== null) this.seat = r.you;
    this._emit('room', r);
    const held = this._heldBegin;
    if (held && this.seat !== null) { this._heldBegin = null; if (r.raceId === held.raceId && r.phase !== 'lobby') this._emitBegin(held); }
  },
  // the lobby reads the last race:begin when a race takes over (the bike this seat races on)
  _emitBegin(v) { this.lastBegin = v; this._emit('begin', v); },
  _onDisconnect(reason) {
    this._sent.length = 0;
    if (reason === 'io client disconnect') { this._ready = false; this._setStatus('offline'); return; }
    if (reason === 'io server disconnect') {   // closed by the server on purpose (another tab took the seat, rate limit); socket.io does not retry
      this._ready = false; this.room = null; this.seat = null; this._setStatus('offline'); return;
    }
    if (!this._ready) return;
    this._setStatus('reconnecting');   // socket.io reconnects by itself; 'connect' then resumes the seat
    // The server holds a seat for 60 s. Past 90 s without a connection the seat is gone whatever happens next, so stop
    // retrying (and filling the console) and let the page go back to the menu.
    clearTimeout(this._giveUpT);
    this._giveUpT = setTimeout(() => {
      if (this.status !== 'reconnecting') return;
      this.lastError = this._fail('NETWORK');
      this.clearSession(); this.room = null; this.seat = null;
      this.disconnect();
    }, 90000);
  },
  async _afterReconnect(attempt = 0) {
    const s = this.session();
    if (!s) { await this._syncClock(); if (this.socket && this.socket.connected) this._setStatus('online'); return; }
    // resume first: during a race the server re-sends race:begin straight after this ack
    const ack = await this._ack('session:resume', { token: s.token });
    if (ack.ok) {
      if (Number.isInteger(ack.seat)) this.seat = ack.seat;
      this._ackRoom(ack); this._setStatus('online'); this._syncClock();
      return;
    }
    if (ack.code === 'TIMEOUT' || ack.code === 'RATE_LIMITED' || ack.code === 'SERVER_BUSY') {
      // a dropped socket gets a fresh 'connect' (and a fresh try) from socket.io; a live one tries a few more times
      if (!this.socket || !this.socket.connected) return;
      // RATE_LIMITED says when this seat may be resumed again (retryAfterSec): wait that long, not a guess
      const sec = Number(ack.retryAfterSec);
      const wait = ack.code === 'RATE_LIMITED' && Number.isFinite(sec) && sec > 0 ? Math.min(sec, 60) * 1000 + 250 : 1500;
      if (attempt < 3) { setTimeout(() => { if (this.socket && this.socket.connected && this.status === 'reconnecting') this._afterReconnect(attempt + 1); }, wait); return; }
      this._readable(ack); this.room = null; this.seat = null; this.disconnect();   // the session stays: Friends tries again
      return;
    }
    this._readable(ack);
    this._roomGone({ reason: 'expired' });
  },
  _roomGone(payload) {
    this.clearSession(); this.room = null; this.seat = null; this.lastBegin = null;
    this._emit('closed', payload);
    this.disconnect();
  },
  _onClosed(c) { if (this._leaving) return; this._roomGone({ reason: c && ['empty', 'expired', 'server-shutdown'].includes(c.reason) ? c.reason : 'expired' }); },
  _onServerError(e) {
    const code = e && typeof e.code === 'string' ? e.code : 'UNKNOWN';
    const err = { code, message: this.errorText(code, e) };
    this.lastError = err;
    if (code === 'SUPERSEDED') { this.clearSession(); this.room = null; this.seat = null; }
    this._emit('error', err);
  },
  disconnect() { clearTimeout(this._idleT); this._ready = false; if (this.socket) this.socket.disconnect(); this._setStatus('offline'); },
  // a socket that is not in a room is dropped after a while, so a closed Friends dialog does not hold a connection open
  _idle() { clearTimeout(this._idleT); this._idleT = setTimeout(() => { if (!this.room && !this.session() && !this._connP) this.disconnect(); }, 120000); },

  // ── rooms ──
  create({ name, bike, look } = {}) { return this._enterRoom('room:create', { name: mpCleanName(name), bike: mpBike(bike), look: mpSanitizeLook(look, bike) }); },
  join({ pin, name, bike, look } = {}) {
    const p = mpPin(String(pin ?? '').replace(/\D/g, ''));
    if (!p) return Promise.resolve(this._fail('BAD_PIN'));
    return this._enterRoom('room:join', { pin: p, name: mpCleanName(name), bike: mpBike(bike), look: mpSanitizeLook(look, bike) });
  },
  async _enterRoom(event, data) {
    this._leaving = false; clearTimeout(this._idleT);
    try { await this.ensureConnected(); } catch (e) { this.lastError = this._fail('NETWORK', e.message); return this.lastError; }
    // One room per tab: a seat this socket holds is let go first. A session it has not taken back (an invite link to
    // another room, or a resume that failed) is kept until the new seat is confirmed, so a failed join still leaves the
    // way back to it; the server frees that old seat when its grace period runs out.
    if (this.room) {
      this.clearSession(); this.room = null; this.seat = null; this.lastBegin = null;
      await this._ack('room:leave', {}, 3000);
    }
    let ack = await this._ack(event, data);
    // a create or join whose answer was lost may still have seated this socket: let go of that seat
    if (!ack.ok && ack.code === 'ALREADY_IN_ROOM') { await this._ack('room:leave', {}, 5000); ack = await this._ack(event, data); }
    if (!ack.ok) {
      if (ack.code === 'TIMEOUT' && this.socket) this.socket.emit('room:leave', {}, () => {});
      this._idle();
      return this._readable(ack);
    }
    const pin = mpPin(ack.pin) || mpPin(ack.room && ack.room.pin) || data.pin || '';
    if (typeof ack.token === 'string') this._saveSession(ack.token, pin);
    else this.clearSession();   // never keep an old room's token beside a new seat
    if (Number.isInteger(ack.seat)) this.seat = ack.seat;
    this._ackRoom(ack);
    if (!this.room) return this._readable({ code: 'BAD_RESPONSE' });
    this._setStatus('online');
    const { token, ...rest } = ack;   // the token stays in the session store only
    return Object.assign(rest, { pin, room: this.room, seat: this.seat });
  },
  async resume() {
    const s = this.session(); if (!s) return false;
    this._leaving = false;
    try { await this.ensureConnected(); } catch (e) { this.lastError = this._fail('NETWORK', e.message); return false; }
    if (this.room && this.room.pin === s.pin) return true;   // the reconnect handler already took the seat back
    const ack = await this._ack('session:resume', { token: s.token });
    if (ack.ok) {
      if (Number.isInteger(ack.seat)) this.seat = ack.seat;
      this._ackRoom(ack);
      if (this.room) { this._setStatus('online'); return true; }
      this._readable({ code: 'BAD_RESPONSE' });
      return false;
    }
    this._readable(ack);
    if (!['TIMEOUT', 'NETWORK', 'RATE_LIMITED', 'SERVER_BUSY'].includes(ack.code)) { this.clearSession(); this.room = null; this.seat = null; this._idle(); }
    return false;
  },
  async leave() {
    const inRoom = !!(this.room || this.session());
    this._leaving = true; this.clearSession(); this.room = null; this.seat = null; this.lastBegin = null; this._sent.length = 0;
    if (inRoom && this.socket && this.socket.connected) await this._ack('room:leave', {}, 3000);
    if (this._leaving) this.disconnect();   // unless a new create or join started meanwhile
    return { ok: true };
  },
  setSettings(patch = {}) {
    const p = {};
    if (MP_TRACKS.includes(patch.track)) p.track = patch.track;
    if (MP_LAPS.includes(Number(patch.laps))) p.laps = Number(patch.laps);
    if (MP_TIMES.includes(patch.time)) p.time = patch.time;
    if (MP_WEATHERS.includes(patch.weather)) p.weather = patch.weather;
    if (!Object.keys(p).length) return Promise.resolve(this._fail('BAD_REQUEST'));
    return this._request('room:settings', p);
  },
  updateRacer(patch = {}) {
    const p = {};
    if (patch.name !== undefined) p.name = mpCleanName(patch.name);
    if (patch.bike !== undefined) p.bike = mpBike(patch.bike);
    if (patch.look !== undefined) p.look = mpSanitizeLook(patch.look, p.bike || patch.bike);
    if (!Object.keys(p).length) return Promise.resolve(this._fail('BAD_REQUEST'));
    return this._request('racer:update', p);
  },
  startRace() { return this._request('race:start', {}); },
  // fire and forget: at most 15 snapshots in any second, and none while reconnecting
  sendState(snap) {
    const s = this.socket;
    if (!snap || !s || !s.connected || this.status !== 'online' || !this.room) return false;
    if (!Number.isInteger(snap.raceId) || !Number.isFinite(snap.raceT)) return false;
    const now = performance.now(), q = this._sent;
    while (q.length && now - q[0] >= 1000) q.shift();
    if (q.length >= MP_STATE_PER_SEC || (q.length && now - q[q.length - 1] < 45)) return false;
    const out = { raceId: snap.raceId };
    for (const [k, [a, b]] of Object.entries(MP_STATE_NUM)) { const v = Number(snap[k]); out[k] = Number.isFinite(v) ? clamp(v, a, b) : a < 0 ? 0 : a; }
    out.lap = clamp(Math.round(Number(snap.lap) || 0), -1, 200);
    out.crashed = !!snap.crashed; out.finished = !!snap.finished;
    q.push(now);
    s.volatile.emit('race:state', out);
    return true;
  },
  async finish({ raceId, raceT, dist, lap } = {}) {
    const data = { raceId, raceT: clamp(Number(raceT) || 0, 0, 3600), dist: clamp(Number(dist) || 0, 0, 1e6), lap: clamp(Math.round(Number(lap) || 0), -1, 200) };
    let ack = await this._request('race:finish', data);
    if (!ack.ok && (ack.code === 'TIMEOUT' || ack.code === 'NETWORK') && this.room) ack = await this._request('race:finish', data);   // the first ack can be lost in a reconnect
    return ack;
  },
  sanitizeLook: mpSanitizeLook,
  cleanName: mpCleanName,
};
if (typeof window !== 'undefined') window.__mp = MP;
