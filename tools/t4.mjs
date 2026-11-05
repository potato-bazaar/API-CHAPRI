import { openGame } from './serve-test.mjs';
// quick visual pass over each track: start autopilot race, grab one frame mid-race
const tracks = (process.argv[2] || 'crawford-market,dharavi-lanes,bandstand-rush,sion-flyover').split(',');
const extra = process.argv[3] || '';
for (const tr of tracks) {
  const { browser, page, logs } = await openGame({ query: `?autopilot&q=medium&timescale=2&laps=1&track=${tr}${extra}`, width: 960, height: 540 });
  try {
    await page.waitForSelector('#hud.show', { timeout: 90000 });
    await page.waitForTimeout(16000);
    const st = await page.evaluate(() => { const g = window.__chapri, R = g.race, P = R.player; return { t: R.raceT.toFixed(1), dist: P.dist.toFixed(0), v: (P.v * 3.6).toFixed(0), crashed: R.riders.filter(r => r.crashed).length, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, L: R.track.L }; });
    console.log(tr, JSON.stringify(st));
    await page.screenshot({ path: `tools/tr_${tr}${extra ? '_x' : ''}.png`, timeout: 60000 });
  } catch (e) { console.log(tr, 'ERR', e.message.split('\n')[0]); }
  if (logs.length) console.log(logs.slice(0, 10).join('\n'));
  await browser.close();
}
