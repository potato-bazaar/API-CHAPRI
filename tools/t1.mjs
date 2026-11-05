import { openGame } from './serve-test.mjs';
const q = process.argv[2] || '?test&q=low';
const { browser, page, logs } = await openGame({ query: q, width: 960, height: 540 });
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  const t0 = Date.now(); const f0 = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; if (n < 10) requestAnimationFrame(f); else r((performance.now() - t) / 10); }; requestAnimationFrame(f); }));
  console.log('ms/frame', f0.toFixed(0));
  const info = await page.evaluate(() => { const g = window.__chapri; return { q: g.quality, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, geoms: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures, L: g.track.L, obstacles: g.world.obstacles.length, pickups: g.world.pickupSpots.length }; });
  console.log(JSON.stringify(info), 'model', await page.evaluate(() => window.__chapri.bikeModel));
  await page.screenshot({ path: 'tools/s_menu.png', timeout: 90000 });
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
