// Rider close-ups in the garage at several orbit angles (and an optional zoomed camera)
import { openGame } from './serve-test.mjs';
const yaws = JSON.parse(process.argv[2] || '[1.57,0.5,2.6]'); const tag = process.argv[3] || 'rd';
const { browser, page, logs } = await openGame({ query: `?test&q=${process.env.Q || 'medium'}`, width: 800, height: 450 });
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  await page.evaluate((b) => { const g = window.__chapri; g.showScreen('garage'); g.ui.renderGarage && g.ui.renderGarage(); if (b) g.refreshMenuRig(b); }, process.env.BUILD || null).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('.screen, #hud').forEach(s => (s.style.visibility = 'hidden')));
  for (const [i, y] of yaws.entries()) {
    await page.evaluate((y) => { const g = window.__chapri; g.ui.garageYaw = y; g.ui.dragT = 1e9; }, y);
    await frames(3);
    await page.screenshot({ path: `tools/${tag}_${i}.png`, timeout: 120000 });
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
