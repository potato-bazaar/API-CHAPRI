// ───────────────────────── RIDER: ARCADE BIKE PHYSICS + AI ─────────────────────────
const GEAR_SPLIT = [0.34, 0.58, 0.8, 1.0];
const GEAR_MUL = [1.38, 1.15, 0.98, 0.86];
function torqueCurve(rpm) { // two-stroke: weak low down, strong kick 5,500–7,500 rpm
  if (rpm < 4000) return 0.55; if (rpm < 5500) return lerp(0.55, 1.0, (rpm - 4000) / 1500);
  if (rpm < 7500) return 1.28; if (rpm < 9200) return lerp(1.28, 0.85, (rpm - 7500) / 1700); return 0.7;
}

class Rider {
  constructor(race, idx, cfg) {
    this.race = race; this.idx = idx; this.cfg = cfg; this.isPlayer = !!cfg.isPlayer;
    this.name = cfg.name; this.short = cfg.short || cfg.name;
    this.st = cfg.stats;
    this.vTop = this.st.top / 3.6; this.A = 5.9 * this.st.acc; this.brakeF = 9.0 * this.st.brake; this.brakeR = 4.2;
    this.maxLean = THREE.MathUtils.degToRad(this.st.lean); this.gripLat = G * Math.tan(this.maxLean) * this.st.grip * 1.06;   // arcade grip: a touch more than a real tyre
    // steering assist (the player): the stick sets where the bike points relative to the road, and the bike follows the road's curve by itself
    this.assist = this.isPlayer && !DEBUG.autopilot && SAVE.settings.steerAssist !== false;
    if (this.assist) this.gripLat *= 1.1;   // arcade handling for the human: tighter lines than the AI's tyres allow
    if (race.def.offroad) cfg.look = { ...cfg.look, offroad: true };   // the dirt kit for off-road stages
    this.rig = new BikeRig(this.isPlayer ? cfg.look : { ...cfg.look, lod: true });
    this.rig.showWeapon(null);
    // state
    this.dist = 0; this.s = 0; this.d = 0; this.psi = 0; this.v = 0; this.omega = 0; this.lean = 0; this.slide = 0;
    this.y = 0; this.vy = 0; this.air = false; this.airT = 0; this.pitch = 0; this.pitchV = 0; this.wheelie = false; this.stoppie = false; this.stoppieT = 0;
    this.gear = 1; this.rpm = 1600; this.wobble = 0; this.wobbleT = 9; this.crashed = false; this.crashT = 0; this.invuln = 0; this.shoveV = 0;
    this.boost = 25; this.boosting = false; this.drafting = false; this.sliding = false; this.tuck = 0;
    this.lap = -1; this.lapStart = 0; this.laps = []; this.bestLap = Infinity; this.finished = false; this.finishT = 0; this.eliminated = false;
    this.wrongT = 0; this.gripT = 0; this.splatT = 0; this.kickCD = 0; this.attack = null; this.lastHitBy = null; this.lastHitT = -99; this.downedBy = null;
    this.weapons = { melee: null, throw: null };
    this.input = { throttle: 0, brake: 0, rear: 0, steer: 0, back: false, boost: false, hop: false };
    this.strafe = 0; this.hopCD = 0; this.hopT = 9; this.flatT = 0; this.crashDur = 2.0;
    this.ai = { laneBias: (RNG() - 0.5) * 1.2, nextThink: 0, attackCD: 2 + RNG() * 3, mistakeT: 0, target: 0, wheelieT: 0 };
    this.wheelieDist = 0; this.slideDist = 0; this.wheeliesDone = 0;
    this.susp = 0; this.suspV = 0; this.surf = 0; this.lastHole = -1; this.lastHoleT = -9; this.ai.shortcut = this.isPlayer ? DEBUG.autopilot : RNG() < 0.4; this.ai.jumper = this.isPlayer ? DEBUG.autopilot : RNG() < 0.55;
  }
  get halfW() { return this.flyW || this.race.track.wAt(this.s) / 2 - 0.42; }   // (flyW: Flying Mode opens the whole canyon)
  place(dist, d) { const T = this.race.track; this.dist = dist; this.s = ((dist % T.L) + T.L) % T.L; this.d = d; this.psi = 0; this.v = 0; this.y = T.yAt(this.s); }
  // ── one physics step ──
  step(dt, raceT) {
    const T = this.race.track, inp = this.input;
    this.invuln = Math.max(0, this.invuln - dt); this.kickCD = Math.max(0, this.kickCD - dt); this.gripT = Math.max(0, this.gripT - dt); this.splatT = Math.max(0, this.splatT - dt); this.wobbleT += dt;
    if (this.crashed) return this.stepCrash(dt);
    const vTopEff = this.vTop * (this.boosting ? 1.17 : 1) * (this.drafting ? 1.06 : 1) * (this.tuck > 0.6 ? 1.02 : 1) * (this.race.wet ? 0.97 : 1) * (this.wheelie && this.pitch > 0.12 ? 1.07 : 1) * (this.flatT > 0 ? 0.72 : 1);
    this.hopCD = Math.max(0, this.hopCD - dt); this.hopT += dt; this.flatT = Math.max(0, this.flatT - dt);
    // road surface under the wheels: 0 tarmac, 1 kichad (mud), 2 kachha lane
    this.surf = this.air ? 0 : this.surfaceHere(T);
    const gripMul = (this.race.wet ? 0.8 : 1) * (this.gripT > 0 ? 0.62 : 1) * (this.surf === 1 ? (this.race.wet ? 0.5 : 0.62) : this.surf === 2 ? 0.86 : this.surf === 4 ? 0.8 : this.surf === 3 ? 0.9 : this.surf === 5 ? (T.offroad ? 1 : 0.9) : 1);
    // gears + rpm
    const gt = GEAR_SPLIT.map(f => f * vTopEff * 1.06);
    if (!(this.isPlayer && SAVE.settings.manualGears)) {
      if (this.rpm > 8900 && this.gear < 4) this.gear++;
      else if (this.gear > 1 && this.v < gt[this.gear - 2] * 0.78) this.gear--;
    }
    const ratio = this.v / gt[this.gear - 1];
    const targetRpm = clamp(1700 + ratio * 7700 + (this.v < 3 ? inp.throttle * 4200 * (1 - this.v / 3) : 0), 1500, 10400);
    this.rpm = smooth(this.rpm, targetRpm, 12, dt);
    // longitudinal
    let a = 0; const thr = inp.throttle;
    const over = Math.pow(Math.max(0, this.v) / vTopEff, 4);
    if (thr > 0) a += thr * this.A * torqueCurve(this.rpm) * GEAR_MUL[this.gear - 1] * (1 - over) * (this.rpm > 10200 ? 0.3 : 1);
    a -= thr > 0 ? 0.05 : 0.55 + 0.0009 * this.v * this.v;
    if (thr <= 0 && this.v > vTopEff) a -= 1.5;
    // brakes; front brake at speed lifts the rear (stoppie)
    a -= inp.brake * this.brakeF * gripMul;
    this.sliding = !this.air && inp.rear > 0.5 && this.v > 7 && Math.abs(inp.steer) > 0.15;
    a -= inp.rear * (this.sliding && thr > 0.3 ? 1.6 : this.brakeR);
    if (this.boosting) a += 3.3;
    if (this.wheelie && this.pitch > 0.12) a += 1.6;   // a wheelie is a stunt AND a speed trick: less drag, the rear tyre hooks up
    if (this.gripT > 0) a -= 0.8;
    if (this.v > 2) { if (this.surf === 1) a -= this.race.wet ? 3.6 : 2.8; else if (this.surf === 2) a -= 1.4; else if (this.surf === 5) a -= T.offroad ? 0 : 0.45;   // (knobbly tyres: dirt costs nothing)
      else if (this.surf === 4) a -= 1.2 + this.v * 0.11;      // water drag: wheels a quarter under
      else if (this.surf === 3) a -= 0.9 + this.v * 0.05; }    // steps
    // stairs: every step edge kicks the suspension
    if (this.surf === 3 && !this.air) { const S = T.stairs, si = Math.floor(T.wrapD(this.s - S.s0) / S.tread); if (si !== this.lastStep) { this.lastStep = si; this.suspV -= (T.stairDir(this.s) > 0 ? 1.5 : 1.0) * Math.min(1.2, this.v / 9); this.stepHit = (this.stepHit || 0) + 1; } } else this.lastStep = -1;
    if (T.p2p && !this.air) a -= G * clamp(T.slopeAt(this.s), -0.22, 0.22) * 0.5;   // the ghat: gravity helps you down and holds you back on the climb
    this.v = Math.max(0, this.v + a * dt);
    // boost meter
    const fill = this.st.boostFill;
    if (inp.boost && this.boost > 1 && !this.air && this.v > 3) { this.boosting = true; this.boost = Math.max(0, this.boost - 26 * dt); } else this.boosting = false;
    if (this.drafting) this.boost = Math.min(100, this.boost + 6 * fill * dt);
    // steering by lean: grip budget sets the yaw-rate ceiling
    const vv = Math.max(this.v, 2.5);
    let wMax = Math.min(2.4, this.gripLat * gripMul / vv);
    if (this.skidT > 0) { this.skidT -= dt; const sk = this.skidK * clamp(this.skidT / this.skidMax, 0, 1);
      this.v = Math.max(0, this.v - (1.5 + this.v * 0.22) * sk * dt); wMax *= 1 - 0.6 * sk;   // tyres scrub, steering goes light
      this.slide = smooth(this.slide, this.skidDir * 0.6 * sk, 14, dt); this.psi += this.skidDir * sk * 0.35 * dt; }
    if (this.sliding) wMax *= 1.6; if (this.wheelie) wMax *= 0.4; if (this.stoppie) wMax *= 0.3; if (this.air) wMax *= 0.3;   // a little air control
    let steer = inp.steer; if (this.splatT > 0 && !this.isPlayer) steer += Math.sin(raceT * 9 + this.idx) * 0.8;
    const k = T.kAt(this.s); const denom = Math.max(0.3, 1 - k * this.d);
    if (this.assist) {
      // road-relative steering: input = heading off the road (narrower at speed, wider in a drift); the curve itself is fed forward,
      // so letting go straightens the bike along the road instead of carrying it into a wall. Still limited by grip.
      const psiMax = lerp(0.62, 0.29, clamp(this.v / 28, 0, 1)) * (this.sliding ? 1.5 : 1);
      const ff = k * this.v * Math.cos(this.psi) / denom, req = ff + 10 * wrapAngle(-steer * psiMax - this.psi);
      steer = clamp(-req / Math.max(0.05, wMax), -1, 1);
    }
    const wT = -steer * wMax; this.omega = smooth(this.omega, wT, this.sliding ? 6 : this.assist ? 18 : 9, dt);
    // arcade lane change: the bike starts moving toward the side you press at once, while the heading catches up
    this.strafe = this.assist ? smooth(this.strafe, -inp.steer * Math.min(2.6, 0.6 + this.v * 0.09) * (this.air ? 0.4 : 1), 14, dt) : 0;
    // a flat tyre (katta bullet): the rim drags and squirms
    if (this.flatT > 0 && this.v > 4) { this.psi += Math.sin(raceT * 11 + this.idx) * 0.35 * dt; this.addWobble(7 * dt, true); }
    if (this.isPlayer && inp.brake > 0.6 && Math.abs(this.omega * this.v) > 0.8 * this.gripLat && this.v > 10) this.addWobble(38 * dt, true); // front-end wobble
    // rain: past ~3/4 of the grip budget (or braking hard) the rear steps out and scrubs speed
    if (this.race.wet && !this.air && this.v > 8) {
      const demand = Math.abs(this.omega * this.v) / Math.max(0.1, this.gripLat * gripMul), want = clamp((demand - 0.74) * 3.5, 0, 1) + (inp.brake > 0.7 && this.v > 13 ? 0.45 : 0);
      this.wetSlip = smooth(this.wetSlip || 0, Math.min(1, want), want > (this.wetSlip || 0) ? 7 : 3, dt);
      if (this.wetSlip > 0.05) { this.v -= this.wetSlip * 2.0 * dt; this.psi += (this.omega >= 0 ? 1 : -1) * this.wetSlip * 0.22 * dt; this.addWobble(this.wetSlip * (this.isPlayer ? 10 : 6) * dt, true);
        if (this.wetSlip > 0.45 && !this._slipOn) { this._slipOn = true; this.race.onSlip && this.race.onSlip(this); } }
      if (this.wetSlip < 0.2) this._slipOn = false;
    } else this.wetSlip = 0;
    if (this.sliding) { this.slideDist += this.v * dt; this.boost = Math.min(100, this.boost + 10 * fill * dt); }
    // track-space integration
    const ds = this.v * Math.cos(this.psi) / denom * dt; const dd = this.v * Math.sin(this.psi) * dt + (this.shoveV + this.strafe) * dt;
    this.psi = wrapAngle(this.psi + this.omega * dt - k * ds);
    this.shoveV *= Math.exp(-5 * dt);
    const oldLap = this.lap, oldS = this.s; this.dist += ds; this.s = ((this.dist % T.L) + T.L) % T.L; this.d += dd;
    // kichad makes the rear step out; the kachha lane chatters the suspension
    if (this.surf === 1 && this.v > 7) { const w = Math.sin(raceT * 2.3 + this.idx * 1.7) + 0.5 * Math.sin(raceT * 5.1 + this.idx); this.psi += w * 0.22 * dt * Math.min(1.5, this.v / 18); this.slide = smooth(this.slide, w * 0.22, 4, dt); }   // a slow, readable fishtail
    if (this.surf === 2 && this.v > 4) this.suspV += (RNG() - 0.5) * 9 * dt * Math.min(1.5, this.v / 12);
    else if (this.surf === 5 && this.v > 4) this.suspV += (RNG() - 0.5) * 5 * dt * Math.min(1.5, this.v / 12);
    this.roadHits(T, oldS);
    // walls & kerbs
    const hw = this.halfW;
    if (Math.abs(this.d) > hw) {
      const sg = Math.sign(this.d); const into = Math.max(0, sg * Math.sin(this.psi)) + Math.max(0, sg * this.shoveV / 8);
      this.d = sg * hw;
      if (into > 0.03) {
        // a glancing hit: keep most of the speed, bounce the nose back off the wall, small push away
        const hard = into > 0.3;
        this.v *= 1 - clamp(into * 0.5, 0.02, hard ? 0.32 : 0.14);
        this.psi = -sg * Math.min(Math.abs(this.psi) * 0.35, 0.1);
        this.addWobble((3 + 48 * Math.max(0, into - 0.06) * Math.min(1, this.v / 14)) / this.st.wobbleRes, !hard);
        this.shoveV = -sg * Math.min(3, 0.6 + into * this.v * 0.18); this.race.onWall(this, into);
      } else if (this.v > 6) { this.v -= 1.2 * dt; this.scrapeT = 0.12; }   // sliding along the wall: sparks, a little drag
    } else if (Math.abs(this.d) > hw - 0.45 && this.v > 8) { this.v -= 0.5 * dt; if (this.isPlayer) this.race.rumble(0.05, 0.1); }
    // elevation + air time (kicker ramps rise under one lane only)
    const kick = this.air ? null : T.kickerAt(this.s, this.d);
    if (kick && !this.onKick && kick.x > kick.k.len * 0.3) { // came in from the side: bounce off the ramp's edge
      const sg = this.d > kick.k.d ? 1 : -1; this.d = kick.k.d + sg * (kick.k.hw + 0.05); this.v *= 0.82; this.addWobble(18 / this.st.wobbleRes); if (this.isPlayer) this.race.onWall(this, 0.3);
    }
    this.onKick = !!T.kickerAt(this.s, this.d);
    // bunny hop: tap weight-back. Clears gutka, glass, potholes; hold it and you land straight into a wheelie
    if (inp.hop) { inp.hop = false; if (!this.air && this.hopCD <= 0 && this.v > 2 && !this.stoppie) { this.air = true; this.airT = 0; this.vy = 3.6 + Math.min(1.2, this.v * 0.03); this.hopCD = 0.55; this.hopT = 0; this.suspV -= 1.2; this.race.onHop && this.race.onHop(this); } }
    const gy = T.gy(this.s, this.d);
    if (!this.air) {
      const predicted = this.y + this.vy * dt - 0.5 * G * dt * dt;
      if (predicted > gy + 0.06 && this.v > 8) { this.air = true; this.airT = 0; }
      else { const nvy = clamp((gy - this.y) / dt, -20, Math.min(20, 1 + this.v * 0.32)); /* a step up (ramp edge, respawn) is not a launch */ this.suspV -= clamp((nvy - this.vy), -6, 6) * 0.35; this.vy = nvy; this.y = gy; }
    }
    if (this.air) {
      if (!this.gliding) this.vy -= G * dt; this.y += this.vy * dt; this.airT += dt;   // (gliding: the wings decide the climb, 51_flight.js)
      // rooftop gaps: too slow and you drop between the buildings
      if (T.roof && ((T.gapAt(this.s) && this.y < T.roof.h - 1.1) || (this.y <= gy && T.onRoofTop(this.s) && this.y < gy - 0.75))) { this.y = Math.min(this.y, gy); this.crash('fell'); return; }
      if (this.y <= gy) { const gvy = clamp((T.gy(this.s + 0.6, this.d) - gy) / 0.6 * this.v, -12, 12), impact = Math.max(0, gvy - this.vy) * (T.offroad ? 0.6 : 1); this.y = gy; this.air = false; this.vy = gvy;   /* landing on a down-ramp is soft */ this.suspV -= clamp(impact * 0.55, 0.3, 4.5);
        this.landImpact = impact; if (this.airT > 0.5) this.race.onAir(this, this.airT); if (Math.abs(this.lean) > 0.65) this.addWobble(12); if (impact > 7.5) this.addWobble((impact - 7.5) * 3 / this.st.wobbleRes);
        this.race.onLand(this, impact); if (this.isPlayer) this.race.rumble(clamp(impact / 8, 0.25, 0.9), 0.15); }
    }
    // suspension: a stiff spring-damper the hits feed into; the rig bounces the frame and the rider on it
    this.suspV += (-260 * this.susp - 15 * this.suspV) * dt; this.susp = clamp(this.susp + this.suspV * dt, -0.13, 0.09);
    // wheelie: weight back + throttle in the powerband in 1st/2nd
    const canStart = inp.back && thr > 0.5 && !this.air && !this.sliding && this.v > 4 && Math.abs(this.lean) < 0.5 && this.hopT > 0.25 && this.flatT <= 0;
    if (!this.wheelie && canStart) { this.wheelie = true; this.wheelieDist = 0; this.pitchV = 0.6; }
    if (this.wheelie) {
      const assist = !this.isPlayer || SAVE.settings.wheelieAssist;
      if (assist) { this.pitch = smooth(this.pitch, inp.back && thr > 0.3 ? 0.5 : 0, inp.back ? 4.5 : 6, dt); }
      else { this.pitchV += ((thr - 0.55) * 2.6 + (this.pitch - 0.42) * 0.9 - (inp.back ? 0 : 1.4)) * dt; this.pitch += this.pitchV * dt; }
      if (this.pitch > 0.12) { this.wheelieDist += this.v * dt; this.boost = Math.min(100, this.boost + 8 * fill * dt); }
      if (this.pitch > 0.8) { this.crash('loop'); return; }
      if (this.pitch < 0.02 && (!inp.back || thr < 0.3)) { this.wheelie = false; this.pitch = 0; if (this.wheelieDist > 6) this.race.onWheelie(this, this.wheelieDist); }
    }
    // stoppie: hard front brake at speed
    if (!this.wheelie && !this.air && inp.brake > 0.85 && this.v > 13 && Math.abs(inp.steer) < 0.3) { this.stoppie = true; this.stoppieT += dt; if (this.stoppieT > 1.2) this.addWobble(40 * dt, true); }
    else if (this.stoppie) { if (this.stoppieT > 0.5) this.race.onStoppie(this, this.stoppieT); this.stoppie = false; this.stoppieT = 0; }
    if (this.stoppie && this.stoppieT > 2.4) { this.crash('bars'); return; }
    if (!this.wheelie) this.pitch = smooth(this.pitch, this.stoppie ? -0.28 : this.air && this.hopT < 0.6 ? 0.16 * Math.sin(Math.min(1, this.hopT / 0.55) * Math.PI) : 0, this.hopT < 0.6 ? 14 : 8, dt);
    // tuck on straights
    this.tuck = smooth(this.tuck, Math.abs(inp.steer) < 0.1 && thr > 0.8 && this.v > 16 ? 1 : 0, 3, dt);
    // visual lean + slide yaw
    const leanT = clamp(Math.atan2(this.v * this.omega, G), -this.maxLean - (this.sliding ? 0.15 : 0), this.maxLean + (this.sliding ? 0.15 : 0));
    this.lean = smooth(this.lean, this.air ? leanT * 0.6 : leanT, this.air ? 4 : 8, dt);
    if (!(this.skidT > 0)) this.slide = smooth(this.slide, this.sliding ? Math.sign(this.omega) * 0.42 : (this.wetSlip > 0.08 ? Math.sign(this.omega) * 0.4 * this.wetSlip : 0), 6, dt);
    // wobble recovery
    if (this.wobbleT > 0.45) this.wobble = Math.max(0, this.wobble - (Math.abs(inp.steer) < 0.6 ? 42 : 30) * (this.race.diff.wobbleRecover || 1) * (this.isPlayer && this.race.diffKey === 'easy' ? 1.5 : 1) * dt);
    if (this.wobble >= 100) { this.crash('wobble'); return; }
    // wrong way
    if (Math.cos(this.psi) < -0.2 && this.v > 2) this.wrongT += dt; else this.wrongT = 0;
    // laps
    const lap = Math.floor(this.dist / T.L);
    if (T.p2p) { this.lap = Math.max(this.lap, this.dist >= 0 ? 0 : -1); if (!this.p2pDone && this.dist >= T.finS && !this.race.flight /* a flight ends when the bike has landed and stopped, not at a line */) { this.p2pDone = true; this.race.onLap(this, raceT); }
      if (this.dist > T.finS + 125) { this.v = 0; this.dist = T.finS + 125; } }   // the road ends past the finish
    else if (lap > this.lap) { if (this.lap >= 0) this.race.onLap(this, raceT); this.lap = lap; }
  }
  surfaceHere(T) {
    if (T.inWater(this.s, this.d)) return 4;
    if (T.stairDir(this.s)) return 3;
    let surf = T.laneAt(this.s, this.d) ? 2 : (T.ug || T.hz) && T.dirtAt(this.s) ? 5 : 0;   // 5: the salt-pan kachha road
    for (const h of T.hazards) { if (h.type !== 'mud') continue; let ds = this.s - h.s; if (ds > T.L / 2) ds -= T.L; if (ds < -T.L / 2) ds += T.L;
      if (Math.abs(ds) < h.len / 2 && Math.abs(this.d - h.d) < h.hw * (1 - 0.35 * Math.abs(ds) / (h.len / 2))) return 1; }
    return surf;
  }
  // speed breakers (crossing a hump's crest) and potholes (front wheel drops in)
  roadHits(T, oldS) {
    const crossed = (x) => { let a = oldS - x, b = this.s - x; if (a > T.L / 2) a -= T.L; if (a < -T.L / 2) a += T.L; if (b > T.L / 2) b -= T.L; if (b < -T.L / 2) b += T.L; return a < 0 && b >= 0; };
    for (const b of T.bumps) if (b.type === 'breaker' && crossed(b.s)) {
      if (this.air) continue;
      // fast over a breaker: the bike hops it (a little air, a small wobble) instead of being punished every time
      if (this.v > 15) { this.addWobble((this.v - 15) * (b.triple ? 0.7 : 0.45) / this.st.wobbleRes, true); this.air = true; this.airT = 0; this.vy = Math.min(2.6, 0.9 + (this.v - 15) * 0.09); }
      this.suspV -= Math.min(2.2, this.v * 0.07); this.race.onBreaker(this, b);
    }
    if (this.air) return;
    for (const h of T.hazards) {
      if (h.type !== 'pothole') continue; let ds = this.s - h.s; if (ds > T.L / 2) ds -= T.L; if (ds < -T.L / 2) ds += T.L;
      if (Math.abs(ds) > h.r || Math.abs(this.d - h.d) > h.r * 0.85) continue;
      if (this.lastHole === h.id && this.race.raceT - this.lastHoleT < 2) continue;
      this.lastHole = h.id; this.lastHoleT = this.race.raceT;
      const sp = clamp(this.v / 20, 0.3, 1.7);
      this.v *= h.big ? 0.9 : 0.98; this.suspV -= (h.big ? 2.8 : 1.3) * sp;
      if (h.big && this.v > 13) { this.air = true; this.airT = 0; this.vy = 1.2 + this.v * 0.06; }   // the far lip kicks the bike up
      this.addWobble(((h.big ? 9 : 2) + Math.max(0, this.v - 12) * (h.big ? 0.8 : 0.2) + Math.abs(this.lean) * (h.big ? 12 : 3)) / this.st.wobbleRes, !h.big);
      this.race.onPothole(this, h);
    }
  }
  // a hit: 'clip' (stagger), 'skid' (the bike swings sideways and the speed bleeds away) or 'crash' (you go down).
  // sev ~0.3 is a corner clipped at a modest speed; ~1 is rear-ending a car square at 60 km/h faster than it.
  skid(dir, sev) {
    if (this.crashed || this.invuln > 0) return 'none';
    if (sev > 1.05 || (sev > 0.62 && RNG() < (sev - 0.62) * 2.0)) { this.crash('traffic'); return 'crash'; }
    const k = Math.min(1, sev); this.v *= 1 - (0.1 + k * 0.38);   // 10–48 % of your speed gone at once
    this.skidMax = this.skidT = 0.35 + k * 0.65; this.skidDir = dir; this.skidK = k;
    this.addWobble((8 + k * 34) / this.st.wobbleRes); this.wobbleT = 0;
    return k > 0.32 ? 'skid' : 'clip';
  }
  addWobble(n, quiet) { if (this.invuln > 0) return; this.wobble += n; if (!quiet) this.wobbleT = 0; else this.wobbleT = Math.min(this.wobbleT, 0.3); }
  crash(reason) {
    if (this.crashed) return;
    this.crashed = true; this.crashT = 0; this.wheelie = false; this.stoppie = false; this.pitch = 0; this.boosting = false; this.sliding = false; this.crashLean = this.lean >= 0 ? 1 : -1;
    this._crashes = (this._crashes || 0) + 1; this.crashKind = reason; this.race.onCrash(this, reason);
  }
  stepCrash(dt) {
    const T = this.race.track; this.crashT += dt;
    this.v = Math.max(0, this.v - 9 * dt); const ds = this.v * Math.cos(this.psi) * dt; this.dist += ds; this.s = ((this.dist % T.L) + T.L) % T.L; this.d += this.v * Math.sin(this.psi) * dt * 0.5;
    this.d = clamp(this.d, -this.halfW, this.halfW); this.y = T.gapAt(this.s) ? 0 : T.yAt(this.s); this.air = false;
    this.lean = smooth(this.lean, this.crashLean * 1.45, 6, dt);
    if (this.crashT > this.crashDur) { this.crashDur = 2.0; this.respawn(); }
  }
  respawn() {
    const T = this.race.track; const cp = Math.floor(this.dist / T.cpSpacing) * T.cpSpacing;
    this.dist = this.dist > 0 ? Math.max(cp, this.dist - 30) : this.dist; this.s = ((this.dist % T.L) + T.L) % T.L;
    if (T.roof) { const x = T.wrapD(this.s - T.roof.s0); if (x > 0 && x < T.roof.len) { this.dist -= x + 6; this.s = ((this.dist % T.L) + T.L) % T.L; } }   // restart before the rooftop run
    this.d = clamp(T.rlAt(this.s) * 0.4, -this.halfW + 0.5, this.halfW - 0.5); this.psi = 0; this.v = 5; this.omega = 0; this.lean = 0; this.wobble = 0; this.strafe = 0; this.flatT = 0; this.crashed = false; this.invuln = 2; this.y = T.gy(this.s, this.d); this.vy = 0; this.slide = 0; this.air = false;
    this.race.onRespawn(this);
  }
  // ── AI driver ──
  think(dt, raceT, riders) {
    const T = this.race.track, inp = this.input, D = this.race.diff, P = this.cfg.rival;
    if (this.crashed) { inp.throttle = 0; inp.brake = 0; return; }
    const look = 7 + this.v * 0.55; const sAhead = this.s + look;
    const wHere = T.wAt(this.s) / 2 - 0.8, wAh = T.wAt(sAhead) / 2 - 0.8;
    let target = T.rlAt(sAhead) + this.ai.laneBias * Math.max(0, wAh) * 0.45;
    if (P && P.style === 'blocker' && this.race.player && this.race.player.dist < this.dist && this.race.player.dist > this.dist - 12) target = lerp(target, this.race.player.d, 0.6);
    // kicker ramps: jumpers line up on them, everyone else keeps to the other side
    let goKick = null, nakaPick = null;
    for (const k of T.kickers) { const ds = T.wrapD(k.s - this.s); if (ds < -k.len - 20 || ds > 45 + this.v) continue;
      if (k.naka) { if (!nakaPick || Math.abs(k.d - this.d) < Math.abs(nakaPick.d - this.d)) nakaPick = k; continue; }   // nakabandi: everybody jumps
      if (this.ai.jumper && this.v > 13) { target = k.d; goKick = k; } else if (Math.abs(target - k.d) < k.hw + 1.2) target = k.d - k.side * (k.hw + 1.6); }
    if (nakaPick) { target = nakaPick.d; goKick = nakaPick; }
    // police: close in on the player and ride alongside him
    const PL = this.race.player;
    if (P && P.style === 'cop' && PL && !PL.crashed && !nakaPick) { const gap = PL.dist - this.dist; if (gap > -60 && gap < 30) target = PL.d + (gap < 3 && gap > -3 ? (this.d > PL.d ? 0.95 : -0.95) : 0); }
    // grab what's on the road: Sting cans for everyone, weapons for the ones who fight
    const C = this.race.combat; if (C && C.pickups && !nakaPick && !goKick) { let best = null, bd = 1e9; const fighter = this.race.combatOn && !(P && P.style === 'clean');
      for (const pk of C.pickups) { if (!pk.active) continue; const want = pk.type === 'sting' ? this.boost < 70 : fighter && (WEAPONS[pk.type] && WEAPONS[pk.type].slot === 'throw' ? !this.weapons.throw : !this.weapons.melee); if (!want) continue;
        let ds = pk.s - this.s; if (ds < -T.L / 2) ds += T.L; if (ds > T.L / 2) ds -= T.L; if (ds < 6 || ds > 34 || Math.abs(pk.d - target) > 3.2) continue; if (ds < bd) { bd = ds; best = pk; } }
      if (best) target = best.d; }
    // avoid obstacles ahead
    for (const o of this.race.world.obstacles) {
      if (goKick && o.kicker === goKick) continue;
      let ds = o.s - this.s; if (ds < -T.L / 2) ds += T.L; if (ds > T.L / 2) ds -= T.L;
      if (ds > -4 && ds < 40 + this.v) {
        if (o.kind === 'island') { if (ds > 40 + this.v) continue; const sg = Math.sign(o.d), lane = sg * ((T.w0At(o.s) / 2 + 2.6 + T.wAt(o.s) / 2) / 2);
          target = this.ai.shortcut ? lane : (sg > 0 ? Math.min(target, o.d - o.hw - 2.0) : Math.max(target, o.d + o.hw + 2.0)); continue; }
        const gapL = (T.wAt(o.s) / 2 - 0.4) - (o.d + o.hw), gapR = (o.d - o.hw) - (-T.wAt(o.s) / 2 + 0.4);
        const mg = o.kind === 'traffic' ? 1.2 : 0.8; if (Math.abs(target - o.d) < o.hw + mg) target = gapL > gapR ? o.d + o.hw + mg + 0.05 : o.d - o.hw - mg - 0.05; }
    }
    for (const h of T.hazards) {
      let ds = h.s - this.s; if (ds < -T.L / 2) ds += T.L; if (ds > T.L / 2) ds -= T.L; if (ds < 0 || ds > 26 + this.v * 0.6 || h.lane) continue;
      if (h.type === 'pothole' && !h.big && (this.idx % 2)) continue;   // some riders don't bother with small ones
      const r = h.type === 'mud' ? h.hw : h.r; if (Math.abs(target - h.d) < r + 0.75) { const w = T.wAt(h.s) / 2 - 0.8; target = (h.d + r + 0.9 < w && (target >= h.d || h.d - r - 0.9 < -w)) ? h.d + r + 0.95 : h.d - r - 0.95; }
    }
    // pass slower riders ahead
    let blocked = null, bd = 1e9;
    for (const r of riders) { if (r === this || r.eliminated) continue; const dd = r.dist - this.dist; if (dd > 0 && dd < 9 + this.v * 0.3 && Math.abs(r.d - target) < 1.15 && dd < bd) { blocked = r; bd = dd; } }
    if (blocked && blocked.v < this.v + 1 && !(P && P.style === 'cop' && blocked.isPlayer)) { const roomL = wAh - blocked.d, roomR = blocked.d + wAh; target = roomL > roomR ? blocked.d + 1.4 : blocked.d - 1.4; }
    target = clamp(target, -wAh, wAh); this.ai.target = target;
    const psiDes = Math.atan2(target - this.d, look);
    const k = T.kAt(this.s); const ff = k * this.v * Math.cos(this.psi) / Math.max(0.3, 1 - k * this.d);
    const omegaReq = ff + 3.2 * wrapAngle(psiDes - this.psi);
    const vv = Math.max(this.v, 2.5); const wMax = Math.min(2.4, this.gripLat * (this.race.wet ? 0.86 : 1) / vv);
    inp.steer = clamp(-omegaReq / wMax, -1, 1);
    // speed target from the track's corner profile
    let vT = Infinity; for (let x = 0; x <= this.v * 1.2 + 6; x += 4) vT = Math.min(vT, T.vmaxAt(this.s + x));
    const pace = D.pace * (P ? P.skill : 1), corner = D.corner * (P ? P.corner : 1) * (this.race.wet ? 0.9 : 1);
    vT = Math.min(vT * Math.sqrt(corner), this.vTop * pace * (this.drafting ? 1.06 : 1));
    if (P && P.style === 'latebrake') vT *= 1.03;
    if (P && P.style === 'cop' && PL) { const gap = PL.dist - this.dist;   // pressure without being unbeatable: fast when far behind, match pace when alongside
      if (gap > 90) vT = Math.min(vT * 1.12, T.vmaxAt(this.s) * 1.08); else if (gap <= 1.5 && gap > -8) vT = Math.min(vT, PL.v + (gap > 0 ? 0.6 : -1.5)); else if (gap <= -8 && gap > -60) vT = Math.min(vT, PL.v * 0.92); }   // a cop who got ahead slows to block
    if (this.surf === 2 || T.laneAt(this.s + this.v * 0.8, this.d)) vT = Math.min(vT, 12.5);   // kachha shortcut: ride it, don't fly it (big potholes launch above 13 m/s)
    // keep it a race: a rival far behind you finds extra pace, one far ahead lifts a touch (per difficulty)
    if (PL && !(P && P.style === 'cop')) { const gap = PL.dist - this.dist;
      if (gap > 25 && D.catchup) vT *= 1 + Math.min(D.catchup, (gap - 25) / 500); else if (gap < -90) vT *= D.ease || 1; }
    // Toofan: a maxed bike held to a margin over yours, so he's beatable with boost, draft and fights, but only just
    if (P && P.boss && PL) { vT = Math.min(vT, PL.vTop * (D.boss || 1.06) * (this.drafting ? 1.04 : 1)); if (PL.dist - this.dist > 60) vT *= 1.05; }
    this.ai.mistakeT -= dt; if (this.ai.mistakeT < 0 && !(P && P.boss) && RNG() < D.mistakes * 0.004) this.ai.mistakeT = 1.2;
    if (this.ai.mistakeT > 0) vT *= 0.8;
    inp.throttle = this.v < vT - 0.3 ? 1 : this.v < vT ? 0.4 : 0;
    inp.brake = this.v > vT + 1.2 ? clamp((this.v - vT) / 5, 0.2, 1) : 0;
    inp.rear = P && P.style === 'slider' && Math.abs(k) > 1 / 30 && this.v > 10 ? 1 : 0;
    // Pinku wheelies on straights out of corners
    inp.back = false;
    if (P && P.style === 'wheelie' && Math.abs(k) < 1 / 200 && this.gear <= 2) { this.ai.wheelieT = 2.5; }
    if (this.ai.wheelieT > 0) { this.ai.wheelieT -= dt; inp.back = Math.abs(k) < 1 / 120; }
    inp.boost = this.boost > 40 && Math.abs(k) < 1 / 150 && this.v > this.vTop * 0.7 && RNG() < 0.02 ? true : (this.boosting && this.boost > 5 && Math.abs(k) < 1 / 120);
    if (P && P.style === 'cop' && PL && PL.dist - this.dist > 90 && this.boost > 10) inp.boost = true;
    if (P && P.boss && this.boost > 45 && Math.abs(k) < 1 / 140 && this.v > this.vTop * 0.6) inp.boost = true;   // Toofan saves it for the long straights
  }
}
