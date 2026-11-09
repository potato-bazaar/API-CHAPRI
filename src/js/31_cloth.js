// ───────────────────────── SHIRT CLOTH ─────────────────────────
// The open chapri shirt: three verlet cloth panels (back + two fronts) pinned along the yoke and side seams to the
// torso bones, pushed by the rush of air, gravity and turbulence, kept off the body by a chain of spheres.
// Simulated in bike-body space (the frame the rider sits in). Under it: a white baniyan painted on the body.
const SHIRT_DIM = { hi: { back: [8, 8], front: [5, 7] }, lo: { back: [5, 5], front: [3, 5] } };
// torso cross-section of the slimmed body (bind space): half-width, front z, back z by height
const TORSO = [[0.93, 0.16, 0.072, -0.105], [1.0, 0.146, 0.076, -0.1], [1.1, 0.133, 0.089, -0.086], [1.2, 0.124, 0.096, -0.088], [1.3, 0.166, 0.113, -0.118], [1.4, 0.196, 0.11, -0.146]];   // fit build (tools/model/build-rider.mjs MEASURE=1)
function torsoAt(y, T = TORSO) { let i = 0; while (i < T.length - 2 && y > T[i + 1][0]) i++; const a = T[i], b = T[i + 1], t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
const CLOTH_BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03'];
const boneForY = (y) => y >= 1.31 ? 3 : y >= 1.18 ? 2 : 1;

class ShirtCloth {
  constructor(rm, rig, shirtTex, low, lod, cast, opt = {}) {
    this.rm = rm; this.rig = rig; this.acc = 0; this.t = Math.random() * 10; this.ready = false; this.inf = (opt.muscle || 0) * 0.02;   // muscle: the shirt sits further out
    const dim = lod ? SHIRT_DIM.lo : SHIRT_DIM.hi;
    // opt.torso / spheres / panels / mat: another body and cut (Dogesh's long jacket); opt.legs: drape over the thighs and shins
    this.torso = opt.torso || TORSO; this.jacket = !!opt.jacket; this.seatX = opt.seatX || 0.17; this.sharedMat = !!opt.mat;
    this.mat = opt.mat || (low ? new THREE.MeshLambertMaterial({ map: shirtTex, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map: shirtTex, side: THREE.DoubleSide, roughness: 0.82 }));
    this.panels = (opt.panels ? opt.panels(lod) : [
      [dim.back, -Math.PI / 2 - 1.22, -Math.PI / 2 + 1.22, 1.4, opt.hem || 0.92, [0, 1]],     // back, seams on both sides (cropped when the waistband shows)
      [dim.front, -0.35, 1.22, 1.4, 0.97, [0]],                                     // left front (rider's left = +x)
      [dim.front, Math.PI + 0.35, Math.PI - 1.22, 1.4, 0.97, [0]],                   // right front
    ]).map(d => this.panel(...d));
    for (const p of this.panels) { p.mesh.castShadow = cast; p.mesh.frustumCulled = false; p.mesh.userData.dyn = true; p.mesh.userData.reflKeep = true; rig.body.add(p.mesh); }   // dyn: never welded into a static mesh (BikeRig.mergeParts); reflKeep: it starts zero-sized
    this.D = CLOTH_BONES.map(() => new THREE.Matrix4()); this.sc = 1; this.off = new THREE.Vector3();
    this.spheres = opt.spheres || [[0, 1.0, -0.014, 0.15, 0], [0, 1.12, -0.004, 0.14, 1], [0, 1.24, 0.004, 0.136 + this.inf, 2], [0, 1.36, -0.018, 0.168 + this.inf * 1.2, 3]];
    this.sw = this.spheres.map(() => [new THREE.Vector3(), 0]); this._v = new THREE.Vector3(); this.g = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this.legs = opt.legs ? ['l', 'r'].map(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]) : null;   // hip, knee, ankle in bike-body space
  }
  // a cols×rows sheet wrapped around the torso from angle a0 to a1, from the yoke (y0) down to the hem (y1)
  panel([cols, rows], a0, a1, y0, y1, seams, seamY = 1.15, trimCol = -1) {
    const n = cols * rows, B = new Float32Array(n * 3), P = new Float32Array(n * 3), Q = new Float32Array(n * 3), pin = new Int8Array(n).fill(-1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, y = lerp(y0, y1, r / (rows - 1)), th = lerp(a0, a1, c / (cols - 1)); const [hw, zf, zb] = torsoAt(y, this.torso); const cz = (zf + zb) / 2, hd = (zf - zb) / 2, o = 0.02 + this.inf;
      B[i * 3] = (hw + o) * Math.cos(th); B[i * 3 + 1] = y; B[i * 3 + 2] = cz + (hd + o) * Math.sin(th);
      const seamCol = (seams.includes(0) && c === 0) || (seams.includes(1) && c === cols - 1);
      if (r === 0 || (seamCol && y >= seamY)) pin[i] = boneForY(y);
    }
    const E = []; const link = (a, b, k) => { const dx = B[a * 3] - B[b * 3], dy = B[a * 3 + 1] - B[b * 3 + 1], dz = B[a * 3 + 2] - B[b * 3 + 2]; E.push(a, b, Math.hypot(dx, dy, dz), k); };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c;
      if (c < cols - 1) link(i, i + 1, 1); if (r < rows - 1) link(i, i + cols, 1);
      if (c < cols - 1 && r < rows - 1) { link(i, i + cols + 1, 0.5); link(i + 1, i + cols, 0.5); }
      if (r < rows - 2) link(i, i + 2 * cols, 0.35); }   // bend
    const g = new THREE.BufferGeometry(); const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage); g.setAttribute('position', pos);
    const uv = new Float32Array(n * 2); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { uv[(r * cols + c) * 2] = c / (cols - 1) * (cols > 6 ? 1.9 : 0.9); uv[(r * cols + c) * 2 + 1] = 1 - r / (rows - 1) * 1.5; }
    if (this.jacket) {   // brocade by the metre (one tile = 25 cm) + gold zari along the hem and the front edge
      const tr = new Float32Array(n); for (let r = 0; r < rows; r++) { let u = 0; for (let c = 0; c < cols; c++) { const i = r * cols + c; if (c) u += Math.hypot(B[i * 3] - B[i * 3 - 3], B[i * 3 + 2] - B[i * 3 - 1]); uv[i * 2] = u / 0.25; uv[i * 2 + 1] = (y0 - B[i * 3 + 1]) / 0.25; tr[i] = r === rows - 1 || c === trimCol ? 1 : 0; } }
      g.setAttribute('_trim', new THREE.BufferAttribute(tr, 1)); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = []; for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) { const i = r * cols + c; idx.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1); }
    g.setIndex(idx); g.computeVertexNormals();
    return { cols, rows, n, B, P, Q, pin, E: new Float32Array(E), g, pos, mesh: new THREE.Mesh(g, this.mat) };
  }
  // called from RiderModel.pose (model space, root detached): remember how each torso bone moved since the bind pose
  capture(bones, invBind, sc, px, py, pz) { for (let k = 0; k < 4; k++) this.D[k].multiplyMatrices(bones[CLOTH_BONES[k]].matrixWorld, invBind[k]); this.sc = sc; this.off.set(px, py, pz); this.fresh = true;
    if (this.legs) ['l', 'r'].forEach((s, k) => ['thigh_', 'calf_', 'foot_'].forEach((b, j) => this.legs[k][j].setFromMatrixPosition(bones[b + s].matrixWorld).multiplyScalar(sc).add(this.off))); }
  toBody(k, x, y, z, out) { return out.set(x, y, z).applyMatrix4(this.D[k]).multiplyScalar(this.sc).add(this.off); }
  step(dt, speed, far) {
    if (!this.fresh) return;
    const rig = this.rig; this._q.copy(rig.lean.quaternion).multiply(rig.pitchG.quaternion).invert(); this.g.set(0, -9.81, 0).applyQuaternion(this._q);
    for (let s = 0; s < 4; s++) { const S = this.spheres[s]; this.toBody(S[4], S[0], S[1], S[2], this.sw[s][0]); this.sw[s][1] = S[3] * this.sc; }
    if (!this.ready) { for (const p of this.panels) for (let i = 0; i < p.n; i++) { this.toBody(p.pin[i] >= 0 ? p.pin[i] : boneForY(p.B[i * 3 + 1]), p.B[i * 3], p.B[i * 3 + 1], p.B[i * 3 + 2], this._v); p.P.set([this._v.x, this._v.y, this._v.z], i * 3); p.Q.set([this._v.x, this._v.y, this._v.z], i * 3); } this.ready = true; }
    const h = 1 / 60; this.acc = Math.min(this.acc + dt, far ? 1 / 60 : 0.05);
    while (this.acc >= h) { this.acc -= h; this.t += h; for (const p of this.panels) this.sub(p, h, speed); }
    for (const p of this.panels) { p.pos.array.set(p.P); p.pos.needsUpdate = true; p.g.computeVertexNormals(); p.g.computeBoundingSphere(); }
  }
  sub(p, h, v) {
    const P = p.P, Q = p.Q, pin = p.pin, g = this.g, t = this.t, h2 = h * h, v1 = Math.max(v, 0.4), off = !!this.rig.free;
    const turb = 1.2 + v1 * 0.2, kd = 1.9;
    for (let i = 0; i < p.n; i++) {
      const i3 = i * 3;
      if (pin[i] >= 0) { this.toBody(pin[i], p.B[i3], p.B[i3 + 1], p.B[i3 + 2], this._v); Q[i3] = P[i3] = this._v.x; Q[i3 + 1] = P[i3 + 1] = this._v.y; Q[i3 + 2] = P[i3 + 2] = this._v.z; continue; }
      const vx = (P[i3] - Q[i3]) / h, vy = (P[i3 + 1] - Q[i3 + 1]) / h, vz = (P[i3 + 2] - Q[i3 + 2]) / h;
      // air rushing back over the rider (slightly upward off the leaning back) + flapping turbulence
      const ph = t * (9 + v1 * 0.5) + i * 0.83;
      const wx = Math.sin(ph * 1.3) * turb * 0.9, wy = v1 * 0.14 + Math.sin(ph * 0.9 + 1.7) * turb * 0.7, wz = -v1 + Math.cos(ph) * turb * 0.6;
      const ax = g.x + (wx - vx) * kd, ay = g.y + (wy - vy) * kd, az = g.z + (wz - vz) * kd;
      const nx = P[i3] + (P[i3] - Q[i3]) * 0.985 + ax * h2, ny = P[i3 + 1] + (P[i3 + 1] - Q[i3 + 1]) * 0.985 + ay * h2, nz = P[i3 + 2] + (P[i3 + 2] - Q[i3 + 2]) * 0.985 + az * h2;
      Q[i3] = P[i3]; Q[i3 + 1] = P[i3 + 1]; Q[i3 + 2] = P[i3 + 2]; P[i3] = nx; P[i3 + 1] = ny; P[i3 + 2] = nz;
    }
    const E = p.E;
    for (let it = 0; it < 3; it++) {
      for (let e = 0; e < E.length; e += 4) {
        const a = E[e] * 3, b = E[e + 1] * 3, rest = E[e + 2] * this.sc, k = E[e + 3];
        const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2]; const d = Math.hypot(dx, dy, dz) || 1e-6;
        const pa = pin[E[e]] >= 0, pb = pin[E[e + 1]] >= 0; if (pa && pb) continue;
        const f = (d - rest) / d * k * (d > rest * 1.25 ? 1 : 0.85); const wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : pa ? 1 : 0.5;
        P[a] += dx * f * wa; P[a + 1] += dy * f * wa; P[a + 2] += dz * f * wa; P[b] -= dx * f * wb; P[b + 1] -= dy * f * wb; P[b + 2] -= dz * f * wb;
      }
      // keep off the torso and out of the seat
      for (let i = 0; i < p.n; i++) { if (pin[i] >= 0) continue; const i3 = i * 3;
        for (const [c, r] of this.sw) { const dx = P[i3] - c.x, dy = P[i3 + 1] - c.y, dz = P[i3 + 2] - c.z; const d2 = dx * dx + dy * dy + dz * dz; if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-6, m = (r - d) / d; P[i3] += dx * m; P[i3 + 1] += dy * m; P[i3 + 2] += dz * m; } }
        if (!off && Math.abs(P[i3]) < this.seatX && P[i3 + 2] < 0.05 && P[i3 + 2] > -0.8 && P[i3 + 1] < 0.9) P[i3 + 1] = 0.9;   // (off the bike: no seat under him)
        if (this.legs) { for (const L of this.legs) { this.capsule(P, i3, L[0], L[1], 0.095 * this.sc); this.capsule(P, i3, L[1], L[2], 0.07 * this.sc); }   // thighs and shins (churidar + a little air)
          if (!off && Math.abs(P[i3]) < 0.12 && P[i3 + 2] > -0.02 && P[i3 + 2] < 0.5 && P[i3 + 1] < 1.0 && P[i3 + 1] > 0.55) P[i3] = Math.sign(P[i3] || 1) * 0.12;   // the tank between the knees
          if (P[i3 + 1] < 0.05) P[i3 + 1] = 0.05; } }
    }
  }
  // push a cloth point out of a capsule a→b of radius r
  capsule(P, i3, a, b, r) {
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, L = abx * abx + aby * aby + abz * abz; if (L < 1e-8) return;
    const t = clamp(((P[i3] - a.x) * abx + (P[i3 + 1] - a.y) * aby + (P[i3 + 2] - a.z) * abz) / L, 0, 1);
    const dx = P[i3] - (a.x + abx * t), dy = P[i3 + 1] - (a.y + aby * t), dz = P[i3 + 2] - (a.z + abz * t), d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < r * r) { if (d2 < 1e-10) { P[i3 + 1] += r; return; } const d = Math.sqrt(d2), m = (r - d) / d; P[i3] += dx * m; P[i3 + 1] += dy * m; P[i3 + 2] += dz * m; }
  }
  dispose() { for (const p of this.panels) { p.mesh.removeFromParent(); p.g.dispose(); } if (!this.sharedMat) this.mat.dispose(); }
}

