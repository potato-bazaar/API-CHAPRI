// Build the Chapri rider from Quaternius "Universal Base Characters" (CC0): Superhero_Male body + hair.
// 1. slim the body (pull flesh toward each bone, torso flattened most) → a skinny street kid
// 2. classify every triangle (skin / shirt / jeans / belt / shoes) and paint the texture via paint-rider.py
// 3. merge hairstyles onto the same skeleton, light LOD body for rivals, compress
// usage: node tools/model/build-rider.mjs <Superhero_Male.glb> <hairDir> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, weld, simplifyPrimitive, textureCompress, dedup, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import { execFileSync } from 'child_process';
const [src, hairDir, out] = process.argv.slice(2);
const tmp = '/tmp/claude-0/-home-claude/d0068754-e91d-5433-95b6-3ca794e92c94/scratchpad/rd/';
fs.mkdirSync(tmp, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src); const root = doc.getRoot(); const buffer = root.listBuffers()[0];
const skin = root.listSkins()[0]; const J = skin.listJoints(); const JN = J.map(j => j.getName());
const jpos = J.map(j => { const w = j.getWorldMatrix(); return [w[12], w[13], w[14]]; });
const ji = (n) => JN.indexOf(n);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const prims = root.listMeshes().flatMap(m => m.listPrimitives().map(p => ({ m, p })));
const bodyP = prims.find(x => x.p.getMaterial().getName() === 'MI_Superhero_Male').p;
for (const { p } of prims) for (const s of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'].includes(s)) p.setAttribute(s, null);

// ── 1. slimming ──
const CHILD = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head', clavicle_l: 'upperarm_l', upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', hand_l: 'middle_01_l', thigh_l: 'calf_l', calf_l: 'foot_l', foot_l: 'ball_l', ball_l: 'ball_leaf_l' };
for (const [k, v] of Object.entries(CHILD)) if (k.endsWith('_l')) CHILD[k.replace(/_l$/, '_r')] = v.replace(/_l$/, '_r');
const K = { // [kx, ky, kz] applied to the offset from the bone line: fit and athletic (broad chest and shoulders, slim waist)
  pelvis: [0.88, 1, 0.86], spine_01: [0.84, 1, 0.8], spine_02: [0.9, 1, 0.84], spine_03: [0.97, 1, 0.9], neck_01: [0.9, 1, 0.9],
  clavicle: [0.97, 0.92, 0.92], upperarm: [0.82, 0.82, 0.82], lowerarm: [0.84, 0.84, 0.84], hand: [0.92, 0.92, 0.92],
  thigh: [0.78, 0.78, 0.78], calf: [0.8, 0.8, 0.8], foot: [0.94, 0.94, 0.94], ball: [0.96, 0.96, 0.96],
};
const kOf = (n) => K[n] || K[n.replace(/_[lr]$/, '')] || null;
const seg = J.map((j, i) => { const c = CHILD[JN[i]]; return c ? [jpos[i], jpos[ji(c)]] : [jpos[i], jpos[i]]; });
function closest(p, [a, b]) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2; let t = L ? ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L : 0; t = Math.max(0, Math.min(1, t)); return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]; }
function slim(prim) {
  const P = prim.getAttribute('POSITION'), JA = prim.getAttribute('JOINTS_0'), WA = prim.getAttribute('WEIGHTS_0'); const n = P.getCount();
  const out = new Float32Array(n * 3); const p = [0, 0, 0], jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    P.getElement(i, p); JA.getElement(i, jj); WA.getElement(i, ww); let sw = 0; const acc = [0, 0, 0];
    for (let q = 0; q < 4; q++) { const w = ww[q]; if (w <= 0) continue; const k = kOf(JN[jj[q]]); let r;
      if (!k) r = p; else { const c = closest(p, seg[jj[q]]); r = [c[0] + (p[0] - c[0]) * k[0], c[1] + (p[1] - c[1]) * k[1], c[2] + (p[2] - c[2]) * k[2]]; }
      acc[0] += r[0] * w; acc[1] += r[1] * w; acc[2] += r[2] * w; sw += w; }
    out.set(sw ? [acc[0] / sw, acc[1] / sw, acc[2] / sw] : p, i * 3);
  }
  P.setArray(out); P.setNormalized(false);
}
slim(bodyP);
if (process.env.MEASURE) { const P = bodyP.getAttribute('POSITION').getArray(); const pts = []; for (let i = 0; i < P.length; i += 3) pts.push([P[i], P[i + 1], P[i + 2]]);
  for (const y of [1.46, 1.42, 1.4, 1.38, 1.34, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1.0, 0.95, 0.93]) { const sl = pts.filter(p => Math.abs(p[1] - y) < 0.02 && Math.abs(p[0]) < 0.3);
    const ctr = sl.filter(p => Math.abs(p[0]) < 0.045); const back = Math.min(...ctr.map(p => p[2])), front = Math.max(...ctr.map(p => p[2]));
    const mid = (back + front) / 2; const side = Math.max(...sl.filter(p => Math.abs(p[2] - mid) < 0.05 && Math.abs(p[0]) < (y > 1.36 ? 0.2 : 0.24)).map(p => Math.abs(p[0])));
    console.log('y', y, 'back z', back.toFixed(3), 'front z', front.toFixed(3), 'side x', side.toFixed(3)); }
  process.exit(0); }

