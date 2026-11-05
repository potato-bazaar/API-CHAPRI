// Garage paint check: render several builds side-on in the garage and save one contact sheet per build.
import { openGame } from './serve-test.mjs';
const builds = (process.argv[2] || 'chrome,kaali,raja,neon,stock,sticker').split(',');
const { browser, page, logs } = await openGame({ query: `?test&q=${process.env.Q || 'medium'}`, width: 800, height: 450 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  await page.evaluate(() => { const g = window.__chapri; g.showScreen('garage'); g.ui.renderGarage && g.ui.renderGarage(); });
  for (const b of builds) {
    await page.evaluate((b) => { const g = window.__chapri; g.refreshMenuRig(b); g.ui.garageYaw = 1.2; g.ui.dragT = 1e9; }, b);
    await frames(3);
    await page.screenshot({ path: `tools/gar_${b}.png`, timeout: 120000 });
    console.log('shot', b);
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
