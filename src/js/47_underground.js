// ───────────────────────── MUMBAI UNDERGROUND: race runtime ─────────────────────────
// The burst water main; UDAAN! slow-mo over the broken bridge; the metro
// rumbling overhead; the tunnel echo and its honking; a location card the first time you enter each section.
// Rival taunts (Hinglish speech bubbles) run on every track.
const UG_CARDS = { tunnel: ['ANDHERI TUNNEL', 'अंधेरी सुरंग'], cut: ['SUBWAY CUT', 'graffiti gali'], chevron: ['LED HAIRPIN', 'brake maar, bhai'], docks: ['DOCK 7', 'mumbai port'], bridge: ['ADHOORA PUL', 'udaan lo'], kachha: ['NAMAK KHET', 'kachha rasta'], market: ['LOKHANDWALA', 'market road · finish'] };
const TRAFFIC_KINDS = {
  auto: { hw: 0.72, hl: 1.4, v: [8.5, 10.5], horn: 640, beeps: 2 },
  taxi: { hw: 0.85, hl: 2.05, v: [10.5, 12.5], horn: 470, beeps: 1 },
  bus: { hw: 1.3, hl: 5.55, v: [9, 10], horn: 230, beeps: 1 },
  tempo: { hw: 1.08, hl: 2.85, v: [9.5, 11.5], horn: 330, beeps: 2 },
};
let TRAFFIC_GEO = null;
function trafficGeo() {
  if (TRAFFIC_GEO) return TRAFFIC_GEO; TRAFFIC_GEO = {};
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const mk = (fn) => { const b = new Batch(), l = new Batch();
    const box = (bt) => (x, y, z, w, h, d, col) => { M.compose(P.set(x, y + h / 2, z), Q.identity(), S.set(w, h, d)); bt.add(UNIT_BOX, M, new THREE.Color(col)); };
    const wheel = (x, z, r) => { M.compose(P.set(x, r, z), Q.identity(), S.set(1, r / 0.22, r / 0.22)); b.add(WHEEL_G, M, new THREE.Color('#141414')); };
    fn(box(b), box(l), wheel); return { body: b.build(), lights: l.build() }; };
  TRAFFIC_GEO.auto = mk((B, L, W) => { B(0, 0.25, -0.2, 1.3, 0.75, 2.1, '#151515'); B(0, 1.0, -0.3, 1.32, 0.12, 2.0, '#f2c21a'); B(0, 1.12, -0.3, 1.38, 0.55, 2.0, '#f2c21a'); B(0, 0.62, 0.95, 1.1, 0.72, 0.1, '#7fa7c0'); B(0, 0.25, 1.0, 0.5, 0.6, 0.5, '#151515');
    W(0, 1.05, 0.22); W(-0.62, -0.85, 0.22); W(0.62, -0.85, 0.22); for (const x of [-0.5, 0.5]) L(x, 0.48, -1.27, 0.2, 0.13, 0.04, '#ff2020'); L(0, 0.95, 1.27, 0.24, 0.18, 0.06, '#fff2c8'); });
  TRAFFIC_GEO.taxi = mk((B, L, W) => { B(0, 0.28, 0, 1.6, 0.62, 4.0, '#141414'); B(0, 0.9, -0.2, 1.5, 0.56, 2.2, '#f2c21a'); B(0, 0.92, -0.2, 1.53, 0.4, 2.0, '#1d2632'); B(0, 1.46, -0.1, 0.5, 0.14, 0.26, '#f2c21a');
    for (const x of [-0.72, 0.72]) for (const z of [-1.3, 1.3]) W(x, z, 0.3); for (const x of [-0.62, 0.62]) { L(x, 0.55, -2.01, 0.28, 0.14, 0.04, '#ff2020'); L(x, 0.6, 2.01, 0.26, 0.18, 0.04, '#fff2c8'); } L(0, 1.6, -0.1, 0.46, 0.12, 0.22, '#ffe066'); });
  TRAFFIC_GEO.bus = mk((B, L, W) => { B(0, 0.35, 0, 2.5, 2.6, 11, '#c8201e'); B(0, 1.15, 0, 2.54, 0.24, 11.04, '#f2e6c8'); B(0, 2.95, 0, 2.4, 0.2, 10.8, '#e8e2d6'); B(0, 1.45, 5.49, 2.2, 1.15, 0.06, '#1d2632');
    for (const x of [-1, 1]) for (const z of [-3.6, 3.6]) W(x * 1.05, z, 0.5); for (const x of [-1.262, 1.262]) L(x, 1.55, -0.2, 0.02, 0.85, 9.6, '#ffe2a8'); L(0, 2.6, 5.52, 1.8, 0.3, 0.04, '#ffb020');
    for (const x of [-1.0, 1.0]) { L(x, 0.6, -5.52, 0.3, 0.2, 0.04, '#ff2020'); L(x * 0.95, 0.65, 5.52, 0.3, 0.22, 0.04, '#fff2c8'); } });
  TRAFFIC_GEO.tempo = mk((B, L, W) => { B(0, 0.45, 2.1, 2.0, 1.65, 1.4, '#2f6fb8'); B(0, 1.3, 2.79, 1.8, 0.62, 0.05, '#1d2632'); B(0, 2.1, 2.1, 2.02, 0.12, 1.42, '#ffd23f'); B(0, 0.8, -0.65, 2.1, 0.25, 4.2, '#6b3e26'); B(0, 1.05, -0.65, 2.12, 1.55, 4.2, '#e8762a');
    for (const x of [-0.9, 0.9]) { W(x, 2.1, 0.42); W(x, -1.8, 0.42); L(x, 0.8, -2.77, 0.26, 0.16, 0.04, '#ff2020'); L(x * 0.88, 0.8, 2.82, 0.26, 0.18, 0.04, '#fff2c8'); } });
  return TRAFFIC_GEO;
}