// ── 2. regions → paint the texture ──
// every texel is classified from its interpolated 3D position (paint-rider.py): skin / shirt / jeans / belt / shoes / sole
const tris = []; { const P = bodyP.getAttribute('POSITION'), UV = bodyP.getAttribute('TEXCOORD_0'), JA = bodyP.getAttribute('JOINTS_0'), WA = bodyP.getAttribute('WEIGHTS_0'), I = bodyP.getIndices().getArray();
  const p = [0, 0, 0], uv = [0, 0], jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
  for (let t = 0; t < I.length; t += 3) { const u = [], xyz = []; const wsum = new Map();
    for (let k = 0; k < 3; k++) { P.getElement(I[t + k], p); UV.getElement(I[t + k], uv); u.push(uv[0], uv[1]); xyz.push(...p); JA.getElement(I[t + k], jj); WA.getElement(I[t + k], ww); for (let q = 0; q < 4; q++) wsum.set(jj[q], (wsum.get(jj[q]) || 0) + ww[q]); }
    let dom = 0, best = -1; for (const [j, w] of wsum) if (w > best) { best = w; dom = j; }
    tris.push([/^(Head|neck_01)$/.test(JN[dom]) ? 1 : 0, ...u.map(v => +v.toFixed(5)), ...xyz.map(v => +v.toFixed(4))]); } }
const bodyMat = bodyP.getMaterial(); const skinTex = bodyMat.getBaseColorTexture();
fs.writeFileSync(tmp + 'skin.png', Buffer.from(skinTex.getImage())); fs.writeFileSync(tmp + 'tris.json', JSON.stringify(tris));
execFileSync('python3', ['-I', new URL('./paint-rider.py', import.meta.url).pathname, tmp + 'skin.png', tmp + 'tris.json', tmp + 'base.png', tmp + 'mask.png'], { stdio: 'inherit' });
skinTex.setImage(fs.readFileSync(tmp + 'base.png')).setMimeType('image/png').setName('T_Rider_Base');
// the mask (R = shirt, G = jeans) rides in the occlusion slot; the game reads it as a mask and clears aoMap
const maskTex = doc.createTexture('T_Rider_Mask').setImage(fs.readFileSync(tmp + 'mask.png')).setMimeType('image/png');
bodyMat.setOcclusionTexture(maskTex).setRoughnessFactor(0.85).setMetallicFactor(0);

// ── 2b. loose shirt shell: a copy of the shirt panels, eased off the body, with a flutter weight per vertex;
//        plus the chapri knot tied at the front hem with two tails. The game blows these back with speed.
const isShirt = (x, y, z) => { const ax = Math.abs(x);   // the shell is just the sleeves now; the torso panels are simulated cloth in the game
  return y > 1.25 && ax > 0.2 && ax <= 0.355; };
const flutterOf = (x, y, z) => { const ax = Math.abs(x); let f = clamp01((1.25 - y) / 0.25) * 0.9;
  if (z > 0) f = Math.max(f, clamp01(1 - ax / 0.1) * clamp01((1.42 - y) / 0.3));
  if (ax > 0.24) f = Math.max(f, clamp01((ax - 0.24) / 0.11) * 0.85);
  if (z < -0.02) f = Math.max(f, clamp01((1.38 - y) / 0.35) * 0.7);
  return f; };
