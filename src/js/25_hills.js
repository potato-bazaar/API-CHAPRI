// ───────────────────────── GHAT STAGE: hills, lake, canyon ─────────────────────────
// A point-to-point stage has no city round it. The land is a height field grown out of the road itself: every point takes
// the height of the road near it, then mountains rise (or fall away) with distance. Four country in one run: a pine ghat,
// a lake, a red canyon on a kachha road and the climb to the fort.
// every kind of country: ground colours (flat, second, steep), how the land sits round the trail (mount = ridges and valleys,
// canyon = terraced walls on both sides, ridge = the land falls away on both sides), its air (tint, how much, how far you see),
// what grows there and the colours of its scrub and rock
const HC = (c) => new THREE.Color(c);
const HILL_Z = {
  pine: { pal: ['#4f7a36', '#3f652d', '#6b6458'], shape: 'mount', air: ['#cfe2e4', 0.55, 0.62], scat: 'pine', tuft: '#6f9a3e', bush: '#5f8f3a', rock: '#8a8276' },
  lake: { pal: ['#5f8c3c', '#4d7733', '#786c58'], shape: 'mount', air: ['#d8ecf2', 0.3, 1.0], scat: 'lake', tuft: '#7fae48', bush: '#6fa043', rock: '#8f8572' },
  desert: { pal: ['#cf8442', '#e0a560', '#a04a26'], shape: 'canyon', strata: true, air: ['#f2c292', 0.8, 1.1], scat: 'desert', tuft: '#c9a85a', bush: '#b9a04a', rock: '#b5653a' },
  climb: { pal: ['#94893f', '#aa9a4c', '#857360'], shape: 'mount', air: ['#f2dcae', 0.45, 0.95], scat: 'climb', tuft: '#b5a650', bush: '#9a9a4a', rock: '#96866e' },
  snow: { pal: ['#eef2f7', '#dde6f0', '#7f8a98'], shape: 'ridge', air: ['#e4eef8', 0.7, 0.8], scat: 'snow', tuft: '#dfe6ee', bush: '#cfd8e2', rock: '#8d96a2' },
  alpine: { pal: ['#55803a', '#6a8f45', '#727068'], shape: 'ridge', air: ['#cfe2e4', 0.5, 0.85], scat: 'pine', tuft: '#7aa046', bush: '#5f8f3a', rock: '#8a8276' },
  mesa: { pal: ['#c08a58', '#d3a56f', '#8a4a30'], shape: 'ridge', strata: true, air: ['#f2c6a4', 0.6, 1.2], scat: 'desert', tuft: '#b9a05a', bush: '#9c9450', rock: '#a8643e' },
  gorge: { pal: ['#b47a52', '#c99668', '#7c4230'], shape: 'canyon', strata: true, air: ['#e8b4b0', 0.7, 1.5], scat: 'desert', tuft: '#a89a58', bush: '#8f9050', rock: '#9c5c3c' },
  badland: { pal: ['#d18340', '#e2a45c', '#a64a24'], shape: 'ridge', strata: true, air: ['#f3c796', 0.85, 1.15], scat: 'desert', tuft: '#c9a85a', bush: '#b9a04a', rock: '#b5653a' },
};
for (const k in HILL_Z) { const z = HILL_Z[k]; z.pal = z.pal.map(HC); z.air = [HC(z.air[0]), z.air[1], z.air[2]]; }
const hHash = (ix, iz) => { let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
function hNoise(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return lerp(lerp(hHash(ix, iz), hHash(ix + 1, iz), u), lerp(hHash(ix, iz + 1), hHash(ix + 1, iz + 1), u), v); }
function hFbm(x, z, o = 4) { let a = 0.5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * hNoise(x, z); n += a; x = x * 2.03 + 17.1; z = z * 2.03 - 9.3; a *= 0.5; } return s / n; }
const hStep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hillGeo(parts) { const b = new Batch(), M = new THREE.Matrix4(); for (const [g, x, y, z, sx, sy, sz, col] of parts) { M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)); b.add(g, M, new THREE.Color(col)); } return b.build(); }

