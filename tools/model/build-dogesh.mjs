// Build Dogesh, the Diwali rider, from the Character Creator OBJ (Suhamodel.obj).
// 1. fit: warp the model onto the game's rider skeleton (assets/rider.glb, T-pose) so every pose, gesture and cape works
// 2. skin: copy weights from the rider body (artist weights) by nearest surface, side-gated, then smooth
// 3. dress: T-shirt → saffron kurta, jeans → white churidar, sneakers → white and gold, plus generated jacket sleeves,
//    shoulders and a Nehru collar (the long skirt of the jacket is runtime cloth), and long hair swept back
// 4. paint: one atlas for skin, face, eyes, kurta, churidar and shoes, baked from 3D positions
// usage: node tools/model/build-dogesh.mjs [assets/dogesh_src/Suhamodel.obj.gz] [assets/dogesh.glb]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { prune, dedup, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import { readObj } from './objload.mjs';
const ROOT = new URL('../../', import.meta.url).pathname;
const [objFile = ROOT + 'assets/dogesh_src/Suhamodel.obj.gz', out = ROOT + 'assets/dogesh.glb'] = process.argv.slice(2);
const DEBUG = process.env.DEBUG;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(ROOT + 'assets/rider.glb'); const root = doc.getRoot(); const buffer = root.listBuffers()[0];
await MeshoptSimplifier.ready;

// ── small maths ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]), nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], lerp = (a, b, t) => a + (b - a) * t, lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mul4 = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
const app4 = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
function inv4(m) { // general 4x4 inverse (column-major)
  const a = m, o = new Array(16); const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return o;
}
let SEED = 1234567; const rnd = () => { SEED = (SEED * 1103515245 + 12345) & 0x7fffffff; return SEED / 0x7fffffff; };

// ── the rig: joints (T-pose world positions) and the rider body with its weights, in bind metres ──
const bodyNode = root.listNodes().find(n => n.getName() === 'body' && n.getMesh());
const skin0 = bodyNode.getSkin(), JOINTS = skin0.listJoints(), JN = JOINTS.map(j => j.getName()), NJ = JN.length, JI = Object.fromEntries(JN.map((n, i) => [n, i]));
const JW = {}; for (const j of JOINTS) { const w = j.getWorldMatrix(); JW[j.getName()] = [w[12], w[13], w[14]]; }
const RIG = (() => {
  const prim = bodyNode.getMesh().listPrimitives()[0], D = mul4(JOINTS[0].getWorldMatrix(), Array.from(skin0.getInverseBindMatrices().getArray().slice(0, 16)));
  const P = prim.getAttribute('POSITION'), JA = prim.getAttribute('JOINTS_0'), WA = prim.getAttribute('WEIGHTS_0'), n = P.getCount();
  const pos = new Float32Array(n * 3), W = new Float32Array(n * NJ), e = [0, 0, 0], jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) { P.getElement(i, e); pos.set(app4(D, e), i * 3); JA.getElement(i, jj); WA.getElement(i, ww); const s = ww[0] + ww[1] + ww[2] + ww[3] || 1; for (let q = 0; q < 4; q++) W[i * NJ + jj[q]] += ww[q] / s; }
  return { n, pos, W };
})();
const sideOf = (p) => { const ax = Math.abs(p[0]); if ((p[1] < 0.98 && ax > 0.025) || (ax > 0.17 && p[1] > 1.3)) return p[0] > 0 ? 1 : -1; return 0; };
// spatial hash of the rig body
const GRID = new Map(), CELL = 0.03, gk = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
for (let i = 0; i < RIG.n; i++) { const k = gk(RIG.pos[i * 3], RIG.pos[i * 3 + 1], RIG.pos[i * 3 + 2]); if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(i); }
const RSIDE = new Int8Array(RIG.n); for (let i = 0; i < RIG.n; i++) RSIDE[i] = sideOf([RIG.pos[i * 3], RIG.pos[i * 3 + 1], RIG.pos[i * 3 + 2]]);
function transfer(p, out, only) { // nearest rig-body samples on a compatible side → weights over all joints
  const s = sideOf(p); let found = [];
  for (let r = 1; r <= 5 && found.length < 6; r++) { found = []; const cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL), cz = Math.floor(p[2] / CELL);
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) { const L = GRID.get(`${cx + a},${cy + b},${cz + c}`); if (!L) continue;
      for (const i of L) { if (s && RSIDE[i] && RSIDE[i] !== s) continue; const d = Math.hypot(RIG.pos[i * 3] - p[0], RIG.pos[i * 3 + 1] - p[1], RIG.pos[i * 3 + 2] - p[2]); found.push([d, i]); } } }
  found.sort((a, b) => a[0] - b[0]); found = found.slice(0, 6); out.fill(0); let sw = 0;
  for (const [d, i] of found) { const w = 1 / (d + 0.004) ** 2; for (let j = 0; j < NJ; j++) out[j] += RIG.W[i * NJ + j] * w; sw += w; }
  if (only) for (let j = 0; j < NJ; j++) if (!only.includes(JN[j])) out[j] = 0;
  let t = 0; for (let j = 0; j < NJ; j++) t += out[j]; if (t <= 0) { out.fill(0); out[JI.Head] = 1; return out; } for (let j = 0; j < NJ; j++) out[j] /= t; return out;
}

