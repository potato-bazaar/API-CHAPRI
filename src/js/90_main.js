// ───────────────────────── GAME: renderer, state machine, camera, loop ─────────────────────────
let GAME = null;
const QUALITY = { low: { pr: 1, shadows: false }, medium: { pr: 1.35, shadows: true }, high: { pr: 2, shadows: true } };
function resolveQuality() { if (URLP.get('q')) return URLP.get('q'); const q = SAVE.settings.quality; if (q !== 'auto') return q; return SAVE.settings.detected || (IS_TOUCH ? 'medium' : 'high'); }
function lookFromSave(buildId) {
  const b = BUILDS.find(x => x.id === (buildId || SAVE.build)) || BUILDS[0];
  const shirt = COSMETICS.shirt.find(s => s.id === SAVE.cos.shirt) || COSMETICS.shirt[0]; const helm = COSMETICS.helmet.find(h => h.id === SAVE.cos.helmet); const shades = COSMETICS.shades.find(s => s.id === SAVE.cos.shades);
  const hair = COSMETICS.hair.find(h => h.id === SAVE.cos.hair) || COSMETICS.hair[0];
  return { tank: SAVE.paint[b.id] || b.tank, accent: b.accent, chrome: b.chrome, neon: b.neon, stickers: b.stickers, shirt: shirt.base, flowers: shirt.flowers, check: shirt.check, helmet: helm && helm.color, shades: shades && shades.color, shadesStyle: shades && shades.style, hair: hair.style, hairColor: hair.color, goldChain: true, watch: true, stubble: true, jeans: '#1f2a4a', mods: modsFor(b.id) };
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
// resolves after the browser has really painted the current DOM (rAF runs before paint; the timeout runs after it)
const painted = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const LOAD_TIPS = [
  'Ride through the glowing NITRO gates for a free boost.',
  'The ring around your bike is your boost. Full ring? Hit BOOST.',
  'Sting cans on the road fill your boost ring.',
  'Hold DRIFT into a hairpin, let go to shoot out of it.',
  'Wheelie on the straights: it adds top speed.',
  'Spit gutka behind you and the rider chasing you slips.',
  'A katta shot bursts a rival\'s tyre. Then watch the takedown.',
  'Follow the green arrows on the road. Red means brake.',
  'Tap the wheelie button for a quick hop over breakers.',
  'Turn off traffic or make it a full jam in Settings.',
];

class Game {
  constructor() { this.state = 'loading'; this.t = 0; this.shakeAmt = 0; this.camMode = 0; this.vw = innerWidth; this.vh = innerHeight; this.firstInteract = false; this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); }
  setLoad(f, msg) {
    const bar = $('#loadBar'), pct = Math.round(clamp(f, 0, 1) * 100); bar.classList.add('live'); bar.style.width = Math.max(4, pct) + '%';
    $('#loadPct').textContent = pct + '%'; bar.parentElement.setAttribute('aria-valuenow', pct); if (msg) $('#loadMsg').textContent = msg;
  }
  // the loading screen: the boot loader, and again between the menu and a race. Tips rotate while it's up.
  showLoader(raceDef, sub, overlay) {
    const L = $('#loading'); L.classList.toggle('race', !!raceDef); $('#loadTrack').hidden = !raceDef;
    if (raceDef) { $('#loadName').textContent = raceDef.name; $('#loadSub').textContent = sub || ''; }
    if (!overlay) $$('.screen').forEach(s => s.classList.remove('show')); L.classList.add('show'); this.setLoad(0, 'Warming up the engine…');
    const tip = $('#loadTip'), sp = tip.querySelector('span'); let i = Math.floor(Math.random() * LOAD_TIPS.length);
    const next = () => { i = (i + 1) % LOAD_TIPS.length; sp.textContent = LOAD_TIPS[i]; tip.classList.remove('swap'); void tip.offsetWidth; tip.classList.add('swap'); };
    next(); clearInterval(this._tipT); this._tipT = setInterval(next, 3200);
  }
  hideLoader() { clearInterval(this._tipT); $('#loading').classList.remove('show', 'race'); }
  async init() {
    loadSave();
    this.quality = resolveQuality();
    const canvas = $('#gl');
    try { this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality !== 'low', powerPreference: 'high-performance' }); }
    catch (e) { $('#loadMsg').textContent = 'This browser could not start WebGL. Turn on hardware acceleration in your browser settings and reload.'; return; }
    const R = this.renderer; R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 2400);
    this.applyQuality(false); this.resize();
    this.showLoader(null); this.setLoad(0.08, 'Warming up the engine…');
    try { await Promise.race([Promise.all([document.fonts.load('800 40px "Baloo 2"', 'कटिंग चाय'), document.fonts.load('700 40px "Baloo 2"', 'A'), document.fonts.load('600 40px "Teko"', '0')]), new Promise(r => setTimeout(r, 2500))]); } catch (_) {}
    this.setLoad(0.3, 'Painting signboards…'); await nextFrame();
    buildTextures();
    this.hud = new HUD(this); this.ui = new UI(this); INPUT.init();
    this.fx = new SpeedFX(this); this.fx.attach(this.scene);
    try { this.comic = new ComicFX(this.renderer); } catch (e) { this.comic = null; }
    this.setLoad(0.42, 'Rolling out the CR100 and its rider…'); await nextFrame();
    const models = await Promise.race([loadModels(this.renderer), new Promise(r => setTimeout(() => r({ bike: false, rider: false }), 15000))]);
    this.bikeModel = models.bike; this.riderModel = models.rider;
    { const d0 = TRACKS.find(t => t.id === SAVE.setup.track) || TRACKS[0]; this.setLoad(0.55, `Building ${d0.short || d0.name}…`); } await painted();
    this.loadTrack(SAVE.setup.track);
    this.menuSmoke = new Particles(160, TEX.soft, false); this.scene.add(this.menuSmoke.points);
    this.refreshMenuRig();
    this.setLoad(0.8, 'Tuning the two-stroke…'); await painted();
    await this.compileScene(false);
    this.setLoad(1, 'Chalo!'); await painted();
    addEventListener('resize', () => this.resize()); addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'race') this.pause(); });
    window.__chapri = this; window.__audio = { AUDIO, MUSIC, OST };
    if (DEBUG.test) window.__DEBUG = DEBUG;
    if (DEBUG.test) window.__setMods = (md, paint) => { SAVE.mods[SAVE.build] = md; if (paint) SAVE.paint[SAVE.build] = paint; this.refreshMenuRig(); };
    this.hideLoader(); this.showScreen('menu');
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
  setupRefl() { const want = this.quality !== 'low' && URLP.get('refl') !== '0'; if (want && !this.refl) { try { this.refl = new WetReflect(this.renderer, this.quality === 'high' ? 0.5 : 0.32); } catch (e) { this.refl = null; } } else if (!want && this.refl) { this.refl.dispose(); this.refl = null; } if (this.refl) { this.refl.scale = this.quality === 'high' ? 0.5 : 0.32; this.refl.resize(); } }
  renderRefl(dt) {
    if (!this.refl || !this.refl.ok || !this.world) { REFL.U.uReflOn.value = 0; return; }
    let h = 0; if (this.race && this.state !== 'menu' && this.state !== 'garage') { const P = this.race.player; h = P.air ? this.race.track.gy(P.s, P.d) : P.y; } else if (this.menuRig) h = this.menuRig.root.position.y;
    this.reflH = this.reflH === undefined || Math.abs(h - this.reflH) > 3 ? h : this.reflH + (h - this.reflH) * Math.min(1, dt * 8);
    REFL.U.uRTime.value = this.t;
    this.refl.render(this.scene, this.camera, this.reflH, this.world.reflHide().concat([this.rain, this.splash && this.splash.pts]).filter(Boolean));
  }
  resize() { this.vw = innerWidth; this.vh = innerHeight; if (this.fx) this.fx.resize(); this.renderer.setSize(this.vw, this.vh, false); if (this.comic) this.comic.resize(); if (this.refl) this.refl.resize(); this.camera.aspect = this.vw / this.vh; this.camera.updateProjectionMatrix(); if (this.race) this.race.combat && [this.race.combat.smoke, this.race.combat.stars, this.race.combat.sparks, this.race.combat.mud, this.race.combat.spray].forEach(p => (p.mat.uniforms.scale.value = this.vh * 0.6)); }
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
    this.scene.fog = mood.fog; this.renderer.toneMappingExposure = mood.exposure * (this.postOn() ? 1 : 1.12); this.wet = (weather || s.weather) === 'monsoon';
    setBikeEnv(this.world.mood, this.wet);
    this.buildRain(this.wet);
  }
  // the setup screen previews the chosen track behind it; a new map takes a moment to build, so say so
  async previewTrack(id) {
    if (this.state !== 'menu' && this.state !== 'garage') return; const def = TRACKS.find(t => t.id === id) || TRACKS[0];
    if (this.worldKey !== def.id + '|' + this.quality && !this.loadingRace) { const st = this.state; this.state = 'loading'; this.showLoader(def, 'Loading the preview', true); this.setLoad(0.3, `Building ${def.short || def.name}…`); await painted();
      try { this.loadTrack(id); this.refreshMenuRig(); this.setLoad(0.8, 'Warming up the engine…'); await painted(); await this.compileScene(false); } finally { this.hideLoader(); this.state = st; this.last = performance.now(); } return; }
    this.loadTrack(id); this.refreshMenuRig();
  }
  // rain: GPU streaks. Each drop is a camera-facing quad stretched along its motion relative to the rider; the CPU only
  // advances two scroll offsets. No depth write, so the comic ink pass never outlines it. Plus splash crowns on the road
  // round the rider (the Auto Rush rain lesson: the rain has to land somewhere, or it reads as a filter on the lens).
  buildRain(on) {
    if (this.rain) { this.scene.remove(this.rain); this.rain.geometry.dispose(); this.rain.material.dispose(); this.rain = null; }
    if (this.splash) { this.scene.remove(this.splash.pts); this.splash.pts.geometry.dispose(); this.splash.pts.material.dispose(); this.splash = null; }
    if (!on) return; const low = this.quality === 'low', n = low ? 1200 : 3600;
    const seed = new Float32Array(n * 16), corner = new Float32Array(n * 8), idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) { const sd = [(Math.random() - 0.5) * 36, Math.random() * 18, Math.random() * 50, Math.random()];
      for (let k = 0; k < 4; k++) { seed.set(sd, (i * 4 + k) * 4); corner.set([k >> 1, k & 1 ? 1 : -1], (i * 4 + k) * 2); }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4)); g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const night = this.world && this.world.mood ? this.world.mood.night : 0;
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
      uniforms: { uYOff: { value: 0 }, uZOff: { value: 0 }, uV: { value: 0 }, uW: { value: 1 }, uRes: { value: new THREE.Vector2(960, 540) }, uCol: { value: new THREE.Color(night > 0.5 ? '#b2b0d4' : '#e4e4f4') }, uOp: { value: night > 0.5 ? 0.5 : 0.56 } },
      vertexShader: `attribute vec4 aSeed; attribute vec2 aCorner; uniform float uYOff, uZOff, uV, uW; uniform vec2 uRes; varying float vA; varying float vT;
        void main(){ float sp = 0.85 + aSeed.w * 0.3; float y = mod(aSeed.y - uYOff * sp, 18.0), z = mod(aSeed.z - uZOff, 50.0) - 10.0;
          vec3 head = vec3(aSeed.x, y, z); vec3 dir = normalize(vec3(0.0, -26.0 * sp, -uV)); vec3 tail = head - dir * (1.15 + uV * 0.035 + aSeed.w * 0.9);
          vec4 ch = projectionMatrix * modelViewMatrix * vec4(head, 1.0), ct = projectionMatrix * modelViewMatrix * vec4(tail, 1.0);
          if (ch.w < 0.4 || ct.w < 0.4) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; vT = 0.0; return; }
          vec4 c = mix(ch, ct, aCorner.x); vec2 d = (ch.xy / ch.w - ct.xy / ct.w) * uRes; d = length(d) > 1e-4 ? normalize(d) : vec2(0.0, 1.0);
          float wpx = uW * clamp(6.0 / c.w, 0.5, 2.0); c.xy += vec2(-d.y, d.x) * aCorner.y * wpx / uRes * 2.0 * c.w;
          gl_Position = c; vA = (1.0 - aCorner.x * 0.85) * smoothstep(0.4, 2.2, c.w) * (1.0 - smoothstep(28.0, 44.0, c.w) * 0.6) * (0.45 + aSeed.w * 0.55); vT = aCorner.y; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uOp; varying float vA; varying float vT; void main(){ gl_FragColor = vec4(uCol, vA * (1.0 - vT * vT) * uOp); }` });
    this.rain = new THREE.Mesh(g, m); this.rain.frustumCulled = false; this.rain.renderOrder = 5; this.scene.add(this.rain);
    // splash crowns: short-lived flattened rings on the road, respawned ahead of the rider
    const ns = low ? 90 : 240, sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ns * 3), 3).setUsage(THREE.DynamicDrawUsage)); sg.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(ns), 1).setUsage(THREE.DynamicDrawUsage));
    const sm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uScale: { value: 600 }, uCol: { value: new THREE.Color(night > 0.5 ? '#c9c4ee' : '#f2f2ff') } },
      vertexShader: `attribute float aT; uniform float uScale; varying float vT; void main(){ vT = aT; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(uScale * (0.08 + 0.22 * aT) / max(0.5, -mv.z), 1.0, 64.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol; varying float vT; void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; p.y *= 2.6; float L = length(p);
        float ring = smoothstep(0.16, 0.0, abs(L - (0.25 + vT * 0.7))); float crown = smoothstep(0.5, 0.0, length(vec2(p.x, (p.y + 0.6 + vT) * 0.5))) * (1.0 - vT) * 0.6;
        float a = (ring + crown) * (1.0 - vT) * (1.0 - vT); if (a < 0.01) discard; gl_FragColor = vec4(uCol, a * 0.55); }` });
    const pts = new THREE.Points(sg, sm); pts.frustumCulled = false; pts.renderOrder = 4; this.scene.add(pts);
    this.splash = { pts, n: ns, t: new Float32Array(ns).map(() => Math.random()), rate: new Float32Array(ns).map(() => 2.5 + Math.random() * 2.5) };
  }
  updateRain(dt) {
    if (!this.rain) return;
    let v = 0, yaw = 0, base = this.camera.position;
    if (this.race && (this.state === 'race' || this.state === 'results')) { const P = this.race.player, T = this.race.track; v = P.v; yaw = T.yawAt(P.s) + P.psi; base = T.pos(P.s, P.d, this._w, P.y - T.yAt(P.s)); }
    else if (this.menuRig) yaw = this.menuRig.root.rotation.y;
    this.rain.position.set(base.x, base.y - 3, base.z); this.rain.rotation.y = yaw;
    const covered = !!(this.world && this.world.ugCover); this.rain.visible = !covered;   // no rain inside Andheri Tunnel
    const U = this.rain.material.uniforms; U.uYOff.value = (U.uYOff.value + 26 * dt) % 1800; U.uZOff.value = (U.uZOff.value + v * dt) % 5000; U.uV.value = v;
    this.renderer.getDrawingBufferSize(U.uRes.value); U.uW.value = 0.95 * this.renderer.getPixelRatio();
    const S = this.splash; if (!S) return; S.pts.visible = !covered; if (covered) return;
    S.pts.material.uniforms.uScale.value = this.vh * this.renderer.getPixelRatio() * 0.9;
    const pos = S.pts.geometry.attributes.position.array, at = S.pts.geometry.attributes.aT.array;
    const R = this.race && (this.state === 'race' || this.state === 'results') ? this.race : null, T = R ? R.track : this.track;
    const s0 = R ? R.player.s : this.menuS || 0, d0 = R ? R.player.d : this.menuD || 0;
    for (let i = 0; i < S.n; i++) { S.t[i] += dt * S.rate[i];
      if (S.t[i] >= 1) { S.t[i] -= Math.floor(S.t[i]); const ss = s0 + (R ? 1.5 + Math.pow(Math.random(), 1.4) * 34 : (Math.random() - 0.3) * 14), w = T.wAt(ss) / 2, dd = R ? (Math.random() * 2 - 1) * (w + 1) : d0 + (Math.random() - 0.5) * 9;
        T.pos(ss, dd, this._v, 0.03); pos[i * 3] = this._v.x; pos[i * 3 + 1] = this._v.y; pos[i * 3 + 2] = this._v.z; }
      at[i] = S.t[i]; }
    S.pts.geometry.attributes.position.needsUpdate = true; S.pts.geometry.attributes.aT.needsUpdate = true;
  }
  refreshMenuRig(buildId) {
    if (this.menuRig) { this.scene.remove(this.menuRig.root); this.menuRig.dispose(); }
    this.menuRig = new BikeRig(lookFromSave(buildId)); this.menuRig.showWeapon(null);
    const T = this.track; const s = 24, d = T.wAt(s) * 0.12; T.pos(s, d, this.menuRig.root.position); this.menuRig.root.rotation.y = T.yawAt(s) + 0.25; this.menuS = s; this.menuD = d;
    if (this.state !== 'race' && this.state !== 'results' && this.state !== 'paused') this.scene.add(this.menuRig.root);
    this.avatarDue = 3;   // re-shoot the profile portrait once the new rig has posed
  }
  // profile picture: a small tone-mapped render of your rider's face (same trick as the post pass: an XR-flagged sRGB target)
  shootAvatar() {
    const rig = this.menuRig; if (!rig || !rig.rm || !this.renderer.capabilities.isWebGL2) return;
    const N = 160; if (!this._avRT) { this._avRT = new THREE.WebGLRenderTarget(N, N, { samples: 4 }); this._avRT.texture.colorSpace = THREE.SRGBColorSpace; this._avRT.texture.internalFormat = 'RGBA8'; this._avRT.isXRRenderTarget = true; this._avCam = new THREE.PerspectiveCamera(26, 1, 0.05, 200); }
    const head = rig.rm.b.Head.getWorldPosition(new THREE.Vector3()); head.y += 0.1; const yaw = rig.root.rotation.y, f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), l = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const cam = this._avCam; cam.position.copy(head).addScaledVector(f, 0.62).addScaledVector(l, -0.22); cam.position.y += 0.02; cam.lookAt(head.x, head.y - 0.03, head.z); cam.updateMatrixWorld();
    const r = this.renderer, prev = r.getRenderTarget(); REFL.U.uReflOn.value = 0; r.setRenderTarget(this._avRT); r.clear(); r.render(this.scene, cam); r.setRenderTarget(prev);
    const px = new Uint8Array(N * N * 4); r.readRenderTargetPixels(this._avRT, 0, 0, N, N, px);
    const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), img = x.createImageData(N, N);
    for (let y = 0; y < N; y++) img.data.set(px.subarray((N - 1 - y) * N * 4, (N - y) * N * 4), y * N * 4);
    x.putImageData(img, 0, 0); const url = c.toDataURL('image/png'); $$('.avatar').forEach(a => { a.innerHTML = `<img src="${url}" alt="">`; });
  }
  showScreen(id) {
    $$('.screen').forEach(s => s.classList.remove('show')); $('#' + id).classList.add('show');
    if (id === 'menu' || id === 'garage' || id === 'store') { this.setMusic('menu'); this.state = id; this.ui.renderMenu(); $$('.nav').forEach(n => n.classList.toggle('on', n.dataset.nav === 'home' && id === 'menu')); }
  }
  // ── race lifecycle ──
  startFromSetup() { if (SAVE.setup.mode === 'cup') return this.startCup(); this.cup = null; return this.startRace(Object.assign({}, SAVE.setup)); }
  startCup() { const s = SAVE.setup; this.cup = { idx: 0, points: {}, setup: Object.assign({}, s, { mode: 'quick' }) }; return this.startRace(Object.assign({}, this.cup.setup, { track: CUP_TRACKS[0].id }), this.cup); }
  // async with a loading screen: building a map and compiling its shaders takes seconds on a phone, so the player sees
  // the track name, a moving bar and tips instead of a frozen menu.
  async startRace(setup, cup = this.cup) {
    if (this.loadingRace) return; this.loadingRace = true;
    try {
      $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true;
      const MM = MODES[setup.mode]; if (MM && MM.track) setup = Object.assign({}, setup, { track: MM.track, time: setup.time === 'auto' ? MM.time : setup.time });   // Police Express+ always runs its own stage
      const def = TRACKS.find(t => t.id === setup.track) || TRACKS[0];
      const tk = setup.time === 'auto' ? def.time : setup.time;
      const TL = TIMES;
      const sub = [MODES[setup.mode] ? MODES[setup.mode].label : '', `${setup.laps} lap${setup.laps > 1 ? 's' : ''}`, TL[tk] || tk, setup.weather === 'monsoon' ? 'Monsoon' : ''].filter(Boolean).join(' · ');
      const prevState = this.state; this.state = 'loading'; this.td = null;
      this.showLoader(def, cup ? `Championship round ${cup.idx + 1}/${CUP_TRACKS.length} · ` + sub : sub);
      this.setLoad(0.06, 'Warming up the engine…'); await painted();
      if (this.menuRig) this.scene.remove(this.menuRig.root);
      this.endRace();
      const rebuild = this.worldKey !== def.id + '|' + this.quality;
      this.setLoad(0.14, rebuild ? `Building ${def.short || def.name}…` : 'Setting the scene…'); await painted();
      this.loadTrack(def.id, tk, setup.weather);
      this.setLoad(0.5, 'Lining up the riders…'); await painted();
      this.race = new Race(this, setup, cup); this.scene.add(this.race.group);
      [this.race.combat.smoke, this.race.combat.stars, this.race.combat.sparks, this.race.combat.mud, this.race.combat.spray].forEach(p => (p.mat.uniforms.scale.value = this.vh * 0.6));
      this.hud.setupRace(this.race); this.lastSetup = setup; this.fx.reset(this.race); this.accSm = 0; this._pv = 0;
      this.camPsi = 0; this.camInit = false; this.camMode = SAVE.settings.camera || 0;
      this.setLoad(0.66, 'Warming up the engine…'); await painted();
      await this.compileScene(true, (f) => this.setLoad(0.66 + f * 0.3));
      this.setLoad(1, 'Chalo!'); try { this.chaseCam(1 / 60); if (this.postOn()) this.comic.render(this.scene, this.camera); else this.renderer.render(this.scene, this.camera); } catch (e) { }   // first frame drawn behind the loader
      await painted();
      this.hideLoader(); $('#hud').classList.add('show');
      this.state = 'race'; this.setMusic('race'); MUSIC.setLevel(0); this.last = performance.now();
      if (IS_TOUCH && !matchMedia('(orientation: portrait)').matches) { try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {} }
      void prevState;
    } catch (e) { console.error('startRace', e); this.hideLoader(); if (!this.race) this.toMenu(); else { $('#hud').classList.add('show'); this.state = 'race'; } }
    finally { this.loadingRace = false; }
  }
  // three.js only compiles what's visible, so hidden race effects (boost jets, flames, sparks, police lights, wheel blur)
  // used to compile mid-race — the first boost froze a frame. Compile everything up front, behind the loading screen.
  // compileAsync lets the GPU driver build programs in parallel (KHR_parallel_shader_compile) while the page stays alive.
  async compileScene(all, onProgress) {
    const hidden = []; if (all) this.scene.traverse(o => { if (!o.visible && !o.isLight) { hidden.push(o); o.visible = true; } });   // lights stay as they are: the light count is part of every program
    let p = null, total = 0;
    try {
      if (this.renderer.compileAsync) { p = this.renderer.compileAsync(this.scene, this.camera); }
      else this.renderer.compile(this.scene, this.camera);
    } catch (e) { p = null; }
    for (const o of hidden) o.visible = false;
    if (!p) return;
    let done = false; p.then(() => { done = true; }, () => { done = true; });
    const t0 = performance.now();
    while (!done && performance.now() - t0 < 9000) { await new Promise(r => setTimeout(r, 60)); if (onProgress) onProgress(Math.min(0.95, (performance.now() - t0) / 2500)); }
    void total;
  }
  warmUp() { this.compileScene(true); }
  // slow phones: when frames run long, drop the render resolution a step; give it back when there's headroom again
  govern(raw) {
    if (this.state !== 'race' || raw > 0.25 || URLP.get('q') || !QUALITY[this.quality]) { if (this.gov) this.gov.t = 0; return; }
    const G = this.gov || (this.gov = { sm: 1 / 60, t: 0 }); G.sm += (raw - G.sm) * 0.05; G.t += raw; if (G.t < 2.5) return;
    let k = this.govK || 1; const base = Math.min(devicePixelRatio || 1, QUALITY[this.quality].pr);
    if (G.sm > 1 / 42 && k > 0.7) k = Math.max(0.7, k - 0.15); else if (G.sm < 1 / 56 && k < 1) k = Math.min(1, k + 0.1); else return;
    G.t = 0; this.govK = k; this.renderer.setPixelRatio(base * k); if (this.comic) this.comic.resize(); if (this.refl) this.refl.resize();
  }
  // the winner's hero entry (58_entry); it hands over to the results when it ends or is skipped
  startEntry(R, title) { if (this.entry) return; try { this.entry = new HeroEntry(this, R, title); } catch (e) { console.warn('entry', e); this.entry = null; setTimeout(() => this.showResults(R), 1500); } }
  endRace() { if (this.entry) { this.entry.done = true; this.entry.el.hidden = true; this.entry.dispose(); this.entry = null; } if (this.race) { this.scene.remove(this.race.group); this.race.dispose(); this.race = null; } }
  // post pass (glow + optional comic print look) on medium/high
  postOn() { return !!(this.comic && this.comic.ok && this.quality !== 'low' && URLP.get('post') !== '0'); }
  comicOn() { return this.postOn() && SAVE.settings.comic && URLP.get('comic') !== '0'; }
  comicPop(text, r, scale, color) { const p = r && this.race ? this.race.track.pos(r.s, r.d, new THREE.Vector3(), r.y - this.race.track.yAt(r.s) + 1.7) : null; COMIC.pop(this, text, p, scale, color); }
  setMusic(m) { this.musicMode = m; MUSIC.setMode(m); }
  pause() { if (this.state !== 'race') return; this.state = 'paused'; this.setMusic('pause'); $('#pauseInfo').textContent = `${this.race.def.name} · Lap ${clamp(Math.max(0, this.race.player.lap) + 1, 1, this.race.laps)}/${this.race.laps}. The race waits for you.`; this.ui.open('pause'); }
  resume() { this.ui.returnToPause = false; this.ui.closeModal(); if (this.state === 'paused') { this.state = 'race'; this.setMusic('race'); this.last = performance.now(); } }
  restart() { $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true; const s = this.lastSetup; if (this.cup && this.cup.done) this.cup = null; this.startRace(s, this.cup); }
  quitRace() { this.cup = null; this.toMenu(); }
  async toMenu() {
    $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true;
    this.endRace(); if (this.cup && this.cup.done) this.cup = null;
    const def = TRACKS.find(t => t.id === SAVE.setup.track) || TRACKS[0], rebuild = this.worldKey !== def.id + '|' + this.quality;
    if (rebuild) { this.state = 'loading'; this.showLoader(null); this.setLoad(0.25, `Building ${def.short || def.name}…`); await painted(); }
    this.loadTrack(SAVE.setup.track); this.refreshMenuRig(); this.scene.add(this.menuRig.root);
    if (rebuild) { this.setLoad(0.75, 'Warming up the engine…'); await painted(); await this.compileScene(false); this.setLoad(1, 'Chalo!'); this.hideLoader(); this.last = performance.now(); }
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
  // 0 in landscape, 1 on a 9:16 phone held upright (in between for tall tablets)
  portraitK() { return clamp((1 - this.vw / this.vh) / 0.5, 0, 1); }
  // slide the picture up without turning the camera (projection offset), so the bike sits above the portrait panels
  viewShift(y) { const c = this.camera; if (Math.abs(y) < 1e-3) { if (c.view && c.view.enabled) c.clearViewOffset(); return; } c.setViewOffset(this.vw, this.vh, 0, this.vh * y, this.vw, this.vh); }
  // ── frame loop ──
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    if (this.state === 'loading') { this.last = now; INPUT.endFrame(); return; }   // the loading screen covers it; give the CPU to the build
    const rawDt = (now - this.last) / 1000; let dt = Math.min(0.1, rawDt); this.last = now; this.t += dt; this.govern(rawDt);
    if (this.bench) { this.bench.n++; if (this.bench.n > 30) this.bench.sum += dt; if (this.bench.n > 150) { const avg = this.bench.sum / 120; SAVE.settings.detected = avg > 0.034 ? 'low' : avg > 0.021 ? 'medium' : 'high'; persist(); this.bench = null; if (SAVE.settings.detected !== this.quality && this.state === 'menu') this.applyQuality(true); } }
    dt *= DEBUG.timescale;
    const inp = INPUT.read(dt);
    if (inp.mute) AUDIO.setMuted(!AUDIO.muted);
    if (this.state === 'race' && this.race) this.raceFrame(dt, inp);
    else if (this.state === 'results' && this.race) { this.race.update(dt); this.orbitCam(dt, this.race.player, 6.5, 2.2, 0.25); }
    else if (this.state === 'paused' && this.race) { if (inp.pause) this.resume(); }
    else this.menuFrame(dt, inp);
    if (this.state !== 'race' && this.fx) { if (this.wet && this.state !== 'paused') this.fx.rainOnly(dt); else this.fx.clear(); }
    if (this.wet && this.state !== 'paused' && !REDUCED_MOTION && !(this.world && this.world.ugRT)) { this.boltT = (this.boltT ?? 6) - dt; if (this.boltT < 0) { this.boltT = 10 + Math.random() * 16; const el = $('#lightning'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); if (this.world) this.world.flash = 0.45; AUDIO.thunder && AUDIO.thunder(0.4 + Math.random() * 1.2); } }
    this.updateRain(dt);
    const focus = this.race ? this.race.track.pos(this.race.player.s, this.race.player.d, this._w) : this.menuRig ? this.menuRig.root.position : null;
    if (this.world) this.world.update(dt, this.t, this.camera, focus);
    if (this.world && this.race && !this.entry) { const hl = this.world.headlight; if (hl.intensity > 0) { const P = this.race.player, T = this.race.track; const yaw = T.yawAt(P.s) + P.psi; T.pos(P.s, P.d, hl.position, P.y - T.yAt(P.s) + 1.0); hl.target.position.set(hl.position.x + Math.sin(yaw) * 20, hl.position.y - 1.2, hl.position.z + Math.cos(yaw) * 20); hl.target.updateMatrixWorld(); } }
    AUDIO.update(this.state === 'race' || this.state === 'results' ? this.race : null, dt);
    this.renderRefl(dt);
    if (this.postOn()) { const M = this.world && this.world.mood, nt = (M ? M.night : 0) > 0.5, glow = nt || this.wet; this.comic.setLook(glow ? 0.8 : 0.32, glow ? 0.74 : 0.88, this.comicOn());
      const neon = this.state === 'race' && this.fx ? this.fx.boostAmt : 0, GR = (M && M.grade) || MOODS.night.grade;
      if (this.wet) { this.comic.setGrade(nt ? 0.07 : 0.045, nt ? 0.86 : 0.92, 1.04, neon, [0.96, 0.96, 1.04], [0.72, 0.7, 0.95]); this.comic.setFinish(-0.01, 1.04, 0.22, 0.7); }
      else { this.comic.setGrade(GR.lift, GR.gamma, GR.sat, neon, GR.tint, GR.liftC); this.comic.setFinish(GR.warm || 0, GR.contrast || 1, GR.vig ?? 0.18, this.state === 'race' ? GR.dof ?? 0.6 : 0.25); }
      const P = this.race && this.race.player; this.comic.speed = P && this.state === 'race' ? clamp((P.v - 12) / 22, 0, 1) : 0; this.comic.boost = P && P.boosting ? 1 : 0; this.comic.render(this.scene, this.camera); }
    else this.renderer.render(this.scene, this.camera);
    INPUT.endFrame();
  }
  raceFrame(dt, inp) {
    this.bikeLights(dt);
    const R = this.race, P = R.player;
    if (inp.pause) { this.pause(); return; }
    { const finalLap = R.laps > 1 && P.lap >= R.laps - 1; const lvl = R.state === 'countdown' ? 0 : (P.boosting || finalLap) ? 2 : 1;
      if (lvl === 2 && MUSIC.level < 2 && finalLap && !this._riserDone) { MUSIC.riser(1.4); this._riserDone = true; } if (R.state === 'countdown') this._riserDone = false; MUSIC.setLevel(lvl); }
    if (!DEBUG.autopilot) { P.input.throttle = inp.throttle; P.input.brake = inp.brake; P.input.rear = inp.rear; P.input.steer = inp.steer; P.input.back = inp.back; P.input.boost = inp.boost; if (inp.hop) P.input.hop = true; }
    if (R.state === 'racing') {
      if (inp.hitL) R.combat.melee(P, 1); if (inp.hitR) R.combat.melee(P, -1); if (inp.hitAuto) R.combat.melee(P, inp.gpSide || R.combat.autoSide(P));
      if ((inp.hitL || inp.hitR || inp.hitAuto) && !R.combatOn) this.hud.callout('COMBAT OFF', null, 'info');
      else if ((inp.hitL || inp.hitR || inp.hitAuto) && R.raceT < 10) this.hud.callout(`FIGHT IN ${Math.ceil(10 - R.raceT)}s`, null, 'info');
      if (inp.throw) { if (!R.combat.throwItem(P) && R.combatOn && !P.weapons.throw) this.hud.callout('NOTHING TO THROW', null, 'info'); }
      if (inp.respawn && !P.crashed && !P.finished) P.respawn();
      if (SAVE.settings.manualGears) { if (inp.gearUp) P.gear = Math.min(4, P.gear + 1); if (inp.gearDown) P.gear = Math.max(1, P.gear - 1); }
      if (DEBUG.autopilot && R.raceT > 12 && Math.random() < 0.01) R.combat.melee(P, R.combat.autoSide(P));
      if (DEBUG.autopilot && R.raceT > 12 && P.weapons.throw && Math.random() < 0.006) R.combat.throwItem(P);
    }
    if (inp.horn) AUDIO.horn();
    if (inp.camera) { this.camMode = (this.camMode + 1) % 3; SAVE.settings.camera = this.camMode; persist(); }
    R.update(dt * (this.entry ? this.entry.ts : 1));
    this.hud.update(dt, this.camera);
    if (R.state === 'finished') { this.td = null; this.fx.clear(); if (this.entry) this.entry.update(dt); else this.orbitCam(dt, P, 5.5, 2.0, 0.35); } else if (this.td) { this.tdCam(dt); this.fx.update(dt, this.camera); } else { this.chaseCam(dt); this.fx.update(dt, this.camera); }
    this.hud.updateTag(dt, this.camera);
    // a rival tucked right behind the player would put the chase camera inside his head: hide anyone that close to the lens
    const cp = this.camera.position, hideR = 1.6 + this.portraitK() * 1.9; for (const r of R.riders) { if (r.isPlayer || r.eliminated || !r.rig.root.visible) continue; const q = r.rig.root.position; if (Math.hypot(q.x - cp.x, q.y + 1.0 - cp.y, q.z - cp.z) < hideR) r.rig.root.visible = false; }
  }
  // takedown cam (Burnout style): cut to a low angle ahead of the wreck, slow motion while the bike rolls and the rider
  // tumbles down the road, then cut straight back to the chase cam. Also used when you go down yourself.
  takedownCam(r) {
    const R = this.race; if (!R || !r.wreck || REDUCED_MOTION || this.camMode === 2) return; if (this.td || (this.tdLast && this.t - this.tdLast < 5 && !r.isPlayer)) return;
    const T = R.track, W = r.wreck, side = -Math.sign(r.d || 1) || 1, s0 = W.bike.s + Math.max(5, W.bike.vs * 0.45);
    const pos = T.pos(s0, clamp(W.bike.d + side * 4.2, -T.wAt(s0) / 2 - 1.5, T.wAt(s0) / 2 + 1.5), new THREE.Vector3(), 1.25);
    this.td = { r, t: 0, dur: r.isPlayer ? 2.1 : 1.7, pos, look: new THREE.Vector3() }; this.tdLast = this.t; R.slowmo = r.isPlayer ? 0.8 : 1.1;
    if (!r.isPlayer) { this.hud.big('TAKEDOWN!', r.short || r.name, 1.4); AUDIO.dhishoom(1); MUSIC.hornStab && MUSIC.hornStab(); }
  }
  tdCam(dt) {
    const D = this.td, R = this.race, T = R.track, W = D.r.wreck, cam = this.camera; D.t += dt;
    if (!W || D.t > D.dur) { this.td = null; this.camInit = false; this.chaseCam(dt); return; }
    const b = W.bike, rd = W.rider, pb = T.pos(b.s, b.d, this._v, b.y - T.yAt(b.s)), pr = T.pos(rd.s, rd.d, this._w, rd.y - T.yAt(rd.s));
    const tgt = pb.clone().lerp(pr, 0.5); D.look.lerp(tgt, D.t < dt * 1.5 ? 1 : 1 - Math.exp(-8 * dt));
    cam.position.lerp(D.pos.clone().lerp(tgt, 0.12).setY(Math.max(D.pos.y, tgt.y + 0.9)), D.t < dt * 1.5 ? 1 : 1 - Math.exp(-3 * dt)); cam.lookAt(D.look);
    this.viewShift(0); cam.fov = smooth(cam.fov, 52 + this.portraitK() * 20, 6, dt); cam.updateProjectionMatrix(); this.camLook.copy(D.look); this.applyShake(dt);
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
    const onKerb = Math.abs(P.d) > P.halfW - 0.45 ? 1 : 0; const vib = REDUCED_MOTION || P.air ? 0 : (0.003 + 0.008 * vN * vN + onKerb * 0.014 + (P.surf === 2 || P.surf === 3 ? 0.012 : P.surf === 5 ? 0.008 : 0) + fx.boostAmt * 0.007) * (P.crashed ? 0 : 1);
    const vy = (Math.sin(this.t * 61) + Math.sin(this.t * 37.3) * 0.6) * vib, vr = Math.sin(this.t * 47.1) * vib * 0.5;
    if (this.camMode === 2) { // helmet cam
      cam.position.set(rp.x + fx2 * 0.05, rp.y + 1.6 - P.tuck * 0.15 + vy - fx.dip * 0.3, rp.z + fz * 0.05);
      cam.lookAt(rp.x + fx2 * 12, rp.y + 1.2, rp.z + fz * 12); cam.rotateZ(-P.lean * 0.7 + vr); this.camInit = false; this.camLook.set(rp.x + fx2 * 12, rp.y + 1.2, rp.z + fz * 12);
    } else {
      // chase cam: a rig of smoothed offsets around the bike rather than a world-space lerp. Lateral, height, heading and
      // roll each have their own spring, so lane changes slide the bike across the frame, turns swing the camera round late,
      // landings and gear shifts nod it, and hard snaps (walls, contacts) are filtered before they reach the screen.
      const far = this.camMode === 1, C = this.cr || (this.cr = {});
      if (!this.camInit) Object.assign(C, { psi: P.psi * 0.5, psiV: 0, su: 0, d: P.d, dv: 0, y: P.y, yv: 0, lean: P.lean, nod: 0, nodV: 0, gear: P.gear, air: P.air, side: 0, dist: P.dist, v: P.v });
      if (Math.abs(P.dist - C.dist) > 30) { C.dist = P.dist; C.v = P.v; }
      if (Math.abs(P.d - C.d) > 3) { C.d = P.d; C.dv = 0; }
      if (Math.abs(P.y - C.y) > 9) { C.y = P.y; C.yv = 0; }
      // springs, substepped so they stay stable on slow frames. Heading: a soft late swing. Distance and lateral are
      // critically damped and track velocity too (no lag at steady speed): a sudden speed loss lets the bike come back
      // toward the lens over a few frames instead of the whole view stopping dead with it. Height rides a soft spring.
      for (let i = 0, n = Math.max(1, Math.ceil(dt * 120)), h = dt / n; i < n; i++) {
        C.psiV += ((P.psi * 0.55 - C.psi) * 22 - C.psiV * 9.4) * h; C.psi += C.psiV * h;
        C.v += ((P.dist - C.dist) * 64 + (P.v - C.v) * 16) * h; C.dist += C.v * h;
        C.dv += ((P.d - C.d) * 100 - C.dv * 20) * h; C.d += C.dv * h;
        C.yv += ((P.y - C.y) * 95 - C.yv * 17.5) * h; C.y += C.yv * h;
        C.nodV += (-C.nod * 130 - C.nodV * 13) * h; C.nod += C.nodV * h;
      }
      C.lean = smooth(C.lean, P.lean, 5, dt);
      if (C.air && !P.air) { const imp = clamp((P.landImpact || 0) / 8, 0, 1); C.nodV -= 0.25 + imp * 0.9; fx.dip = Math.max(fx.dip, 0.05 + imp * 0.16); }   // touchdown
      if (P.gear !== C.gear) { if (P.gear > C.gear && P.input.throttle > 0.5) C.nodV += 0.55; C.gear = P.gear; }   // the bike squats and surges on an upshift
      C.air = P.air;
      C.side = smooth(C.side, -C.lean * 0.28, 4, dt);   // drift a little to the outside of a turn, so you see the lean
      const pk = this.portraitK();   // portrait: a higher, longer camera (Auto Rush style) so you see the road ahead past the bike
      const back = (far ? 7.6 + spring : 2.6 + P.v * 0.016 + spring) + pk * 1.6, up = (far ? 3.4 : 1.62) - fx.dip + pk * 1.0;
      const cs = ((C.dist - back * Math.cos(C.psi)) % T.L + T.L) % T.L; let cd = C.d + C.side - back * Math.sin(C.psi);
      const lim = T.wAt(cs) / 2 + Math.min(SIDEWALK[this.world.theme], 1.8) - 0.2, soft = lim - 0.6, ad = Math.abs(cd); if (ad > soft) cd = Math.sign(cd) * (soft + 0.6 * Math.tanh((ad - soft) / 0.6));
      const g0 = T.roof && T.gapAt(cs) ? C.y : T.yAt(cs); C.gy = C.gy === undefined || !this.camInit ? g0 : smooth(C.gy, clamp(g0, C.y - 2, C.y + 2), 6, dt);   // ground under the lens, smoothed (breaker humps, roof gaps)
      const target = T.pos(cs, cd, this._w); C.su = smooth(C.su, P.susp || 0, 9, dt); target.y = lerp(C.gy, C.y, 0.75) + up + C.su * 0.25;
      this.camPos.copy(target); this.camInit = true;
      cam.position.copy(this.camPos); cam.position.y += vy;
      // look ahead along the camera's heading, leaning a little into the coming bend
      const la = (far ? 6 : 4.6) + pk * 5, yawC = T.yawAt(P.s) + C.psi, yawL = yawC + wrapAngle(T.yawAt(P.s + 7 + P.v * 0.3) - T.yawAt(P.s)) * 0.35;
      const lp = T.pos(P.s, lerp(C.d, P.d, 0.6), this._v2 || (this._v2 = new THREE.Vector3()), C.y - T.yAt(P.s));
      this.camLook.set(lp.x + Math.sin(yawL) * la, lp.y + (far ? 1.0 : 0.62) - C.nod * 0.35, lp.z + Math.cos(yawL) * la);
      cam.lookAt(this.camLook); cam.rotateZ(-C.lean * 0.2 + vr);
    }
    // field of view opens with speed; boost adds a punch that settles back
    const pkF = this.portraitK(), fov = 62 + pkF * 14 + (22 - pkF * 6) * Math.pow(Math.min(vN, 1.2), 1.15) + fx.boostAmt * 6 + fx.fovPunch;
    this.viewShift(0); cam.fov = smooth(cam.fov, Math.min(fov, 100 + pkF * 4), fov > cam.fov ? 6 : 2.5, dt); cam.updateProjectionMatrix();
    this.applyShake(dt);
  }
  // shake: a fast decaying wobble from layered sines (a punch you feel), not per-frame random jitter
  applyShake(dt) { if (this.shakeAmt > 0.001) { const s = this.shakeAmt * 0.075 * (REDUCED_MOTION ? 0.4 : 1), t = this.t; this.camera.position.x += (Math.sin(t * 43) + Math.sin(t * 71.3) * 0.5) * s; this.camera.position.y += (Math.sin(t * 52.7 + 1.3) + Math.sin(t * 89.1) * 0.4) * s; this.camera.rotateZ(Math.sin(t * 37.9 + 0.7) * s * 0.35); this.shakeAmt *= Math.exp(-7 * dt); } }
  orbitCam(dt, P, radius, h, speed) {
    const T = this.race.track; const rp = T.pos(P.s, P.d, this._v, P.y - T.yAt(P.s)); this.orbitA = (this.orbitA || 0) + dt * speed;
    const yaw = T.yawAt(P.s) + this.orbitA + 2.4; this.camera.position.set(rp.x + Math.sin(yaw) * radius, rp.y + h, rp.z + Math.cos(yaw) * radius); this.camera.lookAt(rp.x, rp.y + 0.9, rp.z);
    const pk = this.portraitK(); this.viewShift(0); this.camera.fov = smooth(this.camera.fov, 55 + pk * 18, 3, dt); this.camera.updateProjectionMatrix();
  }
  // studio lights for the home, garage and store shots: a warm key on the face, pink and cyan rims behind
  heroLights(on) {
    if (!this._hero) { const g = new THREE.Group(); const key = new THREE.PointLight(0xffd7a8, 0, 7, 1.6), pink = new THREE.PointLight(0xff3d9a, 0, 6, 1.6), cyan = new THREE.PointLight(0x3fd0ff, 0, 6, 1.6); g.add(key, pink, cyan); this._hero = { g, key, pink, cyan }; this.scene.add(g); }
    const H = this._hero; H.g.visible = true; if (!on || !this.menuRig) { H.key.intensity = H.pink.intensity = H.cyan.intensity = 0; return; }   // stay in the scene (no shader recompiles), just dark
    const p = this.menuRig.root.position, yaw = this.menuRig.root.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    const night = this.world && this.world.mood ? this.world.mood.night : 0, k = 1 + night * 0.8 + (this.wet ? 0.4 : 0);
    H.key.position.set(p.x + fx * 1.8 + lx * 1.2, p.y + 1.9, p.z + fz * 1.8 + lz * 1.2); H.key.intensity = 5 * k;
    H.pink.position.set(p.x - fx * 1.1 - lx * 1.0, p.y + 1.7, p.z - fz * 1.1 - lz * 1.0); H.pink.intensity = 7 * k;
    H.cyan.position.set(p.x - fx * 0.9 + lx * 1.3, p.y + 1.5, p.z - fz * 0.9 + lz * 1.3); H.cyan.intensity = 5 * k;
  }
  // in the race the studio lights ride with the player's bike: a warm key from the front, pink and cyan rims behind.
  // They give the bike shape and shine at night; boosting turns the rims up into a neon halo.
  bikeLights(dt) {
    if (!this._hero) this.heroLights(true); const H = this._hero, R = this.race; if (!R) return; H.g.visible = true;
    const P = R.player, T = R.track, rp = P.rig.root.position, yaw = T.yawAt(P.s) + P.psi, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    const night = this.world && this.world.mood ? this.world.mood.night : 0, k = 0.45 + night * 0.85 + (this.wet ? 0.25 : 0), b = this.fx ? this.fx.boostAmt : 0;
    H.key.position.set(rp.x + fx * 1.6 + lx * 0.9, rp.y + 2.3, rp.z + fz * 1.6 + lz * 0.9); H.key.intensity = 4 * k;
    H.pink.position.set(rp.x - fx * 1.2 - lx * 1.0, rp.y + 1.5, rp.z - fz * 1.2 - lz * 1.0); H.pink.intensity = (5 + b * 14) * k;
    H.cyan.position.set(rp.x - fx * 1.0 + lx * 1.1, rp.y + 1.3, rp.z - fz * 1.0 + lz * 1.1); H.cyan.intensity = (4 + b * 14) * k;
  }
  menuFrame(dt, inp) {
    const rig = this.menuRig; if (!rig || !this.track) return; this.heroLights(this.state === 'menu' || this.state === 'garage' || this.state === 'store');
    if (this.avatarDue > 0 && --this.avatarDue === 0) { try { this.shootAvatar(); } catch (e) { /* keep the drawn avatar */ } }
    // home screen: the rider shows off now and then (hair, shades, moustache, a smoke)
    if (this.state === 'menu') { this.menuSwagT = (this.menuSwagT ?? 4) - dt; if (this.menuSwagT < 0) { const pool = SAVE.settings.smoking !== false ? ['smoke', 'hair', 'shades', 'mustache', 'smoke', 'hair'] : ['hair', 'shades', 'mustache', 'scratch']; rig.gesture(pool[Math.floor(Math.random() * pool.length)], 1); this.menuSwagT = 6 + Math.random() * 5; } }
    if (!rig.onPuff && this.menuSmoke) { const pv = new THREE.Vector3(); rig.onPuff = (mark, k) => { mark.getWorldPosition(pv); this.menuSmoke.emit(pv.x, pv.y, pv.z, (Math.random() - 0.5) * 0.25, 0.2 + Math.random() * 0.15, (Math.random() - 0.5) * 0.25, 2.2, 0.04, 0.45, C_SMOKE, 0.4 * k, 0.8, -0.05); }; }
    rig.update(dt, { lean: 0, pitch: 0, speed: 0, idle: this.state === 'menu', tuck: 0 });
    const T = this.track, p = rig.root.position, yaw = rig.root.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    let target, look; const pk = this.portraitK(); let shift = 0, fovAdd = 0;
    if (this.state === 'garage') {
      if (!(this.ui.dragT > 0)) this.ui.garageYaw += dt * 0.25; else this.ui.dragT -= dt;
      const a = yaw + this.ui.garageYaw, rr = 3.6 * (1 + pk * 0.55); target = new THREE.Vector3(p.x + Math.sin(a) * rr, p.y + 1.35 + pk * 0.3, p.z + Math.cos(a) * rr); look = new THREE.Vector3(p.x, p.y + 0.75, p.z);
      shift = pk * 0.27; fovAdd = pk * 14;
    } else if (this.state === 'store') {
      const a = yaw + 0.9 + Math.sin(this.t * 0.3) * 0.15; target = new THREE.Vector3(p.x + Math.sin(a) * 2.1, p.y + 1.55, p.z + Math.cos(a) * 2.1); look = new THREE.Vector3(p.x, p.y + 1.3, p.z);
    } else {
      // hero shot from the front-left, bike framed in the right half of the screen
      // low and close like a poster: the bike big in the middle, the rider's face in the light
      const sway = Math.sin(this.t * 0.25) * 0.2, k = 1 + pk * 0.75, lo = pk * 0.34;   // portrait: step back and centre the bike
      target = new THREE.Vector3(p.x + fx * 2.35 * k + lx * (1.3 + sway) * k * (1 - pk * 0.25), p.y + 0.92 + pk * 0.25, p.z + fz * 2.35 * k + lz * (1.3 + sway) * k * (1 - pk * 0.25));
      look = new THREE.Vector3(p.x - lx * (0.34 - lo) + fx * 0.15, p.y + 1.04 - pk * 0.32, p.z - lz * (0.34 - lo) + fz * 0.15);
      if (this.state === 'menu') { shift = pk * 0.19; fovAdd = pk * 10; }
    }
    if (!this.menuCamInit) { this.camera.position.copy(target); this.menuCamInit = true; } else this.camera.position.lerp(target, 1 - Math.exp(-4 * dt));
    this.camera.lookAt(look); this.viewShift(shift); this.camera.fov = smooth(this.camera.fov, (this.state === 'menu' ? 50 : 46) + fovAdd, 4, dt); this.camera.updateProjectionMatrix();
    // idle exhaust puffs
    this._puff = (this._puff || 0) + dt * 9; while (this._puff > 1) { this._puff--; const ex = p.x - fx * 1.0 - lx * 0.17, ez = p.z - fz * 1.0 - lz * 0.17; this.menuSmoke.emit(ex, p.y + 0.42, ez, -fx * 1.2 + (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.3, -fz * 1.2 + (Math.random() - 0.5) * 0.4, 1.6, 0.3, 1.8, C_SMOKE, 0.35, 0.8, -0.15); }
    this.menuSmoke.mat.uniforms.scale.value = this.vh * 0.6; this.menuSmoke.update(dt);
    if (this.state === 'menu' && (inp.pause || false)) { /* esc in menu does nothing */ }
  }
}

(async () => { GAME = new Game(); try { await GAME.init(); } catch (e) { console.error(e); $('#loadMsg').textContent = 'Something went wrong while loading: ' + e.message; } })();
