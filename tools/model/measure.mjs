import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]); await doc.transform(dequantize());
const node = doc.getRoot().listNodes().find(n => n.getName() === 'body'); const P = node.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray();
const m = node.getWorldMatrix(); const pts = []; for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; pts.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]); }
const box = (f) => { const s = pts.filter(f); if (!s.length) return null; const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of s) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p[a]); mx[a] = Math.max(mx[a], p[a]); } return { n: s.length, min: mn.map(v => +v.toFixed(3)), max: mx.map(v => +v.toFixed(3)) }; };
for (let z = -0.9; z <= 0.8; z += 0.1) { const b = box(p => Math.abs(p[0]) < 0.06 && Math.abs(p[2] - z) < 0.05); console.log('z', z.toFixed(1), 'top y', b && b.max[1], 'bot y', b && b.min[1]); }
console.log('gripL x>0.3,y>0.8', JSON.stringify(box(p => p[0] > 0.3 && p[1] > 0.8 && p[1] < 1.15)));
console.log('gripR x<-0.3,y>0.8', JSON.stringify(box(p => p[0] < -0.3 && p[1] > 0.8 && p[1] < 1.15)));
console.log('front z>0.6 y>0.7', JSON.stringify(box(p => p[2] > 0.6 && p[1] > 0.7)));
console.log('rear z<-0.85 y>0.6', JSON.stringify(box(p => p[2] < -0.85 && p[1] > 0.6)));
console.log('mirror y>1.1', JSON.stringify(box(p => p[1] > 1.1)));
console.log('head z>0.5 |x|<0.15 y.75-1.05', JSON.stringify(box(p => p[2] > 0.5 && Math.abs(p[0]) < 0.15 && p[1] > 0.75 && p[1] < 1.05)));
for (const yy of [0.8, 0.85, 0.9, 0.95, 1.0]) console.log(' head slice y', yy, JSON.stringify(box(p => p[2] > 0.45 && Math.abs(p[0]) < 0.15 && Math.abs(p[1] - yy) < 0.025)));
console.log('grips', JSON.stringify(box(p => p[0] > 0.25 && p[1] > 1.0 && p[1] < 1.12 && p[2] > 0.15 && p[2] < 0.42)), JSON.stringify(box(p => p[0] < -0.25 && p[1] > 1.0 && p[1] < 1.12 && p[2] > 0.15 && p[2] < 0.42)));
for (const yy of [0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) console.log(' tail slice y', yy, JSON.stringify(box(p => p[2] < -0.8 && Math.abs(p[0]) < 0.1 && Math.abs(p[1] - yy) < 0.025)));
console.log('pegs', JSON.stringify(box(p => p[0] > 0.12 && p[1] > 0.25 && p[1] < 0.34 && p[2] > -0.12 && p[2] < -0.02)));
console.log('tank width', JSON.stringify(box(p => p[2] > 0.0 && p[2] < 0.2 && p[1] > 0.72 && p[1] < 0.9)));
console.log('seat width', JSON.stringify(box(p => p[2] > -0.45 && p[2] < -0.2 && p[1] > 0.75)));
{ const pr = node.getMesh().listPrimitives()[0]; const UV = pr.getAttribute('TEXCOORD_0').getArray(); const N = pr.getAttribute('NORMAL').getArray();
  const uvBox = (x0, y0, x1, y1) => { const sel = []; for (let i = 0; i < UV.length / 2; i++) { const u = UV[i * 2] * 1024, v = UV[i * 2 + 1] * 1024; if (u >= x0 && u <= x1 && v >= y0 && v <= y1) sel.push(i); } if (!sel.length) return null;
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], nn = [0, 0, 0]; for (const i of sel) { const p = pts[i]; for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], p[a]); mx[a] = Math.max(mx[a], p[a]); nn[a] += N[i * 3 + a]; } }
    return { n: sel.length, min: mn.map(v => +v.toFixed(3)), max: mx.map(v => +v.toFixed(3)), nrm: nn.map(v => +(v / sel.length).toFixed(2)) }; };
  console.log('rxA uv', JSON.stringify(uvBox(476, 532, 498, 606))); console.log('rxB uv', JSON.stringify(uvBox(166, 532, 187, 606)));
  console.log('tankL uv', JSON.stringify(uvBox(80, 280, 106, 340))); console.log('panel big', JSON.stringify(uvBox(447, 512, 549, 630))); console.log('panel big2', JSON.stringify(uvBox(137, 507, 205, 627))); }
