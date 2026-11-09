// Fast-forward a full race in-page (physics + rig animation, incl. crashes) and report errors.
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&laps=${process.argv[3] || 1}&track=${process.argv[2] || 'dharavi-lanes'}${process.env.QX || ''}`, width: 480, height: 270 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  const r = await page.evaluate(() => { const g = window.__chapri, R = g.race; let n = 0, crashes = 0, err = null;
    try { while (n < 60 * 400 && R.state !== 'finished') { R.update(1 / 60); n++; if (R.player.crashed) crashes++; } } catch (e) { err = e.message + ' ' + (e.stack || '').split('\n')[1]; }
    return { t: (n / 60).toFixed(0), state: R.state, err, crashedFrames: crashes, pos: R.ranking().indexOf(R.player) + 1, riders: R.riders.map(x => x.short + (x.finished ? '✓' : '') + (x._crashes ? 'x' + x._crashes : '')).join(' '), holes: R.riders.reduce((a, x) => a + (x.lastHole >= 0 ? 1 : 0), 0) }; });
  console.log(JSON.stringify(r));
  await page.waitForTimeout(3000); console.log('game state', await page.evaluate(() => window.__chapri.state));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