const shellP = (() => {
  const P = bodyP.getAttribute('POSITION').getArray(), N = bodyP.getAttribute('NORMAL').getArray(), UVa = bodyP.getAttribute('TEXCOORD_0').getArray(), JA = bodyP.getAttribute('JOINTS_0').getArray(), WA = bodyP.getAttribute('WEIGHTS_0').getArray(), I = bodyP.getIndices().getArray();
  const nv = P.length / 3, ok = new Uint8Array(nv); for (let i = 0; i < nv; i++) ok[i] = isShirt(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) ? 1 : 0;
  const map = new Map(), pos = [], nor = [], uv = [], jo = [], we = [], fl = [], idx = [];
  const vert = (i) => { if (map.has(i)) return map.get(i); const k = map.size; map.set(i, k); const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    pos.push(x + N[i * 3] * 0.013, y + N[i * 3 + 1] * 0.013, z + N[i * 3 + 2] * 0.013); nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); uv.push(UVa[i * 2], UVa[i * 2 + 1]);
    for (let q = 0; q < 4; q++) { jo.push(JA[i * 4 + q]); we.push(WA[i * 4 + q]); } fl.push(flutterOf(x, y, z)); return k; };
  for (let t = 0; t < I.length; t += 3) if (ok[I[t]] && ok[I[t + 1]] && ok[I[t + 2]]) idx.push(vert(I[t]), vert(I[t + 1]), vert(I[t + 2]));
  const p = doc.createPrimitive().setMaterial(bodyMat);
  const acc = (type, arr, norm = false) => doc.createAccessor().setType(type).setArray(arr).setNormalized(norm).setBuffer(buffer);
  p.setAttribute('POSITION', acc('VEC3', new Float32Array(pos))).setAttribute('NORMAL', acc('VEC3', new Float32Array(nor))).setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv)));
  const JAacc = bodyP.getAttribute('JOINTS_0'), WAacc = bodyP.getAttribute('WEIGHTS_0');
  p.setAttribute('JOINTS_0', acc('VEC4', new (JAacc.getArray().constructor)(jo))).setAttribute('WEIGHTS_0', acc('VEC4', new (WAacc.getArray().constructor)(we), WAacc.getNormalized()));
  p.setAttribute('_FLUTTER', acc('SCALAR', new Float32Array(fl))).setIndices(acc('SCALAR', new Uint32Array(idx)));
  console.log('shirt shell', idx.length / 3, 'tris');
  return p;
})();
// ── 3. hair on the same skeleton ──
const hairMat = root.listMaterials().find(m => m.getName() === 'MI_Hair_1');
const scene = root.getDefaultScene() || root.listScenes()[0];
const armature = scene.listChildren().find(n => n.getName() === 'Armature');
for (const [file, name, puff] of [['Hair_SimpleParted.glb', 'hair_quiff', 1], ['Hair_Long.glb', 'hair_long', 0], ['Hair_Buzzed.glb', 'hair_buzz', 0], ['Hair_Beard.glb', 'beard', 0]]) {
  const hd = await io.read(hairDir + '/' + file); const hs = hd.getRoot().listSkins()[0]; const hj = hs.listJoints().map(n => n.getName());
  if (hj.join() !== JN.join()) throw new Error('joint order differs in ' + file);
  const hp = hd.getRoot().listMeshes()[0].listPrimitives()[0];
  const np = doc.createPrimitive().setMaterial(hairMat);
  for (const s of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) { const a = hp.getAttribute(s); if (!a) continue; let arr = a.getArray().slice();
    if (s === 'POSITION' && puff) { // chapri quiff: lift and fluff the top-front of the hair
      const head = jpos[ji('Head')]; for (let i = 0; i < arr.length; i += 3) { const dy = arr[i + 1] - (head[1] + 0.1); if (dy <= 0) continue; const front = Math.max(0, (arr[i + 2] - head[2] + 0.02) / 0.12);
        arr[i + 1] += dy * (0.25 + 0.45 * front); arr[i + 2] += dy * 0.25 * front; arr[i] *= 1 + dy * 0.4; } }
    np.setAttribute(s, doc.createAccessor().setType(a.getType()).setArray(arr).setNormalized(a.getNormalized()).setBuffer(buffer)); }
  np.setIndices(doc.createAccessor().setType('SCALAR').setArray(hp.getIndices().getArray().slice()).setBuffer(buffer));
  { // how much each hair vertex streams in the wind: quiff tips, the lower half of long hair; buzz / beard stay put
    const P = np.getAttribute('POSITION').getArray(); const n = P.length / 3; let maxY = -9; for (let i = 0; i < n; i++) maxY = Math.max(maxY, P[i * 3 + 1]);
    const fl = new Float32Array(n);
    for (let i = 0; i < n; i++) { const y = P[i * 3 + 1], z = P[i * 3 + 2];
      fl[i] = name === 'hair_quiff' ? clamp01((y - (maxY - 0.13)) / 0.13) * 0.75 : name === 'hair_long' ? clamp01((1.74 - y) / 0.28) * (z < 0.04 ? 1 : 0.55) + 0.12 * clamp01((y - 1.6) / 0.2) : 0; }
    np.setAttribute('_FLUTTER', doc.createAccessor().setType('SCALAR').setArray(fl).setBuffer(buffer));
  }
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(np)).setSkin(skin); armature.addChild(node);
}
// ── 3b. the pompadour: a sculpted shell over the scalp, tall and swept back at the front, faded short on the sides.
//        Parametric on an ellipsoid fitted to the scalp: theta from the crown down to the hairline, phi around (0 = face).
{ const C = [0, 1.705, -0.006], RX = 0.082, RY = 0.108, RZ = 0.104, NP = 84, NT = 30, HEAD = ji('Head');
  const sst = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const hairline = (ph) => { const f = Math.abs(ph) / Math.PI; return f < 0.5 ? 0.98 + (1.62 - 0.98) * sst(f / 0.5) : 1.62 + (2.18 - 1.62) * sst((f - 0.5) / 0.5); };
  const pos = [], uv = [], fl = [], idx = []; const ring = [];
  const surf = (ph, t, extra) => { const tm = hairline(ph), u = t * tm; const dx = Math.sin(u) * Math.sin(ph), dy = Math.cos(u), dz = Math.sin(u) * Math.cos(ph);
    const front = sst((Math.cos(ph) + 0.25) / 1.25), side = Math.abs(Math.sin(ph)) * sst((t - 0.55) / 0.3);
    const crest = Math.exp(-((t - 0.55) ** 2) / 0.11);                                   // the roll peaks a little behind the hairline
    let h = 0.007 + 0.046 * front ** 1.4 * crest + 0.018 * (1 - Math.abs(Math.cos(ph)) * 0.5) * sst(1 - t / 0.7) * (1 - front * 0.6) - 0.004 * side;
    h += (0.0045 * Math.sin(ph * 19 + Math.sin(ph * 5) * 1.8) + 0.002 * Math.sin(ph * 41 + 1.3)) * sst(1 - t) * (0.35 + front);   // sculpted strand clumps running back
    h += extra;
    const x = C[0] + (RX + h) * dx, y = C[1] + (RY + h) * dy + 0.016 * front * crest, z = C[2] + (RZ + h) * dz + 0.014 * front ** 2 * crest * (0.6 + 0.4 * t);
    return [x, y, z, front * crest]; };
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NP; i++) { const ph = -Math.PI + 2 * Math.PI * i / NP, t = j / NT; const [x, y, z, fc] = surf(ph, t, 0);
    pos.push(x, y, z); uv.push(i / NP * 6, t); fl.push(0.35 * fc); }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NP; i++) { const a = j * (NP + 1) + i, b = a + NP + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // the hairline edge folds back down onto the scalp (the front of the quiff is this wall)
  const base = pos.length / 3; for (let i = 0; i <= NP; i++) { const ph = -Math.PI + 2 * Math.PI * i / NP; const tm = hairline(ph), u = tm; const dx = Math.sin(u) * Math.sin(ph), dy = Math.cos(u), dz = Math.sin(u) * Math.cos(ph);
    pos.push(C[0] + (RX - 0.004) * dx, C[1] + (RY - 0.004) * dy, C[2] + (RZ - 0.004) * dz); uv.push(i / NP * 6, 1.05); fl.push(0); }
  for (let i = 0; i < NP; i++) { const a = NT * (NP + 1) + i, b = base + i; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // smooth normals
  const nor = new Float32Array(pos.length); for (let k = 0; k < idx.length; k += 3) { const [a, b, c] = [idx[k] * 3, idx[k + 1] * 3, idx[k + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const v of [a, b, c]) { nor[v] += n[0]; nor[v + 1] += n[1]; nor[v + 2] += n[2]; } }
  for (let v = 0; v < nor.length; v += 3) { const L = Math.hypot(nor[v], nor[v + 1], nor[v + 2]) || 1; nor[v] /= L; nor[v + 1] /= L; nor[v + 2] /= L; }
  const nv = pos.length / 3, JO = new Uint16Array(nv * 4), WE = new Float32Array(nv * 4); for (let v = 0; v < nv; v++) { JO[v * 4] = HEAD; WE[v * 4] = 1; }
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const pp = doc.createPrimitive().setMaterial(hairMat).setAttribute('POSITION', acc('VEC3', new Float32Array(pos))).setAttribute('NORMAL', acc('VEC3', nor)).setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv)))
    .setAttribute('JOINTS_0', acc('VEC4', JO)).setAttribute('WEIGHTS_0', acc('VEC4', WE)).setAttribute('_FLUTTER', acc('SCALAR', new Float32Array(fl))).setIndices(acc('SCALAR', new Uint32Array(idx)));
  armature.addChild(doc.createNode('hair_pomp').setMesh(doc.createMesh('hair_pomp').addPrimitive(pp)).setSkin(skin));
  console.log('pompadour', idx.length / 3, 'tris'); }
