// CPU cost of posing all riders (IK) per frame
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&timescale=1&laps=3&track=mumbai-central${process.argv[2] || ''}`, width: 320, height: 180 });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  const r = await page.evaluate(() => { const g = window.__chapri, R = g.race; const st = { lean: 0.2, pitch: 0, speed: 20, tuck: 0.5 };
    for (let k = 0; k < 20; k++) R.riders.forEach(x => x.rig.update(0.016, st));
    const t0 = performance.now(); const N = 200; for (let k = 0; k < N; k++) R.riders.forEach(x => x.rig.update(0.016, st)); const per = (performance.now() - t0) / N;
    return { msPerFrameAllRiders: per.toFixed(3), riders: R.riders.length, model: !!R.player.rig.rm }; });
  console.log(JSON.stringify(r));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 5).join('\n'));
await browser.close();
