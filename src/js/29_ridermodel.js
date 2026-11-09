// ───────────────────────── RIDER MODEL ─────────────────────────
// Base body + hair: Quaternius "Universal Base Characters" (CC0, quaternius.com). Slimmed into a skinny street kid,
// painted with an open-collar shirt, jeans, belt and sneakers (tools/model/build-rider.mjs).
// One skinned mesh per rider, posed every frame: spine lean, head look, two-bone IK for arms → grips and legs → pegs.
const RIDER_MODEL = { ready: false, scene: null, mats: new Map(), hairMats: new Map() };
const RIDER_FIT = { scale: 0.95, pelvis: [0, 0.955, -0.25], baseLean: 0.42, wrist: [0, 0.03, -0.075], ankle: [0.19, 0.4, -0.18] };
const HAIR_DYES = ['#c8641e', '#1a120d', '#e0b030', '#b0263a', '#2a2a2a', '#d9d4c8', '#7b2cbf', '#1a120d'];

async function loadRiderModel() {
  try {
    const gltf = await new ADDONS.GLTFLoader().parseAsync(await decodeEmbedded('riderglb'), '');
    const sc = gltf.scene; const meshes = {}; sc.traverse(o => { if (o.isSkinnedMesh) meshes[o.name] = o; });
    for (const n of ['body', 'body_lod', 'Eyes', 'Eyebrows', 'hair_quiff', 'hair_long', 'hair_buzz', 'hair_pomp', 'beard', 'shirt', 'shirt_lod']) if (!meshes[n]) throw new Error('missing ' + n);
    const bm = meshes.body.material; RIDER_MODEL.base = bm.map; RIDER_MODEL.mask = bm.aoMap; RIDER_MODEL.hairTex = meshes.hair_quiff.material.map;
    RIDER_MODEL.eyesMat = meshes.Eyes.material; RIDER_MODEL.scene = sc; RIDER_MODEL.ready = true;
    // the meshes are quantised (positions stored as -1..1, the real size baked into the inverse bind matrices): keep the
    // dequantisation per mesh so the shaders can work in real bind-pose metres, the space the texture was painted in
    sc.updateMatrixWorld(true); RIDER_MODEL.deq = {};
    for (const [n, m] of Object.entries(meshes)) { const sk = m.skeleton, D = sk.bones[0].matrixWorld.clone().multiply(sk.boneInverses[0]).multiply(m.bindMatrix).elements; RIDER_MODEL.deq[n] = new THREE.Vector4(D[0], D[12], D[13], D[14]); }
    try { // the skin tone a bare torso is painted with: averaged off the model's forearms
      const img = bm.map.image, cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 64, 64); const px = cx.getImageData(0, 0, 64, 64).data;
      const g = meshes.body.geometry, P = g.attributes.position, UV = g.attributes.uv, dq = RIDER_MODEL.deq.body; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < P.count; i += 3) { const x = Math.abs(P.getX(i) * dq.x + dq.y), y = P.getY(i) * dq.x + dq.z; if (x < 0.4 || x > 0.55 || y < 1.25) continue; const u = Math.floor(UV.getX(i) * 63), v = Math.floor(UV.getY(i) * 63), k = (v * 64 + u) * 4; r += px[k]; gg += px[k + 1]; b += px[k + 2]; n++; }
      if (n > 10) RIDER_MODEL.skin = '#' + new THREE.Color(r / n / 255, gg / n / 255, b / n / 255).getHexString(THREE.LinearSRGBColorSpace);
    } catch (e) { /* keep the default skin tone */ }
    return true;
  } catch (e) { console.warn('Rider model unavailable, using the built-in rider:', e && e.message); return false; }
}
// ── Dogesh: a second rider model on the same skeleton (tools/model/build-dogesh.mjs) ──
// Long hair, beard, wayfarers and gold hoops; saffron kurta, white churidar and an emerald brocade long jacket with gold zari.
const HEAD_SCALE = 1.1;
const DOGESH_MODEL = { ready: false, scene: null, mats: new Map() };
async function loadDogeshModel() {
  try {
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');   // his glb is meshopt-compressed
    const gltf = await new ADDONS.GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(await decodeEmbedded('dogeshglb'), '');
    const sc = gltf.scene, meshes = {}; sc.traverse(o => { if (o.isSkinnedMesh) meshes[o.name] = o; });
    for (const n of ['dg_body', 'dg_jacket', 'dg_hair', 'dg_beard', 'dg_glass', 'dg_ear']) if (!meshes[n]) throw new Error('missing ' + n);
    DOGESH_MODEL.headBone = meshes.dg_body.skeleton.bones.findIndex(b => b.name === 'Head');
    { const G = meshes.dg_glass.geometry; G.computeBoundingBox(); const b = G.boundingBox; DOGESH_MODEL.glassBox = [b.min.toArray(), b.max.clone().sub(b.min).toArray()]; }
    DOGESH_MODEL.atlas = meshes.dg_body.material.map; DOGESH_MODEL.scene = sc; DOGESH_MODEL.ready = true; return true;
  } catch (e) { console.warn('Dogesh model unavailable:', e && e.message); return false; }
}
// his kurta's cross-sections (bind space: y, half width, front z, back z) and the spheres that keep the jacket off it
const DOGESH_TORSO = [[0.93, 0.209, 0.116, -0.148], [1.0, 0.22, 0.139, -0.165], [1.1, 0.188, 0.145, -0.163], [1.2, 0.179, 0.134, -0.163], [1.3, 0.204, 0.131, -0.164], [1.4, 0.215, 0.105, -0.162], [1.45, 0.224, 0.082, -0.154]];
// two chains (one sitting back, one forward) make a deep torso: the back one stays ~4 cm proud of the kurta's back, where riding stretches it
const DOGESH_SPHERES = [[0, 1.0, -0.05, 0.16, 0], [0, 1.12, -0.05, 0.16, 1], [0, 1.24, -0.055, 0.162, 2], [0, 1.36, -0.06, 0.165, 3],
  [0, 1.0, 0.02, 0.15, 0], [0, 1.12, 0.025, 0.15, 1], [0, 1.24, 0.02, 0.145, 2], [0, 1.36, 0.0, 0.14, 3]];
