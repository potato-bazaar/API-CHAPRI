// Cyber X in a race: chase-camera shots a few seconds in (sim live), and one in a wheelie.
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=high&laps=1&track=${process.argv[2] || 'marine-drive'}&build=cyber${process.env.QX || ''}`, width: 800, height: 450 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  await page.evaluate(() => { const g = window.__chapri, R = g.race; for (let i = 0; i < 60 * 5; i++) R.update(1 / 60); g.camInit = false; });
  await page.waitForTimeout(2500); await page.screenshot({ path: 'tools/cy_race1.png', timeout: 180000 });
  await page.evaluate(() => { const g = window.__chapri, R = g.race; for (let i = 0; i < 60 * 2; i++) R.update(1 / 60); g.camInit = false; });
  await page.waitForTimeout(2500); await page.screenshot({ path: 'tools/cy_race2.png', timeout: 180000 });
  console.log(await page.evaluate(() => { const P = window.__chapri.race.player; return JSON.stringify({ v: P.v.toFixed(1), cyber: P.rig.cyber, rivals: window.__chapri.race.riders.filter(r => r.rig.cyber).length }); }));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
await browser.close();
