// Prepare "Cyberpunk bike" by daCruz (Sketchfab, CC BY-NC) for the game: keep the painted mesh (its own ink-outline hull
// is dropped: the game draws its own), fit it to bike space (+z forward, wheels on the ground, wheel radius = the game's),
// split both wheels off so they spin, add a light LOD, compress textures and geometry.
//   node tools/model/build-cyber.mjs assets/cyber_src/cyberpunk_bike_1k.glb assets/cyber.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, weld, simplifyPrimitive, transformMesh, quantize, textureCompress, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import { components } from './components.mjs';
const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src), root = doc.getRoot(), buffer = root.listBuffers()[0];
for (const n of root.listNodes().filter(n => n.getMesh())) transformMesh(n.getMesh(), n.getWorldMatrix());
const paint = root.listMaterials().find(m => m.getEmissiveTexture());
const main = root.listMeshes().find(m => m.listPrimitives()[0].getMaterial() === paint), prim = main.listPrimitives()[0];
for (const s of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(s)) prim.setAttribute(s, null);
for (const e of paint.listExtensions()) paint.setExtension(e.extensionName, null); for (const e of root.listExtensionsUsed()) if (e.extensionName === 'KHR_materials_unlit') e.dispose();
paint.setName('cyber').setRoughnessFactor(0.62).setMetallicFactor(0.08).setDoubleSided(false);
// 1. find the tyres (the two biggest pieces), from them the axles; fit: wheel radius 0.3121 m, tyres on the ground, axle midpoint at z = 0.01
const P = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices().getArray();
let C = components(P, idx).sort((a, b) => b.tris.length - a.tris.length);
const [tA, tB] = C.slice(0, 2), ctr = (c) => [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2], rad = (c) => (c.max[1] - c.min[1]) / 2;
const front = ctr(tA)[2] > ctr(tB)[2] ? tA : tB, rear = front === tA ? tB : tA, cF = ctr(front), cR = ctr(rear), R = (rad(front) + rad(rear)) / 2;
const k = 0.3121 / R, cx = (cF[0] + cR[0]) / 2, y0 = Math.min(front.min[1], rear.min[1]), zm = (cF[2] + cR[2]) / 2;
transformMesh(main, [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -cx * k, -y0 * k, -zm * k + 0.01, 1]);
const axF = { y: (cF[1] - y0) * k, z: (cF[2] - zm) * k + 0.01 }, axR = { y: (cR[1] - y0) * k, z: (cR[2] - zm) * k + 0.01 };
console.log('scale', k.toFixed(4), 'axles', axF, axR, 'wheelbase', (axF.z - axR.z).toFixed(3));
// 2. what turns with a wheel: every piece that sits wholly inside the tyre's circle and is centred on the axle (tyre, rim, discs, hub)
const Q = prim.getAttribute('POSITION').getArray(); C = components(Q, idx);
const owner = new Int8Array(idx.length / 3); let nF = 0, nR = 0;
for (const c of C) { const m = ctr(c); for (const [ax, id] of [[axF, 1], [axR, 2]]) { const off = Math.hypot(m[1] - ax.y, m[2] - ax.z); let far = 0; for (const t of c.tris) for (let j = 0; j < 3; j++) { const v = idx[t * 3 + j]; far = Math.max(far, Math.hypot(Q[v * 3 + 1] - ax.y, Q[v * 3 + 2] - ax.z)); }
    if (far < 0.3121 * 1.03 && off < 0.03) { for (const t of c.tris) owner[t] = id; id === 1 ? nF += c.tris.length : nR += c.tris.length; } } }
