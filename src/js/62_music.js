// ───────────────────────── MUSIC: original chapri DJ beats, synthesised live (no files) ─────────────────────────
// Dhol + tabla + four-on-the-floor kick, a tumbi riff and a "been"-style lead in E Phrygian dominant
// (E F G# A B C D). Menu = laid-back groove; race = full dhinchak that climbs with speed, boost and the final lap.
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
    this.on = true; this.applyVolume();
    this.timer = setInterval(() => this.tick(), 25);
  },
  applyVolume() { if (!this.on) return; const v = AUDIO.muted ? 0 : (SAVE.settings.music ?? 0.6) * 0.75; this.out.gain.setTargetAtTime(this.mode === 'off' ? 0 : v, this.c.currentTime, 0.3); },
  setMode(m) {
    if (!this.on || m === this.mode) { this.mode = m; return; }
    const was = this.mode; this.mode = m; this.applyVolume();
    if (m === 'race' || (m === 'menu' && was === 'off')) { this.step = 0; this.bar = 0; this.nextT = this.c.currentTime + 0.08; this.song = (this.song + 1) % SONGS.length; }
    this.tone.frequency.setTargetAtTime(m === 'pause' ? 700 : 18000, this.c.currentTime, 0.15);
  },
  // 0 = countdown build, 1 = racing, 2 = boost / final lap (everything in)
  setLevel(l) { this.level = l; },
  get bpm() { return this.mode === 'race' ? 128 : 98; },
  tick() {
    if (!this.on || this.mode === 'off' || document.hidden) return;
    const c = this.c; if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05;
    const sixteenth = 60 / this.bpm / 4; this.dly.delayTime.setTargetAtTime(sixteenth * 3, c.currentTime, 0.05);
    while (this.nextT < c.currentTime + 0.12) { this.playStep(this.nextT, this.step, this.bar); this.nextT += sixteenth * (this.step % 2 ? 0.92 : 1.08); this.step++; if (this.step === 16) { this.step = 0; this.bar = (this.bar + 1) % 8; } }
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
  // stingers
  hornStab() { if (!this.on || this.mode !== 'race') return; const t = this.c.currentTime + 0.01; for (const n of [64, 68, 71, 76]) this.osc('sawtooth', noteHz(n), t, 0.22, 0.07); },
  riser(dur = 1.6) { if (!this.on) return; const c = this.c, t = c.currentTime, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = AUDIO.noiseBuf; fl.type = 'bandpass'; fl.Q.value = 3;
    fl.frequency.setValueAtTime(300, t); fl.frequency.exponentialRampToValueAtTime(6000, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(t); s.stop(t + dur + 0.2); },
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
