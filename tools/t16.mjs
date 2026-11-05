import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: '?test&q=low', width: 900, height: 600 });
try { await page.waitForSelector('#menu.show', { timeout: 90000 }); await page.evaluate(() => window.__chapri.ui.open('howto'));
  await page.waitForTimeout(400); const el = await page.$('#howto'); await el.screenshot({ path: 'tools/s_howto.png', timeout: 90000 });
  console.log(await page.evaluate(() => document.querySelector('.credits').textContent));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
