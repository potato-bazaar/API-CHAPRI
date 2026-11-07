// ───────────────────────── MULTIPLAYER LOBBY: the Play with friends dialog and the room lobby ─────────────────────────
// The dialog is the #friends modal (opened through UI.open('friends')). The lobby is the #mpLobby screen, drawn over the
// live menu scene, which shows the room's track, time and weather with your own bike. The race itself belongs to
// 84_mp_race.js: it takes over on race:begin and calls MPUI.hideLobby(). Names from the network go in with textContent.
const MP_TIME_LABEL = { morning: 'Morning', golden: 'Golden hour', night: 'Night' };
const MP_WEATHER_LABEL = { clear: 'Clear', monsoon: 'Rain' };
const mpTrackLabel = (id) => (id === 'random' ? 'Random' : (TRACKS.find(t => t.id === id) || {}).short || id);
const mpBikeLabel = (id) => (BUILDS.find(b => b.id === id) || BUILDS[0]).name;
const MP_NOTE_QUEUE = 3;          // toasts waiting to show; a burst of notices keeps only the newest
const MP_DROP_HOLD_MS = 3000;     // a racer who drops and is back within this long (a reload) gets no notices
const MP_RENDER_GAP_MS = 100;     // room updates redraw the lobby at most this often

const MPUI = {
  ready: false, booted: false, busy: false, starting: false, leaving: false, wasDown: false,
  pending: {}, segs: {}, notes: [], noteBusy: false, lastNote: '', lastNoteAt: 0, recent: [],
  bdKey: '', bdWorld: '', bdTimer: 0, bdWatch: 0, bikeTimer: 0, startTimer: 0, raceWait: 0, invitePin: null,
  drops: new Map(), hostNews: null, hostNewsT: 0, renderT: 0, renderedAt: -1e9, bikeDirty: false,

  init() {
    if (this.ready) return;
    this.ready = true;
    const pinIn = $('#mpPinIn'), nameIn = $('#mpName');
    $('#mpCreate').addEventListener('click', () => this.create());
    $('#mpJoin').addEventListener('click', () => this.join());
    pinIn.addEventListener('input', () => { const v = pinIn.value.replace(/\D/g, '').slice(0, 4); if (v !== pinIn.value) pinIn.value = v; if (!this.busy) this.entryMsg(''); });
    pinIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.join(); } });
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (pinIn.value.length === 4) this.join(); else pinIn.focus(); } });
    $('#mpPrivacyBtn').addEventListener('click', () => { const p = $('#mpPrivacy'); p.hidden = !p.hidden; $('#mpPrivacyBtn').setAttribute('aria-expanded', String(!p.hidden)); AUDIO.click(); });
    $('#mpLeave').addEventListener('click', () => this.leave());
    $('#mpCopy').addEventListener('click', () => this.copyLink());
    $('#mpBikePrev').addEventListener('click', () => this.cycleBike(-1));
    $('#mpBikeNext').addEventListener('click', () => this.cycleBike(1));
    $('#mpStart').addEventListener('click', () => this.start());
    const seg = (key, opts) => {
      const el = this.segs[key] = $('#mp' + key[0].toUpperCase() + key.slice(1));
      for (const [v, label] of opts) {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.v = String(v); b.textContent = label; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => this.setSetting(key, key === 'laps' ? Number(v) : v));
        el.appendChild(b);
      }
    };
    seg('track', MP_TRACKS.map(id => [id, mpTrackLabel(id)]));
    seg('laps', MP_LAPS.map(n => [n, String(n)]));
    seg('time', MP_TIMES.map(k => [k, MP_TIME_LABEL[k]]));
    seg('weather', MP_WEATHERS.map(k => [k, MP_WEATHER_LABEL[k]]));
    MP.on('room', () => this.onRoom());
    MP.on('notice', (n) => this.onNotice(n));
    MP.on('closed', () => this.onClosed());
    MP.on('status', (s) => this.onStatus(s));
    MP.on('error', (e) => this.onError(e));
  },

  // ── entry dialog ──
  open() {
    this.init();
    if (MP.room) { this.showLobby(); return; }
    const s = MP.session();
    if (s) { this.showEntry({ pin: s.pin }); this.rejoin(); return; }
    this.showEntry();
  },
  showEntry(opts = {}) {
    this.init();
    $$('.modal').forEach(m => (m.hidden = true));
    $('#modalBack').hidden = false; $('#friends').hidden = false;
    if (GAME && GAME.ui) GAME.ui.returnToPause = false;
    const nameIn = $('#mpName');
    nameIn.value = SAVE.name || '';
    $('#mpPinIn').value = opts.pin || '';
    $('#mpPrivacy').hidden = true; $('#mpPrivacyBtn').setAttribute('aria-expanded', 'false');
    this.entryMsg(opts.msg || '', !!opts.err);
    if (opts.focusName) { nameIn.focus({ preventScroll: true }); nameIn.select(); }
    else { const x = $('#friends .x'); if (x) x.focus({ preventScroll: true }); }
  },
  entryVisible() { const f = $('#friends'); return !!f && !f.hidden; },
  closeEntry() { $('#friends').hidden = true; if (!$$('.modal').some(m => !m.hidden)) $('#modalBack').hidden = true; },
  entryMsg(text, err = false) { const el = $('#mpEntryMsg'); if (!el) return; el.textContent = text; el.classList.toggle('err', !!err); },
  setBusy(on, msg) {
    this.busy = on;
    for (const id of ['#mpCreate', '#mpJoin', '#mpName', '#mpPinIn']) $(id).disabled = on;
    $('#friends').setAttribute('aria-busy', String(on));
    if (msg !== undefined) this.entryMsg(msg);
  },
  // the name typed here is the player's name, the same one Settings edits
  takeName() {
    const n = MP.cleanName($('#mpName').value);
    $('#mpName').value = n;
    if (n !== SAVE.name) { SAVE.name = n; persist(); if (GAME && GAME.ui) GAME.ui.renderMenu(); }
    return n;
  },
  myBike() { return MP_BIKES.includes(SAVE.build) && SAVE.owned[SAVE.build] ? SAVE.build : 'stock'; },
  myLook() { try { return lookFromSave(this.myBike()); } catch (e) { return null; } },
  async create() {
    if (this.busy) return;
    AUDIO.click();
    const name = this.takeName();
    this.setBusy(true, 'Creating a room…');
    const ack = await MP.create({ name, bike: this.myBike(), look: this.myLook() });
    this.setBusy(false);
    this.afterEnter(ack);
  },
  async join(pinArg) {
    if (this.busy) return;
    const pin = String(pinArg ?? $('#mpPinIn').value).replace(/\D/g, '');
    if (!/^\d{4}$/.test(pin)) { this.entryMsg(MP.errorText('BAD_PIN'), true); AUDIO.warn(); $('#mpPinIn').focus(); return; }
    AUDIO.click();
    $('#mpPinIn').value = pin;
    const name = this.takeName();
    this.setBusy(true, `Joining room ${pin}…`);
    let ack = await MP.join({ pin, name, bike: this.myBike(), look: this.myLook() });
    this.setBusy(false);
    if (this.invitePin === pin && (ack.ok || ack.code === 'NOT_FOUND')) { this.invitePin = null; this.stripRoomParam(); }
    // an invite to another room that did not work out: the seat this tab held is still there for a while
    const kept = !ack.ok && MP.session();
    if (kept && kept.pin !== pin) ack = Object.assign({}, ack, { message: `${ack.message} You still have your seat in room ${kept.pin}: close this and open Friends to go back to it.` });
    this.afterEnter(ack);
  },
  afterEnter(ack) {
    if (!ack.ok) { this.entryMsg(ack.message, true); AUDIO.warn(); return; }
    // the player may have closed the dialog and started a solo race while the request was out: give the seat back
    if (!GAME || GAME.state !== 'menu') { MP.leave(); return; }
    this.entryMsg('');
    this.closeEntry();
    this.showLobby();
    AUDIO.pickup();
  },
  async rejoin() {
    this.setBusy(true, 'Rejoining your room…');
    const ok = await MP.resume();
    this.setBusy(false);
    if (ok && GAME.state === 'menu') { this.entryMsg(''); this.closeEntry(); this.afterResume(); return; }
    if (ok) return;
    this.entryMsg(MP.session() ? (MP.lastError || {}).message || MP.errorText('NETWORK') : 'That room has closed.', true);
  },

  // ── lobby screen ──
  lobbyVisible() { const el = $('#mpLobby'); return !!el && el.classList.contains('show'); },
  showLobby() {
    this.init();
    const g = GAME;
    if (!g || !g.scene) return;
    if (!MP.room) { this.showEntry(); return; }
    clearTimeout(this.raceWait);
    $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true;
    // back from a race: the game's own calls put the menu scene back; the backdrop below then sets the room's track
    g.endRace();
    if (g.state !== 'menu') g.showScreen('menu');
    g.showScreen('mpLobby');
    this.render();
    this.applyBackdrop(true);
    if (!this.bdWatch) this.bdWatch = setInterval(() => this.watchBackdrop(), 1000);
    const f = $('#mpLeave'); if (f) f.focus({ preventScroll: true });
  },
  hideLobby() {
    const el = $('#mpLobby'); if (el) el.classList.remove('show');
    clearTimeout(this.bdTimer); clearInterval(this.bdWatch); this.bdWatch = 0;
    clearTimeout(this.startTimer); clearTimeout(this.raceWait); this.starting = false;
    clearTimeout(this.renderT); this.renderT = 0;
    // a bike tapped in the last moments before the start is not sent any more: the server would refuse it mid-race
    clearTimeout(this.bikeTimer); this.bikeTimer = 0;
    this.matchRaceBike();
  },
  // The race glue calls hideLobby() on race:begin, before it builds the race from SAVE.build. A bike picked here that
  // the server had not taken by then (tapped just before the start, or refused) is not in race:begin, so the other
  // racers see the bike that is: ride that one too. Every other caller has left the room already (MP.room is null).
  matchRaceBike() {
    const b = MP.lastBegin;
    if (!this.bikeDirty || !b || !MP.room || MP.seat === null) return;
    this.bikeDirty = false;
    const mine = b.racers.find(r => r.seat === MP.seat);
    if (!mine || mine.bike === this.myBike() || !SAVE.owned[mine.bike]) return;
    SAVE.build = mine.bike;   // stored at the next save (the race's results), not mid-race
    this.note(`Too late to switch bikes: you race on the ${mpBikeLabel(mine.bike)}.`);
  },
  // after a resume: the lobby, or (a race is on) wait for race:begin, which the race glue handles
  afterResume() {
    if (!MP.room) return;
    if (MP.room.phase === 'lobby') { this.showLobby(); return; }
    clearTimeout(this.raceWait);
    this.raceWait = setTimeout(() => { if (MP.room && GAME.state === 'menu' && !this.lobbyVisible()) this.showLobby(); }, 4000);
  },
  // room updates can come in bursts (a racer whose connection flaps): the first redraws at once, the rest at most every 100 ms
  renderSoon() {
    const wait = MP_RENDER_GAP_MS - (Date.now() - this.renderedAt);
    if (wait <= 0) { clearTimeout(this.renderT); this.renderT = 0; this.render(); return; }
    if (!this.renderT) this.renderT = setTimeout(() => { this.renderT = 0; this.render(); }, wait);
  },
  render() {
    const R = MP.room;
    if (!R || !this.ready) return;
    this.renderedAt = Date.now();
    const host = MP.isHost(), lobby = R.phase === 'lobby', online = MP.status === 'online';
    $('#mpPin').textContent = R.pin;
    $('#mpCount').textContent = `${R.racers.length}/${MP_SEATS}`;
    this.renderRoster(R);
    $('#mpBikeName').textContent = mpBikeLabel(this.myBike());
    const st = Object.assign({}, R.settings, this.pending);
    for (const [key, el] of Object.entries(this.segs)) {
      for (const b of el.children) {
        const on = String(st[key]) === b.dataset.v;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.disabled = !host || !lobby;
      }
    }
    $('#mpHostNote').hidden = host;
    const ready = R.racers.filter(r => r.connected).length >= MP_MIN_RACERS;
    // back in the lobby while the others still race, or a start on its way: no start controls, a line that says so
    const raceOn = !lobby && !this.starting;
    $('#mpWaitFriends').hidden = ready || raceOn;
    $('#mpStart').hidden = raceOn || !(ready && host);
    $('#mpWaitHost').hidden = raceOn || !(ready && !host);
    const on = $('#mpRaceOn');
    on.hidden = !raceOn;
    on.textContent = R.phase === 'countdown' ? 'The race is starting…' : 'Race in progress… results soon';
    $('#mpStart').disabled = this.starting || !online || !lobby;
    $('#mpStartLbl').textContent = this.starting ? 'STARTING…' : 'START RACE';
    const conn = $('#mpConn');
    conn.hidden = online;
    conn.textContent = MP.status === 'reconnecting' ? 'Connection lost. Reconnecting…' : 'Connecting to the room server…';
    for (const id of ['#mpBikePrev', '#mpBikeNext']) $(id).disabled = !lobby;
  },
  renderRoster(R) {
    const ul = $('#mpRoster');
    ul.textContent = '';
    const badge = (text, cls) => { const s = document.createElement('span'); s.className = 'mp-badge ' + cls; s.textContent = text; return s; };
    for (const r of R.racers) {
      const me = r.seat === MP.seat;
      const li = document.createElement('li');
      li.className = (me ? 'me' : '') + (r.connected ? '' : ' off');
      li.dataset.seat = String(r.seat);
      const dot = document.createElement('span');
      dot.className = 'mp-dot'; dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', r.connected ? 'Connected' : 'Reconnecting');
      const who = document.createElement('span'); who.className = 'mp-who';
      const nm = document.createElement('b'); nm.textContent = r.name; who.appendChild(nm);
      if (r.seat === R.hostSeat) who.appendChild(badge('HOST', 'host'));
      if (me) who.appendChild(badge('YOU', 'you'));
      const bk = document.createElement('span'); bk.className = 'mp-bikec'; bk.textContent = mpBikeLabel(r.bike);
      li.append(dot, who, bk);
      ul.appendChild(li);
    }
  },
  // the menu scene behind the lobby shows the room's track, time and weather, and the local bike
  backdropTrack(id) {
    if (id !== 'random' && TRACKS.some(t => t.id === id)) return id;
    const cur = GAME.track && GAME.track.def.id;
    if (cur !== 'random' && MP_TRACKS.includes(cur)) return cur;
    return MP_TRACKS.includes(SAVE.setup.track) && SAVE.setup.track !== 'random' ? SAVE.setup.track : 'mumbai-underground';
  },
  applyBackdrop(force = false) {
    clearTimeout(this.bdTimer);
    const g = GAME, R = MP.room;
    if (!g || !R || !this.lobbyVisible() || g.state !== 'menu') return;
    const st = R.settings, id = this.backdropTrack(st.track);
    const key = `${id}|${st.time}|${st.weather}|${this.myBike()}`;
    if (!force && key === this.bdKey && g.worldKey === this.bdWorld) return;
    g.loadTrack(id, st.time, st.weather);
    g.refreshMenuRig(this.myBike());
    this.bdKey = key; this.bdWorld = g.worldKey;
  },
  // rapid changes (the host clicking through tracks) build the world once
  scheduleBackdrop() { clearTimeout(this.bdTimer); this.bdTimer = setTimeout(() => this.applyBackdrop(), 180); },
  // the quality benchmark can rebuild the world with the solo setup's mood; put the room's back
  watchBackdrop() {
    if (!this.lobbyVisible()) { clearInterval(this.bdWatch); this.bdWatch = 0; return; }
    if (GAME.worldKey !== this.bdWorld) this.applyBackdrop(true);
  },

  // ── lobby controls ──
  async setSetting(key, value) {
    const R = MP.room;
    if (!R || !MP.isHost() || R.phase !== 'lobby') return;
    if (String(Object.assign({}, R.settings, this.pending)[key]) === String(value)) return;
    AUDIO.click();
    this.pending[key] = value;   // show the choice at once; the room update confirms it
    this.render();
    const ack = await MP.setSettings({ [key]: value });
    if (this.pending[key] === value) delete this.pending[key];
    if (!ack.ok) { this.note(ack.message); AUDIO.warn(); }
    this.render();
  },
  cycleBike(dir) {
    const owned = BUILDS.filter(b => SAVE.owned[b.id] && MP_BIKES.includes(b.id));
    if (!owned.length || !MP.room) return;
    let i = owned.findIndex(b => b.id === SAVE.build);
    i = (i + dir + owned.length) % owned.length;
    SAVE.build = owned[i].id; persist(); AUDIO.click();
    this.bikeDirty = true;   // until a room update shows the server has this bike for this seat
    this.render();
    this.applyBackdrop();
    // one update for a run of quick taps
    clearTimeout(this.bikeTimer);
    this.bikeTimer = setTimeout(async () => {
      this.bikeTimer = 0;
      if (!MP.room) return;
      const ack = await MP.updateRacer({ bike: this.myBike(), look: this.myLook() });
      // a refusal because the race started meanwhile is not news on the race screen: hideLobby() has dealt with it
      if (!ack.ok && MP.room && this.lobbyVisible()) this.note(ack.message);
    }, 250);
  },
  async start() {
    if (!MP.isHost() || this.starting) return;
    AUDIO.click();
    this.starting = true; this.render();
    const ack = await MP.startRace();
    if (!ack.ok) { this.starting = false; this.note(ack.message); AUDIO.warn(); this.render(); return; }
    // race:begin goes to every seat and the race glue takes over; this only frees the button if that never comes
    clearTimeout(this.startTimer);
    this.startTimer = setTimeout(() => { this.starting = false; this.render(); }, 8000);
  },
  leave() {
    AUDIO.click();
    this.leaving = true;
    clearTimeout(this.bikeTimer); this.bikeTimer = 0; this.bikeDirty = false;
    this.forgetRoomNews();
    const done = MP.leave();
    this.hideLobby();
    GAME.toMenu();   // the game's own path back: solo track, solo mood, menu screen
    done.finally(() => { this.leaving = false; });
  },
  inviteLink() { return MP.room ? `${location.origin}/?room=${MP.room.pin}` : ''; },
  async copyLink() {
    const link = this.inviteLink();
    if (!link) return;
    AUDIO.click();
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(link); ok = true; } } catch (e) { ok = false; }
    if (!ok) {   // plain http on a LAN address has no async clipboard
      try {
        const t = document.createElement('textarea');
        t.value = link; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(t); t.select(); t.setSelectionRange(0, link.length);
        ok = document.execCommand('copy'); t.remove();
      } catch (e) { ok = false; }
    }
    this.note(ok ? 'Invite link copied' : `Share this link: ${link}`);
  },

  // ── notices ──
  note(text) {
    if (!text) return;
    const now = Date.now();
    if (text === this.lastNote && now - this.lastNoteAt < 2500) return;
    this.lastNote = text; this.lastNoteAt = now;
    this.recent.push(text); if (this.recent.length > 30) this.recent.shift();
    const live = $('#mpLive'); if (live) live.textContent = text;
    // each toast shows for 1.5 s: a burst of notices must not queue minutes of them, so only the newest few wait
    if (!this.notes.includes(text)) this.notes.push(text);
    if (this.notes.length > MP_NOTE_QUEUE) this.notes.splice(0, this.notes.length - MP_NOTE_QUEUE);
    if (!this.noteBusy) this.drainNotes();
  },
  // one flashNote at a time, so two notices never print on top of each other
  drainNotes() {
    const t = this.notes.shift();
    if (!t) { this.noteBusy = false; return; }
    this.noteBusy = true;
    if (GAME && GAME.ui) GAME.ui.flashNote(t);
    setTimeout(() => this.drainNotes(), 1500);
  },
  onRoom() {
    if (!MP.room) return;
    for (const k of Object.keys(this.pending)) if (String(MP.room.settings[k]) === String(this.pending[k])) delete this.pending[k];
    if (this.hostNews !== null) this.flushHostNews();
    if (this.bikeDirty) { const me = MP.room.racers.find(r => r.seat === MP.seat); if (me && me.bike === this.myBike()) this.bikeDirty = false; }
    this.renderSoon();
    if (this.lobbyVisible()) this.scheduleBackdrop();
  },
  onNotice(n) {
    const who = n.name || 'A racer';
    if (n.kind === 'joined') this.note(`${who} joined the room`);
    else if (n.kind === 'left') { this.cancelDrop(who); this.note(`${who} left the room`); }
    else if (n.kind === 'disconnected') {
      // a reload or a short drop is back within seconds: say so only if the racer stays away
      if (!this.drops.has(who)) this.drops.set(who, setTimeout(() => { this.drops.delete(who); this.note(`${who} lost connection`); }, MP_DROP_HOLD_MS));
    } else if (n.kind === 'reconnected') { if (!this.cancelDrop(who)) this.note(`${who} is back`); }
    else if (n.kind === 'new-host') {
      // Names are not unique (every new save is PotatoBazaar), so whether that is you comes from the seats in the room
      // update the server sends straight after this notice, not from the name.
      clearTimeout(this.hostNewsT);
      this.hostNews = who;
      this.hostNewsT = setTimeout(() => this.flushHostNews(), 2000);
    } else if (n.kind === 'settings' && this.lobbyVisible()) this.note('The host changed the race settings');
  },
  cancelDrop(who) { const t = this.drops.get(who); if (t === undefined) return false; clearTimeout(t); this.drops.delete(who); return true; },
  flushHostNews() {
    clearTimeout(this.hostNewsT); this.hostNewsT = 0;
    const who = this.hostNews; this.hostNews = null;
    if (who === null || !MP.room) return;
    this.note(MP.isHost() ? 'You are the host now' : `${who} is the host now`);
  },
  // notices still on hold belong to the room this page is leaving
  forgetRoomNews() {
    for (const t of this.drops.values()) clearTimeout(t);
    this.drops.clear();
    clearTimeout(this.hostNewsT); this.hostNewsT = 0; this.hostNews = null;
  },
  onClosed() {
    this.forgetRoomNews();
    this.note('That room has closed.');
    if (this.entryVisible() && this.busy === false) this.entryMsg('That room has closed.', true);
    if (this.lobbyVisible()) { this.hideLobby(); GAME.toMenu(); }
  },
  onStatus(s) {
    if (this.lobbyVisible()) this.render();
    if (s === 'reconnecting' && MP.room) { this.wasDown = true; this.note('Connection lost. Reconnecting…'); }
    else if (s === 'online' && this.wasDown) { this.wasDown = false; this.note('Reconnected'); if (this.lobbyVisible()) this.scheduleBackdrop(); }
    else if (s === 'offline') {
      if (!MP.room) this.forgetRoomNews();
      const was = this.wasDown; this.wasDown = false;
      if (this.lobbyVisible() && !this.leaving) {
        this.note(was ? 'Lost the connection to the room server.' : 'Disconnected from the room server.');
        this.hideLobby(); GAME.toMenu();
      }
    }
  },
  onError(e) {
    if (!e || !e.message) return;
    this.note(e.message);
    if (e.code === 'SUPERSEDED') this.forgetRoomNews();
    if (e.code === 'SUPERSEDED' && this.lobbyVisible()) { this.hideLobby(); GAME.toMenu(); }
  },

  // ── page load: a live session in this tab, or an invite link ──
  boot() {
    if (this.booted) return;
    this.booted = true;
    this.init();
    const raw = URLP.get('room'), pin = String(raw || '').replace(/\D/g, '');
    const s = MP.session(), invite = /^\d{4}$/.test(pin);
    // An invite to another room wins over the seat this tab holds: the player opened the link to go there. The old
    // seat is not taken back first, so if the invite does not work out, Friends can still return to it.
    if (s && invite && pin !== s.pin) this.inviteFlow(pin, s.pin);
    else if (s) this.bootResume();
    else if (invite) this.inviteFlow(pin);
    else if (raw !== null) { this.stripRoomParam(); this.showEntry({ msg: 'That invite link has no room PIN. Type the 4 digits here.', err: true }); }
  },
  // a reload (or an invite link to the room this tab is already in): take the seat back
  async bootResume(attempt = 0) {
    const ok = await MP.resume();
    if (!ok && MP.session() && attempt < 2) {   // the seat is still held (60 s): a network hiccup gets two more tries
      setTimeout(() => this.bootResume(attempt + 1), 2500);
      return;
    }
    if (ok) {
      this.stripRoomParam();
      if (GAME.state === 'menu' && !GAME.ui.modalOpen()) this.afterResume();
      else if (!(GAME.race && GAME.race.mp)) this.note(`You are still in room ${MP.room.pin}. Open Friends to go back to it.`);   // a resumed race needs no note
      return;
    }
    if (MP.session()) { this.note((MP.lastError || {}).message || MP.errorText('NETWORK')); return; }   // seat still held: Friends tries again
    this.note('That room has closed.');
    this.stripRoomParam();
  },
  // ?room=PIN: the dialog opens with the PIN in. A player with a name of their own joins at once; a new one names
  // themselves first. fromPin: the room this tab holds a seat in, which joining this one leaves.
  inviteFlow(pin, fromPin = null) {
    this.invitePin = pin;
    const named = !!SAVE.name && SAVE.name !== defaultSave().name;
    const away = fromPin ? ` Joining takes you out of room ${fromPin}.` : '';
    this.showEntry({ pin, focusName: !named, msg: named ? '' : `Type your name, then tap JOIN.${away}` });
    if (named) this.join(pin);
  },
  stripRoomParam() {
    try {
      const u = new URL(location.href);
      if (!u.searchParams.has('room')) return;
      u.searchParams.delete('room');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* the URL keeps its ?room= */ }
  },
};
if (typeof window !== 'undefined') window.__mpui = MPUI;

// Session and invite links are handled once the menu is up. Only a tab that has something to resume, or an invite link,
// waits for it, and it waits on animation frames, so a headless or solo run never starts anything here.
(function mpBootWatch() {
  if (typeof requestAnimationFrame !== 'function' || DEBUG.autopilot) return;
  if (!URLP.has('room') && !MP.session()) return;
  const t0 = Date.now();
  const tick = () => {
    if (GAME && GAME.state === 'menu' && GAME.ui) { MPUI.boot(); return; }
    if (Date.now() - t0 < 300000 && (!GAME || GAME.state === 'loading')) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
