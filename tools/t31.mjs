// Full fast-forward race tallying set-piece interactions: kicker launches (who, airtime), rooftop falls, coins, crashes
import { openGame } from './serve-test.mjs';
const tr = process.argv[2] || 'mumbai-central';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&laps=${process.argv[3] || 2}&track=${tr}`, width: 480, height: 270 });
page.on('pageerror', e => console.log('PAGEERR', e.message));
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  const r = await page.evaluate(() => { const g = window.__chapri, R = g.race, T = g.track; let n = 0, err = null;
    const tally = { kickLaunch: 0, kickByPlayer: 0, maxAir: 0, falls: 0, crashes: {}, sideBounce: 0 };
    const air0 = new Map(); const crashed0 = new Map();
    try { while (n < 60 * 600 && R.state !== 'finished') { R.update(1 / 60); n++;
      for (const x of R.riders) {
        const wasAir = air0.get(x) || false; if (x.air && !wasAir && T.kickerAt(x.s - 2, x.d)) { tally.kickLaunch++; if (x.isPlayer) tally.kickByPlayer++; }
        if (x.air && x.airT > tally.maxAir) { tally.maxAir = x.airT; tally.maxAirAt = [x.short, Math.round(T.wrapD(x.s)), +x.y.toFixed(1), +x.vy.toFixed(1), x.crashed, +x.v.toFixed(1)]; } air0.set(x, x.air);
        if (x.crashed && !crashed0.get(x)) { const k = x.crashKind || x._crashWhy || 'crash'; tally.crashes[k] = (tally.crashes[k] || 0) + 1; (tally.where = tally.where || []).push(k[0] + Math.round(((x.s % T.L) + T.L) % T.L)); }
        crashed0.set(x, !!x.crashed); } } } catch (e) { err = e.message + ' ' + (e.stack || '').split('\n')[1]; }
    return { t: (n / 60).toFixed(0), state: R.state, err, pos: R.ranking().indexOf(R.player) + 1, coins: R.coinsGot || 0, coinsTotal: T.coins.length, ...tally, maxAir: tally.maxAir.toFixed(2) }; });
  console.log(JSON.stringify(r));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 10).join('\n'));
await browser.close();
