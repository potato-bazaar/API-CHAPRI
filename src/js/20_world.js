// ───────────────────────── WORLD BUILDER ─────────────────────────
const MOODS = {
  morning: { sky: ['#6fa3d8', '#bcd6ee', '#f7e3c2'], fog: '#e8d9c3', fogNear: 90, fogFar: 620, sun: '#fff1d6', sunI: 3.4, sunDir: [0.55, 0.62, 0.35], hemiSky: '#cfe0f2', hemiGround: '#8d7a62', hemiI: 2.1, night: 0, exposure: 1.0, sunDisc: '#fff6e0' },
  golden: { sky: ['#6a3494', '#e85f9e', '#ffb36b'], fog: '#f2a682', fogNear: 80, fogFar: 560, sun: '#ffbe85', sunI: 3.4, sunDir: [-0.7, 0.32, 0.5], hemiSky: '#ffb0d0', hemiGround: '#8a6250', hemiI: 2.1, night: 0.15, exposure: 1.15, sunDisc: '#ffd59a' },
  night: { sky: ['#0a0a22', '#26205a', '#5e3a6e'], fog: '#2e2448', fogNear: 40, fogFar: 380, sun: '#b4c4ff', sunI: 1.15, sunDir: [0.3, 0.7, -0.4], hemiSky: '#6a5cb0', hemiGround: '#3a2a30', hemiI: 2.15, night: 1, exposure: 1.32, sunDisc: '#dfe6ff' },
};
const WALL_COLS = { city: ['#efe3cf', '#e8b4b8', '#9fd3c7', '#f2c46d', '#d98a6a', '#c9d1d9', '#b8a3d1', '#f5e6cc', '#7fb3a8', '#e6c9a8'], basti: ['#3e8e8a', '#c96f4a', '#e8b4b8', '#9fd3c7', '#d9c27a', '#b5a58f', '#8fb6d9', '#e09a6a', '#c9c2b5'], market: ['#e6c9a8', '#d98a6a', '#f2c46d', '#c96f4a', '#efe3cf', '#9fd3c7'] };
const SIDEWALK = { city: 3.4, market: 3.2, basti: 0.9, sea: 5.0, flyover: 2.6 };