armature.addChild(doc.createNode('shirt').setMesh(doc.createMesh('shirt').addPrimitive(shellP)).setSkin(skin));
const shellLod = shellP.clone(); armature.addChild(doc.createNode('shirt_lod').setMesh(doc.createMesh('shirt_lod').addPrimitive(shellLod)).setSkin(skin));
{ const brows = root.listNodes().find(n => n.getName() === 'Eyebrows'); brows.getMesh().listPrimitives()[0].setMaterial(hairMat.clone().setName('MI_Brows')); }
for (const n of root.listNodes()) if (n.getMesh()) { const nm = n.getName(); if (nm === 'SuperHero_Male') n.setName('body'); n.getMesh().setName(n.getName()); }

// ── 4. light body for rivals ──
await MeshoptSimplifier.ready;
const lp = bodyP.clone(); const lodNode = doc.createNode('body_lod').setMesh(doc.createMesh('body_lod').addPrimitive(lp)).setSkin(skin); armature.addChild(lodNode);
await doc.transform(weld());
simplifyPrimitive(lp, { simplifier: MeshoptSimplifier, ratio: 0.32, error: 0.004 });
simplifyPrimitive(shellLod, { simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.004 });
const tri = (m) => m.listPrimitives().reduce((a, p) => a + p.getIndices().getCount() / 3, 0);
for (const m of root.listMeshes()) console.log('mesh', m.getName(), Math.round(tri(m)), 'tris');

