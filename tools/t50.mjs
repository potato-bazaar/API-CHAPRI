// Cyber X in the garage: side, 3/4 front, 3/4 rear, top. UI hidden.
import { openGame } from './serve-test.mjs';
const tag = process.argv[2] || 'cy', build = process.env.BUILD || 'cyber';
const { browser, page, logs } = await openGame({ query: `?test&q=${process.env.Q || 'high'}${process.env.EXTRA || ''}`, width: 760, height: 560 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 180000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  await page.evaluate((b) => { const g = window.__chapri; window.__SAVE().build = b; g.showScreen('garage'); g.refreshMenuRig(b); document.querySelectorAll('.screen').forEach(s => (s.style.visibility = 'hidden')); g.ui.dragT = 1e9; g.ui.garageYaw = 0.6; }, build);
  await frames(3);
  console.log(await page.evaluate(() => { const r = window.__chapri.menuRig; return JSON.stringify({ cyber: r.cyber, model: r.model, fit: r.fit }); }));
  for (const [n, off, fov, ty] of (process.env.SHOTS ? JSON.parse(process.env.SHOTS) : [['side', [2.9, 0.1, 0], 34, 0.62], ['front', [1.7, 0.5, 2.3], 36, 0.62], ['rear', [-1.6, 0.6, -2.4], 36, 0.62], ['top', [0.3, 3.2, -0.3], 34, 0.6]])) {
    await page.evaluate(([off, fov, ty]) => { const g = window.__chapri, V = g.camera.position.constructor; const p = g.menuRig.root.getWorldPosition(new V()); p.y += ty;
      const yaw = g.menuRig.root.rotation.y; const fwd = new V(Math.sin(yaw), 0, Math.cos(yaw)), left = new V(Math.cos(yaw), 0, -Math.sin(yaw));
      g.menuFrame = () => {}; g.garageFrame = () => {}; g.camera.position.copy(p).addScaledVector(left, off[0]).addScaledVector(fwd, off[2]); g.camera.position.y += off[1]; g.camera.fov = fov; g.camera.updateProjectionMatrix(); g.camera.lookAt(p); }, [off, fov, ty]);
    await frames(3); await page.screenshot({ path: `tools/${tag}_${n}.png`, timeout: 180000 }); console.log('shot', n);
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