class World {
  constructor(track, opts) {
    this.track = track; this.def = track.def; this.theme = track.def.theme; this.opts = opts;
    this.group = new THREE.Group(); this.disposables = [];
    this.obstacles = []; this.pickupSpots = []; this.lampHeads = []; this.whoosh = [];
    RNG = mulberry32(track.def.id.length * 7919 + 13);
    this.mats = this.makeMaterials();
    this.build();
  }
  makeMaterials() {
    const m = {
      road: new THREE.MeshStandardMaterial({ map: TEX.road, roughness: 0.92, metalness: 0.0, color: 0xffffff }),
      kerb: new THREE.MeshLambertMaterial({ map: TEX.kerb }),
      pave: new THREE.MeshLambertMaterial({ map: TEX.pave, vertexColors: true }),
      facade: new THREE.MeshLambertMaterial({ map: TEX.facade, vertexColors: true, emissiveMap: TEX.facadeEmit, emissive: 0x000000 }),
      basti: new THREE.MeshLambertMaterial({ map: TEX.basti, vertexColors: true }),
      shops: new THREE.MeshLambertMaterial({ map: TEX.shops, emissiveMap: TEX.shops, emissive: 0x000000 }),
      signs: new THREE.MeshLambertMaterial({ map: TEX.signs, emissiveMap: TEX.signs, emissive: 0x222222, side: THREE.DoubleSide }),
      props: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      tin: new THREE.MeshLambertMaterial({ map: TEX.tin, side: THREE.DoubleSide }),
      tarp: new THREE.MeshLambertMaterial({ map: TEX.tarp, side: THREE.DoubleSide }),
      glowBasic: new THREE.MeshBasicMaterial({ vertexColors: true }),
      ground: new THREE.MeshLambertMaterial({ map: TEX.ground }),
      marks: new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      pool: new THREE.MeshBasicMaterial({ map: TEX.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffb347, opacity: 0.0, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
    m.ground.map.repeat.set(60, 60);
    if (this.opts.quality !== 'low') { REFL.patch(m.road, 1); REFL.patch(m.marks, 0.85); REFL.patch(m.pave, 0.5); REFL.patch(m.kerb, 0.35); }   // wet-road mirror
    Object.values(m).forEach(x => this.disposables.push(x));
    return m;
  }
  build() {
    const T = this.track, th = this.theme;
    const B = { dirt: new Batch(), road: new Batch(), kerb: new Batch(), pave: new Batch(), facade: new Batch(), basti: new Batch(), shops: new Batch(), signs: new Batch(), props: new Batch(), tin: new Batch(), tarp: new Batch(), glow: new Batch(), pool: new Batch(), marks: new Batch() };
    this.B = B;
    this.buildRoad(B);
    this.buildRoadside(B);
    this.buildBuildings(B);
    this.buildSpecials(B);
    this.buildLandmark(B);
    this.buildSkyline(B);
    this.buildObstacles(B);
    this.buildShortcuts(B);
    this.buildSetPieces(B);
    if (this.def.underground) this.buildUnderground(B);
    this.buildStreet(B);
    this.buildSpeedClutter(B);
    this.buildMarkings(B);
    this.whoosh.sort((a, b) => a.s - b.s);
    this.placePickups();
    this.buildHazards();
    const add = (b, mat, o) => { const m = b.mesh(mat, o); if (m) { this.group.add(m); this.disposables.push(m.geometry); } return m; };
    this.roadMesh = add(B.road, this.mats.road, { receive: true });
    if (B.dirt.n) { this.dirtRoadMat = new THREE.MeshLambertMaterial({ map: TEX.dirt, color: '#d9c3a0', vertexColors: true }); this.disposables.push(this.dirtRoadMat); this.dirtRoad = add(B.dirt, this.dirtRoadMat, { receive: true }); }
    add(B.kerb, this.mats.kerb, { receive: true });
    add(B.pave, this.mats.pave, { receive: true });
    add(B.facade, this.mats.facade, { receive: true });
    add(B.basti, this.mats.basti, { receive: true });
    add(B.shops, this.mats.shops);
    add(B.signs, this.mats.signs);
    add(B.props, this.mats.props, { cast: true, receive: true });
    add(B.tin, this.mats.tin, { receive: true });
    add(B.tarp, this.mats.tarp);
    add(B.glow, this.mats.glowBasic);
    this.marksMesh = add(B.marks, this.mats.marks, { receive: true });
    this.poolMesh = add(B.pool, this.mats.pool);
    // ground
    const sea = this.def.sea;
    const gw = 3200, gx0 = sea ? sea.x - 2 : -gw / 2, gx1 = gw / 2;
    const gg = new THREE.PlaneGeometry(gx1 - gx0, gw); gg.rotateX(-Math.PI / 2); gg.translate((gx0 + gx1) / 2 + T.cx, -0.06, T.cz);
    const ground = new THREE.Mesh(gg, this.mats.ground); ground.receiveShadow = true; this.group.add(ground); this.disposables.push(gg);
    if (sea) this.buildSea(sea);
    this.buildSky();
    this.buildLampGlows();
    this.buildLights();
  }
  // ── road, kerbs, sidewalks / parapets ──
  buildRoad(B) {
    const T = this.track, sw = SIDEWALK[this.theme];
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    const rows = []; const bumpZones = T.bumps.map(b => [b.s - b.len, b.s + b.len]);
    if (T.roof) for (const g of T.roof.gaps) bumpZones.push([T.roof.s0 + g.x0 - 1, T.roof.s0 + g.x0 + g.len + 1]);
    for (let s = 0; s < T.L - 1e-6;) { rows.push(s); const inBump = bumpZones.some(([a, b]) => s > a - 2 && s < b + 2); s += inBump ? 0.25 : 2; }
    rows.push(T.L);
    const white = new THREE.Color('#ffffff'), paveC = new THREE.Color('#ffffff'), curbC = new THREE.Color('#bdb3a6');
    const concrete = new THREE.Color('#a59a90'), concreteDark = new THREE.Color('#6d655f');
    this.cx = 0; this.cz = 0;
    for (let r = 0; r < rows.length - 1; r++) {
      const s0 = rows[r], s1 = rows[r + 1];
      const w0 = T.wAt(s0) / 2, w1 = T.wAt(s1) / 2, y0 = T.yAt(s0), y1 = T.yAt(s1);
      if (Math.abs(y1 - y0) > 1.2) continue;   // rooftop gap edge
      if (T.stairsZone(s0) && T.stairsZone(s1)) continue;   // the seedhi builds its own steps
      // road surface (u: 0 right edge → 1 left edge; v: 12 m per tile)
      if (T.ug && T.dirtAt(s0) && T.dirtAt(s1)) {   // kachha: one wide earth strip, the edges rough and a little raised
        const e0 = w0 + 2.6, e1 = w1 + 2.6; T.pos(s0, -e0, pA, -0.02); T.pos(s1, -e1, pB, -0.02); T.pos(s1, e1, pC, -0.02); T.pos(s0, e0, pD, -0.02);
        B.dirt.quad(pA, pB, pC, pD, white, [[0, s0 / 6], [0, s1 / 6], [e0 / 3, s1 / 6], [e0 / 3, s0 / 6]], UP);
        for (const side of [-1, 1]) { T.pos(s0, side * e0, pA, -0.02); T.pos(s1, side * e1, pB, -0.02); T.pos(s1, side * (e1 + 1.6), pC, 0.28); T.pos(s0, side * (e0 + 1.6), pD, 0.28); B.dirt.quad(pA, pB, pC, pD, '#b8a080', [[0, s0 / 6], [0, s1 / 6], [0.5, s1 / 6], [0.5, s0 / 6]]); }
        continue;
      }
      T.pos(s0, -w0, pA, 0.0); T.pos(s1, -w1, pB, 0.0); T.pos(s1, w1, pC, 0.0); T.pos(s0, w0, pD, 0.0);
      B.road.quad(pA, pB, pC, pD, white, [[0, s0 / 12], [0, s1 / 12], [1, s1 / 12], [1, s0 / 12]], UP);
      const elevated = Math.max(y0, y1) > 1.2;
      for (const side of [-1, 1]) {
        // kerb strip
        T.pos(s0, side * w0, pA, 0.0); T.pos(s1, side * w1, pB, 0.0); T.pos(s1, side * (w1 + 0.45), pC, 0.1); T.pos(s0, side * (w0 + 0.45), pD, 0.1);
        B.kerb.quad(pA, pB, pC, pD, white, [[0, s0 / 2], [0, s1 / 2], [1, s1 / 2], [1, s0 / 2]], UP);
        if (!elevated) {
          // curb face + sidewalk
          T.pos(s0, side * (w0 + 0.45), pA, 0.1); T.pos(s1, side * (w1 + 0.45), pB, 0.1); T.pos(s1, side * (w1 + 0.45), pC, 0.18); T.pos(s0, side * (w0 + 0.45), pD, 0.18);
          B.pave.quad(pA, pB, pC, pD, curbC, [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
          const o0 = w0 + 0.45 + sw, o1 = w1 + 0.45 + sw;
          T.pos(s0, side * (w0 + 0.45), pA, 0.18); T.pos(s1, side * (w1 + 0.45), pB, 0.18); T.pos(s1, side * o1, pC, 0.18); T.pos(s0, side * o0, pD, 0.18);
          B.pave.quad(pA, pB, pC, pD, paveC, [[0, s0 / 3], [0, s1 / 3], [sw / 3, s1 / 3], [sw / 3, s0 / 3]], UP);
          T.pos(s0, side * o0, pA, 0.18); T.pos(s1, side * o1, pB, 0.18); T.pos(s1, side * o1, pC, -0.06); T.pos(s0, side * o0, pD, -0.06);
          B.pave.quad(pA, pB, pC, pD, curbC, [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
        } else {
          // parapet wall on elevated deck
          const o0 = w0 + 0.45, o1 = w1 + 0.45;
          T.pos(s0, side * o0, pA, 0.1); T.pos(s1, side * o1, pB, 0.1); T.pos(s1, side * o1, pC, 1.15); T.pos(s0, side * o0, pD, 1.15);
          B.props.quad(pA, pB, pC, pD, concrete);
          T.pos(s0, side * (o0 + 0.35), pA, 1.15); T.pos(s1, side * (o1 + 0.35), pB, 1.15); T.pos(s1, side * (o1 + 0.35), pC, -0.9); T.pos(s0, side * (o0 + 0.35), pD, -0.9);
          B.props.quad(pA, pB, pC, pD, concreteDark);
          T.pos(s0, side * o0, pA, 1.15); T.pos(s1, side * o1, pB, 1.15); T.pos(s1, side * (o1 + 0.35), pC, 1.15); T.pos(s0, side * (o0 + 0.35), pD, 1.15);
          B.props.quad(pA, pB, pC, pD, concrete, undefined, UP);
        }
      }
      if (elevated) { // deck underside
        T.pos(s0, -w0 - 0.8, pA, -0.9); T.pos(s1, -w1 - 0.8, pB, -0.9); T.pos(s1, w1 + 0.8, pC, -0.9); T.pos(s0, w0 + 0.8, pD, -0.9);
        B.props.quad(pA, pB, pC, pD, concreteDark);
      }
    }
    // pillars under elevated sections
    for (let s = 0; s < T.L; s += 22) {
      const y = T.yAt(s); if (y < 2.2 || (T.roof && T.roofRaw(s) > 0 && T.roof.style !== 'bridge') || T.stairsZone(s) || (T.rail && Math.abs(T.wrapD(s - T.rail.s)) < 8)) continue;
      const p = T.pos(s, 0, new THREE.Vector3()); const yaw = T.yawAt(s);
      B.props.box(p.x, -0.05, p.z, 2.2, y - 0.85, 1.6, yaw, '#9a8f86');
      B.props.box(p.x, y - 1.6, p.z, T.wAt(s) + 1.2, 0.75, 1.9, yaw, '#8a8079');
    }
    // track centre for ground placement
    let cx = 0, cz = 0; for (let i = 0; i < T.N; i += 10) { cx += T.px[i]; cz += T.pz[i]; } cx /= T.N / 10; cz /= T.N / 10; T.cx = cx; T.cz = cz;
    let R = 0; for (let i = 0; i < T.N; i += 10) R = Math.max(R, Math.hypot(T.px[i] - cx, T.pz[i] - cz)); T.R = R;
    // bump visuals
    for (const b of T.bumps) this.buildBump(B, b);
    // start line + grid marks
    for (let k = 0; k < 2; k++) {
      const s0 = k * 0.9, s1 = s0 + 0.9; const w = T.wAt(0) / 2; const n = Math.max(4, Math.round(w * 2 / 1.5));
      for (let i = 0; i < n; i++) { const d0 = -w + (i / n) * w * 2, d1 = -w + ((i + 1) / n) * w * 2; if ((i + k) % 2) continue;
        T.pos(s0, d0, pA, 0.015); T.pos(s1, d0, pB, 0.015); T.pos(s1, d1, pC, 0.015); T.pos(s0, d1, pD, 0.015); B.glow.quad(pA, pB, pC, pD, new THREE.Color('#f4f4f4'), undefined, UP); }
      T.pos(s0, -w, pA, 0.012); T.pos(s1, -w, pB, 0.012); T.pos(s1, w, pC, 0.012); T.pos(s0, w, pD, 0.012); B.glow.quad(pA, pB, pC, pD, new THREE.Color('#151515'), undefined, UP);
    }
  }
  buildBump(B, b) {
    const T = this.track, pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    const s0 = b.s - b.len / 2, s1 = b.s + b.len / 2;
    if (b.type === 'breaker') {
      for (let s = s0; s < s1 - 0.01; s += 0.25) { const w = T.wAt(s) / 2, vv = w * 2 / 1.5;
        T.pos(s, -w, pA, 0.02); T.pos(s + 0.25, -w, pB, 0.02); T.pos(s + 0.25, w, pC, 0.02); T.pos(s, w, pD, 0.02);
        B.kerb.quad(pA, pB, pC, pD, '#ffffff', [[0, 0], [0.2, 0], [0.2, vv], [0, vv]], UP);
      }
    } else if (b.type === 'ramp') {
      for (let s = s0; s < s1 - 0.01; s += 0.5) { const w = T.wAt(s) / 2 - 0.4;
        T.pos(s, -w, pA, 0.03); T.pos(s + 0.5, -w, pB, 0.03); T.pos(s + 0.5, w, pC, 0.03); T.pos(s, w, pD, 0.03);
        B.tin.quad(pA, pB, pC, pD, '#ffffff', [[0, s / 2], [0, (s + 0.5) / 2], [w, (s + 0.5) / 2], [w, s / 2]], UP); }
      const w = T.wAt(s1) / 2 - 0.4; T.pos(s1, -w, pA, 0); T.pos(s1, w, pB, 0); T.pos(s1, w, pC, -b.h); T.pos(s1, -w, pD, -b.h);
      B.tin.quad(pA, pB, pC, pD, '#ffffff', [[0, 0], [w, 0], [w, 0.5], [0, 0.5]]);
      // warning boards
      for (const side of [-1, 1]) { const p = T.pos(s0 - 6, side * (T.wAt(s0) / 2 + 0.9), new THREE.Vector3()); this.signBoard(B, 'arrow', p.x, p.y + 1.0, p.z, T.yawAt(s0) + Math.PI, 2.2, p.y); }
    } else if (b.type === 'bridge') {
      // nullah channel under a hump bridge, with railings
      const pc = T.pos(b.s, 0, new THREE.Vector3()); const yaw = T.yawAt(b.s);
      const across = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), along = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      for (const side of [-1, 1]) {
        const c0 = pc.clone().addScaledVector(across, side * (T.wAt(b.s) / 2 + 1)), c1 = pc.clone().addScaledVector(across, side * 40);
        const hw = b.len * 0.42;
        const a = c0.clone().addScaledVector(along, -hw), bb = c0.clone().addScaledVector(along, hw), cc = c1.clone().addScaledVector(along, hw), dd = c1.clone().addScaledVector(along, -hw);
        [a, bb, cc, dd].forEach(v => (v.y = 0.02));
        B.glow.quad(a, bb, cc, dd, new THREE.Color('#3b4a3a'), undefined, UP);
      }
      for (let s = s0; s < s1; s += 0.5) for (const side of [-1, 1]) { const p = T.pos(s, side * (T.wAt(s) / 2 + 0.25), new THREE.Vector3()); B.props.box(p.x, p.y, p.z, 0.08, 1.0, 0.08, T.yawAt(s), '#3e8e8a'); }
      for (const side of [-1, 1]) for (let s = s0; s < s1; s += 0.5) { const p0 = T.pos(s, side * (T.wAt(s) / 2 + 0.25), new THREE.Vector3(), 1.0), p1 = T.pos(s + 0.5, side * (T.wAt(s) / 2 + 0.25), new THREE.Vector3(), 1.0); this.beam(B.props, p0, p1, 0.06, '#3e8e8a'); }
    }
  }
  beam(batch, p0, p1, t, color) { const len = p0.distanceTo(p1); if (len < 1e-3) return; const mid = p0.clone().add(p1).multiplyScalar(0.5); _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p1.clone().sub(p0).normalize()); _mat.compose(mid, _q, _v.set(t, t, len)); batch.add(UNIT_BOX, _mat, new THREE.Color(color)); }
  // Board facing direction yaw (seen correctly by a viewer standing in front of it). groundY → adds two posts.
  signBoard(B, name, x, y, z, yaw, w, groundY = null) {
    const uv = SIGN_UV[name]; const h = w / uv[4];
    this.facing(B.signs, new THREE.Vector3(x, y, z), yaw, w, y, y + h, [uv[0], uv[1], uv[2], uv[3]]);
    if (groundY !== null) { const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); for (const s of [-1, 1]) { const p = new THREE.Vector3(x, y, z).addScaledVector(l, s * w * 0.38); B.props.box(p.x, groundY, p.z, 0.08, y - groundY + 0.05, 0.08, yaw, '#555'); } }
    return h;
  }
  facing(batch, c, yaw, w, y0, y1, r) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const a = c.clone().addScaledVector(l, -w / 2).setY(y0), b = c.clone().addScaledVector(l, w / 2).setY(y0), cc = b.clone().setY(y1), d = a.clone().setY(y1);
    batch.quad(a, b, cc, d, '#ffffff', [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], f);
  }
  // ── sidewalk furniture: lamps, trees, palms, autos, benches, railings ──
  buildRoadside(B) {
    const T = this.track, th = this.theme, sw = SIDEWALK[th];
    const p = new THREE.Vector3();
    const lampEvery = th === 'basti' ? 22 : 26;
    let side = 1;
    for (let s = 12; s < T.L - 6; s += lampEvery) {
      if (T.hallAt(s) || (this.ugSkip && this.ugSkip(s, 'lamp'))) continue;
      side = -side; const w = T.wAt(s) / 2; const y = T.yAt(s); const yaw = T.yawAt(s); const elevated = y > 1.2;
      const off = elevated ? w + 0.6 : w + (th === 'basti' ? 0.7 : 1.0);
      T.pos(s, side * off, p);
      const H = th === 'basti' ? 5.5 : 7.5;
      if (th === 'basti') { // lamp on a wall bracket / wooden pole
        B.props.box(p.x, p.y, p.z, 0.16, H, 0.16, yaw, '#5a4636');
      } else { B.props.box(p.x, p.y, p.z, 0.2, H, 0.2, yaw, '#3a3a40'); B.props.box(p.x, p.y, p.z, 0.4, 0.6, 0.4, yaw, '#2a2a2e'); }
      const arm = th === 'basti' ? 0.8 : 1.8; const pa = T.pos(s, side * (off - arm), new THREE.Vector3());
      pa.y = p.y + H - 0.15;
      this.beam(B.props, new THREE.Vector3(p.x, p.y + H - 0.15, p.z), pa, 0.1, '#3a3a40');
      B.glow.box(pa.x, pa.y - 0.25, pa.z, 0.5, 0.18, 0.28, yaw, '#ffd9a0');
      this.lampHeads.push(pa.clone().setY(pa.y - 0.2)); this.whoosh.push({ s, d: side * off, k: 'pole' });
      // pool of light on road
      const pc = T.pos(s, side * (off - arm), new THREE.Vector3(), 0.03); const r = 6.5;
      const a = new THREE.Vector3(pc.x - r, pc.y, pc.z - r), b = new THREE.Vector3(pc.x + r, pc.y, pc.z - r), c = new THREE.Vector3(pc.x + r, pc.y, pc.z + r), d = new THREE.Vector3(pc.x - r, pc.y, pc.z + r);
      B.pool.quad(a, b, c, d, '#ffffff', [[0, 0], [1, 0], [1, 1], [0, 1]], UP);
    }
    // trees / palms
    if (th === 'city' || th === 'sea' || th === 'market') {
      for (let s = 28; s < T.L - 10; s += th === 'sea' ? 18 : 46) for (const sd of [-1, 1]) {
        if (RNG() < (th === 'sea' ? 0.15 : 0.45)) continue;
        const w = T.wAt(s) / 2; if (T.yAt(s) > 1 || T.hallAt(s) || (this.ugSkip && this.ugSkip(s, 'tree'))) continue;
        const off = w + 0.45 + Math.min(sw - 0.6, th === 'sea' ? 2.5 : 2.3); T.pos(s, sd * off, p);
        if (this.isSea(p.x) && th !== 'sea') continue;
        if (th === 'sea' || RNG() < 0.35) this.palm(B, p.x, p.y, p.z, 7 + RNG() * 4); else this.tree(B, p.x, p.y, p.z, 5 + RNG() * 3);
      }
    }
    // sea promenade railing + tetrapods on the sea side
    if (this.def.sea) {
      for (let s = 0; s < T.L; s += 2) for (const sd of [-1, 1]) {
        const w = T.wAt(s) / 2; const q = T.pos(s, sd * (w + 0.45 + sw), new THREE.Vector3()); if (!this.isSea(q.x - 12)) continue;
        const q1 = T.pos(s + 2, sd * (T.wAt(s + 2) / 2 + 0.45 + sw), new THREE.Vector3());
        B.props.box(q.x, q.y, q.z, 0.08, 1.0, 0.08, T.yawAt(s), '#e8e2d6');
        this.beam(B.props, q.clone().setY(q.y + 0.95), q1.clone().setY(q1.y + 0.95), 0.07, '#e8e2d6');
        this.beam(B.props, q.clone().setY(q.y + 0.5), q1.clone().setY(q1.y + 0.5), 0.05, '#e8e2d6');
        if (s % 4 === 0) { const t = T.pos(s, sd * (w + 0.45 + sw + 2 + RNG() * 3), new THREE.Vector3()); B.props.geom(TETRA, t.x, -0.2, t.z, RNG() * 6, 1.4, 1.4, 1.4, '#8f8a84', RNG(), RNG()); }
      }
    }
    // parked autos & cycles on the sidewalk
    if (th !== 'sea') for (let s = 70; s < T.L - 40; s += 140 + RNG() * 80) { const sd = RNG() < 0.5 ? -1 : 1; if (T.yAt(s) > 1 || sw < 2 || (this.ugSkip && this.ugSkip(s, 'auto'))) continue; T.pos(s, sd * (T.wAt(s) / 2 + 1.6), p); this.auto(B, p.x, p.y + 0.18, p.z, T.yawAt(s) + (RNG() < 0.5 ? 0 : Math.PI), RNG() < 0.5 ? 'kaali' : 'cng'); }
  }
  isSea(x) { return this.def.sea && x < this.def.sea.x; }
  tree(B, x, y, z, h) { const ry = RNG() * 3; B.props.box(x, y, z, 0.35, h * 0.55, 0.35, ry, '#5a3e2a'); B.props.box(x, y, z, 0.38, 0.85, 0.38, ry, '#f2eee4'); B.props.box(x, y + 0.85, z, 0.39, 0.16, 0.39, ry, '#c8201e'); /* trunks painted white and red, Indian roadside style */ const g = ['#3f6b2f', '#4f7d35', '#2f5a28']; for (let i = 0; i < 4; i++) B.props.geom(BLOB, x + (RNG() - 0.5) * 2, y + h * (0.6 + RNG() * 0.3), z + (RNG() - 0.5) * 2, RNG() * 6, 1.6 + RNG(), 1.3 + RNG() * 0.6, 1.6 + RNG(), pick(g)); }
  palm(B, x, y, z, h) {
    const lean = (RNG() - 0.5) * 0.3, dir = RNG() * 6; let px = x, pz = z, py = y;
    for (let i = 0; i < 6; i++) { const nx = px + Math.cos(dir) * lean * h / 6, nz = pz + Math.sin(dir) * lean * h / 6, ny = py + h / 6; this.beam(B.props, new THREE.Vector3(px, py, pz), new THREE.Vector3(nx, ny, nz), 0.32 - i * 0.025, i % 2 ? '#7a5a3a' : '#8a6a46'); px = nx; py = ny; pz = nz; }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + RNG() * 0.3; B.props.geom(FROND, px, py, pz, a, 1, 1, 1 + RNG() * 0.3, pick(['#2f7a3a', '#3f8a3a', '#2a6a32']), 0.35 + RNG() * 0.35); }
  }
  auto(B, x, y, z, yaw, kind) {
    const body = kind === 'cng' ? '#2f8a3e' : '#141414', top = kind === 'cng' ? '#f2c21a' : '#f2c21a';
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    B.props.box(x, y + 0.3, z, 1.3, 0.75, 2.6, yaw, body);
    B.props.box(x + f.x * 0.2, y + 1.05, z + f.z * 0.2, 1.3, 0.12, 2.0, yaw, top);
    B.props.box(x + f.x * 0.2, y + 1.17, z + f.z * 0.2, 1.36, 0.45, 2.1, yaw, top);
    B.props.box(x + f.x * 1.05, y + 0.6, z + f.z * 1.05, 1.2, 0.6, 0.15, yaw, '#7fa7c0');
    for (const [dx, dz] of [[0, 1.05], [-0.62, -0.8], [0.62, -0.8]]) { const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); B.props.geom(WHEEL_G, x + f.x * dz + l.x * dx, y + 0.22, z + f.z * dz + l.z * dx, yaw, 1, 1, 1, '#1a1a1a'); }
  }
  // ── buildings along both sides ──
  buildBuildings(B) {
    const T = this.track, th = this.theme, sw = SIDEWALK[th];
    const tier = this.opts.quality;
    for (const side of [-1, 1]) {
      let s = 0;
      while (s < T.L) {
        const frontage = th === 'basti' ? 4 + RNG() * 4 : th === 'market' ? 6 + RNG() * 6 : 8 + RNG() * 8;
        const sc = s + frontage / 2; const y = T.yAt(sc);
        if (this.ugSkip && (this.ugSkip(sc, 'building') || this.ugSkip(sc - frontage / 2, 'building') || this.ugSkip(sc + frontage / 2, 'building'))) { s += frontage; continue; }
        const gap = th === 'basti' ? 0.15 : 0.6 + RNG() * 1.2;
        if (RNG() < 0.06 && th !== 'sea') { // alley with barricade
          const w = T.wAt(sc) / 2, p = T.pos(sc, side * (w + 0.45 + sw + 1.2), new THREE.Vector3());
          if (y < 1 && T.clearance(p.x, p.z) > 0.8) { this.barricade(B, p.x, p.y + (th === 'basti' ? 0 : 0.18), p.z, T.yawAt(sc)); }
          s += 5; continue;
        }
        const depth = th === 'basti' ? 5 + RNG() * 3 : 9 + RNG() * 7;
        let h = th === 'city' ? 9 + RNG() * 20 : th === 'market' ? 7 + RNG() * 9 : th === 'basti' ? 2.8 + RNG() * 1.0 : th === 'sea' ? 18 + RNG() * 26 : 6 + RNG() * 10;
        const inHall = !!(T.halls.length && (T.hallAt(sc) || T.hallAt(sc - frontage / 2) || T.hallAt(sc + frontage / 2)));
        const setback = y > 1.2 ? 9 : inHall ? 0.9 : 0;
        const off = T.wAt(sc) / 2 + 0.45 + sw + depth / 2 + 0.15 + setback;
        const c = T.pos(sc, side * off, new THREE.Vector3()); c.y = 0;
        const yaw = T.yawAt(sc);
        if (this.isSea(c.x + 12) || this.isSea(c.x - 12)) { s += frontage; continue; }
        if (!this.footprintOK(c, yaw, frontage, depth, sw + 0.2)) { s += Math.max(3, frontage * 0.5); continue; }
        if (th === 'basti') this.bastiHouse(B, c, yaw, frontage, depth, h, side, inHall);
        else this.cityBuilding(B, c, yaw, frontage, depth, h, side, th, inHall);   // beside a hall: blank wall, no shopfronts poking through
        // second row behind (taller) for a fuller skyline
        if ((th === 'city' || th === 'sea' || th === 'market') && tier !== 'low' && RNG() < 0.7) {
          const d2 = 10 + RNG() * 8, h2 = h + 6 + RNG() * 20, c2 = T.pos(sc, side * (off + depth / 2 + d2 / 2 + 4), new THREE.Vector3()); c2.y = 0;
          if (!this.isSea(c2.x + 12) && this.footprintOK(c2, yaw, frontage, d2, sw + depth)) this.cityBuilding(B, c2, yaw, frontage * 0.9, d2, h2, side, th, true);
        }
        if (th === 'basti' && RNG() < 0.8) { // dense second ring of shacks
          const d2 = 5 + RNG() * 3, c2 = T.pos(sc, side * (off + depth / 2 + d2 / 2 + 0.3), new THREE.Vector3()); c2.y = 0;
          if (this.footprintOK(c2, yaw, frontage, d2, depth)) this.bastiHouse(B, c2, yaw, frontage, d2, 2.8 + RNG() * 4, side, true);
        }
        s += frontage + gap;
      }
    }
    // basti: laundry lines + overhead wires across the lane
    if (th === 'basti' || th === 'market') {
      const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
      for (let s = 10; s < T.L; s += th === 'basti' ? 16 + RNG() * 14 : 40 + RNG() * 30) {
        if (T.yAt(s) > 0.5 || T.hallAt(s)) continue; const w = T.wAt(s) / 2 + 0.45 + sw;
        const hy = th === 'basti' ? 3.6 + RNG() * 1.2 : 5 + RNG();
        T.pos(s, -w - 0.2, p0, hy); T.pos(s + (RNG() - 0.5) * 2, w + 0.2, p1, hy + (RNG() - 0.5) * 0.6);
        this.beam(B.props, p0, p1, 0.025, '#222');
        if (RNG() < 0.8) { const n = 3 + Math.floor(RNG() * 5); for (let i = 0; i < n; i++) { const t = (i + 0.5 + (RNG() - 0.5) * 0.4) / n; const q = p0.clone().lerp(p1, t); q.y -= Math.sin(t * Math.PI) * 0.25; const yaw = T.yawAt(s) + Math.PI / 2; const cw = 0.4 + RNG() * 0.4, ch = 0.5 + RNG() * 0.5; const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); const a = q.clone().addScaledVector(l, -cw / 2), b = q.clone().addScaledVector(l, cw / 2), c = b.clone().setY(q.y - ch), d = a.clone().setY(q.y - ch); B.props.quad(a, b, c, d, pick(['#ff2e88', '#ffd23f', '#3fd0c9', '#ffffff', '#e84a5f', '#7b2cbf', '#1d6fb8', '#ff7a2f'])); } }
        // wires
        for (let k = 0; k < 2; k++) { T.pos(s + 3 + k, -w, p0, 6 + k * 0.6); T.pos(s + 1 + k, w, p1, 6.4 + k * 0.4); this.beam(B.props, p0, p1, 0.03, '#1a1a1a'); }
      }
    }
  }
  // the railway corridor under the flyover stays clear of buildings: does a footprint's along-rail extent overlap it?
  railBlocks(c, f, l, F, D) {
    const R = this.track.rail; if (!R) return false;
    if (!this._rail) { const T = this.track, q = T.pos(R.s, 0, new THREE.Vector3(), 0), yaw = T.yawAt(R.s); this._rail = { x: q.x, z: q.z, ax: Math.sin(yaw), az: Math.cos(yaw), cx: Math.cos(yaw), cz: -Math.sin(yaw) }; }
    const K = this._rail; let lo = 1e9, hi = -1e9, alo = 1e9, ahi = -1e9;
    for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) { const x = c.x + f.x * F * a + l.x * D * b - K.x, z = c.z + f.z * F * a + l.z * D * b - K.z;
      const u = x * K.ax + z * K.az, v = x * K.cx + z * K.cz; lo = Math.min(lo, u); hi = Math.max(hi, u); alo = Math.min(alo, v); ahi = Math.max(ahi, v); }
    return hi > -8 && lo < 8 && ahi > -340 && alo < 340;
  }
  footprintOK(c, yaw, F, D, minClear) {
    const T = this.track; const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    if (this.railBlocks(c, f, l, F, D)) return false;
    for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, -0.5], [0, 0.5], [-0.5, 0], [0.5, 0], [0, 0]]) {
      const x = c.x + f.x * F * a + l.x * D * b, z = c.z + f.z * F * a + l.z * D * b; if (T.clearance(x, z) < minClear) return false;
    }
    return true;
  }
  wallBox(batch, c, yaw, F, D, H, color, tile, roadSide, uOff = 0, y0 = 0) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const cl = new THREE.Color(color);
    const corner = (a, b, y) => new THREE.Vector3(c.x + f.x * F * a + l.x * D * b, y, c.z + f.z * F * a + l.z * D * b);
    const faces = [[[-0.5, -0.5], [0.5, -0.5], F, l.clone().negate()], [[0.5, 0.5], [-0.5, 0.5], F, l], [[0.5, -0.5], [0.5, 0.5], D, f], [[-0.5, 0.5], [-0.5, -0.5], D, f.clone().negate()]];
    for (const [A, Bc, len, out] of faces) {
      const a = corner(A[0], A[1], y0), b = corner(Bc[0], Bc[1], y0), cc = corner(Bc[0], Bc[1], y0 + H), d = corner(A[0], A[1], y0 + H);
      const u0 = uOff, u1 = uOff + len / tile, v0 = y0 / tile, v1 = (y0 + H) / tile;
      const shade = out.dot(l) * -0.5 + 0.5; const fc = cl.clone().multiplyScalar(0.86 + 0.14 * Math.abs(out.x));
      batch.quad(a, b, cc, d, fc, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], out);
    }
    const r = [corner(-0.5, -0.5, y0 + H), corner(0.5, -0.5, y0 + H), corner(0.5, 0.5, y0 + H), corner(-0.5, 0.5, y0 + H)];
    batch.quad(r[0], r[1], r[2], r[3], cl.clone().multiplyScalar(0.55), [[0.004, 0.996], [0.006, 0.996], [0.006, 0.998], [0.004, 0.998]], UP);
    return { f, l };
  }
  cityBuilding(B, c, yaw, F, D, H, side, th, back = false) {
    const color = pick(WALL_COLS[th === 'sea' ? 'city' : th] || WALL_COLS.city);
    const { f, l } = this.wallBox(B.facade, c, yaw, F, D, H, color, 12, side, RNG() * 4);
    const road = l.clone().multiplyScalar(-side); // direction from building toward road
    if (back) { if (RNG() < 0.5) this.roofStuff(B, c, yaw, F, D, H); return; }
    // ground-floor shops on the road face
    const face = c.clone().addScaledVector(road, D / 2 + 0.04);
    const nShops = Math.max(1, Math.round(F / 7));
    for (let i = 0; i < nShops; i++) {
      const w = F / nShops; const off = -F / 2 + w * (i + 0.5);
      const cell = Math.floor(RNG() * 16); const cu = (cell % 4) / 4, cv = 1 - (Math.floor(cell / 4) + 1) / 4;
      const along = f.clone().multiplyScalar(off); const half = f.clone().multiplyScalar(w / 2 - 0.1);
      this.facing(B.shops, face.clone().add(along), Math.atan2(road.x, road.z), w - 0.2, 0.18, 3.4, [cu, cv, cu + 0.25, cv + 0.25]);
      if (th === 'market' || RNG() < 0.35) { // awning
        const a2 = face.clone().add(along).addScaledVector(half, 1).setY(3.5), b2 = face.clone().add(along).addScaledVector(half, -1).setY(3.5);
        const c2 = b2.clone().addScaledVector(road, 2.2).setY(2.75), d2 = a2.clone().addScaledVector(road, 2.2).setY(2.75);
        B.props.quad(a2, b2, c2, d2, pick(['#ff2e88', '#ffc21a', '#1d6fb8', '#3e8e8a', '#e84a5f', '#ff7a2f']));
      }
    }
    // balconies
    if (th === 'city' && RNG() < 0.5) for (let y = 6; y < H - 2; y += 3) { const p = face.clone().addScaledVector(road, 0.5); B.props.box(p.x, y - 0.1, p.z, F * 0.85 * Math.abs(f.z) + 1.0 * Math.abs(f.x) * 0, 0.12, 1, yaw, '#d8cfc2', undefined); }
    this.roofStuff(B, c, yaw, F, D, H);
  }
  roofStuff(B, c, yaw, F, D, H) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    if (RNG() < 0.7) { const p = c.clone().addScaledVector(f, (RNG() - 0.5) * F * 0.6).addScaledVector(l, (RNG() - 0.5) * D * 0.5); B.props.geom(TANK_G, p.x, H, p.z, 0, 1.1, 1.3, 1.1, pick(['#1b1b1b', '#1d4fa0', '#1b1b1b'])); }
    if (RNG() < 0.4) { const p = c.clone().addScaledVector(f, (RNG() - 0.5) * F * 0.6); B.props.box(p.x, H, p.z, 0.08, 1.4, 0.08, 0, '#555'); B.props.geom(DISH_G, p.x, H + 1.4, p.z, RNG() * 6, 1, 1, 1, '#dcdcdc', 0.6); }
    if (RNG() < 0.25) { this.signBoard(B, RNG() < 0.5 ? 'bill1' : 'bill2', c.x, H + 0.4, c.z, yaw + (RNG() < 0.5 ? 0 : Math.PI), 8); }
  }
  bastiHouse(B, c, yaw, F, D, H, side, back = false) {
    const color = pick(WALL_COLS.basti);
    const { f, l } = this.wallBox(B.basti, c, yaw, F, D, H, color, 6, side, RNG() * 2);
    let top = H;
    if (RNG() < 0.6) { // stacked upper floor
      const F2 = F * (0.7 + RNG() * 0.3), D2 = D * (0.7 + RNG() * 0.25), H2 = 2.4 + RNG() * 0.6;
      const c2 = c.clone().addScaledVector(f, (RNG() - 0.5) * (F - F2)).addScaledVector(l, side * (D - D2) / 2 * RNG());
      this.wallBox(B.basti, c2, yaw, F2, D2, H2, pick(WALL_COLS.basti), 6, side, RNG() * 2, H);
      top = H + H2; this.tinRoof(B, c2, yaw, F2 + 0.4, D2 + 0.4, top, RNG() < 0.25);
      if (RNG() < 0.35) { const p = c2.clone(); B.props.geom(TANK_G, p.x, top + 0.3, p.z, 0, 0.8, 0.9, 0.8, pick(['#1b1b1b', '#1d4fa0'])); }
    } else this.tinRoof(B, c, yaw, F + 0.4, D + 0.4, top, RNG() < 0.25);
    if (!back && RNG() < 0.35) { // shop board / poster on lane face
      const road = l.clone().multiplyScalar(-side); const p = c.clone().addScaledVector(road, D / 2 + 0.05);
      this.signBoard(B, pick(['paan', 'posters', 'graffiti2']), p.x, 1.2, p.z, Math.atan2(road.x, road.z), Math.min(F * 0.8, 3.2));
    }
  }
  tinRoof(B, c, yaw, F, D, y, tarp) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const tilt = 0.35 + RNG() * 0.3;
    const a = c.clone().addScaledVector(f, -F / 2).addScaledVector(l, -D / 2).setY(y + tilt), b = c.clone().addScaledVector(f, F / 2).addScaledVector(l, -D / 2).setY(y + tilt);
    const cc = c.clone().addScaledVector(f, F / 2).addScaledVector(l, D / 2).setY(y), d = c.clone().addScaledVector(f, -F / 2).addScaledVector(l, D / 2).setY(y);
    (tarp ? B.tarp : B.tin).quad(a, b, cc, d, '#ffffff', [[0, 0], [F / 2, 0], [F / 2, D / 2], [0, D / 2]], UP);
    if (RNG() < 0.5) for (let i = 0; i < 3; i++) { const p = a.clone().lerp(cc, RNG()); B.props.box(p.x, p.y - 0.05, p.z, 0.3, 0.2, 0.3, RNG(), '#6a6a6a'); } // stones holding the sheet
  }
  barricade(B, x, y, z, yaw) {
    const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (const s of [-1.2, 1.2]) B.props.box(x + l.x * s, y, z + l.z * s, 0.12, 1.1, 0.12, yaw, '#333');
    B.kerb.quad(new THREE.Vector3(x - l.x * 1.4, y + 0.6, z - l.z * 1.4), new THREE.Vector3(x + l.x * 1.4, y + 0.6, z + l.z * 1.4), new THREE.Vector3(x + l.x * 1.4, y + 1.0, z + l.z * 1.4), new THREE.Vector3(x - l.x * 1.4, y + 1.0, z - l.z * 1.4), '#ffffff', [[0, 0], [0, 2.8], [1, 2.8], [1, 0]]);
    this.signBoard(B, 'noentry', x, y + 1.1, z, yaw + Math.PI / 2, 0.9);
  }
  // ── signature set pieces near the start: chai stall, graffiti wall, gantry, chevrons, flyover ──
  buildSpecials(B) {
    const T = this.track, th = this.theme, sw = SIDEWALK[th];
    const p = new THREE.Vector3();
    // start gantry
    { const w = T.wAt(0) / 2 + 0.9, yaw = T.yawAt(0); const a = T.pos(0, -w, new THREE.Vector3()), b = T.pos(0, w, new THREE.Vector3());
      const H = 6.2 + T.yAt(0);
      B.props.box(a.x, a.y, a.z, 0.35, 6.6, 0.35, yaw, '#ff2e88'); B.props.box(b.x, b.y, b.z, 0.35, 6.6, 0.35, yaw, '#ff2e88');
      const bw = Math.min(w * 2 - 0.4, 14); this.signBoard(B, 'banner', (a.x + b.x) / 2, H - 0.8, (a.z + b.z) / 2, yaw + Math.PI, bw); this.signBoard(B, 'banner', (a.x + b.x) / 2 + Math.sin(yaw) * 0.05, H - 0.8, (a.z + b.z) / 2 + Math.cos(yaw) * 0.05, yaw, bw); }
    // chai stall + graffiti wall (left and right of the first straight)
    if (sw >= 2) {
      const s = 34, sd = 1, w = T.wAt(s) / 2; const yaw = T.yawAt(s);
      T.pos(s, sd * (w + 0.45 + sw * 0.55), p); p.y += 0.18;
      const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      B.props.box(p.x, p.y, p.z, 1.4, 1.0, 4.2, yaw, '#6b3e26'); B.props.box(p.x, p.y + 1.0, p.z, 1.6, 0.08, 4.4, yaw, '#c8a26a');
      for (const k of [-1.9, 1.9]) B.props.box(p.x + f.x * k + l.x * 0.6, p.y, p.z + f.z * k + l.z * 0.6, 0.08, 2.6, 0.08, yaw, '#444');
      B.tin.quad(p.clone().addScaledVector(f, -2.3).addScaledVector(l, 1.0).setY(p.y + 2.7), p.clone().addScaledVector(f, 2.3).addScaledVector(l, 1.0).setY(p.y + 2.7), p.clone().addScaledVector(f, 2.3).addScaledVector(l, -1.6).setY(p.y + 2.4), p.clone().addScaledVector(f, -2.3).addScaledVector(l, -1.6).setY(p.y + 2.4), '#ffffff', [[0, 0], [2, 0], [2, 1], [0, 1]], UP);
      const signPos = p.clone().addScaledVector(l, 0.2); this.signBoard(B, 'chai', signPos.x, p.y + 2.75, signPos.z, yaw + Math.PI / 2 * -sd, 4.2);
      for (let i = 0; i < 4; i++) { const q = p.clone().addScaledVector(f, -1.5 + i).addScaledVector(l, -1.2); B.props.geom(CUP_G, q.x, p.y + 1.04, q.z, 0, 1, 1, 1, '#f5e6cc'); }
      for (const k of [-1.2, 1.2]) { const q = p.clone().addScaledVector(l, -1.6).addScaledVector(f, k); B.props.box(q.x, p.y, q.z, 0.5, 0.45, 1.4, yaw, '#3e8e8a'); }
      this.stallSpot = p.clone();
      // graffiti boundary wall on the other side
      const s2 = 62, w2 = T.wAt(s2) / 2; T.pos(s2, -(w2 + 0.45 + sw + 0.2), p); const yaw2 = T.yawAt(s2);
      if (T.clearance(p.x, p.z) > sw - 0.2) { this.wallBox(B.pave, p.clone().setY(0), yaw2, 16, 0.4, 3.6, '#c8bfb0', 4, -1); this.signBoard(B, 'graffiti', p.x + Math.cos(yaw2) * 0.25, 0.5, p.z - Math.sin(yaw2) * 0.25, yaw2 + Math.PI / 2, 6.2); }
    }
    // chevrons on the outside of tight corners
    let lastApex = -1e9;
    for (let i = 0; i < T.N; i += 4) {
      const k = T.k[i], ak = Math.abs(k); if (ak < 1 / 42) continue;
      const prev = Math.abs(T.k[(i - 4 + T.N) % T.N]), next = Math.abs(T.k[(i + 4) % T.N]); if (ak < prev || ak < next) continue;
      const s = i * STEP; if (s - lastApex < 40) continue; lastApex = s;
      const out = -Math.sign(k);
      for (const ds of [-9, 0, 9]) { const ss = s + ds; const w = T.wAt(ss) / 2; T.pos(ss, out * (w + 0.75), p); const yaw = T.yawAt(ss) + Math.PI + out * 0.5;
        if (T.yAt(ss) > 1.2) p.y += 1.15;
        this.signBoard(B, 'chevron', p.x, p.y + 0.55, p.z, yaw, 2.0); this.whoosh.push({ s: ss, d: out * (w + 0.75), k: 'board' });
        B.props.box(p.x, p.y, p.z, 0.1, 0.55, 0.1, yaw, '#333'); }
    }
    // decorative flyover over the first straight (Mumbai Central)
    const fo = this.def.flyover;
    if (fo) {
      const s0 = fo.from * T.L, s1 = fo.to * T.L, side = fo.side, H = 9, dw = 11;
      const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), pd = new THREE.Vector3();
      const ext = 160; // continue straight beyond the ends
      const pts = [];
      const endP = T.pos(s1, 0, new THREE.Vector3()), endYaw = T.yawAt(s1), startP = T.pos(s0, 0, new THREE.Vector3()), startYaw = T.yawAt(s0);
      const away = (yw, back) => { const f = new THREE.Vector3(Math.sin(yw), 0, Math.cos(yw)).multiplyScalar(back ? -1 : 1), r = new THREE.Vector3(Math.cos(yw), 0, -Math.sin(yw)).multiplyScalar(side); return f.multiplyScalar(Math.cos(0.55)).addScaledVector(r, Math.sin(0.55)).normalize(); };
      const dA = away(startYaw, true), dB = away(endYaw, false);
      const sA = startP.clone().addScaledVector(new THREE.Vector3(Math.cos(startYaw), 0, -Math.sin(startYaw)), side * (T.wAt(s0) / 2 - 1));
      const sB = endP.clone().addScaledVector(new THREE.Vector3(Math.cos(endYaw), 0, -Math.sin(endYaw)), side * (T.wAt(s1) / 2 - 1));
      for (let e = ext; e > 0; e -= 8) pts.push({ c: sA.clone().addScaledVector(dA, e), yaw: Math.atan2(-dA.x, -dA.z) });
      for (let s = s0; s <= s1; s += 4) pts.push({ c: T.pos(s, side * (T.wAt(s) / 2 - 1), new THREE.Vector3()), yaw: T.yawAt(s) });
      for (let e = 8; e <= ext; e += 8) pts.push({ c: sB.clone().addScaledVector(dB, e), yaw: Math.atan2(dB.x, dB.z) });
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], Bp = pts[i + 1]; const la = new THREE.Vector3(Math.cos(A.yaw), 0, -Math.sin(A.yaw)), lb = new THREE.Vector3(Math.cos(Bp.yaw), 0, -Math.sin(Bp.yaw));
        for (const [y, col2, outN] of [[H, '#8f8680', UP], [H - 1.3, '#9a8c84', null]]) {
          pa.copy(A.c).addScaledVector(la, -dw / 2).setY(y); pb.copy(Bp.c).addScaledVector(lb, -dw / 2).setY(y); pc.copy(Bp.c).addScaledVector(lb, dw / 2).setY(y); pd.copy(A.c).addScaledVector(la, dw / 2).setY(y);
          B.props.quad(pa, pb, pc, pd, col2, undefined, outN);
        }
        for (const sg of [-1, 1]) { pa.copy(A.c).addScaledVector(la, sg * dw / 2).setY(H - 1.3); pb.copy(Bp.c).addScaledVector(lb, sg * dw / 2).setY(H - 1.3); pc.copy(pb).setY(H + 1.0); pd.copy(pa).setY(H + 1.0); B.props.quad(pa, pb, pc, pd, '#a59a90'); }
        if (i % 3 === 0) { const q = A.c; if (this.track.clearance(q.x, q.z) > -0.5 || true) { const pl = A.c.clone().addScaledVector(la, side * 4.0); if (this.track.clearance(pl.x, pl.z) > 0.6) { B.props.box(pl.x, -0.05, pl.z, 1.6, H - 1.3, 1.6, A.yaw, '#9a8f86'); B.props.box(A.c.x, H - 2.2, A.c.z, dw * 0.9 * Math.abs(Math.cos(0)), 0.9, 1.8, A.yaw, '#8a8079'); } } }
        if (i % 5 === 2) { const lp = A.c.clone().addScaledVector(la, -side * dw / 2).setY(H + 1.0); B.props.box(lp.x, lp.y, lp.z, 0.15, 5, 0.15, A.yaw, '#3a3a40'); B.glow.box(lp.x, lp.y + 5, lp.z, 0.5, 0.2, 0.3, A.yaw, '#ffd9a0'); this.lampHeads.push(lp.clone().setY(lp.y + 4.9)); }
      }
    }
  }
  // ── speed clutter: objects that stream past close to the camera ──
  buildSpeedClutter(B) {
    const T = this.track, th = this.theme, sw = SIDEWALK[th]; const thin = this.opts.quality === 'low' ? 1.6 : 1;
    const p = new THREE.Vector3();
    const nearStall = (x, z) => this.stallSpot && Math.hypot(x - this.stallSpot.x, z - this.stallSpot.z) < 4.5;
    const step = (th === 'basti' ? 6.5 : th === 'market' ? 5.5 : 4.5) * thin;
    for (const side of [-1, 1]) {
      let k = side > 0 ? 0 : 3;
      for (let s = 8; s < T.L - 4; s += step * (0.85 + RNG() * 0.3)) {
        k++;
        const w = T.wAt(s) / 2, y = T.yAt(s), yaw = T.yawAt(s);
        if (this.ugSkip && this.ugSkip(s, 'clutter')) continue;
        if (y > 1.2) { T.pos(s, side * (w + 0.62), p); B.props.box(p.x, p.y + 1.15, p.z, 0.14, 0.3, 0.14, yaw, '#ffc21a'); if (k % 3 === 0) this.whoosh.push({ s, d: side * (w + 0.62), k: 'post' }); continue; }
        if (y > 0.25) continue;
        const off = w + 0.45 + (th === 'basti' ? 0.32 : 0.42); T.pos(s, side * off, p);
        if (this.isSea(p.x - 4) || nearStall(p.x, p.z) || this.obstacles.some(o => Math.abs(o.s - s) < 3 && Math.sign(o.d) === side)) continue;
        const gy = p.y + (th === 'basti' ? 0 : 0.18);
        if (th === 'basti') {
          const r = RNG();
          if (r < 0.32) B.props.geom(TANK_G, p.x, gy, p.z, 0, 0.32, 0.85, 0.32, pick(['#1d4fa0', '#c8321e', '#2f8a3e', '#e8a317']));
          else if (r < 0.52) this.cycle(B, p.x, gy, p.z, yaw + (RNG() - 0.5) * 0.4);
          else if (r < 0.72) B.props.box(p.x, gy, p.z, 0.5, 0.45 + RNG() * 0.4, 0.5, yaw + RNG(), pick(['#b07a3a', '#9a6a32', '#3e8e8a']));
          else { B.props.box(p.x, gy, p.z, 0.12, 3.4, 0.12, yaw, '#5a4636'); this.whoosh.push({ s, d: side * off, k: 'pole' }); }
        } else if (k % 6 === 0 && !T.hallAt(s)) { // concrete electric pole with cross-arm (not under a hall roof)
          B.props.box(p.x, gy, p.z, 0.26, 8.5, 0.26, yaw, '#8a8079'); const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
          this.beam(B.props, p.clone().setY(gy + 7.9).addScaledVector(l, -0.9), p.clone().setY(gy + 7.9).addScaledVector(l, 0.9), 0.1, '#6a625c');
          this.whoosh.push({ s, d: side * off, k: 'pole' });
        } else if (k % 6 === 3) { // striped reflector post
          B.props.box(p.x, gy, p.z, 0.1, 1.2, 0.1, yaw, '#f2f2f2'); B.props.box(p.x, gy + 0.85, p.z, 0.12, 0.25, 0.12, yaw, '#d22030'); B.props.box(p.x, gy + 0.35, p.z, 0.12, 0.2, 0.12, yaw, '#d22030');
        } else { // bollard: dark body with a yellow reflective band
          B.props.geom(BOLLARD_G, p.x, gy, p.z, 0, 1, 1, 1, '#1d1b20'); B.props.geom(BAND_G, p.x, gy + 0.56, p.z, 0, 1, 1, 1, '#ffc21a');
        }
      }
    }
    // overhead: sagging wires, bunting and festival banners across the road
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    let n = 0;
    for (let s = 18; s < T.L - 12; s += (th === 'basti' ? 11 : 14) * thin) {
      n++; if (T.yAt(s) > 0.5 || T.hallAt(s) || (this.ugSkip && this.ugSkip(s, 'wires'))) continue;
      const w = T.wAt(s) / 2 + 0.45 + Math.min(sw, 3);
      T.pos(s, -w, a); T.pos(s, w, b); if (this.isSea(a.x - 6) || this.isSea(b.x - 6)) continue;
      const yaw = T.yawAt(s);
      if (th !== 'basti') for (let kk = 0; kk < 2; kk++) { T.pos(s + kk * 0.7, -w, a, 6.6 + kk * 0.5); T.pos(s + 1.2 + kk * 0.7, w, b, 6.8 + kk * 0.4); this.sag(B.props, a, b, 0.6, 0.025, '#141414'); }
      if (n % 3 === 1) { // bunting
        T.pos(s + 2, -w, a, 5.3); T.pos(s + 2, w, b, 5.5); const pts = this.sag(B.props, a, b, 0.7, 0.015, '#2a2a2a');
        const flagCols = ['#ff2e88', '#ffc21a', '#3fd0c9', '#ffffff', '#ff7a2f', '#7b2cbf', '#2f8a3e'];
        for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i], p1 = pts[i + 1]; const tip = p0.clone().lerp(p1, 0.5); tip.y -= 0.42; B.props.quad(p0, p1, tip, tip.clone(), flagCols[i % flagCols.length]); }
      }
      if ((th === 'city' || th === 'market' || th === 'flyover') && n % 8 === 4) { // festival banner on two poles
        const wb = T.wAt(s) / 2 + 0.6; T.pos(s, -wb, a); T.pos(s, wb, b);
        B.props.box(a.x, a.y + 0.18, a.z, 0.14, 6.2, 0.14, yaw, '#555'); B.props.box(b.x, b.y + 0.18, b.z, 0.14, 6.2, 0.14, yaw, '#555');
        const mid = a.clone().lerp(b, 0.5), bw = a.distanceTo(b) - 0.3, name = n % 16 === 4 ? 'festoon' : 'festoon2';
        this.facing(B.signs, mid, yaw + Math.PI, bw, 4.9, 4.9 + bw / 12, SIGN_UV[name]);
        this.facing(B.signs, mid.clone().addScaledVector(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), 0.04), yaw, bw, 4.9, 4.9 + bw / 12, SIGN_UV[name]);
        this.whoosh.push({ s, d: 0, k: 'banner' });
      }
    }
  }
  sag(batch, a, b, depth, t, color, n = 8) { const pts = []; for (let i = 0; i <= n; i++) { const f = i / n; const q = a.clone().lerp(b, f); q.y -= Math.sin(f * Math.PI) * depth; pts.push(q); } for (let i = 0; i < n; i++) this.beam(batch, pts[i], pts[i + 1], t, color); return pts; }
  cycle(B, x, y, z, yaw) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    for (const k of [-0.5, 0.5]) B.props.geom(CYCLE_WHEEL, x + f.x * k, y + 0.33, z + f.z * k, yaw, 1, 1, 1, '#1a1a1a');
    this.beam(B.props, new THREE.Vector3(x - f.x * 0.5, y + 0.33, z - f.z * 0.5), new THREE.Vector3(x + f.x * 0.2, y + 0.8, z + f.z * 0.2), 0.03, pick(['#c8321e', '#1d4fa0', '#2f8a3e', '#111']));
    this.beam(B.props, new THREE.Vector3(x + f.x * 0.5, y + 0.33, z + f.z * 0.5), new THREE.Vector3(x + f.x * 0.25, y + 0.95, z + f.z * 0.25), 0.03, '#888');
    this.beam(B.props, new THREE.Vector3(x - f.x * 0.25, y + 0.8, z - f.z * 0.25), new THREE.Vector3(x + f.x * 0.2, y + 0.8, z + f.z * 0.2), 0.03, '#888');
  }
  // ── road markings that give the tarmac visible flow ──
  buildMarkings(B) {
    const T = this.track, p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const white = new THREE.Color('#e6e1d8'), tar = new THREE.Color('#2a262e'), tar2 = new THREE.Color('#3a3540');
    const quadAt = (s0, s1, d0, d1, c) => { T.pos(s0, d0, p[0], 0.012); T.pos(s1, d0, p[1], 0.012); T.pos(s1, d1, p[2], 0.012); T.pos(s0, d1, p[3], 0.012); B.marks.quad(p[0], p[1], p[2], p[3], c, undefined, UP); };
    const nearBump = (s) => (T.ug && T.dirtAt(s)) || T.bumps.some(b => Math.abs(b.s - s) < b.len + 6) || T.shortcuts.some(sc => Math.abs(s - sc.s) < sc.half + 2) || T.hazards.some(h => Math.abs(h.s - s) < 4);
    // centre dashes: 3 m paint, 4.5 m gap
    for (let s = 0; s < T.L - 3; s += 7.5) { if (T.wAt(s) < 7.2 || nearBump(s)) continue; quadAt(s, s + 3, -0.08, 0.08, white); }
    // zebra crossings on wide sections
    for (let s = 160; s < T.L - 20; s += 240) { const w = T.wAt(s) / 2; if (w < 3.5 || T.yAt(s) > 0.3 || nearBump(s)) continue; for (let d = -w + 0.5; d < w - 0.5; d += 1.0) quadAt(s, s + 3, d, d + 0.5, white); }
    // tar patches and manholes
    for (let s = 10; s < T.L - 4; s += 9 + RNG() * 14) {
      const w = T.w0At(s) / 2 - 0.6; if (nearBump(s)) continue; const d = (RNG() * 2 - 1) * w;
      if (RNG() < 0.3) { const q = T.pos(s, d, new THREE.Vector3(), 0.013); B.marks.geom(MANHOLE_G, q.x, q.y, q.z, RNG() * 6, 1, 1, 1, '#2b2830'); }
      else { const len = 1 + RNG() * 2.5, ww = 0.5 + RNG() * 1.1; quadAt(s, s + len, d - ww / 2, d + ww / 2, RNG() < 0.5 ? tar : tar2); }
    }
  }
  // ── landmark in the skyline ──
  buildLandmark(B) {
    const T = this.track, lm = this.def.landmark; if (!lm) return;
    const s = lm.f * T.L, c = T.pos(s, lm.side * lm.dist, new THREE.Vector3()); c.y = 0; const yaw = T.yawAt(s);
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const stone = '#d9b382', trim = '#a06b4a', dome = '#8a7a60';
    const kind = lm.kind || 'cst';
    if (kind === 'cst') {
      this.wallBox(B.facade, c, yaw, 90, 28, 26, stone, 12, 1);
      this.wallBox(B.facade, c, yaw, 18, 22, 44, stone, 12, 1);
      B.props.geom(DOME_G, c.x, 44, c.z, 0, 10, 12, 10, dome); B.props.box(c.x, 55.5, c.z, 0.6, 7, 0.6, 0, trim); B.props.geom(BLOB, c.x, 63, c.z, 0, 1.2, 1.2, 1.2, '#d4a62a');
      for (const k of [-40, -20, 20, 40]) { const q = c.clone().addScaledVector(l, k); this.wallBox(B.facade, q, yaw, 9, 9, 34, stone, 12, 1); B.props.geom(DOME_G, q.x, 34, q.z, 0, 4.5, 6, 4.5, dome); B.props.geom(CONE_G, q.x, 39.5, q.z, 0, 1.2, 5, 1.2, trim); }
      for (let k = -40; k <= 40; k += 8) { const q = c.clone().addScaledVector(l, k).addScaledVector(f, 0); B.props.geom(CONE_G, q.x, 26, q.z, 0, 0.8, 3, 0.8, trim); }
    } else if (kind === 'clocktower') {
      this.wallBox(B.facade, c, yaw, 60, 30, 16, '#c87a5a', 12, 1);
      this.wallBox(B.facade, c, yaw, 11, 11, 46, '#c87a5a', 12, 1);
      B.props.geom(CONE_G, c.x, 46, c.z, Math.PI / 4, 9, 14, 9, '#5a6a5a');
      for (let i = 0; i < 4; i++) { const a = yaw + i * Math.PI / 2; const q = c.clone().add(new THREE.Vector3(Math.sin(a) * 5.6, 38, Math.cos(a) * 5.6)); B.props.geom(CLOCK_G, q.x, q.y, q.z, a, 3, 3, 1, '#f5e6cc', Math.PI / 2); }
    } else if (kind === 'tank') {
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = c.clone().addScaledVector(f, a * 7).addScaledVector(l, b * 7); B.props.box(q.x, 0, q.z, 1.2, 30, 1.2, yaw, '#8a8079'); }
      B.props.geom(TANK_G, c.x, 30, c.z, 0, 14, 10, 14, '#3e8e8a'); B.props.geom(DOME_G, c.x, 40, c.z, 0, 14, 4, 14, '#2f6e6a');
    } else if (kind === 'sealink') {
      const sc = new THREE.Vector3(this.def.sea.x - 380, 0, c.z);
      for (const dz of [-160, 160]) { const q = sc.clone().add(new THREE.Vector3(0, 0, dz)); B.props.box(q.x - 6, 0, q.z, 3, 120, 4, 0, '#c8c0b8'); B.props.box(q.x + 6, 0, q.z, 3, 120, 4, 0, '#c8c0b8'); B.props.box(q.x, 60, q.z, 15, 3, 4, 0, '#c8c0b8');
        for (let k = 1; k <= 8; k++) for (const sg of [-1, 1]) { this.beam(B.glow, new THREE.Vector3(q.x, 115, q.z), new THREE.Vector3(q.x, 22, q.z + sg * k * 18), 0.3, '#ffe1b0'); } }
      B.props.box(sc.x, 20, sc.z, 16, 2.5, 900, 0, '#9a928a');
      for (let k = -440; k <= 440; k += 20) B.glow.box(sc.x + 7, 22.6, sc.z + k, 0.4, 0.4, 0.4, 0, '#ffd27a');
    } else if (kind === 'towers') {
      for (let i = 0; i < 6; i++) { const q = c.clone().addScaledVector(f, (i - 2.5) * 34).addScaledVector(l, (RNG() - 0.5) * 50); this.wallBox(B.facade, q, yaw, 22, 22, 70 + RNG() * 70, pick(['#8fb6d9', '#c9d1d9', '#b8a3d1', '#9fd3c7']), 12, 1); }
    }
  }
  buildSkyline(B) {
    const T = this.track; const n = this.opts.quality === 'low' ? 60 : 130;
    for (let i = 0; i < n; i++) {
      const a = RNG() * Math.PI * 2, r = T.R + 140 + RNG() * 360; const x = T.cx + Math.cos(a) * r, z = T.cz + Math.sin(a) * r;
      if (this.isSea(x + 40)) continue; if (T.clearance(x, z) < 40) continue;
      const F = 18 + RNG() * 30, D = 18 + RNG() * 20, H = 30 + RNG() * 80; const ry = RNG() * Math.PI;
      if (this.railBlocks(new THREE.Vector3(x, 0, z), new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry)), F, D)) continue;
      this.wallBox(B.facade, new THREE.Vector3(x, 0, z), ry, F, D, H, pick(['#8a6a7a', '#9a7a86', '#7a6a8a', '#a08070', '#8a8a9a']), 12, 1, RNG() * 4);
    }
  }
  // ── obstacles that narrow the road (handcarts, crates, parked autos, cones) ──
  buildObstacles(B) {
    const T = this.track, th = this.theme; const p = new THREE.Vector3();
    const add = (s, d, hw, hl, kind) => { this.obstacles.push({ s, d, hw, hl, kind });
      T.pos(s, d, p); const yaw = T.yawAt(s);
      if (kind === 'cart') { B.props.box(p.x, p.y + 0.55, p.z, hw * 2, 0.12, hl * 2, yaw, '#8a5a32'); for (const sg of [-1, 1]) B.props.geom(WHEEL_G, p.x + Math.sin(yaw) * sg * hl * 0.5, p.y + 0.3, p.z + Math.cos(yaw) * sg * hl * 0.5, yaw, 1.5, 1.5, 1.5, '#3a2a1a');
        for (let i = 0; i < 16; i++) B.props.geom(BLOB, p.x + (RNG() - 0.5) * hw * 1.6, p.y + 0.72 + RNG() * 0.2, p.z + (RNG() - 0.5) * hl * 1.6, RNG() * 6, 0.14, 0.14, 0.14, pick(['#ff7a2f', '#ffd23f', '#d43c2c', '#9be15d', '#2f8a3e'])); }
      else if (kind === 'crates') { for (let i = 0; i < 5; i++) B.props.box(p.x + (RNG() - 0.5) * hw, p.y + Math.floor(i / 3) * 0.5, p.z + (RNG() - 0.5) * hl, 0.6, 0.5, 0.6, yaw + RNG() * 0.4, pick(['#b07a3a', '#c88a4a', '#9a6a32'])); }
      else if (kind === 'auto') this.auto(B, p.x, p.y, p.z, yaw, RNG() < 0.5 ? 'kaali' : 'cng');
      else if (kind === 'drums') { for (let i = 0; i < 3; i++) B.props.geom(TANK_G, p.x + (RNG() - 0.5) * hw, p.y, p.z + (i - 1) * 0.7, 0, 0.35, 0.9, 0.35, pick(['#1d4fa0', '#c8321e', '#2f8a3e'])); }
      else if (kind === 'cones') { for (let i = 0; i < 4; i++) B.props.geom(CONE_G, p.x, p.y, p.z + (i - 1.5) * hl / 2, 0, 0.3, 0.7, 0.3, '#ff7a2f'); B.props.box(p.x, p.y, p.z, hw * 2, 0.9, 0.1, yaw, '#ffc21a'); }
    };
    const list = th === 'market' ? [[0.08, 1, 'cart'], [0.14, -1, 'crates'], [0.21, 1, 'cart'], [0.3, -1, 'cart'], [0.3, 1, 'crates', 6], [0.39, 1, 'crates'], [0.47, -1, 'cart'], [0.56, 1, 'cart'], [0.63, -1, 'crates'], [0.81, 1, 'cart'], [0.88, -1, 'cart']]
      : th === 'city' ? [[0.33, -1, 'auto'], [0.62, 1, 'auto'], [0.9, -1, 'cart']]
      : th === 'basti' ? [[0.2, 1, 'drums'], [0.38, -1, 'cart'], [0.71, 1, 'drums']]
      : th === 'flyover' ? [[0.17, 1, 'cones'], [0.2, -1, 'cones'], [0.7, 1, 'cart']] : [];
    for (const [f, sd, kind, ds = 0] of list) {
      const s = f * T.L + ds; const w = T.w0At(s) / 2;
      const dims = kind === 'cart' ? [0.6, 1.1] : kind === 'crates' ? [0.6, 0.7] : kind === 'auto' ? [0.7, 1.35] : kind === 'drums' ? [0.45, 1.1] : [0.6, 2.2];
      add(s, sd * (w - dims[0] - 0.15), dims[0], dims[1], kind);
    }
  }
  // ── shortcut corners: a divider island of stalls splits off a kachha lane on the inside ──
  buildShortcuts(B) {
    const T = this.track; if (!T.shortcuts.length) return;
    const p = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    const dirt = new Batch(), signB = new Batch();
    for (const sc of T.shortcuts) {
      const sg = sc.side;
      // the island: obstacles for physics + a raised kerb with tin stalls on it
      for (let s = sc.s0; s <= sc.s1; s += 2.4) this.obstacles.push({ s, d: T.islandD(s, sc), hw: 1.25, hl: 1.25, kind: 'island' });
      for (let s = sc.s0 - 1.2; s < sc.s1 + 1.2; s += 1) {
        const w0 = T.w0At(s) / 2, w1 = T.w0At(s + 1) / 2;
        T.pos(s, sg * (w0 + 0.1), pA, 0.25); T.pos(s + 1, sg * (w1 + 0.1), pB, 0.25); T.pos(s + 1, sg * (w1 + 2.6), pC, 0.25); T.pos(s, sg * (w0 + 2.6), pD, 0.25);
        B.pave.quad(pA, pB, pC, pD, '#ffffff', [[0, s / 3], [0, (s + 1) / 3], [0.8, (s + 1) / 3], [0.8, s / 3]], UP);
        for (const e of [0.1, 2.6]) { T.pos(s, sg * (w0 + e), pA, 0); T.pos(s + 1, sg * (w1 + e), pB, 0); T.pos(s + 1, sg * (w1 + e), pC, 0.25); T.pos(s, sg * (w0 + e), pD, 0.25); B.kerb.quad(pA, pB, pC, pD, '#ffffff', [[0, s / 2], [0, (s + 1) / 2], [0.3, (s + 1) / 2], [0.3, s / 2]]); }
      }
      const cols = ['#3e8e8a', '#c96f4a', '#d9c27a', '#8fb6d9', '#e09a6a', '#b5a58f'];
      for (let s = sc.s0 + 1.5; s < sc.s1 - 1; s += 4.2) {
        T.pos(s, T.islandD(s, sc), p, 0.25); const yaw = T.yawAt(s); const h = 2.2 + RNG() * 0.8;
        B.props.box(p.x, p.y, p.z, 2.1, h, 3.6, yaw, pick(cols));
        B.tin.geom(UNIT_BOX, p.x, p.y + h + 0.06, p.z, yaw + (RNG() - 0.5) * 0.1, 2.6, 0.08, 4.1, '#ffffff');
        if (RNG() < 0.6) this.signBoard(B, pick(['chai', 'paan', 'bill1', 'bill2', 'posters']), p.x + Math.sin(yaw) * 0, p.y + h * 0.55, p.z, yaw + (sg > 0 ? -Math.PI / 2 : Math.PI / 2), 1.6);
      }
      // entry: bollards, drums and a big SHORTCUT board facing the riders
      for (const [s, f] of [[sc.s0 - 1.5, 1], [sc.s1 + 1.5, -1]]) {
        T.pos(s, T.islandD(s, sc), p, 0); B.props.geom(TANK_G, p.x, p.y, p.z, 0, 0.42, 1.0, 0.42, '#ffc21a');
        for (const k of [-0.9, 0.9]) { T.pos(s - f * 0.6, T.islandD(s, sc) + k, p, 0); B.props.geom(BOLLARD_G, p.x, p.y, p.z, 0, 1, 1, 1, '#f2f2f2'); }
      }
      { const s = sc.s0 + 0.5; T.pos(s, T.islandD(s, sc), p, 0); const yaw = T.yawAt(s) + Math.PI, w = 2.4, h = 1.2, y0 = p.y + 1.5;
        const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); const c = p.clone().addScaledVector(f, 0.2);
        const a = c.clone().addScaledVector(l, -w / 2).setY(y0), b = c.clone().addScaledVector(l, w / 2).setY(y0), cc = b.clone().setY(y0 + h), d = a.clone().setY(y0 + h);
        signB.quad(a, b, cc, d, '#ffffff', [[0, 0], [1, 0], [1, 1], [0, 1]], f);
        for (const k of [-0.9, 0.9]) { const q = p.clone().addScaledVector(l, k); B.props.box(q.x, p.y, q.z, 0.08, 1.55, 0.08, yaw, '#555'); } }
      // kachha surface of the lane
      for (let s = sc.s - sc.half + sc.ramp * 0.4; s < sc.s + sc.half - sc.ramp * 0.4; s += 1) {
        const i0 = T.w0At(s) / 2 + 2.6, i1 = T.w0At(s + 1) / 2 + 2.6, o0 = T.wAt(s) / 2, o1 = T.wAt(s + 1) / 2; if (o0 < i0 + 0.3 || o1 < i1 + 0.3) continue;
        T.pos(s, sg * i0, pA, 0.02); T.pos(s + 1, sg * i1, pB, 0.02); T.pos(s + 1, sg * o1, pC, 0.02); T.pos(s, sg * o0, pD, 0.02);
        dirt.quad(pA, pB, pC, pD, '#ffffff', [[0, s / 4], [0, (s + 1) / 4], [(o1 - i1) / 4, (s + 1) / 4], [(o0 - i0) / 4, s / 4]], UP);
      }
    }
    this.dirtMat = new THREE.MeshLambertMaterial({ map: TEX.dirt, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.signMat = new THREE.MeshLambertMaterial({ map: TEX.shortcut, emissiveMap: TEX.shortcut, emissive: 0x333333, side: THREE.DoubleSide });
    for (const [b, m] of [[dirt, this.dirtMat], [signB, this.signMat]]) { const mesh = b.mesh(m, { receive: true }); if (mesh) { this.group.add(mesh); this.disposables.push(mesh.geometry, m); } }
  }
  // ── potholes + kichad: decals in a dry and a wet (monsoon) version, swapped by setMood ──
  buildHazards() {
    const T = this.track; const dry = new Batch(), wet = new Batch(); const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    const cell = (cx, cy) => [[cx, cy + 0.5], [cx + 0.5, cy + 0.5], [cx + 0.5, cy], [cx, cy]];
    for (const h of T.hazards) {
      const hl = h.type === 'mud' ? h.len / 2 : h.r * 1.15, hw = h.type === 'mud' ? h.hw * 1.1 : h.r * 1.15; const y = h.type === 'mud' ? 0.018 : 0.022;
      T.pos(h.s - hl, h.d - hw, pA, y); T.pos(h.s + hl, h.d - hw, pB, y); T.pos(h.s + hl, h.d + hw, pC, y); T.pos(h.s - hl, h.d + hw, pD, y);
      const row = h.type === 'mud' ? 0.5 : 0;
      dry.quad(pA, pB, pC, pD, '#ffffff', cell(0, 1 - row - 0.5).map(([u, v]) => [u, v]), UP);
      wet.quad(pA, pB, pC, pD, '#ffffff', cell(0.5, 1 - row - 0.5), UP);
    }
    const mk = (b, wetMat) => { const m = new THREE.MeshLambertMaterial({ map: TEX.haz, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      if (wetMat) { m.emissive = new THREE.Color('#1a2230'); if (this.opts.quality !== 'low') REFL.patch(m, 1.15, 1); } const mesh = b.mesh(m, { receive: true }); if (mesh) { mesh.renderOrder = 1; this.group.add(mesh); this.disposables.push(mesh.geometry, m); } return mesh; };
    this.hazDry = mk(dry, false); this.hazWet = mk(wet, true); if (this.hazWet) this.hazWet.visible = false;
  }
  // ── set pieces: kicker ramps + what they clear, rooftop blocks, ride-through halls, the railway under the flyover, coins ──
  buildSetPieces(B) {
    const T = this.track, p = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    // kickers: a plank deck on stacked racks; parked stuff right behind it in the same lane
    for (const k of T.kickers) {
      const n = 10;
      for (let i = 0; i < n; i++) { const x0 = i / n * k.len, x1 = (i + 1) / n * k.len, y0 = k.h * Math.pow(x0 / k.len, 1.25), y1 = k.h * Math.pow(x1 / k.len, 1.25);
        T.pos(k.s + x0, k.d - k.hw, pA, y0 + 0.02); T.pos(k.s + x1, k.d - k.hw, pB, y1 + 0.02); T.pos(k.s + x1, k.d + k.hw, pC, y1 + 0.02); T.pos(k.s + x0, k.d + k.hw, pD, y0 + 0.02);
        if (k.naka) B.glow.quad(pA, pB, pC, pD, new THREE.Color(i % 2 ? '#ffc21a' : '#1a1a1a'), undefined, UP); else B.props.quad(pA, pB, pC, pD, i % 2 ? '#a8743a' : '#93602c', undefined, UP);
        for (const sg of [-1, 1]) { T.pos(k.s + x0, k.d + sg * k.hw, pA, 0); T.pos(k.s + x1, k.d + sg * k.hw, pB, 0); T.pos(k.s + x1, k.d + sg * k.hw, pC, y1); T.pos(k.s + x0, k.d + sg * k.hw, pD, y0); B.props.quad(pA, pB, pC, pD, '#6e4a24'); } }
      T.pos(k.s + k.len, k.d - k.hw, pA, 0); T.pos(k.s + k.len, k.d + k.hw, pB, 0); T.pos(k.s + k.len, k.d + k.hw, pC, k.h); T.pos(k.s + k.len, k.d - k.hw, pD, k.h); B.props.quad(pA, pB, pC, pD, '#5a3c1c');
      for (const x of [k.len * 0.55, k.len * 0.85]) { T.pos(k.s + x, k.d, p, 0); const yaw = T.yawAt(k.s + x); for (let j = 0; j < 3; j++) B.props.box(p.x, p.y + j * 0.32, p.z, k.hw * 1.6, 0.3, 0.55, yaw + (RNG() - 0.5) * 0.1, pick(['#b07a3a', '#c88a4a', '#2f8a3e', '#c8321e'])); }
      T.pos(k.s - 8, k.d, p, 0); this.signBoard(B, 'arrow', p.x, p.y + 1.6, p.z, T.yawAt(k.s) + Math.PI, 1.6, p.y);
      const dims = k.over === 'autos' ? [0.7, 1.35] : k.over === 'carts' ? [0.6, 1.1] : k.over === 'reels' ? [0.75, 0.7] : [0.45, 1.1];
      if (k.naka) { T.pos(k.s + k.len, k.d - k.hw, pA, k.h + 0.03); T.pos(k.s + k.len, k.d + k.hw, pB, k.h + 0.03); T.pos(k.s + k.len - 0.25, k.d + k.hw, pC, k.h + 0.03); T.pos(k.s + k.len - 0.25, k.d - k.hw, pD, k.h + 0.03); B.glow.quad(pA, pB, pC, pD, new THREE.Color('#39ff6a'), undefined, UP); continue; }
      for (const off of [5.5, 10.5, 15.5]) { if (k.over !== 'autos' && off > 14) continue; const s = k.s + k.len + off; T.pos(s, k.d, p); const yaw = T.yawAt(s);
        this.obstacles.push({ s, d: k.d, hw: dims[0], hl: dims[1], kind: k.over === 'autos' ? 'auto' : k.over === 'carts' ? 'cart' : 'drums', kicker: k });
        if (k.over === 'autos') this.auto(B, p.x, p.y, p.z, yaw + (RNG() - 0.5) * 0.15, RNG() < 0.5 ? 'kaali' : 'cng');
        else if (k.over === 'carts') { B.props.box(p.x, p.y + 0.55, p.z, 1.2, 0.12, 2.2, yaw, '#8a5a32'); for (const sg of [-1, 1]) B.props.geom(WHEEL_G, p.x + Math.sin(yaw) * sg * 0.55, p.y + 0.3, p.z + Math.cos(yaw) * sg * 0.55, yaw, 1.5, 1.5, 1.5, '#2a2a2a');
          for (let i = 0; i < 14; i++) B.props.geom(BLOB, p.x + (RNG() - 0.5) * 1, p.y + 0.72 + RNG() * 0.2, p.z + (RNG() - 0.5) * 1.8, RNG() * 6, 0.14, 0.14, 0.14, pick(['#ff7a2f', '#ffd23f', '#d43c2c', '#9be15d'])); }
        else if (k.over === 'reels') { const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); for (const sg of [-1, 1]) { const q = p.clone().addScaledVector(l, sg * 0.48); B.props.geom(REEL_G, q.x, q.y + 0.7, q.z, yaw, 1, 1, 1, '#9a6a3a'); } B.props.geom(REEL_HUB_G, p.x, p.y + 0.7, p.z, yaw, 0.9, 1, 1, '#1f3a5a'); }
        else for (let i = 0; i < 3; i++) B.props.geom(TANK_G, p.x + (RNG() - 0.5) * 0.5, p.y, p.z + (i - 1) * 0.7, 0, 0.35, 0.9, 0.35, pick(['#1d4fa0', '#c8321e', '#2f8a3e'])); }
    }
    // rooftop run: the road rides on top of a row of buildings; scaffold ramps at both ends; gaps are alleys
    if (T.roof && T.roof.style !== 'bridge') { const R = T.roof, cols = ['#e8b4b8', '#9fd3c7', '#f2c46d', '#d98a6a', '#c9d1d9', '#b8a3d1', '#e6c9a8'];
      const segs = []; let a = R.up; for (const g of R.gaps) { segs.push([a, g.x0]); a = g.x0 + g.len; } segs.push([a, R.len - R.up]);
      for (const [x0, x1] of segs) for (let x = x0; x < x1 - 0.5; x += 6.5) { const xe = Math.min(x + 6.5, x1), sm = R.s0 + (x + xe) / 2; T.pos(sm, 0, p, 0); p.y = 0; const yaw = T.yawAt(sm), w = T.wAt(sm) + 7;
        B.props.box(p.x, -0.05, p.z, w, R.h - 0.02, xe - x - 0.2, yaw, pick(cols));
        for (let fl = 0; fl < 2; fl++) for (const sg of [-1, 1]) { const q = p.clone().add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(sg * (w / 2 + 0.02))); B.glow.quad(q.clone().add(new THREE.Vector3(Math.sin(yaw) * -1.2, 1.2 + fl * 1.9, Math.cos(yaw) * -1.2)), q.clone().add(new THREE.Vector3(Math.sin(yaw) * 1.2, 1.2 + fl * 1.9, Math.cos(yaw) * 1.2)), q.clone().add(new THREE.Vector3(Math.sin(yaw) * 1.2, 2.1 + fl * 1.9, Math.cos(yaw) * 1.2)), q.clone().add(new THREE.Vector3(Math.sin(yaw) * -1.2, 2.1 + fl * 1.9, Math.cos(yaw) * -1.2)), new THREE.Color(RNG() < 0.5 ? '#ffd58a' : '#3a4a5c')); }
        // rooftop clutter beside the road: water tanks, a dish, washing on a line
        for (const sg of [-1, 1]) { if (RNG() < 0.5) continue; T.pos(sm, sg * (T.wAt(sm) / 2 + 2.4), p, 0); p.y = R.h; B.props.geom(TANK_G, p.x, p.y, p.z, 0, 0.55, 1.1, 0.55, pick(['#1d4fa0', '#111111', '#c8c8c8'])); }
        if (RNG() < 0.6) { const sg = RNG() < 0.5 ? -1 : 1; T.pos(sm - 2, sg * (T.wAt(sm) / 2 + 1.6), pA, 0); T.pos(sm + 2, sg * (T.wAt(sm) / 2 + 1.6), pB, 0); pA.y = pB.y = R.h + 1.4; const pts = this.sag(B.props, pA, pB, 0.25, 0.01, '#333', 6); for (let i = 1; i < pts.length - 1; i++) { const q = pts[i]; B.props.box(q.x, q.y - 0.55, q.z, 0.05, 0.5, 0.45, yaw, pick(['#ff2e88', '#ffc21a', '#3fd0c9', '#ffffff', '#7b2cbf'])); } } }
      for (const [x0, x1] of [[0, R.up], [R.len - R.up, R.len]]) for (let x = x0 + 1; x < x1; x += 2.5) { for (const sg of [-1, 1]) { const sp = R.s0 + x; T.pos(sp, sg * (T.wAt(sp) / 2 + 0.3), p, 0); const y = T.yAt(sp); if (y < 0.6) continue; B.props.box(p.x, p.y - y, p.z, 0.1, y, 0.1, 0, '#8a6a3a'); } }
      T.pos(R.s0 - 10, 0, p, 0); this.signBoard(B, 'chevron', p.x, p.y + 2.2, p.z, T.yawAt(R.s0) + Math.PI, 3.2, p.y);
      // gap edges: hazard stripes on the lip, and the alley below with a tarp and junk
      for (const g of R.gaps) { const sA = R.s0 + g.x0, sB = sA + g.len;
        for (const [e0, e1] of [[sA - 1.1, sA - 0.05], [sB + 0.05, sB + 1.1]]) { const w = T.wAt(e0) / 2; for (let d = -w; d < w - 0.01; d += 0.8) { T.pos(e0, d, pA, 0.03); T.pos(e1, d, pB, 0.03); T.pos(e1, Math.min(d + 0.8, w), pC, 0.03); T.pos(e0, Math.min(d + 0.8, w), pD, 0.03); B.glow.quad(pA, pB, pC, pD, new THREE.Color(Math.round((d + w) / 0.8) % 2 ? '#141414' : '#ffc21a'), undefined, UP); } }
        T.pos(sA + g.len / 2, 0, p, 0); p.y = 0.02; const yaw = T.yawAt(sA); B.props.box(p.x, 0, p.z, T.wAt(sA) * 0.7, 0.05, g.len * 0.8, yaw, '#1d4fa0');
        for (let i = 0; i < 4; i++) B.props.geom(TANK_G, p.x + (RNG() - 0.5) * 4, 0, p.z + (RNG() - 0.5) * 3, 0, 0.35, 0.9, 0.35, pick(['#c8321e', '#2f8a3e', '#555']));
        for (const sg of [-1, 1]) { T.pos(sA - 2, sg * (T.wAt(sA) / 2 + 0.6), p, 0); this.signBoard(B, 'noentry', p.x, p.y + 1.5, p.z, T.yawAt(sA) + Math.PI, 0.9, p.y + 0.9); } }
    }
    // halls: the road runs through a building
    for (const h of T.halls) h.kind === 'tunnel' ? this.buildTunnel(B, h) : this.buildHall(B, h);
    this.buildStagePieces(B);
    // railway under the flyover, with a Mumbai local that runs through
    if (T.rail) this.buildRail(B);
    // coins
    if (T.coins.length) { const g = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 16).rotateZ(Math.PI / 2); const m = new THREE.MeshLambertMaterial({ color: 0xffc21a, emissive: 0x7a4a00 });
      const im = new THREE.InstancedMesh(g, m, T.coins.length); this.coinPos = T.coins.map(c => T.pos(c.s, c.d, new THREE.Vector3(), c.abs ? c.h - T.yAt(c.s) : c.h)); this.coinMesh = im; this.coinHidden = new Uint8Array(T.coins.length);
      this.group.add(im); this.disposables.push(g, m); this.updateCoins(0); }
  }
  reflHide() { return [this.roadMesh, this.marksMesh, this.hazDry, this.hazWet, this.poolMesh, this.waterMesh]; }
  updateCoins(t) { if (!this.coinMesh) return; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (let i = 0; i < this.coinPos.length; i++) { q.setFromAxisAngle(UP, t * 3 + i * 0.4); sc.setScalar(this.coinHidden[i] ? 0 : 1); M.compose(this.coinPos[i], q, sc); this.coinMesh.setMatrixAt(i, M); } this.coinMesh.instanceMatrix.needsUpdate = true; }
  hideCoin(i) { if (this.coinHidden) this.coinHidden[i] = 1; }
  resetCoins() { if (this.coinHidden) this.coinHidden.fill(0); }
  buildHall(B, h) {
    const T = this.track, sw = Math.min(SIDEWALK[this.theme], 2.5), H = 5.6, market = h.kind === 'market';
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3(), p = new THREE.Vector3();
    const wallC = market ? '#b5654a' : '#8e939b', inC = market ? '#e8c9a0' : '#c9cdd3', ceilC = market ? '#5a3a2a' : '#5d6168';
    for (let s = h.s0; s < h.s1; s += 2) { const s1 = Math.min(s + 2, h.s1); const off0 = T.wAt(s) / 2 + 0.45 + sw + 0.2, off1 = T.wAt(s1) / 2 + 0.45 + sw + 0.2;
      for (const sg of [-1, 1]) { T.pos(s, sg * off0, pA, 0); T.pos(s1, sg * off1, pB, 0); T.pos(s1, sg * off1, pC, H); T.pos(s, sg * off0, pD, H); B.props.quad(pA, pB, pC, pD, inC);
        T.pos(s, sg * (off0 + 0.4), pA, 0); T.pos(s1, sg * (off1 + 0.4), pB, 0); T.pos(s1, sg * (off1 + 0.4), pC, H + 0.4); T.pos(s, sg * (off0 + 0.4), pD, H + 0.4); B.props.quad(pA, pB, pC, pD, wallC); }
      T.pos(s, -off0 - 0.4, pA, H); T.pos(s1, -off1 - 0.4, pB, H); T.pos(s1, off1 + 0.4, pC, H); T.pos(s, off0 + 0.4, pD, H); B.props.quad(pA, pB, pC, pD, ceilC, undefined, new THREE.Vector3(0, -1, 0));
      T.pos(s, -off0 - 0.4, pA, H + 0.4); T.pos(s1, -off1 - 0.4, pB, H + 0.4); T.pos(s1, off1 + 0.4, pC, H + 0.4); T.pos(s, off0 + 0.4, pD, H + 0.4); B.props.quad(pA, pB, pC, pD, wallC, undefined, UP); }
    for (let s = h.s0 + 3; s < h.s1 - 2; s += 6) { const yaw = T.yawAt(s), w = T.wAt(s) / 2;
      // ceiling light strip
      T.pos(s - 1.2, -w * 0.5, pA, H - 0.06); T.pos(s + 1.2, -w * 0.5, pB, H - 0.06); T.pos(s + 1.2, w * 0.5, pC, H - 0.06); T.pos(s - 1.2, w * 0.5, pD, H - 0.06); B.glow.quad(pA, pB, pC, pD, new THREE.Color(market ? '#ffd58a' : '#e6f0ff'), undefined, new THREE.Vector3(0, -1, 0));
      for (const sg of [-1, 1]) { const off = w + 0.45 + sw - 0.2; T.pos(s, sg * off, p, 0);
        if (market) { B.props.box(p.x, p.y, p.z, 1.4, 0.85, 2.6, yaw, '#8a5a32'); for (let i = 0; i < 18; i++) B.props.geom(BLOB, p.x + (RNG() - 0.5) * 1.1, p.y + 0.95 + RNG() * 0.25, p.z + (RNG() - 0.5) * 2.2, RNG() * 6, 0.13, 0.13, 0.13, pick(['#ff7a2f', '#ffd23f', '#d43c2c', '#9be15d', '#2f8a3e', '#7b2cbf']));
          B.props.box(p.x, p.y + 2.3, p.z, 1.8, 0.05, 3, yaw, pick(['#ff2e88', '#3fd0c9', '#ffc21a'])); }
        else { B.props.box(p.x, p.y, p.z, 0.6, H, 0.6, yaw, '#b0b4ba'); B.props.box(p.x, p.y + 0.5, p.z, 0.62, 0.45, 0.62, yaw, '#ffc21a'); const q = T.pos(s + 3, sg * (off - 0.4), new THREE.Vector3()); B.props.box(q.x, q.y + 0.2, q.z, 1.7, 1.1, 3.8, yaw, pick(['#c8321e', '#1d4fa0', '#e8e8e8', '#2a2a2a'])); } } }
    // facades over the openings with the name board
    for (const [s, f] of [[h.s0, 1], [h.s1, -1]]) { const w = T.wAt(s) / 2 + 0.45 + sw + 0.6; T.pos(s, -w, pA, H); T.pos(s, w, pB, H); pC.copy(pB); pC.y += 3.2; pD.copy(pA); pD.y += 3.2; B.props.quad(pA, pB, pC, pD, wallC);
      T.pos(s, 0, p, H + 1.4); this.signBoard(B, market ? 'banner' : 'banner', p.x, p.y - 0.6, p.z, T.yawAt(s) + (f > 0 ? Math.PI : 0), Math.min(9, w * 1.6)); }
    this.hallSigns = (this.hallSigns || []).concat([h]);
  }
  buildRail(B) {
    const T = this.track, R = T.rail; const c = T.pos(R.s, 0, new THREE.Vector3(), 0); c.y = 0; const yaw = T.yawAt(R.s);
    const across = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), along = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); this.railC = c; this.railA = across; this.railYaw = Math.atan2(across.x, across.z);
    for (const off of [-2.6, 2.6]) { const q = c.clone().addScaledVector(along, off); B.props.box(q.x, 0, q.z, 3.6, 0.12, 640, this.railYaw, '#6a6058'); for (const r of [-0.72, 0.72]) { const q2 = q.clone().addScaledVector(along, r); B.props.box(q2.x, 0.12, q2.z, 0.08, 0.14, 640, this.railYaw, '#3a3a3e'); } }
    for (let x = -300; x <= 300; x += 40) { const q = c.clone().addScaledVector(across, x).addScaledVector(along, 5); B.props.box(q.x, 0, q.z, 0.3, 7, 0.3, 0, '#5a5a5a'); B.props.box(q.x - along.x * 2.5, 6.8, q.z - along.z * 2.5, 0.12, 0.12, 5.6, yaw, '#5a5a5a'); }
    // the local: 9 cars, yellow skirt, maroon top, window band
    const tb = new Batch(); const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
    for (let i = 0; i < 9; i++) { const z = (i - 4) * 20.5;
      const box = (y, h, col, w = 3.5) => { M.compose(P.set(0, y + h / 2, z), Q.identity(), S.set(w, h, 20)); tb.add(UNIT_BOX, M, new THREE.Color(col)); };
      box(0.6, 1.4, '#e8c23a'); box(2.0, 1.1, '#3a4a5c', 3.52); box(3.1, 0.9, '#8a1f3a'); box(4.0, 0.3, '#9a9aa0', 3.2);
      for (const sx of [-1.77, 1.77]) for (const dz of [-6, 6]) { M.compose(P.set(sx, 1.4, z + dz), Q.identity(), S.set(0.04, 2.4, 1.3)); tb.add(UNIT_BOX, M, new THREE.Color('#2a2a2e')); } }
    const tg = tb.build(); this.train = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true })); this.train.castShadow = true; this.group.add(this.train); this.disposables.push(tg, this.train.material);
    this.trainT = -6; this.trainDir = 1; this.trainHorned = false; this.placeTrain(-400);
  }
  placeTrain(x) { this.train.position.copy(this.railC).addScaledVector(this.railA, x).addScaledVector(new THREE.Vector3(Math.sin(this.track.yawAt(this.track.rail.s)), 0, Math.cos(this.track.yawAt(this.track.rail.s))), this.trainDir > 0 ? -2.6 : 2.6); this.train.rotation.y = this.railYaw; }
  placePickups() {
    const T = this.track; const types = ['sting', 'rod', 'sting', 'bottle', 'sting', 'gutka', 'sting', 'katta', 'sting', 'chain', 'sting', 'belt'];
    let i = 0;
    for (let s = 140; s < T.L - 40; s += 105) {
      const type = types[i++ % types.length]; const w = T.w0At(s) / 2;
      let d = type === 'sting' ? T.rlAt(s) * 0.6 : (i % 2 ? 1 : -1) * Math.max(0, w - 1.1);
      if (this.obstacles.some(o => Math.abs(o.s - s) < 6 && Math.abs(o.d - d) < 1.5)) d = -d;
      this.pickupSpots.push({ s, d, type });
      if (type === 'sting' && w > 3.5) this.pickupSpots.push({ s: s + 4, d: d + (d > 0 ? -1.6 : 1.6), type: 'sting' });
    }
  }
  // ── sky dome, sea, lights ──
  buildSky() {
    const g = new THREE.SphereGeometry(1400, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, night: { value: 0 } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vP;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 c = h < 0.18 ? mix(hor, mid, smoothstep(0.0, 0.18, h)) : mix(mid, top, smoothstep(0.18, 0.75, h));
          if (h < 0.0) c = hor * 0.9;
          float sd = max(dot(normalize(vP), normalize(sunDir)), 0.0);
          c += sunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 24.0) * 0.35 + pow(sd, 4.0) * 0.12);
          if (night > 0.5) { vec3 q = floor(vP * 380.0); float st = step(0.9965, hash(q)) * smoothstep(0.1, 0.5, h); c += vec3(st) * 0.8; }
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(g, this.skyMat); this.sky.frustumCulled = false; this.sky.renderOrder = -1; this.group.add(this.sky); this.disposables.push(g, this.skyMat);
  }
  buildSea(sea) {
    const T = this.track; const g = new THREE.PlaneGeometry(3000, 4000, 1, 1); g.rotateX(-Math.PI / 2); g.translate(sea.x - 1500, -0.5, T.cz);
    this.seaMat = new THREE.ShaderMaterial({
      fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, deep: { value: new THREE.Color('#1b3a5a') }, shallow: { value: new THREE.Color('#3a6f8a') }, glint: { value: new THREE.Color('#ffd59a') } }]),
      vertexShader: `varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 glint; varying vec3 vW;
#include <fog_pars_fragment>
void main(){ float w = sin(vW.x*0.08 + time*0.9)*0.5 + sin(vW.z*0.11 - time*1.3 + vW.x*0.03)*0.5; float w2 = sin((vW.x+vW.z)*0.37 + time*2.1);
  vec3 c = mix(deep, shallow, 0.5 + 0.25*w); c += glint * smoothstep(0.92, 1.0, w2*0.5+0.5) * 0.35; gl_FragColor = vec4(c,1.0);
#include <fog_fragment>
}`,
    });
    const m = new THREE.Mesh(g, this.seaMat); this.group.add(m); this.disposables.push(g, this.seaMat);
  }
  buildLampGlows() {
    const n = this.lampHeads.length; if (!n) return;
    const pos = new Float32Array(n * 3); this.lampHeads.forEach((p, i) => pos.set([p.x, p.y, p.z], i * 3));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.glowMat = new THREE.PointsMaterial({ map: TEX.glow, size: 9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc070, opacity: 0.0 });
    // fade the halos out near the lens: up close a 9 m sprite is a flat disc filling the screen
    this.glowMat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vNearFade;').replace('#include <project_vertex>', '#include <project_vertex>\nvNearFade = smoothstep(7.0, 22.0, -mvPosition.z);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vNearFade;').replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.a *= vNearFade;\n#include <premultiplied_alpha_fragment>'); };
    this.glows = new THREE.Points(g, this.glowMat); this.group.add(this.glows); this.disposables.push(g, this.glowMat);
  }
  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.sun.castShadow = this.opts.quality !== 'low';
    const sz = this.opts.quality === 'high' ? 2048 : 1024; this.sun.shadow.mapSize.set(sz, sz);
    const cam = this.sun.shadow.camera; cam.left = -36; cam.right = 36; cam.top = 36; cam.bottom = -36; cam.near = 1; cam.far = 260; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.group.add(this.sun, this.sun.target);
    this.headlight = new THREE.SpotLight(0xffe2b0, 0, 70, 0.5, 0.6, 1.2); this.group.add(this.headlight, this.headlight.target);
  }
  setMood(timeKey, weather) {
    const M = MOODS[timeKey] || MOODS.golden; this.mood = M; this.timeKey = timeKey; this.weather = weather;
    const wet = weather === 'monsoon', nt = M.night > 0.5;
    // monsoon: overcast blue-grey sky, soft sun, more sky light, haze — still readable, never murky
    const RS = nt ? ['#0e1220', '#1e2436', '#323a4e'] : ['#55627a', '#8a94a8', '#b4bac6'];
    const sky = (i) => new THREE.Color(M.sky[i]).lerp(new THREE.Color(RS[i]), wet ? 0.8 : 0);
    this.skyMat.uniforms.top.value.copy(sky(0)); this.skyMat.uniforms.mid.value.copy(sky(1)); this.skyMat.uniforms.hor.value.copy(sky(2));
    const sd = new THREE.Vector3(...M.sunDir).normalize(); this.sunDir = sd; this.skyMat.uniforms.sunDir.value.copy(sd); this.skyMat.uniforms.sunCol.value.set(M.sunDisc).multiplyScalar(wet ? 0.12 : 1); this.skyMat.uniforms.night.value = nt && !wet ? 1 : 0;
    this.sun.color.set(M.sun); if (wet) this.sun.color.lerp(new THREE.Color('#dfe6f2'), 0.7); this.sun.intensity = M.sunI * (wet ? (nt ? 0.5 : 0.42) : 1);
    this.hemi.color.set(M.hemiSky); this.hemi.groundColor.set(M.hemiGround);
    if (wet) { this.hemi.color.lerp(new THREE.Color(nt ? '#5a6688' : '#c4cede'), 0.7); this.hemi.groundColor.lerp(new THREE.Color(nt ? '#262634' : '#5a5862'), 0.6); }
    this.hemi.intensity = M.hemiI * (wet ? (nt ? 1.0 : 1.1) : 1); this.hemiBase = this.hemi.intensity;
    const fogC = new THREE.Color(M.fog); if (wet) fogC.lerp(new THREE.Color(nt ? '#2a2f3e' : '#9ba2b0'), 0.75);
    this.fog = new THREE.Fog(fogC, M.fogNear * (wet ? 0.55 : 1), M.fogFar * (wet ? 0.72 : 1));
    const n = M.night;
    const lit = Math.max(n, wet ? 0.45 : 0);   // dark monsoon afternoons: windows, shops and signs switch on
    this.mats.facade.emissive.set('#ffb347').multiplyScalar(lit * 0.9 + 0.05);
    this.mats.shops.emissive.set('#ffffff').multiplyScalar(0.08 + lit * 0.55);
    this.mats.signs.emissive.set('#ffffff').multiplyScalar(0.12 + lit * 0.7);
    this.mats.pool.opacity = lit * 0.7; if (this.glowMat) this.glowMat.opacity = 0.25 + lit * 0.75;
    this.mats.glowBasic.color.set('#ffffff').multiplyScalar(n > 0.5 ? 1.0 : 0.85);
    this.mats.road.roughness = wet ? 0.62 : 0.92; this.mats.road.color.set(wet ? '#7c7886' : '#ffffff'); this.mats.road.metalness = wet ? 0.1 : 0; REFL.U.uWet.value = wet ? 1 : 0;
    this.headlight.intensity = n > 0.5 ? 220 : 0;
    if (this.hazDry) this.hazDry.visible = !wet; if (this.hazWet) this.hazWet.visible = wet;
    if (this.dirtMat) this.dirtMat.color.set(wet ? '#7a6656' : '#ffffff');
    if (this.dirtRoadMat) this.dirtRoadMat.color.set(wet ? '#8a7560' : '#d9c3a0');
    if (this.ugMood) this.ugMood(nt, wet);
    if (this.seaMat) { this.seaMat.uniforms.glint.value.set(n > 0.5 ? '#ffcf7a' : M.sunDisc); this.seaMat.uniforms.deep.value.set(n > 0.5 ? '#0b1a30' : '#1b3a5a'); this.seaMat.uniforms.shallow.value.set(n > 0.5 ? '#1a3550' : '#3a6f8a'); }
    return { fog: this.fog, exposure: M.exposure * (wet ? (nt ? 1.05 : 0.94) : 1) };
  }
  update(dt, t, camera, focus) {
    this.sky.position.copy(camera.position);
    if (this.coinMesh) this.updateCoins(t);
    if (this.updateStage) this.updateStage(dt, t, focus);
    if (this.ugRT) this.updateUnderground(dt, t, camera, focus);
    if (this.train) { this.trainT += dt; const x = -360 + this.trainT * 30; if (x > 360) { this.trainT = -8 - Math.random() * 10; this.trainDir = -this.trainDir; this.trainHorned = false; }
      this.placeTrain(this.trainDir * Math.max(-400, x)); this.train.visible = this.trainT > 0;
      if (focus && this.trainT > 0 && !this.trainHorned) { const d = this.train.position.distanceTo(focus); if (d < 170) { this.trainHorned = true; AUDIO.trainHorn(clamp(1 - d / 220, 0.2, 1)); } } }
    const hm = this.hemiMul ?? 1;   // the Underground dims the sky light inside the tunnel
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt); const k = this.flash > 0.3 || (this.flash > 0.1 && this.flash < 0.2) ? 1 : 0.15; this.hemi.intensity = this.hemiBase * hm * (1 + 2.5 * k * Math.min(1, this.flash * 4)); } else if (this.hemiBase) this.hemi.intensity = this.hemiBase * hm;
    if (this.seaMat) this.seaMat.uniforms.time.value = t;
    if (focus) { // keep the shadow camera on the player
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 120); this.sun.target.position.copy(focus); this.sun.target.updateMatrixWorld();
    }
  }
  dispose() { this.disposables.forEach(d => d.dispose && d.dispose()); }
}

