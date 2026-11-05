// ───────────────────────── STAGE RUNTIME + POLICE EXPRESS+ ─────────────────────────
// StageOps (any mode on a stage that has them): smashable naka barricades, naka jumps, stray dogs, water splash, step rattle.
// PoliceOps (Police Express+ only): three chasing cops with lathis and sirens, the BUSTED meter, and naka riflemen
// whose shots are telegraphed by a laser for most of a second, so a swerve dodges them.
const COP_NAMES = [['Havaldar Pandey', 'Pandey'], ['Inspector Shinde', 'Shinde'], ['Constable Gaikwad', 'Gaikwad']];
const DOG_G = (() => { const b = new Batch(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const bx = (x, y, z, sx, sy, sz, rx = 0) => { Q.setFromEuler(new THREE.Euler(rx, 0, 0)); M.compose(P.set(x, y, z), Q, S.set(sx, sy, sz)); b.add(UNIT_BOX, M, new THREE.Color('#ffffff')); };
  bx(0, 0.44, 0, 0.22, 0.2, 0.56); bx(0, 0.47, 0.18, 0.24, 0.23, 0.22); bx(0, 0.62, 0.34, 0.17, 0.17, 0.18); bx(0, 0.58, 0.46, 0.1, 0.08, 0.12);
  for (const sx of [-1, 1]) bx(sx * 0.06, 0.73, 0.31, 0.05, 0.08, 0.04, 0.3);
  bx(0, 0.6, -0.33, 0.04, 0.04, 0.24, 0.9);
  return b.build(); })();
const DOG_LEG = new THREE.BoxGeometry(0.06, 0.36, 0.06).translate(0, -0.18, 0);

class Dog {
  constructor(spot, race) {
    this.race = race; this.s = spot.s; this.side = spot.side; this.state = 'idle'; this.cd = 0; this.t = Math.random() * 5; this.dir = 0; this.speed = 0; this.hopY = 0; this.dodged = false;
    const mat = new THREE.MeshLambertMaterial({ color: spot.col }); this.mat = mat;
    this.g = new THREE.Group(); const body = new THREE.Mesh(DOG_G, mat); body.castShadow = true; this.g.add(body);
    this.legs = [[-0.07, 0.2], [0.07, 0.2], [-0.07, -0.2], [0.07, -0.2]].map(([x, z]) => { const l = new THREE.Mesh(DOG_LEG, mat); l.position.set(x, 0.38, z); this.g.add(l); return l; });
    race.group.add(this.g); this.d = 0; this._p = new THREE.Vector3(); this._q = new THREE.Vector3();
  }
  update(dt, ops) {
    const R = this.race, T = R.track, P = R.player, w = T.wAt(this.s) / 2; this.t += dt; this.cd -= dt;
    if (this.state === 'idle') { this.d = this.side * (w + 1.3);
      const ds = T.wrapD(this.s - P.s); if (R.state === 'racing' && ds > 13 && ds < 30 + P.v * 0.3 && this.cd <= 0 && P.v > 7 && !P.crashed) { this.state = 'run'; this.dir = -this.side; this.speed = 5 + Math.random() * 1.5; this.dodged = false; if (ds < 40) AUDIO.bark && AUDIO.bark(0.7); } }
    else if (this.state === 'run' || this.state === 'flee') { this.d += this.dir * this.speed * dt; if (this.state === 'flee') this.hopY = Math.abs(Math.sin(this.t * 14)) * 0.25;
      if (this.dir * this.d > w + 1.3) { this.cd = this.state === 'flee' ? 12 : 7; this.state = 'idle'; this.side = -this.side; this.hopY = 0; } }
    // collisions with riders while it's on the road
    if (this.state === 'run') for (const r of R.riders) { if (r.crashed || r.eliminated || (r.air && r.y - T.yAt(r.s) > 0.5)) continue; const ds = T.wrapD(r.s - this.s);
      if (Math.abs(ds) < 0.95 && Math.abs(r.d - this.d) < 0.55) { this.state = 'flee'; this.speed = 9; AUDIO.yelp && AUDIO.yelp(R.distToPlayer(r));
        r.addWobble(26 / r.st.wobbleRes); r.v *= 0.8; r.psi += (r.d > this.d ? 1 : -1) * 0.08;
        if (r.isPlayer) { R.hud.callout('KUTTA!', null, 'bad'); R.game.comicPop('BHOW!', r, 1.05, '#ffd23f'); R.rumble(0.6, 0.15); R.game.shake(0.3); if (R.police) R.police.addHeat(4); } }
      else if (r.isPlayer && !this.dodged && ds > 0.95 && ds < 3 && Math.abs(r.d - this.d) < 2.6) { this.dodged = true; R.hud.callout('DOG DODGE', `+${R.award('dogs', 25)}`, 'good'); } }
    // pose
    T.pos(this.s, this.d, this._p, (Math.abs(this.d) > w + 0.45 ? 0.18 : 0) + this.hopY); this.g.position.copy(this._p);
    T.pos(this.s, this.d + 1, this._q, 0); const lx = this._q.x - this._p.x, lz = this._q.z - this._p.z; const along = T.yawAt(this.s);
    this.g.rotation.y = this.state === 'idle' ? Math.atan2(-this.side * lx, -this.side * lz) + Math.sin(this.t * 0.7) * 0.5 : Math.atan2(this.dir * lx, this.dir * lz);
    const run = this.state === 'idle' ? 0 : 1, f = this.t * (this.state === 'flee' ? 22 : 16);
    this.legs.forEach((l, i) => { l.rotation.x = run * Math.sin(f + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.7; });
    this.g.visible = Math.abs(T.wrapD(this.s - P.s)) < 160;
  }
  dispose() { this.g.removeFromParent(); this.mat.dispose(); }
}

class StageOps {
  constructor(race) {
    this.race = race; const T = race.track, W = race.world;
    this.dogs = T.dogSpots.map(sp => new Dog(sp, race)); this.lastS = new Map(); this.inWater = false; this.splashT = 0; this.steps = 0; W.resetBarricades && W.resetBarricades();
  }
  update(dt) {
    const R = this.race, T = R.track, W = R.world, P = R.player;
    // barricades: anything below ~0.8 m over the road goes through them
    for (const b of W.barricades || []) { if (b.broken) { if (b.t > 3 && Math.abs(T.wrapD(b.s - P.s)) > 220) { b.broken = false; b.t = 0; b.g.position.copy(b.base); b.g.rotation.set(0, b.yaw, 0); b.g.visible = true; } continue; }
      for (const r of R.riders) { if (r.crashed || r.eliminated) continue; const ds = T.wrapD(r.s - b.s); if (Math.abs(ds) > 0.8 || Math.abs(r.d - b.d) > b.hw + 0.32) continue; if (r.y - T.yAt(r.s) > 0.85) continue;
        W.smashBarricade(b, r.v); r.v *= 0.62; r.addWobble(30 / r.st.wobbleRes);
        if (r.isPlayer) { R.hud.callout('NAKA TOD!', `+${R.award('barricades', 40)}`, 'bad'); R.score.barricadeCount = (R.score.barricadeCount || 0) + 1; R.game.comicPop('CRAAASH!', r, 1.2, '#ff6a3d'); AUDIO.crash(0.45); AUDIO.glass(0.4); R.rumble(0.9, 0.25); R.game.shake(0.6); if (R.police) R.police.addHeat(14); }
        else if (R.distToPlayer(r) > 0.4) AUDIO.crash(0.25 * R.distToPlayer(r)); break; } }
    // clearing a naka in the air
    const prev = this.lastS.get(P); if (prev !== undefined && !P.crashed) for (const n of T.nakas) { const a = T.wrapD(prev - n.s), b = T.wrapD(P.s - n.s); if (a < 0 && b >= 0 && b < 5 && P.air && P.y - T.yAt(P.s) > 0.85) {
      R.hud.callout('NAKA JUMP!', `+${R.award('nakas', 120)}`, 'gold'); R.score.nakaCount = (R.score.nakaCount || 0) + 1; R.game.comicPop('WHOOOSH!', P, 1.15, '#3fd0c9'); if (R.police) R.police.addHeat(-12); } }
    this.lastS.set(P, P.s);
    for (const d of this.dogs) d.update(dt, this);
    // water: spray off every bike in the nala, a splash when the player hits it
    this.splashT -= dt;
    for (const r of R.riders) if (r.surf === 4 && r.v > 3 && (r.isPlayer || R.distToPlayer(r) > 0.3) && Math.random() < dt * 30) R.combat.splash(r, Math.min(1.4, r.v / 12), true);
    const wet = P.surf === 4; if (wet && !this.inWater && P.v > 6) { R.game.comicPop('SPLAAASH!', P, 1.1, '#9cd8ff'); AUDIO.splash(1); R.rumble(0.4, 0.12); R.game.shake(0.25); }
    if (wet && this.splashT <= 0 && P.v > 3) { this.splashT = 0.22; AUDIO.splash(0.25 + P.v / 40); } this.inWater = wet;
    // seedhi: rattle
    if (P.surf === 3 && P.stepHit !== this.steps) { if ((P.stepHit % 3) === 0) { AUDIO.thud(0.18); R.rumble(0.12, 0.04); } R.game.shake(0.05); this.steps = P.stepHit; }
  }
  dispose() { this.dogs.forEach(d => d.dispose()); }
}

class PoliceOps {
  // three cops on white police bikes, added to the race's riders (they never count as racers)
  static addCops(race) {
    const pst = race.player.st, st = Object.assign({}, buildStatsStock(), { top: Math.max(100, pst.top * 0.96), acc: Math.max(1.0, pst.acc * 0.97), grip: 1.04, lean: 47, wobbleRes: 1.2 });   // a touch slower than you: they catch you when you slip up
    race.cops = COP_NAMES.map(([name, short], i) => {
      const look = { tank: '#f4f4f2', accent: '#1d3f8f', shirt: '#d2b67c', flowers: false, helmet: i === 1 ? null : '#f4f4f2', shades: i === 2 ? '#111' : null, hair: 'buzz', hairColor: '#15100c', beard: i === 1, jeans: '#bfa36b', mods: { exhaust: 'stock', tyres: 'stock', kit: 'police', finish: 'gloss' } };
      const r = new Rider(race, 20 + i, { name, short, stats: st, look, cop: true, rival: { skill: 1, corner: 1.02, style: 'cop', aggr: 1.7 } });
      r.weapons.melee = { kind: 'lathi', uses: 999 }; r.rig.showWeapon('lathi'); r.ai.jumper = true; r.ai.shortcut = false; r.ai.laneBias = (i - 1) * 0.6;
      race.riders.push(r); return r; });
  }
  constructor(race) {
    this.race = race; this.heat = 0; this.busted = false; this.lostT = 0; this.warned = 0; this.heatMul = { easy: 0.7, normal: 1, hard: 1.35 }[race.diffKey] || 1;
    const W = race.world, g = race.group;
    this.shooters = (W.nakaShooters || []).map(sh => ({ ...sh, cd: 0.5 + Math.random(), aim: 0, fireT: 0, aimS: 0, aimD: 0 }));
    const red = new THREE.MeshBasicMaterial({ color: '#ff3346', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), dot = new THREE.MeshBasicMaterial({ color: '#ff3346', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const tracer = new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0.95, depthWrite: false }), flash = new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.95, depthWrite: false });
    this.mats = [red, dot, tracer, flash]; this.geos = [new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.CircleGeometry(0.45, 18).rotateX(-Math.PI / 2), new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.IcosahedronGeometry(0.22, 0)];
    for (const s of this.shooters) { s.laser = new THREE.Mesh(this.geos[0], red); s.dot = new THREE.Mesh(this.geos[1], dot); s.tracer = new THREE.Mesh(this.geos[2], tracer); s.flash = new THREE.Mesh(this.geos[3], flash);
      for (const m of [s.laser, s.dot, s.tracer, s.flash]) { m.visible = false; m.frustumCulled = false; g.add(m); } }
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._d = new THREE.Vector3();
  }
  addHeat(v) { if (!this.busted) this.heat = clamp(this.heat + v, 0, 100); }
  beam(m, a, b) { this._d.subVectors(b, a); const L = this._d.length(); m.position.copy(a).addScaledVector(this._d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(UP, this._d.normalize()); }
  nearestCop() { const R = this.race, P = R.player; let best = null, bd = 1e9; for (const c of R.cops) { if (c.crashed) continue; const gap = P.dist - c.dist; const dd = Math.abs(gap) + Math.abs(c.d - P.d) * 0.5; if (dd < bd) { bd = dd; best = c; } } return { cop: best, dist: bd }; }
  update(dt) {
    const R = this.race, T = R.track, P = R.player;
    if (R.state !== 'racing' || this.busted) { for (const s of this.shooters) s.laser.visible = s.dot.visible = s.tracer.visible = s.flash.visible = false; return; }
    // BUSTED meter
    const { dist } = this.nearestCop(); this.copDist = dist;
    const hm = this.heatMul;
    if (P.crashed) this.addHeat((dist < 25 ? 30 : 6) * hm * dt);
    else if (dist < 3.5) this.addHeat((P.v < 9 ? 15 : 6.5) * hm * dt);
    else if (dist < 12) this.addHeat(1.5 * hm * dt);
    else this.addHeat(-(dist > 80 ? 14 : 9) * dt);
    if (dist > 120) { this.lostT += dt; if (this.lostT > 2 && !this.lostShown) { this.lostShown = true; R.hud.callout('POLICE PEECHE CHHOOT GAYI!', `+${R.award('escapeGap', 100)}`, 'gold'); } } else { this.lostT = 0; if (dist < 40) this.lostShown = false; }
    if (this.heat > 70 && R.raceT - this.warned > 3) { this.warned = R.raceT; R.hud.callout('PAKDA JAYEGA!', null, 'bad'); AUDIO.warn(); }
    if (this.heat >= 100 && !URLP.has('nobust')) { this.busted = true; P.v *= 0.3; P.input.throttle = 0; R.hud.big('PAKDA GAYA!', 'Police ne pakad liya', 3.2); AUDIO.crash(0.4); R.game.comicPop('PAKDA!', P, 1.4, '#2a58ff'); R.playerDone(0); return; }
    // naka riflemen: aim (laser follows you, then locks), fire
    for (const s of this.shooters) {
      s.cd -= dt; s.fireT = Math.max(0, s.fireT - dt); s.tracer.visible = s.flash.visible = s.fireT > 0;
      const ahead = T.wrapD(s.naka.s - P.s);
      if (s.aim > 0) {
        s.aim -= dt; if (s.aim > 0.38) { s.aimS = P.s + P.v * Math.min(0.45, s.aim); s.aimD = P.d; }   // tracking … then locked for the last 0.38 s
        T.pos(s.aimS, s.aimD, this._b, 0.9); this.beam(s.laser, s.muzzle, this._b); T.pos(s.aimS, s.aimD, s.dot.position, 0.04); s.laser.visible = s.dot.visible = true;
        s.dot.scale.setScalar(1 + Math.sin(R.raceT * 40) * 0.25);
        if (s.aim <= 0) { s.laser.visible = s.dot.visible = false; s.fireT = 0.07; s.cd = 1.0 + Math.random() * 0.9; this.beam(s.tracer, s.muzzle, this._b); s.flash.position.copy(s.muzzle); s.flash.scale.setScalar(0.8 + Math.random() * 0.6);
          const vol = clamp(1 - Math.abs(ahead) / 90, 0.25, 1); AUDIO.gunshot && AUDIO.gunshot(vol);
          const hit = !P.crashed && Math.abs(T.wrapD(P.s - s.aimS)) < 2.3 && Math.abs(P.d - s.aimD) < 0.85 && P.y - T.yAt(P.s) < 1.6;
          if (hit) { P.addWobble(24 / P.st.wobbleRes); P.v *= 0.86; this.addHeat(10); R.hud.callout('GOLI LAGI!', null, 'bad'); R.game.comicPop('DHAAIN!', P, 1.2, '#ff3346'); R.combat.sparksAt && R.combat.sparksAt(P); R.rumble(0.8, 0.2); R.game.shake(0.5); }
          else if (Math.abs(P.d - s.aimD) < 3 && Math.abs(T.wrapD(P.s - s.aimS)) < 6) { R.hud.callout('BAAL BAAL BACHE!', `+${R.award('shotsDodged', 30)}`, 'good'); R.score.shotDodges = (R.score.shotDodges || 0) + 1; } }
      } else { s.laser.visible = s.dot.visible = false;
        const busy = this.shooters.some(o => o !== s && o.naka === s.naka && o.aim > 0);
        if (ahead > 10 && ahead < 78 && s.cd <= 0 && !busy && !P.crashed) { s.aim = 0.95; s.aimS = P.s; s.aimD = P.d; } }
    }
  }
  dispose() { this.mats.forEach(m => m.dispose()); this.geos.forEach(g => g.dispose()); }
}
