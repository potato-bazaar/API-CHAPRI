// Rider portraits in the garage: face close-up (front 3/4), upper body, full bike 3/4. UI hidden.
import { openGame } from './serve-test.mjs';
const tag = process.argv[2] || 'pt';
const { browser, page, logs } = await openGame({ query: `?test&q=${process.env.Q || 'medium'}${process.env.EXTRA || ''}`, width: 720, height: 540 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 180000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  await page.evaluate(() => { const g = window.__chapri; g.showScreen('garage'); document.querySelectorAll('.screen').forEach(s => (s.style.visibility = 'hidden')); g.ui.dragT = 1e9; g.ui.garageYaw = 0.6; });
  await frames(3);
  for (const [n, look, off, fov] of [['face', 'Head', [0.32, 0.06, 0.55], 28], ['upper', 'spine_03', [0.55, 0.1, 1.25], 34], ['side', 'spine_02', [1.6, 0.2, 0.4], 40], ['bike', 'pelvis', [1.6, 0.3, 2.6], 42]]) {
    await page.evaluate(([look, off, fov]) => { const g = window.__chapri, rm = g.menuRig.rm, V = g.camera.position.constructor; const b = rm.b[look]; const p = b.getWorldPosition(new V()); if (look === 'Head') p.y += 0.08;
      const yaw = g.menuRig.root.rotation.y; const fwd = new V(Math.sin(yaw), 0, Math.cos(yaw)), left = new V(Math.cos(yaw), 0, -Math.sin(yaw));
      g.menuFrame = () => {}; g.garageFrame = () => {}; g.camera.position.copy(p).addScaledVector(left, off[0]).addScaledVector(fwd, off[2]); g.camera.position.y += off[1]; g.camera.fov = fov; g.camera.updateProjectionMatrix(); g.camera.lookAt(p); g._lock = true; }, [look, off, fov]);
    await frames(3); await page.screenshot({ path: `tools/${tag}_${n}.png`, timeout: 180000 }); console.log('shot', n);
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 6).join('\n'));
await browser.close();
