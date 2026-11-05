// ───────────────────────── GAME: renderer, state machine, camera, loop ─────────────────────────
let GAME = null;
const QUALITY = { low: { pr: 1, shadows: false }, medium: { pr: 1.35, shadows: true }, high: { pr: 2, shadows: true } };
function resolveQuality() { if (URLP.get('q')) return URLP.get('q'); const q = SAVE.settings.quality; if (q !== 'auto') return q; return SAVE.settings.detected || (IS_TOUCH ? 'medium' : 'high'); }
function lookFromSave(buildId) {
  const b = BUILDS.find(x => x.id === (buildId || SAVE.build)) || BUILDS[0];
  const shirt = COSMETICS.shirt.find(s => s.id === SAVE.cos.shirt) || COSMETICS.shirt[0]; const helm = COSMETICS.helmet.find(h => h.id === SAVE.cos.helmet); const shades = COSMETICS.shades.find(s => s.id === SAVE.cos.shades);
  const hair = COSMETICS.hair.find(h => h.id === SAVE.cos.hair) || COSMETICS.hair[0];
  return { tank: SAVE.paint[b.id] || b.tank, accent: b.accent, chrome: b.chrome, neon: b.neon, stickers: b.stickers, shirt: shirt.base, flowers: shirt.flowers, check: shirt.check, helmet: helm && helm.color, shades: shades && shades.color, hair: hair.style, hairColor: hair.color, goldChain: true, jeans: '#26304f', mods: modsFor(b.id) };
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

class Game {
  constructor() { this.state = 'loading'; this.t = 0; this.shakeAmt = 0; this.camMode = 0; this.vw = innerWidth; this.vh = innerHeight; this.firstInteract = false; this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); }
  setLoad(f, msg) { $('#loadBar').style.width = (f * 100).toFixed(0) + '%'; if (msg) $('#loadMsg').textContent = msg; }
  async init() {
    loadSave();
    this.quality = resolveQuality();
    const canvas = $('#gl');
    try { this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality !== 'low', powerPreference: 'high-performance' }); }
    catch (e) { $('#loadMsg').textContent = 'This browser could not start WebGL. Turn on hardware acceleration in your browser settings and reload.'; return; }
    const R = this.renderer; R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 2400);
    this.applyQuality(false); this.resize();
    this.setLoad(0.1, 'Loading fonts…');
    try { await Promise.race([Promise.all([document.fonts.load('800 40px "Baloo 2"', 'कटिंग चाय'), document.fonts.load('700 40px "Baloo 2"', 'A'), document.fonts.load('600 40px "Teko"', '0')]), new Promise(r => setTimeout(r, 2500))]); } catch (_) {}
    this.setLoad(0.3, 'Painting signboards…'); await nextFrame();
    buildTextures();
    this.hud = new HUD(this); this.ui = new UI(this); INPUT.init();
    this.fx = new SpeedFX(this); this.fx.attach(this.scene);
    try { this.comic = new ComicFX(this.renderer); } catch (e) { this.comic = null; }
    this.setLoad(0.42, 'Rolling out the CR100 and its rider…'); await nextFrame();
    const models = await Promise.race([loadModels(this.renderer), new Promise(r => setTimeout(() => r({ bike: false, rider: false }), 15000))]);
    this.bikeModel = models.bike; this.riderModel = models.rider;
    this.setLoad(0.55, 'Building Mumbai…'); await nextFrame();
    this.loadTrack(SAVE.setup.track);
    this.menuSmoke = new Particles(160, TEX.soft, false); this.scene.add(this.menuSmoke.points);
    this.refreshMenuRig();
    this.setLoad(0.9, 'Warming up the two-stroke…'); await nextFrame();
    this.renderer.compile(this.scene, this.camera);
    this.setLoad(1, 'Chalo!');
    addEventListener('resize', () => this.resize()); addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'race') this.pause(); });
    window.__chapri = this; window.__audio = { AUDIO, MUSIC };
    if (DEBUG.test) window.__setMods = (md, paint) => { SAVE.mods[SAVE.build] = md; if (paint) SAVE.paint[SAVE.build] = paint; this.refreshMenuRig(); };
    this.showScreen('menu');
    this.last = performance.now(); requestAnimationFrame((t) => this.loop(t));
    if (SAVE.settings.quality === 'auto' && !SAVE.settings.detected && !URLP.get('q')) this.bench = { n: 0, sum: 0 };
    if (DEBUG.autopilot || DEBUG.test) { if (URLP.get('track')) SAVE.setup.track = URLP.get('track'); if (URLP.get('mode')) SAVE.setup.mode = URLP.get('mode'); if (URLP.get('laps')) SAVE.setup.laps = +URLP.get('laps'); if (URLP.get('time')) SAVE.setup.time = URLP.get('time'); if (URLP.get('weather')) SAVE.setup.weather = URLP.get('weather'); if (DEBUG.autopilot) setTimeout(() => this.startFromSetup(), 300); }
  }
  applyQuality(rebuild) {
    const q = resolveQuality(); const changed = q !== this.quality; this.quality = q; const Q = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pr)); if (this.comic) this.comic.resize(); this.setupRefl(); this.renderer.shadowMap.enabled = Q.shadows; this.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (rebuild && changed && this.world) { const id = this.track.def.id; this.worldKey = null; this.loadTrack(id); if (this.state === 'menu') this.refreshMenuRig(); }
  }
  // wet-road mirror: medium/high only, and off with ?refl=0
  setupRefl() { const want = this.quality !== 'low' && URLP.get('refl') !== '0'; if (want && !this.refl) { try { this.refl = new WetReflect(this.renderer, this.quality === 'high' ? 0.5 : 0.4); } catch (e) { this.refl = null; } } else if (!want && this.refl) { this.refl.dispose(); this.refl = null; } if (this.refl) { this.refl.scale = this.quality === 'high' ? 0.5 : 0.4; this.refl.resize(); } }
  renderRefl(dt) {
    if (!this.refl || !this.refl.ok || !this.world) { REFL.U.uReflOn.value = 0; return; }
    let h = 0; if (this.race && this.state !== 'menu' && this.state !== 'garage') { const P = this.race.player; h = P.air ? this.race.track.gy(P.s, P.d) : P.y; } else if (this.menuRig) h = this.menuRig.root.position.y;
    this.reflH = this.reflH === undefined || Math.abs(h - this.reflH) > 3 ? h : this.reflH + (h - this.reflH) * Math.min(1, dt * 8);
    REFL.U.uRTime.value = this.t;
    // medium quality refreshes the mirror every other frame; the stale one is still projected through its own camera, so it stays put on the road
    this.reflN = (this.reflN || 0) + 1; if (this.quality === 'medium' && this.reflN % 2 && REFL.U.uReflOn.value > 0.5) return;
    this.refl.render(this.scene, this.camera, this.reflH, this.world.reflHide().concat([this.rain]));
  }
  resize() { this.vw = innerWidth; this.vh = innerHeight; if (this.fx) this.fx.resize(); this.renderer.setSize(this.vw, this.vh, false); if (this.comic) this.comic.resize(); if (this.refl) this.refl.resize(); this.camera.aspect = this.vw / this.vh; this.camera.updateProjectionMatrix(); if (this.race) this.race.combat && [this.race.combat.smoke, this.race.combat.stars, this.race.combat.sparks, this.race.combat.mud].forEach(p => (p.mat.uniforms.scale.value = this.vh * 0.6)); }
  onFirstInteract() { if (this.firstInteract) return; this.firstInteract = true; $('#soundPill').hidden = true; }
  // ── tracks & scenes ──
  loadTrack(id, timeKey, weather) {
    const def = TRACKS.find(t => t.id === id) || TRACKS[0]; const key = def.id + '|' + this.quality;
    if (this.worldKey !== key) {
      if (this.world) { this.scene.remove(this.world.group); this.world.dispose(); }
      this.track = new Track(def); this.world = new World(this.track, { quality: this.quality }); this.scene.add(this.world.group); this.worldKey = key;
      this.renderer.shadowMap.needsUpdate = true;
    }
    const s = SAVE.setup; const tk = timeKey || (s.time === 'auto' ? def.time : s.time);
    const mood = this.world.setMood(tk, weather || s.weather);
    this.scene.fog = mood.fog; this.renderer.toneMappingExposure = mood.exposure; this.wet = (weather || s.weather) === 'monsoon';
    setBikeEnv(this.world.mood, this.wet);
    this.buildRain(this.wet);
  }
  previewTrack(id) { if (this.state === 'menu' || this.state === 'garage') { this.loadTrack(id); this.refreshMenuRig(); } }
  // rain: GPU streaks. Each drop is a camera-facing quad stretched along its motion relative to the rider; the CPU only
  // advances two scroll offsets. No depth write, so the comic ink pass never outlines it.
  buildRain(on) {
    if (this.rain) { this.scene.remove(this.rain); this.rain.geometry.dispose(); this.rain.material.dispose(); this.rain = null; }
    if (!on) return; const n = this.quality === 'low' ? 900 : 2600;
    const seed = new Float32Array(n * 16), corner = new Float32Array(n * 8), idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) { const sd = [(Math.random() - 0.5) * 36, Math.random() * 18, Math.random() * 50, Math.random()];
      for (let k = 0; k < 4; k++) { seed.set(sd, (i * 4 + k) * 4); corner.set([k >> 1, k & 1 ? 1 : -1], (i * 4 + k) * 2); }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const night = this.world && this.world.mood ? this.world.mood.night : 0;
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
      uniforms: { uYOff: { value: 0 }, uZOff: { value: 0 }, uV: { value: 0 }, uW: { value: 1.1 }, uRes: { value: new THREE.Vector2(960, 540) }, uCol: { value: new THREE.Color(night > 0.5 ? '#8f9cb8' : '#d7e1f0') }, uOp: { value: night > 0.5 ? 0.42 : 0.5 } },
      vertexShader: `attribute vec4 aSeed; attribute vec2 aCorner; uniform float uYOff, uZOff, uV, uW; uniform vec2 uRes; varying float vA; varying float vT;
        void main(){ float sp = 0.85 + aSeed.w * 0.3; float y = mod(aSeed.y - uYOff * sp, 18.0), z = mod(aSeed.z - uZOff, 50.0) - 10.0;
          vec3 head = vec3(aSeed.x, y, z); vec3 dir = normalize(vec3(0.0, -24.0 * sp, -uV)); vec3 tail = head - dir * (0.8 + uV * 0.03 + aSeed.w * 0.5);
          vec4 ch = projectionMatrix * modelViewMatrix * vec4(head, 1.0), ct = projectionMatrix * modelViewMatrix * vec4(tail, 1.0);
          if (ch.w < 0.4 || ct.w < 0.4) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vT = 0.0; return; }
          vec4 c = mix(ch, ct, aCorner.x); vec2 d = (ch.xy / ch.w - ct.xy / ct.w) * uRes; d = length(d) > 1e-4 ? normalize(d) : vec2(0.0, 1.0);
          float wpx = uW * clamp(7.0 / c.w, 0.55, 2.4); c.xy += vec2(-d.y, d.x) * aCorner.y * wpx / uRes * 2.0 * c.w;
          gl_Position = c; vA = (1.0 - aCorner.x * 0.8) * smoothstep(0.4, 2.5, c.w) * (0.5 + aSeed.w * 0.5); vT = aCorner.y; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uOp; varying float vA; varying float vT; void main(){ gl_FragColor = vec4(uCol, vA * (1.0 - vT * vT) * uOp); }` });
    this.rain = new THREE.Mesh(g, m); this.rain.frustumCulled = false; this.rain.renderOrder = 5; this.scene.add(this.rain);
  }
  updateRain(dt) {
    if (!this.rain) return;
    let v = 0, yaw = 0, base = this.camera.position;
    if (this.race && (this.state === 'race' || this.state === 'results')) { const P = this.race.player, T = this.race.track; v = P.v; yaw = T.yawAt(P.s) + P.psi; base = T.pos(P.s, P.d, this._w, P.y - T.yAt(P.s)); }
    else if (this.menuRig) yaw = this.menuRig.root.rotation.y;
    this.rain.position.set(base.x, base.y - 3, base.z); this.rain.rotation.y = yaw;
    const U = this.rain.material.uniforms; U.uYOff.value = (U.uYOff.value + 24 * dt) % 1800; U.uZOff.value = (U.uZOff.value + v * dt) % 5000; U.uV.value = v;
    this.renderer.getDrawingBufferSize(U.uRes.value); U.uW.value = 1.1 * this.renderer.getPixelRatio();
  }
  refreshMenuRig(buildId) {
    if (this.menuRig) { this.scene.remove(this.menuRig.root); this.menuRig.dispose(); }
    this.menuRig = new BikeRig(lookFromSave(buildId)); this.menuRig.showWeapon(null);
    const T = this.track; const s = 24, d = T.wAt(s) * 0.12; T.pos(s, d, this.menuRig.root.position); this.menuRig.root.rotation.y = T.yawAt(s) + 0.25; this.menuS = s; this.menuD = d;
    if (this.state !== 'race' && this.state !== 'results' && this.state !== 'paused') this.scene.add(this.menuRig.root);
  }
  showScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('show')); $('#' + id).classList.add('show');
    if (id === 'menu' || id === 'garage' || id === 'store') { this.setMusic('menu'); this.state = id; this.ui.renderMenu(); $$('.nav').forEach(n => n.classList.toggle('on', n.dataset.nav === 'home' && id === 'menu')); }
  }
  // ── race lifecycle ──
  startFromSetup() { if (SAVE.setup.mode === 'cup') return this.startCup(); this.cup = null; this.startRace(Object.assign({}, SAVE.setup)); }
  startCup() { const s = SAVE.setup; this.cup = { idx: 0, points: {}, setup: Object.assign({}, s, { mode: 'quick' }) }; this.startRace(Object.assign({}, this.cup.setup, { track: CUP_TRACKS[0].id }), this.cup); }
  startRace(setup, cup = this.cup) {
    $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true;
    const MM = MODES[setup.mode]; if (MM && MM.track) setup = Object.assign({}, setup, { track: MM.track, time: setup.time === 'auto' ? MM.time : setup.time });   // Police Express+ always runs its own stage
    const def = TRACKS.find(t => t.id === setup.track) || TRACKS[0];
    const tk = setup.time === 'auto' ? def.time : setup.time;
    this.loadTrack(def.id, tk, setup.weather);
    if (this.menuRig) this.scene.remove(this.menuRig.root);
    this.endRace();
    this.race = new Race(this, setup, cup); this.scene.add(this.race.group);
    [this.race.combat.smoke, this.race.combat.stars, this.race.combat.sparks, this.race.combat.mud].forEach(p => (p.mat.uniforms.scale.value = this.vh * 0.6));
    this.hud.setupRace(this.race); this.lastSetup = setup; this.fx.reset(this.race); this.accSm = 0; this._pv = 0;
    $$('.screen').forEach(s => s.classList.remove('show')); $('#hud').classList.add('show');
    this.state = 'race'; this.setMusic('race'); MUSIC.setLevel(0); this.camPsi = 0; this.camInit = false; this.camMode = SAVE.settings.camera || 0;
    if (IS_TOUCH) { try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (_) {} }
  }
  endRace() { if (this.race) { this.scene.remove(this.race.group); this.race.dispose(); this.race = null; } }
  // post pass (glow + optional comic print look) on medium/high
  postOn() { return !!(this.comic && this.comic.ok && this.quality !== 'low' && URLP.get('post') !== '0'); }
  comicOn() { return this.postOn() && SAVE.settings.comic && URLP.get('comic') !== '0'; }
  comicPop(text, r, scale, color) { const p = r && this.race ? this.race.track.pos(r.s, r.d, new THREE.Vector3(), r.y - this.race.track.yAt(r.s) + 1.7) : null; COMIC.pop(this, text, p, scale, color); }
  setMusic(m) { this.musicMode = m; MUSIC.setMode(m); }
  pause() { if (this.state !== 'race') return; this.state = 'paused'; this.setMusic('pause'); $('#pauseInfo').textContent = `${this.race.def.name} · Lap ${clamp(Math.max(0, this.race.player.lap) + 1, 1, this.race.laps)}/${this.race.laps}. The race waits for you.`; this.ui.open('pause'); }
  resume() { this.ui.returnToPause = false; this.ui.closeModal(); if (this.state === 'paused') { this.state = 'race'; this.setMusic('race'); this.last = performance.now(); } }
  restart() { $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true; const s = this.lastSetup; if (this.cup && this.cup.done) this.cup = null; this.startRace(s, this.cup); }
  quitRace() { this.cup = null; this.toMenu(); }
  toMenu() {
    $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true;
    this.endRace(); if (this.cup && this.cup.done) this.cup = null;
    this.loadTrack(SAVE.setup.track); this.refreshMenuRig(); this.scene.add(this.menuRig.root);
    this.showScreen('menu');
  }
  nextTrack() {
    if (this.cup) { if (this.cup.done) { this.cup = null; return this.toMenu(); } this.cup.idx++; if (this.cup.idx >= CUP_TRACKS.length) { this.cup.done = true; return this.toMenu(); } return this.startRace(Object.assign({}, this.cup.setup, { track: CUP_TRACKS[this.cup.idx].id }), this.cup); }
    const pool = this.lastSetup.mode === 'police' ? TRACKS.filter(t => t.police) : CUP_TRACKS; const i = pool.findIndex(t => t.id === this.lastSetup.track); const nx = pool[(i + 1) % pool.length]; SAVE.setup.track = nx.id; persist(); this.startRace(Object.assign({}, this.lastSetup, { track: nx.id }));
  }
  showResults(R) {
    if (this.race !== R || this.state === 'results') return;
    const res = this.computeResults(R); this.state = 'results'; this.setMusic('menu');
    $$('.screen').forEach(s => s.classList.remove('show')); $('#results').classList.add('show');
    this.ui.renderResults(R, res); this.ui.renderMenu();
  }
  computeResults(R) {
    const P = R.player, M = MODES[R.mode], S = R.score, items = [];
    const rank = R.ranking(); const pos = R.playerPos || rank.indexOf(P) + 1; const n = R.riders.length;
    if (M.rivals) items.push(['Position points', PTS.finish[pos - 1] || 0]);
    if (R.mode === 'timetrial') items.push([`Laps completed (${P.laps.length})`, P.laps.length * 50]);
    const PO = R.police; if (PO) { if (!PO.busted) items.push(['Escaped the nakabandi', 800]); else items.push([`Laps before the arrest (${P.laps.length})`, P.laps.length * 120]); }
    const add = (k, label) => { if (S[k]) items.push([label, S[k]]); };
    add('overtakes', `Overtakes (${S.overtakeCount || 0})`); add('squeeze', 'Squeeze passes'); add('knockdowns', `Knockdowns (${S.knockCount || 0})`); add('revenge', 'Revenge knockdown');
    add('hits', `Hits landed (${S.hitCount || 0})`); add('dodges', 'Dodges'); add('weaponSnatch', 'Weapons snatched');
    add('stunts', `Stunts (${[S.wheelies && S.wheelies + ' wheelie', S.slides && S.slides + ' slide', S.airs && S.airs + ' air', S.stoppies && S.stoppies + ' stoppie'].filter(Boolean).join(', ') || 'tricks'})`);
    add('nakas', `Nakas jumped (${S.nakaCount || 0})`); add('barricades', `Barricades smashed (${S.barricadeCount || 0})`); add('shotsDodged', `Shots dodged (${S.shotDodges || 0})`); add('dogs', 'Dogs dodged'); add('escapeGap', 'Lost the police');
    add('nearMiss', 'Near misses'); add('launch', 'Perfect start'); add('leadLap', 'Laps led'); add('lapRecord', 'Lap record');
    if (R.clean && R.mode !== 'stunt' && P.laps.length) items.push(['Clean race (no falls)', PTS.clean]);
    if (M.rivals) { if (pos === 1) { SAVE.streak = (SAVE.streak || 0) + 1; if (SAVE.streak % 3 === 0) items.push(['3 wins in a row', PTS.streak]); } else SAVE.streak = 0; }
    const sub = items.reduce((a, [, v]) => a + v, 0); const mult = M.rivals ? R.diff.mult : 1; const total = Math.round(sub * mult);
    SAVE.coins += total; SAVE.xp += total; SAVE.parts += M.rivals ? (pos === 1 ? 3 : pos <= 3 ? 2 : 1) : 1; SAVE.races++; if (M.rivals && pos === 1) SAVE.wins++;
    dailyProgress('races', 1);
    const rec = SAVE.records[R.def.id] || {}; if (M.rivals && (!rec.bestPos || pos < rec.bestPos)) rec.bestPos = pos; if (R.mode === 'stunt' && (S.stunts || 0) > (rec.bestStunt || 0)) rec.bestStunt = S.stunts; SAVE.records[R.def.id] = rec;
    let cupTable = '';
    if (this.cup && M.rivals) {
      rank.forEach((r, i) => { const k = r.isPlayer ? '__you' : r.name; this.cup.points[k] = (this.cup.points[k] || 0) + (CUP_POINTS[i] || 0); });
      const table = Object.entries(this.cup.points).sort((a, b) => b[1] - a[1]);
      const last = this.cup.idx >= CUP_TRACKS.length - 1;
      if (last) { this.cup.done = true; const cpos = table.findIndex(([k]) => k === '__you') + 1; const bonus = [2000, 1000, 500][cpos - 1] || 0; if (bonus) { SAVE.coins += bonus; items.push([`Cup bonus (${cpos}${ordinal(cpos).toLowerCase()} overall)`, bonus]); } if (!SAVE.records.cupBest || cpos < SAVE.records.cupBest) SAVE.records.cupBest = cpos; }
      cupTable = `<h3 style="margin-top:.8rem">CHAMPIONSHIP · ROUND ${this.cup.idx + 1}/${CUP_TRACKS.length}</h3><table class="cup-table">${table.map(([k, v], i) => `<tr class="${k === '__you' ? 'me' : ''}"><td>${i + 1}</td><td>${k === '__you' ? SAVE.name + ' (You)' : k}</td><td class="n">${v}</td></tr>`).join('')}</table>`;
    }
    persist();
    const title = PO ? (PO.busted ? 'PAKDA GAYA!' : 'BACH GAYA!') : R.mode === 'stunt' ? 'STUNT RUN DONE' : R.mode === 'timetrial' ? 'TIME TRIAL DONE' : R.mode === 'elimination' && P.eliminated ? 'ELIMINATED' : pos === 1 ? 'JEET GAYA!' : 'RACE COMPLETE';
    const sub2 = `${R.def.short} · ${R.laps} lap${R.laps > 1 ? 's' : ''} · ${MODES[R.mode].label}${M.rivals ? ' · ' + R.diff.label : ''} · Best lap ${fmtTime(P.bestLap)}`;
    const totalShown = total + (items.find(i => i[0].startsWith('Cup bonus')) ? items.find(i => i[0].startsWith('Cup bonus'))[1] : 0);
    if (PO) { const rec2 = SAVE.records[R.def.id] || {}; if (!PO.busted && (!rec2.bestEscape || R.raceT < rec2.bestEscape)) { rec2.bestEscape = R.raceT; SAVE.records[R.def.id] = rec2; persist(); } }
    if (PO) return { posText: PO.busted ? '🚨' : fmtTime(P.finishT || R.raceT), posSuf: PO.busted ? 'BUSTED' : 'ESCAPED', title, sub: sub2, items, total, multText: 'Coins and XP added.', order: [P], cupTable };
    return { posText: M.rivals ? String(pos) : R.mode === 'stunt' ? fmtNum(S.stunts || 0) : fmtTime(P.bestLap), posSuf: M.rivals ? ordinal(pos) : R.mode === 'stunt' ? 'PTS' : '', title, sub: sub2, items, total: totalShown, multText: mult !== 1 ? `Includes the ${R.diff.label} rivals multiplier (×${mult}). Coins and XP added.` : 'Coins and XP added.', order: M.rivals ? rank : [P], cupTable };
  }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  // ── frame loop ──
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    if (this.bench) { this.bench.n++; if (this.bench.n > 30) this.bench.sum += dt; if (this.bench.n > 150) { const avg = this.bench.sum / 120; SAVE.settings.detected = avg > 0.034 ? 'low' : avg > 0.021 ? 'medium' : 'high'; persist(); this.bench = null; if (SAVE.settings.detected !== this.quality && this.state === 'menu') this.applyQuality(true); } }
    dt *= DEBUG.timescale;
    const inp = INPUT.read(dt);
    if (inp.mute) AUDIO.setMuted(!AUDIO.muted);
    if (this.state === 'race' && this.race) this.raceFrame(dt, inp);
    else if (this.state === 'results' && this.race) { this.race.update(dt); this.orbitCam(dt, this.race.player, 6.5, 2.2, 0.25); }
    else if (this.state === 'paused' && this.race) { if (inp.pause) this.resume(); }
    else this.menuFrame(dt, inp);
    if (this.state !== 'race' && this.fx) { if (this.wet && this.state !== 'paused') this.fx.rainOnly(dt); else this.fx.clear(); }
    if (this.wet && this.state !== 'paused' && !REDUCED_MOTION) { this.boltT = (this.boltT ?? 6) - dt; if (this.boltT < 0) { this.boltT = 10 + Math.random() * 16; const el = $('#lightning'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); if (this.world) this.world.flash = 0.45; AUDIO.thunder && AUDIO.thunder(0.4 + Math.random() * 1.2); } }
    this.updateRain(dt);
    const focus = this.race ? this.race.track.pos(this.race.player.s, this.race.player.d, this._w) : this.menuRig ? this.menuRig.root.position : null;
    if (this.world) this.world.update(dt, this.t, this.camera, focus);
    if (this.world && this.race) { const hl = this.world.headlight; if (hl.intensity > 0) { const P = this.race.player, T = this.race.track; const yaw = T.yawAt(P.s) + P.psi; T.pos(P.s, P.d, hl.position, P.y - T.yAt(P.s) + 1.0); hl.target.position.set(hl.position.x + Math.sin(yaw) * 20, hl.position.y - 1.2, hl.position.z + Math.cos(yaw) * 20); hl.target.updateMatrixWorld(); } }
    AUDIO.update(this.state === 'race' || this.state === 'results' ? this.race : null, dt);
    this.renderRefl(dt);
    if (this.postOn()) { const M = this.world && this.world.mood, glow = (M ? M.night : 0) > 0.5 || this.wet; this.comic.setLook(glow ? 0.75 : 0.32, glow ? 0.76 : 0.88, this.comicOn());
      const P = this.race && this.race.player; this.comic.speed = P && this.state === 'race' ? clamp((P.v - 12) / 22, 0, 1) : 0; this.comic.boost = P && P.boosting ? 1 : 0; this.comic.render(this.scene, this.camera); }
    else this.renderer.render(this.scene, this.camera);
    INPUT.endFrame();
  }
  raceFrame(dt, inp) {
    const R = this.race, P = R.player;
    if (inp.pause) { this.pause(); return; }
    { const finalLap = R.laps > 1 && P.lap >= R.laps - 1; const lvl = R.state === 'countdown' ? 0 : (P.boosting || finalLap) ? 2 : 1;
      if (lvl === 2 && MUSIC.level < 2 && finalLap && !this._riserDone) { MUSIC.riser(1.4); this._riserDone = true; } if (R.state === 'countdown') this._riserDone = false; MUSIC.setLevel(lvl); }
    if (!DEBUG.autopilot) { P.input.throttle = inp.throttle; P.input.brake = inp.brake; P.input.rear = inp.rear; P.input.steer = inp.steer; P.input.back = inp.back; P.input.boost = inp.boost; }
    if (R.state === 'racing') {
      if (inp.hitL) R.combat.melee(P, 1); if (inp.hitR) R.combat.melee(P, -1); if (inp.hitAuto) R.combat.melee(P, inp.gpSide || R.combat.autoSide(P));
      if ((inp.hitL || inp.hitR || inp.hitAuto) && !R.combatOn) this.hud.callout('COMBAT OFF', null, 'info');
      else if ((inp.hitL || inp.hitR || inp.hitAuto) && R.raceT < 10) this.hud.callout(`FIGHT IN ${Math.ceil(10 - R.raceT)}s`, null, 'info');
      if (inp.throw) { if (!R.combat.throwItem(P) && R.combatOn && !P.weapons.throw) this.hud.callout('NO BOTTLE / GUTKA', null, 'info'); }
      if (inp.respawn && !P.crashed && !P.finished) P.respawn();
      if (SAVE.settings.manualGears) { if (inp.gearUp) P.gear = Math.min(4, P.gear + 1); if (inp.gearDown) P.gear = Math.max(1, P.gear - 1); }
      if (DEBUG.autopilot && R.raceT > 12 && Math.random() < 0.01) R.combat.melee(P, R.combat.autoSide(P));
    }
    if (inp.horn) AUDIO.horn();
    if (inp.camera) { this.camMode = (this.camMode + 1) % 3; SAVE.settings.camera = this.camMode; persist(); }
    R.update(dt);
    this.hud.update(dt, this.camera);
    if (R.state === 'finished') { this.fx.clear(); this.orbitCam(dt, P, 5.5, 2.0, 0.35); } else { this.chaseCam(dt); this.fx.update(dt, this.camera); }
    // a rival tucked right behind the player would put the chase camera inside his head: hide anyone that close to the lens
    const cp = this.camera.position; for (const r of R.riders) { if (r.isPlayer || r.eliminated || !r.rig.root.visible) continue; const q = r.rig.root.position; if (Math.hypot(q.x - cp.x, q.y + 1.0 - cp.y, q.z - cp.z) < 1.6) r.rig.root.visible = false; }
  }
  chaseCam(dt) {
    const R = this.race, P = R.player, T = R.track, cam = this.camera, fx = this.fx;
    const rp = T.pos(P.s, P.d, this._v, P.y - T.yAt(P.s)); const yaw = T.yawAt(P.s) + P.psi;
    const fx2 = Math.sin(yaw), fz = Math.cos(yaw);
    const vN = clamp(P.v / 28, 0, 1.35);
    // longitudinal g-force: accelerating drops the camera back, braking pushes it in
    const acc = dt > 0 ? (P.v - (this._pv ?? P.v)) / dt : 0; this._pv = P.v; this.accSm = smooth(this.accSm || 0, clamp(acc, -14, 9), 5, dt);
    const spring = clamp(this.accSm * 0.07, -0.45, 0.6) + fx.boostAmt * 0.35;
    // engine + road vibration that grows with speed (stronger on kerbs, lighter with reduced motion)
    const onKerb = Math.abs(P.d) > P.halfW - 0.45 ? 1 : 0; const vib = REDUCED_MOTION || P.air ? 0 : (0.006 + 0.016 * vN * vN + onKerb * 0.025 + fx.boostAmt * 0.012) * (P.crashed ? 0 : 1);
    const vy = (Math.sin(this.t * 61) + Math.sin(this.t * 37.3) * 0.6) * vib, vr = Math.sin(this.t * 47.1) * vib * 0.5;
    if (this.camMode === 2) { // helmet cam
      cam.position.set(rp.x + fx2 * 0.05, rp.y + 1.6 - P.tuck * 0.15 + vy - fx.dip * 0.3, rp.z + fz * 0.05);
      cam.lookAt(rp.x + fx2 * 12, rp.y + 1.2, rp.z + fz * 12); cam.rotateZ(-P.lean * 0.7 + vr); this.camInit = false; this.camLook.set(rp.x + fx2 * 12, rp.y + 1.2, rp.z + fz * 12);
    } else {
      const far = this.camMode === 1; const back = far ? 7.6 + spring : 2.6 + P.v * 0.015 + spring, up = (far ? 3.4 : 1.62) - fx.dip;
      this.camPsi = this.camInit ? smooth(this.camPsi, P.psi, 5, dt) : P.psi;
      const cs = P.s - back * Math.cos(this.camPsi); let cd = P.d - back * Math.sin(this.camPsi);
      const lim = T.wAt(cs) / 2 + Math.min(SIDEWALK[this.world.theme], 2.5) - 0.2; cd = clamp(cd, -lim, lim);
      const target = T.pos(cs, cd, this._w); target.y = lerp(T.yAt(cs), P.y, 0.75) + up;
      if (!this.camInit) { this.camPos.copy(target); this.camInit = true; } else this.camPos.lerp(target, 1 - Math.exp(-20 * dt));
      cam.position.copy(this.camPos); cam.position.y += vy;
      const la = far ? 6 : 4.6; this.camLook.set(rp.x + fx2 * la, rp.y + (far ? 1.0 : 0.62), rp.z + fz * la);   // near cam pitches down: bike sits above the dash, more road (and its reflections) in view
      cam.lookAt(this.camLook); cam.rotateZ(-P.lean * 0.28 + vr);
    }
    // field of view opens with speed; boost adds a punch that settles back
    const fov = 62 + 22 * Math.pow(Math.min(vN, 1.2), 1.15) + fx.boostAmt * 6 + fx.fovPunch;
    cam.fov = smooth(cam.fov, Math.min(fov, 100), fov > cam.fov ? 6 : 2.5, dt); cam.updateProjectionMatrix();
    this.applyShake(dt);
  }
  applyShake(dt) { if (this.shakeAmt > 0.001) { const s = this.shakeAmt * 0.12; this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s; this.camera.rotateZ((Math.random() - 0.5) * s * 0.3); this.shakeAmt *= Math.exp(-6 * dt); } }
  orbitCam(dt, P, radius, h, speed) {
    const T = this.race.track; const rp = T.pos(P.s, P.d, this._v, P.y - T.yAt(P.s)); this.orbitA = (this.orbitA || 0) + dt * speed;
    const yaw = T.yawAt(P.s) + this.orbitA + 2.4; this.camera.position.set(rp.x + Math.sin(yaw) * radius, rp.y + h, rp.z + Math.cos(yaw) * radius); this.camera.lookAt(rp.x, rp.y + 0.9, rp.z);
    this.camera.fov = smooth(this.camera.fov, 55, 3, dt); this.camera.updateProjectionMatrix();
  }
  menuFrame(dt, inp) {
    const rig = this.menuRig; if (!rig || !this.track) return;
    rig.update(dt, { lean: 0, pitch: 0, speed: 0, idle: this.state === 'menu', tuck: 0 });
    const T = this.track, p = rig.root.position, yaw = rig.root.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    let target, look;
    if (this.state === 'garage') {
      if (!(this.ui.dragT > 0)) this.ui.garageYaw += dt * 0.25; else this.ui.dragT -= dt;
      const a = yaw + this.ui.garageYaw; target = new THREE.Vector3(p.x + Math.sin(a) * 3.6, p.y + 1.35, p.z + Math.cos(a) * 3.6); look = new THREE.Vector3(p.x, p.y + 0.75, p.z);
    } else if (this.state === 'store') {
      const a = yaw + 0.9 + Math.sin(this.t * 0.3) * 0.15; target = new THREE.Vector3(p.x + Math.sin(a) * 2.1, p.y + 1.55, p.z + Math.cos(a) * 2.1); look = new THREE.Vector3(p.x, p.y + 1.3, p.z);
    } else {
      // hero shot from the front-left, bike framed in the right half of the screen
      const sway = Math.sin(this.t * 0.25) * 0.25;
      target = new THREE.Vector3(p.x + fx * 3.0 + lx * (1.7 + sway), p.y + 0.8, p.z + fz * 3.0 + lz * (1.7 + sway));
      look = new THREE.Vector3(p.x - lx * 0.55 + fx * 0.3, p.y + 1.15, p.z - lz * 0.55 + fz * 0.3);
    }
    if (!this.menuCamInit) { this.camera.position.copy(target); this.menuCamInit = true; } else this.camera.position.lerp(target, 1 - Math.exp(-4 * dt));
    this.camera.lookAt(look); this.camera.fov = smooth(this.camera.fov, this.state === 'menu' ? 50 : 46, 4, dt); this.camera.updateProjectionMatrix();
    // idle exhaust puffs
    this._puff = (this._puff || 0) + dt * 9; while (this._puff > 1) { this._puff--; const ex = p.x - fx * 1.0 - lx * 0.17, ez = p.z - fz * 1.0 - lz * 0.17; this.menuSmoke.emit(ex, p.y + 0.42, ez, -fx * 1.2 + (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.3, -fz * 1.2 + (Math.random() - 0.5) * 0.4, 1.6, 0.3, 1.8, C_SMOKE, 0.35, 0.8, -0.15); }
    this.menuSmoke.mat.uniforms.scale.value = this.vh * 0.6; this.menuSmoke.update(dt);
    if (this.state === 'menu' && (inp.pause || false)) { /* esc in menu does nothing */ }
  }
}

(async () => { GAME = new Game(); try { await GAME.init(); } catch (e) { console.error(e); $('#loadMsg').textContent = 'Something went wrong while loading: ' + e.message; } })();
