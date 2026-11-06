// ───────────────────────── REAL BIKE MODEL ─────────────────────────
// "RX100 BIKE" by patilaryush (sketchfab.com/3d-models/rx100-bike-06a03105792a418bba751e67506d4e86), CC BY 4.0.
// Rebadged CR100 / CHAPRI, centre stand folded, fitted to bike space (+z forward, axles at z -0.64 / 0.66).
// Shipped inside the page as gzip + base64 (#bikeglb). If anything fails, BikeRig falls back to the built-in bike.
const BIKE_MODEL = { ready: false, parts: null, env: null, envI: 1, mats: new Map(), lowMats: new Map(), lambert: false };
const PAINT_REF_L = 0.044;   // linear luminance of the original maroon paint (tools/model/paintmask.py)
const MODEL_FIT = { hipY: 0.88, grip: [0.3, 1.045, 0.31], head: [0, 0.93, 0.624], headR: 0.085, tail: [0, 0.8, -1.0] };

// shared: the addon modules + gzip/base64 decoding of an inert <script> block
const ADDONS = {};
async function loadAddons() {
  if (ADDONS.GLTFLoader) return ADDONS;
  const [g, r, s] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/environments/RoomEnvironment.js'), import('three/addons/utils/SkeletonUtils.js')]);
  ADDONS.GLTFLoader = g.GLTFLoader; ADDONS.RoomEnvironment = r.RoomEnvironment; ADDONS.SkeletonUtils = s; return ADDONS;
}
async function decodeEmbedded(id) {
  const el = document.getElementById(id); if (!el || !el.textContent.trim()) throw new Error('no ' + id);
  const s = atob(el.textContent.trim()); const bin = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
  return new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
// both models load in parallel; each one falls back on its own
async function loadModels(renderer) {
  if (!window.DecompressionStream) return { bike: false, rider: false };
  try { await loadAddons(); } catch (e) { console.warn('3D model loaders unavailable:', e && e.message); return { bike: false, rider: false }; }
  const [bike, rider] = await Promise.all([URLP.get('bike') === 'basic' ? false : loadBikeModel(renderer), URLP.get('rider') === 'basic' ? false : loadRiderModel()]);
  return { bike, rider };
}
async function loadBikeModel(renderer) {
  try {
    const { GLTFLoader, RoomEnvironment } = ADDONS;
    const gltf = await new GLTFLoader().parseAsync(await decodeEmbedded('bikeglb'), '');
    const sc = gltf.scene; sc.updateMatrixWorld(true);
    const inv = new THREE.Matrix4();
    // each part: list of { g, mat, M } with M relative to the part's pivot (axle for wheels, bike origin otherwise)
    const part = (name, pivot) => { const o = sc.getObjectByName(name); if (!o) throw new Error('missing ' + name); const out = []; inv.makeTranslation(-pivot[0], -pivot[1], -pivot[2]);
      o.traverse(m => { if (m.isMesh) out.push({ g: m.geometry, mat: m.material, M: inv.clone().multiply(m.matrixWorld) }); }); return out; };
    const parts = { body: part('body', [0, 0, 0]), lod: part('body_lod', [0, 0, 0]), wheelF: part('wheelF', [0, WHEEL_R_M, FRONT_Z]), wheelR: part('wheelR', [0, WHEEL_R_M, REAR_Z]) };
    const bodyMat = parts.body[0].mat; const tyreMat = parts.wheelF.find(p => p.mat !== bodyMat).mat;
    parts.bodyMat = bodyMat; parts.tyreMat = tyreMat;
    for (const p of [...parts.wheelF, ...parts.wheelR]) if (p.mat !== tyreMat) p.mat = bodyMat;   // rims share the body sheet
    const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(renderer); BIKE_MODEL.env = pm.fromScene(room, 0.04).texture; pm.dispose(); room.dispose();
    for (const m of [bodyMat, tyreMat]) { m.envMap = BIKE_MODEL.env; m.envMapIntensity = BIKE_MODEL.envI; }
    BIKE_MODEL.parts = parts; BIKE_MODEL.ready = true;
    return true;
  } catch (e) { console.warn('Bike model unavailable, using the built-in bike:', e && e.message); return false; }
}
const WHEEL_R_M = 0.3121;

// Paint: the base-colour alpha marks paintwork (128) vs everything else (255). Repaint keeps the baked shading.
const PAINT_HOOK_MAP = `#include <map_fragment>
  float paintM = clamp((1.0 - sampledDiffuseColor.a) * 2.0, 0.0, 1.0) * paintAmt;
  float paintL = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / ${PAINT_REF_L.toFixed(4)};
  diffuseColor.rgb = mix(diffuseColor.rgb, paintCol * clamp(paintL, 0.0, 4.0), paintM);
  diffuseColor.a = 1.0;`;
const PAINT_HOOK_ROUGH = `#include <metalnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor * paintRough, 0.05, 1.0), paintM);
  metalnessFactor = mix(metalnessFactor, max(metalnessFactor, paintMetal), paintM);`;
// paint finishes: roughness multiplier, minimum metalness, metal-flake sparkle
const FINISHES = { gloss: [0.8, 0, 0], matte: [2.6, 0, 0], flake: [0.5, 0.45, 1], chrome: [0.3, 0.62, 0] };
function paintedBikeMat(paint, finish, low) {
  if (finish === true) finish = 'chrome'; if (!FINISHES[finish]) finish = 'gloss';
  const key = (paint || 'orig') + '|' + finish; const cache = low ? BIKE_MODEL.lowMats : BIKE_MODEL.mats;
  if (cache.has(key)) return cache.get(key);
  const src = BIKE_MODEL.parts.bodyMat; let m;
  if (low) m = new THREE.MeshLambertMaterial({ map: src.map });
  else { m = src.clone(); m.envMap = BIKE_MODEL.env; m.envMapIntensity = BIKE_MODEL.envI; }
  const orig = !paint || paint.toLowerCase() === '#8a1630', F = FINISHES[finish];
  const U = { paintCol: { value: new THREE.Color(paint || '#8a1630') }, paintAmt: { value: orig && finish === 'gloss' ? 0 : 1 }, paintRough: { value: F[0] }, paintMetal: { value: F[1] }, paintFlake: { value: low ? 0 : F[2] } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = 'uniform vec3 paintCol; uniform float paintAmt; uniform float paintRough; uniform float paintMetal; uniform float paintFlake;\n' + sh.fragmentShader.replace('#include <map_fragment>', PAINT_HOOK_MAP +
      `\n  if (paintFlake > 0.5) { vec2 fc = floor(vMapUv * 1400.0); float fh = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453); diffuseColor.rgb += paintM * step(0.93, fh) * 0.35 * (0.6 + paintCol); }`);
    if (!low) sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', PAINT_HOOK_ROUGH);
  };
  m.customProgramCacheKey = () => low ? 'bikepaint-l' : 'bikepaint-s';
  cache.set(key, m); return m;
}
function tyreMatFor(low) {
  if (!low) return BIKE_MODEL.parts.tyreMat;
  if (!BIKE_MODEL.lowTyre) BIKE_MODEL.lowTyre = new THREE.MeshLambertMaterial({ map: BIKE_MODEL.parts.tyreMat.map });
  return BIKE_MODEL.lowTyre;
}
// reflections follow the mood: bright by day, dim at night and in the monsoon
function setBikeEnv(mood, wet) {
  BIKE_MODEL.envI = (1 - 0.35 * (mood ? mood.night : 0)) * (wet ? 0.8 : 1);   // chrome and paint keep their shine at night
  if (!BIKE_MODEL.ready) return;
  for (const m of [BIKE_MODEL.parts.tyreMat, ...BIKE_MODEL.mats.values()]) m.envMapIntensity = BIKE_MODEL.envI;
}
// one part (list of primitives) as a group; pivot group carries the axle position so rotation.x spins it in place
function modelPart(list, pivot, mats, cast = true) {
  const g = new THREE.Group(); if (pivot) g.position.set(...pivot);
  for (const p of list) { const m = new THREE.Mesh(p.g, mats(p.mat)); m.matrixAutoUpdate = false; m.matrix.copy(p.M); m.matrixWorldNeedsUpdate = true; m.castShadow = cast; g.add(m); }
  return g;
}
