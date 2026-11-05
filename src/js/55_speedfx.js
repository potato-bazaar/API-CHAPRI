// ───────────────────────── SPEED FEEL: speed lines, wind streaks, rain, boost kick, whoosh-by ─────────────────────────
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C_LINE = ['#ffffff', '#ffffff', '#ffffff', '#ffe9c4'], C_LINE_BOOST = ['#ffffff', '#ff8cc0', '#ffd86a', '#ffffff'];

class SpeedFX {
  constructor(game) {
    this.game = game; this.canvas = $('#speedfx'); this.ctx = this.canvas.getContext('2d'); this.vig = $('#vignette'); this.flashEl = $('#boostFlash');
    this.lines = []; this.fovPunch = 0; this.dip = 0; this.boostAmt = 0; this.intensity = 0; this.cleared = true;
    this.vp = new THREE.Vector3(); this._p = new THREE.Vector3();
    // 3D wind streaks: static in the world, so the rider rushes through them
    const N = 120; this.N = N; this.sp = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.streakMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false });
    this.streaks = new THREE.LineSegments(g, this.streakMat); this.streaks.frustumCulled = false; this.streaks.visible = false;
    for (let i = 0; i < N; i++) this.sp.push({ s: 0, d: 0, h: 0, alive: false, b: 0.5 });
    this.resize();
  }
  attach(scene) { scene.add(this.streaks); }
  resize() { const k = Math.min(1, 900 / Math.max(innerWidth, innerHeight)) * (devicePixelRatio > 1 ? 0.75 : 0.6); this.res = Math.max(0.35, k); this.canvas.width = Math.round(innerWidth * this.res); this.canvas.height = Math.round(innerHeight * this.res); }
  reset(race) { this.race = race; this.prevS = race.player.s; this.prevRel = new Map(); this.prevBoost = false; this.lastWhoosh = 0; this.lines.length = 0; this.sp.forEach(p => (p.alive = false)); this.fovPunch = 0; this.dip = 0; this.boostAmt = 0; this.intensity = 0; }
  clear() { if (this.cleared) return; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.vig.style.opacity = 0; this.vig.style.setProperty('--boost', 0); this.streaks.visible = false; this.cleared = true; $('.speedo') && $('.speedo').classList.remove('redline'); }
  kick() {
    this.fovPunch = 13; this.dip = 0.24; this.game.shake(0.28);
    const f = this.flashEl; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    AUDIO.boostKick(); MUSIC.hornStab(); this.race.rumble(0.6, 0.25); this.game.comicPop('VROOOM!', this.race.player, 1.1, '#ffd23f');
    for (let i = 0; i < 40; i++) this.lines.push(this.newLine(true));
  }
  newLine(boost) {
    return { a: Math.random() * Math.PI * 2, r: 0.42 + Math.random() * 0.45, len: 0.12 + Math.random() * 0.3, w: 0.6 + Math.random() * 1.8, v: 1.4 + Math.random() * 2.2, t: 0, life: 0.1 + Math.random() * 0.22, al: 0.35 + Math.random() * 0.55, c: (boost ? C_LINE_BOOST : C_LINE)[Math.floor(Math.random() * 4)] };
  }
  update(dt, camera) {
    const R = this.race; if (!R) return; const P = R.player, T = R.track; this.cleared = false;
    const kmh = P.v * 3.6, racing = R.state === 'racing' && !P.crashed;
    this.boostAmt = smooth(this.boostAmt, P.boosting ? 1 : 0, P.boosting ? 10 : 3, dt);
    if (racing && P.boosting && !this.prevBoost) this.kick();
    this.prevBoost = P.boosting;
    this.fovPunch *= Math.exp(-2.6 * dt); this.dip *= Math.exp(-4.5 * dt);
    const target = racing ? clamp((kmh - 52) / 46, 0, 1) * 0.9 + this.boostAmt * 0.6 : 0;
    this.intensity = smooth(this.intensity, target * (REDUCED_MOTION ? 0.35 : 1), 5, dt);
    this.drawLines(dt, camera);
    this.vig.style.opacity = (this.intensity * 0.55 + this.boostAmt * 0.3).toFixed(3);
    this.vig.style.setProperty('--boost', this.boostAmt.toFixed(3));
    const sp = $('.speedo'); if (sp) sp.classList.toggle('redline', racing && (P.rpm > 9300 || P.boosting) && !REDUCED_MOTION);
    this.updateStreaks(dt, P, T);
    this.whooshes(P, T, R);
  }
  // rain on the lens: slanted streaks + fat drops that slide and get blown sideways at speed
  rainOnly(dt) { this.cleared = false; const ctx = this.ctx; ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.drawRain(dt, 0); }
  drawRain(dt, speed) {
    if (!this.game.wet || REDUCED_MOTION) return; const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, k = this.res;
    if (!this.rs) { this.rs = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), l: 0.04 + Math.random() * 0.08, v: 1.4 + Math.random() * 1.2, a: 0.15 + Math.random() * 0.3 })); this.drops = []; }
    const slant = 0.18 + speed * 0.012;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#e8efff';
    for (const r of this.rs) { r.y += r.v * dt * (1 + speed * 0.02); r.x -= slant * r.v * dt * 0.6; if (r.y > 1.1 || r.x < -0.1) { r.y = -0.1 - Math.random() * 0.2; r.x = Math.random() * 1.2; }
      ctx.globalAlpha = r.a; ctx.lineWidth = (1.2 + r.a * 2) * k * 1.6; ctx.beginPath(); ctx.moveTo(r.x * W, r.y * H); ctx.lineTo((r.x + slant * r.l) * W, (r.y - r.l) * H); ctx.stroke(); }
    if (this.drops.length < 14 && Math.random() < dt * (3 + speed * 0.1)) this.drops.push({ x: Math.random(), y: Math.random() * 0.8, r: (6 + Math.random() * 14) * k * 1.4, t: 0, life: 1.2 + Math.random() * 2 });
    for (let i = this.drops.length - 1; i >= 0; i--) { const d = this.drops[i]; d.t += dt; if (d.t > d.life) { this.drops.splice(i, 1); continue; }
      d.y += dt * (0.02 + d.t * 0.04); d.x += dt * (speed > 15 ? -0.25 : 0); const a = Math.sin(Math.PI * Math.min(1, d.t / d.life)) * 0.75;
      const x = d.x * W, y = d.y * H; const g = ctx.createRadialGradient(x - d.r * 0.3, y - d.r * 0.35, d.r * 0.1, x, y, d.r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.55, 'rgba(210,225,255,0.12)'); g.addColorStop(0.85, 'rgba(40,50,80,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, d.r * 0.9, d.r, 0, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  drawLines(dt, camera) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height; ctx.clearRect(0, 0, W, H);
    this.drawRain(dt, this.race && this.race.player ? this.race.player.v : 0);
    if (this.intensity < 0.02) { this.lines.length = 0; return; }
    // vanishing point = where the camera is looking
    this.vp.copy(this.game.camLook).project(camera); const cx = (this.vp.x + 1) / 2 * W, cy = (1 - this.vp.y) / 2 * H;
    const Rr = Math.hypot(W, H) * 0.55; const want = Math.floor(this.intensity * 110);
    while (this.lines.length < want) this.lines.push(this.newLine(this.boostAmt > 0.5));
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i]; l.t += dt; l.r += l.v * dt;
      if (l.t > l.life || l.r > 1.2) { if (this.lines.length > want) { this.lines.splice(i, 1); continue; } Object.assign(l, this.newLine(this.boostAmt > 0.5)); }
      const ca = Math.cos(l.a), sa = Math.sin(l.a); const r0 = l.r * Rr, r1 = (l.r + l.len) * Rr; const w = l.w * this.res * (1 + this.boostAmt);
      const fade = Math.sin(Math.PI * clamp(l.t / l.life, 0, 1));
      ctx.globalAlpha = clamp(l.al * this.intensity * fade, 0, 1); ctx.fillStyle = l.c;
      ctx.beginPath(); ctx.moveTo(cx + ca * r0, cy + sa * r0); ctx.lineTo(cx + ca * r1 - sa * w, cy + sa * r1 + ca * w); ctx.lineTo(cx + ca * r1 + sa * w, cy + sa * r1 - ca * w); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  updateStreaks(dt, P, T) {
    const op = clamp((P.v - 9) / 18, 0, 1) * 0.55 + this.boostAmt * 0.35;
    this.streakMat.opacity = op; this.streaks.visible = op > 0.01;
    if (!this.streaks.visible) return;
    const pos = this.streaks.geometry.attributes.position, colA = this.streaks.geometry.attributes.color;
    const len = 0.5 + P.v * 0.085 + this.boostAmt * 1.6; const reach = 10 + P.v * 0.9;
    const hw = T.wAt(P.s) / 2 + 2.4;
    for (let i = 0; i < this.N; i++) {
      const q = this.sp[i]; let ds = q.s - P.s; if (ds < -T.L / 2) ds += T.L; if (ds > T.L / 2) ds -= T.L;
      if (!q.alive || ds < -4 || ds > reach + 12) {
        q.s = P.s + (q.alive ? reach * (0.75 + Math.random() * 0.35) : 3 + Math.random() * reach); q.d = clamp(P.d + (Math.random() * 2 - 1) * hw, -hw, hw);
        q.h = Math.random() < 0.65 ? 0.15 + Math.random() * 1.2 : 1.6 + Math.random() * 2.4; q.b = 0.35 + Math.random() * 0.65; q.alive = true;
        if (Math.abs(q.d - P.d) < 0.9 && q.h < 2) q.d += q.d > P.d ? 1.2 : -1.2;
      }
      T.pos(q.s, q.d, this._p, q.h); const yaw = T.yawAt(q.s); const fx = Math.sin(yaw), fz = Math.cos(yaw);
      pos.setXYZ(i * 2, this._p.x, this._p.y, this._p.z); pos.setXYZ(i * 2 + 1, this._p.x + fx * len, this._p.y, this._p.z + fz * len);
      const c = q.b; colA.setXYZ(i * 2, c, c, c); colA.setXYZ(i * 2 + 1, 0, 0, 0);
    }
    pos.needsUpdate = true; colA.needsUpdate = true;
  }
  whooshes(P, T, R) {
    const now = R.raceT; let ds = P.s - this.prevS; if (ds < -T.L / 2) ds += T.L;
    if (P.v > 11 && !P.crashed && ds > 0 && ds < 40) {
      const ws = R.world.whoosh; const s0 = this.prevS;
      for (const w of ws) {
        let rel = w.s - s0; if (rel < 0) rel += T.L; if (rel <= 0 || rel > ds) continue;
        const lat = w.d - P.d; const near = w.k === 'banner' ? 1 : clamp(1 - (Math.abs(lat) - 1) / 5, 0, 1); if (near <= 0 || now - this.lastWhoosh < 0.06) continue;
        this.lastWhoosh = now; AUDIO.whooshBy(near * clamp(P.v / 28, 0, 1.3) * (w.k === 'banner' ? 0.6 : w.k === 'post' ? 0.55 : 0.9), w.k === 'banner' ? 0 : clamp(-lat / 4, -1, 1), P.v);
      }
    }
    this.prevS = P.s;
    for (const r of R.riders) {
      if (r === P || r.eliminated) continue; const rel = r.dist - P.dist; const prev = this.prevRel.get(r);
      if (prev !== undefined && Math.sign(prev) !== Math.sign(rel) && Math.abs(r.d - P.d) < 3.2 && Math.abs(P.v - r.v) > 1.5 && !r.crashed) AUDIO.whooshBy(clamp(Math.abs(P.v - r.v) / 10, 0.4, 1.1), clamp(-(r.d - P.d) / 3, -1, 1), Math.max(P.v, r.v), true);
      this.prevRel.set(r, rel);
    }
  }
}
