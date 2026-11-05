// Garage close-ups of bike mod combos (UI hidden). Usage: node t33.mjs
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?test&q=medium`, width: 640, height: 400 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
const frames = async (n) => { const f0 = await page.evaluate(() => window.__chapri.renderer.info.render.frame); await page.waitForFunction(([f0, n]) => window.__chapri.renderer.info.render.frame >= f0 + n, [f0, n], { timeout: 120000, polling: 200 }); };
const combos = (process.env.SET === 'front') ? [
  ['f_full_06', { exhaust: 'dragon', tyres: 'fat', kit: 'full', finish: 'flake' }, '#00c2ff', 0.6],
  ['f_full_10', { exhaust: 'long', tyres: 'fat', kit: 'full', finish: 'gloss' }, '#ff3b30', 1.0],
  ['f_guard_0', { exhaust: 'twin', tyres: 'racing', kit: 'guard', finish: 'matte' }, '#141414', 0.2],
  ['f_cafe_14', { exhaust: 'stock', tyres: 'stock', kit: 'cafe', finish: 'chrome' }, '#ffd400', 1.4],
] : [
  ['stock', { exhaust: 'stock', tyres: 'stock', kit: 'none', finish: 'gloss' }, '#8a1630', 2.4],
  ['long_fat_guard', { exhaust: 'long', tyres: 'fat', kit: 'guard', finish: 'gloss' }, '#141414', 2.4],
  ['twin_cafe_matte', { exhaust: 'twin', tyres: 'racing', kit: 'cafe', finish: 'matte' }, '#39ff6a', 2.4],
  ['dragon_full_chrome', { exhaust: 'dragon', tyres: 'fat', kit: 'full', finish: 'chrome' }, '#7b2cbf', 2.4],
];
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  await page.evaluate(() => { const g = window.__chapri; g.showScreen('garage'); document.querySelectorAll('.screen').forEach(s => (s.style.visibility = 'hidden')); });
  for (const [n, md, paint, yaw] of combos) {
    await page.evaluate(([md, paint, yaw]) => { const g = window.__chapri; const S = g.__save ? g.__save() : null; window.__setMods && window.__setMods(md, paint); g.ui.garageYaw = yaw; g.ui.dragT = 1e9; }, [md, paint, yaw]);
    await frames(3); await page.screenshot({ path: `tools/mod_${n}.png`, timeout: 120000 }); console.log('shot', n);
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 6).join('\n'));
await browser.close();
