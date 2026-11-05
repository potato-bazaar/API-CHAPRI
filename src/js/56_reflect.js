// ───────────────────────── WET ROAD REFLECTIONS ─────────────────────────
// A planar mirror at the player's road height, rendered at reduced resolution into a linear HDR target. The road,
// pavement, markings and puddle shaders sample it through the mirror camera's projection, smear it along the screen
// vertical like wet asphalt does, and ripple it with raindrop rings. Strength follows wetness and the Fresnel angle.
const REFL = {
  U: { tRefl: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uWet: { value: 0 }, uReflOn: { value: 0 }, uRTime: { value: 0 }, uRTexel: { value: new THREE.Vector2(1 / 512, 1 / 256) } },
  // k: how mirror-like this surface gets; puddly: 1 = the whole patch is standing water
  patch(mat, k, puddly = 0) {
    const U = this.U, prev = mat.onBeforeCompile, uk = { value: k }, up = { value: puddly }; mat.userData.reflK = uk;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      Object.assign(sh.uniforms, { tRefl: U.tRefl, uReflMat: U.uReflMat, uWet: U.uWet, uReflOn: U.uReflOn, uRTime: U.uRTime, uRTexel: U.uRTexel, uReflK: uk, uPuddly: up });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uReflMat; varying vec4 vRefl; varying vec3 vRW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 rwp = modelMatrix * vec4(transformed, 1.0); vRW = rwp.xyz; vRefl = uReflMat * rwp; }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tRefl; uniform float uWet, uReflOn, uRTime, uReflK, uPuddly; uniform vec2 uRTexel; varying vec4 vRefl; varying vec3 vRW;
float rHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rHash(i), rHash(i + vec2(1.0, 0.0)), f.x), mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), f.x), f.y); }
// raindrop rings: one drop per cell, an expanding ring that fades out; returns (normal tilt xy, ring brightness)
vec3 rRipple(vec2 p, float t){ vec3 acc = vec3(0.0);
  for (int k = 0; k < 2; k++) { vec2 q = p * (k == 0 ? 1.6 : 2.7) + float(k) * 7.31; vec2 c = floor(q); vec2 f = fract(q) - 0.5; float h = rHash(c);
    vec2 d = f - (vec2(rHash(c + 3.1), rHash(c + 5.7)) - 0.5) * 0.5; float ph = fract(t * (0.8 + h * 0.7) + h * 7.0); float r = ph * 0.42; float L = length(d);
    float band = smoothstep(0.06, 0.0, abs(L - r)) * (1.0 - ph) * (1.0 - ph); acc += vec3(d / max(L, 1e-3) * sin((L - r) * 60.0) * band, band); }
  return acc; }`)
        .replace('#include <opaque_fragment>', `if (uReflOn > 0.5) {
  vec3 Vw = normalize(cameraPosition - vRW); float ndv = clamp(abs(Vw.y), 0.0, 1.0); float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  float pud = max(uPuddly, smoothstep(0.5, 0.72, rNoise(vRW.xz * 0.16) * 0.75 + rNoise(vRW.xz * 0.8) * 0.25));
  vec3 rip = uWet > 0.01 ? rRipple(vRW.xz, uRTime) * uWet : vec3(0.0);
  vec2 jit = (vec2(rNoise(vRW.xz * 2.3), rNoise(vRW.zx * 2.3 + 4.0)) - 0.5) * mix(0.016, 0.003, pud);
  vec2 uv = vRefl.xy / vRefl.w + rip.xy * 0.02 + jit;
  float sp = mix(3.0, 1.1, pud) * (1.0 + (1.0 - uWet) * 1.5); vec2 st = vec2(0.0, uRTexel.y * sp);
  vec3 rc = texture2D(tRefl, uv).rgb * 0.28 + (texture2D(tRefl, uv + st * 2.0).rgb + texture2D(tRefl, uv - st * 2.0).rgb) * 0.2 + (texture2D(tRefl, uv + st * 5.0).rgb + texture2D(tRefl, uv - st * 5.0).rgb) * 0.16;
  float kd = 0.06 + 0.22 * fres, kw = mix(0.3, 0.9, pud) * (0.5 + 0.5 * fres);
  float k = clamp(uReflK * mix(kd, kw, uWet), 0.0, 0.95);
  outgoingLight = outgoingLight * (1.0 - k * 0.8) + rc * k + rip.z * uWet * 0.08 * (vec3(0.6, 0.65, 0.75) + rc);
}
#include <opaque_fragment>`);
    };
    const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
    mat.customProgramCacheKey = () => key() + '|refl'; mat.needsUpdate = true;
  },
};
class WetReflect {
  constructor(renderer, scale) {
    this.r = renderer; this.scale = scale; this.h = 0; this.ok = !!renderer.capabilities.isWebGL2;
    if (!this.ok) return;
    this.rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: true }); this.rt.texture.generateMipmaps = false;
    REFL.U.tRefl.value = this.rt.texture; this.cam = new THREE.PerspectiveCamera();
    this.blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); this.blank.needsUpdate = true;
    this._n = new THREE.Vector3(0, 1, 0); this._p = new THREE.Vector3(); this._c = new THREE.Vector3(); this._v = new THREE.Vector3(); this._t = new THREE.Vector3(); this._la = new THREE.Vector3();
    this._rm = new THREE.Matrix4(); this._pl = new THREE.Plane(); this._cp = new THREE.Vector4(); this._q = new THREE.Vector4(); this.resize();
  }
  resize() { if (!this.ok) return; const sz = this.r.getDrawingBufferSize(new THREE.Vector2()); const w = Math.max(64, Math.round(sz.x * this.scale)), h = Math.max(36, Math.round(sz.y * this.scale)); this.rt.setSize(w, h); REFL.U.uRTexel.value.set(1 / w, 1 / h); }
  // mirror `camera` in the horizontal plane y = h and render the scene (minus `hide`) into the target
  render(scene, camera, h, hide) {
    if (!this.ok) return; const r = this.r, cam = this.cam, n = this._n;
    camera.updateMatrixWorld(); this._c.setFromMatrixPosition(camera.matrixWorld); if (this._c.y < h + 0.05) { REFL.U.uReflOn.value = 0; return; }
    this._p.set(this._c.x, h, this._c.z);
    this._v.subVectors(this._p, this._c).reflect(n).negate().add(this._p);                  // mirrored eye
    this._rm.extractRotation(camera.matrixWorld); this._la.set(0, 0, -1).applyMatrix4(this._rm).add(this._c);
    this._t.subVectors(this._p, this._la).reflect(n).negate().add(this._p);                  // mirrored look target
    cam.position.copy(this._v); cam.up.set(0, 1, 0).applyMatrix4(this._rm).reflect(n); cam.lookAt(this._t);
    cam.near = camera.near; cam.far = Math.min(camera.far, 320); cam.fov = camera.fov; cam.aspect = camera.aspect; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    REFL.U.uReflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // oblique near plane = the mirror plane, so nothing below the road leaks into the reflection
    this._pl.setFromNormalAndCoplanarPoint(n, this._p).applyMatrix4(cam.matrixWorldInverse);
    const P = cam.projectionMatrix.elements, cp = this._cp.set(this._pl.normal.x, this._pl.normal.y, this._pl.normal.z, this._pl.constant), q = this._q;
    q.x = (Math.sign(cp.x) + P[8]) / P[0]; q.y = (Math.sign(cp.y) + P[9]) / P[5]; q.z = -1; q.w = (1 + P[10]) / P[14];
    cp.multiplyScalar(2 / cp.dot(q)); P[2] = cp.x; P[6] = cp.y; P[10] = cp.z + 1; P[14] = cp.w; cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const vis = hide.map(o => o && o.visible); hide.forEach(o => { if (o) o.visible = false; });
    const su = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false; REFL.U.uReflOn.value = 0; REFL.U.tRefl.value = this.blank;   // never sample the target being drawn
    const prevRT = r.getRenderTarget(); r.setRenderTarget(this.rt); r.clear(); r.render(scene, cam); r.setRenderTarget(prevRT);
    r.shadowMap.autoUpdate = su; REFL.U.tRefl.value = this.rt.texture; hide.forEach((o, i) => { if (o) o.visible = vis[i]; }); REFL.U.uReflOn.value = 1;
  }
  dispose() { if (this.ok) { this.rt.dispose(); this.blank.dispose(); } REFL.U.uReflOn.value = 0; }
}
