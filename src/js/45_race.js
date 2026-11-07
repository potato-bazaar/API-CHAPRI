// ───────────────────────── RACE MANAGER ─────────────────────────
class Race {
  constructor(game, setup, cupInfo = null) {
    this.game = game; this.setup = setup; this.mode = setup.mode; this.cup = cupInfo;
    this.diffKey = setup.diff; this.diff = DIFFICULTY[setup.diff];
    this.def = TRACKS.find(t => t.id === setup.track) || TRACKS[0];
    this.track = game.track; this.world = game.world; this.hud = game.hud;
    this.wet = setup.weather === 'monsoon';
    const M = MODES[this.mode];
    // a friends race (84_mp_race.js): { raceId, goAt, seat, racers }. Null in every solo mode, and every multiplayer
    // branch below checks it, so a solo race runs exactly the code it always ran.
    this.mp = M.mp && setup.mp ? setup.mp : null;
    this.combatOn = M.combat === 'force' ? true : M.combat ? !!setup.combat : false;
    this.laps = M.fixedLaps || setup.laps;
    this.group = new THREE.Group();
    this.riders = []; this.raceT = -3.4; this.state = 'countdown'; this.slowmo = 0;
    this.score = {}; this.events = []; this.clean = true; this.lapRecordDone = false; this.launch = { jump: false, done: false };
    this.elimLap = 0; this.elimOrder = []; this.finishOrder = [];
    RNG = mulberry32(this.mp ? (setup.seed >>> 0) : (Date.now() & 0xffff));
    // player. In a friends race (and only there) the bike and the look are this seat's entry in race:begin, the ones the
    // other devices draw: a bike picked in the lobby that the server did not take in time is not ridden here either.
    const me = this.mp ? this.mp.racers.find(r => r.seat === this.mp.seat) || null : null;
    const st = buildStats(me ? me.bike : SAVE.build); const b = st.build;
    const shirt = COSMETICS.shirt.find(s => s.id === SAVE.cos.shirt) || COSMETICS.shirt[0];
    const helm = COSMETICS.helmet.find(h => h.id === SAVE.cos.helmet); const shades = COSMETICS.shades.find(s => s.id === SAVE.cos.shades);
    const look = me ? MP.sanitizeLook(me.look, me.bike) : lookFromSave(b.id);
    this.player = new Rider(this, 0, { isPlayer: true, name: SAVE.name || 'You', short: 'You', stats: st, look });
    this.riders.push(this.player);
    this.player.rig.addUnderglow();
    if (M.rivals) {
      const stock = buildStatsStock();
      RIVALS.forEach((rv, i) => {
        const lk = { tank: PAINTS[(i * 3 + 2) % PAINTS.length], accent: '#e8e8ec', chrome: i % 3 === 0, shirt: rv.shirt, flowers: i % 2 === 1, helmet: rv.helmet, shades: i % 3 === 1 ? '#111' : null, hair: ['pomp', 'buzz', 'long', 'quiff', 'pomp', 'buzz', 'pomp'][i % 7], hairColor: HAIR_DYES[(i + 1) % HAIR_DYES.length], beard: i % 4 === 3, stubble: i % 2 === 0, goldChain: i % 3 === 0, shadesStyle: i % 3 === 1 ? 'aviator' : null, jeans: pick(['#26304f', '#3a3a3a', '#4a3a2a', '#2f4a6e']),
          mods: { exhaust: ['stock', 'long', 'twin', 'dragon', 'long'][i % 5], tyres: ['stock', 'fat', 'racing'][(i * 2) % 3], kit: ['none', 'guard', 'cafe', 'full', 'none', 'guard'][(i + 1) % 6], finish: ['gloss', 'matte', 'flake', 'chrome'][(i * 3 + 1) % 4] } };
        const r = new Rider(this, i + 1, { name: rv.name, short: rv.short, stats: stock, look: lk, rival: rv });
        r.ai.laneBias = ((i % 3) - 1) * 0.7 + (RNG() - 0.5) * 0.4;
        this.riders.push(r);
      });
    }
    if (this.mp) this.mpAddRacers();
    if (M.police) PoliceOps.addCops(this);
    if (this.mp) this.mpGrid();
    else {
      // grid: player starts at the back, like the mockup (8th/8)
      const T = this.track; const order = this.riders.slice(1).concat([this.player]);
      order.forEach((r, i) => { const row = Math.floor(i / 2), side = i % 2 ? -1 : 1; r.place(-(3 + row * 5.5) - (r.isPlayer ? 0.6 : 0), side * T.wAt(0) / 4.2); });
      if (!M.rivals) this.player.place(-4, 0);
    }
    if (M.police) this.cops.forEach((c, i) => c.place(-38 - i * 8, (i - 1) * 2.4));   // the cops start a few seconds behind you
    this.riders.forEach(r => { this.group.add(r.rig.root); r.lapStart = 0; });
    this.combat = new Combat(this); this.group.add(this.combat.group);
    // swagger: each rider does a style move now and then on a calm stretch; smoke from the cigarette drifts back off the bike
    const pv = new THREE.Vector3();
    this.riders.forEach(r => { r.swagT = (r.isPlayer ? 5 : 9) + RNG() * 8; r.rig.onPuff = (mark, k) => { if (!r.isPlayer && this.distToPlayer(r) < 0.2) return; mark.getWorldPosition(pv); const yaw = r.rig.root.rotation.y;
      const out = k >= 1 ? 1.1 + Math.random() * 0.6 : 0.1, rx = -Math.cos(yaw), rz = Math.sin(yaw), keep = k >= 1 ? 0.9 : 0.85;   // exhale: blown out to his right, then it streams back
      this.combat.smoke.emit(pv.x, pv.y, pv.z, Math.sin(yaw) * r.v * keep + rx * out + (Math.random() - 0.5) * 0.3, 0.15 + Math.random() * 0.3, Math.cos(yaw) * r.v * keep + rz * out + (Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.5, k >= 1 ? 0.2 : 0.05, k >= 1 ? 1.3 + Math.random() * 0.5 : 0.35, k >= 1 ? C_EXHALE : C_SMOKE, k >= 1 ? 0.72 : 0.3, 1.6, -0.12); }; });
    // time trial ghost
    this.ghostRec = []; this.ghostRecLap = []; this.ghost = null;
    if (this.mode === 'timetrial' && SAVE.ghosts[this.def.id]) { this.ghost = { data: SAVE.ghosts[this.def.id], rig: new BikeRig({ ...look, ghost: true, lod: true }) }; makeGhost(this.ghost.rig); this.group.add(this.ghost.rig.root); }
    this.aheadSet = new Set(this.riders.filter(r => r !== this.player && r.dist > this.player.dist)); this.lastOvertakeT = -9; this.nearMissT = new Map();
    const T0 = this.track; if (T0.nakas.length || T0.dogSpots.length || T0.nala || T0.stairs) this.stage = new StageOps(this);
    if (M.police) this.police = new PoliceOps(this);
    this.street = new StreetOps(this);
    if (T0.ug) this.ug = new UGOps(this);
    this.taunts = new Taunts(this);
    this.prevSliding = false; this.splatShown = 0; this.contactT = new Map(); this.coinState = new Uint8Array(this.track.coins.length); this.coinsGot = 0; this.world.resetCoins && this.world.resetCoins();
  }
  distToPlayer(r) { if (!r) return 0.3; const dd = Math.abs((r.dist ?? 0) - this.player.dist) + Math.abs((r.d ?? 0) - this.player.d); return clamp(1 - dd / 40, 0, 1) * 0.8; }
  award(key, pts) { const v = Math.round(pts); this.score[key] = (this.score[key] || 0) + v; return v; }
  rumble(strength, dur) { if (!SAVE.settings.vibration) return; INPUT.rumble(strength, dur); }
  hudWarn(side) { this.hud.warn(side); AUDIO.warn(); }
  // ── frame update (fixed sub-steps) ──
  update(dt) {
    if (this.mp) return this.updateMp(dt);
    if (this.hitStop > 0) { this.hitStop -= dt; this.syncVisuals(0); return; }   // hit-stop: a few frames frozen on contact
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.32; }
    const P = this.player;
    if (this.state === 'countdown') {
      const before = this.raceT; this.raceT += dt;
      for (let k = 3; k >= 1; k--) if (before < -k + 0.4 && this.raceT >= -k + 0.4) { this.hud.countdown(k); AUDIO.beep(false); }
      if (this.raceT >= 0) { this.state = 'racing'; this.raceT = 0; this.hud.countdown(0); AUDIO.beep(true); if (P.input.throttle > 0.5) this.launch.jump = true; }
      // revving on the grid
      for (const r of this.riders) { r.rpm = smooth(r.rpm, r.isPlayer ? 1600 + P.input.throttle * 8200 : 2200 + Math.sin(this.raceT * 7 + r.idx) * 600, 8, dt); }
      this.syncVisuals(dt); return;
    }
    this.raceT += dt;
    // launch check
    if (!this.launch.done && this.raceT < 0.6 && P.input.throttle > 0.5) { this.launch.done = true; if (!this.launch.jump && this.raceT < 0.35) { P.boost = Math.min(100, P.boost + 20); this.hud.callout('PERFECT START', `+${this.award('launch', PTS.launch)}`, 'good'); } }
    if (this.launch.jump && this.raceT < 1) P.input.throttle *= 0.45;
    const steps = Math.max(1, Math.ceil(dt / (1 / 90))); const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const r of this.riders) if ((!r.isPlayer || DEBUG.autopilot) && !r.cinematic) { if (!r.eliminated) r.think(h, this.raceT, this.riders); }
      for (const r of this.riders) { if (r.eliminated || r.cinematic) continue; if (r.finished) { r.input.throttle = 0.4; r.input.brake = r.v > 14 ? 0.3 : 0; r.input.boost = false; } r.step(h, this.raceT); }
      this.interactions(h);
    }
    for (const r of this.riders) if (!r.isPlayer && !r.eliminated) this.combat.aiFight(r, dt);
    this.combat.update(dt, this.raceT);
    if (this.stage) this.stage.update(dt);
    if (this.ug) this.ug.update(dt);
    this.street.update(dt);
    if (this.police) this.police.update(dt);
    this.collectCoins();
    this.scoring(dt);
    if (this.ghost) this.updateGhost();
    if (this.state === 'racing' || this.state === 'finished') this.recordGhost();
    this.syncVisuals(dt);
    this.taunts.update(dt, this.game.camera);
  }
  // ── friends race (multiplayer) ──
  // One ghost rider per remote racer, in seat order after the player (riders[0] stays the local player, idx 0, as in solo).
  mpAddRacers() {
    let idx = 1;
    for (const rc of this.mp.racers) {
      if (rc.seat === this.mp.seat) continue;
      // race:begin looks are cleaned in 82_mp_net.js; cleaned once more here, so only known keys ever reach BikeRig
      const look = typeof MP.sanitizeLook === 'function' ? MP.sanitizeLook(rc.look, rc.bike) : rc.look;
      this.riders.push(new Rider(this, idx++, { name: rc.name, short: rc.name, stats: buildStatsStock(), look, net: true, seat: rc.seat }));
    }
    this.mpLocal = [this.player];
  }
  // The grid by seat order, so every device puts every racer on the same spot: two abreast, rows 5.5 m apart.
  mpGrid() {
    const T = this.track;
    this.mp.racers.forEach((rc, i) => {
      const r = rc.seat === this.mp.seat ? this.player : this.riders.find(x => x.net && x.net.seat === rc.seat); if (!r) return;
      const row = Math.floor(i / 2), side = i % 2 ? -1 : 1;
      r.place(-(3 + row * 5.5), side * T.wAt(0) / 4.2);
    });
    this.raceT = this.mpClock();   // a late race:begin (after a resume) joins the countdown, or the race, where it is now
    this.mp.sentAt = -1e9; this.mpStep = 0; this.mpTravel = 0;
  }
  // Bike contact, pickups, road objects, traffic, coins and the scoring callouts read this.riders. Ghosts take no part
  // in any of them (spec A2), so while they run the race holds the local bike only.
  mpLocalOnly(fn) { const all = this.riders; this.riders = this.mpLocal; try { fn(); } finally { this.riders = all; } }
  // the race clock: seconds since GO by the room server's clock (MP.serverNow is Date.now plus the measured offset)
  mpClock() { return (MP.serverNow() - this.mp.goAt) / 1000; }
  mpGo() {
    if (this.state !== 'countdown' || this.mpOver) return;   // an aborted race never gets its GO
    const P = this.player;
    this.state = 'racing'; this.raceT = Math.max(0, this.mpClock()); this.mp.goWall = Date.now();
    if (this.raceT > 0.5) P.lapStart = this.raceT;   // joined after GO: the first lap is timed from the moment this bike could go
    this.hud.countdown(0); AUDIO.beep(true); if (P.input.throttle > 0.5) this.launch.jump = true;
  }
  // The friends-race frame. Only the local bike is simulated, with the same physics, sub-steps, road objects and
  // scoring as solo. Ghosts are placed from snapshots (84_mp_race.js). The clock never runs slow motion or hit-stop:
  // it follows the server, so every device agrees on GO and on the finish times it reports.
  updateMp(dt) {
    const P = this.player, clock = this.mpClock();
    if (this.mpOver) this.mpPark(dt);
    if (this.state === 'countdown') {
      const before = this.raceT; this.raceT = Math.max(before, clock);
      if (!this.mpOver) for (let k = 3; k >= 1; k--) if (before < -k + 0.4 && this.raceT >= -k + 0.4 && this.raceT < 0) { this.hud.countdown(k); AUDIO.beep(false); }
      if (this.raceT >= 0) this.mpGo();
      for (const r of this.riders) { r.rpm = smooth(r.rpm, r.isPlayer ? 1600 + P.input.throttle * 8200 : 2200 + Math.sin(this.raceT * 7 + r.idx) * 600, 8, dt); }
    } else {
      // Physics runs on the race clock's real elapsed time, not the frame loop's dt (capped at 0.1 s a frame for solo):
      // a slow device then races at the same pace in real time as a fast one, and ?timescale changes nothing. The cap
      // keeps a tab that was hidden for a while from jumping its bike forward when it comes back (spec 9: it freezes).
      const prev = this.raceT; this.raceT = Math.max(prev, clock);
      const h0 = this.mpStep = clamp(this.raceT - prev, 0, 0.5);   // the chase camera follows with the same step (90_main)
      if (!this.launch.done && this.raceT < 0.6 && P.input.throttle > 0.5) { this.launch.done = true; if (!this.launch.jump && this.raceT < 0.35) { P.boost = Math.min(100, P.boost + 20); this.hud.callout('PERFECT START', `+${this.award('launch', PTS.launch)}`, 'good'); } }
      if (this.launch.jump && this.raceT < 1) P.input.throttle *= 0.45;
      const d0 = P.dist;
      if (h0 > 0) {
        // once the room server has ended the race the local bike is parked (mpPark): it is not stepped any more
        if (!this.mpOver) {
          const steps = Math.max(1, Math.ceil(h0 / (1 / 90))), h = h0 / steps;
          for (let i = 0; i < steps; i++) {
            if (P.finished) { P.input.throttle = 0.4; P.input.brake = P.v > 14 ? 0.3 : 0; P.input.boost = false; }
            P.step(h, this.raceT);   // lap and finish events see every racer, so the place counts the ghosts
            this.mpLocalOnly(() => this.interactions(h));
          }
        }
        this.mpLocalOnly(() => {
          // the street, the stage and the smoke around the bike carry on under the results
          this.combat.update(h0, this.raceT);
          if (this.stage) this.stage.update(h0);
          if (this.ug) this.ug.update(h0);
          this.street.update(h0);
          if (!this.mpOver) { this.collectCoins(); this.scoring(h0); }
        });
      }
      this.mpTravel = P.dist - d0;   // how far the bike went this frame: the chase camera spreads it over its sub-steps
      if (!this.mpOver) MPRACE.sendSnapshot(this);
    }
    MPRACE.placeGhosts(this);
    this.mpFirst = this.ranking()[0];   // finishOrder only knows the local finish, so the winner's celebration reads this
    this.syncVisuals(dt);
    this.taunts.update(dt, this.game.camera);
  }
  // The room server has ended the race (its results are in, or it ended while this device was away). The local bike
  // stays where that found it and is no longer simulated: no line it reaches can become a second finish, a lap, a
  // finish report, coins, points or daily progress. It comes to rest upright, with the engine at idle.
  mpPark(dt) {
    const P = this.player, I = P.input;
    I.throttle = 0; I.brake = 0; I.rear = 0; I.boost = false; I.steer = 0; I.back = false; I.hop = false;
    P.v = 0; P.boosting = false; P.sliding = false;
    P.lean = smooth(P.lean, 0, 4, dt); P.pitch = smooth(P.pitch, 0, 4, dt); P.rpm = smooth(P.rpm, 1600, 4, dt);
  }
  interactions(dt) {
    const R = this.riders;
    for (const r of R) r.drafting = false;
    for (let i = 0; i < R.length; i++) {
      const a = R[i]; if (a.eliminated || a.cinematic) continue;
      for (let j = i + 1; j < R.length; j++) {
        const b = R[j]; if (b.eliminated || b.cinematic) continue;
        const dd = b.dist - a.dist, dl = b.d - a.d;
        // slipstream: within ~1.5 bike lengths behind, nearly in line
        if (Math.abs(dl) < 0.8) { if (dd > 0.6 && dd < 3.6) a.drafting = true; else if (-dd > 0.6 && -dd < 3.6) b.drafting = true; }
        if (a.crashed || b.crashed || a.invuln > 0 || b.invuln > 0 || a.air !== b.air) continue;
        if (Math.abs(dd) < 1.75 && Math.abs(dl) < 0.78) {
          // soft contact: bikes lean on each other and slide apart (a spring, not a teleport); a rider closing from behind
          // trades a share of the speed difference instead of being glued to the leader's speed
          const ov = 0.78 - Math.abs(dl), sg = dl >= 0 ? 1 : -1, corr = ov * Math.min(1, dt * 9) * 0.5;
          a.d -= sg * corr; b.d += sg * corr; a.shoveV = clamp(a.shoveV - sg * ov * 22 * dt, -3, 3); b.shoveV = clamp(b.shoveV + sg * ov * 22 * dt, -3, 3);
          const rel = Math.abs(a.v - b.v), back = dd > 0 ? a : b, front = dd > 0 ? b : a;
          if (Math.abs(dd) > 0.9 && back.v > front.v) { const dv = (back.v - front.v) * (1 - Math.exp(-5 * dt)); back.v -= dv * 0.75; front.v += dv * 0.25; }
          const key = a.idx * 16 + b.idx; const last = this.contactT.get(key) ?? -9;
          if (this.raceT - last > 0.6) { a.addWobble((3 + rel * 1.6) / a.st.wobbleRes, true); b.addWobble((3 + rel * 1.6) / b.st.wobbleRes, true); if (a.isPlayer || b.isPlayer) { AUDIO.thud(0.4); this.rumble(0.3, 0.1); this.game.shake(0.1); const o = a.isPlayer ? b : a, me = a.isPlayer ? a : b; me.rig.react && me.rig.react('bump', Math.sign(o.d - me.d) || 1); } }
          this.contactT.set(key, this.raceT);
        }
      }
      // static obstacles
      for (const o of this.world.obstacles) {
        let ds = a.s - o.s; if (ds > this.track.L / 2) ds -= this.track.L; if (ds < -this.track.L / 2) ds += this.track.L;
        if (Math.abs(ds) < o.hl + 0.9 && Math.abs(a.d - o.d) < o.hw + 0.38 && !a.crashed && !a.air) {
          const sg = a.d > o.d ? 1 : -1; a.d = o.d + sg * (o.hw + 0.4);
          if (o.kind === 'island') { a.v *= 0.94; a.addWobble(6 / a.st.wobbleRes, true); a.psi = sg * 0.06; a.shoveV = sg * 1.2; if (a.isPlayer) { AUDIO.thud(0.5); this.rumble(0.4, 0.12); this.game.shake(0.15); } continue; }
          const head = clamp(1 - Math.abs(a.d - o.d) / (o.hw + 0.38), 0, 1);   // dead-centre hits cost more than clipping a corner
          const tf = o.kind === 'traffic'; a.v *= tf ? lerp(0.93, 0.8, head) : lerp(0.88, 0.7, head); a.addWobble((tf ? 8 + 10 * head : 12 + 14 * head) / a.st.wobbleRes); a.psi = sg * 0.1; a.shoveV = sg * 1.8; a.rig.react && a.rig.react('hit', sg);
          if (a.isPlayer) { AUDIO.thud(1); this.rumble(0.8, 0.2); this.game.shake(0.5); this.hud.callout('THOK!', null, 'bad'); }
        }
      }
    }
    if (this._bumpT) { this._bumpT -= dt; if (this._bumpT <= 0) this._bumpT = 0; }
  }
  scoring(dt) {
    const P = this.player; if (P.finished || P.eliminated) return;
    // overtakes (and squeeze passes through narrow gaps)
    for (const r of this.riders) {
      if (r === P || r.eliminated) continue;
      const ahead = r.dist > P.dist;
      if (this.aheadSet.has(r) && !ahead) {
        this.aheadSet.delete(r);
        if (!r.crashed && !P.crashed && P.invuln <= 0 && r.invuln <= 0 && !r.finished) {
          let pts = this.award('overtakes', PTS.overtake); this.score.overtakeCount = (this.score.overtakeCount || 0) + 1;
          const chained = this.raceT - this.lastOvertakeT < 3.5; if (chained) pts += this.award('overtakes', PTS.chain); this.lastOvertakeT = this.raceT;
          if (this.track.wAt(P.s) < 7.2) { pts += this.award('squeeze', PTS.squeeze); this.hud.callout('EKDUM TIGHT!', `+${pts}`, 'good'); }
          else this.hud.callout(chained ? 'DOUBLE OVERTAKE' : 'OVERTAKE', `+${pts}`, 'good');
          this.game.comicPop(chained ? 'ZOOOM ZOOOM!' : 'ZOOOM!', r, 0.85, '#7df9ff');
          if (Math.random() < 0.45) { P.rig.gesture(Math.random() < 0.6 ? 'lookback' : 'wave', r.d > P.d ? 1 : -1); P.swagT = Math.max(P.swagT, 4); }
          this.taunts.say(r, 'passed');
        }
      } else if (!this.aheadSet.has(r) && ahead) { this.aheadSet.add(r); if (!r.crashed && !P.crashed && !r.finished && r.invuln <= 0) this.taunts.say(r, 'overtook'); }
      // near misses
      const dd = Math.abs(r.dist - P.dist), dl = Math.abs(r.d - P.d);
      if (dd < 0.7 && dl > 0.78 && dl < 1.05 && Math.abs(r.v - P.v) > 2.5 && !r.crashed && !P.crashed) {
        const last = this.nearMissT.get(r) || -9; if (this.raceT - last > 4) { this.nearMissT.set(r, this.raceT); P.boost = Math.min(100, P.boost + 15); this.game.comicPop('SWISSHH!', r, 0.75, '#ffffff'); this.hud.callout('NEAR MISS', `+${this.award('nearMiss', PTS.nearMiss)}`, 'good'); }
      }
    }
    // power-slide scoring when the slide ends
    if (this.prevSliding && !P.sliding) { if (P.slideDist > 8) { const pts = this.award('stunts', Math.min(150, P.slideDist * 0.5)); this.score.slides = (this.score.slides || 0) + 1; this.hud.callout(`POWER SLIDE ${Math.round(P.slideDist)} m`, `+${pts}`, 'stunt'); } P.slideDist = 0; }
    if (!P.sliding && !this.prevSliding) P.slideDist = 0;
    this.prevSliding = P.sliding;
    if (P.splatT > 0 && this.splatShown <= 0) { this.hud.splat(P.splatT); this.splatShown = P.splatT; }
    this.splatShown -= dt;
  }
  // ── events from riders / combat ──
  onLap(r, t) {
    // In a friends race a line crossed after this bike's own finish, or after the room server has ended the race, counts
    // for nothing: no second finish (its chime, a finish report the server would refuse), no lap record, no lead-lap points.
    if (this.mp && (r.finished || this.mpOver)) return;
    const lapTime = t - r.lapStart; r.lapStart = t; r.laps.push(lapTime); r.bestLap = Math.min(r.bestLap, lapTime);
    const done = r.laps.length;
    if (this.mode === 'elimination' && done > this.elimLap) { this.elimLap = done; this.eliminateLast(r); }
    if (r.isPlayer) {
      const rec = SAVE.records[this.def.id] || {};
      if (this.mode !== 'stunt' && (!rec.bestLap || lapTime < rec.bestLap)) {
        if (rec.bestLap && !this.lapRecordDone) { this.lapRecordDone = true; this.hud.callout('LAP RECORD!', `+${this.award('lapRecord', PTS.lapRecord)}`, 'gold'); }
        rec.bestLap = lapTime; SAVE.records[this.def.id] = rec;
        if (this.mode === 'timetrial' || this.mode === 'quick') { SAVE.ghosts[this.def.id] = this.ghostRecLap.slice(); }
      }
      if (this.riders.length > 1 && this.ranking()[0] === r) this.award('leadLap', 50);
      this.ghostRecLap = [];
      if (done < this.laps && !r.eliminated) { this.hud.lapFlash(done + 1 === this.laps ? 'FINAL LAP' : `LAP ${done + 1}/${this.laps}`, lapTime); AUDIO.lap(); }
    }
    if (done >= this.laps && !r.finished && !r.eliminated) this.finish(r, t);
  }
  eliminateLast(trigger) {
    const active = this.ranking().filter(x => !x.eliminated && !x.finished);
    if (active.length <= 1) return;
    const last = active[active.length - 1]; last.eliminated = true; this.elimOrder.unshift(last); last.rig.root.visible = false;
    this.hud.toast(`${last.isPlayer ? 'You are' : last.short + ' is'} OUT!`, 'fist');
    if (last.isPlayer) { this.playerDone(active.length); }
    if (active.length - 1 === 1) { const winner = active[0]; if (!winner.finished) this.finish(winner, this.raceT); }
  }
  finish(r, t) {
    r.finished = true; r.finishT = t; this.finishOrder.push(r);
    if (r.isPlayer) this.playerDone(this.ranking().indexOf(r) + 1);
  }
  playerDone(pos) {
    if (this.state === 'finished') return;
    this.state = 'finished'; this.playerPos = pos; this.player.finished = true; this.finishWall = performance.now();
    this.hud.finish(pos, this.riders.length > 1 ? this.riders.length : 0, this.mode);
    AUDIO.finish(pos === 1);
    // a friends race has no hero entry, and its results come from the room server (84_mp_race.js). Until they arrive
    // the HUD shows the live place, which still changes as remote finishes come in.
    if (this.mp) { this.playerPos = null; MPRACE.localFinish(this); return; }
    // a win (or a clean escape from the police) gets the hero entry; anything else goes straight to the results
    const won = this.police ? !this.police.busted : MODES[this.mode].rivals && pos === 1;
    if (won && this.player.rig.rm && (!DEBUG.autopilot || URLP.get('entry')) && SAVE.settings.entry !== false) this.game.startEntry(this, this.police ? 'BACH GAYA!' : 'FIRST!');
    else setTimeout(() => this.game.showResults(this), 3600);
  }
  onCrash(r, reason) {
    const R = this; if (r.isPlayer || this.distToPlayer(r) > 0.5) this.game.comicPop(r.isPlayer ? 'DHADAAM!' : 'DHADAAM!', r, r.isPlayer ? 1.25 : 0.9, r.isPlayer ? '#ff6a3d' : null);
    if (r.lastHitBy && this.raceT - r.lastHitT < 2.5 && r.lastHitBy !== r) {
      const a = r.lastHitBy;
      if (a.isPlayer) {
        let pts = this.award('knockdowns', this.mode === 'rumble' ? PTS.rumbleKnockdown : PTS.knockdown); this.score.knockCount = (this.score.knockCount || 0) + 1;
        if (this.player.downedBy === r) { pts += this.award('revenge', PTS.revenge); this.player.downedBy = null; this.hud.callout('BADLA PURA!', `+${pts}`, 'gold'); }
        else this.hud.callout(r.crashKind === 'blowout' ? 'TYRE BLOWOUT!' : 'TAKEDOWN!', `+${pts}`, 'gold');
        this.hud.toast(`Rival down! +${pts} pts`, 'fist');
        dailyProgress('knockdowns', 1);
      }
      if (r.isPlayer) r.downedBy = a;
    }
    this.combat.dropWeapons(r); this.combat.startWreck(r);
    if (this.state === 'racing' && r.wreck && (r.isPlayer || (r.lastHitBy && r.lastHitBy.isPlayer && this.raceT - r.lastHitT < 2.5))) this.game.takedownCam && this.game.takedownCam(r);
    if (r.isPlayer) { this.clean = false; this.hud.callout(reason === 'loop' ? 'LOOPED IT!' : reason === 'bars' ? 'OVER THE BARS!' : 'GIR GAYA!', null, 'bad'); AUDIO.crash(1); this.rumble(1, 0.4); this.game.shake(0.8); }
    else AUDIO.crash(this.distToPlayer(r));
  }
  onRespawn(r) { this.combat.endWreck(r); if (r.isPlayer) this.hud.callout('BACK ON TRACK', null, 'info'); r.rig.anim = null; r.rig.gesture('scratch', 1); r.swagT = Math.max(r.swagT || 0, 5); }
  onPothole(r, h) {
    this.combat.splash(r, h.big ? 1 : 0.5, this.wet);
    if (!r.isPlayer) return;
    AUDIO.thud(h.big ? 1 : 0.55); AUDIO.splash && this.wet && AUDIO.splash(h.big ? 1 : 0.5);
    this.rumble(h.big ? 0.9 : 0.35, 0.18); this.game.shake(h.big ? 0.45 : 0.14);
    if (h.big) { this.hud.callout('BADA GADDHA!', null, 'bad'); this.game.comicPop && this.game.comicPop('DHADAAM!', r, 1.1); }
  }
  onBreaker(r, b) {
    if (!r.isPlayer) return; const hop = r.air;   // fast riders hop breakers: a thump and a pop, no red penalty banner
    AUDIO.thud(clamp(r.v / 25, 0.25, 0.8)); this.rumble(clamp(r.v / 30, 0.2, 0.7), 0.12); this.game.shake(clamp(r.v / 70, 0.06, 0.25));
    if (hop && (!b.triple || !this._brkT || this.raceT - this._brkT > 1.2)) { this._brkT = this.raceT; this.game.comicPop && this.game.comicPop(b.triple ? 'DHAK DHAK DHAK!' : 'DHAK!', r, 0.8); }
  }
  // coins floating over jumps, gaps and shortcut lanes (player only)
  collectCoins() {
    const P = this.player, T = this.track; if (!this.coinState || P.crashed) return;
    const py = P.y + 0.75;
    for (let i = 0; i < T.coins.length; i++) { if (this.coinState[i]) continue; const c = T.coins[i]; const ds = T.wrapD(P.s - c.s); if (Math.abs(ds) > 1.3) continue;
      const cy = c.abs ? c.h : T.yAt(c.s) + c.h; if (Math.abs(P.d - c.d) > 1.1 || Math.abs(py - cy) > 1.15) continue;
      this.coinState[i] = 1; this.coinsGot = (this.coinsGot || 0) + 1; SAVE.coins += 5; AUDIO.coin && AUDIO.coin(); this.world.hideCoin && this.world.hideCoin(i); this.hud.coinTick && this.hud.coinTick(this.coinsGot); }
  }
  onHop(r) { if (r.isPlayer) { AUDIO.whoosh(0.35); AUDIO.thud(0.15); this.rumble(0.2, 0.05); } }
  onSlip(r) { if (!r.isPlayer) return; AUDIO.squeal(0.9); this.hud.callout('PHISAL GAYA!', null, 'bad'); this.game.comicPop('SKRRRT!', r, 0.9, '#9cc2ff'); }
  onLand(r, impact) { if (r.isPlayer && impact > 3.5) { this.game.shake(clamp(impact / 14, 0.15, 0.5)); this.game.comicPop && this.game.comicPop('DHAMM!', r, 0.8); } }
  onWall(r, into) { this.combat.wallSparks && this.combat.wallSparks(r, into); if (r.isPlayer && into > 0.08) { AUDIO.thud(clamp(into * 3, 0.3, 1)); this.rumble(clamp(into * 2, 0.2, 1), 0.15); this.game.shake(clamp(into, 0.1, 0.6)); } }
  onAir(r, t) { if (t > 0.8 && Math.random() < 0.6) { r.rig.gesture('hair', 1); r.swagT = Math.max(r.swagT || 0, 4); } if (r.isPlayer) { const pts = this.award('stunts', 30 + 20 * clamp((t - 0.5) / 1, 0, 1)); this.score.airs = (this.score.airs || 0) + 1; this.hud.callout(`AIR ${t.toFixed(1)} s`, `+${pts}`, 'stunt'); } }
  onWheelie(r, dist) { if (r.isPlayer) { const pts = this.award('stunts', Math.min(150, dist)); this.score.wheelies = (this.score.wheelies || 0) + 1; this.hud.callout(`WHEELIE ${Math.round(dist)} m`, `+${pts}`, 'stunt'); if (dist > 10) dailyProgress('wheelies', 1); } }
  onStoppie(r, t) { if (r.isPlayer && this.raceT - (this._stoppieT || -9) > 5) { this._stoppieT = this.raceT; const pts = this.award('stunts', clamp(20 + 60 * (t - 0.5) / 0.9, 20, 80)); this.score.stoppies = (this.score.stoppies || 0) + 1; this.hud.callout('STOPPIE', `+${pts}`, 'stunt'); } }
  onHit(t, a, kind) {
    if (a.isPlayer) { const pts = this.award('hits', PTS.hit); this.score.hitCount = (this.score.hitCount || 0) + 1; this.hud.popAt(t, 'HIT!', `+${pts}`); this.hud.toast(`Rival Hit! +${pts} pts`, 'fist'); }
    if (t.isPlayer) { this.hud.flashHit(Math.sign(a.d - t.d)); this.rumble(0.7, 0.2); this.game.shake(0.4); }
  }
  onDodge(p) { if (p.isPlayer && !p.crashed) this.hud.callout('DODGE!', `+${this.award('dodges', PTS.dodge)}`, 'good'); }
  onSpit(t, a) { if (a.isPlayer) { const pts = this.award('hits', PTS.hit); this.hud.popAt(t, 'THUK!', `+${pts}`); } if (t.isPlayer) this.splatShown = 0; }
  ranking() {
    return this.riders.slice().sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.eliminated && b.eliminated) return this.elimOrder.indexOf(a) - this.elimOrder.indexOf(b);
      if (a.finished && b.finished) return a.finishT - b.finishT;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.dist - a.dist;
    });
  }
  // ── ghost (time trial) ──
  recordGhost() { const P = this.player; this._gAcc = (this._gAcc || 0) + 1; if (this._gAcc % 6) return; this.ghostRecLap.push([+(P.dist - Math.max(0, P.lap) * this.track.L).toFixed(2), +P.d.toFixed(2), +P.psi.toFixed(3), +P.lean.toFixed(3), +P.pitch.toFixed(3), +(this.raceT - P.lapStart).toFixed(2)]); }
  updateGhost() {
    const G = this.ghost, P = this.player, data = G.data; if (!data || data.length < 2) return;
    const lt = this.raceT - P.lapStart; let i = G.i || 0; while (i < data.length - 2 && data[i + 1][5] < lt) i++; if (data[i][5] > lt) i = 0; G.i = i;
    const a = data[i], b = data[Math.min(i + 1, data.length - 1)]; const f = clamp((lt - a[5]) / Math.max(0.001, b[5] - a[5]), 0, 1);
    const s = lerp(a[0], b[0], f), d = lerp(a[1], b[1], f), psi = lerp(a[2], b[2], f), lean = lerp(a[3], b[3], f), pitch = lerp(a[4], b[4], f);
    const T = this.track; T.pos(s, d, G.rig.root.position); G.rig.root.rotation.y = T.yawAt(s) + psi; G.rig.update(1 / 60, { lean, pitch, speed: 20 });
    G.rig.root.visible = this.state === 'racing' && lt < data[data.length - 1][5];
  }
  // ── visuals ──
  syncVisuals(dt) {
    const T = this.track;
    for (const r of this.riders) {
      if (r.eliminated) continue;
      if (r.wreck) { this.combat.poseWreck(r); r.rig.root.visible = true; r.rig.update(dt, { lean: 0, pitch: 0, speed: Math.max(0, r.wreck.bike.vs), crashed: true, susp: 0, slide: 0 }); continue; }
      T.pos(r.s, r.d, r.rig.root.position, r.y - T.yAt(r.s));
      const wob = r.wobble > 30 && !r.crashed ? Math.sin(this.raceT * 28 + r.idx) * (r.wobble - 30) / 70 * 0.12 : 0;
      r.rig.root.rotation.y = T.yawAt(r.s) + r.psi + wob;
      r.rig.root.visible = !(r.invuln > 0 && Math.floor(this.raceT * 10) % 2 === 0);
      this.swagger(r, dt);
      r.rig.update(dt, { boost: r.boosting, susp: r.susp, surf: r.surf, lean: r.lean + wob * 0.6, pitch: r.pitch, speed: r.v, tuck: r.tuck, weightBack: r.input.back && !r.crashed, steer: r.input.steer, crashed: r.crashed, slide: r.slide, air: r.air, celebrate: r.finished && (this.mp ? this.mpFirst === r : this.finishOrder[0] === r) });
      if (!r.crashed && (r.v > 1 || this.state === 'countdown')) this.combat.exhaust(r, dt);
      if (this.state === 'countdown' && r.isPlayer) this.combat.exhaust(r, dt);
    }
  }
  // style moves on calm stretches: not mid-corner, not in the air, not mid-fight, not on a bad surface
  swagger(r, dt) {
    if (this.state !== 'racing' || r.crashed || r.finished) return; r.swagT -= dt; if (r.swagT > 0) return;
    const T = this.track, calm = !r.air && r.v > 7 && Math.abs(r.lean) < 0.2 && Math.abs(T.kAt(r.s)) < 1 / 90 && !r.wheelie && !r.stoppie && r.surf === 0 && r.wobble < 25 && (!r.isPlayer || Math.abs(r.input.steer) < 0.35);
    if (!calm) { r.swagT = 0.5; return; }
    const pool = SAVE.settings.smoking !== false ? ['smoke', 'smoke', 'hair', 'hair', 'mustache', 'shades', 'scratch', 'wave'] : ['hair', 'hair', 'mustache', 'shades', 'scratch', 'wave'];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (r.rig.gesture(pick, Math.random() < 0.5 ? 1 : -1)) r.swagT = (r.isPlayer ? 7 : 14) + Math.random() * (r.isPlayer ? 7 : 12); else r.swagT = 1;
  }
  dispose() { this.riders.forEach(r => r.rig.dispose()); if (this.ghost) this.ghost.rig.dispose(); this.combat.dispose(); if (this.ug) this.ug.dispose(); if (this.taunts) this.taunts.dispose(); if (this.street) this.street.dispose(); }
}
function buildStatsStock() { const b = BUILDS[0]; return { build: b, top: 100, acc: 1, lean: 45, grip: 1, brake: 1, wobbleRes: 1, zeroTo100: 7.8, boostFill: 1, wheelieEase: 0, lvls: {} }; }
function makeGhost(rig) { const m = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.32, depthWrite: false }); rig.root.traverse(o => { if (o.isMesh) { o.material = m; o.castShadow = false; } }); rig.blob.visible = false; }
function dailyProgress(id, n) { const d = SAVE.daily; d.prog[id] = (d.prog[id] || 0) + n; persist(); }
