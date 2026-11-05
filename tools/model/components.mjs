// Connected pieces of a triangle mesh, joined by shared positions (UV seams split vertices, so weld by position).
export function components(P, idx) {
  const key = (v) => `${Math.round(P[v * 3] * 2e4)},${Math.round(P[v * 3 + 1] * 2e4)},${Math.round(P[v * 3 + 2] * 2e4)}`;
  const canon = new Map(); const nv = P.length / 3; const par = new Int32Array(nv);
  for (let v = 0; v < nv; v++) { const k = key(v); if (!canon.has(k)) canon.set(k, v); par[v] = canon.get(k); }
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); par[b] = a; par[find(c)] = a; }
  const comps = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(idx[t]); let c = comps.get(r); if (!c) comps.set(r, (c = { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }));
    c.tris.push(t / 3); for (let j = 0; j < 3; j++) { const v = idx[t + j]; for (let a = 0; a < 3; a++) { c.min[a] = Math.min(c.min[a], P[v * 3 + a]); c.max[a] = Math.max(c.max[a], P[v * 3 + a]); } }
  }
  return [...comps.values()];
}