// gold zari wherever the mesh says so (attribute _trim: hems, cuffs, the collar's edge, the jacket's front edges)
function zariHook(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float _trim; varying float vTrim;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTrim = _trim;');
    sh.fragmentShader = 'varying float vTrim;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  { float zr = 0.84 + 0.16 * sin(vMapUv.x * 95.0) * sin(vMapUv.y * 95.0); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.63, 0.18) * zr, vTrim); }')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0.85, vTrim);').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.3, vTrim);'); };
  m.customProgramCacheKey = () => 'zari-' + m.type; return m;
}
function dogeshMats(low) {
  const k = low ? 'l' : 's'; if (DOGESH_MODEL.mats.has(k)) return DOGESH_MODEL.mats.get(k);
  const env = BIKE_MODEL.env || null, S = (o, std) => low ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign(o, std));
  const M = {
    body: low ? new THREE.MeshLambertMaterial({ map: DOGESH_MODEL.atlas }) : new THREE.MeshStandardMaterial({ map: DOGESH_MODEL.atlas, roughness: 0.68, metalness: 0 }),
    jacket: zariHook(low ? new THREE.MeshLambertMaterial({ map: brocadeTexture(), side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map: brocadeTexture(), side: THREE.DoubleSide, roughness: 0.55, metalness: 0.08 })),
    beard: S({ color: '#241811', side: THREE.DoubleSide }, { roughness: 0.9 }),
    glass: low ? new THREE.MeshLambertMaterial({ color: '#070709', transparent: true }) : new THREE.MeshStandardMaterial({ color: '#060608', roughness: 0.12, metalness: 0.35, envMap: env, envMapIntensity: 1.4, transparent: true }),
  };
  // his face keeps a little of its own light too (the head is whatever is skinned to the Head bone)
  const hb = DOGESH_MODEL.headBone; M.body.onBeforeCompile = (sh) => { sh.vertexShader = 'varying float vHeadW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  vHeadW = dot(skinWeight, vec4(equal(skinIndex, vec4(${hb}.0))));`);
    sh.fragmentShader = 'varying float vHeadW;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.24 * smoothstep(0.5, 0.9, vHeadW);'); };
  M.body.customProgramCacheKey = () => 'dg-body-' + M.body.type;
  // wayfarers: black frames, smoked lenses you can see his eyes through (the lenses are two ovals on the front of the mesh)
  const gb = DOGESH_MODEL.glassBox; M.glass.onBeforeCompile = (sh) => { sh.vertexShader = 'varying vec3 vGN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  vGN = (position - vec3(${gb[0].map(v => v.toFixed(5)).join(', ')})) / vec3(${gb[1].map(v => v.toFixed(5)).join(', ')});`);
    sh.fragmentShader = 'varying vec3 vGN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec2 q = vec2((abs(vGN.x - 0.49) - 0.29) / 0.165, (vGN.y - 0.4) / 0.36); float lens = step(0.8, vGN.z) * smoothstep(1.0, 0.86, dot(q, q));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.1, 0.07), lens); diffuseColor.a = mix(1.0, 0.4 + 0.25 * vGN.y, lens); }`); };
  M.glass.customProgramCacheKey = () => 'dg-glass-' + M.glass.type;
  DOGESH_MODEL.mats.set(k, M); return M;
}
function dogeshHairMat(low, U) {
  const o = { map: longHairTexture(), color: new THREE.Color('#d8c8b8'), alphaTest: 0.45, side: THREE.DoubleSide };
  return flutterMat(low ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign(o, { roughness: 0.5, metalness: 0.05 })), U, low ? 'dghair-l' : 'dghair-s');
}
// the long open jacket's skirt: back to the knees, fronts to just above, pinned at the yoke and down the side seams to the waist
const dogeshJacketCloth = (low, M) => ({ torso: DOGESH_TORSO, spheres: DOGESH_SPHERES, legs: true, jacket: true, seatX: 0.16, mat: M.jacket,
  panels: (lod) => { const b = lod ? [5, 8] : [8, 13], f = lod ? [3, 7] : [5, 12];
    return [[b, -Math.PI / 2 - 1.25, -Math.PI / 2 + 1.25, 1.4, 0.5, [0, 1], 1.0], [f, -0.3, 1.25, 1.4, 0.56, [0], 1.0, f[0] - 1], [f, Math.PI + 0.3, Math.PI - 1.25, 1.4, 0.56, [0], 1.0, f[0] - 1]]; } });
// body: shirt pattern + jeans colour tinted into the painted grey (mask R = shirt, G = jeans)
// the face never goes black: a little of its own colour is always there, whatever the street lights are doing
const FACE_FILL = '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.2 * smoothstep(1.5, 1.57, vRB.y);';
const RIDER_HOOK = `#include <map_fragment>
  vec3 rM = texture2D(riderMask, vMapUv).rgb;
  float rG = sampledDiffuseColor.g / 0.2140;
  vec3 rShirt = texture2D(riderShirt, vMapUv * 3.2).rgb;
  diffuseColor.rgb = mix(diffuseColor.rgb, rShirt * rG, rM.r);
  diffuseColor.rgb = mix(diffuseColor.rgb, riderJeans * rG * 1.7, rM.g);
  diffuseColor.rgb *= 1.0 - rM.b * riderStubble * 0.6;
  if (riderTop < 0.5) { // a shirt is on: its back and sides are the shirt all the way round. (The cloth back panel rides over this; when the
    // arms reach for the bars the shoulder blades push through it, and white baniyan showing there read as a torn shirt.)
    float bk = max(smoothstep(0.03, -0.01, vRB.z), smoothstep(0.12, 0.16, abs(vRB.x))) * step(1.0, vRB.y) * step(vRB.y, 1.52) * step(abs(vRB.x), 0.27);
    diffuseColor.rgb = mix(diffuseColor.rgb, rShirt * 0.9, bk); }
  { // wardrobe, decided from the bind-pose position (the same space the texture was painted in, tools/model/paint-rider.py)
    float aX = abs(vRB.x), y = vRB.y;
    float vestP = step(0.995, y) * step(y, 1.375) * step(aX, 0.2);                 // the painted white baniyan
    float collarV = step(0.0, vRB.z) * step(1.33, y) * step(y, 1.5) * step(aX, 0.03 + (y - 1.33) * 0.8);   // the open-collar V painted as skin
    float covered = max(max(rM.r, vestP), collarV);                                  // everything a top can cover
    if (riderTop > 0.5 && covered > 0.5) {
      // bare skin, with definition on the front of a bare torso (pecs, sternum, abs, navel), sharper with muscle
      float fz = smoothstep(0.02, 0.07, vRB.z), dk = 0.4 + 0.6 * min(riderMuscle, 1.5);
      float pec = exp(-pow((y - (1.255 - aX * 0.22)) / 0.011, 2.0)) * step(aX, 0.15), stern = exp(-pow(vRB.x / 0.006, 2.0)) * step(1.17, y) * step(y, 1.36);
      float absV = exp(-pow(vRB.x / 0.005, 2.0)) * step(1.0, y) * step(y, 1.2), absH = 0.0;
      for (int i = 0; i < 3; i++) absH += exp(-pow((y - (1.06 + 0.05 * float(i))) / 0.006, 2.0)) * step(aX, 0.07);
      float navel = exp(-(pow(vRB.x / 0.01, 2.0) + pow((y - 1.03) / 0.012, 2.0)));
      vec3 skin = riderSkin * (1.0 - ((pec * 0.32 + stern * 0.14 + absV * 0.22 + absH * 0.2) * dk + navel * 0.4) * fz);
      vec3 top = skin;
      if (riderTop < 1.5) { // baniyan: torso, straps over the shoulders, a scoop neck and armholes
        float strap = step(0.055, aX) * step(aX, 0.125) * step(y, 1.5);
        float body = step(aX, 0.2) * step(y, 1.43) * (1.0 - step(1.3, y) * smoothstep(0.13, 0.15, aX + (y - 1.3) * 0.25));   // armholes curve in
        float back = step(vRB.z, -0.02) * step(aX, 0.125) * step(y, 1.46);
        float neck = step(0.0, vRB.z) * step(aX, 0.075 + (y - 1.36) * 0.6) * step(1.36, y);                               // scoop neck
        float isVest = max(max(body, strap), back) * (1.0 - neck) * step(0.995, y);
        float sh = vestP > 0.5 ? clamp(sampledDiffuseColor.g / 0.8, 0.6, 1.15) : 1.0;
        top = mix(skin, riderVest * sh, isVest);
      }
      diffuseColor.rgb = top;
    }
    // the waistband above the jeans: brand elastic, leopard, a pantie band or lace (alpha = coverage)
    if (riderBandOn > 0.5) { float bv = (y - 0.988) / 0.052;
      if (bv > 0.0 && bv < 1.0 && aX < 0.25) { vec4 bt = texture2D(riderBandTex, vec2((atan(vRB.x, vRB.z) / 6.2832 + 0.5) * 3.0, bv)); diffuseColor.rgb = mix(diffuseColor.rgb, bt.rgb, bt.a); } }
  }`;
