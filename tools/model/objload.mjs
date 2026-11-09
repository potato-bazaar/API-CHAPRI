// Minimal OBJ reader for the Character Creator export (3ds Max): objects keep their own vertex ranges.
// Converts Max units (decimetres, Z up, facing -Y) to the game rig's space (metres, Y up, facing +Z, +X = the rider's left).
import fs from 'fs';
import zlib from 'zlib';
export function readObj(file) {
  const V = [], VT = [], VN = [], objs = []; let cur = null;
  const raw = fs.readFileSync(file), text = (file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('latin1');   // .obj or .obj.gz
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue; const c = line.charCodeAt(0);
    if (c === 118) { const p = line.trim().split(/\s+/);   // v vt vn
      if (p[0] === 'v') V.push(+p[1] * 0.1, +p[3] * 0.1, -p[2] * 0.1);
      else if (p[0] === 'vt') VT.push(+p[1], +p[2]);
      else if (p[0] === 'vn') VN.push(+p[1], +p[3], -p[2]); }
    else if (c === 111) { cur = { name: line.slice(2).trim(), faces: [] }; objs.push(cur); }   // o
    else if (c === 102) { const p = line.trim().split(/\s+/).slice(1).map(s => s.split('/').map(x => x ? +x - 1 : -1)); cur.faces.push(p); }   // f v/vt/vn ...
  }
  return { V: new Float32Array(V), VT: new Float32Array(VT), VN: new Float32Array(VN), objs };
}
