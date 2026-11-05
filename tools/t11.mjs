import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: '?test&q=low', width: 960, height: 540 });
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  await page.keyboard.press('KeyM'); await page.keyboard.press('KeyM');
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__chapri.race && window.__chapri.race.state === 'racing', null, { timeout: 60000 });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3000);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyQ'); await page.waitForTimeout(1500); await page.keyboard.up('KeyQ');
  const a = await page.evaluate(() => { const P = window.__chapri.race.player; return { v: (P.v * 3.6).toFixed(0), dist: P.dist.toFixed(1), d: P.d.toFixed(2), psi: P.psi.toFixed(2), wheelie: P.wheelie, pitch: P.pitch.toFixed(2), sc: window.__chapri.race.score }; });
  console.log(JSON.stringify(a));
  await page.screenshot({ path: 'tools/kb_race.png', timeout: 60000 });
  await page.keyboard.press('KeyP'); await page.waitForTimeout(400);
  const ps = await page.evaluate(() => ({ state: window.__chapri.state, pauseVisible: !document.querySelector('#pause').hidden }));
  console.log(JSON.stringify(ps));
  await page.screenshot({ path: 'tools/kb_pause.png', timeout: 60000 });
  await page.click('#pResume'); await page.waitForTimeout(300);
  console.log(await page.evaluate(() => window.__chapri.state));
  await page.keyboard.up('KeyW');
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
