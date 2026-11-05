// Diagnostic: does the canvas keep rendering in a race? logs frames, errors as they happen
import { openGame } from './serve-test.mjs';
const q = process.argv[2] || 'medium';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=${q}&timescale=1&laps=3&track=mumbai-central`, width: 640, height: 360 });
page.on('pageerror', e => console.log('PAGEERR', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 300)); });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  for (let i = 0; i < 6; i++) {
    const a = await page.evaluate(() => { const g = window.__chapri; return { t: g.race.raceT.toFixed(1), frame: g.renderer.info.render.frame, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, state: g.race.state }; });
    console.log(JSON.stringify(a)); await page.waitForTimeout(1500);
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
await browser.close();
