// Head/scalp/face extents of the base body in bind pose (for hair, beard and accessory placement)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]); const root = doc.getRoot();
const skin = root.listSkins()[0]; const J = skin.listJoints(); const JN = J.map(j => j.getName());
const jp = (n) => { const w = J[JN.indexOf(n)].getWorldMatrix(); return [w[12], w[13], w[14]].map(v => +v.toFixed(4)); };
console.log('Head', jp('Head'), 'neck', jp('neck_01'), 'spine_03', jp('spine_03'), 'clav_l', jp('clavicle_l'), 'upperarm_l', jp('upperarm_l'), 'hand_l', jp('hand_l'), 'lowerarm_l', jp('lowerarm_l'));
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  const P = p.getAttribute('POSITION'), JA = p.getAttribute('JOINTS_0'), WA = p.getAttribute('WEIGHTS_0'); if (!JA) continue; const n = P.getCount(); const v = [0, 0, 0], j = [0, 0, 0, 0], w = [0, 0, 0, 0];
  const pts = []; for (let i = 0; i < n; i++) { P.getElement(i, v); JA.getElement(i, j); WA.getElement(i, w); let best = -1, bj = 0; for (let q = 0; q < 4; q++) if (w[q] > best) { best = w[q]; bj = j[q]; } if (JN[bj] === 'Head') pts.push(v.slice()); }
  if (!pts.length) continue; const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const q of pts) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], q[a]); mx[a] = Math.max(mx[a], q[a]); }
  console.log(m.getName(), 'head verts', pts.length, 'min', mn.map(x => x.toFixed(3)), 'max', mx.map(x => x.toFixed(3)));
  if (pts.length > 1000) { for (let y = mn[1]; y <= mx[1] + 1e-6; y += 0.02) { const sl = pts.filter(q => Math.abs(q[1] - y) < 0.01); if (!sl.length) continue; const fz = Math.max(...sl.map(q => q[2])), bz = Math.min(...sl.map(q => q[2])), sx = Math.max(...sl.map(q => Math.abs(q[0])));
    const front = sl.filter(q => Math.abs(q[0]) < 0.015); console.log(' y', y.toFixed(2), 'z', bz.toFixed(3), '..', fz.toFixed(3), ' |x|', sx.toFixed(3), ' centre-front z', front.length ? Math.max(...front.map(q => q[2])).toFixed(3) : '-'); } }
}