// ───────────────────────── CAPE ─────────────────────────
// A long cape (about 1.55 m) pinned across the shoulders to the upper spine. At speed it streams straight back in the
// rush of air with a flapping wave that runs down to the hem; stopped, it drapes over the seat and tail. Same verlet
// scheme as the shirt, in bike-body space. Outer cloth and lining are the two faces of one sheet.
const CAPE_DIM = { hi: [7, 15], lo: [5, 10] };
class CapeCloth {
  constructor(rm, rig, it, low, lod, cast, opt = {}) {
    this.rig = rig; this.t = Math.random() * 10; this.acc = 0; this.ready = false; this.fresh = false; const inf = (opt.muscle || 0) * 0.02;
    const [cols, rows] = lod ? CAPE_DIM.lo : CAPE_DIM.hi, n = cols * rows, L = 1.55, wt = 0.36, wb = 0.82;
    const B = new Float32Array(n * 3), F = new Float32Array(n * 2), pin = new Int8Array(n).fill(-1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, fr = r / (rows - 1), u = (c / (cols - 1) - 0.5) * lerp(wt, wb, fr), v = fr * L, k = u / (wt / 2);
      F[i * 2] = u; F[i * 2 + 1] = v;
      if (r === 0) { B[i * 3] = u; B[i * 3 + 1] = 1.43 + k * k * 0.02; B[i * 3 + 2] = -0.168 - inf + k * k * 0.075; pin[i] = 3; }   // across the shoulder blades, wrapping onto the shoulders
      else { B[i * 3] = u; B[i * 3 + 1] = 1.43 - v * 0.5; B[i * 3 + 2] = -0.17 - inf - v * 0.85; }   // first frame: already streaming back
    }
    const E = [], link = (a, b, k) => E.push(a, b, Math.hypot(F[a * 2] - F[b * 2], F[a * 2 + 1] - F[b * 2 + 1]), k);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c;
      if (c < cols - 1) link(i, i + 1, 1); if (r < rows - 1) link(i, i + cols, 1);
      if (c < cols - 1 && r < rows - 1) { link(i, i + cols + 1, 0.5); link(i + 1, i + cols, 0.5); }
      if (r < rows - 2) link(i, i + 2 * cols, 0.12); }   // soft lengthwise bend only: cross-wise bend links keep the shoulder curve all the way down and the cape stands out stiff like a tape measure
    const g = new THREE.BufferGeometry(), pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage); g.setAttribute('position', pos);
    const uv = new Float32Array(n * 2); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { uv[(r * cols + c) * 2] = c / (cols - 1); uv[(r * cols + c) * 2 + 1] = 1 - r / (rows - 1); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = []; for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) { const i = r * cols + c; idx.push(i, i + 1, i + cols, i + 1, i + cols + 1, i + cols); }   // front faces point away from the rider's back
    g.setIndex(idx);
    const T = capeTextures(it), mat = (map, side, glow) => {
      const o = { map, side, alphaTest: 0.5 }; if (glow) Object.assign(o, { emissive: new THREE.Color(it.glow), emissiveMap: glow, emissiveIntensity: 1.6 });
      return low ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign(o, { roughness: it.pattern === 'brocade' ? 0.45 : 0.7, metalness: it.pattern === 'brocade' ? 0.35 : 0 })); };
    this.mats = [mat(T.map, THREE.FrontSide, T.glow), mat(T.lining, THREE.BackSide, null)];
    this.meshes = this.mats.map(m => { const me = new THREE.Mesh(g, m); me.castShadow = cast; me.frustumCulled = false; me.userData.cloth = true; me.userData.reflKeep = true; rig.body.add(me); return me; });   // reflKeep: it starts zero-sized, the mirror must not judge it by that
    Object.assign(this, { cols, rows, n, B, pin, E: new Float32Array(E), g, pos, P: new Float32Array(n * 3), Q: new Float32Array(n * 3) });
    this.D = CLOTH_BONES.map(() => new THREE.Matrix4()); this.sc = 1; this.off = new THREE.Vector3();
    this.spheres = [[0, 1.0, -0.014, 0.16, 0], [0, 1.12, -0.004, 0.15, 1], [0, 1.24, 0.004, 0.146 + inf, 2], [0, 1.36, -0.018, 0.178 + inf * 1.2, 3], [0, 1.6, 0.0, 0.13, 3]];   // torso + head
    this.sw = this.spheres.map(() => [new THREE.Vector3(), 0]); this._v = new THREE.Vector3(); this.gv = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }
  capture(bones, invBind, sc, px, py, pz) { for (let k = 0; k < 4; k++) this.D[k].multiplyMatrices(bones[CLOTH_BONES[k]].matrixWorld, invBind[k]); this.sc = sc; this.off.set(px, py, pz); this.fresh = true; }
  toBody(k, x, y, z, out) { return out.set(x, y, z).applyMatrix4(this.D[k]).multiplyScalar(this.sc).add(this.off); }
  step(dt, speed, far) {
    if (!this.fresh) return;
    const rig = this.rig; this._q.copy(rig.lean.quaternion).multiply(rig.pitchG.quaternion).invert(); this.gv.set(0, -9.81, 0).applyQuaternion(this._q);
    for (let s = 0; s < this.spheres.length; s++) { const S = this.spheres[s]; this.toBody(S[4], S[0], S[1], S[2], this.sw[s][0]); this.sw[s][1] = S[3] * this.sc; }
    const P = this.P, Q = this.Q;
    if (!this.ready) {   // first frame: hang straight back and down from the shoulders in bike space (not tilted with the torso)
      const cols = this.cols, sc = this.sc;
      for (let i = 0; i < this.n; i++) { const c = i % cols, r = (i / cols) | 0; this.toBody(3, this.B[c * 3], this.B[c * 3 + 1], this.B[c * 3 + 2], this._v);
        const v = r / (this.rows - 1) * 1.55 * sc, x = r ? this._v.x * (1 + r / (this.rows - 1) * 1.25) : this._v.x;
        P[i * 3] = Q[i * 3] = x; P[i * 3 + 1] = Q[i * 3 + 1] = Math.max(0.9, this._v.y - v * 0.55); P[i * 3 + 2] = Q[i * 3 + 2] = this._v.z - v * 0.83; }
      this.ready = true; }
    const h = 1 / 60; this.acc = Math.min(this.acc + dt, far ? 1 / 60 : 0.05);
    while (this.acc >= h) { this.acc -= h; this.t += h; this.sub(h, speed); }
    this.pos.array.set(P); this.pos.needsUpdate = true; this.g.computeVertexNormals(); this.g.computeBoundingSphere();
  }
  sub(h, v) {
    const P = this.P, Q = this.Q, pin = this.pin, g = this.gv, t = this.t, h2 = h * h, v1 = Math.max(v, 0.4), cols = this.cols, rows = this.rows;
    const A = 1.3 + v1 * 0.16, kd = 1.5, fq = 6.5 + v1 * 0.32;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      if (pin[i] >= 0) { this.toBody(pin[i], this.B[i3], this.B[i3 + 1], this.B[i3 + 2], this._v); Q[i3] = P[i3] = this._v.x; Q[i3 + 1] = P[i3 + 1] = this._v.y; Q[i3 + 2] = P[i3 + 2] = this._v.z; continue; }
      const r = (i / cols) | 0, c = i - r * cols, fr = r / (rows - 1);
      const vx = (P[i3] - Q[i3]) / h, vy = (P[i3 + 1] - Q[i3 + 1]) / h, vz = (P[i3 + 2] - Q[i3 + 2]) / h;
      // the rush of air plus a flapping wave that travels down the cape and grows toward the hem
      const ph = t * fq - r * 0.78 + c * 0.33, amp = A * (0.25 + fr);
      const wx = Math.cos(ph * 0.7 + 1.1) * amp * 0.55, wy = v1 * 0.06 + Math.sin(ph) * amp, wz = -v1 + Math.sin(ph * 1.3 + 0.4) * amp * 0.35;
      const ax = g.x + (wx - vx) * kd, ay = g.y + (wy - vy) * kd, az = g.z + (wz - vz) * kd;
      const nx = P[i3] + (P[i3] - Q[i3]) * 0.985 + ax * h2, ny = P[i3 + 1] + (P[i3 + 1] - Q[i3 + 1]) * 0.985 + ay * h2, nz = P[i3 + 2] + (P[i3 + 2] - Q[i3 + 2]) * 0.985 + az * h2;
      Q[i3] = P[i3]; Q[i3 + 1] = P[i3 + 1]; Q[i3 + 2] = P[i3 + 2]; P[i3] = nx; P[i3 + 1] = ny; P[i3 + 2] = nz;
    }
    const E = this.E;
    for (let it = 0; it < 4; it++) {
      for (let e = 0; e < E.length; e += 4) {
        const a = E[e] * 3, b = E[e + 1] * 3, rest = E[e + 2] * this.sc, k = E[e + 3], pa = pin[E[e]] >= 0, pb = pin[E[e + 1]] >= 0; if (pa && pb) continue;
        const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
        const f = (d - rest) / d * k * (d > rest * 1.15 ? 1 : 0.85), wa = pa ? 0 : pb ? 1 : 0.5, wb = pb ? 0 : pa ? 1 : 0.5;
        P[a] += dx * f * wa; P[a + 1] += dy * f * wa; P[a + 2] += dz * f * wa; P[b] -= dx * f * wb; P[b + 1] -= dy * f * wb; P[b + 2] -= dz * f * wb;
      }
      for (let i = 0; i < this.n; i++) { if (pin[i] >= 0) continue; const i3 = i * 3;
        for (const [cc, rr] of this.sw) { const dx = P[i3] - cc.x, dy = P[i3 + 1] - cc.y, dz = P[i3 + 2] - cc.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-6, m = (rr - d) / d; P[i3] += dx * m; P[i3 + 1] += dy * m; P[i3 + 2] += dz * m; } }
        const x = P[i3], z = P[i3 + 2];   // over the seat and the tail, never through the rear wheel or the road
        if (Math.abs(x) < 0.25 && z < 0.1 && z > -1.08) { const top = z > -0.78 ? 0.86 : 0.76; if (P[i3 + 1] < top) P[i3 + 1] = top; }
        if (P[i3 + 1] < 0.04) P[i3 + 1] = 0.04;
      }
    }
  }
  dispose() { for (const m of this.meshes) m.removeFromParent(); this.g.dispose(); this.mats.forEach(m => m.dispose()); }
}
