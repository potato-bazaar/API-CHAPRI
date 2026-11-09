// ───────────────────────── THE CROWD ─────────────────────────
// Mumbai came out to watch: comic cut-out spectators on the pavements. A packed double row at the start/finish line,
// knots of people at every stall, and pairs dotted along the road. Each is one textured quad facing the road (drawn
// here, no image files), in one batched mesh; about half of them jump and cheer (a hop in the vertex shader).
const CROWD_N = 8;
function crowdTexture() {
  if (TEX.crowd) return TEX.crowd;
  const CW = 128, CH = 256, [c, x] = mkCanvas(CW * CROWD_N, CH);
  const INK = '#1a1018';
  // one figure, drawn in flat colours on its own canvas, then inked: the silhouette stamped all round in dark, the colours on top
  const person = (i, o) => { const [f, g] = mkCanvas(CW, CH), k = o.k || 1, base = 250, H = 232 * k, top = base - H, cx = 64;
    const hy = top + 20 * k, hr = 17 * k, sh = top + 52 * k, hip = top + 128 * k, bw = 23 * k;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const arm = (sx, hx, hyy, col) => { g.strokeStyle = col; g.lineWidth = 12 * k; g.beginPath(); g.moveTo(sx, sh + 6 * k); g.lineTo(hx, hyy); g.stroke(); g.fillStyle = o.skin; g.beginPath(); g.arc(hx, hyy, 6.5 * k, 0, 7); g.fill(); };
    const armCol = o.sleeve === false ? o.skin : o.top;
    // legs / lower
    if (o.low === 'saree' || o.low === 'skirt') { g.fillStyle = o.lowC; g.beginPath(); g.moveTo(cx - bw, hip - 4); g.lineTo(cx + bw, hip - 4); g.lineTo(cx + bw + 8 * k, base - 6); g.lineTo(cx - bw - 8 * k, base - 6); g.closePath(); g.fill(); g.fillStyle = o.skin; g.fillRect(cx - 14 * k, base - 8, 10 * k, 8); g.fillRect(cx + 4 * k, base - 8, 10 * k, 8); }
    else { const lt = o.low === 'lungi' ? hip + 62 * k : o.low === 'shorts' ? hip + 34 * k : base - 8;
      g.fillStyle = o.skin; g.fillRect(cx - bw + 3, hip, 16 * k, base - hip - 6); g.fillRect(cx + bw - 3 - 16 * k, hip, 16 * k, base - hip - 6);
      g.fillStyle = o.lowC; if (o.low === 'lungi') { g.beginPath(); g.moveTo(cx - bw, hip - 4); g.lineTo(cx + bw, hip - 4); g.lineTo(cx + bw + 3, lt); g.lineTo(cx - bw - 3, lt); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let q = -2; q <= 2; q++) { g.beginPath(); g.moveTo(cx + q * 9 * k, hip); g.lineTo(cx + q * 10 * k, lt); g.stroke(); } }
      else { g.fillRect(cx - bw + 1, hip - 4, 19 * k, lt - hip + 4); g.fillRect(cx + bw - 1 - 19 * k, hip - 4, 19 * k, lt - hip + 4); }
      g.fillStyle = o.shoe || '#2a2228'; g.fillRect(cx - bw, base - 8, 21 * k, 8); g.fillRect(cx + bw - 21 * k, base - 8, 21 * k, 8); }
    // arms behind the torso when down, in front when up
    const L = o.arms[0], R = o.arms[1], hand = (p, s) => p === 'up' ? [cx + s * 34 * k, top + 2 * k] : p === 'wave' ? [cx + s * 44 * k, top + 26 * k] : p === 'phone' ? [cx + s * 30 * k, top + 34 * k] : [cx + s * (bw + 9 * k), hip + 6 * k];
    if (L === 'down') arm(cx - bw, ...hand(L, -1), armCol); if (R === 'down') arm(cx + bw, ...hand(R, 1), armCol);
    // torso
    g.fillStyle = o.top; const tl = o.long ? hip + 44 * k : hip + 4; g.beginPath(); g.moveTo(cx - bw - 2, sh); g.quadraticCurveTo(cx, sh - 10 * k, cx + bw + 2, sh); g.lineTo(cx + bw, tl); g.lineTo(cx - bw, tl); g.closePath(); g.fill();
    if (o.low === 'saree') { g.fillStyle = o.lowC; g.beginPath(); g.moveTo(cx + bw + 2, sh); g.lineTo(cx + bw + 2, sh + 22 * k); g.lineTo(cx - bw, hip + 2); g.lineTo(cx - bw, hip - 24 * k); g.closePath(); g.fill(); g.strokeStyle = '#ffd24a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + bw + 2, sh + 22 * k); g.lineTo(cx - bw, hip + 2); g.stroke(); }
    if (o.stripe) { g.fillStyle = o.stripe; g.fillRect(cx - bw, sh + 22 * k, bw * 2, 9 * k); g.fillRect(cx - bw, sh + 44 * k, bw * 2, 9 * k); }
    if (L !== 'down') arm(cx - bw, ...hand(L, -1), armCol); if (R !== 'down') arm(cx + bw, ...hand(R, 1), armCol);
    if (R === 'phone') { const [px, py] = hand(R, 1); g.fillStyle = '#15151c'; g.fillRect(px - 6 * k, py - 16 * k, 12 * k, 20 * k); g.fillStyle = '#7fd8ff'; g.fillRect(px - 4 * k, py - 13 * k, 8 * k, 13 * k); }
    // neck, head, hair
    g.fillStyle = o.skin; g.fillRect(cx - 6 * k, hy + hr - 4, 12 * k, 14 * k); g.beginPath(); g.arc(cx, hy, hr, 0, 7); g.fill();
    g.fillStyle = o.hair; g.beginPath(); g.arc(cx, hy - 2 * k, hr + 1, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
    if (o.hairLong) { g.fillRect(cx - hr - 2, hy - 4 * k, 8 * k, 40 * k); g.fillRect(cx + hr - 6 * k, hy - 4 * k, 8 * k, 40 * k); }
    if (o.cap) { g.fillStyle = o.cap; g.beginPath(); g.arc(cx, hy - 3 * k, hr + 2, Math.PI, Math.PI * 2); g.closePath(); g.fill(); g.fillRect(cx, hy - 6 * k, hr + 12 * k, 5 * k); }
    if (o.shades) { g.fillStyle = '#101014'; g.fillRect(cx - 13 * k, hy - 2 * k, 26 * k, 7 * k); }
    else { g.fillStyle = INK; g.beginPath(); g.arc(cx - 6 * k, hy + 1, 2 * k, 0, 7); g.arc(cx + 6 * k, hy + 1, 2 * k, 0, 7); g.fill(); }
    if (o.open) { g.fillStyle = '#5a1420'; g.beginPath(); g.ellipse(cx, hy + 9 * k, 5 * k, 3.6 * k, 0, 0, 7); g.fill(); }   // shouting
    if (o.beard) { g.fillStyle = o.hair; g.beginPath(); g.arc(cx, hy + 3 * k, hr - 1, Math.PI * 0.12, Math.PI * 0.88); g.closePath(); g.fill(); }
    // ink: the silhouette in dark, stamped around, then the colours
    const [s2, g2] = mkCanvas(CW, CH); g2.drawImage(f, 0, 0); g2.globalCompositeOperation = 'source-in'; g2.fillStyle = INK; g2.fillRect(0, 0, CW, CH);
    for (let a = 0; a < 12; a++) x.drawImage(s2, i * CW + Math.cos(a / 12 * 6.283) * 3.2, Math.sin(a / 12 * 6.283) * 3.2);
    x.drawImage(f, i * CW, 0); };
  const SK = ['#b87a52', '#8f5a3a', '#c98f66', '#a56a45'];
  [ { skin: SK[0], top: '#e8413c', low: 'pants', lowC: '#2b3350', hair: '#17110e', arms: ['up', 'up'], open: true },
    { skin: SK[1], top: '#f2efe6', long: true, low: 'pants', lowC: '#f2efe6', hair: '#17110e', arms: ['down', 'wave'], beard: true },
    { skin: SK[2], top: '#d4307a', low: 'saree', lowC: '#f0a01e', hair: '#17110e', hairLong: true, sleeve: false, arms: ['down', 'wave'] },
    { skin: SK[0], top: '#ffd21e', low: 'shorts', lowC: '#2456a8', hair: '#17110e', arms: ['up', 'up'], k: 0.7, open: true, stripe: '#e8413c' },
    { skin: SK[3], top: '#f4f4f0', sleeve: false, low: 'lungi', lowC: '#3a7a9a', hair: '#17110e', arms: ['down', 'phone'], shades: true },
    { skin: SK[2], top: '#2aa79b', long: true, low: 'pants', lowC: '#f0e4c8', hair: '#17110e', hairLong: true, arms: ['up', 'up'], open: true },
    { skin: SK[1], top: '#3a6fd8', low: 'pants', lowC: '#3a3a44', hair: '#17110e', cap: '#e8413c', arms: ['down', 'up'], open: true },
    { skin: SK[3], top: '#7a4ad0', low: 'pants', lowC: '#22222c', hair: '#c9c9c9', arms: ['phone', 'phone'].map((v, q) => q ? 'phone' : 'down'), beard: true },
  ].forEach((o, i) => person(i, o));
  const t = toTex(c, { mip: true }); return TEX.crowd = t;
}
Object.assign(World.prototype, {
  buildCrowd() {
    const T = this.track, th = this.theme, sw = SIDEWALK[th], p = new THREE.Vector3(); if (sw < 2 || (th === 'flyover' && !T.ug)) return;   // no room on a gali's kerb
    const tex = crowdTexture(), B = new Batch(); let n = 0;
    const ok = (s, side, off) => { const w = T.wAt(s) / 2;
      if (T.yAt(s) > 0.6 || T.hallAt(s) || (T.stairsZone && T.stairsZone(s)) || (T.nala && Math.abs(T.wrapD(s - T.nala.s0 - T.nala.len / 2)) < 40) || (this.ugSkip && this.ugSkip(s, 'clutter'))) return false;
      if (T.kickers.some(q => Math.abs(T.wrapD(s - q.s)) < 22) || T.shortcuts.some(sc => Math.abs(T.wrapD(s - sc.s)) < sc.half + 8) || T.nakas.some(q => Math.abs(T.wrapD(s - q.s)) < 40)) return false;
      if (this.obstacles.some(o => Math.abs(T.wrapD(o.s - s)) < 4 && Math.sign(o.d) === side && Math.abs(o.d) > w - 0.5)) return false;
      T.pos(s, side * off, p, 0); return !(T.clearance(p.x, p.z) < off - w - 0.4 || this.isSea(p.x - 2)); };
    const put = (s, side, back = 0) => { s = ((s % T.L) + T.L) % T.L; const w = T.wAt(s) / 2, off = w + 0.45 + Math.min(sw - 0.7, 0.75 + back); if (!ok(s, side, off)) return;
      const v = Math.floor(RNG() * CROWD_N), h = (v === 3 ? 1.22 : 1.6 + RNG() * 0.2) / (v === 3 ? 0.7 : 1) * 1.0, yaw = T.yawAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (RNG() - 0.5) * 0.7, u0 = v / CROWD_N;
      p.y = 0.18; this.facing(B, p, yaw, h * 0.5, 0.18, 0.18 + h, [u0 + 0.002, 0, u0 + 1 / CROWD_N - 0.002, 1]); n++; };
    // the start / finish straight: two rows deep on both sides
    for (let s = -55; s < 70; s += 0.75 + RNG() * 0.5) for (const side of [-1, 1]) { if (RNG() < 0.85) put(s, side, 0); if (sw > 2.6 && RNG() < 0.6) put(s + 0.4, side, 0.75); }
    // a knot of people at every stall, and pairs along the way
    for (const sp of this.stallSpots || []) { const k = 2 + Math.floor(RNG() * 3); for (let i = 0; i < k; i++) put(sp.s + (RNG() < 0.5 ? -1 : 1) * (1.6 + RNG() * 2.2), sp.side, RNG() * 0.5); }
    for (let s = 90; s < T.L - 70; s += 14 + RNG() * 22) { const side = RNG() < 0.5 ? -1 : 1, k = 1 + Math.floor(RNG() * 3); for (let i = 0; i < k; i++) put(s + i * (0.7 + RNG() * 0.4), side, RNG() * 0.4); }
    if (!n) return;
    const U = this.crowdU = { uTime: { value: 0 } }, low = typeof GAME !== 'undefined' && GAME && GAME.quality === 'low';
    const m = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0x30283a, emissiveMap: tex });
    m.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime;   // half of them jump (each on a beat of their own, keyed off the way they face)
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  { float ph = fract(sin(dot(normal.xz, vec2(91.7, 37.3))) * 4375.5); float hop = max(0.0, sin(uTime * (5.0 + ph * 3.0) + ph * 40.0)); transformed.y += hop * hop * 0.17 * step(0.45, ph); }'); };
    const mesh = B.mesh(m); if (!mesh) return; mesh.castShadow = !low; this.group.add(mesh); this.disposables.push(mesh.geometry, m); this.crowdCount = n;
  },
});
