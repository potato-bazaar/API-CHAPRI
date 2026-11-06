// ───────────────────────── PARTICLES ─────────────────────────
class Particles {
  constructor(max, tex, additive = false) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.c = new Float32Array(max * 4); this.sz = new Float32Array(max);
    this.life = new Float32Array(max); this.age = new Float32Array(max); this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 400 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec4 pcol; attribute float psize; uniform float scale; varying vec4 vC; void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.rgb, vC.a * t.a); if (gl_FragColor.a < 0.01) discard; }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.geom = g;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, col, a = 1, drag = 1, grav = 0) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.c[i * 4] = col.r; this.c[i * 4 + 1] = col.g; this.c[i * 4 + 2] = col.b; this.c[i * 4 + 3] = a; this.a0[i] = a;
    this.life[i] = life; this.age[i] = 0; this.s0[i] = s0; this.s1[i] = s1; this.sz[i] = s0; this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt; if (this.age[i] >= this.life[i]) { this.n--; this.swap(i, this.n); i--; continue; }
      const t = this.age[i] / this.life[i], dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt; this.vel[i * 3 + 2] *= dr;
      this.p[i * 3] += this.vel[i * 3] * dt; this.p[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.sz[i] = lerp(this.s0[i], this.s1[i], t); this.c[i * 4 + 3] = this.a0[i] * (1 - t) * (1 - t);
    }
    this.geom.setDrawRange(0, this.n);
    this.geom.attributes.position.needsUpdate = true; this.geom.attributes.pcol.needsUpdate = true; this.geom.attributes.psize.needsUpdate = true;
  }
  swap(i, j) {
    const cp = (arr, k) => { for (let m = 0; m < k; m++) arr[i * k + m] = arr[j * k + m]; };
    cp(this.p, 3); cp(this.vel, 3); cp(this.c, 4); for (const a of [this.sz, this.life, this.age, this.s0, this.s1, this.a0, this.drag, this.grav]) a[i] = a[j];
  }
  clear() { this.n = 0; this.geom.setDrawRange(0, 0); }
  dispose() { this.geom.dispose(); this.mat.dispose(); }
}

// ───────────────────────── COMBAT, PICKUPS, PROJECTILES ─────────────────────────
const WEAPONS = {
  kick: { dur: 0.36, strike: 0.17, reach: 1.0, wob: 24, anim: 'kick' },
  belt: { dur: 0.36, strike: 0.19, reach: 1.5, wob: 18, anim: 'swing', uses: 8 },
  lathi: { dur: 0.42, strike: 0.22, reach: 1.6, wob: 22, anim: 'swing', uses: 999 },
  chain: { dur: 0.62, strike: 0.42, reach: 2.0, wob: 58, anim: 'swing', uses: 6 },
  bottle: { uses: 1, slot: 'throw' },
  gutka: { uses: 3, slot: 'throw' },
};
const C_STAR = col('#ffd23f'), C_SPIT = col('#8a1a12'), C_GLASS = col('#c8f0ff'), C_SMOKE = col('#d8dce8'), C_DUST = col('#b0a69a'), C_FIRE = col('#ffb347'), C_WATER = col('#cfe0ff'), C_MUD = col('#6b4a2b'), C_MUDW = col('#4a3018'), C_GRIT = col('#5b5650');

