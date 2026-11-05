// Prepare the RX100 GLB for the game: rebadge, bake to bike space (+z forward, wheelbase 1.30 m),
// split front/rear wheels so they can spin, add a light LOD body for rivals, compress textures and geometry.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, weld, simplifyPrimitive, transformMesh, quantize, textureCompress, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import { components } from './components.mjs';
const [src, badge, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src); const root = doc.getRoot(); const buffer = root.listBuffers()[0];
// 1. new base colour with CHAPRI / CR100 badges; plain PBR (drop KHR_materials_specular)
const body = root.listMaterials().find(m => m.getName() === 'lambert1'); const tyreMat = root.listMaterials().find(m => m.getName() === 'Tyer1');
body.getBaseColorTexture().setImage(fs.readFileSync(badge)).setMimeType('image/png');
for (const m of root.listMaterials()) { for (const e of m.listExtensions()) m.setExtension(e.extensionName, null); m.setDoubleSided(false); }
for (const e of root.listExtensionsUsed()) if (e.extensionName === 'KHR_materials_specular') e.dispose();
// 2. bake every mesh into world space, drop unused vertex data
const meshNodes = root.listNodes().filter(n => n.getMesh());
for (const n of meshNodes) { transformMesh(n.getMesh(), n.getWorldMatrix()); }
for (const p of root.listMeshes().flatMap(m => m.listPrimitives())) for (const s of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(s)) p.setAttribute(s, null);
const meshByName = (n) => meshNodes.find(x => x.getMesh().getName() === n || x.getName() === n).getMesh();
const bodyMesh = meshNodes.find(n => n.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount() > 20000).getMesh();
const rimMesh = meshNodes.find(n => n.getMesh().listPrimitives()[0].getMaterial() === body && n.getMesh() !== bodyMesh).getMesh();
const tyreMesh = meshNodes.find(n => n.getMesh().listPrimitives()[0].getMaterial() === tyreMat).getMesh();
// 3. measure the tyres to find both axles, then fit the bike: wheelbase 1.30 m, rear axle at z = -0.64
const tp = tyreMesh.listPrimitives()[0].getAttribute('POSITION').getArray();
const half = (front) => { let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < tp.length; i += 3) { if ((tp[i + 2] > 0) !== front) continue; y0 = Math.min(y0, tp[i + 1]); y1 = Math.max(y1, tp[i + 1]); z0 = Math.min(z0, tp[i + 2]); z1 = Math.max(z1, tp[i + 2]); } return { y: (y0 + y1) / 2, z: (z0 + z1) / 2, r: (y1 - y0) / 2 }; };
const F = half(true), R = half(false); const k = 1.30 / (F.z - R.z); const tz = -0.64 - R.z * k;
console.log('axles raw', F, R, 'scale', k.toFixed(4), 'tz', tz.toFixed(4), 'wheel r', (F.r * k).toFixed(3));
const fit = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, tz, 1];
for (const m of [bodyMesh, rimMesh, tyreMesh]) transformMesh(m, fit);
const axF = { y: F.y * k, z: F.z * k + tz }, axR = { y: R.y * k, z: R.z * k + tz };
// 3b. fold away the centre stand: drop its legs, feet and crossbar (small pieces hanging below the frame)
{ const pr = bodyMesh.listPrimitives()[0]; const idx = pr.getIndices().getArray(); const drop = new Set();
  for (const c of components(pr.getAttribute('POSITION').getArray(), idx))
    if (c.tris.length <= 30 && c.max[1] < 0.32 && c.min[1] < 0.26 && Math.max(Math.abs(c.min[0]), Math.abs(c.max[0])) < 0.12 && c.min[2] > -0.16 && c.max[2] < 0.01) c.tris.forEach(t => drop.add(t));
  const keep = []; for (let t = 0; t < idx.length / 3; t++) if (!drop.has(t)) keep.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  pr.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)).setBuffer(buffer)); console.log('centre stand: dropped', drop.size, 'tris'); }
