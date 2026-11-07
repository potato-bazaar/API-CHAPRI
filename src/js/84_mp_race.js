// ───────────────────────── MULTIPLAYER RACE: friends races on top of the solo Race ─────────────────────────
// The room server owns GO, the seed and the final order; every device runs the solo physics for its own bike only
// (MULTIPLAYER_BUILD_SPEC.md A1 to A4). This file is the glue: it turns race:begin into a Race, sends the local bike's
// snapshot 15 times a second, buffers the other racers' snapshots and draws them as ghost bikes about 100 ms behind
// real time, reports the finish, and shows the server's standings on the results screen.
// Every network payload is checked here before the race sees it. Names only ever reach the page through textContent.

// The friends mode. Not enumerable, so the solo Race Setup (which lists Object.entries(MODES)) never offers it.
Object.defineProperty(MODES, 'friends', {
  value: { label: 'Friends race', desc: 'Up to 8 friends, each on their own phone or computer · no AI rivals, no combat', rivals: false, combat: false, laps: true, mp: true },
  enumerable: false, writable: false, configurable: true,
});

const MP_GHOST_DELAY = 0.1;       // ghosts are drawn this far behind real time, more when packets arrive late
const MP_GHOST_DELAY_MAX = 1;     // a slow device sends a snapshot a frame, so maybe 2 a second: its ghost is drawn later, smoothly
const MP_EXTRAPOLATE_MAX = 0.25;  // a late packet: carry the ghost forward this long at most, then hold it
const MP_GHOST_BUFFER = 48;
const MP_RESULTS_WAIT_MS = 60000; // after the local finish, the local standings show if the server has not answered by then
const MP_FINISH_RETRY_MS = 4000;  // an unanswered finish report goes out again this often while the connection is up
const MP_FINISH_KEY = 'chapri-mp-finish';   // sessionStorage: the race this tab finished, until its results are paid
const MP_SNAPSHOTS_PER_SEC = 15;
// race:state numbers and their protocol ranges (spec section 3)
const MP_SNAPSHOT_RANGE = { raceT: [0, 3600], dist: [0, 1e6], s: [0, 1e6], d: [-60, 60], y: [-20, 200], psi: [-20, 20], v: [-10, 150], lean: [-3, 3], pitch: [-3, 3], boost: [0, 100] };

