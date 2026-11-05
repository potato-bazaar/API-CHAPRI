// Bhaag Chapri Bhaag stage: plan dump + shots of the seedhi, nala, a naka (UI hidden)
import { openGame } from './serve-test.mjs';
const tag = process.argv[2] || 'st';
const { browser, page, logs } = await openGame({ query: `?test&q=${process.env.Q || 'medium'}&track=bhaag-chapri&time=night`, width: 800, height: 450 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 180000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  const plan = await page.evaluate(() => { const g = window.__chapri; g.loadTrack('bhaag-chapri', 'night'); g.menuFrame = () => {}; document.querySelectorAll('.screen').forEach(s => (s.style.visibility = 'hidden')); if (g.menuRig) g.menuRig.root.visible = false;
    const T = g.track; return { L: Math.round(T.L), stairs: T.stairs, nala: T.nala, nakas: T.nakas.map(n => Math.round(n.s)), dogs: T.dogSpots.map(d => Math.round(d.s)), sc: T.shortcuts.map(x => Math.round(x.s)), barricades: g.world.barricades.length, shooters: g.world.nakaShooters.length }; });
  console.log(JSON.stringify(plan));
  const views = await page.evaluate(() => { const T = window.__chapri.track, v = [], S = T.stairs, W = T.nala, N = T.nakas[0];
    if (S) { v.push({ n: 'stairs_up', s: S.s0 - 14, d: 2, h: 2.2, ls: S.s0 + 20, ld: 0, lh: 0 }); v.push({ n: 'stairs_top', s: S.s0 + S.len - S.up - 6, d: -1, h: 2.0, ls: S.s0 + S.len + 6, ld: 0, lh: 0 }); v.push({ n: 'stairs_side', s: S.s0 + S.len / 2, d: -28, h: 6, ls: S.s0 + S.len / 2, ld: 0, lh: 0 }); }
    if (W) v.push({ n: 'nala', s: W.s0 - 8, d: 1.5, h: 1.6, ls: W.s0 + 20, ld: 0, lh: 0.3 });
    if (N) { v.push({ n: 'naka', s: N.s - 30, d: 0, h: 1.8, ls: N.s, ld: 0, lh: 1 }); v.push({ n: 'naka_close', s: N.s - 6, d: 4, h: 1.7, ls: N.s + 3, ld: -6, lh: 1.2 }); }
    return v; });
  for (const v of views) {
    await page.evaluate((v) => { const g = window.__chapri, T = g.track, V = g.camera.position.constructor; const a = T.pos(v.s, v.d, new V(), v.h), b = T.pos(v.ls, v.ld, new V(), v.lh);
      g.camera.position.copy(a); g.camera.fov = 62; g.camera.updateProjectionMatrix(); g.camera.lookAt(b); }, v);
    await frames(3); await page.screenshot({ path: `tools/${tag}_${v.n}.png`, timeout: 180000 }); console.log('shot', v.n);
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 6).join('\n'));
await browser.close();
