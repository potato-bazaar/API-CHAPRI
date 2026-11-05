// Shots of each set piece on a track: kicker, hall inside + entrance, rooftop, rail+train
import { openGame } from './serve-test.mjs';
const tr = process.argv[2] || 'mumbai-central', tag = process.argv[3] || 'sp';
const { browser, page, logs } = await openGame({ query: `?test&q=${process.env.Q || 'low'}&track=${tr}`, width: 800, height: 450 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  const views = await page.evaluate((tr) => { const g = window.__chapri; g.loadTrack(tr); g.menuFrame = () => {}; document.querySelectorAll('.screen').forEach(s => (s.style.visibility = 'hidden')); if (g.menuRig) g.menuRig.root.visible = false;
    const T = g.track, v = [];
    for (const k of T.kickers.slice(0, 1)) v.push({ n: 'kicker', s: k.s - 9, d: k.d * 0.2 - k.side * 3, h: 2.2, ls: k.s + k.len + 8, ld: k.d, lh: 0.5 });
    for (const h of T.halls) { v.push({ n: 'hall_in', s: h.s0 + 18, d: 0, h: 1.7, ls: h.s0 + 40, ld: 0, lh: 1.5 }); v.push({ n: 'hall_out', s: h.s0 - 22, d: 0, h: 3, ls: h.s0, ld: 0, lh: 4 }); }
    if (T.roof) { const R = T.roof, g0 = R.gaps[0]; v.push({ n: 'roof', s: R.s0 + g0.x0 - 14, d: 0, h: 2.2, ls: R.s0 + g0.x0 + 10, ld: 0, lh: 0, abs: true }); v.push({ n: 'roof_side', s: R.s0 + g0.x0, d: -26, h: 8, ls: R.s0 + g0.x0, ld: 0, lh: 0, abs: true }); }
    if (T.rail) { v.push({ n: 'rail', s: T.rail.s - 30, d: 8, h: 3, ls: T.rail.s, ld: 0, lh: -6 }); v.push({ n: 'rail_side', s: T.rail.s, d: 0, h: 0, ls: T.rail.s + 1, ld: 0, lh: 0 }); }
    return v; }, tr);
  for (const v of views) {
    await page.evaluate((v) => { const g = window.__chapri, T = g.track, V = g.camera.position.constructor; const a = T.pos(v.s, v.d, new V(), v.h), b = T.pos(v.ls, v.ld, new V(), v.lh);
      g.camera.position.copy(a); g.camera.fov = 62; g.camera.updateProjectionMatrix(); g.camera.lookAt(b);
      if (g.world.train && v.n.startsWith('rail')) { g.world.trainT = 12; g.world.trainDir = 1; const W = g.world, c = W.railC.clone(), al = new V(Math.sin(T.yawAt(T.rail.s)), 0, Math.cos(T.yawAt(T.rail.s)));
        if (v.n === 'rail_side') { g.camera.position.copy(c).addScaledVector(al, -38).addScaledVector(W.railA, 22); g.camera.position.y = 3.5; g.camera.lookAt(c.clone().addScaledVector(W.railA, -4).setY(4)); } } }, v);
    await frames(2); await page.screenshot({ path: `tools/${tag}_${v.n}.png`, timeout: 120000 }); console.log('shot', v.n);
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 6).join('\n'));
await browser.close();
