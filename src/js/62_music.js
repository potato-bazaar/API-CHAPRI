// ───────────────────────── SOUNDTRACK: the game's own songs ─────────────────────────
// "Chapri" plays on the menu and results, "Bike Chase" (Telugu) during races. Both ship inside the page as MP3 and stream
// from blob URLs through Web Audio (MediaElementSource), so the volume slider, the pause muffle and a bass shelf apply
// and nothing big is decoded into memory. Each song has two players that crossfade at the end, so the loop never jumps.
// The live synth stays on top as the "VFX" layer: sub-bass booms, whistles, risers and HEY!s on the big moments,
// with the song ducking for a beat so they punch through.
const OST = {
  ok: false, cur: null, songs: {}, XF: 1.8, level: 1,
  init(c, dest) {
    this.c = c;
    this.bus = c.createGain(); this.bus.gain.value = 0.85;   // a notch under the synth so engine and hits sit on top
    this.low = c.createBiquadFilter(); this.low.type = 'lowshelf'; this.low.frequency.value = 100; this.low.gain.value = 3.5;   // bass top-up
    this.sub = c.createBiquadFilter(); this.sub.type = 'peaking'; this.sub.frequency.value = 52; this.sub.Q.value = 1.0; this.sub.gain.value = 2;
    this.hi = c.createBiquadFilter(); this.hi.type = 'highshelf'; this.hi.frequency.value = 7000; this.hi.gain.value = 0;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 18000; this.lp.Q.value = 0.5;      // countdown: muffled, opens on GO
    this.duckG = c.createGain(); this.duckG.gain.value = 1;
    this.bus.connect(this.low); this.low.connect(this.sub); this.sub.connect(this.hi); this.hi.connect(this.lp); this.lp.connect(this.duckG); this.duckG.connect(dest);
    // songs inside the page (the one-file build) play from blob URLs; the web build streams them from music/*.mp3
    for (const [k, id, file] of [['menu', 'musIntro', 'intro.mp3'], ['race', 'musRace', 'race.mp3'], ['police', 'musPolice', 'police.mp3']]) {
      try { const el = document.getElementById(id), b64 = el ? el.textContent.trim() : ''; let url;
        if (b64.length > 1000) { const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); el.textContent = ''; url = URL.createObjectURL(new Blob([u8], { type: 'audio/mpeg' })); }
        else if (location.protocol !== 'file:') url = 'music/' + file; else continue;
        this.songs[k] = { decks: [this.deck(url, !b64), this.deck(url, !b64)], i: 0, xf: false, remote: !b64 };
      } catch (e) { console.warn('soundtrack', k, e); } }
    this.ok = Object.keys(this.songs).length > 0;
    document.addEventListener('visibilitychange', () => { for (const S of Object.values(this.songs)) for (const d of S.decks) { if (document.hidden) { d.wasOn = !d.a.paused; d.a.pause(); } else if (d.wasOn) { d.wasOn = false; this.go(d.a); } } });
  },
  deck(url, remote) { const a = new Audio(); a.src = url; a.preload = remote ? 'metadata' : 'auto'; a.loop = false; a.addEventListener('error', () => { if (remote) { for (const [k, S] of Object.entries(this.songs)) if (S.decks.some(d => d.a === a)) { delete this.songs[k]; if (this.cur === k) this.cur = null; } this.ok = Object.keys(this.songs).length > 0; MUSIC.restyle(); } }); const g = this.c.createGain(); g.gain.value = 0; this.c.createMediaElementSource(a).connect(g); g.connect(this.bus); return { a, g }; },
  go(a) { const p = a.play(); if (p && p.catch) p.catch(() => {}); },
  fade(d, to, sec) { const t = this.c.currentTime; d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(to, t + Math.max(0.02, sec)); },
  // start a song (from the top unless it's already the one playing and keep is set); other songs fade out
  play(k, keep) {
    if (!this.ok) return; const S = this.songs[k];
    for (const [n, O] of Object.entries(this.songs)) if (n !== k) this.stopSong(O, 0.7);
    if (!S) { this.cur = null; return; }
    if (this.cur === k && keep && !S.decks[S.i].a.paused) return;
    const d = S.decks[S.i], o = S.decks[1 - S.i]; this.stopDeck(o, 0.3);
    if (this.cur !== k || !keep) { try { d.a.currentTime = 0; } catch (e) { } }
    this.fade(d, 1, 0.35); this.go(d.a); S.xf = false; this.cur = k;
    if (k === 'menu' && this.songs.race && this.songs.race.remote) this.songs.race.decks[0].a.preload = 'auto';   // warm the race song while on the menu
  },
  stopDeck(d, sec) { this.fade(d, 0, sec); clearTimeout(d.tm); d.tm = setTimeout(() => { if (d.g.gain.value < 0.02) d.a.pause(); }, sec * 1000 + 80); },
  stopSong(S, sec) { for (const d of S.decks) if (!d.a.paused) this.stopDeck(d, sec); S.xf = false; },
  stop(sec = 0.6) { for (const S of Object.values(this.songs)) this.stopSong(S, sec); this.cur = null; },
  // seamless loop: as the playing deck nears its end, the other deck starts from the top and they crossfade
  tick() {
    if (!this.cur) return; const S = this.songs[this.cur]; if (!S) return; const d = S.decks[S.i], a = d.a;
    if (a.paused || !isFinite(a.duration) || S.xf) return;
    if (a.duration - a.currentTime < this.XF) { S.xf = true; const n = S.decks[1 - S.i]; try { n.a.currentTime = 0; } catch (e) { } n.g.gain.value = 0; this.go(n.a); this.fade(n, 1, this.XF * 0.8); this.stopDeck(d, this.XF);
      S.i = 1 - S.i; setTimeout(() => { S.xf = false; }, this.XF * 1000 + 200); }
  },
  // 0 countdown (muffled), 1 racing, 2 boost / final lap: more bass, a little more air
  setLevel(l) { if (!this.ok || l === this.level) return; this.level = l; const t = this.c.currentTime;
    this.lp.frequency.setTargetAtTime(l === 0 ? 900 : 18000, t, l === 0 ? 0.05 : 0.18);
    this.low.gain.setTargetAtTime(l === 2 ? 7 : 3.5, t, 0.25); this.sub.gain.setTargetAtTime(l === 2 ? 5 : 2, t, 0.25); this.hi.gain.setTargetAtTime(l === 2 ? 2.5 : 0, t, 0.25); },
  menuLevel() { if (!this.ok) return; this.level = -1; const t = this.c.currentTime; this.lp.frequency.setTargetAtTime(18000, t, 0.2); this.low.gain.setTargetAtTime(3.5, t, 0.3); this.sub.gain.setTargetAtTime(2, t, 0.3); this.hi.gain.setTargetAtTime(0, t, 0.3); },
  // dip the song for a beat so a hit lands on top of it
  duck(depth = 0.5, sec = 0.4) { if (!this.ok || !this.cur) return; const t = this.c.currentTime, g = this.duckG.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(depth, t + 0.03); g.setTargetAtTime(1, t + 0.08, sec * 0.45); },
};

