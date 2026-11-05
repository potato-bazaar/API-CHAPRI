// Rider animation poses on the player bike: side camera, frozen mid-animation (swing, kick, throw), then cruising tuck.
import { openGame } from './serve-test.mjs';
const tag = process.argv[2] || 'an';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=${process.env.Q || 'low'}&timescale=1&laps=3&track=mumbai-central`, width: 640, height: 360 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
const shot = (n) => page.screenshot({ path: `tools/${tag}_${n}.png`, timeout: 120000 });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  await page.evaluate(() => { const g = window.__chapri; document.querySelectorAll('#hud').forEach(s => (s.style.visibility = 'hidden')); g._dbg = { i: 0, off: [2.4, 1.15, 0.2], fov: 42 }; const orig = g.chaseCam.bind(g);
    g.chaseCam = (dt) => { orig(dt); const d = g._dbg; if (!d) return; const o = g.race.riders[d.i].rig.root; o.updateMatrixWorld(true); const V = g.camera.position.constructor;
      g.camera.position.copy(new V(...d.off).applyMatrix4(o.matrixWorld)); g.camera.fov = d.fov; g.camera.updateProjectionMatrix(); g.camera.lookAt(new V(0, 0.95, 0).applyMatrix4(o.matrixWorld)); };
    g.race.state = 'countdown'; g.race.update = ((u) => function (dt) { return u.call(this, 0); })(g.race.update); });
  const poses = [['idle', null], ['swing_wind', { name: 'swing', side: -1, ph: 0.45, w: 'chain' }], ['swing_hit', { name: 'swing', side: -1, ph: 0.8, w: 'chain' }], ['kick', { name: 'kick', side: 1, ph: 0.5 }], ['throw', { name: 'throw', side: -1, ph: 0.2, w: 'bottle' }], ['belt_left', { name: 'swing', side: 1, ph: 0.75, w: 'belt' }]];
  for (const [n, a] of poses) {
    await page.evaluate((a) => { const g = window.__chapri, rig = g.race.player.rig; rig.showWeapon(a ? a.w || null : null);
      const st = { lean: 0, pitch: 0, speed: 0, tuck: 0.3 }; rig.anim = a ? { name: a.name, side: a.side, t: a.ph * 100, dur: 100 } : null; rig.update(0, st); rig._freeze = true;
      rig._u = rig._u || rig.update; rig.update = function (dt, s) { if (this.anim) this.anim.t = this.anim.dur * (a ? a.ph : 0); return this._u(0, { ...s, tuck: 0.3 }); }; }, a);
    await frames(2); await shot(n);
  }
  // camera from the front-quarter too
  await page.evaluate(() => { const g = window.__chapri; g._dbg = { i: 0, off: [1.3, 1.5, 2.4], fov: 42 }; const rig = g.race.player.rig; rig.anim = null; rig.showWeapon(null); });
  await frames(2); await shot('front');
  await page.evaluate(() => { const g = window.__chapri; g._dbg = { i: 0, off: [-0.9, 1.7, -2.2], fov: 42 }; });
  await frames(2); await shot('back');
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
