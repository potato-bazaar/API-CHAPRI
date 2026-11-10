// ───────────────────────── FLYING MODE ─────────────────────────
// The bike with a home-made flying machine bolted on: bamboo spars, canvas, rope and a wooden propeller. Build speed on the
// runway, open the wings (a skill: too early and the drag eats your speed, too late and you miss the lift), jump the cliff,
// fly the canyon through the rings and put it down on the far mesa. One run, scored.
//
// How it fits the game: the canyon is part of the same track spline (15_track.js, pit), so a flight is still (s, d, y): the
// rider keeps advancing along the corridor, d is how far it has drifted sideways and y is free. FlightOps owns the bike's
// speed, climb and drift while it is in the air and hands it back to the ordinary physics at touchdown.
const FLY_UP = {
  wing: ['Wing Size', 'More lift: you sink slower'], mat: ['Wing Material', 'Shrugs off bird strikes and hard landings'], frame: ['Wooden Frame', 'Steadier: stalls at a lower speed'],
  prop: ['Propeller', 'More thrust: holds speed longer'], rope: ['Rope Mechanism', 'Wings open faster'], ctrl: ['Flight Control', 'Sharper steering and pitch'], boost: ['Boost Capacity', 'A longer boost'] };
const FLY_BUILDS = {
  bamboo: { name: 'Classic Bamboo Flyer', cost: 0, canvas: '#ead9b6', frame: '#b88a4a', note: 'The original. Honest and slow.' },
  glider: { name: 'Vintage Canvas Glider', cost: 1500, canvas: '#f6f0e2', frame: '#8a6a44', span: 1.15, sink: 0.93, note: 'Longer wings: glides further.' },
  double: { name: 'Double Wing Flyer', cost: 2500, canvas: '#e3cfa2', frame: '#a5773c', bi: true, sink: 0.88, drag: 1.14, note: 'Two decks: more lift, more drag.' },
  prop: { name: 'Experimental Propeller Flyer', cost: 3500, canvas: '#dfd3b8', frame: '#6d5a44', props: 2, thrust: 1.7, note: 'Twin propellers: keeps its speed.' },
  royal: { name: 'Ornate Royal Flyer', cost: 4000, canvas: '#b3262c', frame: '#c99a2e', span: 1.06, score: 1.06, note: 'Red silk and gold. 6% more score.' },
};
const FLY_RATINGS = [[5600, 'LEGENDARY', '#ff5ac8'], [4300, 'GOLD', '#ffc247'], [2900, 'SILVER', '#cfd8e2'], [1500, 'BRONZE', '#c98a4a'], [0, 'TRY AGAIN', '#9aa0aa']];
const FLY_PHASE = { RUN: ['RUN-UP', 'Reach 90 km/h to open the wings'], READY: ['FLIGHT READY', 'Open the wings before the ramp'], DEPLOY: ['WINGS OPENING', 'Hold your speed'], TAKEOFF: ['TAKE-OFF', 'Hit the ramp flat out'],
  FLY: ['FLYING', 'Through the rings · keep your speed'], APPROACH: ['LANDING', 'Line up · nose level · touch down soft'], LANDED: ['LANDED', ''], FALL: ['NO WINGS!', 'Open them now!'], CRASHED: ['CRASHED', ''] };
function flySave() { const f = SAVE.fly = SAVE.fly || {}; f.up = f.up || {}; f.own = f.own || { bamboo: true }; f.build = FLY_BUILDS[f.build] ? f.build : 'bamboo'; f.best = f.best || 0; return f; }
const flyUpCost = (lvl) => 250 + lvl * 250;
function flyStats() { const f = flySave(), u = (k) => f.up[k] || 0, b = FLY_BUILDS[f.build];
  return { build: f.build, b, sink: (1 - u('wing') * 0.06) * (b.sink || 1), tough: u('mat'), stall: 21 - u('frame') * 1.1, thrust: (0.25 + u('prop') * 0.09) * (b.thrust || 1), deployT: 1.5 - u('rope') * 0.22, ctrl: 1 + u('ctrl') * 0.09, boost: 3 + u('boost') * 0.8, drag: b.drag || 1, score: b.score || 1 }; }

