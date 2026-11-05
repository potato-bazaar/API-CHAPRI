import { openGame } from './serve-test.mjs';
const W = +(process.argv[2] || 960), H = +(process.argv[3] || 540), mobile = process.argv[4] === 'm';
const tag = process.argv[5] || 'ui';
const { browser, page, logs } = await openGame({ query: '?test&q=low', width: W, height: H, mobile });
const snap = async (n) => page.screenshot({ path: `tools/${tag}_${n}.png`, timeout: 60000 });
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 }); await page.waitForTimeout(1200);
  await snap('menu');
  await page.click('[data-open="setup"]'); await page.waitForTimeout(400); await snap('setup'); await page.click('#setup [data-close]');
  await page.click('.nav[data-open="garage"]'); await page.waitForTimeout(1500); await snap('garage'); await page.click('#garage [data-back]');
  await page.click('.nav[data-open="store"]'); await page.waitForTimeout(1200); await snap('store'); await page.click('#store [data-back]');
  await page.click('[data-open="settings"]'); await page.waitForTimeout(300); await snap('settings'); await page.click('#settings [data-close]');
  await page.click('.nav[data-open="howto"]'); await page.waitForTimeout(300); await snap('howto'); await page.click('#howto [data-close]');
  await page.click('.nav[data-open="board"]'); await page.waitForTimeout(300); await snap('board'); await page.click('#board [data-close]');
  await page.click('.nav[data-nav="cup"]'); await page.waitForTimeout(300); await snap('cup'); await page.click('#cupModal [data-close]');
  await page.click('#bell'); await page.waitForTimeout(400); await snap('bell');
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