// bind-space position for the wardrobe + the muscle push (before skinning, along the bind normal). T-pose: arms out along x.
const RIDER_VS = `#include <begin_vertex>
  vec3 pR = position * riderDeq.x + riderDeq.yzw; vRB = pR;
  { float aX = abs(pR.x), y = pR.y, z = pR.z, w = 0.0;
    float arm = smoothstep(0.17, 0.24, aX) * (1.0 - smoothstep(0.62, 0.7, aX)) * smoothstep(1.27, 1.33, y);
    w += arm * (exp(-pow((aX - 0.3) / 0.07, 2.0)) + exp(-pow((aX - 0.2) / 0.045, 2.0)) * 0.9 + exp(-pow((aX - 0.46) / 0.07, 2.0)) * 0.45) * 0.024;   // biceps, delts, forearms
    float tor = step(aX, 0.22) * smoothstep(1.05, 1.18, y) * (1.0 - smoothstep(1.42, 1.5, y));
    w += tor * smoothstep(0.03, 0.09, z) * exp(-pow((y - 1.3) / 0.07, 2.0)) * 0.022;                       // pecs
    w += tor * smoothstep(-0.05, -0.1, z) * exp(-pow((y - 1.28) / 0.1, 2.0)) * 0.016;                      // lats
    w += step(aX, 0.2) * smoothstep(1.4, 1.46, y) * (1.0 - smoothstep(1.53, 1.58, y)) * smoothstep(0.04, 0.1, aX) * 0.014;   // traps
    w += smoothstep(0.5, 0.6, y) * (1.0 - smoothstep(0.86, 0.93, y)) * step(0.04, aX) * step(aX, 0.2) * 0.011;            // thighs
    transformed += normal * (w * riderMuscle / riderDeq.x); }`;
function riderVS(sh, U) { Object.assign(sh.uniforms, U); sh.vertexShader = 'uniform float riderMuscle; uniform vec4 riderDeq; varying vec3 vRB;\n' + sh.vertexShader.replace('#include <begin_vertex>', RIDER_VS); }
const RIDER_FS_HEAD = 'uniform sampler2D riderMask; uniform sampler2D riderShirt; uniform vec3 riderJeans; uniform float riderStubble; uniform float riderTop, riderMuscle, riderBandOn; uniform vec3 riderSkin, riderVest; uniform sampler2D riderBandTex; varying vec3 vRB;\n';
function riderWardrobeU(o, mesh) { return { riderDeq: { value: (RIDER_MODEL.deq && RIDER_MODEL.deq[mesh]) || new THREE.Vector4(1, 0, 0, 0) }, riderTop: { value: o.top === 'bare' ? 2 : o.top === 'vest' ? 1 : 0 }, riderMuscle: { value: o.muscle || 0 }, riderBandOn: { value: o.band ? 1 : 0 }, riderSkin: { value: new THREE.Color(RIDER_MODEL.skin || '#b07a52') }, riderVest: { value: new THREE.Color(o.vest || '#f2efe6') }, riderBandTex: { value: o.band ? bandTexture(o.band) : (RIDER_MODEL.blank || (RIDER_MODEL.blank = Object.assign(new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1), { needsUpdate: true }))) } }; }
function riderBodyMat(shirtTex, jeans, low, stubble, o = {}) {
  const key = [shirtTex.uuid, jeans, low ? 1 : 0, stubble ? 's' : '', o.top, o.vest, o.band && o.band.id, o.muscle || 0, o.lod ? 'lod' : ''].join('|'); if (RIDER_MODEL.mats.has(key)) return RIDER_MODEL.mats.get(key);
  const m = low ? new THREE.MeshLambertMaterial({ map: RIDER_MODEL.base }) : new THREE.MeshStandardMaterial({ map: RIDER_MODEL.base, roughness: 0.78, metalness: 0 });
  const U = Object.assign({ riderMask: { value: RIDER_MODEL.mask }, riderShirt: { value: shirtTex }, riderJeans: { value: new THREE.Color(jeans || '#26304f') }, riderStubble: { value: stubble ? 1 : 0 } }, riderWardrobeU(o, o.lod ? 'body_lod' : 'body'));
  m.onBeforeCompile = (sh) => { riderVS(sh, U); sh.fragmentShader = RIDER_FS_HEAD + sh.fragmentShader.replace('#include <map_fragment>', RIDER_HOOK).replace('#include <emissivemap_fragment>', FACE_FILL); };
  m.customProgramCacheKey = () => low ? 'rider-l4' : 'rider-s4'; m.userData.riderU = U;
  RIDER_MODEL.mats.set(key, m); return m;
}
// cloth + hair streaming in the wind: displaced after skinning, in the rider's own space (+z forward), scaled per vertex
const FLUTTER_VS = `#include <skinning_vertex>
  { float fw = _flutter * uWind;
    float ph = uTime * 17.0 + transformed.y * 21.0 + transformed.x * 13.0, ph2 = uTime * 11.0 + transformed.z * 17.0 + transformed.y * 9.0;
    transformed += (vec3(0.0, 0.22, -1.0) * (0.07 + 0.04 * sin(ph)) + objectNormal * (0.025 * sin(ph2)) + vec3(0.015 * sin(ph * 1.7), 0.01 * sin(ph2 * 1.3), 0.0)) * fw; }`;
