// prints the built cyber bike's profile in game units (top of the centreline, half width, widest low points) for fitting the rider
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]); const root = doc.getRoot();
for (const n of root.listNodes()) { const m = n.getMesh(); if (!m) continue; console.log(n.getName(), 'T', n.getTranslation().map(v => +v.toFixed(3)), 'S', n.getScale().map(v => +v.toFixed(3)), 'prims', m.listPrimitives().length);
  if (n.getName() !== 'body') continue; const W = n.getWorldMatrix();
  const top = {}, wide = {}, pegs = [];
  for (const p of m.listPrimitives()) { const A = p.getAttribute('POSITION'); const v = [0, 0, 0];
    for (let i = 0; i < A.getCount(); i++) { A.getElement(i, v); const x = W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], y = W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13], z = W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14];
      const k = (Math.round(z * 10) / 10).toFixed(1); if (Math.abs(x) < 0.06) top[k] = Math.max(top[k] ?? 0, y); wide[k] = Math.max(wide[k] ?? 0, Math.abs(x));
      if (y < 0.5 && Math.abs(x) > 0.17) pegs.push([x, y, z].map(q => +q.toFixed(2)).join(',')); } }
  console.log(Object.keys(wide).map(Number).sort((a, b) => a - b).map(z => `z${z.toFixed(1)}: top ${(top[z.toFixed(1)] ?? 0).toFixed(2)} halfW ${wide[z.toFixed(1)].toFixed(2)}`).join('\n'));
  console.log('low+wide:', [...new Set(pegs)].slice(0, 60).join(' | '));
}
