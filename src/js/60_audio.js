// ───────────────────────── AUDIO (Web Audio synthesis, no files) ─────────────────────────
const AUDIO = {
  ctx: null, on: false, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; this.master.connect(comp); comp.connect(c.destination);
    this.sfxG = c.createGain(); this.sfxG.connect(this.master); this.engG = c.createGain(); this.engG.connect(this.master);
    this.applyVolumes();
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate); const ch = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    this.eng = this.makeEngine(1.0); this.riv = this.makeEngine(0.0, true);
    // wind + rain beds
    this.wind = this.noiseBed('highpass', 900, 0); this.rain = this.noiseBed('bandpass', 2600, 0); this.city = this.noiseBed('lowpass', 420, 0.025);
    // tyres: a low scrub that grows as you use the grip, a squeal when the rear steps out, and wet hiss under the spray
    this.scrub = this.noiseBed('bandpass', 900, 0, 1.4); this.squealB = this.noiseBed('bandpass', 2300, 0, 9); this.hiss = this.noiseBed('highpass', 3200, 0);
    this.on = true;
    MUSIC.init(); if (GAME && GAME.musicMode) MUSIC.setMode(GAME.musicMode);
  },
  applyVolumes() { if (!this.ctx) return; const m = this.muted ? 0 : 1; this.sfxG.gain.value = SAVE.settings.sfx * m; this.engG.gain.value = SAVE.settings.engine * 0.55 * m; MUSIC.applyVolume(); },
  noiseBed(type, f, g0, q) { const c = this.ctx; const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.9 + Math.random() * 0.2; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; const g = c.createGain(); g.gain.value = g0; src.connect(fl); fl.connect(g); g.connect(this.sfxG); src.start(0, Math.random() * 1.5); g.fl = fl; return g; },
  makeEngine(vol, rival) {
    const c = this.ctx; const out = c.createGain(); out.gain.value = vol * 0.0; out.connect(this.engG);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 3;
    const shaper = c.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); } shaper.curve = curve;
    const pre = c.createGain(); pre.gain.value = 0.5;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; const o2 = c.createOscillator(); o2.type = 'square'; const o3 = c.createOscillator(); o3.type = 'sawtooth'; o3.detune.value = 18;
    const g1 = c.createGain(); g1.gain.value = 0.55; const g2 = c.createGain(); g2.gain.value = 0.35; const g3 = c.createGain(); g3.gain.value = 0.3;
    // two-stroke "ring-ding": amplitude flutter at half firing frequency
    const am = c.createGain(); am.gain.value = 0.75; const lfo = c.createOscillator(); lfo.type = 'square'; const lfoG = c.createGain(); lfoG.gain.value = 0.25; lfo.connect(lfoG); lfoG.connect(am.gain);
    const nz = c.createBufferSource(); nz.buffer = this.noiseBuf; nz.loop = true; const nbp = c.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 1800; nbp.Q.value = 0.8; const ng = c.createGain(); ng.gain.value = 0.12;
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(pre); g2.connect(pre); g3.connect(pre); nz.connect(nbp); nbp.connect(ng); ng.connect(pre);
    pre.connect(shaper); shaper.connect(am); am.connect(lp); lp.connect(out);
    [o1, o2, o3, lfo].forEach(o => o.start()); nz.start();
    return { out, lp, o1, o2, o3, lfo, ng, base: vol };
  },
  // silencer mods colour the note: lambi pipe is brighter, twin is louder, dragon is raspier
  setEngine(e, rpm, thr, vol, boost, ex) {
    if (!this.on) return; const t = this.ctx.currentTime; const f = rpm / 60; const X = { long: [260, 1.08, 0.02], twin: [140, 1.16, 0.0], dragon: [420, 1.12, 0.06] }[ex] || [0, 1, 0]; vol *= X[1];
    e.o1.frequency.setTargetAtTime(f, t, 0.03); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); e.o3.frequency.setTargetAtTime(f * 2.01, t, 0.03); e.lfo.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    e.lp.frequency.setTargetAtTime(500 + X[0] + rpm * 0.22 * (0.45 + thr * 0.75) + (boost ? 900 : 0), t, 0.05);
    e.ng.gain.setTargetAtTime(0.06 + X[2] + thr * 0.12 + (boost ? 0.12 : 0), t, 0.05);
    e.out.gain.setTargetAtTime(vol * (0.35 + thr * 0.4), t, 0.06);
  },
  update(race, dt) {
    if (!this.on) return; const t = this.ctx.currentTime;
    if (!race) { this.siren(0); this.setEngine(this.eng, 1800, 0.1, 0.4, false); this.riv.out.gain.setTargetAtTime(0, t, 0.2); this.wind.gain.setTargetAtTime(0, t, 0.3); this.rain.gain.setTargetAtTime(GAME && GAME.wet ? 0.08 : 0, t, 0.3); for (const b of [this.scrub, this.squealB, this.hiss]) b.gain.setTargetAtTime(0, t, 0.2); return; }
    const P = race.player; const vol = P.engineOff ? 0 : P.crashed ? 0.15 : 1;
    const ex = P.st && P.st.mods ? P.st.mods.exhaust : 'stock'; this.setEngine(this.eng, P.rpm, P.crashed ? 0 : P.input.throttle, vol, P.boosting, ex);
    // dragon / lambi pipe: backfire pops when you snap off the throttle at high revs
    const thr = P.crashed ? 0 : P.input.throttle; if ((ex === 'dragon' || ex === 'long') && (this._thr || 0) > 0.7 && thr < 0.2 && P.rpm > 5200) for (let i = 0; i < (ex === 'dragon' ? 3 : 2); i++) { this.noise(0.05, 900 + Math.random() * 600, 1.5, 0.35, 'bandpass', i * 0.07 + Math.random() * 0.03); this.tone('square', 120, 60, 0.05, 0.1, i * 0.07); }
    this._thr = thr;
    let near = null, nd = 1e9; for (const r of race.riders) { if (r === P || r.eliminated) continue; const d = Math.abs(r.dist - P.dist) + Math.abs(r.d - P.d) * 2; if (d < nd) { nd = d; near = r; } }
    if (near) { const closing = (P.v - near.v) * Math.sign(near.dist - P.dist || 1); const doppler = 1 + 0.16 * Math.tanh(closing / 6); this.setEngine(this.riv, near.rpm * 0.97 * doppler, near.input.throttle, clamp(1 - nd / 35, 0, 1) * 0.75, near.boosting); } else this.riv.out.gain.setTargetAtTime(0, t, 0.2);
    this.siren(race.police && race.state === 'racing' ? clamp(1.1 - (race.police.copDist || 99) / 90, 0.1, 1) : 0);
    const vn = clamp(P.v / 30, 0, 1.3); this.wind.gain.setTargetAtTime(vn * vn * 0.17 + (P.boosting ? 0.07 : 0), t, 0.15);
    this.rain.gain.setTargetAtTime(race.wet ? (race.world && race.world.ugCover ? 0.02 : 0.11) : 0, t, 0.5);
    // tyre voice
    const onRoad = !P.crashed && !P.air && P.v > 3, demand = onRoad ? Math.abs(P.omega * P.v) / Math.max(1, P.gripLat) : 0;
    const scrub = onRoad ? clamp((demand - 0.55) * 1.6, 0, 0.7) + (P.input.brake > 0.6 && P.v > 9 ? 0.35 : 0) + (P.surf === 1 || P.surf === 2 ? 0.25 : P.surf === 5 ? 0.18 : 0) : 0;
    this.scrub.gain.setTargetAtTime(scrub * 0.12 * clamp(P.v / 15, 0.3, 1), t, 0.06); this.scrub.fl.frequency.setTargetAtTime(500 + P.v * 22, t, 0.1);
    const sq = onRoad && !race.wet && P.surf === 0 ? clamp((P.sliding ? 0.8 : 0) + (P.stoppie ? 0.6 : 0) + clamp((demand - 0.9) * 3, 0, 0.5), 0, 1) : 0;
    this.squealB.gain.setTargetAtTime(sq * 0.07, t, 0.05); this.squealB.fl.frequency.setTargetAtTime(1900 + P.v * 18 + (P.sliding ? 300 : 0), t, 0.08);
    this.hiss.gain.setTargetAtTime(race.wet && onRoad ? clamp(P.v / 28, 0, 1.2) * 0.1 : 0, t, 0.15);
  },
  scrape(v = 1) { if (!this.on) return; this.noise(0.28, 2600, 1.2, 0.35 * v, 'bandpass'); this.noise(0.18, 5200, 2, 0.18 * v, 'highpass', 0.02); this.tone('sawtooth', 1800, 900, 0.18, 0.03 * v); },
  tone(type, f0, f1, dur, vol, delay = 0) { if (!this.on) return; const c = this.ctx, t = c.currentTime + delay; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.02); },
  noise(dur, f, q, vol, type = 'bandpass', delay = 0) { if (!this.on) return; const c = this.ctx, t = c.currentTime + delay; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(fl); fl.connect(g); g.connect(this.sfxG); s.start(t, Math.random()); s.stop(t + dur + 0.02); },
  gunshot(v = 1) { if (v < 0.05) return; this.noise(0.09, 3200, 0.6, 0.9 * v, 'bandpass'); this.noise(0.25, 700, 0.8, 0.5 * v, 'lowpass', 0.01); this.tone('sine', 160, 45, 0.16, 0.55 * v); },
  bark(v = 1) { if (v < 0.05) return; for (const d of [0, 0.16]) { this.tone('square', 540, 360, 0.07, 0.16 * v, d); this.noise(0.06, 900, 2, 0.18 * v, 'bandpass', d); } },
  yelp(v = 1) { if (v < 0.05) return; this.tone('triangle', 1300, 700, 0.2, 0.22 * v); this.tone('triangle', 1100, 600, 0.16, 0.15 * v, 0.2); },
  // police siren: a two-tone wail, louder as the nearest cop closes in
  siren(level) {
    if (!this.on) return; const c = this.ctx, t = c.currentTime;
    if (!this._sir) { const o = c.createOscillator(); o.type = 'sawtooth'; const lfo = c.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 0.55; const lg = c.createGain(); lg.gain.value = 320; lfo.connect(lg); lg.connect(o.frequency); o.frequency.value = 950;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.9; const g = c.createGain(); g.gain.value = 0; o.connect(bp); bp.connect(g); g.connect(this.sfxG); o.start(); lfo.start(); this._sir = { o, lfo, g }; }
    this._sir.g.gain.setTargetAtTime(level * 0.09, t, 0.25);
  },
  beep(go) { this.tone('square', go ? 880 : 520, go ? 880 : 520, go ? 0.5 : 0.22, 0.18); },
  dhishoom(v = 1) { if (v < 0.05) return; this.tone('sine', 140, 38, 0.32, 0.9 * v); this.noise(0.18, 900, 1.2, 0.6 * v); this.tone('square', 620, 160, 0.16, 0.12 * v, 0.02); },
  whoosh(v = 1) { this.noise(0.25, 1400, 0.7, 0.35 * v, 'bandpass'); },
  thuk() { this.noise(0.12, 600, 2, 0.5); this.tone('sine', 260, 90, 0.1, 0.3); },
  glass(v = 1) { if (v < 0.05) return; for (let i = 0; i < 5; i++) this.tone('triangle', 2400 + Math.random() * 2600, 1800 + Math.random() * 1000, 0.18 + Math.random() * 0.2, 0.12 * v, i * 0.025); this.noise(0.3, 5200, 1, 0.4 * v, 'highpass'); },
  thud(v = 1) { this.tone('sine', 110, 45, 0.22, 0.7 * v); this.noise(0.12, 300, 1, 0.4 * v, 'lowpass'); },
  crash(v = 1) { if (v < 0.05) return; this.noise(0.9, 700, 0.5, 0.7 * v, 'lowpass'); this.tone('sawtooth', 220, 50, 0.5, 0.2 * v); for (let i = 0; i < 4; i++) this.noise(0.08, 3000, 3, 0.25 * v, 'bandpass', 0.1 + i * 0.12); },
  pickup() { this.tone('triangle', 660, 990, 0.12, 0.25); this.tone('triangle', 990, 1320, 0.14, 0.2, 0.08); },
  lap() { this.tone('triangle', 784, 784, 0.12, 0.2); this.tone('triangle', 1046, 1046, 0.2, 0.2, 0.12); },
  finish(win) { const n = win ? [523, 659, 784, 1046] : [523, 659, 784]; n.forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.22, i * 0.14)); },
  warn() { this.tone('square', 1200, 1200, 0.06, 0.08); this.tone('square', 1200, 1200, 0.06, 0.08, 0.1); },
  horn() { this.tone('square', 415, 410, 0.18, 0.18); this.tone('square', 520, 515, 0.18, 0.12); this.tone('square', 415, 410, 0.22, 0.18, 0.24); this.tone('square', 520, 515, 0.22, 0.12, 0.24); },
  // passing a pole, pillar, banner or rider: a short panned swish that brightens with speed
  whooshBy(vol, pan, speed, rider = false) {
    if (!this.on || vol < 0.03) return; const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.9 + Math.random() * 0.3;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = rider ? 0.9 : 1.6; const f0 = 700 + speed * 60;
    bp.frequency.setValueAtTime(f0 * 1.7, t); bp.frequency.exponentialRampToValueAtTime(f0 * 0.4, t + (rider ? 0.45 : 0.26));
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * (rider ? 0.7 : 0.5), t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + (rider ? 0.5 : 0.3));
    src.connect(bp); bp.connect(g);
    if (c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = clamp(pan, -1, 1); g.connect(pn); pn.connect(this.sfxG); } else g.connect(this.sfxG);
    src.start(t, Math.random()); src.stop(t + 0.55);
  },
  boostKick() {
    if (!this.on) return; this.tone('sine', 110, 36, 0.4, 0.9); this.tone('sawtooth', 160, 520, 0.28, 0.07);
    const c = this.ctx, t = c.currentTime; const src = c.createBufferSource(); src.buffer = this.noiseBuf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(3600, t + 0.45); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(bp); bp.connect(g); g.connect(this.sfxG); src.start(t); src.stop(t + 0.65);
  },
  thunder(delay = 0.6) { if (!this.on) return; this.noise(0.18, 1800, 0.8, 0.35, 'bandpass', delay); this.noise(2.6, 140, 0.7, 0.9, 'lowpass', delay + 0.05); this.tone('sine', 52, 34, 2.2, 0.35, delay + 0.08); },
  splash(v = 1) { this.noise(0.35, 1200, 0.6, 0.45 * v, 'bandpass'); this.noise(0.2, 3500, 1, 0.2 * v, 'highpass', 0.03); },
  squeal(v = 1) { if (!this.on) return; this.tone('sawtooth', 1350, 1150, 0.35, 0.05 * v); this.noise(0.4, 2400, 6, 0.25 * v, 'bandpass'); },
  coin() { this.tone('square', 988, 988, 0.06, 0.12); this.tone('square', 1319, 1319, 0.18, 0.12, 0.06); },
  trainHorn(v = 1, delay = 0) { if (!this.on || v < 0.05) return; for (const f of [311, 392]) this.tone('sawtooth', f, f * 0.985, 1.1, 0.07 * v, delay); this.noise(1.2, 900, 0.5, 0.08 * v, 'lowpass', delay); },
  click() { this.tone('triangle', 900, 700, 0.05, 0.12); },
  setMuted(m) { this.muted = m; this.applyVolumes(); },
  // tunnel echo: engine + effects into a short generated room; only wired up while it's in use
  setVerb(k) {
    if (!this.on || k === this._verbK) return; this._verbK = k; const c = this.ctx;
    if (!this.verb) { if (k <= 0) return; const len = Math.floor(c.sampleRate * 1.25), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch), pre = Math.floor(c.sampleRate * (0.014 + ch * 0.006)); for (let i = pre; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      this.verb = c.createConvolver(); this.verb.buffer = ir; this.verbG = c.createGain(); this.verbG.gain.value = 0; this.verb.connect(this.verbG); this.verbG.connect(this.master); this.verbOn = false; }
    clearTimeout(this._vt);
    if (k > 0 && !this.verbOn) { this.engG.connect(this.verb); this.sfxG.connect(this.verb); this.verbOn = true; }
    this.verbG.gain.setTargetAtTime(Math.max(0, k), c.currentTime, 0.35);
    if (k <= 0 && this.verbOn) this._vt = setTimeout(() => { if (this.verbOn && this._verbK <= 0) { try { this.engG.disconnect(this.verb); this.sfxG.disconnect(this.verb); } catch (e) { } this.verbOn = false; } }, 3000);
  },
};
