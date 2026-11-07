// ───────────────────────── AUDIO (Web Audio synthesis, no files) ─────────────────────────
// ── Two-stroke engine voices ──
// A two-stroke single fires once per revolution, so the engine is played as what it really is: a train of exhaust
// pulses (rpm/60 a second: ~25 at idle, ~150 at the limiter). Each pulse is a short burst built offline: the
// blow-down click, a body thump, the pipe's resonances ringing down and a puff of gas noise. The silencer decides those
// resonances, which is why a stock RX "beat", a cut free-flow pipe and an expansion chamber sound so different
// from the same engine. At light throttle the engine 4-strokes (every other firing goes weak): the "ring-ding-ding".
// Snapping the throttle shut at high revs makes it crackle and pop.
//   body: [Hz, decay ms, amp]   res: [[Hz, decay ms, amp]…]   noise: [amp, centre Hz, decay ms]
//   tone: open-throttle lowpass Hz   drive: saturation   gain: loudness   misfire: 4-stroking at light load
//   pops: backfires when you snap off   crackle: idle-down crackle   band: [rpm on, rpm full, peak Hz, dB] powerband scream
//   low: loudness below the powerband   pan: twin pipes alternate left/right
const ENGINE_VOICES = {
  stock:   { body: [96, 18, 0.62], res: [[182, 15, 0.5], [530, 9, 0.34], [1260, 5, 0.16]], noise: [0.16, 950, 9], tone: 2100, drive: 1.5, gain: 1.0, misfire: 0.38, pops: 0, crackle: 0 },
  free:    { body: [112, 13, 0.82], res: [[245, 12, 0.6], [790, 10, 0.5], [1900, 7, 0.36], [3300, 4, 0.2]], noise: [0.42, 1700, 11], tone: 4400, drive: 2.3, gain: 1.08, misfire: 0.46, pops: 2, crackle: 0.05 },
  chamber: { body: [86, 11, 0.48], res: [[165, 10, 0.32], [640, 15, 0.46], [1480, 24, 0.58], [2900, 9, 0.16]], noise: [0.24, 2300, 9], tone: 2600, drive: 1.9, gain: 0.95, misfire: 0.3, pops: 1, crackle: 0.02, band: [5400, 8000, 1500, 9], low: 0.72 },
  long:    { body: [70, 26, 0.92], res: [[128, 21, 0.62], [415, 12, 0.34], [960, 6, 0.14]], noise: [0.14, 700, 10], tone: 1250, drive: 1.7, gain: 1.02, misfire: 0.42, pops: 2, crackle: 0.02 },
  twin:    { body: [101, 16, 0.72], res: [[205, 12, 0.5], [610, 10, 0.4], [1520, 6, 0.24]], noise: [0.28, 1250, 10], tone: 2700, drive: 1.8, gain: 1.9, misfire: 0.36, pops: 1, crackle: 0.02, pan: 0.42 },
  dragon:  { body: [90, 14, 0.7], res: [[212, 10, 0.44], [910, 8, 0.44], [2650, 6, 0.42]], noise: [0.68, 2700, 16], tone: 5200, drive: 3.0, gain: 1.15, misfire: 0.5, pops: 4, crackle: 0.08 },
};
// one pulse as an AudioBuffer: kind 'n' normal, 'w' weak (4-stroke miss), 'p' pop (backfire)
function enginePulse(c, V, kind, rng) {
  const sr = c.sampleRate, dur = kind === 'p' ? 0.17 : 0.08, n = Math.floor(sr * dur), buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const amp = kind === 'w' ? 0.32 : kind === 'p' ? 1.0 : 0.84 + rng() * 0.16;
  const res = V.res.map(([f, dec, a]) => [2 * Math.PI * f * (1 + (rng() - 0.5) * 0.06), 1000 / dec, a * (0.85 + rng() * 0.3), rng() * 6.283]);
  const [bf, bd, ba] = V.body, w0 = 2 * Math.PI * bf, kb = 1000 / bd;
  const [na, nf, nd] = V.noise, nA = kind === 'p' ? na * 2.6 + 0.5 : kind === 'w' ? na * 1.4 : na, kn = 1000 / (nd * (kind === 'p' ? 4 : 1));
  const F = 2 * Math.sin(Math.PI * Math.min(nf, sr / 6) / sr), q = 0.9; let lo = 0, bp = 0;   // state-variable band-pass for the gas noise
  const ta = 0.0005 + rng() * 0.0003;
  for (let i = 0; i < n; i++) {
    const t = i / sr; let s = 1.1 * (t / ta) * Math.exp(1 - t / ta);                 // blow-down click
    s += ba * Math.exp(-t * kb) * Math.sin(w0 * t);                                   // body thump
    for (let k = 0; k < res.length; k++) { const r = res[k]; s += r[2] * Math.exp(-t * r[1]) * Math.sin(r[0] * t + r[3]); }
    const x = Math.random() * 2 - 1; lo += F * bp; const hi = x - lo - q * bp; bp += F * hi;
    s += nA * 2.2 * bp * Math.exp(-t * kn);
    if (kind === 'p') s += 0.9 * Math.exp(-t * 28) * Math.sin(2 * Math.PI * 58 * t) + 0.5 * Math.exp(-t * 60) * (Math.random() * 2 - 1);   // the "phat" of a backfire
    d[i] = s * amp;
  }
  const fade = Math.floor(sr * 0.008); for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;   // no click at the tail
  return buf;
}
const AUDIO = {
  ctx: null, on: false, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); const comp = c.createDynamicsCompressor(); comp.threshold.value = -13; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;   // the engine is loud now: never let the sum clip
    this.master.connect(comp); comp.connect(lim); lim.connect(c.destination);
    this.sfxG = c.createGain(); this.sfxG.connect(this.master); this.engG = c.createGain();
    // engine bus: cut the sub rumble phone speakers can't play (it only pumps the compressor) and lift the 2–3 kHz bite they can
    const eHP = c.createBiquadFilter(); eHP.type = 'highpass'; eHP.frequency.value = 65; eHP.Q.value = 0.7;
    const ePres = c.createBiquadFilter(); ePres.type = 'peaking'; ePres.frequency.value = 2300; ePres.Q.value = 0.8; ePres.gain.value = 4.5;
    this.engG.connect(eHP); eHP.connect(ePres); ePres.connect(this.master);
    this.applyVolumes();
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate); const ch = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    this.eng = this.makeEngine(); this.riv = this.makeEngine();
    // wind + rain beds
    this.wind = this.noiseBed('highpass', 900, 0); this.rain = this.noiseBed('bandpass', 2600, 0); this.city = this.noiseBed('lowpass', 420, 0.025);
    // tyres: a low scrub that grows as you use the grip, a squeal when the rear steps out, and wet hiss under the spray
    this.scrub = this.noiseBed('bandpass', 900, 0, 1.4); this.squealB = this.noiseBed('bandpass', 2300, 0, 9); this.hiss = this.noiseBed('highpass', 3200, 0);
    this.on = true;
    MUSIC.init(); if (GAME && GAME.musicMode) MUSIC.setMode(GAME.musicMode);
  },
  applyVolumes() { if (!this.ctx) return; const m = this.muted ? 0 : 1; this.sfxG.gain.value = SAVE.settings.sfx * m; this.engG.gain.value = SAVE.settings.engine * 1.15 * m; MUSIC.applyVolume(); },   // engine bus ×2 from before: the throttle is the star of the mix
  noiseBed(type, f, g0, q) { const c = this.ctx; const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.9 + Math.random() * 0.2; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; const g = c.createGain(); g.gain.value = g0; src.connect(fl); fl.connect(g); g.connect(this.sfxG); src.start(0, Math.random() * 1.5); g.fl = fl; return g; },
  // an engine voice: pulses → (left/right for twin pipes) → powerband peak → tone lowpass → saturation → level
  makeEngine() {
    const c = this.ctx, out = c.createGain(); out.gain.value = 0; out.connect(this.engG);
    const shaper = c.createWaveShaper(); shaper.oversample = '2x';
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1600; tone.Q.value = 0.9;
    const peak = c.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 1500; peak.Q.value = 2.2; peak.gain.value = 0;
    const inp = c.createGain(); inp.gain.value = 0.55; inp.connect(peak); peak.connect(tone); tone.connect(shaper); shaper.connect(out);
    const pan = (p) => { if (!c.createStereoPanner) return inp; const s = c.createStereoPanner(); s.pan.value = p; s.connect(inp); return s; };
    return { out, inp, tone, peak, shaper, L: pan(-0.42), R: pan(0.42), next: 0, side: 0, weak: false, popUntil: 0, ex: null, thr: 0 };
  },
  // pulse buffers per silencer, made on first use (a few ms of maths, no files)
  pulses(ex) {
    const P = this._pulses || (this._pulses = {}); if (P[ex]) return P[ex];
    const V = ENGINE_VOICES[ex] || ENGINE_VOICES.stock, rng = mulberry32(hashStr(ex)), mk = (k, n) => Array.from({ length: n }, () => enginePulse(this.ctx, V, k, rng));
    const set = { n: mk('n', 6), w: mk('w', 3), p: mk('p', 3) };
    let pk = 0; for (const b of set.n) { const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); }   // same loudness for every silencer before its own gain
    const k = 0.5 / Math.max(1e-3, pk); for (const b of [...set.n, ...set.w, ...set.p]) { const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] *= k; }
    return (P[ex] = set);
  },
  // drive one engine voice: schedules the next ~0.1 s of firings and sets the tone for this moment
  setEngine(e, rpm, thr, vol, boost, ex, rate = 1) {
    if (!this.on) return; const c = this.ctx, t = c.currentTime, V = ENGINE_VOICES[ex] || ENGINE_VOICES.stock, B = this.pulses(ENGINE_VOICES[ex] ? ex : 'stock');
    if (e.ex !== ex) { e.ex = ex; const curve = new Float32Array(1024), dr = V.drive; for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * dr) / Math.tanh(dr); } e.shaper.curve = curve; }
    const rN = clamp((rpm - 1500) / 8900, 0, 1), f = Math.max(10, rpm / 60) * rate;
    const band = V.band ? clamp((rpm - V.band[0]) / (V.band[1] - V.band[0]), 0, 1) * (0.3 + 0.7 * thr) : 0;
    if (V.band) { e.peak.frequency.setTargetAtTime(V.band[2] * (0.9 + 0.2 * rN), t, 0.05); e.peak.gain.setTargetAtTime(V.band[3] * band, t, 0.06); } else e.peak.gain.setTargetAtTime(0, t, 0.1);
    // twisting the grip open hits hard: a short punch of extra level and bite on every throttle stab
    const dtE = Math.min(0.1, Math.max(0, t - (e.lastT || t))); e.lastT = t; e.punch = (e.punch || 0) * Math.exp(-dtE / 0.28);
    if (thr > 0.6 && (e.thrLo ?? 1) < 0.35) e.punch = 1; e.thrLo = thr < 0.35 ? thr : thr > 0.6 ? 1 : (e.thrLo ?? 1);
    e.tone.frequency.setTargetAtTime(Math.min(16000, V.tone * (0.5 + 0.5 * thr) * (0.75 + 0.6 * rN) + (boost ? 1800 : 0) + e.punch * 2600), t, 0.03);
    const lowK = V.band ? V.low + (1 - V.low) * band : 1, rateK = 1 / (0.6 + 0.4 * Math.sqrt(f / 25));   // a pulse train gets louder as it speeds up; keep that, but tamed
    const under = e === this.eng && this.imp ? clamp((this.imp.end - t) / 0.45, 0, 1) : 0;   // the takeover hit leads; the live engine slides back in as it ends
    e.out.gain.setTargetAtTime(vol * V.gain * lowK * rateK * (0.2 + 0.8 * Math.pow(thr, 1.5)) * (1 + 0.55 * e.punch) * 2.1 * (1 - 0.72 * under), t, 0.03);   // closed → open is ~+14 dB; part throttle stays well under full
    // throttle snapped shut at high revs → a burst of pops
    if (V.pops && (e.thr || 0) > 0.7 && thr < 0.2 && rpm > 5200) e.popUntil = t + 0.22 + V.pops * 0.07; e.thr = thr;
    if (vol < 0.01) { e.next = 0; return; }
    if (!e.next || e.next < t) e.next = t + 0.012;
    const ahead = t + 0.13, temp = (0.93 + 0.14 * rN) * rate; let guard = 0;   // 130 ms ahead: a dropped frame on a phone doesn't leave a gap
    while (e.next < ahead && guard++ < 48) {
      let kind = 'n';
      if (e.next < (e.popUntil || 0) && Math.random() < 0.5) kind = 'p';
      else if (thr < 0.25 && rpm > 3800 && Math.random() < V.crackle * (1 - thr) * 4) kind = 'p';
      else { const mis = V.misfire * (1 - thr) * (rpm < 6200 ? 1 : 0.35); if (e.weak) { e.weak = false; } else if (Math.random() < mis) { kind = 'w'; e.weak = true; } }   // 4-stroking: weak, strong, weak…
      const pool = B[kind], s = c.createBufferSource(); s.buffer = pool[(Math.random() * pool.length) | 0]; s.playbackRate.value = temp * (kind === 'p' ? 0.85 + Math.random() * 0.3 : 1);
      s.connect(V.pan ? ((e.side ^= 1) ? e.L : e.R) : e.inp); s.start(e.next);
      const jit = 1 + (Math.random() - 0.5) * (thr < 0.3 ? 0.09 : 0.04);   // a real engine never fires exactly on the beat
      e.next += jit / f;
    }
  },
  // ── the throttle takeover hit ──
  // The stab-and-pull from the reference ride (the first seconds of chapri-throttle-takeover.mp3: throttle snapped open
  // at ~5,000 rpm, the revs flaring up through a shift), rendered once per silencer from this same engine code. It plays at
  // the green light, when you rev on the start line, and whenever you open the throttle again after lifting, while the
  // live engine dips under it, so every stab lands like that clip even when your speed has the revs pinned in top gear.
  impactFor(ex) {
    const I = this._imp || (this._imp = {}); if (I[ex] !== undefined) return I[ex];   // the buffer, or null while it renders
    I[ex] = null; const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return null;
    this.pulses(ex);   // share this context's pulse buffers
    const sr = this.ctx.sampleRate, dur = 2.1, off = new OAC(1, Math.floor(sr * dur), sr), A = Object.create(AUDIO);
    A.ctx = off; A.on = true; A._pulses = this._pulses; A.imp = null; A.engG = off.createGain(); A.engG.connect(off.destination); const e = A.makeEngine();
    let rpm = 4900, shifts = 0;
    for (let i = 0; i < Math.floor(dur * 60) - 2; i++) off.suspend(i / 60).then(() => {
      const thr = i < 4 ? 0.3 : 1; if (thr > 0.5) { rpm += (9000 - rpm) * 0.03 + 20; if (rpm > 8900 && shifts < 2) { shifts++; rpm = 6400; } }   // same flare as the reference ride
      A.setEngine(e, rpm, thr, 1, false, ex); off.resume(); });
    off.startRendering().then(b => { const d = b.getChannelData(0), n = d.length, f = Math.floor(sr * 0.45); for (let i = 0; i < f; i++) d[n - 1 - i] *= i / f; I[ex] = b; }).catch(() => { });
    return null;
  },
  impact(buf, rpm) {
    const c = this.ctx, t = c.currentTime; this.impactStop(0.04);
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = clamp(0.94 + (rpm - 5000) / 40000, 0.9, 1.06);
    const g = c.createGain(); g.gain.value = 1; s.connect(g); g.connect(this.engG); s.start(t);
    const I = this.imp = { s, g, end: t + buf.duration / s.playbackRate.value }; this.impT = 0; s.onended = () => { if (this.imp === I) this.imp = null; };
  },
  impactStop(sec = 0.12) { const I = this.imp; if (!I) return; const t = this.ctx.currentTime; I.g.gain.cancelScheduledValues(t); I.g.gain.setValueAtTime(I.g.gain.value, t); I.g.gain.linearRampToValueAtTime(0, t + sec); try { I.s.stop(t + sec + 0.02); } catch (e) { } this.imp = null; },
  // garage: blip-blip, one long pull and a snap off, so you can hear a silencer before you fit it
  revDemo(ex) { if (!this.on) return; this.demo = { t: 0, ex }; },
  demoRpm(dt) {
    const D = this.demo; D.t += dt; const t = D.t;
    const k = t < 0.25 ? [1500, 0.05] : t < 0.45 ? [4600, 1] : t < 0.7 ? [2200, 0] : t < 0.9 ? [5200, 1] : t < 1.15 ? [2400, 0] : t < 2.1 ? [1500 + (t - 1.15) / 0.95 * 7800, 1] : t < 2.3 ? [9300, 1] : t < 3.6 ? [1600, 0] : null;
    if (!k) { this.demo = null; return null; } D.rpm = smooth(D.rpm || 1500, k[0], k[1] ? 7 : 4.5, dt); return [D.rpm, k[1], D.ex];
  },
  update(race, dt) {
    if (!this.on) return; const t = this.ctx.currentTime;
    if (!race) { this.siren(0); if (this.imp) this.impactStop(); const dm = this.demo && this.demoRpm(dt), mex = (GAME && GAME.menuExhaust) || (typeof SAVE !== 'undefined' && SAVE.build ? modsFor(SAVE.build).exhaust : 'stock');
      if (dm) this.setEngine(this.eng, dm[0], dm[1], 0.95, false, dm[2]); else this.setEngine(this.eng, 1500 + Math.sin(t * 2.1) * 90, 0.04, 0.22, false, mex);   // a quiet idle under the menu song
      this._take = smooth(this._take || 0, dm ? dm[1] * 0.85 : 0, dm && dm[1] ? 9 : 2.5, dt); MUSIC.engineDuck(this._take);   // the garage rev demo takes over too
      this.riv.out.gain.setTargetAtTime(0, t, 0.2); this.wind.gain.setTargetAtTime(0, t, 0.3); this.rain.gain.setTargetAtTime(GAME && GAME.wet ? 0.08 : 0, t, 0.3); for (const b of [this.scrub, this.squealB, this.hiss]) b.gain.setTargetAtTime(0, t, 0.2); return; }
    const P = race.player; const vol = P.engineOff ? 0 : P.crashed ? 0.15 : 1;
    const ex = P.st && P.st.mods ? P.st.mods.exhaust : 'stock', thrP = P.crashed || P.engineOff ? 0 : P.input.throttle; this.setEngine(this.eng, P.rpm, thrP, vol, P.boosting, ex);
    // takeover hit: green light with the gas held, or the throttle reopened after a lift (start-line revs count too)
    const hit = this.impactFor(ex), live = race.state === 'racing' || race.state === 'countdown', go = race.state === 'racing' && this._rs === 'countdown'; this._rs = race.state; this.impT = (this.impT ?? 9) + dt;
    if (hit && live && !P.crashed && thrP > 0.65 && ((go && !this.imp) || ((this.lowT || 0) > 0.3 && this.impT > 0.9))) this.impact(hit, P.rpm);   // already mid-hit at the green: let it run
    if (thrP < 0.35) this.lowT = (this.lowT || 0) + dt; else if (thrP > 0.65) this.lowT = 0;
    if (this.imp && (thrP < 0.3 || P.crashed || !live)) this.impactStop();   // lift and it lets go with you
    // throttle takeover: the song dips under the engine while you're on the gas (and when you rev on the start line)
    const rk = clamp((P.rpm - 1500) / 8900, 0, 1); this._take = smooth(this._take || 0, thrP * (0.45 + 0.55 * rk) * (race.state === 'racing' || race.state === 'countdown' ? 1 : 0.3), thrP > (this._take || 0) ? 9 : 2.5, dt);
    MUSIC.engineDuck(this._take);
    let near = null, nd = 1e9; for (const r of race.riders) { if (r === P || r.eliminated) continue; const d = Math.abs(r.dist - P.dist) + Math.abs(r.d - P.d) * 2; if (d < nd) { nd = d; near = r; } }
    if (near) { const closing = (P.v - near.v) * Math.sign(near.dist - P.dist || 1); const doppler = 1 + 0.16 * Math.tanh(closing / 6); this.setEngine(this.riv, near.rpm * 0.97, near.input.throttle, clamp(1 - nd / 35, 0, 1) * 0.55, near.boosting, (near.rig && near.rig.o && near.rig.o.mods && near.rig.o.mods.exhaust) || 'stock', doppler); } else this.riv.out.gain.setTargetAtTime(0, t, 0.2);
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