class UGOps {
  constructor(race) {
    this.race = race; const T = race.track, W = race.world, Z = T.ug;
    W.ugMetroDepart = false; this.lastS = new Map(); this.seen = new Set(); this.zone = null; this.udaan = 0; this.burstT = 0; this.honkT = 3; this.chimeT = 0; this.rumbleT = 0;
    this.cardEl = $('#zoneCard'); this._p = new THREE.Vector3();
  }
  card(z) { const el = this.cardEl, C = UG_CARDS[z]; if (!el || !C) return; el.innerHTML = `<small>${C[1]}</small><b>${C[0]}</b>`; el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); clearTimeout(this._cardT); this._cardT = setTimeout(() => (el.hidden = true), 2700); }
  update(dt) {
    const R = this.race, T = R.track, W = R.world, P = R.player, G = R.game, racing = R.state === 'racing';
    W.ugS = P.s; const z = T.zoneAt(P.s), inT = z === 'tunnel';
    AUDIO.setVerb && AUDIO.setVerb(inT ? 0.32 : 0);
    if (racing && z && z !== this.zone && UG_CARDS[z] && !this.seen.has(z) && P.lap <= 0) { this.seen.add(z); this.card(z); }
    this.zone = z;
    // tunnel ambience: somebody is always honking in Andheri Tunnel
    if (inT) { this.honkT -= dt; if (this.honkT < 0) { this.honkT = 1.6 + Math.random() * 3; const f = pick([300, 380, 460, 560, 700]); AUDIO.tone('square', f, f * 0.98, 0.14 + Math.random() * 0.2, 0.025, 0); if (Math.random() < 0.5) AUDIO.tone('square', f, f * 0.98, 0.14, 0.025, 0.22); } }
    // the burst main: a curtain of water across the tunnel
    for (const r of R.riders) { if (r.eliminated) continue; const last = this.lastS.get(r); this.lastS.set(r, r.s); if (last === undefined || r.crashed || r.air || !T.burst) continue;
      const a = T.wrapD(last - T.burst.s), b = T.wrapD(r.s - T.burst.s); if (a < 0 && b >= 0 && b < 6) { if (r.isPlayer || R.distToPlayer(r) > 0.3) R.combat.splash(r, 1.3, true);
        if (r.isPlayer) { G.comicPop('CHHAPAAK!', P, 1.15, '#9cd8ff'); AUDIO.splash(1.3); G.fx.lensSplash && G.fx.lensSplash(1.3); G.shake(0.18); R.rumble(0.35, 0.12); r.v *= 0.985; } } }
    // ── UDAAN: slow motion over the gap in the broken bridge ──
    const gap = T.roof && T.gapAt(P.s);
    if (gap && P.air && !P.crashed && P.y > T.roof.h - 0.8 && this.udaan === 0 && racing) { this.udaan = 1; R.slowmo = 0.85; G.comicPop('UDAAN!!', P, 1.5, '#ffd23f'); G.fx.fovPunch = Math.max(G.fx.fovPunch, 9); AUDIO.whoosh(1.2); try { MUSIC.whistle(AUDIO.ctx.currentTime + 0.05, 0.16); } catch (e) { } }
    if (this.udaan === 1 && !P.air && !gap) { this.udaan = 2; if (!P.crashed && T.zoneAt(P.s) === 'bridge') { R.hud.callout('ADHOORA PUL JUMP', `+${R.award('stunts', 150)}`, 'gold'); R.score.bridgeJumps = (R.score.bridgeJumps || 0) + 1; try { MUSIC.hornStab(); MUSIC.hey && MUSIC.hey(AUDIO.ctx.currentTime + 0.1, 0.3); } catch (e) { } } }
    if (this.udaan && T.zoneAt(P.s) !== 'bridge') this.udaan = 0;
    // ── the metro: chime when it leaves the station, rumble when it passes overhead ──
    if (W.ugMetroDepart) { W.ugMetroDepart = false; const dm = W.metro ? W.metro.position.distanceTo(G.camera.position) : 999; if (dm < 160) { const v = clamp(1.2 - dm / 160, 0.15, 1); AUDIO.tone('sine', 1047, 1047, 0.45, 0.1 * v); AUDIO.tone('sine', 784, 784, 0.7, 0.1 * v, 0.42); AUDIO.trainHorn(v * 0.7, 0.9); } }
    const mk = W.ugMetroNear || 0; if (mk > 0) { G.shake(0.06 + 0.14 * mk); this.rumbleT -= dt; if (this.rumbleT < 0) { this.rumbleT = 0.25; R.rumble(0.2 * mk, 0.2); AUDIO.noise(0.35, 90, 0.8, 0.35 * mk, 'lowpass'); } }
  }
  dispose() { const W = this.race.world; W.ugS = null; AUDIO.setVerb && AUDIO.setVerb(0); clearTimeout(this._cardT); if (this.cardEl) this.cardEl.hidden = true; }
}

