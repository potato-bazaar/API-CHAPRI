// ───────────────────────── STAGE PIECES: seedhi, nala, nakabandi, festive lights ─────────────────────────
// Extra World builders for the Bhaag Chapri Bhaag stage (any track whose def asks for them).
// Staircase: physics rides a smooth slope; here each step is a box whose top sits on that slope at the step's middle.
// Nala: a sheet of murky water a quarter of a wheel deep, mirror-shaded with the wet-road reflection.
// Nakabandi: barricade segments (separate meshes so they can be smashed), cones, khaki cops, a police jeep, red-blue beacons.
const COP = { khaki: '#b59a62', shirt: '#bea56d', boot: '#151515', belt: '#4a2e18', skin: '#7a4e32', mask: '#e6e2d8', gun: '#1b1b1d', stick: '#7a4a22' };
Object.assign(World.prototype, {
  buildStagePieces(B) {
    const T = this.track; this.barricades = []; this.sirenLamps = []; this.nakaShooters = []; this.stageMeshes = [];
    if (T.stairs) this.buildStairs(B);
    if (T.nala) this.buildNala(B);
    if (T.nakas.length) this.buildNakas(B);
    if (this.def.festive) this.buildFestive(B);
  },
  // a standing cop from boxes. kind: 'aim' (rifle up, facing yaw), 'port' (rifle across the chest), 'lathi'
  copFigure(B, x, y, z, yaw, kind, cap) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const part = (lx, ly, lz, sx, sy, sz, col, pitch = 0, roll = 0, g = UNIT_BOX) => { const [px, py, pz] = at(lx, ly, lz); B.props.geom(g, px, py, pz, yaw, sx, sy, sz, col, pitch, roll); };
    for (const sx of [-1, 1]) { part(sx * 0.1, 0.45, 0, 0.16, 0.82, 0.18, COP.khaki); part(sx * 0.1, 0.05, 0.04, 0.17, 0.1, 0.28, COP.boot); }
    part(0, 1.15, 0, 0.46, 0.62, 0.27, COP.shirt); part(0, 0.9, 0, 0.47, 0.08, 0.28, COP.belt); part(0, 1.2, 0.14, 0.05, 0.4, 0.01, '#8a7448');
    part(0, 1.5, 0, 0.12, 0.08, 0.12, COP.skin);
    part(0, 1.62, 0, 0.22, 0.24, 0.22, COP.skin, 0, 0, BLOB_HEAD);
    part(0, 1.58, 0.07, 0.2, 0.1, 0.12, COP.mask);
    part(0, 1.76, -0.01, 0.27, 0.07, 0.27, cap, -0.15);                       // beret / patka
    if (kind === 'aim') {
      part(0.2, 1.38, 0.24, 0.11, 0.11, 0.5, COP.shirt); part(-0.18, 1.35, 0.28, 0.11, 0.11, 0.55, COP.shirt, 0, 0.5);
      part(0.12, 1.43, 0.55, 0.06, 0.09, 0.95, COP.gun); part(0.12, 1.33, 0.42, 0.05, 0.18, 0.07, COP.gun);
      return at(0.12, 1.45, 1.03);
    }
    if (kind === 'port') { for (const sx of [-1, 1]) part(sx * 0.27, 1.12, 0.06, 0.11, 0.55, 0.12, COP.shirt, -0.3 * sx); part(0, 1.2, 0.2, 0.06, 0.09, 0.95, COP.gun, 0, 0.8); return at(0, 1.2, 0.3); }
    for (const sx of [-1, 1]) part(sx * 0.28, 1.1, 0, 0.11, 0.55, 0.12, COP.shirt); part(0.3, 0.95, 0.12, 0.05, 1.3, 0.05, COP.stick, 0.35);
    return at(0, 1.4, 0.2);
  },
  policeJeep(B, x, y, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const bx = (lx, ly, lz, sx, sy, sz, col) => { const [px, py, pz] = at(lx, ly, lz); B.props.geom(UNIT_BOX, px, py, pz, yaw, sx, sy, sz, col); };
    bx(0, 0.75, 0, 1.6, 0.7, 3.7, '#f2f2f0'); bx(0, 0.76, 0, 1.62, 0.16, 3.72, '#1d3f8f'); bx(0, 1.38, -0.35, 1.5, 0.6, 2.2, '#f2f2f0');
    bx(0, 1.42, 0.78, 1.4, 0.42, 0.04, '#141820'); for (const sx of [-1, 1]) bx(sx * 0.76, 1.42, -0.35, 0.03, 0.4, 1.9, '#141820');
    for (const [lx, lz] of [[-0.72, 1.15], [0.72, 1.15], [-0.72, -1.2], [0.72, -1.2]]) { const [px, py, pz] = at(lx, 0.36, lz); B.props.geom(WHEEL_G, px, py, pz, yaw, 1.7, 1.7, 1.7, '#1a1a1a'); }
    bx(0, 1.74, -0.1, 1.1, 0.08, 0.22, '#222');
    // red-blue light bar: two lamps that flash (separate basic meshes so they glow and can switch)
    const lamps = [];
    for (const [lx, col] of [[-0.3, '#ff1e2e'], [0.3, '#2a58ff']]) { const m = new THREE.Mesh(LAMP_G, new THREE.MeshBasicMaterial({ color: col })); const [px, py, pz] = at(lx, 1.86, -0.1); m.position.set(px, py, pz); m.rotation.y = yaw; this.group.add(m); this.disposables.push(m.material); lamps.push(m); }
    this.sirenLamps.push(lamps);
  },
  // ── seedhi ──
  buildStairs(B) {
    const T = this.track, S = T.stairs, p = new THREE.Vector3(), rise = S.h / S.n, side = 1.6;
    const stone = ['#b9ad9a', '#aa9e8b'];
    for (const [x0, dir] of [[0, 1], [S.len - S.up, -1]]) for (let i = 0; i < S.n; i++) {
      const xa = x0 + i * S.tread, sm = S.s0 + xa + S.tread / 2, top = dir > 0 ? (i + 0.5) * rise : S.h - (i + 0.5) * rise;
      T.pos(sm, 0, p, 0); const yaw = T.yawAt(sm), W = T.wAt(sm) + 2 * side;
      B.props.box(p.x, -0.06, p.z, W, top + 0.06, S.tread + 0.03, yaw, stone[i % 2]);
      // painted nosing on the edge you ride up into / drop off
      const ns = S.s0 + (dir > 0 ? xa + 0.04 : xa + S.tread - 0.04); T.pos(ns, 0, p, 0); B.props.box(p.x, top - 0.005, p.z, W - 0.4, 0.03, 0.08, yaw, i % 2 ? '#ffc21a' : '#f2f2ea');
    }
    for (let x = S.up; x < S.len - S.up - 0.01; x += 2) { const xe = Math.min(x + 2, S.len - S.up), sm = S.s0 + (x + xe) / 2; T.pos(sm, 0, p, 0); const yaw = T.yawAt(sm), W = T.wAt(sm) + 2 * side;
      B.props.box(p.x, -0.06, p.z, W, S.h + 0.06, xe - x + 0.02, yaw, Math.round(x / 2) % 2 ? '#9c907d' : '#a69a86'); }
    // side walls with a railing, lamp posts on the terrace
    for (let x = -1; x < S.len + 1; x += 1.5) { const sm = S.s0 + x, y = T.stairsRaw(sm); for (const sg of [-1, 1]) { T.pos(sm, sg * (T.wAt(sm) / 2 + side + 0.15), p, 0); const yaw = T.yawAt(sm);
      B.props.box(p.x, -0.06, p.z, 0.3, y + 0.75, 1.52, yaw, '#8e8273'); B.props.box(p.x, y + 0.69, p.z, 0.36, 0.08, 1.52, yaw, '#d9d2c4');
      if (Math.round(x / 1.5) % 2 === 0) B.props.box(p.x, y + 0.77, p.z, 0.05, 0.42, 0.05, yaw, '#3a3a3e'); B.props.box(p.x, y + 1.18, p.z, 0.06, 0.06, 1.52, yaw, '#3a3a3e'); } }
    for (let x = S.up + 4; x < S.len - S.up; x += 12) for (const sg of [-1, 1]) { const sm = S.s0 + x; T.pos(sm, sg * (T.wAt(sm) / 2 + side - 0.3), p, 0); B.props.box(p.x, S.h, p.z, 0.12, 4.2, 0.12, 0, '#333'); B.glow.box(p.x, S.h + 4.1, p.z, 0.35, 0.18, 0.35, 0, '#ffe2a0'); this.lampHeads.push(new THREE.Vector3(p.x, S.h + 4.0, p.z)); }
    T.pos(S.s0 - 14, -(T.wAt(S.s0) / 2 + 1.2), p, 0); this.signBoard(B, 'chevron', p.x, p.y + 2.2, p.z, T.yawAt(S.s0) + Math.PI, 2.6, p.y);
  },
  // ── nala ──
  buildNala(B) {
    const T = this.track, W = T.nala, rows = [], step = 1;
    for (let x = -1.5; x <= W.len + 1.5; x += step) rows.push(x);
    const pos = [], uv = [], idx = []; const p = new THREE.Vector3(); const cols = 9;
    for (let r = 0; r < rows.length; r++) { const x = rows[r], s = W.s0 + x, half = T.wAt(s) / 2 + 1.25; const edge = clamp(Math.min(x + 1.5, W.len + 1.5 - x) / 2.5, 0, 1);
      for (let c = 0; c < cols; c++) { const d = -half + 2 * half * c / (cols - 1); T.pos(s, d, p, W.depth * edge - 0.03 * (1 - edge)); pos.push(p.x, p.y, p.z); uv.push(c / (cols - 1), x / 6); } }
    for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols - 1; c++) { const a = r * cols + c; idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const low = this.opts.quality === 'low';
    const m = low ? new THREE.MeshLambertMaterial({ color: '#3d4a3c', transparent: true, opacity: 0.86 }) : new THREE.MeshStandardMaterial({ color: '#2e3c33', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.86 });
    if (!low) REFL.patch(m, 1.2, 1, 1);
    this.waterMesh = new THREE.Mesh(g, m); this.waterMesh.renderOrder = 2; this.group.add(this.waterMesh); this.disposables.push(g, m);
    // the burst pipe gushing from the wall, and a foam line where the water runs out of the road
    const ps = W.s0 + W.len * 0.35, side = 1; T.pos(ps, side * (T.wAt(ps) / 2 + 2.2), p, 0); const yaw = T.yawAt(ps);
    B.props.geom(TANK_G, p.x, 1.4, p.z, yaw, 0.28, 1.2, 0.28, '#5a5f66', 0, Math.PI / 2);
    const fm = new THREE.MeshBasicMaterial({ color: '#cfe0e6', transparent: true, opacity: 0.55, depthWrite: false });
    this.gush = new THREE.Group(); for (let i = 0; i < 5; i++) { const q = new THREE.Mesh(UNIT_BOX, fm); q.scale.set(0.22, 0.24, 0.22); this.gush.add(q); }
    this.gush.position.copy(p); this.gush.userData = { yaw, side }; this.group.add(this.gush); this.disposables.push(fm);
    for (const x of [-1, W.len + 1]) { const s = W.s0 + x; for (let d = -T.wAt(s) / 2; d < T.wAt(s) / 2; d += 0.9) { T.pos(s, d + (RNG() - 0.5) * 0.4, p, 0.02); B.glow.box(p.x, p.y, p.z, 0.5 + RNG() * 0.5, 0.02, 0.18, T.yawAt(s) + (RNG() - 0.5) * 0.5, '#b8c8cc'); } }
    T.pos(W.s0 - 30, T.wAt(W.s0) / 2 + 1.2, p, 0); this.signBoard(B, 'chevron', p.x, p.y + 2.2, p.z, T.yawAt(W.s0) + Math.PI, 2.2, p.y);
  },
  // ── nakabandi ──
  buildNakas(B) {
    const T = this.track, p = new THREE.Vector3(), q = new THREE.Vector3();
    if (!BARRICADE.frame) makeBarricadeGeo();
    const signMat = new THREE.MeshLambertMaterial({ map: TEX.naka, emissiveMap: TEX.naka, emissive: 0x9a9a9a, side: THREE.DoubleSide }), frameMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const aheadMat = new THREE.MeshLambertMaterial({ map: TEX.nakaAhead, emissiveMap: TEX.nakaAhead, emissive: 0xaaaaaa, side: THREE.DoubleSide });
    this.disposables.push(signMat, frameMat, aheadMat); this.nakaSignMat = signMat;
    for (const nk of T.nakas) {
      const S = nk.s, w = T.wAt(S) / 2 + 0.45, yaw = T.yawAt(S) + Math.PI, n = Math.ceil(2 * w / 2.2), segW = 2 * w / n;
      for (let j = 0; j < n; j++) { const d = -w + segW * (j + 0.5); T.pos(S, d, p, 0);
        const g = new THREE.Group(); const fr = new THREE.Mesh(BARRICADE.frame, frameMat), sg = new THREE.Mesh(BARRICADE.sign, signMat); g.add(fr, sg); g.scale.set(segW / 2.2, 1, 1);
        g.position.copy(p); g.rotation.y = yaw; fr.castShadow = true; this.group.add(g);
        this.barricades.push({ s: S, d, hw: segW / 2, g, base: p.clone(), yaw, broken: false, t: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3(), naka: nk }); }
      // cones in front, beacons on the ends
      for (let d = -w + 0.6; d < w; d += 1.3) { T.pos(S - 2.2 - (Math.abs(d * 7) % 1) * 0.6, d, p, 0); B.props.geom(CONE_G, p.x, p.y, p.z, 0, 0.2, 0.62, 0.2, '#ff5a14'); B.props.geom(CONE_G, p.x, p.y + 0.3, p.z, 0, 0.12, 0.08, 0.12, '#f2f2f2'); }
      const lamps = []; for (const sd of [-1, 1]) { T.pos(S, sd * (w - 0.3), p, 1.25); const m = new THREE.Mesh(LAMP_G, new THREE.MeshBasicMaterial({ color: sd > 0 ? '#ff1e2e' : '#2a58ff' })); m.position.copy(p); this.group.add(m); this.disposables.push(m.material); lamps.push(m); }
      this.sirenLamps.push(lamps);
      // cops: riflemen just past the line facing the traffic, lathi men by the cones; a jeep on the pavement
      const caps = ['#20264a', '#7a1c22', '#c8641a'];
      for (const sd of [-1, 1]) {
        T.pos(S + 2.5, sd * (w + 1.0), p, 0.18); const muzzle = this.copFigure(B, p.x, p.y, p.z, yaw - sd * 0.25, 'aim', caps[(nk.idx + (sd > 0 ? 0 : 1)) % 3]);
        this.nakaShooters.push({ naka: nk, side: sd, muzzle: new THREE.Vector3(...muzzle) });
        T.pos(S - 4, sd * (w + 1.3), p, 0.18); this.copFigure(B, p.x, p.y, p.z, yaw - sd * 0.6, nk.idx % 2 ? 'lathi' : 'port', caps[(nk.idx + 2) % 3]);
      }
      // floodlights on poles light the checkpoint up (a pool on the road + a hot lamp head for the glow pass)
      for (const sd of [-1, 1]) { T.pos(S - 3, sd * (w + 0.6), p, 0); B.props.box(p.x, p.y, p.z, 0.14, 5.4, 0.14, 0, '#3a3a3e'); B.glow.box(p.x, p.y + 5.3, p.z, 0.6, 0.3, 0.4, T.yawAt(S), '#fff6d8'); this.lampHeads.push(new THREE.Vector3(p.x, p.y + 5.2, p.z));
        const c = T.pos(S - 3, sd * w * 0.45, new THREE.Vector3(), 0.03), yw = T.yawAt(S), r = 6.5, f = new THREE.Vector3(Math.sin(yw), 0, Math.cos(yw)).multiplyScalar(r), l = new THREE.Vector3(Math.cos(yw), 0, -Math.sin(yw)).multiplyScalar(r);
        B.pool.quad(c.clone().sub(f).sub(l), c.clone().add(f).sub(l), c.clone().add(f).add(l), c.clone().sub(f).add(l), '#ffffff', [[0, 0], [1, 0], [1, 1], [0, 1]], UP); }
      const js = nk.idx % 2 ? -1 : 1; T.pos(S + 11, js * (w + 1.6), p, 0.18); this.policeJeep(B, p.x, p.y, p.z, T.yawAt(S + 11) + (js > 0 ? 0.2 : -0.2));
      // warning board 70 m out
      T.pos(S - 72, -js * (w + 1.2), p, 0); const bw = 3.2, bh = 1.6; const sgn = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), aheadMat); sgn.position.set(p.x, p.y + 2.4, p.z); sgn.rotation.y = T.yawAt(S - 72) + Math.PI; this.group.add(sgn); this.disposables.push(sgn.geometry);
      for (const sx of [-1, 1]) { q.set(Math.cos(sgn.rotation.y) * sx * bw * 0.38, 0, -Math.sin(sgn.rotation.y) * sx * bw * 0.38).add(p); B.props.box(q.x, p.y, q.z, 0.08, 2.4, 0.08, 0, '#555'); }
    }
  },
  // ── festive string lights across the road (the night look in the reference photo) ──
  buildFestive(B) {
    const T = this.track, sw = SIDEWALK[this.theme], pA = new THREE.Vector3(), pB = new THREE.Vector3(), cols = ['#fff1b8', '#ffd36a', '#ffe9c9', '#ff9fc8', '#fff1b8'];
    for (let s = 20; s < T.L - 10; s += 26 + RNG() * 10) { if (T.yAt(s) > 0.5 || T.hallAt(s) || T.stairsZone(s)) continue; const w = T.wAt(s) / 2 + 0.45 + sw;
      T.pos(s, -w, pA, 6.2 + RNG()); T.pos(s + (RNG() - 0.5) * 4, w, pB, 6.2 + RNG()); const pts = this.sag(B.props, pA, pB, 0.9, 0.012, '#222', 22);
      for (let i = 1; i < pts.length - 1; i++) { const v = pts[i]; B.glow.box(v.x, v.y - 0.06, v.z, 0.09, 0.09, 0.09, 0, cols[i % cols.length]); } }
  },
  resetBarricades() { for (const b of this.barricades || []) if (b.broken) { b.broken = false; b.t = 0; b.g.position.copy(b.base); b.g.rotation.set(0, b.yaw, 0); b.g.visible = true; } },
  smashBarricade(b, v) { if (b.broken) return; b.broken = true; b.t = 0; b.vel.set((RNG() - 0.5) * 3, 3 + v * 0.12, 0).add(new THREE.Vector3(Math.sin(b.yaw + Math.PI), 0, Math.cos(b.yaw + Math.PI)).multiplyScalar(v * 0.5)); b.spin.set((RNG() - 0.5) * 9, (RNG() - 0.5) * 6, (RNG() - 0.5) * 9); },
  updateStage(dt, t, focus) {
    if (this.sirenLamps && this.sirenLamps.length) { const ph = Math.floor(t * 7) % 4; for (const [a, b] of this.sirenLamps) { a.visible = ph === 0 || ph === 2 && false || ph === 1; b.visible = ph >= 2; } }
    for (const b of this.barricades || []) { if (!b.broken) continue; b.t += dt; if (b.t > 1.6) { b.g.visible = false; continue; } b.vel.y -= 9.8 * dt; b.g.position.addScaledVector(b.vel, dt); if (b.g.position.y < b.base.y) { b.g.position.y = b.base.y; b.vel.multiplyScalar(0.4); b.vel.y = Math.abs(b.vel.y) * 0.3; }
      b.g.rotation.x += b.spin.x * dt; b.g.rotation.z += b.spin.z * dt; }
    if (this.gush) { const u = this.gush.userData, n = this.gush.children.length; this.gush.children.forEach((m, i) => { const k = ((t * 1.6 + i / n) % 1); m.position.set(-Math.cos(u.yaw) * u.side * (0.4 + k * 0.9), 1.4 - k * k * 1.3, Math.sin(u.yaw) * u.side * (0.4 + k * 0.9)); m.scale.setScalar(0.18 + k * 0.25); }); }
  },
});
const LAMP_G = new THREE.BoxGeometry(0.26, 0.16, 0.2);
const BLOB_HEAD = new THREE.IcosahedronGeometry(0.5, 1);
// one barricade segment, 2.2 m wide: pipe frame on feet with the board on top (sign is a separate textured mesh)
const BARRICADE = {};
function makeBarricadeGeo() {
  const b = new Batch(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const bar = (x, y, z, sx, sy, sz, col) => { M.compose(P.set(x, y, z), Q.identity(), S.set(sx, sy, sz)); b.add(UNIT_BOX, M, new THREE.Color(col)); };
  for (const x of [-1.0, 1.0]) { bar(x, 0.55, 0, 0.06, 1.1, 0.06, '#d9d9d9'); bar(x, 0.03, 0, 0.08, 0.06, 0.7, '#3a3a3a'); }
  bar(0, 0.22, 0, 2.05, 0.06, 0.06, '#d9d9d9'); for (let i = 0; i < 8; i++) bar(-0.9 + i * 0.257, 0.3, 0, 0.12, 0.12, 0.03, i % 2 ? '#c8202a' : '#f2f2f2');
  bar(0, 0.38, 0, 2.05, 0.05, 0.05, '#d9d9d9');
  BARRICADE.frame = b.build();
  BARRICADE.sign = new THREE.PlaneGeometry(2.0, 0.95).translate(0, 0.9, 0.035);
}