// 4. split rims + tyres into front / rear wheel meshes centred on their axles
function subPrim(prim, keepTri, center) {
  const idx = prim.getIndices().getArray(); const map = new Map(); const tris = [];
  const P = prim.getAttribute('POSITION').getArray();
  for (let t = 0; t < idx.length; t += 3) { const cz = (P[idx[t] * 3 + 2] + P[idx[t + 1] * 3 + 2] + P[idx[t + 2] * 3 + 2]) / 3; if (!keepTri(cz)) continue; for (let j = 0; j < 3; j++) { const v = idx[t + j]; if (!map.has(v)) map.set(v, map.size); tris.push(map.get(v)); } }
  const np = doc.createPrimitive().setMaterial(prim.getMaterial()).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(tris)).setBuffer(buffer));
  for (const s of prim.listSemantics()) { const a = prim.getAttribute(s); const n = a.getElementSize(); const srcA = a.getArray(); const arr = new Float32Array(map.size * n);
    for (const [o, nn] of map) for (let c = 0; c < n; c++) arr[nn * n + c] = srcA[o * n + c];
    if (s === 'POSITION') for (let i = 0; i < map.size; i++) { arr[i * 3 + 1] -= center.y; arr[i * 3 + 2] -= center.z; }
    np.setAttribute(s, doc.createAccessor().setType(a.getType()).setArray(arr).setBuffer(buffer)); }
  return np;
}
const scene = root.getDefaultScene() || root.listScenes()[0];
for (const n of root.listNodes()) n.dispose();
const zMid = (axF.z + axR.z) / 2;
const mk = (name, mesh, t = [0, 0, 0]) => { const n = doc.createNode(name).setMesh(mesh).setTranslation(t); scene.addChild(n); return n; };
mk('body', bodyMesh.setName('body'));
for (const [nm, ax, keep] of [['wheelF', axF, (z) => z > zMid], ['wheelR', axR, (z) => z <= zMid]]) {
  const m = doc.createMesh(nm); for (const src2 of [rimMesh, tyreMesh]) m.addPrimitive(subPrim(src2.listPrimitives()[0], keep, ax)); mk(nm, m, [0, ax.y, ax.z]);
}
rimMesh.dispose(); tyreMesh.dispose();
// 5. light LOD body for the seven rivals
await MeshoptSimplifier.ready;
const lodMesh = doc.createMesh('body_lod'); const lp = bodyMesh.listPrimitives()[0].clone(); lodMesh.addPrimitive(lp);
await doc.transform(weld());
simplifyPrimitive(lp, { simplifier: MeshoptSimplifier, ratio: 0.12, error: 0.012 });
{ // simplification can cut the thin mirror stalks; drop any mirror heads left floating
  const idx = lp.getIndices().getArray(); const drop = new Set();
  for (const c of components(lp.getAttribute('POSITION').getArray(), idx)) if (c.min[1] > 1.07 && c.tris.length < 300) c.tris.forEach(t => drop.add(t));
  const keep = []; for (let t = 0; t < idx.length / 3; t++) if (!drop.has(t)) keep.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  lp.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)).setBuffer(buffer)); console.log('lod: dropped floating bits', drop.size, 'tris'); }
mk('body_lod', lodMesh);
const tri = (m) => m.listPrimitives().reduce((a, p) => a + p.getIndices().getCount() / 3, 0);
for (const m of root.listMeshes()) console.log('mesh', m.getName(), Math.round(tri(m)), 'tris');
// 6. textures → WebP: base colour 1024, normal + ORM 512, tyre 256; then quantize geometry
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(normalTexture|occlusionTexture|metallicRoughnessTexture)$/, resize: [512, 512], quality: 82 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColorTexture$/, quality: 86 }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), dedup(), prune(),
);
for (const t of root.listTextures()) console.log('tex', t.getMimeType(), t.getSize(), (t.getImage().byteLength / 1024).toFixed(0) + ' KB');
console.log('axles', JSON.stringify({ front: axF, rear: axR, r: +(F.r * k).toFixed(3) }));
await io.write(out, doc);
console.log('written', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
