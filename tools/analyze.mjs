import * as THREE from '../node_modules/three/build/three.module.js';
import fs from 'fs';
const src = fs.readFileSync(new URL('../src/js/10_tracks.js', import.meta.url), 'utf8');
const TRACKS = new Function(src + '; return TRACKS;')();
const out = {};
for (const t of TRACKS) {
  let raw = t.pts.map(p => new THREE.Vector3(p[0], 0, p[1]));
  let c = new THREE.CatmullRomCurve3(raw, true, 'centripetal'); c.arcLengthDivisions = 4000;
  const sc = t.target / c.getLength();
  raw = raw.map(p => p.clone().multiplyScalar(sc));
  c = new THREE.CatmullRomCurve3(raw, true, 'centripetal'); c.arcLengthDivisions = 4000;
  const L = c.getLength(); const N = Math.round(L / 1);
  const P = [], yaw = [];
  for (let i = 0; i < N; i++) { const p = c.getPointAt(i / N); const tg = c.getTangentAt(i / N); P.push([p.x, p.z]); yaw.push(Math.atan2(tg.x, tg.z)); }
  const kap = []; for (let i = 0; i < N; i++) { let dy = yaw[(i + 1) % N] - yaw[(i - 1 + N) % N]; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; kap.push(dy / 2); }
  // smooth
  const ks = kap.map((_, i) => { let s = 0; for (let j = -3; j <= 3; j++) s += kap[(i + j + N) % N]; return s / 7; });
  let minR = 1e9, at = 0; ks.forEach((k, i) => { const r = 1 / Math.max(1e-6, Math.abs(k)); if (r < minR) { minR = r; at = i / N; } });
  // self-intersection proximity: min distance between samples > 40m apart along track
  let minGap = 1e9, gapAt = null;
  for (let i = 0; i < N; i += 2) for (let j = i + 60; j < N; j += 2) { if (N - (j - i) < 60) continue; const dx = P[i][0] - P[j][0], dz = P[i][1] - P[j][1]; const d = Math.hypot(dx, dz); if (d < minGap) { minGap = d; gapAt = [i / N, j / N]; } }
  // turning total
  const total = ks.reduce((a, b) => a + b, 0);
  out[t.id] = { L: L.toFixed(0), scale: sc.toFixed(2), minR: minR.toFixed(1), minRat: at.toFixed(3), minGap: minGap.toFixed(1), gapAt: gapAt.map(v => v.toFixed(3)), turn: (total * 180 / Math.PI).toFixed(0), P };
}
for (const k in out) { const o = { ...out[k] }; delete o.P; console.log(k, JSON.stringify(o)); }
fs.writeFileSync('tools/tracks.json', JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.P]))));
