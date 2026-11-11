// Garage screen with the Cyber X selected (UI visible), desktop and phone.
import { openGame } from './serve-test.mjs';
for (const [n, o] of [['desk', { width: 1100, height: 640 }], ['phone', { width: 800, height: 380, mobile: true }]]) {
  const { browser, page, logs } = await openGame(Object.assign({ query: '?test&q=medium' }, o));
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  try { await page.waitForSelector('#menu.show', { timeout: 90000 });
    await page.evaluate(() => { const g = window.__chapri; g.showScreen('garage'); g.ui.renderGarage('cyber'); g.refreshMenuRig('cyber'); });
    await page.waitForTimeout(4000); await page.screenshot({ path: `tools/cy_garage_${n}.png`, timeout: 180000 }); console.log('shot', n, await page.evaluate(() => JSON.stringify(window.__SAVE().owned)));
  } catch (e) { console.log('ERR', e.message.split('\n')[0]); }
  if (logs.length) console.log(logs.slice(0, 5).join('\n'));
  await browser.close();
}