// ── the machine itself ──
let FLY_CANVAS = null;
function flyCanvasTex() {
  if (FLY_CANVAS) return FLY_CANVAS; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = mulberry32(31);
  x.fillStyle = '#f2e6cc'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${150 + r() * 60 | 0},${120 + r() * 50 | 0},${80 + r() * 40 | 0},${0.04 + r() * 0.07})`; x.fillRect(r() * 256, r() * 256, 2 + r() * 14, 1 + r() * 2); }   // weave and stains
  for (let i = 0; i < 9; i++) { const g = x.createRadialGradient(r() * 256, r() * 256, 2, r() * 256, r() * 256, 50 + r() * 40); g.addColorStop(0, 'rgba(120,80,40,.16)'); g.addColorStop(1, 'rgba(120,80,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  x.strokeStyle = 'rgba(90,60,30,.55)'; x.lineWidth = 1.4; x.setLineDash([5, 4]); for (const y of [64, 128, 192]) { x.beginPath(); x.moveTo(0, y + r() * 6); x.lineTo(256, y + r() * 6); x.stroke(); }   // stitched seams
  x.setLineDash([]); for (const [px, py, col] of [[70, 96, '#c8321e'], [178, 168, '#2f6f8a'], [200, 60, '#d9a23a']]) { x.save(); x.translate(px, py); x.rotate(r() - 0.5); x.fillStyle = col; x.fillRect(-17, -13, 34, 26); x.strokeStyle = 'rgba(40,25,10,.8)'; x.setLineDash([3, 3]); x.strokeRect(-14, -10, 28, 20); x.restore(); }   // patches
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return FLY_CANVAS = t;
}
const FLY_RIBS = [[3.5, -0.14], [3.3, 0.2], [2.8, 0.56], [2.15, 0.96], [1.45, 1.38]];   // [length, sweep back when open (rad)]
class FlyRig {
  constructor(rig, st) {
    const b = st.b, span = b.span || 1, g = this.g = new THREE.Group(); this.st = st; this.k = 0; this.t = 0; this.load = 0; this.roll = 0;
    const wood = this.wood = new THREE.MeshLambertMaterial({ color: b.frame }), dark = this.dark = new THREE.MeshLambertMaterial({ color: '#3a2717' }), brass = this.brass = new THREE.MeshLambertMaterial({ color: '#d9a23a', emissive: '#3a2600' });
    const canvas = this.canvas = new THREE.MeshLambertMaterial({ map: flyCanvasTex(), color: b.canvas, side: THREE.DoubleSide, emissive: new THREE.Color(b.canvas).multiplyScalar(0.42), emissiveMap: flyCanvasTex() });   // sunlit cloth: it glows a little from underneath too
    this.geos = []; const G = (geo) => (this.geos.push(geo), geo), cyl = G(new THREE.CylinderGeometry(0.5, 0.5, 1, 6)), box = UNIT_BOX;
    const stick = (x0, y0, z0, x1, y1, z1, r, mat = wood) => { const m = new THREE.Mesh(cyl, mat), a = new THREE.Vector3(x0, y0, z0), c = new THREE.Vector3(x1, y1, z1), d = c.clone().sub(a), L = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.scale.set(r * 2, L, r * 2); g.add(m); return m; };
    const blk = (x, y, z, sx, sy, sz, mat) => { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
    // the frame: a kingpost over the seat, a cross beam for the wing roots, struts down to the bike, leather and brass
    const KP = this.KP = new THREE.Vector3(0, 2.05, -0.42); stick(0, 0.95, -0.42, KP.x, KP.y, KP.z, 0.04); stick(-0.62, 1.22, -0.42, 0.62, 1.22, -0.42, 0.045);
    for (const sx of [-1, 1]) { stick(sx * 0.6, 1.22, -0.42, sx * 0.2, 0.55, -0.7, 0.03); stick(sx * 0.6, 1.22, -0.42, sx * 0.18, 0.78, 0.25, 0.03); blk(sx * 0.6, 1.22, -0.42, 0.13, 0.13, 0.13, brass); blk(sx * 0.2, 0.62, -0.68, 0.1, 0.16, 0.1, dark); blk(sx * 0.36, 0.98, -0.1, 0.07, 0.2, 0.09, dark); }
    blk(0, KP.y, KP.z, 0.12, 0.1, 0.12, brass); for (const sx of [-1, 1]) { const p = new THREE.Mesh(cyl, brass); p.rotation.z = Math.PI / 2; p.scale.set(0.16, 0.05, 0.16); p.position.set(sx * 0.1, KP.y - 0.1, KP.z); g.add(p); }   // pulleys
    // tail: a boom, a canvas fan, the propeller(s) behind the wheel
    stick(0, 1.15, -0.5, 0, 1.3, -2.25, 0.035); stick(0, 1.3, -2.25, 0, 1.95, -2.5, 0.025);
    { const tg = G(new THREE.BufferGeometry()); tg.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.28, -1.55, -0.95, 1.3, -2.5, 0.95, 1.3, -2.5, 0, 1.28, -1.6, 0, 1.3, -2.5, 0, 2.0, -2.55], 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1], 2)); tg.computeVertexNormals(); g.add(new THREE.Mesh(tg, canvas)); }
    this.props = []; for (const px of (b.props === 2 ? [-0.42, 0.42] : [0])) { const pr = new THREE.Group(); pr.position.set(px, 1.0, -1.42); const bl = new THREE.Mesh(box, wood); bl.scale.set(1.15, 0.13, 0.03); pr.add(bl); const bl2 = new THREE.Mesh(box, wood); bl2.scale.set(0.13, 1.15, 0.03); pr.add(bl2); const hub = new THREE.Mesh(cyl, brass); hub.rotation.x = Math.PI / 2; hub.scale.set(0.16, 0.12, 0.16); pr.add(hub); g.add(pr); this.props.push(pr); if (px) stick(px, 1.0, -1.38, 0, 1.2, -0.9, 0.025); }
    // the wings: five bamboo ribs fanning from each root, canvas stretched between them, a lantern under each
    this.wings = []; const decks = b.bi ? [[1.22, 1, 0], [2.0, 0.72, 0.1]] : [[1.22, 1, 0]];
    for (const [y, sc, zo] of decks) for (const sd of [-1, 1]) { const root = new THREE.Group(); root.position.set(sd * 0.62, y, -0.42 - zo); root.scale.x = sd; g.add(root); const W = { root, sd, ribs: [], L: FLY_RIBS.map(r => r[0] * span * sc), top: y > 1.5 };
      FLY_RIBS.forEach(([len], i) => { const piv = new THREE.Group(), L = W.L[i], m = new THREE.Mesh(cyl, wood); m.rotation.z = -Math.PI / 2; m.scale.set(i === 0 ? 0.085 : 0.055, L, i === 0 ? 0.085 : 0.055); m.position.x = L / 2; piv.add(m);
        for (const f of [0.33, 0.66, 1]) { const kn = new THREE.Mesh(box, f === 1 ? brass : dark); kn.scale.set(0.05, i === 0 ? 0.11 : 0.08, i === 0 ? 0.11 : 0.08); kn.position.x = L * f - 0.02; piv.add(kn); }   // lashings
        root.add(piv); W.ribs.push(piv); });
      if (!W.top) { const lan = new THREE.Group(); lan.position.set(W.L[1] * 0.3, -0.34, 0); const cage = new THREE.Mesh(box, dark); cage.scale.set(0.16, 0.26, 0.16); lan.add(cage); const fl = new THREE.Mesh(box, this.flame = this.flame || new THREE.MeshBasicMaterial({ color: '#ffb347' })); fl.scale.set(0.11, 0.17, 0.11); lan.add(fl);
        const st2 = new THREE.Mesh(box, dark); st2.scale.set(0.015, 0.22, 0.015); st2.position.y = 0.22; lan.add(st2); W.ribs[1].add(lan); W.lan = lan; }
      const n = FLY_RIBS.length, cg = G(new THREE.BufferGeometry()), pos = new Float32Array((1 + n + (n - 1)) * 3), uv = new Float32Array((1 + n + (n - 1)) * 2), idx = [];
      for (let i = 0; i < n - 1; i++) idx.push(0, 1 + i, 1 + n + i, 0, 1 + n + i, 2 + i);
      cg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); cg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); cg.setIndex(idx); W.cg = cg; W.mesh = new THREE.Mesh(cg, canvas); W.mesh.frustumCulled = false; root.add(W.mesh); this.wings.push(W); }
    // ropes from the kingpost out to the ribs (they go slack when folded, taut when open)
    const rg = this.ropeG = G(new THREE.BufferGeometry()); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.wings.length * 2 * 6), 3)); this.ropeM = new THREE.LineBasicMaterial({ color: '#d9c49a' }); this.ropes = new THREE.LineSegments(rg, this.ropeM); this.ropes.frustumCulled = false; g.add(this.ropes);
    g.traverse(o => { o.userData.dyn = true; }); rig.body.add(g); this.pose(0, 0);
  }
  // k = 0 folded (ribs gathered, swung back and up, drawn in) … 1 open; load = how hard the air is pressing; roll = banking
  pose(dt, k) {
    this.t += dt; const e = k * k * (3 - 2 * k), n = FLY_RIBS.length, rp = this.ropeG.attributes.position; let ri = 0; const v = this._v || (this._v = new THREE.Vector3());
    for (const W of this.wings) { const flap = Math.sin(this.t * 7 + W.sd) * 0.012 * e, dih = 0.13 + this.load * 0.16 + flap + W.sd * this.roll * 0.12, sc = lerp(0.34, 1, e);
      W.root.rotation.set(0, 0, lerp(-0.5, dih, e));   // folded: gathered, swung forward and down along the bike's flanks, out of the rider's (and the lens's) way W.root.scale.set(W.sd * sc, sc, sc);
      const p = W.cg.attributes.position, u = W.cg.attributes.uv, tip = [];
      for (let i = 0; i < n; i++) { const a = lerp(-1.3 - i * 0.05, FLY_RIBS[i][1], e) + (i > 0 ? Math.sin(this.t * 9 + i) * 0.008 * e : 0); W.ribs[i].rotation.y = a; const L = W.L[i]; tip.push([Math.cos(a) * L, -Math.sin(a) * L]); p.setXYZ(1 + i, tip[i][0], 0, tip[i][1]); u.setXY(1 + i, tip[i][0] / 3.6, 0.5 - tip[i][1] / 3.6); }
      p.setXYZ(0, 0, 0, 0); u.setXY(0, 0, 0.5);
      for (let i = 0; i < n - 1; i++) { const mx = (tip[i][0] + tip[i + 1][0]) * 0.5 * 0.83, mz = (tip[i][1] + tip[i + 1][1]) * 0.5 * 0.83; p.setXYZ(1 + n + i, mx, -0.05 * e - this.load * 0.1, mz); u.setXY(1 + n + i, mx / 3.6, 0.5 - mz / 3.6); }   // the cloth bellies between the ribs
      p.needsUpdate = true; u.needsUpdate = true; W.cg.computeVertexNormals(); if (W.lan) W.lan.rotation.z = -lerp(-0.5, dih, e);   // the lantern hangs straight down whatever the wing does
      for (const [i, f] of [[0, 0.62], [2, 0.6]]) { W.root.updateMatrix(); v.set(tip[i][0] * f, 0, tip[i][1] * f).applyMatrix4(W.root.matrix); rp.setXYZ(ri++, this.KP.x, this.KP.y, this.KP.z); rp.setXYZ(ri++, v.x, v.y - (1 - e) * 0.25, v.z); } }
    rp.needsUpdate = true; this.k = k;
  }
  spin(dt, v) { for (const p of this.props) p.rotation.z += dt * (6 + v * 1.6); }
  dispose() { this.g.removeFromParent(); for (const g of this.geos) g.dispose(); for (const m of [this.wood, this.dark, this.brass, this.canvas, this.ropeM, this.flame]) m && m.dispose(); }
}

// ── the run ──
class FlightOps {
  constructor(race) {
    const R = this.race = race, T = R.track, P = R.player; this.st = flyStats(); this.rig = new FlyRig(P.rig, this.st); this.phase = 'RUN'; this.k = 0; this.deployed = false; this.t = 0; this.boost = this.st.boost; this.camK = 0;
    this.lip = T.pit[0]; this.land = T.pit[1]; this.platY = T.yAt(this.land + 2); this.lipY = T.yAt(this.lip - 0.6); this.target = this.land + 70; this.pitch = 0; this.roll = 0; this.rollT = 0; this.fv = 0; this.fvy = 0; this.fd = 0;
    this.sc = { runup: 0, deploy: 0, takeoff: 0, dist: 0, rings: 0, coins: 0, stunts: 0, landing: 0 }; this.nRing = 0; this.nCoin = 0; this.nRoll = 0; this.hits = 0; this.auto = URLP.has('autopilot'); this.autoSteer = 0; this.autoPitch = 0; this.group = new THREE.Group(); R.group.add(this.group); this.disp = [];
    const D = (o) => (this.disp.push(o), o), v = new THREE.Vector3();
    // the line through the canyon: where the rings hang
    const span = this.land - this.lip; this.lineY = (s) => { const u = clamp((s - this.lip) / span, 0, 1); return lerp(this.lipY + 9, this.platY + 24, u) + Math.sin(u * Math.PI * 3) * 7 * Math.sin(u * Math.PI); };
    this.lineD = (s) => { const u = clamp((s - this.lip) / span, 0, 1); return Math.sin(u * Math.PI * 2.6 + 0.5) * 24 * Math.sin(u * Math.PI); };
    const ringG = D(new THREE.TorusGeometry(6.6, 0.36, 7, 26)), ringM = this.ringM = D(new THREE.MeshLambertMaterial({ color: '#b88a4a' })), ringOn = this.ringOn = D(new THREE.MeshBasicMaterial({ color: '#ffc247' })), flagG = D(new THREE.PlaneGeometry(0.9, 1.3)), flagM = D(new THREE.MeshBasicMaterial({ color: '#ff8a1f', side: THREE.DoubleSide })), flagM2 = D(new THREE.MeshBasicMaterial({ color: '#f4f0e6', side: THREE.DoubleSide }));
    this.rings = []; const NR = 9; for (let i = 0; i < NR; i++) { const s = this.lip + 190 + i * (span - 560) / (NR - 1), d = this.lineD(s), y = this.lineY(s); T.pos(s, d, v, 0); const m = new THREE.Mesh(ringG, ringM); m.position.set(v.x, y, v.z); m.rotation.y = T.yawAt(s);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, f = new THREE.Mesh(flagG, k % 2 ? flagM : flagM2); f.position.set(Math.cos(a) * 7.3, Math.sin(a) * 7.3, 0); f.rotation.z = a - Math.PI / 2; m.add(f); } this.group.add(m); this.rings.push({ s, d, y, m, done: false }); }
    // coins strung between the rings
    const coinG = D(new THREE.CylinderGeometry(0.75, 0.75, 0.14, 12).rotateX(Math.PI / 2)), coinM = D(new THREE.MeshBasicMaterial({ color: '#ffd23f' })); this.coins = [];
    for (let i = -1; i < NR - 1; i++) { const s0 = i < 0 ? this.lip + 60 : this.rings[i].s, s1 = this.rings[i + 1].s; for (let k = 1; k <= 4; k++) { const s = lerp(s0, s1, k / 5), d = this.lineD(s), y = this.lineY(s); T.pos(s, d, v, 0); const m = new THREE.Mesh(coinG, coinM); m.position.set(v.x, y, v.z); this.group.add(m); this.coins.push({ s, d, y, m }); } }
    // rock spires standing up out of the canyon, right beside the line
    const rockM = D(new THREE.MeshLambertMaterial({ color: '#b5653a', flatShading: true })); this.spires = [];
    for (let i = 0; i < 6; i++) { const s = (this.rings[i].s + this.rings[i + 1].s) / 2 + (i % 2 ? 25 : -20), sd = i % 2 ? 1 : -1, d = this.lineD(s) + sd * (12 + (i % 3) * 2.5), top = this.lineY(s) + 16 + (i % 2) * 8, floor = T.yAt(s), H = top - floor + 6; T.pos(s, d, v, 0);
      const g = D(new THREE.CylinderGeometry(3.2, 24, H, 7, 5)), m = new THREE.Mesh(g, rockM); m.position.set(v.x, top - H / 2, v.z); m.rotation.y = i * 1.7; this.group.add(m); const cap = new THREE.Mesh(D(new THREE.IcosahedronGeometry(5.2, 0)), rockM); cap.position.set(v.x, top + 1.5, v.z); cap.scale.y = 0.6; this.group.add(cap); this.spires.push({ s, d, top, H }); }
    // flocks of birds crossing the line
    const EP = wildParts('eagle'), birdM = D(new THREE.MeshLambertMaterial({ vertexColors: true })); this.birds = [];
    for (let i = 0; i < 4; i++) { const s = this.rings[2 * i + 1].s - 70, g = new THREE.Group(), kids = []; for (let k = 0; k < 5; k++) { const b = new THREE.Group(), body = new THREE.Mesh(EP.body, birdM); b.add(body); const wg = []; for (const sx of [-1, 1]) { const piv = new THREE.Group(), w = new THREE.Mesh(EP.wing, birdM); w.scale.x = sx; piv.add(w); b.add(piv); wg.push(piv); } b.position.set((k - 2) * 2.6, Math.abs(k - 2) * -0.5, Math.abs(k - 2) * -2.2); b.scale.setScalar(1.5); g.add(b); kids.push(wg); } this.group.add(g); this.birds.push({ s, g, kids, ph: i * 1.7, d: 0, y: 0, hit: 0 }); }
    // patchwork balloons riding the thermals beside the corridor (just to look at)
    const balG = D(new THREE.SphereGeometry(7, 10, 8)), bask = D(new THREE.BoxGeometry(2.2, 1.8, 2.2)), baskM = D(new THREE.MeshLambertMaterial({ color: '#7a4f28' }));
    [['#c8321e', 0.2, 62], ['#e8b62a', 0.5, -70], ['#2f6f8a', 0.78, 58]].forEach(([c, u, d]) => { const s = this.lip + span * u; T.pos(s, d, v, 0); const m = new THREE.Mesh(balG, D(new THREE.MeshLambertMaterial({ color: c, flatShading: true }))); m.scale.y = 1.2; m.position.set(v.x, this.lineY(s) + 20, v.z); const b = new THREE.Mesh(bask, baskM); b.position.set(0, -9.5, 0); b.scale.y = 1 / 1.2; m.add(b); this.group.add(m); });
    this.el = { root: $('#fly'), phase: $('#flyPhase'), fill: $('#flyFill'), wing: $('#flyWing'), alt: $('#fAlt'), dist: $('#fDist'), rings: $('#fRings'), land: $('#fLand'), boost: $('#flyBoost'), time: $('#fTime') }; this.el.root.hidden = false; this.setPhase('RUN');
  }
  setPhase(p) { this.phase = p; const [a, b] = FLY_PHASE[p], h = $('#hud'); this.el.phase.innerHTML = `<b>${a}</b>${b ? `<small>${b}</small>` : ''}`; this.el.phase.dataset.p = p;
    h.classList.add('flymode'); h.classList.toggle('fly-air', p === 'FLY' || p === 'APPROACH' || p === 'FALL'); h.classList.toggle('fly-ready', p === 'READY' || p === 'FALL'); h.classList.toggle('fly-ground', p === 'RUN' || p === 'READY' || p === 'DEPLOY' || p === 'TAKEOFF'); }
  say(a, b, tone) { this.race.hud.callout(a, b || null, tone || 'gold'); }
  startDeploy() { const P = this.race.player; if (this.dep) return; this.dep = { v: P.v, gap: this.lip - P.dist, air: P.air }; AUDIO.tone('square', 220, 330, 0.08, 0.2); AUDIO.tone('square', 260, 390, 0.08, 0.2, 0.12); AUDIO.tone('square', 300, 450, 0.08, 0.2, 0.24); AUDIO.noise(0.5, 900, 1.2, 0.3, 'bandpass', 0.05);
    if (!P.air) this.setPhase('DEPLOY'); }
  // physics, once per substep, after the rider's own
  step(dt) {
    const R = this.race, T = R.track, P = R.player, I = P.input, st = this.st; if (R.state !== 'racing' || this.over) return; this.t += dt;
    const kmh = P.v * 3.6, alt = P.y - T.gy(P.s, 0), inPit = T.pitAt(P.s), want = this.wantDeploy(P, I, kmh);
    if (this.dep && this.k < 1) { this.k = Math.min(1, this.k + dt / st.deployT); if (this.k >= 1) { this.deployed = true; this.say('WINGS DEPLOYED!'); AUDIO.lap(); if (!P.air) this.setPhase('TAKEOFF'); } }
    if (!this.launched) {
      if (this.phase === 'RUN' && kmh >= 90) { this.setPhase('READY'); this.say('FLIGHT READY', 'Open the wings'); AUDIO.pickup(); } else if (this.phase === 'READY' && kmh < 84) this.setPhase('RUN');
      if (want && !this.dep && (this.phase === 'READY')) this.startDeploy(); else if (want && !this.dep && this.phase === 'RUN' && this.t - (this.nagT || -9) > 1.5) { this.nagT = this.t; this.say('TOO SLOW', '90 km/h chahiye', 'bad'); }
      if (this.dep && !P.air) P.v = Math.max(0, P.v - 1.1 * this.k * dt);   // open wings drag on the ground: open too early and you bleed speed
      if (P.dist >= this.lip - 0.5 && (P.air || inPit)) this.launch();
      return; }
    if (this.phase === 'FALL') { if (want && !this.dep) this.startDeploy(); if (this.deployed) { this.fv = P.v; this.fvy = P.vy; this.fd = P.d; this.glide(true); this.setPhase('FLY'); } else if (!P.air) return this.fail('CANYON MEIN GIRA!'); return; }
    if (this.phase === 'FLY' || this.phase === 'APPROACH') {
      if (!P.air) return this.touchdown();
      // controls: pitch (nose up trades speed for height), bank, boost, barrel roll
      const up = this.auto ? this.autoPitch > 0 : (I.throttle > 0.5 || INPUT.touch.pup), dn = this.auto ? this.autoPitch < 0 : (I.brake > 0.5 || INPUT.touch.pdn), steer = this.auto ? this.autoSteer : I.steer;
      this.pitch = smooth(this.pitch, up ? 0.4 : dn ? -0.5 : -0.03, 2.3 * st.ctrl, dt);
      const boosting = (this.auto ? this.fv < 27 : I.boost) && this.boost > 0; if (boosting) this.boost = Math.max(0, this.boost - dt); this.boosting = boosting;
      this.fv += (-G * Math.sin(this.pitch) * 0.95 - 0.00048 * st.drag * this.fv * this.fv * (1 + 3.2 * Math.max(0, this.pitch)) + st.thrust + (boosting ? 8 : 0)) * dt; this.fv = clamp(this.fv, 7, 64);
      let sink = 1.4 * st.sink * Math.pow(28 / Math.max(this.fv, 12), 2); this.stalling = this.fv < st.stall; if (this.stalling) { sink += (st.stall - this.fv) * 0.9; this.pitch -= 0.7 * dt; if (this.t - (this.stallT || -9) > 2) { this.stallT = this.t; this.say('STALL!', 'Nose down, speed pakdo', 'bad'); AUDIO.warn(); } }
      this.flare = this.phase === 'APPROACH' && P.dist > this.land && P.y - T.gy(P.s, 0) < 9; if (this.flare) sink += 2.6;   // over the strip the wings are let half in: it settles
      if (this.rollT > 0) { this.rollT -= dt; sink += 3; if (this.rollT <= 0) { this.nRoll++; this.sc.stunts += 150; this.say('BARREL ROLL!', '+150'); } }
      else if (want && alt > 22 && !this.stalling) { this.rollT = 0.95; this.rollDir = steer < -0.2 ? -1 : 1; AUDIO.whoosh(1); }
      this.fvy = smooth(this.fvy, this.fv * Math.sin(this.pitch) - sink, 2.6, dt);
      this.roll = smooth(this.roll, -steer * 0.6, 4.5, dt); this.fd += -steer * (8 + this.fv * 0.22) * st.ctrl * dt; this.fd = clamp(this.fd, -74, 74);
      if (Math.abs(this.fd) > 66 && this.t - (this.edgeT || -9) > 2.5) { this.edgeT = this.t; this.say('CANYON KI DEEWAR!', 'Beech mein raho', 'bad'); }
      this.glide(true); this.sc.dist = Math.round(clamp((P.dist - this.lip) * 0.48, 0, 1250)); this.flown = P.dist - this.lip; this.airT = (this.airT || 0) + dt;
      this.things(P, T, dt);
      if (this.phase === 'FLY' && P.dist > this.land - 330) { this.setPhase('APPROACH'); this.say('LANDING STRIP AAGE!', 'Nose level, dheere se'); AUDIO.pickup(); }
      if (P.dist < this.land && P.dist + this.fv * dt * 3 >= this.land && P.y < this.platY - 0.7) return this.fail('MESA KI DEEWAR SE TAKKAR!');
      if (P.dist > T.finS + 40) return this.fail('STRIP PAAR KAR GAYA!', true);
      return; }
    if (this.phase === 'LANDED') { P.v = Math.max(0, P.v - 13 * dt); this.landT += dt; if (P.crashed && !this.crashLanding) { this.crashLanding = true; this.sc.landing = Math.round(this.sc.landing * 0.3); } if (P.v < 1.2 || this.landT > 3.2) this.finish(true); return; }
    if (this.phase === 'CRASHED') { this.failT += dt; if (this.tumble && !P.air && !P.crashed) P.crash('fell'); if (this.failT > 2.4) this.finish(false); }
  }
  wantDeploy(P, I, kmh) { const now = !!(INPUT.touch.deploy || I.rear > 0.5), edge = now && !this.prevDep; this.prevDep = now;
    if (this.auto) { if (!this.dep && !this.launched) return kmh >= 92 && this.lip - P.dist < 150 && !URLP.has('nodeploy'); return false; } return edge; }
  glide(on) { const P = this.race.player; P.gliding = on; P.flyW = on ? 80 : 0; if (on) { P.vy = this.fvy; P.v = this.fv; P.d = this.fd; P.psi = 0; P.omega = 0; P.strafe = 0; P.shoveV = 0; P.wobble = 0; P.pitch = this.pitch * 0.8; P.lean = this.roll + (this.rollT > 0 ? this.rollDir * (1 - this.rollT / 0.95) * Math.PI * 2 : 0); } }
  launch() { const R = this.race, P = R.player; this.launched = true; const kmh = P.v * 3.6, d = this.dep;
    this.sc.runup = Math.round(clamp((kmh - 85) * 14, 0, 500));
    if (d && !d.air) { const perfect = d.gap < 170 && d.gap > 20 && d.v * 3.6 >= 96 && this.k >= 1; this.sc.deploy = perfect ? 500 : this.k >= 1 ? 300 : 150; this.deployGrade = perfect ? 'PERFECT' : this.k >= 1 ? 'GOOD' : 'LATE'; } else { this.sc.deploy = 0; this.deployGrade = 'MISSED'; }
    this.sc.takeoff = Math.round(clamp(P.vy / 5.5, 0, 1) * 500 + this.k * 300); this.takeKmh = Math.round(kmh);
    if (this.k > 0.45) { this.fv = P.v; this.fvy = P.vy + 1.6 * this.k + (this.deployGrade === 'PERFECT' ? 1.2 : 0); this.fd = P.d; this.glide(true); this.setPhase('FLY'); this.say(this.deployGrade === 'PERFECT' ? 'PERFECT TAKE-OFF!' : 'UDAAN!', `${this.takeKmh} km/h`); AUDIO.whoosh(1); R.game.shake(0.3); }
    else { this.setPhase('FALL'); this.say('PANKH KHOL!', 'Open the wings!', 'bad'); AUDIO.warn(); } }
  // rings, coins, spires and birds
  things(P, T, dt) {
    const s = P.dist, d = P.d, y = P.y + 0.9;
    for (const r of this.rings) { if (r.done) continue; if (s >= r.s) { r.done = true; const off = Math.hypot(d - r.d, y - r.y); if (off < 6.4) { this.nRing++; this.sc.rings += 100; this.fv = Math.min(64, this.fv + 2.6); this.fvy += 1.6; this.boost = Math.min(this.st.boost, this.boost + 0.5); r.m.visible = false; this.say(off < 2.2 ? 'BEECH SE!' : 'RING!', `+100 · ${this.nRing}/${this.rings.length}`); AUDIO.pickup(); if (off < 2.2) this.sc.rings += 30; } else { r.m.material = this.ringM; this.say('RING MISS', null, 'bad'); } } break; }
    const nx = this.rings.find(r => !r.done); for (const r of this.rings) if (!r.done) r.m.material = r === nx ? this.ringOn : this.ringM; this.next = nx;
    for (const c of this.coins) { if (!c.m.visible) continue; c.m.rotation.y += dt * 4; if (Math.abs(s - c.s) < 2.2 && Math.hypot(d - c.d, y - c.y) < 3.2) { c.m.visible = false; this.nCoin++; this.sc.coins += 12; AUDIO.coin(); } }
    for (const sp of this.spires) { if (y > sp.top + 2) continue; const r = lerp(3.4, 24, clamp((sp.top - y) / sp.H, 0, 1)) + 0.8; if (Math.hypot(s - sp.s, d - sp.d) < r) return this.fail('CHATTAN SE TAKKAR!', true); }
    for (const b of this.birds) { if (Math.abs(s - b.s) < 2.6 && Math.abs(d - b.d) < 6.5 && Math.abs(y - b.y) < 2.4 && this.t - b.hit > 3) { b.hit = this.t; this.hits++; this.fv = Math.max(12, this.fv - Math.max(2, 7 - this.st.tough * 1.2)); this.roll += 0.5; this.say('CHIDIYA SE TAKKAR!', 'Speed gayi', 'bad'); AUDIO.thud(0.8); this.race.game.shake(0.4); } }
    if (this.auto) { const tgt = P.dist > this.land - 260 ? { d: 0, y: this.platY + clamp((this.target - 20 - P.dist) * 0.09, -3, 30) } : nx ? { d: this.lineD(s + 45), y: this.lineY(s + 45) } : { d: 0, y: this.platY + 26 }; this.autoSteer = clamp((P.d - tgt.d) * 0.12, -1, 1); const e = tgt.y - (P.y + this.fvy * 1.1); this.autoPitch = e > 1.2 ? 1 : e < -1.2 ? -1 : 0; if (this.fv < this.st.stall + 4) this.autoPitch = -1; if (P.dist > this.land - 260 && P.dist < this.land - 40 && this.fv > 30 && e > -4) this.autoPitch = 1; }
  }
  touchdown() { const R = this.race, T = R.track, P = R.player; this.glide(false);
    if (T.pitAt(P.s)) { AUDIO.splash(1); return this.fail('CANYON MEIN GIRA!'); }
    const imp = P.landImpact || 0, off = Math.abs(P.d), hw = T.wAt(P.s) / 2, miss = Math.abs(P.dist - this.target), tough = this.st.tough;
    if (off > hw + 0.5) return this.fail('STRIP SE BAHAR!');
    const soft = clamp(1 - Math.max(0, imp - 2.5) / (6 + tough), 0, 1), level = clamp(1 - Math.abs(this.pitch + 0.03) / 0.4, 0, 1), aim = clamp(1 - miss / 90, 0, 1), centre = clamp(1 - off / hw, 0, 1);
    this.sc.landing = Math.round(250 + soft * 300 + level * 150 + aim * 200 + centre * 100); this.landGrade = soft > 0.85 && aim > 0.8 ? 'MAKKHAN LANDING!' : soft > 0.5 ? 'SAFE LANDING' : 'HARD LANDING'; this.landed = true; this.landT = 0; this.landMiss = Math.round(miss);
    if (imp > 9.5 + tough * 0.8 && !P.crashed) P.crash('fell');
    this.setPhase('LANDED'); this.say(this.landGrade, `${Math.round(miss)} m from the mark`, soft > 0.5 ? 'gold' : 'bad'); AUDIO.finish(soft > 0.5); }
  fail(msg, tumble) { const R = this.race, P = R.player; if (this.phase === 'CRASHED') return; this.glide(false); this.tumble = !!tumble && P.air; this.failT = 0; this.failMsg = msg; this.setPhase('CRASHED'); R.hud.big(msg, `${Math.round(this.flown || 0)} m flown`, 2.6); AUDIO.crash(0.7); R.game.shake(0.7);
    if (!this.tumble && !P.crashed) P.crash('fell'); }
  finish(ok) { if (this.over) return; this.over = true; const R = this.race, f = flySave(), rows = [['Run-up', this.sc.runup, `${this.takeKmh || 0} km/h at the ramp`], ['Wing deployment', this.sc.deploy, this.deployGrade || ''], ['Take-off', this.sc.takeoff, ''], ['Flight distance', this.sc.dist, `${Math.round(this.flown || 0)} m`], ['Rings', this.sc.rings, `${this.nRing}/${this.rings.length}`], ['Coins', this.sc.coins, `${this.nCoin}`], ['Stunts', this.sc.stunts, this.nRoll ? `${this.nRoll} barrel roll${this.nRoll > 1 ? 's' : ''}` : ''], ['Landing', this.sc.landing, this.landed ? this.landGrade.replace('!', '') : this.failMsg || '']];
    const total = Math.round(rows.reduce((a, r) => a + r[1], 0) * this.st.score), rate = FLY_RATINGS.find(r => total >= r[0]); const best = total > f.best; if (best) { f.best = total; f.rating = rate[1]; } f.runs = (f.runs || 0) + 1;
    this.result = { rows, total, rating: rate[1], color: rate[2], landed: !!this.landed && !this.crashLanding, best, coins: Math.round(total / 6) + this.nCoin * 5, msg: this.failMsg }; persist(); R.playerDone(this.result.landed ? 1 : 2); }
  // once per frame: the rig, the birds, the HUD, the camera's ease into the air
  update(dt) {
    const R = this.race, T = R.track, P = R.player, v = this._v || (this._v = new THREE.Vector3()), flying = this.phase === 'FLY' || this.phase === 'APPROACH';
    const kT = this.phase === 'LANDED' ? 0.25 : this.phase === 'CRASHED' ? 0.5 : this.flare ? 0.74 : this.k; this.kShow = smooth(this.kShow === undefined ? 0 : this.kShow, kT, 5, dt);
    this.rig.load = smooth(this.rig.load, flying ? clamp(0.5 + this.fvy * 0.05 + this.pitch, 0, 1.3) : 0, 4, dt); this.rig.roll = this.roll; this.rig.pose(dt, this.kShow); this.rig.spin(dt, P.v);
    if (this.tumble && P.air) P.rig.root.rotation.x += dt * 5;
    this.camK = smooth(this.camK, flying || this.phase === 'FALL' || (this.phase === 'CRASHED' && P.air) ? 1 : this.phase === 'LANDED' ? 0.5 : 0.28 + this.kShow * 0.3, 1.6, dt);   // (wings open on the ground: the lens already backs off to take them in)
    for (const b of this.birds) { const ds = b.s - P.dist; b.g.visible = ds < 500 && ds > -40; if (!b.g.visible) continue; b.d = this.lineD(b.s) + Math.sin(this.t * 0.55 + b.ph) * 34; b.y = this.lineY(b.s) + Math.sin(this.t * 0.8 + b.ph) * 3; T.pos(b.s, b.d, v, 0); b.g.position.set(v.x, b.y, v.z); b.g.rotation.y = T.yawAt(b.s) + (Math.cos(this.t * 0.55 + b.ph) > 0 ? -1 : 1) * Math.PI / 2; const fl = Math.sin(this.t * 9 + b.ph) * 0.5; for (const wg of b.kids) { wg[0].rotation.z = fl; wg[1].rotation.z = -fl; } }
    for (const r of this.rings) if (r === this.next) r.m.scale.setScalar(1 + Math.sin(this.t * 6) * 0.03);
    // HUD
    const E = this.el, kmh = P.v * 3.6, alt = Math.max(0, P.y - T.gy(P.s, 0)); E.fill.style.width = clamp(kmh / 130, 0, 1) * 100 + '%';
    const ws = this.phase === 'CRASHED' ? 'BROKEN' : this.phase === 'LANDED' ? 'FOLDED' : this.kShow > 0.97 ? 'OPEN' : this.dep ? 'OPENING' : kmh >= 90 && !this.launched ? 'READY' : 'FOLDED'; if (ws !== this._ws) { this._ws = ws; E.wing.querySelector('span').textContent = ws; E.wing.dataset.s = ws; }
    setText(E.alt, flying || this.phase === 'FALL' ? Math.round(alt) : 0); setText(E.dist, Math.round(Math.max(0, P.dist - this.lip))); setText(E.rings, `${this.nRing}/${this.rings.length}`); setText(E.time, (this.airT || 0).toFixed(1));
    const toRamp = this.lip - P.dist; setText(E.land, this.launched ? Math.max(0, Math.round(this.target - P.dist)) : Math.max(0, Math.round(toRamp))); if (this._lm !== this.launched) { this._lm = this.launched; $('#fLandL').textContent = this.launched ? 'LANDING' : 'RAMP'; }
    E.boost.style.width = clamp(this.boost / this.st.boost, 0, 1) * 100 + '%';
  }
  dispose() { this.rig.dispose(); this.group.removeFromParent(); for (const o of this.disp) o.dispose(); const P = this.race.player; P.gliding = false; P.flyW = 0; this.el.root.hidden = true; $('#hud').classList.remove('flymode', 'fly-air', 'fly-ready', 'fly-ground'); }
}

// ── the flying garage ──
const FLYUI = {
  render(game) {
    const f = flySave(), st = flyStats(), body = $('#flyBody'), rate = FLY_RATINGS.find(r => f.best >= r[0]);
    const pips = (n) => Array.from({ length: 4 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    const bar = (label, v) => `<div class="fg-stat"><span>${label}</span><div><i style="width:${clamp(v, 0.08, 1) * 100}%"></i></div></div>`;
    body.innerHTML = `
      <div class="fg-top"><div class="fg-plan" aria-hidden="true">${FLYUI.plan(f.build)}</div>
        <div class="fg-info"><h3>${FLY_BUILDS[f.build].name}</h3><p>${FLY_BUILDS[f.build].note}</p>
          ${bar('Lift', 1.25 - st.sink)}${bar('Thrust', st.thrust / 1.1)}${bar('Control', (st.ctrl - 0.8) / 0.6)}${bar('Boost', st.boost / 6.2)}
          <div class="fg-best"><span>BEST</span><b>${f.best ? f.best.toLocaleString() : '—'}</b>${f.best ? `<em style="color:${rate[2]}">${rate[1]}</em>` : ''}<span class="fg-coins">🪙 ${SAVE.coins.toLocaleString()}</span></div>
          <button class="btn-go fg-start" type="button" data-fly="start">TAKE OFF <small>Cliff Run · 3.2 km</small></button></div></div>
      <h4>Builds</h4><div class="fg-builds">${Object.entries(FLY_BUILDS).map(([k, b]) => `<button type="button" class="fg-build${f.build === k ? ' on' : ''}${f.own[k] ? '' : ' lock'}" data-fly="build:${k}"><span class="sw" style="background:${b.canvas};border-color:${b.frame}"></span><b>${b.name.replace(' Flyer', '').replace(' Glider', '')}</b><small>${f.own[k] ? (f.build === k ? 'Equipped' : 'Owned') : `🪙 ${b.cost.toLocaleString()}`}</small></button>`).join('')}</div>
      <h4>Workshop</h4><div class="fg-ups">${Object.entries(FLY_UP).map(([k, [n, d]]) => { const l = f.up[k] || 0, c = flyUpCost(l); return `<div class="fg-up"><div><b>${n}</b><small>${d}</small></div><span class="pips">${pips(l)}</span>${l >= 4 ? '<em>MAX</em>' : `<button type="button" data-fly="up:${k}" ${SAVE.coins < c ? 'disabled' : ''}>🪙 ${c}</button>`}</div>`; }).join('')}</div>
      <p class="fg-how"><b>How to fly:</b> build speed, open the wings at 90 km/h or more (close to the ramp is best: open wings drag on the ground), jump, then nose up to climb and nose down to gain speed. Too slow and you stall. Fly the rings, dodge the rock spires and birds, and land soft on the marked strip. <b>Keys:</b> W/S or ↑/↓ pitch, A/D steer, Space wings and barrel roll, Shift boost.</p>`;
    if (!FLYUI.bound) { FLYUI.bound = true; body.addEventListener('click', (e) => { const b = e.target.closest('[data-fly]'); if (!b) return; const [act, k] = b.dataset.fly.split(':'), f = flySave(); AUDIO.click();
        if (act === 'start') { GAME.ui.closeModal(); GAME.startFlying(); return; }
        if (act === 'up') { const l = f.up[k] || 0, c = flyUpCost(l); if (l < 4 && SAVE.coins >= c) { SAVE.coins -= c; f.up[k] = l + 1; AUDIO.pickup(); } }
        if (act === 'build') { const B = FLY_BUILDS[k]; if (f.own[k]) f.build = k; else if (SAVE.coins >= B.cost) { SAVE.coins -= B.cost; f.own[k] = true; f.build = k; AUDIO.pickup(); } else { GAME.ui.flashNote && GAME.ui.flashNote(`${B.name} costs ${B.cost.toLocaleString()} coins.`); } }
        persist(); FLYUI.render(GAME); }); }
  },
  // a little workshop drawing of the machine (the parchment detail)
  plan(build) { const B = FLY_BUILDS[build], w = 92 * (B.span || 1); const wing = (sx, y) => `<path d="M${100 + sx * 12},${y} L${100 + sx * w},${y - 14} L${100 + sx * (w - 6)},${y + 2} Q${100 + sx * (w - 22)},${y + 2} ${100 + sx * (w - 26)},${y + 13} Q${100 + sx * (w - 44)},${y + 10} ${100 + sx * (w - 50)},${y + 22} Q${100 + sx * 40},${y + 18} ${100 + sx * 30},${y + 28} Z" /><path d="M${100 + sx * 12},${y} L${100 + sx * (w - 6)},${y + 2} M${100 + sx * 12},${y} L${100 + sx * (w - 26)},${y + 13} M${100 + sx * 12},${y} L${100 + sx * (w - 50)},${y + 22}" fill="none"/>`;
    return `<svg viewBox="0 0 200 120"><g fill="rgba(120,80,40,.12)" stroke="#4a2f18" stroke-width="1.3" stroke-linejoin="round">${wing(1, 50)}${wing(-1, 50)}${B.bi ? wing(1, 28).replace(/92/g, '70') + wing(-1, 28) : ''}<circle cx="100" cy="92" r="13" fill="none"/><circle cx="100" cy="92" r="3"/><path d="M92,66 h16 l3,18 h-22 z M100,50 v-22 M100,28 L${100 + w * 0.6},42 M100,28 L${100 - w * 0.6},42" fill="none"/><circle cx="100" cy="58" r="6"/>${B.props === 2 ? '<path d="M80,76 h-10 M120,76 h10" />' : ''}</g><text x="100" y="116" text-anchor="middle" font-size="8" fill="#4a2f18" font-style="italic">bamboo · canvas · rope</text></svg>`; },
  // results: the score sheet
  results(F) { const r = F.result; return `<div class="fly-res"><div class="fr-head"><span class="fr-medal" style="--c:${r.color}">${r.rating}</span><b>${r.total.toLocaleString()}<small> pts</small></b>${r.best ? '<em>NEW BEST</em>' : ''}</div>
    <div class="fr-rows">${r.rows.map(([n, p, note]) => `<div><span>${n}${note ? `<small>${note}</small>` : ''}</span><b>${p.toLocaleString()}</b></div>`).join('')}</div></div>`; },
};
