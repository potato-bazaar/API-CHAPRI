// Crash + celebrate poses (in-page state forcing), then cruise chase-cam and a rival close-up; reports errors.
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=${process.env.Q || 'low'}&timescale=1&laps=3&track=mumbai-central`, width: 640, height: 360 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
const shot = (n) => page.screenshot({ path: `tools/cz_${n}.png`, timeout: 120000 });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  const r = await page.evaluate(() => { const g = window.__chapri, rig = g.race.player.rig; try { rig.update(0.016, { lean: 0.6, pitch: 0, speed: 5, crashed: true }); rig.update(0.016, { lean: 0, pitch: 0.3, speed: 5, celebrate: true }); rig.update(0.016, { lean: -0.5, pitch: -0.2, speed: 20, tuck: 1, weightBack: true }); return 'ok'; } catch (e) { return e.message + ' ' + e.stack.split('\n')[1]; } });
  console.log('forced states', r);
  await page.evaluate(() => { const g = window.__chapri; g.race.raceT = 0; g.race.state = 'racing'; const R = g.race; for (let i = 0; i < 90 * 16; i++) R.update(1 / 90); g.camInit = false; });
  await frames(3); await shot('cruise');
  const a = await page.evaluate(() => { const g = window.__chapri; return { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, progs: g.renderer.info.programs.length, kmh: (g.race.player.v * 3.6).toFixed(0) }; });
  console.log('cruise', JSON.stringify(a));
  await page.evaluate(() => { const g = window.__chapri; const orig = g.chaseCam.bind(g); const R = g.race; const rk = R.ranking(); const tgt = rk[0] === R.player ? rk[1] : rk[0];
    g.chaseCam = (dt) => { orig(dt); const o = tgt.rig.root; o.updateMatrixWorld(true); const V = g.camera.position.constructor; g.camera.position.copy(new V(1.6, 1.3, 1.8).applyMatrix4(o.matrixWorld)); g.camera.fov = 45; g.camera.updateProjectionMatrix(); g.camera.lookAt(new V(0, 0.9, 0).applyMatrix4(o.matrixWorld)); }; });
  await frames(3); await shot('rival');
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