// ───────────────────────── MUSIC: original tunes, synthesised live (no files) ─────────────────────────
// Two styles. South Indian mass (default): parai + thavil koothu groove, a nadaswaram hook, brass and guitar stabs,
// theatre whistles and crowd "HEY!"s, plus a hero-entry theme for the winner. Dhinchak DJ: dhol + tabla + kick, a tumbi
// riff and a "been"-style lead in E Phrygian dominant. Menu = laid back; race climbs with speed, boost and the final lap.
const MUSIC = {
  on: false, mode: 'off', level: 0, step: 0, bar: 0, nextT: 0, timer: null, song: 0,
  init() {
    if (this.on || !AUDIO.ctx) return; const c = AUDIO.ctx; this.c = c;
    this.out = c.createGain(); this.out.gain.value = 0; this.out.connect(AUDIO.master);
    this.tone = c.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 18000; this.tone.Q.value = 0.7; this.tone.connect(this.out);
    this.bus = c.createGain(); this.bus.gain.value = 0.9; this.bus.connect(this.tone);
    // tumbi / lead echo (dotted eighth)
    this.dly = c.createDelay(1); this.fb = c.createGain(); this.fb.gain.value = 0.28; this.dlyOut = c.createGain(); this.dlyOut.gain.value = 0.32;
    this.dly.connect(this.fb); this.fb.connect(this.dly); this.dly.connect(this.dlyOut); this.dlyOut.connect(this.bus);
    OST.init(c, this.tone);
    this.on = true; this.applyVolume(); if (this.mode !== 'off') this.songFor(this.mode, 'off');   // the game may already be on the menu when sound unlocks
    this.timer = setInterval(() => this.tick(), 25);
  },
  applyVolume() { if (!this.on) return; const v = AUDIO.muted ? 0 : (SAVE.settings.music ?? 0.6) * 0.75; this.out.gain.setTargetAtTime(this.mode === 'off' ? 0 : v, this.c.currentTime, 0.3); },
  setMode(m) {
    if (!this.on || m === this.mode) { this.mode = m; return; }
    const was = this.mode; this.mode = m; this.applyVolume(); this.songFor(m, was);
    if (m === 'race' || m === 'entry' || (m === 'menu' && was === 'off')) { this.step = 0; this.bar = 0; this.ebar = 0; this.nextT = this.c.currentTime + 0.08; this.song = (this.song + 1) % 6; }
    this.tone.frequency.setTargetAtTime(m === 'pause' ? 700 : 18000, this.c.currentTime, 0.15);
  },
  // 0 = countdown build, 1 = racing, 2 = boost / final lap (everything in)
  setLevel(l) { this.level = l; if (this.ost && this.mode === 'race') OST.setLevel(l); },
  // which song plays: menu/results = "Chapri", race (and pause, muffled) = "Bike Chase"; the winner's entry stays live
  songFor(m, was) {
    if (!this.ost) { OST.stop(0.4); return; }
    if (m === 'menu') { OST.menuLevel(); OST.play('menu', was === 'menu' || was === 'off'); }
    else if (m === 'race') { const k = GAME && GAME.race && GAME.race.police && OST.songs.police ? 'police' : 'race';   // Police Express+ gets "Siren Motif"
      OST.play(k, was === 'pause'); if (was !== 'pause') { OST.level = -1; OST.setLevel(0); } }
    else if (m === 'pause') { }
    else OST.stop(m === 'entry' ? 0.25 : 0.6);
  },
  restyle() { if (this.on) this.songFor(this.mode, 'off'); },
  // the player's own songs (default) or one of the two live-synth styles
  get ost() { return (SAVE.settings.musicStyle || 'ost') === 'ost' && OST.ok; },
  get bpm() { return this.mode === 'entry' ? 146 : this.mass ? (this.mode === 'race' ? 152 : 112) : this.mode === 'race' ? 128 : 98; },
  // South Indian mass style (default) or the original dhinchak set; 'entry' is the winner's hero-entry theme
  get mass() { return (SAVE.settings.musicStyle || 'ost') !== 'dhinchak'; },
  tick() {
    if (!this.on || this.mode === 'off' || document.hidden) return;
    OST.tick(); if (this.ost && this.mode !== 'entry' && OST.cur) return;   // the songs cover menu, race and pause (the synth fills in if a song is missing)
    const c = this.c; if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05;
    const sixteenth = 60 / this.bpm / 4; this.dly.delayTime.setTargetAtTime(sixteenth * 3, c.currentTime, 0.05);
    const swing = this.mass || this.mode === 'entry' ? 0.03 : 0.08;
    while (this.nextT < c.currentTime + 0.12) {
      if (this.mode === 'entry') this.playEntry(this.nextT, this.step, this.ebar); else if (this.mass) this.playMass(this.nextT, this.step, this.bar); else this.playStep(this.nextT, this.step, this.bar);
      this.nextT += sixteenth * (this.step % 2 ? 1 - swing : 1 + swing); this.step++; if (this.step === 16) { this.step = 0; this.bar = (this.bar + 1) % 8; this.ebar = this.ebar >= 13 ? 6 : this.ebar + 1; } }
  },
  playStep(t, s, bar) {
    const S = SONGS[this.song % SONGS.length], race = this.mode === 'race', L = race ? this.level : 0.6, root = S.roots[bar];
    // drums
    if (race && L >= 1 && s % 4 === 0) this.kick(t, 0.9);
    if (S.dhol[s] === 2) this.dholBass(t, race ? 0.8 : 0.6); else if (S.dhol[s] === 1) this.tilli(t, race ? 0.5 : 0.35);
    if (S.tabla[s]) this.tabla(t, S.tabla[s], race ? 0.35 : 0.42);
    if (race && L >= 1 && (s === 4 || s === 12)) this.clap(t, 0.55);
    if (race && L >= 2 && s % 2 === 1) this.hat(t, 0.16);
    if (race && L >= 1 && s % 4 === 2) this.hat(t, 0.22);
    if (this.mode === 'menu' && s % 4 === 2) this.hat(t, 0.1);
    // bass on the dhol accents
    if (S.bass[s] && (race ? L >= 0.5 : true)) this.bass(t, noteHz(root + S.bass[s] - 1), race ? 0.5 : 0.38, S.bass[s] === 1 ? 0.16 : 0.1);
    // tumbi riff every other bar (every bar when it's flying)
    const riffOn = race ? (L >= 2 || bar % 2 === 1) && L >= 1 : bar % 4 >= 2;
    if (riffOn && S.riff[s] !== null) this.tumbi(t, noteHz(S.riff[s] + 64 + (bar >= 4 ? S.lift : 0)), race ? 0.28 : 0.22);
    // been lead on the B half when it's flying
    if (race && L >= 2 && bar >= 4 && S.lead[s] !== null) this.been(t, noteHz(S.lead[s] + 64), 60 / this.bpm / 4 * 1.9, 0.12);
    // fill into bar 1 + crash on the down beat
    if (race && bar === 7 && s >= 12) this.tabla(t, 'na', 0.45);
    if (race && L >= 1 && bar === 0 && s === 0) this.crash(t, 0.18);
  },
  // ── instruments ──
  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },
  osc(type, f, t, dur, vol, dest, f1) { const c = this.c, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8); this.env(g, t, 0.004, vol, dur); o.connect(g); g.connect(dest || this.bus); o.start(t); o.stop(t + dur + 0.05); return o; },
  nz(t, dur, f, q, vol, type = 'bandpass') { const c = this.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = AUDIO.noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; this.env(g, t, 0.002, vol, dur); s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); },
  kick(t, v) { this.osc('sine', 150, t, 0.26, v, null, 42); this.nz(t, 0.02, 3000, 1, v * 0.25); },
  dholBass(t, v) { this.osc('sine', 98, t, 0.32, v, null, 58); this.osc('triangle', 196, t, 0.06, v * 0.25); this.nz(t, 0.03, 700, 1.2, v * 0.4); },
  tilli(t, v) { this.nz(t, 0.06, 2600, 1.6, v); this.osc('triangle', 440, t, 0.05, v * 0.25); },
  tabla(t, kind, v) { if (kind === 'ge') { this.osc('sine', 110, t, 0.28, v * 1.2, null, 165); } else { this.osc('sine', 680, t, 0.12, v * 0.6); this.osc('sine', 1360, t, 0.07, v * 0.3); this.nz(t, 0.02, 4000, 2, v * 0.3); } },
  clap(t, v) { for (let i = 0; i < 3; i++) this.nz(t + i * 0.011, 0.05 + i * 0.03, 1300, 0.9, v * (i === 2 ? 1 : 0.6)); },
  hat(t, v) { this.nz(t, 0.035, 9000, 0.7, v, 'highpass'); },
  crash(t, v) { this.nz(t, 0.9, 7000, 0.5, v, 'highpass'); },
  bass(t, f, v, dur) { const c = this.c, o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f / 2;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(220, t + dur); lp.Q.value = 6; this.env(g, t, 0.006, v, dur + 0.05);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.bus); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1); },
  tumbi(t, f, v) { // bright plucked string: square + saw, very fast decay, a touch of pitch flick, into the echo
    const c = this.c, o = c.createOscillator(), o2 = c.createOscillator(), hp = c.createBiquadFilter(), g = c.createGain(); o.type = 'square'; o2.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.03, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.02); o2.frequency.setValueAtTime(f * 2.005, t);
    hp.type = 'bandpass'; hp.frequency.value = f * 2.2; hp.Q.value = 1.4; this.env(g, t, 0.002, v, 0.13);
    o.connect(hp); o2.connect(hp); hp.connect(g); g.connect(this.bus); g.connect(this.dly); o.start(t); o2.start(t); o.stop(t + 0.2); o2.stop(t + 0.2); },
  been(t, f, dur, v) { // reedy snake-charmer lead: saw through a nasal band-pass with vibrato
    const c = this.c, o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; lfo.frequency.value = 6.5; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 2.5; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.03); g.gain.setValueAtTime(v, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp); bp.connect(g); g.connect(this.bus); g.connect(this.dly); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05); },
  // ── South Indian mass: parai/thappu + thavil koothu groove, nadaswaram hook, brass + guitar stabs, whistles, crowd "HEY!" ──
  playMass(t, s, bar) {
    const S = MASS[this.song % MASS.length], race = this.mode === 'race', L = race ? this.level : 0.7, root = S.root + S.roots[bar], st = 60 / this.bpm / 4;
    if (L <= 0) {   // countdown: urumi growl, thavil ticks, a drone; tension, no groove yet
      if (s === 0 && bar % 2 === 0) this.urumi(t, 0.5, st * 14); if (s % 4 === 0) this.thavil(t, 'ta', 0.22 + (s === 12 ? 0.15 : 0)); if (s === 0) this.drone(t, noteHz(root - 12), st * 16, 0.06); return; }
    if (S.parai[s] === 2) this.parai(t, 'dhum', race ? 0.8 : 0.55); else if (S.parai[s] === 1) this.parai(t, 'ta', race ? 0.5 : 0.35);
    if (S.thavil[s]) this.thavil(t, S.thavil[s] === 2 ? 'dhi' : 'ta', race ? 0.42 : 0.3);
    if (race && L >= 1 && s % 4 === 0) this.kick(t, 0.85);
    if (race && L >= 1 && (s === 4 || s === 12)) this.clap(t, 0.5);
    if (race && L >= 2 && s % 2 === 1) this.hat(t, 0.13);
    if (S.bass[s]) this.bass(t, noteHz(root - 12 + S.bass[s] - 1), race ? 0.5 : 0.36, 0.14);
    // the hook: nadaswaram on bars 1-4 and 5-8 (every other phrase when not flying), brass doubling it when flying
    const half = bar >= 4 ? 1 : 0, ph = S.hook[(bar % 4)] || [], hookOn = race ? (L >= 2 || bar % 8 < 4) : bar % 8 >= 4;
    const n = ph[s]; if (hookOn && n !== undefined && n !== null && n !== '-') { let k = s + 1; while (k < 16 && ph[k] === '-') k++; const dur = (k - s) * st;
      this.nadaswaram(t, noteHz(S.root + 12 + n + (half && S.lift ? S.lift : 0)), dur, race ? 0.13 : 0.1); if (race && L >= 2) this.brass(t, [noteHz(S.root + n + (half ? S.lift : 0))], Math.min(dur, st * 1.5), 0.05); }
    // stabs: the "da-da-da" chord hits
    if (race && S.stab[s] && L >= 1) { const f = noteHz(root); this.brass(t, [f, f * 1.5, f * 2], st * 0.9, 0.06); this.guitar(t, f / 2, st * 0.9, 0.05); }
    if (race && L >= 2 && s % 2 === 0 && !S.stab[s]) this.guitar(t, noteHz(root - 12), st * 0.6, 0.025);   // palm-muted chug under it
    // whistles + crowd shouts when it's flying; a thavil roll into every 4th bar
    if (race && L >= 1 && bar % 4 === 0 && s === 0) this.whistle(t, 0.09);
    if (race && L >= 2 && (bar === 3 || bar === 7) && (s === 12 || s === 14)) this.hey(t, 0.32);
    if (bar % 4 === 3 && s >= 12) { this.thavil(t, 'ta', 0.32 + (s - 12) * 0.05); this.thavil(t + st / 2, 'ta', 0.28); }
    if (race && L >= 1 && bar === 0 && s === 0) this.crash(t, 0.16);
  },
  // the winner's entry: big drum hits and a whistle, the nadaswaram call, a thavil roll + "HEY!", then the full hook on loop
  playEntry(t, s, b) {
    const S = MASS[0], root = S.root, st = 60 / this.bpm / 4;
    if (b < 2) { if (s === 0 || s === 10) this.boom(t, 1); if (b === 0 && s === 4) this.whistle(t, 0.14); if (s === 8 && b === 1) this.whistle(t, 0.1);
      if (b === 1 && s === 0) this.nadaswaram(t, noteHz(root + 12), st * 6, 0.16, noteHz(root + 19)); if (b === 0 && s === 0) this.urumi(t, 0.6, st * 12); return; }
    if (b < 4) { this.thavil(t, s % 4 === 0 ? 'dhi' : 'ta', 0.2 + (b - 2) * 0.12 + s * 0.012); if (s % 4 === 0) this.parai(t, 'dhum', 0.7); if (b === 3 && (s === 12 || s === 14)) this.hey(t, 0.42); if (b === 3 && s === 0) this.riser(1.6); return; }
    this.level = 2; const save = this.mode; this.mode = 'race'; this.playMass(t, s, (b - 4) % 8); this.mode = save;
    if ((b - 4) % 2 === 1 && (s === 12 || s === 14)) this.hey(t, 0.36); if (s === 0 && (b - 4) % 4 === 0) this.whistle(t, 0.1);
  },
  parai(t, k, v) { if (k === 'dhum') { this.osc('sine', 120, t, 0.24, v, null, 62); this.nz(t, 0.05, 420, 1.1, v * 0.55); } else { this.nz(t, 0.05, 1900, 1.3, v * 0.9); this.osc('triangle', 330, t, 0.04, v * 0.3); } },
  thavil(t, k, v) { if (k === 'dhi') { this.osc('sine', 190, t, 0.2, v * 1.1, null, 150); this.nz(t, 0.04, 900, 2, v * 0.4); } else { this.osc('sine', 520, t, 0.06, v * 0.7, null, 380); this.nz(t, 0.025, 3600, 3, v * 0.6); } },
  boom(t, v) { this.osc('sine', 72, t, 1.1, v, null, 38); this.osc('sine', 110, t, 0.5, v * 0.5, null, 55); this.nz(t, 0.3, 300, 0.7, v * 0.45, 'lowpass'); this.nz(t, 1.4, 5200, 0.4, v * 0.12, 'highpass'); },
  urumi(t, v, dur) { // friction drum: a growling, bending low voice
    const c = this.c, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(85, t); o.frequency.linearRampToValueAtTime(150, t + dur * 0.45); o.frequency.linearRampToValueAtTime(95, t + dur); lfo.frequency.value = 11; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 4; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.08); g.gain.setValueAtTime(v * 0.5, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.bus); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05); },
  drone(t, f, dur, v) { for (const m of [1, 1.5, 2]) { const c = this.c, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f * m; lp.type = 'lowpass'; lp.frequency.value = 700; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v / m, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(lp); lp.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.05); } },
  nadaswaram(t, f, dur, v, fTo) { // loud double reed: bright saw + square through two nasal formants, a scooped attack (gamaka) and wide vibrato
    const c = this.c, o = c.createOscillator(), o2 = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), sh = this._shaper || (this._shaper = (() => { const w = c.createWaveShaper(), cv = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cv[i] = Math.tanh(x * 2.2); } w.curve = cv; return w; })());
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); if (fTo) o.frequency.exponentialRampToValueAtTime(fTo, t + dur * 0.8);
    o2.frequency.setValueAtTime(f * 0.94, t); o2.frequency.exponentialRampToValueAtTime(f, t + 0.05); if (fTo) o2.frequency.exponentialRampToValueAtTime(fTo, t + dur * 0.8);
    lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.018, t + Math.min(0.25, dur * 0.6)); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    f1.type = 'bandpass'; f1.frequency.value = 1150; f1.Q.value = 2.2; f2.type = 'peaking'; f2.frequency.value = 2600; f2.gain.value = 9; f2.Q.value = 1.5;
    const pre = c.createGain(); pre.gain.value = 0.6; o.connect(pre); o2.connect(pre); pre.connect(f1); f1.connect(f2); f2.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.025); g.gain.setValueAtTime(v, t + Math.max(0.03, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    g.connect(this.bus); g.connect(this.dly); o.start(t); o2.start(t); lfo.start(t); o.stop(t + dur + 0.08); o2.stop(t + dur + 0.08); lfo.stop(t + dur + 0.08); },
  brass(t, fs, dur, v) { const c = this.c; for (const f of fs) for (const dt of [-6, 6]) { const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.03); lp.frequency.exponentialRampToValueAtTime(900, t + dur); this.env(g, t, 0.01, v, dur); o.connect(lp); lp.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.05); } },
  guitar(t, f, dur, v) { const c = this.c, o = c.createOscillator(), o2 = c.createOscillator(), w = this._gshape || (this._gshape = (() => { const ws = c.createWaveShaper(), cv = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cv[i] = Math.tanh(x * 6); } ws.curve = cv; return ws; })()), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.498; const pre = c.createGain(); pre.gain.value = 0.5; o.connect(pre); o2.connect(pre);
    const sh = c.createWaveShaper(); sh.curve = w.curve; pre.connect(sh); lp.type = 'lowpass'; lp.frequency.value = 2400; sh.connect(lp); lp.connect(g); this.env(g, t, 0.004, v, dur); g.connect(this.bus); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); },
  whistle(t, v) { // a two-finger theatre whistle: up, hold, swoop down
    const c = this.c, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(3100, t + 0.09); o.frequency.setValueAtTime(3100, t + 0.32); o.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.04); g.gain.setValueAtTime(v, t + 0.38); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.6);
    this.nz(t, 0.5, 3000, 4, v * 0.15); },
  hey(t, v) { // a crowd shouting "HEY!": detuned voices through an "e" vowel, with a breathy "h"
    const c = this.c; this.nz(t, 0.06, 1800, 0.8, v * 0.35, 'highpass');
    for (let i = 0; i < 6; i++) { const f = 150 + Math.random() * 90, o = c.createOscillator(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), g = c.createGain(), tt = t + 0.02 + Math.random() * 0.03;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.12, tt); o.frequency.exponentialRampToValueAtTime(f * 0.88, tt + 0.22); a.type = 'bandpass'; a.frequency.value = 560; a.Q.value = 5; b.type = 'bandpass'; b.frequency.value = 1900; b.Q.value = 7;
      const mix = c.createGain(); mix.gain.value = 1; o.connect(a); o.connect(b); a.connect(mix); b.connect(mix); mix.connect(g); this.env(g, tt, 0.02, v * 0.5, 0.2); g.connect(this.bus); o.start(tt); o.stop(tt + 0.3); } },
  // stingers
  hornStab() { if (!this.on || this.mode !== 'race') return; const t = this.c.currentTime + 0.01;
    if (this.ost) { OST.duck(0.45, 0.45); this.boom(t, 0.5); this.whistle(t + 0.05, 0.07); return; }   // no pitched notes over a song: sub drop + whistle
    if (this.mass) { const f = noteHz(50); this.brass(t, [f, f * 1.5, f * 2], 0.3, 0.09); this.whistle(t + 0.05, 0.08); return; } for (const n of [64, 68, 71, 76]) this.osc('sawtooth', noteHz(n), t, 0.22, 0.07); },
  riser(dur = 1.6) { if (!this.on) return; const c = this.c, t = c.currentTime, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = AUDIO.noiseBuf; fl.type = 'bandpass'; fl.Q.value = 3;
    fl.frequency.setValueAtTime(300, t); fl.frequency.exponentialRampToValueAtTime(6000, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(t); s.stop(t + dur + 0.2); if (this.ost) { this.boom(t + dur, 0.55); this.hey(t + dur + 0.02, 0.4); } },
};
const noteHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Patterns: 16 steps per bar. dhol: 2 = dagga (bass hit), 1 = tilli (stick). riff/lead: semitones above E4 (null = rest).
// roots: semitone offsets for the 8 bars (E, F, D, E…). bass: 1 = root, other numbers = degree offset + 1.
const SONGS = [
  { // "Gali No. 1"
    dhol: [2, 0, 1, 2, 0, 1, 2, 0, 2, 0, 1, 2, 0, 1, 1, 1], tabla: [0, 0, 'na', 0, 'ge', 0, 'na', 0, 0, 'na', 0, 0, 'ge', 0, 'na', 'na'],
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 8, 0, 0, 1, 0], roots: [40, 40, 41, 41, 38, 38, 40, 40],
    riff: [12, 12, null, 12, 8, 12, null, 13, 12, null, 10, 8, 7, null, 8, null], lead: [12, null, 13, null, 16, null, 13, 12, 10, null, 8, null, 7, 8, 4, null], lift: 0 },
  { // "Kichad Express"
    dhol: [2, 1, 0, 2, 1, 0, 2, 1, 2, 1, 0, 2, 1, 0, 2, 1], tabla: ['na', 0, 0, 'na', 0, 'ge', 0, 'na', 'na', 0, 0, 'na', 0, 'ge', 'na', 0],
    bass: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 5, 0, 0], roots: [40, 40, 40, 40, 41, 41, 43, 41],
    riff: [7, null, 8, 7, null, 4, 7, null, 12, null, 11, 8, null, 7, 8, null], lead: [16, null, 17, 16, 13, null, 12, null, 13, null, 12, 8, null, 7, null, null], lift: 5 },
  { // "Bandstand Bounce"
    dhol: [2, 0, 1, 0, 2, 1, 0, 1, 2, 0, 1, 0, 2, 1, 1, 1], tabla: [0, 'na', 0, 'ge', 0, 'na', 'na', 0, 0, 'na', 0, 'ge', 0, 'na', 0, 'na'],
    bass: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 4, 0, 0, 1], roots: [40, 41, 40, 38, 40, 41, 43, 40],
    riff: [0, 4, 7, 8, 7, 4, null, 8, 12, null, 8, 7, 4, null, 1, 0], lead: [12, null, null, 13, 12, 10, null, 8, 7, null, 8, 10, 12, null, null, null], lift: 7 },
];
// Mass songs: 16 steps per bar. parai: 2 = dhum (low), 1 = ta (slap) in a 3-3-2 koothu feel. thavil: 1 = ta, 2 = dhi.
// hook: 4 bars of nadaswaram (semitones above root; '-' holds, null rests), heroic repeated notes. stab: chord hits.
// Scale: Mayamalavagowla-style double-harmonic (0 1 4 5 7 8 11). All tunes here are original.
const MASS = [
  { name: 'Gethu Entry', root: 50, roots: [0, 0, 0, 0, 5, 5, 7, 0], lift: 0,
    parai: [2, 0, 0, 2, 0, 0, 2, 0, 1, 0, 1, 2, 0, 0, 1, 1], thavil: [0, 1, 0, 1, 2, 0, 1, 0, 0, 1, 0, 1, 2, 0, 1, 1],
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 8, 0], stab: [1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hook: [[0, 0, 0, null, 0, 0, 0, null, 4, '-', 5, '-', 7, '-', '-', '-'], [8, '-', 7, '-', 5, '-', 4, '-', 5, 4, 1, '-', 0, '-', '-', null],
      [7, 7, 7, null, 7, 7, 7, null, 8, '-', 11, '-', 12, '-', '-', '-'], [13, '-', 12, '-', 11, '-', 8, '-', 7, '-', 8, 7, 4, '-', 0, null]] },
  { name: 'Kuthu Kalakki', root: 45, roots: [0, 0, 5, 5, 0, 0, 7, 7], lift: 5,
    parai: [2, 0, 1, 2, 0, 1, 2, 0, 2, 0, 1, 2, 0, 1, 2, 1], thavil: [1, 1, 0, 1, 2, 0, 1, 1, 0, 1, 1, 0, 2, 1, 0, 1],
    bass: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 5, 0, 0], stab: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0],
    hook: [[12, '-', 11, 12, '-', 8, 7, '-', 8, '-', 7, 5, 4, '-', '-', null], [5, 5, 5, null, 7, 7, 7, null, 8, 7, 5, 4, 1, '-', 0, null],
      [12, '-', 13, 12, '-', 11, 12, '-', 16, '-', 13, 12, 11, '-', '-', null], [8, 8, 8, null, 7, 7, 7, null, 5, 4, 1, '-', 0, '-', '-', null]] },
  { name: 'Thara Local', root: 52, roots: [0, 0, 1, 1, 0, 0, 5, 7], lift: 7,
    parai: [2, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 2, 0, 1, 0], thavil: [0, 1, 1, 0, 2, 0, 0, 1, 1, 0, 1, 0, 2, 1, 1, 1],
    bass: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 4, 0, 0, 1], stab: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1],
    hook: [[0, '-', 1, '-', 4, '-', 5, '-', 7, 7, 7, null, 7, 8, 7, null], [5, '-', 4, '-', 5, 7, 5, 4, 1, '-', '-', '-', 0, '-', '-', null],
      [7, '-', 8, '-', 11, '-', 12, '-', 12, 12, 12, null, 12, 13, 12, null], [11, '-', 8, '-', 7, 8, 7, 5, 4, '-', 1, '-', 0, '-', '-', null]] },
];
