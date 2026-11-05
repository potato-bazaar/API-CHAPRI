// Garage screen with UI (mods section) at a phone-ish and a desktop size
import { openGame } from './serve-test.mjs';
for (const [w, h] of [[1280, 720], [844, 390]]) {
  const { browser, page, logs } = await openGame({ query: `?test&q=medium`, width: w, height: h });
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  try {
    await page.waitForSelector('#menu.show', { timeout: 90000 });
    await page.evaluate(() => { window.__setMods({ exhaust: 'long', tyres: 'fat', kit: 'guard', finish: 'gloss' }); window.__chapri.ui.open('garage'); });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const p = document.querySelector('.upgrade-panel'); if (p) p.scrollTop = 260; });
    await page.waitForTimeout(800); await page.screenshot({ path: `tools/gar_${w}.png`, timeout: 120000 }); console.log('shot', w);
  } catch (e) { console.log('ERR', e.message.split('\n')[0]); }
  if (logs.length) console.log(logs.slice(0, 6).join('\n'));
  await browser.close();
}
