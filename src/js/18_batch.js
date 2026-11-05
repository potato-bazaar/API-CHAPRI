// ───────────────────────── GEOMETRY BATCHING ─────────────────────────
// Static scenery is merged into a handful of meshes (one per material) to keep draw calls low.
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3(), _c = new THREE.Color();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _mat = new THREE.Matrix4();

class Batch {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  // Append a THREE geometry transformed by matrix, tinted with color, optional uv mapper (u,v)->[u,v]
  add(geom, matrix, color, uvMap) {
    const p = geom.attributes.position, nr = geom.attributes.normal, uv = geom.attributes.uv;
    _m3.getNormalMatrix(matrix); const c = color instanceof THREE.Color ? color : _c.set(color);
    const base = this.n;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix); this.pos.push(_v.x, _v.y, _v.z);
      if (nr) { _n.fromBufferAttribute(nr, i).applyMatrix3(_m3).normalize(); this.nor.push(_n.x, _n.y, _n.z); } else this.nor.push(0, 1, 0);
      if (uv) { let u = uv.getX(i), w = uv.getY(i); if (uvMap) [u, w] = uvMap(u, w, i); this.uv.push(u, w); } else this.uv.push(0.001, 0.999);
      this.col.push(c.r, c.g, c.b);
    }
    if (geom.index) { const ix = geom.index.array; for (let i = 0; i < ix.length; i++) this.idx.push(base + ix[i]); }
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    this.n += p.count;
  }
  vert(x, y, z, nx, ny, nz, u, v, c) { this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v); this.col.push(c.r, c.g, c.b); return this.n++; }
  // Quad a,b,c,d (Vector3s) in perimeter order; flipped if its normal disagrees with `out`
  quad(a, b, c, d, color, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]], out = null) {
    const cl = color instanceof THREE.Color ? color : new THREE.Color(color);
    _a.subVectors(b, a); _b.subVectors(d, a); _n.crossVectors(_a, _b).normalize();
    let flip = false; if (out && _n.dot(out) < 0) { flip = true; _n.negate(); }
    const nx = _n.x, ny = _n.y, nz = _n.z;
    const i0 = this.vert(a.x, a.y, a.z, nx, ny, nz, uvs[0][0], uvs[0][1], cl), i1 = this.vert(b.x, b.y, b.z, nx, ny, nz, uvs[1][0], uvs[1][1], cl);
    const i2 = this.vert(c.x, c.y, c.z, nx, ny, nz, uvs[2][0], uvs[2][1], cl), i3 = this.vert(d.x, d.y, d.z, nx, ny, nz, uvs[3][0], uvs[3][1], cl);
    if (!flip) this.idx.push(i0, i1, i2, i0, i2, i3); else this.idx.push(i0, i2, i1, i0, i3, i2);
  }
  // Oriented box: centre (x,y,z) is the BOTTOM centre; size w (local x), h, l (local z); yaw about Y
  box(x, y, z, w, h, l, yaw, color, uvMap) { _mat.compose(_s.set(x, y + h / 2, z), _q.setFromAxisAngle(UP, yaw), _v.set(w, h, l)); this.add(UNIT_BOX, _mat, color, uvMap); }
  geom(g, x, y, z, yaw, sx, sy, sz, color, pitch = 0, roll = 0) {
    const e = new THREE.Euler(pitch, yaw, roll, 'YXZ'); _mat.compose(_s.set(x, y, z), _q.setFromEuler(e), _v.set(sx, sy, sz)); this.add(g, _mat, color);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  mesh(material, { cast = false, receive = false } = {}) { if (!this.n) return null; const m = new THREE.Mesh(this.build(), material); m.castShadow = cast; m.receiveShadow = receive; m.matrixAutoUpdate = false; m.updateMatrix(); return m; }
}
const UP = new THREE.Vector3(0, 1, 0);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
