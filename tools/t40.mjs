// Feel audit: one lap driven like a keyboard player (digital left/right through the same 7/12 easing as INPUT),
// versus the AI's analog steering. Logs steering toggles, lateral wander, heading swings, every hit/penalty event,
// time lost, and camera jitter (the camera is run each frame exactly like the game does).
import { openGame } from './serve-test.mjs';
const [tr = 'mumbai-central', mode = 'keys'] = process.argv.slice(2);
const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&laps=1&track=${tr}${process.env.EXTRA || ''}`, width: 480, height: 270 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
try {
  await page.waitForSelector('#hud.show', { timeout: 120000 });
  const r = await page.evaluate((mode) => {
    const g = window.__chapri, R = g.race, P = R.player, T = R.track; const ev = {}; const tally = (k, v = 1) => (ev[k] = (ev[k] || 0) + v);
    // hook the penalty events
    for (const [fn, key] of [['onWall', 'wall'], ['onPothole', 'pothole'], ['onBreaker', 'breaker'], ['onLand', 'land'], ['onCrash', 'crash']]) { const o = R[fn].bind(R); R[fn] = (r, ...a) => { if (r === P) { tally(key); if (key === 'wall') tally('wallInto', a[0]); } return o(r, ...a); }; }
    const ow = P.addWobble.bind(P); let wobSum = 0; P.addWobble = (n, q) => { wobSum += n; return ow(n, q); };
    const oc = R.interactions.bind(R); let contacts = 0; R.interactions = (h) => { const d0 = P.d, v0 = P.v; oc(h); if (Math.abs(P.d - d0) > 0.004 && !P.crashed) { contacts++; tally('pushM', Math.abs(P.d - d0)); } if (P.v < v0 * 0.97 && !P.crashed) tally('speedKills'); };
    // keyboard driver: the AI decides where to go, a human-like hand turns it into key presses
    let key = 0, toggles = 0, steerSm = 0; const th = P.think.bind(P);
    if (mode === 'keys') P.think = function (dt, ...a) { th(dt, ...a); const want = this.input.steer; const nk = want > 0.3 ? 1 : want < -0.3 ? -1 : (Math.abs(want) < 0.12 ? 0 : key); if (nk !== key) { toggles++; key = nk; } { const rt = key === 0 ? 12 : 7; steerSm = key + (steerSm - key) * Math.exp(-rt * dt); } this.input.steer = steerSm; };
    let n = 0, err = null; const dt = 1 / 60; const S = { psiMax: 0, psiSum2: 0, dJerk: [], camJerk: [], camRoll: [], slowT: 0, brakeT: 0, offLineT: 0, wobbleT: 0, vSum: 0 };
    let pd = [P.d, P.d], pc = null, pc2 = null, proll = 0; g.camInit = false;
    try { while (n < 60 * 260 && !P.finished) { R.update(dt); g.chaseCam(dt); n++;
      if (R.state !== 'racing' || P.crashed) { pc = pc2 = null; continue; }
      S.vSum += P.v; S.psiMax = Math.max(S.psiMax, Math.abs(P.psi)); S.psiSum2 += P.psi * P.psi;
      const dd = P.d - 2 * pd[1] + pd[0]; S.dJerk.push(Math.abs(dd) / dt / dt); pd = [pd[1], P.d];
      const c = g.camera.position.clone(); if (pc && pc2) S.camJerk.push(c.clone().sub(pc).multiplyScalar(2).sub(c).add(pc2).length() / dt / dt); pc2 = pc; pc = c;   // |c - 2c1 + c2| / dt²
      const roll = g.camera.rotation.z; S.camRoll.push(Math.abs(roll - proll) / dt); proll = roll;
      if (P.v < Math.min(T.vmaxAt(P.s), P.vTop) * 0.75) S.slowT += dt; if (P.input.brake > 0.5) S.brakeT += dt; if (P.wobble > 30) S.wobbleT += dt; } }
    catch (e) { err = e.message + ' ' + (e.stack || '').split('\n')[1]; }
    const pct = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b.length ? +b[Math.floor(b.length * q)].toFixed(1) : 0; };
    const fr = n; return { mode, err, lapT: P.finishT ? P.finishT.toFixed(1) : (n / 60).toFixed(1) + '(dnf)', avgKmh: (S.vSum / fr * 3.6).toFixed(0), toggles, togglesPerMin: (toggles / (n / 3600)).toFixed(0),
      psiMaxDeg: (S.psiMax * 57.3).toFixed(1), psiRmsDeg: (Math.sqrt(S.psiSum2 / fr) * 57.3).toFixed(1), latAccP95: pct(S.dJerk, 0.95), latAccMax: pct(S.dJerk, 0.999),
      camAccP50: pct(S.camJerk, 0.5), camAccP95: pct(S.camJerk, 0.95), camAccMax: pct(S.camJerk, 0.999), camRollP95: pct(S.camRoll, 0.95),
      slowPct: (S.slowT / (n / 60) * 100).toFixed(0), brakePct: (S.brakeT / (n / 60) * 100).toFixed(0), wobblyPct: (S.wobbleT / (n / 60) * 100).toFixed(0), wobbleAdded: Math.round(wobSum), contacts, events: Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, +(+v).toFixed(2)])) };
  }, mode);
  console.log(JSON.stringify(r));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 6).join('\n'));
await browser.close();