function flutterMat(base, U, key) { // base: a fresh material; U: this rider's { uWind, uTime } (+ any fragment uniforms already hooked)
  const prev = base.onBeforeCompile;
  base.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); sh.uniforms.uWind = U.uWind; sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'attribute float _flutter; uniform float uWind; uniform float uTime;\n' + sh.vertexShader.replace('#include <skinning_vertex>', FLUTTER_VS); };
  base.customProgramCacheKey = () => key; return base;
}
function riderShellMat(shirtTex, jeans, low, U, o = {}) {
  const m = low ? new THREE.MeshLambertMaterial({ map: RIDER_MODEL.base }) : new THREE.MeshStandardMaterial({ map: RIDER_MODEL.base, roughness: 0.8, metalness: 0 });
  const FU = Object.assign({ riderMask: { value: RIDER_MODEL.mask }, riderShirt: { value: shirtTex }, riderJeans: { value: new THREE.Color(jeans || '#26304f') }, riderStubble: { value: 0 } }, riderWardrobeU(Object.assign({}, o, { top: 'shirt', band: null }), o.lod ? 'shirt_lod' : 'shirt'));
  m.onBeforeCompile = (sh) => { riderVS(sh, FU); sh.fragmentShader = RIDER_FS_HEAD + sh.fragmentShader.replace('#include <map_fragment>', RIDER_HOOK); }; m.userData.riderU = FU;
  m.side = THREE.DoubleSide;
  return flutterMat(m, U, low ? 'shell-l2' : 'shell-s2');
}
function riderHairFlutterMat(color, low, U) {
  const c = new THREE.Color(color).multiplyScalar(1.6);
  const m = low ? new THREE.MeshLambertMaterial({ map: RIDER_MODEL.hairTex, color: c }) : new THREE.MeshStandardMaterial({ map: RIDER_MODEL.hairTex, color: c, roughness: 0.6 });
  m.side = THREE.DoubleSide; return flutterMat(m, U, low ? 'hair-l' : 'hair-s');
}
// the pompadour: sculpted strands in a streak texture, a satin sheen (pomade) and a little lift in the wind
function riderPompMat(color, low, U) {
  const c = new THREE.Color(color).multiplyScalar(1.55);
  const m = low ? new THREE.MeshLambertMaterial({ map: TEX.hairPomp, color: c }) : new THREE.MeshStandardMaterial({ map: TEX.hairPomp, color: c, roughness: 0.38, metalness: 0.08, envMap: BIKE_MODEL.env || null, envMapIntensity: 0.35 });
  return flutterMat(m, U, low ? 'pomp-l' : 'pomp-s');
}
function riderHairMat(color, low) {
  const key = color + (low ? 'l' : 's'); if (RIDER_MODEL.hairMats.has(key)) return RIDER_MODEL.hairMats.get(key);
  const c = new THREE.Color(color).multiplyScalar(1.6);
  const m = low ? new THREE.MeshLambertMaterial({ map: RIDER_MODEL.hairTex, color: c }) : new THREE.MeshStandardMaterial({ map: RIDER_MODEL.hairTex, color: c, roughness: 0.6 });
  RIDER_MODEL.hairMats.set(key, m); return m;
}

// ── small helpers for posing bones in world space ──
const _AXF = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _rq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], _rv = Array.from({ length: 10 }, () => new THREE.Vector3());
const _rm0 = new THREE.Matrix4(), _rm1 = new THREE.Matrix4();
const _ik = Array.from({ length: 14 }, () => new THREE.Vector3()), _pq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const _AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)], SIDES = ['l', 'r'];
const _FOOT_AIM = new THREE.Vector3(0, -0.25, 1).normalize();
const _HAND_AIM = { l: new THREE.Vector3(0.12, -0.55, 1).normalize(), r: new THREE.Vector3(-0.12, -0.55, 1).normalize() };
const _HAND_PALM = { l: new THREE.Vector3(-0.35, -1, 0.15).normalize(), r: new THREE.Vector3(0.35, -1, 0.15).normalize() };
// These read matrixWorld directly and refresh one bone at a time (top-down), instead of letting three.js walk the
// whole parent chain or the whole subtree on every query; this keeps posing eight riders cheap.
const upd = (o) => o.updateWorldMatrix(false, false);
const wpos = (o, out) => { upd(o); return out.setFromMatrixPosition(o.matrixWorld); };
function rotBoneWorld(bone, qW) { // apply a world-space rotation to a bone (parent must be current)
  upd(bone); const pq = _rq[0].setFromRotationMatrix(bone.parent.matrixWorld), bq = _rq[1].setFromRotationMatrix(bone.matrixWorld);
  bq.premultiply(qW); bone.quaternion.copy(pq.invert().multiply(bq)); upd(bone);
}
function basisQ(a0, u0, a1, u1, out) { // rotation taking frame (aim a0, up u0) onto (a1, u1)
  const x0 = _rv[6].copy(a0).normalize(), z0 = _rv[7].crossVectors(x0, u0).normalize(), y0 = _rv[8].crossVectors(z0, x0);
  _rm0.makeBasis(x0, y0, z0);
  const x1 = _rv[6].copy(a1).normalize(), z1 = _rv[7].crossVectors(x1, u1).normalize(), y1 = _rv[8].crossVectors(z1, x1);
  _rm1.makeBasis(x1, y1, z1); _rm1.multiply(_rm0.transpose());
  return out.setFromRotationMatrix(_rm1);
}
function alignBone(bone, aimL, upL, aimW, upW) { // turn bone so its local aim/up axes point along aimW/upW
  upd(bone); const cq = _rq[2].setFromRotationMatrix(bone.matrixWorld); const ca = _rv[4].copy(aimL).applyQuaternion(cq), cu = _rv[5].copy(upL).applyQuaternion(cq);
  rotBoneWorld(bone, basisQ(ca, cu, aimW, upW, _rq[2]));
}

