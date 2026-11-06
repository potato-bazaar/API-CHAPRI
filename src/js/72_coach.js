// ───────────────────────── FIRST-RACE COACH ─────────────────────────
// A new player's first race teaches by doing: one short prompt at a time, the matching touch button pulses, and the
// step ticks off when they actually do it (or moves on after a few seconds, so nobody gets stuck). Skippable; runs once
// per save, and the Help screen can switch it back on. Riders who already have races on their save never see it.
const COACH_STEPS = [
  { id: 'gas', text: 'Hold <b>GAS</b> as the lights go green', sub: 'Perfect start fills the kick meter', btn: ['gas'], key: 'W / ↑',
    only: R => R.state === 'countdown', done: (C, R) => R.state === 'racing', max: 12 },
  { id: 'lean', text: 'Lean with <b>◀ ▶</b>', sub: 'Lean into the turn and the bike follows', btn: ['left', 'right'], key: 'A D / ← →',
    done: C => C.acc.steer > 0.9, max: 9 },
  { id: 'brake', text: '<b>BRAKE</b> upright, then lean', sub: 'Slow down before a tight corner, not in it', btn: ['brake'], key: 'S / ↓',
    ready: (C, R, P) => C.cornerAhead(R, P), readyMax: 8, done: C => C.acc.brake > 0.25, max: 9 },
  { id: 'band', text: 'Keep the needle in the <b>yellow band</b>', sub: 'That is where the RX pulls hardest', el: '.speedo',
    done: C => C.acc.band > 2.5, max: 7 },
  { id: 'boost', text: 'Kick meter full? Tap the <b>bottle</b>', sub: 'BOOST! Ride in a rival\'s slipstream to fill it', btn: ['boost'], key: 'Shift',
    start: (C, R, P) => { P.boost = Math.max(P.boost, 62); }, done: (C, R, P) => P.boosting, max: 10 },
  { id: 'maar', text: 'Rival beside you? <b>MAAR!</b>', sub: 'Kick him off. Weapons on the road hit harder', btn: ['hit'], key: 'J / L',
    only: R => R.combatOn, ready: (C, R) => R.raceT >= 10.5, readyMax: 30, done: C => C.acc.hit, max: 10 },
  { id: 'go', text: 'Ab jeet ke dikha!', sub: 'Help has every move', max: 3.2, final: true },
];
class Coach {
  // a coach for this race, or null
  static maybe(game, R) {
    const done = SAVE.coachDone ?? SAVE.races > 0;
    if (URLP.has('coach')) { /* forced for testing */ } else if (done || DEBUG.autopilot || DEBUG.test) return null;
    if (R.police || R.riders.length < 2 || R.ghost) return null;
    return new Coach(game, R);
  }
  constructor(game, R) {
    this.game = game; this.R = R; this.el = $('#coach'); this.steps = COACH_STEPS.filter(s => !s.only || s.only(R));
    this.i = -1; this.t = 0; this.wait = 0; this.gap = 0; this.acc = {}; this.hl = [];
    this.el.querySelector('.coach-skip').onclick = (e) => { e.stopPropagation(); AUDIO.click(); this.finish(); };
    this.next();
  }
  // a tight corner 25–70 m ahead (heading turns by more than ~30°)
  cornerAhead(R, P) {
    const T = R.track, a = T.yawAt(P.s + 25), b = T.yawAt(P.s + 70); let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d));
    return Math.abs(d) > 0.52;
  }
  next() {
    this.clearHL(); this.i++; const s = this.steps[this.i];
    if (!s) return this.finish();
    this.s = s; this.t = 0; this.wait = 0; this.shown = false; this.acc = { steer: 0, brake: 0, band: 0, hit: false };
    this.el.hidden = true;
  }
  show() {
    const s = this.s, n = this.steps.length - 1, k = Math.min(this.i + 1, n);   // the last line is a send-off, not a step
    this.el.querySelector('.coach-k').textContent = s.final ? 'COACH' : `COACH · ${k}/${n}`;
    this.el.querySelector('b').innerHTML = s.text;
    const sub = this.el.querySelector('small'); sub.textContent = s.sub || '';
    const key = this.el.querySelector('kbd'); key.hidden = IS_TOUCH || !s.key; key.textContent = s.key || '';
    this.el.classList.remove('done', 'out', 'final'); if (s.final) this.el.classList.add('final');
    this.el.hidden = false; this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
    if (IS_TOUCH && s.btn) for (const b of s.btn) { const e = $(`.tbtn[data-t="${b}"]`); if (e) { e.classList.add('coach-hl'); this.hl.push(e); } }
    if (s.el) { const e = $(s.el); if (e) { e.classList.add('coach-hl'); this.hl.push(e); } }
    if (s.start) s.start(this, this.R, this.R.player);
    this.shown = true;
  }
  clearHL() { for (const e of this.hl) e.classList.remove('coach-hl'); this.hl = []; }
  update(dt, inp) {
    if (this.over) return; const R = this.R, P = R.player;
    if (R.state === 'finished' || P.finished || P.eliminated) return this.finish();
    if (this.gap > 0) { this.gap -= dt; if (this.gap <= 0) this.next(); return; }
    const s = this.s; if (!s) return;
    if (!this.shown) {   // waiting for the right moment (a corner coming up, fights switched on)
      this.wait += dt; if (s.ready && !s.ready(this, R, P) && this.wait < (s.readyMax || 6)) return;
      if (R.state === 'countdown' && !(s.only && s.only(R))) return;
      this.show();
    }
    this.t += dt; const A = this.acc;
    if (R.state === 'racing' && !P.crashed) {
      if (Math.abs(P.input.steer) > 0.3) A.steer += dt;
      if (P.input.brake > 0.3) A.brake += dt;
      if (P.rpm >= 5500 && P.rpm <= 7500) A.band += dt;
      if (inp && (inp.hitL || inp.hitR || inp.hitAuto)) A.hit = true;
    }
    if (s.done && s.done(this, R, P)) { this.el.classList.add('done'); AUDIO.click(); this.clearHL(); this.gap = 0.9; return; }
    if (this.t > (s.max || 8)) { this.el.classList.add('out'); this.clearHL(); this.gap = s.final ? 0.01 : 0.45; }   // didn't do it: move on, never stall
  }
  // done for good: skipped, finished the steps, or the race ended
  finish() {
    if (this.over) return; this.over = true; this.clearHL(); this.el.hidden = true; this.el.classList.remove('in', 'done', 'out', 'final');
    SAVE.coachDone = true; persist();   // one go is enough; Help can switch it back on
  }
  dispose() { this.finish(); }
}