// ── the OBJ ──
const O = readObj(objFile);
const PART = { CC_Base_Body: 'skin', CC_Base_Eye: 'eye', Stubble_Neck: 'beard', hairmesh: 'cap', Torus001: 'ear', Object001: 'glass', Object002: 'glass', __9104_: 'glass', Basic_T_shirts: 'kurta', Slim_Jeans: 'churi', Sport_sneakers: 'shoe' };
const V = O.V, NV = V.length / 3, vp = (i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
const tileOf = (f) => Math.floor(O.VT[f[0][1] * 2]);
const parts = {};   // part → list of triangles [[v,vt,vn]×3]
for (const o of O.objs) { const pt = PART[o.name]; if (!pt) continue; const L = parts[pt] = parts[pt] || [];
  for (const f of o.faces) {
    if (pt === 'skin' && tileOf(f) === 3) continue;   // ankles: hidden inside the shoes
    if (pt === 'skin' && tileOf(f) === 2 && f.every(v => Math.abs(V[v[0] * 3]) < 0.625)) continue;   // upper and fore arm: inside the jacket sleeves
    if (pt === 'kurta') { const c = f.reduce((a, v) => add(a, vp(v[0])), [0, 0, 0]).map(x => x / f.length); if (Math.abs(c[0]) > 0.212 && c[1] > 1.28) continue; }   // the T-shirt sleeves (the jacket sleeves replace them)
    for (let k = 1; k + 1 < f.length; k++) L.push([f[0], f[k], f[k + 1]]); } }
for (const [k, L] of Object.entries(parts)) console.log('part', k, L.length, 'tris');
// every vertex of the kept objects is fitted (the arm under the sleeves too: the sleeves are measured from it), only the kept faces become mesh
const used = new Uint8Array(NV), partOfV = new Array(NV), adj = Array.from({ length: NV }, () => null), ALLV = {};
for (const o of O.objs) { const pt = PART[o.name]; if (!pt) continue; const S = ALLV[pt] = ALLV[pt] || new Set();
  for (const f of o.faces) { for (const c of f) { used[c[0]] = 1; partOfV[c[0]] = pt; S.add(c[0]); }
    for (let a = 0; a < f.length; a++) { const i = f[a][0], j = f[(a + 1) % f.length][0]; (adj[i] = adj[i] || new Set()).add(j); (adj[j] = adj[j] || new Set()).add(i); } } }

// ── 1. fit: per-bone offsets (OBJ − rig) at each joint, blended along the bones → a smooth displacement field ──
const DT = { pelvis: [0, 0.01, 0], spine_01: [0, 0.01, 0], spine_02: [0, 0.012, 0], spine_03: [0, 0.025, 0], neck_01: [0, 0.03, -0.008], Head: [0, 0.022, -0.011],
  clavicle: [0, 0.03, 0], upperarm: [0, 0.055, 0.01], lowerarm: [0, 0.059, 0.029], hand: [0, 0.044, 0.012], thigh: [-0.024, 0.01, 0.02], calf: [-0.024, 0, 0.05], foot: [-0.035, 0.012, 0.09], ball: [-0.035, 0.012, 0.09], ball_leaf: [-0.035, 0.012, 0.09] };
const DEL = (n) => { const s = n.endsWith('_l') ? 1 : n.endsWith('_r') ? -1 : 0, t = DT[n.replace(/_[lr]$/, '')]; return [t[0] * s, t[1], t[2]]; };
const SEG = {}; const seg = (name, a, b, da, db) => (SEG[name] = { a: add(a, da), b: add(b, db), da, db });   // in OBJ space
for (const [n, c] of [['pelvis', 'spine_01'], ['spine_01', 'spine_02'], ['spine_02', 'spine_03'], ['spine_03', 'neck_01'], ['neck_01', 'Head']]) seg(n, JW[n], JW[c], DEL(n), DEL(c));
seg('Head', JW.Head, add(JW.Head, [0, 0.2, 0]), DEL('Head'), DEL('Head'));
for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1;
  for (const [n, c] of [['clavicle', 'upperarm'], ['upperarm', 'lowerarm'], ['lowerarm', 'hand'], ['thigh', 'calf'], ['calf', 'foot'], ['foot', 'ball'], ['ball', 'ball_leaf']]) seg(n + '_' + s, JW[n + '_' + s], JW[c + '_' + s], DEL(n + '_' + s), DEL(c + '_' + s));
  seg('hand_' + s, JW['hand_' + s], add(JW['hand_' + s], [sg * 0.22, 0, 0]), DEL('hand_' + s), DEL('hand_' + s)); }
function allowed(p, pt) {
  if (pt === 'eye' || pt === 'beard' || pt === 'cap' || pt === 'ear' || pt === 'glass') return ['Head'];
  const ax = Math.abs(p[0]), y = p[1], s = p[0] >= 0 ? 'l' : 'r';
  if (ax > 0.19 && y > 1.3) return ['spine_03', 'clavicle_' + s, 'upperarm_' + s, 'lowerarm_' + s, 'hand_' + s];
  if (y > 1.53 && ax < 0.15) return ['spine_03', 'neck_01', 'Head'];
  if (y < 0.95) return ['pelvis', 'thigh_' + s, 'calf_' + s, 'foot_' + s, 'ball_' + s];
  return ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'neck_01'].concat(y < 1.08 ? ['thigh_l', 'thigh_r'] : []);
}
const segParam = (p, S) => { const ab = sub(S.b, S.a), L = dot(ab, ab); const t = L ? clamp(dot(sub(p, S.a), ab) / L, 0, 1) : 0; return [t, len(sub(p, add(S.a, scl(ab, t))))]; };
const DISP = new Float32Array(NV * 3);
for (let i = 0; i < NV; i++) { if (!used[i]) continue; const p = vp(i); let sw = 0; const d = [0, 0, 0];
  for (const n of allowed(p, partOfV[i])) { const S = SEG[n], [t, dist] = segParam(p, S), w = 1 / (dist * dist + 1e-4) ** 2, dd = lerp3(S.da, S.db, t); d[0] += dd[0] * w; d[1] += dd[1] * w; d[2] += dd[2] * w; sw += w; }
  DISP.set(scl(d, 1 / sw), i * 3); }
for (let it = 0; it < 4; it++) { const nd = DISP.slice(); for (let i = 0; i < NV; i++) { if (!adj[i]) continue; const a = [0, 0, 0]; for (const j of adj[i]) { a[0] += DISP[j * 3]; a[1] += DISP[j * 3 + 1]; a[2] += DISP[j * 3 + 2]; } const n = adj[i].size;
  for (let k = 0; k < 3; k++) nd[i * 3 + k] = DISP[i * 3 + k] * 0.5 + a[k] / n * 0.5; } DISP.set(nd); }
const RP = new Float32Array(NV * 3); for (let i = 0; i < NV; i++) for (let k = 0; k < 3; k++) RP[i * 3 + k] = V[i * 3 + k] - DISP[i * 3 + k];
const rp = (i) => [RP[i * 3], RP[i * 3 + 1], RP[i * 3 + 2]];

// ── 2. skin: weights per OBJ vertex over all joints ──
const WT = new Float32Array(NV * NJ), tmp = new Float32Array(NJ);
const HEAD_ONLY = new Set(['eye', 'cap', 'ear', 'glass']);
for (let i = 0; i < NV; i++) { if (!used[i]) continue; const pt = partOfV[i];
  if (HEAD_ONLY.has(pt)) { WT[i * NJ + JI.Head] = 1; continue; }
  transfer(rp(i), tmp, pt === 'beard' ? ['Head', 'neck_01'] : null); WT.set(tmp, i * NJ); }
const isFinger = (i) => { let best = 0, bj = 0; for (let j = 0; j < NJ; j++) if (WT[i * NJ + j] > best) { best = WT[i * NJ + j]; bj = j; } return /index|middle|ring|pinky|thumb|hand/.test(JN[bj]); };
for (let it = 0; it < 2; it++) { const nw = WT.slice(); for (let i = 0; i < NV; i++) { if (!adj[i] || HEAD_ONLY.has(partOfV[i]) || isFinger(i)) continue; const n = adj[i].size;
  for (let j = 0; j < NJ; j++) { let a = 0; for (const k of adj[i]) a += WT[k * NJ + j]; nw[i * NJ + j] = WT[i * NJ + j] * 0.5 + a / n * 0.5; } } WT.set(nw); }
