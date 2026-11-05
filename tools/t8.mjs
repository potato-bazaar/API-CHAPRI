import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: '?autopilot&q=low&timescale=2&laps=1&track=bandstand-rush', width: 844, height: 390, mobile: true });
try { await page.waitForSelector('#hud.show', { timeout: 90000 }); await page.waitForFunction(() => window.__chapri.race && window.__chapri.race.raceT > 14, null, { timeout: 160000 }); await page.screenshot({ path: 'tools/mob_race.png', timeout: 60000 }); } catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
