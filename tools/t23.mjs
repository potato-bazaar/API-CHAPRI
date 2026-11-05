// Player at speed from close cameras (side, front-quarter, behind) to check cloth/hair flutter and the riding stance
import { openGame } from './serve-test.mjs';
const tag = process.argv[2] || 'fl', extra = process.argv[3] || '';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=${process.env.Q || 'low'}&timescale=1&laps=3&track=${process.env.TRACK || 'bandstand-rush'}${extra}`, width: 640, height: 360 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  await page.evaluate(() => { const g = window.__chapri; g.race.raceT = 0; g.race.state = 'racing'; const R = g.race; for (let i = 0; i < 90 * (+(new URLSearchParams(location.search).get('ff')) || 12); i++) R.update(1 / 90); g.camInit = false;
    document.querySelectorAll('#hud').forEach(s => (s.style.visibility = 'hidden'));
    const orig = g.chaseCam.bind(g); g.chaseCam = (dt) => { orig(dt); const d = g._dbg; if (!d) return; const o = g.race.player.rig.root; o.updateMatrixWorld(true); const V = g.camera.position.constructor;
      g.camera.position.copy(new V(...d.off).applyMatrix4(o.matrixWorld)); g.camera.fov = 45; g.camera.updateProjectionMatrix(); g.camera.lookAt(new V(0, 1.0, 0.1).applyMatrix4(o.matrixWorld)); }; });
  for (const [n, off] of [['side', [2.3, 1.2, 0.3]], ['front', [1.2, 1.4, 2.4]], ['behind', [0.4, 1.6, -2.6]], ['other', [-2.3, 1.2, 0.3]]]) {
    await page.evaluate((off) => { window.__chapri._dbg = { off }; }, off); await frames(2);
    const st = await page.evaluate(() => { const P = window.__chapri.race.player; return { kmh: (P.v * 3.6).toFixed(0), lean: P.lean.toFixed(2), wind: P.rig.rm && P.rig.rm.U.uWind.value.toFixed(2) }; });
    console.log(n, JSON.stringify(st)); await page.screenshot({ path: `tools/${tag}_${n}.png`, timeout: 120000 });
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
