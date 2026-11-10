// ───────────────────────── WILDLIFE ON THE TRAIL (off-road stages) ─────────────────────────
// Yaks and goats graze beside the trail and walk across it as you come down; eagles drop out of the sky across your line.
// All of them can be ridden round (the eagle gives you its shadow as a warning); hit one and you are off the bike.
const WILD = {};
function wildParts(kind) {
  if (WILD[kind]) return WILD[kind]; const b = new Batch(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  const bx = (x, y, z, sx, sy, sz, c, rx = 0) => { Q.setFromEuler(E.set(rx, 0, 0)); M.compose(new THREE.Vector3(x, y, z), Q, new THREE.Vector3(sx, sy, sz)); b.add(UNIT_BOX, M, new THREE.Color(c)); };
  let leg, wing = null;
  if (kind === 'yak') { bx(0, 1.12, 0, 0.95, 0.85, 2.0, '#6a4630'); bx(0, 0.72, 0, 1.05, 0.5, 1.9, '#4a2f20'); bx(0, 1.62, 0.45, 0.7, 0.34, 0.8, '#7a5238'); bx(0, 1.12, 1.22, 0.5, 0.6, 0.6, '#3b2619', 0.25); bx(0, 0.92, 1.5, 0.3, 0.26, 0.24, '#e6d6bc'); bx(0, 1.5, 0, 0.5, 0.1, 1.2, '#c8321e'); bx(0, 1.2, 0, 1.0, 0.5, 0.5, '#e8b62a');   // (a red and yellow saddle cloth)
    for (const sx of [-1, 1]) { bx(sx * 0.34, 1.48, 1.2, 0.36, 0.08, 0.08, '#e2d9c6'); bx(sx * 0.52, 1.6, 1.24, 0.08, 0.3, 0.08, '#e2d9c6'); } bx(0, 0.95, -1.08, 0.12, 0.7, 0.12, '#1f1611');
    leg = [new THREE.BoxGeometry(0.24, 0.72, 0.24).translate(0, -0.36, 0), [[-0.32, 0.7, 0.72], [0.32, 0.7, 0.72], [-0.32, 0.7, -0.72], [0.32, 0.7, -0.72]], '#241913']; }
  else if (kind === 'goat') { bx(0, 0.66, 0, 0.36, 0.4, 0.86, '#e9e3d6'); bx(0, 0.92, 0.5, 0.2, 0.3, 0.22, '#e9e3d6', 0.5); bx(0, 1.06, 0.66, 0.2, 0.2, 0.34, '#dcd3c2'); bx(0, 0.94, 0.78, 0.07, 0.16, 0.05, '#cfc5b2');
    for (const sx of [-1, 1]) bx(sx * 0.07, 1.24, 0.58, 0.04, 0.22, 0.04, '#6a5a48', -0.5); bx(0, 0.8, -0.46, 0.07, 0.12, 0.07, '#dcd3c2');
    leg = [new THREE.BoxGeometry(0.09, 0.46, 0.09).translate(0, -0.23, 0), [[-0.12, 0.46, 0.3], [0.12, 0.46, 0.3], [-0.12, 0.46, -0.3], [0.12, 0.46, -0.3]], '#cfc5b2']; }
  else { bx(0, 0, 0, 0.26, 0.2, 0.74, '#4a3524'); bx(0, 0.05, 0.44, 0.17, 0.17, 0.2, '#efe6d2'); bx(0, 0, 0.58, 0.07, 0.07, 0.12, '#e8b62a'); bx(0, 0.02, -0.5, 0.34, 0.03, 0.34, '#3b2a1c');
    for (const sx of [-1, 1]) bx(sx * 0.07, -0.14, -0.05, 0.05, 0.12, 0.05, '#e8b62a');
    const wb = new Batch(); for (const [x0, len, dep, c] of [[0, 0.75, 0.52, '#4a3524'], [0.72, 0.62, 0.42, '#3b2a1c'], [1.3, 0.32, 0.26, '#2c1f15']]) { M.compose(new THREE.Vector3(x0 + len / 2, 0, -0.04), Q.identity(), new THREE.Vector3(len, 0.035, dep)); wb.add(UNIT_BOX, M, new THREE.Color(c)); } wing = wb.build(); leg = null; }
  return WILD[kind] = { body: b.build(), leg, wing };
}
let WILD_MAT = null, WILD_SHADOW = null, WILD_WARN = null;
const WILD_SIZE = { yak: 1.4, goat: 1.55, eagle: 1.7 };   // a little larger than life: they have to read from 80 m at speed
function wildWarnTex() {
  if (WILD_WARN) return WILD_WARN; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.beginPath(); x.moveTo(64, 8); x.lineTo(122, 112); x.lineTo(6, 112); x.closePath(); x.fillStyle = '#ffd23f'; x.fill(); x.lineWidth = 10; x.lineJoin = 'round'; x.strokeStyle = '#160a12'; x.stroke();
  x.fillStyle = '#160a12'; x.fillRect(57, 40, 14, 40); x.beginPath(); x.arc(64, 95, 8, 0, 7); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return WILD_WARN = t;
}
const WILD_DEF = { yak: { speed: 2.5, trig: 78, hs: 0.75, hd: 1.3, tall: 1.5, say: 'YAK! SIDE SE NIKAL!' }, goat: { speed: 5.2, trig: 62, hs: 0.5, hd: 0.6, tall: 0.9, say: 'BAKRI!' }, eagle: { say: 'CHEEL! JHUK KE NIKAL!' } };
class HillLife {
  constructor(race) {
    this.race = race; this.list = []; this.t = 0; const T = race.track, rng = mulberry32(2718); WILD_MAT = WILD_MAT || new THREE.MeshLambertMaterial({ vertexColors: true }); WILD_SHADOW = WILD_SHADOW || new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
    this.shG = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2); this.group = new THREE.Group(); race.group.add(this.group);
    for (let s = 300, k = 0; s < T.finS - 140; s += 230 + rng() * 150, k++) {
      const lip = T.bumps.find(b => b.type === 'ramp' && s > b.s - 25 && s < b.s + b.len + 55); if (lip) s = lip.s + lip.len + 60;   // never where you land
      const zone = T.hillZone(s), side = rng() < 0.5 ? -1 : 1, kind = k % 3 === 0 ? 'eagle' : zone === 'snow' || (zone === 'alpine' && k % 2) ? 'yak' : 'goat';
      if (kind === 'goat') for (let i = 0; i < 3; i++) this.add('goat', s + i * 2.6, side, i * 0.35 + rng() * 0.2); else this.add(kind, s, side, 0);
    }
  }
  add(kind, s, side, delay) {
    const P = wildParts(kind), T = this.race.track, g = new THREE.Group(), body = new THREE.Mesh(P.body, WILD_MAT); body.castShadow = kind !== 'eagle'; g.add(body); { const o = new THREE.Mesh(P.body, outlineMat()); g.add(o); } g.scale.setScalar(WILD_SIZE[kind]); const c = { kind, s, side, delay, g, state: 0, t: 0, d: side * (T.wAt(s) / 2 + 3.2 + Math.random() * 2), legs: [], wings: [], ph: Math.random() * 6 };
    if (P.leg) { const lm = this.legMat = this.legMat || new THREE.MeshLambertMaterial({ color: '#ffffff' }); for (const [x, y, z] of P.leg[1]) { const m = new THREE.Mesh(P.leg[0], lm); m.position.set(x, y, z); m.userData.c = P.leg[2]; g.add(m); c.legs.push(m); } if (!this.legCols) this.legCols = {}; }
    if (P.wing) { for (const sx of [-1, 1]) { const piv = new THREE.Group(), w = new THREE.Mesh(P.wing, WILD_MAT); w.scale.x = sx; piv.position.set(sx * 0.12, 0.06, 0.05); piv.add(w); g.add(piv); c.wings.push(piv); }
      c.sh = new THREE.Mesh(this.shG, WILD_SHADOW); c.sh.renderOrder = 2; this.group.add(c.sh); c.d = side * 13; }
    for (const l of c.legs) l.material = (this.legMats = this.legMats || {})[l.userData.c] = this.legMats[l.userData.c] || new THREE.MeshLambertMaterial({ color: l.userData.c });
    c.warn = new THREE.Sprite(this.warnMat = this.warnMat || new THREE.SpriteMaterial({ map: wildWarnTex(), depthTest: false, transparent: true })); c.warn.renderOrder = 5; c.warn.visible = false; this.group.add(c.warn);
    this.group.add(g); this.list.push(c);
  }
  update(dt) {
    const R = this.race, T = R.track, P = R.player, W = R.game.world, v3 = this._v || (this._v = new THREE.Vector3()); this.t += dt;
    for (const c of this.list) {
      const ds = c.s - P.dist, on = ds < 380 && ds > -60; c.g.visible = on; if (c.sh) c.sh.visible = on && c.state === 1; c.warn.visible = on && c.state === 1 && ds > 2; if (!on) continue;
      const D = WILD_DEF[c.kind], w = T.wAt(c.s) / 2, yaw = T.yawAt(c.s), racing = R.state === 'racing';
      if (c.kind === 'eagle') {
        // circling high until you are a second and a half away, then one pass across your line at handlebar height
        if (c.state === 0 && racing && ds > 0 && ds / Math.max(P.v, 12) < 1.5 + c.delay) { c.state = 1; c.t = 0; c.aim = clamp(P.d, -w + 0.6, w - 0.6); R.hud.callout(D.say, null, 'bad'); AUDIO.warn(); }
        let alt, yawE;
        if (c.state === 1) { c.t += dt; const u = c.t / 3; c.d = c.aim + c.side * (1 - 2 * u) * 13; alt = 1.2 + 9 * (2 * u - 1) * (2 * u - 1); yawE = yaw - c.side * Math.PI / 2; if (u >= 1) c.state = 2; }
        else { const a = this.t * 0.7 + c.ph; c.d = (c.state === 2 ? -c.side : c.side) * 13 + Math.cos(a) * 5; alt = 11 + Math.sin(a * 0.5) * 1.5; yawE = yaw + a; c.sOff = Math.sin(a) * 5; }
        T.pos(c.s + (c.state === 1 ? 0 : c.sOff || 0), c.d, v3, 0); const gy = Math.abs(c.d) < w + 2 ? v3.y : W.hillH(v3.x, v3.z); c.alt = alt; c.g.position.set(v3.x, gy + alt, v3.z); c.g.rotation.set(c.state === 1 ? 0.25 * Math.sign(0.5 - c.t / 3) : 0, yawE, 0, 'YXZ');
        const fl = c.state === 1 ? Math.sin(this.t * 13 + c.ph) * 0.22 - 0.1 : Math.sin(this.t * 5 + c.ph) * 0.5; c.wings[0].rotation.z = fl; c.wings[1].rotation.z = -fl;
        if (c.warn.visible) { T.pos(c.s, c.aim, v3, 3.1 + Math.sin(this.t * 9) * 0.15); c.warn.position.copy(v3); c.warn.scale.setScalar(clamp(ds * 0.085, 1.5, 6)); T.pos(c.s, c.d, v3, 0); }
        if (c.sh.visible) { c.sh.position.set(v3.x, gy + 0.05, v3.z); const k = clamp(1.4 - alt * 0.1, 0.4, 1.3); c.sh.scale.set(k * 1.3, 1, k * 0.6); c.sh.rotation.y = yawE; }
      } else {
        // grazing beside the trail; when you come it walks across (goats one after another, at a trot)
        if (c.state === 0 && racing && ds > 0 && ds < D.trig + c.delay * 30) { c.state = 1; c.t = -c.delay; if (!c.delay) { R.hud.callout(D.say, null, 'bad'); AUDIO.warn(); } }
        if (c.state === 1) { c.t += dt; if (c.t > 0) { c.d -= c.side * D.speed * dt; if (c.side * c.d < -(w + 4.5)) c.state = 2; } }
        const walk = c.state === 1 && c.t > 0; T.pos(c.s, c.d, v3, 0); const gy = Math.abs(c.d) < w + 1.9 ? v3.y : W.hillH(v3.x, v3.z) + 0.2; c.gy = smooth(c.gy === undefined ? gy : c.gy, gy, 9, dt);
        c.g.position.set(v3.x, c.gy, v3.z); c.g.rotation.set(walk ? 0 : Math.max(0, Math.sin(this.t * 0.6 + c.ph)) * 0.12, yaw - c.side * Math.PI / 2 + (walk ? 0 : Math.sin(c.ph) * 0.8), 0, 'YXZ');
        if (c.warn.visible) { c.warn.position.set(v3.x, c.gy + (c.kind === 'yak' ? 3.6 : 2.3) + Math.sin(this.t * 9) * 0.12, v3.z); c.warn.scale.setScalar(clamp(ds * 0.085, 1.4, 6)); }
        const sw = walk ? Math.sin(this.t * (c.kind === 'yak' ? 7 : 14) + c.ph) * 0.55 : 0; c.legs[0].rotation.x = sw; c.legs[3].rotation.x = sw; c.legs[1].rotation.x = -sw; c.legs[2].rotation.x = -sw;
      }
      if (!racing || c.state !== 1) continue;
      // anything that rides into it goes down
      for (const r of R.riders) { if (r.crashed || r.finished || r.invuln > 0 || Math.abs(r.dist - c.s) > 3) continue; const dsr = Math.abs(r.dist - c.s), ddr = Math.abs(r.d - c.d), up = r.y - T.gy(r.s, r.d);
        const hit = c.kind === 'eagle' ? (dsr < 1.4 && ddr < 1.15 && c.alt < up + 2.3 && c.alt > up - 0.3) : (c.t > 0 && dsr < D.hs * 1.3 + 0.5 && ddr < D.hd * 1.35 && up < D.tall * 1.4);
        if (hit) { r.crash('hit'); if (r.isPlayer) { R.hud.callout(c.kind === 'yak' ? 'YAK SE TAKKAR!' : c.kind === 'goat' ? 'BAKRI SE TAKKAR!' : 'CHEEL NE GIRA DIYA!', null, 'bad'); R.game.comicPop('DHAAD!', r, 1.2, '#ff8a1f'); AUDIO.crash(0.5); R.game.shake(0.6); } c.hitP = c.hitP || r.isPlayer; }
        else if (r.isPlayer && !c.hitP && !c.missed && r.dist > c.s + 1 && ddr < (c.kind === 'yak' ? 3 : 2.4)) { c.missed = true; R.hud.callout('BAAL BAAL BACHE!', `+${R.award('nearMiss', 60)}`, 'good'); } }
    }
  }
  dispose() { this.group.removeFromParent(); this.shG.dispose(); if (this.warnMat) this.warnMat.dispose(); for (const k in this.legMats || {}) this.legMats[k].dispose(); }
}
