// ───────────────────────── WINNER'S ENTRY: a mass-hero finish ─────────────────────────
// Win a race (or get away from the police) and the bike power-slides to a stop at the kerb in slow motion. The rider
// kills the engine, swings off like a film star, lights a cigarette behind a cupped hand, blows the smoke out and walks
// at the camera while the title slams in over the entry theme. Tap, click or press any key to skip to the results.
const _ev = Array.from({ length: 8 }, () => new THREE.Vector3());
const ENTRY_END = 9.2;
class HeroEntry {
  constructor(game, race, title) {
    this.g = game; this.R = race; this.title = title; const P = this.P = race.player, T = race.track, rig = this.rig = P.rig;
    this.t = 0; this.ts = 1; this.done = false; this.shot = -1;
    P.cinematic = true; Object.assign(P.input, { throttle: 0, brake: 0, rear: 0, boost: false, back: false }); P.boosting = false; P.wheelie = false; P.stoppie = false; P.pitch = 0; P.air = false; P.wobble = 0;
    rig.anim = null; rig.queued = null; if (rig.cig) rig.cig.visible = false;
    // the skid: carry on along the road, slide to the kerb on the side he's already on, end side-on with the bike's left
    // (the side-stand side, where he gets off) facing the pavement
    this.v0 = Math.max(P.v, 9); this.dist0 = P.dist; this.d0 = P.d; this.psi0 = P.psi; this.lean0 = P.lean;
    this.sg = P.d >= 0 ? 1 : -1; this.dEnd = this.sg * Math.max(0.6, T.wAt(P.s) / 2 - 1.15); this.D = clamp(this.v0 * 0.85, 9, 24);
    const sEnd = ((this.dist0 + this.D) % T.L + T.L) % T.L, yawR = T.yawAt(sEnd), a = T.pos(sEnd, this.dEnd, _ev[0]).clone(), b = T.pos(sEnd, this.dEnd + this.sg, _ev[1]).clone(), pave = b.sub(a).normalize();
    const leftOf = (psi) => Math.cos(yawR + psi) * pave.x - Math.sin(yawR + psi) * pave.z;   // body +x in the world, dotted with the pavement direction
    this.psiEnd = leftOf(1.25) > leftOf(-1.25) ? 1.25 : -1.25;
    // props: a brass lighter for the left hand
    const lg = this.lighter = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.04, 0.012), new THREE.MeshStandardMaterial({ color: '#d4a62a', metalness: 1, roughness: 0.25, envMap: BIKE_MODEL.env || null }));
    this.flame = new THREE.Group(); const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.035, 10, 1, true).translate(0, 0.0175, 0), new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })),
      f2 = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.018, 8, 1, true).translate(0, 0.009, 0), new THREE.MeshBasicMaterial({ color: '#fff4cc', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flame.add(f1, f2); this.flame.position.y = 0.022; lg.add(body, this.flame); lg.visible = false; rig.body.add(lg); this.disposables = [body.geometry, body.material, f1.geometry, f1.material, f2.geometry, f2.material];
    this.free = { pos: new THREE.Vector3(), yaw: 0, torsoX: 0.4, headX: 0, headY: 0, feet: { l: new THREE.Vector3(), r: new THREE.Vector3() }, hands: { l: new THREE.Vector3(), r: new THREE.Vector3() }, wind: 0 };
    // UI: letterbox, title, skip
    this.el = $('#entry'); this.el.hidden = false; this.el.classList.remove('go', 'out'); void this.el.offsetWidth; this.el.classList.add('on');
    $('#entryTitle').textContent = title; $('#entrySub').textContent = title === 'FIRST!' ? `PEHLA NUMBER · ${SAVE.name}` : `POLICE KO CHAKMA · ${SAVE.name}`;
    $('#hud').classList.remove('show'); this.g.fx.clear();
    this.skip = (e) => { if (this.t > 0.4) this.finish(); };
    setTimeout(() => { addEventListener('keydown', this.skip); addEventListener('pointerdown', this.skip); }, 50);
    MUSIC.setMode('entry'); AUDIO.squeal && AUDIO.squeal(1.2);
    this.g.comicPop('SKRRRRT!', P, 1.2, '#ffd23f');
  }
  // seated reference pose (bike-body space), read once the rig has posed at least once
  seat() {
    const rm = this.rig.rm, G = this.rig.fit.grip, F = RIDER_FIT;
    return { pos: _ev[2].set(rm.baseX, rm.baseY, rm.baseZ ?? rm.root.position.z), feetL: _ev[3].set(F.ankle[0], F.ankle[1], F.ankle[2]), feetR: _ev[4].set(-F.ankle[0], F.ankle[1], F.ankle[2]), gripL: _ev[5].set(G[0], G[1], G[2]), gripR: _ev[6].set(-G[0], G[1], G[2]) };
  }
  // the director: dt is real time; the world (and the story) run at this.ts
  update(dt) {
    if (this.done) return; const P = this.P, R = this.R, T = R.track, rig = this.rig; this.t += dt * this.ts; const t = this.t;
    // slow motion through the heart of the slide, and for the exhale
    this.ts = t < 0.25 ? lerp(1, 0.4, t / 0.25) : t < 1.35 ? 0.4 : t < 1.7 ? lerp(0.4, 1, (t - 1.35) / 0.35) : t > 4.45 && t < 4.95 ? 0.55 : 1;
    // ── 1. the slide (0 – 1.9 s) ──
    if (t < 1.9) {
      const u = clamp(t / 1.75, 0, 1), p = 1 - (1 - u) * (1 - u), turn = u * u * (3 - 2 * u);
      P.dist = this.dist0 + this.D * p; P.s = ((P.dist % T.L) + T.L) % T.L; P.d = lerp(this.d0, this.dEnd, p); P.psi = lerp(this.psi0, this.psiEnd, turn);
      P.v = this.v0 * (1 - u) * (1 - u * 0.3); P.lean = lerp(this.lean0 * (1 - u), Math.sign(this.psiEnd) * 0.55, Math.sin(Math.PI * u) * 0.9); P.sliding = u < 0.85 && P.v > 2;
      P.rpm = lerp(P.rpm, 2200, Math.min(1, dt * 3)); P.y = T.gy(P.s, P.d); P.slide = 0;
      if (Math.random() < 0.6 && P.v > 3) R.combat.sparks.emit(...this.wpos(-0.2, 0.05, -0.62, 0), (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.25, 0.1, 0.04, C_FIRE, 1, 1.5, 9);
    } else { P.v = 0; P.sliding = false; P.lean = smooth(P.lean, 0.06, 4, dt); P.rpm = smooth(P.rpm, 1500, 4, dt); }
    if (t > 2.0 && !P.engineOff) { P.engineOff = true; AUDIO.tone('square', 90, 40, 0.18, 0.12); }   // key off
    // ── 2. off the bike, 3. light up, 4. the walk ──
    if (t > 1.95) { if (!rig.free) rig.free = this.free; this.pose(t, dt); }
    // keep riders and cops from driving through the shot
    const me = rig.root.position; for (const r of R.riders) if (r !== P && !r.eliminated) { const q = r.rig.root.position; if (Math.hypot(q.x - me.x, q.z - me.z) < 11) r.rig.root.visible = false; }
    this.camera(t, dt);
    if (t > 4.5 && !this.titled) { this.titled = true; this.el.classList.add('go'); MUSIC.hey && MUSIC.on && MUSIC.hey(MUSIC.c.currentTime + 0.02, 0.45); MUSIC.whistle && MUSIC.on && MUSIC.whistle(MUSIC.c.currentTime + 0.1, 0.12); }
    if (t > ENTRY_END - 0.5) this.el.classList.add('out');
    if (t > ENTRY_END) this.finish();
  }
  // world position of a bike-body-space point
  wpos(x, y, z, k) { const v = _ev[7 - (k || 0)].set(x, y, z); this.rig.root.updateMatrixWorld(true); this.rig.body.localToWorld(v); return [v.x, v.y, v.z]; }
  pose(t, dt) {
    const fr = this.free, rig = this.rig, S = this.seat(), F = RIDER_FIT, face = rig.rm.face;
    const ss = (a, b) => _ss(a, b, t), L = (a, b, k) => a.clone().lerp(b, k);
    // where he'll stand and which way he'll face: the pavement side, looking up the road (body space)
    if (!this.spot) { rig.root.updateMatrixWorld(true); const T = this.R.track, sNow = this.P.s, fw = T.pos(sNow + 1, this.P.d + this.sg * 0.0, _ev[0]).clone().sub(T.pos(sNow, this.P.d, _ev[1])).normalize();
      const o = rig.body.worldToLocal(rig.root.position.clone()), w = rig.body.worldToLocal(rig.root.position.clone().add(fw)); const dir = w.sub(o); dir.y = 0; dir.normalize();
      this.walkDir = dir; this.faceYaw = Math.atan2(dir.x, dir.z); this.spot = new THREE.Vector3(0.6, 0, -0.12); this.walk0 = 5.0; }
    const yawW = this.faceYaw, lat = (y) => _ev[0].set(Math.cos(y), 0, -Math.sin(y)), fwd = (y) => _ev[1].set(Math.sin(y), 0, Math.cos(y));
    const upright = -F.baseLean + 0.05, ankle = 0.08;
    let pos, yaw, fl, fR, hl, hr, torsoX, headX = 0, headY = 0, torsoY = 0, wind = 1.5;
    if (t < 3.35) {   // ── dismount: weight left, right leg high over the seat, step down, stand and turn ──
      const u = (t - 1.95) / 1.4;
      const k1 = _ss(0, 0.25, u), k2 = _ss(0.25, 0.55, u), k3 = _ss(0.55, 0.8, u), k4 = _ss(0.8, 1, u);
      const p0 = S.pos.clone(), p1 = p0.clone().add(_ev[0].set(0.12, 0.02, 0)), p2 = p0.clone().add(_ev[0].set(0.3, 0.1, -0.05)), p3 = new THREE.Vector3(0.55, 0.0, -0.17), p4 = this.spot.clone();
      pos = p0.lerp(p1, k1).lerp(p2, k2).lerp(p3, k3).lerp(p4, k4);
      yaw = lerp(0.5 * k2, yawW, k3 * 0.7 + k4 * 0.3);
      const gL = new THREE.Vector3(0.36, ankle, -0.15), feetDone = (pp, y) => [pp.clone().addScaledVector(lat(y), 0.12).addScaledVector(fwd(y), 0.02).setY(ankle), pp.clone().addScaledVector(lat(y), -0.12).addScaledVector(fwd(y), -0.03).setY(ankle)];
      const [eL, eR] = feetDone(this.spot, yawW);
      fl = S.feetL.clone().lerp(gL, k1).lerp(eL, k4);
      const over = new THREE.Vector3(0.02, 1.08, -0.52), down = new THREE.Vector3(0.52, ankle, -0.32);
      fR = S.feetR.clone().lerp(over, k2).lerp(down, k3).lerp(eR, k4); if (k2 > 0 && k3 < 1) fR.y += Math.sin(Math.PI * k2) * 0.15;
      hl = S.gripL.clone(); hr = S.gripR.clone(); const side = (y, sx) => pos.clone().addScaledVector(lat(y), sx * 0.27).addScaledVector(fwd(y), 0.05).setY(0.88);
      hr = hr.lerp(side(yaw, -1), k3); hl = hl.lerp(side(yaw, 1), k4);
      torsoX = lerp(rig.tuck || 0.4, upright + 0.12, k2) + (upright - (upright + 0.12)) * k4; headX = 0.3 * k4; headY = -0.3 * k2 * (1 - k4);
    } else if (t < this.walk0) {   // ── light up: cigarette to the lips, cupped lighter, head down to the flame, then blow it out to the side ──
      pos = this.spot.clone(); yaw = yawW; [fl, fR] = [pos.clone().addScaledVector(lat(yaw), 0.13).addScaledVector(fwd(yaw), 0.04).setY(ankle), pos.clone().addScaledVector(lat(yaw), -0.12).addScaledVector(fwd(yaw), -0.05).setY(ankle)];
      const lip = face.mouth.clone().addScaledVector(fwd(yaw), 0.03).add(_ev[2].set(0, -0.055, 0)).addScaledVector(lat(yaw), -0.035);
      const cup = face.mouth.clone().addScaledVector(fwd(yaw), 0.07).add(_ev[2].set(0, -0.085, 0)).addScaledVector(lat(yaw), 0.02);
      const sideR = pos.clone().addScaledVector(lat(yaw), -0.32).addScaledVector(fwd(yaw), 0.1).setY(0.86), sideL = pos.clone().addScaledVector(lat(yaw), 0.26).addScaledVector(fwd(yaw), 0.02).setY(0.86);
      const up = ss(3.35, 3.6), lit = ss(3.6, 3.7) * (1 - ss(4.25, 4.35)), away = ss(4.3, 4.55), drop = ss(4.6, 4.9);
      hr = sideR.clone().lerp(lip, up * (1 - drop)); hl = sideL.clone().lerp(cup, up * (1 - away));
      headX = 0.3 + 0.16 * up * (1 - away) - 0.32 * ss(4.4, 4.55) * (1 - ss(4.85, 5.0)); headY = -0.35 * ss(4.45, 4.6) * (1 - ss(4.85, 5.0)); torsoX = upright;
      this.lighter.visible = up > 0.6 && away < 0.7; this.flame.visible = lit > 0.5; this.flame.scale.setScalar(0.8 + Math.random() * 0.4);
      if (rig.cig) { rig.cig.visible = t > 3.45; rig.cig.children[0].material.color.setRGB(1, lit > 0.5 ? 0.75 : 0.35, 0.1); }
      if (t > 4.45 && t < 4.85 && rig.onPuff) for (let i = 0; i < 2; i++) rig.onPuff(rig.rm.marks.mouth, 1.6);
    } else {   // ── the walk: slow and wide, right hand down with the smoke, left arm swinging, eyes on the lens ──
      const tw = t - this.walk0, v = 0.85, dist = v * tw, ph = dist / 0.21;
      pos = this.spot.clone().addScaledVector(this.walkDir, dist); yaw = yawW; const LA = lat(yaw).clone(), FW = fwd(yaw).clone();
      pos.addScaledVector(LA, Math.sin(ph) * 0.03); pos.y = 0.012 * Math.cos(ph * 2);
      const foot = (sx, phi) => this.spot.clone().addScaledVector(this.walkDir, dist).addScaledVector(LA, sx * 0.13).addScaledVector(FW, Math.sin(phi) * 0.21).setY(ankle + Math.max(0, Math.cos(phi)) * 0.09);
      fl = foot(1, ph); fR = foot(-1, ph + Math.PI);
      hl = pos.clone().addScaledVector(LA, 0.27).addScaledVector(FW, -0.14 * Math.sin(ph)).setY(0.86 + 0.03 * Math.abs(Math.cos(ph)));
      hr = pos.clone().addScaledVector(LA, -0.33).addScaledVector(FW, 0.1).setY(0.84);
      torsoX = upright - 0.04; torsoY = 0.12 * Math.sin(ph); headX = 0.28; headY = -torsoY * 0.8; wind = 3.5;
      if (rig.cig) rig.cig.visible = true; if (rig.onPuff && Math.random() < 0.3) rig.onPuff(rig.cig.children[0], 0.3);
    }
    fr.pos.copy(pos); fr.yaw = yaw; fr.feet.l.copy(fl); fr.feet.r.copy(fR); fr.hands.l.copy(hl); fr.hands.r.copy(hr); fr.torsoX = torsoX; fr.torsoY = torsoY; fr.headX = headX; fr.headY = headY; fr.wind = wind;
    // the lighter rides in the left fist
    if (this.lighter.visible) { const h = rig.rm.hand('l'), e = rig.rm.elbow('l'); const d = _ev[3].subVectors(h, e).normalize(); this.lighter.position.copy(h).addScaledVector(d, 0.07); this.lighter.quaternion.identity(); }
  }
  // four shots: the slide from low in front, the dismount from the pavement, a low hero close-up, a dolly back ahead of the walk
  camera(t, dt) {
    const cam = this.g.camera, rig = this.rig; rig.root.updateMatrixWorld(true);
    const P = this.P, T = this.R.track, sg = this.sg;
    if (this.shot < 0) { // fixed anchors in the world at the stop point
      const sEnd = ((this.dist0 + this.D) % T.L + T.L) % T.L; this.stopW = T.pos(sEnd, this.dEnd, new THREE.Vector3(), 0); this.stopW.y = T.gy(sEnd, this.dEnd);
      this.roadF = T.pos(sEnd + 1, this.dEnd, new THREE.Vector3()).sub(T.pos(sEnd, this.dEnd, _ev[0])).normalize(); this.paveW = T.pos(sEnd, this.dEnd + sg, new THREE.Vector3()).sub(T.pos(sEnd, this.dEnd, _ev[0])).normalize(); this.shot = 0; }
    const rp = rig.root.position, F = this.roadF, Pv = this.paveW, up = (v, h) => v.y += h;
    const riderW = this.rig.free ? rig.body.localToWorld(this.free.pos.clone()) : rp.clone();
    let pos = _ev[4], look = _ev[5], fov = 50;
    // compositions keep the rider on the right third once the title is up (it sits on the left)
    const third = (amt) => { const fw = _ev[6].subVectors(look, pos).normalize(), rt = fw.cross(_ev[7].set(0, 1, 0)).normalize(); look.addScaledVector(rt, -amt); };
    if (t < 1.95) { const k = _ss(0, 1.9, t); pos.copy(rp).addScaledVector(F, lerp(6.5, 4.2, k)).addScaledVector(Pv, -lerp(1.8, 1.3, k)); pos.y = this.stopW.y + lerp(0.5, 0.75, k); look.copy(rp); look.y += 0.7; fov = lerp(48, 42, k); }   // low, on the road side, tracking the slide
    else if (t < 3.35) { pos.copy(this.stopW).addScaledVector(F, 3.2).addScaledVector(Pv, 1.6); pos.y += 1.2; look.copy(riderW).addScaledVector(Pv, -0.15); look.y += 1.0; fov = 44; }
    else if (t < this.walk0) { const k = _ss(3.35, 5.0, t); pos.copy(riderW).addScaledVector(F, lerp(1.55, 1.3, k)).addScaledVector(Pv, lerp(0.6, 0.4, k)); pos.y += 1.32; look.copy(riderW); look.y += 1.6; fov = lerp(36, 32, k); third(0.3 * _ss(4.3, 4.7, t)); }
    else { const k = _ss(this.walk0, ENTRY_END, t); pos.copy(riderW).addScaledVector(F, lerp(3.6, 2.6, k)).addScaledVector(Pv, 0.3); pos.y += lerp(0.9, 1.05, k); look.copy(riderW); look.y += lerp(1.2, 1.4, k); fov = lerp(42, 36, k); third(lerp(0.7, 0.5, k)); }
    const sh = this.t < 1.9 ? Math.max(0, 1 - t / 1.9) * 0.02 : 0; pos.x += Math.sin(this.g.t * 37) * sh; pos.y += Math.sin(this.g.t * 53) * sh;
    cam.position.copy(pos); cam.lookAt(look); cam.fov = fov; cam.updateProjectionMatrix(); this.g.camLook.copy(look);
    // at night the bike's headlight becomes the film key light: up and to one side of the lens, on the hero (no new light, no recompiles)
    const hl = this.g.world && this.g.world.headlight; if (hl && hl.intensity > 0) { const rt = _ev[6].subVectors(look, pos).normalize().cross(_ev[7].set(0, 1, 0)).normalize();
      hl.position.copy(pos).addScaledVector(rt, 1.2); hl.position.y += 1.4; if (t < 1.95) hl.position.copy(rp).addScaledVector(F, 6).add(_ev[7].set(0, 2.2, 0));
      hl.target.position.copy(t < 1.95 ? rp : riderW); hl.target.position.y += t < 1.95 ? 0.6 : 1.2; hl.target.updateMatrixWorld(); hl.angle = 0.42; hl.distance = 40; if (this.hlI0 === undefined) this.hlI0 = hl.intensity; hl.intensity = t < 1.95 ? 45 : 11; }
  }
  finish() {
    if (this.done) return; this.done = true; removeEventListener('keydown', this.skip); removeEventListener('pointerdown', this.skip);
    this.el.classList.remove('on', 'go', 'out'); this.el.hidden = true; this.lighter.visible = false;
    this.g.entry = null; this.dispose(); this.g.showResults(this.R);
  }
  dispose() { const hl = this.g.world && this.g.world.headlight; if (hl && this.hlI0 !== undefined) { hl.intensity = this.hlI0; hl.angle = 0.5; hl.distance = 70; }
    if (this.lighter.parent) this.lighter.parent.remove(this.lighter); this.disposables.forEach(d => d.dispose()); }
}
