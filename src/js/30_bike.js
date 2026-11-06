// ───────────────────────── BIKE + RIDER MODEL ─────────────────────────
// Original RX-inspired two-stroke (badged CR100) built from primitives. Local +z = forward.
const BIKE_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const LIGHT_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
let DECAL_MAT = null;
const SKIN = '#a86d4a';
const REAR_Z = -0.64, FRONT_Z = 0.66, WHEEL_R = 0.31;

function bikeBodyGeom(o) {
  const b = new Batch(); const M = new THREE.Matrix4(); const Q = new THREE.Quaternion(); const E = new THREE.Euler(); const S = new THREE.Vector3(); const P = new THREE.Vector3();
  const put = (g, x, y, z, rx, ry, rz, sx, sy, sz, c) => { E.set(rx, ry, rz); M.compose(P.set(x, y, z), Q.setFromEuler(E), S.set(sx, sy, sz)); b.add(g, M, new THREE.Color(c)); };
  const tank = o.tank, chrome = '#d7dce2', black = '#1a1a1d', grey = '#4a4a50', dark = '#2a2a2e';
  const cyl = (r1, r2, h, seg = 10) => new THREE.CylinderGeometry(r1, r2, h, seg);
  const tube = (a, bb, r, c) => { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...bb); const len = A.distanceTo(Bv); const mid = A.clone().add(Bv).multiplyScalar(0.5); Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize()); M.compose(mid, Q, S.set(1, len, 1)); b.add(cyl(r, r, 1, 8), M, new THREE.Color(c)); };
  // fuel tank (teardrop)
  put(new THREE.SphereGeometry(0.2, 14, 10), 0, 0.84, 0.12, -0.12, 0, 0, 0.92, 0.72, 1.55, tank);
  if (o.chrome) { put(new THREE.SphereGeometry(0.2, 12, 8), 0.035, 0.83, 0.1, -0.12, 0, 0, 0.85, 0.42, 1.2, chrome); put(new THREE.SphereGeometry(0.2, 12, 8), -0.035, 0.83, 0.1, -0.12, 0, 0, 0.85, 0.42, 1.2, chrome); }
  put(new THREE.BoxGeometry(0.03, 0.06, 0.28), 0.17, 0.86, 0.12, -0.1, 0, 0, 1, 1, 1, o.accent); put(new THREE.BoxGeometry(0.03, 0.06, 0.28), -0.17, 0.86, 0.12, -0.1, 0, 0, 1, 1, 1, o.accent);
  // seat, side panels, tail
  put(new THREE.BoxGeometry(0.27, 0.1, 0.66), 0, 0.84, -0.36, 0.06, 0, 0, 1, 1, 1, black);
  put(new THREE.BoxGeometry(0.22, 0.2, 0.3), 0, 0.66, -0.26, 0, 0, 0, 1, 1, 1, tank);
  put(new THREE.BoxGeometry(0.2, 0.1, 0.32), 0, 0.8, -0.74, -0.15, 0, 0, 1, 1, 1, tank);
  // engine + fins + crankcase
  put(new THREE.BoxGeometry(0.24, 0.26, 0.34), 0, 0.42, 0.06, 0, 0, 0, 1, 1, 1, grey);
  for (let i = 0; i < 5; i++) put(new THREE.BoxGeometry(0.3, 0.018, 0.26), 0, 0.57 + i * 0.035, 0.2, -0.35, 0, 0, 1, 1, 1, '#9aa0a8');
  put(cyl(0.11, 0.11, 0.05, 14), 0.14, 0.4, 0.04, 0, 0, Math.PI / 2, 1, 1, 1, chrome);
  put(cyl(0.08, 0.08, 0.05, 12), -0.14, 0.42, 0.08, 0, 0, Math.PI / 2, 1, 1, 1, '#8a8f96');
  // frame tubes
  tube([0, 0.95, 0.42], [0, 0.45, 0.24], 0.025, black); tube([0, 0.95, 0.42], [0, 0.78, -0.3], 0.025, black);
  tube([0, 0.78, -0.3], [0, 0.42, REAR_Z], 0.02, black); tube([0, 0.42, -0.1], [0, 0.32, REAR_Z], 0.022, black);
  tube([0.12, 0.33, -0.1], [0.1, WHEEL_R, REAR_Z], 0.022, black); tube([-0.12, 0.33, -0.1], [-0.1, WHEEL_R, REAR_Z], 0.022, black);
  tube([0.1, 0.75, -0.55], [0.1, WHEEL_R + 0.02, REAR_Z + 0.02], 0.03, chrome); tube([-0.1, 0.75, -0.55], [-0.1, WHEEL_R + 0.02, REAR_Z + 0.02], 0.03, chrome); // shocks
  // front fork + steering head
  tube([0.09, WHEEL_R, FRONT_Z], [0.08, 0.95, 0.44], 0.028, chrome); tube([-0.09, WHEEL_R, FRONT_Z], [-0.08, 0.95, 0.44], 0.028, chrome);
  put(new THREE.BoxGeometry(0.22, 0.05, 0.1), 0, 0.93, 0.45, 0, 0, 0, 1, 1, 1, black);
  // handlebar, grips, mirrors
  tube([-0.36, 1.03, 0.33], [0.36, 1.03, 0.33], 0.016, chrome); tube([-0.36, 1.03, 0.33], [-0.43, 1.04, 0.3], 0.024, black); tube([0.36, 1.03, 0.33], [0.43, 1.04, 0.3], 0.024, black);
  tube([0.22, 1.03, 0.36], [0.27, 1.22, 0.38], 0.008, chrome); tube([-0.22, 1.03, 0.36], [-0.27, 1.22, 0.38], 0.008, chrome);
  put(cyl(0.05, 0.05, 0.015, 12), 0.27, 1.24, 0.38, Math.PI / 2, 0, 0, 1, 1, 1, chrome); put(cyl(0.05, 0.05, 0.015, 12), -0.27, 1.24, 0.38, Math.PI / 2, 0, 0, 1, 1, 1, chrome);
  // headlight shell + speedo
  put(cyl(0.1, 0.085, 0.13, 16), 0, 0.86, 0.56, Math.PI / 2, 0, 0, 1, 1, 1, chrome);
  put(cyl(0.045, 0.045, 0.05, 10), 0, 1.0, 0.42, -0.6, 0, 0, 1, 1, 1, black);
  // fenders
  put(new THREE.CylinderGeometry(WHEEL_R + 0.05, WHEEL_R + 0.05, 0.13, 14, 1, true, -0.2, Math.PI * 0.85), 0, WHEEL_R, FRONT_Z, 0, 0, Math.PI / 2, 1, 1, 1, o.chrome ? chrome : tank);
  put(new THREE.CylinderGeometry(WHEEL_R + 0.05, WHEEL_R + 0.05, 0.15, 14, 1, true, Math.PI * 0.85, Math.PI * 0.75), 0, WHEEL_R, REAR_Z, 0, 0, Math.PI / 2, 1, 1, 1, chrome);
  // chain guard + footpegs + stand
  put(new THREE.BoxGeometry(0.03, 0.06, 0.6), -0.13, 0.33, -0.33, 0.12, 0, 0, 1, 1, 1, black);
  tube([0.12, 0.34, -0.05], [0.24, 0.34, -0.05], 0.015, black); tube([-0.12, 0.34, -0.05], [-0.24, 0.34, -0.05], 0.015, black);
  // expansion chamber exhaust (RX signature belly)
  const pts = [[0.06, 0.56, 0.32], [0.1, 0.36, 0.34], [0.15, 0.24, 0.16], [0.17, 0.25, -0.2], [0.17, 0.33, -0.62], [0.17, 0.4, -0.92]].map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tg = new THREE.TubeGeometry(curve, 24, 0.05, 8, false);
  { const pos = tg.attributes.position; const u = []; for (let i = 0; i <= 24; i++) { const t = i / 24; u.push(t < 0.25 ? 0.6 : t < 0.65 ? 1.6 - Math.abs(t - 0.45) * 2 : 0.85); }
    const cs = curve.getSpacedPoints(24); for (let i = 0; i < pos.count; i++) { const seg = Math.floor(i / 9); const c = cs[Math.min(seg, 24)]; const k = u[Math.min(seg, 24)]; pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, c.y + (pos.getY(i) - c.y) * k, c.z + (pos.getZ(i) - c.z) * k); } tg.computeVertexNormals(); }
  b.add(tg, new THREE.Matrix4(), new THREE.Color(chrome));
  put(cyl(0.03, 0.03, 0.12, 8), 0.17, 0.42, -0.98, Math.PI / 2 - 0.15, 0, 0, 1, 1, 1, '#555');
  return b.build();
}
function wheelGeom() {
  const b = new Batch(); const M = new THREE.Matrix4();
  const tyre = new THREE.TorusGeometry(WHEEL_R - 0.045, 0.048, 8, 24); tyre.rotateY(Math.PI / 2); b.add(tyre, M, new THREE.Color('#151515'));
  const rim = new THREE.TorusGeometry(WHEEL_R - 0.09, 0.012, 6, 24); rim.rotateY(Math.PI / 2); b.add(rim, M, new THREE.Color('#d7dce2'));
  const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12); hub.rotateZ(Math.PI / 2); b.add(hub, M, new THREE.Color('#9aa0a8'));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const sp = new THREE.CylinderGeometry(0.004, 0.004, WHEEL_R - 0.1, 3); sp.translate(0, (WHEEL_R - 0.1) / 2, 0); sp.rotateX(a); sp.translate((i % 2 ? 0.03 : -0.03), 0, 0); b.add(sp, M, new THREE.Color('#c8ccd2')); }
  return b.build();
}
const WHEEL_GEOM = wheelGeom();
function lightsGeom(neon) {
  const b = new Batch(); const M = new THREE.Matrix4();
  const lens = new THREE.CircleGeometry(0.082, 16); M.makeTranslation(0, 0.86, 0.627); b.add(lens, M, new THREE.Color('#fff6dc'));
  const tail = new THREE.BoxGeometry(0.12, 0.06, 0.03); M.makeTranslation(0, 0.8, -0.91); b.add(tail, M, new THREE.Color('#ff2020'));
  for (const x of [-0.2, 0.2]) { const ind = new THREE.SphereGeometry(0.025, 6, 4); M.makeTranslation(x, 0.86, 0.5); b.add(ind, M, new THREE.Color('#ffb020')); }
  if (neon) { const g = new THREE.PlaneGeometry(0.5, 1.5); g.rotateX(-Math.PI / 2); M.makeTranslation(0, 0.05, 0); b.add(g, M, new THREE.Color('#ff2e88')); }
  return b.build();
}
function modelLightsGeom(neon) {
  const b = new Batch(); const M = new THREE.Matrix4(); const F = MODEL_FIT;
  const lens = new THREE.CircleGeometry(F.headR, 18); M.makeTranslation(...F.head); b.add(lens, M, new THREE.Color('#fff6dc'));
  const tail = new THREE.PlaneGeometry(0.15, 0.075); tail.rotateY(Math.PI); M.makeTranslation(...F.tail); b.add(tail, M, new THREE.Color('#ff2020'));
  if (neon) { const g = new THREE.PlaneGeometry(0.5, 1.5); g.rotateX(-Math.PI / 2); M.makeTranslation(0, 0.05, 0); b.add(g, M, new THREE.Color('#ff2e88')); }
  return b.build();
}
function decalGeom(o) {
  const b = new Batch(); const M = new THREE.Matrix4(); const Q = new THREE.Quaternion();
  const quad = (rect, w, h, x, y, z, ry, rx = 0) => { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(rect[0], rect[2], uv.getX(i)), lerp(rect[1], rect[3], uv.getY(i))); M.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)); b.add(g, M, new THREE.Color('#ffffff')); };
  quad(SIGN_UV.plate, 0.2, 0.05, 0, 0.67, -0.915, Math.PI, 0.15);
  quad(SIGN_UV.badge, 0.2, 0.05, 0.185, 0.84, 0.13, Math.PI / 2, 0);
  quad(SIGN_UV.badge, 0.2, 0.05, -0.185, 0.84, 0.13, -Math.PI / 2, 0);
  if (o.stickers) { quad(SIGN_UV.stickers, 0.24, 0.12, 0.13, 0.66, -0.26, Math.PI / 2); quad(SIGN_UV.stickers, 0.24, 0.12, -0.13, 0.66, -0.26, -Math.PI / 2); }
  return b.build();
}
// Rider parts (bike-body space): hips at seat
function headGeom(o) {
  const b = new Batch(); const M = new THREE.Matrix4(); const P = new THREE.Vector3(); const Q = new THREE.Quaternion(); const S = new THREE.Vector3(1, 1, 1);
  const put = (g, x, y, z, c, sx = 1, sy = 1, sz = 1) => { M.compose(P.set(x, y, z), Q.identity(), S.set(sx, sy, sz)); b.add(g, M, new THREE.Color(c)); };
  put(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), 0, -0.07, 0, SKIN);
  put(new THREE.SphereGeometry(0.11, 14, 10), 0, 0.06, 0.01, SKIN, 0.92, 1.05, 1);
  put(new THREE.SphereGeometry(0.03, 6, 4), 0, 0.05, 0.11, '#8f5a3a');
  if (o.helmet) {
    put(new THREE.SphereGeometry(0.155, 16, 10), 0, 0.09, -0.005, o.helmet, 1, 1.02, 1.08);
    put(new THREE.SphereGeometry(0.14, 12, 6, -1.0, 2.0, 1.1, 0.8), 0, 0.09, 0.03, '#1a2030', 1.04, 1, 1.08);
  } else {
    if (o.hair === 'afro') { put(new THREE.SphereGeometry(0.13, 10, 8), 0, 0.12, -0.03, '#1b120e', 1.15, 0.9, 1.1); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; put(new THREE.IcosahedronGeometry(0.055, 0), Math.cos(a) * 0.12, 0.14 + Math.sin(i * 1.7) * 0.05, Math.sin(a) * 0.11 - 0.03, '#1b120e'); } }
    else { put(new THREE.SphereGeometry(0.118, 10, 6, 0, Math.PI * 2, 0, 1.3), 0, 0.08, -0.01, '#1b120e'); }
    put(new THREE.BoxGeometry(0.07, 0.015, 0.02), 0, 0.005, 0.105, '#1b120e');
  }
  if (o.shades && !o.helmet) { put(new THREE.BoxGeometry(0.21, 0.045, 0.02), 0, 0.07, 0.105, o.shades); put(new THREE.BoxGeometry(0.075, 0.035, 0.015), 0.045, 0.068, 0.115, '#101418'); put(new THREE.BoxGeometry(0.075, 0.035, 0.015), -0.045, 0.068, 0.115, '#101418'); }
  if (o.goldChain) { const t = new THREE.TorusGeometry(0.075, 0.008, 4, 16); t.rotateX(Math.PI / 2 - 0.3); M.compose(P.set(0, -0.11, 0.02), Q.identity(), S.set(1, 1, 1)); b.add(t, M, new THREE.Color('#e0b030')); }
  return b.build();
}
function armGeom(shirt) { // points along +z from shoulder, length ~0.56
  const b = new Batch(); const M = new THREE.Matrix4();
  const up = new THREE.CylinderGeometry(0.055, 0.05, 0.28, 7); up.rotateX(Math.PI / 2); up.translate(0, 0, 0.14); b.add(up, M, new THREE.Color(shirt));
  const lo = new THREE.CylinderGeometry(0.045, 0.04, 0.28, 7); lo.rotateX(Math.PI / 2); lo.translate(0, 0, 0.42); b.add(lo, M, new THREE.Color(SKIN));
  const hand = new THREE.SphereGeometry(0.045, 6, 4); hand.translate(0, 0, 0.57); b.add(hand, M, new THREE.Color(SKIN));
  return b.build();
}
function legGeom(jeans) { // hip origin; thigh forward-down to knee, shin down to footpeg
  const b = new Batch(); const M = new THREE.Matrix4(); const Q = new THREE.Quaternion();
  const seg = (a, c, r1, r2, col) => { const A = new THREE.Vector3(...a), C = new THREE.Vector3(...c); const len = A.distanceTo(C); const g = new THREE.CylinderGeometry(r2, r1, len, 7); M.compose(A.clone().add(C).multiplyScalar(0.5), Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize()), new THREE.Vector3(1, 1, 1)); b.add(g, M, new THREE.Color(col)); };
  const knee = [0.06, -0.08, 0.38], foot = [0.06, -0.52, 0.2];
  seg([0, 0, 0], knee, 0.085, 0.07, jeans); seg(knee, foot, 0.065, 0.05, jeans);
  const shoe = new THREE.BoxGeometry(0.1, 0.08, 0.24); M.makeTranslation(foot[0], foot[1] - 0.02, foot[2] + 0.05); b.add(shoe, M, new THREE.Color('#f2f2f2'));
  return b.build();
}
function chainGeom() { const b = new Batch(); const M = new THREE.Matrix4(); const Q = new THREE.Quaternion(); for (let i = 0; i < 9; i++) { const t = new THREE.TorusGeometry(0.03, 0.009, 4, 8); M.compose(new THREE.Vector3(0, 0, 0.04 + i * 0.05), Q.setFromEuler(new THREE.Euler(0, i % 2 ? Math.PI / 2 : 0, 0)), new THREE.Vector3(1, 1, 1.4)); b.add(t, M, new THREE.Color('#c9ced4')); } return b.build(); }
function beltGeom() { const b = new Batch(); const M = new THREE.Matrix4(); b.add(new THREE.BoxGeometry(0.035, 0.008, 0.5).translate(0, 0, 0.26), M, new THREE.Color('#6b3a1a')); b.add(new THREE.BoxGeometry(0.06, 0.012, 0.06).translate(0, 0, 0.52), M, new THREE.Color('#d4a62a')); return b.build(); }
function bottleGeom() { const b = new Batch(); const M = new THREE.Matrix4(); b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8).translate(0, 0, 0), M, new THREE.Color('#5a3a0e')); b.add(new THREE.CylinderGeometry(0.014, 0.03, 0.08, 8).translate(0, 0.11, 0), M, new THREE.Color('#5a3a0e')); b.add(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 8), M, new THREE.Color('#ffd23f')); return b.build(); }
function lathiGeom() { const b = new Batch(); const M = new THREE.Matrix4(); b.add(new THREE.CylinderGeometry(0.016, 0.02, 1.0, 8).rotateX(Math.PI / 2).translate(0, 0, 0.46), M, new THREE.Color('#8a5426')); b.add(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8).rotateX(Math.PI / 2).translate(0, 0, 0.94), M, new THREE.Color('#d9c48a')); return b.build(); }
const CHAIN_G = chainGeom(), BELT_G = beltGeom(), BOTTLE_G = bottleGeom(), LATHI_G = lathiGeom();
// saria (bent rebar) and the katta (a crude pistol), weapon-hand space: +z down the forearm
const ROD_G = (() => { const b = new Batch(), M = new THREE.Matrix4(); M.makeTranslation(0, 0, 0.5); b.add(new THREE.CylinderGeometry(0.014, 0.014, 1.0, 6).rotateX(Math.PI / 2), M, new THREE.Color('#8a4a2a')); M.makeRotationX(0.6).setPosition(0, 0.05, 1.03); b.add(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 6).rotateX(Math.PI / 2), M, new THREE.Color('#7a3a1e')); return b.build(); })();
const GUN_G = (() => { const b = new Batch(), M = new THREE.Matrix4(); M.makeTranslation(0, 0.03, 0.12); b.add(new THREE.BoxGeometry(0.035, 0.04, 0.22), M, new THREE.Color('#3a3c42')); M.makeRotationX(0.35).setPosition(0, -0.02, 0.03); b.add(new THREE.BoxGeometry(0.03, 0.09, 0.04), M, new THREE.Color('#6b3e26')); return b.build(); })();
const SWOOSH_G = new THREE.RingGeometry(0.42, 1.25, 22, 1, -1.25, 2.5).rotateX(-Math.PI / 2);
const SHIRT_TEX_CACHE = {};
// boost exhaust jets: an additive cyan cone with a white-hot core (they bloom in the post pass)
const JET_G = new THREE.ConeGeometry(0.075, 0.75, 14, 1, true).translate(0, 0.375, 0).rotateX(-Math.PI / 2);
const JET_MAT = [new THREE.MeshBasicMaterial({ color: '#36c8ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })];

// ── swagger: style moves while riding (one hand off the bar) and reactions to being hit ──
// durations in seconds; 'smoke' is skipped when the player turns smoking off in Settings
const GESTURES = { smoke: 3.0, scratch: 1.7, hair: 1.4, mustache: 1.6, shades: 1.7, lookback: 1.4, shout: 1.3, glance: 0.7, wave: 1.5, drink: 1.35 };
let CIG = null;
function cigAssets() {
  if (CIG) return CIG; const b = new Batch(), M = new THREE.Matrix4();
  // a touch oversized (stylised) so it reads from the chase camera: white paper, tan filter, a glowing tip that blooms
  b.add(new THREE.CylinderGeometry(0.0065, 0.0065, 0.07, 8).translate(0, 0.015, 0), M, new THREE.Color('#f7f4ee'));
  b.add(new THREE.CylinderGeometry(0.0068, 0.0068, 0.025, 8).translate(0, -0.032, 0), M, new THREE.Color('#d08a35'));
  CIG = { g: b.build(), ember: new THREE.SphereGeometry(0.0075, 10, 8), emberMat: new THREE.MeshBasicMaterial({ color: '#ff6a1a' }) };
  return CIG;
}
const _gv = Array.from({ length: 6 }, () => new THREE.Vector3()), _ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// spinning spokes alias into a frozen or backwards wheel at speed (each frame turns them ~80°). Over the spokes sits a
// motion-blur disc: a blurred spoke sheet with bright streak arcs that turns at a readable rate, fading in with speed.
let WHEEL_BLUR = null;
function wheelBlurAssets() {
  if (WHEEL_BLUR) return WHEEL_BLUR;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), C = N / 2;
  const g = x.createRadialGradient(C, C, C * 0.28, C, C, C); g.addColorStop(0, 'rgba(150,154,162,0.5)'); g.addColorStop(0.75, 'rgba(176,180,188,0.62)'); g.addColorStop(0.96, 'rgba(120,124,132,0.7)'); g.addColorStop(1, 'rgba(90,92,98,0)');
  x.fillStyle = g; x.beginPath(); x.arc(C, C, C, 0, 7); x.fill();
  // streak arcs: a bright head that fades along its tail (the eye reads the direction and the spin)
  const arc = (a0, len, r0, r1, rgb, a) => { for (let i = 0; i < 24; i++) { const t = i / 24; x.strokeStyle = `rgba(${rgb},${(a * (1 - t) * (1 - t)).toFixed(3)})`; x.lineWidth = (r1 - r0) * C; x.beginPath(); x.arc(C, C, (r0 + r1) / 2 * C, a0 - t * len, a0 - (t + 1 / 24) * len, true); x.stroke(); } };
  arc(0.3, 1.25, 0.46, 0.62, '255,255,255', 0.75); arc(3.4, 1.0, 0.66, 0.8, '255,255,255', 0.55); arc(1.9, 0.9, 0.34, 0.44, '40,42,48', 0.6); arc(5.0, 0.8, 0.82, 0.9, '40,42,48', 0.5);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  WHEEL_BLUR = { tex, gF: new THREE.RingGeometry(0.06, 0.2, 40, 1).rotateY(Math.PI / 2), gR: new THREE.RingGeometry(0.06, 0.188, 40, 1).rotateY(Math.PI / 2) };
  for (const k of ['gF', 'gR']) { const uv = WHEEL_BLUR[k].attributes.uv, p = WHEEL_BLUR[k].attributes.position, R = k === 'gF' ? 0.2 : 0.188; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getZ(i) / R * 0.5 + 0.5, p.getY(i) / R * 0.5 + 0.5); }
  return WHEEL_BLUR;
}
class BikeRig {
  constructor(o) {
    this.o = o;
    if (!DECAL_MAT) DECAL_MAT = new THREE.MeshLambertMaterial({ map: TEX.signs, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide });
    this.root = new THREE.Group();
    this.lean = new THREE.Group(); this.root.add(this.lean);
    this.pitchG = new THREE.Group(); this.lean.add(this.pitchG);
    this.body = new THREE.Group(); this.pitchG.add(this.body);
    this.geoms = [];
    this.model = BIKE_MODEL.ready && !o.basic;
    const F = this.fit = this.model ? MODEL_FIT : { hipY: 0.9, grip: [0.4, 1.03, 0.32] };
    if (this.model) {
      // real bike: shared geometry, per-paint material; wheels spin on axle pivots
      const low = typeof GAME !== 'undefined' && GAME && GAME.quality === 'low';
      const P = BIKE_MODEL.parts, bodyMat = paintedBikeMat(o.tank, (o.mods && o.mods.finish) || (o.chrome ? 'chrome' : 'gloss'), low), tyre = tyreMatFor(low);
      const pick = (m) => m === P.tyreMat ? tyre : bodyMat;
      const cast = !o.lod || (typeof GAME !== 'undefined' && GAME && GAME.quality === 'high');   // rivals: blob shadow only, unless on high
      this.body.add(modelPart(o.lod ? P.lod : P.body, null, pick, cast));
      this.wheelR = modelPart(P.wheelR, [0, WHEEL_R_M, REAR_Z], pick, cast); this.wheelF = modelPart(P.wheelF, [0, WHEEL_R_M, FRONT_Z], pick, cast);
      this.body.add(this.wheelR, this.wheelF);
      const lg = modelLightsGeom(o.neon); this.geoms.push(lg); this.lights = new THREE.Mesh(lg, LIGHT_MAT); this.body.add(this.lights);
      if (o.mods && !o.ghost) this.mods = addBikeMods(this, o, low, cast);
      if (!o.ghost) { const W = wheelBlurAssets(); this.blurMat = new THREE.MeshLambertMaterial({ map: W.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }); this.blurs = [];
        for (const [wh, geo] of [[this.wheelF, W.gF], [this.wheelR, W.gR]]) { const grp = new THREE.Group(); for (const sx of [1, -1]) { const m = new THREE.Mesh(geo, this.blurMat); m.position.x = sx * 0.058; m.renderOrder = 2; grp.add(m); } grp.visible = false; this.body.add(grp); this.blurs.push({ grp, wh }); }
        this.blurAng = Math.random() * 6; }
      if (!o.ghost) { this.jets = []; for (const sx of [-1, 1]) { const j = new THREE.Group(); j.position.set(sx * 0.13, 0.33, -0.95); j.rotation.x = -0.12;
        const outer = new THREE.Mesh(JET_G, JET_MAT[0]), core = new THREE.Mesh(JET_G, JET_MAT[1]); core.scale.set(0.45, 0.55, 0.45); j.add(outer, core); j.visible = false; this.body.add(j); this.jets.push(j); } }
    } else {
      const bg = bikeBodyGeom(o); this.geoms.push(bg);
      const bm = new THREE.Mesh(bg, BIKE_MAT); bm.castShadow = true; this.body.add(bm);
      this.wheelR = new THREE.Mesh(WHEEL_GEOM, BIKE_MAT); this.wheelR.position.set(0, WHEEL_R, REAR_Z); this.wheelR.castShadow = true;
      this.wheelF = new THREE.Mesh(WHEEL_GEOM, BIKE_MAT); this.wheelF.position.set(0, WHEEL_R, FRONT_Z); this.wheelF.castShadow = true;
      this.body.add(this.wheelR, this.wheelF);
      const lg = lightsGeom(o.neon); this.geoms.push(lg); this.lights = new THREE.Mesh(lg, LIGHT_MAT); this.body.add(this.lights);
      const dg = decalGeom(o); this.geoms.push(dg); this.body.add(new THREE.Mesh(dg, DECAL_MAT));
    }
    // rider: the skinned model when it loaded, else the built-in primitive rider. The groups below carry the pose either way.
    const castRider = !o.lod || (typeof GAME !== 'undefined' && GAME && GAME.quality === 'high');
    this.rm = RIDER_MODEL.ready && !o.basicRider ? new RiderModel(o, this, castRider) : null;
    this.torsoG = new THREE.Group(); this.torsoG.position.set(0, F.hipY, -0.32); this.body.add(this.torsoG);
    this.headG = new THREE.Group(); this.headG.position.set(0, 0.66, 0.02); this.torsoG.add(this.headG);
    this.armL = new THREE.Group(); this.armR = new THREE.Group(); this.body.add(this.armL, this.armR);
    this.legL = new THREE.Group(); this.legR = new THREE.Group(); this.legL.position.set(0.12, F.hipY, -0.3); this.legR.position.set(-0.12, F.hipY, -0.3); this.body.add(this.legL, this.legR);
    if (!this.rm) {
      const shirtKey = o.shirt + (o.flowers ? 'f' : o.check ? 'c' : 'p');
      if (!SHIRT_TEX_CACHE[shirtKey]) SHIRT_TEX_CACHE[shirtKey] = shirtTexture(o.shirt, o.flowers ? 'flowers' : o.check ? 'check' : 'plain');
      this.shirtMat = new THREE.MeshLambertMaterial({ map: SHIRT_TEX_CACHE[shirtKey] });
      const tg = new THREE.CylinderGeometry(0.175, 0.16, 0.56, 10); tg.translate(0, 0.28, 0); tg.scale(1, 1, 0.7); this.geoms.push(tg);
      const torso = new THREE.Mesh(tg, this.shirtMat); torso.castShadow = true; this.torsoG.add(torso);
      const cg = new THREE.CylinderGeometry(0.1, 0.16, 0.06, 10).translate(0, 0.56, 0).scale(1, 1, 0.75); this.geoms.push(cg); this.torsoG.add(new THREE.Mesh(cg, this.shirtMat));
      const hg = headGeom(o); this.geoms.push(hg);
      const head = new THREE.Mesh(hg, BIKE_MAT); head.castShadow = true; this.headG.add(head);
      const ag = armGeom(o.shirt); this.geoms.push(ag);
      const aL = new THREE.Mesh(ag, BIKE_MAT), aR = new THREE.Mesh(ag, BIKE_MAT); aL.castShadow = aR.castShadow = true; this.armL.add(aL); this.armR.add(aR);
      const lgm = legGeom(o.jeans || '#2b3a6a'); this.geoms.push(lgm);
      const llm = new THREE.Mesh(lgm, BIKE_MAT), lrm = new THREE.Mesh(lgm, BIKE_MAT); llm.castShadow = lrm.castShadow = true; lrm.scale.x = -1; this.legL.add(llm); this.legR.add(lrm);
    }
    // weapons in hand (right hand by default)
    this.weapon = new THREE.Group(); this.wPitch = 0;
    if (this.rm) this.body.add(this.weapon); else { this.weapon.position.set(0, 0, 0.58); this.armR.add(this.weapon); }
    this.wChain = new THREE.Mesh(CHAIN_G, BIKE_MAT); this.wBelt = new THREE.Mesh(BELT_G, BIKE_MAT); this.wBottle = new THREE.Mesh(BOTTLE_G, BIKE_MAT); this.wLathi = new THREE.Mesh(LATHI_G, BIKE_MAT); this.wRod = new THREE.Mesh(ROD_G, BIKE_MAT); this.wGun = new THREE.Mesh(GUN_G, BIKE_MAT);
    this.weapon.add(this.wChain, this.wBelt, this.wBottle, this.wLathi, this.wRod, this.wGun); this.showWeapon(null);
    // the swing arc: a ring of light that sweeps round the side you strike
    if (!o.ghost) { this.swooshMat = new THREE.MeshBasicMaterial({ map: TEX.swoosh, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0, color: 0xfff1c0 }); this.swoosh = new THREE.Mesh(SWOOSH_G, this.swooshMat); this.swoosh.visible = false; this.swoosh.renderOrder = 4; this.body.add(this.swoosh); }
    if (this.rm && !o.ghost) { if (!TEX.stingCan) streetTextures(); this.can = new THREE.Mesh(CAN_G, new THREE.MeshLambertMaterial({ map: TEX.stingCan, emissiveMap: TEX.stingCan, emissive: 0x444444 })); this.can.scale.setScalar(0.42); this.can.visible = false; this.body.add(this.can); }
    if (this.rm && !o.ghost) { const C = cigAssets(); this.cig = new THREE.Mesh(C.g, BIKE_MAT); const em = new THREE.Mesh(C.ember, C.emberMat); em.position.y = 0.05; em.scale.y = 0.6; this.cig.add(em); this.cig.visible = false; this.body.add(this.cig); }
    // blob shadow
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false, opacity: 0.8 }));
    this.blob.position.y = 0.03; this.blob.renderOrder = 1; this.root.add(this.blob);
    // pose state
    this.t = 0; this.tuck = 0.4; this.anim = null; this.wheelSpin = 0; this.head = { yaw: 0, pitch: 0 };
    this._shL = new THREE.Vector3(); this._shR = new THREE.Vector3(); this._dir = new THREE.Vector3(); this._gL = new THREE.Vector3(); this._gR = new THREE.Vector3();
  }
  // neon underglow: a pink-to-cyan pool of light under the bike (the player's ride)
  addUnderglow() { if (this.glow) return; const [c, x] = mkCanvas(64, 128); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(63,232,255,0)'); g.addColorStop(0.25, 'rgba(63,232,255,0.9)'); g.addColorStop(0.75, 'rgba(255,46,136,0.9)'); g.addColorStop(1, 'rgba(255,46,136,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 128);
    const r = x.createRadialGradient(32, 64, 4, 32, 64, 46); x.globalCompositeOperation = 'destination-in'; r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, 64, 128);
    this.glowTex = new THREE.CanvasTexture(c); this.glowMat = new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -2 });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.7).rotateX(-Math.PI / 2), this.glowMat); this.glow.position.y = 0.035; this.glow.renderOrder = 2; this.root.add(this.glow); }
  showWeapon(kind) { this.wChain.visible = kind === 'chain'; this.wBelt.visible = kind === 'belt'; this.wBottle.visible = kind === 'bottle'; this.wLathi.visible = kind === 'lathi'; this.wRod.visible = kind === 'rod'; this.wGun.visible = kind === 'katta'; this.heldKind = kind; }
  play(name, side = 1, dur = 0.4) { this.anim = { name, side, t: 0, dur }; }
  // a style move, if the hands are free; false when something else is playing (or there's no skinned rider)
  gesture(name, side = 1) { if (this.anim || !this.rm || !GESTURES[name]) return false; this.play(name, side, GESTURES[name]); return true; }
  // reactions: a hit snaps the body, then (often) he turns and shouts at whoever did it; a bump is a quick glance
  react(kind, side) {
    if (!this.rm) return;
    if (kind === 'hit') { this.play('hit', side, 0.35); this.queued = Math.random() < 0.65 ? ['shout', side] : null; }
    else if (kind === 'bump' && !this.anim) this.play('glance', side, GESTURES.glance);
  }
  setPitch(p) { // p>0 wheelie (pivot rear contact), p<0 stoppie (pivot front contact)
    const pivotZ = p >= 0 ? REAR_Z : FRONT_Z; const a = -p;
    this.pitchG.rotation.x = a;
    const cz = pivotZ, cy = 0; const y2 = cy * Math.cos(a) - cz * Math.sin(a), z2 = cy * Math.sin(a) + cz * Math.cos(a);
    this.pitchG.position.set(0, cy - y2, cz - z2);
  }
  // st: { lean, pitch, speed, tuck(0..1), weightBack, steer, crashed, crashT, slide, celebrate, idle }
  update(dt, st) {
    this.t += dt;
    if (this.jets) { const on = !!st.boost && !st.crashed; for (const j of this.jets) { j.visible = on; if (on) { const k = 0.8 + Math.random() * 0.45; j.scale.set(k, k, 0.75 + Math.random() * 0.7); } } }
    if (this.mods && this.mods.siren) { const ph = Math.floor((this.t + this.mods.sirenPh) * 7) % 4; this.mods.siren[0].visible = ph < 2 && ph !== 1 || ph === 1; this.mods.siren[1].visible = ph >= 2; }
    if (this.mods && this.mods.flames.length) { const on = !!st.boost && !st.crashed; for (const f of this.mods.flames) { f.visible = on; if (on) { const k = 0.75 + Math.random() * 0.5; f.scale.set(k, k, 0.6 + Math.random() * 0.9); } } }
    if (this.glow) { this.glow.visible = !st.crashed; this.glowMat.opacity = st.boost ? 1 : 0.6; }
    this.lean.rotation.z = -st.lean * 1.12; this.lean.rotation.y = st.slide || 0; this.leanNow = st.lean || 0;
    this.setPitch(st.pitch || 0);
    // suspension: the frame bounces on the wheels; the rider's weight lags behind it
    const su = (st.susp || 0) * 0.9, wr = this.model ? WHEEL_R_M : WHEEL_R; this.body.position.y = su + (this.mods ? this.mods.lift : 0); this.wheelR.position.y = wr - su; this.wheelF.position.y = wr - su;
    this.bobV = (this.bobV || 0) + (((su - (this.bob || 0)) * 140) - this.bobV * 10) * Math.min(dt, 0.05); this.bob = (this.bob || 0) + this.bobV * Math.min(dt, 0.05);
    this.riderLag = clamp(this.bob - su, -0.08, 0.08);
    const wRate = (st.speed || 0) / WHEEL_R; this.wheelSpin += wRate * dt; this.wheelR.rotation.x = this.wheelSpin; this.wheelF.rotation.x = st.pitch < -0.05 ? this.wheelF.rotation.x : this.wheelSpin;
    if (this.blurs) {
      const op = clamp(((st.speed || 0) - 2.5) / 7, 0, 1) * 0.88, cam = typeof GAME !== 'undefined' && GAME && GAME.camera, near = !cam || cam.position.distanceToSquared(this.root.position) < 1600;
      this.blurMat.opacity = op; this.blurAng += Math.min(wRate, 9 + wRate * 0.12) * dt;
      for (const b of this.blurs) { b.grp.visible = op > 0.02 && near; if (b.grp.visible) { b.grp.position.copy(b.wh.position); b.grp.rotation.x = b.wh === this.wheelF && st.pitch < -0.05 ? b.grp.rotation.x : this.blurAng; } }
    }
    this.blob.scale.set(1 - Math.min(0.5, Math.abs(st.lean) * 0.6), 1, 1); this.blob.position.x = -Math.sin(st.lean) * 0.35; this.blob.material.opacity = st.air ? 0.35 : 0.8;
    // torso: tuck forward on straights, sit back for wheelies, look around
    const tuckTarget = st.idle ? 0.12 : st.weightBack ? -0.05 : 0.32 + 0.38 * (st.tuck || 0) + Math.min(0.32, Math.abs(st.lean) * 0.5);   // dives low into corners
    this.tuck = smooth(this.tuck, tuckTarget, 6, dt);
    this.torsoG.rotation.x = this.tuck; this.torsoG.rotation.z = -st.lean * 0.55; this.torsoG.rotation.y = 0; this.torsoG.position.y = this.fit.hipY + this.riderLag;
    this.headG.rotation.set(-this.tuck * 0.7 + (st.idle ? -0.35 : 0), this.head.yaw, -st.lean * 0.2);
    // limbs default: hands on grips, feet on pegs
    this.legL.rotation.set(0, 0, 0); this.legR.rotation.set(0, 0, 0);
    const G = this.fit.grip; let armLTarget = this._gL.set(G[0], G[1], G[2]), armRTarget = this._gR.set(-G[0], G[1], G[2]);
    const A = this.anim;
    if (A) {
      A.t += dt; const ph = clamp(A.t / A.dur, 0, 1), s = A.side; // side: +1 = rider's left, -1 = right
      const pulse = Math.sin(ph * Math.PI);
      if (this.swoosh) { const sw = A.name === 'swing' || A.name === 'kick'; this.swoosh.visible = sw; if (sw) { const k = clamp((ph - 0.3) / 0.5, 0, 1); this.swooshMat.opacity = Math.sin(k * Math.PI) * 0.85; this.swoosh.scale.set(s, 1, 1); this.swoosh.position.set(0, A.name === 'kick' ? 0.75 : 1.35, -0.2); this.swoosh.rotation.set(0, s * (0.9 - k * 1.8), s * (A.name === 'kick' ? -0.3 : 0.35)); } }
      if (A.name === 'kick') { const leg = s > 0 ? this.legL : this.legR; const e = ph < 0.3 ? ph / 0.3 : ph < 0.55 ? 1 : 1 - (ph - 0.55) / 0.45; leg.rotation.z = s * 1.45 * e; leg.rotation.x = -0.55 * e; this.torsoG.rotation.z -= s * 0.38 * e; this.torsoG.rotation.y += s * 0.2 * e; }
      else if (A.name === 'swing') { // windup back/up, then sweep across to the side
        const arm = s > 0 ? 'L' : 'R'; const wind = ph < 0.45 ? ph / 0.45 : 1 - (ph - 0.45) / 0.55;
        const tgt = new THREE.Vector3(s * (0.55 + 0.35 * (1 - wind)), 1.35 + 0.45 * wind, -0.35 * wind + 0.25 * (1 - wind));
        if (arm === 'L') armLTarget = tgt; else armRTarget = tgt;
        this.wPitch = -1.2 * wind + 0.4; this.torsoG.rotation.y = s * 0.4 * pulse;
      } else if (A.name === 'throw') { const tgt = ph < 0.4 ? new THREE.Vector3(-0.35, 1.6, -0.4) : new THREE.Vector3(-0.3, 1.25, 0.9); armRTarget = tgt; }
      else if (A.name === 'aim' || A.name === 'aimBack') {   // katta: arm out straight at the target, a kick of recoil
        const back = A.name === 'aimBack', rc = ph > 0.25 && ph < 0.4 ? 0.12 : 0; armRTarget = back ? new THREE.Vector3(-0.62, 1.55 + rc, -0.75) : new THREE.Vector3(-0.32 + s * 0.15, 1.5 + rc, 0.95 - rc); this.wPitch = 0.1;
        if (back) { this.torsoG.rotation.y -= 0.55; this.headG.rotation.y = -1.2; } else this.headG.rotation.y = s * 0.25; }
      else if (A.name === 'spit') { this.headG.rotation.x += 0.35 * pulse; this.headG.rotation.y = s * 1.1 * pulse; }
      else if (A.name === 'hit') { this.torsoG.rotation.z += s * 0.45 * pulse; this.headG.rotation.z += s * 0.5 * pulse; }
      else if (this.rm && GESTURES[A.name]) { const T = this.gestureTargets(A, ph, armLTarget, armRTarget); armLTarget = T[0]; armRTarget = T[1]; }
      if (A.t >= A.dur) { this.anim = null; if (this.swoosh) this.swoosh.visible = false; if (this.can) this.can.visible = false; if (this.cig) this.cig.visible = false; if (this.rm && this.rm.shades) { this.rm.shades.position.y = this.rm.shades.userData.y0; this.rm.shades.rotation.x = 0; }
        if (this.queued) { const [n, sd] = this.queued; this.queued = null; this.play(n, sd, GESTURES[n]); } }
    }
    if (st.celebrate && !this.free) { armRTarget = new THREE.Vector3(-0.35, 1.95, 0.0); }
    if (this.free) { const fr = this.free; this.torsoG.rotation.set(fr.torsoX, fr.torsoY || 0, fr.torsoZ || 0); this.headG.rotation.set(fr.headX || 0, fr.headY || 0, fr.headZ || 0); armLTarget = fr.hands.l; armRTarget = fr.hands.r; }
    if (st.crashed) { this.torsoG.rotation.x = -0.6; armLTarget = new THREE.Vector3(0.6, 1.4, 0.1); armRTarget = new THREE.Vector3(-0.6, 1.4, 0.1); }
    if (this.rm) {
      const wind = this.free ? this.free.wind || 0 : st.speed || 0; this.rm.setWind(wind, this.t);
      // far-away riders re-pose less often (the bike's lean and pitch still move every frame)
      const cam = typeof GAME !== 'undefined' && GAME && GAME.camera; const far = cam ? cam.position.distanceToSquared(this.root.position) : 0;
      this._poseN = (this._poseN || 0) + 1; const every = far > 3600 ? 4 : far > 625 ? 2 : 1;
      if (this._poseN % every === 0 || this.anim || st.crashed) { this.rm.pose(this, armLTarget, armRTarget, !!st.crashed); this.placeWeapon(); this.placeCig(); this.placeCan(); }
      if (far < 4900) this.rm.cloth.step(dt, wind, far > 900);
      return;
    }
    this.weapon.rotation.x = this.wPitch;
    // shoulders in body space
    const ct = Math.cos(this.tuck), stt = Math.sin(this.tuck);
    const shY = this.fit.hipY + 0.5 * ct, shZ = -0.32 + 0.5 * stt;
    this._shL.set(0.2, shY, shZ); this._shR.set(-0.2, shY, shZ);
    this.aimArm(this.armL, this._shL, armLTarget); this.aimArm(this.armR, this._shR, armRTarget);
  }
  placeWeapon() { // weapon in the right fist, pointing down the forearm
    if (!this.heldKind) return;
    const side = this.anim && this.anim.name === 'swing' && this.anim.side > 0 ? 'l' : 'r';   // left-hand swings carry the weapon in the left fist
    const h = this.rm.hand(side), dir = _wv[2].subVectors(h, this.rm.elbow(side)).normalize();
    this.weapon.position.copy(h).addScaledVector(dir, 0.06); this.weapon.quaternion.setFromUnitVectors(Z_AXIS, dir).multiply(_wq.setFromAxisAngle(_wv[3].set(1, 0, 0), this.wPitch * 0.6));
  }
  // hand targets (bike-body space) and head/torso offsets for one frame of a style move. ph: 0..1 through the move
  gestureTargets(A, ph, aL, aR) {
    const F = this.rm.face, H = this.headG.rotation, t = A.t, s = A.side, G = this.fit.grip;
    const gR = _gv[0].set(-G[0], G[1], G[2]), gL = _gv[1].set(G[0], G[1], G[2]); let L = aL, R = aR;
    const env = (a, b, c, d) => _ss(a, b, ph) * (1 - _ss(c, d, ph));
    if (A.name === 'smoke') {   // drag, head back, blow it out to the side, flick the ash, back to the bar
      const reach = env(0, 0.12, 0.86, 1), out = env(0.38, 0.5, 0.8, 0.88);
      const mouth = _gv[2].copy(F.mouth).add(_gv[3].set(-0.035, -0.055, 0.03));
      const hold = _gv[3].set(-0.44, F.mouth.y - 0.44, F.mouth.z - 0.1);   // hand dropped out by the side, the cigarette pointing out if (ph > 0.6 && ph < 0.7) hold.y += Math.sin((ph - 0.6) * 60) * 0.025;
      R = _gv[4].copy(gR).lerp(mouth.lerp(hold, out), reach);
      H.x -= 0.2 * env(0.14, 0.24, 0.34, 0.42); H.y -= 0.4 * env(0.38, 0.46, 0.62, 0.74); H.x -= 0.1 * env(0.38, 0.46, 0.62, 0.74);
      if (this.cig) { this.cig.visible = ph > 0.04 && ph < 0.92; this.cig.children[0].material.color.setRGB(1, 0.32 + 0.3 * env(0.15, 0.2, 0.34, 0.4), 0.08); }
      if (this.onPuff && ((ph > 0.42 && ph < 0.64) || (ph > 0.25 && ph < 0.34 && Math.random() < 0.3))) this.onPuff(this.rm.marks.mouth, ph > 0.42 ? 1 : 0.4);
      else if (this.onPuff && this.cig && this.cig.visible && Math.random() < 0.35) this.onPuff(this.cig.children[0], 0.3);   // a thin wisp off the tip
    } else if (A.name === 'scratch') {   // left hand into the back of the hair, a few scratches, head tipped
      const reach = env(0, 0.2, 0.8, 1), osc = env(0.25, 0.3, 0.72, 0.78);
      L = _gv[4].copy(gL).lerp(_gv[2].copy(F.crown).add(_gv[3].set(0.05 + Math.sin(t * 24) * 0.02 * osc, -0.08, -0.07 + Math.cos(t * 24) * 0.014 * osc)), reach);
      H.z += 0.16 * reach; H.x += 0.12 * reach;
    } else if (A.name === 'hair') {   // comb the pompadour back with the right hand, chin up
      const reach = env(0, 0.15, 0.75, 1), u = _ss(0.15, 0.68, ph);
      const front = _gv[2].copy(F.brow).add(_gv[3].set(-0.03, -0.04, 0.09)), back = _gv[5].copy(F.crown).add(_gv[3].set(-0.03, -0.02, -0.1));
      R = _gv[4].copy(gR).lerp(front.lerp(back, u), reach); H.x -= 0.18 * reach * (0.4 + u * 0.6); H.y -= 0.12 * reach;
    } else if (A.name === 'mustache') {   // twirl the right end of the moustache, smug look to the side
      const reach = env(0, 0.18, 0.78, 1), osc = env(0.2, 0.26, 0.7, 0.76), a = t * 18;
      R = _gv[4].copy(gR).lerp(_gv[2].copy(F.lipR).add(_gv[3].set(-0.03 + Math.cos(a) * 0.012 * osc, -0.06 + Math.sin(a) * 0.012 * osc, 0.035)), reach);
      H.y -= 0.32 * reach; H.x -= 0.1 * reach; H.z -= 0.08 * reach;
    } else if (A.name === 'shades') {   // left hand to the frame, dip the shades and look over them
      const reach = env(0, 0.18, 0.8, 1), dip = env(0.22, 0.36, 0.66, 0.8);
      L = _gv[4].copy(gL).lerp(_gv[2].copy(F.tL).add(_gv[3].set(0.03, -0.075, -0.005)), reach);
      H.x += 0.2 * dip; H.y += 0.15 * reach;
      if (this.rm.shades) { this.rm.shades.position.y = this.rm.shades.userData.y0 - 0.016 * dip; this.rm.shades.rotation.x = 0.22 * dip; }
    } else if (A.name === 'lookback') {   // over the shoulder at the riders behind, chin up
      const k = env(0, 0.25, 0.7, 1); H.y += s * 1.1 * k; H.x -= 0.1 * k; this.torsoG.rotation.y += s * 0.3 * k;
    } else if (A.name === 'shout') {   // turn on the guy who hit you and shake a fist at him
      const reach = env(0, 0.18, 0.78, 1), shake = env(0.2, 0.26, 0.7, 0.76);
      const fist = _gv[2].set(s * 0.62, this.fit.hipY + 0.62 + Math.sin(t * 26) * 0.045 * shake, 0.22);
      if (s > 0) L = _gv[4].copy(gL).lerp(fist, reach); else R = _gv[4].copy(gR).lerp(fist, reach);
      H.y += s * 0.85 * reach; this.torsoG.rotation.y += s * 0.2 * reach; this.torsoG.rotation.z -= s * 0.1 * reach;
    } else if (A.name === 'glance') { H.y += s * 0.75 * Math.sin(ph * Math.PI); }
    else if (A.name === 'drink') {   // Sting: can up, head back, chug, crush it and toss it away
      const reach = env(0, 0.16, 0.8, 0.95), tip = env(0.2, 0.32, 0.62, 0.74), toss = _ss(0.74, 0.86, ph);
      const mouth = _gv[2].copy(F.mouth).add(_gv[3].set(-0.05, -0.02, 0.06)), out = _gv[5].set(-0.75, F.mouth.y - 0.1, F.mouth.z - 0.3);
      R = _gv[4].copy(gR).lerp(mouth.lerp(out, toss), reach); H.x -= 0.5 * tip; this.torsoG.rotation.x -= 0.12 * tip;
      if (this.can) this.can.visible = ph > 0.03 && ph < 0.84;
    }
    else if (A.name === 'wave') {   // a lazy two-finger salute off the brow
      const reach = env(0, 0.2, 0.7, 1), flick = _ss(0.35, 0.55, ph);
      R = _gv[4].copy(gR).lerp(_gv[2].copy(F.brow).add(_gv[3].set(-0.06 - flick * 0.25, -0.03 + flick * 0.05, 0.05 + flick * 0.15)), reach); H.y -= 0.25 * reach; H.z -= 0.1 * reach;
    }
    return [L, R];
  }
  placeCan() { if (!this.can || !this.can.visible) return; const h = this.rm.hand('r'); this.can.position.copy(h); this.can.position.y += 0.02; this.can.quaternion.setFromAxisAngle(_gv[0].set(1, 0, 0), -(this.headG.rotation.x) * 0.8 - 0.4); }
  // the cigarette sits between the right fingers, across the forearm
  placeCig() {
    if (!this.cig || !this.cig.visible) return; const h = this.rm.hand('r'), dir = _gv[0].subVectors(h, this.rm.elbow('r')).normalize();
    this.cig.position.copy(h).addScaledVector(dir, 0.075); const side = _gv[1].crossVectors(dir, _gv[2].set(0, 1, 0)); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
    const ax = side.multiplyScalar(-1).addScaledVector(dir, 0.35).normalize(); this.cig.quaternion.setFromUnitVectors(_gv[2].set(0, 1, 0), ax);
    this.cig.position.addScaledVector(ax, 0.035);   // most of it sticks out past the knuckles
  }
  aimArm(arm, sh, target) { arm.position.copy(sh); this._dir.subVectors(target, sh); const len = this._dir.length(); this._dir.normalize(); arm.quaternion.setFromUnitVectors(Z_AXIS, this._dir); arm.scale.set(1, 1, clamp(len / 0.57, 0.6, 1.25)); }
  dispose() { this.geoms.forEach(g => g.dispose()); if (this.shirtMat) this.shirtMat.dispose(); if (this.blurMat) this.blurMat.dispose(); if (this.swooshMat) this.swooshMat.dispose(); if (this.glow) { this.glow.geometry.dispose(); this.glowMat.dispose(); this.glowTex.dispose(); } if (this.can) this.can.material.dispose(); if (this.rm) this.rm.dispose(); this.blob.geometry.dispose(); this.blob.material.dispose(); if (this.mods && this.mods.ownMats) this.mods.ownMats.forEach(m => m.dispose()); }
}
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _wv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], _wq = new THREE.Quaternion();
