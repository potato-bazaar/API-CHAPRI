import { openGame } from './serve-test.mjs';
const q = process.argv[2] || '?test&q=medium'; const out = process.argv[3] || 's_scene';
const { browser, page, logs } = await openGame({ query: q, width: 960, height: 540 });
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `tools/${out}_ui.png`, timeout: 90000 });
  await page.addStyleTag({ content: '.screen{visibility:hidden!important}' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `tools/${out}.png`, timeout: 90000 });
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
