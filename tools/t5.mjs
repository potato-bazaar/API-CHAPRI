import { openGame } from './serve-test.mjs';
const tr = process.argv[2] || "dharavi-lanes"; const ts = process.argv[3] || "4"; const laps = process.argv[4] || "1";
const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&timescale=${ts}&laps=${laps}&track=${tr}`, width: 800, height: 450 });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  let i = 0;
  while (true) {
    await page.waitForTimeout(10000);
    const st = await page.evaluate(() => { const g = window.__chapri, R = g.race; if (!R) return { state: g.state }; const P = R.player; return { state: g.state, t: R.raceT.toFixed(1), dist: P.dist.toFixed(0), v: (P.v * 3.6).toFixed(0), crashes: R.riders.map(r => (r._crashes || 0)).join(','), crashedNow: R.riders.filter(r => r.crashed).map(r => r.short).join(','), wob: R.riders.map(r => r.wobble.toFixed(0)).join(','), laps: R.riders.map(r => r.laps.map(x => x.toFixed(1)).join('/')).join(' '), sc: R.score }; });
    console.log(JSON.stringify(st));
    await page.screenshot({ path: `tools/run_${tr}_${i++}.png`, timeout: 60000 });
    if (st.state !== "race" || i > 30) break;
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
