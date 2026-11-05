// ───────────────────────── BIKE MODS (visual) ─────────────────────────
// Bolt-on parts for the real bike model, in bike-body space (+z forward, rider's right = -x, axles at z -0.64 / 0.66).
// The stock silencer sits on the right: tip at about (-0.16, 0.29, -0.93), radius ~0.047. Geometry is built once and shared.
const MOD_GEO = {}; const MOD_MAT = {};
function modMats(low) {
  const k = low ? 'l' : 's'; if (MOD_MAT[k]) return MOD_MAT[k];
  const env = BIKE_MODEL.env, std = (o) => low ? new THREE.MeshLambertMaterial({ color: o.color, side: o.side || THREE.FrontSide }) : new THREE.MeshStandardMaterial(Object.assign({ envMap: env, envMapIntensity: 1.2 }, o));
  MOD_MAT[k] = {
    chrome: std({ color: '#f1f2f6', metalness: 1, roughness: 0.14 }),
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
  if (md.kit === 'full') for (const sx of [1, -1]) { const pad = mesh(modGeo('pad', () => new THREE.CapsuleGeometry(0.035, 0.12, 4, 10).rotateX(Math.PI / 2)), M.rubber); pad.position.set(0.15 * sx, 0.78, 0.07); pad.rotation.y = 0.12 * sx; pad.scale.set(0.55, 1.2, 1); }
  return out;
}
