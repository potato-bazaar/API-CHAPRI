// ───────────────────────── POLICE VAN CHASE (ghat stage) ─────────────────────────
// Most Wanted on a hill road: one police van after the pack for the whole run. It waits by the start, pulls out behind you and
// follows a little slower than you ride. Every so often (and whenever you crash or dawdle) it makes a run: up alongside, then
// a swipe across the road you can dodge. Stay near it too long, or stay down, and the BUSTED meter fills: you finish last.
// It also flattens any rival it catches.
let VAN_GEO = null, VAN_TEX = null;
function policeVanGeo() {
  if (VAN_GEO) return VAN_GEO; const b = new Batch(), M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  const bx = (x, y, z, sx, sy, sz, c, rx = 0) => { Q.setFromEuler(new THREE.Euler(rx, 0, 0)); M.compose(new THREE.Vector3(x, y, z), Q, new THREE.Vector3(sx, sy, sz)); b.add(UNIT_BOX, M, new THREE.Color(c)); };
  const W = '#f1f0ec', BL = '#1d3f8f', DK = '#12151c', ST = '#8a8f98';
  bx(0, 0.98, 0, 1.92, 0.86, 4.6, W); bx(0, 0.78, 0, 1.94, 0.2, 4.62, BL); bx(0, 1.26, 0, 1.94, 0.1, 4.62, '#c8321e');   // body, blue skirt, red waist line
  bx(0, 1.82, -0.5, 1.84, 0.84, 3.3, W); bx(0, 2.26, -0.5, 1.9, 0.07, 3.4, '#dcdad4');                                       // cabin, roof
  bx(0, 1.8, 1.16, 1.66, 0.62, 0.05, DK, -0.2); bx(0, 1.82, -2.16, 1.5, 0.5, 0.04, DK);                                      // windscreen, rear glass
  for (const sx of [-1, 1]) { bx(sx * 0.93, 1.84, 0.5, 0.03, 0.5, 0.9, DK); bx(sx * 0.93, 1.84, -1.1, 0.03, 0.46, 1.7, DK);
    for (let i = 0; i < 5; i++) bx(sx * 0.95, 1.84, -1.8 + i * 0.35, 0.02, 0.48, 0.03, ST);                                 // the grille over the lock-up's windows
    bx(sx * 0.66, 1.12, 2.31, 0.34, 0.2, 0.05, '#fff6d8'); bx(sx * 0.78, 0.98, -2.31, 0.2, 0.3, 0.04, '#d8261c');             // head and tail lamps
    bx(sx * 1.02, 1.62, 1.0, 0.16, 0.2, 0.08, DK); }                                                                        // mirrors
  bx(0, 1.02, 2.3, 1.0, 0.36, 0.04, DK); bx(0, 0.56, 2.38, 2.0, 0.22, 0.16, DK); bx(0, 0.56, -2.38, 2.0, 0.2, 0.14, DK);     // grille, bumpers
  for (const sx of [-0.55, 0, 0.55]) bx(sx, 0.95, 2.5, 0.06, 0.8, 0.06, ST); for (const y of [0.7, 1.05, 1.34]) bx(0, y, 2.5, 1.5, 0.06, 0.06, ST);   // bull bar
  bx(0, 2.36, 0.35, 1.3, 0.14, 0.3, '#22252c'); bx(0, 2.34, -1.2, 1.5, 0.05, 1.6, ST); bx(0.8, 2.7, -1.9, 0.02, 0.8, 0.02, DK);   // light bar base, roof rack, aerial
  for (const sx of [-1, 1]) for (const z of [1.5, -1.45]) bx(sx * 0.96, 0.62, z, 0.08, 0.5, 1.1, '#2a2d34');                  // arches
  return VAN_GEO = b.build();
}
function policeVanTex() {
  if (VAN_TEX) return VAN_TEX; const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f1f0ec'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = '#1d3f8f'; x.font = '900 44px Teko, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLICE', 96, 34); x.font = '700 26px "Baloo 2", sans-serif'; x.fillStyle = '#c8321e'; x.fillText('पुलिस', 208, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return VAN_TEX = t;
}
const VAN_LINES = ['RUK JA! GAADI SIDE MEIN!', 'CHALLAN KATEGA!', 'BHAAGNE KA NAHI!', 'LICENCE DIKHA!', 'AGLE MOD PE PAKDUNGA!'];
class ChaseOps {
  constructor(race) {
    this.race = race; this.heat = 0; this.busted = false; this.copDist = Infinity; this.dist = 38; this.d = 0; this.v = 0; this.on = false; this.pAvg = 0; this.mode = 'follow'; this.atkT = 20; this.swipes = 0; this.swipeT = 0; this.swipeCD = 0; this.side = 0; this.sayT = 6; this.t = 0; this.bounce = 0; this.hits = new Map();
    this.heatMul = { easy: 0.65, normal: 1, hard: 1.3 }[race.diffKey] || 1;
    const g = this.g = new THREE.Group(), mat = this.mat = new THREE.MeshLambertMaterial({ vertexColors: true }); this.body = new THREE.Mesh(policeVanGeo(), mat); this.body.castShadow = true; g.add(this.body);
    const wm = this.wm = new THREE.MeshLambertMaterial({ color: '#17171a' }); this.wheels = [[-0.92, 1.5], [0.92, 1.5], [-0.92, -1.45], [0.92, -1.45]].map(([x, z]) => { const w = new THREE.Mesh(WHEEL_G, wm); w.scale.set(1.9, 2.1, 2.1); w.position.set(x, 0.46, z); g.add(w); return w; });
    const tm = this.tm = new THREE.MeshLambertMaterial({ map: policeVanTex() }), pg = this.pg = new THREE.PlaneGeometry(2.3, 0.5);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(pg, tm); p.position.set(sx * 0.975, 1.02, -0.4); p.rotation.y = sx * Math.PI / 2; g.add(p); }
    { const p = new THREE.Mesh(pg, tm); p.scale.set(0.62, 0.62, 1); p.position.set(0, 1.42, 2.02); p.rotation.x = -1.35; g.add(p); }
    this.lampG = new THREE.BoxGeometry(0.42, 0.2, 0.26); this.lamps = [['#ff1e2e', -0.36], ['#2a58ff', 0.36]].map(([c, x]) => { const m = new THREE.Mesh(this.lampG, new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, 2.53, 0.35); g.add(m); return m; });
    this.glows = [['#ff1e2e', -0.36], ['#2a58ff', 0.36]].map(([c, x]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set(x, 2.6, 0.35); s.scale.setScalar(3.2); g.add(s); return s; });
    this.beams = [-0.66, 0.66].map(x => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: '#fff2c8', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); s.position.set(x, 1.12, 2.4); s.scale.setScalar(1.6); g.add(s); return s; });
    race.group.add(g); this._p = new THREE.Vector3();
  }
  addHeat(v) { if (!this.busted) this.heat = clamp(this.heat + v, 0, 100); }
  update(dt) {
    const R = this.race, T = R.track, P = R.player; this.t += dt; this.swipeCD -= dt;
    // it waits on the shoulder past the start line with its lights going; the pack rides past and it pulls out behind
    if (!this.on) { const w0 = T.wAt(this.dist) / 2; this.d = -(w0 + 0.7); if (R.state === 'racing' && P.dist > this.dist + 9) { this.on = true; this.v = 6; this.atkT = 16 + Math.random() * 8; R.hud.callout('POLICE VAN PEECHE HAI!', null, 'bad'); AUDIO.warn(); } }
    const racing = R.state === 'racing' && !this.busted && this.on, gap = P.dist - this.dist; this.copDist = this.on ? Math.max(0, Math.abs(gap) - 2) : Infinity;
    const s = ((this.dist % T.L) + T.L) % T.L, half = T.wAt(s) / 2 - 1.25, cap = Math.min(34, T.vmaxAt(s) * 0.92 + 3), sep = Math.abs(P.d - this.d);
    if (this.on) {
      this.pAvg = smooth(this.pAvg, P.v, 0.4, dt); let want, dT = clamp(P.d * 0.5, -half, half);
      if (!racing) want = gap > 14 ? Math.min(12, cap) : 0;
      else if (P.crashed || P.v < 6) { want = gap > 9 ? Math.min(cap, 23) : gap > 5.5 ? 5 : 0; dT = clamp(P.d + (this.d > P.d ? 2.4 : -2.4), -half, half); }   // you are down: it rolls up beside you
      else if (this.mode === 'attack') {
        // the run: up the inside or the outside, level with you, then a swipe across. Two tries, then it drops back
        this.atkT += dt; if (!this.side) this.side = this.d >= P.d ? 1 : -1; if (Math.abs(clamp(P.d + this.side * 2.7, -half, half) - P.d) < 2.0) this.side = -this.side;
        dT = clamp(P.d + this.side * 2.7, -half, half); want = clamp(P.v + clamp((gap - 0.6) * 1.3, -4, 9), 0, 41);
        if (this.swipeT > 0) { this.swipeT -= dt; dT = P.d + this.side * 1.5;   // its flank comes right up to your bars, never through you
          if (sep < 1.8 && Math.abs(gap) < 2.9 && !P.air && P.invuln <= 0 && !this.swipeHit) { this.swipeHit = true; P.shoveV = -this.side * 4.2; P.addWobble(32 / P.st.wobbleRes); P.v *= 0.93; this.addHeat(16 * this.heatMul);
            R.hud.callout('VAN NE THOKA!', null, 'bad'); R.game.comicPop('DHADAAM!', P, 1.25, '#2a58ff'); AUDIO.crash(0.5); R.rumble(0.9, 0.25); R.game.shake(0.5); }
          if (this.swipeT <= 0) { if (!this.swipeHit) R.hud.callout('CHAKMA DE DIYA!', `+${R.award('dodges', 60)}`, 'good'); this.swipes++; this.swipeCD = 1.9; } }
        else if (Math.abs(gap) < 2.6 && sep > 2.2 && this.swipeCD <= 0) { this.swipeT = 0.75; this.swipeHit = false; AUDIO.warn(); }
        if ((this.swipes >= 2 && this.swipeT <= 0) || this.atkT > 13) { this.mode = 'back'; }
      } else if (this.mode === 'back') { want = Math.max(6, P.v - 8); if (gap > 42) { this.mode = 'follow'; this.atkT = (this.race.diffKey === 'hard' ? 20 : this.race.diffKey === 'easy' ? 40 : 28) + Math.random() * 14; } }
      else { // following: a shade under your pace on a rubber band, never out of earshot; every so often (or when you dawdle) it comes for you
        want = clamp(this.pAvg * 0.975 + (gap - 58) * 0.08, 8, cap); if (gap > 120) want = Math.max(want, Math.min(40, P.v + 5));
        this.atkT -= dt; if ((this.atkT <= 0 || gap < 17) && T.finS - P.dist > 260 && !P.air) { this.mode = 'attack'; this.atkT = 0; this.swipes = 0; this.swipeT = 0; this.side = 0; R.hud.callout('VAN AA RAHI HAI!', null, 'bad'); AUDIO.warn(); } }
      if (gap < 5 && sep < 1.95 && this.v > P.v - 0.5) want = Math.min(want, Math.max(0, P.v - 1));   // never drives through you
      this.v += clamp(want - this.v, -11 * dt, (this.mode === 'attack' ? 8 : 5.5) * dt); this.dist += this.v * dt;
      this.d += clamp(dT - this.d, -(this.swipeT > 0 ? 6.5 : 3.2) * dt, (this.swipeT > 0 ? 6.5 : 3.2) * dt);
    }
    if (racing) {
      // the BUSTED meter
      const hm = this.heatMul, near = Math.abs(gap) < 13;
      if (near && (P.crashed || P.v < 9)) this.addHeat((P.crashed ? 34 : 22) * hm * dt); else if (near) this.addHeat(3.5 * hm * dt); else if (gap > 40) this.addHeat(-(gap > 90 ? 9 : 6) * dt);
      if (this.heat > 68 && this.t - (this.warned || 0) > 3) { this.warned = this.t; R.hud.callout('PAKDA JAYEGA!', null, 'bad'); AUDIO.warn(); }
      if (this.heat >= 100 && !URLP.has('nobust')) { this.busted = true; P.v *= 0.3; R.hud.big('PAKDA GAYA!', 'Police van ne pakad liya', 3.2); R.game.comicPop('PAKDA!', P, 1.4, '#2a58ff'); AUDIO.crash(0.4); const last = R.riders.filter(r => !r.isCop).length; R.playerDone(last); P.eliminated = true; R.elimOrder.push(P); }   // caught: classified last
      this.sayT -= dt; if (this.sayT < 0 && gap < 70 && !P.crashed && this.mode === 'follow') { this.sayT = 13 + Math.random() * 9; R.hud.callout(VAN_LINES[Math.floor(Math.random() * VAN_LINES.length)], null, 'bad'); }
      if (gap > 150 && !this.lostShown) { this.lostShown = true; R.hud.callout('POLICE PEECHE CHHOOT GAYI!', `+${R.award('escapeGap', 100)}`, 'gold'); } else if (gap < 60) this.lostShown = false;
      // rivals in its way go flying
      for (const r of R.riders) { if (r.isPlayer || r.crashed || r.finished || r.eliminated || r.invuln > 0) continue; const ds = r.dist - this.dist; if (ds > -1.5 && ds < 3.6 && Math.abs(r.d - this.d) < 1.5 && this.v > r.v + 1 && this.t - (this.hits.get(r) || -9) > 6) { this.hits.set(r, this.t); r.crash('hit');
        if (R.distToPlayer(r) > 0.25) { AUDIO.crash(0.35 * R.distToPlayer(r)); R.hud.callout(`${(r.short || 'RIVAL').toUpperCase()} KO VAN NE UDAYA!`, null, 'good'); } } }
    }
    // place it on the road: pitch with the slope, roll with the steering, bounce on the rough
    const p = T.pos(s, this.d, this._p, 0), yaw = T.yawAt(s), sl = T.slopeAt(s), k = T.kAt(s); this.bounce = smooth(this.bounce, T.dirtAt(s) ? Math.sin(this.t * 17) * 0.05 * Math.min(1, this.v / 12) : 0, 10, dt);
    this.g.position.set(p.x, p.y + this.bounce, p.z); this.g.rotation.set(-Math.atan(sl), yaw, 0, 'YXZ'); this.body.rotation.z = clamp(-k * this.v * this.v * 0.012, -0.09, 0.09) + this.bounce * 0.6;
    for (const w of this.wheels) w.rotation.x += this.v * dt / 0.46;
    const ph = Math.floor(this.t * 6) % 2; this.lamps[0].visible = ph === 0; this.lamps[1].visible = ph === 1; this.glows[0].material.opacity = ph === 0 ? 0.95 : 0.08; this.glows[1].material.opacity = ph === 1 ? 0.95 : 0.08;
    this.g.visible = Math.abs(gap) < 320;
  }
  dispose() { this.g.removeFromParent(); this.mat.dispose(); this.wm.dispose(); this.tm.dispose(); this.pg.dispose(); this.lampG.dispose(); for (const l of this.lamps) l.material.dispose(); for (const s of this.glows.concat(this.beams)) s.material.dispose(); }
}
