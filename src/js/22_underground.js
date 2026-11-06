// ───────────────────────── MUMBAI UNDERGROUND: the main map's set pieces ─────────────────────────
// A metro viaduct and a station straddling the start grid, with a trial-run train; Andheri Tunnel (sodium light
// strips, jet fans, lane signals, a burst water main you ride through); the underpass cut with graffiti walls and two
// overbridges; the LED chevron hairpin; the docks (container stacks, ship-to-shore cranes, floodlight towers, a ship);
// the unfinished metro bridge with its gap, rebar and tower crane; the salt-pan kachha road (pylons, fences, fog,
// a HORN OK PLEASE truck); market neon and festoon bulbs. Runtime: scrolling LEDs / nitro / water, blinkers, the
// metro, cranes, storm lightning, and the tunnel dimming the sky light.
// Palette: indigo-brown darkness, sodium orange for working light, pink + cyan only for guidance, marigold hazard.
const UG_UV = {};
const UG = { sodium: '#ffb459', hot: '#ffe0a8', pink: '#ff2e88', cyan: '#3fd0c9', mari: '#ffc21a', ink: '#141218', conc: '#77727a', concD: '#4a4650' };
const FAN_G = new THREE.CylinderGeometry(0.55, 0.55, 2.6, 12).rotateX(Math.PI / 2);
const PIPE_G = new THREE.CylinderGeometry(0.32, 0.32, 1, 10).rotateZ(Math.PI / 2);
const CONEFX_G = new THREE.ConeGeometry(1, 1, 18, 1, true).translate(0, -0.5, 0).rotateX(Math.PI);   // apex at the origin, base at y = +1
function ugRect(name, X, Y, W, H) { UG_UV[name] = [X / 1024, 1 - (Y + H) / 1024, (X + W) / 1024, 1 - Y / 1024, W / H]; }

function ugTextures() {
  if (TEX.ugAtlas) return;
  const [c, x] = mkCanvas(1024, 1024); x.fillStyle = '#16141a'; x.fillRect(0, 0, 1024, 1024);
  const txt = (s, X, Y, px, fill, o = {}) => { x.font = `${o.italic ? 'italic ' : ''}${o.w || 800} ${px}px ${o.font || FONT_DISPLAY}`; x.textAlign = o.align || 'center'; x.textBaseline = 'middle';
    if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.blur || 18; }
    if (o.lw) { x.lineJoin = 'round'; x.lineWidth = o.lw; x.strokeStyle = o.stroke || '#000'; x.strokeText(s, X, Y, o.max); }
    x.fillStyle = fill; x.fillText(s, X, Y, o.max); x.shadowBlur = 0; };
  const grain = (X, Y, W, H, n, a) => { x.save(); x.translate(X, Y); x.beginPath(); x.rect(0, 0, W, H); x.clip(); noise(x, W, H, n, a, ['#000', '#ffffff', '#000']); x.restore(); };
  const stripes = (X, Y, W, H, a = '#ffc21a', b = '#141218', k = 28) => { x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip(); x.fillStyle = a; x.fillRect(X, Y, W, H); x.fillStyle = b; for (let i = -H; i < W + H; i += k * 2) { x.beginPath(); x.moveTo(X + i, Y + H); x.lineTo(X + i + k, Y + H); x.lineTo(X + i + k + H, Y); x.lineTo(X + i + H, Y); x.closePath(); x.fill(); } x.restore(); };
  // Andheri Tunnel portal board
  { const X = 0, Y = 0, W = 1024, H = 160; x.fillStyle = '#0c4f31'; x.fillRect(X, Y, W, H); x.strokeStyle = '#f2f2f2'; x.lineWidth = 7; x.strokeRect(X + 9, Y + 9, W - 18, H - 18);
    txt('अंधेरी सुरंग', X + 232, Y + 84, 74, '#ffffff', { max: 400 }); x.fillStyle = '#f2f2f2'; x.fillRect(X + 448, Y + 26, 5, H - 52);
    txt('ANDHERI TUNNEL', X + 736, Y + 66, 92, '#ffffff', { font: FONT_NUM, w: 700, max: 540 }); txt('HORN MAT BAJAO · हॉर्न मत बजाओ', X + 736, Y + 128, 28, '#ffd23f', { w: 700, max: 540 }); ugRect('tunnel', X, Y, W, H); }
  // graffiti panels
  const graf = (X, bg, l1, l2, c1, c2, rot, crown) => { const Y = 160, W = 256, H = 256; const g = x.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(X, Y, W, H);
    grain(X, Y, W, H, 2200, 0.22);
    for (let i = 0; i < 14; i++) { const px = X + Math.random() * W, py = Y + Math.random() * H, r = 8 + Math.random() * 30, gg = x.createRadialGradient(px, py, 0, px, py, r); const cc = pick(['255,46,136', '63,208,201', '255,210,63', '155,225,93', '255,255,255']); gg.addColorStop(0, `rgba(${cc},0.55)`); gg.addColorStop(1, `rgba(${cc},0)`); x.fillStyle = gg; x.fillRect(px - r, py - r, r * 2, r * 2); }
    x.save(); x.translate(X + W / 2, Y + H / 2 + 8); x.rotate(rot);
    txt(l1, 0, -40, 62, c1, { lw: 12, stroke: '#140a14', max: 230 }); txt(l2, 4, 34, 70, c2, { lw: 12, stroke: '#140a14', max: 236 });
    x.fillStyle = c2; for (let i = 0; i < 7; i++) { const dx = -90 + Math.random() * 180, dl = 14 + Math.random() * 40; x.fillRect(dx, 64, 3, dl); x.beginPath(); x.arc(dx + 1.5, 64 + dl, 3, 0, 7); x.fill(); }
    x.restore(); if (crown) drawCrown(x, X + W / 2, Y + 38, 64, '#ffc21a', '#140a14'); };
  graf(0, ['#4b1d77', '#c2185b'], 'CHAPRI', 'ZINDABAD', '#ffd23f', '#ffffff', -0.12, false); ugRect('g0', 0, 160, 256, 256);
  graf(256, ['#13304a', '#1d6f8a'], 'GALI KA', 'RAJA', '#3fe0ff', '#ffc21a', 0.08, true); ugRect('g1', 256, 160, 256, 256);
  graf(512, ['#0e5a52', '#2a8a6a'], 'RX100', '4 LIFE', '#ff2e88', '#ffe066', -0.06, false); ugRect('g2', 512, 160, 256, 256);
  graf(768, ['#c6531e', '#ffb02e'], 'BHAI', 'LOG', '#ffffff', '#1b0d22', 0.1, false); ugRect('g3', 768, 160, 256, 256);
  // construction / danger / UDAAN boards
  { const X = 0, Y = 416, W = 512, H = 128; x.fillStyle = '#ffd21a'; x.fillRect(X, Y, W, H); stripes(X, Y, 60, H); stripes(X + W - 60, Y, 60, H);
    txt('काम चालू है', X + 256, Y + 44, 50, '#141218', { max: 360 }); txt('KAAM CHALU HAI', X + 256, Y + 98, 40, '#c8321e', { font: FONT_NUM, w: 700, max: 360 }); ugRect('kaam', X, Y, W, H); }
  { const X = 512, Y = 416, W = 512, H = 128; const g = x.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, '#ff7a1f'); g.addColorStop(0.55, '#ff2e88'); g.addColorStop(1, '#5b1d86'); x.fillStyle = g; x.fillRect(X, Y, W, H);
    for (let i = 0; i < 9; i++) { x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 3; x.beginPath(); x.moveTo(X + 30 + i * 52, Y + H); x.lineTo(X + 70 + i * 52, Y); x.stroke(); }
    txt('UDAAN!', X + 222, Y + 62, 104, '#ffffff', { italic: true, lw: 14, stroke: '#1b0d22', font: FONT_NUM, w: 700, max: 380 }); txt('ek jump · full izzat', X + 222, Y + 112, 24, '#ffe9a8', { w: 700, max: 380 });
    drawCrown(x, X + 446, Y + 64, 70, '#ffc21a', '#1b0d22'); ugRect('udaan', X, Y, W, H); }
  { const X = 0, Y = 544, W = 512, H = 128; x.fillStyle = '#c8121e'; x.fillRect(X, Y, W, H); x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.strokeRect(X + 8, Y + 8, W - 16, H - 16);
    x.fillStyle = '#ffd21a'; x.beginPath(); x.moveTo(X + 70, Y + 22); x.lineTo(X + 118, Y + 104); x.lineTo(X + 22, Y + 104); x.closePath(); x.fill(); x.fillStyle = '#141218'; x.fillRect(X + 66, Y + 46, 8, 34); x.fillRect(X + 66, Y + 86, 8, 8);
    txt('ADHOORA PUL', X + 314, Y + 50, 64, '#ffffff', { font: FONT_NUM, w: 700, max: 350 }); txt('आगे पुल अधूरा है · JUMP AT OWN RISK', X + 314, Y + 100, 22, '#ffe066', { w: 700, max: 356 }); ugRect('pul', X, Y, W, H); }
  { const X = 512, Y = 544, W = 512, H = 128; x.fillStyle = '#123a6e'; x.fillRect(X, Y, W, H); x.fillStyle = '#ffffff'; x.fillRect(X, Y + H - 18, W, 6);
    txt('MUMBAI PORT · DOCK 7', X + 256, Y + 50, 54, '#ffffff', { font: FONT_NUM, w: 700, max: 470 }); txt('मुंबई बंदरगाह · NO ENTRY AFTER 10 PM', X + 256, Y + 92, 22, '#9fd8ff', { w: 700, max: 470 }); ugRect('dock', X, Y, W, H); }
  { const X = 0, Y = 672, W = 512, H = 128; x.fillStyle = '#6b4a2a'; x.fillRect(X, Y, W, H); grain(X, Y, W, H, 1600, 0.3); x.strokeStyle = '#e8d9b8'; x.lineWidth = 5; x.strokeRect(X + 8, Y + 8, W - 16, H - 16);
    txt('NAMAK KHET', X + 256, Y + 50, 60, '#fff3d6', { font: FONT_NUM, w: 700, max: 460 }); txt('KACHHA RASTA · DHOOL MILEGI', X + 256, Y + 98, 26, '#ffd23f', { w: 700, max: 460 }); ugRect('salt', X, Y, W, H); }
  { const X = 512, Y = 672, W = 512, H = 128; x.fillStyle = '#10142a'; x.fillRect(X, Y, W, H); x.fillStyle = '#ff2e88'; x.fillRect(X, Y + 96, W, 10); x.fillStyle = '#3fd0c9'; x.fillRect(X, Y + 110, W, 8);
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(X + 70, Y + 50, 38, 0, 7); x.fill(); txt('M', X + 70, Y + 54, 56, '#10142a', { font: FONT_NUM, w: 700 });
    txt('अंधेरी', X + 200, Y + 50, 52, '#ffffff', { max: 150 }); txt('ANDHERI', X + 388, Y + 52, 64, '#ffffff', { font: FONT_NUM, w: 700, max: 220 }); ugRect('metro', X, Y, W, H); }
  // neon
  { const X = 0, Y = 800, W = 512, H = 112; x.fillStyle = '#0b0710'; x.fillRect(X, Y, W, H); x.strokeStyle = '#ff2e88'; x.lineWidth = 4; x.shadowColor = '#ff2e88'; x.shadowBlur = 14; x.strokeRect(X + 10, Y + 10, W - 20, H - 20); x.shadowBlur = 0;
    txt('DHINCHAK DHABA', X + 256, Y + 58, 62, '#ffd0ea', { glow: '#ff2e88', blur: 22, font: FONT_NUM, w: 700, max: 460 }); ugRect('neon1', X, Y, W, H); }
  { const X = 512, Y = 800, W = 512, H = 112; x.fillStyle = '#060c10'; x.fillRect(X, Y, W, H); x.strokeStyle = '#3fe0ff'; x.lineWidth = 4; x.shadowColor = '#3fe0ff'; x.shadowBlur = 14; x.strokeRect(X + 10, Y + 10, W - 20, H - 20); x.shadowBlur = 0;
    txt('BHAI KI CHAI · 24×7', X + 256, Y + 58, 56, '#d8fbff', { glow: '#3fe0ff', blur: 22, font: FONT_NUM, w: 700, max: 460 }); ugRect('neon2', X, Y, W, H); }
  // small boards
  { const X = 0, Y = 912, W = 128, H = 112; x.fillStyle = '#1f8a4c'; x.fillRect(X, Y, W, H); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(X + 6, Y + 6, W - 12, H - 12); txt('SOS', X + 64, Y + 58, 54, '#ffffff', { font: FONT_NUM, w: 700 }); ugRect('sos', X, Y, W, H); }
  { const X = 128, Y = 912, W = 256, H = 112; x.fillStyle = '#0a0a0c'; x.fillRect(X, Y, W, H);
    x.strokeStyle = '#39ff6a'; x.lineWidth = 12; x.lineCap = 'round'; x.shadowColor = '#39ff6a'; x.shadowBlur = 12; x.beginPath(); x.moveTo(X + 64, Y + 22); x.lineTo(X + 64, Y + 88); x.moveTo(X + 38, Y + 62); x.lineTo(X + 64, Y + 90); x.lineTo(X + 90, Y + 62); x.stroke();
    x.strokeStyle = '#ff3030'; x.shadowColor = '#ff3030'; x.beginPath(); x.moveTo(X + 166, Y + 28); x.lineTo(X + 218, Y + 84); x.moveTo(X + 218, Y + 28); x.lineTo(X + 166, Y + 84); x.stroke(); x.shadowBlur = 0; x.lineCap = 'butt'; ugRect('lanes', X, Y, W, H); }
  { const X = 384, Y = 912, W = 320, H = 112; x.fillStyle = '#ffd21a'; x.fillRect(X, Y, W, H); for (let i = 0; i < 22; i++) { x.fillStyle = pick(['#ff2e88', '#2f8a3e', '#1d4fa0', '#c8321e']); x.beginPath(); x.arc(X + 8 + i * 14.4, Y + 8, 5, 0, 7); x.arc(X + 8 + i * 14.4, Y + H - 8, 5, 0, 7); x.fill(); }
    txt('HORN OK', X + 160, Y + 44, 44, '#c8121e', { lw: 6, stroke: '#ffffff', max: 290 }); txt('PLEASE', X + 160, Y + 84, 30, '#1d4fa0', { lw: 5, stroke: '#ffffff', max: 290 }); ugRect('hornok', X, Y, W, H); }
  { const X = 704, Y = 912, W = 320, H = 112; stripes(X, Y, W, H, '#ffd21a', '#141218', 22); x.fillStyle = '#141218'; x.fillRect(X + 22, Y + 22, W - 44, H - 44);
    txt('METRO TRIAL RUN', X + 160, Y + 58, 40, '#ffd21a', { font: FONT_NUM, w: 700, max: 260 }); ugRect('trial', X, Y, W, H); }
  TEX.ugAtlas = toTex(c, { aniso: 8 });
  // LED chevron wall (u runs along the wall; chevrons point +u)
  { const [c2, y] = mkCanvas(512, 64); y.fillStyle = '#07050c'; y.fillRect(0, 0, 512, 64);
    for (let i = 0; i < 8; i++) { const ox = i * 64; y.fillStyle = i % 2 ? '#3fe8ff' : '#ff2e88'; y.beginPath(); y.moveTo(ox + 6, 6); y.lineTo(ox + 28, 6); y.lineTo(ox + 54, 32); y.lineTo(ox + 28, 58); y.lineTo(ox + 6, 58); y.lineTo(ox + 32, 32); y.closePath(); y.fill(); }
    y.fillStyle = 'rgba(0,0,0,0.6)'; for (let i = 0; i < 512; i += 4) y.fillRect(i, 0, 1, 64); for (let j = 0; j < 64; j += 4) y.fillRect(0, j, 512, 1);
    TEX.ugLed = toTex(c2, { repeat: true }); }
  // nitro strip (v runs along the road; chevrons point +v)
  { const [c2, y] = mkCanvas(128, 128); y.fillStyle = '#000'; y.fillRect(0, 0, 128, 128);
    for (const oy of [0, 64]) { const g = y.createLinearGradient(0, oy, 0, oy + 64); g.addColorStop(0, '#f2ffff'); g.addColorStop(1, '#1a8cff'); y.fillStyle = g; y.beginPath(); y.moveTo(64, oy + 6); y.lineTo(122, oy + 44); y.lineTo(100, oy + 58); y.lineTo(64, oy + 32); y.lineTo(28, oy + 58); y.lineTo(6, oy + 44); y.closePath(); y.fill(); }
    TEX.ugNitro = toTex(c2, { repeat: true }); }
  // falling water streaks
  { const [c2, y] = mkCanvas(256, 512); y.clearRect(0, 0, 256, 512);
    for (let i = 0; i < 420; i++) { const px = Math.random() * 256, py = Math.random() * 512, l = 30 + Math.random() * 200, w = 0.8 + Math.random() * 1.6, g = y.createLinearGradient(0, py, 0, py + l), a = (0.1 + Math.random() * 0.4).toFixed(2);
      g.addColorStop(0, 'rgba(225,242,255,0)'); g.addColorStop(0.3, `rgba(225,242,255,${a})`); g.addColorStop(1, 'rgba(225,242,255,0)'); y.fillStyle = g; y.fillRect(px, py, w, l); if (py + l > 512) { y.save(); y.translate(0, -512); y.fillRect(px, py, w, l); y.restore(); } }
    TEX.ugWater = toTex(c2, { repeat: true }); }
  // light cone falloff (v = 1 at the lamp)
  { const [c2, y] = mkCanvas(8, 128); const g = y.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.2, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)'); y.fillStyle = g; y.fillRect(0, 0, 8, 128); TEX.ugCone = toTex(c2, { srgb: false }); }
}

