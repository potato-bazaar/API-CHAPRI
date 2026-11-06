// ───────────────────────── STREET RUNTIME (every track) ─────────────────────────
// Traffic you weave through (autos, kaali-peeli taxis, a BEST bus, tempos) with a Light / Jam / Off setting; nitro strips
// for everyone; the direction guide (racing-line chevrons on the road that go amber and red when you're too fast for
// what's coming, and a next-corner / nitro card at the top); and the boost look: neon light trails off the tail, electric
// arcs round the silencer, the sky light and fog shifting violet while you're on it.
const C_GO = new THREE.Color('#40ffb8'), C_LIFT = new THREE.Color('#ffc21a'), C_BRAKE = new THREE.Color('#ff2438'), C_NEON_SKY = new THREE.Color('#8a5cff'), C_NEON_FOG = new THREE.Color('#3a1a60');
class StreetOps {
  constructor(race) {
    this.race = race; const T = race.track, W = race.world, G = race.game;
    W.obstacles = W.obstacles.filter(o => o.kind !== 'traffic'); this.lastS = new Map(); this._p = new THREE.Vector3(); this._q = new THREE.Vector3();
    // ── traffic ──
    const dens = SAVE.settings.traffic || 'light'; this.cars = []; this.zones = [];
    if (dens !== 'off') { const geo = trafficGeo(), gap = dens === 'jam' ? 26 : 70, slow = dens === 'jam' ? 0.62 : 1, kinds = ['auto', 'taxi', 'bus', 'auto', 'tempo', 'taxi', 'auto', 'taxi'];
      this.mats = { body: new THREE.MeshLambertMaterial({ vertexColors: true }), lights: new THREE.MeshBasicMaterial({ vertexColors: true }) }; let ki = race.track.def.id.length;
      for (const z of T.trafficZones || []) { const zi = this.zones.length, n = Math.max(1, Math.round((z.b - z.a) / gap)); this.zones.push({ a: z.a, b: z.b, fresh: true });
        for (let i = 0; i < n; i++) { const kind = kinds[ki++ % kinds.length], K = TRAFFIC_KINDS[kind], g = new THREE.Group(); const body = new THREE.Mesh(geo[kind].body, this.mats.body); body.castShadow = G.quality === 'high'; g.add(body, new THREE.Mesh(geo[kind].lights, this.mats.lights)); race.group.add(g);
          const c = { kind, K, g, zi, s: 0, d: 0, v: K.v[0] * slow, vT: (K.v[0] + RNG() * (K.v[1] - K.v[0])) * slow, lane: i % 2 ? 1 : -1, laneT: 3 + RNG() * 6, hornT: 0, prevDs: null, lastNear: -9 };
          c.obs = { s: 0, d: 0, hw: K.hw, hl: K.hl, kind: 'traffic' }; W.obstacles.push(c.obs); this.cars.push(c); } }
      this.zones.forEach((zn, zi) => this.spread(zi)); }
    // ── direction guide ──
    this.guideOn = SAVE.settings.guide !== false; this.nG = 14;
    if (this.guideOn) {   // a ribbon of chevrons along the racing line, coloured by how hard you need to brake for what's ahead
      if (!TEX.guideLine) { const [c, x] = mkCanvas(64, 128); x.clearRect(0, 0, 64, 128); for (const oy of [6, 70]) { x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(32, oy); x.lineTo(60, oy + 30); x.lineTo(60, oy + 50); x.lineTo(32, oy + 22); x.lineTo(4, oy + 50); x.lineTo(4, oy + 30); x.closePath(); x.fill(); } TEX.guideLine = toTex(c, { repeat: true, srgb: false }); }
      const NS = 24, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NS + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array((NS + 1) * 2 * 4), 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((NS + 1) * 2 * 2), 2).setUsage(THREE.DynamicDrawUsage));
      const idx = []; for (let i = 0; i < NS; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx); this.NS = NS;
      this.gMat = new THREE.MeshBasicMaterial({ map: TEX.guideLine, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false });
      this.guide = new THREE.Mesh(g, this.gMat); this.guide.frustumCulled = false; this.guide.renderOrder = 3; race.group.add(this.guide); this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); }
    this.guideEl = $('#guide'); this.guideT = 0; this.guideKey = '';
    // ── boost look: two neon ribbons off the tail, electric arcs at the silencer ──
    const NT = 46; this.trail = []; this.trailN = NT;
    for (const col of ['#ff2e88', '#3fe8ff']) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NT * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const idx = []; for (let i = 0; i < NT - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; m.renderOrder = 4; m.visible = false; race.group.add(m);
      this.trail.push({ g, m, col: new THREE.Color(col), pts: [], lat: col === '#ff2e88' ? 0.22 : -0.22 }); }
    { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 7 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(3 * 7 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      this.arcs = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); this.arcs.frustumCulled = false; this.arcs.visible = false; this.arcs.renderOrder = 5; race.group.add(this.arcs); this.arcT = 0; }
    this.hemiBase = W.hemi.color.clone(); this.fogBase = W.fog ? W.fog.color.clone() : null;
    // ── boost ring (Auto Rush style): a segmented ring on the road round your bike. It fills from the back, both sides
    // at once, so from the chase cam it reads like a gauge; full ring = it pulses; while you burn it the lit arc drains.
    { const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
        uniforms: { uFill: { value: 0 }, uOn: { value: 0 }, uT: { value: 0 }, uFull: { value: 0 }, uBurn: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uFill, uOn, uT, uFull, uBurn;
          void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p);
            float band = smoothstep(0.70, 0.735, r) * (1.0 - smoothstep(0.95, 0.985, r)); float halo = smoothstep(0.55, 0.72, r) * (1.0 - smoothstep(0.98, 1.0, r));
            if (halo < 0.01) discard;
            float f = abs(atan(p.x, p.y)) / 3.14159265;            // 0 straight behind the bike, 1 straight ahead
            float N = 6.0, seg = f * N, fs = fract(seg), idx = floor(seg);
            float gap = smoothstep(0.03, 0.12, fs) * (1.0 - smoothstep(0.88, 0.97, fs));
            float lit = clamp(uFill * N - idx, 0.0, 1.0); lit = lit >= 0.999 ? 1.0 : lit * 0.55;
            vec3 cOn = mix(vec3(0.25, 0.95, 1.0), vec3(1.0, 0.2, 0.62), smoothstep(0.1, 0.95, f));
            float pulse = 1.0 + uFull * 0.35 * (0.5 + 0.5 * sin(uT * 9.0)) + uBurn * 0.4;
            vec3 col = mix(vec3(0.82, 0.84, 0.95), cOn * pulse, lit);   // empty segments: pale glass, so the ring is always readable
            float a = band * gap * mix(0.26, 1.0, lit) + halo * lit * (0.08 + 0.14 * uFull + 0.2 * uBurn);
            gl_FragColor = vec4(col, a * uOn); }` });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), m); mesh.rotation.x = -Math.PI / 2;
      this.ring = new THREE.Group(); this.ring.rotation.order = 'YXZ'; this.ring.add(mesh); mesh.renderOrder = 3; mesh.frustumCulled = false; race.group.add(this.ring); this.ringMat = m; this.ringFill = 0; }
  }
  // ── traffic helpers ──
  spread(zi) { const zn = this.zones[zi], cs = this.cars.filter(c => c.zi === zi), len = zn.b - zn.a;
    cs.forEach((c, i) => { c.s = zn.a + len * (i + 0.3 + RNG() * 0.4) / cs.length; c.lane = RNG() < 0.5 ? -1 : 1; c.d = this.laneD(c, c.s); c.v = c.vT; c.prevDs = null; this.place(c); }); }
  laneD(c, s) { const w = this.race.track.wAt(s) / 2; return c.lane * Math.max(0, w * 0.5 - c.K.hw * 0.35); }
  place(c) { const T = this.race.track; T.pos(c.s, c.d, c.g.position, 0); c.g.rotation.y = T.yawAt(c.s) + clamp((c.dv || 0) / Math.max(3, c.v), -0.3, 0.3); c.obs.s = c.s; c.obs.d = c.d; }
  honk(c, vol) { if (vol < 0.04) return; const f = c.K.horn; for (let i = 0; i < c.K.beeps; i++) { AUDIO.tone('square', f, f * 0.99, 0.15, 0.07 * vol, i * 0.2); AUDIO.tone('square', f * 1.26, f * 1.25, 0.15, 0.05 * vol, i * 0.2); } }
  update(dt) {
    const R = this.race, T = R.track, W = R.world, P = R.player, G = R.game, racing = R.state === 'racing';
    // traffic: each zone's cars are laid out fresh while you're far away, then drive; out of sight they loop back
    this.zones.forEach((zn, zi) => { const toA = T.wrapD(zn.a - P.s); if (toA > 160 && toA < 700) { if (!zn.fresh) { this.spread(zi); zn.fresh = true; } } else if (toA < 40) zn.fresh = false; });
    for (const c of this.cars) { const zn = this.zones[c.zi];
      if (!zn.fresh) { let lim = c.vT; for (const o of this.cars) { if (o === c) continue; const ds = T.wrapD(o.s - c.s); if (ds > 0 && ds < c.K.hl + o.K.hl + 5 && Math.abs(o.d - c.d) < 1.9) lim = Math.min(lim, o.v - 0.4); }
        c.v = smooth(c.v, Math.max(2.5, lim), 1.6, dt); c.s += c.v * dt;
        c.laneT -= dt; if (c.laneT <= 0) { c.laneT = 5 + RNG() * 7; const nl = -c.lane, lw = this.laneD({ lane: nl, K: c.K }, c.s);   // no lane change across a bike that's closing in
          if (!this.cars.some(o => o !== c && Math.sign(o.d) === nl && Math.abs(T.wrapD(o.s - c.s)) < o.K.hl + c.K.hl + 4) && !R.riders.some(r => { const dr = T.wrapD(c.s - r.s); return dr > -2 && dr < 22 && Math.abs(r.d - lw) < 2.2; })) c.lane = nl; }
        const old = c.d; c.d = smooth(c.d, this.laneD(c, c.s), 0.7, dt); c.dv = (c.d - old) / Math.max(dt, 1e-4);
        const past = T.wrapD(c.s - zn.b), rel = T.wrapD(c.s - P.s), atA = T.wrapD(zn.a - P.s);
        if (past > 20 && (rel > 160 || rel < -40) && !(atA > -30 && atA < 140)) { c.s = zn.a - 4; c.v = c.vT; c.prevDs = null; } }
      this.place(c);
      const ds = T.wrapD(c.s - P.s), lat = Math.abs(c.d - P.d);
      if (c.prevDs !== null && c.prevDs > 0 && ds <= 0 && !P.crashed && racing && lat < c.K.hw + 1.35 && P.v - c.v > 5 && R.raceT - c.lastNear > 2) {
        c.lastNear = R.raceT; P.boost = Math.min(100, P.boost + 12); R.award('nearMiss', PTS.nearMiss); R.score.trafficShaves = (R.score.trafficShaves || 0) + 1; G.comicPop('PEEP PEEP!', { s: c.s, d: c.d, y: T.yAt(c.s) + 0.6 }, 0.8, '#ffd23f'); this.honk(c, 1); c.hornT = 2;
        if (Math.random() < 0.3) P.rig.gesture('wave', c.d > P.d ? 1 : -1); }
      c.prevDs = ds; c.hornT -= dt;
      if (c.hornT <= 0) for (const r of R.riders) { if (r.isPlayer || r.eliminated || r.crashed) continue; const dr = T.wrapD(c.s - r.s); if (dr > -1 && dr < c.K.hl + 3 && Math.abs(c.d - r.d) < c.K.hw + 0.9) { this.honk(c, R.distToPlayer(r) * 0.9); c.hornT = 2.5 + Math.random() * 2; break; } } }
    // nitro strips: anybody who threads one gets a kick; the player also gets boost
    for (const r of R.riders) { if (r.eliminated) continue; const last = this.lastS.get(r); this.lastS.set(r, r.s); if (last === undefined || r.crashed || r.air) continue;
      for (const n of T.nitros || []) { const a = T.wrapD(last - n.s), b = T.wrapD(r.s - n.s); if (a < n.len * 0.5 && b >= n.len * 0.5 && b < n.len + 6 && Math.abs(r.d - n.d) < n.hw + 0.4) {
        r.v = Math.min(r.v + 4.5, r.vTop * 1.3);
        if (r.isPlayer) { P.boost = Math.min(100, P.boost + 30); G.comicPop('NITRO!', P, 1.05, '#3fe8ff'); G.fx.fovPunch = Math.max(G.fx.fovPunch, 10); G.shake(0.22); R.rumble(0.5, 0.18); AUDIO.boostKick(); R.combat.zap && R.combat.zap(P, 1); } } } }
    this.updateGuide(dt); this.updateBoostFX(dt); this.updateRing(dt);
  }
  updateRing(dt) {
    const R = this.race, T = R.track, P = R.player, G = R.game, U = this.ringMat.uniforms;
    const show = !P.crashed && !P.finished && !P.eliminated && G.camMode !== 2 && !G.td && R.state !== 'finished';
    this.ringFill = smooth(this.ringFill, clamp(P.boost / 100, 0, 1), 10, dt);
    const gy = T.roof && T.gapAt(P.s) ? P.y : T.yAt(P.s), hAbove = Math.max(0, P.y - gy);
    U.uFill.value = this.ringFill; U.uT.value += dt; U.uFull.value = smooth(U.uFull.value, P.boost >= 99 && !P.boosting ? 1 : 0, 6, dt); U.uBurn.value = smooth(U.uBurn.value, P.boosting ? 1 : 0, 8, dt);
    U.uOn.value = smooth(U.uOn.value, show ? clamp(1 - hAbove / 3, 0.15, 1) : 0, 8, dt);
    this.ring.visible = U.uOn.value > 0.01; if (!this.ring.visible) return;
    T.pos(P.s, P.d, this.ring.position, gy - T.yAt(P.s) + 0.05);
    const slope = (T.yAt(P.s + 1.5) - T.yAt(P.s - 1.5)) / 3; this.ring.rotation.set(-Math.atan(slope), T.yawAt(P.s) + P.psi, 0);
  }
  // racing-line chevrons + the next-corner / nitro card
  updateGuide(dt) {
    const R = this.race, T = R.track, P = R.player, show = this.guideOn && R.state === 'racing' && !P.crashed && !P.finished;
    if (this.guide) { this.guide.visible = show && !P.air;
      if (this.guide.visible) { const g = this.guide.geometry, pos = g.attributes.position.array, col = g.attributes.color.array, uv = g.attributes.uv.array, NS = this.NS, len = 26 + P.v * 1.5, s0 = P.s + 5, c = new THREE.Color();
        for (let i = 0; i <= NS; i++) { const u = i / NS, s = s0 + u * len, f = clamp(u * 3, 0, 1), d = lerp(P.d, T.rlAt(s), f), w = 0.75 + 0.35 * u;
          const yaw = T.yawAt(s), lx = Math.cos(yaw), lz = -Math.sin(yaw); T.pos(s, d, this._a, 0.04);
          pos.set([this._a.x - lx * w, this._a.y, this._a.z - lz * w, this._a.x + lx * w, this._a.y, this._a.z + lz * w], i * 6);
          const need = P.v / Math.max(6, T.vmaxAt(s + 4)), cc = need > 1.1 ? C_BRAKE : need > 0.96 ? C_LIFT : C_GO, a = Math.min(1, u * 5) * Math.min(1, (1 - u) * 2.2) * 0.95; c.copy(cc);
          col.set([c.r, c.g, c.b, a, c.r, c.g, c.b, a], i * 8); const v = s / 2.4; uv.set([0, v, 1, v], i * 4); }
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.uv.needsUpdate = true; } }
    // the card: rate-limited text updates
    this.guideT -= dt; if (!this.guideEl || this.guideT > 0) return; this.guideT = 0.15;
    let html = '';
    if (show) { let cn = null; for (const c of T.corners || []) { const x = T.wrapD(c.s - P.s); if (x > 4 && x < 135 && (!cn || x < cn.x)) cn = { c, x }; }
      if (cn && cn.c.kind !== 'bend') { const lbl = (cn.c.kind === 'hairpin' ? 'HAIRPIN ' : 'SHARP ') + (cn.c.dir > 0 ? 'LEFT' : 'RIGHT'); html += `<span class="gturn ${cn.c.kind}"><i class="garrow ${cn.c.dir > 0 ? 'l' : 'r'} ${cn.c.kind}"></i>${lbl}<b>${Math.round(cn.x / 5) * 5} m</b></span>`; }
      let nn = null; for (const n of T.nitros || []) { const x = T.wrapD(n.s - P.s); if (x > 6 && x < 280 && (!nn || x < nn.x)) nn = { n, x }; }
      if (nn) { const dl = nn.n.d - P.d, dir = dl > 1.4 ? '⟵' : dl < -1.4 ? '⟶' : '↑'; html += `<span class="gnitro">⚡ NITRO <b>${Math.round(nn.x / 5) * 5} m</b><em>${dir}</em></span>`; } }
    if (html !== this.guideKey) { this.guideKey = html; this.guideEl.innerHTML = html; this.guideEl.hidden = !html; }
  }
  updateBoostFX(dt) {
    const R = this.race, T = R.track, W = R.world, P = R.player, G = R.game, b = G.fx ? G.fx.boostAmt : 0;
    // the world shifts violet while you're on it
    W.hemi.color.copy(this.hemiBase).lerp(C_NEON_SKY, b * 0.45); if (W.fog && this.fogBase) W.fog.color.copy(this.fogBase).lerp(C_NEON_FOG, b * 0.35);
    // neon ribbons off the tail light
    const yaw = T.yawAt(P.s) + P.psi, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw), base = T.pos(P.s, P.d, this._q, P.y - T.yAt(P.s));
    const on = b > 0.04 && !P.crashed;
    for (const tr of this.trail) {
      if (on) { tr.pts.unshift({ x: base.x - fx * 1.05 + lx * tr.lat, y: base.y + 0.62 + P.pitch * 0.8, z: base.z - fz * 1.05 + lz * tr.lat, t: 0 }); if (tr.pts.length > this.trailN) tr.pts.pop(); }
      for (const q of tr.pts) q.t += dt; while (tr.pts.length && tr.pts[tr.pts.length - 1].t > 0.55) tr.pts.pop();
      tr.m.visible = tr.pts.length > 1; if (!tr.m.visible) continue;
      const pos = tr.g.attributes.position.array, col = tr.g.attributes.color.array, n = tr.pts.length;
      for (let i = 0; i < this.trailN; i++) { const q = tr.pts[Math.min(i, n - 1)], k = i < n ? (1 - q.t / 0.55) * (1 - i / n) * Math.max(0.25, b) : 0, h = 0.06 + 0.16 * (1 - i / this.trailN);   // flat ribbons: read from the chase cam as two streaks of light
        pos.set([q.x - lx * h, q.y, q.z - lz * h, q.x + lx * h, q.y, q.z + lz * h], i * 6); col.set([tr.col.r * k, tr.col.g * k, tr.col.b * k, tr.col.r * k * 1.3, tr.col.g * k * 1.3, tr.col.b * k * 1.3], i * 6); }
      tr.g.attributes.position.needsUpdate = true; tr.g.attributes.color.needsUpdate = true; tr.g.setDrawRange(0, Math.max(0, n - 1) * 6); }
    // electric arcs crackling round the silencer
    this.arcs.visible = on; if (on) { this.arcT -= dt; if (this.arcT <= 0) { this.arcT = 0.045; const pos = this.arcs.geometry.attributes.position.array, col = this.arcs.geometry.attributes.color.array; let k = 0;
      const ex = base.x - fx * 0.95 - lx * 0.2, ey = base.y + 0.42, ez = base.z - fz * 0.95 - lz * 0.2;
      for (let a = 0; a < 3; a++) { const c = a % 2 ? [1.0, 0.25, 0.65] : [0.3, 0.95, 1.0]; let px = ex, py = ey, pz = ez; const tx = ex - fx * (0.6 + Math.random() * 0.9) + lx * (Math.random() - 0.5) * 1.2, ty = ey + (Math.random() - 0.3) * 0.9, tz = ez - fz * (0.6 + Math.random() * 0.9) + lz * (Math.random() - 0.5) * 1.2;
        for (let j = 1; j <= 7; j++) { const u = j / 7, nx = ex + (tx - ex) * u + (Math.random() - 0.5) * 0.22, ny = ey + (ty - ey) * u + (Math.random() - 0.5) * 0.22, nz = ez + (tz - ez) * u + (Math.random() - 0.5) * 0.22;
          pos.set([px, py, pz, nx, ny, nz], k * 6); col.set([...c, ...c], k * 6); k++; px = nx; py = ny; pz = nz; } }
      this.arcs.geometry.attributes.position.needsUpdate = true; this.arcs.geometry.attributes.color.needsUpdate = true; } }
  }
  dispose() { const W = this.race.world; W.obstacles = W.obstacles.filter(o => o.kind !== 'traffic'); W.hemi.color.copy(this.hemiBase); if (W.fog && this.fogBase) W.fog.color.copy(this.fogBase);
    if (this.mats) { this.mats.body.dispose(); this.mats.lights.dispose(); } if (this.gMat) { this.gMat.dispose(); this.guide.geometry.dispose(); } for (const t of this.trail) { t.g.dispose(); t.m.material.dispose(); } this.arcs.geometry.dispose(); this.arcs.material.dispose(); this.ring.children[0].geometry.dispose(); this.ringMat.dispose(); if (this.guideEl) this.guideEl.hidden = true; }
}