class Combat {
  constructor(race) {
    this.race = race; this.group = new THREE.Group();
    this.smoke = new Particles(700, TEX.soft, false); this.mud = new Particles(260, TEX.blob, false); this.stars = new Particles(160, TEX.star, true); this.sparks = new Particles(220, TEX.soft, true);
    this.spray = new Particles(1100, TEX.soft, false);   // monsoon tyre spray: rooster tails, side sheets, mist
    this.group.add(this.smoke.points, this.stars.points, this.sparks.points, this.mud.points, this.spray.points);
    const night = race.world && race.world.mood ? race.world.mood.night : 0; this.sprayCol = col(night > 0.5 ? '#a3b0c8' : '#eef3fa'); this.mistCol = col(night > 0.5 ? '#7d89a3' : '#d8e0ec');
    this.projectiles = []; this.glass = []; this.pickups = [];
    // pickups: one Points cloud per type keeps draw calls low
    this.pickClouds = {};
    for (const type of ['oil', 'chain', 'belt', 'bottle', 'gutka']) {
      const g = new THREE.BufferGeometry(); const n = 40; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const m = new THREE.PointsMaterial({ map: TEX['icon_' + type], size: 1.25, sizeAttenuation: true, transparent: true, alphaTest: 0.3, depthWrite: true });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false; this.group.add(pts); this.pickClouds[type] = { g, m, pts };
    }
    for (const sp of race.world.pickupSpots) this.pickups.push({ ...sp, active: true, t: 0, dropped: false });
    this.bottleMeshes = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(BOTTLE_G, BIKE_MAT); m.visible = false; m.scale.setScalar(1.6); this.group.add(m); this.bottleMeshes.push(m); }
    this.glassMat = new THREE.MeshBasicMaterial({ map: TEX.glass, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
  }
  get allowed() { const R = this.race; return R.combatOn && R.raceT > (R.police ? 3 : 10); }
  // ── attacks ──
  melee(r, side) {
    if (!this.allowed || r.crashed || r.attack || r.finished) return false;
    const kind = r.weapons.melee ? r.weapons.melee.kind : 'kick';
    if (kind === 'kick' && r.kickCD > 0) return false;
    const W = WEAPONS[kind];
    const target = this.nearestSide(r, side, W.reach + 0.6);
    r.attack = { kind, side, t: 0, W, target, hit: false };
    r.rig.play(W.anim, side, W.dur); if (kind !== 'kick') r.rig.showWeapon(kind);
    if (kind === 'kick') r.kickCD = 1.0; else { r.weapons.melee.uses--; }
    if (Math.abs(r.lean) > 0.52) r.addWobble(15);
    if (target && target.isPlayer && !r.isPlayer) this.race.hudWarn(r.d > target.d ? 'left' : 'right');
    if (r.isPlayer) AUDIO.whoosh();
    return true;
  }
  nearestSide(r, side, reach) {
    let best = null, bd = 1e9;
    for (const o of this.race.riders) { if (o === r || o.eliminated || o.crashed || (r.cfg.cop && !o.isPlayer)) continue; const dd = o.dist - r.dist, lat = side * (o.d - r.d);
      if (Math.abs(dd) < 1.5 && lat > 0.25 && lat < reach + 0.55 && Math.abs(dd) + lat < bd) { bd = Math.abs(dd) + lat; best = o; } }
    return best;
  }
  autoSide(r) { // touch MAAR: pick the side with the closest rival alongside
    let best = null, bd = 1e9;
    for (const o of this.race.riders) { if (o === r || o.eliminated || o.crashed) continue; const dd = Math.abs(o.dist - r.dist), lat = Math.abs(o.d - r.d); if (dd < 2.5 && lat < 3 && dd + lat < bd) { bd = dd + lat; best = o; } }
    return best ? (best.d > r.d ? 1 : -1) : (r.input.steer > 0 ? -1 : 1);
  }
  updateAttack(r, dt) {
    const A = r.attack; if (!A) return; A.t += dt;
    if (!A.hit && A.t >= A.W.strike) {
      A.hit = true; const W = A.W;
      const tgt = this.nearestSide(r, A.side, W.reach);
      if (tgt && !tgt.invuln && !tgt.crashed) this.hit(tgt, r, A.kind, A.side);
      else if (A.target && A.target.isPlayer) this.race.onDodge(A.target);
      else if (r.isPlayer) AUDIO.whoosh(0.5);
    }
    if (A.t >= A.W.dur) { r.attack = null; r.rig.showWeapon(r.weapons.melee ? r.weapons.melee.kind : r.weapons.throw && r.weapons.throw.kind === 'bottle' ? 'bottle' : null); if (r.weapons.melee && r.weapons.melee.uses <= 0) { r.weapons.melee = null; r.rig.showWeapon(null); } }
  }
  hit(t, a, kind, side) {
    const W = WEAPONS[kind] || { wob: 60 }; const R = this.race;
    let wob = W.wob ?? 60;
    if (kind === 'kick') { const toWall = Math.sign(t.d - a.d) * t.d; if (toWall > t.halfW - 1.2) wob *= 1.8; }
    if (kind === 'belt') { t.beltHits = (R.raceT - (t.beltT || -9) < 2.5) ? (t.beltHits || 0) + 1 : 1; t.beltT = R.raceT; if (t.beltHits >= 3) { wob += 30; t.beltHits = 0; } if (t.input.back) wob *= 0.3; }
    t.addWobble(wob / t.st.wobbleRes); t.shoveV += side * (kind === 'chain' ? 3.5 : 2.6); t.v *= 0.97;
    if (a.cfg.cop && t.isPlayer && R.police) { R.police.addHeat(6); a.v *= 0.86; }
    t.rig.react ? t.rig.react('hit', side) : t.rig.play('hit', side, 0.35); t.lastHitBy = a; t.lastHitT = R.raceT;
    const p = this.riderPos(t, 1.2); for (let i = 0; i < 10; i++) this.stars.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.45, 0.6, 1.4, C_STAR, 1, 3, 2);
    AUDIO.dhishoom(a.isPlayer || t.isPlayer ? 1 : this.race.distToPlayer(t));
    if (a.isPlayer || t.isPlayer) R.game.comicPop(({ kick: 'DHAPP!', chain: 'CHHANNN!', belt: 'SATAAK!' })[kind] || 'DHISHOOM!', t, t.isPlayer ? 0.9 : 1.1, t.isPlayer ? '#ff6a3d' : null);
    R.onHit(t, a, kind);
  }
  throwItem(r) {
    if (!this.allowed || r.crashed || r.finished || !r.weapons.throw || r.attack) return false;
    const w = r.weapons.throw; w.uses--;
    if (w.kind === 'bottle') {
      r.rig.play('throw', -1, 0.4);
      let aimD = r.d; let best = null, bd = 1e9; for (const o of this.race.riders) { if (o === r || o.eliminated) continue; const dd = o.dist - r.dist; if (dd > 3 && dd < 18 && Math.abs(o.d - r.d) < 2.5 && dd < bd) { bd = dd; best = o; } }
      const flight = 0.75; if (best) aimD = best.d;
      this.projectiles.push({ dist: r.dist + 0.8, d: r.d, h: r.y + 1.5, vAlong: r.v + 15 / flight * 0.75, vd: (aimD - r.d) / flight, vh: 3.2, owner: r, t: 0, spin: 0 });
      if (r.isPlayer) AUDIO.whoosh(0.8);
    } else if (w.kind === 'gutka') {
      let best = null, bd = 1e9; for (const o of this.race.riders) { if (o === r || o.eliminated || o.crashed) continue; const dd = o.dist - r.dist; if (Math.abs(dd) < 3.6 && Math.abs(o.d - r.d) < 1.4 && Math.abs(dd) < bd) { bd = Math.abs(dd); best = o; } }
      const dir = best ? Math.sign(best.dist - r.dist) || 1 : 1;
      r.rig.play('spit', best ? (best.d > r.d ? 1 : -1) : 1, 0.3);
      const p = this.riderPos(r, 1.55); const fw = this.fwd(r);
      for (let i = 0; i < 14; i++) this.sparks.emit(p.x, p.y, p.z, fw.x * dir * (6 + Math.random() * 4) + (Math.random() - 0.5), Math.random() * 1.5, fw.z * dir * (6 + Math.random() * 4) + (Math.random() - 0.5), 0.5, 0.18, 0.1, C_SPIT, 1, 1, 6);
      AUDIO.thuk();
      if (best && !best.invuln) { best.splatT = best.isPlayer && SAVE.cos.helmet !== 'none' ? 0.75 : 1.5; best.lastHitBy = r; best.lastHitT = this.race.raceT; this.race.onSpit(best, r); }
    }
    if (w.uses <= 0) r.weapons.throw = null;
    r.rig.showWeapon(r.weapons.melee ? r.weapons.melee.kind : r.weapons.throw && r.weapons.throw.kind === 'bottle' ? 'bottle' : null);
    return true;
  }
  riderPos(r, yOff = 0) { return this.race.track.pos(r.s, r.d, this._v, yOff + (r.y - this.race.track.yAt(r.s))); }
  fwd(r) { const yaw = this.race.track.yawAt(r.s) + r.psi; return this._w.set(Math.sin(yaw), 0, Math.cos(yaw)); }
  // ── AI combat brain ──
  aiFight(r, dt) {
    if (!this.allowed || r.crashed || r.attack || r.finished) return;
    r.ai.attackCD -= dt; if (r.ai.attackCD > 0) return; r.ai.attackCD = 0.3;
    const P = r.cfg.rival; const D = this.race.diff;
    let aggr = D.aggr * (P ? P.aggr : 1) * (this.race.mode === 'rumble' ? 1.8 : 1);
    if (P && P.style === 'clean') aggr = r.lastHitBy && this.race.raceT - r.lastHitT < 6 ? 0.9 : 0;
    if (aggr <= 0) return;
    const kind = r.weapons.melee ? r.weapons.melee.kind : 'kick';
    const reach = WEAPONS[kind].reach;
    for (const side of [1, -1]) { const t = this.nearestSide(r, side, reach); if (t && (P && P.style === 'clean' ? t === r.lastHitBy : true) && RNG() < aggr * 0.32) { this.melee(r, side); r.ai.attackCD = 1.2 + RNG() * 1.5; return; } }
    const w = r.weapons.throw;
    if (w && RNG() < aggr * 0.35) {
      for (const o of this.race.riders) { if (o === r || o.eliminated || o.crashed) continue; const dd = o.dist - r.dist;
        if (w.kind === 'bottle' && dd > 6 && dd < 15 && Math.abs(o.d - r.d) < 1.3) { this.throwItem(r); r.ai.attackCD = 2; return; }
        if (w.kind === 'gutka' && Math.abs(dd) < 3.4 && Math.abs(o.d - r.d) < 1.2) { this.throwItem(r); r.ai.attackCD = 2; return; } }
    }
  }
  // ── per-frame ──
  update(dt, raceT) {
    const R = this.race, T = R.track;
    for (const r of R.riders) if (r.attack) this.updateAttack(r, dt);
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.t += dt; p.dist += p.vAlong * dt; p.d += p.vd * dt; p.vh -= G * dt; p.h += p.vh * dt; p.spin += dt * 14;
      const s = ((p.dist % T.L) + T.L) % T.L; const gy = T.yAt(s);
      let hitR = null; for (const o of R.riders) { if (o === p.owner || o.eliminated || o.crashed || o.invuln) continue; if (Math.abs(o.dist - p.dist) < 1.0 && Math.abs(o.d - p.d) < 0.65 && p.h - o.y > 0.3 && p.h - o.y < 2.0) { hitR = o; break; } }
      if (hitR) { this.smash(p, hitR); this.hit(hitR, p.owner, 'bottle', Math.sign(hitR.d - p.d) || 1); this.projectiles.splice(i, 1); continue; }
      if (p.h <= gy + 0.05 || p.t > 2) { this.smash(p, null); this.glass.push({ dist: p.dist, s, d: clamp(p.d, -T.wAt(s) / 2 + 0.5, T.wAt(s) / 2 - 0.5), t: 20, hitBy: new Set(), mesh: this.glassDecal(s, p.d) }); this.projectiles.splice(i, 1); }
    }
    this.bottleMeshes.forEach((m, i) => { const p = this.projectiles[i]; m.visible = !!p; if (p) { const s = ((p.dist % T.L) + T.L) % T.L; T.pos(s, p.d, m.position, p.h - T.yAt(s)); m.rotation.set(p.spin, 0, p.spin * 0.3); } });
    // glass patches
    for (let i = this.glass.length - 1; i >= 0; i--) {
      const gp = this.glass[i]; gp.t -= dt; if (gp.t <= 0) { this.group.remove(gp.mesh); gp.mesh.geometry.dispose(); this.glass.splice(i, 1); continue; }
      for (const r of R.riders) { if (r.crashed || r.air || gp.hitBy.has(r)) continue; let ds = r.s - gp.s; if (ds > T.L / 2) ds -= T.L; if (ds < -T.L / 2) ds += T.L; if (Math.abs(ds) < 1.6 && Math.abs(r.d - gp.d) < 1.1) { gp.hitBy.add(r); r.gripT = 3; r.addWobble(10); if (r.isPlayer) { R.hud.callout('GLASS!', null, 'bad'); AUDIO.glass(0.5); } } }
    }
    // pickups
    for (const pk of this.pickups) {
      if (!pk.active) { pk.t -= dt; if (pk.t <= 0 && !pk.dropped) pk.active = true; continue; }
      for (const r of R.riders) {
        if (r.crashed || r.eliminated) continue; let ds = r.s - pk.s; if (ds > T.L / 2) ds -= T.L; if (ds < -T.L / 2) ds += T.L;
        if (Math.abs(ds) < 1.3 && Math.abs(r.d - pk.d) < 1.1) { this.collect(r, pk); break; }
      }
    }
    this.pickups = this.pickups.filter(pk => !(pk.dropped && !pk.active));
    const cnt = {}; for (const k in this.pickClouds) cnt[k] = 0;
    for (const pk of this.pickups) { if (!pk.active) continue; const c = this.pickClouds[pk.type]; const i = cnt[pk.type]++; if (i >= 40) continue; T.pos(pk.s, pk.d, this._v, 1.0 + Math.sin(raceT * 3 + pk.s) * 0.15); c.g.attributes.position.setXYZ(i, this._v.x, this._v.y, this._v.z); }
    for (const k in this.pickClouds) { const c = this.pickClouds[k]; c.g.setDrawRange(0, cnt[k]); c.g.attributes.position.needsUpdate = true; c.pts.visible = cnt[k] > 0 && (k === 'oil' || R.combatOn); }
    this.smoke.update(dt); this.stars.update(dt); this.sparks.update(dt); this.mud.update(dt); this.spray.update(dt);
  }
  collect(r, pk) {
    const R = this.race;
    if (pk.type === 'oil') { r.boost = Math.min(100, r.boost + 35 * r.st.boostFill); if (r.isPlayer) { R.hud.callout('2T OIL', '+KICK', 'oil'); AUDIO.pickup(); } }
    else { if (!R.combatOn) return;
      const W = WEAPONS[pk.type];
      if (W.slot === 'throw') r.weapons.throw = { kind: pk.type, uses: W.uses }; else r.weapons.melee = { kind: pk.type, uses: W.uses };
      r.rig.showWeapon(r.weapons.melee ? r.weapons.melee.kind : r.weapons.throw && r.weapons.throw.kind === 'bottle' ? 'bottle' : null);
      if (r.isPlayer) { const label = { chain: 'CHAIN', belt: 'BELT', bottle: 'BEER BOTTLE', gutka: 'GUTKA' }[pk.type]; R.hud.callout(label + ' MILA!', pk.dropped ? `+${R.award('weaponSnatch', PTS.weaponSnatch)}` : null, 'pick'); AUDIO.pickup(); }
    }
    pk.active = false; pk.t = pk.type === 'oil' ? 6 : 10;
  }
  dropWeapons(r) { const T = this.race.track; for (const slot of ['melee', 'throw']) { const w = r.weapons[slot]; if (w && w.uses > 0) this.pickups.push({ s: r.s, d: clamp(r.d + (slot === 'melee' ? 0.6 : -0.6), -T.wAt(r.s) / 2 + 0.6, T.wAt(r.s) / 2 - 0.6), type: w.kind, active: true, t: 0, dropped: true }); r.weapons[slot] = null; } r.rig.showWeapon(null); }
  smash(p, who) { const T = this.race.track; const s = ((p.dist % T.L) + T.L) % T.L; const q = T.pos(s, p.d, this._v, p.h - T.yAt(s)); for (let i = 0; i < 18; i++) this.sparks.emit(q.x, q.y, q.z, (Math.random() - 0.5) * 7, Math.random() * 4, (Math.random() - 0.5) * 7, 0.6, 0.15, 0.05, C_GLASS, 1, 1, 9); AUDIO.glass(who && who.isPlayer ? 1 : this.race.distToPlayer(who || { dist: p.dist, d: p.d })); }
  glassDecal(s, d) { const T = this.race.track; const g = new THREE.PlaneGeometry(2.2, 2.2); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, this.glassMat); T.pos(s, d, m.position, 0.03); m.rotation.y = T.yawAt(s); this.group.add(m); return m; }
  exhaust(r, dt, camPos) {
    const T = this.race.track; const yaw = T.yawAt(r.s) + r.psi; const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    const base = T.pos(r.s, r.d, this._v, r.y - T.yAt(r.s));
    const ex = base.x - fx * 1.0 - lx * 0.17, ey = base.y + 0.42, ez = base.z - fz * 1.0 - lz * 0.17;
    const rate = (r.boosting ? 60 : r.input.throttle > 0.5 ? 14 : 5) * (r.isPlayer ? 1 : 0.5);
    r._smokeAcc = (r._smokeAcc || 0) + rate * dt;
    while (r._smokeAcc > 1) { r._smokeAcc--; this.smoke.emit(ex, ey, ez, -fx * 2 + (Math.random() - 0.5), 0.6 + Math.random() * 0.5, -fz * 2 + (Math.random() - 0.5), r.boosting ? 1.2 : 0.9, r.boosting ? 0.5 : 0.3, r.boosting ? 2.8 : 1.6, C_SMOKE, r.boosting ? 0.55 : 0.32, 1.2, -0.3); if (r.boosting && Math.random() < 0.5) this.sparks.emit(ex, ey, ez, -fx * 6, 0.3, -fz * 6, 0.18, 0.35, 0.1, C_FIRE, 1, 2, 0); }
    if ((r.sliding || r.stoppie) && r.v > 5) { const tx = base.x - fx * 0.64, tz = base.z - fz * 0.64; for (let i = 0; i < 2; i++) this.smoke.emit(tx + (Math.random() - 0.5) * 0.4, base.y + 0.1, tz + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 2, 0.8, (Math.random() - 0.5) * 2, 1.3, 0.6, 3.2, C_DUST, 0.45, 1.5, -0.2); }
    if (r.surf === 1 && r.v > 5 && Math.random() < (r.isPlayer ? 0.9 : 0.5)) for (let i = 0; i < 2; i++) this.mud.emit(base.x - fx * 0.7 + (Math.random() - 0.5) * 0.3, base.y + 0.15, base.z - fz * 0.7 + (Math.random() - 0.5) * 0.3, -fx * r.v * 0.18 + (Math.random() - 0.5) * 2.5, 1.5 + Math.random() * 2.5, -fz * r.v * 0.18 + (Math.random() - 0.5) * 2.5, 0.7, 0.12, 0.2, this.race.wet ? C_MUDW : C_MUD, 1, 0.6, 9);
    if (r.surf === 2 && r.v > 5 && Math.random() < 0.5) this.smoke.emit(base.x - fx * 0.7, base.y + 0.15, base.z - fz * 0.7, -fx * 2 + (Math.random() - 0.5) * 2, 0.7, -fz * 2 + (Math.random() - 0.5) * 2, 1.2, 0.5, 2.6, this.race.wet ? C_MUDW : C_DUST, 0.35, 1.4, -0.1);
    if (this.race.wet && r.isPlayer) for (let i = 0; i < 3; i++) { const sd = (Math.random() - 0.3) * 18, dd = (Math.random() - 0.5) * T.wAt(r.s) * 0.9; const q = T.pos(r.s + sd, dd, this._w2 || (this._w2 = new THREE.Vector3()), 0.03);
      this.smoke.emit(q.x, q.y, q.z, 0, 1.0 + Math.random(), 0, 0.22, 0.06, 0.3, C_WATER, 0.55, 2, 7); }
    if (this.race.wet && r.v > 5 && !r.air) this.tyreSpray(r, dt, base, fx, fz, lx, lz);
    if (r.scrapeT > 0) { r.scrapeT -= dt; const q = T.pos(r.s, r.d + Math.sign(r.d) * 0.32, this._w3 || (this._w3 = new THREE.Vector3()), r.y - T.yAt(r.s) + 0.25);
      for (let i = 0; i < 2; i++) this.sparks.emit(q.x, q.y, q.z, fx * r.v * 0.55 + (Math.random() - 0.5) * 2, 0.5 + Math.random() * 2, fz * r.v * 0.55 + (Math.random() - 0.5) * 2, 0.22, 0.12, 0.04, C_FIRE, 1, 1.5, 9); }
  }
  // wet tarmac: the rear tyre throws a rooster tail up and back, the front sheets water out to both sides, and a fine mist hangs behind
  tyreSpray(r, dt, base, fx, fz, lx, lz) {
    const P = this.race.player; if (!r.isPlayer && Math.abs(r.dist - P.dist) > 48) return;
    const vn = clamp(r.v / 26, 0, 1.4), rate = (r.isPlayer ? 1 : 0.85) * vn; const fw = r.v * 0.68;   // water leaves the tyre backwards at about a third of road speed
    r._sprA = (r._sprA || 0) + rate * 110 * dt;
    while (r._sprA > 1) { r._sprA--; const sp = (Math.random() - 0.5) * 1.4, up = (1.3 + Math.random() * 2.0) * Math.min(1.2, vn + 0.25), j = Math.random() * 0.25;
      this.spray.emit(base.x - fx * (0.62 + j) + lx * sp * 0.05, base.y + 0.12 + j * 0.6, base.z - fz * (0.62 + j) + lz * sp * 0.05, fx * fw + lx * sp, up, fz * fw + lz * sp, 0.34 + Math.random() * 0.18, 0.45, 1.6 + Math.random() * 0.6, this.sprayCol, 0.68, 1.0, 9); }
    r._sprB = (r._sprB || 0) + rate * 60 * dt;
    while (r._sprB > 1) { r._sprB--; const sd = Math.random() < 0.5 ? 1 : -1, out = 1.4 + Math.random() * 1.6;
      this.spray.emit(base.x + fx * 0.6 + lx * sd * 0.1, base.y + 0.07, base.z + fz * 0.6 + lz * sd * 0.1, fx * r.v * 0.85 + lx * sd * out, 0.7 + Math.random() * 1.0, fz * r.v * 0.85 + lz * sd * out, 0.28 + Math.random() * 0.12, 0.32, 1.0, this.sprayCol, 0.5, 1.2, 9); }
    r._sprC = (r._sprC || 0) + rate * 18 * dt;
    while (r._sprC > 1) { r._sprC--;
      this.spray.emit(base.x - fx * 1.0, base.y + 0.4, base.z - fz * 1.0, fx * r.v * 0.7 + (Math.random() - 0.5), 0.4 + Math.random() * 0.5, fz * r.v * 0.7 + (Math.random() - 0.5), 0.7 + Math.random() * 0.4, 1.4, 4.2, this.mistCol, 0.2, 1.4, 0.5); }
  }
  // scraping a wall or kerb: a burst of sparks on that side
  wallSparks(r, into) {
    const T = this.race.track; if (!r.isPlayer && this.race.distToPlayer(r) < 0.1) return;
    const yaw = T.yawAt(r.s) + r.psi, fx = Math.sin(yaw), fz = Math.cos(yaw); const q = T.pos(r.s, r.d + Math.sign(r.d) * 0.34, this._w3 || (this._w3 = new THREE.Vector3()), r.y - T.yAt(r.s) + 0.3);
    const n = Math.round(6 + into * 40); for (let i = 0; i < n; i++) this.sparks.emit(q.x, q.y, q.z, fx * r.v * 0.6 + (Math.random() - 0.5) * 3, 0.8 + Math.random() * 3, fz * r.v * 0.6 + (Math.random() - 0.5) * 3, 0.3 + Math.random() * 0.2, 0.14, 0.04, C_FIRE, 1, 1.2, 9);
    if (r.isPlayer) AUDIO.scrape && AUDIO.scrape(clamp(0.3 + into * 2, 0.3, 1));
  }
  splash(r, amt, wet) { // pothole: water (monsoon) or grit thrown up around the front wheel
    const T = this.race.track; const yaw = T.yawAt(r.s) + r.psi; const fx = Math.sin(yaw), fz = Math.cos(yaw); const b = T.pos(r.s, r.d, this._v, r.y - T.yAt(r.s));
    const n = Math.round((wet ? 22 : 10) * amt); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 3.5 * amt;
      (wet ? this.smoke : this.mud).emit(b.x + fx * 0.5, b.y + 0.1, b.z + fz * 0.5, Math.cos(a) * sp + fx * r.v * 0.15, 2 + Math.random() * 3 * amt, Math.sin(a) * sp + fz * r.v * 0.15, wet ? 0.6 : 0.5, wet ? 0.25 : 0.1, wet ? 0.6 : 0.16, wet ? C_WATER : C_GRIT, wet ? 0.7 : 1, 0.8, 9); }
  }
  reset() { this.projectiles.length = 0; this.glass.forEach(g => { this.group.remove(g.mesh); g.mesh.geometry.dispose(); }); this.glass.length = 0; this.smoke.clear(); this.stars.clear(); this.sparks.clear(); this.mud.clear(); this.spray.clear(); }
  dispose() { this.reset(); this.mud.dispose(); this.spray.dispose(); this.smoke.dispose(); this.stars.dispose(); this.sparks.dispose(); for (const k in this.pickClouds) { this.pickClouds[k].g.dispose(); this.pickClouds[k].m.dispose(); } this.glassMat.dispose(); }
}