Object.assign(World.prototype, {
  ugInit() {
    if (this.ugB) return; ugTextures();
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    this.ugM = {
      sign: new THREE.MeshLambertMaterial({ map: TEX.ugAtlas, emissiveMap: TEX.ugAtlas, emissive: 0x9a9a9a, side: THREE.DoubleSide }),
      led: new THREE.MeshBasicMaterial({ map: TEX.ugLed }),
      nitro: new THREE.MeshBasicMaterial({ map: TEX.ugNitro, ...add, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
      water: new THREE.MeshBasicMaterial({ map: TEX.ugWater, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xd6ecff, opacity: 0.8 }),
      cone: new THREE.MeshBasicMaterial({ map: TEX.ugCone, ...add, side: THREE.DoubleSide, vertexColors: true, opacity: 0.55 }),
      cpool: new THREE.MeshBasicMaterial({ map: TEX.glow, ...add, vertexColors: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      blinkA: new THREE.MeshBasicMaterial({ vertexColors: true }), blinkB: new THREE.MeshBasicMaterial({ vertexColors: true }),
      sea: new THREE.MeshLambertMaterial({ color: '#0b1724', emissive: '#06131f' }),
      train: new THREE.MeshLambertMaterial({ vertexColors: true }), trainWin: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
    // the water curtain fades out right at the lens, so riding through it is a splash, not a wall
    this.ugM.water.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vNear;').replace('#include <project_vertex>', '#include <project_vertex>\nvNear = smoothstep(1.2, 7.0, -mvPosition.z);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vNear;').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vNear;'); };
    Object.values(this.ugM).forEach(m => this.disposables.push(m));
    this.ugB = { sign: new Batch(), led: new Batch(), nitro: new Batch(), water: new Batch(), cone: new Batch(), cpool: new Batch(), blinkA: new Batch(), blinkB: new Batch(), sea: new Batch() };
    this.ugAnim = [];
  },
  // world builders ask before placing generic city stuff in a section
  ugSkip(s, what) {
    const T = this.track; if (!T.ug) return false; const z = T.zoneAt(s);
    if (what === 'building') return z === 'docks' || z === 'kachha' || z === 'bridge';
    if (what === 'lamp') return z === 'docks' || z === 'cut' || z === 'chevron' || z === 'bridge';
    if (what === 'tree') return z === 'tunnel' || z === 'docks' || z === 'bridge' || z === 'cut' || z === 'chevron' || z === 'kachha';
    if (what === 'clutter') return z !== 'market' && z !== 'metro' && z !== null;
    if (what === 'wires') return z !== 'market';
    if (what === 'auto') return z !== 'market' && z !== null;
    return false;
  },
  ugSign(name, x, y, z, yaw, w, groundY = null, batch = null) {
    const uv = UG_UV[name], h = w / uv[4]; this.facing(batch || this.ugB.sign, new THREE.Vector3(x, y, z), yaw, w, y, y + h, uv);
    if (groundY !== null) { const l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); for (const s of [-1, 1]) { const p = new THREE.Vector3(x, y, z).addScaledVector(l, s * w * 0.38); this.B.props.box(p.x, groundY, p.z, 0.1, y - groundY + 0.05, 0.1, yaw, '#3a3840'); } }
    return h;
  },
  // an oriented slab between two points (stairs, braces, jibs)
  ugSlab(batch, p0, p1, w, h, color) { const d = p1.clone().sub(p0), len = d.length(); if (len < 1e-3) return; const yaw = Math.atan2(d.x, d.z), pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z)); const m = p0.clone().add(p1).multiplyScalar(0.5); batch.geom(UNIT_BOX, m.x, m.y, m.z, yaw, w, h, len, color, pitch); },
  // a light cone from apex down to a ground point
  ugCone(apex, base, r, color = '#ffd8a0') { const d = base.clone().sub(apex), h = d.length(); _q.setFromUnitVectors(UP, d.normalize()); _mat.compose(apex, _q, _v.set(r, h, r)); this.ugB.cone.add(CONEFX_G, _mat, new THREE.Color(color)); },
  ugPool(p, r, color, batch = null) { const a = new THREE.Vector3(p.x - r, p.y, p.z - r), b = new THREE.Vector3(p.x + r, p.y, p.z - r), c = new THREE.Vector3(p.x + r, p.y, p.z + r), d = new THREE.Vector3(p.x - r, p.y, p.z + r); (batch || this.ugB.cpool).quad(a, b, c, d, color, [[0, 0], [1, 0], [1, 1], [0, 1]], UP); },
  // a square lattice mast (pylons, floodlight towers, cranes)
  ugLattice(B, x, z, h, w, color, yaw = 0, top = null) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), wt = top ?? w;
    const corner = (i, y) => { const k = (y / h), ww = (w + (wt - w) * k) / 2, a = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i]; return new THREE.Vector3(x, y, z).addScaledVector(l, a[0] * ww).addScaledVector(f, a[1] * ww); };
    for (let i = 0; i < 4; i++) this.beam(B.props, corner(i, 0), corner(i, h), 0.16, color);
    const step = Math.max(2.4, w * 1.1); for (let y = 0; y < h - 0.5; y += step) for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.beam(B.props, corner(i, y), corner(j, Math.min(h, y + step)), 0.07, color); if (y > 0) this.beam(B.props, corner(i, y), corner(j, y), 0.07, color); }
  },
  buildUnderground(B) {
    this.ugInit(); const T = this.track;
    this.ugMetro(B); this.ugCut(B); this.ugDocks(B); this.ugBridge(B); this.ugKachha(B); this.ugMarket(B);
    const UB = this.ugB, M = this.ugM;
    const add = (b, mat, o, ro = 0) => { const m = b.mesh(mat, o); if (m) { m.renderOrder = ro; this.group.add(m); this.disposables.push(m.geometry); } return m; };
    this.ugMesh = { sign: add(UB.sign, M.sign), led: add(UB.led, M.led), sea: add(UB.sea, M.sea, { receive: true }), nitro: add(UB.nitro, M.nitro, {}, 2), cpool: add(UB.cpool, M.cpool, {}, 2), water: add(UB.water, M.water, {}, 3), cone: add(UB.cone, M.cone, {}, 4), blinkA: add(UB.blinkA, M.blinkA), blinkB: add(UB.blinkB, M.blinkB) };
    // the light that rides with you in the tunnel: it sits on the nearest fixture, so each lamp sweeps over the bike
    this.ugLamp = new THREE.PointLight(0xffa04a, 0, 15, 1.3); this.group.add(this.ugLamp);
    this.hemiMul = 1; this.ugRT = true; this.boltT = 5; this.ugCover = false;
  },
  // ── metro: a station over the start grid, then a viaduct running out to a launching gantry (the line isn't finished) ──
  ugMetro(B) {
    const T = this.track, [z0, z1] = T.ug.metro, p = new THREE.Vector3(), q = new THREE.Vector3();
    const DECK = 10.4, sA = z0 + 2, sB = sA + 58, deckEnd = z1 - 8; this.ugMetroZ = { sA, sB, deckEnd, DECK };
    const legOff = (s) => T.wAt(s) / 2 + 0.45 + 1.7;
    // viaduct: portal frames (legs on the pavements) every 25 m, a box girder, parapets, the line's pink/cyan stripe
    for (let s = sB + 12; s < deckEnd - 3; s += 25) { const yaw = T.yawAt(s), o = legOff(s);
      for (const sg of [-1, 1]) { T.pos(s, sg * o, p, 0); p.y = 0; B.props.box(p.x, 0, p.z, 1.3, DECK - 1.2, 1.3, yaw, '#8b8790'); }
      T.pos(s, 0, p, 0); B.props.box(p.x, DECK - 1.25, p.z, 2 * o + 1.6, 1.25, 1.8, yaw, '#7d7983'); }
    for (let s = sB - 2; s < deckEnd; s += 4) { const sm = s + 2, yaw = T.yawAt(sm); T.pos(sm, 0, p, 0);
      B.props.box(p.x, DECK, p.z, 8.4, 1.3, 4.05, yaw, '#9a96a0');
      for (const sg of [-1, 1]) { T.pos(sm, sg * 4.05, q, 0); B.props.box(q.x, DECK + 1.3, q.z, 0.25, 1.0, 4.05, yaw, '#b5b1ba');
        T.pos(sm, sg * 4.24, q, 0); B.glow.box(q.x, DECK + 0.62, q.z, 0.04, 0.2, 4.05, yaw, UG.pink); B.glow.box(q.x, DECK + 0.3, q.z, 0.04, 0.12, 4.05, yaw, UG.cyan); }
      if (Math.round(sm) % 24 < 4) for (const sg of [-1, 1]) { T.pos(sm, sg * 3.6, q, 0); B.props.box(q.x, DECK + 1.3, q.z, 0.18, 5.2, 0.18, yaw, '#5a5a62'); const r = T.pos(sm, sg * 2.2, new THREE.Vector3(), 0); r.y = DECK + 6.2; q.y = DECK + 6.2; this.beam(B.props, q, r, 0.1, '#5a5a62'); } }
    // the unfinished end: a yellow launching gantry sticking out over the road, and the trial-run board
    { const s = deckEnd, yaw = T.yawAt(s);
      for (const sg of [-1, 1]) { const a = T.pos(s - 22, sg * 3.2, new THREE.Vector3(), 0), b = T.pos(s + 16, sg * 3.2, new THREE.Vector3(), 0); a.y = b.y = DECK + 5.4; this.beam(B.props, a, b, 0.7, '#e8b21a'); const a2 = a.clone().setY(DECK + 2.4), b2 = b.clone().setY(DECK + 2.4); this.beam(B.props, a2, b2, 0.5, '#e8b21a');
        for (let k = 0; k < 8; k++) { const u = k / 8, v = (k + 1) / 8; this.beam(B.props, a.clone().lerp(b, u), a2.clone().lerp(b2, v), 0.18, '#d09a10'); }
        const leg = T.pos(s + 14, sg * 3.2, new THREE.Vector3(), 0); leg.y = DECK + 5.4; const foot = leg.clone().setY(DECK + 1.3 - 4); this.beam(B.props, leg, foot, 0.4, '#d09a10'); }
      for (const sg of [-1, 1]) { T.pos(s + 15.5, sg * 3.2, q, 0); q.y = DECK + 6.2; UB_blink(this, q, '#ff3020', sg > 0); }
      T.pos(s - 1, 0, p, 0); this.ugSign('trial', p.x, DECK + 1.6, p.z, yaw + Math.PI, 5.2);
      for (let i = 0; i < 9; i++) { const d = -3.6 + i * 0.9; const a = T.pos(s + 0.02, d, new THREE.Vector3(), 0); a.y = DECK + 0.4 + (i % 3) * 0.3; const b = a.clone().addScaledVector(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), 0.8 + RNG() * 0.8); b.y -= RNG() * 0.6; this.beam(B.props, a, b, 0.05, '#7a4a2a'); } }
    // the station: a long box straddling the road on four legs, lit glass band, stairs down to both pavements
    const SY0 = 9.6, SY1 = 17.0, stW = (s) => T.wAt(s) / 2 + 0.45 + 3.4 + 1.2;
    for (let s = sA; s < sB - 0.01; s += 4) { const sm = s + 2, yaw = T.yawAt(sm), w = stW(sm); T.pos(sm, 0, p, 0); p.y = 0;
      B.props.box(p.x, SY0, p.z, 2 * w, 0.9, 4.05, yaw, '#6e6a76'); B.props.box(p.x, SY0 + 0.9, p.z, 2 * w, SY1 - SY0 - 0.9, 4.05, yaw, '#d6d2da'); B.props.box(p.x, SY1, p.z, 2 * w + 1.6, 0.45, 4.3, yaw, '#4d4956');
      for (const sg of [-1, 1]) { T.pos(sm, sg * (w + 0.02), q, 0); q.y = 0; B.glow.box(q.x, SY0 + 1.8, q.z, 0.08, 2.4, 3.7, yaw, '#bfe6ff'); B.glow.box(q.x, SY0 + 5.2, q.z, 0.08, 0.3, 4.05, yaw, UG.pink); B.glow.box(q.x, SY0 + 5.6, q.z, 0.08, 0.18, 4.05, yaw, UG.cyan); }
      for (const d of [-3.4, 0, 3.4]) { T.pos(sm, d, q, 0); B.glow.box(q.x, SY0 - 0.08, q.z, 0.45, 0.07, 2.6, yaw, '#eef6ff'); } }
    for (const [s, f] of [[sA, -1], [sB, 1]]) { const yaw = T.yawAt(s), w = stW(s); T.pos(s + f * 0.06, 0, p, 0); p.y = 0;
      const fl = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); const a = p.clone().addScaledVector(fl, -w).setY(SY0 + 1.6), b = p.clone().addScaledVector(fl, w).setY(SY0 + 1.6), c = b.clone().setY(SY0 + 4.6), d = a.clone().setY(SY0 + 4.6);
      B.glow.quad(a, b, c, d, new THREE.Color('#9fd2f0'), undefined, new THREE.Vector3(Math.sin(yaw) * f, 0, Math.cos(yaw) * f));
      if (f < 0) this.ugSign('metro', p.x - Math.sin(yaw) * 0.1, SY1 - 2.6, p.z - Math.cos(yaw) * 0.1, yaw + Math.PI, 9.5); }
    for (const s of [sA + 5, sA + 29, sB - 5]) { const yaw = T.yawAt(s), o = T.wAt(s) / 2 + 0.45 + 2.7; for (const sg of [-1, 1]) { T.pos(s, sg * o, p, 0); p.y = 0; B.props.box(p.x, 0, p.z, 1.5, SY0, 1.5, yaw, '#8b8790'); } }
    for (const sg of [-1, 1]) { const o = T.wAt(sB) / 2 + 0.45 + 2.6; const a = T.pos(sB + 17, sg * o, new THREE.Vector3(), 0), b = T.pos(sB - 1, sg * o, new THREE.Vector3(), 0); a.y = 0.6; b.y = SY0 + 0.3; this.ugSlab(B.props, a, b, 2.2, 0.5, '#9a96a0'); a.y += 1.1; b.y += 1.1; this.beam(B.props, a, b, 0.08, '#c8c4cc'); }
    // the trial-run train: three cars, white with the line's stripes; hidden while it sits inside the station
    const tb = new Batch(), wb = new Batch(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
    const box = (bt, x, y, z, w, h, l, col) => { M.compose(P.set(x, y + h / 2, z), Q.identity(), S.set(w, h, l)); bt.add(UNIT_BOX, M, new THREE.Color(col)); };
    for (let i = 0; i < 3; i++) { const z = (i - 1) * 17.6;
      box(tb, 0, 0.3, z, 2.9, 0.5, 16.4, '#2a2a30'); box(tb, 0, 0.8, z, 2.95, 2.9, 17.2, '#eceef2'); box(tb, 0, 3.7, z, 2.6, 0.35, 16.8, '#b8bcc4');
      for (const sx of [-1, 1]) { box(tb, sx * 1.48, 1.05, z, 0.04, 0.22, 17.2, UG.pink); box(tb, sx * 1.48, 3.35, z, 0.04, 0.14, 17.2, UG.cyan); box(wb, sx * 1.49, 1.9, z, 0.04, 1.05, 15.2, '#bfe4ff'); }
      for (const dz of [-6, 6]) box(tb, 0, 0, z + dz, 2.4, 0.4, 2.6, '#16161a'); }
    for (const f of [-1, 1]) box(wb, 0, 1.9, f * 26.25, 2.5, 1.15, 0.06, '#ffffff');
    const tg = tb.build(), wg = wb.build(); this.disposables.push(tg, wg);
    this.metro = new THREE.Group(); this.metro.add(new THREE.Mesh(tg, this.ugM.train), new THREE.Mesh(wg, this.ugM.trainWin)); this.metro.children[0].castShadow = true; this.group.add(this.metro);
    this.metroS = { x: 0, phase: 'dwell', t: 2, from: 0, to: 0, dur: 1, sC: (sA + sB) / 2, sEnd: deckEnd - 30, lastChime: -9 };
    this.placeMetro();
  },
  placeMetro() { const T = this.track, m = this.metroS, Z = this.ugMetroZ, s = m.sC + m.x; T.pos(s, 0, this.metro.position, 0); this.metro.position.y = Z.DECK + 1.3; this.metro.rotation.y = T.yawAt(s);
    this.metro.visible = !(s - 26.5 > Z.sA + 0.5 && s + 26.5 < Z.sB - 0.5); },
  // ── Andheri Tunnel ──
  buildTunnel(B, h) {
    this.ugInit(); const T = this.track, UB = this.ugB; const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3(), p = new THREE.Vector3();
    const WALL = 3.2, CROWN = 7.0, TOP = 10.4, NA = 8, off = (s) => T.wAt(s) / 2 + 0.45 + 1.3;
    const arc = []; for (let i = 0; i <= NA; i++) { const a = i / NA * Math.PI; arc.push([Math.cos(a), WALL + (CROWN - WALL) * Math.sin(a)]); }
    const at = (s, d, y, out) => { T.pos(s, d, out, 0); out.y = y; return out; };
    let n = 0;
    for (let s = h.s0; s < h.s1 - 0.01; s += 2, n++) { const s1 = Math.min(s + 2, h.s1), o0 = off(s), o1 = off(s1);
      for (const sg of [-1, 1]) { const band = (y0, y1, col) => { at(s, sg * o0, y0, pA); at(s1, sg * o1, y0, pB); at(s1, sg * o1, y1, pC); at(s, sg * o0, y1, pD); B.props.quad(pA, pB, pC, pD, col); };
        band(0.18, 0.75, n % 2 ? UG.mari : '#1a1a1e'); band(0.75, 2.55, n % 4 < 2 ? '#cfc2a8' : '#c4b79c'); band(2.55, WALL, '#6c6672');
        // outer shell + the cover slab with the highway on top
        at(s, sg * (o0 + 0.6), 0, pA); at(s1, sg * (o1 + 0.6), 0, pB); at(s1, sg * (o1 + 0.6), TOP, pC); at(s, sg * (o0 + 0.6), TOP, pD); B.props.quad(pA, pB, pC, pD, '#55505c'); }
      for (let k = 0; k < NA; k++) { at(s, arc[k][0] * o0, arc[k][1], pA); at(s1, arc[k][0] * o1, arc[k][1], pB); at(s1, arc[k + 1][0] * o1, arc[k + 1][1], pC); at(s, arc[k + 1][0] * o0, arc[k + 1][1], pD); B.props.quad(pA, pB, pC, pD, (k + (n >> 1)) % 2 ? '#3d3943' : '#36323c'); }
      at(s, -o0 - 0.6, TOP, pA); at(s1, -o1 - 0.6, TOP, pB); at(s1, o1 + 0.6, TOP, pC); at(s, o0 + 0.6, TOP, pD); B.props.quad(pA, pB, pC, pD, '#2a2830', undefined, UP); }
    // light strips at the upper corners every 4.5 m, pools on the road, halos every third
    const fix = []; let j = 0;
    for (let s = h.s0 + 3; s < h.s1 - 2; s += 4.5, j++) { const yaw = T.yawAt(s), o = off(s);
      for (const sg of [-1, 1]) { const a = Math.PI * (sg > 0 ? 0.24 : 0.76), d = Math.cos(a) * o * 0.97, y = WALL + (CROWN - WALL) * Math.sin(a) - 0.12; at(s, d, y, p);
        B.glow.box(p.x, p.y - 0.06, p.z, 0.3, 0.12, 1.5, yaw, UG.sodium); if (sg > 0) fix.push(s);
        if ((j + (sg > 0 ? 0 : 1)) % 3 === 0) this.lampHeads.push(p.clone().setY(p.y - 0.1)); }
      if (j % 2 === 0) { const pc = T.pos(s, (j % 4 ? 1 : -1) * T.wAt(s) * 0.22, new THREE.Vector3(), 0.03), r = 5.2; B.pool.quad(new THREE.Vector3(pc.x - r, pc.y, pc.z - r), new THREE.Vector3(pc.x + r, pc.y, pc.z - r), new THREE.Vector3(pc.x + r, pc.y, pc.z + r), new THREE.Vector3(pc.x - r, pc.y, pc.z + r), '#ffffff', [[0, 0], [1, 0], [1, 1], [0, 1]], UP); }
      if (j % 3 === 0) this.whoosh.push({ s, d: (j % 2 ? 1 : -1) * (o - 0.4), k: 'post' }); }
    this.ugTunnel = { s0: h.s0, s1: h.s1, fix, off, WALL, CROWN };
    // cable trays, jet fans, lane signals, SOS cabinets
    for (let s = h.s0; s < h.s1 - 6; s += 6) for (const sg of [-1, 1]) { const a = at(s, sg * (off(s) - 0.12), WALL + 0.1, new THREE.Vector3()), b = at(s + 6, sg * (off(s + 6) - 0.12), WALL + 0.1, new THREE.Vector3()); this.beam(B.props, a, b, 0.22, '#55525a'); }
    for (let s = h.s0 + 40; s < h.s1 - 30; s += 72) { const yaw = T.yawAt(s); for (const d of [-1.7, 1.7]) { at(s, d, CROWN - 1.0, p); B.props.geom(FAN_G, p.x, p.y, p.z, yaw, 1, 1, 1, '#8a8d94'); B.props.box(p.x, p.y + 0.5, p.z, 0.12, CROWN - p.y - 0.5, 0.12, yaw, '#55525a'); } }
    for (let s = h.s0 + 70; s < h.s1 - 30; s += 110) { const yaw = T.yawAt(s); at(s, 0, CROWN - 1.6, p); B.props.box(p.x, p.y + 0.9, p.z, 0.1, CROWN - p.y - 0.9, 0.1, yaw, '#333'); this.ugSign('lanes', p.x, p.y - 0.25, p.z, yaw + Math.PI, 3.4); B.props.box(p.x - Math.sin(yaw) * 0.06, p.y - 0.3, p.z - Math.cos(yaw) * 0.06, 3.6, 1.6, 0.08, yaw, '#111'); }
    for (let s = h.s0 + 30, k = 0; s < h.s1 - 20; s += 60, k++) { const sg = k % 2 ? 1 : -1, yaw = T.yawAt(s), o = off(s); at(s, sg * (o - 0.16), 0.95, p); B.props.box(p.x, p.y, p.z, 0.32, 1.0, 0.7, yaw, '#1f8a4c'); const ly = yaw + (sg > 0 ? -Math.PI / 2 : Math.PI / 2); at(s, sg * (o - 0.34), 2.1, p); this.ugSign('sos', p.x, 2.0, p.z, ly, 0.75); }
    // portals: wing walls and an arched face; the name board over the entrance; hazard stripes round the arch
    for (const [s, f] of [[h.s0, -1], [h.s1, 1]]) { const o = off(s), yaw = T.yawAt(s), ss = s + f * 0.04, out = new THREE.Vector3(Math.sin(yaw) * f, 0, Math.cos(yaw) * f);
      for (const sg of [-1, 1]) { at(ss, sg * o, 0, pA); at(ss, sg * (o + 7), 0, pB); at(ss, sg * (o + 7), TOP + 0.6, pC); at(ss, sg * o, TOP + 0.6, pD); B.props.quad(pA, pB, pC, pD, '#6f6a76', undefined, out); }
      for (let k = 0; k < NA; k++) { at(ss, arc[k][0] * o, arc[k][1], pA); at(ss, arc[k + 1][0] * o, arc[k + 1][1], pB); at(ss, arc[k + 1][0] * o, TOP + 0.6, pC); at(ss, arc[k][0] * o, TOP + 0.6, pD); B.props.quad(pA, pB, pC, pD, '#6f6a76', undefined, out); }
      const s2 = s + f * 0.09, rim = (k) => [arc[k][0] * (o + 0.55), arc[k][1] + 0.5 * Math.sin(k / NA * Math.PI)];
      for (let k = 0; k < NA; k++) { const r0 = rim(k), r1 = rim(k + 1); at(s2, arc[k][0] * o, arc[k][1], pA); at(s2, arc[k + 1][0] * o, arc[k + 1][1], pB); at(s2, r1[0], r1[1], pC); at(s2, r0[0], r0[1], pD); B.glow.quad(pA, pB, pC, pD, new THREE.Color(k % 2 ? UG.mari : '#151418'), undefined, out); }
      for (const sg of [-1, 1]) for (let y = 0; y < WALL; y += 0.8) { at(s2, sg * o, y, pA); at(s2, sg * (o + 0.55), y, pB); at(s2, sg * (o + 0.55), Math.min(WALL, y + 0.8), pC); at(s2, sg * o, Math.min(WALL, y + 0.8), pD); B.glow.quad(pA, pB, pC, pD, new THREE.Color(Math.round(y / 0.8) % 2 ? UG.mari : '#151418'), undefined, out); }
      if (f < 0) { at(s - 0.18, 0, 0, p); this.ugSign('tunnel', p.x, CROWN + 0.55, p.z, yaw + Math.PI, Math.min(2 * o + 3, 16)); }
      for (const sg of [-1, 1]) { at(s + f * 0.5, sg * (o + 3.2), TOP - 0.6, p); B.glow.box(p.x, p.y, p.z, 1.2, 0.35, 0.4, yaw, UG.hot); this.lampHeads.push(p.clone()); const g = T.pos(s + f * 9, sg * T.wAt(s) * 0.25, new THREE.Vector3(), 0.03); this.ugPool(g, 7, '#ffb25a'); }
      for (let k = -3; k <= 3; k++) { at(s - f * 3, k * 2.2, TOP + 0.6, p); B.props.box(p.x, p.y, p.z, 0.12, 0.9, 0.12, yaw, '#8a8690'); } }
    // the highway on top: parapets, sodium lamps, a few stuck cars
    for (let s = h.s0 + 12; s < h.s1 - 8; s += 38) { const yaw = T.yawAt(s); for (const sg of [-1, 1]) { at(s, sg * (off(s) - 0.6), TOP, p); B.props.box(p.x, TOP, p.z, 0.16, 6, 0.16, yaw, '#3a3a40'); const hd = at(s, sg * (off(s) - 2.0), TOP + 6, new THREE.Vector3()); this.beam(B.props, p.clone().setY(TOP + 6), hd, 0.1, '#3a3a40'); B.glow.box(hd.x, hd.y - 0.2, hd.z, 0.45, 0.16, 0.3, yaw, UG.sodium); this.lampHeads.push(hd.clone()); } }
    for (let s = h.s0 + 20; s < h.s1 - 10; s += 26 + RNG() * 30) { const d = (RNG() < 0.5 ? -1 : 1) * T.wAt(s) * 0.25, yaw = T.yawAt(s) + (RNG() < 0.5 ? 0 : Math.PI); at(s, d, TOP, p); B.props.box(p.x, TOP, p.z, 1.7, 1.2, 4.0, yaw, pick(['#1a1a1a', '#f2c21a', '#c8c8cc', '#8a1f2a'])); const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), lw = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); for (const k of [-0.6, 0.6]) { const r = p.clone().addScaledVector(fw, -2.02).addScaledVector(lw, k); B.glow.box(r.x, TOP + 0.6, r.z, 0.3, 0.15, 0.05, yaw, '#ff2a2a'); } }
    // the burst water main: a pipe across the vault pouring a curtain over the road
    if (T.burst) { const s = T.burst.s, yaw = T.yawAt(s), o = off(s), w = T.wAt(s) / 2;
      at(s, 0, CROWN - 0.55, p); B.props.geom(PIPE_G, p.x, p.y, p.z, yaw, 2 * o * 0.8, 1, 1, '#4f6a7a'); B.props.geom(PIPE_G, p.x, p.y, p.z, yaw, 0.6, 1.25, 1.25, '#2a3a44');
      for (const ds of [-0.25, 0.35]) { const sx = s + ds; at(sx, -w - 0.5, 0, pA); at(sx, w + 0.5, 0, pB); at(sx, w + 0.5, CROWN - 0.7, pC); at(sx, -w - 0.5, CROWN - 0.7, pD); UB.water.quad(pA, pB, pC, pD, '#ffffff', [[0, 0], [5, 0], [5, 1.2], [0, 1.2]]); }
      for (let d = -w; d < w; d += 0.7) { at(s + (RNG() - 0.5) * 1.6, d, 0.03, p); B.glow.box(p.x, 0.02, p.z, 0.55 + RNG() * 0.5, 0.03, 0.2, yaw + (RNG() - 0.5) * 0.9, '#c4d8e2'); }
      at(s - 5, -w, 0.012, pA); at(s + 7, -w, 0.012, pB); at(s + 7, w, 0.012, pC); at(s - 5, w, 0.012, pD); B.marks.quad(pA, pB, pC, pD, '#2a3440', undefined, UP); }
  },
  // ── the underpass cut: retaining walls, graffiti, wall lamps, two overbridges; the LED chevron wall round the hairpin ──
  ugCut(B) {
    const T = this.track, [c0, c1] = T.ug.cut, [h0, h1] = T.ug.chevron, UB = this.ugB; const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3(), p = new THREE.Vector3();
    const WH = 7.2, off = (s) => T.wAt(s) / 2 + 0.45 + 1.0, at = (s, d, y, out) => { T.pos(s, d, out, 0); out.y = y; return out; };
    const kAt = (s) => wrapAngle(T.yawAt(s + 1) - T.yawAt(s - 1)) / 2;
    const outS = wrapAngle(T.yawAt(h1 - 8) - T.yawAt(h0 + 8)) > 0 ? -1 : 1; this.ugHairpin = { s0: h0, s1: h1, side: outS };
    const inLed = (s, sg) => sg === outS && T.wrapD(s - h0) > 4 && T.wrapD(s - h1) < -4;
    let n = 0;
    for (let s = c0; s < c1 - 0.01; s += 2, n++) { const s1 = Math.min(s + 2, c1), o0 = off(s), o1 = off(s1), k = kAt(s + 1);
      for (const sg of [-1, 1]) { const inner = Math.sign(k) === sg && Math.abs(k) > 1e-3, ext = inner ? clamp(1 / Math.abs(k) - o0 - 2, 0, 16) : 16;
        const band = (y0, y1, col) => { at(s, sg * o0, y0, pA); at(s1, sg * o1, y0, pB); at(s1, sg * o1, y1, pC); at(s, sg * o0, y1, pD); B.props.quad(pA, pB, pC, pD, col); };
        const panel = Math.floor(s / 6) % 2; band(0.18, 0.9, '#3e3a44'); band(0.9, WH, panel ? '#6f6a74' : '#67626c');
        at(s, sg * o0, WH, pA); at(s1, sg * o1, WH, pB); at(s1, sg * (o1 + 0.7), WH + 0.35, pC); at(s, sg * (o0 + 0.7), WH + 0.35, pD); B.props.quad(pA, pB, pC, pD, '#8a8590', undefined, UP);
        if (ext > 1) { at(s, sg * (o0 + 0.7), WH + 0.35, pA); at(s1, sg * (o1 + 0.7), WH + 0.35, pB); at(s1, sg * (o1 + ext), WH + 0.35, pC); at(s, sg * (o0 + ext), WH + 0.35, pD); B.props.quad(pA, pB, pC, pD, '#2c2a30', undefined, UP); }
        if (n % 2 === 0) { at(s, sg * (o0 + 0.35), WH + 0.35, pA); B.props.box(pA.x, pA.y, pA.z, 0.07, 1.0, 0.07, T.yawAt(s), '#9a96a0'); at(s + 4, sg * (off(s + 4) + 0.35), WH + 1.3, pB); this.beam(B.props, pA.clone().setY(WH + 1.3), pB, 0.06, '#9a96a0'); }
        if (inLed(s, sg) && inLed(s1, sg)) { at(s, sg * (o0 - 0.06), 0.95, pA); at(s1, sg * (o1 - 0.06), 0.95, pB); at(s1, sg * (o1 - 0.06), 4.1, pC); at(s, sg * (o0 - 0.06), 4.1, pD); UB.led.quad(pA, pB, pC, pD, '#ffffff', [[s / 6, 0], [s1 / 6, 0], [s1 / 6, 1], [s / 6, 1]]);
          for (const y of [0.85, 4.1]) { at(s, sg * (o0 - 0.08), y, pA); B.props.box(pA.x, pA.y, pA.z, 0.14, 0.12, 2.05, T.yawAt(s + 1), '#111'); }
          if (n % 3 === 0) this.ugPool(T.pos(s, sg * (T.wAt(s) / 2 - 1.6), new THREE.Vector3(), 0.03), 4.2, (n >> 1) % 2 ? '#ff2e88' : '#3fd0c9'); } } }
    // gulmohar and peepal trees up on the terraces, leaning over the walls
    for (let s = c0 + 10; s < c1 - 10; s += 16 + RNG() * 14) for (const sg of [-1, 1]) { if (RNG() < 0.35) continue; const k = kAt(s), inner = Math.sign(k) === sg && Math.abs(k) > 1e-3; if (inner && 1 / Math.abs(k) < off(s) + 6) continue;
      T.pos(s, sg * (off(s) + 2.2 + RNG() * 3), p, 0); if (T.clearance(p.x, p.z) < 4) continue; this.tree(B, p.x, WH + 0.35, p.z, 5 + RNG() * 3); if (RNG() < 0.3) for (let j = 0; j < 4; j++) B.props.geom(BLOB, p.x + (RNG() - 0.5) * 2.4, WH + 4.5 + RNG() * 1.5, p.z + (RNG() - 0.5) * 2.4, RNG() * 6, 0.9, 0.7, 0.9, '#e8452a'); }
    // graffiti panels (not on the LED wall), wall lamps with sodium pools
    const tags = ['g0', 'g1', 'g2', 'g3'], oldTags = ['graffiti', 'posters'];
    for (let s = c0 + 14, k = 0; s < c1 - 10; s += 21, k++) { const sg = k % 2 ? 1 : -1; if (inLed(s, sg) || T.wrapD(s - h0) > -8 && T.wrapD(s - h1) < 8) continue; const yaw = T.yawAt(s), o = off(s), dirIn = Math.atan2(-sg * Math.cos(yaw), sg * Math.sin(yaw));
      at(s, sg * (o - 0.05), 0, p); if (k % 3 === 2) { const nm = oldTags[k % 2], uv = SIGN_UV[nm], w = 5.6; this.facing(B.signs, p, dirIn, w, 1.3, 1.3 + w / uv[4], uv); } else this.ugSign(tags[k % 4], p.x, 1.2, p.z, dirIn, 4.4); }
    for (let s = c0 + 6, k = 0; s < c1 - 4; s += 15, k++) { const sg = k % 2 ? 1 : -1; if (inLed(s, sg)) continue; const yaw = T.yawAt(s), o = off(s); at(s, sg * (o - 0.45), 5.3, p); B.glow.box(p.x, p.y, p.z, 0.5, 0.2, 0.9, yaw, UG.sodium); at(s, sg * (o - 0.1), 5.45, pA); this.beam(B.props, pA, p.clone().setY(5.45), 0.08, '#333');
      if (k % 2 === 0) this.lampHeads.push(p.clone()); this.ugPool(T.pos(s, sg * (T.wAt(s) / 2 - 1.2), new THREE.Vector3(), 0.03), 5.5, '#ffaa4a'); this.whoosh.push({ s, d: sg * o, k: 'pole' }); }
    // overbridges: a road bridge jammed with traffic and a steel railway bridge
    const brs = [c0 + (c1 - c0) * 0.15, c0 + (c1 - c0) * 0.38].filter(s => T.wrapD(s - h0) < -14 || T.wrapD(s - h1) > 14);
    brs.forEach((s, i) => { const yaw = T.yawAt(s), o = off(s) + 3; T.pos(s, 0, p, 0); p.y = 0; const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), lw = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      if (i === 0) { B.props.box(p.x, WH + 0.2, p.z, 2 * o, 1.1, 8, yaw, '#86818c'); for (const f of [-1, 1]) { const q = p.clone().addScaledVector(fw, f * 3.9); B.props.box(q.x, WH + 1.3, q.z, 2 * o, 1.0, 0.25, yaw, '#a29eaa'); }
        for (const f of [-1, 1]) { const q = p.clone().addScaledVector(fw, f * 4.05); B.glow.box(q.x, WH + 0.5, q.z, 2 * o - 2, 0.1, 0.05, yaw, f > 0 ? UG.pink : UG.cyan); }
        for (let j = -3; j <= 3; j++) { const q = p.clone().addScaledVector(lw, j * 2.6 + (RNG() - 0.5)).addScaledVector(fw, (j % 2 ? 1.6 : -1.6)); const cy = yaw + Math.PI / 2 + (j % 2 ? 0 : Math.PI); B.props.box(q.x, WH + 1.3, q.z, 1.6, 1.15, 3.6, cy, pick(['#1a1a1a', '#f2c21a', '#c8c8cc', '#2f8a3e', '#8a1f2a']));
          const cf = new THREE.Vector3(Math.sin(cy), 0, Math.cos(cy)), cl = new THREE.Vector3(Math.cos(cy), 0, -Math.sin(cy)); for (const kk of [-0.55, 0.55]) { const r = q.clone().addScaledVector(cf, -1.82).addScaledVector(cl, kk); B.glow.box(r.x, WH + 1.85, r.z, 0.3, 0.14, 0.05, cy, '#ff2a2a'); const h2 = q.clone().addScaledVector(cf, 1.82).addScaledVector(cl, kk); B.glow.box(h2.x, WH + 1.85, h2.z, 0.3, 0.14, 0.05, cy, '#fff2c8'); } }
        const sb = p.clone().addScaledVector(fw, -4.2); this.facing(B.signs, sb, yaw + Math.PI, Math.min(2 * o - 4, 11), WH + 2.5, WH + 2.5 + Math.min(2 * o - 4, 11) / SIGN_UV.bill1[4], SIGN_UV.bill1); }
      else { for (const f of [-1, 1]) { const q = p.clone().addScaledVector(fw, f * 2.6); B.props.box(q.x, WH + 0.2, q.z, 2 * o, 0.9, 0.5, yaw, '#3a4a5a'); B.props.box(q.x, WH + 3.2, q.z, 2 * o, 0.4, 0.5, yaw, '#3a4a5a');
          for (let j = -o; j < o - 0.1; j += 2.4) { const a = q.clone().addScaledVector(lw, j).setY(WH + 1.1), b = q.clone().addScaledVector(lw, j + 2.4).setY(WH + 3.2); this.beam(B.props, a, b, 0.14, '#3a4a5a'); this.beam(B.props, a.clone().setY(WH + 3.2), b.clone().setY(WH + 1.1), 0.14, '#3a4a5a'); } }
        B.props.box(p.x, WH + 0.2, p.z, 2 * o, 0.5, 5.4, yaw, '#2f3a46'); const g = p.clone().addScaledVector(fw, -2.95); g.y = 0; B.glow.box(g.x, WH + 0.35, g.z, 2 * o - 1, 0.12, 0.05, yaw, '#ffd23f'); }
      for (const sg of [-1, 1]) { const q = T.pos(s, sg * (T.wAt(s) / 2 * 0.5), new THREE.Vector3(), 0); B.glow.box(q.x, WH + 0.12, q.z, 0.5, 0.06, 1.4, yaw, '#ffe2b0'); this.ugPool(q.clone().setY(0.03), 4, '#ffd8a0'); } });
    // the hairpin warning
    T.pos(h0 - 26, -outS * (T.wAt(h0 - 26) / 2 + 0.2), p, 0); this.signBoard(B, 'chevron', p.x, p.y + 2.0, p.z, T.yawAt(h0 - 26) + Math.PI, 2.4, p.y);
  },
  // ── docks: quay and black water on the open side, container stacks on the other, cranes, floodlight towers, a ship ──
  ugDocks(B) {
    const T = this.track, [d0, d1] = T.ug.docks, len = d1 - d0, UB = this.ugB, p = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    const edge = (s) => T.wAt(s) / 2 + 0.45, sm = d0 + len / 2;
    const room = (sg) => { let m = 1e9; for (const f of [0.2, 0.5, 0.8]) { const s = d0 + len * f; for (const r of [40, 80, 120]) { T.pos(s, sg * (edge(s) + r), p, 0); m = Math.min(m, T.clearance(p.x, p.z) - r * 0.6); } } return m; };
    const wS = room(1) >= room(-1) ? 1 : -1; this.ugDockSide = wS;
    const far = (s) => { let f = 26; for (let r = 30; r <= 150; r += 10) { T.pos(s, wS * (edge(s) + r), p, 0); if (T.clearance(p.x, p.z) < r - 6 || T.clearance(p.x, p.z) < 14) break; f = r; } return f; };
    const QUAY = 21, QY = 0.35;
    // quay slab, the yellow edge line, bollards; water out to wherever the rest of the map starts
    for (let s = d0 + 6; s < d1 - 12; s += 6) { const s1 = s + 6, e0 = edge(s), e1 = edge(s1), f0 = far(s), f1 = far(s1);
      T.pos(s, wS * (e0 + 3.9), pA, QY); T.pos(s1, wS * (e1 + 3.9), pB, QY); T.pos(s1, wS * (e1 + QUAY), pC, QY); T.pos(s, wS * (e0 + QUAY), pD, QY); B.props.quad(pA, pB, pC, pD, '#4e4a54', undefined, UP);
      T.pos(s, wS * (e0 + QUAY - 0.3), pA, QY + 0.01); T.pos(s1, wS * (e1 + QUAY - 0.3), pB, QY + 0.01); T.pos(s1, wS * (e1 + QUAY), pC, QY + 0.01); T.pos(s, wS * (e0 + QUAY), pD, QY + 0.01); B.glow.quad(pA, pB, pC, pD, new THREE.Color('#d8a81a'), undefined, UP);
      T.pos(s, wS * (e0 + QUAY), pA, QY); T.pos(s1, wS * (e1 + QUAY), pB, QY); T.pos(s1, wS * (e1 + QUAY), pC, 0.0); T.pos(s, wS * (e0 + QUAY), pD, 0.0); B.props.quad(pA, pB, pC, pD, '#2c2a30');
      if (f0 > QUAY + 4) { T.pos(s, wS * (e0 + QUAY), pA, 0.015); T.pos(s1, wS * (e1 + QUAY), pB, 0.015); T.pos(s1, wS * (e1 + f1), pC, 0.015); T.pos(s, wS * (e0 + f0), pD, 0.015); UB.sea.quad(pA, pB, pC, pD, '#ffffff', undefined, UP); }
      T.pos(s + 3, wS * (e0 + QUAY - 0.9), p, QY); B.props.geom(BOLLARD_G, p.x, p.y, p.z, 0, 2.2, 0.8, 2.2, '#1a1a1e'); }
    // jersey barriers along both kerbs: yellow / black, the speed ticks of this section
    for (const sg of [-1, 1]) for (let s = d0 + 4, k = 0; s < d1 - 4; s += 2.5, k++) { T.pos(s, sg * (edge(s) + 0.55), p, 0); B.props.box(p.x, p.y + 0.1, p.z, 0.5, 0.82, 2.3, T.yawAt(s), k % 2 ? UG.mari : '#1e1d22'); if (k % 3 === 0) this.whoosh.push({ s, d: sg * (edge(s) + 0.55), k: 'post' }); }
    // quay lamps on the water side, their reflections streaking across the black water
    for (let s = d0 + 20; s < d1 - 16; s += 38) { const yaw = T.yawAt(s), e = edge(s); T.pos(s, wS * (e + QUAY - 1.6), p, 0); B.props.box(p.x, QY, p.z, 0.22, 11, 0.22, yaw, '#4a4650'); const hd = T.pos(s, wS * (e + QUAY - 3.4), new THREE.Vector3(), 10.8); this.beam(B.props, p.clone().setY(QY + 11), hd, 0.1, '#4a4650');
      B.glow.box(hd.x, hd.y - 0.2, hd.z, 0.6, 0.25, 0.5, yaw, UG.sodium); this.lampHeads.push(hd.clone()); this.ugPool(T.pos(s, wS * (e + QUAY - 5), new THREE.Vector3(), QY + 0.03), 7, '#ffb860');
      if (far(s) > QUAY + 20) { T.pos(s - 1.4, wS * (e + QUAY + 1), pA, 0.03); T.pos(s + 1.4, wS * (e + QUAY + 1), pB, 0.03); T.pos(s + 1.4, wS * (e + QUAY + 26), pC, 0.03); T.pos(s - 1.4, wS * (e + QUAY + 26), pD, 0.03); UB.cpool.quad(pA, pB, pC, pD, '#ff9a40', [[0, 0], [1, 0], [1, 1], [0, 1]], UP); } }
    // container stacks on the land side, ribbed with a darker band, two blocks deep
    const cols = ['#1f5fa8', '#c8321e', '#e07a1f', '#2f8a3e', '#8a8f96', '#6a2a8a', '#d4b21a', '#b0b6bd', '#7a1f2a', '#0f7a7a'];
    for (let s = d0 + 12; s < d1 - 12; s += 12.8) { const yaw = T.yawAt(s + 6.1);
      for (let row = 0; row < 5; row++) { if (row === 2) continue; const dd = -wS * (edge(s) + 6.7 + row * 2.9); T.pos(s + 6.1, dd, p, 0); p.y = 0; if (T.clearance(p.x, p.z) < 3.2) continue;
        const h = RNG() < 0.15 ? 0 : 1 + Math.floor(RNG() * (row < 2 ? 3 : 4)); for (let k = 0; k < h; k++) { const cc = pick(cols); B.props.box(p.x, k * 2.6, p.z, 2.44, 2.55, 12.1, yaw + (RNG() - 0.5) * 0.02, cc); B.props.box(p.x, k * 2.6 + 2.2, p.z, 2.48, 0.12, 12.14, yaw, '#1a1a1e'); } } }
    // ship-to-shore cranes on the quay, booms over the water; a trolley with a container runs out and back
    this.ugCranes = [];
    for (const f of [0.28, 0.66]) { const s = d0 + len * f, yaw = T.yawAt(s), e = edge(s), fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), lw = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(wS);
      const base = T.pos(s, wS * (e + 6), new THREE.Vector3(), 0); base.y = 0; const legs = []; for (const a of [0, 13]) for (const b of [-7, 7]) legs.push(base.clone().addScaledVector(lw, a).addScaledVector(fw, b));
      for (const L of legs) { this.beam(B.props, L, L.clone().setY(30), 0.9, '#c8321e'); for (const y of [8, 16, 24]) B.props.box(L.x, y, L.z, 1.0, 1.2, 1.0, yaw, '#eeeeee'); }
      for (const b of [-7, 7]) { const a0 = base.clone().addScaledVector(fw, b).setY(30), a1 = a0.clone().addScaledVector(lw, 13); this.beam(B.props, a0, a1, 1.2, '#c8321e'); }
      for (const a of [0, 13]) { const a0 = base.clone().addScaledVector(lw, a).addScaledVector(fw, -7).setY(30), a1 = a0.clone().addScaledVector(fw, 14); this.beam(B.props, a0, a1, 1.0, '#c8321e'); }
      const b0 = base.clone().addScaledVector(lw, -16).setY(34), b1 = base.clone().addScaledVector(lw, 62).setY(34); this.beam(B.props, b0, b1, 1.6, '#d8d8dc'); this.beam(B.props, b0.clone().setY(33.2), b1.clone().setY(33.2), 1.6, '#c8321e');
      const ap = base.clone().addScaledVector(lw, 6).setY(48); this.beam(B.props, base.clone().addScaledVector(lw, 0).setY(30), ap, 0.7, '#c8321e'); this.beam(B.props, base.clone().addScaledVector(lw, 13).setY(30), ap, 0.7, '#c8321e'); this.beam(B.props, ap, b1, 0.18, '#999'); this.beam(B.props, ap, b0, 0.18, '#999');
      B.props.box(base.x + lw.x * 3, 30.5, base.z + lw.z * 3, 6, 3.2, 8, yaw, '#e8e8ec'); for (const q of [ap.clone().setY(48.6), b1.clone().setY(35)]) UB_blink(this, q, '#ff2a1a', true);
      for (const a of [0, 13]) for (const b of [-7, 7]) { const L = base.clone().addScaledVector(lw, a).addScaledVector(fw, b); B.glow.box(L.x, 29.2, L.z, 0.6, 0.25, 0.6, yaw, '#fff4d6'); }
      this.ugCone(base.clone().addScaledVector(lw, 6).setY(29), base.clone().addScaledVector(lw, -8).setY(0), 11, '#ffe6b8'); this.ugPool(base.clone().addScaledVector(lw, -6).setY(0.04), 10, '#ffd9a0');
      const tg = new Batch(), M = new THREE.Matrix4(); M.compose(new THREE.Vector3(0, -1.2, 0), new THREE.Quaternion(), new THREE.Vector3(2.4, 0.8, 4)); tg.add(UNIT_BOX, M, new THREE.Color('#e8b21a')); M.compose(new THREE.Vector3(0, -12, 0), new THREE.Quaternion(), new THREE.Vector3(2.44, 2.55, 12.1)); tg.add(UNIT_BOX, M, new THREE.Color(pick(cols)));
      for (const sx of [-1, 1]) { M.compose(new THREE.Vector3(sx * 0.9, -5.8, 0), new THREE.Quaternion(), new THREE.Vector3(0.06, 9.4, 0.06)); tg.add(UNIT_BOX, M, new THREE.Color('#222')); }
      const geo = tg.build(); this.disposables.push(geo); const mesh = new THREE.Mesh(geo, this.ugM.train); mesh.rotation.y = yaw; mesh.castShadow = true; this.group.add(mesh);
      this.ugCranes.push({ mesh, from: base.clone().addScaledVector(lw, -2).setY(33.2), to: base.clone().addScaledVector(lw, 52).setY(33.2), ph: f * 9 }); }
    // floodlight towers on the land side: lattice masts, a bank of lamps, a cone of light down onto the road
    for (let s = d0 + 24, k = 0; s < d1 - 16; s += 46, k++) { const yaw = T.yawAt(s), e = edge(s); const b = T.pos(s, -wS * (e + 4.3), new THREE.Vector3(), 0); b.y = 0; if (T.clearance(b.x, b.z) < 3) continue;
      this.ugLattice(B, b.x, b.z, 23, 1.6, '#6a6670', yaw, 0.9); const head = b.clone().setY(23.6); B.props.box(head.x, 22.6, head.z, 3.6, 1.6, 0.4, yaw + Math.PI / 2, '#333038');
      const lw = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(wS); for (let i = -1; i <= 1; i++) for (const y of [22.9, 23.6]) { const q = head.clone().addScaledVector(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), i * 1.1).addScaledVector(lw, 0.25); B.glow.box(q.x, y - 0.25, q.z, 0.3, 0.5, 0.9, yaw, '#fff4dc'); }
      this.lampHeads.push(head.clone().addScaledVector(lw, 0.5)); const tgt = T.pos(s + 4, wS * 1.5, new THREE.Vector3(), 0); tgt.y = 0; this.ugCone(head.clone().addScaledVector(lw, 0.4).setY(23), tgt, 9, '#fff0d0'); this.ugPool(tgt.clone().setY(0.04), 11, '#fff0d8'); B.pool.quad(new THREE.Vector3(tgt.x - 8, 0.035, tgt.z - 8), new THREE.Vector3(tgt.x + 8, 0.035, tgt.z - 8), new THREE.Vector3(tgt.x + 8, 0.035, tgt.z + 8), new THREE.Vector3(tgt.x - 8, 0.035, tgt.z + 8), '#ffffff', [[0, 0], [1, 0], [1, 1], [0, 1]], UP);
      if (k % 2 === 0) UB_blink(this, head.clone().setY(25), '#ff2a1a', k % 4 === 0); }
    // a ship at berth: dark hull, deck containers, a lit bridge house, mast lights
    { const s = sm, yaw = T.yawAt(s), e = edge(s), fs = far(s); if (fs > 80) { const c = T.pos(s, wS * (e + QUAY + 20), new THREE.Vector3(), 0); c.y = 0; const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), lw = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      B.props.box(c.x, -0.5, c.z, 22, 3, 150, yaw, '#7a1f22'); B.props.box(c.x, 2.5, c.z, 22, 7, 150, yaw, '#1c2230'); B.props.box(c.x + fw.x * 76, 2.5, c.z + fw.z * 76, 14, 7, 8, yaw, '#1c2230');
      for (let i = -5; i <= 4; i++) for (let j = -3; j <= 3; j++) { const hh = 1 + Math.floor(RNG() * 4); const q = c.clone().addScaledVector(fw, i * 12.6 + 6).addScaledVector(lw, j * 2.6); B.props.box(q.x, 9.5, q.z, 2.44, hh * 2.6, 12.1, yaw, pick(cols)); }
      const hb = c.clone().addScaledVector(fw, -64); B.props.box(hb.x, 9.5, hb.z, 20, 14, 14, yaw, '#d8d8dc'); for (let fl = 0; fl < 4; fl++) for (const f of [-1, 1]) { const q = hb.clone().addScaledVector(fw, f * 7.05); B.glow.box(q.x, 11 + fl * 3.2, q.z, 18, 0.9, 0.05, yaw, RNG() < 0.7 ? '#ffe2a8' : '#3a4250'); }
      B.props.box(hb.x - fw.x * 4, 23.5, hb.z - fw.z * 4, 3.4, 6, 3.4, yaw, '#c8321e'); B.props.box(hb.x + fw.x * 2, 23.5, hb.z + fw.z * 2, 0.3, 10, 0.3, yaw, '#999'); UB_blink(this, hb.clone().addScaledVector(fw, 2).setY(33.8), '#ffffff', false);
      for (const f of [-74, 74]) UB_blink(this, c.clone().addScaledVector(fw, f).setY(10.5), f > 0 ? '#2aff5a' : '#ff2a2a', f > 0); } }
    T.pos(d0 + 4, -wS * (edge(d0) + 1.2), p, 0); this.ugSign('dock', p.x, p.y + 2.3, p.z, T.yawAt(d0) + Math.PI, 4.4, p.y);
  },
  // ── Adhoora Pul: the unfinished metro bridge. Rebar and stripes at the gap, a tower crane over it, blinkers, the UDAAN board ──
  ugBridge(B) {
    const T = this.track, R = T.roof, g = R.gaps[0], g0 = R.s0 + g.x0, g1 = g0 + g.len, UB = this.ugB, p = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    const H = R.h, at = (s, d, y, out) => { T.pos(s, d, out, 0); out.y = y; return out; };
    for (const [e, dir] of [[g0, 1], [g1, -1]]) { const w = T.wAt(e) / 2, yaw = T.yawAt(e), fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(dir);
      for (let d = -w, i = 0; d < w - 0.01; d += 0.8, i++) { at(e - dir * 1.2, d, H + 0.03, pA); at(e - dir * 0.05, d, H + 0.03, pB); at(e - dir * 0.05, Math.min(d + 0.8, w), H + 0.03, pC); at(e - dir * 1.2, Math.min(d + 0.8, w), H + 0.03, pD); B.glow.quad(pA, pB, pC, pD, new THREE.Color(i % 2 ? '#141414' : UG.mari), undefined, UP); }
      at(e - dir * 0.04, -w - 0.8, H, pA); at(e - dir * 0.04, w + 0.8, H, pB); at(e - dir * 0.04, w + 0.8, H - 0.95, pC); at(e - dir * 0.04, -w - 0.8, H - 0.95, pD); B.props.quad(pA, pB, pC, pD, '#5a5560');
      for (let i = 0; i < 14; i++) { const d = -w + 0.4 + i * (2 * w - 0.8) / 13; at(e - dir * 0.05, d, H - 0.35 - (i % 3) * 0.2, pA); pB.copy(pA).addScaledVector(fw, 0.7 + RNG() * 1.6); pB.y -= 0.2 + RNG() * 1.3; pB.x += (RNG() - 0.5) * 0.4; this.beam(B.props, pA, pB, 0.05, '#8a5230'); }
      for (const sg of [-1, 1]) for (let k = 1; k <= 4; k++) { at(e - dir * (k * 3.2), sg * (w + 0.62), H + 1.2, p); (k % 2 ? UB.blinkA : UB.blinkB).box(p.x, p.y, p.z, 0.2, 0.2, 0.2, yaw, '#ffa21a'); } }
    // the hole below: sand, rubble, a dark pit
    { const s = (g0 + g1) / 2, yaw = T.yawAt(s); at(s, 0, 0.02, p); B.props.box(p.x, 0, p.z, T.wAt(s) + 6, 0.06, g.len + 6, yaw, '#2a2622');
      for (let i = 0; i < 16; i++) B.props.geom(BLOB, p.x + (RNG() - 0.5) * 12, 0.2, p.z + (RNG() - 0.5) * 12, RNG() * 6, 0.6 + RNG() * 1.4, 0.4 + RNG() * 0.9, 0.6 + RNG() * 1.4, pick(['#7a7480', '#8a7a62', '#5a5560'])); }
    // tower crane beside the gap, jib across the road, a beam hanging off the hook (it sways)
    { const s = g0 + 2, yaw = T.yawAt(s), w = T.wAt(s) / 2, sg = -this.ugDockSide || 1, m = at(s + 6, sg * (w + 10), 0, new THREE.Vector3());
      this.ugLattice(B, m.x, m.z, 40, 2.2, '#e8b21a', yaw); const lw = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(-sg);
      const j0 = m.clone().setY(40.5).addScaledVector(lw, -14), j1 = m.clone().setY(40.5).addScaledVector(lw, 46); this.beam(B.props, j0, j1, 1.0, '#e8b21a'); this.beam(B.props, j0.clone().setY(41.6), j1.clone().setY(41.6), 0.25, '#d09a10');
      B.props.box(j0.x + lw.x * 3, 37.5, j0.z + lw.z * 3, 2.4, 3, 3, yaw, '#8a8a90'); const top = m.clone().setY(47); this.beam(B.props, m.clone().setY(40.5), top, 0.6, '#e8b21a'); this.beam(B.props, top, j1.clone().setY(41.4), 0.08, '#999'); this.beam(B.props, top, j0.clone().setY(41.4), 0.08, '#999');
      B.props.box(m.x, 38.2, m.z, 2.6, 2.2, 2.6, yaw, '#d8d8dc'); UB_blink(this, top.clone().setY(47.6), '#ff2a1a', true); UB_blink(this, j1.clone().setY(41.8), '#ff2a1a', false);
      const hk = m.clone().setY(40).addScaledVector(lw, w + 10); const hb = new Batch(), M = new THREE.Matrix4();
      M.compose(new THREE.Vector3(0, -9, 0), new THREE.Quaternion(), new THREE.Vector3(0.05, 18, 0.05)); hb.add(UNIT_BOX, M, new THREE.Color('#222')); M.compose(new THREE.Vector3(0, -18.4, 0), new THREE.Quaternion(), new THREE.Vector3(0.6, 0.8, 0.6)); hb.add(UNIT_BOX, M, new THREE.Color('#e8b21a'));
      M.compose(new THREE.Vector3(0, -19.4, 0), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.7, 9)); hb.add(UNIT_BOX, M, new THREE.Color('#8a8590'));
      const geo = hb.build(); this.disposables.push(geo); const mesh = new THREE.Mesh(geo, this.ugM.train); mesh.position.copy(hk); mesh.rotation.y = yaw + Math.PI / 2; mesh.castShadow = true; this.group.add(mesh); this.ugHook = { mesh, yaw: yaw + Math.PI / 2 }; }
    // boards: kaam chalu at the foot of the ramp, adhoora pul on the ramp, UDAAN beyond the gap
    { const s = R.s0 - 18, w = T.wAt(s) / 2; T.pos(s, w + 1.4, p, 0); this.ugSign('kaam', p.x, p.y + 1.9, p.z, T.yawAt(s) + Math.PI, 4.2, p.y); T.pos(s + 4, -w - 1.4, p, 0); this.ugSign('kaam', p.x, p.y + 1.9, p.z, T.yawAt(s) + Math.PI, 4.2, p.y); }
    { const s = R.s0 + R.up + 8, w = T.wAt(s) / 2; for (const sg of [-1, 1]) { at(s, sg * (w + 0.6), H + 1.15, p); this.ugSign('pul', p.x, H + 1.2, p.z, T.yawAt(s) + Math.PI, 3.4); } }
    { const s = g1 + 22, w = T.wAt(s) / 2, sg = this.ugDockSide || 1; at(s, sg * (w + 3.5), 0, p); const yw = T.yawAt(s) + Math.PI + sg * 0.35; const bw = 12, hh = this.ugSign('udaan', p.x, H + 4.2, p.z, yw, bw);
      for (const k of [-1, 1]) { const q = p.clone().add(new THREE.Vector3(Math.cos(yw), 0, -Math.sin(yw)).multiplyScalar(k * bw * 0.4)); B.props.box(q.x, 0, q.z, 0.35, H + 4.2, 0.35, yw, '#3a3840'); }
      const fwd = new THREE.Vector3(Math.sin(yw), 0, Math.cos(yw)), q = p.clone().addScaledVector(fwd, 2.5); q.y = H + 4.2 + hh + 0.4; for (let k = -1; k <= 1; k += 2) { const r = q.clone().add(new THREE.Vector3(Math.cos(yw), 0, -Math.sin(yw)).multiplyScalar(k * 3)); B.glow.box(r.x, r.y, r.z, 0.5, 0.3, 0.5, yw, UG.hot); this.ugCone(r, p.clone().setY(H + 4.2 + hh * 0.4).add(new THREE.Vector3(Math.cos(yw), 0, -Math.sin(yw)).multiplyScalar(k * 2.5)), 2.6, '#ffe2b0'); } }
    // work lights on the ground under the gap, pointing up at the jump
    { const s = (g0 + g1) / 2; for (const sg of [-1, 1]) { const b = at(s - 10, sg * (T.wAt(s) / 2 + 4), 0.6, new THREE.Vector3()); B.props.box(b.x, 0, b.z, 0.8, 0.6, 0.8, 0, '#2a2a2e'); B.glow.box(b.x, 0.6, b.z, 0.7, 0.2, 0.7, 0, UG.hot); this.lampHeads.push(b.clone().setY(0.9)); } }
    // portable work-light masts along the deck (not too near the gap), warm pools on the concrete
    for (let x = R.up + 6, k = 0; x < R.len - R.up - 2; x += 34, k++) { const s = R.s0 + x; if (Math.abs(s - (g0 + g1) / 2) < 14) continue; const sg = k % 2 ? 1 : -1, w = T.wAt(s) / 2, yaw = T.yawAt(s);
      at(s, sg * (w + 0.62), H + 1.15, p); B.props.box(p.x, p.y, p.z, 0.12, 4.2, 0.12, yaw, '#e8b21a'); const hd = at(s, sg * (w - 0.3), H + 5.3, new THREE.Vector3()); this.beam(B.props, p.clone().setY(H + 5.3), hd, 0.1, '#e8b21a');
      B.glow.box(hd.x, hd.y - 0.15, hd.z, 0.9, 0.3, 0.35, yaw, '#fff4dc'); this.lampHeads.push(hd.clone()); const g2 = at(s + 1, sg * w * 0.3, H + 0.04, new THREE.Vector3()); this.ugCone(hd.clone().setY(hd.y - 0.3), g2, 5, '#fff0d0'); this.ugPool(g2, 7, '#ffe8c0'); }
  },
  // ── the salt-pan kachha road: pans and bunds, fences, pylons with sagging wires, wooden floodlight poles, fog, a broken-down truck ──
  ugKachha(B) {
    const T = this.track, [k0, k1] = T.ug.kachha, UB = this.ugB, p = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    const edge = (s) => T.wAt(s) / 2 + 2.6 + 1.6, kAt = (s) => wrapAngle(T.yawAt(s + 1) - T.yawAt(s - 1)) / 2;
    // pans: 16 m cells in rows on both sides; salt, brine and dry crust
    for (const sg of [-1, 1]) for (let s = k0 + 4; s < k1 - 16; s += 16) { const k = kAt(s + 8), inner = Math.sign(k) === sg && Math.abs(k) > 1e-3, lim = inner ? 1 / Math.abs(k) - edge(s) - 6 : 1e9;
      for (let r = 0; r < 5; r++) { const a = 5 + r * 12, b = a + 11; if (b > lim) break; T.pos(s + 8, sg * (edge(s) + (a + b) / 2), p, 0); if (T.clearance(p.x, p.z) < (a + b) / 2 - 2) break;
        const c = pick(['#e6dde6', '#ddd2dc', '#9aa2b0', '#6e7686', '#c9bfb4', '#efe6ea']); T.pos(s + 0.4, sg * (edge(s) + a), pA, 0.02); T.pos(s + 15.6, sg * (edge(s + 15.6) + a), pB, 0.02); T.pos(s + 15.6, sg * (edge(s + 15.6) + b), pC, 0.02); T.pos(s + 0.4, sg * (edge(s) + b), pD, 0.02); B.props.quad(pA, pB, pC, pD, c, undefined, UP);
        T.pos(s, sg * (edge(s) + a - 0.5), pA, 0.08); T.pos(s + 16, sg * (edge(s + 16) + a - 0.5), pB, 0.08); T.pos(s + 16, sg * (edge(s + 16) + a + 0.1), pC, 0.08); T.pos(s, sg * (edge(s) + a + 0.1), pD, 0.08); B.props.quad(pA, pB, pC, pD, '#6a5a48', undefined, UP); } }
    // fence posts with a sagging wire
    for (const sg of [-1, 1]) { let prev = null; for (let s = k0; s < k1; s += 4) { T.pos(s, sg * (edge(s) + 0.6), p, 0); B.props.box(p.x, p.y, p.z, 0.1, 1.3, 0.1, T.yawAt(s) + (RNG() - 0.5) * 0.3, '#4a3a2a'); const top = p.clone().setY(p.y + 1.15); if (prev) this.sag(B.props, prev, top, 0.12, 0.02, '#2a2a2a', 3); prev = top; if ((s / 4) % 3 === 0) this.whoosh.push({ s, d: sg * (edge(s) + 0.6), k: 'post' }); } }
    // babool scrub and a few neem trees beyond the fence
    for (const sg of [-1, 1]) for (let s = k0 + 6; s < k1 - 6; s += 9 + RNG() * 10) { T.pos(s, sg * (edge(s) + 2.2 + RNG() * 2.5), p, 0); if (T.clearance(p.x, p.z) < 3) continue;
      if (RNG() < 0.22) this.tree(B, p.x, 0, p.z, 4.5 + RNG() * 2.5); else for (let j = 0; j < 3; j++) B.props.geom(BLOB, p.x + (RNG() - 0.5) * 1.6, 0.35 + RNG() * 0.5, p.z + (RNG() - 0.5) * 1.6, RNG() * 6, 0.7 + RNG() * 0.5, 0.5 + RNG() * 0.4, 0.7 + RNG() * 0.5, pick(['#3f6b2f', '#4f7d35', '#5a7a30', '#2f5a28'])); }
    // pylons and their wires
    const sgP = -(this.ugDockSide || 1), pyl = [];
    for (let s = k0 + 20; s < k1 - 10; s += 92) { T.pos(s, sgP * (edge(s) + 22), p, 0); p.y = 0; if (T.clearance(p.x, p.z) < 12) continue; const yaw = T.yawAt(s);
      this.ugLattice(B, p.x, p.z, 26, 5, '#6a6a72', yaw, 1.4); const lw = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); for (const y of [20, 24]) this.beam(B.props, p.clone().setY(y).addScaledVector(lw, -5), p.clone().setY(y).addScaledVector(lw, 5), 0.25, '#6a6a72');
      pyl.push([p.clone(), lw]); UB_blink(this, p.clone().setY(26.6), '#ff2a1a', pyl.length % 2 === 0); }
    for (let i = 0; i + 1 < pyl.length; i++) { const [a, la] = pyl[i], [b, lb] = pyl[i + 1]; for (const [k, y] of [[-4.6, 20], [4.6, 20], [-4.6, 24], [4.6, 24]]) this.sag(B.props, a.clone().setY(y - 0.4).addScaledVector(la, k), b.clone().setY(y - 0.4).addScaledVector(lb, k), 2.6, 0.04, '#1a1a1a', 10); }
    // wooden floodlight poles: one bare lamp each, a cone of light, a warm pool on the dirt
    for (let s = k0 + 12, k = 0; s < k1 - 8; s += 46, k++) { const sg = k % 2 ? 1 : -1, yaw = T.yawAt(s); T.pos(s, sg * (edge(s) + 1.4), p, 0); B.props.box(p.x, p.y, p.z, 0.22, 8.4, 0.22, yaw, '#5a4636');
      const hd = T.pos(s, sg * (edge(s) - 0.4), new THREE.Vector3(), 8.2); this.beam(B.props, p.clone().setY(p.y + 8.2), hd, 0.1, '#5a4636'); B.glow.box(hd.x, hd.y - 0.2, hd.z, 0.5, 0.25, 0.4, yaw, UG.hot); this.lampHeads.push(hd.clone());
      const g = T.pos(s + 2, sg * (T.wAt(s) / 2 - 2.0), new THREE.Vector3(), 0); this.ugCone(hd.clone().setY(hd.y - 0.3), g, 6.5, '#ffd8a0'); this.ugPool(g.clone().setY(g.y + 0.04), 7.5, '#ffc070'); }
    // the HORN OK PLEASE truck on the verge, hazards blinking
    { const s = k0 + (k1 - k0) * 0.36, sg = sgP, yaw = T.yawAt(s); const c = T.pos(s, sg * (T.wAt(s) / 2 + 3.6), new THREE.Vector3(), 0); const fw = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), lw = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const q = (a, b) => c.clone().addScaledVector(fw, a).addScaledVector(lw, b);
      let r = q(2.6, 0); B.props.box(r.x, 0.6, r.z, 2.2, 2.0, 1.9, yaw, '#e8762a'); B.props.box(r.x, 2.6, r.z, 2.3, 0.4, 2.0, yaw, '#2f8a3e'); r = q(3.56, 0); B.props.box(r.x, 1.5, r.z, 1.9, 0.9, 0.06, yaw, '#1a2430');
      r = q(-1.6, 0); B.props.box(r.x, 0.9, r.z, 2.3, 0.3, 6.2, yaw, '#6b3e26'); B.props.box(r.x, 1.2, r.z, 2.35, 1.9, 6.2, yaw, '#1d4fa0');
      for (const [a, b] of [[2.6, -1.0], [2.6, 1.0], [-0.4, -1.05], [-0.4, 1.05], [-3.4, -1.05], [-3.4, 1.05]]) { r = q(a, b); B.props.geom(WHEEL_G, r.x, 0.48, r.z, yaw, 2.2, 2.2, 2.2, '#141414'); }
      r = q(-4.73, 0); this.facing(UB.sign, r, yaw + Math.PI, 2.2, 1.35, 1.35 + 2.2 / UG_UV.hornok[4], UG_UV.hornok);
      for (const [a, b, ph] of [[-4.74, -0.95, true], [-4.74, 0.95, true], [3.58, -0.9, false], [3.58, 0.9, false]]) { r = q(a, b); UB_blink(this, r.setY(1.05), '#ffa21a', ph, 0.16); }
      r = q(-6.5, -sg * 1.2); B.props.geom(CONE_G, r.x, 0, r.z, 0, 0.25, 0.7, 0.25, '#ff6a1a'); r = q(-8.5, -sg * 1.6); B.props.geom(CONE_G, r.x, 0, r.z, 0, 0.25, 0.7, 0.25, '#ff6a1a'); }
    // ground fog over the pans
    { const n = this.opts.quality === 'low' ? 40 : 90, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const s = k0 + RNG() * (k1 - k0), d = (RNG() < 0.5 ? -1 : 1) * (T.wAt(s) / 2 + 3 + RNG() * 40); T.pos(s, d, p, 0); pos.set([p.x, 0.8 + RNG() * 1.6, p.z], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.PointsMaterial({ map: TEX.soft, size: 26, sizeAttenuation: true, transparent: true, depthWrite: false, color: 0x8a8ca8, opacity: 0.16 });
      this.ugFog = new THREE.Points(g, m); this.group.add(this.ugFog); this.disposables.push(g, m); }
    T.pos(k0 - 6, (T.wAt(k0) / 2 + 2.0), p, 0); this.ugSign('salt', p.x, p.y + 2.1, p.z, T.yawAt(k0) + Math.PI, 4.4, p.y);
  },
  // ── the market: neon hoardings and chasing festoon bulbs across the road ──
  ugMarket(B) {
    const T = this.track, [m0, m1] = T.ug.market, p = new THREE.Vector3();
    for (let s = m0 + 20, k = 0; s < m1 - 14; s += 34, k++) { const sg = k % 2 ? 1 : -1, yaw = T.yawAt(s); T.pos(s, sg * (T.wAt(s) / 2 + 2.6), p, 0); this.ugSign(k % 2 ? 'neon2' : 'neon1', p.x, p.y + 4.2, p.z, yaw + Math.PI + sg * 0.5, 5.2, p.y); }
    for (let s = m0 + 8, k = 0; s < m1 - 6; s += 13, k++) { const w = T.wAt(s) / 2 + 2.2, a = T.pos(s, -w, new THREE.Vector3(), 6.2), b = T.pos(s + 1.5, w, new THREE.Vector3(), 6.4); const pts = this.sag(B.props, a, b, 0.9, 0.02, '#222', 14);
      pts.forEach((q, i) => { if (i === 0 || i === pts.length - 1) return; const col = ['#ff2e88', '#ffd23f', '#3fd0c9', '#ff7a2f', '#9be15d'][(i + k) % 5]; ((i + k) % 2 ? this.ugB.blinkA : this.ugB.blinkB).box(q.x, q.y - 0.16, q.z, 0.16, 0.16, 0.16, 0, col); }); }
  },
  // ── nitro strips: glowing chevrons on the tarmac with cyan edge bars ──
  ugNitros(B) {
    const T = this.track, UB = this.ugB, pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
    for (const n of T.nitros || []) { const rows = 4, dl = n.len / rows;
      for (let i = 0; i < rows; i++) { const s0 = n.s + i * dl, s1 = s0 + dl; T.pos(s0, n.d - n.hw, pA, 0.02); T.pos(s1, n.d - n.hw, pB, 0.02); T.pos(s1, n.d + n.hw, pC, 0.02); T.pos(s0, n.d + n.hw, pD, 0.02); UB.nitro.quad(pA, pB, pC, pD, '#ffffff', [[0, i * dl / 2.5], [0, (i + 1) * dl / 2.5], [1, (i + 1) * dl / 2.5], [1, i * dl / 2.5]], UP);
        for (const sg of [-1, 1]) { T.pos(s0 + dl / 2, n.d + sg * (n.hw + 0.12), pA, 0.04); B.glow.box(pA.x, pA.y, pA.z, 0.1, 0.05, dl - 0.1, T.yawAt(s0 + dl / 2), '#3fe8ff'); } } }
  },
  ugMood(nt, wet) {
    if (!this.ugRT) return;
    const U = this.skyMat.uniforms; U.top.value.set(wet ? '#0a0b14' : '#0e0d1e'); U.mid.value.set(wet ? '#1f2030' : '#2a2140'); U.hor.value.set(wet ? '#454052' : '#6a3c48'); U.night.value = 0; U.sunCol.value.multiplyScalar(0.15);
    this.ugSky = { top: U.top.value.clone(), mid: U.mid.value.clone(), hor: U.hor.value.clone() };
    this.fog.color.set(wet ? '#2a2a38' : '#352a40'); this.fog.near = wet ? 26 : 34; this.fog.far = wet ? 280 : 360;
    this.ugM.sign.emissive.set('#ffffff').multiplyScalar(nt ? 0.8 : 0.3); this.ugM.sea.color.set(wet ? '#0a121c' : '#0b1724');
    this.ugM.cone.opacity = nt ? 0.55 : 0.18; this.ugM.cpool.opacity = nt ? 0.6 : 0.25; this.hemiBaseUG = this.hemiBase;
  },
  updateUnderground(dt, t, camera, focus) {
    const T = this.track, M = this.ugM;
    TEX.ugLed.offset.x -= dt * 1.4; TEX.ugNitro.offset.y -= dt * 1.8; TEX.ugWater.offset.y += dt * 2.6;
    const on = (t % 0.9) < 0.45; if (this.ugMesh.blinkA) this.ugMesh.blinkA.visible = on; if (this.ugMesh.blinkB) this.ugMesh.blinkB.visible = !on;
    // the metro trial run: wait in the station, run out to the gantry, wait, come back
    const m = this.metroS; if (m) { m.t -= dt;
      if (m.phase === 'dwell' || m.phase === 'wait') { if (m.t <= 0) { m.from = m.x; m.to = m.phase === 'dwell' ? m.sEnd - m.sC : 0; m.dur = Math.abs(m.to - m.from) / 13; m.t = m.dur; m.phase = 'run'; this.ugMetroDepart = true; } }
      else { const k = 1 - clamp(m.t / m.dur, 0, 1), e = k * k * (3 - 2 * k); m.x = m.from + (m.to - m.from) * e; if (m.t <= 0) { m.x = m.to; m.phase = m.to === 0 ? 'dwell' : 'wait'; m.t = m.to === 0 ? 7 : 3; } }
      this.placeMetro(); this.ugMetroNear = focus && this.metro.visible && m.phase === 'run' ? clamp(1 - this.metro.position.distanceTo(focus) / 34, 0, 1) : 0; }
    for (const c of this.ugCranes || []) { const k = 0.5 - 0.5 * Math.cos((t + c.ph) * 0.35); c.mesh.position.lerpVectors(c.from, c.to, k); }
    if (this.ugHook) { this.ugHook.mesh.rotation.z = Math.sin(t * 0.7) * 0.05; this.ugHook.mesh.rotation.y = this.ugHook.yaw + Math.sin(t * 0.23) * 0.3; }
    // the tunnel: the sky light fades inside; a warm point light rides the nearest fixture over the player
    const zs = this.ugS != null ? T.zoneAt(this.ugS) : null, inT = zs === 'tunnel'; this.ugCover = inT;
    this.hemiMul = smooth(this.hemiMul, inT ? 0.32 : 1, 3, dt);
    const L = this.ugLamp, TU = this.ugTunnel; if (L && TU) { if (inT && this.ugS != null) { const i = Math.round((T.wrapD(this.ugS - TU.fix[0]) + 2.2) / 4.5); const sf = TU.fix[clamp(i, 0, TU.fix.length - 1)]; T.pos(sf, 0, L.position, TU.CROWN - 1.2); L.intensity = smooth(L.intensity, 38, 6, dt); } else L.intensity = smooth(L.intensity, 0, 6, dt); }
    // storm: lightning over the open sections (never in the tunnel)
    if (!REDUCED_MOTION && focus) { this.boltT -= dt; if (this.boltT < 0) { this.boltT = 8 + Math.random() * 14; if (!inT) { const el = $('#lightning'); if (el) { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); } this.flash = 0.5; AUDIO.thunder && AUDIO.thunder(0.35 + Math.random() * 1.4); } } }
    if (this.ugSky) { const U = this.skyMat.uniforms, k = this.flash > 0 ? (this.flash > 0.3 || (this.flash > 0.1 && this.flash < 0.2) ? 1 : 0.25) * Math.min(1, this.flash * 4) : 0; U.top.value.copy(this.ugSky.top).lerp(_ugFlash, k * 0.35); U.mid.value.copy(this.ugSky.mid).lerp(_ugFlash, k * 0.6); U.hor.value.copy(this.ugSky.hor).lerp(_ugFlash, k * 0.4); }
  },
});
const _ugFlash = new THREE.Color('#aab4ff');
// a blinking marker light (two phases so neighbours alternate)
function UB_blink(W, p, color, phaseA, size = 0.45) { (phaseA ? W.ugB.blinkA : W.ugB.blinkB).box(p.x, p.y - size / 2, p.z, size, size, size, 0, color); }