function top4(w) { const idx = [...w.keys()].sort((a, b) => w[b] - w[a]).slice(0, 4); let s = 0; for (const j of idx) s += w[j]; return [idx, idx.map(j => w[j] / (s || 1))]; }

// ── landmarks after the fit (rig space) ──
const ptsOf = (pt, f = () => true) => { const s = new Set(); for (const t of parts[pt]) for (const c of t) s.add(c[0]); return [...s].map(rp).filter(f); };
const box = (P) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of P) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } return [mn, mx, scl(add(mn, mx), 0.5)]; };
const eyeL = box(ptsOf('eye', p => p[0] > 0)), eyeR = box(ptsOf('eye', p => p[0] < 0));
const EYE = { l: eyeL[2], r: eyeR[2], rad: (eyeL[1][1] - eyeL[0][1]) / 2 };
const headPts = ptsOf('skin', p => p[1] > 1.6 && Math.abs(p[0]) < 0.11);
const HB = box(headPts); const HEAD_E = { c: [0, (HB[0][1] + HB[1][1]) / 2 + 0.01, (HB[0][2] + HB[1][2]) / 2], r: [(HB[1][0] - HB[0][0]) / 2, (HB[1][1] - HB[0][1]) / 2, (HB[1][2] - HB[0][2]) / 2] };
const teeth = O.objs.find(o => o.name === 'CC_Base_Teeth'); const TB = box([...new Set(teeth.faces.flat().map(c => c[0]))].map(i => sub(vp(i), DEL('Head'))));
const MOUTH = [0, (TB[0][1] + TB[1][1]) / 2 + 0.002, TB[1][2] + 0.012];
console.log('eyes', EYE.l.map(v => v.toFixed(3)).join(','), 'r', EYE.rad.toFixed(4), 'head', HEAD_E.c.map(v => v.toFixed(3)).join(','), HEAD_E.r.map(v => v.toFixed(3)).join(','), 'mouth', MOUTH.map(v => v.toFixed(3)).join(','));
const BEARD = ptsOf('beard'), CAP = ptsOf('cap');
const hashPts = (P, cell) => { const G = new Map(); for (const p of P) { const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`; if (!G.has(k)) G.set(k, []); G.get(k).push(p); } return { G, cell }; };
const nearDist = (H, p, maxR) => { const c = H.cell, cx = Math.floor(p[0] / c), cy = Math.floor(p[1] / c), cz = Math.floor(p[2] / c); let best = maxR;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) { const L = H.G.get(`${cx + a},${cy + b},${cz + d}`); if (!L) continue; for (const q of L) { const dd = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (dd < best) best = dd; } } return best; };
const BEARD_H = hashPts(BEARD, 0.01), CAP_H = hashPts(CAP, 0.01);
// kurta neckline + hem (boundary loops of the T-shirt)
const kEdges = new Map(); for (const t of parts.kurta) for (let a = 0; a < 3; a++) { const i = t[a][0], j = t[(a + 1) % 3][0], k = i < j ? i + ',' + j : j + ',' + i; kEdges.set(k, (kEdges.get(k) || 0) + 1); }
const kBound = new Set(); for (const [k, c] of kEdges) if (c === 1) for (const i of k.split(',')) kBound.add(+i);
const NECKLINE = [...kBound].map(rp).filter(p => p[1] > 1.42 && Math.abs(p[0]) < 0.13), HEMLINE = [...kBound].map(rp).filter(p => p[1] < 1.1);
const NECK_H = hashPts(NECKLINE, 0.03), HEM_Y = HEMLINE.length ? HEMLINE.reduce((a, p) => a + p[1], 0) / HEMLINE.length : 0.98;
console.log('neckline pts', NECKLINE.length, 'hem y', HEM_Y.toFixed(3));
{ // torso cross-sections of the kurta (bind space) for the jacket cloth: [y, half width, front z, back z]
  const K = ptsOf('kurta').concat(ptsOf('churi', p => p[1] > 0.88)), T = [];
  for (const y of [0.93, 1.0, 1.1, 1.2, 1.3, 1.4, 1.45]) { const sl = K.filter(p => Math.abs(p[1] - y) < 0.012), ctr = sl.filter(p => Math.abs(p[0]) < 0.04); if (!ctr.length) continue;
    const zf = Math.max(...ctr.map(p => p[2])), zb = Math.min(...ctr.map(p => p[2])), mid = (zf + zb) / 2, hw = Math.max(...sl.filter(p => Math.abs(p[2] - mid) < 0.05 && Math.abs(p[0]) < 0.24).map(p => Math.abs(p[0])));
    T.push([y, +hw.toFixed(3), +zf.toFixed(3), +zb.toFixed(3)]); }
  console.log('DOGESH_TORSO', JSON.stringify(T)); }

// ── 3. atlas layout (pixels in a 1024² image) and painting ──
const AT = 1024;
const RECT = { t0: [0, 0, 512, 512], t2: [512, 384, 256, 256], t4: [896, 0, 64, 64], t5: [960, 0, 64, 64], kurta: [512, 0, 384, 384], churi: [0, 512, 384, 384], shoe: [768, 384, 256, 256], eye: [384, 512, 128, 128] };
const atlasPx = (pt, vt) => { let u = O.VT[vt * 2], v = O.VT[vt * 2 + 1], key = pt;
  if (pt === 'skin') { const tl = Math.floor(u); key = 't' + tl; u -= tl; }
  const R = RECT[key]; u = clamp(u, 0, 1); v = clamp(v, 0, 1); return [R[0] + u * R[2], R[1] + (1 - v) * R[3]]; };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const C = { skin: hex('#a8714b'), skinDk: hex('#7d4f33'), lip: hex('#7b4236'), brow: hex('#1d1510'), beard: hex('#2a1d15'), lash: hex('#120d0a'), nail: hex('#d9b29a'),
  saffron: hex('#ff8a1c'), saffronDk: hex('#e86f0c'), gold: hex('#e0ac2f'), goldDk: hex('#9c6f12'), maroon: hex('#7d1426'), cream: hex('#f0e7d3'), creamDk: hex('#c9bda4'), white: hex('#f3f2ee'), sole: hex('#dcd6ca'),
  sclera: hex('#eee7dc'), iris: hex('#3a2416'), irisLt: hex('#6b4428'), pupil: hex('#080606') };
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function paint(pt, tile, p, n) {
  const x = p[0], y = p[1], z = p[2], ax = Math.abs(x);
  if (pt === 'skin') {
    if (tile === 5) return C.lash; if (tile === 4) return C.nail;
    let c = mix(C.skin, C.skinDk, hash3(Math.floor(x * 400), Math.floor(y * 400), Math.floor(z * 400)) * 0.08);
    if (tile === 2 && n[1] < -0.55 && ax > 0.7) c = mix(c, hex('#c48d68'), 0.45);   // palms
    if (tile === 0) {
      const e = x > 0 ? EYE.l : EYE.r, ex = ax - Math.abs(e[0]);
      // eyebrows: an arch above each eye, on the front of the face
      if (n[2] > 0.15 && ax > 0.008 && ax < 0.062) { const u = (ax - 0.008) / 0.054, yc = e[1] + 0.021 + 0.007 * Math.sin(Math.PI * Math.min(1, u * 1.15)) - u * 0.002, th = 0.0042 * (1 - 0.55 * u) + 0.0012;
        if (Math.abs(y - yc) < th) c = mix(c, C.brow, 0.92 * smooth(0, 0.18, u + 0.05) * (1 - smooth(0.85, 1, u))); }
      const de = Math.hypot(ex, y - e[1]); if (de < 0.026 && z > e[2] - 0.006 && n[2] > 0) c = mix(c, C.skinDk, 0.35 * (1 - smooth(0.012, 0.026, de)));   // eye sockets
      // lips
      const ly = y - MOUTH[1]; if (z > MOUTH[2] - 0.022 && n[2] > 0.2) { const hw = 0.024 * Math.sqrt(Math.max(0, 1 - (ly / 0.016) ** 2)); if (ax < hw && Math.abs(ly) < 0.016) c = mix(c, C.lip, 0.7); if (Math.abs(ly) < 0.0016 && ax < 0.022) c = mix(c, hex('#3a1c16'), 0.8); }
      const db = nearDist(BEARD_H, p, 0.03); if (db < 0.012) c = mix(c, C.beard, 0.72 * (1 - smooth(0.004, 0.012, db)));   // beard shadow under the cards
      const dc = nearDist(CAP_H, p, 0.03); if (dc < 0.01) c = mix(c, hex('#18110c'), 0.85 * (1 - smooth(0.003, 0.01, dc)));   // scalp under the hair
    }
    return c;
  }
  if (pt === 'eye') { const e = x > 0 ? EYE.l : EYE.r, d = nrm(sub(p, e)), fw = nrm([x > 0 ? 0.12 : -0.12, 0, 1]), a = Math.acos(clamp(dot(d, fw), -1, 1));
    if (a < 0.17) return C.pupil; if (a < 0.47) { const t = (a - 0.17) / 0.3, ang = Math.atan2(d[1], d[0]); return mix(mix(C.irisLt, C.iris, t * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(ang * 23))), hex('#1a0f08'), smooth(0.8, 1, t)); }
    return mix(C.sclera, hex('#d9a49a'), smooth(1.1, 1.6, a) * 0.5); }
  if (pt === 'kurta') {
    let c = mix(C.saffron, C.saffronDk, 0.5 + 0.5 * Math.sin((y * 60 + x * 25) * 6.2832) * 0.35);   // silk sheen
    const bu = (Math.abs(((x + 1) * 26) % 1 - 0.5) < 0.1 && Math.abs(((y + 1) * 26 + (Math.floor((x + 1) * 26) % 2) * 0.5) % 1 - 0.5) < 0.1); if (bu) c = mix(c, C.gold, 0.55);   // small gold butis
    const dn = nearDist(NECK_H, p, 0.06); if (dn < 0.028) { c = mix(C.gold, C.goldDk, (Math.sin(dn * 900) * 0.5 + 0.5) * 0.4); if (dn > 0.02) c = mix(c, C.maroon, 0.7); }   // embroidered neckline
    if (z > 0 && ax < 0.012 && y > 1.2 && dn > 0.02) { c = mix(C.gold, C.goldDk, 0.2); const b = (y - 1.2) % 0.045; if (Math.abs(b - 0.022) < 0.006 && ax < 0.006) c = C.maroon; }   // placket and buttons
    if (y < HEM_Y + 0.035) { c = mix(C.gold, C.goldDk, 0.5 + 0.5 * Math.sin(Math.atan2(x, z) * 60) * 0.6); if (y > HEM_Y + 0.026) c = C.maroon; }   // zari hem
    // the back and sides are always under the jacket: paint them jacket emerald, so wherever the kurta pokes through it reads as jacket
    const under = Math.max(smooth(0.0, -0.035, z), smooth(0.13, 0.17, ax) * smooth(-0.03, 0.03, -z + 0.06)) * smooth(HEM_Y - 0.02, HEM_Y + 0.06, y);
    if (under > 0) { const g = mix(hex('#0d5a3d'), hex('#0a4630'), 0.5 + 0.5 * Math.sin((x * 3 + y) * 80)); c = mix(c, (Math.abs(((y * 8 + x * 8) % 1 + 1) % 1 - 0.5) < 0.02 || Math.abs(((y * 8 - x * 8) % 1 + 1) % 1 - 0.5) < 0.02) ? mix(g, C.gold, 0.6) : g, under); }
    return c; }
  if (pt === 'churi') { let c = C.cream; if (y < 0.34) { const f = 0.5 + 0.5 * Math.sin(y / 0.011 * 6.2832 + Math.sin(Math.atan2(x - Math.sign(x) * 0.085, z) * 3) * 1.5); c = mix(C.cream, C.creamDk, f * 0.55 * smooth(0.34, 0.2, y)); }   // ruched churidar folds at the ankles
    if (y > 0.98) c = mix(c, C.creamDk, 0.25); return c; }
  if (pt === 'shoe') { const cx = x > 0 ? 0.079 : -0.079; let c = C.white;
    if (y < 0.026) return y > 0.021 ? hex('#8a8478') : C.sole;
    const side = Math.abs(x - cx) > 0.032, yc = 0.044 + (z - 0.02) * 0.18; if (side && Math.abs(y - yc) < 0.009 && z > -0.03 && z < 0.17) c = C.gold;
    if (z < -0.035 && y > 0.06) c = C.saffron; return c; }
  return [255, 0, 255];
}
// rasterise every atlas triangle, colouring each texel from its interpolated position and normal
const IMG = new Uint8Array(AT * AT * 4);
const bakeTris = []; for (const pt of ['skin', 'eye', 'kurta', 'churi', 'shoe']) for (const t of parts[pt]) bakeTris.push([pt, t]);
const N3 = (vn) => vn >= 0 ? [O.VN[vn * 3], O.VN[vn * 3 + 1], O.VN[vn * 3 + 2]] : [0, 0, 1];
for (const [pt, t] of bakeTris) {
  const tile = pt === 'skin' ? tileOf(t) : -1, A = t.map(c => atlasPx(pt, c[1])), P = t.map(c => rp(c[0])), Nn = t.map(c => N3(c[2]));
  const x0 = Math.max(0, Math.floor(Math.min(A[0][0], A[1][0], A[2][0]) - 1)), x1 = Math.min(AT - 1, Math.ceil(Math.max(A[0][0], A[1][0], A[2][0]) + 1)), y0 = Math.max(0, Math.floor(Math.min(A[0][1], A[1][1], A[2][1]) - 1)), y1 = Math.min(AT - 1, Math.ceil(Math.max(A[0][1], A[1][1], A[2][1]) + 1));
  const den = (A[1][1] - A[2][1]) * (A[0][0] - A[2][0]) + (A[2][0] - A[1][0]) * (A[0][1] - A[2][1]); if (Math.abs(den) < 1e-9) continue;
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) { const sx = px + 0.5, sy = py + 0.5;
    let l0 = ((A[1][1] - A[2][1]) * (sx - A[2][0]) + (A[2][0] - A[1][0]) * (sy - A[2][1])) / den, l1 = ((A[2][1] - A[0][1]) * (sx - A[2][0]) + (A[0][0] - A[2][0]) * (sy - A[2][1])) / den, l2 = 1 - l0 - l1;
    const e = -0.75 / Math.sqrt(Math.abs(den)); if (l0 < e || l1 < e || l2 < e) continue;   // a texel of slack so edges get covered
    l0 = clamp(l0, 0, 1); l1 = clamp(l1, 0, 1); l2 = clamp(l2, 0, 1); const s = l0 + l1 + l2; l0 /= s; l1 /= s; l2 /= s;
    const p = [0, 1, 2].map(k => P[0][k] * l0 + P[1][k] * l1 + P[2][k] * l2), n = nrm([0, 1, 2].map(k => Nn[0][k] * l0 + Nn[1][k] * l1 + Nn[2][k] * l2));
    const c = paint(pt, tile, p, n), o = (py * AT + px) * 4; IMG[o] = c[0]; IMG[o + 1] = c[1]; IMG[o + 2] = c[2]; IMG[o + 3] = 255; } }
for (let it = 0; it < 8; it++) { const src = IMG.slice(); for (let y = 0; y < AT; y++) for (let x = 0; x < AT; x++) { const o = (y * AT + x) * 4; if (src[o + 3]) continue; let r = 0, g = 0, b = 0, n = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= AT || yy >= AT) continue; const q = (yy * AT + xx) * 4; if (!src[q + 3]) continue; r += src[q]; g += src[q + 1]; b += src[q + 2]; n++; }
  if (n) { IMG[o] = r / n; IMG[o + 1] = g / n; IMG[o + 2] = b / n; IMG[o + 3] = 255; } } }
const atlasPng = await sharp(Buffer.from(IMG), { raw: { width: AT, height: AT, channels: 4 } }).removeAlpha().png().toBuffer();
if (DEBUG) fs.writeFileSync(DEBUG + '/dg_atlas.png', atlasPng);

// ── geometry builders ──
// a part from OBJ triangles → { pos, nrm, uv, jw: [idx4, w4] per vertex, idx }
function fromObj(ptList, uvFn, simplifyTo = 1, weightOverride, err = 0.0015) {
  const map = new Map(), pos = [], nrmA = [], uv = [], J4 = [], W4 = [], idx = [];
  for (const [pt, L] of ptList) for (const t of L) for (const c of t) { const key = uvFn ? c.join('/') : c[0] + '/' + c[2]; let k = map.get(key);
    if (k === undefined) { k = pos.length / 3; map.set(key, k); pos.push(...rp(c[0])); nrmA.push(...N3(c[2])); uv.push(...(uvFn ? uvFn(pt, c) : [0.5, 0.5]));
      const [ji, wi] = weightOverride ? weightOverride : top4(WT.subarray(c[0] * NJ, c[0] * NJ + NJ)); J4.push(...ji); W4.push(...wi); }
    idx.push(k); }
  let I = new Uint32Array(idx);
  if (simplifyTo < 1) { const P = new Float32Array(pos); const [si] = MeshoptSimplifier.simplify(I, P, 3, Math.floor(I.length * simplifyTo / 3) * 3, uvFn ? err : 0.008, uvFn ? ['LockBorder'] : []); I = si; }
  return { pos, nrm: nrmA, uv, J4, W4, idx: Array.from(I) };
}
function merge(...gs) { const o = { pos: [], nrm: [], uv: [], J4: [], W4: [], idx: [] }; for (const g of gs) { const b = o.pos.length / 3; for (const k of ['pos', 'nrm', 'uv', 'J4', 'W4']) for (const v of g[k]) o[k].push(v); for (const i of g.idx) o.idx.push(b + i); } return o; }
const atlasUV = (pt, c) => { const a = atlasPx(pt, c[1]); return [a[0] / AT, a[1] / AT]; };
const tileTris = (ts) => parts.skin.filter(t => ts.includes(tileOf(t)));
const body = merge(fromObj([['skin', tileTris([0])]], atlasUV, 0.42, null, 0.003), fromObj([['skin', tileTris([2])]], atlasUV, 0.5, null, 0.003), fromObj([['skin', tileTris([4, 5])]], atlasUV), fromObj([['eye', parts.eye]], atlasUV));   // face and hands simplified (1.5 mm), lashes, nails and eyes as they are
const kurta = fromObj([['kurta', parts.kurta]], atlasUV, 0.75), churi = fromObj([['churi', parts.churi]], atlasUV, 0.6), shoe = fromObj([['shoe', parts.shoe]], atlasUV, 0.45);
// the beard: thin cards; keep a little over half of them (a stubbly full beard still reads the same)
const beardCards = (() => { const L = parts.beard, par = new Map(), find = (a) => { while (par.get(a) !== a) { par.set(a, par.get(par.get(a))); a = par.get(a); } return a; };
  for (const t of L) for (const c of t) if (!par.has(c[0])) par.set(c[0], c[0]); for (const t of L) { const a = find(t[0][0]); for (const c of t) { const b = find(c[0]); if (a !== b) par.set(b, a); } }
  const keep = new Map(); return L.filter(t => { const r = find(t[0][0]); if (!keep.has(r)) keep.set(r, rnd() < 0.34); return keep.get(r); }); })();
const beard = fromObj([['beard', beardCards]], null);
const smoothOf = (g) => { const map = new Map(), pos = [], nrmA = [], J4 = [], W4 = [], remap = []; for (let i = 0; i < g.pos.length / 3; i++) { const k = g.pos.slice(i * 3, i * 3 + 3).map(v => Math.round(v * 1e5)).join(','); let j = map.get(k);
    if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(...g.pos.slice(i * 3, i * 3 + 3)); nrmA.push(0, 0, 0); J4.push(...g.J4.slice(i * 4, i * 4 + 4)); W4.push(...g.W4.slice(i * 4, i * 4 + 4)); } remap.push(j); }
  const idx = g.idx.map(i => remap[i]); for (let t = 0; t < idx.length; t += 3) { const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map(i => pos.slice(i * 3, i * 3 + 3)), n = cross(sub(b, a), sub(c, a)); for (const i of idx.slice(t, t + 3)) for (let k = 0; k < 3; k++) nrmA[i * 3 + k] += n[k]; }
  return { pos, nrm: nrmA, uv: new Array(pos.length / 3 * 2).fill(0.5), J4, W4, idx }; };
const glass = smoothOf(fromObj([['glass', parts.glass]], null, 0.3)), ear = fromObj([['ear', parts.ear]], null, 0.5);

// ── jacket: sleeves (tubes along each arm), shoulders (the kurta's yoke pushed out) and a Nehru collar ──
const jk = { pos: [], nrm: [], uv: [], J4: [], W4: [], idx: [], trim: [] };
const jv = (p, n, u, v, tr, w) => { const k = jk.pos.length / 3; jk.pos.push(...p); jk.nrm.push(...n); jk.uv.push(u, v); jk.trim.push(tr); const [ji, wi] = w || top4(transfer(p, tmp)); jk.J4.push(...ji); jk.W4.push(...wi); return k; };
const armPts = [...ALLV.skin].map(rp).filter(p => Math.abs(p[0]) > 0.26 && Math.abs(p[0]) < 0.72 && p[1] > 1.3);
const kurtaPts = ptsOf('kurta');
const SLEEVE_END = 0.648, TILE = 0.25;
for (const sg of [1, -1]) {
  // arm cross-sections every 1 cm: centre + half extents (measured where the arm exists, extrapolated to the shoulder)
  const st = []; for (let x = 0.27; x <= 0.7; x += 0.01) { const sl = armPts.filter(p => Math.abs(p[0] * sg - x) < 0.006); if (sl.length < 6) continue; const b = box(sl); st.push({ x, c: b[2], hy: (b[1][1] - b[0][1]) / 2, hz: (b[1][2] - b[0][2]) / 2 }); }
  const fit = st.filter(s => s.x < 0.5), mx = fit.reduce((a, s) => a + s.x, 0) / fit.length, my = fit.reduce((a, s) => a + s.c[1], 0) / fit.length, mz = fit.reduce((a, s) => a + s.c[2], 0) / fit.length;
  const ky = fit.reduce((a, s) => a + (s.x - mx) * (s.c[1] - my), 0) / fit.reduce((a, s) => a + (s.x - mx) ** 2, 0), kz = fit.reduce((a, s) => a + (s.x - mx) * (s.c[2] - mz), 0) / fit.reduce((a, s) => a + (s.x - mx) ** 2, 0);
  const at = (x) => { const near = st.filter(s => Math.abs(s.x - x) < 0.035); const hy = near.length ? near.reduce((a, s) => a + s.hy, 0) / near.length : 0.045, hz = near.length ? near.reduce((a, s) => a + s.hz, 0) / near.length : 0.045;
    const cy = my + ky * (x - mx), cz = mz + kz * (x - mx); return { cy, cz, hy, hz }; };
  const SEGS = 18, xs = []; for (let x = 0.165; x < SLEEVE_END - 1e-4; x += 0.012) xs.push(x); xs.push(SLEEVE_END);
  const rows = [];
  for (const x of xs) { const a = at(Math.max(x, 0.3)), sh = smooth(0.3, 0.18, x);   // the shoulder end widens to meet the kurta's armhole
    const off = lerp(0.016, 0.009, smooth(0.35, 0.62, x)), ry = Math.max(a.hy, 0.032) + off + sh * 0.03, rz = Math.max(a.hz, 0.034) + off + sh * 0.03, cy = a.cy + sh * -0.01;
    const row = []; for (let j = 0; j <= SEGS; j++) { const th = j / SEGS * Math.PI * 2, p = [x * sg, cy + Math.sin(th) * ry, a.cz + Math.cos(th) * rz], n = nrm([0, Math.sin(th) / ry, Math.cos(th) / rz]);
      const circ = Math.PI * (ry + rz); row.push(jv(p, n, j / SEGS * circ / TILE, (x - 0.165) / TILE, x > SLEEVE_END - 0.026 ? 1 : 0)); }
    rows.push(row); }
  for (let r = 0; r + 1 < rows.length; r++) for (let j = 0; j < SEGS; j++) { const a = rows[r][j], b = rows[r][j + 1], c = rows[r + 1][j], d = rows[r + 1][j + 1]; if (sg > 0) jk.idx.push(a, c, b, b, c, d); else jk.idx.push(a, b, c, b, d, c); }
}
// shoulders + back yoke: kurta triangles above the yoke line, pushed out along the normal; open down the front
{ const map = new Map(); for (const t of parts.kurta) { const P3 = t.map(c => rp(c[0])), cy = (P3[0][1] + P3[1][1] + P3[2][1]) / 3, cxm = (P3[0][0] + P3[1][0] + P3[2][0]) / 3, czm = (P3[0][2] + P3[1][2] + P3[2][2]) / 3;
    if (cy < 1.385) continue; if (czm > 0.02 && Math.abs(cxm) < 0.03 + Math.max(0, cy - 1.44) * 0.6) continue;
    const ks = t.map(c => { let k = map.get(c[0]); if (k === undefined) { const p = rp(c[0]), n = N3(c[2]), q = add(p, scl(n, 0.007)), edge = (q[2] > 0.02 && Math.abs(q[0]) < 0.045 + Math.max(0, q[1] - 1.44) * 0.6) ? 1 : 0;
      k = jv(q, n, Math.atan2(q[0], q[2]) * 0.16 / TILE, q[1] / TILE, edge, top4(WT.subarray(c[0] * NJ, c[0] * NJ + NJ))); map.set(c[0], k); } return k; });
    jk.idx.push(...ks); } }
// Nehru collar: a band standing round the base of the neck, with a gap at the front
{ const nk = ptsOf('skin', p => p[1] > 1.49 && p[1] < 1.53 && Math.abs(p[0]) < 0.09); const nb = box(nk); const cz = nb[2][2] - 0.004, rx = (nb[1][0] - nb[0][0]) / 2 + 0.012, rz = (nb[1][2] - nb[0][2]) / 2 + 0.012;
  const base = (th) => { const front = Math.max(0, Math.cos(th)); return 1.485 - front * 0.035; };   // lower at the front, like the kurta's neckline
  const SEGS = 32, H = 0.034, rows = [[], [], []];
  for (let j = 0; j <= SEGS; j++) { const th = 0.3 + j / SEGS * (Math.PI * 2 - 0.6);   // th = 0 is the front
    for (let r = 0; r < 3; r++) { const f = r / 2, k = 1 - f * 0.12, y = base(th) + f * H, p = [Math.sin(th) * rx * k, y, cz + Math.cos(th) * rz * k], n = nrm([Math.sin(th), 0.15, Math.cos(th)]);
      rows[r].push(jv(p, n, j / SEGS * 1.6, f * H / TILE + 3, r === 2 || j === 0 || j === SEGS ? 1 : 0)); } }
  for (let r = 0; r < 2; r++) for (let j = 0; j < SEGS; j++) { const a = rows[r][j], b = rows[r][j + 1], c = rows[r + 1][j], d = rows[r + 1][j + 1]; jk.idx.push(a, b, c, b, d, c); } }

// ── long hair: ribbons rooted on the scalp, swept back and hanging to the shoulders ──
const hr = { pos: [], nrm: [], uv: [], idx: [], fl: [] }, HEADW = [[JI.Head, 0, 0, 0], [1, 0, 0, 0]];
const hv = (p, n, u, v, f) => { const k = hr.pos.length / 3; hr.pos.push(...p); hr.nrm.push(...n); hr.uv.push(u, v); hr.fl.push(f); return k; };
{ // the buzz-cut cap underneath (keeps the scalp dark between strands)
  const cap = fromObj([['cap', parts.cap]], null); const base = hr.pos.length / 3; for (let i = 0; i < cap.pos.length / 3; i++) hv(cap.pos.slice(i * 3, i * 3 + 3), cap.nrm.slice(i * 3, i * 3 + 3), 0.5, 0.06, 0); for (const i of cap.idx) hr.idx.push(base + i); }
const E = (() => { // A x² + B y'² + C z'² + D y' + F z' = 1 (centred on the cap), solved by normal equations
  const P0 = ptsOf('cap'), mc = P0.reduce((a, p) => add(a, p), [0, 0, 0]).map(v => v / P0.length), P = P0.map(p => [p[0], p[1] - mc[1], p[2] - mc[2]]), NU = 5, M = Array.from({ length: NU }, () => new Array(NU + 1).fill(0));
  for (const p of P) { const r = [p[0] * p[0], p[1] * p[1], p[2] * p[2], p[1], p[2]]; for (let i = 0; i < NU; i++) { for (let j = 0; j < NU; j++) M[i][j] += r[i] * r[j]; M[i][NU] += r[i]; } }
  for (let i = 0; i < NU; i++) { let m = i; for (let k = i + 1; k < NU; k++) if (Math.abs(M[k][i]) > Math.abs(M[m][i])) m = k; [M[i], M[m]] = [M[m], M[i]]; for (let k = 0; k < NU; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= NU; j++) M[k][j] -= f * M[i][j]; } }
  const [A, B, Cc, D, F] = M.map((r, i) => r[NU] / r[i]), cy = -D / (2 * B), cz = -F / (2 * Cc), K = 1 + B * cy * cy + Cc * cz * cz;
  const e = { c: [0, cy + mc[1], cz + mc[2]], r: [Math.sqrt(K / A), Math.sqrt(K / B), Math.sqrt(K / Cc)] }; console.log('scalp ellipsoid', e.c.map(v => v.toFixed(3)).join(','), e.r.map(v => v.toFixed(3)).join(',')); return e; })();
const eIn = (p, pad) => { const q = [(p[0] - E.c[0]) / (E.r[0] + pad), (p[1] - E.c[1]) / (E.r[1] + pad), (p[2] - E.c[2]) / (E.r[2] + pad)]; return dot(q, q); };
const eNorm = (p) => nrm([(p[0] - E.c[0]) / E.r[0] ** 2, (p[1] - E.c[1]) / E.r[1] ** 2, (p[2] - E.c[2]) / E.r[2] ** 2]);
const ePush = (p, pad) => { const k = eIn(p, pad); if (k >= 1) return p; const s = 1 / Math.sqrt(k); return [E.c[0] + (p[0] - E.c[0]) * s, E.c[1] + (p[1] - E.c[1]) * s, E.c[2] + (p[2] - E.c[2]) * s]; };
const capTris = parts.cap.map(t => t.map(c => rp(c[0]))).filter(P3 => { const n = nrm(cross(sub(P3[1], P3[0]), sub(P3[2], P3[0]))); const c = scl(add(add(P3[0], P3[1]), P3[2]), 1 / 3); return c[1] > E.c[1] - 0.035 || c[2] < E.c[2] - 0.02; });
const capArea = capTris.map(P3 => len(cross(sub(P3[1], P3[0]), sub(P3[2], P3[0]))) / 2), capTot = capArea.reduce((a, b) => a + b, 0);
const sampleCap = () => { let r = rnd() * capTot, i = 0; while (r > capArea[i] && i < capArea.length - 1) { r -= capArea[i]; i++; } let a = rnd(), b = rnd(); if (a + b > 1) { a = 1 - a; b = 1 - b; } const P3 = capTris[i]; return add(P3[0], add(scl(sub(P3[1], P3[0]), a), scl(sub(P3[2], P3[0]), b))); };
const NECK_C = [0, 1.5, -0.035];
for (let layer = 0; layer < 3; layer++) for (let s = 0; s < [64, 56, 44][layer]; s++) {
  const r0 = sampleCap(); const front = smooth(-0.02, 0.06, r0[2] - E.c[2]), sideK = Math.abs(r0[0]) / E.r[0];
  const L = lerp(0.3, 0.17, front) * (0.85 + rnd() * 0.3) * (1 + 0.12 * layer) * (1 - 0.15 * sideK * front), pad = 0.005 + layer * 0.0045, NS = 10, ds = L / NS;
  let p = ePush(add(r0, scl(eNorm(r0), pad)), pad), dir = (() => { const n = eNorm(p), want = nrm([r0[0] * 0.6, front * 0.25 - 0.6, -1]); return nrm(sub(want, scl(n, dot(want, n)))); })();
  let bprev = nrm(cross(dir, eNorm(p))); const w0 = lerp(0.03, 0.022, front) * (0.8 + rnd() * 0.4), path = [[p, bprev, 0]];
  for (let k = 1; k <= NS; k++) {
    const g = [r0[0] > 0 ? 0.08 : -0.08, -0.9, -0.25 + 0.15 * (k / NS)]; dir = nrm(add(dir, scl(g, 0.22 + 0.25 * (1 - front))));
    p = add(p, scl(dir, ds)); p = ePush(p, pad);
    { const d = sub(p, NECK_C); d[0] *= 0.8; const r = 0.085 + pad, l = Math.hypot(d[0], (p[1] < 1.56 ? 0 : d[1]), d[2]); if (p[1] < 1.6 && l < r) { const q = nrm([d[0], 0, d[2]]); p = [NECK_C[0] + q[0] * r / 0.8, p[1], NECK_C[2] + q[2] * r]; } }
    if (p[1] < 1.47) p[1] = 1.47 + (p[1] - 1.47) * 0.3;   // rest on the shoulders, don't sink into them
    const n = eIn(p, 0.05) < 1 ? eNorm(p) : nrm(sub(p, NECK_C)); let b = nrm(cross(dir, n)); if (dot(b, bprev) < 0) b = scl(b, -1); bprev = b; path.push([p, b, k / NS]); }
  const base = hr.pos.length / 3, u0 = rnd() < 0.5 ? 0 : 0.5;
  for (const [q, b, t] of path) { const w = w0 * (1 - 0.6 * t) * 0.5, n = nrm(cross(b, sub(path[Math.min(path.length - 1, Math.round(t * NS) + 1)][0], path[Math.max(0, Math.round(t * NS) - 1)][0])));
    const nn = dot(n, eNorm(q)) < 0 ? scl(n, -1) : n; hv(add(q, scl(b, -w)), nn, u0, t, Math.pow(t, 1.25)); hv(add(q, scl(b, w)), nn, u0 + 0.5, t, Math.pow(t, 1.25)); }
  for (let k = 0; k < NS; k++) { const a = base + k * 2; hr.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
console.log('hair', hr.pos.length / 3, 'verts', hr.idx.length / 3, 'tris; jacket', jk.pos.length / 3, 'verts', jk.idx.length / 3, 'tris');

// ── 5. the glTF: same skeleton, one skin with plain inverse bind matrices, the Dogesh meshes ──
for (const n of root.listNodes()) if (n.getMesh()) n.dispose();
for (const m of root.listMeshes()) m.dispose(); for (const s of root.listSkins()) s.dispose(); for (const m of root.listMaterials()) m.dispose(); for (const t of root.listTextures()) t.dispose();
const armature = root.listNodes().find(n => n.getName() === 'Armature');
const ibm = new Float32Array(NJ * 16); JOINTS.forEach((j, i) => ibm.set(inv4(j.getWorldMatrix()), i * 16));
const skin = doc.createSkin('dogesh').setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer)); for (const j of JOINTS) skin.addJoint(j);
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
const tex = doc.createTexture('T_Dogesh').setImage(atlasPng).setMimeType('image/png');
const MAT = { body: doc.createMaterial('MI_Dogesh').setBaseColorTexture(tex).setRoughnessFactor(0.75).setMetallicFactor(0), hair: doc.createMaterial('MI_Dogesh_Hair').setBaseColorFactor([0.1, 0.07, 0.05, 1]),
  beard: doc.createMaterial('MI_Dogesh_Beard').setBaseColorFactor([0.09, 0.06, 0.045, 1]), glass: doc.createMaterial('MI_Dogesh_Glass').setBaseColorFactor([0.02, 0.02, 0.025, 1]).setRoughnessFactor(0.2),
  gold: doc.createMaterial('MI_Dogesh_Gold').setBaseColorFactor([0.85, 0.6, 0.18, 1]).setMetallicFactor(1).setRoughnessFactor(0.25), jacket: doc.createMaterial('MI_Dogesh_Jacket').setBaseColorFactor([0.05, 0.36, 0.25, 1]) };
function addMesh(name, g, mat, extra = {}, noUV = false) {
  const n = g.pos.length / 3, J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) { J[i] = g.J4 ? g.J4[i] : (i % 4 === 0 ? JI.Head : 0); W[i] = g.W4 ? g.W4[i] : (i % 4 === 0 ? 1 : 0); }
  // drop vertices no triangle uses (simplification leaves them behind)
  const useI = new Int32Array(n).fill(-1); let m = 0; for (const i of g.idx) if (useI[i] < 0) useI[i] = m++;
  const pick = (arr, k) => { const o = new Float32Array(m * k); for (let i = 0; i < n; i++) if (useI[i] >= 0) for (let c = 0; c < k; c++) o[useI[i] * k + c] = arr[i * k + c]; return o; };
  const Jp = new Uint16Array(m * 4); for (let i = 0; i < n; i++) if (useI[i] >= 0) for (let c = 0; c < 4; c++) Jp[useI[i] * 4 + c] = J[i * 4 + c];
  const p = doc.createPrimitive().setMaterial(mat).setAttribute('POSITION', acc('VEC3', pick(g.pos, 3))).setAttribute('NORMAL', acc('VEC3', pick(g.nrm.map((v, i) => v), 3).map((v, i, a) => v)))
    .setAttribute('JOINTS_0', acc('VEC4', Jp)).setAttribute('WEIGHTS_0', acc('VEC4', pick(W, 4))).setIndices(acc('SCALAR', m < 65536 ? new Uint16Array(g.idx.map(i => useI[i])) : new Uint32Array(g.idx.map(i => useI[i]))));
  if (!noUV) p.setAttribute('TEXCOORD_0', acc('VEC2', pick(g.uv, 2)));
  for (const [k, arr] of Object.entries(extra)) p.setAttribute(k, acc('SCALAR', pick(arr, 1)));
  // unit normals
  { const N = p.getAttribute('NORMAL').getArray(); for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; } }
  armature.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(p)).setSkin(skin));
  console.log('mesh', name, m, 'verts', g.idx.length / 3, 'tris');
}
addMesh('dg_body', merge(body, kurta, churi, shoe), MAT.body);
addMesh('dg_jacket', jk, MAT.jacket, { _TRIM: jk.trim });
addMesh('dg_hair', Object.assign(hr, { J4: null, W4: null }), MAT.hair, { _FLUTTER: hr.fl });
addMesh('dg_beard', beard, MAT.beard, {}, true);
addMesh('dg_glass', glass, MAT.glass, {}, true);
addMesh('dg_ear', ear, MAT.gold, {}, true);
// face points in Head-bone space for gestures (mouth for the cigarette, crown for the comb, temples), printed for the runtime
{ const H = JW.Head; console.log('marks (head space):', JSON.stringify({ mouth: sub(MOUTH, H).map(v => +v.toFixed(3)), crown: [0, +(HB[1][1] - H[1] + 0.025).toFixed(3), -0.01], eyes: sub(EYE.l, H).map(v => +v.toFixed(3)) })); }

// ── 6. compress ──
await doc.transform(dedup(), prune({ keepAttributes: true }));
for (const t of root.listTextures()) t.setImage(await sharp(Buffer.from(t.getImage())).webp({ quality: 90 }).toBuffer()).setMimeType('image/webp');
doc.createExtension(EXTTextureWebP).setRequired(true);
// meshopt-compressed (EXT_meshopt_compression; the game sets three's MeshoptDecoder on the loader): about half the size of plain quantised data
await MeshoptEncoder.ready; io.registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }), prune({ keepAttributes: true }));
await io.write(out, doc);
console.log('written', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
