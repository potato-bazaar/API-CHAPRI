// Real bike check: grid shot, close side/front shots of player + rivals, cruise shot, perf numbers.
import { openGame } from './serve-test.mjs';
const tr = process.argv[2] || 'mumbai-central'; const extra = process.argv[3] || ''; const tag = process.argv[4] || 'bk';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=${process.env.Q || 'medium'}&timescale=1&laps=3&track=${tr}${extra}`, width: Number(process.env.W || 800), height: Number(process.env.H || 450) });
const shot = (n) => page.screenshot({ path: `tools/${tag}_${n}.png`, timeout: 120000 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  await page.waitForTimeout(800);
  console.log('model', await page.evaluate(() => window.__chapri.bikeModel));
  await shot('grid');
  // close-up camera relative to a rider: (side, up, back) offsets in rider space
  await page.evaluate(() => { const g = window.__chapri; g._dbg = null; const orig = g.chaseCam.bind(g);
    g.chaseCam = (dt) => { orig(dt); const d = g._dbg; if (!d) return; const r = g.race.riders[d.i]; const o = r.rig.root; o.updateMatrixWorld(true);
      const V = g.camera.position.constructor; const p = new V(...d.off).applyMatrix4(o.matrixWorld); g.camera.position.copy(p); g.camera.fov = d.fov || 40; g.camera.updateProjectionMatrix();
      const l = new V(0, 0.75, 0).applyMatrix4(o.matrixWorld); g.camera.lookAt(l); }; });
  for (const [n, d] of [['side', { i: 0, off: [2.6, 1.1, 0.1] }], ['front', { i: 0, off: [0.9, 1.3, 2.6] }], ['rear3q', { i: 0, off: [-1.6, 1.6, -2.4] }], ['rival', { i: 3, off: [2.2, 1.2, 1.2] }]]) {
    await page.evaluate((d) => { window.__chapri._dbg = d; }, d); await frames(2); await shot(n);
  }
  await page.evaluate(() => { const g = window.__chapri; g._dbg = null; g.race.raceT = 0; g.race.state = 'racing'; g.hud.el.big.hidden = true;
    const R = g.race; for (let i = 0; i < 90 * 14; i++) R.update(1 / 90); g.camInit = false; });
  await frames(3);
  const a = await page.evaluate(() => { const g = window.__chapri, P = g.race.player; return { kmh: (P.v * 3.6).toFixed(0), calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, progs: g.renderer.info.programs.length }; });
  console.log('cruise', JSON.stringify(a));
  const ms = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; if (n < 4) requestAnimationFrame(f); else r((performance.now() - t) / 4); }; requestAnimationFrame(f); }));
  console.log('ms/frame (swiftshader)', ms.toFixed(0));
  await shot('cruise');
  await page.evaluate(() => { const g = window.__chapri; g._dbg = { i: 0, off: [1.8, 0.9, 1.2], fov: 45 }; }); await frames(2); await shot('lean');
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 12).join('\n'));
await browser.close();
