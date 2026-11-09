// ───────────────────────── STREET LIFE + NITRO GATES (every track) ─────────────────────────
// Mumbai's pavements without the crowd: pani puri and vada pav carts, chai tapris, a ganne-ka-ras crusher, bhel carts on
// the sea face, little roadside shrines, BEST bus stops, potted plants and kandils, each with its own bare bulb so a night
// street glows. Nitro strips get a neon gate across the road and a tall light beacon you can read from far away.
const ST_UV = {};
function stRect(name, X, Y, W, H) { ST_UV[name] = [X / 1024, 1 - (Y + H) / 512, (X + W) / 1024, 1 - Y / 512, W / H]; }
function streetTextures() {
  if (TEX.stAtlas) return; ugTextures();
  const [c, x] = mkCanvas(1024, 512); x.fillStyle = '#16141a'; x.fillRect(0, 0, 1024, 512);
  const txt = (s, X, Y, px, fill, o = {}) => { x.font = `${o.w || 800} ${px}px ${o.font || FONT_DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = 16; } if (o.lw) { x.lineJoin = 'round'; x.lineWidth = o.lw; x.strokeStyle = o.stroke || '#000'; x.strokeText(s, X, Y, o.max); } x.fillStyle = fill; x.fillText(s, X, Y, o.max); x.shadowBlur = 0; };
  const board = (X, Y, W, H, bg, edge) => { x.fillStyle = bg; x.fillRect(X, Y, W, H); x.strokeStyle = edge; x.lineWidth = 7; x.strokeRect(X + 6, Y + 6, W - 12, H - 12); };
  board(0, 0, 512, 128, '#ff8a1f', '#7a1f12'); txt('वडा पाव', 150, 60, 62, '#7a1f12', { max: 250 }); txt('VADA PAV', 384, 46, 52, '#ffffff', { font: FONT_NUM, w: 700, lw: 6, stroke: '#7a1f12', max: 220 }); txt('₹ 15', 384, 96, 34, '#ffe066', { font: FONT_NUM, w: 700, max: 200 }); stRect('vadapav', 0, 0, 512, 128);
  board(512, 0, 512, 128, '#c8201e', '#ffd23f'); txt('पानी पुरी', 662, 60, 58, '#ffd23f', { max: 260 }); txt('PANI PURI', 896, 46, 50, '#ffffff', { font: FONT_NUM, w: 700, max: 220 }); txt('6 for ₹ 20', 896, 96, 30, '#ffe066', { font: FONT_NUM, w: 700, max: 200 }); stRect('panipuri', 512, 0, 512, 128);
  board(0, 128, 512, 128, '#2f8a3e', '#e8f5c8'); txt('गन्ने का रस', 150, 188, 50, '#ffffff', { max: 260 }); txt('GANNE KA RAS', 384, 176, 42, '#ffe066', { font: FONT_NUM, w: 700, max: 230 }); txt('thanda · ₹ 20', 384, 222, 26, '#e8f5c8', { w: 700, max: 220 }); stRect('ganna', 0, 128, 512, 128);
  board(512, 128, 512, 128, '#ffd23f', '#1d4fa0'); txt('भेल पुरी', 662, 190, 54, '#1d4fa0', { max: 260 }); txt('BHEL · SEV PURI', 896, 176, 40, '#c8201e', { font: FONT_NUM, w: 700, max: 230 }); txt('chowpatty style', 896, 222, 24, '#1d4fa0', { w: 700, max: 220 }); stRect('bhel', 512, 128, 512, 128);
  { const X = 0, Y = 256, W = 512, H = 128; x.fillStyle = '#05060c'; x.fillRect(X, Y, W, H); x.strokeStyle = '#3fe8ff'; x.lineWidth = 5; x.shadowColor = '#3fe8ff'; x.shadowBlur = 14; x.strokeRect(X + 8, Y + 8, W - 16, H - 16); x.shadowBlur = 0;
    const bolt = (bx, col) => { x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 12; x.beginPath(); x.moveTo(bx + 18, Y + 18); x.lineTo(bx - 8, Y + 70); x.lineTo(bx + 8, Y + 70); x.lineTo(bx - 4, Y + 112); x.lineTo(bx + 26, Y + 54); x.lineTo(bx + 10, Y + 54); x.closePath(); x.fill(); x.shadowBlur = 0; };
    bolt(X + 50, '#ff2e88'); bolt(X + W - 70, '#ff2e88'); txt('NITRO', X + 256, Y + 66, 92, '#e8ffff', { font: FONT_NUM, w: 700, glow: '#3fe8ff', max: 330 }); stRect('nitro', X, Y, W, H); }
  { const X = 512, Y = 256, W = 256, H = 128; board(X, Y, W, H, '#c8201e', '#ffffff'); txt('BUS STOP', X + 128, Y + 50, 44, '#ffffff', { font: FONT_NUM, w: 700, max: 220 }); txt('बस थांबा', X + 128, Y + 94, 30, '#ffe066', { max: 220 }); stRect('best', X, Y, W, H); }
  { const X = 768, Y = 256, W = 256, H = 128; board(X, Y, W, H, '#ffb000', '#8a1022'); txt('चाय', X + 128, Y + 52, 54, '#8a1022', { max: 220 }); txt('CUTTING ₹ 10', X + 128, Y + 98, 30, '#8a1022', { font: FONT_NUM, w: 700, max: 220 }); stRect('chai2', X, Y, W, H); }
  TEX.stAtlas = toTex(c, { aniso: 8 });
  // the Sting can wrap: electric blue into violet, a pink bolt, the name round the can
  { const [c2, y] = mkCanvas(256, 256); const g = y.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#20e0ff'); g.addColorStop(0.55, '#2a50ff'); g.addColorStop(1, '#6a1ad8'); y.fillStyle = g; y.fillRect(0, 0, 256, 256);
    y.fillStyle = '#d8dce4'; y.fillRect(0, 0, 256, 14); y.fillRect(0, 242, 256, 14);
    for (const bx of [36, 164]) { y.fillStyle = '#ff2e88'; y.beginPath(); y.moveTo(bx + 30, 40); y.lineTo(bx - 4, 132); y.lineTo(bx + 18, 132); y.lineTo(bx + 2, 220); y.lineTo(bx + 46, 108); y.lineTo(bx + 24, 108); y.closePath(); y.fill(); }
    y.save(); y.translate(128, 128); y.rotate(-Math.PI / 2); y.font = `700 72px ${FONT_NUM}`; y.textAlign = 'center'; y.textBaseline = 'middle'; y.lineWidth = 8; y.strokeStyle = '#120a30'; y.strokeText('STING', 0, 0); y.fillStyle = '#ffffff'; y.fillText('STING', 0, 0); y.restore();
    TEX.stingCan = toTex(c2, { aniso: 4 }); }
}
const CAN_G = new THREE.CylinderGeometry(0.2, 0.2, 0.58, 18, 1);
const BEAM_G = (() => { const g = new THREE.CylinderGeometry(0.42, 0.42, 1, 10, 1, true).translate(0, 0.5, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return g; })();   // bright at the foot, fading up into the sky

Object.assign(World.prototype, {
  streetInit() {
    if (this.stB) return; streetTextures();
    this.stM = {
      sign: new THREE.MeshLambertMaterial({ map: TEX.stAtlas, emissiveMap: TEX.stAtlas, emissive: 0x777777, side: THREE.DoubleSide }),
      nitro: new THREE.MeshBasicMaterial({ map: TEX.ugNitro, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      beam: new THREE.MeshBasicMaterial({ map: TEX.ugCone, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: true, fog: false }),
      glowPool: new THREE.MeshBasicMaterial({ map: TEX.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    };
    Object.values(this.stM).forEach(m => this.disposables.push(m));
    this.stB = { sign: new Batch(), nitro: new Batch(), beam: new Batch(), glowPool: new Batch() };
  },
  stSign(name, x, y, z, yaw, w, groundY = null) { const uv = ST_UV[name], h = w / uv[4]; this.facing(this.stB.sign, new THREE.Vector3(x, y, z), yaw, w, y, y + h, uv);
    if (groundY !== null) { const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); for (const s of [-1, 1]) { const p = new THREE.Vector3(x, y, z).addScaledVector(l, s * w * 0.38); this.B.props.box(p.x, groundY, p.z, 0.08, y - groundY + 0.05, 0.08, yaw, '#3a3840'); } } return h; },
  stPool(p, r, color) { const a = new THREE.Vector3(p.x - r, p.y, p.z - r), b = new THREE.Vector3(p.x + r, p.y, p.z - r), c = new THREE.Vector3(p.x + r, p.y, p.z + r), d = new THREE.Vector3(p.x - r, p.y, p.z + r); this.stB.glowPool.quad(a, b, c, d, color, [[0, 0], [1, 0], [1, 1], [0, 1]], UP); },
  // a bare bulb on a short flex: glow, halo, a warm pool on the pavement and the road
  stBulb(B, p, color = '#ffd590', r = 3.4) { B.glow.box(p.x, p.y - 0.09, p.z, 0.13, 0.17, 0.13, 0, color); this.lampHeads.push(p.clone()); const g = p.clone(); g.y = 0.2; this.stPool(g, r, '#ffb460'); },
  buildStreet(B) {
    this.streetInit();
    this.buildNitros(B); this.buildStreetLife(B); if (this.buildCrowd) this.buildCrowd();
    const add = (b, mat, ro = 0) => { const m = b.mesh(mat); if (m) { m.renderOrder = ro; this.group.add(m); this.disposables.push(m.geometry); } return m; };
    add(this.stB.sign, this.stM.sign); add(this.stB.nitro, this.stM.nitro, 2); add(this.stB.glowPool, this.stM.glowPool, 2); this.nitroBeams = add(this.stB.beam, this.stM.beam, 5);
  },
  // ── nitro: chevron strip, a neon gate spanning the road, a tall beacon over the strip lane ──
  buildNitros(B) {
    const T = this.track, SB = this.stB, pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3(), p = new THREE.Vector3();
    for (const n of T.nitros || []) { const rows = 4, dl = n.len / rows;
      for (let i = 0; i < rows; i++) { const s0 = n.s + i * dl, s1 = s0 + dl; T.pos(s0, n.d - n.hw, pA, 0.02); T.pos(s1, n.d - n.hw, pB, 0.02); T.pos(s1, n.d + n.hw, pC, 0.02); T.pos(s0, n.d + n.hw, pD, 0.02); SB.nitro.quad(pA, pB, pC, pD, '#ffffff', [[0, i * dl / 2.5], [0, (i + 1) * dl / 2.5], [1, (i + 1) * dl / 2.5], [1, i * dl / 2.5]], UP);
        for (const sg of [-1, 1]) { T.pos(s0 + dl / 2, n.d + sg * (n.hw + 0.12), pA, 0.04); B.glow.box(pA.x, pA.y, pA.z, 0.1, 0.05, dl - 0.1, T.yawAt(s0 + dl / 2), '#3fe8ff'); } }
      this.stPool(T.pos(n.s + n.len / 2, n.d, new THREE.Vector3(), 0.03), 5.5, '#3fc8ff');
      // the gate, a few metres before the strip so you see it framing the lane
      const sg0 = n.s - 3, yaw = T.yawAt(sg0), w = T.wAt(sg0) / 2 + 0.25, H = T.yAt(sg0) > 1.2 ? 5.0 : 5.6, base = T.yAt(sg0);
      for (const sd of [-1, 1]) { T.pos(sg0, sd * w, p, 0); B.props.box(p.x, p.y, p.z, 0.42, 0.5, 0.42, yaw, '#1b1a24'); B.glow.box(p.x, p.y + 0.5, p.z, 0.26, H - 0.5, 0.26, yaw, sd > 0 ? '#ff2e88' : '#3fe8ff'); this.lampHeads.push(p.clone().setY(p.y + H)); }
      T.pos(sg0, 0, p, 0); B.props.box(p.x, p.y + H, p.z, 2 * w + 0.36, 0.42, 0.42, yaw, '#1b1a24');
      for (const [dy, col] of [[-0.02, '#3fe8ff'], [0.4, '#ff2e88']]) { const q = T.pos(sg0 - 0.24, 0, new THREE.Vector3(), 0); B.glow.box(q.x, q.y + H + dy, q.z, 2 * w, 0.1, 0.06, yaw, col); }
      const sc = T.pos(sg0 - 0.26, n.d, new THREE.Vector3(), 0); this.stSign('nitro', sc.x, sc.y + H - 1.15, sc.z, yaw + Math.PI, 3.6);
      // beacon: a slim cyan column you can see over the rooftops
      const bc = T.pos(n.s + n.len / 2, n.d, new THREE.Vector3(), 0); _mat.compose(_s.set(bc.x, base + H + 0.4, bc.z), _q.identity(), _v.set(1, 70, 1)); SB.beam.add(BEAM_G, _mat, new THREE.Color('#3fe8ff'));
      _mat.compose(_s.set(bc.x, base + H + 0.4, bc.z), _q.identity(), _v.set(0.45, 70, 0.45)); SB.beam.add(BEAM_G, _mat, new THREE.Color('#ffffff'));
    }
  },
  // ── stalls, shrines, bus stops, plants along the pavements ──
  buildStreetLife(B) {
    const T = this.track, th = this.theme, sw = SIDEWALK[th], p = new THREE.Vector3();
    if (th === 'flyover' && !T.ug) return;
    const step = th === 'market' ? 30 : th === 'basti' ? 48 : th === 'sea' ? 52 : 40;
    const kinds = th === 'sea' ? ['bhel', 'bhel', 'panipuri', 'ganna', 'busstop', 'shrine', 'plants'] : th === 'basti' ? ['shrine', 'plants', 'plants', 'chai'] : th === 'market' ? ['panipuri', 'vadapav', 'ganna', 'chai', 'fruit', 'shrine', 'vadapav', 'panipuri'] : ['panipuri', 'vadapav', 'busstop', 'chai', 'ganna', 'shrine', 'vadapav', 'plants', 'busstop', 'panipuri'];
    let k = 0, side = 1;
    for (let s = 46; s < T.L - 30; s += step * (0.8 + RNG() * 0.45)) {
      side = -side; const w = T.wAt(s) / 2, yaw = T.yawAt(s);
      if (T.yAt(s) > 0.6 || T.hallAt(s) || (T.stairsZone && T.stairsZone(s)) || (T.nala && Math.abs(T.wrapD(s - T.nala.s0 - T.nala.len / 2)) < 40) || (this.ugSkip && this.ugSkip(s, 'clutter'))) continue;
      if (T.kickers.some(q => Math.abs(T.wrapD(s - q.s)) < 26) || T.shortcuts.some(sc => Math.abs(T.wrapD(s - sc.s)) < sc.half + 8) || T.nakas.some(n => Math.abs(T.wrapD(s - n.s)) < 45) || (T.nitros || []).some(n => Math.abs(T.wrapD(s - n.s)) < 14)) continue;
      if (this.obstacles.some(o => Math.abs(T.wrapD(o.s - s)) < 6 && Math.sign(o.d) === side)) continue;
      const kind = kinds[k++ % kinds.length], narrow = sw < 2;
      if (narrow && !['shrine', 'plants', 'chai'].includes(kind)) continue;
      const off = narrow ? w + 0.45 + 0.35 : w + 0.45 + Math.max(sw * 0.62, sw - 0.8);
      T.pos(s, side * off, p, 0); if (T.clearance(p.x, p.z) < off - w - 0.6 || this.isSea(p.x - 3)) continue;
      const gy = narrow ? T.yAt(s) : 0.18, face = yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2);   // face = towards the road
      this.stall(B, kind, p.x, gy, p.z, yaw, face, side); this.stallCount = (this.stallCount || 0) + 1; (this.stallSpots || (this.stallSpots = [])).push({ s, side, kind });
    }
  },
  stall(B, kind, x, y, z, yaw, face, side) {
    const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), tr = new THREE.Vector3(Math.sin(face), 0, Math.cos(face)); const at = (a, b) => new THREE.Vector3(x, y, z).addScaledVector(fw, a).addScaledVector(tr, b);
    const wheels = (half, r = 0.26) => { for (const a of [-half, half]) for (const b of [-0.42, 0.42]) { const q = at(a * 0.75, b); B.props.geom(WHEEL_G, q.x, y + r, q.z, yaw, 1.3, r / 0.22, r / 0.22, '#1d1d1d'); } };
    const canopy = (len, wid, h, col) => { for (const a of [-len / 2 + 0.1, len / 2 - 0.1]) for (const b of [-wid / 2 + 0.06, wid / 2 - 0.06]) { const q = at(a, b); B.props.box(q.x, y, q.z, 0.05, h, 0.05, yaw, '#5a5a60'); }
      const c0 = at(-len / 2 - 0.15, -wid / 2 - 0.2).setY(y + h + 0.12), c1 = at(len / 2 + 0.15, -wid / 2 - 0.2).setY(y + h + 0.12), c2 = at(len / 2 + 0.15, wid / 2 + 0.15).setY(y + h - 0.05), c3 = at(-len / 2 - 0.15, wid / 2 + 0.15).setY(y + h - 0.05); B.tarp.quad(c0, c1, c2, c3, col); };
    if (kind === 'panipuri' || kind === 'bhel') {
      let q = at(0, 0); B.props.box(q.x, y + 0.42, q.z, 1.0, 0.5, 1.8, yaw, kind === 'bhel' ? '#c8201e' : '#3a6ea5'); wheels(0.8);
      B.props.box(q.x, y + 0.92, q.z, 0.86, 0.48, 1.0, yaw, '#bfe6f0');   // glass case of puris
      for (let i = 0; i < 14; i++) B.props.geom(BLOB, q.x + (RNG() - 0.5) * 0.6, y + 1.0 + RNG() * 0.25, q.z + (RNG() - 0.5) * 0.8, RNG() * 6, 0.08, 0.06, 0.08, '#e0b060');
      q = at(0.62, 0.05); B.props.geom(TANK_G, q.x, y + 0.92, q.z, 0, 0.32, 0.36, 0.32, '#c8ccd2'); q = at(-0.62, 0.05); B.props.geom(TANK_G, q.x, y + 0.92, q.z, 0, 0.26, 0.3, 0.26, '#8a5a32');
      canopy(1.9, 1.2, 2.05, kind === 'bhel' ? '#ffd23f' : '#c8201e'); q = at(0, 0.55); this.stSign(kind, q.x, y + 2.2, q.z, face, 1.6);
      this.stBulb(B, at(0, 0.1).setY(y + 1.9));
    } else if (kind === 'vadapav' || kind === 'chai') {
      let q = at(0, -0.1); B.props.box(q.x, y, q.z, 1.2, 1.0, 2.2, yaw, '#7a4a2a'); B.props.box(q.x, y + 1.0, q.z, 1.25, 0.06, 2.25, yaw, '#c8a26a');
      q = at(0, -0.62); B.props.box(q.x, y + 1.06, q.z, 0.08, 1.3, 2.2, yaw, '#5a3a22');
      if (kind === 'vadapav') { q = at(-0.45, 0); B.props.geom(DISH_G, q.x, y + 1.1, q.z, 0, 0.9, 0.5, 0.9, '#1a1a1a'); for (let i = 0; i < 9; i++) B.props.geom(BLOB, q.x + (RNG() - 0.5) * 0.3, y + 1.16, q.z + (RNG() - 0.5) * 0.3, RNG() * 6, 0.07, 0.06, 0.07, '#c87a2a');
        for (let i = 0; i < 6; i++) { const r = at(0.35 + (i % 2) * 0.2, -0.1 + Math.floor(i / 2) * 0.16); B.props.box(r.x, y + 1.06, r.z, 0.14, 0.08, 0.14, yaw, '#e8c890'); } }
      else { q = at(-0.3, 0); B.props.geom(TANK_G, q.x, y + 1.06, q.z, 0, 0.22, 0.32, 0.22, '#b8bcc4'); for (let i = 0; i < 5; i++) { const r = at(0.2 + i * 0.12, 0.15); B.props.geom(CUP_G, r.x, y + 1.06, r.z, 0, 1.4, 1.4, 1.4, '#d8b070'); } }
      const tin0 = at(-1.3, -0.7).setY(y + 2.35), tin1 = at(1.3, -0.7).setY(y + 2.35), tin2 = at(1.3, 0.75).setY(y + 2.05), tin3 = at(-1.3, 0.75).setY(y + 2.05); B.tin.quad(tin0, tin1, tin2, tin3, '#ffffff');
      q = at(0, 0.78); if (kind === 'vadapav') this.stSign('vadapav', q.x, y + 2.15, q.z, face, 2.0); else this.stSign('chai2', q.x, y + 2.1, q.z, face, 1.3);
      this.stBulb(B, at(0.2, 0.3).setY(y + 1.95));
      for (let i = 0; i < 3; i++) { const r = at(-0.9 + i * 0.9, 1.05); B.props.box(r.x, y, r.z, 0.32, 0.45, 0.32, yaw, pick(['#2f6fb8', '#c8201e', '#2f8a3e'])); }   // plastic stools
    } else if (kind === 'ganna') {
      let q = at(0, 0); B.props.box(q.x, y + 0.42, q.z, 1.0, 0.45, 1.7, yaw, '#2f8a3e'); wheels(0.75);
      q = at(0.3, 0); B.props.geom(CLOCK_G, q.x, y + 1.25, q.z, yaw + Math.PI / 2, 1.3, 1.3, 1.3, '#3a6a3a', Math.PI / 2); B.props.box(q.x, y + 0.86, q.z, 0.5, 0.5, 0.5, yaw, '#5a8a5a');
      for (let i = 0; i < 10; i++) { const r = at(-0.55 + (RNG() - 0.5) * 0.3, -0.25 + i * 0.05); this.beam(B.props, r.clone().setY(y + 0.9), r.clone().setY(y + 2.3 + RNG() * 0.3).addScaledVector(fw, 0.15), 0.04, '#b8b060'); }
      q = at(-0.5, 0.45); this.stSign('ganna', q.x, y + 2.0, q.z, face, 1.5, y + 0.9); this.stBulb(B, at(0.2, 0.3).setY(y + 2.2));
    } else if (kind === 'fruit') {
      let q = at(0, 0); B.props.box(q.x, y + 0.5, q.z, 1.1, 0.12, 2.0, yaw, '#8a5a32'); wheels(0.8, 0.3);
      for (let i = 0; i < 26; i++) B.props.geom(BLOB, q.x + (RNG() - 0.5) * 0.9, y + 0.66 + RNG() * 0.25, q.z + (RNG() - 0.5) * 1.7, RNG() * 6, 0.12, 0.12, 0.12, pick(['#ff7a2f', '#ffd23f', '#d43c2c', '#9be15d', '#2f8a3e']));
      canopy(2.0, 1.2, 1.9, '#1d4fa0'); this.stBulb(B, at(0, 0).setY(y + 1.8));
    } else if (kind === 'shrine') {
      let q = at(0, -0.2); B.props.box(q.x, y, q.z, 0.9, 0.7, 0.9, yaw, '#e8e2d6'); B.props.box(q.x, y + 0.7, q.z, 0.7, 0.75, 0.7, yaw, '#ff7a1f'); B.props.geom(DOME_G, q.x, y + 1.45, q.z, 0, 0.42, 0.55, 0.42, '#ff8a1f');
      B.props.box(q.x, y + 1.95, q.z, 0.05, 0.9, 0.05, 0, '#8a6a3a'); const f0 = new THREE.Vector3(q.x, y + 2.8, q.z), f1 = f0.clone().addScaledVector(fw, 0.7).setY(y + 2.62), f2 = f0.clone().setY(y + 2.45); B.props.quad(f0, f1, f2, f2.clone(), '#ff6a00');
      for (let i = 0; i < 7; i++) { const r = at(-0.33 + i * 0.11, 0.26); B.props.geom(BLOB, r.x, y + 1.32 - Math.sin(i / 6 * Math.PI) * 0.12, r.z, 0, 0.05, 0.05, 0.05, i % 2 ? '#ffb000' : '#ff6a00'); }
      const dy = at(0, 0.3); B.glow.box(dy.x, y + 0.92, dy.z, 0.1, 0.08, 0.1, 0, '#ffb040'); this.lampHeads.push(dy.clone().setY(y + 1.0)); this.stPool(dy.clone().setY(0.2), 2.6, '#ff9a30');
    } else if (kind === 'busstop') {
      for (const a of [-1.5, 1.5]) { const q = at(a, -0.35); B.props.box(q.x, y, q.z, 0.08, 2.45, 0.08, yaw, '#c8201e'); }
      let q = at(0, -0.1); B.props.box(q.x, y + 2.45, q.z, 3.3, 0.1, 1.5, yaw, '#c8201e'); q = at(0, -0.62); B.props.box(q.x, y + 0.5, q.z, 3.1, 1.7, 0.05, yaw, '#5a6a78');
      q = at(0, -0.4); B.props.box(q.x, y + 0.42, q.z, 2.6, 0.06, 0.4, yaw, '#8a8a90'); const lt = at(0, -0.1); B.glow.box(lt.x, y + 2.38, lt.z, 2.4, 0.05, 0.12, yaw, '#eef6ff'); this.lampHeads.push(lt.clone().setY(y + 2.3)); this.stPool(lt.clone().setY(0.2), 3.6, '#dfe8ff');
      q = at(2.0, 0.2); this.stSign('best', q.x, y + 2.0, q.z, face, 0.9, y);
    } else if (kind === 'plants') {
      for (let i = 0; i < 3; i++) { const q = at(-0.9 + i * 0.9 + (RNG() - 0.5) * 0.2, (RNG() - 0.5) * 0.3); B.props.geom(TANK_G, q.x, y, q.z, 0, 0.32, 0.42, 0.32, '#b5522e');
        for (let j = 0; j < 3; j++) B.props.geom(BLOB, q.x + (RNG() - 0.5) * 0.3, y + 0.55 + RNG() * 0.3, q.z + (RNG() - 0.5) * 0.3, RNG() * 6, 0.26, 0.24, 0.26, pick(['#3f7a2f', '#2f6a28', '#4f8a35'])); }
      const q = at(0, -0.4); for (let j = 0; j < 5; j++) B.props.geom(BLOB, q.x + (RNG() - 0.5) * 1.6, y + 0.4 + RNG() * 1.2, q.z + (RNG() - 0.5) * 0.4, RNG() * 6, 0.35, 0.3, 0.35, pick(['#ff3d9a', '#e83a8a', '#3f7a2f']));   // bougainvillea
    }
  },
});
