// Police Express+ fast-forward: escape or busted, plus everything that happened on the way
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&mode=police${process.argv[2] || ''}`, width: 480, height: 270 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
try {
  await page.waitForSelector('#hud.show', { timeout: 120000 });
  const r = await page.evaluate(() => { const g = window.__chapri, R = g.race, T = R.track; let n = 0, err = null; const log = { maxHeat: 0, heatAt: [], shots: 0, copCrash: 0, playerCrash: 0, minCop: 1e9, inWaterT: 0, stairsT: 0 };
    const sh = R.police ? R.police.shooters : []; let prevFire = sh.map(() => 0); const c0 = new Map();
    try { while (n < 60 * 420 && R.state !== 'finished') { R.update(1 / 60); n++; const PO = R.police;
      if (PO) { log.maxHeat = Math.max(log.maxHeat, PO.heat); if (n % 600 === 0) log.heatAt.push(Math.round(PO.heat)); log.minCop = Math.min(log.minCop, PO.copDist || 1e9); sh.forEach((s, i) => { if (s.fireT > 0 && prevFire[i] <= 0) log.shots++; prevFire[i] = s.fireT; }); }
      if (R.player.surf === 4) log.inWaterT += 1 / 60; if (R.player.surf === 3) log.stairsT += 1 / 60;
      for (const x of R.riders) { const was = c0.get(x) || false; if (x.crashed && !was) { if (x.isPlayer) log.playerCrash++; else log.copCrash++; } c0.set(x, x.crashed); } } }
    catch (e) { err = e.message + ' ' + (e.stack || '').split('\n')[1]; }
    const S = R.score; return { t: (n / 60).toFixed(0), state: R.state, err, busted: R.police && R.police.busted, laps: R.player.laps.length, cops: R.cops && R.cops.map(c => c.short + ':' + Math.round(c.dist) + (c._crashes ? 'x' + c._crashes : '')).join(' '), playerDist: Math.round(R.player.dist),
      score: { nakas: S.nakaCount, barricades: S.barricadeCount, shotDodges: S.shotDodges, dogs: S.dogs, knock: S.knockCount, hits: S.hitCount }, ...log, inWaterT: log.inWaterT.toFixed(1), stairsT: log.stairsT.toFixed(1), maxHeat: Math.round(log.maxHeat), minCop: Math.round(log.minCop) }; });
  console.log(JSON.stringify(r));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
