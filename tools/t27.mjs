// Store: pick long hair, then garage close-up at speed-like wind (menu idle = light breeze)
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?test&q=medium`, width: 960, height: 540 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  await page.evaluate(() => window.__chapri.ui.open('store'));
  await page.click('[data-cos="hair:long-black"]'); await frames(2);
  await page.screenshot({ path: 'tools/st_store.png', timeout: 120000 });
  await page.evaluate(() => { const g = window.__chapri; g.showScreen('garage'); g.ui.garageYaw = 2.3; g.ui.dragT = 1e9; document.querySelectorAll('.screen').forEach(s => (s.style.visibility = 'hidden')); const rm = g.menuRig.rm; rm.setWind = function (sp, t) { this.U.uWind.value = 1.1; this.U.uTime.value = t; }; });
  await frames(3); await page.screenshot({ path: 'tools/st_long.png', timeout: 120000 });
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 6).join('\n'));
await browser.close();
