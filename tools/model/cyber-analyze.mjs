import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { transformMesh } from '@gltf-transform/functions';
import { components } from './components.mjs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS); const doc = await io.read(process.argv[2]); const root = doc.getRoot();
for (const n of root.listNodes().filter(n => n.getMesh())) { transformMesh(n.getMesh(), n.getWorldMatrix()); }
for (const m of root.listMeshes()) { const pr = m.listPrimitives()[0], P = pr.getAttribute('POSITION').getArray(), idx = pr.getIndices().getArray(); let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], P[i + a]); mx[a] = Math.max(mx[a], P[i + a]); }
  console.log(m.getName(), pr.getMaterial().getName(), 'bbox', mn.map(v => v.toFixed(3)), mx.map(v => v.toFixed(3)));
  const C = components(P, idx).sort((a, b) => b.tris.length - a.tris.length); console.log(' comps', C.length);
  for (const c of C.slice(0, 22)) console.log('  ', String(c.tris.length).padStart(6), c.min.map(v => v.toFixed(3)).join(' '), '|', c.max.map(v => v.toFixed(3)).join(' ')); }
for (const mt of root.listMaterials()) console.log('mat', mt.getName(), mt.getBaseColorFactor(), mt.getEmissiveFactor(), mt.getRoughnessFactor(), mt.getMetallicFactor(), mt.listExtensions().map(e => e.extensionName));
for (const t of root.listTextures()) console.log('tex', t.getName(), t.getMimeType(), t.getSize(), (t.getImage().byteLength / 1024 | 0) + 'KB');
