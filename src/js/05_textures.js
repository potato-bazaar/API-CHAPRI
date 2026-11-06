// ───────────────────────── PROCEDURAL TEXTURES ─────────────────────────
// Everything is drawn into canvases at load, so the game ships with no image files.
const FONT_DISPLAY = '"Baloo 2", "Noto Sans Devanagari", system-ui, sans-serif';
const FONT_NUM = '"Teko", "Arial Narrow", system-ui, sans-serif';
const TEX = {};
const SIGN_UV = {};

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(c, { repeat = false, srgb = true, aniso = 4, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}
function noise(ctx, w, h, n, a, cols) { for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.globalAlpha = a * Math.random(); const s = 1 + Math.random() * 2.5; ctx.fillRect(Math.random() * w, Math.random() * h, s, s); } ctx.globalAlpha = 1; }

function buildTextures() {
  RNG = mulberry32(42);
  // Road: u spans road width (0 = right edge, 1 = left edge), v runs along the lap (1 tile = 12 m)
  {
    // Asphalt (Auto Rush lesson: a road reads as real from its grain, its wear and its paint, not from detail). The tile
    // covers 24 m so stains don't visibly repeat. Dark cool base, fine aggregate, darker wheel paths, a few repairs.
    const [c, x] = mkCanvas(256, 1024);
    x.fillStyle = '#3d3b43'; x.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 7; i++) { const px = Math.random() * 200, py = Math.random() * 980, pw = 30 + Math.random() * 70, ph = 40 + Math.random() * 140; x.fillStyle = Math.random() < 0.5 ? 'rgba(20,19,24,0.32)' : 'rgba(92,88,98,0.16)'; x.fillRect(px, py, pw, ph); x.strokeStyle = 'rgba(18,16,22,0.35)'; x.lineWidth = 1; x.strokeRect(px, py, pw, ph); }   // patch repairs
    for (const u of [0.17, 0.33, 0.67, 0.83]) { const g = x.createLinearGradient((u - 0.06) * 256, 0, (u + 0.06) * 256, 0); g.addColorStop(0, 'rgba(18,16,22,0)'); g.addColorStop(0.5, 'rgba(18,16,22,0.28)'); g.addColorStop(1, 'rgba(18,16,22,0)'); x.fillStyle = g; x.fillRect((u - 0.06) * 256, 0, 0.12 * 256, 1024); }   // wheel paths
    noise(x, 256, 1024, 26000, 0.42, ['#232128', '#57545e', '#2f2d35', '#67646e', '#46434c', '#1c1b20']);
    for (let i = 0; i < 9; i++) { const px = Math.random() * 256, py = Math.random() * 1024, r = 10 + Math.random() * 28; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(12,10,16,0.42)'); g.addColorStop(1, 'rgba(12,10,16,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(px, py, r, r * (1.2 + Math.random()), Math.random() * 3, 0, 7); x.fill(); }   // oil drips
    x.strokeStyle = 'rgba(16,14,20,0.55)'; x.lineWidth = 1.1;
    for (let i = 0; i < 9; i++) { x.beginPath(); let px = Math.random() * 256, py = Math.random() * 1024; x.moveTo(px, py); for (let k = 0; k < 7; k++) { px += (Math.random() - 0.5) * 26; py += Math.random() * 22; x.lineTo(px, py); } x.stroke(); }   // cracks
    for (let y = 0; y < 1024; y += 4) { const a = 0.55 + Math.random() * 0.35; x.fillStyle = `rgba(236,232,224,${a.toFixed(2)})`; x.fillRect(7, y, 4, 4); x.fillRect(245, y, 4, 4); }   // worn edge lines
    TEX.road = toTex(c, { repeat: true, aniso: 8 });
  }
  {
    const [c, x] = mkCanvas(32, 64);
    x.fillStyle = '#ffc21a'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#17141a'; x.fillRect(0, 32, 32, 32);
    TEX.kerb = toTex(c, { repeat: true });
  }
  {
    const [c, x] = mkCanvas(128, 128);
    x.fillStyle = '#a89c8c'; x.fillRect(0, 0, 128, 128); noise(x, 128, 128, 1500, 0.3, ['#8c8070', '#bfb3a2']);
    x.strokeStyle = 'rgba(70,60,52,0.55)'; x.lineWidth = 2; for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    TEX.pave = toTex(c, { repeat: true });
  }
  // City facade: 4 bays × 4 floors per tile (12 m × 12 m). White wall is tinted by vertex colour.
  {
    const [c, x] = mkCanvas(512, 512); const [ce, xe] = mkCanvas(512, 512); xe.fillStyle = '#000'; xe.fillRect(0, 0, 512, 512);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 512);
    noise(x, 512, 512, 4000, 0.18, ['#d8d0c4', '#ffffff', '#c8bcb0']);
    for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
      const X = bx * 128, Y = fy * 128;
      const lit = Math.random() < 0.28;
      x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(X + 18, Y + 26, 94, 80);
      x.fillStyle = lit ? '#ffcf7a' : (Math.random() < 0.5 ? '#3a4656' : '#4b5466'); x.fillRect(X + 24, Y + 30, 82, 70);
      if (lit) { xe.fillStyle = Math.random() < 0.8 ? '#ffc070' : '#9fe0ff'; xe.fillRect(X + 26, Y + 32, 78, 66); }
      if (!lit && Math.random() < 0.5) { x.fillStyle = 'rgba(120,140,160,0.35)'; x.fillRect(X + 24, Y + 30, 40, 70); }
      x.strokeStyle = '#e9e2d6'; x.lineWidth = 5; x.strokeRect(X + 24, Y + 30, 82, 70); x.beginPath(); x.moveTo(X + 65, Y + 30); x.lineTo(X + 65, Y + 100); x.stroke();
      x.fillStyle = 'rgba(40,30,30,0.35)'; x.fillRect(X + 18, Y + 102, 94, 8);
      if (Math.random() < 0.35) { x.fillStyle = '#d9dcdf'; x.fillRect(X + 70, Y + 84, 34, 22); x.fillStyle = '#9aa0a6'; for (let k = 0; k < 4; k++) x.fillRect(X + 73, Y + 87 + k * 5, 28, 2); }
      if (Math.random() < 0.25) { x.strokeStyle = '#555'; x.lineWidth = 2; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(X + 22 + k * 16, Y + 102); x.lineTo(X + 22 + k * 16, Y + 120); x.stroke(); } x.beginPath(); x.moveTo(X + 18, Y + 104); x.lineTo(X + 112, Y + 104); x.stroke(); }
    }
    const gr = x.createLinearGradient(0, 380, 0, 512); gr.addColorStop(0, 'rgba(60,40,30,0)'); gr.addColorStop(1, 'rgba(60,40,30,0.28)'); x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 18; i++) { x.fillStyle = 'rgba(70,55,45,0.12)'; x.fillRect(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 5, 40 + Math.random() * 90); }
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 6, 6); // plain-wall pixel for roofs
    TEX.facade = toTex(c, { repeat: true, aniso: 8 });
    TEX.facadeEmit = toTex(ce, { repeat: true });
  }
  // Basti facade: rough plaster, small windows, doors (tile 6 m × 6 m)
  {
    const [c, x] = mkCanvas(256, 256);
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    noise(x, 256, 256, 3500, 0.3, ['#cfc4b4', '#ffffff', '#b8ab98', '#e8dccb']);
    for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(90,70,50,0.18)'; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 30, 6 + Math.random() * 18, 0, 0, 7); x.fill(); }
    x.fillStyle = '#3b3530'; x.fillRect(30, 40, 46, 40); x.fillStyle = '#2b5d7a'; x.fillRect(150, 30, 60, 46);
    x.strokeStyle = '#6b5a48'; x.lineWidth = 4; x.strokeRect(30, 40, 46, 40); x.strokeRect(150, 30, 60, 46);
    x.fillStyle = '#5a3b26'; x.fillRect(96, 150, 50, 106); x.fillStyle = '#3e8e8a'; x.fillRect(190, 168, 44, 88);
    x.strokeStyle = 'rgba(40,30,20,0.5)'; x.lineWidth = 1; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(190 + k * 8, 168); x.lineTo(190 + k * 8, 256); x.stroke(); }
    x.fillStyle = 'rgba(30,60,140,0.85)'; x.fillRect(10, 128, 70, 30); // tarp patch
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 6, 6);
    TEX.basti = toTex(c, { repeat: true });
  }
  {
    const [c, x] = mkCanvas(128, 128);
    for (let i = 0; i < 128; i += 8) { const g = x.createLinearGradient(i, 0, i + 8, 0); g.addColorStop(0, '#7a3a1e'); g.addColorStop(0.5, '#c06a3a'); g.addColorStop(1, '#6a3018'); x.fillStyle = g; x.fillRect(i, 0, 8, 128); }
    noise(x, 128, 128, 1400, 0.45, ['#4a2210', '#d98a50', '#8a4a2a']);
    TEX.tin = toTex(c, { repeat: true });
  }
  {
    const [c, x] = mkCanvas(128, 128);
    x.fillStyle = '#1f5fbf'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 6) { x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(i, 0, 2, 128); x.fillRect(0, i, 128, 2); }
    noise(x, 128, 128, 600, 0.3, ['#163f80', '#3a7ee0']);
    TEX.tarp = toTex(c, { repeat: true });
  }
  buildShopAtlas();
  buildSignAtlas();
  {
    const [c, x] = mkCanvas(64, 64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); TEX.soft = toTex(c, { srgb: false });
  }
  {
    const [c, x] = mkCanvas(64, 64);
    x.translate(32, 32); x.fillStyle = '#fff'; x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 30, a = i / 10 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.fill(); TEX.star = toTex(c, { srgb: false });
  }
  {
    const [c, x] = mkCanvas(128, 128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(0.15, 'rgba(255,200,120,0.7)'); g.addColorStop(0.5, 'rgba(255,160,60,0.15)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); TEX.glow = toTex(c, { srgb: false });
  }
  {
    const [c, x] = mkCanvas(128, 128);
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${200 + Math.random() * 55},${230 + Math.random() * 25},255,${0.5 + Math.random() * 0.5})`; x.save(); x.translate(Math.random() * 128, Math.random() * 128); x.rotate(Math.random() * 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(6 + Math.random() * 8, 2); x.lineTo(3, 6 + Math.random() * 5); x.closePath(); x.fill(); x.restore(); }
    TEX.glass = toTex(c, { srgb: false });
  }
  {
    const [c, x] = mkCanvas(128, 128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); TEX.blob = toTex(c, { srgb: false });
  }
  for (const k of ['chain', 'belt', 'bottle', 'gutka', 'oil', 'rod', 'katta']) TEX['icon_' + k] = toTex(drawPickupIcon(k));
  // a ring of light for weapon swings (bright outer edge, clear centre) and a gutka splat for the road
  { const [c, x] = mkCanvas(128, 128); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0)'); g.addColorStop(0.86, 'rgba(255,250,220,0.9)'); g.addColorStop(0.97, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); TEX.swoosh = toTex(c, { srgb: false }); }
  { const [c, x] = mkCanvas(128, 128); for (let i = 0; i < 22; i++) { const r = 8 + Math.random() * 26, px = 64 + (Math.random() - 0.5) * 70, py = 64 + (Math.random() - 0.5) * 70; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(150,20,14,0.95)'); g.addColorStop(0.7, 'rgba(110,14,10,0.85)'); g.addColorStop(1, 'rgba(90,10,8,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
    for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(255,190,170,0.5)'; x.beginPath(); x.ellipse(30 + Math.random() * 68, 30 + Math.random() * 68, 2 + Math.random() * 4, 1 + Math.random() * 2, Math.random() * 3, 0, 7); x.fill(); } TEX.gutkaSplat = toTex(c, { srgb: true }); }
  // grass verge: tufts and bare patches, read from a distance as a green strip between the road and the buildings
  { const [c, x] = mkCanvas(256, 256); x.fillStyle = '#4b6a2e'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 14; i++) { const px = Math.random() * 256, py = Math.random() * 256, r = 14 + Math.random() * 40; const g = x.createRadialGradient(px, py, 0, px, py, r); const bare = Math.random() < 0.3; g.addColorStop(0, bare ? 'rgba(120,98,64,0.55)' : 'rgba(40,70,28,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
    noise(x, 256, 256, 9000, 0.5, ['#3a5a24', '#6a8a3a', '#2e4a1e', '#7e9a46', '#55703a']); TEX.grass = toTex(c, { repeat: true }); }
  // Asphalt-ish ground
  {
    const [c, x] = mkCanvas(256, 256);
    x.fillStyle = '#5e5248'; x.fillRect(0, 0, 256, 256); noise(x, 256, 256, 6000, 0.35, ['#4a4038', '#6e6256', '#544a40', '#7a6a58']);
    TEX.ground = toTex(c, { repeat: true });
  }
  TEX.haz = hazardAtlas(); TEX.dirt = dirtTexture(); TEX.shortcut = shortcutSign(); TEX.naka = nakaSign(); TEX.nakaAhead = nakaAheadSign(); TEX.hairPomp = hairStrands();
}
// Road hazards atlas, 2×2 cells: pothole dry | pothole wet (water) / kichad dry | kichad wet
function hazardAtlas() {
  const [c, x] = mkCanvas(512, 512); const R = mulberry32(77);
  const blob = (cx, cy, r, n, jag) => { x.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 - jag + jag * 2 * R()); i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); };
  for (const wet of [0, 1]) {
    const ox = wet * 256 + 128, oy = 128;
    // broken tarmac rim, then the hole
    x.fillStyle = '#5b5650'; blob(ox, oy, 118, 26, 0.12); x.fill();
    for (let i = 0; i < 18; i++) { const a = R() * 6.28, d = 95 + R() * 25; x.fillStyle = R() < 0.5 ? '#6e6860' : '#3e3a36'; blob(ox + Math.cos(a) * d, oy + Math.sin(a) * d, 6 + R() * 10, 7, 0.3); x.fill(); }
    const g = x.createRadialGradient(ox, oy, 10, ox, oy, 100);
    if (!wet) { g.addColorStop(0, '#141210'); g.addColorStop(0.7, '#25211d'); g.addColorStop(1, '#3a342e'); }
    else { g.addColorStop(0, '#5d6b7c'); g.addColorStop(0.55, '#46525f'); g.addColorStop(0.9, '#2e3540'); g.addColorStop(1, '#3a342e'); }
    x.fillStyle = g; blob(ox, oy, 100, 22, 0.14); x.fill();
    if (!wet) { x.strokeStyle = 'rgba(20,18,16,0.8)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { const a = R() * 6.28; x.beginPath(); x.moveTo(ox + Math.cos(a) * 100, oy + Math.sin(a) * 100); x.lineTo(ox + Math.cos(a + 0.2) * 125, oy + Math.sin(a + 0.2) * 125); x.stroke(); }
      noise(x, 512, 256, 900, 0.4, ['#0d0b0a', '#3a342e']); }
    else { x.globalAlpha = 0.55; x.fillStyle = '#c8d4e2'; x.beginPath(); x.ellipse(ox - 25, oy - 30, 45, 9, -0.5, 0, 7); x.fill(); x.globalAlpha = 0.3; x.beginPath(); x.ellipse(ox + 30, oy + 20, 30, 6, -0.5, 0, 7); x.fill(); x.globalAlpha = 1; }
  }
  for (const wet of [0, 1]) {
    const ox = wet * 256 + 128, oy = 384;
    x.fillStyle = wet ? '#3e2814' : '#6b4a2b'; blob(ox, oy, 120, 30, 0.18); x.fill();
    for (let i = 0; i < 26; i++) { x.fillStyle = wet ? (R() < 0.5 ? '#2c1a0c' : '#5a3e24') : (R() < 0.5 ? '#4a321c' : '#8a6a45'); blob(ox + (R() - 0.5) * 180, oy + (R() - 0.5) * 180, 6 + R() * 16, 8, 0.35); x.fill(); }
    x.strokeStyle = wet ? 'rgba(20,12,6,0.7)' : 'rgba(40,26,14,0.6)'; x.lineWidth = 7;  // tyre ruts
    for (const off of [-30, 25]) { x.beginPath(); x.moveTo(ox + off, oy - 115); x.bezierCurveTo(ox + off + 20, oy - 40, ox + off - 20, oy + 40, ox + off + 8, oy + 115); x.stroke(); }
    if (wet) { x.globalAlpha = 0.45; x.fillStyle = '#9a8a78'; for (let i = 0; i < 7; i++) { x.beginPath(); x.ellipse(ox + (R() - 0.5) * 140, oy + (R() - 0.5) * 140, 10 + R() * 20, 4 + R() * 6, R(), 0, 7); x.fill(); } x.globalAlpha = 1; }
  }
  return toTex(c);
}
function dirtTexture() {
  const [c, x] = mkCanvas(256, 256); const R = mulberry32(91);
  x.fillStyle = '#8a6a45'; x.fillRect(0, 0, 256, 256); noise(x, 256, 256, 7000, 0.5, ['#6e5234', '#9c7c55', '#5a4028', '#a88a62']);
  for (let i = 0; i < 90; i++) { x.fillStyle = R() < 0.5 ? '#b8a690' : '#7a7068'; x.beginPath(); x.ellipse(R() * 256, R() * 256, 1.5 + R() * 3, 1 + R() * 2, R() * 3, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(60,40,22,0.45)'; x.lineWidth = 9; for (const u of [80, 176]) { x.beginPath(); x.moveTo(u, 0); x.lineTo(u, 256); x.stroke(); }
  return toTex(c, { repeat: true });
}
function shortcutSign() {
  const [c, x] = mkCanvas(512, 256);
  x.fillStyle = '#ffc21a'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#141414'; x.lineWidth = 14; x.strokeRect(10, 10, 492, 236);
  x.fillStyle = '#141414'; x.font = '800 92px "Baloo 2", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SHORTCUT', 230, 92);
  x.font = '800 60px "Baloo 2", sans-serif'; x.fillText('शॉर्टकट', 230, 182);
  x.beginPath(); x.moveTo(420, 70); x.lineTo(490, 128); x.lineTo(420, 186); x.lineTo(420, 150); x.lineTo(380, 150); x.lineTo(380, 106); x.lineTo(420, 106); x.closePath(); x.fill();
  return toTex(c);
}

// sculpted hair strands: streaks running along v (crown → hairline), a sheen band where the roll catches light
function hairStrands() {
  const [c, x] = mkCanvas(256, 256); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#7a7a7a'); g.addColorStop(0.3, '#a8a8a8'); g.addColorStop(0.5, '#e2e2e2'); g.addColorStop(0.68, '#9a9a9a'); g.addColorStop(1, '#505050');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { const u = Math.random() * 256, w = 0.6 + Math.random() * 2.2, l = Math.random(); x.strokeStyle = l < 0.5 ? `rgba(20,14,10,${0.25 + Math.random() * 0.35})` : `rgba(255,248,235,${0.12 + Math.random() * 0.3})`; x.lineWidth = w;
    x.beginPath(); x.moveTo(u, -4); x.bezierCurveTo(u + (Math.random() - 0.5) * 18, 80, u + (Math.random() - 0.5) * 24, 170, u + (Math.random() - 0.5) * 30, 260); x.stroke(); }
  return toTex(c, { repeat: true });
}
// barricade board, like the real ones: blue band "STOP FOR POLICE CHECKING" over a white panel
function nakaSign() {
  const [c, x] = mkCanvas(512, 256);
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 512, 256); x.fillStyle = '#1d3f8f'; x.fillRect(0, 0, 512, 96);
  x.fillStyle = '#ffffff'; x.font = '800 44px "Baloo 2", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('STOP FOR POLICE CHECKING', 256, 52);
  x.fillStyle = '#c8202a'; x.font = '800 74px "Baloo 2", sans-serif'; x.fillText('नाकाबंदी', 256, 150);
  x.fillStyle = '#1d3f8f'; x.font = '700 32px "Baloo 2", sans-serif'; x.fillText('MUMBAI POLICE', 256, 218);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#c8202a' : '#ffffff'; x.fillRect(i * 32, 244, 32, 12); }
  return toTex(c);
}
function nakaAheadSign() {
  const [c, x] = mkCanvas(512, 256);
  x.fillStyle = '#c8202a'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#ffffff'; x.lineWidth = 12; x.strokeRect(12, 12, 488, 232);
  x.fillStyle = '#ffffff'; x.font = '800 60px "Baloo 2", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLICE CHECKING', 256, 86);
  x.font = '800 54px "Baloo 2", sans-serif'; x.fillText('AHEAD · आगे नाका', 256, 170);
  return toTex(c);
}

function shirtTexture(base, kind) {
  const [c, x] = mkCanvas(256, 256);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  if (kind === 'flowers') {
    // tropical print: big hibiscus with veined petals and a stamen, monstera-ish leaves, small blossoms; tiles seamlessly
    const R = mulberry32(base.length * 977 + base.charCodeAt(1)); const rnd = () => R();
    const wrap = (fn) => { for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { x.save(); x.translate(dx, dy); fn(); x.restore(); } };
    const flowerCols = base.toLowerCase() === '#2c6fd6' ? ['#ffd23f', '#ff7a2f', '#f5f5f5', '#ff5aa8'] : ['#ffd23f', '#7b2cbf', '#ff8a1f', '#3fd0c9', '#ffffff', '#b03aff'];
    const leaf = (cx, cy, r, a) => { x.save(); x.translate(cx, cy); x.rotate(a); const g = x.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#1f6b3a'); g.addColorStop(1, '#3fae5a');
      x.fillStyle = g; x.beginPath(); x.moveTo(-r, 0); x.quadraticCurveTo(0, -r * 0.55, r, 0); x.quadraticCurveTo(0, r * 0.55, -r, 0); x.fill();
      x.strokeStyle = 'rgba(0,40,10,0.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-r * 0.9, 0); x.lineTo(r * 0.9, 0); for (let k = -3; k <= 3; k++) { x.moveTo(k * r * 0.22, 0); x.lineTo(k * r * 0.22 + r * 0.18, -r * 0.3); x.moveTo(k * r * 0.22, 0); x.lineTo(k * r * 0.22 + r * 0.18, r * 0.3); } x.stroke(); x.restore(); };
    const hibiscus = (cx, cy, r, col, a0) => { x.save(); x.translate(cx, cy); x.rotate(a0);
      for (let p = 0; p < 5; p++) { x.save(); x.rotate(p / 5 * Math.PI * 2); const g = x.createRadialGradient(0, 0, r * 0.1, 0, -r * 0.5, r * 0.75); g.addColorStop(0, '#5a0f2a'); g.addColorStop(0.35, col); g.addColorStop(1, col);
        x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-r * 0.55, -r * 0.25, -r * 0.5, -r * 0.95, 0, -r); x.bezierCurveTo(r * 0.5, -r * 0.95, r * 0.55, -r * 0.25, 0, 0); x.fill();
        x.strokeStyle = 'rgba(80,10,30,0.35)'; x.lineWidth = 0.8; for (const k of [-0.18, 0, 0.18]) { x.beginPath(); x.moveTo(0, -r * 0.15); x.lineTo(k * r, -r * 0.85); x.stroke(); } x.restore(); }
      x.strokeStyle = '#ffe680'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(r * 0.45, -r * 0.35); x.stroke(); x.fillStyle = '#fff2a0'; x.beginPath(); x.arc(r * 0.47, -r * 0.37, r * 0.08, 0, 7); x.fill(); x.restore(); };
    const blossom = (cx, cy, r, col) => { x.fillStyle = col; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; x.beginPath(); x.ellipse(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.5, r * 0.32, a, 0, 7); x.fill(); } x.fillStyle = '#fff3a0'; x.beginPath(); x.arc(cx, cy, r * 0.22, 0, 7); x.fill(); };
    const items = []; for (let i = 0; i < 9; i++) items.push(['leaf', rnd() * 256, rnd() * 256, 18 + rnd() * 14, rnd() * 6.28]);
    for (let i = 0; i < 7; i++) items.push(['hib', rnd() * 256, rnd() * 256, 17 + rnd() * 9, flowerCols[i % flowerCols.length], rnd() * 6.28]);
    for (let i = 0; i < 16; i++) items.push(['bl', rnd() * 256, rnd() * 256, 4 + rnd() * 4, flowerCols[(i + 2) % flowerCols.length]]);
    wrap(() => { for (const it of items) { if (it[0] === 'leaf') leaf(it[1], it[2], it[3], it[4]); else if (it[0] === 'hib') hibiscus(it[1], it[2], it[3], it[4], it[5]); else blossom(it[1], it[2], it[3], it[4]); } });
  } else if (kind === 'check') {
    x.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 256; i += 32) { x.fillRect(i, 0, 14, 256); x.fillRect(0, i, 256, 14); }
    x.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 16; i < 256; i += 32) { x.fillRect(i, 0, 3, 256); x.fillRect(0, i, 256, 3); }
  } else if (kind === 'denim') {   // twill + fades + double stitching
    for (let i = -256; i < 512; i += 3) { x.strokeStyle = i % 6 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)'; x.lineWidth = 1; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke(); }
    noise(x, 256, 256, 2500, 0.18, ['#ffffff', '#0a1a33']);
    x.strokeStyle = 'rgba(230,170,70,0.75)'; x.setLineDash([4, 3]); x.lineWidth = 1.5; for (const yy of [60, 66, 190, 196]) { x.beginPath(); x.moveTo(0, yy); x.lineTo(256, yy); x.stroke(); } x.setLineDash([]);
  } else if (kind === 'neon') {     // windcheater: cyan body, pink + white chevron panels, a reflective strip
    x.fillStyle = '#ff2e88'; x.beginPath(); x.moveTo(0, 90); x.lineTo(128, 150); x.lineTo(256, 90); x.lineTo(256, 130); x.lineTo(128, 190); x.lineTo(0, 130); x.fill();
    x.fillStyle = '#f4f4f8'; x.beginPath(); x.moveTo(0, 130); x.lineTo(128, 190); x.lineTo(256, 130); x.lineTo(256, 142); x.lineTo(128, 202); x.lineTo(0, 142); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(0, 40, 256, 6); noise(x, 256, 256, 900, 0.1, ['#000000', '#ffffff']);
  } else if (kind === 'leopard') {
    const R = mulberry32(911); for (let i = 0; i < 70; i++) { const px = R() * 256, py = R() * 256, r = 6 + R() * 9;
      for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) { x.fillStyle = '#5a3412'; x.beginPath(); x.ellipse(px + dx, py + dy, r, r * 0.8, R() * 3, 0, 7); x.fill(); x.fillStyle = '#1c120a'; x.lineWidth = 3; x.strokeStyle = '#1c120a'; x.beginPath(); x.arc(px + dx, py + dy, r, 0.3, 2.4); x.stroke(); x.beginPath(); x.arc(px + dx, py + dy, r, 3.4, 5.4); x.stroke(); } }
  } else {
    noise(x, 256, 256, 1500, 0.15, ['#000000', '#ffffff']);
  }
  return toTex(c, { repeat: true });
}
// the waistband above the jeans: elastic with the brand repeated, or leopard, a thin pantie band with bows, or lace.
// Alpha = coverage: lace holes and the pantie's open top show the skin / vest underneath.
const BAND_TEX_CACHE = {};
function bandTexture(it) {
  if (BAND_TEX_CACHE[it.id]) return BAND_TEX_CACHE[it.id];
  const [c, x] = mkCanvas(512, 64), col = new THREE.Color(it.band), dark = '#' + col.clone().multiplyScalar(0.62).getHexString();
  if (it.style === 'pantie' || it.style === 'lace') {
    const top = it.style === 'pantie' ? 26 : 10;
    x.fillStyle = it.band; x.fillRect(0, top, 512, 64 - top);
    if (it.style === 'lace') {   // scalloped edge, flower cut-outs
      x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 512; i += 24) { x.beginPath(); x.arc(i + 12, top, 10, 0, Math.PI); x.fill(); }
      for (let i = 0; i < 512; i += 32) for (let j = 0; j < 2; j++) { const cx = i + 16 + (j ? 16 : 0), cy = 30 + j * 16; for (let p = 0; p < 5; p++) { const a = p / 5 * 6.283; x.beginPath(); x.arc(cx + Math.cos(a) * 4.5, cy + Math.sin(a) * 4.5, 2.6, 0, 7); x.fill(); } x.beginPath(); x.arc(cx, cy, 1.6, 0, 7); x.fill(); }
      x.globalCompositeOperation = 'source-over'; x.fillStyle = dark; x.fillRect(0, 58, 512, 6);
    } else {   // little satin bows
      x.fillStyle = dark; x.fillRect(0, top, 512, 3);
      for (const bx of [0, 512]) { x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(bx, 38); x.lineTo(bx - 13, 28); x.lineTo(bx - 13, 48); x.fill(); x.beginPath(); x.moveTo(bx, 38); x.lineTo(bx + 13, 28); x.lineTo(bx + 13, 48); x.fill(); x.beginPath(); x.arc(bx, 38, 4, 0, 7); x.fill(); }
    }
  } else {
    x.fillStyle = it.band; x.fillRect(0, 0, 512, 64); x.fillStyle = dark; x.fillRect(0, 0, 512, 5); x.fillRect(0, 59, 512, 5);
    if (it.style === 'leopard') { const R = mulberry32(77); for (let i = 0; i < 60; i++) { const px = R() * 512, py = 8 + R() * 48, r = 3 + R() * 5; x.fillStyle = '#1c120a'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.fillStyle = '#7a4a1a'; x.beginPath(); x.arc(px, py, r * 0.55, 0, 7); x.fill(); } }
    else { x.fillStyle = it.ink; x.font = '900 italic 34px "Arial Black", Impact, sans-serif'; x.textBaseline = 'middle'; const w = x.measureText(UW_BRAND).width, n = Math.max(1, Math.floor(512 / (w + 24))), step = 512 / n;   // whole repeats, so it tiles round the waist
      for (let k = 0; k < n; k++) x.fillText(UW_BRAND, k * step + (step - w) / 2, 33); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return BAND_TEX_CACHE[it.id] = t;
}

function buildShopAtlas() {
  const [c, x] = mkCanvas(1024, 512);
  const shops = [
    ['SHREE GANESH STORES', '#c8321e', '#ffe9a8'], ['लकी मोबाइल', '#1d6fb8', '#ffffff'], ['BOMBAY KIRANA', '#2f7a3a', '#fff3c4'], ['चाय नाश्ता', '#ffc21a', '#8a1022'],
    ['VADA PAV CENTRE', '#ff7a2f', '#2a1a10'], ['RAJU TAILORS', '#5b2a86', '#ffe9a8'], ['पान शॉप', '#2f5d3a', '#ffd23f'], ['MAHALAXMI HARDWARE', '#8a1630', '#ffffff'],
    ['NEW SAGAR HOTEL', '#3e8e8a', '#fff6e0'], ['सिद्धि मेडिकल', '#18804a', '#ffffff'], ['STAR CYCLE WORKS', '#1b1b1b', '#ffc21a'], ['GUPTA SWEETS', '#e8a317', '#7a1022'],
    ['FRESH FRUITS', '#d43c2c', '#ffffff'], ['IRANI CAFE', '#6b3e26', '#f5e6cc'], ['जनता किराना', '#c99a2e', '#2a1a10'], ['XEROX · STD · PCO', '#ffd23f', '#1b1b1b'],
  ];
  shops.forEach((s, i) => {
    const X = (i % 4) * 256, Y = Math.floor(i / 4) * 128;
    x.fillStyle = '#2a2328'; x.fillRect(X, Y, 256, 128);
    const open = i % 3 !== 1;
    if (open) {
      x.fillStyle = '#3a2f2a'; x.fillRect(X + 8, Y + 44, 240, 84);
      for (let k = 0; k < 40; k++) { x.fillStyle = pick(['#ffd23f', '#ff7a2f', '#3fd0c9', '#e84a5f', '#9be15d', '#ffffff', '#c8a26a']); x.fillRect(X + 12 + Math.random() * 228, Y + 52 + Math.random() * 64, 6 + Math.random() * 12, 6 + Math.random() * 10); }
      const g = x.createLinearGradient(0, Y + 44, 0, Y + 128); g.addColorStop(0, 'rgba(255,214,140,0.55)'); g.addColorStop(1, 'rgba(255,214,140,0)'); x.fillStyle = g; x.fillRect(X + 8, Y + 44, 240, 84);
    } else {
      for (let k = 0; k < 17; k++) { x.fillStyle = k % 2 ? '#8b8f96' : '#a7abb2'; x.fillRect(X + 8, Y + 44 + k * 5, 240, 5); }
      x.fillStyle = 'rgba(255,46,136,0.8)'; x.font = `700 20px ${FONT_DISPLAY}`; x.fillText('BOMBAY', X + 30, Y + 100);
    }
    x.fillStyle = s[1]; x.fillRect(X + 4, Y + 4, 248, 38);
    x.fillStyle = s[2]; x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = 28; x.font = `800 ${fs}px ${FONT_DISPLAY}`; while (x.measureText(s[0]).width > 232 && fs > 12) { fs--; x.font = `800 ${fs}px ${FONT_DISPLAY}`; }
    x.fillText(s[0], X + 128, Y + 25);
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  });
  TEX.shops = toTex(c, { aniso: 8 });
}

function signRect(name, X, Y, W, H) { SIGN_UV[name] = [X / 1024, 1 - (Y + H) / 1024, (X + W) / 1024, 1 - Y / 1024, W / H]; }

function buildSignAtlas() {
  const [c, x] = mkCanvas(1024, 1024);
  x.fillStyle = '#222'; x.fillRect(0, 0, 1024, 1024);
  // Chai stall board
  { const X = 0, Y = 0, W = 512, H = 160; x.fillStyle = '#ffb000'; x.fillRect(X, Y, W, H); x.fillStyle = '#ff8a00'; x.fillRect(X, Y + H - 16, W, 16);
    x.strokeStyle = '#8a1022'; x.lineWidth = 8; x.strokeRect(X + 6, Y + 6, W - 12, H - 12);
    x.fillStyle = '#8a1022'; x.font = `800 92px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('कटिंग चाय', X + 230, Y + 86);
    x.fillStyle = '#fff6e0'; x.beginPath(); x.roundRect(X + 410, Y + 52, 56, 58, 8); x.fill(); x.fillStyle = '#c8701e'; x.fillRect(X + 416, Y + 62, 44, 18);
    x.strokeStyle = '#fff6e0'; x.lineWidth = 6; x.beginPath(); x.arc(X + 470, Y + 82, 12, -1.2, 1.2); x.stroke(); signRect('chai', X, Y, W, H); }
  // Chevron board
  { const X = 512, Y = 0, W = 256, H = 128; x.fillStyle = '#1b0d22'; x.fillRect(X, Y, W, H); x.fillStyle = '#ff2e88';
    for (let i = 0; i < 3; i++) { const ox = X + 30 + i * 70; x.beginPath(); x.moveTo(ox, Y + 18); x.lineTo(ox + 34, Y + 18); x.lineTo(ox + 70, Y + 64); x.lineTo(ox + 34, Y + 110); x.lineTo(ox, Y + 110); x.lineTo(ox + 36, Y + 64); x.closePath(); x.fill(); }
    signRect('chevron', X, Y, W, H); }
  // No entry
  { const X = 768, Y = 0, W = 128, H = 128; x.fillStyle = '#f2f2f2'; x.fillRect(X, Y, W, H); x.fillStyle = '#d22030'; x.beginPath(); x.arc(X + 64, Y + 58, 46, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(X + 30, Y + 50, 68, 16);
    x.fillStyle = '#1b1b1b'; x.font = `700 20px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.fillText('NO ENTRY', X + 64, Y + 120); signRect('noentry', X, Y, W, H); }
  // Checker
  { const X = 896, Y = 0; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(X + i * 16, Y + j * 16, 16, 16); } signRect('checker', X, Y, 128, 128); }
  // Graffiti wall: MUMBAI LANES with crown
  { const X = 0, Y = 160, W = 512, H = 256; const g = x.createLinearGradient(X, Y, X + W, Y + H); g.addColorStop(0, '#5b2a86'); g.addColorStop(0.5, '#c2185b'); g.addColorStop(1, '#3e1a5e'); x.fillStyle = g; x.fillRect(X, Y, W, H);
    for (let i = 0; i < 26; i++) { x.fillStyle = pick(['#3fd0c9', '#ffd23f', '#ff7a2f', '#9be15d', '#ffffff', '#1b0d22']); x.globalAlpha = 0.5; x.beginPath(); x.arc(X + Math.random() * W, Y + Math.random() * H, 6 + Math.random() * 26, 0, 7); x.fill(); }
    x.globalAlpha = 1; x.save(); x.translate(X + 270, Y + 150); x.rotate(-0.16);
    x.font = `800 88px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.lineJoin = 'round'; x.lineWidth = 14; x.strokeStyle = '#1b0d22'; x.strokeText('MUMBAI', 0, -18); x.fillStyle = '#ffc21a'; x.fillText('MUMBAI', 0, -18);
    x.strokeText('LANES', 10, 64); x.fillStyle = '#ffd23f'; x.fillText('LANES', 10, 64); x.restore();
    drawCrown(x, X + 70, Y + 34, 74, '#ffc21a', '#1b0d22'); signRect('graffiti', X, Y, W, H); }
  // Billboards
  { const X = 512, Y = 160, W = 512, H = 128; x.fillStyle = '#ffc21a'; x.fillRect(X, Y, W, H); x.fillStyle = '#1b0d22'; x.font = `800 54px ${FONT_DISPLAY}`; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('BUNTY TYRES', X + 24, Y + 46); x.font = `600 30px ${FONT_DISPLAY}`; x.fillStyle = '#8a1022'; x.fillText('Grip ekdum tight! · Since 1987', X + 26, Y + 96);
    x.fillStyle = '#1b0d22'; x.beginPath(); x.arc(X + 440, Y + 64, 48, 0, 7); x.fill(); x.fillStyle = '#ffc21a'; x.beginPath(); x.arc(X + 440, Y + 64, 22, 0, 7); x.fill(); signRect('bill1', X, Y, W, H); }
  { const X = 512, Y = 288, W = 512, H = 128; const g = x.createLinearGradient(X, 0, X + W, 0); g.addColorStop(0, '#ff2e88'); g.addColorStop(1, '#7b2cbf'); x.fillStyle = g; x.fillRect(X, Y, W, H);
    x.fillStyle = '#fff'; x.font = `800 50px ${FONT_DISPLAY}`; x.textAlign = 'left'; x.fillText('2T OIL · SUPER KICK', X + 24, Y + 50); x.font = `600 28px ${FONT_DISPLAY}`; x.fillStyle = '#ffe9a8'; x.fillText('Dhuaan bhi, power bhi.', X + 26, Y + 98); signRect('bill2', X, Y, W, H); }
  // Start/finish banner
  { const X = 0, Y = 416, W = 1024, H = 128; x.fillStyle = '#1b0d22'; x.fillRect(X, Y, W, H);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; x.fillRect(X + i * 16, Y + j * 16, 16, 16); x.fillRect(X + W - 96 + i * 16, Y + j * 16, 16, 16); }
    x.font = `800 74px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#000'; x.strokeText('CHAPRI', X + 400, Y + 66); x.fillStyle = '#ffffff'; x.fillText('CHAPRI', X + 400, Y + 66);
    x.strokeText('RACER', X + 640, Y + 66); x.fillStyle = '#ff2e88'; x.fillText('RACER', X + 640, Y + 66); drawCrown(x, X + 165, Y + 38, 60, '#ffc21a', '#000'); signRect('banner', X, Y, W, H); }
  // Number plate + tank badge
  { const X = 0, Y = 544, W = 256, H = 64; x.fillStyle = '#ffd23f'; x.fillRect(X, Y, W, H); x.strokeStyle = '#111'; x.lineWidth = 4; x.strokeRect(X + 3, Y + 3, W - 6, H - 6);
    x.fillStyle = '#111'; x.font = `700 40px ${FONT_NUM}`; x.textAlign = 'center'; x.fillText('MH 02 CR 1987', X + 128, Y + 34); signRect('plate', X, Y, W, H); }
  { const X = 256, Y = 544, W = 256, H = 64; x.clearRect(X, Y, W, H); x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(X, Y, W, H);
    x.font = `700 italic 54px ${FONT_NUM}`; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = '#ffffff'; x.strokeText(BIKE_NAME, X + 128, Y + 36); x.fillStyle = '#c8a24a'; x.fillText(BIKE_NAME, X + 128, Y + 36); signRect('badge', X, Y, W, H); }
  // Paan shop + arrow board
  { const X = 512, Y = 544, W = 256, H = 128; x.fillStyle = '#2f5d3a'; x.fillRect(X, Y, W, H); x.fillStyle = '#ffd23f'; x.font = `800 58px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.fillText('पान शॉप', X + 128, Y + 64); x.fillStyle = '#9be15d'; x.fillRect(X, Y + 112, W, 16); signRect('paan', X, Y, W, H); }
  { const X = 768, Y = 544, W = 256, H = 128; x.fillStyle = '#ffc21a'; x.fillRect(X, Y, W, H); x.fillStyle = '#1b0d22'; x.beginPath(); x.moveTo(X + 30, Y + 44); x.lineTo(X + 150, Y + 44); x.lineTo(X + 150, Y + 16); x.lineTo(X + 226, Y + 64); x.lineTo(X + 150, Y + 112); x.lineTo(X + 150, Y + 84); x.lineTo(X + 30, Y + 84); x.closePath(); x.fill(); signRect('arrow', X, Y, W, H); }
  // Sticker sheet (Sticker Bomb build)
  { const X = 0, Y = 672, W = 256, H = 128; x.fillStyle = '#ff2e88'; x.fillRect(X, Y, W, H);
    const st = ['HORN OK', 'JAI HO', '2T', 'BOMBAY', '★', 'TURBO', 'BHAI']; for (let i = 0; i < 16; i++) { x.save(); x.translate(X + Math.random() * W, Y + Math.random() * H); x.rotate((Math.random() - 0.5) * 1.2); x.fillStyle = pick(['#ffd23f', '#3fd0c9', '#ffffff', '#1b1b1b', '#9be15d']); x.font = `800 ${16 + Math.random() * 14}px ${FONT_DISPLAY}`; x.fillText(pick(st), 0, 0); x.restore(); } signRect('stickers', X, Y, W, H); }
  // Festival banners strung across the road (12:1)
  for (const [name, Y, bg, fg, text] of [['festoon', 672, '#ff8a1f', '#7a1022', 'MUMBAI MELA  ·  जय हो!  ·  MUMBAI MELA'], ['festoon2', 736, '#ff2e88', '#ffffff', 'CHAPRI RACER  ·  GALLI GRAND PRIX  ·  चलो!']]) {
    const X = 256, W = 768, H = 64; x.fillStyle = bg; x.fillRect(X, Y, W, H);
    for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? '#ffc21a' : '#ff7a00'; x.beginPath(); x.arc(X + 10 + i * 19.4, Y + 4, 8, 0, 7); x.arc(X + 10 + i * 19.4, Y + H - 4, 8, 0, 7); x.fill(); }
    x.fillStyle = fg; x.font = `800 30px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, X + W / 2, Y + H / 2 + 1); signRect(name, X, Y, W, H);
  }
  // Graffiti 2 + poster wall
  { const X = 0, Y = 800, W = 512, H = 224; x.fillStyle = '#3e8e8a'; x.fillRect(X, Y, W, H); noise(x, W, H, 0, 0, ['#000']);
    x.save(); x.translate(X + 256, Y + 128); x.rotate(0.08); x.font = `800 96px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.lineWidth = 14; x.strokeStyle = '#1b0d22'; x.strokeText('BOMBAY', 0, 0); x.fillStyle = '#ff2e88'; x.fillText('BOMBAY', 0, 0); x.font = `700 40px ${FONT_DISPLAY}`; x.fillStyle = '#ffd23f'; x.fillText('apun ka gully', 0, 62); x.restore(); signRect('graffiti2', X, Y, W, H); }
  { const X = 512, Y = 800, W = 512, H = 224; x.fillStyle = '#d9c9a8'; x.fillRect(X, Y, W, H);
    for (let i = 0; i < 7; i++) { const px = X + 10 + i * 72, py = Y + 14 + (i % 2) * 18; const g = x.createLinearGradient(0, py, 0, py + 170); const cc = pick([['#ff2e88', '#1b0d22'], ['#ffd23f', '#c8321e'], ['#3fd0c9', '#1b2a5e'], ['#ff7a2f', '#3a0d22']]); g.addColorStop(0, cc[0]); g.addColorStop(1, cc[1]); x.fillStyle = g; x.fillRect(px, py, 66, 180);
      x.fillStyle = 'rgba(255,255,255,0.9)'; x.font = `800 18px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.fillText(pick(['DHAMAKA', 'TAPORI', 'RAJA', 'GULLY', 'BHAI', 'JALWA']), px + 33, py + 160);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.arc(px + 33, py + 70, 22, 0, 7); x.fill(); x.fillRect(px + 16, py + 92, 34, 40); }
    signRect('posters', X, Y, W, H); }
  TEX.signs = toTex(c, { aniso: 8 });
}

function drawCrown(x, cx, cy, w, fill, stroke) {
  const h = w * 0.62; x.save(); x.translate(cx - w / 2, cy - h / 2); x.beginPath();
  x.moveTo(0, h); x.lineTo(0, h * 0.28); x.lineTo(w * 0.25, h * 0.6); x.lineTo(w * 0.5, 0); x.lineTo(w * 0.75, h * 0.6); x.lineTo(w, h * 0.28); x.lineTo(w, h); x.closePath();
  x.lineWidth = w * 0.09; x.strokeStyle = stroke; x.lineJoin = 'round'; x.stroke(); x.fillStyle = fill; x.fill(); x.restore();
}

function drawPickupIcon(kind) {
  const [c, x] = mkCanvas(128, 128);
  x.fillStyle = 'rgba(27,13,34,0.92)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill();
  x.lineWidth = 6; x.strokeStyle = kind === 'oil' ? '#ffc21a' : '#ff2e88'; x.stroke();
  x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === 'chain') { x.strokeStyle = '#d7dbe0'; x.lineWidth = 7; for (let i = 0; i < 4; i++) { x.save(); x.translate(34 + i * 18, 40 + i * 16); x.rotate(i % 2 ? 0.9 : -0.7); x.beginPath(); x.ellipse(0, 0, 13, 7, 0, 0, 7); x.stroke(); x.restore(); } }
  if (kind === 'belt') { x.strokeStyle = '#8a4a22'; x.lineWidth = 14; x.beginPath(); x.moveTo(28, 92); x.quadraticCurveTo(64, 20, 100, 60); x.stroke(); x.fillStyle = '#d4a62a'; x.fillRect(84, 46, 26, 24); x.fillStyle = '#1b0d22'; x.fillRect(91, 53, 12, 10); }
  if (kind === 'bottle') { x.save(); x.translate(64, 66); x.rotate(0.5); x.fillStyle = '#6b4a14'; x.beginPath(); x.roundRect(-14, -18, 28, 52, 6); x.fill(); x.fillRect(-6, -40, 12, 24); x.fillStyle = '#ffd23f'; x.fillRect(-12, 0, 24, 16); x.fillStyle = '#d43c2c'; x.fillRect(-7, -44, 14, 6); x.restore(); }
  if (kind === 'gutka') { x.fillStyle = '#c8321e'; x.beginPath(); x.roundRect(36, 34, 56, 64, 6); x.fill(); x.fillStyle = '#ffd23f'; x.font = `800 22px ${FONT_DISPLAY}`; x.textAlign = 'center'; x.fillText('थुक', 64, 72); x.fillStyle = '#7a1022'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(30 + i * 16, 104 + (i % 2) * 6, 4, 0, 7); x.fill(); } }
  if (kind === 'rod') { x.strokeStyle = '#a0522d'; x.lineWidth = 11; x.beginPath(); x.moveTo(34, 98); x.lineTo(88, 36); x.lineTo(100, 42); x.stroke(); x.strokeStyle = '#d07a4a'; x.lineWidth = 3; x.beginPath(); x.moveTo(38, 92); x.lineTo(86, 38); x.stroke(); for (let i = 0; i < 6; i++) { x.fillStyle = '#5a2a14'; x.fillRect(44 + i * 8, 84 - i * 9, 4, 4); } }
  if (kind === 'katta') { x.fillStyle = '#3a3c42'; x.fillRect(30, 46, 66, 16); x.fillRect(84, 42, 12, 8); x.save(); x.translate(44, 60); x.rotate(0.25); x.fillStyle = '#6b3e26'; x.fillRect(0, 0, 18, 36); x.restore(); x.strokeStyle = '#3a3c42'; x.lineWidth = 4; x.beginPath(); x.arc(64, 68, 8, 0, Math.PI); x.stroke(); x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(100, 54); x.lineTo(118, 46); x.lineTo(112, 56); x.lineTo(118, 64); x.closePath(); x.fill(); }
  if (kind === 'oil') { x.fillStyle = '#ffc21a'; x.beginPath(); x.roundRect(40, 38, 44, 60, 8); x.fill(); x.fillRect(56, 24, 14, 18); x.fillStyle = '#1b0d22'; x.font = `800 28px ${FONT_NUM}`; x.textAlign = 'center'; x.fillText('2T', 62, 78); x.fillStyle = '#ff2e88'; x.beginPath(); x.moveTo(92, 40); x.lineTo(80, 64); x.lineTo(90, 64); x.lineTo(82, 88); x.lineTo(100, 58); x.lineTo(90, 58); x.closePath(); x.fill(); }
  return c;
}