const MPRACE = {
  game: null, timers: new Set(), pendingRace: null, lastResults: null, done: null, viewRaceId: null,
  leaving: false, starting: false, view: null, viewOn: false, viewWhy: '', pauseView: false,

  init(game) {
    if (this.game) return;
    this.game = game;
    MP.on('begin', (b) => this.onBegin(b));
    MP.on('state', (st) => this.onState(st));
    MP.on('results', (r) => this.onResults(r));
    MP.on('closed', () => this.onClosed());
    MP.on('status', (s) => this.onStatus(s));
    MP.on('room', () => this.onRoom());
    this.restoreFinish();
    if (typeof window !== 'undefined') window.__mprace = MPRACE;
  },

  // per-race timers, all released together
  later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, Math.max(0, ms)); this.timers.add(id); return id; },
  clearTimers() { for (const id of this.timers) clearTimeout(id); this.timers.clear(); },
  note(text) { if (typeof MPUI !== 'undefined') MPUI.note(text); else if (this.game && this.game.ui) this.game.ui.flashNote(text); },
  mpRace() { const R = this.game && this.game.race; return R && R.mp ? R : null; },

  // ── race:begin ──
  onBegin(b) {
    const g = this.game; if (!g || !g.scene || g.state === 'loading') return;
    const R = g.race;
    if (R && R.mp && R.mp.raceId === b.raceId) return;   // sent again after a reconnect: this race is already on
    if (this.hasFinished(b)) return;   // sent again after a reconnect or a reload: this tab has crossed the line in it already
    if (R && !R.mp && (g.state === 'race' || g.state === 'paused' || g.entry)) {   // a solo race is on: it is left alone
      this.note('Your room started a race. Finish this one, then open Friends for the next.');
      return;
    }
    this.startRace(b);
  },
  // game.startMultiplayerRace(begin): hides the lobby and menus, builds the friends Race and starts its countdown at goAt
  startRace(b) {
    const g = this.game, seat = MP.seat;
    if (!g || !b || !Array.isArray(b.racers) || !Number.isInteger(seat) || !b.racers.some(r => r.seat === seat)) return false;
    if (!Number.isFinite(b.goAt) || !TRACKS.some(t => t.id === b.track) || this.hasFinished(b)) return false;
    // a new race: the one before it has had its results (or they were missed), so no reward waits any more
    this.clearTimers(); this.endView(); this.dropPending(); this.starting = false;
    if (typeof MPUI !== 'undefined') MPUI.hideLobby();
    const setup = {
      mode: 'friends', track: b.track, laps: b.laps, time: b.time, weather: b.weather, diff: 'normal', combat: false, seed: b.seed >>> 0,
      mp: { raceId: b.raceId, goAt: b.goAt, seat, racers: b.racers.map(r => ({ seat: r.seat, name: r.name, bike: r.bike, look: r.look })) },
    };
    g.cup = null;
    g.startRace(setup, null);
    const R = g.race;
    if (!R || !R.mp) return false;
    // GO on a timer as well as on the frame, so a slow frame rate does not make this device's GO late
    const wait = b.goAt - MP.serverNow();
    if (wait > 0) this.later(() => { if (g.race === R) R.mpGo(); }, wait);
    return true;
  },

  // ── snapshots out: the local bike, from the game's own loop, at most 15 a second ──
  sendSnapshot(R) {
    const now = performance.now(), M = R.mp;
    if (now - M.sentAt < 1000 / MP_SNAPSHOTS_PER_SEC - 2) return;
    const P = R.player;
    if (MP.sendState({ raceId: M.raceId, raceT: R.raceT, dist: P.dist, s: P.s, d: P.d, y: P.y, psi: P.psi, v: P.v, lean: P.lean, pitch: P.pitch, lap: P.lap, boost: P.boost, crashed: P.crashed, finished: P.finished })) M.sentAt = now;
  },

  // ── snapshots in ──
  // Numbers outside the protocol ranges, or not numbers at all, drop the packet. The protocol keeps dist >= 0, so a
  // bike still behind the start line arrives with dist 0: its real place comes from s.
  cleanState(st, L) {
    const out = {};
    for (const [k, [a, b]] of Object.entries(MP_SNAPSHOT_RANGE)) { const v = st[k]; if (typeof v !== 'number' || !Number.isFinite(v)) return null; out[k] = clamp(v, a, b); }
    out.lap = Number.isInteger(st.lap) ? clamp(st.lap, -1, 200) : 0;
    out.crashed = st.crashed === true; out.finished = st.finished === true;
    out.s %= L; out.psi = wrapAngle(out.psi);
    if (!(out.dist > 0)) out.dist = out.s > L / 2 ? out.s - L : out.s;
    return out;
  },
  onState(st) {
    const R = this.mpRace(); if (!R || R.mpOver || !st || st.raceId !== R.mp.raceId || st.seat === R.mp.seat) return;
    const g = R.riders.find(r => r.net && r.net.seat === st.seat); if (!g || g.net.gone) return;
    const snap = this.cleanState(st, R.track.L); if (!snap) return;
    const N = g.net, buf = N.buf, last = buf[buf.length - 1];
    if (last && snap.raceT <= last.raceT) return;   // late or repeated
    // how far behind the local clock snapshots arrive (network delay plus clock error): the drawing delay follows it
    const lag = R.raceT - snap.raceT; N.lag = N.lag === undefined ? lag : N.lag + (lag - N.lag) * 0.1;
    if (snap.finished && N.finishT === null) {
      // the finish time: where the bike crossed the line between the last two snapshots
      const line = R.laps * R.track.L;
      N.finishT = last && !last.finished && last.dist < line && snap.dist > last.dist ? last.raceT + (line - last.dist) / (snap.dist - last.dist) * (snap.raceT - last.raceT) : snap.raceT;
    }
    if (last) {   // a respawn or a rejoin moves the bike at once: snap to the new spot instead of sliding there
      const dt = snap.raceT - last.raceT;
      N.gap = N.gap === undefined ? dt : N.gap + (Math.min(dt, 1) - N.gap) * 0.2;   // a slow device sends less often
      if (Math.abs(snap.dist - (last.dist + last.v * dt)) > 8 + 5 * dt * dt) buf.length = 0;
    }
    buf.push(snap); if (buf.length > MP_GHOST_BUFFER) buf.splice(0, buf.length - MP_GHOST_BUFFER);
  },
  // Each frame: every ghost at (race clock - delay), between the two snapshots around that moment.
  placeGhosts(R) {
    for (const g of R.riders) {
      const N = g.net; if (!N || N.gone || !N.buf.length) continue;
      // late enough that the next snapshot is usually already here: arrival lag plus the sender's interval
      N.delay = clamp((N.lag || 0) + Math.max(N.gap || 0, 1 / MP_SNAPSHOTS_PER_SEC) + 0.02, MP_GHOST_DELAY, MP_GHOST_DELAY_MAX);
      const buf = N.buf, t = R.raceT - N.delay;
      let i = 0; while (i < buf.length - 1 && buf[i + 1].raceT <= t) i++;
      if (i > 0) { buf.splice(0, i); i = 0; }   // older snapshots are never drawn again
      const a = buf[i], b = buf[i + 1];
      let out;
      if (b && t >= a.raceT) {
        const span = b.raceT - a.raceT, f = clamp((t - a.raceT) / span, 0, 1);
        out = { dist: lerp(a.dist, b.dist, f), d: lerp(a.d, b.d, f), y: lerp(a.y, b.y, f), psi: a.psi + wrapAngle(b.psi - a.psi) * f, v: lerp(a.v, b.v, f),
          lean: lerp(a.lean, b.lean, f), pitch: lerp(a.pitch, b.pitch, f), boost: lerp(a.boost, b.boost, f), lap: f < 1 ? a.lap : b.lap, crashed: f < 1 ? a.crashed : b.crashed, accel: (b.v - a.v) / span };
      } else if (t < a.raceT) out = Object.assign({}, a, { accel: 0 });   // nothing that old yet: hold the oldest pose
      else { const ex = Math.min(t - a.raceT, MP_EXTRAPOLATE_MAX); out = Object.assign({}, a, { dist: a.dist + Math.max(0, a.v) * ex, accel: 0 }); }
      out.finished = N.finishT !== null && t >= N.finishT; out.finishT = N.finishT;
      g.placeNet(out);
    }
  },

  // ── finish and results ──
  localFinish(R) {
    const P = R.player, M = R.mp; M.finishedAt = Date.now();
    M.finishMsg = { raceId: M.raceId, raceT: P.finishT, dist: P.dist, lap: P.lap };
    this.storeFinish(R);
    this.reportFinish(R);
    this.later(() => { if (this.game.race === R && !R.mpOver) this.showResults(R, null); }, MP_RESULTS_WAIT_MS);
  },
  // The finish report has to reach the room server, or this racer ends as DNF however the race went. MP.finish retries
  // once by itself, but gives up after about 40 s without a connection. So the report goes out again: every few seconds
  // while the connection is up, and as soon as the room is back after a reconnect or a reload (resendFinish). A repeat
  // is harmless: the server acknowledges it as a duplicate. R is the live race, or the pending one (BACK TO LOBBY, reload).
  reportFinish(R) {
    const M = R.mp;
    if (!M.finishMsg || M.finishAck || M.finishing || M.finishRefused || R.mpOver || R.mpPaid !== undefined || this.leaving || !MP.room) return;
    if (this.game.race !== R && this.pendingRace !== R) return;   // released (left, or a new race began): nothing to report for
    M.finishing = true;
    MP.finish(M.finishMsg).then((ack) => {
      M.finishing = false;
      if (ack && ack.ok) { M.finishAck = true; return; }
      const code = ack && ack.code;
      if (code === 'TIMEOUT' || code === 'NETWORK' || (code === 'NOT_IN_ROOM' && !MP.room)) {
        if (MP.status === 'online' && MP.room) this.later(() => this.reportFinish(R), MP_FINISH_RETRY_MS);
        return;   // offline: resendFinish sends it when the room is back
      }
      M.finishRefused = true;   // the server said no (the race is over, or this racer is out of it): sending it again changes nothing
    });
  },
  resendFinish() {
    const room = MP.room;
    if (MP.status !== 'online' || !room || room.phase !== 'racing') return;
    for (const R of [this.mpRace(), this.pendingRace]) if (R && R.mp.raceId === room.raceId) this.reportFinish(R);
  },

  // ── the race this tab finished ──
  // When a seat resumes, the room server sends race:begin again to every racer still in a running race, finished or not.
  // A racer who has crossed the line stays where they are (the results screen or the lobby) instead of being put back on
  // the grid, and the reward for the real run is paid when the results come. The record is kept in sessionStorage, like
  // the seat token, so a reload in between keeps both. A race is known by its raceId and its GO time together, so a
  // restarted room server that counts raceIds from 1 again cannot be mistaken for it.
  raceKey(raceId, goAt) { return `${raceId}@${goAt}`; },
  hasFinished(b) { return !!b && this.done === this.raceKey(b.raceId, b.goAt); },
  storeFinish(R) {
    const P = R.player, M = R.mp, s = MP.session();
    this.done = this.raceKey(M.raceId, M.goAt);
    const rec = { pin: s ? s.pin : MP.room && MP.room.pin, raceId: M.raceId, goAt: M.goAt, seat: M.seat, track: R.def.id, laps: R.laps,
      score: R.score, clean: R.clean, lapTimes: P.laps, bestLap: Number.isFinite(P.bestLap) ? P.bestLap : null, finishT: P.finishT, finish: M.finishMsg };
    try { sessionStorage.setItem(MP_FINISH_KEY, JSON.stringify(rec)); } catch (e) { /* kept in memory only: a reload forgets it */ }
  },
  forgetFinish() { try { sessionStorage.removeItem(MP_FINISH_KEY); } catch (e) { /* nothing stored */ } },
  dropPending() { this.pendingRace = null; this.forgetFinish(); },
  // After a reload: the finished race whose results had not come yet. pendingRace gets what paying its reward needs
  // (the fields Game.computeResults reads) and its finish report, in case the server never got it.
  restoreFinish() {
    let o = null;
    try { const raw = sessionStorage.getItem(MP_FINISH_KEY); o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
    if (!o) return;
    const s = MP.session(), num = (v) => typeof v === 'number' && Number.isFinite(v), f = o.finish;
    if (typeof o !== 'object' || !s || o.pin !== s.pin || !Number.isInteger(o.raceId) || !num(o.goAt) || !Number.isInteger(o.seat) || !num(o.finishT)
      || !MP_LAPS.includes(o.laps) || !TRACKS.some(t => t.id === o.track) || !f || typeof f !== 'object' || f.raceId !== o.raceId) { this.forgetFinish(); return; }
    const score = {};
    if (o.score && typeof o.score === 'object') for (const [k, v] of Object.entries(o.score)) if (num(v)) score[k] = v;
    const player = { isPlayer: true, finished: true, finishT: o.finishT, laps: Array.isArray(o.lapTimes) ? o.lapTimes.filter(num).slice(0, 200) : [], bestLap: num(o.bestLap) ? o.bestLap : Infinity };
    const finishMsg = { raceId: o.raceId, raceT: num(f.raceT) ? f.raceT : o.finishT, dist: num(f.dist) ? f.dist : 0, lap: Number.isInteger(f.lap) ? f.lap : 0 };
    this.done = this.raceKey(o.raceId, o.goAt);
    this.viewRaceId = o.raceId;   // the last race this tab saw the room run: a lobby view after the reload says it is over
    this.pendingRace = { mode: 'friends', def: TRACKS.find(t => t.id === o.track), laps: o.laps, diff: DIFFICULTY.normal, score, clean: o.clean === true,
      player, riders: [player], ranking: () => [player], mp: { raceId: o.raceId, goAt: o.goAt, seat: o.seat, finishMsg, finishAck: false } };
  },

  onResults(res) {
    this.lastResults = res;
    const R = this.mpRace();
    if (R && R.mp.raceId === res.raceId) { this.showResults(R, res); return; }
    // the player went back to the lobby (or reloaded) after finishing, before the results came: pay the reward now
    const PR = this.pendingRace;
    if (PR && PR.mp.raceId === res.raceId) {
      this.pendingRace = null;
      const rw = this.pay(PR, res), me = res.order.find(o => o.seat === PR.mp.seat);
      if (this.game.ui) this.game.ui.renderMenu();
      if (me) this.note(me.finished ? `Results are in: you finished ${me.pos}${ordinal(me.pos).toLowerCase()}${rw ? ` · +${fmtNum(rw.total)} coins and XP` : ''}` : 'Results are in: you did not finish.');
    }
  },
  // The reward, once per race: the Quick Race table (Game.computeResults) with the server's position. A racer who did
  // not finish gets no position points. An aborted race pays nothing.
  pay(R, res) {
    if (R.mpPaid !== undefined) return R.mpPaid;
    this.forgetFinish();
    const me = res && res.order.find(o => o.seat === R.mp.seat);
    if (!res || res.reason === 'aborted' || !me) { R.mpPaid = null; return null; }
    R.playerPos = me.pos; R.mpDnf = !me.finished;
    R.mpPaid = this.game.computeResults(R);
    return R.mpPaid;
  },
  // res: the server's race:results, or null for the local standings (no answer yet, or the race ended unseen)
  showResults(R, res, missed = false) {
    const g = this.game; if (g.race !== R) return;
    if (res) { R.mpOver = true; R.mpResults = res; this.clearTimers(); }
    if (missed) { R.mpOver = true; this.clearTimers(); this.forgetFinish(); }
    const reward = res ? this.pay(R, res) : null;
    $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true;
    if (g.state !== 'results') {
      g.state = 'results'; g.td = null; g.setMusic('menu');
      $$('.screen').forEach(s => s.classList.remove('show')); $('#results').classList.add('show');
    }
    this.renderResults(R, res, reward, missed);
    g.ui.renderMenu();
  },
  ensureView() {
    if (this.view) return this.view;
    const order = $('#rOrder'), acts = $('#results .res-actions');
    const table = document.createElement('table'); table.id = 'rMpTable'; table.className = 'cup-table'; table.hidden = true;
    const note = document.createElement('p'); note.id = 'rMpNote'; note.className = 'muted small'; note.hidden = true; note.setAttribute('role', 'status');
    order.after(table, note);
    const btn = (id, cls, text, fn) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = cls; b.textContent = text; b.hidden = true; b.addEventListener('click', fn); return b; };
    const again = btn('rMpAgain', 'btn-yellow', 'RACE AGAIN', () => this.raceAgain());
    const lobby = btn('rMpLobby', 'btn-pink', 'BACK TO LOBBY', () => this.backToLobby());
    acts.prepend(again, lobby);
    this.view = { table, note, again, lobby };
    return this.view;
  },
  renderResults(R, res, reward, missed) {
    const V = this.ensureView(), P = R.player, me = res && res.order.find(o => o.seat === R.mp.seat);
    const aborted = !!res && res.reason === 'aborted';
    const livePos = R.ranking().indexOf(P) + 1;
    // header, reward list and daily challenges: the solo results renderer, with the server's standings in place of its order
    const base = reward || { posText: '', posSuf: '', title: '', sub: '', items: [], total: 0, multText: '', cupTable: '' };
    this.game.ui.renderResults(R, Object.assign({}, base, { order: [] }));
    let posText, posSuf, title;
    if (aborted) { posText = '–'; posSuf = ''; title = 'RACE CALLED OFF'; }
    else if (me) { posText = me.finished ? String(me.pos) : '–'; posSuf = me.finished ? ordinal(me.pos) : 'DNF'; title = !me.finished ? 'DID NOT FINISH' : me.pos === 1 ? 'JEET GAYA!' : 'RACE COMPLETE'; }
    else { posText = String(livePos); posSuf = ordinal(livePos); title = P.finished ? 'FINISHED' : 'RACE OVER'; }
    $('#rPos').textContent = posText; $('#rPosSuf').textContent = posSuf; $('#rTitle').textContent = title;
    $('#rSub').textContent = `${R.def.short} · ${R.laps} lap${R.laps > 1 ? 's' : ''} · ${MODES.friends.label} · Best lap ${fmtTime(P.bestLap)}`;
    if (!reward) {
      const li = document.createElement('li'), sp = document.createElement('span'), b = document.createElement('b');
      sp.textContent = aborted ? 'The race did not start, so there is no reward.' : res || missed ? 'No reward this time' : 'Your reward is paid when the results arrive.';
      b.textContent = '+0'; li.append(sp, b); $('#rList').replaceChildren(li);
      $('#rMult').textContent = '';
    }
    // the standings: the server's order, or the local one while it has not arrived
    const rows = res ? res.order.map(o => ({ pos: o.pos, name: o.name, me: o.seat === R.mp.seat, time: aborted ? '' : o.finished && Number.isFinite(o.finishT) ? fmtTime(o.finishT) : 'DNF' }))
      : R.ranking().map((r, i) => ({ pos: i + 1, name: r.isPlayer ? SAVE.name : r.name, me: r.isPlayer, time: r.finished && Number.isFinite(r.finishT) ? fmtTime(r.finishT) : r.eliminated ? 'LEFT' : 'racing' }));
    const head = document.createElement('tr');
    for (const t of ['#', 'Racer', 'Time']) { const th = document.createElement('th'); th.textContent = t; if (t === 'Time') th.style.textAlign = 'right'; head.appendChild(th); }
    const trs = [head];
    for (const r of rows) {
      const tr = document.createElement('tr'); if (r.me) tr.className = 'me';
      const a = document.createElement('td'), n = document.createElement('td'), t = document.createElement('td');
      a.textContent = String(r.pos); n.textContent = r.me ? `${r.name} (You)` : r.name; t.className = 'n'; t.textContent = r.time;
      tr.append(a, n, t); trs.push(tr);
    }
    V.table.replaceChildren(...trs);
    const why = aborted ? 'The race was called off: fewer than 2 racers were connected at GO.'
      : missed ? 'The race ended while you were reconnecting, so the results did not reach this device.'
      : !res ? 'Waiting for the other racers…'
      : res.reason === 'timeout' ? 'Time up: racers still on the road did not finish.' : '';
    this.viewWhy = why;
    this.viewOn = true;
    for (const id of ['#rAgain', '#rNext', '#rGarage', '#rMenu']) $(id).hidden = true;
    $('#rOrder').hidden = true; V.table.hidden = false; V.lobby.hidden = false;
    this.refreshButtons();
  },
  // RACE AGAIN is the host's, once the room is back in the lobby
  refreshButtons() {
    if (!this.viewOn || !this.view) return;
    const R = this.mpRace(), V = this.view, can = !!(R && R.mpResults) && !!MP.room && MP.room.phase === 'lobby' && MP.isHost();
    V.again.hidden = !can;
    V.again.disabled = this.starting; V.again.textContent = this.starting ? 'STARTING…' : 'RACE AGAIN';
    const hint = R && R.mpResults && MP.room && !MP.isHost() ? 'The host starts the next race.' : '';
    const note = this.viewWhy || hint; V.note.textContent = note; V.note.hidden = !note;
    V.lobby.textContent = MP.room ? 'BACK TO LOBBY' : 'MAIN MENU';
  },
  endView() {
    this.restorePause();
    if (!this.viewOn) return;
    this.viewOn = false; this.starting = false;
    const V = this.view;
    for (const id of ['#rAgain', '#rNext', '#rGarage', '#rMenu']) $(id).hidden = false;
    $('#rOrder').hidden = false;
    V.table.hidden = true; V.note.hidden = true; V.again.hidden = true; V.lobby.hidden = true;
    V.again.disabled = false; V.again.textContent = 'RACE AGAIN';
  },
  async raceAgain() {
    if (this.starting || !MP.isHost()) return;
    AUDIO.click();
    this.starting = true; this.refreshButtons();
    const ack = await MP.startRace();   // race:begin follows, to every seat, and starts the next race
    this.starting = false;
    if (!ack.ok) { this.note(ack.message); AUDIO.warn(); }
    this.refreshButtons();
  },
  backToLobby() {
    AUDIO.click();
    const g = this.game, R = this.mpRace();
    if (R && !R.mpOver && R.player.finished && R.mpPaid === undefined) this.pendingRace = R;   // its reward is paid when the results arrive
    this.clearTimers(); this.endView();
    if (MP.room && typeof MPUI !== 'undefined') MPUI.showLobby();   // ends the race (Game.endRace) and shows the room
    else { g.cup = null; g.toMenu(); if (!MP.session()) this.dropPending(); }   // no seat to come back to: no results will come
    // the race's timers went with it: a finish report the server has not acknowledged yet carries on from here
    if (this.pendingRace) this.reportFinish(this.pendingRace);
  },
  // Game.endRace calls this for a friends race: its timers and the results view go with it
  raceEnded() { this.clearTimers(); this.endView(); },

  // ── pause: a friends race never pauses; the menu only offers leaving ──
  togglePause() {
    const g = this.game, m = $('#pause');
    if (!m.hidden) { g.ui.closeModal(); return; }
    this.pauseView = true;
    $('#pauseTitle').textContent = 'FRIENDS RACE';
    $('#pauseInfo').textContent = 'A friends race does not pause: your bike keeps going while this menu is open.';
    $('#pResume').textContent = 'BACK TO RACE'; $('#pQuit').textContent = 'Leave race';
    $('#pRestart').hidden = true; $('#pSettings').hidden = true;
    g.ui.open('pause');
  },
  restorePause() {
    if (!this.pauseView) return;
    this.pauseView = false;
    $('#pauseTitle').textContent = 'PAUSED'; $('#pResume').textContent = 'RESUME'; $('#pQuit').textContent = 'Quit to menu';
    $('#pRestart').hidden = false; $('#pSettings').hidden = false;
  },

  // game.leaveMultiplayer(): ends the friends race if one is on, leaves the room (the session goes) and returns to the menu
  leave() {
    const g = this.game;
    this.leaving = true; this.dropPending(); this.viewRaceId = null;
    const R = this.mpRace(); if (R) R.mpLeft = true;
    this.clearTimers(); this.endView();
    const done = MP.leave();
    if (typeof MPUI !== 'undefined') MPUI.hideLobby();
    g.cup = null; g.toMenu();   // Game.endRace: the race group, the ghost rigs and the HUD race go with it
    return done.finally(() => { this.leaving = false; });
  },

  // ── room events ──
  onClosed() {
    this.dropPending(); this.viewRaceId = null;
    const g = this.game; if (!this.mpRace()) return;
    this.clearTimers(); this.endView(); g.cup = null; g.toMenu();
    if (typeof MPUI === 'undefined' || !MPUI.ready) this.note('That room has closed.');   // once the lobby UI is set up, it says so itself
  },
  onStatus(s) {
    if (s === 'online') { this.resendFinish(); return; }
    if (s !== 'offline') return;
    // the seat is gone for good (left, taken over by another tab, or past the server's grace period), and with it the
    // results a finished race was waiting for. With the session still here, Friends can take the seat back, so it stays.
    if (!MP.session()) this.dropPending();
    if (this.leaving) return;
    const g = this.game, R = this.mpRace(); if (!R) return;
    // the connection is gone for good: socket.io could not reconnect, or another tab took this seat over
    const superseded = MP.lastError && MP.lastError.code === 'SUPERSEDED';
    this.clearTimers(); this.endView();
    if (MP.session() && !R.mpOver && R.player.finished && R.mpPaid === undefined) this.pendingRace = R;   // paid if the seat comes back in time for the results
    g.cup = null; g.toMenu();
    if (!superseded) this.note('Lost the connection to the room server.');
  },
  onRoom() {
    const room = MP.room; if (!room) return;
    // A room view names the race it is running (raceId); a lobby view names none. So a lobby view says that the race of
    // the last race view before it is over, and nothing about any other race.
    if (room.phase !== 'lobby' && room.raceId !== null) this.viewRaceId = room.raceId;
    this.resendFinish();
    // A lobby view ends race R only when the last race the room showed was R. A view from before R began (the answer to
    // a request sent from the lobby, applied just after race:begin on a polling connection, even late on a slow device)
    // follows no view of R, so it cannot end R. And no race ends before its GO.
    const over = (R) => room.phase === 'lobby' && this.viewRaceId === R.mp.raceId && MP.serverNow() >= R.mp.goAt;
    // the results of the race this tab finished went out while it was away (reconnecting or reloading)
    const PR = this.pendingRace;
    if (PR && PR.mpPaid === undefined && over(PR)) { this.dropPending(); this.note('That race ended while you were away, so its results did not reach this device.'); }
    const R = this.mpRace(); if (!R) return;
    // a racer who left the room leaves the road too (one who only lost connection stays, frozen, and may come back)
    const seats = new Set(room.racers.map(r => r.seat));
    for (const r of R.riders) if (r.net && !r.net.gone && !seats.has(r.net.seat)) { r.net.gone = true; r.eliminated = true; r.rig.root.visible = false; }
    // the room is back in the lobby but no results came: the race ended while this tab was reconnecting
    if (!R.mpOver && over(R)) this.showResults(R, null, true);
    this.refreshButtons();
  },
};
