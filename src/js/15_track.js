// ───────────────────────── TRACK RUNTIME DATA ─────────────────────────
// Samples the closed centre-line every STEP metres. Riders live in track space:
// s = distance along the lap, d = lateral offset (positive = left of travel).
const STEP = 0.5;

const ROAD_SCALE = { city: 1.3, sea: 1.3, flyover: 1.3, market: 1.2, basti: 1.12 };
class Track {
  constructor(def) {
    this.def = def;
    let raw = def.pts.map(p => new THREE.Vector3(p[0], 0, p[1]));
    let c = new THREE.CatmullRomCurve3(raw, true, 'centripetal'); c.arcLengthDivisions = 4000;
    const sc = def.target / c.getLength();
    raw = raw.map(p => p.multiplyScalar(sc));
    c = new THREE.CatmullRomCurve3(raw, true, 'centripetal'); c.arcLengthDivisions = 6000;
    this.curve = c;
    const L = c.getLength();
    const N = Math.round(L / STEP);
    this.N = N; this.L = N * STEP;
    const A = (n) => new Float32Array(n);
    this.px = A(N); this.pz = A(N); this.py = A(N); this.tx = A(N); this.tz = A(N); this.yaw = A(N); this.k = A(N); this.w = A(N); this.slope = A(N); this.rl = A(N); this.vmax = A(N);
    const p = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      c.getPointAt(i / N, p); c.getTangentAt(i / N, t);
      this.px[i] = p.x; this.pz[i] = p.z; this.tx[i] = t.x; this.tz[i] = t.z; this.yaw[i] = Math.atan2(t.x, t.z);
    }
    // curvature (smoothed)
    const kr = A(N);
    for (let i = 0; i < N; i++) { kr[i] = wrapAngle(this.yaw[(i + 1) % N] - this.yaw[(i - 1 + N) % N]) / (2 * STEP); }
    const win = 8;
    for (let i = 0; i < N; i++) { let s = 0; for (let j = -win; j <= win; j++) s += kr[(i + j + N) % N]; this.k[i] = s / (2 * win + 1); }
    // width profile (cyclic, smoothstep between keys); w0 = the plain road, w = with shortcut aprons
    // every road is drawn a size up from its key widths (Auto Rush-style room to weave); the gali stays tighter
    const wk = def.widths, wsc = def.wScale || ROAD_SCALE[def.theme] || 1.25; this.w0 = A(N); this.wScale = wsc;
    for (let i = 0; i < N; i++) this.w0[i] = this.w[i] = cyclicKey(wk, i / N, true) * wsc;
    // elevation: linear keys (kinks make crest jumps) + bumps; triple speed breakers = three sharp humps in a row
    this.bumps = (def.bumps || []).map(b => ({ ...b, s: b.f * this.L }));
    for (const f of def.triples || []) for (let k = -1; k <= 1; k++) this.bumps.push({ s: f * this.L + k * 3.4, h: 0.13, len: 1.5, type: 'breaker', triple: true });
    this.rng = mulberry32(hashStr(def.id));
    this.planShortcuts(def.shortcuts || 0);
    this.planSetPieces(def);
    for (let i = 0; i < N; i++) {
      const s = i * STEP; let y = def.elev ? cyclicKey(def.elev, i / N, false) : 0;
      y += this.roofRaw(s) + this.stairsRaw(s);
      for (const b of this.bumps) {
        let x = s - (b.s - b.len / 2); if (x < -this.L / 2) x += this.L; if (x > this.L / 2) x -= this.L;
        if (x >= 0 && x <= b.len) {
          if (b.type === 'ramp') y += b.h * (x / b.len);
          else y += b.h * Math.sin(Math.PI * x / b.len);
        }
      }
      this.py[i] = y;
    }
    for (let i = 0; i < N; i++) this.slope[i] = (this.py[(i + 1) % N] - this.py[(i - 1 + N) % N]) / (2 * STEP);
    // racing line: lateral offset toward the inside of corners (smoothed curvature, look-ahead)
    const kk = A(N); const w2 = 40;
    for (let i = 0; i < N; i++) { let s = 0, n = 0; for (let j = -w2; j <= w2 * 1.5; j += 2) { s += this.k[(i + j + N) % N]; n++; } kk[i] = s / n; }
    for (let i = 0; i < N; i++) { const half = this.w0[i] / 2 - 0.9; this.rl[i] = clamp(kk[i] * 70, -1, 1) * Math.max(0, half) * 0.85; }
    // checkpoints every 50 m (lap counts only by continuous progress, so order is implicit)
    this.cpSpacing = 50; this.numCP = Math.floor(this.L / this.cpSpacing);
    this.isElevated = (s) => this.yAt(s) > 1.5;
    this.computeSpeedProfile(1.0);
    this.placeHazards(def);
    this.planCorners(); this.planTraffic(def);
  }
  // Shortcuts: the sharpest corners get a wide apron; a divider island splits off a kachha lane that cuts the inside.
  planShortcuts(n) {
    const N = this.N; this.shortcuts = []; if (!n) return;
    const cand = [];
    for (let i = 0; i < N; i++) { const s = i * STEP, k = Math.abs(this.k[i]); if (s < 90 || s > this.L - 70) continue;
      if (this.bumps.some(b => Math.abs(b.s - s) < 45)) continue; if (this.def.elev && cyclicKey(this.def.elev, i / N, false) > 0.3) continue;
      let peak = true; for (let j = -24; j <= 24; j++) if (Math.abs(this.k[(i + j + N) % N]) > k) { peak = false; break; } if (peak && k > 1 / 40) cand.push({ i, s, k }); }
    cand.sort((a, b) => b.k - a.k);
    for (const c of cand) { if (this.shortcuts.length >= n) break; if (this.shortcuts.some(o => Math.abs(o.s - c.s) < 170)) continue;
      this.shortcuts.push({ s: c.s, side: Math.sign(this.k[c.i]), E: 11, half: 34, ramp: 14 }); }
    for (const sc of this.shortcuts) for (let i = 0; i < N; i++) {
      let ds = i * STEP - sc.s; if (ds > this.L / 2) ds -= this.L; if (ds < -this.L / 2) ds += this.L;
      const a = Math.abs(ds); if (a > sc.half) continue; const t = a < sc.half - sc.ramp ? 1 : sstep((sc.half - a) / sc.ramp);
      this.w[i] += sc.E * t;
    }
    // island + lane geometry (s range of the island; lane between island and the inside edge)
    for (const sc of this.shortcuts) { sc.s0 = sc.s - (sc.half - sc.ramp - 3); sc.s1 = sc.s + (sc.half - sc.ramp - 3); }
  }
  // ── set pieces: rooftop run with gaps, ride-through halls, kicker ramps (with things to jump over), coins, rail crossing ──
  wrapD(x) { if (x > this.L / 2) x -= this.L; if (x < -this.L / 2) x += this.L; return x; }
  planSetPieces(def) {
    const N = this.N, L = this.L; this.roof = null; this.halls = []; this.kickers = []; this.coins = []; this.rail = null; this.stairs = null; this.nala = null; this.nakas = []; this.dogSpots = []; this.pieceZones = [];
    const busy = [[0, 90], [L - 45, L]]; for (const b of this.bumps) busy.push([b.s - b.len - 14, b.s + b.len + 14]); for (const sc of this.shortcuts) busy.push([sc.s - sc.half - 6, sc.s + sc.half + 6]);
    if (def.elev) for (let i = 0; i < N; i += 4) if (cyclicKey(def.elev, i / N, false) > 0.3) busy.push([i * STEP - 25, i * STEP + 25]);
    const free = (a, b) => !busy.some(([x, y]) => a < y && b > x);
    // straight-ish runs
    const mkRuns = (kmax) => { const out = []; let st = -1; for (let i = 0; i <= N; i++) { const ok = i < N && Math.abs(this.k[i]) < kmax; if (ok && st < 0) st = i; if (!ok && st >= 0) { out.push([st * STEP, i * STEP]); st = -1; } } return out.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])); };
    let runs = mkRuns(1 / 95); const placed = [];
    // best free window of `len`: spread out from the start line and from what's already placed
    const take = (len, pad = 4, rs = runs) => { let best = null, bs = -1;
      for (const [a, b] of rs) for (let x = a + pad; x + len <= b - pad; x += 4) { if (!free(x, x + len)) continue; const m = x + len / 2; let sc = Math.min(m, L - m);
        for (const q of placed) sc = Math.min(sc, Math.abs(this.wrapD(m - q))); if (sc > bs) { bs = sc; best = x; } }
      if (best !== null) { busy.push([best - 10, best + len + 10]); placed.push(best + len / 2); } return best; };
    if (def.roof) { const rr = mkRuns(1 / 45); let len = 104, s0 = null; while (s0 === null && len >= 68) { s0 = take(len, 2, rr); if (s0 === null) len -= 6; }
      if (s0 !== null) { const up = 18, h = 5.2, gaps = []; const plateau = len - 2 * up; const n = plateau > 55 ? 2 : 1;
        for (let k = 0; k < n; k++) gaps.push({ x0: up + plateau * (k + 1) / (n + 1) - 2.5, len: 5 });
        this.roof = { s0, len, up, h, gaps }; } }
    // seedhi: a long staircase up to a terrace and back down (physics rides the smooth slope; the steps are visual + suspension kicks)
    if (def.stairs) { const rr = mkRuns(1 / 60); let len = 112, s0 = null; while (s0 === null && len >= 80) { s0 = take(len, 4, rr); if (s0 === null) len -= 8; }
      if (s0 !== null) { const up = Math.round(len * 0.36), tread = 0.6, n = Math.round(up / tread), h = n * 0.125; this.stairs = { s0, len, up: n * tread, h, tread, n }; this.pieceZones.push([s0 - 8, s0 + len + 8]);
        for (let i = 0; i < 7; i++) { const x = this.stairs.up + (len - 2 * this.stairs.up) * (i + 0.5) / 7; this.coins.push({ s: s0 + x, d: Math.sin(i * 1.3) * 2.2, h: 0.95 }); } } }
    // nala: a leaking drain floods the road; ~0.25 m of water over the tarmac
    if (def.nala) { const s0 = take(56, 6); if (s0 !== null) { this.nala = { s0: s0 + 4, len: 46, depth: 0.25 }; this.pieceZones.push([s0, s0 + 56]); } }
    // nakabandi: a full-width barricade line with two big jump ramps in front of it
    for (let k = 0; k < (def.nakas || 0); k++) { const s0 = take(64, 4); if (s0 === null) break; const S = s0 + 34, w = this.get(this.w0, S) / 2; const nk = { s: S, idx: k, w }; this.nakas.push(nk); this.pieceZones.push([s0, s0 + 64]);
      for (const sd of [-1, 1]) { const kk = { s: S - 15, len: 9, h: 1.45, d: sd * w * 0.5, hw: 1.9, side: sd, over: 'naka', naka: nk }; this.kickers.push(kk);
        for (let i = 1; i <= 5; i++) { const x = i * 2.8, t = x / 20; this.coins.push({ s: kk.s + kk.len + x, d: kk.d, h: kk.h + 4.2 * t - 4.9 * t * t + 0.9 }); } } }
    if (def.underground) this.planUnderground(def.underground, busy);
    if (def.hall) { const s0 = take(64, 6); if (s0 !== null) this.halls.push({ s0, s1: s0 + 64, kind: def.hall }); }
    for (let k = 0; k < (def.kickers || 0); k++) { const s0 = take(48, 4); if (s0 === null) break; const side = k % 2 ? -1 : 1, hw = 1.4, w = this.get(this.w0, s0) / 2;
      const kk = { s: s0 + 6, len: 7, h: 1.15, d: side * Math.max(0, w - hw - 0.6), hw, side, over: def.kickOver || 'autos' }; this.kickers.push(kk);
      // the jump arc (≈20 m/s off the lip) carries a line of coins
      for (let i = 1; i <= 6; i++) { const x = i * 2.6, t = x / 20; this.coins.push({ s: kk.s + kk.len + x, d: kk.d, h: kk.h + 3.9 * t - 4.9 * t * t + 0.9 }); } }
    if (this.roof) { const R = this.roof; for (const g of R.gaps) for (let i = -1; i <= 1; i++) this.coins.push({ s: R.s0 + g.x0 + g.len / 2 + i * 2.2, d: 0, h: R.h + 1.3 - Math.abs(i) * 0.25, abs: true }); }
    for (const sc of this.shortcuts) for (let i = -1; i <= 1; i++) { const ss = sc.s + i * 6; this.coins.push({ s: ss, d: sc.side * ((this.get(this.w0, ss) / 2 + 2.6 + this.get(this.w, ss) / 2) / 2), h: 0.95 }); }
    for (let k = 0, tries = 0; k < (def.dogs || 0) && tries < 400; tries++) { const sd = 90 + this.rng() * (L - 140); if (!free(sd - 12, sd + 12) || this.dogSpots.some(q => Math.abs(this.wrapD(q.s - sd)) < 100)) continue;
      this.dogSpots.push({ s: sd, side: this.rng() < 0.5 ? -1 : 1, col: ['#d8b98a', '#f2ede2', '#8a5a32', '#2a2420', '#c9a46a'][k % 5] }); k++; }
    if (def.rail && def.elev) { let bh = 0; for (let i = 0; i < N; i++) bh = Math.max(bh, cyclicKey(def.elev, i / N, false));
      let a = -1, b = -1; for (let i = 0; i < N; i++) if (cyclicKey(def.elev, i / N, false) > bh - 0.05) { if (a < 0) a = i * STEP; b = i * STEP; }
      if (a >= 0) this.rail = { s: (a + b) / 2, h: bh }; }
    // nitro strips on every track (the Underground authors its own): on straights, spread round the lap, a coin line after each
    if (!def.underground) { this.nitros = []; const n = Math.max(3, Math.round(L / 480));
      for (let k = 0; k < n; k++) { const s0 = take(34, 2); if (s0 === null) break; const s = s0 + 8, f = [0.3, -0.3, 0, 0.25, -0.2][k % 5], d = f * this.get(this.w0, s);
        this.nitros.push({ s, d, len: 8, hw: 1.0 }); this.pieceZones.push([s0, s0 + 34]); for (let i = 0; i < 4; i++) this.coins.push({ s: s + 11 + i * 3, d, h: 0.95 }); } }
  }
  // corners for the direction guide: runs of real curvature, merged, with their tightest radius and which way they go
  planCorners() {
    const N = this.N, out = []; let cur = null;
    for (let i = 0; i <= N; i++) { const k = i < N ? this.k[i] : 0, on = Math.abs(k) > 1 / 75, sg = Math.sign(k);
      if (on && cur && cur.dir === sg && i * STEP - cur.e < 14) { cur.e = i * STEP; cur.r = Math.min(cur.r, 1 / Math.abs(k)); }
      else if (on) { if (cur) out.push(cur); cur = { s: i * STEP, e: i * STEP, dir: sg, r: 1 / Math.abs(k) }; } }
    if (cur) out.push(cur);
    this.corners = out.filter(c => c.e - c.s > 6 && c.r < 70).map(c => ({ ...c, kind: c.r < 26 ? 'hairpin' : c.r < 44 ? 'sharp' : 'bend' }));
  }
  // traffic lanes: the Underground's tunnel and cut; elsewhere the longest calm stretches away from set pieces
  planTraffic(def) {
    const L = this.L; this.trafficZones = [];
    if (this.ug) { const Z = this.ug; this.trafficZones.push({ a: Z.tunnel[0] - 4, b: Z.tunnel[1] }, { a: Z.cut[0] + 6, b: Z.chevron[0] - 12 }); return; }
    const bad = (s) => s < 70 || s > L - 40 || Math.abs(this.kAt(s)) > 1 / 48 || this.yAt(s) > 0.6 || this.hallAt(s) || this.pieceZones.some(([a, b]) => s > a - 8 && s < b + 8) || this.kickers.some(k => Math.abs(this.wrapD(s - k.s)) < 30)
      || this.shortcuts.some(sc => Math.abs(this.wrapD(s - sc.s)) < sc.half + 8) || (this.roof && this.roofRaw(s) > 0) || (this.stairs && this.stairsZone(s)) || this.nakas.some(n => Math.abs(this.wrapD(s - n.s)) < 50);
    const runs = []; let st = null; for (let s = 0; s <= L; s += 4) { if (s < L && !bad(s)) { if (st === null) st = s; } else if (st !== null) { runs.push([st, s]); st = null; } }
    runs.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
    for (const [a, b] of runs.slice(0, 3)) if (b - a >= 90) this.trafficZones.push({ a: a + 4, b: Math.min(b - 4, a + 300) });
  }
  // ── Mumbai Underground: authored sections (metres), the tunnel as a hall, the broken metro bridge as a roof run with
  // one big gap and a tin-sheet launch lip, nitro strips, a burst pipe, a kicker over cable reels in the docks ──
  planUnderground(U, busy) {
    const L = this.L, m = (f) => f * L, Z = this.ug = {};
    for (const k in U) { const [a, b] = U[k]; Z[k] = [m(a), b < a ? m(b) + L : m(b)]; }
    this.halls.push({ s0: Z.tunnel[0], s1: Z.tunnel[1], kind: 'tunnel' });
    const [ba, bb] = Z.bridge, len = bb - ba, gap = { x0: len / 2 - 4.5, len: 9 };
    this.roof = { s0: ba, len, up: 28, h: 6.8, gaps: [gap], style: 'bridge' };
    this.bumps.push({ s: ba + gap.x0 - 3.5, h: 0.95, len: 7, type: 'ramp', lip: true });
    for (let i = -2; i <= 2; i++) this.coins.push({ s: ba + gap.x0 + gap.len / 2 + i * 2.6, d: 0, h: this.roof.h + 2.3 - Math.abs(i) * 0.35, abs: true });
    for (const k of ['metro', 'tunnel', 'cut', 'bridge', 'market']) this.pieceZones.push([Z[k][0] - 6, Z[k][1] + 6]);
    for (const k of ['tunnel', 'bridge']) busy.push([Z[k][0] - 10, Z[k][1] + 10]);
    // nitro strips: glowing chevrons on the tarmac, a free kick of speed if you thread them
    const T = this, tl = Z.tunnel[1] - Z.tunnel[0];
    this.nitros = [[Z.tunnel[0] + tl * 0.18, 0.28], [Z.tunnel[0] + tl * 0.46, -0.28], [Z.tunnel[0] + tl * 0.78, 0.0], [Z.cut[0] + 30, -0.25], [ba - 46, 0], [Z.kachha[0] + (Z.kachha[1] - Z.kachha[0]) * 0.55, 0.2]]
      .map(([s, f]) => ({ s, d: f * T.get(T.w0, s), len: 8, hw: 1.0 }));
    for (const n of this.nitros) for (let i = 0; i < 4; i++) this.coins.push({ s: n.s + n.len + 3 + i * 3, d: n.d, h: 0.95 });
    // a burst water main pours across the tunnel; the water curtain
    this.burst = { s: Z.tunnel[0] + tl * 0.62 };
    // the docks kicker: a plank ramp over cable reels
    const dk = Z.docks[0] + (Z.docks[1] - Z.docks[0]) * 0.4, w = this.get(this.w0, dk) / 2;
    const kk = { s: dk, len: 7, h: 1.2, d: -Math.max(0, w - 1.4 - 0.6), hw: 1.4, side: -1, over: 'reels' }; this.kickers.push(kk);
    for (let i = 1; i <= 6; i++) { const x = i * 2.6, t = x / 20; this.coins.push({ s: kk.s + kk.len + x, d: kk.d, h: kk.h + 3.9 * t - 4.9 * t * t + 0.9 }); }
  }
  // which Underground section is at s (or null)
  zoneAt(s) { const Z = this.ug; if (!Z) return null; for (const k of ['tunnel', 'chevron', 'cut', 'docks', 'bridge', 'kachha', 'market', 'metro']) { const [a, b] = Z[k]; const x = this.wrapD(s - a); if (x >= 0 && x <= b - a) return k; } return null; }
  dirtAt(s) { return this.ug ? this.zoneAt(s) === 'kachha' : false; }
  inTunnel(s) { return this.ug ? this.zoneAt(s) === 'tunnel' : false; }
  roofRaw(s) { const R = this.roof; if (!R) return 0; const x = this.wrapD(s - R.s0); if (x < 0 || x > R.len) return 0;
    for (const g of R.gaps) if (x >= g.x0 && x <= g.x0 + g.len) return 0;
    return R.h * (x < R.up ? x / R.up : x > R.len - R.up ? (R.len - x) / R.up : 1); }
  stairsRaw(s) { const S = this.stairs; if (!S) return 0; const x = this.wrapD(s - S.s0); if (x < 0 || x > S.len) return 0;
    return S.h * (x < S.up ? x / S.up : x > S.len - S.up ? (S.len - x) / S.up : 1); }
  // on a flight of steps? +1 climbing, -1 descending, 0 not
  stairDir(s) { const S = this.stairs; if (!S) return 0; const x = this.wrapD(s - S.s0); return x >= 0 && x < S.up ? 1 : x > S.len - S.up && x <= S.len ? -1 : 0; }
  stairsZone(s) { const S = this.stairs; if (!S) return false; const x = this.wrapD(s - S.s0); return x >= 0 && x <= S.len; }
  inWater(s, d) { const W = this.nala; if (!W) return false; const x = this.wrapD(s - W.s0); return x >= 0 && x <= W.len && Math.abs(d) < this.wAt(s) / 2 + 1.0; }
  nakaNear(s, ahead = 80) { for (const n of this.nakas) { const x = this.wrapD(n.s - s); if (x > -6 && x < ahead) return n; } return null; }
  gapAt(s) { const R = this.roof; if (!R) return null; const x = this.wrapD(s - R.s0); for (const g of R.gaps) if (x >= g.x0 - 0.2 && x <= g.x0 + g.len + 0.2) return g; return null; }
  onRoofTop(s) { const R = this.roof; if (!R) return false; const x = this.wrapD(s - R.s0); return x >= R.up && x <= R.len - R.up; }
  hallAt(s) { for (const h of this.halls) { const x = this.wrapD(s - h.s0); if (x >= -2 && x <= h.s1 - h.s0 + 2) return h; } return null; }
  // localized ground: the kicker ramps rise under one lane only
  kickerAt(s, d) { for (const k of this.kickers) { const x = this.wrapD(s - k.s); if (x < 0 || x > k.len) continue; if (Math.abs(d - k.d) <= k.hw) return { k, x, y: k.h * Math.pow(x / k.len, 1.25) }; } return null; }
  gy(s, d) { const kk = this.kickerAt(s, d); return this.yAt(s) + (kk ? kk.y : 0); }
  // inside a shortcut's kachha lane? (returns the shortcut or null)
  laneAt(s, d) {
    for (const sc of this.shortcuts) { let ds = s - sc.s; if (ds > this.L / 2) ds -= this.L; if (ds < -this.L / 2) ds += this.L;
      if (Math.abs(ds) > sc.half - sc.ramp * 0.5) continue; if (d * sc.side > this.get(this.w0, s) / 2 + 2.6) return sc; }
    return null;
  }
  islandD(s, sc) { return sc.side * (this.get(this.w0, s) / 2 + 1.35); }
  // Potholes (small / big) and kichad (mud) patches, seeded per track so every race sees the same road
  placeHazards(def) {
    const R = this.rng, L = this.L; this.hazards = [];
    const ok = (s, pad) => s > 70 && s < L - 35 && !this.bumps.some(b => Math.abs(b.s - s) < b.len + pad) && !this.shortcuts.some(sc => Math.abs(s - sc.s) < sc.half + 4) && !this.pieceZones.some(([a, b]) => s > a - pad && s < b + pad);
    const spot = (pad) => { for (let t = 0; t < 40; t++) { const s = 70 + R() * (L - 105); if (ok(s, pad) && !this.hazards.some(h => Math.abs(h.s - s) < 14)) return s; } return null; };
    const add = (type, n, fn) => { for (let k = 0; k < n; k++) { const s = spot(8); if (s === null) continue; this.hazards.push(fn(s)); } };
    add('pothole', def.potholes || 0, (s) => { const w = this.get(this.w0, s) / 2 - 1; return { type: 'pothole', s, d: (R() * 2 - 1) * w, r: 0.42 + R() * 0.25, big: false }; });
    add('pothole', def.bigPotholes || 0, (s) => { const w = this.get(this.w0, s) / 2 - 1.6; return { type: 'pothole', s, d: (R() * 2 - 1) * w * 0.8, r: 0.95 + R() * 0.35, big: true }; });
    add('mud', def.mud || 0, (s) => { const w = this.get(this.w0, s) / 2; const hw = 1.3 + R() * 1.6; return { type: 'mud', s, d: (R() * 2 - 1) * Math.max(0, w - hw - 0.3), len: 6 + R() * 7, hw }; });
    // the kachha lanes are rough: mud and a couple of small potholes in each
    for (const sc of this.shortcuts) {
      const laneC = (s) => sc.side * ((this.get(this.w0, s) / 2 + 2.6 + this.get(this.w, s) / 2) / 2);
      this.hazards.push({ type: 'mud', s: sc.s + (R() - 0.5) * 10, d: laneC(sc.s), len: 9 + R() * 5, hw: 1.6, lane: true });
      for (const f of [-0.55, 0.5]) { const s = sc.s + f * (sc.half - sc.ramp); this.hazards.push({ type: 'pothole', s, d: laneC(s) + (R() - 0.5) * 1.5, r: 0.5 + R() * 0.2, big: false, lane: true }); }
    }
    this.hazards.sort((a, b) => a.s - b.s);
    this.hazards.forEach((h, i) => (h.id = i));
  }
  idx(s) { s = ((s % this.L) + this.L) % this.L; const f = s / STEP; const i = Math.floor(f); return [i % this.N, (i + 1) % this.N, f - i]; }
  get(arr, s) { const [i, j, f] = this.idx(s); return arr[i] + (arr[j] - arr[i]) * f; }
  yawAt(s) { const [i, j, f] = this.idx(s); return this.yaw[i] + wrapAngle(this.yaw[j] - this.yaw[i]) * f; }
  kAt(s) { return this.get(this.k, s); }
  wAt(s) { return this.get(this.w, s); }
  w0At(s) { return this.get(this.w0, s); }
  yAt(s) { return this.get(this.py, s); }
  slopeAt(s) { return this.get(this.slope, s); }
  rlAt(s) { return this.get(this.rl, s); }
  vmaxAt(s) { return this.get(this.vmax, s); }
  // world position of (s, d) → out (THREE.Vector3)
  pos(s, d, out, yOff = 0) {
    const [i, j, f] = this.idx(s);
    const x = this.px[i] + (this.px[j] - this.px[i]) * f, z = this.pz[i] + (this.pz[j] - this.pz[i]) * f;
    const tx = this.tx[i] + (this.tx[j] - this.tx[i]) * f, tz = this.tz[i] + (this.tz[j] - this.tz[i]) * f;
    const len = Math.hypot(tx, tz) || 1;
    // left normal = up × forward = (tz, 0, -tx)
    out.set(x + (tz / len) * d, this.py[i] + (this.py[j] - this.py[i]) * f + yOff, z + (-tx / len) * d);
    return out;
  }
  // AI speed profile: corner limit from curvature, then backward braking pass
  computeSpeedProfile(cornerMul) {
    const N = this.N, vTop = 40;
    for (let i = 0; i < N; i++) {
      const k = Math.abs(this.k[i]); const Reff = 1 / Math.max(k, 1e-4) + this.w0[i] * 0.7;
      this.vmax[i] = Math.min(vTop, Math.sqrt(G * 1.0 * cornerMul * Reff));
    }
    for (const bp of this.bumps) if (bp.type === 'breaker') for (let i = Math.floor((bp.s - 3) / STEP); i <= Math.ceil((bp.s + 3) / STEP); i++) { const j = ((i % N) + N) % N; this.vmax[j] = Math.min(this.vmax[j], bp.triple ? 13 : 14.5); }
    const b = 7.5;
    for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) { const j = (i + 1) % N; this.vmax[i] = Math.min(this.vmax[i], Math.sqrt(this.vmax[j] ** 2 + 2 * b * STEP)); }
    if (this.roof) for (let i = 0; i < N; i++) { const x = this.wrapD(i * STEP - this.roof.s0); if (x > -30 && x < this.roof.len) this.vmax[i] = Math.max(this.vmax[i], 19); }
    const cap = (a, b, v) => { for (let i = Math.floor(a / STEP); i <= Math.ceil(b / STEP); i++) { const j = ((i % N) + N) % N; this.vmax[j] = Math.min(this.vmax[j], v); } };
    if (this.stairs) cap(this.stairs.s0 - 2, this.stairs.s0 + this.stairs.len + 2, 17);
    if (this.nala) cap(this.nala.s0, this.nala.s0 + this.nala.len, 15);
    for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) { const j = (i + 1) % N; this.vmax[i] = Math.min(this.vmax[i], Math.sqrt(this.vmax[j] ** 2 + 2 * b * STEP)); }
    for (const nk of this.nakas) for (let i = Math.floor((nk.s - 40) / STEP); i <= Math.ceil(nk.s / STEP); i++) { const j = ((i % N) + N) % N; this.vmax[j] = Math.max(this.vmax[j], 18); }
  }
  // nearest track s for a world point (coarse search); used by scenery placement
  buildGrid() {
    this.grid = new Map(); const cs = 20;
    for (let i = 0; i < this.N; i += 2) { const key = Math.floor(this.px[i] / cs) + ',' + Math.floor(this.pz[i] / cs); if (!this.grid.has(key)) this.grid.set(key, []); this.grid.get(key).push(i); }
    this.gridCS = cs;
  }
  // signed clearance: distance from point to road edge (negative if on road), minimum over nearby samples
  clearance(x, z) {
    if (!this.grid) this.buildGrid();
    const cs = this.gridCS, gx = Math.floor(x / cs), gz = Math.floor(z / cs); let best = 1e9;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const arr = this.grid.get((gx + a) + ',' + (gz + b)); if (!arr) continue;
      for (const i of arr) { const dd = Math.hypot(x - this.px[i], z - this.pz[i]) - this.w[i] / 2; if (dd < best) best = dd; }
    }
    return best;
  }
}

function cyclicKey(keys, f, smoothIt) {
  if (keys.length === 1) return keys[0][1];
  for (let i = 0; i < keys.length; i++) {
    const a = keys[i], b = keys[(i + 1) % keys.length];
    const fa = a[0], fb = i + 1 < keys.length ? b[0] : b[0] + 1;
    let ff = f; if (i + 1 >= keys.length && ff < fa) ff += 1;
    if (ff >= fa && ff <= fb) { let t = (ff - fa) / Math.max(1e-6, fb - fa); if (smoothIt) t = sstep(t); return lerp(a[1], b[1], t); }
  }
  return keys[0][1];
}
