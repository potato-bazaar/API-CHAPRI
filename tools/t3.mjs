import { openGame } from './serve-test.mjs';
const q = process.argv[2] || '?autopilot&q=low&timescale=3&laps=1'; const out = process.argv[3] || 'race';
const shots = +(process.argv[4] || 4);
const { browser, page, logs } = await openGame({ query: q, width: 960, height: 540 });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  for (let i = 0; i < shots; i++) {
    await page.waitForTimeout(i === 0 ? 9000 : 14000);
    const st = await page.evaluate(() => { const g = window.__chapri; const R = g.race; if (!R) return { state: g.state }; const P = R.player; return { state: g.state, rs: R.state, t: R.raceT.toFixed(1), pos: R.ranking().indexOf(P) + 1, lap: P.lap, dist: P.dist.toFixed(0), v: (P.v * 3.6).toFixed(0), wob: P.wobble.toFixed(0), crashed: P.crashed, score: R.score, riders: R.riders.map(r => r.short + ':' + r.dist.toFixed(0) + (r.crashed ? 'X' : '')).join(' '), calls: g.renderer.info.render.calls }; });
    console.log(JSON.stringify(st));
    await page.screenshot({ path: `tools/${out}_${i}.png`, timeout: 60000 });
  }
  const done = await page.waitForSelector('#results.show', { timeout: 200000 }).then(() => true).catch(() => false);
  if (done) { await page.waitForTimeout(800); await page.screenshot({ path: `tools/${out}_results.png`, timeout: 60000 }); console.log('RESULTS OK'); }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
