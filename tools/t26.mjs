// Where does AI wobble (→ crashes) come from? Tally addWobble by caller over a race.
import { openGame } from './serve-test.mjs';
const { browser, page, logs } = await openGame({ query: `?autopilot&q=low&laps=2&track=${process.argv[2] || 'mumbai-central'}`, width: 320, height: 180 });
try {
  await page.waitForSelector('#hud.show', { timeout: 90000 });
  const r = await page.evaluate(() => { const g = window.__chapri, R = g.race; const proto = Object.getPrototypeOf(R.riders[1]); const orig = proto.addWobble; const tally = {}; const crashes = {};
    proto.addWobble = function (n, q) { if (!this.isPlayer) { let line = (new Error().stack.split('\n')[2] || '').trim().split(' ')[1] || '?'; if (line === 'Race.interactions') { const T = R.track; const near = R.world.obstacles.find(o => { let ds = this.s - o.s; if (ds > T.L / 2) ds -= T.L; if (ds < -T.L / 2) ds += T.L; return Math.abs(ds) < o.hl + 1.2 && Math.abs(this.d - o.d) < o.hw + 0.6; }); line += near ? ':' + near.kind : ':riders'; } tally[line] = (tally[line] || 0) + n; } return orig.call(this, n, q); };
    const oc = R.onCrash.bind(R); R.onCrash = (rr, reason) => { if (!rr.isPlayer) { const k = reason + (rr.lastHitBy && R.raceT - rr.lastHitT < 2.5 ? '+hit' : ''); crashes[k] = (crashes[k] || 0) + 1; } return oc(rr, reason); };
    let n = 0; while (n < 60 * 400 && R.state !== 'finished') { R.update(1 / 60); n++; }
    const t2 = {}; for (const k in tally) t2[k] = Math.round(tally[k]); return { tally: t2, crashes }; });
  console.log(JSON.stringify(r));
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
await browser.close();