// shared prop geometries
const BLOB = new THREE.IcosahedronGeometry(1, 0);
const TETRA = (() => { const g = new THREE.TetrahedronGeometry(0.8, 0); return g; })();
const FROND = (() => { const g = new THREE.PlaneGeometry(0.9, 4.2, 1, 3); g.translate(0, 2.1, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -y * y * 0.06); p.setX(i, p.getX(i) * (1 - y / 5)); } g.rotateX(Math.PI / 2 - 0.2); g.computeVertexNormals(); return g; })();
const TANK_G = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0);
const DISH_G = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, 1.0);
const DOME_G = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const CONE_G = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0);
const CUP_G = new THREE.CylinderGeometry(0.05, 0.04, 0.1, 8).translate(0, 0.05, 0);
const CLOCK_G = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 20);
const WHEEL_G = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10).rotateZ(Math.PI / 2);
const BOLLARD_G = new THREE.CylinderGeometry(0.09, 0.11, 0.85, 7).translate(0, 0.425, 0);
const BAND_G = new THREE.CylinderGeometry(0.097, 0.1, 0.13, 7);
const CYCLE_WHEEL = new THREE.TorusGeometry(0.31, 0.025, 4, 14).rotateY(Math.PI / 2);
const MANHOLE_G = new THREE.CircleGeometry(0.38, 12).rotateX(-Math.PI / 2);
const REEL_G = new THREE.CylinderGeometry(0.7, 0.7, 0.12, 16).rotateZ(Math.PI / 2).translate(0, 0, 0);   // cable reel flange pair is built from two of these + a hub
const REEL_HUB_G = new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12).rotateZ(Math.PI / 2);
