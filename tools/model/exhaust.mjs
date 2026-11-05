import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(new URL('../../assets/rx100.glb', import.meta.url).pathname); await doc.transform(dequantize());
const root = doc.getRoot().listNodes().find(n => n.getName() === 'body'); const pts = [];
const walk = (node) => { if (node.getMesh()) for (const prim of node.getMesh().listPrimitives()) { const P = prim.getAttribute('POSITION').getArray(); const m = node.getWorldMatrix(); for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; pts.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]); } } node.listChildren().forEach(walk); };
walk(root); console.log('prims pts', pts.length, root.getMesh() && root.getMesh().listPrimitives().length, root.listChildren().length);
const box = (f) => { const s = pts.filter(f); if (!s.length) return null; const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of s) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p[a]); mx[a] = Math.max(mx[a], p[a]); } return { n: s.length, min: mn.map(v => +v.toFixed(3)), max: mx.map(v => +v.toFixed(3)) }; };
for (const sx of [1, -1]) { console.log('side', sx);
  for (let z = -1.0; z <= 0.4; z += 0.05) { const b = box(p => sx * p[0] > 0.1 && p[1] < 0.45 && Math.abs(p[2] - z) < 0.05); console.log(' z', z.toFixed(1), b && JSON.stringify([b.n, b.min, b.max])); } }
console.log('overall', JSON.stringify(box(() => true)));