class RiderModel {
  constructor(o, rig, cast) {
    const R = RIDER_MODEL, low = typeof GAME !== 'undefined' && GAME && GAME.quality === 'low';
    const dg = this.dg = o.model === 'dogesh' && DOGESH_MODEL.ready;   // Dogesh: his own meshes and outfit on the same skeleton
    this.root = ADDONS.SkeletonUtils.clone(dg ? DOGESH_MODEL.scene : R.scene); this.root.scale.setScalar(RIDER_FIT.scale);
    const meshes = {}; this.root.traverse(n => { if (n.isSkinnedMesh) meshes[n.name] = n; });
    this.U = { uWind: { value: 0 }, uTime: { value: 0 } }; this.ownMats = [];
    let shirtKey = null, M = null;
    if (dg) {
      M = dogeshMats(low); for (const m of Object.values(meshes)) { m.castShadow = cast; m.frustumCulled = false; }
      meshes.dg_body.material = M.body; meshes.dg_jacket.material = M.jacket; meshes.dg_beard.material = M.beard; meshes.dg_glass.material = M.glass; meshes.dg_ear.material = accMats().gold;
      meshes.dg_beard.userData.noOutline = meshes.dg_ear.userData.noOutline = true;   // thin cards and hoops: an ink shell would turn them into black blobs
      const hm = dogeshHairMat(low, this.U); meshes.dg_hair.material = hm; this.ownMats.push(hm);
    } else {
    const hair = o.helmet ? (o.hair === 'long' ? 'hair_long' : null) : o.hair === 'buzz' ? 'hair_buzz' : o.hair === 'long' ? 'hair_long' : o.hair === 'pomp' ? 'hair_pomp' : 'hair_quiff';
    const keep = new Set([o.lod ? 'body_lod' : 'body', o.lod ? 'shirt_lod' : 'shirt', 'Eyes', 'Eyebrows', hair, o.beard ? 'beard' : null]);
    for (const [n, m] of Object.entries(meshes)) { if (!keep.has(n)) { m.parent.remove(m); continue; } m.castShadow = cast; m.frustumCulled = false; }
    const pat = o.flowers ? 'flowers' : o.check ? 'check' : o.pattern || 'plain'; shirtKey = o.shirt + pat;
    if (!SHIRT_TEX_CACHE[shirtKey]) SHIRT_TEX_CACHE[shirtKey] = shirtTexture(o.shirt, pat);
    meshes[o.lod ? 'body_lod' : 'body'].material = riderBodyMat(SHIRT_TEX_CACHE[shirtKey], o.jeans, low, o.stubble, o);
    { const sm = riderShellMat(SHIRT_TEX_CACHE[shirtKey], o.jeans, low, this.U, o), sh = meshes[o.lod ? 'shirt_lod' : 'shirt']; sh.material = sm; this.ownMats.push(sm);
      if (o.top === 'vest' || o.top === 'bare') sh.visible = false; }   // baniyan / no shirt: the open shirt comes off
    if (hair) { const hm = hair === 'hair_pomp' ? riderPompMat(o.hairColor || '#5a3320', low, this.U) : riderHairFlutterMat(o.hairColor || HAIR_DYES[0], low, this.U); meshes[hair].material = hm; this.ownMats.push(hm); }
    if (o.beard) meshes.beard.material = riderHairMat('#1a120d', low);
    meshes.Eyebrows.material = riderHairMat('#140d09', low);
    if (low) meshes.Eyes.material = R.eyesLow || (R.eyesLow = new THREE.MeshLambertMaterial({ map: R.eyesMat.map }));
    }
    // bones, bind pose and the local axes the IK needs (all measured in the T-pose)
    this.b = {}; this.root.traverse(n => { if (n.isBone) this.b[n.name] = n; });
    this.bind = []; for (const n of Object.values(this.b)) this.bind.push([n, n.quaternion.clone()]);
    if (this.b.Head) this.b.Head.scale.setScalar(HEAD_SCALE);   // a slightly bigger head: the face has to read from a chase camera and on a phone
    this.root.updateMatrixWorld(true);
    const B = this.b, wq = (n) => B[n].getWorldQuaternion(new THREE.Quaternion()), wp = (n) => B[n].getWorldPosition(new THREE.Vector3());
    const local = (n, v) => v.clone().normalize().applyQuaternion(wq(n).invert());
    this.ax = {};
    for (const s of ['l', 'r']) {
      const sg = s === 'l' ? 1 : -1;
      this.ax['arm_' + s] = { aim: local('upperarm_' + s, wp('lowerarm_' + s).sub(wp('upperarm_' + s))), hinge: local('upperarm_' + s, new THREE.Vector3(0, -sg, 0)) };
      this.ax['hand_' + s] = { aim: local('hand_' + s, wp('middle_01_' + s).sub(wp('hand_' + s))), palm: local('hand_' + s, new THREE.Vector3(0, -1, 0)) };
      this.ax['leg_' + s] = { aim: local('thigh_' + s, wp('calf_' + s).sub(wp('thigh_' + s))), hinge: local('thigh_' + s, new THREE.Vector3(1, 0, 0)) };
      this.ax['foot_' + s] = { aim: local('foot_' + s, wp('ball_' + s).sub(wp('foot_' + s))), up: local('foot_' + s, new THREE.Vector3(0, 1, 0)) };
      this.fingers = this.fingers || [];
      for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) for (const k of ['01', '02', '03']) {
        const bn = B[`${f}_${k}_${s}`]; if (!bn) continue;
        this.fingers.push({ bone: bn, q0: bn.quaternion.clone(), axis: local(`${f}_${k}_${s}`, new THREE.Vector3(0, 0, -sg)), amt: f === 'thumb' ? 0.35 : k === '01' ? 1.0 : 1.2 });
      }
    }
    this.fingerSet = new Set(this.fingers.map(f => f.bone));
    this.bind = this.bind.filter(([n]) => !this.fingerSet.has(n));
    // bind matrices of the torso bones at unit scale (pose() works detached at unit scale) for the cloth shirt
    this.root.scale.set(1, 1, 1); this.root.updateMatrixWorld(true); this.invBind = CLOTH_BONES.map(n => B[n].matrixWorld.clone().invert());
    this.root.scale.setScalar(RIDER_FIT.scale); this.root.updateMatrixWorld(true);
    const pb = wp('pelvis').divideScalar(RIDER_FIT.scale); // pelvis in model units
    this.root.position.set(RIDER_FIT.pelvis[0] - pb.x * RIDER_FIT.scale, RIDER_FIT.pelvis[1] - pb.y * RIDER_FIT.scale, RIDER_FIT.pelvis[2] - pb.z * RIDER_FIT.scale);
    rig.body.add(this.root); this.baseY = this.root.position.y; this.baseX = this.root.position.x;
    this.cloth = dg ? new ShirtCloth(this, rig, null, low, !!o.lod, cast, dogeshJacketCloth(low, M))   // Dogesh's long jacket
      : o.top === 'vest' || o.top === 'bare' ? { panels: [], step() {}, capture() {}, dispose() {} }
      : new ShirtCloth(this, rig, SHIRT_TEX_CACHE[shirtKey], low, !!o.lod, cast, { muscle: o.muscle || 0, hem: o.band ? 1.06 : 0.92 });   // a shorter back when the waistband shows
    this.cape = o.cape && o.cape.id !== 'none' ? new CapeCloth(this, rig, o.cape, low, !!o.lod, cast, { muscle: o.muscle || 0 }) : null;   // long cape over the shoulders
    // accessories ride on bones, in a holder that cancels the bone's own bind rotation (so +y up, +z forward)
    const holder = (bn) => { const h = new THREE.Group(); h.quaternion.copy(wq(bn).invert()); B[bn].add(h); return h; };
    const acc = riderAccessories(dg ? Object.assign({}, o, { shades: null, chestDz: 0.016 }) : o); this.geoms = acc.geoms;   // Dogesh keeps his own wayfarers; his chain sits on the kurta
    // face markers (head-bone space, +y up, +z forward, +x the rider's left): gestures aim the hands at these
    const hh = holder('Head'); if (acc.head) hh.add(acc.head); this.shades = acc.shades || null; this.headH = hh;
    this.marks = {}; for (const [k, x, y, z] of [['mouth', 0, 0.03, 0.112], ['crown', 0, 0.215, -0.01], ['tL', 0.072, 0.105, 0.07], ['tR', -0.072, 0.105, 0.07], ['lipR', -0.034, 0.036, 0.1], ['brow', 0, 0.15, 0.115]]) { const m = new THREE.Object3D(); m.position.set(x, y, z); hh.add(m); this.marks[k] = m; }
    this.face = {}; for (const k in this.marks) this.face[k] = new THREE.Vector3();
    if (acc.neck) holder('neck_01').add(acc.neck); if (acc.chest) holder('spine_03').add(acc.chest); if (acc.wrist) holder('lowerarm_l').add(acc.wrist);
    for (const k of ['head', 'chest', 'wrist']) if (acc[k]) acc[k].traverse(m => { if (m.isMesh) m.castShadow = cast; });
    this.hands = { l: new THREE.Vector3(), r: new THREE.Vector3() }; this.elbows = { l: new THREE.Vector3(), r: new THREE.Vector3() };
  }
  // pose from the rig's logical state: tuck/roll/twist (torsoG), head (headG), leg kicks, hand targets in bike space
  // All the maths runs in the rider's own model space: the root is briefly detached (no parent, unit transform), so
  // world-space helpers stop walking up through the bike, and bike-space targets only need an offset + scale.
  pose(rig, armLT, armRT, crashed) {
    const B = this.b, V = _rv, F = RIDER_FIT, R = this.root;
    for (const [n, q] of this.bind) n.quaternion.copy(q);
    const ln = rig.leanNow || 0, fr = rig.free;   // fr: off the bike (standing / walking): root position + facing in bike space, feet targets
    if (fr) { R.position.copy(fr.pos); R.rotation.set(0, fr.yaw, 0); }
    else { R.position.y = this.baseY + (rig.riderLag || 0) * 0.8; R.position.x = this.baseX + clamp(ln, -0.9, 0.9) * 0.1; if (this.baseZ === undefined) this.baseZ = R.position.z; R.position.z = this.baseZ; if (R.rotation.y) R.rotation.set(0, 0, 0); }
    const parent = R.parent, px = R.position.x, py = R.position.y, pz = R.position.z, sc = R.scale.x;
    R.parent = null; R.position.set(0, 0, 0); R.scale.set(1, 1, 1); R.updateMatrixWorld(true);
    const toModel = (v) => v.set((v.x - px) / sc, (v.y - py) / sc, (v.z - pz) / sc);
    const AX = fr ? _AXF.map((a, i) => a.copy(_AXES[i]).applyQuaternion(R.quaternion)) : _AXES, q = _pq[0], qa = _pq[1];   // the rider's own axes
    try {
      const turn = (bone, pitch, roll, yaw) => { q.setFromAxisAngle(AX[0], pitch); if (roll) q.premultiply(qa.setFromAxisAngle(AX[2], roll)); if (yaw) q.premultiply(qa.setFromAxisAngle(AX[1], yaw)); rotBoneWorld(bone, q); };
      // spine: base riding lean + tuck, lean into corners, twist for swings
      const T = rig.torsoG.rotation; const lean = crashed ? -0.35 : F.baseLean + T.x;
      turn(B.spine_01, lean * 0.3, T.z * 0.3, T.y * 0.3); turn(B.spine_02, lean * 0.35, T.z * 0.35, T.y * 0.35); turn(B.spine_03, lean * 0.35, T.z * 0.35, T.y * 0.35);
      // head keeps looking up the road
      const H = rig.headG.rotation; const hp = -lean * 0.85 + (H.x + T.x * 0.7);
      turn(B.neck_01, hp * 0.45, H.z * 0.4, H.y * 0.4); turn(B.Head, hp * 0.55, H.z * 0.6, H.y * 0.6);
      // shoulders roll forward toward the bars
      for (const s of SIDES) { q.setFromAxisAngle(AX[1], -(s === 'l' ? 1 : -1) * 0.28); rotBoneWorld(B['clavicle_' + s], q); }
      // legs → pegs (kicks swing the target out)
      for (const s of SIDES) {
        const sg = s === 'l' ? 1 : -1, leg = s === 'l' ? rig.legL : rig.legR;
        const hip = wpos(B['thigh_' + s], V[0]);
        if (fr) {   // standing / walking: feet where the director puts them, knees forward
          const tgt = toModel(V[1].copy(fr.feet[s])), pole = V[3].copy(hip).addScaledVector(AX[2], 1.2).addScaledVector(AX[0], sg * 0.12).addScaledVector(AX[1], -0.2);
          this.ik(B['thigh_' + s], B['calf_' + s], B['foot_' + s], tgt, pole, this.ax['leg_' + s]);
          alignBone(B['foot_' + s], this.ax['foot_' + s].aim, this.ax['foot_' + s].up, _rv[8].copy(_FOOT_AIM).applyQuaternion(R.quaternion), AX[1]); continue;
        }
        const fo = rig.footOff ? rig.footOff[s] : null;   // a foot off its peg: down on the road at a stop, out in a slide, a dab at the gear lever
        const tgt = toModel(fo ? V[1].set(sg * F.ankle[0] + fo.x, F.ankle[1] + fo.y, F.ankle[2] + fo.z) : V[1].set(sg * F.ankle[0], F.ankle[1], F.ankle[2]));
        if (leg.rotation.x || leg.rotation.z) { const d = V[2].subVectors(tgt, hip).applyEuler(leg.rotation); tgt.copy(hip).add(d); }
        const inside = Math.sign(ln) === sg ? Math.min(1, Math.abs(ln) * 1.6) : 0;   // chapri style: knees flung wide, the inside one even more
        const pole = toModel(V[3].set(sg * (1.0 + 1.4 * inside), 0.82 - 0.35 * inside, 0.6 - 0.3 * inside));
        this.ik(B['thigh_' + s], B['calf_' + s], B['foot_' + s], tgt, pole, this.ax['leg_' + s]);
        alignBone(B['foot_' + s], this.ax['foot_' + s].aim, this.ax['foot_' + s].up, _FOOT_AIM, AX[1]);
      }
      // arms → grips (or wherever an animation sends the hand)
      for (const s of SIDES) {
        const sg = s === 'l' ? 1 : -1, t = s === 'l' ? armLT : armRT; const onBars = !crashed && Math.abs(Math.abs(t.x) - MODEL_FIT.grip[0]) < 0.12 && t.y < 1.2;
        const tgt = toModel(V[1].set(t.x + (onBars ? F.wrist[0] : 0), t.y + (onBars ? F.wrist[1] : 0), t.z + (onBars ? F.wrist[2] : 0)));
        const sh = wpos(B['upperarm_' + s], V[0]);
        const pole = V[3].set(sg * 0.55, -0.5, fr ? -0.4 : -0.25); if (fr) pole.applyQuaternion(R.quaternion); pole.add(sh);
        this.ik(B['upperarm_' + s], B['lowerarm_' + s], B['hand_' + s], tgt, pole, this.ax['arm_' + s]);
        if (onBars) alignBone(B['hand_' + s], this.ax['hand_' + s].aim, this.ax['hand_' + s].palm, _HAND_AIM[s], _HAND_PALM[s]);
      }
      // fists / grips
      const curl = crashed ? 0.3 : 1.15; for (const f of this.fingers) f.bone.quaternion.copy(f.q0).multiply(q.setFromAxisAngle(f.axis, f.amt * curl));
      for (const s of SIDES) { const h = wpos(B['hand_' + s], this.hands[s]), e = wpos(B['lowerarm_' + s], this.elbows[s]);
        h.multiplyScalar(sc).add(_rv[9].set(px, py, pz)); e.multiplyScalar(sc).add(_rv[9]); }
      upd(this.headH); for (const k in this.marks) wpos(this.marks[k], this.face[k]).multiplyScalar(sc).add(_rv[9]);   // face points, bike-body space
      this.cloth.capture(B, this.invBind, sc, px, py, pz); if (this.cape) this.cape.capture(B, this.invBind, sc, px, py, pz);
    } finally { R.parent = parent; R.position.set(px, py, pz); R.scale.setScalar(sc); }
  }
  // two-bone IK with an anatomical hinge: aligns the upper bone's aim + hinge, then swings the lower bone onto the target
  ik(a, b, c, target, pole, ax) {
    const W = _ik; const A = wpos(a, W[0]), Bp = wpos(b, W[1]), C = wpos(c, W[2]);
    const la = A.distanceTo(Bp), lb = Bp.distanceTo(C); const dir = W[3].subVectors(target, A); let d = dir.length();
    d = clamp(d, Math.abs(la - lb) + 1e-3, la + lb - 1e-4); dir.normalize();
    const pv = W[4].subVectors(pole, A); pv.addScaledVector(dir, -pv.dot(dir)); if (pv.lengthSq() < 1e-8) pv.set(0, 1, 0); pv.normalize();
    const cosA = clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const Bt = W[5].copy(A).addScaledVector(dir, cosA * la).addScaledVector(pv, sinA * la);
    const Tt = W[6].copy(A).addScaledVector(dir, d);
    const aim1 = W[7].subVectors(Bt, A).normalize(); const flex = W[8].subVectors(Tt, Bt); flex.addScaledVector(aim1, -flex.dot(aim1));
    if (flex.lengthSq() < 1e-8) flex.copy(pv).multiplyScalar(-1); const hinge = W[9].crossVectors(aim1, flex.normalize());
    alignBone(a, ax.aim, ax.hinge, aim1, hinge);
    const B2 = wpos(b, W[10]), C2 = wpos(c, W[11]);
    rotBoneWorld(b, _pq[2].setFromUnitVectors(W[12].subVectors(C2, B2).normalize(), W[13].subVectors(Tt, B2).normalize()));
  }
  // wrist / elbow in bike-body space, as of the last pose()
  hand(s) { return this.hands[s]; }
  elbow(s) { return this.elbows[s]; }
  setWind(speed, t) { this.U.uWind.value = smooth(this.U.uWind.value, 0.08 + clamp(speed / 24, 0, 1.3), 4, 1 / 60); this.U.uTime.value = t; }
  dispose() { this.cloth.dispose(); if (this.cape) this.cape.dispose(); this.geoms.forEach(g => g.dispose()); this.ownMats.forEach(m => m.dispose()); this.root.traverse(n => { if (n.isSkinnedMesh && n.skeleton) n.skeleton.dispose(); }); }
}
// helmet / shades / gold chain in head- and neck-relative space (+y up, +z forward, metres)
// shades, gold chains and a watch: built from curves and lathes so they read as jewellery up close
const ACC = { mats: null };
function accMats() {
  if (ACC.mats) return ACC.mats; const env = BIKE_MODEL.env || null;
  ACC.mats = { gold: new THREE.MeshStandardMaterial({ color: '#e7b53c', metalness: 1, roughness: 0.22, envMap: env, envMapIntensity: 1.6 }),
    lens: new THREE.MeshStandardMaterial({ color: '#8a4a16', metalness: 0.25, roughness: 0.05, envMap: env, envMapIntensity: 1.3, transparent: true, opacity: 0.5, depthWrite: false }),   // smoked amber: his eyes show through
    dial: new THREE.MeshStandardMaterial({ color: '#0e1830', metalness: 0.4, roughness: 0.15, envMap: env }),
    frames: new Map(), frame(c) { if (!this.frames.has(c)) this.frames.set(c, new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: 0.25, envMap: env, envMapIntensity: 1.4, side: THREE.DoubleSide })); return this.frames.get(c); } };
  ACC.mats.lens.side = THREE.DoubleSide; ACC.mats.gold.side = THREE.DoubleSide;
  return ACC.mats;
}
const ACC_GEO = {};
function aviatorGeo() {
  if (ACC_GEO.av) return ACC_GEO.av;
  // classic teardrop lens (right lens, in the face plane; x outward): flat-ish top, deep drop toward the outer-bottom
  const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a);
    const x = 0.027 * c + 0.004 * (s < 0 ? c * -s : 0), y = (s > 0 ? 0.0165 * Math.pow(s, 0.55) : 0.023 * s * (1 + 0.25 * c)); pts.push(new THREE.Vector2(x, y)); }
  const shape = new THREE.Shape(pts); const lens = new THREE.ShapeGeometry(shape, 12);
  const rim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, p.y, 0.0015)), true), 48, 0.0019, 5, true);
  ACC_GEO.av = { lens, rim }; return ACC_GEO.av;
}
function riderAccessories(o) {
  const out = { geoms: [] }; const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const hb = new Batch(); let any = false;
  const put = (b, g, x, y, z, c, sx = 1, sy = 1, sz = 1, rx = 0) => { M.compose(P.set(x, y, z), Q.setFromEuler(new THREE.Euler(rx, 0, 0)), S.set(sx, sy, sz)); b.add(g, M, new THREE.Color(c)); };
  if (o.helmet) { any = true; put(hb, new THREE.SphereGeometry(0.135, 16, 10), 0, 0.115, -0.005, o.helmet, 1, 1.02, 1.12); put(hb, new THREE.SphereGeometry(0.125, 12, 6, -1.0, 2.0, 1.15, 0.75), 0, 0.105, 0.03, '#1a2030', 1.06, 1, 1.12); }
  const aviator = o.shades && !o.helmet && o.shadesStyle === 'aviator';
  if (o.shades && !o.helmet && !aviator) { any = true; put(hb, new THREE.BoxGeometry(0.155, 0.03, 0.012), 0, 0.1, 0.103, o.shades); put(hb, new THREE.BoxGeometry(0.06, 0.034, 0.01), 0.033, 0.098, 0.11, '#0d1116'); put(hb, new THREE.BoxGeometry(0.06, 0.034, 0.01), -0.033, 0.098, 0.11, '#0d1116'); }
  if (any) { const g = hb.build(); out.geoms.push(g); out.head = new THREE.Mesh(g, BIKE_MAT); }
  if (aviator) { // two wrapped teardrop lenses in thin metal frames, a double bridge and arms back to the ears
    const A = accMats(), G = aviatorGeo(), fr = (o.shades || '#d4a62a') === '#d4a62a' ? A.gold : A.frame(o.shades); const g = new THREE.Group(); g.position.set(0, 0.112, 0.118);
    for (const sx of [-1, 1]) { const side = new THREE.Group(); side.position.set(sx * 0.033, 0, -0.004 * 0); side.rotation.y = sx * 0.2; side.scale.x = sx;
      const lens = new THREE.Mesh(G.lens, A.lens); lens.position.z = 0.001; side.add(lens, new THREE.Mesh(G.rim, fr)); g.add(side);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.13, 5).rotateX(Math.PI / 2), fr); arm.position.set(sx * 0.071, 0.009, -0.06); arm.rotation.y = -sx * 0.13; g.add(arm); out.geoms.push(arm.geometry); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.03, 5).rotateZ(Math.PI / 2), fr); bar.position.set(0, 0.0125, 0.003); g.add(bar);
    const nose = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0016, 4, 10, Math.PI), fr); nose.position.set(0, 0.003, 0.004); g.add(nose); out.geoms.push(bar.geometry, nose.geometry);
    if (out.head) { const grp = new THREE.Group(); grp.add(out.head, g); out.head = grp; } else out.head = g; out.shades = g; g.userData.y0 = g.position.y; g.userData.z0 = g.position.z;
  }
  if (o.goldChain) { // a heavy curb chain on the collarbones with a thin one and a pendant below it (chest holder: spine_03 at y 1.311)
    const A = accMats(), cy = 1.311, cz = 0.007, fz = o.chestDz || 0, path = (dy, dz, w) => new THREE.CatmullRomCurve3([[0, 1.535 - dy * 0.3, -0.098], [w * 0.62, 1.525 - dy * 0.4, -0.07], [w, 1.49 - dy * 0.6, 0.01], [w * 0.78, 1.45 - dy, 0.075 + dz], [w * 0.4, 1.415 - dy * 1.15, 0.108 + dz], [0, 1.4 - dy * 1.25, 0.117 + dz], [-w * 0.4, 1.415 - dy * 1.15, 0.108 + dz], [-w * 0.78, 1.45 - dy, 0.075 + dz], [-w, 1.49 - dy * 0.6, 0.01], [-w * 0.62, 1.525 - dy * 0.4, -0.07]].map(([x, y, z]) => new THREE.Vector3(x * (1 + fz * 3), y - cy, z - cz + fz * clamp(z / 0.117, 0, 1))), true);
    const g = new THREE.Group();
    const thick = new THREE.Mesh(new THREE.TubeGeometry(path(0, 0.004, 0.085), 90, 0.0058, 6, true), A.gold);
    const thin = new THREE.Mesh(new THREE.TubeGeometry(path(0.045, 0.006, 0.092), 90, 0.0027, 5, true), A.gold);
    const pend = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 18).rotateX(Math.PI / 2), A.gold); pend.position.set(0, 1.335 - cy, 0.125 - cz + fz);
    g.add(thick, thin, pend); out.geoms.push(thick.geometry, thin.geometry, pend.geometry); out.chest = g;
  }
  if (o.watch) { // gold watch on the left wrist (lowerarm_l holder: +x runs down the forearm in the T-pose)
    const A = accMats(), g = new THREE.Group(); g.position.set(0.225, 0, 0);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0065, 6, 20).rotateY(Math.PI / 2), A.gold); band.scale.set(1, 0.9, 1);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 18), A.dial); dial.position.set(0, 0.031, 0); const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 5, 18).rotateX(Math.PI / 2), A.gold); bezel.position.set(0, 0.035, 0);
    g.add(band, dial, bezel); out.geoms.push(band.geometry, dial.geometry, bezel.geometry); out.wrist = g;
  }
  return out;
}