console.log('wheel tris front', nF, 'rear', nR, 'body', idx.length / 3 - nF - nR);
function sub(id, center) { const map = new Map(), tris = []; for (let t = 0; t < owner.length; t++) { if (owner[t] !== id) continue; for (let j = 0; j < 3; j++) { const v = idx[t * 3 + j]; if (!map.has(v)) map.set(v, map.size); tris.push(map.get(v)); } }
  const np = doc.createPrimitive().setMaterial(paint).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(tris)).setBuffer(buffer));
  for (const s of prim.listSemantics()) { const a = prim.getAttribute(s), n = a.getElementSize(), A = a.getArray(), arr = new Float32Array(map.size * n); for (const [o, nn] of map) for (let c = 0; c < n; c++) arr[nn * n + c] = A[o * n + c];
    if (s === 'POSITION' && center) for (let i = 0; i < map.size; i++) { arr[i * 3 + 1] -= center.y; arr[i * 3 + 2] -= center.z; }
    np.setAttribute(s, doc.createAccessor().setType(a.getType()).setArray(arr).setBuffer(buffer)); } return np; }
const scene = root.getDefaultScene() || root.listScenes()[0]; for (const n of root.listNodes()) n.dispose();
const mk = (name, p, t = [0, 0, 0]) => { const m = doc.createMesh(name).addPrimitive(p); scene.addChild(doc.createNode(name).setMesh(m).setTranslation(t)); return p; };
const body = mk('body', sub(0, null)), wF = mk('wheelF', sub(1, axF), [0, axF.y, axF.z]), wR = mk('wheelR', sub(2, axR), [0, axR.y, axR.z]), lod = mk('body_lod', body.clone());
for (const m of root.listMeshes()) if (!['body', 'wheelF', 'wheelR', 'body_lod'].includes(m.getName())) m.dispose();
// 3. measure where the rider goes before anything is simplified: seat, grips, headlamp, tail
{ const B = body.getAttribute('POSITION').getArray(); const top = (z0, z1, xw) => { let y = 0; for (let i = 0; i < B.length; i += 3) if (B[i + 2] > z0 && B[i + 2] < z1 && Math.abs(B[i]) < xw) y = Math.max(y, B[i + 1]); return +y.toFixed(3); };
  let gx = 0, gy = 0, gz = 0, n = 0, zmax = -9, zmin = 9; for (let i = 0; i < B.length; i += 3) { zmax = Math.max(zmax, B[i + 2]); zmin = Math.min(zmin, B[i + 2]); if (B[i] > 0.27) { gx += B[i]; gy += B[i + 1]; gz += B[i + 2]; n++; } }
  console.log('fit', JSON.stringify({ seatTop: top(-0.36, -0.14, 0.08), tankTop: top(0, 0.2, 0.08), grip: [+(gx / n).toFixed(3), +(gy / n).toFixed(3), +(gz / n).toFixed(3)], noseZ: +zmax.toFixed(3), tailZ: +zmin.toFixed(3), headTop: top(0.42, 0.62, 0.1), tailTop: top(zmin, zmin + 0.12, 0.2) })); }
// 4. lighter meshes: the player's copy keeps nearly everything, rivals get a quarter
await MeshoptSimplifier.ready; await doc.transform(weld());
simplifyPrimitive(body, { simplifier: MeshoptSimplifier, ratio: 0.8, error: 0.0015 }); simplifyPrimitive(lod, { simplifier: MeshoptSimplifier, ratio: 0.22, error: 0.012 });
for (const w of [wF, wR]) simplifyPrimitive(w, { simplifier: MeshoptSimplifier, ratio: 0.55, error: 0.002 });
for (const m of root.listMeshes()) console.log('mesh', m.getName(), m.listPrimitives()[0].getIndices().getCount() / 3, 'tris');
// 5. textures to WebP, geometry quantised and meshopt-compressed
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColorTexture$/, quality: 88 }), textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^emissiveTexture$/, resize: [512, 512], quality: 80 }),
  dedup(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
for (const t of root.listTextures()) console.log('tex', t.getMimeType(), t.getSize(), (t.getImage().byteLength / 1024).toFixed(0) + ' KB');
await io.write(out, doc); console.log('written', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