// ── rival taunts: a speech bubble over a rider, now and then, when he passes you, you pass him, or you hit him ──
const TAUNTS = {
  overtook: ['Side de, side!', 'Abey hatt, chhapri!', 'Bhai, ghar ja!', 'Mummy bula rahi hai!', 'Pehle chalana seekh!', 'Kya re, petrol khatam?', 'Tata, bye bye!', 'Dhuaan kha, dhuaan!'],
  passed: ['Arre baap re!', 'Kaun hai yeh?!', 'Ruk ja tu!', 'Abhi dikhata hoon!', 'Yeh kaise?!', 'Bhai, aaram se!', 'Mera silencer!'],
  hit: ['Teri toh...!', 'Dekh ke chala!', 'Scratch aaya toh?!', 'Ab tu gaya!'],
};
class Taunts {
  constructor(race) { this.race = race; this.layer = $('#speech'); this.live = []; this.lastT = -99; this.per = new Map(); this._p = new THREE.Vector3(); this.bag = {}; }
  say(r, kind) {
    const R = this.race; if (!this.layer || !r || r.isPlayer || (r.cfg && r.cfg.rival && r.cfg.rival.style === 'cop') || R.state !== 'racing' || REDUCED_MOTION) return;
    const t = R.raceT; if (t - this.lastT < 5 || t - (this.per.get(r) ?? -99) < 12 || R.distToPlayer(r) < 0.2 || Math.random() > (kind === 'hit' ? 0.8 : 0.55)) return;
    const pool = TAUNTS[kind]; if (!pool) return; let bag = this.bag[kind]; if (!bag || !bag.length) bag = this.bag[kind] = pool.slice().sort(() => Math.random() - 0.5);
    const line = bag.pop(); this.lastT = t; this.per.set(r, t);
    const el = document.createElement('div'); el.className = 'bubble' + (kind === 'hit' ? ' hot' : ''); el.innerHTML = `<small>${r.short || r.name}</small>${line}`; this.layer.appendChild(el);
    this.live.push({ el, r, t: 0 }); if (this.live.length > 2) { this.live.shift().el.remove(); }
  }
  update(dt, camera) {
    if (!this.live.length) return; const T = this.race.track, W = innerWidth, H = innerHeight;
    for (let i = this.live.length - 1; i >= 0; i--) { const b = this.live[i]; b.t += dt; if (b.t > 2.3 || b.r.eliminated) { b.el.remove(); this.live.splice(i, 1); continue; }
      const p = T.pos(b.r.s, b.r.d, this._p, b.r.y - T.yAt(b.r.s) + 2.2).project(camera); const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      b.el.style.visibility = vis ? 'visible' : 'hidden'; if (vis) { b.el.style.left = clamp((p.x + 1) * 50, 8, 92) + '%'; b.el.style.top = clamp((1 - p.y) * 50, 12, 80) + '%'; } }
  }
  dispose() { this.live.forEach(b => b.el.remove()); this.live.length = 0; }
}