// ── 5. compress ──
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColorTexture$/, quality: 88, resize: [1024, 1024] }),
  dedup(), prune(),
);
// small textures for eyes / brows+hair, lossless mask
for (const t of root.listTextures()) {
  const nm = t.getName(); let img = sharp(Buffer.from(t.getImage()));
  if (nm === 'T_Rider_Mask') { t.setImage(await img.resize(1024, 1024, { kernel: 'nearest' }).webp({ lossless: true }).toBuffer()).setMimeType('image/webp'); }
  else if (/Eye|Hair/.test(nm)) { t.setImage(await img.resize(128, 128).webp({ quality: 85 }).toBuffer()).setMimeType('image/webp'); }
}
if (!root.listExtensionsUsed().some(e => e.extensionName === 'EXT_texture_webp')) { const { EXTTextureWebP } = await import('@gltf-transform/extensions'); doc.createExtension(EXTTextureWebP).setRequired(true); }
await doc.transform(quantize({ pattern: /^(POSITION|NORMAL|TEXCOORD_0|JOINTS_0|WEIGHTS_0)$/, quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }), prune());
for (const t of root.listTextures()) console.log('tex', t.getName(), t.getMimeType(), t.getSize(), (t.getImage().byteLength / 1024).toFixed(0) + ' KB');
await io.write(out, doc);
console.log('written', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
