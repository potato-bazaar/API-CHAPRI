// ───────────────────────── SHIRT CLOTH ─────────────────────────
// The open chapri shirt: three verlet cloth panels (back + two fronts) pinned along the yoke and side seams to the
// torso bones, pushed by the rush of air, gravity and turbulence, kept off the body by a chain of spheres.
// Simulated in bike-body space (the frame the rider sits in). Under it: a white baniyan painted on the body.
const SHIRT_DIM = { hi: { back: [8, 8], front: [5, 7] }, lo: { back: [5, 5], front: [3, 5] } };
// torso cross-section of the slimmed body (bind space): half-width, front z, back z by height
const TORSO = [[0.93, 0.16, 0.072, -0.105], [1.0, 0.146, 0.076, -0.1], [1.1, 0.133, 0.089, -0.086], [1.2, 0.124, 0.096, -0.088], [1.3, 0.166, 0.113, -0.118], [1.4, 0.196, 0.11, -0.146]];   // fit build (tools/model/build-rider.mjs MEASURE=1)
function torsoAt(y) { let i = 0; while (i < TORSO.length - 2 && y > TORSO[i + 1][0]) i++; const a = TORSO[i], b = TORSO[i + 1], t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
  return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
const CLOTH_BONES = ['pelvis', 'spine_01', 'spine_02', 'spine_03'];
const boneForY = (y) => y >= 1.31 ? 3 : y >= 1.18 ? 2 : 1;

class ShirtCloth {
  constructor(rm, rig, shirtTex, low, lod, cast) {
    this.rm = rm; this.rig = rig; this.acc = 0; this.t = Math.random() * 10; this.ready = false;
    const dim = lod ? SHIRT_DIM.lo : SHIRT_DIM.hi;
    this.mat = low ? new THREE.MeshLambertMaterial({ map: shirtTex, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map: shirtTex, side: THREE.DoubleSide, roughness: 0.82 });
    this.panels = [
      this.panel(dim.back, -Math.PI / 2 - 1.22, -Math.PI / 2 + 1.22, 1.4, 0.92, [0, 1]),     // back, seams on both sides
      this.panel(dim.front, -0.35, 1.22, 1.4, 0.97, [0]),                                     // left front (rider's left = +x)
      this.panel(dim.front, Math.PI + 0.35, Math.PI - 1.22, 1.4, 0.97, [0]),                   // right front
    ];
    for (const p of this.panels) { p.mesh.castShadow = cast; p.mesh.frustumCulled = false; rig.body.add(p.mesh); }
    this.D = CLOTH_BONES.map(() => new THREE.Matrix4()); this.sc = 1; this.off = new THREE.Vector3();
    this.spheres = [[0, 1.0, -0.014, 0.15, 0], [0, 1.12, -0.004, 0.14, 1], [0, 1.24, 0.004, 0.136, 2], [0, 1.36, -0.018, 0.168, 3]];
    this.sw = this.spheres.map(() => [new THREE.Vector3(), 0]); this._v = new THREE.Vector3(); this.g = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }
  // a cols×rows sheet wrapped around the torso from angle a0 to a1, from the yoke (y0) down to the hem (y1)
  panel([cols, rows], a0, a1, y0, y1, seams) {
    const n = cols * rows, B = new Float32Array(n * 3), P = new Float32Array(n * 3), Q = new Float32Array(n * 3), pin = new Int8Array(n).fill(-1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, y = lerp(y0, y1, r / (rows - 1)), th = lerp(a0, a1, c / (cols - 1)); const [hw, zf, zb] = torsoAt(y); const cz = (zf + zb) / 2, hd = (zf - zb) / 2, o = 0.02;
      B[i * 3] = (hw + o) * Math.cos(th); B[i * 3 + 1] = y; B[i * 3 + 2] = cz + (hd + o) * Math.sin(th);
      const seamCol = (seams.includes(0) && c === 0) || (seams.includes(1) && c === cols - 1);
      if (r === 0 || (seamCol && y >= 1.15)) pin[i] = boneForY(y);
    }
    const E = []; const link = (a, b, k) => { const dx = B[a * 3] - B[b * 3], dy = B[a * 3 + 1] - B[b * 3 + 1], dz = B[a * 3 + 2] - B[b * 3 + 2]; E.push(a, b, Math.hypot(dx, dy, dz), k); };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c;
      if (c < cols - 1) link(i, i + 1, 1); if (r < rows - 1) link(i, i + cols, 1);
      if (c < cols - 1 && r < rows - 1) { link(i, i + cols + 1, 0.5); link(i + 1, i + cols, 0.5); }
      if (r < rows - 2) link(i, i + 2 * cols, 0.35); }   // bend
    const g = new THREE.BufferGeometry(); const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage); g.setAttribute('position', pos);
    const uv = new Float32Array(n * 2); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { uv[(r * cols + c) * 2] = c / (cols - 1) * (cols > 6 ? 1.9 : 0.9); uv[(r * cols + c) * 2 + 1] = 1 - r / (rows - 1) * 1.5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = []; for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) { const i = r * cols + c; idx.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1); }
    g.setIndex(idx); g.computeVertexNormals();
    return { cols, rows, n, B, P, Q, pin, E: new Float32Array(E), g, pos, mesh: new THREE.Mesh(g, this.mat) };
  }
  // called from RiderModel.pose (model space, root detached): remember how each torso bone moved since the bind pose
  capture(bones, invBind, sc, px, py, pz) { for (let k = 0; k < 4; k++) this.D[k].multiplyMatrices(bones[CLOTH_BONES[k]].matrixWorld, invBind[k]); this.sc = sc; this.off.set(px, py, pz); this.fresh = true; }
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
    const P = p.P, Q = p.Q, pin = p.pin, g = this.g, t = this.t, h2 = h * h, v1 = Math.max(v, 0.4);
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
        if (Math.abs(P[i3]) < 0.17 && P[i3 + 2] < 0.05 && P[i3 + 2] > -0.8 && P[i3 + 1] < 0.9) P[i3 + 1] = 0.9; }
    }
  }
  dispose() { for (const p of this.panels) { p.mesh.removeFromParent(); p.g.dispose(); } this.mat.dispose(); }
}
