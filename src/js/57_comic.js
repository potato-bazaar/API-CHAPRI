// ───────────────────────── POST: GLOW + COMIC LOOK (Spider-Verse style) ─────────────────────────
// The scene renders into an offscreen target. Bright pixels (lamps, neon, tail-lights, their wet reflections) are
// pulled into a quarter-res buffer and blurred twice for glow. One full-screen pass then adds the glow and, when the
// comic style is on, the print look: ink outlines from depth, halftone dots in the shadows, mis-registered colour, posterising.
// Pop-up sound words ("DHISHOOM!") are DOM bursts over the canvas.
class ComicFX {
  constructor(renderer) {
    this.r = renderer; this.ok = false; this.speed = 0; this.boost = 0;
    if (!renderer.capabilities.isWebGL2) return;
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    // display-referred target: flagged like an XR target so three tone-maps + sRGB-encodes into it exactly as it would
    // on screen (custom shaders like the sky look identical); stored as plain RGBA8, read back raw by the pass
    this.rt = new THREE.WebGLRenderTarget(sz.x, sz.y, { samples: 4 }); this.rt.texture.colorSpace = THREE.SRGBColorSpace; this.rt.texture.internalFormat = 'RGBA8'; this.rt.isXRRenderTarget = true;
    this.rt.depthTexture = new THREE.DepthTexture(sz.x, sz.y); this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, tBloom: { value: null }, uBloom: { value: 0.5 }, uComic: { value: 1 }, res: { value: sz.clone() }, cNear: { value: 0.1 }, cFar: { value: 2400 }, uSpeed: { value: 0 }, uBoost: { value: 0 }, uPx: { value: 1 }, uDot: { value: 5 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBloom; uniform vec2 res; uniform float cNear, cFar, uSpeed, uBoost, uPx, uDot, uBloom, uComic; varying vec2 vUv;
        float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * cNear * cFar) / (cFar + cNear - z * (cFar - cNear)); }
        void main(){
          vec2 px = uPx / res; vec2 c = vUv - 0.5; float e2 = dot(c, c);
          vec2 off = c * (0.0025 * uComic + uSpeed * 0.008 + uBoost * 0.012) * (0.35 + e2 * 3.0);
          vec3 col = vec3(texture2D(tColor, vUv + off).r, texture2D(tColor, vUv).g, texture2D(tColor, vUv - off).b);
          if (uBoost > 0.02) { float rb = uBoost * smoothstep(0.015, 0.2, e2) * 0.016; vec3 acc = col; for (int i = 1; i <= 6; i++) acc += texture2D(tColor, vUv - c * rb * float(i)).rgb; col = acc / 7.0; }   // boost: radial blur toward the edges
          vec3 o = col;
          if (uComic > 0.5) {
            float d0 = lin(texture2D(tDepth, vUv).x);
            float dl = lin(texture2D(tDepth, vUv - vec2(px.x, 0.0)).x), dr = lin(texture2D(tDepth, vUv + vec2(px.x, 0.0)).x);
            float dd = lin(texture2D(tDepth, vUv - vec2(0.0, px.y)).x), du = lin(texture2D(tDepth, vUv + vec2(0.0, px.y)).x);
            float lap = abs(dl + dr - 2.0 * d0) + abs(dd + du - 2.0 * d0);
            float ink = smoothstep(0.01, 0.035, lap / max(d0, 0.1)) * (1.0 - smoothstep(70.0, 260.0, d0));
            float lum = dot(o, vec3(0.299, 0.587, 0.114));
            // halftone only in real shadow: a 45° dot screen whose dots grow with darkness
            vec2 q = gl_FragCoord.xy / uDot; q = vec2(q.x + q.y, q.y - q.x) * 0.7071; vec2 cell = fract(q) - 0.5;
            float dark = smoothstep(0.34, 0.04, lum); float rad = 0.55 * sqrt(dark);
            float dotm = 1.0 - smoothstep(rad - 0.07, rad + 0.07, length(cell));
            o *= 1.0 - dotm * 0.24 * dark;
            // Ben-Day sparkle on bright, saturated colour
            float sat = max(o.r, max(o.g, o.b)) - min(o.r, min(o.g, o.b)); vec2 cell2 = fract(gl_FragCoord.xy / (uDot * 1.4)) - 0.5;
            o += (1.0 - smoothstep(0.16, 0.24, length(cell2))) * smoothstep(0.35, 0.7, sat) * smoothstep(0.45, 0.8, lum) * 0.05;
            o = mix(o, floor(o * 7.0 + 0.5) / 7.0, 0.16);
            o = mix(o, vec3(0.07, 0.04, 0.1), ink * 0.85);
          }
          vec3 bl = texture2D(tBloom, vUv).rgb; o += bl * uBloom * (1.0 - 0.5 * o);
          gl_FragColor = vec4(o, 1.0);
        }`,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(g, this.mat); this.quad.frustumCulled = false; this.qScene = new THREE.Scene(); this.qScene.add(this.quad); this.qCam = new THREE.Camera();
    // glow: threshold + 4-tap downsample into a quarter-res buffer, then two separable gaussian rounds (narrow, wide)
    const bo = { type: THREE.HalfFloatType, depthBuffer: false }; this.bA = new THREE.WebGLRenderTarget(8, 8, bo); this.bB = new THREE.WebGLRenderTarget(8, 8, bo);
    this.mat.uniforms.tBloom.value = this.bA.texture; this.thr = 0.8;
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.brightMat = new THREE.ShaderMaterial({ uniforms: { tColor: { value: this.rt.texture }, texel: { value: new THREE.Vector2() }, thr: { value: 0.8 } }, vertexShader: vs, depthTest: false, depthWrite: false, toneMapped: false,
      fragmentShader: `uniform sampler2D tColor; uniform vec2 texel; uniform float thr; varying vec2 vUv;
        vec3 pick(vec2 o){ vec3 c = texture2D(tColor, vUv + o * texel).rgb; float m = max(c.r, max(c.g, c.b)); float s = m - min(c.r, min(c.g, c.b)); float t = thr - s * 0.18; return c * smoothstep(t, t + 0.2, m); }
        void main(){ gl_FragColor = vec4((pick(vec2(-1.0, -1.0)) + pick(vec2(1.0, -1.0)) + pick(vec2(-1.0, 1.0)) + pick(vec2(1.0, 1.0))) * 0.25, 1.0); }` });
    this.blurMat = new THREE.ShaderMaterial({ uniforms: { tIn: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false, toneMapped: false,
      fragmentShader: `uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tIn, vUv).rgb * 0.227; c += (texture2D(tIn, vUv + dir * 1.385).rgb + texture2D(tIn, vUv - dir * 1.385).rgb) * 0.316; c += (texture2D(tIn, vUv + dir * 3.231).rgb + texture2D(tIn, vUv - dir * 3.231).rgb) * 0.07; gl_FragColor = vec4(c, 1.0); }` });
    this.bQuad = new THREE.Mesh(g, this.brightMat); this.bQuad.frustumCulled = false; this.bScene = new THREE.Scene(); this.bScene.add(this.bQuad);
    this.ok = true; this.resize();
  }
  resize() { if (!this.ok) return; const sz = this.r.getDrawingBufferSize(new THREE.Vector2()); this.rt.setSize(sz.x, sz.y); this.mat.uniforms.res.value.copy(sz);
    const bw = Math.max(8, Math.round(sz.x / 4)), bh = Math.max(8, Math.round(sz.y / 4)); this.bA.setSize(bw, bh); this.bB.setSize(bw, bh); this.brightMat.uniforms.texel.value.set(1 / sz.x, 1 / sz.y); this.bTex = new THREE.Vector2(1 / bw, 1 / bh);
    const pr = this.r.getPixelRatio(); this.mat.uniforms.uPx.value = Math.max(1, pr * 0.85); this.mat.uniforms.uDot.value = 4.5 * Math.max(1, pr); }
  render(scene, camera) {
    const U = this.mat.uniforms; U.cNear.value = camera.near; U.cFar.value = camera.far; U.uSpeed.value = this.speed; U.uBoost.value = this.boost;
    this.r.setRenderTarget(this.rt); this.r.render(scene, camera);
    if (U.uBloom.value > 0.01) { const r = this.r, B = this.blurMat.uniforms; this.brightMat.uniforms.thr.value = this.thr;
      this.bQuad.material = this.brightMat; r.setRenderTarget(this.bA); r.render(this.bScene, this.qCam); this.bQuad.material = this.blurMat;
      for (const k of [1, 2.2]) { B.tIn.value = this.bA.texture; B.dir.value.set(this.bTex.x * k, 0); r.setRenderTarget(this.bB); r.render(this.bScene, this.qCam);
        B.tIn.value = this.bB.texture; B.dir.value.set(0, this.bTex.y * k); r.setRenderTarget(this.bA); r.render(this.bScene, this.qCam); } }
    this.r.setRenderTarget(null); this.r.render(this.qScene, this.qCam);
  }
  // glow amount + threshold (display-referred brightness), comic print look on/off
  setLook(bloom, thr, comic) { if (!this.ok) return; this.mat.uniforms.uBloom.value = bloom; this.thr = thr; this.mat.uniforms.uComic.value = comic ? 1 : 0; }
  dispose() { if (!this.ok) return; this.rt.dispose(); this.bA.dispose(); this.bB.dispose(); this.mat.dispose(); this.brightMat.dispose(); this.blurMat.dispose(); this.quad.geometry.dispose(); }
}
// sound-word bursts
const COMIC = {
  live: 0,
  pop(game, text, worldPos, scale = 1, color) {
    if (!SAVE.settings.comic || REDUCED_MOTION || this.live >= 3) return;
    const el = document.createElement('div'); el.className = 'comic-pop'; el.textContent = text;
    let x = 50, y = 38;
    if (worldPos) { const v = worldPos.clone().project(game.camera); if (v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2) { x = (v.x + 1) * 50; y = (1 - v.y) * 50; } }
    x = clamp(x + (Math.random() - 0.5) * 8, 14, 86); y = clamp(y - 10 + (Math.random() - 0.5) * 6, 12, 70);
    el.style.left = x + '%'; el.style.top = y + '%'; el.style.setProperty('--rot', ((Math.random() - 0.5) * 22).toFixed(1) + 'deg'); el.style.setProperty('--s', scale.toFixed(2));
    if (color) el.style.setProperty('--fill', color);
    $('#comicLayer').appendChild(el); this.live++;
    setTimeout(() => { el.remove(); this.live--; }, 900);
  },
};
