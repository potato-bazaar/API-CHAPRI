// ───────────────────────── BIKE MODS (visual) ─────────────────────────
// Bolt-on parts for the real bike model, in bike-body space (+z forward, rider's right = -x, axles at z -0.64 / 0.66).
// The stock silencer sits on the right: tip at about (-0.16, 0.29, -0.93), radius ~0.047. Geometry is built once and shared.
const MOD_GEO = {}; const MOD_MAT = {};
function modMats(low) {
  const k = low ? 'l' : 's'; if (MOD_MAT[k]) return MOD_MAT[k];
  const env = BIKE_MODEL.env, std = (o) => low ? new THREE.MeshLambertMaterial({ color: o.color, side: o.side || THREE.FrontSide }) : new THREE.MeshStandardMaterial(Object.assign({ envMap: env, envMapIntensity: 1.2 }, o));
  MOD_MAT[k] = {
    chrome: std({ color: '#cdd1d9', metalness: 1, roughness: 0.24, envMapIntensity: 0.75 }),   // a touch duller than mirror so it doesn't bloom to white
    blued: low ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.95, roughness: 0.26, envMap: env, envMapIntensity: 1.1 }),   // heat-blued chamber
    black: std({ color: '#1c1c20', metalness: 0.35, roughness: 0.5 }),
    rubber: std({ color: '#151515', metalness: 0, roughness: 0.9 }),
    smoke: low ? new THREE.MeshLambertMaterial({ color: '#2a3446', transparent: true, opacity: 0.6, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: '#1a2333', metalness: 0.6, roughness: 0.08, transparent: true, opacity: 0.55, side: THREE.DoubleSide, envMap: env }),
    lamp: new THREE.MeshBasicMaterial({ color: '#fff4cf' }),
    ember: new THREE.MeshBasicMaterial({ color: '#ff5a1f' }),
    flame: new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };
  return MOD_MAT[k];
}
function modGeo(key, make) { return MOD_GEO[key] || (MOD_GEO[key] = make()); }
// a tapered pipe whose front end is at the origin, running backwards (-z) and tilted up by `tilt`
function pipeGeo(rF, rR, len, tilt) { return new THREE.CylinderGeometry(rR, rF, len, 20, 1, false).translate(0, len / 2, 0).rotateX(-Math.PI / 2).rotateX(tilt); }
function ringGeo(r, tube) { return new THREE.TorusGeometry(r, tube, 8, 22); }
// expansion chamber: a lathe along -z (tilted up like the stock can), heat colours from gold at the header to blue at the stinger
function chamberGeo() {
  const prof = [[0.044, 0], [0.05, 0.05], [0.07, 0.12], [0.09, 0.21], [0.097, 0.29], [0.094, 0.36], [0.075, 0.43], [0.045, 0.5], [0.026, 0.53], [0.024, 0.62]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const P = g.attributes.position, C = new Float32Array(P.count * 3), stops = [[0, '#d4a74c'], [0.14, '#c98a3c'], [0.26, '#8a4f9e'], [0.4, '#4a5fb4'], [0.52, '#3b4f8a'], [0.62, '#5a6170']].map(([u, h]) => [u, new THREE.Color(h)]);
  const tmp = new THREE.Color();
  for (let i = 0; i < P.count; i++) { const u = P.getY(i); let k = 0; while (k < stops.length - 2 && u > stops[k + 1][0]) k++; const [u0, c0] = stops[k], [u1, c1] = stops[k + 1]; tmp.copy(c0).lerp(c1, clamp((u - u0) / (u1 - u0), 0, 1)); C[i * 3] = tmp.r; C[i * 3 + 1] = tmp.g; C[i * 3 + 2] = tmp.b; }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return g.rotateX(-Math.PI / 2).rotateX(0.085);
}
function placeAtEnd(mesh, front, len, tilt) { mesh.position.set(front[0], front[1] + Math.sin(tilt) * len, front[2] - Math.cos(tilt) * len); mesh.rotation.x = tilt; return mesh; }

// adds the mods in o.mods to a BikeRig built on the real model; returns state the rig animates (flame, lift)
function addBikeMods(rig, o, low, cast) {
  const md = o.mods || {}, M = modMats(low), out = { lift: 0, flames: [] }, g = new THREE.Group(); rig.body.add(g); rig.modG = g;
  const mesh = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast && mat !== M.flame && mat !== M.lamp; parent.add(m); return m; };
  // ── silencers ──
  const silencer = (side, front, rF, rR, len, tilt, body, tipMat, glow) => {
    const f = [front[0] * side, front[1], front[2]];
    const p = mesh(modGeo(`p${rF}_${rR}_${len}_${tilt}`, () => pipeGeo(rF, rR, len, tilt)), body); p.position.set(...f);
    placeAtEnd(mesh(modGeo(`r${rR}`, () => ringGeo(rR * 0.97, 0.011)), tipMat), f, len, tilt);
    const disc = placeAtEnd(mesh(modGeo(`d${rR}`, () => new THREE.CircleGeometry(rR * 0.86, 18).rotateY(Math.PI)), glow ? M.ember : M.black), f, len - 0.012, tilt);
    if (glow) { const fl = placeAtEnd(mesh(modGeo('flame', () => new THREE.ConeGeometry(0.075, 0.55, 12, 1, true).translate(0, 0.275, 0).rotateX(-Math.PI / 2)), M.flame), f, len, tilt); fl.visible = false; out.flames.push(fl); }
    return disc;
  };
  if (md.exhaust === 'long') silencer(-1, [0.165, 0.295, -0.42], 0.05, 0.074, 0.9, 0.07, M.chrome, M.chrome);
  else if (md.exhaust === 'twin') { silencer(-1, [0.17, 0.3, -0.36], 0.046, 0.06, 0.78, 0.3, M.chrome, M.chrome); silencer(1, [0.19, 0.3, -0.36], 0.046, 0.06, 0.78, 0.3, M.chrome, M.chrome); }
  else if (md.exhaust === 'dragon') silencer(-1, [0.168, 0.3, -0.5], 0.052, 0.098, 0.56, 0.1, M.black, M.chrome, true);
  else if (md.exhaust === 'free') silencer(-1, [0.16, 0.287, -0.88], 0.027, 0.029, 0.25, 0.08, M.chrome, M.chrome);   // the welded "cut silencer" pipe out of the stock can
  else if (md.exhaust === 'chamber') {
    // a real expansion chamber swallowing the stock can: divergent cone, belly, convergent cone, thin stinger, small silencer
    const f = [-0.166, 0.243, -0.35], tilt = 0.085;
    const c = mesh(modGeo('chamber', chamberGeo), M.blued); c.position.set(...f);
    const can = mesh(modGeo('chamberCan', () => pipeGeo(0.036, 0.038, 0.19, tilt)), M.black); placeAtEnd(can, f, 0.6, tilt);
    const cf = [f[0], f[1] + Math.sin(tilt) * 0.6, f[2] - Math.cos(tilt) * 0.6];
    placeAtEnd(mesh(modGeo('r0.038', () => ringGeo(0.038 * 0.97, 0.009)), M.chrome), cf, 0.19, tilt);
    placeAtEnd(mesh(modGeo('d0.03', () => new THREE.CircleGeometry(0.022, 14).rotateY(Math.PI)), M.black), cf, 0.19 + 0.004, tilt);
  }
  // ── tyres: wider (and a touch taller) wheels; the body rides up so they still touch the road ──
  const tw = { fat: [1.75, 1.05, 1.5, 1.04], racing: [1.3, 1.0, 1.2, 1.0] }[md.tyres];
  if (tw) { rig.wheelR.scale.set(tw[0], tw[1], tw[1]); rig.wheelF.scale.set(tw[2], tw[3], tw[3]); out.lift = WHEEL_R_M * ((tw[1] + tw[3]) / 2 - 1); }
  // ── body kits ──
  const guard = md.kit === 'guard' || md.kit === 'full', cowl = md.kit === 'cafe' || md.kit === 'full';
  if (guard) {
    for (const sx of [1, -1]) {
      mesh(modGeo('guard' + sx, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.12, 0.28, 0.24], [0.29, 0.31, 0.33], [0.35, 0.47, 0.37], [0.3, 0.62, 0.38], [0.13, 0.68, 0.39]].map(([x, y, z]) => new THREE.Vector3(x * sx, y, z))), 32, 0.022, 10, false)), M.chrome);
      const h = mesh(modGeo('foghouse', () => new THREE.CylinderGeometry(0.058, 0.046, 0.08, 20).rotateX(Math.PI / 2)), M.chrome); h.position.set(0.33 * sx, 0.5, 0.41);
      const l = mesh(modGeo('foglens', () => new THREE.CircleGeometry(0.05, 20)), M.lamp); l.position.set(0.33 * sx, 0.5, 0.452);
    }
  }
  if (cowl) {
    const H = MODEL_FIT.head, pm = low ? new THREE.MeshLambertMaterial({ color: o.tank, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: o.tank, metalness: 0.35, roughness: 0.3, envMap: BIKE_MODEL.env, side: THREE.DoubleSide });
    out.ownMats = [pm];
    // bikini fairing: a short shell hugging the headlight (open at the bottom), a black rim and a raked smoked screen
    const c = mesh(modGeo('cowl', () => new THREE.CylinderGeometry(0.118, 0.098, 0.15, 26, 1, true, 0.7, Math.PI * 2 - 1.4).rotateX(Math.PI / 2)), pm); c.position.set(H[0], H[1] + 0.005, H[2] + 0.005);
    const rim = mesh(modGeo('cowlrim', () => new THREE.TorusGeometry(0.117, 0.009, 6, 26, Math.PI * 2 - 1.4).rotateZ(-Math.PI / 2 + 0.7)), M.black); rim.position.set(H[0], H[1] + 0.005, H[2] + 0.08);
    const v = mesh(modGeo('visor', () => new THREE.CylinderGeometry(0.12, 0.12, 0.13, 14, 1, true, -0.7, 1.4).translate(0, 0.065, 0)), M.smoke); v.position.set(H[0], H[1] + 0.09, H[2] - 0.045); v.rotation.x = -0.55;
  }
  // police bike: a rear rack with a red-blue light bar that flashes, and a white crash guard
  if (md.kit === 'police') {
    mesh(modGeo('prack', () => new THREE.BoxGeometry(0.34, 0.03, 0.3)), M.black).position.set(0, 0.95, -0.82);
    const pole = mesh(modGeo('ppole', () => new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6)), M.chrome); pole.position.set(0, 1.16, -0.86);
    mesh(modGeo('pbar', () => new THREE.BoxGeometry(0.36, 0.06, 0.1)), M.black).position.set(0, 1.39, -0.86);
    out.siren = [['#ff1e2e', -0.1], ['#2a58ff', 0.1]].map(([col, x]) => { const m = new THREE.Mesh(modGeo('plamp', () => new THREE.BoxGeometry(0.15, 0.09, 0.11)), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x, 1.45, -0.86); g.add(m); (out.ownMats = out.ownMats || []).push(m.material); return m; });
    out.sirenPh = Math.random();
    for (const sx of [1, -1]) mesh(modGeo('pguard' + sx, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.12, 0.3, 0.26], [0.28, 0.34, 0.33], [0.3, 0.5, 0.36], [0.14, 0.64, 0.38]].map(([x, y, z]) => new THREE.Vector3(x * sx, y, z))), 20, 0.018, 8, false)), M.chrome);
  }
  if (md.kit === 'full') for (const sx of [1, -1]) { const pad = mesh(modGeo('pad', () => new THREE.CapsuleGeometry(0.035, 0.12, 4, 10).rotateX(Math.PI / 2)), M.rubber); pad.position.set(0.15 * sx, 0.78, 0.07); pad.rotation.y = 0.12 * sx; pad.scale.set(0.55, 1.2, 1); }
  return out;
}
