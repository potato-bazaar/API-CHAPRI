// ───────────────────────── INPUT: keyboard, touch, tilt, gamepad ─────────────────────────
const INPUT = {
  keys: new Set(), pressed: new Set(), touch: {}, tPressed: new Set(), steerSm: 0, tilt: null, gpPrev: [], listenCb: null,
  init() {
    addEventListener('keydown', (e) => {
      if (this.listenCb) { e.preventDefault(); this.listenCb(e.code); this.listenCb = null; return; }
      if (e.target && e.target.tagName === 'INPUT') return;
      AUDIO.init(); GAME && GAME.onFirstInteract();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (GAME && GAME.state === 'race' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.touch = {}; $$('.tbtn.on').forEach(b => b.classList.remove('on')); });
    addEventListener('pointerdown', () => { AUDIO.init(); GAME && GAME.onFirstInteract(); }, { capture: true });
    for (const btn of $$('.tbtn')) {
      const t = btn.dataset.t;
      const down = (e) => { e.preventDefault(); AUDIO.init(); try { btn.setPointerCapture(e.pointerId); } catch (_) {} this.touch[t] = true; this.tPressed.add(t); btn.classList.add('on'); };
      const up = () => { this.touch[t] = false; btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    // swipe down on the play area = weight back (GDD touch mapping)
    let sy = null; const gl = $('#gl');
    gl.addEventListener('pointerdown', (e) => { sy = e.clientY; }); gl.addEventListener('pointermove', (e) => { if (sy !== null && e.clientY - sy > 40) { this.touch.swipeBack = true; } });
    gl.addEventListener('pointerup', () => { sy = null; this.touch.swipeBack = false; });
    addEventListener('deviceorientation', (e) => { if (e.beta === null) return; const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0; this.tilt = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma; });
  },
  down(action) { const km = keymap(); return (km[action] || []).some(c => this.keys.has(c)); },
  hit(action) { const km = keymap(); return (km[action] || []).some(c => this.pressed.has(c)); },
  read(dt) {
    const T = this.touch;
    const gp = (navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null);
    const gb = (i) => gp && gp.buttons[i] ? gp.buttons[i].value : 0; const gpress = (i) => gp && gp.buttons[i] && gp.buttons[i].pressed && !this.gpPrev[i];
    const ax = gp ? (Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : 0) : 0, ay = gp ? gp.axes[1] || 0 : 0;
    let target = (this.down('right') || T.right ? 1 : 0) - (this.down('left') || T.left ? 1 : 0);
    let analog = false;
    if (ax) { target = ax; analog = true; }
    if (SAVE.settings.tilt && IS_TOUCH && this.tilt !== null && !T.left && !T.right) { const v = this.tilt; target = Math.abs(v) < 3 ? 0 : clamp((v - Math.sign(v) * 3) / 22, -1, 1); analog = true; }
    // eased digital steering = the 0.25 s lean-in the GDD asks for (lean assist)
    if (analog) this.steerSm = target; else this.steerSm = smooth(this.steerSm, target, target === 0 ? 12 : 7, dt);
    const out = {
      throttle: Math.max(this.down('throttle') || T.gas ? 1 : 0, gb(7)),
      brake: Math.max(this.down('brake') || T.brake ? 1 : 0, gb(6)),
      rear: this.down('rear') || T.rear || gb(1) > 0.5 ? 1 : 0,
      steer: clamp(this.steerSm, -1, 1),
      back: this.down('back') || !!T.back || !!T.swipeBack || ay > 0.6,
      boost: this.down('boost') || !!T.boost || gb(5) > 0.5,
      hitL: this.hit('hitL'), hitR: this.hit('hitR'), hitAuto: this.tPressed.has('hit') || gpress(0), gpSide: ax < -0.3 ? 1 : ax > 0.3 ? -1 : 0,
      throw: this.hit('throw') || this.tPressed.has('throw') || gpress(2),
      camera: this.hit('camera') || gpress(3), respawn: this.hit('respawn') || gpress(8), horn: this.hit('horn') || gpress(4),
      pause: this.hit('pause') || gpress(9), gearUp: this.hit('gearUp') || gpress(12), gearDown: this.hit('gearDown') || gpress(13), mute: this.hit('mute'),
    };
    if (gp) this.gpPrev = gp.buttons.map(b => b.pressed);
    return out;
  },
  endFrame() { this.pressed.clear(); this.tPressed.clear(); },
  rumble(strength, dur) {
    try { const gp = [...navigator.getGamepads()].find(g => g && g.connected); if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: dur * 1000, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch (_) {}
    if (IS_TOUCH && navigator.vibrate && strength > 0.3) { try { navigator.vibrate(Math.round(dur * 1000 * strength)); } catch (_) {} }
  },
};