Object.assign(World.prototype, {
  hillInit() {
    const T = this.track, S = [], P2 = this.def.p2p; this.hLake = null; this.hZn = Object.keys(P2.zones); this.hZt = this.hZn.map(n => HILL_Z[(P2.zoneType || {})[n] || n]);
    this.hillType = (s) => { const z = T.hillZone(s); return this.hZt[z ? this.hZn.indexOf(z) : 0]; };
    for (let i = 0; i < T.N; i += 16) { const s = i * STEP; if (!T.live(s)) continue; const z = T.hillZone(s); S.push(T.px[i], T.pz[i], T.py[i], z ? this.hZn.indexOf(z) : s > T.L / 2 ? 0 : this.hZn.length - 1); }
    this.hS = new Float32Array(S); this.hh = { y: 0, d: 0, zw: [0, 0, 0, 0], zone: 0 };
    const lk = this.def.p2p.lake; if (lk) this.hLake = { x: lk.x * T.xzS, z: lk.z * T.xzS, r: lk.r * T.xzS, y: lk.y };
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < S.length; i += 4) { x0 = Math.min(x0, S[i]); x1 = Math.max(x1, S[i]); z0 = Math.min(z0, S[i + 1]); z1 = Math.max(z1, S[i + 1]); }
    this.hBox = [x0, x1, z0, z1]; T.cx = (x0 + x1) / 2; T.cz = (z0 + z1) / 2; T.R = Math.hypot(x1 - x0, z1 - z0) / 2;
  },
  // the land at (x, z): height, distance to the road's centre line and how much of each country it is
  hillH(x, z) {
    const S = this.hS, n = S.length, H = this.hh, zw = H.zw; let sw = 0, sy = 0, dm = 1e18; zw[0] = zw[1] = zw[2] = zw[3] = 0;
    for (let i = 0; i < n; i += 4) { const dx = x - S[i], dz = z - S[i + 1], d2 = dx * dx + dz * dz, q = d2 + 20, w = 1 / (q * q); sw += w; sy += w * S[i + 2]; zw[S[i + 3]] += w; if (d2 < dm) dm = d2; }
    const d = Math.sqrt(dm), base = sy / sw; for (let k = 0; k < 4; k++) zw[k] /= sw;
    const ramp = hStep(15, 170, d) * (1 + d / 650), m = hFbm(x / 270, z / 270, 4);
    const cy = (0.2 + m * 0.95) * 150, ter = 20, q = cy / ter, fq = Math.floor(q), Zt = this.hZt;
    const shp = { mount: (m - 0.4) * 210, canyon: (fq + hStep(0.72, 1, q - fq)) * ter * (this.def.p2p.canyonK || 1), ridge: -(0.1 + m * 1.05) * 185 };   // ridges and valleys / terraced walls / falling away
    let off = 0; for (let k = 0; k < Zt.length; k++) off += zw[k] * shp[Zt[k].shape];
    let y = base + off * ramp;
    const pk = this.def.p2p.peaks; if (pk) { const f = hFbm(x / 430 + 9, z / 430 - 4, 3); y += hStep(330, 760, d) * Math.pow(f, 1.6) * pk * 2.2; }   // far off, the big peaks stand up again
    const L = this.hLake; H.wet = false;
    if (L) { const r = Math.hypot(x - L.x, z - L.z); if (r < L.r + 60) { const bed = r < L.r ? L.y - 0.4 - 7 * (1 - (r / L.r) * (r / L.r)) : L.y - 0.4 + (r - L.r) * 0.07; y = lerp(bed, y, hStep(L.r, L.r + 60, r)); H.wet = r < L.r + 30; } }
    H.y = y; H.d = d; { let b = 0; for (let k = 1; k < 4; k++) if (zw[k] > zw[b]) b = k; H.zone = Math.min(b, Zt.length - 1); }
    return y;
  },
  // ground colour: each country's own flat / second / steep tone, strata in the canyon, sand at the water
  hillCol(out, x, z, y, steep) {
    const zw = this.hh.zw, n = hNoise(x / 38, z / 38), n2 = hNoise(x / 7 + 40, z / 7); let r = 0, g = 0, b = 0;
    for (let k = 0; k < this.hZt.length; k++) { const w = zw[k]; if (w < 0.002) continue; const P = this.hZt[k].pal; let cr = lerp(P[0].r, P[1].r, n), cg = lerp(P[0].g, P[1].g, n), cb = lerp(P[0].b, P[1].b, n);
      let st = steep; if (this.hZt[k].strata) { const band = 0.5 + 0.5 * Math.sin(y * 0.42 + n * 2.5); st = Math.min(1, steep * (0.75 + 0.5 * band)); cr *= 0.93 + 0.14 * band; }
      cr = lerp(cr, P[2].r, st); cg = lerp(cg, P[2].g, st); cb = lerp(cb, P[2].b, st); r += cr * w; g += cg * w; b += cb * w; }
    const L = this.hLake; if (L) { const k = hStep(L.y + 1.5, L.y + 0.1, y) * hStep(L.r + 70, L.r + 20, Math.hypot(x - L.x, z - L.z)); r = lerp(r, 0.72, k); g = lerp(g, 0.6, k); b = lerp(b, 0.34, k); }
    const sl = this.def.p2p.snowLine; if (sl) { const k = hStep(sl - 30, sl + 30, y + n * 50) * (1 - steep * 0.65); r = lerp(r, 0.93, k); g = lerp(g, 0.95, k); b = lerp(b, 0.99, k); }   // above the snow line everything is white but the cliffs
    const v = 0.9 + 0.2 * n2; return out.setRGB(r * v, g * v, b * v);
  },
  buildHills(B) {
    const T = this.track, low = this.opts.quality === 'low'; this.hillInit(); RNG = mulberry32(4711);
    const hb = this.hB = new Batch(), rock = new THREE.Color('#8a8072'), col = new THREE.Color(), cell = low ? 19 : this.def.p2p.bigLand ? 15 : 12;
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3(), p = new THREE.Vector3(), white = new THREE.Color('#ffffff');
    // ── the road: tarmac on the hills, kachha through the canyon; rock lips where it jumps ──
    const rows = [], bz = T.bumps.map(b => [b.s - 1, b.s + b.len + 1]);
    for (let s = T.L - 90; s < T.L + T.finS + 150;) { rows.push(s); s += bz.some(([a, b]) => { const x = ((s % T.L) + T.L) % T.L; return x > a - 2 && x < b + 2; }) ? 0.5 : 2; }
    const outer = Math.max(23, cell * 1.45 + 9), OFF = [0, 1.7, 5.5, 11, 17, outer], LIFT = [0, -0.04, 0.3, 0.3, 0.25, -1.4];
    const yel = new THREE.Color('#e8b62a'), edge = new THREE.Color('#e6e1d8'), dirtC = new THREE.Color('#fff2e0'), grav = new THREE.Color('#9a9082'), sandC = new THREE.Color('#dfae78');
    const side = (s) => { const out = [], w = T.wAt(s) / 2 + (T.pitAt(s) ? 12 : 0), yr = T.yAt(s); for (const sg of [-1, 1]) { const a = []; for (let k = 0; k < OFF.length; k++) { T.pos(s, sg * (w + OFF[k]), p, 0); let y = yr + LIFT[k]; if (k >= 2) { const h = this.hillH(p.x, p.z) + LIFT[k]; y = k === 2 ? lerp(yr, h, 0.55) : h; } a.push(new THREE.Vector3(p.x, y, p.z)); } out.push(a); } return out; };
    let prev = null, prevS = 0, q4 = 0;
    for (let r = 0; r < rows.length; r++) {
      const s1 = rows[r], cur = (r % 2 === 0 || rows[r] - prevS >= 3.9 || r === rows.length - 1) ? side(s1) : null;
      if (r > 0) { const s0 = rows[r - 1], w0 = T.wAt(s0) / 2, w1 = T.wAt(s1) / 2, y0 = T.yAt(s0), y1 = T.yAt(s1), dirt = T.dirtAt(s0);
        T.pos(s0, -w0, pA, 0); T.pos(s1, -w1, pB, 0); T.pos(s1, w1, pC, 0); T.pos(s0, w0, pD, 0);
        if (T.pitAt(s0) || T.pitAt(s1)) { if (T.pitAt(s0) && T.pitAt(s1)) { T.pos(s0, -w0 - 12, pA, 0.05); T.pos(s1, -w1 - 12, pB, 0.05); T.pos(s1, w1 + 12, pC, 0.05); T.pos(s0, w0 + 12, pD, 0.05); (this.hRiver = this.hRiver || new Batch()).quad(pA, pB, pC, pD, white, undefined, UP); } }   // the river on the canyon floor
        else if (Math.abs(y1 - y0) > 1.0) { pB.copy(pA).setY(y1); pC.copy(pD).setY(y1); B.props.quad(pA, pB, pC, pD, rock); }   // the face of a rock lip
        else if (dirt) B.dirt.quad(pA, pB, pC, pD, dirtC, [[0, s0 / 6], [0, s1 / 6], [w0 / 1.5, s1 / 6], [w0 / 1.5, s0 / 6]], UP);
        else { B.road.quad(pA, pB, pC, pD, white, [[0, s0 / 24], [0, s1 / 24], [1, s1 / 24], [1, s0 / 24]], UP);
          for (const sg of [-1, 1]) { T.pos(s0, sg * (w0 - 0.45), pA, 0.014); T.pos(s1, sg * (w1 - 0.45), pB, 0.014); T.pos(s1, sg * (w1 - 0.3), pC, 0.014); T.pos(s0, sg * (w0 - 0.3), pD, 0.014); B.marks.quad(pA, pB, pC, pD, edge, undefined, UP); }
          if (Math.floor(s0 / 7.5) % 2 === 0 || Math.abs(T.kAt(s0)) > 1 / 70) { T.pos(s0, -0.09, pA, 0.014); T.pos(s1, -0.09, pB, 0.014); T.pos(s1, 0.09, pC, 0.014); T.pos(s0, 0.09, pD, 0.014); B.marks.quad(pA, pB, pC, pD, yel, undefined, UP); } }   // dashes; a solid line through the bends
      }
      if (cur && prev) for (let sd = 0; sd < 2; sd++) for (let k = 0; k < OFF.length - 1; k++) { const a = prev[sd][k], b = cur[sd][k], c = cur[sd][k + 1], d = prev[sd][k + 1];
        if (k === 0) { hb.quad(a, b, c, d, T.offroad ? this.hillType(s1).pal[1] : T.dirtAt(s1) ? sandC : grav, [[0, 0], [0, 1], [1, 1], [1, 0]], UP); continue; }
        const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2, my = (a.y + c.y) / 2; this.hillH(mx, mz); const run = Math.hypot(c.x - b.x, c.z - b.z) || 1, st = hStep(0.45, 1.1, Math.abs(c.y - b.y) / run);
        hb.quad(a, b, c, d, this.hillCol(col, mx, mz, my, st), [[a.x / 16, a.z / 16], [b.x / 16, b.z / 16], [c.x / 16, c.z / 16], [d.x / 16, d.z / 16]], UP); q4++; }
      if (cur) { prev = cur; prevS = s1; }
    }
    // start and finish lines (chequers) and their gates
    for (const [sL, name] of [[0, 'start'], [T.finS, 'finish']]) { const w = T.wAt(sL) / 2, n = Math.round(w * 2 / 1.5);
      for (let k = 0; k < 2; k++) for (let i = 0; i < n; i++) { const d0 = -w + (i / n) * w * 2, d1 = -w + ((i + 1) / n) * w * 2, s0 = sL + k * 0.9;
        T.pos(s0, d0, pA, 0.02); T.pos(s0 + 0.9, d0, pB, 0.02); T.pos(s0 + 0.9, d1, pC, 0.02); T.pos(s0, d1, pD, 0.02); B.glow.quad(pA, pB, pC, pD, new THREE.Color((i + k) % 2 ? '#f4f4f4' : '#151515'), undefined, UP); }
      this.hillGate(B, sL, name === 'finish' && !this.def.p2p.plainFinish); }
    // ── the land ──
    const [bx0, bx1, bz0, bz1] = this.hBox, M = low ? 430 : 560, nx = Math.ceil((bx1 - bx0 + 2 * M) / cell) + 1, nz = Math.ceil((bz1 - bz0 + 2 * M) / cell) + 1, ox = bx0 - M, oz = bz0 - M;
    const hy = new Float32Array(nx * nz), hd = new Float32Array(nx * nz), hz = new Float32Array(nx * nz * 4), pos = new Float32Array(nx * nz * 3), cl = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; hy[k] = this.hillH(ox + i * cell, oz + j * cell); hd[k] = this.hh.d; hz.set(this.hh.zw, k * 4); }
    const pitZ = T.pit ? this.hZn.indexOf(T.hillZone((T.pit[0] + T.pit[1]) / 2)) : -1;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, x = ox + i * cell, z = oz + j * cell;
      const gx = (hy[j * nx + Math.min(nx - 1, i + 1)] - hy[j * nx + Math.max(0, i - 1)]) / (2 * cell), gz = (hy[Math.min(nz - 1, j + 1) * nx + i] - hy[Math.max(0, j - 1) * nx + i]) / (2 * cell);
      for (let c = 0; c < 4; c++) this.hh.zw[c] = hz[k * 4 + c]; this.hillCol(col, x, z, hy[k], hStep(0.5, 1.15, Math.hypot(gx, gz)));
      pos[k * 3] = x; pos[k * 3 + 1] = hy[k] - (hd[k] < 13 || (pitZ >= 0 && hd[k] < 27 && hz[k * 4 + pitZ] > 0.5) ? 1.7 : 0); pos[k * 3 + 2] = z; cl[k * 3] = col.r; cl[k * 3 + 1] = col.g; cl[k * 3 + 2] = col.b; uv[k * 2] = x / 16; uv[k * 2 + 1] = z / 16; }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let t = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; if ((i + j) % 2) { idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d; } else { idx[t++] = a; idx[t++] = c; idx[t++] = d; idx[t++] = a; idx[t++] = d; idx[t++] = b; } }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(cl, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); tg.setIndex(new THREE.BufferAttribute(idx, 1)); tg.computeVertexNormals();
    const hm = this.hillMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: hillDetailTexture(), flatShading: true });
    const land = new THREE.Mesh(tg, hm); land.receiveShadow = true; land.matrixAutoUpdate = false; land.updateMatrix(); this.group.add(land);
    const rib = hb.mesh(hm, { receive: true }); if (rib) this.group.add(rib); this.disposables.push(tg, hm, rib && rib.geometry);
    // ── the lake ──
    if (this.hLake || this.hRiver) {
      this.lakeMat = new THREE.ShaderMaterial({ fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, deep: { value: new THREE.Color('#2a84a4') }, shallow: { value: new THREE.Color('#74c8d6') }, glint: { value: new THREE.Color('#fff0c8') } }]),
        vertexShader: 'varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
        fragmentShader: `uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 glint; varying vec3 vW;
#include <fog_pars_fragment>
void main(){ float w = sin(vW.x*0.21 + time*0.9)*0.5 + sin(vW.z*0.27 - time*1.2 + vW.x*0.08)*0.5; float w2 = sin((vW.x+vW.z)*0.9 + time*2.1) * sin(vW.x*0.6 - vW.z*0.45 + time*1.3);
  vec3 c = mix(deep, shallow, 0.5 + 0.3*w); c += glint * smoothstep(0.8, 1.0, w2*0.5+0.5) * 0.45; gl_FragColor = vec4(c,1.0);
#include <fog_fragment>
}` });
      this.disposables.push(this.lakeMat);
      if (this.hLake) { const L = this.hLake, g = new THREE.CircleGeometry(L.r + 62, 56).rotateX(-Math.PI / 2).translate(L.x, L.y, L.z); const m = new THREE.Mesh(g, this.lakeMat); this.group.add(m); this.disposables.push(g); this.lakeMesh = m; }
      if (this.hRiver) { const m = this.hRiver.mesh(this.lakeMat, {}); if (m) { this.group.add(m); this.disposables.push(m.geometry); } this.hRiver = null; } }
    this.hillScatter(B); this.hillRoadside(B); if (T.pit) this.hillAirfield(B);
  },
  // ── Cliff Run: the runway's lantern posts, rope rails, painted arrows and flags; the wooden launch ramp on its trestle;
  // the landing strip with its target bands ──
  hillAirfield(B) {
    const T = this.track, p = new THREE.Vector3(), q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3(), lip = T.pit[0], land = T.pit[1], wood = '#8a5a2e', wood2 = '#a06d38', gold = new THREE.Color('#ffc247');
    const strip = (s0, s1) => { for (let s = s0; s < s1; s += 12) { const w = T.wAt(s) / 2, yaw = T.yawAt(s), i = Math.round(s / 12);
        for (const sd of [-1, 1]) { T.pos(s, sd * (w + 0.5), p, 0); B.props.box(p.x, p.y - 0.3, p.z, 0.22, 1.9, 0.22, yaw, wood); B.props.box(p.x, p.y + 1.55, p.z, 0.3, 0.34, 0.3, yaw, '#3a2a1c'); B.glow.box(p.x, p.y + 1.6, p.z, 0.2, 0.24, 0.2, yaw, '#ffb347');   // a lantern on a post
          T.pos(s + 12, sd * (w + 0.5), q, 0); a.copy(p).setY(p.y + 1.0); b.copy(q).setY(q.y + 1.0); c.copy(q).setY(q.y + 1.07); d.copy(p).setY(p.y + 1.07); B.props.quad(a, b, c, d, '#c9a56a'); B.props.quad(b, a, d, c, '#c9a56a');                      // rope rail
          if (i % 4 === 0) { B.props.box(p.x, p.y + 1.5, p.z, 0.07, 2.6, 0.07, yaw, '#6a4a2c'); T.pos(s + 0.6, sd * (w + 0.5), q, 3.6); B.glow.box(q.x, q.y, q.z, 0.03, 0.55, 1.0, yaw, ['#ff8a1f', '#f4f4f4', '#c8321e', '#ffd23f'][(i / 4) % 4 | 0]); } } } };
    strip(-60, lip - 2); strip(land + 4, T.finS + 110);
    // arrows painted up the runway, closer together toward the ramp
    for (let s = 40; s < lip - 30; s += s > lip - 220 ? 22 : 44) for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) { const s0 = s + k * 2.6; T.pos(s0, 0, a, 0.02); T.pos(s0 + 1.1, 0, b, 0.02); T.pos(s0 - 1.3, sd * 3.2, c, 0.02); T.pos(s0 - 2.4, sd * 3.2, d, 0.02); sd > 0 ? B.glow.quad(a, b, c, d, gold, undefined, UP) : B.glow.quad(b, a, d, c, gold, undefined, UP); }
    // the launch ramp: plank deck over the lip and a bamboo trestle under it
    const rb = T.bumps[0]; if (rb) { const r0 = rb.s - rb.len / 2, r1 = rb.s + rb.len / 2 - 0.3; for (let s = r0, i = 0; s < r1; s += 1.2, i++) { const w = T.wAt(s) / 2 + 0.3, s2 = Math.min(r1, s + 1.14); T.pos(s, -w, a, 0.05); T.pos(s2, -w, b, 0.05); T.pos(s2, w, c, 0.05); T.pos(s, w, d, 0.05); B.props.quad(a, b, c, d, i % 2 ? wood : wood2, undefined, UP); }
      for (let s = r0 + 3; s < r1; s += 4.5) for (const sd of [-1, 1]) { T.pos(s, sd * (T.wAt(s) / 2 + 0.2), p, 0); const h = p.y - T.baseY[Math.floor(s / STEP) % T.N] + 6; B.props.box(p.x, p.y - h, p.z, 0.3, h, 0.3, T.yawAt(s), '#b88a4a'); }
      T.pos(r1, 0, p, 0); B.props.box(p.x, p.y - 14, p.z, T.wAt(r1) + 1, 14, 0.5, T.yawAt(r1), '#7a4f28'); }
    // the landing strip: target bands (bullseye in the middle of the strip) and a windsock pole
    const tz = land + 70; this.landTarget = tz; for (const [off, len, col] of [[-45, 30, '#f4f4f4'], [-15, 12, '#ffd23f'], [-3, 6, '#ff2e88'], [3, 12, '#ffd23f'], [15, 30, '#f4f4f4']]) { const s0 = tz + off, w = T.wAt(s0) / 2 - 0.8;
      for (const sd of [-1, 1]) { T.pos(s0, sd * w, a, 0.03); T.pos(s0 + len, sd * w, b, 0.03); T.pos(s0 + len, sd * (w - 1.2), c, 0.03); T.pos(s0, sd * (w - 1.2), d, 0.03); sd < 0 ? B.glow.quad(a, b, c, d, new THREE.Color(col), undefined, UP) : B.glow.quad(b, a, d, c, new THREE.Color(col), undefined, UP); }
      T.pos(s0, -w, a, 0.03); T.pos(s0 + 0.7, -w, b, 0.03); T.pos(s0 + 0.7, w, c, 0.03); T.pos(s0, w, d, 0.03); B.glow.quad(a, b, c, d, new THREE.Color(col), undefined, UP); }
    T.pos(land + 1.5, 0, p, 0); B.props.box(p.x, p.y - 20, p.z, T.wAt(land) + 2, 20, 0.6, T.yawAt(land), '#7a4f28');
  },
  // the air changes with the country: mist in the pines, clear over the lake, warm dust in the canyon
  hillAir(dt, focus) {
    if (this.lakeMat) this.lakeMat.uniforms.time.value += dt;
    if (!focus || !this.fog || !this.hS) return; if (this._hfog !== this.fog) { this._hfog = this.fog; this._hbase = { c: this.fog.color.clone(), n: this.fog.near, f: this.fog.far }; this._hc = new THREE.Color(); }
    this.hillH(focus.x, focus.z); const zw = this.hh.zw, b = this._hbase, c = this._hc.setRGB(0, 0, 0); let range = 0;
    for (let k = 0; k < this.hZt.length; k++) { const [tint, amt, rg] = this.hZt[k].air; HILL_TMP.copy(b.c).lerp(tint, amt); c.r += HILL_TMP.r * zw[k]; c.g += HILL_TMP.g * zw[k]; c.b += HILL_TMP.b * zw[k]; range += rg * zw[k]; }
    const k = 1 - Math.exp(-1.2 * dt); this.fog.color.lerp(c, k); this.fog.near += (b.n * range - this.fog.near) * k; this.fog.far += (b.f * range - this.fog.far) * k;
  },
  // ── a gate over the road: bamboo and bunting at the start, the fort's stone gate at the finish ──
  hillGate(B, s, fort) {
    const T = this.track, p = new THREE.Vector3(), yaw = T.yawAt(s), w = T.wAt(s) / 2 + 1.2, H = fort ? 8.5 : 6.2, stone = '#b79a6c', dark = '#8f7650';
    for (const sd of [-1, 1]) { T.pos(s, sd * w, p, 0);
      if (fort) { B.props.box(p.x, p.y - 2, p.z, 3.2, H + 2, 3.2, yaw, stone); B.props.box(p.x, p.y + H, p.z, 3.8, 0.5, 3.8, yaw, dark); for (const [ax, az] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) B.props.box(p.x + ax * Math.cos(yaw) + az * Math.sin(yaw), p.y + H + 0.5, p.z - ax * Math.sin(yaw) + az * Math.cos(yaw), 0.9, 0.9, 0.9, yaw, stone);
        B.props.box(p.x, p.y + H + 0.5, p.z, 0.09, 3.2, 0.09, yaw, '#555'); const f = T.pos(s, sd * w, new THREE.Vector3(), H + 3.0); B.glow.box(f.x + Math.sin(yaw) * 0.7, f.y, f.z + Math.cos(yaw) * 0.7, 0.04, 0.8, 1.4, yaw, '#ff8a1f');
        for (let k = 1; k <= 7; k++) { const q = T.pos(s, sd * (w + 1.6 + k * 3.4), new THREE.Vector3(), 0); const gy = this.hillH(q.x, q.z); B.props.box(q.x, gy - 3, q.z, 3.5, 7.5 + (k % 2) * 0.9, 1.6, yaw, k % 2 ? stone : dark); } }
      else { B.props.box(p.x, p.y, p.z, 0.3, H, 0.3, yaw, '#b88a3e'); B.props.box(p.x, p.y, p.z, 0.9, 0.5, 0.9, yaw, '#6a5a48'); } }
    T.pos(s, 0, p, 0); B.props.box(p.x, p.y + H - (fort ? 2.2 : 0.5), p.z, 2 * w + (fort ? 0 : 0.5), fort ? 2.2 : 0.3, fort ? 2.6 : 0.3, yaw, fort ? stone : '#b88a3e');
    // the banner: chequers, facing the riders
    const n = 16, bw = 2 * w - 1.2, y0 = p.y + H - (fort ? 3.6 : 1.8), pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), pd = new THREE.Vector3();
    for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) { const d0 = -bw / 2 + bw * i / n, d1 = d0 + bw / n; T.pos(s - (fort ? 1.4 : 0.2), d0, pa, 0); T.pos(s - (fort ? 1.4 : 0.2), d1, pb, 0); pa.y = pb.y = y0 + r * 0.6; pc.copy(pb).setY(y0 + r * 0.6 + 0.6); pd.copy(pa).setY(y0 + r * 0.6 + 0.6);
      B.glow.quad(pa, pb, pc, pd, new THREE.Color((i + r) % 2 ? '#f4f4f4' : (fort ? '#151515' : '#ff2e88'))); }
    if (!fort) for (let i = 0; i < 22; i++) { const d = -w + 2 * w * (i + 0.5) / 22; T.pos(s + 0.1, d, pa, H - 0.55 - Math.sin(Math.PI * (i + 0.5) / 22) * 0.5); B.glow.box(pa.x, pa.y - 0.45, pa.z, 0.42, 0.45, 0.03, yaw, ['#ff8a1f', '#f4f4f4', '#2f9e44', '#ff2e88', '#ffd23f'][i % 5]); }
  },
  // ── trees, bushes, rocks and cactus, thousands of them as instances ──
  hillScatter(B) {
    const T = this.track, low = this.opts.quality === 'low', cone = (r, h) => new THREE.ConeGeometry(r, h, 7), cyl = new THREE.CylinderGeometry(0.5, 0.6, 1, 6), ico = new THREE.IcosahedronGeometry(1, 0), ico1 = new THREE.IcosahedronGeometry(1, 1);
    const G = { pine: hillGeo([[cyl, 0, 1.0, 0, 0.42, 2.0, 0.42, '#5b4028'], [cone(1.9, 2.6), 0, 2.9, 0, 1, 1, 1, '#2f6a33'], [cone(1.5, 2.3), 0, 4.4, 0, 1, 1, 1, '#35763a'], [cone(1.05, 2.0), 0, 5.8, 0, 1, 1, 1, '#3f8642']]),
      leaf: hillGeo([[cyl, 0, 1.2, 0, 0.5, 2.4, 0.5, '#6a4a2c'], [ico1, 0, 3.5, 0, 2.1, 1.7, 2.1, '#4f8f36'], [ico1, 0.9, 4.6, 0.4, 1.4, 1.2, 1.4, '#62a33f'], [ico1, -0.8, 4.3, -0.6, 1.3, 1.1, 1.3, '#457e30']]),
      bush: hillGeo([[ico, 0, 0.45, 0, 0.9, 0.6, 0.9, '#ffffff'], [ico, 0.6, 0.35, 0.3, 0.55, 0.42, 0.55, '#e4e4e4']]),
      rock: hillGeo([[ico, 0, 0.5, 0, 1, 0.72, 0.86, '#ffffff']]),
      tuft: hillGeo([[cone(0.34, 0.7), 0, 0.3, 0, 1, 1, 0.5, '#ffffff'], [cone(0.26, 0.55), 0.3, 0.24, 0.1, 0.6, 1, 1, '#dddddd'], [cone(0.24, 0.5), -0.25, 0.22, -0.12, 1, 1, 0.6, '#eeeeee']]),
      cactus: hillGeo([[cyl, 0, 1.5, 0, 0.5, 3.0, 0.5, '#4d8a48'], [cyl, 0.62, 1.7, 0, 0.3, 1.2, 0.3, '#458043'], [cyl, 0.42, 1.2, 0, 0.6, 0.26, 0.26, '#458043'], [cyl, -0.58, 2.2, 0, 0.28, 1.0, 0.28, '#519150'], [cyl, -0.4, 1.8, 0, 0.56, 0.24, 0.24, '#519150']]) };
    const L = { pine: [], leaf: [], bush: [], rock: [], cactus: [], tuft: [] }, put = (kind, x, y, z, sc, c) => L[kind].push(x, y, z, sc, RNG() * 6.28, c);
    const place = (x, z, near) => { const y = this.hillH(x, z), H = this.hh, d = H.d; if (d < T.wAt(0) / 2 + 4.8 || H.wet || (this.hLake && y < this.hLake.y + 0.5)) return;
      if (!near && RNG() > (d < 130 ? 1 : Math.max(0.14, 1 - (d - 130) / 380))) return; const Z = this.hZt[H.zone], zn = Z.scat, r = RNG(), big = 0.75 + RNG() * 0.7;
      if (zn === 'pine') r < 0.8 ? put('pine', x, y, z, big * 1.25, 0) : r < 0.9 ? put('rock', x, y, z, 0.6 + RNG() * 1.6, Z.rock) : put('bush', x, y, z, big, Z.bush);
      else if (zn === 'lake') r < 0.55 ? put('leaf', x, y, z, big * 1.1, 0) : r < 0.72 ? put('pine', x, y, z, big, 0) : r < 0.9 ? put('bush', x, y, z, big, Z.bush) : put('rock', x, y, z, 0.5 + RNG(), Z.rock);
      else if (zn === 'desert') { if (r < 0.42) put('bush', x, y, z, big * 0.9, Z.bush); else if (r < 0.7) put('rock', x, y, z, 0.6 + RNG() * 2.4, Z.rock); else if (r < 0.78 && d > 12) { const h = 3 + RNG() * 4; put('rock', x, y, z, h, '#b96a3e'); put('rock', x + 0.4, y + h * 0.62, z - 0.3, h * 0.62, '#c9783f'); if (RNG() < 0.5) put('rock', x - 0.2, y + h * 1.02, z + 0.2, h * 0.4, '#a85a34'); }   // a stack of red boulders
        else if (r < 0.9) put('cactus', x, y, z, big, 0); }
      else if (zn === 'snow') { if (r < 0.5) put('rock', x, y, z, 0.7 + RNG() * 2.6, r < 0.25 ? '#eef2f7' : Z.rock); else if (r < 0.62) put('bush', x, y, z, big, Z.bush); else if (r < 0.7) put('pine', x, y, z, big * 0.8, '#cfe0e4'); }   // rock, drifts and the odd frosted pine
      else r < 0.3 ? put('pine', x, y, z, big, 0) : r < 0.6 ? put('bush', x, y, z, big, Z.bush) : r < 0.9 ? put('rock', x, y, z, 0.6 + RNG() * 1.5, Z.rock) : put('leaf', x, y, z, big, 0); };
    const [x0, x1, z0, z1] = this.hBox, m = 300, n = low ? 4200 : 9500; for (let i = 0; i < n; i++) place(x0 - m + RNG() * (x1 - x0 + 2 * m), z0 - m + RNG() * (z1 - z0 + 2 * m), false);
    const p = new THREE.Vector3(); for (let s = 30; s < T.finS + 130; s += low ? 11 : 6) for (const sd of [-1, 1]) { if (RNG() < 0.2) continue; T.pos(s + RNG() * 6, sd * (T.wAt(s) / 2 + 5.5 + RNG() * RNG() * 16), p, 0); place(p.x, p.z, true); }
    // grass and scrub right at the roadside: what gives the speed
    for (let s = 10; s < T.finS + 130; s += low ? 4.5 : 2.2) for (const sd of [-1, 1]) { T.pos(s + RNG() * 2, sd * (T.wAt(s) / 2 + 2.2 + RNG() * RNG() * 9), p, 0); const y = this.hillH(p.x, p.z); if (this.hh.wet && y < this.hLake.y + 0.4) continue; put('tuft', p.x, y + 0.2, p.z, 0.7 + RNG() * 0.9, this.hZt[this.hh.zone].tuft); }
    const mat = this.hillPropMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); this.disposables.push(mat); const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), c = new THREE.Color();
    for (const k in L) { const a = L[k], cnt = a.length / 6; if (!cnt) continue; const im = new THREE.InstancedMesh(G[k], mat, cnt);
      for (let i = 0; i < cnt; i++) { const sc = a[i * 6 + 3]; Q.setFromAxisAngle(UP, a[i * 6 + 4]); M4.compose(V.set(a[i * 6], a[i * 6 + 1] - 0.15, a[i * 6 + 2]), Q, S3.set(sc, sc * (0.9 + (i % 5) * 0.06), sc)); im.setMatrixAt(i, M4); im.setColorAt(i, c.set(a[i * 6 + 5] || '#ffffff')); }
      im.castShadow = !low && (k === 'pine' || k === 'leaf'); im.receiveShadow = false; im.frustumCulled = false; this.group.add(im); this.disposables.push(G[k]); }
    this.hillCount = Object.fromEntries(Object.entries(L).map(([k, a]) => [k, a.length / 6]));
  },
  // ── along the road: painted parapet stones on the valley side, chevron boards on the bends, km stones, fallen rocks and
  // trees right at the edge (the ones you can hit) ──
  hillRoadside(B) {
    const T = this.track, p = new THREE.Vector3(), q = new THREE.Vector3();
    for (let s = 8; s < T.finS + 120; s += 3.2) { if (T.dirtAt(s) || T.pitAt(s) || T.pit) continue; const w = T.wAt(s) / 2, yr = T.yAt(s), yaw = T.yawAt(s), i = Math.round(s / 3.2);
      for (const sd of [-1, 1]) { T.pos(s, sd * (w + 19), q, 0); if (yr - this.hillH(q.x, q.z) < 3.2) continue; T.pos(s, sd * (w + 0.85), p, 0); B.props.box(p.x, p.y - 0.1, p.z, 0.42, 0.78, 1.9, yaw, i % 2 ? '#f2efe6' : '#1c1c1c'); } }
    for (const c of T.corners) { const sm = (c.s + c.e) / 2; if (!T.live(sm) || sm > T.finS || c.kind === 'bend') continue; const n = c.kind === 'hairpin' ? 4 : 2;
      for (let i = 0; i < n; i++) { const s = lerp(c.s, c.e, (i + 0.5) / n); T.pos(s, -c.dir * (T.wAt(s) / 2 + 2.6), p, 0); this.signBoard(B, 'chevron', p.x, p.y + 1.1, p.z, T.yawAt(c.s) + Math.PI + c.dir * 0.5 * (i + 0.5) / n * 2, 2.4, p.y - 1); } }
    for (let km = 1; km * 1000 < T.finS; km++) { const s = T.finS - km * 1000; T.pos(s, -(T.wAt(s) / 2 + 1.5), p, 0); const yaw = T.yawAt(s); B.props.box(p.x, p.y - 0.2, p.z, 0.5, 0.75, 0.22, yaw, '#f2efe6'); B.props.box(p.x, p.y + 0.55, p.z, 0.5, 0.3, 0.23, yaw, '#e8b62a'); }
    // things on the road you can hit: rocks that have come down the slope, and trunks standing right on the edge
    const free = (s) => s > 140 && s < T.finS - 60 && !T.bumps.some(b => s > b.s - 40 && s < b.s + b.len + 60) && !T.kickers.some(k => Math.abs(s - k.s) < 60) && !(T.nitros || []).some(n => Math.abs(s - n.s) < 40) && !this.obstacles.some(o => Math.abs(o.s - s) < 45);
    for (let s = 180, k = 0; s < T.finS - 80; s += 150 + RNG() * 110, k++) { if (!free(s) || this.def.p2p.clean) continue; const Zt = this.hillType(s), zn = Zt.scat, w = T.wAt(s) / 2, sd = RNG() < 0.5 ? -1 : 1, yaw = T.yawAt(s);
      if (zn === 'desert' || zn === 'snow' || k % 2) { const d = sd * (w * (0.25 + RNG() * 0.5)), r = 0.7 + RNG() * 0.35; T.pos(s, d, p, 0); B.props.geom(BLOB, p.x, p.y + r * 0.45, p.z, RNG() * 6, r, r * 0.75, r * 0.9, Zt.rock);
        for (let j = 0; j < 3; j++) B.props.geom(BLOB, p.x + (RNG() - 0.5) * 2.6, p.y + 0.12, p.z + (RNG() - 0.5) * 2.6, RNG() * 6, 0.2 + RNG() * 0.2, 0.16, 0.22, Zt.rock); this.obstacles.push({ s, d, hw: r * 0.8, hl: r * 0.8, kind: 'rock' }); }
      else { const d = sd * (w - 0.5); T.pos(s, d, p, 0); B.props.box(p.x, p.y, p.z, 0.5, 3.4, 0.5, yaw, '#5b4028'); for (const [dy, r, c] of [[2.6, 1.9, '#2f6a33'], [4.1, 1.5, '#35763a'], [5.5, 1.05, '#3f8642']]) B.props.geom(HILL_CONE, p.x, p.y + dy + 1.2, p.z, 0, r, 2.4, r, c); this.obstacles.push({ s, d, hw: 0.36, hl: 0.36, kind: 'tree' }); } }
  },
});
const HILL_CONE = new THREE.ConeGeometry(1, 1, 7);
const HILL_TMP = new THREE.Color();
let HILL_DETAIL = null;
function hillDetailTexture() {
  if (HILL_DETAIL) return HILL_DETAIL; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, 128, 128); const r = mulberry32(99);
  for (let i = 0; i < 2600; i++) { const v = 200 + Math.floor(r() * 55); x.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.5})`; const s = 1 + r() * 3; x.fillRect(r() * 128, r() * 128, s, s * (0.5 + r())); }
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(120,120,120,${0.12 + r() * 0.2})`; x.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return HILL_DETAIL = t;
}
